// SCRATCH stills for the COMBAT blade-occlusion proposal (never ships): the foe's wind-up at close range from the fight camera at 375x812, default vs ?bladeclear=<m>
// (scene.ts scratch flag: the foe's drawn body slides sideways while it winds up). One seeded fight per target replayed from its record cut mid-wind-up, on a built dist,
// one 16 ms frame at a time on the harness clock (scripts/lib/harness-clock.mjs). Runs on the VPS through `capture` (SwiftShader).
//   node scripts/blade-clear-stills.mjs --dist dist --out artifacts/blade-clear
/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { opponentAt, profileAt, WEAPONS } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { human } from './ladder-human.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/blade-clear'), DPR = Number(arg('dpr', 2));
// id, level, move, the foe's lateral shift in its own frame (m; the proposal's per-opponent number, from the geometry sweep), the wind-up share at which the frame is taken
const TARGETS = [
  { id: 'goblin', level: 18, kind: 'light_right', shift: -0.45 },
  { id: 'dwarf', level: 18, kind: 'light_right', shift: -0.5 },
  { id: 'knight', level: 18, kind: 'light_right', shift: 0.45 },
];

// The first seeded fight in which the foe starts `kind` at a close gap: the tick it starts, then the record cut at its wind-up's 65 %.
function recordTarget(t) {
  const o = OPPONENTS[t.id], body = opponentAt(o, t.level), mv = WEAPONS[body.weapon].moves[t.kind], close = WEAPONS[body.weapon].fight?.close ?? 1.15;
  for (let seed = 1; seed <= 200; seed++) {
    const bot = human('blocker', 12, 0.2, seed * 7919), profile = profileAt(o, t.level);
    let p = initialPractice(seed, body, 'longsword'); const intents = []; const rec = createRecorder({ build: 'bladeclear', opponent: t.id, weapon: 'longsword', level: t.level, seed });
    for (let tick = 0; tick < 3000 && !p.finish; tick++) {
      const q = rec.push(bot(p)); intents.push(q); p = stepPractice(p, q, profile);
      const f = p.duel.fighters, start = p.duel.events.find((e) => e.type === 'AttackStarted' && e.actor === 1 && e.move === t.kind);
      if (start && Math.hypot(f[0].body.x - f[1].body.x, f[0].body.z - f[1].body.z) <= close + 0.25) {
        const cut = tick + 1 + Math.round(mv.windup * 0.65), open = createRecorder({ build: 'bladeclear', opponent: t.id, weapon: 'longsword', level: t.level, seed });
        if (cut > intents.length) { for (let k = tick + 1; k < cut && !p.finish; k++) { const q2 = rec.push(bot(p)); intents.push(q2); p = stepPractice(p, q2, profile); } }
        for (const q of intents.slice(0, cut)) open.push(q);
        return { seed, startTick: tick, cut, gap: Math.hypot(f[0].body.x - f[1].body.x, f[0].body.z - f[1].body.z), record: open.finish('abandoned') };
      }
    }
  }
  throw new Error(`no ${t.kind} start at close range for ${t.id}`);
}

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shoot(text, extra, file, cut) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  try {
    await page.goto(`${server.origin}/?replay=${text}${extra}&debug`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page); let n = 0;
    for (; n < cut + 240; n++) {
      await skipDraws(page, n < cut - 4);
      await clock.run(16);
      if (n >= cut - 4) await page.screenshot({ path: file, type: 'jpeg', quality: 92, animations: 'disabled' });
      if (await page.evaluate(() => !!document.getElementById('debug')?.dataset.replay)) break;
    }
    return n;
  } finally { await context.close(); }
}
try {
  await fs.mkdir(OUT, { recursive: true }); const meta = [];
  for (const t of TARGETS) {
    const r = recordTarget(t), text = await encodeRecord(r.record);
    const a = await shoot(text, '', `${OUT}/${t.id}-${t.kind}-before.jpg`, r.cut), b = await shoot(text, `&bladeclear=${t.shift}`, `${OUT}/${t.id}-${t.kind}-after.jpg`, r.cut);
    meta.push({ ...t, seed: r.seed, startTick: r.startTick, cut: r.cut, gap: +r.gap.toFixed(2), framesBefore: a, framesAfter: b }); console.log(JSON.stringify(meta.at(-1)));
  }
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
} finally { await browser.close(); await server.close(); }
