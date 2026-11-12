// Pure helpers shared by the CLI (generates links) and the Worker (serves them).

export const CHANNELS = {
  'ig-post': { channel: 'instagram-post', medium: 'social', label: 'Instagram post' },
  'ig-story': { channel: 'instagram-story', medium: 'social', label: 'Instagram story' },
  poster: { channel: 'poster', medium: 'print', label: 'Poster' },
  slide: { channel: 'slide', medium: 'presentation', label: 'Slide' },
  banner: { channel: 'screen', medium: 'digital-signage', label: 'Screen banner' },
};
export const MEDIUM_OF = Object.fromEntries(Object.values(CHANNELS).map((c) => [c.channel, c.medium]));
export const LABEL_OF = Object.fromEntries(Object.values(CHANNELS).map((c) => [c.channel, c.label]));

// No look-alike characters (0/O, 1/l/I) because people type these off posters.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeCode(len = 6) {
  const limit = 256 - (256 % ALPHABET.length); // rejection sampling: no modulo bias
  let out = '';
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len * 2))) {
      if (b < limit && out.length < len) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'campaign';
}

export function assertHttpUrl(u) {
  const url = new URL(u);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`Only http(s) URLs are allowed: ${u}`);
  return url;
}

/** Add UTM parameters without overwriting any the destination already has. */
export function withUtm(dest, { campaign, channel, medium }) {
  const url = assertHttpUrl(dest);
  const set = (k, v) => { if (v && !url.searchParams.has(k)) url.searchParams.set(k, v); };
  set('utm_source', channel);
  set('utm_medium', medium);
  set('utm_campaign', campaign);
  return url.toString();
}

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|curl|wget|python-requests|go-http|headless|lighthouse|monitor/i;
export function classifyUA(ua = '') {
  if (!ua) return { bot: true, device: 'other' }; // real browsers always send a UA
  if (BOT_RE.test(ua)) return { bot: true, device: 'other' };
  return { bot: false, device: /mobi|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop' };
}

export function referrerHost(ref) {
  try { return ref ? new URL(ref).hostname.replace(/^www\./, '') : null; } catch { return null; }
}

/** YYYY-MM-DD for `date` in timezone `tz`. */
export function localDay(date, tz = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const shortUrl = (base, code, { qr = false } = {}) => `${base.replace(/\/+$/, '')}/r/${code}${qr ? '?q=1' : ''}`;
export const displayLink = (base, code) => `${new URL(base).host}/r/${code}`;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** INSERT statements to register a campaign + its links in D1 (wrangler d1 execute --file). */
export function linksSql(campaign, links, now = Date.now()) {
  const lines = [
    `INSERT OR REPLACE INTO campaigns (id, name, event_date, created_at) VALUES (${q(campaign.id)}, ${q(campaign.name)}, ${q(campaign.eventDate || '')}, ${now});`,
  ];
  for (const l of links) {
    lines.push(`INSERT OR REPLACE INTO links (code, campaign_id, channel, dest_url, created_at) VALUES (${q(l.code)}, ${q(campaign.id)}, ${q(l.channel)}, ${q(l.dest)}, ${now});`);
  }
  return lines.join('\n') + '\n';
}
