#!/usr/bin/env node
// usage: node src/cli.js <brief.json> [--out out] [--scale 1] [--no-fail]

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { build } from './templates.js';
import { FORMAT_KEYS } from './formats.js';
import { lint, hasErrors } from './lint.js';
import { toPng, toPdf } from './render.js';

const args = process.argv.slice(2);
const briefPath = args.find((a) => !a.startsWith('--') && !['out', 'scale'].includes(args[args.indexOf(a) - 1]?.replace('--', '')));
const opt = (name, d) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : d);
if (!briefPath) {
  console.error('usage: node src/cli.js <brief.json> [--out out] [--scale 1] [--no-fail]');
  process.exit(2);
}

const brand = JSON.parse(readFileSync(new URL('../brand/brand.json', import.meta.url), 'utf8'));
const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
const outDir = join(opt('out', 'out'), basename(briefPath, '.json'));
const scale = Number(opt('scale', 1));
mkdirSync(outDir, { recursive: true });

const report = {};
let failed = false;
for (const key of FORMAT_KEYS) {
  const asset = build(brief, key, brand);
  const issues = lint(asset, brief, brand);
  writeFileSync(join(outDir, `${key}.svg`), asset.svg);
  writeFileSync(join(outDir, `${key}.png`), await toPng(asset.svg, { scale }));
  if (key === 'poster') writeFileSync(join(outDir, 'poster-print.pdf'), toPdf(asset.physicalSvg));
  report[key] = issues;
  const errs = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errs;
  console.log(`${errs ? '✗' : '✓'} ${key.padEnd(9)} ${errs} error(s), ${warns} warning(s)`);
  for (const i of issues) console.log(`    [${i.severity}] ${i.rule}${i.element ? ` (${i.element})` : ''}: ${i.message}`);
  if (hasErrors(issues)) failed = true;
}
writeFileSync(join(outDir, 'lint.json'), JSON.stringify(report, null, 2));
console.log(`\nWrote ${outDir}/`);
if (failed && !args.includes('--no-fail')) process.exit(1);
