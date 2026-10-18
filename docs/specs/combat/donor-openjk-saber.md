# Donor study: OpenJK lightsaber / melee combat (Jedi Academy)

**GPL RULE (read first).** Donor: `/mnt/frankendom-donors/JACoders-OpenJK` (GPL-2.0). This note is a description of DESIGN, data shapes, numbers and algorithms in my own words. No code is pasted or transliterated, tables are summarised not copied. Our TypeScript must be written from this description, not from the C. The type sketches at the end were written from scratch. Numbers are game-tuning facts and are quoted so we can pick our own values. Source: `codemp/game/` (`bg_saber.c`, `bg_panimate.c`, `w_saber.c`, `bg_saberLoad.c`, `g_missile.c`) and `codemp/cgame/cg_players.c`. I did not find any hit-stop, block-points or saber-fatigue system in the multiplayer code; the nearest equivalents are the parry hold timer and the force pool (see section 7).

## 1. The move table (saberMoveData)

One flat table, one row per move, indexed by a move enum. Each row carries: a name, the animation, a start quadrant and an end quadrant, an anim-set flag (idle / active-override / finish), a blend time in ms (50 to 350), a block class (none, tight, wide), a "chain if released" move, a "chain if still attacking" move, and a trail length in ms.

- Quadrants are 8 compass points of the blade: bottom-right, right, top-right, top, top-left, left, bottom-left, bottom. A move is "from quadrant A to quadrant B": a slash starts where the blade was held and ends where it finishes.
- Families of rows: ready/draw/putaway; 7 attacks (one per direction); starts (ready to first attack, one per direction); returns (attack to ready); about 42 transitions (every end quadrant to every start quadrant, "fast arc" or "weak spin"); bounces (attack repelled, one per quadrant); deflects (slide-off variant); reflected attacks; broken parries; knockaways; parries; missile reflects; then specials (lunge, jump, flip, backstab, rollstab, cartwheel, spins, kicks, stabdown, kata per style).
- Blend times: normal attack 100 (the bottom-left uppercut is 50, snappier), parries/knockaways/broken parries 50, readies 350. Block class is "tight" on attacks (the blade only covers the swing) and "wide" on readies/parries.
- Trail length per row: 0 for idle, 150 for transitions/bounces/parries, 200 for attacks, 300 for missile reflects, 500 for the dual-spin and staff kata, 2000 for the three single-saber kata. This one number drives the trail renderer (section 5).

**Our row:** a `MoveRow` in `moves.json`, keyed by id, with `anim` (clip id), `startQ`, `endQ`, `kind` (idle / start / attack / return / transition / bounce / deflect / reflected / brokenParry / knockaway / parry / special), `blendMs`, `blockClass`, `chainIdle`, `chainAttack`, `trailMs`. We already have blade paths per move; add `startQ/endQ` as labels on the existing path rows rather than new geometry.

## 2. (a) Transition graph as data

How a swing sequence is chosen (my reading of the flow):

1. Input direction at attack time picks a target attack: eight movement directions map to seven attacks (diagonals forward = diagonal slashes, sideways = horizontal slash, forward only = overhead, back = uppercut-ish or a backstab special, no direction = overhead).
2. From ready, the engine plays that attack's START row first (ready pose to the attack's start quadrant), then the ATTACK row.
3. Chaining attack to attack: if the previous move's END quadrant equals the next attack's START quadrant, play it directly. Otherwise play a TRANSITION row looked up in an 8x8 matrix indexed by (end quadrant of current, start quadrant of next). The transition row's own `chainAttack` says which attack follows it. Diagonal (diag-opposite) transitions are the "weak spin" ones, adjacent ones the "fast arc".
4. If the attack button is released: a start must finish into its attack, an attack must finish into its RETURN row (attack to ready), a transition goes to its `chainAttack`, a bounce goes to its `chainIdle`. So a swing never gets cancelled mid-air; you either commit or follow through.
5. From a parry/reflect/knockaway you may attack immediately; the attack is picked from the parry's end quadrant (top = overhead, top-right = TR slash, and so on). From a broken parry you must return to ready first. From a bounce you may not repeat the attack from the same quadrant that just bounced (it picks a different one).
6. **Combo length is capped by a "kata done" test**, per stance, with a chain counter that resets on ready and caps at 16: Fast stance may chain spinning slashes up to a tolerance of about 5, medium and others about 3; Medium also stops randomly once the count passes a roll between 2 and 5; Strong stops after 2 to 3 chained attacks, and after the first it only allows chains whose "chain angle" (a second 8x8 table of 0..270 degrees between end quadrant and next start quadrant) is between 135 and 215, i.e. it rewards continuing the momentum of the swing and punishes reversing. Staff and dual have no cap. The result of "done" is: take the move's `chainIdle` (go back to ready).
7. Style changes animation speed on transition rows only: Fast x1.5, Strong x0.75, Medium x1.0. Styles 2 and 3 also use a different animation set per style (the same move name maps to a different clip by style).

