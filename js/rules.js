// Birchwood House — rules. Pure functions over a plain-JSON game state (so it saves and tests cleanly).
//
// Day: Morning (generate the chore list, assign residents) → resolution (chores, graduations, events, graduations,
// Behaviour Cards) → Evening (each resident in turn: a live correction, or a reprieve; then aftercare) → day boundary
// (the safe word, backfill) → Morning.
//
// The correction itself is live (see scene.js); this module only scores what the player actually did: the highest
// distress they brought the resident to, whether it tipped into too harsh, against what that resident needed that evening.
(function (root) {
'use strict';
const C = typeof require === 'function' && typeof module !== 'undefined' ? require('./content.js') : root.FairyShoeContent;
const { STATS, CHARACTERS, ORDER, CHORES, CATEGORIES } = C;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HOUSE_SIZE = 3;
const EVENING_CANDLE = 5;          // marks to spend on reprieves and aftercare each evening
const MAX_EVENTS = 3;              // at most this many events per evening

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
function freshChar(id) { return { stats: cloneStats(CHARACTERS[id].base), carry: {}, visits: 0, moveOns: 0, safeWords: 0 }; }
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const getRapport = (g, a, b) => g.rapport[pairKey(a, b)] != null ? g.rapport[pairKey(a, b)] : 4;
const addRapport = (g, a, b, d) => { g.rapport[pairKey(a, b)] = clamp(getRapport(g, a, b) + d, 1, 7); };
const stats = (g, id) => g.chars[id].stats;

function newGame(rng, opts = {}) {
  const g = {
    v: 1, day: 0, title: opts.title || 'Ma\'am', phase: 'new', rapport: {},
    chars: Object.fromEntries(ORDER.map(id => [id, freshChar(id)])),
    roster: [], unseen: ORDER.slice(), collection: [], gone: [],
    chores: [], cards: [], queue: [], cursor: 0, candle: EVENING_CANDLE, notices: [], leftToday: [], history: [],
  };
  backfill(g, rng, true);
  g.notices = [];
  return g;
}

// ── Effective Attention ─────────────────────────────────────────
// All six stats bear on whether work gets done. Pivots sit at the extremes (above 5, below 3); penalty and bonus are each
// floored, then netted and clamped to −3…+2.
function effectiveAttention(s) {
  const pen = Math.max(0, s.wil - 5) * 0.5 + Math.max(0, 3 - s.com) * 0.5 + Math.max(0, s.res - 5) * 0.4 + Math.max(0, 3 - s.sat) * 0.4 + Math.max(0, 3 - s.val) * 0.3;
  const bon = Math.max(0, s.com - 5) * 0.5 + Math.max(0, s.sat - 5) * 0.4 + Math.max(0, s.val - 5) * 0.3;
  const mod = clamp(Math.floor(bon + 1e-9) - Math.floor(pen + 1e-9), -3, 2);
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
const meetsGraduation = (id, s) => CHARACTERS[id].grad.every(([k, op, t]) => cmp(s[k], op, t));
// Resentment at the ceiling and Valued on the floor, together: they call the safe word.
const wordCalled = s => s.res >= 7 && s.val <= 2;
// The safe word is "Red". Every use stops the correction and costs them for real; it takes this many to leave the house for good (fewer when they are already past patience).
const SAFE_WORD = 'Red';
const safeWordsToLeave = s => s.res >= 6 ? 2 : 3;

function leave(g, id) { g.roster = g.roster.filter(r => r !== id); g.cards = g.cards.filter(c => c.id !== id); g.queue = g.queue.filter(q => q !== id); if (g.cursor > g.queue.length) g.cursor = g.queue.length; g.leftToday.push(id); }
// Moved on or left: either way they are out of the pool for good; the house takes in whoever has not yet been through it.
function moveOn(g, id) {
  leave(g, id);
  g.chars[id].moveOns++; g.chars[id].final = { ...g.chars[id].stats };   // (their last state, for the last page)
  if (!g.collection.includes(id)) g.collection.push(id);   // unique, permanent
  const n = { type: 'moveon', id, text: CHARACTERS[id].name + ' has moved on.' };
  g.notices.push(n); return n;
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
    const n = { type: 'word', id, why, mood, count: c.safeWords, text: CHARACTERS[id].name + ' called the safe word and left.' };
    g.notices.push(n); return n;
  }
  const n = { type: 'safeword', id, why, mood, count: c.safeWords, need, changes: rec, text: CHARACTERS[id].name + ' called the safe word.' };
  g.notices.push(n); return n;
}
// Nothing moves anyone on mid-day or mid-evening: chores, events, corrections and aftercare only change stats. Whether a resident is ready is checked once, after all
// the behaviour has been dealt with (flushMoveOns, at the end of the evening). (Kept so the callers read the same; it does nothing.)
function sweepMoveOns() { return []; }
function flushMoveOns(g) { return g.roster.filter(id => meetsGraduation(id, stats(g, id))).map(id => moveOn(g, id)); }

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
    if (!silent) g.notices.push({ type: 'arrive', id, text: CHARACTERS[id].name + ' has arrived.' });
  }
  return arrived;
}
// The game is over when everyone has either moved on or left: the score is how many moved on.
const isOver = g => g.roster.length === 0 && g.unseen.filter(id => !g.roster.includes(id)).length === 0;
const score = g => g.collection.length;

