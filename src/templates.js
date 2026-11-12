// Layout templates. Three layouts cover the five formats:
//   stack  (post, story, poster)  logo, illustration, highlighted title, icon highlights, info cards, CTA
//   split  (slide)                content panel left, accent panel with illustration + QR right
//   strip  (screen banner)        title left, illustration centre, date block + details right
//
// Visual language: heavy all-caps Poppins with a highlighter swatch on the last title line,
// flat outlined illustrations picked from the event category, honeycomb hexagons, and info cards
// with hard offset shadows. Every brief can pick `theme: "light" | "dark"`.

import { Canvas, seeded } from './canvas.js';
import { FORMATS } from './formats.js';
import { measure } from './text.js';
import { illustration, pickArt, pickIcon, icon, hexCluster, hexPath, logoMark } from './art.js';

const SECOND = { gold: ['teal', 'coral'], teal: ['gold', 'coral'], coral: ['gold', 'teal'] };
const DAY_RE = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(.+)$/i;

/** "Mon, Sep 8" -> { day: "MON", rest: "SEP 8" }; anything else (ranges, "Dec 1–12") -> null. */
export function splitDate(d) {
  const m = DAY_RE.exec(String(d || '').trim());
  return m ? { day: m[1].toUpperCase(), rest: m[2].toUpperCase() } : null;
}

function themeOf(b) {
  const accent = b.accent || 'gold';
  const dark = b.theme === 'dark';
  return {
    dark,
    accent,
    second: SECOND[accent]?.[0] || 'teal',
    third: SECOND[accent]?.[1] || 'coral',
    bg: dark ? 'ink' : 'paper',
    text: dark ? 'paper' : 'ink',
    sub: dark ? 'mist' : 'ink',
    shadow: dark ? accent : 'ink',
    markFill: 'ink',
  };
}

function ctxOf(c, b, f) {
  const T = themeOf(b);
  const hex = (n) => c.color(n);
  return {
    b, f, p: f.p, T, hex,
    rnd: seeded(b.title || 'event'),
    art: pickArt(b),
    artColors: { a: hex(T.accent), b: hex(T.second), c: hex(T.third), ink: hex('ink'), paper: hex('paper') },
    org: c.brand.org || { lines: ['Student', 'Union'] },
  };
}

// ---------------------------------------------------------------- components

function background(c, x) {
  const { f, p, T, hex } = x;
  c.rect(0, 0, f.w, f.h, T.bg);
  // faint honeycomb texture
  const r = Math.round(f.w / 9);
  let tex = '';
  const rnd = seeded(`${x.b.title}-tex`);
  for (let i = 0; i < 9; i++) {
    tex += `<path d="${hexPath(rnd() * f.w, rnd() * f.h, r * (0.6 + rnd()))}" fill="${hex(T.dark ? 'paper' : 'mist')}" fill-opacity="${T.dark ? 0.035 : 0.7}"/>`;
  }
  c.raw(tex);
  if (p.hexTR) {
    const { x: hx, y: hy, r: hr } = p.hexTR;
    c.raw(hexCluster(hx, hy, hr, [
      [0, 0, hex(T.second)], [-1, 0, hex(T.accent)], [0, 1, hex(T.dark ? 'mist' : 'ink'), T.dark ? 0.15 : 1], [-1, -1, hex(T.third), 0.9],
    ]));
  }
  if (p.hexBL) {
    const { x: hx, y: hy, r: hr } = p.hexBL;
    c.raw(hexCluster(hx, hy, hr, [[0, 0, hex(T.accent)], [1, 0, hex(T.second)], [1, -1, hex(T.dark ? 'mist' : 'ink'), T.dark ? 0.15 : 0.12]]));
  }
}

/** Illustration; on dark pages (or coloured panels) it sits on a light hexagon badge so the outlines read. */
function art(c, x, box, { badge = x.T.dark, colors = x.artColors } = {}) {
  if (badge) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    c.raw(`<path d="${hexPath(cx, cy, Math.min(box.w, box.h) * 0.5, Math.PI / 6)}" fill="${x.hex('mist')}"/>`);
    const inset = Math.min(box.w, box.h) * 0.14;
    box = { x: box.x + inset, y: box.y + inset, w: box.w - 2 * inset, h: box.h - 2 * inset };
  }
  c.raw(illustration(x.art, box, colors));
}

