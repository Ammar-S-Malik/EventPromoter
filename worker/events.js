// Admin "New event" flow: form -> brief saved in R2 + tracked links in D1 -> assets rendered on
// first request and cached in R2. All routes sit behind the same admin check as the dashboard.
//
//   GET/POST /dashboard/new            create an event
//   GET/POST /dashboard/:id/edit       change an event's details (links keep their codes)
//   GET      /dashboard/:id/assets     previews, downloads, lint report, short links
//   GET      /files/:id/:name          one generated file (png / pdf), rendered then cached
//
// R2 layout:  events/<id>/brief.json   events/<id>/<file>

import { makeCode, shortUrl } from '../src/links.js';
import {
  parseBrief, formValues, campaignId, RESERVED_IDS, preflight, summariseIssues, buildAsset,
  FILES, FILE_BY_NAME, SCALE, CHANNELS,
} from '../src/generate.js';
import { renderEventForm, renderAssets, renderMessage } from './dashboard.js';

const rkey = (id, name) => `events/${id}/${name}`;
const KEYS = Object.keys(CHANNELS); // format keys: ig-post, ig-story, poster, slide, banner

async function loadCampaign(env, id) {
  const campaign = await env.DB.prepare('SELECT id, name, event_date FROM campaigns WHERE id = ?').bind(id).first();
  if (!campaign) return null;
  const { results } = await env.DB.prepare('SELECT code, channel, dest_url FROM links WHERE campaign_id = ?').bind(id).all();
  const codes = {};
  for (const k of KEYS) codes[k] = results.find((l) => l.channel === CHANNELS[k].channel)?.code || null;
  return { campaign, codes };
}

async function loadBrief(env, id) {
  const obj = await env.ASSETS.get(rkey(id, 'brief.json'));
  if (!obj) return null;
  try { return JSON.parse(await obj.text()); } catch { return null; }
}

/** Create or update the campaign + its five links, store the brief, and drop cached files. */
async function saveEvent(env, id, brief, { create }) {
  const now = Date.now();
  const eventDate = [brief.date, brief.time].filter(Boolean).join(' · ');
  await env.DB.prepare(
    'INSERT INTO campaigns (id, name, event_date, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, event_date = excluded.event_date'
  ).bind(id, brief.title, eventDate, now).run();

  const existing = create ? { codes: {} } : await loadCampaign(env, id);
  for (const k of KEYS) {
    const channel = CHANNELS[k].channel;
    if (existing.codes[k]) {
      // never touch the code: a printed poster must keep working
      await env.DB.prepare('UPDATE links SET dest_url = ? WHERE campaign_id = ? AND channel = ?').bind(brief.destination, id, channel).run();
      continue;
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await env.DB.prepare('INSERT INTO links (code, campaign_id, channel, dest_url, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(makeCode(), id, channel, brief.destination, now).run();
        break;
      } catch (e) {
        if (attempt >= 2) throw e; // a code collision is astronomically unlikely; retry a couple of times
      }
    }
  }
  await env.ASSETS.put(rkey(id, 'brief.json'), JSON.stringify({ ...brief, version: now }), { httpMetadata: { contentType: 'application/json' } });
  await env.ASSETS.delete(FILES.map((f) => rkey(id, f.name)));
}

/** Return { body, type } for one generated file, rendering and caching it on first use. */
export async function getFile(env, id, name, { origin, render, brand }) {
  const spec = FILE_BY_NAME[name];
  if (!spec) return null;
  const hit = await env.ASSETS.get(rkey(id, name));
  if (hit) return { body: await hit.arrayBuffer(), type: spec.type };

  const [brief, loaded] = await Promise.all([loadBrief(env, id), loadCampaign(env, id)]);
  if (!brief || !loaded) return null;
  let body;
  if (spec.type === 'application/pdf') {
    const poster = await getFile(env, id, 'poster.png', { origin, render, brand });
    body = await render.pdf(new Uint8Array(poster.body), { widthIn: 11, heightIn: 17, title: `${brief.title} (poster)` });
  } else {
    const { asset } = buildAsset(brief, spec.key, brand, { origin, codes: loaded.codes });
    body = await render.png(asset.svg, { scale: SCALE[spec.key] || 1 });
  }
  await env.ASSETS.put(rkey(id, name), body, { httpMetadata: { contentType: spec.type } });
  return { body, type: spec.type };
}

