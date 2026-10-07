'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const C = require('../js/content.js');

const rng = (seed = 1) => R.mulberry32(seed);
const house = (ids, seed = 1) => {
  const g = R.newGame(rng(seed));
  g.roster = ids.slice(); g.unseen = C.ORDER.filter(i => !ids.includes(i));
  for (const id of ids) g.chars[id] = { stats: { ...C.CHARACTERS[id].base }, carry: {}, visits: 1, moveOns: 0, grades: C.CHARACTERS[id].startGrades || 'On Track', nights: 5 };
  return g;
};

test('a new game seats Lila, Taylor and Jess (the memo’s three); random seating gives three distinct sisters', () => {
  const g = R.newGame(rng(1)); assert.deepEqual(g.roster, ['lila', 'taylor', 'jess']); assert.equal(g.title, 'Avery');
  assert.deepEqual(g.unseen.sort(), ['hannah', 'marcy', 'sloane']);
  for (let s = 1; s < 30; s++) { const r = R.newGame(rng(s), { random: true }); assert.equal(r.roster.length, 3); assert.equal(new Set(r.roster).size, 3); }
});

test('the cast is the six sisters, all adults, with the locked starting spreads', () => {
  assert.deepEqual(C.ORDER, ['lila', 'taylor', 'hannah', 'jess', 'marcy', 'sloane']);
  const spread = id => { const b = C.CHARACTERS[id].base; return [b.wil, b.att, b.res, b.sat, b.val, b.com]; };
  assert.deepEqual(spread('lila'), [3, 4, 2, 3, 2, 3]); assert.deepEqual(spread('taylor'), [2, 3, 4, 3, 3, 2]); assert.deepEqual(spread('hannah'), [2, 3, 1, 4, 4, 2]);
  assert.deepEqual(spread('jess'), [5, 3, 1, 5, 4, 3]); assert.deepEqual(spread('marcy'), [2, 4, 1, 4, 3, 1]); assert.deepEqual(spread('sloane'), [4, 3, 2, 4, 2, 1]);
  for (const id of C.ORDER) assert.ok(C.CHARACTERS[id].age >= 19, id);
});

test('the clearing thresholds are the spec’s', () => {
  const ok = (id, s, c) => R.meetsGraduation(id, { ...C.CHARACTERS[id].base, ...s }, c);
  assert.ok(ok('lila', { val: 5, wil: 2 })); assert.ok(!ok('lila', { val: 5, wil: 3 })); assert.ok(!ok('lila', { val: 4, wil: 2 }));
  assert.ok(ok('hannah', { com: 5, sat: 5 })); assert.ok(!ok('hannah', { com: 5, sat: 4 }));
  assert.ok(ok('jess', { wil: 3 })); assert.ok(!ok('jess', { wil: 4 }));
  assert.ok(ok('marcy', { com: 6 })); assert.ok(!ok('marcy', { com: 5 }));
  assert.ok(ok('sloane', { wil: 3, att: 4, val: 4 })); assert.ok(!ok('sloane', { wil: 3, att: 3, val: 4 }));
  // Taylor: Valued 5 AND not Failing on Grades (a hard gate); and nobody is Cleared before the minimum term
  assert.ok(ok('taylor', { val: 5 })); assert.ok(!ok('taylor', { val: 4 }));
  assert.ok(!ok('taylor', { val: 5 }, { grades: 'Failing', nights: 9 })); assert.ok(ok('taylor', { val: 5 }, { grades: 'At Risk', nights: 9 }));
  assert.ok(!ok('jess', { wil: 3 }, { grades: 'On Track', nights: R.MIN_NIGHTS - 1 })); assert.ok(ok('jess', { wil: 3 }, { grades: 'On Track', nights: R.MIN_NIGHTS }));
});

test('effective attention: arrivals are not taxed on day one, drift is, and being behind on Grades drags it down', () => {
  for (const id of C.ORDER) assert.ok(R.effectiveAttention(C.CHARACTERS[id].base).mod >= -1, id);
  assert.equal(R.effectiveAttention({ wil: 7, att: 4, res: 7, sat: 1, val: 1, com: 1 }).mod, -3);
  assert.equal(R.effectiveAttention({ wil: 1, att: 7, res: 1, sat: 7, val: 7, com: 7 }).value, 7);
  assert.equal(R.effectiveAttention({ wil: 1, att: 4, res: 1, sat: 7, val: 7, com: 7 }).mod, 2);
  const b = C.CHARACTERS.hannah.base;
  assert.equal(R.effectiveAttention(b, 'At Risk').value, R.effectiveAttention(b, 'On Track').value - 1);
  assert.equal(R.effectiveAttention(b, 'Failing').value, R.effectiveAttention(b, 'On Track').value - 2);
});

test('duty bands follow the difficulty tables', () => {
  assert.equal(R.choreBand(1, 5), 'well'); assert.equal(R.choreBand(1, 3), 'completed'); assert.equal(R.choreBand(1, 2), 'partial'); assert.equal(R.choreBand(1, 1), 'failed');
  assert.equal(R.choreBand(2, 6), 'well'); assert.equal(R.choreBand(2, 5), 'completed'); assert.equal(R.choreBand(2, 3), 'partial');
  assert.equal(R.choreBand(3, 7), 'well'); assert.equal(R.choreBand(3, 6), 'completed'); assert.equal(R.choreBand(3, 4), 'partial'); assert.equal(R.choreBand(3, 2), 'failed');
});