function logo(c, x, left, top, size, { onPanel = null } = {}) {
  const { T, hex, org, f } = x;
  const bg = onPanel || T.bg;
  const fg = onPanel ? 'ink' : T.text;
  const s = Math.round(size * 2.2);
  c.raw(logoMark(left, top, s, hex(onPanel ? 'ink' : T.dark ? T.accent : 'ink'), hex(onPanel ? 'paper' : T.dark ? 'ink' : T.accent)));
  const tx = left + s + Math.round(size * 0.5);
  const size2 = Math.max(f.minText, Math.round(size * 0.86));
  c.text('logo-1', 'logo', org.lines[0], { x: tx, y: top - 2, w: 420, h: size * 1.1 },
    { family: 'Poppins', weight: 700, max: size, min: size, maxLines: 1, lh: 1, fill: fg, bg, upper: true, tracking: 1 });
  c.text('logo-2', 'logo', org.lines[1] || '', { x: tx, y: top + size * 1.05, w: 420, h: size2 * 1.1 },
    { family: 'Poppins', weight: 500, max: size2, min: size2, maxLines: 1, lh: 1, fill: fg, bg, upper: true, tracking: 1 });
  return s;
}

/** Category pill (accent fill, ink text). Returns its height. */
function categoryPill(c, x, left, top, size, maxW) {
  const { b, T } = x;
  const label = String(b.category || 'Campus event').toUpperCase();
  let s = size;
  const pad = () => s * 0.8;
  while (s > x.f.minText && measure(label, { family: 'Poppins', weight: 700, size: s, tracking: 2 }) + 2 * pad() > maxW) s -= 2;
  const tw = measure(label, { family: 'Poppins', weight: 700, size: s, tracking: 2 });
  const h = Math.round(s * 1.9);
  c.rect(left, top, Math.min(maxW, tw + 2 * pad()), h, T.accent, { rx: h / 2 });
  c.text('eyebrow', 'eyebrow', label, { x: left + pad(), y: top + (h - s * 1.2) / 2, w: Math.min(maxW - 2 * pad(), tw + 2), h: s * 1.2 },
    { family: 'Poppins', weight: 700, max: s, min: s, maxLines: 1, lh: 1.2, fill: 'ink', bg: T.accent, tracking: 2 });
  return h;
}

function title(c, x, box, { onPanel = null } = {}) {
  const { b, p, T, rnd } = x;
  return c.titleBlock(b.title, box,
    { family: 'Poppins', weight: 700, max: p.titleMax, min: p.titleMin, maxLines: p.titleLines, lh: 1.04, fill: onPanel ? 'ink' : T.text, bg: onPanel || T.bg, upper: true, tracking: -1 },
    { mark: onPanel ? 'paper' : T.accent, markFill: 'ink', rnd });
}

function tagline(c, x, box, { onPanel = null } = {}) {
  const { b, p, T } = x;
  if (!b.tagline || box.h < p.tagMin * 1.3) return 0;
  return c.text('tagline', 'tagline', b.tagline, box,
    { family: 'Inter', weight: 400, max: p.tagMax, min: p.tagMin, maxLines: p.tagLines, lh: 1.3, fill: onPanel ? 'ink' : T.sub, bg: onPanel || T.bg });
}

/** Up to three icon highlights separated by rules (from brief.highlights). Returns false when there are none. */
function highlights(c, x, left, top, w, h) {
  const { b, p, T, hex } = x;
  const items = (b.highlights || []).slice(0, 3).map((it) => (typeof it === 'string' ? { text: it } : it)).filter((it) => it.text);
  if (!items.length) return false;
  const colW = w / items.length;
  const r = p.hlR;
  items.forEach((it, i) => {
    const cx = left + colW * (i + 0.5);
    if (i > 0) c.raw(`<path d="M${left + colW * i} ${top + 8}V${top + h - 8}" stroke="${hex(T.dark ? T.accent : 'ink')}" stroke-width="5" stroke-linecap="round"/>`);
    c.raw(`<circle cx="${cx}" cy="${top + r + 4}" r="${r}" fill="${hex(i % 2 ? T.second : T.accent)}" stroke="${hex('ink')}" stroke-width="4"/>`);
    c.raw(icon(it.icon || pickIcon(it.text), cx, top + r + 4, r * 1.15, hex('ink')));
    const ly = top + 2 * r + 22;
    c.text(`highlight-${i + 1}`, 'highlight', it.text, { x: left + colW * i + 14, y: ly, w: colW - 28, h: top + h - ly },
      { family: 'Poppins', weight: 700, max: p.hlSize, min: p.hlMin, maxLines: 2, lh: 1.08, fill: T.text, bg: T.bg, upper: true, align: 'center' });
  });
  return true;
}

