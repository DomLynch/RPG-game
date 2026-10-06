# EQEmu behaviour spec: experience and levelling

- Donor: EQEmu (GPLv3), commit `4aceae18b94ffaafc08e2b17bc41cd72c77f795d`, read-only at `/opt/frankendom-shadow/work/expansion-donors/EQEmu` on the VPS.
- Spec author: analyst-eqemu. Clean-room: behaviour, formulas and constants only. No donor source. Implementers must not open the donor tree.
- Destination: progression. This spec feeds Frankendom's single-career proposal (world kills and arena wins feed one XP pool; trivial and repeated kills must give much less). Section 10 lists what the donor does and does not do about that.

## 1. Purpose

Award experience (XP) to players for killing NPCs (solo, group or raid), turn the XP total into a level, split part into "alternate advancement" (AA) points past level 50, and take XP away on death.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| common/features.h:222 | EXP_FORMULA | base kill XP: level² × 75 × 35 / 10 (integer) |
| common/features.h:227-228 | GROUP_EXP_PER_POINT 1000, RAID_EXP_PER_POINT 2000 | leadership points |
| zone/attack.cpp:2470-2780 | NPC::Death | picks who gets XP, routes to raid / group / solo, faction hits |
| zone/hate_list.cpp:107-150 | HateList::GetDamageTopOnHateList | top damage dealer, grouped by raid or group totals |
| zone/exp.cpp:188-214 | Client::GetExperienceForKill(npc) | base XP for the NPC |
| zone/mob_ai.cpp:2156-2369 | Mob::GetLevelCon(my, other) | consider colour |
| zone/exp.cpp:1121-1183 | Group::SplitExp | group bonus, per-member share and cap |
| zone/exp.cpp:1185-1234 | Raid::SplitExp | raid penalty, per-member share and cap |
| zone/exp.cpp:495-570 | Client::AddEXP | orchestrates normal + AA XP, caps |
| zone/exp.cpp:402-493 | Client::CalculateExp | multipliers, con scaling, per-kill cap; returns new total |
| zone/exp.cpp:216-241 | GetConLevelModifierPercent | colour → multiplier |
| zone/exp.cpp:243-319 | CalculateNormalizedAAExp / CalculateStandardAAExp | AA XP |
| zone/exp.cpp:39-81 | ScaleAAXPBasedOnCurrentAATotal | optional AA catch-up scaling |
| zone/exp.cpp:321-400 | CalculateLeadershipExp | leadership siphon |
| zone/exp.cpp:572-875 | Client::SetEXP | level up/down loop, AA point conversion, level cap |
| zone/exp.cpp:877-997 | Client::SetLevel | side effects of a level change (+5 practice points per new max level, HP clamp/heal) |
| zone/exp.cpp:1001-1087 | Client::GetEXPForLevel(L) | cumulative XP table |
| zone/exp.cpp:1089-1119 | Client::AddLevelBasedExp | quest reward: percentage of a level |
| zone/attack.cpp:1966-2043 | Client::Death (section 3) | death XP loss |
| zone/client_process.cpp:1113-1117; zone/client.cpp:5905 | resurrection | XP given back |
| zone/exp.cpp:105-186 | Client::CalcEXP | quest/API helper (not on the kill path; see 9) |

Kill path:

```
NPC::Death
  killer      = top hate-damage entity (raid/group damage pooled)
  give_exp    = killer if any top damager exists; pets/swarm pets resolve to owning player when in same group/raid
  if give_exp is a player and NPC not already a corpse:
     final = GetExperienceForKill(npc)
     if player in raid   → Raid::SplitExp(final, npc)     (skipped for merchants / LDoN chests)
     elif in group       → Group::SplitExp(final, npc)    (same skip)
     else                → con = GetLevelCon(player.level, npc.level)
                           if con ≠ Gray and NPC is not a player's pet → AddEXP(final, con)
AddEXP → CalculateExp → (AA calc) → caps → SetEXP(new_total, new_aa_total)
```

## 3. Data

