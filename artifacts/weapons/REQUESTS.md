# Weapons lane — requests to other lanes

Open requests from the weapons lane (branch `weapons/trident-v1`). Each names the lane that owns the change. Nothing here is
implemented by the weapons lane; the trident's rig, clips, data, bake and tests land without any of it, unused on trunk.

## 1. Combat + render lanes — a fighter's weapon on screen (blocks the trident being *seen*)

The simulation already fights with the trident's tables (`WEAPONS.trident`, `bladePaths.trident`). The presentation does not follow
the weapon yet:

- `src/characters.ts` loads one fixed clip list (`CLIPS` + `COMBAT_CLIPS`) by name, drives the actions **by position**
  (`actions.slice(5,14)`, `actions[14]`, `[15,16]`), and throws if `SwordDrawn` / `SwordSheathed` are missing.
- `src/combat.ts` `clipOf(move)` / `ATTACKS` map a move id to a *sword* clip key (`light` / `return` / `heavy` / `riposte`).
- The blade trail samples `SwordDrawn` (`bladeTip()` in `src/scene.ts`, `characters.ts` line ~238).

Needed, in the order that keeps trunk green at every step:

1. A per-weapon clip list. The roles the renderer plays today and the trident's clip for each:

   | role (sword clip) | trident clip |
   |---|---|
   | Armed | Trident_Idle |
   | ArmedWalk | Trident_Walk |
   | StrafeLeft / StrafeRight | Trident_StrafeLeft / Trident_StrafeRight |
   | Attack / Return (`light` / `return`) | Trident_Sweep (both sides: one clip, the sim's path is the same) |
   | Heavy (`heavy`) | Trident_High |
   | Riposte (`riposte` = thrust, riposte) | Trident_Thrust; the chained thrust and the riposte: Trident_ThrustChain |
   | Guard | Trident_Guard |
   | BlockImpact | Trident_BlockImpact |
   | Parry | none authored — a shaft guard has no blade to turn; play Trident_BlockImpact, or ask for a Trident_Parry clip |
   | Deflected | Trident_Deflected |
   | Hit / Death | Trident_Hit / Trident_Death |
   | Draw / Roll / Kick / Idle / Walk / Jog / Run | the fighter's own (body clips; a trident fighter starts armed, Draw is never played) |

   The rig `src/assets/weapons/trident/veteran-trident.glb` carries **all 21 sword clips plus the 13 Trident_\*** so any
   intermediate mapping still loads.
2. The weapon node: show `WeaponDrawn` (always: he starts armed), never look for meshes under the sword nodes (they exist,
   empty, so the current loader does not throw). The trail should sample `WeaponDrawn`'s `extras.contact` segment.
3. The opponent's URL → `src/assets/weapons/trident/veteran-trident.glb` (or, once 1–2 are in, rebuild `veteran.glb` with
   `WARRIOR_WEAPON=trident` and point the manifest at it). `tests/characters.test.ts` "the Veteran carries the warrior's clips and
   sword attachments exactly" must then compare bones and the *shared* clips only — the trident Veteran has more clips and no sword
   meshes. That test is the character/combat lanes' file.

## 2. Combat lane — the trident's fight (GAMEPLAY CHANGE, needs review before the flip)

`initialDuel` still gives the opponent the longsword. To flip: `createFighter(..., 'trident')` for side 1, after reviewing:

- **Every number in `TRIDENT_MOVES` / `TRIDENT_PATHS`** (`src/moves.ts`). Provisional. Measured against a standing target
  (tests/weapons.test.ts) with the owner's short trident: thrust lands to **2.25 m** (sword stab 2.0), sweep to 1.75 (cut 1.7),
  pin to 2.15 (heavy 2.2). If 2.25 is too much, `thrust.stepIn` .8 gives ~2.1; the clip's extension is fixed by the bake, the lunge is data.
- **Weak inside the point — a rule, not a number.** `bladeImpact` sweeps the tines from the wind-up pose into the first active tick,
  so a thrust lands from 0.4 m exactly like the sword's. Proposal: a per-move `minReach` (thrust ~0.8 m: the tines' root at the
  contact key is 0.90 m out) below which the thrust reports `AttackMissed`, or sweep only from the first active tick for thrusts.
