import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import worker from '../worker/index.js';
import { fakeD1 } from './helpers/d1.js';
import { qrEncode, qrSvg } from '../src/qr.js';
import { build } from '../src/templates.js';
import { lint } from '../src/lint.js';
import { FORMATS, FORMAT_KEYS } from '../src/formats.js';
import { shortUrl, displayLink } from '../src/links.js';
import { toPng } from '../src/render.js';

const brand = JSON.parse(readFileSync(new URL('../brand/brand.json', import.meta.url)));
const brief = JSON.parse(readFileSync(new URL('../examples/kickoff.json', import.meta.url)));
const SCHEMA = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const CLI = new URL('../src/cli.js', import.meta.url).pathname;
const track = { url: shortUrl('https://go.test', 'Ab3xK9', { qr: true }), display: displayLink('https://go.test', 'Ab3xK9') };
const hasCv2 = spawnSync('python3', ['-I', '-c', 'import cv2']).status === 0;

test('qr: sizes match the spec, finder patterns are present, output is deterministic', () => {
  const a = qrEncode('https://go.test/r/Ab3xK9?q=1');
  assert.equal(a.size, a.version * 4 + 17);
  const m = a.modules;
  for (const [ox, oy] of [[0, 0], [a.size - 7, 0], [0, a.size - 7]]) {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      assert.equal(m[oy + i][ox + j], ring !== 2, `finder at ${ox},${oy} module ${i},${j}`);
    }
  }
  assert.equal(m[a.size - 8][8], true); // the always-dark module
  assert.deepEqual(qrEncode('same').modules, qrEncode('same').modules);
  assert.equal(qrEncode('x'.repeat(213)).version, 10);
  assert.throws(() => qrEncode('x'.repeat(214)), /too long/);
});

test('qr: svg plate includes the 4-module quiet zone and uses integer cells', () => {
  const q = qrSvg('https://go.test/r/Ab3xK9', { x: 10, y: 20, target: 300 });
  assert.equal(q.size, q.cell * (q.modules + 8));
  assert.ok(q.size <= 300 && q.size > 300 - (q.modules + 8));
  assert.match(q.svg, /^<rect x="10" y="20"/);
});

test('tracked assets: QR on poster and slide only, short link in every CTA', () => {
  for (const key of FORMAT_KEYS) {
    const a = build(brief, key, brand, { track });
    const hasQr = a.elements.some((e) => e.kind === 'qr');
    assert.equal(hasQr, key === 'poster' || key === 'slide', key);
    assert.ok(a.elements.find((e) => e.id === 'cta').text.includes('go.test/r/Ab3xK9'), `${key} CTA shows the short link`);
    assert.deepEqual(lint(a, brief, brand).filter((i) => i.severity === 'error'), [], key);
  }
  const plain = build(brief, 'poster', brand);
  assert.ok(!plain.elements.some((e) => e.kind === 'qr'));
  assert.ok(plain.elements.find((e) => e.id === 'cta').text.includes(brief.link));
});

test('lint: flags QR codes that are too small or outside the safe area', () => {
  const asset = { fmt: FORMATS.poster, usedColors: [], elements: [{ kind: 'qr', id: 'qr', cell: 3, box: { x: 20, y: 100, w: 80, h: 80 } }] };
  const issues = lint(asset, brief, brand);
  assert.ok(issues.some((i) => i.rule === 'safe-zone' && i.element === 'qr'));
  assert.ok(issues.some((i) => i.rule === 'qr-size' && i.severity === 'error'));
  assert.ok(issues.some((i) => i.rule === 'qr-size' && i.severity === 'warn'));
});

test('the QR in the finished poster PNG decodes to the tracked URL', { skip: !hasCv2 && 'python3 + cv2 not available' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrp-'));
  for (const key of ['poster', 'slide']) {
    await sharp(await toPng(build(brief, key, brand, { track }).svg)).toFile(join(dir, `${key}.png`));
  }
  const py = `import cv2,sys
for n in ('poster','slide'):
    img=cv2.imread(sys.argv[1]+'/'+n+'.png')
    t=cv2.QRCodeDetector().detectAndDecode(img)[0] or cv2.QRCodeDetectorAruco().detectAndDecode(img)[0]
    print(t)`;
  const out = execFileSync('python3', ['-I', '-c', py, dir], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(out, [track.url, track.url]);
});

test('end to end: CLI -> links.sql -> D1 -> redirect + click; codes stay stable on re-run', async () => {
  const out = mkdtempSync(join(tmpdir(), 'e2e-out-'));
  const linksDir = mkdtempSync(join(tmpdir(), 'e2e-links-'));
  const run = () => execFileSync('node', [CLI, new URL('../examples/kickoff.json', import.meta.url).pathname, '--out', out, '--links-dir', linksDir, '--base-url', 'https://go.test'], { encoding: 'utf8' });
  const first = run();
  const codesOf = (s) => [...s.matchAll(/go\.test\/r\/(\w+)/g)].map((m) => m[1]).join(',');
  assert.equal(codesOf(run()), codesOf(first)); // a printed poster must never change link

  const DB = fakeD1();
  await DB.exec(SCHEMA);
  await DB.exec(readFileSync(join(out, 'kickoff', 'links.sql'), 'utf8'));
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM links').first()).n, 5);
  const posterCode = (await DB.prepare("SELECT code FROM links WHERE channel = 'poster'").first()).code;

  const pending = [];
  const res = await worker.fetch(new Request(`https://go.test/r/${posterCode}?q=1`, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' } }),
    { DB, TZ: 'America/Toronto' }, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^https:\/\/nsu\.example\/kickoff\?utm_source=poster&utm_medium=print&utm_campaign=welcome-week-kickoff-party$/);
  const click = await DB.prepare('SELECT via, device FROM clicks').first();
  assert.deepEqual(click, { via: 'qr', device: 'mobile' });
});

test('cli: tracking without a destination is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodest-'));
  const b = { ...brief }; delete b.destination;
  const f = join(dir, 'b.json');
  execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(f)}, ${JSON.stringify(JSON.stringify(b))})`]);
  const r = spawnSync('node', [CLI, f, '--out', dir, '--links-dir', dir, '--base-url', 'https://go.test'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /destination/);
});
