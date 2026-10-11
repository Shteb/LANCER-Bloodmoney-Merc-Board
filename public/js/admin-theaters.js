/**
 * I deciced to put it here, instead of adding another 700-odd lines to the
 * already 3000+ lines in views\admin\_scripts.ejs.
 * it breaks convention, but I still think it makes it easier to mantain end edit like this.
 * 
 * Admin-side Operational Theater editor.
 * Handles theater CRUD, background upload, click-to-place locations,
 * drag-to-reposition, icon/color/scale, and job assignment.
 */

const AdminTheaters = {
  theaters: [],
  jobs: [],
  selectedTheaterId: null,
  editingLocationId: null,   // null = creating a new location
  placingMode: false,
  pendingIcon: 'token--world.svg',
  pendingCoords: null        // {x, y} for a newly placed (unsaved) location
};

// ==================== Data loading ====================

function theaterAdminInit() {
  Promise.all([
    fetch('/api/theaters').then(r => r.json()),
    fetch('/api/jobs').then(r => r.json())
  ]).then(([theaters, jobs]) => {
    AdminTheaters.theaters = theaters || [];
    AdminTheaters.jobs = jobs || [];
    if (AdminTheaters.theaters.length > 0 && !AdminTheaters.selectedTheaterId) {
      AdminTheaters.selectedTheaterId = AdminTheaters.theaters[0].id;
    }
    theaterAdminRender();
  });
}

// SSE handler
function handleTheatersUpdate(data) {
  if (data && Array.isArray(data.theaters)) {
    AdminTheaters.theaters = data.theaters;
    if (!AdminTheaters.theaters.some(t => t.id === AdminTheaters.selectedTheaterId)) {
      AdminTheaters.selectedTheaterId = AdminTheaters.theaters[0]
        ? AdminTheaters.theaters[0].id
        : null;
    }
    theaterAdminRender();
  }
}

