import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {AnimationClip,Group,Vector3,Mesh,MeshStandardMaterial,Box3,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildWarriors} from '../src/characters.ts';
import {HAMSTRUNG_BEATS,HAMSTRUNG_SOURCE_PELVIS} from '../src/hamstrung.ts';
const clip=(file:string)=>()=>AnimationClip.parse(JSON.parse(readFileSync(new URL(`../src/assets/${file}.json`,import.meta.url),'utf8')));
const killer=clip('hamstrung-killer'),victimClip=clip('hamstrung-victim-hero');
async function load(id:string){
 const b=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString());
 j.images=[];j.textures=[];j.materials=j.materials.map((m:{name:string})=>({name:m.name}));j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(28+n).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(j),'');
}
const worst:Record<string,number>={};
test('Hamstrung is optional per rig, and where installed its low cut and held back thrust meet each victim',async()=>{
 const legacy=buildWarriors(await load('veteran'));legacy.player.update(0,.1,'ready');
 assert.throws(()=>legacy.player.update(0,0,'hamstrungStrike',0),/not installed/);assert.throws(()=>legacy.opponent.update(0,0,'hamstrung',0),/not installed/);
 const hero=await load('warrior');
 assert.ok(!hero.animations.some(c=>c.name==='Fin_Hamstrung'),'warrior.glb carries no Hamstrung clip');
 // The creatures carry their own Death_Hamstrung (adoptClip leaves it); every other body wears the one clip built from warrior.glb, its pelvis path scaled to its own.
 // The goblin is not a victim in the game (its rig is its own) but is measured: the smallest body, shortest legs.
 for(const [id,weapon] of [['minotaur','maul'],['wraith','reaper'],['pitborn','cleaver'],['goblin','knife'],['dwarf','warhammer'],['executioner','scythe']] as const){
  const victim=await load(id);
  const actors=buildWarriors(hero,victim,['longsword',weapon]);actors.player.adoptClip('Fin_Hamstrung',killer());actors.opponent.adoptClip('Death_Hamstrung',victimClip(),HAMSTRUNG_SOURCE_PELVIS);const player=new Group(),enemy=new Group();player.add(actors.player.anchor);enemy.add(actors.opponent.anchor);
  for(const heading of [0,.8,2.4])for(const gap of [1,1.5,2.1]){
   player.position.set(2,0,-1);player.rotation.y=heading;enemy.position.copy(player.position).add(new Vector3(Math.sin(heading)*gap,0,Math.cos(heading)*gap));enemy.rotation.y=heading+Math.PI;
   player.updateMatrixWorld(true);enemy.updateMatrixWorld(true);
   const before=actors.opponent.boneWorld('Head')!,contacts=actors.opponent.hamstrungContacts();if(process.env.HAMSTRUNG_REPORT&&gap===1&&heading===0)console.log(id,'knee y',contacts.knee.y.toFixed(3),'back y',contacts.back.y.toFixed(3),'head y',before.y.toFixed(3),'step to knee',actors.player.hamstrungStep(HAMSTRUNG_BEATS.knee,contacts.knee).length().toFixed(3),'step to back',actors.player.hamstrungStep(HAMSTRUNG_BEATS.back,contacts.back).length().toFixed(3));assert.ok(before.distanceTo(actors.opponent.boneWorld('Head')!)<1e-6,'sampling restores live pose');
   for(const progress of [HAMSTRUNG_BEATS.knee,HAMSTRUNG_BEATS.back,.85,1]){
    const first=progress===HAMSTRUNG_BEATS.knee,step=actors.player.hamstrungStep(first?HAMSTRUNG_BEATS.knee:HAMSTRUNG_BEATS.back,first?contacts.knee:contacts.back);
    actors.player.update(0,.016,'hamstrungStrike',progress);actors.opponent.update(0,.016,'hamstrung',progress);actors.player.anchor.position.copy(step);
    const target=actors.opponent.boneWorld(first?'calf_r':'spine_02')!;actors.player.aimBladeAt(target,1,false);player.updateMatrixWorld(true);
    const blade=actors.player.anchor.getObjectByName('SwordDrawn')!,middle=blade.localToWorld(new Vector3(0,(.24+.85)/2,0));
    worst[id]=Math.max(worst[id]??0,middle.distanceTo(target));assert.ok(middle.distanceTo(target)<.025,`${id} ${progress} ${gap} ${heading}: miss${middle.distanceTo(target)}`);
    assert.equal(actors.player.anchor.position.y,0,'presentation step stays on the floor');
   }
   actors.player.update(0,.1,'ready');actors.opponent.update(0,.1,'ready');
  }
 }
 if(process.env.HAMSTRUNG_REPORT)console.log('worst blade-middle to contact, metres',JSON.stringify(worst));
});

