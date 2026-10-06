# Origins O2: quest journal

A pure TypeScript module: one character's state of every quest, advanced along the content's own transitions. Built on the O1 story contracts (`QuestDefinition`, `QuestState`, `grantStageRewards`, `migrateQuestState`, `gateAccess`); it defines no quest or id types of its own. Nothing in `src/` imports it and nothing ships.

| File | Holds |
|---|---|
| `journal.ts` | `newJournal`, `advance`, `progressOf`, `entries`, `loadJournal` |
| `fixtures.ts` | Example content: *The Concord Commission* (talk to Orla → fetch the ore → smith or broker → return, or be exposed) and its follow-up *The Smith's Favour* |
| `journal.test.ts` | Transitions, branching, final states, conditions, once-only payouts, append-only entries, the parse/migrate round trip, a 500-run seeded property test |

## What it does

- **Journal:** a map from quest id to the contracts' `QuestState`. A quest is not started (absent), active at one stage, finished or failed.
- **advance(journal, quest, toStage, context):** a quest starts only at its start stage, behind its gate (server-verified career level). After that it moves only along a transition from the current stage whose conditions all hold; when a stage has several ways out the caller names the next stage. Finished and failed are final. Asking for the stage the quest is already at is a replay: ok, nothing new. A refusal returns issues and no journal.
- **Conditions:** evaluated by the contracts' one `holdsCondition` (every kind, including `quest-at`). The career level is the gate and `tier-at-least` (server standing only); items, faction standing and cleared encounters come through injected predicates, so this module never reads an inventory; other quests' stages are read from the journal; `flag` reads this quest's `QuestState.flags`.
- **Payouts:** reaching a stage the first time returns its contract rewards (`grantStageRewards`, once ever) and a progression event `{ kind: 'story', type, id: '<quest>:<stage>' }`: `story-step` for a progress stage, `story-chapter` for a finish, none for a failure. The `id` is the dedupe key for `origins/progression` `award()`; the server adds the time.
- **Persistence shape:** `loadJournal` reads stored rows through `parseQuestState`, `migrateQuestState` and `checkQuestState`.

## Where the rules came from

- `docs/specs/origins/openmw-quest-journal.md`: entries are stored as final text and only appended (4.2 step 3); a stage already in the journal adds no second entry (4.2 step 2); a stage with empty text counts but is not listed (4.2 step 7). Not taken: lowering the index (`SetJournalIndex`), restart by display name, silent unknown indices (here they are refusals).
- `docs/specs/origins/modernuo-quests.md`: a quest is offered only when its requirements hold (4.2); rewards are delivered once and the quest then stays done (4.5). Not taken: objectives, timers, restart delays, chains, the 10-quest cap.
- Branching and the graph checks are the O1 contracts' own (no donor equivalent).

## Not done

- The dialogue UI and NPC talk that pick the choice (the next module).
- Setting quest flags: nothing in `journal.ts` writes `QuestState.flags`, so a quest's `flag` condition holds only for flags already in a stored row. NPC talk's `set-flag` effect writes the talk state's flags, not these; the server write that copies one into the other is not built.
- Server persistence: the rows, the transaction that commits state and payout together, and the time stamp source.
- A chapter marker on content: `story-chapter` is paid at a quest's finish stage because `QuestDefinition` has no chapter field.
