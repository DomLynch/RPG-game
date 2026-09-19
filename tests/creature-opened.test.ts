import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../src/characters.ts';
import { finisherSidePose } from '../src/scene.ts';
import { resolveFinisher, ROSTER } from '../src/roster.ts';
import { selectFinisher } from '../src/finishers.ts';
import type { Finish } from '../src/duel.ts';

const finish: Finish = { victim:1, location:'torso', move:'light_right', heading:0, draw:false };
test('creature picker and Auto share an eligibility-checked presentation decision for scene and audio', () => {
  for (const id of ['minotaur','wraith'] as const) {
    const weapons = ['longsword',ROSTER[id].weapon] as const;
    let autoOpened = 0;
    for(let i=0;i<100;i++) {
      const kill={...finish,heading:i/10};
      const choice=selectFinisher(kill,weapons);
      assert.equal(resolveFinisher(id,kill,weapons),choice==='opened' ? 'opened' : null);
      if(choice==='opened') autoOpened++;
      assert.equal(resolveFinisher(id,kill,weapons,'opened'),'opened');
      for(const pick of ['splitCrown','decapitation','runThrough','quietOne'] as const) assert.equal(resolveFinisher(id,kill,weapons,pick),null);
    }
    assert.ok(autoOpened>0);
    for(const kill of [{...finish,draw:true},{...finish,victim:0 as const},{...finish,move:'kick' as const}]) assert.equal(resolveFinisher(id,kill,weapons,'opened'),null);
  }
});

for(const id of ['minotaur','wraith'] as const) test(`${id}: actual waist halves stay whole, ground, frame, fade appropriately and restore`,async()=>{
  const bytes=readFileSync(new URL(`../src/assets/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.subarray(20,20+size).toString());
  json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));
  json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
  globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
  const weapon=ROSTER[id].weapon;
  const actor=buildWarriors(asset,asset,[weapon,weapon]).opponent;
  const root=actor.anchor.children[0],body=root.getObjectByName('CreatureBody') as Mesh;
  const original=(body.geometry.attributes.position.array as Float32Array).slice(),material=body.material as MeshStandardMaterial;
  const parent=new Group();parent.position.set(3,0,-2);parent.rotation.y=.8;parent.add(actor.anchor);
  actor.update(0,0,'ready');actor.prepareOpened();
  assert.equal(root.visible,true);assert.equal(actor.anchor.getObjectByName('Opened'),undefined);
  actor.update(0,.1,'opened',.045);actor.openWaist(.045,'red');
  const group=actor.anchor.getObjectByName('Opened')!,halves=group.children.slice(0,2);
  assert.equal(root.visible,false);assert.equal(halves.length,2);
  for(const half of halves) {
    assert.ok(half.getObjectByName('CreatureBody'));
    assert.ok(half.getObjectByName('WaistCut'));
    const skin=(half.getObjectByName('CreatureBody') as Mesh).material as MeshStandardMaterial;
    if(id==='wraith'){assert.notEqual(skin,material);assert.equal(skin.transparent,true);assert.equal(skin.opacity,.86);}
  }
  actor.openWaist(.28,'red');assert.ok(halves[1].position.x>.1);
  group.traverse(part=>assert.ok(part.position.toArray().every(Number.isFinite),`${id} finite cut-piece transform ${part.name}`));
  const cameraPose=finisherSidePose({x:parent.position.x+Math.sin(.8)*1.9,z:parent.position.z+Math.cos(.8)*1.9},{x:parent.position.x,z:parent.position.z},393/852,'opened',1.5);
  const camera=new PerspectiveCamera(51,393/852,.1,180);camera.position.set(cameraPose.x,cameraPose.y,cameraPose.z);camera.lookAt(cameraPose.lookX,cameraPose.lookY,cameraPose.lookZ);camera.updateMatrixWorld();
  for(let i=1;i<=32;i++){actor.update(0,.1,'opened',Math.min(1,i/32));actor.openWaist(Math.min(1,i/32),'red');}
  parent.updateMatrixWorld(true);
  for(const half of halves) {
    assert.equal(half.visible,true,'both halves remain visible long enough to read the cut and landing');
    const b=new Box3().setFromObject(half,true);
    assert.ok(b.min.y>-.012 && b.min.y<.04,`${half.name} lands on sand ${b.min.y}`);
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]) {
      const p=new Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(p.x)<.975 && p.y>-.64 && p.y<.95,`${half.name} clears portrait UI ${p.toArray()}`);
    }
  }
  for(const [x,z] of [[0,0],[7,0],[-7,0],[0,7],[0,-7]])for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
    parent.position.set(x,0,z);parent.rotation.y=heading;parent.updateMatrixWorld(true);
    const pose=finisherSidePose({x:x+Math.sin(heading)*1.9,z:z+Math.cos(heading)*1.9},{x,z},393/852,'opened',1.5);
    camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.lookX,pose.lookY,pose.lookZ);camera.updateMatrixWorld();
    // Test rendered vertices, not empty corners of a world-axis box around a rotated silhouette.
    for(const half of halves) half.traverse(part=>{
      if(!(part instanceof Mesh))return;
      const vertices=part.geometry.getAttribute('position');
      for(let i=0;i<vertices.count;i++) {
        const point=new Vector3().fromBufferAttribute(vertices,i).applyMatrix4(part.matrixWorld).project(camera);
        assert.ok(Math.abs(point.x)<.975 && point.y>-.64 && point.y<.95,`${id} edge${x},${z} heading${heading}: ${half.name} actual vertex ${point.toArray()}`);
      }
    });
  }
  const partMaterial=(halves[0].getObjectByName('CreatureBody') as Mesh).material as MeshStandardMaterial;
  const heldOpacity=partMaterial.opacity;
  for(let i=0;i<50;i++){actor.update(0,0,'opened',1);actor.openWaist(1,'red');}
  assert.equal(partMaterial.opacity,heldOpacity,'pause cannot advance dissolve');
  actor.openWaist(1,'off');assert.equal(group.visible,false);assert.equal(root.visible,true);
  actor.openWaist(1,'dark');assert.equal(group.visible,true);assert.equal(root.visible,false);
  for(let i=0;i<25;i++){actor.update(0,.1,'opened',1);actor.openWaist(1,'red');}
  assert.equal(halves[0].visible,id!=='wraith');assert.equal(halves[1].visible,id!=='wraith');
  const dropped=group.getObjectByName('OpenedWeapon')!;assert.equal(dropped.visible,id!=='wraith','claws leave no separate dropped weapon');assert.equal(dropped.children.length>0,id!=='wraith');
  if(id==='wraith')assert.equal(partMaterial.opacity,0);
  assert.deepEqual(body.geometry.attributes.position.array,original,'source mesh untouched');
  let disposed=0;partMaterial.addEventListener('dispose',()=>disposed++);
  actor.unsever();actor.update(0,.1,'ready');
  assert.equal(root.visible,true);assert.equal(actor.anchor.getObjectByName('Opened'),undefined);
  assert.equal(disposed,id==='wraith' ? 1 : 0,'dispose only owned spectral clones');
  assert.equal(material.opacity,id==='wraith' ? .86 : 1);
  assert.deepEqual(root.scale.toArray(),id==='wraith' ? [1.5,1.5,1.5] : [1,1,1]);
  actor.prepareOpened();actor.update(0,.1,'opened',.28);actor.openWaist(.28,'red');
  assert.equal(actor.anchor.getObjectByName('OpenedLegs')!.visible,true,'next kill is fully restored');
  actor.unsever();
});
