// Renders QR codes at many lengths (versions 1-10) and decodes them with OpenCV to prove they scan.
// usage: node tools/verify-qr.mjs   (needs python3 + cv2)
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { qrSvg, qrEncode } from '../src/qr.js';

const dir = mkdtempSync(join(tmpdir(), 'qrv-'));
const cases = [];
for (const len of [5, 17, 32, 53, 78, 106, 134, 154, 178, 213]) {
  const base = `https://go.example/r/${len}/`;
  cases.push(base + 'x'.repeat(Math.max(0, len - base.length)));
}
cases.push('https://nsu.example/r/Ab3xK9', 'Welcome Week – café ☕');
const manifest = [];
// Several print sizes each: a scanner must read it at any of them.
for (const target of [240, 330, 420]) for (const [i, text] of cases.entries()) {
  const { svg, size } = qrSvg(text, { x: 0, y: 0, target });
  const file = join(dir, `${target}-${i}.png`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${svg}</svg>`)).png().toFile(file);
  manifest.push({ file, text, version: qrEncode(text).version, target });
}
writeFileSync(join(dir, 'm.json'), JSON.stringify(manifest));
const py = `
import cv2, json, sys
ok = 0
for c in json.load(open(sys.argv[1])):
    img = cv2.imread(c['file'])
    img = cv2.copyMakeBorder(img, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=(255,255,255))
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    good = text == c['text']
    if not good:  # OpenCV's default detector is scale-sensitive; cross-check with the Aruco-based one
        text2, _, _ = cv2.QRCodeDetectorAruco().detectAndDecode(img)
        good = text2 == c['text']
    ok += good
    print(('PASS' if good else 'FAIL'), 'v%d' % c['version'], len(c['text'].encode()), 'bytes @', c['target'], 'px')
print(ok, 'of', len(json.load(open(sys.argv[1]))), 'decoded correctly')
sys.exit(0 if ok == len(json.load(open(sys.argv[1]))) else 1)
`;
try {
  console.log(execFileSync('python3', ['-I', '-c', py, join(dir, 'm.json')], { encoding: 'utf8' }));
} catch (e) {
  console.log(e.stdout); process.exit(1);
}
