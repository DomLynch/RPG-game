# Donor study: leotgo/Bright Souls (Unity C#, Dark Souls clone)

**LICENCE RULE (read first).** The repo has no LICENSE file, so treat it as all-rights-reserved. Its README says "free to view, copy and modify", but that is not a licence grant we can rely on. This document describes DESIGN, data shapes, numbers and algorithms in our own words. No code is copied or transliterated, and our implementation is written from this description. PR body line: "Donor: Bright Souls, design ideas only (clean-room)".

Donor path: `/mnt/frankendom-donors/leotgo-bright-souls`. Source: 95 C# files, about 5,150 lines.

## 0. Honest scope: what this repo is and is not

It is a small, unfinished student-style project. Much of the combat core is stubbed or commented out:

- Damage application is commented out. The attack data row holds only two lists of effects, and the one effect that exists subtracts a flat health amount.
- Poise damage, block stamina damage and the lock-on target switch are commented out.
- **The advertised "Dynamic Difficulty Adjustment" and "player profile modelling" are NOT implemented in code.** The README claims them. The `Telemetry` folder only saves health, stamina, position and rotation. A grep for difficulty, adapt and profile found nothing in the gameplay or AI code.
- All timing numbers (windup, active, recovery, i-frames) live in Unity Animator assets, which are not in this repo. We cannot read them.

What it does give is a clean, small architecture and a handful of tuned constants. Below, each item says what is real and what is only a pattern.

## 1. Attack data model

**Summary.** The model has three layers.
- **Weapon:** a container holding a list of attacks and one hitbox. It has a weapon type, a slot mask and a "current attack" pointer.
- **Attack:** a name, an animator trigger string and a data object. Attack names are an enum grouped in blocks of 100 per weapon family (sword and shield, longsword, knife), for example Longsword Light, Heavy and Special.
- **Data object:** two lists, "effects applied to the source" (self cost) and "effects applied to the target" (hit effect). An effect is a small polymorphic object with an apply step. The only concrete ones are "damage health" and an unfinished over-time effect (duration plus tick time).

The decision to attack is a command with a pure `canExecute` check. Attack needs stamina above zero and the player must not be dodging, blocking, jumping, staggered or dead. Dodge needs the same checks plus not attacking. Block needs not attacking. Note the stamina gate is "greater than 0", not "at least the cost", so a swing can drain stamina below zero. That is the Souls feel.

Windup, active and recovery are not in data. They come from where animation events sit on the clip.

**Key numbers.** Dodge stamina cost 20. Attack cost is not present in code.

**Our data row (JSON + loader).** We should keep the idea of effects lists on the attack, but express timing as explicit frames, since our sim is a deterministic 60 Hz and cannot read animator time.

```json
{ "id": "mace_special_1", "weapon": "maul", "windupF": 18, "activeF": 6, "recoverF": 24,
  "cost": [{"kind":"stamina","amount":28}],
  "onHit": [{"kind":"damage","amount":14},{"kind":"poise","amount":40},{"kind":"hitstop","frames":4}],
  "events": [{"f":18,"do":"hitboxOn"},{"f":24,"do":"hitboxOff"},{"f":18,"do":"trail","id":"maul_arc"}] }
```

Loader: validate against the effect-kind registry. Unknown kinds fail at load. This is the useful bit for WEAPON-COMPATIBLE specials: a special is one row that points at a weapon family and reuses that family's clip, so it is "compatible" by data, not by code.

## 2. Hit detection and damage resolution

**Summary.** Each weapon and each character body carries a trigger volume. A volume is either a "hitbox" (offensive) or a "hurtbox" (defensive). A hitbox only checks while switched on. When it overlaps a hurtbox whose owner is a different object, it records the hit once per activation (a per-swing "already hit" list, cleared whenever the box toggles) and sends a "detect hit" message. The attack then does a faction check: same faction means ignore (friendly fire off). Otherwise it calls the target's "got hit" handler with the attack, which carries the source and the data object.

The target's handler order for the player is:
1. If the IFrames flag is set, ignore the hit entirely.
2. Compute the hit direction from attacker to victim and feed it to the animator (two floats) so the hit reaction clip picks a direction.
3. If blocking and the attacker is inside the block cone, it is a block. If stamina is zero, it is a block break, otherwise a plain block hit.
4. Otherwise it is a normal hit, if the target is not dead.

