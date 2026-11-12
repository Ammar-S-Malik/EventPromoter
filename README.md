# EventPromoter

Turn **one event brief** into a matched, on-brand campaign: Instagram post, story, 11×17 poster (print-ready PDF), presentation slide and digital-screen banner. A built-in **brand linter** checks every asset before export.

Concept project for campus marketing teams, built around a fictional sample brand ("Northfield Student Union"). Swap `brand/brand.json` for any organisation's palette, fonts and copy limits.

| Post | Story | Poster |
|---|---|---|
| ![post](docs/post.png) | ![story](docs/story.png) | ![poster](docs/poster.png) |

![slide](docs/slide.png)
![banner](docs/banner.png)

## Usage

```bash
npm install
node src/cli.js examples/kickoff.json          # writes out/kickoff/{ig-post,ig-story,poster,slide,banner}.{svg,png}, poster-print.pdf, lint.json
node src/cli.js examples/bad-brief.json --no-fail   # see the linter catch an off-brand design
npm test
```

A brief is plain JSON: `category, title, tagline, date, time, location, cta, link, accent` (`gold | teal | coral`). Requires `rsvg-convert` for the PDF.

## How it works

- **Layout engine, zero runtime deps.** `src/text.js` measures text from real per-glyph advance widths (`tools/gen-metrics.py` extracts them from the brand fonts into `src/metrics.js`), so it can wrap and *fit* copy to a box exactly. No DOM, no canvas, no font loading, so the same code can run in Node or a Cloudflare Worker.
- **Templates → SVG.** Three layouts (`stack`, `split`, `strip`) cover the five formats. Artwork is generated deterministically from the title, using brand colours only.
- **Brand linter** (`src/lint.js`) inspects the *exact geometry that was rendered*: WCAG contrast, off-palette colours, non-brand typefaces/weights, text overflow, platform safe zones (e.g. Instagram story UI overlays), minimum legible size, and copy length.
- **Render.** PNG via sharp/librsvg; vector PDF at true 11×17 in via `rsvg-convert` with fonts embedded.

## Roadmap

- [ ] Cloudflare Worker + D1: short links per asset, click logging
- [ ] QR codes per asset (slot is reserved in the CTA area)
- [ ] Analytics dashboard (clicks/scans by channel and day) + weekly report export
- [ ] Post-event survey with auto-summary, content calendar view
- [ ] Linter rule for text sitting on busy artwork