**Data shape for us (improvement):** two matrices as JSON rather than code branches.

```
transitions.json: { quadrants:["BR","R","TR","T","TL","L","BL","B"],
  move: [[null,"t_br_r", ...], ...],      // 8x8 -> move id
  angle:[[0,45,90, ...], ...] }           // 8x8 -> degrees, for chain-angle rule
stances.json: { fast:{ transitionSpeed:1.5, chainCap:{base:5,spinOnly:true}, ...},
                strong:{ transitionSpeed:0.75, chainCap:{base:3, angleWindow:[135,215]} } }
```
Our engine currently chains per-weapon clips; adding a quadrant label per move gives us the matrix for free and lets a weapon declare only which quadrants it has clips for (missing cells fall back to a generic blend row). The release-must-finish and "no repeat of the bounced quadrant" rules are tiny pure functions over this table.

## 3. (b) Swept-blade hit detection and damage timing

- Every sim step the engine knows the blade's base and tip this step and the base and tip from the previous step (stored on the blade as a "last trail" record; discarded if older than 100 ms, which prevents a bogus sweep after a teleport/hitch).
- To avoid tunnelling, it does not trace the single segment. It traces the base path first, then walks along the blade in 8-unit slices, tracing each slice from where that slice was last step to where it is now. If the blade turned a lot since last step (more than roughly a third of a full direction change), the sweep is subdivided into several angular sub-steps with interpolated blade direction, so the arc does not flatten into a chord. Each slice trace is stretched 16 units beyond its end so slices overlap and leave no gaps.
- If a slice hits another blade, the remaining sweep is clipped to that hit fraction (the attacker's blade is treated as stopped there), so one swing resolves one contact point.
- Trace thickness: a point when idle, a small box when attacking (box size from blade radius and the style: fast uses a fatter box because it samples less often).
- Only an attack-state move (attack row, special, or optionally transitions for weapons flagged "transition damage", which Strong uses) deals full damage. Merely touching with an idle blade deals 1 point, debounced to once per 350 ms. After a full hit the swing is debounced for 100 ms (per blade) so one pass does not multi-hit.
- **Active window as a timeline:** the engine has a function that returns the "power" of the current animation at the current time. Some moves return zero during their windup and recovery and full power only in the middle (backstab: first 400 ms and last 450 ms are harmless; lunge: first 150 ms and last 400 ms; jump attack: first 550 ms, last 400 ms). That is exactly an active-frame window per move.
- **Damage ramp:** damage for ramped moves is a tent function of animation progress. Inputs: min damage, max damage, and a peak position (fraction of the animation). Factor = (time remaining) / (time remaining at the peak); if the factor overshoots 1 it is mirrored back down (2 - f); then multiplied into max and clamped to [min,max]. Net effect: the swing hurts most at the sweet spot and barely at the start and end.
  - Numbers by stance: Fast flat 35, Medium flat 60, Strong ramp 2 to 120 peaking mid-swing; leaping overhead special ramps to 180 with a later peak (0.65); Staff and Dual ramp 2 to 70, their specials 2 to 90, spins constant ~10 plus a ramp.
  - Back attacks ramp 2 to 25/30 because they hit many times.
  - Unblockable specials get a small flat bonus and an extra rule: for the lunge and flip moves, if the animation is in the first 40 percent damage is forced to 2, so only the late part of the lunge is dangerous.
- Modifiers: per-weapon `damageScale`, a x1.5 multiplier against non-saber users, x0.5 (0.7 for the lowest tier) against a saber user (blocking is assumed), x0.3 with a broken arm, `knockbackScale`, dismemberment on/off flag, splash radius/damage/knockback on wall impact.

**Our rows:** `hit.json` per move: `activeFrom`, `activeTo` (ms or frame), `ramp:{min,max,peak}`, `recoveryFree` bool, `sliceStep`, `maxSubSteps`, `extrapolate`, `idleTouch:{damage,debounceMs}`, `hitDebounceMs`. Weapons supply `damageScale`, `knockbackScale`, `flags`. The swept slice test is a pure function `sweepBlade(prev, curr, step, maxAngularStep)` returning an ordered list of slice segments to test; unit-testable with no renderer.

## 4. (d) Block, bounce, parry and knockaway resolution

**Can I block?** Passive block is not an animation choice by the player, it is an automatic test. All of these must hold: not in an attack move, not holding attack, not in a broken parry, weapon present and drawn, not in a raising state, no recent block cooldown, no hand-extend, and the incoming point is in front of me in a cone whose half-width depends on defence skill (tight cone at skill 3, wider at 2, widest at 1, none at 0), with the cone narrowed a bit again when the attacker is a blade rather than a projectile. Specials ignore this test (unblockable), and a defender in a special cannot be pushed around either.

**Which block pose?** The contact point relative to the defender's eye picks one of five: contact above eye height uses a 0.3 sideways threshold (top / upper-left / upper-right); within 20 units below the eye uses a 0.1 threshold for the same three; lower than that is lower-left or lower-right. Projectiles map to a "reflect" version of the same five. This is a pure function of (eye, contact point, facing) and is cheap.

**Hold time:** a parry holds the defender for a duration from the defence skill (500 / 300 / 150 / 50 ms for skill 0..3, plus a fixed 200). A short additional block-lockout after a projectile block is 350 minus 100 per level.

**Clash outcomes (the knockaway logic, my summary):**
1. Attacker power = stance level doubled plus one, plus extra for swing speed (distance the blade base moved between samples, divided by a per-stance tolerance of 24 Fast / 16 Medium / 8 Strong, one point per tolerance unit), capped at 16. A defender who is not attacking uses the plain stance level. Broken arm cuts it to 30 percent.
2. If the attacker is below the top tier and rolls well (about 70 percent on first contact, 30 percent on a repeat), and the defender is strong enough (top tier or high defence skill), and neither side is already in a bounce/broken/special: **knockaway**. The defender plays a knockaway row chosen by the block quadrant; the attacker plays a "reflected attack" row (its swing is flung back) based on its own start quadrant. Defender wins, attacker loses tempo.
3. Else if the attacker is a top-tier or unblockable special and out-skills the defender's defence (strictly lower defence, or equal and a roll), and the defender is in a parry: **broken parry** on the defender (the parry row maps to a matching broken-parry row; Parry-Up randomly goes to one of two). Attacker continues.
4. Else if both are attacking and swords meet: compare (attack power + attacker's break-parry bonus + offence skill) against (defender's defend value + parry bonus + offence skill). Advantage over 1: the defender is knocked away; over 0: the defender bounces and the attacker continues; below: the attacker is knocked away or bounces; equal: both bounce.
5. Bounce rows exist per quadrant plus a "deflect" variant where the blade slides off at an angle computed from the two moves' quadrants (the defender's end quadrant is mirrored left/right because the two fighters face each other).
6. **Saber lock:** on a decent clash there is about a 10 percent chance (roll 1..20 at or under a lock factor of 2) to enter a lock; a defender with 2+ levels more offence skill makes it more likely. Locks pick one of 7 modes (top, four diagonals, left, right), set both fighters to matched clips at an ideal distance of about 46 to 48, then each press advances a shared frame counter by (offence skill + 1); first to the end wins and plays a win/lose animation, the loser is thrown or hurt. The lock breaks if the fighters are closer than 8 or further than 80 apart.
7. **Disarm:** a knockaway/broken-parry may knock the loser's weapon out of hand: 70 percent if the winner's power exceeds the loser's by over 1, 30 percent if over 0, then thrown along the winner's swing direction at a speed proportional to swing distance (floor of 20 units, times 6.5). Weapon can carry `disarmBonus`.

