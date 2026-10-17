// A guest's build in Zone 1 (Lead 2026-10-17), as a player does it on a phone (375x812, software GL is fine, it is a layout and flow check): the HUD line offers "N points to place" (never a modal on its own), a tap opens the build dialog,
// the guest places every point and confirms (in memory only), the dialog closes and the line is gone, and a RELOAD brings the points back (nothing was stored). Stills of each step go to <out dir>.
//   node scripts/guest-build-check.mjs <out dir>      Serves artifacts/origins-preview (built here when missing). On the T4: scripts/gpu-run/guest-build.sh
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const [out] = process.argv.slice(2), root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!out) throw new Error('usage: guest-build-check.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { errors: [], requests: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  page.on('request', (r) => { if (/\/origins\//.test(r.url()) && r.method() === 'POST') receipt.requests.push(r.url().split('/').pop()); });
  const url = `http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`;
  const load = async () => { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }); await page.waitForTimeout(1500); };
  const nudge = () => page.locator('#build-nudge');
  await load();
  await nudge().waitFor({ timeout: 30000 });
  receipt.nudge = (await nudge().textContent())?.trim(); receipt.modalAtLoad = await page.evaluate(() => document.getElementById('build-dialog')?.open === true);
  assert.match(receipt.nudge, /^\d+ points? to place$/, `the HUD offers the points: ${receipt.nudge}`); assert.equal(receipt.modalAtLoad, false, 'the dialog never opens on its own');
  await page.screenshot({ path: path.join(out, '1-nudge-line.png') });
  await nudge().tap(); await page.waitForSelector('#build-dialog[open]', { timeout: 10000 });
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, '2-dialog.png') });
  const tapAt = async (loc) => { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };   // a touch at the button's centre (the dialog's hit test under Playwright's own tap check reports the page)
  {
    const plus = page.locator('#build-dialog .build-plus:not([disabled])').first(); await plus.scrollIntoViewIfNeeded(); const b = await plus.boundingBox();
    receipt.diag = await page.evaluate(({ x, y }) => { const hit = document.elementFromPoint(x, y); const log = []; const dlg = document.getElementById('build-dialog'); dlg.addEventListener('click', (e) => log.push('click:' + e.target.className), true); dlg.addEventListener('pointerdown', (e) => log.push('pd:' + e.target.className), true); window.__diagLog = log; return { hit: hit && (hit.tagName + '.' + hit.className), x, y, dlgRect: JSON.stringify(dlg.getBoundingClientRect()), inertDlg: dlg.inert }; }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
    receipt.diag.log = await page.evaluate(() => window.__diagLog); receipt.diag.val = await page.evaluate(() => document.querySelector('#build-dialog .build-val')?.textContent);
    await plus.evaluate((e) => e.click()); await page.waitForTimeout(200);
    receipt.diag.valAfterJsClick = await page.evaluate(() => [...document.querySelectorAll('#build-dialog .build-val')].map((v) => v.textContent).join(','));
    console.log('DIAG', JSON.stringify(receipt.diag));
  }
  let placed = 0;
  for (let guard = 0; guard < 400; guard++) { const plus = page.locator('#build-dialog .build-plus:not([disabled])').first(); if (!(await plus.count())) break; await tapAt(plus); placed++; }
  receipt.placed = placed; assert.ok(placed > 0, 'the guest placed points');
  await page.screenshot({ path: path.join(out, '3-placed.png') });
  await tapAt(page.locator('#build-dialog .build-confirm'));
  await page.waitForFunction(() => !document.getElementById('build-dialog')?.open, null, { timeout: 10000 });
  await page.waitForFunction(() => !document.getElementById('build-nudge'), null, { timeout: 10000 });
  receipt.afterConfirm = { dialogOpen: false, nudge: await nudge().count() };
  await page.screenshot({ path: path.join(out, '4-confirmed-line-gone.png') });
  assert.deepEqual(receipt.requests.filter((r) => /build_set|build_get|engage|kill_report/.test(r)), [], 'a guest sends no build or fight request');
  await load(); await nudge().waitFor({ timeout: 30000 });
  receipt.afterReload = (await nudge().textContent())?.trim(); assert.equal(receipt.afterReload, receipt.nudge, 'a reload brings the same points back: nothing was stored');
  await page.screenshot({ path: path.join(out, '5-after-reload.png') });
  assert.deepEqual(receipt.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('guest-build-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('guest-build-check FAIL', JSON.stringify(receipt), error.message); process.exitCode = 1;
} finally { await browser.close(); server.close(); }
