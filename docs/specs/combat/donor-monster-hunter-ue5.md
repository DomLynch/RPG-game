# Donor study: Project Monster Hunter World (UE5), combat decode

**LICENCE RULE (read first).** `xpsa0421-Project-Monster-Hunter-World` (VPS: `/mnt/frankendom-donors/xpsa0421-Project-Monster-Hunter-World`) has **no LICENSE file**, so all rights are reserved by the authors (Team AZ). This document describes DESIGN, numbers and algorithms in our own words. No code from the donor is copied or transliterated. Every TypeScript sketch below was written from scratch. Class and file names are cited only as pointers for a reader.

Paths below are relative to `Source/AZ_MHW/` unless stated.

## 0. What this repo actually is (honest scope)

- 371 C++ files (194 `.h`, 177 `.cpp`), 18 CSV tables in `RawContent/Csv/`, and **zero** `.uasset`/`.umap` files. Blueprints, montages, anim graphs, physics assets, particle effects, camera shakes and the behaviour-tree graph itself are **not in the repo at all**, so they cannot be read. What is missing and therefore unknowable: the actual Great Sword move set (which montage sections exist, their timings), the physics-asset body shapes that decide hit zones, the sound and trail and camera-shake notifies (none exist as C++ classes), the Roar screen-distortion, and the behaviour-tree wiring.
- It is a 1-month student project (Apr to May 2023, 1 server programmer + 4 client programmers). It is a **monster-side** project: the monster data, part damage, aggro and AI selection are real code; the **hunter side is thin**. Only one weapon type exists in data (`MeleeWeaponData.csv`: three `greatSword` rows with damage 288/336/412, `hone` (sharpness) 20/30/38, `critical` 500/1000/1200). There is no Hammer, Long Sword, spirit gauge or Great Sword charge in code.
- Things that look like systems but are **stubs** (checked by grep): sharpness (a state field and CSV column only, never read in damage), critical (field only), hitstop (no call sites for `PauseAnimation`/`ResumeAnimation`/time dilation), camera shake (no C++), stagger/stun/knockback (the `EAttackEffectType` enum is loaded from CSV, then `ProcessDamage` assigns it to an unused local), `stunnable_parts` (loaded, never consumed), monster stamina and `tired_duration` (stored, no consumer), monster escape thresholds (loaded, decorator is an empty shell), player stamina (one 30-point cost helper).
- Net: code is roughly 60 percent engine plumbing (UI, sockets, packets, DB), maybe 15 percent combat logic worth reading, plus the CSV rows. Treat it as a **data-schema donor for boss part states**, not a feel donor.

## 1. Hit zones and part damage (our idea (a): Skull Crack by contact height)

**Files:** `CharacterComponent/AZMonsterHealthComponent.cpp` (`ProcessDamage`, `ApplyDamageToBodyPart`), `CommonSource/AZStruct.h` (`FBossWeaknessStats`, `FBossBodyPartState`), `CommonSource/AZEnum.h` (`EMonsterBodyPart`, `EDamageType`), `Manager/AZMonsterMgr.cpp` (`ConvertBossTable`), `RawContent/Csv/BossData.csv`.

How it works, in our words:
- The hit part is read from the **physical material surface type** of whatever collision body the weapon touched; the surface-type integer is cast straight to the body-part enum. So "which zone" is authored in the physics asset, not computed. (Our equivalent: a height-band or bone-capsule lookup on contact point.)
- Parts are Head, Neck, Body, Back, Tail, left/right Wing, Leg, Eyelid. Neck folds into Head and Body folds into Back for the **state tracking** (wound/break/sever counters), but each keeps its own **weakness row** for damage.
- Final damage = weapon damage x weakness value for (part, damage type) x rage-incoming multiplier (if enraged) x tenderised multiplier (if the part is wounded). Damage types for hunters: Cut, Blunt, Ammo. Each part has one weakness triple in that order.
- Boss row numbers (Rathalos, rank Low, `BossData.csv`): head weakness 65/70/60, neck 35/40/30, body 25/25/25, tail 45/40/35, wing 50/45/40, leg 35/35/30 (cut/blunt/ammo). So the head is roughly 2.6x the body for cut and blunt wins on the head: weak-point play is rewarded and weapon class matters. (Caveat: the code divides the stored value by 10 with integer division, which reads like a unit slip. Treat the **ratios**, not the absolute multiplier.)
- Per-part thresholds, three counters per part: wound (head 200), break (head 500), sever (-1 means "cannot"; tail 100). Tail is the only severable part and **only Cut damage counts toward sever**; blunt breaks heads, cut severs tails (weapon class drives which part state moves).
- Wound is temporary (timer, 20 s) and while wounded the part takes x1.3 ("tenderised"). Break and sever are permanent. Severing hides the mesh, disables the collision body and spawns a physics prop of the dropped part.
- Aggro is fed from part state changes too (see section 5).

