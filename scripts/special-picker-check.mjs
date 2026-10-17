// The SPECIAL 1 / SPECIAL 2 picker at a phone (Web, Dom 2026-10-17; Combat's specialPick row, special-equip.ts): ☰ > Stats > Specials opens a dialog listing the picks in the row's order with the row's role lines and the skill rows' names,
// one SPECIAL 1 and one SPECIAL 2 button per entry. Walks: the list equals the row (ids, order, roles, names; none invented); Equip SPECIAL 1 keeps the pick (frankendom.special.slots.v1) and marks it; the same skill in SPECIAL 2 MOVES it
// (never in both); a second press clears; the summary line says what each slot holds; no control under 44 px, off screen, text clipped or horizontal scroll, at 375 and 320. Stills: <OUT>/pick-*.png.
// Serves this tree's build (`npx vite build` first). Usage: OUT=<dir> node scripts/special-picker-check.mjs [--engine webkit]; PIT_GL=1 = the browser's own GL (the VPS).
import fs from 'node:fs/promises';
import { chromium, devices, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { preview } from 'vite';
if (!process.env.BASE_URL && !existsSync(new URL('../dist/index.html', import.meta.url))) execFileSync('npx', ['vite', 'build'], { stdio: 'inherit', timeout: 600_000 });   // serves this tree's build, made here when missing

const out = process.env.OUT || 'artifacts/special-picker'; await fs.mkdir(out, { recursive: true });
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const read = async (f) => JSON.parse(await fs.readFile(new URL(`../${f}`, import.meta.url), 'utf8'));
const CUT = (await read('src/core/career-rules.json')).betaCut[0], NAMES = Object.fromEntries((await read('src/fight/skill-defs.json')).skills.map((s) => [s.id, s.name]));
const PICK = CUT.specialPick, ROLES = CUT.specialRoles, KEY = 'frankendom.special.slots.v1';
const server = process.env.BASE_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });   // BASE_URL=https://frankendom.com checks the LIVE site (no local build)
const origin = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : `http://127.0.0.1:${server.httpServer.address().port}`;
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
async function open(w, h) {
  const context = await browser.newContext(ENGINE === 'webkit' ? { ...devices['iPhone 15'], viewport: { width: w, height: h } } : { viewport: { width: w, height: h }, isMobile: true, hasTouch: true });   // WebKit runs as the iPhone 15 profile (touch, Safari UA) at the checked widths
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => { if (!/Fetch API cannot load/.test(String(e))) fails.push(`${w}: ${String(e).slice(0, 160)}`); });   // WebKit logs blob fetch errors after any page.reload() on trunk too (not the picker)
  await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('#welcome')?.hidden); await page.waitForTimeout(1500);   // ?. : on the live site #welcome was null once mid-load (WebKit); keep polling instead of throwing
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600); await page.locator('#journal .tab-fighter').click({ force: true }); await page.waitForTimeout(300);
  await page.locator('#special-open').click({ force: true });
  await page.waitForFunction(() => document.getElementById('special-dialog').open);
  return { context, page };
}
const layout = (page, name) => page.evaluate((n) => {
  const d = document.getElementById('special-dialog'), vw = innerWidth, bad = [];
  for (const e of d.querySelectorAll('button')) { const r = e.getBoundingClientRect(); if (r.width && (r.height < 44 || r.width < 44 || r.right > vw + 1 || r.left < -1)) bad.push(`${e.className} ${Math.round(r.width)}x${Math.round(r.height)}`); }
  const clipped = [...d.querySelectorAll('b, span, p, h3')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 20));
  return { bad: bad.map((b) => `${n}: ${b}`), clipped, hscroll: d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > vw + 1 };
}, name);
const stored = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
try {
  for (const [name, w, h] of [['phone', 375, 812], ['small', 320, 568]]) {
    const { context, page } = await open(w, h);
    const entries = await page.locator('#special-dialog .grimoire-entry').evaluateAll((es) => es.map((e) => ({ id: e.dataset.skill, name: e.querySelector('.grimoire-name')?.textContent, role: e.querySelector('.grimoire-sub')?.textContent, buttons: e.querySelectorAll('.grimoire-equip').length })));
    check(entries.map((e) => e.id).join() === PICK.join(), `${name}: the list is the specialPick row in its order (${entries.map((e) => e.id)} vs ${PICK})`);
    check(entries.every((e) => e.role === ROLES[e.id] && e.name === NAMES[e.id] && e.buttons === 2), `${name}: each entry carries its row's role line, its skill row's name and two slot buttons (${JSON.stringify(entries)})`);
    check(/SPECIAL 1: empty · SPECIAL 2: empty/.test(await page.locator('#special-dialog .grimoire-count').textContent()), `${name}: both slots start empty`);
    await page.screenshot({ path: `${out}/pick-${name}-empty.png` });
    const [a, b] = PICK, one = (id) => page.locator(`#special-dialog .grimoire-entry[data-skill="${id}"] .grimoire-equip[data-slot="1"]`), two = (id) => page.locator(`#special-dialog .grimoire-entry[data-skill="${id}"] .grimoire-equip[data-slot="2"]`);
    await one(a).click({ force: true });
    check(await one(a).getAttribute('aria-pressed') === 'true' && /In SPECIAL 1/.test(await one(a).textContent()), `${name}: Equip SPECIAL 1 marks ${a}`);
    check(await stored(page) === JSON.stringify([a, null]), `${name}: the pick is kept in slot 1 (${await stored(page)})`);
    await two(b).click({ force: true });
    check(await stored(page) === JSON.stringify([a, b]), `${name}: a second skill goes to slot 2 (${await stored(page)})`);
    check(new RegExp(`SPECIAL 1: ${NAMES[a]} · SPECIAL 2: ${NAMES[b]}`).test(await page.locator('#special-dialog .grimoire-count').textContent()), `${name}: the summary names both picks`);
    await page.screenshot({ path: `${out}/pick-${name}-both.png` });
    await two(a).click({ force: true });
    check(await stored(page) === JSON.stringify([null, a]), `${name}: the same skill in slot 2 MOVES it out of slot 1 (${await stored(page)})`);
    { const held = (JSON.parse(await stored(page)) ?? []).filter(Boolean); check(held.length === new Set(held).size, `${name}: no skill in both slots`); }
    await two(a).click({ force: true });
    check(await two(a).getAttribute('aria-pressed') === 'false', `${name}: a second press clears the slot`);
    const m = await layout(page, name); for (const bad of m.bad) check(false, `control too small or off screen: ${bad}`); check(!m.clipped.length, `${name}: text clipped: ${m.clipped}`); check(!m.hscroll, `${name}: horizontal scroll`);
    // both picks, then the fight: the HUD's SPECIAL 1 and SPECIAL 2 buttons are lit (Combat's wiring of the store into the Match ports; the Match reads them at begin(), so the page is reloaded and a fight started)
    await one(a).click({ force: true }); await two(b).click({ force: true });
    check(await stored(page) === JSON.stringify([a, b]), `${name}: both picks set before the fight (${await stored(page)})`);
    await page.locator('#special-dialog .grimoire-close').click({ force: true }); check(!(await page.locator('#special-dialog').evaluate((d) => d.open)), `${name}: the close button closes it`);
    if (name === 'phone') {
      await page.evaluate(() => localStorage.setItem('frankendom.firstloss.v1', '1'));   // the lesson is done: a fresh profile's first arena is the scripted first-loss LESSON, which never takes the picks (Combat: Match takes SPECIAL 2 only in career or practice mode)
      await page.reload(); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
      if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true });
      await page.waitForFunction(() => document.querySelector('#welcome')?.hidden ?? !!document.getElementById('skill-button')); await page.waitForTimeout(2500);   // after a reload the live page has no #welcome at all (returning player): the HUD being up is the signal
      await page.getByRole('button', { name: /^fight$/i }).first().click({ force: true, timeout: 5000 }).catch(() => {});   // the arena opens at the stance; the Match (and its skill2 port) begins when Fight is tapped
      await page.waitForTimeout(2500);
      const hud = await page.evaluate(() => ['skill-button', 'skill2-button'].map((id) => { const b = document.getElementById(id), r = b?.getBoundingClientRect(); return { id, hidden: !b || b.hidden || !r || r.width === 0, text: b?.textContent?.trim() ?? '', right: r?.right ?? 0 }; }));
      check(hud.every((h) => !h.hidden && h.text), `${name}: the fight HUD shows SPECIAL 1 and SPECIAL 2 lit (${JSON.stringify(hud)})`);
      check(hud[0].text === NAMES[a] && hud[1].text === NAMES[b], `${name}: and each button wears its pick's name (${hud.map((h) => h.text)} vs ${NAMES[a]} / ${NAMES[b]})`);
      await page.screenshot({ path: `${out}/pick-${name}-hud-both-lit.png` });
    }
    await context.close();
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)} @ ${(String(e.stack).split('\n').find((l) => l.includes('special-picker-check')) || '').trim()}`); }
finally { await browser.close(); await server?.close(); }
console.log(fails.length ? `special-picker-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `special-picker-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
