import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../src/characters.ts';
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
  opponent.wear(pieces);
  assert.ok(opponent.worn().length, 'he fights in his carriers first (the base look)');
  // A pieces-only look: one new draw (his helmet's geometry under a new name and material) and the names of his draws it keeps.
  const helm = skinned(lookFile.scene).find(d => d.name.replace(/[^A-Za-z]/g, '') === 'SteelHelmet')!;
  helm.name = 'Mid-tier helmet'; helm.material = new MeshStandardMaterial({ name: 'Look' });
  const keep = ['Skin', 'Face', 'Photo', 'PhotoEyes', 'PhotoTeeth'];
  const swapped = opponent.wearLook({ draws: [helm], keep });
  assert.deepEqual(swapped.added, ['Mid-tier helmet']);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && !opponent.worn().includes(d));
  for (const draw of own) assert.equal(draw.visible, keep.includes(draw.name), `${draw.name} ${keep.includes(draw.name) ? 'stays' : 'goes off'}`);
  assert.ok(opponent.worn().every(p => !p.visible), 'his carriers go off with his look');
  const added = skinned(opponent.anchor).find(d => d.userData.rankLook)!, body = own.find(d => d.name === 'Skin')!;
  assert.ok(added.visible && added.parent === body.parent);
  assert.ok(added.skeleton.bones.every(b => body.skeleton.bones.includes(b)), 'the look follows his own bones');
  let knife = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) knife = true; });
  assert.ok(knife, 'his weapon is never touched');
  // No keep list and no shared names (a carrier-style file, as Armour's bronze figure): his face and skin still stay.
  const bare = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent;
  bare.wearLook({ draws: [helm] });
  for (const d of skinned(bare.anchor).filter(d => !d.userData.rankLook)) assert.equal(d.visible, keep.includes(d.name), `bare look: ${d.name}`);
  opponent.wear(pieces);
  assert.ok(opponent.worn().every(p => !p.visible) && own.filter(d => !keep.includes(d.name)).every(d => !d.visible), 'a re-dress (rematch) never brings the base look back');
  assert.ok(skinned(opponent.anchor).filter(d => d.userData.rankLook).every(d => d.visible), 'and never hides the look (its helm shares the carriers\' replace slot)');
  const head = opponent.sever()!;
  const materials = head.group.children.map(c => ((c as Mesh).material as MeshStandardMaterial).name);
  assert.ok(materials.includes('Look'), 'the look\'s helm leaves with the head');
  assert.ok(!materials.includes('Steel'), 'his hidden helmet does not');
});
