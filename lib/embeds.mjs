// Third-party content the template is allowed to show.
//
// Anything not on these lists fails the build, so an editor cannot embed
// an arbitrary site. The same hosts are added to the page's Content
// Security Policy (frame-src) in index.mjs. To allow a new provider, add it
// here, in the template, and release a new template version.

// Hosts allowed in the generic embed block, keyed by the host editors paste.
// Each entry says which host the iframe actually loads from.
export const EMBED_HOSTS = {
  'docs.google.com': { frameHost: 'docs.google.com', pathPrefix: '/forms/' },
  'forms.gle': null, // Short links can't be embedded; schema explains why.
  'www.youtube.com': { frameHost: 'www.youtube-nocookie.com' },
  'youtube.com': { frameHost: 'www.youtube-nocookie.com' },
  'youtu.be': { frameHost: 'www.youtube-nocookie.com' },
  'vimeo.com': { frameHost: 'player.vimeo.com' },
  'player.vimeo.com': { frameHost: 'player.vimeo.com' },
  'www.openstreetmap.org': { frameHost: 'www.openstreetmap.org' },
};

// Every host an iframe may load from. Used for the CSP frame-src directive.
export const FRAME_HOSTS = [
  'https://docs.google.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.openstreetmap.org',
];

// Returns an error message, or null if the URL can be embedded.
export function embedProblem(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return `"${raw}" is not a valid web address`;
  }
  if (url.protocol !== 'https:') return `"${raw}" must start with https://`;
  const rule = EMBED_HOSTS[url.hostname];
  if (rule === undefined) {
    return `"${url.hostname}" is not an allowed embed. Allowed: Google Forms, YouTube, Vimeo, OpenStreetMap`;
  }
  if (rule === null) {
    return 'Google Forms short links (forms.gle) cannot be embedded. Open the form, choose Send > <> (embed), and paste the docs.google.com address';
  }
  if (rule.pathPrefix && !url.pathname.startsWith(rule.pathPrefix)) {
    return `Only ${url.hostname}${rule.pathPrefix}... addresses can be embedded`;
  }
  return null;
}

// Converts a pasted YouTube or Vimeo page address into its privacy-friendly
// player address. Returns null if it isn't a recognised video link.
export function videoEmbedUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname;
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  if (host === 'www.youtube.com' || host === 'youtube.com') {
    id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] || null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vid = url.pathname.match(/(\d{5,})/)?.[1];
    if (vid) return `https://player.vimeo.com/video/${vid}?dnt=1`;
  }
  return null;
}

// Google Forms needs "?embedded=true" to display without its own page frame.
export function embedSrc(raw) {
  const url = new URL(raw);
  const video = videoEmbedUrl(raw);
  if (video) return video;
  if (url.hostname === 'docs.google.com') url.searchParams.set('embedded', 'true');
  return url.toString();
}

// OpenStreetMap embed for a map block: a small box around the marker.
export function osmEmbedUrl(lat, lon, zoom = 16) {
  // Box size shrinks as zoom grows. 0.6 degrees at zoom 10 is a sensible start.
  const span = 0.6 / 2 ** (zoom - 10);
  const bbox = [lon - span, lat - span / 2, lon + span, lat + span / 2].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

export function directionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
