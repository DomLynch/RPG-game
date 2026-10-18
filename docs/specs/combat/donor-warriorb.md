# Donor study: NotYetGames/WarriOrb (Souls-style melee, Unreal C++)

**Licence: MIT.** Source: `/mnt/frankendom-donors/NotYetGames-WarriOrb` on the VPS (UE4 C++, source only, no art; `LICENSE.txt` is MIT).
**Credit line we owe** (put it in the PR body and in a header comment of any ported file):

> Donor: WarriOrb (NotYetGames). Copyright (c) Csaba Molnar & Daniel Butum; Copyright (c) Not Yet Team. MIT licence. Ported/adapted: <what we took>.

The MIT licence requires the copyright notice and licence text to travel with "substantial portions". Anything we port as a near-line-for-line rewrite gets the notice in a `// Donor:` header; pure ideas (clean-room) need only the PR line.

All paths below are under `Source/SOrb/`.

## 0. Read this first: what WarriOrb does NOT have

WarriOrb is a 2.5D spline-locked platformer where you are a rolling orb that unrolls to fight. It is a *Souls-flavoured* action game, not a Souls clone. Verified by grep on the VPS:

- **No stamina.** The only trace is a `bStaminaReg` flag on `USoActivity` (`Character/SoCharStates/SoActivity.h:271`), set false in `USoAStrike`. Nothing consumes or regenerates it.
- **No poise meter.** The nearest thing is an integer compare, `RessistanceToInterrupts < HitReactDesc.Irresistibility` (`Enemy/SoEnemy.cpp:1230`). See section 3.
- **No hit-stop.** `CustomTimeDilation` appears only for pausing off-screen enemies and the game-speed setting (`Enemy/SoEnemy.cpp:1475, 1507, 1913`). No frame freeze on impact.
- **No dodge i-frames.** The roll (`Character/SoCharStates/SoARoll.cpp`) is the orb's movement mode; it is not invulnerable. Invulnerability is a post-hit `DamageBlockCounter` only.
- **No boss phase system.** The word "boss" appears only in analytics. Bosses are ordinary `ASoEnemy` actors driven by action lists, with phases done by scripts switching lists (`ChangeActionList`, `ModifyFloatValue`).
- **Strike/AI data files are not in the repo.** Enemy strikes load from `Content/SO/AIConfig/StrikeMaps/<name>.sc` through `USoGameInstance::ReinitializeStrikeMap` (`Basic/SoGameInstance.cpp:1195`) using a DlgSystem config parser. The repo's `Content/` holds only localisation, so we get the *schema* (headers) but no sample numbers except the defaults in the headers.

So: our engine already beats WarriOrb on stamina, posture, parry, guard, roll, kick, hit-stop and camera kick. The value here is the **data model for weapon moves, combo/special chains, the trail-as-hitbox pipeline, and the enemy action brain**.

## 1. Character state machine and attack states

**Files:** `Character/SoCharStates/SoActivity.{h,cpp}` (base), `SoAStrike`, `SoAWeaponInArm`, `SoAHitReact`, `SoARoll`, `SoADefault`; owner `Character/SoCharacter.cpp`.