- Player: level, cumulative XP (`exp`), AA XP bucket (`expAA`), unspent AA points, spent AA, `perAA` (0-100 % of kill XP diverted to AA), group/raid leadership XP and points, XPRate (100 + spell XP-rate bonuses), race, class, highest level ever reached (`level2`, for practice points).
- NPC (`npc_types`): `level`, `exp_mod` (int percent, default 100), merchant type, owner.
- Zone (`zone` table): `zone_exp_multiplier` (float; see 7, must be seeded as 1.0), hot-zone flag.
- Optional `level_exp_mods` table: per player level `exp_mod`, `aa_exp_mod` (only if Zone:LevelBasedEXPMods).
- Optional per-character zone XP modifiers (only if Character:EnableCharacterEXPMods).

## 4. Constants and rule defaults (common/ruletypes.h unless noted)

| Rule / constant | Default | Line |
|---|---|---|
| EXP_FORMULA | L·L·75·35/10 (integer, left to right) | features.h:222 |
| Character:MaxLevel | 65 | 41 |
| Character:MaxExpLevel | 0 (0 = use MaxLevel) | 44 |
| Character:ExpMultiplier | 0.5 | 62 |
| Character:AAExpMultiplier | 0.5 | 63 |
| Character:FinalExpMultiplier | 1.0 | 61 |
| Character:UseXPConScaling | true | 67 |
| Character:GreenModifier | 20 (%) | 69 |
| Character:LightBlueModifier | 40 | 70 |
| Character:BlueModifier (dark blue) | 90 | 71 |
| Character:WhiteModifier | 100 | 72 |
| Character:YellowModifier | 125 | 73 |
| Character:RedModifier | 150 | 74 |
| Gray | 0 (hard-coded) | exp.cpp:144-146, 238-239 |
| Character:UseRaceClassExpBonuses | true (Warrior, Rogue, Halfling ×1.05 each) | 123 |
| Character:UseOldRaceExpPenalties | false | 124 |
| Character:UseOldClassExpPenalties | false | 125 |
| Character:UseOldConSystem | false | 172 |
| Character:GroupExpMultiplier | 0.5 | 64 |
| Character:EnableGroupEXPModifier | true | 216 |
| Character:EnableGroupMemberEXPModifier | true | 217 |
| Character:GroupMemberEXPModifier | 0.2 | 218 |
| Character:FullGroupEXPModifier | 2.16 | 219 |
| Character:RaidExpMultiplier | 0.2 (raid gets ×(1−0.2)) | 65 |
| Character:FinalRaidExpMultiplier | 1.0 | 66 |
| Character:EnableRaidEXPModifier | true | 221 |
| Character:EnableRaidMemberEXPModifier | true | 222 |
| Character:ExperiencePercentCapPerKill | −1 (off) | 215 |
| Character:EnableCharacterEXPMods | false | 183 |
| Zone:HotZoneBonus | 0.75 (added to the multiplier) | 370 |
| Zone:LevelBasedEXPMods | false | 373 |
| Character:DeathExpLossLevel | 10 | 45 |
| Character:DeathExpLossMaxLevel | 255 | 46 |
| Character:DeathExpLossMultiplier | 3 | 48 |
| Character:UseDeathExpLossMult | false | 50 |
| Character:DeathKeepLevel | false | 49 |
| Character:KeepLevelOverMax | false | 138 |
| Character:HealOnLevel | false | 80 |
| Character:KillsPerGroupLeadershipAA | 250 | 117 |
| Character:KillsPerRaidLeadershipAA | 250 | 118 |
| AA:ExpPerPoint | 23976503 | 996 |
| AA:NormalizedAAEnabled | false | 997 |
| AA:NormalizedAANumberOfWhiteConPerAA | 25 | 998 |
| AA:ModernAAScalingEnabled | false | 999 |
| AA:ModernAAScalingStartPercent | 1000 | 1000 |
| AA:ModernAAScalingAAMinimum | 0 | 1001 |
| AA:ModernAAScalingAALimit | 4000 | 1002 |
| AA:UnusedAAPointCap | −1 (off) | 1004 |
| AA:MaxAAEXPPerKill | −1 (off) | 1005 |
| Hard level bounds in level loop | 2 … 127 | exp.cpp:695-709 |
| Max banked group leadership points | 4 (<35), 6 (<51), 8 | exp.cpp:83-92 |
| Max banked raid leadership points | 6 (<45), 8 (<55), 10 | exp.cpp:94-103 |
| Leadership siphon | ×0.8 of kill XP when leadership XP is on | exp.cpp:325 |

