// Required real-browser gate; observes UI, never overrides combat state or the simulation clock.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=process.env.QA_URL ? null : await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url=process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const receipt={url,physicalPhone:false,errors:[]};
await fs.mkdir('artifacts',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2});page.setDefaultTimeout(12000);
 await page.route('**/*sentry.io/**',route=>route.abort()); // Deliberate GPU failure checks must not create production incidents.
 page.on('pageerror',e=>receipt.errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#attack-button').getAttribute('aria-disabled')==='false');await page.getByRole('button',{name:'Enter the courtyard'}).tap();await page.waitForFunction(()=>document.querySelector('#welcome').hidden);await page.waitForFunction(()=>document.querySelector('#art-status').textContent==='');
 const cdp=await page.context().newCDPSession(page);
 const center=async id=>{const b=await page.locator('#'+id).boundingBox();assert.ok(b,id);return{x:b.x+b.width/2,y:b.y+b.height/2}};
 const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:2,radiusY:2,force:1}]:[]});
 const snapshot=()=>page.evaluate(()=>({scale:visualViewport.scale,overflow:document.documentElement.scrollWidth>innerWidth,status:document.querySelector('#combat-status').textContent,health:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value,stamina:document.querySelector('#stamina').value}));
 await fs.mkdir('artifacts',{recursive:true});
 // Actual WebGL loss and restoration: the normal game must resume with no page error.
 await page.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WebGL loss extension unavailable');extension.loseContext();setTimeout(()=>extension.restoreContext(),350);});
 await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Restoring'));
 await page.waitForFunction(()=>document.querySelector('#message').hidden);
 receipt.graphicsRestored=true; receipt.afterRestore=await snapshot();
 // Timestamp the first rendered tell before drawing. Polling plus a fresh layout query after a fixed sleep can miss the parry window.
 await page.evaluate(()=>{window.__tellAt=0;window.__guardAt=0;const status=document.querySelector('#combat-status');const observer=new MutationObserver(()=>{if(status.textContent.startsWith('Incoming strike')){window.__tellAt=performance.now();observer.disconnect();}});observer.observe(status,{childList:true});document.querySelector('#guard-button').addEventListener('pointerdown',()=>{window.__guardAt=performance.now();},{once:true});});
 await page.getByRole('button',{name:'Draw sword',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#guard-button').getAttribute('aria-disabled')==='false' && !document.querySelector('#kick-button').hidden);
 const guardPoint=await center('guard-button');
 await page.waitForFunction(()=>window.__tellAt>0 && performance.now()-window.__tellAt>=430);
 await touch('touchStart',guardPoint);
 receipt.guardAfterTellMs=await page.evaluate(()=>window.__guardAt-window.__tellAt);assert.ok(receipt.guardAfterTellMs>0,'Guard must receive the real touch after the tell');
 await page.waitForFunction(()=>/Parried|Blocked|Hit taken|Guard broken/.test(document.querySelector('#combat-status').textContent),null,{timeout:1500});
 receipt.parry=await snapshot();assert.match(receipt.parry.status,/Parried/);await touch('touchEnd');
 await page.waitForTimeout(60);await page.screenshot({path:'artifacts/browser-parry.png'});
 await page.getByRole('button',{name:'Light attack',exact:true}).tap();await page.waitForTimeout(350);
 receipt.riposte=await snapshot();assert.equal(receipt.riposte.enemy,76);await page.screenshot({path:'artifacts/browser-riposte.png'});
 await page.waitForTimeout(600);await page.keyboard.down('KeyW');await page.waitForTimeout(240);await page.keyboard.up('KeyW');
 await page.getByRole('button',{name:'Kick',exact:true}).tap();await page.waitForTimeout(335);receipt.kick=await snapshot();assert.ok([72,71].includes(receipt.kick.enemy),`kick landed clean (72) or as a counter on the warden's wind-up (71): ${receipt.kick.enemy}`);
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 const paused=await snapshot();await page.waitForTimeout(300);assert.deepEqual(await snapshot(),paused);
 for(const mode of ['red','dark','off'])await page.getByRole('button',{name:'Blood: '+mode,exact:true}).tap();receipt.bloodModes=['red','dark','off','red'];
 await page.getByRole('button',{name:'Controls: buttons',exact:true}).tap();await page.getByRole('button',{name:'Close journal'}).tap();
 await page.waitForFunction(()=>document.querySelector('#heavy-button').getAttribute('aria-disabled')==='false' && !document.querySelector('#combat-status').textContent.startsWith('Incoming'));
 // Observe each actual DOM value transition. End-of-action balances include regeneration and cannot prove exact cost.
 await page.evaluate(()=>{window.__staminaDeltas=[];const meter=document.querySelector('#stamina');window.__staminaObserver=new MutationObserver(records=>{for(let i=0;i<records.length;i++){const old=Number(records[i].oldValue),next=Number(i+1<records.length?records[i+1].oldValue:meter.getAttribute('value'));window.__staminaDeltas.push(old-next);}});window.__staminaObserver.observe(meter,{attributes:true,attributeOldValue:true,attributeFilter:['value']});});
 const pad=await center('gesture-pad');await touch('touchStart',pad);await touch('touchMove',{x:pad.x,y:pad.y+40});await touch('touchEnd');
 await page.waitForFunction(()=>window.__staminaDeltas.some(d=>d>1),null,{timeout:1500});
 receipt.swipeDeltas=await page.evaluate(()=>{window.__staminaObserver.disconnect();return window.__staminaDeltas;});assert.deepEqual(receipt.swipeDeltas.filter(d=>d>1).map(d=>Math.round(d*1e6)/1e6),[35]);
 await page.screenshot({path:'artifacts/browser-swipes.png'});
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 // The Controls button cycles buttons → disc v1 → v2 → v3 → buttons; the stroke above ran on v1. Walk the cycle back and record the labels seen.
 receipt.controls=[];for(let i=0;i<6;i++){const label=await page.locator('#controls-mode').textContent();receipt.controls.push(label);if(label==='Controls: buttons')break;await page.locator('#controls-mode').tap();}
 assert.deepEqual(receipt.controls,['Controls: disc · flick (v1)','Controls: disc · drag & release (v2)','Controls: disc · drag & release · hold to charge (v3)','Controls: thumb cluster · round buttons (v5)','Controls: segmented disc · tap a sector (v6)','Controls: buttons']);
 await page.getByRole('button',{name:'Close journal'}).tap();
 for(const size of [{width:393,height:852},{width:844,height:390}]){await page.setViewportSize(size);const s=await snapshot();assert.equal(s.scale,1);assert.equal(s.overflow,false);const boxes=await page.locator('.actions button:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'overlapping controls');}}
 assert.deepEqual(receipt.errors,[]);
 const unsupported=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--disable-webgl']});
 try {
  const fallback=await unsupported.newPage(),errors=[];fallback.on('pageerror',e=>errors.push(String(e)));await fallback.route('**/*sentry.io/**',route=>route.abort());await fallback.goto(url);
  await fallback.waitForFunction(()=>document.querySelector('#message').textContent.includes('needs WebGL 2'));
  assert.equal(await fallback.evaluate(()=>document.querySelector('#world').getContext('webgl2')),null);
  assert.equal(await fallback.locator('#attack-button').getAttribute('aria-disabled'),'true');
  assert.equal(errors.length,1);assert.match(errors[0],/Unable to initialise the WebGL2 courtyard/);receipt.unsupportedGPU='Explicit fallback message and disabled combat; expected initialization error captured with telemetry blocked';
 } finally {await unsupported.close();}
 receipt.passed=true;
 console.log(JSON.stringify(receipt,null,2));
} finally {await fs.writeFile(process.env.BROWSER_RECEIPT||'artifacts/browser-check.json',JSON.stringify(receipt,null,2));await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
