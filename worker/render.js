// Rasterising inside the Worker: SVG -> PNG with resvg (WebAssembly) and the brand fonts bundled
// with the Worker (Workers have no system fonts), then PNG -> print PDF with pdf-lib.
// Loaded lazily, only when an asset has to be generated, so redirects stay fast.
//
// Needs the `[[rules]]` block in wrangler.toml so .ttf/.otf files are imported as binary data.
// CPU-heavy: rendering the five assets needs the Workers Paid plan (the free plan caps CPU at 10 ms).

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import poppinsRegular from './fonts/Poppins-Regular.ttf';
import poppinsMedium from './fonts/Poppins-Medium.ttf';
import poppinsBold from './fonts/Poppins-Bold.ttf';
import interRegular from './fonts/Inter-Regular.otf';
import interBold from './fonts/Inter-Bold.otf';
import { pngToPdf } from '../src/pdf.js';

const FONTS = [poppinsRegular, poppinsMedium, poppinsBold, interRegular, interBold].map((b) => new Uint8Array(b));

let ready;
const init = () => (ready ??= initWasm(resvgWasm));

// One render at a time per Worker instance. The assets page asks for every preview at once and a
// single instance has about 128 MB, so overlapping poster/banner renders can blow the limit
// (Cloudflare error 1102). Queued requests simply wait their turn.
let queue = Promise.resolve();
const one = (job) => {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
};

export const png = (svg, opts) => one(() => rasterise(svg, opts));

async function rasterise(svg, { scale = 1 } = {}) {
  await init();
  const r = new Resvg(svg, {
    fitTo: scale === 1 ? { mode: 'original' } : { mode: 'zoom', value: scale },
    font: { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
  });
  try {
    const img = r.render();
    try { return img.asPng(); } finally { img.free?.(); }
  } finally {
    r.free?.();
  }
}

export const pdf = (bytes, opts) => one(() => pngToPdf(bytes, opts));
