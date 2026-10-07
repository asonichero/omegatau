// Birchwood House — the live correction. A wrapper over the engine's discipline scene: it builds the room, the furniture and the
// two bodies, lets the player smack, run and stop whenever they like, change position, implement, layers, pace and strength in
// the middle of it, and reports how far the resident has been brought (the pain model's distress), which is all the rules read.
(function (root) {
'use strict';
const S = root.Starlight, T = root.THREE, Room = root.FairyShoeRoom, Poses = root.FairyShoePoses || {};
const V3 = T.Vector3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// id, label, what it is. 'chair' is the engine's hands-on-knees scene with a chair set in front for the hands.
const POSITIONS = [
  ['lap', 'Across the lap', 'Seated, you draw them down across your knees.'],
  ['case', 'Over the table', 'Bent at the hips over the table, palms flat on the boards.'],
  ['head', 'Hands on head', 'Standing, fingers laced on top of the head.'],
  ['chair', 'Hands on the chair', 'Bent forward, hands on the seat of the chair you sit in.'],
  ['spread', 'Bent over, feet apart', 'Bent forward, feet wide, palms on the thighs. Wide implements only.'],
];
// 'hips' is an editor-only base position (not in POSITIONS, so never offered in the game): the table scene, bent at the hips.
// 'astride' is another editor-only base position: the lap scene (the player seated on the chair) with its own pose edits.
const ENGINE_POSITION = { lap: 'lap', astride: 'lap', hips: 'case', case: 'case', head: 'head', chair: 'knees', spread: 'spread' };
const IMPLEMENTS = [
  ['hand', 'Hand', 'Nothing to fetch. Stings, and fades quickly.'],
  ['hairbrush', 'Hairbrush', 'Light and sharp; a dull ache follows.'],
  ['rod', 'Willow switch', 'Thin, fast, and leaves stripes. Hardest on a first stroke.'],
  ['paddle', 'Cedar paddle', 'Broad and heavy: both sides at once, a deep ache.'],
];
// Bottoms and briefs are down or up; a skirt is down (it drapes, and is simulated), hitched up at the back, or off.
const SKIRT_MODES = ['down', 'up', 'off'];
const skirtMode = v => v === true ? 'down' : !v ? 'off' : SKIRT_MODES.includes(v) ? v : 'down';
const LAYER_LABELS = { skirt: { down: 'Skirt down', up: 'Skirt hitched up', off: 'Skirt off' }, bottoms: ['Bottoms down', 'Bottoms up'], briefs: ['Briefs down', 'Briefs up'] };
const layerLabel = (name, v) => name === 'skirt' ? LAYER_LABELS.skirt[skirtMode(v)] : LAYER_LABELS[name][v ? 0 : 1];
const layerNext = (name, v) => name === 'skirt' ? SKIRT_MODES[(SKIRT_MODES.indexOf(skirtMode(v)) + 1) % SKIRT_MODES.length] : !v;
const CAMERAS = [['overview', 'Overview'], ['behind', 'Behind'], ['shoulder', 'Over your shoulder'], ['floor', 'Face']];
const PACE = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const STRENGTH = [0.4, 0.6, 0.8, 1, 1.25, 1.5];
const RUN = [4, 8, 12, 16, 24, 32, 48];

// ── Sound: a clap per smack ─────────────────────────────────────
const Sound = (() => {
  let ctx = null, buf = null, on = true;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  };
  const burst = (t, dur, freq, peak) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + dur);
    s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t); s.stop(t + dur + 0.05);
  };
  const clap = (impl, strength = 1) => {
    if (!ctx || !on) return;
    const t = ctx.currentTime, k = 0.25 + 0.2 * strength;
    if (impl === 'hairbrush') { burst(t, 0.04, 3600, k); burst(t + 0.004, 0.06, 700, 0.55 * k); }
    else if (impl === 'rod') { burst(t, 0.03, 4800, k); burst(t + 0.002, 0.05, 1500, 0.4 * k); }
    else if (impl === 'paddle') { burst(t, 0.07, 2000, 1.1 * k); burst(t + 0.003, 0.11, 420, 0.8 * k); burst(t + 0.006, 0.05, 4200, 0.35 * k); }
    else { burst(t, 0.09, 2500, 0.9 * k); burst(t + 0.008, 0.05, 1100, 0.5 * k); }
  };
  return { init, clap, set: v => { on = v; } };
})();

// ── Pose edits (js/poses.js, from the editor's pose report) ─────
// The scene reads its pose tables every frame from the scene object, so a copy with the edited bones swapped in is enough.
function applyPoseOverrides(scn, position) {
  const list = Poses[position] || [];
  for (const e of list) {
    const q = Object.fromEntries(Object.entries(e.bones).filter(([b]) => scn.s.bones[b]).map(([b, v]) => [b, S.degQ(v)]));
    if (e.who === 'subject' && e.beat === 'base') scn.baseQ = { ...scn.baseQ, ...q };
    else if (e.who === 'subject') {
      const R = scn.buck ? scn.buckQ : scn.reactQ, out = {};
      for (const k of ['L', 'R']) out[k] = { ...R[k], ...(k === 'L' ? q : mirrorQ(q)) };
      out.B = Object.fromEntries(Object.keys(out.L).map(b => [b, out.L[b].clone().slerp(out.R[b], 0.5)]));
      scn[scn.buck ? 'buckQ' : 'reactQ'] = out;
    } else {
      const orig = scn.giverQ, cache = {};
      scn.giverQ = beat => { const base = orig(beat); if (beat !== e.beat) return base; return cache[scn.implement] || (cache[scn.implement] = { ...base, ...q }); };
      scn.giverQ.edited = true;
    }
  }
}
// The same edit on the other side of the body (the engine's mirrorPose: swap L/R and flip the roll and yaw).
function mirrorQ(q) {
  const out = {};
  for (const [b, v] of Object.entries(q)) {
    const name = /L$/.test(b) ? b.slice(0, -1) + 'R' : /R$/.test(b) ? b.slice(0, -1) + 'L' : b;
    const e = new T.Euler().setFromQuaternion(v, 'YXZ'); e.y = -e.y; e.z = -e.z;
    out[name] = new T.Quaternion().setFromEuler(e);
  }
  return out;
}

// ── Furniture ───────────────────────────────────────────────────
// The furniture the engine builds (a road case) is swapped for the room's own, built to the same size and put in the same place.
// For the hands-on-the-chair position there is none to swap: the chair the player sits in is set square in front of the subject,
// and the returned `plant` holds where each palm goes on its seat (see holdChairHands).
function chairSeatTop(g) {
  const probe = S.seatGiver(g), top = new T.Box3().setFromObject(probe.bench).max.y;
  Room.disposeGroup(probe.bench); return top;
}
function furnishScene(parent, scn, s, position, seatTop, giver) {
  const old = scn.bench; let made = null, plant = null;
  if (old) {
    const b = new T.Box3().setFromObject(old); parent.remove(old); Room.disposeGroup(old);
    if (position === 'lap' || position === 'astride') {
      // A straight-backed chair for a seated disciplinarian: the seat runs from the small of the back to the knee joint (deep enough to carry the thighs out to it,
      // so they do not hang over an edge at the hip), its top is the underside of the thighs, and the backrest meets the lower back.
      scn.seatTop = b.max.y;
      const gp = giver; gp.group.updateMatrixWorld(true);
      const pel = gp.bones.pelvis.getWorldPosition(new T.Vector3()), knee = gp.bones.shinL.getWorldPosition(new T.Vector3());
      const ring = S.loftRing(gp.spec.prims[0], gp.spec.Y.belly), backZ = pel.z - ring[2] - 0.008, lw = 0.042;
      const D = (knee.z + 0.01) - backZ + (0.03 + lw / 2), W = Math.max(0.44, 2 * (Math.abs(gp.bones.thighL.getWorldPosition(new T.Vector3()).x - pel.x) + 0.12));
      made = Room.buildChair(b.max.y, W, D);
      made.position.set(pel.x, 0, backZ - 0.03 - lw / 2 + D / 2);   // (the rear posts' front faces are on the line of the back; the seat runs forward from there)
    }
    else made = Room.buildTable(b.max.y, b.min.x, b.max.x, b.max.z - b.min.z);
  } else if (position === 'chair') {
    made = new T.Group(); const chair = Room.buildChair(seatTop); chair.rotation.y = -Math.PI / 2; made.add(chair);
    for (let i = 0; i < 2; i++) scn.update(0.016);
    plant = {}; let cx = 0;
    for (const side of ['L', 'R']) {
      const sh = s.bones['upperArm' + side].getWorldPosition(new T.Vector3());
      const targetY = seatTop + 0.0085 * s.spec.H + 0.004, dy = Math.max(0, sh.y - targetY), r = S.armReach(s, side) * 0.9;
      const dx = Math.sqrt(Math.max(0.0025, r * r - dy * dy));
      plant[side] = new V3(sh.x + dx, targetY, clamp(sh.z, -0.15, 0.15));
      cx = Math.max(cx, plant[side].x);
    }
    chair.position.set(cx + 0.07, 0, 0);
  }
  if (made) { made.userData.obb = true; scn.bench = made; parent.add(made);   // (cloth meets each board and leg, not one big box round the lot)
    made.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  return plant;
}
// Hands on the chair: planted on the seat however the body moves. Call each frame after the scene's own update.
function holdChairHands(s, plant) {
  if (plant.hips) return holdHipHands(plant.g, s);
  if (plant.astride) return holdAstrideHands(plant.g, s);
  for (const side of ['L', 'R']) {
    const sh = s.bones['upperArm' + side].getWorldPosition(new T.Vector3()), out = side === 'L' ? -1 : 1;
    S.armIK(s, side, plant[side], sh.clone().add(new V3(-0.1, 0.05, out * 0.5)), new V3(0, 1, 0), new V3(1, 0, 0));
  }
}

// How far the neck and head extend (about their own x, 40% / 60%) for the face to look level, as the body lies across the lap, and which way that is.
function lapLookAhead(s) {
  const neck = s.bones.neck, head = s.bones.head, q0 = neck.quaternion.clone(), q1 = head.quaternion.clone(), X = new V3(1, 0, 0), best = { sign: 1, e: 0 };
  const faceY = () => { s.group.updateMatrixWorld(true); return new V3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new T.Quaternion())).y; };
  const at = (sign, e) => { neck.quaternion.copy(q0).multiply(new T.Quaternion().setFromAxisAngle(X, sign * e * 0.4 * Math.PI / 180)); head.quaternion.copy(q1).multiply(new T.Quaternion().setFromAxisAngle(X, sign * e * 0.6 * Math.PI / 180)); return faceY(); };
  const y0 = at(1, 0), up = at(1, 30) > at(-1, 30) ? 1 : -1; best.sign = up;
  for (let e = 0; e <= 42; e += 2) { best.e = e; if (at(up, e) >= -0.02) break; }   // (as far as a neck and head comfortably go; the rest of the way, the eyes)
  neck.quaternion.copy(q0); head.quaternion.copy(q1); s.group.updateMatrixWorld(true);
  return y0 >= -0.02 ? null : best;
}


