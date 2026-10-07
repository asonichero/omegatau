// Birchwood House — the room, and the wooden furniture in it.
// A bare room in a medieval cottage: stone and lime-wash walls, a boarded floor, a beamed ceiling, one window, a hearth and
// a door. The furniture is plain cottage joinery: a plank-seated chair (the one the player sits in, and the one a resident
// can bend over) and a trestle-style table (what a resident bends over at full height). Everything is built from boxes and
// canvas-drawn textures, so there are no assets to load.
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

// Boards running along the texture's x, with grain, knots and nails.
function plankTexture(base, boards, seed, repeat, along = true) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rngFor(seed), bh = h / boards;
    for (let i = 0; i < boards; i++) {
      const y = i * bh, tone = 0.82 + r() * 0.3;
      ctx.fillStyle = shade(base, tone); ctx.fillRect(0, y, w, bh);
      for (let k = 0; k < 26; k++) {   // grain
        ctx.strokeStyle = shade(base, tone * (0.72 + r() * 0.2)); ctx.globalAlpha = 0.25 + r() * 0.25; ctx.lineWidth = 0.6 + r() * 1.2;
        const gy = y + 2 + r() * (bh - 4); ctx.beginPath(); ctx.moveTo(0, gy);
        ctx.bezierCurveTo(w * 0.3, gy + (r() - 0.5) * 5, w * 0.6, gy + (r() - 0.5) * 5, w, gy + (r() - 0.5) * 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (r() < 0.55) { const kx = r() * w, ky = y + bh * (0.3 + r() * 0.4); ctx.fillStyle = shade(base, 0.45); ctx.beginPath(); ctx.ellipse(kx, ky, 5 + r() * 5, 3 + r() * 3, 0, 0, 6.3); ctx.fill(); }
      const cut = r() * w; ctx.fillStyle = shade(base, 0.35); ctx.fillRect(cut, y, 2, bh);   // butt joint
      ctx.fillStyle = shade(base, 0.28); ctx.fillRect(0, y, w, 2.5);                               // seam
      ctx.fillStyle = shade(base, 0.3); for (const nx of [cut - 10, cut + 12]) { ctx.beginPath(); ctx.arc(nx, y + bh * 0.3, 1.6, 0, 6.3); ctx.arc(nx, y + bh * 0.7, 1.6, 0, 6.3); ctx.fill(); }
    }
  }, repeat);
}
// Lime-wash over rubble stone: rough blocks with dark mortar, washed out toward the top.
function wallTexture(seed, repeat) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const r = rngFor(seed);
    ctx.fillStyle = '#b6a785'; ctx.fillRect(0, 0, w, h);
    const rows = 7, rh = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 60;
      while (x < w) {
        const bw = 70 + r() * 110, y = row * rh + (r() - 0.5) * 4;
        const t = 0.72 + r() * 0.28;
        ctx.fillStyle = `rgb(${(168 * t) | 0},${(152 * t) | 0},${(122 * t) | 0})`;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 3, y + 3, bw - 6, rh - 6, 14) : ctx.rect(x + 3, y + 3, bw - 6, rh - 6); ctx.fill();
        x += bw;
      }
    }
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '60,48,34' : '236,226,200'},${0.04 + r() * 0.08})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 14, 0, 6.3); ctx.fill(); }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(226,216,190,0.62)'); g.addColorStop(0.45, 'rgba(226,216,190,0.25)'); g.addColorStop(1, 'rgba(60,48,34,0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, repeat);
}
function stoneTexture(seed) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = rngFor(seed); ctx.fillStyle = '#2c2824'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 6; row++) { let x = -r() * 50; const rh = h / 6; while (x < w) { const bw = 60 + r() * 80, t = 0.55 + r() * 0.5; ctx.fillStyle = `rgb(${(118 * t) | 0},${(112 * t) | 0},${(104 * t) | 0})`; ctx.fillRect(x + 3, row * rh + 3, bw - 6, rh - 6); x += bw; } }
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 8, 0, 6.3); ctx.fill(); }
  });
}

const matCache = {};
function wood(color, seed = 1, boards = 3, repeat = null) {
  const k = [color, seed, boards, repeat && repeat.join('x')].join('|');
  return matCache[k] || (matCache[k] = new T.MeshStandardMaterial({ map: plankTexture(color, boards, seed, repeat || [1, 1]), roughness: 0.82, metalness: 0 }));
}
const box = (w, h, d, mat, x, y, z, cast = true) => {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m;
};

