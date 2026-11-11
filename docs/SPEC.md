# Club Websites Platform: Spec v1.1 (Icicles pilot)

v1 approved by Josh, 10 November 2026. v1.1 (11 November 2026, at Josh's request): more design options so the template suits a wider range of clubs (hero styles, section backgrounds, new blocks, look settings, booking band). Changes to this spec need Josh's approval and a new version number.

## 1. Purpose

Static websites for ski clubs. Goals, in order: secure, very low maintenance, clubs edit their own content, quick to spin up a new club, modest profit. Icicles is the pilot. Its design becomes the shared template.

## 2. Components

- **GitHub org `membero-sites`**: `site-template` (public), `site-demo`, and one `site-<club>` repo per club (for example `site-icicles`). The org holds website repos only.
- **Club repo**: `site.yml` (settings), `content/pages/*.md`, `content/snowcams.yml`, `assets/`, and a `custom/` slot. `package.json` pins the template to a git tag (for example `v2026.1`). The lockfile records the exact commit.
- **Pages CMS**: editors invited by email, no GitHub account needed. Josh is admin on every site.
- **AWS Amplify (ap-southeast-2)**: one app per club, rebuilt on each content change. A failed build leaves the last good version live and sends an email alert.
- **Snow cams**: private S3 bucket behind CloudFront. One IAM key per camera, allowed to upload only its own image object (no list, read or delete). 60-second cache.

## 3. Template

- **Settings**: logo (light and dark), colours, curated self-hosted font pairs (no Google Fonts calls), look (white or see-through header, rounded or square corners), menu, header button, booking band above the footer, contact details, social links, footer.
- **Top of page (per page)**: large (full-screen photo or slider with title, text and up to 2 buttons), medium (photo with page title), small (short strip, for low-resolution photos), split (one photo beside the title), or none.
- **Slider**: up to 7 photos, fade every 6 seconds, dots and pause button, first photo only when reduced motion is on. All JS written into the template.
- **Blocks**: text, image, image with text, full-width photo, gallery, lodge cards (with location), lodge facts, call to action, map, video, FAQ, tariff table, embed, contact list, snow cams. Each block can sit on a white, tint or dark band.
- **Layouts**: Full width sections, Main plus sidebar.
- **Map block**: OpenStreetMap embed plus a Directions link. No API key, no tracking cookies.
- **Embeds**: allowlist only (YouTube, Vimeo, Google Forms, OpenStreetMap). Anything else fails the build.
- **Members area**: optional section, off by default, reserved for later signed-cookie single sign-on. Every site has a booking/members link into the booking service.
- **Custom slot**: `custom/` in the club repo, for paid one-offs only. Never fork the template. Anything two clubs want goes into the template.
- **Security headers**: strict content security policy (self, allowlisted embed hosts, snow cam host), HSTS, nosniff, Referrer-Policy, frame-ancestors none. No forms post anywhere. Contact is by email link.
- **Accessibility**: WCAG 2.1 AA target. Colour roles are set per club and checked against white and the tint band at build time. Text on photos sits on a dark shade.

## 4. Builds and dependencies

- Exact versions pinned, lockfile committed, `npm ci`, `.npmrc` with `save-exact=true`.
- Node 24 LTS pinned to an exact version in `amplify.yml`, `.nvmrc` and `package.json` engines.
- No Renovate, no auto-merge, no scheduled rebuilds. Nothing depends on the build date.
- Dependabot alerts on `site-template` only, notification only. Act only if the package ships in browser-side code. Otherwise wait for the annual upgrade.
- One planned upgrade a year (February or March), procedure in the runbook.

## 5. Checks

- **Every build**: content schema validation, internal link check.
- **Template changes and version moves (GitHub Actions)**: accessibility scan, external link check, phone and desktop screenshot comparison on the demo site and Icicles.

## 6. Operations

Amplify console for build status. Email on failed builds. Free uptime monitoring. Runbook, architecture diagram and upgrade procedure in `site-template/docs`. Independent code review by a fresh session before go-live.

## 7. Icicles site

- **Pages**: Home (large slider). About, Mt Buller, Falls Creek (Main plus sidebar, lodge facts in the sidebar). Membership, Contact (contact list block), Snow Cams (full width). "Booking & Documentation" is a menu link to https://bookings.icicles.com.au. Cam can add pages with any layout.
- **Colours**: links and buttons #2400B0 (12.3:1 on white), headings and nav #1C3956 (11.9:1), body text and footer background #23262A, #51A4DB for accents only (2.7:1 on white, fails as text).
- **Photos**: served as optimised WebP/AVIF. History (1020x267) and Cross-Country (1136x358) are low resolution: used with the small top style or inside sections, never full screen.
- **Location**: the 267x240 map screenshots are replaced by the map block with address and Directions link.
- **Logos**: both supplied logos only work on light backgrounds. Light logo in the white header. A white single-colour version, generated from the logo, in the dark footer (subject to Cam's OK). Favicon sizes generated from the logo. Retro logo in the About sidebar.
- **Snow cams**: three entries (Falls Creek Lodge, Falls Creek Valley, Mt Buller Summit), each with an on/off switch. Only the live camera is on. Image reloads in the browser every 5 minutes.
- **Redirects**: old URLs to their equivalents (crawled in stage 4). `/Security/login` to Home. `/documentation` to the booking service Documents page.
- **Edits**: obvious typos only. ABN shown as 57 005 934 001.

## 8. Out of scope

News, weather, member login on the website, contact forms, KPSC (separate spec).

## Open questions (placeholders until answered)

1. membership@ or memberships@icicles.com.au
2. Alberg St or Arlberg St (Falls Creek)
3. Falls Creek bedroom and bed counts
4. Update dated names to Alpine Resorts Victoria, ASIC, ATO
5. Footer contents; Facebook and Twitter links active or not
6. Which snow camera is live
7. White footer logo OK
8. Booking service Documents page URL for the `/documentation` redirect (Josh or Kevin)

## Risk (resolved)

Pages CMS supports mixed block lists within one page (block field, `blockKey: type`). Confirmed in stage 3.
