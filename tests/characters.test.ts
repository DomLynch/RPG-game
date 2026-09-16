import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Box3, Vector3, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { SWORD, ATTACKS, initialPractice } from '../src/combat.ts';
import { PATHS, total } from '../src/moves.ts';
import { CLIPS, COMBAT_CLIPS, gaitWeights, swingProgress, defenceReaction } from '../src/characters.ts';

test('gaits blend continuously, stay normalized and settle to idle at rest', () => {
  for (const speed of [NaN, Infinity, -1, 0, .1, .8, 1.7, 2.9, 3, 4, 5.2, 100]) {
    const weights = gaitWeights(speed);
    assert.equal(weights.length, CLIPS.length);
    assert.ok(weights.every(w => w >= 0 && w <= 1));
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-8);
  }
  assert.deepEqual(gaitWeights(0), [1, 0, 0, 0]);
  assert.deepEqual(gaitWeights(3), [0, 0, 1, 0]);
  for (const speed of [1.7, 3, 5.2]) {
    const before = gaitWeights(speed - .001), after = gaitWeights(speed + .001);
    assert.ok(before.every((w, i) => Math.abs(w - after[i]) < .003));
  }
});

// Parse the shipped geometry/rig/clips in Node. Image decoding/CSP is exercised in the browser.
// Two fighters ship: the player's warrior.glb and the opponent's veteran.glb (its own head, helm and maps on the same rig).
const FIGHTERS = ['warrior.glb', 'veteran.glb'] as const;
async function readWarrior(file: (typeof FIGHTERS)[number] = 'warrior.glb') {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  assert.ok(json.images.length >= 3);
  assert.ok(json.images.every((i: { bufferView: number }) => Number.isInteger(i.bufferView)));
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

for (const file of FIGHTERS) test(`shipped ${file} has finite poses, grounded walk and bounded running flight`, async () => {
  const asset = await readWarrior(file);
  assert.deepEqual(asset.animations.map(a => a.name), [...CLIPS, ...COMBAT_CLIPS]);
  const mixer = new AnimationMixer(asset.scene), point = new Vector3();
  let triangles = 0;
  asset.scene.traverse(o => { if (o instanceof SkinnedMesh) triangles += o.geometry.index!.count / 3; });
  assert.ok(triangles < 60000, `${file} triangle count: ${triangles}`); // ceiling raised 40k→60k by the owner, 2026-09-14 (character lane)
  for (const clip of asset.animations.filter(a => (CLIPS as readonly string[]).includes(a.name))) {
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 12; frame++) {
      mixer.setTime(clip.duration * frame / 12); asset.scene.updateMatrixWorld(true);
      const bounds = new Box3();
      asset.scene.traverse(object => {
        if (!(object instanceof SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.index!.count; i++) {
          object.getVertexPosition(object.geometry.index!.getX(i), point).applyMatrix4(object.matrixWorld);
          assert.ok(point.toArray().every(Number.isFinite)); bounds.expandByPoint(point);
        }
      });
      assert.ok(bounds.min.y >= -.03, `${clip.name}: underground foot ${bounds.min.y}`);
      assert.ok(bounds.min.y < (clip.name === 'Idle' || clip.name === 'Walk' ? .06 : .32), `${clip.name}: floating ${bounds.min.y}`);
      assert.ok(bounds.max.y < 1.87 && bounds.max.y > 1.4);
      // depth 1.6→1.65: the Studio body's feet are real length, so the Jog stride measures 1.605 m toe to toe (2026-09-14)
      assert.ok(bounds.max.x - bounds.min.x < 1.5 && bounds.max.z - bounds.min.z < 1.65, `${clip.name} frame ${frame}: reach ${(bounds.max.x - bounds.min.x).toFixed(2)} × ${(bounds.max.z - bounds.min.z).toFixed(2)}`);
    }
    action.stop();
  }
});

test('the Veteran carries the warrior\'s clips and sword attachments exactly, so the baked blade paths serve both', async () => {
  const [hero, veteran] = await Promise.all([readWarrior('warrior.glb'), readWarrior('veteran.glb')]);
  assert.deepEqual(veteran.animations.map(a => a.name), hero.animations.map(a => a.name));
  for (const [i, clip] of hero.animations.entries()) {
    const other = veteran.animations[i];
    assert.equal(other.duration, clip.duration, `${clip.name} duration`);
    assert.deepEqual(other.tracks.map(t => t.name).sort(), clip.tracks.map(t => t.name).sort(), `${clip.name} tracks`);
    for (const track of clip.tracks) { // every bone track identical: same rig, same motion, so the sim's blade paths are the Veteran's too
      const twin = other.tracks.find(t => t.name === track.name)!;
      assert.deepEqual(Array.from(twin.times), Array.from(track.times), `${clip.name} ${track.name} times`);
      assert.deepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} values`);
    }
  }
  for (const name of ['SwordSheathed', 'SwordDrawn', 'hand_r']) {
    const a = hero.scene.getObjectByName(name)!, b = veteran.scene.getObjectByName(name)!;
    assert.ok(a && b, name);
    assert.deepEqual(b.position.toArray(), a.position.toArray(), `${name} position`);
    assert.deepEqual(b.quaternion.toArray(), a.quaternion.toArray(), `${name} rotation`);
    assert.equal(b.parent?.name, a.parent?.name, `${name} parent`);
  }
  const bones = (asset: Awaited<ReturnType<typeof readWarrior>>) => { const names: string[] = []; asset.scene.traverse(o => { if ((o as { isBone?: boolean }).isBone) names.push(o.name); }); return names; };
  assert.deepEqual(bones(veteran), bones(hero));
});

test('two fighters share geometry but have independent animated bones', async () => {
  const asset = await readWarrior(), opponent = clone(asset.scene);
  const a = asset.scene.getObjectByName('Steel') as SkinnedMesh, b = opponent.getObjectByName('Steel') as SkinnedMesh;
  assert.equal(a.geometry, b.geometry);
  assert.notEqual(a.skeleton.bones[0], b.skeleton.bones[0]);
  const before = b.skeleton.bones.map(bone => bone.quaternion.toArray());
  const mixer = new AnimationMixer(asset.scene); mixer.clipAction(asset.animations[3]).play(); mixer.update(.25);
  assert.deepEqual(b.skeleton.bones.map(bone => bone.quaternion.toArray()), before);
  assert.notDeepEqual(a.skeleton.bones.map(bone => bone.quaternion.toArray()), before);
});


test('combat clips and both sword attachments are present and produce finite animated poses', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  for (const name of ['SwordSheathed', 'SwordDrawn']) assert.ok(asset.scene.getObjectByName(name), name);
  const drawn = asset.scene.getObjectByName('SwordDrawn')!;
  assert.equal(drawn.parent?.name, 'hand_r');
  for (const name of COMBAT_CLIPS) {
    const clip = asset.animations.find(a => a.name === name)!;
    assert.ok(clip.duration > 0 && clip.tracks.length > 0);
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 20; frame++) {
      mixer.setTime(clip.duration * frame / 20); asset.scene.updateMatrixWorld(true);
      const tip = drawn.localToWorld(new Vector3(0, .86, 0));
      assert.ok(tip.toArray().every(Number.isFinite)); assert.ok(tip.length() < 4);
    }
    action.stop();
  }
});


test('the exported blade crosses the target at the simulation contact frame', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  const clip = asset.animations.find(a => a.name === 'Attack')!;
  mixer.clipAction(clip).play(); mixer.setTime(clip.duration * swingProgress(SWORD.contact / SWORD.recovery));
  asset.scene.updateMatrixWorld(true);
  const tip = asset.scene.getObjectByName('SwordDrawn')!.localToWorld(new Vector3(0, .86, 0));
  assert.ok(tip.z > .9 && tip.z <= SWORD.reach + .1 && Math.abs(tip.x) < .45 && tip.y > .6 && tip.y < 2, `Contact tip: ${tip.toArray()}`);
});

test('roll and guard keep the shipped body finite, above the floor and within a compact silhouette', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene), point = new Vector3();
  for (const name of ['Roll', 'Guard', 'BlockImpact', 'Parry']) {
    const clip = asset.animations.find(a => a.name === name)!;
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 24; frame++) {
      mixer.setTime(clip.duration * frame / 24); asset.scene.updateMatrixWorld(true);
      const bounds = new Box3();
      asset.scene.traverse(object => {
        if (!(object instanceof SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld); bounds.expandByPoint(point);
        }
      });
      assert.ok(bounds.min.y > -.12, `${name} floor: ${bounds.min.y}`);
      if(name === 'Guard') assert.ok(bounds.min.y < .06, `Guard floats: ${bounds.min.y}`);
      assert.ok(bounds.max.y < 2.2, `${name} height: ${bounds.max.y}`);
      assert.ok(bounds.getSize(point).length() < 3.5, `${name} silhouette: ${point.toArray()}`);
    }
    action.stop();
  }
});

test('swing easing remains monotone and preserves the authored contact pose', () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) { const p = swingProgress(i / 1000); assert.ok(p >= previous && p <= 1); previous = p; }
  assert.ok(Math.abs(swingProgress(SWORD.contact / SWORD.recovery) - 18 / 66) < 1e-8);
});

test('return, heavy and riposte authored blades agree with their contact ticks', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  for (const [kind,name,source] of [['return','Return',1-18/66],['heavy','Heavy',.48],['riposte','Riposte',.34]] as const) {
    const spec = ATTACKS[kind], clip = asset.animations.find(a => a.name === name)!;
    const action = mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * swingProgress(spec.contact/spec.recovery,spec.contact/spec.recovery,source));
    asset.scene.updateMatrixWorld(true);
    const tip = asset.scene.getObjectByName('SwordDrawn')!.localToWorld(new Vector3(0,.86,0));
    assert.ok(tip.z > .85 && Math.abs(tip.x) < .45 && tip.y > .6 && tip.y < 1.8, `${name} ${tip.toArray()}`);
    action.stop();
  }
});

test('baked collision paths match the shipped blade throughout every active strike', async () => {
  const {bladePose}=await import('../src/blade.ts');
  const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),blade=asset.scene.getObjectByName('SwordDrawn')!;
  for(const [kind,spec] of Object.entries(PATHS)) {
    const length=total(spec),clip=asset.animations.find(c=>c.name===spec.clip)!,action=mixer.clipAction(clip).play();
    for(let age=spec.windup-1;age<=spec.windup+spec.active;age++) {
      mixer.setTime(swingProgress(age/length,spec.windup/length,spec.source)*clip.duration);asset.scene.updateMatrixWorld(true);
      const actual=[.18,.86].flatMap(y=>blade.localToWorld(new Vector3(0,y,0)).toArray());
      assert.ok(actual.every((v,i)=>Math.abs(v-bladePose(kind,age)[i])<.00002),`${kind} tick ${age}`);
    }
    action.stop();
  }
});
test('authored strafe loops close cleanly and alternate grounded feet',async()=>{
  const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene);
  for(const name of ['StrafeLeft','StrafeRight']) {
    const clip=asset.animations.find(c=>c.name===name)!,action=mixer.clipAction(clip).play();
    for(let i=0;i<24;i++) {
      mixer.setTime(i/24*clip.duration);asset.scene.updateMatrixWorld(true);
      const feet=['foot_l','foot_r'].map(n=>asset.scene.getObjectByName(n)!.getWorldPosition(new Vector3()));
      assert.ok(feet.every(p=>p.y>-.02&&p.y<.3));
      assert.ok(Math.min(...feet.map(p=>p.y))<.17,`${name} ${i}: ${feet.map(p=>p.y)} at least one supporting foot`);
    }
    for(const track of clip.tracks){const n=track.getValueSize();assert.ok([...track.values.slice(0,n)].every((v,i)=>Math.abs(v-track.values[track.values.length-n+i])<.00001));}
    action.stop();
  }
});

test('authored kick plants its support foot and extends towards its contact range', async()=>{
 const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),clip=asset.animations.find(a=>a.name==='Kick')!;
 mixer.clipAction(clip).play();mixer.setTime(0);asset.scene.updateMatrixWorld(true);
 const support=asset.scene.getObjectByName('foot_l')!.getWorldPosition(new Vector3());
 mixer.setTime(18/44);asset.scene.updateMatrixWorld(true);
 const foot=asset.scene.getObjectByName('foot_r')!.getWorldPosition(new Vector3());
 assert.ok(foot.z>.6 && foot.y>.5 && foot.y<1.1,`kick contact ${foot.toArray()}`);
 assert.ok(asset.scene.getObjectByName('foot_l')!.getWorldPosition(new Vector3()).distanceTo(support)<.01);
});

test('defence presentation follows confirmed contacts and yields immediately to new actions',()=>{
 const s={...initialPractice(),phase:'guard' as const,result:'parried' as const,reaction:90};
 assert.equal(defenceReaction(s)?.pose,'parry');assert.equal(defenceReaction(s,true)?.pose,'deflected');
 assert.equal(defenceReaction({...s,phase:'attack'}),undefined);assert.equal(defenceReaction({...s,playerHealth:0}),undefined);
 assert.equal(defenceReaction({...s,resultAge:18}),undefined);
 assert.equal(defenceReaction({...s,result:'blocked'})?.pose,'block');
 assert.equal(defenceReaction({...s,result:'enemyBlocked',enemyMode:'guard'},true)?.pose,'block');
});
test('block recoil and parry visibly redirect the shipped blade and recover their guard pose',async()=>{
 const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),blade=asset.scene.getObjectByName('SwordDrawn')!;
 for(const name of ['BlockImpact','Parry']){
  const clip=asset.animations.find(a=>a.name===name)!;const action=mixer.clipAction(clip).play();mixer.setTime(0);asset.scene.updateMatrixWorld(true);const start=blade.localToWorld(new Vector3(0,.86,0));
  mixer.setTime(.35);asset.scene.updateMatrixWorld(true);assert.ok(blade.localToWorld(new Vector3(0,.86,0)).distanceTo(start)>.08,name+' must move blade');
  mixer.setTime(.99999);asset.scene.updateMatrixWorld(true);assert.ok(blade.localToWorld(new Vector3(0,.86,0)).distanceTo(start)<.005,name+' recovers');action.stop();
 }
});
