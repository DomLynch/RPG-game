import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,LoopOnce,Quaternion,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {executionClips} from '../scripts/build-execution.mjs';
import {EXECUTION_BEATS,executionAt} from '../src/execution.ts';

test('Execution authored motion: kneel turned away, a held half-second with both rigs frozen, the cut, the fall onto the face',async()=>{
 const bytes=await readFile(new URL('../src/assets/warrior.glb',import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
 json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
 const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const saved=new Map();asset.scene.traverse(o=>saved.set(o,[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));
 const [victim,killer]=executionClips(asset.scene,asset.animations);
 for(const [o,pose] of saved)assert.deepEqual([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()],pose,'building leaves the rig as it found it');
 // The length: 2.4-2.8 s authored, about 3.5 s on screen at the spec's 0.75x for a cinematic finisher.
 assert.ok(victim.duration>=2.4 && victim.duration<=2.8 && killer.duration===victim.duration);
 const onScreen=EXECUTION_BEATS.duration/EXECUTION_BEATS.speed;assert.ok(onScreen>3.2 && onScreen<3.7,`on-screen length ${onScreen}`);
 // The held beat: half a second on the screen's own clock, and the beats fall in order.
 assert.ok(Math.abs((EXECUTION_BEATS.release-EXECUTION_BEATS.raise)*executionAt(1)-EXECUTION_BEATS.hold)<1e-9,'the held beat is 0.5 s on screen');
 assert.equal(EXECUTION_BEATS.hold,.5);
 assert.ok(EXECUTION_BEATS.drop<EXECUTION_BEATS.kneel && EXECUTION_BEATS.kneel<=EXECUTION_BEATS.raise && EXECUTION_BEATS.raise<EXECUTION_BEATS.release && EXECUTION_BEATS.release<EXECUTION_BEATS.strike && EXECUTION_BEATS.strike<EXECUTION_BEATS.fall && EXECUTION_BEATS.fall<1);
 // The wrist alone may turn faster than a radian a frame: it is the one cut, a sword's turn over in a quarter second.
 for(const clip of [victim,killer])for(const track of clip.tracks){
  assert.ok([...track.values].every(Number.isFinite),`${clip.name} ${track.name} finite`);
  if(track.name.endsWith('.quaternion'))for(let i=4;i<track.values.length;i+=4){const a=new Quaternion().fromArray(track.values,i-4),b=new Quaternion().fromArray(track.values,i);assert.ok(Math.abs(b.length()-1)<1e-5);assert.ok(a.angleTo(b)<(clip===killer && track.name==='hand_r.quaternion' ? 1 : .7),`${clip.name} ${track.name} snap ${a.angleTo(b)} key ${i/4}`);}
 }
 const mixer=new AnimationMixer(asset.scene),play=(clip:typeof victim,p:number)=>{mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*p);asset.scene.updateMatrixWorld(true);};
 const point=(name:string)=>asset.scene.getObjectByName(name)!.getWorldPosition(new Vector3());
 const pose=(clip:typeof victim,p:number)=>{play(clip,p);const out:{q:Quaternion,p:Vector3}[]=[];asset.scene.traverse(o=>{if(o.isBone)out.push({q:o.quaternion.clone(),p:o.position.clone()});});return out;};
 const apart=(a:ReturnType<typeof pose>,b:ReturnType<typeof pose>)=>Math.max(...a.map((x,i)=>Math.max(x.q.angleTo(b[i].q),x.p.distanceTo(b[i].p))));
 const {raise,release}=EXECUTION_BEATS;
 for(const clip of [victim,killer])for(const p of [(raise+release)/2,release]){const worst=apart(pose(clip,raise),pose(clip,p));assert.ok(worst<2e-3,`${clip.name} holds one pose through the half-second (${worst} at ${p})`);}
 for(const clip of [victim,killer]){const moved=apart(pose(clip,release),pose(clip,release+.03));assert.ok(moved>.002||clip===victim,'the killer starts the cut the moment the hold ends');}
 // The victim: stands, kneels turned away with the head bowed, falls forward onto his face and settles; the killer's blade is up over him through the hold.
 const standing=(play(victim,0),point('Head').y);
 play(victim,raise);const kneel={head:point('Head'),neck:point('neck_01'),pelvis:point('pelvis')};
 assert.ok(kneel.head.y<standing-.3,'forced to his knees');assert.ok(kneel.head.z<kneel.pelvis.z-.25,'turned away from the killer (his head is on the far side of his hips), bowed forward');
 play(victim,1);const end={head:point('Head'),pelvis:point('pelvis')};
 assert.ok(end.head.y<.4,`face down on the sand (head ${end.head.y})`);assert.ok(end.head.z<kneel.head.z-.5,'pitched forward, away from the killer');
 play(victim,.95);assert.ok(point('Head').distanceTo(end.head)<.05,'settled by the end');
 for(const p of [0,.06,.2,.3,.36,.5,.56,.7,.86,1]){play(victim,p);const bounds=new Box3();asset.scene.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});assert.ok(bounds.min.y>-.035 && bounds.min.y<.08,`grounded at ${p}: ${bounds.min.y}`);}
 play(killer,0);const hand=point('hand_r').y;play(killer,raise);assert.ok(point('hand_r').y>point('Head').y+.1,'the blade is raised overhead for the hold');assert.ok(point('hand_r').y>hand+.4);
 const raised=(play(killer,raise),point('hand_r').y);play(killer,1);assert.ok(point('hand_r').y<raised-.3,'the cut ends well below the raise and stays down on the follow-through');
 mixer.stopAllAction();mixer.uncacheRoot(asset.scene);
});