// ── Morning: the chore list ─────────────────────────────────────
// A fresh list each morning with exactly one slot per resident; a paired chore takes two.
function generateChores(g, rng) {
  // One slot per resident; with fewer than three in the house the list keeps three slots' worth (the day ends when every resident is placed, not every slot), and with one resident nothing is shared.
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
function startMorning(g, rng) {
  g.day++; g.phase = 'assign'; g.leftToday = []; g.cards = []; g.queue = []; g.cursor = 0; g.candle = EVENING_CANDLE;
  g.chores = generateChores(g, rng);
  g.narration = morningNarration(g, rng);
  return g.chores;
}
function assign(g, choreIdx, slotIdx, id) {
  if (!g.roster.includes(id)) return false;
  for (const ch of g.chores) ch.slots = ch.slots.map(s => s === id ? null : s);
  const ch = g.chores[choreIdx]; if (!ch || slotIdx >= ch.slots.length) return false;
  ch.slots[slotIdx] = id; return true;
}
function unassign(g, id) { for (const ch of g.chores) ch.slots = ch.slots.map(s => s === id ? null : s); }
const allAssigned = g => g.roster.length > 0 && g.roster.every(id => g.chores.some(ch => ch.slots.includes(id)));   // (every resident placed; some chores may stand empty with fewer than three in the house)
const choreOf = (g, id) => g.chores.find(ch => ch.slots.includes(id));

// ── Chore resolution ────────────────────────────────────────────
const THRESH = { 1: [5, 3, 2], 2: [6, 4, 2], 3: [7, 5, 3] };   // lowest effective Attention for well / completed / partial
function choreBand(diff, eff) {
  const [w, c, p] = THRESH[diff];
  return eff >= w ? 'well' : eff >= c ? 'completed' : eff >= p ? 'partial' : 'failed';
}
function choreEffective(g, ch) {
  const effs = ch.slots.filter(Boolean).map(id => effectiveAttention(stats(g, id)));
  let v = Math.min(...effs.map(e => e.value)), r = null;
  if (ch.slots.length === 2) { r = getRapport(g, ch.slots[0], ch.slots[1]); v = clamp(v + (r >= 6 ? 1 : r <= 2 ? -1 : 0), 1, 7); }
  return { eff: v, rapport: r };
}
function applyChoreBand(g, id, band, diff, rec) {
  if (band === 'well') { changeStat(g, id, 'att', 1, 'chore', rec); if (diff >= 2) changeStat(g, id, 'sat', 1, 'chore', rec); }
  else if (band === 'completed') changeStat(g, id, 'att', 1, 'chore', rec);
  else if (band === 'failed') { changeStat(g, id, 'sat', -1, 'chore', rec); changeStat(g, id, 'att', -1, 'chore', rec); }
}
function resolveChores(g) {
  const out = {};
  for (const ch of g.chores) {
    const who = ch.slots.filter(Boolean); if (!who.length) continue;   // (nobody on it today)
    if (ch.def.paired && who.length < 2) { ch.band = 'failed'; ch.eff = 0; ch.alone = true; for (const id of who) { applyChoreBand(g, id, 'failed', ch.def.diff); out[id] = { chore: ch, band: 'failed' }; } continue; }   // a shared chore cannot be done alone
    const { eff } = choreEffective(g, ch), band = choreBand(ch.def.diff, eff);
    ch.band = band; ch.eff = eff;
    for (const id of who) { applyChoreBand(g, id, band, ch.def.diff); out[id] = { chore: ch, band }; }
  }
  return out;
}

// ── Events ──────────────────────────────────────────────────────
const occurrence = s => clamp(5 + (s.wil + s.res) * 5 - (s.sat + s.com) * 3, 5, 70);
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
  const P = ctx.pron, second = ctx.second || '';
  const map = { Name: ctx.name, Second: second, Title: ctx.title || '', Subj: P[0], Obj: P[1], Poss: P[2], Refl: P[3], Impl: ctx.Impl };
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
  const opts = C.EVENTS[cat].map(t => typeof t === 'string' ? { text: t } : t).filter(t => !t.only || t.only === id);
  // A resident's own templates are favoured over the generic ones.
  const own = opts.filter(t => t.only === id);
  const t = own.length && rng() < 0.45 ? pick(rng, own) : pick(rng, opts);
  const def = CHARACTERS[id];
  const text = fillTemplate(t.text, { name: def.name, pron: def.pronouns, second: second ? CHARACTERS[second].name : '', title: g.title });
  return { id, cat, second, text, trap: !!t.trap, fx: t.fx || null, mod: CATEGORIES[cat].mod };
}
function applyEvent(g, ev, rec) {
  const { id, second: sec, cat } = ev;
  if (cat === 'boundary') changeStat(g, id, 'wil', 1, 'event', rec);
  else if (cat === 'friction') { changeStat(g, id, 'res', 1, 'event', rec); changeStat(g, sec, 'res', 1, 'event', rec); addRapport(g, id, sec, -1); }
  else if (cat === 'dishonest') changeStat(g, id, 'val', -1, 'event', rec);
  else if (cat === 'setback') for (const [k, d] of (ev.fx || [['att', -1]])) changeStat(g, id, k, d, 'event', rec);
  else if (cat === 'neglect') { changeStat(g, id, 'sat', -1, 'event', rec); changeStat(g, id, 'com', -1, 'event', rec); }
  else if (cat === 'cruelty') { changeStat(g, sec, 'res', 1, 'event', rec); changeStat(g, id, 'val', -1, 'event', rec); }
}
// Each resident rolls; the two best margins take an event, on two different people. A quiet evening is fine.
function rollEvents(g, rng) {
  const hits = g.roster.map(id => { const pct = occurrence(stats(g, id)), r = rng() * 100; return { id, margin: pct - r, hit: r < pct }; })
    .filter(h => h.hit).sort((a, b) => b.margin - a.margin).slice(0, MAX_EVENTS);
  return hits.map(h => makeEvent(g, h.id, rng));
}

