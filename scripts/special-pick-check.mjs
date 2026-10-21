// A real fight with SPECIAL 1 / SPECIAL 2 picked (the specials PR, RV75 / WSV52) on the built origins-preview page at 375x812: the picks are in the store before the page loads, a creature is engaged through the real tap path, both
// buttons show (the second wears the skill row's name), each press spends its move row's stamina and starts its own cooldown (the button dims), and the creature takes damage. Stills of the HUD with both buttons lit go to <out>.
// Usage: node scripts/special-pick-check.mjs <built origins-preview dist> <out dir> [--first lunge] [--second stomp] [--zone 1]   (Mac GL by default; PIT_GL=1 = software GL for a loaded box)
//   build first: npx vite build --config origins/preview/vite.config.mjs --outDir artifacts/origins-preview
/* global process, console, window, document */
import { launchBrowser } from './lib/browser-launch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2), opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const [dist, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const FIRST = opt('first', 'lunge'), SECOND = opt('second', 'stomp'), ZONE = opt('zone', '1'), FRESH = process.env.SPECIAL_FRESH === '1';
if (!dist || !out) { console.error('usage: node scripts/special-pick-check.mjs <built origins-preview dist> <out dir> [--first lunge] [--second stomp] [--zone 1]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp' };
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
const glArgs = process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
const browser = await launchBrowser(chromium, { args: glArgs });
const receipt = { dist, picks: [FIRST, SECOND], checks: [], errors: [], passed: false };
const ok = (name, detail) => { receipt.checks.push({ name, ...(detail === undefined ? {} : { detail }) }); console.log('ok:', name, detail === undefined ? '' : JSON.stringify(detail)); };
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  if (!FRESH) await context.addInitScript(([a, b]) => { try { localStorage.setItem('frankendom.special.slots.v1', JSON.stringify([a, b])); } catch { /* storage refused */ } }, [FIRST, SECOND]);   // SPECIAL_FRESH=1: a brand-new guest, nothing stored: the row defaults must fill both slots
  const page = await context.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 240)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=${ZONE}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  const target = await page.evaluate(() => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model); return { id: m.id, x: m.x, z: m.z, name: m.name }; });
  ok('the page boots with both picks stored and a creature drawn', target.name);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
  for (let i = 0; i < 80 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
  if (!(await page.evaluate(() => document.body.classList.contains('infight')))) await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  for (let i = 0; i < 40 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => document.body.classList.contains('infight')), 'a fight starts');
  const button = (sel) => page.evaluate((s) => { const b = document.querySelector(s); return b ? { hidden: b.hidden, disabled: b.getAttribute('aria-disabled'), label: b.getAttribute('aria-label') ?? b.textContent } : null; }, sel);
  const one = await button('#skill-button'), two = await button('#skill2-button');
  assert.ok(one && !one.hidden, `SPECIAL 1 button shows: ${JSON.stringify(one)}`);
  assert.ok(two && !two.hidden, `SPECIAL 2 button shows: ${JSON.stringify(two)}`);
  assert.match(String(two.label), FRESH ? /whirlwind|reaping/i : /stomp/i, `SPECIAL 2 wears the skill row's own name: ${two.label}`);
  assert.match(String(one.label), FRESH ? /skull crack|cleave/i : /lunge/i, `SPECIAL 1 wears the skill row's own name: ${one.label}`);
  ok('both SPECIAL buttons show and SPECIAL 2 wears its skill name', { one: one.label, two: two.label });
  await page.screenshot({ path: path.join(out, 'hud-both-lit.png') });
  const state = () => page.evaluate(() => { const c = window.originsPreview.combat(); return { stamina: c.hero.stamina, hp: c.fighters.filter((f) => f.id !== 'me').map((f) => f.health) }; });
  // stamina regenerates, so the press is read as the DIP: sample for 1.6 s after the tap and keep the lowest figure and the creature's lowest health
  const press = async (selector) => {
    const before = await state();
    await page.locator(selector).tap({ timeout: 5000 });
    let lowest = before.stamina, creatureHp = Math.min(...before.hp); const series = [before.stamina];
    for (let t = 0; t < 32; t++) { await page.waitForTimeout(50); const s = await state(); lowest = Math.min(lowest, s.stamina); creatureHp = Math.min(creatureHp, ...s.hp); series.push(Math.round(s.stamina)); }
    return { before: before.stamina, lowest, dip: before.stamina - lowest, creatureHpBefore: Math.min(...before.hp), creatureHpLowest: creatureHp, series: series.join(',') };
  };
  const first = await press('#skill-button');
  assert.ok(first.dip >= 20, `SPECIAL 1 spent its move row's stamina (dip ${first.dip}; series ${first.series})`);
  ok('SPECIAL 1 fires and spends its move row\'s stamina', first);
  await page.waitForTimeout(2500);
  const second = await press('#skill2-button');
  assert.ok(second.dip >= 20, `SPECIAL 2 spent its move row's stamina (dip ${second.dip}: ${second.before} -> ${second.lowest})`);
  ok('SPECIAL 2 fires and spends its move row\'s stamina', second);
  ok('creature health across both presses', { before: first.creatureHpBefore, lowest: Math.min(first.creatureHpLowest, second.creatureHpLowest) });
  const dim = await button('#skill2-button');
  ok('SPECIAL 2 button state after the press (dims while it cools)', dim);
  await page.screenshot({ path: path.join(out, 'hud-after-both.png') });
  assert.equal(receipt.errors.length, 0, `no page errors: ${receipt.errors.join(' | ')}`);
  receipt.passed = true;
} finally {
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  await browser.close(); server.close();
}
console.log(receipt.passed ? 'PASS' : 'FAIL');
