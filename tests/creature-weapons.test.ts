import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROSTER } from '../src/roster.ts';
import { RULES, WEAPONS } from '../src/moves.ts';
import { bladePathsByRig } from '../src/blade-paths.ts';
import { swingProgress } from '../src/blade.ts';
import { createFighter, idleIntent, stepDuel, type Duel } from '../src/duel.ts';
import { clipFor, ROLES } from '../src/characters.ts';

async function rig(family: string) {
  const bytes = readFileSync(new URL(`../src/assets/${family}.glb`, import.meta.url)), n = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20+n).toString());
  doc.images=[]; doc.textures=[]; doc.materials=doc.materials.map((m: {name:string})=>({name:m.name}));
  doc.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+n).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(doc),'');
}

test('creatures carry the approved maul and reaper scythe; every role resolves and the baked contacts match the scaled rendered rig', async () => {
  for (const [family, id, scale] of [['minotaur','maul',1],['wraith','reaper',1.5]] as const) {
    assert.equal(ROSTER[family].weapon,id);
    const asset=await rig(family), marker=asset.scene.getObjectByName('WeaponDrawn')!;
    assert.equal(marker.userData.weapon,id);
    let meshes=0; marker.traverse(o=>{ if ('isMesh' in o && o.isMesh) meshes++; });
    assert(meshes>0, 'both creatures carry their approved weapon');
    for(const name of ['SwordDrawn','SwordSheathed']) asset.scene.getObjectByName(name)?.traverse(o=>assert(!('isMesh' in o && o.isMesh),'no inherited sword mesh'));
    for(const role of ROLES) assert(asset.animations.some(c=>c.name===clipFor(id,role)),`${id}/${role}`);
    asset.scene.scale.multiplyScalar(scale);
    const mixer=new AnimationMixer(asset.scene);
    for(const [path,spec] of Object.entries(WEAPONS[id].paths)) {
      const clip=asset.animations.find(c=>c.name===spec.clip)!;
      mixer.stopAllAction(); mixer.clipAction(clip).play();
      const length=spec.windup+spec.active+spec.recovery;
      for(let tick=0;tick<=length;tick++) {
        mixer.setTime(Math.min(.999999,swingProgress(tick/length,spec.windup/length,spec.source))*clip.duration);asset.scene.updateMatrixWorld(true);
        const edge=asset.scene.getObjectByName(marker.userData.contactNode) ?? marker;
        const contact=marker.userData.contactByClip?.[spec.clip] ?? edge.userData.contact;
        const actual=[contact.from,contact.to].flatMap(y=>edge.localToWorld(new Vector3(0,y,0)).toArray());
        assert(actual.every((v,i)=>Math.abs(v-bladePathsByRig[family][id][path][tick][i])<.000011),`${id}/${path}@${tick}: visible contact drift`);
      }
    }
  }
});

// A creature's weapon sweeps the creature's own bake (blade seam): the man in this test carries the maul on the Minotaur's rig, the reaper on the Wraith's.
const RIG = { maul: 'minotaur', reaper: 'wraith' } as const;
test('creature light, heavy and forward strikes land once through their measured strike bands with no phantom inner or outer reach', () => {
  for(const [weapon,action,frontier] of [['maul','light',2.1],['maul','heavy',2.5],['maul','thrust',1.4],['reaper','light',2.55],['reaper','heavy',2.1],['reaper','thrust',2.0]] as const) {
    const hits=(gap:number)=>{
      let d:Duel={tick:0,fighters:[createFighter({x:0,z:gap,heading:Math.PI,distance:0},'ready',weapon,1,0,RULES.health,undefined,1,1,RIG[weapon]),createFighter({x:0,z:0,heading:0,distance:0},'ready')],finish:null,events:[]};
      const events:Duel['events']=[];
      for(let i=0;i<100;i++){d=stepDuel(d,[{...idleIntent(),lock:false,action:i===0?action:null},{...idleIntent(),lock:false}]);events.push(...d.events.filter(e=>e.type==='Hit'));}
      return events;
    };
    for(let cm=weapon==='maul'?85:150;cm<=(weapon==='maul'?120:200);cm+=5){const events=hits(cm/100);assert.equal(events.length,1,`${weapon}/${action}@${cm}`);assert.equal(events[0].location,'torso');}
    if(weapon==='reaper'){for(let cm=85;cm<=135;cm+=5)assert.equal(hits(cm/100).length,0,`${action}: inside the crescent at ${cm}`);}
    assert.equal(hits(frontier).length,1,`${weapon}/${action}: measured reach`);
    assert.equal(hits(frontier+.15).length,0,`${weapon}/${action}: cannot hit beyond visible reach`);
  }
});

