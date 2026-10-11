# ARMAGEDOM: handover and integration guide from the Frankendom rebuild

Strategy, 2026-10-11. Read-only review of `worktrees/web-ui-hollow` at c981e11 (Web/src, 80 plain JS files, about 5,500 lines) plus AGENTS.md, PROJECT_STATE.md, the two 11 October briefs and the backend checkout. Code findings below were gathered by a reviewing agent with file:line receipts; I read the docs and the Frankendom side myself. Nothing in the ARMAGEDOM repo was edited.

## 1. The verdict in five lines

1. ARMAGEDOM today is the shape Frankendom was two weeks ago: one `main.js` that wires everything, a `combat.js` that imports 22 modules including area data and item code, areas as code objects plus hard-coded lists, creatures as file groups with prefix matching, saves in localStorage from the page. It works, and it is small, which is the good news.
2. Frankendom just paid a week of lane time to pull that shape apart into Engine / Core / Modes with data rows and boundary tests. ARMAGEDOM can adopt the shape in days because it is one tenth the size and has no players' data to migrate.
3. Do it as a series of small moves behind a door, never as a rewrite. The live game stays live throughout. Every step ships with the test that stops it sliding back.
4. Copy the contract, not the code. Same entry names, same row shapes, same test rows as Frankendom, written in ARMAGEDOM's own plain JS. If the two engines ever merge into one package, that becomes a move, not a rewrite.
5. The open seamless-travel task is itself the first argument for the engine owning actor lifecycle. Do not finish that task on the old shape and then rebuild it.

## 2. The target shape (what Frankendom now has)

Three layers, one door each, boundary-tested.

- **Engine** = the fight. One package, one entry: `createFight({fighters, wall?, onEvent})` plus `createInput()`, the follow camera, the HUD and meters, wounds, finishers, the attacker cap, the character catalogue rows. Nothing outside the engine knows a creature's timer, hit box or state machine. Frankendom: `src/fight/index.ts` is the only import path; `src/fight/server.ts` is the renderer-free door for server code.
- **Core** = the game around the fight, one copy per game: account, session, profile, items and gear ledger, loot and loot claims, grades, career state. One door: `src/core/index.ts`. Value moves only through one `settle()` with closed reasons; pages never call the save server directly.
- **Modes** = thin clients: the Pit, each zone, towns. A zone is a data row. Frankendom's Zone 2 is a 16-line file: id, level, name, world chunks, biome, camera presets. New zone = one row plus content, zero combat code, under 300 lines including hooks.
- **Creatures** are catalogue rows (body, look, wounds, finisher cut, speeds, loot) read by one spawner.
- **Boundary tests** (`tests/k7-engine-parity.test.ts`, `tests/core-boundary.test.ts`) fail the build when: a mode imports engine internals instead of the door; a mode owns a creature timer; anything outside the engine places the camera; anything outside the engine caps attackers; a page imports server code at runtime; anything outside core touches the save transport; a "known exceptions" list grows (it may only shrink). Each row has a mutation test proving it would catch the violation.
- **Camera and controls live in the engine.** Per-area camera is data (`camera.presets` on the zone row). The gladiator Pit keeps its frozen camera as a client setting on top; an isometric fixed view is just another preset.

## 3. Where ARMAGEDOM stands against it

