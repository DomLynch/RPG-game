# Spec: Dialogue / info system (Gothic donor) - short, for comparison with OpenMW and inkjs

- Spec author: analyst-gothic (clean-room)
- Donor: OpenGothic @ `801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1` (MIT, `LICENSE`, "Copyright (c) 2019 Try")
- Reference: ZenKit @ `ddf27decd5eeb48ec715e6e66e5f5072c51d88ee` (MIT, `license.md`, "Copyright 2021-2024 GothicKit Contributors")
- Paths relative to `OpenGothic/common/`. No donor code reproduced.

## 1. Purpose
A conversation is a menu of "infos". Each info belongs to one NPC and carries: sort number, important flag, permanent flag, trade flag, description (menu text), a CONDITION script function and an INFORMATION script function. The engine filters infos by condition and "already told" state, sorts them, shows the menu, runs the chosen info's function (which queues spoken lines and may add sub-choices), and returns to the menu. Content and logic are entirely script functions; the engine is a small selection state machine.

## 2. Files and functions
| Concern | Location |
|---|---|
| Info record (`npc`, `nr`, `important`, `condition`, `information`, `description`, `trade`, `permanent`, choices) | `ZenKit/include/zenkit/addon/daedalus.hh:343-362` |
| Add choice inserts at FRONT | `ZenKit/src/addon/daedalus.cc:300-302` |
| Load all infos at start | `game/gamescript.cpp:442-449` |
| Build menu | `game/gamescript.cpp:871-930` (`dialogChoices`) |
| Sub-choice menu | `game/gamescript.cpp:932-954` (`updateDialog`) |
| Execute choice | `game/gamescript.cpp:956-976` (`exec`) |
| Sort | `game/gamescript.cpp:3409-3413` |
| Told-set | `game/gamescript.cpp:3415-3423`, saved at `:538-552` |
| Externals | `game/gamescript.cpp:2077-2084` (KnowsInfo), `:2527-2546` (CheckInfo), `:2876-2904` (Process/StopProcessInfos, AI_Output), `:3360-3378` (Info_AddChoice, Info_ClearChoices, InfoManager_HasFinished) |
| Menu state machine | `ui/dialogmenu.cpp:66-104` (tick), `:270-284` (onStart), `:329-339` (onDoneText), `:399-409` (onEntry) |

## 3. Data structures
- InfoRecord as above; `choices` is an ordered list of (text, function) built at runtime.
- Told-set: set of (listener instance id, info instance id). Note the key is the LISTENER (the player), not the speaker.
- Menu: `except` list of info functions already chosen this conversation; `depth` (0 top, 1 after a pick); `choice` list currently shown.

