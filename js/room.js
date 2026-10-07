// ΩΤΚ Companion — the Big's room, and the furniture in it.
// A room on the second floor of the chapter house: painted plaster above an oxblood wainscot, a brass picture rail, an oak floor, one tall window with the curtains
// open, a bookshelf in place of a hearth, a white door, a floor lamp in the corner and the chapter's letters on the wall. The furniture is plain: a chair with an
// oxblood seat (the one the player sits in, and the one a sister can bend over) and a desk (what a sister bends over at full height). Everything is built from
// boxes and canvas-drawn textures, so there are no assets to load. The sizes are those of the room the scene was built for, so nothing about the scene moves.
(function (root) {
'use strict';
const T = root.THREE, S = root.Starlight;
const lin = hex => new T.Color(hex).convertSRGBToLinear();

// ── Textures ────────────────────────────────────────────────────
function rngFor(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
const shade = (base, k) => { const r = (base >> 16 & 255) * k, g = (base >> 8 & 255) * k, b = (base & 255) * k; return `rgb(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))})`; };

// Boards running along the texture's x, with grain and a few joins.
function plankTexture(base, boards, seed, repeat) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rngFor(seed), bh = h / boards;
    for (let i = 0; i < boards; i++) {
      const y = i * bh, tone = 0.88 + r() * 0.24;
      ctx.fillStyle = shade(base, tone); ctx.fillRect(0, y, w, bh);
      for (let k = 0; k < 22; k++) {   // grain
        ctx.strokeStyle = shade(base, tone * (0.8 + r() * 0.16)); ctx.globalAlpha = 0.22 + r() * 0.22; ctx.lineWidth = 0.6 + r() * 1.1;
        const gy = y + 2 + r() * (bh - 4); ctx.beginPath(); ctx.moveTo(0, gy);
        ctx.bezierCurveTo(w * 0.3, gy + (r() - 0.5) * 4, w * 0.6, gy + (r() - 0.5) * 4, w, gy + (r() - 0.5) * 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const cut = r() * w; ctx.fillStyle = shade(base, 0.5); ctx.fillRect(cut, y, 1.5, bh);     // butt joint
      ctx.fillStyle = shade(base, 0.42); ctx.fillRect(0, y, w, 2);                              // seam
    }
  }, repeat);
}
// Painted plaster: a flat colour with a soft mottling and a little light from above.
function paintTexture(base, seed, repeat) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rngFor(seed);
    ctx.fillStyle = shade(base, 1); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '90,70,60'},${0.012 + r() * 0.03})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, 8 + r() * 46, 0, 6.3); ctx.fill(); }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,248,236,0.10)'); g.addColorStop(1, 'rgba(40,24,20,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, repeat);
}
// The chapter's letters: brass on a dark ground, in a frame.
function lettersTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a1219'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b4924c'; ctx.lineWidth = 6; ctx.strokeRect(14, 14, w - 28, h - 28); ctx.lineWidth = 2; ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.fillStyle = '#c9a65a'; ctx.font = '600 118px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ΩΤΚ', w / 2, h / 2 + 6);
  });
}

const matCache = {};
function wood(color, seed = 1, boards = 3, repeat = null) {
  const k = [color, seed, boards, repeat && repeat.join('x')].join('|');
  return matCache[k] || (matCache[k] = new T.MeshStandardMaterial({ map: plankTexture(color, boards, seed, repeat || [1, 1]), roughness: 0.7, metalness: 0 }));
}
const flat = (color, rough = 0.85, metal = 0) => { const k = 'flat' + color + rough + metal; return matCache[k] || (matCache[k] = new T.MeshStandardMaterial({ color: lin(color), roughness: rough, metalness: metal })); };
const box = (w, h, d, mat, x, y, z, cast = true) => {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m;
};

