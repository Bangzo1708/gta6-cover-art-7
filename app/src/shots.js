// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// ?shot=editor shows the page with photos loaded. `size` picks the export size
// (0 square, 1 portrait, 2 wide), `layout` and `grade` pick the look, `photo`
// picks the lead sample, `title` and `subtitle` the words.
// window.__shotReady is set once the scene is painted.
import { SIZES, syncPanels } from './cover.js';

const SAMPLES = ['woman-car', 'man-rooftop', 'friends-neon', 'man-pier'];

export async function runShot(shot, query, state, helpers) {
  window.__shotMode = true;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  state.layout = query.get('layout') || 'vice-grid';
  state.grade = query.get('grade') || 'neon-sunset';
  state.size = Number(query.get('size') ?? 2);
  if (!SIZES[state.size]) state.size = 2;
  state.title = query.get('title') || 'NEON SHORE';
  state.subtitle = query.get('subtitle') || 'Vice City Nights';
  state.titleStyle = query.get('titleStyle') || 'sunset';
  state.callout = query.get('callout') || 'NEW';
  state.heat = Number(query.get('heat') ?? 4);
  // Load the samples in a fixed order with the requested lead photo first.
  const lead = query.get('photo') || 'woman-car';
  const order = [lead, ...SAMPLES.filter((s) => s !== lead)];
  for (const name of order) {
    state.photos.push(await helpers.loadImage(`samples/${name}.jpg`));
  }
  // Give the panels a lived-in look: the hero panel zoomed in a little.
  syncPanels(state);
  if (state.layout === 'vice-grid') {
    state.panels[0].zoom = 1.15;
    state.panels[0].oy = -0.04;
    state.panels[4].zoom = 1.1;
  } else if (state.layout === 'hero-left') {
    state.panels[0].zoom = 1.12;
    state.panels[0].ox = 0.05;
  } else if (state.layout === 'tilted') {
    state.panels[1].zoom = 1.15;
  }
  await document.fonts.ready;
  await document.fonts.load('100px Anton');
  await document.fonts.load('40px Pacifico');
  helpers.redraw();
  helpers.setSelected(0);
  if (shot === 'editor') helpers.refreshControls();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
