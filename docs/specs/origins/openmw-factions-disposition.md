# Spec: Factions, reputation and disposition (donor: OpenMW)

- Donor: OpenMW (GPLv3), commit `71fc0a4a2904ed9c315050194f51857ed598a8d1`
- Spec author: analyst-openmw (clean-room spec; implementers must not read donor source)
- Destination: story (factions, reputation), economy (barter and bribe hooks)
- Line numbers are per-file.

## 1. Purpose

- Player faction membership: rank 0-9 per faction, an expelled flag, and per-faction reputation.
- Rank requirements: two attributes, three faction skills and faction reputation, used by dialogue to decide promotions.
- Faction-to-faction reactions, which can be changed at runtime.
- NPC disposition toward the player (0-100). It drives dialogue gating, barter prices, training prices and persuasion.

## 2. Files and call graph

| Concern | Location |
|---|---|
| Faction record | `components/esm3/loadfact.hpp` (RankData 22-38, FADT 56-75, reactions 80, rank names 83) |
| Player/NPC faction state | `apps/openmw/mwmechanics/npcstats.cpp` getFactionRank 88-95, joinFaction 97-102, setFactionRank 104-121, getExpelled 123-126, expell 128-140, clearExpelled 142-145, isInFaction 147-150, faction reputation 152-165, setReputation 325-329 (clamp), hasSkillsForRank 341-380 |
| Rank requirement for dialogue | `apps/openmw/mwdialogue/filter.cpp` RankRequirement 473-493, hasFactionRankSkillRequirements 689-701, hasFactionRankReputationRequirements 703-711 |
| NPC primary faction and rank | `apps/openmw/mwclass/npc.cpp` getPrimaryFaction 1335-1339, getPrimaryFactionRank 1341-1358; initial base disposition from NPC record 317 |
| Script commands | `apps/openmw/mwscript/statsextensions.cpp` PCJoinFaction 610-638, PCRaiseRank 640-676, PCLowerRank 678-707, GetPCRank 709-740, ModDisposition 742-759, SetDisposition 761-775, GetDisposition 777-789, Get/Set/ModPCFacRep 802-891, PcExpelled 958-986, PcExpell 988-1012, PcClearExpelled 1014-1036, RaiseRank (NPC) 1038-1068, LowerRank (NPC) 1070-1100; `apps/openmw/mwscript/dialogueextensions.cpp` Mod/Set/GetReputation 202-240, SameFaction 242, Mod/Get/SetFactionReaction 255-305 |
| Faction reactions | `apps/openmw/mwdialogue/dialoguemanagerimp.cpp` modFactionReaction 702-712, setFactionReaction 714-722, getFactionReaction 724-743 |
| Derived disposition | `apps/openmw/mwmechanics/mechanicsmanagerimp.cpp` getDerivedDisposition 475-561 |
| Persuasion | mechanicsmanagerimp.cpp getPersuasionRatings 47-75, getPersuasionDispositionChange 597-744; dialoguemanagerimp.cpp persuade 533-581, goodbyeSelected 441-462, updateOriginalDisposition 128-140, applyBarterDispositionChange 583-593 |
| Barter price (used by training) | mechanicsmanagerimp.cpp getBarterOffer 563-590 |
| Fatigue term | `apps/openmw/mwmechanics/creaturestats.cpp` getFatigueTerm 39-53 |
| Crime effects on disposition and factions | mechanicsmanagerimp.cpp 1231-1268 (bounty and disposition per crime), 1335-1401 (observer disposition), 1464-1487 (bounty and expulsion) |
| GMST defaults | `apps/opencs/model/world/defaultgmsts.cpp` (editor defaults for new content; values listed below with line) |

## 3. Data structures