**Summary**
- `USoActivity` is a state object per mode (`EActivity`: Default, WeaponInArm, Striking, Rolling, HitReact, Dead ...). Each carries flags: `bArmed`, `LookDirection` (Movement / Frozen / Input), `JumpType`, `bStaminaReg`. `SwitchActivity()` forces a change; user-driven changes first ask `CanBeInterrupted(desired)`.
- `USoAWeaponInArm` is the "weapon drawn, idle" state. It only calls `RefreshWeapon()` (reads the equipped `USoWeaponTemplate`, calls `SelectWeapon`) and always returns `CanBeInterrupted = true`.
- `USoAStrike::Tick` (`SoAStrike.cpp:84-228`) is the whole attack engine. One countdown `StrikeCounter` starts at `AnimDuration + AnimEndDuration`; `PassedTime = StrikeCounterStart - StrikeCounter`. Every event is a **crossing test** between `OldPassedTime` and `PassedTime`.
- **Recovery tail = cancel/buffer window.** `ActiveBlendOutTime = AnimEndDuration`. When `StrikeCounter < ActiveBlendOutTime`, `bIsInStrike` goes false (so `CanBeInterrupted()` is true) and the state accepts: roll (cancel into roll, line 180), a buffered strike press (chain to next entry), or a switch between primary and special (line 192). If nothing is pressed it returns to `WeaponInArm` at `StrikeCounter < 0`.
- **Input buffer:** `StrikePressed()` sets `bStrikePressedRecently` and a timer of `StrikePressedRecentlyTimeOffset = 0.5s` (`SoAStrike.h`, line ~96 of the cpp for the timer). A press during the swing is remembered and consumed in the tail. `bBanStrikeCauseSpamming` exists but is commented out (they tried and dropped an anti-spam lock).
- **Combo chain:** `StrikeComboChainIndex` indexes `USoCharacterStrike::CharacterStrikes[]`. If `IsValidStrikeIndex(index+1)` the chain continues, else it restarts at 0 *unless* the strike has a cooldown (then it is blocked). Chain continuation ignores cooldown; cooldown is applied once at chain end (`OnStrikeChainFinished`, line 400: `Cooldown - blendTimeAlreadySpent`).
- **Anim retiming to logic:** play rate = `clipLength / AnimDuration * AttackSpeedMultiplier` (line 297). Logic durations are authoritative; the clip is stretched to fit. This is exactly how a deterministic sim should do it.
- **Auto-aim** (`AutoAim`, `WouldHitMortals`, line 684): before and at swing start, if an enemy within `AutoAimDistance` (weapon column, default 400) is behind the facing, turn to it; if the swing volume would not hit anything but a 180-degree flip would, flip. Uses the swoosh mesh as a probe volume.
- Player strike input is dropped while `DamageBlockCounter > 0` (`SoCharacter.cpp:2506`).

**Data used:** `FSoCharacterStrikeData` (per chain step), `USoCharacterStrike` (the chain), `USoWeaponTemplate` (two chains: primary and special).

**Key numbers:** buffer 0.5 s; `AnimEndDuration` default 0.2 s (blend-out/cancel tail); auto-aim 400 uu; jump delay before an aerial strike 0.2 s (0.5 s with `bStartWithLand`).

**Already in our engine:** blade paths, per-weapon clips, roll, kick. **Improvements:** (a) the *explicit recovery tail* as a data column that defines both the cancel window and the buffer-consume point; (b) cooldown charged at chain end, not per hit; (c) primary/special switch inside the tail; (d) mirror-flip auto-aim using the swoosh volume.

**TS data row (move step):**
```json
{ "id": "sword.primary.1", "durationMs": 420, "recoveryMs": 160,
  "cancelsInto": ["roll", "special", "next"], "inputBufferMs": 500,
  "entries": [ /* see section 2 */ ] }
```

## 2. Weapon template data (what a weapon is, and how a special attaches)

**Files:** `Items/ItemTemplates/SoWeaponTemplate.{h,cpp}`, `Character/SoCharacterStrike.{h,cpp}`, `Character/SoCharacterDataTypes.h` (`FSoWeaponBoost`, `FSoAnimationSet`).

**Weapon template columns (`USoWeaponTemplate`)**
| Column | Meaning |
|---|---|
| `WeaponType` | `OneHanded / DualWield / TwoHanded` (drives off-hand visibility, tooltip) |
| `BaseDmg`, `SpecialDmg` | `FSoDmg{Physical, Magical}`; **two separate damage rows**, one per chain |
| `PrimaryStrike`, `SpecialStrike` | pointers to two `USoCharacterStrike` chains. **This is how a special attaches to a weapon: the weapon owns a second chain, bound to the second attack button.** |
| `InterruptModifier` | int, becomes the hit's `Irresistibility = InterruptModifier + 1` (poise-break power) |
| `CriticalMultiplier` | default 2.0 |
| `AutoAimDistance` | default 400 |
| `StaticEffects[]` | passive effects applied while the weapon is held and while striking |
| `bInverseRollAnimsIfArmed` | mirror roll anim for left-handed grips |
| `NewAnimations` | `FSoAnimationSet` (idle, run, jump, float, fall, land, each with Left variant): the per-weapon locomotion set |
| `TrailColor`, `TrailAnimLight` | HDR colours, defaults `(4.8, 5.0, 1.2)` and `(100, 7.8, 0)` |
| `MeshNew`, `BoneName` (`Weapon_R`), `BoneNameSecondary` (`Weapon_L`) | visuals / sockets |

