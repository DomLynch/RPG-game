// Finishers review harness. Drives the REAL scene (src/scene.ts — selection, gore, camera dolly) with a REAL simulated kill and
// captures the death window at phone widths in all three blood modes. Never part of the build or the runtime.
//   node scripts/finisher-preview.mjs --label finishers-v1
//
// Honesty note (the owner reads this): the kill is a genuine simulation — the player draws, walks in and lands paced plain
// heavy overheads on a passive warden until one kills. Only ONE field is overridden at the presentation seam: the Killed/Hit
// event's `location` is set to 'head' so the spec's Split Crown row (heavy overhead → head) is exercised, because with the
// shipped blade paths no move's contact ever lands in the head region (24-duel AI battery, 285 hits: torso and legs only —
// see artifacts/finishers/REQUESTS.md). Everything downstream of the event — selection, pose, clip, gore, dolly — is the
// unmodified production code path.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const label = option('label') || 'finishers-v1';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom finisher preview</title>
<style>html,body{margin:0;height:100%;background:#2b2d2f;overflow:hidden}#world{display:block;width:100vw;height:100vh}</style></head>
<body><canvas id="world"></canvas><script type="module">
import { createScene } from '/src/scene.ts';
import { initialPractice, stepPractice } from '/src/combat.ts';
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
// plain heavy_overhead — the warden is passive, both sides stepped through the real sim).
function simulate() {
  let p = initialPractice(731);
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
const sim = simulate();
window.__step = 'simulated';
if (sim.kill < 0) throw new Error('the scripted duel produced no kill');
// The window: 0.75 s before the blow, 3.25 s after (the whole 144-tick death plus settle).
const from = sim.frames.findIndex(f => f.practice.duel.tick >= sim.kill - 45);
const deathWindow = sim.frames.slice(from, from + 220).map((f, i) => {
  const atKill = f.practice.duel.tick >= sim.kill;
  if (!atKill) return f;
  // THE ONE OVERRIDE (see the header): the head row of the spec table never occurs organically with the shipped blade
  // paths, so the kill event is presented as the spec row it exists for. The sim decided everything else.
  const events = f.events.map(e => (e.type === 'Killed' || (e.type === 'Hit' && e.target === 1)) ? { ...e, location: 'head' } : e);
  const practice = { ...f.practice, finish: f.practice.finish ? { ...f.practice.finish, location: 'head' } : f.practice.finish, enemyWoundSite: 'head' };
  return { ...f, events, practice };
});
const killIndex = deathWindow.findIndex(f => f.events.some(e => e.type === 'Killed'));
let cursor = -1;
window.__finisher = {
  killIndex, count: deathWindow.length,
  finish: deathWindow[deathWindow.length - 1].practice.finish,
  play(i, mode) {
    // Render inside a rAF double-tick: without preserveDrawingBuffer a synchronous render never reaches the compositor,
    // and screenshots would show a stale frame.
    return new Promise(resolve => requestAnimationFrame(() => {
      if (mode) view.setBloodMode(mode);
      for (let j = cursor + 1; j <= i; j++) { const f = deathWindow[j]; view.render(f.state, true, TICK, f.practice, f.events, false); cursor = j; }
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
  // Mode stills: one clean playthrough per blood mode (scene state evolves with playback, so each mode replays from scratch).
  for (const [mode, name] of [['red', ''], ['dark', '-dark'], ['off', '-off']]) {
    const page = await open({ width: 393, height: 852 });
    const { killIndex, count, finish } = await page.evaluate(() => ({ killIndex: __finisher.killIndex, count: __finisher.count, finish: __finisher.finish }));
    if (mode === 'red') console.log(`  kill at playback frame ${killIndex}; finish ${JSON.stringify(finish)}`);
    const settled = count - 1;
    for (const [i, suffix] of [[Math.min(killIndex + 26, settled), 'contact'], [Math.min(killIndex + 78, settled), 'drop'], [settled, 'settled']]) {
      const playing = await page.evaluate(([j, m]) => __finisher.play(j, m), [i, mode]);
      if (mode === 'red' && suffix === 'settled') console.log(`  opponent rig at settle: ${playing.split(' ')[1]}`);
      await page.screenshot({ path: `${dir}/split-crown-phone${name}-${suffix}.png` });
    }
    await page.context().close();
    if (mode === 'red') {   // the landscape lock for the wide frame — a FRESH page at landscape size: resizing the portrait
      const wide = await open({ width: 852, height: 393 });   // page invalidates the WebGL buffer and play() would skip the
      await wide.evaluate(() => __finisher.play(__finisher.count - 1, 'red'));   // re-render (cursor already at settle)
      await wide.screenshot({ path: `${dir}/split-crown-phone-landscape-settled.png` });
      await wide.context().close();
    }
  }
  // Feel reference: the whole death window in real time, phone portrait.
  const video = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: 393, height: 852 } } });
  const vpage = await video.newPage(); vpage.on('pageerror', e => errors.push(String(e)));
  await vpage.goto(url); await vpage.waitForFunction(() => window.__finisher, null, { timeout: 120000 });
  await vpage.evaluate(async () => {   // real-time playback: one presented frame per step (~30-60 fps under software GL)
    for (let i = 0; i < __finisher.count; i++) await __finisher.play(i, i === 0 ? 'red' : undefined);
  });
  const file = await vpage.video(); await video.close(); await file.saveAs(`${dir}/split-crown.webm`); await fs.rm(await file.path(), { force: true });
  console.log(`  ${dir}/split-crown.webm`);
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
