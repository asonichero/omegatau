// ΩΤΚ Companion — interface and game flow.
//
// The app is omegataukappa.social, a closed network for the house: a memo, a login, then each day a duty board, an evening timeline (a post for each sister, and a direct
// message to answer it with), the nightly Probation Report and the president's response. A correction itself leaves the app for the Big's room (the 3D view).
(function () {
'use strict';
const R = window.OtkRules, C = window.OtkContent, B = window.OtkBodies, SC = window.OtkScene;
const CH = C.CHARACTERS;
const SAVE_KEY = 'otk.v1';
const DEFAULT_TITLE = 'Avery';

const app = { g: null, rng: Math.random, title: DEFAULT_TITLE, settings: { guidance: true, sound: true }, armed: null, statsOpen: null, peek: null, drafts: {}, openComposer: null, stage: null, live: null, advance: null, scoring: false, pres: null };

// ── Helpers ─────────────────────────────────────────────────────
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return e;
}
const $ = s => document.querySelector(s);
const fmt = s => String(s).replace(/\{Title\}/g, app.title);
const cap = s => s[0].toUpperCase() + s.slice(1);
const pick = arr => arr[Math.floor(app.rng() * arr.length)];
const gradeClass = g => ({ 'On Track': 'grade-ontrack', 'At Risk': 'grade-atrisk', 'Failing': 'grade-failing' })[g];
function pips(n, cls) { const e = h('span', { class: 'pips ' + (cls || '') }); for (let i = 1; i <= 7; i++) e.append(h('i', { class: i <= n ? 'f' : '' })); return e; }
const delay = ms => new Promise(r => setTimeout(r, ms));
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage may be blocked */ } }
function recall(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
const avatar = (name, cls) => h('div', { class: 'avatar' + (cls ? ' ' + cls : '') }, name[0]);

function save() { if (app.g) store(SAVE_KEY, { g: app.g, title: app.title, settings: app.settings }); }
function saveSettings() { store(SAVE_KEY + '.prefs', { title: app.title, settings: app.settings }); }

// A redraw of the same screen (a chip chosen, a panel opened) keeps your place; a different screen starts at the top. Coming back to the evening from the room or a result
// returns to where you were (app.restoreY). Something that expands is brought into view (focusOn).
function setScreen(node) {
  const a = $('#app'), same = !!app.view && app.view === app.lastView;
  let y = same ? window.scrollY : 0;
  if (app.restoreY != null && app.view === 'evening') { y = app.restoreY; app.restoreY = null; }
  app.lastView = app.view;
  a.replaceChildren(node); window.scrollTo(0, y);
  if (app.focus) { const sel = app.focus; app.focus = null; requestAnimationFrame(() => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: sel.startsWith('#post') ? 'start' : 'nearest', behavior: 'smooth' }); }); }
}
function focusOn(sel) { app.focus = sel; }
function showStage(on) { $('#stage').classList.toggle('on', on); document.body.classList.toggle('scene', on); if (on && app.stage) app.stage.resize(); }
// A line of speech: shown, then faded after a reasonable time to read it (a couple of seconds plus about a third of a second a word).
function say(id, text, label, sticky) {
  const s = $('#speech'); clearTimeout(app.speechT); s.classList.remove('fade');
  if (!text) { s.hidden = true; return; }
  s.replaceChildren(h('b', {}, label || CH[id].name), fmt(text)); s.hidden = false;
  if (sticky) return;   // (stays until the scene moves on)
  const ms = 2800 + String(text).split(/\s+/).length * 330;
  app.speechT = setTimeout(() => { s.classList.add('fade'); app.speechT = setTimeout(() => { s.hidden = true; s.classList.remove('fade'); }, 900); }, ms);
}
async function busy(text, fn) {
  $('#loading-text').textContent = text; $('#loading').hidden = false;
  await delay(40);
  try { return await fn(); } finally { $('#loading').hidden = true; }
}
function modal(...kids) { const o = $('#overlay'); o.replaceChildren(h('div', { class: 'card' }, kids)); o.hidden = false; o.onclick = e => { if (e.target === o && o.dataset.dismiss !== 'no') closeModal(); }; }
function closeModal() { const o = $('#overlay'); o.hidden = true; o.replaceChildren(); delete o.dataset.dismiss; }
// What something costs, as candles like the meter's
function costIcons(n) { const e = h('span', { class: 'candle costtag', title: n + (n === 1 ? ' candle' : ' candles') }); for (let i = 0; i < n; i++) e.append(h('i', { class: 'lit' })); return e; }
function candle() { const g = app.g, e = h('span', { class: 'candle', title: 'Marks to spend on a reprieve or aftercare this evening' }, 'Candle '); for (let i = 0; i < R.EVENING_CANDLE; i++) e.append(h('i', { class: i < g.candle ? 'lit' : '' })); return e; }
const tell = (text, id, extra) => R.fillTemplate(text, { name: CH[id].name, pron: CH[id].pronouns, title: app.title, ...extra });

// ── The app's frame ─────────────────────────────────────────────
const PHASE_LABEL = { board: 'morning', president: 'morning', evening: 'evening', result: 'evening', report: 'probation report', end: 'closed' };
function appHeader() {
  const g = app.g, line = g && g.day ? 'Day ' + g.day + ' · ' + (PHASE_LABEL[app.view] || '') + ' · ' + g.collection.length + '/' + C.ORDER.length + ' cleared' : 'Social Probation';
  const tool = (label, fn, id) => h('button', { class: 'quiet', onclick: fn, id }, label);
  return h('header', {},
    h('div', { class: 'wordmark' }, h('div', { class: 'monogram' }, 'ΩΤΚ'), h('h1', {}, 'Omega Tau Kappa')),
    h('div', { class: 'subline' }, 'closed instance · house only · 41 sisters'),
    h('div', { class: 'daystrip' }, line),
    h('div', { class: 'tools' },
      tool('Good Standing (' + (g ? g.collection.length : 0) + '/' + C.ORDER.length + ')', showCollection), tool('How it works', showRules),
      tool('Guidance: ' + (app.settings.guidance ? 'on' : 'off'), () => { app.settings.guidance = !app.settings.guidance; saveSettings(); refreshGuidance(); }, 'guidebtn'),
      tool('Sound: ' + (app.settings.sound ? 'on' : 'off'), () => { app.settings.sound = !app.settings.sound; SC.Sound.set(app.settings.sound); saveSettings(); setSoundLabel(); }, 'soundbtn'),
      tool('Menu', leaveToMenu)));
}
function setSoundLabel() { const b = $('#soundbtn'); if (b) b.textContent = 'Sound: ' + (app.settings.sound ? 'on' : 'off'); }
function refreshGuidance() { if (app.refreshGuidance) app.refreshGuidance(); const b = $('#guidebtn'); if (b) b.textContent = 'Guidance: ' + (app.settings.guidance ? 'on' : 'off'); }
// inner: the screen; bar: the advance bar at the foot (or nothing)
function appShell(inner, bar) {
  return h('div', { class: 'shell' }, h('div', { class: 'app' }, appHeader(), h('div', { class: 'scroll' }, inner), bar || null, h('footer', {}, 'omegataukappa.social · sisters only')));
}
function advanceBar(label, onclick, { disabled, caption, extra } = {}) {
  return h('div', { class: 'advance' }, extra || null, h('button', { class: 'full-btn', disabled: !!disabled, onclick }, label), caption ? h('div', { class: 'caption' }, caption) : null);
}
function plain(inner) { return h('div', { class: 'shell' }, inner); }   // (a screen outside the app: the memo, the login)

// ── Intro ───────────────────────────────────────────────────────
function showIntro() {
  closeModal(); showStage(false); say(null, null); teardownLive(); app.view = null;
  const prefs = recall(SAVE_KEY + '.prefs'); if (prefs) { app.title = prefs.title || app.title; app.settings = { ...app.settings, ...(prefs.settings || {}) }; }
  SC.Sound.set(app.settings.sound);
  const saved = recall(SAVE_KEY);
  const input = h('input', { type: 'text', maxlength: 24, value: app.title, 'aria-label': 'Your name', oninput: e => { app.title = e.target.value.trim().slice(0, 24) || DEFAULT_TITLE; } });
  setScreen(plain(h('div', { class: 'intro' },
    h('div', { class: 'wordmark big' }, h('div', { class: 'monogram' }, 'ΩΤΚ'), h('h1', {}, 'Omega Tau Kappa')),
    h('div', { class: 'tagline' }, 'companion · omegataukappa.social'),
    h('p', { class: 'lede' }, 'You are a Big. The Standards Committee has put three sisters on Social Probation in your care, and every night the house’s rule is the same: Probation reports are logged, good night or bad. You read what each of them posts, and you decide what she hears from you: a word, or a correction by hand in your room, and what comes after.'),
    h('div', { class: 'panel consent' }, h('div', { class: 'ph' }, 'The house rules, before anything else'),
      h('p', {}, h('b', {}, 'Everyone here is an adult. '), 'Every sister is over eighteen, joined the chapter of her own accord, and understands what Probation is and what happens at the end of a night on the list.'),
      h('p', {}, h('b', {}, 'The safe word is “Red”. '), 'Anyone can call it at any moment. When she does, it stops at once and it costs her: Valued, Satisfaction and Composure fall and Resentment rises. Two or three calls and she requests a new Big. The game never overrules it, and neither should you.')),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, 'Your name'),
      h('p', {}, 'You are Avery. The book never says what she looks like, only that her eyes are curious and unreadable, so it is only a name you can change.'), input),
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => { saveSettings(); startNew(); } }, 'Open the app'),
      saved ? h('button', { onclick: () => { saveSettings(); continueGame(saved); } }, 'Continue (Day ' + saved.g.day + ')') : null),
    h('div', { class: 'row small' },
      h('button', { class: 'quiet', onclick: showSeverePicker }, 'Test: most severe correction'),
      h('a', { class: 'linkbtn', href: 'editor.html' }, 'Character editor')))));
}
function leaveToMenu() { teardownLive(); save(); showIntro(); }

