import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeExecutionKiller,writeExecutionVictim} from '../scripts/build-execution.mjs';
import {EXECUTION_BEATS} from '../src/execution.ts';
const unpack=(bytes:Buffer)=>{const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n).toString())};};

test('the Execution clip JSON are what the build writes from the untouched warrior.glb, byte for byte, with no random uuid',async()=>{
 const warrior=unpack(await readFile(new URL('../src/assets/warrior.glb',import.meta.url)));
 assert.ok(!warrior.json.animations.some((a:{name:string})=>/Execution/.test(a.name)),'warrior.glb stays untouched');
 const dir=await mkdtemp(join(tmpdir(),'execution-'));
 try{for(const [write,file,name] of [[writeExecutionKiller,'execution-killer','Fin_Execution'],[writeExecutionVictim,'execution-victim-hero','Death_Execution']] as const){
  const out=join(dir,file+'.json'),again=join(dir,file+'-2.json');
  await write(new URL('../src/assets/warrior.glb',import.meta.url),new URL('file://'+out));await write(new URL('../src/assets/warrior.glb',import.meta.url),new URL('file://'+again));
  const made=await readFile(out),shipped=await readFile(new URL(`../src/assets/${file}.json`,import.meta.url));assert.ok(made.equals(shipped),`shipped ${file} is current (node scripts/build-execution.mjs)`);assert.ok(made.equals(await readFile(again)),`${file} is stable across two builds (no random uuid)`);
  assert.ok(shipped.length<100000,'bounded payload');const clip=JSON.parse(shipped.toString());assert.equal(clip.name,name);assert.equal(clip.duration,EXECUTION_BEATS.duration);assert.ok(clip.tracks.length>30);assert.equal(clip.uuid,undefined);
 }}finally{await rm(dir,{recursive:true,force:true});}
});
