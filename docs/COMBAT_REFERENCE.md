# Frankendom — Combat Reference (as live on frankendom.com, 2026-09-16)

Everything below is read from the shipped code (`src/moves.ts`, `src/duel.ts`, `src/ai.ts`, `src/combat.ts`, `src/main.ts`). Times are in simulation ticks at 60 Hz (1 tick = 16.7 ms); a millisecond value follows where it matters. Distances are metres.

## 1. Architecture in one paragraph

A deterministic fixed-step simulation (`stepDuel`) advances both fighters together at 60 Hz from two `Intent`s — the player's, from touch/keys, and the warden's, from an AI that reads only committed state and emits the same `Intent` type. Every tick produces `CombatEvent`s (`AttackStarted`, `Hit`, `Blocked`, `Parried`, `GuardBroken`, `PostureBroken`, `Dodged`, `Staggered`, `Charging/Charged`, `Killed` …). The renderer, HUD, sound and hit-stop consume state and events; nothing visual feeds back into the rules. Contacts resolve against a snapshot, so a trade lands both blows. A fixed seed (731) makes the first match reproducible; every rematch reseeds the warden.

## 2. Controls

**Mobile (thumb cluster, locked in):** Slash 66 px (alternates left/right cut automatically; hold = chambered cut, the bait) · Stab 50 (thrust; hold to load) · Heavy 50 (hold to charge) · Kick 44 (brightens when the warden is inside 1.5 m — the kick's real landing range) · Step 56 (tap = backstep, hold ≥ 150 ms = roll; with the stick already deflected the press rolls at once) · Guard 64 (tap = parry window, hold = block; tap during your own wind-up = feint). **Drag-off feint:** sliding a held Slash/Heavy/Stab off its circle turns the press into a guard press (a feint inside the wind-up's feint window, a parry or a raised guard after it) until the thumb lifts. The held level belongs to the control that raised it. Left thumb: movement stick (outer edge = sprint). Camera auto-locks on the warden. Alternatives from the menu: the "weapon disc" (flick ← → cut, ↑ thrust, ↓ heavy) and the **v7 guard ring** (Guard is a ring around Slash: a short rock from Slash is a guard press; Heavy above, Stab up-right, Kick right, Step below-left) — the scorecard keeps a tally per scheme.

**Desktop:** WASD move · F light · G heavy (hold = charge) · T thrust (hold = load) · E step/roll · Q guard/parry · C kick · Shift sprint.

Input rules: one edge-triggered action per tick plus held levels (guard, heavy/thrust held, stick). A press in the last 10 ticks of any committed phase is buffered (TTL 11), so a press as you come out of a swing, roll or stagger is never lost. Only a cancelled pointer (or focus loss) withdraws a queued press.

## 3. Fighter state

- **Health** 100. **Stamina** 100, regen 0.4/tick (24/s) after a 60-tick (1 s) rest; guarding stops regen; at 0 → **exhausted** (no attacks or guard, move at 70 % speed) until back to 20.
- **Posture** 0–100 (see §7). **Wound**: a landed blade hit marks a wound for 240 ticks, during which stamina regen is ×0.8.
- **Phases:** sheathed → draw (42 ticks) → ready · guard · attack · backstep · roll · hurt (stagger) · dead (144-tick death).
- Turning: a swing snaps 30 % toward the target at start and tracks 25 % through the wind-up; movement is 1 m/s walk, sprint costs 0.2 stamina/tick.

## 4. Moves (ticks: wind-up / active / recovery)

| Move | Ticks (ms to contact) | Dmg | Stamina | Stagger | Reach | Notes |
|---|---|---|---|---|---|---|
| Light cut (R/L) | 14 / 5 / 21 (233 ms) | 11 | 20 | 24 | 1.65 (lands ≤ 1.75) | chains: opposite cut or heavy within 18 ticks → chained timing 12/5/17 (heavy 22/5/31); posture 18; block costs the defender 25 |
| Thrust | 16 / 5 / 21 (267 ms) | 14 | 25 | 20 | 2.0 (lunge at walking pace, lands from 2.0) | fully blockable (no chip); posture 14; the spacing tool |
| Heavy overhead | 32 / 5 / 31 (533 ms) | 18 | 35 | 24 | 1.9 (lands ≤ 2.2) | hyper-armour from tick 24; guard takes it for **40 % chip (7) + 40 stamina**; posture 30; hold to **charge** |
| Charged heavy | held 30–54 ticks at tick 10 | 27 (×1.5) | 35 | 36 (×1.5) | 1.9 | hyper-armour while held; **breaks a guard** |
| Riposte (Light in a punish window) | 12 / 5 / 19 (200 ms) | 24 | 20 | 24 | 1.65 | breaks guard; no posture of its own (the parry already put 35 on the attacker) |
| Heavy riposte (Heavy in a punish window) | 20 / 5 / 25 (333 ms) | 30 | 35 | 24 | 1.9 | breaks guard; no posture of its own (as the riposte) |
| Guard counter (Heavy ≤ 20 ticks after a block) | 20 / 5 / 25 | 20 | 30 | 30 | 1.9 | armoured from tick 4; breaks guard; posture 30 |
| Critical (Heavy in a posture-break window) | 20 / 5 / 25 | 40 | 25 | 40 | 1.9 | **unparryable**, armoured, breaks guard |
| Kick | 18 / 1 / 25 (300 ms) | 4 | 25 | 18 | cone 1.2 (lunge lands from 1.58) | unparryable; drains 15 stamina; **vs a guard: 36 stagger + 45 stamina**; posture 24 |

