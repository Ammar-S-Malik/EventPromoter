import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';
import { fakeD1 } from './helpers/d1.js';
import { linksSql, makeCode, withUtm, classifyUA, localDay, addDays, CHANNELS } from '../src/links.js';
import { campaignStats } from '../src/stats.js';

const SCHEMA = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

async function setup({ token = 's3cret', name = 'Welcome Week Kickoff', dest = 'https://example.org/kickoff?ref=poster' } = {}) {
  const DB = fakeD1();
  await DB.exec(SCHEMA);
  const links = Object.values(CHANNELS).map((c, i) => ({ code: `Code${i}x`, channel: c.channel, dest }));
  await DB.exec(linksSql({ id: 'kickoff', name, eventDate: 'Mon, Sep 8' }, links));
  const env = { DB, ADMIN_TOKEN: token, TZ: 'America/Toronto' };
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const call = async (path, init = {}, cf) => {
    const req = new Request(`https://go.test${path}`, init);
    if (cf) Object.defineProperty(req, 'cf', { value: cf });
    const res = await worker.fetch(req, env, ctx);
    await Promise.all(pending.splice(0));
    return res;
  };
  return { env, call, links };
}
const bearer = (t = 's3cret') => ({ headers: { authorization: `Bearer ${t}` } });

test('redirect: 302 to destination, UTM added, existing params preserved, click logged', async () => {
  const { call, env } = await setup();
  const res = await call('/r/Code2x', { redirect: 'manual', headers: { 'user-agent': DESKTOP, referer: 'https://www.instagram.com/p/abc?x=1' } }, { country: 'CA' });
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.searchParams.get('ref'), 'poster');
  assert.equal(loc.searchParams.get('utm_source'), 'poster');
  assert.equal(loc.searchParams.get('utm_medium'), 'print');
  assert.equal(loc.searchParams.get('utm_campaign'), 'kickoff');
  const row = await env.DB.prepare('SELECT * FROM clicks').first();
  assert.equal(row.code, 'Code2x');
  assert.equal(row.device, 'desktop');
  assert.equal(row.country, 'CA');
  assert.equal(row.referrer_host, 'instagram.com'); // host only, never the full URL
  assert.equal(row.is_bot, 0);
});

test('unknown code is 404 and nothing is logged', async () => {
  const { call, env } = await setup();
  assert.equal((await call('/r/Nope123')).status, 404);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM clicks').first()).n, 0);
});

test('HEAD requests redirect but are not counted', async () => {
  const { call, env } = await setup();
  assert.equal((await call('/r/Code0x', { method: 'HEAD', redirect: 'manual' })).status, 302);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM clicks').first()).n, 0);
});

test('stats: bots excluded from counts but reported, QR split out, zero-click channels listed', async () => {
  const { call, env } = await setup();
  await call('/r/Code0x', { headers: { 'user-agent': MOBILE } });
  await call('/r/Code2x?q=1', { headers: { 'user-agent': MOBILE } });
  await call('/r/Code2x?q=1', { headers: { 'user-agent': DESKTOP } });
  await call('/r/Code2x', { headers: { 'user-agent': 'facebookexternalhit/1.1' } }); // link preview
  await call('/r/Code2x', { headers: {} }); // no UA
  const s = await campaignStats(env.DB, 'kickoff', { today: localDay(new Date(), 'America/Toronto') });
  assert.equal(s.totals.clicks, 3);
  assert.equal(s.totals.qr, 2);
  assert.equal(s.totals.link, 1);
  assert.equal(s.totals.bots, 2);
  assert.equal(s.channels.length, 5); // includes channels with zero clicks
  assert.equal(s.channels[0].channel, 'poster');
  assert.equal(s.channels[0].qr, 2);
  assert.deepEqual(s.devices.map((d) => [d.k, d.clicks]), [['mobile', 2], ['desktop', 1]]);
  assert.equal(s.days.length, 1);
});

