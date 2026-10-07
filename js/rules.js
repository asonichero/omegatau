// ΩΤΚ Companion — rules. Pure functions over a plain-JSON game state (so it saves and tests cleanly).
//
// Day: Morning (the president's response, then the duty board: assign sisters) → resolution (duties, events, late reports, what each sister says) →
// Evening (a post for each sister: a direct message that is a live correction, or a reprieve; then aftercare) → the Probation Report → day boundary
// (the safe word, backfill) → Morning. (The code keeps its first name for the pieces: a "chore" is a duty, a "resident" a sister, "moving on" is being Cleared.)
//
// The correction itself is live (see scene.js); this module only scores what the player actually did: the highest
// distress they brought her to, whether it tipped into too harsh, against what she needed that evening.
(function (root) {
'use strict';
const C = typeof require === 'function' && typeof module !== 'undefined' ? require('./content.js') : root.OtkContent;
const { STATS, CHARACTERS, ORDER, CHORES, CATEGORIES } = C;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HOUSE_SIZE = 3;
const EVENING_CANDLE = 5;          // marks to spend on reprieves and aftercare each evening
const MAX_EVENTS = 3;              // at most this many events per evening
const MIN_NIGHTS = 3;              // nights on Probation before anyone can be Cleared (so a sister who starts a point off her threshold is not out on the first night)

// ── Random ──────────────────────────────────────────────────────
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(rng, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weighted(rng, items) {   // items: [[value, weight], ...]
  const total = items.reduce((s, [, w]) => s + w, 0); if (total <= 0) return null;
  let r = rng() * total;
  for (const [v, w] of items) { if ((r -= w) < 0) return v; }
  return items[items.length - 1][0];
}

// ── State ───────────────────────────────────────────────────────
const cloneStats = s => ({ ...s });
function freshChar(id) { return { stats: cloneStats(CHARACTERS[id].base), carry: {}, visits: 0, moveOns: 0, safeWords: 0, grades: CHARACTERS[id].startGrades || 'On Track', nights: 0 }; }
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const getRapport = (g, a, b) => g.rapport[pairKey(a, b)] != null ? g.rapport[pairKey(a, b)] : 4;
const addRapport = (g, a, b, d) => { g.rapport[pairKey(a, b)] = clamp(getRapport(g, a, b) + d, 1, 7); };
const stats = (g, id) => g.chars[id].stats;

// The three on the opening memo are always Lila, Taylor and Jess (opts.random: whoever the pool gives, for tests).
function newGame(rng, opts = {}) {
  const g = {
    v: 2, day: 0, title: opts.title || 'Avery', phase: 'new', rapport: {},
    chars: Object.fromEntries(ORDER.map(id => [id, freshChar(id)])),
    roster: [], unseen: ORDER.slice(), collection: [], gone: [],
    chores: [], cards: [], queue: [], cursor: 0, candle: EVENING_CANDLE, notices: [], leftToday: [], history: [], lastNight: [], stateChanges: [],
  };
  if (!opts.random) { g.roster = C.FIRST_THREE.slice(); g.unseen = ORDER.filter(id => !g.roster.includes(id)); for (const id of g.roster) g.chars[id].visits = 1; }
  else backfill(g, rng, true);
  g.notices = [];
  return g;
}

// ── Effective Attention ─────────────────────────────────────────
// All six stats bear on whether work gets done. Pivots sit at the extremes (above 5, below 3); penalty and bonus are each
// floored, then netted and clamped to −3…+2.
// Grades (On Track / At Risk / Failing) are a drag on all of it while she is behind: distracted, not sleeping, not on top of things.
const GRADE_ORDER = ['Failing', 'At Risk', 'On Track'];
const gradeMod = grades => grades === 'Failing' ? -2 : grades === 'At Risk' ? -1 : 0;
function effectiveAttention(s, grades) {
  const pen = Math.max(0, s.wil - 5) * 0.5 + Math.max(0, 3 - s.com) * 0.5 + Math.max(0, s.res - 5) * 0.4 + Math.max(0, 3 - s.sat) * 0.4 + Math.max(0, 3 - s.val) * 0.3;
  const bon = Math.max(0, s.com - 5) * 0.5 + Math.max(0, s.sat - 5) * 0.4 + Math.max(0, s.val - 5) * 0.3;
  const mod = clamp(Math.floor(bon + 1e-9) - Math.floor(pen + 1e-9), -3, 2) + gradeMod(grades);
  return { mod, value: clamp(s.att + mod, 1, 7) };
}

// ── Changing a stat ─────────────────────────────────────────────
// Every change goes through here so that a character's traits bend it, it clamps to 1–7, and it is recorded for the
// result card. `src` names where it came from ('chore', 'event', 'correction', 'overshoot1', 'aftercare', 'reprieve').
function changeStat(g, id, stat, delta, src, rec) {
  const c = g.chars[id]; if (!c || !delta) return 0;
  let d = delta;
  for (const t of CHARACTERS[id].traits || []) {
    if (t.stat !== stat) continue;
    if (t.sources && !t.sources.includes(src)) continue;
    if (t.when && !Object.entries(t.when).every(([k, [op, v]]) => op === '>=' ? c.stats[k] >= v : c.stats[k] <= v)) continue;
    if (t.factor === 0) { d = 0; break; }
    if (t.factor < 1) {   // sluggish: a fraction builds up and pays out whole
      const v = d * t.factor + (c.carry[stat] || 0), whole = v > 0 ? Math.floor(v + 1e-9) : Math.ceil(v - 1e-9);
      c.carry[stat] = v - whole; d = whole || 0;
    } else d = Math.round(d * t.factor);
  }
  const from = c.stats[stat], to = clamp(from + d, 1, 7);
  c.stats[stat] = to;
  if (rec && to !== from) rec.push({ id, stat, from, to });
  return to - from;
}

// ── Graduation and the word ─────────────────────────────────────
const cmp = (v, op, t) => op === '>=' ? v >= t : v <= t;
// Being Cleared: every threshold holds at once (and, for Taylor, she is not Failing on Grades); with her character state to hand, she has also served the minimum term.
const meetsGraduation = (id, s, c) => CHARACTERS[id].grad.every(([k, op, t]) => cmp(s[k], op, t)) && (!CHARACTERS[id].gradeOk || !c || c.grades !== 'Failing') && (!c || (c.nights || 0) >= MIN_NIGHTS);
// Resentment at the ceiling and Valued on the floor, together: they call the safe word.
const wordCalled = s => s.res >= 7 && s.val <= 2;   // (in the house's words: she requests a new Big)
// The safe word is "Red". Every use stops the correction and costs them for real; it takes this many to leave the house for good (fewer when they are already past patience).
const SAFE_WORD = 'Red';
const safeWordsToLeave = s => s.res >= 6 ? 2 : 3;

function leave(g, id) { g.roster = g.roster.filter(r => r !== id); g.cards = g.cards.filter(c => c.id !== id); g.queue = g.queue.filter(q => q !== id); if (g.cursor > g.queue.length) g.cursor = g.queue.length; g.leftToday.push(id); }
// Moved on or left: either way they are out of the pool for good; the house takes in whoever has not yet been through it.
function moveOn(g, id) {
  leave(g, id);
  g.chars[id].moveOns++; g.chars[id].final = { ...g.chars[id].stats };   // (their last state, for the last page)
  if (!g.collection.includes(id)) g.collection.push(id);   // unique, permanent
  const n = { type: 'moveon', id, text: CHARACTERS[id].name + ' has been cleared of Social Probation.' };
  g.notices.push(n); g.stateChanges.push({ type: 'cleared', id }); return n;
}
// The safe word is called: what they carry takes a real hit, and on the second or third time they pack up and go (and do not come back).
function useWord(g, id, why) {
  const mood = fetchMood(stats(g, id));   // how they were, for the goodbye
  const c = g.chars[id]; c.safeWords = (c.safeWords || 0) + 1;
  const need = safeWordsToLeave(c.stats), rec = [];
  const before = { ...c.stats };
  changeStat(g, id, 'val', -2, 'safeword', rec); changeStat(g, id, 'sat', -1, 'safeword', rec); changeStat(g, id, 'com', -1, 'safeword', rec); changeStat(g, id, 'res', 1, 'safeword', rec);
  if (c.safeWords >= need) {
    c.final = { ...c.stats };
    leave(g, id);
    if (!g.gone.includes(id)) g.gone.push(id);
    const n = { type: 'word', id, why, mood, count: c.safeWords, text: CHARACTERS[id].name + ' called the safe word and requested a new Big.' };
    g.notices.push(n); g.stateChanges.push({ type: 'transfer', id }); return n;
  }
  const n = { type: 'safeword', id, why, mood, count: c.safeWords, need, changes: rec, text: CHARACTERS[id].name + ' called the safe word.' };
  g.notices.push(n); return n;
}
// Nothing moves anyone on mid-day or mid-evening: chores, events, corrections and aftercare only change stats. Whether a resident is ready is checked once, after all
// the behaviour has been dealt with (flushMoveOns, at the end of the evening). (Kept so the callers read the same; it does nothing.)
function sweepMoveOns() { return []; }
function flushMoveOns(g) { return g.roster.filter(id => meetsGraduation(id, stats(g, id), g.chars[id])).map(id => moveOn(g, id)); }

// Refill to the house size from those who have not yet been through the house. Nobody comes back once they have moved on or left, so the house shrinks as the pool runs out.
function backfill(g, rng, silent) {
  const arrived = [];
  while (g.roster.length < HOUSE_SIZE) {
    const pool = g.unseen.filter(id => !g.roster.includes(id));
    if (!pool.length) break;
    const id = pick(rng, pool);
    g.unseen = g.unseen.filter(u => u !== id);
    g.chars[id] = { ...freshChar(id), visits: g.chars[id].visits + 1, moveOns: g.chars[id].moveOns };
    for (const o of ORDER) delete g.rapport[pairKey(id, o)];
    g.roster.push(id); arrived.push(id);
    if (!silent) { g.notices.push({ type: 'arrive', id, text: CHARACTERS[id].name + ' has been assigned to Social Probation.' }); g.stateChanges.push({ type: 'assign', id }); }
  }
  return arrived;
}
// The game is over when everyone has either moved on or left: the score is how many moved on.
const isOver = g => g.roster.length === 0 && g.unseen.filter(id => !g.roster.includes(id)).length === 0;
const score = g => g.collection.length;

// ── Morning: the duty list ──────────────────────────────────────
// A fresh list each morning with exactly one slot per sister; a paired duty takes two.
function generateChores(g, rng) {
  // One slot per sister; with fewer than three in the house the list keeps three slots' worth (the day ends when every sister is placed, not every slot), and with one sister nothing is shared.
  const n0 = g.roster.length, slots = n0 === 0 ? 0 : Math.max(n0, 3) - (n0 === 1 ? 1 : 0), list = [];
  let left = slots;
  const early = g.day <= 2;
  const solo = CHORES.filter(c => !c.paired), paired = CHORES.filter(c => c.paired);
  const used = new Set();
  const draw = pool => {
    const options = pool.filter(c => !used.has(c.id)).map(c => [c, c.diff === 1 ? 4 : c.diff === 2 ? 4 : early ? 0.6 : 2]);
    const c = weighted(rng, options); used.add(c.id); return c;
  };
  while (left > 0) {
    const wantPair = n0 >= 2 && left >= 2 && rng() < 0.4 && paired.some(c => !used.has(c.id));
    const def = draw(wantPair ? paired : solo);
    const n = def.paired ? 2 : 1;
    list.push({ id: def.id, def, slots: Array(n).fill(null) });
    left -= n;
  }
  return list;
}
// The new day. If there was an evening before it, the president's response comes first (phase 'president', until clearPresident); otherwise straight to the board.
function startMorning(g, rng) {
  g.day++; g.phase = g.lastNight && g.lastNight.length ? 'president' : 'assign'; g.leftToday = []; g.cards = []; g.queue = []; g.cursor = 0; g.candle = EVENING_CANDLE;
  g.chores = generateChores(g, rng);
  return g.chores;
}
function clearPresident(g) { g.lastNight = []; g.stateChanges = []; g.phase = 'assign'; }
function assign(g, choreIdx, slotIdx, id) {
  if (!g.roster.includes(id)) return false;
  for (const ch of g.chores) ch.slots = ch.slots.map(s => s === id ? null : s);
  const ch = g.chores[choreIdx]; if (!ch || slotIdx >= ch.slots.length) return false;
  ch.slots[slotIdx] = id; return true;
}
function unassign(g, id) { for (const ch of g.chores) ch.slots = ch.slots.map(s => s === id ? null : s); }
const allAssigned = g => g.roster.length > 0 && g.roster.every(id => g.chores.some(ch => ch.slots.includes(id)));   // (every sister placed; some duties may stand empty with fewer than three in the house)
const choreOf = (g, id) => g.chores.find(ch => ch.slots.includes(id));

// ── Duty resolution ─────────────────────────────────────────────
const THRESH = { 1: [5, 3, 2], 2: [6, 4, 2], 3: [7, 5, 3] };   // lowest effective Attention for well / completed / partial
function choreBand(diff, eff) {
  const [w, c, p] = THRESH[diff];
  return eff >= w ? 'well' : eff >= c ? 'completed' : eff >= p ? 'partial' : 'failed';
}
// How well she does a duty: her effective Attention (all six stats, and her Grades), plus the duty's own secondary stat where it has one (Study Hours: Satisfaction).
function dutyEffective(g, id, def) {
  const e = effectiveAttention(stats(g, id), g.chars[id].grades).value;
  let sec = 0; if (def && def.sec) { const v = stats(g, id)[def.sec]; sec = v >= 6 ? 1 : v <= 2 ? -1 : 0; }
  return clamp(e + sec, 1, 7);
}
function choreEffective(g, ch) {
  const effs = ch.slots.filter(Boolean).map(id => dutyEffective(g, id, ch.def));
  let v = Math.min(...effs), r = null;
  if (ch.slots.length === 2) { r = getRapport(g, ch.slots[0], ch.slots[1]); v = clamp(v + (r >= 6 ? 1 : r <= 2 ? -1 : 0), 1, 7); }
  return { eff: v, rapport: r };
}
function applyChoreBand(g, id, band, diff, rec) {
  if (band === 'well') { changeStat(g, id, 'att', 1, 'chore', rec); if (diff >= 2) changeStat(g, id, 'sat', 1, 'chore', rec); }
  else if (band === 'completed') changeStat(g, id, 'att', 1, 'chore', rec);
  else if (band === 'failed') { changeStat(g, id, 'sat', -1, 'chore', rec); changeStat(g, id, 'att', -1, 'chore', rec); }
}
// Grades are a three-state flag (On Track / At Risk / Failing): no pips, no deck, no maths of its own. Slipping costs her, in the stress and shame of falling behind.
function nudgeGrades(g, id, dir, rec) {
  const c = g.chars[id], before = GRADE_ORDER.indexOf(c.grades), after = clamp(before + dir, 0, 2);
  c.grades = GRADE_ORDER[after];
  if (after < before) { changeStat(g, id, 'sat', -1, 'grades', rec); if (c.grades === 'Failing') changeStat(g, id, 'com', -1, 'grades', rec); }
  return after - before;
}
function resolveChores(g) {
  const out = {};
  const study = (ch, who, band) => { if (ch.def.id === 'study') for (const id of who) nudgeGrades(g, id, band === 'well' || band === 'completed' ? 2 : -1); };   // (finishing Study Hours at all lifts her two states)
  for (const ch of g.chores) {
    const who = ch.slots.filter(Boolean); if (!who.length) continue;   // (nobody on it today)
    if (ch.def.paired && who.length < 2) { ch.band = 'failed'; ch.eff = 0; ch.alone = true; for (const id of who) { applyChoreBand(g, id, 'failed', ch.def.diff); out[id] = { chore: ch, band: 'failed' }; } continue; }   // a shared duty cannot be done alone
    const { eff } = choreEffective(g, ch), band = choreBand(ch.def.diff, eff);
    ch.band = band; ch.eff = eff;
    for (const id of who) { applyChoreBand(g, id, band, ch.def.diff); out[id] = { chore: ch, band }; }
    study(ch, who, band);
  }
  return out;
}

// ── Events ──────────────────────────────────────────────────────
const occurrence = s => clamp(5 + (s.wil + s.res) * 5 - (s.sat + s.com) * 3, 5, 70);
// Late Report: an independent roll per sister, every evening. It is a silent +1 on what she needs (and shows only as a late timestamp).
const lateChance = s => clamp(10 + (s.wil + s.res) * 4 - (s.com + s.sat) * 2, 5, 60);
// Whether she keeps something back tonight: the stats that mean "won't be straight with you", so concealment fades as Valued climbs.
const concealChance = s => clamp(30 + (s.wil + s.res) * 3 - (s.val + s.com) * 3, 5, 75);
function lowestRapport(g, id, rng) {
  const others = g.roster.filter(o => o !== id); if (!others.length) return null;
  const low = Math.min(...others.map(o => getRapport(g, id, o)));
  return pick(rng, others.filter(o => getRapport(g, id, o) === low));
}
function categoryWeights(g, id, hasSecond) {
  const s = stats(g, id), b = CHARACTERS[id].bias || {};
  const w = {
    petty: CATEGORIES.petty.share * (1 + Math.max(0, s.wil - 4) * 0.25) * (b.petty || 1),
    boundary: CATEGORIES.boundary.share * (1 + Math.max(0, s.wil - 4) * 0.35) * (b.boundary || 1),
    friction: CATEGORIES.friction.share * (1 + Math.max(0, s.res - 3) * 0.3) * (b.friction || 1),
    dishonest: CATEGORIES.dishonest.share * (b.dishonest || 1),
    neglect: CATEGORIES.neglect.share * (1 + Math.max(0, 3 - s.sat) * 0.6 + Math.max(0, 3 - s.com) * 0.5) * (b.neglect || 1),
    cruelty: s.res >= 5 ? CATEGORIES.cruelty.share * (s.res - 4) : 0,   // only at very high Resentment
    setback: CATEGORIES.setback.share * (0.6 + 0.9 * CHARACTERS[id].grad.filter(([k, op, t]) => cmp(s[k], op, t)).length),   // the closer to ready, the more there is to lose
  };
  if (!hasSecond) { w.friction = 0; w.cruelty = 0; }   // nobody to name: fall back to the rest (mischief most of all)
  return w;
}
function fillTemplate(text, ctx) {
  const P = ctx.pron || ['she', 'her', 'her', 'herself'], second = ctx.second || '';
  const map = { Name: ctx.name, Second: second, Title: ctx.title || '', Subj: P[0], Obj: P[1], Poss: P[2], Refl: P[3], Impl: ctx.Impl, Partner: ctx.partner, Duty: ctx.duty };
  let out = '';
  const re = /\{(\w+)\}/g; let last = 0, m;
  while ((m = re.exec(text))) {
    out += text.slice(last, m.index);
    let v = map[m[1]] != null ? map[m[1]] : m[0];
    if (['Subj', 'Obj', 'Poss', 'Refl'].includes(m[1])) {
      const before = out.replace(/["'“‘\s]+$/, '');
      v = !before || /[.!?]$/.test(before) ? v[0].toUpperCase() + v.slice(1) : v;
    }
    out += v; last = m.index + m[0].length;
  }
  return out + text.slice(last);
}
function makeEvent(g, id, rng) {
  const second = lowestRapport(g, id, rng);
  const cat = weighted(rng, Object.entries(categoryWeights(g, id, !!second)).filter(([, w]) => w > 0));
  const opts = C.EVENTS[cat].map(t => typeof t === 'string' ? { post: t, truth: t } : t).filter(t => !t.only || t.only === id);
  // A sister's own templates are favoured over the generic ones.
  const own = opts.filter(t => t.only === id);
  const t = own.length && rng() < 0.45 ? pick(rng, own) : pick(rng, opts);
  const def = CHARACTERS[id], ctx = { name: def.name, pron: def.pronouns, second: second ? CHARACTERS[second].name : '', title: g.title };
  const truth = fillTemplate(t.truth || t.post, ctx);
  return { id, cat, second, post: fillTemplate(t.post, ctx), truth, text: truth, cw: t.cw || null, trap: !!t.trap, night: t.night || null, fx: t.fx || null, mod: CATEGORIES[cat].mod };
}
function applyEvent(g, ev, rec) {
  const { id, second: sec, cat } = ev;
  if (cat === 'boundary') changeStat(g, id, 'wil', 1, 'event', rec);
  else if (cat === 'friction') { changeStat(g, id, 'res', 1, 'event', rec); changeStat(g, sec, 'res', 1, 'event', rec); addRapport(g, id, sec, -1); }
  else if (cat === 'dishonest') changeStat(g, id, 'val', -1, 'event', rec);
  else if (cat === 'setback') for (const [k, d] of (ev.fx || [['att', -1]])) changeStat(g, id, k, d, 'event', rec);
  else if (cat === 'neglect') { changeStat(g, id, 'sat', -1, 'event', rec); changeStat(g, id, 'com', -1, 'event', rec); changeStat(g, id, 'att', -1, 'event', rec); nudgeGrades(g, id, -1, rec); }
  else if (cat === 'cruelty') { changeStat(g, sec, 'res', 1, 'event', rec); changeStat(g, id, 'val', -1, 'event', rec); }
}
// Each sister rolls; the best margins take an event (on different people). A quiet evening is fine.
function rollEvents(g, rng) {
  const hits = g.roster.map(id => { const pct = occurrence(stats(g, id)), r = rng() * 100; return { id, margin: pct - r, hit: r < pct }; })
    .filter(h => h.hit).sort((a, b) => b.margin - a.margin).slice(0, MAX_EVENTS);
  return hits.map(h => makeEvent(g, h.id, rng));
}

// ── Posts: what each sister puts on the timeline tonight ──────────
const BAND_WORD = { well: 'completed well', completed: 'completed', partial: 'partial', failed: 'failed' };
// 10:00 PM or later is late (the only signal the player gets); otherwise an ordinary evening time.
function timeString(late, rng) {
  let t;
  if (late) t = 22 * 60 + Math.floor(rng() * 150);          // 10:00 PM – 12:29 AM
  else t = 20 * 60 + 15 + Math.floor(rng() * 100);          // 8:15 PM – 9:54 PM
  const h = Math.floor(t / 60) % 24, m = t % 60, hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
}
// What the duty looks like in her own words (a true line for the band; or the line for a shared duty with nobody to share it).
function dutyPost(ch, band, partnerName, rng, ctx) {
  if (ch.alone) return fillTemplate(pick(rng, C.ALONE_LINES), { ...ctx, duty: ch.def.phrase });
  const lines = C.DUTY_LINES[ch.def.id];
  return fillTemplate(lines[band], { ...ctx, partner: partnerName || '' });
}
// Situational modifier: duty trouble +1; an event its own; both on one post add a further +1; capped at +2.
function situationalModifier(card) {
  const trouble = card.band === 'partial' || card.band === 'failed';
  let m = 0;
  if (card.event) { m = card.event.mod; if (trouble) m += 1; } else if (trouble) m = 1;
  return Math.min(2, m);
}
// A withheld or false self-report means she has earned more than her Wilfulness alone calls for. Omitting something is 1, claiming something untrue is 2;
// every two points are one band (at most two bands).
const disclosureBands = card => Math.min(2, Math.ceil(((card && card.disclosure && card.disclosure.penalty) || 0) / 2));
function buildCards(g, entries, events, rng, lateFlags = {}) {
  g.cards = g.roster.map(id => {
    const e = entries[id], ev = events.find(x => x.id === id) || null, s = stats(g, id), def = CHARACTERS[id], c = g.chars[id];
    const band = e ? e.band : 'completed', ch = e ? e.chore : null;
    const partnerId = ch ? ch.slots.find(x => x && x !== id) : null, partnerName = partnerId ? CHARACTERS[partnerId].name : '';
    const trouble = band === 'partial' || band === 'failed';
    const ctx = { name: def.name, pron: def.pronouns, title: g.title };
    // The Late roll is independent of the event roll, which can otherwise put a "she was asleep by nine" event on a post stamped 10:13 PM:
    // where an event's content settles what time she was up, it overrides the roll.
    let late = !!lateFlags[id], lateForced = null;
    if (ev && ev.night === 'early' && late) { late = false; lateForced = 'early'; }
    else if (ev && ev.night === 'late' && !late) { late = true; lateForced = 'late'; }
    // What she owns up to tonight: each item is only checked when she has something to hide.
    const cc = concealChance(s), disc = { penalty: 0, notes: [], chance: cc };
    let dutyState = 'honest', dutyClaim = null;
    if (e && trouble && rng() * 100 < cc) {
      if (rng() < 0.5) { dutyState = 'omitted'; disc.penalty += 1; disc.notes.push({ what: 'duty', kind: 'omitted', pts: 1, text: BAND_WORD[band] + ' and didn’t say so' }); }
      else {
        dutyState = 'false'; disc.penalty += 2; disc.notes.push({ what: 'duty', kind: 'false', pts: 2, text: 'claimed she finished it — it was ' + BAND_WORD[band] });
        dutyClaim = ch.alone ? 'got ' + ch.def.phrase + ' done. no problems.' : fillTemplate(C.DUTY_LINES[ch.def.id].completed, { ...ctx, partner: partnerName });
      }
    }
    if (ev) {   // does she mention it at all?
      ev.concealed = rng() * 100 < cc;
      if (ev.concealed) { ev.cover = pick(rng, C.COVER_POSTS); disc.penalty += 1; disc.notes.push({ what: 'event', kind: 'omitted', pts: 1, text: 'said nothing about it' }); }
    }
    // Grades: below On Track she is required to report her standing every night, so she always posts a line and the only question is whether it is true.
    // On Track carries no obligation: she may mention it or not, with no penalty.
    let gradeLine = null, gradeState = 'none';
    if (c.grades !== 'On Track') {
      if (rng() * 100 < cc) { gradeState = 'false'; gradeLine = pick(rng, C.GRADE_FALSE); disc.penalty += 2; disc.notes.push({ what: 'grades', kind: 'false', pts: 2, text: 'claimed she’s fine — she’s ' + c.grades }); }
      else { gradeState = 'honest'; gradeLine = pick(rng, C.GRADE_LINES[c.grades]); }
    } else if (rng() < 0.4) { gradeState = 'honest'; gradeLine = pick(rng, C.GRADE_LINES['On Track']); }
    const register = (ev || trouble) ? 'trouble' : 'routine';
    const openerPool = (C.OWN_OPENERS[id] ? C.OWN_OPENERS[id][register] : []).concat(register === 'trouble' ? C.TROUBLE_OPENERS : C.ROUTINE_OPENERS);
    const card = { id, band, choreId: ch ? ch.def.id : '', choreName: ch ? ch.def.name : '', choreLine: e ? dutyPost(ch, band, partnerName, rng, ctx) : '', alone: !!(ch && ch.alone), event: ev,
      late, lateForced, time: timeString(late, rng), register, opener: fillTemplate(pick(rng, openerPool), ctx), closer: pick(rng, C.CLOSERS),
      disclosure: disc, dutyState, dutyClaim, gradeLine, gradeState, grades: c.grades, showDutyLine: !!e && (!ev || trouble), done: false, sent: null, result: null };
    card.mod = situationalModifier(card);
    return card;
  });
  g.queue = g.cards.map(c => c.id); g.cursor = 0;
}

// The whole of day resolution: duties → events → posts. Returns what happened.
function resolveDay(g, rng) {
  g.notices = [];
  const entries = resolveChores(g);
  const choreSnapshot = g.roster.map(id => ({ id, band: entries[id] ? entries[id].band : 'completed', chore: entries[id] ? entries[id].chore.def.name : '', eff: entries[id] ? entries[id].chore.eff : 0 }));
  sweepMoveOns(g);
  const lateFlags = {};   // (the Late roll is made off the stats before the evening's events)
  for (const id of g.roster) lateFlags[id] = rng() * 100 < lateChance(stats(g, id));
  const events = rollEvents(g, rng).filter(ev => g.roster.includes(ev.id) && (!ev.second || g.roster.includes(ev.second)));
  for (const ev of events) applyEvent(g, ev);
  sweepMoveOns(g);
  for (const id of g.roster) g.chars[id].nights = (g.chars[id].nights || 0) + 1;
  const live = events.filter(ev => g.roster.includes(ev.id));
  buildCards(g, entries, live, rng, lateFlags);
  g.phase = 'evening';
  return { chores: choreSnapshot, events: live, notices: g.notices.slice() };
}

// ── The correction ──────────────────────────────────────────────
const BANDS = ['Minimal', 'Light', 'Moderate', 'Firm', 'Severe'];
// What her Wilfulness asks for on its own; Severe is only reachable with a situational modifier on top.
const wilfulnessBand = w => w <= 1 ? 0 : w <= 3 ? 1 : w <= 5 ? 2 : 3;
// What she needs tonight. A trap (she is hiding that she is not fine) needs the gentle answer. Otherwise: her Wilfulness, plus what happened (the duty, an event),
// plus what she withheld or misreported, plus one more if she posted late; at most three bands on top, and nothing past Severe.
function extraBands(card) { return card ? Math.min(3, (card.mod || 0) + disclosureBands(card) + (card.late ? 1 : 0)) : 0; }
function expectedBand(s, card) {
  if (card && card.event && card.event.trap) return 0;   // the gentle answer is the right one
  return Math.min(4, wilfulnessBand(s.wil) + extraBands(card));
}
// Distress at its peak (1 = the edge of resistance, 1.5 = too harsh) → the band the player actually reached.
const BAND_CUTS = [0.2, 0.55, 0.9, 1.2, 1.5];
function reachedBand(peak) { const i = BAND_CUTS.findIndex(c => peak < c); return i < 0 ? 5 : i; }   // 5 = past Severe (too harsh)
function matchQuality(reached, expected, tooHarsh) {
  if (tooHarsh || reached > 4) return 'over2';
  const d = reached - expected;
  return d === 0 ? 'well' : d === -1 ? 'under1' : d <= -2 ? 'under2' : d === 1 ? 'over1' : 'over2';
}
const MATCH_TEXT = { well: 'Well matched', under1: 'A little short of what was needed', under2: 'Far short; it did not land', over1: 'A little more than was needed', over2: 'Far more than was needed' };
const qualityKey = q => q === 'well' ? 'well' : q.startsWith('under') ? 'under' : 'over';

function applyMatch(g, id, q, rec) {
  const s = stats(g, id), val = s.val;
  if (q === 'well') {
    changeStat(g, id, 'wil', val >= 5 ? -2 : -1, 'correction', rec);
    changeStat(g, id, 'res', val <= 3 ? 1 : -1, 'correction', rec);
    changeStat(g, id, 'val', 1, 'correction', rec);
  } else if (q === 'under2') changeStat(g, id, 'com', -1, 'correction', rec);
  else if (q === 'over1') {
    changeStat(g, id, 'wil', -1, 'correction', rec);
    changeStat(g, id, 'res', 1, 'overshoot1', rec);
    if (CHARACTERS[id].distrustsOvershoot) changeStat(g, id, 'val', -1, 'correction', rec);   // (Lila) overcorrection confirms she was right not to trust it
  } else if (q === 'over2') { changeStat(g, id, 'res', 2, 'correction', rec); changeStat(g, id, 'val', -1, 'correction', rec); }
}
// What went into what she needed tonight, as a list the report can show.
function breakdownOf(g, id, card) {
  const s = stats(g, id), parts = [];
  parts.push({ label: 'Wilfulness ' + s.wil, band: BANDS[wilfulnessBand(s.wil)] });
  if (card) {
    if (card.event && card.event.trap) parts.push({ label: 'she is hiding that she is not fine: the gentle answer', trap: true });
    else {
      if (card.mod) parts.push({ label: (card.event ? 'what she did' : 'the duty') + (card.event && (card.band === 'partial' || card.band === 'failed') ? ' and the duty' : ''), plus: card.mod });
      for (const n of card.disclosure.notes) parts.push({ label: n.what + ': ' + n.text, plus: n.pts / 2 });
      if (card.late) parts.push({ label: 'posted late', plus: 1, late: true });
    }
  }
  return parts;
}
// Score a finished live correction. `done`: { peak (highest distress), tooHarsh, smacks }.
// Returns a snapshot (the sister may already be gone by the time it is shown).
function applyCorrection(g, id, done) {
  const card = g.cards.find(c => c.id === id), s = stats(g, id);
  const expected = expectedBand(s, card), reached = reachedBand(done.peak || 0), breakdown = breakdownOf(g, id, card);
  const q = matchQuality(reached, expected, done.tooHarsh);
  const rec = [];
  applyMatch(g, id, q, rec);
  // Too harsh, with the trust already worn thin: she calls the safe word, then and there (and the correction stops).
  const word = !!done.tooHarsh && (g.chars[id].stats.val <= 3 || g.chars[id].stats.res >= 5);
  if (card) { card.done = true; card.result = { kind: 'correction', quality: q }; }
  const snap = { id, kind: 'correction', expected, reached, expectedName: BANDS[expected], reachedName: reached > 4 ? 'Too harsh' : BANDS[reached], quality: q, text: MATCH_TEXT[q], smacks: done.smacks || 0, tooHarsh: !!done.tooHarsh, word, changes: rec, exits: [], breakdown };
  if (word) snap.exits.push(useWord(g, id, 'harsh')); else { snap.exits.push(...sweepMoveOns(g)); recordNight(g, { id, kind: 'correction', quality: q, qkey: qualityKey(q), expected, reached, breakdown }); }
  snap.safeWord = word;
  return snap;
}
// What the president reads in the morning, one record per sister (the latest for that sister tonight).
function recordNight(g, rec) { g.lastNight = (g.lastNight || []).filter(r => r.id !== rec.id); g.lastNight.push(rec); }
// Record what was sent (the message, and what was chosen in it), for the Probation Report.
function recordSent(g, id, info) { const card = g.cards.find(c => c.id === id); if (card) card.sent = { ...(card.sent || {}), ...info }; return card; }

const REPRIEVE_EFFECT = {
  stern: [['wil', -1]],
  kind: [['val', 1], ['sat', 1]],
  reflection: [['com', 1], ['wil', -1]],
};
function applyReprieve(g, id, kind) {
  const card = g.cards.find(c => c.id === id), R = C.REPRIEVES[kind];
  if (!R || g.candle < R.cost) return null;
  g.candle -= R.cost;
  const rec = [], unsettled = !!CHARACTERS[id].reprieveBacklash && stats(g, id).wil >= 4;
  for (const [st, d] of REPRIEVE_EFFECT[kind]) changeStat(g, id, st, d, 'reprieve', rec);
  if (card && card.event && card.event.trap && kind !== 'stern') changeStat(g, id, 'sat', 1, 'reprieve', rec);   // the trap variants: this is what she needed
  if (kind === 'reflection' && g.chars[id].grades !== 'On Track') nudgeGrades(g, id, 1, rec);                   // (writing it out gets her back to her work)
  if (unsettled) changeStat(g, id, 'wil', 1, 'reprieve', rec);               // no consequence, so no change
  if (card) { card.done = true; card.result = { kind: 'reprieve', reprieve: kind }; }
  const earned = !!card && (card.register === 'routine' || !!(card.event && card.event.trap));
  recordNight(g, { id, kind: 'reprieve', reprieve: kind, earned });
  const dd = CHARACTERS[id], snap = { id, kind: 'reprieve', reprieve: kind, name: R.name, earned, changes: rec, exits: [], text: fillTemplate(C.RESULT_LINES.reprieve[kind], { name: dd.name, pron: dd.pronouns, title: g.title }) };
  snap.exits.push(...sweepMoveOns(g));
  return snap;
}
const AFTERCARE_EFFECT = {
  corner: id => [['com', 1]],
  lines: () => [['com', 1], ['att', 1]],
  held: () => [['val', 1], ['res', -1]],
  warm: () => [['val', 1], ['sat', 1]],
};
function applyAftercare(g, id, kind) {
  const A = C.AFTERCARE[kind];
  if (!A || g.candle < A.cost) return null;
  g.candle -= A.cost;
  const rec = [];
  for (const [st, d] of AFTERCARE_EFFECT[kind](id)) changeStat(g, id, st, d, 'aftercare', rec);
  if (kind === 'corner' && stats(g, id).val <= 3) changeStat(g, id, 'res', 1, 'aftercare', rec);
  const exits = sweepMoveOns(g);
  const dd = CHARACTERS[id], card = g.cards.find(c => c.id === id);
  if (card) card.sent = { ...(card.sent || {}), after: kind };
  return { id, kind, name: A.name, changes: rec, exits, line: fillTemplate(C.RESULT_LINES.aftercare[kind], { name: dd.name, pron: dd.pronouns, title: g.title }) };
}

// ── The Probation Report ────────────────────────────────────────
// The Big's nightly direct message to the president, compiled from what was actually done (card.sent.report, kept when the correction ended, and what came after):
// the positions used, how far she was bared, the implements, how she took it, the aftercare. A message of her own for a reprieve.
const dressState = l => l && l.bottoms ? (l.briefs ? 2 : 1) : 0;
function listWith(items) { return items.length < 2 ? items.join('') : items.length === 2 ? items.join(' and ') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]; }
function reportParagraph(g, card) {
  const id = card.id, d = CHARACTERS[id], R_ = C.REPORT, s = card.sent || {}, rep = s.report || {}, ctx = { name: d.name, pron: d.pronouns, title: g.title };
  const bits = [];
  if (card.choreName) bits.push(card.choreName + ', ' + (card.alone ? 'failed (alone)' : BAND_WORD[card.band]));
  if (card.event) bits.push(CATEGORIES[card.event.cat].label.toLowerCase());
  const lead = d.name + ' — ' + (bits.length ? bits.join('; ') : 'nothing logged') + (card.late ? '; posted late' : '') + '.';
  if (s.kind === 'reprieve') return [lead, R_.reprieve[s.reprieve]].join(' ');
  const runs = rep.runs || [], out = [lead];
  const uniq = arr => arr.filter((x, i) => x !== arr[i - 1]);
  // positions, in the order they were used (where she was struck; or where she was left, if I never struck her)
  const pos = uniq(runs.map(r => r.pos)); if (!pos.length && rep.pos) pos.push(rep.pos);
  if (pos.length) out.push(pos.length === 1 ? 'I had her ' + R_.position[pos[0]] + '.' : 'I started with her ' + R_.position[pos[0]] + ', then ' + pos.slice(1).map(p => R_.position[p]).join(', then ') + '.');
  // how far she was bared
  const states = uniq(runs.map(r => r.st)); if (!states.length) states.push(rep.st != null ? rep.st : 0);
  const dress = states.map((st, i) => R_.dress[st] + (st === 0 && i === 0 ? (rep.look === 'sleep' ? ', in her sleepwear' : ', in her own clothes') : ''));
  out.push('Dress: ' + dress.join(', then ') + '.');
  // the implements, with how many each
  const per = []; for (const r of runs) { const e = per.find(x => x.impl === r.impl); if (e) e.n += r.n; else per.push({ impl: r.impl, n: r.n }); }
  const total = per.reduce((n, x) => n + x.n, 0);
  out.push(total ? 'Implements: ' + listWith(per.map(x => R_.implement[x.impl] + ' (' + x.n + ')')) + '; ' + total + (total === 1 ? ' smack' : ' smacks') + ' in all.' : 'I didn’t strike her: I decided it wasn’t needed.');
  // how she took it
  if (total && rep.band != null) out.push(fillTemplate('{Name} ' + R_.taken[rep.mood || 'plain'][rep.band] + '. I brought her to ' + (rep.band > 4 ? 'too harsh' : BANDS[rep.band]) + '.', ctx));
  if (s.after) out.push(R_.after[s.after]);
  return out.join(' ');
}
// The whole message: one paragraph per sister, in the order they were sent.
function probationReport(g, rng) {
  const r = rng || mulberry32(g.day * 7919 + 13), lines = g.cards.filter(c => c.done && c.sent).map(c => ({ id: c.id, text: reportParagraph(g, c) }));
  return { intro: fillTemplate(pick(r, C.REPORT.intro).replace('{N}', g.day), { title: g.title }), lines, outro: fillTemplate(C.REPORT.outro, { title: g.title }) };
}

// ── The president's response ────────────────────────────────────
// One line per sister, keyed to how last night went (the match quality, or whether a reprieve was earned); a sister Cleared that night gets her own line.
// A sister who left (the safe word) has no line: the state-change block says it.
function presidentLines(g, rng) {
  const F = C.PRES_FEEDBACK, used = new Set(), cleared = new Set(g.stateChanges.filter(c => c.type === 'cleared').map(c => c.id)), out = [];
  for (const r of g.lastNight || []) {
    if (!cleared.has(r.id) && (g.gone || []).includes(r.id)) continue;
    let bank;
    if (cleared.has(r.id)) bank = F.cleared;
    else if (r.kind === 'reprieve') bank = r.earned ? F.reprieveEarned : r.reprieve === 'kind' ? F.reprieveUnearned : F.reprieveUnearned.slice(1);
    else bank = F[r.qkey];
    const fresh = bank.filter(l => !used.has(l)), line = pick(rng, fresh.length ? fresh : bank); used.add(line);
    const d = CHARACTERS[r.id];
    out.push({ id: r.id, text: fillTemplate(line, { name: d.name, pron: d.pronouns, title: g.title }) });
  }
  return out;
}

// ── Asking for a new implement ──────────────────────────────────
// To change implement the player sends the resident for the new one: a short exchange whose options and answers depend on how
// the resident is (distress now, and their stats). Only the first exchange of a correction moves anything.
function fetchMood(s) { return s.res >= 5 ? 'sullen' : s.wil >= 6 ? 'cheeky' : s.val >= 4 ? 'willing' : s.com <= 2 ? 'flustered' : 'plain'; }
// How they are right now, in a line: by their mood and how composed they are. Never the same line twice running.
function reopenLine(charId, s, distress, title, rng, avoid) {
  const def = CHARACTERS[charId], band = distress < 0.3 ? 'calm' : distress < 0.7 ? 'warm' : distress < 1 ? 'edge' : 'past';
  const pool = C.REOPEN[fetchMood(s)][band].filter(l => l !== avoid), list = pool.length ? pool : C.REOPEN[fetchMood(s)][band];
  const raw = list[Math.floor(rng() * list.length)];
  return { raw, text: fillTemplate(raw, { name: def.name, pron: def.pronouns, title }) };
}
// The tone the player takes in giving orders, by how they are: gentle, firm or stern.
function toneFor(s) { const m = fetchMood(s); return m === 'willing' || m === 'flustered' ? 'gentle' : m === 'plain' ? 'firm' : 'stern'; }
function fetchOptions(s, implName) {
  const opts = [
    { id: 'ask', label: 'Ask them to bring it, politely', line: '"Would you fetch the ' + implName + ' for me, please?"' },
    { id: 'tell', label: 'Tell them to bring it', line: '"Fetch the ' + implName + '."' },
  ];
  if (s.val >= 3 && s.res <= 4) opts.push({ id: 'explain', label: 'Explain what it is for, then ask', line: '"I think this wants more than a hand can give. Would you bring me the ' + implName + '?"' });
  if (s.res >= 5 || s.val <= 2) opts.push({ id: 'self', label: 'Say nothing and fetch it yourself', line: '(You get up, and fetch the ' + implName + ' yourself.)' });
  opts.push({ id: 'checkin', label: 'Check they are all right to go on', line: '"Before I do: are you all right to go on?"' });
  return opts;
}
const FETCH_REPLIES = {
  ask: {
    willing: ['"Of course, {Title}." {Name} goes at once, and sets it in your hand like something precious.'],
    sullen: ['{Name} looks at you for a long moment, then goes, and comes back without a word.'],
    cheeky: ['"Since you ask so nicely." {Name} takes the long way round, and is back with a grin.'],
    flustered: ['"Yes — yes, which one? The — yes." {Name} comes back at a half-run, a little out of breath.'],
    plain: ['"All right." {Name} fetches it and holds it out.'],
  },
  tell: {
    willing: ['"Yes, {Title}." {Name} is back before the order has gone cold.'],
    sullen: ['"Fine." {Name} goes, and the door is closed a little harder than it needs to be.'],
    cheeky: ['"Is that an order?" {Name} goes, in no hurry, and is back with a look that says the answer is yes.'],
    flustered: ['{Name} nods too many times and goes. It is plainly easier, somehow, to be told.'],
    plain: ['{Name} goes without comment and brings it back.'],
  },
  explain: {
    willing: ['{Name} listens, and nods slowly. "I understand, {Title}." {Subj} goes to get it.'],
    plain: ['{Name} listens, and nods slowly. "All right. I see." {Subj} goes to fetch it.'],
    cheeky: ['{Name} listens, and the grin fades a little. "Fair enough, {Title}." {Subj} goes.'],
    flustered: ['{Name} listens to every word, and seems steadier for having heard it. {Subj} goes.'],
    sullen: ['{Name} listens, and for once does not argue. {Subj} goes.'],
  },
  self: {
    willing: ['{Name} watches you go, and says nothing. When you come back the silence has settled.'],
    sullen: ['{Name} watches you go, and says nothing. When you come back the silence is colder.'],
    cheeky: ['{Name} watches you go, and for once has nothing to say.'],
    flustered: ['{Name} watches you go, hands wrung together, and does not know where to look.'],
    plain: ['{Name} waits, and watches you go, and says nothing.'],
  },
};
function fetchReply(id, s, charId, title, distress) {
  const def = CHARACTERS[charId], ctx = { name: def.name, pron: def.pronouns, title };
  if (id === 'checkin') {
    const d = distress || 0;
    const t = d >= 1.1 ? '"Honestly? I\'m near the end of what I can take, {Title}. But I\'m still here."' : d >= 0.8 ? '"I can go on, {Title}. Not for long."' : d >= 0.4 ? '"I\'m all right. Thank you for asking, {Title}."' : '"I\'m fine, {Title}. Go on."';
    return fillTemplate(t + ' {Name} goes to bring it, steadier for having been asked.', ctx);
  }
  const pool = FETCH_REPLIES[id][fetchMood(s)] || FETCH_REPLIES[id].plain;
  return fillTemplate(pool[0], ctx);
}
function applyFetch(g, id, optId) {
  const s = stats(g, id), rec = [];
  if (optId === 'ask' && s.res < 5 && s.val <= 4) changeStat(g, id, 'val', 1, 'conversation', rec);
  else if (optId === 'tell') { if (s.com <= 3) changeStat(g, id, 'com', 1, 'conversation', rec); if (s.res >= 5) changeStat(g, id, 'res', 1, 'conversation', rec); }
  else if (optId === 'explain' && s.val <= 5) changeStat(g, id, 'val', 1, 'conversation', rec);
  else if (optId === 'self' && s.val <= 3) changeStat(g, id, 'val', -1, 'conversation', rec);
  else if (optId === 'checkin' && s.val <= 5) changeStat(g, id, 'val', 1, 'conversation', rec);
  return { changes: rec };   // (anyone who crosses their line moves on when the correction ends)
}

// ── The goodbyes ────────────────────────────────────────────────
// The beats of a farewell scene, text filled for this resident: { n } narration, { r } the resident speaking, { ask: [{ label, you, r }] }
// a choice for the player. Nothing lets you talk anyone out of going; the options only colour the parting.
function farewellScene(kind, id, { why = 'worn', mood = 'plain', title = '' } = {}) {
  const def = CHARACTERS[id], ctx = { name: def.name, pron: def.pronouns, title }, f = t => fillTemplate(t, ctx), SC = C.SCENES;
  if (kind === 'moveon') {
    const o = SC.moveon[id];
    return [{ n: f(SC.moveon.open[0].n) }, { r: f(o.r) }, { ask: o.ask.map(a => ({ label: a.label, you: f(a.you), r: f(a.r) })) }, { r: f(def.lines.leave) }, { n: f(o.end) }];
  }
  const W = SC.word;
  return [{ n: f(W.why[why] || W.why.worn) }, { r: f(W.r) }, { n: f(W.n) },
    { ask: W.ask.map(a => ({ label: a.label, you: f(a.you), r: f(a.r[mood] || a.r.plain) })) }, { n: f(W.end[id]) }, { n: f(W.last) }];
}

// ── Evening → next morning ──────────────────────────────────────
const pendingCards = g => g.cards.filter(c => !c.done && g.roster.includes(c.id));
function endEvening(g, rng) {
  const moved = flushMoveOns(g);   // (the scenes for these are played by the interface before this, when it can; either way they are out of the house)
  g.notices = moved.filter(n => !n.played);
  // The word is spoken at the day boundary, before the next chore list is dealt.
  for (const id of g.roster.slice()) if (wordCalled(stats(g, id))) useWord(g, id, 'worn');
  backfill(g, rng);
  g.phase = isOver(g) ? 'over' : 'boundary';
  return g.notices.slice();
}

const api = { mulberry32, pick, shuffle, weighted, clamp, HOUSE_SIZE, EVENING_CANDLE, MIN_NIGHTS, BANDS, BAND_CUTS, MATCH_TEXT,
  newGame, effectiveAttention, gradeMod, GRADE_ORDER, nudgeGrades, changeStat, meetsGraduation, wordCalled, SAFE_WORD, safeWordsToLeave, isOver, score, sweepMoveOns, flushMoveOns, moveOn, useWord, backfill,
  generateChores, startMorning, clearPresident, assign, unassign, allAssigned, choreOf, choreBand, choreEffective, dutyEffective, applyChoreBand, resolveChores, resolveDay,
  occurrence, lateChance, concealChance, timeString, dutyPost, categoryWeights, fillTemplate, makeEvent, applyEvent, rollEvents, situationalModifier, disclosureBands, extraBands, buildCards,
  wilfulnessBand, expectedBand, reachedBand, matchQuality, qualityKey, reportParagraph, probationReport, dressState, applyCorrection, applyReprieve, applyAftercare, recordSent, presidentLines, farewellScene, fetchMood, reopenLine, toneFor, fetchOptions, fetchReply, applyFetch, pendingCards, endEvening,
  getRapport, addRapport };
root.OtkRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