**Our rows:** `clash.json`: `powerPerStance`, `speedTolerance`, `knockawayChance:{first,repeat}`, `advantageThresholds`, `lock:{chance,minDist,maxDist,advance}`, `disarm:{chance, dirScale}`; `blockPoses.json` with the five thresholds; `weapons.json` has `parryBonus`, `breakBonus`, `disarmBonus`. Our existing parry/guard/posture rows already cover step 3 and 4 in different words; the genuinely new parts are the quadrant-keyed knockaway/broken pairing, the attack-power-from-swing-speed term, and the tempo loss on the loser as an animation row.

## 5. (b) Trails from previous and current blade positions

The trail is not a particle system. Each render frame, if the current move's `trailMs` is above zero (or the actor is hasted), the renderer makes one quad from four points: new base, new tip, old tip, old base (the old pair is the blade's remembered base/tip from the last emitted slice). The quad lives `trailMs / 5` ms (so a 200 ms row lives 40 ms; idle default is a short constant). Alpha fades with age as 1 minus (frame gap / life). Texture coordinates slide with age so the streak looks like it travels along the swing. Slices are emitted at most once per 2 ms, a slice older than 2000 ms is not joined to the new one (no long streak after a pause), and a "motion blur" style variant uses a faint grey colour and doubles the life; a "no trail" style exists for sword-like weapons. A tip pushed out 3 units past the blade avoids a visible gap at the end.

