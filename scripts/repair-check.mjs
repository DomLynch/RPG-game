// The smith screen at a phone (Web, wear & repair part 2): the built origins page (?region=1&worldfight), the ☰ menu's Repair entry, the dialog. Stills: <OUT>/repair-*.png.
// Checks, signed in against a stand-in writer (gear_wear lists two worn pieces with a quote; gear_repair repairs one): a line per worn piece with the writer's durability and quote (no id, no computed cost), the Repair click sends
// ids only (character, op, instance), the receipt is shown and the list is read again (the repaired piece leaves it); an empty list says nothing is worn; a guest sees "Sign in to see your gear's wear." and no lines; nothing
// clips or scrolls sideways, controls are 44 px, Close closes it. Usage: node scripts/repair-check.mjs <built origins-preview dist> [--engine webkit]   (OUT=<dir> for the stills).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { chromium, webkit } from 'playwright';

const dist = process.argv[2] ?? 'artifacts/origins-preview', out = process.env.OUT || 'artifacts/repair', root = process.cwd();
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
    for (const signedIn of [true, false]) {
      const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })).newPage(); page.setDefaultTimeout(240000);
      const tag = `${name}${signedIn ? '' : '-guest'}`;
      page.on('pageerror', (e) => fails.push(`${tag}: ${String(e).slice(0, 160)}`));
      const reply = (result) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
      const pieces = [
        { instance: 'inst:body-1', slot: 'Body', worn: 30, max: 90, baseMax: 100, quote: { points: 30, bronze: 220, metal: { item: 'item:grave-iron', qty: 3 } } },
        { instance: 'inst:boots-1', slot: 'Boots', worn: 6, max: 60, baseMax: 60, quote: { points: 6, bronze: 40, metal: { item: 'item:grave-iron', qty: 1 } } }];
      const asked = [];
      if (signedIn) await page.addInitScript(() => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: 'check-token', expires_at: Math.floor(Date.now() / 1000) + 7200 })); });
      await page.route('**/origins/**', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();   // the page's own files live under /preview/origins/; only the writer's POST ops are answered here
        const op = new URL(route.request().url()).pathname.split('/').pop(), body = route.request().postDataJSON?.() ?? {};
        if (op === 'open') return route.fulfill(reply({ characters: [{ id: 'pc:check', name: 'Check' }], career: null, marks: 0 }));
        if (op === 'gear_wear') return route.fulfill(reply({ pieces }));
        if (op === 'gear_repair') { asked.push(body); const i = pieces.findIndex((p) => p.instance === body.instance); const [p] = pieces.splice(i, 1); return route.fulfill(reply({ instance: p.instance, points: p.worn, cost: { bronze: p.quote.bronze, metal: p.quote.metal }, piece: { worn: 0, max: p.max - 2, baseMax: p.baseMax }, replayed: false })); }
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('menu-repair'), null, { timeout: Number(process.env.WAIT_MS) || 240000 });
      await page.waitForTimeout(1500);
      await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
      await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
      await page.locator('#menu-repair').click({ force: true }); await page.waitForTimeout(signedIn ? 2500 : 1500);
      const read = () => page.evaluate(() => {
        const d = document.getElementById('repair-dialog'), vw = innerWidth, vh = innerHeight, r = d.getBoundingClientRect();
        const rows = [...d.querySelectorAll('.repair-row')].map((c) => ({ instance: c.dataset.instance, slot: c.querySelector('.repair-slot').textContent, dur: c.querySelector('.repair-durability').textContent, note: c.querySelector('.repair-note').textContent }));
        const small = [...d.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44); }).length;
        const clipped = [...d.querySelectorAll('b, span, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 24));
        return { open: d.open, status: d.querySelector('.repair-status').textContent, rows, small, clipped, inView: r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1, hscroll: d.scrollWidth > d.clientWidth + 1 };
      });
      const g = await read(); console.log(tag, JSON.stringify(g));
      check(g.open, `${tag}: the dialog opens from the ☰ entry`);
      if (signedIn) {
        check(g.rows.length === 2 && g.rows[0].slot === 'Body' && g.rows[0].dur === '60 of 90 left' && /Repair: 220 bronze and 3 /.test(g.rows[0].note) && /worn down from 100/.test(g.rows[0].note), `${tag}: a line per worn piece with the writer's durability and quote (${JSON.stringify(g.rows)})`);
        check(g.rows.every((x) => !/item:|inst:|\{/.test(x.slot + x.dur + x.note)), `${tag}: every line is words, no id or placeholder`);
        check(g.small === 0 && !g.clipped.length && g.inView && !g.hscroll, `${tag}: layout (small ${g.small}, clipped ${g.clipped}, inView ${g.inView}, hscroll ${g.hscroll})`);
        await page.screenshot({ path: `${out}/repair-${name}-open.png` });
        await page.locator('#repair-dialog .repair-go').first().click({ force: true }); await page.waitForFunction(() => /Repaired/.test(document.querySelector('#repair-dialog .repair-status').textContent), null, { timeout: 20000 });
        const after = await read();
        check(asked.length === 1 && JSON.stringify(Object.keys(asked[0]).sort()) === JSON.stringify(['character', 'instance', 'op']) && asked[0].instance === 'inst:body-1' && asked[0].character === 'pc:check' && /^[a-z0-9][a-z0-9:._-]{7,119}$/.test(asked[0].op), `${tag}: one gear_repair, ids only, a valid fresh op id (${JSON.stringify(asked)})`);
        check(/^Repaired your Body for 220 bronze and 3 /.test(after.status) && after.rows.length === 1 && after.rows[0].slot === 'Boots', `${tag}: the receipt is shown and the list is read again (${after.status}; ${after.rows.length} left)`);
        await page.screenshot({ path: `${out}/repair-${name}.png` });
        pieces.length = 0; await page.locator('#repair-dialog .repair-close').click({ force: true }); await page.locator('#journal-button').click({ force: true }); await page.locator('#journal .tab-settings').click({ force: true }); await page.locator('#menu-repair').click({ force: true }); await page.waitForTimeout(2000);
        const empty = await read(); check(empty.rows.length === 0 && /Nothing is worn/.test(empty.status), `${tag}: an empty list says nothing is worn (${empty.status})`);
      } else check(g.rows.length === 0 && g.status === "Sign in to see your gear's wear.", `${tag}: a guest sees the sign-in line and no lines (${g.status}; ${g.rows.length})`);
      await page.locator('#repair-dialog .repair-close').click({ force: true });
      check(!(await page.evaluate(() => document.getElementById('repair-dialog').open)), `${tag}: Close closes it`);
      await page.context().close();
    }
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); server.close(); }
console.log(fails.length ? `repair-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `repair-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
