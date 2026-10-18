// One 375-wide clip per melee special on a given weapon (Combat, Strategy 2026-10-18: "375 clip per special on longsword + knife" is the receipt for the Mixamo clips).
// The Pit sparring link with the hero's skill set to the special, a dummy opponent, the hero draws and presses SPECIAL 1; the page's clock is the harness clock (a fixed 16 ms step),
// a jpg per --every steps from the press to --seconds later, then ffmpeg. Mac GPU for the pixels (SWIFTSHADER=1 on the VPS: slow).
//   node scripts/special-clips-375.mjs --dist dist --out <dir> [--weapons longsword,knife] [--skills cleave,reaping,stomp,lunge] [--seconds 2.5] [--every 2]
// Writes <out>/<skill>-<weapon>/clip.mp4 and <out>/receipt.json (the SPECIAL 1 button's state at the press and the frames shot).
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/special-clips-375'), SECONDS = Number(arg('seconds', 2.5)), EVERY = Number(arg('every', 2));
const WEAPONS = arg('weapons', 'longsword,knife').split(','), SKILLS = arg('skills', 'cleave,reaping,stomp,lunge').split(',');

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

await fs.mkdir(OUT, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--ignore-gpu-blocklist', ...(process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal'])] });
const report = [];
try {
  for (const weapon of WEAPONS) for (const skill of SKILLS) {
    const dir = `${OUT}/${skill}-${weapon}`; await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(`${dir}/frames`, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${server.origin}/?opponent=veteran&spar=1&weapon=${weapon}&difficulty=dummy&skill=${skill}&yourSpecial=none&special=none&debug`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page);
    await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});   // the first tap draws the blade
    await skipDraws(page, true); await clock.run(16 * 150); await skipDraws(page, false);
    const btn = await page.evaluate(() => { const b = document.querySelector('#skill-button'); return b ? { hidden: b.hidden, disabled: b.getAttribute('aria-disabled'), label: b.getAttribute('aria-label') } : null; });
    await page.locator('#skill-button').tap({ force: true, timeout: 3000 }).catch((e) => console.log('skill tap failed', e.message.slice(0, 120)));
    const steps = Math.round(SECONDS * 60); let frames = 0;
    for (let n = 0; n < steps; n++) {
      await clock.run(16);
      if (n % EVERY === 0) await page.screenshot({ path: `${dir}/frames/${String(frames++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90, animations: 'disabled' });
    }
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(60 / EVERY / 2), '-i', `${dir}/frames/%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${dir}/clip.mp4`]);   // half speed: 30/EVERY... of 60 steps/s
    report.push({ skill, weapon, button: btn, frames });
    console.log(skill, weapon, 'button', JSON.stringify(btn), 'frames', frames);
    await context.close();
  }
} finally { await browser.close(); await server.close(); await fs.writeFile(`${OUT}/receipt.json`, JSON.stringify(report, null, 1)); }
