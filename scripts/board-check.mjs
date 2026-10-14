// The daily board screen at a phone (Web, top-30 #20): the built origins page (?region=1&worldfight), the ☰ menu's Board entry, the dialog. Stills: <OUT>/board-*.png.
// Checks: the entry exists in the ☰, the dialog opens with the rule's slots as task cards, every line is words (no id), the reset line is there, nothing clips, scrolls sideways or sits under the screen edge, controls are 44 px,
// and Close closes it. Usage: node scripts/board-check.mjs <built origins-preview dist> [--engine webkit]   (OUT=<dir> for the stills; software GL is fine: it is a layout check).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { chromium, webkit } from 'playwright';

const dist = process.argv[2] ?? 'artifacts/origins-preview', out = process.env.OUT || 'artifacts/board', root = process.cwd();
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
    const logs = []; page.on('response', (r) => { if (r.status() >= 400) logs.push(`${r.status()} ${r.url().slice(-90)}`); }); page.on('requestfailed', (r) => logs.push(`failed ${r.url().slice(-90)}`));
     page.on('console', (m) => { if (/error|warn/.test(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
    // WAIT_MS shortens the wait while diagnosing; on a timeout say how far the page got (the kit state is what adds the entry).
    await page.waitForFunction(() => document.getElementById('menu-board'), null, { timeout: Number(process.env.WAIT_MS) || 240000 }).catch(async (e) => {
      const state = await page.evaluate(() => ({ kit: document.body.classList.contains('kit'), journalEntry: !!document.getElementById('menu-journal'), chips: !!document.getElementById('mobile-sound'), menu: !!document.getElementById('journal') })).catch(() => null);
      throw new Error(`${name}: no #menu-board; state ${JSON.stringify(state)}; console ${JSON.stringify(logs.slice(0, 14))}; ${String(e.message).slice(0, 80)}`);
    });
    await page.waitForTimeout(1500);
    await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
    await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
    await page.locator('#menu-board').click({ force: true }); await page.waitForTimeout(600);
    const g = await page.evaluate(() => {
      const d = document.getElementById('board-dialog'), vw = innerWidth, vh = innerHeight, r = d.getBoundingClientRect();
      const cards = [...d.querySelectorAll('.board-task')].map((c) => ({ text: c.querySelector('.board-task-text').textContent, reward: c.querySelector('.board-task-reward').textContent }));
      const small = [...d.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44); }).length;
      const clipped = [...d.querySelectorAll('b, span, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 24));
      const ink = getComputedStyle(d.querySelector('.board-close')).color.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0);
      return { ink, open: d.open, title: d.querySelector('h3').textContent, status: d.querySelector('.board-status').textContent, reset: d.querySelector('.board-reset').textContent, cards, small, clipped, inView: r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1, hscroll: document.documentElement.scrollWidth > vw + 1 || d.scrollWidth > d.clientWidth + 1 };
    });
    console.log(name, JSON.stringify(g));
    check(g.ink > 450, `${name}: the Close mark is readable (ink sum ${g.ink})`);
    check(g.open, `${name}: the dialog opens from the ☰ entry`);
    check(g.cards.length === 3 && /3/.test(g.status), `${name}: three task cards for the rule's three slots (${g.cards.length}, "${g.status}")`);
    check(g.cards.every((c) => c.text.length > 5 && !/(character|item|family):|landmark_|zone\d|\{/.test(c.text + c.reward)), `${name}: every line is words, no id or placeholder (${JSON.stringify(g.cards)})`);
    check(/Resets in .*UTC/.test(g.reset), `${name}: the reset line (${g.reset})`);
    check(g.small === 0 && !g.clipped.length && g.inView && !g.hscroll, `${name}: layout (small ${g.small}, clipped ${g.clipped}, inView ${g.inView}, hscroll ${g.hscroll})`);
    await page.screenshot({ path: `${out}/board-${name}.png` });
    await page.locator('#board-dialog .board-close').click({ force: true });
    check(!(await page.evaluate(() => document.getElementById('board-dialog').open)), `${name}: Close closes it`);
    await page.context().close();
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); server.close(); }
console.log(fails.length ? `board-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `board-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
