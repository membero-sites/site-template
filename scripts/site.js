// All browser-side JavaScript for club sites. Kept small on purpose and
// written here rather than pulled from third-party libraries.
// Everything still works without JavaScript: the menu stays open, the
// banner shows its first image and snow cams show the image from page load.

// ---------- Phone menu ----------
// The Menu button shows and hides the main menu on narrow screens.
const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
}

// ---------- Banner slideshow ----------
// Fades to the next image every 6 seconds. Does nothing if the visitor has
// asked their device to reduce motion. The pause button stops and restarts.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTERVAL_MS = 6000;

for (const show of document.querySelectorAll('[data-slideshow]')) {
  const slides = [...show.querySelectorAll('.slide')];
  const button = show.querySelector('.slideshow-toggle');
  if (slides.length < 2 || reduceMotion) continue;

  let current = 0;
  let timer = null;
  const next = () => {
    slides[current].classList.remove('is-active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('is-active');
  };
  const start = () => {
    timer = window.setInterval(next, INTERVAL_MS);
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Pause photos';
  };
  const stop = () => {
    window.clearInterval(timer);
    timer = null;
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Play photos';
  };

  button.hidden = false;
  button.addEventListener('click', () => (timer ? stop() : start()));
  start();
}

// ---------- Snow cams ----------
// Reloads each camera image every 5 minutes. The "v" value changes once per
// 5-minute window, so every visitor in that window shares one cached copy.
const CAM_REFRESH_MS = 5 * 60 * 1000;
const cams = [...document.querySelectorAll('img[data-snowcam]')];
if (cams.length > 0) {
  const base = new Map(cams.map((img) => [img, img.getAttribute('src')]));
  window.setInterval(() => {
    const v = Math.floor(Date.now() / CAM_REFRESH_MS);
    for (const img of cams) {
      const url = new URL(base.get(img));
      url.searchParams.set('v', String(v));
      img.src = url.toString();
    }
  }, CAM_REFRESH_MS);
}