test('Hamstrung drops each real weapon onto the floor and restores it on rematch; the Wraith ghost holds through the embedded ending',async()=>{
 const hero=await load('warrior');
 assert.ok(!hero.animations.some(c=>c.name==='Fin_Hamstrung'),'warrior.glb carries no Hamstrung clip');
 for(const [id,weapon] of [['minotaur','maul'],['wraith','reaper']] as const){
  const victim=await load(id);
  const {opponent:actor}=buildWarriors(hero,victim,['longsword',weapon]);
  actor.update(0,.1,'ready');const before=actor.boneWorld('hand_r')!;actor.prepareHamstrung();assert.ok(before.distanceTo(actor.boneWorld('hand_r')!)<1e-6);
  const drop=actor.anchor.getObjectByName('DroppedWeapon')!,held=actor.anchor.getObjectByName('WeaponDrawn')??actor.anchor.getObjectByName('SwordDrawn')!;
  const sourceGeometries=new Set(),sourceMaterials=new Set();let borrowedDisposed=0,ownedDisposed=0,ownedCount=0;
  held.traverse(o=>{if(o instanceof Mesh){sourceGeometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])sourceMaterials.add(m);}});
  drop.traverse(o=>{if(o instanceof Mesh){assert.ok(!sourceGeometries.has(o.geometry));ownedCount++;o.geometry.addEventListener('dispose',()=>ownedDisposed++);for(const m of Array.isArray(o.material)?o.material:[o.material])assert.ok(sourceMaterials.has(m));}});
  for(const resource of [...sourceGeometries,...sourceMaterials]) (resource as import('three').BufferGeometry).addEventListener('dispose',()=>borrowedDisposed++);
  actor.update(0,.016,'hamstrung',.1);assert.equal(drop.visible,false);assert.equal(held.visible,true);
  for(let i=0;i<=120;i++){
   actor.update(0,HAMSTRUNG_BEATS.duration/121,'hamstrung',i/120);actor.anchor.updateMatrixWorld(true);
   if(id==='wraith')assert.equal((actor.anchor.getObjectByName('CreatureBody') as Mesh).material instanceof MeshStandardMaterial && ((actor.anchor.getObjectByName('CreatureBody') as Mesh).material as MeshStandardMaterial).opacity,.86,'ghost holds for the full scene');
   if(drop.visible){const box=new Box3().setFromObject(drop,true);assert.ok(box.min.y>-.012,`${id} weapon below floor ${box.min.y}`);}
  }
  assert.equal(drop.visible,true);
  {
   const box=new Box3().setFromObject(drop,true);assert.ok(box.min.y<.025,`${id} weapon floats ${box.min.y}`);assert.ok(box.max.y-box.min.y<.55,`${id} weapon must lie flat`);assert.equal(held.visible,false);
   // Updating the death pose must not bring the attached sword back for a frame.
   actor.update(0,0,'hamstrung',1);assert.equal(held.visible,false);
  }
  if(id==='wraith'){for(let i=0;i<25;i++)actor.update(0,.1,'hamstrung',1);assert.equal(((actor.anchor.getObjectByName('CreatureBody') as Mesh).material as MeshStandardMaterial).opacity,0);assert.equal(drop.visible,true,'the Wraith reaper stays on the sand after the ghost has gone');}
  actor.unsever();actor.update(0,.1,'ready');assert.equal(held.visible,true);assert.equal(actor.anchor.getObjectByName('DroppedWeapon'),undefined);assert.equal(ownedDisposed,ownedCount);assert.equal(borrowedDisposed,0);
 }
});

// The one clip is built on warrior.glb's proportions; the size extremes must still end on the floor, neither sunk nor hovering (goblin: smallest, shortest legs; pitborn: largest hero body).
test('the hero-rig victim clip keeps the goblin and the Pitborn on the floor through the kneel and the held ending',async()=>{
 const hero=await load('warrior'),pelvis=hero.scene.getObjectByName('pelvis')!.position.length();
 assert.ok(Math.abs(pelvis-HAMSTRUNG_SOURCE_PELVIS)<.001,'the pelvis constant is warrior.glb\'s');
 for(const [id,weapon] of [['pitborn','cleaver'],['goblin','knife']] as const){
  const {opponent}=buildWarriors(hero,await load(id),['longsword',weapon]);opponent.adoptClip('Death_Hamstrung',victimClip(),HAMSTRUNG_SOURCE_PELVIS);
  const floor=()=>{const bounds=new Box3();opponent.anchor.updateMatrixWorld(true);opponent.anchor.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});return bounds.min.y;};
  opponent.update(0,.1,'ready');const standing=floor();
  for(const p of [0,HAMSTRUNG_BEATS.knee,.4,.5,HAMSTRUNG_BEATS.back,1]){opponent.update(0,.016,'hamstrung',p);assert.ok(Math.abs(floor()-standing)<.03,`${id} ${p}: ${floor()-standing}`);}
 }
});