test('the duty pool is the spec’s: ten solo, three paired, Study Hours leaning on Satisfaction', () => {
  assert.equal(C.CHORES.filter(c => !c.paired).length, 10); assert.equal(C.CHORES.filter(c => c.paired).length, 3);
  assert.deepEqual(C.CHORES.filter(c => !c.paired).map(c => c.diff), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
  assert.equal(C.CHORES.find(c => c.id === 'study').sec, 'sat');
  const g = house(['hannah', 'jess', 'lila']); const def = C.CHORES.find(c => c.id === 'study');
  const base = R.dutyEffective(g, 'hannah', { diff: 2 }); g.chars.hannah.stats.sat = 6; assert.equal(R.dutyEffective(g, 'hannah', def), Math.min(7, R.dutyEffective(g, 'hannah', { diff: 2 }) + 1));
  g.chars.hannah.stats.sat = 2; assert.ok(R.dutyEffective(g, 'hannah', def) <= R.dutyEffective(g, 'hannah', { diff: 2 }));
  void base;
});

test('the duty list has one slot per sister, and every slot can be filled', () => {
  for (let s = 1; s < 60; s++) {
    const g = house(['lila', 'taylor', 'jess'], s); R.startMorning(g, rng(s));
    assert.equal(g.chores.reduce((n, c) => n + c.slots.length, 0), 3);
    assert.equal(new Set(g.chores.map(c => c.id)).size, g.chores.length);
    assert.ok(!R.allAssigned(g));
    const slots = []; g.chores.forEach((c, i) => c.slots.forEach((_, j) => slots.push([i, j])));
    g.roster.forEach((id, k) => R.assign(g, slots[k][0], slots[k][1], id));
    assert.ok(R.allAssigned(g));
  }
});

test('assigning a sister moves her rather than duplicating her', () => {
  const g = house(['lila', 'taylor', 'jess']); R.startMorning(g, rng(3));
  R.assign(g, 0, 0, 'lila'); R.assign(g, 1, 0, 'lila');
  assert.equal(g.chores[0].slots[0], null); assert.equal(g.chores[1].slots[0], 'lila');
});

test('failed duties cost attention and satisfaction; completed ones build attention', () => {
  const g = house(['lila', 'jess', 'hannah']);
  R.applyChoreBand(g, 'lila', 'failed', 2); assert.deepEqual([g.chars.lila.stats.att, g.chars.lila.stats.sat], [3, 2]);
  R.applyChoreBand(g, 'jess', 'completed', 1); assert.equal(g.chars.jess.stats.att, 4);
  R.applyChoreBand(g, 'jess', 'well', 1); assert.equal(g.chars.jess.stats.sat, 5);          // difficulty 1: no satisfaction
  R.applyChoreBand(g, 'jess', 'well', 3); assert.equal(g.chars.jess.stats.sat, 6);
  const before = { ...g.chars.hannah.stats }; R.applyChoreBand(g, 'hannah', 'partial', 3); assert.deepEqual(g.chars.hannah.stats, before);
});

test('Grades: Study Hours lifts her two states when she does it at all, and costs her when she does not', () => {
  const study = C.CHORES.find(c => c.id === 'study');
  const g = house(['taylor', 'jess', 'lila']);
  for (const id of g.roster) Object.assign(g.chars[id].stats, { att: 7, wil: 1, res: 1, sat: 7, val: 7, com: 7 });
  g.chars.taylor.grades = 'Failing';
  g.chores = [{ id: 'study', def: study, slots: ['taylor'] }];
  R.resolveChores(g); assert.equal(g.chars.taylor.grades, 'On Track');
  const g2 = house(['taylor', 'jess', 'lila']);
  Object.assign(g2.chars.taylor.stats, { att: 1, wil: 7, res: 7, sat: 1, val: 1, com: 4 });
  g2.chars.taylor.grades = 'At Risk'; g2.chores = [{ id: 'study', def: study, slots: ['taylor'] }];
  const sat0 = g2.chars.taylor.stats.sat, com0 = g2.chars.taylor.stats.com;
  R.resolveChores(g2); assert.equal(g2.chars.taylor.grades, 'Failing');
  assert.ok(g2.chars.taylor.stats.com < com0 || com0 === 1); assert.ok(g2.chars.taylor.stats.sat <= sat0);
});

test('slipping on Grades costs Satisfaction (and Composure at Failing); there is nowhere further down than Failing', () => {
  const g = house(['taylor', 'jess', 'lila']); const s = g.chars.taylor.stats, sat0 = s.sat, com0 = s.com;
  g.chars.taylor.grades = 'On Track'; assert.equal(R.nudgeGrades(g, 'taylor', -1), -1); assert.equal(g.chars.taylor.grades, 'At Risk'); assert.equal(s.sat, sat0 - 1); assert.equal(s.com, com0);
  R.nudgeGrades(g, 'taylor', -1); assert.equal(g.chars.taylor.grades, 'Failing'); assert.equal(s.com, com0 - 1);
  assert.equal(R.nudgeGrades(g, 'taylor', -1), 0); assert.equal(g.chars.taylor.grades, 'Failing');
  assert.equal(R.nudgeGrades(g, 'taylor', 2), 2); assert.equal(g.chars.taylor.grades, 'On Track');
});

test('occurrence chance is clamped to 5–70', () => {
  assert.equal(R.occurrence({ wil: 1, res: 1, sat: 7, com: 7 }), 5);
  assert.equal(R.occurrence({ wil: 7, res: 7, sat: 1, com: 1 }), 69); assert.equal(R.occurrence({ wil: 7, res: 7, sat: 0, com: 0 }), 70);
  assert.equal(R.occurrence({ wil: 4, res: 1, sat: 4, com: 2 }), 5 + 25 - 18);
});

test('Late Report: 10 + (Wil + Res)×4 − (Com + Sat)×2, clamped to 5–60', () => {
  assert.equal(R.lateChance({ wil: 3, res: 2, com: 3, sat: 3 }), 10 + 20 - 12);
  assert.equal(R.lateChance({ wil: 1, res: 1, com: 7, sat: 7 }), 5); assert.equal(R.lateChance({ wil: 7, res: 7, com: 1, sat: 1 }), 60);
  for (const id of C.ORDER) { const p = R.lateChance(C.CHARACTERS[id].base); assert.ok(p >= 5 && p <= 60); }
});

test('the time on a post: late is 10:00 PM or after; otherwise an ordinary evening time', () => {
  for (let i = 0; i < 300; i++) {
    const r = rng(i + 1), late = R.timeString(true, r), ok = R.timeString(false, r);
    assert.match(late, /^(10|11|12|1?\d):\d\d (PM|AM)$/); assert.ok(/^(10|11):\d\d PM$|^12:[0-2]\d AM$/.test(late), late);
    assert.ok(/^(8:(1[5-9]|[2-5]\d)|9:[0-5]\d) PM$/.test(ok), ok);
  }
});

test('at most three events, on three different people at most', () => {
  for (let s = 1; s < 200; s++) {
    const g = house(['jess', 'sloane', 'taylor'], s);
    for (const id of g.roster) { g.chars[id].stats.wil = 7; g.chars[id].stats.res = 7; g.chars[id].stats.sat = 1; g.chars[id].stats.com = 1; }
    const ev = R.rollEvents(g, rng(s));
    assert.ok(ev.length <= 3); assert.equal(new Set(ev.map(e => e.id)).size, ev.length);
  }
});

test('cruelty and friction need somebody to name; with nobody it falls back', () => {
  const g = house(['jess']); g.chars.jess.stats.res = 7;
  const w = R.categoryWeights(g, 'jess', false);
  assert.equal(w.friction, 0); assert.equal(w.cruelty, 0);
  const g2 = house(['jess', 'lila']); g2.chars.jess.stats.res = 4;
  assert.equal(R.categoryWeights(g2, 'jess', true).cruelty, 0);
  g2.chars.jess.stats.res = 5; assert.ok(R.categoryWeights(g2, 'jess', true).cruelty > 0);
});

test('Taylor drifts toward concealment and withdrawal; Jess toward mischief and boundaries', () => {
  const g = house(['taylor', 'jess', 'lila']);
  const t = R.categoryWeights(g, 'taylor', true), l = R.categoryWeights(g, 'lila', true);
  assert.ok(t.dishonest > 2 * l.dishonest * 0.9); assert.ok(t.neglect > l.neglect);
  const j = R.categoryWeights(g, 'jess', true); assert.ok(j.petty > 30);
});

test('every event template fills cleanly (post and the president’s note) and capitalises pronouns by position', () => {
  const ctx = { name: 'Jess', pron: ['she', 'her', 'her', 'herself'], second: 'Lila', title: 'Avery' };
  for (const [cat, list] of Object.entries(C.EVENTS)) {
    assert.ok(list.length >= 5, cat);
    for (const t of list) {
      assert.ok(t.post && t.truth, cat + ': needs a post and a truth');
      for (const text of [R.fillTemplate(t.post, ctx), R.fillTemplate(t.truth, ctx)]) {
        assert.ok(!/\{\w+\}/.test(text), cat + ': ' + text);
        assert.ok(!/(^|[.!?] )(she|her) /.test(text), 'sentence-initial pronoun not capitalised: ' + text);
      }
      if (t.only) assert.ok(C.CHARACTERS[t.only], t.only);
      if (cat === 'setback') assert.ok(t.fx && t.fx.length);
    }
  }
  for (const id of C.ORDER) assert.ok(Object.values(C.EVENTS).some(l => l.some(t => t.only === id)), id + ' has her own events');
  assert.equal(R.fillTemplate('{Subj} said {Subj} was fine.', ctx), 'She said she was fine.');
});

test('trap events: the ones that call for a gentle hand exist, and each sister’s own traps are hers', () => {
  const traps = Object.values(C.EVENTS).flat().filter(t => t.trap);
  assert.ok(traps.length >= 6);
  assert.ok(traps.some(t => t.only === 'taylor')); assert.ok(traps.some(t => t.only === 'lila'));
  for (const t of traps) assert.ok(/^[^.]*/.test(t.post) && t.truth.length > 30);
});

test('the situational modifier stacks and caps at +2', () => {
  assert.equal(R.situationalModifier({ band: 'completed', event: null }), 0);
  assert.equal(R.situationalModifier({ band: 'partial', event: null }), 1);
  assert.equal(R.situationalModifier({ band: 'failed', event: { mod: 1 } }), 2);
  assert.equal(R.situationalModifier({ band: 'failed', event: { mod: 2 } }), 2);
  assert.equal(R.situationalModifier({ band: 'completed', event: { mod: 1 } }), 1);
});

test('expected band follows Wilfulness, shifts up with trouble, saturates at Severe; traps want a gentle hand', () => {
  const at = (wil, mod, ev) => R.expectedBand({ wil }, { mod, event: ev || null });
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(w => at(w, 0)), [0, 1, 1, 2, 2, 3, 3]);
  assert.equal(at(4, 1), 3); assert.equal(at(7, 1), 4); assert.equal(at(7, 2), 4);
  assert.equal(at(7, 2, { trap: true }), 0);
});