// ── Starting and resuming ───────────────────────────────────────
function seed() { return R.mulberry32((Date.now() ^ (Math.random() * 4294967296)) >>> 0); }
async function ensureStage() {
  if (app.stage) return app.stage;
  app.stage = SC.createStage($('#stage'), { onGLProblem: msg => { const b = $('#glbanner'); b.textContent = msg; b.hidden = false; b.onclick = () => { b.hidden = true; }; } });
  return app.stage;
}
function startNew() {
  app.rng = seed(); app.g = R.newGame(app.rng, { title: app.title }); app.drafts = {}; app.openComposer = null; app.pres = null;
  showMemo();
}
// Testing: choose a subject, then a throwaway game is built with that sister on the evening’s timeline for the correction with the highest expected severity
// (her Wilfulness set high, with the largest situational modifier), and you land on her post with the message open. Nothing is saved.
function showSeverePicker() {
  const pickd = { subject: C.ORDER[0] };
  const box = h('div', {}), paint = () => box.replaceChildren(
    h('h4', {}, 'Subject'), h('div', { class: 'chips' }, C.ORDER.map(id => h('button', { class: pickd.subject === id ? 'on' : '', onclick: () => { pickd.subject = id; paint(); } }, CH[id].name))));
  paint();
  modal(h('h2', {}, 'Test: most severe correction'), h('p', { class: 'muted' }, 'A throwaway game, straight to her post with the message open, for a correction with the highest expected severity. Your save is not touched.'), box,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => { closeModal(); jumpToSevere(pickd.subject); } }, 'Load it'), h('button', { onclick: closeModal }, 'Cancel')));
}
function jumpToSevere(subject) {
  const rng = seed(), g = R.newGame(rng, { title: app.title });
  if (!g.roster.includes(subject)) g.roster[0] = subject;
  g.chars[subject].stats.wil = 6;   // wilful: band 3, and the modifier below takes it to the top
  R.startMorning(g, rng); g.title = app.title;
  g.phase = 'evening'; g.leftToday = [];
  const card = { id: subject, band: 'failed', choreId: '', choreName: 'a duty', choreLine: 'did not get to it. i know.', alone: false, event: null, late: false, time: '9:12 PM', register: 'trouble', opener: tell(C.TROUBLE_OPENERS[0], subject), closer: C.CLOSERS[0],
    disclosure: { penalty: 0, notes: [], chance: 0 }, dutyState: 'honest', dutyClaim: null, gradeLine: null, gradeState: 'none', grades: g.chars[subject].grades, showDutyLine: true, done: false, sent: null, result: null, mod: 2 };
  g.cards = [card]; g.queue = [subject]; g.cursor = 0;
  app.rng = rng; app.g = g; app.drafts = {}; app.openComposer = subject; app.peek = null;
  renderEvening();
}
function continueGame(saved) {
  app.rng = seed(); app.g = saved.g; app.title = saved.title; app.settings = { ...app.settings, ...(saved.settings || {}) };
  app.g.title = app.title; app.drafts = {}; app.openComposer = null; app.armed = null; app.pres = null;
  const g = app.g;
  if (g.phase === 'over' || R.isOver(g)) showEnd();
  else if (g.phase === 'new') showMemo();
  else if (g.phase === 'evening') renderEvening();
  else if (g.phase === 'report') renderReport();
  else if (g.phase === 'boundary') nextDay();
  else if (g.phase === 'president') renderPresident();
  else renderBoard();
}
function nextDay() {
  if (R.isOver(app.g)) return showEnd();
  if (app.stage) app.stage.clearMarks();
  R.startMorning(app.g, app.rng); app.g.title = app.title; app.armed = null; app.statsOpen = null; app.peek = null; app.drafts = {}; app.openComposer = null; app.pres = null;
  save();
  if (app.g.phase === 'president') renderPresident(); else renderBoard();
}

// ── The opening: the memo, and the login ─────────────────────────
function showMemo() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = null;
  const g = app.g, M = C.MEMO;
  setScreen(plain(h('div', { class: 'doc' },
    h('div', { class: 'doc-crest' }, 'Ω Τ Κ'), h('div', { class: 'doc-org' }, M.org), h('div', { class: 'doc-rule' }),
    h('h2', {}, M.title), h('div', { class: 'doc-sub' }, M.sub),
    h('div', { class: 'doc-meta' }, h('div', {}, h('b', {}, 'Issued: '), M.issued), h('div', {}, h('b', {}, 'To: '), 'the sister named below (' + app.title + ')'), h('div', {}, h('b', {}, 'Re: '), M.re)),
    h('div', { class: 'doc-rule soft' }),
    h('div', { class: 'doc-body' }, M.body.map(t => h('p', {}, t)),
      g.roster.map(id => h('div', { class: 'doc-entry' }, h('div', { class: 'who' }, CH[id].name), h('div', { class: 'viol' }, CH[id].file))),
      h('p', { class: 'fine' }, M.foot)),
    h('div', { class: 'doc-sig' }, M.sig),
    h('button', { class: 'doc-btn', onclick: showLogin }, 'Acknowledge'))));
}
function showLogin() {
  const handle = '@' + app.title.toLowerCase().replace(/[^a-z0-9]+/g, '') ;
  const go = h('button', { class: 'doc-btn', onclick: () => { go.disabled = true; go.textContent = 'Signing in…'; card.classList.add('loading'); setTimeout(enterApp, 1500); } }, 'Sign in');
  const card = h('div', { class: 'doc login' },
    h('div', { class: 'doc-crest' }, 'Ω Τ Κ'), h('div', { class: 'doc-org' }, 'omegataukappa.social'), h('div', { class: 'doc-rule' }),
    h('p', { class: 'login-lede' }, 'Sisters only. This network is closed to everyone outside the house.'),
    h('label', { class: 'field' }, h('span', {}, 'Sister handle'), h('input', { type: 'text', value: handle, readonly: true })),
    h('label', { class: 'field' }, h('span', {}, 'Password'), h('input', { type: 'password', value: 'password', readonly: true })),
    h('div', { class: 'bar-load' }, h('i', {})), go);
  setScreen(plain(card));
}
function enterApp() { nextDay(); }

// ── Cards for people ────────────────────────────────────────────
function effLine(id) {
  const c = app.g.chars[id], e = R.effectiveAttention(c.stats, c.grades);
  return 'At duties: ' + e.value + (e.mod ? ' (' + (e.mod > 0 ? '+' : '−') + Math.abs(e.mod) + ' from state' + (R.gradeMod(c.grades) ? ', grades' : '') + ')' : '');
}
// A sister’s file: the six measures, her Grades, and the official write-up on record (the underlying truth is kept until she is Cleared).
function statsPanel(id) {
  const g = app.g, d = CH[id], c = g.chars[id], s = c.stats;
  const rows = C.STATS.map(k => h('div', { class: 'stat-row', title: C.STAT_HINTS[k] }, h('div', { class: 'stat-name' }, C.STAT_NAMES[k]), pips(s[k], k === 'wil' || k === 'res' ? 'hot' : '')));
  return h('div', { class: 'stats-panel', id: 'stats-' + id },
    h('div', { class: 'stats-head' }, avatar(d.name), h('div', {}, h('div', { class: 'nm' }, d.name + ', ' + d.age), h('div', { class: 'hd' }, d.handle)),
      h('div', { class: 'close', onclick: () => { app.statsOpen = null; app.peek = null; rerender(); } }, '×')),
    rows,
    h('div', { class: 'stats-foot' }, 'Grades ', h('span', { class: 'grade-tag ' + gradeClass(c.grades) }, c.grades),
      R.gradeMod(c.grades) ? h('span', { class: 'drag' }, ' · ' + R.gradeMod(c.grades) + ' on every duty while she is behind') : null,
      h('div', { class: 'file' }, effLine(id) + ' · night ' + Math.max(1, c.nights || 0) + ' on Probation'),
      h('div', { class: 'file' }, h('b', {}, 'On file: '), d.file)));
}
function endStats(id, final) {
  const s = final || app.g.chars[id].stats;
  const rows = []; for (const k of C.STATS) rows.push(h('span', { class: 'k', title: C.STAT_HINTS[k] }, C.STAT_NAMES[k]), pips(s[k], k === 'wil' || k === 'res' ? 'hot' : ''));
  return h('div', { class: 'estats' }, rows);
}
function rerender() { const g = app.g; if (!g) return; if (app.view === 'board') renderBoard(); else if (app.view === 'evening') renderEvening(); }

// ── The pinned post, and the duty register ───────────────────────
function pinnedPost() {
  const P = C.PINNED_POST;
  return h('div', { class: 'pinned' }, h('div', { class: 'pinned-tag' }, '⚑ ' + P.tag),
    h('div', { class: 'post-head' }, h('div', { class: 'avatar brass' }, P.initial), h('div', { class: 'who' }, h('div', { class: 'name' }, P.author), h('div', { class: 'handle' }, P.handle + ' · chapter president'))),
    h('p', { class: 'post-text' }, P.text));
}

