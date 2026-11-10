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

// An image editors may leave blank (Pages CMS saves "" or null).
const optionalImage = (image) => z.preprocess((v) => (v ? v : undefined), image().optional());

// ---------- Blocks ----------
// Each block has a "type" (what Pages CMS stores as the block key) and an
// optional heading. Add new block types here, in components/Blocks.astro,
// and in starter/.pages.yml.

function blockSchemas(image) {
  const heading = optionalText;
  const pic = z.object({ image: image(), alt: z.string().min(1, 'Describe the image for screen readers') });

  return z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), heading, body: z.string().default('') }),

    z.object({
      type: z.literal('image'),
      heading,
      image: image(),
      alt: z.string().min(1, 'Describe the image for screen readers'),
      caption: optionalText,
    }),

    z.object({
      type: z.literal('imageText'),
      heading,
      image: image(),
      alt: z.string().min(1, 'Describe the image for screen readers'),
      body: z.string().default(''),
      imagePosition: z.enum(['left', 'right']).default('left'),
    }),

    z.object({
      type: z.literal('gallery'),
      heading,
      images: z.array(pic.extend({ caption: optionalText })).min(1),
    }),

    z.object({
      type: z.literal('lodgeCards'),
      heading,
      cards: z
        .array(
          z.object({
            title: z.string().min(1),
            image: optionalImage(image),
            alt: optionalText,
            body: z.string().default(''),
            link: optionalLink,
            linkLabel: optionalText,
          }),
        )
        .min(1),
    }),

    z.object({
      type: z.literal('cta'),
      heading,
      body: z.string().default(''),
      buttonLabel: z.string().min(1),
      buttonLink: link,
    }),

    z.object({
      type: z.literal('map'),
      heading,
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
      heading,
      url: z.string().refine((v) => videoEmbedUrl(v) !== null, 'Paste a YouTube or Vimeo video address'),
      title: z.string().min(1, 'Give the video a short title for screen readers'),
    }),

    z.object({
      type: z.literal('faq'),
      heading,
      items: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1),
    }),

    z.object({
      type: z.literal('tariffTable'),
      heading,
      caption: optionalText,
      columns: z.array(z.string()).min(1),
      rows: z.array(z.object({ cells: z.array(z.string()) })).min(1),
      note: optionalText,
    }),

    z.object({
      type: z.literal('embed'),
      heading,
      url: z.string().superRefine((value, ctx) => {
        const problem = embedProblem(value);
        if (problem) ctx.addIssue({ code: 'custom', message: problem });
      }),
      title: z.string().min(1, 'Give the embed a short title for screen readers'),
      height: z.number().int().min(200).max(2000).default(800),
    }),

    z.object({
      type: z.literal('contactList'),
      heading,
      items: z
        .array(
          z.object({
            role: z.string().min(1),
            name: optionalText,
            email: optionalText,
            phone: optionalText,
            note: optionalText,
          }),
        )
        .min(1),
    }),

    z.object({ type: z.literal('snowCams'), heading }),

    // Paid one-off work for a single club. Renders custom/<name>.astro from
    // the club repo. Not offered in the CMS; added by us.
    z.object({ type: z.literal('custom'), name: z.string().regex(/^[a-z0-9-]+$/) }),
  ]);
}

// ---------- Collections ----------

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      description: optionalText, // shown in search results
      layout: z.enum(['home', 'standard', 'sidebar']).default('standard'),
      banners: z.array(image()).max(7, 'Up to 7 banner images').nullish().transform((v) => v ?? []),
      bannerHeight: z.enum(['standard', 'short']).default('standard'),
      hidden: z.boolean().default(false), // true = not published
      blocks: z.array(blockSchemas(image)).nullish().transform((v) => v ?? []),
      sidebar: z.array(blockSchemas(image)).nullish().transform((v) => v ?? []),
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
        logoOnDark: optionalImage(image), // used in the dark footer
        icon: optionalImage(image), // square image for the browser tab icon
        colours: z.object({
          primary: hex, // links and buttons
          heading: hex, // headings and menu
          text: hex, // body text
          accent: hex, // decorative lines only, never text
          dark: hex, // footer background
        }),
        fonts: z.enum(FONT_PAIR_IDS).default('system'),
        menu: z.array(linkItem).min(1),
        headerButton: z
          .object({ show: z.boolean().default(false), label: optionalText, link: optionalLink })
          .default({ show: false }),
        contact: z
          .object({
            email: optionalText,
            phone: optionalText,
            postalAddress: optionalText,
            abn: optionalText,
          })
          .default({}),
        social: z
          .array(z.object({ platform: z.enum(['facebook', 'instagram', 'x', 'youtube', 'linkedin']), url: httpsUrl }))
          .default([]),
        footer: z
          .object({
            showContact: z.boolean().default(true),
            showSocial: z.boolean().default(true),
            text: optionalText,
            links: z.array(linkItem).default([]),
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
      }),
});

const snowcams = defineCollection({
  loader: file('./content/settings/snowcams.json', { parser: (text) => ({ snowcams: JSON.parse(text) }) }),
  schema: z.object({
    cameras: z
      .array(
        z.object({
          name: z.string().min(1),
          url: httpsUrl, // address of the latest image
          enabled: z.boolean().default(false),
          caption: optionalText,
        }),
      )
      .max(12)
      .default([]),
  }),
});

export const collections = { pages, settings, snowcams };
