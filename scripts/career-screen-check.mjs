// The Career tab (core slice 2, src/career-screen.ts) in the Pit's journal, GUEST (the signed-in read is the stubbed-RPC unit test, tests/career-client.test.ts): ten title rows of five rungs, the rung the seeded
// 7 marks give lit (Legionary III), the sign-in note where the account's scorecard would be, nothing scrolls sideways, every tab target >= 44 px, and no two visible controls overlap, at 375x812, 812x375 (landscape) and 1024x768.
// Stills: artifacts/career-screen/. Serves this tree's build (run `npx vite build` first). PIT_GL=1 = the browser's own (software) GL, for the VPS.
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = process.env.CAREER_RECEIPT_DIR || 'artifacts/career-screen'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = { version: 1, id: 'career-fighter-0001', name: 'Wanderer', career: { victoryMarks: 7 }, loot: { owned: [], equipped: {} } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const receipt = { origin, errors: [], views: {}, passed: false };
const verify = async (page, name, W) => {
  const v = await page.evaluate(() => {
    const root = document.getElementById('career-root'), box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const tabs = [...document.querySelectorAll('#journal .tab-strip label:not([hidden])')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ id: e.className, ...box(e) }));
    const j = document.getElementById('journal');
    return { rows: root.querySelectorAll('.career-title').length, rungs: root.querySelectorAll('.career-rung').length, now: [...root.querySelectorAll('.career-rung.now')].map((e) => e.title), rank: root.querySelector('.career-rank')?.textContent, note: root.querySelector('.career-note')?.textContent, boards: root.querySelector('.career-boards .career-note')?.textContent, tabs, wide: [document.documentElement.scrollWidth, j.scrollWidth] };
  });
  receipt.views[name] = v;
  assert.equal(v.rows, 10, `${name}: ten titles`); assert.equal(v.rungs, 50, `${name}: fifty rungs`); assert.deepEqual(v.now, ['Legionary III'], `${name}: the rung 7 marks give`);
  assert.equal(v.rank, 'Legionary III'); assert.match(v.note, /Sign in/, `${name}: the guest note`); assert.equal(v.boards, 'Sign in to see the boards.', `${name}: the guest boards note`);
  assert.ok(v.wide.every((w) => w <= W + 1), `${name}: no sideways scroll ${v.wide}`);
  assert.deepEqual(v.tabs.filter((t) => t.h < 44).map((t) => t.id), [], `${name}: tab targets >= 44 px`);
  for (let i = 0; i < v.tabs.length; i++) for (let k = i + 1; k < v.tabs.length; k++) { const a = v.tabs[i], b = v.tabs[k], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); assert.ok(!(ox > 2 && oy > 2), `${name}: tabs ${a.id} and ${b.id} overlap`); }
};
try {
  for (const [name, W, H] of [['portrait', 375, 812], ['landscape', 812, 375], ['ipad', 1024, 768]]) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 900, hasTouch: W < 900 });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    await page.locator('#journal-button').click(); await page.waitForTimeout(1200);
    await page.locator('#journal .tab-career').click(); await page.waitForTimeout(800);
    await verify(page, name, W);
    await page.screenshot({ path: `${dir}/career-${name}.png` });
    await page.evaluate(() => { document.getElementById('journal').scrollTop = 99999; }); await page.screenshot({ path: `${dir}/career-${name}-scrolled.png` });
    await context.close();
  }
  if (process.env.ZONE_DIST) {   // the same tab in the zone page's ☰ (origins-preview build): one component, no zone copy
    const http = await import('node:http'), path = await import('node:path'), { createReadStream, existsSync, statSync } = await import('node:fs');
    const built = path.resolve(process.env.ZONE_DIST), root = process.cwd(), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
    const roots = { '/preview/origins/': `${built}/` }; for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
    const zs = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [pre, r] of Object.entries(roots)) if (u.startsWith(pre)) hit = path.join(r, u.slice(pre.length) || 'index.html'); if (hit && existsSync(hit) && statSync(hit).isDirectory()) hit = path.join(hit, 'index.html'); if (!hit || !existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); createReadStream(hit).pipe(res); });
    await new Promise((r) => zs.listen(0, '127.0.0.1', r)); const zorigin = `http://127.0.0.1:${zs.address().port}`;
    for (const [name, W, H] of [['zone-portrait', 375, 812], ['zone-landscape', 844, 340], ['zone-ipad', 1024, 768]]) {
      const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 900, hasTouch: W < 900 });
      await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
      const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
      await page.goto(`${zorigin}/preview/origins/?region=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 }); await page.waitForTimeout(3000);
      await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(1200);
      await page.locator('#journal .tab-career').click(); await page.waitForTimeout(800);
      await verify(page, name, W);
      await page.screenshot({ path: `${dir}/career-${name}.png` }); await context.close();
    }
    zs.close();
  }
  assert.deepEqual(receipt.errors, [], 'no page errors');
  receipt.passed = true; console.log('career-screen-check PASS', JSON.stringify(Object.fromEntries(Object.entries(receipt.views).map(([k, v]) => [k, v.tabs.length]))));
} catch (error) { console.error('career-screen-check FAIL', error.message); process.exitCode = 1; }
finally { await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2)); await browser.close(); await server.close(); }
