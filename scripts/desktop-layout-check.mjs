// Desktop layout rows (Dom via Strategy via Lead, 2026-09-26): the key screens at a desktop size must not OVERLAP or CLIP. Live example
// this catches: at 1024 px the "Make yourself known" intro card was drawn over the HUD. One viewport per row (`--viewport 1280x800`);
// the gate runs 1280x800 and 1440x900. Screens, in the order a player meets them: the intro card, the journal's four tabs (opened from
// the intro), the arena HUD, the kill screen with the loot panel (a real UI win over the Goblin on easy, loot-smoke-check's bot), and
// Sparring (its link). For every screen each listed element that is VISIBLE must lie inside the viewport (clipping) and no two listed
// elements may intersect (overlap) unless the pair is in ALLOWED with the reason. Stills of every screen are the receipt.
// DESKTOP_REPORT=1 asserts nothing and prints every intersection and clip it finds (for choosing what a new design allows).
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import { intersects } from './lib/thumb-row.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const [width, height] = arg('--viewport', '1280x800').split('x').map(Number);
const report = process.env.DESKTOP_REPORT === '1';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = `${process.env.DESKTOP_RECEIPT_DIR || 'artifacts/desktop-layout'}/${width}x${height}`; await fs.mkdir(dir, { recursive: true });
// The page chrome every screen shows, then what each screen adds (the journal is a modal: its chrome sits behind the backdrop). Selectors are the live ids; a moved or renamed element fails here
// (the UI-move rule: grep scripts/ for the selector before touching it).
const CHROME = ['header', 'aside.identity', 'footer .instructions', '#message', '#performance', '#art-status'];
const SCREENS = {
  intro: [...CHROME, '#welcome', '.combat-hud', '#actions'],
  journal: ['#journal', '#journal .tab-strip', '#journal .tab-pane:visible', '#journal .tab-pane:visible h4', '#close-journal'],
  hud: [...CHROME, '.combat-hud', '#actions', '#actions > button:visible'],
  kill: [...CHROME, '.combat-hud', '#actions', '#reset-button', '#share-button', '#loot-panel', '#loot-panel-actions', '#loot-decline', '#loot-panel-pieces'],
  sparring: [...CHROME, '.combat-hud', '#actions', '#spar-change', '#spar-leave', '#replay-banner'],
};
// Pairs that overlap by design, with why. Everything else that intersects fails.
const ALLOWED = [
  ['#actions', '#actions > button:visible', 'the buttons sit inside their own box'],
  ['#actions', '#reset-button', 'Next is in the actions box'], ['#actions', '#share-button', 'SHARE is in the actions box (thumb row)'],
  ['#actions', '#spar-change', 'in the actions box'], ['#actions', '#spar-leave', 'in the actions box'],
  ['#loot-panel', '#loot-panel-pieces', 'the tiles are inside the panel'], ['#actions', '#loot-panel-actions', 'the loot actions are in the actions box'], ['#loot-panel-actions', '#loot-decline', 'Leave it is inside the loot actions'],
  ['#journal', '#journal .tab-strip', 'inside the dialog'], ['#journal', '#journal .tab-pane:visible', 'inside the dialog'], ['#journal', '#journal .tab-pane:visible h4', 'inside the dialog'], ['#journal', '#close-journal', 'inside the dialog'],
  ['#journal .tab-pane:visible', '#journal .tab-pane:visible h4', 'the heading is inside its pane'],
  ['header', 'aside.identity', 'the identity card is part of the header'],
];
const allowed = (a, b) => ALLOWED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(90000);
// A desktop has a mouse. Headless Chromium can answer (pointer:coarse), which dresses the page as a phone (touch grid, phone header):
// emulate the fine pointer so the run is the desktop layout. `--pointer coarse` keeps the default for comparison.
if (arg('--pointer', 'fine') === 'fine') await (await page.context().newCDPSession(page)).send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'fine' }, { name: 'hover', value: 'hover' }, { name: 'any-pointer', value: 'fine' }, { name: 'any-hover', value: 'hover' }] });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
const receipt = { origin, viewport: { width, height }, screens: {}, faults: [], errors, passed: false };
const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
const paint = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
// Boxes of the visible listed elements. `:visible` selectors match the shown one of a set (the checked tab's pane, the buttons not hidden).
// An element inside a scrolling ancestor (the journal dialog scrolls at max-height 88dvh) is reachable, so it is never 'clipped'.
const boxes = (selectors) => page.evaluate(({ selectors, width, height }) => {
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return !el.hidden && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0; };
  const out = {};
  for (const sel of selectors) {
    // `A:visible B` = the visible A elements, then B inside each (':visible' is not a CSS selector, so split there).
    const [head, rest] = sel.split(':visible');
    let els = [...document.querySelectorAll(head)].filter(visible);
    if (rest !== undefined && rest.trim()) els = els.flatMap((el) => [...el.querySelectorAll(rest.trim())]).filter(visible);
    if (!els.length) continue;
    const scrollsIn = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if ((o === 'auto' || o === 'scroll') && a.scrollHeight > a.clientHeight + 1) return true; } return false; };
    out[sel] = els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, scrolls: scrollsIn(el), text: (el.textContent || '').trim().slice(0, 30) }; });
  }
  return { out, viewport: { x: 0, y: 0, w: width, h: height } };
}, { selectors, width, height });
const inside = (r, v) => r.x >= -1 && r.y >= -1 && r.x + r.w <= v.w + 1 && r.y + r.h <= v.h + 1;
async function screen(name) {
  await paint();
  const { out, viewport } = await boxes(SCREENS[name]);
  await page.screenshot({ path: `${dir}/${name}.png` });
  const faults = [];
  const entries = Object.entries(out);
  for (const [sel, rects] of entries) for (const r of rects) if (!r.scrolls && !inside(r, viewport)) faults.push(`${name}: ${sel} "${r.text}" is clipped by the viewport: ${JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h })}`);
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const [a, ra] = entries[i], [b, rb] = entries[j];
    if (allowed(a, b)) continue;
    for (const x of ra) for (const y of rb) if (intersects(x, y)) faults.push(`${name}: ${a} "${x.text}" overlaps ${b} "${y.text}": ${JSON.stringify([x, y].map(({ x, y, w, h }) => ({ x, y, w, h })))}`);
  }
  // Buttons inside one box: the buttons of #actions must each be inside #actions (else they float over the arena).
  if (out['#actions'] && out['#actions > button:visible']) for (const b of out['#actions > button:visible']) if (!inside({ ...b, x: b.x - out['#actions'][0].x, y: b.y - out['#actions'][0].y }, { w: out['#actions'][0].w, h: out['#actions'][0].h })) faults.push(`${name}: #actions button "${b.text}" floats outside the actions box`);
  receipt.screens[name] = { elements: Object.fromEntries(entries.map(([k, v]) => [k, v.map(({ x, y, w, h }) => ({ x, y, w, h }))])), faults };
  receipt.faults.push(...faults);
  console.log(`${name}: ${entries.length} elements, ${faults.length} fault(s)`); for (const f of faults) console.log('  ' + f);
}
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href); await ready();
  await screen('intro');
  // The journal, tab by tab, from the intro card.
  await page.locator('#journal-button').click(); await page.waitForSelector('#journal[open]');
  for (const tab of ['profile', 'fighter', 'arena', 'settings']) {
    await page.evaluate((tab) => { document.getElementById(`journal-tab-${tab}`).checked = true; document.getElementById(`journal-tab-${tab}`).dispatchEvent(new Event('change', { bubbles: true })); }, tab);
    await screen('journal'); receipt.screens[`journal-${tab}`] = receipt.screens.journal; await fs.rename(`${dir}/journal.png`, `${dir}/journal-${tab}.png`);
  }
  delete receipt.screens.journal;
  await page.locator('#close-journal').click(); await page.waitForFunction(() => !document.querySelector('#journal').open);
  // The arena on easy (the bot below needs it), then the HUD.
  for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
  await page.getByRole('button', { name: 'Enter the arena' }).click();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  await screen('hud');
  // A real win over the Goblin (scripts/loot-smoke-check.mjs's bot, verbatim) for the kill screen and the loot panel.
  const { run, until } = await harnessClock(page); await run(200);
  let killed = false;
  for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
    await page.keyboard.press('KeyF'); await run(16);
    await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000);
    let elapsed = 0;
    const step = async ms => { await run(ms); elapsed += ms; };
    const enabled = async id => (await page.locator('#' + id).getAttribute('aria-disabled')) === 'false';
    while (elapsed < 90000) {
      const state = await page.evaluate(() => ({ text: document.querySelector('#debug').textContent, hp: document.querySelector('#player-health').value, enemy: document.querySelector('#target-health').value, light: document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', thrust: document.querySelector('#thrust-button').getAttribute('aria-disabled') === 'false' }));
      if (!state.hp || !state.enemy) break;
      const distance = +(state.text.match(/gap ([\d.]+)/)?.[1] ?? Infinity);
      const attack = (state.text.split('warden:')[1]?.split('\n') ?? [])[1]?.match(/([a-z_]+)\+? (\d+)\/(\d+) ([·#|\-]+)/);
      const stamina = +(state.text.match(/you: hp \d+ st (\d+)/)?.[1] ?? 0), punish = +(state.text.split('warden:')[0].match(/punish (\d+)/)?.[1] ?? 0);
      if (punish > 0 && state.light && stamina >= 22 && distance < 2) { await page.keyboard.press('KeyF'); await step(200); continue; }
      if (attack) {
        const age = +attack[2], windup = attack[4].indexOf('#');
        if (attack[1] === 'kick' && distance < 1.35) { await page.keyboard.down('KeyS'); await step(250); await page.keyboard.up('KeyS'); continue; }
        if (windup >= 0 && age < windup && distance < 2.6) {
          if (age < windup - 3) { await step(16); continue; }
          await page.keyboard.down('KeyQ'); await step(48); await page.keyboard.up('KeyQ');
          for (let k = 0; k < 6; k++) { if (await enabled('thrust-button')) { await page.keyboard.press('KeyT'); await step(180); break; } await step(16); }
          continue;
        }
        if (age > windup + 8 && state.thrust && stamina > 45 && distance < 1.65) { await page.keyboard.press('KeyT'); await step(180); continue; }
      }
      if (distance > 1.9) { await page.keyboard.down('KeyW'); await step(100); await page.keyboard.up('KeyW'); continue; }
      if (state.light && stamina >= 22) { await page.keyboard.press('KeyF'); await step(260); continue; }
      await step(100);
    }
    killed = await page.evaluate(() => document.querySelector('#target-health').value === 0 && document.querySelector('#player-health').value > 0);
    if (killed) break;
    await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 20000);
    await page.locator('#reset-button').click();
    await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 20000);
  }
  assert.ok(killed, 'a real UI duel must kill the Goblin: three duels fought, none killed');
  await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 15000);
  await until(() => !document.querySelector('#reset-button').hidden, 20000);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('reset-button')).opacity === '1', null, { timeout: 5000 }).catch(() => {});
  await screen('kill');
  // Sparring, from its link (sparring.ts sparringLink): the two spar controls in the actions box, the banner clear of the HUD.
  await page.goto(new URL('/?opponent=veteran&spar=1&weapon=longsword&difficulty=easy&skill=none&debug=1', origin).href);
  for (let i = 0; i < 450; i++) { if (await page.evaluate(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false)) break; await new Promise(r => setTimeout(r, 200)); }
  await screen('sparring');
  if (!report) { assert.deepEqual(receipt.faults, [], `${receipt.faults.length} layout fault(s) at ${width}x${height}:\n${receipt.faults.join('\n')}`); assert.deepEqual(errors, []); }
  receipt.passed = receipt.faults.length === 0 && errors.length === 0;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`desktop-layout-check ${width}x${height}: ${receipt.passed ? 'PASS' : 'FAIL'} (${receipt.faults.length} faults, ${errors.length} errors), stills in ${dir}`);
