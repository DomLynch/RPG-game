// CPU regression: an attached-looking collar in one pose must also stay joined in motion.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AnimationMixer, Vector3, Line3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitVeteranNeck, textureVeteranTrident } from './veteran-finish.mjs';

function parse(raw) { const n=raw.readUInt32LE(12);return {doc:JSON.parse(raw.subarray(20,20+n)),bin:raw.subarray(28+n)}; }
function values({doc,bin},id) {
  const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const [size,read]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>bin[read]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width)+k*size)));
}
async function geometryOnly({doc,bin}) {
  doc=structuredClone(doc);
  for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
  for(const key of ['materials','textures','images','samplers','extensionsRequired','extensionsUsed'])delete doc[key];
  const text=Buffer.from(JSON.stringify(doc)),json=Buffer.concat([text,Buffer.alloc(-text.length&3,32)]),raw=Buffer.alloc(28+json.length+bin.length);
  raw.writeUInt32LE(0x46546c67);raw.writeUInt32LE(2,4);raw.writeUInt32LE(raw.length,8);raw.writeUInt32LE(json.length,12);raw.writeUInt32LE(0x4e4f534a,16);json.copy(raw,20);
  raw.writeUInt32LE(bin.length,20+json.length);raw.writeUInt32LE(0x004e4942,24+json.length);bin.copy(raw,28+json.length);
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
}
const path=process.argv[2]??'src/assets/veteran.glb',raw=await fs.readFile(path),asset=parse(raw);
const source=parse(await fs.readFile('src/assets/source/parts/body_veteran.glb'));
const authored=name=>source.doc.meshes[source.doc.nodes.find(n=>n.extras?.material===name).mesh].primitives[0];
const current=name=>asset.doc.meshes.flatMap(m=>m.primitives).find(p=>asset.doc.materials[p.material].name===name);
const cut=Math.max(...values(source,authored('Face').attributes.POSITION).map(v=>v[1]))-.0015;
const receipt={path,sha256:createHash('sha256').update(raw).digest('hex'),cut,moved:{},poses:0,maxSeamMm:0};
assert.ok(Math.abs(Math.max(...values(asset,current('Face').attributes.POSITION).map(v=>v[1]))-cut)<.00003,'Body overlap must be removed, not hidden with texture');
for(const name of ['Photo','Face']) {
  const a=authored(name),b=current(name),sourcePositions=values(source,a.attributes.POSITION),now=values(asset,b.attributes.POSITION);
  const sourceIndices=values(source,a.indices).flat(),indices=values(asset,b.indices).flat();
  const sourceUv=values(source,a.attributes.TEXCOORD_0),uv=values(asset,b.attributes.TEXCOORD_0);
  assert.equal(indices.length,sourceIndices.length,'Original triangle count');
  assert.equal(sourcePositions.length,now.length,'Original vertex count');
  const old=Array(now.length);
  // The builder reorders vertices by first use; compare corresponding triangle corners.
  for(let k=0;k<indices.length;k++) {
    const i=indices[k],j=sourceIndices[k];
    assert.deepEqual(uv[i],sourceUv[j],'Original corner UVs and topology');
    if(old[i])assert.deepEqual(old[i],sourcePositions[j],'Consistent vertex correspondence');
    old[i]=sourcePositions[j];
  }
  assert.ok(old.every(Boolean));
  let moved=0;
  for(let i=0;i<old.length;i++) {
    const distance=Math.hypot(...now[i].map((x,k)=>x-old[i][k]));
    if(distance<1e-8)continue;
    moved++;
    assert.ok(distance<.03,`${name}: no substantial reshaping`);
    assert.ok(name==='Photo' ? old[i][1]>=cut-.00003 && old[i][1]<cut+.056 : old[i][1]>cut-.024,`${name}: facial features and lower body unchanged`);
  }
  receipt.moved[name]=moved;
  for(const key of ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0']) {
    const id=b.attributes[key],a=asset.doc.accessors[id],rows=values(asset,id);
    for(const [bound,extreme] of [['min',Math.min],['max',Math.max]])assert.deepEqual(a[bound],rows[0].map((_,k)=>extreme(...rows.map(v=>v[k]))),`${name} ${key} accurate ${bound} metadata`);
  }
  for(const w of values(asset,b.attributes.WEIGHTS_0))assert.ok(w.every(x=>x>=0&&x<=1)&&Math.abs(w.reduce((s,x)=>s+x,0)-1)<1e-5,'Normalized skin weights');
}
assert.ok(fitVeteranNeck(raw).glb.equals(raw),'Idempotent geometry finish');
assert.ok(textureVeteranTrident(raw).equals(raw),'Idempotent weapon finish');
const metal=asset.doc.materials.find(m=>m.name==='TridentBronze'),bronze=asset.doc.materials.find(m=>m.name==='Bronze');
if(metal){ // the procedural trident (WEAPON_VARIANT=short|A|B|C) borrows the helm's maps
  assert.deepEqual(metal.pbrMetallicRoughness,bronze.pbrMetallicRoughness,'Weapon shares approved worn bronze maps');
  assert.equal(metal.normalTexture.index,bronze.normalTexture.index);assert.equal(metal.normalTexture.scale,.35);
}else{ // the reconstructed trident (weapons lane Phase 2, scripts/weapon-fit.py) carries its own colour and metal/rough maps
  const head=asset.doc.materials.find(m=>m.name==='WeaponTrident'),shaft=asset.doc.materials.find(m=>m.name==='WeaponTridentShaft');
  assert.ok(head?.pbrMetallicRoughness.baseColorTexture&&head.pbrMetallicRoughness.metallicRoughnessTexture,'Reconstructed head has its own colour and metal/rough maps');
  assert.ok(shaft?.pbrMetallicRoughness.baseColorTexture&&shaft.pbrMetallicRoughness.metallicFactor===0,'Reconstructed shaft has its baked colour map and no metal');
}
const rig=await geometryOnly(asset),head=rig.scene.getObjectByName('Photo'),face=rig.scene.getObjectByName('Face');
const p=head.geometry.attributes.position,q=face.geometry.attributes.position;
const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(','),edges=new Map(),ix=head.geometry.index.array;
for(let k=0;k<ix.length;k+=3)for(let e=0;e<3;e++){const edge=[key(ix[k+e]),key(ix[k+(e+1)%3])].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}
const boundary=new Set([...edges].filter(([,n])=>n===1).flatMap(([k])=>k.split('|')));
const ring=Array.from({length:p.count},(_,i)=>i).filter(i=>boundary.has(key(i))&&Math.abs(p.getY(i)-cut)<.00003);
const rim=Array.from({length:q.count},(_,i)=>i).filter(i=>Math.abs(q.getY(i)-cut)<.00003);
assert.ok(ring.length>100&&rim.length>30,'Actual collar boundary found');
const axis=[0,2].map(k=>(Math.min(...rim.map(i=>q.getComponent(i,k)))+Math.max(...rim.map(i=>q.getComponent(i,k))))/2);
rim.sort((a,b)=>Math.atan2(q.getZ(a)-axis[1],q.getX(a)-axis[0])-Math.atan2(q.getZ(b)-axis[1],q.getX(b)-axis[0]));
const mixer=new AnimationMixer(rig.scene),point=new Vector3(),closest=new Vector3();
const clips=rig.animations;
assert.ok(clips.length>=30);
for(const clip of [null,...clips])for(const time of (clip?[0,.25,.5,.75,.99]:[0])) {
  mixer.stopAllAction();if(clip){mixer.clipAction(clip).play();mixer.setTime(time*clip.duration);}
  rig.scene.updateMatrixWorld(true);rig.scene.traverse(o=>o.skeleton?.update());
  const positions=rim.map(i=>face.getVertexPosition(i,new Vector3()).applyMatrix4(face.matrixWorld));
  const segments=positions.map((v,i)=>new Line3(v,positions[(i+1)%positions.length]));
  for(const i of ring) {
    head.getVertexPosition(i,point).applyMatrix4(head.matrixWorld);
    let distance=Infinity;
    for(const segment of segments)distance=Math.min(distance,point.distanceTo(segment.closestPointToPoint(point,true,closest)));
    receipt.maxSeamMm=Math.max(receipt.maxSeamMm,distance*1000);
    assert.ok(distance<.00005,`${clip?.name??'bind'} t=${time}: neck opens ${(distance*1000).toFixed(3)}mm`);
  }
  receipt.poses++;
}
receipt.passed=true;
await fs.mkdir('artifacts/character/veteran-neck',{recursive:true});
await fs.writeFile('artifacts/character/veteran-neck/checks.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
