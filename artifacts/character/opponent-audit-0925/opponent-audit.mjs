// Opponent audit (Lead, 2026-09-25, SCOPE #729 item 4): for each live rung at 375x812 on the deployed site, a front still and a
// from-behind still in a real fight (touch HUD hidden), then an easy-mode duel won through the real UI and the kill-screen take panel.
// Run from ~/Developer/frankendom-char. QA_URL = site (default https://frankendom.com); AUDIT_ONLY=veteran,goblin narrows the rungs.
// The duel is loot-smoke-check.mjs's goblin win, generalised; a rung the bot cannot kill in three duels is recorded, never faked.
const REPO = '/Users/domininclynch/Developer/frankendom-char';
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { harnessClock } = await import(`${REPO}/scripts/lib/harness-clock.mjs`);
const { ENCOUNTERS } = await import(`${REPO}/src/roster.ts`);
import fs from 'node:fs/promises';

const origin = process.env.QA_URL || 'https://frankendom.com', dir = process.env.AUDIT_DIR || `${REPO}/artifacts/character/opponent-audit-0925`;
const only = process.env.AUDIT_ONLY?.split(',');
const rungs = ENCOUNTERS.filter(o => !o.hold).map(o => o.id).filter(id => !only || only.includes(id));
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
console.log('chrome pid', browser.process?.()?.pid ?? '(no handle)');
const revision = await fetch(new URL('/release.json', origin)).then(r => r.json()).catch(() => ({ revision: process.env.AUDIT_REVISION ?? 'local preview', source: 'local' }));
const receiptPath = `${dir}/receipt.json`;
const receipt = await fs.readFile(receiptPath, 'utf8').then(JSON.parse).catch(() => ({ origin, viewport: '375x812', rungs: [] }));
receipt.revision = revision;
const TAG = String(revision.revision ?? 'local').slice(0, 8) + '-' + (process.env.AUDIT_TIER ? `t${process.env.AUDIT_TIER}-` : ''), MODE = process.env.AUDIT_MODE ?? 'full', EQUIP = process.env.AUDIT_EQUIP;
const HIDE = '#actions,#joystick,#debug,footer{visibility:hidden!important}';

