# Spec: Quest journal (donor: OpenMW)

- Donor: OpenMW (GPLv3), commit `71fc0a4a2904ed9c315050194f51857ed598a8d1`
- Spec author: analyst-openmw (clean-room spec; implementers must not read donor source)
- Destination: story
- All paths below are relative to the donor repo root. Line numbers are per-file (FNR).

## 1. Purpose

A per-save record of the player's quests (each with one integer "stage index" and one "finished" flag), a chronological journal of quest entries with a game-date stamp, and a per-topic log of dialogue replies the player has heard. Quests and their entries are defined in content data; the runtime only stores which entries were reached.

## 2. Files and call graph

| Concern | Location |
|---|---|
| Journal container (quests, journal list, topics) | `apps/openmw/mwdialogue/journalimp.cpp` (addEntry 81-116, setJournalIndex 118-123, addTopic 125-132, removeLastAddedTopicResponse 134-142, getJournalIndex 144-152, write 169-214, readRecord 216-256, isThere 56-70) |
| Quest object | `apps/openmw/mwdialogue/quest.cpp` (getName 35-45, setIndex 52-57, addEntry 69-95, write 97-102) |
| Entry types and index-to-info lookup | `apps/openmw/mwdialogue/journalentry.cpp` (Entry ctor 19-43, idFromIndex 87-99, StampedJournalEntry::makeFromQuest 133-141) |
| Topic log | `apps/openmw/mwdialogue/topic.cpp` (addEntry 17-31, removeLastAddedResponse 58-68) |
| Script entry points | `apps/openmw/mwscript/dialogueextensions.cpp` (Journal 28-54, SetJournalIndex 56-69, GetJournalIndex 71-83, FillJournal 85-116, AddTopic 118-135, ClearInfoActor 307+) |
| Data records | `components/esm3/loaddial.hpp` (DIAL types 33-41), `components/esm3/loadinfo.hpp` (INFO fields 38-82), `components/esm3/loadinfo.cpp` (QSTN/QSTF/QSTR parsing 77-88), `components/esm3/infoorder.hpp` (info ordering 20-91) |
| Save records | `components/esm3/queststate.hpp` 14-22, `components/esm3/journalentry.hpp` 16-37 |
| Topic journaling from dialogue | `apps/openmw/mwdialogue/dialoguemanagerimp.cpp` executeTopic 284-332 (adds a topic entry only when the reply came from the asked topic, not from the "Info Refusal" fallback, 318-324), questionAnswered 464-509 |

Call graph (behavioural):

```
script "Journal <quest> <index>"  -> Journal.addEntry(quest, index, actor)
    -> (unknown index)  fallback: raise index only
    -> idFromIndex(quest, index) -> infoId
    -> already in journal list?  -> maybe raise index, stop
    -> Quest.addEntry(entry)     -> finished/restart flag, raise index, dedupe
         -> returned "restart"?  -> clear finished on every quest sharing the same display name
    -> append to journal list if text not empty
script "SetJournalIndex"          -> Quest.setIndex (unconditional, may lower)
script "GetJournalIndex"/dialogue condition "Journal" -> getJournalIndex (0 if unknown)
dialogue reply for a Topic         -> Journal.addTopic(topic, infoId, actor)
```

## 3. Data structures

### Content data (read-only)

- Dialogue record (DIAL): `id`, display string `name`, `type` in {Topic=0, Voice=1, Greeting=2, Persuasion=3, Journal=4}. Quests are DIAL records of type Journal.
- Info record (INFO), one per stage/response, owned by its dialogue, ordered (see section 3.3):
  - `id`, `prevId`, `nextId` (linked-list order)
  - `journalIndex` (int; for Journal-type dialogue this field is the stage index; the same storage is used as "disposition" for other types)
  - `response` text (the journal text; may contain substitution tokens such as player name)
  - `questStatus` in {None=0, Name=1, Finished=2, Restart=3}. Name marks the info whose response is the quest's display title. Finished marks a stage that completes the quest. Restart marks a stage that re-opens it.
  - Only one of the three markers is held (the last one read wins).

### Runtime

- `Quest { topicId, index:int=0, finished:bool=false, entries: Entry[] }`
- `Entry { infoId, text, actorName? }`; `JournalEntry = Entry + topicId`; `StampedJournalEntry = JournalEntry + day (days passed), month, dayOfMonth`
- `Topic { topicId, name, entries: Entry[] }`
- `Journal { quests: Map<topicId, Quest>, journal: StampedJournalEntry[] (chronological), topics: Map<topicId, Topic> }`

### Info ordering (priority)

