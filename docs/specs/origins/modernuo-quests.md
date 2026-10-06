# ModernUO behaviour spec: quest systems (classic QuestSystem and data-driven ML quests)

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **story**.

ModernUO has two quest engines:

- **A. Classic QuestSystem** (Engines/Quests/Core): one scripted quest at a time per player, objectives are hand-coded subclasses, conversations drive the story. Useful only as a reference for the restart-delay and single-active-quest rules.
- **B. ML quests** (Engines/ML Quests): data-driven quest definitions (objectives + rewards + texts), up to 10 at once, kill/collect/deliver/escort/gain-skill objectives, timed objectives, chains, restart delays. **This is the one worth reimplementing** for Frankendom.

## 1. Purpose

Let NPC quest-givers offer quests with explicit objectives, track progress from game events (kills, items, skill gains, arrivals), detect completion, take the player back to the giver to claim rewards, and control repeatability (one-time, restartable after a delay, or freely repeatable).

## 2. Files, functions, call graph

### A. Classic

| Path:line | Function | Role |
|---|---|---|
| UOContent/Engines/Quests/Core/QuestSystem.cs:44-61 | fields | name, offer text, `restartDelay` (abstract), tutorial flag, objectives, conversations |
| QuestSystem.cs:71-98 | StartTimer / Slice | 0.5 s tick: objectives with a timer event run CheckProgress |
| QuestSystem.cs:100-111 | OnKill | routes kills to objectives that want them |
| QuestSystem.cs:335-383 | Cancel / Complete / ClearQuest | clears the player's quest and records the restart time |
| QuestSystem.cs:413-432 | AddObjective / Accept | accept only if the player has no quest |
| QuestSystem.cs:441-501 | CanOfferQuest | profession gates, offer-gump busy, restart-period check (consumes the record when expired) |
| QuestRestartInfo.cs:5-34 | QuestRestartInfo | {questType, restartTime}; MaxValue delay = never again |
| QuestObjective.cs:9-137 | QuestObjective | `curProgress`, `maxProgress` (default 1), `completed = cur ≥ max`, one-shot `hasCompleted` → OnComplete |

### B. ML quests

| Path:line | Function | Role |
|---|---|---|
| UOContent/Engines/ML Quests/MLQuest.cs:12-16 | ObjectiveType | All / Any |
| MLQuest.cs:31-87 | definition fields | objectives, objectiveType, rewards, oneTimeOnly, hasRestartDelay, chain (isChainTriggered, nextQuest), texts |
| MLQuest.cs:70 | RecordCompletion | `oneTimeOnly or hasRestartDelay` |
| MLQuest.cs:116-182 | CanOffer | active, giver exists, not full, chain-aware done/restart check, each objective's own CanOffer |
| MLQuest.cs:189-207 | OnAccept | re-check CanOffer, create instance, objectives' OnQuestAccepted |
| MLQuest.cs:239 | GetRestartDelay | default `30 s × uniform{1..5}` |
| UOContent/Engines/ML Quests/MLQuestEntry.cs:9-16 | instance flags | ClaimReward, Removed, Failed |
| MLQuestEntry.cs:25-57 | instance ctor | objective instances, register, 5 s timer if any objective is timed |
| MLQuestEntry.cs:136-185 | IsCompleted / CheckComplete | All/Any evaluation; auto-advance to "claim reward" when there is no report-back text and nothing to hand in |
| MLQuestEntry.cs:187-232 | Fail / Slice | timed-objective expiry |
| MLQuestEntry.cs:278-351 | ContinueReportBack | hand-in step: consume items, set ClaimReward, record restart time |
| MLQuestEntry.cs:353-442 | ClaimRewards | all-or-nothing reward delivery, record completion, chain to next quest, remove |
| MLQuestEntry.cs:444-497 | Cancel / Remove / OnQuesterDeleted / OnPlayerDeath | |
| UOContent/Engines/ML Quests/MLQuestContext.cs:85, 115-197 | context | `isFull` (≥ 10), done-quest records, chain offers, death/deletion hooks |
| UOContent/Engines/ML Quests/MLQuestSystem.cs:17 | MaxConcurrentQuests | 10 |
| MLQuestSystem.cs:320-366 | FindQuest | what a giver shows: in-progress → delivery → chain offer → random eligible quest |
| MLQuestSystem.cs:369-410 | OnDoubleClick | giver interaction state machine |
| MLQuestSystem.cs:511-551 | HandleKill | kill routing |
| MLQuestSystem.cs:553-… | HandleDelivery | delivery routing |
| MLQuestSystem.cs:… | MarkQuestItem / CanMarkQuestItem / OnMarkQuestItem | collect objectives use player-marked "quest items" |
| MLQuestSystem.cs:… | HandleSkillGain | gain-skill objectives |
| MLQuestSystem.cs:616-620 | HandleDeath | |
| MLQuestSystem.cs:663-695 | RandomStarterQuest | uniform pick among offerable quests |
| Objectives/BaseObjective.cs:7-186 | base objective / instance | `isTimed`, `duration`, `endTime`, `expired`, lifecycle hooks |
| Objectives/KillObjective.cs:6-122 | Kill / TimedKill | desired amount, accepted types (subclasses count), optional area |
| Objectives/CollectObjective.cs:… 103-200 | Collect | count marked quest items in the backpack; consume on claim |
| Objectives/DeliverObjective.cs | Deliver | carry a given item to a target NPC type |
| Objectives/EscortObjective.cs:105, 166, 245-270 | Escort | 5 s destination check; abandon if > 30 tiles or other map; player death cancels |
| Objectives/GainSkillObjective.cs:15-145 | GainSkill | threshold in tenths (base or effective); optional 15-min skill acceleration on accept |

