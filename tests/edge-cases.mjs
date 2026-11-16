#!/usr/bin/env node
// Edge-case build test: "no Pages CMS save can fail a build".
//
// Works on a club site (normally site-demo) in place: backs up its content/
// folder, adds pages
// and settings that an editor could plausibly save in Pages CMS (every
// block with only its required fields; every block with fields blanked,
// wrong or missing; a broken colour, logo, link and photo; no home page),
// and builds it, then puts content/ back exactly as it was. (A copy with a
// linked node_modules would be cleaner, but Vite can't build through one.)
// The test passes only if every build succeeds and the expected warnings
// appear.
//
// Usage:
//   node tests/edge-cases.mjs <path to a club site with node_modules installed>
// To test an unreleased template, first install it into that site with
//   npm pack (in site-template), then npm i --no-save <the .tgz> (in the site).

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const site = resolve(process.argv[2] ?? '');
if (!existsSync(join(site, 'node_modules/@membero/site-template'))) {
  console.error('Usage: node tests/edge-cases.mjs <club site folder with node_modules installed>');
  process.exit(2);
}

// Any photo that exists in the site, for the "valid" cases.
const media = JSON.parse(readFileSync(join(site, 'content/settings/site.json'), 'utf8')).logoOnLight;

// ---------- Content an editor could save ----------

// Every block with only what the CMS requires; everything optional empty.
const minimalBlocks = `
  - { type: text, heading: "", background: "", body: "" }
  - { type: image, image: "${media}", alt: "Logo", caption: "" }
  - { type: imageText, image: "${media}", alt: "Logo", body: "", imagePosition: "", buttonLabel: "", buttonPage: "", buttonUrl: "" }
  - { type: photo, image: "${media}", alt: "Logo", caption: "", height: "" }
  - type: gallery
    images: [{ image: "${media}", alt: "Logo", caption: "" }]
  - type: lodgeCards
    intro: ""
    cards: [{ title: "Card", location: "", image: "", alt: "", body: "", page: "", url: "", linkLabel: "" }]
  - type: facts
    items: [{ label: "Beds", value: "26" }]
  - { type: cta, heading: "", body: "", buttonLabel: "", buttonPage: "", buttonUrl: "" }
  - { type: map, name: "", address: "Somewhere VIC 3000", latitude: "", longitude: "", zoom: "" }
  - { type: video, url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "" }
  - type: faq
    items: [{ question: "Q?", answer: "A." }]
  - type: tariffTable
    caption: ""
    columns: ["Room"]
    rows: [{ cells: ["Twin", ""] }]
    note: ""
  - { type: embed, url: "https://docs.google.com/forms/d/e/x/viewform", title: "", height: "" }
  - type: contactList
    items: [{ role: "Bookings", name: "", email: "", phone: "", note: "" }]
  - { type: snowCams, heading: "" }
`;

// Every block with required fields blank or wrong: each should be left out
// (or repaired) with a warning, never fail the build.
const brokenBlocks = `
  - { type: text }
  - { type: image, image: "../../media/deleted-photo.jpg", alt: "" }
  - { type: imageText, image: "", alt: "", buttonLabel: "Go", buttonPage: "content/pages/renamed.md" }
  - { type: photo, image: "../../media/deleted-photo.jpg", alt: "", height: "huge" }
  - type: gallery
    images: [{ image: "../../media/deleted-photo.jpg", alt: "" }, {}]
  - type: lodgeCards
    cards: [{ title: "", body: "no title" }, {}]
  - type: facts
    items: [{ label: "", value: "" }, { label: "Beds", value: "" }]
  - { type: cta, heading: "Title removed below", buttonLabel: "", buttonUrl: "/no-such-page" }
  - { type: cta, buttonLabel: "Join", buttonUrl: "not a link" }
  - { type: map, address: "", latitude: "abc", zoom: 99 }
  - { type: video, url: "https://example.com/video", title: "" }
  - type: faq
    items: [{ question: "", answer: "" }, { question: "Q only", answer: "" }]
  - type: tariffTable
    columns: [""]
    rows: []
  - { type: embed, url: "https://evil.example.com/form", title: "" }
  - type: contactList
    items: [{ role: "", email: "x@example.com" }]
  - { type: notARealBlock, heading: "Unknown" }
  - { type: text, background: "purple", body: "A [broken text link](/no-such-page) and a [good one](/)." }
  - null
`;

function page(title, extra) {
  return `---\ntitle: "${title}"\n${extra}\n---\n`;
}

