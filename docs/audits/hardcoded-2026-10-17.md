# What is still hard-coded: an audit of src/ and origins/ (2026-10-17)

Dom's ask, via Lead: "everything should be on the data layer". This audit lists what still lives in code that `npm run check:as-data` does not see, and sorts every hit into **must move to a row** or **allowed in code** (with the reason).

Tree: trunk `68f86854e` (HV2, live). Auditor lane. The scripts and the full site list are linked under **How it was measured**.

## The answer in five lines

1. **Named constants are mostly honest.** 77 top-level `UPPER_CASE = <number>` constants. 66 are on the as-data allow-list with a reason (wire widths, version stamps, DB check bounds). **11 are not**, and they escape for the same reason: the value is an *expression* (`20 * 60`, `5 * 60_000`, `72 * HOUR_S`), and the tunable rule only matches a bare number.
2. **The real backlog is inline numbers in game logic.** The checker sees only top-level constants and bare `Math.max/min` arguments. Every other number shape in game code goes unseen: compares, multipliers, object-literal tables, call arguments, defaults. **351 gameplay tunables** (86 of them in the sim files) and **162 ambiguous small integers** in game logic.
3. **Content tables written as TypeScript.** Creature rows, NPC hours, guard-zone bands, crowd roles, difficulty bands and AI behaviour kits sit in `.ts` object literals. The checker's rows rule only knows six `kind:` values, so these pass.
4. **131 code branches on content ids** that are not one of the five categories rule (a) knows: class-special ids, fx templates, legend ids, part names, a zone id. 145 more branch on the sim's own verbs (move, phase, mode), which is allowed. **39 content lists and 5 labels** are kept in code, among them a religious-figures policy list in `src/core/contracts/world.ts:137`.
5. **Presentation is the bulk:** 6,149 look-and-feel numbers in 142 view files (arena dressing, fx, sound, camera). Under the rule they belong in rows too, but they carry no game risk. Move them file by file after the gameplay list.

## Classes

| Class | Sites | Rule |
|---|---|---|
| **TUNABLE-GAMEPLAY** (Game) | 351 | Must move. A number that changes how the game plays: a distance, timing, chance, cap, cost, speed or curve in sim, server, presence, world, economy or src/core logic. |
| **CONTENT-BRANCH** (Branch) | 131 | Must move. `=== '<id>'` / `case '<id>'` on an id a data row declares (and not an engine verb): content's behaviour chosen in code. |
| **CONTENT-LIST** (List) / **LABEL** | 39 / 5 | Must move. Content ids or player-facing text listed in a code array. |
| **AMBIGUOUS** (Ambig) | 162 | Needs a human look. 3, 4, 5, 6, 10, 100, 0.25 or 0.75 in game logic: either a count or unit (allowed) or a tuning (must move). |
| **TUNABLE-PRESENTATION** (Look) | 6,149 | Must move under the rule, lowest priority: colours, offsets, fx counts, sound levels and camera numbers in view files. |
| MATH | 3,317 | Allowed. 2, 0.5, 1000 (ms), 60, 3600, 86400, 360/180, PI-like values, epsilons, hash salts (43758.5453 …). |
| FORMAT | 1,039 | Allowed. Record, wire, hash or byte-layout files; bit and byte arithmetic; string-formatting arguments (`toFixed(2)`, `padStart(2, …)`). |
| PROTOCOL | 160 | Allowed. HTTP statuses, WebSocket close codes, request and row shape bounds (`length > 80`, `max: 600`). |
| STATE / VERB / ROW-READ / LANGUAGE / Key | 1,795 / 145 / 24 / 468 / 190 | Allowed. A state, phase or event literal; the sim's own verbs (duel.ts `Phase`/`Action`, moves.ts `MoveId`, match.ts `Mode`); `r.id === '<row>'` reads; `typeof` checks; field-name lists. |
| HARNESS | 114 | Allowed. Test, dev or probe harness files. |

Classification is by file role first and literal second. Sim files are the record-version-guard and world-sim-guard lists. Gameplay paths are origins/server, presence, region1, zones, world, mobs, encounters, feuds, crowd, patrons, shops and talk, plus src/core logic and src/net. Every other drawn or played file counts as presentation. The heuristic is deliberately conservative toward "allowed" for 2/0.5/1000; the AMBIGUOUS class is where it is unsure. A by-hand sample of 12 per class read right except where noted in **Known misreads**.

## Top 20 gameplay tunables, ranked by game-logic risk

Owner is the lane that holds the file today. **Sim = a src/fight sim file:** moving its numbers changes the sim digest, so it needs a RECORD_VERSION bump (or WORLD_SIM_VERSION for world files) **even with identical values**. Batch them.

| # | Where | What is hard-coded | Owner |
|---|---|---|---|
| 1 | `src/fight/ai.ts:250-259` | The AI's mode distances: retreat under 1.2/1.7 m, approach over 1.4/1.9/2.5 m, "shaky" at 0.7 × posture max, guard share 0.33. **Sim.** | Combat |
| 2 | `src/fight/ai.ts:134-135, 330-335` | AI timing: retreat 48 ticks, wait `(45 + roll·60) × (1.6 − aggression)`, bait chance 0.6, guard hold 36 + roll·45. **Sim.** | Combat |
| 3 | `src/fight/ai.ts:159-428` (≈15 sites) | Reach margins the AI adds to every move's reach: +0.1/0.2/0.3/0.4 m, kick weight 1.1, loiter 0.75. **Sim.** | Combat |
| 4 | `src/fight/blade.ts:56-58` | **Hit regions:** head 1.45 m, torso 0.85–1.3 m, legs 0.55–0.7 m, body radius 0.31 (× scale). These decide where a blade lands. **Sim.** | Combat |
| 5 | `src/fight/blade.ts:6-7, 52` | Swing contact timing: contact 0.35/0.34, the path keys 0.7/0.44/0.16/0.56, sample step 0.02 m. **Sim.** | Combat |
| 6 | `src/fight/sim.ts:5, 25-32` | Contact stop distance **0.85 m** (four sites) and the dummy TARGET z −2.5. **Sim. Already in Combat's queued movement rows (`stopAtReach` 0.85): mark it as Combat's sim batch, not a new task.** | Combat (sim batch) |
| 7 | `src/fight/moves.ts:192-197, 241-244` | Difficulty derivations: novice +30 reaction, NOVICE_BODY health 0.7, hard +0.03 accuracy (cap 0.98), parry +0.1 (cap 0.9), read +0.03; SCUTUM guard profile. **Sim.** | Combat |
| 8 | `src/fight/gear-caps.ts:16` | `CAPS = { attack: 1.15, res: 0.80 }`, the gear stat ceilings. **World sim.** It escapes the consts rule because no number has two digits before the point (see gap 3). | Combat |
| 9 | `src/fight/spell-cast.ts:69, 77` | Cast relativity clamp ±500 tenths. **Sim.** | Combat |
| 10 | `origins/feuds/feuds.ts:376-378` | Guard-zone bands as a TS table: from 30/15/0 m, guard level floors 30/40, over 10/20, damage 1500/4000 ‰. | World / Backend |
| 11 | `src/core/world/row.ts:54-61` | Wildlife rules: RARITY_WEIGHT (uncommon 0.3), RARE_CHANCE 0.01–0.25, RESPAWN_RANGE 30–300 s, aggro 2–20 / leash 5–80 / roam 0–30 m ranges. | World |
| 12 | `src/core/world/kits.ts:17-19` | Creature behaviour kits (shy, bold, ambusher modifiers ±0.1–0.4). | World |
| 13 | `src/core/world-sim.ts:67, 77` | Creature give-up breath 1.2 s; turn threshold 0.6 rad. | World |
| 14 | `src/core/world/info.ts:12-24` | Difficulty bands 200/500/900/1100/1250 ‰ with their labels and colours; COMMON_STEPS 0.3/0.12 with labels. A content table in TS. | World / Web |
| 15 | `src/core/contracts/economy.ts:49-50` | FIRST_TRADE_DELAY 72 h; trade cooldown steps 7/14/30 days. These escape as expressions (gap 1). | Backend |
| 16 | `origins/presence/saves.ts:10` + `origins/presence/main.ts:34-35` | Position save cadence 5 min (the comment says "tunable to 10 min"); the PRESENCE_SAVE_MS default 300 000. | Backend |
| 17 | `origins/server/encounter-verify.ts:25` | MAX_FIGHT_TICKS: 15 minutes, beyond which a fight is refused. | Backend |
| 18 | `origins/patrons/patrons.ts:332-348` | Patron conditions: "first 20 s", the half-health line at 500 ‰ (×4), moon phases 0–3 / 4–7. | Combat |
| 19 | `origins/npcs/row.ts:16` + `origins/region1/npcs.ts:14` | SHOP_HOURS [6, 22] (a Dom ruling kept in code) and the fence's hours [20, 4] in a TS row. | World |
| 20 | `origins/crowd/crowd.ts:32-35` + `src/core/world/wildlife-rows.ts` | Crowd roles (radius and pace per role) and creature rows (level, role, loot) as TS literals. | World |