Faction record:
- `name`, `rankNames[10]` (empty string = rank does not exist)
- `attributes[2]` (attribute ids)
- `skills[7]` (skill ids, may be empty)
- `rankData[10]`, each `{ attribute1, attribute2, primarySkill, favouredSkill, factionReputation }` (all int)
- `reactions: Map<factionId, int>`
- `hidden` flag

Player/NPC state (NpcStats):
- `factionRank: Map<factionId, int>` (membership = key present)
- `expelled: Set<factionId>`
- `factionReputation: Map<factionId, int>` (default 0, unbounded)
- `reputation` (global, clamped 0..255)
- `baseDisposition` (NPC; initialised from the NPC record), `crimeDispositionModifier` (NPC), `bounty` (player)

Dialogue-manager state: `changedFactionReaction: Map<f1, Map<f2, int>>` (saved with the game).

NPC primary faction and rank: from the NPC record, unless a runtime rank exists in its stats (raised or lowered by script), which takes precedence. No faction gives rank -1.

## 4. Behaviour and formulas

### 4.1 Membership operations
- `getFactionRank(f)` = rank, or -1 if not a member.
- `joinFaction(f)`: if not a member, rank = 0. Otherwise no change. Does NOT clear expelled.
- `setFactionRank(f, n)` (npcstats.cpp 104-121): only for existing members.
  - n < 0: remove membership AND the expelled flag.
  - 0 ≤ n < 10: set rank to the highest r ≤ n such that r == 0 or rankNames[r] is non-empty. The walk-down checks rankNames[n], then n-1, and so on. A gap in names can block or lower a promotion (see golden F9).
  - n ≥ 10: ignored.
- PCRaiseRank(f): if not a member, join at rank 0. Else setFactionRank(current+1). Raising from 9 is a no-op.
- PCLowerRank(f): setFactionRank(current−1). From rank 0 the player LEAVES the faction (and loses expelled status).
- PCJoinFaction(f): join. With no argument, f is the dialogue speaker's faction.
- Expel: add to the set (with message "sExpelledMessage" + faction name). PcClearExpelled removes it.
- Expelled members keep their rank entry. They are still "members" for testPlayer and SameFaction. They are ignored in the disposition faction term (4.6).
- NPC RaiseRank/LowerRank: act on the NPC's runtime rank, seeded from its record rank. LowerRank from 0 is a no-op. LowerRank never goes below 0. Both are no-ops on the player.

### 4.2 Reputation
- Player global reputation: set clamps to [0,255]. ModReputation adds then clamps.
- Faction reputation: get returns the stored value or 0. Set/Mod with no limits. Script with no faction argument uses the speaker's faction, and errors if the speaker has none.

### 4.3 Faction reactions (dialoguemanagerimp.cpp 702-743)
`reaction(f1→f2)` = runtime override if present, else the f1 record's reaction entry for f2, else 0. It is directional (f1's opinion of f2) and NOT symmetric. `modFactionReaction(f1,f2,d)` stores `reaction(f1→f2)+d` as an override. `setFactionReaction` stores an absolute value. Both require both factions to exist.