**Data row (ours):** a `hitzones.json` per target archetype.
```json
{ "id": "ogre_a", "zones": {
  "head": { "mult": {"edge":1.0,"blunt":1.2,"pierce":0.9}, "band":[0.78,1.0],
            "wound":200, "break":500, "sever":null, "stun":true },
  "body": { "mult": {"edge":0.4,"blunt":0.4,"pierce":0.4}, "band":[0.35,0.78] },
  "legs": { "mult": {"edge":0.55,"blunt":0.55,"pierce":0.5}, "band":[0.0,0.35] } },
  "woundSeconds": 20, "woundedMult": 1.3 }
```
Loader: `HitZoneRegistry` keyed by archetype; engine does `zoneFromContactHeight(contactY, targetHeight, bands)`. `band` is fractional contact height, which is exactly how Skull Crack (high contact, blunt) lands on the "head" row without per-model physics assets.

## 2. Weapon and attack data (motion values, sharpness, damage types)

**Files:** `CommonSource/Table/MeleeWeaponData.{h,cpp}`, `RawContent/Csv/MeleeWeaponData.csv`, `PlayerState/AZPlayerState_Client.h` (`FAZPlayerCharacterState`), `Character/Player/AZPlayer_Origin.cpp` (`ApplyDamage_Implementation`).

- Weapon row: id, name, type, damage, hone (sharpness cap), critical (permyriad-scaled). Player state also carries max/current sharpness (default 100/50), crit rate, speed rate (20000 = 2.0x), armor and a damage-reduce rate.
- **There are no motion values.** The player's outgoing hit overwrites the damage array's first entry with the player's flat "current attack point" (default 100). Every swing is the same. Sharpness and critical are never read.
- Monster attacks are the opposite and well-formed: `MonsterCombatActionData.csv` rows carry **multiple typed damage lines per move**, e.g. Fireball: Base 60 + Fire 10; Aerial Stomp: Base 40 with KnockBack effect; Aerial Talon Strike: Base 30 + Poison 10 with KnockBack. Damage types: Cut, Blunt, Ammo (hunter), Base, Fire, Poison (monster).

**Data row (ours):** move rows already own per-hit numbers in our engine; the improvement is a `damageLines: {type, amount}[]` array on each move (so a mace hit can be Blunt 40 + Break 10) and a per-move `motion` multiplier separate from the weapon base.

## 3. Animation notifies (hitbox windows, combo links, timing)

**Files:** `AnimNotify/*.cpp`, `AnimNotify/Player/*.cpp`, `AnimNotifyState/*.cpp`, `AnimInstance/AZAnimInstance_Player.cpp`.

Existing notify vocabulary (all tiny wrappers that call into a character method or flip a flag):
- Monster side: **DoSphereOverlap** (one-shot sphere at a named socket, radius field; foot sockets drop 100 units lower so stomps hit ground), **DoCapsuleOverlap** (state; capsule at a socket, re-checks every 0.5 s default, and a per-swing "already hit" set so one swing cannot multi-hit a target), **EndOfAction**, **JumpToAnimation** (chain to another named montage and section), **SetMovementMode**.
- Player side: **LineTrace** state (default single-target and hit-once; optional multi-hit tick 0.1 s; picks the weapon socket actor named "MainHand" unless overridden; the actual tracing is not in C++), **EnableLink**, **DisableLink**, **HoldLink**, **ChangeMontage**, **SetDefault**, **AttachSocket**.
- **Not present in code:** sound, trail, camera shake, hitstop notifies. They would be Blueprint or Niagara assets that are absent.

The combo-link system (idea worth keeping, see section 6): a swing opens an **input window** with EnableLink (inputs are only read inside it; outside it the input bitmask is forced to zero). HoldLink is a window state carrying an input mask and a target montage+section; if the required input is down during the window, at the window end the animation instance is told to jump to the target. DisableLink closes the window. SetDefault resets the section.