// ── Morning: the duty board ─────────────────────────────────────
function renderBoard() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = 'board';
  const g = app.g, placed = id => !!R.choreOf(g, id), ready = R.allAssigned(g);
  const place = (ci, si, id) => { R.assign(g, ci, si, id); app.armed = null; save(); renderBoard(); };
  const chips = g.roster.map(id => {
    const chip = h('div', { class: 'sister-chip' + (placed(id) ? ' assigned' : '') + (app.armed === id ? ' armed' : ''), draggable: !placed(id), onclick: () => {
      if (placed(id)) { R.unassign(g, id); renderBoard(); return; }
      app.armed = app.armed === id ? null : id; app.statsOpen = (app.statsOpen === id && !app.armed) ? null : id; if (app.statsOpen) focusOn('#stats-' + id); renderBoard();
    } }, avatar(CH[id].name), h('div', { class: 'nm' }, CH[id].name), h('div', { class: 'hd' }, CH[id].handle));
    chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; app.armed = id; });
    return chip;
  });
  const duties = g.chores.map((ch, ci) => {
    const slots = ch.slots.map((who, si) => {
      const slot = h('div', { class: 'duty-slot' + (who ? ' taken' : ''), onclick: () => {
        if (who && !app.armed) { R.unassign(g, who); renderBoard(); } else if (app.armed) place(ci, si, app.armed);
      } }, who ? [CH[who].name, h('span', { class: 'x' }, '×')] : (app.armed ? 'assign ' + CH[app.armed].name + ' here' : ch.def.paired ? 'sister ' + (si + 1) + ' — drag, or tap a sister then here' : 'drag a sister here — or tap her, then tap this'));
      slot.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drop'); });
      slot.addEventListener('dragleave', () => card.classList.remove('drop'));
      slot.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) place(ci, si, id); });
      return slot;
    });
    const card = h('div', { class: 'duty' + (ch.slots.every(Boolean) ? ' filled' : '') },
      h('div', { class: 'duty-top' }, h('div', { class: 'duty-name' }, ch.def.name), h('div', { class: 'duty-diff' }, 'difficulty ' + ch.def.diff)),
      h('div', { class: 'duty-stat' }, C.CHORE_STAT_NOTE[ch.def.id] || 'Attention', ch.def.paired ? ' · two sisters' : ''),
      slots);
    return card;
  });
  const n = g.roster.filter(placed).length;
  setScreen(appShell(h('div', {},
    g.day === 1 ? pinnedPost() : null,
    h('div', { class: 'board' },
      h('div', { class: 'section-label' }, 'On Social Probation'), h('div', { class: 'avatar-row' }, chips),
      h('div', { class: 'hint' }, 'Tap a sister to read her file. Drag her onto a duty to assign it, or tap her and then the duty. Tap a placed name to take her back.'),
      app.statsOpen && g.roster.includes(app.statsOpen) ? statsPanel(app.statsOpen) : null,
      h('div', { class: 'section-label', style: 'margin-top:22px' }, 'Today’s duties'), h('div', { class: 'duty-list' }, duties))),
    advanceBar(ready ? 'Duties assigned — go to this evening' : 'Assign every sister to continue', beginEvening, { disabled: !ready, caption: n + ' of ' + g.roster.length + ' placed' })));
  clearTimeout(app.advance);   // (the day does not start by itself: the button does it)
}
function beginEvening() {
  const g = app.g; R.resolveDay(g, app.rng); app.drafts = {}; app.openComposer = null; app.peek = null; app.statsOpen = null;
  save(); renderEvening();
}

// ── Evening: the timeline ───────────────────────────────────────
const BAND_LABEL = { well: 'Completed Well', completed: 'Completed', partial: 'Partial', failed: 'Failed' };
// The Big’s own record of the day: who had what, how it actually went, and where each sister’s standing sits. The only ground truth on a duty and on Grades:
// the posts themselves carry no markers, so a discrepancy has to be caught here.
function dutyRegister() {
  const g = app.g;
  const rows = g.cards.map(c => {
    const bandClass = c.band === 'well' ? 'reg-well' : c.band === 'completed' ? 'reg-done' : 'reg-bad';
    return h('div', { class: 'reg-row' }, avatar(CH[c.id].name), h('div', { class: 'reg-who' }, h('div', { class: 'reg-name' }, CH[c.id].name), h('div', { class: 'reg-duty' }, c.choreName || 'no duty assigned')),
      h('div', { class: 'reg-right' }, h('div', { class: 'reg-band ' + bandClass }, c.choreName ? (c.alone ? 'Failed (alone)' : BAND_LABEL[c.band]) : '—'), h('div', { class: 'grade-tag ' + gradeClass(c.grades) }, c.grades)));
  });
  return h('div', { class: 'register' }, h('div', { class: 'reg-head' }, h('span', { class: 'reg-title' }, 'Duty register'), h('span', { class: 'reg-sub' }, 'day ' + g.day + ' · your assessment')), rows);
}
function renderEvening() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = 'evening';
  const g = app.g;
  if (!g.cards.length) return endNight();
  const done = g.cards.every(c => c.done), sent = g.cards.filter(c => c.done).length;
  setScreen(appShell(h('div', {}, dutyRegister(), pinnedPost(), g.cards.map(postNode)),
    advanceBar(done ? 'File tonight’s Probation Report' : 'Every sister needs a message before you can file', goReport, { disabled: !done, caption: sent + ' of ' + g.cards.length + ' sent · no skips', extra: h('div', { class: 'candle-line' }, candle()) })));
}
// What she says about the duty (which may not be what happened), and what she says about her Grades: no tell on either, the register is the only ground truth.
function postNode(card) {
  const id = card.id, d = CH[id], open = app.openComposer === id && !card.done, ev = card.event;
  const dutySaid = card.dutyState === 'false' ? card.dutyClaim : card.dutyState === 'omitted' ? null : card.choreLine;
  const body = [];
  if (ev) {
    if (!ev.concealed && ev.cw) body.push(h('span', { class: 'cw' }, ev.cw));
    body.push(h('p', { class: 'post-text' }, ev.concealed ? ev.cover : ev.post));
    if (card.showDutyLine && dutySaid) body.push(h('p', { class: 'post-duty' }, dutySaid));
  } else if (dutySaid) body.push(h('p', { class: 'post-text' }, dutySaid));
  if (card.gradeLine) body.push(h('p', { class: 'post-duty' }, card.gradeLine));
  // The president’s note on the report: the only ground truth on an event, and she cannot see it.
  const note = ev ? h('div', { class: 'pres-comment' }, h('div', { class: 'pc-head' }, h('div', { class: 'pc-avatar' }, 'ΩΤΚ'), h('div', { class: 'pc-who' }, 'president ', h('span', {}, '@president')), h('div', { class: 'pc-private' }, 'not visible to ' + d.handle)), h('div', { class: 'pc-body' }, ev.truth)) : null;
  const action = card.done ? h('button', { class: 'dm-btn sent' }, '✓ sent') : h('button', { class: 'dm-btn' + (open ? ' open' : ''), onclick: () => { app.openComposer = open ? null : id; if (!open) focusOn('#post-' + id); renderEvening(); } }, 'direct message');
  return h('div', { class: 'post' + (open ? ' active' : '') + (card.done ? ' done' : ''), id: 'post-' + id },
    h('div', { class: 'post-head' }, h('div', { onclick: () => { app.peek = app.peek === id ? null : id; if (app.peek) focusOn('#stats-' + id); renderEvening(); } }, avatar(d.name)), h('div', { class: 'who' }, h('div', { class: 'name' }, d.name), h('div', { class: 'handle' }, d.handle)),
      h('div', { class: 'timestamp' + (card.late ? ' late' : '') }, card.time)),
    body, note, h('div', { class: 'post-actions' }, action),
    app.peek === id ? statsPanel(id) : null,
    card.done ? sentBlock(card) : (open ? composer(card) : null));
}
function sentBlock(card) {
  const s = card.sent;
  if (!s) return null;
  return h('div', { class: 'sent-msg' }, h('div', { class: 'lbl' }, 'Sent to ' + CH[card.id].handle), h('div', { class: 'body' }, s.message),
    s.after ? h('div', { class: 'lbl', style: 'margin-top:10px' }, 'Afterwards') : null, s.after ? h('div', { class: 'body' }, C.AFTER_CLAUSE[s.after]) : null);
}