**Chain row (`USoCharacterStrike`):** `CharacterStrikes[]` (steps), `CooldownTime` (>0 only for specials; ignored when chained), `bCooldownReducedInAir` (cooldown only ticks on ground when false), `EffectToApply` (status shown while the strike runs), `StrikeName`, `CooldownIcon`.

**Step row (`FSoCharacterStrikeData`)**
- Timing: `AnimDuration`, `AnimEndDuration`, `AnimSequenceNew`, `AnimEndingSequenceLeft/Right` (end blends per facing), `bBlendIn`.
- `StrikeList[]` of `FSoStrikeEntry` (the key idea, below).
- Movement: `RootMotionDesc{h,v,multiplier}`, `bStopVerticalRootMotionNearApex`, `Jumps[{Time,Velocity}]`, `bRequiresJump`, `bFreezeInAir` (gravity 0, velocity 0 mid-air), `bStartWithLand` (plunge: sweeps down 1000 uu, snaps to floor, stores `LandingAmount`), `bForceGroundAnimsOnBlendOut`, `IgnoreWallHitBellowZThreshold`.
- Ranged special: `ProjectileClass`, `RangeAttackDelay`, `WeaponToHideIndex` + `WeaponHideDuration` (the weapon is hidden while "thrown", re-shown on the next strike).

**Entry row (`FSoStrikeEntry`): one swing, with trail and hit decoupled**
`TrailDelay` (swoosh spawns), `StrikeDelay` (hit check opens, must be >= TrailDelay), `StrikeDmgDuration` (default 0.1 s), `TrailMesh`, `bAttachToCharacter`, `TrailDisplayTime` (0.6 s), `TranslucencySortPriority`, `HitEffects[]`. A step can have several entries (a double-slash, a spin with two hits), each with its own dedupe list.

**Weapon-compatible specials, our shape.** Each weapon row owns `arts: { primary: <chainId>, special: <chainId> }` and a weapon *class* (`oneHanded | twoHanded | dualWield | polearm | ...`). A special move row declares `compatibleWeaponClasses: []` plus per-class overrides for the three columns that change (clip, trail mesh/blade path, entry timings), so one art ("whirl") reuses its rules across sword, scythe, trident, maul, warhammer.

**TS data row (weapon + special):**
```json
{ "id": "scythe", "class": "twoHanded", "baseDmg": 14, "specialDmg": 26,
  "interruptModifier": 1, "critMult": 2.0, "autoAimUnits": 4.0,
  "trail": { "color": [4.8,5.0,1.2], "light": [100,7.8,0] },
  "arts": { "primary": "scythe.chain", "special": "whirl" } }
{ "id": "whirl", "cooldownMs": 6000, "cooldownTicksInAir": false,
  "perClass": { "twoHanded": { "clip": "scythe_whirl", "steps": [ /* entries */ ] } } }
```

## 3. Damage, poise/stagger, hit reaction, hit-stop

**Files:** `SoAStrike.cpp:471-595` (`ApplyDamage`), `CharacterBase/SoIMortalTypes.h` (`FSoMeleeHitParam`, `FSoHitReactDesc`), `Enemy/SoEnemy.cpp:1195-1345` (`CauseDmg`, `MeleeHit_Implementation`), `Character/SoCharStates/SoActivity.cpp:1237-1290`, `SoAHitReact.cpp`.

**Hit volume = the swoosh mesh.** `ApplyDamage` enables QueryOnly collision on the entry's `TrailMesh` actor and calls `ComponentOverlapMulti` against the physics-body channel. The visible swoosh *is* the hitbox, so art and gameplay cannot disagree. Hits are deduped per component in `ComponentsAlreadyHitA/B` (index 0 and 1 of the entry list), and merged into a `HitList` keyed by actor so one swing = one hit per actor per tick, with the struck bones accumulated into `AssociatedBones` (used for crit zones).

**Player damage formula** (line 560): `weaponDmg(special?) * clamp(4 * LandingAmount / 1000, 1, 10) * critMultiplier * charSheet.DamageModifiers`, plus enchant `WeaponBoost.BonusDamage`. So a plunge strike scales with fall distance (1x to 10x). Crit is `rand < critChance`. Hit carries `HitReactDesc.Irresistibility = InterruptModifier + 1`.

