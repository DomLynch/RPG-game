# Spec: Levelling and skill progression, Morrowind model (donor: OpenMW)

- Donor: OpenMW (GPLv3), commit `71fc0a4a2904ed9c315050194f51857ed598a8d1`
- Spec author: analyst-openmw (clean-room spec; implementers must not read donor source)
- Destination: progression (input to Frankendom's ONE progression proposal)
- Line numbers are per-file.

## 1. Purpose

Skills improve by USE. Each use adds a gain scaled by how "hard" that skill is for the character's class. Every few increases of major or minor skills fill a level bar. At 10 the player may level up (on sleeping), choosing 3 attributes. Each attribute rises by a multiplier earned from the skill increases of skills that attribute governs. Health grows by a fraction of Endurance. Trainers sell single skill points for gold.

Important architecture fact: at this commit, skill-use XP, skill increases and level-progress accounting live in Lua (`files/data-mw/scripts/omw/playerskillhandlers.lua` on top of `files/data/scripts/omw/skillhandlers.lua`), attached to the PLAYER only. NPCs do not progress. The C++ side keeps the counters, the level-up application and health.

## 2. Files and call graph

| Concern | Location |
|---|---|
| Skill-use entry from gameplay (for example a weapon hit) | `apps/openmw/mwclass/npc.cpp` 641 (hit), 1020-1023 (forward to Lua `skillUse`) |
| Engine to Lua event | `apps/openmw/mwlua/engineevents.cpp` 126-133 |
| Generic SkillProgression interface (gain lookup, handler chains, use-type table, increase sources) | `files/data/scripts/omw/skillhandlers.lua` skillUsed 49-74, skillLevelUp 76-83, SKILL_USE_TYPES 175-202, SKILL_INCREASE_SOURCES 219-224, engine handlers 231-239 |
| Morrowind rules (requirement, level-up options, handlers, jail) | `files/data-mw/scripts/omw/playerskillhandlers.lua` getSkillProgressRequirement 20-38, getSkillLevelUpOptions 40-68, skillLevelUpHandler 70-117, jailTimeServed 119-152, skillUsedHandler 154-171 |
| Legacy C++ requirement (same formula) | `apps/openmw/mwmechanics/npcstats.cpp` getTypeFactor 169-184, getSkillProgressRequirement 186-212 |
| Level-up application and health | npcstats.cpp levelUp 224-246, updateHealth 248-254, getLevelupAttributeMultiplier 256-271, skill-increase counters 273-298 |
| Level-up dialog (3 coins, multiplier display, apply) | `apps/openmw/mwgui/levelupdialog.cpp` sMaxCoins 32, availability 195-221, apply 242-265 |
| When level-up is offered | `apps/openmw/mwgui/waitdialog.cpp` 286 (only when SLEEPING and progress ≥ iLevelUpTotal) |
| Character creation (starting skills, attributes, health) | `apps/openmw/mwmechanics/mechanicsmanagerimp.cpp` buildPlayer 111-236 |
| Training | `apps/openmw/mwgui/trainingwindow.cpp` skill list 76-121, purchase 163-201, finish 217-228, trainer skill value 230-235 |
| Barter price applied to training | mechanicsmanagerimp.cpp getBarterOffer 563-590 (see the factions spec section 4.8) |
| Records | `components/esm3/loadclas.hpp` 37-51 (class: 2 favoured attributes, specialization, 5 major, 5 minor), `components/esm3/loadskil.hpp` 50-88 (skill: governing attribute, specialization, 4 use values) |
| GMST defaults | `apps/opencs/model/world/defaultgmsts.cpp` (lines in section 5) |

```
gameplay event (hit, block, cast, ...) -> skillUsed(skill, useType, scale?)
   gain = skill.useValue[useType] (x scale if given)
   -> skillUsedHandler: progress += gain / requirement(skill); if progress >= 1 -> skillLevelUp(skill, "usage")
skillLevelUp(skill, source)  [usage | trainer | book | jail]
   options = getSkillLevelUpOptions(skill, source)
   -> skillLevelUpHandler: base += increase; levelProgress += p; attrIncreases[gov] += a; specIncreases[spec] += s; reset progress if usage
sleep -> if levelProgress >= iLevelUpTotal -> LevelUp dialog -> apply 3 attribute raises -> npcStats.levelUp()
```

## 3. Data structures

- Class: `favouredAttributes[2]`, `specialization` in {Combat=0, Magic=1, Stealth=2}, `majorSkills[5]`, `minorSkills[5]`. Every other skill is "misc".
- Skill record: `governingAttribute`, `specialization`, `useValue[4]` (float XP per use type; DATA-DEFINED, we hold no Morrowind values, and Frankendom defines its own).
- Use types (skillhandlers.lua 175-202): index 0..3 per skill. Examples: weapon successful hit = 0; armour hit by opponent = 0; block success = 0; athletics run one second = 0, swim one second = 1; acrobatics jump = 0, fall = 1; speechcraft success = 0, fail = 1; mercantile success = 0 (bribe = 1 is noted as unused in vanilla); security disarm = 0, pick lock = 1; sneak avoid notice = 0, pickpocket = 1; alchemy create = 0, use ingredient = 1; enchant recharge = 0, use item = 1, create = 2, cast-on-strike = 3; armorer repair = 0.
- Per-skill runtime: `base` (0..100 for progression purposes), `modified`, `progress` (fraction 0..1 in the Lua model).
- Per-character level state: `level`, `levelProgress` (int), `skillIncreasesForAttribute: Map<attr,int>`, `skillIncreasesForSpecialization[3]` (only used for the level-up dialog's class picture, cosmetic).

## 4. Behaviour and formulas

### 4.1 Skill progress requirement (playerskillhandlers.lua 20-38; npcstats.cpp 186-212)
`req(skill) = (base + 1) · typeFactor · specFactor`
- typeFactor = fMajorSkillBonus (0.75) if major, fMinorSkillBonus (1.0) if minor, else fMiscSkillBonus (1.25).
- specFactor = fSpecialSkillBonus (0.8) if skill.specialization == class.specialization, else 1.
- C++ version: a typeFactor ≤ 0, or a specFactor ≤ 0 when it applies, is an error.
- Note: the Lua requirement checks MAJOR before minor. The Lua level-up options (4.3) and C++ getTypeFactor check MINOR first. This only matters if a skill is in both lists; Frankendom should forbid that.

### 4.2 Skill use (skillhandlers.lua 49-74; playerskillhandlers.lua 154-171)
1. If no explicit gain: useType must be 0..3, else the event is ignored with an error log. `gain = useValue[useType]`, times `scale` if provided.
2. If the character is a werewolf: no progress.
3. If base ≥ 100 and gain > 0, or base ≤ 0 and gain < 0: no progress.
4. `progress += gain / req(skill)`.
5. If progress ≥ 1: skillLevelUp(skill, "usage"). Only one level-up per use event.

### 4.3 Level-up options per source (playerskillhandlers.lua 40-68)
- levelUpProgress: minor → iLevelUpMinorMult (1); major → iLevelUpMajorMult (1); misc → 0.
- attribute increase value: minor → iLevelUpMinorMultAttribute (1); major → iLevelUpMajorMultAttribute (1); misc → iLevelupMiscMultAttriubte (1). The GMST name really is misspelled "Attriubte"; keep the key if mirroring GMST names.
- Source "jail" and skill is not Security or Sneak: increase = −1 and NO other effects (no level progress, no attribute count).
- Otherwise: increase = +1, plus levelUpProgress, plus attribute = skill's governing attribute with the value above, plus specialization = skill's specialization with iLevelupSpecialization (1).

### 4.4 Skill increase (playerskillhandlers.lua 70-117)
1. If (base ≥ 100 and increase > 0) or (base ≤ 0 and increase < 0): abort (nothing changes, not even level progress).
2. `base += increase`.
3. `levelProgress += levelUpProgress` (if provided).
4. `skillIncreasesForAttribute[governing] += attributeValue`.
5. `skillIncreasesForSpecialization[spec] += specValue`.
6. Unless the source is jail: notify "skill increased to N" (books prefix a message). If levelProgress ≥ iLevelUpTotal, notify "you should rest and meditate". If the source is "usage" (or unspecified), reset `progress = 0`. Overflow is DISCARDED. Trainer and book increases do NOT reset accumulated progress.

### 4.5 Level-up trigger (waitdialog.cpp 286)
Only when the player SLEEPS (not waits) and levelProgress ≥ iLevelUpTotal (10) does the level-up dialog open.

### 4.6 Attribute multiplier (npcstats.cpp 256-271)
`n = clamp(skillIncreasesForAttribute[attr], 0, 10)`. If n == 0 (or there is no entry): ×1. Else the value of GMST `iLevelUp{n:02}Mult`, and ×1 if that GMST is missing.

| n | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | ≥10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mult | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 4 | 4 | 5 |

(defaults: defaultgmsts.cpp 1934-1943)

### 4.7 Level-up dialog and application (levelupdialog.cpp 195-265; npcstats.cpp 224-246)
1. Selectable attributes = those with base < 100. Coins = min(3, number selectable). Displayed multiplier = min(mult, 100 − base). It is shown only when > 1.
2. The player must pick exactly `coins` distinct attributes. Picking when full replaces the last pick.
3. Apply, in this order: for each picked attribute, `base = min(100, base + mult(attr))`. THEN levelUp:
   - `levelProgress = max(0, levelProgress − iLevelUpTotal)`. Extra progress CARRIES OVER (12 becomes 2).
   - Clear skillIncreasesForAttribute (all). The specialization counters are NOT cleared by levelUp.
   - `healthGain = END_base(after the raise) · fLevelUpHealthEndMult (0.1)`. maxHealth += healthGain. currentHealth = max(1, currentHealth + healthGain). Health is a float, so fractional gains accumulate.
   - level += 1.

### 4.8 Character creation (mechanicsmanagerimp.cpp 111-236; npcstats.cpp 248-254)
1. Level := record level (player 1). Skills and attributes start from the record.
2. If a race is chosen: attributes := race base values for the sex. Each skill := 5 + race bonus for that skill.
3. If a class is chosen: +10 to each of the 2 class attributes. +10 each minor skill. +25 each major skill. +5 to EVERY skill whose specialization matches the class (stacks with major/minor).
4. Health := floor(0.5·(STR_base + END_base)). Then current dynamic stats := their maximums.

### 4.9 Training (trainingwindow.cpp)
- The trainer offers its 3 highest skills, by its modified value (or base, if the game setting "trainers training skills based on base skill" is on). Ties keep content order (stable sort).
- `price = max(1, playerBase(skill) · iTrainingMod (10))`, then passed through the barter offer as buying (factions spec section 4.8; depends on disposition, Mercantile, Luck, Personality, fatigue).
- Purchase is refused if: price > player gold; trainer skill value ≤ player base ("trainer not skilled enough"); player base ≥ governing attribute MODIFIED value ("cannot train above the governing attribute").
- On success: skillLevelUp(skill, "trainer") (counts toward level progress like usage, does not reset use progress), gold to the trainer's gold pool, 2 game hours pass (rest applied).

### 4.10 Jail (playerskillhandlers.lua 119-152)
For each day served: pick a uniformly random skill and apply skillLevelUp(skill, "jail"). Security and Sneak get +1 with full level-up effects. All others get −1 with no level effects. A skill at 0 does not drop. Report the net change per skill.

## 5. GMST defaults (apps/opencs/model/world/defaultgmsts.cpp)

| GMST | Default | line |
|---|---|---|
| fMajorSkillBonus | 0.75 | 1762 |
| fMinorSkillBonus | 1.0 | 1772 |
| fMiscSkillBonus | 1.25 | 1775 |
| fSpecialSkillBonus | 0.8 | 1811 |
| iLevelupTotal | 10 | 1950 |
| iLevelupMajorMult / iLevelupMinorMult | 1 / 1 | 1944 / 1946 |
| iLevelupMajorMultAttribute / Minor / Misc("Attriubte") | 1 / 1 / 1 | 1945 / 1947 / 1948 |
| iLevelupSpecialization | 1 | 1949 |
| iLevelUp01..10Mult | 2,2,2,2,3,3,3,4,4,5 | 1934-1943 |
| fLevelUpHealthEndMult | 0.1 | 1747 |
| iTrainingMod | 10 | 1966 |

Caveat: these are OpenMW-CS defaults for new content, not read from Morrowind.esm. Skill use values (SKIL `useValue`) are content data and are NOT in code, so none are given here.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Skill at 100 | No use progress and no trainer or book increase (abort before level progress). |
| Large single gain | At most one increase per use. Overflow discarded. |
| Level progress far above 10 | One level per sleep. Remainder carried (minus 10, floored at 0). |
| Attribute at 100 | Not selectable. If fewer than 3 are selectable, coins shrink. |
| Attribute near cap | Raise is capped at 100. Display shows the capped multiplier. |
| Luck | Normally no skill governs Luck, so ×1. |
| Werewolf | No skill-use progress. |
| Invalid useType | Ignored with an error log. |
| Skill both major and minor | Inconsistent between the Lua requirement (major) and the level-up options (minor). Forbid it. |
| Console level-up with progress < 10 | Progress clamps to 0. |

## 7. Plumbing to strip

The Lua handler chain and interface versioning (Frankendom can implement one pure function per rule, but keep the "source" enum and the handler hook so Origins can override), sound and UI messages, the level-up GUI (coins become a UI concern; the rules are 4.7), the time-advance and rest system (training "2 hours"), the barter UI, and ESM records (replace with JSON class and skill tables).

## 8. Golden cases (hand-derived with the defaults above; use gain g = 1.0 for clarity)

| # | Input | Expected |
|---|---|---|
| L1 | Major skill, spec matches class, base 30 | req = 31·0.75·0.8 = 18.6. With g=1, 19 uses to increase (18 uses give 0.9677). |
| L2 | Misc, spec differs, base 5 | req = 6·1.25 = 7.5, so 8 uses |
| L3 | Minor, spec matches, base 15 | req = 16·1.0·0.8 = 12.8, so 13 uses |
| L4 | Major, spec differs, base 99 | req = 75, so 75 uses to reach 100. Then further uses do nothing. |
| L5 | progress 0.98, one use adds 0.05 | skill +1, progress becomes 0 (not 0.03) |
| L6 | 9 major/minor increases, then 3 misc increases | levelProgress = 9. No level-up available. |
| L7 | levelProgress 12, sleep, level-up | after: progress 2, level +1 |
| L8 | Increase counts STR 6, END 3, AGI 0, LCK 0. Picks STR, END, LCK. STR 40, END 40, LCK 40. maxHealth 45, current 30 | STR 43 (×3), END 42 (×2), LCK 41 (×1). healthGain = 4.2. Max 49.2, current 34.2. Counters cleared. |
| L9 | Count 14 for an attribute | ×5 (clamped at 10 increases) |
| L10 | Attribute base 98, mult 4 | becomes 100. Dialog shows "x2". |
| L11 | Creation: race STR 50, END 40; class attributes STR, END; LongBlade major, spec Combat, LongBlade is Combat, race bonus 5 | STR 60, END 50. LongBlade = 5+5+25+5 = 40. Health = floor(0.5·110) = 55 |
| L12 | Creation: misc skill, other spec, no race bonus | 5 |
| L13 | Training: player LongBlade 30, trainer LongBlade 50, governing STR modified 60, buying terms as factions spec F15 | base price 300, offer 343. After: LongBlade 31, level progress +1 if major/minor. Use progress kept. |
| L14 | Training refused: player LongBlade 60, STR modified 60 | refused (skill ≥ governing attribute) |
| L15 | Jail 1 day, random pick Athletics base 0 | no change (cannot go below 0) |
| L16 | Jail 1 day, random pick Sneak base 20 (minor) | Sneak 21, levelProgress +1, AGI counter +1 (Sneak's governing attribute as defined in data) |

### Capturing goldens later
The OpenMW Lua integration harness (`scripts/integration_tests.py`; `test_lua_api` runs on the free example-suite template) can call `I.SkillProgression.skillUsed(skill, {skillGain=…})` and `skillLevelUp(skill, source)` on the player, then read `types.NPC.stats.skills[...]` and `types.Actor.stats.level(self)` (progress and skillIncreasesForAttribute) and log them. A fixture `.omwaddon` defines a test class and skills with known use values. Needs an OpenMW build plus Xvfb on the VPS. Not built now. No Morrowind data is needed.