## 5. Formulas

### 5.1 Base kill XP (GetExperienceForKill, exp.cpp:200-210)

base(N) = ⌊N² · 75 · 35 / 10⌋ evaluated in integers left to right (equivalently ⌊2625·N²/10⌋), N = NPC level.
If the NPC's exp_mod ≥ 0: base = ⌊base · exp_mod / 100⌋. Non-NPC targets give 0.
(A quest script hook may replace the whole value; plumbing.)

### 5.2 Consider colour (GetLevelCon, mob_ai.cpp:2156-2369), modern system (default)

d = other − my (signed).
- d = 0 → White; 1 ≤ d ≤ 3 → Yellow; d ≥ 4 → Red.
- my ≤ 15: d ≤ −6 → Gray, else DarkBlue. (No green or light blue below 16.)
- Otherwise grayLvl = my − ⌊(my+5)/3⌋, greenLvl = my − ⌊(my+7)/4⌋.
  - other ≤ grayLvl → Gray; else other ≤ greenLvl → Green;
  - else if my ≤ 20 → DarkBlue; else (my ≥ 21) d ≤ −6 → LightBlue, else DarkBlue.

Resulting bands (player level: lowest NPC level of each colour):

| Player | Gray | Green | LightBlue | DarkBlue | White |
|---|---|---|---|---|---|
| 5 | none | – | – | 1–4 | 5 |
| 10 | ≤4 | – | – | 5–9 | 10 |
| 15 | ≤9 | – | – | 10–14 | 15 |
| 16 | ≤9 | 10–11 | – | 12–15 | 16 |
| 20 | ≤12 | 13–14 | – | 15–19 | 20 |
| 21 | ≤13 | 14 | 15 | 16–20 | 21 |
| 30 | ≤19 | 20–21 | 22–24 | 25–29 | 30 |
| 40 | ≤25 | 26–29 | 30–34 | 35–39 | 40 |
| 50 | ≤32 | 33–36 | 37–44 | 45–49 | 50 |
| 60 | ≤39 | 40–44 | 45–54 | 55–59 | 60 |
| 65 | ≤42 | 43–47 | 48–59 | 60–64 | 65 |

The legacy system (Character:UseOldConSystem) is a table of per-level-band thresholds (Yellow at +1..+2, Red at +3); reference only, see mob_ai.cpp:2160-2320 if ever needed.

Colour multiplier (exp.cpp:216-241): Gray 0, Green 0.20, LightBlue 0.40, DarkBlue 0.90, White 1.00, Yellow 1.25, Red 1.50.

### 5.3 Solo XP (CalculateExp, exp.cpp:402-493; AddEXP 495-570)

Input X = final kill XP, colour C. All "float" steps are IEEE single precision (implement with `Math.fround`), truncation toward zero to integer.

1. X ← trunc(X · XPRate/100) (XPRate 100 unless spell bonuses).
2. AA split: A = ⌊X · perAA / 100⌋; X ← X − A. (perAA clamped to 0 if outside 0..100; forced to 0 below level 51.)
3. m = ExpMultiplier (0.5) [applied only if ≥ 0]; m ×1.05 if Halfling; m ×1.05 if Warrior or Rogue (UseRaceClassExpBonuses); if hot zone, m ← m + HotZoneBonus (**additive**, +0.75).
   z = zone_exp_multiplier (applied if ≥ 0).
   X ← trunc(X · m · z).
4. If UseXPConScaling and C known: X ← trunc(X · colourMult(C)).
5. Leadership siphon (only if the player turned leadership XP on and C ∈ {DarkBlue, White, Yellow, Red}): X ← trunc(X · 0.8); grant group leadership XP of 1000/250 = 4 per kill (raid leader instead gets raid leadership 2000/250 = 8), while below the banked-point cap; optional mentor share.
6. If LevelBasedEXPMods and the player's level has a non-zero mod: X ← X · exp_mod.
7. X ← X · FinalExpMultiplier (1.0).
8. If EnableCharacterEXPMods: X ← X · characterZoneMod.
9. Per-kill cap (if ExperiencePercentCapPerKill = P ≥ 0): let span = need(L+1) − need(L); if 100·X/span > P then new_total = current + ⌊span · P/100⌋ (and stop). P = 0 blocks all normal XP.
10. new_total = current + X.