// Jobs can be created while the theater tab is open. Keep the assignment list
// current rather than requiring a page reload before a new location can use it.
function handleJobsUpdate(data) {
  if (data && Array.isArray(data.jobs)) {
    AdminTheaters.jobs = data.jobs;
    theaterAdminUpdateTheaterVisibilityWarning();
    if (AdminTheaters.editingLocationId !== null || AdminTheaters.pendingCoords) {
      // Rebuild the checklist against whatever is currently checked in the
      // DOM (not the last-saved location), so an in-progress, unsaved
      // selection survives a jobs list refresh instead of being wiped.
      const jobsEl = document.getElementById('admin-loc-jobs');
      const checkedIds = jobsEl
        ? Array.from(jobsEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
        : [];
      theaterAdminRenderJobChecklist({ assignedJobIds: checkedIds });
      theaterAdminUpdateLocationVisibilityWarning();
    }
  }
}

function theaterAdminGetSelected() {
  return AdminTheaters.theaters.find(t => t.id === AdminTheaters.selectedTheaterId) || null;
}

function theaterAdminRender() {
  theaterAdminRenderList();
  theaterAdminRenderEditor();
}

function theaterAdminStoreTheater(theater) {
  const index = AdminTheaters.theaters.findIndex(item => item.id === theater.id);
  if (index !== -1) AdminTheaters.theaters[index] = theater;
}

function theaterAdminGetEditingLocation(theater) {
  if (!theater || !AdminTheaters.editingLocationId) return null;
  return (theater.locations || []).find(loc => loc.id === AdminTheaters.editingLocationId) || null;
}

function theaterAdminTheaterBody(theater, overrides) {
  return {
    name: theater.name,
    description: theater.description || '',
    galacticPos: theater.galacticPos || '',
    active: theater.active !== false,
    backgroundImage: theater.backgroundImage || null,
    ...(overrides || {})
  };
}

function theaterAdminLocationBody(location, overrides) {
  return {
    name: location.name || '',
    description: location.description || '',
    galacticPos: location.galacticPos || '',
    icon: location.icon || 'token--world.svg',
    iconColor: location.iconColor || '#e0e0e0',
    iconEdgeColor: location.iconEdgeColor || '#000000',
    iconScale: Number(location.iconScale) || 1,
    visibleToPlayers: location.visibleToPlayers !== false,
    x: typeof location.x === 'number' ? location.x : null,
    y: typeof location.y === 'number' ? location.y : null,
    assignedJobIds: location.assignedJobIds || [],
    childTheaterId: location.childTheaterId || null,
    ...(overrides || {})
  };
}

function theaterAdminSetWarning(warning, show, message) {
  if (!warning) return;
  warning.hidden = !show;
  warning.textContent = show ? message : '';
}

// Mirrors getActiveJobIds in lib/theaterVisibility.js, for the editor's
// "this still holds an active mission" warnings only. Not a permission check:
// what a player actually sees is decided server-side.
function theaterAdminActiveJobIds() {
  return new Set(AdminTheaters.jobs.filter(job => job.state === 'Active').map(job => job.id));
}

function theaterAdminGetActiveJobsForTheater(theater) {
  if (!theater) return [];
  const assignedIds = new Set();
  (theater.locations || []).forEach(loc => {
    (loc.assignedJobIds || []).forEach(jobId => assignedIds.add(jobId));
  });
  const activeJobIds = theaterAdminActiveJobIds();
  return AdminTheaters.jobs.filter(job => assignedIds.has(job.id) && activeJobIds.has(job.id));
}

function theaterAdminUpdateTheaterVisibilityWarning() {
  const warning = document.getElementById('admin-theater-visibility-warning');
  const visible = document.getElementById('admin-theater-active');
  if (!warning || !visible) return;
  const activeJobs = theaterAdminGetActiveJobsForTheater(theaterAdminGetSelected());
  const showWarning = !visible.checked && activeJobs.length > 0;
  theaterAdminSetWarning(
    warning,
    showWarning,
    'Warning: this theater has active missions at one or more locations, so it will still be shown to players. Active: ' + activeJobs.map(job => job.name).join(', ')
  );
}

// ==================== Theater CRUD ====================

function theaterAdminCreate() {
  const name = prompt('Theater name:');
  if (!name) return;
  fetch('/api/theaters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        AdminTheaters.selectedTheaterId = res.theater.id;
      } else {
        alert(res.message || 'Failed to create theater');
      }
    });
}

function theaterAdminSaveDetails() {
  const theater = theaterAdminGetSelected();
  if (!theater) return;
  const body = theaterAdminTheaterBody(theater, {
    name: document.getElementById('admin-theater-name').value,
    description: document.getElementById('admin-theater-description').value,
    galacticPos: document.getElementById('admin-theater-galactic-pos').value,
    active: document.getElementById('admin-theater-active').checked
  });
  fetch('/api/theaters/' + theater.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        alert(res.message || 'Failed to save theater');
        return;
      }
      theaterAdminStoreTheater(res.theater);
      theaterAdminRender();
    });
}

function theaterAdminDelete() {
  const theater = theaterAdminGetSelected();
  if (!theater) return;
  if (!confirm('Delete theater "' + theater.name + '"?')) return;
  fetch('/api/theaters/' + theater.id, { method: 'DELETE' })
    .then(r => r.json())
    .then(res => {
      if (!res.success) alert(res.message || 'Failed to delete theater');
    });
}

function theaterAdminUploadBackground() {
  const theater = theaterAdminGetSelected();
  if (!theater) return;
  const fileInput = document.getElementById('admin-theater-bg-file');
  const status = document.getElementById('admin-theater-bg-status');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Select an image file first');
    return;
  }
  const formData = new FormData();
  formData.append('myFile', fileInput.files[0]);
  status.textContent = ' Uploading...';

  fetch('/upload/theater-background', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        status.textContent = ' Upload failed';
        alert(res.message || 'Upload failed');
        return;
      }
      status.textContent = ' Uploaded.';
      fileInput.value = '';
      // Save the new background onto the theater
      return fetch('/api/theaters/' + theater.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theaterAdminTheaterBody(theater, {
          backgroundImage: res.backgroundImage
        }))
      })
        .then(r => r.json())
        .then(update => {
          if (!update.success) throw new Error(update.message || 'Failed to save background');
          theaterAdminStoreTheater(update.theater);
          theaterAdminRenderEditor();
        });
    })
    .catch(() => {
      status.textContent = ' Upload error';
    });
}