const notConfigured = (n, html) =>
  html(renderMessage({ nonce: n, title: 'File storage is not set up', body: 'This Worker has no R2 bucket bound as ASSETS. Create one and add it to wrangler.toml (see the README), then deploy again.' }), n, 503);

export async function handleEvents({ req, url, path, env, n, render, brand, html, text }) {
  let m;
  const isNew = path === '/dashboard/new';
  const sub = path.match(/^\/dashboard\/([\w-]+)\/(edit|assets)$/);
  const file = path.match(/^\/files\/([\w-]+)\/([\w.-]+)$/);
  if (!isNew && !sub && !file) return null;
  if (!env.ASSETS) return notConfigured(n, html);
  const origin = url.origin;

  if (isNew) {
    if (req.method !== 'POST') return html(renderEventForm({ nonce: n, mode: 'new', values: formValues(), errors: {}, issues: null }), n);
    const form = await req.formData();
    const { brief, errors } = parseBrief(form);
    const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
    const id = brief.title ? campaignId(brief.title) : '';
    if (brief.title && (!id || RESERVED_IDS.has(id))) errors.title = 'Choose a different title.';
    if (!errors.title && id && (await env.DB.prepare('SELECT 1 AS x FROM campaigns WHERE id = ?').bind(id).first())) {
      errors.title = 'An event with this title already exists. Open it to change its details, or use a different title.';
    }
    if (Object.keys(errors).length) return html(renderEventForm({ nonce: n, mode: 'new', values, errors, issues: null }), n, 422);
    const issues = summariseIssues(preflight(brief, brand, origin));
    if (issues.errors.length) return html(renderEventForm({ nonce: n, mode: 'new', values, errors: {}, issues }), n, 422);
    await saveEvent(env, id, brief, { create: true });
    return new Response(null, { status: 303, headers: { location: `/dashboard/${id}/assets` } });
  }

  if (sub) {
    const [, id, what] = sub;
    const loaded = await loadCampaign(env, id);
    if (!loaded) return html(renderMessage({ nonce: n, title: 'Event not found', body: 'There is no event with that address.' }), n, 404);
    const brief = await loadBrief(env, id);

    if (what === 'assets') {
      if (!brief) return new Response(null, { status: 303, headers: { location: `/dashboard/${id}/edit` } });
      const issues = summariseIssues(preflight(brief, brand, origin));
      const links = KEYS.map((k) => ({ key: k, channel: CHANNELS[k].channel, label: CHANNELS[k].label, url: shortUrl(origin, loaded.codes[k]) }));
      return html(renderAssets({ nonce: n, campaign: loaded.campaign, brief, issues, links, version: brief.version || 0 }), n);
    }

    // edit
    const start = brief || { title: loaded.campaign.name };
    if (req.method !== 'POST') {
      return html(renderEventForm({ nonce: n, mode: 'edit', campaign: loaded.campaign, values: formValues(start), errors: {}, issues: null, imported: !brief }), n);
    }
    const formData = await req.formData();
    const { brief: next, errors } = parseBrief(formData);
    const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string'));
    if (Object.keys(errors).length) return html(renderEventForm({ nonce: n, mode: 'edit', campaign: loaded.campaign, values, errors, issues: null }), n, 422);
    const issues = summariseIssues(preflight(next, brand, origin));
    if (issues.errors.length) return html(renderEventForm({ nonce: n, mode: 'edit', campaign: loaded.campaign, values, errors: {}, issues }), n, 422);
    await saveEvent(env, id, next, { create: false });
    return new Response(null, { status: 303, headers: { location: `/dashboard/${id}/assets` } });
  }

  // file
  const [, id, name] = file;
  let out;
  try {
    out = await getFile(env, id, name, { origin, render, brand });
  } catch (e) {
    console.error('asset render failed', id, name, e);
    return text('Could not generate this file. Check the Worker logs.', 'text/plain', 500);
  }
  if (!out) return text('Not found', 'text/plain', 404);
  const dl = url.searchParams.get('download') === '1';
  return new Response(out.body, {
    headers: {
      'content-type': out.type,
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': `${dl ? 'attachment' : 'inline'}; filename="${id}-${name}"`,
    },
  });
}
