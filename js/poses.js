// Birchwood House — pose edits: bones of the discipline scene's poses that are set by hand rather than by the engine's pose tables.
// One list per position; an entry names whose pose it is (who: 'subject' or 'giver' — the player), at which beat (the subject's 'base'
// resting pose and what it blends toward when struck, 'contact'; the player's 'relaxed', 'raised' and 'contact'), and the bones it sets, as
// local Euler angles in degrees [x, y, z] (order YXZ, the pose tables' convention). The character editor prints a report in exactly this
// form (Pose editor ▸ Report, then the Report section): paste its entries here. Nothing else writes to this file.
(function (root) {
'use strict';
root.FairyShoePoses = {
  lap: [],
  case: [],
  head: [],
  chair: [],
  spread: [],
  // The aftercare scenes (corner, lines, held, warm): bones set on top of each scene's own standing or seated pose (who: 'subject' or 'giver', beat: 'base').
  corner: [], warm: [], heldalt: [],
  lines: [
    { who: 'subject', beat: 'base', bones: { neck: [25.9, 0.1, -0.4], upperArmL: [-53.7, 96.4, -88.9], forearmL: [-6.6, -65.7, -70.8], handL: [28.6, -62.2, -12.7], upperArmR: [-38.8, -94.6, 97.3], forearmR: [-28.2, 86, 89.3], handR: [52.9, 6.2, -4.7], fingersR: [0, 0, -7], thumbR: [-25.5, 0, 0] } },
  ],
  // Held after as hand-posed for Mother Hubbard and Hans (the sizes it was made for); 'heldstand' (adaptive, standing) and 'heldalt' (seated) are the ones laid out in code for any pair.
  // (Held after is laid out in code, from the sizes of the pair; the hand-posed entries made for Mother Hubbard and Hans are kept below for reference. To pose it by hand, paste under held.)
  held: [],
  //   held: [
  //     { who: 'giver', beat: 'relaxed', bones: { upperArmL: [-22.9, -9.1, 41.1], forearmL: [-82.7, 91.3, -164.8], handL: [-32.3, -15, 8.9], upperArmR: [-42.3, 56, -27.5], forearmR: [-75.2, -83.6, 149.1], handR: [17, 22.5, 13.7] } },
  //     { who: 'subject', beat: 'base', bones: { neck: [23.5, -2.7, -3.4], clavL: [9.7, -39, -21.3], upperArmL: [-32.5, -23.5, 16.3], forearmL: [-9.5, -85.2, 52.7], handL: [-28.3, 50.5, -65.2], clavR: [7, 20, 11.2], upperArmR: [-49.2, 6.4, 15.6], forearmR: [-55.8, 98.5, -51.2], handR: [46.6, 3.2, 67.1] } },
  //   ],
  //   heldstand: [],

  // Editor-only base position ("Hips"): bent at the hips, arms forward; the game never offers it.
  // Editor-only base position ("Astride"): the lap scene, seated, with its own poses; the game never offers it.
  // Astride is laid out in code (setupAstride in scene.js: the hips, legs and the reach of the arms); these edits go on top, the same at every beat.
  astride: [
    { who: 'giver', beat: 'relaxed', bones: { upperArmL: [0, 0, 0], forearmL: [0, 0, 0], handL: [0, 0, 0], upperArmR: [0, 0, 0], forearmR: [0, 0, 0], handR: [0, 0, 0], fingersL: [0, 0, -48], fingersR: [0, 0, 16] } },
    { who: 'subject', beat: 'base', bones: { upperArmL: [-3, 0, -35], forearmL: [-20, 0, 0], handL: [0, 0, 0], upperArmR: [-3, 0, 35], forearmR: [-20, 0, 0], handR: [0, 0, 0], fingersL: [0, 0, -50.5], fingersR: [0, 0, 56.5] } },
  ],
  hips: [
    { who: 'giver', beat: 'contact', bones: { spine1: [-10.1, 0, 1], upperArmL: [0, 0, 0], forearmL: [0, 0, 0], handL: [0, 0, 0], upperArmR: [0, 0, 0], forearmR: [0, 0, 0], handR: [0, 0, 0], thighL: [3.3, -1, 5.7], shinL: [19.6, -10.7, -15.5], footL: [-24.9, 2.2, 0], thighR: [3.5, -0.3, -5.5], shinR: [20.9, -3.3, -4.8], footR: [-25.4, 5.3, 16.1], fingersR: [0, 0, 16] } },
    { who: 'subject', beat: 'contact', bones: { spine1: [-19.2, 0, -0.6], neck: [-54.2, -0.3, 0.8], upperArmL: [-75, 0, -30], forearmL: [-15, 0, 0], handL: [0, 0, 0], upperArmR: [-75, 0, 30], forearmR: [-15, 0, 0], handR: [0, 0, 0], thighL: [-78.8, -2.2, 1.4], shinL: [14.9, 0.1, -6.9], footL: [-17.3, -0.1, -3.1], thighR: [-79.1, -0.1, 7], shinR: [15.3, -1.6, -6.2], footR: [-18, 2, -3.9], fingersL: [0, 0, -114], fingersR: [0, 0, 105.5] } },
    { who: 'giver', beat: 'raised', bones: { spine1: [12, 0, 0], upperArmL: [0, 0, 0], forearmL: [0, 0, 0], handL: [0, 0, 0], upperArmR: [0, 0, 0], forearmR: [0, 0, 0], handR: [0, 0, 0], thighR: [-3.6, 2, -6.3], shinR: [-1.7, 3.5, -0.1], footR: [4.7, -1.6, 14.6] } },
    { who: 'subject', beat: 'base', bones: { clavL: [2.8, -5.1, 13], upperArmL: [-75, 0, -30], forearmL: [-15, 0, 0], handL: [0, 0, 0], clavR: [4.3, 7.6, -17.6], upperArmR: [-75, 0, 30], forearmR: [-15, 0, 0], handR: [0, 0, 0], fingersL: [0, 0, -93], fingersR: [0, 0, 88.5] } },
    { who: 'giver', beat: 'relaxed', bones: { thighR: [-1.5, 0.9, -6.1], shinR: [-2, -2.4, -0.3], footR: [2.9, 5.2, 14.8] } },
  ],
};
})(typeof window !== 'undefined' ? window : globalThis);
