import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, readRankLook } from '../src/characters.ts';
import { initialPractice, type Practice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { idleBeat, rankLookFlag, rankLookStream } from '../src/rank-look.ts';

// Parse a shipped GLB in Node (geometry, rig, material names; images dropped), as tests/loot-wear.test.ts does.
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const skinned = (root: { traverse(cb: (o: unknown) => void): void }) => { const out: SkinnedMesh[] = []; root.traverse(o => { if (o instanceof SkinnedMesh) out.push(o); }); return out; };
// A practice at a given pair of phases (the rest of the fight state is today's opening).
const at = (phases: [string, string], extra: { finish?: boolean; parrying?: boolean; stun?: number; tick?: number } = {}): Practice => {
  const p = initialPractice(731, OPPONENTS.goblin);
  return { ...p, finish: extra.finish ? ({ victim: 1 } as Practice['finish']) : null, duel: { ...p.duel, tick: extra.tick ?? 1, fighters: p.duel.fighters.map((f, i) => ({ ...f, phase: phases[i], parrying: i === 1 && !!extra.parrying, stun: i === 1 ? extra.stun ?? 0 : 0 })) as Practice['duel']['fighters'] } };
};

test('rank look flag: a same-origin file directly under /looks/, nothing else, silently', () => {
  assert.equal(rankLookFlag('?ranklook=/looks/goblin@mid.glb'), '/looks/goblin@mid.glb');
  assert.equal(rankLookFlag('?opponent=goblin&ranklook=/looks/goblin-l3.glb'), '/looks/goblin-l3.glb');
  for (const search of ['', '?ranklook=', '?look=souls', '?ranklook=https://evil.example/looks/x.glb', '?ranklook=//evil.example/looks/x.glb', '?ranklook=/looks/../assets/x.glb',
    '?ranklook=/looks/sub/x.glb', '?ranklook=/herolook/x.glb', '?ranklook=/looks/x.gltf', '?ranklook=%2Flooks%2F..%2Fx.glb', '?ranklook=/looks/x.glb?y=1'])
    assert.equal(rankLookFlag(search), undefined, search);
});

test('idle beat: only when both fighters are quiet and no finish plays (never mid-exchange, never in a finisher or kill-cam)', () => {
  for (const pair of [['ready', 'ready'], ['sheathed', 'ready'], ['draw', 'sheathed'], ['guard', 'ready'], ['guard', 'guard']] as [string, string][]) assert.ok(idleBeat(at(pair)), pair.join('/'));
  for (const phase of ['attack', 'roll', 'backstep', 'hurt', 'dead']) {
    assert.ok(!idleBeat(at(['ready', phase])), `opponent ${phase}`);
    assert.ok(!idleBeat(at([phase, 'ready'])), `player ${phase}`);
  }
  assert.ok(!idleBeat(at(['ready', 'ready'], { finish: true })), 'a finish (and its kill-cam) is never a beat');
  assert.ok(!idleBeat(at(['ready', 'guard'], { parrying: true })), 'a guard with its parry window open is an exchange');
  assert.ok(idleBeat(at(['ready', 'ready'], { stun: 5 })), 'a stale stun count (left after a stagger) is not a stagger: the hurt phase is');
});

test('rank look stream: fetch waits for first playable, lands, waits for the idle beat, swaps once; a failed load stays base', async () => {
  let loads = 0; const applied: string[] = [];
  const stream = rankLookStream(async () => { loads++; return 'look'; }, (look) => applied.push(look));
  stream.tick(at(['ready', 'ready'], { tick: 0 }));
  assert.equal(stream.state(), 'waiting'); assert.equal(loads, 0, 'nothing is fetched before the fight clock moves (first playable)');
  stream.tick(at(['attack', 'ready']));
  assert.equal(stream.state(), 'loading'); assert.equal(loads, 1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(stream.state(), 'ready');
  stream.tick(at(['attack', 'guard'])); stream.tick(at(['ready', 'hurt'])); stream.tick(at(['ready', 'ready'], { finish: true }));
  assert.deepEqual(applied, [], 'a landed look waits through an exchange and a finish');
  stream.tick(at(['ready', 'ready']));
  assert.deepEqual(applied, ['look']); assert.equal(stream.state(), 'on');
  stream.tick(at(['ready', 'ready'])); assert.deepEqual(applied, ['look'], 'one swap per fight');
  assert.ok(stream.stamps().on >= stream.stamps().loaded);

  const errors: unknown[] = [];
  const broken = rankLookStream(async () => { throw new Error('offline'); }, () => assert.fail('never applied'), (e) => errors.push(e));
  broken.tick(at(['ready', 'ready'])); await Promise.resolve(); await Promise.resolve();
  broken.tick(at(['ready', 'ready']));
  assert.equal(broken.state(), 'failed'); assert.equal(errors.length, 1);
});

test('rank look stream: the sim is untouched (tick reads a frozen practice and never writes it)', async () => {
  const freeze = <T>(o: T): T => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
  const stream = rankLookStream(async () => 1, () => {});
  const p = freeze(at(['ready', 'ready'])), before = JSON.stringify(p);
  stream.tick(p); await Promise.resolve(); await Promise.resolve(); stream.tick(p);
  assert.equal(stream.state(), 'on'); assert.equal(JSON.stringify(p), before);
  for (const file of ['combat.ts', 'duel.ts', 'sim.ts', 'match.ts', 'ai.ts']) assert.ok(!readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').includes('rank-look'), `${file} never reads the look`);
});

test('rank look on the Goblin: his own look goes off as a set (carriers too), the look goes on his bones, the kept draws and the knife stay, and the head bake takes only what he shows', async () => {
  const [hero, goblin, lookFile, carriers] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb'), parse('loot/carriers-goblin.glb')]);
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  const pieces = skinned(carriers.scene).filter(p => p.userData.opponent === 'goblin');
  pieces[0]!.userData = { ...pieces[0]!.userData, slot: 'Shield' };   // stands in for a worn shield (the Veteran's scutum): no look carries one
  opponent.wear(pieces);
  assert.ok(opponent.worn().length > 1, 'he fights in his carriers first (the base look)');
  // A pieces-only look: one new draw (his helmet's geometry under a new name and material) and the names of his draws it keeps.
  const helm = skinned(lookFile.scene).find(d => d.name.replace(/[^A-Za-z]/g, '') === 'SteelHelmet')!;
  helm.name = 'Mid-tier helmet'; helm.material = new MeshStandardMaterial({ name: 'Look' });
  const keep = ['Skin', 'Face', 'Photo', 'PhotoEyes', 'PhotoTeeth'];
  // Every map on his own draws, watched: a map goes when no draw still shown uses it (the phone never holds both looks' maps).
  const mapsOf = (d: Mesh) => (Array.isArray(d.material) ? d.material : [d.material]).flatMap(m => Object.values(m).filter((v): v is Texture => !!v && (v as Texture).isTexture));
  const disposed = new Set<Texture>(), before = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d));
  // The test loader decodes no images, so each draw gets a map of its own, and one hidden draw shares the kept Skin's map.
  const skin = before.find(d => d.name === 'Skin')!, other = before.find(d => !keep.includes(d.name))!;
  for (const d of before) { d.material = (d.material as MeshStandardMaterial).clone(); (d.material as MeshStandardMaterial).map = new Texture(); }
  (other.material as MeshStandardMaterial).map = (skin.material as MeshStandardMaterial).map;
  for (const t of new Set(before.flatMap(mapsOf))) t.addEventListener('dispose', () => disposed.add(t));
  const swapped = opponent.wearLook({ draws: [helm], keep });
  const keptMaps = new Set(before.filter(d => keep.includes(d.name)).flatMap(mapsOf)), goneMaps = new Set(before.filter(d => !keep.includes(d.name)).flatMap(mapsOf).filter(t => !keptMaps.has(t)));
  assert.ok(goneMaps.size, 'his hidden draws have maps of their own');
  for (const t of goneMaps) assert.ok(disposed.has(t), `a map only his hidden draws used is freed (${t.name || t.uuid})`);
  for (const t of keptMaps) assert.ok(!disposed.has(t), `a map a kept draw still uses stays (${t.name || t.uuid})`);
  assert.deepEqual(swapped.added, ['Mid-tier helmet']);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && !opponent.worn().includes(d));
  for (const draw of own) assert.equal(draw.visible, keep.includes(draw.name), `${draw.name} ${keep.includes(draw.name) ? 'stays' : 'goes off'}`);
  assert.ok(opponent.worn().every(p => p.visible === (p.userData.slot === 'Shield')), 'his carriers go off with his look; a worn shield stays');
  const added = skinned(opponent.anchor).find(d => d.userData.rankLook)!, body = own.find(d => d.name === 'Skin')!;
  assert.ok(added.visible && added.parent === body.parent);
  assert.ok(added.skeleton.bones.every(b => body.skeleton.bones.includes(b)), 'the look follows his own bones');
  let knife = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) knife = true; });
  assert.ok(knife, 'his weapon is never touched');
  // A file without extras.keep is refused (Lead, #918): the stream stays on his base look, never a guessed hide set.
  assert.throws(() => readRankLook(lookFile.scene), /extras\.keep/);
  opponent.wear(pieces);
  assert.ok(opponent.worn().every(p => p.visible === (p.userData.slot === 'Shield')) && own.filter(d => !keep.includes(d.name)).every(d => !d.visible), 'a re-dress (rematch) never brings the base look back, and keeps the shield on');
  assert.ok(skinned(opponent.anchor).filter(d => d.userData.rankLook).every(d => d.visible), 'and never hides the look (its helm shares the carriers\' replace slot)');
  // An explicit keep list read from the file's extras: every draw of his not in it goes off, the untagged ones too (the Goblin's bracer
  // trio), and a look draw named like one that goes off is worn in its place, not lost with it.
  const [fresh, lookScene] = await Promise.all([parse('goblin.glb'), parse('goblin.glb')]);
  const listed = buildWarriors(hero, fresh, ['longsword', OPPONENTS.goblin.weapon]).opponent;
  const mine = skinned(listed.anchor), untagged = mine.filter(d => !d.userData.slot && !keep.includes(d.name));
  assert.ok(untagged.length, 'the Goblin has untagged draws of his own (his base bracer)');
  const same = skinned(lookScene.scene).find(d => d.name === untagged[0]!.name)!;
  lookScene.scene.userData.keep = keep;
  const read = readRankLook(lookScene.scene);
  assert.deepEqual(read.keep, keep, 'extras.keep is read from the file');
  const result = listed.wearLook({ draws: [same], keep: read.keep });
  assert.deepEqual(result.added, [same.name], 'a look draw named like one that goes off replaces it');
  for (const d of mine) assert.equal(d.visible, keep.includes(d.name), `keep list: ${d.name}`);
  // The waist-cut rebake after the swap: pending, taken one step a frame, and cut to the same pieces as the whole bake a kill would force.
  const whole = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent, stepped = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent;
  for (const rig of [whole, stepped]) { rig.prepareOpened(); rig.wearLook({ draws: [helm], keep }); assert.ok(rig.bakePending(), 'the swap leaves the bake pending, not taken on its frame'); }
  whole.prepareOpened();
  let steps = 0; while (stepped.stepOpened() !== null) steps++;
  assert.ok(!stepped.bakePending() && steps > 3 && steps < 60, `stepped over ${steps} frames`);
  const cut = (rig: typeof whole) => { rig.openWaist(.5, 'red'); const pieces: string[] = []; rig.anchor.getObjectByName('Opened')!.traverse(o => { if (o instanceof Mesh) pieces.push(`${o.name}:${o.geometry.getAttribute('position').count}`); }); return pieces.sort(); };
  assert.deepEqual(cut(stepped), cut(whole), 'the stepped bake cuts the same pieces as the whole one');
  const head = opponent.sever()!;
  const materials = head.group.children.map(c => ((c as Mesh).material as MeshStandardMaterial).name);
  assert.ok(materials.includes('Look'), 'the look\'s helm leaves with the head');
  assert.ok(!materials.includes('Steel'), 'his hidden helmet does not');
});