// ==================== Background gallery ====================

// Fetch and render the gallery of previously uploaded background images.
function theaterAdminRenderGallery() {
  const gallery = document.getElementById('admin-theater-bg-gallery');
  if (!gallery) return;

  fetch('/api/theater-assets')
    .then(r => r.json())
    .then(assets => {
      gallery.innerHTML = '';
      if (!Array.isArray(assets) || assets.length === 0) {
        gallery.innerHTML = '<span class="theater-admin-muted">No uploaded images yet.</span>';
        return;
      }

      const theater = theaterAdminGetSelected();
      const currentBg = theater ? theater.backgroundImage : null;

      assets.forEach(asset => {
        const cell = document.createElement('div');
        cell.className = 'theater-bg-thumb' +
          (asset.filename === currentBg ? ' selected' : '');

        const img = document.createElement('img');
        img.src = '/theater-assets/' + encodeURIComponent(asset.filename);
        img.alt = asset.filename;
        img.title = 'Use this background';
        img.onclick = () => theaterAdminSelectBackground(asset.filename);
        cell.appendChild(img);

        // Delete button — deleting an in-use image clears it from its theater.
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'theater-bg-thumb-delete';
        del.textContent = '✕';
        del.title = asset.inUse
          ? 'In use — deleting will remove it from its theater'
          : 'Delete image';
        del.onclick = (e) => {
          e.stopPropagation();
          theaterAdminDeleteBackground(asset.filename, asset.inUse);
        };
        cell.appendChild(del);

        gallery.appendChild(cell);
      });
    })
    .catch(() => {
      gallery.innerHTML = '<span class="theater-admin-muted">Failed to load images.</span>';
    });
}

// Set the selected theater's background to an existing uploaded image.
function theaterAdminSelectBackground(filename) {
  const theater = theaterAdminGetSelected();
  if (!theater) return;
  fetch('/api/theaters/' + theater.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theaterAdminTheaterBody(theater, { backgroundImage: filename }))
  })
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        alert(res.message || 'Failed to set background');
        return;
      }
      theaterAdminStoreTheater(res.theater);
      theaterAdminRenderEditor();
    });
}

// Delete an uploaded background image. If it's in use, deleting also clears
// it from the theater(s) that reference it (handled server-side).
function theaterAdminDeleteBackground(filename, inUse) {
  const msg = inUse
    ? 'This image is in use by a theater. Deleting will remove it from that theater. Continue?'
    : 'Delete this image? This cannot be undone.';
  if (!confirm(msg)) return;
  fetch('/api/theater-assets/' + encodeURIComponent(filename), { method: 'DELETE' })
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        alert(res.message || 'Failed to delete image');
        return;
      }
      // Re-fetch theaters from the server so ALL local state (theater objects
      // and the marker-click closures created during render) uses fresh data
      // with the deleted background cleared. This prevents a stale cached
      // background from reappearing when a location marker is later clicked.
      fetch('/api/theaters')
        .then(r => r.json())
        .then(theaters => {
          AdminTheaters.theaters = theaters || [];
          if (!AdminTheaters.theaters.some(t => t.id === AdminTheaters.selectedTheaterId)) {
            AdminTheaters.selectedTheaterId = AdminTheaters.theaters[0]
              ? AdminTheaters.theaters[0].id
              : null;
          }
          theaterAdminRender();
        });
    });
}

// ==================== Rendering ====================

