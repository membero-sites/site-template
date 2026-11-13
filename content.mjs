// Content schemas for club sites.
//
// Every club repo has a one-line src/content.config.ts that re-exports
// `collections` from here. If an editor saves content that doesn't match
// these schemas, the build fails with a readable message and the last good
// version of the site stays live.
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
import { contrastProblems } from './lib/colour.mjs';
import { embedProblem, videoEmbedUrl } from './lib/embeds.mjs';
import { FONT_PAIR_IDS } from './lib/fonts.mjs';
import { resolveTarget, imageExists, warn, PLACEHOLDER_IMAGE } from './lib/targets.mjs';

// ---------- Shared field types ----------

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colours must look like #1C3956');

const httpsUrl = z.string().superRefine((value, ctx) => {
  try {
    if (new URL(value).protocol === 'https:') return;
  } catch {
    // fall through
  }
  ctx.addIssue({ code: 'custom', message: `"${value}" must be a full address starting with https://` });
});

// Optional text that editors may leave blank in the CMS (saved as "" or null).
const optionalText = z.string().nullish().transform((v) => (v ? v : undefined));

// Editors sometimes add a list entry and leave it blank (for example a
// second question with nothing in it). Blank entries are dropped rather
// than failing the build, because editors never see build errors.
function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === 'object') return Object.values(value).every(isBlank);
  return false; // numbers and booleans count as filled in
}
const withoutBlanks = (v) => (Array.isArray(v) ? v.filter((item) => !isBlank(item)) : v);

const withoutBlanksEarly = withoutBlanks;

// ---------- Links ----------
// Editors choose a page from a list ("page", a Pages CMS reference to the
// page file) or type an address for another website ("url"). Older content
// may still have a typed "link". All three are turned into one "link" here.
// A link to a page that doesn't exist is left out with a build warning
// (lib/targets.mjs), so a renamed page can't fail the build.

const text = z.string().nullish();

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

// A labelled link (menu, footer links, buttons on a photo). Items whose
// target can't be found are dropped from their list.
const linkItem = (where) =>
  z
    .object({ label: z.string().min(1), ...linkFields() })
    .transform((i) => resolveFields(i, '', `${where} "${i.label}"`));
const linkList = (where) =>
  z.preprocess(
    withoutBlanksEarly,
    z.array(linkItem(where)).nullish().transform((v) => (v ?? []).filter((i) => i.link)),
  );

// A list editors may leave empty (Pages CMS may save null).
const list = (item) =>
  z.preprocess(withoutBlanks, z.array(item).nullish().transform((v) => v ?? []));

// A list that needs at least one filled-in entry.
const listOfAtLeastOne = (item) => z.preprocess(withoutBlanks, z.array(item).min(1, 'Add at least one entry'));

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

const altText = z.string().min(1, 'Describe the image for screen readers');

// ---------- Blocks ----------
// Each block has a "type" (what Pages CMS stores as the block key), an
// optional heading and, in full-width pages, a background band.
// Add new block types here, in components/Blocks.astro, and in
// starter/.pages.yml.

