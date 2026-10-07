// Birchwood House — interface and game flow.
(function () {
'use strict';
const R = window.FairyShoeRules, C = window.FairyShoeContent, B = window.FairyShoeBodies, SC = window.FairyShoeScene;
const CH = C.CHARACTERS;
const SAVE_KEY = 'fairyshoe.v1';
const DEFAULT_TITLE = 'Ma\'am';
const KEEPER_TITLE = { a: 'Ma\'am', b: 'Sir' };   // (what each of the two is called to begin with)
const TITLE_CHIPS = ['Ma\'am', 'Sir', 'Matron', 'Keeper', 'Miss', 'Mister'];
const COLOURS = { red: '#b02828', goldilocks: '#b8922f', rapunzel: '#7e6bb0', jack: '#4a7d38', hans: '#7d7c6c', snow: '#2f4d9c' };

const app = { g: null, rng: Math.random, title: DEFAULT_TITLE, keeper: 'a', settings: { guidance: true, sound: true }, selected: null, expanded: {}, stage: null, live: null, advance: null };

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
function pips(n, cls) { const e = h('span', { class: 'pips ' + (cls || '') }); for (let i = 1; i <= 7; i++) e.append(h('i', { class: i <= n ? 'f' : '' })); return e; }
const delay = ms => new Promise(r => setTimeout(r, ms));
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage may be blocked */ } }
function recall(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }

function save() { if (app.g) store(SAVE_KEY, { g: app.g, title: app.title, keeper: app.keeper, settings: app.settings }); }
function saveSettings() { store(SAVE_KEY + '.prefs', { title: app.title, keeper: app.keeper, settings: app.settings }); }

function setScreen(node) { const a = $('#app'); a.replaceChildren(node); window.scrollTo(0, 0); }
function showStage(on) { $('#stage').classList.toggle('on', on); if (on && app.stage) app.stage.resize(); }
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

function header(extra) {
  const g = app.g;
  return h('div', { class: 'bar' },
    h('h1', {}, 'Birchwood House'), h('span', { class: 'day' }, g.day ? 'Day ' + g.day : ''),
    h('span', { class: 'grow' }), extra || null,
    h('button', { class: 'quiet', onclick: showCollection }, 'Collection (' + g.collection.length + '/' + C.ORDER.length + ')'),
    h('button', { class: 'quiet', onclick: showRules }, 'How it works'),
    h('button', { class: 'quiet', title: 'Show the band each resident needs on the meter', onclick: () => { app.settings.guidance = !app.settings.guidance; saveSettings(); refreshGuidance(); } }, 'Guidance: ' + (app.settings.guidance ? 'on' : 'off')),
    h('button', { class: 'quiet', onclick: () => { app.settings.sound = !app.settings.sound; SC.Sound.set(app.settings.sound); saveSettings(); setSoundLabel(); }, id: 'soundbtn' }, 'Sound: ' + (app.settings.sound ? 'on' : 'off')),
    h('button', { class: 'quiet', onclick: leaveToMenu }, 'Menu'));
}
function setSoundLabel() { const b = $('#soundbtn'); if (b) b.textContent = 'Sound: ' + (app.settings.sound ? 'on' : 'off'); }
function refreshGuidance() { if (app.refreshGuidance) app.refreshGuidance(); document.querySelectorAll('.bar button').forEach(b => { if (/^Guidance/.test(b.textContent)) b.textContent = 'Guidance: ' + (app.settings.guidance ? 'on' : 'off'); }); }
// What something costs, as candles like the meter's
function costIcons(n) { const e = h('span', { class: 'candle costtag', title: n + (n === 1 ? ' candle' : ' candles') }); for (let i = 0; i < n; i++) e.append(h('i', { class: 'lit' })); return e; }
function candle() { const g = app.g, e = h('span', { class: 'candle', title: 'Marks to spend on a reprieve or aftercare this evening' }, 'Candle '); for (let i = 0; i < R.EVENING_CANDLE; i++) e.append(h('i', { class: i < g.candle ? 'lit' : '' })); return e; }

