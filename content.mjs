// Content schemas for club sites.
//
// Every club repo has a one-line src/content.config.ts that re-exports
// `collections` from here. Content that doesn't fit is repaired or left out
// with a build warning, never a build failure (see "The rule" below).
//
// Folder layout in a club repo (all content files sit two folders deep so
// image paths written by Pages CMS, "../../media/...", resolve the same way):
//   content/settings/site.json      site-wide settings
//   content/settings/snowcams.json  snow camera list
//   content/pages/*.md              one file per page; home.md is "/"
//   media/                          uploaded images
//
// Keep the Pages CMS config (starter/.pages.yml) in step with this file.

import { defineCollection } from 'astro/content/config';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { safeColours } from './lib/colour.mjs';
import { embedProblem, videoEmbedUrl } from './lib/embeds.mjs';
import { FONT_PAIR_IDS } from './lib/fonts.mjs';
import { resolveTarget, imageExists, warn, PLACEHOLDER_IMAGE } from './lib/targets.mjs';

// ---------- The rule: no Pages CMS save can fail a build ----------
// Editors never see build errors, so every field is either filled in with a
// sensible default, or the section or list entry that can't be shown is left
// out. Each fallback prints a "[membero] WARNING" line in the build log
// (see docs/RUNBOOK.md). Fields the template needs are also marked required
// in starter/.pages.yml so the editor asks for them before saving.

// First problem in a zod error, in words, for warnings.
const firstIssue = (error) => {
  const i = error.issues[0];
  return i ? `${i.path.length ? i.path.join(' > ') + ': ' : ''}${i.message}` : 'invalid';
};

// Editors sometimes add a list entry and leave it blank (for example a
// second question with nothing in it). Blank entries are dropped silently.
function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === 'object') return Object.values(value).every(isBlank);
  return false; // numbers and booleans count as filled in
}
const withoutBlanks = (v) => (Array.isArray(v) ? v.filter((item) => !isBlank(item)) : v);

// A list where each entry is checked on its own. Entries that can't be used
// are left out with a warning; the rest of the list (and the page) is kept.
// `label` describes an entry for the warning, for example its heading.
const keepValid = (item, where, label = () => '') =>
  z
    .preprocess(withoutBlanks, z.array(z.unknown()).nullish().catch([]))
    .transform((entries) =>
      (entries ?? []).flatMap((entry, i) => {
        const result = item.safeParse(entry);
        if (result.success) return [result.data];
        warn(`${where} ${i + 1}${label(entry)} was left out (${firstIssue(result.error)}).`);
        return [];
      }),
    );

// Same, but the list needs at least one usable entry. If none is left, the
// section holding the list is left out instead.
const atLeastOne = (item, where, label) =>
  keepValid(item, where, label).pipe(z.array(z.any()).min(1, `no usable ${where.toLowerCase()} entries`));

// A value that falls back to a default (with a warning) when unusable.
const orDefault = (schema, fallback, where) =>
  schema.catch((ctx) => {
    warn(`${where}: ${ctx.value ? `"${ctx.value}" isn't valid` : 'is empty'}, using "${fallback}".`);
    return fallback;
  });

const httpsUrl = z.string().superRefine((value, ctx) => {
  try {
    if (new URL(value).protocol === 'https:') return;
  } catch {
    // fall through
  }
  ctx.addIssue({ code: 'custom', message: `"${value}" must be a full address starting with https://` });
});

// Optional text that editors may leave blank in the CMS (saved as "" or null).
const optionalText = z
  .unknown()
  .optional()
  .transform((v) => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined));

// Text that's required for an entry to make sense (a question, a role...).
const requiredText = z
  .unknown()
  .optional()
  .transform((v) => (typeof v === 'number' ? String(v) : v))
  .pipe(z.string().trim().min(1, 'is empty'));

// Body text: blank is fine.
const bodyText = z.unknown().optional().transform((v) => (typeof v === 'string' ? v : ''));

// Image descriptions should always be filled in (the editor asks for them);
// a missing one is treated as a decorative image, with a warning.
const altText = (where) =>
  z.unknown().optional().transform((v) => {
    if (typeof v === 'string' && v.trim()) return v;
    warn(`${where}: a photo has no description. Add one for screen-reader users.`);
    return '';
  });

// A number that may be blank or typed as text.
const numberOrNull = (min, max) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().min(min).max(max).nullable().catch(null),
  );

const yes = (fallback) => z.boolean().nullish().catch(fallback).transform((v) => v ?? fallback);

// ---------- Links ----------
// Editors choose a page from a list ("page", a Pages CMS reference to the
// page file) or type an address for another website ("url"). Older content
// may still have a typed "link". All three are turned into one "link" here.
// A link to a page that doesn't exist is left out with a build warning
// (lib/targets.mjs), so a renamed page can't fail the build.