- **Shaft guard.** `Weapon.guard = 'shaft'` is a tag today. Proposal for the Veteran's `guardProfile`: `{ costScale: 1.15,
  stopsHeavy: false }` — blocks lights and thrusts at a higher stamina price, and a heavy overhead (the pin's counterpart) breaks it.
  If the *defender's* guard kind should reach the audio lane, add it to `Blocked` / `GuardBroken` events (today they carry the
  attacker's weapon and material only).
- **The sweep trips a roll.** Proposal: a `direction: 'low'` attack (the sweep; the kick already is) lands on a rolling target during
  the roll's first half. Today rolls are invulnerable throughout.
- **AI profile** (`src/ai.ts` reads the weapon's own reaches already): at gap > 2.3 walk in; 2.3–1.6 thrust, chain on a hit; 1.6–1.2
  sweep, or step back to thrust range; < 1.0 kick then back-step (he is weak inside the point); raise the shaft guard against heavies
  and thrusts, never against a charged heavy (it breaks). Opener preference: thrust (the spacing tool), the pin as the punish.

## 3. Audio lane

Contact events already carry `material: 'bronze'` for the trident's hits. A shaft guard blocking iron is "iron on wood": needs the
defender's guard kind on `Blocked` / `GuardBroken` (request 2, last bullet) before a cue can pick it.

## 4. Owner

- ~~Pick the silhouette~~ **Picked (2026-09-16): B's fat, wide fork on a stick 60% as long, brown shaft** — variant `short`,
  the default. `artifacts/weapons/trident-v4-short/weapon-turntable.png`. A/B/C remain as `WEAPON_VARIANT` options.
- The trident is held two-handed in every clip (the brief's contract). A one-handed carry for idle / walk / strafe / hit / death was
  offered and not taken; the 13-clip set is complete either way.

---

# Cleaver (the Pitborn's) — requests, 2026-09-16

## 5. Opponent / combat lane — one line makes the Pitborn carry it today
`src/scene.ts` `OPPONENT_GLB.pitborn` → `src/assets/weapons/cleaver/veteran-cleaver.glb` (it borrows `veteran.glb` now). Nothing else:
the cleaver rides the **sword's clip family** (same 21 clips, same order, same names; only `Heavy` is re-keyed on that rig), so the
renderer's fixed clip list and positional actions already play it, `WeaponDrawn` renders by default, and the trail's `SwordDrawn`
lookup finds the same axis (an empty node with the sword's transform, same length). Verified in the harness at 852×393 / 393×852.
`WEAPONS.cleaver` is real data now (was the longsword placeholder from #81) — `?opponent=pitborn` fights with it as soon as this
branch lands, so the Pitborn's fairness battery (`tests/opponents.test.ts`) is the gate and it passes: **whiff punisher 4/24 at
normal, 6/24 at hard** (the gate is ≥ 4). Two things for review, not hidden: normal sits ON the floor, and **6/24 duels stall** at
both levels (neither man dies in 2 min; the placeholder had 0 stalls) — the cleaver's longer recoveries make the AI more cautious.
Also fixed in that file: the whiff-punisher script timed its punish from the LONGSWORD's table (`MOVES[w.move]`) — it now reads the
warden's own weapon (`movesOf(w)`), which every future weapon needs.

## 6. Combat review — the cleaver's numbers (`CLEAVER_MOVES` / `CLEAVER_PATHS`, all provisional)
- **What the single edge does to the sword's moves** (measured from the bake, `artifacts/weapons/tools/edge-check.mjs`): the forehand
  cut leads with the edge → **the chop** (17 dmg, chip .2); the backhand leads with the spine → **the back of the cleaver**, a hammer
  (9 dmg, posture 34, staminaDamage 30, stagger 32 — a distinct move for free); the overhead re-keyed as a **diagonal hack** so the edge
  leads (edge·motion .95 vs the sword's .68; 26 dmg, chip .5, posture 42); the thrust is a **poke** (7 dmg). Timings 22/8/26,
  36/6/36, 18/5/26.
- **Lunges equal the sword's** (stepIn scaled by wind-up: .36 / .48 / .87) — with the sword's stepIn the longer tells walked his chops
  through the player's 12-tick backstep and the whiff punisher went 0/24. **Reach = the sword's spacing estimates** (1.65 / 1.9 / 2.0),
  not the measured frontier (1.7 / 2.2 / 2.05): with measured reaches the AI hung out of punish range (6 → 10 stalls). Both are yours to
  revisit; the tests pin them so a change is deliberate.
- **Scale.** The bake is from the Veteran's rig at 1.0. #81 scales the target capsule for the Pitborn's 1.13, not the attacker's blade
  path. If `pitborn.glb` ships exported at 1.13, re-bake from it (the manifest entry's `glb`) and his reach grows ~13 %; if the scale is
  runtime-only, decide whether `bladeImpact` should scale the attacker's table by his `Fighter.scale`.
- The sim sweeps the node's axis; the blade's 0.20 m forward bend is presentation only (as the sword's diamond section is).

## 7. Character lane — part 2 (pitborn.glb)
Build with `WARRIOR_WEAPON=cleaver` (and `WEAPON_VARIANT` if the owner picks B or C), or he ships with the sword. Then point the
manifest's cleaver entry at `src/assets/pitborn.glb` and re-bake.

## 8. Owner — pick the cleaver's silhouette
`artifacts/weapons/cleaver-v3/weapon-turntable.png` (**A**, default: fat scythe, 0.19 m belly out near the hooked tip, 0.20 m
forward sweep), `cleaver-B/` (broad chopper, 0.17 m, square-cut tip), `cleaver-C/` (long sickle, 0.14 m, 0.28 m bend). All 615
triangles, no textures; `WEAPON_VARIANT=A|B|C`.
