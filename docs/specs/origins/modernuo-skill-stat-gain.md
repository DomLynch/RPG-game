# ModernUO behaviour spec: skill gain and stat gain ("use it to improve it")

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. All paths below are relative to `Projects/` in that tree.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. No donor source is reproduced. Implementers must not open the donor tree.
- Destination: **progression**. This is the core of the "Ultima Online levelling" idea for the ONE progression proposal: there are no levels and no XP; each skill rises by being used, a global skill cap forces trade-offs, per-skill lock arrows let the player choose what falls when they are at the cap, and stats (Str/Dex/Int) rise as a side effect of skill use.

## 1. Purpose

Every time a character attempts something that uses a skill (swinging a sword, crafting, mining, healing), the server rolls success against a chance, and then, independently, rolls whether the attempt *teaches* the character 0.1 (or a little more at low skill) in that skill. Skill values live in tenths (fixed point, 0..1000 = 0.0..100.0 for a standard cap). The gain chance is higher when:

- the character is far from their total skill cap,
- the skill is far from its own cap,
- the attempt was hard (low success chance), and especially when the hard attempt succeeded.

A total-skill cap (default 700.0) is enforced by *atrophy*: when a gain would be blocked by the total cap, one skill the player has marked "Down" loses the same amount. Stats rise by a related but separate roll, capped per stat and in total, with their own lock arrows and a per-stat cooldown.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| UOContent/Skills/SkillCheck.cs:21-31 | Configure | reads 5 config values (stat cap, gain multiplier, primary-stat chance, stat gain delays, Pub45 switch) |
| UOContent/Skills/SkillCheck.cs:33-40 | Initialize | installs four handlers on the Mobile class (location/target × ranged/direct) |
| UOContent/Skills/SkillCheck.cs:42-75 | Mobile_SkillCheckLocation → CheckLocation | min/max-skill form; turns skill value into a success chance |
| UOContent/Skills/SkillCheck.cs:77-106 | Mobile_SkillCheckDirectLocation → CheckDirectLocation | caller supplies the chance directly |
| UOContent/Skills/SkillCheck.cs:161-224 | …Target variants | same, but the anti-macro key is the target object instead of a map cell |
| UOContent/Skills/SkillCheck.cs:108-159 | CheckSkill | the success roll, the gain-chance formula, the gain roll, legacy stat gain |
| UOContent/Skills/SkillCheck.cs:226-234 | AllowGain | faction skill-loss block; anti-macro check |
| UOContent/Skills/SkillCheck.cs:236-310 | Gain | amount to gain, atrophy of a Down-locked skill, acceleration, cap clamp, Pub45 stat gain |
| UOContent/Skills/SkillCheck.cs:312-328 | LegacyGain | pre-ML per-stat gain roll |
| UOContent/Skills/SkillCheck.cs:341-370 | CanLower / CanRaise | stat lock and cap predicates |
| UOContent/Skills/SkillCheck.cs:372-442 | IncreaseStat | +1 to a stat with optional atrophy of another stat |
| UOContent/Skills/SkillCheck.cs:444-504 | GainStat | per-stat cooldown, atrophy roll, then IncreaseStat |
| UOContent/Skills/AntiMacroSystem.cs:84-105, 186-263 | Configure / AntiMacroCheck | optional anti-macro limiter (disabled by default) |
| Server/Skills.cs:10-15 | SkillLock enum | Up=0, Down=1, Locked=2 |
| Server/Skills.cs:174-226 | Skill.BaseFixedPoint / Base / CapFixedPoint / Cap | fixed point storage (tenths), clamp to 0..65535, total maintenance |
| Server/Skills.cs:231-331 | Skill.Value / NonRacialValue | effective value = base + stat bonus (pre-AOS only) + item mods, capped |
| Server/Skills.cs:395-419 | SkillInfo ctor | per-skill constants (scales, stat gains, gain factor, primary/secondary stat) |
| Server/Skills.cs:463, 538 | Skills.Cap | total cap default 7000 (700.0) |
| Distribution/Data/skills.json | data | the per-skill constant table (section 4.4) |
| Server/Mobiles/Mobile.cs:7826 | StatCap default | 225 |
| Server/Mobiles/Mobile.cs:8091-8097 | Mobile.CheckSkill / CheckTargetSkill | the public entry points game code calls |
| Server/Regions/Region.cs:841 | Region.AllowGain | default true, inherits from parent; JailRegion overrides to false for players (UOContent/Systems/JailSystem/JailRegion.cs:23) |
| Server/Utilities/Utility.cs:860-905; Server/Random/BuiltInRng.cs:21-40 | RNG | all rolls |

