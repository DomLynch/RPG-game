// The stats screen at a phone (Web, critical four item 3): the built origins page (?region=1&worldfight), the ☰ menu's Stats entry, the dialog. Stills: <OUT>/stats-*.png.
// Checks, signed in against a stand-in writer: the level and the points placed against the budget, one named line per dial and skill (no id), the placed points from the stored build, NO effective number (the writer's sheet is not supplied yet);
// a guest sees "Sign in to see your stats." and no rows; nothing clips or scrolls sideways, controls are 44 px, Close closes it. Usage: node scripts/stats-check.mjs <built origins-preview dist> [--engine webkit]   (OUT=<dir> for the stills).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { chromium, webkit } from 'playwright';

const dist = process.argv[2] ?? 'artifacts/origins-preview', out = process.env.OUT || 'artifacts/stats', root = process.cwd();
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
      if (signedIn) await page.addInitScript(() => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: 'check-token', expires_at: Math.floor(Date.now() / 1000) + 7200 })); });
      await page.route('**/origins/**', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();   // the page's own files live under /preview/origins/; only the writer's POST ops are answered here
        const op = new URL(route.request().url()).pathname.split('/').pop();
        if (op === 'open') return route.fulfill(reply({ characters: [{ id: 'pc:check', name: 'Check' }], career: null, marks: 0 }));
        if (op === 'build_get') return route.fulfill(reply({ level: 4, placed: { attack: 3, armour: 1 }, version: 2, respreadRank: 0 }));
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('menu-stats'), null, { timeout: Number(process.env.WAIT_MS) || 240000 });
      await page.waitForTimeout(1500);
      await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
      await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
      await page.locator('#menu-stats').click({ force: true }); await page.waitForTimeout(signedIn ? 2500 : 1500);
      const g = await page.evaluate(() => {
        const d = document.getElementById('stats-dialog'), vw = innerWidth, vh = innerHeight, r = d.getBoundingClientRect();
        const rows = [...d.querySelectorAll('.stats-row')].map((c) => ({ id: c.dataset.stat, name: c.querySelector('.stats-name').textContent, value: c.querySelector('.stats-value').textContent, note: c.querySelector('.stats-note').textContent, bar: !!c.querySelector('.stats-bar') }));
        const small = [...d.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44); }).length;
        const clipped = [...d.querySelectorAll('b, span, p, h3, h4')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 24));
        return { open: d.open, level: d.querySelector('.stats-level').textContent, points: d.querySelector('.stats-points').textContent, status: d.querySelector('.stats-status').textContent, rows, small, clipped, inView: r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1 };
      });
      console.log(tag, JSON.stringify({ ...g, rows: g.rows.length, sample: g.rows.slice(0, 2) }));
      check(g.open, `${tag}: the dialog opens from the ☰ entry`);
      if (signedIn) {
        check(g.level === 'Level 4' && g.points === '4 of 4 points placed', `${tag}: level and points against the budget (${g.level}; ${g.points})`);
        check(g.rows.length >= 10 && g.rows.every((x) => x.name.length > 1 && x.name !== x.id && !/[a-z][A-Z]|:/.test(x.name)), `${tag}: a named line per dial and skill, no id (${g.rows.length} rows)`);
        check(g.rows.find((x) => x.id === 'attack')?.note === '+3 placed' && g.rows.find((x) => x.id === 'health')?.note === 'no points placed', `${tag}: the placed points come from the stored build`);
        check(g.rows.every((x) => x.value === '' && !x.bar) && /full sheet/i.test(g.status), `${tag}: no effective number without the writer's sheet, and the dialog says so (${g.status})`);
        check(g.small === 0 && !g.clipped.length && g.inView, `${tag}: layout (small ${g.small}, clipped ${g.clipped}, inView ${g.inView})`);
        await page.screenshot({ path: `${out}/stats-${name}.png` });
      } else check(g.rows.length === 0 && g.status === 'Sign in to see your stats.', `${tag}: a guest sees the sign-in line and no rows (${g.status}; ${g.rows.length} rows)`);
      await page.locator('#stats-dialog .stats-close').click({ force: true });
      check(!(await page.evaluate(() => document.getElementById('stats-dialog').open)), `${tag}: Close closes it`);
      await page.context().close();
    }
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); server.close(); }
console.log(fails.length ? `stats-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `stats-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
