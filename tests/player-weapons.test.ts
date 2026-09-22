// The player weapon flip (Brief 5): the sim takes the player's weapon at the door, a non-longsword weapon starts armed, the fight record
// carries the weapon (an older record version is refused, never replayed as a different fight), and every weapon a player can carry is fair against every live
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

test('weapon flip: the record carries the weapon; an older record version is refused; an unknown weapon is refused; the replay verifies on that weapon [slow]', async () => {
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
  // A version-1 stream (magic, version 1, build, opponent, profile, seed, 0 ticks, outcome, no weapon field) and a version-2 stream
  // (the same with the weapon) are both refused: the rules moved under them (#371, #366), so decoding one would replay a different fight.
  const v1 = new Uint8Array([0x46, 0x4b, 1, 1, 0x78, 6, ...[...'goblin'].map(c => c.charCodeAt(0)), 1, 5, 0, 0, 0, 0, 0, 0, 0, 3]);
  assert.throws(() => unpackRecord(v1), /version 1 is not supported/);
  const v2 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v2[2] = 2;
  assert.throws(() => unpackRecord(v2), /version 2 is not supported/);
  assert.equal(RECORD_VERSION, 3);
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
  // After the warden reach fix (combat/warden-reach, 2026-09-21): 11 rows → 8. Trident and warhammer come clean everywhere and are offered;
  // scythe stays gated (still over on the Veteran at range). What is left, by cause: cleaver/executioner — a pre-existing cut-tempo row
  // (Weapons: CLEAVER light 22/8/26 vs the sword's 20/8/22); knife/veteran and scythe/veteran — a poker parked at the Veteran's own range;
  // knife/goblin ×2 — a pre-existing kicker-vs-knife mismatch on the guardless Goblin (present before this PR, not a reach regression);
  // estoc/goblin ×2 and estoc/dwarf hard — the estoc's move table sits .3–.4 m short of its blade bake (tests/weapons.test.ts "real reach"),
  // so every warden misjudges its point until Weapons corrects ESTOC_MOVES.
  'cleaver vs executioner normal: light spam wins 17/24',
  'knife vs veteran normal: thrust from range wins 18/24',
  'knife vs goblin normal: thrust from range wins 15/24',   // Goblin normal reaction 11 (ladder slice, 2026-09-22): the slower read lets a poker park at range; the knife's "kick only untouched" row clears at the same time
  'knife vs goblin hard: kick only untouched 3/24',
  'estoc vs goblin normal: thrust from range wins 24/24',
  'estoc vs goblin hard: light spam wins 11/24',
  'estoc vs goblin hard: thrust from range wins 22/24',
  'estoc vs dwarf hard: thrust from range wins 10/24',
  'scythe vs veteran normal: thrust from range wins 19/24',
  'scythe vs goblin normal: thrust from range wins 19/24',   // Goblin normal reaction 11 (ladder slice, 2026-09-22)
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
