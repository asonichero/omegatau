// The editor's discipline scene is the game's: the subject's skirt is the hybrid one, a seated disciplinarian's glutes are pressed flat on the seat,
// and nothing from the browser's storage is read. Needs a static server (see README).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // a stale saved-override entry from the old editor must change nothing
  await p.addInitScript(() => { try { localStorage.setItem('fairyshoe.overrides.v1', JSON.stringify({ designs: { red: { height: 90 } }, poses: [] })); } catch (e) {} });
  await p.goto(process.argv[2] || 'http://localhost:8765/editor.html'); await p.waitForSelector('#sc-on');
  await p.click('#sc-on'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const v = window.__viewer, scn = v.scn, s = scn.s, g = scn.g; return { session: !!(v.sess && v.sess.scn === scn && typeof v.sess.setLayer === 'function' && typeof v.sess.smack === 'function'), position: v.sc.position, hybrid: !!(s.skirt && s.skirt.hybrid), height: Math.round(v.current[v.sc.subject].height), pressFloor: g.pressFloor, seatTop: scn.seatTop, hasSkirt: !!s.skirt, gathered: !!(s.skirt && s.skirt.gathered) }; });
  console.log(JSON.stringify(r));
  const bad = [];
  if (!r.session) bad.push('the editor\'s scene should be one of the game\'s sessions (FairyShoeScene.createSession)');
  if (r.hasSkirt && !r.gathered) bad.push('the editor\'s skirt should start hitched up, as the game\'s does');
  if (r.hasSkirt && !r.hybrid) bad.push('the subject\'s skirt should be the hybrid one');
  if (r.position === 'lap' && !(r.seatTop > 0 && r.pressFloor > r.seatTop)) bad.push('the seated disciplinarian should be pressed flat on the seat');
  if (r.height === 90) bad.push('browser-stored overrides must not be applied');
  if (errs.length) bad.push('page errors: ' + errs[0]);
  await b.close();
  if (bad.length) { console.error('FAIL ' + bad.join('; ')); process.exit(1); }
  console.log('ok');
})().catch(e => { console.error('FAIL', e.message.slice(0, 300)); process.exit(1); });
