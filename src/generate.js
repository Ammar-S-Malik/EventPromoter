// Everything the admin "New event" flow needs that is not tied to a runtime: reading a form into
// a brief, validating it, and building (+ linting) all five assets. Pure functions, no I/O, so the
// same code runs in the Worker, the CLI and the tests.

import { build } from './templates.js';
import { lint, hasErrors } from './lint.js';
import { FORMATS, FORMAT_KEYS } from './formats.js';
import { CHANNELS, slugify, assertHttpUrl, shortUrl, displayLink } from './links.js';
import { ART_KINDS } from './art.js';

export const ACCENTS = ['gold', 'teal', 'coral'];
export const THEMES = ['light', 'dark'];
export { ART_KINDS };

/** Every file an event produces, in display order. `key` is the format it is rendered from. */
export const FILES = [
  { name: 'ig-post.png', key: 'ig-post', label: 'Instagram post', type: 'image/png', size: '1080 × 1080' },
  { name: 'ig-story.png', key: 'ig-story', label: 'Instagram story', type: 'image/png', size: '1080 × 1920' },
  { name: 'poster.png', key: 'poster', label: 'Poster', type: 'image/png', size: '2200 × 3400 (11 × 17 in at 200 dpi)' },
  { name: 'poster-print.pdf', key: 'poster', label: 'Poster, print PDF', type: 'application/pdf', size: '11 × 17 in' },
  { name: 'slide.png', key: 'slide', label: 'Presentation slide', type: 'image/png', size: '1920 × 1080' },
  { name: 'banner.png', key: 'banner', label: 'Screen banner', type: 'image/png', size: '1920 × 480' },
];
export const FILE_BY_NAME = Object.fromEntries(FILES.map((f) => [f.name, f]));
/** PNG scale per format: the poster is rendered at 2x so the print PDF is sharp. */
export const SCALE = { poster: 2 };

const FIELDS = {
  title: { max: 120, required: true, label: 'Title' },
  category: { max: 40, required: true, label: 'Category' },
  tagline: { max: 200, label: 'Tagline' },
  date: { max: 40, required: true, label: 'Date' },
  time: { max: 40, label: 'Time' },
  location: { max: 100, required: true, label: 'Location' },
  cta: { max: 60, required: true, label: 'Button text' },
  qrCaption: { max: 60, label: 'QR caption' },
};
const CONTROL = /[\u0000-\u001f\u007f]/;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const get = (input, k) => (typeof input.get === 'function' ? input.get(k) : input[k]);

/**
 * Turn form input (FormData or a plain object) into a brief.
 * Returns { brief, errors } where errors is { field: message } and empty when the input is usable.
 */
export function parseBrief(input) {
  const errors = {};
  const brief = {};
  for (const [k, f] of Object.entries(FIELDS)) {
    const v = clean(get(input, k));
    if (CONTROL.test(v)) errors[k] = `${f.label} contains characters that are not allowed.`;
    else if (!v && f.required) errors[k] = `${f.label} is required.`;
    else if (v.length > f.max) errors[k] = `${f.label} is ${v.length} characters; the most allowed is ${f.max}.`;
    else if (v) brief[k] = v;
  }

  const dest = clean(get(input, 'destination'));
  if (!dest) errors.destination = 'Destination link is required.';
  else if (dest.length > 500) errors.destination = 'Destination link is too long (500 characters at most).';
  else {
    try { assertHttpUrl(dest); brief.destination = dest; } catch { errors.destination = 'Enter a full link starting with https://'; }
  }

  const accent = clean(get(input, 'accent')) || 'gold';
  if (ACCENTS.includes(accent)) brief.accent = accent; else errors.accent = 'Pick one of the listed colours.';
  const theme = clean(get(input, 'theme')) || 'light';
  if (THEMES.includes(theme)) brief.theme = theme; else errors.theme = 'Pick light or dark.';
  const art = clean(get(input, 'art'));
  if (art) { if (ART_KINDS.includes(art)) brief.art = art; else errors.art = 'Pick one of the listed illustrations.'; }

  const hl = [1, 2, 3].map((i) => clean(get(input, `highlight${i}`))).filter(Boolean);
  if (hl.some((h) => h.length > 40)) errors.highlights = 'Each highlight can be up to 40 characters.';
  else if (hl.some((h) => CONTROL.test(h))) errors.highlights = 'Highlights contain characters that are not allowed.';
  else if (hl.length) brief.highlights = hl;

  return { brief, errors };
}

/** The values to show in the form for an existing brief. */
export function formValues(brief = {}) {
  const hl = brief.highlights || [];
  return {
    title: brief.title || '', category: brief.category || '', tagline: brief.tagline || '', date: brief.date || '',
    time: brief.time || '', location: brief.location || '', cta: brief.cta || '', destination: brief.destination || '',
    accent: brief.accent || 'gold', theme: brief.theme || 'light', art: brief.art || '', qrCaption: brief.qrCaption || '',
    highlight1: hl[0] || '', highlight2: hl[1] || '', highlight3: hl[2] || '',
  };
}

export const RESERVED_IDS = new Set(['new']);
export const campaignId = (title) => slugify(title);

/** Build one asset for a campaign, with its tracked short link. */
export function buildAsset(brief, key, brand, { origin, codes }) {
  const code = codes[key];
  const track = { url: shortUrl(origin, code, { qr: true }), display: displayLink(origin, code) };
  const asset = build(brief, key, brand, { track });
  return { asset, issues: lint(asset, brief, brand) };
}

/** Dry run with placeholder codes: the lint result for every format, without rendering anything. */
export function preflight(brief, brand, origin = 'https://go.example.org') {
  const codes = Object.fromEntries(FORMAT_KEYS.map((k) => [k, 'aaaaaa']));
  const out = {};
  for (const key of FORMAT_KEYS) out[key] = buildAsset(brief, key, brand, { origin, codes }).issues;
  return out;
}

/** Flatten per-format issues into one list for display, de-duplicating copy-length warnings. */
export function summariseIssues(byFormat) {
  const seen = new Set();
  const list = [];
  for (const key of FORMAT_KEYS) {
    for (const i of byFormat[key] || []) {
      const id = i.rule === 'copy-length' ? `${i.rule}:${i.element}` : `${key}:${i.rule}:${i.element}:${i.message}`;
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ ...i, format: i.rule === 'copy-length' ? null : FORMATS[key].label });
    }
  }
  return { errors: list.filter((i) => i.severity === 'error'), warnings: list.filter((i) => i.severity !== 'error') };
}

export { hasErrors, CHANNELS, FORMAT_KEYS };
