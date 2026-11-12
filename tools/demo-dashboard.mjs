// Seeds an in-memory database with plausible two-week traffic and renders the dashboard to a
// static HTML file, so the design can be reviewed without deploying anything.
// usage: node tools/demo-dashboard.mjs [out.html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fakeD1 } from '../test/helpers/d1.js';
import { linksSql, CHANNELS, addDays } from '../src/links.js';
import { campaignStats } from '../src/stats.js';
import { renderDashboard } from '../worker/dashboard.js';

const out = process.argv[2] || 'out/dashboard-demo.html';
const DB = fakeD1();
await DB.exec(readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8'));
const links = Object.values(CHANNELS).map((c, i) => ({ code: `demo${i}x`, channel: c.channel, dest: 'https://example.org/kickoff' }));
await DB.exec(linksSql({ id: 'welcome-week-kickoff', name: 'Welcome Week Kickoff Party', eventDate: 'Mon, Sep 8 · 12–4 PM' }, links));

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const end = '2026-09-08';
const weight = { 'instagram-post': 1.0, 'instagram-story': 0.7, poster: 0.55, slide: 0.12, screen: 0.2 };
const refs = ['instagram.com', 'instagram.com', 'l.instagram.com', null, null, null, 'teams.microsoft.com'];
const ins = DB.prepare('INSERT INTO clicks (code, ts, day, via, device, country, referrer_host, is_bot) VALUES (?,?,?,?,?,?,?,?)');
for (let i = 13; i >= 0; i--) {
  const day = addDays(end, -i);
  const ramp = 0.4 + (13 - i) / 13 * 1.6; // interest builds toward the event
  for (const l of links) {
    const n = Math.round(rnd() * 14 * (weight[l.channel] || 0.3) * ramp);
    for (let k = 0; k < n; k++) {
      const qr = ['poster', 'slide'].includes(l.channel) ? rnd() < 0.7 : false;
      const social = l.channel.startsWith('instagram');
      await ins.bind(l.code, Date.parse(day) + k, day, qr ? 'qr' : 'link', rnd() < (social ? 0.93 : 0.8) ? 'mobile' : 'desktop', rnd() < 0.96 ? 'CA' : 'US', social ? refs[Math.floor(rnd() * 3)] : refs[3 + Math.floor(rnd() * 4)], 0).run();
    }
  }
  if (i % 3 === 0) await ins.bind(links[0].code, Date.parse(day), day, 'link', 'other', null, null, 1).run();
}
const stats = await campaignStats(DB, 'welcome-week-kickoff', { today: end });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderDashboard(stats, { nonce: 'demo' }));
console.log(`wrote ${out}  (${stats.totals.clicks} clicks, ${stats.totals.qr} QR scans)`);
