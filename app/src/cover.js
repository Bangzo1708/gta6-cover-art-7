// Neon Coast Cover Studio — the cover engine.
// Draws GTA-style multi-panel poster art on a 2D canvas: photo panels with a
// Vice City neon-sunset grade, bold Anton lettering, a script subtitle, a seal,
// a billing block, palm silhouettes, a striped sun, grain and vignette.
// Everything is drawn from the state object; the same state renders at any
// export size, so the preview and the exported PNG always match.

export const LAYOUTS = {
  'vice-grid': { name: 'Vice Grid', blurb: 'Nine-panel poster grid, title block in the middle' },
  'hero-left': { name: 'Hero Left', blurb: 'One big hero photo, three stacked panels, title banner' },
  'tilted': { name: 'Tilted Snapshots', blurb: 'Sunset backdrop, tilted snapshot cards, diagonal title' },
  'full-bleed': { name: 'Full Bleed', blurb: 'One photo edge to edge, title over the foot' },
  'duo': { name: 'Duo Split', blurb: 'Two tall panels, title band across the middle' },
  'trio': { name: 'Trio Band', blurb: 'Three vertical bands, the middle one taller' },
};

export const GRADES = {
  'neon-sunset': { name: 'Neon Sunset', filter: 'saturate(1.35) contrast(1.08) sepia(0.18) hue-rotate(-8deg)', top: '#ff2e88', bottom: '#ff7a1a', alpha: 0.26 },
  'vice-nights': { name: 'Vice Nights', filter: 'saturate(1.5) contrast(1.12) hue-rotate(15deg)', top: '#00e5ff', bottom: '#ff2e88', alpha: 0.28 },
  'golden-hour': { name: 'Golden Hour', filter: 'saturate(1.3) sepia(0.35) contrast(1.05)', top: '#ffd166', bottom: '#ff5e3a', alpha: 0.24 },
  'palm-noir': { name: 'Palm Noir', filter: 'grayscale(0.85) contrast(1.25) brightness(1.06)', top: '#1de9b6', bottom: '#0d1b2a', alpha: 0.18 },
  'hot-pink': { name: 'Hot Pink', filter: 'saturate(1.6) hue-rotate(-25deg) contrast(1.1)', top: '#ff5da2', bottom: '#7b2ff7', alpha: 0.3 },
};

