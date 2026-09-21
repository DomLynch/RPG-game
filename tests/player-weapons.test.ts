// The player weapon flip (Brief 5): the sim takes the player's weapon at the door, a non-longsword weapon starts armed, the fight record
// carries the weapon (a version-1 record still decodes as the longsword), and every weapon a player can carry is fair against every live
// rung by the rung's own caps. The pin below runs the same 24-seed table as scripts/player-weapon-battery.mjs (Combat signed it) and derives the offered set from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { initialDuel } from '../src/duel.ts';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS, PLAYER_WEAPONS_OFFERED, WEAPONS } from '../src/moves.ts';
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

// The pairings over a cap on 2026-09-21, 24 seeds (the same table scripts/player-weapon-battery.mjs prints; Combat ran and signed it).
// An EXACT snapshot: a new over-cap pairing fails this test, and a pairing that comes back under its cap fails it too until the entry is
// removed, so the list is edited only with a fresh table. Combat's ruling: every row is the warden's approach logic meeting a player reach
// it has never seen (their slice), not weapon data and not a rung profile. A weapon with a row here is not in PLAYER_WEAPONS_OFFERED.
const KNOWN_UNFAIR = [
  'cleaver vs executioner normal: light spam wins 17/24',
  'knife vs veteran normal: thrust from range wins 18/24',
  'knife vs goblin normal: kick only untouched 3/24',
  'knife vs goblin hard: kick only untouched 3/24',
  'estoc vs goblin normal: thrust from range wins 22/24',
  'estoc vs goblin hard: light spam wins 11/24',
  'estoc vs goblin hard: thrust from range wins 22/24',
  'estoc vs dwarf hard: thrust from range wins 10/24',
  'trident vs goblin hard: thrust from range untouched 4/24',
  'scythe vs veteran normal: thrust from range wins 19/24',
  'scythe vs goblin hard: thrust from range untouched 4/24',
];

test('weapon flip: every player weapon meets every live rung by the rung\'s caps; the over-cap pairings are exactly the signed snapshot, and only weapons with no row are offered [slow]', () => {
  const seeds = 24, over: string[] = [];
  for (const weapon of PLAYER_WEAPONS) { if (weapon === 'longsword') continue;   // the longsword is the battery's own pin (tests/battery.test.ts)
    for (const rung of LADDER) for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
      const rows = battery(level, seeds, 7200, OPPONENTS[rung.id], STRATEGIES, weapon);
      for (const [name, r] of Object.entries(rows)) {
        if (name !== 'perfect parry' && r.wins / seeds > cap) over.push(`${weapon} vs ${rung.id} ${level}: ${name} wins ${r.wins}/${seeds}`);
        if (r.untouched > Math.ceil((name === 'perfect parry' ? 8 : 2) * seeds / 24)) over.push(`${weapon} vs ${rung.id} ${level}: ${name} untouched ${r.untouched}/${seeds}`);
      }
    }
  }
  assert.deepEqual(over, KNOWN_UNFAIR, 'the over-cap pairings must match the signed snapshot exactly: a new one, or one that came back under its cap, means a fresh table and a fresh signature');
  // Offered = fair everywhere: the excluded set is computed from the table, never typed in by hand.
  const unfair = new Set(over.map(row => row.split(' vs ')[0]));
  for (const weapon of PLAYER_WEAPONS_OFFERED) { assert.ok(PLAYER_WEAPONS.includes(weapon), `${weapon} is a player weapon`); assert.ok(!unfair.has(weapon), `${weapon} is offered but has a pairing over a cap`); }
  for (const weapon of PLAYER_WEAPONS) if (!unfair.has(weapon)) assert.ok(PLAYER_WEAPONS_OFFERED.includes(weapon), `${weapon} is fair on every rung and must be offered`);
});
