// Versus cards (presentation): one still per ladder rung of the fight about to happen — the real gladiator and the real opponent,
// armed and squared up in the arena, rendered through the game's own `createScene` — written to public/versus/<id>.webp and shown
// by index.html's #versus card while the rigs download (main.ts). Re-run when a rig, a weapon or the arena changes.
//   node scripts/versus-cards.mjs                 all live rungs
//   node scripts/versus-cards.mjs --only dwarf    one rung
//   node scripts/versus-cards.mjs --yaw 0.9 --pitch 0.3 --gap 1.6   framing knobs (radians / metres), printed with each card
// Portrait: the middle `crop` of a 1170×2535 frame (a 390×845 phone at 3×, as a viewport since the game caps its pixel ratio), WebP q0.72 encoded by Chromium itself (no native encoder needed). Deterministic: seeded duel, settled camera.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const args = process.argv.slice(2), option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const only = option('only'), yaw = +option('yaw', 0.95), pitch = +option('pitch', 0.3), gap = +option('gap', 1.7), quality = +option('quality', 0.72), crop = +option('crop', 0.86), cx = +option('cx', 0.66), cy = +option('cy', 0.47), lock = args.includes('--lock');   // 0.86: the shipped public/versus/*.webp are 1006×2180 = 0.86 of the 1170×2535 frame (audit 2026-09-22 — the default had drifted to 0.56, so a plain re-run would not reproduce them; cx/cy unverified against the shipped files, left as before)

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom versus cards</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#world{display:block}</style></head>
<body><canvas id="world"></canvas><script type="module">
import { createScene } from '/src/scene.ts';
import { initialPractice, project } from '/src/combat.ts';
import { OPPONENTS } from '/src/moves.ts';
import { LADDER } from '/src/ladder.ts';
import { TARGET } from '/src/sim.ts';
const id = new URLSearchParams(location.search).get('opponent'), TICK = 1 / 60;
const canvas = document.getElementById('world'), view = createScene(canvas, () => {}, id);
// Both fighters armed and facing, the hero \`gap\` metres from the target (tests/combat.test.ts, scripts/impact-preview.mjs).
function ready(gap) {
  const p = initialPractice(731, OPPONENTS[id]), f = p.duel.fighters;
  return project({ ...p.duel, fighters: [{ ...f[0], phase: 'ready', body: { x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 } }, f[1]] }, p.ai);
}
window.__cards = {
  ladder: LADDER.map(r => r.id),
  ready: view.ready.then(() => true).catch(e => String(e)),
  still(yaw, pitch, gap, quality, crop, cx, cy, lock) {
    const s = ready(gap);
    // Settle the free camera (it follows yaw/pitch from 7.5 m; --lock is the duel's over-the-shoulder pose, which hides the opponent behind
    // the hero), swing it to the three-quarter view, let the lerp land.
    view.recenter(); for (let i = 0; i < 60; i++) view.render(s.fighter, lock, TICK, s, [], false);
    view.orbit(-yaw / 0.005, (pitch - 0.45) / 0.003);
    for (let i = 0; i < 120; i++) view.render(s.fighter, lock, TICK, s, [], false);
    // The card is a window of the frame around the pair (centre cx, cy as fractions), so they fill it instead of standing small in the arena.
    const w = Math.round(canvas.width * crop), h = Math.round(canvas.height * crop), out = document.createElement('canvas'); out.width = w; out.height = h;
    const x0 = Math.min(canvas.width - w, Math.max(0, Math.round(canvas.width * cx - w / 2))), y0 = Math.min(canvas.height - h, Math.max(0, Math.round(canvas.height * cy - h / 2)));
    out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
    return out.toDataURL('image/webp', quality);
  },
};
</script></body></html>`;

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'versus-cards', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/versus-cards.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/versus-cards.html', PAGE)); }); } }] });
await server.listen();
const base = `${server.resolvedUrls.local[0]}versus-cards.html`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  await fs.mkdir('public/versus', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1170, height: 2535 }, deviceScaleFactor: 1 }), errors = [];   // the game caps its pixel ratio, so the resolution comes from the viewport: 3× a 390×845 phone
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.route('**/*sentry.io/**', r => r.abort());
  await page.goto(`${base}?opponent=veteran`); const ladder = await page.evaluate(() => window.__cards.ladder);
  for (const id of only ? [only] : ladder) {
    await page.goto(`${base}?opponent=${id}`); const ok = await page.evaluate(() => window.__cards.ready); if (ok !== true) throw new Error(`${id}: ${ok}`);
    const data = await page.evaluate(([y, p, g, q, c, x, yy, l]) => window.__cards.still(y, p, g, q, c, x, yy, l), [yaw, pitch, gap, quality, crop, cx, cy, lock]);
    const bytes = Buffer.from(data.split(',')[1], 'base64'); await fs.writeFile(`public/versus/${id}.webp`, bytes);
    console.log(`public/versus/${id}.webp  ${(bytes.length / 1024).toFixed(0)} KB  (yaw ${yaw}, pitch ${pitch}, gap ${gap}, crop ${crop} @ ${cx},${cy}, ${lock ? 'locked' : 'free'})`);
  }
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
