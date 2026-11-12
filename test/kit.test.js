import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { contrast } from '../src/color.js';
import { measure, fit } from '../src/text.js';
import { build } from '../src/templates.js';
import { FORMAT_KEYS } from '../src/formats.js';
import { lint } from '../src/lint.js';

const brand = JSON.parse(readFileSync(new URL('../brand/brand.json', import.meta.url)));
const brief = (n) => JSON.parse(readFileSync(new URL(`../examples/${n}.json`, import.meta.url)));
const errors = (issues) => issues.filter((i) => i.severity === 'error');

test('WCAG contrast: black on white is 21:1', () => {
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
});

test('measure scales linearly with size', () => {
  const f = { family: 'Poppins', weight: 700 };
  const a = measure('Welcome Week', { ...f, size: 40 });
  assert.ok(Math.abs(measure('Welcome Week', { ...f, size: 80 }) - 2 * a) < 0.001);
});

test('fit shrinks long text and flags impossible text', () => {
  const font = { family: 'Poppins', weight: 700 };
  const opts = { max: 120, min: 50, maxLines: 3 };
  const short = fit('Hello', font, { w: 800, h: 400 }, opts);
  const long = fit('A moderately long event title that needs shrinking', font, { w: 800, h: 400 }, opts);
  assert.equal(short.size, 120);
  assert.ok(long.size < short.size && !long.overflow);
  assert.ok(fit('x '.repeat(200), font, { w: 800, h: 400 }, opts).overflow);
});

test('every fitted line stays inside its box', () => {
  for (const key of FORMAT_KEYS) {
    const a = build(brief('kickoff'), key, brand);
    for (const el of a.elements) {
      for (const line of el.lines) {
        const w = measure(line, { family: el.family, weight: el.weight, size: el.size, tracking: el.tracking });
        assert.ok(w <= el.box.w + 0.5, `${key}/${el.id}: ${w} > ${el.box.w}`);
      }
    }
  }
});

test('clean briefs produce zero lint errors in all five formats', () => {
  for (const n of ['kickoff', 'food-drive']) {
    for (const key of FORMAT_KEYS) {
      const b = brief(n);
      assert.deepEqual(errors(lint(build(b, key, brand), b, brand)), [], `${n}/${key}`);
    }
  }
});

test('linter catches off-palette colour, wrong font, low contrast and overflow', () => {
  const b = brief('bad-brief');
  const rules = new Set(errors(lint(build(b, 'ig-post', brand), b, brand)).map((i) => i.rule));
  for (const r of ['palette', 'font', 'contrast']) assert.ok(rules.has(r), `missing ${r}`);
  const overflowing = { ...brief('kickoff'), title: 'word '.repeat(60) };
  assert.ok(errors(lint(build(overflowing, 'ig-post', brand), overflowing, brand)).some((i) => i.rule === 'overflow'));
});

test('linter flags over-long copy as a warning', () => {
  const b = { ...brief('kickoff'), tagline: 'x'.repeat(120) };
  assert.ok(lint(build(b, 'slide', brand), b, brand).some((i) => i.rule === 'copy-length'));
});

test('rendering is deterministic', () => {
  const b = brief('open-mic');
  assert.equal(build(b, 'poster', brand).svg, build(b, 'poster', brand).svg);
});

test('every example brief has a title, date and location', () => {
  for (const f of readdirSync(new URL('../examples/', import.meta.url))) {
    const b = JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url)));
    for (const k of ['title', 'date', 'location']) assert.ok(b[k], `${f} missing ${k}`);
  }
});

test('design: weekday split, artwork and icon picking, hyphen wrapping', async () => {
  const { splitDate } = await import('../src/templates.js');
  const { pickArt, pickIcon } = await import('../src/art.js');
  const { wrap } = await import('../src/text.js');
  assert.deepEqual(splitDate('Mon, Sep 8'), { day: 'MON', rest: 'SEP 8' });
  assert.equal(splitDate('Dec 1–12'), null);
  assert.equal(pickArt(brief('kickoff')), 'party');
  assert.equal(pickArt(brief('food-drive')), 'box');
  assert.equal(pickArt({ category: 'Misc', title: 'Town hall' }), 'megaphone');
  assert.equal(pickArt({ ...brief('kickoff'), art: 'books' }), 'books');
  assert.equal(pickIcon('Therapy dogs'), 'paw');
  const lines = wrap('NON-PERISHABLES', { family: 'Poppins', weight: 700, size: 30 }, 160);
  assert.deepEqual(lines, ['NON-', 'PERISHABLES']);
});

test('every example brief is lint-clean in both themes, with and without highlights', () => {
  for (const n of ['kickoff', 'food-drive', 'open-mic', 'wellness']) {
    for (const theme of ['light', 'dark']) {
      for (const highlights of [brief(n).highlights, []]) {
        const b = { ...brief(n), theme, highlights };
        for (const key of FORMAT_KEYS) {
          assert.deepEqual(errors(lint(build(b, key, brand), b, brand)), [], `${n}/${theme}/${highlights.length}/${key}`);
        }
      }
    }
  }
});
