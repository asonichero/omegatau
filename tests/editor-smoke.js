// The editor loads, previews a change, and reports it; it saves nothing and the game never sees it. Needs a static server (see README).
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/editor.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#ed-rdesign');
  const check = (ok, msg) => { if (!ok) throw new Error(msg); console.log('ok  ' + msg); };
  await p.click('#ed-rdesign');
  check(/No changes/.test(await p.inputValue('#ed-report')), 'an untouched design reports no changes');
  await p.fill('#ed-design', '{"height": 171}'); await p.click('#ed-apply');
  await p.click('#ed-rdesign');
  const r = await p.inputValue('#ed-report');
  check(/"height": 171/.test(r) && /Design: /.test(r), 'a previewed change is reported as a patch');
  await p.click('#ed-revert'); await p.click('#ed-rdesign');
  check(/No changes/.test(await p.inputValue('#ed-report')), 'reverting goes back to js/bodies.js');
  await p.click('#ed-rposes');
  check(/nothing to report/i.test(await p.textContent('#ed-msg')), 'with no pose edit made there is nothing to report, said plainly');
  const stored = await p.evaluate(() => Object.keys(localStorage).filter(k => /override/i.test(k)));
  check(stored.length === 0, 'nothing is stored in the browser');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