function blockSchemas(image) {
  const common = {
    heading: optionalText,
    // white, tint (light grey-blue) or dark (the club's dark colour).
    // Ignored in the sidebar.
    background: z.enum(['white', 'tint', 'dark']).nullish().transform((v) => v ?? 'white'),
  };
  // Gallery photos: a missing one is dropped from the gallery.
  const pic = z.object({ image: optionalImage(image, 'Gallery'), alt: altText });

  return z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), ...common, body: z.string().default('') }),

    z.object({ type: z.literal('image'), ...common, image: requiredImage(image, 'Image section'), alt: altText, caption: optionalText }),

    z.object({
      type: z.literal('imageText'),
      ...common,
      image: requiredImage(image, 'Image with text section'),
      alt: altText,
      body: z.string().default(''),
      imagePosition: z.enum(['left', 'right']).default('left'),
      buttonLabel: optionalText,
      ...linkFields('button'),
    }),

    // A big photo across the full width of the screen, between sections.
    z.object({
      type: z.literal('photo'),
      ...common,
      image: requiredImage(image, 'Full-width photo'),
      alt: altText,
      caption: optionalText,
      height: z.enum(['medium', 'tall']).default('medium'),
    }),

    z.object({ type: z.literal('gallery'), ...common, images: listOfAtLeastOne(pic.extend({ caption: optionalText })).transform((l) => l.filter((i) => i.image)) }),

    z.object({
      type: z.literal('lodgeCards'),
      ...common,
      intro: optionalText,
      cards: listOfAtLeastOne(
        z.object({
          title: z.string().min(1),
          location: optionalText, // for example "Mt Buller, 1,600 m"
          image: optionalImage(image, 'Lodge card'),
          alt: optionalText,
          body: z.string().default(''),
          ...linkFields(),
          linkLabel: optionalText,
        }),
      ),
    }),

    // Key details about a lodge: beds, rooms, season, altitude, parking...
    z.object({
      type: z.literal('facts'),
      ...common,
      items: listOfAtLeastOne(z.object({ label: z.string().min(1), value: z.string().min(1) })),
    }),

    z.object({
      type: z.literal('cta'),
      ...common,
      body: z.string().default(''),
      buttonLabel: z.string().min(1),
      ...linkFields('button'),
    }),

    z.object({
      type: z.literal('map'),
      ...common,
      name: optionalText,
      address: z.string().min(1),
      // Coordinates are optional. Without them the block shows the address
      // and a Directions link but no map.
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
      zoom: z.number().int().min(10).max(19).default(16),
    }),

    z.object({
      type: z.literal('video'),
      ...common,
      url: z.string().refine((v) => videoEmbedUrl(v) !== null, 'Paste a YouTube or Vimeo video address'),
      title: z.string().min(1, 'Give the video a short title for screen readers'),
    }),

    z.object({
      type: z.literal('faq'),
      ...common,
      items: listOfAtLeastOne(z.object({ question: z.string().min(1), answer: z.string().min(1) })),
    }),

    z.object({
      type: z.literal('tariffTable'),
      ...common,
      caption: optionalText,
      columns: z.array(z.string()).min(1),
      rows: listOfAtLeastOne(z.object({ cells: z.array(z.string().nullish().transform((v) => v ?? '')) })),
      note: optionalText,
    }),

    z.object({
      type: z.literal('embed'),
      ...common,
      url: z.string().superRefine((value, ctx) => {
        const problem = embedProblem(value);
        if (problem) ctx.addIssue({ code: 'custom', message: problem });
      }),
      title: z.string().min(1, 'Give the embed a short title for screen readers'),
      height: z.number().int().min(200).max(2000).default(800),
    }),

    z.object({
      type: z.literal('contactList'),
      ...common,
      items: listOfAtLeastOne(
        z.object({
          role: z.string().min(1),
          name: optionalText,
          email: optionalText,
          phone: optionalText,
          note: optionalText,
        }),
      ),
    }),

    z.object({ type: z.literal('snowCams'), ...common }),

    // Paid one-off work for a single club. Renders custom/<name>.astro from
    // the club repo. Not offered in the CMS; added by us.
    z.object({ type: z.literal('custom'), ...common, name: z.string().regex(/^[a-z0-9-]+$/) }),
  ]).transform(resolveBlockLinks);
}

// Turn each block's page/url choices into a single link (see Links above).
function resolveBlockLinks(b) {
  if (b.type === 'imageText') return resolveFields(b, 'button', 'Image with text button');
  if (b.type === 'cta') return resolveFields(b, 'button', `Call to action "${b.buttonLabel}"`);
  if (b.type === 'lodgeCards') {
    return { ...b, cards: b.cards.map((c) => resolveFields(c, '', `Lodge card "${c.title}"`)) };
  }
  return b;
}