function theaterAdminRenderList() {
  const list = document.getElementById('admin-theater-list');
  if (!list) return;
  list.innerHTML = '';
  if (AdminTheaters.theaters.length === 0) {
    list.innerHTML = '<span class="theater-admin-empty">No theaters yet.</span>';
  }
  AdminTheaters.theaters.forEach(theater => {
    const item = document.createElement('div');
    item.className = 'theater-list-item' +
      (theater.id === AdminTheaters.selectedTheaterId ? ' active' : '') +
      (theater.active === false ? ' theater-inactive' : '');
    // Mark inactive (player-hidden) theaters for GM clarity
    item.textContent = theater.active === false
      ? theater.name + ' (inactive)'
      : theater.name;
    item.onclick = () => {
      AdminTheaters.selectedTheaterId = theater.id;
      AdminTheaters.placingMode = false;
      theaterAdminCloseLocationEditor(true);
      theaterAdminRender();
    };
    list.appendChild(item);
  });
}

function theaterAdminRenderEditor() {
  const editor = document.getElementById('admin-theater-editor');
  const viewport = document.getElementById('admin-theater-viewport');
  const theater = theaterAdminGetSelected();

  if (!editor || !viewport) return;

  if (!theater) {
    editor.hidden = true;
    return;
  }

  editor.hidden = false;
  document.getElementById('admin-theater-name').value = theater.name || '';
  document.getElementById('admin-theater-description').value = theater.description || '';
  document.getElementById('admin-theater-galactic-pos').value = theater.galacticPos || '';
  document.getElementById('admin-theater-active').checked = theater.active !== false;
  const activeCheckbox = document.getElementById('admin-theater-active');
  if (!activeCheckbox.dataset.warningBound) {
    activeCheckbox.addEventListener('change', theaterAdminUpdateTheaterVisibilityWarning);
    activeCheckbox.dataset.warningBound = 'true';
  }
  theaterAdminUpdateTheaterVisibilityWarning();

  // Render the uploaded-image gallery (highlights the current background)
  theaterAdminRenderGallery();

  // Render map + markers with drag support
  window.TheaterMap.renderFlatTheater(viewport, theater, {
    onMarkerClick: (loc) => theaterAdminOpenLocationEditor(loc)
  });

  // Enable dragging of existing markers
  theaterAdminEnableMarkerDrag(viewport, theater);

  // Placement mode click handler
  viewport.classList.toggle('placing', AdminTheaters.placingMode);
  viewport.onclick = (e) => {
    if (!AdminTheaters.placingMode) return;
    // Ignore clicks that land on an existing marker
    if (e.target.closest('.theater-marker')) return;
    const coords = window.TheaterMap.viewportClickToNormalized(viewport, e);
    AdminTheaters.pendingCoords = coords;
    AdminTheaters.placingMode = false;
    viewport.classList.remove('placing');
    theaterAdminOpenLocationEditor(null);
  };
}