Call graph:

```
game action (attack, craft, harvest …)
  └─ Mobile.CheckSkill(skill, min, max)          or CheckSkill(skill, chance) / CheckTargetSkill(...)
       └─ SkillCheck handler
            ├─ CheckLocation / CheckTarget: value → chance (or short-circuit)
            └─ CheckSkill(from, skill, antiMacroKey, chance)
                 ├─ success roll
                 ├─ if alive and region allows:
                 │    ├─ base < 10.0 → Gain()
                 │    └─ else AllowGain()? → gain-chance formula → roll → Gain()
                 │    └─ legacy (non-Pub45) and success → LegacyGain() → GainStat()
                 └─ SkillEvents.InvokeSkillUsed(from, skill, success)   [observer hook]
Gain()
  ├─ amount (1, or 1..4 below 10.0), atrophy of first Down skill, acceleration ×2..5, cap clamp
  └─ Pub45: 5% roll → GainStat(primary 75% / secondary)
GainStat() → cooldown → atrophy roll → IncreaseStat()
```

## 3. Data structures

**Skill** (one per skill per character):

| Field | Type | Meaning |
|---|---|---|
| baseFixed | uint16 (0..65535) | trained value in tenths. 500 = 50.0 |
| capFixed | uint16 | per-skill cap in tenths; default 1000 (100.0). Power scrolls raise it to 1050/1100/1150/1200 |
| lock | enum Up / Down / Locked | Up = may gain; Down = may be lowered by atrophy, never gains; Locked = neither gains nor is lowered |
| info | SkillInfo | per-skill constants (section 4.4) |

Derived: `base = baseFixed / 10`, `cap = capFixed / 10`, `value` = effective value used for chances (section 4.5).

**Skills** (per character): `total` = sum of all `baseFixed` (tenths), `cap` (total cap, tenths, default 7000). Setting a skill's baseFixed updates `total` by the difference.

**SkillInfo** constants: `strScale, dexScale, intScale, statTotal` (pre-AOS stat-to-skill bonus only), `strGain, dexGain, intGain` (legacy stat gain weights), `gainFactor` (multiplier on gain chance; 1.0 for every skill in the shipped data), `primaryStat, secondaryStat` (Pub45 stat gain).

**Character stat fields**: `rawStr, rawDex, rawInt` (ints), `statCap` (total, default 225), per-stat `lock` (Up/Down/Locked), per-stat `lastGain` timestamp. Global `statMax` per single stat (125 if LBR+ era else 100).

**Acceleration** (PlayerMobile): `acceleratedSkill` (skill id) and `acceleratedStart` (timestamp; active while `acceleratedStart > now`). Set by "Scroll of Alacrity" and by ML skill-training quests (see modernuo-quests.md).

## 4. Formulas and constants

### 4.1 Success chance (SkillCheck.cs:56-75, 178-195)

For the min/max form with effective value `v`:

- if `v < min` → return **false**, no roll, no gain ("too difficult").
- if `v >= max` or `min >= max` → return **true**, no roll, no gain ("no challenge").
- else `chance = (v − min) / (max − min)` and continue to CheckSkill.

For the direct-chance form: `chance < 0` → false; `chance >= 1` → true; else continue. Both short-circuits still fire the SkillUsed observer event with the returned outcome (tests in UOContent.Tests/Tests/Skills/SkillEventsTests.cs confirm).

Practical consequence: **you only learn while the task is genuinely uncertain**. Once a task is trivial (v ≥ max) it teaches nothing.

### 4.2 CheckSkill (SkillCheck.cs:108-159)

