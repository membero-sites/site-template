# Membero site template

The shared template for Membero club websites. Club repos (`site-<club>`)
contain only settings, page content and images, and pin a tagged version of
this repo. A template change reaches a club only when its version is moved.

- `docs/SPEC.md`: what the platform is and isn't (approved spec)
- `index.mjs`: Astro integration (routes, fonts, security policy, build options)
- `content.mjs`: content schemas. Bad content fails the build, not the site
- `components/`: page shell and blocks
- `styles/global.css`, `scripts/site.js`: all styling and browser JavaScript
- `checks/check-links.mjs`: internal link check run after every build
- `starter/`: the standard files every club repo starts with

The full runbook, architecture diagram and annual upgrade procedure are
added to `docs/` in stage 8.

## Versions

Tags look like `v2026.1`. `-rc` tags (for example `v2026.1-rc1`) are test
versions used before go-live. Never move or delete a tag a club uses.

Josh creates tags in GitHub (Releases > Draft a new release). Creating a tag
is the approval step for a template version.

Club repos install the template as a tarball of a tag:

    "@membero/site-template": "https://github.com/membero-sites/site-template/archive/refs/tags/v2026.1.tar.gz"

`package-lock.json` records a checksum of that tarball, so a build fails
rather than silently picking up different code. (A `git+https` dependency
was rejected: npm rewrites it to an SSH address in the lockfile, which
hosting can't use.) This is why this repo is public. It holds no secrets
and no club content.
