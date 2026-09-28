import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { armOpponent, buildWarriors, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { kitWorn } from '../src/loot.ts';

// Parse a shipped GLB in Node, as tests/shield-carry.test.ts does (images dropped: decoding is the browser's).
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const named = (root: Object3D, pattern: RegExp) => { const out: Object3D[] = []; root.traverse(o => { if (pattern.test(o.name)) out.push(o); }); return out; };

// SCOPE:76: the Centurion carries gladius + scutum from Legionary. His rig bakes the trident; the gladius comes from its equip file.
test('the Centurion wears the gladius equip file in place of his baked trident, on the sword clips', async () => {
  const veteran = await parse('veteran.glb'), gladius = await parse('weapons/player/gladius.glb');
  assert.equal(named(veteran.scene, /^WeaponDrawn(_\d+)?$/).length, 3, 'veteran.glb bakes the trident in three parts');
  const armed = armOpponent(veteran, gladius);
  const drawn = named(armed.scene, /^(WeaponDrawn|SwordDrawn|SwordSheathed|WeaponSheathed)(_\d+)?$/);
  assert.deepEqual(drawn.map(o => o.name), ['WeaponDrawn'], 'one drawn weapon, the gladius; no trident part and no sword pair left');
  assert.equal(drawn[0]!.parent?.name, 'hand_r', 'rigid under his sword hand, as the hero build places it');
  assert.equal(named(veteran.scene, /^WeaponDrawn(_\d+)?$/).length, 3, 'a copy: the loaded rig keeps its trident for the fallback');
  // The opponent side builds on the sword family veteran.glb already carries (zero clips authored).
  const { opponent } = buildWarriors(await parse('warrior.glb'), armed, ['longsword', 'gladius']);
  assert.ok(opponent.anchor, 'the opponent builds with the gladius clips');
});

test('with the gladius he wears his scutum and carries it off the blade; with the trident it stays off', async () => {
  const pieces = lootPiecesOf((await parse('loot.glb')).scene), veteran = await parse('veteran.glb'), gladius = await parse('weapons/player/gladius.glb');
  assert.ok(kitWorn('veteran', false).includes('veteran.Shield'), 'a one-hander wears his Shield piece');
  assert.ok(!kitWorn('veteran', true).includes('veteran.Shield'), 'a two-hander does not');
  // The same Centurion in the same settled guard, bare and with the scutum: the carry (characters.ts SHIELD_CARRY) re-aims his left arm.
  const offHand = async (shield: boolean) => {
    const { opponent } = buildWarriors(await parse('warrior.glb'), armOpponent(veteran, gladius), ['longsword', 'gladius']);
    if (shield) opponent.wear(pieces.filter(p => lootWorn(p, kitWorn('veteran', false))));
    let board: Object3D | undefined; opponent.anchor.traverse(o => { if (o.userData?.slot === 'Shield') board ??= o; });
    assert.equal(!!board, shield, shield ? 'the scutum is on him' : 'no scutum');
    for (let i = 0; i < 30; i++) opponent.update(0, 1 / 30, 'guard', 0);
    opponent.anchor.updateMatrixWorld(true);
    let hand: Object3D | undefined; opponent.anchor.traverse(o => { if (o.name === 'hand_l') hand ??= o; });
    return hand!.getWorldPosition(new Vector3());
  };
  const moved = (await offHand(true)).distanceTo(await offHand(false));
  assert.ok(moved > .1, `the carry moves his off hand ${moved.toFixed(3)} m from the bare guard`);
});
