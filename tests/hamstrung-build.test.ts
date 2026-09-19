import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {appendHamstrung} from '../scripts/build-hamstrung.mjs';
const unpack=(bytes:Buffer)=>{const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n).toString()),binary:bytes.subarray(28+n)};};
const pack=(json:object,binary:Buffer)=>{const raw=Buffer.from(JSON.stringify(json)),js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),h=Buffer.alloc(20),b=Buffer.alloc(8);[0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>h.writeUInt32LE(v,i*4));b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,js,b,bin]);};
test('Hamstrung append preserves existing GLB bytes and clips, is reproducible, and refuses to erase later animations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hamstrung-'));
 try {for(const rig of ['warrior','veteran']){
  const original=await readFile(new URL(`../src/assets/${rig}.glb`,import.meta.url)),base=unpack(original),file=join(dir,rig+'.glb');await writeFile(file,original);
  const receipt=await appendHamstrung(file),first=await readFile(file),after=unpack(first);
  assert.ok(receipt.addedBytes<160000,'bounded two-clip payload');
  assert.ok(after.binary.subarray(0,base.json.buffers[0].byteLength).equals(base.binary.subarray(0,base.json.buffers[0].byteLength)),'existing binary data preserved');
  assert.deepEqual(after.json.extras.disarmedBase,base.json.extras.disarmedBase,'earlier Disarmed append provenance preserved');
  for(const key of ['nodes','meshes','skins','materials','images','textures'])assert.deepEqual(after.json[key],base.json[key]);
  assert.deepEqual(after.json.animations.slice(0,base.json.animations.length),base.json.animations);
  assert.deepEqual(after.json.animations.slice(-2).map((a:{name:string})=>a.name),['Death_Hamstrung','Fin_Hamstrung']);
  const parsed=structuredClone(after.json);parsed.images=[];parsed.textures=[];parsed.materials=parsed.materials.map((m:{name:string})=>({name:m.name}));parsed.buffers[0].uri='data:application/octet-stream;base64,'+after.binary.toString('base64');
  const loaded=await new GLTFLoader().parseAsync(JSON.stringify(parsed),'');for(const name of ['Death_Hamstrung','Fin_Hamstrung']){const clip=loaded.animations.find(c=>c.name===name)!;assert.ok(clip.tracks.length>30 && Math.abs(clip.duration-3.8)<1e-6,'app loader reads complete paired clips');}
  await appendHamstrung(file);assert.ok((await readFile(file)).equals(first),'reproducible append');
  after.json.animations.push({...after.json.animations.at(-1),name:'LaterFinisher'});await writeFile(file,pack(after.json,after.binary));const newer=await readFile(file);
  await assert.rejects(appendHamstrung(file),/Newer animations/);assert.ok((await readFile(file)).equals(newer));
 }}finally{await rm(dir,{recursive:true,force:true});}
});
