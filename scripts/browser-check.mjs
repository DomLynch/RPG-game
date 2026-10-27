const HP=150;   // RULES.health: fighters start here (slice P)
// Required real-browser gate; observes UI and never overrides combat state. Time is the gate's: after boot a fixed-step harness clock
// (scripts/lib/harness-clock.mjs) advances the page frame by frame, so every scripted press lands on the same simulation tick on any machine.
import { harnessClock } from './lib/harness-clock.mjs';
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
const site=await serveDist(), url=site.url;
// Machine-independent since 2026-09-20: the parry/kick steps used to be wall-clock touch timings that flaked under load and failed outright on
// a GPU-less box; they now run on harness time. Boot and asset loads stay real-time (load waits, not behaviour waits).
const browser=await launch();
const receipt={url,physicalPhone:false,errors:[]};
// The frame after a WebGL context restore is a real picture (#3436 follow-up): the lift's composer targets and the plain renderer both live through a restore, and a restore that left the canvas blank or one flat colour would pass every state check above.
// Page screenshot clipped to the canvas (the compositor's pixels; an element screenshot waits for the element to be "stable" over two animation frames, which never settle on the page that runs under the harness clock: CI dispatches 39489110540 and 39489122821 timed out there), sampled on a grid: distinct colours and the luminance spread. A black, white or flat frame has a handful of colours and a spread near 0; the arena has hundreds and a spread of tens.
// Decoded in node (the page's CSP forbids fetching a data: URL): an 8-bit RGB/RGBA PNG, the five scanline filters.
const decodePng=(buf)=>{let p=8,w=0,h=0,ct=0;const idat=[];while(p<buf.length){const len=buf.readUInt32BE(p),type=buf.toString('latin1',p+4,p+8);if(type==='IHDR'){w=buf.readUInt32BE(p+8);h=buf.readUInt32BE(p+12);ct=buf[p+17];}if(type==='IDAT')idat.push(buf.subarray(p+8,p+8+len));p+=12+len;}const bpp=ct===6?4:3,stride=w*bpp,raw=inflateSync(Buffer.concat(idat)),out=Buffer.alloc(h*stride);for(let y=0;y<h;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=bpp?out[y*stride+x-bpp]:0,b=y?out[(y-1)*stride+x]:0,c=x>=bpp&&y?out[(y-1)*stride+x-bpp]:0;let v=raw[y*(stride+1)+1+x];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}out[y*stride+x]=v&255;}}return{w,h,bpp,data:out};};
const frameStats=async(pg)=>{const {data,bpp}=decodePng(await pg.screenshot({clip:await pg.locator('#world').boundingBox(),animations:'disabled',timeout:30000})),seen=new Set(),lum=[];for(let i=0;i<data.length;i+=bpp*97){seen.add(((data[i]>>3)<<10)|((data[i+1]>>3)<<5)|(data[i+2]>>3));lum.push(data[i]*.3+data[i+1]*.59+data[i+2]*.11);}const mean=lum.reduce((a,b)=>a+b,0)/lum.length;return{colours:seen.size,spread:+Math.sqrt(lum.reduce((a,b)=>a+(b-mean)**2,0)/lum.length).toFixed(1),samples:lum.length};};
const assertRealFrame=(label,s)=>{console.log('RESTORE-FRAME '+label+' '+JSON.stringify(s));assert.ok(s.colours>=40&&s.spread>=8,label+': the frame after a context restore is blank or flat '+JSON.stringify(s));};
try {
 const {page}=await phonePage(browser,{deviceScaleFactor:2,errors:receipt.errors});   // page errors land in receipt.errors; Sentry is blocked (deliberate GPU failures must not file incidents)
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')receipt.console=[...(receipt.console||[]).slice(-19),m.text().slice(0,300)];});   // diagnostics for a failing run: what the page said
 receipt.diagnose=async()=>{try{receipt.state={art:await page.locator('#art-status').textContent(),attack:await page.locator('#attack-button').getAttribute('aria-disabled'),welcomeHidden:await page.evaluate(()=>document.querySelector('#welcome')?.hidden)};
  // Why the sim may stand still while page time runs (K3g, "__tellAt>0 ... 430" not met in 20000 ms): main.ts paused() is true while the document is hidden, the welcome/journal/versus sheet is up, assets are not ready or graphics are lost, and then frames run, page time advances and the tick never moves.
  receipt.sim=await page.evaluate(()=>({tick:document.querySelector('#debug')?.dataset.tick??null,hidden:document.hidden,visibility:document.visibilityState,now:Math.round(performance.now()),tellAt:window.__tellAt??null,threat:document.querySelector('#combat-status')?.dataset.threat??null,message:document.querySelector('#message')?.hidden?'':document.querySelector('#message')?.textContent?.slice(0,80),status:document.querySelector('#combat-status')?.textContent?.slice(0,60)}));}catch(e){receipt.state=String(e).slice(0,200);}};
 // Damage numbers are a journal setting, off by default (#219); this gate asserts the float works when a player turns it on, so seed it.
 await page.addInitScript(()=>{try{localStorage.setItem('frankendom.damage-numbers.v1','on');}catch{}});
  // The first two waits are load waits (the two rigs are ~13 MB; a slow link to the live site is not a behaviour failure): 90 s, like the rig wait.
 const gameUrl=new URL(url);gameUrl.searchParams.set('debug','1');
 await page.goto(gameUrl.href);await waitForGame(page);{ const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({timeout:120000}); }await page.waitForFunction(()=>document.querySelector('#welcome').hidden,null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#art-status').textContent==='',null,{timeout:90000});   // the two rigs (14 MB) decode slowly on a CI runner's software GL, and its first real render compiles every shader while the
   // Enter tap waits on the main thread: load waits (120 s), not behaviour waits — behaviour is on the harness clock below
 const {run,until,untilTicks}=await harnessClock(page);   // from here on, page time moves only when the gate advances it
 const cdp=await page.context().newCDPSession(page);
 const center=async id=>{const b=await page.locator('#'+id).boundingBox();assert.ok(b,id);return{x:b.x+b.width/2,y:b.y+b.height/2}};
 const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:2,radiusY:2,force:1}]:[]});
 const snapshot=()=>page.evaluate(()=>({scale:visualViewport.scale,overflow:document.documentElement.scrollWidth>innerWidth,status:document.querySelector('#combat-status').textContent,health:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value,stamina:document.querySelector('#stamina').value}));
 await fs.mkdir('artifacts',{recursive:true});
 // Actual WebGL loss and restoration: the normal game must resume with no page error.
 await page.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WebGL loss extension unavailable');extension.loseContext();setTimeout(()=>extension.restoreContext(),350);});
 await until(()=>document.querySelector('#message').textContent.startsWith('Restoring'),2000);
 await until(()=>document.querySelector('#message').hidden,15000);
 receipt.graphicsRestored=true; receipt.afterRestore=await snapshot();
 await page.waitForTimeout(1000); receipt.frameAfterRestore=await frameStats(page); assertRealFrame('lift on (default)',receipt.frameAfterRestore);
 // Timestamp the first rendered tell before drawing. Polling plus a fresh layout query after a fixed sleep can miss the parry window.
 await page.evaluate(()=>{window.__tellAt=0;window.__guardAt=0;const status=document.querySelector('#combat-status');const observer=new MutationObserver(()=>{if(status.dataset.threat==='true'){window.__tellAt=performance.now();observer.disconnect();}});observer.observe(status,{attributes:true,attributeFilter:['data-threat']});document.querySelector('#guard-button').addEventListener('pointerdown',()=>{window.__guardAt=performance.now();},{once:true});});
 await page.evaluate(()=>{window.__combat=[];window.addEventListener('frankendom:combat',e=>{window.__combat.push(e.detail);if(window.__combat.length>256)window.__combat.shift();});});
 // main.ts paused() holds the sim while the document is hidden or graphics are lost (the "Restoring graphics" message); the tell clock below must not start against a paused sim (K3g tell wait).
 await until(()=>!document.hidden && document.querySelector('#message').hidden,5000);
 await page.getByRole('button',{name:'Fight',exact:true}).tap();
 await until(()=>document.querySelector('#guard-button').getAttribute('aria-disabled')==='false' && !document.querySelector('#kick-button').hidden,5000);
 const guardPoint=await center('guard-button');
 await untilTicks(()=>window.__tellAt>0 && performance.now()-window.__tellAt>=430,1200);   // 1200 sim ticks (20 s of fight at 60 Hz), not 20 s of page time: a sim that is not ticking fails at once with the stall named (harness-clock.mjs tickWaiter)
 // Directional guard: the parry must be on the side the blow arrives on — the mirror of the attack's direction (a right cut arrives on the
 // defender's left; overhead, thrust and low by name). The tell's AttackStarted carries `direction`; a straight thrust needs no slide.
 const incoming=await page.evaluate(()=>{const e=[...window.__combat].reverse().flatMap(s=>s.events).find(e=>e.type==='AttackStarted' && e.actor===1);return e?e.direction:null;});
 const side={right:'left',left:'right',overhead:'overhead',low:'low',thrust:null}[incoming] ?? null;
 const slide={left:{x:-30,y:0},right:{x:30,y:0},overhead:{x:0,y:-30},low:{x:0,y:30}}[side];
 receipt.parrySide={incoming,side};
 await touch('touchStart',guardPoint);
 if(slide){await touch('touchMove',{x:guardPoint.x+slide.x,y:guardPoint.y+slide.y});}
 receipt.guardAfterTellMs=await page.evaluate(()=>window.__guardAt-window.__tellAt);assert.ok(receipt.guardAfterTellMs>0,'Guard must receive the real touch after the tell');
 await until(()=>/Parried|Blocked|Hit taken|Guard broken/.test(document.querySelector('#combat-status').textContent),1500);
 receipt.parry=await snapshot();assert.match(receipt.parry.status,/Parried/);await touch('touchEnd');
 await run(60);await page.screenshot({path:'artifacts/browser-parry.jpg',type:'jpeg',quality:85});
 // The damage float lives 900 ms on the document's animation timeline (real time, not harness time), so it is recorded the instant it
 // appears rather than looked for after screenshots that a software-GL box takes slowly.
 await page.evaluate(()=>{window.__floats=[];new MutationObserver(list=>{for(const m of list){const span=m.target;if(!span.hidden&&span.textContent)window.__floats.push(span.textContent);}}).observe(document.querySelector('#dmg-pool'),{attributes:true,attributeFilter:['hidden'],subtree:true});});
 await page.getByRole('button',{name:'Light attack',exact:true}).tap();await run(350);
 await until(()=>window.__floats.length>0,1000);   // hit-impact.ts: the parry now holds 11 frames longer, so the riposte lands later than a fixed 350 ms; wait for its float
 receipt.riposte=await snapshot();assert.equal(receipt.riposte.enemy,receipt.parry.enemy-6,'the riposte takes 6');   // RV79 (reach bands live, Dom's cm edges): the riposte lands off the longsword's mid band, x 0.4 (offBandMultCm): 14 x 0.4 = 5.6 -> 6;   // RV78 sandbox era (Dom-approved 2026-10-18): the warden is a veteran in plate, and the sandbox armourVs row slash vs heavy is 600 per mille: 24 x 0.6 = 14   // from the enemy's HP before it: a level-1 novice starts below HP (moves.ts opponentAt)
 receipt.dmg=(await page.evaluate(()=>window.__floats))[0];assert.equal(receipt.dmg,'6','the riposte floats its 6 off the warden');
 await page.screenshot({path:'artifacts/browser-riposte.jpg',type:'jpeg',quality:85});
 // Observe accepted player attacks, not the last HUD message (an opponent's kick can overwrite it).
 // A counter may interrupt an accepted attack. Make at most three real attempts; only a completed
 // player kick (hit, miss, defender dodge, or a low guard bracing it — directional guard) satisfies the gate. Never count enemy damage as ours.
 receipt.kickAttempts=[];
 for(let attempt=0;attempt<3;attempt++) {
  await until(()=>document.querySelector('#kick-button').getAttribute('aria-disabled')==='false',5000);
  await page.keyboard.down('KeyW');await run(200);await page.keyboard.up('KeyW');
  await until(()=>document.querySelector('#kick-button').dataset.reach==='true' && document.querySelector('#kick-button').getAttribute('aria-disabled')==='false',3000);
  const before=await page.evaluate(()=>{window.__combat=[];return {health:document.querySelector('#player-health').value,enemy:document.querySelector('#target-health').value};});
  await page.getByRole('button',{name:'Kick',exact:true}).tap();
  await until(()=>window.__combat.some(s=>s.events.some(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick')),1500);
  await until(()=>{const events=window.__combat.flatMap(s=>s.events),start=events.find(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick');return start && events.some(e=>e.tick>=start.tick && (
   (e.move==='kick' && ((e.actor===0 && ['Hit','AttackMissed'].includes(e.type)) || (['Dodged','Blocked'].includes(e.type) && e.target===0))) ||
   (e.type==='Staggered' && e.actor===0)));},2000);
  const sequence=await page.evaluate(()=>window.__combat),events=sequence.flatMap(s=>s.events);
  const start=events.find(e=>e.type==='AttackStarted' && e.actor===0 && e.move==='kick');
  // Directional guard: a warden who read the kick braces it low — a Blocked kick is a completed player kick too.
  const outcome=events.find(e=>e.tick>=start.tick && e.move==='kick' &&
   ((e.actor===0 && ['Hit','AttackMissed'].includes(e.type)) || (['Dodged','Blocked'].includes(e.type) && e.target===0)));
  receipt.kickAttempts.push({before,start,outcome:outcome??null,events});
  if(!outcome)continue;
  const result=sequence.find(s=>s.events.some(e=>e.tick===outcome.tick && e.type===outcome.type && e.actor===outcome.actor));
  const applied=events.filter(e=>e.tick<=outcome.tick && e.type==='Hit');
  assert.equal(result.enemy,before.enemy-applied.filter(e=>e.actor===0 && e.target===1).reduce((n,e)=>n+e.damage,0),'enemy HP follows outgoing hits only');
  assert.equal(result.health,before.health-applied.filter(e=>e.actor===1 && e.target===0).reduce((n,e)=>n+e.damage,0),'player HP follows incoming hits only');
  // RV79 reach bands (Dom's cm edges): a kick thrown from outside its band GLANCES (Hit.glance, a dulled hit that lands for less, rows offBandMultCm). The foe's opening now lands later (RV80's level-1 opener row), so the first kick can meet it at another gap: a glance is the intended band rule, and it lands for 1..3, under the clean 4.
  if(outcome.type==='Hit'&&outcome.glance&&attempt<2){receipt.kickGlances=(receipt.kickGlances||0)+1;continue;}   // an off-band kick glanced: the walk-in before the next attempt lands it at another gap (the last attempt takes the glance below)
  if(outcome.type==='Hit') {assert.equal(outcome.target,1);receipt.kickGlance=!!outcome.glance;assert.ok(outcome.glance?(outcome.damage>=1&&outcome.damage<4):[4,5].includes(outcome.damage),'clean kick 4 or counter kick 5, or on the last attempt a glance (1..3)');}
  receipt.kick=await snapshot();receipt.kickOutcome=outcome;receipt.kickEscaped=['AttackMissed','Dodged','Blocked'].includes(outcome.type);
  break;
 }
 assert.ok(receipt.kickOutcome,'a player kick must complete within three attempts; enemy counters alone do not pass');
 await page.getByRole('button',{name:'Menu and field journal'}).tap();
 const paused=await snapshot();await run(300);assert.deepEqual(await snapshot(),paused);
 // The thumb cluster is the one touch layout (the v8 strike circle was retired 2026-09-20): no two visible controls overlap, every one is a 44 px target.
 const layoutClean=async(scheme)=>{for(const size of [{width:393,height:852},{width:844,height:390}]){await page.setViewportSize(size);await run(32);const s=await snapshot();assert.equal(s.scale,1);assert.equal(s.overflow,false,`${scheme} overflows at ${size.width}`);// The 44 px rule is about the target's layout size: offsetWidth/Height are transform-independent, so the press animation
 // (cluster button:active scale(.95), 80 ms) cannot read as 43.35 when the check lands mid-release (deploy #32 try 1). The overlap
 // check still uses rects, so every running animation is awaited first (real time, capped) before any rect is read.
 await Promise.race([page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))),new Promise(r=>setTimeout(r,1500))]);   // the cap is Node-side: a page timer never fires under the paused clock; CSS transitions run on real time and their `finished` promises resolve without it
 const boxes=await page.locator('.actions button:visible').evaluateAll(nodes=>nodes.map(n=>({...n.getBoundingClientRect().toJSON(),id:n.id,w:n.offsetWidth,h:n.offsetHeight})));
 for(const box of boxes)assert.ok(box.w>=44&&box.h>=44,`${scheme}: ${box.id} is ${box.w}×${box.h} px (layout), under the 44 px touch minimum`);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,`overlapping controls (${scheme}): ${a.id} × ${b.id}`);}}await page.setViewportSize({width:393,height:852});};
 await page.getByRole('button',{name:'Arena'}).tap();
 await layoutClean('cluster');
 assert.deepEqual(receipt.errors,[]);
 const unsupported=await launch({args:['--disable-webgl']});
 try {
  const fallback=await unsupported.newPage(),errors=[];fallback.on('pageerror',e=>errors.push(String(e)));await fallback.route('**/*sentry.io/**',route=>route.abort());await fallback.goto(url);
  await fallback.waitForFunction(()=>document.querySelector('#message').textContent.includes('needs WebGL 2'));
  assert.equal(await fallback.evaluate(()=>document.querySelector('#world').getContext('webgl2')),null);
  assert.equal(await fallback.locator('#attack-button').getAttribute('aria-disabled'),'true');
  assert.equal(errors.length,1);assert.match(errors[0],/^Error: THREE\.WebGLRenderer: Error creating WebGL context\.$/);receipt.unsupportedGPU={message:'Explicit fallback message and disabled combat; original renderer error retained with telemetry blocked',error:errors[0]};
 } finally {await unsupported.close();}
 // The same restore with the lift opted out (?gfx=0): the plain renderer's frame survives too.
 { const offErrors=[],{page:off}=await phonePage(browser,{deviceScaleFactor:2,errors:offErrors}),offUrl=new URL(url);offUrl.searchParams.set('gfx','0');
  await off.goto(offUrl.href);await waitForGame(off);{ const enter = off.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({timeout:120000}); }await off.waitForFunction(()=>document.querySelector('#welcome').hidden,null,{timeout:120000});await off.waitForFunction(()=>document.querySelector('#art-status').textContent==='',null,{timeout:90000});
  await off.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WebGL loss extension unavailable');extension.loseContext();setTimeout(()=>extension.restoreContext(),350);});
  await off.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Restoring'),null,{timeout:5000});
  await off.waitForFunction(()=>document.querySelector('#message').hidden,null,{timeout:20000});
  await off.waitForTimeout(1000); receipt.frameAfterRestoreGfx0=await frameStats(off); assertRealFrame('?gfx=0',receipt.frameAfterRestoreGfx0);
  assert.deepEqual(offErrors,[],'?gfx=0 restore: no page error'); await off.close(); }
 receipt.passed=true;
 console.log(JSON.stringify(receipt,null,2));
} catch(error){if(receipt.diagnose)await receipt.diagnose();delete receipt.diagnose;console.error('browser gate failed:',JSON.stringify({state:receipt.state,sim:receipt.sim,errors:receipt.errors,console:receipt.console},null,1));throw error;} finally {delete receipt.diagnose;await writeReceipt(process.env.BROWSER_RECEIPT||'artifacts/browser-check.json',receipt);await browser.close();await site.close();}