// ── Astride (editor-only base position) ─────────────────────────
// The player sits halfway forward on the seat, back resting against the chair's, hands at the subject's waist. The subject faces them, seated on their lap with a thigh
// either side of the chair, feet planted on the floor beside it, hands on the player's shoulders.
function holdAstrideHands(g, s) {
  g.group.updateMatrixWorld(true); s.group.updateMatrixWorld(true);
  const kg = g.spec.H / 1.7, ks = s.spec.H / 1.7, Y = new V3(0, 1, 0);
  for (const side of ['L', 'R']) {
    const out = side === 'L' ? 1 : -1;   // the player's left is +X; the subject, facing the other way, has its left at -X
    // each of the subject's hands on top of the player's shoulder on its own side of the body (the subject's left hand reaches the player's right shoulder)
    const mine = side === 'L' ? 'R' : 'L';   // (the subject's hand that goes to the player's `side` shoulder)
    const palmT = g.bones['upperArm' + side].getWorldPosition(new V3()).add(new V3(0, 0.045 * kg, 0));
    const pole = s.bones['upperArm' + mine].getWorldPosition(new V3()).add(new V3(out * 0.3, -0.25, 0.15));
    S.armIK(s, mine, palmT, pole, Y, new V3(0, 0, -1));
    // the player's hands on the subject's waist, at each side
    const wp = s.bones.spine1.getWorldPosition(new V3()), half = 0.13 * ks;
    const target = wp.clone().add(new V3(out * (half + 0.012 * kg), 0.0, 0));
    const gsh = g.bones['upperArm' + side].getWorldPosition(new V3());
    S.armIK(g, side, target, gsh.clone().add(new V3(out * 0.25, -0.2, -0.1)), new V3(out, 0, 0), new V3(0, -0.15, 1));
  }
  // eyes and heads toward each other
  S.lookAt(g, s.bones.head.getWorldPosition(new V3()), 0.7); S.lookAt(s, g.bones.head.getWorldPosition(new V3()), 0.7);
}
function setupAstride(parent, scn, g, s) {
  const kg = g.spec.H / 1.7, ks = s.spec.H / 1.7, Y = new V3(0, 1, 0), BONES = S.BONES;
  g.group.updateMatrixWorld(true);
  // the player: halfway forward on the seat, the spine tipped back until the back meets the chair's
  const f = 0.12 * kg;
  g.group.position.z += f; g.group.updateMatrixWorld(true);
  const feet0 = {}; for (const side of ['L', 'R']) feet0[side] = g.bones['foot' + side].getWorldPosition(new V3());   // where the feet stand on the floor
  const spineBackZ = () => { g.group.updateMatrixWorld(true); const sp = g.bones.spine2.getWorldPosition(new V3()); const ring = S.loftRing(g.spec.prims[0], g.spec.Y.chest || g.spec.Y.bust); return sp.z - ring[2]; };
  const target = g.bones.pelvis.getWorldPosition(new V3()).z - f - (S.loftRing(g.spec.prims[0], g.spec.Y.belly)[2]) - 0.008;   // the chair's back, where the lap scene's chair puts it
  // The spine stays as it is: the hips tip back (the pelvis turned about the hip joints) until the back meets the chair's, the thighs turned forward by the same
  // amount so they stay level on the seat, and the shins and feet brought back to the floor.
  const orig = scn.giverQ; let legs = null;
  const edit = who => Object.assign({}, ...(Poses.astride || []).filter(e => e.who === who).map(e => Object.fromEntries(Object.entries(e.bones).filter(([b]) => g.bones[b]).map(([b, v]) => [b, S.degQ(v)]))));
  const gEdit = edit('giver'), sEdit = edit('subject');   // (the same at every beat)
  const apply = () => { g.target = scn.giverQ(scn.beat); for (const b of BONES) { g.pose[b] = g.target[b].clone(); g.bones[b].quaternion.copy(g.pose[b]); } g.group.updateMatrixWorld(true); };
  const setTilt = deg => {
    scn.giverQ = beat => {
      const b = orig(beat), q = S.degQ([-deg, 0, 0]), qi = S.degQ([deg, 0, 0]);
      const out = { ...b, pelvis: b.pelvis.clone().multiply(q), thighL: b.thighL.clone().multiply(qi), thighR: b.thighR.clone().multiply(qi) };
      return { ...out, ...(legs || {}), ...gEdit };
    };
    scn.giverQ.edited = true; apply();
  };
  let tilt = 0;
  for (tilt = 0; tilt < 45; tilt += 1) { setTilt(tilt); if (spineBackZ() <= target + 0.012) break; }
  for (const side of ['L', 'R']) {
    S.twoBoneTo(g, ['thigh' + side, 'shin' + side, 'foot' + side], feet0[side], new V3(0, 1, 0.5));
    const fo = g.bones['foot' + side]; fo.quaternion.copy(fo.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(g.group.quaternion)); g.group.updateMatrixWorld(true);
  }
  legs = {}; for (const side of ['L', 'R']) for (const n of ['thigh', 'shin', 'foot']) legs[n + side] = g.bones[n + side].quaternion.clone();
  apply();
  // the subject: upright, facing the player, on the thighs a little forward of the player's hips
  S.setPose(s, 'Relaxed', true); for (const b of BONES) { s.pose[b] = s.pose[b] || new T.Quaternion(); s.bones[b].quaternion.copy(s.pose[b]); }
  s.group.quaternion.setFromAxisAngle(Y, Math.PI); s.group.updateMatrixWorld(true);
  const gp = g.bones.pelvis.getWorldPosition(new V3()), gth = g.bones.thighL.getWorldPosition(new V3()), rTh = g.spec.m.thigh / 100 / (2 * Math.PI);
  const sitY = gth.y + rTh + 0.07 * ks;   // pelvis joint above the top of the thighs
  const pelLocal = new V3(...s.spec.J.pelvis).applyQuaternion(s.group.quaternion);
  s.group.position.copy(new V3(gp.x, sitY, gp.z + 0.19 * kg)).sub(pelLocal); s.group.updateMatrixWorld(true);
  s.bones.spine1.quaternion.copy(S.degQ([8, 0, 0])); s.bones.spine2.quaternion.copy(S.degQ([6, 0, 0])); s.bones.neck.quaternion.copy(S.degQ([-10, 0, 0]));
  s.group.updateMatrixWorld(true);
  // legs: a thigh out to each side of the chair, the feet flat on the floor beside it
  for (const side of ['L', 'R']) {
    const x = side === 'L' ? -1 : 1, hip = s.bones['thigh' + side].getWorldPosition(new V3());
    const ankle = new V3(gp.x + x * 0.36 * ks, s.spec.J.footL[1], gp.z - 0.02 * kg);
    S.twoBoneTo(s, ['thigh' + side, 'shin' + side, 'foot' + side], ankle, new V3(x * 0.8, 0.3, -0.5));
    const fo = s.bones['foot' + side];
    fo.quaternion.copy(fo.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(s.group.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(Y, x * -0.35))));
    s.group.updateMatrixWorld(true);
    void hip;
  }
  for (const [b, q] of Object.entries(sEdit)) if (s.bones[b]) s.bones[b].quaternion.copy(q);   // (js/poses.js edits)
  s.group.updateMatrixWorld(true);
  // the pose as it now stands is the subject's base; they take nothing from a smack here
  const base = {}; for (const b of BONES) base[b] = s.bones[b].quaternion.clone();
  scn.baseQ = base; scn.reactQ = { L: base, R: base, B: base }; scn.buckQ = scn.reactQ;
  s.target = base; s.pose = {}; for (const b of BONES) s.pose[b] = base[b].clone();
  scn.noMarks = true;
  holdAstrideHands(g, s);
  return { astride: true, g };
}

