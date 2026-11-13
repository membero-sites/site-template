# Club websites runbook

Plain-English operating guide for the Membero club websites. The full
runbook (architecture diagram, new-site procedure, annual upgrade) is
completed in stage 8; this file starts with what has already happened in
practice.

## Where to look

- **Build status:** AWS console (josh-admin, Sydney) > Amplify > the club's app
  (`site-<club>`) > `main`. Each content save in Pages CMS starts a build.
- **Build log:** click a deployment > Build > scroll, or Download logs.
  Search the log for `[membero] WARNING` and `check-links`.
- **What changed:** github.com/membero-sites/site-<club> > Commits. Every
  Pages CMS save is a commit by `pages-cms[bot]` naming the file it changed.
- **Alerts:** Amplify emails you when a build finishes (Hosting > Build
  notifications). The subscription only works after you click the link in
  AWS's confirmation email.

A failed build never takes a site down: the last good version stays live
until a build passes.

## Known failure modes

### 1. A page was renamed, but links still use the old address

Seen on Icicles, 13 November 2026 (deployments 6 to 21). The menu was edited
to say `/memberships` while the page file was still `membership.md`; the page
was then renamed in Pages CMS, and the home page button still pointed at
`/membership`. `check-links` failed every build.

- **Now (template v2026.1-rc3 and later):** menu items, footer links and
  buttons pick a page from a list. A link to a page that no longer exists is
  left out and the build passes, with a warning such as
  `[membero] WARNING: Menu item "Member": "/memberships" isn't a page on this site`.
- **Fix:** in Pages CMS, choose the page again for that menu item or button.
- **Still a hard failure:** a link typed inside body text (rich text) to a
  page that doesn't exist. `check-links` names the page and the address.
  Fix the text, or restore the page.
- Pages CMS lets editors rename page files, which changes the page address.
  We can't switch that off, so the template tolerates it instead.

### 2. A photo was deleted from Media but is still used

Seen on Icicles, 13 November 2026 (deployments 11 to 21):
`ImageNotFound ... ../../media/banner-falls-early-morning.jpg`, after the
photo was deleted in Pages CMS (commit `d8f3510`) while Falls Creek still
used it.

- **Now (rc3 and later):** a missing photo at the top of a page, in a
  gallery or on a card is left out; a missing photo in an Image, Image with
  text or Full-width photo section shows a grey "Image missing" placeholder.
  The build passes with a `[membero] WARNING ... not found` line.
- **Fix:** restore the photo from git history, or choose another photo.
  To restore: find the commit that deleted it (`git log --diff-filter=D --
  media/<file>`), then `git checkout <commit>^ -- media/<file>`, commit and push.
- Local builds keep a content cache and can show the old error. Delete
  `node_modules/.astro` before testing. Amplify always builds from scratch.

### 3. A colour fails the readability check

The build stops with `contrast ... needs 4.5:1`. This is deliberate. Set the
colour back to the previous value (see the site.json commit history).

### 4. An embed address isn't allowed

The build stops with `is not an allowed embed`. Only Google Forms, YouTube,
Vimeo and OpenStreetMap can be embedded. Use a link instead, or add the
provider to `lib/embeds.mjs` in a new template version.

## Checking a site after a fix

1. The latest Amplify deployment shows Deployed.
2. Open the preview, check the page that broke, and the menu.
3. Search the build log for `[membero] WARNING`. Each line names what an
   editor needs to fix in Pages CMS.
