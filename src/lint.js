// Brand linter: checks the exact geometry the renderer produced.
// Each issue: { rule, severity: 'error' | 'warn', element, message }

import { contrast, normHex } from './color.js';
import { knownFont } from './text.js';

export function lint(asset, brief, brand) {
  const issues = [];
  const add = (rule, severity, element, message) => issues.push({ rule, severity, element, message });
  const { fmt, elements } = asset;
  const palette = new Set(Object.values(brand.colors).map(normHex));
  const allowedFonts = brand.fonts.allowed;

  // --- copy length (brief-level, reported once per asset for clarity)
  const lim = brand.copy;
  if ((brief.title || '').length > lim.titleMax) add('copy-length', 'warn', 'title', `Title is ${brief.title.length} chars (brand max ${lim.titleMax}).`);
  if ((brief.tagline || '').length > lim.taglineMax) add('copy-length', 'warn', 'tagline', `Tagline is ${brief.tagline.length} chars (brand max ${lim.taglineMax}).`);
  if ((brief.cta || '').length > lim.ctaMax) add('copy-length', 'warn', 'cta', `CTA is ${brief.cta.length} chars (brand max ${lim.ctaMax}).`);
  if ((brief.location || '').length > lim.locationMax) add('copy-length', 'warn', 'where-value', `Location is ${brief.location.length} chars (brand max ${lim.locationMax}).`);

  // --- palette
  for (const hex of asset.usedColors) {
    if (!palette.has(normHex(hex))) add('palette', 'error', null, `Colour ${hex} is not in the brand palette.`);
  }

  for (const el of elements) {
    // --- fonts
    const fam = allowedFonts.find((f) => f.family.toLowerCase() === el.family.toLowerCase());
    if (!fam) add('font', 'error', el.id, `Typeface "${el.family}" is not a brand font.`);
    else if (!fam.weights.includes(Number(el.weight)) || !knownFont(el.family, el.weight))
      add('font', 'error', el.id, `${el.family} ${el.weight} is not an approved weight.`);

    // --- contrast (WCAG): large text = bold >= 40px or regular >= 48px on the canvas
    const large = el.weight >= 700 ? el.size >= 40 : el.size >= 48;
    const need = large ? brand.contrast.large : brand.contrast.normal;
    const ratio = contrast(el.fill, el.bg);
    if (ratio < need) add('contrast', 'error', el.id, `Contrast ${ratio.toFixed(2)}:1 is below ${need}:1 (${el.fill} on ${el.bg}).`);

    // --- overflow: text that did not fit its box even at the minimum size
    if (el.overflow) add('overflow', 'error', el.id, `Text does not fit its area at the minimum size (${el.size}px). Shorten the copy.`);

    // --- safe zone
    const s = fmt.safe;
    const b = el.box;
    if (b.x < s.left || b.y < s.top || b.x + b.w > fmt.w - s.right || b.y + b.h > fmt.h - s.bottom)
      add('safe-zone', 'error', el.id, `Text box leaves the safe area (${s.left}/${s.top}/${s.right}/${s.bottom}px insets).`);

    // --- minimum legible size
    if (el.size < fmt.minText) add('min-size', 'warn', el.id, `${el.size}px is below the ${fmt.minText}px minimum for ${fmt.label}.`);
  }
  return issues;
}

export const hasErrors = (issues) => issues.some((i) => i.severity === 'error');
