// ΩΤΚ Companion — bodies. Each sister (and the player, Avery) is a Starlight preset, built from one of the engine's stock bodies with the
// measurements, colouring and clothes of the person. All adult builds.
//
// The source book gives almost no physical description (no hair colour, eye colour, height or build is ever stated), so what is here is what it does say,
// kept as it said it, and nothing it does not: how each sister dresses, how she carries herself, what her hair is doing. The rest (colours, builds) is a choice
// made here, and is changeable in the character editor.
//   Lila: a cropped black sweater, high-waisted jeans and boots; hair half up and half down; guarded.
//   Taylor: the wrinkled hoodie, the lopsided ponytail and the red-rimmed eyes of a bad morning.
//   Hannah: quiet, fidgeting with a loose thread on her sleeve; nothing else is described.
//   Jess: cheerful, a quick flick of the eyes, stretched out on the couch with snacks.
//   Marcy: brushing her hair, perched sideways, dry.
//   Sloane: (new) the polished legacy; the social chair.
//   Avery: composed authority. "Her eyes curious, unreadable" is the only thing the book says.
(function (root) {
'use strict';
const S = root.Starlight;
const A = Object.assign;

const wear = (base, o) => ({ ...base, ...o });
// A look is a list of wardrobe ids, innermost first. These sisters wear 'Everyday'.
const everyday = layers => ({ Underwear: layers.filter(l => l === 'bra' || l === 'briefs'), Everyday: layers });
// The engine's tall build has a thong by default; every sister here wears plain briefs.
const plainBriefs = (m, o) => { const b = wear(m.wardrobe.briefs, { back: 'brief', backCurve: 0.6, rise: 0.4, side: 0.9, ...o }); delete b.thong; delete b.riseBack; return b; };

const BODIES = {
  // Lila — a slight, careful build (Rin's), dark hair half up and half down, a cropped black sweater over high-waisted jeans.
  lila: () => {
    const m = S.clone(S.PRESETS.rin);
    A(m, { name: 'Lila', height: 166, skin: 0xe8c7a8, youth: 0.3, bust: 80, underbust: 68, hip: 92, glutes: 1.35,
      outfit: { hair: 0x2b1a14, hairStyle: 'long', clips: [0x1a1214] },
      expr: { browInner: 0.15, browOuter: 0.0, lidUpper: -0.05, mouthL: 0.05, mouthR: -0.02, saccade: 0.4, contact: 0.35, blink: 0.9 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Black bra', color: 0x1c1c20 }), briefs: wear(m.wardrobe.briefs, { name: 'Black briefs', color: 0x1c1c20 }),
      bottom: { kind: 'bottom', name: 'High-waisted jeans', color: 0x3b4a66, legLen: 2.0, lowerTo: 'ankle', from: 'waist' },
      top: { kind: 'top', name: 'Cropped black sweater', color: 0x17161a, from: 'waist', sleeves: 2 },
      shoes: wear(m.wardrobe.shoes, { name: 'Boots', color: 0x1b1512 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Taylor — a bright, quick build (Kiko's), a low lopsided ponytail, a wrinkled hoodie, eyes that have had a long night.
  taylor: () => {
    const m = S.clone(S.PRESETS.kiko);
    A(m, { name: 'Taylor', height: 163, skin: 0xeccaa6, youth: 0.3, bust: 84, underbust: 64,
      outfit: { hair: 0x7a4a2c, hairStyle: 'ponytail', ponyDrop: 0.035, scrunchie: 0x3a3a40, bobbles: [0x3a3a40] },
      expr: { browInner: 0.35, browOuter: 0.05, lidUpper: -0.15, browAsym: 0.15, mouthL: 0.3, mouthR: 0.05, saccade: 0.8, contact: 0.55, blink: 1.2 } });
    delete m.outfit.clips;
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Grey sports bra', color: 0x6a6e78 }), briefs: wear(m.wardrobe.briefs, { name: 'Charcoal hipsters', color: 0x3b3f55 }),
      bottom: { kind: 'bottom', name: 'Leggings', color: 0x25252b, legLen: 2.0, lowerTo: 'ankle' },
      top: { kind: 'top', name: 'Wrinkled hoodie', color: 0x5e6a5a, from: 'hip', sleeves: 2 },
      shoes: wear(m.wardrobe.shoes, { name: 'Trainers', color: 0xd9d4cb }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Hannah — a small, quiet build (Rin's), a neat short cut, an oatmeal sweater with a loose thread at the cuff.
  hannah: () => {
    const m = S.clone(S.PRESETS.rin);
    A(m, { name: 'Hannah', height: 160, skin: 0xf3d6bd, youth: 0.35, bust: 79, underbust: 67, hip: 90, glutes: 1.3,
      outfit: { hair: 0x6b4a34, hairStyle: 'short' },
      expr: { browInner: 0.4, browOuter: 0.05, lidUpper: 0.1, mouthL: -0.02, mouthR: -0.02, saccade: 0.6, contact: 0.25, blink: 1.1 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Lilac bra', color: 0xe3dcef }), briefs: wear(m.wardrobe.briefs, { name: 'Lilac briefs', color: 0xe3dcef }),
      bottom: { kind: 'bottom', name: 'Leggings', color: 0x4a4660, legLen: 2.0, lowerTo: 'ankle' },
      top: { kind: 'top', name: 'Oatmeal sweater', color: 0xd8cdb8, from: 'hip', sleeves: 2 },
      shoes: wear(m.wardrobe.shoes, { name: 'Soft shoes', color: 0xcfc6b8 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Jess — a bright, easy build (Kiko's, taller), fair hair in two buns, a yellow tee and sleep shorts: always about to be on the couch.
  jess: () => {
    const m = S.clone(S.PRESETS.kiko);
    A(m, { name: 'Jess', height: 168, skin: 0xf0cdae, youth: 0.3, bust: 88, underbust: 66, hip: 96,
      outfit: { hair: 0xc9a24f, hairStyle: 'buns', bobbles: [0xe8a33c, 0xe8a33c], clips: [0xe8a33c] },
      expr: { mouthL: 0.6, mouthR: 0.5, lidUpper: 0.4, browInner: 0.15, browOuter: 0.25, saccade: 0.55, contact: 0.9, blink: 1.0 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Cream sports bra', color: 0xece4d2 }), briefs: wear(m.wardrobe.briefs, { name: 'Cream hipsters', color: 0xece4d2 }),
      bottom: wear(m.wardrobe.bottom, { name: 'Sleep shorts', color: 0x7aa6c8 }),
      top: { kind: 'top', name: 'Cosy yellow tee', color: 0xe9b94a, from: 'hip', sleeves: 0.45 },
      shoes: wear(m.wardrobe.shoes, { name: 'Slides', color: 0xe9e4dc }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Marcy — a composed, tall-ish build (Aya's, shorter), long dark hair she is always brushing, a faded tee and joggers.
  marcy: () => {
    const m = S.clone(S.PRESETS.aya);
    A(m, { name: 'Marcy', height: 165, skin: 0xd9b08e, youth: 0.25, bust: 84, underbust: 70, hip: 96,
      outfit: { hair: 0x16100e, hairStyle: 'long' },
      expr: { browInner: -0.2, browOuter: 0.0, lidUpper: -0.2, mouthL: 0.1, mouthR: 0.0, saccade: 0.15, contact: 0.7, blink: 0.7 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Grey bralette', color: 0x6a6a74 }), briefs: plainBriefs(m, { name: 'Grey briefs', color: 0x80808a }),
      bottom: { kind: 'bottom', name: 'Joggers', color: 0x3a3e48, legLen: 2.0, lowerTo: 'ankle' },
      top: { kind: 'top', name: 'Faded grey tee', color: 0x8a8d96, from: 'hip', sleeves: 0.45 },
      shoes: wear(m.wardrobe.shoes, { name: 'Slippers', color: 0x6a5a58 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Sloane — a tall, poised build (Aya's), a high ponytail with a navy tie, a cream blouse and tailored trousers: the social chair.
  sloane: () => {
    const m = S.clone(S.PRESETS.aya);
    A(m, { name: 'Sloane', height: 175, skin: 0xedcaa8, youth: 0.2, bust: 90, underbust: 73, hip: 99, glutes: 1.3,
      outfit: { hair: 0x5a2e1c, hairStyle: 'ponytail', scrunchie: 0x1f2a44, bobbles: [0x1f2a44] },
      expr: { browInner: -0.05, browOuter: 0.2, lidUpper: 0.1, mouthL: 0.15, mouthR: 0.1, saccade: 0.2, contact: 0.9, blink: 0.8 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'White bralette', color: 0xf0eee9 }), briefs: plainBriefs(m, { name: 'White briefs', color: 0xf0eee9 }),
      bottom: { kind: 'bottom', name: 'Tailored trousers', color: 0x23304a, legLen: 2.0, lowerTo: 'ankle', belt: { color: 0x2a1a12, buckle: 0xb8aa80 } },
      top: { kind: 'top', name: 'Cream blouse', color: 0xefe8da, from: 'hip', sleeves: 1.5, neck: 'v', collar: true, placket: true, buttons: 0xcfc6ad },
      shoes: wear(m.wardrobe.shoes, { name: 'Loafers', color: 0x2a1a14 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
};

// The player: Avery, the Big. There is nothing to choose: she is the one with the hands. The book says nothing of how she looks except that her eyes are
// curious and unreadable, so the face is the engine's watchful composure (level brows, a held gaze), and the rest is plain: a wine-coloured knit and dark jeans,
// her hair tied back low and neat. The name is the one thing the player can change (it is only a name).
const KEEPERS = {
  a: { name: 'Avery', label: 'Avery: composed, still, hard to read', make: () => {
    const m = S.clone(S.PRESETS.aya);
    A(m, { name: 'Avery', height: 169, legs: 1.02, shoulders: 38, bust: 88, underbust: 72, cup: 3, waist: 65, hip: 99, glutes: 1.32, neck: 30, arm: 26, forearm: 22, wrist: 14.5, thigh: 53, knee: 34, calf: 33, ankle: 20.5,
      skin: 0xe3c0a0, youth: 0.12, brow: 0.35, lips: 0.85, cheeks: 0.85,
      outfit: { hair: 0x3a2418, hairStyle: 'ponytail', ponyDrop: 0.04, scrunchie: 0x4e1721, bobbles: [0x4e1721] },
      expr: { browInner: -0.15, browOuter: 0.05, mouthL: 0.1, mouthR: 0.05, lidUpper: 0.05, saccade: 0.12, contact: 0.85, blink: 0.6 } });
    m.moods = { effort: { browInner: 0.05, browFurrow: 0.5, lidUpper: -0.3, squint: 0.4, mouthL: -0.2, mouthR: -0.2 }, enjoyment: { browOuter: 0.05, squint: 0.2, mouthL: 0.4, mouthR: 0.4 } };
    m.wardrobe = {
      bra: { kind: 'bra', name: 'Plain bra', color: 0xe9e2d4, style: 'classic' },
      briefs: { kind: 'briefs', name: 'Cotton briefs', color: 0xe9e2d4, rise: 0.7, side: 1.0, back: 'brief', backCurve: 0.5 },
      bottom: { kind: 'bottom', name: 'Dark jeans', color: 0x2a3040, legLen: 2.0, lowerTo: 'ankle' },
      top: { kind: 'top', name: 'Wine knit top', color: 0x5c2330, from: 'hip', sleeves: 1.5 },
      shoes: { kind: 'shoes', name: 'Black ankle boots', color: 0x1c1618 },
    };
    m.looks = { Underwear: ['bra', 'briefs'], Everyday: ['bra', 'briefs', 'bottom', 'top', 'shoes'] }; m.look = 'Everyday';
    return m;
  } },
};

root.OtkBodies = { BODIES, KEEPERS, spec: id => BODIES[id](), keeper: () => KEEPERS.a.make() };
})(window);
