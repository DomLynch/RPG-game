// Catalogue/guest migration integration: real built assets and persisted UI, no sim overrides.
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ROSTER } from '../src/roster.ts';
import { OPPONENTS, PLAYER_WEAPONS, opponentAt } from '../src/moves.ts';
import { PROPS } from '../src/arena-props.ts';
import { PHONE_LOOKS, rankLookFor } from '../src/rank-look.ts';
import { levelOf, tierAt } from '../src/grades.ts';
// The fighter rigs are the .glb responses that are not the arena's authored props (src/arena-props.ts) — those load on every page.
// This check exists to stop a page fetching FIGHTER RIGS it does not need ("fetch only hero and selected opponent" below).
// The arena's own GLBs are not rigs and never were: src/arena-props.ts's props have always been excluded, and guard.glb
// (Brief 13, the six lorarii on the walkway) is the same class of thing - one shared arena asset, fetched once after first
// paint, not per opponent. It is named explicitly rather than pattern-matched, so an unexpected rig still fails this check
// as loudly as before; its SIZE is governed where size belongs, by check-budget.mjs's own `guard` row.
// An opponent's own kit cut (Phase L, src/assets/loot/carriers-<opponent>.glb) is not a rig either: it is fetched with his rig, so he
// fights dressed, and its size is counted per fight by check-budget.mjs. It is held to the stricter rule here: at most one per page,
// and only the selected opponent's own.
// A rank look (src/rank-look.ts, /looks/<opponent>-L<n>.glb, #961) is not a rig either: it streams after first playable onto the loaded
// rig. Held to its own rule: an opponent with shipping looks fetches at most one, his own (the page waits for the stream to settle so a
// late one never lands on the next page); every other opponent fetches none.
// An opponent's rung kit (moves.ts opponentAt: the Centurion's gladius from Legionary) is a weapons/player equip file his page fetches with
// his rig when the weapon he fights at the page's level is not the one his body bakes (scene.ts). Not a rig either, and held to its own rule:
// exactly that fight's own kit, 200, and no kit at all for anyone whose fought weapon is baked. Its size is in check-budget.mjs's per-fight sum.
const ARENA_GLB=['guard'];
const isLook=u=>new URL(u).pathname.startsWith('/looks/');
const glbName=u=>new URL(u).pathname.split('/').at(-1);
const isCarrier=u=>{const name=glbName(u);return name.endsWith('.glb')&&name.startsWith('carriers-');};
const isShape=u=>new URL(u).pathname.startsWith('/weapons/shapes/');   // a painted per-rank weapon shape (src/weapon-shapes.ts): presentation, never kit or rig
const isKit=u=>{const name=glbName(u);return name.endsWith('.glb')&&!isShape(u)&&PLAYER_WEAPONS.some(w=>name.startsWith(w+'-'));};
const isRig=u=>{const name=glbName(u);return name.endsWith('.glb')&&!isLook(u)&&!isShape(u)&&!isCarrier(u)&&!isKit(u)&&!PROPS.some(p=>name.startsWith(p.id+'-'))&&!ARENA_GLB.some(id=>name.startsWith(id+'-'));};
const onlyOwnCarrier=(list,id)=>{assert.ok(list.length<=1,`at most one carriers cut per fight, got ${list.map(c=>glbName(c.url))}`);assert.ok(list.every(c=>glbName(c.url).startsWith(`carriers-${id}-`)&&c.status===200),`only ${id}'s own carriers cut: ${list.map(c=>glbName(c.url))}`);};
const onlyFoughtKit=async(page,list,id)=>{const level=Number(await page.evaluate(()=>document.querySelector('#difficulty-select').value));const fought=opponentAt(OPPONENTS[id],level).weapon,want=fought===ROSTER[id].weapon?[]:[fought];assert.deepEqual(list.map(k=>glbName(k.url).replace(/-[^-]+\.glb$/,'')),want,`${id} at level ${level} fetches only his own rung kit ${want.join()||'(none)'}`);assert.ok(list.every(k=>k.status===200));return {level,kit:want};};
const site=await serveDist(), url=site.url;
const browser=await launch();
const receipt={url,physicalPhone:false,opponents:[],errors:[]};
try {
 const {page}=await phonePage(browser,{errors:receipt.errors});
 const MARKS=12, rankLook=(id,phone=false)=>rankLookFor(id,levelOf(tierAt(MARKS)),phone);   // the look the seeded profile's rank streams (12 marks: Gladiator → L3)
 await page.addInitScript((marks)=>{
  if(!localStorage.getItem('frankendom.fighter.v1'))localStorage.setItem('frankendom.fighter.v1',JSON.stringify({version:1,id:'catalogue-guest-123',name:'Aldren',ladder:'pitborn',career:{victoryMarks:marks}}));
 },MARKS);
 let rigs=[],carriers=[],looks=[],kits=[];
 page.on('response',r=>{if(isKit(r.url()))kits.push({url:r.url(),status:r.status()});else if(isLook(r.url()))looks.push({url:r.url(),status:r.status()});else if(isRig(r.url()))rigs.push({url:r.url(),status:r.status()});else if(isCarrier(r.url()))carriers.push({url:r.url(),status:r.status()});});
 for(const {id} of ENCOUNTERS.filter(o=>!o.hold)) {   // the live rungs; held recipes are checked below as fallbacks, not as fights
  console.log('Checking roster:',id);
  rigs=[];carriers=[];looks=[];kits=[];
  // An opponent with phone-tier LODs (#1017) is checked on both tiers, forced so the host cannot pick (a Mac headless phone page is
  // phone tier, Linux CI is not): ?gfx=full must stream his full file, the ?gfx=phone page below his -phone file.
  // ?lookbake=off (Lead 2026-09-29, #1030 CI red on the Goblin): this row checks the look FILE (fetched, state 'on'), not the waist-cut bake.
  // #1025's pre-swap bake runs ≤ 6 ms a frame before the swap, so on a GPU-less runner (~0.5 s a frame) the Goblin's ~218 steps outlast the
  // 60 s wait; the bake has its own gate (rank-look-check row C). Both waits below (full and phone) share this target.
  const target=new URL(url);target.searchParams.set('opponent',id);target.searchParams.set('lookbake','off');if(PHONE_LOOKS.has(id))target.searchParams.set('gfx','full');
  await page.goto(target.href);
  await waitForGame(page,{art:true});
  // The shipping path (Lead, #961): his rank's look must go ON, never 'failed' with nothing fetched, or a broken look deploy would pass here.
  if(rankLook(id))await page.waitForFunction(()=>['on','failed'].includes(globalThis.__rankLook?.state()),null,{timeout:60000});
  const state=await page.evaluate(()=>({enemy:document.querySelector('#target-health').max,overflow:document.documentElement.scrollWidth>innerWidth,welcome:document.querySelector('#welcome').hidden}));
  assert.equal(state.enemy,OPPONENTS[id].health);assert.equal(state.overflow,false);assert.equal(state.welcome,true);
  assert.equal(rigs.length,2,'fetch only hero and selected opponent');assert.ok(rigs.every(r=>r.status===200));
  assert.ok(rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER[id].body+'-')));
  onlyOwnCarrier(carriers,id);
  const want=rankLook(id);
  if(want){assert.equal(await page.evaluate(()=>globalThis.__rankLook?.state()),'on',`${id}: his rank look goes on`);assert.deepEqual(looks.map(l=>[new URL(l.url).pathname,l.status]),[[want,200]],`${id}: exactly his rank's look, ${want}`);}
  else assert.deepEqual(looks.map(l=>glbName(l.url)),[],`${id}: no rank look`);
  const kit=await onlyFoughtKit(page,kits,id);
  receipt.opponents.push({id,...state,...kit,rigs:[...rigs],carriers:[...carriers],looks:[...looks],kits:[...kits]});
  if(PHONE_LOOKS.has(id)&&rankLook(id,true)){   // the same rank on the phone tier: exactly his -phone LOD, on
   looks=[];target.searchParams.set('gfx','phone');await page.goto(target.href);await waitForGame(page,{art:true});
   await page.waitForFunction(()=>['on','failed'].includes(globalThis.__rankLook?.state()),null,{timeout:60000});
   assert.equal(await page.evaluate(()=>globalThis.__rankLook?.state()),'on',`${id} phone: his rank look goes on`);
   assert.deepEqual(looks.map(l=>[new URL(l.url).pathname,l.status]),[[rankLook(id,true),200]],`${id} phone: exactly his rank's phone look, ${rankLook(id,true)}`);
   receipt.opponents.push({id,gfx:'phone',looks:[...looks]});
  }
 }
 // A held recipe (roster.ts `hold`) is not a fight: ?opponent=<held> falls back to the first rung, and the page fetches only the hero
 // and the Veteran — no creature GLB is in the bundle to fetch.
 for(const {id} of ENCOUNTERS.filter(o=>o.hold)) {
  console.log('Checking held recipe falls back:',id);
  rigs=[];carriers=[];kits=[];
  const target=new URL(url);target.searchParams.set('opponent',id);
  await page.goto(target.href);
  await waitForGame(page,{art:true});
  assert.equal(await page.evaluate(()=>document.querySelector('#target-health').max),OPPONENTS.veteran.health,`${id} is held: the first rung stands in`);
  assert.equal(rigs.length,2,'fetch only hero and the fallback opponent');assert.ok(rigs.every(r=>r.status===200));
  assert.ok(rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER.veteran.body+'-')),'the Veteran rig is fetched');
  assert.ok(!rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER[id].body+'-')),`${id}'s GLB is not fetched (held recipes are out of the bundle)`);
  onlyOwnCarrier(carriers,'veteran');
  await onlyFoughtKit(page,kits,'veteran');
  receipt.opponents.push({id,held:true,fallback:'veteran',rigs:[...rigs],carriers:[...carriers]});
 }
 // No URL override: the old profile's Pitborn rung survives. A player has no Opponent picker (Options → admin Sparring, Daily removed,
 // Dom 2026-09-29): the Sparring tab stays hidden, and an ?opponent= link fights that rung without moving the stored one.
 await page.goto(url);
 await waitForGame(page);
 assert.equal(await page.locator('#target-health').getAttribute('max'),'190');
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 assert.equal(await page.locator('#sparring-tab').isHidden(),true,'a player has no Sparring tab, so no Opponent picker');
 const goblin=new URL(url);goblin.searchParams.set('opponent','goblin');
 await page.goto(goblin.href);
 await page.waitForFunction(()=>document.querySelector('#target-health').max===120 && document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});
 const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('frankendom.fighter.v1')));
 assert.deepEqual([profile.id,profile.name,profile.career?.victoryMarks,profile.encounter??profile.ladder],['catalogue-guest-123','Aldren',12,'pitborn'],'identity and marks survive; the link does not move the rung');
 receipt.migration=profile;assert.deepEqual(receipt.errors,[]);receipt.passed=true;
 console.log(JSON.stringify(receipt,null,2));
} catch(error) { receipt.failure=String(error); throw error; } finally {
 await writeReceipt(process.env.ROSTER_RECEIPT || 'artifacts/roster-browser-check.json',receipt);
 await browser.close();await site.close();
}
