import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer, Box3, LoopOnce, Quaternion, SkinnedMesh, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disarmedClips, DISARMED_BEATS} from '../scripts/build-disarmed.mjs';

test('Disarmed paired motion: six real rigs hold a distinct arm reaction before the neck cut, preserve source poses and settle',async()=>{
  for(const id of ['warrior','veteran','pitborn','goblin','nightborn','executioner']) {
    const bytes=await readFile(new URL(`../src/assets/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString());
    json.images=[];json.textures=[];json.materials=json.materials.map((m:{name:string})=>({name:m.name}));
    json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
    globalThis.ProgressEvent ??= class {constructor(_type:string,fields:object){Object.assign(this,fields);}} as unknown as typeof ProgressEvent;
    const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
    const before=new Map();asset.scene.traverse(o=>before.set(o,[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));
    const [victim,killer]=disarmedClips(asset.scene,asset.animations);
    for(const [node,pose] of before)assert.deepEqual([node.position.toArray(),node.quaternion.toArray(),node.scale.toArray()],pose,'authoring restores every source node');
    assert.equal(victim.name,'Death_Disarmed');assert.equal(killer.name,'Fin_Disarmed');
    assert.ok(DISARMED_BEATS.neck-DISARMED_BEATS.arm>.35,'separate readable impacts');
    for(const clip of [victim,killer]) for(const track of clip.tracks) {
      assert.ok([...track.values].every(Number.isFinite),`${id} finite ${track.name}`);
      if(track.name.endsWith('.quaternion'))for(let i=4;i<track.values.length;i+=4){
        const a=new Quaternion().fromArray(track.values,i-4),b=new Quaternion().fromArray(track.values,i);
        assert.ok(Math.abs(b.length()-1)<1e-5,`${id} normalized ${track.name}`);
        assert.ok(a.angleTo(b)<.70,`${id} ${clip.name} ${track.name} no pose snap at${i/4}: ${a.angleTo(b)}`);
      }
    }
    const mixer=new AnimationMixer(asset.scene),action=mixer.clipAction(victim);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
    for(const progress of [.38,.48,.55]) {
      mixer.setTime(progress*victim.duration);asset.scene.updateMatrixWorld(true);
      const elbow=asset.scene.getObjectByName('lowerarm_r')!.getWorldPosition(new Vector3()),hand=asset.scene.getObjectByName('hand_l')!.getWorldPosition(new Vector3());
      assert.ok(hand.distanceTo(elbow)<.16,`${id} clutch reaches stump ${hand.distanceTo(elbow)}`);
      assert.ok(asset.scene.getObjectByName('Head')!.getWorldPosition(new Vector3()).y>.8,`${id} arm reaction remains standing`);
    }
    mixer.setTime(victim.duration);asset.scene.updateMatrixWorld(true);const body=new Box3();
    asset.scene.traverse(o=>{if(o instanceof SkinnedMesh)body.expandByObject(o,true);});
    assert.ok(body.min.y>-.035,`${id} corpse does not sink ${body.min.y}`);
    mixer.stopAllAction();mixer.uncacheRoot(asset.scene);
  }
});