**Key numbers.** Maximum block angle 100 degrees (so a 200 degree cone, wide and forgiving). Blocking slows movement to 0.5x.

**Our row.**

```json
{ "id":"guard_default", "coneDeg":100, "moveMul":0.5,
  "onBlock":{"staminaFromHit":true}, "onBreak":{"poise":"max","dmgMul":0.2} }
```

Worth taking: the "per-swing already-hit set cleared on toggle" (we likely have it; check multi-hit specials), and the hit direction as an input to the reaction clip choice.

## 3. Stamina, lock-on, dodge i-frames, backstab and riposte

**Stamina.** Value clamps 0 to max. Any decrease restarts a delay timer and stops regeneration. After the delay, regen runs at a fixed rate. Blocking multiplies the regen rate down. Being staggered resets the delay. Regen stops when full.
- Numbers: max 100, regen 18 per second, delay 2 s, blocking regen 0.35x.
- Row: `{ "max":100, "regenPerS":18, "delayS":2, "blockRegenMul":0.35, "staggerResetsDelay":true }`.
- Improvement for us: "blockRegenMul" and "stagger resets delay" if we do not already have them.

**I-frames.** A status flag set (Staggered, IFrames, Unstoppable). A tiny animator hook switches a chosen flag on at a normalised clip time and off at another. So i-frames are a window on the dodge clip, authored as two numbers (start and end fraction of the clip), not a code constant.
- Row: `{ "clip":"roll", "status":"iframes", "fromT":0.1, "toT":0.6 }`. In our sim use frames: `fromF`, `toF`. The shape is the lesson: a generic "status window on a clip" row that can also grant Unstoppable (super-armour) during a special's windup. That is directly useful for specials.

**Dodge.** Reads a direction from input, defaults to backwards if none, turns the body to face the dash and plays an animation-driven (root motion) move. Motion source switches between "animation driven" and "input driven".
- Improvement: the dodge-bonus-poise idea (below, section 4).

**Lock-on.** A trigger sphere around the player collects candidate characters. Candidates are filtered by dead and on-screen (renderer visible). The body smoothly turns toward the target on the flat plane at turn speed 7.5 (lerp factor per second), except while dodging. The target-switch picks the candidate nearest screen centre on the side the stick is pushed (the code for this is commented out, but the algorithm is readable): rank by horizontal distance from screen centre, restrict to the requested side, skip the current target.
- Row: `{ "turnRate":7.5, "needsOnScreen":true, "switch":"nearestToCentreOnInputSide" }`.

**Backstab and riposte.** **Not present in this repo.** No code, no data. Do not credit this donor for them. Use a Souls-like donor with real code if we want these.

## 4. Poise / stagger (this is the part worth a real look)

**Summary.** Each character has a stagger pool (default 100). Any hit reduces it. If the pool goes below a threshold (zero minus a bonus), the character plays a stagger animation and a consecutive-stagger counter goes up. After 3 consecutive staggers, the pool is refilled and the character becomes **Unstoppable** for 2.5 s, so they cannot be chain-stunned forever. Separately, taking any damage starts a 1 s timer that refills the pool and clears Staggered. While Unstoppable, stagger damage is ignored entirely.

There is also a "bonus health" that offsets the threshold. It exists so the dodge can add 50 extra poise during the roll (a dodge bonus), meaning a hit during a roll is much harder to stagger.

**Key numbers.** Pool 100. Recovery delay 1 s. Max consecutive staggers 3. Unstoppable window 2.5 s. Dodge bonus 50.

**Our row (we already have posture; this adds anti-stunlock and temporary armour).**

```json
{ "id":"poise_default", "max":100, "recoverDelayS":1, "chainCap":3, "afterCapUnstoppableS":2.5,
  "windowBonus":[{"when":"roll","bonus":50},{"when":"specialWindup","bonus":999}] }
```

## 5. Enemy adaptation ("dynamic enemy adjustment")

