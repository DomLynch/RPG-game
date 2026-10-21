// Zone 1 creature spots, seen the way a player meets them: the hero stands at FROM, faces LOOK, and the page shoots after the creature there is drawn.
// Usage: node scripts/creature-spot-stills.mjs <built origins-preview dist> <out dir>
// env: VIEW=844x390  SHOTS='[{"name":"s1-start","from":"start","look":[-119.4,-9.9]},{"name":"t2-road","from":[-110,-50],"look":[-124,-34]}]'  SETTLE=6000  PIT_GL=1 (software GL)
// from: "start" = where the page drops the hero; else [x, z] in world metres. look: [x, z] the hero faces (heading 0 looks along +z, headingTo = atan2(dx, dz)).
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, ''));
  if (!fs.existsSync(f) && fs.existsSync(path.join('public', u))) f = path.join('public', u);   // the built page does not carry public/ (the zone kit, the dome pictures)
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const [w, h] = (process.env.VIEW || '844x390').split('x').map(Number);
  const shots = JSON.parse(process.env.SHOTS || '[]');
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 });   // the page is up
  await page.waitForTimeout(3000);
  const start = await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }));
  console.log(JSON.stringify({ size: [w, h], start, mobKeys: await page.evaluate(() => Object.keys(window.originsPreview.mobs().mobs[0] ?? {})) }));
  for (const s of shots) {
    if (s.mob) {   // { mob: '<mob id>', standoff: metres }: stand `standoff` m from that mob on the line from the start, facing it
      const m = await page.evaluate((id) => { const k = window.originsPreview.mobs().mobs.find((x) => x.id === id); return k && { x: k.x, z: k.z }; }, s.mob);
      if (!m) throw new Error(`no mob ${s.mob}`);
      const dx = m.x - start.x, dz = m.z - start.z, len = Math.hypot(dx, dz) || 1, so = s.standoff ?? 4;
      s.from = [m.x - dx / len * so, m.z - dz / len * so]; s.look = [m.x, m.z];
    }
    const from = s.from === 'start' ? [start.x, start.z] : s.from, heading = Math.atan2(s.look[0] - from[0], s.look[1] - from[1]);
    await page.evaluate(([x, z, hd]) => window.originsPreview.place(x, z, hd), [from[0], from[1], heading]);
    await page.waitForTimeout(+(process.env.SETTLE || 6000));
    const near = await page.evaluate(([x, z]) => (window.originsPreview.mobs()?.mobs ?? []).map((m) => ({ id: m.id, drawn: !!m.drawn, d: Math.round(Math.hypot(m.x - x, m.z - z)) })).filter((m) => m.d < 40).sort((a, b) => a.d - b.d), from);
    await page.screenshot({ path: path.join(out, `${s.name}.jpg`), type: 'jpeg', quality: 88 });
    console.log(JSON.stringify({ shot: s.name, from, look: s.look, heading: +heading.toFixed(2), near }));
  }
} finally { await browser.close(); server.close(); }
