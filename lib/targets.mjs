// Links and images that might point at something that no longer exists.
//
// Editors rename pages and delete photos in Pages CMS. Neither should take
// the whole site down, so instead of failing the build:
//   - a link to a page that doesn't exist (or is hidden) is left out, and
//   - a missing photo is left out of lists, or replaced by a grey
//     "image missing" placeholder where one photo is required.
// Each case prints a "[membero] WARNING" line in the build log, which the
// runbook explains how to find.
//
// Content files always sit two folders deep (content/pages/x.md,
// content/settings/site.json), so "../../media/x.jpg" is resolved from
// content/pages for every file.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const ROOT = process.cwd();
const PAGES_DIR = resolve(ROOT, 'content/pages');

// Placeholder shipped with the template, relative to a content file.
export const PLACEHOLDER_IMAGE = '../../node_modules/@membero/site-template/assets/missing-image.png';

export function warn(message) {
  console.warn(`[membero] WARNING: ${message}`);
}

// ---------- Pages ----------

// Published page ids (file names without .md), read once per build.
// A page with "hidden: true" in its front matter isn't published.
let published = null;
export function publishedPages() {
  if (published) return published;
  published = new Set();
  if (!existsSync(PAGES_DIR)) return published;
  for (const file of readdirSync(PAGES_DIR)) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(resolve(PAGES_DIR, file), 'utf8');
    const front = text.split(/^---\s*$/m)[1] ?? '';
    if (/^hidden:\s*true\s*$/m.test(front)) continue;
    published.add(file.slice(0, -3));
  }
  return published;
}

// "content/pages/about-us.md", "about-us.md", "/about-us/" -> "about-us"
function pageId(value) {
  const name = basename(String(value).trim().replace(/\/+$/, '')) || 'home';
  return name.replace(/\.md$/, '');
}

export function pageHref(id) {
  return id === 'home' ? '/' : `/${id}`;
}

// Turns what an editor chose into an address, or undefined if it leads
// nowhere. `page` is a Pages CMS page reference; `url` is a typed address,
// meant for other websites, email (mailto:) or phone (tel:).
// A typed address starting with "/" is treated as a page on this site and
// must match a page file.
export function resolveTarget(page, url, where) {
  if (page) {
    const id = pageId(page);
    if (publishedPages().has(id)) return pageHref(id);
    warn(`${where}: page "${page}" doesn't exist or is hidden, so the link was left out.`);
    return undefined;
  }
  if (!url) return undefined;
  const value = String(url).trim();
  if (value === '/' ) return '/';
  if (value.startsWith('/')) {
    const id = pageId(value.split(/[?#]/)[0]);
    if (publishedPages().has(id)) return pageHref(id) + (value.match(/[?#].*$/)?.[0] ?? '');
    warn(`${where}: "${value}" isn't a page on this site, so the link was left out. Choose the page instead of typing its address.`);
    return undefined;
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  warn(`${where}: "${value}" isn't a full address (https://...), so the link was left out.`);
  return undefined;
}

// ---------- Images ----------

export function imageExists(value) {
  if (typeof value !== 'string' || value === '') return false;
  return existsSync(resolve(PAGES_DIR, value));
}