test('a late post is a silent +1; what she withheld or misreported is a band per two points, up to two; all of it is capped', () => {
  const at = (wil, card) => R.expectedBand({ wil }, { mod: 0, event: null, ...card });
  assert.equal(at(4, {}), 2); assert.equal(at(4, { late: true }), 3);
  const disc = penalty => ({ disclosure: { penalty, notes: [] } });
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(p => R.disclosureBands(disc(p))), [0, 1, 1, 2, 2, 2]);
  assert.equal(at(2, disc(1)), 2); assert.equal(at(2, disc(3)), 3); assert.equal(at(2, disc(2)), 2);
  assert.equal(at(1, { mod: 2, late: true, ...disc(4) }), 3);    // +3 at most on top of Wilfulness 1 → band 0 + 3
  assert.equal(at(7, { mod: 2, late: true, ...disc(4) }), 4);    // and nothing past Severe
  assert.equal(R.expectedBand({ wil: 7 }, { mod: 2, late: true, event: { trap: true }, ...disc(4) }), 0);   // a trap still wants the gentle answer
});

test('reached bands and match quality', () => {
  assert.deepEqual([0, 0.19, 0.2, 0.54, 0.55, 0.89, 0.9, 1.19, 1.2, 1.49, 1.5].map(R.reachedBand), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.equal(R.matchQuality(2, 2), 'well'); assert.equal(R.matchQuality(1, 2), 'under1'); assert.equal(R.matchQuality(0, 2), 'under2');
  assert.equal(R.matchQuality(3, 2), 'over1'); assert.equal(R.matchQuality(4, 2), 'over2'); assert.equal(R.matchQuality(0, 0, true), 'over2');
  assert.deepEqual(['well', 'under1', 'under2', 'over1', 'over2'].map(R.qualityKey), ['well', 'under', 'under', 'over', 'over']);
});

function withCard(g, id, card) { g.cards = [{ id, band: 'completed', event: null, mod: 0, done: false, register: 'routine', disclosure: { penalty: 0, notes: [] }, ...card }]; g.phase = 'evening'; }

test('a well-matched correction settles the sister; with Valued low it does not cut Resentment', () => {
  const g = house(['lila', 'jess', 'hannah']); withCard(g, 'lila', {});
  g.chars.lila.stats.val = 3; g.chars.lila.stats.res = 2;
  const r = R.applyCorrection(g, 'lila', { peak: 0.4 });   // Lila wil 3 → Light; peak .4 → Light
  assert.equal(r.quality, 'well');
  assert.deepEqual([g.chars.lila.stats.wil, g.chars.lila.stats.res, g.chars.lila.stats.val], [2, 3, 4]);
  assert.equal(g.lastNight.length, 1); assert.equal(g.lastNight[0].qkey, 'well');
});

test('overshoot costs resentment; far overshoot costs trust; too harsh with thin trust calls the safe word', () => {
  const g = house(['jess', 'sloane', 'hannah']); withCard(g, 'sloane', {});
  const r = R.applyCorrection(g, 'sloane', { peak: 1.3 });
  assert.equal(r.quality, 'over2'); assert.equal(g.chars.sloane.stats.res, 4); assert.equal(g.chars.sloane.stats.val, 1);
  const g2 = house(['jess', 'sloane', 'hannah']); withCard(g2, 'sloane', {});
  const r2 = R.applyCorrection(g2, 'sloane', { peak: 1.6, tooHarsh: true });
  // the first call stops it and costs her, but she stays: it takes two or three to leave
  assert.ok(r2.word); assert.ok(g2.roster.includes('sloane')); assert.equal(g2.chars.sloane.safeWords, 1);
  assert.ok(g2.chars.sloane.stats.val < C.CHARACTERS.sloane.base.val || g2.chars.sloane.stats.val === 1);
  assert.equal(g2.lastNight.length, 0);   // (no report line for a correction that ended in the word)
});

test('too harsh with trust intact is a heavy overshoot but not the word', () => {
  const g = house(['jess', 'lila', 'hannah']); withCard(g, 'jess', {});
  g.chars.jess.stats.val = 6; g.chars.jess.stats.res = 2;
  const r = R.applyCorrection(g, 'jess', { peak: 1.6, tooHarsh: true });
  assert.ok(!r.word); assert.ok(g.roster.includes('jess')); assert.equal(g.chars.jess.stats.val, 5);
});

test('undershooting by two bands costs composure only', () => {
  const g = house(['jess', 'lila', 'hannah']); withCard(g, 'jess', {});
  const before = { ...g.chars.jess.stats }; R.applyCorrection(g, 'jess', { peak: 0 });
  assert.deepEqual(Object.fromEntries(Object.keys(before).map(k => [k, g.chars.jess.stats[k] - before[k]])), { wil: 0, att: 0, res: 0, sat: 0, val: 0, com: -1 });
});

test('Marcy: the Wilfulness she sheds from correction is halved', () => {
  const g = house(['marcy', 'lila', 'hannah']); withCard(g, 'marcy', {}); g.chars.marcy.stats.wil = 4;
  R.applyCorrection(g, 'marcy', { peak: 0.7 });   // well matched: wil −1 → half → stays; the carry pays out next time
  assert.equal(g.chars.marcy.stats.wil, 4);
  R.changeStat(g, 'marcy', 'wil', -1, 'correction'); assert.equal(g.chars.marcy.stats.wil, 3);
  R.changeStat(g, 'marcy', 'wil', -1, 'event');       assert.equal(g.chars.marcy.stats.wil, 2);   // other sources are not damped
});

test('Jess shrugs off a small overshoot while she still feels valued; Lila reads it as proof', () => {
  const g = house(['jess', 'lila', 'hannah']); withCard(g, 'jess', {}); g.chars.jess.stats.wil = 5; g.chars.jess.stats.val = 4;   // expects Moderate (2)
  const r = R.applyCorrection(g, 'jess', { peak: 1.0 });   // Firm: one over
  assert.equal(r.quality, 'over1'); assert.equal(g.chars.jess.stats.res, 1);
  const g2 = house(['jess', 'lila', 'hannah']); withCard(g2, 'lila', {}); g2.chars.lila.stats.val = 3;
  const v0 = g2.chars.lila.stats.val; R.applyCorrection(g2, 'lila', { peak: 0.7 });   // Moderate: one over a Light need
  assert.equal(g2.chars.lila.stats.val, v0 - 1);
});

test('Hannah: Valued swings double, Satisfaction moves slowly', () => {
  const g = house(['hannah', 'lila', 'jess']);
  R.changeStat(g, 'hannah', 'val', -1, 'event'); assert.equal(g.chars.hannah.stats.val, 2);
  R.changeStat(g, 'hannah', 'sat', 1, 'event'); assert.equal(g.chars.hannah.stats.sat, 4);
  R.changeStat(g, 'hannah', 'sat', 1, 'event'); assert.equal(g.chars.hannah.stats.sat, 5);
});

test('Being Cleared is checked once, after all behaviour is dealt with, removes the sister, is permanent, and is announced', () => {
  const g = house(['jess', 'lila', 'taylor']); g.chars.jess.stats.wil = 3;
  assert.equal(R.sweepMoveOns(g).length, 0); assert.ok(g.roster.includes('jess'));   // duties and corrections never do it
  const out = R.flushMoveOns(g);
  assert.equal(out.length, 1); assert.ok(!g.roster.includes('jess')); assert.deepEqual(g.collection, ['jess']);
  assert.deepEqual(g.stateChanges, [{ type: 'cleared', id: 'jess' }]);
});

test('nobody is Cleared before serving the minimum term', () => {
  const g = house(['jess', 'lila', 'taylor']); g.chars.jess.stats.wil = 3; g.chars.jess.nights = R.MIN_NIGHTS - 1;
  assert.equal(R.flushMoveOns(g).length, 0); g.chars.jess.nights = R.MIN_NIGHTS; assert.equal(R.flushMoveOns(g).length, 1);
});

test('backfill draws only from those not yet through the house; nobody comes back once cleared or gone', () => {
  const g = house(['lila', 'jess', 'hannah']);
  g.unseen = ['marcy'];
  R.moveOn(g, 'lila');
  R.backfill(g, rng(1)); assert.deepEqual(g.roster.slice().sort(), ['hannah', 'jess', 'marcy']);
  assert.ok(g.stateChanges.some(c => c.type === 'assign' && c.id === 'marcy'));
  // the pool is empty: the house simply shrinks
  R.moveOn(g, 'jess'); R.backfill(g, rng(2));
  assert.equal(g.roster.length, 2); assert.ok(!g.roster.includes('lila') && !g.roster.includes('jess'));
  assert.equal(new Set(g.collection).size, g.collection.length);
});

test('the safe word: costs her each time, she requests a new Big at the second or third call, and the game ends when everyone is cleared or gone', () => {
  const g = house(['lila', 'jess']); g.unseen = [];
  const before = { ...g.chars.lila.stats };
  const n1 = R.useWord(g, 'lila', 'harsh');
  assert.equal(n1.type, 'safeword'); assert.ok(g.roster.includes('lila'));
  assert.ok(g.chars.lila.stats.val < before.val || before.val === 1); assert.ok(g.chars.lila.stats.res > before.res || before.res === 7);
  const need = R.safeWordsToLeave(g.chars.lila.stats);
  assert.ok(need === 2 || need === 3);
  let n = n1; for (let i = 1; i < need; i++) n = R.useWord(g, 'lila', 'harsh');
  assert.equal(n.type, 'word'); assert.ok(!g.roster.includes('lila')); assert.ok(g.gone.includes('lila'));
  assert.ok(g.stateChanges.some(c => c.type === 'transfer' && c.id === 'lila'));
  R.backfill(g, rng(3)); assert.ok(!g.roster.includes('lila'));
  assert.ok(!R.isOver(g));
  R.moveOn(g, 'jess'); assert.ok(R.isOver(g)); assert.equal(R.score(g), 1);
});

test('fewer than three sisters: a shared duty never appears for one, and a shared duty done alone fails', () => {
  for (let s = 1; s < 60; s++) {
    const g = house(['lila'], s); g.unseen = [];
    const list = R.generateChores(g, rng(s)); assert.ok(list.length >= 1 && list.every(c => !c.def.paired));
  }
  const g2 = house(['lila', 'jess'], 5); g2.unseen = [];
  g2.chores = [{ id: 'x', def: C.CHORES.find(c => c.paired), slots: [null, null] }, { id: 'y', def: C.CHORES.find(c => !c.paired), slots: [null] }, { id: 'z', def: C.CHORES.find(c => !c.paired && c.id !== 'y'), slots: [null] }];
  R.assign(g2, 0, 0, 'lila'); assert.ok(!R.allAssigned(g2));
  R.assign(g2, 1, 0, 'jess'); assert.ok(R.allAssigned(g2));   // every sister placed; the shared duty stands half-empty
  const out = R.resolveChores(g2); assert.equal(out.lila.band, 'failed'); assert.ok(g2.chores[0].alone);
});

test('the safe word at the day boundary: Resentment 7 and Valued 2, together, costs her and counts; leaving takes more than one call', () => {
  const g = house(['lila', 'jess', 'taylor']); g.unseen = ['hannah', 'marcy', 'sloane'];
  g.chars.lila.stats.res = 7; g.chars.lila.stats.val = 3; g.chars.jess.stats.res = 7; g.chars.jess.stats.val = 2; withCard(g, 'lila', { done: true });
  R.endEvening(g, rng(5));
  assert.ok(g.roster.includes('lila')); assert.ok(g.roster.includes('jess')); assert.equal(g.chars.jess.safeWords, 1);
  g.chars.jess.stats.res = 7; g.chars.jess.stats.val = 2; R.endEvening(g, rng(6));   // called again: she has had enough
  assert.ok(!g.roster.includes('jess')); assert.ok(g.gone.includes('jess')); assert.ok(!g.unseen.includes('jess'));
});

test('reprieves and aftercare spend the evening candle and cannot be bought past it', () => {
  const g = house(['lila', 'jess', 'hannah']); withCard(g, 'lila', {});
  assert.ok(R.applyReprieve(g, 'lila', 'kind')); assert.equal(g.candle, R.EVENING_CANDLE - 2);
  assert.ok(R.applyAftercare(g, 'lila', 'held')); assert.equal(g.candle, 1);
  assert.equal(R.applyAftercare(g, 'lila', 'held'), null);
  assert.ok(R.applyAftercare(g, 'lila', 'warm')); assert.equal(g.candle, 0);
  assert.equal(R.applyReprieve(g, 'lila', 'stern'), null);
  assert.equal(g.cards[0].sent.after, 'warm');
});

test('a kind word is what the trap variants need; a reprieve early on reads as no consequence to Sloane', () => {
  const g = house(['lila', 'jess', 'hannah']); withCard(g, 'lila', { register: 'trouble', event: { trap: true, mod: 1, cat: 'dishonest' } });
  const s0 = g.chars.lila.stats.sat; const r = R.applyReprieve(g, 'lila', 'kind'); assert.equal(g.chars.lila.stats.sat, s0 + 2); assert.ok(r.earned);
  const g2 = house(['sloane', 'jess', 'hannah']); withCard(g2, 'sloane', { register: 'trouble', event: { mod: 1, cat: 'boundary' } });
  const r2 = R.applyReprieve(g2, 'sloane', 'stern'); assert.equal(g2.chars.sloane.stats.wil, 4); assert.ok(!r2.earned);   // −1 then +1
  const g3 = house(['sloane', 'jess', 'hannah']); g3.chars.sloane.stats.wil = 3; withCard(g3, 'sloane', {});
  R.applyReprieve(g3, 'sloane', 'stern'); assert.equal(g3.chars.sloane.stats.wil, 2);   // below 4 she takes it
});

test('a Written Reflection also gets her back to her work: Grades up a state', () => {
  const g = house(['taylor', 'jess', 'hannah']); withCard(g, 'taylor', {});
  assert.equal(g.chars.taylor.grades, 'At Risk'); R.applyReprieve(g, 'taylor', 'reflection'); assert.equal(g.chars.taylor.grades, 'On Track');
});

test('Taylor only clears through Valued, and not while Failing', () => {
  const g = house(['taylor', 'lila', 'jess']); const s = g.chars.taylor.stats;
  Object.assign(s, { wil: 1, att: 7, res: 1, sat: 7, val: 4, com: 7 }); assert.ok(!R.meetsGraduation('taylor', s, g.chars.taylor));
  s.val = 5; assert.ok(R.meetsGraduation('taylor', s, g.chars.taylor));
  g.chars.taylor.grades = 'Failing'; assert.ok(!R.meetsGraduation('taylor', s, g.chars.taylor)); assert.equal(R.flushMoveOns(g).length, 0);
});

test('every night’s posts: a time, an opener that names her, a closer, her own words for the duty, and the truth about any event', () => {
  let late = 0, events = 0, concealed = 0, falseDuty = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const r = rng(seed), g = R.newGame(r);
    R.startMorning(g, r);
    for (const id of g.roster) for (let i = 0; i < g.chores.length; i++) { const j = g.chores[i].slots.indexOf(null); if (j >= 0) { R.assign(g, i, j, id); break; } }
    R.resolveDay(g, r);
    assert.equal(g.cards.length, 3);
    for (const c of g.cards) {
      const name = C.CHARACTERS[c.id].name;
      assert.ok(c.opener.includes(name), c.opener); assert.ok(C.CLOSERS.includes(c.closer)); assert.ok(!/\{\w+\}/.test(c.opener + c.choreLine));
      assert.equal(/^(10|11):\d\d PM$|^12:[0-2]\d AM$/.test(c.time), c.late, c.time + ' ' + c.late);
      assert.ok(['trouble', 'routine'].includes(c.register)); assert.equal(c.register === 'trouble', !!c.event || c.band === 'partial' || c.band === 'failed');
      assert.ok(c.disclosure.penalty >= 0 && Array.isArray(c.disclosure.notes));
      assert.equal(c.disclosure.penalty, c.disclosure.notes.reduce((n, x) => n + x.pts, 0));
      if (c.band === 'completed' || c.band === 'well') assert.equal(c.dutyState, 'honest');
      if (c.dutyState === 'false') { falseDuty++; assert.ok(c.dutyClaim && !/\{\w+\}/.test(c.dutyClaim)); }
      if (c.grades === 'On Track') assert.ok(c.gradeState !== 'false'); else assert.ok(c.gradeLine);
      if (c.event) { events++; assert.ok(c.event.post && c.event.truth.includes(name) || c.event.truth.length > 20); if (c.event.concealed) { concealed++; assert.ok(c.event.cover); } if (c.event.night === 'late') assert.ok(c.late); if (c.event.night === 'early') assert.ok(!c.late); }
      if (c.late) late++;
    }
  }
  assert.ok(late > 10 && events > 20 && concealed > 3 && falseDuty > 0, [late, events, concealed, falseDuty].join());
});

