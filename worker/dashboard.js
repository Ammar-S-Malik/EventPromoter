// Server-rendered admin UI: sign-in, campaign list, campaign analytics.
// Charts are inline SVG (no chart library, no client framework, no external fonts or assets),
// so the strict CSP (nonce'd <style> and <script> only, no style attributes) holds.
// Chart colours are the validated dataviz palette: series 1 blue = link clicks, series 2 orange =
// QR scans, each with its own dark-mode step. The shell uses the brand navy and gold.

import { esc } from '../src/canvas.js';
import { LABEL_OF } from '../src/links.js';

const label = (c) => LABEL_OF[c] || c;
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const num = (n) => Number(n || 0).toLocaleString('en-CA');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const CSS = `
:root{--page:#f3f5f8;--surface:#fff;--sunk:#f7f9fb;--ink:#0f2a47;--text:#1d2b3a;--muted:#5e6e80;--line:#e2e7ee;--grid:#e6eaf0;--axis:#c5ced9;
--side:#0f2a47;--side-ink:#c9d5e3;--side-muted:#7f93ab;--gold:#ffb703;--s1:#2a78d6;--s2:#eb6834;--track:#e9edf2;--ok:#1a7f4b;--bad:#c2410c;--focus:#2a78d6}
@media (prefers-color-scheme:dark){:root{--page:#0a1422;--surface:#111f33;--sunk:#0d192a;--ink:#eef2f7;--text:#d6dee8;--muted:#8fa1b6;--line:#1e3049;--grid:#1c2c42;--axis:#2c405c;
--side:#08111d;--side-ink:#c9d5e3;--side-muted:#6f839b;--s1:#3987e5;--s2:#d95926;--track:#1c2c42;--ok:#4ade80;--bad:#fb923c}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--page);color:var(--text);font:14px/1.5 Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:6px}
.app{display:grid;grid-template-columns:232px 1fr;min-height:100vh;background:linear-gradient(to right,var(--side) 232px,transparent 232px)}
.side{background:var(--side);color:var(--side-ink);display:flex;flex-direction:column;padding:20px 14px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 22px;text-decoration:none;color:#fff}
.brand b{font:600 15px/1.2 Poppins,Inter,sans-serif;letter-spacing:.2px}.brand small{display:block;color:var(--side-muted);font-size:12px;font-weight:400}
.nav{display:flex;flex-direction:column;gap:2px}
.nav .h{color:var(--side-muted);font-size:12px;padding:16px 10px 6px}
.nav a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;text-decoration:none;color:var(--side-ink);position:relative}
.nav a:hover{background:rgba(255,255,255,.06)}
.nav a.on{background:rgba(255,255,255,.09);color:#fff}
.nav a.on::before{content:"";position:absolute;left:-14px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}
.nav a.sub{padding-left:36px;font-size:13px}
.nav svg{flex:none;opacity:.85}
.side .foot{margin-top:auto;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}
main{min-width:0;padding:22px 32px 56px;max-width:1240px}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.crumbs{color:var(--muted);font-size:13px}.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--ink);text-decoration:underline}
.crumbs span{margin:0 6px;opacity:.6}
.btns{display:flex;gap:8px}
.btn{display:inline-flex;align-items:center;gap:7px;font:500 13px/1 Inter,sans-serif;padding:9px 13px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-decoration:none;cursor:pointer}
.btn:hover{border-color:var(--axis)}
.btn.primary{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
h1{font:600 26px/1.2 Poppins,Inter,sans-serif;color:var(--ink);margin:0 0 8px;letter-spacing:-.2px}
h2{font:600 15px/1.3 Poppins,Inter,sans-serif;color:var(--ink);margin:0}
.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:13px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
.chip .dot{width:7px;height:7px;border-radius:50%;background:var(--ok)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:16px}
.ph{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px 0}
.ph p{margin:2px 0 0;color:var(--muted);font-size:13px}
.pb{padding:14px 20px 18px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr)}
.kpi{padding:18px 20px;border-left:1px solid var(--line);min-width:0}
.kpi:first-child{border-left:0}
.kpi .l{color:var(--muted);font-size:13px}
.kpi .n{font:600 30px/1.15 Poppins,Inter,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums;margin:6px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi .n.sm{font-size:20px;line-height:1.75}
.kpi .s{font-size:12.5px;color:var(--muted)}
.up{color:var(--ok);font-weight:600}.down{color:var(--bad);font-weight:600}
.kpi .row{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
.spark{width:92px;height:32px;flex:none}
.legend{display:flex;gap:16px;color:var(--muted);font-size:13px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.k1{background:var(--s1)}.k2{background:var(--s2)}
svg{display:block}
.chart{width:100%;height:auto;overflow:visible}
.chart text{font-family:Inter,system-ui,sans-serif}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th{font-weight:500;color:var(--muted);font-size:12.5px;text-align:left;padding:10px 20px;border-bottom:1px solid var(--line);background:var(--sunk)}
td{padding:12px 20px;border-bottom:1px solid var(--line)}
tr:last-child td{border-bottom:0}
.r{text-align:right}
tbody tr:hover td{background:var(--sunk)}
.ch{display:flex;align-items:center;gap:10px;font-weight:500;color:var(--ink)}
.ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--sunk);border:1px solid var(--line);color:var(--ink);flex:none}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--sunk);border:1px solid var(--line);padding:2px 6px;border-radius:6px;color:var(--text)}
.tw{overflow-x:auto}
.share{display:flex;align-items:center;gap:10px;justify-content:flex-end}
.share svg{width:120px;height:6px}
.share span{min-width:36px;text-align:right;color:var(--muted)}
.trk{fill:var(--track)}.f1{fill:var(--s1)}.f2{fill:var(--s2)}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cols .panel{margin:0}
.mini td{padding:9px 20px}.ph.mh{padding-bottom:10px}
.mini .share svg{width:72px}
.empty{color:var(--muted);padding:28px 20px;text-align:center}
.empty b{display:block;color:var(--ink);font-weight:600;margin-bottom:4px}
details{border-top:1px solid var(--line)}
details summary{cursor:pointer;color:var(--muted);font-size:13px;padding:12px 20px;list-style-position:inside}
details[open] summary{border-bottom:1px solid var(--line)}
.note{color:var(--muted);font-size:12.5px;margin-top:20px;display:flex;gap:8px;align-items:center}
.camp a{text-decoration:none;font-weight:500;color:var(--ink)}.camp a:hover{text-decoration:underline}
.camp small{display:block;color:var(--muted);font-size:12px}
#tip{position:fixed;z-index:9;pointer-events:none;background:var(--ink);color:var(--surface);padding:7px 10px;border-radius:8px;font-size:12.5px;line-height:1.45;box-shadow:0 6px 20px rgba(15,42,71,.25)}
.hit{fill:transparent}.hit:hover,.hit:focus{fill:var(--ink);fill-opacity:.05;outline:none}
/* sign-in */
.auth{min-height:100vh;display:grid;grid-template-columns:minmax(320px,44%) 1fr}
.auth .art{background:var(--side);color:var(--side-ink);padding:48px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.auth .art h2{color:#fff;font-size:28px;line-height:1.25;max-width:20ch;margin:0 0 12px}
.auth .art p{max-width:42ch;margin:0;color:var(--side-ink)}
.auth .art ul{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:12px}
.auth .art li{display:flex;gap:10px;align-items:center}
.auth .art li svg{color:var(--gold)}
.auth .hex{position:absolute;right:-60px;bottom:-40px;opacity:.9}
.auth .form{display:grid;place-items:center;padding:40px 24px}
.auth form{width:100%;max-width:360px}
.auth h1{margin-bottom:6px}
.auth .lead{color:var(--muted);margin:0 0 24px}
label{display:block;font-weight:500;color:var(--ink);margin-bottom:6px;font-size:13px}
input{font:inherit;width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--axis);background:var(--surface);color:var(--ink)}
input:focus{outline:2px solid var(--focus);outline-offset:1px;border-color:transparent}
.auth .btn{width:100%;justify-content:center;padding:11px;margin-top:14px;font-size:14px}
.hint{color:var(--muted);font-size:12.5px;margin-top:16px}
.err{display:flex;gap:8px;align-items:flex-start;background:rgba(194,65,12,.08);border:1px solid rgba(194,65,12,.3);color:var(--bad);padding:10px 12px;border-radius:8px;margin-bottom:16px;font-size:13px}
@media (max-width:980px){.kpis{grid-template-columns:repeat(2,1fr)}.kpi:nth-child(3){border-left:0}.kpi:nth-child(n+3){border-top:1px solid var(--line)}.cols{grid-template-columns:1fr}}
@media (max-width:760px){.app{grid-template-columns:1fr;background:none}.side{position:static;height:auto;flex-direction:row;align-items:center;flex-wrap:wrap;padding:12px 16px;gap:8px}
.brand{padding:0}.nav{flex-direction:row;flex-wrap:wrap}.nav .h,.nav a.sub{display:none}.nav a.on::before{display:none}.side .foot{margin:0 0 0 auto;border:0;padding:0}
main{padding:18px 16px 40px}.auth{grid-template-columns:1fr}.auth .art{padding:28px}.auth .art ul,.auth .hex{display:none}
.share svg,.spark{display:none}th,td{padding-left:14px;padding-right:14px}.ph{flex-wrap:wrap}.kpi .n{font-size:26px}}
`;

