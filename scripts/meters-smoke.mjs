// The 2-zone smoke for the shared meters (src/fight/hud.ts createMeters): boots Zone 1's page and the Pit's page at 375x812, reports uncaught page errors, checks the meters mounted
// (and the old zone bars are gone, the Pit's bars hidden on the zone page), reads the Pit's bars, and saves stills. A diagnostic, not a release row. The zone still paints the bars the way
// createMeters would (driving a real fight needs a creature in reach). Needs the built pages: `vite build --config origins/preview/vite.config.mjs` and `vite build --outDir artifacts/pit-build`.
//   node scripts/meters-smoke.mjs [--build] [zone dist=artifacts/origins-preview] [pit dist=artifacts/pit-build] [out=artifacts/meters-smoke]
// --build makes both pages first (what a gpu-run job needs: its build step is the Pit's, not the zone's).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const argv = process.argv.slice(2), build = argv.includes('--build'), [zoneDist = 'artifacts/origins-preview', pitDist = 'artifacts/pit-build', out = 'artifacts/meters-smoke'] = argv.filter((a) => a !== '--build'), root = process.cwd();
if (build) for (const args of [['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], ['vite', 'build', '--outDir', 'artifacts/pit-build']]) { const r = spawnSync('npx', args, { stdio: 'ignore', timeout: 900_000 }); if (r.status !== 0) { console.error(`meters-smoke: ${args.join(' ')} failed (${r.status})`); process.exit(2); } }
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const serve = (roots, fallback) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
    for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
    if (!hit && fallback) hit = path.join(fallback, u);
    if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
    if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => resolve(s));
});
const zoneRoots = { '/preview/origins/': `${path.resolve(zoneDist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts', 'versus']) zoneRoots[`/${d}/`] = `${root}/public/${d}/`;
const zoneServer = await serve(zoneRoots), pitServer = await serve({}, path.resolve(pitDist));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const result = { zone: {}, pit: {} };
try {
  // ZONE 1
  {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    const errors = [], warnings = []; page.setDefaultTimeout(240000); page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${zoneServer.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) warnings.push(m.type() + ': ' + m.text().slice(0, 160)); });
    try { await page.waitForSelector('.fm-meters', { state: 'attached', timeout: 150000 }); } catch (e) { console.log('zone timeout; errors so far:', JSON.stringify(errors.slice(0, 8)), 'ids:', await page.evaluate(() => [...document.querySelectorAll('[id]')].map((n) => n.id).slice(0, 40).join(',')), 'url', page.url()); throw e; }
    await page.waitForTimeout(3000);
    result.zone = await page.evaluate(() => {
      const root = document.querySelector('.fm-meters');
      return { metersMounted: !!root, hiddenWhileWhole: root.hidden, bars: [...root.querySelectorAll('meter')].map((m) => m.className), flashMounted: !!document.querySelector('.fm-flash'), oldBarsGone: !document.getElementById('wc-bars') && !document.getElementById('wc-hp'), pitBarsHiddenInZone: getComputedStyle(document.querySelector('.combat-hud')).display === 'none', cssLoaded: getComputedStyle(root).position === 'fixed' };
    });
    // The look with numbers painted the way createMeters paints them (driving a real fight needs a creature in reach; this is the stylesheet's drawing of the three bars and the flash).
    await page.evaluate(() => {
      const root = document.querySelector('.fm-meters'); const keep = document.createElement('style'); keep.textContent = '.fm-meters[hidden] { display: block !important; }'; document.head.append(keep); root.hidden = false;   // the page re-hides the meters every frame while the hero is whole; this keeps the painted look on screen
      root.querySelector('.fm-name').textContent = 'Goblin';
      for (const [cls, pct] of [['.fm-foe', 40], ['.fm-hp', 62], ['.fm-st', 80]]) root.querySelector(cls).style.setProperty('--fill', `${pct}%`);
    });
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'zone1-meters.png') });
    await page.evaluate(() => { document.querySelector('.fm-flash').dataset.on = 'true'; });
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'zone1-meters-flash.png') });
    result.zone.errors = errors; result.zone.consoleWarnings = warnings.slice(0, 8);
  }
  // THE PIT
  {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    const errors = []; page.setDefaultTimeout(240000); page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${pitServer.address().port}/?opponent=goblin&debug=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 240000 });
    await page.waitForTimeout(1500);
    result.pit = await page.evaluate(() => Object.fromEntries(['player-health', 'target-health', 'stamina'].map((id) => { const m = document.getElementById(id); return [id, { value: m.value, max: m.max, fill: m.style.getPropertyValue('--fill') }]; })));
    await page.screenshot({ path: path.join(out, 'pit-ready.png') });
    result.pit.errors = errors;
  }
} finally { await browser.close(); zoneServer.close(); pitServer.close(); }
console.log(JSON.stringify(result, null, 1));
const bad = result.zone.errors?.length || result.pit.errors?.length || !result.zone.metersMounted || !result.zone.oldBarsGone || !result.zone.cssLoaded || !result.zone.pitBarsHiddenInZone;
console.log(bad ? 'meters-smoke FAIL' : 'meters-smoke PASS');
process.exit(bad ? 1 : 0);
