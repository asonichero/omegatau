// Birchwood House — edits: what the editor page (editor.html) does with a design or a pose it has been given or has made. Nothing here is
// stored and the game never reads it: the editor only previews, and prints a REPORT (designReport, poseReport) to paste into the project
// (js/bodies.js for a design, js/poses.js for poses) to make an edit permanent. Pure logic, no three.js, so it also runs in Node for the tests.
(function (root) {
'use strict';
const BONE_RE = /^[A-Za-z0-9]+$/;
const BEATS = { relaxed: 'relaxed', 'arm raised': 'raised', raised: 'raised', contact: 'contact' };
const POSITIONS = ['lap', 'case', 'head', 'chair', 'spread', 'hips', 'astride', 'corner', 'lines', 'held', 'heldstand', 'heldalt', 'warm'];

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
// Objects merge key by key; arrays and scalars replace. `null` deletes a key.
function deepMerge(base, patch) {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : (isObj(v) ? deepMerge({}, v) : (Array.isArray(v) ? v.slice() : v));
  }
  return out;
}

// ── Designs ─────────────────────────────────────────────────────
// Accepts a JSON object: either a few fields of a preset ({"height":170,"outfit":{"hair":9449516}}) or a whole preset as the
// character viewer's “Show JSON” prints it. Hex colours may be written as numbers or as "0xrrggbb" / "#rrggbb" strings.
function parseJSONLoose(text) {
  const t = String(text).trim();
  if (!t) throw new Error('Nothing to read.');
  const from = t.indexOf('{'), to = t.lastIndexOf('}');
  if (from < 0 || to < from) throw new Error('Expected a JSON object, starting with {.');
  // tolerate trailing commas and unquoted hex like 0xe9c6a5, which a pasted JS literal would have
  const cleaned = t.slice(from, to + 1).replace(/,(\s*[}\]])/g, '$1').replace(/:\s*(0x[0-9a-fA-F]+)/g, (m, h) => ': ' + parseInt(h, 16));
  return JSON.parse(cleaned);
}
function normaliseColours(v) {
  if (typeof v === 'string' && /^(#|0x)[0-9a-fA-F]{6}$/.test(v)) return parseInt(v.replace('#', '').replace(/^0x/, ''), 16);
  if (Array.isArray(v)) return v.map(normaliseColours);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normaliseColours(x)]));
  return v;
}
function parseDesign(text) {
  const o = parseJSONLoose(text);
  if (!isObj(o)) throw new Error('Expected an object.');
  return normaliseColours(o);
}

