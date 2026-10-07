# Origins Zone 1 encounters (logic only)

Pure functions for the Ash Frontier's fights, built on the Region 1 data (`origins/region1`). No DOM, no clock, no storage and no
`Math.random`. Every failure comes back as a contracts `Result` issue and nothing throws. Nothing in `src/` imports this folder, and
`origins/preview/` does not use it yet.

Spec: `docs/specs/origins/region1-ash-frontier.md` §3 (Bounties), §4 (bosses and creatures), §5 (loot) and §7 (rulings). Loot roll
behaviour comes from `docs/specs/origins/eqemu-loot.md` §5, a clean-room behaviour spec. No donor code was read.

## What it does

- **`fightSetup(id, content, { overlay? })`**: sets up an encounter (a Bounty, the Mere-Mother, the rift) or an open-world creature
  kill. It returns:
  - the foes in fight order and the boss, each with its roster body, level and health;
  - the health bar (for `one-health-bar`, summed by the `oneBarHealth` rule);
  - the twist flags, both all of them and the subset Combat's v1 sim reads;
  - `kind: 'world-mob'`;
  - the seed key.

  A single-foe Bounty's placeholder `challenge` stage is not counted as a second foe. An overlay carries a twist that the content
  does not put on the encounter, such as a grudge's `flee-at {percent}` with no catch window.
- **`fightSeed(seedKey, character, attempt)`**: the fight's 32-bit seed, taken from sha-256 (`origins/boss/hash.ts`).
- **`resolveFight(report, content)`**: returns `{ cleared, forfeit, kill, retry, payout }`.
  - `fled` counts as cleared. It is not a kill, so it pays 0 CP and gives no boss award.
  - `caught` is a kill.
  - `escaped` forfeits that attempt, and the player can retry at once.
  - A loss means the player died. It pays nothing, costs nothing, and the player can retry.
  - A twist outcome that contradicts the fight's flags or the result is refused.
  - A Bounty pays its definition's metal up to `dailyCap` paid wins per UTC day. The caller passes `bountyWinsToday`. Past the cap,
    the kill still pays its row.
  - A world boss rolls its table only on `firstWin` (ruling 9). A repeat pays the row and rolls nothing.
  - The rift boss rolls while `bossRollsThisWeek` is under its PROPOSED cap.
  - `payout.killRow` names the progression row. `null` means 0 CP.
- **`rollLoot(tableId, seed, content, { foeLevel? })`**: a deterministic roll of one Region 1 table, in independent or weighted mode
  with the gate, `dropLimit` and `minDrop`. It returns the item drops and metal. The Bounty placeholder table is refused, because a
  Bounty pays metal only.
- **`intoBackpack(inventory, drops, mint, content)`**: mints each drop as a `loot` item instance (contracts parser, gear at the
  Region 1 tier) and calls the inventory's own `receive`. The inventory module owns capacity, stacking and one-of-each. The delivery
  is all or nothing.
- **`worldMobHit` / `fightHit`**: `luck.hitDamage` with the luck module's seeded source. The ±10% roll applies in both directions
  only for `world-mob` with the flag on. The Pit, PvP and the ladder pass the base damage through.

## Mirrors and provisional numbers

- `TwistFlag`, `TwistOutcome` and `oneBarHealth` mirror `src/twist.ts` from Combat PR #1626 (`combat/twist-flags`). That PR is not
  merged yet. Swap the mirror for an import once it lands.
- PROPOSED: gear tier `Gladiator`, which reads the zone's `lootTier` 3 as the third rank title (region1 §5, open question 5).
- PROVISIONAL (from the content): Mere-Mother health 15,000 and Lambton Worm health 40,000 (both tunable), and the rift weekly
  cap of 5 (PROPOSED in living-world §8.4).
- The health of a Bounty or creature body is the roster body's own health at that level (`src/moves.ts` `opponentAt`). Region 1
  content carries no health for these foes.

## Checks

```sh
node --test tests/origins-encounters.test.ts
```