Steps 1-5 are skipped for resurrection XP.

AA (standard, AA:NormalizedAAEnabled false): A ← A · colourMult(C); a = 1 × z; a ×1.05 Halfling; a ×1.05 Warrior/Rogue; hot zone a ← a + 0.75; optional level mod (uses aa_exp_mod); A ← A · FinalExpMultiplier; A ← trunc(AAExpMultiplier · A · a).
AA (normalized): Gray or resurrection → 0; else A = (perAA/100) · (ExpPerPoint / (25 / colourMult(C))) i.e. 25 white-con kills per AA point at 100 % AA.
Optional modern scaling (off): earned = spent + unspent AA; if 0 ≤ earned < 4000: A' = A · (1000/100) · ((4000 − earned)/4000), but never less than A.
Caps: MaxAAEXPPerKill if ≥ 0; overflow guard; UnusedAAPointCap if ≥ 0 (at cap: AA XP discarded and perAA reset to 0); at level ≤ 50 AA XP is discarded and perAA reset.

### 5.4 Group split (Group::SplitExp, exp.cpp:1121-1183)

Skipped for merchants and player-owned pets as the dead NPC. n = group member count (players + bots, all present members), H = highest member level.
- g = 1.0; if EnableGroupMemberEXPModifier: n ∈ 2..5 → g = 1 + 0.2·(n−1) (1.2, 1.4, 1.6, 1.8); n = 6 → g = 2.16.
- If n ∈ 2..6: pool = X + trunc(X · g · GroupExpMultiplier(0.5)) (or without the 0.5 if EnableGroupEXPModifier is off). n = 1: pool = X.
- C = GetLevelCon(H, npc level). If Gray → nobody gets XP.
- For each **player** member of level Lm: maxDiff = −(⌊Lm·15/10⌋ − Lm), then clamp maxDiff to at most −5 (i.e. maxDiff = min(maxDiff, −5)). Eligible if Lm − H ≥ maxDiff.
  share = min( ⌊(Lm+3)² · 75 · 35 / 10⌋ , ⌊pool / n⌋ ); AddEXP(share, C).
- Note the share passes through AddEXP, so it is multiplied again by ExpMultiplier (0.5), race/class, hot zone and the colour of the **highest** member.

### 5.5 Raid split (Raid::SplitExp, exp.cpp:1185-1234)

Same skips. n = raid member count, H = highest level.
- pool = trunc(X · (1 − 0.2)) if EnableRaidEXPModifier; pool = trunc(pool · FinalRaidExpMultiplier).
- Gray (vs H) → nothing.
- divisor = n if EnableRaidMemberEXPModifier else 1.
- Each non-bot member, same level-gap eligibility as groups: share = min(⌊(Lm+3)²·2625/10⌋, ⌊pool/divisor⌋ + 1); AddEXP(share, C).

### 5.6 XP table (GetEXPForLevel, exp.cpp:1001-1087)

need(L) = cumulative XP at which level L starts = trunc_float32( float32((L−1)³) × float32(mod(L) × 1000) ), where mod(L):

| L | <31 | 31–35 | 36–40 | 41–45 | 46–51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | ≥61 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mod | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5 | 1.6 | 1.7 | 1.9 | 2.1 | 2.3 | 2.5 | 2.7 | 3.0 | 3.1 |

The multiplier applies to the whole cumulative total, so the cost of one level jumps at each band edge (e.g. 30→31 costs 5,311,000 while 31→32 costs 3,070,100). Optional legacy race multipliers (Troll/Iksar 1.2, Ogre 1.15, Barbarian 1.05, Halfling 0.95) and class multipliers (Pal/SK/Rng/Brd 1.4, Monk 1.2, casters 1.1, Rogue 0.91, Warrior 0.9) are off by default.

Selected values (float32 exact):

