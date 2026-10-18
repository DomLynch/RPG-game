# Donor study: Schwarzerblitz Engine and OpenFight (data-driven move rows)

Status: read-only study, 2026-10-17. Nothing copied. Sketches below are written from scratch.
Donor: Schwarzerblitz (AndreaJens) and OpenFight (nonameentername), what we took: design ideas only.

## Licences and the rule applied

- **Schwarzerblitz Engine** (`/mnt/frankendom-donors/AndreaJens-SchwarzerblitzEngine`, `LICENSE.md`): source code is **3-clause BSD** (Copyright 2016-2022 Andrea Demetrio). It permits use and redistribution, with or without changes, if we keep the copyright notice, the conditions and the disclaimer in source copies, reproduce them in the docs of binary copies, and do not use the author's or contributors' names to endorse our product. Irrlicht and SFML ship under their own licences (`license/irrlicht/`, `license/SFML/`). **Assets are "all rights reserved"**: characters, models, music, sounds, stages, art, and the sample move lists tied to Tutorial Man / Evil Tutor / Random may not be redistributed. So the code is permissive, but the move files (`chara_*/moves.txt`) are character content and are treated as not copyable.
- **OpenFight** (`/mnt/frankendom-donors/nonameentername-openfight`, `LICENSE`): **LGPL-3.0**. Copyleft on the library, and nothing in it fits our TS build.
- **Rule applied:** design only, in my own words, for both. No code, no move rows, no identifiers or file syntax reproduced beyond the minimum needed to say what a field is. Even though the Schwarzerblitz code is BSD, we are not porting C++ into TS, and the move data is asset content. Anything we ship is a clean-room schema of our own. If a later lane wants to copy Schwarzerblitz source verbatim, it must carry the BSD notice and ask Lead first.

## What the two games are

- Schwarzerblitz: a 3D fighter (C++/Irrlicht) where **each character is a folder of text files**. About 1100 lines of move text for a full character, 280 lines of shared moves, 23 to 30 fields per move. Engine tunables sit in one `bin/config/engineConfig.ini`.
- OpenFight: a 2D sprite fighter. Everything is YAML: an action state graph, per-sprite-frame boxes, a separate key-sequence table. It is a thin skeleton (no damage numbers, no hit-stop, no AI in data). Useful mainly for its state graph and input notation.

## 1. Move / attack data format

**Schwarzerblitz** (`schwarzerblitz_engine/bin/media/characters/chara_tutor/moves.txt`, parser `SchwarzerblitzEngine/FK_MoveFileParser.cpp`, enums `FK_Database.h`). A move is a block: a name line, then keyed lines, one sub-block per list.
- Timing: an animation clip name, a frame span of the clip (a `FRAMES a b` pair), a distance window (min and max range, used by the CPU and for tracking), and a post-move delay in ms.
- Hitbox line, one per limb per active window: `bone / start frame / end frame / damage / single-hit or multi-hit / priority / reaction / attack height`. Example shape: a foot, frames 4 to 10, 12 damage, one hit, priority 0, "StandFlight" reaction, low. An optional leading guard-break flag. So **startup = hitbox start frame, active = start to end, recovery = clip end minus hitbox end**. Nothing is stored as "recovery"; it falls out of the clip length.
- Reaction is an enum (weak or strong, times high, mid, low, plus flight, standing flight, reverse flight, smackdown landing). Attack height is a separate enum (high, mid, low, three throw heights, blockable throws, bullet).
- Stance gate (needed stance and resulting stance), movement script (`frame, dx, dy, dz` rows, with a `>` meaning "ramp up to this frame"), invincibility windows (all, or against a named attack-height class such as "low attacks" or "upper-body attacks"), armour windows, sounds by frame.
- Cancels: a **cancel-into list** (move name plus a frame window of the current move) and a **follow-up list** (move name plus input window in frames, used for chains and strings). Both are name plus two numbers.
- Input: a token string such as `6 + K` (direction digits numpad style, buttons, `+` for simultaneous, arrows for double-tap and holds).
- Flags: follow-up only, anti-air only, versus grounded only, only with or without object, no sounds, no buffer clear, taunt, repeatable chain, minimum damage scaling for this move, "no cancel on whiff", tracking on startup and on hit.
- Bullets and throws are sub-blocks (mesh, range, velocity, hit radius, own hitbox line; throw has its own escape input).