// ── Intro ───────────────────────────────────────────────────────
function showIntro() {
  closeModal(); showStage(false); say(null, null);
  const prefs = recall(SAVE_KEY + '.prefs'); if (prefs) { app.title = prefs.title || app.title; app.keeper = prefs.keeper || app.keeper; app.settings = { ...app.settings, ...(prefs.settings || {}) }; }
  SC.Sound.set(app.settings.sound);
  const saved = recall(SAVE_KEY);
  const input = h('input', { type: 'text', maxlength: 24, value: app.title, 'aria-label': 'What the residents call you', oninput: e => { app.title = e.target.value.trim().slice(0, 24) || DEFAULT_TITLE; } });
  const chips = h('div', { class: 'chips' }, TITLE_CHIPS.map(t => h('button', { onclick: () => { input.value = t; app.title = t; } }, t)));
  const keepers = h('div', { class: 'keepers' }), paint = () => keepers.replaceChildren(...Object.entries(B.KEEPERS).map(([k, v]) => h('button', { class: app.keeper === k ? 'on' : '', onclick: () => { app.keeper = k; app.title = KEEPER_TITLE[k] || DEFAULT_TITLE; input.value = app.title; paint(); } }, v.label)));
  paint();
  setScreen(h('div', { class: 'screen wash' }, h('div', { class: 'intro' },
    h('h1', {}, 'Birchwood House'),
    h('p', { class: 'lede' }, 'A halfway house, and you run it. The people who find their way to your door are the ones the stories left behind: characters whose tales ended without a moral, or who never lived the one we know them for. Now they are grown, and the strict adult world has no room for them. They come here to be set straight, and you are the one who does it, by hand, in your own time.'),
    h('div', { class: 'panel consent' }, h('h3', {}, 'The house rules, before anything else'),
      h('p', {}, h('b', {}, 'Everyone here is an adult. '), 'Every resident is over eighteen, arrived of their own accord, and understood what the house is and what happens in it before they came in.'),
      h('p', {}, h('b', {}, 'The safe word is “Red”. '), 'Anyone can call it at any moment. When they do, it stops at once and it costs them: Valued, Satisfaction and Composure fall and Resentment rises. Two or three calls and they leave for good. The game never overrules it, and neither should you.')),
    h('div', { class: 'panel' }, h('h3', {}, 'What should they call you?'),
      input, chips),
    h('div', { class: 'panel' }, h('h3', {}, 'Your hands'), h('p', {}, 'Who you appear as in the room.'), keepers),
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => { saveSettings(); startNew(); } }, 'Open the door'),
      saved ? h('button', { onclick: () => { saveSettings(); continueGame(saved); } }, 'Continue (Day ' + saved.g.day + ')') : null))));
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
  app.rng = seed(); app.g = R.newGame(app.rng, { title: app.title });
  const first = app.g.roster.map(id => ({ type: 'arrive', id }));
  showNotices('The first morning', first, () => { nextDay(); if (!recall('fairyshoe.seenrules')) { store('fairyshoe.seenrules', 1); showRules(); } }, 'Begin');
}
// Testing: choose a giver and a subject, then a throwaway game is built with that resident on the evening's list for the correction with the highest expected severity
// (their Wilfulness set high, with the largest situational modifier), and you go straight to its set-up. Nothing is saved.
function showSeverePicker() {
  const pick = { giver: app.keeper || 'a', subject: C.ORDER[0] };
  const box = h('div', {}), paint = () => box.replaceChildren(
    h('h4', {}, 'Giver'), h('div', { class: 'chips' }, Object.entries(B.KEEPERS).map(([k, v]) => h('button', { class: pick.giver === k ? 'on' : '', onclick: () => { pick.giver = k; paint(); } }, v.name))),
    h('h4', {}, 'Subject'), h('div', { class: 'chips' }, C.ORDER.map(id => h('button', { class: pick.subject === id ? 'on' : '', onclick: () => { pick.subject = id; paint(); } }, CH[id].name))));
  paint();
  modal(h('h2', {}, 'Test: most severe correction'), h('p', { style: 'color:var(--muted)' }, 'A throwaway game, straight to the set-up for a correction with the highest expected severity. Your save is not touched.'), box,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => { closeModal(); jumpToSevere(pick.giver, pick.subject); } }, 'Load it'), h('button', { onclick: closeModal }, 'Cancel')));
}
function jumpToSevere(giver, subject) {
  const rng = seed(), g = R.newGame(rng, { title: app.title });
  if (!g.roster.includes(subject)) g.roster[0] = subject;
  const st = g.chars[subject].stats; st.wil = 6;   // wilful: band 3, and the modifier below takes it to the top
  R.startMorning(g, rng); g.title = app.title;
  g.phase = 'evening'; g.leftToday = [];
  const card = { id: subject, band: 'failed', choreName: 'a chore', choreLine: '', event: null, done: false, mod: 2 };
  g.cards = [card]; g.queue = [subject]; g.cursor = 0;
  app.rng = rng; app.g = g; app.keeper = giver; app.selected = null; app.expanded = {};
  renderEvening();
  renderSetup(card);
}
function continueGame(saved) {
  app.rng = seed(); app.g = saved.g; app.title = saved.title; app.keeper = saved.keeper || 'a'; app.settings = { ...app.settings, ...(saved.settings || {}) };
  app.g.title = app.title; app.selected = null;
  // Back to wherever the game was left: the chore list, the evening's corrections, or the night between (which is finished off, as it would have been).
  const g = app.g;
  if (g.phase === 'over' || R.isOver(g)) showEnd();
  else if (g.phase === 'evening') renderEvening();
  else if (g.phase === 'boundary') { const n = g.notices || []; if (n.length) showNotices('Overnight', n, nextDay, 'Morning'); else nextDay(); }
  else renderMorning();
}
// Everyone has moved on or left: the score is how many moved on.
function showEnd() {
  teardownLive(); closeModal(); showStage(false); say(null, null);
  const g = app.g, E = C.EPILOGUE;
  save();
  const card = (id, kind) => {
    const d = CH[id], fin = g.chars[id].final || g.chars[id].stats;
    return h('div', { class: 'res endcard' + (kind === 'lost' ? ' lost' : '') },
      h('div', { class: 'head' }, h('div', { class: 'mono', style: 'background:' + COLOURS[id] }, d.name[0]),
        h('div', {}, h('div', { class: 'nm' }, d.name + ', ' + d.age), h('div', { class: 'sub' }, d.tagline))),
      statsBlock(id, fin),
      h('div', { class: 'story' }, fmt(E[id][kind === 'lost' ? 'lost' : 'grown'] + ''), kind === 'moved' ? h('div', { style: 'margin-top:6px' }, h('b', {}, 'What you learned: '), d.note) : null));
  };
  const n = g.collection.length;
  setScreen(h('div', { class: 'screen' }, header(),
    h('div', { class: 'morning' }, h('div', { class: 'narration' }, h('p', {}, 'The house is quiet. Nobody is left to take in, and nobody left to see off.')),
      h('div', { class: 'col' }, h('h2', {}, 'Birchwood House'), h('p', { class: 'verdict' }, n + (n === 1 ? ' resident moved on.' : ' residents moved on.')),
        n ? h('div', {}, h('h4', {}, 'Moved on'), h('div', { class: 'residents' }, g.collection.map(id => card(id, 'moved')))) : null,
        (g.gone || []).length ? h('div', {}, h('h4', {}, 'Bridges broken'), h('div', { class: 'residents' }, g.gone.map(id => card(id, 'lost')))) : null,
        h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'primary', onclick: startNew }, 'Begin again'))))));
}
function nextDay() {
  if (R.isOver(app.g)) return showEnd();
  if (app.stage) app.stage.clearMarks();
  R.startMorning(app.g, app.rng); app.g.title = app.title; app.selected = null; app.expanded = {};
  save(); renderMorning();
}