**Enemy side (`MeleeHit_Implementation`) order of checks:**
1. ignore if dead / `bIgnoreDamage`.
2. **Cover trace**: line trace from attacker to hit point against world-static; blocked means no hit.
3. `BoneToIgnore` (armoured body part, hit on it does nothing).
4. **Block roll**: `BlockChance >= rand`, and the current action must be interruptible; fires the Block action list; returns false so the attacker gets `OnBlocked`. `BlockChance` ramps by `BlockChanceDelta` per second (clamped 0..1), so an enemy can turtle up over time or become blockable.
5. Hit effects applied *before* damage so an effect can veto the flinch.
6. Friendly fire scaled to 0.1.
7. `CauseDmg` then decides stagger (below).

**Stagger rule (poise equivalent):**
```
if (activeAction && !bHitreactBlock && RessistanceToInterrupts < hit.Irresistibility && activeAction.IsInterruptible())
    interrupt and (re)select a HitReact action
else damage lands but the enemy keeps attacking (super armour)
```
`RessistanceToInterrupts` (int per enemy), `bHitreactBlock` (permanent hyper-armour), action-level `bInterruptible` (windup/active frames set false = armour only during the swing). `StunResistance` (0..1) is a separate roll for status stuns (`ASoEnemy::Stun`, line 576): `>= 1` shows "Immune", otherwise `stunResistance <= rand` to succeed, else "Resisted".

**Player hit reaction (`USoActivity::OnDmgTaken` + `USoAHitReact`)**
- Difficulty scale on incoming damage: Sane x0.5, Insane x2.
- `DamageBlockCounter` i-frames after a hit: `DamageBlockTime = 0.5s`, `DamageBlockTimeMelee = 1.0s` (SoCharacter.h:1283). While active, damage is ignored and strike input is dropped.
- Reaction type enum: `Stun, JumpAway (0.4s), JumpAwayLight (0.1s, anim forced 0.4s), Pushed (stun time from PushDesc or 0.4s), FallToDeath (1.0s), BreakIntoPieces (0.8s)`. Knockback: `HitReactVelocity = 600` horizontal, `HitReactVelocityZ = 300`, direction from attacker side. Hit-react bounces off walls with damping 0.6.
- **On entering HitReact all live trails are cut** (`Slide = 1`, hidden, returned to the pool; `SoAHitReact.cpp:OnEnter`). A flinched swing leaves no ghost swoosh.
- Feedback on damage (`SoActivity.cpp:1268-1273`): camera shake (`HitReactCamShake`), controller rumble, a BP "light effect", material flash (`EVE_Damaged`), SFX at the impact point (`SFXFOnMeleeHit` / `...Death`).

**Hit-stop:** none. (We have it; keep ours.)

**Already ours:** posture, guard, parry, hit-stop rows, camera kick. **Improvements:** `irresistibility` vs `interruptResist` integer pair on moves and bodies (cheap, readable, authorable per boss phase); per-action `interruptible` windows (armour during active frames); body-part `BoneToIgnore`/crit-zone through `AssociatedBones`; cover trace; block chance with time ramp; plunge-distance multiplier; cut trails on flinch.

**TS data row (hit):**
```json
{ "id": "scythe.primary.1.hit", "dmgMult": 1.0, "irresistibility": 2,
  "knockback": { "h": 6.0, "v": 3.0 }, "stunMs": 400, "effects": ["bleed"],
  "critZones": ["head"], "blockable": true }
{ "id": "ogre", "interruptResist": 2, "hyperArmour": false, "stunResist": 0.5,
  "blockChance": 0.2, "blockChanceRatePerSec": 0.05, "ignoreBones": ["shield"] }
```

## 4. Stamina and dodge i-frames

**Result: absent.** `bStaminaReg` is a dead flag; the roll is not invulnerable; the only protection is the post-hit `DamageBlockCounter` (0.5 / 1.0 s). The roll does carry two useful details that are not about i-frames:
- **Momentum carry:** if the player jumped 0.1-0.5 s before rolling, `MaxWalkSpeed` is boosted to `2*rollSpeed - walkSpeed` for the jump's elapsed time (`SoARoll.cpp:OnEnter`). A cheap "roll out of a jump keeps speed" row.
- **Wall-jump lockout:** `CanBeInterrupted` refuses exit for `ForcedToMoveTimeAfterWallJump` after a wall bounce.