const TIP_JS = `
const tip=document.getElementById('tip');
function show(el){tip.innerHTML=el.dataset.tip;tip.hidden=false;const r=el.getBoundingClientRect();
 tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,r.left+r.width/2-tip.offsetWidth/2))+'px';
 tip.style.top=Math.max(8,r.top-tip.offsetHeight-8)+'px'}
function hide(){tip.hidden=true}
document.querySelectorAll('[data-tip]').forEach(el=>{el.addEventListener('mouseenter',()=>show(el));el.addEventListener('focus',()=>show(el));
 el.addEventListener('mouseleave',hide);el.addEventListener('blur',hide)});`;

// ---------------------------------------------------------------- icons (16px line icons, currentColor)

const I = (d, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  grid: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  doc: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  download: I('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  out: I('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  alert: I('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>'),
};
const CH_ICON = {
  'instagram-post': I('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.01"/>'),
  'instagram-story': I('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.5"/><path d="M12 8v8M8 12h8"/>'),
  poster: I('<rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M8 6h8M8 10h5M14 14h3v3h-3z"/>'),
  slide: I('<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M12 17v4M8 21h8"/>'),
  screen: I('<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 12h7"/>'),
};

const hexMark = (s = 30) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 35.6 11v18L20 38 4.4 29V11z" fill="#ffb703"/><path d="M20 10.5 28.2 15.3v9.4L20 29.5l-8.2-4.8v-9.4z" fill="#0f2a47"/><path d="M20 16.2l3.3 1.9v3.8L20 23.8l-3.3-1.9v-3.8z" fill="#ffb703"/></svg>`;

// ---------------------------------------------------------------- page shells

function doc(title, nonce, inner, { script = false } = {}) {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light dark"><title>${esc(title)}</title><style nonce="${nonce}">${CSS}</style></head><body>${inner}` +
    (script ? `<div id="tip" hidden></div><script nonce="${nonce}">${TIP_JS}</script>` : '') +
    `</body></html>`
  );
}

