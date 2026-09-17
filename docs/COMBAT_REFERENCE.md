# Frankendom — Combat Reference (as live on frankendom.com, 2026-09-16)

Everything below is read from the shipped code (`src/moves.ts`, `src/duel.ts`, `src/ai.ts`, `src/combat.ts`, `src/main.ts`). Times are in simulation ticks at 60 Hz (1 tick = 16.7 ms); a millisecond value follows where it matters. Distances are metres.

## 1. Architecture in one paragraph

A deterministic fixed-step simulation (`stepDuel`) advances both fighters together at 60 Hz from two `Intent`s — the player's, from touch/keys, and the warden's, from an AI that reads only committed state and emits the same `Intent` type. Every tick produces `CombatEvent`s (`AttackStarted`, `Hit`, `Blocked`, `Parried`, `GuardBroken`, `PostureBroken`, `Dodged`, `Staggered`, `Charging/Charged`, `Killed` …). The renderer, HUD, sound and hit-stop consume state and events; nothing visual feeds back into the rules. Contacts resolve against a snapshot, so a trade lands both blows. A fixed seed (731) makes the first match reproducible; every rematch reseeds the warden.

## 2. Controls

**Mobile (thumb cluster, locked in):** Slash 66 px (alternates left/right cut automatically; hold = chambered cut, the bait) · Stab 50 (thrust; hold to load) · Heavy 50 (hold to charge) · Kick 44 (brightens when the warden is inside 1.5 m — the kick's real landing range) · Step 56 (tap = backstep, hold ≥ 150 ms = roll; with the stick already deflected the press rolls at once) · Guard 64 (tap = parry window, hold = block; tap during your own wind-up = feint). **Drag-off feint:** sliding a held Slash/Heavy/Stab off its circle turns the press into a guard press (a feint inside the wind-up's feint window, a parry or a raised guard after it) until the thumb lifts. The held level belongs to the control that raised it. Left thumb: movement stick (outer edge = sprint). Camera auto-locks on the warden. Alternatives from the menu: the "weapon disc" (flick ← → cut, ↑ thrust, ↓ heavy) and the **v7 guard ring** (Guard is a ring around Slash: a short rock from Slash is a guard press; Heavy above, Stab up-right, Kick right, Step below-left) — the scorecard keeps a tally per scheme.

**Desktop:** WASD move · F light · G heavy (hold = charge) · T thrust (hold = load) · E step/roll · Q guard/parry · C kick · Shift sprint.

Input rules: one edge-triggered action per tick plus held levels (guard, heavy/thrust held, stick). A press in the last 10 ticks of any committed phase is buffered (TTL 11), so a press as you come out of a swing, roll or stagger is never lost. Only a cancelled pointer (or focus loss) withdraws a queued press.

## 3. Fighter state

