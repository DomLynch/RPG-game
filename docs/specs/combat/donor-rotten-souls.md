# Donor study: igorjohn/rotten-souls (MIT, port allowed)

Study date 2026-10-17. Lane: combat-sandbox. Design only; nothing here is built. Donor path on the VPS: `/mnt/frankendom-donors/igorjohn-rotten-souls` (upstream https://github.com/igorjohn/rotten-souls, HEAD `f5618705d4b5680ce2861308f7a17372822f37af`, 2026-09-21).

## 1. Licence and credit header (first, as asked)

MIT, `LICENSE` at the repo root, verbatim:

```
MIT License

Copyright (c) 2026 Igor John

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Credit header for every ported file (same pattern as `special-shards.ts`, which credits World of Claudecraft). Copy the licence text above to `public/licenses/rotten-souls.txt` in the same PR.

```ts
// Portions adapted from igorjohn/rotten-souls (f561870), src/core/audio.ts, Copyright (c) 2026 Igor John, MIT (public/licenses/rotten-souls.txt).
// Changed: <what>. (Name the donor file or files actually used; list the changes: recipes are rows, tick-scheduled, seeded noise, no Math.random.)
```

PR body line: `Donor: Rotten Souls (Igor John), what we took: <items>`.

NOT covered by the MIT grant, do not copy: `public/assets/audio/swings/*.mp3` (its own manifest says: ripped from a YouTube sound-effects video, "licenca padrao do YouTube, uso nao liberado explicitamente"), `public/assets/audio/cues/*.mp3` and `menu/tema-menu.m4a` (Lyria-generated, terms unclear), `public/assets/models/vharen.glb` (Higgsfield-generated). Textures/models from Quaternius/ambientCG/Poly Haven are CC0 but we do not need them. Take code only.

## 2. Headline findings (read this if nothing else)

1. The donor is small and its combat is simpler than ours. It has NO block/parry (its README lists "Block and parry, cut"), NO weapon trails, NO impact particles or sparks, NO damage numbers, NO directional hit reactions (a knockback velocity away from the attacker plus one hit clip), NO touch/mobile input, and a non-deterministic sim (`Math.random` boss choices, hit windows read from the AnimationMixer progress, wall-clock hit-stop). On player combat, hit detection, boss logic and camera we are ahead; there is little to port and what exists is mostly design confirmation.
2. Its real value to Dom's ask is the audio: `core/audio.ts` (1,223 lines) is a complete synthesised Web Audio kit (footsteps, boss footsteps, impact, swing, roar, lock-on chime, exhausted breath, gate stinger with rising cluster and sub drop, bell and toll partial banks, boss-music drone and drum) plus a method for calibrating levels against ambience by rendering in an `OfflineAudioContext`. Almost every recipe is 3-6 nodes and ports cleanly as data rows.
3. Weapon-special visuals: the donor gives almost nothing (see section 5). What it has is a telegraph scalar that drives emissive intensity, and a GPU-lifetime ember/flame sprite shader. Everything else (trails, hit sparks, shards) we already built (`specialTrail` rows, `clash-sparks.ts`, `special-shards.ts`, `impact-fx.ts`). The WoC port plan (`donor-woc-vfx-port.md`) remains the better VFX source.
4. "Synthesised audio" is honest for impact/steps/roar/music but NOT for the sword swing: the donor ships 9 sampled whooshes because it judged swept noise "does not imitate blade friction" (decisions.md, 2026-09-08). The synth swing in the code is only the fallback. Expect our synth whoosh to need the same human ear test; the recipe still gives a usable asset-free baseline (item 4).
5. Everything WebGPU/TSL (`postfx.ts`, `flame.ts`, `fog.ts`, `ember-material.ts`, `three/webgpu` imports) is non-portable as code. The ideas port; the code is re-written as GLSL `ShaderMaterial` or `onBeforeCompile`.

## 3. File-by-file (all of src/, 7,850 lines excluding style.css)

Verdicts: STRAIGHT = port with credit header and minimal edits; REWRITE = take the idea/numbers, re-implement for ticks/determinism/WebGL; N/A = not applicable.

### core/
| File | Lines | What it is | Verdict |
|---|---|---|---|
| audio.ts | 1223 | Whole audio engine: buses (sfx/ambient/music), shared noise buffer, positional panners (equalpower), ambient wind, brazier crackle scheduler, gate hum, `footstep(weight)`, `bossFootstep`, `swing` (sample bank, synth fallback), `impact(power)`, `roar`, `lockOn`, `setExhausted`, gate stinger synth, `synthToll`, boss music drone + drum, `uiConfirm` bell, `pauseToggle`. Header documents the rule "sample when present, synth as reserve, game never breaks if a file is missing". | REWRITE as rows (items 1-5). The node graphs are straight-copy shapes; the literals become data rows (our rule), `Math.random`/`setTimeout` become seeded draws and context-time scheduling. Skip the sample banks. |
| input.ts | 227 | Key/mouse/gamepad to 6 actions with a 0.45 s command buffer, `consume()` clears the buffer (see player.ts note on ordering), pointer lock fallback. | N/A. We have a phone-first input. Only the bug lesson is useful: check stamina BEFORE `consume` or the click is eaten (verify our buffer does this; decisions.md 2026-09-08). |
| loop.ts | 110 | Staged loop (input, simulate, animate, camera, render), dt clamp 1/20, `timeScale` for hit-stop, hidden-tab MessageChannel tick in dev. | N/A. We have a fixed tick; wall-clock `timeScale` hit-stop is exactly what we must not do. |
| physics.ts | 99 | Rapier world, collision layers, fixed 1/60 accumulator (max 4 steps), character controller (autostep, snap). | N/A. No Rapier. Layer/bitmask idea is irrelevant to our sim. |
| postfx.ts | 199 | TSL `RenderPipeline`: scene pass + GTAO + bloom + split-tone grade (cool shadows, warm highlights) + vignette + film grain. | N/A as code (TSL/WebGPU). Idea (split-tone grade, grain weighted to shadows) already covered by our `colour-grade.ts`. |
| quality.ts | 177 | Three quality profiles; auto step-down only when frame interval stays over 1.4x budget for 3 s after a 5 s settle; never steps up; manual pick turns auto off. | REWRITE-light, optional. Good mobile-first pattern if we lack a step-down governor (not audited here). Not in the top 8. |
| renderer.ts | 176 | WebGPU renderer with WebGL2 fallback, resolution governor, manual node-frame tick. | N/A. |
| assets.ts | 71 | Loader with progress. | N/A. |
| menu-music.ts | 99 | `<audio>` menu track armed for first gesture. | N/A (asset, Lyria). |

### entities/
| File | Lines | What it is | Verdict |
|---|---|---|---|
| player.ts | 527 | State machine (idle/walk/run/dodge/attack/hit/dead). Stamina: max 110, regen 26/s after 0.55 s delay (0.2 s if drained to zero), run drains 12/s, "spent" flag blocks sprint until 30%. Light (20 st, clip x2.4, window 0.26-0.46 of clip) and heavy (34 st, window 0.42-0.62). Light chain to 3, cancel into dodge or next light only after the damage window. Dodge: 0.52 s, peak 13.5 m/s decelerating curve `peak*(1-t)*(1-0.35t)`, i-frames 0.04-0.42 s, cost 22, back-step when no direction. After a hit: 0.42 s stagger, 0.55 s i-frames, 3.2 m/s knockback away from attacker. Lock-on: nearest candidate scored `distance*(1.6-dot)`, range 26. Stride sound by distance (1.5 m walk, 2.05 m run). | N/A mostly. We already have stamina, roll i-frames, chain, lock-on, and ours are tick-based. Two ideas to verify against our rows (not port): the "spent until 30%" re-arm threshold and the post-hit i-frame grace so combos cannot chain-kill. The stride-by-distance footstep trigger is item 3. |
| combat.ts | 176 | `AttackDef` rows (damage window as FRACTION of clip so heavy = same clip slower), `sweepHit` = one sphere in front of the attacker at chest height vs target sphere, `AttackRun`. | N/A. Our swept blade segment from baked paths (`blade.ts`) is strictly better. The donor itself says per-bone boxes "do not change the feel". Window-as-fraction is already how our clips work. |
| boss.ts | 415 | Boss FSM (dormant/idle/approach/attack/hit/roar/dead). Two phases (50% HP, one-shot roar with invulnerability), `PHASES` table (speed, damage, cooldown range, comboChance). Three attacks in code `BOSS_ATTACKS` (overhead 0.62x, sweep, thrust: reach/radius/lunge/recovery). Pick = distance band, `Math.random() < 0.58`. Poise 34 accumulated damage then 0.32 s stagger. Turn rate falls from 3.4 to 0.5 rad/s during an attack so rolling sideways works ("the number that decides if the fight is fair"). `telegraph` getter 0..1: rises to 1 at window start, decays after. | REWRITE the telegraph scalar only (item 7). The rest: moves are code, not data, selection is `Math.random`, phases are 2 hard-coded rows; our `boss-phase-defs.json`, `bosses.json` and `special-boss-timing.ts` are ahead. Design confirm: attack turn-rate clamp. |
| camera-rig.ts | 218 | Shoulder camera; lock-on yaw/pitch/distance solve, ray-clamped against world (Rapier), `punch(strength)` = random jitter for 0.28 s, scripted cinematic with smoothstep. | N/A. Shake uses `Math.random` per frame and a flat jitter; our `camera-kick.ts` (directional shove + settle, rows) is better and deterministic. |
| character.ts | 195 | Kinematic capsule, health/stamina, `turnTo`. | N/A (Rapier). |
| appearance.ts | 151 | Procedural greatsword from 5 boxes attached to the hand bone with bone-scale compensation; boss and mannequin materials. | N/A. Only lesson: ember colour map as emissive (see ember-material). |
| armor.ts | 429 | Tiled PBR armour library on TSL node materials. | N/A. |
| ember-material.ts | 40 | Emissive derived from the colour map: `warmth = (r-b)*r`, `smoothstep(.14,.42)` mask times intensity uniform. | REWRITE tiny (item 7 note): a GLSL `onBeforeCompile` chunk, 6 lines. |
| anim/rig.ts | 181 | AnimationMixer wrapper with TWO actions per clip so the same clip can cross-fade into itself (chained swings snapped the hand 125 cm otherwise). | N/A, same idea is solved on our side; mention only if chain-to-same-clip pops reappear. |

### world/
| File | Lines | What it is | Verdict |
|---|---|---|---|
| arena.ts | 488 | Courtyard of Ashes assembled from the parametric kit: gothic bays, ruined bays, buttresses, ring floor, stairway, rubble. | N/A. Procedural (all geometry code; CC0 textures are the only art). Nothing for a sand duel arena. |
| kit/geometry.ts | 198 | Box/extrude helpers with world-unit UVs. | N/A. |
| kit/fog-gate.ts | 156 | Fog-gate shader (TSL). | N/A. |
| layout.ts | 102 | Arena constants. | N/A. |
| lighting.ts | 215 | Moon directional + pooled brazier point lights handed to nearest braziers (avoids shader recompiles). | N/A. The pooled-lights trick is already how we avoid recompiles. |
| materials.ts | 98 | Texture-set loader. | N/A. |
| fx/flame.ts | 237 | Brazier flame (teardrop mask + 3D noise scroll, two sprite layers) and sparks (lifetime `fract(time/life + offset)`, drift minus gravity, all computed in the vertex stage, zero CPU per frame). `SpriteNodeMaterial` + `InstancedBufferAttribute` for origin (the sprite ignores instance matrices). | REWRITE to GLSL (item 8). |
| fx/fog.ts | 38 | Two-layer exponential-squared fog (TSL `fogNode`). | N/A (arena fog, WebGPU path). |

### ui/, debug/, root
| File | Lines | Verdict |
|---|---|---|
| ui/hud.ts | 217 | Bars with a delayed "damage trail" layer (CSS transition), lock-on marker projected to screen. N/A (we have a HUD). |
| ui/pause.ts | 91 | N/A. |
| debug/gui.ts, screenshot.ts, stats.ts, materiais-preview.ts | 133, 120, 94, 260 | N/A. |
| game.ts | 362 | Glue: callbacks (`onSwing`, `onHitLanded`, `onHurt`) fan out to audio, camera punch and hit-stop. Hit-stop is `freeze(seconds)` against `performance.now()` with timeScale 0.05; durations: landed light/heavy 0.06-0.075 s, took a hit 0.11 s. Camera punch 0.35 on landing, 0.7 when hurt, 0.8 on boss hit, 1.1 on phase change. | N/A as code. Numbers are a sanity check against `hit-stop-defs.json`: ours already hold longer (100 ms+ per hit), so no change. |
| main.ts | 328 | Boot, stages, lock-on HUD projection, look-dev GUI, the user-gesture audio start (`audio.start()` inside the start click). | N/A. Lesson only: the AudioContext is born inside the first gesture; we already do that. |
| style.css | 808 | N/A. |

Docs read: README.md, CLAUDE.md (project brief), PROMPT.md, docs/decisions.md (449 lines), docs/como-fazer-um-jogo-assim.md, docs/perf.md, docs/art-direction.md, docs/estado.md. Useful decisions: poise tuned 62 to 34 so the boss reacts; boss turn-rate clamp; command buffer 0.28 to 0.45 s; stamina checked before consuming the buffered command; all sound events measured offline (see item 6); boss footstep proven distinct by numbers.

## 4. Comparison with our engine

| Topic | Donor | Ours | Call |
|---|---|---|---|
| Stamina / recovery | flat regen with delay; spent flag to 30% | stamina + posture + guard | keep ours; check the 30% re-arm and post-hit grace as tuning candidates only |
| Light/heavy/combo | 2 attacks, chain 3, cancel after window | per-weapon clips, blade paths | ours |
| Dodge i-frames | 0.04-0.42 s window, decelerating curve | roll i-frames in sim | ours |
| Block/parry | none (cut) | guard, perfect block, parry, riposte, kick | ours |
| Hit detection | sphere vs sphere, per-frame, animation-progress windows | swept blade segment vs capsule from baked paths, tick-exact | ours; donor confirms that precision is not what sells hits |
| Hit reaction | velocity shove away, one clip | posture, directional recoil rows (armfeel) | ours |
| Hit-stop | wall-clock, `timeScale` 0.05 | presentation hold in ms by contact row, sim untouched | ours (must not adopt donor's) |
| Camera shake | `Math.random` jitter 0.28 s | directional shove + settle rows | ours |
| Damage numbers | none (bar trail only) | n/a | none to take |
| Boss AI | code FSM, random pick, 2 phases | data rows, phases, specials | ours |
| Trails / impact VFX | none | `specialTrail`, sparks, shards, impact flash/ring | ours |
| Combat audio | synth + 9 sampled whooshes + 3 Lyria cues | sample sprite + partial synth fallback + armfeel layers | donor's synth recipes fill our gaps |
| Determinism | none (Math.random, wall clock, rAF dt) | ticks only, seeded | donor code needs rewrite everywhere it touches time/RNG |
| Mobile/touch | none (pointer lock + keyboard + gamepad) | phone-first | donor has nothing |

## 5. Answers to the five lettered questions

(1) Player combat: nothing to port beyond tuning sanity checks (section 3, player.ts).

(2) Hit detection / feel: the donor deliberately uses one sphere; Rapier is only the character capsule and camera ray. Hit-stop, shake and feel are 12 lines in game.ts. No screen effects other than vignette/grain in the post pipeline (constant, not hit-driven). No damage numbers.

(3) Boss: moves, phases and tuning are code. The model is generated (Higgsfield rig, 47.5 credits) with CC0 Quaternius clips baked onto it in Blender; the sword is five boxes; the arena is procedural kit plus CC0 PBR textures. Procedural = arena geometry, flames, sparks, fog, sound. Assets = both GLBs, textures, HDRI, menu track, 3 Lyria cues, 9 sword samples. The only boss telegraph beyond animation is the ember glow (item 7).

(4) VFX: no trails, no impact particles. Ambient fire + sparks are TSL sprites; post is TSL. Portable: the math (teardrop flame mask, fract-lifetime sparks, warmth-mask emissive). Not portable: the code (WebGPU `SpriteNodeMaterial`, TSL nodes). Our renderer is plain WebGL `three`, so port as GLSL.

(5) Audio: see items 1-6; this is the donor's strongest part.

## 6. Determinism rules for every port

- Audio is presentation (our audio-rules note: no sim file reads it, digest unaffected), but triggers must come from sim `CombatEvent`s and tick numbers, never from callbacks in an animation or wall clock.
- Replace `Math.random()` with the existing `seeded(BASE_SEED)` stream already in `feedback.ts`; give each recipe its own stream so adding a layer never shifts the cue variants (the breath module already does this). Replace the donor's `makeNoiseBuffer` (`Math.random`) with a seeded one so offline renders (clips, tests) are byte-stable.
- Replace `window.setTimeout` (crackle, boss drum, node cleanup) with `context.currentTime` scheduling and `onended` cleanup.
- Replace `performance.now()` hit-stop and `loop.timeScale` entirely; we keep our presentation hold.
- No sim file imports any of these. Put recipe numbers in `*-defs.json` + manifest through `core/registry.ts` (Dom's data-layer rule; `npm run check:as-data -- --gate`).

## 7. Ranked port list (8 items)

Effort is hours including rows, tests and one Mac look/listen check. Sketches are adapters, not final code.

### 1. Layer-recipe synth engine (the foundation)
- Source: `core/audio.ts` shapes: `makeNoiseBuffer`, tone-with-pitch-sweep, noise-through-filter-with-sweep, exponential envelopes, partial bank, `stopAll`. Lines 410-470, 480-560, 1190-1223.
- Target: new `src/fight/sound/synth-voice.ts` + `synth-defs.json` + `synth-defs.manifest.json`; wire from `feedback.ts` where `synth()` and `armfeelPlay()` are today (extend `Layer` in `armfeel-sound.ts` instead of a second type).
- Effort: 8 h.
- Why: one data-driven schema turns every later item into rows. It generalises `armfeel-sound.ts` (tone/noise only) with sweep, filter type, Q, attack/decay, partial lists.
```ts
// Layer = tone | noise | partials, all with a time envelope; rows live in synth-defs.json
type Env = { attack: number; decay: number; peak: number };
type Layer = { at: number } & Env & ({ kind: 'tone'; wave: OscillatorType; from: number; to: number }
  | { kind: 'noise'; filter: BiquadFilterType; f0: number; f1: number; q: number; rate?: number }
  | { kind: 'partials'; base: number; ratios: number[]; shares: number[] });
export function playRecipe(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, rec: readonly Layer[], t0: number, rnd: () => number, power = 1) {
  for (const l of rec) {
    const t = t0 + l.at, g = ctx.createGain(), end = t + l.attack + l.decay;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(l.peak * power, t + l.attack); g.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const src of l.kind === 'tone' ? [osc(ctx, l, t, end)] : l.kind === 'noise' ? [hiss(ctx, l, noise, t, end, rnd)] : bells(ctx, l, t, end)) { src.connect(g); }
    g.connect(out); // each source: start(t) / stop(end + .05); onended disconnects (the stopAll cleanup)
  }
}
```

### 2. Special charge and release: rising cluster, sub drop, crash, roar
- Source: `audio.ts` `synthGateStinger` (lines ~800-870: four detuned saws rising to a hit time under a rising lowpass, then a 120 Hz to 26 Hz sine drop and a lowpass-falling noise crash), `roar` (three saws at ratios 1/1.5/2.02, falling pitch, lowpass 900 to 260, air band), `drum` (sine 78 Hz to 34 Hz).
- Target: `src/fight/sound/synth-special.ts` + rows `specialSynth` keyed by special id (schools already exist in `special-schools.json`); wired where `playSpecial` is called today (`fight/sound/special.ts`).
- Effort: 7 h.
- Why (Dom's ask): asset-free wind-up and release for every special. The rise length is the cast lead in sim ticks (the cue's own "hit" time = release tick / 60), exactly the existing contract "cast at 0, payoff on the strike". Per-school variation is rows: saw cluster tuning, filter ceiling, drop depth.
```ts
// rows: { id:'quake', rise:{ freqs:[110,116,147,220], detune:[0,12,-9,7], from:.75, lpFrom:300, lpTo:2400 }, drop:{ f0:120, f1:26, sec:1.5, peak:.3 }, crash:{ lp0:5200, lp1:360, sec:2, peak:.17 } }
export function specialCue(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, row: SpecialSynthRow, castAt: number, leadTicks: number) {
  const hit = castAt + leadTicks / 60;                       // sim ticks, never wall clock
  row.rise.freqs.forEach((f, i) => {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.detune.value = row.rise.detune[i]!;
    o.frequency.setValueAtTime(f * row.rise.from, castAt); o.frequency.exponentialRampToValueAtTime(f, hit);
    lp.frequency.setValueAtTime(row.rise.lpFrom, castAt); lp.frequency.exponentialRampToValueAtTime(row.rise.lpTo, hit);
    g.gain.setValueAtTime(0.0001, castAt); g.gain.exponentialRampToValueAtTime(0.075, hit); g.gain.exponentialRampToValueAtTime(0.0001, hit + 1.6);
    o.connect(lp).connect(g).connect(out); o.start(castAt); o.stop(hit + 1.8);
  });
  playRecipe(ctx, out, noise, [dropLayer(row.drop), crashLayer(row.crash)], hit, seeded(row.seed));   // item 1
}
```
Caveat: if the special is interrupted, `specialCut()` in `feedback.ts` already stops the voice; register these sources in its `sources` set so the cut works.

### 3. Body recipes: impact(power), footstep(weight), boss footstep, stride trigger
- Source: `audio.ts` `impact` (highpass crack 1200 Hz 90 ms + sine thud 150+60p to 48 Hz), `footstep` (bandpass noise 900-350w Hz plus a sine body 168-26w to 72 Hz), `bossFootstep` (sub thud 88 to 31 Hz, stone band 190-280 Hz, dust lowpass 2200 to 420 Hz tail 0.72 s), `bossStride` (distance accumulator 3.8 m; ignore jumps over 1.5 m), `player.ts` stride 1.5/2.05 m.
- Target: rows `impact`, `footstep`, `bossStep` in `synth-defs.json`; `feedback.ts` calls them for contacts our sprite lacks and for big bodies (boss, Centurion); stride accumulator in the scene's tick loop using sim positions (integer ticks, so it is replay-stable).
- Effort: 5 h.
- Why: instant coverage for new creatures or weapons with no recorded cue; the boss recipe also doubles for a "heavy landing" (jump slam, quake). Measured by the donor: boss step 11 dB over wind in its band, median 70 Hz, 3.4x longer than the player step.
```ts
const IMPACT: Layer[] = [
  { kind: 'noise', filter: 'highpass', f0: 1200, f1: 1200, q: 0.7, at: 0, attack: 0.001, decay: 0.09, peak: 0.3 },
  { kind: 'tone', wave: 'sine', from: 150, to: 48, at: 0, attack: 0.001, decay: 0.3, peak: 0.42 },   // from = 150 + power * 60
];
export function impactCue(fb: Synth, power: number, tick: number) {   // power from hit-impact.ts tier: half .5, full 1
  const rec = IMPACT.map((l, i) => i === 1 ? { ...l, from: 150 + power * 60 } : l);
  fb.play(rec, fb.timeOfTick(tick), power);                               // seeded stream per recipe
}
export const strideTick = (acc: number, dx: number, dz: number, step: number): [acc: number, fire: boolean] => {
  const d = Math.hypot(dx, dz); if (d > 1.5) return [0, false];            // teleport / respawn is not a step
  return acc + d >= step ? [0, true] : [acc + d, false];
};
```

### 4. Weapon whoosh by swept band, per weapon and per special
- Source: `audio.ts` `synthSwing` (white noise through a Q 2.4 bandpass sweeping exponentially 520 to 2400 Hz light, 300 to 1500 heavy; attack to 35% of the length, then exponential decay; 0.26 s light, 0.42 s heavy) plus the sample player's pitch/gain split (heavy rate 0.82, light 1.05, +-6% jitter, never repeat the last variant).
- Target: rows `swing.<weaponKind>` and `swing.<specialId>` in `synth-defs.json`; `feedback.ts` `synth('swing')` is replaced for any weapon with a row. Our sprite stays default; rows are an override and the fallback while the sprite decodes.
- Effort: 4 h.
- Why: lets a flaming or heavy special have its own air without recording anything. Honest limit: the donor's own author replaced it with samples by ear; plan a listening pass with Dom and keep the sprite as default if he rejects it (he has rejected one synth voice before).
```ts
// row: { id:'swing.greatsword', sec:.42, f0:300, f1:1500, q:2.4, peak:.34, attackPct:.35 }
export function swingLayer(r: SwingRow, heavyness = 1): Layer {
  return { kind: 'noise', filter: 'bandpass', f0: r.f0 * heavyness, f1: r.f1 * heavyness, q: r.q,
           at: 0, attack: r.sec * r.attackPct, decay: r.sec * (1 - r.attackPct), peak: r.peak };
}
export const swingFor = (move: string, weapon: string, skill?: string) =>
  rowOr(`swing.${skill ?? ''}`, `swing.${weapon}`, 'swing.default');    // special row, else weapon row, else default
// start at the tick the SIM says the blade begins to move (blade table `age` 0), not at the animation callback
const when = (startTick: number) => ctx.currentTime + (startTick - nowTick) / 60;
```

### 5. Metal ring bank: block, parry, guard break, special release chime
- Source: `audio.ts` `uiConfirm` (four sine partials 196/293/431/622 Hz, non-harmonic, decays 2.2 to 1 s, plus a 96 to 44 Hz sine thud and a 2.6 kHz noise strike), `synthToll` (ratios 1, 1.51, 2.02, 2.67, 4.07 with shares 1/.5/.32/.18/.09, slight downward drift, decay shorter for weaker partials).
- Target: rows `ring.parry`, `ring.block`, `ring.guardBreak`, `ring.specialRelease` in `synth-defs.json`; replaces the 3-partial arrays in `feedback.ts` `synth('parry'|'steel')` (`[940,1491,2273]`, `[620,1037,1613]`). Sparks stay in `clash-sparks.ts`; sound and sparks already key on the same events.
- Effort: 4 h.
- Why: non-harmonic partial sets with per-partial decay read as metal; the existing fallback is flat-decay. Also useful for a one-shot "charge complete" chime on heavy attacks.
```ts
// row: { id:'ring.parry', base:940, ratios:[1,1.59,2.42], shares:[1,.5,.3], decay:.72, drift:.995, thud:{ f:[96,44], sec:.4, peak:.34 } }
export function ringLayers(r: RingRow, power: number): Layer[] {
  const rings = r.ratios.map((k, i): Layer => ({ kind: 'tone', wave: 'sine', from: r.base * k, to: r.base * k * r.drift,
    at: 0, attack: 0.004, decay: r.decay * (0.5 + 0.5 * r.shares[i]!), peak: 0.2 * r.shares[i]! * power }));
  return r.thud ? [...rings, { kind: 'tone', wave: 'sine', from: r.thud.f[0]!, to: r.thud.f[1]!,
    at: 0, attack: 0.002, decay: r.thud.sec, peak: r.thud.peak * power }] : rings;
}
// event mapping stays in cues.ts (Blocked / Parried / GuardBroken); this only supplies the sound
```

### 6. Offline loudness harness (levels measured, not guessed)
- Source: `docs/decisions.md` 2026-09-09 entries and the `isOffline()` branch in `audio.ts`: render every cue in an `OfflineAudioContext` and record RMS, 50 ms peak RMS, absolute peak, duration above -40 dB, centroid, band energy; compare each cue against ambience IN ITS OWN BAND (the lock-on chime measured 9.5 dB under wind in its band while looking fine in broadband).
- Target: `tests/synth-loudness.test.ts` (+ small `src/fight/sound/measure.ts`); runs on CI (no speaker needed), asserts band-relative levels from rows (`audio-rules-defs.json` gets `bandMarginDb` rules).
- Effort: 6 h (needs a seeded noise buffer first; then offline renders are byte-stable).
- Why: with a synth kit the main risk is mix drift; this makes "hit sits 5 dB under guards" (cues.ts comment) a test.
```ts
export async function measure(rec: readonly Layer[], seconds = 1.5, rate = 44100) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate), noise = seededNoise(ctx, 731);
  playRecipe(ctx, ctx.destination, noise, rec, 0, seeded(731));
  const d = (await ctx.startRendering()).getChannelData(0), win = Math.floor(rate * 0.05);
  let peakRms = 0, abs = 0; for (let i = 0; i + win <= d.length; i += win) { let s = 0; for (let j = 0; j < win; j++) { const v = d[i + j]!; s += v * v; abs = Math.max(abs, Math.abs(v)); } peakRms = Math.max(peakRms, Math.sqrt(s / win)); }
  return { peakRms, abs };
}
// test: expect(db(await measure(IMPACT)) - db(await measure(WIND_BAND))).toBeGreaterThan(MARGIN_DB)
```

### 7. Telegraph scalar and ember glow on the weapon
- Source: `boss.ts` `telegraph` getter (0..1 ramp to the damage-window start, then linear fall), `game.ts` (`emissiveIntensity = base + telegraph * 5`), `ember-material.ts` (emissive = colour map times a warmth mask `smoothstep(.14,.42,(r-b)*r)`).
- Target: `src/fight/special-telegraph.ts` (pure function of the move's tick, windup ticks and release tick from `special-timing.ts` / `charge-timing.ts`), used by `charge-fx.ts` to drive the blade/weapon emissive and a small halo; WebGL: `MeshStandardMaterial.emissiveIntensity` per weapon material, or a single `onBeforeCompile` chunk for the warmth mask.
- Effort: 3 h.
- Why (Dom's ask): a weapon that charges visibly during the windup and flares on release, with zero assets, tied to the sim tick so it is replay-stable (the donor reads animation progress; we read ticks).
```ts
// pure; row: { id, tint:'#ff8a2a', base:.6, peak:5 } in special-look rows
export function telegraph(tick: number, startTick: number, releaseTick: number, endTick: number): number {
  if (tick < startTick || tick > endTick) return 0;
  if (tick <= releaseTick) return (tick - startTick) / Math.max(1, releaseTick - startTick);   // charging: 0 -> 1
  return 1 - (tick - releaseTick) / Math.max(1, endTick - releaseTick);                         // flare: 1 -> 0
}
export function glow(mat: THREE.MeshStandardMaterial, row: GlowRow, t: number) {
  mat.emissiveIntensity = row.base + row.peak * t; mat.emissive.set(row.tint);   // set once; per-frame only the intensity
}
```

### 8. GPU-lifetime ember and flame sprites in GLSL (flaming blade, braziers, charge embers)
- Source: `world/fx/flame.ts` `buildSparks` (per-instance origin, drift, phase; `life = fract(t/LIFE + phase)`; position = origin + drift*age - (0, 0.3 age^2, 0); size = `sin(pi*life)*0.05`; radial core falloff) and `buildFlames` (teardrop mask `smoothstep` of `taper = (1-y)^0.72`, scrolling 3D noise wobble, core-to-edge colour mix, flicker from two sines).
- Target: `src/fight/ember-fx.ts` (pattern identical to `special-shards.ts`: instanced buffers, pool built at scene creation, a `ShaderMaterial`); uniform `uTick` set from the sim tick (NOT the clock) so stills and clips are repeatable; noise via a small GLSL 3D simplex (public domain) replacing TSL `mx_noise_float`.
- Effort: 8 h (shader port + two looks + pooling + a still at 375 wide for the PR).
- Why: zero CPU per frame embers and a real flame shape for fire specials and weapon-on-fire states. `SpriteNodeMaterial`/TSL do not exist in our renderer, so this is a re-implementation of the maths only. Keep additive blending OFF where it hides the pose (see `clash-sparks.ts` "readable brutality").
```ts
// vertex: float life = fract(uTick / 60.0 / uLife + aPhase); float age = life * uLife;
//         vec3 p = aOrigin + aDrift * age - vec3(0., .3 * age * age, 0.); float s = sin(3.14159 * life) * uSize;
//         gl_Position = projectionMatrix * (viewMatrix * vec4(p, 1.) + vec4(position.xy * s, 0., 0.));   // camera-facing quad
// fragment: float core = smoothstep(.5, .03, length(vUv - .5)); gl_FragColor = vec4(mix(uEdge, uCore, core) * uGain, core);
export function createEmberFx(scene: THREE.Scene, row: EmberRow) {
  const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1)); const n = row.count;
  g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aDrift', new THREE.InstancedBufferAttribute(driftsFrom(row, seeded(row.seed)), 3)); g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases(n, seeded(row.seed + 1)), 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uTick: { value: 0 }, uLife: { value: row.life }, uSize: { value: row.size }, uCore: { value: new THREE.Color(row.core) }, uEdge: { value: new THREE.Color(row.edge) }, uGain: { value: row.gain } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
  return { at(x: number, y: number, z: number) { /* write aOrigin for a burst */ }, setTick(t: number) { mat.uniforms.uTick!.value = t; } };
}
```

Total effort for the eight items: about 45 h (item 1 gates 2-6; 7 and 8 are independent).

## 8. What I would not take, and why

- Swing samples, Lyria cues, menu track, Vharen GLB: licence unclear or generated (section 1).
- Rapier, character controller, ray-clamped camera: we have our own sim.
- Sphere hit test, animation-progress damage windows: strictly weaker than our baked blade paths.
- Boss FSM and its `Math.random` picks: weaker than our data-driven bosses and seeded RNG.
- Wall-clock hit-stop and `loop.timeScale`: breaks determinism and replay; we hold the presentation clock instead.
- TSL post-processing (GTAO, bloom, grade): WebGPU path; our grade is separate.
- Input and HUD: nothing for phone-first.

## 9. Follow-ups worth a one-line check by the owning lane

- Input: verify our command buffer checks stamina before consuming the buffered action (donor lost clicks to that order; fixed in its decisions.md 2026-09-08).
- Tuning candidates from the donor's playtests (not ports): spent-stamina re-arm threshold (30%), post-hit i-frame grace (0.55 s), boss turn rate during a strike (0.5 rad/s vs 3.4 free). Compare against our rows before touching anything.
- Quality step-down governor: if we lack one, `core/quality.ts` is a clean model (only steps down, 5 s settle, 3 s over 1.4x budget).
