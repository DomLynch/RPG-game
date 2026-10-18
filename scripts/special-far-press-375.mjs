// A real still and clip of a SPECIAL press that is too far (specialMeleeReach on): the hero draws, the dummy stands off, SPECIAL 1 is tapped, and the HUD floats "too far" over the hero (375 wide, the harness clock).
// Needs a build with the reach rows ON (the rows ship 0). The Mac GPU draws it; SWIFTSHADER=1 on the VPS.
//   node scripts/special-far-press-375.mjs --dist <dist> --out <dir> [--skill cleave] [--weapon longsword]
// Writes <out>/far-press.mp4, <out>/cue.jpg (the first frame the cue text is on screen) and <out>/receipt.json (the button state, the cue text read off the page, the gap in metres at the press).
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/far-press'), SKILL = arg('skill', 'cleave'), WEAPON = arg('weapon', 'longsword');

async function serveDist(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

await fs.rm(`${OUT}/frames`, { recursive: true, force: true }); await fs.mkdir(`${OUT}/frames`, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--ignore-gpu-blocklist', ...(process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal'])] });
const receipt = { skill: SKILL, weapon: WEAPON, cue: null, gap: null, button: null, frames: 0 };
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${server.origin}/?opponent=veteran&spar=1&weapon=${WEAPON}&difficulty=dummy&skill=${SKILL}&yourSpecial=none&special=none&debug`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page);
  await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});   // the first tap draws the blade
  await skipDraws(page, true); await clock.run(16 * 1260); await skipDraws(page, false);   // past the opening cooldown (RULES.special.first, 20 s = 1200 ticks): SPECIAL 1 is lit even with the dummy standing off
  receipt.gap = await page.evaluate(() => { const f = globalThis.__special().fighters; return Math.hypot(f[0].x - f[1].x, f[0].z - f[1].z); });
  receipt.button = await page.evaluate(() => { const b = document.querySelector('#skill-button'); return b ? { hidden: b.hidden, disabled: b.getAttribute('aria-disabled'), label: b.getAttribute('aria-label') } : null; });
  await page.locator('#skill-button').tap({ force: true, timeout: 3000 }).catch((e) => console.log('skill tap failed', e.message.slice(0, 120)));
  let cueFrame = -1;
  for (let n = 0; n < 90; n++) {
    await clock.run(16);
    const text = await page.evaluate(() => [...document.querySelectorAll('.dmg')].filter((s) => !s.hidden && s.textContent).map((s) => s.textContent).join('|'));
    if (text && receipt.cue === null) { receipt.cue = text; cueFrame = receipt.frames; }
    await page.screenshot({ path: `${OUT}/frames/${String(receipt.frames++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90, animations: 'disabled' });
  }
  if (cueFrame >= 0) await fs.copyFile(`${OUT}/frames/${String(cueFrame + 4).padStart(4, '0')}.jpg`, `${OUT}/cue.jpg`).catch(() => fs.copyFile(`${OUT}/frames/${String(cueFrame).padStart(4, '0')}.jpg`, `${OUT}/cue.jpg`));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', `${OUT}/frames/%04d.jpg`, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/far-press.mp4`]);
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); await server.close(); await fs.writeFile(`${OUT}/receipt.json`, JSON.stringify(receipt, null, 1)); }