// ── Notices (arrivals, moving on, the safe word) ─────────────────────
function noticeCard(n) {
  const d = CH[n.id];
  if (n.type === 'arrive') return h('div', { class: 'notice' }, h('h3', {}, d.name + ', ' + d.age), h('p', {}, h('i', {}, d.tagline)), h('p', {}, d.story), h('p', { class: 'say' }, fmt(d.lines.arrive)));
  if (n.type === 'moveon') return h('div', { class: 'notice' }, h('h3', {}, d.name + ' has moved on'), h('p', { class: 'say' }, fmt(d.lines.leave)), h('p', {}, 'They are in your Collection now, for good. The house will take in someone new.'));
  if (n.type === 'safeword') return h('div', { class: 'notice word' }, h('h3', {}, d.name + ' called the safe word'), h('p', { class: 'say' }, fmt(C.SAYINGS.word[0])), h('p', {}, 'It stopped, as it should. ' + (n.need - n.count === 1 ? 'Once more, and ' + d.name + ' will leave for good.' : n.count + ' of ' + n.need + ' calls so far.')), chipsFor(n.changes || []));
  return h('div', { class: 'notice word' }, h('h3', {}, d.name + ' called the safe word, and has left'), h('p', { class: 'say' }, fmt(C.SAYINGS.word[0])), h('p', {}, 'It stopped, as it should. ' + d.name + ' has packed up and gone, with nothing held against ' + d.pronouns[1] + ', and will not be back.'));
}
// Arrivals are cards; moving on and the word are scenes. Anyone leaving is seen off first, then whoever has come in is shown.
function showNotices(title, notices, then, label) {
  const scenes = notices.filter(n => n.type === 'moveon' || n.type === 'word'), rest = notices.filter(n => !scenes.includes(n));
  const showRest = () => {
    if (!rest.length) return then();
    const o = $('#overlay'); o.dataset.dismiss = 'no';
    const arr = rest.filter(n => n.type === 'arrive'), pool = arr.length > 1 ? C.ARRIVAL_NARR.many : C.ARRIVAL_NARR.one;
    const narr = arr.length ? h('p', { class: 'narr' }, pool[Math.floor(app.rng() * pool.length)].replace('{their} ', arr.length === 1 ? CH[arr[0].id].pronouns[2] + ' ' : '')) : null;
    modal(h('h2', {}, title), narr, rest.map(noticeCard), h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => { closeModal(); then(); } }, label || 'Continue')));
  };
  if (scenes.length) playScenes(scenes).then(showRest); else showRest();
}
async function playScenes(list) { for (const n of list) if (!n.played && (n.type === 'moveon' || n.type === 'word')) await playScene(n); }

