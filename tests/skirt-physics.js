// Browser test of the skirt's cloth physics (headless Chromium, software GL; the scene is stepped by hand).
//   npx http-server . -p 8765 -s &  NODE_PATH=<where playwright lives> node tests/skirt-physics.js [base-url]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765';
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 600, height: 400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/tests/skirt.html');

  // Weight, and frame-rate independence: the cloth below the waist is lifted 10 cm and let go; the hem's height is read every 0.1 s.
  const traces = {};
  for (const [name, dt] of [['60', 1 / 60], ['20', 1 / 20], ['120', 1 / 120]]) {
    await p.evaluate(() => { setup('red', 'head', 'hand', 'free'); run(1.0, 1 / 60, 0); });
    traces[name] = await p.evaluate(([d]) => drop(0.10, 1.0, d, 0.1), [dt]);
  }
  const t = traces['60'], rest = t[t.length - 1], fall = t[0] - t[1];
  console.log('  hem height each 0.1 s:', t.map(v => v.toFixed(3)).join(' '));
  check(fall > 0.03, 'it falls at close to free-fall speed, not floating (' + (fall * 100).toFixed(1) + ' cm in the first 0.1 s; free fall is 4.9)');
  check(Math.abs(t[t.length - 1] - t[t.length - 2]) < 0.004, 'it comes to rest within a second');
  check(Math.max(...t.map(v => rest - v)) < 0.04, 'it does not stretch more than 4 cm past where it hangs (' + (Math.max(...t.map(v => rest - v)) * 100).toFixed(1) + ' cm)');
  for (const k of ['20', '120']) check(Math.max(...t.map((v, i) => Math.abs(v - traces[k][i]))) < 0.01, 'the same fall at ' + k + ' steps per second (within 1 cm)');

  // Discipline scenes: the subject's skirt is a hybrid (the gathered back is driven by the body's bones, the front and sides are cloth that collides with
  // everything). In every position, bottoms up or down, it is cloth plus a driven back, finite and near the body, and the cloth part has few points
  // inside the body, the furniture or the other body (the driven back is excluded: it is part of the body's own layout).
  for (const [who, pos, impl] of [['red', 'lap', 'hand'], ['red', 'case', 'hairbrush'], ['snow', 'head', 'hand'], ['snow', 'chair', 'hand'], ['goldilocks', 'spread', 'paddle'], ['goldilocks', 'lap', 'rod']]) {
    for (const mode of ['down', 'up']) {
      const r = await p.evaluate(([w, ps, im, m]) => {
        setup(w, ps, im, m);
        const S = skirt, n = S.R * S.N;
        const rep = () => { const a = Starlight.skirtClipReport(ses.subject, [ses.giver], [ses.scn.bench]), by = a.by || {}; return { own: by['own skin'] || 0, other: by['other body'] || 0, furn: by.furniture || 0 }; };
        run(3, 1 / 60, 0); const at = rep();
        // toggling bottoms and briefs must not move the skirt (no recalibration); the game's skirt is up, so only that mode is asked
        let still = true;
        if (m === 'up') { const before = Array.from(S.p), arr = S.p; ses.setLayer('bottoms', true); ses.setLayer('briefs', true); ses.setLayer('briefs', false); ses.setLayer('bottoms', false);
          for (let i = 0; i < 3; i++) { clock += 1 / 60; ses.tick(1 / 60, clock); }
          let moved = 0; for (let i = 0; i < before.length; i++) moved = Math.max(moved, Math.abs(before[i] - S.p[i])); still = arr === S.p && moved < 0.01; }
        run(3, 1 / 60, 1.0); const after = rep();
        let far = 0; const pel = ses.subject.bones.pelvis.getWorldPosition(new THREE.Vector3());
        for (let k = 0; k < n; k++) far = Math.max(far, Math.hypot(S.p[3 * k] - pel.x, S.p[3 * k + 1] - pel.y, S.p[3 * k + 2] - pel.z));
        return { still, hybrid: !!S.hybrid, driven: m === 'up' ? (S.kin ? S.kin.length : 0) : -1, at, after, far, n, finite: Array.from(S.p).every(Number.isFinite) };
      }, [who, pos, impl, mode]);
      const ok = r.hybrid && r.still && r.finite && r.far < 1.0 && (mode === 'down' || r.driven > 100) && r.after.own <= 0.08 * r.n && r.after.furn <= 0.03 * r.n && r.after.other <= 0.10 * r.n;
      check(ok, `${who}, ${pos}, ${impl}, ${mode}: hybrid skirt${r.driven > 0 ? ', ' + r.driven + ' points driven' : ''}; inside after strokes: own skin ${r.after.own}, furniture ${r.after.furn}, other body ${r.after.other} (of ${r.n}); farthest ${(r.far * 100).toFixed(0)} cm`);
    }
  }
  // In the game a skirt is always hitched up (the stage forces it); in the engine it can still be taken off.
  const modes = await p.evaluate(() => { setup('red', 'case', 'hand', 'up'); const up = !!skirt.gathered && !skirt.off; Starlight.setSkirtOff(ses.subject, true); return { up, off: !!ses.subject.skirt.off }; });
  check(modes.up && modes.off, 'in the game the skirt is always hitched up; the engine can still take it off');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  if (fails.length) { console.log(fails.length + ' failed'); process.exit(1); }
})().catch(e => { console.error('FAIL', e.message.slice(0, 500)); process.exit(1); });
