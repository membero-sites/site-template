// Turns editor Markdown into HTML at build time.
//
// Security: raw HTML and Markdown images are dropped. Editors format text
// with Markdown only. Images go through image blocks (which are optimised),
// and third-party content goes through the embed block (which is allowlisted).
// This means nothing an editor types can add scripts, iframes or styles.

import { Marked } from 'marked';

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
  },
});

export function renderMarkdown(source) {
  if (!source) return '';
  return marked.parse(source, { async: false });
}
