// Production-only GLB packing: bit-exact geometry/animation, original used texture bytes.
// Source files stay self-contained and unchanged for Blender, baking and rig contracts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { MeshoptEncoder } from 'meshoptimizer';

export async function optimizeGlb(raw) {
 await MeshoptEncoder.ready;
 assert.equal(raw.readUInt32LE(0),0x46546c67,'Expected GLB');
 assert.equal(raw.readUInt32LE(4),2,'Expected GLB v2');
 const n=raw.readUInt32LE(12),d=JSON.parse(raw.subarray(20,20+n)),bin=raw.subarray(28+n);
 assert.equal(d.buffers.length,1,'Optimizer requires one embedded buffer');
 assert.ok(!d.extensionsUsed?.some(x=>['EXT_meshopt_compression','KHR_draco_mesh_compression'].includes(x)),'Source must be uncompressed');
 assert.ok(d.images.every(i=>i.bufferView!==undefined),'Textures must be embedded');
 // Offline equipment rollback document; the source GLB retains it for rebuilding.
 delete d.extras?.creatureWeaponBase;
 const preserveAll=d.extensionsUsed?.some(x=>['KHR_materials_variants','KHR_animation_pointer'].includes(x));
 const mats=new Set(d.meshes.flatMap(m=>m.primitives.map(p=>p.material)).filter(i=>i!==undefined)),textures=new Set(),images=new Set();
 if(preserveAll)d.materials.forEach((_,i)=>mats.add(i));
 const visitTextures=(o,fn)=>{if(!o||typeof o!=='object')return;for(const[k,v]of Object.entries(o)){if(k.endsWith('Texture')&&v?.index!==undefined)fn(v);else visitTextures(v,fn);}};
 for(const i of mats)visitTextures(d.materials[i],v=>textures.add(v.index));
 for(const i of textures){const t=d.textures[i];if(t.source!==undefined)images.add(t.source);for(const x of Object.values(t.extensions||{}))if(x.source!==undefined)images.add(x.source);}
 const select=(array,ids)=>{const map=new Map();const kept=array.filter((_,i)=>ids.has(i));let index=0;for(let i=0;i<array.length;i++)if(ids.has(i))map.set(i,index++);return {kept,map};};
 if(preserveAll){d.textures.forEach((_,i)=>textures.add(i));d.images.forEach((_,i)=>images.add(i));}
 const material=select(d.materials,mats),texture=select(d.textures,textures),image=select(d.images,images);
 const discardedViews=new Set(d.images.filter((_,i)=>!images.has(i)).map(i=>i.bufferView));
 for(const i of image.kept)discardedViews.delete(i.bufferView);
 for(const m of d.meshes)for(const p of m.primitives)if(p.material!==undefined)p.material=material.map.get(p.material);
 for(const m of material.kept)visitTextures(m,v=>v.index=texture.map.get(v.index));
 for(const t of texture.kept){if(t.source!==undefined)t.source=image.map.get(t.source);for(const x of Object.values(t.extensions||{}))if(x.source!==undefined)x.source=image.map.get(x.source);}
 d.materials=material.kept;d.textures=texture.kept;d.images=image.kept;
 const chunks=[],views=[],viewMap=new Map(),packedBytes=new Map(),packedViews=new Map();let offset=0,fallback=0;
 const append=bytes=>{const key=createHash('sha256').update(bytes).digest('hex');if(packedBytes.has(key))return packedBytes.get(key);const at=offset;packedBytes.set(key,at);chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return at;};
 for(const [i,v]of d.bufferViews.entries()){
  if(discardedViews.has(i))continue;
  const bytes=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),a=d.accessors.find(a=>a.bufferView===i);
  let encoded;
  const width=a&&{SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],stride=a&&(v.byteStride||width*({5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType]));
  const mode=v.target===34963?'INDICES':'ATTRIBUTES';
  if(a&&(mode==='INDICES'?[2,4].includes(stride):stride%4===0&&stride<=256)){
   encoded=MeshoptEncoder.encodeGltfBuffer(bytes,bytes.length/stride,stride,mode);
   if(gzipSync(encoded).length>=gzipSync(bytes).length)encoded=undefined;
  }
  const next={...v};
  if(encoded){next.buffer=1;next.byteOffset=0;next.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:append(Buffer.from(encoded)),byteLength:encoded.length,byteStride:stride,count:bytes.length/stride,mode,filter:'NONE'}};fallback=Math.max(fallback,bytes.length);}
  else {next.buffer=0;next.byteOffset=append(bytes);}
  const key=JSON.stringify(next);if(!packedViews.has(key)){packedViews.set(key,views.length);views.push(next);}
  viewMap.set(i,packedViews.get(key));
 }
 const remap=o=>{if(!o||typeof o!=='object')return;for(const[k,v]of Object.entries(o))if(k==='bufferView')o[k]=viewMap.get(v);else remap(v);};
 for(const a of d.accessors)remap(a);for(const image of d.images)remap(image);
 d.bufferViews=views;d.buffers=[{byteLength:offset},{byteLength:fallback,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 d.extensionsUsed=[...new Set([...(d.extensionsUsed||[]),'EXT_meshopt_compression'])];d.extensionsRequired=[...new Set([...(d.extensionsRequired||[]),'EXT_meshopt_compression'])];
 let json=Buffer.from(JSON.stringify(d));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=Buffer.concat(chunks),out=Buffer.alloc(28+json.length+binary.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(binary.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);binary.copy(out,28+json.length);
 return out;
}
