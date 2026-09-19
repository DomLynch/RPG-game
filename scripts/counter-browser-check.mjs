// Real touch input and passive combat/animation observations; no simulation overrides.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=process.env.QA_URL?null:await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url=new URL(process.env.QA_URL||`http://127.0.0.1:${server.httpServer.address().port}`);url.searchParams.set('debug','1');
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const receipt={url:url.href,physicalPhone:false,counters:[],errors:[]};
const dir='artifacts/weapons/counter-buttons';await fs.mkdir(dir,{recursive:true});
try {
 for(const [button,move,clip,damage] of [['attack-button','slash_riposte','Attack',24],['thrust-button','riposte','Riposte',24],['heavy-button','heavy_riposte','Heavy',30]]) {
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  page.on('pageerror',e=>receipt.errors.push(String(e)));await page.route('**/*sentry.io/**',r=>r.abort());
  await page.goto(url.href);await page.getByRole('button',{name:'Enter the arena'}).tap();
  await page.waitForFunction(()=>document.querySelector('#art-status').textContent===''&&document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});
  await page.evaluate(()=>{
   window.__combat=[];window.__clips=[];window.__tellAt=0;
   window.addEventListener('frankendom:combat',e=>window.__combat.push(e.detail));
   const observer=new MutationObserver(()=>{if(document.querySelector('#combat-status').textContent.startsWith('Incoming strike')){window.__tellAt=performance.now();observer.disconnect();}});
   observer.observe(document.querySelector('#combat-status'),{childList:true});
   new MutationObserver(()=>window.__clips.push(document.querySelector('#debug').dataset.clips)).observe(document.querySelector('#debug'),{attributes:true,attributeFilter:['data-clips']});
  });
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:2,radiusY:2,force:1}]:[]});
  await page.getByRole('button',{name:'Draw sword',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('#guard-button').getAttribute('aria-disabled')==='false');
  const box=await page.locator('#guard-button').boundingBox();
  await page.waitForFunction(()=>window.__tellAt>0&&performance.now()-window.__tellAt>=430);
  await touch('touchStart',{x:box.x+box.width/2,y:box.y+box.height/2});
  await page.waitForFunction(()=>window.__combat.some(s=>s.events.some(e=>e.type==='Parried'&&e.actor===0)),null,{timeout:1500});
  await touch('touchEnd');await page.locator('#'+button).tap();
  await page.waitForFunction(move=>window.__combat.some(s=>s.events.some(e=>e.type==='Hit'&&e.actor===0&&e.move===move)),move,{timeout:2000});
  const state=await page.evaluate(()=>({events:window.__combat.flatMap(s=>s.events),clips:window.__clips,health:document.querySelector('#target-health').value}));
  assert.ok(state.events.some(e=>e.type==='AttackStarted'&&e.actor===0&&e.move===move));
  const hit=state.events.find(e=>e.type==='Hit'&&e.actor===0&&e.move===move);assert.equal(hit.damage,damage);assert.equal(state.health,150-damage);
  assert.ok(state.clips.some(c=>c.startsWith(`${clip}:${clip}@SwordDrawn`)),`player must render ${clip}: ${state.clips}`);
  await page.screenshot({path:`${dir}/${move}.png`});receipt.counters.push({button,move,hit,clips:[...new Set(state.clips)]});await page.close();
 }
 assert.deepEqual(receipt.errors,[]);receipt.passed=true;
} finally {await fs.writeFile(`${dir}/browser.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));await browser.close();await server?.close();}