// ── The composer: the direct message ─────────────────────────────
// The message is built from what you choose, in a fixed order (position, implement, clothing, severity, length); nothing is locked until Send, and nothing costs anything:
// the choices are where the correction begins, and every one of them can be changed once she is in the room.
const POS_DEFAULT = 'lap', IMPL_DEFAULT = 'hand', CLOTHES_DEFAULT = 'baseline';
const dual = id => window.Starlight.IMPLEMENTS[SC.engineImpl(id)].dual;
const IMPL_CHIP = { hand: 'Hand', hairbrush: 'The Hairbrush', pingpong: 'The Ping-Pong Paddle', ownpaddle: 'Her Own Paddle', housepaddle: 'The House Paddle' };
const implPhrase = { hand: 'hand', hairbrush: 'hairbrush', pingpong: 'ping-pong paddle', ownpaddle: 'paddle', housepaddle: 'house paddle' };
const IMPL = Object.fromEntries(SC.IMPLEMENTS.map(([id, label, blurb]) => [id, { label, blurb }]));
const POS = Object.fromEntries(SC.POSITIONS.map(([id, label, blurb]) => [id, { label, blurb }]));
function draftOf(card) { return app.drafts[card.id] || (app.drafts[card.id] = { position: POS_DEFAULT, implement: IMPL_DEFAULT, clothing: CLOTHES_DEFAULT, severity: null, length: null, reprieve: null, reprieveLine: null }); }
// What she is sent: the opener, how to arrive (the clothing), the closer. Position, implement, severity and length are not in it: they only set where the scene begins.
function messageText(card, d) {
  if (d.reprieve) return d.reprieveLine;
  return [card.opener, C.CLOTHING[d.clothing].clause, card.closer].join(' ');
}
function composer(card) {
  const g = app.g, id = card.id, d = draftOf(card);
  const chip = (label, { selected, disabled, title, onclick, cls, extra }) => h('div', { class: 'chip' + (cls ? ' ' + cls : '') + (selected ? ' selected' : '') + (disabled ? ' muted' : ''), title: title || null, onclick: disabled ? null : onclick }, label, extra || null);
  const group = (label, chips) => [h('div', { class: 'group-label' }, label), h('div', { class: 'chip-row' }, chips)];
  const set = (k, v, keep) => () => { d.reprieve = null; d.reprieveLine = null; d[k] = (!keep && d[k] === v) ? (k === 'severity' || k === 'length' ? null : v) : v; if (d.position === 'spread' && !dual(d.implement)) d.position = POS_DEFAULT; renderEvening(); };
  const positions = group('Position', SC.POSITIONS.map(([v, l]) => chip(l, { selected: !d.reprieve && d.position === v, disabled: v === 'spread' && !dual(d.implement), title: v === 'spread' && !dual(d.implement) ? 'Needs a paddle' : POS[v].blurb, onclick: set('position', v, true) })));
  const impls = group('Implement', SC.IMPLEMENTS.map(([v]) => chip(IMPL_CHIP[v], { selected: !d.reprieve && d.implement === v, title: IMPL[v].blurb, onclick: set('implement', v, true) })));
  const clothes = group('Clothing', Object.entries(C.CLOTHING).map(([v, c]) => chip(c.label, { selected: !d.reprieve && d.clothing === v, onclick: set('clothing', v, true) })));
  const severity = group('Severity', Object.entries(C.SEVERITY).map(([v, c]) => chip(c.label, { selected: !d.reprieve && d.severity === v, onclick: set('severity', v) })));
  const length = group('Length', Object.entries(C.LENGTH).map(([v, c]) => chip(c.label, { selected: !d.reprieve && d.length === v, onclick: set('length', v) })));
  const words = group('Or offer a word instead (replaces the correction)', Object.entries(C.REPRIEVES).map(([k, r]) => chip(r.name, { cls: 'reprieve', selected: d.reprieve === k, disabled: g.candle < r.cost, title: r.blurb, extra: costIcons(r.cost),
    onclick: () => { if (d.reprieve === k) { d.reprieve = null; d.reprieveLine = null; } else { d.reprieve = k; d.reprieveLine = tell(pick(C.REPRIEVE_LINES[k]), id); } renderEvening(); } })));
  const preview = d.reprieve ? h('div', { class: 'draft-preview' }, h('span', { class: 'reprieve-tag' }, 'Reprieve — ' + C.REPRIEVES[d.reprieve].name), d.reprieveLine) : h('div', { class: 'draft-preview' }, messageText(card, d));
  const note = d.reprieve ? C.REPRIEVES[d.reprieve].blurb : 'She is told only how to arrive. Position, implement, severity and length are where the scene begins; all of it is yours to change in the room.';
  return h('div', { class: 'composer expanded' }, h('div', { class: 'composer-inner' },
    h('div', { class: 'composer-header' }, h('span', {}, 'New message'), h('span', { class: 'to' }, 'to ' + CH[id].handle)),
    preview, h('div', { class: 'card-groups' }, positions, impls, clothes, severity, length, words),
    h('div', { class: 'divider' }),
    h('div', { class: 'composer-footer' }, h('div', { class: 'slot-count' }, note), h('button', { class: 'send-btn', onclick: () => sendMessage(card) }, 'Send'))));
}
// Send is the only commit.
function sendMessage(card) {
  const g = app.g, id = card.id, d = draftOf(card), text = messageText(card, d);
  app.restoreY = window.scrollY;   // (the evening is where you left it when you come back)
  if (d.reprieve) {
    const snap = R.applyReprieve(g, id, d.reprieve); if (!snap) return;
    R.recordSent(g, id, { message: text, kind: 'reprieve', reprieve: d.reprieve });
    delete app.drafts[id]; app.openComposer = null; save();
    return showResult(snap, { stage: false });
  }
  R.recordSent(g, id, { message: text, kind: 'correction', picks: { position: d.position, implement: d.implement, clothing: d.clothing, severity: d.severity, length: d.length } });
  save(); app.openComposer = null;
  startCorrection(card, d);
}
// She reads it, and comes: a beat over the veil, then the room.
const KNOCKS = ['{Name} reads it, puts her phone face down on the desk, and sits very still for a moment. Then she gets up.', '{Name} reads it twice. A few minutes later there is a knock at your door.', 'The message is marked read. Down the hall, a door opens, and closes, and footsteps come your way.'];
async function startCorrection(card, d) {
  const id = card.id, K = C.CLOTHING[d.clothing], S_ = d.severity && C.SEVERITY[d.severity], L_ = d.length && C.LENGTH[d.length];
  const v = $('#veil'); v.replaceChildren(h('p', { class: 'ln' }, tell(pick(KNOCKS), id))); v.hidden = false; requestAnimationFrame(() => v.classList.add('on'));
  await delay(1700);
  try {
    await startLive(card, { position: d.position, implement: d.implement, look: K.look, layers: { ...K.layers }, preset: { strength: S_ ? S_.strength : undefined, pace: L_ ? L_.pace : undefined, run: L_ ? L_.run : undefined } });
  } finally { v.classList.remove('on'); await delay(450); v.hidden = true; v.replaceChildren(); }
}

// ── Goodbyes: the safe word, and being Cleared ───────────────────
function noticeCard(n) {
  const d = CH[n.id];
  return h('div', { class: 'notice word' }, h('h3', {}, d.name + ' called the safe word'), h('p', { class: 'say' }, fmt(C.SAYINGS.word[0])),
    h('p', {}, 'It stopped, as it should. ' + (n.need - n.count === 1 ? 'Once more, and ' + d.name + ' will request a new Big.' : n.count + ' of ' + n.need + ' calls so far.')), chipsFor(n.changes || []));
}
// A goodbye is a scene; the safe word (called and not final) is a card. Whoever is leaving is seen off first.
function showNotices(title, notices, then, label) {
  const scenes = notices.filter(n => n.type === 'moveon' || n.type === 'word'), rest = notices.filter(n => n.type === 'safeword');
  const showRest = () => {
    if (!rest.length) return then();
    const o = $('#overlay'); o.dataset.dismiss = 'no';
    modal(h('h2', {}, title), rest.map(noticeCard), h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => { closeModal(); then(); } }, label || 'Continue')));
  };
  if (scenes.length) playScenes(scenes).then(showRest); else showRest();
}
async function playScenes(list) { for (const n of list) if (!n.played && (n.type === 'moveon' || n.type === 'word')) await playScene(n); }

// A goodbye: the sister standing in the room, a few beats of narration and talk, and a choice for you. (Lines in content.js SCENES.)
async function playScene(notice) {
  notice.played = true;
  const S = window.Starlight, id = notice.id, d = CH[id], box = $('#scene');
  teardownLive(); closeModal(); say(null, null); app.view = 'scene'; setScreen(h('div'));
  const stage = await ensureStage();
  let ch = null;
  await busy('', async () => {
    showStage(true);
    ch = S.buildCharacter(S.clone(B.spec(id)), { voxel: 0.011, key: id });
    stage.scene.add(ch.group); ch.helper.visible = false; S.resetCharacter(ch, notice.type === 'word' ? 'Downcast' : 'Watch');
    // she stands in front of the door, on her way out, with it in view behind her
    ch.group.position.set(1.45, 0, -2.45); ch.group.updateMatrixWorld(true);
    stage.camera.position.set(0.3, 1.4, 1.2); stage.controls.target.set(1.45, 1.1, -2.6); stage.controls.enabled = true; stage.camera.fov = 40; stage.camera.updateProjectionMatrix();
    stage.loop((dt, t) => { S.animateCharacter(ch, dt, t); ch.group.updateMatrixWorld(true); S.hairStep(ch, dt, S.bodyColliders(ch)); S.faceStep(ch, dt); S.skirtStep(ch, dt, [ch], []); });
  });
  const beats = R.farewellScene(notice.type === 'word' ? 'word' : 'moveon', id, { why: notice.why, mood: notice.mood, title: app.title });
  await new Promise(done => {
    let i = 0;
    const show = (who, text, then, extra) => {
      const line = h('p', { class: 'sline ' + who }, who === 'r' ? [h('b', {}, d.name), ' '] : null, text);
      box.replaceChildren(line, extra || h('div', { class: 'row' }, h('button', { class: 'primary', onclick: then }, 'Continue')));
    };
    const next = () => {
      if (i >= beats.length) return done();
      const b = beats[i++];
      if (b.n) show('n', b.n, next);
      else if (b.r) show('r', b.r, next);
      else {
        box.replaceChildren(h('p', { class: 'sline n' }, 'What do you say?'), h('div', { class: 'picks' }, b.ask.map(a => h('button', { class: 'pick', onclick: () => {
          box.replaceChildren(h('p', { class: 'sline you' }, a.you), h('p', { class: 'sline r' }, h('b', {}, d.name), ' ', a.r), h('div', { class: 'row' }, h('button', { class: 'primary', onclick: next }, 'Continue')));
        } }, h('b', {}, a.label)))));
      }
    };
    box.hidden = false; next();
  });
  box.hidden = true; box.replaceChildren();
  stage.loop(null); stage.scene.remove(ch.group, ch.helper); S.disposeCharacter(ch);
  showStage(false);
}

// ── The live correction ─────────────────────────────────────────
function teardownLive() {
  clearTimeout(app.advance);
  if (app.live) { try { app.live.onChange = null; app.live.onImpact = null; } catch (e) { /* */ } }
  if (app.stage && app.stage.session) app.stage.end();
  app.live = null; app.refreshGuidance = null; document.removeEventListener('keydown', onKey); document.body.classList.remove('live');
  const v = $('#veil'); if (v && !app.keepVeil) { v.hidden = true; v.classList.remove('on'); }
}
function onKey(e) {
  const s = app.live; if (!s || e.target.tagName === 'INPUT' || e.code !== 'Space' || !$('#overlay').hidden) return;
  e.preventDefault(); s.smack();
}
async function startLive(card, set) {
  const id = card.id, d = CH[id];
  app.keepVeil = true; app.view = 'live';
  try {
    await busy('Setting the room…', async () => {
      const stage = await ensureStage();
      app.openComposer = null;
      teardownLive();
      showStage(true); setScreen(h('div')); document.body.classList.add('live');   // the view takes the pointer (see css .live)
      app.live = stage.begin({ giver: B.keeper(), subject: B.spec(id, set.look), subjectId: id, position: set.position, implement: set.implement, layers: { ...set.layers }, pain: { ...d.pain }, composure: app.g.chars[id].stats.com, stats: { ...app.g.chars[id].stats } });
      app.live.preset(set.preset || {});
      stage.setCamera(app.camera || 'overview');
    });
  } finally { app.keepVeil = false; }
  const ses = app.live; SC.Sound.set(app.settings.sound);
  say(id, d.lines.open[Math.floor(app.rng() * d.lines.open.length)]);
  ses.card = card; ses.look = set.look; ses.talked = false; ses.talkChanges = [];
  buildLiveDock(ses, card);
  document.addEventListener('keydown', onKey);
  maybeTutorial(ses);
}