1. If the character's total cap is 0 → return false (no roll).
2. `success = chance >= R1` where R1 = uniform [0,1). (Note `>=`: chance 0.0 can still succeed if R1 is exactly 0.)
3. If the character is alive **and** its region allows gain (default true; jail = false):
   a. If `base < 10.0` → call Gain unconditionally (no gain-chance roll, **no anti-macro check**).
   b. Else if AllowGain (4.3) → compute gain chance `gc`:

      - `gc = ((totalCap − total) / totalCap + (skillCap − base) / skillCap) / 2`
      - `gc = (gc + (1 − chance) × k) / 2`, where `k = 0.5` if success, else `k = 0.0` in AOS-and-later eras, `0.2` pre-AOS
      - `gc = gc × gainFactor`
      - `gc = max(gc, 0.01)`
      - if the character is a tamed pet: `gc = gc × 2`
      - gain if `gc >= R2` (R2 uniform [0,1)).

      totalCap and total are in tenths (ratio unaffected); skillCap and base are in whole units.
   c. If NOT Pub45 mode and `success` → LegacyGain (4.7).
4. Return `success`.

Note: the success outcome does not depend on gain; gain never changes the outcome of the current attempt.

### 4.3 AllowGain (SkillCheck.cs:226-234; AntiMacroSystem.cs:189-249)

- AOS+: if the character is in faction "skill loss" → no gain. (Strip for Frankendom: no factions.)
- Non-players always pass. Players pass the anti-macro check, which is **disabled by default** (`Enabled = false`, AntiMacroSystem.cs:96). When enabled: settings `Allowance = 3`, `LocationSize = 5` tiles, `Expire = 5 min`, and a per-skill flag table (combat and craft skills are exempt, information/gathering skills are subject to it; AntiMacroSystem.cs:16-76). Key = (skill, object), where object is the target object for target checks or the 5×5-tile map cell `(x div 5, y div 5)` for location checks. Each check increments a counter for that key; it passes if the key is new, expired, or `count < 3`, and every pass refreshes the key's expiry to now + 5 min. So with defaults, the 3rd and later uses of the same skill on the same key within 5 minutes of the last *passing* use give no gain. Staff (non-Player access) and a null key always pass.

### 4.4 Per-skill constants (Distribution/Data/skills.json)

`gainFactor = 1.0` for all 58 skills. Legacy stat gain weights and Pub45 primary/secondary stats for the skills most relevant to a sword duel:

| Skill (id) | strGain | dexGain | intGain | primary | secondary |
|---|---|---|---|---|---|
| Swordsmanship (40) | 0.75 | 0.25 | 0 | Str | Dex |
| Mace Fighting (41) | 0.9 | 0.1 | 0 | Str | Dex |
| Fencing (42) | 0.45 | 0.55 | 0 | Dex | Str |
| Wrestling (43) | 0.9 | 0.1 | 0 | Str | Dex |
| Parrying (5) | 0.75 | 0.25 | 0 | Dex | Str |
| Tactics (27) | 0 | 0 | 0 | Str | Dex |
| Archery (31) | 0.25 | 0.75 | 0 | Dex | Str |
| Anatomy (1) | 0.15 | 0.15 | 0.7 | Int | Str |
| Healing (17) | 0.6 | 0.6 | 0.8 | Int | Dex |
| Blacksmithy (7) | 1.0 | 0 | 0 | Str | Dex |
| Focus (50) | 0 | 0 | 0 | Dex | Int |

(The full table is data, not code; an implementer may take the column values as tuning seeds.)

### 4.5 Effective value (Server/Skills.cs:231-331)

`value = max(nonRacialValue, racialSkillBonus)` where racial bonus is a race floor (humans get a floor in some skills post-ML; strip or keep as a "minimum competence" idea).

`nonRacialValue`:
1. `b = base`.
2. Stat bonus (pre-AOS only; AOS+ zeroes every scale at startup, UOContent/Misc/AOS.cs:15-26): `s = rawStr×strScale + rawDex×dexScale + rawInt×intScale`; `inv = 100 − b`; if `inv <= 0` then `s = 0` else `s = s × inv`, and if `statTotal > 0`, `s = min(s, statTotal × inv)`. `value = b + s`.
   - **Ambiguity:** the JSON table already stores scales as fractions (e.g. 0.075) and the constructor divides by 100 again, while `statTotal` is set from JSON unscaled (10). The resulting bonus magnitude is therefore not the classic one. This path is dead in AOS+ eras, so implementers should **not** port it; if Frankendom wants stats to boost skills, design it fresh.
3. Item/spell mods: absolute mods replace the value and reset bonuses; relative mods are split into "obey cap" and "ignore cap". `value += ignoreCapBonus`; then if `value < cap`: `value = min(value + obeyCapBonus, cap)`.

Gain logic uses **base**, chances use **value**.

