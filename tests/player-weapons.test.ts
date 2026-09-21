// The player weapon flip (Brief 5): the sim takes the player's weapon at the door, a non-longsword weapon starts armed, the fight record
// carries the weapon (a version-1 record still decodes as the longsword), and every weapon a player can carry is fair against every live
// rung by the rung's own caps. The full 24-seed table for Combat's signature is scripts/player-weapon-battery.mjs; this pin runs 8 seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { initialDuel } from '../src/duel.ts';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS, WEAPONS } from '../src/moves.ts';
import { RECORD_VERSION, createRecorder, decodeRecord, encodeRecord, packRecord, unpackRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { STRATEGIES, arena, battery, k, kt } from './strategies.ts';

test('weapon flip: the player starts sheathed with the longsword and armed with any other weapon, on the hero rig, with that weapon\'s tables', () => {
  assert.equal(initialDuel().fighters[0].phase, 'sheathed');
  for (const weapon of PLAYER_WEAPONS) {
    const f = initialDuel(OPPONENTS.veteran, weapon).fighters[0];
    assert.equal(f.weapon, weapon); assert.equal(f.rig, 'hero');
    assert.equal(f.phase, weapon === 'longsword' ? 'sheathed' : 'ready', `${weapon}: ${weapon === 'longsword' ? 'the draw beat' : 'armed at the door'}`);
    assert.equal(initialPractice(1, OPPONENTS.goblin, weapon).duel.fighters[0].weapon, weapon);
  }
});

test('weapon flip: the record carries the weapon; a version-1 record decodes as the longsword; an unknown weapon is refused; the replay verifies on that weapon [slow]', async () => {
  // A knife fight against the Goblin, recorded the way main.ts records: the quantized intent is what the sim steps.
  const rec = createRecorder({ weapon: 'knife', build: 'x', opponent: 'goblin', profile: 'normal', seed: 5 });
  let p = initialPractice(5, OPPONENTS.goblin, 'knife');
  for (let t = 0; t < 3600 && !p.finish; t++) p = stepPractice(p, rec.push(STRATEGIES['light spam'](p.duel)), OPPONENTS.goblin.profiles.normal);
  const record = rec.finish(p.finish ? (p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
  assert.equal(record.weapon, 'knife');
  const bytes = packRecord(record);
  assert.equal(bytes[2], RECORD_VERSION);
  assert.deepEqual(unpackRecord(bytes), record);
  assert.deepEqual(await decodeRecord(await encodeRecord(record)), record);
  assert.equal(verifyRecord(record).ok, true, 'the replay steps the knife, not the longsword');
  assert.equal(verifyRecord({ ...record, weapon: 'longsword' }).ok, false, 'the same intents with the longsword are another fight');
  // A version-1 stream: magic, version 1, build, opponent, profile, seed, 0 ticks, outcome — no weapon field.
  const v1 = new Uint8Array([0x46, 0x4b, 1, 1, 0x78, 6, ...[...'goblin'].map(c => c.charCodeAt(0)), 1, 5, 0, 0, 0, 0, 0, 0, 0, 3]);
  const old = unpackRecord(v1);
  assert.equal(old.weapon, 'longsword'); assert.equal(old.v, RECORD_VERSION); assert.equal(old.opponent, 'goblin'); assert.equal(old.ticks, 0);
  const odd = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); odd[3 + 1 + 1 + 1 + 6 + 1] = 0x7a;   // the weapon's first byte → 'znife'
  assert.throws(() => unpackRecord(odd), /unknown weapon/);
});

test('weapon flip: the strategies\' distances scale by the player weapon\'s reach and are exactly the longsword\'s with the longsword', () => {
  const d = arena(); assert.equal(k(d), 1); assert.equal(kt(d), 1);
  for (const weapon of PLAYER_WEAPONS) {
    const w = arena(OPPONENTS.veteran, weapon);
    assert.equal(k(w), WEAPONS[weapon].moves.light_right.reach / WEAPONS.longsword.moves.light_right.reach);
    assert.equal(kt(w), WEAPONS[weapon].moves.thrust.reach / WEAPONS.longsword.moves.thrust.reach);
  }
});

// Pairings over a cap on 2026-09-21 (8 seeds; the 24-seed table in scripts/player-weapon-battery.mjs showed the same weapons and rungs plus
// knife/trident/scythe pokes stalling the Goblin at hard). Combat's tuning list, weapon-side only (Weapons lane), never a rung profile:
// entries LEAVE this list as pairings are tuned and signed; nothing may be added. A weapon with an entry here is not offered to the player.
const KNOWN_UNFAIR = [
  'cleaver vs executioner normal: light spam wins 5/8',
  'knife vs veteran normal: thrust from range wins 7/8',
  'estoc vs goblin normal: thrust from range wins 8/8',
  'estoc vs goblin hard: thrust from range wins 7/8',
  'estoc vs dwarf hard: thrust from range wins 3/8',
  'scythe vs veteran normal: thrust from range wins 5/8',
];

test('weapon flip: every player weapon is fair against every live rung by the rung\'s caps, except the pairings on Combat\'s tuning list, which may only shrink (8 seeds; the 24-seed table is the script) [slow]', () => {
  const seeds = 8, over: string[] = [];
  for (const weapon of PLAYER_WEAPONS) { if (weapon === 'longsword') continue;   // the longsword is the battery's own pin (tests/battery.test.ts)
    for (const rung of LADDER) for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
      const rows = battery(level, seeds, 7200, OPPONENTS[rung.id], STRATEGIES, weapon);
      for (const [name, r] of Object.entries(rows)) {
        if (name !== 'perfect parry' && r.wins / seeds > cap) over.push(`${weapon} vs ${rung.id} ${level}: ${name} wins ${r.wins}/${seeds}`);
        if (r.untouched > Math.ceil((name === 'perfect parry' ? 8 : 2) * seeds / 24)) over.push(`${weapon} vs ${rung.id} ${level}: ${name} untouched ${r.untouched}/${seeds}`);
      }
    }
  }
  assert.deepEqual(over, KNOWN_UNFAIR, 'a pairing over a cap that is not on the tuning list, or a tuned one still over: neither ships (weapon-side tuning, never the rung)');
});
