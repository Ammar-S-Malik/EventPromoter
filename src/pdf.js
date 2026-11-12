// Print PDF from a rendered PNG. Image-based (not vector): the poster is rendered at 150 dpi and
// placed on an 11 x 17 in page, which prints sharply but its text is not selectable.

import { PDFDocument } from 'pdf-lib';

export async function pngToPdf(png, { widthIn, heightIn, title = 'Poster' }) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('EventPromoter');
  const w = widthIn * 72, h = heightIn * 72;
  const page = doc.addPage([w, h]);
  const img = await doc.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  return doc.save();
}
