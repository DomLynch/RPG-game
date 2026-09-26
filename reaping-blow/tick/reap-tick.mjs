// Scratch: the player's Reaping Blow v a plain heavy, tick-stamped, on the REAL scene + sim (Lead 2026-09-26: is the blade inside
// the player's body at the sim's contact tick?). Each picked tick is rendered with the game's chase camera, then with a side-on clone.
//   node reap-tick.mjs --root <repo checkout> --move skill|heavy --out <dir>
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const root = opt('root', '/Users/domininclynch/Developer/frankendom-executioner');
const { createServer } = await import(`${root}/node_modules/vite/dist/node/index.js`);
const { chromium } = await import(`${root}/node_modules/playwright/index.mjs`);
const fs = await import('node:fs/promises');
const move = opt('move', 'skill'), opponent = opt('opponent', 'veteran'), dir = opt('out', `reap-${move}`);
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden}#world{display:block;width:100vw;height:100vh}
#stamp{position:fixed;left:8px;top:8px;font:bold 15px monospace;color:#fff;background:#000a;padding:4px 6px;white-space:pre}</style></head>
<body><canvas id="world"></canvas><div id="stamp"></div><script type="module">
import { createScene } from '/src/scene.ts';
import { initialPractice, stepPractice } from '/src/combat.ts';
import { OPPONENTS } from '/src/moves.ts';
const id = ${JSON.stringify(opponent)}, kind = ${JSON.stringify(move)}, TICK = 1 / 60;
const IDLE = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, held: false, lock: true, cancel: null };
const view = createScene(document.getElementById('world'), () => {}, id);
await view.ready;
let side = false, sideAt = null;
{ const r = view.renderer.render.bind(view.renderer);
  view.renderer.render = (s, c) => { if (!side || !sideAt || !c.isPerspectiveCamera) return r(s, c);
    const cam = c.clone(); cam.position.set(...sideAt.eye); cam.lookAt(...sideAt.look); cam.updateMatrixWorld(); r(s, cam); }; }
function simulate(seed) {
  let p = initialPractice(seed, OPPONENTS[id], 'longsword', kind === 'skill' ? 'reaping' : null); const frames = []; let started = -1, active = -1, hit = -1, fired = -1e9;
  for (let t = 0; t < 60 * 60 && (hit < 0 || frames.length < hit + 40); t++) {
    const f = p.duel.fighters[0], dx = p.enemy.x - p.fighter.x, dz = p.enemy.z - p.fighter.z, dist = Math.hypot(dx, dz);
    const intent = { ...IDLE };
    if (f.phase === 'sheathed' || f.phase === 'draw') intent.action = 'light';
    else if (f.phase === 'ready' && hit < 0) { if (dist > 1.8) intent.move = { x: dx, z: dz, yaw: Math.atan2(dx, dz), run: false }; else if (t - fired > 120) { intent.action = kind; fired = t; } }
    p = stepPractice(p, intent, OPPONENTS[id].profiles.normal);
    for (const ev of p.duel.events) if (ev.actor === 0) {
      if (ev.type === 'AttackStarted' && hit < 0) { started = frames.length; active = -1; }
      if (ev.type === 'AttackActive' && hit < 0) active = frames.length;
      if (ev.type === 'Hit' && hit < 0 && started >= 0 && (kind === 'skill' ? ev.move === 'skill_reaping' : ev.move === 'heavy_overhead')) hit = frames.length;
    }
    frames.push({ state: { ...p.fighter }, practice: p, events: p.duel.events, tick: p.duel.tick });
    if (p.duel.finish) break;
  }
  return { frames, started, active, hit };
}
let sim = null;
for (let seed = 11; seed < 80 && !sim; seed++) { const s = simulate(seed); if (s.hit >= 0) sim = { ...s, seed }; }
if (!sim) { window.__err = 'no landed ' + kind; throw new Error('no landed'); }
let cursor = 0;
const hitEvent = sim.frames[sim.hit].events.find(e => e.type === 'Hit' && e.actor === 0);
window.__reap = { seed: sim.seed, started: sim.started, active: sim.active, hit: sim.hit, hitTick: sim.frames[sim.hit].tick, event: hitEvent,
  to(i, cam) {
    while (cursor < i) { const f = sim.frames[cursor++]; side = false; view.render(f.state, true, TICK, f.practice, f.events, false); }
    const f = sim.frames[cursor++], p = f.practice, mx = (p.fighter.x + p.enemy.x) / 2, mz = (p.fighter.z + p.enemy.z) / 2;
    const ax = p.enemy.x - p.fighter.x, az = p.enemy.z - p.fighter.z, L = Math.hypot(ax, az) || 1, nx = -az / L, nz = ax / L;
    sideAt = { eye: [mx + nx * 3.4, 1.35, mz + nz * 3.4], look: [mx, 1.1, mz] };
    side = cam === 'side'; view.render(f.state, true, TICK, p, f.events, false); side = false;
    const tag = i === sim.hit ? 'HIT (sim contact)' : i === sim.active ? 'AttackActive' : i === sim.started ? 'AttackStarted' : '';
    document.getElementById('stamp').textContent = kind + '  tick ' + f.tick + '  (+' + (i - sim.started) + ' from start)\\n' + tag;
    return f.tick; },
  rewind(i) { cursor = i; } };
</script></body></html>`;
await fs.mkdir(dir, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'reap', configureServer(s) { s.middlewares.use(async (req, res, next) => {
  if (req.url.split('?')[0] !== '/reap.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/reap.html', PAGE)); }); } }] });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await page.goto(`${server.resolvedUrls.local[0]}reap.html`);
  await page.waitForFunction(() => window.__reap || window.__err, null, { timeout: 240000 });
  const info = await page.evaluate(() => window.__err ?? { seed: __reap.seed, started: __reap.started, active: __reap.active, hit: __reap.hit, hitTick: __reap.hitTick, event: __reap.event });
  console.log(JSON.stringify(info));
  if (typeof info === 'string') process.exit(1);
  // Every 4th tick through the windup, then every tick from 4 before AttackActive to 12 after the hit.
  const picks = []; for (let i = info.started; i < info.active - 4; i += 4) picks.push(i); for (let i = Math.max(info.started, info.active - 4); i <= info.hit + 12; i++) picks.push(i);
  for (const cam of ['chase', 'side']) {
    await page.evaluate(() => __reap.rewind(0));
    for (const i of picks) { const tick = await page.evaluate(([i, c]) => __reap.to(i, c), [i, cam]);
      await page.screenshot({ path: `${dir}/${cam}-${String(i - info.started).padStart(3, '0')}-t${tick}.png` }); }
  }
  await fs.writeFile(`${dir}/info.json`, JSON.stringify({ move, opponent, ...info }, null, 1));
  console.log('frames', picks.length * 2, dir);
} finally { await browser.close(); await server.close(); }
