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

## The rule: no Pages CMS save can fail a build

From template v2026.1-rc4, anything an editor can save is either required
in Pages CMS (`.pages.yml`) or tolerated by the template. Content problems
never stop a build; each one is repaired or left out, with a line in the
build log starting `[membero] WARNING` that names the page, the section and
the fix. What the template does:

| Editor saves | Result |
| --- | --- |
| A section with a required field blank (e.g. a call to action with no title) | Section left out |
| A list section with every item blank (FAQ, facts, cards, gallery, contacts, tariff rows) | Blank items dropped; section left out if none remain |
| A button with no text, or no page or address | Button left out; the rest of the section shows |
| A menu item, footer link or button pointing at a renamed or hidden page | Link left out |
| A link typed in body text to a page that doesn't exist | Shown as plain text, not a link |
| A photo deleted from Media but still used | Top of page, gallery, cards: photo left out. Image sections: grey "Image missing" placeholder |
| An unknown or misspelt choice (background, layout, top style, map zoom) | Default used |
| A colour that isn't valid or is too light to read | That colour reset to the template default |
| An embed from a site that isn't allowed, or a video that isn't YouTube or Vimeo | Section left out |
| Header "over photo" with no light logo | Solid header used |
| The home page hidden or deleted | First page shown at the home address |
| A page with no title | Shown as "Untitled page" |

Only two things still fail a build: a fault in the template code itself,
and `check-links` finding a broken link in the generated site (which the
rules above should now prevent). Either means a template fix, not an editor
fix.

To prove the rule after any template change, run the edge-case test
against the demo site (it builds every section with only its required
fields, then every section blanked or wrong, then a site with no home page):

```
cd site-template && npm pack
cd ../site-demo && npm i --no-save ../site-template/membero-site-template-*.tgz
node ../site-template/tests/edge-cases.mjs .
npm ci   # put the released template back
```

## Build time and the image cache

A clean build takes about 10 seconds plus Amplify's setup (about a minute
in total; it was about 3 minutes before rc4). Photos are converted to WebP
only (no AVIF), at 2 to 4 sizes per use (`lib/widths.mjs`), never wider than
the original. Converted photos are kept in `.astro-cache/assets`, which
`amplify.yml` caches between builds, so later builds only convert new
photos.

- If a photo looks wrong after being replaced with a file of the same name,
  clear the cache: Amplify > the app > Hosting > Build settings > Clear
  cache, then Redeploy this version.
- The content cache is not kept, so every build reads content fresh.
- Never commit `.astro-cache/` (it is in `.gitignore`).

## Snow cam storage (paid add-on)

Club cameras upload their latest image to our S3 bucket; visitors load it
through CloudFront. The website shows it on any page with a Snow cams
section and swaps in a fresh copy every 5 minutes without reloading.

- **Bucket:** `membero-snowcams` (Sydney, ap-southeast-2). Block all public
  access on, ACLs disabled, versioning off. One prefix per club and camera:
  `<club>/<camera>/latest.<jpg|png>`, for example
  `icicles/falls-creek-lodge-walkway/latest.png`.
- **CloudFront:** one distribution for all clubs, origin = the bucket with
  origin access control (the bucket policy allows only this distribution to
  read). Cache policy `snowcam-60s`: minimum TTL 0, default and maximum 60
  seconds, no headers, cookies or query strings in the cache key (the
  website's `?v=` refresh parameter is ignored, so it can't bypass the
  cache). Uploads also set `Cache-Control: max-age=60`.
- **Image address for the website:**
  `https://<distribution>.cloudfront.net/<club>/<camera>/latest.png`.
  The address is read-only in Pages CMS; change it in the club repo's
  `content/settings/snowcams.json`. The build adds the CloudFront host to the
  site's Content Security Policy automatically.
- **One IAM user per camera device**, named
  `snowcam-<club>-<camera>`, no console access, one access key, and only this
  inline policy (no list, read or delete):

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::membero-snowcams/<club>/<camera>/latest.png"
    }]
  }
  ```

- **Device upload (rclone 1.65 or later).** `~/.config/rclone/rclone.conf`:

  ```ini
  [membero]
  type = s3
  provider = AWS
  access_key_id = <from the one-time link>
  secret_access_key = <from the one-time link>
  region = ap-southeast-2
  ```

  Leave out any `acl =` line. rclone would send an ACL header, and a
  PutObject-only key is refused when it does. Command (run by cron on the device after
  each capture):

  ```
  rclone copyto /path/to/image.png membero:membero-snowcams/<club>/<camera>/latest.png \
    --s3-no-check-bucket --s3-no-head --s3-no-head-object --no-check-dest \
    --header-upload "Cache-Control: max-age=60" --retries 1
  ```

  The device can't read the bucket, so `rclone ls` returns an access error
  by design. Check uploads by opening the CloudFront address.
- **Credentials** go to the club only through a one-time secret link, never
  email, chat or the repo. To replace a leaked or lost key: IAM > the user >
  Security credentials > create a new key, send it the same way, then
  deactivate and delete the old one.
- **New camera:** add a user and policy for the new prefix, send the key,
  confirm the image loads from CloudFront, then add the camera to
  `snowcams.json`. Nothing else changes.
- **Camera image stale or missing:** open the CloudFront address. An old image
  means the device has stopped uploading (club to check the device and its
  cron job). An "Access Denied" XML page means no image has ever been
  uploaded to that address.

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
- **From rc4:** a link typed inside body text to a page that doesn't
  exist is shown as plain text, with a `Text link` warning. Fix the text,
  or restore the page.
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
  `.astro-cache` (rc3 and earlier: `node_modules/.astro`) before testing.
  Amplify always reads content fresh.

### 3. A colour fails the readability check

rc3 and earlier: the build stopped with `contrast ... needs 4.5:1`. From
rc4 the colour is reset to the template default with a `too light to read`
warning, so the site looks off-brand rather than failing. Set the colour
back to the previous value (see the site.json commit history).

### 4. An embed address isn't allowed

rc3 and earlier: the build stopped with `is not an allowed embed`. From rc4
the section is left out with a warning. Only Google Forms, YouTube, Vimeo
and OpenStreetMap can be embedded. Use a link instead, or add the provider
to `lib/embeds.mjs` in a new template version.

### 5. A call to action saved with its title removed

Reported by Cam (Icicles) in pilot feedback, November 2026. rc3 failed the
build. From rc4 the title is required in Pages CMS (it won't save without
one), and a block saved before that change is left out with a warning.

## Checking a site after a fix

1. The latest Amplify deployment shows Deployed.
2. Open the preview, check the page that broke, and the menu.
3. Search the build log for `[membero] WARNING`. Each line names what an
   editor needs to fix in Pages CMS.
4. Compare a changed section with the demo site's Components page, which
   shows every section, background and top-of-page style.
