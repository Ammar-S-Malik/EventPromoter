import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createWorker } from '../worker/index.js';
import { fakeD1 } from './helpers/d1.js';
import { toPng } from '../src/render.js';
import { pngToPdf } from '../src/pdf.js';
import { parseBrief, formValues, preflight, summariseIssues, FILES } from '../src/generate.js';
import brand from '../worker/brand.js';

const SCHEMA = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

// Stand-ins: sharp draws the PNGs here (the Worker uses resvg-wasm), R2 is a Map.
const render = { png: (svg, { scale = 1 } = {}) => toPng(svg, { scale }), pdf: pngToPdf };
function fakeR2() {
  const m = new Map();
  const bytes = (v) => (typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v));
  return {
    m,
    get: async (k) => (m.has(k) ? { arrayBuffer: async () => m.get(k).slice().buffer, text: async () => new TextDecoder().decode(m.get(k)) } : null),
    put: async (k, v) => { m.set(k, bytes(v)); },
    delete: async (keys) => { for (const k of [].concat(keys)) m.delete(k); },
  };
}

const GOOD = {
  title: 'Winter Food Drive', category: 'Community', tagline: 'Bring a non-perishable item, win a free coffee.',
  date: 'Mon, Dec 1', time: '9 AM–5 PM', location: 'Drop-off at any campus entrance', cta: 'Learn more',
  destination: 'https://example.org/give', accent: 'teal', theme: 'dark', art: '', qrCaption: 'Scan to donate',
  highlight1: 'Non-perishables', highlight2: 'Free coffee', highlight3: 'Volunteer shifts',
};

async function setup({ r2 = fakeR2() } = {}) {
  const DB = fakeD1();
  await DB.exec(SCHEMA);
  const env = { DB, ASSETS: r2, ADMIN_TOKEN: 's3cret', TZ: 'America/Toronto' };
  const worker = createWorker({ render });
  const ctx = { waitUntil() {} };
  const call = (path, init = {}) => worker.fetch(new Request(`https://go.test${path}`, { redirect: 'manual', ...init, headers: { authorization: 'Bearer s3cret', ...init.headers } }), env, ctx);
  const post = (path, fields) => call(path, { method: 'POST', body: new URLSearchParams(fields) });
  return { env, r2, call, post };
}

test('parseBrief: reads a form, trims, validates required fields, URL, enums and highlights', () => {
  const ok = parseBrief({ ...GOOD, title: '  Winter   Food  Drive ' });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.brief.title, 'Winter Food Drive');
  assert.deepEqual(ok.brief.highlights, ['Non-perishables', 'Free coffee', 'Volunteer shifts']);
  assert.equal(ok.brief.art, undefined);
  const bad = parseBrief({ ...GOOD, title: '', destination: 'javascript:alert(1)', accent: 'pink', theme: 'neon', art: 'dragon', highlight1: 'x'.repeat(41) });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['accent', 'art', 'destination', 'highlights', 'theme', 'title']);
  assert.deepEqual(parseBrief(new URLSearchParams(GOOD)).errors, {});
  assert.equal(formValues(ok.brief).highlight2, 'Free coffee');
});

test('preflight: clean brief has no errors; an impossible title is caught before anything is saved', () => {
  assert.equal(summariseIssues(preflight(parseBrief(GOOD).brief, brand)).errors.length, 0);
  const huge = parseBrief({ ...GOOD, title: 'word '.repeat(24).trim() }).brief;
  assert.ok(summariseIssues(preflight(huge, brand)).errors.some((e) => e.rule === 'overflow'));
});

test('create event: saves brief + 5 links, then assets render on first request and are cached in R2', async () => {
  const { env, r2, call, post } = await setup();
  const res = await post('/dashboard/new', GOOD);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/dashboard/winter-food-drive/assets');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM links').first()).n, 5);
  assert.equal((await env.DB.prepare('SELECT name, event_date FROM campaigns').first()).event_date, 'Mon, Dec 1 · 9 AM–5 PM');
  assert.deepEqual([...r2.m.keys()], ['events/winter-food-drive/brief.json']); // nothing rendered yet

  const page = await (await call('/dashboard/winter-food-drive/assets')).text();
  for (const f of FILES) assert.ok(page.includes(`/files/winter-food-drive/${f.name}?${f.type === 'application/pdf' ? 'download=1&amp;' : ''}v=`), f.name);
  assert.match(page, /All brand checks passed/);

  const post1 = await call('/files/winter-food-drive/ig-post.png');
  assert.equal(post1.status, 200);
  assert.equal(post1.headers.get('content-type'), 'image/png');
  const meta = await sharp(Buffer.from(await post1.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [1080, 1080]);
  assert.ok(r2.m.has('events/winter-food-drive/ig-post.png'));

  const poster = await sharp(Buffer.from(await (await call('/files/winter-food-drive/poster.png')).arrayBuffer())).metadata();
  assert.deepEqual([poster.width, poster.height], [2200, 3400]);

  const pdfRes = await call('/files/winter-food-drive/poster-print.pdf?download=1');
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
  assert.match(pdfRes.headers.get('content-disposition'), /^attachment; filename="winter-food-drive-poster-print\.pdf"$/);
  const doc = await PDFDocument.load(await pdfRes.arrayBuffer());
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPage(0).getSize(), { width: 792, height: 1224 }); // 11 x 17 in
});

