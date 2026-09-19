import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildWarriors} from '../src/characters.ts';
import {disarmedClips,DISARMED_BEATS} from '../scripts/build-disarmed.mjs';
import {prepareDisarmed} from '../src/disarmed.ts';

async function load(id:string){
 const bytes=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
 json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
test('Disarmed draft paired contacts meet actual forearm cut and neck across six bodies, off-axis headings and spacings',async()=>{
 const hero=await load('warrior'),[,killer]=disarmedClips(hero.scene,hero.animations);
 // Exercise the production aim helper with the new clips before registering new public roles.
 hero.animations=hero.animations.map(c=>c.name==='Fin_RunThrough' ? Object.assign(killer.clone(),{name:c.name}) : c);
 for(const [id,weapon] of [['warrior','longsword'],['veteran','trident'],['pitborn','cleaver'],['goblin','knife'],['nightborn','estoc'],['executioner','scythe']] as const){
  const enemy=await load(id),[victim]=disarmedClips(enemy.scene,enemy.animations);enemy.animations=enemy.animations.map(c=>c.name==='Death_QuietOne' ? Object.assign(victim.clone(),{name:c.name}) : c);
  const actors=buildWarriors(hero,enemy,['longsword',weapon]),player=new Group(),opponent=new Group();player.add(actors.player.anchor);opponent.add(actors.opponent.anchor);
  for(const heading of [0,.8,2.4])for(const gap of [1,1.5,2.1])for(const progress of [DISARMED_BEATS.arm,DISARMED_BEATS.neck]){
   player.position.set(2,0,-1);player.rotation.y=heading;opponent.position.copy(player.position).add(new Vector3(Math.sin(heading)*gap,0,Math.cos(heading)*gap));opponent.rotation.y=heading+Math.PI;
   for(let i=0;i<8;i++){actors.player.update(0,.1,'runThroughHold',progress);actors.opponent.update(0,.1,'quietOne',progress);}
   player.updateMatrixWorld(true);opponent.updateMatrixWorld(true);
   const target=actors.opponent.boneWorld(progress===DISARMED_BEATS.arm ? 'lowerarm_r' : 'neck_01')!;
   let cut:ReturnType<typeof prepareDisarmed>|undefined;
   if(progress===DISARMED_BEATS.arm){cut=prepareDisarmed(actors.opponent.anchor.children[0],actors.opponent.anchor);cut.apply(progress,'red');opponent.updateMatrixWorld(true);const cap=actors.opponent.anchor.getObjectByName('ArmStump')! as import('three').SkinnedMesh;cap.skeleton.update();cap.getVertexPosition(0,target).applyMatrix4(cap.matrixWorld);}
   actors.player.aimBladeAt(target,1);player.updateMatrixWorld(true);
   const blade=actors.player.anchor.getObjectByName('SwordDrawn')!,middle=blade.localToWorld(new Vector3(0,(.24+.85)/2,0));
   assert.ok(middle.distanceTo(target)<.025,`${id} p${progress} gap${gap} heading${heading}: contact miss${middle.distanceTo(target)}`);
   assert.ok(Math.abs(actors.player.anchor.position.y)<1e-8,'presentation step stays grounded');
   cut?.dispose();
  }
 }
});
