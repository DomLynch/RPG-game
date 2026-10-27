// Do the six melee specials look and sound like specials in Zone 1, and does the Pit page count too? Reads the ?debug=1 counter (window.__specials = { fx, cues }, src/fight/special-counter.ts) on a BUILT page.
// Zone 1: /preview/origins/?region=1&worldfight&debug=1, the hero placed by a creature, the two special slots set in localStorage ('frankendom.special.slots.v1') before the page loads, each button TAPPED (the buttons
// listen for pointerdown, a click does not reach them). Pit: /?debug=1&fight=1, one SPECIAL 1 cast. Prints a table; the exit code is 1 when a Zone 1 cast shows fx = 0 or the Pit counter never moved.
// Usage: node scripts/zone1-special-presentation-check.mjs <built origins-preview dist> <built game dist> <out dir>      env: PAIRS="lunge:ironrush,pommel:shove,cleave:stomp" (slot 1 : slot 2), PIT=0 to skip the Pit
// Build first: npx vite build --config origins/preview/vite.config.mjs && npx vite build      (software GL: the launch flags below)
/* global process, console, window, document */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [originsDist, gameDist, out] = process.argv.slice(2), root = process.cwd();
const pairs = (process.env.PAIRS || 'lunge:ironrush,pommel:shove,cleave:stomp').split(',').map((p) => p.split(':'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const roots = [['/preview/origins/', `${path.resolve(originsDist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
roots.push(['/', `${path.resolve(gameDist)}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const rows = []; let failed = false;
const counts = (page) => page.evaluate(() => ({ ...(window.__specials ?? { fx: -1, cues: -1 }), dataFx: document.querySelector('#debug')?.dataset.specialFx ?? null, dataCues: document.querySelector('#debug')?.dataset.specialCues ?? null }));
const newPage = async (a, b) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.addInitScript(([x, y]) => { try { localStorage.setItem('frankendom.special.slots.v1', JSON.stringify([x, y])); } catch { /* storage refused */ } }, [a, b]);
  return { page, errors };
};
try {
  for (const [a, b] of pairs) {
    const { page, errors } = await newPage(a, b);
    await page.goto(`${base}/preview/origins/?region=1&worldfight&debug=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 });
    await page.waitForTimeout(6000);
    const target = await page.evaluate(() => { const all = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return all.find((m) => /goblin|wolf|boar/.test(m.id)) ?? all.sort((x, y) => (x.id < y.id ? -1 : 1))[0]; });
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.2, 0), [target.x, target.z]);
    await page.waitForTimeout(15000);
    for (const [slot, skill, sel] of [[1, a, '#skill-button'], [2, b, '#skill2-button']]) {
      const before = await counts(page); let after = before, tries = 0;
      for (; tries < 8 && (after.fx === before.fx || after.cues === before.cues); tries++) {
        if (!(await page.evaluate(() => document.body.classList.contains('infight')))) await page.evaluate(() => window.originsPreview.press('light'));   // engage once; inside the fight only the special is pressed (a light spam starves the stamina a special costs)
        await page.waitForFunction(() => { const h = window.originsPreview.combat().hero; return !h || h.dead || (h.phase === 'ready' && h.stamina >= 60); }, null, { timeout: 90000 }).catch(() => {});
        await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-disabled') !== 'true', sel, { timeout: 60000 }).catch(() => {});
        await page.locator(sel).tap({ timeout: 20000 }).catch((e) => console.log(skill, 'tap failed:', String(e).slice(0, 120)));
        const seen = []; for (let k = 0; k < 7; k++) { await page.waitForTimeout(500); seen.push(await page.evaluate((s) => { const c = window.originsPreview.combat(), f = c.fighters?.[0]; return `${c.hero?.phase}/${c.hero?.move ?? c.trace?.move ?? ''}|${document.querySelector(s)?.getAttribute('aria-disabled')}|${f ? `${f.id}:${f.phase}:${Math.hypot((f.x ?? 0) - (c.hero?.x ?? 0), (f.z ?? 0) - (c.hero?.z ?? 0)).toFixed(1)}:${f.health}` : 'nofoe'}|${JSON.stringify(window.__specials)}`; }, sel)); }
        if (tries < 3) console.log(skill, 'try', tries, seen.join(' ; '));
        if (tries === 0) console.log(skill, 'raw', JSON.stringify(await page.evaluate(() => ({ h: window.originsPreview.combat().hero, f: window.originsPreview.combat().fighters?.slice(0, 2) }))).slice(0, 700));
        after = await counts(page);
      }
      const row = { page: 'zone1', slot, skill, fx: after.fx - before.fx, cues: after.cues - before.cues, tries, dataset: `${after.dataFx}/${after.dataCues}`, errors: errors.length };
      rows.push(row); console.log(JSON.stringify(row)); if (row.fx <= 0) failed = true;   // a cast must draw; a skill with no sound rows is reported, not failed (cues is printed)
    }
    await page.screenshot({ path: path.join(out, `zone1-${a}-${b}.png`) }).catch(() => {});
    await page.context().close();
  }
  if (process.env.PIT !== '0') {
    const { page, errors } = await newPage('lunge', 'stomp');
    await page.goto(`${base}/?debug=1&fight=1`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('#attack-button'), null, { timeout: 120000 });
    await page.locator('#attack-button').tap();
    await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-label') === 'Light attack', null, { timeout: 120000 });
    const before = await counts(page); let after = before;
    for (let i = 0; i < 12 && after.fx === before.fx; i++) {
      await page.locator('#attack-button').tap().catch(() => {}); await page.waitForTimeout(600);
      await page.waitForFunction(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 30000 }).catch(() => {});
      await page.locator('#skill-button').tap().catch(() => {}); await page.waitForTimeout(3000); after = await counts(page);
    }
    const row = { page: 'pit', slot: 1, skill: 'lunge', fx: after.fx - before.fx, cues: after.cues - before.cues, dataset: `${after.dataFx}/${after.dataCues}`, errors: errors.length };
    rows.push(row); console.log(JSON.stringify(row)); if (after.fx < 0 || row.fx + row.cues <= 0) failed = true;
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
console.log('page   slot skill      fx  cues'); for (const r of rows) console.log(`${r.page.padEnd(6)} ${r.slot}    ${r.skill.padEnd(9)} ${String(r.fx).padStart(3)} ${String(r.cues).padStart(5)}`);
console.log(failed ? 'FAIL' : 'PASS'); process.exit(failed ? 1 : 0);
