// The animation-rate LOD against the same walkers at full rate, a 375-wide clip at 60 fps from a fixed-step page (scripts/character/anim-lod-clip.html on a vite dev server, software GL).
// Usage: node scripts/character/anim-lod-clip.mjs <out dir> [frames=240]   -> <out dir>/anim-lod.mp4 (needs ffmpeg), a few PNG frames and the page's result line.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/anim-lod'), frames = Number(process.argv[3] ?? 240), tmp = path.join(out, 'frames');
fs.mkdirSync(tmp, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/anim-lod-clip.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 }).catch(() => { throw new Error(`not ready: ${errors.join(' | ')}`); });
  const before = await page.evaluate(() => window.result);
  for (let f = 0; f < frames; f++) { await page.evaluate(() => window.step(1)); await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`) }); }
  const programsAfter = await page.evaluate(() => window.programs());
  console.log(JSON.stringify({ before, programsAfter, frames, errors: errors.length, errorText: errors.slice(0, 2) }));
  const ff = spawnSync('ffmpeg', ['-y', '-framerate', '60', '-i', path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', path.join(out, 'anim-lod.mp4')], { encoding: 'utf8' });
  console.log('ffmpeg exit', ff.status, path.join(out, 'anim-lod.mp4'));
} finally { await browser.close(); await server.close(); }
