// Neon Coast Cover Studio — wires the page: photos in, caption typed, panels
// dragged and zoomed, cover exported as a PNG in the common post sizes.
// A `?shot=` query instead sets up a fixed scene for a screenshot (shots.js).
import { LAYOUTS, GRADES, SIZES, createDefaultState, drawCover, syncPanels, layoutSlots } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = ['woman-car', 'man-rooftop', 'friends-neon', 'man-pier'];
const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const state = createDefaultState();
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let drag = null;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** A JSON snapshot of everything undo/redo owns (photos live outside it). */
function snapshot() {
  const { photos, ...rest } = state;
  return JSON.stringify(rest);
}

function restore(json) {
  const data = JSON.parse(json);
  const photos = state.photos;
  Object.assign(state, data);
  state.photos = photos;
  syncPanels(state);
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  refreshUndoButtons();
}

function refreshUndoButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  refreshControls();
  redraw();
  refreshUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  refreshControls();
  redraw();
  refreshUndoButtons();
}

/** Redraws the preview canvas at the chosen export size. */
function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  syncPanels(state);
  drawCover(canvas, state);
  highlightSelectedPanel();
  refreshPanelControls();
}

/** Outlines the selected panel on the preview so it can be found at a glance. */
function highlightSelectedPanel() {
  if (window.__shotMode) return; // screenshots show the clean cover, no editor chrome
  const size = SIZES[state.size];
  const geo = layoutSlots(state.layout, size.w, size.h);
  const slot = geo.slots[selectedPanel];
  if (!slot) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = Math.max(3, size.w * 0.004);
  ctx.setLineDash([Math.max(8, size.w * 0.01), Math.max(6, size.w * 0.008)]);
  ctx.strokeRect(slot.x + 2, slot.y + 2, slot.w - 4, slot.h - 4);
  ctx.restore();
}

/** Refreshes the panel sliders and the photo strip from the state. */
function refreshPanelControls() {
  const panel = state.panels[selectedPanel] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
  $('panel-label').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  $('zoom').value = panel.zoom;
  $('pan-x').value = Math.round((panel.ox || 0) * 100);
  $('pan-y').value = Math.round((panel.oy || 0) * 100);
  $('zoom-val').textContent = `${panel.zoom.toFixed(2)}x`;
  $('pan-x-val').textContent = `${Math.round((panel.ox || 0) * 100)}%`;
  $('pan-y-val').textContent = `${Math.round((panel.oy || 0) * 100)}%`;
  document.querySelectorAll('#photo-strip .thumb').forEach((el, i) => {
    el.classList.toggle('assigned', panel.photo === i);
  });
}

