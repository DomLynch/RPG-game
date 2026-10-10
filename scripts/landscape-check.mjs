// Landscape / portrait layout check (see below)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), built = process.env.AB_DIST || path.join(root, 'artifacts/origins-preview'), out = process.env.OUT || path.join(root, 'artifacts/zone-hit-stills');
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
// Landscape / portrait layout check of the shared zone page (Dom, 2026-10-10: the menus and the HUD overlap on an iPhone in landscape). For each viewport and state (walk, fight, menu open): a still, and the rects of every visible
// interactive element; two of them overlapping fails the run (an element counts only when it is shown and has a real box). Usage: AB_DIST=<built origins-preview dir> OUT=<dir> node scripts/landscape-check.mjs
// [name, w, h, safe-area insets {l, r, t, b}]: the notch view is an iPhone on its side (sensor housing on the left, home bar at the bottom); its insets come from CDP Emulation.setSafeAreaInsetsOverride, and every box must stay inside them
const VIEWS = [['portrait', 375, 812], ['landscape', 812, 375], ['short', 844, 340], ['notch', 844, 390, { l: 47, r: 47, t: 0, b: 21 }], ['ipad', 1024, 768]];
const SEL = 'button, a[href], [role=button], select, .stick, #joystick, #creature-card, #hud > span, #hud > small, #hint, .fm-meters';
// each visible element with its box; `anc` = indices of listed ancestors (a box inside its own container is not an overlap), `scrolled` = inside a scroll container (off screen is fine there)
const rects = (page, sel) => page.evaluate((sel) => { const els = [...document.querySelectorAll(sel)], out = []; els.forEach((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); let v = r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0, scrolled = false, inline = cs.display === 'inline', ctl = e.matches('button, [role=button], select, .stick, #joystick'); for (let p = e.parentElement; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') v = false; if (/(auto|scroll)/.test(c.overflowY) && p.scrollHeight > p.clientHeight + 2) scrolled = true; } if (v) out.push({ e, id: e.id || (e.textContent || '').trim().slice(0, 16) || String(e.className), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), scrolled, inline, ctl }); }); return out.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, scrolled: o.scrolled, inline: o.inline, ctl: o.ctl, anc: out.map((q, k) => (q !== o && q.e.contains(o.e) ? k : -1)).filter((k) => k >= 0) })); }, sel);
const overlaps = (list, vw, vh, safe) => { const bad = []; for (let i = 0; i < list.length; i++) { const a = list[i]; if (!a.scrolled && (a.x < 0 || a.y < 0 || a.x + a.w > vw + 1 || a.y + a.h > vh + 1)) bad.push(`${a.id} off screen`); if (safe && a.ctl && !a.scrolled && (a.x < safe.l - 1 || a.x + a.w > vw - safe.r + 1 || a.y + a.h > vh - safe.b + 1)) bad.push(`${a.id} outside the safe area`);
    for (let j = i + 1; j < list.length; j++) { const b = list[j]; if (a.anc.includes(j) || b.anc.includes(i) || (a.scrolled !== b.scrolled)) continue; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 2 && oy > ((a.inline || b.inline) ? 12 : 2)) bad.push(`${a.id} x ${b.id} (${ox}x${oy})`); } } return bad; };
const receipt = { dist: built, views: [] };
try {
  for (const [name, w, h, safe] of VIEWS) {
    const v = { view: name, w, h, states: {} }; receipt.views.push(v);
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 })).newPage();
    if (safe) { const cdp = await page.context().newCDPSession(page); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: safe.l, right: safe.r, top: safe.t, bottom: safe.b } }); } catch (error) { v.safeAreaUnsupported = String(error).slice(0, 120); } }
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
    await page.waitForTimeout(4000);
    const snap = async (state, scope = '') => { await page.screenshot({ path: path.join(out, `${name}-${state}.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); const list = await rects(page, scope ? SEL.split(', ').map((x) => `${scope} ${x}`).join(', ') : SEL); v.states[state] = { count: list.length, bad: overlaps(list, w, h, safe), list }; };
    await snap('walk');
    const openMenu = async (state) => { const b = await page.$('#journal-button'); if (!b) return; await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); await snap(state, '#journal'); await page.keyboard.press('Escape'); await page.waitForTimeout(500); };
    await openMenu('menu');
    // the card needs a creature that has noticed the hero, and one that has is already a fight (which hides the card): put the longest card text up by hand and measure the layout
    await page.evaluate(() => { const c = document.getElementById('creature-card'); c.replaceChildren(...['Ash boar · Lv 1', '▰▱▱▱ Trivial', 'Rare · Alone'].map((t) => { const n = document.createElement('span'); n.textContent = t; n.style.display = 'block'; return n; })); c.hidden = false; });
    await snap('card');
    const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l[0]; });
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 3, 0), [target.x, target.z]); await page.waitForTimeout(2500);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), [target.x, target.z]); await page.waitForTimeout(1500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); await page.waitForTimeout(4000);
    await snap('fight');
    await openMenu('fight-menu');
    v.errors = errors; await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  const fails = receipt.views.flatMap((v) => [...(v.safeAreaUnsupported ? [`${v.view}: the safe-area override failed (${v.safeAreaUnsupported})`] : []), ...Object.entries(v.states).flatMap(([s, r]) => r.bad.map((b) => `${v.view}/${s}: ${b}`))]);
  console.log(fails.length ? `landscape-check FAIL\n${fails.join('\n')}` : 'landscape-check PASS', JSON.stringify(receipt.views.map((v) => [v.view, Object.fromEntries(Object.entries(v.states).map(([k, r]) => [k, r.count]))])));
  process.exitCode = fails.length ? 1 : 0;
} catch (error) { console.error('landscape-check ERROR', error); process.exitCode = 2; }
finally { await browser.close(); server.close(); }