test('what she says about the duty: every duty and band reads cleanly, paired ones name the partner, shared duties alone say so', () => {
  const ctx = { name: 'Lila', pron: ['she', 'her', 'her', 'herself'], title: 'Avery' };
  for (const ch of C.CHORES) for (const band of ['well', 'completed', 'partial', 'failed']) {
    const line = R.dutyPost({ def: ch, alone: false }, band, 'Jess', rng(1), ctx);
    assert.ok(!/\{\w+\}/.test(line), line); assert.equal(/Jess/.test(line), !!ch.paired, ch.id + band + ': ' + line);
  }
  for (const ch of C.CHORES.filter(c => c.paired)) assert.ok(!/\{\w+\}/.test(R.dutyPost({ def: ch, alone: true }, 'failed', '', rng(2), ctx)));
});

test('the president: one line per sister, by how it went; Cleared and reprieve cases have banks of their own; a sister who left has no line', () => {
  const g = house(['lila', 'jess', 'taylor']);
  g.lastNight = [
    { id: 'lila', kind: 'correction', quality: 'well', qkey: 'well' }, { id: 'jess', kind: 'correction', quality: 'over1', qkey: 'over' },
    { id: 'taylor', kind: 'reprieve', reprieve: 'kind', earned: false }, { id: 'hannah', kind: 'reprieve', reprieve: 'stern', earned: true }, { id: 'marcy', kind: 'correction', quality: 'under1', qkey: 'under' },
  ];
  g.gone = ['marcy']; g.stateChanges = [{ type: 'cleared', id: 'lila' }];
  const lines = R.presidentLines(g, rng(4));
  assert.deepEqual(lines.map(l => l.id), ['lila', 'jess', 'taylor', 'hannah']);
  assert.ok(C.PRES_FEEDBACK.cleared.some(t => R.fillTemplate(t, { name: 'Lila', title: 'Avery' }) === lines[0].text));
  assert.ok(C.PRES_FEEDBACK.over.some(t => R.fillTemplate(t, { name: 'Jess', title: 'Avery' }) === lines[1].text));
  for (const l of lines) assert.ok(!/\{\w+\}/.test(l.text) && l.text.includes(C.CHARACTERS[l.id].name), l.text);
  for (const bank of Object.values(C.PRES_FEEDBACK)) for (const t of bank) assert.ok(t.includes('{Name}'), t);
});