// ── The first correction's walk-through (offered once; either answer is remembered) ──
const TUTORIAL = [
  { sel: '.hudcard .meter', title: 'The meter', text: 'This shows how far you have brought her. The shaded band is what she needs tonight, and the white tick is the edge of her resistance. Where you stop counts, not where she ends up.' },
  { sel: '.hudcard .b-smack', title: 'Smack', text: 'One smack, with the hand or whatever you are holding. Press it now to try one.', wait: s => s.st.smacks >= 1, waitText: 'Waiting for your first smack…' },
  { sel: '.hudcard .nudges', title: 'Pace and strength', text: 'Slower and Faster change how quickly each one comes; Softer and Harder, how firmly. Both change how it lands, and how she takes it.' },
  { sel: '.hudcard .acts', title: 'A run', text: 'Run gives a short run of smacks without you pressing each one; the number beside it sets how many. Stop (the same button) halts it whenever you like.' },
  { sel: '.hudtools button[aria-label^="Position"]', title: 'Position, implement and clothes', text: 'Choose a new position, implement and what she wears all at once, then confirm. She is kept exactly as she is while the scene changes, and a new implement has to be fetched.' },
  { sel: '.hudtools', title: 'Camera and sound', text: 'The camera button cycles the standard angles, and you can always drag or scroll the view yourself. The speaker turns the sound off.' },
  { sel: '.hudcard .primary', title: 'Ending it', text: 'End the correction when she has had what she needed. If she calls the safe word (“Red”), everything stops at once, and it costs her. Take it seriously.' },
];
function maybeTutorial(ses) {
  if (recall('otk.tutorial')) return;
  store('otk.tutorial', 1);
  const o = $('#overlay'); o.dataset.dismiss = 'no';
  modal(h('h2', {}, 'Your first correction'), h('p', {}, 'Would you like a step-by-step walk-through of the controls? It points at each one in turn. You can skip it at any point.'),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => { closeModal(); runTutorial(ses); } }, 'Walk me through'), h('button', { onclick: closeModal }, 'No thanks')));
  o.dataset.dismiss = 'no';
}
function runTutorial(ses) {
  let i = 0, hl = null, poll = null;
  const coach = h('div', { class: 'coach' });
  $('#app').append(coach);
  const finish = () => { clearInterval(poll); if (hl) hl.classList.remove('tut-hl'); coach.remove(); };
  const show = () => {
    clearInterval(poll); if (hl) hl.classList.remove('tut-hl'); hl = null;
    if (i >= TUTORIAL.length || app.live !== ses) return finish();
    const t = TUTORIAL[i]; hl = document.querySelector(t.sel); if (hl) hl.classList.add('tut-hl');
    const next = () => { i++; show(); };
    const nextBtn = h('button', { class: 'primary', onclick: next }, i === TUTORIAL.length - 1 ? 'Done' : 'Next');
    coach.replaceChildren(h('div', { class: 'step' }, 'Step ' + (i + 1) + ' of ' + TUTORIAL.length), h('h4', {}, t.title), h('p', {}, t.text), ...(t.waitText ? [h('p', { class: 'wait' }, t.waitText)] : []),
      h('div', { class: 'row' }, nextBtn, h('button', { class: 'quiet', onclick: finish }, 'Skip the rest')));
    if (t.wait) poll = setInterval(() => { if (app.live !== ses) return finish(); if (t.wait(ses)) { clearInterval(poll); setTimeout(next, 900); } }, 300);
  };
  show();
}

function buildLiveDock(ses, card) {
  const id = card.id, d = CH[id], g = app.g;
  const expected = R.expectedBand(g.chars[id].stats, card), cuts = R.BAND_CUTS, SCALE = 1.5;
  const lo = expected === 0 ? 0 : cuts[expected - 1], hi = cuts[expected];
  const fill = h('div', { class: 'fill' }), aim = h('div', { class: 'aim', style: 'left:' + (lo / SCALE * 100) + '%;width:' + ((hi - lo) / SCALE * 100) + '%' });
  const meter = h('div', { class: 'meter' }, aim, fill, h('div', { class: 'edge', title: 'The edge of resistance' }));
  const reading = h('div', { class: 'reading' }), aimText = h('small', {});
  app.refreshGuidance = () => { aim.hidden = !app.settings.guidance; aimText.textContent = app.settings.guidance ? 'Aim for ' + R.BANDS[expected] + ' (shaded). The white tick is the edge of resistance.' : ''; };
  app.refreshGuidance();

  // The HUD over the view: the name at the top left, a camera button and a scene button (position, implement, clothes) at the top right, and one floating card.
  const ICON = {
    camera: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    scene: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.2"/><path d="M8 8v5l-3 5M8 13l3 5M5 10.5h6"/><path d="M15 7h5M15 12h5M15 17h5"/></svg>',
  };
  ICON.soundOn = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  ICON.soundOff = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  const icon = (svg, title, fn) => { const b = h('button', { class: 'ico', title, 'aria-label': title, onclick: fn }); b.innerHTML = svg; return b; };
  const camNames = SC.CAMERAS.map(c => c[0]), camLabel = Object.fromEntries(SC.CAMERAS);
  const camBtn = icon(ICON.camera, 'Camera angle', () => { const i = camNames.indexOf(app.stage.cameraMode); app.camera = camNames[(i + 1) % camNames.length]; app.stage.setCamera(app.camera); camTip(); sync(); });
  const soundBtn = icon(app.settings.sound ? ICON.soundOn : ICON.soundOff, 'Sound', () => {
    app.settings.sound = !app.settings.sound; SC.Sound.set(app.settings.sound); saveSettings(); setSoundLabel();
    soundBtn.innerHTML = app.settings.sound ? ICON.soundOn : ICON.soundOff; soundBtn.title = 'Sound: ' + (app.settings.sound ? 'on' : 'off');
  });
  soundBtn.title = 'Sound: ' + (app.settings.sound ? 'on' : 'off');
  const camTipEl = h('div', { class: 'camtip', hidden: true });
  let camTipT; const camTip = () => { camTipEl.textContent = camLabel[app.camera]; camTipEl.hidden = false; clearTimeout(camTipT); camTipT = setTimeout(() => { camTipEl.hidden = true; }, 1400); };
  const sceneBtn = icon(ICON.scene, 'Position, implement and clothes', () => { ses.stop(); showSceneMenu(ses); });
  // pace, strength, run length
  const nudge = (label, fn) => h('button', { class: 'nb', onclick: () => { fn(); sync(); } }, label);
  const paceVal = h('b', { class: 'mult', title: 'Pace' }), strVal = h('b', { class: 'mult', title: 'Strength' });
  const slower = nudge('Slower', () => ses.stepPace(-1)), faster = nudge('Faster', () => ses.stepPace(1));
  const softer = nudge('Softer', () => ses.stepStrength(-1)), harder = nudge('Harder', () => ses.stepStrength(1));
  const runVal = h('b', {}), runMinus = h('button', { class: 'tiny', 'aria-label': 'Fewer smacks in a run', onclick: () => { ses.stepRun(-1); sync(); } }, '−'), runPlus = h('button', { class: 'tiny', 'aria-label': 'More smacks in a run', onclick: () => { ses.stepRun(1); sync(); } }, '+');
  const smack = h('button', { class: 'b-smack', onclick: () => ses.smack() }, 'Smack');
  const run = h('button', { onclick: () => { if (ses.running) ses.stop(); else ses.run(); } }, 'Run');
  const info = h('div', { class: 'hint' }), end = h('button', { class: 'primary', onclick: () => finishLive(ses, card) }, 'End the correction');
  const card_ = h('div', { class: 'hudcard' },
    h('div', { class: 'rd' }, reading), meter, aimText, info,
    h('div', { class: 'nudges' }, h('div', { class: 'pairb' }, slower, paceVal, faster), h('div', { class: 'pairb' }, softer, strVal, harder)),
    h('div', { class: 'acts' }, h('div', { class: 'runset', title: 'How many smacks a run gives' }, runMinus, runVal, runPlus), run, smack),
    end);
  setScreen(h('div', { class: 'hud' }, h('div', { class: 'hudname' }, d.name), h('div', { class: 'hudtools' }, camBtn, soundBtn, sceneBtn), camTipEl, card_));

  const sync = () => {
    camBtn.title = 'Camera angle: ' + camLabel[app.stage.cameraMode === 'free' ? app.camera || 'overview' : app.stage.cameraMode];
    runVal.textContent = ses.runLength;
    paceVal.textContent = '×' + ses.pace; strVal.textContent = '×' + ses.strengthMult;
    slower.disabled = ses.pace <= SC.PACE[0]; faster.disabled = ses.pace >= SC.PACE[SC.PACE.length - 1];
    softer.disabled = ses.strengthMult <= SC.STRENGTH[0]; harder.disabled = ses.strengthMult >= SC.STRENGTH[SC.STRENGTH.length - 1];
    slower.title = faster.title = 'Pace ×' + ses.pace; softer.title = harder.title = 'Strength ×' + ses.strengthMult;
    runMinus.disabled = ses.runLength <= SC.RUN[0]; runPlus.disabled = ses.runLength >= SC.RUN[SC.RUN.length - 1];
  };
  ses.syncDock = sync; sync(); app.stage.onCameraTaken(() => sync());
  let spoke = false, last = 0;
  ses.onChange = () => {
    const now = performance.now(); if (now - last < 80) return; last = now;
    const dist = ses.distress();
    fill.style.width = Math.min(100, dist / SCALE * 100) + '%';
    fill.style.background = dist < 0.3 ? '#6b9e5a' : dist < 0.6 ? '#b4a24a' : dist < 0.9 ? '#c8803c' : dist < 1 ? '#c24a3a' : dist < 1.5 ? '#b08ad0' : '#7a1f1f';
    reading.replaceChildren(h('span', {}, cap(ses.band())), h('small', {}, ses.st.smacks + (ses.st.smacks === 1 ? ' smack' : ' smacks')));
    const can = ses.canStrike();
    smack.disabled = !can || ses.running;
    run.textContent = ses.running ? 'Stop' : 'Run'; run.disabled = !can && !ses.running;
    // Past the point of no return she stops: nothing further is struck.
    if (ses.st.tooHarsh && !spoke) {
      spoke = true; const st_ = app.g.chars[id].stats, calls = st_.val <= 3 || st_.res >= 5;
      info.textContent = calls ? d.name + ' has called the safe word. Nothing more will be struck.' : d.name + ' has been brought too far. Nothing more will be struck.';
      say(id, calls ? C.SAYINGS.word[0] : C.SAYINGS.harsh[0], null, calls); end.textContent = 'End it';
    }
  };
  ses.onChange(ses);
}

