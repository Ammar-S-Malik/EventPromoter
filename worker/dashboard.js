// Server-rendered analytics dashboard. Charts are inline SVG (no chart library, no client framework).
// Colours are the validated dataviz palette: series 1 blue = link clicks, series 2 orange = QR scans,
// each with its own dark-mode step validated against the dark surface.

import { esc } from '../src/canvas.js';
import { LABEL_OF } from '../src/links.js';

const label = (c) => LABEL_OF[c] || c;
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const CSS = `
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--grid:#e1e0d9;--axis:#c3c2b7;--s1:#2a78d6;--s2:#eb6834;--line:#e1e0d9}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#898781;--grid:#2c2c2a;--axis:#383835;--s1:#3987e5;--s2:#d95926;--line:#2c2c2a}}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
a{color:var(--s1)}
h1{font:700 28px/1.2 Poppins,Inter,sans-serif;margin:4px 0 4px}
h2{font:600 16px/1.3 Poppins,Inter,sans-serif;margin:0 0 12px}
.sub{color:var(--ink2);margin:0 0 20px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.actions a{display:inline-block;margin-left:12px;font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:8px 0 16px}
.tile,.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.tile .n{font:700 34px/1.1 Poppins,Inter,sans-serif;font-variant-numeric:tabular-nums}
.tile .n.sm{font-size:22px;line-height:1.3;padding:6px 0 3px}
.tile .l{color:var(--ink2);font-size:13px;margin-top:2px}
.card{margin-bottom:16px}
.legend{display:flex;gap:16px;color:var(--ink2);font-size:13px;margin:0 0 8px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
svg{display:block;width:100%;height:auto;overflow:visible}
svg text{font-family:Inter,system-ui,sans-serif}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
th{color:var(--ink2);font-weight:600}td.r,th.r{text-align:right}
details summary{cursor:pointer;color:var(--ink2);font-size:14px}
.empty{color:var(--ink2);padding:24px 0;text-align:center}
#tip{position:fixed;z-index:9;pointer-events:none;background:var(--ink);color:var(--surface);padding:6px 10px;border-radius:8px;font-size:13px;line-height:1.4;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.hit{fill:transparent}.hit:hover,.hit:focus{fill:var(--ink);fill-opacity:.06;outline:none}
form{display:flex;gap:8px;flex-wrap:wrap}input{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--axis);background:var(--surface);color:var(--ink);min-width:260px}
button{font:600 14px Inter,sans-serif;padding:8px 14px;border-radius:8px;border:0;background:var(--s1);color:#fff;cursor:pointer}
.err{color:#d03b3b}
`;

const TIP_JS = `
const tip=document.getElementById('tip');
function show(el){tip.innerHTML=el.dataset.tip;tip.hidden=false;const r=el.getBoundingClientRect();
 tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,r.left+r.width/2-tip.offsetWidth/2))+'px';
 tip.style.top=Math.max(8,r.top-tip.offsetHeight-8)+'px'}
function hide(){tip.hidden=true}
document.querySelectorAll('[data-tip]').forEach(el=>{el.addEventListener('mouseenter',()=>show(el));el.addEventListener('focus',()=>show(el));
 el.addEventListener('mouseleave',hide);el.addEventListener('blur',hide)});`;