async function audit(id) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const row = { id, errors: [], stills: {} };
  page.on('pageerror', e => row.errors.push(String(e)));
  await page.route('**/*sentry.io/**', route => route.abort());
  let run = () => Promise.resolve(), until;
  const shot = async name => {
    const style = await page.addStyleTag({ content: HIDE });
    await run(50);
    await page.screenshot({ path: `${dir}/${TAG}${id}-${name}.jpg`, type: 'jpeg', quality: 88 });
    await style.evaluate(s => s.remove());
    row.stills[name] = `${TAG}${id}-${name}.jpg`;
  };
  try {
    await page.goto(new URL(`/?opponent=${id}&debug=1`, origin).href);
    await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 150000 });
    if (EQUIP) {   // AUDIT_EQUIP=<opponent>: the player wears that opponent's six (worn-loot-check.mjs's seeding), then a reload
      const equipped = { head: `${EQUIP}.Helmet`, chest: `${EQUIP}.Body`, arms: `${EQUIP}.Arms`, hands: `${EQUIP}.Gloves`, legs: `${EQUIP}.Greaves`, feet: `${EQUIP}.Boots` };
      // AUDIT_TIER=<1..10>: each piece's taken rung (Provenance.tier; #705's takenTier grades a worn piece by it, trunk ignores it)
      const tier = Number(process.env.AUDIT_TIER) || undefined, day = new Date().toISOString().slice(0, 10);
      const taken = tier ? Object.fromEntries(Object.values(equipped).map(id => [id, { opponent: EQUIP, attempt: 1, healthLeft: 1, recordId: null, day, tier }])) : undefined;
      await page.evaluate(([equipped, taken]) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: Object.values(equipped), equipped, ...(taken ? { taken } : {}) }; localStorage.setItem(key, JSON.stringify(p)); }, [equipped, taken]);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 150000 });
      row.equipped = equipped;
    }
    for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
    await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 150000 });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    if (!await page.evaluate(() => document.querySelector('#welcome').hidden)) await page.getByRole('button', { name: 'Enter the arena' }).tap();   // a reload (AUDIT_EQUIP) skips the welcome
    await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    ({ run, until } = await harnessClock(page));
    await run(200);
    const gap = () => page.evaluate(() => +(document.querySelector('#debug').textContent.match(/gap ([\d.]+)/)?.[1] ?? Infinity));
    await page.keyboard.press('KeyF'); await run(600);   // sheathed: the first strike is the draw
    if (EQUIP) { await until(() => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).length >= 6, 30000).catch(() => {}); row.worn = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []); }
    if (MODE === 'hud') { await run(1500); await page.addStyleTag({ content: '#debug{visibility:hidden!important}' }); await run(50); await page.screenshot({ path: `${dir}/${TAG}${id}-hud.jpg`, type: 'jpeg', quality: 88 }); row.stills.hud = `${TAG}${id}-hud.jpg`; await context.close(); return row; }
    if (MODE === 'contact') {   // close to contact, then stills 3 s and 4 s after the draw (page time)
      let t = 600; for (let i = 0; i < 60 && await gap() > 1.2; i++) { await page.keyboard.down('KeyW'); await run(80); await page.keyboard.up('KeyW'); t += 80; }
      row.contactGap = await gap();
      if (t < 3000) await run(3000 - t); await shot('contact-3s'); await run(1000); await shot('contact-4s');
      await context.close(); return row;
    }
    for (let i = 0; i < 40 && await gap() > 3.2; i++) { await page.keyboard.down('KeyW'); await run(80); await page.keyboard.up('KeyW'); }
    await run(300);
    row.frontGap = await gap();
    await shot('front');
    // The camera starts locked (main.ts `locked = true`): unlock, orbit ~180° with a drag (camera.ts orbit: yaw -= dx * 0.005, 628 px = π).
    const toggleLock = () => page.evaluate(() => document.getElementById('camera-button').click());
    await toggleLock();
    for (let i = 0; i < 2; i++) { await page.mouse.move(30, 420); await page.mouse.down(); await page.mouse.move(344, 420, { steps: 12 }); await page.mouse.up(); await run(32); }
    await run(120);
    await shot('behind');
    await toggleLock(); await page.keyboard.press('KeyR'); await run(300);   // lock again and recenter for the duel
    if (MODE === 'stills') { await context.close(); return row; }

    let killed = false;
    for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
      let elapsed = 0;
      const step = async ms => { await run(ms); elapsed += ms; };
      const enabled = async el => (await page.locator('#' + el).getAttribute('aria-disabled')) === 'false';
      while (elapsed < 120000) {
        const state = await page.evaluate(() => ({ text: document.querySelector('#debug').textContent, hp: document.querySelector('#player-health').value, enemy: document.querySelector('#target-health').value, light: document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', thrust: document.querySelector('#thrust-button')?.getAttribute('aria-disabled') === 'false' }));
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
        if (distance > 1.1) { await page.keyboard.down('KeyW'); await step(80); await page.keyboard.up('KeyW'); continue; }
        await step(40);
      }
      killed = await page.locator('#target-health').evaluate(e => +e.value === 0);
      row.duels = attempt;
      if (killed || attempt === 3) break;
      await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 30000);
      await page.locator('#reset-button').tap();
      await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 30000);
      await page.keyboard.press('KeyF'); await run(600);
    }
    row.killed = killed;
    if (killed) {
      await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 20000);
      await run(1500);   // the panel's thumbnails settle; no canvas tap (it times out under the paused clock, and the panel is already up)
      row.tiles = await page.locator('#loot-panel-pieces li').evaluateAll(lis => lis.map(li => ({ id: li.dataset.loot, owned: li.dataset.owned === 'true', label: li.textContent.trim(), disabled: !!li.querySelector('button[disabled]'), thumb: !!li.querySelector('img,canvas') })));
      await page.addStyleTag({ content: '#debug{visibility:hidden!important}' });
      await run(50);
      await page.screenshot({ path: `${dir}/${TAG}${id}-take.jpg`, type: 'jpeg', quality: 88 });
      row.stills.take = `${TAG}${id}-take.jpg`;
      if (MODE === 'skill') {   // AUDIT_MODE=skill: take the skill tile, then a fresh fight with it equipped: SKILL lit, then cast for real
        const tile = page.locator('#loot-panel-pieces li').filter({ hasText: process.env.AUDIT_SKILL ?? 'Witch-fire' }).locator('button');
        await tile.evaluate(b => b.click()); await run(600);
        row.skill = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')).loot?.skill ?? null);
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 150000 });
        if (!await page.evaluate(() => document.querySelector('#welcome').hidden)) await page.getByRole('button', { name: 'Enter the arena' }).tap();
        ({ run, until } = await harnessClock(page));
        await run(200); await page.keyboard.press('KeyF'); await run(900);
        await until(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') === 'false', 15000);
        for (let i = 0; i < 40 && await gap() > 2.2; i++) { await page.keyboard.down('KeyW'); await run(80); await page.keyboard.up('KeyW'); }
        await page.addStyleTag({ content: '#debug{visibility:hidden!important}' }); await run(50);
        row.skillLit = await page.locator('#skill-button').getAttribute('aria-disabled') === 'false';
        await page.screenshot({ path: `${dir}/${TAG}${id}-skill-lit.jpg`, type: 'jpeg', quality: 88 }); row.stills.skillLit = `${TAG}${id}-skill-lit.jpg`;
        await page.locator('#skill-button').dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0 });
        await run(120); await page.locator('#skill-button').dispatchEvent('pointerup', { pointerId: 1, isPrimary: true, button: 0 });
        await run(330);
        await page.screenshot({ path: `${dir}/${TAG}${id}-skill-cast.jpg`, type: 'jpeg', quality: 88 }); row.stills.skillCast = `${TAG}${id}-skill-cast.jpg`;
        await run(900);
        row.cast = await page.evaluate(() => document.querySelector('#debug').textContent.match(/you:[^\n]*\n[^\n]*/)?.[0] ?? '');
        row.skillAfter = await page.locator('#skill-button').getAttribute('aria-disabled');
      }
    }
  } catch (e) { row.failure = String(e).split('\n')[0]; await page.screenshot({ path: `${dir}/${TAG}${id}-failure.jpg`, type: 'jpeg', quality: 70 }).catch(() => {}); }
  await context.close();
  return row;
}

try {
  for (const id of rungs) {
    console.log('auditing', id);
    const row = await audit(id);
    receipt.rungs = receipt.rungs.filter(r => r.id !== id).concat(row);
    console.log(JSON.stringify({ id, killed: row.killed, duels: row.duels, tiles: row.tiles?.length, failure: row.failure, errors: row.errors.length }));
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 1));
  }
} finally { await browser.close(); }
