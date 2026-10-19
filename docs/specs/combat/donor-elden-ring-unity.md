# Donor study: Elden Ring clones in Unity (AbdullahSevin, yonathangashu) plus the garyttierney RE list

Read-only study, 2026-10-17. Lane: combat-sandbox. Nothing here is committed or wired in.

## 0. LICENCES AND CREDIT RULES (read first)

| Donor | Path (VPS) | Licence | What we may do |
|---|---|---|---|
| AbdullahSevin-EldenRingInUnity | `/mnt/frankendom-donors/AbdullahSevin-EldenRingInUnity` | `LICENSE` file is MIT, "Copyright (c) 2024 AbdullahSevin". | Ideas, data shapes and numbers: free. Verbatim code: "port with credit and with care" (see tutorial note). |
| yonathangashu-Elden-Ring | `/mnt/frankendom-donors/yonathangashu-Elden-Ring` | NO LICENSE file anywhere (only a README). All rights reserved. | DESIGN ONLY. Never copy or transliterate code. Do not use any asset in it. |
| garyttierney-elden-ring-open-re | `/mnt/frankendom-donors/garyttierney-elden-ring-open-re` | README only, no licence. | Knowledge pointer only. We do NOT use decompiled game data. |

**Tutorial lineage (important).** yonathangashu's README says outright that it is built on "Sebastian Graves' tutorials". The Abdullah repo uses the same class skeleton (`CharacterManager`, `WorldCharacterEffectsManager`, `TakeDamageEffect`, `PlayerLocomotionManager`, `CharacterNetworkManager`, the `InstantCharacterEffect` / `StaticCharacterEffect` split, `WorldSaveGameManager`). That lineage is my inference from the matching names; Abdullah's repo has no README saying so. So the MIT notice covers Abdullah's own work only, and any line that is really Graves' tutorial code has no licence we can see. Rule for this doc:
- Treat every IDEA, data column, number and algorithm as safe to reuse.
- Treat verbatim code as "port with credit and with care": we write our own TypeScript from the descriptions below, and the PR body says `Donor: AbdullahSevin-EldenRingInUnity (MIT), ideas and numbers, TS rewritten`.
- For yonathangashu, nothing below is code-derived. It contributes only the clip NAME list of a commercial pack (section 8), as a design checklist.

**garyttierney-elden-ring-open-re** is a 15-line README titled "Reversing Elden Ring", "a living document on the inner workings of Elden Ring". It has three headings (The basics, Regulation) and says the regulation file is AES-256-CBC encrypted like Dark Souls 3, then gives a key and says the plaintext is a DCX holding a BND4. It contains NO link list and NO combat knowledge. Its subject is extracting FromSoftware's param tables. We do NOT use decompiled or extracted game data (their numbers are FromSoftware's property). I do not repeat the key. Skip it.

**Scope warning.** Both repos are tutorial-stage hobby clones. The real combat is only in Abdullah's repo (125 `.cs`, 35 of them are combat, AI, items). yonathangashu's repo (35 `.cs`) stops at locomotion, camera, input, a stamina-damage effect, saves and UI. It has no weapons, colliders, poise, parry or AI. So sections 1 to 7 describe Abdullah's code; yonathangashu adds only: roll costs 25 stamina, sprint 2/s, jump 25, and a clip checklist.

Also not Elden Ring: Abdullah added a "Kamehameha" typed-key special (`PlayerInputManager.HandleSpecialMoveInput`, keys K,A,M,E,H,A,M,E,H,A within 3 s). A gimmick, not a weapon art. Not for a phone. Ignore.

## 1. Attack states, combos, input buffer, root motion

**Files.** `Assets/Scripts/Weapon Actions/{WeaponItemAction,LightAttackWeaponItemAction,HeavyAttackWeaponItemAction,OffHandMeleeAction}.cs`; `Character/CharacterAnimatorManager.cs` (`PlayTargetAttackActionAnimation`, `PlayTargetActionAnimation`, `PlayTargetActionAnimationInstantly`, `UpdateAnimatorController`); `Character/Player/PlayerAnimatorManager.cs` (`OnAnimatorMove`, `EnableCanDoCombo`, `DisableCanDoCombo`); `Animator/ResetActionFlags.cs`, `Animator/ToggleAttackType.cs`; `Character/Player/PlayerInputManager.cs` (`QueInput`, `ProcessQuedInput`, `HandleQuedInputs`, `HandleChargeRTInput`).

**How it works.**
1. A weapon row holds three action references: `oh_RB_Action` (light), `oh_RT_Action` (heavy), `oh_LB_Action` (off-hand/guard). Each action is a small object ("WeaponItemAction") with an `actionID` and an `AttempToPerformAction(player, weapon)` method.
2. `LightAttackWeaponItemAction` picks a variant in a fixed priority: not grounded -> nothing (the jump attack branch is a stub); sprinting -> running attack; `canPerformRollingAttack` -> rolling attack; `canPerformBackstepAttack` -> backstep attack; otherwise (try a critical first) -> light 1/2. Every variant has a one-hand and a two-hand clip name.
3. Combo chain: if `canComboWithMainHandWeapon` (a flag set by an animation event) AND the player is mid-action, the next move is chosen from `lastAttackAnimationPerformed`: after light 1 play light 2, anything else play light 1 (so it loops 1,2,1,2). Heavy works the same with its own pair. The flag is consumed on use. If not mid-action, start light 1.
4. The clip name goes to `animator.CrossFade(name, 0.2f)`. Riposte, backstab, parried and special moves use `Play(name)` (no blend) instead.
5. Weapon compatibility lever: the animator state NAMES are the same for every weapon; each weapon row carries an `AnimatorOverrideController` that swaps in that weapon's clips. `PlayTargetAttackActionAnimation` calls `UpdateAnimatorController(weapon.weaponAnimator)` before every attack. The repo has four overrides: Straight Sword, Spear, Medium Shield, Unarmed (`Assets/Arts/Animations/_Controllers/*.overrideController`). Because animation events live in the clips, each weapon gets its own timings for free.
6. Per-action movement flags are set by the caller: `applyRootMotion`, `canRotate`, `canMove`. Default for attacks: root motion on, cannot rotate, cannot move. Running attack: root motion on, CAN rotate, CAN move (steer while swinging). `isPerformingAction` is true for the whole clip.
7. Root motion: `PlayerAnimatorManager.OnAnimatorMove` adds `animator.deltaPosition` to the character controller and multiplies rotation by `deltaRotation` while `applyRootMotion` is set.
8. End of action: every action returns to an "Empty" animator state that carries `ResetActionFlags` (a `StateMachineBehaviour`). It clears `isPerformingAction`, root motion, restores `canRotate`/`canMove`, clears canCombo, rolling/backstep-attack windows, and the networked flags `isJumping, isInvulnerable, isAttacking, isRipostable, isBeingCriticallyDamaged, isParrying`. One reset point instead of every clip cleaning up.
9. `ToggleAttackType` is another state behaviour that stamps `currentAttackType` on state entry (so damage uses the right modifier even when the animator, not code, chose the state).
10. Charge: while performing an action with the right hand, `isChargingAttack = Hold_RT_Input` each frame; the animator bool `isChargingAttack` keeps a looping "hold" sub-clip alive and release lets it play on. Their own note: hold time must be shorter than the hold clip or the release never fires.
11. Input buffer: `QueInput` runs on a button press. If the player is busy (performing an action or jumping) it sets `que_RB_Input`/`que_RT_Input`, `que_Input_Timer = default_Que_Input_Time = 0.35 s`. Each frame while the timer runs, `ProcessQuedInput` re-asserts `RB_Input`/`RT_Input`, so the action keeps retrying until the state allows it (combo window opens, or the action ends) or 0.35 s passes. Each new press overwrites the previous queue. Only RB and RT are buffered; dodge and parry are not.

