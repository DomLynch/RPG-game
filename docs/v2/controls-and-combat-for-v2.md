# Controls and combat feel, as data, for Frankendom V2

Lead, 2026-10-25. Read from DomLynch/RPG-game trunk `codex/01a09a76/task-1` (live 82a994d15). Paths and numbers only; "(inferred)" = not read directly. The sim runs at 60 Hz (`src/fight/sim.ts:2`), so **1 tick = 1/60 s**.
Trap: the hero's longsword timings are NOT the plain move rows. An `rv86` overlay in `src/fight/weapon-defs.json:6` changes them (see §2). V2 should keep ONE table.

## 1. Thumb controls
Thresholds live in `src/fight/input-rows.json`; the logic is in `src/fight/input.ts`.

| Control | Rule | Where |
|---|---|---|
| Left stick | Pad radius 42 px; knob travels 34 px. Dead zone 0.12. Sprint = a push past 1.4 (about 17 px beyond the rim), only on screens ≤900 px wide or coarse pointers | input.ts:432-442 |
| Side cut | With the stick pushed ≥ 0.4 (`cut-push`), a light attack cuts to that side; with the stick neutral, lights alternate left and right | input.ts:42 |
| Slash button | Fires on a 14 px sideways slide (that side), on release, or after 50 ms, whichever comes first. Dragging > 6 px outside the button turns the press into a guard (feint/parry) | input.ts:44-47, 262, 283-291 |
| One-button layout (ON live: `input.one-button` = 1, input-rows.json:10) | Release < 220 ms = light; an 18 px slide within 50° of straight up = stab; a sideways slide = that cut; holding > 220 ms = heavy. Inside a counter window the heavy hold drops to 80 ms | input.ts:48-58 |
| Guard button (5 sides) | Hold = straight guard; an 18 px slide picks left, right, overhead or low; a side already held keeps its axis until the thumb is 15° past the diagonal | input.ts:28-38, 392-415 |
| Dodge button | Tap = backstep; hold 150 ms = roll; if the stick is pushed, it rolls at once | input.ts:63, 147-158, 481-484 |
| Other buttons | kick, heavy, thrust, skill, skill2, run | input.ts:82-89 |
| Keyboard | WASD/arrows move, Shift runs, F light, G heavy (hold), T thrust (hold), C kick, E dodge (hold = roll), Q guard (Q + arrows = side), R recentres the camera | input.ts:78, 198-225 |
| Buffer | A press during the last 10 ticks of a move is stored (`bufferWindow`) and lives 11 ticks (`bufferTtl`) | rules-defs.json; duel.ts:250, 350 |
| Heavy charge | 30 to 54 ticks of hold, for ×1.5 damage and ×1.5 stagger | rules-defs.json |

## 2. Move table: `src/fight/move-defs.json`
Fields:
- `windup`, `active`, `recovery`: ticks.
- `chained`: shorter timings when the move is used inside a combo.
- `chain.window`, `chain.follow`: the combo window, and which moves can come next.
- `damage`.
- `stamina`: the attacker's cost.
- `staminaDamage`: stamina drained from the target.
- `stagger`: the target's hurt ticks.
- `poise`, `poiseFrom`: the attacker's armour, and the tick it starts.
- `breaksGuard`.
- `chip`: the share of damage that gets through a block.
- `parryable`.
- `knockback`.
- `stepIn`: metres stepped forward.
- `feintUntil`: the last tick the move can be feinted.
- `reach`: metres.
- `vsGuard`: overrides when the move hits a guard.
- `posture`: damage to the guard meter.
- `charges`.

Each move path maps to a clip at lines 24-35.

| Move | Wind/Act/Rec | Damage | Stamina | Reach | Other |
|---|---|---|---|---|---|
| light_left / light_right | 20/8/22, chained 16/8/18 | 14 | 25 | 1.65 m | combo window 18; posture 20; stagger 24 |
| heavy_overhead | 32/5/31, chained 22/5/31 | 18 | 35 | 1.9 | poise 24; chip 0.4; posture 32; charges |
| thrust | 16/5/21 | 11 | 20 | 2.0 | stepIn 1 m; posture 16 |
| riposte / slash_riposte | 12/5/19 | 24 | 20 | 1.65 | breaks guard |
| heavy_riposte | 20/5/25 | 30 | 35 | – | – |
| heavy_counter | – | 20 | 30 | – | – |
| critical | – | 40 | 25 | – | not parryable |
| kick | 18/1/25 | 4 | 25 | 1.2 | not parryable; posture 24; vs guard: stagger 48, staminaDamage 45 |

Longsword overlay (rv86): lights become active 5 / recovery 25 (chained 5/20); thrust becomes 19/6/16.

## 3. Rules (`src/fight/rules-defs.json` unless noted)
- **Guard:**
  - Directional; arc π/3. Move speed while guarding ×0.35.
  - A block costs 25 stamina and opens a 20-tick counter window.
  - Perfect block = the first 3 ticks of a raised guard: half cost, no chip (duel.ts:595-599).