| Shape rule | ARMAGEDOM today (agent's read, file:line) | Distance |
|---|---|---|
| One engine entry | None. `main.js:225-268` runs the loop and wires 18 modules; `combat.js:1-22` imports area data, supplies, vest, pistol, the hollow descriptor | Far |
| Areas as data | Geometry and camera are data in `public/world/<area>/layout.json` with hashes (good). Spawns, drones, atmosphere are code objects; area list hard-coded in `world.js:71`, `main.js:329`, `parked-area-preparation.js:7`, the atmosphere BUDGETS table; Westminster special-cased in `combat.js:71,342`, `supplies.js:3`, `vest.js:3`, `hud.js:129,172`, `main.js:22,120`. A 4th area touches 7 to 9 files | Medium |
| Creatures as rows | File groups per creature (rat, dog, roach, gaunt, drone), hp table `[55,95,50,400]` at `combat.js:49`, prefix matching at `area-mob-spawns.js:50-55`, `actors.js:10-19` imports each creature's JSON; `initializeAreaResidents` at `combat.js:338-364` has an `if` per creature | Medium |
| One core, one settle door | No core. State on one `game` object, two localStorage keys (`main.js:28-37`, `pistol-save.js:8,18`), three pickup paths, value changed in `combat.js:164`, `pistol-save.js:41-59`, `pistol.js`. Backend is a Supabase prototype, not wired | Far, but cheap: there is nothing to migrate |
| Controls and camera in the engine | Input in `input.js` and `main.js:147,199-201`; camera fixed per area (`world.js:4`), preset fields already in layout.json | Near for camera, medium for input |
| Boundary tests | 99 unit and integration tests, none scan imports or forbid `localStorage`/`fetch` outside a module | Far, one afternoon |
| Provenance | Donor knife pinned by commit and sha (good); audio CC0 per cue (good); donor asset licences "not fully traced" at `public/assets/donor/manifest.json:99` | Close the gap before any public store listing |

## 4. The rebase, in the order that avoids rework

Each step is one PR, small, reviewed once, shipped alone, with its test row. Do not start step N+1's code before step N is live. This is the order Frankendom wishes it had used.

**Step 0. The boundary test first, with an allow-list that may only shrink.** One `tests/boundary.test.js` that globs `Web/src/*.js` and asserts: (a) only `main.js` and the engine door import engine files; (b) `localStorage` and `fetch` appear only in the core; (c) the string literals `'westminster' | 'east' | 'south'` appear only in data files; (d) `camera.position` is set only in the engine. Seed each row with today's violations as a KNOWN list, exactly like Frankendom's K7 test. The rule from day one: KNOWN never grows. Every later step deletes entries. Half a day. This is the single highest-value change because it turns the rest into a countdown.

**Step 1. The door.** Create `Web/src/fight/index.js` that re-exports what exists today (`createGame`, `stepGame`, `initializeAreaResidents`, input, impact, finishers). Point `main.js`, `travel.js` and `pistol-save.js` at the door. No behaviour change. One PR, one day. Then move files under `fight/` one group at a time (move, never copy): combat, combat-impact, finisher-*, rat-contact, rat-melee-definition, creature-behaviour-*, input, motion. Frankendom did this as a codemod in 40 minutes: 16 files, 145 imports rewritten.

**Step 2. `createFight()` as the one call.** Replace the `prepareEncounter` and `frame()` orchestration in `main.js:225-268,359-428` with `const fight = createFight({world, residents, onEvent})` and `fight.step(dt)`. The engine owns the accumulator, actor lifecycle, effects reset and HUD model. `main.js` becomes the Westminster mode: it loads the area row, calls the door, renders. This is where the seamless-travel work lands naturally: the engine owns dormant views and the prepared-roster record, so a crossing is `fight.swapArea(row)` rather than a rebuild of characters. Expect the 9-second South entry to fall out of this step rather than from a cache bolted onto the old shape.

**Step 3. Areas as rows.** One `public/world/<area>/area.json` per area holding what layout.json has plus spawns, drones, atmosphere and the camera preset. Derive the area list from `manifest.json`; delete the four hard-coded lists. Move the Westminster special cases (`combat.js:71,342`, `supplies.js:3`, `vest.js:3`, `hud.js:129,172`, `main.js:22,120`) into row fields (`openingGroup`, `supplies`, `vestBag`, `residentIntents`). Acceptance: a 4th area is one folder and zero code, and a test proves it by loading a fixture area with no source change. Frankendom's `new-zone.mjs` scaffolder is worth copying in spirit.

**Step 4. Creatures as rows.** One `CREATURES` table: id, rig, hp, size, speed, appearance id, behaviour preset, contact definition, loot. One spawner reads it; `initializeAreaResidents` loses its per-creature `if`s; `actors.js` loads a row's JSON by id instead of importing each file. The soot ambush and roach territory rules become behaviour presets referenced by placement rows, not `if (area === 'east' && placementKey === ...)`. The hp table at `combat.js:49` disappears into the rows.

**Step 5. The core.** `Web/src/core/index.js` with `settle(reason, delta)` as the only way value changes, a single save document (merge the two localStorage keys once, with a one-time migration), and one pickup path. Supplies, vest, ammo, kills, deaths all go through it. The Supabase prototype plugs in behind the same door later as `core/server.js`; the page never learns it exists. Boundary rows: nothing outside core touches `localStorage` or `fetch`; no page-memory currency.

**Step 6. Camera and controls into the engine, presets as data.** `createInput()` and `createFollowCamera()` exported from the door; `intent()` and `combatVisibleIds` (`main.js:199-201`) move inside. The fixed isometric crop becomes preset `iso` on the area row; a follow camera with shoulder offset, collision pull-in and smoothing becomes preset `follow` for when you want it. Two Frankendom donor notes worth reading before writing the follow camera: clamp distance to the nearest terrain hit and snap in, ease out; march back along the view ray.

**Step 7. Career and progression.** Not yet. ARMAGEDOM has no currency or ladder. When it gets one, it is a core row set with one level function, not a page feature. Frankendom's rule to copy on day one: a mode's ranks never seed another mode's level.

Total: about seven PRs. Steps 0 to 2 are the critical path and roughly a working week for one dev. Steps 3 to 6 are each one to two days and can interleave with feature work once the door exists.

## 5. What to copy from Frankendom, and what not to

**Copy (the contract):**
- The entry names and shapes: `createFight`, `createInput`, `createFollowCamera`, `createHud`, the `onEvent` stream, the `Fight` object with `step/state/events`.
- The zone row shape (`id, level, name, world[], biome, camera.presets`) extended with ARMAGEDOM's `spawns, drones, atmosphere, supplies`.
- The catalogue row shape for creatures (body url, look, wounds, finisher cut, speeds).
- The two boundary test files, row by row, with their mutation tests. Translate to `node --test` and plain JS.
- The ledger rules: value book only; one `settle()` door; closed reasons; market off until designed.
- The attacker cap living in one engine file, with the test that no second cap exists anywhere.

**Do not copy:**
- Frankendom's engine code itself. It is TypeScript, melee-only, and full of gladiator identity (signature moves per class, the Pit ladder, legend opponents). ARMAGEDOM has guns, drones and an isometric view. Shared shape, separate engines, until both are stable enough that a shared package is a move.
- Frankendom's database or server. Separate games, separate data. Share the `core/server.js` door shape only.
- The nine-lane process. ARMAGEDOM's five roles are right for its size.

## 6. Process rules that saved us this week, worth adopting as written

1. **Inventory before plan.** Every slice starts with "what exists, where, and which copies die". Lead's Core plan on Frankendom found two item ledgers, three kill-loot paths, two currencies and two banks before writing a line. ARMAGEDOM's equivalents are listed in section 3.
2. **Move, never copy.** A copy is a second owner. The boundary test's KNOWN list only shrinks.
3. **Draft PR as soon as code exists.** The Web lane on Frankendom lost its context yesterday without a handoff; the work survived only because the branch was pushed. ARMAGEDOM's "preserve dirty worktrees" culture is the opposite instinct. Push early, draft early, state doc entry before any clear.
4. **One owner per problem, one candidate at a time, no batch waits for a slice.** Whatever is ready goes; the rest rolls.
5. **Receipts, not reports.** "Live" means a curl of the release file by the person claiming it. A plan is "Lead reports" until a receipt exists. PROJECT_STATE.md already does this well; keep it, and keep the entries readable (the compressed style of the 7 October entries is hard for a new dev to use).
6. **Data-only PRs skip the Auditor.** Once areas and creatures are rows, a new area is a data review, not a code review. That is where the 700-zone idea becomes possible on Frankendom and the eight-area cap becomes cheap on ARMAGEDOM.
7. **Visual PRs carry stills** at the phone width, idle and mid-fight, before and after. ARMAGEDOM already separates desktop from physical-phone acceptance; stills in the PR body make that reviewable.
8. **Look tests before building.** A style flag on the live scene in a preview folder, judged on the phone in five minutes, before a lane commits days to it.

## 7. Traps we hit that the boundary test must cover from day one

- A zone keeping its own creature timer or hit reaction "just for this one creature". Row 7 of Frankendom's parity test detects it.
- A zone placing the camera with literals instead of the row's preset.
- A page calling the save transport directly "because it is one field".
- A second attacker cap, a second currency, a second bank, each added for a good local reason.
- A save-server process that reads stale code because the tool deciding "reinstall needed" under-counted files. If ARMAGEDOM wires the backend, the deploy step reinstalls on any change under the engine, core or server folders, no heuristic.
- A lane clearing its session without a state-doc entry. Nothing lost if the branch is pushed; everything lost if it is not.

## 8. What not to do right now

- Do not finish the seamless-travel task on the current shape and then rebuild. Land step 0 and step 1 first (two days), then do travel inside `createFight` where actor lifecycle lives. The measured cost is actor rebuild, not download, which is exactly the thing the engine should own.
- Do not add a streaming framework, a second save writer or a fourth area before step 3. The brief already says this; the shape above is why.
- Do not convert to TypeScript now. The boundary test and the door matter more; TS can come file by file once the folders are right.
- Do not share the Frankendom engine package yet. Match the contract so the option stays open.

## 9. Files and references

- Frankendom engine door: `src/fight/index.ts`; core door: `src/core/index.ts`; zone row example: `origins/zones/zone2/zone.ts` (16 lines); boundary tests: `tests/k7-engine-parity.test.ts`, `tests/core-boundary.test.ts`; zone scaffolder: `scripts/new-zone.mjs`. All on the frankendom trunk as of 2026-10-10.
- ARMAGEDOM receipts in this guide are from `worktrees/web-ui-hollow` at c981e11, gathered 2026-10-11 by a read-only review.
- Companion reading in the Strategy reports folder: the donor-library verdict (ledger and camera rulings) and the ten wild cards (feel ideas with phone look tests), both of which apply to ARMAGEDOM's post-nuclear London as much as to Frankendom.
