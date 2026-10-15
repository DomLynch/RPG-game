// Page-level check (spell slots 3b): the open-world page under vite dev, signed in to a stub writer whose book holds two spells, both picked in localStorage: after the book loads, SPELL 2 must be shown
// (the HUD owns the button and runs every frame; 80534d627 hid it each frame). Prints the module state it read from the page. Exit 1 when SPELL 2 stays hidden.
//   node scripts/spell-slots-zone-check.mjs      (starts its own vite dev server on :5199 and a loopback stub writer; run it on the VPS)
/* global process, console, document, localStorage, performance */
import { chromium } from 'playwright';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
const TOKEN = 'stub-access', BOOK = { alvis: { root: 'longShadow', modifiers: [], suffix: null }, andvari: { root: 'crack', modifiers: [], suffix: null } }, ops = [];
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  req.on('data', () => {}); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop(); ops.push(op); const send = (r) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: r })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'grimoire_get') return send({ spells: Object.keys(BOOK).sort().map((legend) => ({ legend, bricks: BOOK[legend] })) });
    if (op === 'build_get') return send({ level: 0, placed: {}, respreadRank: 0, version: 0 });
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const wurl = `http://127.0.0.1:${writer.address().port}/origins`;
// vite is run by node directly, in its own process group: `npx vite` leaves the real server (and its open pipes) alive after kill(), which kept this process from ever exiting in CI
const vite = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/vite/bin/vite.js'), '--config', 'origins/preview/vite.config.mjs', '--port', '5199', '--host', '127.0.0.1', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stopVite = () => { try { process.kill(-vite.pid, 'SIGTERM'); } catch { /* already gone */ } vite.stdout.destroy(); vite.stderr.destroy(); };
const WATCHDOG_S = 420, watchdog = setTimeout(() => { console.log(`FAIL: the check did not finish in ${WATCHDOG_S} s`); stopVite(); process.exit(1); }, WATCHDOG_S * 1000);   // the row's own timeout: a hang fails fast
let log = ''; vite.stdout.on('data', (d) => (log += d)); vite.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 120 && !/Local:/.test(log); i++) await new Promise((r) => setTimeout(r, 500));
console.log('vite:', log.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => /Local|error/i.test(l)).join(' | ').slice(0, 200));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([t, slots]) => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' })); localStorage.setItem('frankendom.spell.slots.v1', JSON.stringify(slots)); }, [TOKEN, ['alvis', 'andvari']]);
  const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:5199/preview/origins/?region=1&worldfight&writer=${encodeURIComponent(wurl)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 280000 }).catch((e) => console.log('mobs wait:', String(e).slice(0, 80)));
  await page.waitForFunction(() => { const b = document.getElementById('skill2-button'); return !!b && !b.hidden; }, null, { timeout: 90000 }).catch(() => {});   // poll for the condition (a slow or shared runner is not a failure); on a miss the state below says why
  await page.waitForTimeout(500);
  const st = await page.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map((r) => r.name);
    const find = (re) => urls.find((n) => re.test(n));
    const eqU = find(/spell-equip\.ts/), svU = find(/spell-slot-view\.ts/), pkU = find(/spell-pick\.ts/);
    const out = { urls: { eqU, svU, pkU } };
    if (eqU && svU && pkU) {
      const eq = await import(eqU), sv = await import(svU), pick = await import(pkU), b = document.getElementById('skill2-button');
      Object.assign(out, { owned: eq.ownedSpells(), equipped: eq.equippedSpells(), slots: sv.SLOTS.map((s) => s.id), pickA: pick.pickSpell(eq.equippedSpell(0), eq.ownedSpells(), {}), pickB: pick.pickSpell(eq.equippedSpell(1), eq.ownedSpells(), {}) });
    }
    const b2 = document.getElementById('skill2-button');
    out.button = b2 ? { hidden: b2.hidden, parent: b2.parentElement?.className } : null; out.bodyClass = document.body.className;
    return out;
  });
  console.log('STATE', JSON.stringify(st)); console.log('OPS', JSON.stringify(ops));
  const ok = st.button && st.button.hidden === false && st.equipped?.[0] && st.equipped?.[1];
  console.log(ok ? 'PASS: SPELL 2 is shown with both slots picked' : 'FAIL: SPELL 2 stays hidden (state above)'); if (!ok) process.exitCode = 1;
} finally { clearTimeout(watchdog); await browser.close(); stopVite(); writer.close(); }
process.exit(process.exitCode ?? 0);   // nothing may keep the row alive after its verdict