/** Rebuilds the photo strip thumbnails from the loaded photos. */
function refreshPhotoStrip() {
  const strip = $('photo-strip');
  strip.innerHTML = '';
  state.photos.forEach((img, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.title = `Use photo ${i + 1} in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = img.currentSrc || img.src;
    thumb.alt = `Photo ${i + 1}`;
    btn.appendChild(thumb);
    btn.addEventListener('click', () => {
      pushHistory();
      state.panels[selectedPanel].photo = i;
      redraw();
    });
    strip.appendChild(btn);
  });
  $('photo-count').textContent = state.photos.length ? `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded` : 'No photos yet — load the samples or your own';
  refreshPanelControls();
}

/** Adds image files to the photo pool (at most four, oldest drops out). */
async function addPhotos(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 4);
  for (const file of list) {
    const img = await loadImage(URL.createObjectURL(file));
    if (state.photos.length >= 4) state.photos.shift();
    state.photos.push(img);
  }
  pushHistory();
  syncPanels(state);
  refreshPhotoStrip();
  redraw();
}

/** Loads the four bundled sample photos (AI-made, free to use). */
async function loadSamples() {
  for (const name of SAMPLES) {
    if (state.photos.length >= 4) break;
    const img = await loadImage(`samples/${name}.jpg`);
    state.photos.push(img);
  }
  pushHistory();
  syncPanels(state);
  refreshPhotoStrip();
  redraw();
}

/** Builds a radio-button group (layout or grade) into a container. */
function buildChoices(container, entries, current, onPick) {
  const box = $(container);
  box.innerHTML = '';
  Object.entries(entries).forEach(([key, meta]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.textContent = meta.name;
    btn.title = meta.blurb || meta.name;
    btn.setAttribute('aria-pressed', key === current ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (key === current) return;
      pushHistory();
      onPick(key);
      box.querySelectorAll('.choice').forEach((el) => el.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      redraw();
    });
    box.appendChild(btn);
  });
}

function buildSizeChoices() {
  const box = $('size-choices');
  box.innerHTML = '';
  SIZES.forEach((size, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.textContent = size.label;
    btn.setAttribute('aria-pressed', i === state.size ? 'true' : 'false');
    btn.addEventListener('click', () => {
      pushHistory();
      state.size = i;
      box.querySelectorAll('.choice').forEach((el) => el.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      redraw();
    });
    box.appendChild(btn);
  });
}

/** Downloads the current cover at W x H as a PNG. */
async function exportCover(sizeIndex) {
  const size = SIZES[sizeIndex];
  await document.fonts.ready;
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-coast-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('status').textContent = `Saved neon-coast-${size.w}x${size.h}.png`;
}

/** Syncs every control's value back from the state (after undo/redo). */
function refreshControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('title-style').value = state.titleStyle;
  $('seal').value = state.seal;
  $('billing').value = state.billing;
  $('callout').value = state.callout;
  $('heat').value = state.heat;
  $('heat-val').textContent = `${state.heat} / 5`;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  $('palms').checked = state.palms;
  $('sun').checked = state.sun;
  buildChoices('layout-choices', LAYOUTS, state.layout, (key) => { state.layout = key; selectedPanel = 0; });
  buildChoices('grade-choices', GRADES, state.grade, (key) => { state.grade = key; });
  buildSizeChoices();
  refreshPhotoStrip();
}

/** Maps a pointer event on the preview to buffer coordinates. */
function eventToBuffer(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

/** The panel slot under a buffer point, or -1. */
function panelAt(x, y) {
  const geo = layoutSlots(state.layout, canvas.width, canvas.height);
  return geo.slots.findIndex((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

function bindEvents() {
  $('photo').addEventListener('change', (e) => addPhotos(e.target.files));
  $('load-samples').addEventListener('click', loadSamples);
  $('clear-photos').addEventListener('click', () => {
    pushHistory();
    state.photos = [];
    state.panels.forEach((p) => { p.photo = 0; });
    refreshPhotoStrip();
    redraw();
  });
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('title-style').addEventListener('change', (e) => { pushHistory(); state.titleStyle = e.target.value; redraw(); });
  $('seal').addEventListener('input', (e) => { state.seal = e.target.value; redraw(); });
  $('billing').addEventListener('input', (e) => { state.billing = e.target.value; redraw(); });
  $('callout').addEventListener('input', (e) => { state.callout = e.target.value; redraw(); });
  $('heat').addEventListener('input', (e) => { state.heat = Number(e.target.value); $('heat-val').textContent = `${state.heat} / 5`; redraw(); });
  $('heat').addEventListener('change', pushHistory);
  $('grain').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; redraw(); });
  $('vignette').addEventListener('change', (e) => { pushHistory(); state.vignette = e.target.checked; redraw(); });
  $('palms').addEventListener('change', (e) => { pushHistory(); state.palms = e.target.checked; redraw(); });
  $('sun').addEventListener('change', (e) => { pushHistory(); state.sun = e.target.checked; redraw(); });
  $('zoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    redraw();
  });
  $('zoom').addEventListener('change', pushHistory);
  $('pan-x').addEventListener('input', (e) => {
    state.panels[selectedPanel].ox = Number(e.target.value) / 100;
    redraw();
  });
  $('pan-x').addEventListener('change', pushHistory);
  $('pan-y').addEventListener('input', (e) => {
    state.panels[selectedPanel].oy = Number(e.target.value) / 100;
    redraw();
  });
  $('pan-y').addEventListener('change', pushHistory);
  $('fill-panel').addEventListener('click', () => {
    pushHistory();
    const p = state.panels[selectedPanel];
    p.zoom = 1; p.ox = 0; p.oy = 0;
    redraw();
  });
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
  $('export-one').addEventListener('click', () => exportCover(state.size));
  $('export-all').addEventListener('click', async () => {
    for (let i = 0; i < SIZES.length; i++) {
      await exportCover(i);
      await new Promise((r) => setTimeout(r, 300));
    }
    $('status').textContent = 'Saved all three sizes';
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = eventToBuffer(e);
    const idx = panelAt(p.x, p.y);
    if (idx === -1) return;
    selectedPanel = idx;
    const geo = layoutSlots(state.layout, canvas.width, canvas.height);
    drag = { x: p.x, y: p.y, slot: geo.slots[idx], ox: state.panels[idx].ox || 0, oy: state.panels[idx].oy || 0, moved: false };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = eventToBuffer(e);
    const dx = (p.x - drag.x) / drag.slot.w;
    const dy = (p.y - drag.y) / drag.slot.h;
    if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;
    const panel = state.panels[selectedPanel];
    panel.ox = Math.max(-0.5, Math.min(0.5, drag.ox + dx));
    panel.oy = Math.max(-0.5, Math.min(0.5, drag.oy + dy));
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    redraw();
  }, { passive: false });
}

// A `?shot=` query sets up a fixed scene for a screenshot instead of the editor.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, { loadImage, loadSamples, redraw, refreshControls, setSelected: (i) => { selectedPanel = i; } });
} else {
  bindEvents();
  refreshControls();
  document.fonts.ready.then(() => redraw());
  redraw();
}
