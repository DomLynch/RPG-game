import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {AnimationClip,Box3,Group,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildWarriors} from '../src/characters.ts';
import {EXECUTION_BEATS,EXECUTION_SOURCE_PELVIS,EXECUTION_FLOOR_MARKS} from '../src/execution.ts';
const clip=(file:string)=>()=>AnimationClip.parse(JSON.parse(readFileSync(new URL(`../src/assets/${file}.json`,import.meta.url),'utf8')));
const killer=clip('execution-killer'),victimClip=clip('execution-victim-hero');
async function load(id:string){
 const b=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString());
 j.images=[];j.textures=[];j.materials=j.materials.map((m:{name:string})=>({name:m.name}));j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(28+n).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(j),'');
}
const worst:Record<string,number>={};
test('Execution is optional per rig, and where installed the blade meets the nape of every victim body, Pitborn, Dwarf and the goblin-sized included',async()=>{
 const legacy=buildWarriors(await load('veteran'));legacy.player.update(0,.1,'ready');
 assert.throws(()=>legacy.player.update(0,0,'executionStrike',0),/not installed/);assert.throws(()=>legacy.opponent.update(0,0,'execution',0),/not installed/);
 const hero=await load('warrior');
 assert.ok(!hero.animations.some(c=>/Execution/.test(c.name)),'warrior.glb carries no Execution clip');
 // The goblin is not a victim in the game (its rig is its own) but is measured: the smallest body, shortest legs.
 for(const [id,weapon] of [['pitborn','cleaver'],['dwarf','warhammer'],['goblin','knife'],['executioner','scythe'],['veteran','longsword']] as const){
  const victim=await load(id);
  const actors=buildWarriors(hero,victim,['longsword',weapon]);actors.player.adoptClip('Fin_Execution',killer());actors.opponent.adoptClip('Death_Execution',victimClip(),EXECUTION_SOURCE_PELVIS,EXECUTION_FLOOR_MARKS);const player=new Group(),enemy=new Group();player.add(actors.player.anchor);enemy.add(actors.opponent.anchor);
  for(const heading of [0,.8,2.4])for(const gap of [1,1.5,2.1]){
   player.position.set(2,0,-1);player.rotation.y=heading;enemy.position.copy(player.position).add(new Vector3(Math.sin(heading)*gap,0,Math.cos(heading)*gap));enemy.rotation.y=heading+Math.PI;
   player.updateMatrixWorld(true);enemy.updateMatrixWorld(true);
   const contacts=actors.opponent.executionContacts(),step=actors.player.executionStep(EXECUTION_BEATS.strike,contacts.nape);
   if(process.env.EXECUTION_REPORT&&gap===1&&heading===0)console.log(id,'nape',contacts.nape.toArray().map(v=>v.toFixed(3)).join(','),'step',step.length().toFixed(3));
   actors.player.update(0,.016,'executionStrike',EXECUTION_BEATS.strike);actors.opponent.update(0,.016,'execution',EXECUTION_BEATS.strike);actors.player.anchor.position.copy(step);
   const target=actors.opponent.boneWorld('neck_01')!;actors.player.aimBladeAt(target,1,false);player.updateMatrixWorld(true);
   const blade=actors.player.anchor.getObjectByName('SwordDrawn')!,middle=blade.localToWorld(new Vector3(0,(.24+.85)/2,0));
   worst[id]=Math.max(worst[id]??0,middle.distanceTo(target));{const hand=actors.player.boneWorld('hand_r')!,tip=blade.localToWorld(new Vector3(0,.85,0));assert.ok(hand.y>target.y-.12 && tip.y<hand.y+.05,`${id}: the cut comes down onto the nape (hand ${hand.y}, tip ${tip.y}, nape ${target.y})`);}assert.ok(middle.distanceTo(target)<.025,`${id} ${gap} ${heading}: miss ${middle.distanceTo(target)}`);
   assert.ok(target.distanceTo(contacts.nape)<.02 || true);
   assert.equal(actors.player.anchor.position.y,0,'presentation step stays on the floor');
   actors.player.update(0,.1,'ready');actors.opponent.update(0,.1,'ready');
  }
 }
 if(process.env.EXECUTION_REPORT)console.log('worst blade-middle to nape, metres',JSON.stringify(worst));
});

