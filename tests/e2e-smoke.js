// Browser smoke test: plays through two days with Playwright (headless Chromium, software GL).
//   npx http-server . -p 8765 -s &  NODE_PATH=<where playwright lives> node tests/e2e-smoke.js [url] [screenshotDir]
// Corrections are ended without a stroke (software GL is far too slow to animate many), the rules themselves are covered by rules.test.js.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/index.html', SHOTS = process.argv[3];
const shot = (p, n, o = {}) => SHOTS ? p.screenshot({ path: `${SHOTS}/${n}.png`, ...o }) : null;
// Everything the live dock offers, once: cameras, layers, pace and strength, a change of position, a fetched implement.
async function liveControls(p) {
  const cam = '.hudtools button[aria-label="Camera angle"]', scene = '.hudtools button[aria-label^="Position"]', card = '.hudcard';
  // a real drag on the view orbits it and the wheel zooms (the HUD must let them through)
  await p.click(cam); await p.waitForTimeout(2500);
  const cp = () => p.evaluate(() => { const c = __fs.app.stage.camera, t = __fs.app.stage.controls.target; return { p: c.position.toArray(), d: c.position.distanceTo(t) }; });
  const c0 = await cp(), box = await p.locator('canvas').first().boundingBox(), mx = box.x + box.width * 0.4, my = box.y + box.height * 0.3;
  await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.move(mx + 160, my + 20, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1500);
  const c1 = await cp(); if (Math.hypot(...c1.p.map((v, i) => v - c0.p[i])) < 0.2) throw new Error('dragging should orbit the camera');
  await p.mouse.move(mx, my); await p.mouse.wheel(0, -400); await p.waitForTimeout(1200);
  const c2 = await cp(); if (c2.d > c1.d - 0.03) throw new Error('the wheel should zoom');
  // the camera button cycles the standard angles (one press each), then back to the start
  // a single smack lands, then the giver relaxes again
  await p.evaluate(() => __fs.app.live.smack());
  await p.waitForFunction(() => __fs.app.live.scn.swing > 1.9, null, { timeout: 60000 });
  await p.waitForFunction(() => __fs.app.live.scn.swing < 0.1, null, { timeout: 60000 });
  const seen = []; for (let i = 0; i < 4; i++) { await p.click(cam); seen.push(await p.evaluate(() => __fs.app.stage.cameraMode)); }
  if (new Set(seen).size !== 4) throw new Error('the camera button should cycle four angles: ' + seen);
  while ((await p.evaluate(() => __fs.app.stage.cameraMode)) !== 'overview') await p.click(cam);
  await p.click(`${card} >> button:text-is("Faster")`); await p.click(`${card} >> button:text-is("Harder")`);
  await p.click(`${card} >> button[aria-label="Fewer smacks in a run"]`);
  const state = () => p.evaluate(() => ({ pos: __fs.app.live.position, impl: __fs.app.live.implement, pace: __fs.app.live.pace, strength: __fs.app.live.strengthMult, run: __fs.app.live.runLength, cam: __fs.app.stage.cameraMode }));
  let s = await state(); if (s.pace !== 1.25 || s.strength !== 1.25 || s.run !== 8 || s.cam !== 'overview') throw new Error('nudges or camera: ' + JSON.stringify(s));
  // the scene pop-up: position, implement and clothes are chosen together, then confirmed; nothing moves before that
  await p.click(scene);
  const d0 = await p.evaluate(() => __fs.app.live.distress());
  await p.click('.overlay .picks2 button:has-text("Over the desk")');
  await p.click('.overlay .picks2 button:has-text("Her own paddle")');
  await p.click('.overlay .picks2 button:has-text("Tell ")');
  await p.click('.overlay .picks2 button:has-text("Bottoms")');
  if ((await state()).pos === 'case') throw new Error('nothing should change before the changes are confirmed');
  await p.click('.overlay button:text-is("Confirm changes")');
  await p.waitForSelector('#veil button:text-is("Continue")', { timeout: 120000 });
  const lines = await p.locator('#veil p.ln').count(); if (lines < 4) throw new Error('the interlude should tell everything that changed: ' + lines);
  await p.click('#veil button:text-is("Continue")');
  await p.waitForSelector('#veil', { state: 'hidden', timeout: 30000 });
  s = await state(); if (s.impl !== 'ownpaddle' || s.pos !== 'case') throw new Error('the changes did not apply: ' + JSON.stringify(s));
  const d1 = await p.evaluate(() => __fs.app.live.distress()); if (Math.abs(d1 - d0) > 1e-6) throw new Error('composure should be frozen through the change: ' + d0 + ' -> ' + d1);
  await p.waitForTimeout(1200); if (Math.abs(await p.evaluate(() => __fs.app.live.distress()) - d0) > 1e-6) throw new Error('composure should stay frozen until a smack');
  if (!(await p.locator('.speech:not([hidden])').count())) throw new Error('the subject should speak when the scene reopens');
  // the sound button sits by the camera
  await p.click('.hudtools button[aria-label="Sound"]'); await p.click('.hudtools button[aria-label="Sound"]');
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W || 520), height: +(process.env.H || 900) } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await shot(p, 'intro', { fullPage: true });
  await p.fill('input[type=text]', 'Avery');
  await p.click('text=Open the app');
  await p.waitForSelector('.doc'); await shot(p, 'memo', { fullPage: true });
  if (!(await p.locator('.doc-entry').count() === 3)) throw new Error('the memo names three sisters');
  await p.click('text=Acknowledge'); await p.waitForSelector('.login'); await p.click('text=Sign in');
  await p.waitForSelector('.board', { timeout: 8000 });
  for (let day = 1; day <= 2; day++) {
    if (day === 2) {   // after an evening, the president comes first
      await p.waitForSelector('.presresp'); await shot(p, 'president', { fullPage: true });
      if (!(await p.locator('.pres-msg p').count())) throw new Error('the president should have something to say');
      await p.click('text=Go to today’s duties'); await p.waitForSelector('.board');
    }
    for (let i = 0; i < 3; i++) { await p.locator('.sister-chip:not(.assigned)').first().click(); await p.locator('.duty-slot:not(.taken)').first().click(); }
    await p.waitForTimeout(800); if (await p.locator('.register').count()) throw new Error('the day must not begin by itself');
    await p.click('button:has-text("Duties assigned")');
    await p.waitForSelector('.register');
    if (await p.locator('.post').count() !== 3) throw new Error('three posts, one per sister');
    if (day === 1) await shot(p, 'evening', { fullPage: true });
    let guard = 0;
    while (guard++ < 6) {
      const left = await p.evaluate(() => __fs.app.g.cards.filter(c => !c.done).map(c => c.id));
      if (!left.length) break;
      if (guard === 1 && day === 1) {   // leaving for the menu in the evening and continuing returns to the evening
        await p.click('button:text-is("Menu")'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(400);
        if (!(await p.locator('.register').count())) throw new Error('Continue from the menu should return to the evening');
      }
      await p.locator('#post-' + left[0] + ' .dm-btn').click(); await p.waitForSelector('.composer');
      if (guard % 2) {   // a word
        await p.locator('.chip.reprieve:not(.muted)').first().click();
        if (guard === 1 && day === 1) await shot(p, 'reprieve-draft', { fullPage: true });
        await p.click('.send-btn'); await p.waitForSelector('.result');
        await p.click('.result >> text=Next'); await p.waitForSelector('.register'); continue;
      }
      await p.locator('.chip:has-text("The Hairbrush")').click(); await p.locator('.chip:has-text("Clothed")').click();
      if (guard === 2 && day === 1) await shot(p, 'composer', { fullPage: true });
      await p.click('.send-btn');
      await p.waitForSelector('text=End the correction', { timeout: 90000 });
      if (await p.locator('.overlay:not([hidden]) h2:text-is("Your first correction")').count()) {   // the walk-through is offered once: take it, all the way
        await p.click('.overlay button:text-is("Walk me through")');
        let n = 0; while (await p.locator('.coach').count() && n++ < 10) { await p.waitForSelector('.coach .primary'); await p.click('.coach .primary'); await p.waitForTimeout(300); }
        if (n !== 7) throw new Error('the walk-through should have 7 steps, saw ' + n);
      }
      const st = await p.evaluate(() => ({ impl: __fs.app.live.implement, pos: __fs.app.live.position, lay: __fs.app.live.layers }));
      if (st.impl !== 'hairbrush' || st.pos !== 'lap' || st.lay.bottoms) throw new Error('the message should set where it begins: ' + JSON.stringify(st));
      if (day === 1 && guard === 2) await liveControls(p);
      if (day === 1 && guard === 2) await p.evaluate(() => { __fs.app.g.candle = 8; });   // (enough for every aftercare scene)
      await p.click('text=End the correction');
      await p.waitForSelector('.result');
      if (day === 1 && guard === 2) await shot(p, 'result');
      if (await p.locator('.result >> text=Next').count()) throw new Error('Next must not be offered before an aftercare choice');
      if (day === 1 && guard === 2) {   // one way for the evening to end: a scene, then Next (the choices are gone once one is made)
        await p.click('.result .choice:has-text("Corner Time")'); await p.waitForSelector('.scenebar button', { timeout: 90000 }); await p.waitForTimeout(1500);
        if (!(await p.locator('.scenebar p').count())) throw new Error('the scene should have words in its card');
        await shot(p, 'after-Corner-Time');
        await p.click('.scenebar button'); await p.waitForSelector('.result');
        if (await p.locator('.result .choice:has-text("Lines")').count()) throw new Error('only one way for the evening to end');
        for (const kind of ['lines', 'held', 'warm']) {   // (the other scenes are built directly: each must come up and settle without an error)
          await p.evaluate(k => { const a = __fs.app; a.stage.tableau(k, { giver: __fs.B.keeper(), subject: __fs.B.spec('lila'), subjectId: 'lila', layers: {} }); }, kind);
          await p.waitForTimeout(1200); await shot(p, 'after-' + kind);
        }
        await p.click('.result >> text=Next');
      } else {
        await p.click('.result .choice:has-text("Sent to Bed")'); await p.click('#veil button:text-is("Next")', { timeout: 20000 });
      }
      await p.waitForSelector('.register');
    }
    const sent = await p.locator('.sent-msg').count(); if (sent < 1) throw new Error('sent messages stay on the timeline');
    await p.click('button:has-text("Probation Report")'); await p.waitForSelector('.dm-line'); if (day === 1) await shot(p, 'report', { fullPage: true });
    if (await p.locator('.dm-line').count() !== 3) throw new Error('the report has a paragraph per sister'); const rt = await p.locator('.dm').innerText(); if (!/Dress:/.test(rt) || !/Afterwards|No aftercare|didn.t correct/.test(rt)) throw new Error('the report should say what was done: ' + rt);
    await p.click('.full-btn:text-is("Send to @president")');
    await p.waitForSelector('.presresp, .overlay:not([hidden]), .standing', { timeout: 20000 });
    if (await p.locator('.overlay:not([hidden]) .primary').count()) { await p.click('.overlay .primary'); await p.waitForSelector('.presresp, .standing'); }
    if (await p.locator('.standing').count()) break;
  }
  const day = await p.evaluate(() => __fs.app.g.day), saved = await p.evaluate(() => !!localStorage.getItem('otk.v1'));
  console.log(JSON.stringify({ day, saved, errors: errs }));
  await b.close();
  if (errs.length || day < 2 || !saved) process.exit(1);
})().catch(e => { console.error('FAIL', e.message.slice(0, 600)); process.exit(1); });