const text = optionalText;

// Fields for one link, named with a prefix: link fields ("page", "url",
// "link") or button fields ("buttonPage", "buttonUrl", "buttonLink").
const linkFields = (prefix = '') => {
  const key = (k) => (prefix ? prefix + k[0].toUpperCase() + k.slice(1) : k);
  return { [key('page')]: text, [key('url')]: text, [key('link')]: text };
};
const resolveFields = (obj, prefix, where) => {
  const key = (k) => (prefix ? prefix + k[0].toUpperCase() + k.slice(1) : k);
  const page = obj[key('page')];
  const typed = obj[key('url')] || obj[key('link')];
  const out = { ...obj };
  delete out[key('page')];
  delete out[key('url')];
  out[key('link')] = resolveTarget(page, typed, where);
  return out;
};

// A labelled link (menu, footer links, buttons on a photo). Items with no
// label, or whose target can't be found, are left out.
const linkItem = (where) =>
  z
    .object({ label: requiredText, ...linkFields() })
    .transform((i) => resolveFields(i, '', `${where} "${i.label}"`));
const linkList = (where) =>
  keepValid(linkItem(where), where, (v) => (v?.label ? ` "${v.label}"` : '')).transform((items) =>
    items.filter((i) => i.link),
  );

// ---------- Images ----------
// A photo that has been deleted or renamed must not fail the build.
// Required photos fall back to a grey "image missing" placeholder; optional
// photos and photos in lists are left out. Both print a build warning.

const requiredImage = (image, where) =>
  z.preprocess((v) => {
    if (imageExists(v)) return v;
    warn(`${where}: photo "${v ?? ''}" not found, showing a placeholder. Upload it again or choose another photo.`);
    return PLACEHOLDER_IMAGE;
  }, image());

const optionalImage = (image, where = 'A section') =>
  z.preprocess((v) => {
    if (!v) return undefined;
    if (imageExists(v)) return v;
    warn(`${where}: photo "${v}" not found, so it was left out.`);
    return undefined;
  }, image().optional());

// A list of photos (top of page): missing ones are left out.
const imageList = (image, where) =>
  z.preprocess(
    (v) =>
      (Array.isArray(v) ? v : []).filter((p) => {
        if (!p) return false;
        if (imageExists(p)) return true;
        warn(`${where}: photo "${p}" not found, so it was left out.`);
        return false;
      }),
    z.array(image()),
  );

// ---------- Blocks ----------
// Each block has a "type" (what Pages CMS stores as the block key), an
// optional heading and, in full-width pages, a background band.
// A block that can't be shown (for example a map with no address) is left
// out with a warning; the rest of the page still builds.
// Add new block types here, in components/Blocks.astro, and in
// starter/.pages.yml (and in tests/edge-cases.mjs).