// ── Behaviour Cards ─────────────────────────────────────────────
function choreLine(g, id, entry, rng) {
  const def = CHARACTERS[id], ch = entry.chore, partnerId = ch.slots.find(s => s && s !== id);
  const pool = ch.alone ? C.ALONE_LINES : ch.slots.length === 2 ? C.PAIR_LINES[entry.band] : C.CHORE_LINES[entry.band];
  const t = pick(rng, pool);
  const pl = !!ch.def.plural, agree = { '{was}': pl ? 'were' : 'was', '{is}': pl ? 'are' : 'is', '{It}': pl ? 'They' : 'It', '{it}': pl ? 'them' : 'it' };
  const out = fillTemplate(t.replace(/\{(was|is|It|it)\}/g, m => agree[m]).replace('{Chore}', ch.def.phrase).replace('{Partner}', partnerId ? CHARACTERS[partnerId].name : ''), { name: def.name, pron: def.pronouns, title: g.title });
  return out[0].toUpperCase() + out.slice(1);
}
// Situational modifier: chore trouble +1; an event its own; both on one card add a further +1; capped at +2.
function situationalModifier(card) {
  const trouble = card.band === 'partial' || card.band === 'failed';
  let m = 0;
  if (card.event) { m = card.event.mod; if (trouble) m += 1; } else if (trouble) m = 1;
  return Math.min(2, m);
}
function buildCards(g, entries, events, rng) {
  g.cards = g.roster.map(id => {
    const e = entries[id], ev = events.find(x => x.id === id) || null;
    const card = { id, band: e ? e.band : 'completed', choreName: e ? e.chore.def.name : '', choreLine: e ? choreLine(g, id, e, rng) : '', event: ev, done: false };
    card.mod = situationalModifier(card);
    return card;
  });
  g.queue = g.cards.map(c => c.id); g.cursor = 0;
}