Call graph (ML):

```
player uses giver ──▶ OnDoubleClick ──▶ FindQuest
   ├─ instance with this giver: failed → nothing; claimReward → reward gump; completed → report-back gump; else progress text
   └─ no instance: quest.CanOffer → offer gump ──accept──▶ OnAccept ──▶ instance (timer if timed)
game events ──▶ HandleKill / MarkQuestItem / HandleSkillGain / escort timer / delivery ──▶ objective progress ──▶ CheckComplete
report back ──▶ ContinueReportBack (hand-in) ──▶ ClaimReward = true ──▶ reward gump ──▶ ClaimRewards ──▶ remove; chain next
```

## 3. Data structures

**MLQuest (definition)**: `activated`, `objectives[]`, `objectiveType` (All/Any), `rewards[]`, `oneTimeOnly`, `hasRestartDelay`, `isChainTriggered` (only offered as a follow-up), `nextQuest` (type), texts (title, description, refusal, in-progress, completion message, completion notice).

**MLQuestInstance**: quest, giver ref + giver type, player, accepted time, flags {claimReward, removed, failed}, objective instances.

**Objective instances**: base {endTime (MinValue = untimed), expired}; Kill {slain}; Escort {hasCompleted}; Deliver {hasCompleted}; Collect and GainSkill derive state from the player's inventory/skills each time.

**MLQuestContext (per player)**: active instances (≤ 10), done records `{quest, nextAvailable}` (MinValue = no restart time), chain offers set, plus misc flags.

**Classic**: player has a single `quest` slot and a `doneQuests` list of {type, restartTime}.

## 4. Rules and constants

### 4.1 ML constants

| Constant | Value | Where |
|---|---|---|
| Max concurrent quests | 10 | MLQuestSystem.cs:17 |
| Default restart delay | `30 s × k`, k uniform in {1,2,3,4,5} → 30..150 s | MLQuest.cs:239 |
| Timed-objective check | every 5 s | MLQuestEntry.cs:55 |
| Escort check | every 5 s; fail if player > 30 tiles from escort or on another map | EscortObjective.cs:105, 166 |
| Skill acceleration from training quests | 15 min | GainSkillObjective.cs:132 |

### 4.2 CanOffer (MLQuest.cs:116-182)

1. Quest not activated or giver gone → no.
2. With a context: if 10 active → no ("can't take more quests"). Then walk this quest and its `nextQuest` chain: for each quest in the chain with a done record: one-time-only → no ("already done"); else `nextAvailable > now` → no ("come back later"). Stop at the end of the chain.
3. Every objective's own CanOffer (e.g. gain-skill: player's skill already ≥ threshold → "I cannot teach you").

