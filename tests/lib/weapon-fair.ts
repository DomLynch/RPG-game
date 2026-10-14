// One fairness test per player weapon, registered by tests/player-weapons-fair-<weapon>.test.ts: node --test parallelizes FILES (not the tests inside one),
// and the single table for all weapons was 365 s of the unit suite's 487 s. The same 24-seed table as scripts/player-weapon-battery.mjs (Combat signed it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER } from '../../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS_OFFERED, type WeaponId } from '../../src/fight/moves.ts';
import { STRATEGIES, battery } from '../strategies.ts';

// The pairings over a cap on 2026-09-21, 24 seeds (the same table scripts/player-weapon-battery.mjs prints; Combat ran and signed it).
// An EXACT snapshot: a new over-cap pairing fails this test, and a pairing that comes back under its cap fails it too until the entry is
// removed, so the list is edited only with a fresh table. Combat's ruling: every row is the warden's approach logic meeting a player reach
// it has never seen (their slice), not weapon data and not a rung profile. A weapon with a row here is not in PLAYER_WEAPONS_OFFERED.
export const KNOWN_UNFAIR: string[] = [
  // After the warden reach fix (combat/warden-reach, 2026-09-21): 11 rows → 8. Trident and warhammer come clean everywhere and are offered;
  // scythe was gated here too and LEFT on 2026-09-22 (below). What is left, by cause: cleaver/executioner — a pre-existing cut-tempo row
  // (Weapons: CLEAVER light 22/8/26 vs the sword's 20/8/22); knife/veteran and scythe/veteran — a poker parked at the Veteran's own range;
  // knife/goblin hard "kick only untouched" LEFT on 2026-09-22, and it was the warden's approach exactly as this comment predicted, not
  // knife data. The cause, measured: a guardless warden reading a kicker held at `theirs.kick.reach + .3` (1.50), zeroing his forward
  // drive at 1.45 — but `next.next` is picked once, re-picked only when null, and cleared by being thrown, so with a `light` queued
  // (6599 of 6599 ready ticks) he stood at a gap his own plan could not reach and never attacked: 4-5 attack starts per 7200 ticks,
  // 24/24 stalls. The hold now derives from the inReach margin of the move he has QUEUED (src/fight/ai.ts), and the row goes 3/24 -> under
  // its cap. Gated on `guardShare === 0`, which only the Goblin's three profiles set, so no other warden moved. The knife's two "thrust from range" rows DID leave, 2026-09-22, when its thrust recovery
  // went 15 -> 20 (see KNIFE_MOVES): Veteran 18/24 -> 5/24, Goblin 15/24 -> 6/24, with no other knife pairing moved. (21 would have read
  // 3/24 and 4/24, but it pushes the Goblin's own fight-length pin to a 48.5 s median, over the 45 s ceiling — hence 20.)
  // The scythe's two "thrust from range" rows LEFT on 2026-09-22 when its heel-jab recovery went 18 -> 30 (see SCYTHE_MOVES.thrust):
  // Veteran 19/24 -> 8/24, Goblin 16/24 -> 6/24. It now has no row at any rung, so the table itself puts it in PLAYER_WEAPONS_OFFERED.
  // The estoc's four rows (goblin ×3, dwarf hard) LEFT on 2026-09-23 when Weapons put its move table on its blade's real reach (+0.30 m,
  // #532) — every warden had misjudged its point. The Nightborn wields it, so the same reach made him swing himself out; his aggression
  // (normal .6 → .55, hard .75 → .65, src/fight/moves.ts) holds every weapon's row against him inside the cap with a margin of 4 or more.
  // cleaver/executioner LEFT on 2026-09-23: his normal profile is his own (anticipate 3, lapse .2, read .75; src/fight/moves.ts), light spam 18/24 -> 8/24.
  // maul/executioner LEFT with the cleaver row (bump 8, 2026-09-23): same cause (the 22-tick tell), same fix (#550): light spam 18/24 -> 7/24.
  // The four beta characters (roster-v0) are on LADDER and measured here. Their placeholder profiles (base copies) produced two rows,
  // 'trident/scythe vs plaguedoctor normal: charged heavy only untouched 3/24' (limit 2). Signing them would have un-offered two shipped
  // weapons, so the Plague Doctor took one forced retune instead (lapse .3 -> .2, src/fight/moves.ts): at most 1 untouched, worst row 6/24.
  // Watch: warhammer vs knight normal charged heavy only 12/24, on the cap.
];

export const fairTest = (weapon: WeaponId) => test(`weapon flip: ${weapon} meets every live rung by the rung's caps; its over-cap pairings are exactly the signed snapshot, and it is offered only with no row [slow]`, () => {
  const seeds = 24, over: string[] = [];
  if (weapon !== 'longsword') {   // the longsword is the battery's own pin (tests/battery.test.ts)
    for (const rung of LADDER) for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
      const rows = battery(level, seeds, 7200, OPPONENTS[rung.id], STRATEGIES, weapon);
      for (const [name, r] of Object.entries(rows)) {
        if (name !== 'perfect parry' && r.wins / seeds > cap) over.push(`${weapon} vs ${rung.id} ${level}: ${name} wins ${r.wins}/${seeds}`);
        if (r.untouched > Math.ceil((name === 'perfect parry' ? 8 : 2) * seeds / 24)) over.push(`${weapon} vs ${rung.id} ${level}: ${name} untouched ${r.untouched}/${seeds}`);
      }
    }
  }
  assert.deepEqual(over, KNOWN_UNFAIR.filter(row => row.startsWith(`${weapon} vs `)), 'the over-cap pairings must match the signed snapshot exactly: a new one, or one that came back under its cap, means a fresh table and a fresh signature');
  // Offered = fair everywhere: the excluded set is computed from the table, never typed in by hand.
  // STANDING RULE: no weapon flip may un-offer a weapon the player can already use. If a change would take a shipped weapon OUT of this
  // set, the stack is HELD, not merged — the new weapon waits for the row to go away rather than trading a live one for a shelf one.
  // And more generally: when this test forces a membership change you would not choose, that is the signal to stop and ask, not to comply.
  // It is telling you a product decision is required; it is not making that decision for you.
  if (over.length) assert.ok(!PLAYER_WEAPONS_OFFERED.includes(weapon), `${weapon} is offered but has a pairing over a cap`);
  else assert.ok(PLAYER_WEAPONS_OFFERED.includes(weapon), `${weapon} is fair on every rung and must be offered`);
});