// The whole of day resolution: chores → move-ons → events → move-ons → cards. Returns what happened (for the morning report).
function resolveDay(g, rng) {
  g.notices = [];
  const entries = resolveChores(g);
  const choreSnapshot = g.roster.map(id => ({ id, band: entries[id].band, chore: entries[id].chore.def.name, eff: entries[id].chore.eff }));
  sweepMoveOns(g);
  const events = rollEvents(g, rng).filter(ev => g.roster.includes(ev.id) && (!ev.second || g.roster.includes(ev.second)));
  for (const ev of events) applyEvent(g, ev);
  sweepMoveOns(g);
  const live = events.filter(ev => g.roster.includes(ev.id));
  buildCards(g, entries, live, rng);
  g.phase = 'evening';
  return { chores: choreSnapshot, events: live, notices: g.notices.slice() };
}

// ── The correction ──────────────────────────────────────────────
const BANDS = ['Minimal', 'Light', 'Moderate', 'Firm', 'Severe'];
// What the resident's Wilfulness asks for on its own; Severe is only reachable with a situational modifier on top.
const wilfulnessBand = w => w <= 1 ? 0 : w <= 3 ? 1 : w <= 5 ? 2 : 3;
function expectedBand(s, card) {
  if (card && card.event && card.event.trap) return 0;   // the gentle answer is the right one
  return Math.min(4, wilfulnessBand(s.wil) + (card ? card.mod : 0));
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
    if (id === 'red') changeStat(g, id, 'val', -1, 'correction', rec);   // overcorrection reads as abandonment, not discipline
  } else if (q === 'over2') { changeStat(g, id, 'res', 2, 'correction', rec); changeStat(g, id, 'val', -1, 'correction', rec); }
}

// Score a finished live correction. `done`: { peak (highest distress), tooHarsh, smacks }.
// Returns a snapshot (the resident may already be gone by the time it is shown).
function applyCorrection(g, id, done) {
  const card = g.cards.find(c => c.id === id), s = stats(g, id);
  const expected = expectedBand(s, card), reached = reachedBand(done.peak || 0);
  const q = matchQuality(reached, expected, done.tooHarsh);
  const rec = [];
  applyMatch(g, id, q, rec);
  // Too harsh, with the trust already worn thin: they call the safe word, then and there (and the correction stops).
  const word = !!done.tooHarsh && (g.chars[id].stats.val <= 3 || g.chars[id].stats.res >= 5);
  if (card) card.done = true;
  const snap = { id, kind: 'correction', expected, reached, expectedName: BANDS[expected], reachedName: reached > 4 ? 'Too harsh' : BANDS[reached], quality: q, text: MATCH_TEXT[q], smacks: done.smacks || 0, tooHarsh: !!done.tooHarsh, word, changes: rec, exits: [] };
  if (word) snap.exits.push(useWord(g, id, 'harsh')); else snap.exits.push(...sweepMoveOns(g));
  snap.safeWord = word;
  return snap;
}