/** Date / time / location as three outlined cards with hard shadows. The date card leads with the weekday. */
function infoCards(c, x, left, top, w, h) {
  const { b, p, T, hex } = x;
  const items = [
    { key: 'date', label: 'Date', icon: 'calendar', val: b.date, weight: 0.29 },
    { key: 'time', label: 'Time', icon: 'clock', val: b.time, weight: 0.27 },
    { key: 'where', label: 'Where', icon: 'pin', val: b.location, weight: 0.44 },
  ].filter((i) => i.val);
  const gap = Math.round(p.shadow * 2.2);
  const sh = p.shadow;
  const total = items.reduce((a, i) => a + i.weight, 0);
  const usable = w - sh - gap * (items.length - 1);
  const ch = h - sh;
  let cx = left;
  for (const it of items) {
    const cw = Math.floor((usable * it.weight) / total);
    c.card(cx, top, cw, ch, { shadow: sh, shadowFill: T.shadow, r: 20 });
    const pd = p.cardPad, r = p.iconR;
    c.raw(`<circle cx="${cx + pd + r}" cy="${top + pd + r}" r="${r}" fill="${hex(it.key === 'time' ? T.second : T.accent)}"/>`);
    c.raw(icon(it.icon, cx + pd + r, top + pd + r, r * 1.3, hex('ink')));
    const lx = cx + pd + 2 * r + 12;
    c.text(`${it.key}-label`, 'label', it.label, { x: lx, y: top + pd + r - p.label * 0.62, w: cx + cw - pd - lx, h: p.label * 1.25 },
      { family: 'Inter', weight: 700, max: p.label, min: p.label, maxLines: 1, lh: 1.25, fill: 'ink', bg: 'paper', upper: true, tracking: 1.5 });
    const vy = top + pd + 2 * r + Math.round(pd * 0.7);
    const vw = cw - 2 * pd;
    const vh = top + ch - pd - vy;
    const split = it.key === 'date' ? splitDate(it.val) : null;
    if (split) {
      const dh = c.text('date-day', 'info', split.day, { x: cx + pd, y: vy - p.value * 0.1, w: vw, h: vh * 0.62 },
        { family: 'Poppins', weight: 700, max: Math.round(p.value * 1.7), min: p.valueMin, maxLines: 1, lh: 1.0, fill: 'ink', bg: 'paper' });
      c.text('date-value', 'info', split.rest, { x: cx + pd, y: vy + dh, w: vw, h: top + ch - pd - vy - dh },
        { family: 'Poppins', weight: 500, max: p.value, min: p.valueMin, maxLines: 1, lh: 1.1, fill: 'ink', bg: 'paper', upper: true });
    } else {
      c.text(`${it.key}-value`, 'info', it.val, { x: cx + pd, y: vy, w: vw, h: vh },
        { family: 'Poppins', weight: 700, max: p.value, min: p.valueMin, maxLines: it.key === 'where' ? 3 : 2, lh: 1.12, fill: 'ink', bg: 'paper' });
    }
    cx += cw + gap;
  }
}

const linkText = (x, c) => (c.track ? c.track.display : x.b.link) || '';

