// Link helpers shared by the header, footer and blocks.

// Editors type either a page path ("/about") or a full address
// ("https://bookings.example.com"). Anything else fails the build.
export function linkProblem(href) {
  if (typeof href !== 'string' || href.length === 0) return 'Link is empty';
  if (href.startsWith('/')) return null;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return null;
  } catch {
    // fall through
  }
  return `"${href}" should be a page path like /about or a full address starting with https://`;
}

export function isExternal(href) {
  return /^https?:\/\//.test(href);
}

// Normalise "/about/" and "/about" so the menu can mark the current page.
export function samePath(a, b) {
  const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  return clean(a) === clean(b);
}