Next after these: `origins/world/generate.ts:75` (road link chance 0.3), `origins/world/town.ts:58` (plaza 9 + 6k), `src/core/live-ops.ts:10` (MAX_EVENT_MINUTES 7 days), `src/core/career-model.ts:97` (1000 + 200·(n − 1)), `src/zone1-hop.ts:18` (NEXT_TTL 10 min), and the 131 content branches. Of those, the class-special ids `drag`/`tempo`/`ratrun`/`wake` and the fx template ids `crack`/`gale`/`longShadow`/`baying` are the biggest groups. The full list is in the CSV.

## What check:as-data misses, and the categories to add

| Gap | Example that passes today | Proposed rule |
|---|---|---|
| 1. A const whose value is an **expression** | `SAVE_EVERY_MS = 5 * 60_000`, `FIRST_TRADE_DELAY_S = 72 * HOUR_S`, `MAX_EVENT_MINUTES = 7 * 24 * 60` | Widen tunable.yml: a value that is a binary_expression with a number leaf. 11 sites today: list them as debt or move them. |
| 2. Inline numbers in **game-logic files** beyond Math.max/min | ai.ts gap thresholds, blade.ts regions, sim.ts 0.85 | New rule (f) `inline-number`: any non-0/1 number in a binary compare, multiply/add, call argument, default or object pair, **scoped to the sim + server + presence + world file list**, with a per-file ratchet like clamp-baseline. Start it at today's count (351 + 162) so it only goes down. |
| 3. An object const holding **single-digit decimals** | `CAPS = { attack: 1.15, res: 0.80 }` | consts.yml's object regex only fires on 2+ digit numbers; make it any number other than 0/1. |
| 4. **Content tables in .ts** | wildlife-rows.ts, region1/npcs.ts, feuds bands, crowd roles, info.ts bands | rows.yml only knows six `kind:` values. Add a rule for an array of 3+ object literals that carry an `id` field, outside `*-rows.ts` loaders, as a ratchet. |
| 5. **Branches on non-category ids** | `template === 'gale'`, `=== 'loki'`, `slot === 'Shield'` | Feed rule (a) every id a data row declares (the audit's id set: 2,242 ids), minus the engine vocabularies (duel.ts Phase/Action, moves.ts MoveId, match.ts Mode). Verb dispatch stays on the allow-list as today. |
| 6. **Policy lists** | the religious-figures list (`contracts/world.ts:137`) | Caught by gap 4/5's list rule; move it to a legends-rule row so the content rule and the data agree. |
| 7. **Generated .ts data** | `src/fight/blade-paths.ts` (368 KB baked by scripts/bake-blades.mjs), patrons.data.ts, zones/registry.ts, audio manifests | Allowed (generated from a manifest; not hand-edited). Note: blade-paths would be cheaper as .json. Excluded from this scan. |

Recommendation: add **gaps 1 and 3** now (small, exact, no backlog beyond the 11 consts). Add **gap 2** as a ratchet scoped to the gameplay files, so the top 20 has a gate behind it. Gaps 4 and 5 are the bigger widening; land each with its own baseline, like map-baseline.

## Known misreads (read the CSV with these in mind)

- A few presentation files that sit under gameplay paths are counted as Game: origins/world/town.ts piece offsets, and part of the world schema and validator bounds (`origins/world/schema.ts`, `origins/zones/schema.ts` defaults and ranges). Schema *defaults* are tunables; schema *ranges* are validation and should be read as PROTOCOL.
- `src/core/grades.ts` material numbers (metalness and roughness per tier) count as Game; they are presentation.
- The 0/1 skip hides tunables that happen to be 1 (for example a 1 s timer). The 2/0.5/1000 → MATH rule hides some real tunables that happen to be 2 or 0.5. The AMBIGUOUS class covers 3–6, 10, 100, 0.25 and 0.75 only.
- Branch detection needs the id to appear as `id`/`key`/`kind`/`body`/`zone`/`slot` in some data row. An id that lives only in a TS table is invisible to it (which is gap 4).

## How it was measured

- ast-grep 0.45.3 (the checker's own pin), ten rules, one per literal shape: compare, arithmetic, object pair, default, call argument, lower-case const, function-body const, array, string compare and string array. Run over `src` and `origins`, excluding `*.test.ts`, `*.d.ts`, catalogue-data.ts, src/assets and the five generated files.
- 14,089 sites, classified by `classify.py`. Named constants come from `upper.py`, joined with `scripts/as-data/allow/*.json`.
- **The full site list for the must-move classes** (Game, Branch, List, Label, Ambig; 688 rows with file, line, literal, shape, reason and code) is [`hardcoded-2026-10-17-sites.csv`](hardcoded-2026-10-17-sites.csv). The 6,149 presentation sites are counted per file below, not listed.
- The scripts are in `docs/audits/hardcoded-2026-10-17/` (rules.yml, classify.py, upper.py, tables.py), so the audit can be re-run after each batch: `npx -p @ast-grep/cli@0.45.3 ast-grep scan -r rules.yml --json=stream src origins | python3 slim.py > hits.jsonl`, then `classify.py`.

## Named constants (77)

The 66 allow-listed constants are version stamps (36), wire and storage widths (14), the presence frame (4) and singletons (detmath, DAY_S, side indexes, UNIT, BOARD_SEED, WebSocket.OPEN). Each reason reads honestly. The 11 that are not allow-listed:

| File | Const | Value | Class |
|---|---|---|---|
| origins/patrons/patrons.ts:332 | FIGHT_HALF_TICKS | 20 * 60 | **Game**: "a fight's first 20 s" |
| origins/presence/saves.ts:10 | SAVE_EVERY_MS | 5 * 60_000 | **Game**: save cadence |
| origins/server/server.ts:13 | MAX_BODY | 64 * 1024 | Protocol (body-size bound): allow-list it |
| src/assets/arena/textures.ts:280 | PATCH_SPAN | 26 | Look: src/assets is outside the checker's roots |
| src/core/contracts/economy.ts:49 | FIRST_TRADE_DELAY_S | 72 * HOUR_S | **Game**: trade lock |
| src/core/live-ops.ts:10 | MAX_EVENT_MINUTES | 7 * 24 * 60 | **Game**: event length cap |
| src/fight/sim.ts:2 / world.ts:24 / lorarii.ts:25 | STEP / TICK | 1 / 60 | Format: the fixed 60 Hz step, record-bound. Allow-list as one entry |
| src/pvp-hold.ts:7 | TICK_MS | 1000 / 60 | Format (same step) |
| src/zone1-hop.ts:18 | NEXT_TTL_MS | 10 * 60_000 | **Game**: sign-in hop expiry |

Lead's count of 86 came from a looser grep (it also counts typed and multi-line declarations); the 77 here are single-line `const NAME = <number or expression>`.

## Counts by area and by file

Columns: Game, Branch, List, Label, Ambig, Look = must move; Math, Fmt, Proto, State, Verb, Lang, Key, RowRd, Harn = allowed.

#### By area (every site)

| Where | Game | Branch | List | Label | Ambig | Look | Math | Fmt | Proto | State | Verb | Lang | Key | RowRd | Harn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/fight/` | 86 | 73 | 29 |  | 28 | 4058 | 2152 | 552 | 10 | 792 | 130 | 88 | 95 | 10 |  |
| `origins/preview/` |  | 12 |  |  |  | 1113 | 481 | 63 | 4 | 171 | 5 | 81 | 9 | 5 | 20 |
| `src/arena.ts` |  | 1 |  |  |  | 694 | 267 | 11 |  | 15 |  | 5 |  |  |  |
| `src/core/` | 115 | 18 | 4 | 5 | 13 | 12 | 72 | 51 | 38 | 205 |  | 107 | 30 | 2 | 37 |
| `origins/world/` | 57 | 1 |  |  | 42 | 1 | 86 | 25 |  | 21 |  | 6 |  | 4 |  |
| `origins/zones/` | 22 |  |  |  | 9 | 8 | 9 | 3 |  | 11 |  | 18 |  |  |  |
| `origins/server/` | 20 | 3 |  |  | 11 |  | 38 | 23 | 52 | 152 |  | 68 | 8 |  | 29 |
| `origins/presence/` | 16 | 1 |  |  | 15 |  | 31 | 30 | 43 | 31 |  | 6 |  |  | 8 |
| `src/audio/` |  |  |  |  |  | 93 | 29 | 2 |  | 26 |  | 4 |  |  |  |
| `src/arena-props.ts` |  |  |  |  |  | 44 | 11 |  |  | 1 |  | 1 |  | 3 |  |
| `origins/encounters/` | 3 | 3 | 2 |  | 7 |  |  |  |  | 18 |  | 5 | 1 |  |  |
| `origins/feuds/` | 8 | 1 |  |  | 2 |  | 4 | 4 |  | 21 |  |  |  |  |  |
| `origins/region1/` | 3 | 4 | 2 |  | 2 |  |  | 18 | 4 | 15 |  | 2 | 23 |  |  |
| `origins/shops/` | 4 |  |  |  | 9 |  | 12 | 1 |  | 1 |  |  |  |  |  |
| `origins/gear/` |  | 1 |  |  | 14 |  |  |  |  |  |  |  |  |  |  |
| `src/main.ts` |  | 3 |  |  |  | 22 | 21 | 12 |  | 79 |  | 30 |  |  |  |
| `origins/patrons/` | 6 |  |  |  | 3 |  | 4 | 2 | 2 | 54 |  | 1 |  |  |  |
| `src/souls-look.ts` |  | 1 |  |  |  | 24 | 18 | 7 |  |  |  |  |  |  |  |
| `origins/crowd/` | 5 |  |  |  | 1 |  | 2 | 5 |  | 12 |  |  |  |  |  |
| `src/coach.ts` |  |  | 2 |  |  | 12 | 5 | 11 |  | 3 |  |  | 3 |  |  |
| `origins/mobs/` | 3 |  |  |  | 2 |  | 6 |  |  | 3 |  |  |  |  |  |
| `src/lorarii.ts` |  |  |  |  |  | 15 | 16 | 5 |  | 25 |  | 1 |  |  |  |
| `src/net/` |  | 5 |  |  |  |  |  | 75 |  | 61 |  | 17 |  |  |  |
| `src/pit/` |  |  |  |  |  | 12 | 8 | 1 |  | 5 |  | 13 |  |  |  |
| `origins/board/` | 1 | 1 |  |  |  | 4 | 2 | 7 |  | 2 |  |  |  |  |  |
| `src/perf-beacon.ts` |  |  |  |  |  | 11 | 18 | 3 |  |  |  |  |  |  |  |
| `origins/boss/` |  | 2 |  |  | 2 |  | 1 | 103 | 1 | 10 |  | 2 |  |  | 8 |
| `origins/npcs/` | 2 |  |  |  | 1 |  | 1 |  |  | 2 |  |  |  |  |  |
| `src/colour-grade.ts` |  |  |  |  |  | 10 |  |  |  |  |  |  |  |  |  |
| `src/first-loss.ts` |  |  |  |  |  | 8 | 3 |  |  | 7 |  |  |  |  |  |
| `src/zone1-hop.ts` |  | 1 |  |  |  | 1 | 1 |  |  | 3 |  |  |  |  |  |
| `src/legends.ts` |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |  |
| `src/retry.ts` |  |  |  |  |  | 2 |  |  |  |  |  |  |  |  |  |
| `src/chunk-recover.ts` |  |  |  |  |  | 1 | 2 |  |  |  |  | 3 |  |  |  |
| `src/clip.ts` |  |  |  |  |  | 1 | 5 |  |  | 1 |  | 2 | 5 |  |  |
| `src/gate-rise.ts` |  |  |  |  |  | 1 | 3 |  |  |  |  |  |  |  |  |
| `src/pvp-hold.ts` |  |  |  |  |  | 1 | 3 |  |  |  |  |  |  |  |  |
| `src/zoom-guard.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| `origins/pit/` |  |  |  |  |  |  |  | 3 |  | 1 |  |  |  |  |  |
| `origins/quests/` |  |  |  |  |  |  |  |  |  | 4 |  |  |  |  | 2 |
| `origins/talk/` |  |  |  |  |  |  |  | 1 | 5 | 7 |  |  |  |  | 10 |
| `src/arena-themes.ts` |  |  |  |  |  |  |  | 4 |  |  |  |  | 11 |  |  |
| `src/autopsy.ts` |  |  |  |  |  |  | 2 |  |  | 1 | 1 |  |  |  |  |
| `src/events.ts` |  |  |  |  |  |  |  |  |  | 7 |  |  |  |  |  |
| `src/fight-results.ts` |  |  |  |  |  |  | 1 | 1 |  |  |  |  |  |  |  |
| `src/hit-stop.ts` |  |  |  |  |  |  |  |  |  | 2 |  |  |  |  |  |
| `src/ladder.ts` |  |  |  |  |  |  |  | 2 |  |  |  |  |  |  |  |
| `src/lessons.ts` |  |  |  |  |  |  |  |  |  | 3 |  |  |  |  |  |
| `src/look-flag.ts` |  |  |  |  |  |  |  |  |  | 1 |  |  |  |  |  |
| `src/record-header.ts` |  |  |  |  |  |  |  | 9 |  |  |  |  | 4 |  |  |
| `src/roster.ts` |  |  |  |  |  |  |  |  |  |  |  | 1 |  |  |  |
| `src/scorecard.ts` |  |  |  |  |  |  |  | 2 | 1 | 2 |  | 2 |  |  |  |
| `src/share-store.ts` |  |  |  |  |  |  | 1 | 1 |  | 1 |  | 2 |  |  |  |
| `src/sparring.ts` |  |  |  |  |  |  |  | 1 |  | 4 |  |  | 1 |  |  |
| `src/timed-signal.ts` |  |  |  |  |  |  |  | 1 |  |  |  | 2 |  |  |  |
| `src/trial.ts` |  |  |  |  |  |  | 2 |  |  |  |  | 1 |  |  |  |
| `src/tutorial.ts` |  |  |  |  |  |  |  |  |  | 15 | 9 |  |  |  |  |
| **total** | **351** | **131** | **39** | **5** | **162** | **6149** | **3317** | **1039** | **160** | **1795** | **145** | **468** | **190** | **24** | **114** |

#### By file: every file with at least one site to move (Game, Branch, List, Label, Ambig or Look)

| Where | Game | Branch | List | Label | Ambig | Look | Math | Fmt | Proto | State | Verb | Lang | Key | RowRd | Harn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/arena.ts` |  | 1 |  |  |  | 694 | 267 | 11 |  | 15 |  | 5 |  |  |  |
| `src/fight/special-fx-dwarf-shield.ts` |  |  |  |  |  | 497 | 199 | 1 |  | 7 |  | 3 |  |  |  |
| `origins/preview/exchange-plan.ts` |  |  |  |  |  | 310 | 82 |  |  | 2 |  |  | 4 |  |  |
| `src/fight/special-fx-pitborn.ts` |  | 5 |  |  |  | 288 | 118 | 4 |  | 9 |  | 1 |  |  |  |
| `src/fight/special-fx-executioner.ts` |  | 9 |  |  |  | 264 | 145 | 2 |  | 7 |  | 1 |  |  |  |
| `src/fight/special-fx-boss.ts` |  | 2 |  |  |  | 281 | 137 | 7 |  | 5 |  |  |  |  |  |
| `src/fight/special-fx-class.ts` |  | 6 |  |  |  | 239 | 113 | 2 |  | 3 |  |  |  |  |  |
| `src/fight/special-fx-goblin.ts` |  | 9 |  |  |  | 194 | 96 | 1 |  | 8 |  |  |  |  |  |
| `origins/preview/frontier-dress.ts` |  |  |  |  |  | 205 | 69 | 3 |  | 3 |  |  |  |  |  |
| `src/core/grades.ts` | 49 |  |  |  |  |  |  | 1 |  | 4 |  | 1 |  |  |  |
| `origins/world/schema.ts` | 35 |  |  |  | 23 |  | 14 |  |  |  |  |  |  |  |  |
| `src/fight/special-fx-quake.ts` |  |  |  |  |  | 184 | 94 | 3 |  | 3 |  |  |  |  |  |
| `src/fight/ai.ts` | 40 |  |  |  | 10 |  | 23 | 6 |  | 79 | 24 |  |  |  |  |
| `origins/preview/frontier-plan.ts` |  | 1 |  |  |  | 149 | 55 | 2 |  | 14 |  |  | 5 |  |  |
| `origins/preview/frontier-cinder.ts` |  |  |  |  |  | 139 | 49 |  |  | 5 |  |  |  |  |  |
| `src/fight/special-fx-wind.ts` |  |  |  |  |  | 127 | 62 | 2 |  | 3 |  |  |  |  |  |
| `src/fight/special-tithe.ts` |  |  |  |  |  | 94 | 39 | 1 |  | 10 |  |  |  |  |  |
| `origins/zones/schema.ts` | 19 |  |  |  | 7 |  | 4 |  |  |  |  |  |  |  |  |
| `src/fight/sound/cues.ts` |  |  |  |  |  | 89 | 17 | 2 |  | 19 | 6 |  |  |  |  |
| `src/fight/signature-witch.ts` |  |  |  |  |  | 87 | 45 | 7 |  | 3 |  | 1 |  |  |  |
| `src/fight/charge-fx.ts` |  |  |  |  |  | 85 | 41 | 1 |  |  |  |  |  |  |  |
| `src/fight/gore.ts` |  |  |  |  |  | 83 | 51 | 7 |  | 7 |  | 2 |  |  |  |
| `src/fight/characters.ts` |  | 9 | 1 |  |  | 52 | 51 | 3 | 1 | 69 | 18 | 3 | 26 |  |  |
| `src/fight/signature-veteran.ts` |  |  |  |  |  | 79 | 32 | 2 |  | 3 | 1 |  |  |  |  |
| `origins/preview/main.ts` |  | 4 |  |  |  | 63 | 31 | 11 | 3 | 34 | 5 | 1 |  | 1 |  |
| `src/fight/scene.ts` |  | 1 |  |  |  | 72 | 32 | 6 | 1 | 20 |  | 14 |  |  |  |
| `src/fight/special-fx-legion.ts` |  |  |  |  |  | 70 | 27 | 1 |  | 5 |  |  |  |  |  |
| `src/fight/blade.ts` | 16 |  |  |  | 2 |  | 6 |  |  |  |  |  |  |  |  |
| `origins/preview/frontier-camp.ts` |  |  |  |  |  | 66 | 31 |  |  |  |  |  |  |  |  |
| `src/core/world/row.ts` | 11 |  | 4 |  | 3 |  | 1 |  |  | 4 |  | 1 | 1 |  |  |
| `src/fight/special-fx.ts` |  |  |  |  |  | 62 | 31 | 1 |  | 5 |  |  |  |  |  |
| `origins/world/town.ts` | 9 |  |  |  | 12 |  | 27 | 5 |  |  |  |  |  |  |  |
| `src/fight/finisher-blood.ts` |  | 1 |  |  |  | 56 | 10 |  |  | 7 |  | 1 | 6 |  |  |
| `src/fight/witchfire.ts` |  |  |  |  |  | 59 | 42 | 7 |  | 3 |  |  |  |  |  |
| `src/fight/signature-knight.ts` |  |  |  |  |  | 56 | 24 |  |  | 1 | 1 |  |  |  |  |
| `src/fight/sound/feedback.ts` |  | 4 |  |  |  | 43 | 10 |  |  | 28 | 2 | 5 |  |  |  |
| `src/fight/special-fx-nightborn.ts` |  |  |  |  |  | 55 | 25 | 1 |  | 5 |  |  |  |  |  |
| `src/audio/bell.ts` |  |  |  |  |  | 52 | 13 | 2 |  |  |  | 1 |  |  |  |
| `src/fight/signature-dwarf.ts` |  |  |  |  |  | 49 | 24 | 7 |  | 1 |  | 3 | 5 |  |  |
| `origins/preview/frontier.ts` |  |  |  |  |  | 48 | 45 | 1 |  |  |  |  |  |  |  |
| `src/fight/moves.ts` | 11 |  |  |  | 2 |  | 4 |  |  | 1 |  | 2 |  |  |  |
| `src/fight/signature-executioner.ts` |  |  |  |  |  | 48 | 19 |  | 1 | 1 |  |  |  |  |  |
| `src/core/contracts/world.ts` | 7 | 1 |  | 5 |  |  | 14 | 16 | 14 | 4 |  | 1 | 23 |  |  |
| `src/arena-props.ts` |  |  |  |  |  | 44 | 11 |  |  | 1 |  | 1 |  | 3 |  |
| `src/core/live-ops.ts` | 10 |  |  |  | 2 |  | 2 |  |  | 3 |  | 7 |  |  |  |
| `origins/presence/server.ts` | 6 | 1 |  |  | 8 |  | 8 | 9 | 41 | 19 |  | 2 |  |  |  |
| `src/fight/signature-plaguedoctor.ts` |  |  |  |  |  | 42 | 19 | 6 |  | 6 |  | 1 |  |  |  |
| `origins/encounters/encounters.ts` | 3 | 3 | 2 |  | 7 |  |  |  |  | 18 |  | 5 | 1 |  |  |
| `src/fight/clash-sparks.ts` |  |  |  |  |  | 41 | 51 | 3 |  | 7 |  |  |  |  |  |
| `src/fight/nightfall-fx.ts` |  |  |  |  |  | 41 | 28 | 1 |  |  |  |  |  |  |  |
| `src/fight/sound/breath.ts` |  |  |  |  |  | 40 | 6 |  |  |  |  |  |  |  |  |
| `origins/feuds/feuds.ts` | 8 | 1 |  |  | 2 |  | 4 | 4 |  | 21 |  |  |  |  |  |
| `src/core/world/kits.ts` | 9 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/fight/blood-style.ts` |  |  |  |  |  | 36 | 4 | 2 |  | 4 |  |  |  |  |  |
| `src/fight/camera.ts` |  |  |  |  |  | 35 | 28 | 1 |  |  |  | 2 |  |  |  |
| `src/fight/scorch.ts` |  | 1 |  |  |  | 32 | 15 | 7 |  | 1 |  | 1 |  |  |  |
| `src/fight/stance-pose.ts` |  |  | 3 |  |  | 26 | 3 |  |  | 1 | 1 |  | 1 |  |  |
| `src/fight/fx.ts` |  | 1 |  |  |  | 31 | 37 |  |  | 14 | 2 |  |  |  |  |
| `src/fight/foot-dust.ts` |  |  |  |  |  | 32 | 32 | 1 |  |  |  |  |  |  |  |
| `origins/gear/wear-repair.ts` |  | 1 |  |  | 14 |  |  |  |  |  |  |  |  |  |  |
| `src/fight/signature-pitborn.ts` |  |  |  |  |  | 31 | 27 |  |  | 3 |  | 1 |  |  |  |
| `src/main.ts` |  | 3 |  |  |  | 22 | 21 | 12 |  | 79 |  | 30 |  |  |  |
| `origins/patrons/patrons.ts` | 6 |  |  |  | 3 |  | 4 | 1 | 2 | 41 |  | 1 |  |  |  |
| `origins/world/relief.ts` | 6 |  |  |  | 3 |  | 12 | 8 |  |  |  |  |  |  |  |
| `src/fight/sim.ts` | 7 |  |  |  | 1 |  | 1 |  |  |  |  |  |  |  |  |
| `src/fight/sound/power-word.ts` |  |  |  |  |  | 30 | 1 |  | 1 |  |  |  |  |  |  |
| `origins/server/server.ts` | 7 |  |  |  |  |  | 2 |  | 7 | 4 |  | 1 |  |  |  |
| `src/core/world/info.ts` | 7 |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |
| `src/fight/special-class-timing.ts` |  | 7 |  |  |  | 6 | 2 |  |  |  |  |  |  |  |  |
| `src/souls-look.ts` |  | 1 |  |  |  | 24 | 18 | 7 |  |  |  |  |  |  |  |
| `src/fight/camera-kick.ts` |  | 3 |  |  |  | 17 | 5 |  |  | 1 | 1 |  |  |  |  |
| `src/fight/skill-impact.ts` |  |  |  |  |  | 25 | 45 | 3 |  | 1 |  |  |  |  |  |
| `src/fight/special-modes.ts` |  | 2 |  |  |  | 19 | 3 |  |  | 6 |  |  |  |  |  |
| `origins/region1/load.ts` | 1 | 4 | 2 |  | 1 |  |  | 15 | 4 | 14 |  | 2 | 23 |  |  |
| `src/fight/opened.ts` |  |  |  |  |  | 23 | 34 | 6 | 1 | 2 |  |  |  |  |  |
| `src/fight/special-look.ts` |  |  |  |  |  | 23 | 23 |  |  |  |  |  |  |  |  |
| `origins/crowd/crowd.ts` | 5 |  |  |  | 1 |  | 2 | 5 |  | 12 |  |  |  |  |  |
| `origins/preview/mobs-view.ts` |  |  |  |  |  | 22 | 13 | 4 |  | 6 |  | 1 |  |  |  |
| `origins/shops/vendor-economy.ts` | 2 |  |  |  | 7 |  |  |  |  |  |  |  |  |  |  |
| `origins/world/generate.ts` | 5 |  |  |  | 1 |  | 5 | 5 |  | 3 |  |  |  |  |  |
| `src/audio/arena.ts` |  |  |  |  |  | 22 | 7 |  |  | 14 |  |  |  |  |  |
| `src/fight/catalogue-defs.ts` | 4 |  |  |  | 3 |  | 2 |  |  |  |  |  |  |  |  |
| `src/fight/signature-goblin.ts` |  |  |  |  |  | 21 | 25 | 7 |  |  |  |  |  |  |  |
| `src/core/world/wildlife-rows.ts` | 4 |  |  |  | 2 |  | 1 |  |  |  |  |  |  |  |  |
| `src/fight/signature-shieldmaiden.ts` |  | 1 |  |  |  | 17 | 7 | 5 |  |  |  |  |  |  |  |
| `src/core/contracts/economy.ts` | 4 | 1 |  |  |  |  | 5 | 4 | 1 | 9 |  |  |  |  |  |
| `src/core/loot.ts` |  | 5 |  |  | 2 |  | 2 |  |  | 1 |  | 8 | 1 | 1 |  |
| `origins/preview/exchange.ts` |  |  |  |  |  | 18 | 24 |  |  | 6 |  |  |  |  |  |
| `origins/preview/look.ts` |  |  |  |  |  | 18 | 4 | 6 |  |  |  | 1 |  |  |  |
| `src/audio/exchange.ts` |  |  |  |  |  | 18 | 9 |  |  | 11 |  |  |  |  |  |
| `src/coach.ts` |  |  | 2 |  |  | 12 | 5 | 11 |  | 3 |  |  | 3 |  |  |
| `src/core/career-model.ts` | 2 | 2 |  |  | 2 |  | 13 |  |  | 10 |  | 5 |  |  |  |
| `src/fight/record.ts` |  |  | 6 |  |  |  |  | 189 |  |  |  |  | 13 |  |  |
| `src/fight/sound/creature.ts` |  | 2 |  |  |  | 12 | 4 | 6 |  | 2 |  |  |  |  |  |
| `origins/preview/camp-fire.ts` |  |  |  |  |  | 17 | 1 |  |  |  |  |  |  |  |  |
| `src/fight/defence-grade.ts` |  |  | 1 |  |  | 14 | 1 |  |  | 2 |  |  | 3 |  |  |
| `src/fight/fatigue-read.ts` |  |  |  |  |  | 17 | 5 |  |  |  |  |  |  |  |  |
| `src/fight/rank-tint.ts` |  |  |  |  |  | 17 | 11 |  |  | 6 |  | 1 |  |  |  |
| `src/fight/sound/armfeel-sound.ts` |  |  |  |  |  | 17 | 1 |  |  | 3 |  |  |  |  |  |
| `origins/mobs/populate.ts` | 3 |  |  |  | 2 |  | 6 |  |  | 3 |  |  |  |  |  |
| `origins/presence/main.ts` | 4 |  |  |  |  |  | 3 | 1 |  | 7 |  |  |  |  |  |
| `origins/presence/zones.ts` | 2 |  |  |  | 4 |  | 11 |  |  | 4 |  |  |  |  |  |
| `origins/preview/play.ts` |  | 2 |  |  |  | 10 | 2 |  |  | 28 |  | 1 |  |  |  |
| `src/fight/signature-nightborn.ts` |  |  |  |  |  | 16 | 5 | 5 |  | 1 |  |  |  |  |  |
| `src/fight/spell-cast.ts` | 4 |  |  |  |  |  |  |  | 1 | 3 |  |  |  | 2 |  |
| `src/lorarii.ts` |  |  |  |  |  | 15 | 16 | 5 |  | 25 |  | 1 |  |  |  |
| `src/net/pvp.ts` |  | 5 |  |  |  |  |  | 10 |  | 25 |  | 8 |  |  |  |
| `origins/zones/loader.ts` | 3 |  |  |  | 1 |  | 2 | 1 |  | 1 |  | 3 |  |  |  |
| `src/core/contracts/core.ts` | 3 |  |  |  | 1 |  | 1 |  | 1 |  |  | 7 |  |  |  |
| `src/fight/cc-ladder.ts` | 1 |  |  |  | 5 |  |  |  |  | 4 |  |  |  |  |  |
| `src/fight/execution.ts` |  |  |  |  |  | 14 | 1 |  |  |  |  |  |  |  |  |
| `src/fight/miasma-mark.ts` |  | 1 |  |  |  | 11 | 26 | 9 |  | 1 |  |  |  |  |  |
| `src/fight/duel.ts` |  |  | 3 |  | 2 |  |  |  |  | 87 | 24 |  | 3 |  |  |
| `origins/server/encounter.ts` | 2 |  |  |  | 2 |  | 1 | 2 | 2 | 10 |  | 5 |  |  |  |
| `origins/shops/shop.ts` | 2 |  |  |  | 2 |  | 2 |  |  | 1 |  |  |  |  |  |
| `src/core/contracts/items.ts` |  | 4 |  |  |  |  |  | 6 | 11 | 50 |  | 2 |  |  |  |
| `src/fight/level-anchor-rows.ts` |  |  | 4 |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/pit/skulls.ts` |  |  |  |  |  | 12 | 8 | 1 |  | 5 |  | 13 |  |  |  |
| `src/fight/fatigue-layer.ts` |  |  |  |  |  | 11 | 4 | 4 |  |  |  |  |  |  |  |
| `src/fight/signature.ts` |  | 2 |  |  |  | 5 | 5 | 2 |  | 7 | 1 |  | 6 |  |  |
| `src/fight/spectral.ts` |  |  |  |  |  | 11 | 1 |  |  |  |  |  |  |  |  |
| `src/perf-beacon.ts` |  |  |  |  |  | 11 | 18 | 3 |  |  |  |  |  |  |  |
| `origins/boss/boss.ts` |  | 2 |  |  | 2 |  | 1 |  | 1 | 10 |  | 2 |  |  |  |
| `origins/npcs/row.ts` | 2 |  |  |  | 1 |  | 1 |  |  | 2 |  |  |  |  |  |
| `origins/preview/bounty.ts` |  | 3 |  |  |  | 1 | 1 | 1 |  | 4 |  |  |  |  |  |
| `origins/server/world-spawns.ts` | 2 |  |  |  | 1 |  | 5 | 3 | 8 | 7 |  | 8 |  |  |  |
| `src/colour-grade.ts` |  |  |  |  |  | 10 |  |  |  |  |  |  |  |  |  |
| `src/fight/input.ts` |  |  |  |  |  | 10 | 6 |  |  | 24 | 5 |  | 8 |  |  |
| `src/fight/skull.ts` |  |  |  |  |  | 10 | 18 |  | 1 |  |  |  |  |  |  |
| `origins/preview/frontier-kit.ts` |  |  |  |  |  | 9 | 12 |  |  |  |  |  |  |  |  |
| `origins/preview/mob-dress.ts` |  |  |  |  |  | 9 |  |  |  | 4 |  |  |  |  |  |
| `src/core/contracts/registry.ts` |  | 3 |  |  |  |  |  |  |  | 11 |  |  |  |  |  |
| `src/core/gear-room.ts` |  |  |  |  |  | 9 | 14 |  |  |  |  |  |  |  |  |
| `src/fight/stance.ts` |  |  | 3 |  |  |  | 5 | 2 |  | 1 |  | 1 | 1 |  |  |
| `src/fight/world-record.ts` |  |  | 3 |  |  |  |  | 35 |  | 6 |  | 10 | 6 |  |  |
| `origins/presence/interest.ts` | 2 |  |  |  |  |  | 3 | 1 |  |  |  |  |  |  |  |
| `origins/preview/mobs.ts` |  |  |  |  |  | 8 | 7 |  |  |  |  |  |  | 2 |  |
| `origins/server/encounter-pose.ts` |  |  |  |  | 4 |  | 12 |  |  |  |  | 4 |  |  |  |
| `origins/server/location.ts` | 2 |  |  |  |  |  |  | 1 | 17 | 14 |  | 10 |  |  |  |
| `origins/server/world-verify.ts` | 1 |  |  |  | 2 |  | 1 |  |  |  |  |  |  |  |  |
| `origins/zones/biomes-data.ts` |  |  |  |  |  | 8 | 2 |  |  |  |  |  |  |  |  |
| `src/core/account-entry.ts` | 2 |  |  |  |  |  |  |  |  | 2 |  |  |  |  |  |
| `src/core/registry.ts` | 2 |  |  |  |  |  |  | 1 |  | 4 |  | 7 |  |  |  |
| `src/core/world-sim.ts` | 2 |  |  |  |  |  | 4 | 4 |  | 3 |  |  |  |  |  |
| `src/fight/boss-telegraph.ts` |  |  |  |  |  | 8 | 2 | 3 |  |  |  |  |  |  |  |
| `src/fight/dropped-weapon.ts` |  |  |  |  |  | 8 | 8 |  |  |  |  |  |  |  |  |
| `src/fight/gear-caps.ts` | 2 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/fight/severed-head.ts` |  |  |  |  |  | 8 |  |  |  |  |  |  |  |  |  |
| `src/fight/spell-school.ts` |  |  |  |  |  | 8 | 12 | 1 |  | 1 |  |  |  |  |  |
| `src/fight/wounds-fx.ts` |  |  |  |  |  | 8 | 9 | 1 |  |  |  |  |  |  |  |
| `src/first-loss.ts` |  |  |  |  |  | 8 | 3 |  |  | 7 |  |  |  |  |  |
| `src/fight/gear-stats.ts` |  |  |  |  |  | 7 | 4 |  |  |  |  |  |  |  |  |
| `src/fight/hud.ts` |  |  |  |  |  | 7 | 7 |  |  | 17 | 4 | 2 |  |  |  |
| `src/fight/night-armour.ts` |  |  |  |  |  | 7 |  | 1 |  | 1 |  |  |  |  |  |
| `origins/board/board-view.ts` |  | 1 |  |  |  | 3 | 2 |  |  | 2 |  |  |  |  |  |
| `origins/presence/saves.ts` | 1 |  |  |  | 1 |  |  | 1 |  |  |  |  |  |  |  |
| `origins/region1/npcs.ts` | 1 |  |  |  | 1 |  |  | 3 |  |  |  |  |  |  |  |
| `origins/server/gear.ts` |  | 2 |  |  |  |  |  |  | 2 | 14 |  | 2 |  |  |  |
| `origins/world/zone-rules.ts` | 1 |  |  |  | 1 |  | 3 |  |  | 1 |  |  |  |  |  |
| `src/fight/finisher-look.ts` |  | 2 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/fight/play-radius.ts` |  |  | 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/fight/charge-timing.ts` |  | 1 |  |  |  | 2 |  |  |  |  |  |  |  |  |  |
| `src/fight/quality.ts` |  |  |  |  |  | 5 | 5 |  | 1 | 1 |  | 2 |  |  |  |
| `origins/board/daily-board.ts` | 1 |  |  |  |  |  |  | 6 |  |  |  |  |  |  |  |
| `origins/presence/warps.ts` |  |  |  |  | 2 |  |  |  |  | 1 |  |  |  |  |  |
| `origins/presence/where.ts` | 1 |  |  |  |  |  | 1 |  | 2 |  |  | 3 |  |  |  |
| `origins/preview/label-sprite.ts` |  |  |  |  |  | 4 | 5 |  |  |  |  |  |  |  |  |
| `origins/preview/pit-duel.ts` |  |  |  |  |  | 4 | 2 | 1 |  | 21 |  |  |  |  |  |
| `origins/region1/content.ts` | 1 |  |  |  |  |  |  |  |  | 1 |  |  |  |  |  |
| `origins/server/auth.ts` | 1 |  |  |  |  |  |  |  |  |  |  | 1 |  |  |  |
| `origins/server/db.ts` | 1 |  |  |  |  |  |  | 4 |  |  |  |  | 8 |  |  |
| `origins/server/encounter-verify.ts` | 1 |  |  |  |  |  | 1 |  |  | 6 |  |  |  |  |  |
| `origins/server/live-ops.ts` | 1 |  |  |  |  |  |  |  |  | 1 |  |  |  |  |  |
| `origins/server/quest-advance.ts` | 1 |  |  |  |  |  | 1 | 1 |  |  |  |  |  |  |  |
| `origins/server/talk-pick.ts` | 1 |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |
| `origins/world/clock.ts` | 1 |  |  |  |  |  | 1 | 2 |  |  |  | 1 |  |  |  |
| `src/core/gear-server.ts` | 1 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/core/profile.ts` | 1 |  |  |  |  |  | 1 | 1 | 1 |  |  | 3 |  |  |  |
| `src/core/skills-server.ts` | 1 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `src/fight/combat.ts` |  |  |  |  |  | 4 | 1 | 6 |  | 57 | 20 | 1 |  |  |  |
| `src/fight/follow-camera.ts` |  |  |  |  |  | 4 | 6 |  |  |  |  |  |  |  |  |
| `src/fight/hamstrung.ts` |  |  |  |  |  | 4 |  |  |  | 1 |  |  |  |  |  |
| `src/fight/open-fight.ts` | 1 |  |  |  |  |  | 6 | 2 |  | 29 | 2 |  |  |  |  |
| `src/fight/roll.ts` |  |  |  |  | 2 |  | 1 | 4 |  |  |  |  |  |  |  |
| `src/fight/weapon-shapes.ts` |  |  |  |  |  | 4 | 7 |  |  |  |  |  | 3 |  |  |
| `src/zone1-hop.ts` |  | 1 |  |  |  | 1 | 1 |  |  | 3 |  |  |  |  |  |
| `origins/preview/ground-looks.ts` |  | 1 |  |  |  |  | 5 |  |  |  |  | 5 |  |  |  |
| `origins/preview/ground-pickup.ts` |  | 1 |  |  |  |  | 1 |  |  | 1 |  | 5 |  | 1 |  |
| `origins/preview/remote-heroes.ts` |  |  |  |  |  | 3 | 1 | 4 |  | 1 |  |  |  |  |  |
| `origins/server/consume.ts` |  | 1 |  |  |  |  |  |  | 1 | 4 |  | 2 |  |  |  |
| `origins/world/resolve.ts` |  | 1 |  |  |  |  |  |  |  | 8 |  | 4 |  |  |  |
| `src/core/contracts/ids.ts` |  | 1 |  |  |  |  |  |  |  | 3 |  | 3 |  |  |  |
| `src/core/gear-net.ts` |  | 1 |  |  |  |  |  | 1 |  |  |  | 4 |  |  |  |
| `src/fight/archetype-rows.ts` |  | 1 |  |  |  |  |  |  |  | 3 |  |  |  |  |  |
| `src/fight/gear-rows.ts` |  | 1 |  |  |  |  | 1 |  |  | 2 |  |  |  |  |  |
| `src/fight/hit-impact.ts` |  |  |  |  |  | 3 | 4 |  |  | 10 | 1 |  |  |  |  |
| `src/fight/move-rows.ts` |  |  | 1 |  |  |  |  |  |  |  |  |  | 4 |  |  |
| `src/fight/opening-pose.ts` |  |  |  |  |  | 3 | 2 |  |  | 1 |  |  |  |  |  |
| `src/fight/rank-look.ts` |  |  | 1 |  |  |  |  | 95 |  | 5 |  | 1 | 3 |  |  |
| `src/fight/tactic-rows.ts` |  |  | 1 |  |  |  |  |  |  |  |  |  | 2 | 1 |  |
| `src/fight/tutorial-ui.ts` |  | 1 |  |  |  |  |  |  |  |  | 1 |  |  |  |  |
| `src/fight/twist.ts` |  | 1 |  |  |  |  | 1 |  |  | 1 |  |  |  |  |  |
| `origins/preview/daynight.ts` |  |  |  |  |  | 2 | 11 |  |  |  |  |  |  |  |  |
| `origins/preview/frontier-relief.ts` |  |  |  |  |  | 2 | 6 |  |  | 1 |  |  |  |  |  |
| `origins/preview/mob-looks.ts` |  |  |  |  |  | 2 | 4 | 2 |  |  |  |  |  |  |  |
| `origins/preview/presence-client.ts` |  |  |  |  |  | 2 | 5 | 5 | 1 | 2 |  | 11 |  |  |  |
| `origins/server/handlers.ts` |  |  |  |  | 1 |  | 1 |  | 1 | 5 |  | 2 |  |  |  |
| `origins/server/spell-check.ts` |  |  |  |  | 1 |  |  |  |  | 1 |  |  |  |  |  |
| `origins/world/derive.ts` |  |  |  |  | 1 |  | 2 |  |  |  |  |  |  |  |  |
| `origins/world/variants.ts` |  |  |  |  | 1 |  |  | 2 |  |  |  |  |  |  |  |
| `origins/zones/resolve.ts` |  |  |  |  | 1 |  | 1 | 2 |  | 10 |  | 11 |  |  |  |
| `src/core/career-ladder.ts` |  |  |  |  | 1 |  | 1 |  |  |  |  |  |  |  |  |
| `src/core/gear-sheet.ts` |  |  |  |  |  | 2 | 3 | 1 | 1 | 3 |  | 1 |  |  |  |
| `src/fight/bands.ts` |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |  |
| `src/fight/blood-edge.ts` |  |  |  |  |  | 2 | 2 | 1 |  | 3 |  |  | 2 |  |  |
| `src/fight/fx-math.ts` |  |  |  |  |  | 2 | 5 |  |  |  |  |  |  |  |  |
| `src/fight/mobkit.ts` |  |  |  |  |  | 2 |  |  |  | 11 | 3 |  |  |  |  |
| `src/fight/special-boss-timing.ts` |  |  |  |  |  | 2 | 3 |  |  |  |  |  |  |  |  |
| `src/fight/special-lighting.ts` |  |  |  |  |  | 2 |  |  |  | 3 |  |  |  |  |  |
| `src/fight/standoff.ts` |  |  |  |  |  | 2 |  |  |  | 2 |  |  |  |  |  |
| `src/fight/world-combat.ts` |  |  |  |  |  | 2 | 4 | 1 |  | 19 |  |  |  |  |  |
| `src/legends.ts` |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |  |
| `src/retry.ts` |  |  |  |  |  | 2 |  |  |  |  |  |  |  |  |  |
| `origins/board/board-screen.ts` |  |  |  |  |  | 1 |  | 1 |  |  |  |  |  |  |  |
| `origins/preview/shop-screen.ts` |  |  |  |  |  | 1 |  |  |  | 1 |  |  |  |  |  |
| `origins/preview/warm-plan.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| `origins/world/town-kit.ts` |  |  |  |  |  | 1 | 18 | 1 |  | 8 |  |  |  |  |  |
| `src/audio/gate.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| `src/chunk-recover.ts` |  |  |  |  |  | 1 | 2 |  |  |  |  | 3 |  |  |  |
| `src/clip.ts` |  |  |  |  |  | 1 | 5 |  |  | 1 |  | 2 | 5 |  |  |
| `src/core/build-server.ts` |  |  |  |  |  | 1 |  |  |  | 1 |  |  |  |  |  |
| `src/fight/body-tables.ts` |  |  |  |  |  | 1 | 1 | 1 |  |  |  |  |  |  |  |
| `src/fight/class-special-identity.ts` |  |  |  |  |  | 1 | 1 |  |  |  |  |  |  |  |  |
| `src/fight/fatigue.ts` |  |  |  |  |  | 1 | 6 |  |  |  |  |  |  |  |  |
| `src/fight/special-identity.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| `src/fight/special-presentation.ts` |  |  |  |  |  | 1 |  | 1 |  | 7 |  |  |  |  |  |
| `src/fight/victory-headline.ts` |  |  |  |  |  | 1 | 3 |  |  | 5 |  |  |  |  |  |
| `src/fight/wounds.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| `src/fight/zone-fx.ts` |  |  |  |  |  | 1 | 1 |  |  | 6 |  |  |  |  |  |
| `src/gate-rise.ts` |  |  |  |  |  | 1 | 3 |  |  |  |  |  |  |  |  |
| `src/pvp-hold.ts` |  |  |  |  |  | 1 | 3 |  |  |  |  |  |  |  |  |
| `src/zoom-guard.ts` |  |  |  |  |  | 1 |  |  |  |  |  |  |  |  |  |
| **total** | **351** | **131** | **39** | **5** | **162** | **6149** | **3213** | **706** | **129** | **1377** | **122** | **267** | **166** | **11** | **0** |