function theaterAdminEnableMarkerDrag(viewport, theater) {
  const markers = viewport.querySelectorAll('.theater-marker');
  markers.forEach(marker => {
    const locId = marker.dataset.locationId;

    marker.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      let pointerDown = true;
      let dragging = AdminTheaters.editingLocationId === locId;
      const startPoint = { x: e.clientX, y: e.clientY };

      // A selected marker can move on a deliberate second press. Otherwise a
      // press must be held for 800ms before movement is enabled.
      const holdTimer = dragging ? null : setTimeout(() => {
        if (pointerDown) dragging = true;
      }, 800);
      e.stopPropagation();

      const onMouseMove = moveEvent => {
        if (!pointerDown || !dragging) return;
        moveEvent.preventDefault();
        const coords = window.TheaterMap.viewportClickToNormalized(viewport, moveEvent);
        marker.style.left = (coords.x * 100) + '%';
        marker.style.top = (coords.y * 100) + '%';
      };

      const onMouseUp = upEvent => {
        pointerDown = false;
        if (holdTimer) clearTimeout(holdTimer);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const didDrag = dragging &&
          (Math.abs(upEvent.clientX - startPoint.x) > 2 || Math.abs(upEvent.clientY - startPoint.y) > 2);
        // A plain (non-drag) click just selects the marker; the marker's own
        // click handler (renderFlatTheater) opens the editor and sets
        // editingLocationId, which is what allows a deliberate second press
        // to drag immediately.
        if (!didDrag) return;

        const coords = window.TheaterMap.viewportClickToNormalized(viewport, upEvent);
        const loc = (theater.locations || []).find(l => l.id === locId);
        if (!loc) return;
        // If this location's editor is open, persist its current (possibly
        // unsaved) form values instead of the stale last-saved object, so a
        // drag doesn't silently discard in-progress edits.
        const body = AdminTheaters.editingLocationId === locId
          ? theaterAdminGatherLocationBody(loc)
          : theaterAdminLocationBody(loc);
        theaterAdminPersistLocation(theater.id, { ...body, id: loc.id, x: coords.x, y: coords.y });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// ==================== Location editing ====================

function theaterAdminTogglePlacement() {
  AdminTheaters.placingMode = !AdminTheaters.placingMode;
  const hint = document.getElementById('admin-place-hint');
  hint.textContent = AdminTheaters.placingMode
    ? 'Click on the map to place a location.'
    : '';
  const viewport = document.getElementById('admin-theater-viewport');
  if (viewport) viewport.classList.toggle('placing', AdminTheaters.placingMode);
}

function theaterAdminSelectIcon(icon) {
  AdminTheaters.pendingIcon = icon;
  document.querySelectorAll('#admin-loc-icon-grid .theater-icon-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.icon === icon);
  });
  theaterAdminUpdateLocationPreview();
}

function theaterAdminGetPreviewLocation() {
  const theater = theaterAdminGetSelected();
  if (!theater) return null;
  const existingLoc = theaterAdminGetEditingLocation(theater);
  if (!existingLoc && !AdminTheaters.pendingCoords) return null;

  return {
    ...(existingLoc || {}),
    id: existingLoc ? existingLoc.id : '__location-preview__',
    name: document.getElementById('admin-loc-name').value || 'New Location',
    galacticPos: document.getElementById('admin-loc-galactic-pos').value || '',
    icon: AdminTheaters.pendingIcon,
    iconColor: document.getElementById('admin-loc-color').value || '#e0e0e0',
    iconScale: parseFloat(document.getElementById('admin-loc-scale').value) || 1,
    x: AdminTheaters.pendingCoords ? AdminTheaters.pendingCoords.x : existingLoc.x,
    y: AdminTheaters.pendingCoords ? AdminTheaters.pendingCoords.y : existingLoc.y
  };
}

function theaterAdminUpdateLocationPreview() {
  const preview = theaterAdminGetPreviewLocation();
  const viewport = document.getElementById('admin-theater-viewport');
  if (!preview || !viewport) return;

  let marker = viewport.querySelector(`.theater-marker[data-location-id="${preview.id}"]`);
  if (!marker) {
    const theater = theaterAdminGetSelected();
    if (!theater) return;
    const previewTheater = {
      ...theater,
      locations: [...(theater.locations || []), preview]
    };
    window.TheaterMap.renderFlatTheater(viewport, previewTheater, {
      selectedLocationId: preview.id,
      onMarkerClick: loc => {
        if (loc.id !== '__location-preview__') theaterAdminOpenLocationEditor(loc);
      }
    });
    theaterAdminEnableMarkerDrag(viewport, theater);
    marker = viewport.querySelector(`.theater-marker[data-location-id="${preview.id}"]`);
  }
  if (!marker) return;

  marker.classList.add('selected', 'preview');
  window.TheaterMap.updateFlatTheaterMarker(marker, preview);
}

function theaterAdminGetSelectedActiveJobs() {
  const selectedIds = new Set(Array.from(
    document.querySelectorAll('#admin-loc-jobs input[type="checkbox"]:checked')
  ).map(input => input.value));
  const activeJobIds = theaterAdminActiveJobIds();
  return AdminTheaters.jobs.filter(job => selectedIds.has(job.id) && activeJobIds.has(job.id));
}

function theaterAdminUpdateLocationVisibilityWarning() {
  const warning = document.getElementById('admin-loc-visibility-warning');
  const visible = document.getElementById('admin-loc-visible');
  if (!warning || !visible) return;
  const activeJobs = theaterAdminGetSelectedActiveJobs();
  const showWarning = !visible.checked && activeJobs.length > 0;
  theaterAdminSetWarning(
    warning,
    showWarning,
    'Warning: hidden locations with active missions are still shown to players. Active: ' + activeJobs.map(job => job.name).join(', ')
  );
}

function theaterAdminBindLivePreview() {
  ['admin-loc-name', 'admin-loc-galactic-pos', 'admin-loc-color', 'admin-loc-scale'].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.dataset.previewBound) {
      input.addEventListener('input', theaterAdminUpdateLocationPreview);
      input.dataset.previewBound = 'true';
    }
  });
  const visible = document.getElementById('admin-loc-visible');
  if (visible && !visible.dataset.previewBound) {
    visible.addEventListener('change', theaterAdminUpdateLocationVisibilityWarning);
    visible.dataset.previewBound = 'true';
  }
}