// Position, implement and clothes, chosen together in one pop-up; nothing happens until the changes are confirmed.
function showSceneMenu(ses) {
  ses.freeze();   // composure holds still from here until the first smack or run
  const id = ses.card.id;
  const want = { position: ses.position, implement: ses.implement, layers: { bottoms: !!ses.layers.bottoms, briefs: !!ses.layers.briefs }, how: 'ask' };
  const avail = ses.layerAvailable(), body = h('div', {});
  const changed = () => want.position !== ses.position || want.implement !== ses.implement || want.layers.bottoms !== !!ses.layers.bottoms || want.layers.briefs !== !!ses.layers.briefs;
  const fetching = () => want.implement !== ses.implement && want.implement !== 'hand';
  const tabs = (items, cur, fn) => h('div', { class: 'picks2' }, items.map(([v, l, dis, tip]) => h('button', { class: v === cur ? 'on' : '', disabled: dis, title: tip || '', onclick: () => fn(v) }, l)));
  const paint = () => {
    const wideNeeded = want.position === 'spread';
    const pos = tabs(SC.POSITIONS.map(p => [p[0], p[1], p[0] === 'spread' && !dual(want.implement), p[0] === 'spread' && !dual(want.implement) ? 'Needs a paddle' : p[2]]), want.position, v => { want.position = v; paint(); });
    const imp = tabs(SC.IMPLEMENTS.map(p => [p[0], p[1], wideNeeded && !dual(p[0]), p[2]]), want.implement, v => { want.implement = v; paint(); });
    const how = fetching() ? [h('h4', {}, 'Getting the ' + implPhrase[want.implement]),
      tabs([['ask', 'Ask ' + CH[id].name, false, 'Politely.'], ['tell', 'Tell ' + CH[id].name, false, 'An order.'], ['self', 'Fetch it yourself', false, 'Say nothing, and go.']], want.how, v => { want.how = v; paint(); })] : [];
    const lay = ['bottoms', 'briefs'].filter(n => avail[n]).map(n => h('button', { class: want.layers[n] ? 'on' : '', disabled: n === 'briefs' && !want.layers.bottoms, onclick: () => { want.layers[n] = !want.layers[n]; if (n === 'bottoms' && !want.layers.bottoms) want.layers.briefs = false; paint(); } }, SC.layerLabel(n, want.layers[n])));
    body.replaceChildren(h('h4', {}, 'Position'), pos, h('h4', {}, 'Implement'), imp, ...how, avail.bottoms ? h('h4', {}, 'Clothes') : null, avail.bottoms ? h('div', { class: 'picks2' }, lay) : null,
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'primary', disabled: !changed(), onclick: () => { closeModal(); applyChanges(ses, want); } }, 'Confirm changes'), h('button', { onclick: closeModal }, 'Cancel')));
  };
  paint();
  modal(h('h2', {}, 'The scene'), h('p', { class: 'muted' }, 'Choose everything you want different, then confirm. ' + CH[id].name + ' will be kept exactly as ' + CH[id].pronouns[0] + ' is until you begin again.'), body);
}
// What changing the scene looks like, as it is read: the implement, then the position, then the clothes. Each entry is a line: { n } narration, { you } what the player says, { r } the subject.
function planChanges(ses, want) {
  const id = ses.card.id, st = app.g.chars[id].stats, mood = R.fetchMood(st), tone = R.toneFor(st), d = ses.distress(), K = C.CHANGE;
  const band = d < 0.3 ? 'calm' : d < 0.7 ? 'sore' : 'spent', lines = [], T = (t, x) => tell(t, id, x);
  const from = { position: ses.position, implement: ses.implement }, impName = implPhrase[want.implement];
  const implChanged = want.implement !== from.implement, posChanged = want.position !== from.position;
  const wasLap = from.position === 'lap';
  let up = false;
  const helpUp = () => { lines.push({ n: T(K.helpUp[band]) }); up = true; };
  // 1. the implement
  if (implChanged) {
    if (want.implement === 'hand') lines.push({ n: T(K.putDown, { Impl: implPhrase[from.implement] }) });
    else {
      if (wasLap) helpUp();
      if (want.how === 'self') {
        lines.push({ n: T(K.selfFetch, { Impl: impName }) }, { n: R.fetchReply('self', st, id, app.title, d) });
      } else {
        const opt = R.fetchOptions(st, impName).find(o => o.id === want.how);
        lines.push({ you: opt.line }, { n: R.fetchReply(want.how, st, id, app.title, d) });
      }
      if (!ses.talked) { ses.talked = true; const r = R.applyFetch(app.g, id, want.how); ses.talkChanges.push(...r.changes); }
    }
  }
  const fetched = implChanged && want.implement !== 'hand';
  // 2. the position
  if (posChanged) {
    if (wasLap && !up) { if (d >= 0.6) helpUp(); else lines.push({ you: T(K.standOrder[tone]) }, { n: T(K.obey[mood]) }, { n: T(K.stands) }); up = true; }
    lines.push({ you: T(K.position[want.position][tone]) }, { n: T(K.obey[mood]) }, { n: T(K.take[want.position]) });
  } else if (fetched) {
    lines.push({ n: want.how === 'self' ? T(K.selfBack, { Impl: impName }) : T(wasLap ? K.helpBack : K.backInPlace) });
    if (want.how === 'self' && wasLap) lines.push({ n: T(K.helpBack) });
  }
  // 3. the clothes
  const had = { bottoms: !!ses.layers.bottoms, briefs: !!ses.layers.briefs }, L = K.clothes; let touched = false;
  if (want.layers.bottoms !== had.bottoms) { lines.push({ n: T(want.layers.bottoms ? L.bottomsDown : L.bottomsUp) }); touched = true; }
  if (want.layers.briefs !== had.briefs) { lines.push({ n: T(want.layers.briefs ? L.briefsDown : L.briefsUp) }); touched = true; }
  if (touched && (want.layers.bottoms || want.layers.briefs) && app.rng() < 0.7) {   // (a reaction most times, never the one before)
    const pool = L.react[mood].filter(t => t !== app.lastReact), pk = pool[Math.floor(app.rng() * pool.length)];
    app.lastReact = pk; lines.push({ n: T(pk) });
  }
  return lines;
}
async function applyChanges(ses, want) {
  const id = ses.card.id, lines = planChanges(ses, want);
  ses.stop(); ses.freeze(); say(null, null);
  const v = $('#veil');
  const status = h('p', { class: 'wait' }, 'Setting the scene…');
  v.replaceChildren(...lines.map((l, i) => h('p', { class: 'ln' + (l.you ? ' you' : ''), style: 'animation-delay:' + (0.25 + i * 0.7) + 's' }, l.you ? fmt(l.you) : fmt(l.n))), status);
  v.hidden = false; requestAnimationFrame(() => v.classList.add('on'));
  await delay(700);   // (the text is already coming up while the room is built behind it)
  ses.st.layers.bottoms = want.layers.bottoms; ses.st.layers.briefs = want.layers.bottoms && want.layers.briefs;
  ses.rebuild({ position: want.position, implement: want.implement, elapsed: 0 });
  ses.freeze();
  ses.syncDock();
  await delay(Math.max(0, 1400 + lines.length * 700 - 700));   // (long enough to read the last line as it arrives)
  await new Promise(res => { status.replaceWith(h('button', { class: 'primary', onclick: res }, 'Continue')); });
  v.classList.remove('on'); await delay(450); v.hidden = true; v.replaceChildren();
  const line = R.reopenLine(id, app.g.chars[id].stats, ses.distress(), app.title, app.rng, app.lastReopen);
  app.lastReopen = line.raw; say(id, line.raw);
}
function finishLive(ses, card) {
  const g = app.g, id = card.id;
  const dress = { ...ses.layers };
  const done = ses.finish();
  const snap = R.applyCorrection(g, id, done);
  snap.changes = (ses.talkChanges || []).concat(snap.changes);
  snap.layers = dress; snap.look = ses.look;   // (the state of dress the correction ended on, and what she was wearing, for the aftercare scenes)
  document.removeEventListener('keydown', onKey);
  save();
  if (snap.word) {   // the safe word: no scorecard; whoever leaves is seen off, then back to the timeline
    const hud = $('#app .hud'); if (hud) hud.remove(); say(null, null);
    playScenes(snap.exits).then(() => { teardownLive(); showStage(false); renderEvening(); });
    return;
  }
  // keep the room and the bodies on screen behind the result
  say(id, snap.quality === 'well' ? C.SAYINGS.well[Math.floor(app.rng() * C.SAYINGS.well.length)] : snap.quality.startsWith('under') ? (snap.smacks ? C.SAYINGS.under[Math.floor(app.rng() * 3)] : C.SAYINGS.nothing[0]) : snap.tooHarsh ? C.SAYINGS.harsh[0] : C.SAYINGS.over[Math.floor(app.rng() * 3)]);
  showResult(snap, { stage: true });
}

