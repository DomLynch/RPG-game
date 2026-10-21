// Zone 1 phone readability (docs/specs/world/phone-readability.md): can the hero, a foe, a named creature, a loot drop, a scrub bush and a boulder be told from the ground at a glance?
// Each thing is placed in view with the hero well clear of it (creatures 12 m off, so no fight starts; props and the loot drop offset to one side so the hero never covers them), a still is taken, and the page's own
// projection (originsPreview.project) gives the thing's exact screen spot: a disc on the thing (median luminance) is compared with a ring of ground round it. WCAG contrast ratio of relative luminance and the CIE L* difference.
// Discs are drawn on overlay-<name>.jpg so every sample can be checked by eye.
// Usage: node scripts/readability-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=375x812 SETTLE=6000 PIT_GL=1
/* global process, console, window, document, Image */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) f = path.join(path.resolve('public'), u.replace(/^\/preview\/origins\//, '')); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const [w, h] = (process.env.VIEW || '375x812').split('x').map(Number), SETTLE = +(process.env.SETTLE || 6000);
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model) && (window.originsPreview?.kitNodes?.('boulder').length ?? 0) > 0, null, { timeout: 300000 }); await page.waitForTimeout(4000);
  const things = [];
  // a creature: the hero 12 m south of it, facing it; its spot is read again after the settle (it may have wandered); y 0.2 to 1.7 is the body
  const creature = async (name, id) => {
    const t = await page.evaluate((i) => window.originsPreview.mobs().mobs.find((m) => m.id === i), id); if (!t) return;
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 12, 0), [t.x, t.z]); await page.waitForTimeout(SETTLE);
    const now = await page.evaluate((i) => window.originsPreview.mobs().mobs.find((m) => m.id === i), id);
    things.push({ name, id, drawn: now.drawn, at: [now.x, now.z], y0: 0.2, y1: 1.7, png: (await page.screenshot({ type: 'png' })).toString('base64') });
  };
  await creature('foe', 'scavengers-2');
  await creature('named', 'bounty-shrine-1');
  // a static kit prop: the nearest of its kind to where the hero is, the hero 5 m south and 1.8 m to one side so it stands off the hero's line
  for (const [name, prefix, y1] of [['bush_scrub', 'bush_scrub', 0.9], ['boulder', 'boulder', 1.2]]) {
    const k = await page.evaluate((p) => { const s = window.originsPreview.pos, a = window.originsPreview.kitNodes(p); a.sort((q, r) => Math.hypot(q.x - s.x, q.z - s.z) - Math.hypot(r.x - s.x, r.z - s.z)); return a[0]; }, prefix); if (!k) continue;
    await page.evaluate(([x, z]) => window.originsPreview.place(x + 1.8, z - 5, 0), [k.x, k.z]); await page.waitForTimeout(SETTLE);
    things.push({ name, at: [k.x, k.z], y0: 0.1, y1, png: (await page.screenshot({ type: 'png' })).toString('base64') });
  }
  // the loot drop (the page's own ground-item view, the goblin scrap cap) 4 m ahead and 1.5 m to the side, and the hero himself in the same still
  const hero = await page.evaluate(() => { const p = window.originsPreview.pos; window.originsPreview.ground.show('rd1', 'item:starter.goblin-scrap-cap', p.x - 1.5, p.z + 4); return { x: p.x, z: p.z }; }); await page.waitForTimeout(SETTLE);
  const lootPng = (await page.screenshot({ type: 'png' })).toString('base64');
  things.push({ name: 'loot', at: [hero.x - 1.5, hero.z + 4], y0: 0.05, y1: 0.6, png: lootPng });
  things.push({ name: 'hero', at: [hero.x, hero.z], y0: 0.2, y1: 1.8, png: lootPng });
  for (const t of things) t.p0 = await page.evaluate(([x, y, z]) => window.originsPreview.project(x, y, z), [t.at[0], t.y0, t.at[1]]), t.p1 = await page.evaluate(([x, y, z]) => window.originsPreview.project(x, y, z), [t.at[0], t.y1, t.at[1]]);
  const result = await page.evaluate(async (list) => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const Y = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const Lstar = (y) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
    const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
    const res = [], overlays = [];
    for (const t of list) {
      const img = new Image(); img.src = `data:image/png;base64,${t.png}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      if (!t.p0 || !t.p1) { res.push({ name: t.name, error: 'off screen or behind the camera' }); continue; }
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const H = Math.max(8, Math.hypot(t.p0.x - t.p1.x, t.p0.y - t.p1.y)), cx = (t.p0.x + t.p1.x) / 2, cy = (t.p0.y + t.p1.y) / 2, r = Math.max(3, 0.17 * H), r1 = Math.max(r * 1.5, 0.5 * H), r2 = r1 + Math.max(6, 0.25 * H);
      const inY = [], ringY = [];
      for (let y = Math.max(0, Math.floor(cy - r2)); y < Math.min(c.height, cy + r2); y++) for (let x = Math.max(0, Math.floor(cx - r2)); x < Math.min(c.width, cx + r2); x++) {
        const d = Math.hypot(x - cx, y - cy), i = (y * c.width + x) * 4, yy = Y(px[i], px[i + 1], px[i + 2]);
        if (d <= r) inY.push(yy); else if (d >= r1 && d <= r2) ringY.push(yy);
      }
      const yi = med(inY), yo = med(ringY), hi = Math.max(yi, yo), lo = Math.min(yi, yo);
      res.push({ name: t.name, drawn: t.drawn, heightPx: Math.round(H), thingL: +Lstar(yi).toFixed(1), groundL: +Lstar(yo).toFixed(1), dL: +(Lstar(yi) - Lstar(yo)).toFixed(1), wcag: +((hi + 0.05) / (lo + 0.05)).toFixed(2), at: [Math.round(cx), Math.round(cy)] });
      g.strokeStyle = '#00ffff'; g.lineWidth = 1; for (const rr of [r, r1, r2]) { g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); }
      overlays.push([t.name, c.toDataURL('image/jpeg', 0.82).split(',')[1]]);
    }
    return { res, overlays };
  }, things);
  for (const [n, b] of result.overlays) fs.writeFileSync(path.join(out, `overlay-${n}.jpg`), Buffer.from(b, 'base64'));
  console.log('RESULT', JSON.stringify({ size: [w, h], res: result.res }));
} finally { await browser.close(); server.close(); }