// ── Hips (editor-only base position) ────────────────────────────
// The subject lies along a table, chest on the boards and fingers curled over its far edge; the disciplinarian stands square behind,
// facing the same way, hands pinned to the subject's hips.
// Where a palm goes on the subject's hip: the outermost skin on that side of the pelvis (from the posed mesh), the palm a hair off it along the surface normal.
// Recomputed only when the pelvis has moved (a reaction), as it walks every skin point nearby.
const hipCache = new WeakMap();
function hipTarget(s, side) {
  const pel = s.bones.pelvis.getWorldPosition(new T.Vector3()), k = s.spec.H / 1.7, out = side === 'L' ? -1 : 1;
  const key = s.bones.pelvis.matrixWorld.elements.map(v => Math.round(v * 500)).join(',') + side, hit = hipCache.get(s);
  if (hit && hit[side] && hit[side].key === key) return hit[side].val;
  const centre = new T.Vector3(pel.x + 0.04 * k, pel.y + 0.09 * k, pel.z + out * 0.1 * k), pts = S.posedSkinNear(s, centre, 0.16 * k);
  let best = null, bz = -Infinity;
  for (let i = 0; i < pts.length; i += 6) {
    if (Math.abs(pts[i] - (pel.x + 0.04 * k)) > 0.06 * k || pts[i + 1] < pel.y + 0.04 * k || pts[i + 1] > pel.y + 0.14 * k) continue;   // (the upper hip, toward the belly)
    const z = out * pts[i + 2]; if (z > bz) { bz = z; best = i; }
  }
  let at, n;
  if (best === null) { at = new T.Vector3(pel.x + 0.04 * k, pel.y + 0.09 * k, pel.z + out * 0.16 * k); n = new T.Vector3(0, 0, out); }
  else { n = new T.Vector3(pts[best + 3], pts[best + 4], pts[best + 5]).normalize(); if (n.z * out < 0.2) n.set(0, 0, out); at = new T.Vector3(pts[best], pts[best + 1], pts[best + 2]).addScaledVector(n, 0.012 * k); }
  const val = { at, n }; const rec = hit || {}; rec[side] = { key, val }; hipCache.set(s, rec);
  return val;
}
function holdHipHands(g, s) {
  g.group.updateMatrixWorld(true);
  for (const side of ['L', 'R']) {
    const { at, n } = hipTarget(s, side), sh = g.bones['upperArm' + side].getWorldPosition(new T.Vector3());
    const fingers = new V3(1, -0.45, 0); fingers.addScaledVector(n, -fingers.dot(n)).normalize();   // along the skin, forward and down, never into it
    S.armIK(g, side, at, sh.clone().add(new V3(-0.1, -0.1, n.z * 0.5)), n, fingers);
  }
}
// ── Pinned feet: both bodies' feet held where they are (position and angle) while everything above them moves ──
function footMarks(ch, hands) {
  ch.group.updateMatrixWorld(true); const m = {};
  for (const side of ['L', 'R']) { const f = ch.bones['foot' + side]; m[side] = { pos: f.getWorldPosition(new T.Vector3()), quat: f.getWorldQuaternion(new T.Quaternion()) }; }
  if (hands) { m.hands = {}; for (const side of ['L', 'R']) { const h = ch.bones['hand' + side]; m.hands[side] = { pos: h.getWorldPosition(new T.Vector3()), quat: h.getWorldQuaternion(new T.Quaternion()) }; } }
  return m;
}
// Hands held where they are, too: the arms are bent to the marks, the hands turned back to their angle.
function pinHandsTo(ch, marks) {
  for (const side of ['L', 'R']) {
    ch.group.updateMatrixWorld(true);
    S.twoBoneTo(ch, ['upperArm' + side, 'forearm' + side, 'hand' + side], marks.hands[side].pos);
    const h = ch.bones['hand' + side]; h.quaternion.copy(h.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(marks.hands[side].quat)); h.updateMatrixWorld(true);
  }
}
// The feet are held where they are, and the hips follow the legs: the whole body is carried by however far the posed feet are from their marks (so the pose's own hip and
// knee angles decide where the hips sit in space), then what is left over is taken up by bending each leg.
function pinFeetTo(ch, marks, fixed) {
  ch.group.updateMatrixWorld(true);
  const off = new T.Vector3();
  for (const side of ['L', 'R']) off.add(marks[side].pos.clone().sub(ch.bones['foot' + side].getWorldPosition(new T.Vector3())));
  off.multiplyScalar(0.5); if (off.length() > 0.5) off.setLength(0.5);
  if (!fixed) { ch.group.position.add(off); ch.group.updateMatrixWorld(true); }   // (fixed: the bodies stay where they are in the room, and only the limbs reach)
  for (const side of ['L', 'R']) {
    S.twoBoneTo(ch, ['thigh' + side, 'shin' + side, 'foot' + side], marks[side].pos);
    const f = ch.bones['foot' + side];   // (set, not turned: rotateBoneWorld applies a change on top of the current angle)
    f.quaternion.copy(f.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(marks[side].quat)); f.updateMatrixWorld(true);
  }
}
function setupHips(parent, scn, g, s) {
  s.group.updateMatrixWorld(true);
  // the table: its top meets the underside of the chest, the near edge at the waist, the far edge just past where the palms land
  // (the lowest skinned point of the chest, between the waist and the neck and clear of the arms)
  const sp = s.bones.spine1.getWorldPosition(new T.Vector3()), nk = s.bones.neck.getWorldPosition(new T.Vector3());
  const pos = s.mesh.geometry.attributes.position, v = new T.Vector3(); let low = Infinity;
  s.mesh.skeleton.update();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); s.mesh.boneTransform(i, v); v.applyMatrix4(s.mesh.matrixWorld);
    if (v.x > sp.x + 0.02 && v.x < nk.x && Math.abs(v.z - nk.z) < 0.14 * s.spec.H / 1.7 && v.y < low) low = v.y;
  }
  const top = isFinite(low) ? low - 0.001 : scn.caseTop;
  scn.caseTop = top;
  const pL = S.casePalm(s, 'L', top), pR = S.casePalm(s, 'R', top);
  const old = scn.bench; if (old) { parent.remove(old); Room.disposeGroup(old); }
  const made = Room.buildTable(top, sp.x, Math.max(pL.x, pR.x) + 0.045, 0.9); made.userData.obb = true;
  made.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scn.bench = made; parent.add(made);
  // the disciplinarian: square behind the subject (facing +X, as they do), hips at the same height as now, close enough for the hands
  const pel = s.bones.pelvis.getWorldPosition(new T.Vector3()), gp = g.bones.pelvis.getWorldPosition(new T.Vector3());
  g.group.quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2);
  g.group.updateMatrixWorld(true);
  const now = g.bones.pelvis.getWorldPosition(new T.Vector3());
  g.group.position.add(new V3(pel.x - 0.3 * (g.spec.H / 1.7) - now.x, 0, pel.z - now.z));
  g.group.updateMatrixWorld(true);
  return { hips: true, g };
}

// ── Setting up a discipline scene (the game and the editor both call these, so what is seen in one is what is in the other) ──
// The subject's skirt in a discipline scene: the gathered back is driven by the body, the front and sides are cloth (see Starlight.setSkirtHybrid).
function prepareSubject(s) { if (s.skirt) S.setSkirtHybrid(s, true); }
// Furniture in place, the seat under a seated disciplinarian, and the pose edits from js/poses.js. Returns `plant` (where the hands go on the chair).
function furnishDiscipline(parent, scn, g, s, position, seatTop) {
  const plant = furnishScene(parent, scn, s, position, seatTop, g);
  g.pressFloor = null;
  if ((position === 'lap' || position === 'astride') && scn.seatTop != null) {
    // The seat flattens the seated disciplinarian's glutes (the contact shader, as a palm flattens skin) so that the skin lies flush on it and never
    // passes through. With a skirt on, the flat is a skirt's thickness above the seat, so the cloth lies between skin and seat; the cloth sees the
    // same flat (see skinPoints), not the glutes the shader has pressed away.
    const up = 0.009 * g.spec.H / 1.7;   // the pair sit a little higher: the thighs rest on the seat and not in it
    for (const c of [g, s]) { c.group.position.y += up; c.group.updateMatrixWorld(true); }

    const flat = scn.seatTop + (g.skirt ? 0.016 : 0.0015), pel = g.bones.pelvis.getWorldPosition(new T.Vector3());
    g.pressFloor = flat;
    S.setPress(g, new T.Vector3(pel.x, flat, pel.z), new T.Vector3(0, -1, 0), 0.24 * g.spec.H / 1.7, 1, '', null, 0, 0.09);
  }
  applyPoseOverrides(scn, position);
  if (position === 'hips') {   // the pose edits first, so the table is laid against the chest as posed
    s.target = scn.baseQ; for (const b of Object.keys(scn.baseQ)) if (s.bones[b]) { s.pose[b] = scn.baseQ[b].clone(); s.bones[b].quaternion.copy(scn.baseQ[b]); }
    return setupHips(parent, scn, g, s);
  }
  if (position === 'astride') return setupAstride(parent, scn, g, s);
  return plant;
}