**Data row (ours):** we already have blade paths and per-weapon clips. The gain is making the *window list* data: `events: [{t0,t1,kind:"hit"|"link"|"armor"|"cancel", ...}]` per move, which `gothic-combo-window.md` likely covers already. Add `link.requires` (input mask) and `link.to` (move id) on the window row.

## 4. Commitment: input lockout, super armour, stamina

**Files:** `AnimInstance/AZAnimInstance_Player.cpp` (`NativeUpdateAnimation`, `CheckCostAnimation`, `SetAnimPlayRate`), `Character/Player/AZPlayer_Origin.cpp` (`SetActiveSuperArmor`, `PostProcessDamage`), `RawContent/Csv/CommandData.csv`.

- **Lockout is structural, not timed.** `can_input_control` is true only between EnableLink and DisableLink (and at SetDefault). When false the frame's input bitmask is zeroed, so a heavy swing cannot be cancelled except through its authored windows. Direction is *not* cleared, so the stick can still steer a rotating link.
- Input is a bitmask: 1/2/4/8 move, 16 normal attack, 32 special attack, 64 unique action, 128 dash. `CommandData.csv` maps (state, section, input bit) to a command section name; Base/Stand and Base/Move both accept every command. (Only the Base/Stand and Move rows are in the CSV; the weapon rows are in an absent data asset.)
- **Super armour** is a flag plus a permyriad **damage-reduce rate** set by `SetActiveSuperArmor(enable, rate)`. When on, a hit still deals damage (reduced) but does not set the "hit" state, so the swing is not interrupted. The code's own design comment asks for three hit strengths (weak, medium, strong) with strong turning the victim to face the source and playing a directional reaction; only the facing is implemented.
- **Stamina:** one helper subtracts a flat 30 if stamina is above 30 (cost on dash or dodge animations), and another adds a recover amount with a cap check. Max 100. No stamina drain on attacks.
- Global tempo is a play-rate in permyriad (default player 2.0x). Pause/Resume helpers exist but nothing calls them, so hitstop was planned but not shipped.

**Data row (ours):** per move `commit: { lockUntil:"link0", armor:{from:0.18,to:0.42,reduce:0.6}, staminaCost:18, recoverOnLink:6 }`. Our engine already has stamina and posture; the improvement is `armor.reduce` as a *fraction taken* during a window (heavy attacks cost less flinch, not none).

## 5. Monster AI, aggro, rage, escape

**Files:** `BehaviorTree/BTTask/BTTask_SelectRandomAction.cpp`, `CharacterComponent/AZMonsterAggroComponent.cpp`, `Character/Monster/AZMonster.cpp`, `RawContent/Csv/MonsterCombatActionData.csv`, `MonsterNonCombatActionData.csv`, `MonsterData.csv`, `BossData.csv`.

- **Action selection** is a flat filter plus uniform random pick: every row of the monster's table is dropped if its trigger flags are non-empty (combat actions currently require no trigger), if the Flying condition mismatches the monster's air/ground state, or if the target distance is outside the row's `[min,max]` range (-1 = unbounded; 2D distance). One random survivor is chosen and its `attack_delay` (ms) is written to the blackboard as the pause before the next decision. A cooldown is a TODO. Health-band conditions exist only for non-combat idles.
- Triggers are bit flags: Transition, Auto, Damage, Sight, InRange. A transition (roar) row fires on first sight or first damage depending on its flags, and the roar uses the RoarStagger effect.
- The Rathalos table has 11 combat rows (fireball, aerial chain breath, aerial stomp, reckless charge, aerial charge, aerial talon strike, turn-in-place, roars). Attack delays 0 to 5000 ms; ranges in cm (talon strike 0 to 1500, charge 200+).
- **Aggro:** a map of player to points. Enter-combat grants 30. Players in perception range gain +5 per 20 s tick; players outside lose 30. Damage dealt adds 40 percent of damage. Part wound +20, break +50, sever +100. Target = highest points, ties broken at random. Zero or less removes the player.
- **Rage:** accumulate damage to a threshold (3700), then a timed mode (100 s) with x1.1 agility, x1.6 outgoing damage, x1.1 incoming damage; threshold counter resets. Escape (flee at 60 percent and 30 percent HP, 2 allowed) is data-complete but unimplemented.
- Boss HP 7500; stamina 100 and a 30 s "tired" duration are data-only.