// A goodbye: the resident standing in the room, a few beats of narration and talk, and a choice for you. (Lines in content.js SCENES.)
async function playScene(notice) {
  notice.played = true;
  const S = window.Starlight, id = notice.id, d = CH[id], box = $('#scene');
  teardownLive(); closeModal(); say(null, null); setScreen(h('div'));
  const stage = await ensureStage();
  let ch = null;
  await busy('', async () => {
    showStage(true);
    ch = S.buildCharacter(S.clone(B.spec(id)), { voxel: 0.011, key: id });
    stage.scene.add(ch.group); ch.helper.visible = false; S.resetCharacter(ch, notice.type === 'word' ? 'Downcast' : 'Watch');
    // they stand in front of the door, on their way out, with it in view behind them
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

// ── Cards for people ────────────────────────────────────────────
function statsBlock(id, final) {
  const s = final || app.g.chars[id].stats, g = app.g;
  const rows = []; for (const k of C.STATS) rows.push(h('span', { class: 'k', title: C.STAT_HINTS[k] }, C.STAT_NAMES[k]), pips(s[k], k === 'wil' || k === 'res' ? 'hot' : ''));
  return h('div', { class: 'stats' }, rows);
}
function effLine(id) {
  const e = R.effectiveAttention(app.g.chars[id].stats);
  return 'At chores: ' + e.value + (e.mod ? ' (' + (e.mod > 0 ? '+' : '−') + Math.abs(e.mod) + ' from state)' : '');
}
function residentCard(id, opts = {}) {
  const d = CH[id], g = app.g, open = !!app.expanded[id];
  const card = h('div', { class: 'res' + (app.selected === id ? ' sel' : '') + (opts.placed ? ' placed' : ''), draggable: !!opts.draggable, 'data-id': id },
    h('button', { class: 'flip', onclick: e => { e.stopPropagation(); app.expanded[id] = !open; opts.rerender && opts.rerender(); } }, open ? 'close' : 'story'),
    h('div', { class: 'head' }, h('div', { class: 'mono', style: 'background:' + COLOURS[id] }, d.name[0]),
      h('div', {}, h('div', { class: 'nm' }, d.name + ', ' + d.age), h('div', { class: 'sub' }, d.tagline))),
    statsBlock(id), h('div', { class: 'eff' }, effLine(id)),
    open ? h('div', { class: 'story' }, d.story, g.collection.includes(id) ? h('div', { style: 'margin-top:6px' }, h('b', {}, 'What you learned: '), d.note) : null) : null);
  if (opts.onclick) card.addEventListener('click', opts.onclick);
  if (opts.draggable) { card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; app.selected = id; }); }
  return card;
}

// ── Morning ─────────────────────────────────────────────────────
function renderMorning() {
  teardownLive(); closeModal(); showStage(false); say(null, null);
  const g = app.g, ready = R.allAssigned(g);
  const rerender = () => renderMorning();
  const place = (ci, si, id) => { R.assign(g, ci, si, id); app.selected = null; renderMorning(); };
  const residents = g.roster.map(id => residentCard(id, {
    draggable: true, placed: !!R.choreOf(g, id), rerender,
    onclick: () => { app.selected = app.selected === id ? null : id; renderMorning(); },
  }));
  const chores = g.chores.map((ch, ci) => h('div', { class: 'chore' },
    h('div', { class: 't' }, h('span', { class: 'nm' }, ch.def.name), h('span', { class: 'diff', title: 'Difficulty' }, '●'.repeat(ch.def.diff) + '○'.repeat(3 - ch.def.diff))),
    ch.def.paired ? h('span', { class: 'tag' }, 'two hands, and how well they get on') : null,
    h('div', { class: 'slots' }, ch.slots.map((who, si) => {
      const slot = h('div', { class: 'slot' + (who ? ' full' : ''), onclick: () => {
        if (who && !app.selected) { R.unassign(g, who); renderMorning(); }
        else if (app.selected) place(ci, si, app.selected);
      } }, who ? [CH[who].name, h('span', { class: 'x' }, '✕')] : (ch.def.paired ? 'Resident ' + (si + 1) : 'Assign a resident'));
      slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('over'));
      slot.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) place(ci, si, id); });
      return slot;
    }))));
  if (!g.narration) g.narration = R.morningNarration(g, app.rng);
  setScreen(h('div', { class: 'screen' }, header(),
    h('div', { class: 'morning' },
      h('div', { class: 'narration' }, g.narration.map(t => h('p', {}, t))),
      h('div', { class: 'col' }, h('h2', {}, 'Today\'s chores'), h('div', { class: 'hint' }, 'Tap a resident below, then a chore, or drag one across. The day starts once every resident has something to do; tap a placed name to take it back.'), h('div', { class: 'chorelist' }, chores),
        ready ? h('div', { class: 'starting' }, h('button', { class: 'primary big', onclick: beginDay }, 'Begin the day')) : null),
      h('div', { class: 'col' }, h('h2', {}, 'The house'), h('div', { class: 'hint' }, 'The “story” tab opens a resident\'s file. At chores is how well their state lets them work today.'), h('div', { class: 'residents' }, residents)))));
  clearTimeout(app.advance);   // (the day does not start by itself: the button does it)
}
function beginDay() {
  const g = app.g, out = R.resolveDay(g, app.rng);
  const notices = out.notices;
  if (notices.length) showNotices('Over the day', notices, renderEvening, 'On to the evening');
  else renderEvening();
}

// ── Evening ─────────────────────────────────────────────────────
const SEVERITY_BAND_NOTE = ['Minimal', 'Light', 'Moderate', 'Firm', 'Severe'];
function queueBar(current) {
  const g = app.g;
  return h('div', { class: 'queue' }, g.cards.map(c => h('span', { class: (c.id === current ? 'cur ' : '') + (c.done ? 'done' : '') }, CH[c.id].name)));
}
function renderEvening() {
  teardownLive(); closeModal(); showStage(false); say(null, null);
  const g = app.g, pending = R.pendingCards(g);
  if (!pending.length) return endNight();
  const card = pending[0], id = card.id, d = CH[id];
  const ev = card.event, trouble = card.band === 'partial' || card.band === 'failed';
  const words = h('div', { class: 'words', hidden: true }, Object.entries(C.REPRIEVES).map(([k, r]) => h('button', { class: 'choice paper', disabled: g.candle < r.cost, onclick: () => doReprieve(card, k) },
    h('b', {}, r.name, costIcons(r.cost)), h('span', {}, r.blurb))));
  const host = h('div', { class: 'setuphost', id: 'setuphost', hidden: true });
  setScreen(h('div', { class: 'screen' }, header(candle()),
    h('div', { class: 'evening' },
      queueBar(id),
      h('div', { class: 'area-report' },
        h('div', { class: 'behave' }, h('span', { class: 'lab' }, 'Behaviour report'), h('h2', {}, d.name + ', ' + d.age), h('div', { class: 'small' }, card.choreName + (card.band === 'well' ? ': done beautifully' : card.band === 'completed' ? ': done' : card.band === 'partial' ? ': half done' : ': not done')),
          h('div', { class: 'ln ' + (card.band === 'well' ? 'well' : trouble ? 'trouble' : '') }, h('span', { class: 'lab' }, 'The day\'s work'), card.choreLine),
          ev ? h('div', { class: 'ln event' }, h('span', { class: 'lab' }, C.CATEGORIES[ev.cat].label), ev.text) : null)),
      h('div', { class: 'area-stats' }, residentCard(id, { rerender: renderEvening })),
      h('div', { class: 'area-choices' },
        h('div', { class: 'choices' },
          h('button', { class: 'choice', onclick: () => { if (!host.hidden) { host.hidden = true; host.replaceChildren(); } else renderSetup(card); } }, h('b', {}, 'Take ' + d.pronouns[1] + ' in hand'), h('span', {}, 'A live correction. How it goes, and when it ends, is entirely up to you.')),
          host,
          h('button', { class: 'choice', onclick: () => { words.hidden = !words.hidden; } }, h('b', {}, 'Offer a word instead'), h('span', {}, 'A reprieve replaces the correction. It costs candle, and the trouble goes unanswered by hand.')),
          words)))));
}
function doReprieve(card, kind) {
  const g = app.g, snap = R.applyReprieve(g, card.id, kind);
  if (!snap) return;
  save();
  showResult(snap, { stage: false });
}