**Our rows:** add `trailMs` to each move row, `trailStyle` (`glow`, `blur`, `none`) and `trailColor` to the weapon row; `trailLifeDivisor` and `maxGapMs` in `trail.json`. Implementation: ring buffer of quads (base/tip pairs plus birth time) per blade, one draw call with vertex alpha; the SAME remembered base/tip pair feeds the swept hit test, so trail and hit can never disagree.

## 6. (c) Special moves gated by stance, state and weapon

How the donor decides what a button press means:
- Every special needs a **style gate**, a **state gate**, an **input gate** and a **resource**. Examples (my wording): the kata (alt+attack together) needs a standing still, grounded, not in an existing kata, in ready or an attack START, costs 50 of a 100-ish pool, and does a different kata per style. A cartwheel needs sideways input plus jump plus attack, rising velocity, within 70 units of ground, costs 10. The mid-air forward flip-strike (Medium) and the leaping overhead (Strong) need forward input, an upward speed above 100, ground distance under 32, not already in a special, costs 25. The lunge needs a crouch and costs 25, and is only for Fast, Dual, Staff. The backstab needs back input plus a body detected in a short box probe up to 128 units behind; its variant depends on style and crouching. The stab-down needs a downed enemy. Dual style gets "both sides" and "front and back" double slashes when enemies are within 100 units on both sides. Kicks need staff style plus alt.
- **Secondary-style flag** switches all specials off at once (e.g. when holding a weapon that is not the primary).
- **Weapon-level override with three states.** Each weapon row may say, per special slot (kata, lunge, jump-forward, jump-left, jump-right): "use default", "use this other move", or "disabled". Plus capability flags (no kicks, no rolls, no cartwheels, no back-attack, no stab-down, no roll-stab, not lockable, not disarmable, two-handed, bounce on walls, transition damage, no idle damage, always blocks).
- **Specials are unblockable and uninterruptible by normal clashes,** with the active window and damage ramp from section 3.
- Priority is a plain if/else ladder per input direction (the first matching special wins, else the normal attack).

**Our rows:** `specials.json`: array of `{id, slot, styles[], weapons[], requires:{grounded?, minUpSpeed?, maxGroundDist?, crouch?, behindEnemyWithin?, enemyDowned?, fromMoves[]}, input:{...}, cost, moveId, unblockable}`, plus per-weapon `specialOverrides:{kata:"default"|"disabled"|moveId}` and `flags[]`. The ladder becomes "iterate rows in priority order, first whose predicate passes wins". This is the cleanest way to add weapon-compatible specials: a new weapon only has to add overrides.

## 7. Force pool as the stamina analogue

There is no separate saber stamina. A single pool pays for specials (50 kata, 25 for lunge/jump/flip/stab-down, 10 for cartwheel) and for jump height. Passive defence is gated by a defence skill number, not by a pool. Offensive and defensive skills (0..3) scale block cone, hold time, break-parry odds and lock strength. If we want the same tension with our stamina and posture, the transferable idea is that specials draw from the same resource that powers sprint/jump, so spamming them leaves you unable to move, not a new meter.

## 8. Hit-stop

None found in `w_saber.c`/`bg_saber.c`/`cg_event.c`. What stands in for it: the parry/knockaway forces the defender to hold the pose for the block duration, and the bounced attacker is moved to a bounce row with a fixed length, so a clash "feels" heavy through forced recovery frames. Our hit-stop and camera kick rows are already ahead of the donor; the only imitable part is making the LOSER of a clash take a forced recovery row proportional to the advantage.

## 9. The 6 most valuable design ideas, with type sketches (written from scratch)

**1. Quadrant-labelled moves plus an 8x8 transition matrix (and chain-angle matrix).** One lookup replaces every "which clip follows which" branch; releasing the button resolves to the row's return.
```ts
type Quad = 'BR'|'R'|'TR'|'T'|'TL'|'L'|'BL'|'B';
interface MoveRow { id:string; clip:string; from:Quad; to:Quad;
  kind:'start'|'attack'|'return'|'transition'|'bounce'|'knock'|'parry'|'special';
  blendMs:number; chainIdle:string; chainHeld:string; trailMs:number; }
interface TransitionTable { quads:Quad[]; move:(string|null)[][]; angleDeg:number[][]; }
const next=(t:TransitionTable,a:Quad,b:Quad)=>t.move[t.quads.indexOf(a)][t.quads.indexOf(b)];
```