test('rank look file contract (Lead, #918): the look carries none of the draws it keeps; the base rig\'s own keep draws stay shown, and a file without extras.keep is still refused', async () => {
  const [hero, goblin, lookFile] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb')]);
  const keep = ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Skin', 'Wrap.Boots'];
  // A lean look file: his draws minus every keep-named one (Armour drops them; the base rig already has them), read as the game reads it.
  const loaded = keep.map(k => k.replace('.', ''));   // the loader drops '.' from node names
  for (const d of skinned(lookFile.scene).filter(d => loaded.includes(d.name))) d.removeFromParent();
  assert.throws(() => readRankLook(lookFile.scene), /extras\.keep/, 'no keep list: refused (L1)');
  lookFile.scene.userData.keep = keep;
  const look = readRankLook(lookFile.scene), kept = look.keep;
  assert.ok(kept.includes('WrapBoots'), 'keep names are read as the loader names his draws (Wrap.Boots loads as WrapBoots)');
  assert.ok(look.draws.length && look.draws.every(d => !kept.includes(d.name)), 'the file carries none of the kept draws');
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d));
  assert.ok(kept.every(k => own.some(d => d.name === k)), 'the base Goblin has every keep draw');
  opponent.wearLook(look);
  for (const d of own) assert.equal(d.visible, kept.includes(d.name), `${d.name}: ${kept.includes(d.name) ? 'his own stays shown' : 'goes off'}`);
  const worn = skinned(opponent.anchor).filter(d => d.userData.rankLook);
  assert.equal(worn.length, look.draws.length, 'every look draw is worn');
  assert.ok(worn.every(d => d.visible && !kept.includes(d.name)), 'and none of them stands in for a kept draw');
});
