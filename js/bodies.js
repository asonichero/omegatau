// Birchwood House — bodies. Each resident (and the player's own hands) is a Starlight preset, built from one of the engine's
// stock bodies with the measurements, colouring and clothes of the person. All adult builds.
(function (root) {
'use strict';
const S = root.Starlight;
const A = Object.assign;

const wear = (base, o) => ({ ...base, ...o });
// A look is a list of wardrobe ids, innermost first. These residents wear 'Everyday'.
const everyday = layers => ({ Underwear: layers.filter(l => l === 'bra' || l === 'briefs'), Everyday: layers });

const BODIES = {
  // Red — a bright, restless build (Kiko's), a red top over a short skirt.
  red: () => {
    const m = S.clone(S.PRESETS.kiko);
    A(m, { name: 'Red', height: 162, skin: 0xedcaa9, outfit: { hair: 0x5a1e12, hairStyle: 'ponytail', scrunchie: 0xc42b2b, bobbles: [0x5a1e12] }, youth: 0.5,
      expr: { mouthL: 0.45, mouthR: 0.35, lidUpper: 0.45, browInner: 0.1, browOuter: 0.3, saccade: 0.95, contact: 0.5, blink: 1.2 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Cream sports bra', color: 0xe9e0d0 }), briefs: wear(m.wardrobe.briefs, { name: 'Cream hipsters', color: 0xe9e0d0 }),
      bottom: wear(m.wardrobe.bottom, { name: 'Shorts', color: 0x6a2a24 }), skirt: wear(m.wardrobe.skirt, { name: 'Red skirt', color: 0xb02828, length: 0.2 }),
      top: wear(m.wardrobe.top, { name: 'Red hooded top', color: 0xc42b2b }), shoes: wear(m.wardrobe.shoes, { name: 'Boots', color: 0x4a2e1c }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'skirt', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Goldilocks — a slim, long-haired build (Rin's), golden hair, a pale-blue dress in two pieces.
  goldilocks: () => {
    const m = S.clone(S.PRESETS.rin);
    A(m, { name: 'Goldilocks', height: 167, skin: 0xf0cfb0, youth: 0.45, bust: 82, underbust: 69, hip: 92, glutes: 1.3,
      outfit: { hair: 0xd9a843, hairStyle: 'long' },
      expr: { browInner: -0.1, browOuter: 0.15, lidUpper: 0.2, mouthL: 0.2, mouthR: 0.1, saccade: 0.4, contact: 0.8, blink: 0.9 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { color: 0xF4B8E4 }), briefs: wear(m.wardrobe.briefs, { color: 0xF4B8E4 }),
      bottom: wear(m.wardrobe.bottom, { name: 'Under-shorts', color: 0xe6dccb, legLen: 0.4 }),
      skirt: { kind: 'skirt', name: 'Blue dress, skirt', color: 0x7fa3d6, above: 0.01, length: 0.24, flare: 0.03 },
      top: { kind: 'top', name: 'Blue dress, bodice', color: 0x7fa3d6, from: 'belly', sleeves: 0.45, belt: { color: 0xf4f1ea, buckle: 0xe9e4d6, width: 0.008, at: 'belly', buckleScale: 0.5 } }, shoes: wear(m.wardrobe.shoes, { name: 'Buckled shoes', color: 0x7fa3d6 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'skirt', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Rapunzel — a tall, quiet build (Aya's), long fair hair, a lilac top over leggings.
  rapunzel: () => {
    const m = S.clone(S.PRESETS.aya);
    A(m, { name: 'Rapunzel', height: 174, skin: 0xf1d2b6, youth: 0.3, bust: 84, hip: 98, glutes: 1.2,
      outfit: { hair: 0xe8c872, hairStyle: 'long' },
      expr: { browInner: 0.35, browOuter: 0, gazeY: -0.12, lidUpper: -0.1, mouthL: -0.05, mouthR: -0.05, saccade: 0.5, contact: 0.3, blink: 1.0 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { name: 'Lilac bralette', color: 0x8a78b8 }), briefs: wear(m.wardrobe.briefs, { name: 'Lilac briefs', color: 0x8a78b8, back: 'brief', thong: undefined, backCurve: 0.6, rise: 0.4, riseBack: 0.8 }),
      bottom: wear(m.wardrobe.bottom, { name: 'Leggings', color: 0x4a3f6e }), top: wear(m.wardrobe.top, { name: 'Lilac tunic', color: 0xb7a6e0, from: 'hip', sleeves: 1 }),
      shoes: wear(m.wardrobe.shoes, { name: 'Soft shoes', color: 0xd8cfe6 }) });
    delete m.wardrobe.briefs.thong;
    m.looks = everyday(['bra', 'briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Jack — a lean, quick build (Haru's, taller), green and brown; a grin kept ready.
  jack: () => {
    const m = S.clone(S.PRESETS.haru);
    A(m, { name: 'Jack', height: 176, legs: 1.04, shoulders: 41, bust: 90, underbust: 84, waist: 74, hip: 90, neck: 34, arm: 28, forearm: 24, wrist: 16, thigh: 49, knee: 35, calf: 34, ankle: 21,
      skin: 0xe6bd98, youth: 0.2, outfit: { hair: 0x7a4a22, hairStyle: 'short' },
      expr: { mouthL: 0.55, mouthR: 0.2, lidUpper: 0.35, browInner: 0.05, browOuter: 0.25, browAsym: 0.2, saccade: 0.7, contact: 0.9, blink: 1.0 } });
    A(m.wardrobe, {
      briefs: wear(m.wardrobe.briefs, { name: 'Brown trunks', color: 0x5a4028 }), bottom: wear(m.wardrobe.bottom, { name: 'Brown trousers', color: 0x6a5232 }),
      top: wear(m.wardrobe.top, { name: 'Green shirt, short-sleeved', color: 0x4f8a3c, from: 'hip', sleeves: 0.45, neck: 'v', collar: true, placket: true, buttons: 0xe9e2cf }), shoes: wear(m.wardrobe.shoes, { name: 'Boots', color: 0x3a2a1a }) });
    m.looks = everyday(['briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Hans — a big, steady build (Kenji's); nothing in the face moves unless it has a reason.
  hans: () => {
    const m = S.clone(S.PRESETS.kenji);
    A(m, { name: 'Hans', height: 174, youth: 0.35, cheeks: 0.78, skin: 0xf0cdae, outfit: { hair: 0xc8b078, hairStyle: 'short' },
      expr: { gazeX: 0.05, gazeY: 0.0, squint: 0.1, lidUpper: -0.05, browInner: 0, mouthL: 0, mouthR: 0, saccade: 0.15, contact: 0.85, blink: 0.7 } });
    A(m.wardrobe, {
      briefs: wear(m.wardrobe.briefs, { name: 'Grey trunks', color: 0x55585e }), bottom: wear(m.wardrobe.bottom, { name: 'Work trousers', color: 0x4a4d52 }),
      top: wear(m.wardrobe.top, { name: 'Undyed sweater', color: 0xCDB991, from: 'hip', sleeves: 2 }), shoes: wear(m.wardrobe.shoes, { name: 'Boots', color: 0x2c2a26 }) });
    m.looks = everyday(['briefs', 'bottom', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
  // Snow White — a soft, slight build (Rin's), black hair, pale skin, a yellow top and blue skirt.
  snow: () => {
    const m = S.clone(S.PRESETS.rin);
    A(m, { name: 'Snow White', height: 160, skin: 0xf6e1d2, youth: 0.5, bust: 80, underbust: 67, hip: 90, glutes: 1.35,
      outfit: { hair: 0x0e0b0c, hairStyle: 'long' },
      expr: { browInner: 0.4, browOuter: 0.1, lidUpper: 0.3, mouthL: 0.1, mouthR: 0.1, saccade: 0.5, contact: 0.7, blink: 1.0 } });
    A(m.wardrobe, {
      bra: wear(m.wardrobe.bra, { color: 0xB02828 }), briefs: wear(m.wardrobe.briefs, { color: 0xB02828 }),
      bottom: wear(m.wardrobe.bottom, { name: 'Under-shorts', color: 0xe8e0d0, legLen: 0.4 }),
      skirt: { kind: 'skirt', name: 'Blue skirt', color: 0x2f4d9c, above: 0.01, length: 0.26, flare: 0.03 },
      top: { kind: 'top', name: 'Yellow top', color: 0xe8c23c, from: 'waist', sleeves: 0.45 }, shoes: wear(m.wardrobe.shoes, { name: 'Little shoes', color: 0xb02828 }) });
    m.looks = everyday(['bra', 'briefs', 'bottom', 'skirt', 'top', 'shoes']); m.look = 'Everyday';
    return m;
  },
};

// The player's own hands: who they appear as, chosen on the first screen. Never named. Both are in their forties or fifties, plainly and
// conservatively dressed, the sort of figures the stories keep at the edge of the page: Mother Hubbard, and The Huntsman.
const KEEPERS = {
  a: { name: 'Mother Hubbard', label: 'Mother Hubbard: a woman in her forties, in jeans and a plum tank', make: () => {
    const m = S.clone(S.PRESETS.aya);
    A(m, { name: 'Mother Hubbard', height: 165, legs: 1.0, shoulders: 37, bust: 95, underbust: 78, cup: 4, waist: 72, hip: 103, glutes: 1.3, neck: 30, arm: 29, forearm: 23, wrist: 15, thigh: 57, knee: 37, calf: 35, ankle: 21,
      skin: 0xe6c6a8, youth: 0.05, brow: 0.3, lips: 0.95, cheeks: 0.9, jaw: 0.97,
      outfit: { hair: 0x6a5a52, hairStyle: 'ponytail', ponyDrop: 0.045, scrunchie: 0x3c2a38, bobbles: [0x3c2a38] },   // brown going to silver; tied at the base of the skull
      expr: { browInner: -0.1, browOuter: -0.05, mouthL: 0.1, mouthR: 0.1, lidUpper: -0.1, saccade: 0.15, contact: 0.85, blink: 0.7 } });
    m.moods = { effort: { browInner: 0.05, browFurrow: 0.5, lidUpper: -0.3, squint: 0.4, mouthL: -0.2, mouthR: -0.2 }, enjoyment: { browOuter: 0.05, squint: 0.2, mouthL: 0.4, mouthR: 0.4 } };
    m.wardrobe = {
      bra: { kind: 'bra', name: 'Plain bodice', color: 0xe9e2d4, style: 'classic' },
      briefs: { kind: 'briefs', name: 'Cotton drawers', color: 0xe9e2d4, rise: 0.7, side: 1.0, back: 'brief', backCurve: 0.5 },
      // (the plum dress, a bodice and a long skirt, is set aside: a disciplinarian's skirt does not agree with the furniture)
      bottom: { kind: 'bottom', name: 'Jeans', color: 0x547085, legLen: 2.0, lowerTo: 'calf' },
      top: { kind: 'top', name: 'Plum tank', color: 0x5c3a56, from: 'hip', sleeves: 0.25 },
      shoes: { kind: 'shoes', name: 'Black buckled shoes', color: 0x1c1618 },
    };
    m.looks = { Underwear: ['bra', 'briefs'], Everyday: ['bra', 'briefs', 'bottom', 'top', 'shoes'] }; m.look = 'Everyday';
    return m;
  } },
  b: { name: 'The Huntsman', label: 'The Huntsman: a man in his forties, in a white shirt and brown breeches', make: () => {
    const m = S.clone(S.PRESETS.kenji);
    A(m, { name: 'The Huntsman', height: 182, legs: 1.0, shoulders: 46, bust: 104, underbust: 96, waist: 86, hip: 98, neck: 39, arm: 34, forearm: 28, wrist: 17.5, thigh: 58, knee: 39, calf: 37, ankle: 23.5, glutes: 1.3,
      skin: 0xdcb48e, youth: 0.0, brow: 0.35, nose: 1.15, lips: 0.88,
      outfit: { hair: 0x4e4640, hairStyle: 'short' },   // dark, gone grey at the edges
      expr: { gazeX: 0.05, gazeY: 0.05, squint: 0.3, lidUpper: -0.2, browInner: 0.0, mouthL: -0.03, mouthR: -0.03, saccade: 0.2, contact: 0.8, blink: 0.7 } });
    m.wardrobe = {
      briefs: { kind: 'briefs', name: 'Linen drawers', color: 0xd9d2c0, rise: 0.7, leg: 0.12 },
      bottom: { kind: 'bottom', name: 'Brown breeches', color: 0x5a4128, legLen: 2.0, lowerTo: 'ankle', belt: { color: 0x3a2616, buckle: 0xb8aa80 } },
      top: { kind: 'top', name: 'White linen shirt', color: 0xf0ece2, from: 'belly', sleeves: 1.5, neck: 'v', collar: true, placket: true, cuffs: true, buttons: 0xd8d0bc },
      shoes: { kind: 'shoes', name: 'Hunting boots', color: 0x2a1d14 },
    };
    m.looks = { Underwear: ['briefs'], Everyday: ['briefs', 'bottom', 'top', 'shoes'] }; m.look = 'Everyday';
    return m;
  } },
};

root.FairyShoeBodies = { BODIES, KEEPERS, spec: id => BODIES[id](), keeper: k => (KEEPERS[k] || KEEPERS.a).make() };
})(window);
