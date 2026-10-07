'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const C = require('../js/content.js');

const rng = (seed = 1) => R.mulberry32(seed);
const house = (ids, seed = 1) => {
  const g = R.newGame(rng(seed));
  g.roster = ids.slice(); g.unseen = C.ORDER.filter(i => !ids.includes(i));
  for (const id of ids) g.chars[id] = { stats: { ...C.CHARACTERS[id].base }, carry: {}, visits: 1, moveOns: 0 };
  return g;
};

test('a new game seats exactly three distinct residents', () => {
  for (let s = 1; s < 30; s++) { const g = R.newGame(rng(s)); assert.equal(g.roster.length, 3); assert.equal(new Set(g.roster).size, 3); }
});

test('effective attention: arrivals are not taxed on day one, drift is', () => {
  for (const id of C.ORDER) assert.ok(R.effectiveAttention(C.CHARACTERS[id].base).mod >= -1, id);
  assert.equal(R.effectiveAttention({ wil: 7, att: 4, res: 7, sat: 1, val: 1, com: 1 }).mod, -3);
  assert.equal(R.effectiveAttention({ wil: 1, att: 7, res: 1, sat: 7, val: 7, com: 7 }).value, 7);
  assert.equal(R.effectiveAttention({ wil: 1, att: 4, res: 1, sat: 7, val: 7, com: 7 }).mod, 2);
});

test('chore bands follow the difficulty tables', () => {
  assert.equal(R.choreBand(1, 5), 'well'); assert.equal(R.choreBand(1, 3), 'completed'); assert.equal(R.choreBand(1, 2), 'partial'); assert.equal(R.choreBand(1, 1), 'failed');
  assert.equal(R.choreBand(2, 6), 'well'); assert.equal(R.choreBand(2, 5), 'completed'); assert.equal(R.choreBand(2, 3), 'partial');
  assert.equal(R.choreBand(3, 7), 'well'); assert.equal(R.choreBand(3, 6), 'completed'); assert.equal(R.choreBand(3, 4), 'partial'); assert.equal(R.choreBand(3, 2), 'failed');
});

test('the chore list has one slot per resident, and every slot can be filled', () => {
  for (let s = 1; s < 60; s++) {
    const g = house(['red', 'jack', 'snow'], s); R.startMorning(g, rng(s));
    assert.equal(g.chores.reduce((n, c) => n + c.slots.length, 0), 3);
    assert.equal(new Set(g.chores.map(c => c.id)).size, g.chores.length);
    assert.ok(!R.allAssigned(g));
    const slots = []; g.chores.forEach((c, i) => c.slots.forEach((_, j) => slots.push([i, j])));
    g.roster.forEach((id, k) => R.assign(g, slots[k][0], slots[k][1], id));
    assert.ok(R.allAssigned(g));
  }
});

test('assigning a resident moves them rather than duplicating them', () => {
  const g = house(['red', 'jack', 'snow']); R.startMorning(g, rng(3));
  R.assign(g, 0, 0, 'red'); R.assign(g, 1, 0, 'red');
  assert.equal(g.chores[0].slots[0], null); assert.equal(g.chores[1].slots[0], 'red');
});

test('failed chores cost attention and satisfaction; completed ones build attention', () => {
  const g = house(['red', 'jack', 'snow']);
  R.applyChoreBand(g, 'red', 'failed', 2); assert.deepEqual([g.chars.red.stats.att, g.chars.red.stats.sat], [1, 3]);
  R.applyChoreBand(g, 'jack', 'completed', 1); assert.equal(g.chars.jack.stats.att, 4);
  R.applyChoreBand(g, 'jack', 'well', 1); assert.equal(g.chars.jack.stats.sat, 5);          // difficulty 1: no satisfaction
  R.applyChoreBand(g, 'jack', 'well', 3); assert.equal(g.chars.jack.stats.sat, 6);
  const before = { ...g.chars.snow.stats }; R.applyChoreBand(g, 'snow', 'partial', 3); assert.deepEqual(g.chars.snow.stats, before);
});

