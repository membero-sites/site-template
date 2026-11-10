#!/usr/bin/env node
// Internal link check, run after every build (see starter/amplify.yml).
//
// Reads every HTML file in the build output and checks that each link or
// image pointing inside the site (starting with "/") exists. If any are
// broken, it lists them and exits with an error, which fails the build so
// the last good version of the site stays live.
//
// Usage: membero-check-links [folder]   (default: dist)
// External links are checked separately in GitHub Actions, because other
// sites going down shouldn't block a club's content edit.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? 'dist';

// Every .html file under the output folder.
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

// Internal addresses from href, src and srcset attributes.
function internalLinks(html) {
  const found = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) found.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) found.push(part.trim().split(/\s+/)[0]);
  }
  return found.filter((u) => u.startsWith('/') && !u.startsWith('//'));
}

// "/about/" exists if dist/about/index.html or dist/about exists.
function exists(url) {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const target = join(root, path);
  if (path.endsWith('/')) return existsSync(join(target, 'index.html'));
  return existsSync(target) || existsSync(join(target, 'index.html'));
}

if (!existsSync(root)) {
  console.error(`check-links: output folder "${root}" not found. Run the build first.`);
  process.exit(1);
}

const broken = [];
const files = htmlFiles(root);
for (const file of files) {
  const page = '/' + relative(root, file).replace(/index\.html$/, '');
  for (const url of new Set(internalLinks(readFileSync(file, 'utf8')))) {
    if (!exists(url)) broken.push(`  on ${page}: ${url}`);
  }
}

if (broken.length > 0) {
  console.error(`check-links: ${broken.length} broken internal link(s):`);
  console.error(broken.join('\n'));
  console.error('Fix the link in the page or menu, or create the missing page.');
  process.exit(1);
}
console.log(`check-links: ${files.length} pages checked, no broken internal links.`);