const scenarios = [
  {
    name: 'every block minimal, every block broken, broken settings',
    expectWarnings: [
      'Page section',
      'not found',
      "isn't a page on this site",
      'too light to read',
      'Social media link',
      'Snow camera',
      'Text link',
    ],
    apply(dir) {
      writeFileSync(join(dir, 'content/pages/zz-minimal.md'), page('Minimal blocks', `layout: full\nblocks:${minimalBlocks}`));
      writeFileSync(
        join(dir, 'content/pages/zz-broken.md'),
        page('', `layout: nonsense\nhidden: "maybe"\nhero:\n  style: huge\n  images: ["../../media/deleted-photo.jpg", ""]\n  buttons: [{ label: "", page: "" }, { label: "Old", url: "/old-page" }]\nblocks:${brokenBlocks}\nsidebar:${brokenBlocks}`),
      );
      const s = JSON.parse(readFileSync(join(dir, 'content/settings/site.json'), 'utf8'));
      Object.assign(s, {
        name: '',
        logoOnDark: '../../media/deleted-logo.png',
        icon: '',
        colours: { primary: '#51A4DB', heading: 'navy', text: '', accent: '#FFFFFF', dark: '#EEEEEE' },
        fonts: 'comic-sans',
        look: { header: 'overPhoto', corners: 'wobbly' },
        menu: [...(s.menu ?? []), { label: 'Gone', page: 'content/pages/deleted.md' }, { label: '', url: '' }, { label: 'Typed', url: '/typed-wrong' }],
        headerButton: { show: true, label: '', page: '' },
        bookingBand: { show: true, title: '', buttonLabel: 'Book' },
        social: [{ platform: 'myspace', url: 'https://example.com' }, { platform: 'facebook', url: 'facebook.com/x' }],
        footer: { showContact: 'yes', links: [{ label: 'Nowhere', url: '/nowhere' }] },
        membersArea: { enabled: true },
      });
      writeFileSync(join(dir, 'content/settings/site.json'), JSON.stringify(s, null, 2));
      writeFileSync(
        join(dir, 'content/settings/snowcams.json'),
        JSON.stringify({ cameras: [{ name: '', url: 'http://insecure.example.com/a.jpg', enabled: 'yes' }, null] }),
      );
    },
    check(dir) {
      return existsSync(join(dir, 'dist/zz-minimal/index.html')) && existsSync(join(dir, 'dist/zz-broken/index.html'));
    },
  },
  {
    name: 'home page hidden',
    expectWarnings: ['no published home page'],
    apply(dir) {
      const home = join(dir, 'content/pages/home.md');
      writeFileSync(home, readFileSync(home, 'utf8').replace(/^---\n/, '---\nhidden: true\n').replace(/^hidden: false\n/m, ''));
    },
    check(dir) {
      return existsSync(join(dir, 'dist/index.html'));
    },
  },
];

// ---------- Run ----------

let failed = 0;
const backup = mkdtempSync(join(tmpdir(), 'membero-content-'));
cpSync(join(site, 'content'), join(backup, 'content'), { recursive: true });
const restore = () => {
  rmSync(join(site, 'content'), { recursive: true, force: true });
  cpSync(join(backup, 'content'), join(site, 'content'), { recursive: true });
};
process.on('exit', () => {
  restore();
  rmSync(backup, { recursive: true, force: true });
});

for (const scenario of scenarios) {
  const dir = site;
  restore();
  scenario.apply(dir);

  // Clean caches so every case is parsed fresh, as on Amplify.
  rmSync(join(site, 'node_modules/.astro'), { recursive: true, force: true });
  rmSync(join(site, '.astro-cache'), { recursive: true, force: true });
  rmSync(join(site, 'dist'), { recursive: true, force: true });
  const build = spawnSync('npx', ['astro', 'build'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  const links = build.status === 0 ? spawnSync('npx', ['membero-check-links', 'dist'], { cwd: dir, encoding: 'utf8' }) : null;
  const log = build.stdout + build.stderr + (links ? links.stdout + links.stderr : '');
  const warnings = log.split('\n').filter((l) => l.includes('[membero] WARNING'));
  const missing = scenario.expectWarnings.filter((w) => !warnings.some((l) => l.includes(w)));
  const ok = build.status === 0 && links?.status === 0 && scenario.check(dir) && missing.length === 0;

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${scenario.name}  (${warnings.length} warnings)`);
  if (!ok) {
    failed++;
    if (build.status !== 0) console.log(log.split('\n').filter((l) => /error|expected|line|Hint|\^/i.test(l)).slice(0, 25).join('\n'));
    if (links && links.status !== 0) console.log(links.stdout + links.stderr);
    if (missing.length) console.log('  expected warnings not seen:', missing.join(' | '));
  }
  if (process.env.SHOW_WARNINGS) console.log(warnings.map((w) => '  ' + w).join('\n'));
}
rmSync(join(site, 'node_modules/.astro'), { recursive: true, force: true });
  rmSync(join(site, '.astro-cache'), { recursive: true, force: true });
process.exit(failed ? 1 : 0);
