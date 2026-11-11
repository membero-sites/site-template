// Colour helpers used by the content schema to enforce readable text.
// WCAG 2.1 contrast ratio: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
// 4.5:1 is the AA minimum for normal-size text.

export const MIN_TEXT_CONTRAST = 4.5;

// Accepts "#RRGGBB" only. The schema rejects anything else before this runs.
function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// The tint band background, fixed in the template (styles/global.css --c-soft).
export const TINT = '#F1F5F8';

// Pairs that must stay readable. Each entry: [label, foreground, background].
// Text appears on white and on the tint band, so both are checked.
export function contrastProblems(colours) {
  const white = '#FFFFFF';
  const checks = [
    ['Links and buttons on white', colours.primary, white],
    ['Links on the tint background', colours.primary, TINT],
    ['White text on buttons and the booking band', white, colours.primary],
    ['Headings on the tint background', colours.heading, TINT],
    ['Body text on the tint background', colours.text, TINT],
    ['White text on the footer and dark sections', white, colours.dark],
  ];
  return checks
    .map(([label, fg, bg]) => ({ label, ratio: contrast(fg, bg) }))
    .filter((c) => c.ratio < MIN_TEXT_CONTRAST)
    .map((c) => `${c.label}: contrast ${c.ratio.toFixed(2)}:1, needs ${MIN_TEXT_CONTRAST}:1`);
}