function theaterAdminOpenLocationEditor(loc) {
  const panel = document.getElementById('admin-location-editor');
  if (!panel) return;
  panel.hidden = false;

  // pendingCoords only belongs to a not-yet-created location; opening an
  // existing one must not let a leftover placement click overwrite its position.
  if (loc) AdminTheaters.pendingCoords = null;
  AdminTheaters.editingLocationId = loc ? loc.id : null;
  document.querySelectorAll('#admin-theater-viewport .theater-marker').forEach(marker => {
    marker.classList.toggle('selected', !!loc && marker.dataset.locationId === loc.id);
  });

  document.getElementById('admin-loc-name').value = loc ? (loc.name || '') : '';
  document.getElementById('admin-loc-description').value = loc ? (loc.description || '') : '';
  document.getElementById('admin-loc-galactic-pos').value = loc ? (loc.galacticPos || '') : '';
  document.getElementById('admin-loc-visible').checked = loc ? loc.visibleToPlayers !== false : true;
  document.getElementById('admin-loc-color').value = loc ? (loc.iconColor || '#e0e0e0') : '#e0e0e0';
  document.getElementById('admin-loc-scale').value = loc ? (loc.iconScale || 1) : 1;
  AdminTheaters.pendingIcon = loc ? (loc.icon || 'token--world.svg') : 'token--world.svg';
  theaterAdminSelectIcon(AdminTheaters.pendingIcon);
  theaterAdminBindLivePreview();

  // Populate child-theater dropdown (exclude self)
  const childSelect = document.getElementById('admin-loc-child-theater');
  const currentId = AdminTheaters.selectedTheaterId;
  childSelect.innerHTML = '<option value="">(none)</option>';
  AdminTheaters.theaters
    .filter(t => t.id !== currentId)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      childSelect.appendChild(opt);
    });
  childSelect.value = loc && loc.childTheaterId ? loc.childTheaterId : '';

  theaterAdminRenderJobChecklist(loc);
}

function theaterAdminRenderJobChecklist(loc) {
  const jobsEl = document.getElementById('admin-loc-jobs');
  if (!jobsEl) return;
  const assigned = new Set(loc ? (loc.assignedJobIds || []) : []);
  jobsEl.innerHTML = '';
  if (AdminTheaters.jobs.length === 0) {
    jobsEl.innerHTML = '<span class="theater-admin-empty">No jobs available.</span>';
    return;
  }
  AdminTheaters.jobs.forEach(job => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = job.id;
    cb.checked = assigned.has(job.id);
    cb.addEventListener('change', theaterAdminUpdateLocationVisibilityWarning);
    label.appendChild(cb);
    const text = document.createElement('span');
    text.className = 'theater-job-label-text';
    text.textContent = job.name + ' [' + (job.state || '') + ']';
    label.appendChild(text);
    jobsEl.appendChild(label);
  });
  theaterAdminUpdateLocationVisibilityWarning();
  theaterAdminUpdateLocationPreview();
}

