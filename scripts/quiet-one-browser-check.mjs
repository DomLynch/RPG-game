// Real phone-size game UI: select a shipped finisher, win by normal controls, verify held clip and next-opponent reset.
// Time is the harness clock's (scripts/lib/harness-clock.mjs) from the first press on: every wait below is page time, so the
// scripted duel lands on the same ticks on a loaded MacBook and on a software-GL CI runner (the real-time version hung in
// locator.tap on ubuntu-latest — the freewheeling frame loop starved input). Boot and journal setup stay on real time.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server=process.env.QA_URL ? null : await preview({preview:{host:'127.0.0.1',port:0}});
const origin=process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const opponent=process.argv.includes('--opponent') ? process.argv[process.argv.indexOf('--opponent')+1] : 'veteran';
const url=new URL(`/?opponent=${opponent}&debug=1`,origin).href, finisher=process.argv.includes('--finisher') ? process.argv[process.argv.indexOf('--finisher')+1] : 'quietOne';
const dir=process.env.QUIET_RECEIPT_DIR || `artifacts/finishers/${finisher === 'opened' ? 'opened' : finisher==='decapitation' ? 'decapitation' : 'quiet-one'}/${opponent==='veteran' ? 'ui' : opponent+'/ui'}`; await fs.mkdir(dir,{recursive:true});
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
// 1× pixel density: this gate asserts clips, health and blood receipts, not pixels, and a software-GL runner renders every harness frame.
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(15000);
const errors=[]; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
try {
await page.goto(url);
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
await page.getByRole('button', { name: 'Enter the arena' }).tap();
await page.waitForFunction(() => document.querySelector('#welcome').hidden);
await page.getByRole('button', {name:'Menu and field journal'}).tap();
await page.locator('label[for=journal-tab-settings]').tap();   // the finisher picker sits under Test tools on the Settings tab
await page.locator('#finisher-select').selectOption(finisher);
await page.getByRole('button', {name:'Close journal'}).tap();

const clips = async () => (await page.locator('#debug').getAttribute('data-clips')) ?? '';
await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
const { run, until } = await harnessClock(page); await run(200);   // a few harness frames after the journal closes before the first press
// The draw goes through the keyboard (F = strike; sheathed, a strike is the draw): on ubuntu-latest a Playwright tap issued under the
// paused clock never reached the simulation (the counter check's afterDraw receipt shows the button still reading "Draw sword"),
// while key presses — which this script already uses for movement, guard and step — land. Same request path in the game.
// Probe for the runner (lead + finishers, 2026-09-21): the game's frame loop measures elapsed = rAF timestamp − last, where `last`
// was read from the real performance.now() before the clock was installed. If the fake rAF timestamp lives in a different range
// from the jumped performance.now(), one frame of hugely negative elapsed sinks the accumulator and the simulation stands still
// while frames keep rendering — the "tick never moves, fps 63" stall. Record what the page actually sees.
const probe = async () => {
  await page.evaluate(() => { window.__raf = []; const tick = t => { window.__raf.push([Math.round(t), Math.round(performance.now())]); if (window.__raf.length < 6) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await run(16 * 6);
  return page.evaluate(() => ({ raf: window.__raf, perfNow: Math.round(performance.now()), dateNow: Date.now(), journalOpen: document.querySelector('#journal')?.open, message: document.querySelector('#message')?.textContent, tick: document.querySelector('#debug')?.textContent?.match(/tick (\d+)/)?.[1] }));
};
console.log('clock probe before draw', JSON.stringify(await probe()));
const draw = async () => {
  await page.keyboard.press('KeyF'); await run(16);
  try { await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000); }
  catch (error) { console.log('draw diagnostics', JSON.stringify({ ...(await probe()), ...(await page.evaluate(() => ({ attack: document.querySelector('#attack-button')?.textContent, attackDisabled: document.querySelector('#attack-button')?.getAttribute('aria-disabled'), status: document.querySelector('#combat-status')?.textContent, debug: document.querySelector('#debug')?.textContent?.slice(0, 200), visibility: document.visibilityState }))) })); throw error; }
};

let splitReceipt, headReceipt, lootTiming, lootFraming;
async function fight(name) {
  // A real duel against the live warden: the AI is seeded per match, so the scripted player wins most duels, not every one.
  // Up to three duels; a lost or timed-out one is rematched in place (no win → no next-rung reload) and fought again.
  // The kill assertion below is unchanged — a real UI duel must kill the opponent.
  let killed = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
  await draw();
  console.log('difficulty',await page.locator('#difficulty').textContent(), 'attempt', attempt);

  let elapsed = 0;   // page time spent in this duel; the budget is page time, never wall time
  const step = async ms => { await run(ms); elapsed += ms; };

  while (elapsed < 90000) {
    const state=await page.evaluate(()=>({text:document.querySelector('#debug').textContent,hp:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value,light:document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',thrust:document.querySelector('#thrust-button').getAttribute('aria-disabled')==='false'}));
    // Under the paused clock a Playwright tap must never wait for a control to enable — time only moves when this loop moves it.
    const enabled = async id => (await page.locator('#'+id).getAttribute('aria-disabled')) === 'false';
    if(!state.hp || !state.enemy)break;
    const distance=+(state.text.match(/gap ([\d.]+)/)?.[1] ?? Infinity);
    const lines=state.text.split('warden:')[1]?.split('\n') ?? [], attack=lines[1]?.match(/([a-z_]+)\+? (\d+)\/(\d+) ([·#|\-]+)/);
    const stamina=+(state.text.match(/you: hp \d+ st (\d+)/)?.[1] ?? 0);
    const punish=+(state.text.split('warden:')[0].match(/punish (\d+)/)?.[1] ?? 0);
    if(punish>0 && state.light && stamina>=22 && distance<2) {
      await page.keyboard.press('KeyF');await step(200);continue;   // keys, not taps: no actionability wait under the paused clock, and tick-exact
    }
    if(attack) {
      const age=+attack[2],windup=attack[4].indexOf('#');
      if(attack[1]==='kick' && distance<1.35) {
        await page.keyboard.down('KeyS');await step(250);await page.keyboard.up('KeyS');continue;
      }
      // Parry, not block: a guard TAP whose press lands a few ticks before contact (the game's "tap just before impact to
      // parry"), then the riposte. A held 180 ms guard was a block — chip damage, no counter — and the warden read the
      // predictable pattern (habits "parry 13/16"): the veteran duel was a coin flip. Under the harness clock the tap is
      // tick-exact: step one frame at a time while the attack is in flight, press at contact − 3 ticks, release 3 ticks later.
      if(windup>=0 && age<windup && distance<2.6) {
        if(age<windup-3) { await step(16); continue; }
        await page.keyboard.down('KeyQ');await step(48);await page.keyboard.up('KeyQ');
        for(let k=0;k<6;k++){ if(await enabled('thrust-button')){ await page.keyboard.press('KeyT'); await step(180); break; } await step(16); }   // the riposte, as soon as the sim accepts it
        continue;
      }
      // Pressure: a thrust into the recovery keeps the warden engaged (parry-only play stalled the duel out of its budget).
      if(age>windup+8 && state.thrust && stamina>45 && distance<1.65) {
        await page.keyboard.press('KeyT');await step(180);continue;
      }
    }
    // Close inside the short knife's range so the Goblin can offer a punishable attack.
    if(distance>(opponent==='goblin' ? 1.1 : 1.55)) {
      await page.keyboard.down('KeyW');await step(80);await page.keyboard.up('KeyW');continue;
    }
    await step(40);
  }
  if (await page.locator('#target-health').evaluate(e => +e.value) === 0) { killed = true; break; }
  if (attempt === 3) break;
  console.log(`duel ${attempt} did not kill (page time ${elapsed} ms) — rematch\n`, await page.locator('#debug').textContent());
  // The faded endgame row is inert (pointer-events: none) until the ceremony completes (#506), so a tap there does nothing and
  // the wait below times out: tap only once Rematch is shown and the fade has lifted.
  await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 20000);
  await page.locator('#reset-button').tap();
  await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 20000);
  }
  console.log('end state',await page.locator('#debug').textContent());
  // Exhausting the rematch budget is a FAILURE, never a pass: the receipt names it as such.
  assert.ok(killed, `real UI duel must kill the opponent — three duels fought, none killed (opponent ${opponent}, finisher ${finisher})`);
  assert.equal(await page.locator('#target-health').evaluate(e => e.value),0,'real UI duel must kill the opponent');
  // Finisher-complete gate (Lead brief 2026-09-22; Dom on the phone: "I have never seen the decapitation land"). The loot panel
  // used to open on the Killed event, over the ceremony. It now opens on the scene's own finisher-complete latch
  // (src/scene.ts finishPhase().complete — the victim's clip has run out, the camera has settled, a severed head has come to
  // rest — consumed by src/main.ts updateHud). Sampled here on a REAL win with THIS finisher selected: closed at the kill,
  // open once the latch fires, and nothing about the panel's geometry touched. Never a timer on either side.
  const lootState = async () => page.evaluate(() => ({ on: document.getElementById('loot-panel')?.getAttribute('data-on'), phase: JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null') }));
  const atKill = await lootState();
  assert.notEqual(atKill.on, '1', `the loot panel must not open over the ${finisher} ceremony (open at ${atKill.phase?.age} s, complete=${atKill.phase?.complete})`);
  assert.equal(atKill.phase?.complete, false, 'and the ceremony cannot have finished playing that soon after the kill');
  assert.ok(await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p?.complete; }, 12000), 'the finisher-complete latch fires within 12 s of the kill');
  await run(60);
  const atComplete = await lootState();
  assert.equal(atComplete.on, '1', 'the loot panel opens once the ceremony has finished playing');
  lootTiming = { finisher, atKillAge: atKill.phase?.age ?? null, completeAt: atComplete.phase?.completeAt ?? null, openAtKill: atKill.on === '1' };
  // Kill-camera framing, MEASURED, not yet gated (Lead brief 2026-09-22: the body must sit above the bottom 40 % of a
  // 375x812 phone frame through the whole loot beat — Dom sees the sheet and the corpse together or the finisher is wasted).
  // This records where the fallen body actually lands at the moment the panel opens, per finisher, so the camera change that
  // follows is designed against real numbers instead of a guess. It asserts NOTHING yet on purpose: the acceptance line goes
  // in with the camera fix, and a gate written before the measurement would only be encoding today's framing as correct.
  lootFraming = await page.evaluate(() => {
    const rect = JSON.parse(document.querySelector('#debug').dataset.fallenRect || 'null');
    const panel = document.getElementById('loot-panel');
    const box = panel && !panel.hidden ? (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(panel.getBoundingClientRect()) : null;
    return { fallen: rect, panel: box, viewport: [innerWidth, innerHeight], line: innerHeight * 0.6 };
  });
  if (lootFraming.fallen) {
    const { fallen, line, viewport } = lootFraming;
    lootFraming.bodyBottom = fallen.y + fallen.h;
    lootFraming.clearsLine = lootFraming.bodyBottom <= line;
    lootFraming.overshoot = +(lootFraming.bodyBottom - line).toFixed(1);
    console.log(`  ${finisher} framing at the loot beat: body bottom ${lootFraming.bodyBottom.toFixed(0)} px, the 40 % line at ${line.toFixed(0)} px on ${viewport[0]}x${viewport[1]} — ${lootFraming.clearsLine ? 'clears' : `${lootFraming.overshoot} px below it`}`);
  } else console.log(`  ${finisher} framing at the loot beat: no fallen rect (body behind the camera or rigs not in)`);
  console.log(`${name} loot: panel closed ${atKill.phase?.age?.toFixed?.(2)} s after the kill, open at the ${finisher} complete latch (${atComplete.phase?.completeAt?.toFixed?.(2)} s)`);
  await run(300);
  console.log(`${name} kill — clips at reset: "${await clips()}"`);
  await page.screenshot({ path: `${dir}/live-${name}.png` });
  await run(2200);
  if(finisher==='opened' && ['wraith','minotaur'].includes(opponent)) {
    splitReceipt=JSON.parse(await page.locator('#debug').getAttribute('data-blood')).opened;
    assert.equal(splitReceipt?.visible,true,'selected Opened separates the creature');
    assert.equal(splitReceipt.pieces.length,2);
    assert.ok(splitReceipt.pieces.every(p=>p.visible && p.opacity>.75),'both creature halves visibly survive the split beat');
    await page.screenshot({path:`${dir}/live-split.png`});
  }
  if(finisher==='decapitation') {
    headReceipt=JSON.parse(await page.locator('#debug').getAttribute('data-blood')).head;
    assert.ok(headReceipt?.visible && headReceipt.screen,'detached head is visible in the actual public duel');
    assert.ok(headReceipt.screen[0]>5 && headReceipt.screen[0]<385 && headReceipt.screen[1]>20 && headReceipt.screen[1]<700,'head remains above portrait controls');
    await page.screenshot({path:`${dir}/live-head.png`});
  }
  await run(1200);
  await page.screenshot({ path: `${dir}/live-${name}-settled.png` });
  console.log(`${name} settled — clips: "${await clips()}"`);
}

await fight('counter-duel');
const expected = finisher === 'opened' ? /Opened:WaistCut/ : finisher === 'decapitation' ? /Death_SplitCrown:Death_SplitCrown/ : /Death_QuietOne:Death_QuietOne/;
assert.match(await clips(), expected); assert.deepEqual(errors,[]);
const receipt={url,finisher,opponent,splitReceipt,headReceipt,lootTiming,lootFraming,revision:process.env.QA_URL ? await page.request.get(new URL('/release.json',url).href).then(r=>r.json()) : null,physicalPhone:false,clips:await clips(),errors,passed:true};
await run(5000);
assert.match(await clips(), expected, 'finisher stays held after the death window');
if(process.argv.includes('--blood-check')) {
  receipt.blood=JSON.parse(await page.locator('#debug').getAttribute('data-blood'));
  assert.equal(receipt.blood.kind,finisher);assert.equal(receipt.blood.visible,true);
  assert.ok(receipt.blood.emitted>150 && receipt.blood.landed>100 && receipt.blood.pools.some(p=>p.radius>.35),'public UI finish leaves substantial blood at its wounds');
  assert.equal(receipt.blood.airborne,0,'held scene has no endless spray');
  if(finisher==='opened' && ['wraith','minotaur'].includes(opponent)) {
    assert.equal(receipt.blood.opened.pieces.length,2);
    assert.ok(receipt.blood.opened.pieces.every(p=>p.visible===(opponent!=='wraith')),'only Wraith halves disappear after the hold');
  }
}
await page.addStyleTag({content:'#debug{visibility:hidden}'});
await page.screenshot({path:`${dir}/live-held.png`});
// Blood is red only (owner 2026-09-20): the journal's blood toggle is gone, so the dark/off cycling that used to run under
// --blood-check is retired; the finisher's own blood assertions above still run under the same flag.

// Rematch after a WIN loads the next rung as a fresh document (main.ts reset-button → location.reload). page.clock survives
// the navigation: the new document boots with the fake clock already installed and paused, so nothing rAF-driven runs in it
// until the gate advances time (the real-time script never had a clock, which is why it needed no care here). Boot itself —
// asset fetches, the ready flag — is promise-driven and completes on real time; only then is the new document stepped with
// run()/until() like the old one. An in-place rematch (last rung, no reload) needs no boot wait. Same predicate either way.
const rematchPredicate = ()=>document.querySelector('#art-status').textContent==='' && document.querySelector('#target-health').value>0 && document.querySelector('#debug').dataset.clips?.includes('@SwordDrawn') && !/Opened:WaistCut|Death_QuietOne:Death_QuietOne|Death_SplitCrown:Death_SplitCrown/.test(document.querySelector('#debug').dataset.clips);
// End-of-fight HUD (#380): Rematch is inert while :root.endgame-fade is on (until the finisher camera settles, and again while
// the arena-cam tour orbits the fallen). A player's first touch lands on the arena and stops the tour (main.ts canvas pointerdown
// -> view.stopTour()); do the same, then let the HUD come back before tapping Rematch.
await page.locator('canvas').tap({ position: { x: 190, y: 300 } });
await until(() => !document.documentElement.classList.contains('endgame-fade'), 10000);
await run(300);   // the 250 ms opacity transition
const navigated = page.waitForEvent('framenavigated', { timeout: 3000 }).then(() => true, () => false);
await page.locator('#reset-button').tap();
if (await navigated) {
  for (let i = 0; i < 450; i++) {   // ≤ 90 s real time for the next rung's rigs to arrive
    const ready = await page.evaluate(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
}
await until(rematchPredicate, 20000);
assert.doesNotMatch(await clips(), expected, 'rematch clears the finisher');
receipt.rematchClips = await clips();
if(process.argv.includes('--blood-check')) {receipt.rematchBlood=JSON.parse(await page.locator('#debug').getAttribute('data-blood'));assert.equal(receipt.rematchBlood.visible,false);assert.equal(receipt.rematchBlood.pools.length,0);}
await fs.writeFile(`${dir}/live-ui.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally {await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
