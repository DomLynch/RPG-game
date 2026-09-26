// The player weapon flip (Brief 5): the sim takes the player's weapon at the door, a non-longsword weapon starts armed, the fight record
// carries the weapon (an older record version is refused, never replayed as a different fight), and every weapon a player can carry is fair against every live
// rung by the rung's own caps. The pin below runs the same 24-seed table as scripts/player-weapon-battery.mjs (Combat signed it) and derives the offered set from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent, initialDuel } from '../src/duel.ts';
import { NO_HIP_DRAW, clipFor, drawRole } from '../src/characters.ts';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS, PLAYER_WEAPONS_OFFERED, WEAPONS } from '../src/moves.ts';
import { RECORD_VERSION, createRecorder, decodeRecord, encodeRecord, packRecord, unpackRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { STRATEGIES, arena, battery, k, kt } from './strategies.ts';

test('every weapon starts the fight SHEATHED (Dom via Strategy, 2026-09-25): the draw beat for a taken weapon too, on the hero rig, with that weapon\'s tables', () => {
  assert.equal(initialDuel().fighters[0].phase, 'sheathed');
  assert.equal(initialDuel(OPPONENTS.goblin, 'knife').fighters[0].phase, 'sheathed');
  for (const weapon of new Set([...PLAYER_WEAPONS, ...PLAYER_WEAPONS_OFFERED])) for (const opponent of Object.values(OPPONENTS)) {
    const f = initialDuel(opponent, weapon).fighters[0];
    assert.equal(f.weapon, weapon); assert.equal(f.rig, 'hero');
    assert.equal(f.phase, 'sheathed', `${weapon} vs ${opponent.id}: the draw beat`);
  }
  for (const weapon of PLAYER_WEAPONS) assert.equal(initialPractice(1, OPPONENTS.goblin, weapon).duel.fighters[0].weapon, weapon);
});

test('the draw beat: the one-hand weapons play the hero\'s hip Draw; a pole with its own sheathed carry plays its <Family>_Draw; any other pole raises from its idle (Strategy 2026-09-25)', () => {
  assert.deepEqual([...NO_HIP_DRAW].sort(), ['maul', 'scythe', 'warhammer']);
  for (const weapon of PLAYER_WEAPONS_OFFERED) {
    const pole = WEAPONS[weapon].grip === 'two-hand' && weapon !== 'longsword', own = pole && !NO_HIP_DRAW.includes(weapon);
    assert.equal(drawRole(weapon), pole && !own ? null : 'Draw', `${weapon}: ${!pole ? 'the hip draw' : own ? 'its own draw' : 'no hip draw with a pole'}`);
    if (own) assert.notEqual(clipFor(weapon, 'Draw', true), 'Draw', `${weapon}: a pole draws with its own clip, never the hero's hip draw`);
  }
});

test('the opponent waits while the player is sheathed, whatever the weapon: no attack while the player stands undrawn, and the fight starts on the draw', () => {
  for (const weapon of PLAYER_WEAPONS_OFFERED) for (const opponent of [OPPONENTS.veteran, OPPONENTS.goblin, OPPONENTS.executioner]) {
    let p = initialPractice(7, opponent, weapon);
    const health = p.duel.fighters[0].health;
    for (let t = 0; t < 240; t++) {   // four seconds standing undrawn: before #713's regression a taken weapon was attacked on tick 1
      p = stepPractice(p, idleIntent());
      assert.equal(p.duel.fighters[0].phase, 'sheathed', `${weapon}: still sheathed at ${t}`);
      assert.notEqual(p.duel.fighters[1].phase, 'attack', `${weapon} vs ${opponent.id}: attacked a sheathed player at tick ${t}`);
    }
    assert.equal(p.duel.fighters[0].health, health, `${weapon}: untouched while sheathed`);
    p = stepPractice(p, { ...idleIntent(), action: 'light' });
    assert.equal(p.duel.fighters[0].phase, 'draw', `${weapon}: the first press draws`);
  }
});

test('weapon flip: the record carries the weapon; an older record version is refused; an unknown weapon is refused; the replay verifies on that weapon [slow]', async () => {
  // A knife fight against the Goblin, recorded the way main.ts records: the quantized intent is what the sim steps.
  const rec = createRecorder({ weapon: 'knife', build: 'x', opponent: 'goblin', profile: 'normal', seed: 5 });
  // Every weapon starts SHEATHED (2026-09-25): the first press draws the knife, and the Goblin waits for it (ai.ts), as a player does.
  let p = initialPractice(5, OPPONENTS.goblin, 'knife');
  assert.equal(p.duel.fighters[0].phase, 'sheathed');
  p = stepPractice(p, rec.push({ ...idleIntent(), action: 'light' }), OPPONENTS.goblin.profiles.normal);
  assert.equal(p.duel.fighters[0].phase, 'draw', 'the knife is drawn, not held at the door');
  for (let t = 1; t < 3600 && !p.finish; t++) p = stepPractice(p, rec.push(STRATEGIES['light spam'](p.duel)), OPPONENTS.goblin.profiles.normal);
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
  // A version-3 stream joins them: the lorarii's whip tell (#431) adds events to the duel stream, so a fight recorded on 3 replays with a
  // whip that never rose.
  const v1 = new Uint8Array([0x46, 0x4b, 1, 1, 0x78, 6, ...[...'goblin'].map(c => c.charCodeAt(0)), 1, 5, 0, 0, 0, 0, 0, 0, 0, 3]);
  assert.throws(() => unpackRecord(v1), /version 1 is not supported/);
  const v2 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v2[2] = 2;
  assert.throws(() => unpackRecord(v2), /version 2 is not supported/);
  const v3 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v3[2] = 3;
  assert.throws(() => unpackRecord(v3), /version 3 is not supported/);
  const v4 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v4[2] = 4;
  assert.throws(() => unpackRecord(v4), /version 4 is not supported/);
  // A version-5 stream joins them (2026-09-22): the kicker-hover hold fix changes how a warden closes, so a fight recorded on 5 replays
  // with a Goblin who stands somewhere else.
  const v5 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v5[2] = 5;
  assert.throws(() => unpackRecord(v5), /version 5 is not supported/);
  // A version-6 stream joins them (2026-09-23, Publish B): the estoc's reach and the Nightborn's profile change the fight.
  const v6 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v6[2] = 6;
  assert.throws(() => unpackRecord(v6), /version 6 is not supported/);
  const v7 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v7[2] = 7;
  assert.throws(() => unpackRecord(v7), /version 7 is not supported/);
  const v8 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v8[2] = 8;
  assert.throws(() => unpackRecord(v8), /version 8 is not supported/);
  const v9 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v9[2] = 9;
  assert.throws(() => unpackRecord(v9), /version 9 is not supported/);
  // A version-10 stream joins them (2026-09-25, bump 11): every weapon now starts sheathed, so a v10 taken-weapon fight replays with no draw beat.
  const v10 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v10[2] = 10;
  assert.throws(() => unpackRecord(v10), /version 10 is not supported/);
  // A version-11 stream joins them (2026-09-25, bump 12, SKILL 1): the header carries the equipped skill after the weapon, so a v11 record has no skill byte.
  const v11 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v11[2] = 11;
  assert.throws(() => unpackRecord(v11), /version 11 is not supported/);
  // A version-12 stream joins them (2026-09-25, bump 13): the day-one Pommel Strike and the Goblin's kick lunge at pace 1 (#761).
  const v12 = new Uint8Array(packRecord({ ...record, ticks: 0, intents: [] })); v12[2] = 12;
  assert.throws(() => unpackRecord(v12), /version 12 is not supported/);
  assert.equal(RECORD_VERSION, 13);
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
const KNOWN_UNFAIR: string[] = [
  // After the warden reach fix (combat/warden-reach, 2026-09-21): 11 rows → 8. Trident and warhammer come clean everywhere and are offered;
  // scythe was gated here too and LEFT on 2026-09-22 (below). What is left, by cause: cleaver/executioner — a pre-existing cut-tempo row
  // (Weapons: CLEAVER light 22/8/26 vs the sword's 20/8/22); knife/veteran and scythe/veteran — a poker parked at the Veteran's own range;
  // knife/goblin hard "kick only untouched" LEFT on 2026-09-22, and it was the warden's approach exactly as this comment predicted, not
  // knife data. The cause, measured: a guardless warden reading a kicker held at `theirs.kick.reach + .3` (1.50), zeroing his forward
  // drive at 1.45 — but `next.next` is picked once, re-picked only when null, and cleared by being thrown, so with a `light` queued
  // (6599 of 6599 ready ticks) he stood at a gap his own plan could not reach and never attacked: 4-5 attack starts per 7200 ticks,
  // 24/24 stalls. The hold now derives from the inReach margin of the move he has QUEUED (src/ai.ts), and the row goes 3/24 -> under
  // its cap. Gated on `guardShare === 0`, which only the Goblin's three profiles set, so no other warden moved. The knife's two "thrust from range" rows DID leave, 2026-09-22, when its thrust recovery
  // went 15 -> 20 (see KNIFE_MOVES): Veteran 18/24 -> 5/24, Goblin 15/24 -> 6/24, with no other knife pairing moved. (21 would have read
  // 3/24 and 4/24, but it pushes the Goblin's own fight-length pin to a 48.5 s median, over the 45 s ceiling — hence 20.)
  // The scythe's two "thrust from range" rows LEFT on 2026-09-22 when its heel-jab recovery went 18 -> 30 (see SCYTHE_MOVES.thrust):
  // Veteran 19/24 -> 8/24, Goblin 16/24 -> 6/24. It now has no row at any rung, so the table itself puts it in PLAYER_WEAPONS_OFFERED.
  // The estoc's four rows (goblin ×3, dwarf hard) LEFT on 2026-09-23 when Weapons put its move table on its blade's real reach (+0.30 m,
  // #532) — every warden had misjudged its point. The Nightborn wields it, so the same reach made him swing himself out; his aggression
  // (normal .6 → .55, hard .75 → .65, src/moves.ts) holds every weapon's row against him inside the cap with a margin of 4 or more.
  // cleaver/executioner LEFT on 2026-09-23: his normal profile is his own (anticipate 3, lapse .2, read .75; src/moves.ts), light spam 18/24 -> 8/24.
  // maul/executioner LEFT with the cleaver row (bump 8, 2026-09-23): same cause (the 22-tick tell), same fix (#550): light spam 18/24 -> 7/24.
  // The four beta characters (roster-v0) are on LADDER and measured here. Their placeholder profiles (base copies) produced two rows,
  // 'trident/scythe vs plaguedoctor normal: charged heavy only untouched 3/24' (limit 2). Signing them would have un-offered two shipped
  // weapons, so the Plague Doctor took one forced retune instead (lapse .3 -> .2, src/moves.ts): at most 1 untouched, worst row 6/24.
  // Watch: warhammer vs knight normal charged heavy only 12/24, on the cap.
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
  // STANDING RULE: no weapon flip may un-offer a weapon the player can already use. If a change would take a shipped weapon OUT of this
  // set, the stack is HELD, not merged — the new weapon waits for the row to go away rather than trading a live one for a shelf one.
  // And more generally: when this test forces a membership change you would not choose, that is the signal to stop and ask, not to comply.
  // It is telling you a product decision is required; it is not making that decision for you.
  const unfair = new Set(over.map(row => row.split(' vs ')[0]));
  for (const weapon of PLAYER_WEAPONS_OFFERED) { assert.ok(PLAYER_WEAPONS.includes(weapon), `${weapon} is a player weapon`); assert.ok(!unfair.has(weapon), `${weapon} is offered but has a pairing over a cap`); }
  for (const weapon of PLAYER_WEAPONS) if (!unfair.has(weapon)) assert.ok(PLAYER_WEAPONS_OFFERED.includes(weapon), `${weapon} is fair on every rung and must be offered`);
});
