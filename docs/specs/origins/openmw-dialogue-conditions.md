# Spec: Dialogue conditions and info selection (donor: OpenMW)

- Donor: OpenMW (GPLv3), commit `71fc0a4a2904ed9c315050194f51857ed598a8d1`
- Spec author: analyst-openmw (clean-room spec; implementers must not read donor source)
- Destination: story
- Line numbers are per-file.

## 1. Purpose

Given a speaker, the player and a dialogue (topic, greeting, persuasion result, service refusal, voice line), pick which reply ("info") the speaker gives. Each info carries static speaker filters, player filters, up to 6 generic conditions (function or variable plus comparison operator plus value) and a minimum disposition. The FIRST info in priority order that passes all tests wins.

## 2. Files and call graph

| Concern | Location |
|---|---|
| Filter: speaker tests | `apps/openmw/mwdialogue/filter.cpp` testActor 83-164 |
| Filter: player tests | filter.cpp testPlayer 166-207 |
| Filter: conditions | filter.cpp testSelectStructs 209-216, testSelectStruct 267-298, testSelectStructNumeric 300-351, getSelectStructInteger 353-573, getSelectStructBoolean 575-681 |
| Filter: disposition | filter.cpp testDisposition 218-229 |
| Filter: local-variable test | filter.cpp testFunctionLocal 231-265 |
| Rank-requirement helpers | filter.cpp 683-711 |
| Selection loop and Info Refusal fallback | filter.cpp list 736-779, search 720-729 |
| "Could this ever match" pre-check | filter.cpp couldPotentiallyMatch 731-734 with matchesStaticFilters 32-80 |
| Condition typing, argument index, comparison | `apps/openmw/mwdialogue/selectwrapper.cpp` (compare 13-39, getArgument 52-150, getType 152-248, getName 265-268, getId 275-278) |
| Condition encoding and parse | `components/esm3/dialoguecondition.hpp` 16-131, `components/esm3/dialoguecondition.cpp` load 13-132 |
| INFO fields | `components/esm3/loadinfo.hpp` 24-111, `components/esm3/loadinfo.cpp` 17-98 |
| Dialogue flow (greeting, topic, choice, persuasion, service refusal, say) | `apps/openmw/mwdialogue/dialoguemanagerimp.cpp` startDialogue 142-197, executeTopic 284-332, updateActorKnownTopics 344-396, getAvailableTopics 398-414, keywordSelected 424-434, questionAnswered 464-509, persuade 533-581, checkServiceRefused 595-623, say 625-664, addTopicsFromText 117-126 |
| Dialogue iteration order | `apps/openmw/mwworld/store.cpp` 934-951 (dialogues sorted by id) |
| Script hooks | `apps/openmw/mwscript/dialogueextensions.cpp` Choice 137-158, Goodbye 192, AddTopic 118-135 |

```
startDialogue(actor)
  for each Greeting dialogue in id order ("Greeting 0".."Greeting 9"):
     Filter(actor, choice=-1, talkedTo).search(dialogue, fallback=false)
     first hit -> mark actor talked-to, show text, run result script, learn topics from text, stop
topic click -> executeTopic -> Filter.search(dialogue, fallback=true)
choice click -> questionAnswered(n) -> Filter(choice=n).search(lastTopic, fallback=true)
Filter.list:
  for info in dialogue.infos (priority order):
     if testActor && testPlayer && testSelectStructs:
        if testDisposition -> accept (stop unless listing all)
        else infoRefusal = true
  if nothing accepted && infoRefusal && fallback: same loop over dialogue "Info Refusal"
```

## 3. Data structures

### INFO fields used by the filter (loadinfo.hpp 38-82)
- `actor` (speaker id), `race`, `class`, `faction`, `cell`, `pcFaction` (all optional ids)
- `factionLess`: true when the faction field holds the literal sentinel "FFFF" (loadinfo.cpp 46-54). It means "only for speakers with no faction".
- `data.disposition` (int; same storage as journalIndex), `data.rank` (speaker min rank, -1 = none), `data.gender` (Male=0, Female=1, NA=-1), `data.pcRank` (player min rank, -1 = none)
- `selects`: list of conditions (max 6 in content, index 0-5)
- `response`, `resultScript`, `sound`

