// RV84 zone probe: does a world hero with a melee skill now cast the Pit special (a windup, then a landing) in range, and is a press out of range refused (the 'far' cue, no cast)?
// Zone 1: /preview/origins/?region=1&worldfight&debug=1 on a BUILT page, slot 1 = the skill under test (localStorage 'frankendom.special.slots.v1'), the hero placed by a creature, SPECIAL 1 TAPPED (pointerdown).
// The page does not dispatch frankendom:combat in a zone, so the sim is read with originsPreview.combat() every 100 ms of page time after each press: hero phase / move / special windup / share, the foe's health.
// Usage: node scripts/zone1-world-special-probe.mjs <built origins-preview dist> <out dir>     env: SKILL=cleave
// Build first: npx vite build --config origins/preview/vite.config.mjs      (software GL: the launch flags below)
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [originsDist, out] = process.argv.slice(2), root = process.cwd(), SKILL = process.env.SKILL || 'cleave';
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const roots = [['/preview/origins/', `${path.resolve(originsDist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });   // REAL_GPU=1: the Mac's own GPU, so page time is real time
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[plan]') || t.startsWith('[zone ready]')) console.log('PAGE', t.slice(0, 700)); });
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => { window.__links = 0; window.__linked = []; const src = new WeakMap(), att = new WeakMap(); for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { const p = C?.prototype; if (!p) continue; const f = p.linkProgram, ss = p.shaderSource, as = p.attachShader; p.shaderSource = function (s, t) { src.set(s, t); return ss.call(this, s, t); }; p.attachShader = function (pr, s) { (att.get(pr) ?? att.set(pr, []).get(pr)).push(s); return as.call(this, pr, s); }; p.linkProgram = function (pr) { window.__links++; const text = (att.get(pr) ?? []).map((s) => src.get(s) ?? '').join('\n'), name = /#define SHADER_NAME (\S+)/.exec(text)?.[1] ?? '?', defs = [...new Set([...text.matchAll(/#define (USE_[A-Z_]+|SKINNING|FLAT_SHADED|DOUBLE_SIDED|USE_ENVMAP|NUM_[A-Z_]+ \d+)/g)].map((m) => m[1]))].slice(0, 8); window.__linked.push({ n: window.__links, name, defs, at: Math.round(performance.now()), stack: (Error.stackTraceLimit = 40, new Error().stack).split('\n').slice(10, 24).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '')).join(' < ') }); return f.call(this, pr); }; } });   // every link, named from three's SHADER_NAME define
await page.addInitScript((s) => { try { localStorage.setItem('frankendom.special.slots.v1', JSON.stringify([s, s === 'cleave' ? 'stomp' : 'cleave'])); } catch { /* storage refused */ } }, SKILL);
const sample = () => page.evaluate(() => { const c = window.originsPreview.combat(), h = c.hero, me = c.fighters?.find((q) => q.id === 'me'), f = c.fighters?.find((q) => q.id !== 'me'), tr = c.trace ?? []; return { t: Math.round(performance.now()), phase: h?.phase, stamina: Math.round(h?.stamina ?? 0), hp: h?.health, foeHp: f?.hp ?? null, foePhase: f?.phase ?? null, gap: f && me ? Math.hypot(f.x - me.x, f.z - me.z).toFixed(2) : null, duel: me?.duel ?? null, last: Array.isArray(tr) ? tr.slice(-2) : tr }; });
const log = [];
// FRAMES=1: a screencast (CDP) kept only for 1.5 s after each SPECIAL tap, about 10 fps, so the windup frames come back (a per-step screenshot is too slow, and the runner returns no video)
let keepUntil = 0, shot = 0;
if (process.env.FRAMES) {
  const cdp = await page.context().newCDPSession(page); fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => { if (Date.now() < keepUntil) fs.writeFileSync(path.join(out, 'frames', `c${String(shot++).padStart(3, '0')}-${Date.now() % 100000}.jpg`), Buffer.from(data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 3 });
}
try {
  await page.goto(`${base}/preview/origins/?region=1&worldfight&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 });
  await page.waitForTimeout(6000);
  const target = await page.evaluate(() => { const all = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); console.log; return all.find((m) => /goblin|wolf|boar|scaveng/.test(m.id)) ?? all.filter((m) => !/troll|bear|werewolf|minotaur/.test(m.id)).sort((x, y) => (x.id < y.id ? -1 : 1))[0] ?? all[0]; });
  console.log('target', target.id, 'of', JSON.stringify(await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn).map((m) => m.id).slice(0, 12))));
  // stand `d` metres south of the creature's CURRENT position (a mob wanders and hunts: read it fresh)
  const near = (d) => page.evaluate(([id, dd]) => { const m = window.originsPreview.mobs().mobs.find((q) => q.id === id); if (m) window.originsPreview.place(m.x, m.z - dd, 0); return m ? [m.x, m.z] : null; }, [target.id, d]);
  await near(1.4);
  await page.waitForTimeout(3000);
  const press = async (label) => {
    for (let t = 0; t < 8 && !(await page.evaluate(() => document.body.classList.contains('infight'))); t++) { if (label === 'in-range') await near(1.4); await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(1500); }   // engage: a fresh position each try
    await page.waitForFunction(() => { const h = window.originsPreview.combat().hero; return !h || h.dead || (h.phase === 'ready' && h.stamina >= 40); }, null, { timeout: 90000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 60000 }).catch(() => {});
    const before = await sample(); console.log(label, 'before', JSON.stringify(before));
    console.log(label, 'raw', JSON.stringify(await page.evaluate(() => { const c = window.originsPreview.combat(); return { keys: Object.keys(c), hero: c.hero, fighters: c.fighters?.slice?.(0, 2), target: c.target, trace: (c.trace ?? []).slice?.(-3) }; })).slice(0, 1400));
    keepUntil = Date.now() + 1500; const links0 = await page.evaluate(() => window.__links ?? -1);   // WebGL programs linked so far (the init script below counts every linkProgram): a late compile at the first windup would show as a rise across the press
    await page.locator('#skill-button').tap({ timeout: 20000 }).catch((e) => console.log(label, 'tap failed', String(e).slice(0, 100)));
    const seen = [];
    for (let k = 0; k < 70; k++) { await page.waitForTimeout(50); seen.push(await sample()); if (k === 6 || k === 20 || k === 40) await page.screenshot({ path: path.join(out, `zone1-${SKILL}-${label}-${String(k).padStart(2, '0')}.png`) }).catch(() => {}); }
    const keep = seen.filter((s, i) => i === 0 || s.phase !== seen[i - 1].phase || s.foeHp !== seen[i - 1].foeHp);
    { const drop = seen.find((s) => s.foeHp !== null && before.foeHp !== null && s.foeHp < before.foeHp); console.log(label, 'SPECIAL press: foe hp', before.foeHp, '->', drop ? `${drop.foeHp} (drop ${before.foeHp - drop.foeHp}, ${drop.t - seen[0].t} ms after the first sample)` : 'no drop in 3.5 s', '| target max', await page.evaluate(() => window.originsPreview.combat().target?.max ?? null)); }
    console.log(label, 'owners of programs linked after the press:', JSON.stringify(await page.evaluate((n) => { const o = window.originsPreview.renderInfo().programOwners ?? {}, ids = new Set(window.__linked.filter((l) => l.n > n).map((l) => l.n)); return Object.fromEntries(Object.entries(o).filter(([k]) => { const id = Number(k.split('#').pop()); return ids.has(id) || ids.has(id + 1); })); }, links0)));
    console.log(label, 'program names linked after the press (this and later):', JSON.stringify((await page.evaluate((n) => window.__linked.filter((l) => l.n > n), links0)).slice(0, 8)));
    console.log(label, 'WebGL programs linked during this press (3.5 s):', (await page.evaluate(() => window.__links ?? -1)) - links0, '(total', await page.evaluate(() => window.__links ?? -1), ')');
    console.log(label, 'trace (phase / foe hp changes)', JSON.stringify(keep.slice(0, 16)));
    console.log(label, 'phase durations ms', JSON.stringify(keep.map((s, i) => [s.phase, i + 1 < keep.length ? keep[i + 1].t - s.t : null])));
    log.push({ label, before, trace: keep });
    await page.screenshot({ path: path.join(out, `zone1-${SKILL}-${label}.png`) }).catch(() => {});
  };
  await press('in-range');
  if (process.env.FRAMES) for (let again = 0; again < 3; again++) { await page.waitForTimeout(2500); await press('in-range'); }   // more casts: a stagger or a foe blow can eat one
  await page.waitForTimeout(6000);
  // out of range: the hero steps away from the creature mid-fight, then presses
  await near(6);
  await page.waitForTimeout(1500);
  await press('out-of-range');
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(out, 'probe.json'), JSON.stringify({ skill: SKILL, errors, log }, null, 1));
console.log('page errors', errors.length);