### 4.4 Rank requirement checks (npcstats.cpp 341-380; filter.cpp 689-711)
For target rank R of faction F (uses the player's BASE values):
- Skills (hasSkillsForRank): collect the player's base value for each non-empty faction skill and sort descending as s0 ≥ s1 ≥ s2 ≥ … If there are no skills: pass. Need s0 ≥ primarySkill(R). If only 1 skill: pass. Need s1 ≥ favouredSkill(R). If only 2: pass. Need s2 ≥ favouredSkill(R). Skills beyond the top 3 are irrelevant.
- Attributes: base(attr0) ≥ attribute1(R) AND base(attr1) ≥ attribute2(R).
- skillsAndAttributesOk = skills AND attributes.
- reputationOk = factionReputation(F) ≥ factionReputation(R).
- Dialogue function RankRequirement = 0 if the speaker has no faction or the player rank ≥ 9. Else `1·skillsAndAttributesOk(r+1) + 2·reputationOk(r+1)`, where r = player rank (-1 if not a member, so rank 0 is checked).
- Promotion is NOT automatic. Content uses an info gated by `RankRequirement = 3` whose result runs PCRaiseRank.

### 4.5 Fatigue term (creaturestats.cpp 39-53)
`norm = 1 if floor(maxFatigue) == 0 else max(0, currentFatigue/maxFatigue)`. `fatigueTerm = fFatigueBase − fFatigueMult·(1 − norm)`, with defaults 1.25 and 0.5, giving 1.25 at full fatigue and 0.75 at empty.

### 4.6 Derived disposition (mechanicsmanagerimp.cpp 475-561)
Computed in float x, for an NPC speaker and the player:
1. `x = baseDisposition + crimeDispositionModifier`
2. If the NPC's race equals the player's race: `x += fDispRaceMod` (5)
3. `x += fDispPersonalityMult · (playerPersonality_modified − fDispPersonalityBase)` (0.5, 50)
4. Faction term. Let F = the NPC's primary faction.
   - If the player has a rank entry in F: if not expelled, `reaction = reaction(F→F)` (the faction's reaction to ITSELF), `rank = playerRank(F)`. If expelled: reaction 0, rank 0.
   - Else if F non-empty: iterate the player's factions in key order (sorted by id), skipping expelled ones. On the first map entry (only if it is not expelled) OR whenever `reaction(F→G) < reaction`, set reaction = reaction(F→G) and rank = playerRank(G). This is the LOWEST reaction among the player's factions. Quirk: reaction starts at 0, so if the first map entry is expelled and skipped, later factions only count if their reaction is negative.
   - Else: reaction 0, rank 0.
   - `x += (fDispFactionRankMult · rank + fDispFactionRankBase) · fDispFactionMod · reaction` (0.5, 1, 3)
5. `x −= fDispCrimeMod · playerBounty` (default 0, so no effect with defaults)
6. If the player has a common or blight disease: `x += fDispDiseaseMod` (−10)
7. If the player's weapon is drawn: `x += fDispWeaponDrawn` (−5)
8. `x += NPC's Charm magnitude`
9. Result = truncate x toward zero to int. When clamped (the default): clamp to [0,100].

### 4.7 Persuasion (mechanicsmanagerimp.cpp 47-75, 597-744)
Ratings for actor A (all "modified" values; fat = A's fatigue term):
- `pers = PER/fPersonalityMod` (5), `luck = LCK/fLuckMod` (10), `rep = reputation·fReputationMod` (1), `lvl = level·fLevelMod` (5)
- `r1 = (rep + luck + pers + Speechcraft)·fat`
- Player: `r2 = r1 + lvl`, `r3 = (Mercantile + luck + pers)·fat`. Note the player's r2 adds lvl unscaled by fatigue, and the player's r3 omits rep.
- NPC: `r2 = (lvl + rep + luck + pers + Speechcraft)·fat`, `r3 = (Mercantile + rep + luck + pers)·fat`

Let D = the NPC's derived disposition (clamped), `d = 1 − 0.02·|D − 50|`.
- `t1 = d·(P.r1 − N.r1 + 50)`, `t2 = d·(P.r2 − N.r2 + 50)`, `t3 = d·(P.r3 − N.r3 + 50) + bribeMod`. bribeMod = fBribe10Mod 35, fBribe100Mod 75, fBribe1000Mod 150 (the 1000 value is also used for non-bribe types, but t3 is only used by bribes).
- `roll` = uniform integer 0..99.
- Constants: iPerMinChance 5, iPerMinChange 10, fPerDieRollMult 0.3, fPerTempMult 1.

Admire: `t = max(5, t1)`. success = roll ≤ t. `c = floor(0.3·(t − roll))`. x = success ? max(10, c) : c.

Intimidate: `t = max(5, t2)`. success = roll ≤ t. `r = floor(t − roll)` if roll ≠ t else 1.
- If success: `s = floor(r·0.3·1)`. NPC Flee base += max(10, s) and Fight base += min(−10, −s), each clamped to 0..100.
- `c = −|floor(r·0.3)|`.
- If success: if |c| < 10 then x = 10 (OpenMW deliberately deviates from vanilla, which gave 0). Else `x = −floor(c·1)` and y = c.
- If failure: `x = floor(c·1)`, y = c.

Taunt: `t = max(5, t1)`. success = roll ≤ t. `c = |floor(t − roll)|`.
- If success: `s = c·0.3·1`. Flee += min(−10, trunc(−s)) and Fight += max(10, trunc(s)), each clamped to 0..100.
- `x = floor(−c·0.3)`. If success and |x| < 10, x = −10.

Bribe: `t = max(5, t3)`. success = roll ≤ t. `c = floor((t − roll)·0.3)`. x = success ? max(10, c) : c.

Output:
- temp = trunc(x·fPerTempMult), clamped so that D + temp stays in [0,100].
- Intimidate: perm = success ? −trunc(temp/fPerTempMult) : trunc(y). A SUCCESSFUL intimidate gives a positive temporary change and an equal NEGATIVE permanent change.
- Others: perm = trunc(temp/fPerTempMult).

Dialogue side (dialoguemanagerimp.cpp 533-581, 441-462, 128-140):
- At each persuade, refresh "original" if a script changed base disposition. If temp > 0, perm > 0 and original + perm + accumulatedPerm < 0, then perm = −(original + accumulatedPerm). Then `current += temp`, base disposition := current, `accumulatedPerm += perm`.
- Skill use: Speechcraft, success or fail use type.
- Bribe success moves 10, 100 or 1000 gold from the player to the NPC.
- The reply comes from topic "<Type> Success|Fail".
- On goodbye, if anything changed (NPC only): compute `zero` = derived disposition with base set to 0, UNCLAMPED, minus Charm. Then base := clamp(original + accumulatedPerm, −zero, 100 − zero). Reset accumulators. Temporary changes vanish; only the permanent part persists.
- Barter (583-593): each completed or failed haggle adds iBarterSuccessDisposition (+1) or iBarterFailDisposition (−1) to the current disposition. It is permanent only if the game setting "barter disposition change is permanent" is on.

### 4.8 Barter offer (mechanicsmanagerimp.cpp 563-590)
If basePrice == 0 or the merchant is a creature: return basePrice. Otherwise, with D = clamped derived disposition:
- `a = min(P.Mercantile,100)`, `b = min(0.1·P.LCK,10)`, `c = min(0.2·P.PER,10)`, with N's d, e, f defined the same way.
- `pc = (D − 50 + a + b + c)·P.fat`, `npc = (d + e + f)·N.fat`
- `buy = 0.01·(100 − 0.5·(pc − npc))`, `sell = 0.01·(50 − 0.5·(npc − pc))`
- `offer = max(1, trunc(basePrice·(buying ? buy : sell)))`

### 4.9 Crime hooks (mechanicsmanagerimp.cpp 1231-1268, 1335-1401, 1464-1487)
Per crime type, (bounty, disp for witnesses, dispVictim):

| Crime | Bounty | disp | dispVictim |
|---|---|---|---|
| Trespass | iCrimeTresspass 5 | iDispTresspass −20 | −20 |
| Pickpocket | iCrimePickPocket 25 | fDispPickPocketMod −25 | −25 |
| Assault | iCrimeAttack 40 | iDispAttackMod −50 | fDispAttacking −10 |
| Murder | iCrimeKilling 1000 | iDispKilling −50 | −50 |
| Theft | max(1, trunc(value·fCrimeStealing 1)) | fDispStealing −0.5 × value | same |

Each witness gets `alarmTerm = 0.01·alarm`. The modifier is applied either permanently (to base) or to crimeDispositionModifier, clamped so the derived value stays in 0..100. Murder and trespass do not change disposition.

If reported: bounty += value. The player is EXPELLED from the victim's primary faction (if the player is a member), or from the owning faction for item crimes.

## 5. GMST defaults (apps/opencs/model/world/defaultgmsts.cpp)

| GMST | Default | line |
|---|---|---|
| fDispRaceMod | 5.0 | 1687 |
| fDispPersonalityMult | 0.5 | 1685 |
| fDispPersonalityBase | 50.0 | 1684 |
| fDispFactionRankMult | 0.5 | 1682 |
| fDispFactionRankBase | 1.0 | 1681 |
| fDispFactionMod | 3.0 | 1680 |
| fDispCrimeMod | 0.0 | 1678 |
| fDispDiseaseMod | −10.0 | 1679 |
| fDispWeaponDrawn | −5.0 | 1689 |
| fPersonalityMod | 5.0 | 1781 |
| fLuckMod | 10.0 | 1749 |
| fReputationMod | 1.0 | 1796 |
| fLevelMod | 5.0 | 1746 |
| fBribe10Mod / 100 / 1000 | 35 / 75 / 150 | 1648 / 1647 / 1646 |
| iPerMinChance | 5 | 1960 |
| iPerMinChange | 10 | 1961 |
| fPerDieRollMult | 0.3 | 1780 |
| fPerTempMult | 1.0 | 1782 |
| fFatigueBase / fFatigueMult | 1.25 / 0.5 | 1707 / 1712 |
| iBarterSuccessDisposition / iBarterFailDisposition | 1 / −1 | 1903 / 1902 |
| iCrimeTresspass/PickPocket/Attack/Killing | 5/25/40/1000 | 1913/1910/1908/1909 |
| iDispTresspass/iDispAttackMod/iDispKilling | −20/−50/−50 | 1918/1916/1917 |
| fDispPickPocketMod / fDispAttacking / fDispStealing / fCrimeStealing | −25 / −10 / −0.5 / 1.0 | 1686 / 1675 / 1688 / 1670 |

Caveat: these are OpenMW-CS defaults for new content files, not values read from Morrowind.esm (we have no game data). Frankendom will own its tuning anyway.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Creature speaker | Disposition test always passes. GetDisposition returns 0. ModDisposition on a creature is silently ignored. |
| Disposition float x negative | Truncated toward zero, then clamped (−12.6 becomes −12 and then 0). |
| Rank names with gaps | Promotion can stall or land lower (4.1). |
| Faction missing from record store | Script commands error ("find" fails). Frankendom should validate ids at load. |
| ModPCFacRep with no faction context | Error. |
| Player not a member, RankRequirement | Checks rank-0 requirements. |
| FacReaction functions | Start at 0 (see dialogue spec D16). |

## 7. Plumbing to strip

MWWorld pointers and classes, ESM loading, GUI messages, the AI-setting side effects of intimidate and taunt (keep only if Frankendom models flee/fight), magic effects (Charm, diseases; replace with a modifier list), PRNG plumbing (inject a seeded RNG for determinism), and the crime witness and alarm system (keep the bounty and expulsion rules only if crimes exist).

## 8. Golden cases (hand-derived with the defaults above)

Common: player PER 60, LCK 40, Speechcraft 30, Mercantile 10, reputation 0, level 5, full fatigue (term 1.25), no disease, weapon sheathed, bounty 500. NPC N: base disposition 50, same race as player, faction "arena", no charm.

| # | Setup | Expected |
|---|---|---|
| F1 | Player in "arena" rank 2, arena self-reaction 3 | x = 50 + 5 + 0.5·(60−50) + (0.5·2+1)·3·3 = 50+5+5+18 = 78. Disposition 78. Bounty ignored (fDispCrimeMod 0). |
| F2 | F1 plus weapon drawn plus common disease | 78 − 5 − 10 = 63 |
| F3 | F1 but player expelled from arena | faction term 0, so 60 |
| F4 | N's faction F; player not in F; member of "guild" rank 4 (F→guild −2) and "temple" rank 0 (F→temple +1); different race; PER 50 | term = (0.5·4+1)·3·(−2) = −18. x = 50 + 0 + 0 − 18 = 32 |
| F5 | x = −12.6 / 100.9 / 78.75 | 0 / 100 / 78 |
| F6 | Admire. Player r1 = (0+4+12+30)·1.25 = 57.5. NPC PER 40, LCK 50, Speechcraft 20, rep 0: r1 = (0+5+8+20)·1.25 = 41.25. D=50 so d=1. t1 = 66.25. roll 30. | success. c = floor(0.3·36.25) = floor(10.875) = 10. x = 10. temp +10, perm +10 |
| F7 | F6 with roll 80 | fail. c = floor(0.3·(−13.75)) = floor(−4.125) = −5. temp −5, perm −5 |
| F8 | Intimidate. Player r2 = 57.5 + 25 = 82.5. NPC level 10: r2 = (50+0+5+8+20)·1.25 = 103.75. t2 = 28.75. roll 10. | success. r = floor(18.75) = 18. s = floor(5.4) = 5. Flee += 10, Fight −= 10. c = −|floor(5.4)| = −5, \|c\| < 10 so x = 10. temp +10, perm −10 (positive while talking, negative after goodbye) |
| F9 | Rank names ["Pit Rat","Brawler","","Gladiator",…], player rank 1, PCRaiseRank | setFactionRank(2): name[2] empty, so it walks to 1. Rank stays 1. |
| F10 | Player rank 0, PCLowerRank | Membership removed, expelled flag cleared. GetPCRank becomes −1. |
| F11 | Rank 3 data: attr1 40, attr2 35, primary 30, favoured 15, rep 10. Faction attributes STR, END. Skills LongBlade, Block, HeavyArmor, Athletics. Player base STR 45, END 35, LongBlade 32, Block 16, HeavyArmor 10, Athletics 20, faction rep 9, current rank 2 | top-3 sorted 32, 20, 16 pass 30/15/15. Attributes pass. Rep 9 < 10. RankRequirement = 1. With rep 10 it is 3. |
| F12 | Bribe 100. Player r3 = (10+4+12)·1.25 = 32.5. NPC Mercantile 30, LCK 50, PER 40, rep 0: r3 = (30+0+5+8)·1.25 = 53.75. D=50. t3 = (32.5−53.75+50)+75 = 103.75. roll 99. | success. c = floor(0.3·4.75) = 1. x = 10. temp +10, perm +10. 100 gold to NPC |
| F13 | d at D=80 | 1 − 0.02·30 = 0.4 |
| F14 | Goodbye. zero (derived with base 0, unclamped) = 28. original 50, accumulated perm +70 | base = clamp(120, −28, 72) = 72 |
| F15 | Barter. Base 300, buying, D 50, player Merc 10, LCK 40, PER 40, full fatigue; NPC Merc 30, LCK 50, PER 50, full fatigue | pc = (0+10+4+8)·1.25 = 27.5. npc = (30+5+10)·1.25 = 56.25. buy = 0.01·(100+14.375) = 1.14375. Offer 343 |
| F16 | modFactionReaction(A,B,+2) where the record has A→B 1, B→A 0 | A→B = 3, B→A = 0 (directional) |

### Capturing goldens later
Use the OpenMW Lua integration harness on the free example-suite template with a custom `.omwaddon` (fixture factions, ranks, NPCs). Use a global Lua test with mwscript calls (PCRaiseRank, ModPCFacRep, GetDisposition), and log results. Persuasion needs a fixed PRNG seed or many-trial statistics. Needs an OpenMW build plus Xvfb on the VPS. Not built now.