function shell(title, nonce, body, { active = 'campaigns', campaign = null, script = false } = {}) {
  const cid = campaign && encodeURIComponent(campaign.id);
  const side =
    `<aside class="side"><a class="brand" href="/dashboard">${hexMark()}<span><b>EventPromoter</b><small>Campaign analytics</small></span></a>` +
    `<nav class="nav" aria-label="Main"><span class="h">Workspace</span>` +
    `<a href="/dashboard"${campaign ? '' : ' class="on" aria-current="page"'}>${ICON.grid}Campaigns</a>` +
    (campaign
      ? `<a class="sub on" href="/dashboard/${cid}" aria-current="page">${esc(campaign.name)}</a>` +
        `<span class="h">This campaign</span>` +
        `<a href="/api/campaigns/${cid}/report.md">${ICON.doc}Weekly report</a>` +
        `<a href="/api/campaigns/${cid}/daily.csv">${ICON.download}Export CSV</a>`
      : '') +
    `</nav><div class="foot nav"><a href="/logout">${ICON.out}Sign out</a></div></aside>`;
  return doc(title, nonce, `<div class="app">${side}<main>${body}</main></div>`, { script });
}

// ---------------------------------------------------------------- charts

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
  const W = 960, H = 280, L = 40, R = 8, T = 14, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(1, ...days.map((d) => d.clicks)));
  const y = (v) => T + ph - (v / max) * ph;
  const step = pw / days.length;
  const bw = Math.min(34, step * 0.62);
  const every = Math.ceil(days.length / 8);
  let g = '';
  for (const t of [0, max / 4, max / 2, (3 * max) / 4, max]) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? 'var(--axis)' : 'var(--grid)'}" stroke-width="1"${t && t !== max / 2 && t !== max ? ' stroke-dasharray="2 4"' : ''}/>`;
    if (t === 0 || t === max / 2 || t === max) g += `<text x="${L - 10}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Number.isInteger(t) ? t : t.toFixed(1)}</text>`;
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
    if ((days.length - 1 - i) % every === 0) g += `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(fmtDay(d.day))}</text>`;
    const tip = `<b>${esc(fmtDay(d.day))}</b><br>${d.clicks} click${d.clicks === 1 ? '' : 's'}<br>Link ${link} · QR ${d.qr}`;
    g += `<rect class="hit" tabindex="0" data-tip="${esc(tip)}" x="${cx - step / 2}" y="${T}" width="${step}" height="${ph}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Clicks per day, split into link clicks and QR scans">${g}</svg>`;
}

