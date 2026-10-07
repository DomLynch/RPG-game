/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { harnessClock } from './lib/harness-clock.mjs';
import http from 'node:http';
import path from 'node:path';
const [dist, out] = [process.argv[2], process.argv[3]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const srv = http.createServer(async (req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; let f = path.join(dist, p), d; try { d = await fs.readFile(f); } catch { f = path.join(dist, 'index.html'); d = await fs.readFile(f); } res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ headless: true });
let page;
const diagnose = () => page.evaluate(() => ({ visibility: document.visibilityState, welcomeHidden: document.querySelector('#welcome')?.hidden, message: document.querySelector('#message')?.textContent, attackDisabled: document.querySelector('#attack-button')?.getAttribute('aria-disabled'), guardDisabled: document.querySelector('#guard-button')?.getAttribute('aria-disabled'), flash: document.querySelector('#attack-button')?.dataset.flash ?? null, cut: document.querySelector('#attack-button')?.dataset.cut ?? null, label: document.querySelector('#attack-button')?.dataset.mobile }));
try {
  await fs.mkdir(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  await page.goto(`${origin}/?debug=1`);
  { const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({ timeout: 120000 }); }
  await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const { run, until } = await harnessClock(page);
  await run(200);
  await page.getByRole('button', { name: 'Fight', exact: true }).tap();
  console.log('afterDraw', JSON.stringify(await diagnose()));
  try { await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000); }
  catch (error) { console.log('DIAGNOSE', JSON.stringify(await diagnose())); throw error; }
  const shoot = async (tag) => {
    await page.locator('#attack-button').tap();
    const info = await page.evaluate(() => {
      const b = document.querySelector('#attack-button'), anims = document.getAnimations({ subtree: true }).filter((a) => a.animationName === 'cut-flash');
      for (const a of anims) { a.pause(); a.currentTime = 60; }
      return { flash: b.dataset.flash ?? null, cut: b.dataset.cut ?? null, anims: anims.length, beforeOpacity: getComputedStyle(b, '::before').opacity };
    });
    console.log(tag, JSON.stringify(info));
    const box = await page.locator('#attack-button').boundingBox();
    await page.screenshot({ path: `${out}/${tag}.png`, clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 30), width: box.width + 60, height: box.height + 60 } });
    await page.evaluate(() => { document.getAnimations({ subtree: true }).forEach((a) => a.cancel()); delete document.querySelector('#attack-button').dataset.flash; });
    await run(900);
  };
  for (const [side, key] of [['left', 'KeyA'], ['right', 'KeyD']]) {
    await page.keyboard.down(key); await run(300);
    await shoot(`${side}-60ms`);
    await page.keyboard.up(key); await run(900);
  }
  await shoot('neutral-60ms');
} catch (error) { console.log('FAILED', String(error).slice(0, 300)); try { console.log('DIAGNOSE', JSON.stringify(await diagnose())); } catch {} process.exitCode = 1; }
finally { await browser.close(); srv.close(); }
