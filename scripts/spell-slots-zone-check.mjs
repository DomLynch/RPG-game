// Page-level check (the beta cut on specials; was spell slots 3b): the open-world page under vite dev, signed in to a stub writer whose book holds two spells, both spells AND two SPECIAL picks stored in localStorage. The beta has spells
// OFF (career-rules.json betaCut.spellsOff), so after the book loads: no spell can be owned or equipped (owned [], equipped [none, none]), the HUD's second button is SPECIAL 2 (not a spell: it wears the skill row's name), the first is
// SPECIAL 1, and the pick module offers exactly betaCut.specialPick. The HUD owns the buttons and runs every frame (80534d627 hid the second each frame): they must stay shown.
// Why not the old spell-slot assertion: with the cut ON no spell is ever owned, so "SPELL 2 shown with two spells picked" cannot hold; the page has no URL hook that lifts the cut (it is a row read at load), so the two-spell slot
// coverage lives at node level (tests/spell-slots.test.ts, spell-equip.test.ts, world-cast.test.ts, origins/server/world-verify.test.ts with the cut lifted) and the spellsOff=0 path is the row. Prints the module state it read. Exit 1 on any miss.
//   node scripts/spell-slots-zone-check.mjs      (starts its own vite dev server on :5199 and a loopback stub writer; run it on the VPS)
/* global process, console, document, localStorage, performance */
import { chromium } from 'playwright';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
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
  await ctx.addInitScript(([t, slots]) => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' })); localStorage.setItem('frankendom.spell.slots.v1', JSON.stringify(slots)); localStorage.setItem('frankendom.special.slots.v1', JSON.stringify(['lunge', 'stomp'])); }, [TOKEN, ['alvis', 'andvari']]);
  const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:5199/preview/origins/?region=1&worldfight&writer=${encodeURIComponent(wurl)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 280000 }).catch((e) => console.log('mobs wait:', String(e).slice(0, 80)));
  await page.waitForFunction(() => { const b = document.getElementById('skill2-button'); return !!b && !b.hidden; }, null, { timeout: 90000 }).catch(() => {});   // poll for the condition (a slow or shared runner is not a failure); on a miss the state below says why
  await page.waitForTimeout(500);
  const st = await page.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map((r) => r.name);
    const find = (re) => urls.find((n) => re.test(n));
    const eqU = find(/spell-equip\.ts/), svU = find(/spell-slot-view\.ts/), pkU = find(/spell-pick\.ts/);
    const spU = find(/special-equip\.ts/), out = { urls: { eqU, svU, pkU, spU } };
    if (spU) { const sp = await import(spU); Object.assign(out, { choices: sp.specialChoices().map((c) => c.id), specials: sp.equippedSpecials() }); }
    if (eqU && svU && pkU) {
      const eq = await import(eqU), sv = await import(svU), pick = await import(pkU), b = document.getElementById('skill2-button');
      Object.assign(out, { owned: eq.ownedSpells(), equipped: eq.equippedSpells(), slots: sv.SLOTS.map((s) => s.id), pickA: pick.pickSpell(eq.equippedSpell(0), eq.ownedSpells(), {}), pickB: pick.pickSpell(eq.equippedSpell(1), eq.ownedSpells(), {}) });
    }
    const b2 = document.getElementById('skill2-button');
    const b1 = document.getElementById('skill-button');
    out.button = b2 ? { hidden: b2.hidden, parent: b2.parentElement?.className, label: b2.getAttribute('aria-label') } : null;
    out.skillButton = b1 ? { hidden: b1.hidden, label: b1.getAttribute('aria-label') } : null; out.bodyClass = document.body.className;
    return out;
  });
  console.log('STATE', JSON.stringify(st)); console.log('OPS', JSON.stringify(ops));
  const want = JSON.parse(readFileSync('src/core/career-rules.json', 'utf8')).betaCut[0].specialPick;
  const misses = [];
  if (!(Array.isArray(st.owned) && st.owned.length === 0)) misses.push(`a spell was owned with the cut ON: ${JSON.stringify(st.owned)}`);
  if (!(Array.isArray(st.equipped) && st.equipped.every((x) => !x))) misses.push(`a spell was equipped with the cut ON: ${JSON.stringify(st.equipped)}`);
  if (!(st.button && st.button.hidden === false && /stomp/i.test(st.button.label ?? ''))) misses.push(`SPECIAL 2 is not shown named: ${JSON.stringify(st.button)}`);
  if (!(st.skillButton && st.skillButton.hidden === false)) misses.push(`SPECIAL 1 is not shown: ${JSON.stringify(st.skillButton)}`);
  if (JSON.stringify(st.choices) !== JSON.stringify(want)) misses.push(`the pick module offers ${JSON.stringify(st.choices)}, the row says ${JSON.stringify(want)}`);
  if (!(Array.isArray(st.specials) && st.specials[0] === 'lunge' && st.specials[1] === 'stomp')) misses.push(`the stored picks did not read back: ${JSON.stringify(st.specials)}`);
  console.log(misses.length ? `FAIL: ${misses.join(' | ')}` : 'PASS: spells are off (none owned or equipped), SPECIAL 1 and SPECIAL 2 are shown, the pick list is the betaCut row'); if (misses.length) process.exitCode = 1;
} finally { await browser.close(); stopVite(); writer.closeAllConnections?.(); writer.close(); }   // the watchdog stays armed through the teardown: a browser close that hangs still fails fast
clearTimeout(watchdog); process.exit(process.exitCode ?? 0);   // nothing may keep the row alive after its verdict
