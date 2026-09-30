import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendQuietOne } from '../scripts/build-quiet-one.mjs';

const unpack = (bytes: Buffer) => { const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n).toString()),binary:bytes.subarray(28+n)}; };
const pack = (json: object, binary: Buffer) => {
  const raw=Buffer.from(JSON.stringify(json)), js=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]), bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
  const h=Buffer.alloc(20),b=Buffer.alloc(8);[0x46546c67,2,28+js.length+bin.length,js.length,0x4e4f534a].forEach((v,i)=>h.writeUInt32LE(v,i*4));b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,js,b,bin]);
};
test('Quiet One append preserves every existing animation, skin, material and binary byte; reruns are identical and refuse newer clips [slow]', async () => {
  for (const rig of ['veteran', 'warrior']) { // full exporter and additive shipped rigs
    const {json,binary}=unpack(await readFile(new URL(`../src/assets/${rig}.glb`,import.meta.url)));
    let base=json.extras?.quietOneBase;
    if (base) {
      json.animations.length=base.animations;json.bufferViews.length=base.views;json.accessors.length=base.accessors;json.buffers[0].byteLength=base.bytes;delete json.extras.quietOneBase;
    } else {
      // A full export has no append boundary. Remove only the clip entry; all
      // existing accessors, views and binary bytes remain the preserved baseline.
      json.animations=json.animations.filter((clip: {name: string}) => clip.name!=='Death_QuietOne');
      base={animations:json.animations.length,views:json.bufferViews.length,accessors:json.accessors.length,bytes:json.buffers[0].byteLength};
    }
    const original=structuredClone(json), source=binary.subarray(0,base.bytes), dir=await mkdtemp(join(tmpdir(),'quiet-one-')), file=join(dir,'veteran.glb');
    try {
      await writeFile(file,pack(json,source));await appendQuietOne(file);
      const first=await readFile(file), after=unpack(first);
      assert.deepEqual(after.binary.subarray(0,source.length),source);
      for(const key of ['nodes','meshes','skins','materials','images','textures']) assert.deepEqual(after.json[key],original[key],key);
      assert.deepEqual(after.json.animations.slice(0,base.animations),original.animations);
      assert.deepEqual(after.json.accessors.slice(0,base.accessors),original.accessors);
      assert.equal(after.json.animations.at(-1).name,'Death_QuietOne');
      await appendQuietOne(file);assert.deepEqual(await readFile(file),first,'idempotent binary append');
      after.json.animations.push({...after.json.animations.at(-1),name:'LaterFinisher'});await writeFile(file,pack(after.json,after.binary));
      const newer=await readFile(file);await assert.rejects(appendQuietOne(file),/Newer animations/);assert.deepEqual(await readFile(file),newer);
    } finally {await rm(dir,{recursive:true,force:true});}
  }
});
