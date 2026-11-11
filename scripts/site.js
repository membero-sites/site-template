// All browser-side JavaScript for club sites. Kept small on purpose and
// written here rather than pulled from third-party libraries.
// Everything still works without JavaScript: the menu stays open, the
// top of the page shows its first photo and snow cams show the image from page load.

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

// ---------- Photo slider (top of page) ----------
// Fades to the next photo every 6 seconds. Dots jump to a photo; the pause
// button stops and restarts. Does nothing if the visitor has asked their
// device to reduce motion (they see the first photo only).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTERVAL_MS = 6000;

for (const show of document.querySelectorAll('[data-slideshow]')) {
  const slides = [...show.querySelectorAll('.slide')];
  const controls = show.querySelector('.slider-controls');
  const dots = [...show.querySelectorAll('.slider-dot')];
  const pause = show.querySelector('.slider-pause');
  if (slides.length < 2 || reduceMotion || !controls) continue;

  let current = 0;
  let timer = null;

  const showSlide = (n) => {
    slides[current].classList.remove('is-active');
    dots[current]?.setAttribute('aria-pressed', 'false');
    current = n;
    slides[current].classList.add('is-active');
    dots[current]?.setAttribute('aria-pressed', 'true');
  };
  const start = () => {
    timer = window.setInterval(() => showSlide((current + 1) % slides.length), INTERVAL_MS);
    pause.setAttribute('aria-pressed', 'false');
    pause.textContent = 'Pause';
  };
  const stop = () => {
    window.clearInterval(timer);
    timer = null;
    pause.setAttribute('aria-pressed', 'true');
    pause.textContent = 'Play';
  };

  controls.hidden = false;
  pause.addEventListener('click', () => (timer ? stop() : start()));
  // Choosing a photo stops the slider so it stays on that photo.
  dots.forEach((dot, i) =>
    dot.addEventListener('click', () => {
      if (timer) stop();
      showSlide(i);
    }),
  );
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