// ── Standard camera angles ──────────────────────────────────────
// Where each standard view puts the camera for a session's two bodies ({ subject, giver }, posed). The stage takes the camera there when
// a button is pressed; the editor does the same. (Frame: which way the subject faces, how upright they are, where the glutes are.)
const inRoom = (v, m = 0.3) => { const lim = Room.HALF - m; v.x = clamp(v.x, -lim, lim); v.z = clamp(v.z, -lim, lim); v.y = clamp(v.y, 0.08, Room.HEIGHT - 0.2); return v; };
function focusOf(ses) {
  const s = ses.subject, P = s.bones.pelvis.getWorldPosition(new V3()), H = s.bones.head.getWorldPosition(new V3());
  const lean = new V3(H.x - P.x, 0, H.z - P.z), leanLen = lean.length();
  let fwd = lean.normalize();
  if (leanLen < 0.25) { fwd = new V3(0, 0, 1).applyQuaternion(s.bones.pelvis.getWorldQuaternion(new T.Quaternion())); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0); fwd.normalize(); }
  const up = 1 - clamp(leanLen / 0.5, 0, 1);   // 1 standing, 0 bent over
  const C = P.clone().addScaledVector(fwd, -0.07); C.y -= 0.03 + 0.03 * up;   // the contact sites: behind and a little below the hip joint
  return { P, H, fwd, up, C };
}
function cameraPose(mode, ses) {
  ses.subject.group.updateMatrixWorld(true); ses.giver.group.updateMatrixWorld(true);
  const f = focusOf(ses), g = ses.giver;
  if (mode === 'behind') {   // square behind the subject, a little above the contact sites, far enough back to take in both cheeks and the thighs
    const pos = f.C.clone().addScaledVector(f.fwd, -(1.6 + 0.6 * f.up)); pos.y = f.C.y + 0.4 + 0.1 * f.up;
    return { pos: inRoom(pos, 0.2), tgt: f.C.clone(), fov: 40 };
  }
  if (mode === 'shoulder') {   // the player's own view from just over the right shoulder (the striking arm's), looking down at the contact sites
    const GS = g.bones.upperArmR.getWorldPosition(new V3()), GH = g.bones.head.getWorldPosition(new V3());
    const out = new V3(GS.x - GH.x, 0, GS.z - GH.z); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
    const toward = new V3(f.C.x - GH.x, 0, f.C.z - GH.z); if (toward.lengthSq() < 1e-4) toward.set(1, 0, 0); toward.normalize();
    const pos = GH.clone().addScaledVector(out, 0.14).addScaledVector(toward, 0.2); pos.y = GH.y - 0.03;
    return { pos: inRoom(pos, 0.1), tgt: f.C.clone(), fov: 62 };
  }
  if (mode === 'floor') {   // the face, from in front of it, at the height that suits the pose
    const pos = f.H.clone().addScaledVector(f.fwd, 1.7); pos.y = clamp(f.H.y - 0.45, 0.14, 1.2);
    return { pos: inRoom(pos), tgt: f.H.clone().add(new V3(0, 0.02, 0)), fov: 50 };
  }
  // overview: a three-quarter view from behind, on the side away from the player, so the glutes, the player and the implement are in view
  const GH = g.bones.head.getWorldPosition(new V3());
  const side = new V3(-f.fwd.z, 0, f.fwd.x); if (side.dot(new V3(GH.x - f.C.x, 0, GH.z - f.C.z)) > 0) side.negate();
  const dir = f.fwd.clone().multiplyScalar(-Math.cos(0.6)).addScaledVector(side, Math.sin(0.6));
  const pos = f.C.clone().addScaledVector(dir, 2.5 + 0.5 * f.up); pos.y = f.C.y + 0.6 + 0.5 * f.up;
  return { pos: inRoom(pos, 0.25), tgt: f.C.clone().addScaledVector(f.fwd, 0.15).add(new V3(0, 0.1 + 0.3 * f.up, 0)), fov: 35 };
}

