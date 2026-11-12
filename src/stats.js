// Analytics queries. Written against the D1 prepare().bind().all()/first() interface.

import { addDays } from './links.js';

const rangeSql = (from, to) => ({
  sql: `${from ? ' AND c.day >= ?' : ''}${to ? ' AND c.day <= ?' : ''}`,
  args: [from, to].filter(Boolean),
});

export async function listCampaigns(db) {
  const { results } = await db.prepare(
    `SELECT ca.id, ca.name, ca.event_date,
            COUNT(c.id) AS clicks, COALESCE(SUM(c.via = 'qr'), 0) AS qr
       FROM campaigns ca
       LEFT JOIN links l ON l.campaign_id = ca.id
       LEFT JOIN clicks c ON c.code = l.code AND c.is_bot = 0
      GROUP BY ca.id ORDER BY ca.created_at DESC`
  ).all();
  return results;
}

/**
 * Stats for one campaign. Bots are always excluded from counts (and reported separately).
 * `today` (YYYY-MM-DD) extends the daily series so quiet days at the end show as zero.
 */
export async function campaignStats(db, id, { from = null, to = null, today = null } = {}) {
  const campaign = await db.prepare('SELECT id, name, event_date FROM campaigns WHERE id = ?').bind(id).first();
  if (!campaign) return null;
  const r = rangeSql(from, to);
  const base = [id, ...r.args];

  const channels = (await db.prepare(
    `SELECT l.channel, l.code, COUNT(c.id) AS clicks, COALESCE(SUM(c.via = 'qr'), 0) AS qr
       FROM links l LEFT JOIN clicks c ON c.code = l.code AND c.is_bot = 0${r.sql}
      WHERE l.campaign_id = ? GROUP BY l.code ORDER BY clicks DESC, l.channel`
  ).bind(...r.args, id).all()).results;

  const rawDays = (await db.prepare(
    `SELECT c.day, COUNT(*) AS clicks, SUM(c.via = 'qr') AS qr
       FROM clicks c JOIN links l ON l.code = c.code
      WHERE l.campaign_id = ? AND c.is_bot = 0${r.sql} GROUP BY c.day ORDER BY c.day`
  ).bind(...base).all()).results;

  const grouped = async (col, limit) => (await db.prepare(
    `SELECT COALESCE(c.${col}, 'unknown') AS k, COUNT(*) AS clicks
       FROM clicks c JOIN links l ON l.code = c.code
      WHERE l.campaign_id = ? AND c.is_bot = 0${r.sql}${col === 'referrer_host' ? " AND c.referrer_host IS NOT NULL" : ''}
      GROUP BY k ORDER BY clicks DESC, k LIMIT ${limit}`
  ).bind(...base).all()).results;

  const bots = await db.prepare(
    `SELECT COUNT(*) AS n FROM clicks c JOIN links l ON l.code = c.code WHERE l.campaign_id = ? AND c.is_bot = 1${r.sql}`
  ).bind(...base).first();

  // fill gaps with zeros so the chart's x-axis is continuous
  const map = new Map(rawDays.map((d) => [d.day, { day: d.day, clicks: d.clicks, qr: d.qr || 0 }]));
  const first = from || rawDays[0]?.day;
  let last = to || rawDays.at(-1)?.day;
  if (first && today && !to && today > last) last = today;
  const days = [];
  if (first && last) {
    for (let d = first, n = 0; d <= last && n < 120; d = addDays(d, 1), n++) days.push(map.get(d) || { day: d, clicks: 0, qr: 0 });
  }

  const total = channels.reduce((a, c) => a + c.clicks, 0);
  const qr = channels.reduce((a, c) => a + c.qr, 0);
  return {
    campaign,
    totals: { clicks: total, qr, link: total - qr, bots: bots?.n ?? 0 },
    channels,
    days,
    devices: await grouped('device', 5),
    referrers: await grouped('referrer_host', 5),
    countries: await grouped('country', 5),
  };
}