### Condition (dialoguecondition.hpp 16-131)
`{ index 0..9, function: enum, comparison: Eq|Ne|Gt|Ge|Lt|Le, variable: string, value: int32 | float }`

Encoded as a string rule: char0 = index digit, char1 = kind, chars2-3 = function number or a type tag plus 'X', char4 = operator '0'..'5' (Eq, Ne, Gt, Ge, Lt, Le), rest = variable name. Kind '1' means a function, numbered 00-73. Kinds '2'..'C' mean, in order: Global, Local, Journal, Item, Dead, NotId, NotFaction, NotClass, NotRace, NotCell, NotLocal. The value is a separate int or float. Parse rules (dialoguecondition.cpp 13-132): a rule shorter than 5 chars, an operator outside '0'..'5', an unknown kind, a function number above 73, a variable kind with no variable name, or a non-int/float value gets DROPPED (the info keeps its other conditions). A bad index digit becomes 0. A malformed type tag is only logged.

Function numbering (stable ids, keep them): 0 FacReactionLowest, 1 FacReactionHighest, 2 RankRequirement, 3 Reputation, 4 HealthPercent (speaker), 5 PcReputation, 6 PcLevel, 7 PcHealthPercent, 8 PcMagicka, 9 PcFatigue, 10 PcStrength, 11-37 Pc<skill> (Block, Armorer, MediumArmor, HeavyArmor, BluntWeapon, LongBlade, Axe, Spear, Athletics, Enchant, Destruction, Alteration, Illusion, Conjuration, Mysticism, Restoration, Alchemy, Unarmored, Security, Sneak, Acrobatics, LightArmor, ShortBlade, Marksman, Mercantile, Speechcraft, HandToHand), 38 PcGender, 39 PcExpelled, 40 PcCommonDisease, 41 PcBlightDisease, 42 PcClothingModifier, 43 PcCrimeLevel, 44 SameSex, 45 SameRace, 46 SameFaction, 47 FactionRankDifference, 48 Detected, 49 Alarmed, 50 Choice, 51-57 PcIntelligence, PcWillpower, PcAgility, PcSpeed, PcEndurance, PcPersonality, PcLuck, 58 PcCorprus, 59 Weather, 60 PcVampire, 61 Level (speaker), 62 Attacked, 63 TalkedToPc, 64 PcHealth, 65 CreatureTarget, 66 FriendHit, 67 Fight, 68 Hello, 69 Alarm, 70 Flee, 71 ShouldAttack, 72 Werewolf, 73 PcWerewolfKills.

### Condition type classes (selectwrapper.cpp 152-248)
- Integer: Journal, Item, Dead, Choice, Fight, Hello, Alarm, Flee, all Pc attributes and skills, FriendHit, PcLevel, PcGender, PcClothingModifier, PcCrimeLevel, RankRequirement, Level, PcReputation, Weather, Reputation, FactionRankDifference, PcWerewolfKills, FacReactionLowest, FacReactionHighest, CreatureTarget.
- Numeric (float-capable): Global, Local, NotLocal, PcHealth, PcMagicka, PcFatigue, PcHealthPercent, HealthPercent.
- Boolean (value compared as 0/1): SameSex, SameRace, SameFaction, PcCommonDisease, PcBlightDisease, PcCorprus, PcExpelled, PcVampire, TalkedToPc, Alarmed, Detected, Attacked, ShouldAttack, Werewolf.
- Inverted (operator and value IGNORED; pass iff the boolean is true): NotId, NotFaction, NotClass, NotRace, NotCell.
- None: always passes.

Attribute argument index (selectwrapper.cpp 66-82): STR 0, INT 1, WIL 2, AGI 3, SPD 4, END 5, PER 6, LCK 7. Skill index follows the 11-37 order above, 0..26. Dynamic stats: Health 0, Magicka 1, Fatigue 2. AI settings: Hello 0, Fight 1, Flee 2, Alarm 3.