| L | base(L) kill XP | need(L) | need(L+1) − need(L) |
|---|---|---|---|
| 1 | 262 | 0 | 1,000 |
| 2 | 1,050 | 1,000 | 7,000 |
| 10 | 26,250 | 729,000 | 271,000 |
| 20 | 105,000 | 6,859,000 | 1,141,000 |
| 29 | 220,762 | 21,952,000 | 2,437,000 |
| 30 | 236,250 | 24,389,000 | 5,311,000 |
| 31 | 252,262 | 29,700,000 | 3,070,100 |
| 50 | 656,250 | 164,708,608 | 10,291,392 |
| 51 | 682,762 | 175,000,000 | 23,976,496 |
| 52 | 709,800 | 198,976,496 | 25,996,304 |
| 60 | 945,000 | 616,137,024 | 53,462,976 |
| 65 | 1,109,062 | 812,646,400 | 38,691,072 |

(AA:ExpPerPoint 23,976,503 is documented as "51→52 cost"; the float table gives 23,976,496.)

### 5.7 SetEXP: levels and AA points (exp.cpp:572-875)

Order:
1. If the AA requirement is 0 or need(current level) is invalid → abort.
2. Messages (plumbing): gain vs loss; "party"/"raid" wording by membership.
3. Level up: c = level + 1; while new_total ≥ need(c): c += 1 (stop at 127). Level down: while new_total < need(c − 1): c −= 1 (stop at 2). Then c −= 1 → c is the new level. Multiple levels per kill are possible.
4. AA points: if new_aa ≥ R (R = AA:ExpPerPoint): gained = ⌊new_aa / R⌋, remainder kept; unspent AA += gained.
5. Cap: maxL = (MaxExpLevel or, if ≤ 0, MaxLevel) + 1, overridden by a per-character max level (quest bucket/global). If c > maxL: c = maxL and new_total = need(maxL) (or need(level+1) if KeepLevelOverMax). If c ≠ level and c < maxL → SetLevel(c).
6. At level = maxL − 1 (i.e. the cap, 65): new_total is clamped to need(maxL) — XP stops accumulating at the start of the next level.
7. Store exp and expAA. Below level 51, perAA forced to 0.

SetLevel side effects worth keeping: when a new highest-ever level is reached, +5 training points per level beyond the previous highest (first time ever: +5); HP is clamped to the new max (or fully healed if HealOnLevel); mana refilled.

### 5.8 Death XP loss (attack.cpp:1966-2043)

- Default (UseDeathExpLossMult false): loss = trunc(L · (L/18.0) · 12000) (double precision), L = player level.
- Alternative: loss = trunc(exp · t[k]) with t = {0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 11.0} % and k = DeathExpLossMultiplier (3; out of 0..10 → 3).
- If LevelBasedEXPMods: loss ×= level mod.
- If DeathKeepLevel: loss ≤ exp − need(level at death).
- loss = 0 if L < 10 or L > 255, or the killer (or its owner) is a player/bot (PvP), or the killing spell is a player's DoT.
- If loss > 0 and the player is not a GM: new = exp − loss, but if loss > exp, new = 1. Then SetEXP (so **de-levelling is possible**).
- The lost amount is stored on the corpse for resurrection. A res spell with percentage p (0 < p < 100) returns ⌊loss/100⌋ · p (integer division first); p = 100 returns all of it; p ≤ 0 returns nothing.

### 5.9 Quest reward helper (AddLevelBasedExp, exp.cpp:1089-1119)

pct clamped to ≤ 100; reference level = min(player level, max_level arg) (arg 0 = player level); award = ⌊(need(ref+1) − need(ref)) · pct / 100⌋, then level mod (unless ignored) and FinalExpMultiplier. Bypasses ExpMultiplier, race/class, con scaling. Useful model for "arena win = X % of a level".

## 6. Who gets the kill (attack.cpp:2612-2660)

