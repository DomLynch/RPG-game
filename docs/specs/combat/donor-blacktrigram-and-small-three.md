# Donor study: Black Trigram, Flyweight, small Three.js fighter

Read-only study, 2026-10-17, lane combat-sandbox. Repos at `/mnt/frankendom-donors/` on the VPS. Nothing was copied; all sketches below are written from scratch.

## 1. Licences first

| Repo | Licence found | What we may do |
|---|---|---|
| Hack23-blacktrigram | `LICENSE` is Apache-2.0 (full text, no NOTICE file) | Code may be ported. Keep the Apache-2.0 notice in the ported file header, name Hack23/blacktrigram as source, and add a statement of changes. The Korean martial-arts text and cultural data are content, not code; do not lift the names or the 70-point list wholesale. |
| mukndd-flyweight | No LICENSE file | Design only, own words. No code or data. |
| elmarjens-three-js-fighter-game | No LICENSE file | Design only, own words. |

## 2. Hack23 Black Trigram: docs against code

**What is real.**
- 70 vital points exist as data: `src/systems/vitalpoint/VitalPointsData.ts` has exactly 70 `id:` rows (12 head, 24 torso, 17 arms, 17 legs per its header). Each row has: id, names, a 2D `position {x,y}`, category (neurological, circulatory and so on), severity (MINOR to LETHAL), `baseDamage`, `effects[]` (type, intensity, duration ms, stackable), `targetingDifficulty` 0..1, and `effectiveStances[]`.
- 28 bones are real: `BoneName` enum in `src/types/skeletal.ts` (pelvis, 3 spine, neck, head, 6 per arm, 5 per leg).
- 8 stances, 8 technique files (`systems/trigram/techniques/*Techniques.ts`, about 4.9k lines), a stance-vs-stance effectiveness matrix (`TrigramCalculator.ts`), a transition cost table (ki, stamina, time; adjacent stance 0.7x, distance 2 0.85x, else 1.0x), and a left/right laterality modifier (matched mid attack 1.15, mismatched 0.90).
- Damage is a clean multiplier chain (`DamageCalculator.ts`): base = attackPower x technique/10, then x stance effectiveness x severity (1.2, 1.5, 2.0, 2.5, 3.0) x accuracy band (0.8 to 1.2) x meridian x time-of-day x archetype x hip rotation x crit (2.0 when accuracy > 0.9) x 0.9 to 1.1 variance.
- Animation hit windows exist as data (`AnimationHitTiming.ts`: startTime, peakTime, endTime, maxReachMultiplier per technique, phases chamber/extension/peak/retraction/recovery).

**What the docs overstate.**
- "Hit registration with Three.js vectors" is mostly not true. The vital-point hit in `VitalPointSystem.processHit` is 2D pixel distance to the nearest point (max 50 px, damage falloff `1 - d/100`). The docs themselves call the game "2D Realistic Precision Combat Simulator".
- A genuine Three.js `Raycaster` against per-region sphere/capsule/box volumes exists in `physics/CollisionDetection.ts`, but a grep of the non-test code finds no caller: `CombatSystem` only constructs and disposes it. It is built, tested, and not on the hit path. Three is used for real in `CombatSystem.calculateKnockback` (a `Vector3` direction) and `KnockbackPhysics`.
- The actual hit decision in `CombatSystem.resolveAttack` is `Math.random() <= technique.accuracy x stanceEffectiveness`. Not deterministic; `Math.random` appears about 11 times in the combat path, including damage variance. Their "intent-based engine" is a facade over probability rolls.
- Several multipliers (meridian by hour of day, Dark Ops time bonus) read the wall clock, which would break replay.
- The 70-point list is also a lot of content for one hit; in practice players cannot aim at 70 points. Region plus a few named weak spots is what carries over.

Verdict: strong data schema and docs, weak simulation. Take the schemas, not the engine.

## 3. Mapping to our engine (what we already have)

We have stamina, posture, parry, guard, roll, kick, blade paths, hit-stop rows, camera kick, per-weapon clips, a tick-only deterministic sim with a seeded RNG and a sim digest, and contact height on the victim. Black Trigram has none of the deterministic parts. Where it adds value to us:

- (a) Hit-zone damage as data. Our contact height on the victim already says where a blow landed; Black Trigram shows how to turn that into a data row (zone, severity multiplier, effect with duration, per-stance exposure). Skull Crack and finishers become "head zone, severity CRITICAL, effect stun N ticks" rows rather than code.
- (b) Stance move sets as data. One row per move carries the stance it needs, cost, startup, recovery and effects; a second table carries stance-to-stance transition cost and a stance-vs-stance matrix.
- (c) Replay hashing: Flyweight, below.
- (d) Trails, impact, camera: little in Black Trigram worth taking (React-three-fiber particle components: blood, sparks, bone-crack, earth-crack; a bone impact audio system). Flyweight and the small fighter give the camera and hit-stop ideas.

## 4. mukndd-flyweight

Description check: the GitHub blurb is right that it is a 2D game with a recurrent controller. The fighter is a fruit-fly-connectome-wired neural controller (FlyWire-derived 1,536-neuron graph, CEM-trained encoder and readout, 14 actions), Python brain service plus a TypeScript sim. The "3D" is a presentation layer over a 2D sim (`apps/web/src/CombatWorld3D.tsx`). The shared engine is tiny: `packages/sim/core.ts` is 115 dense lines.

Useful parts (design only):
- One pure `step(state, [actionA, actionB])` used by the browser, the trainer, replay playback and the verifier. Same code everywhere.
- RNG is a 32-bit linear congruential generator held inside the state (`rng` field), advanced only through one `random(state)` function. Seed is an integer validated at creation.
- Replay file = seed + scene + frame limit + the per-frame action pairs + `finalHash`. Verification replays the actions and compares the hash. A hash mismatch rejects the file. Frames after the end are rejected. Unknown keys are rejected (exact key set check), and size is capped (1 MB per line).
- The hash is FNV-1a over `JSON.stringify(state)`, 32 bit. Honest judgement: fine for tamper and drift detection in a toy, weak as a security tool (32 bits, key order dependent, floats serialised as text). It does not hash per frame, so a divergence is found only at the end, not at the first bad tick.
- Move table as data: startup, recovery, cooldown, range, damage, kind (high/low/air/throw) per action. A hit lands only in a 5-frame window after startup, once per swing (`hasHit` flag), and blocks are typed (a low needs a crouch block). A block in the first 4 guard frames is a counter (the attacker is stunned): a timed-parry window as one integer.

Is deterministic replay hashing useful to us? We already have record/replay with a sim digest. What we can still take: (1) an optional rolling per-N-tick digest list in the replay so the first divergence tick is reported, (2) a strict replay schema gate (exact keys, size cap, no frames after the winner), (3) a CI row that replays every checked-in replay and compares the final digest.

## 5. elmarjens-three-js-fighter-game

About 4k lines, a tiny platform fighter, 3 effects files, 1 camera file. Short notes:
- `InputManager`: a plain key map polled into a `PlayerInput` struct per player (left, right, jump, down, punch, block). Nothing to take; ours is better for touch.
- Animation mixer crossfade: not there. `THREE.AnimationMixer` is declared in two character classes but never used (grep finds only the field). The characters are procedural meshes.
- `DynamicCamera`: frames the midpoint of both fighters; distance and height lerp with fighter separation (10 to 20 and 3 to 8); smoothing 0.05 for position, 0.08 for look-at; shake is a single intensity value that decays x0.95 per frame (uses `Math.random` and wall-clock sway, not replay safe). Block hit = 0.2, clean hit = 0.4. No hit-stop.
- `AttackEffects`: impact flash sphere + 3 motion-line boxes + comic sprite, each group with a lifetime. Hit uses `Box3.intersectsBox` of attack box against body box with a once-per-swing flag. Useful only as a reminder that hit feedback differs by block state.

## 6. Six most valuable ideas, with from-scratch sketches

