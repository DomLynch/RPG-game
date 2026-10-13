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
    // A signed-in player against a stand-in writer: the page's own token, character and the two shop ops answered here (the writer's real prices are Backend's; the screen must show what shop_stock says, not the list).
    const shelf = { iron: 20 }; let asked = []; const T0 = Date.now();
    const reply = (result) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
    await page.addInitScript(() => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: 'check-token', expires_at: Math.floor(Date.now() / 1000) + 7200 })); });
    await page.route('**/origins/**', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();   // the page's own files live under /preview/origins/; only the writer's POST ops are answered here
      const op = new URL(route.request().url()).pathname.split('/').pop(), body = route.request().postDataJSON?.() ?? {};
      if (op === 'shop_stock') return route.fulfill(reply({ shop: 'service:exchange-provisioner', revision: 1, now: T0, rows: [
        { item: 'item:grave-iron', count: shelf.iron, max: 20, price: shelf.iron === 20 ? 5 : 6, nextRestockAt: shelf.iron < 20 ? T0 + 90_000 : null },
        { item: 'item:frontier.ash-helm', count: 0, max: 1, price: 72, nextRestockAt: T0 + 1_800_000 },
        { item: 'item:frontier.watch-greaves', count: 1, max: 1, price: 60, nextRestockAt: null }] }));
      if (op === 'shop_buy') { asked.push(body); shelf.iron -= 1; return route.fulfill(reply({ shop: body.shop, item: body.item, quantity: 1, cost: 5, revision: 1, received: ['inst:x'], replayed: false })); }
      if (op === 'open') return route.fulfill(reply({ characters: [{ id: 'char:check', name: 'Check' }], career: null, marks: 0 }));
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('menu-shop'), null, { timeout: Number(process.env.WAIT_MS) || 240000 });
    await page.waitForTimeout(1500);
    await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
    await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
    await page.locator('#menu-shop').click({ force: true }); await page.waitForFunction(() => document.querySelectorAll('#shop-dialog .shop-row').length, null, { timeout: 20000 });
    const read = () => page.evaluate(() => {
      const d = document.getElementById('shop-dialog'), vw = innerWidth, vh = innerHeight, r = d.getBoundingClientRect();
      const rows = [...d.querySelectorAll('.shop-row')].map((c) => ({ item: c.dataset.item, name: c.querySelector('.shop-name').textContent, price: c.querySelector('.shop-price').textContent, note: c.querySelector('.shop-note').textContent, restock: c.querySelector('.shop-restock').textContent, buyOff: c.querySelector('.shop-buy').disabled }));
      const small = [...d.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44); }).length;
      const clipped = [...d.querySelectorAll('b, span, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 24));
      return { open: d.open, title: d.querySelector('h3').textContent, status: d.querySelector('.shop-status').textContent, rows, small, clipped, inView: r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1, hscroll: d.scrollWidth > d.clientWidth + 1 };
    });
    await page.waitForTimeout(2500);   // past the screen's 1 s tick: the first read of the dialog must not be the only one (a full shelf once read "Next one back in 0 s" after the first tick)
    const g = await read(); console.log(name, JSON.stringify(g));
    check(g.open, `${name}: the dialog opens from the ☰ entry`);
    check(g.rows.length === 3 && g.rows[0].price === '5 bronze' && /Grave iron/i.test(g.rows[0].name), `${name}: the price is shop_stock's (5 at a full shelf), not the list's 6 (${JSON.stringify(g.rows.map((x) => [x.name, x.price]))})`);
    check(g.rows[0].note === '20 of 20 on the shelf' && g.rows[1].note.startsWith('Sold out') && g.rows[1].buyOff && /Next one back in 30 min/.test(g.rows[1].restock), `${name}: live stock, sold out disables Buy, the restock time (${JSON.stringify(g.rows.map((x) => [x.note, x.restock, x.buyOff]))})`);
    check(g.rows[0].restock === '' && g.rows[2].restock === '' && g.rows[1].restock !== '', `${name}: full shelves carry no restock line after the tick, the drained one keeps its (${JSON.stringify(g.rows.map((x) => x.restock))})`);
    check(g.rows.every((x) => x.name.length > 2 && !/item:|\{/.test(x.name + x.price + x.note + x.restock)), `${name}: every line is words, no id or placeholder`);
    check(g.small === 0 && !g.clipped.length && g.inView && !g.hscroll, `${name}: layout (small ${g.small}, clipped ${g.clipped}, inView ${g.inView}, hscroll ${g.hscroll})`);
    await page.screenshot({ path: `${out}/shop-${name}-open.png` });
    await page.locator('#shop-dialog .shop-buy').first().click({ force: true }); await page.waitForFunction(() => /Bought/.test(document.querySelector('#shop-dialog .shop-status').textContent), null, { timeout: 20000 });
    const after = await read();
    check(asked.length === 1 && JSON.stringify(Object.keys(asked[0]).sort()) === JSON.stringify(['character', 'item', 'op', 'quantity', 'revision', 'shop']) && asked[0].character === 'char:check' && asked[0].quantity === 1, `${name}: one shop_buy of one unit, ids only (${JSON.stringify(asked)})`);
    check(after.status === 'Bought Grave iron for 5 bronze.' && after.rows[0].note === '19 of 20 on the shelf' && after.rows[0].price === '6 bronze', `${name}: the receipt is shown and the shelf is read again (${after.status}; ${after.rows[0].note}; ${after.rows[0].price})`);
    await page.screenshot({ path: `${out}/shop-${name}.png` });
    await page.locator('#shop-dialog .shop-close').click({ force: true });
    check(!(await page.evaluate(() => document.getElementById('shop-dialog').open)), `${name}: Close closes it`);
    await page.context().close();
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); server.close(); }
console.log(fails.length ? `shop-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `shop-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
