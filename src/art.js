// Vector artwork for the templates: category illustrations, icons, hexagons, highlighter swatches.
// Everything is drawn in brand colours only (passed in as resolved hex values), with ink outlines,
// in the flat "sticker" style of hand-made student-union graphics. Deterministic: no randomness
// except through the seeded PRNG handed in by the caller.

const f1 = (n) => +n.toFixed(1);

// ---------------------------------------------------------------- picking artwork

const ART_RULES = [
  ['party', /welcome|party|social|kickoff|kick-off|festival|celebrat|mixer|frosh|orientation|gala/i],
  ['mic', /art|music|culture|mic|comedy|poetry|concert|talent|karaoke|perform|band|show/i],
  ['heart', /health|wellness|mental|care|yoga|mindful|support|counsel/i],
  ['box', /food|drive|donat|community|charity|give|volunteer|fundrais|pantry/i],
  ['books', /academ|workshop|study|career|lecture|exam|resume|learn|tutor|seminar|class/i],
];
export const ART_KINDS = ['megaphone', 'party', 'mic', 'heart', 'box', 'books'];

/** brief.art wins; otherwise match on category, then title; megaphone is the all-purpose default. */
export function pickArt(brief) {
  if (brief.art && ART_KINDS.includes(brief.art)) return brief.art;
  for (const field of [brief.category, brief.title]) {
    for (const [kind, re] of ART_RULES) if (re.test(field || '')) return kind;
  }
  return 'megaphone';
}

const ICON_RULES = [
  ['food', /food|pizza|snack|lunch|dinner|bbq|eat|meal|breakfast|cookie|non-perishable/i],
  ['coffee', /coffee|tea|latte|hot chocolate/i],
  ['music', /music|dj|band|concert|song|playlist/i],
  ['mic', /mic|comedy|poetry|perform|act|stage|sign.?up/i],
  ['paw', /dog|pet|paw|puppy|cat/i],
  ['gift', /prize|win|gift|giveaway|swag|raffle/i],
  ['ticket', /free entry|admission|ticket|entry/i],
  ['book', /workshop|learn|talk|study|book|session|class/i],
  ['heart', /heart|care|support|counsel|wellness|quiet|calm/i],
  ['people', /club|people|meet|friend|network|community|team/i],
];
export function pickIcon(text) {
  for (const [kind, re] of ICON_RULES) if (re.test(text || '')) return kind;
  return 'star';
}

// ---------------------------------------------------------------- shapes

/** Flat-top hexagon path centred on (cx, cy) with circumradius r. */
export function hexPath(cx, cy, r, rot = 0) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + rot;
    d += `${i ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

/**
 * Honeycomb cluster: `cells` are [col, row] offsets on a flat-top grid, each with a colour.
 * Returns an SVG string.
 */
export function hexCluster(ox, oy, r, cells, gap = 0.1) {
  const w = r * 1.5, h = Math.sqrt(3) * r;
  return cells
    .map(([c, row, fill, op = 1]) => {
      const cx = ox + c * w;
      const cy = oy + row * h + (c % 2 ? h / 2 : 0);
      return `<path d="${hexPath(cx, cy, r * (1 - gap))}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''}/>`;
    })
    .join('');
}

