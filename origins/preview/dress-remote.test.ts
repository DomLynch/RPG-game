// dressRemote (dress-remote.ts): another player's worn set goes on a spawned actor through the SAME call the player's own dressing makes (scene.ts / gear-stage.ts), so the two cannot drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, lootIds, lootPiecesOf, lootWorn } from '../../src/fight/characters.ts';
import { coldPieces, dressRemote, wornIds } from './dress-remote.ts';
import type { Tier } from '../../src/core/index.ts';

// Parse a shipped GLB in Node, as tests/shield-carry.test.ts does (images dropped: decoding is the browser's).
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
async function rig() {
  const asset = await parse('warrior.glb'), pieces = lootPiecesOf((await parse('loot.glb')).scene), { player } = buildWarriors(asset, undefined, ['longsword', 'longsword']);
  return { player, pieces };
}
// Three real pieces from three different slots, as the server's worn set names them.
function someWorn(pieces: ReturnType<typeof lootPiecesOf>) {
  const worn: Record<string, string> = {};
  for (const piece of pieces) { const slot = String(piece.userData.slot); if (!(slot in worn) && slot !== 'Shield' && Object.keys(worn).length < 3) worn[slot] = lootIds(piece)[0]!; }
  return worn;
}
const shown = (player: ReturnType<typeof buildWarriors>['player']) => player.worn().map((m) => `${m.name}|${String(m.userData.slot)}|${(m.material as { name: string; color?: { getHex(): number } }).name}|${(m.material as { color?: { getHex(): number } }).color?.getHex()}`).sort();

test('a remote actor dressed with a worn set wears exactly what the player\'s own dressing puts on', async () => {
  const remote = await rig(), own = await rig(), worn = someWorn(remote.pieces), tiers: Record<string, Tier> = { [Object.values(worn)[0]!]: 'Veteran' };
  assert.equal(Object.keys(worn).length, 3, 'loot.glb has pieces in three slots');
  assert.deepEqual(dressRemote(remote.player, remote.pieces, worn, tiers), [], 'every id matched a piece');
  // the player's own call, as scene.ts and gear-stage.ts make it
  const ids = Object.values(worn);
  own.player.wear(own.pieces.filter((piece) => lootWorn(piece, ids)), undefined, (piece) => tiers[lootIds(piece).find((id) => ids.includes(id)) ?? ''] ?? 'Recruit');
  assert.ok(remote.player.worn().length >= 3, 'the set is on the body');
  assert.deepEqual(shown(remote.player), shown(own.player));
});

test('which pieces a remote would compile on first sight: those whose material is not the warmed hero palette', async () => {
  const { player, pieces } = await rig(), cold = coldPieces(player, pieces);
  console.log(`cold (${cold.length}/${pieces.length}):`, cold.join(' '));
  assert.ok(cold.includes('knight.Body.KnightIron'), 'the Knight\'s iron is its own material');
  assert.ok(!cold.includes('goblin.Body.Steel'), 'the Goblin\'s Steel is the hero\'s mapped Steel (warm)');
});

test('a re-dress undresses what is no longer worn, and an id the build does not know is handed back', async () => {
  const { player, pieces } = await rig(), worn = someWorn(pieces);
  dressRemote(player, pieces, worn);
  assert.ok(player.worn().length > 0);
  assert.deepEqual(dressRemote(player, pieces, { Helmet: 'nobody.Helmet.Nothing' }), ['nobody.Helmet.Nothing']);
  assert.equal(player.worn().length, 0, 'the old set came off');
  assert.deepEqual(dressRemote(player, pieces, {}), []);
  assert.deepEqual(wornIds({ Helmet: '', Body: 'a' }), ['a'], 'an empty id is nothing worn');
});
