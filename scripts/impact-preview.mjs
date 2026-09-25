// Presentation review harness for contact feedback (sparks, camera kick, dust, kill exposure). The real simulation is scripted to a block,
// a parry, a landed heavy and a kill; the real `createScene` renders them at phone framing with the frame loop's hit-stop reproduced.
// Deterministic: fixed dt, seeded duel, camera settled before the moment. Never part of the build.
//   node scripts/impact-preview.mjs --label before          strips + trace into artifacts/presentation/<label>/
//   node scripts/impact-preview.mjs --label after --against before
//   node scripts/impact-preview.mjs --serve
//   node scripts/impact-preview.mjs --label wound --opponent goblin [--free]   the same moments against another rung (a landed heavy is a
//                                                                          wound mark); --free = three-quarter side view instead of the duel lock
//   node scripts/impact-preview.mjs --label bf-A --variant A --moments block,guardBreak --viewport 375x812 --full --frames 6,12
//                                                                          block feedback mockups: a whole phone frame per cell (SCOPE item 7)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const label = option('label') || commit, variant = option('variant'), full = args.includes('--full'), viewport = (option('viewport') || '393x852').split('x').map(Number), only = option('moments')?.split(','), frames = option('frames')?.split(',').map(Number), against = option('against'), opponentId = option('opponent') || 'veteran', free = args.includes('--free'), finisher = option('finisher');   // --opponent goblin: the same moments against another rung

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom impact preview</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#world{display:block}</style></head>
<body><canvas id="world"></canvas><script type="module">
import { createScene } from '/src/scene.ts';
import { PROFILES, initialPractice, project, stepPractice } from '/src/combat.ts';
import { OPPONENTS } from '/src/moves.ts';
import { TARGET } from '/src/sim.ts';
import { mirror, movesOf } from '/src/duel.ts';
const TICK = 1 / 60, HIT_STOP = { Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 120, Killed: 220 }, HEAVY = new Set(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);
const idle = () => ({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }), act = (action, extra = {}) => ({ ...idle(), action, ...extra });
const guard = s => { const w = s?.duel.fighters[1]; return { ...idle(), guard: true, guardDirection: w && w.phase === 'attack' && w.move ? mirror(movesOf(w)[w.move].direction) : undefined }; },   // the directional guard follows the blow (tests/ai.test.ts hold)
  passive = { ...PROFILES.easy, aggression: 0, parry: 0, dodge: 0, pressure: 0 }, light = { ...PROFILES.normal, pressure: 1 };   // pressure 1: the warden opens with a light cut
