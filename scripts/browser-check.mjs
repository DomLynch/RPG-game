const HP=150;   // RULES.health: fighters start here (slice P)
// Required real-browser gate; observes UI, never overrides combat state or the simulation clock.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=process.env.QA_URL ? null : await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url=process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
// This gate needs a real GPU: its parry/kick steps are wall-clock touch timings, and software GL (SwiftShader, CI runners) stalls the page's
// thread until the press lands a second late. It runs locally before every deploy (scripts/deploy.sh) and against the live site; CI runs quality:ci.
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
const receipt={url,physicalPhone:false,errors:[]};
await fs.mkdir('artifacts',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2});page.setDefaultTimeout(12000);
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')receipt.console=[...(receipt.console||[]).slice(-19),m.text().slice(0,300)];});   // diagnostics for a failing run: what the page said
 receipt.diagnose=async()=>{try{receipt.state={art:await page.locator('#art-status').textContent(),attack:await page.locator('#attack-button').getAttribute('aria-disabled'),welcomeHidden:await page.evaluate(()=>document.querySelector('#welcome')?.hidden)};}catch(e){receipt.state=String(e).slice(0,200);}};
 await page.route('**/*sentry.io/**',route=>route.abort()); // Deliberate GPU failure checks must not create production incidents.
 page.on('pageerror',e=>receipt.errors.push(String(e)));
  // The first two waits are load waits (the two rigs are ~13 MB; a slow link to the live site is not a behaviour failure): 90 s, like the rig wait.
 const gameUrl=new URL(url);gameUrl.searchParams.set('debug','1');
 await page.goto(gameUrl.href);await page.waitForFunction(()=>document.querySelector('#attack-button').getAttribute('aria-disabled')==='false',null,{timeout:90000});await page.getByRole('button',{name:'Enter the arena'}).tap();await page.waitForFunction(()=>document.querySelector('#welcome').hidden);await page.waitForFunction(()=>document.querySelector('#art-status').textContent==='',null,{timeout:90000});   // the two rigs (14 MB) decode slowly on a CI runner's software GL; a load wait, not a behaviour wait
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
 await page.evaluate(()=>{window.__combat=[];window.addEventListener('frankendom:combat',e=>{window.__combat.push(e.detail);if(window.__combat.length>256)window.__combat.shift();});});
 await page.getByRole('button',{name:'Draw sword',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#guard-button').getAttribute('aria-disabled')==='false' && !document.querySelector('#kick-button').hidden);
 const guardPoint=await center('guard-button');
 await page.waitForFunction(()=>window.__tellAt>0 && performance.now()-window.__tellAt>=430);
 await touch('touchStart',guardPoint);
 receipt.guardAfterTellMs=await page.evaluate(()=>window.__guardAt-window.__tellAt);assert.ok(receipt.guardAfterTellMs>0,'Guard must receive the real touch after the tell');
 await page.waitForFunction(()=>/Parried|Blocked|Hit taken|Guard broken/.test(document.querySelector('#combat-status').textContent),null,{timeout:1500});
 receipt.parry=await snapshot();assert.match(receipt.parry.status,/Parried/);await touch('touchEnd');
 await page.waitForTimeout(60);await page.screenshot({path:'artifacts/browser-parry.jpg',type:'jpeg',quality:85});
 await page.getByRole('button',{name:'Light attack',exact:true}).tap();await page.waitForTimeout(350);
 receipt.riposte=await snapshot();assert.equal(receipt.riposte.enemy,HP-24,'the riposte takes 24');await page.screenshot({path:'artifacts/browser-riposte.jpg',type:'jpeg',quality:85});
 receipt.dmg=await page.locator('.dmg:visible').first().textContent();assert.equal(receipt.dmg,'24','the riposte floats its 24 off the warden');
 // Observe accepted player attacks, not the last HUD message (an opponent's kick can overwrite it).
 // A counter may interrupt an accepted attack. Make at most three real attempts; only a completed
 // player kick (hit, miss, or defender dodge) satisfies the gate. Never count enemy damage as ours.
 receipt.kickAttempts=[];
 for(let attempt=0;attempt<3;attempt++) {
  await page.waitForFunction(()=>document.querySelector('#kick-button').getAttribute('aria-disabled')==='false');
  await page.keyboard.down('KeyW');await page.waitForTimeout(200);await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>document.querySelector('#kick-button').dataset.reach==='true' && document.querySelector('#kick-button').getAttribute('aria-disabled')==='false',null,{timeout:3000});
  const before=await page.evaluate(()=>{window.__combat=[];return {health:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value};});
  await page.getByRole('button',{name:'Kick',exact:true}).tap();
  await page.waitForFunction(()=>window.__combat.some(s=>s.events.some(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick')),null,{timeout:1500});
  await page.waitForFunction(()=>{const events=window.__combat.flatMap(s=>s.events),start=events.find(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick');return start && events.some(e=>e.tick>=start.tick && (
   (e.move==='kick' && ((e.actor===0 && ['Hit','AttackMissed'].includes(e.type)) || (e.type==='Dodged' && e.target===0))) ||
   (e.type==='Staggered' && e.actor===0)));},null,{timeout:2000});
  const sequence=await page.evaluate(()=>window.__combat),events=sequence.flatMap(s=>s.events);
  const start=events.find(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick');
  const outcome=events.find(e=>e.tick>=start.tick && e.move==='kick' &&
   ((e.actor===0 && ['Hit','AttackMissed'].includes(e.type)) || (e.type==='Dodged' && e.target===0)));
  receipt.kickAttempts.push({before,start,outcome:outcome??null,events});
  if(!outcome)continue;
  const result=sequence.find(s=>s.events.some(e=>e.tick===outcome.tick && e.type===outcome.type && e.actor===outcome.actor));
  const applied=events.filter(e=>e.tick<=outcome.tick && e.type==='Hit');
  assert.equal(result.enemy,before.enemy-applied.filter(e=>e.actor===0 && e.target===1).reduce((n,e)=>n+e.damage,0),'enemy HP follows outgoing hits only');
  assert.equal(result.health,before.health-applied.filter(e=>e.actor===1 && e.target===0).reduce((n,e)=>n+e.damage,0),'player HP follows incoming hits only');
  if(outcome.type==='Hit') {assert.equal(outcome.target,1);assert.ok([4,5].includes(outcome.damage),'clean kick 4 or counter kick 5');}
  receipt.kick=await snapshot();receipt.kickOutcome=outcome;receipt.kickEscaped=['AttackMissed','Dodged'].includes(outcome.type);
  break;
 }
 assert.ok(receipt.kickOutcome,'a player kick must complete within three attempts; enemy counters alone do not pass');
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 const paused=await snapshot();await page.waitForTimeout(300);assert.deepEqual(await snapshot(),paused);
 for(const mode of ['red','dark','off'])await page.getByRole('button',{name:'Blood: '+mode,exact:true}).tap();receipt.bloodModes=['red','dark','off','red'];
 // Controls cycles thumb cluster → guard ring (v8) and back. Record the labels seen, checking the ring's layout on the way:
 // no two visible controls overlap, except Strike inside the Guard ring, which is the design.
 const layoutClean=async(scheme)=>{for(const size of [{width:393,height:852},{width:844,height:390}]){await page.setViewportSize(size);const s=await snapshot();assert.equal(s.scale,1);assert.equal(s.overflow,false,`${scheme} overflows at ${size.width}`);const boxes=await page.locator('.actions button:visible').evaluateAll(nodes=>nodes.map(n=>({...n.getBoundingClientRect().toJSON(),id:n.id})));for(const box of boxes)assert.ok(box.width>=44&&box.height>=44,`${scheme}: ${box.id} is ${Math.round(box.width)}×${Math.round(box.height)} px, under the 44 px touch minimum`);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];const nested=scheme==='ring8'&&[a.id,b.id].sort().join()==='attack-button,guard-button';assert.ok(nested||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,`overlapping controls (${scheme}): ${a.id} × ${b.id}`);}}await page.setViewportSize({width:393,height:852});};
 receipt.controls=[];for(let i=0;i<3;i++){const label=await page.locator('#controls-mode').textContent();receipt.controls.push(label);if(label==='Controls: thumb cluster'&&i>0)break;await page.locator('#controls-mode').tap();if(label==='Controls: thumb cluster'){await page.getByRole('button',{name:'Close journal'}).tap();await layoutClean('ring8');await page.getByRole('button',{name:'Menu and field journal'}).tap();}}
 assert.deepEqual(receipt.controls,['Controls: thumb cluster','Controls: guard ring · v8','Controls: thumb cluster']);
 await page.getByRole('button',{name:'Close journal'}).tap();
 await layoutClean('cluster');
 assert.deepEqual(receipt.errors,[]);
 const unsupported=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--disable-webgl']});
 try {
  const fallback=await unsupported.newPage(),errors=[];fallback.on('pageerror',e=>errors.push(String(e)));await fallback.route('**/*sentry.io/**',route=>route.abort());await fallback.goto(url);
  await fallback.waitForFunction(()=>document.querySelector('#message').textContent.includes('needs WebGL 2'));
  assert.equal(await fallback.evaluate(()=>document.querySelector('#world').getContext('webgl2')),null);
  assert.equal(await fallback.locator('#attack-button').getAttribute('aria-disabled'),'true');
  assert.equal(errors.length,1);assert.match(errors[0],/Unable to initialise the WebGL2 arena/);receipt.unsupportedGPU='Explicit fallback message and disabled combat; expected initialization error captured with telemetry blocked';
 } finally {await unsupported.close();}
 receipt.passed=true;
 console.log(JSON.stringify(receipt,null,2));
} catch(error){if(receipt.diagnose)await receipt.diagnose();delete receipt.diagnose;console.error('browser gate failed:',JSON.stringify({state:receipt.state,errors:receipt.errors,console:receipt.console},null,1));throw error;} finally {delete receipt.diagnose;await fs.writeFile(process.env.BROWSER_RECEIPT||'artifacts/browser-check.json',JSON.stringify(receipt,null,2));await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