Note: the chain walk means a quest is blocked while **any** later quest in its chain is on cooldown or one-time-done.

### 4.3 Which quest a giver presents (MLQuestSystem.cs:320-366, 663-695)

1. An active instance of one of this giver's quests whose giver is this NPC (or, for non-escort quests, an NPC of the same type).
2. A delivery the player is carrying for this NPC type.
3. A chain follow-up in the player's chain offers.
4. A random quest: among this giver's quests that are not chain-triggered and not already in progress, pick uniformly among those passing CanOffer; if none pass, return the first candidate so its refusal message can be shown.

### 4.4 Progress

- **Kill** (HandleKill): for every active instance not yet at claim stage, the kill is offered to its objectives in order; the first non-expired kill objective that accepts the creature's type (exact type or subclass) and area takes it (`slain += 1`, may exceed desired) and the rest of that quest's objectives are skipped. **One kill can count for several different quests**, but only one objective per quest. Area mismatch on the first type match returns "not accepted" for that objective (the next kill objective is tried).
- **Collect**: the player marks items as quest items (only allowed if some active, unclaimed objective accepts that type/item). Progress = sum of amounts of marked matching items in the top level of the backpack. Completion is re-evaluated when marking.
- **Deliver**: given item handed to the target NPC type.
- **Escort**: NPC follows; arrival checked every 5 s; abandoned beyond 30 tiles / other map; player death cancels the whole quest; giver deleted before completion abandons.
- **GainSkill**: complete when the skill (base or effective, per objective) in tenths ≥ threshold; stays complete once claimed.

### 4.5 Completion and claim (MLQuestEntry.cs:136-185, 278-442)

IsCompleted: All → every objective complete; Any → at least one.

CheckComplete (called when an objective reports completion): if complete → objectives' OnQuestCompleted, completion notice; if the quest has no completion message and requires no hand-in (no collect/deliver objective) → go straight to ContinueReportBack (no reward gump yet).

ContinueReportBack (hand-in):
- All: every objective must still be complete and every OnBeforeClaimReward must pass; then all OnClaimReward (collect: consume exactly the desired amount of marked items, splitting stacks).
- Any: the **first** completed objective (in order) is claimed if its OnBeforeClaimReward passes; others are ignored.
- Then `claimReward = true`; if the quest has a restart delay → record done with `nextAvailable = now + GetRestartDelay()` (**recorded at hand-in, not at reward**); objectives' OnAfterClaimReward (collect: unmark leftovers); optionally show the reward gump.

ClaimRewards: build reward items; place each in the backpack; if **any** does not fit, delete **all** reward items (including ones already placed) and stop with "backpack full" — the quest stays at claim stage so the player can retry. Else messages; objectives' OnRewardClaimed; if the quest records completion and has no restart delay → record done with no restart time; remove from chain offers if chain-triggered; add `nextQuest` to chain offers; remove the instance.

### 4.6 Failure and cancel

- Timed objectives (MLQuestEntry.cs:192-232): every 5 s, each non-expired timed objective past its end time is marked expired (OnExpire). The quest is marked failed if (All and any expired this tick) or nothing is left unexpired. A failed quest shows nothing at the giver; the player must cancel it from the quest log.
- Cancel: remove; objectives' OnQuestCancelled (collect: unmark items not needed by other quests; gain-skill: end acceleration); optionally remove from chain offers.
- Player death: each objective's OnPlayerDeath (escort cancels the quest).

### 4.7 Classic rules (QuestSystem.cs:335-501)

- One quest at a time; Accept only when the slot is empty; a 0.5 s tick drives timer objectives.
- Clear (complete or cancel): record the restart time if (completed and delay > 0) or (cancelled and delay = "never" (MaxValue)). Restart time = now + delay, or forever for MaxValue. Note: cancelling a quest with a finite delay records nothing (can retake immediately); cancelling a never-repeat quest blocks it forever.
- CanOfferQuest: profession gates per quest; then if a record exists: `now < restartTime` → no (in restart period); else the record is **deleted** and offering is allowed.
- Objective: `completed = curProgress ≥ maxProgress`; setting progress triggers OnComplete exactly once.

## 5. Order of operations (ML, kill quest "kill 10 X, report back")

