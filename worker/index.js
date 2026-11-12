// Cloudflare Worker: short-link redirects with click logging (D1), plus a protected analytics dashboard.
//
//   GET  /r/:code            log the click, 302 to the destination with UTM parameters
//   GET  /dashboard[/:id]    analytics (requires login)
//   GET  /api/campaigns/:id/{stats,daily.csv,report.md}   (requires login or Bearer token)
//   POST /login              exchange ADMIN_TOKEN for a session cookie
//
// Fails closed: without ADMIN_TOKEN configured, every admin route returns 401.
// Set DEV=1 only for local development to skip auth.

import { classifyUA, referrerHost, localDay, withUtm, MEDIUM_OF } from '../src/links.js';
import { campaignStats, listCampaigns } from '../src/stats.js';
import { weekReport, lastNDays, previousWindow, dailyCsv } from '../src/report.js';
import { renderDashboard, renderIndex, renderLogin } from './dashboard.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const nonce = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
function html(body, n, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': `default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      ...extra,
    },
  });
}
const text = (body, type, status = 200) =>
  new Response(body, { status, headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

const cookie = (req, name) => (req.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1] || '';

async function isAdmin(req, env) {
  if (env.DEV === '1') return true;
  if (!env.ADMIN_TOKEN) return false;
  const want = await sha256(env.ADMIN_TOKEN);
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ') && safeEqual(await sha256(auth.slice(7)), want)) return true;
  return safeEqual(cookie(req, 'ep_session'), want);
}

async function handleRedirect(req, env, ctx, code) {
  const link = await env.DB.prepare('SELECT code, campaign_id, channel, dest_url FROM links WHERE code = ?').bind(code).first();
  if (!link) return text('Link not found', 'text/plain', 404);
  let dest;
  try {
    dest = withUtm(link.dest_url, { campaign: link.campaign_id, channel: link.channel, medium: MEDIUM_OF[link.channel] || 'other' });
  } catch {
    return text('Bad destination', 'text/plain', 502);
  }
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const { bot, device } = classifyUA(req.headers.get('user-agent') || '');
    const now = new Date();
    ctx.waitUntil(
      env.DB.prepare('INSERT INTO clicks (code, ts, day, via, device, country, referrer_host, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(code, now.getTime(), localDay(now, env.TZ || 'UTC'), url.searchParams.get('q') === '1' ? 'qr' : 'link', device,
          req.cf?.country || null, referrerHost(req.headers.get('referer')), bot ? 1 : 0)
        .run()
        .catch((e) => console.error('click log failed', e)) // never block the redirect on logging
    );
  }
  return new Response(null, { status: 302, headers: { location: dest, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const n = nonce();

    if (path === '/healthz') return text('ok', 'text/plain');

    let m = path.match(/^\/r\/([A-Za-z0-9]{4,16})$/);
    if (m && (req.method === 'GET' || req.method === 'HEAD')) return handleRedirect(req, env, ctx, m[1]);

    if (path === '/login') {
      if (req.method === 'POST') {
        const token = String((await req.formData()).get('token') || '');
        if (env.ADMIN_TOKEN && safeEqual(await sha256(token), await sha256(env.ADMIN_TOKEN))) {
          return new Response(null, {
            status: 303,
            headers: { location: '/dashboard', 'set-cookie': `ep_session=${await sha256(env.ADMIN_TOKEN)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` },
          });
        }
        return html(renderLogin({ nonce: n, error: true }), n, 401);
      }
      return html(renderLogin({ nonce: n }), n);
    }
    if (path === '/logout') {
      return new Response(null, { status: 303, headers: { location: '/login', 'set-cookie': 'ep_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' } });
    }

    const admin = path === '/' || path.startsWith('/dashboard') || path.startsWith('/api/');
    if (!admin) return text('Not found', 'text/plain', 404);
    if (!(await isAdmin(req, env))) {
      if (path.startsWith('/api/')) return text('Unauthorized', 'text/plain', 401);
      return new Response(null, { status: 303, headers: { location: '/login' } });
    }

    const tz = env.TZ || 'UTC';
    const today = localDay(new Date(), tz);

    if (path === '/' || path === '/dashboard') return html(renderIndex(await listCampaigns(env.DB), { nonce: n }), n);

    if ((m = path.match(/^\/dashboard\/([\w-]+)$/))) {
      const stats = await campaignStats(env.DB, m[1], { today });
      return stats ? html(renderDashboard(stats, { nonce: n }), n) : html(renderIndex([], { nonce: n }), n, 404);
    }

    if ((m = path.match(/^\/api\/campaigns\/([\w-]+)\/(stats|daily\.csv|report\.md)$/))) {
      const [, id, what] = m;
      if (what === 'report.md') {
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 7));
        const cur = lastNDays(today, days);
        const [a, b] = await Promise.all([campaignStats(env.DB, id, { ...cur, today }), campaignStats(env.DB, id, previousWindow(today, days))]);
        return a ? text(weekReport(a, b, cur), 'text/markdown') : text('Unknown campaign', 'text/plain', 404);
      }
      const stats = await campaignStats(env.DB, id, { today });
      if (!stats) return text('Unknown campaign', 'text/plain', 404);
      return what === 'stats' ? text(JSON.stringify(stats, null, 2), 'application/json') : text(dailyCsv(stats), 'text/csv');
    }

    return text('Not found', 'text/plain', 404);
  },
};