## 4. Rules
### 4.1 Building the top menu (`gamescript.cpp:871-930`)
With `self` = NPC and `other` = player bound for condition calls:
1. Candidates = infos whose `npc` is this NPC.
2. Two passes: pass A important = 1 (only when `includeImportant`), pass B important = 0. Pass A runs first; if it yields anything, return pass A ONLY.
3. Filter: skip if told and not permanent. In pass A also skip important+permanent infos already in `except` (stops an important permanent info looping in one conversation).
4. Condition: if the info has a condition function, call it; non-zero = valid. No condition function = valid.
5. Sort ascending by (`nr`, information-function id) - the id tiebreak reproduces retail ordering.
### 4.2 Conversation flow (`dialogmenu.cpp`)
1. Start: clear `except`; build menu with includeImportant = true. If the first entry has an EMPTY description it is auto-selected (NPC speaks first - "important" infos normally have no menu text).
2. Pick (`onEntry`): remember it, depth = 1, set trade flag from info, append its function to `except`, execute (4.3), then show sub-choices.
3. Sub-choices (`updateDialog`): list the info's `choices` with sort = their position; because Info_AddChoice inserts at the front, the LAST added choice is shown FIRST.
4. If no sub-choices: rebuild the top menu with includeImportant = false (so important infos are only offered at conversation start); if that is empty the conversation closes.
5. When speech finishes: if the picked info was a trade info, open trade; else if the menu is empty, close.
6. `AI_StopProcessInfos(self)` queues a close; the dialogue ends when queued lines finish.
### 4.3 Executing (`gamescript.cpp:956-976`)
- If the chosen function is the info's main function: mark (player, info) told.
- Else it is a sub-choice: remove every choice with that function from the info's list (one-shot sub-choices), told-set untouched.
- Call the function. It typically queues `AI_Output` lines, may call `Info_ClearChoices` / `Info_AddChoice`, give items, change attitudes, call `AI_StopProcessInfos`.
### 4.4 Externals
`Npc_KnowsInfo(npc, info)` - told-set lookup (npc = listener). `Npc_CheckInfo(npc, important)` - true if any info of that NPC with that important flag is untold-or-permanent AND has a condition that returns true; NOTE an info WITHOUT a condition counts as false here but true in the menu (donor asymmetry, `gamescript.cpp:2539-2545`). `AI_ProcessInfos(npc)` - queue "start dialogue with player". `Info_AddChoice(info, text, fn)`, `Info_ClearChoices(info)`. `InfoManager_HasFinished()` - no dialogue open. `AI_Output(self, target, line-id)` - queue a voiced line with increasing order id.

## 5. Permanent vs one-shot
- Non-permanent (default): disappears once its main function ran (told).
- Permanent: stays forever; condition still decides visibility.
- Important: offered/auto-played only at conversation start; important+non-permanent fires once ever; important+permanent at most once per conversation.
- Sub-choices: one-shot within the info's current choice list; scripts usually clear and rebuild them.

## 6. Edge cases
- Condition functions run every time the menu is rebuilt (side-effects in conditions repeat).
- Important info WITH a description is not auto-played; it appears as a normal top entry.
- Told-set is keyed by listener instance, so a second player-controlled character would not share it.

## 7. Comparison notes (for the OpenMW/inkjs decision)
- Gothic: flat per-NPC pool + boolean condition functions + one-level dynamic sub-choices; state lives in global script variables and the told-set. No branching graph, no text interpolation in engine.
- Mapping to inkjs: each info ~ a knot gated by a condition; told-set ~ ink visit counts (`once` vs sticky `+` choices map to non-permanent vs permanent); sub-choices ~ inner choice block. Important auto-play ~ an entry knot that diverts first.
- The Gothic model is easy to reimplement in ~200 lines of TS over our own data; recommend reimplementing the SELECTION RULES (4.1, 4.2, 5) as the evaluator in front of whatever content format the story lane picks.

## 8. Plumbing to strip
Daedalus VM calls (conditions become TS predicates or ink conditions), OU cutscene library / voice files, AI output pipe, trade UI, savegame.

## 9. Golden cases
Infos for NPC X (player P): I1 nr 1 cond true; I2 nr 1 cond true (I2 id > I1 id); I3 nr 0 permanent cond true; I4 important, empty description, nr 5, not permanent; I5 nr 2 cond false; I6 nr 3, no condition.
1. First talk: pass A = [I4] -> auto-played, told.
2. After I4, no sub-choices -> rebuild without importants -> [I3, I1, I2, I6] (I5 hidden).
3. Pick I1 -> told; next menu [I3, I2, I6].
4. Pick I3 (permanent) -> still [I3, I2, I6].
5. Second conversation: pass A empty (I4 told) -> [I3, I2, I6].
6. Npc_CheckInfo(X, 0) with only I6 untold and I3 permanent -> true via I3; if I3 removed, I6 alone -> false (no condition).
7. Inside I2: AddChoice("a", fa), AddChoice("b", fb) -> shown [b, a]; picking b removes b -> [a].
Capture later: table-driven tests on the evaluator; no game data needed.
