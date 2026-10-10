// Mid-hit stills of the shared zone page, Zone 1 and Zone 2, 375 wide (visual-pr-stills): a creature is engaged and cut until its health drops, then the page is photographed.
// PROBE=1 instead records, for the first landed hit, the contact sparks' world position against the struck creature's (xz distance) in the same frame: the placement receipt (receipt.json zones[].probe).
// KILL=1 keeps cutting until the creature is down and photographs that frame (zoneN-kill.jpg) instead of the first health drop (zoneN-hit.jpg).
// Usage: AB_DIST=<built origins-preview dir> OUT=<dir> node scripts/zone-hit-stills.mjs   (run it on the trunk build for "before" and on the PR build for "after"). Chromium on software GL.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const PROBE = !!process.env.PROBE, KILL = !!process.env.KILL, root = process.cwd(), built = process.env.AB_DIST || path.join(root, 'artifacts/origins-preview'), out = process.env.OUT || path.join(root, 'artifacts/zone-hit-stills');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { dist: built, zones: [] };
try {
  for (const [id, query] of [['1', '?region=1'], ['2', '?region=1&zone=2']]) {
    const z = { zone: id, errors: [] }; receipt.zones.push(z);
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => z.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${origin}/preview/origins/${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
    const target = await page.evaluate((pref) => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return (pref && l.find((m) => pref.includes(m.body))) || l[0]; }, KILL ? ['wolf', 'boar', 'bear', 'goblin'] : null);   // a kill still wants a creature that dies inside the run z.target = target.body;
    await page.waitForTimeout(4000);
    const at = await page.evaluate((i) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === i); return [m.x, m.z]; }, target.id);
    await page.evaluate(([x, zz]) => window.originsPreview.place(x, zz - 1.4, 0), at);
    await page.waitForTimeout(2500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
    const down = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.phase === 'dead', target.id);
    for (let attempt = 0; attempt < 4 && (await hp()) === null; attempt++) {   // the creature is in the loop's fighters only once it has joined; cutting before that reads no health, so walk up and tap again
      if (attempt) { const m = await page.evaluate((i) => { const x = window.originsPreview.mobs().mobs.find((q) => q.id === i); return [x.x, x.z]; }, target.id); await page.evaluate(([x, zz]) => window.originsPreview.place(x, zz - 1.4, 0), m); await page.waitForTimeout(1500); await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); }
      for (let k = 0; k < 32 && (await hp()) === null; k++) await page.waitForTimeout(250);
    }
    let first = null, shot = false;
    if (KILL) await page.evaluate(() => window.originsPreview.reset(40));   // a strong hero (test setup, memory only): the creature goes down in a few cuts, inside the run
    for (let t = 0; t < (KILL ? 80 : 90) && !shot; t++) {
      await page.evaluate(() => window.originsPreview.press('light'));
      if (PROBE) { for (let k = 0; k < 40 && !shot; k++) { const r = await page.evaluate((i) => { const c = window.originsPreview.combat(), m = window.originsPreview.mobs().mobs.find((x) => x.id === i), p = (c.fxProbe ?? []).find((q) => q.foe === i); return m && p && p.visible && p.victim === 1 ? { sparks: p.at, mob: [m.x, m.z], struck: p.struck ?? null } : null; }, target.id); if (r) { z.probe = { ...r, dist: +Math.hypot(r.sparks[0] - r.mob[0], r.sparks[2] - r.mob[1]).toFixed(2), distAtContact: r.struck ? +Math.hypot(r.sparks[0] - r.struck[0], r.sparks[2] - r.struck[1]).toFixed(2) : null }; shot = true; } else await page.waitForTimeout(30); } continue; }
      if (KILL) { for (let k = 0; k < 40 && !shot; k++) { if (await down()) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, `zone${id}-kill.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); shot = true; } else await page.waitForTimeout(40); } continue; }   // poll fast so the fall's frame is caught before the body is released
      await page.waitForTimeout(400);
      const h = await hp(); first ??= h;
      if (h !== null && first !== null && h < first) { await page.screenshot({ path: path.join(out, `zone${id}-hit.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); shot = true; }
    }
    z.shot = shot; z.hp = [first, await hp()];
    await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