- **Parry:** 10-tick window, 30-tick cooldown, 8 ticks of recovery. The parried attacker is stunned 90 ticks, and that same stun is the defender's punish window (duel.ts:589-590).
- **Riposte:** no separate multiplier; the bonus is in the rows (24 / 30 damage, versus 14 for a light).
- **Roll:** 36 ticks, i-frames on ticks 4-20, costs 30 stamina.
- **Backstep:** 12 ticks, costs 10, can be cancelled from tick 8.
- **Clean dodge:** opens a 20-tick counter window (sandbox `dodgeCounter`).
- **Counter-hit:** ×1.25 damage, ×1.5 stagger.
- **Rear hit** (arc π/2): ×1.25 damage, ×1.25 stagger, ×1.5 posture.
- **Stop-hit:** ×1.5 damage, ×1.75 stagger.
- **Posture:** max 100; decays 0.2/tick after holding 60 ticks; a break stuns 90 ticks; a parry deals 25.
- **Stamina** (`src/fight/pool-defs.json`): max 100. Regen 0.667/tick (≈40/s) after a 45-tick delay, halved while guarding. Exhaustion stuns 36 ticks, sets speed ×0.7, and ends when stamina recovers to 20.
- **Health:** 150. The death window is 144 ticks (2.4 s).
- **Hit-stop:** effectively OFF. `src/hit-stop-rules.json` is all 0 ms (a 2026-10-07 ruling; PostureBroken was 120 ms before). `src/fight/hit-stop-defs.json` is 0 frames except `special` at 6. Knock values run 0.02-0.04. If V2 wants weight, add hit-stop deliberately.

## 4. Fight camera (phone portrait, 375 wide)
**CORRECTION (Lead, 2026-10-26):** the lock pose below belongs to the OLD standalone Pit page. The live game (frankendom.com zone pages) fights with `src/fight/follow-camera.ts` l.66-88 plus the "Wide auto-fit" framing (`origins/preview/combat-cam.ts`; rows `origins/preview/preview-rules-defs.json` l.48+).
- Portrait: back 6.5 + fit, up 2.8 + 0.5·fit, side 1.8 m, ahead 2, lookY 1.0, mid 0.5. fit = 0.4·gap + 0.5·max(0, foe size − 1.8), at no more than 1.5 m/s. Back clamped to [5.5, 12]. shiftY 0.12 of the screen. Eases in 3/s, out 1.8/s. FOV 51. fightBack 1.
- The eye sits behind the hero's heading, not on the foe line. Use these numbers, not the lock pose below.

- **FOV:** 51° (scene.ts:160). No separate portrait FOV.
- **Lock-on** (camera.ts:47-50; numbers in `src/fight/camera-rules-defs.json`):
  - back distance = max(4.2, 0.62 × gap + 2.8) m;
  - height = max(3.2, 1.3 × gap) m;
  - both × 1.3 (`fightBackDefault`) → about 5.5 m back / 4.2 m up at close range (Lead's arithmetic);
  - gaps under 0.8 m count as 0.8.
- **Over the shoulder:** steps over the shoulder for short or low foes (`sideClear` 1.2, `lowSide` 0.5).
- **Arena clamp:** 11.5 m.
- **Walk camera:** a 7.5 m orbit.
- **Portrait framing:** `shiftY`, `fov` and `zoom` in `src/fight/follow-camera.ts:23-26`.
- The camera was frozen at the #1383 framing (docs/state/code-quality.md:330).

## 5. Clip families (role names on the hero rig: characters.ts:838)

| Role | Clip |
|---|---|
| Light attacks | `Attack` (right) / `Return` (left) |
| Heavy | `Heavy` |
| Stab | `Thrust` role, which plays the `Riposte` clip |
| Guard | `Guard` |
| Block impact | `BlockImpact` |
| Parry / deflected | `Parry` / `Deflected` |
| Roll | `Roll` |
| Hit reaction | `Hit` (stagger reuses Hit, inferred) |
| Death | `Death` |
| Idle / locomotion | `Idle`, `Armed`, `ArmedWalk`, `Walk`, `Jog`, `Run`, `ArmedRun`, `StrafeLeft` / `StrafeRight` |
| Other | `Kick`, `Draw` |

- Exo Gray's 27 Mixamo clips are already saved under these role names in OpenTrident's `hero-mixamo-exo-mx.glb` (`scripts/character/exo-hero-clips.mjs:2-8`). So pick V2's clips from that file, or from the same Mixamo source clips.
- The Mixamo source name per role is NOT recorded in the repo. The only list is a plan, mostly unverified: `docs/specs/combat/mixamo-plan.md:47-70`.
- The strike lands at about 46% of the Mixamo Attack/Heavy clips (Attack frame 24, Heavy frame 26). A start offset skips their flat lead-in (`hero-body-rows.json`, #3652).
- Mixamo has no true run-through, so the old game kept its own clip for that finisher.

## 6. Don't copy
- **Record versions:** RV is at 91 (`src/fight/record.ts:27`). Each bump touches about 8 places, and a missed one broke about 30 tests (docs/state/combat.md:7). V2: no record versions until there is online play to protect.
- **Era overlays:** six `*-era.ts` files, plus `stance-legacy-defs.json` and the rv86 weapon overlay, so the base data is not the live data. V2: one table, no overlays.
- **46 sandbox flag rows** with dead off-switches (`spellsOff`, `healOff`, `castTellOff`, `hideStancePicker`).
- **Data that loads but does nothing:** all-zero hit-stop tables, and pools with `sim:false`.
- **"Fix the cause, not a second patch beside it"** (combat.md:841). The bloat audits are in docs/state/archive-2026-09-21.md:17,42.