// ── A session: two bodies in the room, set up, run and torn down in one place. The game's stage runs one (see createStage.begin) and so does the editor, so
// what is seen in the editor is what is in the game. opts: { giver, subject (specs), subjectId, position, implement, layers, pain }.
// env: { marks (kept through the day), build(spec, role) (how to make a character), prepare(char, role), afterMake(giver, subject), onDispose(api) }.
function createSession(scene, opts, env = {}) {
  const marks = env.marks || {};
    const st = { smacks: 0, peak: 0, tooHarsh: false, mode: 'idle', toRun: 0, since: 0, paceIdx: 2, strengthIdx: 3, runIdx: 2, ended: false,
      layers: { bottoms: false, briefs: false, ...(opts.layers || {}), skirt: (opts.layers && opts.layers.skirt) || 'up' }   /* a skirt is always hitched up for a correction (the editor may ask for another) */, implement: opts.implement || 'hand', position: opts.position || 'case' };
    let g = null, s = null, scn = null, furniture = null, plant = null, pins = null, lookAhead = null, fixedPins = false;

    const derive = () => { const pace = PACE[st.paceIdx], m = STRENGTH[st.strengthIdx]; return { speed: pace, strength: Math.min(1, 0.66 * m), hold: 0.3 / pace, dwell: 0.6 / pace, face: clamp(0.1 + 0.45 * m * pace, 0.1, 1) }; };

    function teardown() {
      if (!scn) return;
      marks[opts.subjectId] = { marks: s.marks, stripes: s.stripes };
      scn.dispose();
      for (const c of [g, s]) S.disposeCharacter(c);
      g = s = scn = furniture = plant = null;
    }
    function applyLayers(settle) {
      const L = st.layers;
      S.setLowered(s, 'bottom', !!L.bottoms);
      S.setLowered(s, 'briefs', !!L.bottoms && !!L.briefs);
      if (!s.skirt) return;
      const mode = skirtMode(L.skirt), was = s.skirt.off ? 'off' : s.skirt.gathered ? 'up' : 'down';
      S.setSkirtOff(s, mode === 'off');
      if (mode !== 'off') S.setSkirtGathered(s, mode === 'up');
      if (settle && mode !== 'off' && mode !== was && !s.skirt.hybrid) settleSkirt();   // (a hybrid skirt is cloth held at the waist and carried by the body: bottoms or briefs coming down or up never restart it)
    }
    // The skirt is put on over the pose she is already in: it is dropped and draped (see Starlight.settleSkirt).
    function settleSkirt() { scn.update(0.016); scn.update(0.016); S.settleSkirt(s, [g], [scn.bench]); }
    // Across the lap, where the subject looks: down toward the chair when they are less composed (the stat), straight ahead from 4 up; a smack that lands lifts
    // anyone's head to look straight ahead for a few seconds. The neck and head extend about their own x; the hands stay on the floor, fingers down.
    function lapLook(dt) {
      st.lookT = Math.max(0, (st.lookT || 0) - dt);
      const com = opts.composure == null ? 2.5 : opts.composure, own = clamp((com - 1) / 3, 0, 1), want = st.lookT > 0 ? 1 : own;
      st.look += (want - st.look) * (1 - Math.exp(-dt * 3.5));
      const e = lookAhead.e * st.look * Math.PI / 180 * lookAhead.sign;
      for (const [b, w] of [['neck', 0.4], ['head', 0.6]]) s.bones[b].quaternion.multiply(new T.Quaternion().setFromAxisAngle(new V3(1, 0, 0), e * w));
      s.group.updateMatrixWorld(true);
    }
    // How much the legs kick at each smack. The wilful hold out (a centimetre or two, lifted only by the force of the impact), the compliant and the uncomposed kick; the more
    // worked up they are (the severity / composure scale in the scene), the more it gives way: a low composure stat kicks freely at the high end, a wilful one kicks less hard than
    // that but more than they did at the start. Frequency follows the same figure: a stoic one kicks only now and then.
    function kickLegs() {
      const S_ = opts.stats; if (!S_ || !scn) { if (scn) scn.legK = 1; return; }
      const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      const wil = clamp((S_.wil - 1) / 5, 0, 1), com = clamp((S_.com - 1) / 4, 0, 1), d = scn.pain ? scn.pain.distress() : 0;
      const base = 1 - 0.72 * wil - 0.2 * com;                        // at ease: 0.08 (most wilful and composed) … 1 (not wilful, uncomposed)
      const ceiling = 1 - 0.4 * wil * (0.5 + 0.5 * com);              // worked up: the wilful never quite let go, unless they are also uncomposed
      const gain = Math.max(0.06, base + (ceiling - base) * ss(0.25, 0.9, d));
      const freq = clamp(0.3 + 1.0 * gain, 0, 1);
      // (1 is the engine's own kick; a free kick is well past it: knees well up, the heels high)
      scn.legK = Math.random() < freq ? Math.min(1.8, gain * 1.8 * (0.85 + 0.3 * Math.random())) : gain * 0.3;
    }
    function make(cfg = {}) {
      const position = cfg.position || st.position;
      const oldP = scn && scn.pain;
      teardown();
      st.position = position;
      const mk = (spec, role) => env.build ? env.build(spec, role) : S.buildCharacter(S.clone(spec), { voxel: 0.011, key: spec.name });
      const bent = position !== 'head' && position !== 'astride';   // (bent over or face down, the male front only shows as an artefact between the legs: left out there)
      g = mk(opts.giver, 'giver'); s = mk(bent && typeof opts.subject === 'object' ? (opts.subject.m ? { ...opts.subject, m: { ...opts.subject.m, endowment: 0 } } : { ...opts.subject, endowment: 0 }) : opts.subject, 'subject');
      for (const c of [g, s]) { scene.add(c.group); scene.add(c.helper); c.helper.visible = false; }
      const sv = marks[opts.subjectId];
      if (sv) { s.marks = sv.marks; s.stripes = sv.stripes; S.copyMarks(s, s); }
      if (env.prepare) { env.prepare(g, 'giver'); env.prepare(s, 'subject'); }
      const seatTop = position === 'chair' ? chairSeatTop(g) : 0.45;
      const D = derive();
      scn = S.createDisciplineScene(scene, g, s, { lower: !!st.layers.bottoms, position: ENGINE_POSITION[position], pain: opts.pain, faces: true, severity: D.face });
      prepareSubject(s);
      applyLayers();
      let impl = cfg.implement || st.implement;
      if (position === 'spread' && !S.IMPLEMENTS[impl].dual) impl = 'paddle';
      st.implement = impl; scn.setImplement(impl); scn.setBeat('relaxed');
      scn.timing = { ...scn.timing, speed: D.speed };
      scn.noMarks = position === 'hips';   // the Hips base position takes no colour from a smack, and gives none back
      furniture = null; plant = furnishDiscipline(scene, scn, g, s, position, seatTop);   // furniture, the seat, the pose edits (shared with the editor)
      if (s.skirt && skirtMode(st.layers.skirt) !== 'off') settleSkirt();
      if (g.skirt) { scn.update(0.016); S.settleSkirt(g, [s], [scn.bench], 1.5, false); }   // the player's own skirt (a dress) drapes over the seat or the stance
      if (oldP && scn.pain) {
        for (const k of ['sting', 'ache', 'hits', 'last', 'dwell', 'atEdge', 'atLimit', 'tooHarsh', 'peak']) scn.pain[k] = oldP[k];
        if (!st.frozen) scn.pain.update(cfg.elapsed || 0, false);   // the time it took
      }
      if (scn.pain) { const real = scn.pain.update; scn.pain.update = (dt, onSkin) => { if (!st.frozen) real(dt, onSkin); }; }   // (composure held still while frozen)
      scn.onImpact = (side, strength) => { st.lookT = 3; kickLegs(); st.smacks++; Sound.clap(st.implement, strength); if (api.onImpact) api.onImpact(api); };
      api.scn = scn; api.pain = scn.pain; api.subject = s; api.giver = g;
      lookAhead = position === 'lap' ? lapLookAhead(s) : null; st.look = 0; scn.legK = opts.stats ? 0.1 : 1;
      pins = null; fixedPins = position === 'astride'; if (st.pinFeet || position === 'hips' || fixedPins) { st.pinFeet = true; pins = { g: footMarks(g, fixedPins), s: footMarks(s, fixedPins) }; }
      if (env.afterMake) env.afterMake(g, s);
    }

    const api = {
      st, scn: null, pain: null, subject: null, giver: null, frozen: false,
      get plant() { return plant; },
      get position() { return st.position; },
      get implement() { return st.implement; },
      get busy() { return scn.busy(); },
      get layers() { return st.layers; },
      layerAvailable() { const w = s.spec.m.wardrobe || {}; return { bottoms: !!w.bottom, briefs: !!w.briefs }; },
      setLayer(name, on) {
        st.layers[name] = on; if (name === 'bottoms' && !on) st.layers.briefs = false;
        applyLayers(true);
      },
      // A live change of implement (to or from the hand). Anything else is fetched: see rebuild.
      setImplement(n) { if (st.position === 'spread' && !S.IMPLEMENTS[n].dual) return false; st.implement = n; scn.setImplement(n); scn.setBeat('relaxed'); return true; },
      // Builds the room and bodies again (a new position, or a new implement that has been fetched), keeping the pain and the marks.
      rebuild(cfg) { make(cfg); },
      // Composure held still (nothing fades, nothing builds) from here until the first smack or run begins again.
      freeze() { st.frozen = true; },
      // Both bodies' feet held where they stand (position and angle) however the rest of the pose moves; the hips position always does.
      pinFeet(on) { st.pinFeet = !!on; pins = on ? { g: footMarks(g, fixedPins), s: footMarks(s, fixedPins) } : null; },
      get pinned() { return !!pins; },
      applyPins() { if (pins) { pinFeetTo(g, pins.g, fixedPins); pinFeetTo(s, pins.s, fixedPins);  if (plant && plant.hips) holdHipHands(g, s); } },
      get lookAhead() { return lookAhead; },
      get frozenComposure() { return !!st.frozen; },
      setBeat(b) { scn.setBeat(b); },
      get pace() { return PACE[st.paceIdx]; }, get strengthMult() { return STRENGTH[st.strengthIdx]; }, get runLength() { return RUN[st.runIdx]; },
      stepPace(d) { st.paceIdx = clamp(st.paceIdx + d, 0, PACE.length - 1); const D = derive(); scn.timing = { ...scn.timing, speed: D.speed }; scn.severity = D.face; },
      stepStrength(d) { st.strengthIdx = clamp(st.strengthIdx + d, 0, STRENGTH.length - 1); scn.severity = derive().face; },
      stepRun(d) { st.runIdx = clamp(st.runIdx + d, 0, RUN.length - 1); },
      canStrike() { return !st.ended && !scn.busy() && !(scn.pain && scn.pain.tooHarsh); },
      // One whole smack: lift, hold, strike, and the hand stays on the skin until the next.
      smack() { if (!api.canStrike()) return false; st.frozen = false; st.mode = 'single'; Sound.init(); const D = derive(); scn.cycle(D.strength, undefined, undefined, D.hold); st.since = 0; return true; },
      run(n) { if (st.ended) return; st.frozen = false; Sound.init(); st.mode = 'run'; st.toRun = n == null ? RUN[st.runIdx] : n; st.since = derive().dwell; },
      stop() { st.mode = 'idle'; st.toRun = 0; },
      get running() { return st.mode === 'run'; },
      distress() { return scn.pain ? scn.pain.distress() : 0; },
      band() { return scn.pain ? scn.pain.band() : ''; },
      receptivity() { return scn.pain ? scn.pain.receptivity() : 0; },
      // The end of the correction: nothing more is struck; what was done is returned for the rules to score.
      finish() {
        st.ended = true; st.mode = 'idle'; scn.lower(0.8);
        marks[opts.subjectId] = { marks: s.marks, stripes: s.stripes };
        const P = scn.pain;
        return { peak: Math.max(st.peak, P ? P.distress() : 0), tooHarsh: !!(P && P.tooHarsh), smacks: st.smacks, implement: st.implement };
      },
      onChange: null, onImpact: null,
      tick(dt, t) {
        if (!scn) return;
        const P = scn.pain;
        if (st.mode === 'run' && !st.ended) {
          st.since += dt;
          const D = derive(), dwell = st.implement === 'rod' ? Math.min(D.dwell, 0.1) : D.dwell;   // (a switch comes straight off the skin whatever the pace)
          if (!scn.busy() && st.since > dwell) {
            if (st.toRun <= 0 || (P && P.tooHarsh)) st.mode = 'idle';
            else { scn.cycle(D.strength, undefined, undefined, D.hold); st.toRun--; st.since = 0; }
          }
        }
        // After a run or a single smack, once the hand has rested on the skin a moment, the giver relaxes again.
        if (!st.ended && st.mode !== 'run' && !scn.busy() && scn.swing > 1.5) {
          st.rest = (st.rest || 0) + dt;
          const snap = st.implement === 'rod';   // a switch's sting is the sharp stroke and the pull back: it is never held on the skin, however firm
          if (st.rest > (snap ? 0 : 0.8)) { st.rest = 0; st.mode = 'idle'; scn.lower(snap ? 0.28 : 0.9); }
        } else st.rest = 0;
        if (P && P.tooHarsh && !st.ended) { st.mode = 'idle'; st.tooHarsh = true; }
        const on = [g, s];
        if (!api.frozen) {   // (frozen: the editor's pose editor holds the scene still and moves it by hand)
          for (const ch of on) S.animateCharacter(ch, dt, t);
          scn.clothLift = s.skirt && !s.skirt.off && !s.skirt.gathered ? S.SKIRT_THICK * 0.7 : 0;   // the palm lands on the skirt, not through it
          scn.update(dt);
          if (lookAhead) lapLook(dt);
          if (plant) holdChairHands(s, plant);   // hands on the chair
        }
        api.applyPins();
        if (st.position !== 'hips') for (const ch of on) S.fadeMarks(ch, dt);
        for (const ch of on) { ch.group.updateMatrixWorld(true); S.bustSpring(ch, dt); }
        for (const ch of on) S.bustContact(ch, on);
        S.updateContacts(on);
        const colliders = on.flatMap(S.bodyColliders);
        for (const ch of on) S.hairStep(ch, dt, colliders);
        for (const ch of on) S.faceStep(ch, dt);
        if (scn.tool && scn.tool.grp) scn.tool.grp.userData.obb = true;
        for (const ch of on) S.skirtStep(ch, dt, on, [scn.bench, scn.tool && scn.tool.grp]);
        for (const ch of on) S.bunchStep(ch);
        if (P) st.peak = Math.max(st.peak, P.distress());
        if (api.onChange) api.onChange(api);
      },
      dispose() { teardown(); if (env.onDispose) env.onDispose(api); },
    };
    make({});
    return api;
}


