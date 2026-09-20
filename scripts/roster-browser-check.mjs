// Catalogue/guest migration integration: real built assets and persisted UI, no sim overrides.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ROSTER } from '../src/roster.ts';
import { OPPONENTS } from '../src/moves.ts';
const server=process.env.QA_URL ? null : await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url=process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const receipt={url,physicalPhone:false,opponents:[],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});page.setDefaultTimeout(12000);
 await page.route('**/*sentry.io/**',route=>route.abort());
 page.on('pageerror',e=>receipt.errors.push(String(e)));
 await page.addInitScript(()=>{
  if(!localStorage.getItem('frankendom.fighter.v1'))localStorage.setItem('frankendom.fighter.v1',JSON.stringify({version:1,id:'catalogue-guest-123',name:'Aldren',ladder:'pitborn',career:{victoryMarks:12}}));
 });
 let rigs=[];
 page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.glb'))rigs.push({url:r.url(),status:r.status()});});
 for(const {id} of ENCOUNTERS.filter(o=>!o.hold)) {   // the live rungs; held recipes are checked below as fallbacks, not as fights
  console.log('Checking roster:',id);
  rigs=[];
  const target=new URL(url);target.searchParams.set('opponent',id);
  await page.goto(target.href);
  await page.waitForFunction(()=>document.querySelector('#attack-button').getAttribute('aria-disabled')==='false' && document.querySelector('#art-status').textContent==='',null,{timeout:90000});
  const state=await page.evaluate(()=>({enemy:document.querySelector('#target-health').max,overflow:document.documentElement.scrollWidth>innerWidth,welcome:document.querySelector('#welcome').hidden}));
  assert.equal(state.enemy,OPPONENTS[id].health);assert.equal(state.overflow,false);assert.equal(state.welcome,true);
  assert.equal(rigs.length,2,'fetch only hero and selected opponent');assert.ok(rigs.every(r=>r.status===200));
  assert.ok(rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER[id].body+'-')));
  receipt.opponents.push({id,...state,rigs:[...rigs]});
 }
 // A held recipe (roster.ts `hold`) is not a fight: ?opponent=<held> falls back to the first rung, and the page fetches only the hero
 // and the Veteran — no creature GLB is in the bundle to fetch.
 for(const {id} of ENCOUNTERS.filter(o=>o.hold)) {
  console.log('Checking held recipe falls back:',id);
  rigs=[];
  const target=new URL(url);target.searchParams.set('opponent',id);
  await page.goto(target.href);
  await page.waitForFunction(()=>document.querySelector('#attack-button').getAttribute('aria-disabled')==='false' && document.querySelector('#art-status').textContent==='',null,{timeout:90000});
  assert.equal(await page.evaluate(()=>document.querySelector('#target-health').max),OPPONENTS.veteran.health,`${id} is held: the first rung stands in`);
  assert.equal(rigs.length,2,'fetch only hero and the fallback opponent');assert.ok(rigs.every(r=>r.status===200));
  assert.ok(rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER.veteran.body+'-')),'the Veteran rig is fetched');
  assert.ok(!rigs.some(r=>new URL(r.url).pathname.split('/').at(-1).startsWith(ROSTER[id].body+'-')),`${id}'s GLB is not fetched (held recipes are out of the bundle)`);
  receipt.opponents.push({id,held:true,fallback:'veteran',rigs:[...rigs]});
 }
 // No URL override: the old profile's Pitborn rung survives. Selecting another encounter
 // persists the migrated profile, preserving identity and independent career marks.
 await page.goto(url);
 await page.waitForFunction(()=>document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});
 assert.equal(await page.locator('#target-health').getAttribute('max'),'190');
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 await page.locator('#opponent-select').selectOption('goblin');
 await page.waitForFunction(()=>document.querySelector('#target-health').max===120 && document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});
 const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('frankendom.fighter.v1')));
 assert.deepEqual(profile,{version:1,id:'catalogue-guest-123',name:'Aldren',encounter:'goblin',career:{victoryMarks:12},ladder:'goblin'});
 receipt.migration=profile;assert.deepEqual(receipt.errors,[]);receipt.passed=true;
 console.log(JSON.stringify(receipt,null,2));
} catch(error) { receipt.failure=String(error); throw error; } finally {
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(process.env.ROSTER_RECEIPT || 'artifacts/roster-browser-check.json',JSON.stringify(receipt,null,2));
 await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}