**Reality check.** The adaptive part (DDA, player modelling) is claimed in the README but **not in the code**. What exists is a reactive, hand-tuned enemy brain with a state flow: Idle, Patrolling, Seeking (nav chase), CombatMovement, Dead. Transitions: idle to patrol after 2 s, anything to seek on getting a target, seek to combat when in attack range, combat back to seek when out of range, and to idle when the target is dead or lost. A detection volume sets the target on entry (the sight raycast layer field exists but is unused).

The combat brain does three things, and this is the reusable part:
1. **Spacing.** It tracks a band: too close (below 1.5) or too far (above 5) triggers a corrective walk toward the ideal range (4), and it stops once within a small tolerance (0.2). The flag stays on until the tolerance is met, which is hysteresis, so it does not jitter.
2. **Reads the player.** The attack gate opens on either of two conditions: the 3 s default cooldown elapsed, OR the player is mid-attack, in range, and a short 0.5 s combo cooldown has elapsed. So the enemy punishes or trades with a swinging player faster than it would otherwise attack.
3. **Chooses the move from the player's state.**
   - If the player is blocking: 30% light, 70% heavy (heavies break guards).
   - If the player is far (more than ideal range plus 4): the dash attack.
   - Otherwise: 70% light, 30% heavy.

Also in the tuning set but unused in the code we read: a dodge chance 0.35 and a defense delay 1.5 s (declared, never consulted).