// ── Afterwards: short staged scenes (see ui.js playAftercare) ─────
// Two bodies in the room, set for one of the aftercare scenes, with the clothing the correction ended on. kind: 'corner' (subject alone in a corner, hands on head),
// 'lines' (subject, fully dressed, writing at the table), 'held' (the two embracing, mid-room), 'warm' (subject standing, the player seated, eye to eye).
// Returns a session-like object (tick, dispose) plus `view`, where the camera goes.
function createTableau(scene, kind, opts, env = {}) {
  const marks = env.marks || {}, L = opts.layers || {}, Y = new V3(0, 1, 0);
  const mk = spec => S.buildCharacter(S.clone(spec), { voxel: 0.011, key: spec.name });
  const g = mk(opts.giver), s = mk(opts.subject), both = [g, s], extras = [];
  for (const c of both) { scene.add(c.group); scene.add(c.helper); c.helper.visible = false; }
  const sv = marks[opts.subjectId]; if (sv) { s.marks = sv.marks; s.stripes = sv.stripes; S.copyMarks(s, s); }
  prepareSubject(s);
  const dressed = kind === 'lines';
  S.setLowered(s, 'bottom', !dressed && !!L.bottoms); S.setLowered(s, 'briefs', !dressed && !!L.bottoms && !!L.briefs);
  if (s.skirt) { const m = dressed ? 'down' : skirtMode(L.skirt); S.setSkirtOff(s, m === 'off'); if (m !== 'off') S.setSkirtGathered(s, m === 'up'); }
  const yawQ = a => new T.Quaternion().setFromAxisAngle(Y, a), face = (dx, dz) => Math.atan2(dx, dz);
  const place = (ch, a, x, z) => { ch.group.quaternion.copy(yawQ(a)); ch.group.position.set(x, 0, z); ch.group.updateMatrixWorld(true); };
  const standing = (ch, a, x, z) => { S.setPose(ch, 'Relaxed', true); for (const b of S.BONES) ch.bones[b].quaternion.copy(ch.pose[b]); S.standAt(ch, yawQ(a), new V3(x, ch.spec.J.pelvis[1], z)); };
  // a chair for a seated body (built to its size as the lap's is), set in the body's own frame and moved with it
  const seated = (ch, a, x, z) => {
    const probe = S.seatGiver(ch), top = probe.hipY - probe.rThigh * 0.99; probe.bench.parent && probe.bench.parent.remove(probe.bench); Room.disposeGroup(probe.bench);
    ch.group.updateMatrixWorld(true);
    const pel = ch.bones.pelvis.getWorldPosition(new V3()), knee = ch.bones.shinL.getWorldPosition(new V3()), ring = S.loftRing(ch.spec.prims[0], ch.spec.Y.belly), lw = 0.042;
    const backZ = pel.z - ring[2] - 0.008, D = (knee.z + 0.01) - backZ + (0.03 + lw / 2), W = Math.max(0.44, 2 * (Math.abs(ch.bones.thighL.getWorldPosition(new V3()).x - pel.x) + 0.12));
    const chair = Room.buildChair(top, W, D); chair.position.set(pel.x, 0, backZ - 0.03 - lw / 2 + D / 2);
    const furn = new T.Group(); furn.add(chair); furn.position.set(x, 0, z); furn.rotation.y = a; scene.add(furn); extras.push(furn);
    furn.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ch.group.quaternion.copy(yawQ(a)); ch.group.position.set(x, ch.group.position.y, z);   // (it was built at the origin facing +Z: turned about there, then moved)
    ch.group.updateMatrixWorld(true);
    return { furn, top, pel };
  };
  const at0 = (c, n) => c.bones[n].getWorldPosition(new V3());
  let view = { pos: new V3(0, 1.4, 3), tgt: new V3(0, 1, 0), fov: 38 }, hold = () => {}, gaze = () => {};
  // Where the eyes go (the engine's own: a gaze offset in the head's frame, read by faceStep), once the heads have turned.
  const eyesAt = (ch, point, w = 0.9) => {
    const hq = ch.bones.head.getWorldQuaternion(new T.Quaternion()).invert();
    const v = point.clone().sub(ch.bones.head.getWorldPosition(new V3())).applyQuaternion(hq).normalize();
    ch.gazeFx = { x: clamp(v.x * S.FACE.EYE_GAIN, -1, 1), y: clamp(v.y * S.FACE.EYE_GAIN, -1, 1), w };
  };
  const edits = Poses[kind] || [];
  // Pose edits (js/poses.js): the base pose, set on top of the scene's own and set again after its arms and heads have been placed, so an edited bone is the edited bone.
  // A pasted arm pose with big twists (a shoulder turned 150° about its own axis) skins badly: the sleeve and the skin wring up at the shoulder. The arm is solved again from the
  // bind pose to the same elbow and wrist, with the hand's own turn kept, which is the same arm with the least twist the skin can take.
  const cleanArms = () => {
    for (const [who, c] of [['giver', g], ['subject', s]]) {
      if (!c.group.visible) continue;
      const armEdited = edits.some(e => e.who === who && (e.beat === 'base' || (who === 'giver' && e.beat === 'relaxed')) && Object.keys(e.bones).some(b => /^(upperArm|forearm)/.test(b)));
      if (!armEdited) continue;
      c.group.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        const up = c.bones['upperArm' + side], fo = c.bones['forearm' + side], ha = c.bones['hand' + side];
        const A = up.getWorldPosition(new V3()), B = fo.getWorldPosition(new V3()), C = ha.getWorldPosition(new V3()), Q = ha.getWorldQuaternion(new T.Quaternion());
        up.quaternion.identity(); fo.quaternion.identity(); c.group.updateMatrixWorld(true);
        S.twoBoneTo(c, ['upperArm' + side, 'forearm' + side, 'hand' + side], C, B.clone().sub(A));
        ha.quaternion.copy(ha.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(Q)); c.group.updateMatrixWorld(true);
      }
    }
  };
  const applyEdits = () => { for (const e of edits) { const c = e.who === 'giver' ? g : s; if (!(e.beat === 'base' || (e.who === 'giver' && e.beat === 'relaxed')) || !c.group.visible) continue; for (const [b, v] of Object.entries(e.bones)) if (c.bones[b]) c.bones[b].quaternion.copy(S.degQ(v)); } };
  // Two standing bodies facing each other, the subject's feet held back and the body tipped `lean` toward the player, brought together until the torsos just meet: the same
  // closeness for any pair of sizes and any pose (the edits are in place while it measures).
  const placeClose = (lean, latOverride) => {   // the subject stands a little to the player's right (+Z): half the spacing of the feet, so the two pairs of feet pass and the head can go on the shoulder
    const kg = g.spec.H / 1.7, ks = s.spec.H / 1.7, avg = (kg + ks) / 2, Z = new V3(0, 0, 1);
    standing(g, Math.PI / 2, 0, 0); applyEdits();
    const lat = latOverride != null ? latOverride : (Math.abs(g.spec.J.thighL[0] - g.spec.J.thighR[0]) + Math.abs(s.spec.J.thighL[0] - s.spec.J.thighR[0])) / 4;
    const pivotY = 0;
    const placeS = x => {   // the subject faces the player (-X), the feet at x, the body tipped about them toward the player
      standing(s, -Math.PI / 2, x, lat); applyEdits();
      const feet = ['L', 'R'].map(sd => s.bones['foot' + sd].getWorldQuaternion(new T.Quaternion()));
      const pivot = new V3(x, pivotY, lat), q = new T.Quaternion().setFromAxisAngle(Z, lean);
      s.group.quaternion.premultiply(q); s.group.position.sub(pivot).applyQuaternion(q).add(pivot); s.group.updateMatrixWorld(true);
      ['L', 'R'].forEach((sd, i) => { const f = s.bones['foot' + sd]; f.quaternion.copy(f.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(feet[i])); });
      s.group.updateMatrixWorld(true);
    };
    // torso skin points of the subject, and the player's torso shapes: closer until they just meet
    const geo = s.mesh.geometry, si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array, pos = geo.attributes.position, chest = [];
    for (let v = 0; v < pos.count; v += 3) { let bw = -1, bb = 0; for (let m = 0; m < 4; m++) if (sw[4 * v + m] > bw) { bw = sw[4 * v + m]; bb = si[4 * v + m]; } if (['pelvis', 'spine1', 'spine2', 'bustL', 'bustR'].includes(S.BONES[bb])) chest.push(v); }
    const meet = () => {
      const all = S.posedProxies(g), nE = g.proxies.ells.length, keep = all.filter((P, i) => { const b = i < nE ? g.proxies.ells[i].bone : g.proxies.cones[i - nE].bone; return ['pelvis', 'spine1', 'spine2', 'bustL', 'bustR'].includes(b); });
      const vv = new V3(); let m = Infinity;
      for (const i of chest) { vv.fromBufferAttribute(pos, i); s.mesh.boneTransform(i, vv); vv.applyMatrix4(s.mesh.matrixWorld); const p = [vv.x, vv.y, vv.z]; for (const P of keep) m = Math.min(m, S.primDist(p, P)); }
      return m;
    };
    let x = 0.6 * avg; placeS(x);
    for (let it = 0; it < 90 && meet() > 0.004; it++) { x -= 0.008; placeS(x); }
    return { kg, ks, avg };
  };
  if (kind === 'corner') {
    g.group.visible = false; g.helper.visible = false;
    s.handsOnHead = true;
    if (opts.editor) {   // (in the editor the subject stands in the open, where the pose can be seen and reached)
      standing(s, 0, 0, 0); view = { pos: new V3(1.7, 1.4, 2.3), tgt: new V3(0, 1.0, 0), fov: 38 };
    } else {
      const c = -Room.HALF + 0.62; standing(s, face(-1, -1), c, c);
      view = { pos: new V3(c + 1.9, 1.45, c + 1.9), tgt: new V3(c - 0.1, 1.1, c - 0.1), fov: 40 };
    }
  } else if (kind === 'lines') {
    g.group.visible = false; g.helper.visible = false;
    const st = seated(s, 0, 0, -0.1);
    const table = Room.buildTable(0.74, -0.5, 0.5, 0.7); table.position.set(0, 0, 0.58); st.furn.add(table);
    table.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const paper = new T.Mesh(new T.PlaneGeometry(0.21, 0.297), new T.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.95 }));
    paper.rotation.x = -Math.PI / 2; paper.position.set(0.02, 0.742, 0.44); st.furn.add(paper);
    const pen = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.15, 6), new T.MeshStandardMaterial({ color: 0x20160e })); st.furn.add(pen);
    hold = (t) => {   // (the seated pose is the one seatGiver left: thighs level, shins down)
      s.group.updateMatrixWorld(true);
      // writing: the nib travels along a line of the page, flicks back to the start of the next and lifts a little between, with small strokes riding on the travel
      t = 1.1;   // (the aftercare scenes do not animate: the hand is simply writing)
      const per = 4.2, ln = Math.floor(t / per) % 5, u = (t % per) / per, travel = Math.min(1, u / 0.86), lift = u > 0.86 ? Math.sin((u - 0.86) / 0.14 * Math.PI) * 0.012 : 0;
      const nib = st.furn.localToWorld(new V3(-0.06 + 0.12 * (u > 0.86 ? 1 - (u - 0.86) / 0.14 : travel) + 0.006 * Math.sin(t * 11), 0.745 + lift, 0.52 - 0.016 * ln + 0.004 * Math.sin(t * 17)));
      const shR = s.bones.upperArmR.getWorldPosition(new V3()), shL = s.bones.upperArmL.getWorldPosition(new V3());
      const dir = new V3(0, 0, 1).applyAxisAngle(Y, a0());
      // the writing hand: the fingertips at the nib, the hand tilted up behind them toward the wrist, the palm turned in
      const back = new V3(shR.x - nib.x, 0, shR.z - nib.z).normalize(), palmT = nib.clone().addScaledVector(back, 0.055).add(new V3(0, 0.03, 0));
      S.armIK(s, 'R', palmT, shR.clone().add(new V3(0.3, -0.15, -0.25)), null, null, new V3(-1, -0.2, 0.3).normalize());
      S.armIK(s, 'L', st.furn.localToWorld(new V3(-0.1, 0.746, 0.40)), shL.clone().add(new V3(-0.3, -0.1, -0.3).applyAxisAngle(Y, a0())), new V3(0, 1, 0), dir);
      s.bones.neck.rotateX(0.55); s.bones.head.rotateX(0.35);   // head bent over the page
      // the pen is held: fingers and thumb closed on it, its tip on the nib, its body lying back along the hand toward the wrist
      s.bones.fingersR.quaternion.multiply(S.degQ([0, 0, 38])); s.bones.thumbR.quaternion.multiply(S.degQ([-20, 0, 0])); s.group.updateMatrixWorld(true);
      // (the tip is wherever the fingertips are, so the pen is in the hand by construction)
      const hp = s.bones.handR.getWorldPosition(new V3()), kn = s.bones.fingersR.getWorldPosition(new V3()), along = kn.clone().sub(hp).normalize();
      const tip = nib.clone(), axis = hp.clone().sub(tip).normalize();   // tip on the page, the shaft running up through the closed hand
      const q = new T.Quaternion().setFromUnitVectors(new V3(0, 1, 0), axis);
      pen.quaternion.copy(st.furn.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
      pen.position.copy(st.furn.worldToLocal(tip.clone().addScaledVector(axis, 0.065)));
    };
    gaze = () => eyesAt(s, st.furn.localToWorld(new V3(0.02, 0.746, 0.46)), 1);
    view = { pos: st.furn.localToWorld(new V3(0.9, 2.15, -0.95)), tgt: st.furn.localToWorld(new V3(0, 0.85, 0.45)), fov: 50 };   // over the subject's shoulder, down at the page
  } else if (kind === 'heldalt') {   // the player seated, the subject sideways on their lap, arms round each other: it sits by the seat's own height, so it takes any pair of sizes
    const st = seated(g, 0, 0, 0), kg = g.spec.H / 1.7, ks = s.spec.H / 1.7;
    S.setPose(s, 'Sit', true); for (const b of S.BONES) s.bones[b].quaternion.copy(s.pose[b]);
    s.group.quaternion.copy(yawQ(Math.PI / 2)); s.group.updateMatrixWorld(true);
    const gp = g.bones.pelvis.getWorldPosition(new V3()), gth = g.bones.thighL.getWorldPosition(new V3()), rTh = g.spec.m.thigh / 100 / (2 * Math.PI);
    const pelLocal = new V3(...s.spec.J.pelvis).applyQuaternion(s.group.quaternion);
    s.group.position.copy(new V3(gp.x - 0.04 * kg, gth.y + rTh + 0.075 * ks, gp.z + 0.2 * kg)).sub(pelLocal); s.group.updateMatrixWorld(true);
    // leaning in toward the player, the head laid against their shoulder
    s.bones.spine1.quaternion.multiply(S.degQ([-4, 0, 12])); s.bones.spine2.quaternion.multiply(S.degQ([-2, 0, 10]));
    for (const b of S.BONES) s.pose[b].copy(s.bones[b].quaternion); s.target = Object.fromEntries(S.BONES.map(b => [b, s.pose[b]]));
    hold = () => {
      g.group.updateMatrixWorld(true); s.group.updateMatrixWorld(true);
      const Yv = new V3(0, 1, 0), gsh = g.bones.spine2.getWorldPosition(new V3()), ssp = s.bones.spine1.getWorldPosition(new V3());
      // the player's right arm round the subject's back, the left hand resting on their thigh
      S.armIK(g, 'R', ssp.clone().add(new V3(-0.1 * ks, 0.02 * ks, 0.02 * ks)), g.bones.upperArmR.getWorldPosition(new V3()).add(new V3(-0.3, -0.2, 0.25)), new V3(-1, 0, 0), new V3(0, 0, 1));
      const thigh = s.bones.thighL.getWorldPosition(new V3()).lerp(s.bones.shinL.getWorldPosition(new V3()), 0.35).add(new V3(0, 0.07 * ks, 0));
      S.armIK(g, 'L', thigh, g.bones.upperArmL.getWorldPosition(new V3()).add(new V3(0.2, -0.2, 0.2)), Yv, new V3(1, 0, 0));
      // the subject's left arm round the player's neck, the right hand on their chest
      const nk = g.bones.neck.getWorldPosition(new V3());
      S.armIK(s, 'L', nk.clone().add(new V3(-0.06 * kg, -0.02 * kg, -0.02 * kg)), s.bones.upperArmL.getWorldPosition(new V3()).add(new V3(0.0, -0.1, -0.3)), new V3(0, 1, 0), new V3(-1, 0, 0));
      S.armIK(s, 'R', gsh.clone().add(new V3(0.06 * kg, 0.02 * kg, 0.1 * kg)), s.bones.upperArmR.getWorldPosition(new V3()).add(new V3(0.1, -0.2, 0.1)), new V3(0, 0, 1), new V3(-1, 0, 0));
      S.lookAt(s, g.bones.neck.getWorldPosition(new V3()).add(new V3(0.05, 0.04 * kg, 0)), 1.3); S.lookAt(g, s.bones.head.getWorldPosition(new V3()), 0.6);
    };
    gaze = () => { eyesAt(g, s.bones.head.getWorldPosition(new V3()), 0.7); eyesAt(s, g.bones.neck.getWorldPosition(new V3()), 0.5); };
    view = { pos: new V3(2.0, 1.35, 1.9), tgt: new V3(0, 0.95, 0.1), fov: 38 };
  } else if (kind === 'held') {
    // Standing, chest to chest, the subject leaning into it with the feet held back: their arms inside (round the player's waist, under the player's arms), the player's outside
    // (wide round the subject's back). Everything is measured off the two bodies, so any pair of sizes finds its own distance and its own reach.
    const { kg, ks } = placeClose(0.14);
    // an arm to a hand-hold, its elbow and forearm kept out of both bodies: the pole is pushed outward until neither is in the skin
    const armTo = (c, other, side, target, pole, n, fingers, out) => {
      // the elbow is tried further and further out (and out and back), and the arm that keeps best clear of the other body is the one kept
      let best = null;
      const tryPole = P => {
        S.armIK(c, side, target, P, null, null, n.clone().negate());   // (the palm presses toward the other body, fingers following the forearm)
        c.group.updateMatrixWorld(true);
        const up = c.bones['upperArm' + side].getWorldPosition(new V3()), el = c.bones['forearm' + side].getWorldPosition(new V3()), wr = c.bones['hand' + side].getWorldPosition(new V3());
        let m = Infinity;
        for (const pt of [up.clone().lerp(el, 0.5), el, el.clone().lerp(wr, 0.35), el.clone().lerp(wr, 0.65)]) { const pts = S.posedSkinNear(other, pt, 0.15); if (pts.length) m = Math.min(m, S.skinSignedDist(pts, pt)); }
        if (!best || m > best.m) best = { m, P: P.clone() };
        return m;
      };
      for (let i = 0; i < 14 && tryPole(pole.clone().addScaledVector(out, 0.12 * i)) < 0.02; i++);
      if (best.m < 0.02) for (let i = 0; i < 8; i++) tryPole(pole.clone().addScaledVector(out, 0.5 + 0.1 * i).addScaledVector(n, 0.15 * i));
      S.armIK(c, side, target, best.P, null, null, n.clone().negate());
    };
    // where a palm goes on the other's back: the outermost skin behind the bone at that height and that far to the side, the palm a hair off it
    const backAt = (c, bone, back, dy, dz) => {
      const o = c.bones[bone].getWorldPosition(new V3()).add(new V3(0, dy, dz)), pts = S.posedSkinNear(c, o.clone().addScaledVector(back, 0.1), 0.2);
      let best = null, bd = -Infinity;
      for (let i = 0; i < pts.length; i += 6) { if (Math.abs(pts[i + 1] - o.y) > 0.03 || Math.abs(pts[i + 2] - o.z) > 0.04) continue; const d = (pts[i] - o.x) * back.x; if (d > bd) { bd = d; best = i; } }
      return best == null ? o.addScaledVector(back, 0.12) : new V3(pts[best], pts[best + 1], pts[best + 2]).addScaledVector(back, 0.012);
    };
    hold = () => {
      g.group.updateMatrixWorld(true); s.group.updateMatrixWorld(true);
      const at = (c, n) => c.bones[n].getWorldPosition(new V3());
      const sBack = new V3(1, 0, 0), gBack = new V3(-1, 0, 0), Zp = new V3(0, 0, 1), Zm = new V3(0, 0, -1);
      // the player's arms, outside the subject's: hands apart on the upper back, each on its own side (the right is +Z, the subject's left), the elbows wide
      armTo(g, s, 'R', backAt(s, 'spine2', sBack, 0.03 * ks, 0.1 * ks), at(g, 'upperArmR').add(new V3(-0.1, 0.12, 0.5)), sBack.clone(), new V3(0, 0.3, -1), Zp);
      armTo(g, s, 'L', backAt(s, 'spine2', sBack, -0.03 * ks, -0.1 * ks), at(g, 'upperArmL').add(new V3(-0.1, 0.0, -0.5)), sBack.clone(), new V3(0, -0.3, 1), Zm);
      // the subject's arms, inside: hands apart on the player's lower back, the subject's left (+Z) on the player's right side, the elbows in and low
      armTo(s, g, 'L', backAt(g, 'spine1', gBack, -0.03 * kg, 0.11 * kg), at(s, 'upperArmL').add(new V3(0.0, -0.3, 0.1)), gBack.clone(), new V3(0, 0.2, 1), Zp);
      armTo(s, g, 'R', backAt(g, 'spine1', gBack, -0.03 * kg, -0.11 * kg), at(s, 'upperArmR').add(new V3(0.0, -0.3, -0.1)), gBack.clone(), new V3(0, 0.2, -1), Zm);
      // the subject's head on the player's right shoulder (the side they stand to), the face turned away to that side; the player's bowed to the subject's other shoulder
      const sh = at(s, 'head'), gs = at(g, 'upperArmR'), gn = at(g, 'neck'), gc = at(g, 'spine2');
      const ty = sh.y > gs.y ? gs.y + 0.02 * kg : Math.max(gc.y, sh.y - 0.02);   // (the shoulder if the head reaches it, else the chest)
      S.lookAt(s, new V3(gs.x, ty, gs.z + 0.25 * kg), 1.6);
      S.lookAt(g, at(s, 'upperArmR').add(new V3(0, 0.03 * ks, -0.12 * ks)), 0.9);
    };
    gaze = () => { eyesAt(g, at0(s, 'upperArmR'), 0.6); s.gazeFx = null; };
    view = { pos: new V3(1.5, 1.3, 2.3), tgt: new V3(0, 1.1, 0.02), fov: 36 };   // front three-quarter, from the side the subject stands to, so both faces and the hands on the backs are in view
  } else {   // 'warm'
    const st = seated(g, 0, 0, -0.25);
    standing(s, Math.PI, 0, 0.85);
    hold = () => {
      g.group.updateMatrixWorld(true); s.group.updateMatrixWorld(true);
      S.lookAt(g, s.bones.head.getWorldPosition(new V3()), 0.9); S.lookAt(s, g.bones.head.getWorldPosition(new V3()), 0.9);
    };
    gaze = () => { eyesAt(g, s.bones.head.getWorldPosition(new V3())); eyesAt(s, g.bones.head.getWorldPosition(new V3())); };
    view = { pos: new V3(-1.7, 1.5, 3.6), tgt: new V3(0, 1.0, 0.2), fov: 42 };   // from just behind the subject's shoulder, looking across them to the player in the chair   // square on from the side, both profiles
  }
  function a0() { return 0; }
  // let the skirt (if any) settle once the pose is in
  for (const c of both) c.group.updateMatrixWorld(true);
  for (const c of both) if (c.skirt && c.group.visible) { try { S.settleSkirt(c, both.filter(o => o !== c), []); } catch (e) { /* the skirt is cosmetic here */ } }
  return {
    view, subject: s, giver: g,
    drift: true,   // (the camera moves slowly; nothing else does)
    tick(dt, t) {
      // the scene is posed, settles for a second or so, and is then held: no animation, no cloth or hair, no faces. Only the camera moves.
      this.n = (this.n || 0) + 1; if (this.n > (kind === 'held' || kind === 'heldalt' ? 6 : 50)) return;   // (the hugs solve their arms from the skin, which is costly: a few frames, then held)
      for (const c of both) if (c.group.visible) S.animateCharacter(c, dt, t);
      applyEdits();
      hold(t); applyEdits(); cleanArms(); gaze();
      for (const c of both) if (c.group.visible) { c.group.updateMatrixWorld(true); S.bustSpring(c, dt); }
      const on = both.filter(c => c.group.visible);
      for (const c of on) S.bustContact(c, on);
      S.updateContacts(on);
      const colliders = on.flatMap(S.bodyColliders);
      for (const c of on) { S.hairStep(c, dt, colliders); S.faceStep(c, dt); S.skirtStep(c, dt, on, []); S.bunchStep(c); S.fadeMarks(c, 0); }
    },
    dispose() {
      marks[opts.subjectId] = { marks: s.marks, stripes: s.stripes };
      for (const c of both) { scene.remove(c.group, c.helper); S.disposeCharacter(c); }
      for (const f of extras) { scene.remove(f); f.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
    },
  };
}