1. Talk to giver → CanOffer → offer → accept → instance (no timer).
2. Each kill → HandleKill → slain++ → at 10, CheckComplete → notice (has completion message → wait for report back).
3. Talk to giver → completed → report-back gump → ContinueReportBack → claimReward true (+ restart record if restartable) → reward gump.
4. Choose to claim → ClaimRewards → items placed (or all deleted and retry) → done record (one-time) → chain → remove.

## 6. Edge cases

- `slain` keeps counting past the target (harmless).
- Collect's consume step decrements the remaining count **after** deleting an item using that item's amount (works because amount is still readable after deletion).
- Restartable quests become offerable again 30..150 s after hand-in even if the reward was never claimed (the instance still exists though, so the giver shows the claim stage instead).
- A quest at 10 active instances can still progress; only new offers are blocked.
- Kill credit requires the player's context; kills by pets credit the master only if the caller passes the master (outside this module).

## 7. Randomness

`GetRestartDelay` (`Random(1, 5)` = 1 + Next(5)); random starter quest pick (uniform); reward content (reward-specific).

## 8. Timing

Classic tick 0.5 s; ML timed-objective tick 5 s; escort check 5 s; restart delays per quest (default 30..150 s); acceleration 15 min.

## 9. Engine plumbing to strip

All gumps (offer, progress, report-back, reward, cancel, log), quest packets (client quest arrow/log), NPC speech/turning, spawner/decoration generators for quest content, serialization and quest reference tables, quest-item hue marking, the 18k lines of quest content definitions (Heartwood etc. are UO content, not to be copied).

## 10. Golden cases (hand-derived)

| # | Input | Expected |
|---|---|---|
| Q1 | Kill 10 rats; kills 9 | not complete; message "9 … 1 remaining" analogue |
| Q2 | same, 10th kill | complete → (completion message present) wait for report back |
| Q3 | Two active quests both "kill rats"; one kill | both quests +1 |
| Q4 | One quest with two kill objectives both accepting rats (All); one kill | only the first objective +1 |
| Q5 | Any-type quest, objective 2 completes first | quest complete; hand-in claims objective 2 only |
| Q6 | restartable quest handed in at t=0, RNG k=3 | `nextAvailable = 90 s`; offer at 89 s refused, at 91 s allowed (assuming instance removed) |
| Q7 | one-time quest done | never offered again; also blocks any earlier quest whose chain leads to it |
| Q8 | 10 active quests | new offer refused ("can't take more") |
| Q9 | rewards [sword, shield], backpack fits sword only | both deleted, "backpack full", claimReward stays true |
| Q10 | timed kill (All), duration 5 min, 4/5 killed at expiry | expired at the first 5 s tick after end time → failed |
| Q11 | gain-skill threshold 500 (50.0 base), player base 50.0 | not offered ("cannot teach you") |
| Q12 | classic: quest with restart delay 1 day completed at t | blocked until t + 1 day; at t + 1 day record removed, offered |
| Q13 | classic: quest with finite delay cancelled | no record; can be offered immediately |
| Q14 | classic: never-repeat quest (MaxValue) cancelled | blocked forever |
| Q15 | collect 20 hides; marked stacks 15 + 10 in pack | complete (25 ≥ 20); hand-in consumes 15 (first stack) then 5 of the second (10 → 5); leftover 5 unmarked |

### How to capture goldens on the VPS later (do not build now)

- Entry points: `MLQuest.CanOffer`, `MLQuest.OnAccept`, `MLQuestSystem.HandleKill`, `MLQuestInstance.IsCompleted/ContinueReportBack/ClaimRewards`, `MLQuestContext.SetDoneQuest/HasDoneQuest`; classic `QuestSystem.CanOfferQuest` and `ClearQuest`.
- Harness: xUnit in `Projects/UOContent.Tests` (sequential fixture). There are already ML quest packet tests (`Tests/Engines/ML Quests/MLQuestPacketTests.cs`) showing how quests are loaded in tests. Define a tiny test `MLQuest` subclass in the test project (one kill objective, one item reward), a stub `IQuestGiver`, a `PlayerMobile` with backpack; call the functions directly, set `Core._now` for restart times, script `BuiltInRng.Generator` for `GetRestartDelay`.
- Build: .NET SDK 10.0.201; VPS only.