function blockSchemas(image) {
  const common = {
    heading: optionalText,
    // white, tint (light grey-blue) or dark (the club's dark colour).
    // Ignored in the sidebar.
    background: z.enum(['white', 'tint', 'dark']).nullish().catch('white').transform((v) => v ?? 'white'),
  };

  return z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('text'), ...common, body: bodyText }),

      z.object({
        type: z.literal('image'),
        ...common,
        image: requiredImage(image, 'Image section'),
        alt: altText('Image section'),
        caption: optionalText,
      }),

      z.object({
        type: z.literal('imageText'),
        ...common,
        image: requiredImage(image, 'Image with text section'),
        alt: altText('Image with text section'),
        body: bodyText,
        imagePosition: z.enum(['left', 'right']).catch('left'),
        buttonLabel: optionalText,
        ...linkFields('button'),
      }),

      // A big photo across the full width of the screen, between sections.
      z.object({
        type: z.literal('photo'),
        ...common,
        image: requiredImage(image, 'Full-width photo'),
        alt: altText('Full-width photo'),
        caption: optionalText,
        height: z.enum(['medium', 'tall']).catch('medium'),
      }),

      z.object({
        type: z.literal('gallery'),
        ...common,
        images: keepValid(
          z.object({ image: optionalImage(image, 'Gallery'), alt: altText('Gallery'), caption: optionalText }),
          'Gallery photo',
        )
          .transform((l) => l.filter((i) => i.image))
          .pipe(z.array(z.any()).min(1, 'no photos')),
      }),

      z.object({
        type: z.literal('lodgeCards'),
        ...common,
        intro: optionalText,
        cards: atLeastOne(
          z.object({
            title: requiredText,
            location: optionalText, // for example "Mt Buller, 1,600 m"
            image: optionalImage(image, 'Lodge card'),
            alt: optionalText,
            body: bodyText,
            ...linkFields(),
            linkLabel: optionalText,
          }),
          'Lodge card',
          (v) => (v?.title ? ` "${v.title}"` : ''),
        ),
      }),

      // Key details about a lodge: beds, rooms, season, altitude, parking...
      z.object({
        type: z.literal('facts'),
        ...common,
        items: atLeastOne(z.object({ label: requiredText, value: requiredText }), 'Fact'),
      }),

      // The button only shows when it has both text and a working link.
      z.object({
        type: z.literal('cta'),
        ...common,
        body: bodyText,
        buttonLabel: optionalText,
        ...linkFields('button'),
      }),

      z.object({
        type: z.literal('map'),
        ...common,
        name: optionalText,
        address: requiredText,
        // Coordinates are optional. Without them the block shows the address
        // and a Directions link but no map.
        latitude: numberOrNull(-90, 90),
        longitude: numberOrNull(-180, 180),
        zoom: z.coerce.number().int().min(10).max(19).catch(16),
      }),

      z.object({
        type: z.literal('video'),
        ...common,
        url: z.string().refine((v) => videoEmbedUrl(v) !== null, 'not a YouTube or Vimeo address'),
        title: requiredText.catch('Video'),
      }),

      z.object({
        type: z.literal('faq'),
        ...common,
        items: atLeastOne(z.object({ question: requiredText, answer: requiredText }), 'Question'),
      }),

      z.object({
        type: z.literal('tariffTable'),
        ...common,
        caption: optionalText,
        columns: keepValid(requiredText, 'Column heading').pipe(z.array(z.string()).min(1, 'no column headings')),
        rows: atLeastOne(
          z.object({ cells: z.array(z.unknown()).nullish().transform((c) => (c ?? []).map((v) => (v == null ? '' : String(v)))) }),
          'Table row',
        ),
        note: optionalText,
      }),

      z.object({
        type: z.literal('embed'),
        ...common,
        url: z.string().superRefine((value, ctx) => {
          const problem = embedProblem(value);
          if (problem) ctx.addIssue({ code: 'custom', message: problem });
        }),
        title: requiredText.catch('Embedded content'),
        height: z.coerce.number().int().min(200).max(2000).catch(800),
      }),

      z.object({
        type: z.literal('contactList'),
        ...common,
        items: atLeastOne(
          z.object({ role: requiredText, name: optionalText, email: optionalText, phone: optionalText, note: optionalText }),
          'Contact',
        ),
      }),

      z.object({ type: z.literal('snowCams'), ...common }),

      // Paid one-off work for a single club. Renders custom/<name>.astro from
      // the club repo. Not offered in the CMS; added by us.
      z.object({ type: z.literal('custom'), ...common, name: z.string().regex(/^[a-z0-9-]+$/) }),
    ])
    .transform(resolveBlockLinks);
}

// Turn each block's page/url choices into a single link (see Links above).
function resolveBlockLinks(b) {
  if (b.type === 'imageText') return resolveFields(b, 'button', 'Image with text button');
  if (b.type === 'cta') return resolveFields(b, 'button', `Call to action "${b.heading ?? b.buttonLabel ?? ''}"`);
  if (b.type === 'lodgeCards') {
    return { ...b, cards: b.cards.map((c) => resolveFields(c, '', `Lodge card "${c.title}"`)) };
  }
  return b;
}

const BLOCK_NAMES = {
  text: 'Text', image: 'Image', imageText: 'Image with text', photo: 'Full-width photo', gallery: 'Gallery',
  lodgeCards: 'Lodge cards', facts: 'Lodge facts', cta: 'Call to action', map: 'Map', video: 'Video',
  faq: 'Questions and answers', tariffTable: 'Tariff table', embed: 'Embed', contactList: 'Contact list',
  snowCams: 'Snow cams', custom: 'Custom',
};
const blockList = (image, where) =>
  keepValid(blockSchemas(image), where, (b) => {
    const name = BLOCK_NAMES[b?.type] ?? `unknown type "${b?.type}"`;
    return ` (${name}${b?.heading ? `: "${b.heading}"` : ''})`;
  });

// ---------- Collections ----------

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: ({ image }) =>
    z
      .object({
        title: orDefault(requiredText, 'Untitled page', 'Page title'),
        description: optionalText, // shown in search results
        // full: stacked full-width sections. sidebar: main column plus sidebar.
        layout: z.enum(['full', 'sidebar']).catch('full'),
        // The top of the page. See components/Hero.astro for each style.
        hero: z
          .object({
            style: z.enum(['large', 'medium', 'small', 'split', 'none']).catch('none'),
            images: imageList(image, 'Top of page'), // more than one = slider
            title: optionalText, // defaults to the page title
            text: optionalText,
            buttons: linkList('Top of page button'),
          })
          .nullish()
          .catch(null)
          .transform((h) => h ?? { style: 'none', images: [], buttons: [] }),
        hidden: yes(false), // true = not published
        blocks: blockList(image, 'Page section'),
        sidebar: blockList(image, 'Sidebar section'),
      })
      // Fix common editor slips instead of failing the build.
      .transform((p) => {
        const h = { ...p.hero };
        if (h.images.length === 0) h.style = 'none'; // a photo style with no photo
        if (h.style === 'split') h.images = h.images.slice(0, 1); // split shows one photo
        h.images = h.images.slice(0, 7);
        h.buttons = h.buttons.slice(0, 2);
        return { ...p, hero: h };
      }),
});