**OpenFight** (`data/ryu/ryu.yml`, `data/ryu/moves.yml`). No move block. A state graph in `action:` (name, trigger, list of states it can start from, target state) and per-frame data in `animation:` (sprite, size, delay in ticks, per-frame velocity, per-frame defence box, per-frame **offence box**, and a collision effect: spark object, which reaction trigger to send to the opponent, offset). A frame with an offence box is the active frame. "Combo" is one flag on the animation: a cancel is allowed only if the opponent is currently hurt. `moves.yml` maps key chords to trigger tokens (press, release, hold-for-N).

**Takeaways for us:** (a) a move row is one line per hit window, not per move; (b) startup/active/recovery should be stored explicitly (Schwarzerblitz derives them from the clip, which breaks once clips are shared); (c) cancel windows are `{to, fromFrame, toFrame}` triples; (d) movement is a small script of keyed points, not a baked clip.

**As a data row in our TS engine:** one `moves.json` with rows keyed by id, one `hits[]` array per row, a manifest entry, loader in the existing sandbox rules registry. Details in the six ideas below.

## 2. Frame-data engine

- Frames: Schwarzerblitz plays clips at 24 fps (`animation_framerate_fps` in `engineConfig.ini`) and tests hit boxes against the clip's current frame number, so the sim is tied to animation time, not to a fixed tick. Moves are matched on frame numbers; many durations (stun, cooldown, pushback) are in **milliseconds**, not frames. For a deterministic 60 Hz sim we should keep everything in ticks.
- Hit resolution (`FK_SceneGame.cpp`, `checkDamageCollision`, about line 4980 on): for each active hitbox, test against each hurtbox; a single-hit box disables later boxes of the same bone; then run the chain: throw check, guard check (high or low guard against attack height, front or back), armour, damage maths, reaction, combo logging.
- Hit-stun (`FK_Character.cpp`, `setReaction`): **per reaction class, not per move**. Weak 250 ms, strong 400 ms, guard 180 ms, cap 600 ms. A multiplier scales it: counter hit 1.5, trigger (burst) combo 3, repeated move in the same combo 0.7 then 0.5 (the anti-infinite). Guard stun overrides to a flat 180 ms. Pushback on block is a velocity of -400 for 75 ms (config), not per move.
- Counter hit: defender is mid-move, hit from behind, or guard-broken: damage x1.2, stun x1.5 (both config).
- Combo scaling: a six-step table [1.0, 0.8, 0.6, 0.4, 0.3, 0.1] picked by how much damage the combo has already done compared with the victim's max life (thresholds at 1/6, 1/5, 1/4, 1/3, 1/2.5 of max life). The scaling floor can be raised per move. Minimum 1 damage. Scaling applies to throws only if the move opts in.
- Juggle: a damage multiplier (config key, default 1.0) when the victim is in hit-stun and airborne; an "extended juggles" switch; the repeat-move rule turns a heavy launch into a weak flight after the second repeat (corner infinite guard).
- Throws: a throw hitbox has a throw attack height; a blockable throw can be cancelled if the defender is attacking (priority above 0); throws cannot hit an airborne target unless the move says so. Throw escape is a separate input per move.
- Hit-stop: **the code exists but is switched off**. `activateHitStopEffect` is commented out; the intended value was 3 frames at 0.2 timer speed. What is live is time-scale slow-mo for counters (0.4x for 80 ms, cooldown 2.5 s) and for trigger combos (0.3x for 250 ms). The engine has **no separate attacker vs defender hit-stop**; it slows the whole world.
- Frame advantage: the function exists for a training HUD and is stubbed to return false.

**Our engine already has** hit-stop rows, guard, stamina and posture; so only the ideas below are new: reaction classes that own stun, stun multipliers as a data table, the six-step combo scaling by fraction of max life, and the repeat-move penalty.

## 3. How a character is assembled from files

