# Frankendom: Origins — Integration Blueprint

Prepared 6 October 2026. Proposal for an expansion of the existing mobile-first Three.js/TypeScript browser game, retaining Supabase and Google sign-in. Desktop browsers remain first-class clients; Electron/Steam packaging is a later distribution task.

## Dom's rulings (2026-10-06) — these override anything below

1. **Adopted.** Follow this blueprint. Work starts after the beta gates (five-stranger playtest, mid-range Android run).
2. **The gate opens at Gladiator, not Origin, and unlocks in stages.** Gladiator (rank 3) opens the outer gate: the Concord Exchange, the first region and chapter one, *The Stolen Name*. Champion opens the next realm. Origin opens the endgame story. The locked gate is visible in the Pit from level 1.
3. **Membership.** The Exchange, the first region and chapter one are free. Every realm after that needs a monthly membership (starting price $9.99/month plus an annual discount; NOT fixed: Dom will move it up or down after measuring). It switches on with the second region.
4. **Content rule.** Gods, demons and legends from any tradition are allowed, EXCEPT figures central to a major living religion: God, Allah, Jesus, Muhammad, Mary, Joseph, Satan/Lucifer, Buddha, and the principal deities of Hinduism and other religions with large followings. Hades, Ereshkigal, Anubis, Arawn, Dracula, Norse, Celtic, Egyptian, Mesopotamian and literary figures are in.
5. **Donor research.** The offline tools (OpenMW, ZenKit, emulator source) may read the original game data for research. What ships is Frankendom's own: new text, art, maps and code.
7. **One progression, two places to earn it.** Characters can go back into the Pit and fight at any rank, as today, and they also level in the world. Killing a world boss raises skill and rank the same way an arena win does; ordinary mobs and low-level creatures give much less, and less again for repeats or for creatures far below your level. Levelling borrows the best of EverQuest, Ultima Online, World of Warcraft, Morrowind and Gothic II. There is still one career, one rank and one set of stats, all server-verified. World of ClaudeCraft (MIT, about 1M LOC) is the parts bin: pick and take what fits.
6. **Kept from review.** One shared-world server only (Lead picks: a lean Node server on ClaudeCraft's hardening patterns, or Colyseus). The Book of Enoch stays with Armagedom. Add Elden Ring-style ghosts from real players' fight records. Add creator-minted cosmetics as an item source.

8. **Deep analysis, then our own better code (clean room).** For every system taken from Morrowind/OpenMW, Gothic II/OpenGothic, Ultima Online/ModernUO or EverQuest/EQEmu, it runs in four steps:
   - **Analyst agents** read the actual C++/C# code and write a full specification: behaviour, every formula and constant with file:line, edge cases, order of operations.
   - **Separate implementer agents**, who never see the donor source, write Frankendom's own TypeScript from that specification.
   - They modernise and improve freely, and every deliberate change is listed.
   - Parity tests come from golden cases, captured from the running emulators where possible.
   Result: the code is wholly ours (no GPL inherited), so it can run on the server or in the browser.

## Status and decision

This document is a development plan, not an implementation receipt. Representative source files and project documentation were inspected. No original commercial game archives were supplied, no original campaigns were extracted, and no donor engine was compiled or benchmarked during this review. Repositories, production data and authentication configuration were not changed.

Build one Frankendom game, not a launcher containing five transplanted engines. Reuse Frankendom's combat, identity and presentation. Reuse selected ClaudeCraft source where the dependencies and licence permit it. Use OpenMW, OpenGothic/ZenKit, ModernUO and EQEmu to recover and document behaviours, content structures and test cases; implement the required subset in Frankendom's TypeScript rules and content schema. Native tools may remain in the offline development toolchain. They are not required in the browser or production game servers.

## 1. Product definition

**Pitch:** Born in the Pit. Free to walk the worlds. Powerful enough to change their legends.

The Fracture has joined territories from different histories, mythologies and literary traditions into a contested frontier. Frankendom is both the name of this stitched world and the neutral city surrounding the original Pit. Reaching Gladiator opens the outer gate and the campaign, Champion and Origin open deeper realms, and the arena remains playable.

The setting is not confined to the historical Mediterranean in 200 BC. Mediterranean imagery remains the visual foundation of the starting district. A larger realm network supports different periods and traditions without imposing historical simultaneity on the original source material.

All crossover situations are original Frankendom fiction, not claims about theology or the original games. Gods retain distinctive motives and limitations. Their manifestations or champions can fight under shared local rules without claiming that all cosmic beings have equal ultimate power. Defeating an arena manifestation need not mean permanently killing its namesake.

Example campaign: Hades and Ereshkigal dispute jurisdiction over a vanished soul; Dracula's agents possess the record of its true identity, and Arawn of the Otherworld offers a bargain for its release. The player investigates testimony, infiltrates an estate, negotiates with rival envoys, and chooses a resolution. This is not the same quest repeated with different boss names.

Content rule: see Dom's ruling 4 above. Do not equate a whole culture's pantheon with an evil faction.

## 2. Donor-to-product map

| Source | Principal contribution | Production treatment |
|---|---|---|
| Frankendom | Readable action combat, rigs, arena loop, current identity and gear presentation | Preserve and extend behind tests |
| Morrowind / OpenMW | Quest stages, conditional dialogue, layered investigation, factions, journals | Behaviour specifications and new authored content; selective offline parsing |
| Gothic II / OpenGothic / ZenKit | Dense locations, NPC routines, earned access, mentors and faction membership | Small native TypeScript systems; offline format inspection where needed |
| Ultima Online / ModernUO | Social banks, trade, reputation/virtues, crafting, staged public encounters | Adapt the useful rules into one economy and event system |
| EverQuest / EQEmu | Named-enemy loot, loot tables, group expeditions, zone structure, inventory categories | Data-driven rewards and cooperative encounter designs; not its entire server |
| World of ClaudeCraft | Same-stack implementation examples for inventory, banking, collections, crafting, networking guards, mobile graphics | First candidate for narrowly scoped source extraction |
| Ink / inkjs | Branching dialogue and narrative-state runtime | Evaluate as a small reusable dependency, not an economy authority |

Do not preserve multiple competing attribute systems, currencies, container formats or quest runtimes. Every donor capability terminates in a single Frankendom contract.

### Inspected evidence

- OpenMW `apps/openmw/mwdialogue/journalimp.cpp` maintains quests, journal stages and dialogue topics through engine-specific world/content dependencies.
- OpenGothic's NPC and script implementation includes scheduled routines; its README explicitly requires Gothic II data and scripts and targets native graphics APIs.
- ZenKit documents parsers for Gothic archives, worlds, models, animation and compiled Daedalus scripts.
- ModernUO's `QuestSystem.cs`, `QuestObjective.cs`, `VirtueSystem.cs` and `ChampionSpawn.cs` demonstrate objectives, independent reputation tracks and staged boss encounters, but are coupled to its entities, UI or persistence.
- EQEmu `zone/loot.cpp` reads loot tables, probabilities and drop limits through its zone and database types.
- ClaudeCraft `src/sim/bank.ts` includes inventory, material, catalogue, entitlement and simulation-context dependencies. It is not a standalone bank package.
- Frankendom `src/duel.ts` explicitly describes a deterministic 60 Hz, two-fighter simulation. `src/gear-stats.ts` resolves gear before simulation and keeps attack/parry/roll timing unchanged.

## 3. Source acquisition, decoding and extraction

### Stage A — Reference workspace

Keep read-only donor checkouts outside the production browser build. Pin each to a commit, including dependent submodules. Preserve licence files and record source paths. Do not merge donor root folders into Frankendom or automatically track moving upstream branches.

Create a manifest containing donor, commit, file or record identifier, behaviour, dependencies, licence, reuse decision, destination, tests and status. Mark each candidate: reuse, adapt, reimplement, reference only, or reject.

Count executable code, tests, generated files, content tables and assets separately when estimating maintenance. Do not treat repository size or test count as a quality score.

### Stage B — Read already-decoded formats

**Morrowind:** OpenMW already understands ESM/ESP game records, archives and model formats. Use its content tools/readers for research. Inspect quest stages, dialogue conditions, faction relationships, locations and references. Some quest behaviour lives in scripts; extracting a table of dialogue is not a complete quest conversion. Unsupported script behaviour must produce an explicit report, not an invented translation.

**Gothic II:** Use ZenKit or tools built on it to inspect VDF archives, ZEN worlds and compiled Daedalus DAT scripts. Capture selected NPC schedules, waypoints, chapter conditions, dialogue and quest dependencies. Its VM still needs engine-provided functions; parsing bytecode does not create a ready-to-run browser RPG.

**UO and EQ:** Their emulator source is already readable. Inspect the C#/C++ implementations and relevant database or script structures, documenting item identity, ownership, transfer, loot selection, crafting inputs and reputation changes. Do not build a UO or EQ network-protocol bridge unless there is a separately approved requirement to run those exact servers.

**ClaudeCraft:** No language conversion is necessary for TypeScript modules. Calculate their complete dependency closure, including shared types, content registries and implicit runtime assumptions. Extract the smallest useful unit, not the whole parent system.

### Stage C — Distil behaviour

For each candidate write one small behaviour specification with inputs, outputs, state changes, errors and invariants. Example: a bank transfer preserves item identity and quantity, refuses an unauthorized owner, does not overfill the destination, and remains correct when a request is retried.

Create examples from source behaviour and adversarial counterexamples. Independent review should check the specification rather than only approving output generated by the same coding agent.

### Stage D — Normalize into Frankendom data

Adopt stable IDs and versioned schemas for CharacterDefinition, CharacterInstance, FactionDefinition, QuestDefinition, QuestState, RegionDefinition, EncounterDefinition, ItemDefinition, ItemInstance and LootTable.

Use an intermediate research representation to relate original records to proposed mechanics. Production content is a reviewed, allowlisted output with original/replacement text and art or independently cleared material. Do not let unrestricted exports of commercial game data become a browser download.

### Stage E — Implement and verify

Prefer existing Frankendom implementations when adequate. Reuse compact permissively licensed modules where they fit. Implement new TypeScript behaviour when adapters would carry large legacy dependencies. A literal translation retains the original code's licensing obligations; changing programming language is not a relicensing mechanism.

Every retained unit must compile without the donor game, pass its relevant retained/new tests, expose a narrow interface and have one owning developer. Transitive imports of old UI, world catalogue, crypto or platform code fail the extraction gate.

### First three extraction proofs

1. Inventory capacity and item transfer: compare selective ClaudeCraft extraction with a small native implementation against one identical contract.
2. Quest stage transition: build an OpenMW-informed quest journal and a new five-stage story with branching conditions.
3. Public event: rebuild ModernUO's staged-spawn idea as a deterministic encounter definition, with Frankendom fighting rules and EQ-informed reward tables.

A successful extraction means runnable, dependency-bounded and tested. Source inspection alone does not establish saved engineering time.

## 4. Streamlined production architecture

Retain the current deployment layout wherever possible. The following names are proposed module responsibilities, not a demand to reorganize the repository or introduce a framework:

- Existing browser application: Three.js rendering, responsive UI, controls, audio and local prediction.
- Combat module: pure shared fighter rules and contact resolution; versioned and replay-tested.
- World module: authoritative actors, navigation, interactions, party membership and encounter routing.
- Story module: quest state transitions, branching dialogue, faction access and campaign state.
- Economy module: inventory custody, banking, trade, loot awards and crafting transactions.
- Content module: validated definitions, maps, encounters and asset manifests.
- Network contracts: bounded commands, snapshots, session handoff and version negotiation.
- Node server: persistent world/encounter runtime, calling the shared rules.
- Supabase: existing Google authentication, persistent application data and access controls.
- Asset delivery: versioned static content from the existing CDN/storage arrangement.

Start with a modular service and independently owned rooms, not a collection of microservices. Split processes where profiling or fault isolation requires it. Do not add Redis, a global message bus or another backend merely because an MMO might eventually need them.

### Authority boundaries

The game server owns live position, collision, combat and encounter results. The economy transaction layer owns durable item/currency custody. The story service advances important progression from verified events. The browser owns presentation and predicts where appropriate; it does not award itself loot or validate its own campaign unlock.

Simulation runs in memory. Durable transactions occur at reward, trade, craft and progression boundaries; ordinary movement must not become a stream of database writes. A reliable outbox/deduplication path connects a verified result to its one durable settlement.

Each character has one active authoritative simulation session. A second device may inspect account data but must perform an explicit handoff to take control. Cross-zone transfers require a single-use handoff and an ownership epoch so the old server cannot keep writing after transfer.

Keep the current two-player rollback mode intact. Do not make every browser simulate every player in the world. Authenticate and authorize the new shared-world service with the same account identity.

## 5. Google sign-in and Supabase

Keep the existing Google OAuth provider, callback configuration and Supabase user IDs. This is Google sign-in; it needs no Gmail inbox permission.

The browser signs in through the existing flow, obtains a Supabase session and joins the game service over HTTPS/WSS. The service verifies token signature, issuer, audience and expiry and authorizes the requested character. With asymmetric signing keys use the project's supported JWT/JWKS verification; do not trust an unsigned decoded payload. Refresh/reauthenticate sockets deliberately and handle expired sessions.

No Google secret, Supabase secret/service credential or privileged database credential belongs in the client. Enable RLS on exposed tables with ownership-aware read policies. Deny direct client mutation of currency, item ownership, verified fight results and career marks. Privileged server paths must still perform ownership checks.

Suggested durable entities are quest states, faction standings, inventory containers, item instances, transfers, reward claims, parties/guild membership and world-event state. Adapt to the existing schema; do not create parallel player or inventory authorities.

Use the current database migration tooling with versioned, additive changes. Back up and test on staging. Preserve profiles, equipped appearances, earned marks and existing accepted claims. Resolve old collection unlocks separately from new tradable item copies. Do not turn repeatable cosmetic unlocks into infinitely mintable market items.

Hosted Edge Functions can handle short APIs/webhooks, but the persistent combat/world loop belongs in a long-lived game runtime. Supabase Realtime may be used for suitable notifications or social presence, not as a substitute for game authority.

## 6. Combat conversion

The hard part is not rendering a Roman sword in a different scene; it is evolving a two-fighter arena simulation into multiple entities interacting in arbitrary space.

First freeze representative arena replays and outputs. Extract reusable movement, fighter state, stamina, guard, attack phase, hit testing and damage resolution behind the existing duel wrapper. Separate arena-only boundary and punishment rules from reusable combat.

Then introduce EntityId-based targeting, multiple teams, enemy aggro, collision/navigation, multi-target hit limits, stable processing order, death/revive rules and disconnected-player behaviour. Never obtain group combat by calling the full duel step once for every pair; that can advance timers and resolve hits more than once.

Retain the existing 60 Hz combat contract at first. Choose snapshot frequency independently through profiling. Lower-frequency NPC scheduling, social updates and strategic events should not force combat to use a slower timestep. Run reference replays across browser and server engines to detect drift.

Begin with one hero and two enemies, then two players and one boss, then four players and a small enemy group. Keep the same stamina and visible timing language. Use restrained telegraphs and prevent unreadable masses of simultaneously attacking melee enemies. Any AI Director attack limits are explicit rules, not hidden damage overrides.

Special creatures need authored movement, hit volumes, attack windows and interruption behaviour. Scale and rig changes do not automatically preserve weapon contact. Validate animation and collision together for every skeleton family.

## 7. Character progression, gear and magic

Preserve career rank as identity; the outer gate opens at Gladiator (ruling 2). Derive access from the canonical rank function and verified marks rather than a newly hardcoded win threshold. Introduce story hints before Origin without redefining the current ladder.

Use the existing draft five-stat vocabulary—STR, DEX, VIG, END and POISE—as the starting point for design review, not a second new five-stat scheme. Their precise formulas remain proposals. Resolve a validated loadout once before an encounter or through an explicit server-approved in-encounter change.

Keep equipment focused on Attack and RES initially. The inspected gear module defines an Attack cap of 1.15 and an incoming-damage multiplier of 0.80; this is a source-defined intended budget, not proof that the feature is live. Do not silently alter those caps or speed up attack/parry/roll windows to accommodate imported loot.

Keep rarity, power budget, material, appearance and story significance as distinct properties. Start with four rarity categories. A celebrated relic may have a special, budgeted behaviour rather than universally larger numbers. Weapon type continues to determine its recognizable fighting style.

Use bounded progression for weapons and a small set of professions, not unrestricted skill-by-use grinding. NPC mentors and faction quests can unlock techniques. Repeated safe actions should not generate infinite power. Allow respec/build experimentation without requiring purchases.

Keep the existing compact mobile combat interface. Expand skill loadout options before expanding the number of simultaneous on-screen buttons. A chosen divine pact can alter available skills without implementing a separate magic engine for each pantheon.

## 8. Loot, storage and the social bank

Create the **Concord Exchange**, a neutral bank and market plaza beside the Pit. It is a social location with visible avatars, inspectable equipment, party recruitment, a contract board, personal vaults, crafting counters and direct trade. Its neutral covenant explains why rival worshippers or monsters' envoys can visit without combat.

Separate the facilities:

- Personal bank: private storage only.
- Shared account storage: a distinct entitlement if multiple characters are supported.
- Guild vault: deposits and withdrawals governed by roles, limits and an audit log.
- Direct trade: explicit offers and confirmation from both parties.
- Gift: a trade with one empty side, with recipient confirmation.
- Market listings: later persistent escrow, not a browser flag that says an item is for sale.

Do not recreate unrestricted floor-dropping as the default way to gift items. Use a safe trade UI. Any offer change invalidates prior confirmations. Disconnects either cancel an uncommitted trade or return the already-committed receipt.

Each item instance has one canonical location/custodian, a version and provenance. Lock or compare versions when moving it. In one transaction validate ownership, binding, destination capacity and available money; transfer both sides; write the receipt; commit. Requests use idempotency keys. Never delete on one client and recreate on another.

Loot definitions map enemies, regions and events to probabilities and drop limits. Named enemies have recognizable rewards, plus a reasonable repeat-attempt fallback such as crafting progress. Use personal group loot initially. Story-critical objects cannot be lost through trade or inventory overflow.

Retain 'take one piece or move' for the Pit. In multiplayer exploration, avoid stopping the whole party at a loot screen after every ordinary enemy. Reserve a meaningful choice for elite/boss encounters; standard materials can be collected through a simple interface.

Use one principal trade currency initially. Keep faucets and sinks measurable: fixed quest rewards and loot sources versus crafting/repair/market services. Crafting should consume real materials and create budgeted output; collection and cosmetic progression should not require destructive gear treadmills.

Banked items are safe. Begin with clear, recoverable adventure failure, not unrestricted full-loot loss or permanent character death. Full-loot frontier rules require a separately signposted mode.

## 9. World, map and narrative structure

Start with the Pit, the Concord Exchange, one frontier region and one dungeon. The first region should itself combine influences rather than put each culture behind an unrelated menu.

Proposed opening area: an ash-covered Roman frontier broken by a river of the dead and the encroaching estate of a vampire court. Greek-style funerary architecture, a displaced mountain shrine and Gothic ruins share the same geography because of the Fracture. The meeting plaza connects these routes.

The world atlas can show later realms without loading or claiming they are already playable: Underworld Marches, Blood Courts, celestial ruins and eastern mountain frontiers are expansion directions. Give every realm local stories, recurring characters and reasons for trade with the hub.

Prefer compact authored regions with landmarks, useful loops and shortcuts. Reuse modular geometry and controlled procedural dressing. Apply procedural generation to repeatable caves and events, not indiscriminately to the critical plot or settlement layout.

Represent each region with boundaries, portals, navigation/collision, landmarks, spawn groups, interaction points, quest triggers and an asset manifest. Production maps use original/replacement geometry or cleared assets. Studying an old map's pacing is different from automatically shipping its exported layout.

### Story architecture

Each named figure has a stable lore identity, a faction, relationships, quest roles, presentation variants and encounter forms. The current arena's rank labels remain presentation data; they are not the key for an NPC's persistent narrative state.

Separate three kinds of state: personal journal decisions; party-instance encounter decisions; shared scheduled world-event outcomes. A player's private campaign cannot delete an essential public NPC for everybody else. Shared consequences should be explicit, recoverable and versioned.

Use Ink/inkjs or a small typed dialogue graph for conversations. Keep durable quest progression and rewards in server-authoritative code. Store the version of a story alongside its progress; provide migrations or a safe checkpoint when a chapter changes.

LLMs can assist offline writing, test-case generation and optional low-stakes dialogue. They do not directly set loot, ownership, quest completion or canonical world history. Important branches and outcomes are authored and reviewed.

### First complete adventure: The Stolen Name

At Gladiator the player discovers that their name was removed from a record kept beneath the Pit. A missing ferry courier links the theft to a rival death court. Testimony in the Exchange contradicts the official account. Investigation leads to a vampire-controlled ruin. The player can negotiate, infiltrate or fight for the record, then return it, bargain with it or expose its falsification.

The adventure changes personal patronage and available follow-up quests. Its boss yields a recognizable item or crafting component. A party can complete the expedition together without forcing every member to permanently adopt the leader's personal patron. A separately scheduled public event can aggregate verified contributions without making one player's dialogue choice govern the whole server.

## 10. Graphics and mobile pipeline

Use Frankendom's gritty material language across all sources: iron, bronze, worn leather, bone, stone, cloth and restrained supernatural effects. Preserve distinctive cultural silhouettes rather than dressing every character in interchangeable armour. The unified art direction is separate from a unified religious or historical interpretation.

Use the existing approved character-generation tools where suitable, followed by Blender cleanup, topology review, UVs, rigging, skin-weight correction, animation retargeting and contact validation. No generated image or raw mesh counts as a production-ready enemy.

Export a consistent GLB/glTF asset pipeline. Standardize units, up axis, forward direction, root naming, animation naming, weapon sockets and material conventions. Create LODs, simplified collision, occlusion helpers and thumbnails offline. Use compressed GPU textures and supported geometry compression after measuring decode cost. Three.js already has GLTFLoader, KTX2Loader and Meshopt/Draco integration points.

Keep legacy format readers and archival converters offline. Do not ship a Morrowind or Gothic runtime just to draw one model. A direct licensed asset conversion still needs renderer/material/rig testing; replacement art needs the same production QA.

For environments, combine hand-authored landmarks and collision with reusable modular buildings, baked lighting where appropriate and controlled procedural placement. Distant scenery can use impostors. Impostors, culling and fog are complementary; no source review established an 'instant load' guarantee.

Retain the current working Three.js renderer first. Treat a WebGPU migration as a separate optional experiment, not a dependency for this expansion.

Recommended initial device gates, to be measured rather than assumed: sustained 30 FPS on a named mid-range phone, 60 FPS as a higher-tier target, a 20-minute thermal session, bounded first-region transfer and memory, and acceptable return from browser backgrounding. A provisional first-region download budget is 15–25 MB transferred, excluding already-cached/shared assets; recalibrate it from actual scene quality and network tests. Do not equate compressed file size with GPU memory.

Test realistic numbers of unique equipment combinations, not only 50 identical mannequins. Cull and simplify cosmetic crowd work without hiding combatants, damage zones or interactive threats. Dispose region resources and cancel obsolete fetches when the player changes zones. Use versioned manifests and coherent cache invalidation.

## 11. Cross-device experience and distribution

Phones: touch-first, safe areas, legible text, compact controls, portrait arena preserved where appropriate. iPad: wider inventory and journal panels with touch and optional keyboard/controller. Desktop browsers: responsive layout, mouse/keyboard and optional controller using the same commands and rules.

Avoid building a desktop-only gameplay role. Wider screens should improve convenience, not grant different attack timing or exclusive information. Decide on exploration camera and orientation through a measured prototype; do not force a native-app conversion to solve a layout problem.

Keep a single server-authoritative account across devices. Browser-local saves and cache can improve responsiveness but do not override committed remote inventory. Define character takeover explicitly.

Electron is a later wrapper around the same production web build, not a separate game. Use an isolated, sandboxed renderer with Node integration disabled, constrained IPC, signed builds and controlled updates. Google OAuth should open in the system browser with a secure, short-lived handoff, not an embedded Google login webview. Steam requires its own build/depot, review and release work; packaging does not imply approval. Steam identity linking is optional and must not create a second inventory authority.

## 12. Implementation work packages and gates

| Package | Deliverable | Acceptance gate |
|---|---|---|
| O0 Baseline | Pin current Frankendom and donors; capture replays, schema and device measurements | No claims of performance or portability without receipts |
| O1 Shared contracts | Stable IDs, content validation, item-instance model, lore identities | Unknown IDs fail safely; no duplicate inventory authority |
| O2 Extraction proofs | Three small donor comparisons with tests and dependency reports | Units run independently of donor world/client |
| O3 Social Exchange | Existing sign-in, walkable hub, personal bank and direct gifts | Two devices move an item once; simultaneous/retried requests cannot duplicate it |
| O4 First chapter | Gladiator gate, five-stage quest, journal, NPCs, one explorable region and boss | Complete two meaningful outcomes; reconnect/resume; one reward; arena unchanged |
| O5 Cooperative combat | New EntityId-based encounter runtime, initially two then four players | Stable authoritative results under latency/loss; existing duel replays unchanged |
| O6 Regional depth | Three joinable groups, a small crafting set, named loot, one public event | Factions affect access and choices; repeated play has rewards without mandatory grinding |
| O7 Release hardening | Asset budgets, recovery, security tests, telemetry, support tools | Physical phone/tablet/desktop matrix and crash/retry tests pass |
| O8 Distribution | Optional Electron and Steam branch | OAuth, signing, updates and backend compatibility tested separately |

O4 can use the existing solo encounter system while O5 is developed; do not represent O4 as already proving cooperative action combat. O3 and O5 require a real shared-world runtime, not merely accounts plus database presence.

No date or budget is asserted here. Estimate implementation effort after O0–O2, using extraction dependency counts, combat generalization findings, actual assets and measured device budgets.

## 13. Test matrix

**Regression:** same inputs produce the same existing arena results; legacy profiles and appearance unlocks survive; new content does not inflate the initial arena download.

**Economy:** double-click reward claim; duplicated requests; two tabs moving one item; full destination; interrupted trade; item offer changed after confirmation; restart after commit but before receipt; craft input race; banned or unauthorized actor; old source server writing after handoff. Required outcome: no unauthorized gain, no duplicate item and a recoverable clear result.

**Story:** missing NPC; unavailable location; unsupported script condition; opposite party choices; chapter upgrade; disconnected player; repeated objective event; full inventory; completed-quest replay. Required outcome: no silent invented progression and no irreversible soft lock.

**Combat:** 1v1 parity, hero-versus-two, two-player boss, four-player group, target death during swing, simultaneous hits, revive, background/resume, jitter, loss and slow client. Measure server step time, prediction corrections and visible unfairness.

**Graphics:** initial visit and warm cache; ten zone transitions; unique equipment; background/foreground; low battery/thermal; unsupported compressed format; context loss; interrupted asset download. Measure transfer, decode, frame-time percentiles and memory trends rather than only average FPS.

**Operations:** staging restore, version mismatch, content rollback, audit lookup, live feature disable, expired tokens and moderation. Keep replay/content versions available for settlement and support investigation.

## 14. Team and scope controls

Assign one owner per contract. A systems lead owns the shared schema and architecture. Separate lanes cover combat/networking, economy/persistence, narrative/content and art/performance, with independent QA. In an agent-heavy workflow, each extraction task receives an immutable donor reference, allowed destination, explicit exclusions and tests; it cannot invent a new framework or expand the game scope.

Prefer a few cohesive modules to hundreds of one-function adapters. Review dependency direction, changed behaviour, slow paths and test quality rather than rewarding fewer lines or more generated tests. Test scanners do not substitute for functional or adversarial tests.

Preserve provenance for reused code. Include original notices. ClaudeCraft's code licence does not cover every asset; inspect its media register. Original commercial game content is not supplied by OpenMW/OpenGothic engine source. Keep uncleared assets and exact commercial narrative exports out of shipped bundles.

Defer large armies, land taxation, playable gods, mandatory seasonal death, unrestricted full-loot PvP, dozens of crafting professions and native mobile stores. They are later extensions of the same contracts, not part of the first chapter. Lore breadth can be large while the first playable region remains small.

## Source register

These sources support the research observations. Proposed Frankendom names, mechanics, architecture, budgets and work packages are design recommendations, not claims that the donor projects provide them.

### Existing Frankendom
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/src/duel.ts
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/src/net/rollback.ts
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/src/career.ts
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/src/gear-stats.ts
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/src/legends.ts
- https://github.com/DomLynch/RPG-game/blob/codex/01a09a76/task-1/docs/progression-direction.md

These branch links can move. The implementation baseline must pin a full commit. Source comments in older design files may be stale; current code and dated scope decisions take precedence.

### Donors and tools
- https://github.com/OpenMW/openmw/blob/master/apps/openmw/mwdialogue/journalimp.cpp
- https://openmw.org/faq/
- https://github.com/Try/OpenGothic/tree/801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1
- https://github.com/GothicKit/ZenKit
- https://github.com/modernuo/ModernUO/tree/261ea01ab4b7c49a043dfabc7f44703b648883f8
- https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/loot.cpp
- https://github.com/levy-street/world-of-claudecraft/tree/f46f30f5849989e44d7aa1bf62b3b14e435bc2fe
- https://github.com/levy-street/world-of-claudecraft/blob/f46f30f5849989e44d7aa1bf62b3b14e435bc2fe/src/sim/bank.ts
- https://github.com/levy-street/world-of-claudecraft/blob/f46f30f5849989e44d7aa1bf62b3b14e435bc2fe/CREDITS.md
- https://github.com/y-lohse/inkjs

### Platform documentation
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/reference/javascript/auth-getclaims
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/limits
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/KTX2Loader.html
- https://www.electronjs.org/docs/latest/tutorial/security
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://partner.steamgames.com/doc/sdk/uploading
- https://www.gnu.org/licenses/gpl-faq.html#TranslateCode