test('the day turns: after an evening the president comes first, and the board is dealt behind him; clearing it opens the board', () => {
  const g = house(['lila', 'jess', 'taylor']); R.startMorning(g, rng(1)); assert.equal(g.phase, 'assign');
  g.lastNight = [{ id: 'lila', kind: 'correction', quality: 'well', qkey: 'well' }]; g.stateChanges = [{ type: 'assign', id: 'hannah' }];
  R.startMorning(g, rng(2)); assert.equal(g.phase, 'president'); assert.equal(g.chores.length > 0, true);
  R.clearPresident(g); assert.equal(g.phase, 'assign'); assert.deepEqual(g.lastNight, []); assert.deepEqual(g.stateChanges, []);
});

test('a whole simulated run ends, every day resolves, and the score is how many were cleared', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed), g = R.newGame(r);
    let day = 0;
    for (; day < 300 && !R.isOver(g); day++) {
      R.startMorning(g, r); assert.ok(g.roster.length >= 1 && g.roster.length <= 3, 'seed ' + seed + ' day ' + day);
      R.clearPresident(g);
      // every sister placed on some free slot (some duties may stand empty with fewer than three)
      for (const id of R.shuffle(r, g.roster)) { for (let i = 0; i < g.chores.length; i++) { const j = g.chores[i].slots.indexOf(null); if (j >= 0) { R.assign(g, i, j, id); break; } } }
      assert.ok(R.allAssigned(g), 'seed ' + seed + ' day ' + day);
      R.resolveDay(g, r);
      for (const card of R.pendingCards(g).slice()) {
        if (!g.roster.includes(card.id)) continue;
        const roll = r();
        if (roll < 0.15) R.applyReprieve(g, card.id, ['stern', 'kind', 'reflection'][Math.floor(r() * 3)]);
        else R.applyCorrection(g, card.id, { peak: r() * 1.7, tooHarsh: r() < 0.1 });
        if (g.roster.includes(card.id) && r() < 0.5) R.applyAftercare(g, card.id, ['corner', 'lines', 'held', 'warm'][Math.floor(r() * 4)]);
      }
      R.endEvening(g, r);
      for (const id of g.roster) for (const k2 of C.STATS) assert.ok(g.chars[id].stats[k2] >= 1 && g.chars[id].stats[k2] <= 7);
      assert.equal(new Set(g.collection).size, g.collection.length);
      R.presidentLines(g, r);
    }
    assert.ok(R.isOver(g), 'seed ' + seed + ' did not finish');
    assert.equal(R.score(g), g.collection.length); assert.equal(g.collection.length + g.gone.length, C.ORDER.length);
  }
});

