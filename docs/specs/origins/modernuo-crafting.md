# ModernUO behaviour spec: crafting (CraftSystem / CraftItem)

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **economy** (recipes, resources, item quality) with a hook into **progression** (crafting is a skill use; see modernuo-skill-stat-gain.md).

## 1. Purpose

A crafting *system* (blacksmithy, tailoring, carpentry, bowcraft, …) owns a list of *recipes* ("craft items"). Each recipe names: the item produced, one or more resources with amounts, one or more required skills with a [min, max] range, and flags. Attempting a recipe:

1. checks the character can attempt it (skills, tools, station proximity, resources, hits/mana/stamina),
2. waits a short animation delay,
3. rolls **exceptional quality** and then **success**; success consumes the resources and creates the item; failure consumes resources too (how much depends on era) and wears the tool,
4. every completed attempt is a skill use for each required skill, so crafting trains the skill.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| UOContent/Engines/Craft/Core/CraftSystem.cs:7-12 | CraftECA enum | three exceptional-chance formulas |
| UOContent/Engines/Craft/Core/CraftSystem.cs:20-35 | ctor(minEffect, maxEffect, delay) | animation repetitions and seconds per repetition |
| UOContent/Engines/Craft/Core/CraftSystem.cs:51-69 | MainSkill, ECA, GetChanceAtMin | per-system constants (overridden by each Def*) |
| UOContent/Engines/Craft/Core/CraftSystem.cs:71-90 | GetContext | per-player craft context (last made, mark option) |
| UOContent/Engines/Craft/Core/CraftSystem.cs:97 | ConsumeOnFailure | default true; per-system override per resource type |
| UOContent/Engines/Craft/Core/CraftSystem.cs:139-195 | AddCraft | registers a recipe with one resource and one skill |
| UOContent/Engines/Craft/Core/CraftSystem.cs:213-325 | SetManaReq/SetStamReq/SetHitsReq/SetUseAllRes/SetNeedHeat/AddRes/AddSkill/AddSubRes … | recipe builders |
| UOContent/Engines/Craft/Core/CraftItem.cs:135-200 | CraftItem fields | recipe data |
| UOContent/Engines/Craft/Core/CraftItem.cs:299-327 | ConsumeAttributes | hits/mana/stamina requirement check and spend |
| UOContent/Engines/Craft/Core/CraftItem.cs:580-794 | ConsumeRes | resource check / consumption incl. failure loss |
| UOContent/Engines/Craft/Core/CraftItem.cs:812-839 | GetExceptionalChance | exceptional formula |
| UOContent/Engines/Craft/Core/CraftItem.cs:841-858 | CheckSkills | exceptional roll then success roll |
| UOContent/Engines/Craft/Core/CraftItem.cs:860-912 | GetSuccessChance | success formula; optionally performs skill-gain checks |
| UOContent/Engines/Craft/Core/CraftItem.cs:914-1013 | Craft | validation, then starts the timer |
| UOContent/Engines/Craft/Core/CraftItem.cs:1312-1635 | CompleteCraft | final success/failure resolution |
| UOContent/Engines/Craft/Core/CraftItem.cs:1840-1967 | InternalTimer | animation ticks, quality roll, maker's mark, calls CompleteCraft |
| UOContent/Engines/Craft/DefBlacksmithy.cs:16, 26, 28, 93-118, 129-165, 294-305, 683-704 | blacksmith system | constants, CanCraft (anvil+forge within 2), ending messages, sample recipes, metal sub-resources |
| UOContent/Engines/Craft/DefTinkering.cs:135-143 | ConsumeOnFailure override | silver is never lost on failure |
| other Def*.cs | constructors / ECA / GetChanceAtMin | table in 4.1 |

Call graph:

