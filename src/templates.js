import { Canvas } from './canvas.js';
import { FORMATS } from './formats.js';

const when = (b) => [b.date, b.time].filter(Boolean).join('  ·  ');
const cta = (b) => [b.cta, b.link].filter(Boolean).join('   →   ');

// ---- stack: eyebrow, big title, tagline, WHEN/WHERE block, CTA bar (post, story, poster)
function stack(c, b, f) {
  const { w, h, p } = f;
  const accent = b.accent || 'gold';
  const tw = w - 2 * p.m;

  c.rect(0, 0, w, h, 'ink');
  c.motif({ x: w * 0.5, y: 0, w: w * 0.5, h: h * 0.3 }, accent, b.title);
  c.rect(p.m, p.top, 96, 10, accent, { rx: 5 });

  c.text('eyebrow', 'eyebrow', b.category || 'Campus event', { x: p.m, y: p.top + 24, w: tw, h: p.eyebrow * 1.4 },
    { family: 'Poppins', weight: 500, max: p.eyebrow, min: p.eyebrow, maxLines: 1, fill: accent, bg: 'ink', tracking: 3, upper: true });

  // vertical budget, bottom-up
  const ctaTop = h - p.bottom - p.ctaH;
  const rowH = p.infoLabel * 1.5 + p.infoValue * 1.3 + 26;
  const infoTop = ctaTop - 50 - rowH * 2;
  const y0 = p.top + p.eyebrow * 1.4 + 56;
  const avail = infoTop - 40 - y0;

  const titleH = c.text('title', 'title', b.title, { x: p.m, y: y0, w: tw, h: avail * 0.68 },
    { family: 'Poppins', weight: 700, max: p.titleMax, min: p.titleMin, maxLines: p.titleLines, lh: 1.08, fill: 'paper', bg: 'ink' });

  const tagY = y0 + titleH + 28;
  if (b.tagline) {
    c.text('tagline', 'tagline', b.tagline, { x: p.m, y: tagY, w: tw, h: infoTop - 30 - tagY },
      { family: 'Inter', weight: 400, max: p.tagMax, min: p.tagMin, maxLines: 4, lh: 1.35, fill: 'mist', bg: 'ink' });
  }

  [['WHEN', when(b)], ['WHERE', b.location]].forEach(([label, val], i) => {
    const y = infoTop + i * rowH;
    c.text(`${label.toLowerCase()}-label`, 'label', label, { x: p.m, y, w: 300, h: p.infoLabel * 1.3 },
      { family: 'Inter', weight: 700, max: p.infoLabel, min: p.infoLabel, maxLines: 1, fill: accent, bg: 'ink', tracking: 2.5 });
    c.text(`${label.toLowerCase()}-value`, 'info', val || '', { x: p.m, y: y + p.infoLabel * 1.5, w: tw, h: p.infoValue * 1.3 },
      { family: 'Poppins', weight: 500, max: p.infoValue, min: p.infoValueMin, maxLines: 1, fill: 'paper', bg: 'ink' });
  });

  c.rect(p.m, ctaTop, tw, p.ctaH, accent, { rx: 22 });
  c.text('cta', 'cta', cta(b), { x: p.m + 36, y: ctaTop + (p.ctaH - p.ctaSize * 1.2) / 2, w: tw - 72, h: p.ctaSize * 1.3 },
    { family: 'Poppins', weight: 700, max: p.ctaSize, min: 24, maxLines: 1, fill: 'ink', bg: accent });
}

