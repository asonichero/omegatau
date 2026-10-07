// Birchwood House — editor setup. The character viewer's UI (editor.html) works on S.PRESETS and S.ORDER; here they are replaced with
// the game's cast (the six residents, and the four looks the player can have), built the way the game builds them. The built-in design
// is kept apart so the editor's reports know what a change is a change from, and the furniture, pose edits and held hands of the game's own
// scene are exposed for the viewer's discipline scene to use.
(function () {
'use strict';
const S = window.Starlight, B = window.FairyShoeBodies, C = window.FairyShoeContent, SC = window.FairyShoeScene, Ed = window.FairyShoeEdits;

const builtIn = {};
for (const id of C.ORDER) builtIn[id] = B.BODIES[id]();
for (const [k, v] of Object.entries(B.KEEPERS)) { const m = v.make(); m.name = v.name; builtIn['keeper-' + k] = m; }
for (const k of Object.keys(S.PRESETS)) delete S.PRESETS[k];
S.ORDER.length = 0;
for (const [id, spec] of Object.entries(builtIn)) { S.PRESETS[id] = spec; S.ORDER.push(id); }

// The viewer's position ids are the engine's; the game (and js/poses.js) call 'knees' 'chair'.
const gamePos = p => p === 'knees' ? 'chair' : p;
window.EDITOR = {
  Ed, builtIn, gamePos,
  initial: id => S.clone(S.PRESETS[id]),
  cameraPose: (mode, scn) => SC.cameraPose(mode, { subject: scn.s, giver: scn.g }),
  seatTop: g => SC.chairSeatTop(g),
  // the game's own set-up of a discipline scene (see scene.js): the subject's hybrid skirt, then the furniture, the seat and the pose edits in js/poses.js
  // the game's own session (scene.js), given the editor's bodies
  session: (scene, opts, env) => SC.createSession(scene, { ...opts, position: gamePos(opts.position) }, env),
  tableau: (scene, kind, opts, env) => SC.createTableau(scene, kind, opts, env),
  tableaux: SC.TABLEAUX,
  hold: (s, plant) => SC.holdChairHands(s, plant),
};
})();