/** CTA pill: action in caps, the (tracked) link, and an arrow button at the end. */
function ctaBar(c, x, left, top, w, h, { fill, size = x.p.ctaSize } = {}) {
  const { b, T, hex } = x;
  const pill = fill || (T.dark ? T.accent : 'ink');
  const onAccent = pill !== 'ink';
  const labelFill = onAccent ? 'ink' : T.accent;
  const linkFill = onAccent ? 'ink' : 'paper';
  c.rect(left, top, w, h, pill, { rx: h / 2 });
  const r = h * 0.34;
  const ax = left + w - h / 2;
  c.raw(`<circle cx="${ax}" cy="${top + h / 2}" r="${r}" fill="${hex(onAccent ? 'ink' : T.accent)}"/>` +
    `<path d="M${ax - r * 0.42} ${top + h / 2}H${ax + r * 0.4}M${ax + r * 0.05} ${top + h / 2 - r * 0.38}L${ax + r * 0.42} ${top + h / 2}L${ax + r * 0.05} ${top + h / 2 + r * 0.38}" fill="none" stroke="${hex(onAccent ? T.accent : 'ink')}" stroke-width="${Math.max(4, r * 0.16)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const x0 = left + h * 0.42;
  const inner = ax - r - 18 - x0;
  const link = linkText(x, c);
  const action = String(b.cta || '').toUpperCase();
  const ty = (s) => top + (h - s * 1.2) / 2;
  const minT = x.f.minText;
  const W = (t, wt, sz, tr = 0) => measure(t, { family: 'Poppins', weight: wt, size: sz, tracking: tr });
  if (action && link) {
    let one = 0;
    for (let sz = size; sz >= minT; sz -= 2) {
      const ls = Math.max(minT, Math.round(sz * 0.86));
      if (W(action, 700, sz, 1) + sz * 1.1 + W(link, 500, ls) <= inner) { one = sz; break; }
    }
    if (one) {
      const ls = Math.max(minT, Math.round(one * 0.86));
      const lw = W(action, 700, one, 1) + 2;
      c.text('cta-label', 'cta', action, { x: x0, y: ty(one), w: lw, h: one * 1.2 },
        { family: 'Poppins', weight: 700, max: one, min: one, maxLines: 1, lh: 1.2, fill: labelFill, bg: pill, tracking: 1 });
      const sx = x0 + lw + one * 0.45;
      c.raw(`<path d="M${sx} ${top + h * 0.3}V${top + h * 0.7}" stroke="${hex(labelFill)}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`);
      c.text('cta', 'cta', link, { x: sx + one * 0.5, y: ty(ls), w: ax - r - 12 - (sx + one * 0.5), h: ls * 1.2 },
        { family: 'Poppins', weight: 500, max: ls, min: minT, maxLines: 1, lh: 1.2, fill: linkFill, bg: pill });
    } else {
      // stacked: small action line over the link
      const s1 = Math.max(minT, Math.round(h * 0.25)), s2 = Math.max(minT, Math.round(h * 0.28));
      const y1 = top + (h - (s1 + s2) * 1.12) / 2;
      c.text('cta-label', 'cta', action, { x: x0, y: y1, w: inner, h: s1 * 1.12 },
        { family: 'Poppins', weight: 700, max: s1, min: minT, maxLines: 1, lh: 1.12, fill: labelFill, bg: pill, tracking: 1 });
      c.text('cta', 'cta', link, { x: x0, y: y1 + s1 * 1.12, w: inner, h: s2 * 1.12 },
        { family: 'Poppins', weight: 500, max: s2, min: minT, maxLines: 1, lh: 1.12, fill: linkFill, bg: pill });
    }
  } else {
    c.text('cta', 'cta', action || link, { x: x0, y: ty(size), w: inner, h: size * 1.2 },
      { family: 'Poppins', weight: 700, max: size, min: minT, maxLines: 1, lh: 1.2, fill: labelFill, bg: pill });
  }
}

/** Outlined card holding the QR code and its caption. */
function qrCard(c, x, left, top, w, h) {
  const { b, p, T } = x;
  const sh = p.shadow;
  c.card(left, top, w - sh, h - sh, { shadow: sh, shadowFill: T.shadow, r: 22 });
  const capH = p.qrCaption * 1.2 * 2;
  const target = Math.min(p.qr, w - sh - 24, h - sh - capH - 36);
  const { side, y } = c.qr('qr', c.track.url, { cx: left + (w - sh) / 2, cy: top + 14 + target / 2, target });
  c.text('qr-caption', 'caption', b.qrCaption || 'Scan for details', { x: left + 16, y: y + side + 4, w: w - sh - 32, h: capH },
    { family: 'Poppins', weight: 700, max: p.qrCaption, min: x.f.minText, maxLines: 2, lh: 1.2, fill: 'ink', bg: 'paper', align: 'center' });
}

// ---------------------------------------------------------------- layouts

