// Rasterise / print. PNG via sharp (librsvg), PDF via rsvg-convert.
// On Cloudflare Workers these two functions get swapped for resvg-wasm; the SVG stays the same.

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function toPng(svg, { scale = 1 } = {}) {
  return sharp(Buffer.from(svg), { density: 72 * scale }).png().toBuffer();
}

/** Vector PDF at the SVG's physical size (e.g. 11x17in for the poster). */
export function toPdf(svg) {
  const dir = mkdtempSync(join(tmpdir(), 'eventpromoter-'));
  try {
    const inp = join(dir, 'in.svg');
    const out = join(dir, 'out.pdf');
    writeFileSync(inp, svg);
    execFileSync('rsvg-convert', ['-f', 'pdf', '-o', out, inp]);
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
