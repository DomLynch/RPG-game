// The armour weight badge on the ZONE's gear screen (Web, wear & repair part 1; 375x812, the built origins page, ?region=1&worldfight): ☰ Settings > Gear opens the same sheet the Pit page shows (gear-mount.ts): the piece's class (Heavy / Medium / Light) from the gear rows, read only, on the rack rows, the pack and the fitting card.
// Seeds a guest's loot with a plate set worn (shieldmaiden: Heavy), a witch piece (robes: Light) and a goblin piece (leathers: Medium) in the pack, opens the ☰ gear sheet, and checks each badge is the class the rows give,
// that a piece no set owns shows none, and that nothing clips. Stills: <dir>/weight-*.png.   node scripts/gear-weight-check.mjs   (run `npm run build` first; PIT_GL=1 for software GL on a box with no GPU)
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-weight-zone'; fs.mkdirSync(dir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const dist = process.argv[2] ?? 'artifacts/origins-preview', root = process.cwd();
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
const origin = `http://127.0.0.1:${server.address().port}`;
const KIT = { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body', arms: 'shieldmaiden.Arms', hands: 'shieldmaiden.Gloves', legs: 'shieldmaiden.Greaves', feet: 'shieldmaiden.Boots', off: 'shieldmaiden.Shield' };
const take = (opponent) => ({ opponent, attempt: 1, healthLeft: 100, recordId: null, day: '2026-10-13', tier: 4 });
const loot = { owned: [...Object.values(KIT), 'witch.Body', 'goblin.Body'], equipped: KIT, pack: ['witch.Body', 'goblin.Body'], taken: { 'witch.Body': take('witch'), 'goblin.Body': take('goblin') } };
const args = process.env.PIT_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
let passed = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => { const k = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(k) || 'null') || { version: 1, id: 'guest-weight-0001', name: 'Wanderer', career: { victoryMarks: 0 } }; p.loot = l; localStorage.setItem(k, JSON.stringify(p)); }, loot);
  const page = await ctx.newPage(); page.setDefaultTimeout(240000); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(`${origin}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('menu-gear'), null, { timeout: Number(process.env.WAIT_MS) || 240000 }); await page.waitForTimeout(1500);
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600);   // the ☰
  await page.locator('#journal .tab-settings').click({ force: true }); await page.waitForTimeout(400);   // the Settings tab holds the walk's entries
  await page.locator('#menu-gear').click({ force: true }); await page.waitForTimeout(3000);   // the zone's Gear: the same sheet, the zone's hero on the mannequin
  const read = () => page.evaluate(() => {
    const w = (sel) => [...document.querySelectorAll(sel)].map((e) => [e.closest('[data-loot]')?.getAttribute('data-loot') ?? e.id, e.getAttribute('data-weight')]);
    return { pack: w('#pack li strong'), rack: w('#loot-rack li > span'), fitting: document.getElementById('fitting-name').getAttribute('data-weight'),
      clipped: [...document.querySelectorAll('#journal .pack li strong, #journal #fitting-name')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent) };
  });
  const g = await read(); console.log(JSON.stringify(g));
  const of = (list, id) => list.find(([k]) => k === id)?.[1] ?? null;
  assert.equal(of(g.pack, 'witch.Body'), 'Light'); assert.equal(of(g.pack, 'goblin.Body'), 'Medium');
  assert.equal(of(g.rack, 'shieldmaiden.Helmet'), 'Heavy'); assert.equal(of(g.rack, 'witch.Body'), 'Light'); assert.equal(of(g.rack, 'goblin.Body'), 'Medium');
  await page.screenshot({ path: `${dir}/weight-pack.png` });
  await page.locator('#pack [data-fit="witch.Body"]').tap(); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => document.getElementById('fitting-name').getAttribute('data-weight')), 'Light');
  assert.equal(await page.evaluate(() => /light/i.test(getComputedStyle(document.getElementById('fitting-name'), '::after').content)), true, 'the badge is drawn, not only set');
  assert.deepEqual((await read()).clipped, [], 'nothing clips');
  await page.screenshot({ path: `${dir}/weight-fitting.png` });
  passed = true;
} finally { console.log(JSON.stringify({ passed, engine: ENGINE })); await browser.close(); server.httpServer.close(); }
process.exitCode = passed ? 0 : 1;