export const SIZES = [
  { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

/** A fresh default state. `photos` holds loaded images (or null slots). */
export function createDefaultState() {
  return {
    layout: 'vice-grid',
    grade: 'neon-sunset',
    size: 0,
    title: 'NEON SHORE',
    subtitle: 'Vice City Nights',
    titleStyle: 'sunset',
    seal: 'EST. 2026',
    billing: 'A VICE CITY STORY  •  STARRING YOU  •  COMING SOON',
    callout: 'NEW',
    heat: 4,
    grain: true,
    vignette: true,
    palms: true,
    sun: true,
    // One entry per panel slot of the current layout; photo is an index into
    // the photos array, zoom a multiplier, ox/oy a pan as a fraction of the slot.
    panels: [],
    photos: [],
  };
}

/** Deterministic pseudo-random generator (mulberry32) so grain never changes a render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel rectangles (and the title zone) of a layout at W x H. */
export function layoutSlots(layout, W, H) {
  const m = Math.round(Math.min(W, H) * 0.028); // outer poster frame
  const g = Math.round(Math.min(W, H) * 0.011); // gutter between panels
  const inner = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  const billingH = Math.round(H * 0.028);
  const body = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - billingH };
  const slots = [];
  const push = (x, y, w, h) => slots.push({ x, y, w, h });
  let title = null;
  let seal = null;
  let banner = null;
  if (layout === 'vice-grid') {
    const cw = (body.w - 2 * g) / 3;
    const ch = (body.h - 2 * g) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue;
        push(body.x + c * (cw + g), body.y + r * (ch + g), cw, ch);
      }
    }
    title = { x: body.x + cw + g, y: body.y + ch + g, w: cw, h: ch, kind: 'block' };
    seal = { x: body.x + body.w - Math.round(cw * 0.34), y: body.y + Math.round(ch * 0.16), r: Math.round(cw * 0.17) };
  } else if (layout === 'hero-left') {
    const heroW = Math.round(body.w * 0.62);
    const colW = body.w - heroW - g;
    const ch = (body.h - 2 * g) / 3;
    push(body.x, body.y, heroW, body.h);
    for (let r = 0; r < 3; r++) push(body.x + heroW + g, body.y + r * (ch + g), colW, ch);
    banner = { x: body.x, y: body.y + body.h - Math.round(body.h * 0.24), w: body.w, h: Math.round(body.h * 0.24) };
    title = { x: banner.x + g, y: banner.y, w: banner.w - 2 * g, h: banner.h, kind: 'banner' };
    seal = { x: body.x + heroW - Math.round(heroW * 0.1), y: body.y + Math.round(body.h * 0.09), r: Math.round(heroW * 0.055) };
  } else if (layout === 'tilted') {
    const cw = Math.round(body.w * 0.44);
    const ch = Math.round(body.h * 0.42);
    push(body.x + Math.round(body.w * 0.03), body.y + Math.round(body.h * 0.34), cw, ch, -6);
    push(body.x + Math.round(body.w * 0.5), body.y + Math.round(body.h * 0.3), cw, ch, 4);
    push(body.x + Math.round(body.w * 0.26), body.y + Math.round(body.h * 0.52), cw, ch, -2);
    title = { x: body.x, y: body.y + Math.round(body.h * 0.04), w: body.w, h: Math.round(body.h * 0.22), kind: 'diagonal' };
    seal = { x: body.x + body.w - Math.round(body.w * 0.09), y: body.y + Math.round(body.h * 0.2), r: Math.round(body.w * 0.05) };
  } else if (layout === 'full-bleed') {
    push(body.x, body.y, body.w, body.h);
    banner = { x: body.x, y: body.y + body.h - Math.round(body.h * 0.3), w: body.w, h: Math.round(body.h * 0.3) };
    title = { x: banner.x + g, y: banner.y, w: banner.w - 2 * g, h: banner.h, kind: 'banner' };
    seal = { x: body.x + body.w - Math.round(body.w * 0.08), y: body.y + Math.round(body.h * 0.08), r: Math.round(body.w * 0.045) };
  } else if (layout === 'duo') {
    const cw = (body.w - g) / 2;
    push(body.x, body.y, cw, body.h);
    push(body.x + cw + g, body.y, cw, body.h);
    banner = { x: body.x, y: body.y + Math.round(body.h * 0.38), w: body.w, h: Math.round(body.h * 0.24) };
    title = { x: banner.x + g, y: banner.y, w: banner.w - 2 * g, h: banner.h, kind: 'band' };
    seal = { x: body.x + body.w - Math.round(body.w * 0.07), y: body.y + Math.round(body.h * 0.07), r: Math.round(body.w * 0.04) };
  } else { // trio
    const cw = (body.w - 2 * g) / 3;
    const tall = Math.round(body.h * 0.06);
    push(body.x, body.y + tall, cw, body.h - 2 * tall);
    push(body.x + cw + g, body.y, cw, body.h);
    push(body.x + 2 * (cw + g), body.y + tall, cw, body.h - 2 * tall);
    title = { x: body.x, y: body.y + Math.round(body.h * 0.02), w: body.w, h: Math.round(body.h * 0.16), kind: 'top' };
    seal = { x: body.x + body.w - Math.round(body.w * 0.07), y: body.y + body.h - Math.round(body.h * 0.07), r: Math.round(body.w * 0.04) };
  }
  return { slots, title, seal, banner, billing: { x: inner.x, y: inner.y + inner.h - billingH, w: inner.w, h: billingH }, frame: m, gutter: g };
}

