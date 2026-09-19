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
  for(const scenario of ['returning','mute','pause','late','death','rematch']) {
   const context=new OfflineAudioContext(1,4*48000,48000);let now=0;const f=window.make({context,now:()=>now,sprite:null});f.unlock();
   const frame={match:1,ended:false,tick:600,opening:scenario!=='late'};
   f.update([],undefined,frame);
   now=.2;if(scenario==='mute')f.toggle();if(scenario==='pause')f.quiet();if(scenario==='death')f.update([],undefined,{...frame,ended:true});
   if(scenario==='rematch'){now=1;f.update([],undefined,{...frame,match:2,tick:1});}
   await f.ready();now=3;f.update([],undefined,{...frame,match:scenario==='rematch'?2:1,opening:false,tick:780,ended:scenario==='death'});
   const data=(await context.startRendering()).getChannelData(0);
   const rms=(a,b)=>Math.sqrt(data.subarray(a*48000,b*48000).reduce((s,v)=>s+v*v,0)/((b-a)*48000));
   results[scenario]={attack:rms(.01,.15),later:rms(.5,.9),rematch:rms(1.01,1.15),tail:rms(3,4),peak:20*Math.log10(Math.max(...data.subarray(0,48000).map(Math.abs)))};
  }
  window.fetch=realFetch;return results;
 });
 assert.ok(receipt.results.returning.attack>.01,'returning player must hear bell even with bank unavailable');
 assert.equal(receipt.results.late.attack,0,'first unmute mid-combat stays bell-free');
 for(const name of ['mute','pause','death'])assert.equal(receipt.results[name].later,0,`${name} cancels bell`);
 assert.ok(receipt.results.rematch.rematch>.01,'new match rings');
 assert.ok(receipt.results.returning.peak<=-6,'bell leaves ample peak headroom');
 assert.equal(receipt.results.returning.tail,0,'failed decode never causes a late ring');
 receipt.passed=true;
}finally{await fs.writeFile(`${out}/startup.json`,JSON.stringify(receipt,null,2));await browser.close();await server.close();}
console.log(JSON.stringify(receipt));