```
player picks recipe in craft menu
  └─ CraftSystem.CreateItem → CraftItem.Craft(from, system, resourceType, tool)
       ├─ busy lock (one craft at a time)
       ├─ GetSuccessChance(gainSkills = false) → require all skills ≥ min and chance > 0
       ├─ recipe learned? system.CanCraft (tool, station)
       ├─ ConsumeRes(None) = "have enough?"; ConsumeAttributes(check only)
       └─ start InternalTimer(n ticks, system.Delay)
InternalTimer final tick
  ├─ release busy lock; CanCraft again
  ├─ CheckSkills(gainSkills = false)  → sets quality = 2 if exceptional roll passes (success result discarded)
  ├─ maker's mark decision
  └─ CompleteCraft(quality, mark, …)
        ├─ CanCraft, ConsumeRes(None), ConsumeAttributes(check)   [re-validate]
        ├─ CheckSkills(gainSkills = true)  → each required skill: Mobile.CheckSkill(skill, min, max)  [skill gain]
        │                                   → exceptional roll (discarded) → success roll
        ├─ success: ConsumeRes(All), spend hits/mana/stam, tool −1 use, create item with quality, add to pack
        └─ failure: ConsumeRes(All or Half, isFailure), tool −1 use, "failed, materials lost"
```

## 3. Data structures

**CraftSystem** (one per craft): `mainSkill`, `minCraftEffect`, `maxCraftEffect`, `delay` (seconds per tick), `eca` (exceptional-chance variant), `chanceAtMin(recipe)`, `subRes` / `subRes2` (material families, e.g. metals and dragon scales), recipe list, recipe groups, flags (resmelt, repair, mark option, enhance).

**CraftItem** (recipe):

| Field | Type | Meaning |
|---|---|---|
| itemType | type | produced item |
| resources | list of {type, amount, missingMessage} | consumed inputs |
| skills | list of {skill, min, max} | required skills; the one equal to the system's main skill drives the chance |
| mana / hits / stam | int | required (and spent on success) |
| useAllRes | bool | stackable mass-craft: makes as many as resources allow |
| useSubRes2 | bool | use the second material family |
| needHeat / needOven / needMill | bool | station proximity |
| forceNonExceptional | bool | exceptional chance forced to 0 |
| recipe | optional id | must be learned first |
| requiredExpansion | enum | client gate (strip) |

**CraftSubRes** (material tier): {type, name, requiredSkill (main-skill **base**), message}. Blacksmith metals: iron 0.0, dull copper 65.0, shadow iron 70.0, copper 75.0, bronze 80.0, gold 85.0, agapite 90.0, verite 95.0, valorite 99.0 (DefBlacksmithy.cs:687-695); dragon scales all 0.0 (699-704).

**Quality**: 0 = low ("barely able"), 1 = regular, 2 = exceptional. The core flow only ever produces 1 or 2; a produced item's own OnCraft may return a different final quality for the message.

