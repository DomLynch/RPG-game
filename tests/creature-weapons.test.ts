import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROSTER } from '../src/roster.ts';
import { WEAPONS } from '../src/moves.ts';
import { bladePaths } from '../src/blade-paths.ts';
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

test('creatures carry the approved maul and bare claws; every role resolves and the baked contacts match the scaled rendered rig', async () => {
  for (const [family, id, scale] of [['minotaur','maul',1],['wraith','claws',1.5]] as const) {
    assert.equal(ROSTER[family].weapon,id);
    const asset=await rig(family), marker=asset.scene.getObjectByName('WeaponDrawn')!;
    assert.equal(marker.userData.weapon,id);
    let meshes=0; marker.traverse(o=>{ if ('isMesh' in o && o.isMesh) meshes++; });
    assert.equal(meshes>0,id==='maul','Wraith has no carried weapon geometry');
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
        const contact=marker.userData.contactByClip?.[spec.clip] ?? marker.userData.contact;
        const actual=[contact.from,contact.to].flatMap(y=>marker.localToWorld(new Vector3(0,y,0)).toArray());
        assert(actual.every((v,i)=>Math.abs(v-bladePaths[id][path][tick][i])<.000011),`${id}/${path}@${tick}: visible contact drift`);
      }
    }
  }
});

test('creature light, heavy and forward strikes land once at close range with no phantom sword reach', () => {
  for(const [weapon,action,frontier] of [['maul','light',2.1],['maul','heavy',2.5],['maul','thrust',1.4],['claws','light',1.25],['claws','heavy',1.75],['claws','thrust',1.5]] as const) {
    const hits=(gap:number)=>{
      let d:Duel={tick:0,fighters:[createFighter({x:0,z:gap,heading:Math.PI,distance:0},'ready',weapon),createFighter({x:0,z:0,heading:0,distance:0},'ready')],finish:null,events:[]};
      const events:Duel['events']=[];
      for(let i=0;i<100;i++){d=stepDuel(d,[{...idleIntent(),lock:false,action:i===0?action:null},{...idleIntent(),lock:false}]);events.push(...d.events.filter(e=>e.type==='Hit'));}
      return events;
    };
    for(let cm=85;cm<=120;cm+=5){const events=hits(cm/100);assert.equal(events.length,1,`${weapon}/${action}@${cm}`);assert.equal(events[0].location,'torso');}
    assert.equal(hits(frontier).length,1,`${weapon}/${action}: measured reach`);
    assert.equal(hits(frontier+.15).length,0,`${weapon}/${action}: cannot hit beyond visible reach`);
  }
});

test('the maul stays between both reconstructed hands and the claw contact stays beside the visible fingers throughout clips', async () => {
  for(const [family,id,scale] of [['minotaur','maul',1],['wraith','claws',1.5]] as const){
    const asset=await rig(family);asset.scene.scale.multiplyScalar(scale);
    const body=asset.scene.getObjectByName('CreatureBody') as import('three').SkinnedMesh, marker=asset.scene.getObjectByName('WeaponDrawn')!, mixer=new AnimationMixer(asset.scene);
    const selected: Record<string,number[]>={};
    for(const side of id==='maul'?['l','r']:['r']){
      const joints=new Set(body.skeleton.bones.flatMap((b,i)=>/^(hand|thumb|index|middle|ring|pinky)_/.test(b.name)&&b.name.endsWith('_'+side)?[i]:[]));
      selected[side]=[];
      for(let i=0;i<body.geometry.attributes.position.count;i++){
        let weight=0;for(let k=0;k<4;k++)if(joints.has(body.geometry.attributes.skinIndex.getComponent(i,k)))weight+=body.geometry.attributes.skinWeight.getComponent(i,k);
        if(weight>(id==='maul'?.25:.1))selected[side].push(i);
      }
      assert(selected[side].length>0,'actual reconstructed hand vertices');
    }
    for(const clip of asset.animations.filter(c=>c.name.startsWith(id==='maul'?'Maul_':'Claw_'))){
      mixer.stopAllAction();mixer.clipAction(clip).play();
      for(let tick=0;tick<60;tick++){
        mixer.setTime(tick/60*clip.duration);asset.scene.updateMatrixWorld(true);body.skeleton.update();
        const tip=marker.localToWorld(new Vector3(0,marker.userData.contact.to,0));
        for(const [side,vertices]of Object.entries(selected)){
          let gap=Infinity;
          for(const i of vertices){const p=body.getVertexPosition(i,new Vector3()).applyMatrix4(body.matrixWorld);let target=tip;
            if(id==='maul'){const local=marker.worldToLocal(p.clone());target=marker.localToWorld(new Vector3(0,Math.max(-.2,Math.min(.65,local.y)),0));}
            gap=Math.min(gap,p.distanceTo(target));
          }
          assert(gap<(id==='maul'?.10:.15),`${clip.name}/${side}@${tick}: contact-to-surface gap ${gap}`);
        }
      }
    }
  }
});
