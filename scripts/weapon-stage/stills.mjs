// Stills of the sandbox ranged weapons: for each id, the hero holding it at the fight camera (375 wide) and a side and front view. Software GL (VPS `capture`).
//   STAGE=artifacts/weapon-stage OUT=<dir> node scripts/weapon-stage/stills.mjs [id ...]      (default: staff-v1 bow-v1 crossbow-v1; parts from src/assets/source/ranged-weapons/<id>.glb)
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), STAGE = path.resolve(process.env.STAGE || 'artifacts/weapon-stage'), OUT = process.env.OUT || 'artifacts/ranged-stills', ids = process.argv.slice(2).length ? process.argv.slice(2) : ['staff-v1', 'bow-v1', 'crossbow-v1'];
fs.mkdirSync(OUT, { recursive: true });
let current = ids[0];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = u === '/warrior.glb' ? `${root}/src/assets/warrior.glb` : u === '/weapon.glb' ? `${root}/src/assets/source/ranged-weapons/${current}.glb` : path.join(STAGE, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const id of ids) {
    current = id; const hand = id.startsWith('bow') ? 'l' : 'r';
    for (const [name, cam, hold, size] of [['wide', 'wide', 'carry', [375, 812]], ['upright', 'wide', 'upright', [375, 812]], ['side', 'side', 'upright', [375, 600]]]) {
      const page = await (await browser.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
      page.on('pageerror', (e) => console.log('pageerror', id, String(e).slice(0, 200)));
      await page.goto(`${origin}/?cam=${cam}&hand=${hand}&hold=${hold}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.stageReady === true, null, { timeout: 120000 });
      await page.screenshot({ path: path.join(OUT, `${id}-${name}.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
      await page.context().close();
    }
    console.log('stills', id);
  }
} finally { await browser.close(); server.close(); }
