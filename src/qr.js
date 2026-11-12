// Dependency-free QR Code generator (ISO/IEC 18004): byte mode, error-correction level M,
// versions 1-10 (up to 213 bytes, plenty for a short link). Runs in Node and Workers.

// version -> [total codewords, EC codewords per block, number of blocks]  (level M)
const EC_M = {
  1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2], 5: [134, 24, 2],
  6: [172, 16, 4], 7: [196, 18, 4], 8: [242, 22, 4], 9: [292, 22, 5], 10: [346, 26, 5],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---- Reed-Solomon over GF(256), polynomial 0x11D
function gmul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gmul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gmul(root, 2);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    divisor.forEach((c, i) => (r[i] ^= gmul(c, f)));
  }
  return r;
}

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function encodeData(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const [total, ec, blocks] = EC_M[v];
    const capBits = (total - ec * blocks) * 8;
    if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= capBits) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error(`QR: ${bytes.length} bytes is too long (max 213)`);

  const [total, ecLen, nBlocks] = EC_M[version];
  const dataCw = total - ecLen * nBlocks;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCw * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataCw; pad ^= 0xec ^ 0x11) data.push(pad);

  // split into blocks (short blocks first), append EC, interleave
  const shortLen = Math.floor(dataCw / nBlocks);
  const nLong = dataCw % nBlocks;
  const div = rsDivisor(ecLen);
  const blocks = [];
  let k = 0;
  for (let i = 0; i < nBlocks; i++) {
    const len = shortLen + (i >= nBlocks - nLong ? 1 : 0);
    const d = data.slice(k, k + len);
    k += len;
    blocks.push({ d, e: rsRemainder(d, div) });
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => out.push(b.e[i]));
  return { version, codewords: out };
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
];

function penalty(m, size) {
  let p = 0;
  const FIND = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const FIND_R = [...FIND].reverse();
  const scan = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      for (let b = 0; b + 11 <= size; b++) {
        let f = true, r = true;
        for (let i = 0; i < 11; i++) {
          const v = get(a, b + i) ? 1 : 0;
          if (v !== FIND[i]) f = false;
          if (v !== FIND_R[i]) r = false;
        }
        if (f || r) p += 40;
      }
    }
  };
  scan((r, c) => m[r][c]);
  scan((c, r) => m[r][c]);
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++)
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const total = size * size;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

/** Encode text -> { size, modules: boolean[][] } (true = dark). */
export function qrEncode(text, { mask = null } = {}) {
  const { version, codewords } = encodeData(text);
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = v; fn[y][x] = true; }
  };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[version];
  al.forEach((cy, i) => al.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  const formatBits = (mask) => {
    const data = mask; // level M = 0b00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
    set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
    set(8, size - 8, true);
  };
  formatBits(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit(bits, i)); set(b, a, bit(bits, i));
    }
  }

  // place data bits in the zig-zag order
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < codewords.length * 8) {
          m[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7));
          idx++;
        }
      }
  }

  const applyMask = (k) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x];
  };
  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) {
    if (mask !== null && k !== mask) continue;
    applyMask(k); formatBits(k);
    const p = penalty(m, size);
    if (p < bestP) { bestP = p; best = k; }
    applyMask(k);
  }
  applyMask(best); formatBits(best);
  return { size, modules: m, version };
}

/**
 * SVG fragment for a QR code in a square of about `target` px at (x, y), with the required
 * 4-module quiet zone baked into a light background. Integer cell size keeps edges crisp.
 * Returns { svg, size } where size is the actual square side.
 */
export function qrSvg(text, { x, y, target, dark = '#000000', light = '#ffffff', quiet = 4, radius = 0 }) {
  const { size: n, modules } = qrEncode(text);
  const cell = Math.max(1, Math.floor(target / (n + 2 * quiet)));
  const side = cell * (n + 2 * quiet);
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!modules[r][c]) { c++; continue; }
      let e = c;
      while (e < n && modules[r][e]) e++;
      d += `M${x + (c + quiet) * cell} ${y + (r + quiet) * cell}h${(e - c) * cell}v${cell}h${-(e - c) * cell}z`;
      c = e;
    }
  }
  const svg =
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${radius}" fill="${light}"/>` +
    `<path d="${d}" fill="${dark}" shape-rendering="crispEdges"/>`;
  return { svg, size: side, modules: n, cell };
}