/** Draws one photo into a slot, cover-fit, with the panel's zoom and pan. */
function drawPhotoInto(ctx, img, slot, grade) {
  if (!img) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  if (slot.rotate) {
    ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
    ctx.rotate((slot.rotate * Math.PI) / 180);
    ctx.translate(-(slot.x + slot.w / 2), -(slot.y + slot.h / 2));
  }
  const zoom = slot.zoom || 1;
  const scale = Math.max(slot.w / img.naturalWidth, slot.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = slot.x + slot.w / 2 + (slot.ox || 0) * slot.w;
  const cy = slot.y + slot.h / 2 + (slot.oy || 0) * slot.h;
  ctx.filter = grade.filter;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  // Grade wash: a two-stop gradient in overlay blend, stronger at the foot.
  const wash = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
  wash.addColorStop(0, hexA(grade.top, grade.alpha * 0.7));
  wash.addColorStop(1, hexA(grade.bottom, grade.alpha));
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.globalCompositeOperation = 'source-over';
  // Thin inner shade so panels read as separate frames.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2, slot.w * 0.008);
  ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Fits the title text into a zone, shrinking the font until it fits. */
function fitFont(ctx, text, zoneW, startSize, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > zoneW) {
    size = Math.max(12, size - 2);
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** A five-point star path centred at (cx, cy) with outer radius r. */
function starPath(ctx, cx, cy, r) {
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The round seal: double ring, star, and the seal text beneath it. */
function drawSeal(ctx, seal, text, grade) {
  if (!seal) return;
  const { x, y, r } = seal;
  ctx.save();
  ctx.fillStyle = '#fff8e7';
  ctx.strokeStyle = '#1d0b2e';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = grade.bottom;
  starPath(ctx, x, y - r * 0.12, r * 0.42);
  ctx.fill();
  ctx.fillStyle = '#1d0b2e';
  ctx.font = `bold ${Math.max(9, Math.round(r * 0.26))}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + r * 0.52);
  ctx.restore();
}

/** A stylised palm silhouette, trunk plus drooping fronds, in one colour. */
function drawPalm(ctx, x, y, s, colour, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (lean < 0 ? -1 : 1), s);
  ctx.fillStyle = colour;
  // Trunk: a gentle curve, wider at the base.
  ctx.beginPath();
  ctx.moveTo(-0.09, 0);
  ctx.quadraticCurveTo(0.0, -0.55, 0.14, -0.95);
  ctx.lineTo(0.26, -0.95);
  ctx.quadraticCurveTo(0.12, -0.5, 0.07, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: seven full leaves fanning from the crown, each a filled lens shape
  // that droops toward its tip, so the silhouette reads at any size.
  const crownX = 0.2;
  const crownY = -0.95;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.04 + i * 0.15);
    const len = 0.52 + (i % 3) * 0.09;
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * len * 0.75 + 0.1;
    const mid1X = crownX + Math.cos(a - 0.32) * len * 0.55;
    const mid1Y = crownY + Math.sin(a - 0.32) * len * 0.55 - 0.06;
    const mid2X = crownX + Math.cos(a + 0.32) * len * 0.55;
    const mid2Y = crownY + Math.sin(a + 0.32) * len * 0.55 + 0.08;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(mid1X, mid1Y, tipX, tipY);
    ctx.quadraticCurveTo(mid2X, mid2Y, crownX, crownY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A synthwave sun: a gradient disc cut by horizontal slats that widen downward. */
function drawSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, grade.bottom);
  grad.addColorStop(1, grade.top);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Slats: bars of the backdrop colour, thicker toward the bottom.
  ctx.fillStyle = 'rgba(29,11,46,0.9)';
  let y = cy + r * 0.05;
  let h = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, h);
    y += h + r * 0.11;
    h *= 1.45;
  }
  ctx.restore();
}

/** Halftone dots across a zone, fading toward the bottom. */
function drawHalftone(ctx, zone, colour) {
  const step = Math.max(10, Math.round(zone.w / 34));
  ctx.save();
  for (let y = zone.y + step / 2; y < zone.y + zone.h; y += step) {
    const fade = 1 - (y - zone.y) / zone.h;
    for (let x = zone.x + step / 2; x < zone.x + zone.w; x += step) {
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.16 * fade;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, step * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Film grain from a seeded pattern, so every render is byte-identical. */
function drawGrain(ctx, W, H) {
  const s = 128;
  const noise = document.createElement('canvas');
  noise.width = s; noise.height = s;
  const nctx = noise.getContext('2d');
  const img = nctx.createImageData(s, s);
  const rnd = mulberry32(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
  }
  nctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(noise, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(10,2,20,0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** The title lettering inside its zone, in the chosen title style. */
function drawTitle(ctx, zone, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pad = zone.w * 0.05;
  if (zone.kind === 'diagonal') ctx.translate(zone.x + zone.w / 2, zone.y + zone.h / 2), ctx.rotate(-0.045), ctx.translate(-(zone.x + zone.w / 2), -(zone.y + zone.h / 2));
  if (zone.kind === 'block') {
    // Dark title block with halftone and a mini sun.
    ctx.fillStyle = '#1d0b2e';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    drawHalftone(ctx, zone, '#ff2e88');
    if (state.sun) drawSun(ctx, zone.x + zone.w / 2, zone.y + zone.h * 0.3, zone.w * 0.17, grade);
  }
  const titleSize = fitFont(ctx, title, zone.w - 2 * pad, Math.round(zone.h * (zone.kind === 'block' ? 0.26 : 0.42)), 'Anton, sans-serif', '400');
  const ty = zone.y + zone.h * (zone.kind === 'block' ? 0.62 : 0.44);
  ctx.font = `400 ${titleSize}px Anton, sans-serif`;
  if (state.titleStyle === 'sunset') {
    const tg = ctx.createLinearGradient(zone.x, ty - titleSize / 2, zone.x, ty + titleSize / 2);
    tg.addColorStop(0, '#ffe259'); tg.addColorStop(0.5, grade.bottom); tg.addColorStop(1, grade.top);
    ctx.fillStyle = tg;
  } else if (state.titleStyle === 'neon') {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = grade.top;
    ctx.shadowBlur = titleSize * 0.35;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.lineWidth = Math.max(2, titleSize * 0.045);
  ctx.strokeStyle = zone.kind === 'block' ? 'rgba(0,0,0,0.55)' : 'rgba(20,4,32,0.85)';
  ctx.strokeText(title, zone.x + zone.w / 2, ty);
  ctx.fillText(title, zone.x + zone.w / 2, ty);
  ctx.shadowBlur = 0;
  if (sub) {
    const subSize = Math.max(12, Math.round(titleSize * 0.34));
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f4';
    ctx.shadowColor = grade.top;
    ctx.shadowBlur = subSize * 0.4;
    ctx.fillText(sub, zone.x + zone.w / 2, ty + titleSize * 0.62 + subSize * 0.4);
    ctx.shadowBlur = 0;
  }
  if (zone.kind === 'block') {
    // Heat meter: stars under the subtitle.
    const starR = Math.max(6, Math.round(zone.w * 0.035));
    const gap = starR * 2.6;
    const total = gap * 4;
    const y = zone.y + zone.h * 0.88;
    for (let i = 0; i < 5; i++) {
      const x = zone.x + zone.w / 2 - total / 2 + i * gap;
      ctx.fillStyle = i < state.heat ? '#ffd166' : 'rgba(255,255,255,0.25)';
      starPath(ctx, x, y, starR);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A small rotated callout chip pinned to the first photo panel. */
function drawCallout(ctx, slot, text, grade) {
  if (!text || !slot) return;
  ctx.save();
  const fs = Math.max(11, Math.round(slot.w * 0.055));
  ctx.font = `400 ${fs}px Anton, sans-serif`;
  const tw = ctx.measureText(text.toUpperCase()).width;
  const w = tw + fs * 1.1;
  const h = fs * 1.7;
  const x = slot.x + slot.w * 0.06;
  const y = slot.y + slot.h * 0.07;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.1);
  ctx.fillStyle = grade.top;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, fs * 0.09);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 0, fs * 0.06);
  ctx.restore();
}

/** Renders the whole cover onto `canvas` (at its own pixel size) from `state`. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] || GRADES['neon-sunset'];
  const geo = layoutSlots(state.layout, W, H);

  // Poster frame: warm white, like a printed sleeve.
  ctx.fillStyle = '#fff8ec';
  ctx.fillRect(0, 0, W, H);

  // Backdrop for the layouts that show sky: a sunset gradient with sun + palms.
  // It stops above the billing band, so the billing text sits on the white frame.
  const backBottom = geo.billing.y;
  if (state.layout === 'tilted' || state.layout === 'trio') {
    const sky = ctx.createLinearGradient(0, geo.frame, 0, backBottom);
    sky.addColorStop(0, '#2b1055');
    sky.addColorStop(0.45, grade.top);
    sky.addColorStop(0.8, grade.bottom);
    sky.addColorStop(1, '#ff7a1a');
    ctx.fillStyle = sky;
    ctx.fillRect(geo.frame, geo.frame, W - 2 * geo.frame, backBottom - geo.frame);
    if (state.sun) drawSun(ctx, W * 0.5, H * 0.26, Math.min(W, H) * 0.13, grade);
    if (state.palms) {
      drawPalm(ctx, geo.frame + W * 0.02, backBottom, Math.min(W, H) * 0.32, '#160a24', 1);
      drawPalm(ctx, W - geo.frame - W * 0.02, backBottom, Math.min(W, H) * 0.26, '#160a24', -1);
    }
  } else {
    ctx.fillStyle = '#1d0b2e';
    ctx.fillRect(geo.frame, geo.frame, W - 2 * geo.frame, backBottom - geo.frame);
  }

  // Photo panels, in layout order.
  const photos = state.photos || [];
  geo.slots.forEach((slot, i) => {
    const panel = state.panels[i] || {};
    const photoIndex = panel.photo ?? (i % Math.max(1, photos.length));
    const img = photos[photoIndex] || null;
    if (!img) {
      // Empty panel: a graded placeholder so the grid still reads as a poster.
      ctx.save();
      ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
      const g2 = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
      g2.addColorStop(0, grade.top); g2.addColorStop(1, grade.bottom);
      ctx.fillStyle = g2; ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `400 ${Math.max(12, Math.round(slot.w * 0.09))}px Anton, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.restore();
      return;
    }
    drawPhotoInto(ctx, img, { ...slot, zoom: panel.zoom ?? 1, ox: panel.ox ?? 0, oy: panel.oy ?? 0 }, grade);
  });

  // Banner wash under the title for banner layouts.
  if (geo.banner) {
    const wash = ctx.createLinearGradient(0, geo.banner.y, 0, geo.banner.y + geo.banner.h);
    wash.addColorStop(0, 'rgba(20,4,32,0)');
    wash.addColorStop(0.45, 'rgba(20,4,32,0.72)');
    wash.addColorStop(1, 'rgba(20,4,32,0.88)');
    ctx.fillStyle = wash;
    ctx.fillRect(geo.banner.x, geo.banner.y, geo.banner.w, geo.banner.h);
  }

  if (geo.title) drawTitle(ctx, geo.title, state, grade);
  drawSeal(ctx, geo.seal, state.seal, grade);
  drawCallout(ctx, geo.slots[0], state.callout, grade);

  // Billing block on the bottom frame band.
  const bs = Math.max(9, Math.round(geo.billing.h * 0.52));
  ctx.save();
  ctx.fillStyle = '#241631';
  ctx.font = `700 ${bs}px system-ui, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, bs * 0.12)}px`; } catch { /* older canvas: no letter spacing */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.billing || '', geo.billing.x + geo.billing.w / 2, geo.billing.y + geo.billing.h / 2 + bs * 0.08);
  ctx.restore();

  if (state.grain) drawGrain(ctx, W, H);
  if (state.vignette) drawVignette(ctx, W, H);
}

/** Renders the cover at W x H into a fresh canvas and returns it. */
export function renderCoverToCanvas(W, H, state) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas, state);
  return canvas;
}

/** Makes sure the panel list matches the current layout's slot count. */
export function syncPanels(state) {
  const geo = layoutSlots(state.layout, 1080, 1080);
  const count = geo.slots.length;
  const photos = state.photos || [];
  const next = [];
  for (let i = 0; i < count; i++) {
    const old = state.panels[i] || {};
    next.push({
      photo: old.photo ?? (photos.length ? i % photos.length : 0),
      zoom: old.zoom ?? 1,
      ox: old.ox ?? 0,
      oy: old.oy ?? 0,
    });
  }
  state.panels = next;
}