function stack(c, b, f) {
  const x = ctxOf(c, b, f);
  const { w, h, p } = f;
  const tw = w - 2 * p.m;
  const withQr = Boolean(c.track && p.qr);

  background(c, x);
  const artBox = { x: w * p.art.x, y: p.art.y, w: p.art.s, h: p.art.s };
  art(c, x, artBox);

  // header, top-down
  let y = p.top;
  y += logo(c, x, p.m, y, p.logo) + p.gap;
  y += categoryPill(c, x, p.m, y, p.cat, Math.min(tw * p.titleW, w * p.art.x - p.m - 12)) + Math.round(p.gap * 0.9);
  const y0 = y;

  // footer, bottom-up
  let yb = h - p.bottom;
  if (p.hashtag && c.brand.org?.hashtag) {
    const hy = yb - p.hashtag * 1.2;
    c.text('hashtag', 'hashtag', c.brand.org.hashtag, { x: p.m, y: hy, w: tw, h: p.hashtag * 1.2 },
      { family: 'Poppins', weight: 700, max: p.hashtag, min: f.minText, maxLines: 1, lh: 1.2, fill: x.T.text, bg: x.T.bg, upper: true, tracking: 6, align: 'center' });
    yb = hy - Math.round(p.gap * 0.6);
  }
  const ctaTop = yb - p.ctaH;
  ctaBar(c, x, p.m, ctaTop, tw, p.ctaH);
  yb = ctaTop - p.gap;

  const cardsTop = yb - p.cardH;
  infoCards(c, x, p.m, cardsTop, tw, p.cardH);
  yb = cardsTop - p.gap;
  if (p.highlights && b.highlights?.length) {
    const hlTop = yb - p.hlH;
    highlights(c, x, p.m, hlTop, tw, p.hlH);
    yb = hlTop - p.gap;
  }

  // print formats: QR card in the artwork column, under the illustration
  let colX = artBox.x;
  if (withQr) {
    const qrW = p.qr + 40;
    const qx = w - p.m - qrW;
    const qy = artBox.y + artBox.h + Math.round(p.gap * 0.5);
    qrCard(c, x, qx, qy, qrW, yb - qy);
    colX = Math.min(colX, qx);
  }

  // title + tagline fill what is left, in the column beside the artwork
  const tagReserve = b.tagline ? p.tagMin * 1.3 * 2 + p.gap * 0.6 : 0;
  const titleW = Math.min(tw * p.titleW, colX - p.m - 16);
  const t = title(c, x, { x: p.m, y: y0, w: titleW, h: yb - y0 - tagReserve });
  const ty = y0 + t.height + Math.round(p.gap * 0.6);
  const tagW = !withQr && ty > artBox.y + artBox.h - 20 ? tw : Math.max(titleW, Math.min(tw * p.tagW, colX - p.m - 16));
  tagline(c, x, { x: p.m, y: ty, w: tagW, h: yb - ty });
}

function split(c, b, f) {
  const x = ctxOf(c, b, f);
  const { w, h, p } = f;
  const { T, hex } = x;
  const tw = p.panel - 2 * p.m;

  c.rect(0, 0, w, h, T.bg);
  c.raw(`<path d="${hexPath(p.panel * 0.72, h * 0.08, 210)}" fill="${hex(T.dark ? 'paper' : 'mist')}" fill-opacity="${T.dark ? 0.04 : 0.8}"/>`);
  // accent panel with honeycomb texture
  const pw = w - p.panel;
  c.rect(p.panel, 0, pw, h, T.accent);
  c.raw(hexCluster(p.panel + 40, 20, 80, [[0, 0, hex('ink'), 0.08], [1, 1, hex('paper'), 0.25], [3, 0, hex('ink'), 0.08], [4, 4, hex('ink'), 0.1], [3, 5, hex('paper'), 0.2]]));
  const panelColors = { ...x.artColors, a: hex(T.second), b: hex(T.third), c: hex(T.accent) };
  const withQr = Boolean(c.track && p.qr);
  if (withQr) {
    art(c, x, { x: p.panel + pw / 2 - 210, y: 50, w: 420, h: 420 }, { badge: true, colors: panelColors });
    const cw = p.qr + 70, chh = p.qr + 120;
    qrCard(c, x, p.panel + (pw - cw) / 2, h - p.bottom - chh + 10, cw, chh);
  } else {
    art(c, x, { x: p.panel + pw / 2 - 280, y: h / 2 - 280, w: 560, h: 560 }, { badge: true, colors: panelColors });
  }

  let y = p.top;
  y += logo(c, x, p.m, y, p.logo) + p.gap;
  y += categoryPill(c, x, p.m, y, p.cat, tw) + Math.round(p.gap * 0.8);
  const y0 = y;
  const ctaTop = h - p.bottom - p.ctaH;
  ctaBar(c, x, p.m, ctaTop, Math.min(tw, 980), p.ctaH);
  const cardsTop = ctaTop - p.gap - p.cardH;
  infoCards(c, x, p.m, cardsTop, tw, p.cardH);
  const yb = cardsTop - p.gap;
  const tagReserve = b.tagline ? p.tagMin * 1.3 * 2 + p.gap * 0.5 : 0;
  const t = title(c, x, { x: p.m, y: y0, w: tw, h: yb - y0 - tagReserve });
  const ty = y0 + t.height + Math.round(p.gap * 0.5);
  tagline(c, x, { x: p.m, y: ty, w: tw, h: yb - ty });
}