test('stats: daily series fills quiet days with zeros up to today', async () => {
  const { env } = await setup();
  await env.DB.prepare('INSERT INTO clicks (code, ts, day, via, device, is_bot) VALUES (?,?,?,?,?,0)').bind('Code0x', 1, '2026-11-01', 'link', 'mobile').run();
  await env.DB.prepare('INSERT INTO clicks (code, ts, day, via, device, is_bot) VALUES (?,?,?,?,?,0)').bind('Code0x', 1, '2026-11-04', 'qr', 'mobile').run();
  const s = await campaignStats(env.DB, 'kickoff', { today: '2026-11-06' });
  assert.deepEqual(s.days.map((d) => d.day), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  assert.deepEqual(s.days.map((d) => d.clicks), [1, 0, 0, 1, 0, 0]);
  const ranged = await campaignStats(env.DB, 'kickoff', { from: '2026-11-02', to: '2026-11-05' });
  assert.equal(ranged.totals.clicks, 1);
});

test('auth: admin routes fail closed and accept bearer token or login cookie', async () => {
  const { call, env } = await setup();
  assert.equal((await call('/api/campaigns/kickoff/stats')).status, 401);
  assert.equal((await call('/api/campaigns/kickoff/stats', bearer('wrong'))).status, 401);
  assert.equal((await call('/api/campaigns/kickoff/stats', bearer())).status, 200);
  const dash = await call('/dashboard/kickoff', { redirect: 'manual' });
  assert.equal(dash.status, 303);
  assert.equal(dash.headers.get('location'), '/login');

  const bad = await call('/login', { method: 'POST', body: new URLSearchParams({ token: 'nope' }) });
  assert.equal(bad.status, 401);
  const ok = await call('/login', { method: 'POST', body: new URLSearchParams({ token: 's3cret' }), redirect: 'manual' });
  assert.equal(ok.status, 303);
  const set = ok.headers.get('set-cookie');
  assert.match(set, /HttpOnly/); assert.match(set, /Secure/); assert.match(set, /SameSite=Strict/);
  assert.ok(!set.includes('s3cret')); // cookie holds a hash, never the token
  const session = set.split(';')[0];
  assert.equal((await call('/dashboard/kickoff', { headers: { cookie: session } })).status, 200);

  delete env.ADMIN_TOKEN; // misconfigured deploy: must deny, not allow
  assert.equal((await call('/api/campaigns/kickoff/stats', bearer(''))).status, 401);
  assert.equal((await call('/api/campaigns/kickoff/stats', { headers: { cookie: 'ep_session=' } })).status, 401);
});

test('dashboard renders, escapes campaign names, and sends a strict CSP', async () => {
  const { call } = await setup({ name: '<img src=x onerror=alert(1)> & Co' });
  await call('/r/Code0x', { headers: { 'user-agent': MOBILE } });
  const res = await call('/dashboard/kickoff', bearer());
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!body.includes('<img src=x'));
  assert.ok(body.includes('&lt;img src=x'));
  assert.match(body, /Instagram post/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(body, /View as table/);
});

test('report.md and daily.csv', async () => {
  const { call } = await setup();
  await call('/r/Code2x?q=1', { headers: { 'user-agent': MOBILE } });
  await call('/r/Code0x', { headers: { 'user-agent': DESKTOP } });
  const md = await (await call('/api/campaigns/kickoff/report.md', bearer())).text();
  assert.match(md, /Total clicks:\*\* 2/);
  assert.match(md, /QR scans:\*\* 1/);
  assert.match(md, /No clicks yet from: .*Instagram story/);
  const csv = await (await call('/api/campaigns/kickoff/daily.csv', bearer())).text();
  assert.match(csv, /^date,clicks,qr_scans,link_clicks\n\d{4}-\d{2}-\d{2},2,1,1\n$/);
  assert.equal((await call('/api/campaigns/missing/report.md', bearer())).status, 404);
});

test('linksSql escapes quotes safely', async () => {
  const DB = fakeD1();
  await DB.exec(SCHEMA);
  await DB.exec(linksSql({ id: 'x', name: "Bob's 'Open Mic'; DROP TABLE links;--", eventDate: '' }, [{ code: 'abc123', channel: 'poster', dest: "https://e.org/?q=it's" }]));
  assert.equal((await DB.prepare('SELECT name FROM campaigns').first()).name, "Bob's 'Open Mic'; DROP TABLE links;--");
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM links').first()).n, 1);
});

test('helpers: codes, UTM, bot detection, day maths', () => {
  const codes = new Set(Array.from({ length: 500 }, () => makeCode()));
  assert.equal(codes.size, 500);
  for (const c of codes) assert.match(c, /^[2-9a-hj-km-np-zA-HJ-NP-Z]{6}$/); // no 0/O/1/l/I
  assert.throws(() => withUtm('javascript:alert(1)', { campaign: 'a' }));
  assert.equal(new URL(withUtm('https://e.org/?utm_source=keep', { campaign: 'c', channel: 'poster', medium: 'print' })).searchParams.get('utm_source'), 'keep');
  assert.equal(classifyUA('Slackbot-LinkExpanding 1.0').bot, true);
  assert.equal(classifyUA(DESKTOP).bot, false);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(localDay(new Date('2026-11-12T03:30:00Z'), 'America/Toronto'), '2026-11-11'); // still the 11th in Toronto
});
