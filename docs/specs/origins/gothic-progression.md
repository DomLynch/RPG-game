# Spec: Levelling, experience, learning points and talents (Gothic donor)

- Spec author: analyst-gothic (clean-room)
- Donor: OpenGothic @ `801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1` (MIT, `LICENSE`, "Copyright (c) 2019 Try")
- Reference: ZenKit @ `ddf27decd5eeb48ec715e6e66e5f5072c51d88ee` (MIT, `license.md`, "Copyright 2021-2024 GothicKit Contributors")
- Paths relative to `OpenGothic/common/`. No donor code reproduced.
- Feeds: Frankendom's single progression proposal (Gothic II mentor model: earn learning points, spend them with a teacher).

## 1. Purpose and the big caveat

In Gothic II the whole levelling economy is SCRIPT. The engine has NO function that grants experience, checks a level-up threshold, awards learning points, prices a lesson or validates a teacher. Those live in Daedalus script functions (in the retail game: helpers such as the XP-grant and teach routines) that we do not have and must not obtain.

What the ENGINE does provide:
1. Storage for `level`, `exp`, `exp_next`, `lp` on every NPC (script-visible fields; script writes them directly, no external needed).
2. Storage for per-talent skill tier (`talentSkill[t]`) and per-talent value (`talentValue[t]`), plus the script-visible `hitchance[5]` array.
3. Side effects of talents: animation overlays for weapon tiers, sneak permission, magic circle, crit chance in melee damage, hit and crit chance for bows.
4. Attributes (HP, max HP, mana, max mana, strength, dexterity, regen) with clamping and regen ticking; strength feeds melee damage directly.
5. Display of level/exp/next/LP on the character screen.
6. Preservation of level/exp/lp across shape-change (transform back keeps them).

So for Frankendom the donor gives a DATA MODEL and the COMBAT CONSEQUENCES of learning. The economy (XP curve, LP per level, lesson cost) must be designed by us; section 8 lists what scripts would normally do so the proposal can name its equivalents.

## 2. Files and functions (path:line)

| Concern | Location |
|---|---|
| NPC fields `level`, `exp`, `exp_next`, `lp`, `hitchance[5]`, `attribute[8]` | `ZenKit/include/zenkit/addon/daedalus.hh:178-219` |
| Getters for level/exp/next/lp | `world/objects/npc.cpp:1315-1329` |
| Character screen binding | `ui/gamemenu.cpp:1231-1233` |
| Transform-back preserves progression | `world/objects/npc.cpp:130-150` |
| Talent ids | `game/constants.h:436-461` |
| Attribute ids | `game/constants.h:463-473` |
| Talent skill set/get, value set/get, hitchance get | `world/objects/npc.cpp:1186-1214` |
| Talent overlays (tier visuals) | `world/objects/npc.cpp:1110-1184` |
| Sneak / magic circle / rune circle from talents | `world/objects/npc.cpp:1220-1226`, `:1311-1313` |
| Externals for talents | `game/gamescript.cpp:2086-2104` |
| Attribute change and clamping | `world/objects/npc.cpp:1238-1267` |
| HP/mana regen tick | `world/objects/npc.cpp:2298-2314`, called at `:2368-2373` |
| Melee damage (G2 uses hitchance as crit roll) | `game/damagecalculator.cpp:127-182` |
| Minimum damage | `game/damagecalculator.h:13`, `game/damagecalculator.cpp:27-29` |
| Ranged hit/crit from talents | `world/objects/npc.cpp:4100-4108`, `game/damagecalculator.cpp:60-95` |
| Save/load of fields | `game/serialize.cpp:319-346` |

## 3. Call graph

```
Script (teacher dialogue choice)            Script (kill / quest reward)
  -> reads other.lp, checks cost              -> other.exp += X; if exp >= exp_next: level++, lp += N, exp_next += f(level) ...
  -> other.lp -= cost                         (all script; no engine call)
  -> Npc_ChangeAttribute / Npc_SetTalentSkill / Npc_SetTalentValue / writes hitchance[]
        -> engine: clamp attribute | store tier + swap overlays | store value
Combat
  swordDamage reads strength, weapon damage, target protection, hitchance[talent] (G2) or talentValue (G1)
  bow shot reads talentValue (crit) and hitchance (hit)
Character screen reads level, exp, exp_next, lp
```