/** Hand-painted highlighter swatch behind a line of text: ragged ends, slight lean. */
export function swatch(x, y, w, h, fill, rnd) {
  const j = () => (rnd() - 0.5) * h * 0.18;
  const lean = h * 0.06;
  const d =
    `M${f1(x + j())} ${f1(y + lean + j())}` +
    `L${f1(x + w * 0.5)} ${f1(y + j() * 0.4)}` +
    `L${f1(x + w + j())} ${f1(y - lean + j())}` +
    `L${f1(x + w - h * 0.08 + j())} ${f1(y + h * 0.5)}` +
    `L${f1(x + w + j())} ${f1(y + h - lean + j())}` +
    `L${f1(x + w * 0.5)} ${f1(y + h + j() * 0.4)}` +
    `L${f1(x + j())} ${f1(y + h + lean + j())}` +
    `L${f1(x + h * 0.08 + j())} ${f1(y + h * 0.5)}Z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

/** Brush-stroke underline (the swoosh under "THE OSAP CHANGES!"). */
export function swoosh(x, y, w, stroke, sw) {
  return `<path d="M${f1(x)} ${f1(y + sw * 0.6)}Q${f1(x + w * 0.45)} ${f1(y - sw * 0.9)} ${f1(x + w)} ${f1(y)}" fill="none" stroke="${stroke}" stroke-width="${f1(sw)}" stroke-linecap="round"/>`;
}

/** Four-point sparkle. */
export function sparkle(cx, cy, r, fill) {
  const k = r * 0.28;
  return `<path d="M${f1(cx)} ${f1(cy - r)}Q${f1(cx + k)} ${f1(cy - k)} ${f1(cx + r)} ${f1(cy)}Q${f1(cx + k)} ${f1(cy + k)} ${f1(cx)} ${f1(cy + r)}Q${f1(cx - k)} ${f1(cy + k)} ${f1(cx - r)} ${f1(cy)}Q${f1(cx - k)} ${f1(cy - k)} ${f1(cx)} ${f1(cy - r)}Z" fill="${fill}"/>`;
}

// ---------------------------------------------------------------- illustrations (400 x 400 local space)

const O = (ink, sw = 8) => `stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;

const ILLUSTRATIONS = {
  megaphone({ a, b, c, ink, paper }) {
    const o = O(ink);
    return `<g transform="rotate(-16 200 200)">
<path d="M58 104L22 74M46 200H4M58 296L22 326" ${O(ink, 11)} fill="none"/>
<rect x="282" y="226" width="40" height="112" rx="16" fill="${c}" ${o} transform="rotate(14 302 232)"/>
<path d="M98 72L272 158V242L98 328Z" fill="${a}" ${o}/>
<path d="M98 72L140 92V308L98 328Z" fill="${b}" ${o}/>
<path d="M170 112L246 150" stroke="${paper}" stroke-width="9" stroke-linecap="round" opacity=".7"/>
<rect x="266" y="166" width="62" height="68" rx="10" fill="${b}" ${o}/>
<rect x="322" y="154" width="26" height="92" rx="9" fill="${a}" ${o}/>
<ellipse cx="98" cy="200" rx="36" ry="128" fill="${b}" ${o}/>
<ellipse cx="98" cy="200" rx="22" ry="102" fill="${ink}"/>
<ellipse cx="104" cy="200" rx="9" ry="38" fill="${c}"/>
</g>`;
  },

  party({ a, b, c, ink, paper }) {
    const o = O(ink);
    const balloon = (cx, cy, fill, tilt) =>
      `<g transform="rotate(${tilt} ${cx} ${cy})">` +
      `<path d="M${cx} ${cy + 78}Q${cx - 18} ${cy + 140} ${cx + 6} ${cy + 190}T${cx + 4} ${cy + 280}" fill="none" ${O(ink, 5)}/>` +
      `<path d="M${cx - 10} ${cy + 88}L${cx} ${cy + 74}L${cx + 10} ${cy + 88}Z" fill="${fill}" ${O(ink, 6)}/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="62" ry="76" fill="${fill}" ${o}/>` +
      `<path d="M${cx - 34} ${cy - 30}Q${cx - 30} ${cy - 56} ${cx - 8} ${cy - 62}" fill="none" stroke="${paper}" stroke-width="10" stroke-linecap="round" opacity=".75"/>` +
      `</g>`;
    const confetti = [
      [40, 60, a, 20], [350, 40, b, -30], [370, 230, c, 40], [30, 250, b, -15], [330, 330, a, 60], [80, 360, c, 10], [250, 20, c, 35],
    ].map(([x, y, f, r]) => `<rect x="${x}" y="${y}" width="22" height="12" rx="3" fill="${f}" ${O(ink, 4)} transform="rotate(${r} ${x + 11} ${y + 6})"/>`).join('');
    return `${confetti}
<path d="M20 150q20-22 40 0t40 0" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>
<path d="M300 380q18-20 36 0t36 0" fill="none" stroke="${b}" stroke-width="9" stroke-linecap="round"/>
${balloon(285, 135, c, 12)}${balloon(130, 120, b, -10)}${balloon(210, 92, a, 2)}
<rect x="40" y="290" width="96" height="82" rx="6" fill="${a}" ${o}/>
<rect x="32" y="270" width="112" height="30" rx="6" fill="${b}" ${o}/>
<path d="M88 270V372" ${O(ink, 8)}/>
<path d="M88 270C70 240 46 248 58 268C64 276 80 272 88 270C96 240 120 248 118 268C112 276 96 272 88 270Z" fill="${c}" ${O(ink, 6)}/>
${sparkle(370, 120, 18, paper)}${sparkle(20, 200, 13, a)}`;
  },

  mic({ a, b, c, ink, paper }) {
    const o = O(ink);
    const note = (x, y, fill, s = 1) =>
      `<g transform="translate(${x} ${y}) scale(${s})"><path d="M18 -62V0" ${O(ink, 7)}/><path d="M18 -62Q40 -54 46 -30Q34 -44 18 -42" fill="${fill}" ${O(ink, 5)}/><ellipse cx="4" cy="2" rx="17" ry="13" fill="${fill}" ${O(ink, 6)} transform="rotate(-20 4 2)"/></g>`;
    const grille = [96, 116, 136, 156].map((y) => `<path d="M${y < 100 ? 172 : 160} ${y}H${y < 100 ? 228 : 240}" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`).join('');
    return `${note(48, 150, c)}${note(334, 108, a, 0.9)}${note(318, 300, b, 1.1)}
${sparkle(70, 300, 18, a)}${sparkle(352, 210, 14, paper)}${sparkle(110, 50, 12, b)}
<ellipse cx="200" cy="384" rx="78" ry="13" fill="${ink}"/>
<path d="M200 300V380" ${O(ink, 12)}/>
<path d="M136 196Q136 300 200 300Q264 300 264 196" fill="none" ${O(ink, 12)}/>
<rect x="148" y="60" width="104" height="214" rx="52" fill="${b}" ${o}/>
<path d="M148 176V112A52 52 0 0 1 252 112V176Z" fill="${paper}" ${o}/>
${grille}
<rect x="144" y="170" width="112" height="26" rx="8" fill="${a}" ${o}/>
<path d="M232 210V250" stroke="${paper}" stroke-width="9" stroke-linecap="round" opacity=".6"/>`;
  },

  heart({ a, b, c, ink, paper }) {
    const o = O(ink);
    const leaf = (x, y, r, fill) => `<path d="M${x} ${y}q36-44 82-30q-18 44-82 30Z" fill="${fill}" ${O(ink, 6)} transform="rotate(${r} ${x} ${y})"/>`;
    const plus = (x, y, s, fill) => `<path d="M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}" stroke="${fill}" stroke-width="${s * 0.55}" stroke-linecap="round"/>`;
    return `${plus(60, 90, 20, a)}${plus(350, 300, 16, b)}${plus(340, 70, 12, paper)}
${sparkle(46, 270, 16, b)}${sparkle(368, 180, 12, a)}
<path d="M200 150Q196 112 210 72" fill="none" ${O(ink, 7)}/>
${leaf(206, 108, -170, b)}${leaf(208, 90, -40, b)}
<path d="M200 352C84 276 40 206 70 142C98 84 172 86 200 142C228 86 302 84 330 142C360 206 316 276 200 352Z" fill="${c}" ${o}/>
<path d="M98 150Q108 120 140 116" fill="none" stroke="${paper}" stroke-width="11" stroke-linecap="round" opacity=".75"/>
<path d="M96 220H150L170 180L198 266L222 196L238 220H304" fill="none" stroke="${paper}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;
  },

  box({ a, b, c, ink, paper }) {
    const o = O(ink);
    return `${sparkle(56, 70, 16, b)}${sparkle(352, 60, 13, c)}${sparkle(370, 250, 11, paper)}
<rect x="196" y="74" width="74" height="122" rx="10" fill="${b}" ${o}/>
<rect x="196" y="108" width="74" height="44" fill="${paper}" ${O(ink, 6)}/>
<path d="M214 130H252" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
<ellipse cx="300" cy="150" rx="58" ry="34" fill="${b}" ${o} transform="rotate(-24 300 150)"/>
<path d="M276 142l10-14M298 136l10-14M318 132l8-12" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".5"/>
<circle cx="140" cy="150" r="44" fill="${c}" ${o}/>
<path d="M140 108Q138 90 148 80" fill="none" ${O(ink, 6)}/>
<path d="M146 98q20-24 42-10q-18 22-42 10Z" fill="${a}" ${O(ink, 5)}/>
<path d="M118 132Q122 120 134 118" fill="none" stroke="${paper}" stroke-width="8" stroke-linecap="round" opacity=".7"/>
<path d="M76 192L46 150L170 150L190 192Z" fill="${a}" ${o}/>
<path d="M324 192L354 150L230 150L210 192Z" fill="${a}" ${o}/>
<path d="M76 192H324L310 368H90Z" fill="${a}" ${o}/>
<path d="M76 192H324L320 232H80Z" fill="${ink}" opacity=".18"/>
<path d="M200 330C160 304 146 282 156 262C166 244 190 246 200 264C210 246 234 244 244 262C254 282 240 304 200 330Z" fill="${paper}" ${O(ink, 6)}/>`;
  },

  books({ a, b, c, ink, paper }) {
    const o = O(ink);
    const book = (x, y, w, fill, r = 0) =>
      `<g transform="rotate(${r} ${x + w / 2} ${y + 24})"><rect x="${x}" y="${y}" width="${w}" height="48" rx="8" fill="${fill}" ${o}/>` +
      `<rect x="${x + w - 30}" y="${y + 8}" width="22" height="32" rx="3" fill="${paper}" ${O(ink, 5)}/></g>`;
    return `${sparkle(60, 80, 16, a)}${sparkle(350, 70, 12, b)}${sparkle(40, 250, 11, paper)}
${book(70, 318, 250, b)}${book(90, 270, 220, c, -3)}${book(84, 222, 236, a, 2)}
<path d="M120 178V214Q200 246 280 214V178" fill="${ink}" ${o}/>
<path d="M200 92L346 150L200 208L54 150Z" fill="${ink}" ${O(ink, 8)}/>
<path d="M200 92L346 150L200 208L54 150Z" fill="${paper}" opacity=".12"/>
<path d="M200 150L318 172V236" fill="none" ${O(a, 7)}/>
<path d="M310 236h16l6 44h-28Z" fill="${a}" ${O(ink, 5)}/>
<circle cx="200" cy="150" r="10" fill="${a}"/>
<path d="M340 330l34-150l14 6l-34 150l-18 10Z" fill="${c}" ${O(ink, 6)}/>`;
  },
};

/** Place illustration `kind` inside box {x, y, w, h} (kept square, centred). */
export function illustration(kind, box, colors) {
  const s = Math.min(box.w, box.h) / 400;
  const x = box.x + (box.w - 400 * s) / 2;
  const y = box.y + (box.h - 400 * s) / 2;
  const fn = ILLUSTRATIONS[kind] || ILLUSTRATIONS.megaphone;
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s.toFixed(4)})">${fn(colors)}</g>`;
}

// ---------------------------------------------------------------- icons (48 x 48 local space, ink line art)

const ICONS = {
  calendar: (k) => `<rect x="8" y="11" width="32" height="29" rx="5" ${k}/><path d="M8 19H40" ${k}/><path d="M16 6V14M32 6V14" ${k}/><path d="M15 27h4M23 27h4M31 27h2M15 33h4M23 33h4" ${k}/>`,
  clock: (k) => `<circle cx="24" cy="24" r="16" ${k}/><path d="M24 14V24L31 29" ${k}/>`,
  pin: (k) => `<path d="M24 42C24 42 11 29 11 19A13 13 0 0 1 37 19C37 29 24 42 24 42Z" ${k}/><circle cx="24" cy="19" r="5" ${k}/>`,
  food: (k) => `<path d="M14 6V20Q14 25 18 25V42M18 25Q22 25 22 20V6M18 6V18" ${k}/><path d="M32 42V6Q38 10 38 22H32" ${k}/>`,
  coffee: (k) => `<path d="M9 18H33V30A10 10 0 0 1 23 40H19A10 10 0 0 1 9 30Z" ${k}/><path d="M33 22H36A5 5 0 0 1 36 32H33" ${k}/><path d="M16 6Q19 9 16 12M24 6Q27 9 24 12" ${k}/>`,
  music: (k) => `<path d="M18 36V10L38 6V32" ${k}/><circle cx="13" cy="36" r="5" ${k}/><circle cx="33" cy="32" r="5" ${k}/><path d="M18 17L38 13" ${k}/>`,
  mic: (k) => `<rect x="17" y="5" width="14" height="24" rx="7" ${k}/><path d="M11 22A13 13 0 0 0 37 22M24 35V43M17 43H31" ${k}/>`,
  paw: (k) => `<path d="M24 26C17 26 12 33 14 38C16 42 21 40 24 40C27 40 32 42 34 38C36 33 31 26 24 26Z" ${k}/><circle cx="12" cy="20" r="4" ${k}/><circle cx="19" cy="12" r="4" ${k}/><circle cx="29" cy="12" r="4" ${k}/><circle cx="36" cy="20" r="4" ${k}/>`,
  gift: (k) => `<rect x="8" y="18" width="32" height="22" rx="3" ${k}/><path d="M6 18H42M24 18V40" ${k}/><path d="M24 18C18 8 10 12 14 17M24 18C30 8 38 12 34 17" ${k}/>`,
  ticket: (k) => `<path d="M6 14H42V20A4 4 0 0 0 42 28V34H6V28A4 4 0 0 0 6 20Z" ${k}/><path d="M30 14V34" ${k} stroke-dasharray="3 4"/>`,
  book: (k) => `<path d="M24 12C18 8 11 8 6 10V38C11 36 18 36 24 40C30 36 37 36 42 38V10C37 8 30 8 24 12Z" ${k}/><path d="M24 12V40" ${k}/>`,
  heart: (k) => `<path d="M24 40C12 32 6 25 8 17C10 10 19 9 24 16C29 9 38 10 40 17C42 25 36 32 24 40Z" ${k}/>`,
  people: (k) => `<circle cx="17" cy="16" r="6" ${k}/><circle cx="33" cy="18" r="5" ${k}/><path d="M6 38C6 30 11 26 17 26S28 30 28 38M28 30C30 28 32 27 34 27C39 27 42 31 42 37" ${k}/>`,
  star: (k) => `<path d="M24 6L29 18L42 19L32 27L35 40L24 33L13 40L16 27L6 19L19 18Z" ${k}/>`,
};

/** Line icon centred at (cx, cy) with size s (px), stroked in `ink`. */
export function icon(kind, cx, cy, s, ink) {
  const k = `fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"`;
  const sc = s / 48;
  return `<g transform="translate(${f1(cx - s / 2)} ${f1(cy - s / 2)}) scale(${sc.toFixed(4)})">${(ICONS[kind] || ICONS.star)(k)}</g>`;
}

/** Brand mark: a hexagon ring around a small solid hex (used beside the organisation name). */
export function logoMark(x, y, s, ring, core) {
  const cx = x + s / 2, cy = y + s / 2;
  return `<path d="${hexPath(cx, cy, s / 2, Math.PI / 6)}" fill="${ring}"/>` +
    `<path d="${hexPath(cx, cy, s * 0.3, Math.PI / 6)}" fill="${core}"/>` +
    `<path d="${hexPath(cx, cy, s * 0.13, Math.PI / 6)}" fill="${ring}"/>`;
}