// ── Furniture ───────────────────────────────────────────────────
// The chair: an upholstered seat on four square legs with stretchers and a low slatted back. Seat W wide (x), D deep (z), `top` high,
// back to −z. Dimensions are those of the seat the engine builds for the player, so nothing about the scene moves.
function buildChair(top, W = 0.42, D = 0.46) {
  const g = new T.Group(), frame = wood(0x4a3426, 11, 4, [1, 1]), dark = wood(0x3a2a1f, 12, 2, [1, 1]), seat = flat(0x6e2430, 0.9);
  g.add(box(W, 0.035, D, seat, 0, top - 0.0175, 0));
  const lw = 0.042, lh = top - 0.035, inx = W / 2 - 0.03, inz = D / 2 - 0.03;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(lw, lh, lw, dark, sx * inx, lh / 2, sz * inz));
  for (const sz of [-1, 1]) g.add(box(2 * inx, 0.025, 0.025, dark, 0, 0.2, sz * inz));   // front and back stretchers
  for (const sx of [-1, 1]) g.add(box(0.025, 0.025, 2 * inz, dark, sx * inx, 0.24, 0));  // side stretchers
  const bz = -inz, bh = 0.4;
  for (const sx of [-1, 1]) g.add(box(lw, bh, lw, dark, sx * inx, top + bh / 2 - 0.02, bz));   // rear posts, rising from the seat
  for (const y of [0.15, 0.31]) g.add(box(2 * inx - lw, 0.075, 0.02, frame, 0, top + y, bz));   // two slats
  return g;
}
// The desk: a thick oak top (surface exactly at `top`) on four stout legs, an apron and a low stretcher.
// Runs x0…x1 along x and is `W` deep; the legs are kept out near the corners, clear of anyone bent over the middle of it.
function buildTable(top, x0, x1, W = 0.9) {
  const g = new T.Group(), L = x1 - x0, cx = (x0 + x1) / 2, th = 0.05;
  const wd = wood(0x9a7549, 21, 4, [Math.max(1, L / 0.9), 1]), dark = wood(0x4a3426, 22, 2, [1, 1]);
  g.add(box(L, th, W, wd, cx, top - th / 2, 0));
  const lw = 0.075, lh = top - th, inx = L / 2 - 0.07, inz = W / 2 - 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(lw, lh, lw, dark, cx + sx * inx, lh / 2, sz * inz));
  for (const sz of [-1, 1]) g.add(box(2 * inx, 0.09, 0.03, dark, cx, top - th - 0.045, sz * inz));
  for (const sx of [-1, 1]) g.add(box(0.03, 0.09, 2 * inz, dark, cx + sx * inx, top - th - 0.045, 0));
  g.add(box(2 * inx, 0.04, 0.04, dark, cx, 0.22, inz)); g.add(box(2 * inx, 0.04, 0.04, dark, cx, 0.22, -inz));
  return g;
}
function disposeGroup(g) { g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }   // (the materials are shared and cached)

