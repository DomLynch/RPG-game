// HUD and menu stills at 375x812 of a brand-new guest in Zone 1 on a built origins-preview page (before/after pairs for the specials PRs): hud.png (the fight HUD in a camp fight) and menu.png (the burger menu open).
// Usage: node scripts/special-hud-stills.mjs <built origins-preview dist> <out dir>   (PIT_GL=1 = software GL)
/* global process, console, window, document */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchBrowser(chromium, { args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 }); await page.waitForTimeout(3000);
  const t = await page.evaluate(() => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model); return { id: m.id, x: m.x, z: m.z }; });
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [t.x, t.z]);
  for (let i = 0; i < 80 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
  if (!(await page.evaluate(() => document.body.classList.contains('infight')))) await page.evaluate((id) => window.originsPreview.tapMob(id), t.id);
  await page.waitForTimeout(2500);
  console.log(JSON.stringify(await page.evaluate(() => ({ infight: document.body.classList.contains('infight'), one: document.querySelector('#skill-button')?.getAttribute('aria-label'), oneHidden: document.querySelector('#skill-button')?.hidden, two: document.querySelector('#skill2-button')?.getAttribute('aria-label'), twoHidden: document.querySelector('#skill2-button')?.hidden }))));
  await page.screenshot({ path: path.join(out, 'hud.png') });
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'menu.png') });
} finally { await browser.close(); server.close(); }