// ── Choosing from a list (position, implement) ──────────────────
function choose({ title, intro, items, onPick }) {
  const list = h('div', { class: 'picks' }, items.map(it => h('button', {
    class: 'pick' + (it.current ? ' cur' : ''), disabled: it.disabled || it.current,
    onclick: () => { closeModal(); onPick(it.id); },
  }, h('b', {}, it.label, it.current ? h('em', {}, ' (now)') : null), h('span', {}, it.disabled && it.note ? it.note : it.blurb))));
  modal(h('h2', {}, title), intro ? h('p', { style: 'color:var(--muted);margin-top:0' }, intro) : null, list,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { onclick: closeModal }, 'Cancel')));
}
const IMPL = Object.fromEntries(SC.IMPLEMENTS.map(([id, label, blurb]) => [id, { label, blurb }]));
const POS = Object.fromEntries(SC.POSITIONS.map(([id, label, blurb]) => [id, { label, blurb }]));
const dual = id => window.Starlight.IMPLEMENTS[id].dual;
function chooseImplement(current, position, onPick) {
  choose({ title: 'Which implement?', intro: position === 'spread' ? 'This position only takes a wide implement.' : null,
    items: SC.IMPLEMENTS.map(([id, label, blurb]) => ({ id, label, blurb, current: id === current, disabled: position === 'spread' && !dual(id), note: 'Not in this position.' })), onPick });
}
function choosePosition(current, implement, onPick) {
  choose({ title: 'Which position?', items: SC.POSITIONS.map(([id, label, blurb]) => ({ id, label, blurb, current: id === current, disabled: id === 'spread' && !dual(implement), note: 'Needs the switch or paddle.' })), onPick });
}
// A veil with a line or two of narration while the room is rebuilt behind it.
async function transition(lines, minMs, work) {
  const v = $('#veil'); v.replaceChildren(...lines.map(t => h('p', {}, t))); v.hidden = false;
  requestAnimationFrame(() => v.classList.add('on'));
  const t0 = performance.now(); await delay(500);
  try { await work(); } finally {
    const rest = minMs - (performance.now() - t0); if (rest > 0) await delay(rest);
    v.classList.remove('on'); await delay(450); v.hidden = true;
  }
}
const ctxFor = id => ({ name: CH[id].name, pron: CH[id].pronouns, title: app.title });
const tell = (text, id, extra) => R.fillTemplate(text, { ...ctxFor(id), ...extra });
// Pre-sitting layer choices: what the resident wears for it (the rest can be changed as you go).
const defaultLayers = () => ({ bottoms: false, briefs: false });   // (bottoms and briefs both up to begin with; a skirt is always hitched up)

// ── Setting up the correction ───────────────────────────────────
function renderSetup(card) {
  const id = card.id, d = CH[id];
  const set = app.setup && app.setup.id === id ? app.setup : (app.setup = { id, position: 'lap', implement: 'hand', layers: defaultLayers() });
  const dock = h('div', { class: 'dock inline' });
  const sample = B.spec(id).wardrobe;
  const paint = () => {
    const layerBtn = (name, avail) => avail ? h('button', { class: set.layers[name] && set.layers[name] !== 'off' ? 'on' : '', disabled: name === 'briefs' && !set.layers.bottoms, onclick: () => { set.layers[name] = SC.layerNext(name, set.layers[name]); if (name === 'bottoms' && !set.layers.bottoms) set.layers.briefs = false; paint(); } }, SC.layerLabel(name, set.layers[name])) : null;
    dock.replaceChildren(h('div', { class: 'sub' }, 'Choose where and how to begin. Position, implement and what they wear can all be changed once you are under way.'),
      h('h4', {}, 'Position'), h('div', { class: 'tabs' }, SC.POSITIONS.map(([v, l]) => h('button', { class: set.position === v ? 'on' : '', disabled: v === 'spread' && !dual(set.implement), title: POS[v].blurb, onclick: () => { set.position = v; paint(); } }, l))),
      h('div', { class: 'sub' }, POS[set.position].blurb),
      h('h4', {}, 'Implement'), h('button', { class: 'wide', onclick: () => chooseImplement(set.implement, set.position, v => { set.implement = v; paint(); }) }, IMPL[set.implement].label + '  ▸'),
      h('div', { class: 'sub' }, IMPL[set.implement].blurb),
      h('h4', {}, 'What they wear'), h('div', { class: 'tabs' }, layerBtn('bottoms', !!sample.bottom), layerBtn('briefs', !!sample.briefs)),
      h('div', { class: 'word' }, h('b', {}, 'The safe word (“Red”) '), 'is always honoured. If ' + d.name + ' calls it, or is brought too far, it stops.'),
      h('button', { class: 'primary big', onclick: () => startLive(card, set) }, 'Get started'));
  };
  paint(); const host = $('#setuphost'); host.replaceChildren(dock); host.hidden = false;
}

