// Program switches per frame in a phone zone fight: node probe-switches.mjs <build root> [phone|desktop]. Hooks WebGL useProgram + draw calls per rAF frame (three only calls useProgram when the program changes, so each call is a switch).
// Prints per-frame mean switches, mean distinct programs, the saving a perfect program sort could make (switches - distinct), draw counts, and one sample frame's program sequence. Counts only: software GL is fine.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, mode = 'phone'] = process.argv.slice(2);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${process.cwd()}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(mode === 'phone' ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  const ids = new WeakMap(); let n = 0;
  window.__sw = { on: false, frames: [], cur: { seq: [], draws: 0 } };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const use = C.prototype.useProgram; C.prototype.useProgram = function (p) { if (p) { if (!ids.has(p)) ids.set(p, ++n); window.__sw.cur.seq.push(ids.get(p)); } return use.call(this, p); };
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const f = C.prototype[k]; if (f) C.prototype[k] = function (...a) { window.__sw.cur.draws++; return f.apply(this, a); }; }
  }
  const tick = () => { const s = window.__sw; if (s.on) s.frames.push(s.cur); s.cur = { seq: [], draws: 0 }; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.originsPreview?.mobs?.()?.mobs?.length > 0, null, { timeout: 480000 });
await page.waitForTimeout(25000);
const foe = await page.evaluate(() => { const rx = /scaveng/i; const ms = window.originsPreview.mobs().mobs.filter((m) => rx.test(m.id)); const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - 1.5, 0); return t.id; });
await page.waitForTimeout(2000);
const walk = await page.evaluate(() => { window.__sw.frames.length = 0; window.__sw.on = true; return 1; });
await page.waitForTimeout(6000);
const idle = await page.evaluate(() => { window.__sw.on = false; const f = window.__sw.frames.slice(); window.__sw.frames.length = 0; return f; });
await page.evaluate(() => { window.__sw.on = true; });
await page.evaluate((id) => window.originsPreview.tapMob(id), foe);
for (let i = 0; i < 14; i++) { await page.evaluate(() => window.originsPreview.press?.('light')); await page.waitForTimeout(700); }
const fight = await page.evaluate(() => { window.__sw.on = false; return window.__sw.frames.slice(); });
const stat = (fr) => { const sw = fr.map((f) => f.seq.length), dist = fr.map((f) => new Set(f.seq).size), dr = fr.map((f) => f.draws); const m = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0; return { frames: fr.length, switchesPerFrame: m(sw), distinctProgramsPerFrame: m(dist), idealSavingPerFrame: +(m(sw) - m(dist)).toFixed(2), drawsPerFrame: m(dr), maxSwitches: Math.max(0, ...sw) }; };
console.log(`SWITCHES ${mode} idle:`, JSON.stringify(stat(idle)));
console.log(`SWITCHES ${mode} fight:`, JSON.stringify(stat(fight)));
const sample = fight.filter((f) => f.seq.length > 20).sort((a, b) => b.seq.length - a.seq.length)[Math.floor(fight.length / 4)] ?? fight[fight.length >> 1];
console.log(`SEQ ${mode} sample frame (${sample?.seq.length} switches, ${sample?.draws} draws):`, sample?.seq.join(' '));
// pairs of programs that alternate (A B A B): the avoidable ping-pongs
const alt = new Map(); for (const f of fight) for (let i = 2; i < f.seq.length; i++) if (f.seq[i] === f.seq[i - 2] && f.seq[i] !== f.seq[i - 1]) { const k = `${f.seq[i - 2]}-${f.seq[i - 1]}`; alt.set(k, (alt.get(k) ?? 0) + 1); }
console.log(`ALT ${mode} (A B A ping-pongs over the fight, top 8):`, JSON.stringify([...alt].sort((a, b) => b[1] - a[1]).slice(0, 8)));
await browser.close(); server.close();
