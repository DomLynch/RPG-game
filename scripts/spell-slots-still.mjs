// Stills of the spell-slot buttons (spell slots 3b, visual-pr-stills), taken the way a player gets there, no forcing:
//   ZONE (open world): the built origins preview (?region=1&worldfight) signed in to a stub writer whose book holds two spells, slot a and slot b picked in localStorage (the key the grimoire's Equip A / Equip B writes);
//   the page reads the book, and SPELL 2 appears by itself. PIT: the built Pit page with the SAME picks and book, which must NOT show SPELL 2 (the ladder never fills slot b).
// 375x812 and 320x568 each. Each frame comes with a receipt of the visible action boxes (no two overlap, all inside the viewport, each >= 44 px) and the page text is checked for a fallback toast.
//   node scripts/spell-slots-still.mjs --dist dist [--out artifacts/spell-slots] [--dpr 2]      (the origins preview is built here when artifacts/origins-preview is missing)
/* global process, console, document, localStorage */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/spell-slots'), DPR = Number(arg('dpr', 2)), ROOT = process.cwd(), PREVIEW = path.join(ROOT, 'artifacts/origins-preview');
const VIEWPORTS = [{ w: 375, h: 812 }, { w: 320, h: 568 }], TOKEN = 'stub-access';
const BOOK = { alvis: { root: 'longShadow', modifiers: [], suffix: null }, andvari: { root: 'crack', modifiers: [], suffix: null } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

if (!(await fs.stat(path.join(PREVIEW, 'index.html')).catch(() => null))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 900_000 });
const roots = { '/preview/origins/': `${PREVIEW}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${ROOT}/public/${d}/`;
const site = http.createServer(async (req, res) => {   // the preview under /preview/origins/, the Pit build at the root (SPA fallback)
  const u = decodeURIComponent(req.url.split('?')[0]); let file = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) file = path.join(r, u.slice(p.length) || 'index.html');
  if (!file) { file = path.join(DIST, u === '/' ? 'index.html' : u); }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { if (u.startsWith('/preview/')) { res.writeHead(404); return res.end(); } file = path.join(DIST, 'index.html'); }
  try { const data = await fs.readFile(file); res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data); } catch { res.writeHead(404); res.end(); }
});
const writer = http.createServer((req, res) => {   // grimoire_get / open / build_get, the way grimoire-check stubs them; everything else 404 (the pages tolerate an offline writer)
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(), send = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'grimoire_get') return send({ spells: Object.keys(BOOK).sort().map((legend) => ({ legend, bricks: BOOK[legend] })) });
    if (op === 'build_get') return send({ level: 0, placed: {}, respreadRank: 0, version: 0 });
    res.writeHead(404, cors); res.end();
  });
});
await Promise.all([new Promise((r) => site.listen(0, '127.0.0.1', r)), new Promise((r) => writer.listen(0, '127.0.0.1', r))]);
const origin = `http://127.0.0.1:${site.address().port}`, writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const receipt = [], fails = [];

async function boxesOf(page) {
  return page.evaluate(() => [...document.querySelectorAll('.actions button')].filter((b) => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return !b.hidden && s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0; }).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, l: Math.round(r.left * 10) / 10, t: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; }));
}
async function frame(label, vp, page, expectSkill2) {
  const boxes = await boxesOf(page), circle = (b) => ({ cx: b.l + b.w / 2, cy: b.t + b.h / 2, r: b.w / 2 }), overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = circle(boxes[i]), b = circle(boxes[j]); if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r - 0.5) overlaps.push([boxes[i].id, boxes[j].id]); }
  const off = boxes.filter((b) => b.l < 0 || b.t < 0 || b.l + b.w > vp.w || b.t + b.h > vp.h).map((b) => b.id), small = boxes.filter((b) => b.w < 44 || b.h < 44).map((b) => b.id);
  const toast = await page.evaluate(() => /isn't valid|normal fight/i.test(document.body.innerText)), hasSkill2 = boxes.some((b) => b.id === 'skill2-button');
  receipt.push({ frame: label, viewport: `${vp.w}x${vp.h}`, buttons: boxes.map((b) => b.id), hasSkill2, toast, overlaps, off, small, boxes });
  await page.screenshot({ path: `${OUT}/${label}-${vp.w}.jpg`, type: 'jpeg', quality: 88, animations: 'disabled' });
  if (hasSkill2 !== expectSkill2) fails.push(`${label} ${vp.w}: SPELL 2 ${hasSkill2 ? 'shown' : 'absent'}, expected ${expectSkill2 ? 'shown' : 'absent'}`);
  if (toast) fails.push(`${label} ${vp.w}: a fallback toast is on screen`);
  if (overlaps.length || off.length) fails.push(`${label} ${vp.w}: overlaps ${JSON.stringify(overlaps)} off-screen ${JSON.stringify(off)}`);
}
const open = async (vp) => {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR });
  await context.addInitScript(([t, slots]) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' })); localStorage.setItem('frankendom.spell.slots.v1', JSON.stringify(slots)); } catch { /* storage refused */ } }, [TOKEN, ['alvis', 'andvari']]);
  const page = await context.newPage(); page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 160))); await page.route('**/*sentry.io/**', (r) => r.abort());
  return { context, page };
};
try {
  await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });
  for (const vp of VIEWPORTS) {   // open world: SPELL 2 appears by itself once the book is read
    const { context, page } = await open(vp);
    await page.goto(`${origin}/preview/origins/?region=1&worldfight&writer=${encodeURIComponent(writerUrl)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 300000 });
    await page.waitForFunction(() => { const b = document.getElementById('skill2-button'); return !!b && !b.hidden; }, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500); await frame('zone', vp, page, true); await context.close();
  }
  for (const vp of VIEWPORTS) {   // the Pit with the same picks: no SPELL 2
    const { context, page } = await open(vp);
    await page.goto(`${origin}/?writer=${encodeURIComponent(writerUrl)}&opponent=veteran&difficulty=dummy&weapon=longsword`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 300000, polling: 200 });
    if (await page.locator('#welcome').isVisible().catch(() => false)) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true }).catch(() => {});
    await page.addStyleTag({ content: '#debug{display:none!important}' }); await page.waitForTimeout(1500);
    await page.locator('#attack-button').tap().catch(() => {}); await page.waitForTimeout(2000); await frame('pit', vp, page, false); await context.close();
  }
  await fs.writeFile(`${OUT}/receipt.json`, JSON.stringify(receipt, null, 2));
  for (const r of receipt) console.log(`${r.frame} ${r.viewport}: ${r.buttons.length} buttons${r.hasSkill2 ? ' (SPELL 2 shown)' : ' (no SPELL 2)'}, toast ${r.toast}, overlaps ${JSON.stringify(r.overlaps)}, off-screen ${JSON.stringify(r.off)}, under 44px ${JSON.stringify(r.small)}`);
  if (fails.length) { console.log(`FAIL: ${fails.join('; ')}`); process.exitCode = 1; }
} finally { await browser.close(); site.close(); writer.close(); }
