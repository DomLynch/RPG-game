# Mob fights: beasts, packs and the world layer (Combat PROPOSAL, 2026-10-07)

Docs only. Nothing here is built. Combat leads; Strategy and Lead rule; Expansion owns the world side (camps, who waits where), asked 2026-10-07, answers folded in at the end.

## The rule this is written to (Dom, via Strategy and Lead)

1. **Every Origins creature fight is the Pit duel**, "nothing less, nothing more": stamina, poise, guard and parry, reads, hit-stop and blood all apply. No auto-attack, no tab-target, no dice. The only ruled difference is the seeded ±10% damage roll on world mobs.
2. **One combat engine for the Pit and the world.** Never fork or copy combat code into `origins/`. World-only differences are add-on layers on top of the shared `src/` engine, and a layer that proves better can come back into the Pit. A combat change is proven in the Pit first, under the usual RV gates.

The path is already right: tap -> `startEncounterDuel` (`origins/preview/encounter-duel.ts`) -> `pit-duel.ts` -> `stepDuel`. The Pit does not know a mob from a warden.

## What "a layer" means in this repo (the three hooks that already exist)

| Hook | Where | In the record digest? | Today's use |
|---|---|---|---|
| **Opponent row** | `ROSTER` (roster.ts) -> `ARCHETYPES` / `OWN_KNOBS` -> `OPPONENTS` (moves.ts): weapon, rig, scale, health, poise, `regen`, `speed`, per-level `AiProfile` | yes (SIM_FILES) | every ladder opponent; RV30 gave three of them their own rows |
| **Observer layer** | a file in `src/` outside SIM_FILES that reads a `Duel` and writes nothing back: `src/twist.ts` (`stepTwist(duel, flags, was)`, `flee-at {percent, catchSeconds?}`), `src/hamstrung.ts`, `src/sparring.ts` | **no** | the Bounty twists, hit presentation |
| **Per-fighter scalar** | `Fighter.perk` (#1642): per-mille integers set once at duel start, read at the sites in `stepDuel` behind `perk ? scaled : plain` | yes, one RV bump, proven byte-identical with the layer absent | patron perks |

Plus the data seam `origins/mobs/styles.ts` (#1646): a mob row names a `MobStyle`, which points at an existing opponent. A new layer joins by one of these hooks, never a second AI.

## (a) Beasts: wolf and boar families (#1648)

**Finding: a beast needs no new AI and no new rule.** Every verb the brief names already exists on the same stamina, guard and read loop:

| Beast verb | Existing mechanism | Tell (what the player reads) |
|---|---|---|
| **bite** | a light: `light_right` / `light_left` of a one-hand short weapon | the move's `windup` ticks (the knife's light is 14 windup, 6 active, 16 recovery); `AiProfile.reaction` and `tellReaction` set how fast the beast answers yours |
| **lunge** | `thrust` plus `AiProfile.dash` (sprint into an opening from outside reach), the Goblin's stab | the thrust's short windup is the tell; a dash closes a few ticks, so the beast is hard to outrun but not unreadable |
| **maul** | `heavy_overhead` (and `heavy` charge) | the long windup and the chamber hold: the same tell as every heavy; a heavy breaks a guard and costs the beast stamina |
| **retreat** | `AiProfile.disengage` (hop back out after a landed blow), `step` (backstep over roll), `circle` (lateral drift), `discipline` (stamina floor below which it backs off) | the hop is visible and punishable on a read |
| **flee when hurt** | the observer layer `src/twist.ts` `flee-at {percent}` | the mob turns and leaves at that share of health (`MOB_STYLE.beast.fleeBelow` 0.3 = `percent: 30`); fled is not a kill (`resolveFight`) |

**The recipe, using the precedents already in `moves.ts`:**

- **Wolf** = the Goblin's archetype: the `knife` table (`KNIFE_MOVES`: slash, stab, short reach), a profile with `dash`, `disengage`, `circle`, `step` and `regen` up (fast, hit and run, never a flat brawl), a lower `health`, a `speed` over 1. Presentation clips come from `creaturePaths(KNIFE_PATHS, 'Bite')`, the same call the Minotaur's maul uses (`creaturePaths(CLEAVER_PATHS, 'Maul')`).
- **Boar** = the Pitborn / Minotaur archetype: a maul-style heavy table (`MAUL`, `CLEAVER_MOVES`), high `poise` (shrugs a plain blow) and `health`, low `dash`, `braceHeavy`-style stand-and-punish, `speed` under 1 except a charge that is a `thrust` with `stepIn`. Clips `creaturePaths(CLEAVER_PATHS, 'Gore')`.
- Both register as `WeaponId` entries in `WEAPONS` and as `ROSTER` rows, so Expansion's mob row names `style: 'beast'` plus a `family`, and `MOB_STYLE` resolves it (`origins/mobs/styles.ts`, one more row per family, no new table).

**What is new, and what it costs:**

1. A weapon id and a roster row each: `moves.ts` and `roster.ts` are SIM_FILES, so this is **one RV bump with an empty REACH** (no existing fight changes; the proof is the usual one: ladder battery and `rng-fingerprint` cells unchanged).
2. The **rig and hit shape**. `RigId` is `hero | goblin | nightborn | minotaur | wraith` and `bladeImpact` sweeps a blade against an upright capsule (head, torso, legs). A long, low four-legged body does not fit it. v1 proposal: the beast fights as an upright capsule at its own `scale` (the Goblin's .78 precedent), the head bone drives the bite path, and the quadruped mesh is presentation on top. A true quadruped hit shape is a rig bake (`scripts/bake-blades.mjs`) and a hit-region table, which is Characters and Art's call: **open question for Characters (#1648)**.
3. Balance: both rows go through the usual battery before they ship (no strategy over its cap), and the mob's level scaling reuses `opponentAt(o, level)`.

## (b) Packs: a camp that does not become a flat brawl

The Pit is 1v1 (`Duel.fighters` is a pair, the net and rollback hash it, the AI and every rule are two-sided). **Proposal: keep it 1v1. A pack is a sequence of bouts against the same player, not a 2v1.**

- **One engages.** The player taps one member (the world layer picks the first by the camp row's order, leader last). The duel is the ordinary Pit duel against that member.
- **The rest wait.** Waiting members are presentation-only actors on a ring outside the play circle, circling and snarling. They are not in the sim: they cannot hit or be hit, and the duel never sees them. This is what stops the flat brawl, and it needs nothing from `src/`.
- **The next steps in.** When the engaged member dies or flees (`stepTwist` `FoeFled`), the next walks in from the ring edge through the ordinary `approach` phase of its own profile. `withFoe(duel, foe)` builds the next bout from the **same** duel: `{ ...duel, fighters: [duel.fighters[0], opponentFighter(next, body)], finish: null }`. It uses only existing exports, so it is an **observer-layer file in `src/` outside SIM_FILES** (proposed `src/pack.ts`), no RV bump.
- **Nothing less, nothing more.** The player's health, stamina, posture, wound and cooldowns carry over unchanged: no free heal, no reset. The only breather is the walk-in itself (the new foe's own approach time), which is the same rest any duel gives between exchanges.
- **The leader is last.** Camp order is data (Expansion's row); the leader enters when no follower is left standing. Followers flee on the beast threshold, so a camp does not become a grind of identical deaths.
- **Not a kill-link fight in v1.** Today encounter results are reported to `resolveFight` by the client and no record is minted for them. A pack fight has no single opponent id, so it records nothing in v1. If Backend wants a verified camp fight, that is a record format question (a swap tick per bout) for the Auditor, **not** part of this proposal.

**What the sim needs for packs: nothing.** The one cost is the walk-in placement (the next foe spawns at the play-circle edge: `opponentFighter(next, body)` takes the body), which is world data.

## (c) The ±10% world roll and the casters (the one part that does need `src/`)

- **The ±10% seeded roll** (`origins/luck/luck.ts hitDamage`, applied to a mob's blows). Today `worldMobHit` returns a roll but nothing in the duel applies it: damage is computed inside `stepDuel` (`dealt`, integer). Two ways: (1) **an observer** that rewrites health after each tick is wrong: death, chip, wound and stagger all key off the same step, so a post-hoc edit can revive or double-count; (2) **a per-fighter scalar**, the same site as the #1642 perk templates, with the roll as a pure function of `(seed, hit number)` passed in at duel start: `Fighter.roll?: { seed: number; pct: (seed: number, n: number) => number }`, read where `dealt` is formed behind `roll ? scaled : plain`, absent = today's fight byte for byte. **Recommend (2)**: one RV bump, proven in the Pit first by the same differential as #1642 (the Pit never sets it, so it is the identity proof: `hashDuel` equal over the replay corpus and the ladder battery), then the world switches it on for mobs only. It cannot come back into the Pit by accident, and it can by decision.
- **Casters** map to `MOB_STYLE.caster` -> the Witch: the existing special (`withSpecials`, witchfire) rides the same duel flag; nothing new for the world.
- **Skirmisher** (the old "archer") is the Nightborn proxy; ranged stays out of the duel (Strategy).

## Summary: the layer hook in `src/` for every item

| Item | Hook | New `src/` code | RV bump |
|---|---|---|---|
| Wolf / boar movesets | opponent row + weapon table (`creaturePaths`) | a `WEAPONS` id and a `ROSTER` row each | **one, REACH empty** |
| Quadruped hit shape | rig bake + hit regions | Characters' call | with the above, only if a true quadruped shape is wanted |
| Beast flee | observer `src/twist.ts` `flee-at` | none (exists) | none |
| Packs | observer `src/pack.ts` `withFoe` | one small file, outside SIM_FILES | none |
| ±10% mob roll | per-fighter scalar `Fighter.roll` beside `Fighter.perk` | one site in `stepDuel` | **one**, differential proof, Pit first |
| Casters, skirmishers | `MOB_STYLE` -> existing opponent | none | none |

Order: patron perks #1642 first (it builds the scalar mechanism the roll reuses), then the roll, then beasts, then packs (needs no RV, so it can go the moment Expansion's camp rows exist).

## Open questions

- **Characters:** quadruped hit shape for #1648 (upright capsule at scale for v1, or a baked quadruped region table).
- **Backend / Auditor:** is a camp fight verified? If yes, a record needs a per-bout swap tick.
- **Strategy:** the walk-in beat is the only rest between pack members; is that "nothing less, nothing more" enough, or should the next member enter on the player's tap?

## Expansion's world-side input (checked in code, 2026-10-07) and the ring API

What exists: a mob is one `MobSpec` row (`id, character, name, encounter|null, body, level, zone, spawn, home, roam, aggro, named`); a "camp" is only a `MOB_PLAN` per spawn kind (scavengers 6, brood 4, ghouls 3) scattered inside a spread radius (16 / 9 / 7 m) of the landmark, each roaming its own home (8 / 6 / 6 m). **No leader, no role, no order, no social aggro** (aggro is "stop and face inside 7 m, named 9 m"; nobody chases). The duel is a separate layer over the walk, so the camp is frozen out of view during a fight. A felled mob is gone for 90 s and the others stay where they were. Won: mob gone, loot, Bounty if held. Lost: try again. Fled is not wired yet; Expansion will walk a fled mob home.

Agreed: the plan above does not break the world side; **next member steps in automatically only for packs (same duel session), never for a lone mob**.

**Fields Combat wants on the camp row** (Expansion owns the row format, #1647 section 7): `leader: boolean` (at most one per camp; the leader enters last) and `order: number` (entry order of the followers; ties by id). No ring slot is stored: it is computed.

**The actor API** (a pure function in `src/pack.ts`, outside SIM_FILES, presentation only):

```ts
// Waiting members on a ring just outside the play circle, in DUEL coordinates (the arena frame the Pit scene draws in), slowly circling.
packRing(waiting: readonly { id: string }[], tick: number): { id: string; x: number; z: number; heading: number }[]
// The next bout from the SAME duel: the player (fighters[0]) carries over unchanged; the new foe starts at the ring edge.
withFoe(duel: Duel, foe: Opponent, at: { x: number; z: number }): Duel
```

The ring sits in the **duel's** coordinates, not the walk's: radius `RADIUS + 1.5` (`src/play-radius.ts`, the circle the duel is fought in), centred on the arena centre, each waiting member at an even angle plus a slow rotation by `tick` (`heading` faces the engaged foe). The world layer converts duel coordinates to the walk the way the Pit duel already does for the engaged mob; it does not need the members' homes (they do not move during a fight) except to choose which members are in the pack (those within the camp's spread). "Who is engaged" out is just `duel.fighters[1]`'s id, which the world layer already owns.