**How to get real adaptation from this skeleton (our design, not the donor's).** Keep a short rolling window of player habits and use it to bend those same weights. This is where the Pit bosses can beat the donor.

```json
{ "id":"boss_brain_pit_1", "spacing":{"min":1.5,"ideal":4,"max":5,"tol":0.2},
  "gate":{"cooldownS":3,"punishSwingCooldownS":0.5},
  "pick":[{"if":"playerBlocking","w":{"light":30,"heavy":70}},
          {"if":"playerFar>4","w":{"dash":100}},
          {"else":true,"w":{"light":70,"heavy":30}}],
  "adapt":{"window":"last10Attacks","signals":["blockRate","rollRate","spamLight"],
           "bias":[{"signal":"blockRate>0.6","add":{"heavy":+20,"grab":+15}},
                   {"signal":"rollRate>0.5","add":{"delayedSwing":+25}}],
           "clamp":{"maxShift":30}} }
```

All weights, thresholds and signal names live in the row. The sim only evaluates them with the existing seeded RNG so replays stay deterministic.

## 6. Animation-event driven timing, camera, VFX, sound

**Animation events.** A reusable animator behaviour holds a list of events. Each has a trigger (state enter, a normalised time within the state, or state exit), a message id and a string argument. It fires them in order as time passes and rewinds the cursor on loop. A separate hook toggles status flags on a time window. The weapon hitbox is switched on and off by "activate/deactivate hitbox" messages from the clip. So the clip is the timeline and the code only reacts. Messages travel over a generic publish and subscribe bus.
- For us: our per-weapon clips should carry an authored event list in data, in frames, not baked into code. The attack row's `events` list in section 1 is the same shape. One event table drives hitbox windows, trails, sound, camera kick and status windows.

**Hit-stop.** On any melee hit against an AI character, it drops global time scale to 0.2 and restores to 1 after a 0.06 delay. This is a slow-down, not a freeze, and it applies to everything. (Whether the 0.06 is real or scaled time was not verified; if scaled, the true length is about 0.3 s.) Our row system already has hit-stop; the thing to take is the **tier** idea: a slow-mo scale plus duration pair per hit class, not one global freeze.

**Camera.** Cinemachine-based: a free-look third-person camera and a lock-on camera, with a director that swaps priorities (0 or 1) and unparents the cameras from the player so body motion does not shake them. There is no camera shake or kick code at all. Nothing to take for the kick; the useful bit is the director idea: camera modes as rows with a priority, switched by state.

**VFX, sound, UI.** The sound layer is a mapping from event to clip with a player component. Blood and particle packs are third-party assets. UI has delayed health and stamina bars (a second bar lags behind the real one). Nothing for trails exists in the code.

## 7. What is genuinely worth taking (ranked)

Ranked by value to Frankendom specials and Pit bosses. Types are my own sketches.

### 1. Status windows on a clip (i-frames, super-armour, parry window) as data
One generic row says "grant flag X from frame A to B of clip C". Specials get Unstoppable during windup, rolls get i-frames, all without code.
```ts
type StatusFlag = "iframes" | "unstoppable" | "staggered";
interface StatusWindow { clip: string; flag: StatusFlag; fromF: number; toF: number }
interface StatusWindowTable { rows: Record<string, StatusWindow[]> }
function activeFlags(w: StatusWindow[], clip: string, f: number): Set<StatusFlag> {
  return new Set(w.filter(x => x.clip === clip && f >= x.fromF && f < x.toF).map(x => x.flag));
}
```

### 2. One event timeline per attack row (hitbox, trail, sound, camera, status)
Everything that happens during a swing is a frame-stamped event in the attack row. Weapon-compatible specials reuse the weapon's clip and only swap the event list.
```ts
type EventKind = "hitboxOn" | "hitboxOff" | "trail" | "sound" | "cameraKick" | "hitstop";
interface AttackEvent { f: number; kind: EventKind; id?: string; arg?: number }
interface AttackRow {
  id: string; weapon: string; windupF: number; activeF: number; recoverF: number;
  cost: { stamina: number }; onHit: Effect[]; events: AttackEvent[];
}
```

### 3. Anti-stunlock poise: chain cap then temporary Unstoppable
After N consecutive staggers, refill poise and ignore stagger for a window. Cheap and fixes boss chain-stuns.
```ts
interface PoiseRow {
  max: number; recoverDelayS: number; chainCap: number; unstoppableS: number;
  windowBonus: { when: "roll" | "specialWindup"; bonus: number }[];
}
interface PoiseState { value: number; chain: number; unstoppableUntilF: number }
```

### 4. Data-driven weighted move picker conditioned on player state
Enemy move choice is a list of conditional weight tables. Conditions name player state (blocking, far, mid-swing). Bosses read it from a row.
```ts
type Cond = "playerBlocking" | "playerSwinging" | { playerFarGt: number } | "else";
interface PickRule { when: Cond; weights: Record<string, number> }
interface BrainRow {
  spacing: { min: number; ideal: number; max: number; tol: number };
  gate: { cooldownS: number; punishSwingCooldownS: number };
  pick: PickRule[];
}
```

### 5. Real adaptation layer on top of the picker (the donor only promises this)
Keep a rolling window of player habits and add bounded weight bias. Deterministic, clamped, in data, so Pit bosses learn without becoming unfair.
```ts
type Signal = "blockRate" | "rollRate" | "lightSpam" | "kiting";
interface AdaptRow {
  windowAttacks: number; maxShift: number;
  bias: { signal: Signal; gt: number; add: Record<string, number> }[];
}
interface HabitTracker { push(ev: Signal, v: number): void; rate(s: Signal): number }
```

### 6. Spacing band with hysteresis, plus "punish a swinging player" gate
A min, ideal, max distance band that keeps correcting until within tolerance, and a shorter cooldown when the player is mid-swing. Gives bosses a readable rhythm.
```ts
interface SpacingRow { min: number; ideal: number; max: number; tol: number }
function spacingMove(d: number, row: SpacingRow, correcting: boolean): { dir: -1 | 0 | 1; correcting: boolean } {
  if (correcting) return Math.abs(d - row.ideal) < row.tol ? { dir: 0, correcting: false } : { dir: d > row.ideal ? 1 : -1, correcting };
  return d > row.max ? { dir: 1, correcting: true } : d < row.min ? { dir: -1, correcting: true } : { dir: 0, correcting };
}
```

## 8. Not worth taking

- Backstab and riposte: absent.
- Lock-on switch code: commented out (only the algorithm idea survives).
- Camera shake: absent.
- Trails: absent. We keep our own trail rows; only the event-timeline hookup (idea 2) applies.
- Hit-stop as a global time scale: ours is better as per-hit-class frame holds.

## 9. Verification notes

Read this turn from the donor: all of the Combat folder, the stamina and stagger behaviours, the lock-on detector, the three player combat files, the AI character and combat-movement and attack behaviours, the animation event and status behaviours, the camera files, the status flags, and the UML docs folder. Not read: the Unity scene and animator assets (they are not in the repo), and the `ActionHelper` delay implementation (so the hit-stop real versus scaled time is unverified).
