// Goblin fit stills (Combat, Dom 2026-10-18: "make sure the armour and the weapons fit the new size of the goblin model"): the PIT at 375x812 against the Goblin at a rung look (L4-L7: copper, bronze, iron, steel)
// and with each weapon class in the hero's hand, ready idle then the first mid-swing frame, from the same sim frames. For Characters' fit pass (hands on grips, no clipping at helm / shoulders / boots, no floating weapon).
//   node scripts/goblin-fit-stills.mjs --dist dist --out artifacts/goblin-fit [--only looks|weapons] [--dpr 2] [--clip x,y,w,h] [--swing-at 10]
// Writes <out>/<set>-<name>-idle.jpg and -swing.jpg plus <out>/fit.json (the phases and the goblin's bounding height read off the page). Never part of the build. Drawn on the Mac GPU; the VPS draws the same pixels on SwiftShader, slowly.
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/goblin-fit'), DPR = Number(arg('dpr', 2)), ONLY = arg('only', '');
const SWING_AT = Number(arg('swing-at', 10));   // the mid-swing still: this many frames after a fighter enters `attack`
const CLIP = arg('clip') ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, Number(arg('clip').split(',')[i])])) : undefined;   // --clip x,y,w,h in CSS px: a close-up of the goblin (with --dpr 4 a 300-px goblin); absent = the whole screen
const LOOKS = [{ name: 'L4', level: 4 }, { name: 'L5', level: 5 }, { name: 'L6', level: 6 }, { name: 'L7', level: 7 }];
const WEAPONS = ['longsword', 'warhammer', 'scythe', 'trident'];   // sword, hammer, scythe, trident: the classes Characters asked for; at the rung the goblin's L5 look
const query = (level, weapon) => `?opponent=goblin&spar=1&weapon=${weapon}&difficulty=${level}&skill=none&yourSpecial=none&special=none&debug`;
const shots = [...(ONLY === 'weapons' ? [] : LOOKS.map((l) => ({ set: 'look', name: l.name, level: l.level, weapon: 'longsword' }))), ...(ONLY === 'looks' ? [] : WEAPONS.map((w) => ({ set: 'weapon', name: w, level: 5, weapon: w })))];

async function serveDist(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

await fs.mkdir(OUT, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--ignore-gpu-blocklist', ...(process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal'])] });
const report = [];
try {
  for (const s of shots) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${server.origin}/${query(s.level, s.weapon)}`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page), tag = `${OUT}/${s.set}-${s.name}`;
    let idle = false, swing = false; const attacking = [0, 0];   // the sim fighters carry no age: count the frames each has been in `attack`
    for (let f = 0; f < 600 && !swing; f++) {
      if (f === 0) await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch((e) => console.log('tap failed', e.message.slice(0, 120)));   // the first tap draws the sword
      await skipDraws(page, true); await clock.run(16);
      const ph = await page.evaluate(() => globalThis.__special().fighters.map((x) => ({ phase: x.phase })));
      ph.forEach((x, i) => { attacking[i] = x.phase === 'attack' ? attacking[i] + 1 : 0; });
      if (!idle && f >= 150 && ph[0].phase === 'ready' && ph[1].phase === 'ready') { await skipDraws(page, false); await clock.run(16); await page.screenshot({ path: `${tag}-idle.jpg`, type: 'jpeg', quality: 92, clip: CLIP, timeout: 180000 }); idle = true; continue; }
      if (idle && f % 40 === 0) await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});   // the hero swings now and then so a mid-swing frame exists whatever the goblin does
      if (idle && attacking.some((n) => n === SWING_AT)) { await skipDraws(page, false); await clock.run(16); await page.screenshot({ path: `${tag}-swing.jpg`, type: 'jpeg', quality: 92, clip: CLIP, timeout: 180000 }); swing = true; }
    }
    report.push({ ...s, idle, swing, url: await page.evaluate(() => location.search) });
    console.log(s.set, s.name, 'idle', idle, 'swing', swing);
    await context.close();
  }
} finally { await browser.close(); await server.close(); await fs.writeFile(`${OUT}/fit.json`, JSON.stringify(report, null, 1)); }