## 4. Data structures

- Progression fields on each NPC: `level`, `exp`, `exp_next`, `lp` (all int32). Engine never writes them except to copy them across a transform-back.
- Talents (G2 ids): 1 1H, 2 2H, 3 Bow, 4 Crossbow, 5 Picklock, 7 Mage (circle), 8 Sneak, 9 Regenerate, 10 Firemaster, 11 Acrobat, 12 Pickpocket, 13 Smith, 14 Runes, 15 Alchemy, 16 TakeAnimalTrophy, 17 ForeignLanguage, 18 WispDetector, 19-21 spare. Max 22 (G1: 12).
- `talentSkill[22]`: tier (0, 1, 2 for weapons; 0/1 for flags; circle number for magic).
- `talentValue[22]`: percentage-like value per talent.
- `hitchance[5]`: index 0 unknown/fists, 1 1H, 2 2H, 3 bow, 4 crossbow. Script-owned; read by engine.
- Attributes: 0 HP, 1 HP max, 2 mana, 3 mana max, 4 strength, 5 dexterity, 6 regen HP, 7 regen mana.

## 5. Formulas and constants

### 5.1 Attribute change (`npc.cpp:1238-1267`)
`Npc_ChangeAttribute(npc, a, v)`: ignore if a >= 8 or v == 0. HP loss ignored for the player in god mode, for the player during a cutscene, and for immortal NPCs. Then `attr[a] += v`, floor at 0; HP capped at HP max; mana capped at mana max. Max attributes, strength and dexterity are NOT capped. A negative change re-validates equipped items (requirements). HP change triggers the unconscious/death check (guild spec 5.5).

### 5.2 Regen (`npc.cpp:2298-2314`)
Per frame with real tick T (ms since start) and frame dt: `t0 = T mod 1000`, `t1 = t0 + dt`, `delta = floor(t1*r/1000) - floor(t0*r/1000)` where r = regen attribute; new value = clamp(v + delta, 0, max). Net effect: r points per real second, credited as the 1-second boundary is crossed. Skipped when r = 0 or T < dt. Dead NPCs do not regen.

### 5.3 Talent side effects
- Weapon tier overlays (`npc.cpp:1121-1184`): for 1H, 2H, bow, crossbow: tier 0 removes both tier overlays, tier 1 applies the tier-1 overlay and removes tier-2, tier 2 the reverse. Acrobat: 0 removes, non-zero applies. Other tiers (>= 3) change nothing visual.
- `canSneak = talentSkill[Sneak] != 0`; `mageCycle = talentSkill[Mage]`; `magicCircle = talentSkill[Runes]`.
- Out-of-range talent ids: set ignored, get returns 0.

### 5.4 Melee damage, Gothic II branch (`damagecalculator.cpp:127-165`)
Inputs: attacker strength S, attacker damage per type d[i] (weapon's if one is active, else the NPC's own), target protection p[i], damage-type mask, talent T = 2H if weapon is two-handed, 1H if any other weapon, "unknown" (index 0) if unarmed.
1. Roll `c = rand(100)` in [0, 99]. If attacker is a monster AND unarmed, force `c = -1` (always full damage).
2. For each damage type in the mask: `v = max(S + d[i] - p[i], 0)`; if `hitchance[T] <= c` (a MISS of the skill roll) then `v = floor((v - 1) / 10)`; types where `p[i] < 0` (immune) are skipped.
3. Sum over types. If the hit landed and the target is not immune to every type: `damage = max(sum, 5)` (MinDamage 5, `damagecalculator.h:13`).
Meaning: the trained percentage in 1H/2H is the chance of a "clean" hit; otherwise roughly a tenth of the damage. This is where spending learning points on a weapon talent pays off.

### 5.5 Melee damage, Gothic I branch (`damagecalculator.cpp:166-182`) - reference only
Roll c; if `talentValue[T] <= c` then `v = max(S + d - p, 0)` else `v = max(S + M*d - p, 0)` with M = script `DAM_CRITICAL_MULTIPLIER` (crit doubles weapon part). No MinDamage in G1.

### 5.6 Ranged (`npc.cpp:4100-4108`)
Projectile crit chance = talentValue[Crossbow or Bow] / 100; hit chance = hitchance[Crossbow or Bow] / 100. Range beyond the bow max range always misses (`damagecalculator.cpp:82`).

