// Image sizes generated for each photo, per place it appears.
//
// Every size is one more file to make at build time, so the lists are kept
// short. One format only: WebP, which every current browser shows (AVIF
// was dropped in v2026.1-rc4: it was most of the build time for a small
// saving in file size).

export const IMAGE_FORMAT = 'webp';

export const SIZES = {
  hero: [640, 1280, 1920, 2560], // full-width photo at the top of a page
  photo: [640, 1280, 1920, 2560], // full-width photo section
  split: [600, 1200], // photo beside the title
  content: [600, 1200], // image and image-with-text sections
  card: [600, 1000], // lodge cards
  thumb: [400, 800], // gallery grid
};

// Widths to generate for an image: the list, never wider than the
// original, plus the original width when it's smaller than the largest.
export function widthsFor(image, list) {
  const max = Math.min(image.width, list[list.length - 1]);
  return [...new Set([...list.filter((w) => w < max), max])];
}