**Data used.** Per weapon: three action refs, an override controller, `baseStaminaCost = 20`, kind multipliers (section 4). Per action: ~14 string clip names.

**Key numbers.** CrossFade 0.2 s; buffer 0.35 s (21 ticks at 60 Hz); stamina gate "greater than 0", not "at least the cost"; jump/aerial attacks are stubs.

**As data (our engine).** One `attack-chains.json` row per weapon class and slot: `{ "id":"sword.light", "chain":["sword.light1","sword.light2"], "loop":true, "variants":{"sprint":"sword.run","roll":"sword.rollAtk","backstep":"sword.backAtk"}, "moveFlags":{"rootMotion":true,"canRotate":false,"canMove":false}, "bufferFrames":21 }`. The loader resolves `variants` by player state. Weapon rows reference a clip-set id; the clip table maps `(stateName, weaponClass)` to a clip, the TS version of an override controller.

**Improvements over what we have.** (a) One "reset point" row (what an action end clears) instead of per-clip cleanup. (b) Buffer that retries every tick for N frames rather than a one-shot flag. (c) State-name x weapon-class clip table so a new weapon is only a new column, not new code.

## 2. Damage colliders on animation events, damage, poise, stagger, directional reactions

**Files.** `Colliders/{DamageCollider,MeleeWeaponDamageCollider}.cs`, `Items/WeaponManager.cs` (`SetWeaponDamage`), `Character/Player/PlayerEquipmentManager.cs` (`OpenDamageCollider`, `CloseDamageCollider`), `Effects/{TakeDamageEffect,TakeBlockedDamageEffect,TakeCriticalDamageEffect}.cs`, `Character/CharacterStatsManager.cs` (poise fields, `HandlePoiseResetTimer`), `Character/CharacterAnimatorManager.cs` (hit lists, `GetRandomAnimationFromList`), `World Managers/WorldUtilityManager.cs` (`GetDamageIntensityBasedOnPoiseDamage`, `CanIDamageThisTarget`).

**Active frames.** A weapon's collider is disabled at spawn. Animation events call `OpenDamageCollider` (enable, plus play a random whoosh SFX from the weapon row) and `CloseDamageCollider` (disable, and clear the "already hit" list so the next swing can hit again). Event times in the shipped clips (frames at 60 Hz in brackets), read from `m_Events` in the `.anim` files:

| Clip (`Assets/Arts/Animations/Humanoid/...`) | clip len | DrainStamina | OpenCollider | EnableCanDoCombo | CloseCollider |
|---|---|---|---|---|---|
| Sword Main_light_att_01 (also running, rolling) | 0.567 s [34f] | 0.133 [8f] | 0.167 [10f] | 0.267 [16f] | 0.400 [24f] |
| Sword Main_light_att_02 | 0.833 s [50f] | 0.433 [26f] | 0.467 [28f] | 0.600 [36f] | 0.633 [38f] |
| Sword Backstep_Att_01 | 0.833 s | 0.433 [26f] | 0.467 [28f] | none | 0.633 [38f] |
| 2Hand-Sword 2HandAttack02 | 1.333 s [80f] | 0.067 [4f] | 0.167 [10f] | none | 0.967 [58f] |
| Explosive 2Hand-Attack1 (in FBX meta) | 30 src frames | 0.291 s | 0.324 s | 0.505 s | 0.821 s |

So the pattern is: stamina paid 2 to 3 frames BEFORE the collider opens (cancel in that gap and the swing is free), collider open 14 frames (light 1) to 10 frames (light 2), combo window opens after the hit starts and stays open until the clip ends.

**Hit test.** `OnTriggerEnter`: find the owning character; skip self; skip same team (`CanIDamageThisTarget` over a two-value team enum); check parry, then block, then, if the victim is not `isInvulnerable`, apply damage. A per-swing `charactersDamaged` list stops multi-hits. The contact point is `ClosestPointOnBounds` of the victim collider (used for blood FX).

**Damage.** Damage = physical + magic + fire + lightning + holy, each already multiplied by the attack-kind modifier (section 4), minimum 1. No defence subtraction; armor absorption exists as fields but is not applied in `TakeDamageEffect`. The attacker owns the hit and sends the numbers to everyone (networking, not needed).

