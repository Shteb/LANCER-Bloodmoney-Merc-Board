/**
 * Renderer for flat (2D) operational theater maps: background image, location
 * markers, and the coordinate maths that keeps markers aligned as the map
 * scales. Loaded by both the admin editor (admin-theaters.js) and the client
 * viewer (client-theaters.js) so a marker lands in the same spot in both.
 *
 * Rendering only -- it holds no visibility or permission logic. What a player
 * is allowed to see is decided server-side in lib/theaterVisibility.js.
 */

/**
 * Render a flat theater's background + location markers into a viewport element.
 * @param {HTMLElement} viewport - the .theater-map-viewport container
 * @param {Object} theater - the theater object
 * @param {Object} opts - { selectedLocationId, onMarkerClick(loc), showLabels }
 */
function renderFlatTheater(viewport, theater, opts) {
  opts = opts || {};
  viewport.innerHTML = '';
  viewport.classList.remove('empty');

  if (!theater) {
    viewport.classList.add('empty');
    viewport.textContent = '> NO_THEATER_SELECTED_';
    return;
  }

  // Markers are positioned as % of this content box, which is kept in sync
  // (on load/resize) to exactly match the background image's rendered
  // area — see syncTheaterMapContent. That keeps marker placement identical
  // regardless of the viewport's own aspect ratio/size (admin vs client,
  // any screen size).
  const content = document.createElement('div');
  content.className = 'theater-map-content';
  viewport.appendChild(content);

  // Background image
  if (theater.backgroundImage) {
    const img = document.createElement('img');
    img.className = 'theater-map-image';
    img.src = '/theater-assets/' + encodeURIComponent(theater.backgroundImage);
    img.alt = theater.name || 'Theater';
    img.onload = () => syncTheaterMapContent(viewport);
    // If the image no longer exists (e.g. it was deleted), remove it so a
    // stale/broken image isn't shown from cache.
    img.onerror = () => { img.remove(); syncTheaterMapContent(viewport); };
    content.appendChild(img);
    // Cached images can already be complete by the time onload is attached.
    if (img.complete) syncTheaterMapContent(viewport);
  }

  // Markers
  (theater.locations || []).forEach(loc => {
    // Only flat-positioned locations render here
    if (typeof loc.x !== 'number' || typeof loc.y !== 'number') return;

    const marker = document.createElement('div');
    marker.className = 'theater-marker';
    if (opts.selectedLocationId && loc.id === opts.selectedLocationId) {
      marker.classList.add('selected');
    }
    marker.dataset.locationId = loc.id;

    // Render the marker icon: the emblem SVG is used as a CSS mask filled with
    // the location's color (iconColor), with a subtle neutral drop-shadow for
    // contrast on light backgrounds.
    const icon = document.createElement('span');
    icon.className = 'theater-marker-icon';
    marker.appendChild(icon);

    if (opts.showLabels !== false) {
      const label = document.createElement('div');
      label.className = 'theater-marker-label';
      marker.appendChild(label);
    }

    updateFlatTheaterMarker(marker, loc);

    if (typeof opts.onMarkerClick === 'function') {
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onMarkerClick(loc);
      });
    }

    content.appendChild(marker);
  });

  syncTheaterMapContent(viewport);

  // Keep the content box aligned with the image as the viewport is resized
  // (admin's box is fluid-width/fixed-ratio, client's is fluid in both —
  // both need a resync, not just a one-time layout).
  if (!viewport._theaterResizeObserver) {
    viewport._theaterResizeObserver = new ResizeObserver(() => syncTheaterMapContent(viewport));
    viewport._theaterResizeObserver.observe(viewport);
  }
}

/**
 * Resize/reposition a viewport's .theater-map-content box (in px) to exactly
 * match the background image's rendered content rect, replicating
 * object-fit:contain math ourselves so markers (positioned as % of this box)
 * line up with the image regardless of the viewport's own aspect ratio.
 */