### 1. Hit-zone rows (severity x zone x stance exposure)
Port target: not code. Adopt the schema shape of `VitalPointsData.ts` (`severity`, `baseDamage`, `effects`, `effectiveStances`) as our own zone rows. If any file is ever ported, the nearest is `vitalpoint/DamageCalculator.ts` (SEVERITY_MULTIPLIERS): Apache-2.0, keep the notice at the top of our file, name `Hack23/blacktrigram`, add "Changes: removed Math.random, data-driven".
```ts
interface ZoneRow { id: string; yMin: number; yMax: number; // fraction of victim height
  mult: number; stunTicks: number; exposedBy?: string[]; }  // from zones.json
const zoneAt = (rows: ZoneRow[], hy: number, h: number) =>
  rows.find(r => hy / h >= r.yMin && hy / h < r.yMax) ?? rows[0];
function zoneDamage(base: number, z: ZoneRow, victimStance: string) {
  const open = z.exposedBy?.includes(victimStance) ? 1.2 : 1;
  return { dmg: Math.round(base * z.mult * open), stun: z.stunTicks };
}
```
Skull Crack = head row with big `mult` and `stunTicks`; a finisher reads the same table.

### 2. Move rows with one-hit window
Source idea: Flyweight `MOVES` plus Black Trigram `AnimationHitWindow`.
```ts
interface MoveRow { startup: number; active: number; recovery: number;
  range: number; dmg: number; zone: 'high'|'mid'|'low'; stance?: string; }
function canHit(m: MoveRow, f: { atkTick: number; hasHit: boolean }) {
  return !f.hasHit && f.atkTick >= m.startup && f.atkTick < m.startup + m.active;
}
// on contact: f.hasHit = true  (reset when the swing ends)
```

### 3. Stance transition table as data
Black Trigram's cost table: adjacent 0.7x, distance two 0.85x, else 1.0x.
```ts
interface StanceRow { id: string; next: Record<string, { staminaCost: number; ticks: number }>;
  vs: Record<string, number>; }      // damage multiplier against other stances
function switchStance(p: Fighter, to: string, rows: Map<string, StanceRow>) {
  const t = rows.get(p.stance)!.next[to]; if (!t || p.stamina < t.staminaCost) return false;
  p.stamina -= t.staminaCost; p.lockTicks = t.ticks; p.stance = to; return true;
}
const stanceMult = (a: string, d: string, rows: Map<string, StanceRow>) => rows.get(a)!.vs[d] ?? 1;
```

### 4. Rolling digest checkpoints in the replay
Flyweight hashes only at the end; we add a checkpoint every 60 ticks to find the first bad tick.
```ts
function fnv1a(s: string) { let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0'); }
function verify(rep: { inputs: Input[][]; digests: string[] }, sim: Sim) {
  for (let t = 0; t < rep.inputs.length; t++) { sim.step(rep.inputs[t]);
    if (t % 60 === 59 && fnv1a(sim.canonical()) !== rep.digests[(t / 60) | 0]) return t; }
  return -1; }                       // -1 = clean, else first divergent tick
```
`canonical()` must write fields in a fixed order (not raw `JSON.stringify`) and round floats.

### 5. Strict replay schema gate
```ts
const KEYS = ['v','seed','limit','inputs','finalDigest','digests'].sort().join();
function parseReplay(txt: string) {
  if (txt.length > 1_000_000) throw new Error('too big');
  const r = JSON.parse(txt);
  if (Object.keys(r).sort().join() !== KEYS) throw new Error('keys');
  if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) throw new Error('seed');
  return r;                          // then replay; reject frames after the winner
}
```
Run it over every checked-in replay in CI.

### 6. Typed block plus timed-parry window as integers
```ts
interface Guard { heldTicks: number; crouch: boolean; }
const PARRY_TICKS = 4;               // a row in tuning.json, not a literal
function resolveBlock(g: Guard | null, zone: 'high'|'mid'|'low') {
  if (!g) return 'hit';
  const typeOk = zone === 'low' ? g.crouch : !g.crouch;
  if (!typeOk) return 'hit';
  return g.heldTicks <= PARRY_TICKS ? 'parry' : 'block';
}
```
Maps onto our guard and parry: a low blow needs a low guard, and the first N ticks of a guard are the parry window.

## 7. Not worth taking

- Meridian and time-of-day multipliers: wall-clock, breaks replay.
- The unused `CollisionDetection` raycast volumes: we already have contact height on the victim, which is the cheaper and deterministic equivalent.
- Connectome neural controller: out of scope.
- Small fighter's mixer, input manager, shake with `Math.random`: nothing usable.