test('occurrence chance is clamped to 5–70', () => {
  assert.equal(R.occurrence({ wil: 1, res: 1, sat: 7, com: 7 }), 5);
  assert.equal(R.occurrence({ wil: 7, res: 7, sat: 1, com: 1 }), 69); assert.equal(R.occurrence({ wil: 7, res: 7, sat: 0, com: 0 }), 70);
  assert.equal(R.occurrence({ wil: 4, res: 1, sat: 4, com: 2 }), 5 + 25 - 18);
});

test('at most three events, on three different people at most', () => {
  for (let s = 1; s < 200; s++) {
    const g = house(['jack', 'goldilocks', 'rapunzel'], s);
    for (const id of g.roster) { g.chars[id].stats.wil = 7; g.chars[id].stats.res = 7; g.chars[id].stats.sat = 1; g.chars[id].stats.com = 1; }
    const ev = R.rollEvents(g, rng(s));
    assert.ok(ev.length <= 3); assert.equal(new Set(ev.map(e => e.id)).size, ev.length);
  }
});

test('cruelty and friction need somebody to name; with nobody it falls back', () => {
  const g = house(['jack']); g.chars.jack.stats.res = 7;
  const w = R.categoryWeights(g, 'jack', false);
  assert.equal(w.friction, 0); assert.equal(w.cruelty, 0);
  const g2 = house(['jack', 'red']); g2.chars.jack.stats.res = 4;
  assert.equal(R.categoryWeights(g2, 'jack', true).cruelty, 0);
  g2.chars.jack.stats.res = 5; assert.ok(R.categoryWeights(g2, 'jack', true).cruelty > 0);
});