const settings = defineCollection({
  // Pages CMS edits the JSON file as one object. Wrap it so Astro sees a
  // single entry called "site".
  loader: file('./content/settings/site.json', { parser: (text) => ({ site: JSON.parse(text) }) }),
  schema: ({ image }) =>
    z
      .object({
        name: orDefault(requiredText, 'Club website', 'Club name'),
        url: orDefault(httpsUrl, 'https://example.com', 'Website address'), // production address
        description: optionalText,
        logoOnLight: requiredImage(image, 'Logo'), // used in the white header
        logoOnDark: optionalImage(image, 'Dark background logo'), // used in the dark footer and see-through header
        icon: optionalImage(image, 'Square icon'), // square image for the browser tab icon
        // Colours that are invalid or too light to read are replaced by the
        // template's defaults (see lib/colour.mjs).
        colours: z
          .object({ primary: z.unknown(), heading: z.unknown(), text: z.unknown(), accent: z.unknown(), dark: z.unknown() })
          .partial()
          .nullish()
          .catch({})
          .transform((c) => safeColours(c ?? {}, warn)),
        fonts: z.enum(FONT_PAIR_IDS).catch('system'),
        look: z
          .object({
            // solid: white header. overPhoto: see-through header on top of
            // large and medium top photos (needs the dark-background logo).
            header: z.enum(['solid', 'overPhoto']).catch('solid'),
            corners: z.enum(['rounded', 'square']).catch('rounded'),
          })
          .nullish()
          .catch(null)
          .transform((l) => l ?? { header: 'solid', corners: 'rounded' }),
        menu: linkList('Menu item'),
        // A header button with no label or no working link is simply hidden.
        headerButton: z
          .object({ show: yes(false), label: optionalText, ...linkFields() })
          .nullish()
          .catch(null)
          .transform((h) => {
            const r = resolveFields(h ?? {}, '', 'Header button');
            return { ...r, show: Boolean(r.show && r.label && r.link) };
          }),
        // Band above the footer on every page, usually "Book your stay".
        bookingBand: z
          .object({
            show: yes(false),
            title: optionalText,
            text: optionalText,
            buttonLabel: optionalText,
            ...linkFields('button'),
          })
          .nullish()
          .catch(null)
          .transform((b) => {
            const r = resolveFields(b ?? {}, 'button', 'Booking band button');
            return { ...r, show: Boolean(r.show && r.title && r.buttonLabel && r.buttonLink) };
          }),
        contact: z
          .object({ email: optionalText, phone: optionalText, postalAddress: optionalText, abn: optionalText })
          .nullish()
          .catch(null)
          .transform((c) => c ?? {}),
        social: keepValid(
          z.object({ platform: z.enum(['facebook', 'instagram', 'x', 'youtube', 'linkedin']), url: httpsUrl }),
          'Social media link',
        ),
        footer: z
          .object({ showContact: yes(true), showSocial: yes(true), text: optionalText, links: linkList('Footer link') })
          .nullish()
          .catch(null)
          .transform((f) => f ?? { showContact: true, showSocial: true, links: [] }),
        // Reserved for members-only areas (signed-cookie single sign-on).
        // Not built yet, so it stays off whatever the file says.
        membersArea: z.unknown().optional().transform(() => ({ enabled: false })),
      })
      // A see-through header needs the dark-background logo; without one,
      // use the white header rather than fail.
      .transform((s) => {
        if (s.look.header === 'overPhoto' && !s.logoOnDark) {
          warn('Site settings: the see-through header needs a logo for dark backgrounds, so the white header is used.');
          return { ...s, look: { ...s.look, header: 'solid' } };
        }
        return s;
      }),
});

const snowcams = defineCollection({
  loader: file('./content/settings/snowcams.json', { parser: (text) => ({ snowcams: JSON.parse(text) }) }),
  schema: z
    .object({
      cameras: keepValid(
        z.object({ name: requiredText, url: httpsUrl, enabled: yes(false), caption: optionalText }),
        'Snow camera',
      ).transform((c) => c.slice(0, 12)),
    })
    .catch({ cameras: [] }),
});

export const collections = { pages, settings, snowcams };