**Steal:** one idea only: the *post-hit invulnerability with different durations per reaction type* (0.5 s default, 1.0 s melee) as a data pair `iFramesMs` on each hit-react row, which prevents multi-hit stunlock. We already have stamina/roll, so skip the rest.

**TS row:** `{ "id": "react.pushed", "iFramesMs": 1000, "stunMs": 400, "dropAttackInput": true }`

## 5. Enemy and boss action system (the part most worth reading for Pit bosses)

**Files:** `Enemy/SoEnemy.{h,cpp}` (brain loop), `Enemy/EActions/*` (actions), `Enemy/EPreconditions/SoEPrecondition.{h,cpp}`, `Enemy/SoEnemyDataTypes.h` (`FSoStrike`, `FSoStrikePhase`, `ESoActionList`), `CharacterBase/SoCombatComponent.cpp` (hit sweeps).

**Summary**
- Utility-style AI. An **action** (`USoEAction`) has `Preconditions[]`, `bInterruptible`, `bOnlyWhileEvaluated`, `LastUsageTime`. `Evaluate()` returns the **product** of its preconditions' values; the first zero short-circuits to 0 (`SoEAction.cpp`). Each precondition returns its `TrueValue` (weight) or 0.
- `ASoEnemy::ChooseActionFromList` (`SoEnemy.cpp:472`): evaluate every action in the active list, keep those > 0, then **weighted random roulette** on the values. Lists that must be deterministic (block, hit-react, blocked) use `GetFirstSatisfiedAction` instead.
- **Named lists** (`ESoActionList`): `Idle, Melee, Ranged` (selectable slots), `Block, HitReact, Blocked` (code-driven). The brain auto-switches Idle <-> Melee every `SwitchBetweenNamedActionListsInterval` using **hysteresis**: enter Melee when distance < `AlertDistance` (and |dz| < `AlertDistanceZ`), leave when > `AlertOffDistance`; returning to Idle waits 0.5 s.
- **Composition actions** (`SoEAActionComposition.h`, `SoEAExecuteFirst`, `SoEAParallel`): `ActionChainElement` (primary then one of N secondaries picked by precondition = a combo with branching follow-ups), `ActionSequence` (list, `LoopCount`, re-check preconditions each loop), `Randomer` (`Chances[]`, `bLowerChanceToRepeat` multiplies a repeated pick by 0.6, or 0.3 on the third in a row), `ActionList`, `ExecuteFirst`, `Parallel` (modes ExecuteAtOnce / TrySecondPauseFirst / ExecuteFirstWhileNotSecond with `SecondTryInterval = 1.5s`).
- **Preconditions** worth copying: distance band (spline / straight / Z), `NotFacingPlayer`, `WasNotUsedRecently{SoftTimeDelta, HardTimeDelta, SoftTimeValue, HardTimeValue}` (linear ramp from "just used, 0" to "ready, full weight"), `Random{Percent}`, `BlockedRecently{MaxTimeDelta}`, `LastID{type: Strike|Block|HitReact, name}` (follow-up gated on the last strike name = deterministic combos), `FloatValueIsGreater/Smaller` (TimeSinceLastBlock, TimeSinceLastHitReact, BlockChance...), `IsStandingOnGround`, `IsPlayerAlive`, `RangeAttackTestHit`.
- **Strike = authored timeline of phases** (`FSoStrike{Phases[], bLookAtPlayer}`, loaded from the `.sc` strike map). `FSoStrikePhase`: `Duration`, `Animation`, `bLooped`, `AnimationDuration` (anim shorter/longer than logic), `RootMotion[{From,To,desc}]`, `ControlledMotion[{From,To,Speed,bStopIfStuck,bHorizontal}]`, `WeaponCollision[{From,To,Slot}]`, `Damage`, `PushDesc`, `bBlockable`. `USoEAStrike::Update` (SoEACombat.cpp) is the same crossing test as the player (`From >= old && From < new`).
- **Telegraph = phase structure, not a flag.** A windup phase has no `WeaponCollision` and no damage; the next phase turns the weapon window on. The animation *is* the tell. Armour during the swing comes from setting `bInterruptible=false` on the strike action. There is no separate telegraph VFX system.
- **Boss behaviour = list switching.** No phases code. A boss gets a second `Melee` list and a script calls `ChangeActionList`/`SwitchActionListImmediately` (which interrupts the current action) at an HP threshold; `ModifyFloatValue(BlockChance, +x)` toggles shield-up. So "phase 2" costs one JSON row of weights plus a trigger.
- **Enemy weapon sweep** (`USoCombatComponent::TickComponent`): each registered weapon has `StartSocket`, `EndSocket`, `PartitionNum`, `TraceRadius`. Per tick, for each of N+1 points along the blade, sweep a sphere from the *previous* point to the *current* point (swept volume, no tunnelling at low frame rates); skip if the weapon did not move; dedupe `(actor, weaponSlot)` once per strike (`bOneActorOncePerStrike`, reset in `SetupNewStrike`). Hit reaction default `Pushed` with the phase's `PushDesc`.
- Telegraph numbers: none in the repo (data files absent). Defaults in headers: `WaitSecAfterLand = 0`, `RessistanceToInterrupts = 0`, `BlockChance = 0`.

