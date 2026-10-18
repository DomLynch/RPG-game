// Before/after stills of one beast at 375 wide, ready idle and mid-fight, in the Pit and in Zone 1 (visual-pr-stills; Lead 2026-10-18 for the troll 1.52 and the goblin 1.25). Run it on a build, then on trunk's build, and compare.
// The pixels are Mac-GPU work (SWIFTSHADER=1 draws them slowly on the VPS). The harness clock steps a fixed 16 ms, so both builds shoot the same sim frames.
//   node scripts/beast-stills-375.mjs --view pit|field --body cave-troll --dist <dist> --out <dir> [--place 0,-5]
// pit: ?opponent=<body>&spar=1 at a level-5 look; idle at the first ready frame, mid-fight 70 steps after the hero's attack tap. field: the origins-preview build, Zone 1 (?region=1), the nearest drawn <body> mob;
// the hero is placed --place metres from it, idle after the settle, mid-fight 70 steps after tapping it (the real tap path). Writes <out>/idle.jpg, <out>/mid.jpg, <out>/receipt.json (the body, its drawn height read off the page).
/* global process, console, window, document, globalThis */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const VIEW = opt('view', 'pit'), BODY = opt('body', 'cave-troll'), DIST = opt('dist'), OUT = opt('out');
if (!DIST || !OUT || !['pit', 'field'].includes(VIEW)) { console.error('usage: node scripts/beast-stills-375.mjs --view pit|field --body <id> --dist <dist> --out <dir> [--place 0,-5]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const root = process.cwd(), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const roots = VIEW === 'pit' ? { '/': `${path.resolve(DIST)}/` } : { '/preview/origins/': `${path.resolve(DIST)}/` };
if (VIEW === 'field') for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null, best = -1;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p) && p.length > best) { hit = path.join(r, u.slice(p.length) || 'index.html'); best = p.length; }
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const glArgs = process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--ignore-gpu-blocklist', '--use-angle=metal'];
const browser = await chromium.launch({ headless: true, args: glArgs });
const receipt = { view: VIEW, body: BODY, dist: DIST, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  let engage;
  if (VIEW === 'pit') {
    await page.goto(`${origin}/?opponent=${BODY}&spar=1&weapon=longsword&difficulty=5&skill=none&yourSpecial=none&special=none&debug`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    engage = () => page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});
  } else {
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction((b) => window.originsPreview?.mobs()?.mobs?.some((m) => m.body === b), BODY, { timeout: 180000 });
    const den = await page.evaluate((b) => { const m = window.originsPreview.mobs().mobs.find((q) => q.body === b); return { x: m.x, z: m.z }; }, BODY);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 14, 0), [den.x, den.z]);
    await page.waitForFunction((b) => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model && m.body === b), BODY, { timeout: 300000 });
    await page.waitForTimeout(3000);
    const target = await page.evaluate((b) => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model && q.body === b); return { id: m.id, x: m.x, z: m.z }; }, BODY);
    receipt.target = target;
    const [dx, dz] = opt('place', '0,-5').split(',').map(Number);   // the hero's start, relative to the beast (Zone 1's props can block a sight line: try another --place)
    await page.evaluate(([x, z, ox, oz]) => window.originsPreview.place(x + ox, z + oz, Math.atan2(-ox, -oz)), [target.x, target.z, dx, dz]);
    engage = () => page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  }
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page);
  await clock.run(16 * 45);   // settle: the beast stands and idles
  await page.screenshot({ path: path.join(OUT, 'idle.jpg'), type: 'jpeg', quality: 92 });
  await engage();
  if (VIEW === 'pit') await skipDraws(page, true);
  await clock.run(16 * 70);
  if (VIEW === 'pit') await skipDraws(page, false);
  await page.screenshot({ path: path.join(OUT, 'mid.jpg'), type: 'jpeg', quality: 92 });
  fs.writeFileSync(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 1));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); server.close(); }