// ── Poses ───────────────────────────────────────────────────────
// An entry says: in this position, for the subject or the disciplinarian, at this beat, these bones take these local Euler
// angles (degrees [x, y, z], order YXZ, the engine's pose-table convention). For the subject, beat 'base' is the resting pose
// and 'contact' what it blends toward when struck; for the disciplinarian the beats are relaxed / raised / contact.
function checkBones(bones) {
  const out = {};
  for (const [b, e] of Object.entries(bones || {})) {
    if (!BONE_RE.test(b)) throw new Error('Odd bone name: ' + b);
    if (!Array.isArray(e) || e.length !== 3 || e.some(x => typeof x !== 'number' || !isFinite(x))) throw new Error(b + ' needs three numbers [x, y, z].');
    out[b] = e.map(x => Math.round(x * 100) / 100);
  }
  return out;
}
function entry(position, who, beat, bones, label) {
  if (!POSITIONS.includes(position)) throw new Error('Unknown position: ' + position);
  if (who !== 'subject' && who !== 'giver') throw new Error('who must be "subject" or "giver".');
  const b = who === 'subject' ? (beat === 'contact' ? 'contact' : 'base') : (BEATS[String(beat).toLowerCase()] || null);
  if (!b) throw new Error('Unknown beat: ' + beat);
  return { position, who, beat: b, bones: checkBones(bones), label: label || '' };
}
const nums = s => s.split(',').map(x => parseFloat(x));
// The viewer's pose-editor report. Each section is
//   == Arm raised · Hairbrush ==
//   [Position: chair. ]Disciplinarian X, subject Y, palm angle N%.   (older reports say “Over the case.” for the table)
//   Disciplinarian:  /  Subject:
//     bone: [x, y, z] → [x, y, z], turned …; local Δ […]; table [x, y, z] (the scene changes it)   or   … scene = table
// Where the scene changes a bone (IK), the pose table's own value is the one to keep; otherwise the edited value.
function parseReport(text, defaultPosition) {
  const out = [], warn = [];
  let sec = null, who = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    let m = /^==\s*(.+?)\s*==\s*$/.exec(line);
    if (m) {
      const [label] = m[1].split('·'); const lab = label.replace(/\((left|right|both sides)\)/i, '').trim().toLowerCase();
      sec = { beat: BEATS[lab] || null, label: m[1], position: defaultPosition || 'lap', bones: { subject: {}, giver: {} } }; who = null;
      if (!sec.beat) warn.push('Skipped a section with an unknown beat: ' + m[1]);
      out.push(sec); continue;
    }
    if (!sec) continue;
    let pm = /^Position:\s*(\w+)\./.exec(line);
    if (pm && POSITIONS.includes(pm[1])) { if (!defaultPosition) sec.position = pm[1]; continue; }
    if (/Over the (case|table)\./.test(line)) { if (!defaultPosition) sec.position = 'case'; continue; }
    if (/^Disciplinarian:\s*$/.test(line)) { who = 'giver'; continue; }
    if (/^Subject:\s*$/.test(line)) { who = 'subject'; continue; }
    m = /^\s+(\w+):\s*\[([^\]]+)\]\s*→\s*\[([^\]]+)\]/.exec(line);
    if (m && who) {
      const tab = /table\s*\[([^\]]+)\]/.exec(line), v = nums(tab ? tab[1] : m[3]);
      if (v.length === 3 && v.every(isFinite)) sec.bones[who][m[1]] = v;
    }
  }
  const entries = [];
  for (const s of out) {
    if (!s.beat) continue;
    for (const w of ['giver', 'subject']) {
      if (!Object.keys(s.bones[w]).length) continue;
      // the subject's edits at a relaxed or raised beat are its base pose; at contact, the struck pose
      const beat = w === 'subject' ? (s.beat === 'contact' ? 'contact' : 'base') : s.beat;
      entries.push(entry(s.position, w, beat, s.bones[w], s.label));
    }
  }
  return { entries, warn };
}
// JSON: an entry, an array of entries, or {position, who, beat, bones}. (Also {"subject": {...bones}, "giver": {...}, "beat":…}.)
function parsePoseJSON(text, defaults = {}) {
  const o = parseJSONLoose(String(text).trim().startsWith('[') ? '{"list":' + String(text).trim() + '}' : text);
  const list = o.list || (o.entries) || [o];
  const entries = [];
  for (const e of list) {
    if (e.bones) entries.push(entry(e.position || defaults.position || 'lap', e.who || defaults.who || 'subject', e.beat || defaults.beat || 'base', e.bones, e.label));
    else for (const w of ['subject', 'giver']) if (isObj(e[w])) entries.push(entry(e.position || defaults.position || 'lap', w, e.beat || defaults.beat || 'base', e[w], e.label));
  }
  if (!entries.length) throw new Error('No poses found in that JSON.');
  return { entries, warn: [] };
}
function parsePoses(text, defaults = {}) {
  const t = String(text).trim();
  if (!t) throw new Error('Nothing to read.');
  if (/^==/m.test(t) || /pose editor report/i.test(t)) { const r = parseReport(t, defaults.position && defaults.position !== 'auto' ? defaults.position : null); if (!r.entries.length) throw new Error('That report has no edited bones in it.'); return r; }
  return parsePoseJSON(t, defaults);
}
// Poses grouped for js/poses.js: one list per position, entries for the same slot merged bone by bone.
function groupPoses(entries) {
  const out = {};
  for (const e of entries) {
    const list = out[e.position] || (out[e.position] = []);
    const hit = list.find(p => p.who === e.who && p.beat === e.beat);
    if (hit) hit.bones = { ...hit.bones, ...e.bones }; else list.push({ who: e.who, beat: e.beat, bones: { ...e.bones } });
  }
  return out;
}
// The report for pose edits, to be pasted into js/poses.js (or sent on): each position's entries, written the way the file holds them.
function poseReport(entries) {
  const g = groupPoses(entries), lines = ['// Pose edits for js/poses.js: add each entry to its position\'s list (an entry for the same who and beat replaces that one\'s bones).'];
  for (const pos of POSITIONS) {
    if (!g[pos]) continue;
    lines.push(pos + ': [');
    for (const e of g[pos]) lines.push("  { who: '" + e.who + "', beat: '" + e.beat + "', bones: { " + Object.entries(e.bones).map(([b, v]) => b + ': [' + v.join(', ') + ']').join(', ') + ' } },');
    lines.push('],');
  }
  return lines.join('\n');
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// What `cur` changes about `base`, as a patch deepMerge understands (null removes a field).
function diff(base, cur) {
  const out = {};
  for (const k of Object.keys(cur)) { if (same(base[k], cur[k])) continue; out[k] = isObj(cur[k]) && isObj(base[k]) ? diff(base[k], cur[k]) : cur[k]; }
  for (const k of Object.keys(base)) if (!(k in cur)) out[k] = null;
  return out;
}
const hex = v => typeof v === 'number' && v > 255 ? '0x' + v.toString(16).padStart(6, '0') : v;
const fmt = o => JSON.stringify(o, null, 1).replace(/"?(\w+)"?: (\d{3,})/g, (m, k, n) => (+n > 255 && +n <= 0xffffff && /(color|hair|skin|eye|lip|shoe|buckle|above)/i.test(k) ? '"' + k + '": "' + hex(+n) + '"' : m));
// The report for a design: what it changes from the built-in one (a patch for js/bodies.js), and the whole design as it now stands.
function designReport(id, name, base, cur) {
  const patch = diff(base, cur);
  if (!Object.keys(patch).length) return '=== Design: ' + name + ' (' + id + ') ===\nNo changes from the built-in design.';
  return '=== Design: ' + name + ' (' + id + ') ===\nChanges from the built-in design (a patch for js/bodies.js: objects merge, arrays replace, null removes a field; colours may be written 0xrrggbb):\n' + fmt(patch) + '\n\nThe whole design as it now stands:\n' + fmt(cur);
}

const api = { POSITIONS, deepMerge, parseDesign, parsePoses, parseReport, parsePoseJSON, groupPoses, poseReport, designReport, diff };
root.FairyShoeEdits = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
