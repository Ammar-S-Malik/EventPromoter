// Output formats. `safe` is the rectangle all text must stay inside
// (platform UI overlays for stories, print trim for the poster).

export const FORMATS = {
  'ig-post': {
    label: 'Instagram post', layout: 'stack', w: 1080, h: 1080,
    safe: { top: 70, right: 70, bottom: 70, left: 70 }, minText: 24,
    p: { m: 90, top: 110, bottom: 90, eyebrow: 28, titleMax: 128, titleMin: 56, titleLines: 4, tagMax: 38, tagMin: 26, infoLabel: 24, infoValue: 36, infoValueMin: 26, ctaH: 100, ctaSize: 34 },
  },
  'ig-story': {
    label: 'Instagram story', layout: 'stack', w: 1080, h: 1920,
    safe: { top: 250, right: 70, bottom: 340, left: 70 }, minText: 28,
    p: { m: 90, top: 270, bottom: 360, eyebrow: 30, titleMax: 150, titleMin: 64, titleLines: 5, tagMax: 44, tagMin: 30, infoLabel: 28, infoValue: 42, infoValueMin: 30, ctaH: 120, ctaSize: 38 },
  },
  poster: {
    label: 'Poster 11x17 in', layout: 'stack', w: 1100, h: 1700, widthIn: 11, heightIn: 17,
    safe: { top: 60, right: 60, bottom: 60, left: 60 }, minText: 24,
    p: { m: 90, top: 110, bottom: 90, eyebrow: 32, titleMax: 170, titleMin: 70, titleLines: 5, tagMax: 46, tagMin: 30, infoLabel: 24, infoValue: 48, infoValueMin: 32, ctaH: 140, ctaSize: 42, qr: 260 },
  },
  slide: {
    label: 'Presentation slide 16:9', layout: 'split', w: 1920, h: 1080,
    safe: { top: 70, right: 70, bottom: 70, left: 70 }, minText: 28,
    p: { m: 110, panel: 1230, top: 120, bottom: 110, eyebrow: 32, titleMax: 120, titleMin: 60, titleLines: 3, tagMax: 44, tagMin: 30, infoLabel: 28, infoValue: 40, infoValueMin: 30, ctaSize: 38, qr: 300 },
  },
  banner: {
    label: 'Digital screen banner', layout: 'strip', w: 1920, h: 480,
    safe: { top: 40, right: 60, bottom: 40, left: 60 }, minText: 24,
    p: { m: 80, panel: 1200, eyebrow: 24, titleMax: 96, titleMin: 44, titleLines: 2, tagMax: 34, tagMin: 24, infoValue: 40, infoValueMin: 26, ctaSize: 30 },
  },
};

export const FORMAT_KEYS = Object.keys(FORMATS);
