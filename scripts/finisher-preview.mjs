// Finishers review harness. Drives the REAL scene (src/scene.ts — selection, gore, camera dolly) with REAL simulated kills and
// captures the death window at phone widths in all three blood modes. Never part of the build or the runtime.
//   node scripts/finisher-preview.mjs --label finishers-v2
//
// Honesty note (the owner reads this): every kill is a genuine simulation with NO overrides — the player draws, walks in and
// lands paced plain heavy overheads on a passive warden until one kills. Under the owner rule of 2026-09-18 (recorded on
// PR #112) any heavy-blow kill selects a finisher regardless of the coarse hit location, and the seeded rotation picks
// between the shipped two (Split Crown, Decapitation) from the kill event — so the harness runs the same passive duel across
// seeds and captures the first death window each finisher actually draws, organic kills on the production path end-to-end:
// selection, pose, clip, gore, dolly, severed head — nothing is presented as anything other than what the sim reported.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const label = option('label') || 'finishers-v2';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom finisher preview</title>
<style>html,body{margin:0;height:100%;background:#2b2d2f;overflow:hidden}#world{display:block;width:100vw;height:100vh}</style></head>
<body><canvas id="world"></canvas><script type="module">
import { createScene } from '/src/scene.ts';
import { initialPractice, stepPractice } from '/src/combat.ts';
import { selectFinisher } from '/src/finishers.ts';
const PASSIVE = { reaction: 1e9, accuracy: 0, parry: 0, dodge: 0, aggression: 0, pressure: 0, discipline: 0, lapse: 1 };
const IDLE = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, held: false, lock: true, cancel: null };
const TICK = 1 / 60;
const canvas = document.getElementById('world');
window.__step = 'module';
window.addEventListener('unhandledrejection', e => { window.__finisherError = String(e.reason && e.reason.stack || e.reason); });
const view = createScene(canvas, () => {}, 'veteran');
window.__step = 'scene';
await view.ready;
window.__step = 'ready';
// A real kill: light to draw, walk in, paced plain heavy overheads (the pacing lets posture drain so the killing blow stays a
// plain heavy_overhead — the warden is passive, both sides stepped through the real sim). Each seed yields its own kill
// event; the seeded rotation maps it to a finisher, and we keep the first death window each shipped finisher draws.
function simulate(seed) {
  let p = initialPractice(seed);
  const frames = [];
  let kill = -1;
  let lastHit = -1e9;
  for (let tick = 0; tick < 60 * 120; tick++) {
    if (kill >= 0 && p.duel.tick > kill + 200) break;   // the death window itself: 200 ticks (3.3 s) past the blow, corpse held
    const dx = p.enemy.x - p.fighter.x, dz = p.enemy.z - p.fighter.z;
    const dist = Math.hypot(dx, dz);
    const f = p.duel.fighters[0];
    const intent = { ...IDLE };
    if (f.phase === 'sheathed' || f.phase === 'draw') intent.action = 'light';
    else if (f.phase === 'ready') {
      if (dist > 1.9) intent.move = { x: dx, z: dz, yaw: Math.atan2(dx, dz), run: false };
      else if (tick - lastHit > 200) intent.action = 'heavy';
    }
    p = stepPractice(p, intent, PASSIVE);
    for (const e of p.duel.events) {
      if (e.type === 'Hit' && e.actor === 0) lastHit = p.duel.tick;
      if (e.type === 'Killed') kill = p.duel.tick;
    }
    frames.push({ state: { ...p.fighter }, practice: p, events: p.duel.events });
  }
  return { frames, kill };
}
// The first death window each shipped finisher draws, across seeded duels (the rotation seed is the kill event itself).
const windows = {};
const provenance = [];
for (let seed = 731; seed < 731 + 40 && (windows.splitCrown === undefined || windows.decapitation === undefined); seed++) {
  const sim = simulate(seed);
  if (sim.kill < 0) continue;   // the scripted duel produced no kill on this seed
  const finish = sim.frames[sim.frames.length - 1].practice.finish;
  const finisher = selectFinisher(finish, ['longsword', 'longsword']);
  if (finisher && windows[finisher] === undefined) {
    const from = sim.frames.findIndex(f => f.practice.duel.tick >= sim.kill - 45);
    windows[finisher] = { frames: sim.frames.slice(from, from + 220), killIndex: sim.frames.slice(from, from + 220).findIndex(f => f.events.some(e => e.type === 'Killed')) };
    provenance.push({ seed, finisher, finish });
  }
}
window.__provenance = provenance;
if (windows.splitCrown === undefined || windows.decapitation === undefined) throw new Error('could not draw both finishers across 40 seeds: ' + JSON.stringify(provenance));
window.__step = 'simulated';
let cursor = -1;
window.__finisher = {
  provenance,
  count(which) { return windows[which].frames.length; },
  killIndex(which) { return windows[which].killIndex; },
  play(which, i, mode) {
    // Render inside a rAF double-tick: without preserveDrawingBuffer a synchronous render never reaches the compositor,
    // and screenshots would show a stale frame. A fresh playback resets the cursor so the scene state rebuilds from tick 0.
    return new Promise(resolve => requestAnimationFrame(() => {
      if (mode) view.setBloodMode(mode);
      if (i <= cursor) { cursor = -1; view.recenter(); }
      for (let j = cursor + 1; j <= i; j++) { const f = windows[which].frames[j]; view.render(f.state, true, TICK, f.practice, f.events, false); cursor = j; }
      requestAnimationFrame(() => resolve(view.playing()));
    }));
  },
};
</script></body></html>`;

const dir = `artifacts/character/${label}`; await fs.mkdir(dir, { recursive: true });
// The page is served by this script (no harness file in the repo root); as a plugin it runs before vite's SPA fallback.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'finisher-preview', configureServer(s) { s.middlewares.use(async (req, res, next) => {
  if (req.url.split('?')[0] !== '/finisher-preview.html') return next();
  res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/finisher-preview.html', PAGE));
}) } }] });
await server.listen();
const url = `${server.resolvedUrls.local[0]}finisher-preview.html`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const errors = [];
const save = async (name, data) => { await fs.writeFile(`${dir}/${name}`, data); console.log(`  ${dir}/${name}`); };
try {
  console.log(`Capturing ${label} (${commit}) →`);
  const open = async (viewport) => {
    const page = await (await browser.newContext({ viewport, deviceScaleFactor: 2 })).newPage();
    page.on('pageerror', e => { errors.push(String(e)); console.log('  pageerror:', String(e).slice(0, 300)); });
    page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) { console.log('  HTTP', r.status(), r.url()); errors.push(`${r.status()} ${r.url()}`); } });
    await page.goto(url); await page.waitForFunction(() => window.__finisher || window.__finisherError, null, { timeout: 120000 }).catch(async () => { console.log("  stuck at step:", await page.evaluate(() => window.__step), "err:", await page.evaluate(() => window.__finisherError)); throw new Error("page stuck"); });
    return page;
  };
  const NAMES = { splitCrown: 'split-crown', decapitation: 'decapitation' };
  const info = await (await open({ width: 393, height: 852 })).evaluate(() => ({ provenance: window.__finisher.provenance }));
  for (const p of info.provenance) console.log(`  ${p.finisher}: seed ${p.seed}, kill ${JSON.stringify(p.finish)}`);
  // Mode stills: one clean playthrough per blood mode per finisher (scene state evolves with playback, so each mode replays from scratch).
  for (const which of ['splitCrown', 'decapitation']) {
    for (const [mode, name] of [['red', ''], ['dark', '-dark'], ['off', '-off']]) {
      const page = await open({ width: 393, height: 852 });
      const { killIndex, count } = await page.evaluate(w => ({ killIndex: __finisher.killIndex(w), count: __finisher.count(w) }), which);
      const settled = count - 1;
      for (const [i, suffix] of [[Math.min(killIndex + 26, settled), 'contact'], [Math.min(killIndex + 78, settled), 'drop'], [settled, 'settled']]) {
        const playing = await page.evaluate(([w, j, m]) => __finisher.play(w, j, m), [which, i, mode]);
        if (mode === 'red' && suffix === 'settled') console.log(`  ${which} rig at settle: ${playing.split(' ')[1]}`);
        await page.screenshot({ path: `${dir}/${NAMES[which]}-phone${name}-${suffix}.png` });
      }
      await page.context().close();
      if (mode === 'red') {   // the landscape lock for the wide frame — a FRESH page at landscape size: resizing the portrait
        const wide = await open({ width: 852, height: 393 });   // page invalidates the WebGL buffer and play() would skip the
        await wide.evaluate(w => __finisher.play(w, __finisher.count(w) - 1, 'red'), which);   // re-render (cursor already at settle)
        await wide.screenshot({ path: `${dir}/${NAMES[which]}-phone-landscape-settled.png` });
        await wide.context().close();
      }
    }
    // Feel reference: the whole death window in real time, phone portrait.
    const video = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: 393, height: 852 } } });
    const vpage = await video.newPage(); vpage.on('pageerror', e => errors.push(String(e)));
    await vpage.goto(url); await vpage.waitForFunction(() => window.__finisher, null, { timeout: 120000 });
    await vpage.evaluate(async w => {   // real-time playback: one presented frame per step (~30-60 fps under software GL)
      for (let i = 0; i < __finisher.count(w); i++) await __finisher.play(w, i, i === 0 ? 'red' : undefined);
    }, which);
    const file = await vpage.video(); await video.close(); await file.saveAs(`${dir}/${NAMES[which]}.webm`); await fs.rm(await file.path(), { force: true });
    console.log(`  ${dir}/${NAMES[which]}.webm`);
  }
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