// ---- split: text panel left, artwork panel right (slide)
function split(c, b, f) {
  const { w, h, p } = f;
  const accent = b.accent || 'gold';
  const tw = p.panel - 2 * p.m;

  c.rect(0, 0, w, h, 'ink');
  c.rect(p.panel, 0, w - p.panel, h, accent);
  c.motif({ x: p.panel, y: 0, w: w - p.panel, h }, 'ink', b.title);
  c.rect(p.m, p.top, 96, 10, accent, { rx: 5 });

  c.text('eyebrow', 'eyebrow', b.category || 'Campus event', { x: p.m, y: p.top + 26, w: tw, h: p.eyebrow * 1.4 },
    { family: 'Poppins', weight: 500, max: p.eyebrow, min: p.eyebrow, maxLines: 1, fill: accent, bg: 'ink', tracking: 3, upper: true });

  const rowH = p.infoLabel * 1.5 + p.infoValue * 1.3 + 26;
  const ctaY = h - p.bottom - p.ctaSize * 1.3;
  const infoTop = ctaY - 60 - rowH * 2;
  const y0 = p.top + 110;
  const avail = infoTop - 40 - y0;

  const titleH = c.text('title', 'title', b.title, { x: p.m, y: y0, w: tw, h: avail * 0.7 },
    { family: 'Poppins', weight: 700, max: p.titleMax, min: p.titleMin, maxLines: p.titleLines, lh: 1.08, fill: 'paper', bg: 'ink' });
  if (b.tagline) {
    const ty = y0 + titleH + 24;
    c.text('tagline', 'tagline', b.tagline, { x: p.m, y: ty, w: tw, h: infoTop - 24 - ty },
      { family: 'Inter', weight: 400, max: p.tagMax, min: p.tagMin, maxLines: 3, lh: 1.35, fill: 'mist', bg: 'ink' });
  }
  [['WHEN', when(b)], ['WHERE', b.location]].forEach(([label, val], i) => {
    const y = infoTop + i * rowH;
    c.text(`${label.toLowerCase()}-label`, 'label', label, { x: p.m, y, w: 300, h: p.infoLabel * 1.3 },
      { family: 'Inter', weight: 700, max: p.infoLabel, min: p.infoLabel, maxLines: 1, fill: accent, bg: 'ink', tracking: 2.5 });
    c.text(`${label.toLowerCase()}-value`, 'info', val || '', { x: p.m, y: y + p.infoLabel * 1.5, w: tw, h: p.infoValue * 1.3 },
      { family: 'Poppins', weight: 500, max: p.infoValue, min: p.infoValueMin, maxLines: 1, fill: 'paper', bg: 'ink' });
  });
  c.text('cta', 'cta', cta(b), { x: p.m, y: ctaY, w: tw, h: p.ctaSize * 1.3 },
    { family: 'Poppins', weight: 700, max: p.ctaSize, min: 24, maxLines: 1, fill: accent, bg: 'ink' });
}

// ---- strip: title left, details block right (digital screen banner)
function strip(c, b, f) {
  const { w, h, p } = f;
  const accent = b.accent || 'gold';
  const lw = p.panel - 2 * p.m + 20;

  c.rect(0, 0, w, h, 'ink');
  c.motif({ x: p.panel * 0.62, y: 0, w: p.panel * 0.38, h }, accent, b.title);
  c.rect(p.panel, 0, w - p.panel, h, accent);

  c.text('eyebrow', 'eyebrow', b.category || 'Campus event', { x: p.m, y: 50, w: lw, h: p.eyebrow * 1.4 },
    { family: 'Poppins', weight: 500, max: p.eyebrow, min: p.eyebrow, maxLines: 1, fill: accent, bg: 'ink', tracking: 3, upper: true });
  const th = c.text('title', 'title', b.title, { x: p.m, y: 100, w: lw, h: 230 },
    { family: 'Poppins', weight: 700, max: p.titleMax, min: p.titleMin, maxLines: p.titleLines, lh: 1.08, fill: 'paper', bg: 'ink' });
  if (b.tagline) {
    c.text('tagline', 'tagline', b.tagline, { x: p.m, y: 100 + th + 14, w: lw, h: 48 },
      { family: 'Inter', weight: 400, max: p.tagMax, min: p.tagMin, maxLines: 1, lh: 1.3, fill: 'mist', bg: 'ink' });
  }

  const rx = p.panel + 60;
  const rw = w - p.panel - 120;
  [['info-date', b.date], ['info-time', b.time], ['info-where', b.location]].forEach(([id, val], i) => {
    c.text(id, 'info', val || '', { x: rx, y: 60 + i * 80, w: rw, h: p.infoValue * 1.3 },
      { family: 'Poppins', weight: i === 0 ? 700 : 500, max: p.infoValue, min: p.infoValueMin, maxLines: 1, fill: 'ink', bg: accent });
  });
  c.text('cta', 'cta', cta(b), { x: rx, y: h - 40 - p.ctaSize * 1.3 - 20, w: rw, h: p.ctaSize * 1.3 },
    { family: 'Poppins', weight: 700, max: p.ctaSize, min: 22, maxLines: 1, fill: 'ink', bg: accent });
}

const LAYOUTS = { stack, split, strip };

/** Build one asset. Returns { svg, physicalSvg, elements, usedColors, fmt }. */
export function build(brief, formatKey, brand) {
  const fmt = FORMATS[formatKey];
  if (!fmt) throw new Error(`Unknown format "${formatKey}"`);
  const c = new Canvas(fmt, brand, brief);
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
