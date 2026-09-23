// Real touch input and passive combat/animation observations; no simulation overrides. Page time is the gate's after boot
// (scripts/lib/harness-clock.mjs), so the parry-then-counter presses land on the same ticks on any machine.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
// Three independent counters, each on a fresh page with its own arena boot. COUNTER_ONLY=<move> runs just one of them so CI
// can fan them out across runners (quality.yml); unset runs all three, which is what deploy.sh and .quality-gate.json do.
const COUNTERS=[['attack-button','slash_riposte','Attack',24],['thrust-button','riposte','Riposte',24],['heavy-button','heavy_riposte','Heavy',30]];
const only=(process.env.COUNTER_ONLY||'').trim();
const selected=only?COUNTERS.filter(([,move])=>move===only):COUNTERS;
// A typo must fail the gate, never pass it by running nothing.
if(!selected.length) throw new Error(`COUNTER_ONLY=${only} matches no counter; expected one of: ${COUNTERS.map(([,m])=>m).join(', ')}`);
const server=process.env.QA_URL?null:await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url=new URL(process.env.QA_URL||`http://127.0.0.1:${server.httpServer.address().port}`);url.searchParams.set('debug','1');
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const receipt={url:url.href,physicalPhone:false,only:only||null,counters:[],errors:[]};
const dir='artifacts/weapons/counter-buttons';await fs.mkdir(dir,{recursive:true});
try {
 for(const [button,move,clip,damage] of selected) {
  // 1× pixel density: this gate asserts events, clips and health, not pixels, and software-GL runners render every harness frame.
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>receipt.errors.push(String(e)));await page.route('**/*sentry.io/**',r=>r.abort());
  await page.goto(url.href);await page.getByRole('button',{name:'Enter the arena'}).tap({timeout:120000});   // a load wait: the runner's first render compiles shaders on software GL
  await page.waitForFunction(()=>document.querySelector('#art-status').textContent===''&&document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});
  const {run,until}=await harnessClock(page);await run(200);   // a few harness frames after the arena opens before the first press
  await page.evaluate(()=>{
   window.__combat=[];window.__clips=[];window.__tellAt=0;
   window.addEventListener('frankendom:combat',e=>window.__combat.push(e.detail));
   const observer=new MutationObserver(()=>{if(document.querySelector('#combat-status').textContent.startsWith('Incoming strike')){window.__tellAt=performance.now();observer.disconnect();}});
   observer.observe(document.querySelector('#combat-status'),{childList:true});
   new MutationObserver(()=>window.__clips.push(document.querySelector('#debug').dataset.clips)).observe(document.querySelector('#debug'),{attributes:true,attributeFilter:['data-clips']});
  });
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:2,radiusY:2,force:1}]:[]});
  // Diagnosis for a runner where the fight never starts under harness time: what the page looks like right after the press and on failure.
  const diagnose=()=>page.evaluate(()=>({visibility:document.visibilityState,welcomeHidden:document.querySelector('#welcome')?.hidden,message:document.querySelector('#message')?.textContent,messageHidden:document.querySelector('#message')?.hidden,attack:document.querySelector('#attack-button')?.textContent,attackDisabled:document.querySelector('#attack-button')?.getAttribute('aria-disabled'),guard:document.querySelector('#guard-button')?.getAttribute('aria-disabled'),status:document.querySelector('#combat-status')?.textContent,debug:{...document.querySelector('#debug')?.dataset},performance:document.querySelector('#performance')?.textContent,combatEvents:window.__combat.length,lastTick:window.__combat.at(-1)?.tick??null,now:Math.round(performance.now())}));
  await page.getByRole('button',{name:'Draw sword',exact:true}).tap();
  receipt.afterDraw=await diagnose();
  try { await until(()=>document.querySelector('#guard-button').getAttribute('aria-disabled')==='false',20000); }
  catch(error){ receipt.onFailure=await diagnose(); receipt.error=String(error).slice(0,300); throw error; }
  const box=await page.locator('#guard-button').boundingBox();
  await until(()=>window.__tellAt>0&&performance.now()-window.__tellAt>=430,20000);
  // Directional guard: the parry must be on the side the blow arrives on — the mirror of the attack's direction (AttackStarted carries it);
  // a straight thrust needs no slide. Same rule as browser-check.mjs.
  const incoming=await page.evaluate(()=>{const e=[...window.__combat].reverse().flatMap(s=>s.events).find(e=>e.type==='AttackStarted'&&e.actor===1);return e?e.direction:null;});
  const side={right:'left',left:'right',overhead:'overhead',low:'low',thrust:null}[incoming]??null;
  const slide={left:{x:-30,y:0},right:{x:30,y:0},overhead:{x:0,y:-30},low:{x:0,y:30}}[side];
  receipt.parrySide={incoming,side};
  const centre={x:box.x+box.width/2,y:box.y+box.height/2};
  await touch('touchStart',centre);
  if(slide){await touch('touchMove',{x:centre.x+slide.x,y:centre.y+slide.y});}
  await until(()=>window.__combat.some(s=>s.events.some(e=>e.type==='Parried'&&e.actor===0)),1500);
  await touch('touchEnd');await page.locator('#'+button).tap();
  await until(move=>window.__combat.some(s=>s.events.some(e=>e.type==='Hit'&&e.actor===0&&e.move===move)),2000,move);
  const state=await page.evaluate(()=>({events:window.__combat.flatMap(s=>s.events),clips:window.__clips,health:document.querySelector('#target-health').value}));
  assert.ok(state.events.some(e=>e.type==='AttackStarted'&&e.actor===0&&e.move===move));
  const hit=state.events.find(e=>e.type==='Hit'&&e.actor===0&&e.move===move);assert.equal(hit.damage,damage);assert.equal(state.health,150-damage);
  assert.ok(state.clips.some(c=>c.startsWith(`${clip}:${clip}@SwordDrawn`)),`player must render ${clip}: ${state.clips}`);
  await page.screenshot({path:`${dir}/${move}.png`});receipt.counters.push({button,move,hit,clips:[...new Set(state.clips)]});await page.close();
 }
 assert.deepEqual(receipt.errors,[]);receipt.passed=true;
} finally {await fs.writeFile(`${dir}/browser.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));await browser.close();await server?.close();}