**Data row (ours):** `ai-actions.json` per enemy: `{id, anim, damageLines[], effect, trigger[], when:{airborne,minDist,maxDist,hpBand}, recoverMs, weight}`. Add `weight` (donor is uniform) and `cooldownMs` (donor TODO). A separate `aggro.json` of the six constants above is only useful for multiplayer; duels can skip it.

## 6. The six most valuable design ideas for Frankendom

Each sketch is original TypeScript.

### 1. Zone by contact height, with per-damage-class multipliers and per-zone state meters
```ts
type DmgClass = "edge" | "blunt" | "pierce";
interface Zone { band: [number, number]; mult: Record<DmgClass, number>;
  wound?: number; break?: number; stun?: boolean; }
interface HitZoneSet { id: string; zones: Record<string, Zone>; woundedMult: number; woundSeconds: number; }
function zoneAt(set: HitZoneSet, contactY: number, h: number): string {
  const f = contactY / h;
  return Object.keys(set.zones).find(k => f >= set.zones[k].band[0] && f < set.zones[k].band[1]) ?? "body";
}
```
Skull Crack: blunt on `head` hits `stun:true` and the `break` meter.

### 2. Weakness is damage-class by zone, so weapon choice matters
```ts
interface Weakness { zone: string; edge: number; blunt: number; pierce: number; }
function hitDamage(base: number, cls: DmgClass, z: Zone, wounded: boolean, set: HitZoneSet): number {
  return base * z.mult[cls] * (wounded ? set.woundedMult : 1);
}
```
Rows differ per foe, so a maul beats a plated head and a scythe beats a tail.

### 3. Wound, break, sever as three accumulate-and-reset meters (only some classes feed sever)
```ts
interface ZoneMeters { wound: number; break: number; sever: number; wounded: boolean; broken: boolean; severed: boolean; }
interface MeterRule { feeds: ("wound" | "break" | "sever")[]; severOnly?: DmgClass[]; }
function accrue(m: ZoneMeters, z: Zone, dmg: number, cls: DmgClass, r: MeterRule) {
  if (r.feeds.includes("wound") && z.wound) m.wound += dmg;
}
```
Tail severs only on `edge`; heads break on `blunt`. Wound expires after `woundSeconds`; break is permanent.

### 4. Input-window commitment: input is ignored except inside authored link windows
```ts
interface LinkWindow { t0: number; t1: number; requires: string; to: string; }
interface Commit { windows: LinkWindow[]; armor?: { t0: number; t1: number; reduce: number }; }
function readInput(t: number, c: Commit, held: Set<string>): string | null {
  const w = c.windows.find(w => t >= w.t0 && t < w.t1 && held.has(w.requires));
  return w ? w.to : null;
}
```
No cancel outside windows. Heavy moves have fewer, later windows; light moves have early ones.

### 5. Super armour as a "fraction taken" window, not an on/off immunity
```ts
interface ArmorWindow { t0: number; t1: number; reduce: number; keepsStance: boolean; }
function incoming(dmg: number, t: number, a: ArmorWindow | undefined) {
  const on = !!a && t >= a.t0 && t < a.t1;
  return { dmg: on ? dmg * (1 - a!.reduce) : dmg, flinch: !(on && a!.keepsStance) };
}
```
Heavy swings take reduced damage and refuse flinch only during the swing's windup+active band.

### 6. Typed multi-line attack damage plus status-effect tag (monster move rows)
```ts
interface DamageLine { type: "base" | "fire" | "poison" | "blunt" | "edge"; amount: number; }
interface MoveHit { lines: DamageLine[]; effect?: "knockback" | "stagger" | "stun" | "trip"; hitOncePerSwing: true; }
function total(h: MoveHit): number { return h.lines.reduce((s, l) => s + l.amount, 0); }
```
`hitOncePerSwing` mirrors the donor's per-swing "already hit" set so wide arcs and capsules cannot multi-hit.

## 7. Not worth taking

- Sharpness, critical, motion values, hitstop, camera shake, stamina drain: not implemented in code, so no donor value. Our existing hit-stop and camera-kick rows are already ahead of this repo.
- Network packet layer, ODBC, IOCP server, UI widgets: irrelevant to the sword-duel game.
- The `weakness / 10` integer division and the `FBossBodyPartState` constructor, which reads wound, break and sever thresholds from shuffled column indexes. Copy the schema idea, not the arithmetic.