## 4. Behaviour

### 4.1 Comparison (selectwrapper.cpp 13-39, 250-263)
`actual OP value`, where `value` is the condition's stored int or float. An int actual compared to a float value is compared numerically, with the int promoted to float. Booleans become 1 or 0 first.

### 4.2 testActor(info) (filter.cpp 83-164), in this order
1. If info.actor is set: fail unless the speaker's id equals it. If info.actor is empty and the speaker is a creature: FAIL (creatures only answer infos addressed to them by id).
2. Race: if set and the speaker is a creature, PASS THE WHOLE TEST IMMEDIATELY (return true, skipping later checks). Else fail if the speaker's race ≠ info.race.
3. Class: same pattern (creature returns true immediately; NPC must match).
4. Faction:
   - factionLess: creature returns true; NPC fails if it has any primary faction.
   - Else if info.faction set: creature returns true; NPC fails if its primary faction ≠ info.faction, or its rank in it < data.rank.
   - Else if data.rank ≠ -1: creature returns true; NPC fails if its rank in its own primary faction < data.rank. No faction means rank -1, which fails any rank ≥ 0.
5. Gender (NPC only): fail if `data.gender == (speakerIsFemale ? 0 : 1)`. So gender=Male(0) rejects female speakers, gender=Female(1) rejects males, and -1 never rejects.

### 4.3 testPlayer(info) (filter.cpp 166-207)
1. If pcFaction set: fail unless the player is a member (has a rank entry) and playerRank ≥ data.pcRank. Expelled members still count here.
2. Else if data.pcRank ≠ -1: use the SPEAKER's primary faction. Fail unless the player is a member of it with rank ≥ pcRank.
3. If cell set: fail unless the player's current cell name STARTS WITH info.cell (case-insensitive prefix).

### 4.4 testSelectStructs: every condition must pass (AND). Per condition (filter.cpp 267-298):
- Choice while not in a choice (choice == -1): FAIL.
- Weather while the player is in an interior (not exterior and not quasi-exterior): FAIL.
- Then dispatch by type class (3).

Integer functions (filter.cpp 353-573):
- Journal(var=quest id) = journal index of that quest (0 if unknown).
- Item(var=item id) = count of that item in the player's inventory.
- Dead(var=actor id) = number of deaths of that actor id.
- Choice = current choice number.
- Fight/Hello/Alarm/Flee = the speaker's modified AI setting. An argument outside 0..3 is an error.
- Pc<attr> = the player's modified attribute, truncated to int. Pc<skill> = the player's modified skill, truncated to int.
- FriendHit = min(speaker friendly-hit count, 4).
- PcLevel; PcGender = 0 if male, 1 if female; PcCrimeLevel = bounty; PcReputation = player reputation; Level = speaker level.
- PcClothingModifier = sum of item values in equipment slots 0-15 (everything except hands and ammo).
- RankRequirement (see the factions spec): primary faction F of the speaker. If none, 0. r = player's rank in F (-1 if not a member). If r ≥ 9, 0. Else `(skillsAndAttributesOk(r+1) ? 1 : 0) + (reputationOk(r+1) ? 2 : 0)`, giving 0..3.
- Reputation = speaker's reputation (0 for creatures).
- FactionRankDifference = playerRank(F) − speakerRank(F). Player rank is -1 if not a member. 0 if the speaker has no faction.
- FacReactionLowest/Highest: speaker faction F (if none, 0). Start v = 0. For each faction G the player belongs to (including expelled ones), take reaction(F→G). Lowest keeps the minimum and Highest the maximum, both STARTING FROM 0. So Lowest is never > 0 and Highest is never < 0.
- CreatureTarget: 2 if the speaker's combat target is a werewolf NPC, 1 if a creature, else 0.
- PcWerewolfKills; Weather = current weather id number.