Chamber: every plain cut, thrust and heavy has a *chamber* tick (6 / 8 / 10). If the button is still held when the swing reaches it, the swing **pauses** there (the load is the tell) for up to 54 ticks and can still be feinted; only the heavy *charges* from its chamber (30 held ticks → charged). A tap never holds; a heavy press must last ≈ 0.67 s to charge.

Counter-hit: a clean hit on a fighter committed to a swing (any phase) or in the vulnerable tail of a roll (ticks 21–36) deals ×1.25 and staggers ×1.5. Rear hit (inside a 90° rear arc): ×1.15 damage, ×1.25 stagger. Hit location (head/torso/legs) is cosmetic today (all ×1).

## 5. Defence

- **Guard (hold):** blocks a facing (±60°) blade hit for the move's block cost (light 25, thrust 25, heavy 40 + 7 chip). A block opens a 20-tick **guard-counter** window. A **perfect block** (guard raised within the 3 ticks after the parry window closes) costs half and takes no chip. A guard **breaks** — full damage, −60 stamina, stagger — only to a charged heavy, a riposte-family swing, a kick, or when you cannot pay the block cost.
- **Parry (tap):** a fresh guard press opens a 10-tick (167 ms) window; a parryable swing meeting it staggers the attacker 90 ticks (1.5 s) and gives you a **punish window** (Light = riposte 24, Heavy = heavy riposte 30). A *released* tap that meets nothing leaves you **exposed** for 8 ticks (guard down); a press still **held** past the window becomes the standing guard with no hole (its first 3 ticks a perfect block). Parry cooldown 30 ticks.
- **Feint:** a guard tap inside your own wind-up (light ≤ 7, thrust ≤ 9, heavy ≤ 11 ticks — i.e. through the chamber) cancels the swing into a fresh guard/parry window for 10 stamina.
- **Backstep (tap Step):** 12 ticks, 10 stamina, no i-frames, its tail (from tick 8) cancels into a swing (a cut out of it uses chained timing = dodge-attack). **Roll (hold Step ≥ 150 ms, or swipe down):** 36 ticks, 30 stamina, i-frames ticks 4–20, vulnerable tail after.
- Directional guard exists in the engine (`directionalGuard`) but is **off**.

## 6. Posture (Sekiro-style)