**Poise (player and generic).** Per character: `basePoiseDefense` (sum of armor `poise`), `offensivePoiseBonus`, `totalPoiseDamage` (negative running total), `defaultPoiseResetTime = 8 s`. Each hit: `totalPoiseDamage -= poiseDamage`; reset timer set to 8 s; `remaining = basePoiseDefense + offensivePoiseBonus + totalPoiseDamage`; `remaining <= 0` -> poise broken. When the timer reaches 0, `totalPoiseDamage = 0`. (Quirk: poise is not reset on a break, so while the 8 s timer is alive every further hit also staggers. Elden Ring resets after a break. We should reset on break.)

**Reaction by direction.** `angleHitFrom = SignedAngle(attacker.forward, victim.forward, up)`. Bands: 145 to 180 or -180 to -145 -> "forward" hit (victim was hit from the front); -45 to 45 -> "backward" (hit from behind); -144 to -45 -> left; 45 to 144 -> right. Two variants per band per tier (Ping and Medium, 16 clip names `hit_Forward_Ping_01` ...). `GetRandomAnimationFromList` removes the last played variant so you never see the same clip twice. Poise broken -> Medium tier, full action lock (`isPerformingAction = true`). Not broken -> Ping tier, played as a non-blocking overlay (`isPerformingAction=false`, no root motion, can rotate and move), so small hits flinch without cancelling the player's action.

**Damage intensity bands (used for block clips and stance break).** From the attack's modified poise damage: <10 Ping, >=10 Light, >=30 Medium, >=70 Heavy, >=120 Colossal.

