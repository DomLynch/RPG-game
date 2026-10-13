// The shop screen at a phone (Web, top-30 item 4): the built origins page (?region=1&worldfight), the ☰ menu's Shop entry, the dialog. Stills: <OUT>/shop-*.png.
// Checks: the entry exists in the ☰, the dialog opens with one row per list row (name, list price, shelf line), every line is words (no id), a guest's Buy answers "Sign in to buy.", nothing clips or scrolls sideways,
// controls are 44 px, and Close closes it. Usage: node scripts/shop-check.mjs <built origins-preview dist> [--engine webkit]   (OUT=<dir> for the stills; software GL is fine: it is a layout check).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { chromium, webkit } from 'playwright';

const dist = process.argv[2] ?? 'artifacts/origins-preview', out = process.env.OUT || 'artifacts/shop', root = process.cwd();
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
try {
  for (const [name, w, h] of [['phone', 375, 812], ['small', 320, 568]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })).newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', (e) => fails.push(`${name}: ${String(e).slice(0, 160)}`));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('menu-shop'), null, { timeout: Number(process.env.WAIT_MS) || 240000 });
    await page.waitForTimeout(1500);
    await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
    await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
    await page.locator('#menu-shop').click({ force: true }); await page.waitForTimeout(600);
    const read = () => page.evaluate(() => {
      const d = document.getElementById('shop-dialog'), vw = innerWidth, vh = innerHeight, r = d.getBoundingClientRect();
      const rows = [...d.querySelectorAll('.shop-row')].map((c) => ({ item: c.dataset.item, name: c.querySelector('.shop-name').textContent, price: c.querySelector('.shop-price').textContent, note: c.querySelector('.shop-note').textContent }));
      const small = [...d.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44); }).length;
      const clipped = [...d.querySelectorAll('b, span, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 24));
      return { open: d.open, title: d.querySelector('h3').textContent, status: d.querySelector('.shop-status').textContent, rows, small, clipped, inView: r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1, hscroll: d.scrollWidth > d.clientWidth + 1 };
    });
    const g = await read(); console.log(name, JSON.stringify(g));
    check(g.open, `${name}: the dialog opens from the ☰ entry`);
    check(g.rows.length === 3 && g.rows[0].price === '6 bronze' && /Grave iron/i.test(g.rows[0].name), `${name}: one row per list row at the list price (${JSON.stringify(g.rows.map((x) => [x.name, x.price]))})`);
    check(g.rows.every((x) => x.name.length > 2 && !/item:|\{/.test(x.name + x.price + x.note)), `${name}: every line is words, no id or placeholder`);
    check(g.small === 0 && !g.clipped.length && g.inView && !g.hscroll, `${name}: layout (small ${g.small}, clipped ${g.clipped}, inView ${g.inView}, hscroll ${g.hscroll})`);
    await page.locator('#shop-dialog .shop-buy').first().click({ force: true }); await page.waitForTimeout(500);
    const after = await read(); check(after.status === 'Sign in to buy.', `${name}: a guest's Buy answers "Sign in to buy." (${after.status})`);
    await page.screenshot({ path: `${out}/shop-${name}.png` });
    await page.locator('#shop-dialog .shop-close').click({ force: true });
    check(!(await page.evaluate(() => document.getElementById('shop-dialog').open)), `${name}: Close closes it`);
    await page.context().close();
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); server.close(); }
console.log(fails.length ? `shop-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `shop-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