## 6. Order of operations (a lesson, engine view)
1. Script checks `other.lp >= cost` and any attribute caps (script rule).
2. Script subtracts LP by writing the field.
3. Script raises the stat: attributes via `Npc_ChangeAttribute`; weapon percentages by writing `hitchance[...]` and/or `Npc_SetTalentValue`; tiers via `Npc_SetTalentSkill` (engine swaps overlays immediately).
4. Engine reflects the change on the next damage roll and on the character screen. Nothing else is triggered.

## 7. Edge cases
- `Npc_SetTalentSkill` with id >= 22 is ignored; `hitChance(t)` guards with `t <= 5` (off-by-one in donor: index 5 would read past the 5-entry array). Our implementation: valid indices 0..4 only.
- Unarmed humans use hitchance[0]; scripts usually leave it at 0, so with c in [0,99] every unarmed human hit is a skill miss (reduced) unless MinDamage lifts it to 5.
- Transform (e.g. polymorph) restores the old NPC record but keeps the CURRENT level/exp/next/lp and aivars - progress earned while transformed is kept.
- Regen with negative r drains and can kill (death check runs).

## 8. What scripts implement (not in donor; design inputs for our proposal)
Names below are generic descriptions, not retail identifiers or values:
- XP grant on kill and quest completion; level-up loop while `exp >= exp_next`; LP award per level; next-threshold growth; HP max increase per level.
- Teacher dialogues: availability conditions (guild, quest state, `Npc_KnowsInfo`), cost per point that rises with the current stat value, upper caps per teacher, refusal lines.
- Attribute potions and permanent bonuses (`Npc_ChangeAttribute` on max values).
Retail numbers are deliberately NOT given here: they are in the game's scripts, which we neither have nor should derive from. Frankendom's numbers must be our own.

Engine externals a TS port needs: `Npc_ChangeAttribute`, `Npc_SetTalentSkill`, `Npc_GetTalentSkill`, `Npc_SetTalentValue`, `Npc_GetTalentValue`, plus direct field access to level/exp/exp_next/lp/hitchance/attribute. Dialogue gates use `Npc_KnowsInfo` (dialogue spec).

## 9. Plumbing to strip
Overlay file naming (`<scheme>_1HST1.MDS` etc.; map tiers to our animation sets instead), G1/G2 branch, god-mode and cutscene guards (keep a generic invulnerable flag), item requirement re-validation (only if we have stat requirements), savegame, transform-back.

## 10. Golden cases

Attribute change
1. HP 80/100, change +50 -> 100. 2. HP 10, change -25 -> 0 (then death/KO rule). 3. Strength 30, change +5 -> 35 (no cap).

Regen (r = 2)
4. T = 990, dt = 16: t0 = 990 -> floor(1980/1000) = 1; t1 = 1006 -> floor(2012/1000) = 2; +1.
5. T = 500, dt = 16: 1000->1, 1032->1; +0.
6. Over 1000 consecutive ms in any frame split: +2 total.

Melee G2 (S = 50, weapon edge 30, protection edge 20, 1H weapon, hitchance[1] = 30)
7. Roll c = 50 -> 30 <= 50 skill miss -> v = 60 -> floor(59/10) = 5 -> max(5,5) = 5.
8. Roll c = 10 -> clean -> 60.
9. Same with hitchance[1] = 100 -> always clean (c <= 99) -> 60.
10. Unarmed monster, S = 20, own damage 15, prot 5, hitchance[0] = 0 -> c = -1 -> 0 <= -1 false -> 30.
11. Target protection -1 on the only damage type -> immune, invincible, no MinDamage -> 0.
12. S + d - p = 3, clean hit -> max(3, 5) = 5.

Melee G1 (reference) 13. S 50, d 30, p 20, M 2, talentValue 30, c = 10 -> crit -> 50 + 60 - 20 = 90; c = 50 -> 60.

Talent overlays 14. Set 1H tier 2 then tier 1 -> overlay set {1H tier 1}. 15. Set 2H tier 3 -> overlays unchanged.

Capture later: all are pure functions with an injected RNG; implement as table-driven unit tests. Retail-script behaviour (XP curve) cannot and should not be captured.
