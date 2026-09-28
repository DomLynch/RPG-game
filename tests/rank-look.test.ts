import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildWarriors, readRankLook } from '../src/characters.ts';
import { openWaist } from '../src/opened.ts';
import { initialPractice, type Practice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { idleBeat, rankLookFlag, rankLookFor, rankLookMoves, rankLookStream, SHIPPING_LOOKS } from '../src/rank-look.ts';
import { existsSync } from 'node:fs';
import { TIERS, levelOf } from '../src/grades.ts';

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

test('shipping looks (Lead, 2026-09-28): every opponent with a set at rank levels 2–10 streams <opponent>-L<n>, level 1 and every other opponent none; each file is in public/looks', async () => {
  assert.deepEqual(Object.keys(SHIPPING_LOOKS), ['goblin', 'plaguedoctor'], 'only the Goblin and the Plague Doctor ship looks');
  for (const opponent of Object.keys(SHIPPING_LOOKS)) {
    assert.equal(rankLookFor(opponent, levelOf('Recruit')), undefined, `${opponent} rank 1: his rig as shipped`);
    assert.equal(rankLookFor(opponent, levelOf('Legionary')), `/looks/${opponent}-L2.glb`);
    assert.equal(rankLookFor(opponent, levelOf('Origin')), SHIPPING_LOOKS[opponent]!.includes(10) ? `/looks/${opponent}-L10.glb` : undefined);
  }
  for (const tier of TIERS) {
    for (const opponent of Object.keys(SHIPPING_LOOKS)) {
      const url = rankLookFor(opponent, levelOf(tier));
      if (url) { assert.ok(rankLookFlag(`?ranklook=${url}`), `${tier}: a URL the flag would accept`); assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `${tier}: ${url} is committed`); }
    }
    assert.equal(rankLookFor('veteran', levelOf(tier)), undefined, `${tier}: no look for an opponent without files`);
  }
  // Each committed file in the shape Lead ruled (packed4): extras.keep, every draw skinned, none of the kept draws, and external images only
  // as the build's shared textures (their presence in dist is scripts/check-budget.mjs's job, after the build).
  for (const [opponent, levels] of Object.entries(SHIPPING_LOOKS)) for (const level of levels) {
    const bytes = readFileSync(new URL(`../public/looks/${opponent}-L${level}.glb`, import.meta.url)), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const keep: string[] | undefined = json.scenes[0].extras?.keep, drawn = json.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined);
    // [] is a whole fitted figure: every draw of his goes off (a scanned rig's fused CreatureBody, the Plague Doctor).
    assert.ok(Array.isArray(keep), `${opponent} L${level}: extras.keep`);
    assert.ok(drawn.length && drawn.every((n: { skin?: number }) => n.skin !== undefined), `${opponent} L${level}: every draw skinned`);
    assert.ok(drawn.every((n: { name: string }) => !keep!.includes(n.name)), `${opponent} L${level}: carries none of the draws it keeps`);
    for (const image of json.images ?? []) if (image.uri) assert.match(image.uri, /^\.\.\/assets\/textures\/[0-9a-f]{64}\.(jpg|png|webp)$/, `${opponent} L${level}: ${image.uri}`);
  }
  // A rank-up at the rematch takes a fresh page only when his look file changes (Auditer + Strategy, #961).
  assert.ok(rankLookMoves('goblin', 1, 2), 'Recruit → Legionary: base rig → L2, a fresh page');
  assert.ok(rankLookMoves('goblin', 2, 3) && rankLookMoves('goblin', 9, 10), 'each rung up to Origin changes the file');
  assert.ok(!rankLookMoves('goblin', 5, 5), 'no rung change: no reload');
  assert.ok(rankLookMoves('plaguedoctor', 1, 2) && rankLookMoves('plaguedoctor', 9, 10), 'the Plague Doctor: each rung up changes the file');
  assert.ok(!rankLookMoves('veteran', 1, 2) && !rankLookMoves('veteran', 4, 9), 'an opponent with no looks never reloads for one');
  // A fight with no look for his rank: nothing is fetched and nothing is reported (not 'failed').
  const errors: unknown[] = [];
  const none = rankLookStream<string>(() => undefined, () => assert.fail('never applied'), (e) => errors.push(e));
  none.tick(at(['ready', 'ready'])); await Promise.resolve(); none.tick(at(['ready', 'ready']));
  assert.equal(none.state(), 'none'); assert.deepEqual(errors, []);
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
  assert.equal(swapped.bodyFreed, 0, 'a pieces-only look frees no CreatureBody: row 5a counts its added tris whole');
  assert.ok(swapped.vertices > 0 && swapped.vertices < 60000, `a pieces-only look reports its vertices (${swapped.vertices}) and row 5c does not bind it`);
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
  assert.ok(!stepped.bakePending() && steps > 3 && steps < 400, `stepped over ${steps} frames`);   // bounded work per step, so more steps (a kill that comes first finishes it)
  const cut = (rig: typeof whole) => { rig.openWaist(.5, 'red'); const pieces: string[] = []; rig.anchor.getObjectByName('Opened')!.traverse(o => { if (o instanceof Mesh) pieces.push(`${o.name}:${o.geometry.getAttribute('position').count}`); }); return pieces.sort(); };
  assert.deepEqual(cut(stepped), cut(whole), 'the stepped bake cuts the same pieces as the whole one');
  const head = opponent.sever()!;
  const materials = head.group.children.map(c => ((c as Mesh).material as MeshStandardMaterial).name);
  assert.ok(materials.includes('Look'), 'the look\'s helm leaves with the head');
  assert.ok(!materials.includes('Steel'), 'his hidden helmet does not');
});

