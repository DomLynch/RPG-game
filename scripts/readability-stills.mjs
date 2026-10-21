// Zone 1 phone readability (docs/specs/world/phone-readability.md): can the hero, a foe, a named creature, a loot drop, a scrub bush and a boulder be told from the ground at a glance?
// For each, the hero stands DIST m south of it facing it (so it lands near the screen centre), a still is taken, and the luminance of a small disc on the thing is compared with a ring of ground round it:
// WCAG contrast ratio (relative luminance) and the CIE L* difference. Discs are drawn on overlay-<name>.png so the sample can be checked by eye. Numbers are medians of the disc / ring pixels.
// Usage: node scripts/readability-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=375x812 DIST=5 SETTLE=6000 PIT_GL=1
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
  const [w, h] = (process.env.VIEW || '375x812').split('x').map(Number), DIST = +(process.env.DIST || 5), SETTLE = +(process.env.SETTLE || 6000);
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model) && (window.originsPreview?.kitNodes?.('boulder').length ?? 0) > 0, null, { timeout: 300000 }); await page.waitForTimeout(4000);
  const mobs = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, name: m.name, x: m.x, z: m.z, drawn: m.drawn, named: m.named, level: m.level, size: m.size })));
  console.log('MOBS', JSON.stringify(mobs.slice(0, 40)));
  const pick = (re) => mobs.find((m) => m.drawn && re.test(`${m.id} ${m.name ?? ''}`));
  const targets = [
    ['foe', pick(/scaveng/i)],
    ['named', mobs.find((m) => m.drawn && (m.named || /troll|hrungnir|giant|boss/i.test(`${m.id} ${m.name ?? ''}`)))],
  ].filter(([, t]) => t);
  const nearestKit = (prefix) => page.evaluate((p) => { const s = window.originsPreview.pos, a = window.originsPreview.kitNodes(p); a.sort((q, r) => Math.hypot(q.x - s.x, q.z - s.z) - Math.hypot(r.x - s.x, r.z - s.z)); return a[0]; }, prefix);
  for (const p of ['bush_scrub', 'boulder']) { const k = await nearestKit(p); if (k) targets.push([p, { x: k.x, z: k.z }]); }
  const things = [];
  for (const [name, t] of targets) {
    await page.evaluate(([x, z, d]) => window.originsPreview.place(x, z - d, 0), [t.x, t.z, DIST]); await page.waitForTimeout(SETTLE);
    if (name === 'foe' || name === 'named') { /* a creature that has noticed the hero starts a fight: that is the readable case too */ }
    const shot = await page.screenshot({ type: 'png' });
    things.push({ name, at: [t.x, t.z], png: shot.toString('base64') });
  }
  // the loot drop: a ground item 3 m ahead of the hero, drawn by the page's own ground-item view
  await page.evaluate(() => { const p = window.originsPreview.pos; window.originsPreview.ground.show('rd1', 'item:starter.goblin-scrap-cap', p.x, p.z + 3); }); await page.waitForTimeout(SETTLE);
  { const shot = await page.screenshot({ type: 'png' }); things.push({ name: 'loot', png: shot.toString('base64') }); }
  // the hero: the plain ground ahead, the hero at his usual screen place (centre-low); compared with the ring of ground round him
  { const shot = await page.screenshot({ type: 'png' }); things.push({ name: 'hero', png: shot.toString('base64') }); }
  const result = await page.evaluate(async ([list, W, H]) => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const Y = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const Lstar = (y) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
    const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
    const res = [];
    for (const t of list) {
      const img = new Image(); img.src = `data:image/png;base64,${t.png}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      // the thing sits near the screen centre (the hero stood DIST m away facing it); the hero at about 0.5 w, 0.62 h
      const cx = c.width * 0.5, cy = t.name === 'hero' ? c.height * (c.height > c.width ? 0.60 : 0.58) : c.height * (c.height > c.width ? 0.44 : 0.50), r = Math.max(10, Math.min(c.width, c.height) * 0.05), r1 = r * 2.4, r2 = r * 3.6;
      const inY = [], ringY = [];
      for (let y = Math.max(0, Math.floor(cy - r2)); y < Math.min(c.height, cy + r2); y++) for (let x = Math.max(0, Math.floor(cx - r2)); x < Math.min(c.width, cx + r2); x++) {
        const d = Math.hypot(x - cx, y - cy), i = (y * c.width + x) * 4, yy = Y(px[i], px[i + 1], px[i + 2]);
        if (d <= r) inY.push(yy); else if (d >= r1 && d <= r2) ringY.push(yy);
      }
      const yi = med(inY), yo = med(ringY), hi = Math.max(yi, yo), lo = Math.min(yi, yo);
      res.push({ name: t.name, thingL: +Lstar(yi).toFixed(1), groundL: +Lstar(yo).toFixed(1), dL: +(Lstar(yi) - Lstar(yo)).toFixed(1), wcag: +((hi + 0.05) / (lo + 0.05)).toFixed(2), disc: [Math.round(cx), Math.round(cy), Math.round(r), Math.round(r1), Math.round(r2)] });
      g.strokeStyle = '#00ffff'; g.lineWidth = 1; for (const rr of [r, r1, r2]) { g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); }
      t.overlay = c.toDataURL('image/jpeg', 0.82).split(',')[1];   // small enough to ride the job log back
    }
    return { res, overlays: list.map((t) => [t.name, t.overlay]) };
  }, [things.map(({ name, png }) => ({ name, png })), w, h]);
  for (const [n, b] of result.overlays) fs.writeFileSync(path.join(out, `overlay-${n}.jpg`), Buffer.from(b, 'base64'));
  console.log('RESULT', JSON.stringify({ size: [w, h], DIST, res: result.res }));
} finally { await browser.close(); server.close(); }
