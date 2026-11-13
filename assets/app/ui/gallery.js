// Product media gallery: replaces the theme's media-gallery/slider-component scripts (stripped at build).
// The theme CSS shows only the .product__media-item.is-active image in the thumbnail layout, so switching
// images means moving .is-active (and aria-current on the matching thumbnail).
export function mountGallery(root) {
  const gallery = root.querySelector('media-gallery');
  if (!gallery) return;
  const items = [...gallery.querySelectorAll('.product__media-item[data-media-position]')];
  if (items.length < 2) return;
  const thumbs = [...gallery.querySelectorAll('.thumbnail-list__item[data-media-position]')];
  const counter = gallery.querySelector('.slider-counter--current');

  const show = (index) => {
    const i = (index + items.length) % items.length;
    const pos = items[i].dataset.mediaPosition;
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    for (const li of thumbs) {
      const b = li.querySelector('.thumbnail');
      if (!b) continue;
      if (li.dataset.mediaPosition === pos) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    if (counter) counter.textContent = String(i + 1);
    // Mobile layout scrolls the list horizontally; keep the chosen image in view.
    items[i].scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };
  const activeIndex = () => Math.max(0, items.findIndex((li) => li.classList.contains('is-active')));

  for (const li of thumbs) {
    li.querySelector('.thumbnail')?.addEventListener('click', (e) => {
      e.preventDefault();
      const i = items.findIndex((m) => m.dataset.mediaPosition === li.dataset.mediaPosition);
      if (i >= 0) show(i);
    });
  }
  gallery.querySelector('.slider-button--next')?.addEventListener('click', () => show(activeIndex() + 1));
  gallery.querySelector('.slider-button--prev')?.addEventListener('click', () => show(activeIndex() - 1));
}