// ---------- Collections ----------

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        description: optionalText, // shown in search results
        // full: stacked full-width sections. sidebar: main column plus sidebar.
        layout: z.enum(['full', 'sidebar']).default('full'),
        // The top of the page. See components/Hero.astro for each style.
        hero: z
          .object({
            style: z.enum(['large', 'medium', 'small', 'split', 'none']).default('medium'),
            images: imageList(image, 'Top of page'), // more than one = slider
            title: optionalText, // defaults to the page title
            text: optionalText,
            buttons: linkList('Top of page button'),
          })
          .default({ style: 'none', images: [], buttons: [] }),
        hidden: z.boolean().default(false), // true = not published
        blocks: list(blockSchemas(image)),
        sidebar: list(blockSchemas(image)),
      })
      // Fix common editor slips instead of failing the build (editors never
      // see build errors, and the result is still a sensible page).
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
        name: z.string().min(1),
        url: httpsUrl, // production address, used for links in search results
        description: optionalText,
        logoOnLight: requiredImage(image, 'Logo'), // used in the white header
        logoOnDark: optionalImage(image, 'Dark background logo'), // used in the dark footer and see-through header
        icon: optionalImage(image, 'Square icon'), // square image for the browser tab icon
        colours: z.object({
          primary: hex, // links and buttons
          heading: hex, // headings and menu
          text: hex, // body text
          accent: hex, // decorative lines only, never text
          dark: hex, // footer and dark section background
        }),
        fonts: z.enum(FONT_PAIR_IDS).default('system'),
        look: z
          .object({
            // solid: white header. overPhoto: see-through header on top of
            // large and medium top photos (needs the dark-background logo).
            header: z.enum(['solid', 'overPhoto']).default('solid'),
            corners: z.enum(['rounded', 'square']).default('rounded'),
          })
          .default({ header: 'solid', corners: 'rounded' }),
        menu: linkList('Menu item'),
        // A header button with no label or no working link is simply hidden.
        headerButton: z
          .object({ show: z.boolean().nullish(), label: optionalText, ...linkFields() })
          .nullish()
          .transform((h) => {
            const r = resolveFields(h ?? {}, '', 'Header button');
            return { ...r, show: Boolean(r.show && r.label && r.link) };
          }),
        // Band above the footer on every page, usually "Book your stay".
        bookingBand: z
          .object({
            show: z.boolean().default(false),
            title: optionalText,
            text: optionalText,
            buttonLabel: optionalText,
            ...linkFields('button'),
          })
          .nullish()
          .transform((b) => {
            const r = resolveFields(b ?? {}, 'button', 'Booking band button');
            return { ...r, show: Boolean(r.show && r.title && r.buttonLabel && r.buttonLink) };
          }),
        contact: z
          .object({
            email: optionalText,
            phone: optionalText,
            postalAddress: optionalText,
            abn: optionalText,
          })
          .default({}),
        social: list(z.object({ platform: z.enum(['facebook', 'instagram', 'x', 'youtube', 'linkedin']), url: httpsUrl })),
        footer: z
          .object({
            showContact: z.boolean().default(true),
            showSocial: z.boolean().default(true),
            text: optionalText,
            links: linkList('Footer link'),
          })
          .default({ showContact: true, showSocial: true, links: [] }),
        // Reserved for members-only areas (signed-cookie single sign-on).
        // Not built yet, so it must stay off.
        membersArea: z
          .object({ enabled: z.literal(false, { message: 'Members area is not available yet' }) })
          .default({ enabled: false }),
      })
      .superRefine((s, ctx) => {
        for (const problem of contrastProblems(s.colours)) {
          ctx.addIssue({ code: 'custom', path: ['colours'], message: `${problem}. Choose a darker colour.` });
        }
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
  schema: z.object({
    cameras: list(
      z.object({
        name: z.string().min(1),
        url: httpsUrl, // address of the latest image
        enabled: z.boolean().default(false),
        caption: optionalText,
      }),
    ).pipe(z.array(z.any()).max(12)),
  }),
});

export const collections = { pages, settings, snowcams };
