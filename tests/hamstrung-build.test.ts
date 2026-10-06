import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {appendHamstrung,writeHamstrungKiller} from '../scripts/build-hamstrung.mjs';
const unpack=(bytes:Buffer)=>{const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n).toString()),binary:bytes.subarray(28+n)};};
const pack=(json:object,binary:Buffer)=>{const raw=Buffer.from(JSON.stringify(json)),js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),h=Buffer.alloc(20),b=Buffer.alloc(8);[0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>h.writeUInt32LE(v,i*4));b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,js,b,bin]);};
// The victim's clip is appended to each creature that falls to it; the killer's ships as JSON beside warrior.glb, which stays untouched.
test('Hamstrung append reproduces the shipped creature GLBs and the killer JSON byte for byte, adds one bounded clip per creature, leaves warrior.glb alone, and refuses to erase later animations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hamstrung-'));
 try {for(const [rig,names] of [['minotaur',['Death_Hamstrung']],['wraith',['Death_Hamstrung']]] as const){
  const shipped=await readFile(new URL(`../src/assets/${rig}.glb`,import.meta.url)),base=unpack(shipped),file=join(dir,rig+'.glb');await writeFile(file,shipped);
  const provenance=base.json.extras.hamstrungBase;
  assert.ok(provenance && base.json.animations.length===provenance.animations+names.length,'append provenance recorded');
  assert.deepEqual(base.json.animations.slice(provenance.animations).map((a:{name:string})=>a.name),names);
  assert.ok(base.binary.length-provenance.bytes<80000,'bounded one-clip payload');
  const receipt=await appendHamstrung(file,[...names]),first=await readFile(file),after=unpack(first);
  assert.deepEqual(receipt.clips,names);assert.ok(first.equals(shipped),'re-running the append reproduces the shipped file');
  const parsed=structuredClone(after.json);parsed.images=[];parsed.textures=[];parsed.materials=parsed.materials.map((m:{name:string})=>({name:m.name}));parsed.buffers[0].uri='data:application/octet-stream;base64,'+after.binary.toString('base64');
  const loaded=await new GLTFLoader().parseAsync(JSON.stringify(parsed),'');for(const name of names){const clip=loaded.animations.find(c=>c.name===name)!;assert.ok(clip.tracks.length>30 && Math.abs(clip.duration-3.8)<1e-6,'app loader reads the complete clip');}
  after.json.animations.push({...after.json.animations.at(-1),name:'LaterFinisher'});await writeFile(file,pack(after.json,after.binary));const newer=await readFile(file);
  await assert.rejects(appendHamstrung(file,[...names]),/Newer animations/);assert.ok((await readFile(file)).equals(newer));
 }}finally{await rm(dir,{recursive:true,force:true});}
});

test('the killer clip JSON is what the build writes from the untouched warrior.glb',async()=>{
 const warrior=unpack(await readFile(new URL('../src/assets/warrior.glb',import.meta.url)));
 assert.equal(warrior.json.extras?.hamstrungBase,undefined);assert.ok(!warrior.json.animations.some((a:{name:string})=>/Hamstrung/.test(a.name)));
 const dir=await mkdtemp(join(tmpdir(),'hamstrung-'));
 try{const out=join(dir,'killer.json');await writeHamstrungKiller(new URL('../src/assets/warrior.glb',import.meta.url),new URL('file://'+out));
  const made=await readFile(out),shipped=await readFile(new URL('../src/assets/hamstrung-killer.json',import.meta.url));assert.ok(made.equals(shipped),'shipped killer JSON is current');
  assert.ok(shipped.length<100000,'bounded payload');const clip=JSON.parse(shipped.toString());assert.equal(clip.name,'Fin_Hamstrung');assert.equal(clip.duration,3.8);assert.ok(clip.tracks.length>30);
 }finally{await rm(dir,{recursive:true,force:true});}
});