- **Health** 150 (a duel of 8–15 blows: measured 12 hits / 24 s median AI-vs-AI at normal). **Stamina** 100, regen ⅔/tick (40/s) after a 45-tick (0.75 s) rest; a raised guard regenerates at half rate; a sprint drains 0.2/tick with no regeneration on sprinting ticks and none of the rest delay (it resumes the tick the sprint stops); at 0 → **exhausted** (no attacks or guard, move at 70 % speed) until back to 20.
- **Posture** 0–100 (see §6). **Wound**: a landed blade hit marks a wound for 240 ticks, during which stamina regen is ×0.8 — and **attrition**: every blade wound takes 8 off the wounded fighter's stamina ceiling for the rest of the duel (floor 40; the lost part of the bar is shaded), and a leg wound slows walking to 85 %.
- **The ring wall** (radius 8.55 m): knockback that ends against the wall is a second impact — +12 ticks of stagger and +15 posture (a kick shoves); a fighter with the wall at their back cannot backstep (a roll still works). The warden never retreats into the wall (it circles inward along it) and presses a player pinned on it.
- **Phases:** sheathed → draw (42 ticks) → ready · guard · attack · backstep · roll · hurt (stagger) · dead (144-tick death).
- Turning (locked on): a swing turns up to 0.3 rad (17°) toward the target at its start and up to 0.25 rad (14°) per tick through the wind-up (a kick does not track); movement is 3 m/s walk, 5.2 m/s sprint (on the phone: a deliberate push 1.4 rims past the stick's edge, the knob lights when sprinting), sprint costs 0.2 stamina/tick.

## 4. Moves (ticks: wind-up / active / recovery)

| Move | Ticks (ms to contact) | Dmg | Stamina | Stagger | Reach | Notes |
|---|---|---|---|---|---|---|
| Light cut (R/L) | 20 / 8 / 22 (333 ms tell, 133 ms sweep) | 14 | 25 | 24 | 1.65 (lands ≤ 1.75) | a hook with a sword: a short raised load on the side the sword rests, one arc through the front, a stop at the extended pose, then the same path back to guard (never behind the body, no lift over the head; Slash alternates right-to-left and the backhand); chains: opposite cut or heavy within 18 ticks → chained timing 16/8/18 (heavy 22/5/31); posture 20; block costs the defender 15; feintable to tick 10; hold = chambered at tick 9 |
| Thrust | 16 / 5 / 21 (267 ms) | 11 | 20 | 20 | 2.0 (lunge at walking pace, lands from 2.0) | fully blockable (no chip); posture 16; **the stop-hit**: into a swing, or into an opponent who has walked ≥ 0.3 m onto the point since it started, ×1.5 damage and ×1.75 stagger (a cut's counter-hit is ×1.25 / ×1.5); a thrust that meets nothing hangs 10 ticks at full extension before recovering |
| Heavy overhead | 32 / 5 / 31 (533 ms) | 18 | 35 | 24 | 1.9 (lands ≤ 2.2) | hyper-armour from tick 24; guard takes it for **40 % chip (7) + 30 stamina**; posture 32; hold to **charge** |
| Charged heavy | held 30–54 ticks at tick 10 | 27 (×1.5) | 35 | 36 (×1.5) | 1.9 | hyper-armour while held; **breaks a guard** |
| Riposte (Light in a punish window) | 12 / 5 / 19 (200 ms) | 24 | 20 | 24 | 1.65 | breaks guard; no posture of its own (the parry already put 25 on the attacker) |
| Heavy riposte (Heavy in a punish window) | 20 / 5 / 25 (333 ms) | 30 | 35 | 24 | 1.9 | breaks guard; no posture of its own (as the riposte) |
| Guard counter (Heavy ≤ 20 ticks after a block) | 20 / 5 / 25 | 20 | 30 | 30 | 1.9 | armoured from tick 4; breaks guard; posture 30 |
| Critical (Heavy in a posture-break window) | 20 / 5 / 25 | 40 | 25 | 40 | 1.9 | **unparryable**, armoured, breaks guard |
| Kick | 18 / 1 / 25 (300 ms) | 4 | 25 | 18 | cone 1.2 (lunge lands from 1.58) | unparryable; drains 15 stamina; **vs a guard: 36 stagger + 45 stamina**; posture 24 |

Chamber: every plain cut, thrust and heavy has a *chamber* tick (6 / 8 / 10). If the button is still held when the swing reaches it, the swing **pauses** there (the load is the tell) for up to 54 ticks and can still be feinted; only the heavy *charges* from its chamber (30 held ticks → charged). A tap never holds; a heavy press must last ≈ 0.67 s to charge.

Counter-hit: a clean hit on a fighter committed to a swing (any phase) or in the vulnerable tail of a roll (ticks 21–36) deals ×1.25 and staggers ×1.5. Rear hit (inside a 90° rear arc): ×1.15 damage, ×1.25 stagger. Hit location (head/torso/legs) is cosmetic today (all ×1).

## 5. Defence

- **Guard (hold):** blocks a facing (±60°) blade hit for the move's block cost (light 15, thrust 20, heavy 30 + 7 chip). A block opens a 20-tick **guard-counter** window. A **perfect block** — a guard that has just settled: contact in the first 3 ticks after the parry window closes (i.e. a press held ~10–13 ticks before the blow) — costs half and takes no chip. A guard **breaks** — full damage, −60 stamina, stagger — only to a charged heavy, a riposte-family swing, a kick, or when you cannot pay the block cost.
- **Parry (tap):** a fresh guard press opens a 10-tick (167 ms) window; a parryable swing meeting it staggers the attacker 90 ticks (1.5 s) and gives you a **punish window** (Light = riposte 24, Heavy = heavy riposte 30). A *released* tap that meets nothing leaves you **exposed** for 8 ticks (guard down); a press still **held** past the window becomes the standing guard with no hole (its first 3 ticks a perfect block). Parry cooldown 30 ticks.
- **Feint:** a guard tap inside your own wind-up (light ≤ 7, thrust ≤ 9, heavy ≤ 11 ticks — i.e. through the chamber) cancels the swing into a fresh guard/parry window for 10 stamina.
- **Backstep (tap Step):** 12 ticks, 10 stamina, no i-frames, its tail (from tick 8) cancels into a swing (a cut out of it uses chained timing = dodge-attack). **Roll (hold Step ≥ 150 ms, or swipe down):** 36 ticks, 30 stamina, i-frames ticks 4–20, vulnerable tail after.
- Directional guard exists in the engine (`directionalGuard`) but is **off**.

## 6. Posture (Sekiro-style)

Each fighter has a posture bar 0–100 (thin amber bar under the health bar, red at ≥ 70 %). It fills from: blocked hits (the move's posture: cut 20 · thrust 16 · heavy 32 · kick 24 · guard counter 30; the ripostes add none — the parry already did; a perfect block takes half), clean hits on you (×1.25 on a counter-hit), **being parried (+25 on the attacker)**, and being driven into the ring wall (+15). It drains 0.2/tick (12/s) whenever you are not staggered — but every gain pauses the drain for 45 ticks, so a run of blocks adds up. **Full = posture break:** the bar resets, you stagger 90 ticks, and the opponent gets a 90-tick **critical window** in which Heavy is the *critical* (40, unparryable). A guard break resets the victim's posture (that was the payoff). Measured (slice Q sweep): at normal ~10 breaks per 24 AI-vs-AI duels — about one per two duels, the target — at hard ~1.

## 7. Hit impact

**Hit-stop:** a contact tick freezes the simulation while frames keep rendering — block 30 ms (heavy-class block 50) · hit 50 · parry 70 · heavy-class hit or guard break 90 · posture break 120 · kill 220. The frame loop is the one owner of the pause: the frozen frames show the contact tick's own bodies and pose (the rigs evaluate at zero dt; effects keep running), the part of a frame that outlives the pause goes on to the next tick, and ticks are never skipped or replayed (a dropped-frame phone still shows the contact pose). Journal toggle **Hit-stop: on/off** (remembered on the device) for comparison. The scorecard records real active seconds beside simulation seconds. **Camera kick:** 2 cm (4.5 cm heavy-class) along the blow's heading, settling in 0.15 s; off under reduced-motion. Sparks, wound decals and blood modes (red/dark/off) are the visual lane's; combat Foley is a procedural sprite driven by the same events.

## 8. The warden (AI)

Uses the same combat API and rules; reads only committed state; notices a fresh action `reaction` ticks late; every decision is seeded and bounded.

| Profile | reaction | accuracy | parry | dodge | aggression | pressure (lights) | stamina floor | lapse |
|---|---|---|---|---|---|---|---|---|
| easy | 24 ticks (400 ms) | .50 | .10 | .10 | .45 | 0 | 60 | .45 |
| normal | 14 (233 ms) | .75 | .30 | .20 | .65 | 0 | 50 | .30 |
| hard | 10 (167 ms) | .95 | .60 | .35 | .85 | .50 | 40 | .10 |

*lapse*: the share of noticed swings that get no answer at all — a human does not react to every cut they see, and with a 333 ms cut the warden would. A read spammer halves it.

- **Defence plan per noticed swing:** a kick (unparryable, built to break a guard) is never guarded or parried — with the profile's dodge share it is rolled (stepped out of without the stamina), otherwise taken. Anything else: parry (if off cooldown) → roll (if ≥ 30 stamina) → block if affordable and blockable → evade/backstep. A charged heavy or a riposte is never blocked; a planned block is dropped the tick a heavy is seen charging. A chambered light is treated as a bait (still blockable). Timing jitter scales with (1 − accuracy).
- **Offence (utility scores):** critical 1.6 in a posture-break window · guard counter 1.4 (a heavy inside the 20-tick window a block opens) · punish 1.5 (a light into a stagger, exhaustion, a whiffed swing's recovery or a whiffed parry's exposure) · chain 1.2 · kick 1.1 (vs a standing guard, 50 %) · heavy 1.0 vs a guard / 0.8 as the scheduled opener · light / thrust 0.8 as scheduled openers. Below the stamina floor only punishes are allowed. Cadence: after each attack it waits 45–105 ticks × (1.6 − aggression).
- **Openers:** at easy and normal the first attack is always the heavy (the readable parry lesson); hard pressures with lights from the start (50 %), so its first attack may be a cut. After the first heavy, non-light openers are heavy 80 % / **thrust 20 %**, thrown from wherever it stands (no walk-back) and never into a guard; the thrust's real job is the stop-hit — an attack that is due becomes the thrust when you are walking in.
- **Guard handling:** vs a settled guard it kicks (50 %) or throws a heavy; the heavy is **held to the charge** 20 / 40 / 60 % of the time by level (the rest are plain heavies a guard takes for chip). A less aggressive warden sometimes baits with a visible guard instead of swinging.
- **Movement:** approaches to 1.15 m, retreats when < 1 m or freshly hit (48 ticks), circles just outside cut range when low on stamina or when its posture is ≥ 70 % (gives ground to drain the bar), never drifts beyond 2.5 m.
- **Adaptation (reads):** it counts your habits from state edges and forms a read only with evidence (after two exchanges): **parry-happy** (parry presses on ≥ 50 % of its swings) → 70 % cut openers, 70 % of them held 12 ticks (past your 10-tick window) as baits, one in six feinted into a guard press on the last feintable tick, kicks lead inside kick reach, +40 % charged heavies; **turtle** (guarding ≥ 45 % after 3 s) → kick chance .5 → .8, score 1.1 → 1.4, +40 % charge-through; **roller** (rolls on ≥ 40 %) → heavies held even with no guard up, swings into the roll's tail; **spammer** (≥ 70 % cuts of ≥ 9 swings; thrusts and heavies count against it) → its cuts are *anticipated* (planned 7 ticks in, not at the profile reaction — the only way a 14-tick cut can be parried), parry chance ×2 (capped at .85 and at 1 − dodge so it keeps rolling), and while the spammer stands ready inside cutting range the warden guard-walks in (blocks, keeps closing, guard-counters) instead of throwing a 32-tick heavy into cuts. The debug overlay prints `habits … reads …`.
- **Fight-identity knobs (slice X, optional on `AiProfile`; absent = the warden above):** `feint` — base share of cuts/heavies that are feints against anyone (the read-parrier's 1/6 still applies on top); `guard` — the guard's share in its game: the standing guard, the bait guard, the block plan, the guard-walk and waiting for a roll behind a guard (0 = never in guard: evades or steps back instead); `disengage` — chance to hop back out of range right after landing a blow; `circle` — lateral drift while closing in (it always circles once in range); `regen` (on `Opponent`) — a stamina-regeneration multiplier. Plus, for the darter: `step` (an evasion is the cheap backstep when the step will clear the blow before it lands, else the roll), `interrupt` (a cut INTO a slower tell his cut beats), `kick` (kicks a read roller or backstepper — the one blow their timing does not escape), `dash` (sprints into an opening from outside reach), and `Opponent.speed` → `Fighter.speed` (a pace multiplier on walking, sprinting, the wind-up lunge and the backstep). Two reads joined the habit tracker for him: **poker** (thrusts ≥ half his swings) and **kicker** (kicks ≥ half) — a fighter with no guard hovers at the edge of that blow's reach and goes in on the whiff instead of walking onto the point; and **stepper** (backsteps out of ≥ 40 % of my swings). Two general fixes rode along: an evade plan takes **one** backstep while inside the blow's reach and then walks back (no chain of backsteps — every warden's taken/landed counts moved by a few, wins unchanged), and a chain follow-up the cut cannot reach goes as the thrust when the chain allows it. The Veteran, Pitborn and Nightborn carry no knobs.

The **Goblin** (opponent 4, slice X, 2026-09-17): `OPPONENTS.goblin` — knife, 0.78× (his hit capsule), **120 health** (100 at first; the owner raised it the same day so rung 3 out-fights the Pitborn — the hero brain now loses 15/24 to him), poise 0, **regen 1.5, speed 1.2**; normal `{ reaction 10, parry 0, dodge .4, aggression .85, pressure .6, discipline 20, lapse .2, feint .3, guard 0, disengage .6, circle .8, step .8, interrupt .6, kick .6, dash 1 }` (easy softer, hard sharper). The **knife** (`KNIFE_MOVES` / `KNIFE_PATHS`, baked from his own rig): slash 14/6/16 (chained 12/6/14) 10 dmg 18 stamina reach 1.2, the backhand a rip (the hook's outer edge), the hack 22/5/26 14 dmg 26 stamina chip .2 reach 1.55, the poke 12/4/15 9 dmg 14 stamina reach 1.45; feints inside the first ~40 % of every wind-up; `fight { thrustShare .4, close 1.0 }`. Gate (`tests/opponents.test.ts`): the patient whiff punisher is the best honest answer — it never loses to him, wins 3/24 at normal · 2/24 at hard inside the two-minute clock (8/24 at 100 hp; at 120 the rest run out the clock) and beats the player who swings at every tell (2 · 1); no script over the caps; every script touched; the longest guard phase he ever shows is a feint's 10-tick parry press and he never blocks; AI-vs-AI median 38.8 s. Ladder: Veteran → Pitborn → **Goblin** → Nightborn.

## 9. Match flow and settings

Draw → the warden closes → fight to 0 health → Rematch (new warden seed). Menu: Warden difficulty (easy/normal/hard), Controls (cluster / disc), Blood (red/dark/off), Combat debug overlay (also `?debug`), sound. Journal: a per-control-scheme scorecard (fights, wins, rematches, average duel length, damage dealt/taken) kept on the device.

Measured AI-vs-AI (24 seeds): easy median 36 s / 7 hits · normal 28 s / 6 hits · hard 22 s / 8 hits; no timeouts.

## 9b. Weapons (the slot)

A fighter carries a `weapon` (`src/moves.ts` `WEAPONS`): its move table, its baked blade paths (from `scripts/blade-manifest.json`, one entry per weapon: rig, node, contact segment in metres along the node's Y — `extras.contact` on the node overrides), the kind of guard it makes (`blade` / `shaft`), its material (audio cues) and the reach the warden reasons with. Every lookup in the simulation, the AI and the HUD goes through the fighter's weapon. Hit / Blocked / Parried / GuardBroken events carry `weapon` and `material`.

The player carries the **longsword**; the Veteran carries the **trident** (slice V, 2026-09-16 — `initialDuel` gives side 1 `'trident'`; the renderer plays each rig's clips by role from `characters.ts` `WEAPON_CLIPS`). The trident's fight, all data in `TRIDENT_MOVES` / `TRIDENT_PATHS`:

| move | tell / active / recovery (ticks) | damage | stamina | lands to (measured) | notes |
|---|---|---|---|---|---|
| Slash = low sweep | 22 / 8 / 24 (chained 18 / 8 / 20) | 12 | 25 | 1.75 m | one clip both sides; **trips a roll in its first half** (`direction: 'low'` blade on a roller with age < 18) |
| Stab = thrust | 16 / 5 / 23 | 12 | 22 | 2.25 m | chains into a second, faster thrust (12 / 5 / 19); **`minReach` 1 m: started inside 1 m it meets nothing** (bodies stand no closer than .85) |
| Heavy = the pin | 34 / 5 / 33 | 20 | 38 | 2.15 m | chip .5 |

The **shaft guard** (`Weapon.guardProfile` → `Fighter.guardProfile`): every block costs ×1.15, and a plain overhead heavy **breaks** it (`heavyBreaks`), where the blade guard only breaks to a charged one. The warden's **stance** (`Weapon.fight`): the trident opens with the thrust 60 % of the time (sword 20 %), closes to 1.4 m for a sweep or the pin (sword 1.15), never thrusts from inside 1 m — there it kicks (not into a swing, and not inside the window a landed blow earned the player), or backsteps out when it has no kick to give — and never raises the shaft to a plain heavy (it rolls, parries or steps out, as to a charged one). Balance guard: `tests/battery.test.ts` runs every scripted strategy against both the trident warden (live) and the longsword warden.

The **Pitborn** carries the **cleaver** (slice W, 2026-09-17; `OPPONENTS.pitborn.weapon`, data in `CLEAVER_MOVES` / `CLEAVER_PATHS`, baked at a man's 1.0× from `veteran-cleaver.glb` — his rendered 1.13× blade runs ~10 cm past the simulated one, never short of it). One edge, four blows on the sword's clips: the **chop** (22/8/26, 17 dmg, chip .2 through a guard, 28 stamina), the **back of the cleaver** — the backhand leads with the spine, a hammer (9 dmg, posture 34, block cost 30, stagger 32), the **hack** (36/6/36, 26 dmg, chip .5, posture 42, 42 stamina; a diagonal, the edge leads) and the **poke** (18/5/26, 7 dmg; `thrustShare .1`). Lunges equal the sword's; reaches are the sword's spacing estimates (1.65 / 1.9 / 2.0). His hard profile's discipline is 24 (was 20): the hack costs more than the attrition floor pays, and an AI that plans an opener it can no longer afford now falls back to a cut (`ai.ts`) — the 6/24 stalls the weapons lane measured were that wait. Gate: `tests/opponents.test.ts` (whiff punisher 9/24 normal · 7/24 hard, the best honest answer; turtle broken inside 6 s; AI-vs-AI median 27.5 s).

## 10. Not in the game (decided)

- Weapon families (hammer/spear/axe) — parked until the longsword loop is perfect.
- Momentum / dominance / crowd meter — rejected (cheesy); any crowd reaction is presentation only.
- Knockdown — rejected. Backstab ×2 — rejected (rear arc is +15 % instead); an earned critical exists via posture.
- Uppercut / diagonal cuts — need rig clips. Directional guard — engine seam only, off. Shields — data seam (`guardProfile`), none shipped.
- Controller / haptics — declined. PWA — later. Online duels — not yet (the sim is deterministic and fixed-step for it).

## 11. Numbers most worth a second opinion

(Updated after the seven audit blocks, 2026-09-16. Items answered by the blocks are marked.)

1. Posture: cut 20 / heavy 32 / thrust 16 / parry 25, drain 12/s paused 45 ticks after any gain — ~one break per two duels at normal, ~1 per 24 at hard (block 6). Is hard right to almost never break?
2. Charged heavy at 27 + guard break (−60 stamina + stagger) vs a plain heavy's 7 chip — is the read (0.5 s hold, glow) fair on a phone?
3. Answered (block 2): a held Guard has no hole; the 8-tick exposure applies only to a released tap.
4. Answered (block 6): thrust share 20 %, no walk-back; the thrust is the stop-hit (×1.5 / ×1.75 into a swing or a 0.3 m walk-in). Is 1.5 too strong a deterrent to walking in?
5. Hit-stop lengths (30–220 ms; blocked heavy 50) against the "readable brutality" rule — the journal's Hit-stop on/off toggle exists for the comparison (block 3).
6. Warden reads: thresholds (2 exchanges / 3 s / 11 swings, cuts anticipated at 8 ticks) — a cut-only player wins 5–7 of 24 at normal, 0 at hard (blocks 2, 5). Should adaptation be visible beyond the debug overlay?
7. Answered (block 5): health 150 + 40/s regen → 11–13 hits / 21–24 s at AI-vs-AI, inside the 8–15 target. The 50 Hz tempo toggle is there to feel a slower tempo before any re-timing of the moves (which needs a blade re-bake).
8. Attrition (block 6): −8 stamina ceiling per blade wound (floor 40), leg wound 85 % walk — enough to be felt without deciding the duel?
9. The ring wall (block 6): +12 stagger / +15 posture on a wall impact, no backstep when cornered — AI-vs-AI never touches it; only a human who backs off does.
