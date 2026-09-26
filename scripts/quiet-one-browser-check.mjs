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
const page = await (await browser.newContext({ viewport: (([width, height]) => ({ width, height }))((process.env.QUIET_VIEWPORT || '390x844').split('x').map(Number)), isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(15000);
// QUIET_DIFFICULTY=easy: the persisted difficulty (#834), set before boot, so the scripted player can reach a kill on a tougher opponent.
if (process.env.QUIET_DIFFICULTY) await page.addInitScript(d => { try { localStorage.setItem('frankendom.difficulty.v1', d); } catch { /* storage off */ } }, process.env.QUIET_DIFFICULTY);
const errors=[]; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
try {
await page.goto(url);
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
await page.getByRole('button', { name: 'Enter the arena' }).tap();
await page.waitForFunction(() => document.querySelector('#welcome').hidden);
await page.getByRole('button', {name:'Menu and field journal'}).tap();
await page.locator('label[for=journal-tab-arena]').tap();   // the finisher picker sits on the Options tab (#815 moved it out of Settings → Test tools)
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
  // Kill-camera framing at the loot beat: where the fallen body lands the moment the panel opens (logged, the 40 % line is
  // dropped); the gate is the overlap series below.
  lootFraming = await page.evaluate(() => {
    const rect = JSON.parse(document.querySelector('#debug').dataset.fallenRect || 'null');
    const panel = document.getElementById('loot-panel');
    const box = panel && !panel.hidden ? (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(panel.getBoundingClientRect()) : null;
    const buttons = document.querySelector('.loot-panel-actions'), bb = buttons?.getBoundingClientRect();
    return { fallen: rect, panel: box, buttons: bb && bb.width ? { x: bb.x, y: bb.y, w: bb.width, h: bb.height } : null, viewport: [innerWidth, innerHeight], line: innerHeight * 0.6 };
  });
  if (lootFraming.fallen) {
    const { fallen, line, viewport } = lootFraming;
    lootFraming.bodyBottom = fallen.y + fallen.h;
    lootFraming.clearsLine = lootFraming.bodyBottom <= line;
    lootFraming.overshoot = +(lootFraming.bodyBottom - line).toFixed(1);
    console.log(`  ${finisher} framing at the loot beat: body bottom ${lootFraming.bodyBottom.toFixed(0)} px, the 40 % line at ${line.toFixed(0)} px on ${viewport[0]}x${viewport[1]} — ${lootFraming.clearsLine ? 'clears' : `${lootFraming.overshoot} px below it`}`);
    await page.screenshot({ path: `${dir}/loot-beat-${name}.png` });
  } else console.log(`  ${finisher} framing at the loot beat: no fallen rect (body behind the camera or rigs not in)`);
  // Through the whole loot beat (Lead 2026-09-25: the body stays clear of the loot panel AND its Take/Decline buttons, measured boxes, not a
  // fixed line): the settle, the arena cam's blend-in and its first slow orbit all move the corpse, so sample the same three boxes over
  // 10 s of page time after the panel opens, in CSS px² of intersecting area.
  const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);
  lootFraming.beat = [];
  // Every 0.1 s for the first second (the corpse can still be falling as the panel opens), then every 0.5 s to 10 s.
  const times = [...Array.from({ length: 11 }, (_, i) => i * 100), ...Array.from({ length: 18 }, (_, i) => 1500 + i * 500)];
  for (const [i, t] of times.entries()) {
    if (i) await run(t - times[i - 1]);
    if (t === 5000 || t === 10000) await page.screenshot({ path: `${dir}/loot-beat-${name}-${t / 1000}s.png` });
    const s = await page.evaluate(() => {
      const box = (el) => { const r = el && !el.hidden ? el.getBoundingClientRect() : null; return r && r.width ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
      const d = document.querySelector('#debug').dataset, card = document.getElementById('loot-panel');
      return { fallen: JSON.parse(d.fallenRect || 'null'), marks: JSON.parse(d.fallenMarks || 'null'), on: card?.getAttribute('data-on') === '1', panel: box(card), buttons: box(document.querySelector('.loot-panel-actions')) };
    });
    // Which of the head, neck, chest and wound points sit inside the card while it shows (Strategy 2026-09-26: the card may sit over
    // the body, never over the head or a wound).
    const inside = (p, b) => !!(p && b && p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
    const covered = s.on && s.marks ? [...['head', 'neck', 'chest'].filter(k => inside(s.marks[k], s.panel)), ...s.marks.wounds.filter(w => inside(w, s.panel)).map((_, i) => `wound${i}`)] : [];
    lootFraming.beat.push({ t, on: s.on, marks: s.marks, covered, fallen: s.fallen, panel: s.on ? overlap(s.fallen, s.panel) : 0, buttons: s.on ? overlap(s.fallen, s.buttons) : 0 });
  }
  const worst = lootFraming.beat.reduce((w, s) => (s.panel + s.buttons > w.panel + w.buttons ? s : w));
  console.log(`  ${finisher} loot beat series (ms:panel px²/buttons px²): ${lootFraming.beat.map(s => `${s.t}:${s.panel}/${s.buttons}${s.fallen ? '' : '(unseen)'}`).join(' ')}`);
  console.log(`  ${finisher} loot card over head/neck/chest/wounds (ms:covered, card shown only): ${lootFraming.beat.map(s => `${s.t}:${s.on ? (s.covered.join('+') || '-') : 'off'}`).join(' ')}`);
  console.log(`  ${finisher} marks at t0: ${JSON.stringify(lootFraming.beat[0].marks)} card ${JSON.stringify(lootFraming.beat[0].on)}`);
  console.log(`  ${finisher} loot beat 0–10 s: worst overlap ${worst.panel} px² with the panel, ${worst.buttons} px² with its buttons (t ${worst.t} ms); body seen in ${lootFraming.beat.filter(s => s.fallen).length}/${lootFraming.beat.length} samples`);
  // Never over the Take/Leave buttons. Never over the panel, except a plain death's first 3.5 s (Strategy 2026-09-26, "an ordinary kill
  // stays ordinary": no finisher camera, so the corpse sits behind the killer, whose box top grazes the panel's bottom edge until
  // the arena cam moves; measured on the Goblin 1937.5 px² to 2 s, 0 from 3.5 s; the panel never covers the head or the wound).
  const gated = lootFraming.beat.filter(s => finisher !== 'plainDeath' || s.t >= 3500);
  assert.deepEqual(lootFraming.beat.filter(s => s.buttons > 0).map(s => s.t), [], 'the fallen body never overlaps the loot Take/Leave buttons');
  assert.deepEqual(gated.filter(s => s.panel > 0).map(s => s.t), [], `the fallen body stays clear of the loot panel (${finisher})`);
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