**CraftContext** (per player per system): last-made list, mark option {mark, don't mark, prompt}.

## 4. Formulas and constants

### 4.1 Per-system constants

All systems: `minCraftEffect = 1`, `maxCraftEffect = 1`, `delay = 1.25 s`.

| System | chanceAtMin | ECA |
|---|---|---|
| Alchemy | 0.0 | ChanceMinusSixty |
| Blacksmithy | 0.0 | ChanceMinusSixtyToFortyFive |
| Bowcraft/Fletching | 0.5 | FiftyPercentChanceMinusTenPercent |
| Carpentry | 0.5 | ChanceMinusSixty |
| Cartography | 0.0 | ChanceMinusSixty |
| Cooking | 0.0 | ChanceMinusSixtyToFortyFive |
| Glassblowing | 0.5 for hollow prism, else 0.0 | ChanceMinusSixty |
| Inscription | 0.0 | ChanceMinusSixty |
| Masonry | 0.0 | ChanceMinusSixty |
| Tailoring | 0.5 | ChanceMinusSixtyToFortyFive |
| Tinkering | (see DefTinkering; not re-derived here) | default |

### 4.2 Success chance (CraftItem.cs:860-912)

For each required skill: `v = character's effective skill value`; if `v < min` → `allRequiredSkills = false`. If `gainSkills`, call the standard skill check `CheckSkill(skill, min, max)` for **every** required skill (this is the only place crafting trains skills; its own success/fail is ignored).

If not all skills met → chance 0.

Else, with the main skill's (min, max, v): 

`chance = chanceAtMin + (v − min) / (max − min) × (1 − chanceAtMin)`

then `+ talismanSuccessBonus / 100` if the equipped talisman matches the main skill (strip or map to a gear stat).

**Not clamped**: chance can exceed 1.0 (e.g. v above max). If a recipe has no skill equal to the main skill, min = max = v = 0 and the division is 0/0 = NaN; every comparison with NaN is false, so such a recipe can never succeed. Do not author recipes like that.

### 4.3 Exceptional chance (CraftItem.cs:812-839)

Starting from the success chance `c` (after talisman success bonus):
1. If forceNonExceptional → 0.
2. If talisman matches: `c = c − successBonus/100`; `bonus = exceptionalBonus/100`; else bonus 0.
3. By ECA:
   - ChanceMinusSixty: `e = c − 0.6`
   - FiftyPercentChanceMinusTenPercent: `e = c × 0.5 − 0.1`
   - ChanceMinusSixtyToFortyFive: `e = c − clamp(0.60 − (mainSkillValue − 95.0) × 0.03, 0.45, 0.60)` (the subtracted amount is 0.60 at or below 95.0 skill, falls 0.03 per point, reaches the 0.45 floor at 100.0)
4. Return `e + bonus` if `e > 0`, else `e` (negative = no chance).

### 4.4 The rolls (CraftItem.cs:841-858)

CheckSkills: `exceptional if e > R_a` (sets quality 2); then `success if c > R_b`. Note strict `>` both times.

**Important (surprise):** the quality that ends up on the item comes from the CheckSkills call in the **timer** (gainSkills = false); its success result is thrown away. CompleteCraft then calls CheckSkills **again** with skill gain on; that call's exceptional roll is thrown away and only its success roll counts. So quality and success are two independent rolls taken at different moments, and the skill-gain checks happen between them.

### 4.5 Resource consumption (CraftItem.cs:580-794)

For each recipe resource:
1. **Material substitution:** if the resource type is the system's family base type (e.g. iron ingot) and the player picked a material, substitute it; if the player's main-skill **base** is below that material's requiredSkill → fail with the material's message.
2. Equivalent types (e.g. logs/boards, cloth variants) are accepted via a fixed type table.
3. `amount = recipe amount`.
4. useAllRes: `perResourceMax = floor(packAmount / amount)`; `maxAmount = min over resources`; if 0 → fail "not enough".
5. Failure adjustment (only when consuming because of a failed attempt):
   - if the system says this resource is not consumed on failure (tinkering: silver) → amount 0;
   - else if era is **before UOTD**: `amount = amount − floor(amount / 2)` (i.e. ceil(amount/2) is lost);
   - else (UOTD and later, i.e. any modern setting): **amount unchanged**.
6. useAllRes: every amount × maxAmount; otherwise maxAmount = −1.

Then by consume type:
- None (a check): fail if any resource's available quantity (best single hue group, or plain quantity for quantity-type resources) is below its amount.
- Half: `amount = max(1, floor(amount / 2))`, then consume.
- All: consume.

On failure the call uses `Half` if useAllRes else `All`. Combined with step 5, the loss on a failed attempt is:

| Era | normal recipe (amount A) | useAllRes recipe (amount A, batch M) |
|---|---|---|
| pre-UOTD | ceil(A/2) | max(1, floor(ceil(A/2) × M / 2)) |
| UOTD and later | **A (everything)** | max(1, floor(A × M / 2)) |

**Surprise:** in every modern expansion setting a failed normal craft eats the full resource amount, while the message still says "some of your materials are lost". This looks unintended relative to classic UO (half loss). Frankendom design must choose explicitly; recommend half (pre-UOTD behaviour) as the parity target only if designers want classic feel.

Special: the runebook recipe also needs one blank recall rune, consumed on success.

Consumed hue: the largest consumed stack of a colour-retaining resource gives the item its hue (ties go to the later stack).

### 4.6 Timing (CraftItem.cs:1008-1012, 1850-1967)

`ticks = randInt(0 .. maxEffect − minEffect) + minEffect + 1`; with 1/1 this is always **2**. Ticks fire at 0 s and then every `delay`; the last tick resolves. So every craft resolves **1.25 s** after the request. Each non-final tick plays the craft sound; every tick counts as a disruptive action (interrupts e.g. meditation).

### 4.7 Tool wear

Success or failure: tool uses −1. If uses < 1 and the tool breaks on depletion → tool destroyed ("worn out"). Blacksmithy also wears an equipped special hammer if it is not the tool used (success path only).

### 4.8 Maker's mark

If quality is exceptional and the main skill **base** ≥ 100.0 and the item type is markable → mark is possible: prompt, auto-mark, or never, by player option.

## 5. Order of operations (one attempt)

1. Busy-lock acquire (fail: "must wait").
2. Client expansion gate (strip).
3. GetSuccessChance without gain; if a required skill is below min or chance ≤ 0 → refuse ("don't have the required skills").
4. Recipe learned? (fail message).
5. system.CanCraft: tool present, not worn out, equipped-tool rule, tool on person; station (blacksmith: anvil and forge within 2 tiles).
6. ConsumeRes(None) → enough resources (fail: resource's own message or default "don't have the resources").
7. ConsumeAttributes(check) → hits/mana/stamina.
8. Record "last made", start timer (2 ticks, 1.25 s).
9. Final tick: release busy lock; CanCraft again.
10. Quality roll: CheckSkills(no gain) → R_a exceptional (if e > 0 path), R_b success (discarded).
11. Maker's mark choice (may prompt; CompleteCraft then runs after the prompt).
12. CompleteCraft: CanCraft, ConsumeRes(None), ConsumeAttributes(check) again.
13. CheckSkills(with gain): for each required skill a full skill check (RNG per section 7 of the skill spec); R_c exceptional (discarded); R_d success.
14. Success: ConsumeRes(All) and spend hits/mana/stam (if this now fails, abort with message, nothing created); tool −1; create item, apply quality/mark/material hue, stack size or uses × batch for useAllRes; add to backpack; message by quality.
15. Failure with a missing skill (cannot normally happen after step 3) → message, nothing consumed.
16. Failure: ConsumeRes(failure rules); tool −1; message "failed, and some materials are lost".

## 6. Edge cases and error paths

- Skill above max: chance > 1 → success guaranteed, but exceptional uses the unclamped chance (e.g. 1.292 − 0.45 = 0.842), so over-skilling raises exceptional odds. Also, the skill check for gain short-circuits at v ≥ max, so **over-skilled crafts teach nothing**.
- Resources removed during the 1.25 s wait → re-validation in CompleteCraft aborts with the missing-resource message; nothing consumed.
- Tool broken between request and resolution → CanCraft message.
- Material requirement uses **base**, not effective value.
- If the backpack cannot hold the product, the generic add-to-backpack falls back to dropping it at the crafter's feet (no failure).
- Character deleted mid-timer: context null → silent stop.

## 7. Randomness

Shared `System.Random` (see skill spec section 7). Draw order for one attempt: timer tick count (1 draw, always 0 with 1/1); at resolution: [timer CheckSkills] R_a (only drawn if `e > R_a` evaluated — it is always evaluated), R_b; [CompleteCraft CheckSkills] per required skill the skill-check draws, R_c, R_d; then item OnCraft draws (item-specific, e.g. random attributes).

## 8. Engine plumbing to strip

Craft gump/menu, T2A menu variant, client-expansion gate, packets/sounds/animations, faction imbue gump, command logging, "indecipherable map" on non-Felucca maps, talisman bonus (unless Frankendom has an equivalent gear stat), BeginAction/EndAction busy lock (replace with a simple per-player "crafting until t" field), serialization.

## 9. Golden cases (hand-derived)

Blacksmith broadsword: min 35.4, max 85.4, 10 iron ingots, chanceAtMin 0, ECA ChanceMinusSixtyToFortyFive.

| # | Input | Expected |
|---|---|---|
| C1 | smith skill 30.0 | refused before timer (below min), nothing consumed |
| C2 | skill 60.4 | chance = 25/50 = **0.5**; exceptional: 0.5 − 0.60 = −0.1 → **no exceptional possible** |
| C3 | skill 90.0 | chance = 54.6/50 = **1.092** (always succeeds); subtract clamp(0.60 + 0.15) = 0.60 → e = **0.492** |
| C4 | skill 97.0 | chance 1.232; subtract 0.60 − 0.06 = 0.54 → e = **0.692** |
| C5 | skill 100.0 | chance 1.292; subtract 0.45 → e = **0.842**; base ≥ 100 → maker's mark eligible |
| C6 | skill 60.4, failure, modern era | 10 ingots consumed (full amount), tool −1 |
| C7 | skill 60.4, failure, pre-UOTD | 10 − 5 = **5** ingots consumed |
| C8 | recipe amount 9, failure, pre-UOTD | 9 − 4 = **5** consumed |
| C9 | Bowcraft recipe min 30, max 70, skill 50 | chance = 0.5 + 0.5 × 0.5 = **0.75**; e = 0.75 × 0.5 − 0.1 = **0.275** |
| C10 | Carpentry recipe min 0, max 50, skill 25 | chance = 0.5 + 0.5 × 0.5 = 0.75; e = 0.75 − 0.6 = **0.15** |
| C11 | Cooking useAllRes, 1 dough per batch, 20 dough in pack, failure, modern | maxAmount 20 → amount 20 → Half → **10** dough lost |
| C12 | Broadsword, choose verite ingots, smith base 94.9 | refused at ConsumeRes(None) with the "not skilled enough for this metal" message |
| C13 | timing | request at t=0 → resolution at t = **1.25 s** |
| C14 | roll independence | R_a = 0.3, R_b = 0.9 (timer), skill 97 → quality exceptional (0.692 > 0.3); CompleteCraft R_d = 0.5 < 1.232 → success → **exceptional item** even though the timer's own success roll (0.9 vs 1.232) is irrelevant |

### How to capture goldens on the VPS later (do not build now)

- Pure functions: `CraftItem.GetSuccessChance(from, typeRes, system, false, out _)`, `CraftItem.GetExceptionalChance(system, chance, from)`, `CraftItem.ConsumeRes(...)` with `ConsumeType.None/Half/All` and `isFailure`.
- Harness: xUnit class in `Projects/UOContent.Tests` (sequential collection fixture). Create a `PlayerMobile` with a `Backpack`, set `Skills.Blacksmith.BaseFixedPoint`, drop `IronIngot` stacks, get the recipe via `DefBlacksmithy.CraftSystem.CraftItems.SearchFor(typeof(Broadsword))`. Avoid `Craft()`/timers (they need tools, anvils and the timer wheel); call `CompleteCraft` directly with a stub tool if the full path is wanted, and script `BuiltInRng.Generator` (internal setter visible to UOContent.Tests).
- Run consumption cases twice with `Core.Expansion` set below and above UOTD to capture both loss rules.
- Build: .NET SDK 10.0.201; run on VPS only.