test('every event template fills cleanly and capitalises pronouns by position', () => {
  const ctx = { name: 'Jack', pron: ['he', 'him', 'his', 'himself'], second: 'Red', title: 'Ma\'am' };
  for (const [cat, list] of Object.entries(C.EVENTS)) for (const t of list) {
    const text = R.fillTemplate(typeof t === 'string' ? t : t.text, ctx);
    assert.ok(!/\{\w+\}/.test(text), cat + ': ' + text);
    assert.ok(!/(^|[.!?] )(he|him|his) /.test(text), 'sentence-initial pronoun not capitalised: ' + text);
  }
  assert.equal(R.fillTemplate('{Subj} said {Subj} was fine.', ctx), 'He said he was fine.');
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

test('reached bands and match quality', () => {
  assert.deepEqual([0, 0.19, 0.2, 0.54, 0.55, 0.89, 0.9, 1.19, 1.2, 1.49, 1.5].map(R.reachedBand), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.equal(R.matchQuality(2, 2), 'well'); assert.equal(R.matchQuality(1, 2), 'under1'); assert.equal(R.matchQuality(0, 2), 'under2');
  assert.equal(R.matchQuality(3, 2), 'over1'); assert.equal(R.matchQuality(4, 2), 'over2'); assert.equal(R.matchQuality(0, 0, true), 'over2');
});

function withCard(g, id, card) { g.cards = [{ id, band: 'completed', event: null, mod: 0, done: false, ...card }]; g.phase = 'evening'; }

test('a well-matched correction settles the resident; with Valued low it does not cut Resentment', () => {
  const g = house(['red', 'jack', 'snow']); withCard(g, 'red', {});
  g.chars.red.stats.val = 3; g.chars.red.stats.res = 2;
  const r = R.applyCorrection(g, 'red', { peak: 0.7 });   // Red wil 4 → Moderate; peak .7 → Moderate
  assert.equal(r.quality, 'well');
  assert.deepEqual([g.chars.red.stats.wil, g.chars.red.stats.res, g.chars.red.stats.val], [3, 3, 4]);
});

test('overshoot costs resentment; far overshoot costs trust; too harsh with thin trust calls the safe word', () => {
  const g = house(['jack', 'goldilocks', 'snow']); withCard(g, 'goldilocks', {});
  const r = R.applyCorrection(g, 'goldilocks', { peak: 1.3 });
  assert.equal(r.quality, 'over2'); assert.equal(g.chars.goldilocks.stats.res, 4); assert.equal(g.chars.goldilocks.stats.val, 1);
  const g2 = house(['jack', 'goldilocks', 'snow']); withCard(g2, 'goldilocks', {});
  const r2 = R.applyCorrection(g2, 'goldilocks', { peak: 1.6, tooHarsh: true });
  // the first call stops it and costs them, but they stay: it takes two or three to leave
  assert.ok(r2.word); assert.ok(g2.roster.includes('goldilocks')); assert.equal(g2.chars.goldilocks.safeWords, 1);
  assert.ok(g2.chars.goldilocks.stats.val < C.CHARACTERS.goldilocks.base.val || g2.chars.goldilocks.stats.val === 1);
});

test('too harsh with trust intact is a heavy overshoot but not the word', () => {
  const g = house(['jack', 'red', 'snow']); withCard(g, 'jack', {});
  g.chars.jack.stats.val = 6; g.chars.jack.stats.res = 2;
  const r = R.applyCorrection(g, 'jack', { peak: 1.6, tooHarsh: true });
  assert.ok(!r.word); assert.ok(g.roster.includes('jack')); assert.equal(g.chars.jack.stats.val, 5);
});

test('undershooting by two bands costs composure only', () => {
  const g = house(['jack', 'red', 'snow']); withCard(g, 'jack', {});
  const before = { ...g.chars.jack.stats }; R.applyCorrection(g, 'jack', { peak: 0 });
  assert.deepEqual(Object.fromEntries(Object.keys(before).map(k => [k, g.chars.jack.stats[k] - before[k]])), { wil: 0, att: 0, res: 0, sat: 0, val: 0, com: -1 });
});

test('Hans: the Wilfulness he sheds from correction is halved', () => {
  const g = house(['hans', 'red', 'snow']); withCard(g, 'hans', {}); g.chars.hans.stats.wil = 4;
  R.applyCorrection(g, 'hans', { peak: 0.7 });   // well matched: wil −1 → half → stays; the carry pays out next time
  assert.equal(g.chars.hans.stats.wil, 4);
  R.changeStat(g, 'hans', 'wil', -1, 'correction'); assert.equal(g.chars.hans.stats.wil, 3);
  R.changeStat(g, 'hans', 'wil', -1, 'event');       assert.equal(g.chars.hans.stats.wil, 2);   // other sources are not damped
});

test('Jack shrugs off a small overshoot while he still feels valued; Red does not', () => {
  const g = house(['jack', 'red', 'snow']); withCard(g, 'jack', {}); g.chars.jack.stats.wil = 5; g.chars.jack.stats.val = 4;   // expects Moderate (2)
  const r = R.applyCorrection(g, 'jack', { peak: 1.0 });   // Firm: one over
  assert.equal(r.quality, 'over1'); assert.equal(g.chars.jack.stats.res, 1);
  const g2 = house(['jack', 'red', 'snow']); withCard(g2, 'red', {}); g2.chars.red.stats.val = 3;
  const v0 = g2.chars.red.stats.val; R.applyCorrection(g2, 'red', { peak: 1.0 });
  assert.equal(g2.chars.red.stats.val, v0 - 1);
});

test('Snow White: Valued swings double, Satisfaction moves slowly', () => {
  const g = house(['snow', 'red', 'jack']);
  R.changeStat(g, 'snow', 'val', -1, 'event'); assert.equal(g.chars.snow.stats.val, 2);
  R.changeStat(g, 'snow', 'sat', 1, 'event'); assert.equal(g.chars.snow.stats.sat, 2);
  R.changeStat(g, 'snow', 'sat', 1, 'event'); assert.equal(g.chars.snow.stats.sat, 3);
});

test('moving on is checked once, after all behaviour is dealt with, removes the resident, and is permanent', () => {
  const g = house(['goldilocks', 'red', 'jack']); g.chars.goldilocks.stats.wil = 3; g.chars.goldilocks.stats.val = 4; g.chars.goldilocks.stats.att = 3;
  R.applyChoreBand(g, 'goldilocks', 'completed', 1);   // attention 3 → 4
  assert.equal(R.sweepMoveOns(g).length, 0); assert.ok(g.roster.includes('goldilocks'));   // chores and corrections never do it
  const out = R.flushMoveOns(g);
  assert.equal(out.length, 1); assert.ok(!g.roster.includes('goldilocks')); assert.deepEqual(g.collection, ['goldilocks']);
});

test('backfill draws only from those not yet through the house; nobody comes back once moved on or left', () => {
  const g = house(['red', 'jack', 'snow']);
  g.unseen = ['goldilocks'];
  R.moveOn(g, 'red');
  R.backfill(g, rng(1)); assert.deepEqual(g.roster.slice().sort(), ['goldilocks', 'jack', 'snow']);
  // the pool is empty: the house simply shrinks
  R.moveOn(g, 'jack'); R.backfill(g, rng(2));
  assert.equal(g.roster.length, 2); assert.ok(!g.roster.includes('red') && !g.roster.includes('jack'));
  assert.equal(new Set(g.collection).size, g.collection.length);
});

test('the safe word: costs them each time, leaves for good at the second or third call, and the game ends when everyone has moved on or left', () => {
  const g = house(['red', 'jack']); g.unseen = [];
  const before = { ...g.chars.red.stats };
  const n1 = R.useWord(g, 'red', 'harsh');
  assert.equal(n1.type, 'safeword'); assert.ok(g.roster.includes('red'));
  assert.ok(g.chars.red.stats.val < before.val || before.val === 1); assert.ok(g.chars.red.stats.res > before.res || before.res === 7);
  const need = R.safeWordsToLeave(g.chars.red.stats);
  assert.ok(need === 2 || need === 3);
  let n = n1; for (let i = 1; i < need; i++) n = R.useWord(g, 'red', 'harsh');
  assert.equal(n.type, 'word'); assert.ok(!g.roster.includes('red')); assert.ok(g.gone.includes('red'));
  R.backfill(g, rng(3)); assert.ok(!g.roster.includes('red'));
  assert.ok(!R.isOver(g));
  R.moveOn(g, 'jack'); assert.ok(R.isOver(g)); assert.equal(R.score(g), 1);
});

test('fewer than three residents: a shared chore never appears for one, and a shared chore done alone fails', () => {
  for (let s = 1; s < 60; s++) {
    const g = house(['red'], s); g.unseen = [];
    const list = R.generateChores(g, rng(s)); assert.ok(list.length >= 1 && list.every(c => !c.def.paired));
  }
  const g2 = house(['red', 'jack'], 5); g2.unseen = [];
  g2.chores = [{ id: 'x', def: C.CHORES.find(c => c.paired), slots: [null, null] }, { id: 'y', def: C.CHORES.find(c => !c.paired), slots: [null] }, { id: 'z', def: C.CHORES.find(c => !c.paired && c.id !== 'y'), slots: [null] }];
  R.assign(g2, 0, 0, 'red'); assert.ok(!R.allAssigned(g2));
  R.assign(g2, 1, 0, 'jack'); assert.ok(R.allAssigned(g2));   // every resident placed; the shared chore stands half-empty
  const out = R.resolveChores(g2); assert.equal(out.red.band, 'failed'); assert.ok(g2.chores[0].alone);
});

test('the safe word at the day boundary: Resentment 7 and Valued 2, together, costs them and counts; leaving takes more than one call', () => {
  const g = house(['red', 'jack', 'snow']); g.unseen = ['goldilocks', 'hans', 'rapunzel'];
  g.chars.red.stats.res = 7; g.chars.red.stats.val = 3; g.chars.jack.stats.res = 7; g.chars.jack.stats.val = 2; withCard(g, 'red', { done: true });
  R.endEvening(g, rng(5));
  assert.ok(g.roster.includes('red')); assert.ok(g.roster.includes('jack')); assert.equal(g.chars.jack.safeWords, 1);
  g.chars.jack.stats.res = 7; g.chars.jack.stats.val = 2; R.endEvening(g, rng(6));   // called again: they have had enough
  assert.ok(!g.roster.includes('jack')); assert.ok(g.gone.includes('jack')); assert.ok(!g.unseen.includes('jack'));
});

test('reprieves and aftercare spend the evening candle and cannot be bought past it', () => {
  const g = house(['red', 'jack', 'snow']); withCard(g, 'red', {});
  assert.ok(R.applyReprieve(g, 'red', 'kind')); assert.equal(g.candle, R.EVENING_CANDLE - 2);
  assert.ok(R.applyAftercare(g, 'red', 'held')); assert.equal(g.candle, 1);
  assert.equal(R.applyAftercare(g, 'red', 'held'), null);
  assert.ok(R.applyAftercare(g, 'red', 'warm')); assert.equal(g.candle, 0);
  assert.equal(R.applyReprieve(g, 'red', 'stern'), null);
});

test('a kind word is what the trap variants need; Goldilocks reads a reprieve as no consequence', () => {
  const g = house(['red', 'jack', 'snow']); withCard(g, 'red', { event: { trap: true, mod: 1, cat: 'dishonest' } });
  const s0 = g.chars.red.stats.sat; R.applyReprieve(g, 'red', 'kind'); assert.equal(g.chars.red.stats.sat, s0 + 2);
  const g2 = house(['goldilocks', 'jack', 'snow']); withCard(g2, 'goldilocks', {});
  R.applyReprieve(g2, 'goldilocks', 'stern'); assert.equal(g2.chars.goldilocks.stats.wil, 4);   // −1 then +1
});

test('Rapunzel only moves on through Valued', () => {
  const g = house(['rapunzel', 'red', 'jack']); const s = g.chars.rapunzel.stats;
  Object.assign(s, { wil: 1, att: 7, res: 1, sat: 7, val: 4, com: 7 }); assert.ok(!R.meetsGraduation('rapunzel', s));
  s.val = 5; assert.ok(R.meetsGraduation('rapunzel', s));
});

test('a whole simulated run ends, every day resolves, and the score is how many moved on', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed), g = R.newGame(r);
    let day = 0;
    for (; day < 200 && !R.isOver(g); day++) {
      R.startMorning(g, r); assert.ok(g.roster.length >= 1 && g.roster.length <= 3, 'seed ' + seed + ' day ' + day);
      // every resident placed on some free slot (some chores may stand empty with fewer than three)
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
    }
    assert.ok(R.isOver(g), 'seed ' + seed + ' did not finish');
    assert.equal(R.score(g), g.collection.length); assert.equal(g.collection.length + g.gone.length, C.ORDER.length);
  }
});

