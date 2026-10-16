// How many NEW render programs does a remote player wearing each source kit add after [zone ready]? (the dressRemote warm-up proof; renderInfo().programKeys, the method of origins-seamless-check.mjs)
// Usage (repo checkout, node_modules, built preview): node scripts/remote-programs-check.mjs <dist> <out dir>
// Receipt: programsAtReady, then per kit the programs it added (name#id -> cacheKey, owners), and the unique new program keys over all kits. Exit 0 and the numbers are the result; GATE=1 exits 1 when any kit adds a program (the warm-up's acceptance: 0 new).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const KITS = (process.env.KITS ?? 'none,goblin,shieldmaiden,pitborn,nightborn,dwarf,executioner,knight,veteran,witch,plaguedoctor,~kit').split(',');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  const atReady = await page.evaluate(() => window.__zoneReady);
  // The remote kits warm in idle time after [zone ready] (main.ts warmRemoteKitsInIdle). On a head without it the flag never comes: do not wait (the baseline run).
  const kitsWarm = await page.waitForFunction(() => window.__remoteKitsWarm, null, { timeout: 90000 }).then((h) => h.jsonValue(), () => null);
  await page.waitForTimeout(3000);
  const info = () => page.evaluate(() => window.originsPreview.renderInfo());
  const first = await info(), seen = new Set(first.programNames), receipt = { programsAtReady: first.programs, kits: {}, uniqueNew: {} };
  for (const kit of KITS) {
    const probe = await page.evaluate((k) => window.originsPreview.remoteProbe(k), kit);
    await page.waitForTimeout(4000);   // frames: the page draws the dressed remote and links what it needs
    const now = await info(), added = now.programNames.filter((n) => !seen.has(n));
    receipt.kits[kit] = { pieces: probe.worn.length, missing: probe.missing, added: added.map((n) => ({ program: n, key: now.programKeys[n], owners: now.programOwners?.[n] ?? null })) };
    for (const n of added) { seen.add(n); receipt.uniqueNew[n] = { key: now.programKeys[n], owners: now.programOwners?.[n] ?? null, firstKit: kit }; }
  }
  receipt.totalNew = Object.keys(receipt.uniqueNew).length; receipt.errors = errors.slice(0, 4);
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  console.log('receipt:', JSON.stringify({ atReady: receipt.programsAtReady, perKit: Object.fromEntries(Object.entries(receipt.kits).map(([k, v]) => [k, v.added.length])), totalNew: receipt.totalNew, errors: errors.length }));
  console.log('uniqueNew:', JSON.stringify(receipt.uniqueNew).slice(0, 4000));
  console.log('zoneReady:', JSON.stringify(atReady), 'remoteKitsWarm:', JSON.stringify(kitsWarm));
  if (process.env.GATE && (!kitsWarm || kitsWarm.failed)) { console.log(`GATE FAIL: the remote kits never finished warming (${JSON.stringify(kitsWarm)})`); process.exitCode = 1; }
  if (process.env.GATE && receipt.totalNew > 0) { console.log(`GATE FAIL: ${receipt.totalNew} programs link at a remote's first sight`); process.exitCode = 1; }
} finally { await browser.close(); server.close(); }
