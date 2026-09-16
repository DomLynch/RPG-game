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

## 5. Character lane — put the cleaver in the shipped Pitborn (`src/assets/pitborn.glb`)
Trunk's Pitborn (#81 part 2) is his own body, loaded directly by `scene.ts`. The cleaver on that body is built and proven:
`src/assets/weapons/cleaver/pitborn-cleaver.glb` (`WARRIOR_FIGHTER=pitborn WARRIOR_WEAPON=cleaver`, 5.5 MB, sheets in
`artifacts/weapons/cleaver-pitborn/`). Two ways to ship it, both one line:
- **(a) recommended:** add `WARRIOR_WEAPON=cleaver` to the Pitborn's build command so `pitborn.glb` itself carries it (no second body
  file in the bundle), and relax `tests/characters.test.ts` "the Pitborn is the warrior's rig…" (line ~109) so **`Heavy`'s arm tracks
  may differ** (the cleaver re-keys that one clip) and the sword nodes may be **empty groups** (they keep the sword's transform; the
  loader and the trail still find them). Everything else in that test holds: same clip list and order, same durations, hunch, scale.
- (b) `src/scene.ts` `OPPONENT_GLB.pitborn` → the `pitborn-cleaver.glb` file as-is.
Nothing else: the cleaver rides the sword's clip family, `WeaponDrawn` renders by default, the trail's `SwordDrawn` lookup finds the
same axis. `WEAPONS.cleaver` is real data now — `?opponent=pitborn` already fights with it; the fairness battery is the gate (§6).

## 6. Combat review — the cleaver's numbers and the scale question
- `CLEAVER_MOVES` / `CLEAVER_PATHS`, all provisional. **What the single edge does** (measured, `artifacts/weapons/tools/edge-check.mjs`):
  the forehand cut leads with the edge → **the chop** (17 dmg, chip .2); the backhand leads with the spine → **the back of the cleaver**,
  a hammer (9 dmg, posture 34, staminaDamage 30, stagger 32); the overhead re-keyed as a **diagonal hack** so the edge leads (edge·motion
  .95 vs the sword's .68; 26 dmg, chip .5, posture 42); the thrust a **poke** (7). Timings 22/8/26, 36/6/36, 18/5/26.
- **The gate passes at the floor:** whiff punisher **4/24 normal · 6/24 hard** (≥ 4); **6/24 stalls** per level (placeholder: 0). Two facts
  the tests pin so a change is deliberate: **lunges equal the sword's** (stepIn scaled by wind-up: .36 / .48 / .87 — with the sword's
  stepIn the longer tells walked chops through the 12-tick backstep, punisher 0/24) and **reach = the sword's spacing estimates**
  (1.65 / 1.9 / 2.0, not the measured 1.7 / 2.2 / 2.05 — measured reaches made the AI hang out of punish range, 10 stalls).
- Fixed in `tests/opponents.test.ts`: the whiff-punisher script timed from the *longsword's* table; now `movesOf(w)`.
- **Scale — your decision, with numbers.** The manifest bakes the cleaver from a 1.0× rig (`veteran-cleaver.glb`, the bake source only),
  as the Pitborn's sword is simulated today (the longsword table is 1.0× though his rendered sword is 1.13×). Baked from his own rig
  (`pitborn-cleaver.glb`, 1.13×): chop lands to **1.85** (1.7), hack **2.4** (2.2), poke **2.2** (2.05) and the whiff punisher goes
  **0/24** — a 12-tick backstep no longer escapes a bigger man. Options: keep 1.0× tables for every fighter (today's fiction, ~10 cm at
  the tip), or bake at 1.13× and re-tune his whiff window (backstep length, his stepIn, or `bladeImpact` scaling the attacker's table by
  `Fighter.scale`). Switching the bake is one manifest line.

## 7. Character lane — the Pitborn's build flag
Whatever §5 decides, the Pitborn rebuild command carries `WARRIOR_WEAPON=cleaver` (and `WEAPON_VARIANT` per the owner's pick) from now
on, or a rebuild hands him the sword.

## 8. Owner — pick the cleaver's silhouette
`artifacts/weapons/cleaver-v3/weapon-turntable.png` (**A**, default: fat scythe, 0.19 m belly out near the hooked tip, 0.20 m
forward sweep), `cleaver-B/` (broad chopper, 0.17 m, square-cut tip), `cleaver-C/` (long sickle, 0.14 m, 0.28 m bend). All 615
triangles, no textures; `WEAPON_VARIANT=A|B|C`. On his body: `cleaver-pitborn/weapon-on-rig.png`.
## For the weapons lane — the Pitborn's cleaver (2026-09-16, from the opponent seam, PR #81)
`WeaponId 'cleaver'` exists as a longsword placeholder; `OPPONENTS.pitborn.weapon = 'cleaver'` already. The full contract (mesh, `WeaponDrawn`
+ `extras.contact`, own `material` value, `WARRIOR_FIGHTER=pitborn WARRIOR_WEAPON=cleaver` hook, manifest entry baked from `src/assets/pitborn.glb`,
heavier stamina / longer heavy recovery, re-run `tests/opponents.test.ts`) is in `artifacts/character/BRIEF-pitborn.md` § Weapon. Sword clip
family only — no new move set; the renderer already plays it, so unlike the trident it is visible in-game the moment the data lands.