function strip(c, b, f) {
  const x = ctxOf(c, b, f);
  const { w, h, p } = f;
  const { T, hex } = x;
  const lw = 780;

  c.rect(0, 0, w, h, T.bg);
  c.raw(hexCluster(-20, h - 30, 70, [[0, 0, hex(T.accent)], [1, 0, hex(T.second)], [1, -1, hex(T.dark ? 'mist' : 'ink'), T.dark ? 0.15 : 0.12]]));
  art(c, x, { x: p.panel - 440, y: 30, w: 420, h: 420 });

  // right panel: weekday block + details + CTA
  const px = p.panel, pw = w - px;
  c.rect(px, 0, pw, h, T.accent);
  c.raw(hexCluster(w - 30, 10, 60, [[0, 0, hex('ink'), 0.1], [-1, 0, hex('paper'), 0.3], [0, 1, hex('ink'), 0.06]]));
  const bx = px + 56, top = 44;
  const rw = w - p.safeRight - bx;
  const row = (ic, val, id, rx, cy, ww, lines = 1) => {
    c.raw(`<circle cx="${rx + 26}" cy="${cy}" r="26" fill="${hex('ink')}"/>` + icon(ic, rx + 26, cy, 32, hex(T.accent)));
    c.text(id, 'info', val, { x: rx + 68, y: cy - p.value * 0.55 * lines, w: ww - 68, h: p.value * 1.1 * lines },
      { family: 'Poppins', weight: 700, max: p.value, min: p.valueMin, maxLines: lines, lh: 1.1, fill: 'ink', bg: T.accent });
  };
  const split = splitDate(b.date);
  if (split) {
    // This-Week style weekday block, time beside it, location full width underneath
    const bw = 176, bh = 156;
    c.card(bx, top, bw, bh, { shadow: 0, fill: 'ink', sw: 0, r: 24 });
    c.text('date-day', 'info', split.day, { x: bx + 14, y: top + 18, w: bw - 28, h: 80 },
      { family: 'Poppins', weight: 700, max: 76, min: 40, maxLines: 1, lh: 1.0, fill: T.accent, bg: 'ink', align: 'center' });
    c.text('date-value', 'info', split.rest, { x: bx + 14, y: top + 100, w: bw - 28, h: 40 },
      { family: 'Poppins', weight: 700, max: 34, min: 24, maxLines: 1, lh: 1.1, fill: 'paper', bg: 'ink', align: 'center' });
    if (b.time) row('clock', b.time, 'info-time', bx + bw + 30, top + bh / 2, rw - bw - 30);
    if (b.location) row('pin', b.location, 'where-value', bx, top + bh + 58, rw);
  } else {
    [['calendar', b.date, 'info-date'], ['clock', b.time, 'info-time'], ['pin', b.location, 'where-value']]
      .filter((r) => r[1])
      .forEach(([ic, val, id], i) => row(ic, val, id, bx, top + 34 + i * 74, rw));
  }
  ctaBar(c, x, bx, h - 44 - p.ctaH, rw, p.ctaH, { fill: 'ink', size: p.ctaSize });

  // left: logo, title, tagline
  const s = logo(c, x, p.m, 44, p.logo);
  const ty0 = 44 + s + 26;
  const t = title(c, x, { x: p.m, y: ty0, w: lw, h: 230 });
  tagline(c, x, { x: p.m, y: ty0 + t.height + 16, w: lw, h: h - 44 - (ty0 + t.height + 16) });
}

const LAYOUTS = { stack, split, strip };

/** Build one asset. Returns { svg, physicalSvg, elements, usedColors, fmt }. */
export function build(brief, formatKey, brand, { track = null } = {}) {
  const fmt = FORMATS[formatKey];
  if (!fmt) throw new Error(`Unknown format "${formatKey}"`);
  const c = new Canvas(fmt, brand, brief, track);
  fmt.p.safeRight = fmt.safe.right;
  LAYOUTS[fmt.layout](c, brief, fmt);
  return {
    format: formatKey,
    fmt,
    svg: c.svg(),
    physicalSvg: c.svg({ physical: true }),
    elements: c.elements,
    usedColors: [...c.usedColors],
  };
}