**Already ours:** blade paths, posture, parry. **Improvements:** everything in this section is new for a Pit boss brain.

**TS data rows:**
```json
{ "id": "pit.warden", "lists": { "idle": [...], "melee": ["slam","chain3","charge","lunge"], "melee_p2": ["slam","chain5","charge2"] },
  "alertM": 12, "alertOffM": 16, "phaseSwitch": [{ "hpBelow": 0.5, "list": "melee_p2", "waitMs": 800 }] }
{ "id": "slam", "weight": 1.0, "interruptible": true,
  "pre": [ { "t": "dist", "min": 1.5, "max": 5 },
           { "t": "unusedFor", "softMs": 2000, "hardMs": 8000, "softVal": 0.1, "hardVal": 1.5 },
           { "t": "lastStrike", "not": "slam" } ],
  "phases": [ { "ms": 700, "clip": "windup" },
              { "ms": 180, "clip": "swing", "weaponWindow": [[0,180]], "armour": true, "dmg": 30, "irres": 3, "blockable": false },
              { "ms": 500, "clip": "recover" } ] }
```

## 6. Weapon trail, VFX, camera shake, sound-on-hit hooks

**Files:** `SoAStrike.cpp:415-468` (`ApplyTrail`), `Character/SoCharacter.cpp:625-643` (trail fade), `SoCharacter.h:1122 (HitReactCamShake), 1630 (TrailCurve)`, `SoActivity.cpp:1268`, `SoAStrike.cpp:506-541` (wall hit FX).

- **Trail lifecycle.** At `TrailDelay` the strike takes a pooled `AStaticMeshActor` (`Orb->WeaponTrailMeshes`), swaps in the entry's `TrailMesh`, sets `Slide=0` and `Color` / `AnimLight` HDR parameters from the weapon (or from a `FSoWeaponBoost` override for that weapon template: enchants recolour the swoosh and add impact FX). It is attached to the character mesh with absolute rotation (`bAttachToCharacter`, rides with the body but does not tilt) or left in world space (a slash that stays where it was thrown). Each frame `Slide = TrailCurve(1 - counter/TrailDisplayTime)` fades it (default 0.6 s); at the end it is hidden and returned to the pool. A flinch cuts all trails instantly.
- **Camera shake / feedback:** only on the *player being hit* (`HitReactCamShake`, controller vibration, damaged material flash). No camera feedback on landing a hit. (We already kick the camera on landed melee specials; ours is the better design here.)
- **Sound on hit:** `SFXFOnMeleeHit` / `SFXFOnMeleeHitDeath` (player taking a hit) at the impact point; enemy voice lines on hit-react with a chance column (`VOChanceHitReact`); a "cannot" sound when a special is on cooldown (`SFXFCanNot`, played once per attempt).
- **World-hit FX:** striking world geometry looks up the physical material and spawns a wall-hit particle and sound from tables (`USoGameSingleton::GetWallHitVFXFromPhysicalMaterial` / `...SFX...`), only if the contact is above `IgnoreWallHitBellowZThreshold` (default -5) so ground scrapes are ignored.
- **Damage numbers:** `USoEnemyHelper::DisplayDamageText` with a critical flag; stacked when multiple hits land in one frame (`bWasHitThisFrame`).

**Improvements for us:** pooled swoosh with an authored fade curve and per-weapon HDR colour; enchant/boost recolour; per-material hit FX table keyed by surface; "cannot" cue and cooldown-block UI event; trail cut on flinch.

