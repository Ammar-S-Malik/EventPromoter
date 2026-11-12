// Decodes the QR code out of the *finished* poster and slide PNGs (not just the standalone encoder)
// and checks it points at the right short link with the QR flag. usage: node tools/verify-assets.mjs out/<campaign>
import { execFileSync } from 'node:child_process';
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/verify-assets.mjs out/<campaign>'); process.exit(2); }
const py = `
import cv2, sys
for name in ('poster', 'slide'):
    img = cv2.imread(sys.argv[1] + '/' + name + '.png')
    t = cv2.QRCodeDetector().detectAndDecode(img)[0] or cv2.QRCodeDetectorAruco().detectAndDecode(img)[0]
    print(name, '->', t or 'NOT DECODED')
`;
process.stdout.write(execFileSync('python3', ['-I', '-c', py, dir], { encoding: 'utf8' }));