// ── The stage ───────────────────────────────────────────────────
function createStage(viewEl, { onGLProblem } = {}) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  if (onGLProblem) S.watchGL(renderer, onGLProblem);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.localClippingEnabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  viewEl.appendChild(renderer.domElement);
  const scene = new T.Scene(); scene.background = new T.Color(0x120d08);
  const camera = new T.PerspectiveCamera(35, 1, 0.05, 40);
  const controls = new T.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 0.35; controls.maxDistance = 6; controls.maxPolarAngle = Math.PI * 0.55;
  const room = Room.buildRoom(scene);
  const resize = () => {
    const w = viewEl.clientWidth || 1, h = viewEl.clientHeight || 1;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  };
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(viewEl); else window.addEventListener('resize', resize);

  const marks = {};   // resident id → { marks, stripes }: kept through the day
  let session = null, running = false, last = 0, clock = 0, onFrame = null;

  // Standard angles (see cameraPose): a button takes the camera there; from then on the view is the user's to orbit, zoom and pan.
  const cam = { mode: 'overview', go: null, snap: false, framed: false };
  let api_onCam = null;
  controls.addEventListener('start', () => { cam.go = null; cam.mode = 'free'; cam.userMoved = true; if (api_onCam) api_onCam(); });   // the user has taken the view
  function setCamera(mode, snap) {
    if (!CAMERAS.some(c => c[0] === mode)) return;
    cam.mode = mode; cam.snap = !!snap;
    cam.go = session ? cameraPose(mode, session) : null;
  }
  function updateCamera(dt) {
    if (session && session.drift && cam.mode === 'free' && !cam.go && !cam.userMoved) {   // an aftercare scene: a slow sway about what it is looking at
      const sw = Math.sin(clock * 0.28) * 0.12 * dt, c = Math.cos(sw), sn = Math.sin(sw), tg = controls.target, p = camera.position;
      const x = p.x - tg.x, z = p.z - tg.z; p.x = tg.x + x * c - z * sn; p.z = tg.z + x * sn + z * c;
    }
    if (cam.go) {
      const ease = cam.snap ? 1 : 1 - Math.exp(-dt * 5);
      camera.position.lerp(cam.go.pos, ease); controls.target.lerp(cam.go.tgt, ease);
      camera.fov += (cam.go.fov - camera.fov) * ease; camera.updateProjectionMatrix();
      if (camera.position.distanceTo(cam.go.pos) < 0.01 && controls.target.distanceTo(cam.go.tgt) < 0.01) cam.go = null;
      cam.snap = false;
    }
    controls.update();
    // The user's orbit stays inside the room: never through a wall, the floor or the ceiling (the view slides along them instead).
    const lim = Room.HALF - 0.12, cp = camera.position;
    cp.x = clamp(cp.x, -lim, lim); cp.z = clamp(cp.z, -lim, lim); cp.y = clamp(cp.y, 0.1, Room.HEIGHT - 0.1);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05) || 0.016; last = now; clock += dt;
    if (session) session.tick(dt, clock);
    if (onFrame) onFrame(dt, clock);
    room.update(clock);
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  // A session on the stage: the camera follows the bodies, the loop keeps it running.
  function begin(opts) {
    if (session) session.dispose();
    const api = createSession(scene, opts, { marks,
      afterMake: (g, s) => {
        if (cam.mode !== 'free') { const o = cameraPose(cam.mode, { subject: s, giver: g }); camera.position.copy(o.pos); controls.target.copy(o.tgt); camera.fov = o.fov; camera.updateProjectionMatrix(); camera.lookAt(o.tgt); cam.go = null; }
        else if (!cam.framed) { const o = cameraPose('overview', { subject: s, giver: g }); camera.position.copy(o.pos); controls.target.copy(o.tgt); camera.fov = o.fov; camera.updateProjectionMatrix(); camera.lookAt(o.tgt); cam.framed = true; }
      },
      onDispose: a => { if (session === a) session = null; } });
    session = api;
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    return api;
  }
  // An aftercare scene (see createTableau) in place of the correction; the camera is taken to its view.
  function tableau(kind, opts) {
    if (session) session.dispose();
    const t = createTableau(scene, kind, opts, { marks });
    session = t;
    const far = camera.aspect < 1 ? 1.6 : 1;   // (a tall, narrow view stands further back to keep both in frame)
    cam.userMoved = false; cam.mode = 'free'; cam.go = { pos: t.view.tgt.clone().addScaledVector(t.view.pos.clone().sub(t.view.tgt), far), tgt: t.view.tgt, fov: t.view.fov }; cam.snap = true;
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    return t;
  }
  function end() { if (session) session.dispose(); session = null; if (!onFrame) running = false; }
  // The editor draws its own things in the room: a per-frame callback keeps the loop going with or without a session.
  function loop(fn) { onFrame = fn; if (fn && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } if (!fn && !session) running = false; }
  function clearMarks() { for (const k of Object.keys(marks)) delete marks[k]; }
  return { begin, tableau, end, loop, clearMarks, setCamera, onCameraTaken: fn => { api_onCam = fn; }, get cameraMode() { return cam.mode; }, renderer, camera, controls, scene, get session() { return session; }, resize };
}

root.FairyShoeScene = { TABLEAUX: [['corner', 'Corner time'], ['lines', 'Lines'], ['held', 'Held after (standing)'], ['heldalt', 'Held after (alternate, seated)'], ['warm', 'Warm words']], cameraPose, layerLabel, layerNext, skirtMode, furnishScene, holdChairHands, chairSeatTop, applyPoseOverrides, prepareSubject, furnishDiscipline, createSession, createTableau, createStage, POSITIONS, IMPLEMENTS, CAMERAS, LAYER_LABELS, PACE, STRENGTH, RUN, Sound };
})(window);
