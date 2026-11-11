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
import { linkProblem } from './lib/links.mjs';

// ---------- Shared field types ----------

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colours must look like #1C3956');

const link = z.string().superRefine((value, ctx) => {
  const problem = linkProblem(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
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
const optionalText = z.string().nullish().transform((v) => (v ? v : undefined));

// A link editors may leave blank.
const optionalLink = z
  .string()
  .nullish()
  .transform((v) => (v ? v : undefined))
  .pipe(link.optional());

const linkItem = z.object({ label: z.string().min(1), link });

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

// A list editors may leave empty (Pages CMS may save null).
const list = (item) =>
  z.preprocess(withoutBlanks, z.array(item).nullish().transform((v) => v ?? []));

// A list that needs at least one filled-in entry.
const listOfAtLeastOne = (item) => z.preprocess(withoutBlanks, z.array(item).min(1, 'Add at least one entry'));

// An image editors may leave blank (Pages CMS saves "" or null).
const optionalImage = (image) => z.preprocess((v) => (v ? v : undefined), image().optional());

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
  const pic = z.object({ image: image(), alt: altText });

  return z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), ...common, body: z.string().default('') }),

    z.object({ type: z.literal('image'), ...common, image: image(), alt: altText, caption: optionalText }),

    z.object({
      type: z.literal('imageText'),
      ...common,
      image: image(),
      alt: altText,
      body: z.string().default(''),
      imagePosition: z.enum(['left', 'right']).default('left'),
      buttonLabel: optionalText,
      buttonLink: optionalLink,
    }),

    // A big photo across the full width of the screen, between sections.
    z.object({
      type: z.literal('photo'),
      ...common,
      image: image(),
      alt: altText,
      caption: optionalText,
      height: z.enum(['medium', 'tall']).default('medium'),
    }),

    z.object({ type: z.literal('gallery'), ...common, images: listOfAtLeastOne(pic.extend({ caption: optionalText })) }),

    z.object({
      type: z.literal('lodgeCards'),
      ...common,
      intro: optionalText,
      cards: listOfAtLeastOne(
        z.object({
          title: z.string().min(1),
          location: optionalText, // for example "Mt Buller, 1,600 m"
          image: optionalImage(image),
          alt: optionalText,
          body: z.string().default(''),
          link: optionalLink,
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
      buttonLink: link,
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
  ]);
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
            images: list(image()), // more than one = slider
            title: optionalText, // defaults to the page title
            text: optionalText,
            buttons: list(linkItem),
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
        logoOnLight: image(), // used in the white header
        logoOnDark: optionalImage(image), // used in the dark footer and see-through header
        icon: optionalImage(image), // square image for the browser tab icon
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
        menu: listOfAtLeastOne(linkItem),
        headerButton: z
          .object({ show: z.boolean().default(false), label: optionalText, link: optionalLink })
          .default({ show: false }),
        // Band above the footer on every page, usually "Book your stay".
        bookingBand: z
          .object({
            show: z.boolean().default(false),
            title: optionalText,
            text: optionalText,
            buttonLabel: optionalText,
            buttonLink: optionalLink,
          })
          .default({ show: false }),
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
            links: list(linkItem),
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
        if (s.headerButton.show && (!s.headerButton.label || !s.headerButton.link)) {
          ctx.addIssue({ code: 'custom', path: ['headerButton'], message: 'Header button needs a label and a link' });
        }
        const b = s.bookingBand;
        if (b.show && (!b.title || !b.buttonLabel || !b.buttonLink)) {
          ctx.addIssue({ code: 'custom', path: ['bookingBand'], message: 'Booking band needs a title, button text and button link' });
        }
        if (s.look.header === 'overPhoto' && !s.logoOnDark) {
          ctx.addIssue({ code: 'custom', path: ['look', 'header'], message: 'A see-through header needs a logo for dark backgrounds' });
        }
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