Infos are kept in a list ordered by their prev/next links (`infoorder.hpp` 20-59): an info is inserted right after its `prevId`. If `prevId` is empty, it goes to the front. If `prevId` is not found, it goes to the end. If the same id is re-inserted (a later content file overrides it) with the same `prevId`, it replaces in place. Otherwise it is moved to the new position. Deleted infos are removed after loading (72-85). For journals this order matters only for `idFromIndex` (first match wins) and for the quest name lookup.

## 4. Behaviour and formulas (order of operations)

### 4.1 `idFromIndex(quest, index)` (journalentry.cpp 87-99)
Return the id of the FIRST info in the quest's ordered list whose `journalIndex == index`. If none, raise an "unknown index" error.

### 4.2 `addEntry(quest, index, actor)` (journalimp.cpp 81-116)
1. `infoId = idFromIndex(quest, index)` (may raise an error; see 4.6).
2. If the chronological journal already contains an entry with this (quest, infoId):
   - if `getJournalIndex(quest) < index`, set the quest index to `index` and show the "journal updated" notice;
   - return (no new entry, finished flag untouched).
3. Build a stamped entry: date stamp = current (daysPassed, month, day) globals. Text = the info response with substitution tokens resolved at this moment (journalentry.cpp 19-43). The text is stored as final plain text and is never re-resolved later.
4. `quest = getOrStartQuest(id)` (creates `{index 0, finished false}` if absent).
5. `restart = quest.addEntry(entry)` (4.3).
6. If `restart`: for EVERY quest in the map that is finished AND whose display name equals this quest's display name (case-insensitive), set `finished=false`. This includes the quest itself only if it is finished, which it cannot be at this point.
7. If entry text is non-empty, append it to the chronological journal and show the "journal updated" notice (GMST `sJournalEntry`). Empty-text entries still count for the quest (step 5) but are not listed.

### 4.3 `Quest.addEntry(entry)` (quest.cpp 69-95)
1. Find the info for `entry.infoId` in this quest. If missing, or its `journalIndex == -1`, raise an error.
2. If the info's status is Finished: `finished = true`. If Restart: `finished = false`. None or Name: no change.
3. If `info.journalIndex > index`: `index = info.journalIndex` (index only ever RISES through entries).
4. If the quest's own entry list already has this infoId, return `status == Restart`, without adding.
5. Otherwise append the entry to the quest's entries and return `status == Restart`.

### 4.4 `setJournalIndex(quest, index)` (journalimp.cpp 118-123; quest.cpp 52-57)
Creates the quest if needed and sets `index` unconditionally. It CAN lower the index. It does not add entries and does not touch `finished`.

### 4.5 `getJournalIndex(quest)` (journalimp.cpp 144-152)
Returns the quest's index, or 0 if the quest has never been started.

### 4.6 Script command "Journal" (dialogueextensions.cpp 28-54)
Calls addEntry. If addEntry raises any error (for example an index with no info), the error is swallowed. Instead, if `getJournalIndex < index`, the index is raised to `index` with no entry. A non-existent index is legal and silent.

### 4.7 Quest display name (quest.cpp 35-45)
The `response` of the first info whose status is Name. Otherwise an empty string. Two different quest ids can share a name. This is what the restart rule keys on.