test('a save survives JSON, mid-evening too', () => {
  const g = house(['lila', 'jess', 'taylor']); R.startMorning(g, rng(2));
  const g2 = JSON.parse(JSON.stringify(g)); assert.deepEqual(g2, g);
  R.assign(g2, 0, 0, 'lila');   // still playable
  const r = rng(3); for (const id of g2.roster) for (let i = 0; i < g2.chores.length; i++) { const j = g2.chores[i].slots.indexOf(null); if (j >= 0) { R.assign(g2, i, j, id); break; } }
  R.resolveDay(g2, r); R.recordSent(g2, 'lila', { message: 'hello', kind: 'correction' });
  const g3 = JSON.parse(JSON.stringify(g2)); assert.deepEqual(g3, g2); assert.equal(g3.cards.find(c => c.id === 'lila').sent.message, 'hello');
});

test('farewell scenes: every sister, both kinds, every mood, filled and with a choice', () => {
  for (const id of C.ORDER) for (const kind of ['moveon', 'word']) for (const mood of ['willing', 'sullen', 'cheeky', 'flustered', 'plain']) for (const why of ['harsh', 'worn']) {
    const beats = R.farewellScene(kind, id, { why, mood, title: 'Avery' });
    assert.ok(beats.some(b => b.ask && b.ask.length === 3), id + kind);
    const text = JSON.stringify(beats);
    assert.ok(!/\{\w+\}/.test(text), id + ' ' + kind + ' ' + mood + ': ' + (text.match(/\{\w+\}/) || [])[0]);
  }
});