**TS data rows:**
```json
{ "id": "trail.scythe", "mesh": "swoosh_wide", "attach": "body", "showMs": 600, "fadeCurve": "ease_out",
  "color": [4.8,5.0,1.2], "light": [100,7.8,0], "sortPriority": 0 }
{ "id": "surface.stone", "hitFx": "sparks", "hitSfx": "clang_stone", "minHeightM": -0.05 }
```

## 7. What not to port
- Spline-locked 2.5D movement, orb roll/bounce/wall-jump, floating umbrella, respawn "break into pieces".
- The UE `AnimBlueprint` double-buffered A/B animation data (`bStrikeA`, `AnimDataA/B`); we have clips and a deterministic sim.
- Commented-out horizontal movement table (`HorizontalMovements`, marked "NOT USED").
- The anti-spam lock (`bBanStrikeCauseSpamming`): they left it disabled.

---

# Ranked: the 8 most valuable things to port

Rank order = (value to weapon-compatible specials and Pit bosses) / effort. All are data-first (rows + loader).

### 1. Strike entries: trail window and hit window decoupled, multiple swings per step
Why: one move row expresses a double slash, spin, or delayed shockwave, and the swoosh/blade path stays independent of when damage can land.
```ts
type Entry = { trailDelayMs: number; hitDelayMs: number; hitDurMs: number; trail?: string; effects?: string[] };
type Step  = { durationMs: number; recoveryMs: number; entries: Entry[] };
function tickStep(s: Step, oldT: number, t: number, out: Hooks) {
  s.entries.forEach((e, i) => {
    if (oldT <= e.trailDelayMs && t > e.trailDelayMs) out.spawnTrail(e.trail, i);
    const open = e.hitDelayMs, close = open + e.hitDurMs;
    if ((oldT >= open && oldT <= close) || (t >= open && t <= close)) out.sweepHit(i, e); // per-entry dedupe set
  });
}
```

### 2. Combo chain with a recovery-tail cancel/buffer window and chain-end cooldown
Why: clean Souls-style chaining; special cooldown charged once at chain end, so a combo is never half-locked.
```ts
function onStrikeTick(st: StrikeState, w: WeaponRow, now: number) {
  const inTail = st.remainingMs < st.step.recoveryMs;
  st.locked = !inTail;                                  // cancel/buffer only in the tail
  if (!inTail) return;
  if (input.rollHeld) return cancelTo('roll');
  if (now - st.lastPressMs <= w.inputBufferMs) {
    const more = st.idx + 1 < st.chain.steps.length;
    if (more) return startStep(st.idx + 1);
    if (!st.chain.cooldownMs) return startStep(0);     // loop only if no cooldown
  }
  if (st.remainingMs <= 0) { if (st.chain.cooldownMs) addCooldown(st.chain.id, st.chain.cooldownMs - st.recoveryMs); toIdle(); }
}
```

### 3. Utility brain: multiplicative preconditions, weighted roulette, repeat avoidance
Why: the whole Pit boss brain in ~40 lines; adding a move or phase is one JSON row.
```ts
const evalAction = (a: Action, c: Ctx) => a.pre.reduce((v, p) => v > 1e-4 ? v * PRE[p.t](p, c, a) : 0, 1);
function choose(list: Action[], c: Ctx, rng: Rng) {
  const cand = list.map(a => [a, evalAction(a, c)] as const).filter(([, v]) => v > 1e-4);
  if (!cand.length) return null;
  let r = rng.next() * cand.reduce((s, [, v]) => s + v, 0);
  for (const [a, v] of cand) if ((r -= v) <= 0) return a;
  return cand[cand.length - 1][0];
}
PRE.unusedFor = (p, c, a) => { const d = c.nowMs - a.lastUsedMs; return d < p.softMs ? 0 : d > p.hardMs ? p.hardVal : p.softVal + (p.hardVal - p.softVal) * (d - p.softMs) / (p.hardMs - p.softMs); };
```
(Use our seeded sim RNG, never `Math.random`, to stay deterministic at 60 Hz.)