const REPRIEVE_EFFECT = {
  stern: [['wil', -1]],
  kind: [['val', 1], ['sat', 1]],
  reflection: [['com', 1], ['wil', -1]],
};
function applyReprieve(g, id, kind) {
  const card = g.cards.find(c => c.id === id), R = C.REPRIEVES[kind];
  if (!R || g.candle < R.cost) return null;
  g.candle -= R.cost;
  const rec = [], unsettled = id === 'goldilocks' && stats(g, id).wil >= 4;
  for (const [st, d] of REPRIEVE_EFFECT[kind]) changeStat(g, id, st, d, 'reprieve', rec);
  if (card && card.event && card.event.trap && kind !== 'stern') changeStat(g, id, 'sat', 1, 'reprieve', rec);   // the trap variants: this is what they needed
  if (unsettled) changeStat(g, id, 'wil', 1, 'reprieve', rec);               // no consequence, so no change
  if (card) card.done = true;
  const dd = CHARACTERS[id], snap = { id, kind: 'reprieve', reprieve: kind, name: R.name, changes: rec, exits: [], text: fillTemplate(C.RESULT_LINES.reprieve[kind], { name: dd.name, pron: dd.pronouns, title: g.title }) };
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
  const dd = CHARACTERS[id];
  return { id, kind, name: A.name, changes: rec, exits, line: fillTemplate(C.RESULT_LINES.aftercare[kind], { name: dd.name, pron: dd.pronouns, title: g.title }) };
}

// ── Morning narration ───────────────────────────────────────────
// Built once when the morning begins (so it does not change on every redraw): the weather, one resident, and the list.
function listPhrase(chores) {
  const names = chores.map(c => c.def.name.toLowerCase());
  return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
function morningNarration(g, rng) {
  const M = C.MORNING, out = [];
  out.push(g.day === 1 ? M.first[0] : pick(rng, M.weather));
  const id = pick(rng, g.roster), s = stats(g, id), def = CHARACTERS[id];
  const t = rng() < 0.4 ? M.own[id] : pick(rng, M.mood[fetchMood(s)]);
  out.push(fillTemplate(t, { name: def.name, pron: def.pronouns, title: g.title }));
  const hard = g.chores.slice().sort((a, b) => b.def.diff - a.def.diff)[0], top = hard ? hard.def.diff : 1, things = listPhrase(g.chores);
  const tpl = top >= 3 ? M.list.hard : top === 1 ? M.list.easy : M.list.plain;
  out.push(tpl.replace('{things}', things).replace('{hardest}', hard ? hard.def.name.toLowerCase() : ''));
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

const api = { mulberry32, pick, shuffle, weighted, clamp, HOUSE_SIZE, EVENING_CANDLE, BANDS, BAND_CUTS, MATCH_TEXT,
  newGame, effectiveAttention, changeStat, meetsGraduation, wordCalled, SAFE_WORD, safeWordsToLeave, isOver, score, sweepMoveOns, flushMoveOns, moveOn, useWord, backfill,
  generateChores, startMorning, assign, unassign, allAssigned, choreOf, choreBand, choreEffective, applyChoreBand, resolveChores, resolveDay,
  occurrence, categoryWeights, fillTemplate, makeEvent, applyEvent, rollEvents, situationalModifier, buildCards,
  wilfulnessBand, expectedBand, reachedBand, matchQuality, applyCorrection, applyReprieve, applyAftercare, choreLineFor: choreLine, morningNarration, farewellScene, fetchMood, reopenLine, toneFor, fetchOptions, fetchReply, applyFetch, pendingCards, endEvening,
  getRapport, addRapport };
root.FairyShoeRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
