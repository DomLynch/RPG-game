# Creature behaviour spec: readability, noticing, idle, spawning, fight, loot (Frontier mobs)

- Spec author: analyst-expansion (clean-room spec, ruling 8), 2026-10-07. Implementers build from this file alone and must not open any donor tree.
- Status: proposal for the Expansion lane to build in section order. Every number is a PARAMETER with a stated default and range; Combat and World tune the ones they own on a running build.
- Our side read (it is ours): `origins/preview/mobs.ts` (on `origin/expansion/mob-fight`, not yet on trunk), `origins/preview/hunt.ts`, `origins/encounters/encounters.ts` (`fightSetup`, `resolveFight`, `rollLoot`, `intoBackpack`), `origins/progression/model.ts` (`falloffPermille`), `docs/specs/origins/region1-ash-frontier.md`, `eqemu-loot.md`, `gothic-routines.md`, `combat-study.md`, `src/moves.ts` (`AiProfile`).
- Donors (read-only on the VPS at `/opt/frankendom-shadow/work/expansion-donors`, except world-of-claudecraft, now on Dom's Mac at `~/Developer/donors/world-of-claudecraft`): see the per-donor table. Skyrim was never read; the "alert beat" is our own design.
- Units: metres, seconds, degrees. Fixed 60 Hz simulation time where a tick is named. Creature logic is presentation-and-world logic: it never touches `src/` (duel sim, `RECORD_VERSION`, RV, fingerprint). The duel itself is Combat's `startEncounterDuel`.

## Non-negotiable: every creature fight is the Pit duel (Dom, 2026-10-07)

"Nothing less, nothing more." Every Origins creature fight is the Pit duel: the same `src/` engine, the same controls, the same timing. No auto-attack, no tab-target, no dice, no second combat engine, and no combat code copied into `origins/`. The one difference is the seeded, shown, breakpoint-checked plus-or-minus 10% damage roll on world mobs outside the Pit (never timing). World-only behaviour (noticing, flee, beast moves, packs, camps) is an add-on layer over `src/`, and a combat change is proven in the Pit first under the RV gates. Anywhere this file reads like a donor's fight resolution (a hit chance, an auto-swing, a target lock), it is a pattern for presentation or world behaviour only; the fight itself stays the duel.

## 0. Summary

Today a Frontier creature wanders inside a roam radius of a home point and, when the hero comes inside a fixed aggro ring (7 m common, 9 m named, 1.5 m hysteresis), stops and faces the hero; a tap starts Combat's duel, a win rolls loot and may pay a Bounty, and the felled creature is gone for 90 s. This spec grows that into a readable living population in six builds. (1) Readability: a seven-band con colour derived from the same level-gap ladder that prices a kill (so the colour and the payout can never disagree), a red health bar on creatures that are hunting you, and a night ground light so a creature is visible in the dark at 375 px. (2) Noticing: a two-step alert (a "?" while it suspects, a "!" when it commits), a sight cone plus a short hearing radius, a fight-noise pull so a nearby duel draws nearby creatures, social pull inside a camp, and a leash that sends a chaser home. (3) Idle: the existing home-radius wander, camps of 2-3, and a day/night lite that changes activity, aggro radius and spawn mix. (4) Spawning: slot-based weighted spawn groups, a 2-3 minute respawn, an area cap on live creatures and no spawn near the hero. (5) Fight: a style row per creature kind (brute, skirmisher, caster, beast) that biases the approach and the opponent profile Combat already has, plus low-health fleeing for beasts through the existing `flee-at` twist. (6) Loot: weighted drop tables, global pools, a con gate (grey kills drop nothing) feeding the existing `rollLoot`, `intoBackpack` and the Bounty. Nothing here adds a new currency, a new stat, or a change to the fixed spine (Attack/RES caps 1.15 / 0.80).

## 0.1 Per-donor table

Licence class: **MIT-adapt** = readable, adaptable with a `THIRD_PARTY_NOTICES` line (numbers and shapes may be used; they are written below in our words). **GPL-behaviour-only** = analyst read it; this file holds behaviour in our words, no code, no identifiers, no tables. **ours** = Frankendom's own rule.

| Donor (pinned commit) | Licence class | Files read | What was taken | Sections |
|---|---|---|---|---|
| world-of-claudecraft `f46f30f5` | MIT-adapt | `src/sim/mob/aggro_ranges.ts`, `mob/locomotion.ts`, `mob/social_aggro.ts`, `mob/flee_rules.ts`, `mob/targeting.ts`, `flee_speed.ts`, `respawn_policy.ts`, `types.ts`, `sim.ts` (flee constants), `render/reaction.ts`, `render/nameplate_threat.ts` | aggro range scaling per level gap with floor and ceiling; trivial-gap rule; wander ring around spawn; leash and evade-home with a stall guard; social pull radius; flee rules and speed cap; flat respawn with a supply-over-demand argument; con palette; red threat plate | 1, 2, 3, 4, 5 |
| daggerfall-unity `2343305` | MIT-adapt | `Scripts/Game/EnemySenses.cs`, `EnemyMotor.cs`, `Items/LootTables.cs`, `Utility/RandomEncounters.cs` (shape only) | 180 degree field of view, short hearing radius that only helps after detection, last-known position, 200-tick give-up timer, retreat decision shape, per-category loot chance matrix with a coin range | 2, 6 |
| SCAR `e62b63a` | MIT-adapt | `docs/EN/Developers Manual For SCAR 2.0+.md` | the "action row" shape: distance band, arc, chance, cooldown, priority, chain chance | 5 |
| CombatPathingRevolution `0061785` | MIT-adapt | `doc/en/Developers Guidelines of CPR.md`, `src/Settings.h` | the approach-movement parameter set: inner and outer radii, back-off, circling arc, fall-back distance and wait | 5 |
| OpenGothic `801f6ed5` | MIT-adapt | `common/world/objects/npc.cpp` (senses, perception), `common/world/worldobjects.cpp` (passive perception), `common/game/constants.h`, `game/fightalgo.cpp` | view cone half-angle 100 degrees, ray-clear test, per-event perception ranges that default to the creature's own sense range, passive broadcast ignoring facing and line of sight, perception period | 2, 3 |
| EQEmu `4aceae18` | GPL-behaviour-only | `zone/mob_ai.cpp` (con, assist), `zone/aggro.cpp`, `zone/spawn2.cpp`, `zone/spawngroup.cpp`, `zone/npc.cpp` (call for help), `common/ruletypes.h` | con colours by level gap and the "grey does not aggro" rule; respawn timer with variance; weighted spawn group with per-type limit, group limit and time-of-day window; retry in 5 s when blocked; call-for-help radius with an assist cap | 1, 2, 4, 6 |
| ModernUO `261ea01a` | GPL-behaviour-only | `Mobiles/AI/MeleeAI.cs`, `ArcherAI.cs`, `MageAI.cs`, `AnimalAI.cs`, `BaseAI/BaseAI.cs`, `BaseCreature.cs`, `Engines/Spawners/*` | the four roles and what each does in a fight; flee threshold and chance per role; chase leash as a multiple of perception range; spawner count, delay window, per-entry weight and cap | 4, 5 |
| openmw `71fc0a4a`, ZenKit `ddf27dec`, inkjs `6b115341`, REGoth | not used | none for this spec | OpenMW, ZenKit and inkjs have nothing creature-behaviour specific; REGoth is not in the donor folder | none |
| Skyrim | never | none | the "?" then "!" beat is Dom's design brief, written here as our own rule | 2 |

## 0.2 Manifest (spec author / implementer / source-seen), one block per section

| Section | Spec author | Implementer | Source-seen (spec author only; implementer sees none) |
|---|---|---|---|
| 1 Readability | analyst-expansion | Expansion (rules, HUD bar); Characters (body, con ring art) | EQEmu (GPL, behaviour), world-of-claudecraft (MIT) |
| 2 Noticing | analyst-expansion | Expansion | OpenGothic (MIT), daggerfall-unity (MIT), world-of-claudecraft (MIT), EQEmu (GPL, behaviour) |
| 3 Idle | analyst-expansion | Expansion (rules); World (camp props, fires, night light) | world-of-claudecraft (MIT), OpenGothic (MIT) |
| 4 Spawning | analyst-expansion | Expansion | EQEmu (GPL, behaviour), ModernUO (GPL, behaviour), world-of-claudecraft (MIT) |
| 5 Fight | analyst-expansion | Expansion (rows, approach); Combat (opponent numbers, `startEncounterDuel`) | ModernUO (GPL, behaviour), world-of-claudecraft (MIT), SCAR (MIT), CombatPathingRevolution (MIT) |
| 6 Loot | analyst-expansion | Expansion | EQEmu (GPL, behaviour), daggerfall-unity (MIT) |
| 7 Mob row format | analyst-expansion | Expansion; Characters (look extensions) | none (ours: reads `origins/world/generate.ts`, `schema.ts`, `origins/mobs/styles.ts`, `origins/preview/mob-looks.ts`, the legends-rule skill) |

## 0.3 `THIRD_PARTY_NOTICES` lines the MIT-adapted parts need

`THIRD_PARTY_NOTICES.md` is not in this tree yet, and this PR does not edit it. When it exists, add one line per donor actually adapted:

1. `world-of-claudecraft (MIT), commit f46f30f5849989e44d7aa1bf62b3b14e435bc2fe: creature aggro scaling, leash/evade and stall guard, social pull, flee rules, respawn policy and con palette as adapted in origins/mobs (docs/specs/origins/mobs.md sections 1-5).`
2. `daggerfall-unity (MIT), commit 2343305: enemy senses (field of view, hearing radius, last-known position, give-up timer) and the per-category loot chance shape, as adapted in docs/specs/origins/mobs.md sections 2 and 6.`
3. `OpenGothic (MIT), commit 801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1: view cone half-angle, perception ranges and passive fight-sound perception, as adapted in docs/specs/origins/mobs.md sections 2 and 3.`
4. `SCAR (MIT), commit e62b63a: the action-row shape (distance band, arc, chance, cooldown, priority, chain chance), as adapted in docs/specs/origins/mobs.md section 5.`
5. `CombatPathingRevolution (MIT), commit 0061785: the approach-movement parameter set (radii, back-off, circling, fall-back), as adapted in docs/specs/origins/mobs.md section 5.`

No line is needed for EQEmu or ModernUO (GPL, behaviour only, nothing copied) nor for ZenKit and inkjs (unused).

## 0.4 Conventions used in every section

- **Source column:** a donor path (and licence class) or `ours`. A parameter with no donor is `ours`.
- **Parameter notation:** `name = default (min to max)`. A parameter marked `[content]` lives in the creature's content row (data-driven); the rest are module constants in one `TUNING` object like the current `mobs.ts`.
- **Determinism:** nothing here reads the wall clock or `Math.random`. Each creature owns a seeded stream (`mixSeed(TUNING.seed, slotIndex)` plus a per-use salt), exactly as `mobs.ts` does. World time comes in as an argument (`worldSeconds`, `phase`), never from a clock.
- **Preview-only vs shipped:** the logic is pure TypeScript under `origins/`. "Preview-only" in each section lists what the `?region=1` page does that the shipped server must replace (authority, persistence, interest management).

## 0.5 State vocabulary (shared by sections 2, 3 and 5)

| State | Meaning | Today |
|---|---|---|
| `idle` | standing between ambles | exists |
| `wander` | walking to a point inside the roam radius | exists |
| `sleep` | night rest for diurnal kinds (section 3) | new |
| `suspect` | noticed something, not committed: shows "?" (section 2) | new (today's `aggro` mode is the nearest) |
| `hunt` | committed: shows "!" then closes on the hero or a noise point | new |
| `search` | lost the hero, walking to the last known point | new |
| `ring` | joined a fight someone else is in: waits at the ring (combat-study 2A) | new |
| `engaged` | in Combat's duel (the creature is owned by the duel until it ends) | exists as a tap |
| `flee` | wounded beast running (section 5) | new |
| `return` | walking home, not targetable | new |
| `down` | felled; slot timer running (section 4) | exists as "gone 90 s" |

The current `Mode = 'idle' | 'wander' | 'aggro'` maps to: `aggro` becomes `suspect` while the hero is inside the notice ring and `hunt` after commit; `engage: 'tap'` keeps today's behaviour (section 2.4).

---

## 1. READABILITY

### 1.1 Purpose

Let the player judge at a glance whether a creature is worth fighting, who is coming for them, and where a creature stands in the dark. Three pieces: con colour, threat bar, night ground light.

### 1.2 Behaviour

**Con band (one function, one source of truth).** Let `d = creatureLevel - heroLevel`. The band is read from the same ladder that pays a kill, `falloffPermille(d)` in `origins/progression/model.ts`, so colour and CP can never disagree (ours; shape of the seven EQ colours, EQEmu, GPL-behaviour-only: white at an even level, yellow just above, red from three above, bands widening downward, grey as "not worth it").

| Band | `falloffPermille(d)` | Gap `d` today | Reads as | Source |
|---|---|---|---|---|
| grey | 0 | `d <= -6` (more than a whole title below) | trivial, pays nothing, does not hunt you | ours; EQEmu behaviour |
| green | 200 | `d = -5` | easy | ours |
| light blue | 500 | `d = -4, -3` | comfortable | ours |
| blue | 900 | `d = -2, -1` | slightly easy | ours |
| white | 1000 | `d = 0` | even | ours; EQEmu behaviour |
| yellow | 1100 | `d = 1, 2` | tougher | ours; EQEmu behaviour |
| red | 1250 | `d >= 3` | dangerous | ours; EQEmu behaviour |

The module exports `conBand(permille): Band` mapping the seven permille values to bands (an unknown permille rounds down to the nearest listed band). It must be derived from `falloffPermille`, never from a copied gap table, so a retune of `RANK_STEPS` or the ladder moves the colours with it. EQ widens its grey band as the viewer's level rises; ours is level-independent by the progression model's own rule ("cap-independent by construction"), so do not add a level-scaled band.

**Palette (defaults; Characters may retune, but colour is never the only cue).**

| Band | Default colour | Source |
|---|---|---|
| grey | `#9d9d9d` | world-of-claudecraft `src/render/reaction.ts` (MIT-adapt) |
| green | `#7fdc4f` | world-of-claudecraft `src/render/reaction.ts` (MIT-adapt) |
| light blue | `#6fc3ff` | ours |
| blue | `#4a7dff` | ours |
| white | `#f2f2f2` | ours |
| yellow | `#ffe97a` | world-of-claudecraft `src/render/reaction.ts` (MIT-adapt) |
| red | `#ff4444` | world-of-claudecraft `src/render/reaction.ts` (MIT-adapt) |

Non-colour cue (ours, required): the con ring under the creature carries a dash count equal to the band index (grey 0 dashes, red 6), so a colour-blind player can read it. Named and elite creatures use the same band for the name and ring, and add a shape cue (`named` a double ring, `elite` a notched ring); that art is Characters'.

**Where con shows.** The name line (always while the creature is within `labelRange`), the con ring (always within `ringRange`), and the tap card. A dead or felled creature draws grey and no ring.

**Threat bar (the red bar).** A creature's health bar is neutral (the con colour, dimmed) until a creature is *targeting you*; then the bar turns red and the creature gets a small red pip on its name. A creature is "threatening the hero" when all hold: it is alive, it is in state `hunt`, `ring`, `engaged` or `flee-and-returning-to-fight`, and its target is the hero. A creature in `suspect` does not count (it has not committed); a creature in `idle`, `wander`, `search` or `return` does not count. The bar is shown only when the creature is the tapped target, inside `barRange`, or threatening. (world-of-claudecraft `src/render/nameplate_threat.ts`, MIT-adapt: a hostile mob actively aggroed on the viewer gets its plate tinted red, distinct from the ground selection ring that marks what you have targeted.)

**Night ground light.** A fake light (a soft additive decal, never a real scene light) under each creature so it reads at night at 375 px wide.

- Strength: `lightAlpha = lightMin + (lightMax - lightMin) * night`, where `night` in `[0,1]` is the World lane's smoothed night factor (0 day, 1 deepest night; section 3 defines the clock). Zero in full daylight, so no cost by day.
- Colour: warm and neutral by default; tinted red while the creature threatens the hero (reuses the threat state, so the red bar and the red glow agree); tinted toward the con colour only for the tapped target.
- Radius: `body radius * lightRadiusMult`.
- Cap: only the nearest `lightCap` creatures within `lightRange` get one (the same visible-set cap the view already applies; the decal count is bounded by `TUNING.cap`).
- Fires and props (camp fires, braziers) are World's; a creature standing within `fireRadius` of a lit fire gets no extra decal (the fire already lights it).

### 1.3 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| `labelRange` | 18 m | 10 to 30 | ours |
| `ringRange` | 24 m | 12 to 40 | ours |
| `barRange` | 12 m | 6 to 20 | ours |
| `lightMin` | 0.25 | 0.1 to 0.5 | ours |
| `lightMax` | 0.6 | 0.4 to 0.9 | ours |
| `lightRadiusMult` | 1.8 | 1.2 to 3 | ours |
| `lightCap` | 8 | 4 to `TUNING.cap` (12) | ours |
| `lightRange` | 30 m | 15 to 45 | ours (never past `TUNING.range` 45) |
| `fireRadius` | 6 m | 3 to 10 | ours |

### 1.4 Data-driven content fields

`level` (already on the creature's `mob` encounter form: `form.level`), and optional `named: boolean` (already derived from `spawn.encounter`). Nothing else: con is computed, never stored. The colour table and the dash-count rule are one constant table in `origins/preview/readability.ts`.

### 1.5 Acceptance tests

1. `conBand(falloffPermille(d))` for `d` from -10 to +6: `d <= -6` grey; -5 green; -4 and -3 light blue; -2 and -1 blue; 0 white; 1 and 2 yellow; `d >= 3` red.
2. Monotone: the band index never decreases as `d` rises.
3. Consistency: for every `d`, band is grey if and only if `isGrey(d)` (the progression model's own grey test).
4. Retune guard: a test that swaps in a different `RANK_STEPS` (or injects a ladder) moves the grey boundary and the con boundary together.
5. A hero at L11 sees the shipped creatures (L11 to L15 across scavengers, brood, ghouls, bosses) as white to red, never grey; the same creatures against a hero at L18 read grey for the L11 scavengers (`d = -7`).
6. Threat: a creature in `hunt` targeting the hero reports `threatening = true`; in `suspect`, `search`, `return`, `idle`, `wander` or dead reports false; in `engaged` with another player's id reports false.
7. Night light: `lightAlpha` is 0 at `night = 0`, `lightMax` at `night = 1`, monotone between; no more than `lightCap` decals for any visible set.
8. Colour-blind rule: every band has a distinct dash count; no two bands share a count.

### 1.6 Preview-only

The nameplate and ring are drawn by the preview's own view layer (`mobs-view.ts`). The shipped client reuses the pure functions and replaces the drawing. Night factor is a stub (a slow sine of preview time) until World's clock lands.

### 1.7 Owner

Expansion: `conBand`, threat rule, night-light rule, the tests. Characters: body models, the con ring art (dashes, named and elite shapes). World: the night factor and fire lights.

---

## 2. NOTICING

### 2.1 Purpose

Make a creature feel like it perceives the world instead of switching on at a circle: it must see you (in front, with a clear line), hear you at short range, hesitate when unsure, commit with a visible beat, be drawn by a nearby fight, and give up and go home instead of chasing forever.

### 2.2 Behaviour: the perception test

Per creature per perception tick (`perceptEvery`, staggered by creature index so no frame carries all of them). Perception is computed only for creatures inside `TUNING.range` of the hero (the existing visible-set rule); distant creatures sleep their perception.

Let `d` be the distance creature to hero, `facing` the creature's heading, `bearing` the angle from creature to hero.

1. **Grey rule (first, cheap).** If the creature's con band against the hero is grey and the creature has no `alwaysAggro` flag, it never notices the hero at all (it may still hear fight noise, section 2.5). (EQEmu `zone/aggro.cpp` GPL-behaviour: a trivial-level creature does not aggro unless flagged always-aggro or the target is sitting; world-of-claudecraft `mob/targeting.ts` MIT-adapt: a creature ignores a player that out-levels it by a fixed gap unless it is elite, rare or boss. Ours: the gap is our grey, `d <= -6`.)
2. **Commit radius** `R_commit` (this is today's aggro ring): `clamp(base + gapGain * d, rMin, rMax)` where `base` is 7 m common or 9 m named (today's `TUNING.aggro` and `aggroNamed`), `d = creatureLevel - heroLevel`. (world-of-claudecraft `mob/aggro_ranges.ts` and `locomotion.ts`, MIT-adapt: radius is the template range plus a per-level gain, floored and capped; ours is rescaled for our short zones.)
3. **Notice radius** `R_notice = R_commit * noticeMult`. Sight works out to here.
4. **Sight:** the hero is seen when `d < R_notice` **and** the bearing is within `viewHalf` of `facing` **and** the straight segment creature-eye to hero is clear of solids (`Build.solids`, the same list `mobStand` uses). (OpenGothic `common/world/objects/npc.cpp`, MIT-adapt: sight needs range, a view cone about +-100 degrees, and an unobstructed ray; daggerfall-unity `EnemySenses.cs`, MIT-adapt: field of view 180 degrees total, eye-height ray.) Default `viewHalf = 100` (OpenGothic; daggerfall's equivalent is 90). Open point recorded in `gothic-routines.md` 5.4: implement +-100 about the facing and capture a golden before tuning.
5. **Hearing:** the hero is heard when `d < R_hear` and no solid blocks more than `hearBlock` of the segment (a wall muffles; DFU: "if something is between them, hearing fails"; a prop does not). Hearing needs no facing. Hearing alone never commits a creature: it can only start `suspect` (daggerfall-unity `EnemySenses.cs`, MIT-adapt: hearing is consulted only when sight fails, and only helps once detected; ours is looser: it can start a suspicion). `R_hear` is multiplied by `heroNoise`: 1.0 while the hero moves, `stillNoise` while still.
6. **Last known point:** whenever sight or hearing succeeds, store `lastSeen = hero position` and `lastSeenAt = worldSeconds` (daggerfall-unity, MIT-adapt: last known target position drives pursuit, so a creature goes to where it last perceived you, not to where you are now).

### 2.3 Behaviour: the alert beat (suspect, then commit)

A suspicion meter `s` in `[0,1]` per creature (ours; the "?" then "!" beat is Dom's brief).

| Rule | Behaviour |
|---|---|
| Fill | while perceiving (seen or heard): `s += dt / fillTime(d)`; `fillTime(d)` is `fillFar` at `d >= R_notice` falling linearly to `fillNear` at `d <= R_commit * 0.5`. Heard-but-not-seen fills at `hearFillMult` (slower). |
| Decay | while not perceiving: `s -= dt / decayTime`. |
| Enter `suspect` | `s > 0` and state is `idle`, `wander` or `sleep`. The creature stops, turns toward `lastSeen` at `turn` rad/s, and shows "?" (the glyph brightness follows `s`). |
| Commit | `s >= 1`: the creature freezes for `commitBeat` seconds showing "!" (an animation tell Characters supplies; the sim only holds the state), then enters `hunt`. During the beat the creature can still be tapped (a tap during the beat is the engage). |
| Fade back | `s` reaches 0 in `suspect`: the creature looks at `lastSeen` for `lookAround` seconds, then returns to `idle` with its wander timer reset. |
| Commit shortcut | the hero within `R_commit * 0.5` and seen: `s` jumps to 1 (no creature stays unsure with the hero at arm's length). |
| Hysteresis | once `hunt`, the creature keeps the hero until `d > R_commit + hold` (today's `hold` 1.5 m) **and** it has lost sight for `giveUp` seconds (2.5 below). No flicker on the rim. |

### 2.4 Behaviour: what `hunt` does (and the tap)

`engage` is a content-level mode (global default in `TUNING`, overridable per creature row):

| `engage` | Behaviour | Default |
|---|---|---|
| `tap` | a committed creature stops and faces the hero (today); the duel starts only when the player taps it | **default in the preview** (today's behaviour, Dom's approved flow) |
| `contact` | a committed creature chases at `huntSpeed`; the duel starts when it reaches `contactDist` of the hero (Combat's `startEncounterDuel`, same call as a tap) | off in the preview; on for hostile kinds only when Dom rules it |

Under both modes a tap on any creature in `suspect`, `hunt`, `ring` or `search` starts the duel; a tap on a `return`, `flee` or `down` creature does nothing (not targetable, so a wounded leashing creature cannot be exploited).

`hunt` movement (when `engage = contact` or the creature is drawn to a noise): straight-line approach to the target point with the existing `stand` test, `huntSpeed = 1.8 m/s` (slower than the hero's 2.3 m/s so a player can always outrun a chase; the shipped hero speed is the bound). A creature that cannot make `stallMin` metres of progress in `stallTime` seconds is stalled: in `hunt` it gives up and goes to `return`; in `return` it walks phasing through solids until it clears them (world-of-claudecraft `mob/locomotion.ts`, MIT-adapt: a straight-line home that crosses a prop makes no progress, so after about 3 s the creature phases through the blocker until a normal step works).

### 2.5 Behaviour: fight-noise pull

A fight makes noise at a point. Any duel in progress (the hero's own or, later, another player's in the shared world) posts a `FightNoise { at, loudness }` every `noiseEvery` seconds while it runs, and once more at its end. (OpenGothic `common/world/worldobjects.cpp`, MIT-adapt: a fight sound is broadcast to every creature whose perception range for that event, defaulting to its own sense range, reaches the point; it ignores facing and line of sight. Ours adds the cap below.)

For each creature not `engaged`, not `down`, not `flee`, and not the participants:

1. `heard = distance(creature, at) <= loudness * hearAffinity` where `hearAffinity` is a per-creature multiplier (content, default 1.0; 0 for creatures that never respond).
2. If heard and the creature is not already `hunt`: set `lastSeen = at`, `s = max(s, noiseSuspicion)`, enter `suspect` turned toward `at`.
3. If `distance <= loudness * 0.5`: skip the suspicion step and go straight to `hunt` toward `at` (it commits to the fight).
4. **Cap:** at most `noiseCap` creatures are drawn by one fight in any `noiseWindow` seconds, nearest first; the rest stay `suspect`. (EQEmu `zone/npc.cpp` and `ruletypes.h`, GPL-behaviour: a creature calling for help recruits only creatures within an assist range; the number of creatures that can be recruited per window is capped, and a creature that was itself recruited does not call again. Ours reuses the idea; the numbers are ours.)
5. Joiners do not enter the hero's duel. They go to `ring` (stand 4 to 6 m from the fight facing it; combat-study 2A's "next" marker for the first one). Until the encounter director of combat-study 2A exists the ring is purely visual; the director then takes the joiners as its pack. A joiner never calls for help again (no chain reaction).

### 2.6 Behaviour: social pull inside a camp

When a creature commits (enters `hunt`), every creature of the **same spawn group** that is `idle`, `wander` or `sleep` within `socialRadius` of it enters `suspect` with `s = socialSuspicion` toward the same `lastSeen` (not straight to `hunt`). (world-of-claudecraft `mob/social_aggro.ts`, MIT-adapt: a fresh aggro pulls idle same-family neighbours within a small radius; the radius is tuned per family because a too-large radius chain-pulled a whole pond; the pull draws no random numbers, so replays stay stable.) Social pull does not chain: a creature set to `suspect` this way does not itself pull others unless it later commits on its own perception.

### 2.7 Behaviour: give up, search, leash, return

| Event | Behaviour | Source |
|---|---|---|
| Lost sight, not yet far | the creature keeps `hunt` toward `lastSeen` for up to `giveUp` seconds | daggerfall-unity `EnemyMotor.cs`, `EnemySenses.cs` (MIT-adapt: give-up timer of 200 classic ticks, about 11 s, refilled on every detection) |
| `giveUp` runs out | `search`: walk to `lastSeen`, look around `lookAround` s, then `return` | ours; daggerfall (last-known pursuit) |
| Hunted too far from home | if `distance(creature, home) >= leash` or the hunt has lasted `huntMax` seconds: stop, clear the target, `return` | world-of-claudecraft `src/sim/types.ts` and `mob/locomotion.ts` (MIT-adapt: a pulled creature dragged past a leash distance evades home) |
| `return` | walk home at `returnSpeed`, **not targetable**, no perception, no social pull; on arrival: state `idle`, `s = 0`, health refilled to full, a "hit-tag" (who wounded it) cleared | world-of-claudecraft `resetEvadingMob` (MIT-adapt: reset to idle at full health, ready to be pulled again) |
| Stuck on the way | stall guard (2.4) | world-of-claudecraft (MIT-adapt) |

Health note: in v1 a creature's health exists only inside a duel (`fightSetup` builds the foe fresh), so "regenerate on the way home" is a no-op except for the wounded-flee state of section 5, which does carry health for `woundWindow` seconds.

### 2.8 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| `perceptEvery` | 0.25 s | 0.1 to 0.5 | ours (OpenGothic polls at 5 s, too slow for a duel-speed game) |
| `base` (R_commit common / named) | 7 m / 9 m | 5 to 10 / 7 to 12 | ours (today's `TUNING`) |
| `gapGain` | 0.5 m per level | 0 to 1.5 | ours (world-of-claudecraft uses 1.5 per level in much wider bands) |
| `rMin`, `rMax` | 4 m, 12 m | 3 to 5, 9 to 16 | world-of-claudecraft floor 4 and ceiling 20 (MIT), rescaled |
| `noticeMult` | 1.6 | 1.2 to 2.2 | ours |
| `viewHalf` | 100 degrees | 60 to 110 | OpenGothic (MIT-adapt); daggerfall 90 |
| `R_hear` | 4.5 m | 2 to 8 | daggerfall hearing radius is about a quarter of its sight (MIT-adapt idea), ours |
| `stillNoise` | 0.5 | 0 to 1 | ours (daggerfall: a still target is harder to detect) |
| `hearBlock` | 0.25 (share of segment blocked) | 0 to 1 | daggerfall (MIT-adapt: static geometry muffles) |
| `fillFar`, `fillNear` | 1.6 s, 0.3 s | 0.8 to 3, 0.1 to 0.6 | ours |
| `hearFillMult` | 0.5 | 0.25 to 1 | ours |
| `decayTime` | 3.0 s | 1.5 to 6 | ours |
| `commitBeat` | 0.4 s | 0.25 to 0.8 | ours |
| `lookAround` | 2.0 s | 1 to 4 | ours |
| `hold` | 1.5 m | 0.5 to 3 | ours (today) |
| `giveUp` | 11 s | 6 to 20 | daggerfall-unity (MIT-adapt: 200 ticks of about 0.055 s) |
| `huntSpeed` | 1.8 m/s | 1.2 to 2.2 (< hero speed) | ours |
| `contactDist` | 1.8 m | 1.2 to 2.5 | ours |
| `leash` | 26 m | 18 to 40 | world-of-claudecraft leash is five times its wander radius (MIT-adapt idea), ours: about 3.3 times the 8 m scavenger roam |
| `huntMax` | 40 s | 20 to 90 | ours |
| `returnSpeed` | 1.4 m/s | 1 to 2 | world-of-claudecraft: 1.6 times walk (MIT-adapt idea) |
| `stallTime`, `stallMin` | 3 s, 0.25 m | 2 to 5, 0.1 to 0.5 | world-of-claudecraft stall timeout 3 s (MIT-adapt) |
| `noiseEvery` | 2 s | 1 to 4 | ours |
| `loudness` (duel) | 14 m | 8 to 24 | ours |
| `hearAffinity` [content] | 1.0 | 0 to 2 | ours |
| `noiseSuspicion` | 0.5 | 0.2 to 0.8 | ours |
| `noiseCap`, `noiseWindow` | 3, 6 s | 1 to 5, 3 to 10 | EQEmu assist cap 5 per 6 s (GPL, behaviour), ours 3 |
| `socialRadius` | 6 m | 3 to 10 | world-of-claudecraft 5 (MIT-adapt), tuned per family |
| `socialSuspicion` | 0.6 | 0.3 to 0.9 | ours |
| `engage` | `tap` | `tap` or `contact` | ours |

### 2.9 Data-driven content fields (per creature form, all optional with the defaults above)

`aggro` (override of `base`), `noticeMult`, `viewHalf` (`360` allowed for a creature that smells instead of sees), `hearRadius`, `hearAffinity`, `alwaysAggro: boolean` (default false: lets a grey creature still hunt), `engage`, `leash`, `social: boolean` (default true), `senses: ('sight'|'hear')[]`.

### 2.10 Acceptance tests

1. A hero standing in front of a creature at `R_notice` seen: `s` rises to 1 in about `fillFar`; the same hero straight behind the creature (outside the cone) at the same range is **not** seen and `s` stays 0.
2. A wall (a solid on the segment) blocks sight at any angle; the same wall at `hearBlock` blocks hearing; a thin prop (below the block share) does not.
3. A hero inside `R_hear` behind the creature is heard: state becomes `suspect` and never reaches `hunt` from hearing alone, however long the hero stays (hearing fills at `hearFillMult` and caps `s` at 0.9 while unseen).
4. Hysteresis: a hunting creature does not drop the hero while `d <= R_commit + hold`; it keeps hunting for `giveUp` after losing sight, then `search`, then `return`.
5. Grey rule: a hero at L18 against an L11 creature never raises `s`; with `alwaysAggro` it does.
6. `R_commit` scales: `d = +4` gives `base + 2` (clamped to `rMax`); `d = -4` gives `base - 2` (clamped to `rMin`); named base 9.
7. Beat: from `s = 1` to the first tick of `hunt` is `commitBeat` seconds; a tap during the beat starts the duel.
8. Leash: a creature dragged to `leash` metres from home transitions to `return`; it is not targetable (tap does nothing) until it is home; on arrival `s = 0`, state `idle`.
9. Stall: a creature whose path to home is blocked by a solid phases through after `stallTime` and still arrives; a hunting creature stalled for `stallTime` goes to `return`.
10. Fight noise: a duel at point P posts noise; a creature at `0.4 * loudness` goes `hunt`; at `0.9 * loudness` goes `suspect` facing P; at `1.2 * loudness` does not react. With 6 creatures in range, only `noiseCap` leave `suspect` within one `noiseWindow`, nearest first. Joiners end in `ring`, never in the hero's duel, and never post noise.
11. Social pull: a camp member that commits sets idle camp-mates within `socialRadius` to `suspect` at `socialSuspicion`; a camp-mate beyond the radius, or in another spawn group, is unaffected; the pulled mates do not pull a third.
12. Determinism: a replay with the same seed, the same hero path and the same world seconds yields identical states tick for tick (no wall clock, no `Math.random`).
13. `engage = tap`: a committed creature never starts a duel by itself (today's behaviour is preserved bit for bit with the flag at default).

### 2.11 Preview-only

The hero position and world seconds are local; fight noise is only the hero's own duel (no other players); `engage` stays `tap`. The shipped server runs the same pure functions per shard cell and posts noise from every duel in the cell (one-shard.md interest management).

### 2.12 Owner

Expansion. Characters supply the "?" and "!" glyphs and the commit tell animation. Combat supplies the encounter director that consumes joiners (combat-study 2A).

---

## 3. IDLE

### 3.1 Purpose

A population that looks alive between fights: it ambles near home, stands in camps instead of single dots, and the world changes with the clock.

### 3.2 Behaviour: home-radius wander (exists; keep as is)

Per today's `stepMob`: a creature in `idle` waits `idle` seconds (1.5 to 4.5 s), picks a seeded point inside its `roam` radius that `mobStand` accepts, turns toward it at `turn` rad/s, ambles at `walk` (0.9 m/s) and stops on arrival or the moment the next step would leave walkable ground. Wander targets are uniform over the roam disc (sqrt-radius draw). (world-of-claudecraft `mob/locomotion.ts`, MIT-adapt: a seeded point in a ring around spawn, so an out-of-combat creature is never farther from its spawn than the ring; pause between ambles of a few seconds. Today's code already matches; keep the tests.) Two additions:

- Roam never exceeds `leash / 3` (so a legal wander can never trip the leash).
- After a `return`, the wander timer starts at `idle[0]` (no instant re-wander flicker).

### 3.3 Behaviour: camps of 2 to 3

A **camp** is the unit of placement. Today `MOB_PLAN` places `count` creatures scattered over `spread` around the spawn's landmark. Replace with camps:

| Rule | Behaviour |
|---|---|
| Camp size | 2 or 3 creatures, seeded draw (`campSize`, weights `p2` 0.5, `p3` 0.5). A spawn plan's `count` is met by whole camps; the last camp may be 1 if `count` is odd (never zero). |
| Camp centre | a seeded point near the landmark inside the zone that passes `mobStand`; at least `campGap` metres from every other camp's centre. |
| Members' homes | each member's home is a seeded point within `campRadius` of the centre that passes `mobStand`. |
| Roam | `campRoam` (5 m) per member from its own home, so members drift but stay a group. |
| Focus | if the World lane places a `focus` prop at the camp (a fire, a carcass, a cairn), idle members stand within `focusMin..focusMax` of it facing it with probability `focusFacing`; with no prop they face each other. |
| Pairing | within a camp, one member is `lead`: the others choose their next wander target biased `followBias` toward the lead's current position (loose follow, never a formation). |
| Same spawn group | every member shares the camp's `spawnGroup` id (the unit of social pull in 2.6 and of the spawn slot group in 4). |

Camp count and sizes for the shipped Frontier data (proposal; content owner confirms): scavengers 6 = two camps of 3 at the ash pits; brood 4 = two camps of 2 at the reed bank; ghouls 3 = one camp of 3 at the causeway's end. This equals today's counts.

### 3.4 Behaviour: day/night lite

World time comes in as `phase` from World's clock (section 3.8 gives a stub). Four phases: `dawn`, `day`, `dusk`, `night`. The clock itself is World's (gothic-routines.md 5.1 documents a 14.5 to 1 clock and 99-minute day; ours is a parameter `dayLengthS`, default 1200 s = 20 minutes, with `dawn` 6%, `day` 50%, `dusk` 6%, `night` 38% of the day).

Each creature form has `activity: 'diurnal' | 'nocturnal' | 'always'` (content; default `always`). What changes by phase (every multiplier is data, defaults shown):

| Phase | Diurnal | Nocturnal | Always |
|---|---|---|---|
| `day` | activity 1.0, sight 1.0, aggro 1.0 | `sleep`: no wander, activity 0, sight x`sleepSight` 0.4, aggro x`sleepAggro` 0.5 | 1.0 |
| `dawn`, `dusk` | 0.8 / 0.9 / 0.9 | 0.8 / 0.9 / 0.9 | 1.0 |
| `night` | `sleep` (as nocturnal in the day) | activity 1.2, sight 1.0, aggro x`nightAggro` 1.25 | activity 1.0, sight x`nightSightAlways` 0.85, aggro 1.0 |

- *Activity* scales the wander cadence: the idle wait is divided by the activity multiplier (1.2 means ambles come sooner); activity 0 means no ambling at all.
- *Sleep* is `sleep` state at home: the creature stands (Characters may lay it down), `R_commit` and sight are multiplied by `sleepAggro`/`sleepSight`, hearing is unchanged (a sleeper still wakes to a noise: noise sets `suspect` then `idle`, never `hunt` without sight). Waking from `sleep` uses a `wakeTime` of 1.5 s before `suspect` is entered.
- *Spawn mix* is section 4 (a per-entry `phaseWeight`).
- A phase change never removes or teleports a live creature (no popping): only the creature's multipliers change, and the spawn mix applies at the **next** respawn.
- Source: ours. The idea that creature state follows a daily schedule is the Gothic routines model (OpenGothic, MIT; gothic-routines.md section 5.2 to 5.3), simplified to four phases and three activity types for mobs.

### 3.5 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| `walk`, `turn`, `idle`, `arrive`, `clear`, `edge` | 0.9 m/s, 3.2 rad/s, 1.5 to 4.5 s, 0.35 m, 0.7 m, 2 m | as today | ours (existing `TUNING`) |
| `roam` | 6 to 8 m per plan | 2 to 9 (never above `leash / 3`) | ours; world-of-claudecraft ring 2 to 9 (MIT-adapt) |
| `p2`, `p3` | 0.5, 0.5 | 0 to 1 (sum 1) | ours |
| `campRadius` | 3 m | 1.5 to 5 | ours |
| `campGap` | 12 m | 8 to 20 | ours |
| `campRoam` | 5 m | 2 to 7 | ours |
| `followBias` | 0.4 | 0 to 0.8 | ours |
| `focusMin`, `focusMax` | 2.5, 4 m | 1.5 to 6 | ours |
| `focusFacing` | 0.7 | 0 to 1 | ours |
| `dayLengthS` | 1200 s | 600 to 6000 | ours (gothic-routines clock is 5958 s, MIT) |
| phase shares | 6 / 50 / 6 / 38 percent | sum 100 | ours |
| `sleepSight`, `sleepAggro` | 0.4, 0.5 | 0 to 1 | ours |
| `nightAggro` | 1.25 | 1 to 1.6 | ours |
| `nightSightAlways` | 0.85 | 0.6 to 1 | ours |
| `wakeTime` | 1.5 s | 0.5 to 4 | ours |

### 3.6 Data-driven content fields

Per form: `activity`, `roam`, `campSize: [min, max]` (default `[2,3]`), `focus: boolean`. Per spawn plan: `camps: number` or `count`, `campRadius`. Proposed Frontier values (content owner confirms): cinder scavenger `diurnal`, ruin ghoul `nocturnal`, mere brood `always`.

### 3.7 Acceptance tests

1. Wander (today's tests stay green): never leaves its roam disc, never stands in a solid or outside its zone margin, reproducible from seed.
2. Camps: the shipped plan yields 2 + 2 + 1 camps (scavengers: 3 + 3, brood: 2 + 2, ghouls: 3) with the same total counts as today; every member's home is inside the zone, clear of solids, and within `campRadius` of its camp centre; camp centres are at least `campGap` apart; the placement is reproducible from seed.
3. A camp never has more than 3 members.
4. Focus: with a focus prop present, at rest over 200 seeded samples at least `focusFacing - 0.15` of idle members face the prop and stand inside `[focusMin, focusMax]`.
5. Phase table: at `night` a diurnal creature is in `sleep`, its `R_commit` is `base * sleepAggro`, and it does not wander; a nocturnal creature's `R_commit` is `base * nightAggro`; an `always` creature is unchanged in `R_commit`.
6. A noise at a sleeping creature moves it to `suspect` (never straight to `hunt`) after `wakeTime`.
7. A phase change leaves every live creature in place (positions and count unchanged across the boundary).
8. Roam is clamped: any content roam above `leash / 3` is clamped and flagged by a content check.

### 3.8 Preview-only

The clock is a stub: `phase` and `night` derive from preview seconds and `dayLengthS`. The shipped world uses World's clock and the server's time. Camp props (fires) are placeholder discs in the preview until World ships them.

### 3.9 Owner

Expansion (rules, camps, activity). World (the clock, camp fires, props, the night factor). Characters (sleep pose, wake tell).

---

## 4. SPAWNING

### 4.1 Purpose

Keep the Frontier populated without it being farmable at one spot, without spawning in the player's face, and without unbounded creature counts.

### 4.2 Data model

A **spawn group** is the unit EQ calls a spawn group: a weighted list of candidate creatures for a set of **slots**. A **slot** is one standing place (a camp member's home from section 3).

```
SpawnGroup {
  id, zone, landmark,                  // where (today: sp.at)
  slots: number,                       // creatures this group keeps alive (camps x size)
  entries: [{ character, weight, levelMin, levelMax, phaseWeight?, limit?, rare? }],
  respawn: { seconds: 150, variance: 60 },   // window = seconds +- variance/2  (120 to 180 s)
  areaCap?: number, limitGroup?: number,
  noSpawnNear?: number, noSpawnInView?: boolean
}
Slot { index, home, camp, state: 'up' | 'down', creatureId?, downUntil: worldSeconds, spawnSerial }
```

### 4.3 Behaviour: choosing who spawns

When a slot is due (`state = down` and `worldSeconds >= downUntil`, or at region load for a fresh slot):

1. Build the eligible list: entries whose `levelMin..levelMax` contains the group's level band (always true for fixed-level forms), whose per-entry `limit` (max alive of that character across the group) is not reached, and whose time-of-day window passes (`phaseWeight` of the current phase > 0). (EQEmu `zone/spawngroup.cpp`, GPL-behaviour: an entry is skipped when its per-type live limit is reached or the clock is outside its window; a group-wide limit stops the whole group.)
2. If `limitGroup` is set and live creatures from the group have reached it, no spawn (retry, 4.5).
3. Weight each eligible entry `w = weight * phaseWeight[phase]` (default phase weight 1). If the total is zero: no spawn, retry.
4. Draw `r` uniformly in `[0, total)` from the slot's seeded stream; walk the entries in order, subtracting weights, and pick the first whose weight exceeds the remaining `r`. (EQEmu `spawngroup.cpp`, GPL-behaviour: a single roll over the summed chances picks one candidate; a zero total spawns nothing.)
5. Level: forms carry a fixed level; the existing `level + (i % 2)` rule for plain creatures (so a camp is a mixed L11/L12 set) is kept as a deterministic function of `slot.index`.

The seed for a slot's draw is `mixSeed(worldSeed ^ slotIndex, spawnSerial)` where `spawnSerial` counts how many creatures this slot has spawned (so server and client replay the same spawn sequence).

### 4.4 Behaviour: respawn timing

A slot goes `down` when its creature is felled (the kill outcome from the hunt module) and `downUntil = worldSeconds + R` where `R` is drawn uniformly from `[seconds - variance/2, seconds + variance/2]`, floor 1 s. Defaults give 120 to 180 s. (EQEmu `zone/spawn2.cpp`, GPL-behaviour: the delay is the base time with a random swing of half the variance each way, never below a small floor; world-of-claudecraft `respawn_policy.ts`, MIT-adapt: one flat delay for ordinary creatures, defended by checking supply against demand; named or rare creatures get their own multiplier.) Today's 90 s is replaced by this window. An optional `rare` entry uses `respawn.rareMult` (default 3) on its own slot timer.

Why a window not a point: a fixed timer lets a player stand at the camp and farm on a metronome; the swing breaks that rhythm while the mean stays predictable enough for a player to plan.

Supply check (implementer's test, from world-of-claudecraft's argument): a camp of `n` slots at mean respawn `R` supplies `n * 60 / R` kills a minute (scavenger camp, n=3, R=150: 1.2 a minute). A hunter needs about 20 to 40 s per kill including the walk (0.5 to 1.5 kills a minute). Supply meets demand at every authored camp; if a content change breaks that, the slots count rises, not the timer shrinks.

### 4.5 Behaviour: when a spawn is refused

A due slot may be refused; it then retries after `retry` seconds (EQEmu retries in 5 s, GPL-behaviour). It is refused when any holds:

| Check | Rule | Default |
|---|---|---|
| No spawn near the hero | the slot's home is within `noSpawnNear` of the hero | 25 m |
| No spawn in view | the home is within `viewRange` of the hero **and** inside the camera's visible frustum (the caller passes `inView(x,z)`), so a creature never pops into sight | on, `viewRange` 45 m |
| Area cap | live creatures in the **zone** (all groups) are at the cap | `areaCap` |
| Region cap | live creatures in the region are at the cap | `regionCap` |
| Group limit | `limitGroup` reached (4.3) | none |
| No eligible entry | total weight is zero (4.3) | none |
| Fight noise | a duel is running within `noiseHold` of the slot (do not refill a camp under a fight) | 12 m |

The area cap counts **live** creatures only (felled and `down` creatures do not count; joiners from fight noise are already live creatures, so a pull cannot cause a spawn that goes over the cap). Default `areaCap` = the zone's planned population + 0 (never above plan: a respawn refills, never grows). `regionCap` default 40.

### 4.6 Behaviour: initial population and persistence

- At region load, each slot starts `up` and spawns its first creature through 4.3 with the usual refusals relaxed (no hero near at load).
- A slot's `downUntil` is world state (shared): any player's kill puts the slot down for everybody. In the preview it is page memory; in the shipped world it is server state saved with the shard and reloaded after a restart (a restart refreshes all `down` slots whose `downUntil` has passed and keeps the rest).
- A creature is **never** despawned because the hero walked away (the render cull is separate and only affects drawing); it is removed only by death, by a content reload, or by region unload.

### 4.7 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| `respawn.seconds` | 150 s | 120 to 180 (2 to 3 minutes, Dom) | ours; EQEmu timer and variance (GPL, behaviour); world-of-claudecraft flat 60 s (MIT) rejected as too fast for this slice |
| `respawn.variance` | 60 s | 0 to 120 | EQEmu behaviour |
| `respawn.rareMult` | 3 | 1 to 6 | world-of-claudecraft per-template respawn multiplier (MIT-adapt idea) |
| `retry` | 5 s | 2 to 15 | EQEmu behaviour |
| `noSpawnNear` | 25 m | 15 to 40 | ours |
| `viewRange` | 45 m | 25 to 60 (never below `noSpawnNear`) | ours (= `TUNING.range`) |
| `areaCap` | zone plan | 1 to plan | ours |
| `regionCap` | 40 | 10 to 80 | ours |
| `noiseHold` | 12 m | 6 to 20 | ours |
| `limitGroup` | none | 1 to slots | EQEmu behaviour |
| `limit` per entry | none | 1 to slots | EQEmu behaviour |
| `phaseWeight` | 1 each phase | 0 to 5 | EQEmu window idea (GPL, behaviour), ours: weights not hard windows |

### 4.8 Data-driven content fields

`spawnGroups` per region (a new content kind in the bundle, schema owned by Expansion with the contracts lane): id, zone, landmark, slots, entries with `weight`, optional `levelMin/levelMax`, `phaseWeight` (four numbers), `limit`, `rare`, plus the group-level `respawn`, `areaCap`, `limitGroup`. Named creatures are **not** in a weighted group: they stay on the encounter's own `restartSeconds`.

Proposed example for the ash pits (content owner decides; it keeps today's single-species look while allowing a mix):

| Entry | weight | night weight | note |
|---|---|---|---|
| `character:cinder-scavenger` | 80 | 40 | diurnal |
| `character:ruin-ghoul` | 15 | 55 | nocturnal; drifts in at night |
| `character:mere-brood` | 5 | 5 | rare mix-in, `limit` 1 |

### 4.9 Acceptance tests

1. A slot downed at time T respawns no earlier than `T + 120` and no later than `T + 180` (with defaults); across 1000 seeded draws the mean is within 3 s of 150 and the range matches.
2. Refusal: with the hero 24 m from a due slot it does not spawn; at 26 m it does (given not in view); the retry fires every `retry` seconds until clear.
3. In view: a due slot at 40 m inside the frustum is refused; the same slot behind the hero (outside the frustum) spawns.
4. Area cap: with the zone at cap no slot in the zone spawns; killing one creature lets exactly one due slot spawn.
5. Weighted pick: over 10,000 seeded draws each entry's share is within 2 percentage points of `weight / total` (day), and the night weights shift the share (ghoul 15 to 55 over the same totals).
6. Per-entry `limit`: with limit 1 on brood, no draw ever yields two alive.
7. A creature at its slot's home is never removed because the hero moved away (move the hero 200 m and back; same creature, same position).
8. Phase change does not remove a live creature; the mix changes only on the next respawn.
9. A fresh region load fills every slot exactly once, deterministically per seed, with counts equal to the plan.
10. Determinism: server and client replaying the same kill times and seeds agree on every spawn's character and time.
11. A fight within `noiseHold` of a due slot defers that slot.

### 4.10 Preview-only

Spawn state is page memory and the clock is local. The shipped version moves the slot table to the server and persists it with the shard.

### 4.11 Owner

Expansion (module, content schema, tests). World (camp positions, `inView` frustum helper). Duels and Backend (the server persistence of `downUntil`, later).

---

## 5. FIGHT

### 5.1 Purpose

Tapping a creature starts Combat's duel; the creature's **kind** decides how it approaches, which of our existing opponent knobs it leans on, and whether it runs when hurt. This section gives the table shape; Combat fills the numbers on the battery. No new move and no new rule in `src/`.

### 5.2 Behaviour: the flow

1. The tap target must be in `suspect`, `hunt`, `ring`, `search`, `idle`, `wander` or `sleep` (not `return`, `flee`, `down`).
2. The hunt module calls `fightSetup(fightId, content)` (existing), builds the seed with `fightSeed` (existing) and starts Combat's `startEncounterDuel` with the setup plus the creature's **style row** (below).
3. On duel end, `resolveFight` (existing) settles kill/forfeit/retry; on a kill, loot (section 6) rolls and the Bounty pays when open; the slot goes `down` (section 4). The creature is owned by the duel (`engaged`) from the call to the end; its world state is frozen.
4. Fight noise (2.5) is posted while the duel runs.

### 5.3 Behaviour: the four kinds

**Authority (Strategy ruling 2026-10-07, 12:23).** The roles are `brute`, `skirmisher`, `caster`, `beast` (the earlier "archer" was renamed). Combat's `origins/mobs/styles.ts` (PR #1646, `origin/combat/mob-styles`; our code) is the single definition: `MOB_STYLES`, `MOB_STYLE[id]` (the roster `opponent` the duel uses, plus optional `fleeBelow`), `styleOpponent(id)` (the opponent, or `undefined` for an unknown id) and `fleesNow(style, health, maxHealth)` (true strictly below the threshold; beasts flee below 30 percent, every other style never). This spec **does not define a role, an opponent mapping or a flee threshold**; a mob row names a style id and reads these. Today the file maps brute to `pitborn`, skirmisher to `nightborn`, caster to `witch`, beast to `goblin`.

**Skirmisher is a name, not a ranged system.** It is the Nightborn's poke-and-withdraw at the estoc's reach. Ranged stays out of the duel (combat-study). A "volley while you approach" behaviour (a skirmisher shooting as the hero closes) is **parked**, a post-sprint world-layer idea; nothing in this spec builds it, and the in-world approach set below only gives a skirmisher a longer stand-off and a back-off, never a projectile.

The table below is only the **world approach and flavour** each style leans on; the duel behaviour is whatever `styleOpponent` points at.

UO-style roles (ModernUO `Mobiles/AI/*`, GPL-behaviour-only, behaviour in our words) mapped onto what our duel can express today. The "move" and "knob" columns name **existing** `MoveId` values and `AiProfile` fields from `src/moves.ts` (ours); Combat decides the values.

| Kind | World approach (in-world, before and after the duel) | Opening | Leans on (existing `AiProfile` knobs) | Leans on (existing moves) | Flees at low health | Source |
|---|---|---|---|---|---|---|
| `brute` | advances steadily, never circles, never backs off; fights to the end | charged heavy (combat-study "Brute" role) | high `pressure` toward heavy, low `dodge`, high `braceHeavy`/`guard`, slow `reaction` | `heavy_overhead`, `heavy_riposte`, `heavy_counter`, `kick` | no (`fleesNow` is never true for `brute`) | ModernUO melee role (a plain melee fighter flees only rarely and late): GPL, behaviour; combat-study 2E |
| `skirmisher` | keeps a stand-off distance `standOff`, backs away when closed, regains line of sight if blocked, leaves the fight when out of "ammo" | none in v1 (poke and withdraw at the estoc's reach; no projectile) | high `disengage`, high `step`, `circle`, low `guard`, high `dash` to close gaps | `thrust`, `light_left`, `light_right`, `riposte` | no | ModernUO ranged role (its `ArcherAI.cs`; GPL, behaviour), kept as a role name only |
| `caster` | keeps range and line of sight, closes to regain line of sight when blocked, acts on a cooldown | a telegraphed marker (same marker) or a `skill_*` opener | high `accuracy`, `discipline`, low `aggression` between casts, `disengage` | `skill_witchfire` and the other `skill_*` as Combat assigns | no by default; content may set | ModernUO mage role (GPL, behaviour) |
| `beast` | skittish: while not committed it backs off from a nearby hero with `backoffChance`; once committed it closes fast; fights hard but runs when badly hurt | a lunge | high `aggression`, `dash`, `circle`, `disengage`, low `guard` | `light_right`, `light_left`, `thrust`, `skill_lunge` | **yes** (`fleesNow`, below 30 percent) | ModernUO animal role (GPL, behaviour); world-of-claudecraft flee rules (MIT-adapt) |

Current roster mapping (proposal; the id is the row's `role`, section 7): cinder scavengers `brute` or `beast` (content decides per form), mere brood `beast`, ruin ghouls `brute`. Named creatures and bosses use their encounter's own opponent profile and never use `fleesNow` unless the twist says `flee-at`.

### 5.4 Behaviour: action rows (the style row's move table shape)

A style row may carry an ordered list of **action rows** so a role is data, not code. (SCAR `docs/EN/Developers Manual For SCAR 2.0+.md`, MIT-adapt: each row has a distance band, an angle arc, a chance, a cooldown, a priority and a chance to chain to a next row; rows are tried in descending priority and the first that passes every test is used.)

```
ActionRow {
  move: MoveId,            // an existing move
  priority: number,        // higher is tried first
  distMin: number, distMax: number,    // metres, duel range band (Combat converts to its units)
  arcFrom: number, arcTo: number,      // degrees, where the target must be relative to facing (-180..180)
  chance: number,          // 0..1
  cooldown: number,        // seconds before this row can fire again
  chain: number            // 0..1 chance a follow-up row is considered after this one lands (1 = always)
}
```

Combat chooses whether the duel AI consumes rows directly or the rows only seed the `AiProfile`; the contract is only that **the rows are data** and a missing table means "the profile as it always was". Defaults for a `brute` (shape example only; Combat owns the numbers): row 1 `heavy_overhead`, priority 2, band 0 to reach, chance 0.3, cooldown 2.25; row 2 `light_right`, priority 1, chance 1.0.

### 5.5 Behaviour: in-world approach set (the waiting ring and the walk-in)

The in-world movement before a duel and for `ring` joiners uses a small parameter set (CombatPathingRevolution `doc/en/Developers Guidelines of CPR.md`, MIT-adapt: per-creature advance radii that blend by how aggressive the creature feels, a back-off when too close, a circling arc inside a distance band, and a fall-back distance with a wait). Numbers ours.

| Parameter | Meaning | Default brute | beast | skirmisher | caster |
|---|---|---|---|---|---|
| `innerRadius` (min, mid, max) | distance it tries to hold when attacking, from eager to cautious | 1.6, 1.9, 3.0 | 1.4, 1.7, 3.5 | 6, 8, 10 | 8, 10, 12 |
| `outerRadius` (min, mid, max) | beyond this it runs at the target instead of walking | 4, 6, 9 | 5, 8, 12 | 12, 14, 16 | 12, 14, 16 |
| `backoffChance` | chance to step back when closer than `innerRadius * backoffMult` | 0.0 | 0.5 | 0.9 | 0.9 |
| `backoffMult` | | 0.85 | 0.85 | 0.9 | 0.9 |
| `circleDistMin..Max` | band where it may circle | none | 2 to 6 | 4 to 9 | 6 to 11 |
| `circleAngleMin..Max` | arc per circling move, degrees | none | 25 to 60 | 20 to 45 | 15 to 35 |
| `fallbackDist` | retreat length after a trade | 0 | 3 | 5 | 4 |
| `fallbackWait` | pause after it | 0 | 0.8 s | 1.2 s | 1.0 s |

The radii blend by an `offence` ratio in `[0,1]` (1 = eager): `inner = lerp(min, mid, 1 - offence)` when attacking and `lerp(mid, max, defence)` when cautious (CPR formula in our words). `offence` is `1 - healthFraction * 0.5` by default, so a hurt creature turns cautious.

### 5.6 Behaviour: animals flee at low health

Fleeing reuses the existing `flee-at` twist (`origins/encounters/encounters.ts`: `{ percent, catchSeconds? }`) so no new outcome type exists and `resolveFight`'s rules hold (a flee with no catch window ends `fled`: no kill, no pay; a flee with a catch window ends `caught` or `escaped`).

| Rule | Behaviour | Source |
|---|---|---|
| Eligibility | a creature may flee only if `fleesNow(style, health, maxHealth)` can be true for its style (today only `beast`), it is not named, elite or a boss, it has not fled in this pull, and it is not enraged (no such state in v1: ignore) | world-of-claudecraft `mob/flee_rules.ts` (MIT-adapt: only cowardly families flee; elites, rares and bosses never flee; at most once per pull) |
| Trigger | `fleesNow(style, health, maxHealth)` turns true (beast: strictly below 30 percent; Combat's number, `MOB_STYLE.beast.fleeBelow`, equal to the `flee-at` twist's default percent). This spec adds no threshold of its own | `origins/mobs/styles.ts` (ours); for comparison world-of-claudecraft uses 20 percent (MIT) and ModernUO animals 10 percent (GPL, behaviour) |
| Chance | none: `fleesNow` is deterministic, so a beast under the threshold always leaves (testable without a seed) | `origins/mobs/styles.ts` (ours) |
| Outcome | the duel ends with the existing `fled` result (a flee with no catch window: no kill, no loot, no Bounty). The creature runs for `fleeTime` and then `return`s. A kill is only a kill if the player finishes it before `fleesNow` turns true | existing `resolveFight`; ours |
| Wounded window | the creature remembers its health fraction for `woundWindow` seconds; a re-tap inside the window starts the next duel with that fraction (a `foeHealthFrac` option on `fightSetup`, Combat adds it); it then cannot flee again this pull | ours; world-of-claudecraft flees at most once per pull (MIT-adapt) |
| Speed | `fleeSpeed = min(fleeMult * walk, fleeCap * heroSpeed)`: slower than the hero so a chase can catch it | world-of-claudecraft flee speed 1.4 times walk, capped at 0.65 of run (MIT-adapt) |
| Rally | if a fleeing creature comes within `rallyRadius` of an idle camp-mate, the flee ends: the mate goes `suspect` toward the hero (no chain: one cluster only) | world-of-claudecraft `mob/social_aggro.ts` rally (MIT-adapt: ending the flee on first contact stops a fleer chaining the whole camp) |
| Reaching the leash | the flee ends at the leash edge and the creature returns | world-of-claudecraft (MIT-adapt) |

Bounties keep their own `flee-at` twists (Peg Powler flees at 30 percent with a 15 s catch window); the animal rule is the same mechanism with different content.

### 5.7 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| flee threshold | `MOB_STYLE[style].fleeBelow` (beast 0.3) | Combat's | `origins/mobs/styles.ts` (ours) |
| `fleeTime` | 8 s | 4 to 15 | world-of-claudecraft 5 s (MIT), ModernUO 10 to 30 s (GPL, behaviour): ours between |
| `woundWindow` | 30 s | 10 to 90 | ours |
| `fleeMult`, `fleeCap` | 1.4, 0.85 | 1 to 2, 0.5 to 0.95 | world-of-claudecraft 1.4 and 0.65 (MIT-adapt) |
| `rallyRadius` | 5 m | 3 to 8 | world-of-claudecraft (MIT-adapt) |
| `standOff` (skirmisher) | 8 m | 5 to 14 | ours |
| `chaseLeash` | `leash` | | ModernUO: chase leash is twice perception (GPL, behaviour); ours uses section 2's `leash` |
| ring radius for joiners | 4 to 6 m | | combat-study 2A (ours) |

### 5.8 Data-driven content fields

Per creature form: `role` (a `MobStyle` id; see section 7), `style` (the approach set and optional `rows`), `standOff`. Flee is not a field: it comes from `fleesNow`. Combat's `opponent` profile reference stays as the form's existing `opponent` field (the roster body). A new content kind `creature-style` holds the rows by kind so many forms share one.

### 5.9 Acceptance tests

1. Tapping a creature in each allowed state starts exactly one duel with the right `fightId`; tapping `return`, `flee` or `down` starts none.
2. The style row for the creature's kind is passed to `startEncounterDuel`; a missing style leaves behaviour unchanged (bit for bit with today's tap flow).
3. A `beast` whose health falls strictly below 30 percent (`fleesNow` true) ends the duel `fled`: no loot, no Bounty, no kill count; at exactly 30 percent it still fights; `brute`, `skirmisher` and `caster` never flee by this rule.
4. A named creature, an elite and a boss never flee unless the form has an explicit `flee-at` twist.
5. A re-tap inside `woundWindow` starts the next duel with the saved fraction; outside the window health is full.
6. A fleeing creature at `fleeSpeed` is slower than the hero; a hero chasing reaches it; at the leash edge it returns.
7. Rally: a fleeing creature within `rallyRadius` of an idle camp-mate ends its flee and the mate enters `suspect`; no third creature is pulled.
8. Approach set: the radii blend between min, mid and max as `offence` goes 1 to 0; `backoffChance` 0 never backs off; a skirmisher closer than `standOff * backoffMult` steps back in at least `backoffChance` of 1000 seeded trials within 5 points.
9. Action rows: rows are tried in descending priority, the first passing every test is used, a row on cooldown is skipped, and `chain` 0 never chains and 1 always does (over 1000 seeded trials within 3 points for 0.5).
10. No `src/` file changes; `RECORD_VERSION` and the rng fingerprint are untouched (the duel's own tests stay green).

### 5.10 Preview-only

The preview has no skirmisher or caster fights (combat-study: ranged is out of the duel for now); `skirmisher` and `caster` rows exist in content and the approach set; neither shoots (the volley idea is parked). `engage` stays `tap`. Wounded-window state is page memory.

### 5.11 Owner

Expansion owns the rows, the approach set, the flee state machine and the tests. Combat owns the opponent profile numbers, the `startEncounterDuel` call and the `foeHealthFrac` option on `fightSetup`, and decides whether the duel consumes `rows` directly.

---

## 6. LOOT

### 6.1 Purpose

Make drops feel earned and varied without a second system: weighted drop tables with groups, probabilities and level gates, feeding the **existing** `rollLoot`, `intoBackpack` and the Bounty. `eqemu-loot.md` already specifies the table model; this section only adds what a creature population needs on top of it.

### 6.2 What already exists (do not rebuild)

`rollLoot(tableId, seed, content, { foeLevel })` rolls a `LootTable` (`currency`, `rolls[]` each `independent` or `weighted`, with `probability`, `repeat`, `dropLimit`, `minDrop`, entries `{ item, chance, quantity, levelMin, levelMax }`); `intoBackpack` mints `loot` items and hands them to the inventory; `resolveFight` names the table; a Bounty pays metal only and never rolls a table; a world boss rolls its table on the first win only; `eqemu-loot.md` is the behaviour reference (EQEmu, GPL-behaviour). The Region 1 tables in `region1-ash-frontier.md` section 5 stand.

### 6.3 Behaviour added by this spec

**(a) The con gate (grey drops nothing).** Before any roll, compute the kill's con band against the hero. A **grey** kill rolls no table at all and pays no metal: the same rule that pays 0 CP (`isGrey`). Elsewhere the band scales **nothing** (no hidden multiplier): it only gates. Optional per-roll `minBand` (content, default `grey+1` = anything above grey) lets a roll be reserved for tougher kills (e.g. a gear roll with `minBand: 'blue'`). (EQEmu `zone/loot.cpp` trivial-loot filter, GPL-behaviour: an item carries a killer-level band outside which it is removed at death; coin is unaffected. Ours expresses the band as con, not raw levels, and also zeroes coin for grey because our metal is the one bound balance and grey pays no CP.)

**(b) Per-kind tables and DFU-style authoring shortcut.** A creature form names its table (`loot: 'loottable:cinder-scavenger'`, as today). For authoring many plain creatures, a **category matrix** row may compile to a `LootTable` at load: a coin range plus a percent chance per category (`gear`, `material`, `consumable`, `curio`), each category pointing at a shared weighted pool. (daggerfall-unity `Items/LootTables.cs`, MIT-adapt: a loot key per creature class carries a gold range and a chance per item category.) The compiled result is an ordinary `LootTable`; `rollLoot` does not know the difference.

**(c) Global pools.** A `global-loot` content row attaches an extra table to every creature that passes filters, rolled **after** the creature's own table, adding items only (never coin). Filters: `levelMin`, `levelMax`, `kind`, `character` list, `rare`, `zone`; a form may set `skipGlobal: true`. Within one filter type the listed values are OR'd; different types AND. (EQEmu `eqemu-loot.md` 5.5, GPL-behaviour.) Default shipped rows: none (the Frontier ships no global pool); the schema exists so a "materials" pool can be added without touching each table.

**(d) Level gates stay on the entry.** Gear entries keep `levelMin: 11` as in Region 1. The `foeLevel` passed to `rollLoot` is the creature's actual level (so the camp's L11/L12 mix gates correctly). The tier gear is won at is `REGION1_LOOT_TIER` (existing).

**(e) Roll timing and seed.** Loot rolls **at the kill**, not at spawn (EQ rolls at spawn; ours keeps the existing seeded-at-kill model so a replayed settlement rolls the same). Seed `fightSeed(setup.seedKey, character, attempt)` as today; the kill id for the mint key is `loot:<killId>:<n>` as today so a retried settlement cannot mint twice.

**(f) Anti-farm.** The camp respawn window (section 4) and the progression model's repeat heat (`FREE_REPEATS`, `HEAT_UNIT_S`) already bound farming; this spec adds no loot-side decay. A repeat world-boss kill rolls no table (existing rule).

**(g) Bounty coupling.** Unchanged: a Bounty win pays its metal through `resolveFight`; a Bounty encounter's boss table is `never` rolled; a plain creature killed while a Bounty is open still rolls its own table. A **fled** or forfeited fight rolls nothing and pays nothing (section 5).

**(h) Pack full.** `intoBackpack` refusals are shown as today ("a refused loot says so honestly"); a refused drop is not lost silently: the player is told, and the kill still counts.

### 6.4 Parameters

| Name | Default | Range | Source |
|---|---|---|---|
| grey rule | rolls nothing, pays no metal | fixed | ours; EQEmu behaviour |
| `minBand` per roll | above grey | any band | ours |
| `repeat` / `probability` / `dropLimit` / `minDrop` | as in the table | as the contracts allow | existing `LootTable` |
| global pool order | after the creature's own table | fixed | EQEmu behaviour |
| global pool coin | never | fixed | EQEmu behaviour |
| category percent per kind | content | 0 to 100 | daggerfall-unity shape (MIT-adapt), numbers ours |

### 6.5 Data-driven content fields

On `loot-table`: optional `minBand` per roll. On the creature form: `loot`, `skipGlobal`. New kinds (each a plain content row with a schema in the contracts): `loot-matrix` (a compact authoring row that compiles to `loot-table`) and `global-loot`. Region 1 data is unchanged; nothing in the shipped tables moves.

### 6.6 Acceptance tests

1. Grey kill: the hunt module calls no `rollLoot` and credits no metal for a grey creature; a white kill rolls as before (existing `hunt.test.ts` stays green).
2. `minBand`: a roll with `minBand: 'blue'` produces drops only when the kill's band is blue or higher, over 1000 seeded kills at each band.
3. Matrix compile: a matrix row with category percents compiles to a `LootTable` that `rollLoot` accepts, and the compiled table's expected drop rate per category equals the authored percent within the seeded-trial tolerance.
4. Global pool: a creature passing the filters gets its own table's items plus the pool's, in that order, with the same seed; coin comes only from the creature's own table; `skipGlobal` suppresses the pool; a creature failing any filter type gets none (OR within a type, AND across types).
5. Level gate: a gear entry with `levelMin: 12` never drops from an L11 creature and can from an L12 one (the camp's mixed levels).
6. Determinism and mint safety: the same table, seed and `foeLevel` give the same drops; settling the same kill twice mints each `loot:<killId>:<n>` once.
7. A fled or forfeited fight rolls nothing and credits nothing; a Bounty win credits its metal exactly as before and a Bounty encounter's boss table is still never rolled.
8. A full pack reports the refusal and keeps the kill count.

### 6.7 Preview-only

The pack, the metal and the counts are the page's memory (today's `hunt.ts`); the shipped path writes through the server's inventory and kill verification. The matrix and global rows are schema-only until content uses them.

### 6.8 Owner

Expansion (con gate, matrix compiler, global pools, tests). Economy/Backend later for server minting. Content owner for the table numbers.

---

## 7. Mob row format (one row per creature kind; the generator's input)

### 7.1 Purpose

One content row says everything about a kind of creature, so a human or `generateZone` can add a kind without touching code, and a bad row is rejected before it ships. The row **references** existing formats and never forks them: the style is a `MobStyle` id from `origins/mobs/styles.ts` (section 5), the look is the **`MobLook` shape** from `origins/preview/mob-looks.ts` (#1643), the loot is a `loot-table` id (section 6), the world fit is the zone `Params` from `origins/world/schema.ts`.

### 7.2 The row

```
MobRow {
  id: string,                    // 'character:cinder-scavenger' (a character id; the key into the look table)
  name: string,
  source: Source,                // myth source (7.4); required
  role: MobStyle,                // 'brute' | 'skirmisher' | 'caster' | 'beast' (origins/mobs/styles.ts)
  family: string,                // the roster body = MobLook.opponent ('goblin', 'pitborn', ...)
  look: MobLook,                 // EXACTLY the MobLook type: { opponent, tint, scale, gear?, dressing:{soot,burnt}, later? }
  behaviour: {                   // every field optional; defaults are section 2 and 3's
    aggro?: number,              // R_commit base, metres        (2.8, default 7; 9 named)
    viewHalf?: number,           // sight cone half-angle, deg    (default 100; 180 = all round)
    hearRadius?: number,         // metres                        (default 4.5)
    leash?: number,              // metres                        (default 26)
    roam?: number,               // home radius, metres           (default 6; never above leash / 3)
    campSize?: [number, number], // 1..3                          (default [2,3])
    activity?: 'diurnal' | 'nocturnal' | 'always',
    engage?: 'tap' | 'contact'
  },
  loot: string,                  // a loot-table id ('loottable:cinder-scavenger')
  level: [number, number],       // level band this kind may spawn at
  habitat?: string[],            // terrain.biome keys it fits (empty = anywhere)
  weight?: number,               // default spawn weight in a group (section 4), default 10
  named?: boolean                // named creatures are not generated (7.6)
}
```

**One look format, one table.** `row.look` is a `MobLook`; the shipped table `MOB_LOOKS` (keyed by character id) is the **compiled form** of every row's `look`, not a second hand-kept list. Today's hand entries become the first rows; a generated row adds its `MobLook` to the same record under its own id. The only permitted extensions to `MobLook` are additive and optional (owner: Characters): `tintRange?: [number, number]` (two colours the generator may pick between) and `scaleRange?: [number, number]` (so one kind can vary a little per creature). Existing fields keep their meaning (`tint` multiplies cloth only, metal keeps its grade; `scale` is on top of the roster body's own; `gear` is a roster weapon id; `dressing.soot` and `.burnt` are 0 to 1; `later: true` is "kept in the table, not drawn this sprint").

### 7.3 Rows from today's data (examples only; the row set is the content owner's)

| id | role | family | level | source (to be cited) |
|---|---|---|---|---|
| `character:cinder-scavenger` | `beast` or `brute` | `goblin` | 11 to 12 | citation required |
| `character:mere-brood` | `beast` | `goblin` | 12 | citation required |
| `character:ruin-ghoul` | `brute` | `goblin` | 11 | citation required |

The three above already exist in `MOB_LOOKS` and keep that data unchanged.

### 7.4 Source rule (legends-rule)

`source` is a structured citation, required on every non-`later` row:

```
Source { kind: 'myth' | 'folklore' | 'history' | 'literature' | 'chronicle',
         work: string, author?: string, year?: number, authorDied?: number, locator?: string, legendId?: string }
```

`legendId` may point at a row of `legends-500.csv` instead of repeating the citation. If neither a complete `Source` nor a `legendId` is present the row reads **"source citation required"** and is rejected. What a machine can check (the legends-rule skill, `.claude/skills/legends-rule/SKILL.md`, is the authority and a human reviews every new row): `kind` is one of the five allowed; a `literature` source has `year <= 1928` or `authorDied <= 1955` (published before 1929, or author dead 70 or more years, as the rule states); a `scripture` flag, or a `work` on the rule's blocked list (the scriptures of living religions), rejects. It does **not** judge whether a figure is a living people's folk hero; that stays a human call under the rule's process (hold the name out and send Lead the name, source and proposed swap).

### 7.5 Validator: rules that reject a bad row

`validateMobRow(row, ctx): Issues` returns issues in the same `Issues` form the contracts use (code, path, message), never throws. `ctx` carries the look table, the loot registry and, for zone checks, the zone `Params`.

| Code | Rejects when | Notes |
|---|---|---|
| `no-source` | `source` missing or incomplete and no `legendId`; or fails the 7.4 machine checks | message: "source citation required" |
| `bad-role` | `styleOpponent(row.role)` is `undefined` (role is not in `MOB_STYLE`) | uses Combat's function, not a copy of the list |
| `family-no-look` | `row.family` has no roster body, or `row.look.opponent !== row.family`, or the row has no `look` and `mobLook(row.id)` is null (a `later: true` row is exempt) | a body family needs a look so two figures on one body stay readable |
| `level-band` | `level[0] > level[1]`, or the band does not intersect the zone's `difficulty.levelMin..levelMax` | when a zone is supplied; for a generator a non-intersecting row is simply not eligible there, but a **fixed** spawn that names it is an error |
| `tint-contrast` | the look's tint, as it reads against the zone's ground colour, has a contrast ratio below `minContrast` by day or by night | 7.5.1 |
| `loot-unknown` | `row.loot` is not a registered loot table | |
| `loot-tier` | the loot table's tier (`tierOfLootTier`) is above the zone's `difficulty.lootTier` | a creature may not out-drop its zone |
| `roam-leash` | `behaviour.roam > behaviour.leash / 3` (defaults applied) | sections 2.7 and 3.2 |
| `camp-size` | `campSize` outside 1 to 3, or min above max | section 3.3 |
| `behaviour-range` | any behaviour field outside its section's stated range | ranges are in sections 2 and 3 |
| `habitat-unknown` | a `habitat` key is not a known biome | schema `terrain.biome` is a `key` |
| `dup-id` | two rows share an `id` | |
| `named-generated` | a `named` row is offered to the generator | named creatures stay on their encounter (7.6) |

**7.5.1 Tint contrast.** Take the row's `look.tint` as the cloth colour as it will read (`tint` multiplies cloth toward the colour; use it unmixed as the worst case for the cloth; metal keeps its grade and is not a tint concern). Take the ground colour from the zone's `terrain.ground` key through World's ground palette (World owns `GROUND_COLOUR[key]`; a key with no entry is itself a `ground-unknown` issue). Compute the relative luminance of each (the standard sRGB luminance) and the contrast ratio `(Lhigh + 0.05) / (Llow + 0.05)`. The check passes only if the ratio is at least `minContrast` against the ground at full daylight **and** against the ground scaled by `nightDim` (the dark end of the zone's ambience). Defaults, ours: `minContrast = 1.6` (reject; warn between 1.6 and 2.0); `nightDim = 0.35`. A `scale` below 0.8 raises `minContrast` by 0.2 (a small figure needs more to read at 375 wide).

### 7.6 How a generator plugs into `generateZone`

`generateZone(template, seed, overrides)` (in `origins/world/generate.ts`) returns a validated zone `Params`; it varies numeric fields inside the ranges a template declares (`vary: { 'group.field': [lo, hi] }`) and never touches creatures itself. Mobs hang off four groups already in the schema: `density.creatures` (hostiles per 100 m² of real ground, 0 to 10, default 0.2), `spawns` (`respawnSeconds`, `boss`), `difficulty` (`levelMin`, `levelMax`, `lootTier`) and `terrain` (`biome`, `ground`, and `safe`). The population step runs **after** `generateZone` as a separate pure function:

```
populateZone(params: Params, rows: MobRow[], seed: number): Result<{ groups: SpawnGroup[]; looks: Record<string, MobLook> }>
```

1. **Budget.** `target = round(params.density.creatures * realGroundArea / 100)`, where `realGroundArea` is the zone's walkable footprint (the area the density field is defined over); at least 1 unless the zone is `safe` (`safe` zones get 0: no hostile spawns, as the schema says). Clamp to `regionCap` and the zone `areaCap` (section 4).
2. **Eligible rows.** Rows that are not `named`, not `later`, pass `validateMobRow` against **this** `params` (so `level-band`, `tint-contrast` and `loot-tier` use the zone's real `difficulty`, `terrain.ground` and `lootTier`), and whose `habitat` contains `params.terrain.biome` (or is empty). No eligible row is an error issue, not a silent empty zone.
3. **Mix.** Entry weights come from `row.weight` and the phase table (section 4.8 `phaseWeight`); the seeded draw is section 4.3's.
4. **Camps.** `target` is met by whole camps drawn from each chosen row's `campSize`, positioned by section 3.3 near the zone's landmarks (its `layout`), never within `campGap` of one another, always on `mobStand` ground.
5. **Respawn.** `params.spawns.respawnSeconds` is the group's `respawn.seconds` (templates should `vary` it inside 120 to 180 for the 2 to 3 minute rule). The schema has no variance field, so section 4's `respawn.variance` takes its default (60 s) until Architecture adds `spawns.respawnVariance` (a proposed schema addition: numeric, seconds, default 60).
6. **Bosses.** `params.spawns.boss` (an anchor landmark, default none) places one **named** creature outside the weighted groups, from the encounter data; it is not generated from rows.
7. **Loot.** Each chosen row's `loot` is used if it passes `loot-tier`; otherwise the generator substitutes the region's default table for `params.difficulty.lootTier` (a content table keyed by tier). The substitution is reported in the result, never silent.
8. **Looks.** `looks` is the compiled `MobLook` record for the chosen rows (with `tintRange` and `scaleRange` resolved per creature by the seeded stream); it merges into the one look table.
9. **Determinism.** The stream is `mixSeed(seed, 0x6d6f6273)` ("mobs"); the same template, seed, overrides and row set give the same groups and looks, byte for byte, the promise `generateZone` makes. Every generated group set passes the same validators before it is returned.

Template example (shape only): `base` fixes `terrain.biome` and `ground`; `vary` has `density.creatures: [0.15, 0.4]`, `spawns.respawnSeconds: [120, 180]`, `difficulty.levelMin: [11, 12]`, `difficulty.levelMax: [12, 14]`; `overrides` pins `difficulty.lootTier`.

### 7.7 Acceptance tests

1. A valid row for each of the three shipped kinds passes `validateMobRow` with zero issues.
2. Each rule in 7.5 has a failing row that yields exactly its code (no source; role `archer`; family with no look; level band outside the zone's `difficulty`; tint equal to the ground colour; unknown loot table; loot tier above `lootTier`; roam above leash over 3; camp size 4; duplicate id; named offered to the generator).
3. `bad-role` uses `styleOpponent`: adding a fifth id to `MOB_STYLE` makes it valid with no change in this spec's code; the old name `archer` is rejected.
4. Contrast: tint equal to ground fails; a tint that clears 1.6 by day but not against the night-dimmed ground fails; a scale of 0.75 needs 1.8.
5. Source: a `literature` source with `year: 1930` and `authorDied: 1990` is rejected; `year: 1897` passes; a scripture flag rejects; a `legendId` present in `legends-500.csv` passes without a `work`.
6. `look` is a `MobLook`: an unknown extra look field is rejected by the type check; `tintRange` and `scaleRange` are the only extras, and a row without them behaves exactly as today.
7. `populateZone`: on a generated zone the creature count is within one camp of `density.creatures * area / 100`; every creature is on `mobStand` ground; every row used passes validation against that zone; identical inputs give identical output; a `safe` zone gets none; a zone whose biome matches no row returns an error issue.
8. Generator plug: `populateZone(generateZone(t, s, o).value, rows, s)` over 100 seeds never throws; every seed returns groups that validate or a named issue.
9. The compiled look table equals `MOB_LOOKS` for today's three rows (no drift from the hand table).

### 7.8 Preview-only

The shipped `?region=1` data is hand-authored; rows are compiled from it at load and `populateZone` is not called there. Contrast is checked against a stub ground palette until World ships `GROUND_COLOUR`.

### 7.9 Owner

Expansion: `MobRow`, `validateMobRow`, `populateZone`, tests. Characters: the `MobLook` extensions, tint and look review. World: `GROUND_COLOUR`, the dark end of ambience. Combat: `MOB_STYLE`. Content and Strategy: sources (legends-rule review). Architecture: the optional `spawns.respawnVariance` field.

---

## 8. Build order and dependencies

| Order | Section | Needs | Unblocks |
|---|---|---|---|
| 1 | Readability | `falloffPermille` (exists) | every later section reads the con band |
| 2 | Noticing | 1 (grey rule) | 3 (camp pull), 5 (ring joiners) |
| 3 | Idle | 2 (state vocabulary), World clock stub | 4 (phase weights) |
| 4 | Spawning | 3 (camps are slots) | 6 (kills reach loot with fresh creatures) |
| 5 | Fight | 2 (tap states), Combat's `startEncounterDuel` and a `foeHealthFrac` option | 6 (fled paths) |
| 6 | Loot | 1 (grey gate), existing `rollLoot` | the row's `loot` field |
| 7 | Mob row format | 3, 4, 5, 6 and #1643, #1646 | generated zones |

Each section ships behind a flag in the preview (`?region=1&mobs=readability,noticing,...`), default off until the section's tests pass, and none changes the live game or any `src/` file.

## 9. Items I could not verify (stated plainly)

- No donor was built or run; every behaviour above is read from source, and the numbers marked "ours" have not been playtested. Combat and World must tune on a running build.
- OpenGothic's view-cone arithmetic is ambiguous about whether the half-angle is 80 or 100 degrees depending on the skeleton's forward axis (also recorded in `gothic-routines.md` 5.4). This spec adopts 100 as the default and requires a golden before tuning.
- Per-event perception range tables in Gothic come from the game's scripts, which are not in the donor tree; only the "defaults to the creature's own sense range" rule is verified.
- Daggerfall's give-up timer is 200 classic ticks; the 11 s figure assumes a classic tick of about 0.055 s taken from a constant in the same file, not from a run.
- world-of-claudecraft distances are in its own world units (comments say yards); this spec rescales them by judgement, not by a measured ratio. Our hero speed (2.3 m/s) and creature walk (0.9 m/s) come from `mobs.ts`.
- EQEmu's `CheckWillAggro` also needs a clear line of sight and skips creatures already engaged unless they have proximity aggro; the "an engaged creature ignores a newcomer" rule is not spec'd here because our creatures are `engaged` only inside a duel, where the world logic is frozen.
- `origins/preview/mobs.ts` and `hunt.ts` were read from `origin/expansion/mob-fight`; trunk does not have them yet, so field names may move before the build.
- Section 7 reads `origins/world/generate.ts` and `schema.ts` on trunk, but `origins/mobs/styles.ts` (#1646, `origin/combat/mob-styles`) and `origins/preview/mob-looks.ts` (#1643, `origin/char/mob-looks`) only from their branches, so names may move. No legends-rule validator exists in code; 7.4 states what a machine can check and leaves the human review in place.
- `THIRD_PARTY_NOTICES.md` is not in this tree; the lines in section 0.3 are ready to paste.