Numeric functions (filter.cpp 300-351):
- Global(var): if the global does not exist, the condition PASSES (ignored). Else compare its value (globals are floats internally).
- Local(var): the speaker's script local. Fail if the speaker has no script or the script lacks the variable. If the speaker's locals are not initialised, compare 0. Short, long and float types are compared by value.
- NotLocal(var): the logical NOT of the Local test result. A missing script or variable makes NotLocal PASS.
- PcHealthPercent / HealthPercent = int(currentHealth/maxHealth × 100) for the player or speaker.
- PcHealth/PcMagicka/PcFatigue = the player's current value (float).

Boolean functions (filter.cpp 575-681), each compared to the value as 0/1:
- SameSex, SameRace: false for creature speakers.
- SameFaction: the player is a member of the speaker's primary faction.
- PcExpelled: false if the speaker has no faction, else the player is expelled from it.
- PcCommonDisease, PcBlightDisease, PcCorprus (magnitude ≠ 0), PcVampire (magnitude > 0).
- TalkedToPc: the value captured at dialogue start (before the greeting marks it). Alarmed, Attacked, Detected (awareness check), ShouldAttack (aggression check), Werewolf.

Inverted functions:
- NotId: speaker id ≠ var. NotFaction: speaker primary faction ≠ var.
- NotClass / NotRace: true for creatures, else class/race ≠ var.
- NotCell: the speaker's cell name does NOT start with var (case-insensitive prefix; var is used raw, not lower-cased).

Variable names for Local, NotLocal and Global are compared lower-cased (selectwrapper.cpp 265-268).

### 4.5 Disposition (filter.cpp 218-229)
Creatures always pass. Let D = the speaker's derived disposition, clamped 0..100 (factions spec section 4.6).
- Normal: pass iff D ≥ info.disposition.
- Inverted (service refusal): pass iff info.disposition == 0 OR D < info.disposition.

### 4.6 Selection (filter.cpp 736-779)
Iterate infos in priority order (the prev/next link order, see the journal spec section 3). An info that passes actor, player and conditions but fails disposition sets `infoRefusal`. The first fully passing info wins. If none wins, infoRefusal is set and fallback is allowed: run the same tests over the dialogue literally named "Info Refusal" and take its first passing info. A reply from the fallback is NOT logged to the topic journal (dialoguemanagerimp.cpp 318-324).

### 4.7 Dialogue flow rules
- Greeting (dialoguemanagerimp.cpp 142-197): no dialogue with dead actors. Choice = -1. Iterate Greeting-type dialogues sorted by id. The first dialogue with a matching info (no Info Refusal fallback) gives the greeting. Then the actor is marked "talked to player", the result script runs, and topics are learned from the text. If no greeting matches, dialogue does not start.
- Topic availability (344-414): a topic is listed iff the player knows it (known-topics set) AND this speaker has a matching info for it, evaluated with choice = -1 and the fallback allowed. The list is sorted case-insensitively. Flags: Exhausted if the matched info is already in the topic log, and the topic leads to no new topic. Specific if not exhausted and the matched info names this speaker by id.
- Learning topics (117-126): hyperlinked keywords in a reply are added to known topics ONLY if the current speaker can answer them at that moment. Script `AddTopic` adds unconditionally (if the dialogue exists).
- Choices (464-509; script Choice 137-158): a result script can push (text, number) choices, which enters choice mode. While in choice mode, clicking topics is ignored (424-434). Answering n re-runs the filter on the LAST topic with choice = n. On a hit: leave choice mode, show the reply, journal the topic (if Topic type and not a fallback), run its result script (which may push new choices). On a miss: leave choice mode silently. Choice is only supported for Topic and Greeting dialogues.
- Persuasion (533-581): see the factions spec. The reply comes from topics named "Admire Success" or "Admire Fail", "Intimidate …", "Taunt …", "Bribe …". The window title comes from GMST `s<TopicNameWithoutSpaces>`.
- Service refusal (595-623): filter the "Service Refusal" dialogue with choice = the service number, no fallback, inverted disposition. A hit refuses the service, shows GMST `sServiceRefusal` as title and runs the result script.
- Voice lines / `say` (625-664): the filter uses choice = 0 (not -1), no fallback. Skipped if the actor is already speaking, swimming (NPC) or knocked down.