### 4.8 Topic log (journalimp.cpp 125-142; topic.cpp 17-68)
- `addTopic(topicId, infoId, actor)`: build an Entry with resolved text and `actorName = speaker's display name`. Append to that topic unless an entry with the same infoId already exists (dedupe by infoId; the first speaker's name is kept).
- Only replies from a Topic-type dialogue, coming from that topic itself, are logged. Greetings, persuasion results and "Info Refusal" fallbacks are not.
- `removeLastAddedTopicResponse(topicId, actorName)`: remove the most recent entry in that topic whose actorName matches. If the topic becomes empty, delete the topic. This is driven by the script command ClearInfoActor (used so a reply is "not remembered").

### 4.9 FillJournal (debug, dialogueextensions.cpp 85-116)
For every Journal dialogue, call addEntry for every info except Name ones, in order. For every Topic dialogue, add every info to the topic log and mark the topic known. Debug only.

## 5. Save format concepts (strip the serialiser, keep the shape)

- Per quest: `QuestState { topic, state:int (=index), finished:byte }` (queststate.hpp 14-22).
- Every entry: `JournalEntry { type: Journal=0 | Topic=1 | Quest=2, topic, info, text, actorName, day, month, dayOfMonth }` (journalentry.hpp 16-37). Quest-owned entries are written with type Quest after their QuestState. Chronological entries use type Journal. Topic entries use type Topic (journalimp.cpp 169-214).
- Load (journalimp.cpp 216-256): an entry is accepted only if its topic still exists and (when infoId is non-empty) the info still exists. Otherwise it is silently dropped. Quest records are accepted if the topic exists. The saved index is re-applied after insert. Loaded entries are appended without dedupe.
- Known dialogue topics and faction-reaction overrides are saved separately by the dialogue manager (`dialoguemanagerimp.cpp` 671-700). Unknown topics are dropped on load.

## 6. Edge cases

| Case | OpenMW behaviour |
|---|---|
| Journal with an index that has no info | Silent. Index raised if higher (4.6). |
| Re-adding an already-heard stage with a higher index than current (after a SetJournalIndex lowered it) | Index raised and notice shown. No duplicate entry. Finished flag not re-evaluated. |
| Re-adding an already-heard stage with a lower index | No-op. |
| Two infos with the same journalIndex | The first in list order is always used. The second can never be reached by index. |
| Entry with a lower index than current | Entry added and listed. Index unchanged. Finished flag still applied if the info is Finished or Restart. |
| Finished then later stage (not Restart) | Stays finished. |
| Restart info | Clears finished on all finished quests sharing the display name (multi-id quests). |
| GetJournalIndex on an unknown quest | 0. |
| Quest object exists only through SetJournalIndex | Has an index, no entries, not finished. |
| Info's journalIndex == -1 | Error (caught by the Journal command and turned into an index-only update). |

## 7. Plumbing to strip

ESM binary readers and writers, RefId types, window-manager notices (keep an event hook instead), Lua `questUpdated` callback (keep as an event), MWScript interpreter (`fixDefinesDialog` becomes a token-substitution function that the implementer defines), global date variables (pass in a date provider), and save-game record framing.

## 8. Golden cases (hand-derived)

Fixture quest `Q` (display name "The Duel"), infos in order: `n` (status Name, idx 0, text "The Duel"), `a` idx 10 "Met the trainer", `b` idx 20 "Won the bout", `e` idx 15 "" (empty text), `f` idx 100 Finished "Champion", `r` idx 5 Restart "A new challenger". Second quest `Q2`, same display name "The Duel", infos: Name, `x` idx 100 Finished.

| # | Sequence | Expected state after |
|---|---|---|
| J1 | GetJournalIndex(Q) | 0. Quest Q not present. |
| J2 | Journal(Q,10) | Q.index=10, finished=false, Q.entries=[a]. Journal list=[a]. 1 notice. |
| J3 | J2 then Journal(Q,20) | index 20. Entries [a,b]. Journal list [a,b]. |
| J4 | J3 then Journal(Q,10) | Unchanged (already heard, 20 ≥ 10). No notice. |
| J5 | J3 then Journal(Q,15) | Index stays 20. Q.entries=[a,b,e]. Journal list unchanged (empty text). No notice. |
| J6 | J3 then Journal(Q,77) (no info) | Silent. Index stays 20. |
| J7 | J2 then Journal(Q,77) | Index becomes 77, no entries added. |
| J8 | J3 then Journal(Q,100) | index 100, finished=true. Journal list [a,b,f]. |
| J9 | J8 then SetJournalIndex(Q,5) | index 5, finished still true. |
| J10 | J9 then Journal(Q,20) | b already heard and 5 < 20, so index 20 and a notice. No entry. Finished still true. |
| J11 | Journal(Q2,100) then J8 then Journal(Q,5) | Q: entry r added, finished=false (Restart), index stays 100. Restart propagates, so Q2.finished=false too. |
| J12 | Topic: addTopic(T, i1, speaker "Ana"), addTopic(T, i1, speaker "Bo") | T.entries=[{i1, actor "Ana"}] (deduped). |
| J13 | J12 then ClearInfoActor for "Ana" | Topic T removed entirely. |
| J14 | Save after J3, delete info `b` from content, load | Q index 20 restored. Journal list [a] (b dropped). |

### Capturing goldens from the donor later (not now)
OpenMW ships a Lua integration harness: `scripts/integration_tests.py` with `scripts/data/integration_tests/test_lua_api` (runs on the free `example-suite` game template, see `CI/run_integration_tests.sh`) and `scripts/data/morrowind_tests/global_dialogues.lua` (needs Morrowind data, which we do NOT have). Plan: author a small `.omwaddon` in OpenMW-CS with the fixture quests above, write a global Lua test that drives the player's quest API and mwscript `Journal`/`SetJournalIndex`, then dump index, finished and entries to the log. It needs an OpenMW build and Xvfb on the VPS. Not built now.