function page(title, body, nonce, { script = false } = {}) {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><style nonce="${nonce}">${CSS}</style></head><body><main>${body}</main>` +
    (script ? `<div id="tip" hidden></div><script nonce="${nonce}">${TIP_JS}</script>` : '') +
    `</body></html>`
  );
}

const niceMax = (v) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / 2) * p * 2 > v * 1.6 ? Math.ceil(v / (p / 2)) * (p / 2) : Math.ceil(v / p) * p;
};

// bar with a rounded data-end (top), square against the baseline
const topRounded = (x, y, w, h, r) => {
  r = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
};

function dailyChart(days) {
  const W = 760, H = 270, L = 38, R = 8, T = 14, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(1, ...days.map((d) => d.clicks)));
  const y = (v) => T + ph - (v / max) * ph;
  const step = pw / days.length;
  const bw = Math.min(30, step * 0.64);
  const every = Math.ceil(days.length / 8);
  let g = '';
  for (const t of [0, max / 2, max]) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? 'var(--axis)' : 'var(--grid)'}" stroke-width="1"/>`;
    g += `<text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Number.isInteger(t) ? t : t.toFixed(1)}</text>`;
  }
  days.forEach((d, i) => {
    const cx = L + step * i + step / 2;
    const link = d.clicks - d.qr;
    const x = cx - bw / 2;
    const hLink = (link / max) * ph, hQr = (d.qr / max) * ph;
    const gap = link > 0 && d.qr > 0 ? 2 : 0;
    if (link > 0) {
      g += d.qr > 0
        ? `<rect x="${x}" y="${y(link)}" width="${bw}" height="${hLink}" fill="var(--s1)"/>`
        : `<path d="${topRounded(x, y(link), bw, hLink, 4)}" fill="var(--s1)"/>`;
    }
    if (d.qr > 0) g += `<path d="${topRounded(x, y(d.clicks), bw, Math.max(0, hQr - gap), 4)}" fill="var(--s2)"/>`;
    if ((days.length - 1 - i) % every === 0) g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(fmtDay(d.day))}</text>`;
    const tip = `<b>${esc(fmtDay(d.day))}</b><br>${d.clicks} click${d.clicks === 1 ? '' : 's'}<br>Link ${link} · QR ${d.qr}`;
    g += `<rect class="hit" tabindex="0" data-tip="${esc(tip)}" x="${cx - step / 2}" y="${T}" width="${step}" height="${ph}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Clicks per day, split into link clicks and QR scans">${g}</svg>`;
}

function channelBars(channels) {
  const rowH = 38, L = 140, R = 56, W = 760;
  const pw = W - L - R;
  const max = Math.max(1, ...channels.map((c) => c.clicks));
  let g = '';
  channels.forEach((c, i) => {
    const y = i * rowH + 6;
    const w = Math.max(c.clicks > 0 ? 4 : 0, (c.clicks / max) * pw);
    const tip = `<b>${esc(label(c.channel))}</b><br>${c.clicks} click${c.clicks === 1 ? '' : 's'}${c.qr ? ` (${c.qr} QR)` : ''}`;
    g += `<text x="${L - 12}" y="${y + 14}" text-anchor="end" font-size="13" fill="var(--ink2)">${esc(label(c.channel))}</text>`;
    if (w > 0) g += `<path d="M${L} ${y}h${w - 4}a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-${w - 4}z" fill="var(--s1)"/>`;
    g += `<text x="${L + w + 8}" y="${y + 14}" font-size="13" font-weight="600" fill="var(--ink)">${c.clicks}</text>`;
    g += `<rect class="hit" tabindex="0" data-tip="${esc(tip)}" x="0" y="${y - 6}" width="${W}" height="${rowH - 2}"/>`;
  });
  g += `<line x1="${L}" x2="${L}" y1="0" y2="${channels.length * rowH}" stroke="var(--axis)"/>`;
  return `<svg viewBox="0 0 ${W} ${channels.length * rowH + 4}" role="img" aria-label="Clicks by channel">${g}</svg>`;
}

const miniTable = (title, rows, empty) =>
  `<div class="card"><h2>${esc(title)}</h2>` +
  (rows.length
    ? `<table><tbody>${rows.map((r) => `<tr><td>${esc(r.k)}</td><td class="r">${r.clicks}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">${esc(empty)}</div>`) +
  `</div>`;

export function renderDashboard(stats, { nonce }) {
  const { campaign: c, totals: t, channels, days } = stats;
  const top = channels[0] && channels[0].clicks > 0 ? channels[0] : null;
  const body = `
<p class="sub"><a href="/dashboard">← All campaigns</a></p>
<div class="top"><div><h1>${esc(c.name)}</h1><p class="sub">${esc(c.event_date || '')}</p></div>
<div class="actions"><a href="/api/campaigns/${encodeURIComponent(c.id)}/report.md">Weekly report</a><a href="/api/campaigns/${encodeURIComponent(c.id)}/daily.csv">Download CSV</a></div></div>
<div class="tiles">
 <div class="tile"><div class="n">${t.clicks}</div><div class="l">Total clicks</div></div>
 <div class="tile"><div class="n">${t.qr}</div><div class="l">QR scans</div></div>
 <div class="tile"><div class="n sm">${top ? esc(label(top.channel)) : '—'}</div><div class="l">${top ? `Top channel · ${top.clicks} clicks` : 'Top channel'}</div></div>
 <div class="tile"><div class="n">${t.bots}</div><div class="l">Bot / preview hits filtered</div></div>
</div>
${t.clicks === 0 ? `<div class="card"><div class="empty">No clicks yet. Once a poster is up or a post is live, they will show here.</div></div>` : ''}
<div class="card"><h2>Clicks by channel</h2>${channelBars(channels)}</div>
<div class="card"><h2>Clicks per day</h2>
 <div class="legend"><span><i style="background:var(--s1)"></i>Link clicks</span><span><i style="background:var(--s2)"></i>QR scans</span></div>
 ${days.length ? dailyChart(days) : `<div class="empty">No daily data yet.</div>`}
 <details><summary>View as table</summary><table><thead><tr><th>Date</th><th class="r">Link clicks</th><th class="r">QR scans</th><th class="r">Total</th></tr></thead><tbody>
 ${days.map((d) => `<tr><td>${esc(fmtDay(d.day))}</td><td class="r">${d.clicks - d.qr}</td><td class="r">${d.qr}</td><td class="r">${d.clicks}</td></tr>`).join('')}
 </tbody></table></details></div>
<div class="cols">
 ${miniTable('Devices', stats.devices, 'No data yet')}
 ${miniTable('Top referrers', stats.referrers, 'Mostly direct visits (posters, QR)')}
 ${miniTable('Top countries', stats.countries, 'No data yet')}
</div>
<p class="sub" style="margin-top:16px">Counts exclude crawlers and link-preview fetches. No IP addresses or user-agent strings are stored.</p>`;
  return page(`${c.name} · EventPromoter`, body, nonce, { script: true });
}

export function renderIndex(campaigns, { nonce }) {
  const body = `<h1>EventPromoter</h1><p class="sub">Campaign analytics</p>` +
    (campaigns.length
      ? `<div class="card"><table><thead><tr><th>Campaign</th><th>Event</th><th class="r">Clicks</th><th class="r">QR scans</th></tr></thead><tbody>` +
        campaigns.map((c) => `<tr><td><a href="/dashboard/${encodeURIComponent(c.id)}">${esc(c.name)}</a></td><td>${esc(c.event_date || '')}</td><td class="r">${c.clicks}</td><td class="r">${c.qr}</td></tr>`).join('') +
        `</tbody></table></div>`
      : `<div class="card"><div class="empty">No campaigns yet. Generate one with the CLI and apply its links.sql.</div></div>`);
  return page('EventPromoter', body, nonce);
}

export function renderLogin({ nonce, error = false }) {
  const body = `<h1>EventPromoter</h1><p class="sub">Sign in to view analytics.</p><div class="card"><form method="post" action="/login">` +
    `<input type="password" name="token" placeholder="Admin token" autocomplete="current-password" required autofocus><button>Sign in</button></form>` +
    (error ? `<p class="err">That token was not accepted.</p>` : '') + `</div>`;
  return page('Sign in · EventPromoter', body, nonce);
}