## 5. Edge cases (what OpenMW does)

| Case | Behaviour |
|---|---|
| Unparseable condition | Dropped at load. The info stays selectable on its other tests. |
| Unknown global | Condition ignored (passes). |
| Unknown local / speaker has no script | Local fails, NotLocal passes. |
| Creature speaker plus race/class/faction filter | testActor returns true early (later checks such as gender are skipped). |
| Choice condition outside a choice | Fails. |
| Weather condition indoors | Fails. |
| Unknown select function at runtime | Error raised (cannot happen after the load-time filter). |
| Info Refusal topic missing | `find` errors. Implementers should treat it as "no reply". |
| Selection pre-check (couldPotentiallyMatch, 731-734) | testActor plus static NotId/NotFaction/NotClass/NotRace (Boolean-typed ones compared, Inverted ones raw) plus "Local variable exists". Used by tooling to see if a speaker can ever say an info. |

## 6. Plumbing to strip

ESM parse of SCVR strings (Frankendom can store conditions as structured JSON with the same function ids), MWWorld pointers and cell names (replace with plain speaker and player state objects), MWScript result scripts (replace with a data-driven effect list), Lua `onDialogueResponse` (event), keyword hypertext search (separate UI concern), sounds and subtitles, and the GUI.

## 7. Golden cases (hand-derived)

Speaker S: NPC, female, race "nord", class "trainer", faction "arena" at rank 3, script locals {met: short 1}, derived disposition 40. Player: male, member of "arena" rank 2, cell "Arena, Pit", Long Blade modified 37.0, journal Q index 20.

| # | Info / condition | Result |
|---|---|---|
| D1 | gender=Male(0), no other filters | fail (S is female) |
| D2 | faction "arena", rank 4 | fail (3 < 4) |
| D3 | faction empty, rank 3 | pass (uses S's own faction rank 3) |
| D4 | factionLess | fail (S has a faction) |
| D5 | pcFaction empty, pcRank 2 | pass (player rank 2 in S's faction) |
| D6 | cell "arena" | pass (case-insensitive prefix of "Arena, Pit") |
| D7 | Journal Q Ge 20 | pass. Journal Q Gt 20 fails. |
| D8 | Function 16 (PcLongBlade) Ge float 37.5 | 37 (int-truncated) vs 37.5, so fail |
| D9 | Global "nosuch" Eq 5 | pass (ignored) |
| D10 | Local "met" Eq 1 pass. Local "nope" Eq 0 fail. NotLocal "nope" Eq 0 pass. | as stated |
| D11 | NotFaction "arena" (any operator/value) | fail. NotFaction "guild" passes. |
| D12 | Choice Eq 1 with no active choice | fail |
| D13 | Two infos in order: i1 disposition 50, i2 disposition 0. Topic asked. | i1 fails disposition (40<50, refusal flag set), i2 passes, so reply i2 (no fallback, since a hit exists) |
| D14 | Only i1 (disposition 50) | No hit plus refusal flag, so the reply comes from "Info Refusal", not logged to the topic journal |
| D15 | Service refusal info with disposition 0 | Always matches (refusal shown). With disposition 30: refuses iff D<30, so 40 does not refuse. |
| D16 | FacReactionLowest, speaker faction F, player in G (F→G = +2) and H (F→H = +1) | 0 (starts at 0; no reaction below 0). FacReactionHighest gives 2. |
| D17 | RankRequirement, player rank 2 meets skills+attributes for rank 3 but not reputation | 1 |
| D18 | FriendHit with 7 hits | 4 |

### Capturing goldens later
Use OpenMW's Lua integration harness (`scripts/integration_tests.py`, `scripts/data/integration_tests/test_lua_api` running on the free example-suite template) with a custom `.omwaddon` defining the fixture NPC, faction and infos. Trigger dialogue through the Lua/UI API and log the selected info ids. Needs an OpenMW build plus Xvfb on the VPS. Not built now. No Morrowind data is required or used.