### 4.6 Gain amount and atrophy (SkillCheck.cs:236-282)

Gain does nothing for a dead pet, or for Focus on a creature. Otherwise, only if `base < cap` and `lock == Up`:

1. `toGain = 1` tenth. If `base <= 10.0`: `toGain = 1 + randInt(0..3)` (1..4 tenths).
2. Atrophy (players only): roll `total / totalCap >= R3`. If true, walk skills in **skill-id order** and lower the **first** skill (other than this one) whose lock is Down and whose baseFixed `>= toGain`, by `toGain`. Only one skill is lowered. The roll happens even when far below the cap (a player at 350/700 lowers a Down skill 50% of the time a gain happens).
3. Acceleration: if this skill is the player's accelerated skill and the acceleration window is active, `toGain = toGain × randInt(2..5)`.
4. Apply: if not a player, or `total < totalCap` (evaluated **after** step 2), `baseFixed = min(baseFixed + toGain, capFixed)`.
   - Overshoot: the total-cap test is `total < totalCap`, not `total + toGain <= totalCap`, so a character at 6999 tenths can gain 4 tenths and land at 7003. The skill cap is hard (min with capFixed); the total cap is soft by up to `toGain − 1` (or more with acceleration).
   - At the cap with no Down skill (or the atrophy roll failed), the gain is silently lost.
5. Pub45 stat gain (4.8) runs after this regardless of whether the skill actually rose, as long as the skill's lock is Up.

### 4.7 Legacy stat gain (pre-ML default; SkillCheck.cs:18-19, 152-155, 312-328)

Runs only on a **successful** check (and only when Pub45 is off). For each of Str, Dex, Int independently: if `statGain > 0` and that stat's lock is Up and `statGain / 33.3 × multiplier > R` → GainStat(stat). `multiplier` = config `stats.gainChanceMultiplier`, default 1.0.

Example: Swordsmanship success → Str chance 0.75/33.3 = 0.022523, Dex chance 0.25/33.3 = 0.0075075.

### 4.8 Pub45 stat gain (ML+ default; SkillCheck.cs:284-309)

Runs inside Gain (i.e. whenever a gain was *granted by the roll*, even if blocked by caps), only if the skill's lock is Up:
1. If neither the primary nor the secondary stat lock is Up → stop.
2. Roll `0.05 × multiplier > R` (1 in 20).
3. If primary lock is Up and `0.75 > R'` → primary, else secondary. (If the primary is not Up, it always picks the secondary, even if the secondary is not Up; GainStat/IncreaseStat then refuse to raise it.) `0.75` = config `stats.primaryStatGainChance`.
4. GainStat(chosen).

### 4.9 GainStat and IncreaseStat (SkillCheck.cs:341-504)

GainStat(stat):
1. Cooldown: if `lastGain[stat] + delay >= now` → stop (strictly more than `delay` must have passed). `delay` = 10 min pre-ML, **0.05 min (3 s)** in ML+ (config `stats.gainDelay`); tamed pets use 5 min (`stats.petGainDelay`).
2. `lastGain[stat] = now` (set even if the raise later fails).
3. `atrophy = rawStatTotal / statCap >= R`.
4. IncreaseStat(stat, atrophy).

IncreaseStat(stat, atrophy):
1. `atrophy = atrophy OR rawStatTotal >= statCap`.
2. If atrophy, lower one *other* stat by 1, choosing among those that CanLower (lock Down and raw > 10):
   - raising Str: lower Dex if Dex can lower and (Dex < Int or Int cannot lower); else lower Int if it can.
   - raising Dex: lower Str if Str can lower and (Str < Int or Int cannot lower); else Int if it can.
   - raising Int: lower Str if Str can lower and (Str < Dex or Dex cannot lower); else Dex if it can.
   (Tie-break: when the two candidates are equal, the second-named one is lowered.)
3. If CanRaise(stat): `raw = min(raw + 1, statMax)`. CanRaise: (non-pet) `rawStatTotal < statCap` (checked **after** the atrophy step) AND lock Up AND `raw < statMax`. Tamed pets skip the total-cap test.

Constants: `statMax` 125 (LBR+) or 100; `statCap` 225; stat floor for lowering 10.

## 5. Order of operations (one skill use)