**2. Chain cap by stance plus chain angle ("kata done").** Combos end by momentum rules, not a flat count.
```ts
interface ChainRule { cap:number|null; spinCap?:number; rollExtra?:[number,number];
  angleWindow?:[number,number]; }   // null = unlimited
interface StanceRow { id:string; transitionSpeed:number; chain:ChainRule; power:number; speedTol:number; }
function comboDone(s:StanceRow,count:number,angle:number,rng:()=>number):boolean {
  if (s.chain.cap===null) return false;
  if (s.chain.angleWindow && count>0 && (angle<s.chain.angleWindow[0]||angle>s.chain.angleWindow[1])) return true;
  return count>=s.chain.cap + Math.floor(rng()*(s.chain.rollExtra?.[1] ?? 0)); }
```

**3. Active window plus tent-shaped damage ramp per move.** One reusable curve gives wind-up, sweet spot and recovery.
```ts
interface HitWindow { fromMs:number; toMs:number; min:number; max:number; peak:number; }
function rampDamage(w:HitWindow, tMs:number, totalMs:number):number {
  if (tMs<w.fromMs || tMs>w.toMs) return 0;
  const left=totalMs-tMs, atPeak=totalMs*(1-w.peak);
  let f=left/atPeak; if (f>1) f=2-f;
  return Math.max(w.min, Math.min(w.max, w.max*f)); }
```

**4. Swept-blade slicing between last and current blade pose (also the trail source).** Same remembered pair draws the trail and does the hit test; sub-steps stop arc flattening.
```ts
interface BladePose { base:Vec3; tip:Vec3; tMs:number; }
interface SweepCfg { sliceStep:number; maxAngularStep:number; overshoot:number; staleMs:number; }
function sweepSlices(prev:BladePose|null, cur:BladePose, c:SweepCfg):Seg[] { /* returns segments
  [slice at prev -> slice at cur] per sliceStep along blade, subdivided by angle, each stretched by overshoot;
  prev is ignored if cur.tMs - prev.tMs > c.staleMs */ return []; }
const trailQuad=(prev:BladePose,cur:BladePose)=>[cur.base,cur.tip,prev.tip,prev.base];
```

**5. Clash resolver as advantage score with quadrant-keyed pairing.** Winner, loser tempo, disarm and lock all come from one number and one table.
```ts
interface ClashRow { baseChance:{first:number;repeat:number}; knockAdv:number; bounceAdv:number;
  lock:{chance:number;minDist:number;maxDist:number}; disarm:{big:number;small:number}; }
type ClashResult = {winner:'a'|'d'|'none'; defender:'knockaway'|'bounce'|'broken'|'parry';
  attacker:'bounce'|'reflected'|'continue'; lock:boolean; disarm:boolean};
function advantage(a:{power:number;bonus:number;skill:number}, d:{power:number;bonus:number;skill:number}) {
  return (a.power+a.bonus+a.skill)-(d.power+d.bonus+d.skill); }
```

**6. Predicate-row specials ladder with three-state weapon overrides and capability flags.** A new weapon only edits overrides, no code.
```ts
type Override = 'default'|'disabled'|string;           // string = replacement move id
interface SpecialRow { id:string; slot:string; priority:number; styles:string[]; weapons?:string[];
  requires:{grounded?:boolean;crouch?:boolean;minUpSpeed?:number;maxGroundDist?:number;
    enemyBehindWithin?:number;enemyDowned?:boolean;fromMoves?:string[]}; cost:number; move:string; unblockable:boolean; }
interface WeaponRow { id:string; flags:string[]; overrides:Record<string,Override>; parryBonus:number; breakBonus:number; }
const pick=(rows:SpecialRow[],ok:(r:SpecialRow)=>boolean)=>rows.sort((a,b)=>b.priority-a.priority).find(ok);
```

## 10. What we already have, so skip

Stamina, posture, parry, guard, roll, kick, per-move blade paths, hit-stop rows, camera kick and per-weapon clips are present. The donor adds nothing over our hit-stop. The real gains are, in order: (1) quadrant labels plus the transition matrix (replaces ad-hoc chaining), (3) the active window plus ramp curve (cheap, big feel win for specials), (4) one shared remembered blade pose for trail and swept hits, (5) the advantage-score clash with a quadrant-keyed knockaway and a forced recovery row for the loser, (6) the predicate-row specials ladder with weapon overrides, (2) the chain cap by stance and angle.
