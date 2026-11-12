// Output formats. `safe` is the rectangle all text must stay inside
// (platform UI overlays for stories, print trim for the poster).
// `p` holds the layout parameters for the format's template (sizes in canvas px).

export const FORMATS = {
  'ig-post': {
    label: 'Instagram post', layout: 'stack', w: 1080, h: 1080,
    safe: { top: 70, right: 70, bottom: 70, left: 70 }, minText: 24,
    p: {
      m: 80, top: 76, bottom: 76, gap: 28, logo: 26, cat: 24,
      titleMax: 104, titleMin: 52, titleLines: 4, titleW: 0.6,
      tagMax: 30, tagMin: 24, tagLines: 2, tagW: 0.62,
      art: { x: 0.58, y: 120, s: 440 }, highlights: false,
      cardH: 200, cardPad: 20, iconR: 24, label: 24, value: 34, valueMin: 24, shadow: 9,
      ctaH: 92, ctaSize: 32, hashtag: 0,
      hexTR: { x: 1010, y: 40, r: 70 }, hexBL: { x: -30, y: 1010, r: 60 },
    },
  },
  'ig-story': {
    label: 'Instagram story', layout: 'stack', w: 1080, h: 1920,
    safe: { top: 250, right: 70, bottom: 340, left: 70 }, minText: 28,
    p: {
      m: 84, top: 262, bottom: 350, gap: 40, logo: 32, cat: 30,
      titleMax: 140, titleMin: 56, titleLines: 5, titleW: 0.66,
      tagMax: 44, tagMin: 30, tagLines: 3, tagW: 1,
      art: { x: 0.6, y: 300, s: 420 }, highlights: true, hlH: 200, hlR: 54, hlSize: 30, hlMin: 28,
      cardH: 262, cardPad: 24, iconR: 28, label: 28, value: 42, valueMin: 28, shadow: 11,
      ctaH: 120, ctaSize: 40, hashtag: 0,
      hexTR: { x: 1020, y: 150, r: 90 }, hexBL: { x: -20, y: 1820, r: 90 },
    },
  },
  poster: {
    label: 'Poster 11x17 in', layout: 'stack', w: 1100, h: 1700, widthIn: 11, heightIn: 17,
    safe: { top: 60, right: 60, bottom: 60, left: 60 }, minText: 24,
    p: {
      m: 90, top: 100, bottom: 84, gap: 36, logo: 32, cat: 30,
      titleMax: 140, titleMin: 60, titleLines: 6, titleW: 0.62,
      tagMax: 44, tagMin: 30, tagLines: 3, tagW: 0.62,
      art: { x: 0.6, y: 120, s: 400 }, highlights: true, hlH: 210, hlR: 54, hlSize: 30, hlMin: 24,
      cardH: 236, cardPad: 24, iconR: 28, label: 26, value: 40, valueMin: 26, shadow: 12,
      ctaH: 112, ctaSize: 40, hashtag: 30, qr: 270, qrCaption: 28,
      hexTR: { x: 1040, y: 60, r: 100 }, hexBL: { x: -10, y: 1660, r: 70 },
    },
  },
  slide: {
    label: 'Presentation slide 16:9', layout: 'split', w: 1920, h: 1080,
    safe: { top: 70, right: 70, bottom: 70, left: 70 }, minText: 28,
    p: {
      m: 110, panel: 1240, top: 96, bottom: 96, gap: 36, logo: 32, cat: 30,
      titleMax: 120, titleMin: 60, titleLines: 3,
      tagMax: 40, tagMin: 30, tagLines: 2,
      cardH: 230, cardPad: 24, iconR: 28, label: 28, value: 40, valueMin: 28, shadow: 12,
      ctaH: 108, ctaSize: 36, qr: 300, qrCaption: 34,
    },
  },
  banner: {
    label: 'Digital screen banner', layout: 'strip', w: 1920, h: 480,
    safe: { top: 40, right: 60, bottom: 40, left: 60 }, minText: 24,
    p: {
      m: 80, panel: 1290, logo: 24, titleMax: 88, titleMin: 44, titleLines: 2, tagMax: 32, tagMin: 24,
      value: 36, valueMin: 24, ctaH: 84, ctaSize: 28,
    },
  },
};

export const FORMAT_KEYS = Object.keys(FORMATS);
