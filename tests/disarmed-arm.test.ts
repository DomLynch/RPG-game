import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,Group,LoopOnce,Mesh,SkinnedMesh,Vector3,BufferGeometry,Material} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disarmedClips} from '../scripts/build-disarmed.mjs';
import {prepareDisarmed} from '../src/disarmed.ts';

test('Disarmed cuts the actual arm and weapon, caps both sides, grounds the prop and restores borrowed meshes on all eight rigs',async()=>{
 for(const id of ['warrior','veteran','pitborn','goblin','nightborn','executioner','minotaur','wraith']) {
  const bytes=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
  json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
  globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
  const {scene,animations}=await new GLTFLoader().parseAsync(JSON.stringify(json),'');const [clip]=disarmedClips(scene,animations);
  const anchor=new Group(),world=new Group();world.position.set(3,0,-2);world.rotation.y=.8;world.add(anchor);anchor.add(scene);
  const mixer=new AnimationMixer(scene),action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*.16);world.updateMatrixWorld(true);
  const weapon=scene.getObjectByName('WeaponDrawn') ?? scene.getObjectByName('SwordDrawn')!;weapon.visible=true;
  const originals:Map<SkinnedMesh,BufferGeometry>=new Map();scene.traverse(o=>{if(o instanceof SkinnedMesh)originals.set(o,o.geometry);});
  let borrowedDisposals=0;const borrowedMaterials=new Set<Material>();for(const [mesh,g] of originals){g.addEventListener('dispose',()=>borrowedDisposals++);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])borrowedMaterials.add(material);}for(const material of borrowedMaterials)material.addEventListener('dispose',()=>borrowedDisposals++);
  const cut=prepareDisarmed(scene,anchor);anchor.add(cut.group);
  assert.equal(cut.group.visible,false);
  for(const [mesh,g] of originals)assert.equal(mesh.geometry,g,'preparation cannot mutate intact rig');
  cut.apply(.16,'red');world.updateMatrixWorld(true);
  assert.equal(weapon.visible,false,'weapon leaves hand with arm');
  assert.ok(cut.group.getObjectByName('ArmCut'),'arm has cut surface');assert.ok(scene.getObjectByName('ArmStump'),'body has cut surface');
  assert.ok([...originals].some(([mesh,g])=>mesh.geometry!==g),'arm actually removed from live skin');
  assert.ok(cut.group.children.some(o=>o instanceof Mesh && (Array.isArray(o.material)?o.material:[o.material]).some(m=>borrowedMaterials.has(m))),'original exterior survives');
  for(const progress of [.3,.5,.8,1]) {
    mixer.setTime(clip.duration*progress);cut.apply(progress,'red');world.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(cut.group,true);
    assert.ok(bounds.min.y>-.012,`${id} arm/weapon above sand ${bounds.min.y}`);
    if(progress>=.5){assert.ok(bounds.min.y<.025,`${id} prop lands ${bounds.min.y}`);assert.ok(bounds.max.y<.6,`${id} released weapon lies flat ${bounds.max.y}`);}
  }
  const settled=cut.group.position.clone();cut.apply(1,'red');assert.deepEqual(cut.group.position.toArray(),settled.toArray(),'held pose does not drift');
  cut.apply(1,'off');assert.equal(cut.group.visible,false);assert.equal(weapon.visible,true);for(const [mesh,g] of originals)assert.equal(mesh.geometry,g);
  cut.apply(1,'dark');assert.equal(cut.group.visible,true);const cap=cut.group.getObjectByName('ArmCut') as Mesh;assert.equal((cap.material as {color:{getHexString():string}}).color.getHexString(),'302126');
  const owned=new Set<BufferGeometry>();cut.group.traverse(o=>{if(o instanceof Mesh)owned.add(o.geometry);});for(const [mesh,g] of originals)if(mesh.geometry!==g)owned.add(mesh.geometry);scene.traverse(o=>{if(o instanceof SkinnedMesh && o.name==='ArmStump')owned.add(o.geometry);});let disposed=0;for(const g of owned)g.addEventListener('dispose',()=>disposed++);
  cut.dispose();assert.equal(disposed,owned.size,'every owned geometry released');assert.equal(borrowedDisposals,0,'source meshes/materials remain usable');assert.equal(cut.group.parent,null);assert.equal(scene.getObjectByName('ArmStump'),undefined);assert.equal(weapon.visible,true);for(const [mesh,g] of originals)assert.equal(mesh.geometry,g);
  assert.ok(scene.getObjectByName('hand_l')!.getWorldPosition(new Vector3()).toArray().every(Number.isFinite));
  mixer.stopAllAction();mixer.uncacheRoot(scene);
 }
});