### 4. Irresistibility vs interrupt-resist (+ hyper-armour, armour windows)
Why: a one-integer, readable stagger rule that complements our posture meter; lets a heavy art break a boss's swing and a boss row grant armour only in the active frames.
```ts
function resolveStagger(def: Body, act: Action | null, hit: Hit): 'flinch' | 'armoured' {
  const armoured = def.hyperArmour || (act && !act.interruptibleNow()) || def.interruptResist >= hit.irresistibility;
  return armoured ? 'armoured' : 'flinch';     // damage always lands; only the reaction differs
}
// move row: { irresistibility: weapon.interruptModifier + 1 }  boss row: { interruptResist: 2 }
```

### 5. Enemy strike as an authored phase timeline (windup, active window, recover) with motion windows
Why: telegraph = structure (no collision during windup), armour/dmg/knockback per phase, root and controlled motion as windows. Same crossing test as the player.
```ts
type Phase = { ms: number; clip: string; weaponWindow?: [number, number][]; motion?: { from: number; to: number; speed: number; stopIfStuck?: boolean }[]; dmg?: number; irres?: number; armour?: boolean };
function tickPhase(p: Phase, a: number, b: number, o: Owner) {
  p.weaponWindow?.forEach(([f, t]) => { if (t >= a && t < b) o.setWeapon(false); if (f >= a && f < b) o.setWeapon(true); });
  p.motion?.forEach(m => { if (m.from >= a && m.from < b) o.pushMotion(m); if (m.to >= a && m.to < b) o.popMotion(m); });
  o.armour = !!p.armour;
}
```

### 6. Named action lists with hysteresis and HP-threshold list switching (boss phases)
Why: Idle <-> Melee with separate enter/leave distances stops flicker; a boss phase is "swap list + short wait".
```ts
function updateLists(b: Boss, c: Ctx) {
  if (b.list === 'idle' && c.dist < b.def.alertM) b.switchList('melee');
  else if (b.list.startsWith('melee') && c.dist > b.def.alertOffM) b.switchList('idle', 500);
  for (const s of b.def.phaseSwitch) if (!b.fired.has(s) && b.hp / b.maxHp <= s.hpBelow) { b.fired.add(s); b.switchList(s.list, s.waitMs); }
}
// switchList() interrupts the active action, then stalls waitMs (the roar/transition beat)
```

### 7. Special-move modifier flags: plunge multiplier, aerial requirement, freeze-in-air, thrown weapon
Why: gives each weapon-compatible special a different identity with columns, not code (scythe plunge, trident throw, hammer slam).
```ts
type Mods = { requiresJump?: boolean; freezeInAir?: boolean; plunge?: { sweepM: number; perM: number; max: number };
              projectile?: { id: string; atMs: number; hideWeaponMs: number }; status?: string };
function onLand(m: Mods, fallM: number) { return m.plunge ? Math.min(m.plunge.max, Math.max(1, fallM * m.plunge.perM)) : 1; } // damage mult
// WarriOrb: clamp(4 * landing/1000, 1, 10)
function startStep(m: Mods, c: Char) { if (m.requiresJump && c.onGround) { c.jump(); return wait(200); } if (m.freezeInAir && !c.onGround) { c.vel.set(0,0,0); c.gravityScale = 0; } }
```

### 8. Trail lifecycle as data: pooled swoosh, authored fade, per-weapon HDR colour, cut on flinch, boost recolour
Why: weapon trails per weapon with zero code per weapon; consistent with "weapon trails" ask; enchant visuals come free.
```ts
type TrailRow = { mesh: string; attach: 'body' | 'world'; showMs: number; fadeCurve: string; color: [number, number, number]; light: [number, number, number] };
class TrailPool { free: Trail[] = []; live: Trail[] = [];
  spawn(row: TrailRow, boost?: Partial<TrailRow>) { const t = this.free.pop() ?? new Trail(); t.init({ ...row, ...boost }); this.live.push(t); return t; }
  tick(dtMs: number) { for (const t of [...this.live]) { t.age += dtMs; t.slide = CURVES[t.fadeCurve](t.age / t.showMs); if (t.age >= t.showMs) this.release(t); } }
  cutAll() { this.live.forEach(t => { t.slide = 1; this.release(t); }); }   // call on flinch
}
```

**Also worth a later pass (not top 8):** swept-sphere blade partitions with once-per-swing dedupe (`SoCombatComponent.cpp`), per-surface hit FX tables, block-chance ramp (`BlockChanceDelta`), swoosh-mesh-as-hit-volume plus pre-swing auto-aim flip (`WouldHitMortals`).