// ── The room ────────────────────────────────────────────────────
const HALF = 3.6, HEIGHT = 2.65, RAIL = 1.05;   // (RAIL: the height of the wainscot)
function buildRoom(scene) {
  const g = new T.Group(); g.name = 'room';
  const floorMat = new T.MeshStandardMaterial({ map: plankTexture(0xb08a5a, 9, 7, [HALF * 2 / 2.2, HALF * 2 / 2.2]), roughness: 0.62 });
  const floor = new T.Mesh(new T.PlaneGeometry(HALF * 2, HALF * 2), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // Walls: plaster above, an oxblood wainscot below, a brass rail between. (Each wall is two planes.)
  const upper = new T.MeshStandardMaterial({ map: paintTexture(0xe8dccf, 5, [2, 1]), roughness: 0.95 });
  const lower = new T.MeshStandardMaterial({ map: paintTexture(0x5d2431, 6, [2, 1]), roughness: 0.8 });
  const walls = [[0, -HALF, 0], [0, HALF, Math.PI], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]];
  for (const [x, z, ry] of walls) {
    const w = new T.Mesh(new T.PlaneGeometry(HALF * 2, HEIGHT - RAIL), upper); w.position.set(x, RAIL + (HEIGHT - RAIL) / 2, z); w.rotation.y = ry; w.receiveShadow = true; g.add(w);
    const l = new T.Mesh(new T.PlaneGeometry(HALF * 2, RAIL), lower); l.position.set(x, RAIL / 2, z); l.rotation.y = ry; l.receiveShadow = true; g.add(l);
  }
  const brass = flat(0xb4924c, 0.4, 0.7), white = flat(0xf3eee6, 0.7);
  g.add(box(HALF * 2, 0.045, 0.03, brass, 0, RAIL, -HALF + 0.015, false), box(HALF * 2, 0.045, 0.03, brass, 0, RAIL, HALF - 0.015, false),
    box(0.03, 0.045, HALF * 2, brass, -HALF + 0.015, RAIL, 0, false), box(0.03, 0.045, HALF * 2, brass, HALF - 0.015, RAIL, 0, false));
  const ceil = new T.Mesh(new T.PlaneGeometry(HALF * 2, HALF * 2), new T.MeshStandardMaterial({ color: lin(0xf1ece4), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = HEIGHT; g.add(ceil);
  // crown moulding and skirting board
  g.add(box(HALF * 2, 0.1, 0.06, white, 0, HEIGHT - 0.05, -HALF + 0.03, false), box(HALF * 2, 0.1, 0.06, white, 0, HEIGHT - 0.05, HALF - 0.03, false),
    box(0.06, 0.1, HALF * 2, white, -HALF + 0.03, HEIGHT - 0.05, 0, false), box(0.06, 0.1, HALF * 2, white, HALF - 0.03, HEIGHT - 0.05, 0, false));
  g.add(box(HALF * 2, 0.14, 0.04, white, 0, 0.07, -HALF + 0.02, false), box(HALF * 2, 0.14, 0.04, white, 0, 0.07, HALF - 0.02, false),
    box(0.04, 0.14, HALF * 2, white, -HALF + 0.02, 0.07, 0, false), box(0.04, 0.14, HALF * 2, white, HALF - 0.02, 0.07, 0, false));

  // Window in the west wall: a white frame, a bright pane with muntins, curtains open at each side on a brass rod.
  const wy = 1.55, wz = -0.9, wx = -HALF;
  g.add(box(0.12, 1.3, 0.08, white, wx + 0.06, wy, wz - 0.65), box(0.12, 1.3, 0.08, white, wx + 0.06, wy, wz + 0.65),
    box(0.12, 0.08, 1.38, white, wx + 0.06, wy + 0.65, wz), box(0.12, 0.08, 1.38, white, wx + 0.06, wy - 0.65, wz));
  const pane = new T.Mesh(new T.PlaneGeometry(1.22, 1.22), new T.MeshBasicMaterial({ color: lin(0xfff6e0) })); pane.position.set(wx + 0.03, wy, wz); pane.rotation.y = Math.PI / 2; g.add(pane);
  g.add(box(0.03, 1.22, 0.025, white, wx + 0.05, wy, wz, false), box(0.03, 0.025, 1.22, white, wx + 0.05, wy, wz, false));
  g.add(box(0.2, 0.06, 1.5, white, wx + 0.12, wy - 0.7, wz, false));   // sill
  const curtain = flat(0xc9a6a0, 0.95);
  for (const s of [-1, 1]) g.add(box(0.07, 1.7, 0.36, curtain, wx + 0.14, wy - 0.05, wz + s * 0.9, false));
  g.add(box(0.04, 0.04, 2.0, brass, wx + 0.14, wy + 0.82, wz, false));

  // A bookshelf in the east wall, in place of a hearth: a tall unit with shelves, books of every colour, and the house paddle on the top shelf's brackets.
  const hx = HALF - 0.18, hz = 0.2, shelfW = 1.9, unit = wood(0x6a4a30, 61, 4, [2, 1]);
  g.add(box(0.34, 2.15, 0.05, unit, hx, 1.075, hz - shelfW / 2), box(0.34, 2.15, 0.05, unit, hx, 1.075, hz + shelfW / 2), box(0.04, 2.15, shelfW, unit, hx + 0.15, 1.075, hz, false));
  const spines = [0x6e2430, 0x2f4a5c, 0xb4924c, 0x3d5a40, 0x8a5a3a, 0xe8ddc8, 0x4a3a5e, 0xa24a3a], r = rngFor(77);
  for (let i = 0; i < 6; i++) {
    const y = 0.35 + i * 0.36;
    g.add(box(0.32, 0.03, shelfW, unit, hx, y, hz, false));
    if (i === 5) continue;
    let z = hz - shelfW / 2 + 0.08;
    while (z < hz + shelfW / 2 - 0.12) {
      const bw = 0.025 + r() * 0.035, bh = 0.2 + r() * 0.11;
      if (r() < 0.08) { z += 0.12; continue; }
      g.add(box(0.22, bh, bw, flat(spines[Math.floor(r() * spines.length)], 0.8), hx - 0.02, y + 0.015 + bh / 2, z + bw / 2, false)); z += bw + 0.004;
    }
  }
  // the house paddle, resting on two brass brackets on the wall beside the shelf
  const px = HALF - 0.06, pz = -2.35, plate = flat(0x6a4a30, 0.6);
  g.add(box(0.03, 0.05, 0.06, brass, px - 0.01, 1.62, pz - 0.32, false), box(0.03, 0.05, 0.06, brass, px - 0.01, 1.62, pz + 0.32, false));
  g.add(box(0.025, 0.07, 0.44, plate, px - 0.03, 1.66, pz + 0.12, false), box(0.02, 0.01, 0.2, flat(0xb4924c, 0.4, 0.7), px - 0.045, 1.66, pz + 0.12, false));   // blade, with a brass plate
  g.add(box(0.025, 0.03, 0.2, plate, px - 0.03, 1.66, pz - 0.2, false));   // handle

  // Door in the north wall: a white six-panel door in a white frame, with a brass handle.
  const dz = -HALF + 0.05, dx = 1.6, doorW = flat(0xf3eee6, 0.7);
  g.add(box(1.0, 2.05, 0.05, doorW, dx, 1.025, dz), box(0.1, 2.15, 0.1, white, dx - 0.55, 1.075, dz, false), box(0.1, 2.15, 0.1, white, dx + 0.55, 1.075, dz, false), box(1.2, 0.1, 0.1, white, dx, 2.15, dz, false));
  const panelM = flat(0xe4ddd1, 0.75);
  for (const py of [0.48, 1.04, 1.62]) for (const sx of [-0.2, 0.2]) g.add(box(0.3, py === 1.04 ? 0.36 : 0.44, 0.012, panelM, dx + sx, py, dz + 0.03, false));
  g.add(box(0.1, 0.03, 0.05, brass, dx - 0.38, 1.0, dz + 0.06, false));

  // The chapter's letters, framed, on the north wall left of the door.
  const plaque = new T.Mesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshStandardMaterial({ map: lettersTexture(), roughness: 0.6 })); plaque.position.set(-1.2, 1.7, -HALF + 0.03); g.add(plaque);
  g.add(box(0.96, 0.52, 0.025, flat(0x4a3426, 0.6), -1.2, 1.7, -HALF + 0.012, false));

  // A floor lamp in a corner, and nothing else.
  const lx = -HALF + 0.45, lz = HALF - 0.45;
  const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.55, 8), brass); pole.position.set(lx, 0.775, lz); pole.castShadow = true; g.add(pole);
  const base = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.03, 16), brass); base.position.set(lx, 0.015, lz); g.add(base);
  const shadeM = new T.MeshStandardMaterial({ color: lin(0xf2e2c4), emissive: lin(0xf6d89a), emissiveIntensity: 0.55, roughness: 0.9, side: T.DoubleSide });
  const lampShade = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.3, 20, 1, true), shadeM); lampShade.position.set(lx, 1.6, lz); g.add(lampShade);

  scene.add(g);

  // Light: a warm hemisphere, a low shaft from the window that casts the shadows, and the lamp.
  const hemi = new T.HemisphereLight(0xf5eadb, 0x3a2a24, 0.55); scene.add(hemi);
  const key = new T.DirectionalLight(0xfff0d8, 1.1); key.position.set(-3.4, 2.9, -0.9); key.target.position.set(0, 0.6, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 0.5, far: 12 });
  const lamp = new T.PointLight(0xffd9a0, 0.9, 8, 1.6); lamp.position.set(lx + 0.3, 1.5, lz - 0.3); scene.add(lamp);
  const fill = new T.PointLight(0xffe6c2, 0.4, 9, 1.2); fill.position.set(0.5, 2.3, 0.5); scene.add(fill);
  return {
    group: g, half: HALF, height: HEIGHT,
    update(t) { lamp.intensity = 0.9 + 0.02 * Math.sin(t * 3.1); },
    dispose() { scene.remove(g, hemi, key, key.target, lamp, fill); disposeGroup(g); },
  };
}

root.OtkRoom = { buildRoom, buildChair, buildTable, disposeGroup, HALF, HEIGHT };
})(window);
