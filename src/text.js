// Text measurement, wrapping and fit-to-box, driven by real glyph advance widths
// (src/metrics.js). No DOM, no canvas, no font loading: runs in Node, Workers, anywhere.

import M from './metrics.js';

export const fontKey = (family, weight) => `${family.toLowerCase()}-${weight}`;
export const knownFont = (family, weight) => fontKey(family, weight) in M;

// Kerning is not modelled, so widths are padded by 2% to stay conservative.
const SAFETY = 1.02;

export function measure(text, { family, weight, size, tracking = 0 }) {
  const m = M[fontKey(family, weight)] || M['poppins-400'];
  let w = 0;
  for (const ch of text) w += (m.widths[ch] ?? m.fallback) * size + tracking;
  return w * SAFETY;
}

export function wrap(text, font, maxW) {
  // tokens carry the separator that joins them to the previous one: ' ' normally, '' after a hyphen,
  // so "Non-perishables" can break as "Non-" / "perishables" when it is too wide for one line
  const tokens = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const parts = measure(word, font) > maxW ? word.split(/(?<=-)(?=.)/) : [word];
    parts.forEach((p, i) => tokens.push({ p, sep: i ? '' : ' ' }));
  }
  const lines = [];
  let cur = '';
  for (const { p, sep } of tokens) {
    const t = cur ? `${cur}${sep}${p}` : p;
    if (!cur || measure(t, font) <= maxW) cur = t;
    else {
      lines.push(cur);
      cur = p;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Largest font size in [min, max] at which `text` fits the box.
 * Returns { size, lines, height, overflow }. overflow=true means even `min` did not fit.
 */
export function fit(text, { family, weight, tracking = 0 }, { w, h }, { max, min, maxLines = 99, lh = 1.15, step = 2 }) {
  for (let s = max; s >= min; s -= step) {
    const font = { family, weight, size: s, tracking };
    const lines = wrap(text, font, w);
    const ok = lines.length <= maxLines && lines.length * s * lh <= h && lines.every((l) => measure(l, font) <= w);
    if (ok) return { size: s, lines, height: lines.length * s * lh, overflow: false };
  }
  const font = { family, weight, size: min, tracking };
  const lines = wrap(text, font, w);
  return { size: min, lines, height: lines.length * min * lh, overflow: true };
}