- `characters/roster.ini`: name and slot per character folder.
- Per character folder: `character.txt` (name, AI archetype, life, walk speed, hit-sfx names, references to the other files, and one line per **basic pose**: pose name, clip, frame span, for stance, walk, run, sidestep, guard, crouch, each hit reaction by height and strength and front or back, wake-up, win, intro, jump), `moves.txt`, `bones.txt` (logical bone name to armature bone: head, torso, hands, feet, knees, elbows), `additionalHitboxes.txt` (extra boxes parented to a bone, with offset and size), plus `introQuotes`, `winQuotes`, `arcade/arcadeFlow.txt`, and per-mesh `config.txt` (costumes).
- `characters/common/moves.txt` (55 moves): moves every character shares (run, rollout, ukemi). A character file adds to or overrides it.
- So **one character = a folder of text, no code**. Animation clips are looked up by name from a pose table; a move names a clip.

**Our row:** `characters/<id>.json` with `{life, walkSpeed, aiArchetype, poses: {poseId: clipId}, reactions: {reactionClass: clipId}, boneMap, extraBoxes[], moves: moveId[]}`, a shared `common-moves.json`, and the registry merges shared then character rows.

## 4. Weapon and stance handling

- Stance is a bit-flag set (ground, crouched, supine, prone, landing, wake-up, air, running, win, five special stances). A move row names the stance it needs and the stance it leaves you in. So stance changes are plain data transitions; special stances (a drawn weapon, a second style) are just extra stance bits.
- Weapons and held objects are handled as **objects**: a character can have additional objects (mesh on a bone), pick up or drop them at a frame, and moves can require "with object" or "without object". Objects carry attack and defence multipliers by attack type, a max-damage clamp, and a break check on heavy hits. There is no separate weapon table; damage multipliers are keyed by (bone, attack height).
- OpenFight: the state graph's "from" lists are the stance system; there are no weapons.

**Our row:** a `weaponProfile` row `{requiresTag, grantsTag, attackMult: {bone|height: n}, defenseMult: {height: n}, damageCap}` referenced by the move rows. We already have per-weapon clips, so only the multiplier and tag gating is new.

## 5. CPU move selection