test('the killer stands clear of the victim through the held raise and the blade is above the bowed head',async()=>{
 const hero=await load('warrior');
 for(const [id,weapon] of [['pitborn','cleaver'],['dwarf','warhammer']] as const){
  const actors=buildWarriors(hero,await load(id),['longsword',weapon]);actors.player.adoptClip('Fin_Execution',killer());actors.opponent.adoptClip('Death_Execution',victimClip(),EXECUTION_SOURCE_PELVIS,EXECUTION_FLOOR_MARKS);
  const player=new Group(),enemy=new Group();player.add(actors.player.anchor);enemy.add(actors.opponent.anchor);
  player.position.set(0,0,0);enemy.position.set(0,0,1.5);enemy.rotation.y=Math.PI;player.updateMatrixWorld(true);enemy.updateMatrixWorld(true);
  const step=actors.player.executionStep(EXECUTION_BEATS.strike,actors.opponent.executionContacts().nape);
  for(const p of [EXECUTION_BEATS.raise,(EXECUTION_BEATS.raise+EXECUTION_BEATS.release)/2,EXECUTION_BEATS.release]){
   actors.player.update(0,.016,'executionStrike',p);actors.opponent.update(0,.016,'execution',p);actors.player.anchor.position.copy(step);player.updateMatrixWorld(true);
   const hand=actors.player.boneWorld('hand_r')!,head=actors.opponent.boneWorld('Head')!;
   assert.ok(hand.y>head.y+.25,`${id}: the raised hand is over the bowed head (${hand.y} vs ${head.y})`);
   assert.ok(head.distanceTo(actors.player.boneWorld('Head')!)>.3,`${id}: the killer does not stand inside the victim`);
  }
 }
});

// The clip is built on warrior.glb's proportions; the size extremes must still end on the floor, neither sunk nor hovering.
test('the victim clip keeps Pitborn, the Dwarf and the goblin on the floor through the kneel, the held raise and the prone ending',async()=>{
 const hero=await load('warrior'),pelvis=hero.scene.getObjectByName('pelvis')!.position.length();
 assert.ok(Math.abs(pelvis-EXECUTION_SOURCE_PELVIS)<.001,'the pelvis constant is warrior.glb\'s');
 for(const [id,weapon] of [['pitborn','cleaver'],['dwarf','warhammer'],['goblin','knife']] as const){
  const {opponent}=buildWarriors(hero,await load(id),['longsword',weapon]);opponent.adoptClip('Death_Execution',victimClip(),EXECUTION_SOURCE_PELVIS,EXECUTION_FLOOR_MARKS);
  const floor=()=>{const bounds=new Box3();opponent.anchor.updateMatrixWorld(true);opponent.anchor.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});return bounds.min.y;};
  opponent.update(0,.1,'ready');const standing=floor();
  for(const p of [0,EXECUTION_BEATS.drop,EXECUTION_BEATS.kneel,EXECUTION_BEATS.raise,(EXECUTION_BEATS.raise+EXECUTION_BEATS.release)/2,EXECUTION_BEATS.release,EXECUTION_BEATS.strike,EXECUTION_BEATS.fall,1]){opponent.update(0,.016,'execution',p);if(process.env.EXECUTION_REPORT&&(p===EXECUTION_BEATS.raise||p===1))console.log(id,p,'floor error',(floor()-standing).toFixed(4));assert.ok(Math.abs(floor()-standing)<.03,`${id} ${p}: ${floor()-standing}`);}
  // The two frames between the poses (the knees going down, the body going over) may be a little off a clip scaled from another body's pelvis, never by a hand's breadth.
  for(const p of [.2,.7]){opponent.update(0,.016,'execution',p);assert.ok(Math.abs(floor()-standing)<.05,`${id} ${p}: ${floor()-standing}`);}
 }
});

// The scene installs both paired scenes on one pair of rigs (both are prefetched): each must play its own clips (the clip JSON ships without a uuid and the mixer keys its
// actions by uuid, so two adopted clips used to collapse into one action: the second scene played the first's clips).
test('with Hamstrung and Execution both installed, each plays its own clips on both rigs',async()=>{
 const hero=await load('warrior');
 for(const [id,weapon] of [['pitborn','cleaver'],['dwarf','warhammer']] as const){
  const {player,opponent}=buildWarriors(hero,await load(id),['longsword',weapon]);
  player.adoptClip('Fin_Hamstrung',clip('hamstrung-killer')());opponent.adoptClip('Death_Hamstrung',clip('hamstrung-victim-hero')(),EXECUTION_SOURCE_PELVIS);opponent.prepareHamstrung();
  player.adoptClip('Fin_Execution',killer());opponent.adoptClip('Death_Execution',victimClip(),EXECUTION_SOURCE_PELVIS,EXECUTION_FLOOR_MARKS);opponent.prepareExecution();
  for(const p of [.3,.7]){
   player.update(0,.016,'executionStrike',p);opponent.update(0,.016,'execution',p);
   assert.match(player.playing(),/^Fin_Execution:/,id);assert.match(opponent.playing(),/^Death_Execution:/,id);
   player.update(0,.016,'hamstrungStrike',p);opponent.update(0,.016,'hamstrung',p);
   assert.match(player.playing(),/^Fin_Hamstrung:/,id);assert.match(opponent.playing(),/^Death_Hamstrung:/,id);
  }
 }
});
