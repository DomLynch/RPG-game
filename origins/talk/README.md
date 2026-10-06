# Origins O2: NPC talk

A pure TypeScript module: one NPC's lines offered as a choice list, filtered by conditions, with quest hooks. Built on the O1 contracts (`Result`/`Issue`, ids, the story `Condition` shapes and reader, `verifiedTier`). Nothing in `src/` imports it and nothing ships.

| File | Holds |
|---|---|
| `talk.ts` | `loadTalk`, `newTalkState`, `choices`, `pick` |
| `fixtures.ts` | Orla the smith at the Concord Exchange, wired to *The Concord Commission* (greeting, offer, a line per stage, the smith/broker branch, farewell) |
| `talk.test.ts` | Load refusals, filtering, priority, once-lines, quest offer eligibility, both branches, refusals, a 300-walk seeded property run |

## What it does

- **Content:** `{ kind: 'npc-talk', schemaVersion: 1, npc, lines }`. A line has `text` (what the player says), `reply`, `priority`, `once`, `when` (conditions) and `effects`. Checked whole at load.
- **Conditions (all must hold):** the contracts' kinds (`tier-at-least` on the server-verified level, `stage-reached`, `flag` on this character's talk flags, `has-item`, `standing-at-least`, `encounter-cleared` through injected predicates) plus `quest-at` (a quest's current stage, `null` = not started). `choice` is refused: the pick is the choice.
- **choices(talk, state, facts):** the lines available now, priority ascending, ties in content order; a `once` line is hidden after it is said.
- **pick(talk, state, line, facts, advance):** the reply, the effects, a new talk state and the journal the caller's `advance` returned. Effects: `quest` (give a quest by advancing it to its start stage, or advance it one step, with the transition's choice), `set-flag`, `end`. A refusal (unknown line, not available, the journal refuses the step) returns issues and changes nothing.
- **Plugging in the journal:** `facts.quest = (id) => journal.quests.get(id)` and `advance = (q, s, choice) => advance(journal, q, s, { ...ctx, choice: choice ?? undefined })`, keeping `result.journal`.

## Where the rules came from

- `docs/specs/origins/gothic-dialogue.md`: a flat per-NPC pool filtered by condition and told state, sorted ascending by number with a stable tiebreak (4.1); non-permanent infos vanish once told, keyed by the listener (5, 3). Not taken: important/auto-played infos, sub-choices, trade infos.
- `docs/specs/origins/openmw-dialogue-conditions.md`: conditions are structured data, AND-ed (4.4); result scripts become a data effect list (6). Not taken: speaker/race/class/cell filters, disposition and Info Refusal, topics and hyperlinks.

## Not done

- The talk UI in the greybox, voice, and server persistence of the talk state.
- Cross-checking quest ids and stages in talk content against the loaded quests (the registry's job once both are merged).
