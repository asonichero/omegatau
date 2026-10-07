// Starlight engine — character models, the discipline scene and the dance library.
// Shared by character-viewer.html and starlight-game.html. Needs three.js r128.
// Everything is exposed on window.Starlight.
(function (global) {
'use strict';

// ════════════════════════════════════════════════════════════════
// PIPELINE
//
//   measurements ──► skeleton landmarks ──► SDF primitives
//        │                                       │
//        │                     surface nets (once per build)
//        │                                       │
//        │               skin weights from per-primitive distance
//        ▼                                       ▼
//   THREE.Bone hierarchy ◄──────── THREE.SkinnedMesh (GPU skinning)
//
// Every primitive belongs to one bone (the torso loft blends several
// bones by height), so the same distances that shape the surface
// also decide how each vertex follows the skeleton. The rest pose is
// an A-pose (arms 45° from the body, legs slightly apart) so that
// arms and thighs don't fuse into the torso when blended.
//
// Coordinates: metres, Y up, character faces +Z, character's left = +X.
// ════════════════════════════════════════════════════════════════

// ── Presets ─────────────────────────────────────────────────────
// Circumferences in cm. All characters are adults.
// `outfit` is hair; `skin` the skin tone. `wardrobe` holds the garment layers (see
// CLOTHING LAYERS for the kinds and their settings) and `looks` the combinations
// worn, innermost first; `look` is the one a build starts in. Every look starts
// from the full underwear base layer, and the clothes go over it.
const PRESETS = {
  aya: {
    name: 'Aya', expressive: 1.1, build: 'female', tolerance: 0.75, resilience: 0.6, height: 172, legs: 1.02, shoulders: 38,
    bust: 86, underbust: 72, waist: 63, hip: 100.5,
    neck: 31, arm: 25, forearm: 22, wrist: 14.5,
    thigh: 52, knee: 34, calf: 33, ankle: 20.5, cup: 3, glutes: 1.32, endowment: 1, head: 1.0,
    eye: 1.1, eyeHeight: -0.1, brow: 0.35, bridge: 0.81, hump: 0.2, tipTilt: -1, noseWidth: 0.92, lips: 0.81, mouth: 1.01, youth: 0.25, cheeks: 0.82,
    // Watchful composure: alert, level, still. Lids a touch lifted (eyes ahead of the
    // room), brows level, mouth corners exactly level; few eye movements, and she holds
    // her gaze; blinks slowly.
    expr: { browInner: -0.15, browOuter: 0.05, mouthL: 0.15, mouthR: 0.05, saccade: 0.12, contact: 0.8, blink: 0.6 },
    // Her versions of the moods (offsets from her resting expression; Open is the shared one).
    moods: {
      effort:    { browInner: 0.05, browFurrow: 0.6, lidUpper: -0.35, squint: 0.6, mouthL: -0.3, mouthR: -0.3, teeth: 0.9 },
      enjoyment: { browOuter: 0.1, lidUpper: 0.5, squint: 0.3, mouthL: 0.75, mouthR: 0.75, teeth: 0.7, mouthOpen: 0.05 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x1a120c, hairStyle: 'ponytail', scrunchie: 0xf4f2ee, bobbles: [0x0c0c0e] },
    wardrobe: {
      bra:    { kind: 'bra', name: 'Black bralette', color: 0x141418, style: 'bralette' },
      briefs: { kind: 'briefs', name: 'Black thong', color: 0x141418, rise: 0.25, riseBack: 1.0, back: 'thong', thong: 0.005 },
      bottom: { kind: 'bottom', name: 'Leggings', color: 0x18181e, legLen: 2.0, lowerTo: 'calf' },
      top:    { kind: 'top', name: 'Crop top', color: 0x1c1c22, from: 'underbust', sleeves: 0 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0xf0f0f0 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  rin: {
    name: 'Rin', expressive: 1.0, build: 'female', tolerance: 0.5, resilience: 0.55, height: 163, legs: 1.05, shoulders: 37,
    bust: 75.5, underbust: 68, waist: 62.5, hip: 87.5,
    neck: 26, arm: 23, forearm: 19, wrist: 13.5,
    thigh: 38, knee: 28, calf: 26, ankle: 19.5, cup: 2, glutes: 1.4, endowment: 1, head: 1.04,
    eye: 1.15, brow: 0.65, nose: 1.38, hump: 0.2, tipTilt: 1, lips: 0.6, mouth: 0.8, mouthHeight: -0.35, youth: 0.7, cheeks: 0.7, jaw: 0.87, chin: 1.06,
    // Quiet preoccupation: the faintest concentration furrow, gaze a little lowered and
    // inward, eyes that move more than the rest of her face (frequent, wide, not
    // returning to anyone for long); corners of the mouth fractionally down.
    expr: { browFurrow: 0.35, browInner: 0.55, gazeY: -0.15, lidUpper: -0.2, mouthL: -0.05, mouthR: -0.08, saccade: 0.9, contact: 0.25, blink: 1.2 },
    // Her enjoyment: a closed-mouth smile, the furrow easing (Effort and Open are shared).
    moods: {
      enjoyment: { browOuter: 0.1, browFurrow: -0.1, squint: 0.45, mouthL: 0.75, mouthR: 0.75, teeth: 0 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x14100c, hairStyle: 'long' },
    wardrobe: {
      bra:    { kind: 'bra', name: 'White bra', color: 0xf0eee9, style: 'classic' },
      briefs: { kind: 'briefs', name: 'White cotton briefs', color: 0xf0eee9, rise: 0.5, side: 0.9, back: 'brief', backCurve: 1 },
      bottom: { kind: 'bottom', name: 'Shorts', color: 0x3b4f6e, legLen: 0.52 },
      top:    { kind: 'top', name: 'Hoodie', color: 0x9a9aa4, from: 'hip', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0xe8e8e8 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  kiko: {
    name: 'Kiko', expressive: 1.1, build: 'female', tolerance: 0.35, resilience: 0.45, height: 158, legs: 1.04, shoulders: 35,
    bust: 86, underbust: 60, waist: 64.5, hip: 93.5,
    neck: 26, arm: 30, forearm: 21, wrist: 14,
    thigh: 49.5, knee: 32.5, calf: 27.5, ankle: 20, cup: 4, glutes: 1.4, endowment: 1, head: 1.1,
    eye: 1.3, eyeGap: 1.1, eyeHeight: -1, brow: 0.7, hump: -1, tipTilt: -1, noseWidth: 1.15, mouthHeight: -0.4, youth: 0.6, jaw: 0.87, chin: 1.05,
    // Asymmetric readiness: one corner of the mouth cocked higher (a quip in reserve),
    // eyes open and bright, brows lifted a little and one higher; quick eye movements
    // that keep snapping back to you (eye contact held a beat too long).
    expr: { mouthL: 0.6, mouthR: 0.25, lidUpper: 0.5, browInner: 0.2, browOuter: 0.25, browAsym: 0.2, saccade: 0.55, contact: 0.85, blink: 1.1 },
    // Her enjoyment: a full, open grin, eyes wide rather than crinkled (Effort and Open are shared).
    moods: {
      enjoyment: { browOuter: 0.1, lidUpper: 0.5, squint: 0, mouthL: 0.4, mouthR: 0.75, teeth: 1, mouthOpen: 0.2 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x120e08, hairStyle: 'buns', bobbles: [0x2c5fcf, 0xe86aa0], clips: [0xe86aa0, 0x2c5fcf] },
    wardrobe: {
      bra:    { kind: 'bra', name: 'Navy support bra', color: 0x1d2b4c, style: 'sports' },
      briefs: { kind: 'briefs', name: 'Navy hipster shorts', color: 0x1d2b4c, rise: 0.15, side: 0.55, back: 'brief', backCurve: 0.45 },
      bottom: { kind: 'bottom', name: 'Shorts', color: 0xe86aa0, legLen: 0.52 },
      skirt:  { kind: 'skirt', name: 'Skirt', color: 0x2c5fcf, above: 0.01, length: 0.18, flare: 0.025 },
      top:    { kind: 'top', name: 'Top', color: 0x1a7fe8, from: 'waist', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0x3a7ae0 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'skirt', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  kenji: {
    name: 'Kenji', expressive: 0.6, build: 'male', tolerance: 0.65, resilience: 0.7, height: 181.5, legs: 1.02, shoulders: 45,
    bust: 96, underbust: 90, waist: 80, hip: 94,
    neck: 38, arm: 32.5, forearm: 27, wrist: 17,
    thigh: 54, knee: 38, calf: 37, ankle: 23, glutes: 1.4, endowment: 1, head: 1.0,
    eye: 1.14, eyeGap: 1.01, brow: 0.1, nose: 1.18, bridge: 1.5, hump: 0.35, lips: 0.85, mouth: 1.15,
    // Steady absorption: listening to something you can't hear. Gaze resting slightly
    // off to one side and up; a habitual tension round the eyes (lower lids raised,
    // upper a touch heavy, not a squint); mouth neither smiling nor serious.
    expr: { gazeX: 0.3, gazeY: 0.12, squint: 0.35, lidUpper: -0.15, browInner: 0.05, mouthL: 0.05, mouthR: 0.05, saccade: 0.25, contact: 0.6, blink: 0.9 },
    skin: 0xe9c6a5,
    outfit: { hair: 0x120e0a, hairStyle: 'short' },
    wardrobe: {
      briefs: { kind: 'briefs', name: 'Grey trunks', color: 0x3a3d44, rise: 0.5, leg: 0.1 },
      bottom: { kind: 'bottom', name: 'Trousers', color: 0x22252c, legLen: 2.0, lowerTo: 'ankle' },
      top:    { kind: 'top', name: 'Sweatshirt', color: 0x3a4250, from: 'hip', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Shoes', color: 0x1a1a1a },
    },
    looks: { Underwear: ['briefs'], Rehearsal: ['briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  haru: {
    name: 'Haru', expressive: 1.2, build: 'male', tolerance: 0.45, resilience: 0.5, height: 160.5, legs: 1.06, shoulders: 38,
    bust: 82, underbust: 76, waist: 67, hip: 85,
    neck: 31, arm: 24.5, forearm: 22, wrist: 15,
    thigh: 45, knee: 32, calf: 31, ankle: 20, glutes: 1.1, endowment: 1, head: 1.04,
    eye: 1.32, eyeGap: 1.04, brow: 0.3, nose: 1.0, lips: 0.9, mouth: 0.95, youth: 0.35, jaw: 1.0, chin: 0.98,
    // Unsure but graceful: wide, bright eyes with the brows lifted and drawn a little together, gaze resting slightly
    // down and to one side, eyes that wander and don't hold contact for long; the mouth a touch down at the corners.
    expr: { browInner: 0.45, browOuter: 0.1, lidUpper: 0.4, gazeX: -0.15, gazeY: -0.12, mouthL: -0.05, mouthR: -0.02, saccade: 0.6, contact: 0.35, blink: 1.15 },
    skin: 0xe9c6a5,
    outfit: { hair: 0x2a1d14, hairStyle: 'short' },
    wardrobe: {
      briefs: { kind: 'briefs', name: 'Blue trunks', color: 0x2c5fcf, rise: 0.5, leg: 0.06 },
      bottom: { kind: 'bottom', name: 'Khaki work trousers', color: 0xa39469, legLen: 2.0, lowerTo: 'ankle' },
      top:    { kind: 'top', name: 'White T-shirt', color: 0xf2f0ea, from: 'hip', sleeves: 0.45 },
      shoes:  { kind: 'shoes', name: 'Work boots', color: 0x4a3524 },
    },
    looks: { Underwear: ['briefs'], Rehearsal: ['briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
};
const ORDER = ['aya', 'rin', 'kiko', 'kenji', 'haru'];
// Face shape, as multipliers of each build's base face (1 = unchanged) except brow
// hump, tipTilt, mouthHeight and eyeHeight (−1…1). A preset can set any of them; the rest take these defaults.
// eye: eye size; eyeGap: spacing between the eyes.
const FACE_DEFAULTS = { eye: 1, eyeGap: 1, nose: 1, bridge: 1, hump: 0, tipTilt: 0, noseWidth: 1, lips: 1, mouth: 1, mouthHeight: 0, eyeHeight: 0, youth: 0, jaw: 1, chin: 1, cheeks: 1, brow: 0 };
function faceParams(m) {
  const F = { ...FACE_DEFAULTS, jaw: m.build === 'male' ? 1.12 : 1 };
  for (const k of Object.keys(FACE_DEFAULTS)) if (m[k] != null) F[k] = m[k];
  return F;
}

const SLIDERS = [
  ['height', 'Height', 145, 195, 0.5, 'cm'],
  ['legs', 'Leg length', 0.92, 1.08, 0.01, '×'],
  ['shoulders', 'Shoulder width', 30, 50, 0.5, 'cm'],
  ['bust', 'Bust / chest', 70, 115, 0.5, 'cm'],
  ['underbust', 'Underbust', 60, 105, 0.5, 'cm'],
  ['cup', 'Cup size (UK)', 1, 8, 1, 'cup'],
  ['waist', 'Waist', 50, 100, 0.5, 'cm'],
  ['hip', 'Hip', 70, 120, 0.5, 'cm'],
  ['glutes', 'Glute shape', 0.6, 1.4, 0.01, '×'],
  ['endowment', 'Endowment (male builds)', 0.4, 1.6, 0.01, '×'],
  ['thigh', 'Thigh', 38, 70, 0.5, 'cm'],
  ['knee', 'Knee', 28, 45, 0.5, 'cm'],
  ['calf', 'Calf', 26, 45, 0.5, 'cm'],
  ['ankle', 'Ankle', 17, 27, 0.5, 'cm'],
  ['neck', 'Neck', 26, 42, 0.5, 'cm'],
  ['arm', 'Upper arm', 20, 38, 0.5, 'cm'],
  ['forearm', 'Forearm', 18, 32, 0.5, 'cm'],
  ['wrist', 'Wrist', 12, 19, 0.5, 'cm'],
  ['head', 'Head size', 0.9, 1.1, 0.01, '×'],
];

const clone = o => JSON.parse(JSON.stringify(o));

// ── Small vector helpers (plain arrays for speed in the field loop) ──
const V = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a));
const norm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Ramanujan ellipse perimeter
const perim = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

// ════════════════════════════════════════════════════════════════
// SDF PRIMITIVES
// ════════════════════════════════════════════════════════════════

// Round cone (iq): sphere r1 at a, sphere r2 at b, tangent cone between.
function sdRoundCone(p, P) {
  const pa0 = p[0] - P.a[0], pa1 = p[1] - P.a[1], pa2 = p[2] - P.a[2];
  const ba = P.ba, l2 = P.l2, rr = P.r1 - P.r2, a2 = P.a2, il2 = 1 / l2;
  const y = pa0 * ba[0] + pa1 * ba[1] + pa2 * ba[2];
  const z = y - l2;
  const x0 = pa0 * l2 - ba[0] * y, x1 = pa1 * l2 - ba[1] * y, x2_ = pa2 * l2 - ba[2] * y;
  const x2 = x0 * x0 + x1 * x1 + x2_ * x2_;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - P.r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - P.r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - P.r1;
}
function coneT(p, P) {
  return clamp(((p[0] - P.a[0]) * P.ba[0] + (p[1] - P.a[1]) * P.ba[1] + (p[2] - P.a[2]) * P.ba[2]) / P.l2, 0, 1);
}

// Oriented ellipsoid (iq's bound-corrected approximation).
function sdEllipsoid(p, P) {
  const d0 = p[0] - P.c[0], d1 = p[1] - P.c[1], d2 = p[2] - P.c[2];
  const q0 = (d0 * P.u[0] + d1 * P.u[1] + d2 * P.u[2]);
  const q1 = (d0 * P.v[0] + d1 * P.v[1] + d2 * P.v[2]);
  const q2 = (d0 * P.w[0] + d1 * P.w[1] + d2 * P.w[2]);
  const r = P.r;
  const k0 = Math.sqrt((q0 / r[0]) ** 2 + (q1 / r[1]) ** 2 + (q2 / r[2]) ** 2);
  const k1 = Math.sqrt((q0 / (r[0] * r[0])) ** 2 + (q1 / (r[1] * r[1])) ** 2 + (q2 / (r[2] * r[2])) ** 2);
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
}

// Lofted torso: elliptical rings (half-width a, front depth bf, back depth bb,
// centre z zc) interpolated with monotone cubics along Y.
// The interpolated rings are baked into a lookup table (4 floats per row) so the
// field loop never evaluates the splines directly.
//
// The monotone cubic is smooth in slope but not in curvature: where a ring is a
// widest point (the hips) the curve bends hard on one side of it and barely on
// the other, and that jump in curvature shows as a shading line across the body.
// So the table is smoothed along Y with a Gaussian of width `smooth` (m), and the
// ring values are pre-corrected so the smoothed profile still passes through the
// measured rings.
const LOFT_ROWS = 1024;
function makeLoft(rings, smooth = 0) {
  const ys = rings.map(r => r.y);
  const KEYS = ['a', 'bf', 'bb', 'zc'];
  const y0 = ys[0], y1 = ys[ys.length - 1], dy = (y1 - y0) / (LOFT_ROWS - 1);
  const sample = vals => {
    const chans = KEYS.map((key, c) => monotoneCubic(ys, vals[c]));
    const lut = new Float32Array(LOFT_ROWS * 4);
    for (let i = 0; i < LOFT_ROWS; i++) for (let c = 0; c < 4; c++) lut[i * 4 + c] = chans[c](y0 + dy * i);
    return lut;
  };
  const blur = lut => {
    if (smooth <= 0) return lut;
    const r = Math.ceil(2.5 * smooth / dy), w = [];
    for (let k = -r; k <= r; k++) w.push(Math.exp(-0.5 * (k * dy / smooth) ** 2));
    const ws = w.reduce((s, v) => s + v, 0), out = new Float32Array(lut.length);
    for (let i = 0; i < LOFT_ROWS; i++) for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += w[k + r] * lut[clamp(i + k, 0, LOFT_ROWS - 1) * 4 + c];
      out[i * 4 + c] = s / ws;
    }
    return out;
  };
  const at = (lut, y, c) => { const f = (y - y0) / dy, i = Math.min(LOFT_ROWS - 2, Math.max(0, f | 0)), t = f - i; return lut[i * 4 + c] + (lut[i * 4 + 4 + c] - lut[i * 4 + c]) * t; };
  const want = KEYS.map(key => rings.map(r => r[key]));
  let vals = want.map(v => v.slice()), lut = blur(sample(vals));
  for (let it = 0; smooth > 0 && it < 4; it++) {
    vals = vals.map((v, c) => v.map((x, k) => x + want[c][k] - at(lut, ys[k], c)));
    lut = blur(sample(vals));
  }
  return { ys, y0, y1, lut, scale: (LOFT_ROWS - 1) / (y1 - y0) };
}
const _ring = [0, 0, 0, 0];
function loftRing(P, y, out = [0, 0, 0, 0]) {
  const f = (clamp(y, P.y0, P.y1) - P.y0) * P.scale;
  const i = Math.min(LOFT_ROWS - 2, f | 0), t = f - i, L = P.lut;
  for (let c = 0; c < 4; c++) out[c] = L[i * 4 + c] + (L[i * 4 + 4 + c] - L[i * 4 + c]) * t;
  return out;
}
function sdLoft(p, P) {
  loftRing(P, p[1], _ring);
  const a = _ring[0], bf = _ring[1], bb = _ring[2], zc = _ring[3];
  const x = p[0], z = p[2] - zc, b = z > 0 ? bf : bb;
  const k0 = Math.sqrt((x / a) ** 2 + (z / b) ** 2);
  const k1 = Math.sqrt((x / (a * a)) ** 2 + (z / (b * b)) ** 2);
  const d2 = k1 < 1e-9 ? -Math.min(a, b) : k0 * (k0 - 1) / k1;
  const dy = p[1] < P.y0 ? P.y0 - p[1] : p[1] > P.y1 ? p[1] - P.y1 : 0;
  if (dy === 0) return d2;
  return d2 > 0 ? Math.sqrt(d2 * d2 + dy * dy) : dy;
}

// Fritsch–Carlson monotone cubic interpolant — no overshoot between rings.
function monotoneCubic(xs, ys) {
  const n = xs.length, dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  return x => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], s = (x - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * t[i + 1];
  };
}

function cone(a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba);
  return { type: 'cone', a, b, r1, r2, ba, l2, a2: l2 - (r1 - r2) ** 2 };
}
function ellipsoid(c, r, axisY = [0, 1, 0], axisZ = [0, 0, 1]) {
  const v = norm(axisY);
  let w = sub(axisZ, mul(v, dot(axisZ, v)));
  w = norm(w);
  const u = cross(v, w);
  return { type: 'ell', c, r, u, v, w };
}

function primDist(p, P) {
  if (P.type === 'cone') return sdRoundCone(p, P);
  if (P.type === 'ell') return sdEllipsoid(p, P);
  return sdLoft(p, P);
}

// ════════════════════════════════════════════════════════════════
// BODY SPEC — measurements → skeleton landmarks + primitives
// ════════════════════════════════════════════════════════════════

// Cross-section shape per build: aspect = half-width / mean half-depth,
// fb/bb = front/back depth multipliers.
const RING_SHAPE = {
  female: { hip: [1.45, 0.88, 1.08], belly: [1.42, 1.0, 0.95], waist: [1.38, 0.95, 0.95], under: [1.32, 0.98, 1.02], chest: [1.45, 0.95, 1.05] },
  male:   { hip: [1.38, 0.95, 1.05], belly: [1.40, 1.0, 0.95], waist: [1.40, 1.0, 0.95],  under: [1.40, 1.0, 1.0],   chest: [1.50, 1.0, 1.0] },
};

// Solve half-width a for a ring with circumference C (m).
function ringFromCirc(C, [aspect, fb, bb]) {
  const b = 1 / aspect;
  const C1 = (perim(1, b * fb) + perim(1, b * bb)) / 2;
  const a = C / C1;
  return { a, bf: a * b * fb, bb: a * b * bb };
}

// Fingers, index to little: [offset across the palm in pitches, length × hand
// length, radius × height, knuckle set back toward the wrist × hand length].
const FINGERS = [[1.45, 0.40, 0.0043, 0.012], [0.48, 0.44, 0.0046, 0], [-0.48, 0.42, 0.0044, 0.012], [-1.42, 0.33, 0.0039, 0.05]];
const CAPS = 16;               // finger capsules the skin shader can press against
const FINGER_PITCH = 0.0103;    // × height
const FINGER_ROOT = 0.56;       // knuckle line, × hand length from the wrist
// Thumb (rigid, on the hand bone), base to tip: [along the hand × hand length, toward the
// palm side × height, toward the thumb side × height, radius × height].
const THUMB = [[0.1, 0, 0.012, 0.0064], [0.36, 0.003, 0.027, 0.0054], [0.68, 0.006, 0.031, 0.0044]];

// The pelvis carries the crotch skin above this band (heights above the crotch point, × body height), handing over to
// the thighs below it. Raised from -0.004/0.02: bent over with the legs straight, the thigh-carried skin at the crotch
// stood out as a flat flap between the glutes.
const CROTCH_LO = 0.05, CROTCH_HI = 0.09;
function buildSpec(m) {
  const H = m.height / 100, L = m.legs, cm = v => v / 100;
  const R = C => cm(C) / (2 * Math.PI);          // radius from circumference
  const shape = RING_SHAPE[m.build];
  const female = m.build === 'female';

  // Vertical landmarks. Legs scale by L; torso stretches to meet the fixed neck/head.
  const crotchF = 0.472, neckF = 0.835;
  const legY = f => f * H * L;
  const c0 = crotchF * L;
  const torY = f => H * (c0 + (f - crotchF) * (neckF - c0) / (neckF - crotchF));
  const Y = {
    ankle: legY(0.039), knee: legY(0.285), hipJoint: legY(0.505), crotch: legY(crotchF),
    hip: torY(0.50), belly: torY(0.56), waist: torY(0.615), under: torY(0.70), bust: torY(0.728),
    armpit: torY(0.752), shoulder: torY(0.815), neckBase: H * neckF,
    chin: H * 0.872, top: H,
  };

  // Torso rings
  const hipR = ringFromCirc(cm(m.hip), shape.hip);
  const waistR = ringFromCirc(cm(m.waist), shape.waist);
  const bellyR = ringFromCirc(cm(lerp(m.waist, m.hip, 0.55)), shape.belly);
  // The ribcage ring never comes out narrower than the waist — an underbust smaller
  // than the waist otherwise leaves a boxy step where the ribcage meets the belly.
  const ribC = Math.max(m.underbust, m.waist * 1.01);
  const underR = ringFromCirc(cm(ribC), shape.under);
  const chestC = female ? ribC * 1.02 : m.bust;
  const bustR = ringFromCirc(cm(chestC), shape.under);
  const armpitR = ringFromCirc(cm(chestC * (female ? 1.06 : 1.02)), shape.chest);
  const shoulderHalf = cm(m.shoulders) / 2;
  const neckR = R(m.neck);

  const rings = [
    // The loft tapers to a close 3% of height below the crotch line, where its end
    // cap is buried inside the thighs; ending higher left the cap's rim on the
    // surface as a crease where the legs meet the torso.
    { y: Y.crotch - 0.03 * H,  a: hipR.a * 0.2,  bf: hipR.bf * 0.18, bb: hipR.bb * 0.17, zc: -0.006 * H },
    { y: Y.crotch - 0.021 * H, a: hipR.a * 0.45, bf: hipR.bf * 0.4,  bb: hipR.bb * 0.38, zc: -0.006 * H },
    { y: Y.crotch - 0.012 * H, a: hipR.a * 0.64, bf: hipR.bf * 0.62, bb: hipR.bb * 0.62, zc: -0.006 * H },
    { y: Y.crotch + 0.012 * H, a: hipR.a * 0.9,  bf: hipR.bf * 0.9,  bb: hipR.bb * 0.95, zc: -0.004 * H },
    { y: Y.hip,   a: hipR.a,   bf: hipR.bf,   bb: hipR.bb,   zc: -0.004 * H },
    { y: Y.belly, a: bellyR.a, bf: bellyR.bf, bb: bellyR.bb, zc: 0 },
    { y: Y.waist, a: waistR.a, bf: waistR.bf, bb: waistR.bb, zc: 0.002 * H },
    { y: Y.under, a: underR.a, bf: underR.bf, bb: underR.bb, zc: 0.002 * H },
    { y: Y.bust,  a: bustR.a,  bf: bustR.bf,  bb: bustR.bb,  zc: 0.002 * H },
    { y: Y.armpit, a: Math.max(armpitR.a, shoulderHalf * 0.78), bf: armpitR.bf, bb: armpitR.bb, zc: 0 },
    { y: Y.shoulder - 0.012 * H, a: shoulderHalf * 0.8, bf: 0.042 * H, bb: 0.046 * H, zc: -0.006 * H },
    { y: Y.neckBase, a: neckR * 1.08, bf: neckR * 0.95, bb: neckR * 1.0, zc: -0.01 * H },
    // Buried inside the neck so the loft's end cap never shows as a crease.
    { y: Y.neckBase + 0.03 * H, a: neckR * 0.7, bf: neckR * 0.6, bb: neckR * 0.65, zc: -0.01 * H },
  ];

  // Joints (world, rest pose)
  const armAngle = 45 * Math.PI / 180, legAngle = 3 * Math.PI / 180;
  const rArm = R(m.arm), rElbow = R(m.arm) * 0.78, rFore = R(m.forearm), rWrist = R(m.wrist);
  const rThigh = R(m.thigh), rKnee = R(m.knee), rCalf = R(m.calf), rAnkle = R(m.ankle);
  const upperLen = 0.172 * H, foreLen = 0.146 * H, handLen = 0.106 * H;
  const hipJX = hipR.a * 0.5;

  const J = {
    pelvis: V(0, Y.hip, 0),
    spine1: V(0, Y.waist, 0),
    spine2: V(0, Y.under, 0),
    neck: V(0, Y.neckBase - 0.01 * H, -0.008 * H),
    head: V(0, Y.chin + 0.006 * H, -0.004 * H),
  };
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const dir = V(s * Math.sin(armAngle), -Math.cos(armAngle), 0);
    const sh = V(s * (shoulderHalf - rArm * 0.85), Y.shoulder - 0.024 * H, -0.006 * H);
    J['clav' + side] = V(s * 0.012 * H, Y.shoulder - 0.03 * H, 0.004 * H);
    J['upperArm' + side] = sh;
    J['forearm' + side] = add(sh, mul(dir, upperLen));
    J['hand' + side] = add(J['forearm' + side], mul(dir, foreLen));
    J['handEnd' + side] = add(J['hand' + side], mul(dir, handLen));
    const hj = V(s * hipJX, Y.hipJoint, 0);
    const legDir = norm(V(s * Math.sin(legAngle), -Math.cos(legAngle), 0));
    J['thigh' + side] = hj;
    J['shin' + side] = add(hj, mul(legDir, (Y.hipJoint - Y.knee) / Math.cos(legAngle)));
    J['shin' + side][2] = 0.004 * H;
    J['foot' + side] = add(J['shin' + side], mul(legDir, (Y.knee - Y.ankle) / Math.cos(legAngle)));
    J['foot' + side][2] = -0.008 * H;
    J['toe' + side] = add(J['foot' + side], V(0, -Y.ankle * 0.7, 0.115 * H));
  }

  // Primitives: { shape, bone, group, k (blend into group), side }
  const prims = [];
  const P = (shape, bone, group, k, side = 0, extra = {}) => prims.push(Object.assign(shape, { bone, group, k, side }, extra));

  // Torso
  P(Object.assign(makeLoft(rings, 0.007 * H), { type: 'loft' }), 'loft', 'torso', 0);
  let bust = null;
  if (female) {
    // Width from the bust/underbust difference; forward projection from the cup
    // size (UK sizing, A = 1 … H = 8): roughly 3 cm at A plus 0.9 cm per cup,
    // scaled to height, measured from the ribcage front.
    const D = Math.max(0, m.bust - m.underbust);
    const rb = 0.028 * H * (0.55 + D / 22);
    const bustRing = loftRing(prims[0], Y.bust);
    const ribFront = bustRing[1] + bustRing[3];
    const proj = (0.022 + 0.009 * (m.cup || 3)) * H / 1.65;
    const rz = Math.max(proj * 0.8, rb * 0.62);
    for (const s of [1, -1]) {
      const c = V(s * bustRing[0] * 0.48, Y.bust - 0.004 * H - proj * 0.12, ribFront + proj - rz);
      // The left bust's centre and radii, for garments that follow it (see braCoverage).
      if (s > 0) bust = { x: c[0], y: c[1], rb, ry: rb * 0.9 + proj * 0.12 };
      // Carried by its own bone (secondary motion), rooted at the chest wall behind it.
      J['bust' + (s > 0 ? 'L' : 'R')] = V(c[0], c[1], ribFront - rz * 0.3);
      P(ellipsoid(c, [rb * 0.95, rb * 0.9 + proj * 0.12, rz], V(0, 1, 0.12 + proj * 0.8), V(s * 0.25, 0, 1)),
        'bust' + (s > 0 ? 'L' : 'R'), 'torso', 0.035 * H, s, { tag: 'bust' });
    }
  }
  // Every build has bust bones (unused on male builds: no geometry weighted to them).
  if (!J.bustL) { J.bustL = J.spine2.slice(); J.bustR = J.spine2.slice(); }
  // The crotch, mannequin-style: a rounded volume spanning between the tops of the
  // thighs, so the torso closes smoothly over them and the underside is one smooth
  // curve. Without it the torso's tapering lower end left the thighs' inner tops
  // meeting in a groove that ran up the front and back well above the crotch. It
  // stops just below the crotch line, so it can't web the thighs together.
  {
    const cr = loftRing(prims[0], Y.crotch + 0.012 * H);
    P(ellipsoid(V(0, Y.crotch + 0.012 * H, cr[3]), [hipR.a * 0.42, 0.03 * H, Math.min(cr[1], cr[2]) * 0.82]),
      'pelvis', 'torso', 0.025 * H, 0, { tag: 'glute' });
  }
  // The base of the pelvis between the thighs: a narrow rounded strip running front to
  // back, blended into the torso and carried by the pelvis. It gives that surface its
  // own identity, so the briefs' gusset can cover exactly it and never the inner
  // thighs beside it (see dress). Its underside is the body's lowest centre point.
  {
    const base = loftRing(prims[0], Y.crotch - 0.01 * H);
    P(ellipsoid(V(0, Y.crotch - 0.024 * H, base[3] + (base[1] - base[2]) / 2), [0.012 * H, 0.012 * H, (base[1] + base[2]) / 2 * 0.95]),
      'pelvis', 'torso', 0.015 * H, 0, { tag: 'perineum' });
  }
  // Male builds: a soft rounded volume at the front of the pelvis, just above the
  // crotch, so the front isn't flat under trunks or trousers. Kept simple and smooth
  // (a mannequin's form, not anatomy); clothing treats it as torso (tag 'groin').
  if (!female && (m.endowment == null || m.endowment > 0.02)) {   // (0: left out, as in the scenes where the body is bent over and it only shows as an artefact between the legs)
    const fr = loftRing(prims[0], Y.crotch + 0.012 * H), front = fr[1] + fr[3];
    // Long and flat: from just below the belly line down to a little below the crotch, only about 2.5 cm proud of the pelvis at its fullest; `endowment` scales it.
    const e = m.endowment == null ? 1 : m.endowment, lowest = Y.crotch + 0.003 * H - 0.03 * H, highest = Y.hip;   // (the top of the front is level with the hips)
    const r = [0.02 * H * e, (highest - lowest) / 2, 0.0125 * H * e];
    P(ellipsoid(V(0, (highest + lowest) / 2, front + r[2] * 0.1), r, V(0, 1, 0.1)), 'pelvis', 'torso', 0.02 * H, 0, { tag: 'groin' });
  }
  const hipRing = loftRing(prims[0], Y.hip);
  const g = m.glutes;
  for (const s of [1, -1]) {
    P(ellipsoid(V(s * hipRing[0] * 0.44, Y.hip - 0.022 * H, -hipRing[2] + hipRing[3] + 0.04 * H * g),
                [0.05 * H, 0.055 * H, 0.042 * H * g], V(0, 1, 0), V(s * 0.3, 0, 1)),
      'pelvis', 'torso', 0.03 * H, s, { tag: 'glute' });
  }

  // Neck and head
  P(cone(V(0, Y.neckBase - 0.05 * H, -0.012 * H), V(0, Y.chin - 0.004 * H, -0.014 * H), neckR, neckR * 0.94), 'neck', 'neck', 0);
  const hs = m.head * H, Fp = faceParams(m);
  const craniumC = V(0, H - 0.062 * hs, -0.006 * hs);
  P(ellipsoid(craniumC, [0.046 * hs, 0.06 * hs, 0.057 * hs]), 'head', 'head', 0, 0, { tag: 'head' });
  // Face: cheek mass over the upper face; a mandible with a flat underside that
  // sets the jaw line; and a chin sitting forward of the jaw. Tight blends keep
  // the jaw line and chin defined instead of melting into one receding mass.
  // Face parameters (faceParams: jaw, chin, cheeks, nose, lips, mouth, brow) scale these.
  // 'youth' (0…1, a young adult face): fullness moves up and forward from the lower
  // cheeks to the apples of the cheeks, the jaw narrows and rounds, the chin sits a
  // little higher, and (in addHead) the brows level out.
  const jawW = Fp.jaw * (1 - 0.07 * Fp.youth), yo = Fp.youth;
  P(ellipsoid(V(0, Y.chin + 0.05 * hs, 0.008 * hs), [0.04 * hs, 0.034 * hs, 0.042 * hs], V(0, 1, 0.1)), 'head', 'head', 0.012 * H, 0, { tag: 'head' });
  // Mandible: blended wider (0.014) than before, so the jaw line reads without the
  // crease it used to leave under the cheeks.
  P(ellipsoid(V(0, Y.chin + (0.026 + 0.003 * yo) * hs, -0.001 * hs), [0.038 * hs * jawW, 0.02 * hs * (1 - 0.1 * yo), 0.038 * hs], V(0, 1, 0.45)), 'head', 'head', (0.014 + 0.004 * yo) * H, 0, { tag: 'head' });
  P(ellipsoid(V(0, Y.chin + (0.008 + 0.008 * yo) * hs, 0.031 * hs * Fp.chin), [0.02 * hs * jawW, 0.015 * hs * (1 - 0.18 * yo), 0.015 * hs * Fp.chin]), 'head', 'head', 0.009 * H, 0, { tag: 'head' });
  // Cheek fullness between cheekbone and jaw, so the lower face doesn't read as hollow
  // (higher and rounder with youth); and cheekbones, under the outer corners of the eyes.
  for (const s of [1, -1]) {
    P(ellipsoid(V(s * 0.022 * hs, Y.chin + (0.036 + 0.009 * yo) * hs, (0.014 + 0.005 * yo) * hs), mul([0.02 * hs, 0.024 * hs * (1 - 0.1 * yo), 0.024 * hs], Fp.cheeks * (1 + 0.2 * yo))), 'head', 'head', 0.012 * H, s, { tag: 'head' });
    P(ellipsoid(V(s * 0.027 * hs, Y.chin + (0.054 + 0.003 * Fp.eyeHeight) * hs, 0.021 * hs), [0.013 * hs, 0.008 * hs, 0.012 * hs * Fp.cheeks]), 'head', 'head', 0.008 * H, s, { tag: 'head' });
  }
  // Brow ridge: a low band across the forehead above the eyes, so they sit in shallow sockets.
  P(ellipsoid(V(0, Y.chin + (0.075 + 0.006 * Fp.eyeHeight) * hs + Fp.brow * 0.004 * hs, 0.031 * hs), [0.035 * hs, 0.008 * hs, 0.012 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'head' });
  // Mouth mass bridging nose and chin, so the profile slopes smoothly with the
  // chin just behind the lips.
  // The mouth line: 0.008 × head height above halfway between the base of the nose
  // (where the columella meets the lip) and the bottom of the chin, moved by
  // 'mouthHeight' (−1…1, a further ±0.008 × head height).
  const noseBaseY = Y.chin + 0.0375 * hs, chinBottomY = Y.chin + (0.008 + 0.008 * yo - 0.015 * (1 - 0.18 * yo)) * hs;
  const mouthY = (noseBaseY + chinBottomY) / 2 + 0.008 * hs * (1 + Fp.mouthHeight);
  P(ellipsoid(V(0, mouthY + 0.0012 * hs, 0.025 * hs), [0.021 * hs * Fp.mouth, 0.02 * hs, 0.02 * hs]), 'head', 'head', 0.012 * H, 0, { tag: 'head' });
  // Nose. The ridge (dorsum) runs straight from the root between the eyes to the top of
  // the tip: 'bridge' is how far the root stands off the face, and 'hump' bends the
  // ridge out (+, a dorsal hump) or in (−, scooped) at its middle; 0 is straight. The
  // tip's distance from the face is 'nose' (length). The tip lobule (and the top of the
  // columella under it) turns about the nostrils by 'tipTilt' (up to ±26°; + turns it
  // up); the nostrils themselves stay where they are.
  const nW = Fp.noseWidth, tilt = Fp.tipTilt;
  const tipC = V(0, Y.chin + (0.0435 - 0.003 * (Fp.nose - 1)) * hs, (0.055 + 0.012 * (Fp.nose - 1)) * hs);
  // Offsets are from the tip's front point; the turn is about the nostril line (x axis).
  const ta = -0.45 * tilt, front = add(tipC, V(0, 0, 0.0045 * hs)), pivot = [-0.0022 * hs, -0.0095 * hs];
  const rotT = (y, z) => { const c = Math.cos(ta), sn = Math.sin(ta); return [y * c - z * sn, y * sn + z * c]; };
  const turn = o => { const [y, z] = rotT(o[1] - pivot[0], o[2] - pivot[1]); return add(front, V(o[0], y + pivot[0], z + pivot[1])); };
  const fixed = o => add(front, V(...o));
  const tAxis = (y, z) => { const [a, b] = rotT(y, z); return V(0, a, b); };
  const root = V(0, Y.chin + 0.064 * hs, (0.041 + 0.005 * (Fp.bridge - 1)) * hs);
  const tipTop = turn([0, 0.0035 * hs, -0.0045 * hs]);
  const dd = sub(tipTop, root), ridgeOut = norm(V(0, dd[2], -dd[1]));
  const mid = add(mul(add(root, tipTop), 0.5), mul(ridgeOut, 0.0065 * hs * Fp.hump));
  P(cone(root, mid, 0.0048 * hs * nW, 0.0042 * hs * nW), 'head', 'head', 0.005 * H, 0, { tag: 'head' });
  P(cone(mid, tipTop, 0.0042 * hs * nW, 0.0036 * hs * nW), 'head', 'head', 0.004 * H, 0, { tag: 'head' });
  // Lobule: longer along the nose than across, so its angle reads.
  P(ellipsoid(turn([0, 0, -0.0045 * hs]), [0.0048 * hs * nW, 0.0055 * hs, 0.0042 * hs], tAxis(1, -0.35)), 'head', 'head', 0.005 * H, 0, { tag: 'head' });
  for (const s of [1, -1]) P(ellipsoid(fixed([s * 0.0058 * hs * nW, pivot[0], pivot[1]]), [0.0034 * hs * nW, 0.0026 * hs, 0.0032 * hs]), 'head', 'head', 0.005 * H, s, { tag: 'head' });
  // Columella: from the tip's underside down to the lip.
  P(cone(turn([0, -0.004 * hs, -0.006 * hs]), V(0, noseBaseY, 0.044 * hs), 0.0022 * hs, 0.0026 * hs), 'head', 'head', 0.004 * H, 0, { tag: 'head' });
  // Lips are painted, not modelled: at this mesh resolution modelled lips could only read
  // as a bulge (parted or pouting). The shape (spec.mouth) is an upper and a lower half-
  // ellipse meeting at the mouth line; buildMesh turns it into the lip channel, which the
  // shader tints with a fine closed-mouth line. 'lips' sets their height, 'mouth' width.
  const lf = Fp.lips, mw = Fp.mouth;
  const mouthShape = { y: mouthY, hu: 0.0045 * hs * lf, hl: 0.0055 * hs * lf, w: 0.0125 * hs * mw, zMin: 0.02 * hs };
  for (const s of [1, -1]) {   // ears
    P(ellipsoid(V(s * 0.045 * hs, Y.chin + 0.056 * hs, -0.008 * hs), [0.006 * hs, 0.016 * hs, 0.01 * hs]), 'head', 'head', 0.004 * H, s, { tag: 'head' });
  }
  // Hair volume is part of the head surface; its colour comes from the hairline in the shader.
  const style = m.outfit.hairStyle;
  const capLift = style === 'short' ? 0.004 : 0.007;
  P(ellipsoid(add(craniumC, V(0, capLift * hs, -0.006 * hs)), [0.05 * hs, 0.06 * hs, 0.058 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'hair' });
  if (style === 'buns') for (const s of [1, -1]) {
    P(ellipsoid(add(craniumC, V(s * 0.034 * hs, 0.05 * hs, -0.016 * hs)), [0.024 * hs, 0.023 * hs, 0.024 * hs]), 'head', 'head', 0.008 * H, s, { tag: 'hairBun' });
  }
  if (style === 'ponytail') {
    P(ellipsoid(add(craniumC, V(0, (0.016 - ((m.outfit || {}).ponyDrop || 0)) * hs, -0.06 * hs)), [0.017 * hs, 0.017 * hs, 0.017 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'hairBun' });
  }

  // Arms
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R', grp = 'arm' + side;
    const sh = J['upperArm' + side], el = J['forearm' + side], wr = J['hand' + side], he = J['handEnd' + side];
    const dir = norm(sub(el, sh));
    P(ellipsoid(add(sh, add(mul(dir, 0.02 * H), V(0, 0.008 * H, 0))), [rArm * 1.3, rArm * 1.55, rArm * 1.25], dir), 'upperArm' + side, grp, 0, s, { tag: 'deltoid' });
    P(cone(sh, el, rArm, rElbow), 'upperArm' + side, grp, 0.02 * H, s, { tag: 'upperArm' });
    P(cone(el, wr, rElbow * 1.02, rWrist), 'forearm' + side, grp, 0.015 * H, s, { tag: 'forearm' });
    P(ellipsoid(add(el, mul(dir, foreLen * 0.28)), [rFore * 0.98, foreLen * 0.3, rFore * 0.86], dir), 'forearm' + side, grp, 0.02 * H, s, { tag: 'forearm' });
    // Hand: a palm from the wrist to the knuckles, four fingers on their own bone
    // (so they can curl), and the thumb on the palm. In the A-pose the palm faces
    // the body and its width runs front–back, thumb at the front.
    const across = V(0, 0, 1);
    P(ellipsoid(add(wr, mul(dir, handLen * 0.3)), [0.0085 * H, handLen * 0.31, 0.024 * H], dir, across), 'hand' + side, grp, 0.012 * H, s, { tag: 'hand' });
    for (const [off, lenF, rF, back] of FINGERS) {
      const k0 = add(add(wr, mul(dir, handLen * (FINGER_ROOT - back))), mul(across, off * FINGER_PITCH * H));
      const tip = add(k0, mul(dir, handLen * lenF));
      // Tight blend: the fingers stay separate instead of fusing into a mitten.
      P(cone(add(k0, mul(dir, -handLen * 0.03)), sub(tip, mul(dir, rF * H)), rF * H * 1.08, rF * H * 0.86), 'fingers' + side, grp, 0.0016 * H, s, { tag: 'hand' });
    }
    // Thumb: the metacarpal, set into the heel of the palm, then the phalanges as a
    // separate digit (tight blend, like the fingers), angled a little away from the
    // palm, with the tip level with the middle of the index finger's first segment.
    const [thumbBase, thumbKnuckle, thumbTip] = THUMB.map(([k, x, z]) => add(add(wr, mul(dir, handLen * k)), V(-s * x * H, 0, z * H)));
    P(cone(thumbBase, thumbKnuckle, THUMB[0][3] * H, THUMB[1][3] * H), 'thumb' + side, grp, 0.006 * H, s, { tag: 'hand' });
    P(cone(thumbKnuckle, sub(thumbTip, mul(norm(sub(thumbTip, thumbKnuckle)), THUMB[2][3] * H)), 0.0053 * H, THUMB[2][3] * H),
      'thumb2' + side, grp, 0.0016 * H, s, { tag: 'hand' });
    J['thumb' + side] = thumbBase;       // the thumb turns at its base, in the heel of the palm,
    J['thumb2' + side] = thumbKnuckle;   // and bends at its knuckle
    J['fingers' + side] = add(wr, mul(dir, handLen * FINGER_ROOT));
    void he;
  }

  // Legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R', grp = 'leg' + side;
    const hj = J['thigh' + side], kn = J['shin' + side], an = J['foot' + side], toe = J['toe' + side];
    const thighTop = add(hj, V(-s * 0.004 * H, -0.03 * H, 0));
    P(cone(thighTop, kn, rThigh, rKnee), 'thigh' + side, grp, 0, s, { tag: 'thigh' });
    const shinDir = norm(sub(an, kn));
    P(cone(kn, an, rKnee * 0.98, rAnkle), 'shin' + side, grp, 0.02 * H, s, { tag: 'shin' });
    const shinLen = len(sub(an, kn));
    P(ellipsoid(add(add(kn, mul(shinDir, shinLen * 0.3)), V(0, 0, -rCalf * 0.22)), [rCalf * 0.88, shinLen * 0.3, rCalf * 0.86], shinDir), 'shin' + side, grp, 0.03 * H, s, { tag: 'shin' });
    const footC = V(an[0], 0.021 * H, (an[2] + toe[2]) * 0.5 - 0.004 * H);
    P(ellipsoid(footC, [0.023 * H, 0.021 * H, 0.078 * H], V(0, 1, 0), V(s * 0.08, 0, 1)), 'foot' + side, grp, 0.02 * H, s, { tag: 'foot' });
    P(ellipsoid(V(an[0], 0.02 * H, an[2] - 0.012 * H), [0.02 * H, 0.02 * H, 0.024 * H]), 'foot' + side, grp, 0.012 * H, s, { tag: 'foot' });
  }

  // Groups: blend within each group, then join groups into the body.
  const GROUPS = [
    { name: 'torso', join: 0 },
    { name: 'neck', join: 0.03 * H },
    { name: 'head', join: 0.011 * H },   // tight: keeps the underside of the jaw distinct from the neck
    { name: 'armL', join: 0.028 * H }, { name: 'armR', join: 0.028 * H },
    // Legs blend with the torso only (see field), never with each other.
    { name: 'legL', join: 0.05 * H, leg: true }, { name: 'legR', join: 0.05 * H, leg: true },
  ];
  const groups = GROUPS.map(G => ({ ...G, prims: prims.filter(p => p.group === G.name) }));

  // Loft → bone weights by height
  const loftBones = [[Y.hip, 'pelvis'], [Y.waist, 'spine1'], [Y.under, 'spine2'], [Y.neckBase, 'neck']];
  // Hinges (elbows, knees): the parent and child bone, the joint, and the limb's
  // direction. Their skin weights are set across the joint (see buildMesh).
  const hinges = [];
  for (const side of ['L', 'R']) {
    hinges.push(['upperArm' + side, 'forearm' + side, J['forearm' + side], norm(sub(J['hand' + side], J['upperArm' + side]))]);
    hinges.push(['thigh' + side, 'shin' + side, J['shin' + side], norm(sub(J['foot' + side], J['thigh' + side]))]);
  }

  return { m, H, Y, J, rings, prims, groups, loftBones, hinges, female, headInfo: { c: craniumC, hs }, mouth: mouthShape,
    bust, dims: { shoulderHalf, neckR, hipA: hipR.a } };
}

// Axis-aligned bounds per primitive and per group, used to skip work in field():
// a primitive (or whole group) whose box is further away than the current
// result plus its blend radius cannot change the smooth-min.
function primBox(P) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
  if (P.type === 'cone') { grow(P.a, P.r1); grow(P.b, P.r2); }
  else if (P.type === 'ell') grow(P.c, Math.max(...P.r));
  else for (let i = 0; i < LOFT_ROWS; i += 8) {
    const L = P.lut, y = P.y0 + i / P.scale;
    grow([L[i * 4], y, L[i * 4 + 3] + L[i * 4 + 1]], 0); grow([-L[i * 4], y, L[i * 4 + 3] - L[i * 4 + 2]], 0);
  }
  return { lo, hi };
}
function boxDist(p, B) {
  const dx = Math.max(B.lo[0] - p[0], 0, p[0] - B.hi[0]);
  const dy = Math.max(B.lo[1] - p[1], 0, p[1] - B.hi[1]);
  const dz = Math.max(B.lo[2] - p[2], 0, p[2] - B.hi[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function prepareBounds(spec) {
  spec.prims.forEach((P, i) => { P.index = i; P.box = primBox(P); });
  for (const G of spec.groups) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const P of G.prims) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], P.box.lo[i]); hi[i] = Math.max(hi[i], P.box.hi[i]); }
    G.box = { lo, hi };
    G.slack = G.prims.reduce((s, P) => s + P.k * 0.25, 0);
  }
}

// Groups are smooth-joined into the body in order, except the legs: each leg is
// smooth-joined to the torso alone and then added with a plain union. Blending the
// legs into everything so far (the other leg included) filled the gap between the
// inner thighs with a web, skinned to the pelvis, that stretched into a sheet across
// the crotch whenever the legs opened.
function field(spec, p, dists) {
  let total = Infinity, torso = Infinity;
  for (const G of spec.groups) {
    // Skip a group that can't reach the result: for a leg, one that can't reach the
    // torso within its blend (smin of values further apart than k is a plain min).
    const ref = G.leg ? torso : total;
    if (!dists && ref !== Infinity && boxDist(p, G.box) - G.slack >= ref + G.join) continue;
    let gd = Infinity;
    for (const P of G.prims) {
      if (!dists && gd !== Infinity && boxDist(p, P.box) >= gd + P.k) continue;
      const d = primDist(p, P);
      if (dists) dists[P.index] = d;
      gd = gd === Infinity ? d : smin(gd, d, P.k);
    }
    if (G.leg) total = Math.min(total, smin(torso, gd, G.join));
    else total = total === Infinity ? gd : smin(total, gd, G.join);
    if (G.name === 'torso') torso = gd;
  }
  return total;
}

// ════════════════════════════════════════════════════════════════
// SURFACE NETS — polygonise the field once, at rest pose
// ════════════════════════════════════════════════════════════════

function bodyBounds(spec) {
  const lo = [Infinity, 0, Infinity], hi = [-Infinity, spec.H, -Infinity];
  const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
  for (const P of spec.prims) {
    if (P.type === 'cone') { grow(P.a, P.r1); grow(P.b, P.r2); }
    else if (P.type === 'ell') grow(P.c, Math.max(...P.r));
    else spec.rings.forEach(r => { grow([r.a, r.y, r.zc + r.bf], 0); grow([-r.a, r.y, r.zc - r.bb], 0); });
  }
  lo[1] = -0.01;
  return { lo, hi };
}

// The head and upper neck, from `yFrom` up, for the finer head mesh.
function headBounds(spec, yFrom) {
  const lo = [Infinity, yFrom, Infinity], hi = [-Infinity, spec.H, -Infinity];
  for (const G of spec.groups) if (G.name === 'head' || G.name === 'neck') for (let i = 0; i < 3; i += 2) {
    lo[i] = Math.min(lo[i], G.box.lo[i]); hi[i] = Math.max(hi[i], G.box.hi[i]);
  }
  hi[1] = Math.max(...spec.groups.filter(G => G.name === 'head').map(G => G.box.hi[1]));
  return { lo, hi };
}

function polygonize(spec, h, bounds = bodyBounds(spec)) {
  const { lo, hi } = bounds;
  const pad = 3 * h;
  const org = [lo[0] - pad, lo[1] - pad, lo[2] - pad];
  const nx = Math.ceil((hi[0] - lo[0] + 2 * pad) / h) + 1;
  const ny = Math.ceil((hi[1] - lo[1] + 2 * pad) / h) + 1;
  const nz = Math.ceil((hi[2] - lo[2] + 2 * pad) / h) + 1;
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const vals = new Float32Array(nx * ny * nz);
  const p = [0, 0, 0];

  // Narrow band: evaluate a coarse lattice, and only evaluate fine points exactly
  // inside blocks that could contain the surface.
  const S = 4, band = S * h * 1.5;
  const cnx = Math.ceil((nx - 1) / S) + 1, cny = Math.ceil((ny - 1) / S) + 1, cnz = Math.ceil((nz - 1) / S) + 1;
  const coarse = new Float32Array(cnx * cny * cnz);
  const cidx = (i, j, k) => i + cnx * (j + cny * k);
  let evals = 0;
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    p[0] = org[0] + i * S * h; p[1] = org[1] + j * S * h; p[2] = org[2] + k * S * h;
    coarse[cidx(i, j, k)] = field(spec, p); evals++;
  }
  for (let bk = 0; bk < cnz - 1; bk++) for (let bj = 0; bj < cny - 1; bj++) for (let bi = 0; bi < cnx - 1; bi++) {
    const c = [];
    for (let d = 0; d < 8; d++) c.push(coarse[cidx(bi + (d & 1), bj + ((d >> 1) & 1), bk + ((d >> 2) & 1))]);
    const near = c.some(v => Math.abs(v) < band) || (Math.min(...c) < 0 && Math.max(...c) > 0);
    // Half-open ranges so block faces aren't evaluated twice; the last block closes the grid.
    const kEnd = bk === cnz - 2 ? nz : Math.min(nz, bk * S + S);
    const jEnd = bj === cny - 2 ? ny : Math.min(ny, bj * S + S);
    const iEnd = bi === cnx - 2 ? nx : Math.min(nx, bi * S + S);
    for (let k = bk * S; k < kEnd; k++)
      for (let j = bj * S; j < jEnd; j++)
        for (let i = bi * S; i < iEnd; i++) {
          const id = idx(i, j, k);
          if (near) {
            p[0] = org[0] + i * h; p[1] = org[1] + j * h; p[2] = org[2] + k * h;
            vals[id] = field(spec, p); evals++;
          } else {
            const tx = (i - bi * S) / S, ty = (j - bj * S) / S, tz = (k - bk * S) / S;
            const x00 = lerp(c[0], c[1], tx), x10 = lerp(c[2], c[3], tx), x01 = lerp(c[4], c[5], tx), x11 = lerp(c[6], c[7], tx);
            vals[id] = lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
          }
        }
  }

  // One vertex per sign-changing cell, at the mean of its edge crossings.
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let d = 0; d < 8; d++) { cv[d] = vals[idx(i + (d & 1), j + ((d >> 1) & 1), k + ((d >> 2) & 1))]; if (cv[d] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of EDGES) {
      const a = cv[e0], b = cv[e1];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      sx += lerp(e0 & 1, e1 & 1, t); sy += lerp((e0 >> 1) & 1, (e1 >> 1) & 1, t); sz += lerp((e0 >> 2) & 1, (e1 >> 2) & 1, t); n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(org[0] + (i + sx / n) * h, org[1] + (j + sy / n) * h, org[2] + (k + sz / n) * h);
  }

  // One quad per sign-changing grid edge, joining the four cells around it.
  const quads = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = vals[idx(i, j, k)] < 0;
    if (v0 !== (vals[idx(i + 1, j, k)] < 0)) quads.push([cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k)]);
    if (v0 !== (vals[idx(i, j + 1, k)] < 0)) quads.push([cid(i - 1, j, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k)]);
    if (v0 !== (vals[idx(i, j, k + 1)] < 0)) quads.push([cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k)]);
  }
  return { pos, quads: quads.map(q => q.map(c => cellVert[c])), evals };
}

// ════════════════════════════════════════════════════════════════
// MESH BUILD — projection, normals, skin weights, clothing colours
// ════════════════════════════════════════════════════════════════

const BONES = ['pelvis', 'spine1', 'spine2', 'neck', 'head',
  'clavL', 'upperArmL', 'forearmL', 'handL', 'clavR', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'bustL', 'bustR', 'fingersL', 'fingersR', 'thumbL', 'thumbR', 'thumb2L', 'thumb2R'];
const PARENT = { spine1: 'pelvis', spine2: 'spine1', neck: 'spine2', head: 'neck', bustL: 'spine2', bustR: 'spine2',
  clavL: 'spine2', upperArmL: 'clavL', forearmL: 'upperArmL', handL: 'forearmL', fingersL: 'handL', thumbL: 'handL', thumb2L: 'thumbL',
  clavR: 'spine2', upperArmR: 'clavR', forearmR: 'upperArmR', handR: 'forearmR', fingersR: 'handR', thumbR: 'handR', thumb2R: 'thumbR',
  thighL: 'pelvis', shinL: 'thighL', footL: 'shinL', thighR: 'pelvis', shinR: 'thighR', footR: 'shinR' };
const BONE_HUE = {};
BONES.forEach((b, i) => BONE_HUE[b] = new THREE.Color().setHSL((i * 0.618) % 1, 0.65, 0.55));

// Forward differences — f(p) is already known wherever this is called.
function gradient(spec, p, e, f0) {
  const q = p.slice();
  const g = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    q[i] = p[i] + e; g[i] = (field(spec, q) - f0) / e; q[i] = p[i];
  }
  return g;
}

function loftWeights(spec, y) {
  const B = spec.loftBones;
  if (y <= B[0][0]) return [[B[0][1], 1]];
  for (let i = 0; i < B.length - 1; i++) {
    if (y <= B[i + 1][0]) {
      const t = (y - B[i][0]) / (B[i + 1][0] - B[i][0]);
      const s = t * t * (3 - 2 * t);
      return [[B[i][1], 1 - s], [B[i + 1][1], s]];
    }
  }
  return [[B[B.length - 1][1], 1]];
}

// Garment coverage for a vertex: signed distance in metres to each garment's edge
// (positive = covered). Stored per vertex and thresholded per pixel in the shader,
// so edges come out as clean lines instead of following the triangle grid.
// Each primitive near a vertex reports its own distances; buildMesh blends them
// with the skin weights so edges stay smooth where body parts meet.
const NONE = -0.03;
const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hairline(spec, p) {
  const { c, hs } = spec.headInfo;
  const qx = p[0] - c[0], qy = p[1] - c[1], qz = p[2] - c[2];
  const f = (1 - Math.cos(Math.atan2(qx, qz))) / 2;          // 0 = front, 1 = back
  const lineY = f < 0.5 ? lerp(0.03, 0.002, f / 0.5) : lerp(0.002, -0.052, (f - 0.5) / 0.5);
  return qy - lineY * hs;
}
// How far each part of the body gives way when pressed against someone (see CONTACT):
// soft tissue (belly, glutes, bust) the most, bony parts (shins, head) the least.
function softness(spec, tag, loft, y) {
  if (loft) return y < spec.Y.hip ? 0.8 : y < spec.Y.under ? 1 : 0.5;
  return { bust: 1, glute: 1, groin: 0.6, thigh: 0.7, shin: 0.35, deltoid: 0.5, upperArm: 0.5, forearm: 0.35,
    neck: 0.4, hand: 0.15, foot: 0.15 }[tag] || 0.1;
}
function hairCoverage(P, spec, p) {
  const tag = P.tag || P.group;
  return tag === 'head' || tag === 'hair' ? hairline(spec, p) : tag === 'hairBun' ? 0.03 : NONE;
}

// ── Clothing layers ─────────────────────────────────────────────
// A character's wardrobe (preset.wardrobe) holds named garment layers, and each
// look (preset.looks) lists the ones worn, innermost first. The shader paints
// them over the skin in that order, so an outer layer covers an inner one
// wherever both reach. Every layer has a `kind` (a function below) and a colour.
// Changing a look only recomputes the coverage (dress()), not the mesh.
const MAX_LAYERS = 8, BASIS_K = 8, THIGH_LIMIT = 0.5;
function lookLayers(m, look = m.look) {
  return ((m.looks || {})[look] || []).map(id => m.wardrobe[id]).filter(Boolean);
}

// Tops: from `from` (underbust / waist / hip) up to the neckline. Scoop ends above
// the armpits, crew at the base of the neck, both higher at the back; the default
// is crew for male builds, scoop otherwise. `sleeves`: 0 none, 1 to the elbow, 2 long.
// A V neck: how far below the crew line the neckline drops at sideways position x (zero at VNECK_HALF × height out, deepest in the middle).
const VNECK_DEPTH = 0.05, VNECK_HALF = 0.031;
const vNeckDrop = (H, x) => Math.max(0, 1 - Math.abs(x) / (VNECK_HALF * H)) * VNECK_DEPTH * H;
function topCoverage(spec, L, tag, torso, p, t, coneLen) {
  const Y = spec.Y, H = spec.H;
  let from = { underbust: Y.under - 0.012 * H, belly: Y.belly - 0.01 *H, waist: Y.waist - 0.01 * H, hip: Y.hip - 0.02 * H }[L.from];
  if (L.hemUp) from = Math.max(from, Y.belly - 0.01 * H);   // (bottoms are down: a long top is drawn up to the belly line, see buildHem)
  const neck = L.neck || (spec.m.build === 'male' ? 'crew' : 'scoop');
  const base = Y.neckBase - 0.016 * H + 0.008 * H * smooth01(0.02, -0.02, p[2]) - (neck === 'v' ? vNeckDrop(H, p[0]) * smooth01(-0.02, 0.02, p[2]) : 0);   // (a V is cut into the front only)
  // A collared shirt is painted right up to the neck at the back and the shoulders (the collar band lies over the edge, so no skin shows at the nape), and keeps its own opening at the front, which the collar's points follow.
  const neckline = neck === 'crew' || neck === 'v'
    ? (L.collar ? lerp(Y.neckBase + 0.03 * H, base, smooth01(-0.025, 0.025, p[2])) : base)
    : Y.armpit + 0.022 * H + 0.018 * H * smooth01(0.02, -0.02, p[2]);
  if (torso || tag === 'thigh') return Math.min(p[1] - from, neckline - p[1]);   // long tops reach the upper thigh
  if (tag === 'deltoid') return L.sleeves > 0 ? 0.05 : NONE;
  if (tag === 'upperArm') return (L.sleeves - t) * coneLen;
  if (tag === 'forearm') return (L.sleeves - 1 - t) * coneLen;
  return NONE;
}
// Bottoms: from the belly line down; `legLen` in thigh lengths (below 1: shorts,
// 2: to the ankle). Short hems are horizontal (in the rest pose) so the inside leg
// is covered as far down as the outside.
// Lowered (L.lowered, see setLowered): nothing on the torso or upper thighs; a band
// round each knee, from LOWER_BAND[0] × height above the knee joint to LOWER_BAND[1]
// below it (shorts), or on down the shin as normal (long legs). With lowerTo: 'calf'
// the garment is pushed further, covering from LOWER_CALF of the way down the shin
// to its hem. The bunched roll of fabric at the top is a separate mesh (buildBunches).
// lowerTo: 'ankle' pushes it all the way down: covering from LOWER_ANKLE down the shin.
const LOWER_BAND = [0.045, 0.02], LOWER_CALF = 0.45, LOWER_ANKLE = 0.8;
// Where bottoms start on the body: `from` 'belly' (the default: the belly line), 'waist' (up to just under a top whose own `from` is 'waist', so the two
// meet) or 'hip' (low-slung).
function bottomTop(spec, L) {
  const Y = spec.Y, H = spec.H;
  return L.from === 'waist' ? Y.waist + 0.012 * H : L.from === 'hip' ? Y.hip + 0.012 * H : Y.belly;
}
function bottomCoverage(spec, L, tag, torso, p, t, coneLen) {
  if (L.lowered && (L.lowerTo === 'calf' || L.lowerTo === 'ankle')) {
    if (tag !== 'shin' || !coneLen) return NONE;
    return Math.min((t - (L.lowerTo === 'ankle' ? LOWER_ANKLE : LOWER_CALF)) * coneLen, (L.legLen - 1 - t) * coneLen);
  }
  if (L.lowered) {
    if (torso || !coneLen) return NONE;
    if (tag === 'thigh') return (t - (1 - LOWER_BAND[0] * spec.H / coneLen)) * coneLen;
    if (tag === 'shin') return L.legLen < 1 ? (LOWER_BAND[1] * spec.H / coneLen - t) * coneLen : (L.legLen - 1 - t) * coneLen;
    return NONE;
  }
  if (torso) return bottomTop(spec, L) - p[1];
  if (tag === 'thigh') return L.legLen < 1 ? p[1] - (spec.J.thighL[1] - L.legLen * coneLen) : (L.legLen - t) * coneLen;
  if (tag === 'shin') return (L.legLen - 1 - t) * coneLen;
  return NONE;
}
function shoeCoverage(spec, L, tag, torso, p, t, coneLen) {
  return tag === 'shin' ? (t - 0.9) * coneLen : tag === 'foot' ? 0.05 : NONE;
}
// Briefs. One edge rule for every part they cover (torso and thighs alike), in the
// rest pose, so an edge never depends on which body part a vertex is closest to.
// The waistband sits `rise` of the way from the hip line (0) to the belly line (1).
// `leg` gives trunks: a level hem `leg` × height below the crotch line. Otherwise
// the leg opening is one continuous curve around the hip, measured by the angle
// around the pelvis (front centre, side seam, back centre), so front and back meet
// at the same height at the side:
//   gusset: `gusset` × height each side of the centre line, down to just under the
//     body's own crotch point (dims.crotchY, found by probing the body), so it wraps
//     the underside without running down the inner thighs. In front it widens
//     upward, meeting the leg openings in a V.
//   side:   the opening's height at the side seam, `side` of the way from the crotch
//     point to the hip line. The front rises to it evenly from the gusset.
//   back:   'full' (the default) covers everything down to the gusset's depth.
//     'brief' comes down from the side to the gusset; `backCurve` below 1 stays high
//     longer, cutting higher over the cheeks. 'thong' leaves only a narrow waistband
//     and a strip down the centre, `thong` × height either side of it at the bottom,
//     widening to a small triangle under the band; the front then rises to the
//     band's lower edge at the side, so it narrows into the band.
// Each piece is a signed distance, joined by min/max, so the edge stays continuous.
function crotchY(spec) {
  // The lowest point of the body on the centre line, front to back (the surface
  // dips a little lower toward the front than straight under the hips).
  if (spec.dims.crotchY == null) {
    let lo = Infinity;
    for (let z = -0.05; z <= 0.05; z += 0.005) {
      const p = [0, spec.Y.crotch, z * spec.H / 1.7];
      if (field(spec, p) >= 0) continue;
      while (field(spec, p) < 0 && p[1] > 0) p[1] -= 0.001;
      lo = Math.min(lo, p[1]);
    }
    spec.dims.crotchY = lo;
  }
  return spec.dims.crotchY;
}
// The waistband's height at angle a around the pelvis (0 front, 1 side, 2 back):
// `rise` in front, sweeping smoothly over the hips to `riseBack` (default the same)
// at the back, both as fractions of the way from the hip line to the belly line.
function briefsWaist(spec, L, a) {
  const back = L.riseBack == null ? L.rise : L.riseBack;
  return lerp(spec.Y.hip, spec.Y.belly, lerp(L.rise, back, smooth01(0, 2, a)));
}
// Where lowered briefs' rolled waistband sits, as a distance down the thigh from the hip
// joint: briefs and hipsters below the thigh's crease (its lowest point, so the band is
// clear of the buttock all round, plus BRIEFS_DOWN.below × height: far enough that the
// band and its gusset clear the crotch with the legs spread); a thong further,
// near the knee (BRIEFS_DOWN.thong of the way to it).
const BRIEFS_DOWN = { below: 0.04, thong: 0.78 };
function briefsDown(spec, L) {
  const H = spec.H, thong = L.back === 'thong', thigh = len(sub(spec.J.shinL, spec.J.thighL));
  return { roll: thong ? BRIEFS_DOWN.thong * thigh : (spec.dims.creaseLow || 0.1 * H) + BRIEFS_DOWN.below * H, thong };
}
// Lowered briefs (L.lowered, see setLowered) paint nothing: they're the rolled band and the
// fabric between the legs (buildBunches). Trunks are lowered as shorts are, to the knees.
function briefsCoverage(spec, L, tag, torso, p, t, coneLen) {
  if (L.lowered) return L.leg ? bottomCoverage(spec, { lowered: true, legLen: 0.5 }, tag, torso, p, t, coneLen) : NONE;
  if (!torso && tag !== 'thigh') return NONE;
  const Y = spec.Y, H = spec.H, x = Math.abs(p[0]), y = p[1];
  // Angle around the pelvis: 0 at the front centre, 1 at the side seam, 2 at the back centre.
  const a = Math.atan2(x, p[2] + 0.004 * H) / (Math.PI / 2);
  const waist = briefsWaist(spec, L, a);
  if (L.leg) return Math.min(y - (Y.crotch - L.leg * H), waist - y);
  const cy = crotchY(spec), bottom = cy - 0.012 * H, g = (L.gusset || 0.02) * H;
  const thong = L.back === 'thong', bandLo = waist - 0.012 * H;
  // For a thong the front rises to the band's lower edge at the side seam.
  const sideY = thong ? briefsWaist(spec, L, 1) - 0.012 * H : lerp(cy, Y.hip, L.side == null ? 0.7 : L.side);
  let cov;
  if (a <= 1) {
    cov = Math.max(Math.min(g + Math.max(0, y - cy) * 0.9 - x, y - bottom), y - lerp(cy, sideY, a));
  } else if (thong) {
    // The strip widens into the gusset at the bottom (as a real thong does, and so it
    // stays wider than the mesh spacing between spread legs) and into a small triangle
    // under the band at the top.
    const wBase = lerp(0.6 * g, (L.thong || 0.005) * H, smooth01(cy, cy + 0.06 * H, y));
    const w = lerp(wBase, 0.03 * H, smooth01(Y.hip - 0.05 * H, bandLo, y));
    cov = Math.max(y - bandLo, Math.min(w - x, y - bottom));
  } else if (L.back === 'brief') {
    cov = Math.max(Math.min(g - x, y - bottom), y - lerp(cy, sideY, Math.pow(2 - a, L.backCurve || 1)));
  } else cov = y - bottom;
  return Math.min(waist - y, cov);
}
// Bras. A band under the bust; in front, an edge that runs from the centre gore up
// the inside of each cup to the strap point, and down the outside to the band at
// the side; straps from there over the shoulder and down the back. Styles set the
// defaults; any of them can be overridden on the layer. Heights are × body height,
// `apex` (the strap point) is × the bust radius above its centre. `edge` shapes the
// inside of the cup: 'line' (triangle), 'round' (full cup) or 'scoop' (a U across
// the front). Straps narrower than about 1.5 voxels break up, as the edge can't be
// resolved between vertices: 0.0075 × height is about 1.3 cm on Aya.
const BRA_STYLES = {
  // Small triangle cups, a narrow band, thin straps.
  bralette: { band: 0.009, back: 0.01, gore: 0.006, apex: 0.95, apexOut: -0.1, strap: 0.0075, edge: 'line', racer: false },
  // Rounded full cups, a medium band and straps.
  classic:  { band: 0.014, back: 0.016, gore: 0.02, apex: 0.62, apexOut: 0, strap: 0.0085, edge: 'round', racer: false },
  // Support/sports: a high scoop across the front, a deep band, wide racer-back straps.
  // strapOut keeps the wide straps near the neck, off the skin that moves with a raised arm.
  sports:   { band: 0.026, back: 0.05, gore: 0.06, apex: 1.5, apexOut: 0.25, strap: 0.028, edge: 'scoop', racer: true, strapOut: 0.1 },
};
function braCoverage(spec, L, tag, torso, p) {
  const b = spec.bust;
  // Straps are measured on the neck and upper arm too: where those blend into the
  // shoulder, a "not covered" from them would pull the strap's edge in and break it up.
  const nearStrap = tag === 'deltoid' || tag === 'neck' || tag === 'upperArm';
  if (!b || (!torso && !nearStrap)) return NONE;
  const S = { ...BRA_STYLES[L.style || 'classic'], ...L };
  const Y = spec.Y, H = spec.H, x = Math.abs(p[0]), y = p[1];
  const front = smooth01(-0.015, 0.015, p[2] - 0.002 * H);    // 1 in front, 0 behind
  // The band sits in the fold under the bust, which is below the underbust line on a fuller bust.
  const fold = Math.min(Y.under, b.y - b.ry * 0.95);
  const bandLo = fold - S.band * H, backTop = fold + S.back * H;
  const xg = 0.008 * H, yg = fold + S.gore * H;                    // centre gore
  const xa = b.x + S.apexOut * b.rb, ya = b.y + S.apex * b.rb;     // strap point
  const xs = b.x + 1.4 * b.rb;                                     // side of the cup
  const inner = { line: u => u, round: u => Math.sin(u * Math.PI / 2), scoop: u => 1 - Math.cos(u * Math.PI / 2) }[S.edge];
  const outer = S.edge === 'line' ? u => u : u => 1 - Math.cos(u * Math.PI / 2);
  const frontTop = x <= xg ? yg
    : x <= xa ? yg + (ya - yg) * inner((x - xg) / (xa - xg))
    : ya + (backTop - ya) * outer(clamp((x - xa) / (xs - xa), 0, 1));
  const body = !torso ? NONE : Math.min(y - bandLo, lerp(backTop, frontTop, front) - y);
  // Straps: straight lines (in the rest pose) from the strap point, and from the back
  // band (at the centre for a racer back), to the top of the shoulder.
  // Where the straps cross the shoulder: `strapOut` of the way from beside the neck to the shoulder's edge.
  const d = spec.dims, xSh = lerp(d.neckR * 1.2, d.shoulderHalf, S.strapOut == null ? 0.42 : S.strapOut), ySh = Y.shoulder;
  const along = (x0, y0) => x0 + (xSh - x0) * clamp((y - y0) / (ySh - y0), 0, 1);
  const xBack = S.racer ? 0.01 * H : xa;
  const xl = lerp(along(xBack, backTop), along(xa, ya), front), y0 = lerp(backTop, ya, front);
  // Each strap starts a little below its anchor (a strap's width below it), so it joins the cup or band cleanly.
  const strap = Math.min(S.strap * H / 2 - Math.abs(x - xl), y - y0 + Math.max(0.01, S.strap) * H);
  return Math.max(body, strap);
}
const LAYER_KINDS = { top: topCoverage, bottom: bottomCoverage, shoes: shoeCoverage, briefs: briefsCoverage, bra: braCoverage };
function layerCoverage(spec, L, P, p, t, coneLen) {
  const tag = P.tag || P.group, torso = P.type === 'loft' || tag === 'bust' || tag === 'glute' || tag === 'groin' || tag === 'perineum';
  const f = LAYER_KINDS[L.kind];
  return f ? f(spec, L, tag, torso, p, t, coneLen) : NONE;
}

// Puts `layers` (innermost first; default: the character's current look) on a built
// character: coverage per vertex from the primitives recorded at build time, blended
// with their skin weights so edges stay smooth where body parts meet.
function dress(ch, layers = lookLayers(ch.spec.m)) {
  const spec = ch.spec, geo = ch.mesh.geometry, { idx, w } = geo.userData.basis;
  const pos = geo.attributes.position.array, nV = pos.length / 3;
  // Cloth layers (a skirt) are their own meshes; only painted layers go to the shader.
  const cloth = layers.find(L => L.kind === 'skirt');
  if (cloth && !(ch.skirt && ch.skirt.L === cloth)) { removeSkirt(ch); buildSkirt(ch, cloth); }
  else if (!cloth && ch.skirt) removeSkirt(ch);
  if (ch.skirt) ch.skirt.mesh.material.color.copy(lin(cloth.color));
  layers = layers.filter(L => LAYER_KINDS[L.kind]).slice(0, MAX_LAYERS);
  // Lowered garments (setLowered) are measured as such; ch.layers keeps the originals.
  const bottomsDown = layers.some(L => L.kind === 'bottom' && ch.lowered && ch.lowered.has(L));
  const cov = layers.map(L => ch.lowered && ch.lowered.has(L) ? { ...L, lowered: true } : (bottomsDown && L.kind === 'top' ? { ...L, hemUp: true } : L));
  // The bunched rolls only show while the lowered garment is actually worn, and lowered
  // briefs only once nothing worn over them (bottoms still up) hides them.
  const bottomsUp = layers.some(L => L.kind === 'bottom' && !(ch.lowered && ch.lowered.has(L)));
  for (const B of (ch.bunches || new Map()).values())
    { B.mesh.visible = B.gusset.visible = layers.includes(B.L) && !(B.L.kind === 'briefs' && bottomsUp); B.inner.visible = B.mesh.visible && !B.strip; }
  // Limb cones by tag+side, so ellipsoid muscles can report position along their limb.
  const limbCone = {};
  spec.prims.forEach(P => { if (P.type === 'cone' && P.tag) limbCone[P.tag + P.side] = P; });
  const A = geo.attributes.layerA.array, B = geo.attributes.layerB.array;
  A.fill(NONE); B.fill(NONE);
  // How much of each vertex moves with a thigh, smoothed over its neighbours (the
  // top-4 weights jump a little from vertex to vertex, which made a ragged edge).
  if (!geo.userData.thighW) {
    const skinIdx = geo.attributes.skinIndex.array, skinW = geo.attributes.skinWeight.array;
    const iL = BONES.indexOf('thighL'), iR = BONES.indexOf('thighR');
    let tw = new Float32Array(nV);
    for (let v = 0; v < nV; v++) for (let k = 0; k < 4; k++) if (skinIdx[4 * v + k] === iL || skinIdx[4 * v + k] === iR) tw[v] += skinW[4 * v + k];
    const idx3 = geo.index.array, sum = new Float32Array(nV), cnt = new Float32Array(nV);
    for (let it = 0; it < 3; it++) {
      sum.set(tw); cnt.fill(1);
      for (let i = 0; i < idx3.length; i += 3) for (let e = 0; e < 3; e++) {
        const a = idx3[i + e], b = idx3[i + (e + 1) % 3];
        sum[a] += tw[b]; cnt[a]++; sum[b] += tw[a]; cnt[b]++;
      }
      tw = sum.map((s, v) => s / cnt[v]);
    }
    geo.userData.thighW = tw;
    geo.userData.crease = thighCreases(spec, pos, tw);
    // The crease's lowest point on either thigh (along the thigh from the hip), for lowered briefs.
    spec.dims.creaseLow = Math.max(...geo.userData.crease.L.c, ...geo.userData.crease.R.c);
    // Each vertex's distance to the crease, for the marks' lower edge (see addMark).
    const cd = geo.attributes.creaseD.array, q = [0, 0, 0];
    for (let v = 0; v < nV; v++) { q[0] = pos[3 * v]; q[1] = pos[3 * v + 1]; q[2] = pos[3 * v + 2]; cd[v] = creaseDistance(geo.userData.crease, q); }
    geo.attributes.creaseD.needsUpdate = true;
  }
  const crease = geo.userData.crease;
  const p = [0, 0, 0], sums = new Float64Array(layers.length);
  for (let v = 0; v < nV; v++) {
    p[0] = pos[3 * v]; p[1] = pos[3 * v + 1]; p[2] = pos[3 * v + 2];
    sums.fill(0);
    let ws = 0, pw = 0;
    for (let k = 0; k < BASIS_K; k++) {
      const wk = w[v * BASIS_K + k];
      if (!wk) break;
      const P = spec.prims[idx[v * BASIS_K + k]];
      if (P.tag === 'perineum') pw += wk;
      const LC = P.tag ? limbCone[P.tag + P.side] : null;
      const t = LC ? coneT(p, LC) : 0, cl = LC ? Math.sqrt(LC.l2) : 0;
      for (let l = 0; l < layers.length; l++) sums[l] += wk * clamp(layerCoverage(spec, cov[l], P, p, t, cl), -0.03, 0.03);
      ws += wk;
    }
    // Briefs (not trunks) stop at the crease where the thigh takes over, so their leg
    // openings never paint skin that swings out with the legs.
    const toCrease = creaseDistance(crease, p);
    for (let l = 0; l < layers.length; l++) {
      let c = sums[l] / ws;
      // The base between the thighs (the perineum piece) is exempt: that skin moves
      // partly with the thighs, but it's what the gusset is there to cover.
      if (layers[l].kind === 'briefs' && !layers[l].leg && !cov[l].lowered) c = Math.min(c, Math.max(toCrease, (pw / ws - 0.15) * 0.05));
      (l < 4 ? A : B)[4 * v + (l & 3)] = c;
    }
  }
  geo.attributes.layerA.needsUpdate = true; geo.attributes.layerB.needsUpdate = true;
  const u = ch.mesh.material.userData.uniforms;
  u.uLayer.value.forEach((c, l) => c.copy(layers[l] ? lin(layers[l].color) : u.uSkin.value));
  ch.layers = layers;
  // A shirt (a top with a collar, a placket or rolled cuffs): the painted fastening, and the 3D collar and cuffs.
  const shirtIdx = layers.findIndex(L => L.kind === 'top' && L.placket);
  if (shirtIdx >= 0) {
    const L = layers[shirtIdx], H = spec.H, Y = spec.Y, from = { underbust: Y.under - 0.012 * H, waist: Y.waist - 0.01 * H, belly: Y.belly - 0.01 * H, hip: Y.hip - 0.02 * H }[L.from];
    const tip = Y.neckBase - 0.016 * H - ((L.neck || '') === 'v' ? VNECK_DEPTH * H : 0);
    u.uShirt.value.set((L.placketWidth || 0.0125) * H / 1.78, tip, from + 0.004, 1);
    u.uShirtA.value.set(...[0, 1, 2, 3].map(i => i === shirtIdx ? 1 : 0)); u.uShirtB.value.set(...[4, 5, 6, 7].map(i => i === shirtIdx ? 1 : 0));
    u.uShirtBtn.value.set(...lin(L.buttons != null ? L.buttons : 0xe6e0d0).toArray(), (L.buttonGap || 0.042) * H);
  } else u.uShirt.value.w = 0;
  const shirt = layers.find(L => L.kind === 'top' && (L.collar || L.cuffs));
  if (shirt) buildShirtParts(ch, shirt); else removeShirtParts(ch);
  const belted = layers.find(L => L.belt && (L.kind === 'bottom' || L.kind === 'top' || L.kind === 'skirt') && !(ch.lowered && ch.lowered.has(L)));
  if (belted) buildBelt(ch, belted); else removeBelt(ch);
  // A top that reaches below the belly, with the bottoms down, is tugged up to it: a solid roll of cloth round the hips there (not simulated: the way the collar and the lowered bottoms are)
  const hemL = bottomsDown && layers.find(L => L.kind === 'top' && ({ underbust: 9, belly: 9, waist: 9 }[L.from] == null));
  if (hemL) buildHem(ch, hemL); else removeHem(ch);
}
// The crease where each thigh takes over from the torso, as a smooth curve: around
// the thigh's axis (CREASE_BINS angles), how far down the axis from the hip joint
// the skin that mostly moves with the thigh (smoothed weight over THIGH_LIMIT)
// begins. Taken from the skin weights, so it matches how the mesh actually bends;
// smoothed around the circle, because the weights themselves are uneven vertex to
// vertex and an edge drawn straight from them comes out scalloped.
const CREASE_BINS = 72;
function thighCreases(spec, pos, tw) {
  const H = spec.H, nV = pos.length / 3, out = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const hip = spec.J['thigh' + side], d = norm(sub(spec.J['shin' + side], hip));
    const e1 = norm(sub([0, 0, 1], mul(d, d[2]))), e2 = cross(d, e1);
    const top = new Float32Array(CREASE_BINS).fill(Infinity);
    for (let v = 0; v < nV; v++) {
      if (tw[v] < THIGH_LIMIT || pos[3 * v] * s <= 0) continue;
      const q = sub([pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]], hip), t = dot(q, d);
      if (t < -0.05 * H || t > 0.25 * H) continue;
      const b = Math.floor((Math.atan2(dot(q, e2), dot(q, e1)) / (2 * Math.PI) + 0.5) * CREASE_BINS) % CREASE_BINS;
      top[b] = Math.min(top[b], t);
    }
    // Fill any empty angle from its neighbours, then smooth around the circle.
    let c = Array.from(top);
    for (let it = 0; it < CREASE_BINS && c.some(x => x === Infinity); it++)
      c = c.map((x, i) => x !== Infinity ? x : Math.min(c[(i + 1) % CREASE_BINS], c[(i + CREASE_BINS - 1) % CREASE_BINS]));
    for (let it = 0; it < 4; it++)
      c = c.map((x, i) => (c[(i + CREASE_BINS - 2) % CREASE_BINS] + c[(i + CREASE_BINS - 1) % CREASE_BINS] + x + c[(i + 1) % CREASE_BINS] + c[(i + 2) % CREASE_BINS]) / 5);
    out[side] = { hip, d, e1, e2, c };
  }
  return out;
}
// Signed distance (metres, along the thigh axis) from a rest-pose point to the crease
// of the thigh on its side: positive on the torso side, negative on the thigh.
function creaseDistance(crease, p) {
  const C = crease[p[0] >= 0 ? 'L' : 'R'];
  const q = sub(p, C.hip), t = dot(q, C.d);
  const f = (Math.atan2(dot(q, C.e2), dot(q, C.e1)) / (2 * Math.PI) + 0.5) * CREASE_BINS - 0.5;
  const i = Math.floor(f), u = f - i, a = C.c[(i + CREASE_BINS) % CREASE_BINS], b = C.c[(i + 1 + CREASE_BINS) % CREASE_BINS];
  return a + (b - a) * u - t;
}

// A new skin tone on a built character (no rebuild).
function setSkin(ch, hex) {
  ch.spec.m.skin = hex;
  const u = ch.mesh.material.userData.uniforms;
  u.uSkin.value.copy(lin(hex));
  if (ch.face) for (const lm of [ch.face.lidMat, ...ch.face.lidMats]) lm.color.copy(lin(hex));   // eyelids match
  if (ch.spec.m.lipColor == null) u.uLipCol.value.copy(lin(hex)).lerp(lin(0xa84a52), ch.spec.m.build === 'male' ? 0.22 : 0.62);
}

// The head is meshed separately at HEAD_VOXEL × the body's voxel size, so the jaw
// line and profile stay smooth close up. The body mesh stops at a cut through the
// mid-neck (HEAD_CUT × height below the chin) and the head mesh starts HEAD_OVERLAP
// below that. In the overlap both lie on the same surface; the body's copy is
// drawn in by a little (0.3 mm at the bottom of the band, 1.5 mm at the cut) so the
// head mesh always draws on top. The band sits on the straight part of the neck:
// on the concave throat under the jaw, coarse triangles bulge outward by more
// than that and poke through.
const HEAD_VOXEL = 0.4, HEAD_CUT = 0.018, HEAD_OVERLAP = 0.012;
// Regions meshed finer than the body: the head, and each hand (from a cut across
// the forearm just above the wrist). Each has an axis coordinate s(p), the cut
// (body triangles beyond it are dropped) and the start of the overlap band.
const HAND_VOXEL = 0.3, HAND_CUT = -0.012, HAND_OVERLAP = 0.012;
function fineRegions(spec, h) {
  const H = spec.H, yCut = spec.Y.chin - HEAD_CUT * H;
  const regions = [{ h: h * HEAD_VOXEL, s: p => p[1], cut: yCut, from: yCut - HEAD_OVERLAP * H }];
  regions[0].box = headBounds(spec, regions[0].from);
  for (const side of ['L', 'R']) {
    const wr = spec.J['hand' + side], dir = norm(sub(wr, spec.J['forearm' + side]));
    const cut = HAND_CUT * H, from = cut - HAND_OVERLAP * H;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
    for (const P of spec.prims) if (P.bone === 'hand' + side || P.bone === 'fingers' + side || P.bone === 'thumb' + side || P.bone === 'thumb2' + side) { grow(P.box.lo, 0); grow(P.box.hi, 0); }
    grow(add(wr, mul(dir, from)), spec.m.wrist / 100 / (2 * Math.PI) * 1.4);
    regions.push({ h: h * HAND_VOXEL, s: p => dot(sub(p, wr), dir), cut, from, box: { lo, hi } });
  }
  return regions;
}
const inBox = (p, B, m = 0) => p[0] >= B.lo[0] - m && p[0] <= B.hi[0] + m && p[1] >= B.lo[1] - m && p[1] <= B.hi[1] + m && p[2] >= B.lo[2] - m && p[2] <= B.hi[2] + m;

const HINGE_BLEND = 0.012;   // × height, each side of an elbow or knee (about 2 cm)
function buildMesh(spec, h) {
  const t0 = performance.now();
  prepareBounds(spec);
  const regions = fineRegions(spec, h);
  const body = polygonize(spec, h);
  const fine = regions.map(R => polygonize(spec, R.h, R.box));
  // Merge: body quads entirely past a region's cut (and inside it) are dropped, as
  // are fine quads entirely before the overlap; unused vertices are removed.
  const pos = [], cellH = [], quads = [], remap = new Map();
  const at = (src, i) => [src[3 * i], src[3 * i + 1], src[3 * i + 2]];
  const addVert = (src, i, hv, key) => {
    let id = remap.get(key);
    if (id === undefined) { id = pos.length / 3; remap.set(key, id); pos.push(...at(src, i)); cellH.push(hv); }
    return id;
  };
  const pastCut = p => regions.some(R => inBox(p, R.box, 0.01) && R.s(p) > R.cut);
  for (const q of body.quads) {
    if (q.some(i => i < 0) || q.every(i => pastCut(at(body.pos, i)))) continue;
    quads.push(q.map(i => addVert(body.pos, i, h, 'b' + i)));
  }
  fine.forEach((F, r) => {
    const R = regions[r];
    for (const q of F.quads) {
      if (q.some(i => i < 0) || q.every(i => R.s(at(F.pos, i)) < R.from)) continue;
      quads.push(q.map(i => addVert(F.pos, i, R.h, r + ':' + i)));
    }
  });
  const evals = body.evals + fine.reduce((s, F) => s + F.evals, 0);
  const nV = pos.length / 3;
  const tPoly = performance.now();

  // Project vertices onto the zero set (two Newton steps) and take normals from the gradient.
  const normals = new Float32Array(nV * 3);
  const positions = new Float32Array(pos);
  for (let v = 0; v < nV; v++) {
    const hv = cellH[v], e = hv * 0.2;
    const p = [positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]];
    for (let it = 0; it < 2; it++) {
      const d = field(spec, p);
      const g = gradient(spec, p, e, d);
      const gg = dot(g, g) || 1;
      const step = clamp(d / gg, -hv, hv);
      p[0] -= g[0] * step; p[1] -= g[1] * step; p[2] -= g[2] * step;
    }
    const n = norm(gradient(spec, p, e, field(spec, p)));
    // Body vertices in an overlap band sit just inside the finer mesh's surface.
    if (hv === h) for (const R of regions) {
      if (!inBox(p, R.box, 0.01) || R.s(p) <= R.from) continue;
      const inset = 0.0003 + 0.0012 * smooth01(R.from, R.cut, R.s(p));
      p[0] -= n[0] * inset; p[1] -= n[1] * inset; p[2] -= n[2] * inset;
      break;
    }
    positions.set(p, 3 * v);
    normals.set(n, 3 * v);
  }

  const tProj = performance.now();
  // Triangles, wound to agree with the field gradient.
  const index = [];
  const P3 = i => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
  for (const q of quads) {
    if (q.some(i => i < 0)) continue;
    const [a, b, c, d] = q;
    const pa = P3(a), pb = P3(b), pc = P3(c), pd = P3(d);
    const split = len(sub(pa, pc)) < len(sub(pb, pd));
    const tris = split ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [x, y, z] of tris) {
      const fn = cross(sub(P3(y), P3(x)), sub(P3(z), P3(x)));
      const vn = [normals[3 * x] + normals[3 * y] + normals[3 * z], normals[3 * x + 1] + normals[3 * y + 1] + normals[3 * z + 1], normals[3 * x + 2] + normals[3 * y + 2] + normals[3 * z + 2]];
      if (dot(fn, vn) < 0) index.push(x, z, y); else index.push(x, y, z);
    }
  }

  // Skin weights: softmax over primitive distances, primitives → bones.
  const sigma = 0.011 * spec.H;
  const nP = spec.prims.length;
  const dists = new Float32Array(nP);
  const skinIndex = new Uint16Array(nV * 4), skinWeight = new Float32Array(nV * 4);
  const hairCov = new Float32Array(nV), softAttr = new Float32Array(nV), wcolors = new Float32Array(nV * 3);
  // The strongest BASIS_K primitives at each vertex and their weights, kept so that
  // clothing can be recomputed later (dress) without redoing this pass.
  const basisIdx = new Uint16Array(nV * BASIS_K), basisW = new Float32Array(nV * BASIS_K);
  const cand = [];
  const boneIdx = {}; BONES.forEach((b, i) => boneIdx[b] = i);
  const wc = new THREE.Color();
  for (let v = 0; v < nV; v++) {
    const p = P3(v);
    field(spec, p, dists);
    const side = p[0] > 0.004 ? 1 : p[0] < -0.004 ? -1 : 0;
    let dmin = Infinity;
    for (let i = 0; i < nP; i++) {
      const P = spec.prims[i];
      if (side && P.side && P.side !== side) continue;
      if (dists[i] < dmin) dmin = dists[i];
    }
    const acc = {};
    let hsum = 0, wsum = 0, ssum = 0;
    cand.length = 0;
    for (let i = 0; i < nP; i++) {
      const P = spec.prims[i];
      if (side && P.side && P.side !== side) continue;
      const w = Math.exp(-(dists[i] - dmin) / sigma);
      if (w < 0.01) continue;
      const bw = P.type === 'loft' ? loftWeights(spec, p[1]) : [[P.bone, 1]];
      for (const [bn, f] of bw) acc[bn] = (acc[bn] || 0) + w * f;
      // Hairline distance, clamped so one far-away value can't dominate the blend.
      hsum += w * clamp(hairCoverage(P, spec, p), -0.03, 0.03);
      ssum += w * softness(spec, P.tag || P.group, P.type === 'loft', p[1]);
      wsum += w;
      cand.push([i, w]);
    }
    // Elbows and knees: the two limb segments lie in a line at rest, so near the joint
    // a vertex is almost as close to one as the other and the distance softmax shares
    // it between them over ±5 cm or so, which pinches the joint thin when it bends.
    // Instead their combined weight is split across the joint over ±HINGE_BLEND.
    for (const [pa, cb, jp, dir] of spec.hinges) {
      const mass = (acc[pa] || 0) + (acc[cb] || 0);
      if (!mass || !acc[pa] || !acc[cb]) continue;
      const f = smooth01(-HINGE_BLEND * spec.H, HINGE_BLEND * spec.H, dot(sub(p, jp), dir));
      acc[pa] = mass * (1 - f); acc[cb] = mass * f;
    }
    // Crotch: above the body's crotch point and near the centre line the skin sits
    // between both thighs, and blending the two as they open drags it into a slot up
    // the middle. There the pelvis carries it, as on a mannequin, handing over to each
    // thigh halfway out to its hip joint. Below the crotch point the inner thighs
    // stay entirely with their legs.
    if (p[1] < spec.J.thighL[1]) {
      const hx = spec.J.thighL[0], cy = crotchY(spec);
      const give = (1 - smooth01(0.2 * hx, 0.6 * hx, Math.abs(p[0]))) * smooth01(cy + CROTCH_LO * spec.H, cy + CROTCH_HI * spec.H, p[1]);
      for (const t of ['thighL', 'thighR']) if (acc[t] && give > 0) { acc.pelvis = (acc.pelvis || 0) + acc[t] * give; acc[t] *= 1 - give; }
    }
    cand.sort((a, b) => b[1] - a[1]);
    for (let k = 0; k < Math.min(BASIS_K, cand.length); k++) { basisIdx[v * BASIS_K + k] = cand[k][0]; basisW[v * BASIS_K + k] = cand[k][1]; }
    const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    wc.setRGB(0, 0, 0);
    top.forEach(([bn, w], i) => {
      skinIndex[4 * v + i] = boneIdx[bn];
      skinWeight[4 * v + i] = w / sum;
      wc.r += BONE_HUE[bn].r * w / sum; wc.g += BONE_HUE[bn].g * w / sum; wc.b += BONE_HUE[bn].b * w / sum;
    });
    hairCov[v] = hsum / wsum;
    softAttr[v] = ssum / wsum;
    wcolors.set([wc.r, wc.g, wc.b], 3 * v);
  }

  const tSkin = performance.now();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(wcolors, 3));
  geo.setAttribute('hairCov', new THREE.BufferAttribute(hairCov, 1));
  geo.setAttribute('soft', new THREE.BufferAttribute(softAttr, 1));
  geo.setAttribute('creaseD', new THREE.BufferAttribute(new Float32Array(nV).fill(1), 1));   // set by dress
  geo.setAttribute('layerA', new THREE.BufferAttribute(new Float32Array(nV * 4).fill(NONE), 4));
  geo.setAttribute('layerB', new THREE.BufferAttribute(new Float32Array(nV * 4).fill(NONE), 4));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  geo.userData.basis = { idx: basisIdx, w: basisW };
  return { geo, stats: { verts: nV, tris: index.length / 3, evals, ms: Math.round(performance.now() - t0),
    stages: { surface: Math.round(tPoly - t0), project: Math.round(tProj - tPoly), weights: Math.round(tSkin - tProj) } } };
}

// ════════════════════════════════════════════════════════════════
// CHARACTER — skeleton + skinned mesh + rigid hair/eyes
// ════════════════════════════════════════════════════════════════

const SKIN = 0xe9c6a5;
const ALL_MATS = new Set();
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

// Standard PBR material, patched so the base colour comes from the clothing layers
// over the skin (outfit view) or the vertex colours (weight view).
function makeBodyMaterial(m) {
  const mat = new THREE.MeshStandardMaterial({ skinning: true, roughness: 0.62, metalness: 0, vertexColors: true });
  mat.extensions = { derivatives: true };
  const skin = lin(m.skin || SKIN);
  const u = {
    uSkin: { value: skin }, uHair: { value: lin(m.outfit.hair) },
    uLayer: { value: Array.from({ length: MAX_LAYERS }, () => skin.clone()) },   // set by dress()
    uWeights: { value: 0 },
    // A shirt's painted fastening (see dress): [placket half-width, top y, hem y, on], the layer it belongs to (one-hot over the eight layers), button spacing and colour.
    uShirt: { value: new THREE.Vector4(0, 0, 0, 0) }, uShirtA: { value: new THREE.Vector4() }, uShirtB: { value: new THREE.Vector4() }, uShirtBtn: { value: new THREE.Vector4(0.9, 0.88, 0.8, 0.07) },
    // Contact compression: skin above the palm plane (point uPressP, outward normal
    // uPressN, mesh-local space) within radius uPressR is flattened onto the plane.
    uPressP: { value: new THREE.Vector3() }, uPressN: { value: new THREE.Vector3(0, 1, 0) },
    uPressR: { value: 0.06 }, uPressAmt: { value: 0 },
    // A long footprint (a paddle's blade): unit axis across the plane (xyz) and half-length
    // (w); the radius is then measured from that segment. w = 0 for a round one.
    uPressAx: { value: new THREE.Vector4() },
    // How far above the plane skin is still flattened (2 cm for a hand; deeper for a blade).
    uPressDepth: { value: 0.02 },
    // Second slot, for the resting left hand (same rule).
    uPressP2: { value: new THREE.Vector3() }, uPressN2: { value: new THREE.Vector3(0, 1, 0) },
    uPressR2: { value: 0.06 }, uPressAmt2: { value: 0 },
    // Fingers pressing the skin: up to CAPS capsules (mesh-local; A = start xyz + radius, B = end xyz
    // + how far in contact, 0–1). Skin inside one is pushed in along its own normal until it
    // clears the finger, so a pad dents the flesh the way the palm plane does.
    uCapA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) }, uCapB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) }, uCapN: { value: 0 },
    // Contact: the partner's posed proxies (see CONTACT; set by updateContacts).
    uContactTex: { value: contactTexture() },
    uContactN: { value: new THREE.Vector2() },
    // Marks (see addMark): per side, centre in rest space, strength and radius.
    uMarkP: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uMarkAmt: { value: [0, 0] },
    uMarkReach: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
    uMarkRegion: { value: new THREE.Vector4() }, uMarkCol: { value: lin(MARK_COLOR) },
    // Stripes (the rod; see addStripe): rest-space heights and their strength.
    uStripe: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) }, uStripeN: { value: 0 },
    // Lip colour: the skin warmed toward a rose, less on male builds (or preset lipColor).
    uLipCol: { value: m.lipColor != null ? lin(m.lipColor) : skin.clone().lerp(lin(0xa84a52), m.build === 'male' ? 0.22 : 0.62) },
    // The painted lips' shape in rest space (spec.mouth, set in buildCharacter):
    // mouth line y, upper and lower heights, half-width; and the depth in front of which it applies.
    uMouth: { value: new THREE.Vector4(-9, 0, 0, 1) }, uMouthZ: { value: 0 },
    uMouthCorner: { value: new THREE.Vector2() },   // expression: left and right corners up/down (faceStep)
    uMouthOpen: { value: new THREE.Vector3(1, 0, 0) },   // expression: opening half-width, half-height, teeth (faceStep)
    // Finger joints (see FINGER_BEND_GLSL; set by buildCharacter and setFingerBend).
    uFingerK: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFingerDir: { value: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)] },
    uFingerBend: { value: new THREE.Vector2() }, uFingerJ: { value: new THREE.Vector3(1, 1, 0.001) },
  };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 layerA, layerB;\nattribute float hairCov, creaseD;\nvarying vec4 vLayerA, vLayerB;\nvarying float vHair, vCrease;\nvarying vec3 vRest, vRestN;\nuniform vec3 uPressP, uPressN, uPressP2, uPressN2;\nuniform vec4 uPressAx;\nuniform float uPressR, uPressAmt, uPressR2, uPressAmt2, uPressDepth;\nuniform vec4 uCapA[' + CAPS + '], uCapB[' + CAPS + '];\nuniform float uCapN;' + CONTACT_GLSL + FINGER_BEND_GLSL)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 fbPos = vec3(position);\nbendFingers(fbPos, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = fbPos;\nvLayerA = layerA; vLayerB = layerB; vHair = hairCov; vRest = position; vRestN = normal; vCrease = creaseD;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        if (uPressAmt > 0.0) {
          vec3 dP = transformed - uPressP;
          float hP = dot(dP, uPressN);                        // height above the palm plane
          vec3 acP = dP - hP * uPressN;                       // across the plane
          acP -= uPressAx.xyz * clamp(dot(acP, uPressAx.xyz), -uPressAx.w, uPressAx.w);
          float rP = length(acP);                             // distance across it (from the axis segment, if long)
          // Only skin near the palm: within the radius across the plane, and no more than
          // uPressDepth above it, fading over 1.5 cm beyond (other body parts along the
          // normal are untouched).
          float wP = (1.0 - smoothstep(uPressR * 0.55, uPressR, rP)) * (1.0 - smoothstep(uPressDepth, uPressDepth + 0.015, hP)) * uPressAmt;
          // Everything above the plane (and a soft band just below it) is pushed down,
          // so the skin conforms to the palm with a rounded edge rather than a crease.
          float excess = max(hP + 0.006, 0.0);
          float pushed = excess - 0.006 * (1.0 - exp(-excess / 0.006));
          transformed -= uPressN * pushed * wP;
          #ifndef FLAT_SHADED
            float flatW = wP * smoothstep(-0.004, 0.004, hP);
            vNormal = normalize(mix(vNormal, normalize(normalMatrix * uPressN), flatW));
          #endif
        }
        if (uPressAmt2 > 0.0) {                                // second slot: resting left hand
          vec3 dQ = transformed - uPressP2;
          float hQ = dot(dQ, uPressN2);
          float rQ = length(dQ - hQ * uPressN2);
          float wQ = (1.0 - smoothstep(uPressR2 * 0.55, uPressR2, rQ)) * (1.0 - smoothstep(0.02, 0.035, hQ)) * uPressAmt2;
          float excessQ = max(hQ + 0.006, 0.0);
          float pushedQ = excessQ - 0.006 * (1.0 - exp(-excessQ / 0.006));
          transformed -= uPressN2 * pushedQ * wQ;
          #ifndef FLAT_SHADED
            float flatQ = wQ * smoothstep(-0.004, 0.004, hQ);
            vNormal = normalize(mix(vNormal, normalize(normalMatrix * uPressN2), flatQ));
          #endif
        }
        // Fingers: skin inside a finger capsule is pushed in along its own normal until it
        // clears the finger (a dent as deep as the finger is round), fading out past its edge.
        for (int ci = 0; ci < ${CAPS}; ci++) {
          if (float(ci) >= uCapN) break;
          vec3 pa = uCapA[ci].xyz, ba = uCapB[ci].xyz - pa;
          float rC = uCapA[ci].w;
          float hh = clamp(dot(transformed - pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
          vec3 dd = transformed - (pa + ba * hh);
          float hN = dot(dd, objectNormal);                    // below the finger's axis is negative
          float xx = length(dd - hN * objectNormal);
          float dent = max(sqrt(max(rC * rC - xx * xx, 0.0)) + hN, 0.0);
          float wC = (1.0 - smoothstep(rC * 0.9, rC * 1.35, xx)) * (1.0 - smoothstep(0.0, 0.6 * rC, hN)) * uCapB[ci].w;
          transformed -= objectNormal * dent * wC;
        }` + CONTACT_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vLayerA, vLayerB;\nvarying float vHair, vCrease;\nuniform vec3 uLipCol;\nuniform vec4 uMouth;\nuniform float uMouthZ;\nuniform vec2 uMouthCorner;\nuniform vec3 uMouthOpen;\nvarying vec3 vRest, vRestN;\nuniform vec3 uSkin, uHair, uLayer[${MAX_LAYERS}], uMarkP[2], uMarkReach[2], uMarkCol;\nuniform float uMarkAmt[2];\nuniform vec4 uStripe[32];\nuniform float uStripeN;\nuniform vec4 uMarkRegion;\nuniform float uWeights;\nuniform vec4 uShirt, uShirtA, uShirtB, uShirtBtn;`)
      .replace('#include <color_fragment>', `
        // Each layer's edge distance, thresholded over about a pixel; innermost first.
        vec4 wa = fwidth(vLayerA) * 0.75 + 1e-5, wb = fwidth(vLayerB) * 0.75 + 1e-5;
        vec4 ca = smoothstep(-wa, wa, vLayerA), cb = smoothstep(-wb, wb, vLayerB);
        float wh = fwidth(vHair) * 0.75 + 1e-5;
        // Marks (see addMark): each side's colour spreads from its centre as it deepens,
        // reaching the edge of the region (glute and top of thigh, behind) at full
        // strength. Painted into the skin, so clothing layers cover it.
        float mk = 0.0; vec3 outfitStripe = uMarkCol;
        // Lower edge: follows the crease where each thigh meets the glute (vCrease, metres
        // along the thigh, negative on the thigh), full to just past it and fading out
        // gradually by uMarkRegion.w down the thigh, so it has no hard line.
        float inBand = smoothstep(-uMarkRegion.w, -0.004, vCrease) * (1.0 - smoothstep(uMarkRegion.y - 0.025, uMarkRegion.y + 0.01, vRest.y));
        float behind = 1.0 - smoothstep(-0.03, 0.0, vRest.z);
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? 1.0 : -1.0, f = uMarkAmt[i];
          if (f <= 0.0) continue;
          vec3 d = vRest - uMarkP[i];
          vec3 q = vec3(s * d.x > 0.0 ? d.x / uMarkReach[i].z : d.x / max(abs(s * uMarkP[i].x), 0.03),
                        d.y > 0.0 ? d.y / uMarkReach[i].x : d.y / uMarkReach[i].y, d.z / 0.2);
          // Spreads as it deepens: the solid core reaches the whole region (1 in these
          // units) by full strength, with a soft rim beyond it that the region trims.
          float reach = mix(0.3, 1.45, f);
          float spread = 1.0 - smoothstep(reach - 0.35, reach, length(q));
          float side = smoothstep(-0.012, 0.004, s * vRest.x) * (1.0 - smoothstep(uMarkRegion.z, uMarkRegion.z + 0.03, s * vRest.x));
          mk = max(mk, f * spread * side * inBand * behind);
        }
        // Stripes (the rod): where the bar touched (see addStripe): its height, its length across the body, and not the cleft it
        // bridges; behind the body. They add where they overlap, and the colour goes red to purple as it deepens.
        vec3 stripeCol = uMarkCol;
        if (uStripeN > 0.0) {
          float sadd = 0.0;
          float rear = smoothstep(0.0, -0.025, vRest.z);
          float cleft = smoothstep(0.006, 0.016, abs(vRest.x));
          // Only the very top/back of the curve: where the surface faces straight back (so no wrapping round the sides).
          rear *= smoothstep(0.6, 0.8, -vRestN.z);
          for (int si = 0; si < 32; si++) {
            if (float(si) >= uStripeN) break;
            vec4 st = uStripe[si];   // y, strength, x0, x1
            float dy = abs(vRest.y - st.x);
            float inx = smoothstep(st.z - 0.004, st.z + 0.006, vRest.x) * (1.0 - smoothstep(st.w - 0.006, st.w + 0.004, vRest.x));
            sadd += st.y * inx * (1.0 - smoothstep(${STRIPE_HALF * 0.6}, ${STRIPE_HALF * 1.4}, dy));
          }
          sadd *= rear * cleft;
          // Added on top of whatever marks are already there (a more localised deepening of the same colour), and the red deepens
          // as the total builds.
          mk = min(1.0, mk + sadd);
          stripeCol = mix(uMarkCol, uMarkCol * vec3(0.45, 0.35, 0.4), smoothstep(0.35, 0.95, mk) * step(0.0001, sadd));
          outfitStripe = stripeCol;
        }
        vec3 outfitCol = mix(uSkin, uStripeN > 0.0 && mk > 0.0 ? mix(uMarkCol, outfitStripe, step(0.0001, mk)) : uMarkCol, mk);
        // Lips: tinted where the lip shapes carry the surface, darker along the line
        // where upper meets lower.
        // Painted lips, per pixel from the rest position: an upper and a lower half-ellipse
        // over the mouth line, tapering to the corners, with a fine closed-mouth line.
        if (vRest.z > uMouthZ) {
          // The mouth line bends toward each corner by that corner's expression (up to 5 mm
          // at the corner, easing in from the middle); the lips follow the line.
          float ex = vRest.x / uMouth.w;
          float dy = vRest.y - uMouth.x - (ex > 0.0 ? uMouthCorner.x : uMouthCorner.y) * ex * ex * 0.005;
          // The mouth's current half-width A and opening half-height B (uMouthOpen: A = the
          // closed half-width and B = 0 when shut), and how far the teeth are bared.
          float A = uMouthOpen.x, B = uMouthOpen.y, T = uMouthOpen.z;
          float xa = vRest.x / A, rim = sqrt(max(0.0, 1.0 - xa * xa));
          float edge = fwidth(dy) + 0.0004;
          // Lips: an upper and lower half-ellipse around the opening.
          float outer = (B + (dy >= 0.0 ? uMouth.y : uMouth.z)) * rim;
          // The parting: the open mouth's oval, or the lips drawn back off clenched teeth
          // (narrower than the mouth), whichever is larger.
          float xt = vRest.x / (0.85 * A), rimT = sqrt(max(0.0, 1.0 - xt * xt));
          float gap = max(B * rim, T * 0.8 * uMouth.y * rimT);
          float inOuter = (1.0 - smoothstep(-edge, edge, abs(dy) - outer)) * step(abs(xa), 1.0);
          float inGap = (1.0 - smoothstep(-edge, edge, abs(dy) - gap)) * step(abs(xa), 1.0);
          outfitCol = mix(outfitCol, uLipCol, inOuter);
          // Inside: a dark mouth, the upper teeth hanging from the top of the parting and the
          // lower rising from its bottom (touching, with a bite line, when clenched). The
          // open mouth shows some teeth even when not bared.
          float tU = 1.3 * uMouth.y * (0.6 + 0.4 * T);
          float tL = 1.0 * uMouth.z * (0.3 + 0.7 * T);
          float upperT = smoothstep(-edge, edge, dy - max(0.0, gap - tU));
          float lowerT = 1.0 - smoothstep(-edge, edge, dy - min(0.0, -gap + tL));
          float teethAmt = max(upperT, lowerT) * (T > 0.001 || B > 0.0005 ? 1.0 : 0.0);
          vec3 teethCol = vec3(0.78, 0.74, 0.66) * (1.0 - 0.55 * xa * xa);
          vec3 inside = mix(vec3(0.07, 0.02, 0.02), teethCol, teethAmt);
          float bite = (1.0 - smoothstep(0.0002, 0.0002 + edge, abs(dy))) * step(gap, tU) * teethAmt;
          inside *= 1.0 - 0.6 * bite;
          outfitCol = mix(outfitCol, inside, inGap);
          // Closed: a fine line where the lips meet.
          float line = (1.0 - smoothstep(0.00025, 0.00025 + edge * 1.5, abs(dy))) * (1.0 - smoothstep(0.75, 1.0, abs(ex))) * (1.0 - step(0.0002, gap));
          outfitCol *= 1.0 - 0.4 * line;
        }
        outfitCol = mix(outfitCol, uLayer[0], ca.x);
        outfitCol = mix(outfitCol, uLayer[1], ca.y);
        outfitCol = mix(outfitCol, uLayer[2], ca.z);
        outfitCol = mix(outfitCol, uLayer[3], ca.w);
        outfitCol = mix(outfitCol, uLayer[4], cb.x);
        outfitCol = mix(outfitCol, uLayer[5], cb.y);
        outfitCol = mix(outfitCol, uLayer[6], cb.z);
        outfitCol = mix(outfitCol, uLayer[7], cb.w);
        if (uShirt.w > 0.5 && vRest.z > 0.0) {
          // A shirt's fastening, painted down the front: a placket (a doubled strip of cloth with a stitched edge each side) and a button every
          // so often, only where the shirt's own fabric is.
          float fab = smoothstep(0.35, 0.65, dot(ca, uShirtA) + dot(cb, uShirtB));
          float ax = abs(vRest.x), e = 0.0006;
          float span = step(uShirt.z, vRest.y) * step(vRest.y, uShirt.y) * fab;
          float strip = (1.0 - smoothstep(uShirt.x - e, uShirt.x + e, ax)) * span;
          float stitch = (1.0 - smoothstep(0.0003, 0.0003 + e, abs(ax - uShirt.x * 0.82))) * span;
          outfitCol = mix(outfitCol, outfitCol * 0.9, strip);
          outfitCol = mix(outfitCol, outfitCol * 0.74, stitch * strip);
          float top = uShirt.y + 0.2 * uShirtBtn.w;   // the top button sits just under the point of the opening
          float k = (top - vRest.y) / uShirtBtn.w;
          float cy = top - (floor(k) + 0.5) * uShirtBtn.w;
          float bd = length(vec2(vRest.x, vRest.y - cy));
          float btn = (1.0 - smoothstep(0.0052 - e, 0.0052 + e, bd)) * span * step(0.0, k);
          float rim = (1.0 - smoothstep(0.0042 - e, 0.0042 + e, bd));
          outfitCol = mix(outfitCol, uShirtBtn.rgb * (0.78 + 0.22 * rim), btn);
          float hole = (1.0 - smoothstep(0.0009 - 0.0003, 0.0009 + 0.0003, length(vec2(abs(vRest.x) - 0.0018, vRest.y - cy)))) * btn;
          outfitCol = mix(outfitCol, uShirtBtn.rgb * 0.45, hole);
        }
        outfitCol = mix(outfitCol, uHair, smoothstep(-wh, wh, vHair));
        diffuseColor.rgb = mix(outfitCol, vColor, uWeights);
      `);
  };
  ALL_MATS.add(mat);
  return mat;
}

// `m` is a measurement set (see PRESETS). Options: voxel (mesh resolution in
// metres), key (an id carried on the result), weights / wire (debug views).
function buildCharacter(m, { voxel = 0.010, key = null, weights = false, wire = false } = {}) {
  const spec = buildSpec(m);
  const { geo, stats } = buildMesh(spec, voxel);

  // Bones at rest-pose joint positions (identity rest rotations).
  const bones = {};
  for (const name of BONES) { bones[name] = new THREE.Bone(); bones[name].name = name; }
  for (const name of BONES) {
    const parent = PARENT[name];
    const w = spec.J[name];
    const pw = parent ? spec.J[parent] : [0, 0, 0];
    bones[name].position.set(w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]);
    if (parent) bones[parent].add(bones[name]);
  }

  const bustRest = { L: bones.bustL.position.clone(), R: bones.bustR.position.clone() };
  const mesh = new THREE.SkinnedMesh(geo, makeBodyMaterial(m));
  {
    // Finger joints: each hand's knuckle, the direction along its fingers, and the
    // middle and end joints' distance from the knuckle (see FINGER_BEND_GLSL).
    const u = mesh.material.userData.uniforms, fl = FINGERS[1][1] * 0.106 * spec.H;
    ['L', 'R'].forEach((s, i) => {
      u.uFingerK.value[i].set(...spec.J['fingers' + s]);
      u.uFingerDir.value[i].set(...norm(sub(spec.J['fingers' + s], spec.J['hand' + s])));
    });
    u.uFingerJ.value.set(FINGER_JOINTS[0] * fl, FINGER_JOINTS[1] * fl, 0.003 * spec.H / 1.7);
  }
  if (spec.mouth) {
    const Mo = spec.mouth, u = mesh.material.userData.uniforms;
    u.uMouth.value.set(Mo.y, Mo.hu, Mo.hl, Mo.w); u.uMouthZ.value = Mo.zMin;
  }
  mesh.material.wireframe = wire;
  mesh.material.userData.uniforms.uWeights.value = weights ? 1 : 0;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.add(bones.pelvis);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(BONES.map(n => bones[n])));

  const hairDef = addHead(spec, bones.head);

  const group = new THREE.Group();
  group.add(mesh);
  const helper = new THREE.SkeletonHelper(mesh);
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.visible = false;

  const ch = { key, spec, mesh, bones, group, helper, stats, bustRest, pose: {}, target: {}, proxies: buildProxies(spec) };
  const tDress = performance.now();
  dress(ch);
  stats.stages.dress = Math.round(performance.now() - tDress);
  makeHair(ch, hairDef);
  ch.face = hairDef.face;
  ch.expr = { ...EXPR_DEFAULTS, ...(m.expr || {}) };
  faceStep(ch, 0);
  setPose(ch, 'Relaxed', true);
  return ch;
}

// ════════════════════════════════════════════════════════════════
// EXPRESSION — the face's moving parts: brows, lids, gaze and the painted mouth's
// corners, set from ch.expr (a preset's `expr`, see EXPR_DEFAULTS) plus idle life:
// blinks and small eye movements. The face's shape itself is fixed at build.
//   browInner, browOuter: raise (−1…1).   browFurrow: inner ends drawn down and in (0…1).
//   browAsym: the left brow higher (+) or the right (−).
//   lidUpper: the upper lid raised (+, eyes wide) or lowered (−, heavy).  squint: the
//   lower lid raised (0…1).   gazeX, gazeY: resting gaze, + to her left / up (−1…1).
//   mouthL, mouthR: each corner of the mouth up (+) or down (−) (−1…1).
//   saccade: how often and how far the eyes move on their own (0…1); contact: how
//   strongly they come back to the resting gaze (0…1); blink: blink rate (× normal).
// Call faceStep every frame with everyone on set (it also animates).
// ════════════════════════════════════════════════════════════════
//   teeth: lips parted to show clenched teeth (0…1).   mouthOpen: the mouth open (0…1),
//   its opening always the circumference of the closed mouth traced top and bottom
//   (twice the mouth line), so it narrows as it opens, to a circle at 1.
const EXPR_DEFAULTS = { browInner: 0, browOuter: 0, browFurrow: 0, browAsym: 0, lidUpper: 0, squint: 0,
  gazeX: 0, gazeY: 0, mouthL: 0, mouthR: 0, teeth: 0, mouthOpen: 0, saccade: 0.4, contact: 0.5, blink: 1 };
// Moods: added on top of a character's own expression, blended in and out over a
// quarter of a second (setMood). The values are offsets; the result is clamped.
const MOODS = {
  effort:    { teeth: 0.9, mouthL: -0.3, mouthR: -0.3, browFurrow: 0.6, browInner: -0.2, squint: 0.6, lidUpper: -0.35 },
  enjoyment: { teeth: 0.75, mouthL: 0.75, mouthR: 0.75, squint: 0.45, browOuter: 0.1 },
  open:      { mouthOpen: 0.8, browInner: 0.3, browOuter: 0.25, lidUpper: 0.3 },
  // Discipline faces (see faceState): the subject's, layered by the driver…
  dread:     { browInner: 0.55, browOuter: 0.25, lidUpper: 0.45, browFurrow: 0.15, mouthL: -0.1, mouthR: -0.1 },
  wince:     { squint: 0.9, lidUpper: -0.7, browFurrow: 0.8, browInner: -0.15, teeth: 0.8, mouthL: -0.45, mouthR: -0.45 },
  strain:    { browFurrow: 0.35, squint: 0.3, lidUpper: -0.1, mouthL: -0.15, mouthR: -0.15 },
  distress:  { browInner: 0.5, browFurrow: 0.6, squint: 0.55, lidUpper: -0.45, mouthL: -0.55, mouthR: -0.55, mouthOpen: 0.3, teeth: 0.3 },
  exhale:    { mouthOpen: 0.45, lidUpper: -0.2, browInner: 0.2, browFurrow: -0.1 },
  // …and the disciplinarian's, by severity and beat.
  calm:      { mouthL: 0.12, mouthR: 0.12, browInner: 0.08, lidUpper: -0.05 },
  focus:     { browFurrow: 0.2, browInner: -0.1, squint: 0.15, lidUpper: 0.05 },
  stern:     { browFurrow: 0.65, browInner: -0.25, squint: 0.35, lidUpper: -0.1, mouthL: -0.35, mouthR: -0.35, teeth: 0.1 },
  exertion:  { teeth: 0.5, browFurrow: 0.3, squint: 0.3, mouthL: -0.2, mouthR: -0.2 },
  ease:      { browInner: 0.55, browOuter: 0.1, browFurrow: -0.4, mouthL: 0.2, mouthR: 0.2, lidUpper: 0.1 },
};
const EXPR_RANGE = { browFurrow: [0, 1], squint: [0, 1], teeth: [0, 1], mouthOpen: [0, 1], saccade: [0, 1], contact: [0, 1], blink: [0, 3] };
// One mood at a time (setMood), or several layered, each with its own weight (setMoods({ dread: 0.6, wince: 0.9 })).
function setMood(ch, name, amount = 1) { ch.moodT = MOODS[name] ? { [name]: amount } : {}; }
function setMoods(ch, weights) { ch.moodT = weights || {}; }
// A character's version of a mood: their preset's `moods[name]` if it has one (each
// character can be tuned; see the viewer), otherwise the shared MOODS entry.
const moodFor = (m, name) => (m.moods && m.moods[name]) || MOODS[name];
// The open mouth's semi-axes [half-width, half-height] (metres) for openness t, keeping
// the perimeter (Ramanujan's approximation) at 4 × the closed half-width w.
function mouthOpening(w, t) {
  const P = 4 * w, b = t * 2 * w / Math.PI;
  const per = a => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  let lo = b, hi = w * 1.02;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (per(m) < P) lo = m; else hi = m; }
  return [(lo + hi) / 2, b];
}
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3(), _fp = new THREE.Vector3(), _fo = new THREE.Vector3();
function faceStep(ch, dt) {
  const F = ch.face;
  if (!F || !ch.expr) return;
  // The expression in effect: the character's own, plus the current mood's offsets
  // (blended in and out over a quarter of a second).
  const mv = ch.moodVal || (ch.moodVal = {}), T = ch.moodT || {};
  const mk = dt > 0 ? 1 - Math.exp(-dt / 0.08) : 1;
  for (const n of new Set([...Object.keys(mv), ...Object.keys(T)])) {
    mv[n] = (mv[n] || 0) + ((T[n] || 0) - (mv[n] || 0)) * mk;
    if (mv[n] < 0.001 && !T[n]) delete mv[n];
  }
  let e = ch.expr;
  const touched = new Set();
  for (const [n, amt] of Object.entries(mv)) {
    if (!MOODS[n] || amt < 0.001) continue;
    if (!touched.size) e = { ...e };
    for (const [k, v] of Object.entries(moodFor(ch.spec.m, n))) { e[k] = (e[k] || 0) + v * amt; touched.add(k); }
  }
  for (const k of touched) { const [lo, hi] = EXPR_RANGE[k] || [-1, 1]; e[k] = clamp(e[k], lo, hi); }
  const A = ch.faceAnim || (ch.faceAnim = { t: 0, nextBlink: 1 + Math.random() * 3, blink: 0, gx: 0, gy: 0, tx: 0, ty: 0, nextSacc: 0.5 });
  A.t += dt;
  // Blinks: a quick close and open (0.16 s), every 2–6 s / rate.
  if (A.t >= A.nextBlink) { A.blinkT = 0; A.nextBlink = A.t + (2 + Math.random() * 4) / Math.max(0.1, e.blink); }
  if (A.blinkT != null) { A.blinkT += dt; A.blink = Math.max(0, 1 - Math.abs(A.blinkT / 0.08 - 1)); if (A.blinkT > 0.16) { A.blinkT = null; A.blink = 0; } }
  // Eye movements: jump to a new target (near the resting gaze, wider with saccade),
  // or back to it (more often with contact); held for a while in between.
  if (A.t >= A.nextSacc) {
    const back = Math.random() < e.contact, amp = 0.15 + 0.6 * e.saccade;
    A.tx = back ? 0 : (Math.random() * 2 - 1) * amp; A.ty = back ? 0 : (Math.random() * 2 - 1) * amp * 0.5;
    A.nextSacc = A.t + (0.4 + Math.random() * 2.5) * (1.4 - e.saccade);
  }
  const k = dt > 0 ? 1 - Math.exp(-dt * 30) : 1;      // eyes move fast
  A.gx += (A.tx - A.gx) * k; A.gy += (A.ty - A.gy) * k;
  // A look toward something (ch.gazeFx: x, y, and how much it takes over the resting gaze and the eyes' wandering).
  const GF = ch.gazeFx, gw = GF ? clamp(GF.w, 0, 1) : 0;
  const H = F.H, gx = clamp(e.gazeX * (1 - gw) + (GF ? GF.x * gw : 0) + A.gx * (1 - 0.85 * gw), -1, 1), gy = clamp(e.gazeY * (1 - gw) + (GF ? GF.y * gw : 0) + A.gy * (1 - 0.85 * gw), -1, 1);
  for (const S of F.sides) {
    const s = S.s, E = S.E;
    // Gaze: iris and pupil across the white.
    const off = new THREE.Vector3(gx * 0.0022 * H * E, gy * 0.0014 * H * E, 0);
    S.iris.position.copy(S.irisC).add(off); S.pupil.position.copy(S.pupilC).add(off);
    // Lids: the upper line follows lidUpper and gaze (the lid follows the eye up and
    // down); the lower rises with squint; a blink brings the upper down to the lower.
    let up = S.lidUp + e.lidUpper * 0.0012 * H * E + gy * 0.0006 * H * E;
    const low = S.lidLow + e.squint * 0.0022 * H * E;
    up = Math.max(low + 0.0004 * H, Math.min(S.ry * 0.98, up));
    up = up + (low + 0.0002 * H - up) * A.blink;
    // The lids' clipping planes, in world space: the upper lid keeps what's above its
    // line, the lower what's below its own.
    const hq = F.head.getWorldQuaternion(_fq), upW = _fv.set(0, 1, 0).applyQuaternion(hq);
    S.lidU.material.clippingPlanes[0].setFromNormalAndCoplanarPoint(upW, F.head.localToWorld(_fp.copy(S.c).add(_fo.set(0, up, 0))));
    S.lidL.material.clippingPlanes[0].setFromNormalAndCoplanarPoint(upW.clone().negate(), F.head.localToWorld(_fp.copy(S.c).add(_fo.set(0, low, 0))));
    S.lashU.position.copy(S.c).addScaledVector(S.o, 0.0014 * H).add(new THREE.Vector3(0, up, 0));
    S.lashL.position.copy(S.c).addScaledVector(S.o, 0.0010 * H).add(new THREE.Vector3(0, low, 0));
    // Brows: raise the whole brow by the mean of inner and outer, roll by their
    // difference; the furrow draws the inner end down and toward the centre.
    const asym = e.browAsym * s * 0.5;
    const ri = e.browInner - e.browFurrow * 0.7 + asym, ro = e.browOuter + asym;
    S.brow.position.copy(S.browC).add(new THREE.Vector3(-s * e.browFurrow * 0.0012 * H, (ri + ro) / 2 * 0.003 * H, 0));
    S.brow.rotation.z = S.browRoll - s * (ri - ro) * 0.18;
  }
  // Mouth corners, for the painted lips (see the body shader).
  const u = ch.mesh.material.userData.uniforms;
  if (u.uMouthCorner) u.uMouthCorner.value.set(e.mouthL, e.mouthR);
  if (u.uMouthOpen && ch.spec.mouth) {
    const [a, b] = mouthOpening(ch.spec.mouth.w, e.mouthOpen);
    u.uMouthOpen.value.set(a, b, e.teeth);
  }
}
function setExpression(ch, expr) { ch.expr = { ...EXPR_DEFAULTS, ...expr }; faceStep(ch, 0); }

// Eyes are rigid meshes on the head bone (local = world − head joint at rest). Hair
// on the scalp and buns are part of the skinned surface; hanging hair is simulated.
function addHead(spec, headBone) {
  const H = spec.H * spec.m.head, J = spec.J.head, Y = spec.Y;
  const hairMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.outfit.hair), roughness: 0.55 });
  const Fp = faceParams(spec.m), hairHex = spec.m.outfit.hair;
  const scleraMat = new THREE.MeshStandardMaterial({ color: lin(0xeee8df), roughness: 0.35 });
  const irisMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.eyeColor || 0x3d2616), roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: lin(0x070605), roughness: 0.15 });
  const lashMat = new THREE.MeshStandardMaterial({ color: lin(0x0d0a08), roughness: 0.6 });
  const browMat = new THREE.MeshStandardMaterial({ color: lin(hairHex), roughness: 0.8 });
  const at = (x, y, z) => new THREE.Vector3(x - J[0], y - J[1], z - J[2]);
  const blob = (r, sx, sy, sz, p, mat = hairMat) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
    g.scale.set(sx, sy, sz); g.position.copy(p); g.castShadow = true;
    headBone.add(g); return g;
  };
  // Eyes: an almond of white set into the face (found by marching in from the front),
  // an iris and pupil on its front, a dark lash line along the upper lid and a softer
  // one below; then a brow above each. Sizes follow the eye and brow face parameters.
  const surfaceZ = (x, y) => { let z = 0.12 * H; while (z > 0 && field(spec, [x, y, z]) > 0.0005) z -= 0.0005; return z; };
  const piece = (geo, mat, pos, scale, rot) => {
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.set(...scale); if (rot) m.rotation.set(...rot);
    headBone.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 28, 18), E = Fp.eye;
  // Eyelids, in the skin colour: an upper lid whose lower edge is the upper lid line, and
  // a lower lid whose top edge is the lower one. Expressions and blinks move them (faceStep).
  const lidMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.skin || SKIN), roughness: 0.62 });
  const face = { H, lidMat, lidMats: [], head: headBone, sides: [] };
  for (const s of [1, -1]) {
    const x = s * 0.0165 * H * Fp.eyeGap, y = Y.chin + (0.064 + 0.006 * Fp.eyeHeight) * H, z = surfaceZ(x, y);
    const turn = [0, s * 0.16, 0];                                   // eyes follow the curve of the face
    const o = new THREE.Vector3(Math.sin(turn[1]), 0, Math.cos(turn[1]));
    const c = at(x, y, z - 0.0016 * H);
    // Youth opens the eye: a taller white, the upper lid (lash line) lifted clear of the
    // iris instead of resting over it, and a slightly larger iris.
    const yo = Fp.youth, open = 1 + 0.18 * yo, irisK = 1 + 0.08 * yo;
    const rx = 0.0078 * H * E, ry = 0.0042 * H * E * open, rz = 0.0032 * H;
    piece(sph, scleraMat, c, [rx, ry, rz], turn);
    const iris = piece(sph, irisMat, c.clone().addScaledVector(o, 0.0024 * H), [0.0036 * H * E * irisK, 0.0036 * H * E * irisK, 0.0012 * H], turn);
    const pupil = piece(sph, pupilMat, c.clone().addScaledVector(o, 0.0031 * H), [0.0015 * H * E * irisK, 0.0015 * H * E * irisK, 0.0007 * H], turn);
    // Lids: thin shells just over the white, trimmed along the lid line by a clipping
    // plane (each lid its own material, for its own plane; set in faceStep).
    const lidRy = 0, lidScale = [rx * 1.05, ry * 1.08, rz * 1.35];   // deep enough to cover the iris and pupil when shut
    const lidMatU = lidMat.clone(), lidMatL = lidMat.clone();
    const lidU = piece(sph, lidMatU, c.clone().addScaledVector(o, 0.0002 * H), lidScale, turn), lidL = piece(sph, lidMatL, c.clone().addScaledVector(o, 0.0002 * H), lidScale, turn);
    face.lidMats.push(lidMatU, lidMatL);
    lidMatU.clippingPlanes = [new THREE.Plane()]; lidMatL.clippingPlanes = [new THREE.Plane()];
    const lashU = piece(sph, lashMat, c.clone(), [0.0086 * H * E, 0.0011 * H, 0.0024 * H], [0, turn[1], -s * 0.08]);
    const lashL = piece(sph, lashMat, c.clone(), [0.0068 * H * E, 0.0005 * H, 0.0018 * H], turn);
    lashL.material = new THREE.MeshStandardMaterial({ color: lin(0x5a4034), roughness: 0.7 });
    // Brow: thicker at the inner end, following the ridge, the outer end a little lower.
    const bx = s * 0.0175 * H * Fp.eyeGap, by = y + (0.0098 + 0.0035 * Fp.brow) * H, bz = surfaceZ(bx, by);
    const male = spec.m.build === 'male';
    const browRoll = -s * 0.1 * (1 - Fp.youth);   // outer ends droop less with youth
    const brow = piece(sph, browMat, at(bx, by, bz - 0.0011 * H), [0.0098 * H, (male ? 0.0017 : 0.0011) * H, 0.0022 * H], [0, s * 0.2, browRoll]);
    face.sides.push({ s, c, o, turn, rx, ry, rz, lidRy, E,
      lidUp: (0.0036 + 0.0011 * yo) * H * E, lidLow: -0.0038 * H * E,      // resting lid lines, above/below the centre
      iris, irisC: iris.position.clone(), pupil, pupilC: pupil.position.clone(),
      lidU, lidL, lashU, lashL, brow, browC: brow.position.clone(), browRoll });
  }
  // Hanging hair (ponytail, long hair) is simulated: see HAIR below. Each chain is
  // given as rest-pose node positions (head-local), a segment radius pair
  // [across, depth] per segment, and how strongly it holds its styled shape.
  const cy = spec.H - 0.062 * H;
  const style = spec.m.outfit.hairStyle;
  const chains = [];
  const bob = spec.m.outfit.bobbles || [];
  if (style === 'ponytail') {
    const drop = spec.m.outfit.ponyDrop || 0, knot = [0, cy + (0.016 - drop) * H, -0.066 * H];   // (`ponyDrop`: how far below the crown, in heights, the tie sits — 0.045 is the base of the skull)
    if (spec.m.outfit.scrunchie != null) {
      // Gathered by the scrunchie: a stub of hair from the scalp out through its hole,
      // held proud of the head along its axis (both ends fixed to the head), then the
      // tail falls from the end of the stub.
      const dir = norm([0, drop ? -0.55 : 0.2, -1]), end = add(knot, mul(dir, 0.034 * H));
      chains.push({ tie: bob[0], stiff: 0.004, bias: 1, fixed: 2,
        nodes: [at(...knot), at(...end), ...[1, 2, 3, 4].map(k => at(0, end[1] - k * 0.05 * H, end[2] - 0.004 * H - k * 0.004 * H))],
        rad: [[0.0105 * H, 0.0095 * H], ...[0, 1, 2, 3].map(i => [0.017 * H * (1 - i * 0.14), 0.015 * H * (1 - i * 0.1)])] });
    } else chains.push({ tie: bob[0], stiff: 0.004, bias: 1, nodes: [at(...knot), ...[1, 2, 3, 4].map(k => at(0, knot[1] - k * 0.05 * H, knot[2] - 0.008 * H - k * 0.004 * H))],
      rad: [0, 1, 2, 3].map(i => [0.017 * H * (1 - i * 0.14), 0.015 * H * (1 - i * 0.1)]) });
  } else if (style === 'long') {
    chains.push({ stiff: 0.012, nodes: [0, 1, 2, 3].map(k => at(0, cy - k * 0.058 * H, -0.05 * H - k * 0.004 * H)),
      rad: [[0.052 * H, 0.024 * H], [0.05 * H, 0.022 * H], [0.046 * H, 0.018 * H]] });
    for (const s of [1, -1]) chains.push({ stiff: 0.012, nodes: [0, 1, 2].map(k => at(s * (0.047 + k * 0.001) * H, cy - k * 0.065 * H, -0.012 * H - k * 0.002 * H)),
      rad: [[0.012 * H, 0.02 * H], [0.011 * H, 0.018 * H]] });
  }
  // Hair accessories (outfit.bobbles, outfit.clips; [left, right] where there are two).
  const acc = (hex, rough) => new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough });
  // A ring hugging a knot of hair (a bun, the ponytail's knot): centred on c (rest
  // space), round the axis dir, its radius probed from that knot's own shape in the
  // ring's plane (not the blended head, which would size it to the whole skull), so
  // it sits snugly. 'gathered' adds a scrunchie's puckered fabric.
  const knotOf = s => spec.prims.find(P => P.tag === 'hairBun' && P.side === s);
  const ring = (knot, c, dir, hex, tube, gathered = false) => {
    const d = norm(dir), e1 = norm(cross(Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d)), e2 = cross(d, e1);
    let rs = 0;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 2 * Math.PI, u = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
      let t = 0.001; while (t < 0.08 && primDist(add(c, mul(u, t)), knot) < 0) t += 0.0003;
      rs += t / 8;
    }
    const g = new THREE.TorusGeometry(rs + tube * 0.35, tube, 14, 48), P = g.attributes.position;
    if (gathered) for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), u = Math.atan2(y, x), R0 = rs + tube * 0.35;
      const cx = Math.cos(u) * R0, cy2 = Math.sin(u) * R0, k = 1 + 0.22 * Math.sin(u * 16) + 0.08 * Math.sin(u * 7);
      P.setXYZ(i, cx + (x - cx) * k, cy2 + (y - cy2) * k, z * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, acc(hex, gathered ? 0.85 : 0.7));
    m.position.copy(at(...c)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...d));
    m.castShadow = true; headBone.add(m);
    m.userData.ring = { R: rs + tube * 0.35, tube };
    return m;
  };
  const rings = [];   // solid rings the hanging hair collides with (head-local)
  const cranium = [0, cy, -0.006 * H];
  if (style === 'buns') [1, -1].forEach((s, k) => {
    // A bobble round each bun, far enough out along it that the whole ring clears the
    // head (nearer the base, the bun merges into the scalp and half the ring is hidden).
    if (bob[k] == null) return;
    const bc = add(cranium, [s * 0.034 * H, 0.05 * H, -0.016 * H]), dir = norm([s * 0.034, 0.05, -0.016]);
    ring(knotOf(s), add(bc, mul(dir, 0.003 * H)), dir, bob[k], 0.0042 * H);
  });
  if (style === 'ponytail' && spec.m.outfit.scrunchie != null) {
    // The scrunchie gathers the ponytail where it leaves the scalp, round the knot.
    const drop = spec.m.outfit.ponyDrop || 0, knot = add(cranium, [0, (0.016 - drop) * H, -0.06 * H]), dir = norm([0, drop ? -0.55 : 0.2, -1]);
    const m = ring(knotOf(0), add(knot, mul(dir, 0.004 * H)), dir, spec.m.outfit.scrunchie, 0.0075 * H, true);
    rings.push({ c: m.position.clone(), axis: new THREE.Vector3(...dir), R: m.userData.ring.R, tube: m.userData.ring.tube });
  }
  (spec.m.outfit.clips || []).forEach((hex, k) => {
    // A clip each side, well back from the fringe over the side of the head, lying
    // along the scalp front to back (as if holding the hair back), angled a little.
    const s = k === 0 ? 1 : -1, ang = s * 1.05, y = cy + 0.042 * H;   // over the side of the head, above the temple
    const d = [Math.sin(ang), 0, Math.cos(ang)], p = [0, y, 0];
    let r = 0.2;
    while (r > 0.01 && field(spec, [d[0] * r, y, d[2] * r - 0.006 * H]) > 0) r -= 0.0005;
    p[0] = d[0] * r; p[2] = d[2] * r - 0.006 * H;
    const n = new THREE.Vector3(...norm(gradient(spec, p, 0.001, field(spec, p))));
    const across = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const along = across.clone().applyAxisAngle(n, s * 0.3);   // front to back over the side of the head, rising a little toward the back
    const up = n.clone().cross(along);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), acc(hex, 0.35));
    m.scale.set(0.017 * H, 0.0036 * H, 0.0026 * H);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, up, n));
    m.position.copy(at(...p)).addScaledVector(n, 0.0018 * H);
    m.castShadow = true; headBone.add(m);
  });
  return { chains, hairMat, H, rings, face };
}

// ════════════════════════════════════════════════════════════════
// HAIR — each hanging chain is a row of nodes: the first is fixed to the head,
// the rest are simulated (Verlet) under gravity, pulled gently back toward their
// styled shape in the head's frame, kept at fixed spacing, and pushed out of
// capsules around the bodies nearby and above the floor. Each segment is drawn
// as a stretched ellipsoid between its two nodes, its width following the head's
// side-to-side axis.
// ════════════════════════════════════════════════════════════════
const HAIR_GRAVITY = new THREE.Vector3(0, -9.8, 0);
function makeHair(ch, def) {
  ch.hairRings = def.rings || [];
  ch.hair = def.chains.map(c => {
    const meshes = c.rad.map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), def.hairMat);
      m.castShadow = true; ch.group.add(m); return m;
    });
    const len = c.nodes.slice(1).map((n, i) => n.distanceTo(c.nodes[i]));
    // A bobble round the chain near its tip, carried by the last segment.
    let tieMesh = null;
    if (c.tie != null) {
      // Near the end of the tail: 70% along the last segment, where the drawn ellipsoid
      // is about 0.9 of its full width.
      const [rx, rz] = c.rad[c.rad.length - 1], R = (rx + rz) / 2 * 0.9;
      const g = new THREE.TorusGeometry(R, 0.0048 * def.H, 12, 32); g.rotateX(Math.PI / 2);   // axis along the chain
      tieMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lin(c.tie), roughness: 0.3 }));
      tieMesh.castShadow = true; ch.group.add(tieMesh);
    }
    return { ...c, meshes, len, tieMesh, p: null, prev: null };
  });
}
function hairReset(ch) { if (ch.hair) for (const c of ch.hair) c.p = null; }

// Capsules approximating a body as posed: [a, b, radius] in world space.
function bodyColliders(ch) {
  const w = n => ch.bones[n].getWorldPosition(new THREE.Vector3());
  const spec = ch.spec, m = spec.m, R = C => C / 100 / (2 * Math.PI);
  const depth = y => { const r = loftRing(spec.prims[0], y); return (r[1] + r[2]) / 2; };
  const head = ch.bones.head.localToWorld(new THREE.Vector3(...sub(spec.headInfo.c, spec.J.head)));
  const caps = [
    [w('pelvis'), w('spine1'), depth(spec.Y.hip)], [w('spine1'), w('spine2'), depth(spec.Y.waist)],
    [w('spine2'), w('neck'), depth(spec.Y.bust) * 0.95], [w('neck'), w('head'), R(m.neck)],
    [head, head, 0.058 * spec.headInfo.hs],
  ];
  for (const s of ['L', 'R']) caps.push(
    [w('clav' + s), w('upperArm' + s), R(m.arm) * 1.2], [w('upperArm' + s), w('forearm' + s), R(m.arm)],
    [w('forearm' + s), w('hand' + s), R(m.forearm)], [w('hand' + s), w('fingers' + s), 0.012 * spec.H],
    [w('thigh' + s), w('shin' + s), R(m.thigh)], [w('shin' + s), w('foot' + s), R(m.calf) * 0.9]);
  return caps;
}
const _hA = new THREE.Vector3(), _hB = new THREE.Vector3(), _hC = new THREE.Vector3();
function pushOutOfCapsule(p, a, b, r) {
  _hA.subVectors(b, a);
  const L2 = _hA.lengthSq();
  const t = L2 > 1e-10 ? clamp(_hB.subVectors(p, a).dot(_hA) / L2, 0, 1) : 0;
  _hC.copy(a).addScaledVector(_hA, t);
  const d = p.distanceTo(_hC);
  if (d < r && d > 1e-6) p.addScaledVector(_hB.subVectors(p, _hC), (r - d) / d);
}

// Steps every hair chain on `ch`. `colliders` are capsules (see bodyColliders)
// from everyone in the scene, this character included.
function hairStep(ch, dt, colliders) {
  if (!ch.hair || !ch.hair.length) return;
  const head = ch.bones.head, hq = head.getWorldQuaternion(new THREE.Quaternion());
  // Solid rings in the hair (a scrunchie): each a loop of short capsules round its tube.
  if (ch.hairRings && ch.hairRings.length) {
    colliders = colliders.slice();
    for (const R of ch.hairRings) {
      const c = head.localToWorld(R.c.clone()), ax = R.axis.clone().applyQuaternion(hq).normalize();
      const e1 = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1);
      const pt = k => c.clone().addScaledVector(e1, Math.cos(k / 12 * 2 * Math.PI) * R.R).addScaledVector(e2, Math.sin(k / 12 * 2 * Math.PI) * R.R);
      for (let k = 0; k < 12; k++) colliders.push([pt(k), pt(k + 1), R.tube]);
    }
  }
  const inv = ch.group.matrixWorld.clone().invert(), gq = ch.group.getWorldQuaternion(new THREE.Quaternion()).invert();
  const world = c => c.nodes.map(n => head.localToWorld(n.clone()));
  const steps = Math.max(1, Math.ceil(dt / (1 / 60))), h = Math.min(dt, 1 / 20) / steps;
  for (const c of ch.hair) {
    const rest = world(c);
    // (Re)start from the styled shape on the first frame or after a jump (a scene change).
    // A centred ponytail starts a little to one side (`bias`, + = the character's left), so
    // it falls off to that side when the head is down instead of balancing on the spine.
    if (!c.p || c.p[0].distanceTo(rest[0]) > 0.25) {
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(hq).multiplyScalar(0.012 * (c.bias || 0));
      c.p = rest.map((v, i) => v.clone().addScaledVector(side, i)); c.prev = c.p.map(v => v.clone());
    }
    const nodeR = c.rad.map(([x, z]) => Math.min(x, z) * 0.9);
    for (let s = 0; s < steps; s++) {
      const F = c.fixed || 1;   // the first F nodes are fixed to the head
      for (let i = 0; i < F; i++) { c.p[i].copy(rest[i]); c.prev[i].copy(rest[i]); }
      for (let i = F; i < c.p.length; i++) {
        const v = c.p[i].clone().sub(c.prev[i]).multiplyScalar(0.94);
        c.prev[i].copy(c.p[i]);
        c.p[i].add(v).addScaledVector(HAIR_GRAVITY, h * h);
        // A light pull toward the styled shape (the rest offset from the previous
        // node, in the head's frame); weak enough that gravity wins when the head tips.
        c.p[i].lerp(c.p[i - 1].clone().add(rest[i].clone().sub(rest[i - 1])), c.stiff);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = F; i < c.p.length; i++) {
          // Fixed spacing.
          const d = c.p[i].clone().sub(c.p[i - 1]), l = d.length() || 1e-6;
          c.p[i].copy(c.p[i - 1]).addScaledVector(d, c.len[i - 1] / l);
          const r = nodeR[i - 1];
          for (const [a, b, cr] of colliders) pushOutOfCapsule(c.p[i], a, b, cr + r);
          if (c.p[i].y < r) c.p[i].y = r;
        }
      }
    }
    // Draw each segment between its nodes.
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
    c.meshes.forEach((m, i) => {
      const a = c.p[i], b = c.p[i + 1], along = b.clone().sub(a), L = along.length() || 1e-6;
      along.divideScalar(L);
      const x = side.clone().addScaledVector(along, -side.dot(along));
      if (x.lengthSq() < 1e-6) x.set(1, 0, 0).addScaledVector(along, -along.x);
      x.normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, along, x.clone().cross(along)));
      m.position.copy(a.clone().add(b).multiplyScalar(0.5)).applyMatrix4(inv);
      m.quaternion.copy(gq).multiply(q);
      const [rx, rz] = c.rad[i];
      m.scale.set(rx, L * 0.78, rz);
      if (i === c.meshes.length - 1 && c.tieMesh) {
        c.tieMesh.position.copy(a.clone().addScaledVector(along, L * 0.7)).applyMatrix4(inv);
        c.tieMesh.quaternion.copy(gq).multiply(q);
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════
// POSES — Euler degrees per bone, relative to the A-pose rest.
// Signs: thigh/forearm −X swings forward; shin +X bends the knee;
// spine +X leans forward; upperArmL −Z lowers the left arm (R mirrored).
// ════════════════════════════════════════════════════════════════
const POSES = {
  'A-pose':   {},
  // Arms hang a little off the body with soft elbows; feet a touch apart, the left knee eased.
  'Relaxed':  { upperArmL: [-3, 0, -35], upperArmR: [-3, 0, 35], forearmL: [-20, 0, 0], forearmR: [-20, 0, 0], thighL: [-3, 0, -3], thighR: [0, 0, 3], shinL: [6, 0, 0], shinR: [2, 0, 0] },
  'T-pose':   { upperArmL: [0, 0, 45], upperArmR: [0, 0, -45] },
  'Arms up':  { upperArmL: [0, 0, 120], upperArmR: [0, 0, -120], clavL: [0, 0, 12], clavR: [0, 0, -12], spine2: [-6, 0, 0] },
  'Reach':    { upperArmL: [-70, 0, 60], forearmL: [-10, 0, 0], upperArmR: [0, 0, 38], forearmR: [-20, 0, 0], thighR: [-25, 0, 0], shinR: [20, 0, 0], spine1: [-4, 0, 6] },
  'Lunge':    { thighL: [-60, 0, 0], shinL: [65, 0, 0], footL: [-5, 0, 0], thighR: [28, 0, 0], shinR: [30, 0, 0], footR: [-20, 0, 0], upperArmL: [0, 0, -25], upperArmR: [0, 0, 25], pelvis: [0, 0, 0] },
  'Sit':      { thighL: [-90, 0, -4], thighR: [-90, 0, 4], shinL: [90, 0, 0], shinR: [90, 0, 0], upperArmL: [-30, 0, -35], upperArmR: [-30, 0, 35], forearmL: [-40, 0, 0], forearmR: [-40, 0, 0] },
  'Bow':      { pelvis: [18, 0, 0], thighL: [-18, 0, 0], thighR: [-18, 0, 0], spine1: [18, 0, 0], spine2: [14, 0, 0], neck: [8, 0, 0], upperArmL: [0, 0, -40], upperArmR: [0, 0, 40] },
  'Twist':    { pelvis: [0, 12, 0], spine1: [0, -18, 0], spine2: [0, -18, 0], upperArmL: [30, 0, 10], upperArmR: [-40, 0, -10], forearmL: [-60, 0, 0], forearmR: [-70, 0, 0] },
  // Standing still, arms at the sides, head lowered (waiting; facing a wall).
  'Wait':     { upperArmL: [-4, 0, -41], upperArmR: [-4, 0, 41], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0], thighL: [0, 0, -1], thighR: [0, 0, 1], neck: [16, 0, 0], head: [8, 0, 0] },
  // Standing with the eyes cast down (the head and neck bowed); the arms are left to IK (see handsTogether).
  'Downcast': { upperArmL: [-4, 0, -41], upperArmR: [-4, 0, 41], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0], thighL: [0, 0, -1], thighR: [0, 0, 1], spine2: [5, 0, 0], neck: [22, 0, 0], head: [20, 0, 0] },
  // Standing, watching: weight on the left leg, right knee soft, arms loose.
  'Watch':    { upperArmL: [2, 0, -40], upperArmR: [-6, 0, 39], forearmL: [-14, 0, 0], forearmR: [-22, 0, 0], thighL: [0, 0, -3], thighR: [-6, 0, 1], shinR: [10, 0, 0], footR: [-4, 0, 0], pelvis: [0, 0, 2], spine1: [0, 0, -2], neck: [4, 0, 0] },
};

const degQ = e => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * Math.PI / 180, e[1] * Math.PI / 180, e[2] * Math.PI / 180, 'YXZ'));
// Fingers curl toward the palm about −Z on the left hand and +Z on the right (in
// the A-pose frame); unless a pose says otherwise they rest slightly curled.
const HAND_REST = { fingersL: [0, 0, -16], fingersR: [0, 0, 16] };
// Later layers override earlier ones bone by bone.
function poseQuats(...layers) {
  const out = {};
  for (const b of BONES) {
    let e = HAND_REST[b] || [0, 0, 0];
    for (const L of layers) if (L && L[b]) e = L[b];
    out[b] = degQ(e);
  }
  return out;
}
// Swaps left/right bones and flips the side-to-side (Y, Z) angles.
const mirrorPose = P => {
  const out = {};
  for (const [b, e] of Object.entries(P)) {
    const m = b.endsWith('L') ? b.slice(0, -1) + 'R' : b.endsWith('R') ? b.slice(0, -1) + 'L' : b;
    out[m] = [e[0], -e[1], -e[2]];
  }
  return out;
};

// A wide stance: the relaxed pose with straight legs opened until the ankles are
// `width` × shoulder width apart, centre to centre, and the feet turned back flat.
// Spreading the legs lifts the feet, so it also returns `drop`, how far the body has
// to come down (metres) to keep them on the floor.
function wideStance(ch, width = 2) {
  const J = ch.spec.J, hip = J.thighL, ank = J.footL;
  const dx = ank[0] - hip[0], dy = hip[1] - ank[1], legLen = Math.hypot(dx, dy);
  const rest = Math.atan2(dx, dy);                       // the A-pose's own slight spread
  const half = width * ch.spec.m.shoulders / 100 / 2;
  const ang = Math.asin(clamp((half - hip[0]) / legLen, -1, 1));
  const a = (ang - rest) * 180 / Math.PI;
  return {
    pose: { ...POSES.Relaxed, thighL: [0, 0, a], thighR: [0, 0, -a], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, -a], footR: [0, 0, a] },
    drop: legLen * (Math.cos(rest) - Math.cos(ang)),
  };
}

// Target pose by name (POSES) or as an Euler map; `instant` also snaps the current pose.
function setPose(ch, pose, instant = false) {
  const P = typeof pose === 'string' ? POSES[pose] : pose;
  ch.target = poseQuats(P);
  if (instant || !ch.pose || !ch.pose.pelvis) ch.pose = {};
  for (const b of BONES) if (instant || !ch.pose[b]) ch.pose[b] = ch.target[b].clone();
  if (instant) for (const b of BONES) ch.bones[b].quaternion.copy(ch.pose[b]);
}

// Back to a neutral standing state: group at the origin facing +Z, relaxed pose,
// no contact compression, springs settled. Used when a character changes scene.
function resetCharacter(ch, pose = 'Relaxed') {
  ch.group.position.set(0, 0, 0);
  ch.group.quaternion.identity();
  ch.group.rotation.set(0, 0, 0);
  ch.group.visible = true;
  const u = ch.mesh.material.userData.uniforms;
  u.uPressAmt.value = 0; u.uPressAmt2.value = 0; u.uCapN.value = 0;
  ch.jig = null;
  ch.dancer = null;
  ch.handsOnHead = false;
  ch.handsTogether = null;
  ch.lookAtCh = null;   // another character whose face this one looks toward
  hairReset(ch);
  if (ch.skirt) ch.skirt.p = null;   // the cloth restarts from its rest shape where the body now is
  for (const side of ['L', 'R']) ch.bones['bust' + side].position.copy(ch.bustRest[side]);
  setPose(ch, pose, true);
  ch.group.updateMatrixWorld(true);
}

function disposeCharacter(ch) {
  if (ch.group.parent) ch.group.parent.remove(ch.group);
  if (ch.helper.parent) ch.helper.parent.remove(ch.helper);
  ch.mesh.geometry.dispose(); ch.mesh.material.dispose(); ALL_MATS.delete(ch.mesh.material);
  ch.group.traverse(o => { if (o.isMesh && o !== ch.mesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// ── Feet on the floor ──
// A dancer's poses each set their own knee bends, and the body is lowered by a fixed
// amount per move, so without help the feet land at different heights (a foot hanging
// in the air, the other sunk into the floor). After the pose is applied, every foot
// whose sole is within PLANT_MAX of the floor is planted: the body comes down only if
// a straightened leg can't reach, then each planted leg is re-solved (two-bone IK,
// knee kept in its own direction) to put the sole on the floor, and the foot is laid
// flat, keeping its heading. A foot higher than that (a kick) is left in the air.
const PLANT_MAX = 0.15;
const _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gv2 = new THREE.Vector3();
function setWorldQuat(bone, qWorld) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_gq2).invert().multiply(qWorld));
  bone.updateMatrixWorld(true);
}
function groundFeet(ch) {
  const B = ch.bones, hA = ch.spec.J.footL[1];
  ch.group.updateMatrixWorld(true);
  const legs = ['L', 'R'].map(s => {
    const hip = B['thigh' + s].getWorldPosition(new THREE.Vector3()), knee = B['shin' + s].getWorldPosition(new THREE.Vector3()), ank = B['foot' + s].getWorldPosition(new THREE.Vector3());
    return { s, hip, knee, ank, a: hip.distanceTo(knee), b: knee.distanceTo(ank), sole: ank.y - hA };
  });
  const planted = legs.filter(L => L.sole < PLANT_MAX);
  if (!planted.length) return;
  // Bring the body down if a planted leg, straightened, still can't reach the floor.
  let drop = 0;
  for (const L of planted) {
    const reach = (L.a + L.b) * 0.995, dx = L.ank.x - L.hip.x, dz = L.ank.z - L.hip.z;
    const lowest = L.hip.y - Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz));
    drop = Math.max(drop, hA - lowest < 0 ? lowest - hA : 0);
  }
  if (drop > 0) {
    ch.group.position.y -= drop; ch.group.updateMatrixWorld(true);
    for (const L of planted) { L.hip.y -= drop; L.knee.y -= drop; L.ank.y -= drop; }
  }
  for (const L of planted) {
    const T = new THREE.Vector3(L.ank.x, hA, L.ank.z);
    const d = T.clone().sub(L.hip), c = clamp(d.length(), Math.abs(L.a - L.b) + 1e-4, (L.a + L.b) * 0.999);
    const u = d.normalize(), v = L.knee.clone().sub(L.hip);
    v.addScaledVector(u, -v.dot(u));
    if (v.lengthSq() < 1e-8) v.set(0, 0, 1).applyQuaternion(ch.group.quaternion).addScaledVector(u, -u.z);
    v.normalize();
    const cosA = clamp((L.a * L.a + c * c - L.b * L.b) / (2 * L.a * c), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const kneeNew = L.hip.clone().addScaledVector(u, L.a * cosA).addScaledVector(v, L.a * sinA);
    const thigh = B['thigh' + L.s], shin = B['shin' + L.s], foot = B['foot' + L.s];
    setWorldQuat(thigh, _gq.setFromUnitVectors(_gv.copy(L.knee).sub(L.hip).normalize(), _gv2.copy(kneeNew).sub(L.hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion())));
    const k2 = shin.getWorldPosition(new THREE.Vector3()), a2 = foot.getWorldPosition(new THREE.Vector3());
    setWorldQuat(shin, _gq.setFromUnitVectors(a2.sub(k2).normalize(), _gv2.copy(T).sub(k2).normalize()).multiply(shin.getWorldQuaternion(new THREE.Quaternion())));
    // Flat foot: the character's own upright orientation, turned to the foot's heading.
    const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion())); fw.y = 0;
    const gw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.group.getWorldQuaternion(new THREE.Quaternion())); gw.y = 0;
    if (fw.lengthSq() > 1e-6 && gw.lengthSq() > 1e-6) {
      const yaw = Math.atan2(gw.x * fw.z - gw.z * fw.x, gw.x * fw.x + gw.z * fw.z);
      setWorldQuat(foot, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw).multiply(ch.group.getWorldQuaternion(new THREE.Quaternion())));
    }
  }
}

// Per-frame animation for a character not being driven by a scene: ease the pose
// toward its target, breathe, and blend any dance hand IK over the top.
function animateCharacter(ch, dt, t, rate = 7) {
  if (ch.dancer) ch.dancer.update(dt);
  const a = 1 - Math.exp(-dt * (ch.dancer && ch.dancer.active ? 14 : rate));
  for (const b of BONES) {
    ch.pose[b].slerp(ch.target[b], a);
    ch.bones[b].quaternion.copy(ch.pose[b]);
  }
  const br = Math.sin(t * 1.6 + ch.spec.H * 10) * 0.012;
  ch.bones.spine2.rotateX(-br);
  ch.bones.neck.rotateX(br * 0.8);
  if (ch.dancer) groundFeet(ch);
  if (ch.dancer && ch.dancer.ik && ch.dancer.ikW > 0) { ch.group.updateMatrixWorld(true); danceIK(ch, ch.dancer.ik, ch.dancer.ikW); }
  if (ch.lookAtCh) { ch.group.updateMatrixWorld(true); lookAt(ch, ch.lookAtCh.bones.head.getWorldPosition(new THREE.Vector3()), 0.9); }
  if (ch.handsOnHead) { ch.group.updateMatrixWorld(true); handsOnHead(ch); }
  if (ch.handsTogether) { ch.group.updateMatrixWorld(true); handsTogether(ch, ch.handsTogether); }
}

// Hands resting together, one over the other: 'front' — just below the navel, palms
// toward the body; 'back' — at the small of the back, palms facing away from it. The
// right hand lies against the body and the left over it, fingers angled down and
// across. Set `ch.handsTogether = 'front' | 'back'`.
function handsTogether(ch, where) {
  const spec = ch.spec, H = spec.H, J = spec.J.pelvis, pel = ch.bones.pelvis, front = where === 'front';
  // In front: just below the navel. Behind: the small of the back.
  const y = front ? spec.Y.hip + 0.012 * H : spec.Y.belly + 0.015 * H;
  // Where the body surface is at that height, on the centre line (rest space), cached.
  if (!ch._clasp || ch._clasp.where !== where) {
    const p = [0, y, 0], step = front ? 0.001 : -0.001;
    for (let i = 0; i < 400 && field(spec, p) < 0; i++) p[2] += step;
    ch._clasp = { where, z: p[2] };
  }
  const P = v => pel.localToWorld(new THREE.Vector3(v[0] - J[0], v[1] - J[1], v[2] - J[2]));
  const Dir = v => new THREE.Vector3(...v).transformDirection(pel.matrixWorld);
  const out = front ? 1 : -1, half = 0.0085 * H;
  // Both palms face −Z (toward the body in front, away from it behind), so the
  // surface normal the IK lays them against is +Z in either case.
  const n = Dir([0, 0, 1]);
  for (const [side, layer, x, k] of [['R', 1, 0.008, 1], ['L', 3, -0.008, -1]]) {
    const target = P([x * H, y - (side === 'L' ? 0.006 * H : 0), ch._clasp.z + out * (half * layer + 0.002)]);
    const sh = ch.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
    const s = side === 'L' ? 1 : -1;
    const pole = sh.clone().add(Dir(front ? [s * 0.3, -0.25, -0.15] : [s * 0.35, -0.2, 0.05]));
    armIKClear(ch, side, target, pole, n, Dir([k * 0.55, -0.83, 0]).normalize());
  }
}

// Both palms flat on the top of the head, fingers pointing toward each other and
// curled onto the scalp, elbows out to the sides. Set `ch.handsOnHead = true`.
function handsOnHead(ch) {
  const { c, hs } = ch.spec.headInfo, J = ch.spec.J.head, head = ch.bones.head;
  const local = v => head.localToWorld(new THREE.Vector3(v[0] - J[0], v[1] - J[1], v[2] - J[2]));
  const centre = local(c), up = local([c[0], c[1] + 1, c[2]]).sub(centre).normalize();
  const side = local([c[0] + 1, c[1], c[2]]).sub(centre).normalize();
  const r = 0.062 * hs, palm = 0.0085 * ch.spec.H;
  for (const [s, k] of [['L', 1], ['R', -1]]) {
    // A point on the crown, a little to this side and toward the back.
    const n = up.clone().multiplyScalar(0.88).addScaledVector(side, k * 0.4)
      .add(local([c[0], c[1], c[2] - 1]).sub(centre).normalize().multiplyScalar(0.18)).normalize();
    const target = centre.clone().addScaledVector(n, r + palm);
    const sh = ch.bones['upperArm' + s].getWorldPosition(new THREE.Vector3());
    armIKClear(ch, s, target, sh.clone().addScaledVector(side, k * 0.4).addScaledVector(up, -0.05), n, side.clone().multiplyScalar(-k));
    wrapFingers(ch, s, q => q.distanceTo(centre) - r, -8, 60);
  }
}

// ════════════════════════════════════════════════════════════════
// DISCIPLINE SCENE — disciplinarian seated on the flight case, subject
// face-down across the lap. Bodies are posed with joint angles; the
// disciplinarian's hands are placed with two-bone IK onto points taken
// from the subject's posed pelvis, so any pairing of measurements lines up.
// Coordinates: the disciplinarian faces +Z; their right hand (−X) swings,
// so the subject's hips sit on that side with the head toward +X.
// The scene is laid out at the world origin (the IK uses world axes).
// ════════════════════════════════════════════════════════════════

// What the subject is wearing over the struck area, as a share of the sting taken off (PAIN.CUSHION; garments stack, with a ceiling).
// Lowered garments and a skirt taken off for the correction don't count.
function clothCushion(ch) {
  let left = 1;
  for (const L of ch.layers || []) {
    if (ch.lowered && ch.lowered.has(L)) continue;
    let c = 0;
    if (L.kind === 'bottom') c = L.lowerTo === 'ankle' ? PAIN.CUSHION.trousers : L.legLen >= 1 ? PAIN.CUSHION.leggings : PAIN.CUSHION.shorts;
    else if (L.kind === 'briefs') c = L.thong || L.back === 'thong' ? PAIN.CUSHION.thong : L.leg ? PAIN.CUSHION.trunks : PAIN.CUSHION.briefs;
    else if (L.kind === 'skirt') c = !ch.skirt || ch.skirt.off ? 0 : ch.skirt.gathered ? 0.05 : PAIN.CUSHION.skirt;   // (hitched up, only a little is left over the cheek)
    left *= 1 - c;
  }
  return Math.min(PAIN.CUSHION_MAX, 1 - left);
}
// ════════════════════════════════════════════════════════════════
// PAIN — how a subject takes discipline. Two stats on each character (0–1; defaults in the presets):
//   tolerance: how much they can take before they're at their limit (the capacity),
//   resilience: how little each smack builds, and how quickly the sting and ache fade between them.
// Each landed smack adds pain from three things the player controls:
//   - strike speed: a faster swing lands harder (`speed`, 1 = the standard swing),
//   - the hold before the swing: the arm raised and waiting builds dread, which adds to the next smack (eases in, saturates;
//     tolerance blunts it),
//   - the hold after contact: the hand or implement left on the skin keeps stinging (a rate per second while it stays),
// and from the implement (a base weight, and how much of it is a sharp sting that fades fast against a deep ache that lingers),
// and from how tender the skin already is (the marks), and from what they're wearing: clothing over the struck area cushions the
// sting only (clothCushion / PAIN.CUSHION); the ache is the same through any layers. Distress is the pain now against the capacity; its bands drive the
// reaction and the face. At 1 they're at the EDGE OF RESISTANCE (what was the limit): past it they can go on receiving half again
// (to 1.5), and that is where they're most receptive to the lesson being imparted; at 1.5 it tips into too harsh, under any
// circumstance, and the correction stops (the scene won't start another stroke).
// ════════════════════════════════════════════════════════════════
const PAIN = {
  // base: pain of a full-strength smack at standard speed; sting: the share that is sharp (fades fast).
  implement: { hand: { base: 0.8, sting: 0.55 }, hairbrush: { base: 1.5, sting: 0.65 }, rod: { base: 3.8, sting: 0.4 }, paddle: { base: 1.65, sting: 0.3 } },
  TAU_STING: 3.0, TAU_ACHE: 120,         // seconds for the sting and the ache to fall by 1/e, at resilience 0.5
  RESIST: 0.5,                          // resilience takes up to this share off every smack
  SPEED_EXP: 1.0,                        // pain ∝ speed ^ this
  ANTIC_MAX: 0.6, ANTIC_TAU: 1.0,        // dread adds up to this share, building over this many seconds of waiting
  DWELL_RATE: 0.9, DWELL_MAX: 2.0,      // staying on the skin adds this share of the smack per second, up to this many seconds
  TENDER: 0.6,                           // fully marked skin hurts this much more
  // What clothing takes off the sting (the sharp part; the deep ache goes through cloth untouched): by garment, stacking.
  CUSHION: { thong: 0.03, briefs: 0.12, trunks: 0.15, leggings: 0.25, shorts: 0.35, trousers: 0.4, skirt: 0.2 }, CUSHION_MAX: 0.7,
  CAP: 70,                               // the capacity at tolerance 0.5 is CAP × (0.7 + 0.6 × tolerance)
  EDGE: 1, TOO_HARSH: 1.5,   // distress at the edge of resistance, and half again past it, where it's too harsh
  BANDS: [[0.3, 'composed'], [0.6, 'flinching'], [0.9, 'struggling'], [1, 'close to the edge of resistance'], [1.5, 'past the edge of resistance: most receptive'], [Infinity, 'too harsh']],
};
function createPain(stats = {}) {
  const st = { tolerance: 0.5, resilience: 0.5, ...stats };
  const P = { stats: st, sting: 0, ache: 0, hits: 0, last: null, dwell: 0, atEdge: false, atLimit: false, tooHarsh: false, peak: 0 };
  P.capacity = () => PAIN.CAP * (0.7 + 0.6 * st.tolerance);
  P.level = () => P.sting + P.ache;
  P.distress = () => P.level() / P.capacity();
  // How receptive they are to the lesson: little while composed, building as they struggle, fullest from the edge of resistance
  // to half again past it, and gone once it's too harsh.
  P.receptivity = () => { const d = P.distress(), t = Math.max(0, Math.min(1, (d - 0.5) / 0.5)), r = 0.15 + 0.85 * t * t * (3 - 2 * t); return d < PAIN.TOO_HARSH ? r : 0; };
  P.inEdge = () => { const d = P.distress(); return d >= PAIN.EDGE && d < PAIN.TOO_HARSH; };
  const mark = () => { const d = P.distress(); if (d >= PAIN.EDGE) P.atEdge = P.atLimit = true; if (d >= PAIN.TOO_HARSH) P.tooHarsh = true; };
  P.band = () => PAIN.BANDS.find(([max]) => P.distress() < max)[1];
  // A smack lands. info: { implement, strength (0–1), speed (1 = standard), raised (seconds the arm waited raised), tender (0–1) }.
  // Returns { pain, reaction }: this smack's pain, and how hard the subject reacts (0–1) given it and how they already are.
  P.hit = info => {
    const cushion = Math.max(0, Math.min(PAIN.CUSHION_MAX, info.cushion || 0));
    const I = PAIN.implement[info.implement] || PAIN.implement.hand;
    const speed = Math.max(0.2, info.speed == null ? 1 : info.speed);
    const antic = PAIN.ANTIC_MAX * (1 - Math.exp(-(info.raised || 0) / PAIN.ANTIC_TAU)) * (1 - 0.5 * st.tolerance);
    const p = I.base * (info.strength == null ? 1 : info.strength) * Math.pow(speed, PAIN.SPEED_EXP) * (1 + antic)
      * (1 + PAIN.TENDER * (info.tender || 0)) * (1 - PAIN.RESIST * st.resilience);
    // Clothing blunts the sting only: the sharp share is cut, the ache comes through whole.
    const sting = p * I.sting * (1 - cushion), ache = p * (1 - I.sting), eff = sting + ache;
    P.sting += sting; P.ache += ache;
    P.hits++; P.dwell = 0; P.last = { sting, ache, p: eff, cushion };
    P.peak = Math.max(P.peak, P.distress());
    mark();
    // The reaction: how big this smack is against what they can take, how worked up they already are, and how long they waited for it.
    const reaction = Math.max(0, Math.min(1, 0.2 + 0.8 * (0.5 * eff / (0.3 * P.capacity()) + 0.35 * Math.min(1, P.distress()) + 0.15 * (antic / PAIN.ANTIC_MAX))));
    return { pain: eff, reaction, cushion };
  };
  // Every frame. `onSkin`: the hand or implement is still on the skin from the last smack.
  P.update = (dt, onSkin = false) => {
    if (onSkin && P.last && P.dwell < PAIN.DWELL_MAX) {
      const d = Math.min(dt, PAIN.DWELL_MAX - P.dwell);
      P.sting += P.last.sting * PAIN.DWELL_RATE * d; P.ache += P.last.ache * PAIN.DWELL_RATE * d; P.dwell += d;
    }
    const k = 0.5 + st.resilience;   // the fade rate: resilient people recover faster
    P.sting *= Math.exp(-dt * k / PAIN.TAU_STING); P.ache *= Math.exp(-dt * k / PAIN.TAU_ACHE);
    mark();
  };
  P.reset = () => { P.sting = P.ache = 0; P.hits = 0; P.last = null; P.dwell = 0; P.atEdge = P.atLimit = P.tooHarsh = false; P.peak = 0; };
  return P;
}

const STRIKE_K = 2;   // strike height: steps (~1.4 cm each) up from the glute/thigh fold
// Swing timing, in seconds. `speed` multiplies how fast the arm moves (lift and
// strike); the holds are not scaled.
const DEFAULT_TIMING = { speed: 1, lift: 0.52, strike: 0.09, raisedHold: 0.2, contactHold: 0.35 };

const GIVER_BASE = { thighL: [-90, 0, -5], thighR: [-90, 0, 5], shinL: [90, 0, 0], shinR: [90, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0] };
// Across the lap the disciplinarian sits upright against the chair's straight back (supported at the lower back and thighs): the back is vertical at rest and only
// leans a little, from the hip, to reach the contact sites.
const GIVER_BEAT = {
  relaxed: { spine1: [0, 0, 0], neck: [6, 0, 0] },
  raised:  { spine1: [0, 0, 0], spine2: [-3, 8, 0], neck: [10, 0, 0] },
  contact: { spine1: [3, 0, 0], spine2: [2, -4, 0], neck: [12, 0, 0] },
};
// Seated with the hands resting on the thighs, for scenes before the subject is in place.
const GIVER_SEATED = { upperArmL: [-30, 0, -35], upperArmR: [-30, 0, 35], forearmL: [-40, 0, 0], forearmR: [-40, 0, 0], spine1: [0, 0, 0] };
// Subject pose is in their own frame: +X bends forward, which is toward the floor here.
const SUBJECT_BASE = {
  thighL: [-52, 0, -3], thighR: [-52, 0, 3], shinL: [10, 0, 0], shinR: [10, 0, 0],
  spine1: [10, 0, 0], spine2: [8, 0, 0], neck: [-18, 0, 0], head: [-8, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, 0], fingersR: [0, 0, 0],   // flat on the floor
};
// SUBJECT_REACT lifts the left leg higher (for left-glute strikes); the mirror
// is used for right strikes.
const SUBJECT_REACT = {
  thighL: [-40, 0, -5], thighR: [-46, 0, 6], shinL: [58, 0, 0], shinR: [38, 0, 0],
  spine1: [2, 0, 0], spine2: [-5, 0, 0], neck: [-40, 0, 0], head: [-16, 0, 0],
  upperArmL: [-55, 0, -26], upperArmR: [-55, 0, 26], forearmL: [-50, 0, 0], forearmR: [-50, 0, 0],
  handL: [-30, 0, 0], handR: [-30, 0, 0],
};
const SUBJ_BASE_Q = poseQuats(SUBJECT_BASE);
const SUBJ_REACT_Q = { L: poseQuats(SUBJECT_BASE, SUBJECT_REACT), R: poseQuats(SUBJECT_BASE, mirrorPose(SUBJECT_REACT)) };
// Both sides at once (a wide implement): halfway between the two, so the reaction is centred.
SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(SUBJ_REACT_Q.L).map(b => [b, SUBJ_REACT_Q.L[b].clone().slerp(SUBJ_REACT_Q.R[b], 0.5)]));
const GIVER_Q = Object.fromEntries(Object.keys(GIVER_BEAT).map(k => [k, poseQuats(GIVER_BASE, GIVER_BEAT[k])]));

// ── Over the case ──────────────────────────────────────────────
// The subject stands facing +X, bent at the hips (the whole body pitched forward about the
// hip joint, the legs kept upright by counter-rotating the thighs), arms straight down to
// palms flat on the case lid ahead of them. The disciplinarian stands at the subject's
// left side (world −Z) facing +Z, turned a little toward the subject's hips, so the
// swinging (right) arm points at the subject's rear exactly as it does from the seat.
// Everything else about the scene (strike fit, press, marks) is shared with the lap.
const CASE_PITCH = 84;   // degrees the torso is pitched forward from upright
const CASE_SUBJECT_BASE = {
  // Legs from a pose-editor report: nearly straight, the soles flat so toes and heels both meet the floor.
  thighL: [-80, -1, -3], thighR: [-80, 1, 3], shinL: [-2, 0, 0], shinR: [-2, 0, 0], footL: [1, 0, 0], footR: [0, 0, 0],
  spine1: [-3, 0, 0], spine2: [-4, 0, 0], neck: [-40, 0, 0], head: [-14, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
};
// Struck: the hips jump forward and the back hollows, the head comes up. The legs are the
// base pose's: they stay straight and planted.
const CASE_SUBJECT_REACT = {
  thighL: CASE_SUBJECT_BASE.thighL, thighR: CASE_SUBJECT_BASE.thighR, shinL: CASE_SUBJECT_BASE.shinL, shinR: CASE_SUBJECT_BASE.shinR, footL: CASE_SUBJECT_BASE.footL, footR: CASE_SUBJECT_BASE.footR,
  spine1: [-12, 0, 0], spine2: [-14, 0, 0], neck: [-48, 0, 0], head: [-16, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
};
// The standing stance, from a pose-editor report: legs nearly straight, the feet planted flat
// (the same for every beat and implement).
const CASE_GIVER_BASE = { thighL: [-1.6, -1.2, 0.6], thighR: [-0.3, 1.5, -5.4], shinL: [-2, -3.5, -0.1], shinR: [-3.7, 3.7, -1.7], footL: [3.2, 1.1, -8.8], footR: [3.5, -1.5, 15.2] };
const CASE_GIVER_BEAT = {
  relaxed: { spine1: [16, 0, 0], spine2: [8, 0, 0], neck: [0, 0, 0] },
  raised:  { spine1: [12, 0, 0], spine2: [4, 8, 0], neck: [4, 0, 0] },
  contact: { spine1: [20, 0, 0], spine2: [10, -4, 0], neck: [6, 0, 0] },
};
// From pose-editor reports. At rest the swinging hand floats just off the near cheek (CASE_REST_HOVER
// m above the skin) with the thumb tucked; the left thumb lies along the back; a far-side strike
// leans the spine forward a further CASE_FAR_LEAN degrees and lifts the right shoulder a little.
const CASE_REST_HOVER = 0.016, CASE_REST_THUMB = [-54, 58, 33], CASE_THUMB_L = [11.2, -1, -8.9];
const CASE_FAR_LEAN = 9.7, CASE_FAR_CLAV = [-0.3, -3.8, 6.2];
const CASE_YAW = -35;      // the disciplinarian's turn toward the subject's hips, degrees
const CASE_GIVER_AT = [0, -0.44];   // where the disciplinarian's pelvis stands (x, z)
const poseTable = (base, beats) => Object.fromEntries(Object.keys(beats).map(k => [k, poseQuats(base, beats[k])]));
const CASE_SUBJ_BASE_Q = poseQuats(CASE_SUBJECT_BASE);
const CASE_SUBJ_REACT_Q = { L: poseQuats(CASE_SUBJECT_BASE, CASE_SUBJECT_REACT), R: poseQuats(CASE_SUBJECT_BASE, mirrorPose(CASE_SUBJECT_REACT)) };
CASE_SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(CASE_SUBJ_REACT_Q.L).map(b => [b, CASE_SUBJ_REACT_Q.L[b].clone().slerp(CASE_SUBJ_REACT_Q.R[b], 0.5)]));
// The paddle's reaction over the case (from a pose-editor report) is a buck, not the other implements'
// reaction: the hips come forward and sink, the knees bend and the feet stay planted where they are (the feet
// turn to stay flat). `shift` is the body's move at full reaction (m, for a 1.58 m subject; world axes).
const CASE_PADDLE_GAZE = { neck: [0.6, 13.8, -3.4], head: [0.8, -25.2, 7.5] };
const CASE_BUCK = { shift: [0.066, -0.025, -0.009], leftHand: [0, 0.025, -0.013],
  spine1: [-12.4, 0, 0], spine2: [-10.9, 0, 0],
  thighL: [-87.5, -1, -3], thighR: [-87.5, 1, 3], shinL: [22.7, 0, 0], shinR: [22.7, 0, 0], footL: [-16.9, 0, 0], footR: [-16.9, 0, 0] };
const CASE_BUCK_Q = { L: poseQuats(CASE_SUBJECT_BASE, CASE_BUCK), R: poseQuats(CASE_SUBJECT_BASE, mirrorPose(CASE_BUCK)) };
CASE_BUCK_Q.B = Object.fromEntries(Object.keys(CASE_BUCK_Q.L).map(b => [b, CASE_BUCK_Q.L[b].clone().slerp(CASE_BUCK_Q.R[b], 0.5)]));
const CASE_GIVER_Q = poseTable(CASE_GIVER_BASE, CASE_GIVER_BEAT);

// ── Hands on knees ─────────────────────────────────────────────
// The subject stands free with straight legs, bent forward at the hips (KNEES_PITCH from upright, nearly level)
// with the legs leaning back (KNEES_LEG_BACK) so the hips sit behind the feet and the weight stays over them,
// palms on the front of the knees. The disciplinarian stands and behaves as over the case (same stance, side
// and reach); only the subject's pose and hands differ, and there is no case. Struck with the hand or hair
// brush, only the head moves; struck with the paddle the knees give lightly and the body leans forward, the feet
// staying planted (the legs are solved to keep them there, see kneesBody).
const KNEES_PITCH = 85, KNEES_LEG_BACK = 12;
// From pose-editor reports (Kiko, 1.58 m; scaled by height): the pelvis sits 5.8 cm back and 1.1 cm lower than stood and
// the ankles come in 6.8 cm (left) and 9.2 cm (right) toward the hips, so the legs are more upright over the feet.
// Struck with the hand or hair brush the pelvis comes forward 4.1 cm and 0.3 cm up (the ankles stay); struck with
// the paddle the hip bend reduces by KNEES_UP degrees and the subject comes up, the pelvis and feet staying put.
const KNEES_STANCE = { pelvis: [-0.058, -0.011, 0.002], ankleL: 0.068, ankleR: 0.092 };
const KNEES_CONTACT = { pelvis: [0.041, 0.003, 0] };
const KNEES_UP = 12;
// ── Bent over, feet spread ───────────────────────────────────
// The hands-on-knees pose with the feet wide apart (ankles `SPREAD_ANKLE` either side of the centre line, 1.58 m
// subject) and the palms on the fronts of the thighs. The disciplinarian stands wider and further back (from a
// pose-editor report, Kenji with Aya) and turns toward the hips. The legs are solved in 3D (see kneesBody).
const SPREAD_ANKLE = 0.275, SPREAD_ANKLE_X = -0.11;
// The disciplinarian's relaxed stance (pose-editor report, Aya with Rin, paddle), kept for every beat until the others
// are edited: the pelvis turned 33° back from the 43° the figure stands at (10° in all), the upper back as set, the feet
// turned. The left hand hangs by the hip; the paddle hangs behind (SPREAD_PADDLE_REST: from the right shoulder, cm).
const SPREAD_GIVER_AT = [-0.045, -0.643], SPREAD_YAW = 43;
const SPREAD_GIVER_STANCE = { pelvis: [0, -33, 0], spine1: [8.5, -5.7, -5.2], spine2: [-14, -1.9, 3.5], footL: [3.2, 16.5, 16.5], footR: [3.5, -23.5, -1.5] };
const SPREAD_HANG_L = [-0.028, -0.468, 0.049];   // the left hand's rest, from the left shoulder (m, 1.72 m tall; world axes)
const SPREAD_HANG_POLE_L = [0.13, -0.235, -0.125];
const SPREAD_PADDLE_REST = { face: [-0.188, -0.543, 0.399], faceN: [0.992, -0.107, 0.069], axis: [-0.057, 0.119, 0.991], elbow: [-0.104, -0.269, 0.065] };
const KNEES_PRESS_DEPTH = 0.003;   // the palm sinks this far into the skin at contact (12 mm elsewhere): the bent-over rear is steeper, so less
// The swinging hand's rest (pose-editor report, 12:54), measured from the right shoulder (m, for a 1.72 m
// disciplinarian; world axes before any lean): the empty hand hangs close by the near hip, the brush hangs at the
// side pointing forward, its face toward the subject. `at` is where the hand goes (the palm, as the rest
// placement otherwise puts it); `pole`: the upper arm's elbow direction; `n`: the surface normal the palm faces.
// The paddle hangs a little further back at the side (12:56 report): its face centre moves by `dface` (m, for 1.7 m
// tall, world axes) from the case's rest, and the elbow points `elbow` from the shoulder.
const KNEES_PADDLE_REST = { dface: [-0.059, -0.068, -0.050], elbow: [-0.143, -0.970, -0.221] };
const KNEES_REST = {
  hand:  { delta: [0.016, -0.047, -0.014], pole: [-0.026, -0.265, 0.13] },
  brush: { delta: [-0.031, -0.179, -0.358], pole: [-0.027, -0.290, -0.053], n: [-0.989, 0.025, -0.148] },
};
// Paddle on contact (from the 12:52 report): the back hollows a little more and the blade rolls up to 95° (the
// case's 82.5° otherwise). The hair brush's contact leans the disciplinarian's upper back further forward (17.6°).
const KNEES_PADDLE_BACK = { spine1: [-8.4, 0, -1.6], spine2: [-18.6, 0, -1.3] };
const KNEES_ROLL = 95;
const KNEES_GIVER_BEAT = { ...CASE_GIVER_BEAT, contact: { ...CASE_GIVER_BEAT.contact, spine2: [17.6, -4, 0] } };
const KNEES_GIVER_Q = poseTable(CASE_GIVER_BASE, KNEES_GIVER_BEAT);
// Contact leans the upper body further forward over the subject (14:16 report).
const SPREAD_CONTACT_BACK = { spine1: [28.9, -9.3, -11.4] };
const SPREAD_GIVER_BEAT = Object.fromEntries(['relaxed', 'raised', 'contact'].map(b => [b, { ...KNEES_GIVER_BEAT[b], ...SPREAD_GIVER_STANCE, ...(b === 'contact' ? SPREAD_CONTACT_BACK : {}) }]));
const SPREAD_GIVER_Q = poseTable(CASE_GIVER_BASE, SPREAD_GIVER_BEAT);
const KNEES_SUBJECT_BASE = {
  // (A thigh swings forward with a negative angle, and the body's pitch swings the legs back, so the hip takes both.)
  thighL: [KNEES_LEG_BACK - KNEES_PITCH, 0, -4], thighR: [KNEES_LEG_BACK - KNEES_PITCH, 0, 4], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [-KNEES_LEG_BACK, 0, 0], footR: [-KNEES_LEG_BACK, 0, 0],
  spine1: [-6, 0, 0], spine2: [-8, 0, 0], neck: [-30, 0, 0], head: [-12, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, -35], fingersR: [0, 0, 35],
};
// Only the head moves when struck.
const KNEES_SUBJECT_REACT = { ...KNEES_SUBJECT_BASE, spine2: [-12.8, 0, -0.5], neck: [-44, 0, 0], head: [-16, 0, 0] };
const KNEES_BASE_Q = poseQuats(KNEES_SUBJECT_BASE);
const KNEES_REACT_Q = { L: poseQuats(KNEES_SUBJECT_BASE, KNEES_SUBJECT_REACT), R: poseQuats(KNEES_SUBJECT_BASE, mirrorPose(KNEES_SUBJECT_REACT)) };
KNEES_REACT_Q.B = Object.fromEntries(Object.keys(KNEES_REACT_Q.L).map(b => [b, KNEES_REACT_Q.L[b].clone().slerp(KNEES_REACT_Q.R[b], 0.5)]));
const KNEES_PADDLE_Q = { L: poseQuats(KNEES_SUBJECT_BASE, KNEES_PADDLE_BACK), R: poseQuats(KNEES_SUBJECT_BASE, mirrorPose(KNEES_PADDLE_BACK)) };
KNEES_PADDLE_Q.B = Object.fromEntries(Object.keys(KNEES_PADDLE_Q.L).map(b => [b, KNEES_PADDLE_Q.L[b].clone().slerp(KNEES_PADDLE_Q.R[b], 0.5)]));

// ── Hands on head ──────────────────────────────────────────────
// The subject stands free, upright, facing +X, hands on the back of the head with the elbows out.
// The disciplinarian stands as over the case (same stance, same side), the right hand striking the
// rear; the left hand rests at their side while relaxed and against the subject's navel when the
// arm is raised and on contact, steadying them.
const HEAD_SUBJECT_BASE = {
  thighL: [0, 0, -3], thighR: [0, 0, 3], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0],
  spine1: [-2, 0, 0], spine2: [-2, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, -27.5], fingersR: [0, 0, 27.5],   // a loose curl on the head
};
// Struck: the back hollows, the chest comes forward and the head lifts.
// Struck (from a pose-editor report): the chest comes up, the head goes back, and they rise onto their toes.
const HEAD_RISE = 0.038;   // m for a 1.58 m subject, at full reaction
const HEAD_SUBJECT_REACT = { ...HEAD_SUBJECT_BASE, spine1: [1.5, 0, -1.2], spine2: [-12.9, -0.6, -1.9], neck: [-14, -0.6, 3.6], head: [-4, 0, 0], clavL: [0.2, -2.1, 1],
  thighL: [-0.3, 0, -3.4], footL: [18, 0, 0], footR: [19.5, 0, 0] };
// The paddle's reaction is different: bucking away from it, the hips come forward while the feet stay planted
// (the body pitches about them by `pitch` degrees and the back hollows to bring the chest back), instead of
// rising onto the toes. The feet counter-turn to stay flat.
const HEAD_BUCK = { pitch: 4, spine1: -7, spine2: -7, neck: -3, head: -4 };
const HEAD_BUCK_REACT = { ...HEAD_SUBJECT_BASE, spine1: [HEAD_BUCK.spine1, 0, 0], spine2: [HEAD_BUCK.spine2, 0, 0], neck: [HEAD_BUCK.neck, 0, 0], head: [HEAD_BUCK.head, 0, 0],
  footL: [-HEAD_BUCK.pitch, 0, 0], footR: [-HEAD_BUCK.pitch, 0, 0] };
const HEAD_SUBJ_BASE_Q = poseQuats(HEAD_SUBJECT_BASE);
const HEAD_BUCK_Q = { L: poseQuats(HEAD_SUBJECT_BASE, HEAD_BUCK_REACT), R: poseQuats(HEAD_SUBJECT_BASE, mirrorPose(HEAD_BUCK_REACT)) };
HEAD_BUCK_Q.B = Object.fromEntries(Object.keys(HEAD_BUCK_Q.L).map(b => [b, HEAD_BUCK_Q.L[b].clone().slerp(HEAD_BUCK_Q.R[b], 0.5)]));
// The left hand rests on the front of the subject's left side at the waist (anchor `navel`, from the editor); the
// fingers run around the front.
const HEAD_NAVEL_FINGERS = new THREE.Vector3(0.69, -0.11, 0.72);
const HEAD_SUBJ_REACT_Q = { L: poseQuats(HEAD_SUBJECT_BASE, HEAD_SUBJECT_REACT), R: poseQuats(HEAD_SUBJECT_BASE, mirrorPose(HEAD_SUBJECT_REACT)) };
HEAD_SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(HEAD_SUBJ_REACT_Q.L).map(b => [b, HEAD_SUBJ_REACT_Q.L[b].clone().slerp(HEAD_SUBJ_REACT_Q.R[b], 0.5)]));
// Where each palm goes on the skull: a direction from its centre (head frame: +X the subject's left,
// +Y up, +Z forward), the fingers' direction along the surface, and the elbow's pole (world, from
// the shoulder; out to the side and a little forward).
// The disciplinarian's place and turn. They stand behind the subject's rear plane, square on to the
// subject while relaxed (from a pose-editor report: pelvis at x −29.5 cm, facing the subject, the back
// straight), and turn toward the subject's hips as the arm comes up. Hanging hands (m, × height, from
// the shoulder in the disciplinarian's frame): down, outward and forward.
const HEAD_GIVER_AT = [-0.266, -0.386];
const HEAD_YAW_RELAXED = 9, HEAD_YAW_STRIKE = 30;
const HEAD_HANG = { down: 0.312, out: 0.048, fwd: 0.007 };
// Raised and on contact the turn swings the feet round, so those beats re-plant them with their own leg
// angles (from a pose-editor report); the left hand's place on the navel is the anchor's, the same for both.
const HEAD_STRIKE_LEGS = { thighL: [-7.9, -1.6, -0.7], footL: [12.5, 0.9, -10.1], thighR: [14.4, -0.4, -3.5], footR: [-8.5, -1.5, 15.2] };
const HEAD_GIVER_BEAT = {
  relaxed: { spine1: [3.8, -1.1, -3.9], spine2: [1.3, 1.6, 4], neck: [0, 0, 0] },
  raised:  { ...CASE_GIVER_BEAT.raised, spine1: [13.5, 0, 7.2], spine2: [-3.8, 7.4, 6.3], ...HEAD_STRIKE_LEGS },
  contact: { ...CASE_GIVER_BEAT.contact, spine1: [19.8, 0, -1.4], spine2: [-11, -4.6, 12.3], ...HEAD_STRIKE_LEGS },
};
// The raised arm's elbow (world, from the shoulder: out to the side and a little up) and the gaze's
// trim as the arm is raised (neck and head offsets after the look, local degrees).
const HEAD_POLE_RAISED = new THREE.Vector3(-0.184, -0.12, -0.198);
// Where the raised hand's palm goes, from the shoulder (m, for 1.7 m tall; world axes): the elbow as edited in
// the pose editor with the hand continuing the forearm.
const HEAD_RAISED_HAND = new THREE.Vector3(-0.192, 0.103, 0.042);
const HEAD_GAZE = { raised: { neck: [-6.3, -1.4, 11.5], head: [-0.6, -21.9, 4.2] }, contact: { neck: [-5.7, -1.5, 12], head: [-0.9, -19.8, 4.9] } };
// A far-side (right) strike: a small further lean and shoulder turn so the hand reaches the site comfortably.
const HEAD_FAR_LEAN = 4, HEAD_FAR_TURN = 10;
// Standing, the hand lands higher on the cheek than seated (steps up the strike strip; see STRIKE_K).
const HEAD_STRIKE_K = 7;
const HEAD_GIVER_Q = poseTable(CASE_GIVER_BASE, HEAD_GIVER_BEAT);
const HEAD_PALM = { dir: [0.21, 0.42, -0.88], fingers: [-0.92, 0.33, -0.19], lift: 0.019, pole: [0.1, 0.1, 0.5] };

// Puts `ch` (already posed) so that its pelvis joint is at `at` with the group turned to
// `quat`, then drops it until its feet rest on the floor.
function standAt(ch, quat, at) {
  ch.group.quaternion.copy(quat);
  const pel = new THREE.Vector3(...ch.spec.J.pelvis).applyQuaternion(quat);
  ch.group.position.copy(at).sub(pel);
  ch.group.updateMatrixWorld(true);
  const lift = (ch.bones.footL.getWorldPosition(new THREE.Vector3()).y + ch.bones.footR.getWorldPosition(new THREE.Vector3()).y) / 2 - ch.spec.J.footL[1];
  ch.group.position.y -= lift;
  ch.group.updateMatrixWorld(true);
}
// Where a subject's palm goes on the lid (height `top`): ahead of the shoulder far enough
// that the arm is a little short of straight, level with the shoulder across the body.
function casePalm(s, side, top) {
  const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
  const wristReach = s.bones['forearm' + side].position.length() + s.bones['hand' + side].position.length();
  const dy = sh.y - top, r = wristReach * 0.94;
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
  const sHand = s.spec.H * 0.106;
  return new THREE.Vector3(sh.x + dx + sHand * 0.42, top + 0.012 * s.spec.H, sh.z);
}
// The case itself: a road case with its near edge `x0` and far edge `x1` along X, `top` high.
function buildCase(top, x0, x1) {
  const g = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: lin(0x1a1a1c), roughness: 0.75, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x8a8a90), roughness: 0.35, metalness: 0.8 });
  const L = x1 - x0, W = 0.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, top, W), caseMat);
  body.position.set((x0 + x1) / 2, top / 2, 0); body.castShadow = body.receiveShadow = true; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.025, W + 0.02), metal);
  trim.position.set((x0 + x1) / 2, top - 0.012, 0); g.add(trim);
  for (const x of [x0 + 0.02, x1 - 0.02]) for (const z of [-W / 2 + 0.02, W / 2 - 0.02]) for (const y of [0.03, top - 0.04]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metal);
    c.position.set(x, y, z); g.add(c);
  }
  return g;
}

// Hands on knees: positions the standing subject for this frame and solves the legs to keep the feet planted.
// The body leans (`pitch` degrees more than stood) and the pelvis moves (`dx` forward, `dy` up, m) as the
// paddle's buckle asks, then each leg's thigh, shin and foot are set in the sagittal plane so the ankles stay
// where they were (the knee forward of the line from hip to ankle, the sole flat).
function kneesBody(scn, k) {
  const s = scn.s, sc = s.spec.H / 1.58, DEG = Math.PI / 180;
  const up = scn.buck;   // the paddle: the subject comes up (less hip bend) instead of moving forward
  const pitch = KNEES_PITCH - (up ? KNEES_UP * k : 0);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch * DEG));
  const pel = new THREE.Vector3(...s.spec.J.pelvis).applyQuaternion(q);
  const target = scn.kneesPelvis.clone().add(new THREE.Vector3(...KNEES_STANCE.pelvis).multiplyScalar(sc));
  if (!up) target.add(new THREE.Vector3(...KNEES_CONTACT.pelvis).multiplyScalar(sc * k));
  s.group.quaternion.copy(q);
  s.group.position.copy(target).sub(pel);
  s.group.updateMatrixWorld(true);
  if (scn.atSpread) { spreadLegs(scn); return; }
  for (const side of ['L', 'R']) {
    const th = s.bones['thigh' + side], sh = s.bones['shin' + side], ft = s.bones['foot' + side];
    const H = th.getWorldPosition(new THREE.Vector3()), A = scn.kneesAnkle[side].clone();
    A.x += (side === 'L' ? KNEES_STANCE.ankleL : KNEES_STANCE.ankleR) * sc;
    const L1 = sh.position.length(), L2 = ft.position.length();
    const dx = A.x - H.x, dy = H.y - A.y;
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
    const base = Math.atan2(dx, dy);
    const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), be = Math.acos(clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
    const ft_ = base + al, fs_ = base - be;   // thigh and shin forward angles from straight down
    const eu = new THREE.Euler().setFromQuaternion(th.quaternion, 'YXZ');   // keep the thigh's splay, replace its pitch
    th.quaternion.setFromEuler(new THREE.Euler(-ft_ - pitch * DEG, eu.y, eu.z, 'YXZ'));
    sh.quaternion.setFromEuler(new THREE.Euler(ft_ - fs_, 0, 0, 'YXZ'));
    ft.quaternion.setFromEuler(new THREE.Euler(fs_, 0, 0, 'YXZ'));
  }
  s.group.updateMatrixWorld(true);
}
// Bent over with the feet spread: each leg solved in 3D so the ankle lands on `SPREAD_ANKLE` out from the centre line
// (the knee forward of the hip-to-ankle line), the thigh and shin aimed with the least twist and the foot flat,
// turned out about the vertical (30° left, 20° right toe-out, as edited).
function spreadLegs(scn) {
  const s = scn.s, sc = s.spec.H / 1.58, DEG = Math.PI / 180;
  const root = s.group.matrixWorld;
  for (const side of ['L', 'R']) {
    const th = s.bones['thigh' + side], sh = s.bones['shin' + side], ft = s.bones['foot' + side];
    const sgn = side === 'L' ? -1 : 1;   // the subject's left is world −Z
    const H = th.getWorldPosition(new THREE.Vector3());
    const A = new THREE.Vector3(scn.kneesPelvis.x + SPREAD_ANKLE_X * sc, scn.kneesAnkle[side].y, sgn * SPREAD_ANKLE * sc);
    const L1 = sh.position.length(), L2 = ft.position.length();
    const d = clamp(H.distanceTo(A), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
    const dir = A.clone().sub(H).normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const fwd = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize();   // the knee bends forward (+X)
    const K = H.clone().addScaledVector(dir, a).addScaledVector(fwd, h);
    // Thigh: aim its rest direction at the knee, in the pelvis's frame.
    const aim = (bone, to) => {
      const parentInv = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const rest = bone.children[0] ? bone.children[0].position.clone().normalize() : new THREE.Vector3(0, -1, 0);
      bone.quaternion.setFromUnitVectors(rest, to.clone().applyQuaternion(parentInv).normalize());
      bone.updateMatrixWorld(true);
    };
    aim(th, K.clone().sub(H));
    aim(sh, A.clone().sub(K));
    // Foot flat on the floor, toes turned out about the vertical.
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.PI / 2 + sgn * (side === 'L' ? 30 : 20) * DEG * -1));
    ft.quaternion.copy(ft.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(yaw));
    ft.updateMatrixWorld(true);
  }
  s.group.updateMatrixWorld(true);
}
function buildBench(top) {
  const g = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: lin(0x1a1a1c), roughness: 0.75, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x8a8a90), roughness: 0.35, metalness: 0.8 });
  // Narrow enough that the subject's arms clear it on the way to the floor.
  const W = 0.42;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, top, 0.46), caseMat);
  body.position.y = top / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.025, 0.48), metal);
  trim.position.y = top - 0.012; g.add(trim);
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) for (const z of [-0.21, 0.21]) for (const y of [0.03, top - 0.04]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metal);
    c.position.set(x, y, z); g.add(c);
  }
  g.position.z = -0.12;
  return g;
}

// Seats the disciplinarian: start with hip joints at knee height, pose the seated
// legs, then drop the whole figure by however far the feet end up above their
// standing height, so the feet are planted. Returns the hip height and the
// flight case, cut to fit under the thighs.
function seatGiver(g, armsPose = GIVER_SEATED) {
  resetCharacter(g);
  const J = g.spec.J;
  g.target = poseQuats(GIVER_BASE, GIVER_BEAT.relaxed, armsPose);
  g.pose = {}; for (const b of BONES) { g.pose[b] = g.target[b].clone(); g.bones[b].quaternion.copy(g.pose[b]); }
  g.group.position.set(0, g.spec.Y.knee - J.thighL[1], 0);
  g.group.updateMatrixWorld(true);
  const footLift = (g.bones.footL.getWorldPosition(new THREE.Vector3()).y + g.bones.footR.getWorldPosition(new THREE.Vector3()).y) / 2 - g.spec.Y.ankle;
  g.group.position.y -= footLift;
  g.group.updateMatrixWorld(true);
  const hipY = g.spec.Y.knee - footLift;
  const rThigh = g.spec.m.thigh / 100 / (2 * Math.PI);
  // Hands resting flat on the tops of the thighs, a little over halfway to the
  // knee, fingers forward; kept in the target pose so the easing holds them there.
  if (armsPose === GIVER_SEATED) {
    for (const side of ['L', 'R']) {
      const hip = g.bones['thigh' + side].getWorldPosition(new THREE.Vector3());
      const knee = g.bones['shin' + side].getWorldPosition(new THREE.Vector3());
      const top = hip.lerp(knee, 0.6).add(new THREE.Vector3(0, rThigh * 0.95 + 0.0085 * g.spec.H, 0));
      const sh = g.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? 1 : -1;
      armIKClear(g, side, top, sh.clone().add(new THREE.Vector3(out * 0.3, -0.1, -0.3)), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
      for (const b of ['upperArm', 'forearm', 'hand']) { g.target[b + side] = g.bones[b + side].quaternion.clone(); g.pose[b + side] = g.target[b + side].clone(); }
    }
  }
  return { hipY, rThigh, bench: buildBench(hipY - rThigh * 0.99) };   // (the seat is the underside of the thighs)
}

// Two-bone IK: aims upperArm→forearm→palm at `target`, elbow bent toward `pole`.
// With `surfaceN`, the hand is laid flat on that surface: palm facing into it,
// fingers pointing along `fingers` (projected onto the surface), and the IK
// solves for the wrist so the palm centre lands on `target`.
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function basisQuat(primary, secondary) {
  const x = primary.clone().normalize();
  const y = secondary.clone().addScaledVector(x, -secondary.dot(x)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
}
// Sets the hand's world orientation, handing 60% of the roll about the forearm
// axis to the forearm itself (pronation), so the wrist doesn't twist on its own.
function setHandWorld(ch, side, qWorld) {
  const fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const rel = fo.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qWorld);
  const axis = ha.position.clone().normalize();
  const proj = axis.multiplyScalar(axis.dot(new THREE.Vector3(rel.x, rel.y, rel.z)));
  const twist = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w).normalize();
  fo.quaternion.multiply(new THREE.Quaternion().slerp(twist, 0.6));
  fo.updateMatrixWorld(true);
  ha.quaternion.copy(fo.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qWorld));
  ha.updateMatrixWorld(true);
}
// Rest-pose hand frame: fingers along the arm; the palm is the hand ellipsoid's
// thin axis, which faces the body in the A-pose (mirrored between sides).
function restHandQuat(ha, side) {
  const along = ha.position.clone().normalize();
  const u = new THREE.Vector3(along.y, -along.x, 0).normalize();
  return basisQuat(along, side === 'L' ? u : u.negate());
}

// The upper arm's anterior (biceps) side in its rest frame: forward, for both arms
// in the A-pose.
const REST_ANTERIOR = new THREE.Vector3(0, 0, 1);

// How far (radians) the upper arm must twist from its natural orientation for the
// forearm to fold toward `W` from elbow `E`: the angle between the anterior side
// carried along by the shortest rotation and the anterior side the fold requires.
function humeralTwist(ch, side, S, E, W) {
  const up = ch.bones['upperArm' + side], fo = ch.bones['forearm' + side];
  const pq = up.parent.getWorldQuaternion(new THREE.Quaternion());
  const along = E.clone().sub(S).normalize();
  const fold = W.clone().sub(E); fold.addScaledVector(along, -fold.dot(along));
  if (fold.lengthSq() < 1e-8) return 0;
  const restAlongW = fo.position.clone().normalize().applyQuaternion(pq);
  const natural = REST_ANTERIOR.clone().applyQuaternion(pq).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restAlongW, along));
  natural.addScaledVector(along, -natural.dot(along)).normalize();
  return Math.acos(clamp(natural.dot(fold.normalize()), -1, 1));
}

// `palmDir` (without a surface): fingers continue the forearm, palm faces palmDir.
// `straight`: keep the wrist straight — the hand continues the forearm exactly and
// only rolls to face the surface as closely as it can.
// `toWrist`: `target` is the wrist itself rather than the palm centre.
function armIK(ch, side, target, pole, surfaceN, fingers, palmDir, straight, toWrist) {
  const up = ch.bones['upperArm' + side], fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const palmOff = ch.spec.H * 0.106 * 0.42;
  const L1 = fo.position.length();
  let L2 = ha.position.length() + (toWrist ? 0 : palmOff);
  up.getWorldPosition(_S);
  let flatDir = null;
  if (surfaceN) {
    flatDir = (fingers ? fingers.clone() : target.clone().sub(_S));
    flatDir.addScaledVector(surfaceN, -flatDir.dot(surfaceN));
    if (flatDir.lengthSq() > 1e-6) {
      flatDir.normalize();
      target = target.clone().addScaledVector(flatDir, -palmOff);
      L2 -= palmOff;
    } else flatDir = null;
  }
  _d.copy(target).sub(_S);
  const dist = clamp(_d.length(), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  _d.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  _p.copy(pole).sub(_S);
  _p.addScaledVector(_d, -_p.dot(_d)).normalize();
  _E.copy(_S).addScaledVector(_d, a).addScaledVector(_p, h);
  // Upper arm as a hinge: point it along S→E and twist it so its anterior (biceps)
  // side faces the way the forearm folds. The forearm below then bends only about
  // the elbow's hinge axis, so the elbow can never bend backwards.
  up.parent.getWorldQuaternion(_q).invert();
  const alongP = _E.clone().sub(_S).normalize().applyQuaternion(_q);
  const foldP = _S.clone().addScaledVector(_d, dist).sub(_E).applyQuaternion(_q);
  foldP.addScaledVector(alongP, -foldP.dot(alongP));
  const restAlong = fo.position.clone().normalize();
  if (foldP.lengthSq() > 1e-8) {
    up.quaternion.copy(basisQuat(alongP, foldP.normalize()).multiply(basisQuat(restAlong, REST_ANTERIOR).invert()));
  } else {
    up.quaternion.setFromUnitVectors(restAlong, alongP);   // straight arm: no fold to orient
  }
  up.updateMatrixWorld(true);
  // Forearm: rotate its rest direction (toward the wrist) onto E→target.
  fo.parent.getWorldQuaternion(_q).invert();
  _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().applyQuaternion(_q);
  fo.quaternion.setFromUnitVectors(ha.position.clone().normalize(), _v);
  fo.updateMatrixWorld(true);
  ha.quaternion.identity();
  let qWant = null;
  const foreDir = _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().clone();
  if (flatDir && straight) qWant = basisQuat(foreDir, surfaceN.clone().negate());
  else if (flatDir) qWant = basisQuat(flatDir, surfaceN.clone().negate());
  else if (palmDir) {
    const along = _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().clone();
    qWant = basisQuat(along, palmDir);
  }
  if (qWant) setHandWorld(ch, side, qWant.multiply(restHandQuat(ha, side).invert()));
}

// Rotates a bone by a world-space rotation (works under rotated parents).
function rotateBoneWorld(bone, q) {
  const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const bw = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(pw.clone().invert().multiply(q).multiply(bw));
  bone.updateMatrixWorld(true);
}
// Turns the face (head +Z) toward `target`: 40% through the neck, the rest in the
// head, capped so the look stays anatomically plausible.
function lookAt(ch, target, maxAngle = 1.0) {
  for (const [bone, share] of [[ch.bones.neck, 0.4], [ch.bones.head, 1]]) {
    const head = ch.bones.head;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    const want = target.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();
    const full = new THREE.Quaternion().setFromUnitVectors(fwd, want);
    const angle = 2 * Math.acos(clamp(full.w, -1, 1));
    const t = share * Math.min(1, maxAngle / Math.max(angle, 1e-6));
    rotateBoneWorld(bone, new THREE.Quaternion().slerp(full, Math.min(t, 1)));
    maxAngle -= angle * t;
    if (maxAngle <= 0) break;
  }
}

const easeIn = x => x * x * x, easeOut = x => 1 - (1 - x) ** 3, easeInOut = x => x * x * (3 - 2 * x);

// Creates the scene with `g` as disciplinarian and `s` as subject, adds the flight
// case to `parent`, and returns its state. Swing modes:
//   'beat'   — hold a beat ('relaxed' | 'raised' | 'contact'), easing between them;
//   'loop'   — run the timing loop (lift → hold raised → strike → hold on contact);
//   'driven' — the caller moves the arm with raise() / strike() / lower().
// `impacts` counts strikes as they land; `onImpact(side, strength)` fires with each.
// Where the subject's pelvis rests: this far from hip to knee along the right thigh,
// and this fraction of its front depth above the thigh's top (below 1 settles in).
const LAP_ALONG = 0.78, LAP_SETTLE = 0.9;
// ── Across the lap, built from anchors ───────────────────────────
// Everything about the subject's pose here follows from where she starts (the hip anchored on the giver's right thigh, angled a little forward to present the
// contact sites) and what she meets: the torso bends forward until it touches the giver's left thigh; the hips and knees bend until the toes meet the floor.
// The joint angles that result are her base pose; the reaction to a stroke is a change from them (see lapReact), and the hands go to the floor each frame as before.
const LAP_BACK_X = -0.06;      // her hips sit this far back along the lap (m, for a 1.7 m subject): clear of the giver's torso, room for a skirt between the thighs
const LAP_TOUCH = 0.003;       // the torso counts as touching the thigh this close
function twoBoneTo(ch, [a, b, c], target, pole = null) {
  const A = ch.bones[a], B = ch.bones[b], C = ch.bones[c], pa = A.getWorldPosition(new THREE.Vector3()), pb = B.getWorldPosition(new THREE.Vector3()), pc = C.getWorldPosition(new THREE.Vector3());
  const L1 = pa.distanceTo(pb), L2 = pb.distanceTo(pc), d = target.clone().sub(pa), dist = clamp(d.length(), Math.abs(L1 - L2) + 1e-4, (L1 + L2) * 0.9999); d.normalize();
  const bend = (pole || pb.clone().sub(pa)).clone(); bend.addScaledVector(d, -bend.dot(d)); if (bend.lengthSq() < 1e-10) bend.set(0, 1, 0).cross(d); bend.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), E = pa.clone().addScaledVector(d, L1 * cosA).addScaledVector(bend, L1 * Math.sqrt(1 - cosA * cosA));
  rotateBoneWorld(A, new THREE.Quaternion().setFromUnitVectors(pb.clone().sub(pa).normalize(), E.sub(pa).normalize()));
  const pb2 = B.getWorldPosition(new THREE.Vector3()), pc2 = C.getWorldPosition(new THREE.Vector3()), Tg = pa.clone().addScaledVector(d, dist);
  rotateBoneWorld(B, new THREE.Quaternion().setFromUnitVectors(pc2.sub(pb2).normalize(), Tg.sub(pb2).normalize()));
}
function lapDominantVerts(ch, pick) {   // a sample of the skin vertices whose strongest bone passes `pick`
  const g = ch.mesh.geometry, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, out = [];
  for (let v = 0; v < si.length / 4; v += 3) { let bw = -1, bb = 0; for (let m = 0; m < 4; m++) if (sw[4 * v + m] > bw) { bw = sw[4 * v + m]; bb = si[4 * v + m]; } if (pick(BONES[bb])) out.push(v); }
  return out;
}
function posedBoneCone(ch, bone) {   // the thigh (or any limb) cone of a character, posed, straight from its body spec
  const P = ch.spec.prims.find(q => q.type === 'cone' && q.bone === bone); if (!P) return null;
  const m = ch.bones[bone].matrixWorld.clone().multiply(ch.mesh.skeleton.boneInverses[BONES.indexOf(bone)]);
  const a = new THREE.Vector3(...P.a).applyMatrix4(m).toArray(), b = new THREE.Vector3(...P.b).applyMatrix4(m).toArray(), C = cone(a, b, P.r1, P.r2);
  C.sc = mul(add3(a, b), 0.5); C.sr = len3(sub(b, a)) / 2 + Math.max(P.r1, P.r2); return C;
}
function solveLap(scn, g, s) {
  const sc = s.spec.H / 1.7, v = new THREE.Vector3();
  const skin = i => { v.fromBufferAttribute(s.mesh.geometry.attributes.position, i); s.mesh.boneTransform(i, v); return v.applyMatrix4(s.mesh.matrixWorld); };
  const setBones = o => { for (const b in o) s.bones[b].quaternion.copy(degQ(o[b])); s.group.updateMatrixWorld(true); };
  const base = SUBJECT_BASE;
  // 1. The torso bends forward from the anchored hip until it rests on the giver's left thigh.
  const thighL = posedBoneCone(g, 'thighL');   // the giver's left thigh
  const torso = lapDominantVerts(s, n => n === 'spine2' || n === 'spine1').filter(i => { const p = new THREE.Vector3().fromBufferAttribute(s.mesh.geometry.attributes.position, i), J = s.spec.J.pelvis; return p.y > J[1] + 0.12 * s.spec.H; });   // (the ribs and chest, which the bend moves; not the hips, which are anchored)
  // Her torso rests on the thigh: the bend at which the nearest point of her ribs and belly just touches it (sunk in at 0° → straightened until clear; short of it → bent forward until it arrives).
  const gap = bend => { setBones({ spine1: [base.spine1[0] + 0.55 * bend, 0, 0], spine2: [base.spine2[0] + 0.45 * bend, 0, 0] }); let m = Infinity; if (thighL) for (const i of torso) { const d = primDist(skin(i).toArray(), thighL); if (d < m) m = d; } return m; };
  // Her weight is on the thighs: lifted until no part of her skin is more than a hair inside either of the giver's thighs (the contact shader takes up the rest).
  const thighR = posedBoneCone(g, 'thighR'), hipVerts = lapDominantVerts(s, n => n === 'pelvis');
  const hipGap = () => { let m = Infinity; if (thighR) for (const i of hipVerts) { const d = primDist(skin(i).toArray(), thighR); if (d < m) m = d; } return m; };   // how far her hips are off (+) or in (−) the right thigh
  let bend = 0;
  // The whole body tips forward about the anchored hip as far as it comfortably can, so the spine itself stays as straight as it will lie: the tilt at which the torso
  // just meets the thigh with its natural curve (no arching up to meet it, no folding down onto it).
  const A = scn.lapAnchor;
  const setTilt = t => {
    const c = Math.cos(t), sn = Math.sin(t);
    s.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(c, -sn, 0), new THREE.Vector3(-sn, -c, 0)));
    s.group.updateMatrixWorld(true);
    const pl = new THREE.Vector3(...s.spec.J.pelvis).applyQuaternion(s.group.quaternion);
    s.group.position.copy(A.pelvisAt).sub(pl); s.group.updateMatrixWorld(true);
    setBones({ spine1: [base.spine1[0], 0, 0], spine2: [base.spine2[0], 0, 0] });
  };
  const fitTilt = () => {
    if (!(A && thighL)) return;
    let lo = -0.6, hi = 0.9;   // gap(0) > touch: the torso hangs above the thigh (tip further forward); below it, it is sunk in (tip back)
    for (let it = 0; it < 9; it++) { const mid = (lo + hi) / 2; setTilt(mid); if (gap(0) > LAP_TOUCH) lo = mid; else hi = mid; }
    A.tilt = (lo + hi) / 2; setTilt(A.tilt);
  };
  const lower = m => { s.group.position.y -= m; if (A) A.pelvisAt.y -= m; s.group.updateMatrixWorld(true); };
  const findBend = () => {   // (the tilt did the work: the spine stays at its natural curve unless the torso still misses the thigh by more than a few mm)
    fitTilt(); const g0 = gap(0);
    if (g0 < LAP_TOUCH + 0.006 && g0 > -0.004) { bend = 0; gap(0); return; }
    if (g0 < 0) { for (bend = 0; bend > -90 && gap(bend) < LAP_TOUCH * 0.5; bend -= 1); } else { for (bend = 0; bend < 80 && gap(bend) > LAP_TOUCH; bend += 1); }
    gap(bend);
  };
  for (let round = 0; round < 8; round++) {
    findBend(); const m = hipGap();
    if (Math.abs(m) < 0.003) break;
    lower(m);   // down onto the thigh if she hangs above it, up out of it if she is sunk in
  }
  findBend();
  const pose = { spine1: [base.spine1[0] + 0.55 * bend, 0, 0], spine2: [base.spine2[0] + 0.45 * bend, 0, 0] };
  setBones(pose);
  // 2. The hips and knees bend until the toes touch the floor: each leg reaches an ankle height at which the lowest point of the foot, plantar-flexed, is on the floor.
  const feetVerts = { L: lapDominantVerts(s, n => n === 'footL'), R: lapDominantVerts(s, n => n === 'footR') };
  const solveLegs = () => {
  for (const side of ['L', 'R']) {
    const hip = s.bones['thigh' + side].getWorldPosition(new THREE.Vector3()), kn = s.bones['shin' + side].getWorldPosition(new THREE.Vector3()), an0 = s.bones['foot' + side].getWorldPosition(new THREE.Vector3());
    const Ltot = hip.distanceTo(kn) + kn.distanceTo(an0), dir = new THREE.Vector3(an0.x - hip.x, 0, an0.z - hip.z); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize();
    let ankleY = 0.07 * sc, best = null;
    for (let it = 0; it < 10; it++) {
      const horiz = Math.sqrt(Math.max(1e-4, (0.92 * Ltot) ** 2 - (hip.y - ankleY) ** 2));
      const reach = new THREE.Vector3(hip.x + dir.x * horiz, ankleY, hip.z + dir.z * horiz);
      // the knee folds the one way it can: toward the front of the thigh (the thigh's own forward axis), never backward
      twoBoneTo(s, ['thigh' + side, 'shin' + side, 'foot' + side], reach, new THREE.Vector3(0, 0, 1).applyQuaternion(s.bones['thigh' + side].getWorldQuaternion(new THREE.Quaternion())));
      // the toes down: pitch the foot about its own x until its lowest point is lowest (whichever way is plantar flexion)
      let pick = null;
      for (const sg of [1, -1]) { s.bones['foot' + side].quaternion.copy(degQ([sg * 55, 0, 0])); s.group.updateMatrixWorld(true); let lo = Infinity; for (const i of feetVerts[side]) lo = Math.min(lo, skin(i).y); if (!pick || lo < pick.lo) pick = { sg, lo }; }
      s.bones['foot' + side].quaternion.copy(degQ([pick.sg * 55, 0, 0])); s.group.updateMatrixWorld(true);
      ankleY -= pick.lo - 0.0005;   // lift or lower the ankle by what the toe is off the floor
      best = pick;
    }
  }
  };
  // the legs move the hip skin as they turn, so the hips' contact with the thigh and the legs are settled together
  const bendTorso = findBend;
  for (let k = 0; k < 6; k++) {
    solveLegs(); bendTorso();   // (turning the legs and bending the torso each move the hip skin a little, so they are settled together)
    const m = hipGap(); if (Math.abs(m) < 0.003 && gap(bend) <= LAP_TOUCH * 1.5) break;
    lower(m);
  }
  solveLegs();
  // 3. Bake: the poses are these joint angles; the reaction is a change from them.
  const rest = new THREE.Quaternion(), baseQ = {}, deltas = {};
  for (const b of BONES) baseQ[b] = s.bones[b].quaternion.clone();
  const oldBase = SUBJ_BASE_Q, reactL = SUBJ_REACT_Q.L, reactR = SUBJ_REACT_Q.R;
  const react = { L: {}, R: {}, B: {} };
  for (const k of ['L', 'R']) for (const b of BONES) { const D = oldBase[b].clone().invert().multiply(SUBJ_REACT_Q[k][b]); react[k][b] = baseQ[b].clone().multiply(D); }
  for (const b of BONES) react.B[b] = react.L[b].clone().slerp(react.R[b], 0.5);
  scn.baseQ = baseQ; scn.reactQ = react;
  s.target = baseQ; s.pose = {}; for (const b of BONES) s.pose[b] = baseQ[b].clone();
  scn.lapSolved = { bend, torsoTouch: !!thighL, thighCone: thighL ? { a: thighL.a, b: thighL.b, r1: thighL.r1, r2: thighL.r2 } : null };
}

// opts.lower (default true): lower the subject's bottoms to the knees for the correction.
function createDisciplineScene(parent, g, s, opts = {}) {
  const scn = { mode: 'beat', impacts: 0, timing: { ...DEFAULT_TIMING }, plant: {}, reactSide: 'L', palmAim: 0.65,
    beat: 'relaxed', side: 'L', g, s, bench: null, reaction: 0, loopT: 0, handR: null, handL: null, swing: 0,
    fitCache: {}, onImpact: null, dv: null, pendingFlip: false, raisedT: 0, faces: !!opts.faces, severity: opts.severity != null ? opts.severity : null,
    pain: opts.pain ? createPain(typeof opts.pain === 'object' ? opts.pain : { tolerance: s.spec.m.tolerance, resilience: s.spec.m.resilience }) : null,
    atCase: opts.position === 'case' || opts.position === 'head' || opts.position === 'knees' || opts.position === 'spread', atHead: opts.position === 'head', atKnees: opts.position === 'knees' || opts.position === 'spread', atSpread: opts.position === 'spread', baseQ: SUBJ_BASE_Q, reactQ: SUBJ_REACT_Q, giverBaseQ: GIVER_Q, giverBase: GIVER_BASE, giverBeat: GIVER_BEAT };
  const atCase = scn.atCase, atHead = scn.atHead, atKnees = scn.atKnees;
  scn.wideContact = WIDE_CONTACT; scn.wideRaised = WIDE_RAISED; scn.wideRest = null;
  if (atCase) { scn.wideContact = CASE_WIDE_CONTACT; scn.wideRaised = caseWideRaised(); scn.wideRest = caseWideRest(); scn.baseQ = CASE_SUBJ_BASE_Q; scn.reactQ = CASE_SUBJ_REACT_Q; scn.giverBaseQ = CASE_GIVER_Q; scn.giverBase = CASE_GIVER_BASE; scn.giverBeat = CASE_GIVER_BEAT; }
  if (atKnees) { scn.giverBaseQ = KNEES_GIVER_Q; scn.giverBeat = KNEES_GIVER_BEAT; scn.wideContact = { ...CASE_WIDE_CONTACT, roll: KNEES_ROLL };
    { const R = caseWideRest(), sc = 1; scn.wideRest = { ...R, face: [R.face[0] + KNEES_PADDLE_REST.dface[0], R.face[1] + KNEES_PADDLE_REST.dface[1], R.face[2] + KNEES_PADDLE_REST.dface[2]], elbow: KNEES_PADDLE_REST.elbow }; } scn.baseQ = KNEES_BASE_Q; scn.reactQ = KNEES_REACT_Q; scn.buckQ = KNEES_PADDLE_Q; }   // (the paddle's rise is the body's, in kneesBody)
  if (scn.atSpread) { scn.giverBaseQ = SPREAD_GIVER_Q; scn.giverBeat = SPREAD_GIVER_BEAT; scn.wideRest = { ...SPREAD_PADDLE_REST, face: [...SPREAD_PADDLE_REST.face] }; }
  if (atHead) {
    scn.baseQ = HEAD_SUBJ_BASE_Q; scn.reactQ = HEAD_SUBJ_REACT_Q; scn.buckQ = HEAD_BUCK_Q; scn.giverBaseQ = HEAD_GIVER_Q; scn.giverBeat = HEAD_GIVER_BEAT;
    scn.wideRaised = caseWideRaised(HEAD_YAW_STRIKE); scn.wideRest = caseWideRest(HEAD_YAW_RELAXED);
  }
  const seat = atCase ? null : seatGiver(g);
  if (atCase) {
    // Standing at the subject's left, turned toward the subject's hips.
    resetCharacter(g);
    g.target = scn.giverBaseQ[scn.beat];
    g.pose = {}; for (const b of BONES) { g.pose[b] = g.target[b].clone(); g.bones[b].quaternion.copy(g.pose[b]); }
    const at = atHead ? HEAD_GIVER_AT : scn.atSpread ? SPREAD_GIVER_AT : CASE_GIVER_AT;
    standAt(g, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (atHead ? HEAD_YAW_RELAXED : scn.atSpread ? SPREAD_YAW : CASE_YAW) * Math.PI / 180),
      new THREE.Vector3(at[0], g.spec.J.pelvis[1], at[1]));
  } else {
    g.target = GIVER_Q[scn.beat];
    scn.bench = seat.bench;
    parent.add(scn.bench);
  }

  // A skirt comes off for the correction (see setSkirtOff): pressed between two bodies
  // whose skin the contact shader compresses on the GPU, the cloth can't be kept out of
  // either. It goes back on when the scene is disposed.
  setSkirtOff(s, true);
  // Shorts or leggings go down to the knees for the correction, back up afterwards.
  if (opts.lower !== false) setLowered(s, 'bottom', true);
  // Subject: face-down, head end dipping toward the floor, pelvis resting on the
  // centre line of the disciplinarian's right thigh, LAP_ALONG of the way from hip
  // to knee: nearer the knees than the torso, so the bodies meet over the thighs
  // rather than the subject's hips pressing into the disciplinarian's middle. The
  // height is the thigh's own top there (it thins toward the knee), less a little
  // for the weight settling in; the contact shader takes up the rest.
  resetCharacter(s);
  s.target = scn.baseQ;
  s.pose = {}; for (const b of BONES) s.pose[b] = s.target[b].clone();
  if (atHead) {
    // Standing free: upright, facing +X (local +X is the subject's left, world −Z, as in the lap).
    for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
    standAt(s, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(0, s.spec.J.pelvis[1], 0));
    scn.subjBaseY = s.group.position.y;
    scn.subjBasePos = s.group.position.clone(); scn.subjBaseQ = s.group.quaternion.clone();
    const fa = s.bones.footL.getWorldPosition(new THREE.Vector3()), fb = s.bones.footR.getWorldPosition(new THREE.Vector3());
    scn.feetPivot = new THREE.Vector3((fa.x + fb.x) / 2, 0, (fa.z + fb.z) / 2);
    const hp = s.spec.prims.find(P => P.bone === 'head' && P.tag === 'head');
    scn.headPrim = { c: new THREE.Vector3(...hp.c).sub(new THREE.Vector3(...s.spec.J.head)), r: new THREE.Vector3(...hp.r) };
  } else if (atCase) {
    // Bent over the case: pitched forward about the hips, facing +X (local +X is the
    // subject's left, world −Z, as in the lap).
    for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (atKnees ? KNEES_PITCH : CASE_PITCH) * Math.PI / 180));
    standAt(s, q, new THREE.Vector3(0, s.spec.J.pelvis[1], 0));
    scn.subjBasePos = s.group.position.clone();
    if (atKnees) {
      // What the legs are solved against: the pelvis and the planted ankles, as stood.
      scn.kneesPelvis = s.bones.pelvis.getWorldPosition(new THREE.Vector3());
      scn.kneesAnkle = { L: s.bones.footL.getWorldPosition(new THREE.Vector3()), R: s.bones.footR.getWorldPosition(new THREE.Vector3()) };
    }
    if (!atKnees) {
    // The lid is set from the subject's own height, and runs from just short of the palms
    // to well past them.
    scn.caseTop = opts.caseHeight || s.spec.Y.hipJoint * 0.88;
    const pL = casePalm(s, 'L', scn.caseTop), pR = casePalm(s, 'R', scn.caseTop);
    scn.bench = buildCase(scn.caseTop, Math.min(pL.x, pR.x) - 0.3, Math.max(pL.x, pR.x) + 0.4);
    parent.add(scn.bench);
    }
  } else {
  const tilt = 0.28, c = Math.cos(tilt), sn = Math.sin(tilt);
  const R = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(c, -sn, 0), new THREE.Vector3(-sn, -c, 0));
  s.group.quaternion.setFromRotationMatrix(R);
  const hipRing = loftRing(s.spec.prims[0], s.spec.Y.hip);
  const onThigh = g.bones.thighR.getWorldPosition(new THREE.Vector3()).lerp(g.bones.shinR.getWorldPosition(new THREE.Vector3()), LAP_ALONG);
  const rHere = lerp(seat.rThigh, g.spec.m.knee / 100 / (2 * Math.PI), LAP_ALONG);
  const pelvisAt = new THREE.Vector3(onThigh.x + LAP_BACK_X * (s.spec.H / 1.7), onThigh.y + rHere + hipRing[1] * LAP_SETTLE, onThigh.z);
  const pelvisLocal = new THREE.Vector3(...s.spec.J.pelvis).applyQuaternion(s.group.quaternion);
  s.group.position.copy(pelvisAt).sub(pelvisLocal);
  scn.lapAnchor = { pelvisAt: pelvisAt.clone(), tilt };
  for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
  s.group.updateMatrixWorld(true);
  g.group.updateMatrixWorld(true);
  solveLap(scn, g, s);
  }
  scn.anchors = sceneAnchors(s);
  if (scn.atSpread) {
    // The disciplinarian's left hand rests on the curve of their own left hip: a skinned point on the side of the pelvis
    // just below the waist, taken once in rest space, with its outward normal.
    const sp = g.spec, J = sp.J, H = sp.H, pt = [0, sp.Y.hip - 0.02 * H, 0];
    for (let i = 0; i < 400 && field(sp, pt) < 0; i++) pt[0] += 0.001;
    const n = norm(gradient(sp, pt, 0.0015, field(sp, pt))), pos = g.mesh.geometry.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3(...pt);
    let index = 0, best = Infinity;
    for (let i = 0; i < pos.count; i++) { const d = v.fromBufferAttribute(pos, i).distanceToSquared(q); if (d < best) { best = d; index = i; } }
    scn.hipL = { index, n: new THREE.Vector3(...n), bone: 'pelvis' };
  }

  // The disciplinarian's pose for a beat, with the implement's own layer if it has one.
  const giverQCache = {};
  scn.giverQ = beat => {
    const layers = scn.implement && (scn.atHead || scn.atSpread ? null : scn.atCase ? IMPLEMENTS[scn.implement].giverCase : IMPLEMENTS[scn.implement].giver);
    const L = layers && layers[beat];
    if (!L) return scn.giverBaseQ[beat];
    const k = scn.implement + beat;
    return giverQCache[k] || (giverQCache[k] = poseQuats(scn.giverBase, scn.giverBeat[beat], L));
  };
  scn.setBeat = beat => { scn.mode = 'beat'; scn.beat = beat; g.target = scn.giverQ(beat); };
  scn.setLoop = on => { scn.mode = on ? 'loop' : 'beat'; scn.loopT = 0; if (!on) scn.setBeat(scn.beat); };
  // Driven swing: move from wherever the arm is to `to` over `dur` seconds.
  const moveTo = (to, dur, ease, onArrive) => {
    scn.mode = 'driven';
    scn.dv = { from: scn.swing, to, t: 0, dur: Math.max(dur, 1e-3), ease, onArrive };
  };
  // Lift to the raised position. Coming up from contact, the side alternates at the top.
  scn.raise = (dur = scn.timing.lift / scn.timing.speed, then = null) => {
    scn.pendingFlip = scn.swing > 1.5;
    moveTo(1, dur, easeOut, () => { if (scn.pendingFlip) scn.side = scn.side === 'L' ? 'R' : 'L'; scn.pendingFlip = false; if (then) then(); });
  };
  // One full smack from wherever the arm is: lift, then strike the next contact site
  // (alternating from the second), and hold there until the next call.
  // `hold` keeps the arm raised that long before the strike.
  // (Past too harsh no further stroke starts, under any circumstance.)
  scn.cycle = (strength = 1, lift = scn.timing.lift / scn.timing.speed, strike = scn.timing.strike / scn.timing.speed, hold = 0) =>
    scn.pain && scn.pain.tooHarsh ? null : scn.raise(lift, () => hold > 0 ? moveTo(1, hold, easeInOut, () => scn.strike(strength, strike)) : scn.strike(strength, strike));
  // True while the arm is still travelling (a cycle hasn't landed yet).
  scn.busy = () => !!(scn.dv && scn.dv.onArrive);
  // A smack lands: with a pain model (opts.pain) the subject's reaction comes from it (the implement, strength, how fast the
  // swing, how long the arm waited raised, how tender the skin already is), otherwise from `strength` as it always did.
  scn.land = strength => {
    const waited = scn.raisedT; scn.raisedT = 0; scn.lastStrength = strength;
    if (!scn.pain) return strength;
    const mk = s.marks, tender = mk ? Math.max(mk.L.f || 0, mk.R.f || 0) : 0;
    scn.lastHit = scn.pain.hit({ implement: scn.implement, strength, speed: scn.timing.speed, raised: waited, tender, cushion: clothCushion(s) });
    return scn.lastHit.reaction;
  };
  // Strike from wherever the arm is. `strength` (0–1) scales the subject's reaction.
  scn.strike = (strength = 1, dur = scn.timing.strike / scn.timing.speed) => {
    scn.pendingFlip = false;
    moveTo(2, dur, easeIn, () => {
      scn.reaction = Math.max(scn.reaction, scn.land(strength)); scn.reactSide = scn.reactKey(); scn.impacts++; scn.mark(scn.side);
      if (scn.onImpact) scn.onImpact(scn.side, strength);
    });
  };
  // Back to resting on the thigh.
  scn.lower = (dur = 0.6) => { scn.pendingFlip = false; moveTo(0, dur, easeInOut); };
  // Each landed smack builds up the mark on that side (see addMark); a wide implement
  // marks both sides, each at its own site.
  scn.mark = side => {
    if (scn.noMarks) return;   // (a base position that leaves the skin's colour alone)
    const w = IMPLEMENTS[scn.implement].mark;
    if (scn.tool && scn.tool.rod) { const F = scn.lastStrike; if (F && F.skin) addStripe(s, F.skin, F.a, scn.tool.halfLen); return; }
    if (scn.tool && scn.tool.wide) { const F = scn.lastStrike; if (F && F.skinL) { addMark(s, 'L', F.skinL, w); addMark(s, 'R', F.skinR, w); } return; }
    const C = scn.fitCache[side]; if (C && C.fit && C.fit.skin) addMark(s, side, C.fit.skin, w);
  };
  // The reaction's side: the one struck, or 'B' (centred) when a wide implement covers both.
  scn.reactKey = () => scn.tool && scn.tool.wide ? 'B' : scn.side;
  // The implement in the disciplinarian's right hand ('hand' for none; see IMPLEMENTS).
  scn.implement = 'hand'; scn.tool = null;
  scn.setImplement = name => {
    if (!IMPLEMENTS[name] || (scn.atSpread && !IMPLEMENTS[name].dual)) name = scn.atSpread ? 'paddle' : 'hand';
    if (scn.tool) { scn.tool.grp.parent.remove(scn.tool.grp); scn.tool.grp.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    scn.implement = name;
    scn.rodT = rodRoll();   // (the rod's height, 0 the lowest strike to 11 the highest; redrawn each lift)
    scn.buck = !!(scn.atCase && name === 'paddle');   // standing positions: the paddle's reaction differs (HEAD_BUCK, CASE_BUCK)
    if (scn.atCase && !scn.atHead && !scn.atKnees) scn.buckQ = CASE_BUCK_Q;
    scn.tool = IMPLEMENTS[name].build ? IMPLEMENTS[name].build(g) : null;
    scn.toolFix = {}; scn.fitCache.B = null; scn.handQ = null;
    // The rod's own contact settings (ROD_CONTACT), restored for any other implement.
    if (!scn.contact0) scn.contact0 = scn.wideContact;
    const rc = name === 'rod' ? ROD_CONTACT[scn.atHead ? 'head' : scn.atKnees ? 'knees' : scn.atCase ? 'case' : 'lap'] : null;
    if (!scn.raised0) scn.raised0 = scn.wideRaised;
    scn.wideRaised = name === 'rod' && scn.atSpread ? { ...scn.raised0, ...ROD_RAISED_SPREAD } : scn.raised0;
    scn.wideContact = rc ? { ...scn.contact0, ...(rc.roll != null ? { roll: rc.roll, keepRoll: true } : {}), elbow: rc.elbow } : scn.contact0;
    if (scn.atHead) {
      const shift = rc && rc.at ? [rc.at[0] - HEAD_GIVER_AT[0], rc.at[1] - HEAD_GIVER_AT[1]] : [0, 0], was = scn.giverShift || [0, 0];
      g.group.position.x += shift[0] - was[0]; g.group.position.z += shift[1] - was[1]; scn.giverShift = shift;
      scn.yawStrike = rc && rc.yawStrike != null ? rc.yawStrike : HEAD_YAW_STRIKE;
      g.group.updateMatrixWorld(true);
    }
    // Middle and end finger joints closed round the handle (or straightened again).
    setFingerBend(g, 'R', scn.tool ? (scn.tool.grip || IMPLEMENTS[name].grip).bend : 0);
    if (scn.tool && scn.curl) scn.curl.R = (scn.tool.grip || IMPLEMENTS[name].grip).curl;
    if (scn.mode === 'beat') g.target = scn.giverQ(scn.beat);
  };
  scn.update = dt => updateScene(scn, dt);
  scn.dispose = () => {
    if (scn.bench) { parent.remove(scn.bench); scn.bench.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    scn.bench = null;
    for (const ch of [g, s]) { const u = ch.mesh.material.userData.uniforms; u.uPressAmt.value = 0; u.uPressAmt2.value = 0; u.uCapN.value = 0; }
    setSkirtOff(s, false);
    setLowered(s, 'bottom', false);
    scn.setImplement('hand');   // the implement is put down
  };
  return scn;
}


// ════════════════════════════════════════════════════════════════
// FACES in the discipline scene (opts.faces). Two layers of expression, set each frame from the scene (faceState) and
// layered with setMoods:
//   the subject — a slow baseline from how worked up they are (the model's distress and how hard recent smacks landed:
//     composed → strain → distress), with the fast beats on top: dread while the arm waits raised, a wince at contact
//     (as sharp as the sting that got through the clothing), a breath out after. Tolerance masks it (a stoic face holds
//     until they're near their limit), a low tolerance shows early; `expressive` on a preset scales it.
//   the disciplinarian — their severity: calm (light) → focused (medium) → stern (firm, severe), with effort on the swing,
//     and an easing of the face as the subject nears too harsh. `scn.severity` (0–1) sets it, otherwise it follows
//     the strikes' strength and speed. `expressive` scales it per character.
// Glances (relative animation, the anchored poses stay put): the eyes, and a little of the head and neck, turn to the
// other's face and back — the subject peeks back as the arm waits and after a smack, the disciplinarian checks the
// subject's face as the arm rises and reads their reaction after a landing (longer for firmer correction) and keeps looking
// as the subject nears too harsh. The subject's head also tosses a little on contact.
// ════════════════════════════════════════════════════════════════
const FACE = {
  HEAT_TAU: 8, WINCE_TAU: 1.1,
  SUBJ_HEAD_CAP: 0.5, GIVER_HEAD_CAP: 0.6, HEAD_FLINCH: 0.1,   // radians
  EYE_GAIN: 2.2,
};
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const glanceW = G => { if (!G) return 0; const t = G.f.t - G.t0; return t < 0 || t > G.dur ? 0 : Math.min(1, t / 0.25, (G.dur - t) / 0.35); };
const LEG_BONES = new Set(['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']);
function faceState(scn, dt) {
  const g = scn.g, s = scn.s, P = scn.pain;
  const f = scn.fx || (scn.fx = { t: 0, heat: 0, wince: 0, since: 9, impacts: 0, ps: 0, exert: 0, sG: null, gG: null, sGw: 0, gGw: 0 });
  f.t += dt; f.since += dt;
  const swing = scn.swing, prev = f.ps;
  f.wince *= Math.exp(-dt / FACE.WINCE_TAU); f.heat *= Math.exp(-dt / FACE.HEAT_TAU);
  const d = P ? P.distress() : 0;
  const sev = scn.severity != null ? scn.severity : clamp(0.75 * (scn.lastStrength != null ? scn.lastStrength : 0.5) + 0.25 * clamp((scn.timing.speed - 0.6) / 1.0, 0, 1), 0, 1);
  const L = clamp(f.heat * 0.85 + d * 1.6, 0, 1);     // how worked up they look
  const tol = P ? P.stats.tolerance : (s.spec.m.tolerance != null ? s.spec.m.tolerance : 0.5);
  // The subject's mask: stoic holds until near the limit; low tolerance shows early.
  const sA = clamp((1 - 0.35 * clamp((tol - 0.4) / 0.4, 0, 1) * (1 - ss(0.25, 0.6, L))) * (1 + 0.25 * clamp((0.5 - tol) / 0.3, 0, 1)) * (s.spec.m.expressive != null ? s.spec.m.expressive : 1), 0, 1.15);
  const gA = clamp(g.spec.m.expressive != null ? g.spec.m.expressive : 1, 0, 1.2);

  // A smack landed.
  if (scn.impacts !== f.impacts) {
    f.impacts = scn.impacts; f.since = 0;
    const h = scn.lastHit, r = h ? h.reaction : scn.reaction;
    let share = 0.5;
    if (P && P.last) share = P.last.sting / Math.max(1e-6, P.last.sting + P.last.ache);
    f.wince = Math.max(f.wince, Math.min(1, 1.6 * r * (0.35 + 0.65 * Math.min(1, share * 1.6))));
    f.heat += (r - f.heat) * 0.5;
    // The disciplinarian reads the reaction (a longer look for firmer correction); the subject looks back once the sting passes, if composed.
    if (Math.random() < 0.5 * (1 - ss(0.4, 0.8, L))) f.sG = { f, t0: f.t + 0.9 + Math.random() * 0.7, dur: 0.7 + Math.random() * 0.5 };
  }
  // The arm comes up: the disciplinarian checks the subject's face; the subject may peek back.
  if (swing > 0.6 && prev <= 0.6) {
    if (Math.random() < 0.65 * (1 - ss(0.5, 0.9, L))) f.sG = { f, t0: f.t + 0.3 + Math.random() * 0.5, dur: 0.7 + Math.random() * 0.5 };
  }
  f.ps = swing;
  const striking = swing > 1.05 && swing < 1.95 && swing >= prev - 1e-6;
  const ease = P ? Math.max(ss(1.1, PAIN.TOO_HARSH, d), P.tooHarsh ? 1 : 0) : 0;
  // The disciplinarian watches the contact sites while the arm is up and down (with now and then a glance at the subject's head, on a clock of its own and not tied to the smacks),
  // and looks at the subject's head when at rest.
  if (f.gNext == null) f.gNext = f.t + 3 + Math.random() * 4;
  if (f.t >= f.gNext) { f.gG = { f, t0: f.t, dur: 0.7 + Math.random() * 0.7 }; f.gNext = f.t + 4 + Math.random() * 6; }
  let gT = glanceW(f.gG); if (swing > 1.05 && swing < 1.95) gT = 0; if (swing < 0.3) gT = 1; gT = Math.max(gT, 0.85 * ease);
  let sT = glanceW(f.sG) * (1 - ss(0.75, 1.0, L));   // at the edge, eyes shut: no peeking
  f.gGw += (gT - f.gGw) * (1 - Math.exp(-dt * 7)); f.sGw += (sT - f.sGw) * (1 - Math.exp(-dt * 7));

  // Subject moods.
  const dread = ss(0.45, 1, swing) * (swing <= 1.02 ? 1 : 1 - ss(1.02, 1.35, swing)) * (0.45 + 0.55 * Math.min(1, scn.raisedT / 0.9));
  const exhale = ss(0.7, 1.2, f.since) * (1 - ss(1.8, 2.8, f.since)) * (0.3 + 0.7 * Math.min(1, L * 2)) * (1 - dread);
  setMoods(s, { dread: dread * (0.6 + 0.4 * sA), wince: f.wince * sA, strain: ss(0.12, 0.4, L) * sA, distress: ss(0.3, 0.75, L) * sA, exhale: exhale * sA });
  // Disciplinarian moods.
  const stern = ss(0.35, 0.85, sev) * (1 - ease), calm = 1 - ss(0.1, 0.45, sev);
  f.exert = Math.max(striking ? sev * ss(1.0, 1.8, swing) : 0, f.exert * Math.exp(-dt / 0.5));
  setMoods(g, { stern: stern * gA, calm: calm * (1 - ease) * gA, focus: (1 - 0.6 * stern) * (1 - ease) * gA, exertion: f.exert * gA, ease: ease * gA });

  // Flinch: the subject's head tosses on contact.
  f.flinch = f.wince * sA;
}
// The subject's head and neck, after the pose: a glance at the disciplinarian's face and the flinch (the hands and feet are
// anchored, so these are small and the neck and head only; less where the hands are on the head).
const _fa = new THREE.Vector3(), _fw = new THREE.Vector3(), _fu = new THREE.Vector3(0, 1, 0);
function faceBody(scn) {
  const f = scn.fx, s = scn.s, g = scn.g;
  if (!f) return;
  const cap = FACE.SUBJ_HEAD_CAP * (scn.atHead ? 0.4 : 1);
  if (f.sGw > 0.01) lookAt(s, g.bones.head.getWorldPosition(_fw), cap * f.sGw);
  if (f.flinch > 0.02) {
    const fwd = _fa.set(0, 0, 1).applyQuaternion(s.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    const ax = fwd.clone().cross(_fu);
    if (ax.lengthSq() > 1e-6) rotateBoneWorld(s.bones.head, new THREE.Quaternion().setFromAxisAngle(ax.normalize(), FACE.HEAD_FLINCH * (scn.atHead ? 0.5 : 1) * f.flinch));
  }
}
// Where the eyes go: the disciplinarian's to the target, drifting to the subject's face as they glance; the subject's
// to the disciplinarian's face when they glance. Set after the heads have turned, so the eyes make up what's left.
function faceGaze(scn, target) {
  const f = scn.fx, g = scn.g, s = scn.s;
  if (!f) return;
  const eyes = (ch, point, w) => {
    const hq = ch.bones.head.getWorldQuaternion(new THREE.Quaternion()).invert();
    const v = point.clone().sub(ch.bones.head.getWorldPosition(new THREE.Vector3())).applyQuaternion(hq).normalize();
    ch.gazeFx = { x: clamp(v.x * FACE.EYE_GAIN, -1, 1), y: clamp(v.y * FACE.EYE_GAIN, -1, 1), w };
  };
  const sHead = s.bones.head.getWorldPosition(new THREE.Vector3()), gHead = g.bones.head.getWorldPosition(new THREE.Vector3());
  eyes(g, target.clone().lerp(sHead, f.gGw), 0.85);
  s.gazeFx = null;
  if (f.sGw > 0.01) eyes(s, gHead, f.sGw);
}

function updateScene(scn, dt) {
  const g = scn.g, s = scn.s;
  if (!g || !s) return;

  // Swing state: 0 = resting on the thigh, 1 = raised, 2 = contact.
  let swing, reactTarget = null;
  const timed = scn.mode !== 'beat';   // loop and driven: poses follow the swing exactly
  if (scn.mode === 'loop') {
    // Timeline in seconds: lift → hold raised → strike → hold on contact.
    const T = scn.timing, sp = Math.max(0.1, T.speed);
    const lift = T.lift / sp, raised = T.raisedHold, strike = T.strike / sp, contact = T.contactHold;
    const P = lift + raised + strike + contact;
    const prev = scn.loopT;
    scn.loopT = (scn.loopT + dt) % P;
    const t = scn.loopT, t1 = lift, t2 = t1 + raised, t3 = t2 + strike;
    if (t < t1) swing = 2 - easeOut(t / lift);                           // lift from contact to raised
    else if (t < t2) swing = 1;                                          // hold at the top
    else if (t < t3) swing = 1 + easeIn((t - t2) / strike);              // strike
    else swing = 2;                                                      // hold on contact
    // Did this frame pass `at`? Checked on the unwrapped clock, so an event at the very
    // end of the cycle (e.g. impact with a zero contact hold) still fires as it wraps.
    const raw = prev + dt;
    const crossed = at => (prev < at && raw >= at) || (prev < at + P && raw >= at + P);
    if (crossed(t3)) { scn.reaction = scn.land(1); scn.reactSide = scn.reactKey(); scn.impacts++; scn.mark(scn.side); if (scn.onImpact) scn.onImpact(scn.side, 1); }
    if (crossed(t1)) scn.side = scn.side === 'L' ? 'R' : 'L';            // alternate at the top of the lift
    scn.reaction *= Math.exp(-dt * 3.2);
  } else if (scn.mode === 'driven') {
    const V = scn.dv;
    if (V) {
      V.t += dt;
      const p = clamp(V.t / V.dur, 0, 1);
      swing = lerp(V.from, V.to, V.ease(p));
      if (p >= 1 && V.onArrive) { const f = V.onArrive; V.onArrive = null; f(); }
    } else swing = scn.swing;
    scn.reaction *= Math.exp(-dt * 3.2);
  } else {
    swing = { relaxed: 0, raised: 1, contact: 2 }[scn.beat];
    reactTarget = scn.beat === 'contact' ? 1 : 0;
    scn.reaction += (reactTarget - scn.reaction) * (1 - Math.exp(-dt * 10));
  }
  if (timed) g.target = scn.giverQ(swing < 0.35 ? 'relaxed' : swing < 1.5 ? 'raised' : 'contact');
  // The rod lands somewhere new up the glutes each time: redrawn as the arm comes up past the top of the lift.
  if (scn.tool && scn.tool.rod && scn.prevSwing > 1.2 && swing <= 1.2) scn.rodT = rodRoll();
  scn.prevSwing = swing;
  scn.swing = swing;
  // The pain model: time spent waiting with the arm raised (dread), and time the hand stays on the skin after a smack.
  if (Math.abs(swing - 1) < 0.05) scn.raisedT += dt;
  if (scn.pain) scn.pain.update(dt, swing > 1.95);
  if (scn.faces) faceState(scn, dt);
  // Hands on head: the disciplinarian faces the subject squarely while relaxed and turns toward the
  // subject's hips as the arm comes up (about the vertical through the pelvis, so the feet stay put).
  if (scn.atHead) {
    const yaw = lerp(HEAD_YAW_RELAXED, scn.yawStrike != null ? scn.yawStrike : HEAD_YAW_STRIKE, easeInOut(clamp(swing / 0.6, 0, 1)));
    g.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * Math.PI / 180);
    g.group.updateMatrixWorld(true);
  }

  // Joint-angle poses (subject blends toward the reaction pose).
  const a = 1 - Math.exp(-dt * 9);
  for (const b of BONES) {
    _q.copy(scn.baseQ[b]).slerp((scn.buck ? scn.buckQ : scn.reactQ)[timed ? scn.reactSide : scn.reactKey()][b], scn.reaction * (scn.legK != null && LEG_BONES.has(b) ? scn.legK : 1));   // (`legK`: how much of the reaction the legs take: see the game's session)
    s.pose[b].slerp(_q, timed ? 1 : a);
    s.bones[b].quaternion.copy(s.pose[b]);
    g.pose[b].slerp(g.target[b], timed ? 1 - Math.exp(-dt * 14) : a);
    g.bones[b].quaternion.copy(g.pose[b]);
  }
  // Hands on head: struck, the subject rises onto their toes (the feet's pitch is in the reaction pose).
  if (scn.atHead) {
    const pitch = scn.buck ? HEAD_BUCK.pitch * Math.PI / 180 * scn.reaction : 0;
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -pitch);   // forward is +X
    s.group.quaternion.copy(qz).multiply(scn.subjBaseQ);
    s.group.position.copy(scn.subjBasePos).sub(scn.feetPivot).applyQuaternion(qz).add(scn.feetPivot);
    if (!scn.buck) s.group.position.y += HEAD_RISE * (s.spec.H / 1.58) * scn.reaction;
  } else if (scn.atCase && !scn.atKnees && scn.buck) {
    // Over the case, bucking away from the paddle: the body moves, the feet stay put (the legs' pose does that).
    s.group.position.copy(scn.subjBasePos).addScaledVector(new THREE.Vector3(...CASE_BUCK.shift), s.spec.H / 1.58 * scn.reaction);
  }
  if (scn.atKnees) kneesBody(scn, scn.reaction);
  s.group.updateMatrixWorld(true);
  g.group.updateMatrixWorld(true);
  if (scn.faces) { faceBody(scn); s.group.updateMatrixWorld(true); }

  // Contact points: mesh vertices chosen at build time (see sceneAnchors), taken
  // through full skinning each frame, so the palm sits on the skin as rendered.
  const sH = s.spec.H;
  const palm = 0.0085 * g.spec.H + 0.002;   // palm centre sits half a hand-thickness off the skin
  const fingersFwd = new THREE.Vector3(0, 0, 1);   // away from the disciplinarian
  const posed = nameOrAnchor => {
    const A = typeof nameOrAnchor === 'string' ? scn.anchors[nameOrAnchor] : nameOrAnchor;
    const p = s.mesh.boneTransform(A.index, new THREE.Vector3()).applyMatrix4(s.mesh.matrixWorld);
    const M = s.bones[A.bone].matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf(A.bone)]);
    const n = A.n.clone().transformDirection(M);
    return { p: p.addScaledVector(n, palm), n };
  };
  const shoulders = posed(scn.atHead ? 'navel' : scn.atCase ? 'lowback' : 'shoulders'), glute = posed('glute');
  // The resting hand takes the thigh nearer the disciplinarian (subject's left, toward −Z).
  const knee = posed(scn.atCase ? 'cheekL' : 'kneeL');   // over the case the hand rests by the near cheek instead
  // Left hand: same no-clip rule as the strike — palm set slightly below the skin,
  // and the skin under it compressed onto the palm plane.
  const REST_DEPTH = 0.008;
  const backN = shoulders.n, backSkin = shoulders.p.clone().addScaledVector(backN, -palm);
  // Hands on head: the left hand eases from hanging at the disciplinarian's side to the navel
  // as the arm comes up, and presses the skin only once it's there.
  const navW = scn.atHead || scn.atSpread ? easeInOut(clamp(swing / 0.7, 0, 1)) : 1;
  const giverRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(g.group.quaternion);
  let leftPt = backSkin.clone().addScaledVector(backN, 0.0085 * g.spec.H - REST_DEPTH);
  let hipSelf = null;
  if (scn.atSpread) {
    // Spread feet: in every beat the left hand lies on the curve of their own left hip, heel at the top, fingers down
    // and a little forward round it.
    const A = scn.hipL, p = g.mesh.boneTransform(A.index, new THREE.Vector3()).applyMatrix4(g.mesh.matrixWorld);
    const M = g.bones.pelvis.matrixWorld.clone().multiply(g.mesh.skeleton.boneInverses[BONES.indexOf('pelvis')]);
    const n = A.n.clone().transformDirection(M);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.group.quaternion);
    hipSelf = { p: p.addScaledVector(n, 0.0085 * g.spec.H + 0.002), n, f: new THREE.Vector3(0, -1, 0).addScaledVector(fwd, 0.35).normalize() };
    leftPt = hipSelf.p.clone();
  }
  if (scn.atHead) {
    const shL0 = g.bones.upperArmL.getWorldPosition(new THREE.Vector3());
    leftPt = shL0.clone().add(new THREE.Vector3(HEAD_HANG.out, -HEAD_HANG.down, HEAD_HANG.fwd).multiplyScalar(g.spec.H).applyQuaternion(g.group.quaternion)).lerp(leftPt, navW);
  }
  // Over the case, bucking away from the paddle: the hips move under the resting left hand, which holds its place.
  if (scn.atCase && !scn.atHead && !scn.atKnees && scn.buck) leftPt.addScaledVector(new THREE.Vector3(...CASE_BUCK.shift), -s.spec.H / 1.58 * scn.reaction)
    .addScaledVector(new THREE.Vector3(...CASE_BUCK.leftHand), s.spec.H / 1.58 * clamp(swing - 1, 0, 1));   // (and a little up and toward the disciplinarian, as set)
  setPress(s, backSkin.clone().addScaledVector(backN, -REST_DEPTH), backN, 0.065 * g.spec.H / 1.7, scn.atSpread ? 0 : scn.atHead ? clamp((navW - 0.9) / 0.1, 0, 1) : 1, '2');
  let restPt = knee.p;
  const thighN = scn.atHead ? giverRight : knee.n;
  // Far-side (right) strikes: the disciplinarian turns their shoulders toward the
  // far glute — a small twist about the vertical, split across the spine, that
  // brings the right shoulder forward over the target. It builds through the
  // downswing and releases as the hand lifts.
  // A wide implement lands on both sides at once, so there's no far side to turn toward.
  const FAR_TURN = (scn.atHead ? HEAD_FAR_TURN : 20) * Math.PI / 180, wide = !!(scn.tool && scn.tool.wide);
  const turnAmt = scn.side === 'R' && !wide ? FAR_TURN * (t => t * t * (3 - 2 * t))(clamp(swing - 1, 0, 1)) : 0;
  if (turnAmt > 0) {
    const upAxis = new THREE.Vector3(0, 1, 0);
    rotateBoneWorld(g.bones.spine1, new THREE.Quaternion().setFromAxisAngle(upAxis, turnAmt * 0.45));
    rotateBoneWorld(g.bones.spine2, new THREE.Quaternion().setFromAxisAngle(upAxis, turnAmt * 0.55));
    if (scn.atCase) {
      const f = turnAmt / FAR_TURN;
      g.bones.spine2.rotateX((scn.atHead ? HEAD_FAR_LEAN : CASE_FAR_LEAN) * Math.PI / 180 * f);
      g.bones.clavR.quaternion.multiply(new THREE.Quaternion().slerp(degQ(CASE_FAR_CLAV), f));
    }
    g.group.updateMatrixWorld(true);
  }
  const shR = g.bones.upperArmR.getWorldPosition(new THREE.Vector3());
  // Hands on head: the swinging hand hangs at the side at rest (an implement with it).
  if (scn.atHead) restPt = shR.clone().add(new THREE.Vector3(-HEAD_HANG.out, -HEAD_HANG.down, HEAD_HANG.fwd).multiplyScalar(g.spec.H).applyQuaternion(g.group.quaternion));

  // Contact delivery. The strike alternates between the left and right glute/thigh
  // fold. Palm flat on the skin with a straight wrist means the forearm lies along
  // the skin too, so for each candidate point along the fold strip, search the
  // directions the forearm could lie in (around the surface normal) for one where
  // the upper arm exactly spans shoulder → elbow, with the elbow outside the torso.
  // Lower candidates are strongly preferred; the search only moves up the strip
  // when the arm can't lay the palm flat lower down.
  //
  // The palm faces the centre of the glute on that side (not the local skin normal
  // at the fold), and its centre sits PRESS_DEPTH inside the skin; the subject's
  // shader flattens the skin under the palm (see setPress) so it compresses rather
  // than clipping. Candidate forearm lines that pass through the subject's body are
  // rejected, which pushes the elbow away from the body when needed.
  // (a skirt over the contact site keeps the palm that much further out: it lands on the cloth, not through it; set by the caller, see SKIRT_THICK)
  const PRESS_DEPTH = (scn.atKnees ? KNEES_PRESS_DEPTH : 0.012) - (scn.clothLift || 0);
  const palmHalf = 0.0085 * g.spec.H;
  const pelvisM = s.bones.pelvis.matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf('pelvis')]);
  const sideSign = scn.side === 'L' ? 1 : -1;
  const gluteP = s.spec.prims.find(P => P.tag === 'glute' && P.side === sideSign);
  const gluteC = new THREE.Vector3(...gluteP.c).applyMatrix4(pelvisM);
  const rFore = g.spec.m.forearm / 100 / (2 * Math.PI);
  // The strike fit is expensive, so it's cached per side and only recomputed when
  // the target area or the disciplinarian's shoulder has actually moved.
  const shNow = g.bones.upperArmR.getWorldPosition(new THREE.Vector3());
  const tgtNow = posed(scn.anchors[scn.side === 'L' ? 'foldL' : 'foldR'][0]).p;
  const C = scn.fitCache[scn.side];
  const fresh = wide || (C && C.aim === scn.palmAim && C.sh.distanceTo(shNow) < 0.01 && C.tgt.distanceTo(tgtNow) < 0.01);
  const strikeFit = wide ? wideFit(scn, posed, shR, palm) : fresh ? C.fit : (() => {
    // Clearance is tested against the subject's posed skin near the target.
    const skinPts = posedSkinNear(s, tgtNow, 0.45);
    const forearmClear = (E, W) => {
      let worst = Infinity;
      for (const t of [0, 0.2, 0.4, 0.6, 0.75]) worst = Math.min(worst, skinSignedDist(skinPts, E.clone().lerp(W, t)) - rFore * 0.85);
      return worst;   // ≥ 0: the forearm clears the subject
    };
    const L1 = g.bones.forearmR.position.length(), L2 = g.bones.handR.position.length();
    const palmOff = g.spec.H * 0.106 * 0.42;
    const toTorso = g.bones.spine1.matrixWorld.clone().invert(), half = torsoHalfWidth(g);
    const strip = scn.anchors[scn.side === 'L' ? 'foldL' : 'foldR'];
    // The palm-angle setting is a minimum: if no forearm line clears the subject at
    // that angle, turn the palm further toward the glute's centre until one does.
    let fallback = null;
    for (const aim of [scn.palmAim, 0.55, 0.7, 0.85, 1].filter(v => v >= scn.palmAim)) {
    const cands = [];
    strip.forEach((A, k) => {
      const ps = posed(A);
      const skin = ps.p.clone().addScaledVector(ps.n, -palm);
      const n = ps.n.clone().lerp(skin.clone().sub(gluteC).normalize(), aim).normalize();   // toward the glute's centre
      const p = skin.clone().addScaledVector(n, palmHalf - PRESS_DEPTH);
      const t1 = new THREE.Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize(), t2 = n.clone().cross(t1);
      for (let a = 0; a < 360; a += 3) for (const tiltDeg of [0, 10, 20, 30, 40]) {
        const r = a * Math.PI / 180;
        const f = t1.clone().multiplyScalar(Math.cos(r)).addScaledVector(t2, Math.sin(r));
        // Wrist extension: the forearm may come down onto the flat hand from above the
        // skin plane (≤ 40°, within normal wrist range; penalised so small is preferred),
        // letting the elbow sit lower.
        const tl = tiltDeg * Math.PI / 180;
        const dF = f.clone().multiplyScalar(Math.cos(tl)).addScaledVector(n, -Math.sin(tl));
        const W = p.clone().addScaledVector(f, -palmOff), E = W.clone().addScaledVector(dF, -L2);
        const outside = -E.clone().applyMatrix4(toTorso).x - half;   // right arm → torso's −X side
        // Penalise fingers pointing back at the disciplinarian (−Z) or up the body
        // toward the subject's head (+X); reward an open elbow; prefer low candidates.
        const err = Math.abs(E.distanceTo(shR) - L1) + Math.max(0, -f.z) * 0.05 + Math.max(0, f.x) * 0.06
          // Both sides aim for the same height, STRIKE_K steps up the strip from the
          // fold, so left and right contacts match.
          - 0.08 * clamp(outside, 0, 0.12) + 0.025 * Math.abs(k - (scn.atHead ? HEAD_STRIKE_K : STRIKE_K))
          + 0.06 * Math.max(0, humeralTwist(g, 'R', shR, E, W) - 1.05)   // shoulder twist beyond ~60°
          + 0.0006 * tiltDeg;                                              // prefer a straight wrist
        cands.push({ err, f, E, W, p, n, skin, outside, tiltDeg, k, aim });
      }
    });
    // Best-scoring candidates first; take the first whose elbow clears the torso and
    // whose forearm clears the subject. Fall back to the least-clipping one.
    cands.sort((a, b) => a.err - b.err);
    for (const c of cands.slice(0, 120)) {
      if (c.outside < 0.02) continue;
      c.clear = forearmClear(c.E, c.W);
      if (c.clear < 0) continue;
      c.twist = humeralTwist(g, 'R', shR, c.E, c.W);
      if (c.twist <= 1.3) return c;                    // clears and the shoulder twist is comfortable
      if (!fallback || c.twist < fallback.twist) fallback = c;
    }
    if (!fallback && aim === 1) fallback = cands[0];
    }
    return fallback;
  })();
  if (!fresh) scn.fitCache[scn.side] = { aim: scn.palmAim, sh: shNow, tgt: tgtNow, fit: strikeFit };
  const strike = { p: strikeFit.p, n: strikeFit.n };
  // Compress the skin under the palm while the hand is on it (a wide implement's blade
  // is pressed after the arm is placed, from where the blade actually is).
  if (!wide) setPress(s, strikeFit.skin.clone().addScaledVector(strikeFit.n, -PRESS_DEPTH), strikeFit.n, 0.065 * g.spec.H / 1.7,
    clamp((swing - 1.75) / 0.25, 0, 1));
  scn.lastStrike = strikeFit;
  // Holding an implement: the hand is set back along it (and off the skin by its
  // thickness) so the implement's striking face lands on the target instead of the palm,
  // pressing in a few millimetres as the palm does.
  const tool = scn.tool;
  // At contact the palm faces the skin (its normal −n) with the fingers along f, so the
  // thumb side is f × (−n).
  const thumbW = tool && !wide ? strikeFit.f.clone().cross(strike.n.clone().negate()).normalize() : null;
  // The hand doesn't finish exactly as the offsets assume, so a per-side correction
  // (scn.toolFix, learnt while the implement is on the skin; see after the arm IK)
  // closes the rest. A wide implement has one, 'B', for both sides.
  scn.toolFix = scn.toolFix || {};
  const fix = tool && scn.toolFix[scn.implement + (wide ? 'B' : scn.side)];
  const contactPt = wide ? strikeFit.palmC.clone().add(fix || new THREE.Vector3()) : tool ? strike.p.clone().addScaledVector(strike.n, tool.off - 0.004)
    .addScaledVector(strikeFit.f, -tool.along).addScaledVector(thumbW, -tool.across).add(fix || new THREE.Vector3()) : strike.p;
  let raisedPt = shR.clone().add((scn.atHead ? HEAD_RAISED_HAND : new THREE.Vector3(-0.1, 0.3, -0.06)).clone().multiplyScalar(g.spec.H / 1.7));
  // A wide implement raised (WIDE_RAISED): the blade's face placed and turned from the
  // shoulder, and the palm centre (what the swing moves) where that puts the hand.
  let wideUp = null;
  if (wide) {
    const R = scn.wideRaised, T = scn.tool, ax = new THREE.Vector3(...R.axis).normalize(), fN = new THREE.Vector3(...R.faceN);
    fN.addScaledVector(ax, -fN.dot(ax)).normalize();
    const Q = bladeHandQuat(T, ax, fN.negate());
    const face = shR.clone().addScaledVector(new THREE.Vector3(...R.face), g.spec.H / 1.7);
    raisedPt = face.sub(T.face.clone().applyQuaternion(Q)).add(T.palmC.clone().applyQuaternion(Q));
    wideUp = { Q, pole: new THREE.Vector3(...R.elbow).normalize().multiplyScalar(0.5) };
  }

  // Subject's hands: palms flat on the floor ahead of the shoulders if the arm can
  // reach; otherwise the arm straightens toward the floor and the fingertips touch.
  const floorN = new THREE.Vector3(0, 1, 0);
  const sHand = s.spec.H * 0.106;
  // Hands on knees: palms on the front of the knees, fingers down, elbows out.
  if (scn.atKnees) {
    for (const side of ['L', 'R']) {
      let knee = s.bones['shin' + side].getWorldPosition(new THREE.Vector3());
      // Spread: the palms rest on the front of the thigh, 70% of the way down it.
      if (scn.atSpread) knee = s.bones['thigh' + side].getWorldPosition(new THREE.Vector3()).lerp(knee, 0.7);
      const rK = s.spec.m.knee / 100 / (2 * Math.PI);
      const n = new THREE.Vector3(1, 0.1, 0).normalize();
      const target = knee.clone().addScaledVector(n, rK + 0.0085 * sH + 0.004).add(new THREE.Vector3(0, 0.02 * sH / 1.58, 0));
      const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? -1 : 1;
      armIK(s, side, target, sh.clone().add(new THREE.Vector3(-0.1, 0.05, out * 0.5)), n, new THREE.Vector3(0, -1, 0));
    }
  }
  for (const side of scn.atHead || scn.atKnees ? [] : ['L', 'R']) {
    const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
    const out = side === 'L' ? -1 : 1;   // subject's left is world −Z in this orientation
    const pole = sh.clone().add(new THREE.Vector3(-0.4, 0.1, out * 0.25));
    const palmReach = armReach(s, side);
    // Hands stay planted while the body reacts: the palm spot is taken at rest and
    // held until the reaction has settled, rather than following the shoulders.
    let palmPt = scn.atCase ? casePalm(s, side, scn.caseTop) : new THREE.Vector3(sh.x + 0.07 * sH, 0.012 * sH, sh.z + out * 0.06 * sH);
    if (!scn.plant[side] || scn.reaction < 0.02) scn.plant[side] = palmPt.clone();
    else {
      const slideTo = palmPt;
      palmPt = scn.plant[side].clone();
      // Over the case the palm stays on the lid however the body moves: it holds its place while
      // the arm can reach it, and slides back along the lid, flat, when the shoulders rise or draw
      // away (casePalm is where a nearly straight arm from the shoulder as it is now would land).
      if (scn.atCase) palmPt.x = Math.min(palmPt.x, slideTo.x);
    }
    // The flat-palm IK solves for the wrist (palm centre minus half a hand along the
    // fingers), so test reach to that point, not to the palm centre.
    const wristPt = palmPt.clone().addScaledVector(new THREE.Vector3(1, 0, 0), -sHand * 0.42);
    const wristReach = s.bones['forearm' + side].position.length() + s.bones['hand' + side].position.length();
    const ha = s.bones['hand' + side];
    const fingersX = new THREE.Vector3(1, 0, 0);            // fingers toward the head end
    const reach = wristReach * 0.99;
    // Pivot point: the fingertips of the flat, planted hand.
    const tipLen = sHand * 0.9;
    const T = wristPt.clone().addScaledVector(fingersX, tipLen);
    // As the hand tilts, the contact moves from the palm to the finger pads, which sit
    // lower than the palm centre line — so the pivot settles toward the floor.
    const pivotAt = th => T.clone().add(new THREE.Vector3(0, -0.015 * sH * Math.sin(th), 0));
    const wristAt = th => pivotAt(th).add(new THREE.Vector3(-Math.cos(th) * tipLen, Math.sin(th) * tipLen, 0));
    if (sh.distanceTo(wristPt) <= reach) {
      // Palm flat on the planted spot.
      armIK(s, side, palmPt, pole, floorN, fingersX);
    } else if (sh.distanceTo(wristAt(Math.PI / 2)) <= reach) {
      // Shoulders too high for a flat palm: the fingertips stay planted and the heel
      // of the hand lifts, pivoting about them just enough for the arm to reach.
      let lo = 0, hi = Math.PI / 2;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (sh.distanceTo(wristAt(mid)) > reach) lo = mid; else hi = mid;
      }
      const W = wristAt(hi);
      armIK(s, side, W, pole, null, null, null, false, true);
      const d = pivotAt(hi).sub(W).normalize();
      const palmDir = new THREE.Vector3(0, -1, 0).addScaledVector(d, d.y).normalize();
      setHandWorld(s, side, basisQuat(d, palmDir).multiply(restHandQuat(ha, side).invert()));
    } else {
      // Even a vertical hand can't reach: straighten the arm toward the floor and
      // let the fingertips find it (see placeFingertips).
      const floorPt = new THREE.Vector3(palmPt.x, scn.atCase ? scn.caseTop : 0, palmPt.z);
      const armDir = floorPt.sub(sh).normalize();
      armIK(s, side, sh.clone().addScaledVector(armDir, palmReach * 0.995), pole);
      placeFingertips(s, side);
    }
  }

  // Hands on head: palms on the back of the skull, fingers along it, elbows out.
  if (scn.atHead) {
    const M = s.bones.head.matrixWorld, hp = scn.headPrim, hv = HEAD_PALM;
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const d = new THREE.Vector3(hv.dir[0] * sg, hv.dir[1], hv.dir[2]).normalize();
      const surf = hp.c.clone().add(new THREE.Vector3(d.x * hp.r.x, d.y * hp.r.y, d.z * hp.r.z)).applyMatrix4(M);
      const n = new THREE.Vector3(d.x / hp.r.x, d.y / hp.r.y, d.z / hp.r.z).normalize().transformDirection(M);
      const target = surf.addScaledVector(n, 0.0085 * s.spec.H + hv.lift);
      const fingers = new THREE.Vector3(hv.fingers[0] * sg, hv.fingers[1], hv.fingers[2]).transformDirection(M);
      const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? -1 : 1;
      const pole = sh.clone().add(new THREE.Vector3(hv.pole[0], hv.pole[1], hv.pole[2] * out));
      armIK(s, side, target, pole, n, fingers);
    }
  }

  // Swinging hand: rest above the knee → raised → contact.
  // Resting with an implement: its head lies on the thigh instead of the palm, just
  // touching (REST_GAP off the skin, no compression): the hand is set back by the head's
  // offsets, with the fingers forward, plus a correction learnt at rest (below).
  const REST_TILT = 18 * Math.PI / 180;
  const restSkin = restPt.clone().addScaledVector(thighN, -palm);
  let restAt = scn.atCase && !scn.atHead && !tool ? restPt.clone().addScaledVector(thighN, CASE_REST_HOVER) : restPt;
  // A wide implement rests across both sites, flat on the seat (its fit's `rest`), lifted
  // off the skin to REST_GAP (no compression), plus its own correction learnt at rest.
  const wideRest = wide ? strikeFit.rest : null;
  if (wide) restAt = wideRest.palmC.clone().addScaledVector(wideRest.n, scn.wideRest ? 0 : WIDE_DEPTH + REST_GAP + (scn.clothLift || 0))
    .add(scn.toolFix[scn.implement + 'rest'] || new THREE.Vector3());
  else if (tool) {
    const thumbR = fingersFwd.clone().cross(thighN.clone().negate()).normalize();
    restAt = restSkin.clone().addScaledVector(thighN, tool.off + REST_GAP).addScaledVector(fingersFwd, -tool.along)
      .addScaledVector(thumbR, -tool.across).add(scn.toolFix[scn.implement + 'rest'] || new THREE.Vector3());
  }
  if (scn.atKnees && !wide) {
    const R = tool ? KNEES_REST.brush : KNEES_REST.hand;
    restAt = restAt.clone().add(new THREE.Vector3(...R.delta).multiplyScalar(g.spec.H / 1.72));
  }
  const want = swing <= 1 ? restAt.clone().lerp(raisedPt, swing) : raisedPt.clone().lerp(contactPt, swing - 1);
  // A wide implement's fist runs from the hip to above the shoulder: a straight line would
  // take it through the disciplinarian's own shoulder, so the path bows out to their side
  // (and a little forward), most in the middle of each leg of the swing.
  if (wide) want.addScaledVector(WIDE_ARC, g.spec.H / 1.7 * Math.sin(Math.PI * (swing <= 1 ? clamp(swing, 0, 1) : clamp(swing - 1, 0, 1))));
  if (!scn.handR || timed) scn.handR = want; else scn.handR.lerp(want, a);
  if (!scn.handL) scn.handL = leftPt; else scn.handL.lerp(leftPt, a);

  // If a resting hand is out of reach, lean the disciplinarian's torso toward it
  // (rotating spine1 about the axis that swings the shoulder toward the target).
  // The lean is capped (~8°) so it stays a subtle adjustment; the swinging arm
  // isn't included at contact — the strike search fits the arm to the torso instead.
  const reachTargets = [['L', scn.handL]];
  if (swing < 0.3 && !scn.atKnees) reachTargets.push(['R', scn.handR]);   // (hands on knees: the hanging hand never leans the body)
  const pivot = new THREE.Vector3(), shW = new THREE.Vector3();
  const MAX_LEAN = 0.14;
  let leaned = 0;
  for (let it = 0; it < 8 && leaned < MAX_LEAN; it++) {
    let moved = false;
    for (const [side, T] of reachTargets) {
      g.bones['upperArm' + side].getWorldPosition(shW);
      const deficit = shW.distanceTo(T) - armReach(g, side) * 0.97;
      if (deficit <= 0.002) continue;
      g.bones.spine1.getWorldPosition(pivot);
      const r = shW.clone().sub(pivot), toT = T.clone().sub(pivot);
      const axis = r.clone().cross(toT);
      if (axis.lengthSq() < 1e-9) continue;
      const step = Math.min(deficit / r.length(), 0.06, MAX_LEAN - leaned);
      g.bones.spine1.rotateOnWorldAxis(axis.normalize(), step);
      g.group.updateMatrixWorld(true);
      leaned += step;
      moved = true;
    }
    if (!moved) break;
  }

  // Attention on the subject: the head turns toward the target area.
  // Capped low so the face stays readable from the front; the eyes imply the rest.
  // `scn.gaze = 'head'` turns the look to the back of the subject's head instead (aftercare).
  if (scn.gaze === 'head') lookAt(g, s.bones.head.getWorldPosition(new THREE.Vector3()), 0.7);
  else if (scn.faces && scn.fx && scn.fx.gGw > 0.01) lookAt(g, glute.p.clone().lerp(s.bones.head.getWorldPosition(new THREE.Vector3()), scn.fx.gGw), lerp(0.42, FACE.GIVER_HEAD_CAP, scn.fx.gGw));
  else lookAt(g, glute.p, 0.42);
  scn._glutePt = glute.p;
  // Over the case, the paddle's contact twists the back, so the look is trimmed back toward the subject.
  if (scn.atCase && !scn.atHead && scn.tool && scn.tool.wide && swing > 1) {
    const w = clamp(swing - 1, 0, 1);
    for (const b of ['neck', 'head']) g.bones[b].quaternion.multiply(new THREE.Quaternion().slerp(degQ(CASE_PADDLE_GAZE[b]), w));
    g.bones.neck.updateMatrixWorld(true);
  }
  if (scn.atHead) {
    // The gaze trim comes in as the arm rises and stays through contact (raised's offsets easing to contact's).
    const w = clamp(swing, 0, 1), c = clamp(swing - 1, 0, 1);
    if (w > 0) for (const b of ['neck', 'head']) g.bones[b].quaternion.multiply(
      degQ(HEAD_GAZE.raised[b]).clone().slerp(degQ(HEAD_GAZE.contact[b]), c).slerp(new THREE.Quaternion(), 1 - w));
    g.bones.neck.updateMatrixWorld(true);
  }

  // Elbow poles: tucked at rest, up and back when raised, then wherever the strike
  // fit puts it at contact.
  const POLE_REST = new THREE.Vector3(-0.1, -0.15, -0.5);
  const POLE_RAISED = scn.atHead ? HEAD_POLE_RAISED : new THREE.Vector3(-0.3, 0.2, -0.45);
  const poleStrike = strikeFit.E.clone().sub(shR);
  // (A wide implement's elbow starts where its rest fit puts it.)
  const poleUp = wide ? wideUp.pole : POLE_RAISED;
  const poleOff = swing <= 1 ? (wide ? (wideRest.pole || wideRest.E.clone().sub(shR)) : scn.atKnees ? new THREE.Vector3(...(tool ? KNEES_REST.brush : KNEES_REST.hand).pole) : POLE_REST).clone().lerp(poleUp, swing) : poleUp.clone().lerp(poleStrike, swing - 1);
  // (Hands on head: from where the shoulder is now, after the lean, so the set elbow directions hold.)
  const poleR = (scn.atHead ? g.bones.upperArmR.getWorldPosition(new THREE.Vector3()) : shR).clone().add(poleOff);
  // Swinging hand: flat on the thigh at rest; palm forward when raised, turning
  // toward the target during the strike; flat on the target, wrist straight, at contact.
  // Resting an implement, the palm tilts REST_TILT so the head end dips onto the thigh
  // and the fist lifts clear (the handle runs toward the thumb: thumbward and a little
  // toward the fingertips).
  let restN = thighN;
  if (tool && !wide) {
    const dW = fingersFwd.clone().cross(thighN.clone().negate()).normalize().addScaledVector(fingersFwd, 0.15).normalize();
    restN = thighN.clone().multiplyScalar(Math.cos(REST_TILT)).addScaledVector(dW, Math.sin(REST_TILT)).normalize();
  }
  if (scn.atKnees && tool && !wide) restN = new THREE.Vector3(...KNEES_REST.brush.n);
  // Hanging at the side the palm faces the body, the fingers continuing the forearm.
  const sideIn = giverRight.clone().negate();
  const flatR = swing < 0.3 && !scn.atHead ? restN : swing > 1.9 ? strike.n : null;
  const palmToTarget = flatR ? null : (scn.atHead ? sideIn.clone().lerp(new THREE.Vector3(0, 0, 1), clamp(swing, 0, 1)).normalize() : new THREE.Vector3(0, 0, 1))
    .lerp(contactPt.clone().sub(scn.handR).normalize(), clamp(swing - 1, 0, 1)).normalize();
  const atContact = swing > 1.9;
  if (wide) {
    // A wide implement's hand is turned as a whole: at rest and at contact exactly as the
    // fit holds it (flat across the seat at rest, tilted against the sit spots at contact), and raised as
    // WIDE_RAISED sets it. In between, the hand turns steadily from one to the next.
    const Qr = wideUp.Q, Qc = strikeFit.Q;
    const Qw = swing <= 1 ? wideRest.Q.clone().slerp(Qr, clamp(swing, 0, 1)) : Qr.clone().slerp(Qc, clamp(swing - 1, 0, 1));
    if (!scn.handQ || timed) scn.handQ = Qw; else scn.handQ.slerp(Qw, a);
    const T = scn.tool;
    // The wrist goes where the palm centre and the hand's turn put it, then the hand takes
    // exactly that turn, so the blade lands where it's placed. (Plain armIK: the fit keeps
    // the elbow clear, and may put it behind the back.)
    armIK(g, 'R', scn.handR.clone().sub(T.palmC.clone().applyQuaternion(scn.handQ)), poleR, null, null, null, false, true);
    setHandWorld(g, 'R', scn.handQ);
  } else (scn.atHead && swing > 0.3 && swing < 1.6 ? armIK : armIKClear)(g, 'R', scn.handR, poleR, flatR, atContact ? strikeFit.f : scn.atKnees && tool && swing < 0.3 ? new THREE.Vector3(0, -1, 0) : fingersFwd, palmToTarget, atContact && !strikeFit.tiltDeg);   // hands on head: the raised elbow goes where the pole puts it
  // Implement on the skin: where its striking face actually is against where it should
  // be (4 mm into the skin, like the palm), and half the difference into the correction.
  // The same at rest, so it lies on the thigh without sinking in: across the skin, the
  // head's face goes over the rest point; off the skin, the lowest thing held (any
  // point of the brush, or the gripping fingers) ends up REST_GAP above it.
  // Clearance is the subject's own distance field, each point taken back to the rest
  // pose through the nearest pelvis or leg bone: exact about inside and outside, where
  // a nearest-skin-point test is fooled in creases (thigh against glute). Refitted every
  // third frame.
  scn.restTick = (scn.restTick || 0) + 1;
  if (tool && !wide && !scn.atKnees && swing < 0.03 && tool.probes && scn.restTick % 3 === 0) {
    g.bones.handR.updateMatrixWorld(true);
    const M = g.bones.handR.matrixWorld, face = tool.face.clone().applyMatrix4(M);
    const low = restClearance(s, tool.probes, M);
    const key = scn.implement + 'rest', cur = scn.toolFix[key] || new THREE.Vector3();
    const across = restSkin.clone().sub(face); across.addScaledVector(thighN, -across.dot(thighN));
    const err = across.addScaledVector(thighN, REST_GAP - low);
    if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.12);
  }
  if (tool && !wide && swing > 1.97) {
    g.bones.handR.updateMatrixWorld(true);
    const face = tool.face.clone().applyMatrix4(g.bones.handR.matrixWorld);
    const goal = strike.p.clone().addScaledVector(strike.n, -0.004);
    const key = scn.implement + scn.side, cur = scn.toolFix[key] || new THREE.Vector3();
    const err = goal.sub(face);
    if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.1);
  }
  // A wide implement, the same way at both ends of the swing: across the skin, the
  // blade's face centre goes where the fit put it; off the skin, at rest the lowest thing
  // held is REST_GAP clear (nothing sinks in), and at contact the face is WIDE_CONTACT.depth
  // into the higher of the two sites (the glutes above them stand further through, and the
  // press flattens them all onto it).
  if (wide) {
    g.bones.handR.updateMatrixWorld(true);
    const M = g.bones.handR.matrixWorld, atRest = swing < 0.03, onSkin = swing > 1.97;
    const F = atRest ? wideRest : strikeFit, n = F.n;
    if ((atRest || onSkin) && scn.restTick % 3 === 0) {
      const faceW = tool.face.clone().applyMatrix4(M);
      const low = onSkin ? -Math.max(strikeFit.skinL.clone().sub(faceW).dot(n), strikeFit.skinR.clone().sub(faceW).dot(n))
        : -seatExcess(seatPoints(scn), faceW, n, F.a, tool);
      const plan = onSkin ? strikeFit.face : wideRest.faceRest;
      const across = plan.clone().sub(faceW); across.addScaledVector(n, -across.dot(n));
      const err = across.addScaledVector(n, (onSkin ? -((tool.rod ? ROD_DEPTH : scn.wideContact.depth) - (scn.clothLift || 0)) : REST_GAP) - low);
      const key = scn.implement + (onSkin ? 'B' : 'rest'), cur = scn.toolFix[key] || new THREE.Vector3();
      if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.1);
    }
    // The blade flattens the skin under it (a footprint the blade's shape) while it's on,
    // everything standing through its face (the press reaches that deep). The press is full
    // out to the blade's edges and corners (the footprint's inner 55%), then eases back to
    // the natural surface beyond them, so the flesh round the blade rises out of a dent.
    const T = tool, amt = clamp((swing - 1.75) / 0.25, 0, 1), faceW = T.face.clone().applyMatrix4(M);
    const deep = amt > 0 ? Math.max(0.02, seatExcess(seatPoints(scn), faceW, strikeFit.n, strikeFit.a, T) + 0.004) : 0.02;
    setPress(s, faceW, strikeFit.n, (T.halfW + 0.015) / 0.55, amt, '', strikeFit.a, T.halfLen - T.halfW, deep);
  }
  const shL = g.bones.upperArmL.getWorldPosition(new THREE.Vector3());
  if (scn.atSpread) armIKClear(g, 'L', scn.handL, shL.clone().add(new THREE.Vector3(...SPREAD_HANG_POLE_L)), hipSelf.n, hipSelf.f);   // on their own hip
  else if (scn.atHead && navW < 0.98) armIKClear(g, 'L', scn.handL, shL.clone().add(new THREE.Vector3(0.1, -0.15, -0.5)), null, null, giverRight);   // hanging: palm to the thigh
  else armIKClear(g, 'L', scn.handL, shL.clone().add(new THREE.Vector3(0.1, -0.15, -0.5)), backN, scn.atHead ? HEAD_NAVEL_FINGERS : fingersFwd);

  // Fingers follow the skin under each hand: the palm is rigid and flat, so on a
  // rounded surface the fingers curl down until their pads meet the skin. The
  // swinging hand wraps the thigh at rest and the glute at contact, and stays
  // open in between.
  if (!scn.patch) {
    const A = scn.anchors;
    scn.patch = { back: skinPatch(s, (scn.atHead ? A.navel : scn.atCase ? A.lowback : A.shoulders).index, 0.14), knee: skinPatch(s, (scn.atCase ? A.cheekL : A.kneeL).index, 0.14),
      L: skinPatch(s, A.foldL[scn.atHead ? HEAD_STRIKE_K : STRIKE_K].index, 0.16), R: skinPatch(s, A.foldR[scn.atHead ? HEAD_STRIKE_K : STRIKE_K].index, 0.16) };
    scn.curl = { L: null, R: null };
  }
  const onSkin = idx => { const pts = posePatch(s, idx); return q => skinSignedDist(pts, q); };
  if (scn.atSpread && !scn.patch.hipL) scn.patch.hipL = skinPatch(g, scn.hipL.index, 0.14);
  const wantL = scn.atSpread ? wrapFingers(g, 'L', (pts => q => skinSignedDist(pts, q))(posePatch(g, scn.patch.hipL))) : scn.atHead && navW < 0.5 ? 12 : wrapFingers(g, 'L', onSkin(scn.patch.back));
  const wantR = tool ? (tool.grip || IMPLEMENTS[scn.implement].grip).curl   // closed round the implement's handle
    : swing < 0.3 ? (scn.atHead ? 12 : wrapFingers(g, 'R', onSkin(scn.patch.knee)))
    : swing > 1.9 ? wrapFingers(g, 'R', onSkin(scn.patch[scn.side])) : 4;
  const k = timed ? 1 - Math.exp(-dt * 30) : a;
  for (const [side, want] of [['L', wantL], ['R', wantR]]) {
    scn.curl[side] = scn.curl[side] == null ? want : scn.curl[side] + (want - scn.curl[side]) * k;
    setFingerCurl(g, side, scn.curl[side]);
  }
  if (scn.atCase && !scn.atHead) {
    g.bones.thumbL.quaternion.copy(degQ(CASE_THUMB_L));
    // The resting hand's thumb is tucked in, easing out as the hand lifts to swing.
    if (!tool && !wide) g.bones.thumb2R.quaternion.slerp(degQ(CASE_REST_THUMB), clamp(1 - swing / 0.3, 0, 1));
    g.bones.thumbL.updateMatrixWorld(true); g.bones.thumb2R.updateMatrixWorld(true);
  }
  if (tool && tool.thumbQ) { g.bones.thumbR.quaternion.copy(tool.thumbQ[0]); g.bones.thumb2R.quaternion.copy(tool.thumbQ[1]); }   // round the handle
  // A wide implement's fingers take WIDE_RAISED's pose toward the top of the swing.
  const up = wide ? clamp(1 - Math.abs(swing - 1), 0, 1) : 0;
  if (up > 0) { g.bones.fingersR.quaternion.slerp(degQ(scn.wideRaised.fingers), up); g.bones.fingersR.updateMatrixWorld(true); }
  // The fingers dent the skin they press, as the palm does: the resting left hand always,
  // the swinging hand once it's on the skin (not when it holds an implement: its fingers
  // are round the handle, and the implement presses the skin through the palm's press).
  setFingerCaps(s, g, 'L', 1);
  if (!tool) setFingerCaps(s, g, 'R', clamp((swing - 1.75) / 0.25, 0, 1), true);
  if (scn.faces && scn._glutePt) { g.group.updateMatrixWorld(true); faceGaze(scn, scn._glutePt); }
}

// ════════════════════════════════════════════════════════════════
// IMPLEMENTS — held in the disciplinarian's right hand (scn.setImplement). Each has a
// mark weight: how many of the hand's smacks one of its smacks counts as, toward the
// colour at the contact site (the hand's first few add about 3% each; a weight of
// 5/3 makes that 5%). Coverage is unchanged: one glute at a time, as with the hand.
//   hairbrush: a wooden paddle brush, held in a fist. The handle crosses the palm
//   diagonally, from the heel under the little finger to the base of the index finger,
//   the fingers wrapped round it, and the oval head stands out past the thumb side with
//   its flat back facing the way the palm does. At contact the back of the head lands
//   on the target and the hand sits where that puts it (see updateScene).
//   paddle: a wide, thick wooden paddle, one board, its flat handle in the fist with the
//   faces parallel to the palm (the palm faces the way the striking face does) and the
//   thumb under the handle against the back face; the blade stands out past the thumb,
//   and the fist that holds it is fitted to the handle (tool.grip). It's wide: the blade
//   lands across both contact sites at once, tilted against the sit spots, its long axis
//   running level from the near site to the far one, and presses the glutes flat under
//   it; each smack marks both sides (8/3: the hand's early 3% becomes 8%, on each). It
//   rests flat across the seat, just touching. See wideFit.
// ════════════════════════════════════════════════════════════════
const IMPLEMENTS = {
  hand:      { mark: 1 },
  hairbrush: { mark: 5 / 3, grip: { curl: 60, bend: 80 }, build: buildHairbrush },
  // `giver`: layers over the disciplinarian's beat poses while this implement is held. The
  // paddle's contact keeps the relaxed torso (the pose editor's pose was set on it) and
  // lifts the right shoulder a little; raised, the shoulder draws back.
  // `giverCase`: over the case the stance is the position's own; the paddle only twists the upper back toward
  // the subject on contact (from a pose-editor report).
  // `dual`: lands on both sides at once; the only kind the spread-feet position offers.
  // `stripe`: leaves a stripe where it lands (see addStripe) instead of building the glutes' colour.
  rod:       { mark: 0, dual: true, stripe: true, build: buildRod },
  paddle:    { mark: 8 / 3, dual: true, build: buildPaddle, giverCase: { contact: { spine2: [10, 36, 0], clavL: [-1.4, 2.5, -10.1] } }, giver: { raised: { clavR: [8.9, -11.9, 3.2] }, contact: { spine1: [8, 0, 0], spine2: [0, 0, 0], neck: [10, 0, 0], clavR: [2.5, 4.2, -8] } } },
};
const REST_GAP = 0.001;   // an implement at rest: its lowest point this far off the skin
const REST_SEGS = [['pelvis', 'spine1'], ['thighL', 'shinL'], ['thighR', 'shinR'], ['shinL', 'footL'], ['shinR', 'footR']];
const _rv = new THREE.Vector3(), _rw = new THREE.Vector3();
// The smallest clearance between the subject's skin and any of `probes` ([point, radius],
// in the frame of matrix M, e.g. the holding hand's). Exact about inside and outside: each
// point is taken back to the rest pose through the nearest pelvis or leg bone and measured
// in the subject's own distance field (a nearest-skin-point test is fooled in creases).
function restClearance(s, probes, M) {
  const segs = REST_SEGS.map(([a, b]) => ({ a: s.bones[a].getWorldPosition(new THREE.Vector3()), b: s.bones[b].getWorldPosition(new THREE.Vector3()),
    inv: s.bones[a].matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf(a)]).invert() }));
  const q = new THREE.Vector3();
  let low = Infinity;
  for (const [pt, r] of probes) {
    q.copy(pt).applyMatrix4(M);
    let bd = Infinity, sg = null;
    for (const S2 of segs) { const ab = _rv.copy(S2.b).sub(S2.a), t = clamp(_rw.copy(q).sub(S2.a).dot(ab) / ab.lengthSq(), 0, 1); const dd = _rw.copy(S2.a).addScaledVector(ab, t).distanceTo(q); if (dd < bd) { bd = dd; sg = S2; } }
    low = Math.min(low, field(s.spec, q.applyMatrix4(sg.inv).toArray()) - r);
  }
  return low;
}
// Where a handle fits in a fist: the fingers' centreline with the knuckle curled `curl`
// and the middle and end joints bent `bend` each (degrees), in the plane of the hand
// (u along the fingers, v out of the palm, from the knuckle). Returns the centre and the
// radius of the largest round handle that the fingers and the palm close on.
function fistPocket(H, curl, bend) {
  const fl = FINGERS[1][1] * 0.106 * H, fR = FINGERS[1][2] * H * 0.9, palmHalf = 0.0085 * H;
  const lens = [FINGER_JOINTS[0], FINGER_JOINTS[1] - FINGER_JOINTS[0], 1 - FINGER_JOINTS[1]].map(k => k * fl);
  const pts = [[0, 0]];
  lens.forEach((l, i) => { const a = (curl + i * bend) * Math.PI / 180, [x, y] = pts[i]; pts.push([x + l * Math.cos(a), y + l * Math.sin(a)]); });
  const segD = (u, v, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = clamp(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(u - ax - t * dx, v - ay - t * dy);
  };
  // Only points the curled finger encloses (inside the loop it makes back to the knuckle).
  const inside = (u, v) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) c = !c; } return c; };
  let best = { u: 0, v: 0, r: -1 };
  for (let u = -0.05; u <= 0.06; u += 0.0005) for (let v = palmHalf; v <= 0.08; v += 0.0005) {
    if (!inside(u, v)) continue;
    const r = Math.min(segD(u, v, pts[0], pts[1]), segD(u, v, pts[1], pts[2]), segD(u, v, pts[2], pts[3])) - fR;
    const rr = Math.min(r, v - palmHalf);
    if (rr > best.r) best = { u, v, r: rr };
  }
  best.pts = pts; best.fR = fR;   // the curled finger's centreline, and its radius
  return best;
}
// Built in the right hand bone's frame. Returns the group and, for placing the hand at
// contact, where the head's striking face is relative to the palm centre: `along` the
// fingers, `across` toward the thumb, and `off`, how far it stands out from the palm.
function buildHairbrush(g) {
  const H = g.spec.H, hl = 0.106 * H, side = 'R';
  const along = g.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(-1);   // out of the palm (right hand)
  const across = along.clone().cross(palmN).normalize();                                  // toward the thumb
  const palmC = along.clone().multiplyScalar(0.42 * hl);
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x8a5a32), roughness: 0.45, metalness: 0 });
  const bristleBed = new THREE.MeshStandardMaterial({ color: lin(0x1c1612), roughness: 0.9 });
  const grp = new THREE.Group();
  const palmHalf = 0.0085 * H, headT = 0.017, headK = 1.15;
  // The handle lies across the fist, square to the fingers (a slight lean toward the
  // fingertips at the thumb end), centred in the pocket the gripping fingers close
  // round, and just thick enough to fill it.
  const G = IMPLEMENTS.hairbrush.grip, pocket = fistPocket(H, G.curl, G.bend);
  const handleR = clamp(pocket.r, 0.008, 0.013);
  const knuckle = g.bones['fingers' + side].position.clone();
  const gripC = knuckle.clone().addScaledVector(along, pocket.u).addScaledVector(palmN, pocket.v);
  const d = across.clone().addScaledVector(along, 0.15).normalize();
  const side2 = d.clone().cross(palmN).normalize();                   // in the palm's plane, square to the handle (right-handed with d, palmN)
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side2, d, palmN));
  const out = 0.075, butt = 0.035;                                    // handle beyond the grip on each side
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(handleR * 0.85, handleR, out + butt, 20), wood);
  handle.position.copy(gripC).addScaledVector(d, (out - butt) / 2);
  handle.quaternion.copy(q);
  // Head: a flat oval paddle on the end of the handle, long axis along it, its back
  // (the striking face) toward the palm's side, level with the handle's outer edge.
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 16), wood);
  head.scale.set(0.034 * headK, 0.048 * headK, headT / 2);
  const headC = gripC.clone().addScaledVector(d, out + 0.044 * headK).addScaledVector(palmN, handleR - headT / 2);
  head.position.copy(headC);
  head.quaternion.copy(q);
  // The bristles' bed, on the face away from the skin.
  const bed = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 12), bristleBed);
  bed.scale.set(0.028 * headK, 0.041 * headK, 0.005);
  bed.position.copy(headC).addScaledVector(palmN, -headT / 2);
  bed.quaternion.copy(q);
  for (const m of [handle, head, bed]) { m.castShadow = true; grp.add(m); }
  g.bones['hand' + side].add(grp);
  const rel = headC.clone().sub(palmC);
  // `probes`: points (hand frame) with a radius, covering everything held that could
  // touch a surface: the brush's own vertices (radius 0) and the gripping fingers'
  // centrelines (each finger at its own place across the hand), for resting it without
  // anything sinking in (see updateScene).
  const probes = [];
  grp.updateMatrix();
  for (const m of [handle, head, bed]) {
    m.updateMatrix();
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i += 3) probes.push([new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(m.matrix), 0]);
  }
  for (const [offF] of FINGERS) for (let k = 0; k + 1 < pocket.pts.length; k++) for (let t = 0; t < 1; t += 0.25) {
    const [ax, ay] = pocket.pts[k], [bx, by] = pocket.pts[k + 1];
    probes.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t).addScaledVector(palmN, ay + (by - ay) * t)
      .addScaledVector(across, offF * FINGER_PITCH * H), pocket.fR]);
  }
  // `face`: the middle of the striking face (the head's back), in the hand's frame, with
  // its outward normal `faceN` and the brush's long axis `axis` (toward the head).
  return { grp, probes, along: rel.dot(along), across: rel.dot(across), off: rel.dot(palmN) + headT / 2 - palmHalf,
    face: headC.clone().addScaledVector(palmN, headT / 2), faceN: palmN.clone(), axis: d.clone() };
}

// The paddle, in metres, cut from one board `thick` thick: the blade's length and width
// and the radius of its far corners; the `neck` over which its shoulders sweep in to the
// handle; the handle's length (butt to shoulders) and width, and how far its butt stands
// out past the little finger. `lean`: the handle's slant across the palm toward the
// fingertips at the thumb end (0 is square to the fingers); `seat`, how far in from the
// knuckles toward the heel of the palm it lies, the fingers curled tight round it.
// Held with the board's faces parallel to the palm: the palm, heel and all, faces the
// way the striking face does, its back face on the palm, the fingers wrapped round it
// and the thumb over its front face. The blade stands out past the thumb.
const PADDLE = { len: 0.28, width: 0.13, thick: 0.016, corner: 0.03, neck: 0.035, handle: 0.115, handleW: 0.026, butt: 0.012, lean: 0.25, seat: 0.02 };
// The gripping finger's centreline, knuckle to tip, curled `curl` at the knuckle and `bend`
// at each of the other joints (degrees), in the plane of the hand as fistPocket's; and its
// radius.
function fingerChain(H, curl, bend, f = 1) {
  const fl = FINGERS[f][1] * 0.106 * H;
  const lens = [FINGER_JOINTS[0], FINGER_JOINTS[1] - FINGER_JOINTS[0], 1 - FINGER_JOINTS[1]].map(k => k * fl);
  const pts = [[0, 0]];
  lens.forEach((l, i) => { const a = (curl + i * bend) * Math.PI / 180, [x, y] = pts[i]; pts.push([x + l * Math.cos(a), y + l * Math.sin(a)]); });
  return { pts, fR: FINGERS[f][2] * H * 0.9 };
}
// A flat handle in the fist: its cross-section a rounded rectangle, `a` half-width along
// the fingers, `b` half-thickness out of the palm, corners `rc`, slanting `lean` along
// the fingers per unit across, its centre `seat` in from the knuckles toward the heel of
// the palm (from the middle knuckle, across the middle of the hand). Finds how the
// fingers close on it there: the knuckle curl and the other joints' bend, and how far
// the handle rides off the palm (`back`, its back face, is the least; 2 mm at most), the
// fist as tightly closed as it can be with the middle finger's tip coming back over its
// front face, no finger more than 3 mm into it (skin gives) and the nearest within
// 2.5 mm, then with as much of the fingers as possible bearing on it (each finger with its own length and knuckle, and the handle where it
// crosses that finger). Returns the curl and bend, the centre (u, v, from the middle
// knuckle), and the middle finger's centreline and radius.
function flatGrip(H, a, b, rc, back, lean, seat) {
  const hl = 0.106 * H, u = -seat - lean * FINGERS[1][0] * FINGER_PITCH * H;
  let best = null, fallback = null;
  for (let curl = 40; curl <= 120; curl += 2) for (let bend = 50; bend <= 110; bend += 5) {
    const samp = [];
    let tip = null;
    FINGERS.forEach(([off, , , setBack], f) => {
      const ch = fingerChain(H, curl, bend, f), du = -setBack * hl - lean * off * FINGER_PITCH * H;
      for (let k = 0; k + 1 < ch.pts.length; k++) for (let t = 0; t <= 1; t += 1 / 12)
        samp.push([ch.pts[k][0] + (ch.pts[k + 1][0] - ch.pts[k][0]) * t + du, ch.pts[k][1] + (ch.pts[k + 1][1] - ch.pts[k][1]) * t, ch.fR]);
      if (f === 1) tip = [ch.pts[3][0] + du, ch.pts[3][1], ch.fR];
    });
    for (let lift = 0; lift <= 0.002; lift += 0.001) {
      const v = back + b + lift;
      const sd = (px, py) => {   // signed distance from the handle's outline
        const qx = Math.abs(px - u) - (a - rc), qy = Math.abs(py - v) - (b - rc);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc;
      };
      let c = Infinity, n = 0;
      for (const [x, y, r] of samp) { const e = sd(x, y) - r; c = Math.min(c, e); if (e < 0.003) n++; }
      const wraps = tip[1] > v && tip[0] < u + a && sd(tip[0], tip[1]) - tip[2] < 0.003;
      const { pts, fR } = fingerChain(H, curl, bend);
      const at = { curl, bend, u, v, clear: c, n, lift, pts, fR };
      const score = curl + bend + n * 0.5 - lift * 1000;   // clenched, bearing on it, low
      at.score = score;
      if (wraps && c >= -0.003 && c <= 0.0025) { if (!best || score > best.score) best = at; }
      else if (!fallback || Math.abs(c) < Math.abs(fallback.clear)) fallback = at;
    }
  }
  return best || fallback;
}
// Built in the right hand bone's frame, like the hairbrush. Returns, for placing it (see
// wideFit): `face`, the middle of the blade's striking face, and `faceN`, which way that
// face looks (the way the palm does); `axis`, along the board from handle to tip; the
// blade's half-length and half-width; the hand's own frame (`palmC`, the palm centre,
// `along` the fingers and `palmN` out of the palm); `grip`, the fist that holds it, and
// `thumbQ`, the thumb bone's turn onto the handle's front face; and
// `probes` as the hairbrush's, with `faceProbes` just the striking face's.
// The rod: a plain cylinder, a little longer than the paddle (46 cm to its 43) and as thick as the hair brush's handle
// (22 mm), held in the fist like the paddle's handle. It uses the paddle's grip and fit (`buildPaddle(g, true)`).
// How far the rod's line sinks into the higher site at contact (the press then flattens the skin round it).
const ROD_DEPTH = 0.004;
// How far (× the glute's height) the rod's strikes reach: from this far down from the top of the glute to this far down the thigh
// below the fold. Strikes favour the upper half of that range (ROD_UPPER of them land there).
const ROD_REACH = 0.25, ROD_UPPER = 0.7;
// The rod's own contact settings per position (pose-editor reports, 14:49, Kenji with Aya): `roll` is the angle its face turns
// from straight down about the line between the sites (where the default is the surface's own normal), `elbow` the upper
// arm's direction from the shoulder in the torso's frame, and, for hands on head, where the disciplinarian stands (`at`, m)
// and the strike's turn (`yawStrike`, degrees), which then holds for every beat.
// The rod raised in the spread-feet position (14:54 report, Kenji with Aya): the face centre from the right shoulder (m, 1.7 m
// tall), its normal and long axis (world), and the upper arm's direction from the shoulder (the elbow out to the side).
const ROD_RAISED_SPREAD = { face: [-0.122, 0.447, 0.164], faceN: [-0.323, -0.377, 0.868], axis: [0.830, 0.329, 0.451], elbow: [-0.987, 0.162, -0.011] };
const ROD_CONTACT = {
  lap:  { roll: 52.9, elbow: [-0.22, -0.612, -0.76] },
  case: { roll: 82.5, elbow: [-0.143, -0.882, 0.449] },
  head: { elbow: [0.231, -0.71, 0.665], at: [-0.249, -0.493], yawStrike: 1 },
  knees: { elbow: [-0.153, -0.881, 0.447] },
};
const ROD = { len: 0.43, width: 0.010, thick: 0.010, corner: 0.004, neck: 0, handle: 0.115, handleW: 0.010, butt: 0.012, lean: 0.25, seat: 0.02 };
function buildRod(g) { return buildPaddle(g, true); }
// A strike height along the rod's strip (0 … 11): ROD_UPPER of rolls fall in the upper half, the rest in the lower.
function rodRoll() { const up = Math.random() < ROD_UPPER; return (up ? 5.5 : 0) + Math.random() * 5.5; }
function buildPaddle(g, rod = false) {
  const H = g.spec.H, hl = 0.106 * H, side = 'R', P = rod ? ROD : PADDLE;
  const along = g.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(-1);   // out of the palm (right hand)
  const across = along.clone().cross(palmN).normalize();                                  // toward the thumb
  const knuckle = g.bones['fingers' + side].position.clone();
  const d = across.clone().addScaledVector(along, P.lean).normalize();   // along the board, toward the tip
  const w = palmN.clone().cross(d);                                      // across it, about along the fingers (d, w, palmN right-handed)
  const palmHalf = 0.0085 * H, hw = P.handleW / 2, bev = 0.004;
  // The handle's back face lies on the palm, and the fingers close round it.
  const grip = flatGrip(H, hw * Math.hypot(1, P.lean), P.thick / 2, bev + 0.002, palmHalf, P.lean, P.seat);
  const gripC = knuckle.clone().addScaledVector(along, grip.u).addScaledVector(palmN, grip.v);
  const toBoard = p => { const q = p.clone().sub(gripC); return new THREE.Vector3(q.dot(d), q.dot(w), q.dot(palmN)); };
  // Along the board from the grip's centre: the butt just past the little finger, and the
  // shoulders the handle's length on (further if the thumb needs it), then the neck and blade.
  const xb = -((-FINGERS[3][0]) * FINGER_PITCH * H + FINGERS[3][2] * H + P.butt), xs0 = xb + P.handle;
  // Signed distance from the handle (board coordinates), a box with rounded edges.
  const handleD = q => {
    const qx = Math.abs(q.x - (xb + xs0) / 2) - ((xs0 - xb) / 2 - bev), qy = Math.abs(q.y) - (hw - bev), qz = Math.abs(q.z) - (P.thick / 2 - bev);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - bev;
  };
  // The thumb comes round to the other side of the handle from the palm. Its centreline
  // (hand frame; the right hand's palm side is +x at rest), with its radius, turns at its
  // base: out of the palm (about the fingers' line), then across it (about the palm's
  // normal), the least that brings its pad to rest on the handle's front face, clear of
  // the curled index finger.
  // Its knuckle then bends it across (about the palm's normal, in the thumb's own frame),
  // so the last segment can lie on the face.
  const tb = g.bones['thumb' + side].position.clone(), tk = g.bones['thumb2' + side].position.clone(), thumb = [];
  for (let k = 0; k + 1 < THUMB.length; k++) for (let t = k ? 0.1 : 0; t <= 1.0001; t += 0.1) {
    const [k0, x0, z0, r0] = THUMB[k], [k1, x1, z1, r1] = THUMB[k + 1], m = (a, b) => a + (b - a) * t;
    const p = along.clone().multiplyScalar(m(k0, k1) * hl).add(new THREE.Vector3(m(x0, x1) * H, 0, m(z0, z1) * H)).sub(tb);
    thumb.push([k ? p.sub(tk) : p, m(r0, r1) * H, k]);   // the far segment relative to the knuckle
  }
  const fingers = [];   // the curled fingers' centrelines, with their radii
  FINGERS.forEach(([off, , , setBack], f) => {
    const ch = fingerChain(H, grip.curl, grip.bend, f);
    for (let k = 0; k + 1 < ch.pts.length; k++) for (let t = 0; t <= 1; t += 0.2) {
      const [ax, ay] = ch.pts[k], [bx, by] = ch.pts[k + 1];
      fingers.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t - setBack * hl).addScaledVector(palmN, ay + (by - ay) * t)
        .addScaledVector(across, off * FINGER_PITCH * H), ch.fR]);
    }
  });
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), v = new THREE.Vector3(), kw = new THREE.Vector3();
  const qp = new THREE.Quaternion();
  const pose = (al, be, ga, ph, pi) => {
    const Q = qb.setFromAxisAngle(palmN, be * DEG).clone().multiply(qp.setFromAxisAngle(across, pi * DEG)).multiply(qa.setFromAxisAngle(along, -al * DEG));
    const Q2 = new THREE.Quaternion().setFromAxisAngle(palmN.clone().multiplyScalar(Math.cos(ph * DEG)).addScaledVector(across, Math.sin(ph * DEG)), ga * DEG);
    return { Q, Q2, Qt: Q.clone().multiply(Q2) };
  };
  const place = ({ Q, Qt }, fn) => {
    kw.copy(tk).applyQuaternion(Q).add(tb);   // the knuckle, placed
    for (const [p, r, seg] of thumb) fn(seg ? v.copy(p).applyQuaternion(Qt).add(kw) : v.copy(p).applyQuaternion(Q).add(tb), r);
  };
  let thumbFit = null;
  const tryPose = (al, be, ga, ph, pi) => {
    const P2 = pose(al, be, ga, ph, pi);
    let near = Infinity, far = -Infinity, on = 0, off = false;
    place(P2, (v, r) => {
      const q = toBoard(v), dd = handleD(q) - r;
      near = Math.min(near, dd);
      far = Math.max(far, q.x + r);
      // Touching the handle's back face (that's the palm's), or the shoulders beyond it,
      // rules the pose out; its side, where the web of the thumb comes round, is allowed,
      // and each point on the front face counts toward the rest.
      if (dd < 0.002) { if (q.z < -P.thick / 2 + 0.002 || q.x > xs0) off = true; else if (q.z > P.thick / 2 - 0.001 && Math.abs(q.y) < hw - bev && q.x < xs0 - 0.015) on++; }
    });
    if (near < 0.0003 || off || !on) return;
    // Resting on it (not hovering), as much of the pad as will lie on the face, the last
    // segment across the handle rather than along it, turned the least.
    const cross = Math.abs(along.clone().applyQuaternion(P2.Qt).dot(w));
    const err = (near > 0.0015 ? 1 + near : 0) - 0.02 * on - 0.03 * cross + 0.0005 * al + 0.0005 * pi + 0.0003 * Math.abs(be) + 0.0003 * Math.abs(ga);
    if (thumbFit && err >= thumbFit.err) return;
    let fing = Infinity;   // clear of the curled fingers
    place(P2, (v, r) => { for (const [f, fr] of fingers) fing = Math.min(fing, v.distanceTo(f) - r - fr); });
    if (fing < -0.001) return;
    thumbFit = { err, Q: P2.Q, Q2: P2.Q2, near, al, be, ga, ph, pi, on, far };
  };
  // (Out of the palm, turned across it and lifted off it at the base; bent at the knuckle.)
  for (let al = 0; al <= 120; al += 6) for (let be = -60; be <= 40; be += 6) for (let pi = 0; pi <= 60; pi += 10)
    for (let ga = -80; ga <= 80; ga += 8) for (const ph of [0, 90]) tryPose(al, be, ga, ph, pi);
  if (thumbFit) {   // then finer, round the best
    const c = thumbFit;
    for (let al = c.al - 4; al <= c.al + 4; al += 2) for (let be = c.be - 4; be <= c.be + 4; be += 2) for (let pi = c.pi - 6; pi <= c.pi + 6; pi += 3)
      for (let ga = c.ga - 6; ga <= c.ga + 6; ga += 3) for (let ph = c.ph - 30; ph <= c.ph + 30; ph += 15) tryPose(al, be, ga, ph, pi);
  }
  const thumbQ = thumbFit ? [thumbFit.Q, thumbFit.Q2] : null;
  const xs = Math.max(xs0, thumbFit ? thumbFit.far + 0.006 : 0), xn = xs + P.neck, xt = xn + P.len;
  // One outline, blade and handle together, inset by the bevel the extrusion adds back.
  const hh = hw - bev, hy = P.width / 2 - bev, r = P.corner - bev, rb = hh * 0.8, e = xt - bev, b0 = xb + bev;
  const shape = new THREE.Shape();
  shape.moveTo(b0 + rb, -hh); shape.lineTo(xs, -hh);
  shape.bezierCurveTo(xs + P.neck * 0.55, -hh, xn - P.neck * 0.45, -hy, xn, -hy);
  shape.lineTo(e - r, -hy); shape.quadraticCurveTo(e, -hy, e, -hy + r);
  shape.lineTo(e, hy - r); shape.quadraticCurveTo(e, hy, e - r, hy);
  shape.lineTo(xn, hy); shape.bezierCurveTo(xn - P.neck * 0.45, hy, xs + P.neck * 0.55, hh, xs, hh);
  shape.lineTo(b0 + rb, hh); shape.quadraticCurveTo(b0, hh, b0, hh - rb);
  shape.lineTo(b0, -hh + rb); shape.quadraticCurveTo(b0, -hh, b0 + rb, -hh);
  let geo;
  if (rod) {
    // One round bar from the butt to the tip, its axis along the board's length.
    geo = new THREE.CylinderGeometry(P.thick / 2, P.thick / 2, xt - xb, 28);
    geo.rotateZ(Math.PI / 2); geo.translate((xb + xt) / 2, 0, 0);
  } else {
    geo = new THREE.ExtrudeGeometry(shape, { depth: P.thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
    geo.translate(0, 0, -(P.thick - 2 * bev) / 2);
  }
  geo.computeVertexNormals();
  const wood = new THREE.MeshStandardMaterial({ color: lin(rod ? 0xc99a5b : 0x6e4424), roughness: rod ? 0.4 : 0.5, metalness: 0 });
  const board = new THREE.Mesh(geo, wood);
  board.position.copy(gripC);
  board.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, w, palmN));
  board.castShadow = true;
  const grp = new THREE.Group();
  grp.add(board);
  g.bones['hand' + side].add(grp);
  // Probes (hand frame): the board's own vertices and the gripping fingers' centrelines,
  // as for the hairbrush; and the blade's striking face on its own, as a 1 cm grid (its
  // mesh has vertices only round the rim).
  const bladeC = gripC.clone().addScaledVector(d, xn + P.len / 2), faceC = bladeC.clone().addScaledVector(palmN, P.thick / 2);
  const probes = [], faceProbes = [];
  board.updateMatrix();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) probes.push([new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(board.matrix), 0]);
  const hx = P.len / 2 - bev;
  for (let x = -hx; x <= hx; x += 0.01) for (let y = -hy; y <= hy; y += 0.01) {
    const cx = Math.max(x - (hx - r), 0), cy = Math.max(Math.abs(y) - (hy - r), 0);
    if (Math.hypot(cx, cy) <= r) faceProbes.push([faceC.clone().addScaledVector(d, x).addScaledVector(w, y), 0]);
  }
  probes.push(...faceProbes);
  for (const [offF] of FINGERS) for (let k = 0; k + 1 < grip.pts.length; k++) for (let t = 0; t < 1; t += 0.25) {
    const [ax, ay] = grip.pts[k], [bx, by] = grip.pts[k + 1];
    probes.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t).addScaledVector(palmN, ay + (by - ay) * t)
      .addScaledVector(across, offF * FINGER_PITCH * H), grip.fR]);
  }
  return { grp, probes, faceProbes, wide: true, rod, face: faceC, faceN: palmN.clone(), axis: d, halfLen: P.len / 2, halfW: rod ? 0.008 : P.width / 2,   // (a rod's footprint is a narrow strip)
    palmC: along.clone().multiplyScalar(0.42 * hl), along, palmN, grip: { curl: grip.curl, bend: grip.bend },
    thumbQ, thumbFit: thumbFit && { near: thumbFit.near, al: thumbFit.al, be: thumbFit.be, ga: thumbFit.ga, ph: thumbFit.ph, pi: thumbFit.pi, on: thumbFit.on }, handleSpan: [xb, xs] };
}

// ── Wide implements: one blade across both contact sites ──
// The blade's pose comes first, and the hand follows from how the paddle sits in the
// fist. Contact is set (WIDE_CONTACT, below); the rest pose is searched:
//  - Roll: the blade's plane is found with its long axis along the line from the near
//    site (the subject's left, nearer the disciplinarian) to the far one, which is level:
//    whichever angle about that line leaves the least skin under the blade standing
//    above it, i.e. the plane that sits on the seat.
//  - Yaw within that plane: the blade may then turn off the line, up to WIDE_YAW, lying
//    diagonally across the seat (both sites stay on the face, and well inside it), tip
//    toward the far side. The palm faces the way the face does, so this is what lets the
//    forearm come in from the disciplinarian's side with the wrist near straight.
//  - Slide along its axis: off-centre toward either end, up to WIDE_SLIDE, sites permitting.
//  - Scoring: a gap between the face and either site is penalised (both should be touched),
//    as is turning or sliding far. Then, for each pose, every elbow position the upper arm
//    and forearm allow is tried, and scored on the wrist (extension and flexion, radial and
//    ulnar deviation, each with a comfortable range and a limit), the shoulder's range (the
//    elbow not drawn in behind the back, nor further behind the chest's plane than
//    SHOULDER_BACK, nor raised far above the shoulder),
//    the elbow clear of the torso, the shoulder's twist and the forearm clear of the
//    subject, as the hand's strike search is. Anything past a limit is heavily penalised
//    rather than dropped, so there's always a pose, the least bad.
// Cached, and refitted only when the sites or the shoulder have moved a centimetre. The fit
// is the contact pose, with the rest pose as its `rest`.
const WIDE_DEPTH = 0.005;   // the rest search's face this far into the (uncompressed) skin, before it's lifted clear
const WIDE_ARC = new THREE.Vector3(-0.14, 0, 0.05);   // the swing's outward bow at its middle (m, for 1.7 m tall)
// How far the subject's skin stands above a blade's face: the highest of the posed skin
// points `pts` (as posePatch returns them) inside the blade's footprint (centre `c`, long
// axis `a`, normal `n` out of the skin), measured along n from the face's plane. Only
// points up to the blade's thickness and a little beyond count (anything further is
// behind the blade, not through it). Exact for a flat face, and not fooled by creases.
function seatExcess(pts, c, n, a, T) {
  const b = n.clone().cross(a), top = PADDLE.thick + 0.03;
  let worst = -Infinity;
  for (let i = 0; i < pts.length; i += 6) {
    const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, dz = pts[i + 2] - c.z;
    const h = dx * n.x + dy * n.y + dz * n.z;
    if (h > top || h <= worst) continue;
    if (Math.abs(dx * a.x + dy * a.y + dz * a.z) > T.halfLen || Math.abs(dx * b.x + dy * b.y + dz * b.z) > T.halfW) continue;
    worst = h;
  }
  return worst;
}
// The subject's skin round the seat, as mesh indices (rest space, once per scene), and posed.
function seatPoints(scn) {
  if (!scn.seatPatch) scn.seatPatch = skinPatch(scn.s, scn.anchors.glute.index, 0.32);
  return posePatch(scn.s, scn.seatPatch);
}
// Signed clearance of an elbow outside the torso's cross-section (an ellipse, the larger
// of the underbust and waist rings, grown by the upper arm's thickness), in the torso's
// own frame: positive = clear. Unlike elbowClearance this lets it pass behind the back.
function elbowClearAround(ch, E) {
  const J = ch.spec.J, Y = ch.spec.Y, P = ch.spec.prims[0];
  const q = E.clone().applyMatrix4(ch.bones.spine1.matrixWorld.clone().invert()).add(new THREE.Vector3(...J.spine1));
  const r1 = loftRing(P, Y.under), r2 = loftRing(P, Y.waist), m = ch.spec.m.arm / 100 / (2 * Math.PI) + 0.012;
  const A = Math.max(r1[0], r2[0]) + m, z = q.z - (r1[3] + r2[3]) / 2, B = (z > 0 ? Math.max(r1[1], r2[1]) : Math.max(r1[2], r2[2])) + m;
  return (Math.hypot(q.x / A, z / B) - 1) * Math.min(A, B);
}
const WIDE_SLIDE = 0.045;   // the blade's centre off the sites' midpoint, along its axis, at most (m)
const WIDE_YAW = 32;        // degrees the blade may turn off the sites' line, within its own plane
// The blade at contact, against the sit spots, as set in the viewer's pose editor (Aya with
// Rin and with Kiko, the two averaged): its face turned `roll` degrees from facing straight
// down about the level line between the sites (so it faces up the body and down), its long
// axis along that line turned `yaw` degrees within the face's plane, its centre `slide`
// along the line toward the far site and `drop` below the sites' midpoint across the face
// (m, for 1.7 m tall), and the higher site `depth` into its face.
// `elbow`: the upper arm's direction from the shoulder, in the torso's (spine1) frame; the
// elbow goes to the point nearest it that the arm can reach. No comfort limits apply here:
// the wrist is well past its usual range, by choice.
// The blade raised, as set on Aya in the viewer's pose editor: its face centre from the
// right shoulder (m, for 1.7 m tall), the face's outward normal and long axis (world), the
// upper arm's direction from the shoulder (world; the elbow is put in that plane), and the
// fingers' pose (degrees, as the pose tables), eased in toward the top of the swing. Scaled
// by height, it suits Kenji as it is.
const WIDE_RAISED = { face: [-0.2491, 0.3825, 0.089], faceN: [0.651, -0.455, 0.607], axis: [0.185, 0.871, 0.454],
  elbow: [-0.3756, 0.247, -0.8932], fingers: [3, 0, 70] };
// Over the case the sites face backward and up rather than up the body, so the blade's roll is
// its own (from the viewer's pose editor); the raised blade is turned with the disciplinarian.
const CASE_WIDE_CONTACT = { roll: 82.5, yaw: 0, slide: 0, drop: 0.01, depth: 0.02, elbow: [-0.7, -0.45, -0.55] };
// The blade at rest over the case, from the viewer's pose editor (Kenji with Aya): held low at the
// right side, its face turned toward the subject. Face centre from the right shoulder (m, for 1.7 m
// tall), the face's normal and long axis, all in the frame before the disciplinarian's yaw.
const CASE_WIDE_REST = { face: [0.001, -0.661, 0.201], faceN: [0.967, -0.191, -0.167], axis: [0.135, -0.171, 0.976], elbow: [-0.174, -0.956, -0.237] };
function caseWideRest(yaw = CASE_YAW) {
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const R = CASE_WIDE_REST;
  return { face: rot(R.face), faceN: rot(R.faceN), axis: rot(R.axis), elbow: rot(R.elbow) };
}
function caseWideRaised(yaw = CASE_YAW) {
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const R = WIDE_RAISED;
  return { ...R, face: rot(R.face), faceN: rot(R.faceN), axis: rot(R.axis), elbow: rot(R.elbow) };
}
const WIDE_CONTACT = { roll: 58.2, yaw: 2.7, slide: 0.0083, drop: 0.0158, depth: 0.02, elbow: [-0.0771, -0.4957, -0.865] };
// How far the upper arm can go behind the plane of the chest, degrees. Measured from that
// plane rather than from hanging down, since the elbow can go back a long way once it's
// out to the side: a seated paddler's elbow is up and back, the forearm coming forward
// and down to the fist at the hip.
const SHOULDER_BACK = 50;
const DEG = Math.PI / 180;
// The hand's world rotation that turns the blade's long axis to `a` and its face to look
// at the skin (along −n).
function bladeHandQuat(T, a, n) {
  const Mh = new THREE.Matrix4().makeBasis(T.axis, T.faceN, T.axis.clone().cross(T.faceN)).transpose();
  const f = n.clone().negate();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, f, a.clone().cross(f)).multiply(Mh));
}
function wideFit(scn, posed, shR, palm) {
  const g = scn.g, s = scn.s, T = scn.tool;
  const site = key => {
    const strip = T.rod ? scn.anchors[key === 'foldL' ? 'rodL' : 'rodR'] : scn.anchors[key];
    if (T.rod) {
      // The rod lands anywhere up the glutes' height: `scn.rodT` runs from the fold (0) to the top of the strip (7).
      const k0 = Math.floor(clamp(scn.rodT, 0, strip.length - 1 - 1e-6)), f = clamp(scn.rodT, 0, strip.length - 1) - k0, a = posed(strip[k0]), b = posed(strip[Math.min(k0 + 1, strip.length - 1)]);
      const ps = { p: a.p.clone().lerp(b.p, f), n: a.n.clone().lerp(b.n, f).normalize() };
      return { skin: ps.p.clone().addScaledVector(ps.n, -palm), n: ps.n };
    }
    const ps = posed(strip[scn.atHead ? HEAD_STRIKE_K : STRIKE_K]); return { skin: ps.p.clone().addScaledVector(ps.n, -palm), n: ps.n.clone() };
  };
  const sL = site('foldL'), sR = site('foldR');
  const C = scn.fitCache.B;
  if (C && C.sh.distanceTo(shR) < 0.01 && C.L.distanceTo(sL.skin) < 0.01 && C.R.distanceTo(sR.skin) < 0.01) return C.fit;
  const t0 = performance.now();
  const mid = sL.skin.clone().add(sR.skin).multiplyScalar(0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const line = sR.skin.clone().sub(sL.skin).setY(0).normalize();          // level, near → far
  const seat = seatPoints(scn);
  // The hand's frame from the paddle's: the rotation taking the blade's axis to `a` and its
  // face to look at the skin (−n).
  const handQuat = (a, n) => bladeHandQuat(T, a, n);
  const L1 = g.bones.forearmR.position.length(), L2 = g.bones.handR.position.length(), palmOff = g.spec.H * 0.106 * 0.42;
  const rFore = g.spec.m.forearm / 100 / (2 * Math.PI);
  const torsoQ = g.bones.spine1.getWorldQuaternion(new THREE.Quaternion()).invert();
  const skinPts = seat;   // the forearm reaches down beside the seat, within its patch
  const forearmClear = (E, W) => { let worst = Infinity; for (const t of [0, 0.2, 0.4, 0.6, 0.8]) worst = Math.min(worst, skinSignedDist(skinPts, E.clone().lerp(W, t)) - rFore * 0.85); return worst; };
  const beyond = (x, lo, hi) => Math.max(0, lo - x, x - hi);
  // Every elbow position for a blade pose (`base`: a, n, Q, face and its own score `pose`),
  // scored as described above, into `list`. `anyWrist` keeps even those where the forearm
  // meets the hand at more than about 75° (dropped otherwise).
  const armCands = (list, base, step = 8, anyWrist = false) => {
    const { Q, face } = base;
    const f = T.along.clone().applyQuaternion(Q), p = T.palmN.clone().applyQuaternion(Q), t = f.clone().cross(p);
    const O = face.clone().sub(T.face.clone().applyQuaternion(Q));          // the hand bone's origin
    const P = O.clone().add(T.palmC.clone().applyQuaternion(Q));
    const W = P.clone().addScaledVector(f, -palmOff);
    Object.assign(base, { P, f, W });
    const SW = W.clone().sub(shR), dist = SW.length();
    if (dist >= (L1 + L2) * 0.995) { list.push({ ...base, err: 10 + dist, E: shR.clone().addScaledVector(SW, L1 / dist), bad: true }); return; }
    const dh = SW.divideScalar(dist), a1 = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h1 = Math.sqrt(Math.max(0, L1 * L1 - a1 * a1));
    const e1 = up.clone().addScaledVector(dh, -dh.y).normalize(), e2 = dh.clone().cross(e1);
    for (let ph = 0; ph < 360; ph += step) {
      const E = shR.clone().addScaledVector(dh, a1).addScaledVector(e1, h1 * Math.cos(ph * DEG)).addScaledVector(e2, h1 * Math.sin(ph * DEG));
      const u = W.clone().sub(E).divideScalar(L2), cf = u.dot(f);
      if (cf < 0.25 && !anyWrist) continue;
      // Wrist: + extension (the forearm comes down onto the back of the hand), − flexion;
      // + radial deviation (hand turned toward the thumb), − ulnar.
      const ext = Math.atan2(u.dot(p), cf) / DEG, dev = Math.atan2(u.dot(t), cf) / DEG;
      // Shoulder: the upper arm in the torso's frame (right arm: outward is −x).
      const ua = E.clone().sub(shR).applyQuaternion(torsoQ);
      const lat = -ua.x, back = Math.atan2(-ua.z, Math.hypot(ua.x, ua.y)) / DEG, raised = ua.y / L1;
      const outside = elbowClearAround(g, E), twist = humeralTwist(g, 'R', shR, E, W);
      const limits = beyond(ext, -60, 70) + beyond(dev, -40, 25) + Math.max(0, back - SHOULDER_BACK) + 100 * Math.max(0, -0.02 - lat) + 100 * Math.max(0, raised - 0.3);
      // (Ulnar deviation is how a paddle held like a racket comes into line with the
      // forearm, so it's comfortable further than radial.)
      const err = base.pose + 0.004 * (beyond(ext, -20, 40) + beyond(dev, -30, 12)) + 0.0008 * Math.abs(ext) + 0.0005 * Math.abs(dev)
        + 0.002 * Math.max(0, back - 35) + 0.05 * Math.max(0, raised - 0.1) - 0.08 * clamp(outside, 0, 0.12) + 0.06 * Math.max(0, twist - 1.05) + 0.05 * limits;
      list.push({ ...base, err, E, ext, dev, outside, twist, back, lat, bad: limits > 0 });
    }
  };
  // The best candidate whose elbow clears the torso and whose forearm clears the subject.
  const pick = cands => {
    cands.sort((x, y) => x.err - y.err);
    for (const c of cands.slice(0, 150)) {
      if (c.bad || c.outside < 0.02 || c.twist > 1.3) continue;
      c.clear = forearmClear(c.E, c.W);
      if (c.clear >= 0) return c;
    }
    return cands[0];
  };
  // Rest: roll, yaw and slide searched as described above (the plane that sits on the seat).
  const restCands = [];
  // Roll: n turns about the level line from straight up; coarse, then fine.
  const nAt = th => up.clone().applyAxisAngle(line, th * DEG);
  let rest;
  if (scn.wideRest) {
    // Fixed rest pose (set per position): the blade held at the side, placed from the shoulder.
    const R = scn.wideRest, fN = new THREE.Vector3(...R.faceN).normalize(), ax = new THREE.Vector3(...R.axis);
    ax.addScaledVector(fN, -ax.dot(fN)).normalize();
    const nR = fN.clone().negate(), faceR = shR.clone().addScaledVector(new THREE.Vector3(...R.face), g.spec.H / 1.7);
    armCands(restCands, { yaw: 0, slide: 0, a: ax, n: nR, e: 0, gap: 0, Q: handQuat(ax, nR), face: faceR, roll: 0, pose: 0 }, 4, true);
    // The elbow goes to the candidate nearest the set direction (the upper arm hanging by the side).
    const Er = shR.clone().addScaledVector(new THREE.Vector3(...R.elbow).normalize(), L1);
    rest = restCands.reduce((m, c) => !m || c.E.distanceTo(Er) < m.E.distanceTo(Er) ? c : m, null);
    Object.assign(rest, { palmC: rest.P, faceRest: faceR.clone(), pole: new THREE.Vector3(...R.elbow).normalize().multiplyScalar(0.5) });
  } else {
    let roll = { e: Infinity };
    for (let th = -78; th <= 78; th += 6) { const n = nAt(th), e = seatExcess(seat, mid, n, line, T); if (e < roll.e) roll = { th, n, e }; }
    for (let th = roll.th - 5; th <= roll.th + 5; th += 1) { const n = nAt(th), e = seatExcess(seat, mid, n, line, T); if (e < roll.e) roll = { th, n, e }; }
    const n = roll.n;
    for (let yaw = -WIDE_YAW; yaw <= WIDE_YAW; yaw += 4) {
      const a = line.clone().applyAxisAngle(n, yaw * DEG);
      const b = n.clone().cross(a), Q = handQuat(a, n);
      for (let slide = -WIDE_SLIDE; slide <= WIDE_SLIDE + 1e-6; slide += 0.01) {
        const c = mid.clone().addScaledVector(a, slide);
        // Both sites well inside the blade: 3 cm from its ends, 2.5 cm from its sides.
        const inside = sp => { const d = sp.skin.clone().sub(c); return Math.abs(d.dot(a)) <= T.halfLen - 0.03 && Math.abs(d.dot(b)) <= (T.rod ? T.halfW : T.halfW - 0.025); };
        if (!inside(sL) || !inside(sR)) continue;
        const e = seatExcess(seat, c, n, a, T);
        // How far each site is below the face's plane (0 = touching).
        const gap = Math.max(e - sL.skin.clone().sub(c).dot(n), e - sR.skin.clone().sub(c).dot(n));
        const face = c.clone().addScaledVector(n, e - WIDE_DEPTH);
        armCands(restCands, { yaw, slide, a, n, e, gap, Q, face, roll: roll.th, pose: 4 * gap + 0.0004 * Math.abs(yaw) + 0.1 * Math.abs(slide) });
      }
    }
  rest = pick(restCands);
  Object.assign(rest, { palmC: rest.P, faceRest: rest.face.clone().addScaledVector(rest.n, WIDE_DEPTH + REST_GAP) });
  }
  // Contact: the blade against the sit spots (WIDE_CONTACT), its face WIDE_CONTACT.depth
  // into the higher of the two sites. The glutes above them stand well through its plane;
  // the press flattens them onto the face (see updateScene).
  const W_ = scn.wideContact;
  // The rod lies along the skin where it lands: its face is the sites' mean surface normal (squared to the line between them),
  // not a set roll, since the surface turns up the height of the glutes.
  let cn = nAt(W_.roll);
  if (T.rod && !W_.keepRoll) { cn = sL.n.clone().add(sR.n).normalize(); cn.addScaledVector(line, -cn.dot(line)).normalize(); }
  const cb = cn.clone().cross(line);
  const cc = mid.clone().addScaledVector(line, W_.slide * g.spec.H / 1.7).addScaledVector(cb, T.rod ? 0 : -W_.drop * g.spec.H / 1.7);
  let hi = Math.max(sL.skin.clone().sub(cc).dot(cn), sR.skin.clone().sub(cc).dot(cn));
  // Standing, the glutes' rear-most skin stands well proud of the low sites: the blade meets that.
  if (scn.atHead) {
    const ca0 = line.clone().applyAxisAngle(cn, W_.yaw * DEG), cb0 = cn.clone().cross(ca0);
    for (let i = 0; i < seat.length; i += 6) {
      const dx = seat[i] - cc.x, dy = seat[i + 1] - cc.y, dz = seat[i + 2] - cc.z;
      if (Math.abs(dx * ca0.x + dy * ca0.y + dz * ca0.z) > T.halfLen || Math.abs(dx * cb0.x + dy * cb0.y + dz * cb0.z) > T.halfW) continue;
      hi = Math.max(hi, dx * cn.x + dy * cn.y + dz * cn.z);
    }
  }
  const contactCands = [];
  const ca = line.clone().applyAxisAngle(cn, W_.yaw * DEG);
  armCands(contactCands, { yaw: W_.yaw, slide: W_.slide, a: ca, n: cn, Q: handQuat(ca, cn), face: cc.addScaledVector(cn, hi - ((T.rod ? ROD_DEPTH : W_.depth) - (scn.clothLift || 0))), roll: W_.roll, pose: 0 }, 1, true);
  const Epref = shR.clone().addScaledVector(new THREE.Vector3(...W_.elbow).normalize().applyQuaternion(torsoQ.clone().invert()), L1);
  const fit = contactCands.reduce((m, c) => !m || c.E.distanceTo(Epref) < m.E.distanceTo(Epref) ? c : m, null);
  Object.assign(fit, { p: fit.P, palmC: fit.P, skin: mid, skinL: sL.skin, skinR: sR.skin, tiltDeg: 0, rest, ms: performance.now() - t0 });
  scn.fitCache.B = { sh: shR.clone(), L: sL.skin.clone(), R: sR.skin.clone(), fit };
  return fit;
}

// ── Finger joints ──
// Each hand's fingers are one bone (the knuckle; setFingerCurl), so on their own they
// can only tilt straight. The middle and end joints are bent in the vertex shader, in
// the rest pose before skinning: every vertex carried by a fingers bone and past a
// joint (FINGER_JOINTS, fractions of the middle finger's length from the knuckle) is
// turned about that joint by the hand's bend angle, the far joint first, so the
// finger rolls up. Normals turn with it. Off (0) unless something is gripped.
const FINGER_JOINTS = [0.42, 0.72];
const FINGER_BEND_GLSL = `
  uniform vec3 uFingerK[2], uFingerDir[2];
  uniform vec2 uFingerBend;
  uniform vec3 uFingerJ;
  vec3 fbRot(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
  void bendFingers(inout vec3 p, inout vec3 nrm) {
    for (int i = 0; i < 2; i++) {
      float a = i == 0 ? uFingerBend.x : uFingerBend.y;
      if (a <= 0.0) continue;
      float idx = i == 0 ? ${BONES.indexOf('fingersL')}.0 : ${BONES.indexOf('fingersR')}.0;
      float w = 0.0;
      if (abs(skinIndex.x - idx) < 0.5) w += skinWeight.x;
      if (abs(skinIndex.y - idx) < 0.5) w += skinWeight.y;
      if (abs(skinIndex.z - idx) < 0.5) w += skinWeight.z;
      if (abs(skinIndex.w - idx) < 0.5) w += skinWeight.w;
      if (w < 0.01) continue;
      float sgn = i == 0 ? -1.0 : 1.0;
      vec3 K = uFingerK[i], D = uFingerDir[i];
      float d = dot(p - K, D);
      for (int j = 0; j < 2; j++) {
        float jd = j == 0 ? uFingerJ.y : uFingerJ.x;          // the end joint, then the middle
        float t = smoothstep(jd - uFingerJ.z, jd + uFingerJ.z, d);
        if (t <= 0.0) continue;
        float ang = sgn * a * t * w;
        vec3 P = K + D * jd;
        p = P + fbRot(p - P, ang);
        nrm = fbRot(nrm, ang);
      }
    }
  }
`;
// The middle and end joints' bend, degrees each (0 = straight).
function setFingerBend(ch, side, deg) {
  ch.mesh.material.userData.uniforms.uFingerBend.value[side === 'L' ? 'x' : 'y'] = Math.max(0, deg) * Math.PI / 180;
}

// Finger curl, degrees toward the palm (negative bends them back).
function setFingerCurl(ch, side, deg) {
  const b = ch.bones['fingers' + side];
  b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, side === 'L' ? -1 : 1), deg * Math.PI / 180);
  b.updateMatrixWorld(true);
}
// The smallest curl (within [lo, hi] degrees) at which the middle finger's pad
// touches the surface given by `dist` (signed distance, world space).
function wrapFingers(ch, side, dist, lo = -8, hi = 40) {
  const hl = ch.spec.H * 0.106, r = FINGERS[1][2] * ch.spec.H * 0.86;
  const along = ch.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(side === 'L' ? 1 : -1);
  const pad = along.multiplyScalar(hl * FINGERS[1][1] - r).addScaledVector(palmN, r);
  const fb = ch.bones['fingers' + side], w = new THREE.Vector3();
  for (let deg = lo; deg <= hi; deg += 2) {
    setFingerCurl(ch, side, deg);
    if (dist(fb.localToWorld(w.copy(pad))) <= 0.001) return deg;
  }
  return hi;
}
// The subject's mesh vertices within `radius` (rest space) of vertex `index`, and
// those vertices posed (positions + normals, world space) for contact tests.
function skinPatch(ch, index, radius) {
  const pos = ch.mesh.geometry.attributes.position, c = new THREE.Vector3().fromBufferAttribute(pos, index), v = new THREE.Vector3();
  const idx = [];
  for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).distanceToSquared(c) < radius * radius) idx.push(i);
  return idx;
}
function posePatch(ch, idx) {
  const geo = ch.mesh.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, si = geo.attributes.skinIndex;
  const inv = ch.mesh.skeleton.boneInverses;
  const mats = ch.mesh.skeleton.bones.map((b, i) => b.matrixWorld.clone().multiply(inv[i]));
  const pts = new Float32Array(idx.length * 6), v = new THREE.Vector3(), n = new THREE.Vector3();
  idx.forEach((i, k) => {
    ch.mesh.boneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(ch.mesh.matrixWorld);
    n.fromBufferAttribute(nrm, i).transformDirection(mats[si.getX(i)]);
    pts[6 * k] = v.x; pts[6 * k + 1] = v.y; pts[6 * k + 2] = v.z; pts[6 * k + 3] = n.x; pts[6 * k + 4] = n.y; pts[6 * k + 5] = n.z;
  });
  return pts;
}

// Contact anchors on the subject, in rest space: march out from a point on the
// bone axis along the back direction (−Z) until the skin surface, and keep that
// point, its surface normal, and the bone that carries it.
function sceneAnchors(s) {
  const spec = s.spec, Y = spec.Y, J = spec.J, H = spec.H;
  const pos = s.mesh.geometry.attributes.position, v = new THREE.Vector3();
  const toSurface = (bone, origin, dz = -1) => {
    const p = origin.slice();
    for (let i = 0; i < 400 && field(spec, p) < 0; i++) p[2] += dz * 0.001;
    const n = norm(gradient(spec, p, 0.0015, field(spec, p)));
    // Nearest mesh vertex to the surface point; its skinned position is tracked per frame.
    const sp = new THREE.Vector3(...p);
    let index = 0, best = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = v.fromBufferAttribute(pos, i).distanceToSquared(sp);
      if (d < best) { best = d; index = i; }
    }
    return { bone, index, n: new THREE.Vector3(...n) };
  };
  const kneeAt = side => {
    const a = J['thigh' + side], b = J['shin' + side];
    // The resting hand's place: the back of the thigh, above anything lowered to the knee.
    return [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5), lerp(a[2], b[2], 0.5)];
  };
  // Strike points: the lower glute where it meets the thigh, one per side.
  const hipA = loftRing(spec.prims[0], Y.hip)[0];
  const foldY = Y.crotch - 0.068 * H;   // the glute/thigh junction, below the crotch line
  return {
    // Resting left hand: mid-back, just below the underbust line (below Aya's top).
    shoulders: toSurface('spine1', [0, Y.under - 0.03 * H, 0]),
    glute: toSurface('pelvis', [0, Y.hip - 0.03 * H, 0]),
    // Over the case the resting left hand lies on the small of the back.
    lowback: toSurface('spine1', [0, Y.waist - 0.02 * H, 0]),
    // Hands on head: the disciplinarian's left hand rests against the navel (front, so marching +Z).
    navel: toSurface('spine1', [0.0506 * H, Y.waist - 0.007 * H, 0], 1),
    // ... and the swinging hand rests by the near cheek (the subject's left, as the strike strip's x).
    cheekL: toSurface('pelvis', [hipA * 0.42, Y.hip - 0.03 * H, 0]),
    // A short strip of candidates per side, from the fold (index 0) up toward the
    // glute; the strike search prefers the lowest one the arm can reach flat.
    foldL: [0, 1, 2, 3, 4, 5, 6, 7].map(k => toSurface('pelvis', [hipA * 0.42, lerp(foldY, Y.hip - 0.035 * H, k / 7), 0])),
    foldR: [0, 1, 2, 3, 4, 5, 6, 7].map(k => toSurface('pelvis', [-hipA * 0.42, lerp(foldY, Y.hip - 0.035 * H, k / 7), 0])),
    // The rod's strike strip, from a quarter of the glute's height down the thigh below the fold (index 0) to a quarter
    // of the way down from its top (last): points on the skin, skinned by the pelvis above the fold and the thigh below it.
    ...Object.fromEntries(['L', 'R'].map(side => {
      const sgn = side === 'L' ? 1 : -1, top = Y.hip - 0.035 * H, G = top - foldY, lo = foldY - ROD_REACH * G, hi = top - ROD_REACH * G, N = 12;
      return ['rod' + side, Array.from({ length: N }, (_, k) => {
        const y = lerp(lo, hi, k / (N - 1)), below = clamp((foldY - y) / (ROD_REACH * G), 0, 1);
        const x = sgn * lerp(hipA * 0.42, Math.abs(J['thigh' + side][0]), below);
        return toSurface(y < foldY ? 'thigh' + side : 'pelvis', [x, y, 0]);
      })];
    })),
    kneeL: toSurface('thighL', kneeAt('L')),
    kneeR: toSurface('thighR', kneeAt('R')),
  };
}

// ── Marks: colour building up where the palm lands, one site per side ──
// Each impact moves that side's centre toward where it landed (in rest space,
// through the pelvis bone, so the mark stays put however the body moves) and adds
// one to its count. Strength f follows markStrength: barely there for the first few
// (3 smacks ≈ 3%), 39% by 10, then slowing, logarithmically, to full depth at 100. The colour spreads
// out from the centre as it deepens, at the same rate: at f the tinted area reaches
// f of the way to the edge of that side's region, the whole glute and the first
// top of the thigh: full to the crease where the thigh meets the glute, then fading
// out over MARK_THIGH down the thigh, following the crease's curve. At full strength
// all of the glute is MARK_COLOR.
// Only the skin is tinted; clothing layers are painted over it.
const MARK_COLOR = 0x8e1a1f, MARK_THIGH = 0.03, MARK_HALF = 12, MARK_POW = 2.5;
// The region a side's colour can cover, in rest space. The top stops just below the
// waistband of the character's own underwear (its briefs' `rise`), so no colour shows
// above it; the shader's fade at the top edge ends 2 mm short of the band.
function markRegion(spec) {
  const Y = spec.Y, H = spec.H, briefs = spec.m.wardrobe && spec.m.wardrobe.briefs;
  // The band's lowest point across the back region, which reaches round to the side seam.
  const band = briefs ? Math.min(briefsWaist(spec, briefs, 1), briefsWaist(spec, briefs, 2)) : Infinity;
  return { yLow: Y.crotch - 0.068 * H - MARK_THIGH * H / 1.7, yTop: Math.min(Y.hip + 0.035 * H, band - 0.012), xSide: loftRing(spec.prims[0], Y.hip)[0] * 0.95 };
}
// Up to MARK_KNEE smacks on a side the strength follows the S-curve (barely there for
// the first few, 3 ≈ 3%, 10 ≈ 39%). Beyond that it's logarithmic, reaching full depth at
// MARK_FULL smacks on a side, so each further step of depth takes more smacks than
// the last: 20 ≈ 57%, 30 ≈ 68%, 50 ≈ 82%, 100 = 100% (200 smacks across both sides).
const MARK_KNEE = 10, MARK_FULL = 100;
const markHill = n => n <= 0 ? 0 : n ** MARK_POW / (n ** MARK_POW + MARK_HALF ** MARK_POW);
const MARK_AT_KNEE = markHill(MARK_KNEE);
const markStrength = n => n <= MARK_KNEE ? markHill(n)
  : Math.min(1, MARK_AT_KNEE + (1 - MARK_AT_KNEE) * Math.log(n / MARK_KNEE) / Math.log(MARK_FULL / MARK_KNEE));
// Fading, two ways:
//  - Dancing: each move performed keeps MARK_FADE_MOVE of the strength, so a full
//    routine (MARK_ROUTINE moves) takes 100% down to MARK_AFTER_ROUTINE at any tempo.
//  - Time: all the time (off stage too), proportionally, tuned so that over a typical
//    cycle, MARK_CYCLE_MIN minutes from one correction to the same character's next,
//    with its MARK_CYCLE_ROUTINES routines danced, 100% ends at MARK_AFTER_CYCLE.
//    Time can never take more than that cycle's share since that side's last smack
//    (MARK_TIME_FLOOR), so however long a player takes, a mark is at least
//    MARK_AFTER_CYCLE by the next correction.
// Set ch.marksHeld to pause both (the game holds marks steady through the finale).
// Smacks after some fading build on what's left: the remaining strength counts as the
// number of smacks that would give it (markCount), plus one.
const MARK_ROUTINE = 12, MARK_AFTER_ROUTINE = 0.55;
const MARK_FADE_MOVE = Math.pow(MARK_AFTER_ROUTINE, 1 / MARK_ROUTINE);
const MARK_CYCLE_MIN = 6, MARK_CYCLE_ROUTINES = 1, MARK_AFTER_CYCLE = 0.25;
const MARK_TIME_FLOOR = MARK_AFTER_CYCLE / Math.pow(MARK_AFTER_ROUTINE, MARK_CYCLE_ROUTINES);   // ≈ 0.45
const MARK_KEEP_PER_SEC = Math.pow(MARK_TIME_FLOOR, 1 / (MARK_CYCLE_MIN * 60));
// The number of smacks that gives strength f (markStrength's inverse, for building on a faded mark).
const markCount = f => f <= 0 ? 0 : f <= MARK_AT_KNEE ? MARK_HALF * Math.pow(f / (1 - f), 1 / MARK_POW)
  : MARK_KNEE * Math.pow(MARK_FULL / MARK_KNEE, (Math.min(f, 1) - MARK_AT_KNEE) / (1 - MARK_AT_KNEE));
// `weight`: how many hand smacks this one counts as (an implement's mark weight).
function addMark(ch, side, pointW, weight = 1) {
  const i = BONES.indexOf('pelvis');
  const M = ch.bones.pelvis.matrixWorld.clone().multiply(ch.mesh.skeleton.boneInverses[i]).invert();
  const p = pointW.clone().applyMatrix4(M);
  ch.marks = ch.marks || { L: { n: 0, c: null, f: 0, t: 1 }, R: { n: 0, c: null, f: 0, t: 1 } };
  const m = ch.marks[side];
  m.n = markCount(m.f) + weight;
  m.f = markStrength(m.n);
  m.t = 1;   // the time fade's allowance restarts with each smack
  m.c = m.c ? m.c.lerp(p, 1 / Math.min(m.n, 8)) : p;   // a running centre, settling as smacks accumulate
  applyMarks(ch);
}
// ── Stripes (the rod) ──
// Each contact leaves a stripe where the bar actually touched: at the height it landed (rest space, through the pelvis, so it
// stays put as the body moves), across the length of the bar (not the cleft it bridges, nor beyond its ends). Each adds
// STRIPE_ADD of full colour; where several overlap they add up, and the colour goes from red toward purple as it deepens.
const STRIPES_FRESH = 6, STRIPE_GONE_PER_SEC = 0.02;   // older stripes keep this share per second
const STRIPE_ADD = 0.15, STRIPES_MAX = 32, STRIPE_HALF = 0.0035;   // (a stripe is a little under the rod's 10 mm: 7 mm)
function addStripe(ch, pointW, axisW, halfLen) {
  const i = BONES.indexOf('pelvis');
  const inv = ch.bones.pelvis.matrixWorld.clone().multiply(ch.mesh.skeleton.boneInverses[i]).invert();
  const c = pointW.clone().applyMatrix4(inv);
  const e1 = pointW.clone().addScaledVector(axisW, halfLen).applyMatrix4(inv), e2 = pointW.clone().addScaledVector(axisW, -halfLen).applyMatrix4(inv);
  ch.stripes = ch.stripes || [];
  ch.stripes.push({ y: c.y, x0: Math.min(e1.x, e2.x), x1: Math.max(e1.x, e2.x), a: STRIPE_ADD, a0: STRIPE_ADD });
  if (ch.stripes.length > STRIPES_MAX) ch.stripes.shift();
  // Only the latest STRIPES_FRESH keep the marks' slow fading; any older ones go almost at once (see fadeMarks).
  ch.stripes.forEach((s, k) => { if (k < ch.stripes.length - STRIPES_FRESH) s.old = true; });
  applyStripes(ch);
}
function applyStripes(ch) {
  const u = ch.mesh.material.userData.uniforms, S = ch.stripes || [];
  u.uStripeN.value = S.length;
  S.forEach((s, k) => u.uStripe.value[k].set(s.y, s.a, s.x0, s.x1));
}
// Call every frame for every character, on stage or not.
function fadeMarks(ch, dt) {
  if (ch.stripes && ch.stripes.length && !ch.marksHeld) {
    const keep = Math.pow(MARK_KEEP_PER_SEC, dt);
    const gone = Math.pow(STRIPE_GONE_PER_SEC, dt);
    for (const s of ch.stripes) s.a = s.old ? s.a * gone : Math.max(s.a * keep, s.a0 * MARK_AFTER_CYCLE);
    if (ch.stripes.some(s => s.old && s.a < 0.003)) ch.stripes = ch.stripes.filter(s => !(s.old && s.a < 0.003));
    applyStripes(ch);
  }
  if (!ch.marks || ch.marksHeld) return;
  const keep = Math.pow(MARK_KEEP_PER_SEC, dt);
  for (const side of ['L', 'R']) {
    const m = ch.marks[side];
    if (m.t == null) m.t = 1;
    if (m.f <= 0 || m.t <= MARK_TIME_FLOOR) continue;
    const k = Math.max(keep, MARK_TIME_FLOOR / m.t);   // never past this cycle's share
    m.f *= k; m.t *= k;
  }
  applyMarks(ch);
}
// One dance move performed (see createDancer).
function fadeMarksMove(ch) {
  if (ch.stripes && !ch.marksHeld) { for (const s of ch.stripes) s.a *= MARK_FADE_MOVE; ch.stripes = ch.stripes.filter(s => s.a >= 0.005); applyStripes(ch); }
  if (!ch.marks || ch.marksHeld) return;
  for (const side of ['L', 'R']) { const m = ch.marks[side]; m.f *= MARK_FADE_MOVE; if (m.f < 0.005) { m.f = 0; m.n = 0; m.c = null; } }
  if (!ch.marks.L.f && !ch.marks.R.f) ch.marks = null;
  applyMarks(ch);
}
function clearMarks(ch) { ch.marks = null; ch.stripes = null; applyMarks(ch); applyStripes(ch); }
// Copies one character's marks onto another built from the same person (the viewer's
// scene uses its own copies of the pair).
function copyMarks(from, to) {
  to.stripes = from.stripes ? from.stripes.map(s => ({ ...s })) : null; applyStripes(to);
  to.marks = from.marks ? Object.fromEntries(['L', 'R'].map(s => [s, { ...from.marks[s], c: from.marks[s].c && from.marks[s].c.clone() }])) : null;   // (f, n, t and the centre)
  applyMarks(to);
}
function applyMarks(ch) {
  const u = ch.mesh.material.userData.uniforms, R = markRegion(ch.spec);
  u.uMarkRegion.value.set(R.yLow, R.yTop, R.xSide, MARK_THIGH * ch.spec.H / 1.7);
  ['L', 'R'].forEach((side, k) => {
    const m = ch.marks && ch.marks[side];
    u.uMarkAmt.value[k] = m && m.c ? m.f : 0;
    if (!m || !m.c) return;
    u.uMarkP.value[k].copy(m.c);
    // Per-axis reach from the centre to the region's edges (up, down, sideways), so
    // spreading to 1 in these units covers the whole region.
    const c = m.c, s = k === 0 ? 1 : -1;
    u.uMarkReach.value[k].set(Math.max(0.02, R.yTop - c.y), Math.max(0.02, c.y - R.yLow), Math.max(0.03, R.xSide - s * c.x, s * c.x));
  });
}

// Sets the contact-compression uniforms on a character's body material from a
// world-space palm plane (point on the palm surface, outward skin-side normal).
// First slot only: `axisW` and `halfLen` stretch the footprint along a line in the plane
// (a paddle's blade), the radius then measured from that segment, and `depth` is how far
// above the plane skin is still flattened.
function setPress(ch, pointW, normalW, radius, amount, slot = '', axisW = null, halfLen = 0, depth = 0.02) {
  const u = ch.mesh.material.userData.uniforms;
  const inv = ch.mesh.matrixWorld.clone().invert();
  u['uPressP' + slot].value.copy(pointW).applyMatrix4(inv);
  u['uPressN' + slot].value.copy(normalW).transformDirection(inv);
  u['uPressR' + slot].value = radius;
  u['uPressAmt' + slot].value = amount;
  if (!slot) {
    u.uPressDepth.value = depth;
    if (!axisW) u.uPressAx.value.set(0, 0, 0, 0);
    else { const ax = axisW.clone().transformDirection(inv); u.uPressAx.value.set(ax.x, ax.y, ax.z, halfLen); }
  }
}

// Presses `ch`'s skin against the four fingers of `hand`'s `side` hand, at the hand's current
// curl, `amount` (0–1) in contact. Several hands add up: pass `append` to keep the earlier
// ones. The fingers are straight capsules on the finger bone, as built (see FINGERS).
function setFingerCaps(ch, hand, side, amount, append = false) {
  const u = ch.mesh.material.userData.uniforms, H = hand.spec.H;
  if (!append) u.uCapN.value = 0;
  if (amount <= 0) return;
  const fb = hand.bones['fingers' + side], inv = ch.mesh.matrixWorld.clone().invert();
  fb.updateMatrixWorld(true);
  const dir = fb.position.clone().normalize(), across = new THREE.Vector3(0, 0, 1), handLen = 0.106 * H;
  for (const [off, lenF, rF, back] of FINGERS) {
    if (u.uCapN.value >= CAPS) return;
    const r = rF * H * 0.95;
    const k0 = dir.clone().multiplyScalar(-handLen * back).addScaledVector(across, off * FINGER_PITCH * H);
    const a = k0.clone().addScaledVector(dir, r), b = k0.clone().addScaledVector(dir, handLen * lenF - r);
    const i = u.uCapN.value++;
    u.uCapA.value[i].set(...fb.localToWorld(a).applyMatrix4(inv).toArray(), r);
    u.uCapB.value[i].set(...fb.localToWorld(b).applyMatrix4(inv).toArray(), amount);
  }
}

// Posed skin points (with approximate normals) within `radius` of `centre`, for
// clearance tests against the subject as actually rendered.
function posedSkinNear(ch, centre, radius) {
  const geo = ch.mesh.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, si = geo.attributes.skinIndex;
  const pts = [], v = new THREE.Vector3(), r2 = radius * radius, inv = ch.mesh.skeleton.boneInverses;
  const mats = ch.mesh.skeleton.bones.map((b, i) => b.matrixWorld.clone().multiply(inv[i]));
  for (let i = 0; i < pos.count; i += 2) {
    ch.mesh.boneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(ch.mesh.matrixWorld);
    if (v.distanceToSquared(centre) > r2) continue;
    const n = new THREE.Vector3().fromBufferAttribute(nrm, i).transformDirection(mats[si.getX(i)]);
    pts.push(v.x, v.y, v.z, n.x, n.y, n.z);
  }
  return new Float32Array(pts);
}
// Signed distance from `q` to the nearest skin point (positive = outside the body).
function skinSignedDist(pts, q) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < pts.length; i += 6) {
    const dx = q.x - pts[i], dy = q.y - pts[i + 1], dz = q.z - pts[i + 2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  const dx = q.x - pts[bi], dy = q.y - pts[bi + 1], dz = q.z - pts[bi + 2];
  return Math.sign(dx * pts[bi + 3] + dy * pts[bi + 4] + dz * pts[bi + 5]) * Math.sqrt(best);
}

// Half-width an elbow must stay beyond, measured from the torso's centre line:
// the chest's half-width plus the upper arm's thickness and a little clearance.
function torsoHalfWidth(ch) {
  const chest = Math.max(loftRing(ch.spec.prims[0], ch.spec.Y.under)[0], loftRing(ch.spec.prims[0], ch.spec.Y.waist)[0]);
  return chest + ch.spec.m.arm / 100 / (2 * Math.PI) + 0.012;
}
// Signed clearance of an elbow outside the torso, in the torso's own frame
// (so leans and twists are respected): positive = clear, on its own side.
function elbowClearance(ch, side) {
  const e = ch.bones['forearm' + side].getWorldPosition(new THREE.Vector3())
    .applyMatrix4(ch.bones.spine1.matrixWorld.clone().invert());
  return (side === 'L' ? e.x : -e.x) - torsoHalfWidth(ch);
}
// armIK that keeps the elbow outside the torso: if it lands inside, push the pole
// outward (along the torso's side axis) and solve again.
function armIKClear(ch, side, target, pole, ...rest) {
  const P = pole.clone();
  const out = new THREE.Vector3(side === 'L' ? 1 : -1, 0, 0).transformDirection(ch.bones.spine1.matrixWorld);
  for (let i = 0; i < 6; i++) {
    armIK(ch, side, target, P, ...rest);
    const c = elbowClearance(ch, side);
    if (c >= 0) break;
    P.addScaledVector(out, -c + 0.08 * (i + 1));
  }
}

// Failsafe for a hand that can't lay its palm on the floor: flex the wrist so the
// fingertips come down onto the floor if they can reach it, otherwise point them
// straight at it. The floor always wins: the tip (allowing for the hand's
// thickness) never goes below it, even if that means exceeding the wrist limit.
const FLOOR_EPS = 0.003;
const WRIST_MAX = 70 * Math.PI / 180;
function placeFingertips(ch, side) {
  const fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const W = ha.getWorldPosition(new THREE.Vector3());
  const foreDir = W.clone().sub(fo.getWorldPosition(new THREE.Vector3())).normalize();
  const tipLen = ch.spec.H * 0.106 * 0.9, halfThick = ch.spec.H * 0.0085 * 0.5;
  const floorY = FLOOR_EPS + halfThick;
  const h = W.y - floorY;                       // wrist height above where the tip may go
  const horiz = new THREE.Vector3(foreDir.x, 0, foreDir.z);
  if (horiz.lengthSq() < 1e-4) horiz.set(1, 0, 0);   // toward the subject's head end
  horiz.normalize();
  // Direction whose tip lands exactly on the floor, or straight down if out of reach.
  const sy = clamp(h / tipLen, 0, 1);
  let d = horiz.clone().multiplyScalar(Math.sqrt(1 - sy * sy)).add(new THREE.Vector3(0, -sy, 0));
  // Keep within the wrist's range of the forearm...
  const ang = Math.acos(clamp(d.dot(foreDir), -1, 1));
  if (ang > WRIST_MAX) {
    const axis = foreDir.clone().cross(d);
    if (axis.lengthSq() > 1e-8) d = foreDir.clone().applyAxisAngle(axis.normalize(), WRIST_MAX);
  }
  // ...unless that would put the tip through the floor.
  if (W.y + d.y * tipLen < floorY) {
    const dy = -clamp(h / tipLen, 0, 1);
    const hz = new THREE.Vector3(d.x, 0, d.z);
    if (hz.lengthSq() < 1e-6) hz.copy(horiz);
    d = hz.normalize().multiplyScalar(Math.sqrt(1 - dy * dy)).add(new THREE.Vector3(0, dy, 0));
  }
  // Palm faces down/back toward the floor (or back toward the body if pointing straight down).
  let palmDir = new THREE.Vector3(0, -1, 0).addScaledVector(d, d.y);
  if (palmDir.lengthSq() < 1e-4) palmDir = horiz.clone().negate();
  setHandWorld(ch, side, basisQuat(d, palmDir.normalize()).multiply(restHandQuat(ha, side).invert()));
}

// Shoulder-to-palm-centre reach of an arm.
function armReach(ch, side) {
  return ch.bones['forearm' + side].position.length() + ch.bones['hand' + side].position.length() + ch.spec.H * 0.106 * 0.42;
}

// ════════════════════════════════════════════════════════════════
// DANCE MOVES — each move is a prep pose (the wind-up, half a beat before)
// and a hit pose (on the beat), layered over a relaxed base. Optional:
// turn (body yaw, degrees, + = to the character's left), drop (hips lowered,
// fraction of height), spin (extra full-body rotation during prep → hit).
// "R" variants are generated by mirroring, so left/right always match.
// Bone angle conventions as in POSES above.
// ════════════════════════════════════════════════════════════════
// Ready stance: arms loose off the body, feet hip-width, knees soft. Moves that leave
// the legs alone keep this stance rather than locking straight.
const DANCE_BASE = { upperArmL: [-4, 0, -34], upperArmR: [-4, 0, 34], forearmL: [-22, 0, 0], forearmR: [-22, 0, 0],
  thighL: [-3, 0, -4], thighR: [-3, 0, 4], shinL: [6, 0, 0], shinR: [6, 0, 0] };
// Arm building blocks (left arm; the right mirrors Z): Z −45 hangs the arm at the
// side, Z +45 is out horizontal, Z +135 straight up. X swings the hanging arm
// forward (−X), so [−90, 0, −45] points straight ahead, [−150, 0, −45] forward-up.
const DANCE_SRC = {
  'Extend & Turn L': {   // body turns; left arm high, right arm out behind, left leg extended back
    prep: { thighL: [-15, 0, 0], thighR: [-15, 0, 0], shinL: [25, 0, 0], shinR: [25, 0, 0], spine1: [8, 0, 0],
            upperArmL: [-45, 0, -40], upperArmR: [-45, 0, 40], forearmL: [-90, 0, 0], forearmR: [-90, 0, 0] },
    prepDrop: 0.02,
    hit: { pelvis: [0, 20, 0], spine2: [-6, 15, 0], neck: [0, 20, 0],
           upperArmL: [0, 0, 115], forearmL: [0, 0, 0], upperArmR: [30, 0, -35], forearmR: [0, 0, 0],
           thighL: [28, 0, 6], footL: [25, 0, 0] },
    turn: 25,
  },
  'Step & Reach L': {  // step forward on the left, left arm reaching forward and up, right arm open low behind
    prep: { thighR: [-10, 0, 0], shinR: [20, 0, 0], thighL: [-8, 0, 0], shinL: [12, 0, 0],
            upperArmL: [25, 0, -40], forearmL: [-20, 0, 0], upperArmR: [-40, 0, 40], forearmR: [-60, 0, 0] },
    prepDrop: 0.015,
    hit: { thighL: [-38, 0, 0], shinL: [12, 0, 0], thighR: [16, 0, 0], shinR: [6, 0, 0], pelvis: [0, -10, 0], spine1: [-5, 0, 0],
           upperArmL: [-130, 0, -45], forearmL: [-5, 0, 0], upperArmR: [35, 0, -20], forearmR: [-5, 0, 0], neck: [-12, 0, 0] },
    hitDrop: 0.012,
  },
  'Sway & Sweep L': {    // side lean with both arms sweeping overhead to one side
    prep: { pelvis: [0, 0, 6], spine1: [0, 0, -8], spine2: [0, 0, -6], thighR: [0, 0, -8],
            upperArmL: [0, 0, -30], upperArmR: [0, 0, 60], forearmL: [-20, 0, 0], forearmR: [-20, 0, 0] },
    hit: { pelvis: [0, 0, -8], spine1: [0, 0, 12], spine2: [0, 0, 10], neck: [0, 0, 8], thighL: [0, 0, 10],
           upperArmL: [0, 0, 150], upperArmR: [0, 0, -110], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0] },
  },
  'Cross-Step L': {    // left foot crosses in front; left arm swings across the body, right arm opens behind
    prep: { thighL: [0, 0, 16], upperArmL: [0, 0, 20], upperArmR: [0, 0, -20], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { thighL: [-22, 0, -24], shinL: [15, 0, 0], thighR: [5, 0, 4], shinR: [18, 0, 0], pelvis: [0, 15, 0], spine2: [0, -20, 0],
           upperArmL: [-68, 0, -54], forearmL: [-8, 0, 0], upperArmR: [30, 0, -40], forearmR: [-10, 0, 0], neck: [0, 10, 0] },
    hitDrop: 0.025,
  },
  'Spin & Land': {     // full turn, landing low: knees bent, torso over the knees, arms low and open
    prep: { upperArmL: [-60, 0, -45], upperArmR: [-60, 0, 45], forearmL: [-110, 0, 0], forearmR: [-110, 0, 0], spine2: [-5, 0, 0] },
    hit: { thighL: [-50, 0, 10], thighR: [-20, 0, -8], shinL: [70, 0, 0], shinR: [45, 0, 0], footL: [-20, 0, 0], footR: [-15, 0, 0],
           spine1: [16, 0, 0], spine2: [4, 0, 0], neck: [-6, 0, 0],
           upperArmL: [-15, 0, 22], upperArmR: [-15, 0, -22], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0] },
    hitDrop: 0.09, spin: 360,
  },
  'Arms Wide': {       // wide stance, arms straight out to the sides, chest lifted
    prep: { upperArmL: [-60, 0, -45], upperArmR: [-60, 0, 45], forearmL: [-100, 0, 0], forearmR: [-100, 0, 0],
            thighL: [-8, 0, 0], thighR: [-8, 0, 0], shinL: [15, 0, 0], shinR: [15, 0, 0], spine1: [8, 0, 0] },
    prepDrop: 0.012,
    hit: { upperArmL: [0, 0, 48], upperArmR: [0, 0, -48], forearmL: [0, 0, 0], forearmR: [0, 0, 0],
           thighL: [0, 0, 14], thighR: [0, 0, -14], spine2: [-8, 0, 0], neck: [-10, 0, 0] },
  },
  'Final Bow': {       // bow from the hips, right hand settled in front of the abdomen, left arm out low
    prep: { upperArmL: [0, 0, 20], upperArmR: [0, 0, -20], forearmL: [0, 0, 0], forearmR: [0, 0, 0], spine2: [-5, 0, 0] },
    hit: { pelvis: [18, 0, 0], thighL: [-18, 0, 0], thighR: [-6, 0, 0], spine1: [20, 0, 0], spine2: [14, 0, 0], neck: [8, 0, 0],
           upperArmR: [-40, 0, 30], forearmR: [-90, 0, 0], upperArmL: [14, 0, -38], forearmL: [-15, 0, 0] },
    // Right palm placed by IK just in front of the abdomen, fingers across the body,
    // elbow forward and out so the forearm lies parallel to the front of the torso.
    ikHit: { side: 'R', gap: 0.012, across: -0.02, pole: [-0.35, -0.05, 0.35] },
  },
  'Kick L': {          // knee up on the prep, left leg kicks out forward, arms open for balance
    prep: { thighL: [-65, 0, 0], shinL: [95, 0, 0], thighR: [-5, 0, 0], shinR: [12, 0, 0],
            upperArmL: [-40, 0, -40], forearmL: [-90, 0, 0], upperArmR: [-40, 0, 40], forearmR: [-90, 0, 0] },
    hit: { thighL: [-80, 0, 0], shinL: [0, 0, 0], footL: [30, 0, 0], thighR: [4, 0, 0], shinR: [10, 0, 0], spine1: [-10, 0, 0],
           upperArmL: [0, 0, 40], upperArmR: [0, 0, -40], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hitDrop: 0.01,
  },
  'Floor Touch L': {   // right knee bends deep, left leg straight out to the side, left hand to the floor
    prep: { thighL: [0, 0, 12], thighR: [0, 0, -12], upperArmL: [0, 0, 60], upperArmR: [0, 0, -60], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { thighR: [-70, 0, -12], shinR: [110, 0, 0], footR: [-30, 0, 0], thighL: [0, 0, 40], shinL: [0, 0, 0], footL: [0, 0, -15],
           pelvis: [0, 0, 10], spine1: [42, 0, 18], spine2: [18, 0, 10],
           upperArmL: [-70, 0, -48], forearmL: [0, 0, 0], upperArmR: [0, 0, -110], forearmR: [0, 0, 0], neck: [-10, 0, 0] },
    hitDrop: 0.2,
  },
  'Forward Reach L': { // left arm straight ahead, right arm drawn back, shoulders turned into the reach
    prep: { upperArmL: [30, 0, -40], forearmL: [-90, 0, 0], upperArmR: [-20, 0, 40], forearmR: [-20, 0, 0], spine2: [0, 10, 0] },
    hit: { upperArmL: [-90, 0, -45], forearmL: [0, 0, 0], upperArmR: [40, 0, 40], forearmR: [-75, 0, 0], spine2: [0, -18, 0],
           spine1: [6, 0, 0], thighL: [-12, 0, 0], shinL: [12, 0, 0], shinR: [12, 0, 0], neck: [0, 10, 0] },
    hitDrop: 0.015,
  },
  'Bend & Reach': {    // fold forward at the hips, both arms reaching forward
    prep: { spine2: [-10, 0, 0], upperArmL: [0, 0, 120], upperArmR: [0, 0, -120], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { pelvis: [35, 0, 0], thighL: [-35, 0, 0], thighR: [-35, 0, 0], shinL: [15, 0, 0], shinR: [15, 0, 0], footL: [-5, 0, 0], footR: [-5, 0, 0],
           spine1: [25, 0, 0], spine2: [10, 0, 0], neck: [-25, 0, 0],
           upperArmL: [-155, 0, -45], upperArmR: [-155, 0, 45], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hitDrop: 0.02,
  },
};
const mirrorMove = m => ({ ...m, prep: mirrorPose(m.prep), hit: mirrorPose(m.hit),
  turn: -(m.turn || 0), prepTurn: -(m.prepTurn || 0), spin: -(m.spin || 0) });
// Every move with a left/right bias gets a mirrored R version.
const SIDED = ['Extend & Turn', 'Step & Reach', 'Sway & Sweep', 'Cross-Step', 'Kick', 'Floor Touch', 'Forward Reach'];
const DANCE_MOVES = {};
for (const [name, m] of Object.entries(DANCE_SRC)) {
  DANCE_MOVES[name] = m;
  const base = name.replace(/ L$/, '');
  if (SIDED.includes(base) && name.endsWith(' L')) DANCE_MOVES[base + ' R'] = mirrorMove(m);
}
DANCE_MOVES['Hold the Pose'] = null;          // repeats the previous move's hit
// Keep the bow last.
const bow = DANCE_MOVES['Final Bow']; delete DANCE_MOVES['Final Bow']; DANCE_MOVES['Final Bow'] = bow;
// A missed move: off-balance, shoulders dropped, arms loose. Not part of the library.
const STUMBLE = { hit: { spine1: [14, 0, 5], spine2: [6, 0, 3], neck: [16, 0, -6], pelvis: [0, 6, -3],
  upperArmL: [-10, 0, -28], upperArmR: [-20, 0, 50], forearmL: [-35, 0, 0], forearmR: [-25, 0, 0],
  thighL: [-14, 0, -2], shinL: [22, 0, 0], thighR: [4, 0, 4], shinR: [8, 0, 0] }, hitDrop: 0.02 };
// The other side of a sided move ('Kick L' ↔ 'Kick R'), or null.
const mirrorName = name => /^(.*) ([LR])$/.test(name) && SIDED.includes(name.slice(0, -2)) ? name.slice(0, -1) + (name.endsWith('L') ? 'R' : 'L') : null;

// Per-character playback of the library. prep()/hit() apply a move immediately;
// play(keys) runs a timed list of {t, move, kind: 'prep'|'hit', dur}.
// The group's yaw and height are offset from `baseRY` / `baseY`.
function createDancer(ch) {
  const D = { active: false, t: 0, keys: [], next: 0, yaw: 0, yawFrom: 0, yawTo: 0, yawT0: 0, yawDur: 0.3, spin: 0,
    drop: 0, dropTo: 0, last: null, ik: null, ikW: 0, baseRY: ch.group.rotation.y, baseY: ch.group.position.y, current: null };
  const apply = (move, kind, dur) => {
    const name = move === 'Hold the Pose' ? D.last : move;
    const m = name === 'Stumble' ? STUMBLE : DANCE_MOVES[name];
    D.active = true;
    D.current = { move, kind };
    if (kind === 'hit') fadeMarksMove(ch);   // every move danced counts, holds and stumbles included
    if (!m) return;
    if (move === 'Hold the Pose') {
      // Back to (or stay in) the last move's hit pose, without replaying its turn or spin.
      const target = poseQuats(DANCE_BASE, m.hit);
      for (const b of BONES) ch.target[b] = target[b].clone();
      D.dropTo = m.hitDrop || 0; D.ik = m.ikHit || null;
      return;
    }
    const target = poseQuats(DANCE_BASE, m[kind] || m.hit);
    for (const b of BONES) ch.target[b] = target[b].clone();
    D.yawFrom = D.yaw; D.yawTo = (kind === 'hit' ? m.turn : m.prepTurn) || 0;
    D.yawT0 = D.t; D.yawDur = dur; D.spin = kind === 'hit' ? (m.spin || 0) : 0;
    if (D.spin) D.yawFrom -= D.spin;   // the spin eases from −spin to 0: a full turn ending facing front
    D.dropTo = (kind === 'hit' ? m.hitDrop : m.prepDrop) || 0;
    D.ik = kind === 'hit' && m.ikHit ? m.ikHit : null; D.ikW = D.ik ? D.ikW : 0;
    if (kind === 'hit' && name !== 'Stumble') D.last = name;
  };
  D.prep = (move, dur = 0.25) => apply(move, 'prep', dur);
  D.hit = (move, dur = 0.3) => apply(move, 'hit', dur);
  D.stumble = (dur = 0.3) => apply('Stumble', 'hit', dur);
  D.rest = () => { D.active = false; D.ik = null; D.yawFrom = D.yaw; D.yawTo = 0; D.yawT0 = D.t; D.yawDur = 0.4; D.spin = 0; D.dropTo = 0;
    const t = poseQuats(DANCE_BASE); for (const b of BONES) ch.target[b] = t[b].clone(); };
  D.play = keys => { D.t = 0; D.keys = keys; D.next = 0; D.active = true; };
  D.update = dt => {
    D.t += dt;
    while (D.next < D.keys.length && D.t >= D.keys[D.next].t) { const k = D.keys[D.next++]; apply(k.move, k.kind, k.dur); }
    const p = clamp((D.t - D.yawT0) / D.yawDur, 0, 1), e = p * p * (3 - 2 * p);
    D.yaw = lerp(D.yawFrom, D.yawTo, e);
    D.drop += (D.dropTo - D.drop) * (1 - Math.exp(-dt * 12));
    D.ikW = D.ik ? Math.min(1, (D.ikW || 0) + dt * 5) : 0;
    ch.group.rotation.y = D.baseRY + D.yaw * Math.PI / 180;
    ch.group.position.y = D.baseY - D.drop * ch.spec.H;
  };
  D.stop = () => { D.rest(); D.yaw = D.yawTo = D.drop = D.dropTo = 0; D.keys = []; ch.group.rotation.y = D.baseRY; ch.group.position.y = D.baseY; };
  ch.dancer = D;
  const t = poseQuats(DANCE_BASE); for (const b of BONES) ch.target[b] = t[b].clone();
  return D;
}
// Belly front (rest space, z) at waist height for a character, cached.
function bellyFront(ch) {
  if (ch.bellyZ === undefined) {
    const p = [0, ch.spec.Y.waist, 0];
    while (field(ch.spec, p) < 0 && p[2] < 0.4) p[2] += 0.001;
    ch.bellyZ = p[2];
  }
  return ch.bellyZ;
}
// Blend a hand IK over the pose for the current move (see ikHit on moves).
function danceIK(ch, spec, w) {
  const side = spec.side, sp = ch.bones.spine1;
  const q = sp.getWorldQuaternion(new THREE.Quaternion());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const J = ch.spec.J, rF = ch.spec.m.forearm / 100 / (2 * Math.PI);
  const local = new THREE.Vector3(spec.across * ch.spec.H / 1.7, 0.012 * ch.spec.H, bellyFront(ch) - J.spine1[2] + rF + spec.gap);
  const target = local.applyMatrix4(sp.matrixWorld);
  const sh = ch.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
  const pole = sh.clone().add(new THREE.Vector3(...spec.pole).applyQuaternion(q));
  const bones = ['upperArm', 'forearm', 'hand'].map(n => ch.bones[n + side]);
  const before = bones.map(b => b.quaternion.clone());
  armIK(ch, side, target, pole, fwd, side === 'R' ? left : left.clone().negate());
  bones.forEach((b, i) => b.quaternion.copy(before[i].slerp(b.quaternion.clone(), w)));
}

// ════════════════════════════════════════════════════════════════
// BUST SECONDARY MOTION — each bust bone is a damped spring that lags behind
// its anchor on the chest when the torso accelerates, then settles. Heavier
// (larger cup) = lower frequency, more travel; smallest cup barely moves.
// ════════════════════════════════════════════════════════════════
function bustSpring(ch, dt) {
  if (ch.spec.m.build !== 'female' || dt <= 0) return;
  const cup = ch.spec.m.cup || 3, w = (cup / 8) ** 1.5;             // 0.04 (A) … 1 (H)
  const f = 5.2 - 0.3 * cup, k = (2 * Math.PI * f) ** 2, c = 2 * 0.22 * Math.sqrt(k);
  const maxOff = 0.004 + 0.004 * cup;                                 // metres of travel at most
  ch.jig = ch.jig || {};
  const sp = ch.bones.spine2;
  for (const side of ['L', 'R']) {
    const b = ch.bones['bust' + side];
    const rest = ch.bustRest[side];
    const anchor = rest.clone().applyMatrix4(sp.matrixWorld);          // where the bone sits with no lag
    let S = ch.jig[side];
    if (!S) S = ch.jig[side] = { prev: anchor.clone(), vel: new THREE.Vector3(), off: new THREE.Vector3(), ov: new THREE.Vector3() };
    const v = anchor.clone().sub(S.prev).divideScalar(dt);
    const acc = v.clone().sub(S.vel).divideScalar(dt);
    S.prev.copy(anchor); S.vel.copy(v);
    // off'' = −k·off − c·off' − acc (the anchor's acceleration drags the mass behind it)
    const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = S.off.clone().multiplyScalar(-k).addScaledVector(S.ov, -c).addScaledVector(acc, -1);
      S.ov.addScaledVector(a, h); S.off.addScaledVector(S.ov, h);
    }
    S.off.clampLength(0, maxOff / Math.max(w, 1e-3));
    // Displacement scales with weight; rotate the world offset into spine2's frame.
    const invQ = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.position.copy(rest).add(S.off.clone().multiplyScalar(w).applyQuaternion(invQ));
  }
}

// ════════════════════════════════════════════════════════════════
// CONTACT — skin never passes through another person's skin. Each character
// carries a set of proxy shapes fitted to its own body (built once, from the same
// primitives as the mesh): the torso as a stack of elliptical slices read off the
// loft, plus the limbs', bust's, glutes' and head's own shapes, each on its bone.
// Every frame, updateContacts poses each character's partner's proxies into world
// space and hands them to that character's vertex shader, which pushes any skin
// vertex found inside them back out along the proxy's normal. Both sides give way,
// in proportion to how soft each is at that point (see softness): a belly on a thigh
// compresses mostly the belly, a shin hardly at all. Hands are left out: their
// contacts are placed by IK and flattened by the press slots (setPress).
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// GL diagnostics. Phones' GPUs have far smaller shader limits than desktops' (a few hundred uniform vectors), and a shader
// that doesn't link just isn't drawn — the skin goes missing with nothing on screen to say why. glReport reads the limits;
// watchGL(renderer, show) calls show(text) with them and the first shader error three.js logs (or a lost context), and
// is how the pages put it on screen (always with ?gl in the address).
// ════════════════════════════════════════════════════════════════
function glReport(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const P = n => gl.getParameter(n);
  return {
    gpu: ext ? P(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    vertexUniformVectors: P(gl.MAX_VERTEX_UNIFORM_VECTORS), fragmentUniformVectors: P(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    vertexTextureUnits: P(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS), varyingVectors: P(gl.MAX_VARYING_VECTORS), floatTextures: !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('OES_texture_float')),
  };
}
function watchGL(renderer, show) {
  const info = glReport(renderer), line = `GPU ${info.gpu}; WebGL${info.webgl2 ? 2 : 1}; uniform vectors vertex ${info.vertexUniformVectors}, fragment ${info.fragmentUniformVectors}; varyings ${info.varyingVectors}; vertex textures ${info.vertexTextureUnits}`;
  let shown = false;
  const say = msg => { if (shown) return; shown = true; show(msg + '\n' + line); };
  const err = console.error;
  console.error = function (...a) {
    err.apply(console, a);
    const m = a.map(x => String(x)).join(' ');
    if (/WebGLProgram|shader|uniform|VALIDATE_STATUS|link/i.test(m)) say(m.slice(0, 700));
  };
  renderer.domElement.addEventListener('webglcontextlost', () => say('The WebGL context was lost.'));
  if (/[?&]gl\b/.test(location.search)) { shown = false; say('GL report'); }
  return info;
}
const CONTACT_ELL = 36, CONTACT_CONE = 10, CONTACT_PAD = 0.002, CONTACT_MAX = 0.1;
function buildProxies(spec) {
  const H = spec.H, loft = spec.prims[0], ells = [], cones = [];
  // Torso slices every 3 cm, each a y-radius of two spacings so they overlap smoothly.
  const y0 = spec.Y.crotch - 0.02 * H, y1 = spec.Y.neckBase, n = Math.ceil((y1 - y0) / 0.03), dy = (y1 - y0) / n;
  for (let i = 0; i <= n; i++) {
    const y = y0 + i * dy, [a, bf, bb, zc] = loftRing(loft, y);
    const bone = loftWeights(spec, y).sort((p, q) => q[1] - p[1])[0][0];
    ells.push({ bone, c: [0, y, zc + (bf - bb) / 2], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1], r: [a, dy * 2, (bf + bb) / 2], soft: softness(spec, null, true, y) });
  }
  for (const P of spec.prims) {
    const tag = P.tag || P.group;
    if (tag === 'hand' || tag === 'hair' || tag === 'hairBun') continue;
    if (P.type === 'ell' && (tag !== 'head' || P === spec.prims.find(q => q.tag === 'head')))
      ells.push({ bone: P.bone, c: P.c, u: P.u, v: P.v, w: P.w, r: P.r, soft: softness(spec, tag, false, P.c[1]) });
    else if (P.type === 'cone' && tag !== 'hand')
      cones.push({ bone: P.bone, a: P.a, b: P.b, r1: P.r1, r2: P.r2, soft: softness(spec, tag, false, P.a[1]) });
  }
  return { ells: ells.slice(0, CONTACT_ELL), cones: cones.slice(0, CONTACT_CONE) };
}
// Each character's contact partner: the nearest other body close enough to touch.
function updateContacts(everyone) {
  const on = everyone.filter(c => c.group.parent && c.proxies);
  const hip = c => c.bones.pelvis.getWorldPosition(new THREE.Vector3());
  for (const ch of on) {
    const u = ch.mesh.material.userData.uniforms;
    let partner = null, best = 1.6;
    for (const o of on) if (o !== ch) { const d = hip(o).distanceTo(hip(ch)); if (d < best) { best = d; partner = o; } }
    u.uContactN.value.set(0, 0);
    if (!partner) continue;
    const sk = partner.mesh.skeleton, M = {}, m3 = new THREE.Matrix3();
    const mat = b => M[b] || (M[b] = partner.bones[b].matrixWorld.clone().multiply(sk.boneInverses[BONES.indexOf(b)]));
    const V3 = a => new THREE.Vector3(...a);
    const D = u.uContactTex.value.image.data;
    partner.proxies.ells.forEach((e, i) => {
      const m = mat(e.bone); m3.setFromMatrix4(m);
      const c = V3(e.c).applyMatrix4(m), ax = [e.u, e.v, e.w].map(a => V3(a).applyMatrix3(m3).normalize());
      const o = i * 16;
      for (let k = 0; k < 3; k++) { D[o + k * 4] = ax[k].x; D[o + k * 4 + 1] = ax[k].y; D[o + k * 4 + 2] = ax[k].z; D[o + k * 4 + 3] = -ax[k].dot(c); }
      D[o + 12] = e.r[0]; D[o + 13] = e.r[1]; D[o + 14] = e.r[2]; D[o + 15] = e.soft;
    });
    partner.proxies.cones.forEach((q, i) => {
      const m = mat(q.bone), a = V3(q.a).applyMatrix4(m), b = V3(q.b).applyMatrix4(m);
      const o = (CONTACT_ELL + i) * 16;
      D[o] = a.x; D[o + 1] = a.y; D[o + 2] = a.z; D[o + 3] = q.r1; D[o + 4] = b.x; D[o + 5] = b.y; D[o + 6] = b.z; D[o + 7] = q.r2; D[o + 8] = q.soft;
    });
    u.uContactTex.value.needsUpdate = true;
    u.uContactN.value.set(partner.proxies.ells.length, partner.proxies.cones.length);
  }
}
// The partner's proxies travel in a small float texture (4 texels wide, a row per proxy) rather than as uniform arrays, which
// ran past phones' limits on vertex uniforms. An ellipsoid: three axis texels (axis, offset) and the radii and softness;
// a cone, from row CONTACT_ELL: its two ends (point, radius) and its softness.
function contactTexture() {
  const t = new THREE.DataTexture(new Float32Array(4 * (CONTACT_ELL + CONTACT_CONE) * 4), 4, CONTACT_ELL + CONTACT_CONE, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
const CONTACT_GLSL = `
  uniform sampler2D uContactTex;
  uniform vec2 uContactN;
  attribute float soft;
  vec4 cT(int x, int row) { return texture2D(uContactTex, vec2((float(x) + 0.5) / 4.0, (float(row) + 0.5) / ${CONTACT_ELL + CONTACT_CONE}.0)); }
  float cEll(int i, vec3 p) {
    vec4 a0 = cT(0, i), a1 = cT(1, i), a2 = cT(2, i);
    vec3 q = vec3(dot(a0.xyz, p) + a0.w, dot(a1.xyz, p) + a1.w, dot(a2.xyz, p) + a2.w);
    vec3 r = cT(3, i).xyz;
    float k0 = length(q / r), k1 = length(q / (r * r));
    return k1 < 1e-7 ? -min(r.x, min(r.y, r.z)) : k0 * (k0 - 1.0) / k1;
  }
  float cCone(int i, vec3 p) {                        // iq's round cone
    vec4 ta = cT(0, ${CONTACT_ELL} + i), tb = cT(1, ${CONTACT_ELL} + i);
    vec3 a = ta.xyz, b = tb.xyz; float r1 = ta.w, r2 = tb.w;
    vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
    vec3 pa = p - a; float y = dot(pa, ba), z = y - l2;
    vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }
  float cProxy(int kind, int i, vec3 p) { return kind == 0 ? cEll(i, p) : cCone(i, p); }
`;
const CONTACT_VERTEX = `
  if (uContactN.x + uContactN.y > 0.0) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float dBest = 1e9, sBest = 1.0; int kBest = 0, iBest = 0;
    for (int i = 0; i < ${CONTACT_ELL}; i++) { if (float(i) >= uContactN.x) break; float d = cEll(i, wp); if (d < dBest) { dBest = d; kBest = 0; iBest = i; sBest = cT(3, i).w; } }
    for (int i = 0; i < ${CONTACT_CONE}; i++) { if (float(i) >= uContactN.y) break; float d = cCone(i, wp); if (d < dBest) { dBest = d; kBest = 1; iBest = i; sBest = cT(2, ${CONTACT_ELL} + i).x; } }
    if (dBest < ${CONTACT_PAD}) {
      const float e = 0.002;
      vec3 g = vec3(cProxy(kBest, iBest, wp + vec3(e, 0, 0)) - cProxy(kBest, iBest, wp - vec3(e, 0, 0)),
                    cProxy(kBest, iBest, wp + vec3(0, e, 0)) - cProxy(kBest, iBest, wp - vec3(0, e, 0)),
                    cProxy(kBest, iBest, wp + vec3(0, 0, e)) - cProxy(kBest, iBest, wp - vec3(0, 0, e)));
      vec3 n = normalize(g + 1e-9);
      // This body's share of the overlap, by softness; the other body takes the rest.
      float share = (soft + 0.05) / (soft + sBest + 0.1);
      float push = min((${CONTACT_PAD} - dBest) * share, ${CONTACT_MAX});
      transformed += mat3(bindMatrixInverse) * (n * push);
      #ifndef FLAT_SHADED
        vNormal = normalize(mix(vNormal, normalize(mat3(viewMatrix) * n), smoothstep(0.0, 0.006, push)));
      #endif
    }
  }`;

// ════════════════════════════════════════════════════════════════
// SKIRT — a separate cloth mesh (wardrobe kind 'skirt'). A grid of SKIRT_RINGS rings
// × SKIRT_SEGS columns of particles, from a waistband `above` × height over the
// shorts' top (the belly line) down `length` × height. The rest shape falls from the
// widest part of the hips with a small gap and flares by `flare` × height at the hem.
// The waistband ring is pinned to the body (blended pelvis/spine skinning); the rest
// is Verlet cloth, stepped at a fixed rate whatever the frame rate: real gravity and a
// little air drag, mass that grows toward the hem, ring/column/shear springs to its rest
// lengths (stretch resisted hard and capped, squashing only partly, so it folds instead
// of pushing back), weak bending, damping between neighbours, and layers that keep apart
// (see SKIRT). It is put on over a pose by settleSkirt, which lets it fall into place. It collides with every body on set (their posed contact proxies, see
// CONTACT, own body included), the floor, and any solid objects passed in (boxes).
// Call skirtStep every frame after the pose is set.
// ════════════════════════════════════════════════════════════════
const SKIRT_EASE = 1.1, SKIRT_RINGS = 15, SKIRT_SEGS = 48, SKIRT_GAP = 0.004, SKIRT_THICK = 0.012, SKIRT_PAD = 0.008, SKIN_CELL = 0.03;
// How the cloth behaves. It is simulated at a fixed STEP whatever the frame rate, so it weighs the same at 15 fps as at 120.
//   GRAVITY, DAMP: real gravity and only a little air drag (per second), so heavy cloth falls and swings rather than floating;
//   HEM: how much heavier the hem is than the waist (a sewn hem and the cloth's own weight below), so it lags and settles;
//   COMPRESS: how hard it resists being squashed relative to being stretched (cloth buckles in folds, it doesn't push back like a spring);
//   BEND: how much the cloth resists creasing; SHEAR: the diagonals; MAXMOVE: furthest a particle travels in one step (so it
//   can't tunnel through the thin skin test); SPRING_DAMP: how much of the speed of two neighbours moving apart or together is taken out
//   (internal damping: heavy cloth stops where it stops, it doesn't ring); MAX_STRAIN: cloth does not stretch past this
//   multiple of its length however hard it is pulled (a final pass each step); SELF: the cloth's own thickness for layers lying on one another; FRICTION: sliding lost on contact.
const SKIRT = { STEP: 1 / 120, MAX_STEPS: 6, ITER: 6, GRAVITY: 9.8, DAMP: 0.6, HEM: 0.9, COMPRESS: 0.35, BEND: 0.05, SHEAR: 0.35, MAXMOVE: 0.016, SELF: 0.012, FRICTION: 0.35, FOLLOW: 0.45, SPRING_DAMP: 0.4, MAX_STRAIN: 1.05 };
const cellKey = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
// Re-skins the skirt's own-body skin points into world space (linear blend skinning,
// as the GPU does) and buckets them in a grid of SKIN_CELL cells.
function skinPoints(ch, S) {
  const K = S.skin, bones = ch.mesh.skeleton.bones, inv = ch.mesh.skeleton.boneInverses;
  const M = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]).elements);
  S.grid.clear();
  for (let k = 0; k < K.n; k++) {
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    const px = K.p[3 * k], py = K.p[3 * k + 1], pz = K.p[3 * k + 2], qx = K.nr[3 * k], qy = K.nr[3 * k + 1], qz = K.nr[3 * k + 2];
    for (let a = 0; a < 4; a++) {
      const w = K.w[4 * k + a]; if (!w) continue;
      const e = M[K.i[4 * k + a]];
      x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]);
      nx += w * (e[0] * qx + e[4] * qy + e[8] * qz); ny += w * (e[1] * qx + e[5] * qy + e[9] * qz); nz += w * (e[2] * qx + e[6] * qy + e[10] * qz);
    }
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    if (ch.pressFloor != null && y < ch.pressFloor) { y = ch.pressFloor; nx = 0; ny = -nl; nz = 0; }   // (skin the scene flattens against a seat is flat for the cloth too)
    if (K.lin) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { let v = 0; for (let a = 0; a < 4; a++) { const w = K.w[4 * k + a]; if (w) v += w * M[K.i[4 * k + a]][4 * c + r]; } K.lin[9 * k + 3 * r + c] = v; }   // (the blended turn of this skin point, row r column c)
    K.wp[3 * k] = x; K.wp[3 * k + 1] = y; K.wp[3 * k + 2] = z; K.wn[3 * k] = nx / nl; K.wn[3 * k + 1] = ny / nl; K.wn[3 * k + 2] = nz / nl;
    const key = cellKey(Math.floor(x / SKIN_CELL), Math.floor(y / SKIN_CELL), Math.floor(z / SKIN_CELL));
    let cell = S.grid.get(key); if (!cell) S.grid.set(key, cell = []); cell.push(k);
  }
}
// Another body's skin, as the cloth sees it: the same thing as the wearer's (re-skinned vertices with their normals, bucketed in a grid),
// so cloth reacts to a disciplinarian's hand, thigh or arm exactly as it does to its own body, only the vertices near the cloth are
// skinned (those whose strongest bone is within a metre of the hips).
function prepOtherSkin(o) {
  const g = o.mesh.geometry, pa = g.attributes.position.array, na = g.attributes.normal.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
  const pick = []; for (let v = 0; v < pa.length / 3; v += 2) pick.push(v);
  const n = pick.length, C = { n, p: new Float32Array(n * 3), nr: new Float32Array(n * 3), i: new Uint16Array(n * 4), w: new Float32Array(n * 4), dom: new Uint16Array(n), wp: new Float32Array(n * 3), wn: new Float32Array(n * 3) };
  pick.forEach((v, k) => {
    let best = -1, bw = -1;
    for (let a = 0; a < 3; a++) { C.p[3 * k + a] = pa[3 * v + a]; C.nr[3 * k + a] = na[3 * v + a]; }
    for (let a = 0; a < 4; a++) { C.i[4 * k + a] = si[4 * v + a]; C.w[4 * k + a] = sw[4 * v + a]; if (sw[4 * v + a] > bw) { bw = sw[4 * v + a]; best = si[4 * v + a]; } }
    C.dom[k] = best;
  });
  return C;
}
const _bv = new THREE.Vector3();
function otherSkin(o, hip) {
  const C = o._clothSkin || (o._clothSkin = prepOtherSkin(o)), bones = o.mesh.skeleton.bones, inv = o.mesh.skeleton.boneInverses;
  const M = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]).elements);
  const near = new Uint8Array(bones.length);
  bones.forEach((b, i) => { b.getWorldPosition(_bv); near[i] = _bv.distanceToSquared(hip) < 1 ? 1 : 0; });
  const grid = new Map(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let m = 0;
  for (let k = 0; k < C.n; k++) {
    if (!near[C.dom[k]]) continue;
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    const px = C.p[3 * k], py = C.p[3 * k + 1], pz = C.p[3 * k + 2], qx = C.nr[3 * k], qy = C.nr[3 * k + 1], qz = C.nr[3 * k + 2];
    for (let a = 0; a < 4; a++) {
      const w = C.w[4 * k + a]; if (!w) continue;
      const e = M[C.i[4 * k + a]];
      x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]);
      nx += w * (e[0] * qx + e[4] * qy + e[8] * qz); ny += w * (e[1] * qx + e[5] * qy + e[9] * qz); nz += w * (e[2] * qx + e[6] * qy + e[10] * qz);
    }
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    C.wp[3 * m] = x; C.wp[3 * m + 1] = y; C.wp[3 * m + 2] = z; C.wn[3 * m] = nx / nl; C.wn[3 * m + 1] = ny / nl; C.wn[3 * m + 2] = nz / nl;
    const key = cellKey(Math.floor(x / SKIN_CELL), Math.floor(y / SKIN_CELL), Math.floor(z / SKIN_CELL));
    let cell = grid.get(key); if (!cell) grid.set(key, cell = []); cell.push(m++);
    lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z); hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z);
  }
  return { wp: C.wp, wn: C.wn, grid, lo, hi };
}
// The skin-plane test, for any body: the plane through the nearest skin point, and through the next nearest (a crease, the cleft
// between thighs, the web of a hand has two surfaces; being outside one is not enough). Moves q out; true if it did.
function skinPush(wp, wn, grid, q) {
  const cs = SKIN_CELL, cx = Math.round(q[0] / cs), cy = Math.round(q[1] / cs), cz = Math.round(q[2] / cs);
  let n1 = Infinity, i1 = -1, n2 = Infinity, i2 = -1;
  for (let ix = cx - 1; ix <= cx; ix++) for (let iy = cy - 1; iy <= cy; iy++) for (let iz = cz - 1; iz <= cz; iz++) {
    const cell = grid.get(cellKey(ix, iy, iz));
    if (!cell) continue;
    for (const k2 of cell) {
      const dx = q[0] - wp[3 * k2], dy = q[1] - wp[3 * k2 + 1], dz = q[2] - wp[3 * k2 + 2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < n1) { n2 = n1; i2 = i1; n1 = d2; i1 = k2; } else if (d2 < n2) { n2 = d2; i2 = k2; }
    }
  }
  let hit = false;
  for (const ni of [i1, i2]) {
    if (ni < 0) continue;
    const o = 3 * ni, sd = (q[0] - wp[o]) * wn[o] + (q[1] - wp[o + 1]) * wn[o + 1] + (q[2] - wp[o + 2]) * wn[o + 2];
    if (sd < SKIRT_THICK) { const push = SKIRT_THICK - sd; q[0] += wn[o] * push; q[1] += wn[o + 1] * push; q[2] += wn[o + 2] * push; hit = true; }
  }
  return hit;
}
function buildSkirt(ch, L) {
  const spec = ch.spec, H = spec.H, Y = spec.Y, R = SKIRT_RINGS, N = SKIRT_SEGS;
  const top = Y.belly + (L.above == null ? 0.01 : L.above);
  const len = (L.length || 0.18) * H, flare = (L.flare == null ? 0.025 : L.flare) * H;
  // The body's outer surface along a horizontal ray at angle th (0 = front) and height y:
  // march in from outside, then refine.
  const bodyR = (th, y) => {
    const dx = Math.sin(th), dz = Math.cos(th), p = [0, y, 0];
    let r = 0.32;
    for (; r > 0.005; r -= 0.008) { p[0] = dx * r; p[2] = dz * r; if (field(spec, p) < 0) break; }
    let lo = r, hi = r + 0.008;
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; p[0] = dx * m; p[2] = dz * m; if (field(spec, p) < 0) lo = m; else hi = m; }
    return hi;
  };
  const rest = new Float32Array(R * N * 3), ys = [];
  for (let i = 0; i < R; i++) ys.push(top - len * i / (R - 1));
  for (let j = 0; j < N; j++) {
    const th = 2 * Math.PI * j / N;
    let widest = 0;
    for (let i = 0; i < R; i++) {
      widest = Math.max(widest, bodyR(th, ys[i]));          // hangs straight down from the widest point above
      const t = i / (R - 1), r = widest * (i === 0 ? 1 : SKIRT_EASE) + SKIRT_GAP + flare * t * t;   // ease below the band: room for the hips to flex
      rest.set([Math.sin(th) * r, ys[i], Math.cos(th) * r], 3 * (i * N + j));
    }
  }
  // Springs: [a, b, rest length, stiffness].
  // kind 0: stretch (a ring or a column), 1: shear (the diagonals), 2: bending (two apart)
  const springs = [], P = k => [rest[3 * k], rest[3 * k + 1], rest[3 * k + 2]];
  const add = (a, b, k, kind) => springs.push([a, b, len3(sub(P(a), P(b))), k, kind]);
  const id = (i, j) => i * N + ((j + N) % N);
  for (let i = 0; i < R; i++) for (let j = 0; j < N; j++) {
    add(id(i, j), id(i, j + 1), 1, 0);                                       // around the ring
    if (i + 1 < R) { add(id(i, j), id(i + 1, j), 1, 0); add(id(i, j), id(i + 1, j + 1), SKIRT.SHEAR, 1); add(id(i, j + 1), id(i + 1, j), SKIRT.SHEAR, 1); }
    if (i + 2 < R) add(id(i, j), id(i + 2, j), SKIRT.BEND, 2);               // weak bending: it creases softly, never sharply
    add(id(i, j), id(i, j + 2), SKIRT.BEND, 2);
  }
  // Inverse mass: the waistband is held; the rest gets heavier toward the hem.
  const iw = new Float32Array(R * N);
  for (let i = 0; i < R; i++) for (let j = 0; j < N; j++) iw[i * N + j] = i === 0 ? 0 : 1 / (1 + SKIRT.HEM * i / (R - 1));
  // Mesh: a tube of quads, drawn from both sides.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(R * N * 3), 3));
  const index = [];
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j < N; j++) index.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(L.color), roughness: 0.82, metalness: 0, side: THREE.DoubleSide }));
  mesh.castShadow = true; mesh.receiveShadow = false;   // (cloth held a few mm off the skin shadows itself in patches otherwise)
  mesh.frustumCulled = false;
  ch.group.add(mesh);
  // Own-body collisions use the actual skin: every other mesh vertex in the skirt's
  // height band (with a margin), re-skinned each frame (see skinPoints).
  const g2 = ch.mesh.geometry, pa = g2.attributes.position.array, na = g2.attributes.normal.array;
  const si = g2.attributes.skinIndex.array, sw = g2.attributes.skinWeight.array, pick = [];
  const yLo = ys[R - 1] - 0.08, yHi = top + 0.03;
  for (let v = 0; v < pa.length / 3; v += 2) if (pa[3 * v + 1] > yLo && pa[3 * v + 1] < yHi) pick.push(v);
  const skin = { n: pick.length, p: new Float32Array(pick.length * 3), nr: new Float32Array(pick.length * 3), i: new Uint16Array(pick.length * 4), w: new Float32Array(pick.length * 4),
    wp: new Float32Array(pick.length * 3), wn: new Float32Array(pick.length * 3) };
  pick.forEach((v, k) => { for (let a = 0; a < 3; a++) { skin.p[3 * k + a] = pa[3 * v + a]; skin.nr[3 * k + a] = na[3 * v + a]; } for (let a = 0; a < 4; a++) { skin.i[4 * k + a] = si[4 * v + a]; skin.w[4 * k + a] = sw[4 * v + a]; } });
  const sa = new Int32Array(springs.length), sb = new Int32Array(springs.length), sl = new Float32Array(springs.length), sk = new Float32Array(springs.length), sn = new Uint8Array(springs.length);
  springs.forEach(([a, b, l0, k, kind], i) => { sa[i] = a; sb[i] = b; sl[i] = l0; sk[i] = k; sn[i] = kind; });
  ch.skirt = { L, rest, springs, sa, sb, sl, sk, sn, iw, R, N, mesh, p: null, prev: null, top, skin, grid: new Map(), acc: 0 };
}
const len3 = v => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
// Takes a skirt off (hidden, not simulated) or puts it back on, restarting its cloth
// from the rest shape wherever the body now is.
// Lowers a worn garment (wardrobe id: 'bottom' to the knees or further, see bottomCoverage;
// 'briefs' to the thighs, see briefsDown), bunched there, or pulls it back up. Each lowered
// garment has its own gathered waistband (ch.bunches).
function setLowered(ch, id, on) {
  const L = ch.spec.m.wardrobe && ch.spec.m.wardrobe[id];
  if (!L || (on && !(ch.layers || []).includes(L))) return;
  ch.lowered = ch.lowered || new Set();
  if (on === ch.lowered.has(L)) return;
  if (on) { ch.lowered.add(L); buildBunches(ch, L); } else { ch.lowered.delete(L); removeBunches(ch, L); }
  dress(ch);
}
// A lowered garment's gathered waistband: one stretchy loop round both legs at the top
// of the lowered band. It hugs the outside of each leg and spans the gap between them
// in front and behind (the convex hull of the two legs' cross-sections), rebuilt each
// frame from wherever the legs are (bunchStep), so it stretches as they part and
// gathers as they close. The legs' cross-sections are probed in the rest pose.
const BUNCH_M = 72, BUNCH_K = 10, BUNCH_IN = 28;
// Lowered briefs (not trunks, which go down as shorts do) roll into a thinner band, a thong
// thinner still. Their gusset never met the thighs, so the band only runs round the outside
// of each leg and straight across the gap (no inner rolls), and the crotch hangs from its
// front and back strands as a strip, free at its sides (see bunchOne): a thong's narrow,
// briefs' about as wide as the gap.
function buildBunches(ch, L) {
  removeBunches(ch, L);
  const spec = ch.spec, H = spec.H, J = spec.J;
  const briefs = L.kind === 'briefs' && !L.leg ? briefsDown(spec, L) : null;
  const tube = (briefs ? (briefs.thong ? 0.006 : 0.008) : 0.017) * H;
  const sides = ['L', 'R'].map(side => {
    const ankle = L.lowerTo === 'ankle', calf = L.lowerTo === 'calf' || ankle, bone = (calf ? 'shin' : 'thigh') + side;
    const top = J[bone], end = J[(calf ? 'foot' : 'shin') + side], dir = norm(sub(end, top));
    const c = briefs ? add(top, mul(dir, briefs.roll))
      : calf ? add(top, mul(sub(end, top), ankle ? 0.84 : LOWER_CALF + 0.03)) : add(end, mul(dir, -(LOWER_BAND[0] - 0.012) * H));
    const e1 = norm(cross([0, 0, 1], dir)), e2 = cross(dir, e1);
    // The leg's mean radius at a point on its axis, probed round it.
    const legR = at => {
      let rs = 0;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * 2 * Math.PI, u = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
        let d = 0.01; while (d < 0.2 && field(spec, add(at, mul(u, d))) < 0) d += 0.0005;
        rs += d / 12;
      }
      return rs;
    };
    const rs = legR(c);
    // Loose (trousers round the ankles): the pile stands well off the leg.
    return { bone, bi: BONES.indexOf(bone), c: new THREE.Vector3(...c), dir: new THREE.Vector3(...dir), r: rs + tube * 0.45 + (ankle ? 0.014 * H : 0) };
  });
  const M = BUNCH_M, K = BUNCH_K, geo = new THREE.BufferGeometry(), index = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * K * 3), 3));
  for (let i = 0; i < M; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = ((i + 1) % M) * K + j, c = ((i + 1) % M) * K + (j + 1) % K, d = i * K + (j + 1) % K;
    index.push(a, b, c, a, c, d);
  }
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(L.color), roughness: 0.8, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  ch.group.add(mesh);
  // Loose garments (trousers at the ankles): thicker, deeper folds, and the part between
  // the legs hangs slack instead of stretching (see bunchStep).
  const loose = L.lowerTo === 'ankle';
  // The roll round the inner side of each leg (the hull loop only covers the outside), so
  // each leg is fully wrapped; the seat hangs between these (see bunchStep).
  const IM = BUNCH_IN, ig = new THREE.BufferGeometry(), ii = [];
  ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * IM * K * 3), 3));
  for (let arc = 0; arc < 2; arc++) for (let i = 0; i + 1 < IM; i++) for (let j = 0; j < K; j++) {
    const o = arc * IM * K, a = o + i * K + j, b = o + (i + 1) * K + j, c = o + (i + 1) * K + (j + 1) % K, d2 = o + i * K + (j + 1) % K;
    ii.push(a, b, c, a, c, d2);
  }
  ig.setIndex(ii);
  const inner = new THREE.Mesh(ig, mesh.material);
  inner.castShadow = inner.receiveShadow = true; inner.frustumCulled = false;
  ch.group.add(inner);
  // The seat/crotch of the garment: a sheet between the legs (see bunchStep).
  const GT = 16, GW = 12, gg = new THREE.BufferGeometry(), gi = [];
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GT * GW * 3), 3));
  for (let i = 0; i + 1 < GT; i++) for (let j = 0; j + 1 < GW; j++) { const a = i * GW + j, b = a + GW; gi.push(a, b, b + 1, a, b + 1, a + 1); }
  gg.setIndex(gi);
  const gusset = new THREE.Mesh(gg, mesh.material);
  gusset.castShadow = gusset.receiveShadow = true; gusset.frustumCulled = false;
  ch.group.add(gusset);
  ch.bunches = ch.bunches || new Map();
  const B = { L, sides, tube: loose ? 0.024 * H : tube, mesh, gusset, inner, GT, GW, loose, slack: 0.34 * H,
    // Slack fabric across the seat, between the rolls round each leg.
    seat: (loose ? 0.16 : briefs ? (briefs.thong ? 0.12 : 0.1) : 0.1) * H,
    // Briefs' crotch strip: its width (× height) at the front band, at the back band, and
    // at its narrowest, between the legs (a thong's, and briefs' gusset, 2 × `gusset`).
    strip: !briefs ? null : briefs.thong ? [0.03 * H, 0.012 * H, 0.01 * H] : [0.075 * H, 0.09 * H, 2 * (L.gusset || 0.02) * H] };
  ch.bunches.set(L, B);
  bunchOne(ch, B);
}
// Removes the waistband of garment L (or every one, without L).
function removeBunches(ch, L) {
  if (!ch.bunches) return;
  for (const [K, B] of [...ch.bunches]) {
    if (L && K !== L) continue;
    ch.group.remove(B.mesh); B.mesh.geometry.dispose(); B.mesh.material.dispose();
    ch.group.remove(B.gusset); B.gusset.geometry.dispose();
    ch.group.remove(B.inner); B.inner.geometry.dispose();
    ch.bunches.delete(K);
  }
}
const _bm4 = new THREE.Matrix4();
function bunchStep(ch) {
  if (ch.bunches) for (const B of ch.bunches.values()) bunchOne(ch, B);
}
function bunchOne(ch, B) {
  if (!B.mesh.visible || !ch.group.parent) return;
  ch.group.updateMatrixWorld(true);
  const sk = ch.mesh.skeleton;
  const [A, C] = B.sides.map(s => {
    _bm4.copy(ch.bones[s.bone].matrixWorld).multiply(sk.boneInverses[s.bi]);
    return { c: s.c.clone().applyMatrix4(_bm4), a: s.dir.clone().transformDirection(_bm4), r: s.r };
  });
  // The loop's plane: across both legs, square to their average direction.
  const n = A.a.clone().add(C.a).normalize();
  const u = C.c.clone().sub(A.c); u.addScaledVector(n, -u.dot(n));
  let d = u.length();
  if (d < 1e-4) { u.set(1, 0, 0).addScaledVector(n, -n.x); d = 0; }
  u.normalize();
  const v = n.clone().cross(u);
  // Path: far half of the first leg's circle, straight across (behind or in front),
  // far half of the other's, straight back. Each point keeps its own leg's height
  // along n, blended across the straight parts.
  const hA = A.c.dot(n), hC = C.c.dot(n);
  const arcA = Math.PI * A.r, arcC = Math.PI * C.r, total = arcA + arcC + 2 * d;
  // Loose: the fabric across the gap has more length than the gap, so it hangs down
  // (a parabola of that length), resting on the floor at worst; taut once the legs
  // are further apart than the slack allows.
  const sagDepth = B.loose ? 0.5 * Math.sqrt(Math.max(0, B.slack * B.slack - d * d)) * 0.6 : 0;
  const sag = (P, t) => { if (sagDepth) { P.y -= sagDepth * Math.sin(Math.PI * t); P.y = Math.max(P.y, B.tube * 0.8); } return P; };
  const at = s => {
    let x = s * total;
    const P = new THREE.Vector3();
    if (x < arcA) { const a = Math.PI / 2 + x / A.r; return { p: P.copy(A.c).addScaledVector(u, Math.cos(a) * A.r).addScaledVector(v, Math.sin(a) * A.r), straight: 0 }; }
    x -= arcA;
    if (x < d) { const t = x / Math.max(d, 1e-6); return { p: sag(P.copy(A.c).addScaledVector(v, -A.r).lerp(C.c.clone().addScaledVector(v, -C.r), t), t), straight: 1 }; }
    x -= d;
    if (x < arcC) { const a = -Math.PI / 2 + x / C.r; return { p: P.copy(C.c).addScaledVector(u, Math.cos(a) * C.r).addScaledVector(v, Math.sin(a) * C.r), straight: 0 }; }
    x -= arcC;
    const t = x / Math.max(d, 1e-6);
    return { p: sag(P.copy(C.c).addScaledVector(v, C.r).lerp(A.c.clone().addScaledVector(v, A.r), t), t), straight: 1 };
  };
  const M = BUNCH_M, K = BUNCH_K, pts = [];
  for (let i = 0; i < M; i++) pts.push(at(i / M));
  // Stretched across the gap, the gathered fabric thins out.
  const stretch = B.loose ? 0 : Math.min(1, d / (A.r + C.r + 1e-6));
  const pos = B.mesh.geometry.attributes.position.array, inv = _bm4.copy(ch.group.matrixWorld).invert(), q = new THREE.Vector3();
  for (let i = 0; i < M; i++) {
    const P = pts[i].p, T = pts[(i + 1) % M].p.clone().sub(pts[(i + M - 1) % M].p).normalize();
    const side = T.clone().cross(n).normalize();        // outward from the loop, in its plane
    const s = i / M, thin = 1 - 0.35 * pts[i].straight * stretch;
    // Folds fixed to the fabric (indexed round the loop), so they stretch with it.
    // Loose fabric: broader, rounder folds (no fine ripple, which peaks into spikes).
    const fold = B.loose ? 1 + 0.3 * Math.sin(s * 2 * Math.PI * 7 + 1.3) * Math.sin(s * 2 * Math.PI * 3 + 0.4) + 0.12 * Math.sin(s * 2 * Math.PI * 11)
      : 1 + 0.28 * Math.sin(s * 2 * Math.PI * 9 + 1.3) * Math.sin(s * 2 * Math.PI * 4 + 0.4) + 0.12 * Math.sin(s * 2 * Math.PI * 17);
    for (let j = 0; j < K; j++) {
      const b = j / K * 2 * Math.PI, r = B.tube * thin * fold;
      q.copy(P).addScaledVector(side, Math.cos(b) * r).addScaledVector(n, Math.sin(b) * r * (1.35 + 0.35 * Math.sin(s * 2 * Math.PI * 5))).applyMatrix4(inv);
      pos.set([q.x, q.y, q.z], 3 * (i * K + j));
    }
  }
  B.mesh.geometry.attributes.position.needsUpdate = true;
  B.mesh.geometry.computeVertexNormals();
  // Inner rolls: the near half of each leg's circle (A round +u, C round -u), from the
  // back strand to the front one, with their own folds.
  const IM = BUNCH_IN, ipos = B.inner.geometry.attributes.position.array;
  [[A, 1], [C, -1]].forEach(([S, sgn], arc) => {
    const ip = [];
    for (let i = 0; i < IM; i++) { const a = -Math.PI / 2 + Math.PI * i / (IM - 1); ip.push(S.c.clone().addScaledVector(u, sgn * Math.cos(a) * S.r).addScaledVector(v, Math.sin(a) * S.r)); }
    for (let i = 0; i < IM; i++) {
      const T = ip[Math.min(IM - 1, i + 1)].clone().sub(ip[Math.max(0, i - 1)]).normalize(), side = T.clone().cross(n).normalize(), s2 = i / IM + arc * 0.37;
      const fold = B.loose ? 1 + 0.3 * Math.sin(s2 * 2 * Math.PI * 3 + 1.3) : 1 + 0.25 * Math.sin(s2 * 2 * Math.PI * 4 + 0.7) + 0.1 * Math.sin(s2 * 2 * Math.PI * 9);
      for (let j = 0; j < K; j++) {
        const b = j / K * 2 * Math.PI, rt = B.tube * 0.85 * fold;
        q.copy(ip[i]).addScaledVector(side, Math.cos(b) * rt).addScaledVector(n, Math.sin(b) * rt * 1.3).applyMatrix4(inv);
        ipos.set([q.x, q.y, q.z], 3 * (arc * IM * K + i * K + j));
      }
    }
  });
  B.inner.geometry.attributes.position.needsUpdate = true;
  B.inner.geometry.computeVertexNormals();
  // The seat: a sheet across the gap between the legs, from the bunched fabric round
  // one leg to the other. Its front and back edges are the waistband's two strands; its
  // sides follow the inner rolls (the centre of their tube, so the seam is inside the
  // roll). Slack fabric hangs down in the middle, less as the legs part; not below the floor.
  const GT = B.GT, GW = B.GW, gpos = B.gusset.geometry.attributes.position.array;
  const gap = Math.max(0, d - A.r - C.r), drop = 0.5 * Math.sqrt(Math.max(0, B.seat * B.seat - gap * gap));
  const hole = (S, w, sgn) => {                     // sgn +1: leg A's inner roll (+u); -1: leg C's (-u)
    const a = -Math.PI / 2 + Math.PI * w;
    return S.c.clone().addScaledVector(u, sgn * Math.cos(a) * S.r).addScaledVector(v, Math.sin(a) * S.r);
  };
  // Briefs' strip: hung from the middle of the front and back strands (`strip` wide
  // there), sagging between them by however much longer it is than the gap (`seat`).
  if (B.strip) {
    const strand = (sv, t) => sag(A.c.clone().addScaledVector(v, sv * A.r).lerp(C.c.clone().addScaledVector(v, sv * C.r), t), t);
    const span = A.r + C.r, hang = 0.5 * Math.sqrt(Math.max(0, B.seat * B.seat - span * span));
    // Which strand is in front: the one further along the body's forward direction.
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(ch.group.matrixWorld);
    const fs = strand(1, 0.5).dot(fwd) > strand(-1, 0.5).dot(fwd) ? 1 : -1;
    // It tapers from its full width where it meets the band in front and behind to its
    // narrowest between the legs, and is never wider there than the gap between them (less a
    // margin), gathering as they close.
    const span2 = Math.max(d, 1e-4), gapW = Math.max(0.004 * ch.spec.H, d - A.r - C.r - 0.01 * ch.spec.H);
    const mid = Math.min(B.strip[2], gapW);
    for (let i = 0; i < GT; i++) {
      const x = i / (GT - 1) - 0.5;
      for (let j = 0; j < GW; j++) {
        const w = j / (GW - 1), full = lerp(B.strip[0], B.strip[1], w);
        const half = lerp(full, Math.min(full, mid), Math.sin(Math.PI * w)) / 2;
        const t = clamp(0.5 + x * 2 * half / span2, 0, 1);
        const P = strand(fs, t).lerp(strand(-fs, t), w);
        P.y -= hang * Math.sin(Math.PI * w);
        P.y = Math.max(P.y, 0.004);
        P.applyMatrix4(inv);
        gpos.set([P.x, P.y, P.z], 3 * (i * GW + j));
      }
    }
    B.gusset.geometry.attributes.position.needsUpdate = true;
    B.gusset.geometry.computeVertexNormals();
    return;
  }
  for (let i = 0; i < GT; i++) {
    const t = i / (GT - 1);
    for (let j = 0; j < GW; j++) {
      const w = j / (GW - 1), edge = j === 0 || j === GW - 1;
      // The front and back edges run along the strands (at the band); the rest drop to the holes.
      let P;
      if (edge) {
        // Exactly along the waistband strand (the loop's straight part, with its sag).
        const sv = j === 0 ? -1 : 1;
        P = sag(A.c.clone().addScaledVector(v, sv * A.r).lerp(C.c.clone().addScaledVector(v, sv * C.r), t), t);
      } else {
        P = hole(A, w, 1).lerp(hole(C, w, -1), t);
        P.y -= drop * Math.sin(Math.PI * t) * Math.sin(Math.PI * w);
      }
      P.y = Math.max(P.y, 0.004);
      P.applyMatrix4(inv);
      gpos.set([P.x, P.y, P.z], 3 * (i * GW + j));
    }
  }
  B.gusset.geometry.attributes.position.needsUpdate = true;
  B.gusset.geometry.computeVertexNormals();
}
// Gathers the back of the skirt's hem up at the waistband, or lets it fall.
function setSkirtGathered(ch, on) {
  const S = ch.skirt;
  if (!S || !!S.gathered === on) return;
  S.gathered = on; S.stillT = 0; S.hu = null; S.fz = null;
  if (on) gatherPins(S, 0);
  if (S.shell || S.hybrid) layShell(ch);
}
// Where the hitched-up hem is held. Bent over (the back near horizontal) it is the hem of the back panel, caught just outside and
// below the waistband, with the cloth between it folding over; that works as it is. Standing (u → 1, the back vertical) the same
// hold leaves the hem hanging inside the hips, so it is instead drawn up the width of the hips (a wider arc of the back), tucked into
// the waistband itself (at its height, a little in), and the next row up is caught below it, so the hem and the cloth drawn up with
// it are all held at the band. `u` is 0 bent over, 1 upright.
function gatherPins(S, u) {
  S.hu = u;
  const N = S.N, R = S.R, c = -0.5 + 0.38 * u, list = [], pinned = new Set();
  for (let j = 0; j < N; j++) {
    if (Math.cos(2 * Math.PI * j / N) >= c) continue;
    const f = 1.12 - 0.09 * u;
    list.push([(R - 1) * N + j, j, f, -(0.012 - 0.018 * u)]);                       // hem row: [particle, column, radius factor, drop below the band (× height)]
    if (u > 0.3) list.push([(R - 2) * N + j, j, f + 0.03 * u, -(0.012 - 0.018 * u) - 0.02 * u]);   // the cloth drawn up with it, just under
  }
  for (const e of list) pinned.add(e[0]);
  S.pinList = list; S.pinned = pinned;
}
function setSkirtOff(ch, off) {
  if (!ch.skirt) return;
  if (!!ch.skirt.off === !!off) return;
  ch.skirt.fz = null;
  const changed = !!ch.skirt.off !== !!off;
  ch.skirt.off = off; ch.skirt.mesh.visible = !off && !ch.skirt.shell;
  if (ch.skirt.shellMesh) ch.skirt.shellMesh.visible = !off && !!ch.skirt.shell;
  if (!off && changed) ch.skirt.p = null;   // (only a skirt put back on starts again; asking for what it already is changes nothing)
}
function removeSkirt(ch) {
  if (!ch.skirt) return;
  ch.group.remove(ch.skirt.mesh); ch.skirt.mesh.geometry.dispose(); ch.skirt.mesh.material.dispose();
  if (ch.skirt.shellMesh) { ch.group.remove(ch.skirt.shellMesh); ch.skirt.shellMesh.geometry.dispose(); ch.skirt.shellMesh.material.dispose(); }
  ch.skirt = null;
}
// A character's contact proxies posed into world space, as SDF primitives with
// bounding spheres (for cloth collisions).
function posedProxies(o) {
  const sk = o.mesh.skeleton, M = {}, m3 = new THREE.Matrix3(), out = [];
  const mat = b => M[b] || (M[b] = o.bones[b].matrixWorld.clone().multiply(sk.boneInverses[BONES.indexOf(b)]));
  for (const e of o.proxies.ells) {
    const m = mat(e.bone); m3.setFromMatrix4(m);
    const c = new THREE.Vector3(...e.c).applyMatrix4(m).toArray();
    const [u, v, w] = [e.u, e.v, e.w].map(a => new THREE.Vector3(...a).applyMatrix3(m3).normalize().toArray());
    out.push({ type: 'ell', c, u, v, w, r: e.r, sc: c, sr: Math.max(...e.r) });
  }
  for (const q of o.proxies.cones) {
    const m = mat(q.bone), a = new THREE.Vector3(...q.a).applyMatrix4(m).toArray(), b = new THREE.Vector3(...q.b).applyMatrix4(m).toArray();
    const P = cone(a, b, q.r1, q.r2);
    P.sc = mul(add3(a, b), 0.5); P.sr = len3(sub(b, a)) / 2 + Math.max(q.r1, q.r2);
    out.push(P);
  }
  return out;
}
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _sM = new THREE.Matrix4(), _sT = new THREE.Matrix4(), _sV = new THREE.Vector3();
const _sD = new THREE.Matrix4(), _sI = new THREE.Matrix4(), _sV2 = new THREE.Vector3(), SKIRT_FOLLOW = SKIRT.FOLLOW, SKIRT_FOLLOW_ROT = 0.3, SKIRT_SLEEP = 1.5;
function skirtStep(ch, dt, everyone = [], solids = []) {
  const S = ch.skirt;
  if (!S || S.off || S.shell || !ch.group.parent || !ch.group.visible || dt <= 0) return;
  if (S.fz) { frozenFollow(ch, everyone, solids); return; }   // a baked skirt is carried by the skin, not simulated (see freezeSkirt)
  const R = S.R, N = S.N, n = R * N, sk = ch.mesh.skeleton;
  ch.group.updateMatrixWorld(true);
  // The waistband follows the body: skinning matrices blended as the torso is at that height.
  _sM.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  for (const [bone, w] of loftWeights(ch.spec, S.top)) {
    _sT.copy(ch.bones[bone].matrixWorld).multiply(sk.boneInverses[BONES.indexOf(bone)]);
    for (let k = 0; k < 16; k++) _sM.elements[k] += _sT.elements[k] * w;
  }
  const restW = k => _sV.set(S.rest[3 * k], S.rest[3 * k + 1], S.rest[3 * k + 2]).applyMatrix4(_sM);
  if (S.gathered && !S.hybrid) {   // how upright the waist is: 0 with the back near horizontal, 1 standing
    const upY = _sV2.set(0, 1, 0).transformDirection(_sM).y, u = Math.min(1, Math.max(0, (upY - 0.5) / 0.4));
    if (S.hu == null || Math.abs(u - S.hu) > 0.02) { gatherPins(S, u); S.stillT = 0; }
  }
  if (!S.p) {
    S.p = new Float32Array(n * 3); S.prev = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { restW(k); S.p.set([_sV.x, _sV.y, _sV.z], 3 * k); }
    S.prev.set(S.p);
    S.lastM = null;
    if (S.hybrid && S.kin) hybridDrive(ch);
  }
  const p = S.p, prev = S.prev;
  // Sleep: once her waist and everyone near her (their hips and hands) have held still
  // for SKIRT_SLEEP seconds, the cloth has settled; stop simulating so it doesn't
  // quiver on the spot (the collision passes never quite agree). Any movement wakes it.
  let moved = S.lastM ? 0 : Infinity;
  if (S.lastM) for (let e = 0; e < 16; e++) moved = Math.max(moved, Math.abs(_sM.elements[e] - S.lastM.elements[e]));
  const sig = new THREE.Vector3();
  for (const o of everyone) if (o !== ch && o.group.parent && o.group.visible)
    for (const bn of ['pelvis', 'handL', 'handR']) sig.add(o.bones[bn].getWorldPosition(_sV2));
  const others = S.sig ? sig.distanceTo(S.sig) : Infinity;
  S.sig = sig;
  S.stillT = moved < 2e-5 && others < 1e-3 ? (S.stillT || 0) + dt : 0;
  if (S.stillT > SKIRT_SLEEP) return;
  // Carry the cloth with the body's own movement since last frame, so drops and
  // lunges can't leave it behind to snag on the legs: the waist's travel in full
  // (SKIRT_FOLLOW), but only SKIRT_FOLLOW_ROT of its turning, so in a spin the skirt
  // lags and swings out, flying up with the turn.
  if (S.lastM) {
    const c0 = _sV2.set(0, S.top, 0).applyMatrix4(S.lastM), c1 = _sV.set(0, S.top, 0).applyMatrix4(_sM);
    const dt3 = c1.clone().sub(c0).multiplyScalar(SKIRT_FOLLOW);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(S.lastM), q1 = new THREE.Quaternion().setFromRotationMatrix(_sM);
    const dq = q1.multiply(q0.invert());
    const turn = new THREE.Quaternion().slerp(dq, SKIRT_FOLLOW_ROT), v = new THREE.Vector3();
    for (let k = N; k < n; k++) for (const arr of [p, prev]) {
      v.set(arr[3 * k], arr[3 * k + 1], arr[3 * k + 2]).sub(c0).applyQuaternion(turn).add(c0).add(dt3);
      arr[3 * k] = v.x; arr[3 * k + 1] = v.y; arr[3 * k + 2] = v.z;
    }
  }
  S.lastM = (S.lastM || new THREE.Matrix4()).copy(_sM);
  // Everything the cloth can touch this frame.
  const hip = ch.bones.pelvis.getWorldPosition(new THREE.Vector3());
  // Other bodies: their contact proxies, padded to make up for the smooth blends that
  // put their real surface a little outside them. Own body: the actual skin.
  const prims = everyone.filter(o => o !== ch && o.group.parent && o.group.visible && o.proxies && o.bones.pelvis.getWorldPosition(new THREE.Vector3()).distanceTo(hip) < 2.2).flatMap(posedProxies);
  // Own body, coarse: its proxies catch cloth that has ended up deep inside (a leg
  // swinging up into the skirt), where the skin-point test below can't reach.
  const own = posedProxies(ch);
  // Other people's hands (left out of the contact proxies, which IK places): a capsule
  // from wrist to fingertips, applied last so a palm lands on top of the cloth.
  const hands = [];
  for (const o of everyone) if (o !== ch && o.group.parent && o.group.visible) for (const sd of ['L', 'R']) {
    const a = o.bones['hand' + sd].getWorldPosition(new THREE.Vector3()), fb = o.bones['fingers' + sd];
    const tip = fb.localToWorld(new THREE.Vector3(...sub(o.spec.J['handEnd' + sd], o.spec.J['fingers' + sd])));
    const P = cone(a.toArray(), tip.toArray(), 0.013 * o.spec.H, 0.009 * o.spec.H);
    P.sc = mul(add3(P.a, P.b), 0.5); P.sr = len3(P.ba) / 2 + 0.03; hands.push(P);
  }
  skinPoints(ch, S);
  const bodies = everyone.filter(o => o !== ch && o.group.parent && o.group.visible && o.mesh && o.bones.pelvis.getWorldPosition(new THREE.Vector3()).distanceTo(hip) < 2.2).map(o => otherSkin(o, hip));
  const boxes = [], obbs = [];
  for (const o of solids.filter(Boolean)) {
    if (!o.userData || !o.userData.obb) { boxes.push(new THREE.Box3().setFromObject(o)); continue; }
    o.updateMatrixWorld(true);   // an implement: each of its meshes is a box in the mesh's own frame (it turns and tilts, so no world box will do)
    o.traverse(m => { if (!m.isMesh || !m.visible) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); obbs.push({ inv: m.matrixWorld.clone().invert(), m: m.matrixWorld, bb: m.geometry.boundingBox, wb: new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).expandByScalar(0.03) }); });
  }
  const _ov = new THREE.Vector3();
  const q = [0, 0, 0];
  // How far a point is inside Kiko's own body (plus the cloth's thickness), and which
  // way is out: her proxies for depth, her posed skin near the surface. [pen, nx, ny, nz]
  // or null when clear.
  const mq = [0, 0, 0];
  const ownPen = (x, y, z) => {
    mq[0] = x; mq[1] = y; mq[2] = z;
    let best = null;
    for (const P of own) {
      const dx = x - P.sc[0], dy = y - P.sc[1], dz = z - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(mq, P);
      if (d >= 0 || (best && SKIRT_PAD - d <= best[0])) continue;
      const e = 0.001, g = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const o = mq[a]; mq[a] = o + e; const f1 = primDist(mq, P); mq[a] = o - e; g[a] = f1 - primDist(mq, P); mq[a] = o; }
      const gl = len3(g) || 1; best = [SKIRT_PAD - d, g[0] / gl, g[1] / gl, g[2] / gl];
    }
    const cs = SKIN_CELL, cx = Math.round(x / cs), cy = Math.round(y / cs), cz = Math.round(z / cs);
    let nd = Infinity, ni = -1;
    for (let ix = cx - 1; ix <= cx; ix++) for (let iy = cy - 1; iy <= cy; iy++) for (let iz = cz - 1; iz <= cz; iz++) {
      const cell = S.grid.get(cellKey(ix, iy, iz)); if (!cell) continue;
      for (const k2 of cell) { const ex = x - S.skin.wp[3 * k2], ey = y - S.skin.wp[3 * k2 + 1], ez = z - S.skin.wp[3 * k2 + 2], d2 = ex * ex + ey * ey + ez * ez; if (d2 < nd) { nd = d2; ni = k2; } }
    }
    if (ni >= 0) {
      const W = S.skin.wp, Nn = S.skin.wn, o = 3 * ni;
      const sd = (x - W[o]) * Nn[o] + (y - W[o + 1]) * Nn[o + 1] + (z - W[o + 2]) * Nn[o + 2];
      if (sd < SKIRT_THICK && (!best || SKIRT_THICK - sd > best[0])) best = [SKIRT_THICK - sd, Nn[o], Nn[o + 1], Nn[o + 2]];
    }
    return best;
  };
  // Edges: the midpoint of each ring and column edge is tested too. Where the cloth
  // straddles part of the body (a thigh swung up between two rows, fabric stretched
  // over the glutes) both ends measure outside but the edge between them runs through
  // it; pushing both ends out together makes the cloth wrap round instead.
  const edges = S.springs.filter(sp => sp[4] === 0);
  const edgePass = () => {
    for (const [a, b] of edges) {
      const wa = a < N ? 0 : 1, wb = b < N ? 0 : 1;
      if (!wa && !wb) continue;
      const hit = ownPen((p[3 * a] + p[3 * b]) / 2, (p[3 * a + 1] + p[3 * b + 1]) / 2, (p[3 * a + 2] + p[3 * b + 2]) / 2);
      if (!hit) continue;
      const [pen, nx, ny, nz] = hit, ka = wa * (wb ? 1 : 2), kb = wb * (wa ? 1 : 2);
      p[3 * a] += nx * pen * ka; p[3 * a + 1] += ny * pen * ka; p[3 * a + 2] += nz * pen * ka;
      p[3 * b] += nx * pen * kb; p[3 * b + 1] += ny * pen * kb; p[3 * b + 2] += nz * pen * kb;
    }
  };
  // One particle against everything it can touch. The order is the point: bodies and furniture first, then other people's hands, and the
  // cloth's own body last, so that wherever things are squeezed (a palm pressing cloth onto skin, a thigh under the hem) the cloth ends up
  // on the skin and never inside it. The floor has the very last word.
  const grad = (P, at, g) => { const e = 0.001; for (let a = 0; a < 3; a++) { const o = at[a]; at[a] = o + e; const f1 = primDist(at, P); at[a] = o - e; g[a] = f1 - primDist(at, P); at[a] = o; } return len3(g) || 1; };
  const collide = k => {
    q[0] = p[3 * k]; q[1] = p[3 * k + 1]; q[2] = p[3 * k + 2];
    let hit = false;
    for (const B of boxes) {
      const lo = B.min, hi = B.max, t = SKIRT_THICK;
      if (q[0] > lo.x - t && q[0] < hi.x + t && q[1] > lo.y - t && q[1] < hi.y + t && q[2] > lo.z - t && q[2] < hi.z + t) {
        const pen = [[q[0] - (lo.x - t), 0, -1], [(hi.x + t) - q[0], 0, 1], [q[1] - (lo.y - t), 1, -1], [(hi.y + t) - q[1], 1, 1], [q[2] - (lo.z - t), 2, -1], [(hi.z + t) - q[2], 2, 1]];
        const m = pen.reduce((a, b) => b[0] < a[0] ? b : a);
        q[m[1]] += m[2] * m[0]; hit = true;
      }
    }
    for (const O of obbs) {
      if (q[0] < O.wb.min.x || q[0] > O.wb.max.x || q[1] < O.wb.min.y || q[1] > O.wb.max.y || q[2] < O.wb.min.z || q[2] > O.wb.max.z) continue;
      _ov.set(q[0], q[1], q[2]).applyMatrix4(O.inv);
      const lo = O.bb.min, hi = O.bb.max, t = SKIRT_THICK * 0.6;
      if (_ov.x > lo.x - t && _ov.x < hi.x + t && _ov.y > lo.y - t && _ov.y < hi.y + t && _ov.z > lo.z - t && _ov.z < hi.z + t) {
        const pen = [[_ov.x - (lo.x - t), 'x', -1], [(hi.x + t) - _ov.x, 'x', 1], [_ov.y - (lo.y - t), 'y', -1], [(hi.y + t) - _ov.y, 'y', 1], [_ov.z - (lo.z - t), 'z', -1], [(hi.z + t) - _ov.z, 'z', 1]];
        const m = pen.reduce((a, b) => b[0] < a[0] ? b : a);
        _ov[m[1]] += m[2] * m[0]; _ov.applyMatrix4(O.m); q[0] = _ov.x; q[1] = _ov.y; q[2] = _ov.z; hit = true;
      }
    }
    // Other people's bodies (their padded contact proxies): out along the nearest surface's normal.
    let best = Infinity, bp = null;
    for (const P of prims) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > (P.sr + SKIRT_THICK + 0.02) ** 2) continue;
      const d = primDist(q, P);
      if (d < best) { best = d; bp = P; }
    }
    const T = SKIRT_THICK + SKIRT_PAD;
    if (bp && best < T) { const g = [0, 0, 0], gl = grad(bp, q, g), push = T - best; for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push; hit = true; }
    // Other bodies' skin (a hand, a thigh, an arm, whatever is near), by the same plane test as the wearer's own.
    for (const B of bodies) if (skinPush(B.wp, B.wn, B.grid, q)) hit = true;
    // Hands (a capsule from wrist to fingertips): a palm comes down on top of the cloth.
    for (const P of hands) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(q, P);
      if (d >= SKIRT_THICK * 0.5) continue;
      const g = [0, 0, 0], gl = grad(P, q, g), push = SKIRT_THICK * 0.5 - d;
      for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push;
      hit = true;
    }
    // Own body, coarse: the proxies catch cloth that has got deep inside (a leg swinging up into the skirt). Out on the side it came from.
    for (const P of own) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(q, P);
      if (d >= 0) continue;
      const pp = [prev[3 * k], prev[3 * k + 1], prev[3 * k + 2]], at = primDist(pp, P) > d ? pp : q;
      const g = [0, 0, 0], gl = grad(P, at, g), push = SKIRT_PAD - d;
      for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push;
      hit = true;
    }
    // Own skin, last: wherever the cloth is squeezed it ends on the wearer's skin.
    if (skinPush(S.skin.wp, S.skin.wn, S.grid, q)) hit = true;
    if (q[1] < SKIRT_THICK) { q[1] = SKIRT_THICK; hit = true; }
    if (hit) {
      p[3 * k] = q[0]; p[3 * k + 1] = q[1]; p[3 * k + 2] = q[2];
      for (let a = 0; a < 3; a++) prev[3 * k + a] += (p[3 * k + a] - prev[3 * k + a]) * SKIRT.FRICTION;   // friction: some of the sliding speed is lost
    }
  };
  // The cloth's own layers (the hem lying over the thigh part of the skirt, a fold over a fold) keep their distance: particles that
  // are not neighbours in the grid push each other apart. A hash of the particles, rebuilt each time.
  const selfHash = new Map(), SC = SKIRT.SELF, cellOf = v => Math.floor(v / SC);
  const selfPass = () => {
    selfHash.clear();
    for (let k = N; k < n; k++) {
      const key = cellKey(cellOf(p[3 * k]), cellOf(p[3 * k + 1]), cellOf(p[3 * k + 2]));
      const c = selfHash.get(key); if (c) c.push(k); else selfHash.set(key, [k]);
    }
    for (let k = N; k < n; k++) {
      const rk = (k / N) | 0, ck = k % N, x = p[3 * k], y = p[3 * k + 1], z = p[3 * k + 2], cx = cellOf(x), cy = cellOf(y), cz = cellOf(z);
      for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const c = selfHash.get(cellKey(ix, iy, iz)); if (!c) continue;
        for (const j of c) {
          if (j <= k) continue;
          const dr = Math.abs(rk - ((j / N) | 0)), dcc = Math.abs(ck - j % N), dc = Math.min(dcc, N - dcc);
          if (dr <= 2 && dc <= 2) continue;   // neighbours on the cloth are held by the springs
          const dx = p[3 * j] - x, dy = p[3 * j + 1] - y, dz = p[3 * j + 2] - z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= SC * SC || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), wa = S.iw[k], wb = S.iw[j], ws = wa + wb; if (!ws) continue;
          const push = (SC - d) / d;
          p[3 * k] -= dx * push * wa / ws; p[3 * k + 1] -= dy * push * wa / ws; p[3 * k + 2] -= dz * push * wa / ws;
          p[3 * j] += dx * push * wb / ws; p[3 * j + 1] += dy * push * wb / ws; p[3 * j + 2] += dz * push * wb / ws;
        }
      }
    }
  };
  // Fixed small steps, however long the frame was.
  S.acc = Math.min((S.acc || 0) + Math.min(dt, 0.06), SKIRT.STEP * SKIRT.MAX_STEPS);
  const spA = S.sa, spB = S.sb, spL = S.sl, spK = S.sk, spN = S.sn, ns = spA.length;
  const H = SKIRT.STEP, damp = Math.exp(-SKIRT.DAMP * H), gStep = SKIRT.GRAVITY * H * H, maxMove2 = SKIRT.MAXMOVE * SKIRT.MAXMOVE;
  while (S.acc >= H) {
    S.acc -= H;
    for (let k = N; k < n; k++) {
      const i = 3 * k;
      let vx = (p[i] - prev[i]) * damp, vy = (p[i + 1] - prev[i + 1]) * damp, vz = (p[i + 2] - prev[i + 2]) * damp;
      prev[i] = p[i]; prev[i + 1] = p[i + 1]; prev[i + 2] = p[i + 2];
      vy -= gStep;
      const m2 = vx * vx + vy * vy + vz * vz;
      if (m2 > maxMove2) { const f = SKIRT.MAXMOVE / Math.sqrt(m2); vx *= f; vy *= f; vz *= f; }
      p[i] += vx; p[i + 1] += vy; p[i + 2] += vz;
    }
    for (let k = 0; k < N; k++) { restW(k); p.set([_sV.x, _sV.y, _sV.z], 3 * k); prev.set([_sV.x, _sV.y, _sV.z], 3 * k); }
    // Gathered (setSkirtGathered): the back of the hem is held up at the waistband, just outside and below it; the fabric between folds over.
    if (S.hybrid && S.kin) hybridDrive(ch);
    else if (S.gathered) for (const [k, j, f, drop] of S.pinList) {
      _sV.set(S.rest[3 * j] * f, S.rest[3 * j + 1] + drop * ch.spec.H, S.rest[3 * j + 2] * f).applyMatrix4(_sM); p.set([_sV.x, _sV.y, _sV.z], 3 * k); prev.set([_sV.x, _sV.y, _sV.z], 3 * k);
    }
    const pin = S.hybrid ? (k => !!S.kinSet && S.kinSet.has(k)) : (k => S.gathered && S.pinned.has(k));
    for (let it = 0; it < SKIRT.ITER; it++) {
      for (let si = 0; si < ns; si++) {
        const a = spA[si], b = spB[si], L0 = spL[si], stiff = spK[si], kind = spN[si], ax = 3 * a, bx = 3 * b;
        const dx = p[bx] - p[ax], dy = p[bx + 1] - p[ax + 1], dz = p[bx + 2] - p[ax + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        // Stretch is resisted in full, squashing only partly (cloth buckles into folds); a bend spring only ever eases a crease.
        const c = (d - L0) / d * stiff * (d < L0 && kind !== 2 ? SKIRT.COMPRESS : 1);
        const wa = pin(a) ? 0 : S.iw[a], wb = pin(b) ? 0 : S.iw[b], ws = wa + wb;
        if (!ws) continue;
        if (it === 0 && kind !== 2) {   // internal damping, once a step: take speed out of how fast the pair is closing or opening
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const rv = ((p[bx] - prev[bx]) - (p[ax] - prev[ax])) * nx + ((p[bx + 1] - prev[bx + 1]) - (p[ax + 1] - prev[ax + 1])) * ny + ((p[bx + 2] - prev[bx + 2]) - (p[ax + 2] - prev[ax + 2])) * nz;
          const f = SKIRT.SPRING_DAMP * rv;
          prev[ax] -= nx * f * wa / ws; prev[ax + 1] -= ny * f * wa / ws; prev[ax + 2] -= nz * f * wa / ws;
          prev[bx] += nx * f * wb / ws; prev[bx + 1] += ny * f * wb / ws; prev[bx + 2] += nz * f * wb / ws;
        }
        p[ax] += dx * c * wa / ws; p[ax + 1] += dy * c * wa / ws; p[ax + 2] += dz * c * wa / ws;
        p[bx] -= dx * c * wb / ws; p[bx + 1] -= dy * c * wb / ws; p[bx + 2] -= dz * c * wb / ws;
      }
      if (it === SKIRT.ITER - 3) {   // strain limit: along every ring and column, nothing stretches past MAX_STRAIN
        for (let si = 0; si < ns; si++) {
          if (spN[si] !== 0) continue;
          const a = spA[si], b = spB[si], lim = spL[si] * SKIRT.MAX_STRAIN, ax = 3 * a, bx = 3 * b;
          const dx = p[bx] - p[ax], dy = p[bx + 1] - p[ax + 1], dz = p[bx + 2] - p[ax + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
          if (d <= lim) continue;
          const wa = pin(a) ? 0 : S.iw[a], wb = pin(b) ? 0 : S.iw[b], ws = wa + wb; if (!ws) continue;
          const c = (d - lim) / d;
          p[ax] += dx * c * wa / ws; p[ax + 1] += dy * c * wa / ws; p[ax + 2] += dz * c * wa / ws;
          p[bx] -= dx * c * wb / ws; p[bx + 1] -= dy * c * wb / ws; p[bx + 2] -= dz * c * wb / ws;
        }
      }
      if (it >= SKIRT.ITER - 2) {
        for (let k = N; k < n; k++) if (!pin(k)) collide(k);   // the last passes end on a collision, so nothing is left inside the body
        if (it === SKIRT.ITER - 1) edgePass();
      }
    }
  }
  // The cloth's own layers keep apart: once a frame is enough (folds persist), then one more collision so nothing ends inside the body.
  selfPass();
  for (let k = N; k < n; k++) if (!(S.hybrid ? (S.kinSet && S.kinSet.has(k)) : (S.gathered && S.pinned.has(k)))) collide(k);
  if (S.debug) {   // (for tests: how many particles are inside the body, and how far)
    let pc = 0, mp = 0;
    let wk = -1; for (let k = N; k < n; k++) { const h = ownPen(p[3 * k], p[3 * k + 1], p[3 * k + 2]); if (h && h[0] > 0.004) { pc++; if (h[0] > mp) { mp = h[0]; wk = k; } } }
    S.stats = { inside: pc, deepest: +mp.toFixed(4), worst: wk < 0 ? null : { row: (wk / N) | 0, col: wk % N, at: [p[3 * wk], p[3 * wk + 1], p[3 * wk + 2]].map(v => +v.toFixed(3)) } };
  }
  // Into the character's group space for drawing.
  const pos = S.mesh.geometry.attributes.position.array, inv = _sT.copy(ch.group.matrixWorld).invert();
  for (let k = 0; k < n; k++) { _sV.set(p[3 * k], p[3 * k + 1], p[3 * k + 2]).applyMatrix4(inv); pos[3 * k] = _sV.x; pos[3 * k + 1] = _sV.y; pos[3 * k + 2] = _sV.z; }
  S.mesh.geometry.attributes.position.needsUpdate = true;
  S.mesh.geometry.computeVertexNormals();
}


// ── The skirt shell (discipline scenes) ─────────────────────────
// In a discipline scene a skirt is not cloth: it is a shell, a mesh skinned to the body's own bones, laid out once and never simulated, so it can
// neither spike nor cling nor flip up when clothes come down. Its shape is the skirt's hanging shape (S.rest, in the rest pose) with the back
// gathered up and tucked at the waistband, round the hips, in thick folds; each vertex takes its skinning from the nearest point of the body's
// rest surface (trunk and legs, never the arms). So the skirt follows the pelvis and the thighs exactly as the skin does: it lies along the
// thighs across the lap, hangs from the hips when the body is bent over (the legs stay upright) and when standing, and is outside the body wherever
// the skin is, with the hanging shape's own gap (a few centimetres) to spare in the creases. For a skirt of about knee length or shorter.
function trunkPrims(spec) { return spec.prims.filter(P => P.type === 'loft' || ['torso', 'bust', 'glute', 'perineum', 'thigh', 'hip'].includes(P.tag || P.group)); }
function layShell(ch) {
  const S = ch.skirt, spec = ch.spec, H = spec.H, R = S.R, N = S.N, n = R * N, L = S.L; if (!S.shellPos) shellWeights(ch); const P = S.shellPos;
  // The body's outer surface at angle th and height y, from the skin mesh itself (its trunk and leg vertices in the rest pose, binned by angle and
  // height; the furthest out in each bin), so a band laid on it sits on the skin as drawn, glutes and all.
  if (!ch._skinBins) {
    const g = ch.mesh.geometry, pa = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, bins = new Map();
    for (let v = 0; v < pa.length / 3; v++) {
      let bw = -1, bb = 0; for (let m = 0; m < 4; m++) if (sw[4 * v + m] > bw) { bw = sw[4 * v + m]; bb = si[4 * v + m]; }
      if (!/^(pelvis|spine1|spine2|thigh)/.test(BONES[bb])) continue;
      const x = pa[3 * v], y = pa[3 * v + 1], z = pa[3 * v + 2], r = Math.hypot(x, z), th = Math.atan2(x, z);
      const key = Math.round(((th + Math.PI) / (2 * Math.PI)) * 96) % 96 + ',' + Math.round(y / 0.01);
      if (!(bins.get(key) >= r)) bins.set(key, r);
    }
    ch._skinBins = bins;
  }
  const surf = (th, y) => {
    const tt = ((th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), a = Math.round(tt / (2 * Math.PI) * 96) % 96, yb = Math.round(y / 0.01);
    let best = 0;
    for (let da = -1; da <= 1; da++) for (let dy = -1; dy <= 1; dy++) { const r = ch._skinBins.get(((a + da + 96) % 96) + ',' + (yb + dy)); if (r > best) best = r; }
    return best || 0.15;
  };
  const len = (L.length || 0.18) * H, rise = Math.min(len * 0.06, 0.02 * H), thick = Math.min(0.022, 0.008 + len * 0.02) * H / 1.78;   // (the gather is at the waistband and no lower: the glutes are clear of cloth; its bulk is in thickness, not length)
  for (let k = 0; k < n * 3; k++) P[k] = S.rest[k];
  if (S.gathered) {
    for (let j = 0; j < N; j++) {
      const th = 2 * Math.PI * j / N, c = Math.cos(th), a = smooth01(0.12, -0.3, c);   // 0 at the front, 1 over the whole of the back and round the hips
      if (a <= 0) continue;
      for (let i = 1; i < R; i++) {
        const t = i / (R - 1), o = 3 * (i * N + j), yG = S.top + 0.004 * H + rise * t;
        const rG = surf(th, yG) + 0.003 + thick * (0.35 + 0.65 * t) * (1 + 0.3 * Math.sin(6 * th + 5 * t) + 0.15 * Math.sin(13 * th - 3 * t));
        P[o] += (Math.sin(th) * rG - P[o]) * a; P[o + 1] += (yG - P[o + 1]) * a; P[o + 2] += (Math.cos(th) * rG - P[o + 2]) * a;
      }
    }
  }
  if (S.shellMesh) { const pos = S.shellMesh.geometry.attributes.position.array; pos.set(P); S.shellMesh.geometry.attributes.position.needsUpdate = true; S.shellMesh.geometry.computeVertexNormals(); S.shellMesh.geometry.computeBoundingSphere(); }
  if (S.hybrid) hybridKin(ch);
}
// The skinning of every skirt vertex (rest layout), from the nearest point of the body's rest surface (trunk and legs only).
function shellWeights(ch) {
  const S = ch.skirt; if (S.shellI) return;
  const R = S.R, N = S.N, n = R * N, g = ch.mesh.geometry, pa = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
  const ok = [];
  for (let v = 0; v < pa.length / 3; v += 2) { let bw = -1, bb = 0; for (let m = 0; m < 4; m++) if (sw[4 * v + m] > bw) { bw = sw[4 * v + m]; bb = si[4 * v + m]; } if (/^(pelvis|spine1|spine2|thigh|shin)/.test(BONES[bb])) ok.push(v); }
  S.shellPos = new Float32Array(n * 3); S.shellI = new Uint16Array(n * 4); S.shellW = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const x = S.rest[3 * k], y = S.rest[3 * k + 1], z = S.rest[3 * k + 2];
    let best = Infinity, bv = -1;
    for (const v of ok) { const dx = x - pa[3 * v], dy = y - pa[3 * v + 1], dz = z - pa[3 * v + 2], d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bv = v; } }
    for (let m = 0; m < 4; m++) { S.shellI[4 * k + m] = si[4 * bv + m]; S.shellW[4 * k + m] = sw[4 * bv + m]; }
  }
}
function setSkirtShell(ch, on) {
  const S = ch.skirt; if (!S || !!S.shell === on) return;
  S.shell = on;
  if (on && !S.shellMesh) {
    shellWeights(ch);
    const R = S.R, N = S.N, n = R * N;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(S.shellI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(S.shellW, 4));
    geo.setIndex(Array.from(S.mesh.geometry.index.array));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: lin(S.L.color), roughness: 0.82, metalness: 0, side: THREE.DoubleSide, skinning: true }));
    mesh.bind(ch.mesh.skeleton, ch.mesh.bindMatrix); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    ch.group.add(mesh); S.shellMesh = mesh;
  }
  if (on) layShell(ch);
  S.mesh.visible = !S.off && !on;
  if (S.shellMesh) S.shellMesh.visible = !S.off && on;
}
// ── The hybrid skirt (the subject's, in a discipline scene) ────
// The back of the skirt is gathered into a band at the waistband (the shell's layout, see layShell) that is driven by the body's bones, like a worn
// garment's gathered waistband (see bunchStep): those cloth points are not simulated, they are put where the skinning puts them every step. The
// front and the sides stay real cloth, held at the waist and at the edges of the band, which hangs, lies along the thighs and is pushed out of the
// other body, the arms, the furniture and the wearer's own skin by the ordinary cloth collisions. So the part that cannot be trusted to a simulation
// (the back, between the glutes and everything pressing on them) is attached to the body, and the part that has to react (the front) is cloth.
function setSkirtHybrid(ch, on) {
  const S = ch.skirt; if (!S || !!S.hybrid === on) return;
  S.hybrid = on; S.fz = null; S.p = null;
  if (on) { shellWeights(ch); layShell(ch); }
  else { S.kin = null; S.kinSet = null; }
}
function hybridKin(ch) {   // which points are driven: the whole of the back, from the first ring down
  const S = ch.skirt, N = S.N, R = S.R, list = [];
  if (!S.gathered) { S.kin = null; S.kinSet = null; return; }
  for (let j = 0; j < N; j++) { const c = Math.cos(2 * Math.PI * j / N); if (smooth01(0.12, -0.3, c) >= 0.5) for (let i = 1; i < R; i++) list.push(i * N + j); }
  S.kin = Int32Array.from(list); S.kinSet = new Set(list);
}
const _hM = [];
function hybridDrive(ch) {   // the driven points, skinned by the bones' current pose
  const S = ch.skirt, p = S.p, prev = S.prev, sk = ch.mesh.skeleton, bones = sk.bones;
  const M = _hM; for (let b = 0; b < bones.length; b++) M[b] = _sT.clone().multiplyMatrices(bones[b].matrixWorld, sk.boneInverses[b]).elements;
  for (const k of S.kin) {
    let x = 0, y = 0, z = 0; const px = S.shellPos[3 * k], py = S.shellPos[3 * k + 1], pz = S.shellPos[3 * k + 2];
    for (let a = 0; a < 4; a++) { const w = S.shellW[4 * k + a]; if (!w) continue; const e = M[S.shellI[4 * k + a]]; x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]); }
    p[3 * k] = x; p[3 * k + 1] = y; p[3 * k + 2] = z; prev[3 * k] = x; prev[3 * k + 1] = y; prev[3 * k + 2] = z;
  }
}

// ── The baked skirt ─────────────────────────────────────────────
// A skirt is simulated once per position (settleSkirt) and then baked: every cloth point, and a few sample points on every triangle (the middle
// and the middle of each edge, since a triangle can cut through a corner that its three corners clear), are pushed out of the wearer's skin, the
// other bodies' skin and the furniture until none is inside anything. Then the skirt is frozen: each point is fixed to the skin point nearest it
// (in that point's own frame), so it goes wherever the body goes and nothing is simulated again.
const SKIRT_CLEAR = 0.003, SKIRT_TOL = 0.0006;   // clear of skin by 3 mm (a sample is 'not clear' when it is more than 0.6 mm short of that)
function skirtContext(ch, others, solids, skinDone = false) {
  const S = ch.skirt; ch.group.updateMatrixWorld(true); if (!skinDone) skinPoints(ch, S);
  const hip = ch.bones.pelvis.getWorldPosition(new THREE.Vector3());
  const bodies = others.filter(o => o !== ch && o.group.parent && o.group.visible && o.mesh && o.bones.pelvis.getWorldPosition(new THREE.Vector3()).distanceTo(hip) < 2.2).map(o => otherSkin(o, hip));
  const boxes = [], obbs = [];
  for (const o of (solids || []).filter(Boolean)) {
    if (!o.userData || !o.userData.obb) { boxes.push(new THREE.Box3().setFromObject(o)); continue; }
    o.updateMatrixWorld(true);
    o.traverse(m => { if (!m.isMesh || !m.visible) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); obbs.push({ inv: m.matrixWorld.clone().invert(), m: m.matrixWorld, bb: m.geometry.boundingBox, wb: new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).expandByScalar(0.03) }); });
  }
  return { bodies, boxes, obbs };
}
// The two skin points nearest q (a crease has two surfaces; being outside one is not enough), as indices, within 3 cm.
const _sn2 = [-1, -1];
function skinNear2(wp, grid, q) {
  const cs = SKIN_CELL, cx = Math.floor(q[0] / cs), cy = Math.floor(q[1] / cs), cz = Math.floor(q[2] / cs);
  let n1 = 0.03 * 0.03, i1 = -1, n2 = 0.03 * 0.03, i2 = -1;
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
    const cell = grid.get(cellKey(ix, iy, iz)); if (!cell) continue;
    for (let c = 0; c < cell.length; c++) { const k = cell[c], dx = q[0] - wp[3 * k], dy = q[1] - wp[3 * k + 1], dz = q[2] - wp[3 * k + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < n1) { n2 = n1; i2 = i1; n1 = d2; i1 = k; } else if (d2 < n2) { n2 = d2; i2 = k; } }
  }
  _sn2[0] = i1; _sn2[1] = i2; return _sn2;
}
// How far, and which way, a point at q has to go to be clear of everything: writes the displacement to out, returns its length (0: clear).
const _so2 = new THREE.Vector3();
function skirtPush(S, X, q, out) {
  let best = 0; out[0] = out[1] = out[2] = 0;
  let src = '';
  const take = (a, x, y, z) => { if (a > best) { best = a; out[0] = x * a; out[1] = y * a; out[2] = z * a; X.src = src; } };
  const planes = (wp, wn, grid, margin = SKIRT_CLEAR) => { for (const i of skinNear2(wp, grid, q)) { if (i < 0) continue; const o = 3 * i, sd = (q[0] - wp[o]) * wn[o] + (q[1] - wp[o + 1]) * wn[o + 1] + (q[2] - wp[o + 2]) * wn[o + 2]; if (sd < margin) take(margin - sd, wn[o], wn[o + 1], wn[o + 2]); } };
  src = 'own skin'; if (X.own !== false) planes(S.skin.wp, S.skin.wn, S.grid, X.ownMargin);
  src = 'other body'; for (const B of X.bodies) planes(B.wp, B.wn, B.grid);
  src = 'furniture';
  // the way out of a board is a face on the cloth's own side: the side the wearer's skin faces
  let ownN = null; if (X.obbs.length || X.boxes.length) { const i = skinNear2(S.skin.wp, S.grid, q)[0]; if (i >= 0) ownN = [S.skin.wn[3 * i], S.skin.wn[3 * i + 1], S.skin.wn[3 * i + 2]]; }
  const exit = faces => {
    let least = Infinity; for (const f of faces) least = Math.min(least, f[0]);
    let pick = null;
    if (ownN) for (const f of faces) if (f[0] <= least + 0.03 && f[1] * ownN[0] + f[2] * ownN[1] + f[3] * ownN[2] > 0.15 && (!pick || f[0] < pick[0])) pick = f;
    if (!pick) for (const f of faces) if (!pick || f[0] < pick[0]) pick = f;
    return pick;
  };
  const t = SKIRT_CLEAR;
  for (const Bx of X.boxes) if (q[0] > Bx.min.x - t && q[0] < Bx.max.x + t && q[1] > Bx.min.y - t && q[1] < Bx.max.y + t && q[2] > Bx.min.z - t && q[2] < Bx.max.z + t) {
    const f = exit([[q[0] - (Bx.min.x - t), -1, 0, 0], [(Bx.max.x + t) - q[0], 1, 0, 0], [q[1] - (Bx.min.y - t), 0, -1, 0], [(Bx.max.y + t) - q[1], 0, 1, 0], [q[2] - (Bx.min.z - t), 0, 0, -1], [(Bx.max.z + t) - q[2], 0, 0, 1]]);
    take(f[0], f[1], f[2], f[3]);
  }
  for (const O of X.obbs) {
    if (q[0] < O.wb.min.x || q[0] > O.wb.max.x || q[1] < O.wb.min.y || q[1] > O.wb.max.y || q[2] < O.wb.min.z || q[2] > O.wb.max.z) continue;
    _so2.set(q[0], q[1], q[2]).applyMatrix4(O.inv);
    const lo = O.bb.min, hi = O.bb.max;
    if (_so2.x > lo.x - t && _so2.x < hi.x + t && _so2.y > lo.y - t && _so2.y < hi.y + t && _so2.z > lo.z - t && _so2.z < hi.z + t) {
      const dir = (x, y, z) => { const e = new THREE.Vector3(x, y, z); e.transformDirection(O.m); return [e.x, e.y, e.z]; };
      const f = exit([[_so2.x - (lo.x - t), ...dir(-1, 0, 0)], [(hi.x + t) - _so2.x, ...dir(1, 0, 0)], [_so2.y - (lo.y - t), ...dir(0, -1, 0)], [(hi.y + t) - _so2.y, ...dir(0, 1, 0)], [_so2.z - (lo.z - t), ...dir(0, 0, -1)], [(hi.z + t) - _so2.z, ...dir(0, 0, 1)]]);
      take(f[0], f[1], f[2], f[3]);
    }
  }
  src = 'floor'; if (q[1] < t) take(t - q[1], 0, 1, 0);   // the floor
  return best;
}
// Pushes the cloth clear (apply) or only counts what is not clear. Counts points and triangle samples that are more than SKIRT_TOL inside.
function clearSkirt(ch, X, iters = 40, apply = true) {
  const S = ch.skirt, p = S.p, N = S.N, n = S.R * N, idx = S.mesh.geometry.index.array, q = [0, 0, 0], d = [0, 0, 0];
  const fixed = k => k < N || (S.hybrid ? (S.kinSet && S.kinSet.has(k)) : (S.gathered && S.pinned && S.pinned.has(k)));
  const SAMPLES = apply && !X.light ? [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]] : [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]];
  const own0 = X.own !== false;
  let res = { inside: 0, clipped: 0, points: 0, deepest: 0, worst: null };
  for (let it = 0; it < (apply ? iters : 1); it++) {
    res = { inside: 0, clipped: 0, points: 0, deepest: 0, worst: null };
    const note = (a, at, what) => { if (a > SKIRT_TOL) { res.inside++; if (a > SKIRT_CLEAR + 0.0005) { res.clipped++; res.by = res.by || {}; const kk = (what === 'point' ? '' : 'tri:') + X.src; res.by[kk] = (res.by[kk] || 0) + 1; if (what === 'point') res.points++; } if (a > res.deepest) { res.deepest = a; res.worst = { what: what + ' vs ' + X.src, at: at.map(v => +v.toFixed(3)) }; } return true; } return false; };
    X.own = own0;
    for (let k = N; k < n; k++) {
      if (fixed(k)) continue;
      q[0] = p[3 * k]; q[1] = p[3 * k + 1]; q[2] = p[3 * k + 2];
      const a = skirtPush(S, X, q, d);
      if (note(a, q.slice(), 'point') && apply) { p[3 * k] += d[0]; p[3 * k + 1] += d[1]; p[3 * k + 2] += d[2]; }
    }
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      for (const w of SAMPLES) {
        X.own = own0 && !X.verticesOwn;
        q[0] = q[1] = q[2] = 0; for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) q[c] += w[i] * p[3 * v[i] + c];
        const a = skirtPush(S, X, q, d);
        if (!note(a, q.slice(), 'triangle') || !apply) continue;
        let den = 0; for (let i = 0; i < 3; i++) if (!fixed(v[i])) den += w[i] * w[i];
        if (den < 1e-6) continue;
        for (let i = 0; i < 3; i++) if (!fixed(v[i])) { const f = w[i] / den; for (let c = 0; c < 3; c++) p[3 * v[i] + c] += d[c] * f; }
      }
    }
    if (apply && ch.skirt.debug) (ch.skirt.log = ch.skirt.log || []).push([res.inside, res.clipped]);
    if (!res.inside || (X.quick && res.deepest < 0.0016)) break;   // (a frame's pass stops once nothing is more than 1.6 mm short of clear)
  }
  return res;
}
// Fixes each cloth point to the skin point nearest it, on the outward side (and never an arm's), as an offset in that skin point's own frame.
function bindSkirtToSkin(ch) {
  const S = ch.skirt, K = S.skin, n = S.R * S.N, p = S.p;
  const ok = new Uint8Array(K.n);
  for (let a = 0; a < K.n; a++) { let bw = -1, bb = 0; for (let m = 0; m < 4; m++) if (K.w[4 * a + m] > bw) { bw = K.w[4 * a + m]; bb = K.i[4 * a + m]; } ok[a] = /^(upperArm|forearm|hand|fingers|thumb|clav)/.test(BONES[bb]) ? 0 : 1; }
  const idx = new Int32Array(n), loc = new Float32Array(n * 3), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const x = p[3 * k], y = p[3 * k + 1], z = p[3 * k + 2];
    let best = Infinity, bi = -1, any = Infinity, ai = 0;
    for (let a = 0; a < K.n; a++) {
      if (!ok[a]) continue;
      const dx = x - K.wp[3 * a], dy = y - K.wp[3 * a + 1], dz = z - K.wp[3 * a + 2], d = dx * dx + dy * dy + dz * dz;
      if (d < any) { any = d; ai = a; }
      if (d < best && dx * K.wn[3 * a] + dy * K.wn[3 * a + 1] + dz * K.wn[3 * a + 2] > -0.002) { best = d; bi = a; }
    }
    if (bi < 0) bi = ai;
    const L = K.lin, o = 9 * bi;
    m3.set(L[o], L[o + 1], L[o + 2], L[o + 3], L[o + 4], L[o + 5], L[o + 6], L[o + 7], L[o + 8]).invert();
    v.set(x - K.wp[3 * bi], y - K.wp[3 * bi + 1], z - K.wp[3 * bi + 2]).applyMatrix3(m3);
    idx[k] = bi; loc[3 * k] = v.x; loc[3 * k + 1] = v.y; loc[3 * k + 2] = v.z;
  }
  S.fz = { idx, loc };
}
// A baked skirt for one frame: each point where its skin point has taken it. Then, where something else has come into the cloth since (a
// hand or an arm swinging by, the other body's reaction, a board), the cloth is pushed clear of it for this frame only (the next frame starts
// again from the bake, so nothing builds up and nothing quivers); the wearer's own skin is tested again too, since a bent knee or a turning hip can carry a point into it.
function frozenFollow(ch, everyone = [], solids = []) {
  const S = ch.skirt, K = S.skin, F = S.fz, n = S.R * S.N, p = S.p, L = K.lin;
  ch.group.updateMatrixWorld(true); skinPoints(ch, S);
  for (let k = 0; k < n; k++) {
    const b = F.idx[k], o = 9 * b, lx = F.loc[3 * k], ly = F.loc[3 * k + 1], lz = F.loc[3 * k + 2];
    p[3 * k] = K.wp[3 * b] + L[o] * lx + L[o + 1] * ly + L[o + 2] * lz;
    p[3 * k + 1] = K.wp[3 * b + 1] + L[o + 3] * lx + L[o + 4] * ly + L[o + 5] * lz;
    p[3 * k + 2] = K.wp[3 * b + 2] + L[o + 6] * lx + L[o + 7] * ly + L[o + 8] * lz;
  }
  if (everyone.length || solids.length) { const X = skirtContext(ch, everyone.filter(o => o !== ch), solids, true); X.quick = true; clearSkirt(ch, X, 3, true); }
  drawSkirt(ch);
}
function drawSkirt(ch) {
  const S = ch.skirt, n = S.R * S.N, p = S.p, pos = S.mesh.geometry.attributes.position.array, inv = _sT.copy(ch.group.matrixWorld).invert();
  for (let k = 0; k < n; k++) { _sV.set(p[3 * k], p[3 * k + 1], p[3 * k + 2]).applyMatrix4(inv); pos[3 * k] = _sV.x; pos[3 * k + 1] = _sV.y; pos[3 * k + 2] = _sV.z; }
  S.mesh.geometry.attributes.position.needsUpdate = true;
  S.mesh.geometry.computeVertexNormals();
}
function freezeSkirt(ch, others = [], solids = []) {
  const S = ch.skirt; if (!S || S.off || !S.p) return;
  S.fz = null;
  if (!S.skin.lin) S.skin.lin = new Float32Array(S.skin.n * 9);
  const X = skirtContext(ch, others, solids); X.ownMargin = 0.009;   // (6 mm more than a frozen skirt needs at rest: room for a knee to bend or a hip to turn)
  S.clip = clearSkirt(ch, X, 60, true);
  bindSkirtToSkin(ch);
  frozenFollow(ch, others, solids);
}
// What of the skirt is inside anything, for tests: counts of cloth points and triangle samples more than a millimetre inside skin, furniture or the floor.
function skirtClipReport(ch, others = [], solids = []) {
  const S = ch.skirt; if (!S) return null;
  if (S.shell) {   // the shell as drawn: its vertices skinned on the CPU
    ch.group.updateMatrixWorld(true); S.shellMesh.updateMatrixWorld(true);
    const n = S.R * S.N, pos = S.shellMesh.geometry.attributes.position, v = new THREE.Vector3();
    S.p = S.p && S.p.length === n * 3 ? S.p : new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { v.fromBufferAttribute(pos, k); S.shellMesh.boneTransform(k, v); v.applyMatrix4(S.shellMesh.matrixWorld); S.p[3 * k] = v.x; S.p[3 * k + 1] = v.y; S.p[3 * k + 2] = v.z; }
    if (!S.skin.lin) S.skin.lin = new Float32Array(S.skin.n * 9);
  }
  if (!S.p) return null;
  const X = skirtContext(ch, others, solids), r = clearSkirt(ch, X, 1, false);
  return r;
}
function unfreezeSkirt(ch) { if (ch.skirt) { ch.skirt.fz = null; ch.skirt.p = null; ch.skirt.lastM = null; } }

// Puts a skirt on a body that is already in a pose (a bent-over subject), so that it hangs the way it would have if she had bent over
// in it: the body is walked from standing into the pose over a moment, pelvis fixed, while the cloth falls and drapes, and is then put
// back exactly where it was. (Starting the cloth in its rest shape around an already-bent body leaves it lying on the back like a lampshade.)
// `others` take part only for the last stretch, so the cloth settles onto them as they are. Call after the scene has placed the bodies.
function settleSkirt(ch, others = [], solids = [], seconds = 1.5, freeze = false) {
  const S = ch.skirt;
  if (!S || S.off || S.shell) return;
  S.fz = null;
  const g = ch.group, endQ = g.quaternion.clone(), endP = g.position.clone();
  const endBones = {}; for (const b of BONES) endBones[b] = ch.bones[b].quaternion.clone();
  const stand = poseQuats(POSES.Relaxed), yaw = new THREE.Euler().setFromQuaternion(endQ, 'YXZ').y;
  const standQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  const pelJ = new THREE.Vector3(...ch.spec.J.pelvis);
  const pelEnd = pelJ.clone().applyQuaternion(endQ).add(endP);
  const frames = Math.round(seconds * 60), bend = Math.round(frames * 0.5), all = [ch, ...others.filter(o => o !== ch)];
  S.p = null; S.lastM = null; S.stillT = 0; S.acc = 0;
  for (let i = 0; i <= frames; i++) {
    const t0 = Math.min(1, i / bend), t = t0 * t0 * (3 - 2 * t0);
    g.quaternion.slerpQuaternions(standQ, endQ, t);
    for (const b of BONES) ch.bones[b].quaternion.slerpQuaternions(stand[b], endBones[b], t);
    g.position.copy(pelEnd).sub(pelJ.clone().applyQuaternion(g.quaternion));
    g.updateMatrixWorld(true);
    skirtStep(ch, 1 / 60, i < frames * 0.75 ? [ch] : all, i < frames * 0.75 ? [] : solids);
  }
  g.quaternion.copy(endQ); g.position.copy(endP);
  for (const b of BONES) ch.bones[b].quaternion.copy(endBones[b]);
  g.updateMatrixWorld(true);
  S.lastM = null; S.stillT = 0;
  if (freeze) freezeSkirt(ch, others, solids);   // baked: from here the skirt is carried by the skin (unfreezeSkirt to simulate it again)
}


// ════════════════════════════════════════════════════════════════
// SHIRT PARTS — the 3D bits of a shirt, on a top layer that asks for them (the painted body, the V neck and the fastening are in the shader and
// topCoverage): a collar (`collar`): a band round the neck and two points laid down over the chest along the V; and rolled cuffs (`cuffs`):
// two rolls of cloth round each forearm where the sleeve (set to three-quarter length with `sleeves: 1.75`) ends. Each is a mesh on a bone, so
// it turns with the neck and the forearm. The cloth is the shirt's own colour (`cuffColor` for the rolls, a little darker by default).
// ════════════════════════════════════════════════════════════════
function removeShirtParts(ch) {
  if (!ch.shirtParts) return;
  for (const m of ch.shirtParts) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }
  ch.shirtParts = null;
}
function buildShirtParts(ch, L) {
  removeShirtParts(ch);
  const spec = ch.spec, H = spec.H, Y = spec.Y, J = spec.J, parts = [], tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const mat = hex => new THREE.MeshStandardMaterial({ color: lin(hex), roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  const add = (bone, geo, material, at) => {
    const m = new THREE.Mesh(geo, material); m.position.set(at[0] - J[bone][0], at[1] - J[bone][1], at[2] - J[bone][2]);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; ch.bones[bone].add(m); parts.push(m);
  };
  // The body's surface along a horizontal ray from the neck's axis at height y and angle th (0 = front), so a collar can lie on it.
  const cz = J.neck[2], surf = (th, y) => {
    const dx = Math.sin(th), dz = Math.cos(th), p = [0, y, 0];
    let r = 0.3;
    for (; r > 0.004; r -= 0.006) { p[0] = dx * r; p[2] = cz + dz * r; if (field(spec, p) < 0) break; }
    let lo = r, hi = r + 0.006;
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; p[0] = dx * m; p[2] = cz + dz * m; if (field(spec, p) < 0) lo = m; else hi = m; }
    return [dx * hi, y, cz + dz * hi, dx, dz];
  };
  if (L.collar) {
    const neckR = spec.m.neck / 100 / (2 * Math.PI), V = (L.neck || '') === 'v', cut = 0.34;   // the collar opens at the front, ±cut rad
    const NS = 44, NR = 6, pos = [], idx = [];
    const topAt = x => Y.neckBase - 0.016 * H + 0.008 * H * 0 - (V ? vNeckDrop(H, x) : 0);   // the painted neckline at sideways position x (front)
    for (let i = 0; i <= NS; i++) {
      const th = cut + (2 * Math.PI - 2 * cut) * i / NS, front = Math.cos(th) > 0 ? 1 : 0, side = Math.abs(Math.sin(th));
      const x0 = surf(th, Y.neckBase)[0];
      const yTop = (front ? topAt(x0) : Y.neckBase - 0.008 * H) + 0.001 * H;                  // where the shirt's neckline is at this angle
      const tip = Math.pow(Math.max(0, Math.cos(th)), 2);                                     // 1 at the points, 0 round the back
      const yFold = yTop + 0.016 * H;
      let yEdge = yTop - (0.006 + 0.011 * side + 0.034 * tip) * H;
      // A collar is a few centimetres wide: lower down than that the body (the slope of the shoulder) is further out than the cloth reaches.
      const rLimit = neckR + 0.062 * (H / 1.78) + 0.014 * tip;
      for (let y = yFold; y > yEdge; y -= 0.002 * H) { const q = surf(th, y); if (Math.hypot(q[0], q[2] - cz) > rLimit) { yEdge = Math.max(yEdge, y + 0.002 * H); break; } }
      for (let j = 0; j < NR; j++) {
        const f = j / (NR - 1), y = yFold + (yEdge - yFold) * f;
        const q = surf(th, y), lift = 0.004 + 0.0045 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.5) + 0.002 * f;   // stands off the body, the fold lying on it
        pos.push(q[0] + q[3] * lift, y, q[2] + q[4] * lift);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR - 1; j++) { const a = i * NR + j, b = a + NR; idx.push(a, b, b + 1, a, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // (positions are rest-space; the mesh sits on the neck bone, so shift them by the bone's rest origin)
    const o = J.neck; const pa = g.attributes.position.array; for (let k = 0; k < pa.length; k += 3) { pa[k] -= o[0]; pa[k + 1] -= o[1]; pa[k + 2] -= o[2]; }
    const m = new THREE.Mesh(g, mat(L.collarColor != null ? L.collarColor : L.color)); m.position.set(o[0] - o[0], 0, 0);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; ch.bones.neck.add(m); parts.push(m);
  }
  if (L.cuffs) {
    const at = L.cuffAt != null ? L.cuffAt : Math.max(0.1, L.sleeves - 1 - 0.04);   // along the forearm, from the elbow: just above where the sleeve is cut (sleeves 1.5 ends halfway down)
    for (const side of ['L', 'R']) {
      const P = spec.prims.find(q => q.type === 'cone' && q.tag === 'forearm' && q.bone === 'forearm' + side); if (!P) continue;
      const a = new THREE.Vector3(...P.a), b = new THREE.Vector3(...P.b), axis = b.clone().sub(a).normalize(), c = a.clone().lerp(b, at);
      // The forearm's real radius there: the widest the surface reaches round the axis (muscle bulges beyond the cone).
      const u1 = new THREE.Vector3(0, 0, 1).sub(axis.clone().multiplyScalar(axis.z)).normalize(), u2 = axis.clone().cross(u1);
      let rad = 0;
      for (let k = 0; k < 12; k++) {
        const ang = 2 * Math.PI * k / 12, d = u1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u2, Math.sin(ang));
        let r = 0.12; for (; r > 0.004; r -= 0.003) { const pt = c.clone().addScaledVector(d, r); if (field(spec, [pt.x, pt.y, pt.z]) < 0) break; }
        rad = Math.max(rad, r);
      }
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      const roll = (shift, k) => {
        const R = rad + 0.0085 * (H / 1.78) * 0.9, tube = 0.0095 * (H / 1.78);
        const g = new THREE.TorusGeometry(R, tube, 10, 28); g.scale(1, 1, 1.5);
        const m = new THREE.Mesh(g, mat(L.cuffColor != null ? L.cuffColor : tint(L.color, k).getHex())); m.quaternion.copy(q);
        const pt = c.clone().addScaledVector(axis, shift); m.position.set(pt.x - J['forearm' + side][0], pt.y - J['forearm' + side][1], pt.z - J['forearm' + side][2]);
        m.castShadow = m.receiveShadow = true; m.frustumCulled = false; ch.bones['forearm' + side].add(m); parts.push(m);
      };
      roll(-0.0105 * (H / 1.78), 0.96); roll(0.0105 * (H / 1.78), 1.0);   // two rolls, side by side
    }
  }
  ch.shirtParts = parts;
}


// ════════════════════════════════════════════════════════════════
// BELT — on a layer with `belt` (a colour, or { color, buckle, width, at: 'belly' | 'waist' | 'hip' | 'under', buckleScale }): a leather band round the body, with a
// metal buckle at the front. On bottoms it sits at the belly line, where a top and the bottoms meet; on a dress (a top or a skirt) at the waist. It is skinned to the same pelvis/spine blend as the body at that height, so it bends with the
// waist; it comes off with the bottoms when they are lowered.
// ════════════════════════════════════════════════════════════════
function removeHem(ch) {
  if (!ch.hem) return;
  for (const m of ch.hem) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }
  ch.hem = null;
}
function buildHem(ch, L) {
  removeHem(ch);
  const spec = ch.spec, H = spec.H, Y = spec.Y, half = 0.016 * H / 1.78, y = Y.belly - 0.01 * H - half * 0.2, ring = loftRing(spec.prims[0], y);
  const W = loftWeights(spec, y), names = BONES, boneIdx = W.map(([b]) => names.indexOf(b));
  const [a, bf, bb, zc] = ring, N = 72, sect = [[0.0025, -half], [0.0105, -half * 0.55], [0.0125, 0], [0.0105, half * 0.55], [0.0025, half]], pos = [], idx = [], K = sect.length;
  for (let i = 0; i <= N; i++) {
    const th = 2 * Math.PI * i / N, c = Math.cos(th), sn = Math.sin(th), d = c > 0 ? bf : bb, x = a * sn, z = zc + d * c;
    const nx = sn / a, nz = c / d, nl = Math.hypot(nx, nz) || 1;
    for (const [off, dy] of sect) pos.push(x + nx / nl * (off + 0.006), y + dy, z + nz / nl * (off + 0.006));
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < K - 1; j++) { const a0 = i * K + j, b0 = i * K + j + 1; idx.push(a0, b0, b0 + K, a0, b0 + K, a0 + K); }
  const g = new THREE.BufferGeometry(), n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < W.length; k++) { si[4 * i + k] = boneIdx[k]; sw[4 * i + k] = W[k][1]; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color: lin(L.color), roughness: 0.85, side: THREE.DoubleSide, skinning: true }));
  mesh.bind(ch.mesh.skeleton, ch.mesh.bindMatrix); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  ch.group.add(mesh); ch.hem = [mesh];
}
function removeBelt(ch) {
  if (!ch.belt) return;
  for (const m of ch.belt) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }
  ch.belt = null;
}
function buildBelt(ch, L) {
  removeBelt(ch);
  const spec = ch.spec, H = spec.H, Y = spec.Y, B = typeof L.belt === 'object' ? L.belt : { color: L.belt };
  const half = (B.width || 0.017) * H / 1.78, y0 = Y[B.at || (L.kind === 'bottom' ? 'belly' : 'waist')], y = L.kind === 'bottom' && !B.at ? y0 - half : y0, ring = loftRing(spec.prims[0], y);   // (a belt on bottoms starts half its width below the belly line, so the shirt's hem never shows under it)
  const W = loftWeights(spec, y), names = BONES, boneIdx = W.map(([b]) => names.indexOf(b));
  const mk = (pos, idx, color, metal) => {
    const g = new THREE.BufferGeometry(), n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < W.length; k++) { si[4 * i + k] = boneIdx[k]; sw[4 * i + k] = W[k][1]; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color: lin(color), roughness: metal ? 0.35 : 0.7, metalness: metal ? 0.8 : 0, side: THREE.DoubleSide, skinning: true }));
    mesh.bind(ch.mesh.skeleton, ch.mesh.bindMatrix); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    ch.group.add(mesh); return mesh;
  };
  // The band: an ellipse hugging the torso's loft ring at the belly, a rounded rectangle in section.
  const [a, bf, bb, zc] = ring, N = 72, sect = [[0.002, -half], [0.0075, -half * 0.8], [0.0075, half * 0.8], [0.002, half]], pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const th = 2 * Math.PI * i / N, c = Math.cos(th), sn = Math.sin(th), d = c > 0 ? bf : bb, x = a * sn, z = zc + d * c;
    // outward normal of the ellipse (x/a)^2 + (z/d)^2 = 1
    const nx = sn / a, nz = c / d, nl = Math.hypot(nx, nz) || 1;
    for (const [off, dy] of sect) pos.push(x + nx / nl * off, y + dy, z + nz / nl * off);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a0 = i * 4 + j, b0 = i * 4 + (j + 1) % 4; idx.push(a0, b0, b0 + 4, a0, b0 + 4, a0 + 4); }
  const parts = [mk(pos, idx, B.color != null ? B.color : 0x4a3220, false)];
  // The buckle: a flat metal frame on the front centre.
  const bw = 0.022 * H / 1.78 * (B.buckleScale || 1), bh = half * 1.35, t = 0.004, z0 = zc + bf + 0.0085, bpos = [], bidx = [];
  const box = (x0, y0, x1, y1, zz0, zz1) => { const o = bpos.length / 3; for (const [x, yy, z] of [[x0, y0, zz0], [x1, y0, zz0], [x1, y1, zz0], [x0, y1, zz0], [x0, y0, zz1], [x1, y0, zz1], [x1, y1, zz1], [x0, y1, zz1]]) bpos.push(x, yy, z);
    for (const f of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]]) bidx.push(o + f[0], o + f[1], o + f[2]); };
  const w = 0.0035;
  box(-bw, y - bh, -bw + w * 2, y + bh, z0, z0 + t); box(bw - w * 2, y - bh, bw, y + bh, z0, z0 + t);   // sides of the frame
  box(-bw, y + bh - w * 2, bw, y + bh, z0, z0 + t); box(-bw, y - bh, bw, y - bh + w * 2, z0, z0 + t);    // top and bottom
  box(-0.0015, y - bh * 0.9, 0.0015, y + bh * 0.9, z0 - 0.001, z0 + t + 0.001);                          // the prong
  parts.push(mk(bpos, bidx, B.buckle != null ? B.buckle : 0xb8aa80, true));
  ch.belt = parts;
}

// ════════════════════════════════════════════════════════════════
// BUST CONTACT — keeps each breast out of other people's bodies (a leaning
// disciplinarian's chest over the subject's hips; a subject's chest hanging onto the
// disciplinarian's thigh). Points on the bust's surface are tested against each
// other character's actual body: mapped into their rest pose through the nearest
// body segment's bone and measured with their own distance field. Any point inside
// (or within BUST_PAD of the skin) pushes the bust bone out along that body's
// surface normal. The breast's base stays on the chest, so moving the bone flattens
// it against the surface instead of passing through. Call after bustSpring, with
// everyone on set.
// ════════════════════════════════════════════════════════════════
const BUST_PAD = 0.003;
// Sample directions on the bust ellipsoid (its own axes; +z is forward).
const BUST_DIRS = [[0, 0, 1], [0.7, 0, 0.7], [-0.7, 0, 0.7], [0, 0.7, 0.7], [0, -0.7, 0.7], [0.5, 0.5, 0.7], [-0.5, 0.5, 0.7],
  [0.5, -0.5, 0.7], [-0.5, -0.5, 0.7], [1, 0, 0], [-1, 0, 0], [0, -1, 0.1], [0, 1, 0.1]].map(norm);
// Body segments [bone, child]: a point is mapped into rest pose through the nearest one's bone.
const SEGMENTS = [['pelvis', 'spine1'], ['spine1', 'spine2'], ['spine2', 'neck'], ['neck', 'head'],
  ...['L', 'R'].flatMap(s => [['thigh' + s, 'shin' + s], ['shin' + s, 'foot' + s], ['upperArm' + s, 'forearm' + s], ['forearm' + s, 'hand' + s]])];
const _bq = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bn = new THREE.Matrix3();
function bustContact(ch, everyone) {
  if (!ch.spec.bust) return;
  const others = everyone.filter(o => o !== ch && o.group.parent);
  if (!others.length) return;
  const sk = ch.mesh.skeleton, sp = ch.bones.spine2;
  ch.bustPush = ch.bustPush || { L: new THREE.Vector3(), R: new THREE.Vector3() };
  // Each other body: world segments, and each segment bone's skinning matrix and inverse.
  const bodies = others.map(o => ({ o, segs: SEGMENTS.map(([a, b]) => {
    const i = BONES.indexOf(a), m = o.bones[a].matrixWorld.clone().multiply(o.mesh.skeleton.boneInverses[i]);
    return { a: o.bones[a].getWorldPosition(new THREE.Vector3()), b: o.bones[b].getWorldPosition(new THREE.Vector3()), m, inv: m.clone().invert() };
  }) }));
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const P = ch.spec.prims.find(q => q.tag === 'bust' && q.side === s), b = ch.bones['bust' + side];
    const reach = Math.max(...P.r) * 0.8;
    // The push is in world space; the bone's position is in spine2's frame, from where
    // bustSpring left it this frame.
    const base = b.position.clone(), spInv = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
    const place = v => { b.position.copy(base).add(v.clone().applyQuaternion(spInv)); b.updateMatrixWorld(true); };
    let push = new THREE.Vector3();
    for (let it = 0; it < 2; it++) {
      place(push);
      _bm.copy(b.matrixWorld).multiply(sk.boneInverses[BONES.indexOf('bust' + side)]);
      let worst = null, depth = 0;
      for (const d of BUST_DIRS) {
        const rest = add(P.c, add(mul(P.u, d[0] * P.r[0]), add(mul(P.v, d[1] * P.r[1]), mul(P.w, d[2] * P.r[2]))));
        const q = _bq.set(...rest).applyMatrix4(_bm);
        for (const { o, segs } of bodies) {
          let best = Infinity, seg = null;
          for (const g of segs) {
            const ab = g.b.clone().sub(g.a), t = clamp(q.clone().sub(g.a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
            const dd = g.a.clone().addScaledVector(ab, t).distanceToSquared(q);
            if (dd < best) { best = dd; seg = g; }
          }
          if (best > 0.09) continue;                               // nothing within 30 cm
          const r = q.clone().applyMatrix4(seg.inv).toArray();
          const f = field(o.spec, r);
          if (f >= BUST_PAD || BUST_PAD - f <= depth) continue;
          depth = BUST_PAD - f;
          const g = gradient(o.spec, r, 0.002, f);
          worst = new THREE.Vector3(...g).applyMatrix3(_bn.setFromMatrix4(seg.m)).normalize().multiplyScalar(depth);
        }
      }
      if (!worst) break;
      push.add(worst);
      if (push.length() > reach) push.setLength(reach);
    }
    // Ease out of contact (never into it), so a breast settles back instead of snapping.
    const prev = ch.bustPush[side];
    if (push.lengthSq() < prev.lengthSq()) push = prev.clone().lerp(push, 0.25);
    prev.copy(push);
    place(push);
  }
}

global.Starlight = {
  SKIRT, SKIRT_THICK, posedProxies, posedBoneCone, primDist, settleSkirt, freezeSkirt, unfreezeSkirt, skirtClipReport, setSkirtShell, setSkirtHybrid, PRESETS, ORDER, FACE_DEFAULTS, faceParams, BONES, POSES, clone, SKIN, BRA_STYLES, lookLayers, dress, setSkin,
  buildCharacter, disposeCharacter, resetCharacter, setPose, groundFeet, wideStance, poseQuats, degQ, mirrorPose, animateCharacter, bustSpring, bustContact, updateContacts, faceStep, setExpression, setMood, setMoods, MOODS, moodFor, EXPR_RANGE, mouthOpening, EXPR_DEFAULTS, skirtStep, bunchStep, setSkirtOff, setSkirtGathered, setLowered, addMark, clearMarks, fadeMarks, fadeMarksMove, copyMarks, markStrength, markCount,
  hairStep, bodyColliders, hairReset, setFingerCurl, setFingerBend, fistPocket,
  ALL_MATS, lin, field, loftRing,
  setPress, createPain, PAIN, clothCushion, FACE, glReport, watchGL, createDisciplineScene, POSITIONS: ['lap', 'case', 'head', 'knees', 'spread'], IMPLEMENTS, PADDLE, seatGiver, buildBench, DEFAULT_TIMING, GIVER_BASE, GIVER_BEAT, GIVER_SEATED,
  armIK, armReach, twoBoneTo, casePalm, standAt, humeralTwist, elbowClearance, posedSkinNear, skinSignedDist, lookAt,
  setHandWorld, rotateBoneWorld, seatExcess, seatPoints, restClearance, PARENT,
  DANCE_BASE, DANCE_SRC, DANCE_MOVES, SIDED, STUMBLE, mirrorName, createDancer,
};
})(window);