// ── Furniture ───────────────────────────────────────────────────
// The chair: a plank seat on four square legs with stretchers and a low ladder back. Seat W wide (x), D deep (z), `top` high,
// back to −z. Dimensions are those of the seat the engine builds for the player, so nothing about the scene moves.
function buildChair(top, W = 0.42, D = 0.46) {
  const g = new T.Group(), wd = wood(0x6b4a2c, 11, 4, [1, 1]), dark = wood(0x4e3520, 12, 2, [1, 1]);
  g.add(box(W, 0.035, D, wd, 0, top - 0.0175, 0));
  const lw = 0.042, lh = top - 0.035, inx = W / 2 - 0.03, inz = D / 2 - 0.03;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(lw, lh, lw, dark, sx * inx, lh / 2, sz * inz));
  for (const sz of [-1, 1]) g.add(box(2 * inx, 0.025, 0.025, dark, 0, 0.2, sz * inz));   // front and back stretchers
  for (const sx of [-1, 1]) g.add(box(0.025, 0.025, 2 * inz, dark, sx * inx, 0.24, 0));  // side stretchers
  const bz = -inz, bh = 0.4;
  for (const sx of [-1, 1]) g.add(box(lw, bh, lw, dark, sx * inx, top + bh / 2 - 0.02, bz));   // rear posts, rising from the seat
  for (const y of [0.15, 0.31]) g.add(box(2 * inx - lw, 0.075, 0.02, wd, 0, top + y, bz));        // two slats
  return g;
}
// The table: a thick plank top (surface exactly at `top`) on four stout legs, an apron and a low stretcher.
// Runs x0…x1 along x and is `W` deep; the legs are kept out near the corners, clear of anyone bent over the middle of it.
function buildTable(top, x0, x1, W = 0.9) {
  const g = new T.Group(), L = x1 - x0, cx = (x0 + x1) / 2, th = 0.05;
  const wd = wood(0x73512f, 21, 4, [Math.max(1, L / 0.9), 1]), dark = wood(0x4c3420, 22, 2, [1, 1]);
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
const HALF = 3.6, HEIGHT = 2.65;
function buildRoom(scene) {
  const g = new T.Group(); g.name = 'room';
  const floorMat = new T.MeshStandardMaterial({ map: plankTexture(0x6a4a2c, 9, 7, [HALF * 2 / 2.2, HALF * 2 / 2.2]), roughness: 0.9 });
  const floor = new T.Mesh(new T.PlaneGeometry(HALF * 2, HALF * 2), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wallMat = new T.MeshStandardMaterial({ map: wallTexture(5, [2, 1]), roughness: 0.95 });
  const walls = [[0, -HALF, 0], [0, HALF, Math.PI], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]];
  for (const [x, z, ry] of walls) {
    const w = new T.Mesh(new T.PlaneGeometry(HALF * 2, HEIGHT), wallMat); w.position.set(x, HEIGHT / 2, z); w.rotation.y = ry; w.receiveShadow = true; g.add(w);
  }
  const ceil = new T.Mesh(new T.PlaneGeometry(HALF * 2, HALF * 2), new T.MeshStandardMaterial({ map: plankTexture(0x3b2a1b, 12, 9, [3, 3]), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = HEIGHT; g.add(ceil);
  const beamMat = wood(0x3a2616, 31, 2, [3, 1]);
  for (let x = -3; x <= 3.01; x += 1.5) g.add(box(0.2, 0.22, HALF * 2, beamMat, x, HEIGHT - 0.11, 0, false));
  g.add(box(HALF * 2, 0.2, 0.2, beamMat, 0, HEIGHT - 0.1, -HALF + 0.1, false), box(HALF * 2, 0.2, 0.2, beamMat, 0, HEIGHT - 0.1, HALF - 0.1, false));
  // skirting board and corner posts keep the walls from reading as bare planes
  const skirt = wood(0x4a3320, 41, 1, [6, 1]);
  g.add(box(HALF * 2, 0.12, 0.04, skirt, 0, 0.06, -HALF + 0.02, false), box(HALF * 2, 0.12, 0.04, skirt, 0, 0.06, HALF - 0.02, false),
    box(0.04, 0.12, HALF * 2, skirt, -HALF + 0.02, 0.06, 0, false), box(0.04, 0.12, HALF * 2, skirt, HALF - 0.02, 0.06, 0, false));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.22, HEIGHT, 0.22, beamMat, x * (HALF - 0.11), HEIGHT / 2, z * (HALF - 0.11), false));

  // Window in the west wall: a deep reveal, a bright pane with leading, open shutters.
  const wy = 1.55, wz = -0.9, wx = -HALF;
  const frame = wood(0x3d2a18, 51, 2, [1, 1]);
  g.add(box(0.14, 1.0, 0.1, frame, wx + 0.07, wy, wz - 0.55), box(0.14, 1.0, 0.1, frame, wx + 0.07, wy, wz + 0.55),
    box(0.14, 0.1, 1.2, frame, wx + 0.07, wy + 0.5, wz), box(0.14, 0.1, 1.2, frame, wx + 0.07, wy - 0.5, wz));
  const pane = new T.Mesh(new T.PlaneGeometry(1.0, 0.9), new T.MeshBasicMaterial({ color: lin(0xfff3d6) })); pane.position.set(wx + 0.03, wy, wz); pane.rotation.y = Math.PI / 2; g.add(pane);
  for (const k of [-0.33, 0.33]) g.add(box(0.03, 0.9, 0.03, frame, wx + 0.05, wy, wz + k, false));
  g.add(box(0.03, 0.03, 1.0, frame, wx + 0.05, wy, wz, false));
  for (const s of [-1, 1]) g.add(box(0.04, 1.0, 0.5, wood(0x5a3e24, 52, 3, [1, 1]), wx + 0.12, wy, wz + s * 0.85, false));
  g.add(box(0.3, 0.07, 1.4, frame, wx + 0.15, wy - 0.55, wz, false));   // sill

  // Hearth in the east wall: a stone breast with a dark opening, a few logs and embers.
  const stone = new T.MeshStandardMaterial({ map: stoneTexture(8), roughness: 1 });
  const hx = HALF - 0.45, hz = 0.2;
  g.add(box(0.9, 1.15, 1.9, stone, hx, 0.575, hz), box(0.7, 1.5, 1.3, stone, HALF - 0.35, 1.9, hz), box(1.05, 0.14, 2.05, wood(0x3a2616, 61, 1, [2, 1]), hx - 0.02, 1.2, hz, false));
  const mouth = new T.Mesh(new T.PlaneGeometry(1.2, 0.8), new T.MeshBasicMaterial({ color: lin(0x0b0807) })); mouth.position.set(hx - 0.455, 0.55, hz); mouth.rotation.y = -Math.PI / 2; g.add(mouth);
  const ember = new T.MeshBasicMaterial({ color: lin(0xff7a22) });
  for (const [dz, rz, len] of [[-0.18, 0.25, 0.7], [0.1, -0.2, 0.75], [0.32, 0.1, 0.55]]) { const log = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, len, 8), wood(0x2e1d11, 62, 1, [1, 1])); log.rotation.set(Math.PI / 2, 0, rz); log.position.set(hx - 0.25, 0.12 + dz * 0.1, hz + dz); g.add(log); }
  const glow = new T.Mesh(new T.PlaneGeometry(0.7, 0.28), ember); glow.position.set(hx - 0.452, 0.18, hz); glow.rotation.y = -Math.PI / 2; g.add(glow);
  g.add(box(1.0, 0.06, 2.1, stone, hx - 0.05, 0.03, hz));   // hearthstone

  // Door in the north wall: planks, iron straps and a latch, set in a timber frame.
  const dz = -HALF + 0.05, dx = 1.6, doorW = wood(0x4b3320, 71, 6, [1, 1]), iron = new T.MeshStandardMaterial({ color: lin(0x25252a), roughness: 0.5, metalness: 0.6 });
  g.add(box(1.0, 2.05, 0.06, doorW, dx, 1.025, dz), box(0.12, 2.15, 0.14, beamMat, dx - 0.56, 1.075, dz, false), box(0.12, 2.15, 0.14, beamMat, dx + 0.56, 1.075, dz, false), box(1.24, 0.12, 0.14, beamMat, dx, 2.15, dz, false));
  for (const y of [0.4, 1.6]) g.add(box(0.96, 0.08, 0.02, iron, dx, y, dz + 0.04, false));
  g.add(box(0.05, 0.16, 0.03, iron, dx - 0.35, 1.0, dz + 0.05, false));

  // A broom and a bucket in a corner, and nothing else.
  const bm = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.5, 6), wood(0x6b4a2c, 81, 1, [1, 1])); bm.position.set(-HALF + 0.35, 0.75, HALF - 0.3); bm.rotation.z = 0.08; bm.castShadow = true; g.add(bm);
  const bristle = new T.Mesh(new T.ConeGeometry(0.1, 0.3, 8), new T.MeshStandardMaterial({ color: lin(0x9a7b3a), roughness: 1 })); bristle.position.set(-HALF + 0.38, 0.14, HALF - 0.3); bristle.rotation.z = Math.PI + 0.08; bristle.castShadow = true; g.add(bristle);
  const bucket = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.3, 14, 1, true), wood(0x5a3e24, 82, 6, [3, 1])); bucket.material = bucket.material.clone(); bucket.material.side = T.DoubleSide; bucket.position.set(-HALF + 0.75, 0.15, HALF - 0.4); bucket.castShadow = true; g.add(bucket);

  scene.add(g);

  // Light: warm hemisphere, a low shaft from the window that casts the shadows, and the hearth (which flickers).
  const hemi = new T.HemisphereLight(0xf2e2c4, 0x2a1d12, 0.5); scene.add(hemi);
  const key = new T.DirectionalLight(0xffe2b0, 1.15); key.position.set(-3.4, 2.9, -0.9); key.target.position.set(0, 0.6, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 0.5, far: 12 });
  const fire = new T.PointLight(0xff8a3a, 1.1, 7, 1.6); fire.position.set(HALF - 1.1, 0.55, hz); scene.add(fire);
  const fill = new T.PointLight(0xffe6c2, 0.35, 9, 1.2); fill.position.set(0.5, 2.3, 0.5); scene.add(fill);
  return {
    group: g, half: HALF, height: HEIGHT,
    update(t) { fire.intensity = 1.0 + 0.2 * Math.sin(t * 9.1) + 0.12 * Math.sin(t * 17.3 + 1) + 0.08 * Math.sin(t * 4.1); },
    dispose() { scene.remove(g, hemi, key, key.target, fire, fill); disposeGroup(g); },
  };
}

root.FairyShoeRoom = { buildRoom, buildChair, buildTable, disposeGroup, HALF, HEIGHT };
})(window);