function sparkline(days) {
  const vals = days.slice(-14).map((d) => d.clicks);
  if (vals.length < 2) return '';
  const W = 92, H = 32, max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 4) + 2, H - 3 - (v / max) * (H - 8)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const last = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${line}L${last[0].toFixed(1)} ${H}L2 ${H}Z" fill="var(--s1)" fill-opacity=".12"/>` +
    `<path d="${line}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="var(--s1)"/></svg>`;
}

/** Proportion bar: link share in blue, optional QR share stacked in orange. */
const shareBar = (part, total, qr = 0) => {
  const p = total ? (part / total) * 100 : 0;
  const q = total ? (qr / total) * 100 : 0;
  return `<svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect class="trk" width="100" height="6" rx="3"/>` +
    (p > 0 ? `<rect class="f1" width="${Math.max(2, p).toFixed(2)}" height="6" rx="3"/>` : '') +
    (q > 0 ? `<rect class="f2" x="${(p - q).toFixed(2)}" width="${q.toFixed(2)}" height="6"/>` : '') +
    `</svg>`;
};

/** Last 7 days vs the 7 before, from the continuous daily series. */
function weekDelta(days) {
  if (days.length < 8) return '';
  const sum = (a) => a.reduce((s, d) => s + d.clicks, 0);
  const cur = sum(days.slice(-7)), prev = sum(days.slice(-14, -7));
  if (!prev) return cur ? `<span class="up">New</span> this week` : '';
  const ch = Math.round(((cur - prev) / prev) * 100);
  return `<span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch)}%</span> vs previous 7 days`;
}

// ---------------------------------------------------------------- pages

