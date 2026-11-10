// /robots.txt
//
// Search engines are blocked unless the hosting build has the environment
// variable SITE_INDEXING=on. Preview sites stay out of search results.
// Set SITE_INDEXING=on in Amplify when a site goes live (cutover checklist).

import { getEntry } from 'astro:content';

export async function GET() {
  const { data: s } = await getEntry('settings', 'site');
  const indexing = process.env.SITE_INDEXING === 'on';
  const body = indexing
    ? `User-agent: *\nAllow: /\n\nSitemap: ${s.url.replace(/\/+$/, '')}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