function ready(gap = 1.2, enemyHealth, stamina) {   // both fighters armed and facing, the hero \`gap\` metres from the target (tests/combat.test.ts)
  const p = initialPractice(731, OPPONENTS[OPPONENT]), f = p.duel.fighters;
  return project({ ...p.duel, fighters: [{ ...f[0], phase: 'ready', body: { x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, ...(stamina === undefined ? {} : { stamina }) }, { ...f[1], phase: 'ready', ...(enemyHealth ? { health: enemyHealth } : {}) }] }, p.ai);   // both armed: since v11 every fight opens sheathed (#741)
}
// Each moment: the practice states up to and past the contact tick; \`at\` is the index of the contact tick.
const MOMENTS = {
  block() { let s = ready(); const list = [s]; for (let i = 0; i < 900 && !s.events.some(e => e.type === 'Blocked'); i++) { s = stepPractice(s, guard(s)); list.push(s); } return tail(list, s, guard(s)); },
  guardBreak() { let s = ready(1.2, undefined, 0); const list = [s]; for (let i = 0; i < 900 && !s.events.some(e => e.type === 'GuardBroken'); i++) { s = stepPractice(s, guard(s), light); list.push(s); } return tail(list, s, guard(s), light); },   // an empty stamina bar cannot pay for the block: the guard breaks
  lightBlock() { let s = ready(); const list = [s]; for (let i = 0; i < 900 && !s.events.some(e => e.type === 'Blocked'); i++) { s = stepPractice(s, guard(s), light); list.push(s); } return tail(list, s, guard(s), light); },
  parry() {   // look ahead to the contact tick under a held guard, then press the parry 5 ticks before it (the window is RULES.parry ticks)
    let s = ready(); const list = [s];
    for (let i = 0; i < 900 && !s.threat; i++) { s = stepPractice(s, idle()); list.push(s); }
    let look = s, n = 0; while (n < 120 && !look.events.some(e => e.type === 'Blocked' || e.type === 'Hit')) { look = stepPractice(look, guard(s)); n++; }
    for (let i = 0; i < n - 5; i++) { s = stepPractice(s, idle()); list.push(s); }
    s = stepPractice(s, act('parry', { guard: true })); list.push(s);
    for (let i = 0; i < 30 && !s.events.some(e => e.type === 'Parried'); i++) { s = stepPractice(s, guard(s)); list.push(s); }
    return tail(list, s, guard(s));
  },
  heavy() { let s = ready(); const list = [s]; s = stepPractice(s, act('heavy'), passive); list.push(s); for (let i = 0; i < 80 && !s.events.some(e => e.type === 'Hit'); i++) { s = stepPractice(s, idle(), passive); list.push(s); } return tail(list, s, idle(), passive); },
  kill() { let s = ready(1.2, 5); const list = [s]; s = stepPractice(s, act('heavy'), passive); list.push(s); for (let i = 0; i < 80 && !s.events.some(e => e.type === 'Killed'); i++) { s = stepPractice(s, idle(), passive); list.push(s); } return tail(list, s, idle(), passive); },
};
function tail(list, s, intent, profile) { const at = list.length - 1; for (let i = 0; i < (FINISHER ? 120 : 24); i++) { s = stepPractice(s, intent, profile); list.push(s); } return { list, at }; }   // a forced finisher plays out over two seconds
const PARAMS = new URLSearchParams(location.search), OPPONENT = PARAMS.get('opponent') || 'veteran', LOCK = !PARAMS.has('free'), FINISHER = PARAMS.get('finisher');   // ?finisher=quietOne: force a finisher on the kill   // ?free: the three-quarter side view (versus-cards framing) instead of the duel lock
const canvas = document.getElementById('world'), view = createScene(canvas, () => {}, OPPONENT);
if (PARAMS.get('variant')) view.setBlockFeedback(PARAMS.get('variant'));   // block feedback mockups (SCOPE item 7)
const FULL = PARAMS.has('full');   // the whole phone frame instead of a crop around the fighters
if (FINISHER) view.setFinisherOverride(FINISHER);
const cell = { w: 360, h: 560 }, sheet = document.createElement('canvas'), ctx = sheet.getContext('2d');
// Render one moment the way main.ts does: settle the camera on the pre-contact state, then step frame by frame with the frame loop's hit-stop
// (the contact frame carries the events and is frozen; later frozen frames carry none; effects keep running on dt, the rigs hold).
function play(name, captureAt) {
  const { list, at } = MOMENTS[name](), start = Math.max(0, at - 30), cells = [], trace = [];
  const state = p => p.fighter, mid = p => [(p.fighter.x + p.enemy.x) / 2, 0.75, (p.fighter.z + p.enemy.z) / 2];
  view.recenter(); if (!LOCK) view.orbit(-0.95 / 0.005, (0.3 - 0.45) / 0.003); for (let i = 0; i < 90; i++) view.render(state(list[start]), LOCK, TICK, list[start], [], false);
  let frame = 0, stop = 0;
  for (let k = start; k < list.length; k++) {
    const p = list[k], events = p.events; let ms = 0;
    for (const e of events) { const base = HIT_STOP[e.type] ?? 0; if (!base) continue; const heavy = !!e.charged || HEAVY.has(e.move ?? ''); ms = Math.max(ms, e.type === 'Hit' && heavy ? 90 : e.type === 'Blocked' && heavy ? 50 : base); }
    stop = ms; const frozenFrames = Math.round(stop / (1000 * TICK));
    for (let f = 0; f <= frozenFrames; f++) {   // f = 0 is the contact frame itself (events + frozen when a stop applies)
      view.render(state(p), LOCK, TICK, p, f === 0 ? events : [], f === 0 ? stop > 0 : f < frozenFrames);
      if (k === at - 1) { const point = view.project(mid(p)); trace.push({ frame: -1, x: point ? +point[0].toFixed(2) : null, y: point ? +point[1].toFixed(2) : null, frozen: false, probe: null }); }   // the origin: the frame before contact
      if (k >= at) { const since = frame; const point = view.project(mid(p)); const probe = view.probe?.() ?? null, burst = probe?.burst && view.project(probe.burst); trace.push({ frame: since, x: point ? +point[0].toFixed(2) : null, y: point ? +point[1].toFixed(2) : null, frozen: f > 0 || (f === 0 && stop > 0), probe: probe && { ...probe, px: burst ? burst.map(v => Math.round(v)) : null } });   // px: where the latest burst sits on screen (CSS px), for the zoom crops
        if (captureAt.includes(since)) { const image = grab(point); cells.push({ since, image, brightness: brightness(image) }); } frame++; }
    }
  }
  return { cells, trace, events: list[at].events.map(e => e.type + (e.move ? ':' + e.move : '')) };
}
function grab(point) {   // a crop around the fighters at the canvas' physical resolution, so sparks are seen at the pixels the phone draws
  if (FULL) { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
  const c = document.createElement('canvas'); c.width = cell.w; c.height = cell.h; const g = c.getContext('2d'), r = canvas.width / innerWidth;
  const cx = (point ? point[0] : innerWidth / 2) * r, cy = (point ? point[1] : innerHeight / 2) * r;
  g.drawImage(canvas, cx - cell.w / 2, cy - cell.h / 2, cell.w, cell.h, 0, 0, cell.w, cell.h); return c;
}
function brightness(c) {   // mean of the crop's pixels (sRGB bytes): the kill dip's receipt
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let i = 0; i < d.length; i += 16) sum += d[i] + d[i + 1] + d[i + 2]; return +(sum / (d.length / 16) / 3).toFixed(2);
}
function strip(name, captureAt) {
  const { cells, trace, events } = play(name, captureAt);
  const w = cells[0]?.image.width ?? cell.w, h = cells[0]?.image.height ?? cell.h;
  sheet.width = cells.length * w; sheet.height = h + 22; ctx.fillStyle = '#111'; ctx.fillRect(0, 0, sheet.width, sheet.height);
  cells.forEach((c, i) => { ctx.drawImage(c.image, i * w, 22); ctx.fillStyle = '#eee'; ctx.font = '13px system-ui'; ctx.fillText(\`\${name} · contact+\${c.since} frames (\${Math.round(c.since * 1000 / 60)} ms)\`, i * w + 8, 15); });
  return { image: sheet.toDataURL('image/png'), trace, events, brightness: cells.map(c => [c.since, c.brightness]) };
}
window.__preview = { ready: view.ready.then(() => true).catch(e => String(e)), strip };
</script></body></html>`;

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'impact-preview', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/impact-preview.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/impact-preview.html', PAGE)); }); } }] });
await server.listen();
const url = `${server.resolvedUrls.local[0]}impact-preview.html?opponent=${opponentId}${free ? '&free' : ''}${variant ? `&variant=${variant}` : ''}${full ? '&full' : ''}${finisher ? `&finisher=${finisher}` : ''}`;
if (args.includes('--serve')) { console.log(`Impact preview: ${url}\nCtrl-C to stop.`); await new Promise(() => {}); }
const dir = `artifacts/presentation/${label}`; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() }), errors = [];
try {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.text().startsWith('DBG')) console.log(m.text()); if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.route('**/*sentry.io/**', r => r.abort());
  await page.goto(url); const ready = await page.evaluate(() => window.__preview.ready); if (ready !== true) throw new Error(ready);
  console.log(`Capturing ${label} (${commit}) →`);
  const stats = { label, commit, date: new Date().toISOString().slice(0, 10) };
  const moments = [['block', [0, 2, 5, 9]], ['lightBlock', [0, 2, 5, 9]], ['guardBreak', [0, 2, 5, 9]], ['parry', [0, 2, 5, 9]], ['heavy', [0, 2, 5, 9]], ['kill', finisher ? [8, 40, 90, 118] : [0, 1, 3, 8]]].filter(([n]) => !only || only.includes(n));
  for (const [name, at] of moments) {   // a forced finisher: later frames, when it has played
    const { image, trace, events, brightness } = await page.evaluate(([n, a]) => __preview.strip(n, a), [name, frames ?? at]);
    await fs.writeFile(`${dir}/${name}.png`, Buffer.from(image.split(',')[1], 'base64')); console.log(`  ${dir}/${name}.png  events: ${events.join(', ')}`);
    // Camera kick trace: how far (CSS px) a fixed world point between the fighters moves on screen from the frame before contact, frame by frame.
    const origin = trace[0], shift = trace.slice(1).map(t => t.x === null || origin.x === null ? null : +Math.hypot(t.x - origin.x, t.y - origin.y).toFixed(2));
    stats[name] = { events, cameraShiftPx: shift.slice(0, 16), peakShiftPx: Math.max(...shift.filter(v => v !== null)), brightness, probes: trace.slice(1, 17).map(t => t.probe) };
  }
  await fs.writeFile(`${dir}/stats.json`, JSON.stringify(stats, null, 1));
  const previous = against ? JSON.parse(await fs.readFile(`artifacts/presentation/${against}/stats.json`, 'utf8')) : null;
  for (const [name] of moments) console.log(`  ${name}: peak camera shift ${stats[name].peakShiftPx} px${previous?.[name] ? ` (was ${previous[name].peakShiftPx})` : ''}; trace ${stats[name].cameraShiftPx.join(' ')}; brightness ${stats[name].brightness.map(([f, b]) => `+${f}:${b}`).join(' ')}`);
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