const miniTable = (title, rows, empty) => {
  const total = rows.reduce((a, r) => a + r.clicks, 0);
  return `<section class="panel"><div class="ph mh"><h2>${esc(title)}</h2></div>` +
    (rows.length
      ? `<table class="mini"><tbody>${rows.map((r) => `<tr><td>${esc(r.k)}</td><td class="r"><div class="share">${shareBar(r.clicks, total)}<span>${num(r.clicks)}</span></div></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">${esc(empty)}</div>`) +
    `</section>`;
};

export function renderDashboard(stats, { nonce }) {
  const { campaign: c, totals: t, channels, days } = stats;
  const cid = encodeURIComponent(c.id);
  const top = channels[0] && channels[0].clicks > 0 ? channels[0] : null;
  const live = channels.filter((ch) => ch.clicks > 0).length;

  const linkRows = channels.map((ch) =>
    `<tr><td><div class="ch"><span class="ico">${CH_ICON[ch.channel] || ICON.chart}</span>${esc(label(ch.channel))}</div></td>` +
    `<td><code>/r/${esc(ch.code)}</code></td><td class="r">${num(ch.clicks - ch.qr)}</td><td class="r">${num(ch.qr)}</td><td class="r"><b>${num(ch.clicks)}</b></td>` +
    `<td class="r"><div class="share">${shareBar(ch.clicks, t.clicks, ch.qr)}<span>${pct(ch.clicks, t.clicks)}%</span></div></td></tr>`).join('');

  const body = `
<div class="top"><nav class="crumbs" aria-label="Breadcrumb"><a href="/dashboard">Campaigns</a><span>/</span>${esc(c.name)}</nav>
<div class="btns"><a class="btn" href="/api/campaigns/${cid}/report.md">${ICON.doc}Weekly report</a><a class="btn primary" href="/api/campaigns/${cid}/daily.csv">${ICON.download}Export CSV</a></div></div>
<div class="head"><div><h1>${esc(c.name)}</h1>
<div class="meta">${c.event_date ? `<span class="chip">${esc(c.event_date)}</span>` : ''}<span class="chip"><i class="dot"></i>${live} of ${channels.length} links receiving clicks</span><span class="chip">${num(t.bots)} bot / preview hits filtered</span></div></div></div>

<section class="panel kpis" aria-label="Key figures">
 <div class="kpi"><div class="l">Total clicks</div><div class="row"><div class="n">${num(t.clicks)}</div>${sparkline(days)}</div><div class="s">${weekDelta(days) || 'All time'}</div></div>
 <div class="kpi"><div class="l">QR scans</div><div class="n">${num(t.qr)}</div><div class="s">${pct(t.qr, t.clicks)}% of all clicks</div></div>
 <div class="kpi"><div class="l">Link clicks</div><div class="n">${num(t.link ?? t.clicks - t.qr)}</div><div class="s">Typed or tapped short links</div></div>
 <div class="kpi"><div class="l">Top channel</div><div class="n sm">${top ? esc(label(top.channel)) : '—'}</div><div class="s">${top ? `${num(top.clicks)} clicks · ${pct(top.clicks, t.clicks)}% share` : 'No clicks yet'}</div></div>
</section>

<section class="panel"><div class="ph"><div><h2>Clicks per day</h2><p>Link clicks and QR scans, excluding crawlers</p></div>
 <div class="legend"><span><i class="k1"></i>Link clicks</span><span><i class="k2"></i>QR scans</span></div></div>
 <div class="pb">${t.clicks === 0 || !days.length ? `<div class="empty"><b>No clicks yet</b>Once a poster is up or a post is live, daily traffic shows here.</div>` : dailyChart(days)}</div>
 <details><summary>View as table</summary><table><thead><tr><th>Date</th><th class="r">Link clicks</th><th class="r">QR scans</th><th class="r">Total</th></tr></thead><tbody>
 ${days.map((d) => `<tr><td>${esc(fmtDay(d.day))}</td><td class="r">${d.clicks - d.qr}</td><td class="r">${d.qr}</td><td class="r">${d.clicks}</td></tr>`).join('')}
 </tbody></table></details></section>

<section class="panel"><div class="ph"><div><h2>Tracked links</h2><p>One short link per asset; the poster and slide also carry a QR code</p></div></div><div class="pb"></div>
<div class="tw"><table><thead><tr><th>Channel</th><th>Short link</th><th class="r">Link</th><th class="r">QR</th><th class="r">Clicks</th><th class="r">Share</th></tr></thead><tbody>${linkRows}</tbody></table></div></section>

<div class="cols">
 ${miniTable('Devices', stats.devices, 'No data yet')}
 ${miniTable('Top referrers', stats.referrers, 'Mostly direct visits (posters, QR)')}
 ${miniTable('Top countries', stats.countries, 'No data yet')}
</div>
<p class="note">${ICON.shield}Counts exclude crawlers and link-preview fetches. No IP addresses or user-agent strings are stored.</p>`;
  return shell(`${c.name} · EventPromoter`, nonce, body, { campaign: c, script: true });
}

export function renderIndex(campaigns, { nonce }) {
  const clicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const qr = campaigns.reduce((a, c) => a + c.qr, 0);
  const max = Math.max(1, ...campaigns.map((c) => c.clicks));
  const body = `
<div class="top"><nav class="crumbs" aria-label="Breadcrumb">Campaigns</nav></div>
<div class="head"><div><h1>Campaigns</h1><div class="meta">Every campaign generated with the CLI and registered with its links.sql</div></div></div>
<section class="panel kpis" aria-label="Totals">
 <div class="kpi"><div class="l">Campaigns</div><div class="n">${num(campaigns.length)}</div><div class="s">Tracked in this workspace</div></div>
 <div class="kpi"><div class="l">Total clicks</div><div class="n">${num(clicks)}</div><div class="s">Across all campaigns</div></div>
 <div class="kpi"><div class="l">QR scans</div><div class="n">${num(qr)}</div><div class="s">${pct(qr, clicks)}% of all clicks</div></div>
 <div class="kpi"><div class="l">Link clicks</div><div class="n">${num(clicks - qr)}</div><div class="s">Typed or tapped short links</div></div>
</section>
<section class="panel">` +
    (campaigns.length
      ? `<table><thead><tr><th>Campaign</th><th>Event</th><th class="r">QR scans</th><th class="r">Clicks</th><th class="r">Relative reach</th></tr></thead><tbody>` +
        campaigns.map((c) => `<tr><td class="camp"><a href="/dashboard/${encodeURIComponent(c.id)}">${esc(c.name)}</a><small>${esc(c.id)}</small></td><td>${esc(c.event_date || '—')}</td>` +
          `<td class="r">${num(c.qr)}</td><td class="r"><b>${num(c.clicks)}</b></td><td class="r"><div class="share">${shareBar(c.clicks, max, c.qr)}</div></td></tr>`).join('') +
        `</tbody></table>`
      : `<div class="empty"><b>No campaigns yet</b>Generate one with <code>node src/cli.js brief.json --base-url …</code>, then apply its links.sql with wrangler.</div>`) +
    `</section>`;
  return shell('Campaigns · EventPromoter', nonce, body);
}

export function renderLogin({ nonce, error = false }) {
  const inner = `<div class="auth">
<section class="art">
 <a class="brand" href="/login">${hexMark(34)}<span><b>EventPromoter</b><small>Campaign analytics</small></span></a>
 <div><h2>See which poster, post or slide brought people in.</h2>
 <p>Every asset carries its own short link and QR code. Clicks land here by channel, day and device.</p>
 <ul><li>${ICON.check}Bots and link previews filtered out</li><li>${ICON.check}No IP addresses or user agents stored</li><li>${ICON.check}Weekly report and CSV export</li></ul></div>
 <svg class="hex" width="320" height="300" viewBox="0 0 320 300" aria-hidden="true"><g fill="none" stroke="#ffb703" stroke-width="2" opacity=".35"><path d="M160 20 236 64v88l-76 44-76-44V64z"/><path d="M236 152l76 44v88"/><path d="M84 152 8 196v88"/></g><path d="M236 152l76 44v88l-76 44-76-44v-88z" fill="#2ec4b6" opacity=".18"/></svg>
</section>
<section class="form"><form method="post" action="/login">
 <h1>Sign in</h1><p class="lead">Use the admin token for this deployment.</p>
 ${error ? `<div class="err" role="alert">${ICON.alert}<span>That token was not accepted. Check it and try again.</span></div>` : ''}
 <label for="token">Admin token</label>
 <input id="token" type="password" name="token" autocomplete="current-password" required autofocus>
 <button class="btn primary">Sign in</button>
 <p class="hint">The token is set with <code>wrangler secret put ADMIN_TOKEN</code>. Sessions last 30 days on this device.</p>
</form></section></div>`;
  return doc('Sign in · EventPromoter', nonce, inner);
}
