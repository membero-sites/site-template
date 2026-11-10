// The Membero site template, packaged as an Astro integration.
//
// A club repo's astro.config.mjs is always the same two lines:
//
//   import { defineConfig } from 'astro/config';
//   import membero from '@membero/site-template';
//   export default defineConfig({ integrations: [membero()] });
//
// This integration then:
//   1. Adds the template's routes (every page, 404, theme.css, sitemap, robots.txt).
//   2. Reads the club's settings to set the site address, fonts and the
//      Content Security Policy (which hosts may serve images and iframes).
//   3. Sets build options that keep the output static, self-contained and
//      compatible with a strict Content Security Policy.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FRAME_HOSTS } from './lib/embeds.mjs';
import { fontImports } from './lib/fonts.mjs';

const route = (path) => new URL(path, import.meta.url);

// Read a JSON settings file from the club repo. Content schemas validate
// these files properly later in the build; here we only need a few values.
function readJson(root, relPath, fallback) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, 'utf8'));
}

// Origins (scheme + host) of enabled snow camera images, for img-src.
function snowcamOrigins(cams) {
  const origins = new Set();
  for (const cam of cams?.cameras ?? []) {
    try {
      const url = new URL(cam.url);
      if (url.protocol === 'https:') origins.add(url.origin);
    } catch {
      // Invalid addresses are reported by the content schema.
    }
  }
  return [...origins];
}

export default function membero() {
  return {
    name: '@membero/site-template',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, injectScript, updateConfig }) => {
        const root = config.root.pathname;
        const site = readJson(root, 'content/settings/site.json', {});
        const cams = readJson(root, 'content/settings/snowcams.json', { cameras: [] });

        // Routes. Order doesn't matter; Astro picks the most specific match.
        injectRoute({ pattern: '/[...slug]', entrypoint: route('./routes/page.astro') });
        injectRoute({ pattern: '/404', entrypoint: route('./routes/404.astro') });
        injectRoute({ pattern: '/theme.css', entrypoint: route('./routes/theme.css.js') });
        injectRoute({ pattern: '/sitemap.xml', entrypoint: route('./routes/sitemap.xml.js') });
        injectRoute({ pattern: '/robots.txt', entrypoint: route('./routes/robots.txt.js') });

        // Only the chosen font pair is bundled.
        for (const css of fontImports(site.fonts)) {
          injectScript('page-ssr', `import '${css}';`);
        }

        updateConfig({
          site: site.url,
          output: 'static',
          trailingSlash: 'ignore',
          build: {
            format: 'directory',
            // Stylesheets as files, not inline, so the CSP stays simple.
            inlineStylesheets: 'never',
          },
          vite: {
            build: {
              // Never turn small files into data: URLs; everything is served
              // from the site itself.
              assetsInlineLimit: 0,
            },
          },
          security: {
            // Astro adds a <meta> CSP to every page, with hashes for any
            // script or style it generates. Hosting adds the headers a meta
            // tag can't carry (see starter/customHttp.yml).
            csp: {
              // Set explicitly: updateConfig doesn't fill in Astro's defaults.
              algorithm: 'SHA-256',
              directives: [
                "default-src 'self'",
                `img-src 'self' ${snowcamOrigins(cams).join(' ')}`.trim(),
                "font-src 'self'",
                `frame-src ${FRAME_HOSTS.join(' ')}`,
                "connect-src 'self'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ],
            },
          },
        });
      },
    },
  };
}
