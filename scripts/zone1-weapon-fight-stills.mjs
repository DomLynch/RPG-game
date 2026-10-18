// 375-wide stills of Zone 1 (?region=1&worldfight): the hero MID-EXCHANGE against a creature, once per weapon (default knife and longsword), the same scripted frame (his cut in its windup/active), with a 2x crop of the hero so the
// blade length reads. Prints the weapon the rig holds and the sim swings. Usage: WEAPONS=knife,longsword node scripts/zone1-weapon-fight-stills.mjs <built origins-preview dist> <out dir>
// (GPU: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/weapon-fight-still.sh)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd(), weapons = (process.env.WEAPONS || 'knife,longsword').split(',');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
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
  for (const weapon of weapons) {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 240000 });
    await page.evaluate((w) => window.originsPreview.forceWeapon(w), weapon);
    await page.waitForFunction((w) => window.originsPreview.rigWeapon() === w, weapon, { timeout: 120000 }).catch(() => console.log(weapon, 'rig weapon never became', weapon));
    await page.waitForTimeout(6000);
    const target = await page.evaluate(() => { const all = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return all.find((m) => /goblin/.test(m.id)) ?? all.sort((a, b) => (a.id < b.id ? -1 : 1))[0]; });
    console.log(weapon, 'target:', target.id);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.2, 0), [target.x, target.z]);
    await page.waitForTimeout(15000);
    let shot = false;
    for (let i = 0; i < 80 && !shot; i++) {
      await page.evaluate(() => window.originsPreview.press('light'));
      for (let j = 0; j < 6 && !shot; j++) {
        await page.waitForTimeout(120);
        const hero = await page.evaluate(() => window.originsPreview.combat().hero);
        if (hero.phase === 'active' && (await page.evaluate(() => document.body.classList.contains('infight')))) {
          await page.screenshot({ path: path.join(out, `${weapon}-exchange.png`), timeout: 240000 });
          await page.screenshot({ path: path.join(out, `${weapon}-exchange-crop.png`), clip: { x: 40, y: 360, width: 295, height: 340 }, timeout: 240000 });
          shot = true;
        }
      }
    }
    console.log(weapon, 'exchange shot:', shot, '| rig weapon:', await page.evaluate(() => window.originsPreview.rigWeapon()), 'sim weapon:', await page.evaluate(() => window.originsPreview.combat().trace.weapon), '| errors:', errors.length);
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