// ── Results and aftercare ───────────────────────────────────────
function chipsFor(changes) {
  if (!changes.length) return h('div', { class: 'chg' }, h('span', {}, 'No change in how she is'));
  return h('div', { class: 'chg' }, changes.map(c => {
    const up = c.to > c.from, goodUp = !(c.stat === 'wil' || c.stat === 'res');
    return h('span', { class: (up === goodUp) ? 'up' : 'down' }, C.STAT_NAMES[c.stat] + ' ' + (up ? '▲ ' : '▼ ') + c.from + ' → ' + c.to);
  }));
}
function exitsBlock(exits) {
  // (being Cleared is not announced here: it is kept for the end of the evening, once every message has been sent)
  return exits.filter(n => n.type !== 'moveon').map(n => h('div', { class: 'exit' + (n.type === 'word' || n.type === 'safeword' ? ' word' : '') },
    n.type === 'safeword' ? CH[n.id].name + ' called the safe word. ' + fmt(C.SAYINGS.word[0]) + ' It stopped at once (' + n.count + ' of ' + n.need + ').' : CH[n.id].name + ' called the safe word. ' + fmt(C.SAYINGS.word[0]) + ' It stopped at once, and she has requested a new Big.'));
}
// On from the result: to the exits, then back to the timeline.
async function proceed(snap, wrap) { wrap.remove(); save(); await playScenes(snap.exits.filter(n => n.type === 'word')); teardownLive(); showStage(false); say(null, null); renderEvening(); }
// One of the aftercare scenes: the effect is applied, the room is set for it, the words are said, and then back to the result with the rest.
async function playAftercare(kind, snap, wrap, draw) {
  const g = app.g, id = snap.id, S_ = g.chars[id].stats;
  const r = R.applyAftercare(g, id, kind); if (!r) return;
  (snap.done || (snap.done = {}))[kind] = true; snap.aftercare = r.name; save();   // (just a mention on the card: it has been seen)
  wrap.hidden = true; say(null, null);
  await busy('Setting the scene…', async () => {
    await delay(50);
    app.stage.tableau(kind, { giver: B.keeper(), subject: B.spec(id, snap.look), subjectId: id, layers: { ...(snap.layers || {}) } });
  });
  const mood = R.fetchMood(S_), pool = C.AFTER_SCENES[kind][mood] || C.AFTER_SCENES[kind].plain, raw = pool[Math.floor(app.rng() * pool.length)];
  const text = tell(raw, id), you = kind === 'held' || kind === 'warm';
  const narr = you ? tell(C.AFTER_NARR[kind][Math.floor(app.rng() * C.AFTER_NARR[kind].length)], id) : null;
  await delay(900);
  // what is said or done is written in the card with the Continue button, not in a bubble: narration first, then the words themselves where there are any
  const bar = h('div', { class: 'hud' }, h('div', { class: 'hudcard scenebar' },
    narr ? h('p', { class: 'narr' }, fmt(narr)) : null, h('p', { class: you ? 'say you' : 'narr' }, fmt(text)),
    h('button', { class: 'primary', onclick: () => { bar.remove(); wrap.hidden = false; draw(); } }, 'Continue')));
  $('#app').append(bar);
}
// Sent to Bed: the room fades to a few lines about how she goes, and then on, as Next does.
async function sendToBed(snap, wrap) {
  const id = snap.id, mood = R.fetchMood(app.g.chars[id].stats), pool = C.AFTER_SCENES.bed[mood] || C.AFTER_SCENES.bed.plain;
  wrap.hidden = true; say(null, null);
  const v = $('#veil'); v.replaceChildren(h('p', { class: 'ln', style: 'animation-delay:.3s' }, fmt(tell(pool[Math.floor(app.rng() * pool.length)], id))), h('button', { class: 'primary', style: 'opacity:0;animation:lnIn .9s 1.6s forwards', onclick: async () => { v.classList.remove('on'); await delay(450); v.hidden = true; v.replaceChildren(); proceed(snap, wrap); } }, 'Next'));
  v.hidden = false; requestAnimationFrame(() => v.classList.add('on'));
}
function showResult(snap, { stage }) {
  const g = app.g, id = snap.id, d = CH[id];
  const wrap = h('div', { class: 'resultwrap' + (stage ? ' side' : '') });
  const body = h('div', { class: 'result' });
  const draw = () => {
    const here = g.roster.includes(id), canAfter = snap.kind === 'correction' && here && !snap.word;
    body.replaceChildren(...[
      h('h2', {}, snap.kind === 'reprieve' ? d.name + ': ' + snap.name : d.name),
      snap.kind === 'reprieve' && snap.text ? h('p', { class: 'say' }, snap.text) : null,
      snap.kind === 'reprieve' ? h('p', { class: 'small' }, snap.earned ? 'A fair read of her night.' : 'She had earned a correction tonight. The president will have a view.') : null,
      snap.kind === 'correction' ? [
        h('div', { class: 'verdict' }, snap.smacks ? snap.smacks + (snap.smacks === 1 ? ' smack. ' : ' smacks. ') : 'You decided that was enough without lifting a hand. ',
          snap.tooHarsh ? ['You took her past what she could bear; she needed ', h('b', {}, snap.expectedName), '.']
            : ['You brought her to ', h('b', {}, snap.reachedName), '; she needed ', h('b', {}, snap.expectedName), '.']),
        h('div', {}, snap.text + '.')] : null,
      (snap.lines || []).map(l => h('p', { class: 'say' }, l)), snap.aftercare ? h('p', { class: 'small', style: 'margin:8px 0' }, 'Afterwards: ' + snap.aftercare + '.') : null, snap.word ? null : chipsFor(snap.changes), exitsBlock(snap.exits),
      canAfter && !Object.keys(snap.done || {}).length ? [h('h4', {}, 'How does the evening end?'), h('p', { class: 'sub' }, 'One way, for this correction. What you choose is what ' + d.name + ' carries into the night.'), h('div', { class: 'choices' }, [...Object.entries(C.AFTERCARE).filter(([k]) => !(snap.done || (snap.done = {}))[k]).map(([k, a]) =>
        h('button', { class: 'choice paper', disabled: g.candle < a.cost, onclick: () => playAftercare(k, snap, wrap, draw) },
          h('b', {}, a.name, costIcons(a.cost)), h('span', {}, a.blurb))),
        h('button', { class: 'choice paper', onclick: () => sendToBed(snap, wrap) }, h('b', {}, 'Sent to Bed', h('span', { class: 'costtag' }, 'free')), h('span', {}, 'No more tonight. She goes up, and that is that.'))])] : null,
      !canAfter || Object.keys(snap.done || {}).length ? h('div', { class: 'row', style: 'margin-top:14px' }, candle(), h('span', { class: 'grow' }), h('button', { class: 'primary', onclick: () => proceed(snap, wrap) }, 'Next')) : h('div', { class: 'row', style: 'margin-top:14px' }, candle())].flat(Infinity).filter(Boolean));
  };
  draw(); wrap.append(body);
  if (!stage) { app.view = 'result'; setScreen(appShell(wrap)); } else $('#app').append(wrap);
  // the dock is replaced by the result when the room is on screen
  if (stage) { const hud = $('#app .hud'); if (hud) hud.remove(); }
}

// ── The night: the Probation Report ──────────────────────────────
function goReport() { app.g.phase = 'report'; save(); renderReport(); }
function pickLabels(p) {
  if (!p) return [];
  const out = [];
  if (p.position && p.position !== POS_DEFAULT) out.push(POS[p.position].label.toLowerCase());
  out.push(p.implement === 'hand' ? 'hand' : IMPL[p.implement].label.replace(/^The /, '').toLowerCase());
  if (p.clothing && p.clothing !== CLOTHES_DEFAULT) out.push(C.CLOTHING[p.clothing].label.toLowerCase());
  if (p.severity) out.push(C.SEVERITY[p.severity].label.toLowerCase());
  if (p.length) out.push(C.LENGTH[p.length].label.toLowerCase());
  return out;
}
// Auto-compiled from what was actually sent: one line per sister, not free text.
function renderReport() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = 'report';
  const g = app.g;
  const lines = g.cards.filter(c => c.done && c.sent).map(c => {
    const bits = [];
    if (c.choreName) bits.push(c.choreName + ' — ' + (c.alone ? 'failed (alone)' : BAND_LABEL[c.band].toLowerCase()));
    if (c.event) bits.push(C.CATEGORIES[c.event.cat].label.toLowerCase());
    if (!bits.length) bits.push('nothing logged');
    const s = c.sent, outcome = s.kind === 'reprieve' ? 'Reprieve — ' + C.REPRIEVES[s.reprieve].name + '.' : 'Correction — ' + pickLabels(s.picks).join(', ') + (s.after ? '; after: ' + C.AFTERCARE[s.after].name.toLowerCase() : '') + '.';
    return h('div', { class: 'report-line' }, h('span', { class: 'nm' }, CH[c.id].name), h('span', { class: 'detail' }, ' · ' + bits.join('; ')), h('div', { class: 'sent-line' }, outcome));
  });
  setScreen(appShell(h('div', { class: 'report' }, h('h2', {}, 'Probation Report'), h('div', { class: 'sub' }, 'Night ' + g.day + ' · filed to Standards'), lines),
    advanceBar('Submit', submitReport, { caption: 'auto-compiled from what you actually sent' })));
}
// The night: Cleared sisters are seen off, the safe word at the day boundary is spoken, the house takes in whoever is next; and then it is morning.
async function submitReport() { await endNight(); }
async function endNight() {
  const g = app.g;
  // whoever has been Cleared in the course of the evening is seen off now, once every message has been sent
  await playScenes(R.flushMoveOns(g));
  const notices = R.endEvening(g, app.rng).filter(n => !(n.type === 'moveon' && n.played));
  save();
  if (notices.some(n => n.type === 'word' || n.type === 'safeword')) showNotices('Overnight', notices, nextDay, 'Morning');
  else nextDay();
}