// ── The live correction ─────────────────────────────────────────
function teardownLive() {
  clearTimeout(app.advance);
  if (app.live) { try { app.live.onChange = null; app.live.onImpact = null; } catch (e) { /* */ } }
  if (app.stage && app.stage.session) app.stage.end();
  app.live = null; app.refreshGuidance = null; document.removeEventListener('keydown', onKey); document.body.classList.remove('live');
  const v = $('#veil'); if (v) { v.hidden = true; v.classList.remove('on'); }
}
function onKey(e) {
  const s = app.live; if (!s || e.target.tagName === 'INPUT' || e.code !== 'Space' || !$('#overlay').hidden) return;
  e.preventDefault(); s.smack();
}
async function startLive(card, set) {
  const id = card.id, d = CH[id];
  await busy('Setting the room…', async () => {
    const stage = await ensureStage();
    showStage(true); setScreen(h('div')); document.body.classList.add('live');   // the view takes the pointer (see css .live)
    app.live = stage.begin({ giver: B.keeper(app.keeper), subject: B.spec(id), subjectId: id, position: set.position, implement: set.implement, layers: { ...set.layers }, pain: { ...d.pain }, composure: app.g.chars[id].stats.com, stats: { ...app.g.chars[id].stats } });
    stage.setCamera(app.camera || 'overview');
  });
  const ses = app.live; SC.Sound.set(app.settings.sound);
  say(id, d.lines.open[Math.floor(app.rng() * d.lines.open.length)]);
  ses.card = card; ses.talked = false; ses.talkChanges = [];
  buildLiveDock(ses, card);
  document.addEventListener('keydown', onKey);
  maybeTutorial(ses);
}