**AI stance (the enemy's poise).** `AICharacterCombatManager`: `maxStance`, `currentStance`, hits subtract poise damage, regen `stanceregeneratedPersecond = 15` per 1 s tick after `defaultTimeUntilStanceRegenerationbegins = 15 s` without a hit; at 0 -> play `Stance_Break_01` and refill; `ignoreStanceBreak` flag for bosses.

**As data.** `hit-reactions.json`: `{ "tier":"medium", "minPoiseDamage":30, "bands":{"front":["hit_f_med_1","hit_f_med_2"],"back":[...],"left":[...],"right":[...]}, "locksAction":true }` plus a `bandEdges` row `[45,145]` instead of literals. Intensity thresholds `[10,30,70,120]` in a `poise-bands` row. Weapon row: `poiseDamage`, `attackKinds` table. Character row: `poiseDefense`, `poiseResetSeconds`.

**Improvements for us.** (a) Tiered flinch overlay vs full stagger: light hits do not cancel actions (we may already have posture, but a no-lock flinch tier is new). (b) Variant exclusion on reaction clips (never repeat last). (c) Directional 4-band reactions from signed attacker/victim angle. (d) Stamina paid on an event just before the active frames. (e) Same-swing "already hit" list cleared on close.

## 3. Stamina, dodge, backstep, parry, riposte, backstab, block, lock-on, i-frames

**Files.** `Character/CharacterStatsManager.cs` (`RegenerateStamina`), `Character/Player/PlayerLocomotionManager.cs` (`HandleSprinting`, `AttemptToPerformDodge`, `AttemptToPerformJump`, `HandleRotation`), `Character/CharacterCombatManager.cs` (`AttemptCriticalAttack`, `EnableIsInvulnerable`, `EnableIsParrying`, `EnableIsRipostable`, `EnableCanDoRollingAttack`, `EnableCanDoBackstepAttack`, `ForceMoveEnemyCharacterToRipostePosition`, `ApplyCriticalDamage`), `Character/Player/PlayerCombatManager.cs` (`AttemptRiposte`, `AttemptBackstab`, `DrainStaminaBasedOnAttack`), `Character/CharacterNetworkManager.cs` (`ProcessRiposteFromServer`, `ProcessParryFromServer`), `Effects/TakeBlockedDamageEffect.cs`, `Items/Ashes Of War/ParryAshOfWar.cs`, `Character/Player/PlayerCamera.cs`.

**Stamina.** Max = endurance x 10. Regen +2 every 0.1 s (20/s) after a 1 s delay; no regen while sprinting or performing an action; the delay timer restarts whenever stamina drops (an `OnValueChanged` hook). Costs: sprint 2/s, dodge 25, jump 25, attack = `baseStaminaCost (20)` x kind multiplier (section 4), blocked hit = victim takes `attackPoiseDamage x (1 - stability/100)`. Gate is `stamina > 0`, never "enough for the move", so you can go negative.

**Dodge / backstep.** `AttemptToPerformDodge`: refused while acting. Move input -> face the camera-relative input direction and play `Roll_Forward_01` (root motion, no rotate, no move, sets `isRolling`); no input -> `Back_Step_01`. Cost 25 either way. Clip events (times): Back_Step_01 `EnableIsInvulnerable` at 0.0 s, `EnableCanDoBackstepAttack` at 0.55 s [33f], `DisableIsInvulnerable` at 0.833 s [50f] (a very long i-frame span of 50 frames). Roll_Forward_01 has `EnableIsVulnerable` at 0.0 and `DisableIsVulnerable` at 0.233 [14f] and 0.917, but there is no method of that name (the real one is `EnableIsInvulnerable`), so as shipped the roll gives NO i-frames. Intended design: 14 frames of invulnerability. Rolling and backstepping open short windows (`canPerformRollingAttack`, `canPerformBackstepAttack`) so a light attack pressed then turns into a roll attack or backstep attack with its own modifier.

**Block.** `OffHandMeleeAction` raises guard if `canBlock` and not attacking; releasing the button sets `isBlocking=false`. Hit counts as blocked if `dot(attacker - victim, victim.forward) > 0.3` (the vector is not normalised, so the range grows with distance; normalise it). Blocked hit: each damage type reduced by the shield's absorption percent (physical 77/100 on the two sample shields, stability 51 small, 1 medium), stamina damage as above, block clip chosen by intensity band (`Block_Ping_01 ... Block_Colossal_01`), block SFX. If stamina <= 0 -> `Guard_Break_01` and guard drops. Swapping to the shield's animator override happens in `ToggleBlockingController`.

**Parry.** Event `EnableIsParrying` / `DisableIsParrying` on the parry clip. An attacker's current swing is only parryable if its flag `isParryable` is on (AI attack rows set it; reset at action end). If the victim `isParrying` when the collider touches: no damage, the attacker plays `Parried_01` (instant, locked). Parry weapon art picks its clip by weapon class: light shield `Fast_Parry_01`, medium shield `Slow_Parry_01`; sword/spear/fist are empty cases. Costs: `AshOfWar.StaminaCost = 20`, `focusCost` (FP) 0 on the Parry row.

**Riposte / backstab.** Run inside a light attack: `AttemptCriticalAttack` casts `RaycastAll` forward 0.7 m from the lock-on transform on the character layers, ignoring self and allies. Riposte if the victim `isRipostable` (set by an event on the parried/stunned animation) and the viewable angle is within +-60. Backstab if the victim `canBeBackstabbed` and the angle is 145 to 180 or -180 to -145 (their second branch accidentally covers everything below 145 too; fix it). On success: attacker plays `Riposte_01` / `Backstab_01` instantly and becomes invulnerable; the victim gets `Riposted_01` / `Backstabbed_01`; damage = weapon damage x `riposte_Attack_01_Modifier` / `backstab_Attack_01_Modifier` (both 3.3 on the shield rows; poise also x3.3). The victim is dragged into a local offset in front of / behind the attacker for 0.5 s every frame: riposte offset (0.11, 0, 0.7), backstab (0.12, 0, 0.74), per weapon class (`GetRipostingPositionBasedOnWeaponClass`; all classes use the default). The critical damage is stored as `pendingCriticalDamage` and only applied when an animation event calls `ApplyCriticalDamage`, so the number lands on the visual hit.

**Lock-on.** Press: `OverlapSphere` radius 20 on character layers; a candidate needs an angle between -50 and +50 off the camera forward, must be alive, and have a clear `Linecast` (environment layer) between lock-on transforms; nearest by distance wins. Left/right switch uses the candidate's local x. If the target dies, `WaitThenFindNewTarget` waits until the player is not mid-action, then auto-locks the nearest valid target. While locked the player always faces the target, except when sprinting or rolling (then they face input). Strafe animation parameters are snapped to {-1, -0.5, 0, 0.5, 1} (sprint = 2) and damped (0.1). Camera: yaw slerps to the target's lock-on point at 0.2 per frame; pivot height lerps 1.65 -> 2.0 when locked (over about 1 s, SmoothDamp 0.05). Camera collision: sphere cast radius 0.2, lerp 0.2.

**As data.** `dodge.json` (cost, clip, `iFrames:[0,14]`, `opensWindow:"rollAttack"`), `backstep.json`, `lockon.json` `{radius:20, halfAngle:50, requireLoS:true, retarget:"afterAction", camHeight:{free:1.65,locked:2.0}}`, `critical.json` `{rayLength:0.7, riposteHalfAngle:60, backstabMinAngle:145, mult:3.3, snap:{riposte:[0.11,0,0.7],backstab:[0.12,0,0.74]}, snapSeconds:0.5}`.

**Improvements for us.** (a) Attack variants triggered by dodge windows (roll/backstep attack with own modifiers). (b) Critical damage applied on a timeline event, victim snapped to a per-weapon-class offset. (c) Auto-retarget after the current action ends. (d) Block that normalises the angle and drains stamina scaled by stability. (e) Guard-break exactly when stamina hits 0.

## 4. Weapon item data (what a weapon "row" has)

**Files.** `Items/{Item,EquipmentItem,WeaponItem,MeleeWeaponItem,ArmorItem,AshesOfWar/AshOfWar,ParryAshOfWar}.cs`; assets in `Assets/Data/Items/{Weapons/Melee Weapons,Ash Of War,Armor}/*.asset`; registry `World Managers/WorldItemDatabase.cs`.

**Columns of a weapon row** (`WeaponItem` + `MeleeWeaponItem`): `itemName, itemIcon, itemDescription, itemID`; `itemWeight`; `weaponAnimator` (override controller); `weaponModelType` (Weapon/Shield); `weaponModel` (prefab); `weaponClass` (StraightSword, Spear, MediumShield, Fist, LightShield); requirements `strengthREQ, dexREQ, intREQ, faithREQ`; base damage `physical, magic, fire, lightning, holy`; `poiseDamage`; attack-kind damage modifiers; `baseStaminaCost`; stamina multipliers per kind; guard `physical/magic/fire/lightning/holyBasedDamageAbsorption` and `stability`; actions `oh_RB_Action, oh_RT_Action, oh_LB_Action`; `ashOfWarAction`; SFX arrays `whooshes[]`, `blocking[]`; melee-only `riposte_Attack_01_Modifier`, `backstab_Attack_01_Modifier`.

**Real values in the shipped assets** (`Straight Sword`, `BroadSword`, `Spear`, shields): physical 118 (sword), 99 (spear), 66 (small shield), 77 (medium shield), 8 (unarmed); `poiseDamage` 25 for all armed (10 unarmed); `baseStaminaCost` 20 (5 unarmed).

**Attack-kind table, identical on every weapon row:**

| Kind | damage/poise modifier | stamina multiplier | stamina (base 20) |
|---|---|---|---|
| Light 1 / Light 2 | 1.0 / 1.2 | 0.9 | 18 |
| Heavy 1 / Heavy 2 | 1.4 / 1.6 | 1.3 | 26 |
| Charged 1 / 2 | 2.0 / 2.2 | 1.5 | 30 |
| Running | 1.5 | 1.1 | 22 |
| Rolling | 1.2 | 1.1 | 22 |
| Backstep | 1.2 | 1.1 | 22 |
| Riposte / Backstab | 3.3 (melee rows only) | n/a | n/a |

The modifier scales ALL damage types AND the poise damage. The collider copies the weapon row at equip time (`WeaponManager.SetWeaponDamage`), and the live `currentAttackType` picks the modifier at hit time.

**Armor row** (`ArmorItem`): five absorptions, four resistances (immunity, robustness, focus, vitality), `poise`, `itemWeight`, model slots. Armor `poise` sums into `basePoiseDefense` (`PlayerStatsManager.CalculateTotalArmorAbsorption`).

**How weapon arts / spells / consumables attach.** Only weapon arts exist. `WeaponItem.ashOfWarAction` points at an `AshOfWar` item. `AshOfWar` has `usableWeaponClasses[]` (the compatibility list), `focusCost`, `StaminaCost`, virtual `CanIUseThisAbility(player)`, virtual `AttempToPerformAction(player)`. `ParryAshOfWar` implements the gate (not acting, not jumping, grounded, stamina > 0), deducts, then picks a clip by weapon class. Input: LT -> `SelectWeaponToPerformAshOfWar` (always the LEFT-hand weapon, sets the action hand) -> `ashOfWarAction.AttempToPerformAction`. There are no spells (FP is a commented-out stub) and no consumables in code. Items are numbered by position in `WorldItemDatabase`'s lists (`items[i].itemID = i`), so IDs shift when the list changes (bad for saves; use stable string ids).

**As data (our JSON).**
```json
{ "id": "wpn.sword.straight", "class": "sword", "damage": {"physical":118}, "poise": 25,
  "stamina": {"base":20}, "kinds": "kinds.default", "guard": {"absorb":{"physical":50},"stability":50},
  "clipSet": "clips.sword", "art": "art.parry", "sfx": {"whoosh":["sfx.whoosh1"]},
  "crit": {"riposte":3.3,"backstab":3.3} }
{ "id":"kinds.default", "light":{"dmg":[1.0,1.2],"stam":0.9}, "heavy":{"dmg":[1.4,1.6],"stam":1.3},
  "charged":{"dmg":[2.0,2.2],"stam":1.5}, "running":{"dmg":1.5,"stam":1.1}, "rolling":{"dmg":1.2,"stam":1.1}, "backstep":{"dmg":1.2,"stam":1.1} }
{ "id":"art.parry", "weaponClasses":["light_shield","medium_shield"], "cost":{"stamina":20,"focus":0},
  "gates":["notActing","grounded","stamina>0"], "clipByClass":{"light_shield":"parry.fast","medium_shield":"parry.slow"} }
```
`kinds.default` is shared by reference; a weapon only overrides what differs.

**Improvements for us.** (a) `weaponClasses[]` on the ART row gives weapon-compatible specials without code: the art lists which classes may use it and has one clip per class. (b) A shared `kinds` row, with per-kind damage, poise AND stamina columns. (c) Stable string ids, not list indices.

## 5. VFX, trails, SFX, camera hooks

Honest answer: this donor is thin here.
- **Weapon trails:** none. No `TrailRenderer`, no trail script (grep). The only VFX asset is one empty `New Graph.vfx` in `Assets/Arts/VFXS`.
- **Hit-stop:** none. No `timeScale`, no freeze.
- **Camera shake / kick:** none. The camera only does lock-on follow, height lerp and sphere-cast collision.
- **SFX hooks (worth copying):** `OpenDamageCollider` plays a random clip from the weapon row's `whooshes[]`, `CharacterSoundFXManager.PlaySoundFX(clip, volume, randomizePitch=true, pitchRandom=0.1)` (pitch +-0.1), separate calls for damage grunt, attack grunt, block, roll, stance break, critical strike and footsteps (the footstep events `FootL`/`FootR` ride on locomotion clips). Per-weapon `blocking[]` array.
- **VFX hooks:** blood splatter at the contact point (`PlayBloodSplatterVFX(contactPoint)`), a bigger one at the lock-on transform for crits (`PlayCriticalBloodSplatterVFX`), boss stomp impact VFX spawned in an AoE event (`DurkStompCollider.StompAttack`, `OverlapSphere` radius `stompAttackAOERadius`, `stompDamage` also used as poise damage).
- **Kamehameha special:** four anim events (`PlayKamehamehaSoundFX`, `...SmallChargeVFX`, `...ChargeVFX`, `...BurstVFX`, `...BeamVFX`) at clip time 0 or 0.033 s. Shows the right pattern (VFX/SFX are timeline events), nothing more.

**Takeaway.** The architecture to borrow is that EVERYTHING (stamina, collider, combo, i-frames, parry window, ripostable, crit application, whoosh, VFX) is one list of timed events on the clip. Trails, hit-stop and camera kick are things we already have; add them as more event types in that same list.

## 6. Enemy AI states

**Files.** `Character/AI Character/{AICharacterManager,AICharacterCombatManager,AIBossCharacterManager}.cs`, `States/{AIState,IdleState,PursueTargetState,CombatStanceState,AttackState,BossSleepState}.cs`, `Actions/AICharacterAttackAction.cs`, `Data/AI States`, `Data/AI Attack Actions`.

**Model.** States are ScriptableObjects; each owner instantiates its own copies. `Tick(ai)` returns the next state (or itself). Tick runs in `FixedUpdate` on the owner.
- **Idle:** if a target exists -> Pursue; else `FindATargetViaLineOfSight`: `OverlapSphere` radius 15, enemy team only, within +-35 degrees of facing, unobstructed `Linecast`; on sighting set the target and optionally pivot.
- **Pursue:** if busy do nothing; no target -> Idle; enable navmesh, pivot if the target angle leaves +-35, rotate toward the agent, set path to target each tick; within `stoppingDistance` -> CombatStance.
- **CombatStance:** if busy do nothing; pivot (turn clip) if idle and angle beyond +-30; if no attack chosen, pick one: filter the attack list by `minimumAttackDistance..maximumAttackDistance` and `minimumAttackAngle..maximumAttackAngle`, then weighted random by `attackWeight`; if one chosen -> Attack state; if the target is beyond `maximumEngagementDistance = 5` -> Pursue; else keep pathing.
- **Attack:** rotate toward the target while swinging (`attackRotationSpeed = 25`); wait while `actionRecoveryTimer > 0`; perform: play the clip (`PlayTargetActionAnimation`), set `isParryable = true`, set `actionRecoveryTimer = actionRecoveryTime (1.5 s default)`; the timer only counts down while NOT performing an action, so recovery starts after the clip ends. Then back to CombatStance. (`comboAction` and `canPerformCombo` 25% chance fields exist but the chain is not implemented.)
- **Boss:** `BossSleepState` until woken by a trigger; fog walls; at health <= `minimumHealthPercentageToShift = 50` run `Phase_Change_01` and swap `combatStance` for the phase-2 state asset (a different attack list). Boss music and HP bar tied to `bossFightIsActive`.
- **Turn clips:** pivot picks `Turn_Right_45 / 90 / 135 / 180` and Left by angle bands 20 to 60, 61 to 110, 111 to 145, 146 to 180.

**As data.** `ai-attack.json`: `{ "id":"zombie.swing", "clip":"z_attack", "parryable":true, "weight":3, "range":[0,2], "arc":[-35,35], "recoverySeconds":1.5, "next":null }`. `ai-profile.json`: `{ "sight":{"radius":15,"halfAngle":35}, "engageDistance":5, "pivotBands":[[20,60],[61,110],[111,145],[146,180]], "attacks":["zombie.swing"], "phases":[{"hpBelow":0.5,"attacks":["boss.p2a","boss.p2b"],"clip":"phase_change"}], "stance":{"max":..,"regenPerSec":15,"regenDelaySeconds":15} }`.

**Improvements for us.** Distance AND angle filters on every attack row plus weights (cheap, and gives readable enemy variety); recovery that counts only after the action ends; a phase row that swaps the attack list at an HP threshold; pivot turn clips chosen by angle band.

## 7. Number sheet (for quick copy into rows)

Poise reset 8 s; AI stance regen 15/s after 15 s; poise intensity edges 10 / 30 / 70 / 120; input buffer 0.35 s (21 ticks); CrossFade 0.2 s; riposte/backstab reach 0.7 m; riposte angle +-60 deg; backstab angle >= 145 deg; crit mult 3.3; crit snap offsets (0.11,0,0.7) and (0.12,0,0.74) for 0.5 s; block cone dot > 0.3; stamina regen 20/s after 1 s; sprint 2/s; roll/backstep/jump 25; attack base 20 x (0.9, 1.3, 1.5, 1.1); stability 51 (small) and 1 (medium); lock-on radius 20, half-angle 50; camera height 1.65 / 2.0; AI sight 15 m, +-35 deg; AI engagement 5 m; AI recovery 1.5 s; boss phase at 50% HP; backstep i-frames 50f; intended roll i-frames 14f; light 1 active window 14f (10f to 24f); combo window opens 6f after active start.

## 8. Animation clips: counts, names, which are attacks, licence situation

### 8a. AbdullahSevin (`Assets/Arts/Animations`)

Counts (find on the VPS): 36 `.anim`, 115 FBX/`.fbx`, 87 `.asset`, 4 override controllers, 7 controllers.

`.anim` clips (36) by type:
- Attack / weapon-art style (7): `2Hand-Sword/2HandAttack02`; `Attack/One handed/Sword/{Main_light_att_01, Main_light_att_02, Main_running_att_01, Rolling_att_01, Backstep_Att_01}`; `Attack/One handed/Spear/Thrust_Attack_01`.
- Special moves (4, Kamehameha, not a real weapon art): `SpecialMoves/kamehameha_{charge_front, hold, release, release_hold}`.
- Locomotion and defence (11): `Back_Step_01, Roll_Forward_01, Roll_Forward_01fail, Unarmed-DiveRoll-Forward1, Shield_Up_01, Idle_01, BasicMotions@Idle01, WalkTheFog, Walk_Through_Fog_not_gonna_work, 2Hand-Sword-Sprint-Forward`, `Interactions/Activate_Site_Of_Grace_01`.
- Damage (2): `Damage/Guard_Break_01`, `Damage/Try_Death_01`.
- Enemy (12): zombie `Z_Attack, Z_Attack2, Z_FallingBack, Z_FallingForward, Z_Idle, Z_Run, Z_Run_InPlace, Z_Walk, Z_Walk_InPlace, Z_Walk1, Z_Walk1_InPlace`, plus `Zombie_Attack_Left_01`.

FBX clip folders (115 total; grouped):
- `2Hand-Sword/` (48, `RPG-Character@2Hand-Sword-*`): Attack1 to Attack11 (11 attack clips), Run-Forward-Attack1, DiveRoll-Forward1, GetHit-B1/F1/F2/L1/R1, Knockback-Back1/2, Knockdown1, Getup1, Fall, Land, Jump, Jump-Flip, Idle, Idle-Static, Walk, Walk-Slow, Run (8 directions), Strafe (8 directions), Sheath/Unsheath-Back-Unarmed.
- `Attack/One handed/` (11 + 4): `Sword/OneHand_Up_Attack_1..3` (+ `_InPlace` versions = 6), `Sword/U_sword_slash_01`, `Kick`, `Standing Up`, `Spear/Standing Torch Melee Attack Stab`, `Shield/Parry_01`, `Shield/Parry_01_return`.
- `Damage/` (9): `GETHit_Ping, GETHitLig, GETHitMedium, GETHit_Heavy, Hit_F_1_InPlace, Hit_F_2_InPlace, U_sword_hit_01, RPG-Character@Unarmed-Stunned, Sword And Shield Death`.
- `_Core/Locomotion/` (8): `BasicMotions@{Fall01, Idle01, Idle02, Jump01, Run01 [RM], Sprint01 [RM], Strafe01 [RM], Walk01 [RM]}`.
- `Bosses/` (4): `Great Sword Slash` (+ `(1)`), `Sitting Idle`, `Standing Up`.
- `Zombie/` (28): Scary Zombie Pack 13 (attack, biting x2, neck bite, scream, crawl, running crawl, run, walk, idle, death, dying, X Bot), `Animations/` 11 (`Zombie@Z_*`, Turn180), `ZombieTurn/` 4 (Turning_45/90/135, Turn180).
- `SpecialMoves/kamehameharokoko`, `Interactions/Reaching Out`.

**Attack / weapon-art style clips total:** about 7 (.anim) + 12 (2Hand Attack1 to 11 and Run-Forward-Attack1) + 6 OneHand_Up + slash + kick + stab + 2 parry + 2 boss Great Sword Slash = about 33 humanoid; plus zombie attacks (3 .anim, 3 FBX) and 4 Kamehameha.

**Licence situation (evidence from the repo, nothing is documented in it):**
- 34 FBX carry the string `ExplosiveLLC` in their data, all the `RPG-Character@2Hand-Sword-*` set and `RPG-Character@Unarmed-Stunned`. That is Explosive LLC's "RPG Character Animation Pack" (Unity Asset Store). Commercial Asset Store EULA: usable inside a game build by the licensee, not redistributable as loose files. This repo's MIT does not cover it. Not usable by us.
- 29 FBX contain the string `mixamo`: the Scary Zombie Pack, the Turn clips, `Kick`, `Standing Up`, `Sword And Shield Death`, `Standing Torch Melee Attack Stab`, `Parry_01` and `Parry_01_return`, `Reaching Out`, the boss `Great Sword Slash`, `Sitting Idle`, `Standing Up`. These came from Mixamo (Adobe). Mixamo terms allow use in games when you hold an Adobe account, but not redistribution of the files themselves; they are free to download for our own use. Our own plan for Mixamo clips is in `docs/specs/combat/mixamo-plan.md`.
- `BasicMotions@*` (the `[RM]` suffix means root-motion variant): Kevin Iglesias "Basic Motions" naming (Asset Store). Inferred from the name only; the string is not in the files. Treat as commercial.
- `Main_light_att_*`, `Backstep_Att_01`, `Rolling_att_01`, `Main_running_att_01`, `Thrust_Attack_01`, `Roll_Forward_01`, `Back_Step_01`, `Guard_Break_01` are the author's own `.anim` edits. Their names and structure match the commercial pack in the other repo (section 8b), so they are probably retargeted/edited from it. Inference, not proven. Treat as not clean.
- `OneHand_Up_Attack_*`, `U_sword_slash_01`, `U_sword_hit_01`, `GETHit*`: no provenance string. Unknown. Treat as not clean.
- Verdict: use NO clip from this repo. We only use the timing numbers (event frames), which are facts about timings, not copyrightable clip data.

### 8b. yonathangashu (`Assets/`)

Counts: 0 `.anim`, 0 hand-made clips, 1035 FBX, 39 `.asset`, 35 `.cs`. FBX breakdown: 720 Synty "Polygon Fantasy Hero Characters" modular parts, 54 weapon models, about 255 animation FBX.

Animation FBX (commercial: **Nephilite Studios "Straight Sword Animation Set"**, an Asset Store pack; its `README.txt` lists "Main Hand/Dual Wield locomotion, Two Hand locomotion, Off Hand blocking, Action sets: Light, Charged, Running, Rolling, Backstepping, Jumping light/heavy attacks, Block Ping/Light/Medium/Heavy, Damage set"). 237 clips plus 18 copied locomotion clips in `Art/Animations/Humanoid/_Core/Locomotion/core_main_*`:
- Main Hand (34), Two Hand (59), Off Hand (29), Dual Wield (38), Core (73), Critical Strike (4: `core_main_backstab_01`, `core_main_backstab_victim_01`, `core_main_riposte_01`, `core_main_riposte_victim_01`).
- Attack names in the pack (the checklist worth copying, names only): `light_attack_01..03`, `charged_attack_01..03` each split into `_charge`, `_hold`, `_release`, `_release_full`; `run_attack_01`; `roll_attack_01` with `_release`; `back_step_attack_01..04` with `_charge` and `_release`; `jump_light_attack_01`; `jump_attack_01` with `_charge`, `_idle`, `_end`; guard set `guard_up / idle / down / break / block_ping / block_light / block_medium / block_heavy / block_stun`; run/walk/sprint guards in 8 directions; `hit_reaction_medium_B/f/L/R`; `equip` / `death`.
- Licence: commercial Asset Store EULA, sitting in a repo with no licence at all. Not usable. We take only the NAMING SHAPE: charge/hold/release/release_full for charged attacks and per-direction guard walking, victim-side critical clips (`*_victim_01`) paired with attacker clips.
- Synty Polygon Fantasy Hero Characters (models) and the README's "Withersworn" mention: not used.

## 9. The 8 most valuable things to port (TypeScript sketches)

All sketches are original TypeScript for our engine; names are placeholders for the existing loader and sim types.

### 9.1 Weapon-class clip table plus weapon-art rows (weapon-compatible specials)
Why: one state name, one clip per weapon class; an art lists the classes it fits. New weapon = new column, new art = new row.
```ts
interface ArtRow { id: string; weaponClasses: string[]; cost: { stamina: number; focus: number };
  gates: string[]; clipByClass: Record<string, string>; timeline: string }
const GATES: Record<string, (p: Fighter) => boolean> = {
  notActing: p => !p.acting, grounded: p => p.grounded, 'stamina>0': p => p.stamina > 0 };
function tryArt(p: Fighter, art: ArtRow, reg: Registry): boolean {
  const cls = p.weapon.class;
  if (!art.weaponClasses.includes(cls) || !art.gates.every(g => GATES[g](p))) return false;
  p.stamina -= art.cost.stamina;
  p.startAction(reg.clip(art.clipByClass[cls]), reg.timeline(art.timeline));
  return true;
}
```

### 9.2 Per-clip event timeline in frames (one list drives everything)
Why: Abdullah's whole combat is timed events. We keep our hit-stop, camera kick and trails as event types and add the rest.
```ts
type Ev = { f: number; t: 'payStamina'|'hitOpen'|'hitClose'|'comboOpen'|'iOn'|'iOff'
  |'parryOn'|'parryOff'|'ripostable'|'applyCrit'|'sfx'|'vfx'|'camKick'|'hitStop'; arg?: string|number };
// row: { id:'sword.light1', frames:34, ev:[{f:8,t:'payStamina'},{f:10,t:'hitOpen'},{f:16,t:'comboOpen'},{f:24,t:'hitClose'}] }
function stepTimeline(a: Action, p: Fighter, fx: Fx) {
  for (const e of a.row.ev) if (e.f === a.frame) HANDLERS[e.t](p, e.arg, fx);
  if (++a.frame >= a.row.frames) p.endAction();      // endAction = ResetActionFlags row
}
```

### 9.3 Shared attack-kind table (damage, poise and stamina per kind)
Why: one `kinds.default` row for every weapon, resolved at hit time from the live kind, so a roll attack or backstep attack costs and hits differently with no per-weapon code.
```ts
interface KindRow { dmg: number; stam: number }              // from kinds.default[kind][chainIndex]
function resolveHit(w: WeaponRow, kind: string, idx: number, reg: Registry) {
  const k = reg.kinds(w.kinds)[kind][idx] ?? reg.kinds(w.kinds)[kind][0];
  return { damage: w.damage.physical * k.dmg, poise: w.poise * k.dmg,
           stamina: Math.round(w.stamina.base * k.stam) };
}
// pay stamina on the payStamina event, not at button press: cancelling the windup is free
```

### 9.4 Combo chain with consumed window flag plus N-frame retry buffer
Why: simple, readable, proven feel. Loop pairs, window opened by an event, buffer re-tries each tick for 21 ticks.
```ts
function onAttackPress(p: Fighter, chain: ChainRow) { p.buf = { kind: chain.id, left: 21 }; }
function tickBuffer(p: Fighter, reg: Registry) {
  if (!p.buf) return;
  const chain = reg.chain(p.buf.kind);
  if (!p.acting) { start(p, chain.chain[0]); p.buf = null; }
  else if (p.comboOpen) { p.comboOpen = false; start(p, nextOf(chain, p.lastAttackId)); p.buf = null; }
  else if (--p.buf.left <= 0) p.buf = null;
}
const nextOf = (c: ChainRow, last: string) => c.chain[(c.chain.indexOf(last) + 1) % c.chain.length];
```

### 9.5 Poise accumulator, tiered flinch and 4-band direction reactions
Why: small hits flinch without cancelling the action; a break gives a real stagger; reactions face the hit direction and never repeat.
```ts
function takeHit(v: Fighter, hit: Hit, reg: Registry) {
  v.poiseHit += hit.poise; v.poiseTimer = v.row.poiseResetSeconds;     // 8 s
  const broken = v.row.poiseDefense - v.poiseHit <= 0;
  if (broken) v.poiseHit = 0;                                          // reset on break (fix over donor)
  const tier = broken ? 'medium' : 'ping';
  const a = signedAngle(hit.attackerFwd, v.fwd);                       // degrees
  const [e1, e2] = reg.poiseBands.edges;                               // [45,145]
  const band = Math.abs(a) >= e2 ? 'front' : Math.abs(a) <= e1 ? 'back' : a < 0 ? 'left' : 'right';
  const pool = reg.reactions(tier)[band].filter(c => c !== v.lastReaction);
  const pick = pool[v.rng.int(pool.length)];
  v.play(pick, { locks: broken });  v.lastReaction = pick;
}
```

### 9.6 Critical (riposte/backstab) pipeline: short ray, angle gate, snapped victim, damage on event
Why: dramatic finisher that is cheap to build from rows; the number lands on the visual hit.
```ts
function tryCritical(p: Fighter, world: World, crit: CritRow): boolean {
  const t = world.rayFirst(p.chest, p.fwd, crit.rayLength, f => f.team !== p.team);   // 0.7 m
  if (!t || t.beingCrit) return false;
  const a = Math.abs(signedAngle(t.fwd, vecBetween(t, p)));
  const kind = t.ripostable && a <= crit.riposteHalfAngle ? 'riposte' : a >= crit.backstabMinAngle && t.canBackstab ? 'backstab' : null;
  if (!kind) return false;
  t.pendingCrit = p.weapon.damage * p.weapon.crit[kind];                // applied by the applyCrit event
  p.startAction(crit.clip[kind], crit.timeline[kind]); t.startAction(crit.victim[kind], null);
  world.snap(t, p, crit.snap[kind], crit.snapSeconds);                  // local offset, per weapon class
  return true;
}
```

### 9.7 Lock-on target selection, auto-retarget after action, strafe snap
Why: gives a "stays on the enemy" feel on phone; the after-action retarget avoids camera lurches mid-swing.
```ts
function pickLockOn(p: Fighter, cam: Cam, world: World, row: LockRow): Fighter | null {
  let best: Fighter | null = null, bd = Infinity;
  for (const f of world.within(p.pos, row.radius)) {                    // 20 m
    if (f === p || f.dead || f.team === p.team) continue;
    if (angleBetween(sub(f.pos, p.pos), cam.fwd) > row.halfAngle) continue;   // 50 deg
    if (row.requireLoS && world.blocked(p.chest, f.lockPoint)) continue;
    const d = dist(p.pos, f.pos); if (d < bd) { bd = d; best = f; }
  }
  return best;
}
// in tick: if (p.target?.dead) p.retargetPending = true; if (p.retargetPending && !p.acting) p.target = pickLockOn(...)
const snapAxis = (v: number) => v === 0 ? 0 : Math.sign(v) * (Math.abs(v) <= 0.5 ? 0.5 : 1);
```

### 9.8 Enemy attack row: distance and angle windows plus weight, recovery counts after the action
Why: readable, tunable enemy variety from data; recovery stops enemies chaining forever.
```ts
interface AiAtk { id: string; clip: string; weight: number; range: [number, number]; arc: [number, number];
  parryable: boolean; recoverySeconds: number }
function chooseAttack(ai: Fighter, list: AiAtk[]): AiAtk | null {
  const ok = list.filter(a => ai.dist >= a.range[0] && ai.dist <= a.range[1]
                            && ai.angle >= a.arc[0] && ai.angle <= a.arc[1]);
  let r = ai.rng.int(ok.reduce((s, a) => s + a.weight, 0)) + 1;
  for (const a of ok) { r -= a.weight; if (r <= 0) return a; }
  return null;
}
// tick: if (!ai.acting && ai.recovery > 0) ai.recovery -= dt;   // only counts down while idle
```

## 10. Things NOT to copy (donor bugs and gaps)

- Unnormalised block dot product (range depends on distance).
- Backstab angle test whose second branch accepts nearly any angle.
- Roll i-frame events misspelled (`EnableIsVulnerable`): the roll has no invulnerability as shipped.
- Poise not reset on a break (every hit staggers until the 8 s timer ends).
- Item ids derived from list index (breaks saves).
- Stamina gate `> 0` lets any move start with 1 stamina (fine as a feel choice, but make it a row flag, not an accident).
- Input buffer overwritten by each press and only for two buttons; ours should buffer dodge and parry too.
- No hit-stop, trails, camera kick or aerial attacks in the donor: nothing to learn there.
