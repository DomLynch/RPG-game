// Zone look stills (zone sandbox, look-test route): the built origins page at 375 x 812 (812 x 375 for a name ending -land) for each shot `name=query` given as arguments, two stills per shot: `<name>-camp.png`
// (the hero a few metres off the zone's camp, idle, looking at it; the spawn view when the page has no camp) and `<name>-fight.png` (the nearest creature engaged, mid-fight; skipped
// when the zone has no creatures). Server and page setup are the zone smoke's (scripts/origins-zone1-smoke.mjs). Writes artifacts/zone-stills/ and a receipt.json beside them.
// Usage (draws, so on the T4: node scripts/gpu-run.mjs <sha> -- node scripts/zone-look-stills.mjs off=?region=1 dusk='?region=1&look=goblin&goblin=dusk' test='?zone=99&region=1')
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), out = path.join(root, 'artifacts/zone-stills');
const LIVE = process.env.STILLS_URL;   // STILLS_URL=https://frankendom.com/preview/zone-look/ : take the pictures from a published preview (no local build, no local server)
if (!LIVE && !fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PROXY = process.env.STILLS_PROXY;   // a checkout without public/ (the VPS sparse clone): files missing here are fetched from this site (e.g. https://frankendom.com) and piped back
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if ((!hit || !fs.existsSync(hit)) && PROXY && hit && !u.startsWith('/preview/origins/')) { try { const up = await fetch(PROXY + u); if (up.ok) { res.writeHead(200, { 'content-type': up.headers.get('content-type') ?? 'application/octet-stream' }); return res.end(Buffer.from(await up.arrayBuffer())); } } catch { /* falls through to the 404 */ } }
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch(process.env.STILLS_SOFTWARE ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});   // STILLS_SOFTWARE=1: no GPU (the VPS)
const shots = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }), receipts = [];
try {
  for (const [name, query] of shots) {
    const r = { name, query, errors: [], stills: [] }; receipts.push(r);
    const land = name.endsWith('-land'), page = await (await browser.newContext({ viewport: land ? { width: 812, height: 375 } : { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE_UA })).newPage();   // an iPhone browser identity, a 375 x 812 viewport at 2x with touch: Dom's phone check. A name ending -land: the phone turned (landscape backdrop rows)
    page.on('pageerror', (e) => r.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    if (process.env.STILLS_PROBE) { r.console = []; r.assets = []; page.on('console', (m) => { if (m.type() !== 'log') r.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); }); page.on('response', (q) => { if (/\/zones\//.test(q.url())) r.assets.push(`${q.status()} ${q.url().replace(origin, '')}`); }); page.on('requestfailed', (q) => r.assets.push(`FAILED ${q.url().replace(origin, '')}`)); }
    try {
      await page.goto(LIVE ? `${LIVE}${query}` : `${origin}/preview/origins/${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.originsPreview && window.originsPreview.uploadLeft() === 0 && (window.originsPreview.uploadItems() > 0 || performance.now() > 20000), null, { timeout: 180000 });   // the walk's world is all on the GPU (a zone with nothing to upload: 20 s after load)
      const camp = await page.evaluate(() => window.originsPreview.goblinCentre?.() ?? null); r.camp = camp;
      const pit = name.includes('-pit');   // a name containing -pit: stand at the camp facing east, back towards the Pit (where the fog-proof Pit scenery showed)
      const hm = /-h(\d+)/.exec(name), turn = hm ? (Number(hm[1]) * Math.PI) / 180 : null;   // a name with -h<degrees> (e.g. -h45): stand at the camp centre facing that world bearing (0 = +z, 90 = +x), to check the whole horizon round
      if (camp) await page.evaluate(([x, z, back, h]) => window.originsPreview.place(h === null ? x : x, h === null ? (back ? z : z + 9) : z, h ?? (back ? Math.PI / 2 : Math.PI)), [camp.x, camp.z, pit, turn]);   // else 9 m south of the camp, facing it (forward is (sin h, cos h))
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(out, `${name}-camp.png`) }); r.stills.push(`${name}-camp.png`);
      if (process.env.STILLS_PROBE) {   // debugging the dome: its own texture (does it hold the picture?) and a frame with it painted flat magenta (where is it on screen?)
        const img = await page.evaluate(async () => { const u = window.originsPreview.goblinDomeImage?.(); if (!u) return null; const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * i.height / i.width); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); });   // 1024 wide: the runner brings back small files
        if (img) { fs.writeFileSync(path.join(out, `${name}-dome.jpg`), Buffer.from(img.split(',')[1], 'base64')); r.stills.push(`${name}-dome.jpg`); }
        r.probe = await page.evaluate(() => window.originsPreview.goblinDomeProbe?.(true) ?? null); await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(out, `${name}-magenta.png`) }); r.stills.push(`${name}-magenta.png`);
      }
      const want = process.env.STILLS_MOB ?? '';   // STILLS_MOB=cave-troll: the fight shot (and a camp shot beside him) is of the creature whose id contains this, wherever he stands; else the nearest creature
      const mob = await page.evaluate((want) => { const p = window.originsPreview.pos, ms = (window.originsPreview.mobs()?.mobs?.filter((m) => m.drawn && m.body) ?? []).filter((m) => !want || String(m.id).includes(want)); return ms.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] ?? null; }, want);
      if (mob) {
        await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [mob.x, mob.z]); await page.waitForTimeout(1500);
        await page.evaluate((id) => window.originsPreview.tapMob(id), mob.id); await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(out, `${name}-fight.png`) }); r.stills.push(`${name}-fight.png`);
      } else r.fight = 'no creature in this zone';
    } catch (e) { r.errors.push(String(e).slice(0, 300)); await page.screenshot({ path: path.join(out, `${name}-error.png`) }).catch(() => {}); }
    await page.close();
  }
} finally { fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipts, null, 2)); await browser.close(); server.close(); }
console.log(JSON.stringify(receipts.map((r) => ({ name: r.name, stills: r.stills, errors: r.errors.length, camp: !!r.camp, fight: r.fight ?? 'yes' }))));