// ── The first correction's walk-through (offered once; either answer is remembered) ──
const TUTORIAL = [
  { sel: '.hudcard .meter', title: 'The meter', text: 'This shows how far you have brought them. The shaded band is what they need today, and the white tick is the edge of their resistance. Where you stop counts, not where they end up.' },
  { sel: '.hudcard .b-smack', title: 'Smack', text: 'One smack, with the hand or whatever you are holding. Press it now to try one.', wait: s => s.st.smacks >= 1, waitText: 'Waiting for your first smack…' },
  { sel: '.hudcard .nudges', title: 'Pace and strength', text: 'Slower and Faster change how quickly each one comes; Softer and Harder, how firmly. Both change how it lands, and how they take it.' },
  { sel: '.hudcard .acts', title: 'A run', text: 'Run gives a short run of smacks without you pressing each one; the number beside it sets how many. Stop (the same button) halts it whenever you like.' },
  { sel: '.hudtools button[aria-label^="Position"]', title: 'Position, implement and clothes', text: 'Choose a new position, implement and what they wear all at once, then confirm. They are kept exactly as they are while the scene changes, and a new implement has to be fetched.' },
  { sel: '.hudtools', title: 'Camera and sound', text: 'The camera button cycles the standard angles, and you can always drag or scroll the view yourself. The speaker turns the sound off.' },
  { sel: '.hudcard .primary', title: 'Ending it', text: 'End the correction when they have had what they needed. If they call the safe word (“Red”), everything stops at once, and it costs them. Take it seriously.' },
];
function maybeTutorial(ses) {
  if (recall('fairyshoe.tutorial')) return;
  store('fairyshoe.tutorial', 1);
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
    // Past the point of no return they stop: nothing further is struck.
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
    const pos = tabs(SC.POSITIONS.map(p => [p[0], p[1], p[0] === 'spread' && !dual(want.implement), p[0] === 'spread' && !dual(want.implement) ? 'Needs a wide implement' : p[2]]), want.position, v => { want.position = v; paint(); });
    const imp = tabs(SC.IMPLEMENTS.map(p => [p[0], p[1], wideNeeded && !dual(p[0]), p[2]]), want.implement, v => { want.implement = v; paint(); });
    const how = fetching() ? [h('h4', {}, 'Getting the ' + IMPL[want.implement].label.toLowerCase()),
      tabs([['ask', 'Ask ' + CH[id].name, false, 'Politely.'], ['tell', 'Tell ' + CH[id].name, false, 'An order.'], ['self', 'Fetch it yourself', false, 'Say nothing, and go.']], want.how, v => { want.how = v; paint(); })] : [];
    const lay = ['bottoms', 'briefs'].filter(n => avail[n]).map(n => h('button', { class: want.layers[n] ? 'on' : '', disabled: n === 'briefs' && !want.layers.bottoms, onclick: () => { want.layers[n] = !want.layers[n]; if (n === 'bottoms' && !want.layers.bottoms) want.layers.briefs = false; paint(); } }, SC.layerLabel(n, want.layers[n])));
    body.replaceChildren(h('h4', {}, 'Position'), pos, h('h4', {}, 'Implement'), imp, ...how, avail.bottoms ? h('h4', {}, 'Clothes') : null, avail.bottoms ? h('div', { class: 'picks2' }, lay) : null,
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'primary', disabled: !changed(), onclick: () => { closeModal(); applyChanges(ses, want); } }, 'Confirm changes'), h('button', { onclick: closeModal }, 'Cancel')));
  };
  paint();
  modal(h('h2', {}, 'The scene'), h('p', { style: 'color:var(--muted);margin-top:0' }, 'Choose everything you want different, then confirm. ' + CH[id].name + ' will be kept exactly as ' + CH[id].pronouns[0] + ' is until you begin again.'), body);
}
// What changing the scene looks like, as it is read: the implement, then the position, then the clothes. Each entry is a line: { n } narration, { you } what the player says, { r } the subject.
function planChanges(ses, want) {
  const id = ses.card.id, st = app.g.chars[id].stats, mood = R.fetchMood(st), tone = R.toneFor(st), d = ses.distress(), K = C.CHANGE;
  const band = d < 0.3 ? 'calm' : d < 0.7 ? 'sore' : 'spent', lines = [], T = (t, x) => tell(t, id, x);
  const from = { position: ses.position, implement: ses.implement }, impName = IMPL[want.implement].label.toLowerCase();
  const implChanged = want.implement !== from.implement, posChanged = want.position !== from.position;
  const wasLap = from.position === 'lap';
  let up = false;
  const helpUp = () => { lines.push({ n: T(K.helpUp[band]) }); up = true; };
  // 1. the implement
  if (implChanged) {
    if (want.implement === 'hand') lines.push({ n: T(K.putDown, { Impl: IMPL[from.implement].label.toLowerCase() }) });
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
    const pool = L.react[mood].filter(t => t !== app.lastReact), pick = pool[Math.floor(app.rng() * pool.length)];
    app.lastReact = pick; lines.push({ n: T(pick) });
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
  snap.layers = dress;   // (the state of dress the correction ended on, for the aftercare scenes)
  document.removeEventListener('keydown', onKey);
  save();
  if (snap.word) {   // the safe word: no scorecard; whoever leaves is seen off, then the next behaviour report
    const hud = $('#app .hud'); if (hud) hud.remove(); say(null, null);
    playScenes(snap.exits).then(() => { teardownLive(); showStage(false); renderEvening(); });
    return;
  }
  // keep the room and the bodies on screen behind the result
  say(id, snap.word ? C.SAYINGS.word[0] : snap.quality === 'well' ? C.SAYINGS.well[Math.floor(app.rng() * C.SAYINGS.well.length)] : snap.quality.startsWith('under') ? (snap.smacks ? C.SAYINGS.under[Math.floor(app.rng() * 3)] : C.SAYINGS.nothing[0]) : snap.tooHarsh ? C.SAYINGS.harsh[0] : C.SAYINGS.over[Math.floor(app.rng() * 3)]);
  showResult(snap, { stage: true });
}

// ── Results and aftercare ───────────────────────────────────────
function chipsFor(changes) {
  if (!changes.length) return h('div', { class: 'chg' }, h('span', {}, 'No change in how they are'));
  return h('div', { class: 'chg' }, changes.map(c => {
    const up = c.to > c.from, goodUp = !(c.stat === 'wil' || c.stat === 'res');
    return h('span', { class: (up === goodUp) ? 'up' : 'down' }, C.STAT_NAMES[c.stat] + ' ' + (up ? '▲ ' : '▼ ') + c.from + ' → ' + c.to);
  }));
}
function exitsBlock(exits) {
  // (moving on is not announced here: it is kept for the end of the evening, once every behaviour report has been dealt with)
  return exits.filter(n => n.type !== 'moveon').map(n => h('div', { class: 'exit' + (n.type === 'word' || n.type === 'safeword' ? ' word' : '') },
    n.type === 'safeword' ? CH[n.id].name + ' called the safe word. ' + fmt(C.SAYINGS.word[0]) + ' It stopped at once (' + n.count + ' of ' + n.need + ').' : n.type === 'word' ? CH[n.id].name + ' called the safe word. ' + fmt(C.SAYINGS.word[0]) + ' It stopped at once, and they are gone from the house.' : CH[n.id].name + ' has moved on. ' + fmt(CH[n.id].lines.leave)));
}
// On from the result: to the next resident's fate, the evening or the night.
async function proceed(snap, wrap) { wrap.remove(); save(); await playScenes(snap.exits.filter(n => n.type === 'word')); teardownLive(); showStage(false); say(null, null); renderEvening(); }
// One of the aftercare scenes: the effect is applied, the room is set for it, the words are said, and then back to the result with the rest.
async function playAftercare(kind, snap, wrap, draw) {
  const g = app.g, id = snap.id, S_ = g.chars[id].stats;
  const r = R.applyAftercare(g, id, kind); if (!r) return;
  (snap.done || (snap.done = {}))[kind] = true; snap.aftercare = r.name;   // (just a mention on the card: it has been seen) snap.changes = snap.changes.concat(r.changes); snap.exits = snap.exits.concat(r.exits); save();
  wrap.hidden = true; say(null, null);
  await busy('Setting the scene…', async () => {
    await delay(50);
    app.stage.tableau(kind, { giver: B.keeper(app.keeper), subject: B.spec(id), subjectId: id, layers: { ...(snap.layers || {}) } });
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
// Sent to Bed: the room fades to a few lines about how they go, and then on, as Next does.
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
      snap.kind === 'correction' ? [
        h('div', { class: 'verdict' }, snap.smacks ? snap.smacks + (snap.smacks === 1 ? ' smack. ' : ' smacks. ') : 'You decided that was enough without lifting a hand. ',
          snap.tooHarsh ? ['You took them past what they could bear; they needed ', h('b', {}, snap.expectedName), '.']
            : ['You brought them to ', h('b', {}, snap.reachedName), '; they needed ', h('b', {}, snap.expectedName), '.']),
        h('div', {}, snap.text + '.')] : null,
      (snap.lines || []).map(l => h('p', { class: 'say' }, l)), snap.aftercare ? h('p', { class: 'small', style: 'color:#6a5d52;margin:8px 0' }, 'Afterwards: ' + snap.aftercare + '.') : null, snap.word ? null : chipsFor(snap.changes), exitsBlock(snap.exits),
      canAfter && !Object.keys(snap.done || {}).length ? [h('h4', {}, 'How does the evening end?'), h('p', { class: 'sub' }, 'One way, for this correction. What you choose is what ' + d.name + ' carries into the night.'), h('div', { class: 'choices' }, [...Object.entries(C.AFTERCARE).filter(([k]) => !(snap.done || (snap.done = {}))[k]).map(([k, a]) =>
        h('button', { class: 'choice paper', disabled: g.candle < a.cost, onclick: () => playAftercare(k, snap, wrap, draw) },
          h('b', {}, a.name, costIcons(a.cost)), h('span', {}, a.blurb))),
        h('button', { class: 'choice paper', onclick: () => sendToBed(snap, wrap) }, h('b', {}, 'Sent to Bed', h('span', { class: 'costtag' }, 'free')), h('span', {}, 'No more tonight. They go up, and that is that.'))])] : null,
      !canAfter || Object.keys(snap.done || {}).length ? h('div', { class: 'row', style: 'margin-top:14px' }, candle(), h('span', { class: 'grow' }), h('button', { class: 'primary', onclick: () => proceed(snap, wrap) }, 'Next')) : h('div', { class: 'row', style: 'margin-top:14px' }, candle())].flat(Infinity).filter(Boolean));
  };
  draw(); wrap.append(body);
  if (!stage) { const s = h('div', { class: 'screen' }, header(candle()), wrap); setScreen(s); } else $('#app').append(wrap);
  // the dock is replaced by the result when the room is on screen
  if (stage) { const hud = $('#app .hud'); if (hud) hud.remove(); }
}