1. Game code calls CheckSkill with (min, max) or a direct chance.
2. Short-circuit if too hard / trivial (returns, no RNG consumed).
3. Total cap 0 → false.
4. R1: success roll.
5. Alive + region allow?
6. base < 10 → Gain; else AllowGain (anti-macro may consume nothing random) → gc → R2 → maybe Gain.
7. Inside Gain: [R: low-skill amount] → [R3: atrophy roll, players] → [R: acceleration multiplier] → apply → [Pub45: R stat roll → R primary/secondary → GainStat: R atrophy roll].
8. Legacy mode and success → LegacyGain: up to three rolls (Str, Dex, Int, in that order, each only if its weight > 0 and lock Up), each successful one → GainStat.
9. Fire SkillUsed(from, skill, success).
10. Return success.

## 6. Edge cases and error paths

- Missing skill entry → false, no event.
- `min >= max` → always true, no gain (useful for "you can always do this").
- Dead characters never gain (but the success roll still happens).
- base < 10.0 gains on every use that reaches step 6 with no gain-chance roll: newbies race to 10.0. Combined with 1..4 tenths per gain, 0→10 takes on average 40 attempts.
- gc floor 0.01: a fully capped, maxed character attempting a near-certain task still has a 1% gain roll (blocked later by caps).
- A Locked or Down skill never gains, but the gain-chance roll is still taken (RNG consumed).
- Pub45 stat gain can trigger even when the skill is at its cap (Gain is entered; the "base < cap" block is skipped, the stat block is not).
- Stat atrophy can lower a stat without raising the target (e.g. target stat at statMax but total at cap): net loss of 1. Implementers reproducing parity must keep this.
- `lastGain` updates even if nothing is raised, so a blocked gain still starts the cooldown.

## 7. Randomness

All rolls use the single process-wide `System.Random` instance behind `BuiltInRng.Generator` (Server/Random/BuiltInRng.cs:21-40). `RandomDouble()` = `NextDouble()` in [0,1). `Random(n)` = `Next(n)` in 0..n−1. `RandomMinMax(a,b)` inclusive (swaps if a > b, returns a if equal). Draw order is exactly as in section 5; parity tests must replay draws in that order. For Frankendom, use the project's seeded deterministic RNG (the duel sim has none; progression is outside the 60 Hz sim) and inject it.

## 8. Timing

