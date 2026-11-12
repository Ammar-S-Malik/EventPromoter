// Tiny SVG scene builder that records every text element it places,
// so the linter can check the exact same geometry that gets rendered.

import { fit, measure } from './text.js';
import { swatch } from './art.js';
import { normHex } from './color.js';
import { qrEncode, qrSvg } from './qr.js';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Deterministic PRNG so the same brief always yields the same artwork.
export function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export class Canvas {
  constructor(fmt, brand, brief, track = null) {
    this.track = track; // { url, display } when short-link tracking is on
    this.fmt = fmt;
    this.brand = brand;
    this.brief = brief;
    this.o = brief.overrides || {};
    this.parts = [];
    this.elements = [];
    this.usedColors = new Set();
  }

  /** Resolve a palette name ("ink") or a raw hex to a hex string. */
  color(c) {
    const hex = this.brand.colors[c] ?? c;
    return normHex(hex);
  }

  rect(x, y, w, h, fill, { rx = 0, opacity = 1, decor = false } = {}) {
    const f = this.color(fill);
    if (!decor) this.usedColors.add(f);
    this.parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
    );
  }

  /** Raw SVG (artwork, decoration). Not linted, so callers must only pass brand colours. */
  raw(svg) {
    this.parts.push(svg);
  }

  /** Card with a hard offset shadow and an ink outline (the "sticker" info cards). */
  card(x, y, w, h, { r = 18, shadow = 10, shadowFill = 'ink', fill = 'paper', stroke = 'ink', sw = 3 } = {}) {
    const sf = this.color(shadowFill), f = this.color(fill), st = this.color(stroke);
    this.usedColors.add(f);
    if (shadow) this.parts.push(`<rect x="${x + shadow}" y="${y + shadow}" width="${w}" height="${h}" rx="${r}" fill="${sf}"/>`);
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"${sw ? ` stroke="${st}" stroke-width="${sw}"` : ''}/>`);
  }

  circle(cx, cy, r, fill, { opacity = 1 } = {}) {
    this.parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${this.color(fill)}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
    );
  }

  /**
   * Place fitted text. `role` selects per-role overrides from brief.overrides
   * (e.g. titleFill, titleFamily, titleWeight, titleSize), which is how a hand-tweaked
   * design drifts off-brand and gets caught by the linter.
   * Returns the height used.
   */
  text(id, role, str, box, s) {
    const o = this.o;
    const family = o[`${role}Family`] ?? s.family;
    const weight = o[`${role}Weight`] ?? s.weight;
    const fillName = o[`${role}Fill`] ?? s.fill;
    const forced = o[`${role}Size`];
    const tracking = s.tracking ?? 0;
    const lh = s.lh ?? 1.15;
    const content = s.upper ? String(str).toUpperCase() : String(str);
    const f = fit(content, { family, weight, tracking }, box, {
      max: forced ?? s.max,
      min: forced ?? s.min,
      maxLines: s.maxLines,
      lh,
    });
    const fill = this.color(fillName);
    const bg = this.color(s.bg);
    this.usedColors.add(fill);
    this.usedColors.add(bg);

    const tspans = f.lines
      .map((line, i) => {
        const y = box.y + (i + 0.5) * f.size * lh + f.size * 0.35;
        const x = s.align === 'center' ? box.x + box.w / 2 : s.align === 'right' ? box.x + box.w : box.x;
        return `<tspan x="${x}" y="${y.toFixed(1)}">${esc(line)}</tspan>`;
      })
      .join('');
    this.parts.push(
      `<text font-family="${esc(family)}, sans-serif" font-weight="${weight}" font-size="${f.size}" fill="${fill}"` +
        `${s.align === 'center' ? ' text-anchor="middle"' : s.align === 'right' ? ' text-anchor="end"' : ''}` +
        `${tracking ? ` letter-spacing="${tracking}"` : ''}>${tspans}</text>`
    );
    this.elements.push({
      id,
      role,
      text: content,
      lines: f.lines,
      family,
      weight,
      size: f.size,
      tracking,
      fill,
      bg,
      overflow: f.overflow,
      box: { x: box.x, y: box.y, w: box.w, h: f.height },
    });
    this.lastFit = f;
    return f.height;
  }

  /**
   * Display title: fitted like text(), but the last line sits on a hand-painted highlighter swatch
   * (`mark` colour) with its own text colour (`markFill`). Recorded as two lint elements:
   * "title" (all lines, on the page colour) and "title-mark" (the last line, on the swatch).
   */
  titleBlock(str, box, s, { mark, markFill, rnd }) {
    const o = this.o;
    const family = o.titleFamily ?? s.family;
    const weight = o.titleWeight ?? s.weight;
    const fillName = o.titleFill ?? s.fill;
    const forced = o.titleSize;
    const tracking = s.tracking ?? 0;
    const lh = s.lh ?? 1.05;
    const content = s.upper ? String(str).toUpperCase() : String(str);
    const f = fit(content, { family, weight, tracking }, box, { max: forced ?? s.max, min: forced ?? s.min, maxLines: s.maxLines, lh });
    const fill = this.color(fillName), bg = this.color(s.bg), mf = this.color(markFill), mk = this.color(mark);
    [fill, bg, mf, mk].forEach((c) => this.usedColors.add(c));
    const last = f.lines.length - 1;
    const lineW = (l) => measure(l, { family, weight, size: f.size, tracking });
    const top = (i) => box.y + i * f.size * lh;
    const pad = f.size * 0.2;
    this.parts.push(swatch(box.x - pad, top(last) + f.size * 0.04, lineW(f.lines[last]) + pad * 2, f.size * 0.9, mk, rnd));
    const tspans = f.lines
      .map((line, i) => `<tspan x="${box.x}" y="${(top(i) + 0.5 * f.size * lh + f.size * 0.35).toFixed(1)}"${i === last ? ` fill="${mf}"` : ''}>${esc(line)}</tspan>`)
      .join('');
    this.parts.push(
      `<text font-family="${esc(family)}, sans-serif" font-weight="${weight}" font-size="${f.size}" fill="${fill}"${tracking ? ` letter-spacing="${tracking}"` : ''}>${tspans}</text>`
    );
    const base = { role: 'title', family, weight, size: f.size, tracking, overflow: f.overflow };
    this.elements.push({ ...base, id: 'title', text: content, lines: f.lines, fill, bg, box: { x: box.x, y: box.y, w: box.w, h: f.height } });
    this.elements.push({ ...base, id: 'title-mark', text: f.lines[last], lines: [f.lines[last]], fill: mf, bg: mk, overflow: false, box: { x: box.x, y: top(last), w: box.w, h: f.size * lh } });
    return { height: f.height, size: f.size, lines: f.lines, lastWidth: lineW(f.lines[last]) };
  }

  /**
   * Place a QR code (dark modules on a light plate with the mandatory 4-module quiet zone).
   * Anchor with { right, cy } or { cx, cy }. Records the plate geometry so the linter can check it.
   */
  qr(id, url, { right, cx, cy, target }) {
    const { size: n } = qrEncode(url);
    const cell = Math.max(1, Math.floor(target / (n + 8)));
    const side = cell * (n + 8);
    const x = right !== undefined ? right - side : cx - side / 2;
    const y = cy - side / 2;
    const q = qrSvg(url, { x, y, target, dark: this.color('ink'), light: this.color('paper'), radius: 14 });
    this.parts.push(q.svg);
    this.usedColors.add(this.color('ink')); this.usedColors.add(this.color('paper'));
    this.elements.push({ id, kind: 'qr', cell, modules: n, box: { x, y, w: side, h: side } });
    return { x, y, side };
  }

  /** Abstract artwork derived from the title: circles + bars in brand colours only. */
  motif(region, accent, seedText) {
    const rnd = seeded(seedText);
    const { x, y, w, h } = region;
    const palette = [accent, 'paper', 'mist', accent];
    for (let i = 0; i < 9; i++) {
      const r = (0.12 + rnd() * 0.32) * Math.min(w, h);
      this.circle(x + rnd() * w, y + rnd() * h, r, palette[i % palette.length], { opacity: 0.06 + rnd() * 0.1 });
    }
    for (let i = 0; i < 4; i++) {
      const bw = (0.4 + rnd() * 0.5) * w;
      const bh = Math.max(10, h * 0.025);
      this.parts.push(
        `<rect x="${(x + rnd() * (w - bw)).toFixed(1)}" y="${(y + rnd() * h).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bh / 2).toFixed(1)}" fill="${this.color(accent)}" fill-opacity="0.22" transform="rotate(-12 ${x + w / 2} ${y + h / 2})"/>`
      );
    }
  }

  svg({ physical = false } = {}) {
    const { w, h, widthIn, heightIn } = this.fmt;
    const size = physical && widthIn ? `width="${widthIn}in" height="${heightIn}in"` : `width="${w}" height="${h}"`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${w} ${h}">` +
      `<defs><clipPath id="page"><rect width="${w}" height="${h}"/></clipPath></defs>` +
      `<g clip-path="url(#page)">${this.parts.join('')}</g></svg>`
    );
  }
}