Each fighter has a posture bar 0–100 (thin amber bar under the health bar, red at ≥ 70 %). It fills from: blocked hits (the move's posture: cut 18 · thrust 14 · heavy 30 · kick 24 · riposte-family 20–30; a perfect block takes half), clean hits on you (×1.25 on a counter-hit), and **being parried (+35 on the attacker)**. It drains 0.2/tick (12/s) whenever you are not staggered. **Full = posture break:** the bar resets, you stagger 90 ticks, and the opponent gets a 90-tick **critical window** in which Heavy is the *critical* (40, unparryable). A guard break resets the victim's posture (that was the payoff). Measured: at normal ~3 breaks per 24 AI-vs-AI duels, at hard 14 (4 critical kills).

## 7. Hit impact

**Hit-stop:** a contact tick freezes the simulation while frames keep rendering — block 30 ms (heavy-class block 50) · hit 50 · parry 70 · heavy-class hit or guard break 90 · posture break 120 · kill 220. The frame loop is the one owner of the pause: the frozen frames show the contact tick's own bodies and pose (the rigs evaluate at zero dt; effects keep running), the part of a frame that outlives the pause goes on to the next tick, and ticks are never skipped or replayed (a dropped-frame phone still shows the contact pose). Journal toggle **Hit-stop: on/off** (remembered on the device) for comparison. The scorecard records real active seconds beside simulation seconds. **Camera kick:** 2 cm (4.5 cm heavy-class) along the blow's heading, settling in 0.15 s; off under reduced-motion. Sparks, wound decals and blood modes (red/dark/off) are the visual lane's; combat Foley is a procedural sprite driven by the same events.

## 8. The warden (AI)

Uses the same combat API and rules; reads only committed state; notices a fresh action `reaction` ticks late; every decision is seeded and bounded.

| Profile | reaction | accuracy | parry | dodge | aggression | pressure (lights) | stamina floor |
|---|---|---|---|---|---|---|---|
| easy | 24 ticks (400 ms) | .50 | .10 | .10 | .45 | 0 | 60 |
| normal | 14 (233 ms) | .75 | .30 | .20 | .65 | 0 | 50 |
| hard | 10 (167 ms) | .95 | .60 | .35 | .85 | .50 | 40 |

- **Defence plan per noticed swing:** a kick (unparryable, built to break a guard) is never guarded or parried — with the profile's dodge share it is rolled (stepped out of without the stamina), otherwise taken. Anything else: parry (if off cooldown) → roll (if ≥ 30 stamina) → block if affordable and blockable → evade/backstep. A charged heavy or a riposte is never blocked; a planned block is dropped the tick a heavy is seen charging. A chambered light is treated as a bait (still blockable). Timing jitter scales with (1 − accuracy).
- **Offence (utility scores):** critical 1.6 in a posture-break window · guard counter 1.4 (a heavy inside the 20-tick window a block opens) · punish 1.5 (a light into a stagger, exhaustion, a whiffed swing's recovery or a whiffed parry's exposure) · chain 1.2 · kick 1.1 (vs a standing guard, 50 %) · heavy 1.0 vs a guard / 0.8 as the scheduled opener · light / thrust 0.8 as scheduled openers. Below the stamina floor only punishes are allowed. Cadence: after each attack it waits 45–105 ticks × (1.6 − aggression).
- **Openers:** the first attack is always the heavy (the readable parry lesson). After that, non-light openers are heavy 65 % / **thrust 35 %**; a thrust is thrown only from beyond cutting range (≥ 1.55 m) — the warden steps back to thrust range first — and never into a guard. Hard also pressures with lights (50 %).
- **Guard handling:** vs a settled guard it kicks (50 %) or throws a heavy; the heavy is **held to the charge** 20 / 40 / 60 % of the time by level (the rest are plain heavies a guard takes for chip). A less aggressive warden sometimes baits with a visible guard instead of swinging.
- **Movement:** approaches to 1.15 m, retreats when < 1 m or freshly hit (48 ticks), circles just outside cut range when low on stamina or when its posture is ≥ 70 % (gives ground to drain the bar), never drifts beyond 2.5 m.
- **Adaptation (reads):** it counts your habits from state edges and forms a read only with evidence (after two exchanges): **parry-happy** (parry presses on ≥ 50 % of its swings) → 70 % cut openers, 70 % of them held 12 ticks (past your 10-tick window) as baits, one in six feinted into a guard press on the last feintable tick, kicks lead inside kick reach, +40 % charged heavies; **turtle** (guarding ≥ 45 % after 3 s) → kick chance .5 → .8, score 1.1 → 1.4, +40 % charge-through; **roller** (rolls on ≥ 40 %) → heavies held even with no guard up, swings into the roll's tail; **spammer** (≥ 70 % cuts of ≥ 9 swings; thrusts and heavies count against it) → its cuts are *anticipated* (planned 7 ticks in, not at the profile reaction — the only way a 14-tick cut can be parried), parry chance ×2 (capped at .85 and at 1 − dodge so it keeps rolling), and while the spammer stands ready inside cutting range the warden guard-walks in (blocks, keeps closing, guard-counters) instead of throwing a 32-tick heavy into cuts. The debug overlay prints `habits … reads …`.

## 9. Match flow and settings

Draw → the warden closes → fight to 0 health → Rematch (new warden seed). Menu: Warden difficulty (easy/normal/hard), Controls (cluster / disc), Blood (red/dark/off), Combat debug overlay (also `?debug`), sound. Journal: a per-control-scheme scorecard (fights, wins, rematches, average duel length, damage dealt/taken) kept on the device.

Measured AI-vs-AI (24 seeds): easy median 36 s / 7 hits · normal 28 s / 6 hits · hard 22 s / 8 hits; no timeouts.

## 10. Not in the game (decided)

- Weapon families (hammer/spear/axe) — parked until the longsword loop is perfect.
- Momentum / dominance / crowd meter — rejected (cheesy); any crowd reaction is presentation only.
- Knockdown — rejected. Backstab ×2 — rejected (rear arc is +15 % instead); an earned critical exists via posture.
- Uppercut / diagonal cuts — need rig clips. Directional guard — engine seam only, off. Shields — data seam (`guardProfile`), none shipped.
- Controller / haptics — declined. PWA — later. Online duels — not yet (the sim is deterministic and fixed-step for it).

## 11. Numbers most worth a second opinion

1. Posture: cut 18 / heavy 30 / parry 35 with 12/s drain — breaks are rare at normal (3 per 24 duels). Too rare, or right for a "reward for pressure"?
2. Charged heavy at 27 + guard break (−60 stamina + stagger) vs a plain heavy's 7 chip — is the read (0.5 s hold, glow) fair on a phone?
3. The 8-tick exposed hole after a *released* parry tap that meets nothing (a held press has none).
4. Thrust share 35 % and the step-back-to-range behaviour (costs ~5 s of duel time at normal).
5. Hit-stop lengths (30–220 ms) against the "readable brutality" rule.
6. Warden reads: thresholds (2 exchanges / 3 s / 9 swings) and whether adaptation should be visible to the player beyond the debug overlay.
7. Duel length: 6–8 hits / 22–36 s at AI-vs-AI vs the 8–15 hit target.
