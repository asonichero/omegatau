'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Ov = require('../js/edits.js');
const R = require('../js/rules.js');

test('designs merge key by key; arrays replace; null removes', () => {
  const base = { height: 160, outfit: { hair: 1, hairStyle: 'long' }, wardrobe: { top: { color: 2, sleeves: 1 } }, list: [1, 2] };
  const out = Ov.deepMerge(base, { height: 170, outfit: { hair: 9 }, wardrobe: { top: { sleeves: null } }, list: [3] });
  assert.deepEqual(out, { height: 170, outfit: { hair: 9, hairStyle: 'long' }, wardrobe: { top: { color: 2 } }, list: [3] });
  assert.equal(base.height, 160);   // the original is untouched
});

test('design text: trailing commas, 0x colours and "#rrggbb" strings are all read', () => {
  const d = Ov.parseDesign('{ "height": 171, "skin": 0xe9c6a5, "outfit": { "hair": "#5a1e12", }, }');
  assert.equal(d.skin, 0xe9c6a5); assert.equal(d.outfit.hair, 0x5a1e12); assert.equal(d.height, 171);
  assert.throws(() => Ov.parseDesign('not json'));
  assert.throws(() => Ov.parseDesign('{ nope }'));
});

const REPORT = `Starlight pose editor report, 2026-10-02 14:16
Conventions: bone rotations are the bone's local Euler angles in degrees [x, y, z], order YXZ, as in the engine's pose tables (degQ).

== Arm raised · Hairbrush ==
Over the case. Disciplinarian Aya, subject Kiko, palm angle 65%.
Disciplinarian:
  spine2: [2.1, -3.9, 0] → [10, -6, 1.5], turned 8.1°; local Δ [7.9, -2.1, 1.5]; scene = table
  upperArmR: [-120, 4, 30] → [-130, 6, 32], turned 10°; local Δ [-10, 2, 2]; table [-100, 0, 35] (the scene changes it)
Subject:
  neck: [-40, 0, 0] → [-48, 2, 0], turned 8°; local Δ [-8, 2, 0]; scene = table

== Contact (left) · Hairbrush ==
Over the case. Disciplinarian Aya, subject Kiko, palm angle 65%.
Subject:
  spine2: [-14, 0, 0] → [-20, 0, 1], turned 6°; local Δ [-6, 0, 1]; scene = table
`;
test('a pose-editor report becomes pose entries (the pose table value wins where the scene drives a bone)', () => {
  const { entries } = Ov.parsePoses(REPORT, { position: 'auto' });
  const find = (who, beat) => entries.find(e => e.position === 'case' && e.who === who && e.beat === beat);
  assert.deepEqual(find('giver', 'raised').bones, { spine2: [10, -6, 1.5], upperArmR: [-100, 0, 35] });
  assert.deepEqual(find('subject', 'base').bones, { neck: [-48, 2, 0] });
  assert.deepEqual(find('subject', 'contact').bones, { spine2: [-20, 0, 1] });
});

test('a report without "Over the case" is the lap, unless a position is given', () => {
  const r = REPORT.replace(/Over the case\. /g, '');
  assert.ok(Ov.parsePoses(r, { position: 'auto' }).entries.every(e => e.position === 'lap'));
  assert.ok(Ov.parsePoses(r, { position: 'chair' }).entries.every(e => e.position === 'chair'));
});

test('pose JSON: one entry, a list, or {subject, giver}', () => {
  const one = Ov.parsePoses('{"position":"head","who":"subject","beat":"contact","bones":{"neck":[-10,0,0]}}').entries;
  assert.equal(one.length, 1); assert.equal(one[0].beat, 'contact');
  const list = Ov.parsePoses('[{"position":"lap","who":"giver","beat":"Arm raised","bones":{"spine1":[1,2,3]}},{"position":"lap","who":"subject","bones":{"head":[0,0,5]}}]').entries;
  assert.deepEqual(list.map(e => [e.who, e.beat]), [['giver', 'raised'], ['subject', 'base']]);
  const both = Ov.parsePoses('{"position":"case","giver":{"spine1":[1,2,3]},"subject":{"head":[0,0,5]},"beat":"relaxed"}').entries;
  assert.equal(both.length, 2);
  assert.throws(() => Ov.parsePoses('{"position":"moon","who":"subject","bones":{}}'));
  assert.throws(() => Ov.parsePoses('{"position":"lap","who":"subject","bones":{"neck":[1,2]}}'), /three numbers/);
});

