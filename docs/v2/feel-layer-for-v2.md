# The feel layer: what V1 does from the instant a hit lands until the fighter recovers

Lead, 2026-10-26. Read from DomLynch/RPG-game trunk `codex/01a09a76/task-1` (live 82a994d15). Paths and numbers only; "(inf)" = inferred.

Context:
- Companion pages: `controls-and-combat-for-v2.md` (inputs and timings) and `v2-feel-gap-audit.md` (what V2 lacks, ranked).
- **Read this first:** live V1 has almost no hit-stop. Every row is 0 ms since RV80 (`0b0aa858e`); only a landed melee special freezes, for 6 frames. **V1's weight comes from layers stacked on every contact:** sound, blood, sparks, flinch, camera kick, knockback, stun and floor stains. The old non-zero stop table is in §3 if Dom wants it back.

## 1. Hit effects
- **Contact dots** (`src/fight/fx.ts` l.92-103, 155, 226-229, 252-266):
  - 12 points per contact.
  - Life: 0.18 s (non-flesh), 0.34 s (flesh hit), 0.55 s (flesh kill).
  - Colours: flesh #a32b27, kick or bloodless #b1a28a, block #ffe4af.
  - Size: 0.095 for flesh, 0.045 otherwise.
  - A kill throws a tight cone along the blow.
- **Blood spray** (`blood-style.ts` l.31-38, `blood-rows.json` l.7):
  - One instanced pool of 112.
  - Particles: 15 per hit (2 heavy drops), 25 per kill (3 drops); low setting ×0.35, minimum 2.
  - Drops live 0.5-0.72 s at vy 1.6-3.0; mist lives 0.14-0.4 s.
  - Colour #690f0d fading to #200504; gravity 8.
- **Floor stains** (`gore.ts` l.26-79):
  - 12 decals.
  - A hit splash lasts 20 s.
  - A kill pool never expires, spreads over about 2 s and dries over 8 s.
  - Textures: `src/assets/blood/floor-pool{,-b}.png`, `floor-splash{,-b,-c,-d}.png`.
- **Body wounds** (`gore.ts` l.119-163):
  - From 60 % HP down, up to 5 per fighter, 0.10 × 0.125 m.
  - Art: `blood-wound-{b,c,d}.png` plus normal maps.
  - Drip strands last 1.5-3 s and shed a drop every 3-6 s, up to 24 floor spots that last 25 s.
  - The killer's blade is tinted #7a1410 (l.528).
- **Screen-edge blood when the player is hit** (`blood-edge.ts` l.15-20):
  - Strips: `public/game/img/blood/{wet-smear,soft-bleed,dragged-streak}.webp`.
  - 480 ms, peak held about 150 ms; 6 vw wide, 68 % of the height.
  - Head-on blows show both edges at 0.6.
- **Clash sparks, steel on steel only** (`clash-sparks.ts` l.16-20, 69-72, 98-102):
  - 4-8 sparks, life 0.15-0.5 s, plus a 0.085 s glint.
  - Strength: parry 0.9, heavy 0.8, guard break 0.8, perfect block 0.65, block 0.4.
  - Silver cooling to grey-blue, 70 % opacity, size 0.1, one bounce.
- **Sand puffs off the defender's feet** (`clash-sparks.ts` l.26-32): perfect block 0.25, block 0.4, heavy 0.6, guard break both feet.
- **Kill dip:** exposure −6 % over 4 frames (`scene.ts` l.515-518).
- **Hurt flash on the HUD:** 120 ms red (`hud.ts` l.53).
- **Impact flash and ring** (`impact-fx.ts`): flash 0.14 s, ring 0.38 s. It's built but inactive (no row enables it).