// ── The end of the night ────────────────────────────────────────
async function endNight() {
  const g = app.g;
  // whoever has moved on in the course of the evening is seen off now, once every behaviour report has been dealt with
  await playScenes(R.flushMoveOns(g));
  const notices = R.endEvening(g, app.rng).filter(n => !(n.type === 'moveon' && n.played));
  if (notices.length) showNotices('Overnight', notices, nextDay, 'Morning');
  else nextDay();
}

// ── Collection and rules ────────────────────────────────────────
function showCollection() {
  const g = app.g;
  modal(h('h2', {}, 'Collection'), h('p', { style: 'color:var(--muted)' }, 'Everyone who has moved on stays here for good, however many times the house takes them in again.'),
    h('div', { class: 'coll' }, C.ORDER.map(id => {
      const d = CH[id], got = g.collection.includes(id);
      return got ? h('div', { class: 'slotc got' }, h('h3', {}, d.name), h('p', {}, h('i', {}, d.tagline)), h('p', {}, fmt(d.lines.leave)), h('p', {}, h('b', {}, 'What you learned: '), d.note))
        : h('div', { class: 'slotc' }, h('h3', {}, '???'), h('p', {}, 'Not yet moved on.'));
    })),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { onclick: closeModal }, 'Close')));
}
function showRules() {
  modal(h('h2', {}, 'How the house works'), h('div', { class: 'rules' },
    h('h3', {}, 'The day'),
    h('p', {}, 'Each morning there is a fresh list of chores, one place for each resident. Send people where their state lets them do well; the work quietly feeds back into how they are. Then each evening you see every resident in turn: what they did, and what happened.'),
    h('h3', {}, 'Six measures'),
    h('ul', {}, h('li', {}, 'Wilfulness and Resentment are the trouble. Satisfaction, Valued and Composure are what holds a person steady. Attention is how well they work.'), h('li', {}, 'Low Valued makes a correction read as punishment. Resentment at the top with Valued at the bottom is when someone calls the safe word.')),
    h('h3', {}, 'The correction is yours'),
    h('p', {}, 'You choose the position, what they wear and the implement to begin with, then everything is live: smack, run a few, wait, stop. Change position or implement whenever you like (a new implement has to be fetched, which means a word with them), take layers off or put them back, move the pace and strength up or down, and look from behind, over your shoulder or watch their reactions. The meter shows how far you have brought them; the white tick is their edge of resistance. A resident needs a different amount depending on their Wilfulness and on what happened that day: more for a bold or troublesome one, more again after a bad day or a bad event. Too little does not land; too much costs trust. A few kinds of trouble are better met with a kind word than a hand.'),
    h('p', {}, 'The highest distress you bring them to counts, not where they end up. Stop at the right moment. Beyond too harsh, nothing more is struck, and a resident whose trust is thin will call the safe word.'),
    h('h3', {}, 'Candle'),
    h('p', {}, 'Corrections cost nothing, but aftercare (corner time, lines, held after, warm words) and reprieves (a stern, kind or written word) are paid from the evening\'s candle, and there is never enough for everything.'),
    h('h3', {}, 'Moving on, and the safe word'),
    h('p', {}, 'When someone has settled enough, they move on, and you will not be told it is coming. Anyone may call the safe word, “Red”, at any time; it ends things at once and costs them, and on the second or third call they leave for good. Nobody who has moved on or left comes back: the house takes in whoever has not yet been through it, and when everyone has moved on or left, the game ends. Your score is how many moved on. Everyone here is an adult who chose to come.')),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}

window.__fs = { app, R, C, B, SC, renderMorning, renderEvening, showIntro, playScene, showEnd };
function boot() {
  const tag = document.createElement('div'); tag.textContent = 'build ' + (window.FS_BUILD || '?'); tag.style.cssText = 'position:fixed;left:6px;bottom:4px;z-index:9;font:10px monospace;color:#8a8a96;opacity:.6;pointer-events:none';
  document.body.appendChild(tag);   // so it is plain which version of the game this is
  showIntro();
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
