// /theme.css: the club's colours and fonts as CSS variables.
// Generated at build time from content/settings/site.json, served as a
// normal stylesheet so the Content Security Policy needs no inline styles.

import { getEntry } from 'astro:content';
import { fontFamilies } from '../lib/fonts.mjs';

export async function GET() {
  const { data: s } = await getEntry('settings', 'site');
  const fonts = fontFamilies(s.fonts);
  const css = `:root {
  --c-primary: ${s.colours.primary};
  --c-heading: ${s.colours.heading};
  --c-text: ${s.colours.text};
  --c-accent: ${s.colours.accent};
  --c-dark: ${s.colours.dark};
  --font-heading: ${fonts.heading};
  --font-body: ${fonts.body};
  --radius: ${s.look.corners === 'square' ? '0' : '10px'};
}
`;
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