No tick. Everything happens synchronously inside the skill-use call. Time only matters for stat cooldowns (`now` is the server's cached loop clock), acceleration windows, and anti-macro expiry.

## 9. Engine plumbing to strip

- Mobile handler delegates (4 hooks) → a plain function `checkSkill(character, skillId, chanceOrRange, key?, rng, now)`.
- Faction skill-loss check, Region.AllowGain (jail) → a single `canGain(character)` predicate supplied by the caller.
- AntiMacroSystem persistence, world-save cleanup, logout timers → optional; Frankendom can key "repetition" on opponent id instead (see 10).
- Skill/stat change packets, SkillUsed event → emit a domain event.
- Racial skill bonus, item skill mods, pre-AOS stat influence → out of scope unless designed.
- Config file reads → constants object.

## 10. Notes for the ONE progression proposal (not donor behaviour)

- The donor's anti-grind levers are: (a) gain only while success is uncertain, (b) gain chance falls as skill and total rise, (c) total cap + Down locks, (d) optional same-target repetition limiter. All four map cleanly onto arena fights: "chance" can be derived from opponent rank vs player skill, and the anti-macro key can be the opponent id.
- Expected attempts per 0.1 gain near the top: with total 690/700, skill 99.0/100, an even fight won (chance 0.5): gc = ((10/700)+(1/100))/2 = 0.012143; (0.012143 + 0.25)/2 = 0.131071 → about 7.6 wins per 0.1. Lost even fight (AOS rules): 0.012143/2 = 0.006071 → floored to 0.01 → 100 losses per 0.1.

## 11. Golden cases (hand-derived)

Assume AOS+ era, ML+ (Pub45 on), multiplier 1, gainFactor 1, player, alive, region allows, anti-macro off, not accelerated, totalCap 7000.

| # | Input | Expected |
|---|---|---|
| G1 | v=30.0, min=40, max=90 | false, no RNG drawn, no gain |
| G2 | v=95.0, min=40, max=90 | true, no RNG drawn, no gain |
| G3 | v=50.0, min=40, max=90 | chance = 0.2 |
| G4 | total=3000, base=50.0, cap=100, chance 0.2, success | gc = ((4000/7000 + 50/100)/2 + 0.8×0.5)/2 = (0.535714 + 0.4)/2 = **0.467857** |
| G5 | same as G4 but failed (AOS) | gc = 0.535714/2 = **0.267857** |
| G6 | same as G4 but failed, pre-AOS | gc = (0.535714 + 0.16)/2 = **0.347857** |
| G7 | total=7000, base=99.9, cap=100, chance 0.99, success | raw gc = (0 + 0.001)/2 = 0.0005; (0.0005 + 0.005)/2 = 0.00275 → floored **0.01** |
| G8 | tamed pet, G4 inputs | **0.935714** (floor then ×2) |
| G9 | base=5.0 → Gain called with RNG `Random(4)` = 2 | toGain = 3 tenths; base becomes 5.3 (if total < cap) |
| G10 | base=10.0 exactly | goes through gc roll (not the <10 branch) but toGain is still 1..4 |
| G11 | total=7000 (at cap), skills in id order: Alchemy Down 0.2 (2 tenths), Anatomy Down 50.0; gaining Swords toGain=1; atrophy roll R3 = 0.3 (7000/7000 = 1 ≥ 0.3) | Alchemy (first Down with ≥1 tenth) drops to 0.1; total becomes 6999 < 7000 → Swords +0.1; total back to 7000 |
| G12 | same as G11 but toGain=3 (base ≤ 10) and Alchemy has 2 tenths | Alchemy skipped (2 < 3), Anatomy drops 0.3 |
| G13 | total=6999, no Down skills, Swords base 8.0, toGain=4 | atrophy finds nothing; 6999 < 7000 → Swords +0.4; total **7003** (soft overshoot) |
| G14 | Pub45: Swords gain granted; stat rolls R=0.04 (<0.05), R'=0.80 (≥0.75) | secondary stat Dex chosen → GainStat(Dex) |
| G15 | GainStat(Str), last Str gain 2 s ago, ML delay 3 s | no change (2 s + 3 s ≥ now) |
| G16 | rawStr 100, rawDex 80, rawInt 45, statCap 225 (total 225), raise Str, Dex Down, Int Down | atrophy forced (total ≥ cap); Dex can lower, Dex(80) < Int(45)? no; Int can lower → **Int −1 = 44**; then total 224 < 225 → Str 101 |
| G17 | same but Int Locked | Dex can lower and Int cannot lower → Dex −1 = 79; Str 101 |
| G18 | rawStr 125 (= statMax LBR+), rawDex 80, rawInt 20, total 225, raise Str, Dex Down, Int Locked | Dex lowered to 79, Str stays 125 (CanRaise fails on statMax): net −1 |
| G19 | Legacy (pre-ML), Swords success, R(Str)=0.02 | 0.75/33.3 = 0.022523 > 0.02 → GainStat(Str) |

### How to capture goldens on the VPS later (do not build now)

- Pure entry points: `SkillCheck.CheckSkill(Mobile, Skill, object, double)`, `SkillCheck.Gain`, `SkillCheck.GainStat`, `SkillCheck.IncreaseStat`, `SkillCheck.LegacyGain`, plus the public `Mobile_SkillCheck*` wrappers.
- Harness: a new xUnit test class in `Projects/UOContent.Tests` using the existing `[Collection("Sequential UOContent Tests")]` fixture (`Fixtures/UOContentFixture.cs` → `TestServerInitializer.Initialize()`, which sets `Core.Expansion = EJ` and configures skills). `UOContent.Tests` has `InternalsVisibleTo` into Server, so the test can replace `BuiltInRng.Generator` (internal setter) with a subclass of `System.Random` that returns a scripted sequence from `NextDouble()`/`Next(n)`, and can set `Core._now` to drive cooldowns. Construct `new Mobile()` (or a `PlayerMobile`), set `Skills[...].BaseFixedPoint`, locks, `RawStr/Dex/Int`, `StatCap`.
- To test the pre-ML legacy path, set `Core.Expansion` lower and re-run `SkillCheck.Configure()`; restore afterwards.
- Build needs: .NET SDK 10.0.201 (global.json, rollForward latestMajor). Run on the VPS only (heavy-jobs rule): `dotnet test Projects/UOContent.Tests --filter <ClassName>` and dump each case as JSON lines.
