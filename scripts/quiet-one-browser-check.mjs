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
for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Warden: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
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
const draw = async () => {
  await page.keyboard.press('KeyF'); await run(16);
  try { await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000); }
  catch (error) { console.log('draw diagnostics', JSON.stringify(await page.evaluate(() => ({ attack: document.querySelector('#attack-button')?.textContent, attackDisabled: document.querySelector('#attack-button')?.getAttribute('aria-disabled'), status: document.querySelector('#combat-status')?.textContent, debug: document.querySelector('#debug')?.textContent?.slice(0, 160), visibility: document.visibilityState })))); throw error; }
};

let splitReceipt, headReceipt;
async function fight(name) {
  await draw();
  console.log('difficulty',await page.locator('#difficulty').textContent());

  let elapsed = 0;   // page time spent in this duel; the budget is page time, never wall time
  const step = async ms => { await run(ms); elapsed += ms; };

  while (elapsed < 90000) {
    const state=await page.evaluate(()=>({text:document.querySelector('#debug').textContent,hp:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value,light:document.querySelector('#attack-button').getAttribute('aria-disabled')==='false'}));
    if(!state.hp || !state.enemy)break;
    const distance=+(state.text.match(/gap ([\d.]+)/)?.[1] ?? Infinity);
    const lines=state.text.split('warden:')[1]?.split('\n') ?? [], attack=lines[1]?.match(/([a-z_]+)\+? (\d+)\/(\d+) ([·#|\-]+)/);
    const stamina=+(state.text.match(/you: hp \d+ st (\d+)/)?.[1] ?? 0);
    const punish=+(state.text.split('warden:')[0].match(/punish (\d+)/)?.[1] ?? 0);
    if(punish>0 && state.light && stamina>=22 && distance<2) {
      await page.locator('#attack-button').tap();await step(200);continue;
    }
    if(attack) {
      const age=+attack[2],windup=attack[4].indexOf('#');
      if(attack[1]==='kick' && distance<1.35) {
        await page.keyboard.down('KeyS');await step(250);await page.keyboard.up('KeyS');continue;
      }
      if(windup>=0 && age>=windup-7 && age<windup+5 && distance<2.6) {
        await page.keyboard.down('KeyQ');await step(180);await page.keyboard.up('KeyQ');continue;
      }
      if(age>windup+8 && state.light && stamina>45 && distance<1.65) {
        await page.locator('#thrust-button').tap();await step(180);continue;
      }
    }
    // Close inside the short knife's range so the Goblin can offer a punishable attack.
    if(distance>(opponent==='goblin' ? 1.1 : 1.55)) {
      await page.keyboard.down('KeyW');await step(80);await page.keyboard.up('KeyW');continue;
    }
    await step(40);
  }
  console.log('end state',await page.locator('#debug').textContent());
  assert.equal(await page.locator('#target-health').evaluate(e => e.value),0,'real UI duel must kill the opponent');
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
const receipt={url,finisher,opponent,splitReceipt,headReceipt,revision:process.env.QA_URL ? await page.request.get(new URL('/release.json',url).href).then(r=>r.json()) : null,physicalPhone:false,clips:await clips(),errors,passed:true};
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

await page.locator('#reset-button').tap();
await until(()=>document.querySelector('#art-status').textContent==='' && document.querySelector('#target-health').value>0 && document.querySelector('#debug').dataset.clips?.includes('@SwordDrawn') && !/Opened:WaistCut|Death_QuietOne:Death_QuietOne|Death_SplitCrown:Death_SplitCrown/.test(document.querySelector('#debug').dataset.clips), 20000);
assert.doesNotMatch(await clips(), expected, 'rematch clears the finisher');
receipt.rematchClips = await clips();
if(process.argv.includes('--blood-check')) {receipt.rematchBlood=JSON.parse(await page.locator('#debug').getAttribute('data-blood'));assert.equal(receipt.rematchBlood.visible,false);assert.equal(receipt.rematchBlood.pools.length,0);}
await fs.writeFile(`${dir}/live-ui.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally {await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