test('the QR code in the rendered poster uses the event short link on this origin', async () => {
  const { env, call, post } = await setup();
  await post('/dashboard/new', GOOD);
  const code = (await env.DB.prepare("SELECT code FROM links WHERE channel = 'poster'").first()).code;
  const page = await (await call('/dashboard/winter-food-drive/assets')).text();
  assert.ok(page.includes(`https://go.test/r/${code}`));
  const png = Buffer.from(await (await call('/files/winter-food-drive/poster.png')).arrayBuffer());
  assert.ok(png.length > 10000);
});

test('edit: link codes stay the same, cached files are dropped, new details show up', async () => {
  const { env, r2, call, post } = await setup();
  await post('/dashboard/new', GOOD);
  await call('/files/winter-food-drive/banner.png');
  assert.ok(r2.m.has('events/winter-food-drive/banner.png'));
  const before = (await env.DB.prepare('SELECT code FROM links ORDER BY code').all()).results.map((r) => r.code);

  const form = await (await call('/dashboard/winter-food-drive/edit')).text();
  assert.match(form, /value="Winter Food Drive"/);
  assert.match(form, /value="Non-perishables"/);

  const res = await post('/dashboard/winter-food-drive/edit', { ...GOOD, location: 'North entrance only', destination: 'https://example.org/new' });
  assert.equal(res.status, 303);
  assert.ok(!r2.m.has('events/winter-food-drive/banner.png'));
  const after = (await env.DB.prepare('SELECT code, dest_url FROM links ORDER BY code').all()).results;
  assert.deepEqual(after.map((r) => r.code), before);
  assert.ok(after.every((r) => r.dest_url === 'https://example.org/new'));
  assert.match(await (await call('/dashboard/winter-food-drive/assets')).text(), /North entrance only/);
});

test('create: validation errors re-show the form with the values kept; duplicates and bad input are refused', async () => {
  const { env, call, post } = await setup();
  const bad = await post('/dashboard/new', { ...GOOD, destination: 'not a link', cta: '' });
  assert.equal(bad.status, 422);
  const html = await bad.text();
  assert.match(html, /Enter a full link starting with https/);
  assert.match(html, /Button text is required/);
  assert.match(html, /value="Winter Food Drive"/);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM campaigns').first()).n, 0);

  const tooLong = await post('/dashboard/new', { ...GOOD, title: 'word '.repeat(24).trim() });
  assert.equal(tooLong.status, 422);
  assert.match(await tooLong.text(), /Fix these before the assets can be made/);

  assert.equal((await post('/dashboard/new', GOOD)).status, 303);
  const dup = await post('/dashboard/new', GOOD);
  assert.equal(dup.status, 422);
  assert.match(await dup.text(), /already exists/);
  const reserved = await post('/dashboard/new', { ...GOOD, title: 'New' }); // would collide with /dashboard/new
  assert.equal(reserved.status, 422);
  assert.match(await reserved.text(), /Choose a different title/);
});

test('files: admin only, whitelisted names only, brief.json is never served', async () => {
  const { env, r2, post } = await setup();
  await post('/dashboard/new', GOOD);
  const anon = (path) => createWorker({ render }).fetch(new Request(`https://go.test${path}`, { redirect: 'manual' }), env, { waitUntil() {} });
  assert.equal((await anon('/files/winter-food-drive/ig-post.png')).status, 303);
  const w = createWorker({ render });
  const authed = (path) => w.fetch(new Request(`https://go.test${path}`, { headers: { authorization: 'Bearer s3cret' } }), env, { waitUntil() {} });
  assert.equal((await authed('/files/winter-food-drive/brief.json')).status, 404);
  assert.equal((await authed('/files/winter-food-drive/..%2F..%2Fsecrets.png')).status, 404);
  assert.equal((await authed('/files/nope/ig-post.png')).status, 404);
  assert.ok(r2.m.has('events/winter-food-drive/brief.json'));
});

test('without an R2 bucket the form explains what to set up', async () => {
  const DB = fakeD1(); await DB.exec(SCHEMA);
  const res = await createWorker({ render }).fetch(new Request('https://go.test/dashboard/new', { headers: { authorization: 'Bearer s3cret' } }), { DB, ADMIN_TOKEN: 's3cret' }, { waitUntil() {} });
  assert.equal(res.status, 503);
  assert.match(await res.text(), /R2 bucket/);
});

test('admin pages keep the strict CSP and escape what users typed', async () => {
  const { call, post } = await setup();
  const res = await post('/dashboard/new', { ...GOOD, title: '<img src=x onerror=alert(1)>' });
  const html = await res.text();
  assert.ok(!html.includes('<img src=x'));
  const form = await call('/dashboard/new');
  const csp = form.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /img-src 'self'/);
  assert.ok(!(await form.text()).includes(' style="'));
});
