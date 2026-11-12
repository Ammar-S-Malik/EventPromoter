#!/usr/bin/env node
// usage: node src/cli.js <brief.json> [--out out] [--scale 1] [--base-url https://go.example.org] [--no-fail]
//
// With --base-url (or "baseUrl" in the brief) every asset gets its own tracked short link
// (and a QR code on the poster and slide). Codes are saved in links/<campaign>.json and REUSED
// on later runs, so a poster that is already printed never points at a different link.
// Register them with:  wrangler d1 execute eventpromoter --file=out/<campaign>/links.sql

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { build } from './templates.js';
import { FORMAT_KEYS } from './formats.js';
import { lint, hasErrors } from './lint.js';
import { toPng, toPdf } from './render.js';
import { CHANNELS, makeCode, slugify, shortUrl, displayLink, linksSql, assertHttpUrl } from './links.js';

const args = process.argv.slice(2);
const VALUE_FLAGS = ['out', 'scale', 'base-url', 'links-dir'];
const opt = (name, d) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : d);
const briefPath = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes((args[i - 1] || '').replace('--', '')));
if (!briefPath) {
  console.error('usage: node src/cli.js <brief.json> [--out out] [--scale 1] [--base-url https://go.example.org] [--no-fail]');
  process.exit(2);
}

const brand = JSON.parse(readFileSync(new URL('../brand/brand.json', import.meta.url), 'utf8'));
const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
const campaignId = brief.id || slugify(brief.title);
const outDir = join(opt('out', 'out'), basename(briefPath, '.json'));
const scale = Number(opt('scale', 1));
const baseUrl = opt('base-url', brief.baseUrl);
mkdirSync(outDir, { recursive: true });

// ---- tracked links (stable across runs)
let links = null;
if (baseUrl) {
  const dest = brief.destination;
  if (!dest) { console.error('Tracking needs "destination" (the full https:// URL the links should lead to) in the brief.'); process.exit(2); }
  assertHttpUrl(baseUrl); assertHttpUrl(dest);
  const linksDir = opt('links-dir', 'links');
  mkdirSync(linksDir, { recursive: true });
  const file = join(linksDir, `${campaignId}.json`);
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { links: {} };
  links = {};
  for (const key of FORMAT_KEYS) {
    links[key] = { code: saved.links?.[key]?.code || makeCode(), channel: CHANNELS[key].channel, dest };
  }
  writeFileSync(file, JSON.stringify({ campaign: campaignId, baseUrl, links }, null, 2) + '\n');
  writeFileSync(join(outDir, 'links.sql'), linksSql({ id: campaignId, name: brief.title, eventDate: [brief.date, brief.time].filter(Boolean).join(' · ') }, Object.values(links)));
}

const report = {};
let failed = false;
for (const key of FORMAT_KEYS) {
  const track = links && {
    url: shortUrl(baseUrl, links[key].code, { qr: true }),
    display: displayLink(baseUrl, links[key].code),
  };
  const asset = build(brief, key, brand, { track });
  const issues = lint(asset, brief, brand);
  writeFileSync(join(outDir, `${key}.svg`), asset.svg);
  writeFileSync(join(outDir, `${key}.png`), await toPng(asset.svg, { scale }));
  if (key === 'poster') {
    try {
      writeFileSync(join(outDir, 'poster-print.pdf'), toPdf(asset.physicalSvg));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      console.warn('! poster-print.pdf skipped: rsvg-convert is not installed (macOS: brew install librsvg). Everything else is unaffected.');
    }
  }
  report[key] = issues;
  const errs = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errs;
  const qr = asset.elements.some((e) => e.kind === 'qr') ? '  + QR' : '';
  console.log(`${errs ? '✗' : '✓'} ${key.padEnd(9)} ${errs} error(s), ${warns} warning(s)${qr}`);
  for (const i of issues) console.log(`    [${i.severity}] ${i.rule}${i.element ? ` (${i.element})` : ''}: ${i.message}`);
  if (hasErrors(issues)) failed = true;
}
writeFileSync(join(outDir, 'lint.json'), JSON.stringify(report, null, 2));
console.log(`\nWrote ${outDir}/`);
if (links) {
  console.log(`\nTracked links for "${campaignId}" (codes saved in links/${campaignId}.json):`);
  for (const key of FORMAT_KEYS) console.log(`  ${CHANNELS[key].label.padEnd(16)} ${shortUrl(baseUrl, links[key].code)}`);
  console.log(`\nRegister them:  wrangler d1 execute eventpromoter --file=${join(outDir, 'links.sql')}`);
}
if (failed && !args.includes('--no-fail')) process.exit(1);
