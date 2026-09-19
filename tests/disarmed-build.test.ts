import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendDisarmed} from '../scripts/build-disarmed.mjs';
const unpack=(bytes:Buffer)=>{const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n).toString()),binary:bytes.subarray(28+n)};};
const pack=(json:object,binary:Buffer)=>{const raw=Buffer.from(JSON.stringify(json)),js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),h=Buffer.alloc(20),b=Buffer.alloc(8);[0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>h.writeUInt32LE(v,i*4));b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,js,b,bin]);};
test('Disarmed append preserves existing GLB bytes and clips, is reproducible, and refuses to erase later animations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'disarmed-'));
 try {for(const rig of ['warrior','veteran']){
  const original=await readFile(new URL(`../src/assets/${rig}.glb`,import.meta.url)),base=unpack(original),file=join(dir,rig+'.glb');await writeFile(file,original);
  const receipt=await appendDisarmed(file),first=await readFile(file),after=unpack(first);
  assert.ok(receipt.addedBytes<160000,'bounded two-clip payload');
  assert.deepEqual(after.binary.subarray(0,base.json.buffers[0].byteLength),base.binary.subarray(0,base.json.buffers[0].byteLength));
  for(const key of ['nodes','meshes','skins','materials','images','textures'])assert.deepEqual(after.json[key],base.json[key]);
  assert.deepEqual(after.json.animations.slice(0,base.json.animations.length),base.json.animations);
  assert.deepEqual(after.json.animations.slice(-2).map((a:{name:string})=>a.name),['Death_Disarmed','Fin_Disarmed']);
  await appendDisarmed(file);assert.deepEqual(await readFile(file),first,'reproducible append');
  after.json.animations.push({...after.json.animations.at(-1),name:'LaterFinisher'});await writeFile(file,pack(after.json,after.binary));const newer=await readFile(file);
  await assert.rejects(appendDisarmed(file),/Newer animations/);assert.deepEqual(await readFile(file),newer);
 }}finally{await rm(dir,{recursive:true,force:true});}
});
