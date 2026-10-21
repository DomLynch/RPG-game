// A guest is told what signing in costs (SCOPE guest acceptance item 4; Lead 2026-10-17, path B): Zone 1 at 375x812 as a guest. With an empty session bag the career line carries "Sign in" and NO loss line; once the guest holds
// something (a take or a kill: originsPreview.guestTake, the same call the ground pickup makes) the one plain line from kill-text.json appears under it, before the tap, and the Sign in link is still there; a toast that
// used to promise "sign in to keep it" no longer does. Stills before (empty bag) and after (holding) go to <out dir>.
//   node scripts/guest-loss-check.mjs <out dir>        Serves artifacts/origins-preview (built here when missing). ENGINE=webkit: Safari's engine as an iPhone.
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices, webkit } from 'playwright';

const [out] = process.argv.slice(2), root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!out) throw new Error('usage: guest-loss-check.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const LOSS = JSON.parse(fs.readFileSync('origins/preview/kill-text.json', 'utf8')).guest.signInLoss;
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
const WEBKIT = process.env.ENGINE === 'webkit';
const browser = WEBKIT ? await launchBrowser(webkit) : await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { engine: WEBKIT ? 'webkit' : 'chromium', errors: [] };
try {
  const ctx = await browser.newContext(WEBKIT ? { ...devices['iPhone 15'] } : { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 });
  await page.waitForSelector('#career a[href*="account=signin"], #save-note a[href*="account=signin"], a[href*="account=signin"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const read = () => page.evaluate(() => ({ link: !!document.querySelector('a[href*="account=signin"]'), loss: document.getElementById('guest-loss')?.textContent ?? null, bar: document.querySelector('a[href*="account=signin"]')?.parentElement?.innerText ?? '' }));
  receipt.before = await read();
  assert.ok(receipt.before.link, 'a guest sees the Sign in link');
  assert.equal(receipt.before.loss, null, 'an empty bag gets no loss line (no noise)');
  await page.screenshot({ path: path.join(out, '1-empty-bag.png') });
  await page.evaluate(() => window.originsPreview.guestTake('item:wolf-pelt', 2)); await page.waitForTimeout(500);
  receipt.after = await read();
  assert.ok(receipt.after.link, 'the Sign in link is still there');
  assert.equal(receipt.after.loss, LOSS, 'holding loot shows the row\'s line before the tap');
  const box = await page.evaluate(() => { const l = document.getElementById('guest-loss').getBoundingClientRect(); return { left: l.left, right: l.right, width: l.width, vw: innerWidth, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
  receipt.box = box;
  assert.ok(box.left >= -1 && box.right <= box.vw + 1 && !box.hscroll, `the line fits at 375 (${JSON.stringify(box)})`);
  await page.screenshot({ path: path.join(out, '2-holding-loot.png') });
  assert.deepEqual(receipt.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('guest-loss-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('guest-loss-check FAIL', JSON.stringify(receipt), error.message); process.exitCode = 1;
} finally { await browser.close(); server.close(); }
