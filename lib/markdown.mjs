// Turns editor Markdown into HTML at build time.
//
// Security: raw HTML and Markdown images are dropped. Editors format text
// with Markdown only. Images go through image blocks (which are optimised),
// and third-party content goes through the embed block (which is allowlisted).
// This means nothing an editor types can add scripts, iframes or styles.
//
// Reliability: a link in the text to a page on this site that doesn't exist
// (or is hidden) is shown as plain text with a build warning, instead of
// failing the build's link check.

import { Marked } from 'marked';
import { publishedPages, warn } from './targets.mjs';

function internalPageMissing(href) {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '');
  if (path === '') return false; // the home page
  return !publishedPages().has(path.slice(1));
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Drop raw HTML blocks and inline HTML.
    html() {
      return '';
    },
    // Drop Markdown images; use an image block instead.
    image() {
      return '';
    },
    // Unlink links to pages that don't exist; use the default otherwise.
    link(token) {
      if (internalPageMissing(token.href)) {
        warn(`Text link "${token.text}" goes to ${token.href}, which isn't a page on this site, so it was shown as plain text.`);
        return this.parser.parseInline(token.tokens);
      }
      return false;
    },
  },
});

export function renderMarkdown(source) {
  if (!source) return '';
  return marked.parse(source, { async: false });
}