function syncTheaterMapContent(viewport) {
  const content = viewport.querySelector('.theater-map-content');
  if (!content) return;

  const img = content.querySelector('.theater-map-image');
  const boxW = viewport.clientWidth;
  const boxH = viewport.clientHeight;

  if (!img || !img.naturalWidth || !img.naturalHeight || !boxW || !boxH) {
    // No image (or not loaded yet) — content box is just the full viewport.
    content.style.left = '0px';
    content.style.top = '0px';
    content.style.width = boxW + 'px';
    content.style.height = boxH + 'px';
    return;
  }

  const imageRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = boxW / boxH;
  let width, height;
  if (imageRatio > boxRatio) {
    width = boxW;
    height = boxW / imageRatio;
  } else {
    height = boxH;
    width = boxH * imageRatio;
  }

  content.style.left = ((boxW - width) / 2) + 'px';
  content.style.top = ((boxH - height) / 2) + 'px';
  content.style.width = width + 'px';
  content.style.height = height + 'px';

  resyncMarkerIconSizes(viewport);
}

// Icon sizes are authored in "map pixels" (the background image's native
// resolution), then scaled to match how large the image is actually being
// rendered — so an icon stays the same size relative to the map art at any
// screen size, instead of a fixed CSS px size that would loom larger as the
// map shrinks (or shrink to nothing on a small screen).
const MIN_ICON_PX = 10;

function getTheaterMapScale(viewport) {
  const content = viewport.querySelector('.theater-map-content');
  const img = content && content.querySelector('.theater-map-image');
  if (!img || !img.naturalWidth) return 1;
  return content.getBoundingClientRect().width / img.naturalWidth;
}

function resyncMarkerIconSizes(viewport) {
  const scale = getTheaterMapScale(viewport);
  viewport.querySelectorAll('.theater-marker-icon').forEach(icon => {
    const mapSize = Number(icon.dataset.mapSize);
    if (!mapSize) return;
    const size = Math.max(MIN_ICON_PX, mapSize * scale);
    icon.style.width = size + 'px';
    icon.style.height = size + 'px';
  });
}

/** Update an existing marker without rebuilding the map. */
function updateFlatTheaterMarker(marker, location) {
  if (!marker || !location) return;
  marker.style.left = (location.x * 100) + '%';
  marker.style.top = (location.y * 100) + '%';

  const icon = marker.querySelector('.theater-marker-icon');
  if (icon) {
    const mapSize = 32 * (Number(location.iconScale) || 1);
    icon.dataset.mapSize = mapSize;
    const viewport = marker.closest('.theater-map-viewport');
    const scale = viewport ? getTheaterMapScale(viewport) : 1;
    const size = Math.max(MIN_ICON_PX, mapSize * scale);
    const iconUrl = '/emblems/' + encodeURIComponent(location.icon || 'token--world.svg');
    const maskValue = "url('" + iconUrl + "') no-repeat center / contain";
    icon.style.width = size + 'px';
    icon.style.height = size + 'px';
    icon.style.backgroundColor = location.iconColor || '#e0e0e0';
    icon.style.webkitMask = maskValue;
    icon.style.mask = maskValue;
  }

  const label = marker.querySelector('.theater-marker-label');
  if (label) label.textContent = location.name || '';
}

/**
 * Convert a click event on the viewport into normalized [0,1] coordinates.
 * @param {HTMLElement} viewport
 * @param {MouseEvent} event
 * @returns {{x:number, y:number}}
 */
function viewportClickToNormalized(viewport, event) {
  const content = viewport.querySelector('.theater-map-content');
  const rect = (content || viewport).getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y))
  };
}

// Expose on window for use by non-module scripts
window.TheaterMap = {
  renderFlatTheater,
  syncTheaterMapContent,
  updateFlatTheaterMarker,
  viewportClickToNormalized
};
