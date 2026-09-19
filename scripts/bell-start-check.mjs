// Cold returning-player startup, with the optional arena download deliberately unavailable.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='artifacts/audio/bell-fix';await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,appType:'custom',logLevel:'error',server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`,browser=await chromium.launch({headless:true});
const receipt={checks:[],physicalPhone:false};
try {
 const page=await browser.newPage();
 await page.route(`${origin}/check`,r=>r.fulfill({contentType:'text/html',body:`<script type="module">import {createFeedback} from '/src/feedback.ts';window.make=createFeedback;</script>`}));
 await page.goto(`${origin}/check`);await page.waitForFunction(()=>!!window.make);
 receipt.results=await page.evaluate(async()=>{
  const results={};const realFetch=window.fetch;
  window.fetch=()=>Promise.reject(Error('cold/offline bank'));
  for(const scenario of ['returning','pauseBefore','muteBefore','mute','pause','late','death','rematch','mutedDraw','opponent']) {
   const context=new OfflineAudioContext(1,11*48000,48000);let now=0;
   const bells=[],create=context.createBufferSource.bind(context);
   context.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{if(source.buffer?.duration===2.6)bells.push(args[0]);return start(...args);};return source;};
   const f=window.make({context,now:()=>now,sprite:null});f.unlock();
   let frame={match:1,ended:false,tick:600};const draw={type:'ActionStarted',actor:scenario==='opponent'?1:0,action:'draw',tick:750};
   f.update([],undefined,frame);
   now=.1;if(scenario==='pauseBefore')f.quiet();if(scenario==='muteBefore'||scenario==='mutedDraw')f.toggle();
   now=.2;if(scenario==='pauseBefore')f.unlock();if(scenario==='muteBefore')f.toggle();
   now=2.5;f.update(scenario==='late'?[]:[draw],undefined,frame);
   now=2.7;if(scenario==='mute')f.toggle();if(scenario==='pause')f.quiet();if(scenario==='death'){frame={...frame,ended:true};f.update([],undefined,frame);}
   now=3.2;if(scenario==='mute'||scenario==='mutedDraw')f.toggle();if(scenario==='pause')f.unlock();f.update([],undefined,frame);
   if(scenario==='rematch'){now=5;frame={...frame,match:2,tick:1};f.update([],undefined,frame);now=7.5;f.update([draw],undefined,frame);}
   await f.ready();now=10;f.update([],undefined,frame);
   const data=(await context.startRendering()).getChannelData(0);
   const rms=(a,b)=>Math.sqrt(data.subarray(a*48000,b*48000).reduce((s,v)=>s+v*v,0)/((b-a)*48000));
   results[scenario]={bells,before:rms(0,2.4),attack:rms(2.51,2.65),afterCancel:rms(3.4,3.8),rematchWaiting:rms(5.2,7.4),tail:rms(10.2,11),peak:20*Math.log10(Math.max(...data.subarray(2.5*48000,3.5*48000).map(Math.abs)))};
  }
  window.fetch=realFetch;return results;
 });
 for(const [name,result] of Object.entries(receipt.results)) {
  assert.equal(result.before,0,`${name}: Enter and waiting sheathed must not ring`);
  assert.deepEqual(result.bells,['late','mutedDraw','opponent'].includes(name)?[]:name==='rematch'?[2.5,7.5]:[2.5],`${name}: only player Draw rings once`);
  assert.equal(result.tail,0,`${name}: no late replay`);
 }
 for(const name of ['mute','pause','death'])assert.equal(receipt.results[name].afterCancel,0,`${name} cancels bell without replay`);
 assert.equal(receipt.results.rematch.rematchWaiting,0,'rematch waits for Draw');
 assert.ok(receipt.results.returning.attack>.01,'returning player bell audible with bank unavailable');
 assert.ok(receipt.results.returning.peak<=-6,'bell leaves peak headroom');
 receipt.passed=true;
}finally{await fs.writeFile(`${out}/startup.json`,JSON.stringify(receipt,null,2));await browser.close();await server.close();}
console.log(JSON.stringify(receipt));
