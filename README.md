# EventPromoter

Turn **one event brief** into a matched, on-brand campaign: Instagram post, story, 11×17 poster (print-ready PDF), presentation slide and digital-screen banner. Every asset gets its **own tracked short link** (and a **QR code** on the poster and slide), so you can see which channel actually brought people in. A built-in **brand linter** checks each asset before it goes out.

Concept project, built around a fictional sample brand ("Northfield Student Union"). Swap `brand/brand.json` for any organisation's palette, fonts and copy limits.

| Post | Story | Poster (QR + short link) |
|---|---|---|
| ![post](docs/post.png) | ![story](docs/story.png) | ![poster](docs/poster.png) |

![slide](docs/slide.png)
![banner](docs/banner.png)

### Analytics dashboard
![dashboard](docs/dashboard.png)

## Quick start

```bash
npm install
node src/cli.js examples/kickoff.json                      # assets only
node src/cli.js examples/kickoff.json --base-url https://go.example.org   # + tracked links and QR codes
node src/cli.js examples/bad-brief.json --no-fail          # watch the linter catch an off-brand design
npm test
```

A brief is plain JSON: `category, title, tagline, date, time, location, cta, link, accent` (`gold | teal | coral`), plus `destination` (the full https URL tracked links lead to) and optional `qrCaption`. Needs `rsvg-convert` for the PDF.

## How it works

**Design side**
- **Layout engine, zero runtime deps.** `src/text.js` measures text from real per-glyph advance widths (`tools/gen-metrics.py` extracts them from the brand fonts), so it can wrap and *fit* copy to a box exactly. No DOM, no canvas, no font loading.
- **Templates → SVG.** Three layouts cover the five formats; artwork is generated deterministically from the title using brand colours only.
- **Brand linter** (`src/lint.js`) inspects the exact geometry that was rendered: WCAG contrast, off-palette colours, non-brand typefaces, text overflow, platform safe zones (e.g. Instagram story UI), minimum legible size, copy length, and QR size/quiet-zone/safe-area.
- **QR encoder from scratch** (`src/qr.js`): byte mode, error correction M, versions 1-10, all 8 masks. `npm run verify:qr` renders codes at 12 lengths and 3 print sizes and decodes them with OpenCV; the test suite also decodes the QR out of the finished poster and slide PNGs.

**Tracking side** (`worker/`, Cloudflare Worker + D1)
- `GET /r/:code` logs the click and 302-redirects to the destination with UTM parameters added (existing ones are never overwritten). QR scans are told apart from typed links.
- Crawlers and link-preview fetches (Slack, WhatsApp, Facebook...) are detected and **excluded** from counts, but reported, so a pasted link doesn't inflate numbers.
- **Privacy:** no IP address and no raw user-agent string is ever stored, only day, device class, country, referrer *host*, and QR-vs-link.
- **Dashboard** (`/dashboard`): totals, clicks by channel, link-vs-QR per day, device / referrer / country, a table view of every chart, light and dark themes. Chart colours come from a palette validated for colour-blind separation and contrast.
- **Reporting:** `/api/campaigns/:id/report.md?days=7` returns a paste-ready weekly summary with change vs the previous period; `daily.csv` for spreadsheets.
- **Security:** admin routes fail closed (no `ADMIN_TOKEN` = everything denied), the session cookie holds a hash rather than the token, constant-time comparison, strict CSP with per-response nonces, all dynamic output HTML-escaped.

## Deploy the tracking Worker

```bash
npx wrangler d1 create eventpromoter                       # paste database_id into worker/wrangler.toml
npx wrangler d1 execute eventpromoter --remote --file=worker/schema.sql
npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.toml
npm run deploy:worker

# per campaign:
node src/cli.js examples/kickoff.json --base-url https://<your-worker-domain>
npx wrangler d1 execute eventpromoter --remote --file=out/kickoff/links.sql
```

The CLI saves each campaign's link codes in `links/<campaign>.json` and **reuses them on every re-run**, so a poster that is already printed never changes link. Commit that folder in your own deployment (it is git-ignored here because the examples use a fake domain).

**Status:** the Worker's logic is tested end to end against SQLite standing in for D1 (`npm test`, including CLI → `links.sql` → database → redirect). `wrangler deploy` itself has not been run against a real Cloudflare account yet.

## Project layout

```
src/        layout engine, templates, linter, QR encoder, link helpers, stats queries, CLI
worker/     Cloudflare Worker, D1 schema, dashboard renderer
brand/      brand.json (palette, fonts, copy limits)
examples/   sample briefs (+ one deliberately off-brand)
tools/      font-metrics generator, QR verifier, demo-dashboard renderer
test/       27 tests (layout, linter, QR, Worker, auth, end to end)
```

## Roadmap

- [ ] Post-event survey with automatic summary
- [ ] Content calendar view (when each asset is scheduled to go out)
- [ ] `.pptx` export for the slide
- [ ] Linter rule for text sitting on busy artwork