- `FK_AIManager.cpp` (1067 lines). Level 0 and up. Each decision: build a candidate list = moves whose stance, range window, object, follow-up and target conditions pass (so the move row's range and flags **are** the AI data); pick randomly; then archetype rules (aggressor, tactician, balanced, luchador, jack-of-all-trades) filter the list differently.
- Percent-chance knobs by level: chain likelihood = 5 + 7 x level - 12 (less level, floor 5) x failed chain attempts; guard, trigger, jump, throw-escape each have a base plus per-level step; after-move cooldown 2200 ms at level 0, minus 240 ms per level to 5, then 60 ms per level above.
- Authored combo strings per character (a list of move ids with "not during burst" and "only during burst" flags), and a scheduled-move slot (decide now, fire at frame N).
- OpenFight has no CPU.

**Our row:** `ai.json`: `{archetypes: {id: {minRange, maxRange, moveWeights, guardBias}}, levels: [{chain, guard, jump, escape, cooldownTicks}], strings: [{from, steps[], onlyIf}]}` and the move row supplies `range` and `tags`.

## 6. Camera and effects at impact

- Camera: one manager updated every frame with an "additional distance" argument; a counter hit pulls the camera in by a config distance (20 units) for the slow-mo window (80 ms at 0.4x). Strong flight reactions start a 300 ms screen "impact effect" (a post-process parameter ramps 0 to 0.5 across the 300 ms). Sound effect picked by reaction strength (weak, strong, guard, counter), pitch up 1.2x when the victim has armour. Particle effect per hitbox bone, different for blocked or armoured.
- Everything is config, not per move. No camera shake.

**Our row:** we already have camera kick and hit-stop rows; the improvement is to key them by **reaction class** (weak, strong, guard, counter, armour) with the move row only overriding.

## Move-row width (how many columns a real move needs)

Counting Schwarzerblitz's `moves.txt` fields in use across 1100 lines: per move, 8 always-present (name, clip, frame span, range pair, stance in, stance out, input, post-move delay), about 6 common optional (hit windows, movement script, cancels, follow-ups, invincibility, sounds), and about 14 rare flags. Each hit window has 8 columns. So **a usable move row is about 14 columns plus a hit array of 8 columns per window**, with the rare flags in a single `flags[]` array. Everything else (stun, pushback, scaling, camera) lives in class tables, not in the row.

## Hit-pause by weight and attacker vs defender (the gap in the donors)

Neither donor gives per-weight hit-stop (Schwarzerblitz's was disabled; OpenFight has none). The design we can take: hit-stop is a property of the **reaction class table**, with separate attacker and defender ticks (attacker freeze shorter than defender freeze), and the move row only adds an override. Starting values to tune on the phone (ours, not a donor figure): light 3/4, medium 5/6, heavy 8/10, finisher 12/14, in 60 Hz ticks as (attacker/defender). That belongs in the row table, not in code.

---

## The 6 most valuable design ideas (TS sketches written from scratch)

### 1. Compact move row: explicit startup/active/recovery, hits as an array

```ts
interface MoveRow {
  id: string; clip: string; weapon?: string;
  startup: number; active: number; recovery: number; // ticks at 60 Hz
  stanceIn: StanceId; stanceOut: StanceId;
  range: [min: number, max: number];
  input: string;            // token string, "6+K"
  hits: HitRow[];           // one per limb/window
  cancels: CancelRow[]; move?: MovePoint[]; flags: string[];
}
```

### 2. Hit row: limb, window, class, height, one column each

```ts
interface HitRow {
  bone: string; from: number; to: number; // ticks since move start
  damage: number; multi: boolean; priority: number;
  reaction: ReactionClass; height: 'high' | 'mid' | 'low' | 'throw';
  guardBreak?: boolean; stunMul?: number; // optional per-hit overrides
}
```

### 3. Reaction-class table owns stun, pushback, hit-stop, camera and sound

```ts
interface ReactionRow {
  id: ReactionClass;               // weak | strong | guard | counter | armour
  hitStunTicks: number; blockStunTicks: number; pushback: number;
  hitStop: { attacker: number; defender: number; camera: number };
  stunCap: number; sfx: string; vfx: string;
}
```

### 4. Cancels and follow-ups as window triples

```ts
interface CancelRow {
  to: string;               // move id
  fromTick: number; toTick: number; // window on the current move
  on: 'hit' | 'block' | 'whiff' | 'any';
  kind: 'cancel' | 'chain'; // chain = needs a fresh input in the window
}
```

### 5. Combo scaling by fraction of max life plus a repeat-move penalty

```ts
interface ScalingRow {
  steps: number[];                  // [1, .8, .6, .4, .3, .1]
  thresholds: number[];             // fractions of victim max life
  minDamage: number;
  repeatStunMul: number[];          // [1, .7, .5] by repeat count
  counterDamageMul: number; counterStunMul: number; juggleDamageMul: number;
}
```

### 6. Shared + character files, stance as tags, weapon profile as multipliers

```ts
interface CharacterRow {
  id: string; extends?: string;     // 'common-moves'
  life: number; walkSpeed: number; aiArchetype: string;
  poses: Record<string, string>; boneMap: Record<string, string>;
  moves: string[];
}
interface WeaponProfile {
  id: string; requiresTag?: string; grantsTag?: string;
  attackMul: Record<string, number>; damageCap?: number;
}
```

## Build order suggestion (for the lane that picks this up)

1. Reaction table + scaling table as JSON, loaded by the registry (no behaviour change; just move today's constants).
2. Move row and hit row schema with a validator that checks startup + active + recovery equals clip length.
3. Cancel windows as rows, then the repeat-move stun penalty.
4. A text/CSV view of the rows for frame balancing (one line per hit window), generated from the JSON, so Dom can tune from a sheet.

Notes: file paths cited are under `/mnt/frankendom-donors/` on the VPS. All numbers quoted from the donors come from `bin/config/engineConfig.ini`, `FK_Database.h`, `FK_SceneGame.cpp`, `FK_Character.cpp` and `FK_AIManager.cpp`. The hit-stop starting values in the last section are my own proposal, not a donor figure.