function theaterAdminCloseLocationEditor(skipRender) {
  const panel = document.getElementById('admin-location-editor');
  if (panel) panel.hidden = true;
  AdminTheaters.editingLocationId = null;
  AdminTheaters.pendingCoords = null;
  const warning = document.getElementById('admin-loc-visibility-warning');
  theaterAdminSetWarning(warning, false, '');
  document.querySelectorAll('#admin-theater-viewport .theater-marker.selected').forEach(marker => {
    marker.classList.remove('selected');
  });
  // Discard unsaved preview changes (or the unsaved marker) from the map.
  if (!skipRender && theaterAdminGetSelected()) theaterAdminRenderEditor();
}

function theaterAdminGatherLocationBody(existingLoc) {
  const assignedJobIds = Array.from(
    document.querySelectorAll('#admin-loc-jobs input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const childVal = document.getElementById('admin-loc-child-theater').value;

  // Determine coordinates: pending (new) or from existing location
  let x = existingLoc ? existingLoc.x : null;
  let y = existingLoc ? existingLoc.y : null;
  if (AdminTheaters.pendingCoords) {
    x = AdminTheaters.pendingCoords.x;
    y = AdminTheaters.pendingCoords.y;
  }

  return theaterAdminLocationBody(existingLoc || {}, {
    name: document.getElementById('admin-loc-name').value,
    description: document.getElementById('admin-loc-description').value,
    galacticPos: document.getElementById('admin-loc-galactic-pos').value,
    icon: AdminTheaters.pendingIcon,
    iconColor: document.getElementById('admin-loc-color').value,
    iconScale: parseFloat(document.getElementById('admin-loc-scale').value) || 1,
    visibleToPlayers: document.getElementById('admin-loc-visible').checked,
    x: x,
    y: y,
    assignedJobIds: assignedJobIds,
    childTheaterId: childVal || null
  });
}

function theaterAdminSaveLocation() {
  const theater = theaterAdminGetSelected();
  if (!theater) return;

  const existingLoc = theaterAdminGetEditingLocation(theater);

  const body = theaterAdminGatherLocationBody(existingLoc);

  if (!body.name) {
    alert('Location name is required');
    return;
  }
  if (body.x === null || body.y === null) {
    alert('Place the location on the map first');
    return;
  }

  const isUpdate = !!AdminTheaters.editingLocationId;
  const url = isUpdate
    ? '/api/theaters/' + theater.id + '/locations/' + AdminTheaters.editingLocationId
    : '/api/theaters/' + theater.id + '/locations';

  fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        theaterAdminStoreTheater(res.theater);
        theaterAdminCloseLocationEditor(true);
        theaterAdminRenderEditor();
      } else {
        alert(res.message || 'Failed to save location');
      }
    });
}

// Persist a location without opening the editor (used by drag)
function theaterAdminPersistLocation(theaterId, loc) {
  fetch('/api/theaters/' + theaterId + '/locations/' + loc.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theaterAdminLocationBody(loc))
  })
    .then(r => r.json())
    .then(res => {
      if (!res.success) alert(res.message || 'Failed to move location');
    });
}

function theaterAdminDeleteLocation() {
  const theater = theaterAdminGetSelected();
  if (!theater || !AdminTheaters.editingLocationId) return;
  if (!confirm('Delete this location?')) return;
  fetch('/api/theaters/' + theater.id + '/locations/' + AdminTheaters.editingLocationId, {
    method: 'DELETE'
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        theaterAdminCloseLocationEditor(true);
      } else {
        alert(res.message || 'Failed to delete location');
      }
    });
}

// Initialize once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', theaterAdminInit);
} else {
  theaterAdminInit();
}