import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,LoopOnce,Quaternion,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {hamstrungClips,HAMSTRUNG_BEATS} from '../scripts/build-hamstrung.mjs';

test('Hamstrung authored motion: low cut, grounded knee buckle and folded held back strike on every current rig',async()=>{
 for(const id of ['warrior','veteran','pitborn','goblin','nightborn','executioner','minotaur','wraith']) {
  const bytes=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
  json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');
  globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
  const saved=new Map();asset.scene.traverse(o=>saved.set(o,[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));
  const [victim,killer]=hamstrungClips(asset.scene,asset.animations);
  for(const [o,pose] of saved)assert.deepEqual([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()],pose);
  assert.ok(HAMSTRUNG_BEATS.back-HAMSTRUNG_BEATS.knee>.35,'distinct readable phases');
  for(const clip of [victim,killer])for(const track of clip.tracks){
   assert.ok([...track.values].every(Number.isFinite),`${id} ${track.name} finite`);
   if(track.name.endsWith('.quaternion'))for(let i=4;i<track.values.length;i+=4){const a=new Quaternion().fromArray(track.values,i-4),b=new Quaternion().fromArray(track.values,i);assert.ok(Math.abs(b.length()-1)<1e-5);assert.ok(a.angleTo(b)<.7,`${id} ${clip.name} ${track.name} snap${a.angleTo(b)} key${i/4}`);}
  }
  const mixer=new AnimationMixer(asset.scene),play=(clip:typeof victim,p:number)=>{mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*p);asset.scene.updateMatrixWorld(true);};
  const point=(name:string)=>asset.scene.getObjectByName(name)!.getWorldPosition(new Vector3());
  play(victim,0);const standing=point('Head').y;
  play(victim,.53);assert.ok(point('Head').y<standing-.3,`${id} knee buckle lowers the body`);
  const before=point('spine_02');play(victim,1);assert.ok(point('spine_02').distanceTo(before)<.03,`${id} upper back stays available for the held blade`);
  for(const p of [0,.22,.3,.4,.5,.64,.8,1]){play(victim,p);const bounds=new Box3();asset.scene.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});assert.ok(bounds.min.y>-.035 && bounds.min.y<.08,`${id} grounded at${p}: ${bounds.min.y}`);}
  if(id==='warrior'){
   play(killer,0);const hand=point('hand_r').y;play(killer,HAMSTRUNG_BEATS.knee);assert.ok(point('hand_r').y<hand-.15,`first swing has a genuinely low silhouette: ${point('hand_r').y} from ${hand}`);
   for(const p of [.12,.22,.34]){play(killer,p);for(const side of ['l','r'])assert.ok(point('foot_'+side).y>-.04,`planted foot does not penetrate at${p}`);}
   play(killer,HAMSTRUNG_BEATS.back);const held=point('hand_r');play(killer,1);assert.ok(held.distanceTo(point('hand_r'))<.001,'no withdrawal after the back strike');
  }
  mixer.stopAllAction();mixer.uncacheRoot(asset.scene);
 }
});