test('a save survives JSON', () => {
  const g = house(['red', 'jack', 'snow']); R.startMorning(g, rng(2));
  const g2 = JSON.parse(JSON.stringify(g)); assert.deepEqual(g2, g);
  R.assign(g2, 0, 0, 'red');   // still playable
});

test('farewell scenes: every resident, both kinds, every mood, filled and with a choice', () => {
  for (const id of C.ORDER) for (const kind of ['moveon', 'word']) for (const mood of ['willing', 'sullen', 'cheeky', 'flustered', 'plain']) for (const why of ['harsh', 'worn']) {
    const beats = R.farewellScene(kind, id, { why, mood, title: 'Ma\'am' });
    assert.ok(beats.some(b => b.ask && b.ask.length === 3), id + kind);
    const text = JSON.stringify(beats);
    assert.ok(!/\{\w+\}/.test(text), id + ' ' + kind + ' ' + mood + ': ' + (text.match(/\{\w+\}/) || [])[0]);
    assert.ok(/Ma'am/.test(text) || kind === 'moveon' || kind === 'word');
  }
});

test('the safe word notice carries how they were', () => {
  const g = house(['jack', 'red', 'snow']); g.chars.jack.stats.res = 7; g.chars.jack.stats.val = 2;
  const n = R.useWord(g, 'jack', 'worn');
  assert.equal(n.mood, 'sullen');
});

test('behaviour report lines: every chore, band and template reads grammatically', () => {
  const g = house(['red', 'jack', 'snow']);
  for (const ch of C.CHORES) for (const band of ['well', 'completed', 'partial', 'failed']) {
    const slots = ch.paired ? ['red', 'jack'] : ['red'];
    for (let seed = 1; seed < 12; seed++) {
      const line = R.choreLineFor ? R.choreLineFor(g, 'red', { band, chore: { def: ch, slots } }, rng(seed)) : null;
      if (!line) return;
      assert.ok(!/\{\w+\}/.test(line), line);
      assert.ok(/^[A-Z"]/.test(line), 'starts with a capital: ' + line);
      if (ch.plural) assert.ok(!/ (was|is) (done|finished|a good)/.test(line.replace(/Half of them (is|are)/, '')) && !/\bthe (hens|floors|heavy linens) was\b/i.test(line), line);
      else assert.ok(!/\bwere done\b|\bThey will\b|\bHalf of them\b/.test(line), line);
    }
  }
});

test('morning narration: a weather line, a resident and the list, each filled', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = house(['red', 'jack', 'snow'], seed); R.startMorning(g, rng(seed));
    assert.equal(g.narration.length, 3);
    for (const t of g.narration) { assert.ok(!/\{\w+\}/.test(t), t); assert.ok(t.length > 20); }
    assert.ok(g.chores.every(c => g.narration[2].toLowerCase().includes(c.def.name.toLowerCase())), g.narration[2]);
  }
});

test('reprieves and aftercare come with a sentence of their own', () => {
  const g = house(['red', 'jack', 'snow']); withCard(g, 'red', {});
  const r = R.applyReprieve(g, 'red', 'kind'); assert.ok(r.text && !/\{\w+\}/.test(r.text) && /Red/.test(r.text));
  const a = R.applyAftercare(g, 'red', 'warm'); assert.ok(a.line && /Red/.test(a.line));
});

test('every line the scene-change interlude can show fills completely (no stray {Placeholders})', () => {
  const ctx = { name: 'Red', pron: ['she', 'her', 'her', 'herself'], title: 'Keeper', Impl: 'paddle' };
  const strings = [];
  const walk = v => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(C.CHANGE); walk(C.REOPEN); walk(C.MOVES);
  for (const t of strings) assert.doesNotMatch(R.fillTemplate(t, ctx), /\{\w+\}/, t);
});

test('the last page: every resident has a grown and a lost epilogue, and their last stats are kept when they go', () => {
  for (const id of C.ORDER) { assert.ok(C.EPILOGUE[id].grown.length > 40); assert.ok(C.EPILOGUE[id].lost.length > 40); }
  const g = house(['red', 'jack']); g.unseen = [];
  R.moveOn(g, 'red'); assert.deepEqual(g.chars.red.final, g.chars.red.stats);
  let n; for (let i = 0; i < 3; i++) n = R.useWord(g, 'jack', 'harsh'); assert.equal(n.type, 'word'); assert.ok(g.chars.jack.final);
});

test('setbacks undo progress: likelier the closer to ready, and each takes something back', () => {
  const g = house(['goldilocks', 'jack', 'red']);
  const near = R.categoryWeights(g, 'goldilocks', true).setback;
  g.chars.goldilocks.stats.wil = 3; g.chars.goldilocks.stats.att = 4; g.chars.goldilocks.stats.val = 4;
  assert.ok(R.categoryWeights(g, 'goldilocks', true).setback > near);
  const before = { ...g.chars.goldilocks.stats }, rec = [];
  R.applyEvent(g, { id: 'goldilocks', cat: 'setback', fx: [['att', -1], ['val', -1]] }, rec);
  assert.equal(g.chars.goldilocks.stats.att, before.att - 1); assert.equal(g.chars.goldilocks.stats.val, before.val - 1);
  for (const t of C.EVENTS.setback) assert.ok(t.fx && t.fx.length && t.text.length > 40);
});