## 2. Sound (reuse as is)
- **Sprite:** `src/assets/audio/sprite.ogg` + `.m4a`, 46.1 s. The offset table is in `src/audio/manifest.ts` l.4; licences in `src/assets/audio/SOURCES.json`.
- **Cues** (variant count, offset s): whoosh_light 4 (0.02), whoosh_heavy 4 (1.0), draw 2, hit_flesh 5 (3.071), hit_heavy 5 (6.491), hit_kick 4, block 4 (11.781), block_perfect 4, parry 6 (16.621), guard_break 4, kill 3 (25.921), roll 4, backstep 4, death_voice 4, flesh_cut 4, flesh_stab 2, flesh_tear 2, bone_crack 2, crowd_gasp 2, crowd_cheer 3, charge 2, charge_foe 2, whip 2, whip_raise 2, effort_voice 2 (muted). **No footsteps.**
- **Event → cue** (`src/fight/sound/cues.ts`; gain/room):
  - Swing start: light 0.12/0.12, heavy 0.18/0.18, kick 0.09 (l.119).
  - Hit: flesh 0.3/0.3, heavy 0.3/0.3, kick 0.3/0.2, bone_crack 0.4-0.65 on bloodless foes. A wrong-side guard adds block 0.3 at rate 0.8 (l.60-64).
  - Block 1/0.35; perfect block 0.55; parry 1/0.45; guard break 1 plus hit_flesh 0.55; posture break bone_crack 0.55 (l.49, 68-80).
  - Kill: death_voice 0.45 at +0.03 s, kill fall 0.65 at +0.65 s (or the finisher row's `at`), stab or cut 0.45, then crowd cheer or gasp (l.96-128).
  - Roll 0.12, backstep 0.09, charge 0.1, the foe's charge 0.07 rising ×1.6 over 0.9 s (l.113-122).
- **Mix** (`sound/feedback.ts` l.22, 94-116; `sound/audio-rules-defs.json`):
  - Variants rotate on a seed, never repeating back to back, with ±5 % pitch per play.
  - 8 voices; at most 4 cues per tick (8 on a kill).
  - Compressor −20 dB 5:1, attack 2 ms, release 150 ms, makeup ×2.1, then a convolver room.
- **Synth layers** (`sound/armfeel-sound.ts`): on a hit, a 280→130 Hz thump over 65 ms plus a noise burst; on a kill, a 1000→1500 Hz chime.
- **Other banks:** `src/assets/special-audio/`, `duel-audio/` (go, win, loss, tick), `arena-audio/` (ambience). Breathing exists but is off by default.
- **iOS:** unlock the AudioContext on touchend/click/keydown, never touchstart (`src/main.ts` ~l.100).

## 3. Reactions
- **Hurt clip:** one `Hit` clip for every zone and direction. The root rolls ±0.12 rad on a sine, flipped for left cuts (`characters.ts` l.929), and recoil pushes the root 0.045 m back (l.930).
- **Stun** = the move's `stagger` ticks: light 24 (0.4 s), kick 18 (48 against a guard), critical 40, charged ×1.5. Posture break and parried are 90 ticks (`duel.ts` l.561, `rules-defs.json`).
- **Guard reactions** (`characters.ts` l.145-153): BlockImpact 12 ticks, Parry 18, Deflected and guard break 36. Deflected starts at clip 0.35.
- **Knockback:** N steps × 3 m/s ÷ 60, applied within the tick (`duel.ts` l.576). Light 0.2 m, kick and critical 0.3 m, shove 0.7 m. No easing (inf).
- **Flinch** (`armfeel-defs.json`): lean 0.45 (0.9 on a kill), nudge 0.16, decay 12/s, hold 45 ms (80 on a kill). The player's own hero gets 0.25 of it.
- **Hit-stop:**
  - Live: all 0 except a melee special, 6 frames (`src/hit-stop.ts`, `main.ts` l.1656-1667).
  - **Before RV80:** hit 50 ms, heavy hit 90, block 30, heavy block 50, parry 70, guard break 90, posture break 150, kill 220, special 50.
  - Old extra frames: light 3, heavy 5, block 2, parry 11, guard break 5, kick 2, special 8.
- **Finisher slow-mo:** a 0.75× finisher clock over the 144-tick death (`scene.ts` l.484, 936-947); the sim isn't slowed. Finishers run 2.4-4.12 s (`finisher-defs.json`).
- **Camera kick on hit** (`camera-kick.ts` l.11-14, `hit-impact.ts` l.64-73):
  - Heavy or guard break: along 0.05, drop 0.06, hold 2 frames, settle 0.22 s.
  - Light: 0.02 / 0.012, settle 0.15 s.
  - Block 0.012 / 0.01 (heavy block 0.028).
  - Parry: 2 cm sideways plus a 0.07 jolt toward the attacker.
  - Sideways knock 2 cm (light) or 4 cm (heavy); a kick drops 0.1.
  - Roll: 8° tilt, 0.6 s, 8 cm dip.
- **Kill cam** (`camera.ts` l.188 + finisher rows): dolly push 0.38, slide 0.95, turn 0.6, plus a per-row side reveal. Settles at 1.5 s minimum; the tour starts 3 s after.

## 4. Weight
- **Blending:** no crossfades. Weights ease at exp 24/s; the combat clip fades in over progress×12 and out over (1−p)×10. Weights snap during the active blade and on a deflect (`characters.ts` l.847-852).
- **Swing clips are scrubbed by sim progress**, not played by timeScale. Contact sits at sim 0.35, mapped to clip 0.34 (light) or 0.48 (heavy) (`sim-bounds-defs.json` l.16-21).
- **Exo/Mixamo start offsets:** Attack 0.1346, Heavy 0.0727; contact at 0.4615 / 0.4727 (`hero-body-rows.json`). This removes the flat lead-in and the "snap".
- **Gait:** timeScale = speed ÷ (1.7 × stride) for walk, ÷ 5.2 for run, ÷ 0.75 for strafe; minimums 0.25 and 0.5. Speed is smoothed at exp 14 (l.829-837). Gait knots: 0 / 1.7 / 3 / 5.2 m/s.
- **No root motion;** the sim places the body (inf). Walk 3 m/s, run 5.2, no acceleration (`sim.ts` l.21). Guard ×0.35, exhausted ×0.7, leg wound ×0.85.
- **Turning:** a 0.3 rad snap at attack start, then ≤ 0.25 rad/tick in the windup (`duel.ts` l.394, 435). Locomotion turns instantly.
- **Roll:** 36 ticks at run speed (about 3.1 m), constant speed, i-frames on ticks 4-20, 30 stamina.
- **Commit:**
  - Feint allowed until tick: light 10, heavy 11, thrust 9, riposte 6.
  - Chain window 18 ticks; input buffer is the last 10 ticks.
- **Step-in** from windup tick 3: light 0.4, heavy 0.55, thrust 1.0 m (`duel.ts` l.439).

## 5. Whiff vs landed hit
- **Whiff:** one whoosh_light at 0.1 gain, rate 0.8. No fx, kick, stop, blood or flinch. Stamina is still spent at swing start, and a whiffed thrust stalls 10 extra ticks (`duel.ts` l.543).
- **Landed hit:** the impact cue (plus the synth thump), contact dots, blood, flinch, camera kick, knockback, the victim's stun, and later floor stains and wounds.

## 6. Other weight sources
- **Blade trail:** 7 samples at 0.12 opacity, #e8dfc8, from contact × 0.7 to contact + 0.18 (`characters.ts` l.946).
- **Wounds cost** 8 max stamina; a leg wound slows walking. A wound notice shows for 2.6 s.
- **The foe's charge** sound rises in pitch as the hold grows.
- **Things that do nothing today:** the armfeel weapon hold (40/60/80 ms) is a floor on an existing stop, so it's dead while stops are 0. There is no low-HP vignette (grade vignette is a constant 0.42). `charge-fx.ts` is a boss charge only.

**Suggested port order for V2:**
1. Sound
2. Camera kick + flinch + knockback
3. Contact dots + clash sparks + sand puffs
4. Blood spray + floor stains
5. Clip start offsets + scrubbing (if not already done)
6. Blade trail
7. Kill cam + 0.75× finisher clock
8. Hit-stop (Dom's call; V1 runs at 0)