// ── Morning: the president's response ────────────────────────────
function renderPresident() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = 'president';
  const g = app.g;
  if (!app.pres || app.pres.day !== g.day) app.pres = { day: g.day, greeting: pick(C.GREETINGS), lines: R.presidentLines(g, app.rng) };
  const P = app.pres;
  const entry = c => {
    const d = CH[c.id];
    if (c.type === 'cleared') return h('div', { class: 'entry' }, h('b', {}, d.name), ' has been cleared of Social Probation.');
    if (c.type === 'transfer') return h('div', { class: 'entry' }, h('b', {}, d.name), ' has requested a new Big — she’s been reassigned.');
    return h('div', { class: 'entry' }, 'Sister assigned to Social Probation: ', h('b', {}, d.name), h('span', { class: 'viol' }, d.file));
  };
  const block = g.stateChanges.length ? h('div', { class: 'state-block' }, h('div', { class: 'hdr' }, 'ΩΤΚ · Standards Committee'), h('div', { class: 'rule' }), g.stateChanges.map(entry)) : null;
  setScreen(appShell(h('div', { class: 'presresp' },
    h('h2', {}, 'Morning'), h('div', { class: 'sub' }, 'Day ' + g.day),
    h('div', { class: 'pres-head' }, h('div', { class: 'avatar brass' }, 'ΩΤΚ'), h('div', { class: 'who' }, h('div', { class: 'name' }, 'president'), h('div', { class: 'handle' }, '@president'))),
    h('div', { class: 'pres-msg' }, h('p', {}, P.greeting), P.lines.map(l => h('p', {}, l.text))),
    block,
    h('div', { class: 'dbg-wrap' }, h('div', { class: 'dbg-toggle', onclick: () => { app.scoring = !app.scoring; renderPresident(); } }, (app.scoring ? '▾' : '▸') + ' how last night was scored'), app.scoring ? scoringNotes() : null)),
    advanceBar('Go to today’s duties', toBoard, { caption: 'day ' + g.day + ' · ' + g.roster.length + ' on Social Probation' })));
}
// For the curious: what each sister needed, what went into it, and where you landed.
function scoringNotes() {
  const g = app.g;
  return g.lastNight.filter(r => !(g.gone || []).includes(r.id)).map(r => {
    const d = CH[r.id];
    if (r.kind === 'reprieve') return h('div', { class: 'dbg' }, h('div', { class: 'dbg-name' }, d.name), h('div', { class: 'dbg-row' }, h('span', { class: 'k' }, 'sent'), h('span', { class: 'v' }, 'Reprieve — ' + C.REPRIEVES[r.reprieve].name)),
      h('div', { class: 'dbg-row' }, h('span', { class: 'k' }, 'graded'), h('span', { class: 'v' }, r.earned ? 'Earned: a Routine night, or a trap she was hiding behind; a pass is a fair read.' : 'Not earned: something was done that called for a correction.')));
    return h('div', { class: 'dbg' }, h('div', { class: 'dbg-name' }, d.name),
      h('div', { class: 'dbg-row' }, h('span', { class: 'k' }, 'needed'), h('span', { class: 'v' }, R.BANDS[r.expected])),
      (r.breakdown || []).map(b => h('div', { class: 'dbg-row' }, h('span', { class: 'k' }, b.band ? 'base' : b.plus ? '+' + b.plus : '·'), h('span', { class: 'v' + (b.late ? ' dbg-late' : '') }, b.label + (b.band ? ' → ' + b.band : '')))),
      h('div', { class: 'dbg-row' }, h('span', { class: 'k' }, 'reached'), h('span', { class: 'v' }, (r.reached > 4 ? 'Too harsh' : R.BANDS[r.reached]) + ' — ' + R.MATCH_TEXT[r.quality].toLowerCase())));
  });
}
function toBoard() { R.clearPresident(app.g); app.pres = null; app.scoring = false; save(); renderBoard(); }

// ── Sisters in Good Standing, and the end ────────────────────────
function showCollection() {
  const g = app.g;
  modal(h('h2', {}, 'Sisters in Good Standing'), h('p', { class: 'muted' }, 'A permanent chapter record. Everyone who has been cleared stays here for good.'),
    h('div', { class: 'coll' }, C.ORDER.map(id => {
      const d = CH[id], got = g.collection.includes(id);
      return got ? h('div', { class: 'slotc got' }, h('h3', {}, d.name), h('p', {}, h('i', {}, d.tagline)), h('p', {}, fmt(d.lines.leave)), h('p', {}, h('b', {}, 'What was really going on: '), d.story), h('p', {}, h('b', {}, 'What you learned: '), d.note))
        : h('div', { class: 'slotc' }, h('h3', {}, '???'), h('p', {}, 'Not yet cleared.'));
    })),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { onclick: closeModal }, 'Close')));
}
function showRules() {
  modal(h('h2', {}, 'How the house works'), h('div', { class: 'rules' },
    h('h3', {}, 'The day'),
    h('p', {}, 'Each morning the president answers last night’s report, and then there is a duty board: one place for each sister on Probation. Send people where their state lets them do well; the work quietly feeds back into how they are. Each evening every sister posts, and the register at the top of the page is your own record of how her duty actually went. She may not say it the same way.'),
    h('h3', {}, 'Six measures, and Grades'),
    h('ul', {}, h('li', {}, 'Wilfulness and Resentment are the trouble. Satisfaction, Valued and Composure are what holds a sister steady. Attention is how well she works.'), h('li', {}, 'Low Valued makes a correction read as punishment. Resentment at the top with Valued at the bottom is when someone calls the safe word.'), h('li', {}, 'Grades (On Track, At Risk, Failing) drag on everything she does while she is behind. Study Hours lifts them; self-neglect lets them slip. Only Taylor’s release depends on them.')),
    h('h3', {}, 'The message'),
    h('p', {}, 'Open her post and tap direct message. Choose where the correction begins (position, implement, clothing, how hard, how long) or offer a word instead; the message builds as you choose. Nothing is spent and nothing is locked until you send, and nothing you chose is binding once she is in the room: the correction itself is live.'),
    h('p', {}, 'A late post (its time shown in red, after ten at night) quietly asks for a little more. Withholding something, or saying something that is not true, asks for more again. The president’s private note on her post is the truth about what she did.'),
    h('h3', {}, 'The correction is yours'),
    h('p', {}, 'Smack, run a few, wait, stop. Change position or implement whenever you like (a new implement has to be fetched, which means a word with her), take layers off or put them back, move the pace and strength up or down, and look from behind, over your shoulder or watch her reactions. The meter shows how far you have brought her; the white tick is her edge of resistance. A sister needs a different amount depending on her Wilfulness and on what happened that day. Too little does not land; too much costs trust. A few kinds of trouble are better met with a kind word than a hand.'),
    h('p', {}, 'The highest distress you bring her to counts, not where she ends up. Stop at the right moment. Beyond too harsh, nothing more is struck, and a sister whose trust is thin will call the safe word.'),
    h('h3', {}, 'Candle'),
    h('p', {}, 'Corrections cost nothing, but aftercare (corner time, lines, held after, warm words) and reprieves (a stern, kind or written word) are paid from the evening’s candle, and there is never enough for everything.'),
    h('h3', {}, 'Being cleared, and the safe word'),
    h('p', {}, 'When a sister has settled enough (and has served at least three nights), she is cleared, and you will not be told it is coming. Anyone may call the safe word, “Red”, at any time; it ends things at once and costs her, and on the second or third call she requests a new Big. Nobody who has been cleared or has left comes back: the house takes in whoever has not yet been through it, and when everyone is cleared or gone, the game ends. Your score is how many were cleared. Everyone here is an adult who chose to join.')),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}
// Everyone has been cleared or has left: the score is how many were cleared.
function showEnd() {
  teardownLive(); closeModal(); showStage(false); say(null, null); app.view = 'end';
  const g = app.g, E = C.EPILOGUE;
  save();
  const card = (id, kind) => {
    const d = CH[id], fin = g.chars[id].final || g.chars[id].stats;
    return h('div', { class: 'endcard' + (kind === 'lost' ? ' lost' : '') },
      h('div', { class: 'head' }, avatar(d.name), h('div', {}, h('div', { class: 'nm' }, d.name + ', ' + d.age), h('div', { class: 'sub' }, d.tagline))),
      endStats(id, fin),
      h('div', { class: 'story' }, fmt(E[id][kind === 'lost' ? 'lost' : 'grown']),
        kind === 'moved' ? h('div', { style: 'margin-top:8px' }, h('b', {}, 'What was really going on: '), d.story) : null,
        kind === 'moved' ? h('div', { style: 'margin-top:6px' }, h('b', {}, 'What you learned: '), d.note) : null));
  };
  const n = g.collection.length;
  setScreen(appShell(h('div', { class: 'standing' },
    h('h2', {}, 'Sisters in Good Standing'), h('div', { class: 'sub' }, 'Permanent chapter record'),
    h('p', { class: 'verdict' }, n === C.ORDER.length ? 'All six cleared. Your term as Big is finished.' : n + (n === 1 ? ' sister cleared.' : ' sisters cleared.') + ' Your term as Big is finished.'),
    n ? h('div', {}, h('h4', {}, 'Cleared'), h('div', { class: 'residents' }, g.collection.map(id => card(id, 'moved')))) : null,
    (g.gone || []).length ? h('div', {}, h('h4', {}, 'Requested a new Big'), h('div', { class: 'residents' }, g.gone.map(id => card(id, 'lost')))) : null,
    h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'primary', onclick: startNew }, 'Begin again')))));
}

window.__fs = { app, R, C, B, SC, renderBoard, renderEvening, renderReport, renderPresident, showIntro, showMemo, showLogin, playScene, showEnd, messageText, draftOf };
function boot() {
  const tag = document.createElement('div'); tag.textContent = 'build ' + (window.FS_BUILD || '?'); tag.style.cssText = 'position:fixed;left:6px;bottom:4px;z-index:9;font:10px monospace;color:#8a7a74;opacity:.6;pointer-events:none';
  document.body.appendChild(tag);   // so it is plain which version of the game this is
  showIntro();
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