- The XP recipient is the entity with the most damage on the hate list, where a raid's or group's damage is pooled (hate_list.cpp:107-150; ties go to the later entry because the comparison is ≥).
- A pet recipient becomes its ultimate owner when the owner is a player (or a bot in the owner's group/raid); otherwise nobody gets XP.
- Swarm/temporary pets resolve to their owner.
- No XP for: NPC already flagged as a corpse; merchants; LDoN treasure chests; NPCs that are a player's pet; Gray con (solo: vs the player; group/raid: vs highest member).
- There is no minimum-damage requirement and no kill-steal protection beyond "top damage".

## 7. Edge cases and traps

- `zone_exp_multiplier` is multiplied in when ≥ 0, and the column's repository default is 0.00. A zone row of 0 therefore yields **zero XP**. Treat as 1.0 in Frankendom and verify the PEQ seed values before capturing goldens.
- Float32 precision changes table values (see need(50)). Use float32 emulation for exact parity.
- Integer arithmetic order in base XP: (L·L·75·35)/10, floor at the end.
- The colour multiplier is applied once in CalculateExp; the group/raid path also applies it once (from the highest member's view), so low members in a mixed group receive the colour of the highest member, not their own.
- Per-member cap (L+3)²·262.5 binds for low-level members in high-level kills (power-levelling brake).
- Group n (groups.cpp:1111) counts every member **name** in the group, including members who are in another zone, bots and mercs; H (groups.cpp:1126, starting value 1) only looks at members present in this zone. So an absent member still dilutes everyone's share and receives nothing. Raid n (raids.cpp:552) likewise counts every named raid member.
- Hot zone bonus is additive to a 0.5 base, so a hot zone gives ×2.5 relative to normal (1.25 / 0.5).
- Level-loss from death can cross several levels in principle; level minimum 2 inside the loop (a level-1 character never loses XP anyway because L < 10).
- At the level cap XP is clamped, not banked.

## 8. RNG use

None on the XP path. (Leadership mentoring and faction HeroicCHA are separate.) XP is fully deterministic given inputs — ideal for goldens.

## 9. Plumbing to strip

Packets (ExpUpdate, LevelUpdate, leadership updates), chat messages and string ids, quest/Lua hooks (GetExperienceForKill, SetEXP, SetAAEXP, GetEXPForLevel, GetRequiredAAExperience overrides; EVENT_EXP_GAIN, EVENT_AA_GAIN, EVENT_LEVEL_UP/DOWN), player event logs, QueryServ AA-rate SQL, evolving-item XP, bots and mercs levelling, guild/tribute updates, PvP flag at level, task-system kill updates, `Client::CalcEXP` (an API helper that uses the **player's** level in the base formula; not on the kill path), leadership AA (keep only if Frankendom wants squad leadership).

## 10. Mapping notes for the Frankendom single-career proposal

What the donor provides for "trivial and repeated kills give much less":
- Trivial: con-colour scaling (Green 20 %, LightBlue 40 %, Gray 0 %) relative to the killer's level, and Gray kills give nothing at all, including in groups (highest member decides).
- Power-levelling brake: per-member cap (L+3)²·262.5 and the group level-gap rule.
- Loot side: trivial_max_level removes item drops for over-level killers (see eqemu-loot.md 5.6).

What the donor does **not** have: any per-mob, per-spawn or per-time-window diminishing return for repeated kills of the same NPC, and no daily/rested XP. Frankendom must design repeat-kill decay itself (recommendation for the progression lane, not donor behaviour). Arena wins have no donor analogue; AddLevelBasedExp (5.9: "p % of the current level") is the closest donor pattern for a level-relative fixed reward.

## 11. Golden cases (hand-derived, default rules, zone multiplier 1.0, XPRate 100, perAA 0, not hot zone, leadership off, human non-warrior/rogue)

G-X1 base(10) = 100·75 = 7500 → ·35 = 262,500 → /10 = 26,250. base(5) = 6,562. base(33) = 285,862. base(1) = 262.

G-X2 Solo, player 10 kills NPC 10 (White): 26,250 → ·0.5 = 13,125 → ·1.0 = **13,125**. Level span 271,000 → 4.843 % per kill, 20.65 kills per level.

G-X3 Solo, player 10 kills NPC 5 (DarkBlue): 6,562 → ·0.5 = 3,281 → ·0.9 = 2,952.9 → **2,952**.

G-X4 Solo, player 10 kills NPC 4 (Gray): **0**, AddEXP not called.

G-X5 Solo, player 30 kills NPC 20 (Green): 105,000 → 52,500 → ·0.2 → **10,500** (8.9 % of a White kill, 118,125).

G-X6 Solo, player 30 kills NPC 33 (Yellow): 285,862 → 142,931 → ·1.25 = 178,663.75 → **178,663**.

G-X7 Solo, Warrior 30 kills NPC 30 in a hot zone: m = 0.5·1.05 + 0.75 = 1.275 → 236,250·1.275 = 301,218.75 → **301,218** (float32: verify 1.275f rounding; 0.525f+0.75f).

G-X8 Group of 2, both level 10, NPC 10: g = 1.2; pool = 26,250 + trunc(26,250·1.2·0.5) = 26,250 + 15,750 = 42,000; share = min(⌊13²·2625/10⌋ = 44,362, 21,000) = 21,000; AddEXP White: ·0.5 → **10,500 each** (80 % of solo).

G-X9 Group of 6, all level 10, NPC 10: pool = 26,250 + 28,350 = 54,600; share 9,100 → **4,550 each**.

G-X10 Group gap: highest 30, member 20: maxDiff = −(30 − 20) = −10, diff −10 → eligible. Member 19: maxDiff = −(28 − 19) = −9, diff −11 → **no XP**. Highest 10, member 5: maxDiff −2 → clamped −5, diff −5 → eligible; member 4 → no XP.

G-X11 Low member cap: group of 2, levels 50 and 20, NPC 50 (White vs 50; member 20 is outside the gap → no XP anyway). Levels 50 and 40 (maxDiff for 40 = −20, diff −10 eligible): pool = 656,250 + 393,750 = 1,050,000; share = 525,000; cap for 40 = ⌊43²·2625/10⌋ = 485,362 → level-40 member gets 485,362 → ·0.5 → 242,681 (White, colour of the level-50 member).

G-X12 Raid of 12, all level 50, NPC 52 (Yellow): pool = trunc(709,800·0.8) = 567,840; share = min(737,362, 47,320 + 1) = 47,321 → ·0.5 = 23,660 → ·1.25 = **29,575 each**.

G-X13 Table: need(2) = 1,000; need(11) = 1,000,000; need(31) = 29,700,000; need(51) = 175,000,000.

G-X14 Level-up loop: level 10 with 999,000 XP gains 13,125 → 1,012,125 ≥ need(11) → level 11; < need(12) = 1,331,000 → stays 11.

G-X15 Death, level 10: loss = trunc(10·(10/18)·12000) = trunc(66,666.67) = **66,666**. With 760,000 XP → 693,334 < need(10) = 729,000 → **de-levels to 9**. Level 9 death: loss 0. Level 50: 1,666,666.

G-X16 Death alt formula (UseDeathExpLossMult true, k 3): exp 1,000,000 → loss 35,000.

G-X17 Resurrection 90 % of a 66,666 loss: ⌊66,666/100⌋ = 666; 666·90 = 59,940 returned.

G-X18 Cap: level 65 (MaxLevel 65): XP total clamped to need(66).

G-X19 Per-kill cap rule P = 5 at level 10: a 30,000 XP kill is 11.07 % of 271,000 → capped to ⌊271,000·0.05⌋ = 13,550.

### Capturing real goldens on the VPS later (do not build now)

- Build `zone`, `world`, `shared_memory` from the pinned commit (CMake + vcpkg presets in CMakePresets.json) in a scratch dir on the VPS; MariaDB with PEQ content + a fixture `zone` row with zone_exp_multiplier 1.0, fixture `npc_types` at chosen levels/exp_mod, `rule_values` set to the defaults above.
- Driving without a real client: the zone has a test/sidecar CLI (`zone/zone_cli.cpp`, `tests:*` and `sidecar:*` commands). Add a small test command (in a throwaway patch, never upstream) that constructs a Client stub, sets level/exp, calls AddEXP / Group::SplitExp / GetEXPForLevel and prints results; or use a Lua quest (`EVENT_SAY` → `e.self:AddEXP(...)`, `GetEXPForLevel`) with a headless bot client. The XP path has no RNG, so single runs are goldens.