test('pose entries are grouped per position, the same slot merged, and reported the way js/poses.js holds them', () => {
  const entries = [
    { position: 'case', who: 'subject', beat: 'base', bones: { neck: [1, 2, 3] } },
    { position: 'case', who: 'subject', beat: 'base', bones: { head: [4, 5, 6] } },
    { position: 'lap', who: 'giver', beat: 'raised', bones: { spine1: [0, 0, 5] } },
  ];
  const g = Ov.groupPoses(entries);
  assert.equal(g.case.length, 1); assert.deepEqual(Object.keys(g.case[0].bones).sort(), ['head', 'neck']);
  const text = Ov.poseReport(entries);
  assert.match(text, /^lap: \[\n  \{ who: 'giver', beat: 'raised', bones: \{ spine1: \[0, 0, 5\] \} \},\n\],$/m);
  assert.match(text, /case: \[/);
  // the report is code the file can hold: evaluating it as an object literal gives back the entries
  const back = new Function('return {' + text.split('\n').filter(l => !l.startsWith('//')).join('\n') + '}')();
  assert.deepEqual(back.case, g.case); assert.deepEqual(back.lap, g.lap);
});

test('a design report names only what changed from the built-in design, in a form the design parser reads back', () => {
  const base = { height: 160, outfit: { hair: 0x5a1e12, hairStyle: 'long' }, wardrobe: { top: { color: 2, sleeves: 1 } } };
  const cur = { height: 170, outfit: { hair: 0x112233, hairStyle: 'long' }, wardrobe: { top: { color: 2 } } };
  const text = Ov.designReport('red', 'Red', base, cur);
  assert.match(text, /Design: Red \(red\)/);
  const patch = Ov.parseDesign(text.split('\n\n')[0].split('\n').slice(2).join('\n'));
  assert.deepEqual(patch, { height: 170, outfit: { hair: 0x112233 }, wardrobe: { top: { sleeves: null } } });
  assert.deepEqual(Ov.deepMerge(base, patch), cur);
  assert.match(Ov.designReport('red', 'Red', base, base), /No changes/);
});

test('asking for an implement: options follow the resident, replies are filled, only a first exchange counts', () => {
  const calm = { wil: 2, att: 3, res: 1, sat: 4, val: 4, com: 4 }, bitter = { wil: 4, att: 3, res: 6, sat: 3, val: 2, com: 3 };
  assert.deepEqual(R.fetchOptions(calm, 'switch').map(o => o.id), ['ask', 'tell', 'explain', 'checkin']);
  assert.deepEqual(R.fetchOptions(bitter, 'switch').map(o => o.id), ['ask', 'tell', 'self', 'checkin']);
  for (const s of [calm, bitter, { ...calm, wil: 7 }, { ...calm, com: 1, val: 3 }]) for (const o of R.fetchOptions(s, 'paddle')) {
    const t = R.fetchReply(o.id, s, 'jack', 'Ma\'am', 1.0); assert.ok(t && !/\{\w+\}/.test(t), o.id + ': ' + t);
  }
  assert.match(R.fetchReply('checkin', calm, 'red', 'Ma\'am', 1.2), /end of what I can take/);
  const g = { chars: { red: { stats: { ...calm, val: 3 }, carry: {} } }, roster: ['red'], collection: [], leftToday: [], cards: [], queue: [], cursor: 0, notices: [] };
  const r = R.applyFetch(g, 'red', 'ask'); assert.equal(g.chars.red.stats.val, 4); assert.equal(r.changes.length, 1);
  const g2 = { ...g, chars: { red: { stats: { ...bitter }, carry: {} } } };
  R.applyFetch(g2, 'red', 'self'); assert.equal(g2.chars.red.stats.val, 1);
});

test('a report names its position ("Position: chair."); the old "Over the case." still means the table', () => {
  const r = REPORT.replace(/Over the case\. /g, 'Position: chair. ');
  assert.ok(Ov.parsePoses(r, { position: 'auto' }).entries.every(e => e.position === 'chair'));
  assert.ok(Ov.parsePoses(REPORT.replace(/Over the case\. /g, 'Over the table. '), { position: 'auto' }).entries.every(e => e.position === 'case'));
});