test('the safe word notice carries how she was', () => {
  const g = house(['jess', 'lila', 'taylor']); g.chars.jess.stats.res = 7; g.chars.jess.stats.val = 2;
  const n = R.useWord(g, 'jess', 'worn');
  assert.equal(n.mood, 'sullen');
});

test('reprieves and aftercare come with a sentence of their own', () => {
  const g = house(['lila', 'jess', 'hannah']); withCard(g, 'lila', {});
  const r = R.applyReprieve(g, 'lila', 'kind'); assert.ok(r.text && !/\{\w+\}/.test(r.text) && /Lila/.test(r.text));
  const a = R.applyAftercare(g, 'lila', 'warm'); assert.ok(a.line && /Lila/.test(a.line));
});

test('every line the scene-change interlude and the aftercare scenes can show fills completely (no stray {Placeholders})', () => {
  const ctx = { name: 'Lila', pron: ['she', 'her', 'her', 'herself'], title: 'Avery', Impl: 'paddle' };
  const strings = [];
  const walk = v => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(C.CHANGE); walk(C.REOPEN); walk(C.AFTER_SCENES); walk(C.AFTER_NARR); walk(C.RESULT_LINES); walk(C.SAYINGS);
  for (const t of strings) assert.doesNotMatch(R.fillTemplate(t, ctx), /\{\w+\}/, t);
});