test('both creature shafts remain held by their reconstructed hands throughout clips [slow]', async () => {
  for(const [family,id,scale] of [['minotaur','maul',1],['wraith','reaper',1.5]] as const){
    const asset=await rig(family);asset.scene.scale.multiplyScalar(scale);
    const body=asset.scene.getObjectByName('CreatureBody') as import('three').SkinnedMesh, marker=asset.scene.getObjectByName('WeaponDrawn')!, mixer=new AnimationMixer(asset.scene);
    const selected: Record<string,number[]>={};
    for(const side of ['l','r']){
      const joints=new Set(body.skeleton.bones.flatMap((b,i)=>/^(hand|thumb|index|middle|ring|pinky)_/.test(b.name)&&b.name.endsWith('_'+side)?[i]:[]));
      selected[side]=[];
      for(let i=0;i<body.geometry.attributes.position.count;i++){
        let weight=0;for(let k=0;k<4;k++)if(joints.has(body.geometry.attributes.skinIndex.getComponent(i,k)))weight+=body.geometry.attributes.skinWeight.getComponent(i,k);
        if(weight>.25)selected[side].push(i);
      }
      assert(selected[side].length>0,'actual reconstructed hand vertices');
    }
    for(const clip of asset.animations.filter(c=>c.name.startsWith(id==='maul'?'Maul_':'Reaper_'))){
      mixer.stopAllAction();mixer.clipAction(clip).play();
      for(let tick=0;tick<60;tick++){
        mixer.setTime(tick/60*clip.duration);asset.scene.updateMatrixWorld(true);body.skeleton.update();

        for(const [side,vertices]of Object.entries(selected)){
          let gap=Infinity;
          for(const i of vertices){const p=body.getVertexPosition(i,new Vector3()).applyMatrix4(body.matrixWorld);let target;
            {const local=marker.worldToLocal(p.clone());target=marker.localToWorld(new Vector3(0,Math.max(-.2,Math.min(.65,local.y)),0));}
            gap=Math.min(gap,p.distanceTo(target));
          }
          assert(gap<.10,`${clip.name}/${side}@${tick}: contact-to-surface gap ${gap}`);
        }
      }
    }
  }
});

// The short unarmed package had no inner dead band. A long crescent must keep
// the AI attacking from its real range and stepping/kicking when crowded.
test('reaper AI closes, escapes the inner arc and finishes a passive opponent', async () => {
  const { decide, initialAi } = await import('../src/ai.ts');
  const { opponentFighter } = await import('../src/duel.ts');
  const { OPPONENTS } = await import('../src/moves.ts');
  for(const gap of [1.05,1.8,3])for(const level of ['easy','normal','hard'] as const){
    let d:Duel={tick:0,fighters:[createFighter({x:0,z:gap,heading:Math.PI,distance:0},'ready'),opponentFighter(OPPONENTS.wraith,{x:0,z:0,heading:0,distance:0})],finish:null,events:[]}, ai=initialAi(731);
    for(let i=0;i<5400&&!d.finish;i++){const result=decide(d,1,ai,OPPONENTS.wraith.profiles[level]);ai=result.ai;d=stepDuel(d,[idleIntent(),result.intent]);}
    assert.equal(d.fighters[0].health,0,`${level}@${gap}: must not stall or endlessly whiff`);
  }
});

test('reaper collision samples stay on the crescent steel rather than the haft or empty air', async () => {
  const asset=await rig('wraith'), marker=asset.scene.getObjectByName('ReaperEdge')!;
  asset.scene.updateMatrixWorld(true);
  const points: Vector3[]=[];
  asset.scene.getObjectByName('WeaponDrawn')!.traverse(o=>{
    if(!('isMesh' in o)||!o.isMesh)return;
    const mesh=o as import('three').Mesh, material=mesh.material as import('three').Material;
    if(!['ReaperForgedSteel','ReaperHonedEdge'].includes(material.name))return;
    const pos=mesh.geometry.attributes.position;
    for(let i=0;i<pos.count;i++)points.push(mesh.localToWorld(new Vector3().fromBufferAttribute(pos,i)));
  });
  assert(points.length>0,'actual crescent mesh');
  for(let i=0;i<=20;i++){
    const point=marker.localToWorld(new Vector3(0,marker.userData.contact.to*i/20,0));
    assert(Math.min(...points.map(p=>p.distanceTo(point)))<.10,`blade sample ${i} left the visible steel`);
  }
});
