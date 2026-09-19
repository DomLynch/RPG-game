import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Vector3,Mesh,MeshStandardMaterial,Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {finisherBloodSources} from '../src/finisher-blood.ts';
import {buildWarriors} from '../src/characters.ts';
import {disarmedClips,DISARMED_BEATS} from '../scripts/build-disarmed.mjs';

async function load(id:string){
 const bytes=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
 json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
test('Disarmed draft paired contacts meet actual forearm cut and neck across eight bodies, off-axis headings and spacings',async()=>{
 const hero=await load('warrior'),[,killer]=disarmedClips(hero.scene,hero.animations);
 hero.animations=hero.animations.filter(c=>c.name!==killer.name);hero.animations.push(killer);
 for(const [id,weapon] of [['warrior','longsword'],['veteran','trident'],['pitborn','cleaver'],['goblin','knife'],['nightborn','estoc'],['executioner','scythe'],['minotaur','maul'],['wraith','claws']] as const){
  const enemy=await load(id),[victim]=disarmedClips(enemy.scene,enemy.animations);enemy.animations=enemy.animations.filter(c=>c.name!==victim.name);enemy.animations.push(victim);
  const actors=buildWarriors(hero,enemy,['longsword',weapon]),player=new Group(),opponent=new Group();player.add(actors.player.anchor);opponent.add(actors.opponent.anchor);
  for(const heading of [0,.8,2.4])for(const gap of [1,1.5,2.1])for(const progress of [DISARMED_BEATS.arm,DISARMED_BEATS.neck]){
   player.position.set(2,0,-1);player.rotation.y=heading;opponent.position.copy(player.position).add(new Vector3(Math.sin(heading)*gap,0,Math.cos(heading)*gap));opponent.rotation.y=heading+Math.PI;
   player.updateMatrixWorld(true);opponent.updateMatrixWorld(true);
   const before=actors.opponent.boneWorld('Head')!,playing=actors.opponent.playing(),contacts=actors.opponent.disarmedContacts();
   assert.ok(before.distanceTo(actors.opponent.boneWorld('Head')!)<1e-6,'contact sampling restores the live pose');assert.equal(actors.opponent.playing(),playing);
   const planned=progress===DISARMED_BEATS.arm?contacts.arm:contacts.neck;
   const step=actors.player.disarmedStep(progress,planned);
   actors.player.update(0,.016,'disarmedStrike',progress);actors.opponent.update(0,.016,'disarmed',progress);
   actors.player.anchor.position.copy(step);

   player.updateMatrixWorld(true);opponent.updateMatrixWorld(true);
   const target=actors.opponent.boneWorld(progress===DISARMED_BEATS.arm ? 'lowerarm_r' : 'neck_01')!;

   if(progress===DISARMED_BEATS.arm){actors.opponent.prepareDisarmed();actors.opponent.disarm(progress,'red');opponent.updateMatrixWorld(true);const cap=actors.opponent.anchor.getObjectByName('ArmStump')! as import('three').SkinnedMesh;cap.skeleton.update();cap.getVertexPosition(0,target).applyMatrix4(cap.matrixWorld);}
   const sources=finisherBloodSources('disarmed',opponent,null);
   if(progress===DISARMED_BEATS.arm){assert.deepEqual(sources.map(s=>s.site),['arm-stump','detached-arm']);assert.ok(sources[0].position.distanceTo(target)<.001,'blood originates on actual animated cut');assert.ok(sources.every(s=>s.position.toArray().every(Number.isFinite)));}
   else assert.deepEqual(sources,[],'no neck blood before the head is severed');
   actors.player.aimBladeAt(target,1,false);player.updateMatrixWorld(true);
   const blade=actors.player.anchor.getObjectByName('SwordDrawn')!,middle=blade.localToWorld(new Vector3(0,(.24+.85)/2,0));
   assert.ok(middle.distanceTo(target)<.025,`${id} p${progress} gap${gap} heading${heading}: contact miss${middle.distanceTo(target)}`);
   assert.ok(Math.abs(actors.player.anchor.position.y)<1e-8,'presentation step stays grounded');
   actors.opponent.unsever();assert.equal(actors.opponent.anchor.getObjectByName('ArmStump'),undefined,'rematch removes the prepared cut');actors.player.update(0,.1,'ready');actors.opponent.update(0,.1,'ready');
  }
 }
});


test('Wraith Disarmed parts keep cut-safe ghost materials, pause their fade, then disappear together and release only owned materials',async()=>{
 const actors=buildWarriors(await load('warrior'),await load('wraith'),['longsword','claws']);
 const world=new Group();world.add(actors.opponent.anchor);actors.opponent.prepareDisarmed();
 actors.opponent.update(0,.1,'disarmed',.58);actors.opponent.disarm(.58,'red');world.updateMatrixWorld(true);
 const body=actors.opponent.anchor.getObjectByName('CreatureBody') as Mesh,source=body.material as MeshStandardMaterial;
 let sourceDisposed=0;source.addEventListener('dispose',()=>sourceDisposed++);
 const head=actors.opponent.sever()!;world.add(head.group);
 const marker=new Object3D();marker.name='BloodHeadCut';head.group.add(marker);
 const owned=new Set<MeshStandardMaterial>();head.group.traverse(o=>{if(o instanceof Mesh){assert.equal(o.castShadow,false);for(const m of Array.isArray(o.material)?o.material:[o.material]){assert.notEqual(m,source);assert.equal(m.customProgramCacheKey(),'wraith-cut-v1');owned.add(m as MeshStandardMaterial);}}});
 assert.ok(owned.size>0);let disposed=0;for(const material of owned)material.addEventListener('dispose',()=>disposed++);
 head.group.visible=false;actors.opponent.update(0,0,'disarmed',.58);assert.equal(head.group.visible,false,'spectral update cannot undo the caller blood-off visibility');head.group.visible=true;
 const opacity=[...owned][0].opacity;for(let i=0;i<20;i++)actors.opponent.update(0,0,'disarmed',.58);assert.equal([...owned][0].opacity,opacity,'zero-dt probes cannot consume the ghost hold');
 for(let i=0;i<60;i++){actors.opponent.update(0,.1,'disarmed',1);actors.opponent.disarm(1,'red');}
 assert.equal(head.group.visible,false);assert.equal(actors.opponent.anchor.getObjectByName('DisarmedArm')!.visible,false);assert.deepEqual(finisherBloodSources('disarmed',world,head.group),[]);
 head.group.removeFromParent();head.group.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});actors.opponent.unsever();actors.opponent.update(0,.1,'ready');
 assert.equal(disposed,owned.size);assert.equal(sourceDisposed,0);assert.equal(source.opacity,.86);assert.equal(actors.opponent.anchor.getObjectByName('Head')!.scale.x,1);
});