test('rank look on the Plague Doctor: a shipped file with extras.keep = [] replaces his fused CreatureBody whole; the look follows his bones and his weapon stays', async () => {
  // His shipped file as the game loads it (meshopt, images dropped as parse() does).
  const bytes = readFileSync(new URL('../public/looks/plaguedoctor-L2.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, doctor, lookFile] = await Promise.all([parse('warrior.glb'), parse('plaguedoctor.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, doctor, ['longsword', OPPONENTS.plaguedoctor.weapon]);
  const look = readRankLook(lookFile.scene);
  assert.deepEqual(look.keep, [], 'his files keep nothing of his');
  const swapped = opponent.wearLook(look);
  assert.deepEqual(swapped.added.sort(), ['L2_Armour', 'L2_FittedGloves']);
  // Row 5a's rule for a body-replacing look (Lead, #1001): the 45k added-tris bar is read net of the CreatureBody it frees.
  assert.equal(swapped.bodyFreed, 44988, 'his whole CreatureBody is freed, and reported for the net count');
  assert.ok(swapped.tris > swapped.bodyFreed, 'the gate reads tris - bodyFreed');
  // Row 5c (Dom 2026-09-28): the phone pays skinned vertices whole; his live look is 2.3× the body it frees and fails the 60k phone bar.
  assert.equal(swapped.vertices, 99571, 'every skinned vertex of his L2 look, as the phone skins it each pass (L10: 121,511)');
  assert.ok(swapped.vertices > 60000 && swapped.bodyFreed > 0, 'a body-replacing look over 60k vertices: row 5c FAILS it on the phone tier');
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook), body = own.find(d => d.name === 'CreatureBody')!;
  assert.ok(body && own.every(d => !d.visible), 'CreatureBody (his fused costume and head) goes off');
  for (const d of skinned(opponent.anchor).filter(d => d.userData.rankLook)) {
    assert.ok(d.visible && d.parent === body.parent, `${d.name} is on`);
    assert.ok(d.skeleton.bones.every(b => body.skeleton.bones.includes(b)), `${d.name} follows his own bones`);
  }
  let weapon = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) weapon = true; });
  assert.ok(weapon, 'his weapon is never touched');
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

test('waist-cut supports (Lead, #918): one support per vertex, not per triangle corner, gives bit-identical rests and floor table', async () => {
  const [hero, goblin, lookFile] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb')]);
  const keep = ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Skin', 'Wrap.Boots'];
  for (const d of skinned(lookFile.scene).filter(d => keep.map(k => k.replace('.', '')).includes(d.name))) d.removeFromParent();
  lookFile.scene.userData.keep = keep;
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  opponent.wearLook(readRankLook(lookFile.scene));
  const root = opponent.anchor.children[0]!, once = openWaist(root, opponent.anchor), corners = openWaist(root, opponent.anchor, true);
  const halves = (o: ReturnType<typeof openWaist>) => o.group.children.map(h => [h.name, h.position.toArray(), h.quaternion.toArray()]);
  // Every placement is the rests (upper, legs, weapon) slerped in and lifted to the floor table: equal at every progress means all of them are.
  for (let i = 0; i <= 240; i++) { once.update(i / 240, false); corners.update(i / 240, false); assert.deepStrictEqual(halves(once), halves(corners), `progress ${i / 240}`); }
  once.dispose(); corners.dispose();
});
