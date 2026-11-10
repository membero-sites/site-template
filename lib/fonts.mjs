// Curated font pairs. Fonts are self-hosted from npm packages (no calls to
// Google Fonts or any other font server). Only the pair a club picks is
// bundled into its site.
//
// To add a pair: add the @fontsource-variable package to package.json
// (exact version), add an entry here, and add the option to the starter
// .pages.yml.

const STACK_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const STACK_SERIF = 'Georgia, "Times New Roman", serif';

const FONTS = {
  montserrat: { family: '"Montserrat Variable"', css: '@fontsource-variable/montserrat/wght.css', stack: STACK_SANS },
  'source-sans': { family: '"Source Sans 3 Variable"', css: '@fontsource-variable/source-sans-3/wght.css', stack: STACK_SANS },
  inter: { family: '"Inter Variable"', css: '@fontsource-variable/inter/wght.css', stack: STACK_SANS },
  lora: { family: '"Lora Variable"', css: '@fontsource-variable/lora/wght.css', stack: STACK_SERIF },
};

export const FONT_PAIRS = {
  'montserrat-source-sans': { heading: 'montserrat', body: 'source-sans', label: 'Montserrat headings, Source Sans text' },
  'inter': { heading: 'inter', body: 'inter', label: 'Inter throughout' },
  'lora-source-sans': { heading: 'lora', body: 'source-sans', label: 'Lora headings, Source Sans text' },
  'montserrat-inter': { heading: 'montserrat', body: 'inter', label: 'Montserrat headings, Inter text' },
  'system': { heading: null, body: null, label: 'Device fonts (fastest)' },
};

export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS);

// CSS files to bundle for a pair.
export function fontImports(pairId) {
  const pair = FONT_PAIRS[pairId] ?? FONT_PAIRS.system;
  return [...new Set([pair.heading, pair.body].filter(Boolean).map((f) => FONTS[f].css))];
}

// CSS font-family values for a pair.
export function fontFamilies(pairId) {
  const pair = FONT_PAIRS[pairId] ?? FONT_PAIRS.system;
  const fam = (f) => (f ? `${FONTS[f].family}, ${FONTS[f].stack}` : STACK_SANS);
  return { heading: fam(pair.heading), body: fam(pair.body) };
}
