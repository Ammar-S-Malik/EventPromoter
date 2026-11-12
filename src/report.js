// Weekly report as Markdown, ready to paste into a deck, email or Teams message.

import { addDays } from './links.js';
import { LABEL_OF } from './links.js';

const label = (c) => LABEL_OF[c] || c;
const pct = (now, prev) => (prev === 0 ? (now === 0 ? 'no change' : 'new') : `${now >= prev ? '▲' : '▼'} ${Math.abs(Math.round(((now - prev) / prev) * 100))}%`);
const fmt = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** `cur` and `prev` are campaignStats() results for the current and previous window. */
export function weekReport(cur, prev, { from, to }) {
  const name = cur.campaign.name;
  const t = cur.totals;
  const top = cur.channels[0];
  const best = [...cur.days].sort((a, b) => b.clicks - a.clicks)[0];
  const lines = [
    `# ${name}: ${fmt(from)} to ${fmt(to)}`,
    '',
    `- **Total clicks:** ${t.clicks} (${pct(t.clicks, prev.totals.clicks)} vs previous period)`,
    `- **QR scans:** ${t.qr}, **link clicks:** ${t.link}`,
  ];
  if (top && top.clicks > 0) lines.push(`- **Top channel:** ${label(top.channel)}, ${top.clicks} clicks (${Math.round((top.clicks / t.clicks) * 100)}% of total)`);
  if (best && best.clicks > 0) lines.push(`- **Best day:** ${fmt(best.day)}, ${best.clicks} clicks`);
  lines.push('', '## By channel', '', '| Channel | Clicks | QR scans | Share |', '|---|---:|---:|---:|');
  for (const c of cur.channels) lines.push(`| ${label(c.channel)} | ${c.clicks} | ${c.qr} | ${t.clicks ? Math.round((c.clicks / t.clicks) * 100) : 0}% |`);
  const zero = cur.channels.filter((c) => c.clicks === 0).map((c) => label(c.channel));
  if (zero.length) lines.push('', `No clicks yet from: ${zero.join(', ')}.`);
  lines.push('', `_Automated crawlers and link-preview fetches are excluded (${t.bots} filtered)._`);
  return lines.join('\n') + '\n';
}

export const lastNDays = (today, n) => ({ from: addDays(today, -(n - 1)), to: today });
export const previousWindow = (today, n) => ({ from: addDays(today, -(2 * n - 1)), to: addDays(today, -n) });

export function dailyCsv(stats) {
  const rows = ['date,clicks,qr_scans,link_clicks'];
  for (const d of stats.days) rows.push(`${d.day},${d.clicks},${d.qr},${d.clicks - d.qr}`);
  return rows.join('\n') + '\n';
}
