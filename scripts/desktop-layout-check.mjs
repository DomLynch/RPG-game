// Desktop layout rows (Dom via Strategy via Lead, 2026-09-26): the key screens at a desktop size must not OVERLAP or CLIP. Live example
// this catches: at 1024 px the "Make yourself known" intro card was drawn over the HUD. One viewport per row (`--viewport 1280x800`);
// the gate runs 1280x800 and 1440x900. Screens, in the order a player meets them: the intro card, the journal's four tabs (opened from
// the intro), the arena HUD, the kill screen with the loot panel (a real UI win over the Goblin on easy, loot-smoke-check's bot), and
// Sparring (its link). For every screen each listed element that is VISIBLE must lie inside the viewport (clipping) and no two listed
// elements may intersect (overlap) unless the pair is in ALLOWED with the reason. Stills of every screen are the receipt.
// DESKTOP_REPORT=1 asserts nothing and prints every intersection and clip it finds (for choosing what a new design allows).
import { chromium } from 'playwright';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
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
  journal: ['#journal', '#journal .tab-strip', '#journal .tab-pane:visible', '#journal .tab-pane:visible h4', '#nav-arena'],
  hud: [...CHROME, '.combat-hud', '#actions', '#actions > button:visible'],
  kill: [...CHROME, '.combat-hud', '#actions', '#reset-button', '#pit-button', '#duel-button', '#share-link', '#clip-button', '#loot-panel', '#loot-panel-actions', '#loot-decline', '#loot-panel-pieces'],
  sparring: [...CHROME, '.combat-hud', '#actions', '#spar-change', '#spar-leave', '#replay-banner'],
  // The versus card while the rigs download (Lead 2026-09-28, desktop pass): the phone card as a centred 9:16 column (.versus-frame).
  versus: ['.versus-frame', '#versus-still', '.versus-caption', '#versus-portrait', '.versus-legend small', '.versus-legend p', '.versus-loading'],
};
// Pairs that overlap by design, with why. Everything else that intersects fails.
const ALLOWED = [
  ['#actions', '#actions > button:visible', 'the buttons sit inside their own box'],
  ['#actions', '#reset-button', 'Next is in the actions box'], ['#actions', '#pit-button', 'the Pit\'s door is in the actions box, under Next (Web 2026-09-29)'], ['#actions', '#duel-button', 'DUEL is in the actions box with LINK and CLIP (a grid item on a desktop; Web 2026-10-02, fix-forward for run 2fef800d)'], ['#actions', '#share-link', 'SHARE is in the actions box (thumb row)'], ['#actions', '#clip-button', 'CLIP is in the actions box (thumb row)'],
  ['#actions', '#spar-change', 'in the actions box'], ['#actions', '#spar-leave', 'in the actions box'],
  ['#loot-panel', '#loot-panel-pieces', 'the tiles are inside the panel'], ['#actions', '#loot-panel-actions', 'the loot actions are in the actions box'], ['#loot-panel-actions', '#loot-decline', 'Leave it is inside the loot actions'],
  ['#journal', '#journal .tab-strip', 'inside the dialog'], ['#journal', '#journal .tab-pane:visible', 'inside the dialog'], ['#journal', '#journal .tab-pane:visible h4', 'inside the dialog'], ['#journal', '#nav-arena', 'inside the dialog'],
  ['#journal .tab-pane:visible', '#journal .tab-pane:visible h4', 'the heading is inside its pane'],
  ['header', 'aside.identity', 'the identity card is part of the header'],
  ['.combat-hud', '#loot-panel', 'the loot panel is a child of the HUD section (index.html), so the HUD box grows around it'], ['.combat-hud', '#loot-panel-pieces', 'the tiles are inside the loot panel, inside the HUD section'],
  ['#actions', '#loot-decline', 'Leave sits in the loot actions, in the actions box'],
  ['.versus-frame', '#versus-still', 'the card is its still'], ['.versus-frame', '.versus-caption', 'on the card'], ['.versus-frame', '#versus-portrait', 'on the card'],
  ['.versus-frame', '.versus-legend small', 'on the card'], ['.versus-frame', '.versus-legend p', 'on the card'], ['.versus-frame', '.versus-loading', 'on the card'],
  ['#versus-still', '.versus-caption', 'the caption is drawn on the still'], ['#versus-still', '#versus-portrait', 'the face is drawn on the still'], ['.versus-caption', '#versus-portrait', 'the face sits in the caption row'],
  ['#versus-still', '.versus-legend small', 'drawn on the still'], ['#versus-still', '.versus-legend p', 'drawn on the still'], ['#versus-still', '.versus-loading', 'drawn on the still'],
];
const allowed = (a, b) => ALLOWED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(90000);
// A desktop has a mouse. Headless Chromium can answer (pointer:coarse), which dresses the page as a phone (touch grid, phone header):
// emulate the fine pointer so the run is the desktop layout. `--pointer coarse` keeps the default for comparison.
if (arg('--pointer', 'fine') === 'fine') await (await page.context().newCDPSession(page)).send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'fine' }, { name: 'hover', value: 'hover' }, { name: 'any-pointer', value: 'fine' }, { name: 'any-hover', value: 'hover' }] });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const t0 = Date.now(); const trace = process.env.DESKTOP_TRACE === '1' ? (m) => console.error(`[trace ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`) : () => {};
page.on('framenavigated', f => trace('framenavigated ' + f.url()));
await page.route('**/*sentry.io/**', route => route.abort());
const receipt = { origin, viewport: { width, height }, screens: {}, faults: [], errors, passed: false };
const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
// Two painted frames before a screen is measured. Once the harness clock is installed (from the duel on) requestAnimationFrame only
// fires when the clock advances, so a rAF promise would wait forever: from then on the frames come from run(). The clock persists
// across navigations, so the sparring page is measured through run() too.
let clockRun = null;
const paint = () => clockRun ? clockRun(48) : page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
// A control a player must click has to RECEIVE the click: the element under its centre must be the control itself (a fixed box drawn
// later in the DOM, like the footer over the intro card's lower half, wins the hit test and swallows the tap). A covered control is a
// fault; the run then fires the click on the element itself so the later screens are still measured.
async function tap(name, selector, screenName) {
  const covered = await page.evaluate((selector) => {
    const el = document.querySelector(selector); const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit && (hit === el || el.contains(hit)) ? null : `${hit?.tagName}${hit?.id ? '#' + hit.id : ''}${hit?.className ? '.' + String(hit.className).split(' ')[0] : ''} at ${JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })}`;
  }, selector);
  if (covered) {
    const fault = `${screenName}: "${name}" (${selector}) is covered by ${covered}: the click never reaches it`;
    receipt.faults.push(fault); receipt.screens[screenName]?.faults.push(fault); console.log('  ' + fault);
    await page.locator(selector).dispatchEvent('click');
  } else await page.locator(selector).click();
}
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
  await tap('Journal', '#journal-button', 'intro'); await page.waitForSelector('#journal[open]');
  for (const tab of ['profile', 'fighter', 'arena', 'settings']) {
    await page.evaluate((tab) => { document.getElementById(`journal-tab-${tab}`).checked = true; document.getElementById(`journal-tab-${tab}`).dispatchEvent(new Event('change', { bubbles: true })); }, tab);
    await screen('journal'); receipt.screens[`journal-${tab}`] = receipt.screens.journal; await fs.rename(`${dir}/journal.png`, `${dir}/journal-${tab}.png`);
  }
  delete receipt.screens.journal;
  await page.locator('#nav-arena').click(); await page.waitForFunction(() => !document.querySelector('#journal').open);
  // First-visit name card removed (Dom 2026-09-30): the arena is already live, so the guest is named through Rename (the same card and the same
  // persist as before), which also stores the profile the reload below reads.
  await page.evaluate(() => document.getElementById('name-button').click());
  await tap('Enter the arena', '#name-form button', 'intro');
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  // The arena on easy (the bot below needs it), then the HUD. Level 6 is the rank's own level: the guest the card just named moves to 5
  // career marks (career.ts levelOf: level 6) and the page reloads on them (the live level pick is retired, Dom 2026-09-29).
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('frankendom.fighter.v1')); localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ ...p, career: { victoryMarks: 5 } })); });
  await page.reload(); await ready();
  await screen('hud');
  // A real win over the Goblin (scripts/loot-smoke-check.mjs's bot, verbatim) for the kill screen and the loot panel. The duel is fought
  // at phone size: headless Chromium draws each frame in software, and a 1280x800 frame costs ~2.5 s of wall time per 200 ms of page
  // time (measured 2026-09-27: the 90 s duel budget ran for three hours at desktop size). The kill screen is measured back at the
  // desktop viewport, after the resize has laid the page out again; the fight itself is keyboard-driven and size-blind. Even at phone
  // size the duel outran the 30 min job cap on the CI runner (run 36324591308: hud at 3 min, cancelled 26 min into the duel), so the
  // duel and the post-kill waits run with the WebGL draws skipped (skipDraws): same sim and DOM, no painting. Draws come back before
  // the kill screen is measured.
  const { run, until } = await harnessClock(page); clockRun = run; await run(200);
  await page.setViewportSize({ width: 390, height: 844 }); await skipDraws(page, true); await run(64);
  let killed = false;
  for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
    await page.keyboard.press('KeyF'); await run(16);
    await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000);
    let elapsed = 0;
    trace(`duel attempt ${attempt}`);
    const step = async ms => { await run(ms); elapsed += ms; if (elapsed % 2000 < ms) trace(`elapsed ${elapsed}`); };
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
    trace(`attempt ${attempt} over at ${elapsed}: killed=${killed} ` + JSON.stringify(await page.evaluate(() => ({ hp: document.querySelector('#player-health').value, enemy: document.querySelector('#target-health').value, reset: document.querySelector('#reset-button').hidden }))));
    if (killed) break;
    await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 20000);
    trace('reset visible, clicking'); await page.locator('#reset-button').click(); trace('reset clicked');
    await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 20000);
  }
  assert.ok(killed, 'a real UI duel must kill the Goblin: three duels fought, none killed');
  console.log(`duel: the Goblin killed, ${Math.round((Date.now() - t0) / 1000)} s wall since the start`);
  await page.setViewportSize({ width, height }); await run(64);
  const state = () => page.evaluate(() => ({ now: Math.round(performance.now()), lootOn: document.getElementById('loot-panel')?.getAttribute('data-on'), resetHidden: document.querySelector('#reset-button').hidden, fade: document.documentElement.classList.contains('endgame-fade'), hp: document.querySelector('#player-health').value, enemy: document.querySelector('#target-health').value }));
  trace('after kill ' + JSON.stringify(await state()));
  const cap = setTimeout(async () => { trace('WALL CAP 120 s in the post-kill waits: ' + JSON.stringify(await state().catch(e => String(e)))); }, 120000);
  trace('run(16) probe'); await run(16); trace('run(16) ok');
  await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 15000); trace('loot panel on ' + JSON.stringify(await state()));
  await until(() => !document.querySelector('#reset-button').hidden, 20000); trace('reset visible');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('reset-button')).opacity === '1', null, { timeout: 5000 }).catch(() => {}); trace('reset opaque or 5 s'); clearTimeout(cap);
  await skipDraws(page, false);   // the kill still is a painted frame (screen() steps 48 ms first)
  await screen('kill');
  // The win surfaces (Lead 2026-09-28, desktop pass): the fallen legend's medallion beside "You beat <legend>", the take title whole
  // inside the viewport, and a real click at the centre of SHARE, CLIP, Next and the Pit's door landing on that control.
  const win = await page.evaluate(() => {
    const inside = r => r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    const status = document.querySelector('#combat-status'), title = document.querySelector('#loot-panel-name');
    const hits = ['duel-button', 'share-link', 'clip-button', 'reset-button', 'pit-button'].map(id => {
      const r = document.getElementById(id).getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id, ok: !!at?.closest('#' + id), hit: at ? at.id || at.tagName : null };
    });
    return { face: status.dataset.face === 'true', faceInside: inside(status.getBoundingClientRect()),
      title: title.textContent, titleWhole: inside(title.getBoundingClientRect()) && title.scrollWidth <= title.clientWidth, hits };
  });
  receipt.win = win;
  if (!win.face || !win.faceInside) receipt.faults.push(`kill: the legend's medallion is missing or clipped: ${JSON.stringify(win)}`);
  if (!win.title || !win.titleWhole) receipt.faults.push(`kill: the take title "${win.title}" is missing or clipped`);
  for (const h of win.hits) if (!h.ok) receipt.faults.push(`kill: a click at the centre of #${h.id} lands on ${h.hit}`);
  console.log(`win surfaces: medallion ${win.face}, title "${win.title}" whole ${win.titleWhole}, hits ${win.hits.map(h => `${h.id} ${h.ok}`).join(', ')}`);
  // Sparring, from its link (sparring.ts sparringLink): the two spar controls in the actions box, the banner clear of the HUD.
  await page.goto(new URL('/?opponent=veteran&spar=1&weapon=longsword&difficulty=5&skill=none&debug=1', origin).href);
  for (let i = 0; i < 450; i++) { if (await page.evaluate(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false)) break; await new Promise(r => setTimeout(r, 200)); }
  await screen('sparring');
  // The versus card (Lead 2026-09-28): held up by rigs that never arrive (every .glb hangs), on the guest this run already made. On desktop
  // it is the phone card as a centred 9:16 column; the side bands still pass clicks through (.versus pointer-events: none since d35797c3),
  // so a click there must reach no fight control and start nothing, and the header's Journal and Sound must still take the click.
  const versusStart = Date.now();   // the release row's cost of this screen, in the receipt and the log
  await page.route('**/*.glb', () => {});
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href);
  await page.waitForFunction(() => !document.querySelector('#versus').hidden, null, { timeout: 30000 });
  await screen('versus');
  const band = await page.evaluate(() => {
    const frame = document.querySelector('.versus-frame').getBoundingClientRect(), x = Math.round(frame.x / 2), y = Math.round(innerHeight / 2);
    const hit = document.elementFromPoint(x, y);
    return { x, y, column: { x: Math.round(frame.x), w: Math.round(frame.width) }, hit: `${hit?.tagName}${hit?.id ? '#' + hit.id : ''}`, control: !!hit?.closest('#actions, #joystick, button:not(#journal-button):not(#sound-button)') };
  });
  receipt.versusBand = band;
  if (band.column.x > 0) {
    if (band.control) receipt.faults.push(`versus: a click on the side band at ${band.x},${band.y} lands on a fight control (${band.hit})`);
    await page.mouse.click(band.x, band.y);
    const after = await page.evaluate(() => ({ up: !document.querySelector('#versus').hidden, attack: document.querySelector('#attack-button').getAttribute('aria-disabled') }));
    if (!after.up || after.attack !== 'true') receipt.faults.push(`versus: a click on the side band changed the fight: ${JSON.stringify(after)}`);
    for (const id of ['journal-button', 'sound-button']) {
      const reach = await page.evaluate((id) => { const el = document.getElementById(id), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === el || el.contains(hit)); }, id);
      if (!reach) receipt.faults.push(`versus: #${id} does not take a click while the card is up`);
    }
  } else receipt.faults.push(`versus: the card is not a centred column at ${width}x${height}: ${JSON.stringify(band.column)}`);
  await page.unroute('**/*.glb');
  receipt.versusSeconds = Math.round((Date.now() - versusStart) / 100) / 10; console.log(`versus screen: ${receipt.versusSeconds} s`);
  if (!report) { assert.deepEqual(receipt.faults, [], `${receipt.faults.length} layout fault(s) at ${width}x${height}:\n${receipt.faults.join('\n')}`); assert.deepEqual(errors, []); }
  receipt.passed = receipt.faults.length === 0 && errors.length === 0;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`desktop-layout-check ${width}x${height}: ${receipt.passed ? 'PASS' : 'FAIL'} (${receipt.faults.length} faults, ${errors.length} errors), stills in ${dir}`);
