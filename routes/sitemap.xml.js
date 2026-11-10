// /sitemap.xml: every published page, for search engines.

import { getCollection, getEntry } from 'astro:content';

export async function GET() {
  const { data: s } = await getEntry('settings', 'site');
  const base = s.url.replace(/\/+$/, '');
  const pages = await getCollection('pages', (p) => !p.data.hidden);
  const urls = pages
    .map((p) => (p.id === 'home' ? `${base}/` : `${base}/${p.id}/`))
    .sort()
    .map((loc) => `  <url><loc>${loc}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