test('the message: openers, clauses and reprieve lines are all there, and the composer’s starting points are valid indices', () => {
  for (const id of C.ORDER) for (const k of ['trouble', 'routine']) assert.ok(C.OWN_OPENERS[id][k].length >= 1, id + k);
  for (const t of [...C.TROUBLE_OPENERS, ...C.ROUTINE_OPENERS, ...Object.values(C.OWN_OPENERS).flatMap(o => [...o.trouble, ...o.routine])]) assert.ok(t.includes('{Name}'), t);
  assert.deepEqual(Object.keys(C.IMPLEMENT_CLAUSE), ['hand', 'hairbrush', 'pingpong', 'ownpaddle', 'housepaddle']);
  assert.equal(C.CHANGE_CLAUSE, 'Change into something to sleep in.');
  assert.equal(C.CLOSERS.length, 3);
  for (const k of Object.keys(C.REPRIEVES)) assert.ok(C.REPRIEVE_LINES[k].length >= 3, k);
  for (const k of Object.keys(C.AFTERCARE)) assert.ok(C.AFTER_CLAUSE[k], k);
  for (const v of Object.values(C.SEVERITY)) assert.ok(v.strength >= 0 && v.strength <= 5 && v.clause);
  for (const v of Object.values(C.LENGTH)) assert.ok(v.pace >= 0 && v.pace <= 7 && v.run >= 0 && v.run <= 6 && v.clause);
  assert.equal(C.CLOTHING.clothed.layers.bottoms, false); assert.equal(C.CLOTHING.bared.layers.briefs, true); assert.equal(C.CLOTHING.baseline.clause, null);
});

test('the last page: every sister has a grown and a lost epilogue, and her last stats are kept when she goes', () => {
  for (const id of C.ORDER) { assert.ok(C.EPILOGUE[id].grown.length > 40); assert.ok(C.EPILOGUE[id].lost.length > 40); assert.ok(C.CHARACTERS[id].story.length > 80); assert.ok(C.CHARACTERS[id].file.length > 30); }
  const g = house(['lila', 'jess']); g.unseen = [];
  R.moveOn(g, 'lila'); assert.deepEqual(g.chars.lila.final, g.chars.lila.stats);
  let n; for (let i = 0; i < 3; i++) n = R.useWord(g, 'jess', 'harsh'); assert.equal(n.type, 'word'); assert.ok(g.chars.jess.final);
});

test('setbacks undo progress: likelier the closer to ready, and each takes something back', () => {
  const g = house(['lila', 'jess', 'hannah']);
  const near = R.categoryWeights(g, 'lila', true).setback;
  g.chars.lila.stats.wil = 2; g.chars.lila.stats.val = 5;
  assert.ok(R.categoryWeights(g, 'lila', true).setback > near);
  const before = { ...g.chars.lila.stats }, rec = [];
  R.applyEvent(g, { id: 'lila', cat: 'setback', fx: [['att', -1], ['val', -1]] }, rec);
  assert.equal(g.chars.lila.stats.att, before.att - 1); assert.equal(g.chars.lila.stats.val, before.val - 1);
});

test('self-neglect costs Attention too, and slips her Grades; a boundary test costs Wilfulness', () => {
  const g = house(['hannah', 'jess', 'lila']); const s = g.chars.hannah.stats, before = { ...s };
  R.applyEvent(g, { id: 'hannah', cat: 'neglect' });
  assert.equal(s.att, before.att - 1); assert.ok(s.com < before.com); assert.ok(s.sat < before.sat); assert.equal(g.chars.hannah.grades, 'At Risk');
  const j = g.chars.jess.stats.wil; R.applyEvent(g, { id: 'jess', cat: 'boundary' }); assert.equal(g.chars.jess.stats.wil, j + 1);
});
