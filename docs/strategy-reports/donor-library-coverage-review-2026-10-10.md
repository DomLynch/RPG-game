# Donor library: coverage review (2026-10-10, 16:5x)

For the donor-library dev, at Dom's request. Read-only. Judged against Frankendom's shape: fast duels, many-vs-one capped at 3, 700 zones as data, server-verified kills, one ledger, phone-first at 375 wide, a world worth walking.

## (a) Your gap list: dedicated pass, fold into an existing topic, or skip

**Dedicated reader pass, MUST-HAVE before the wild-cards pass** (these are where the "feel" and the walkable world come from, and none of the 20 topics reads them):

| Gap | Verdict | Why |
|---|---|---|
| Narrative, lore, faction structure, naming | **Dedicated: "world-fiction"** | 700 zones as data are empty without a naming grammar, faction map and rumour system. No topic covers how donors generate names, how factions hate each other, or how a zone tells a story in three lines of signage. |
| World events, world bosses, dynamic events | **Dedicated** | The living-world tricks Dom asked for live here (invasions, roaming bosses, timed events). Spawns covers caps and respawn, not events. |
| Weather, time of day, lighting moods | **Dedicated, small (10-15 donors)** | Cheapest visual differentiation per zone; rendering-performance will not read it as design. |
| Status effects, buffs, debuffs | **Dedicated** | Many-vs-one needs bleed, stagger, fear, knockdown; combat-sim notes are about hit rules and damage, not effect systems. This also feeds vfx. |
| Onboarding, first five minutes | **Dedicated, small** | Phone players leave in 90 seconds; hud-ui will not catch the flow design. Read the roguelikes and the Pokemon-likes for this. |
| Procedural generation of zones, dungeons, names, affixes | **Dedicated, but narrow it** | Zones-world touched layout; loot touched tables. The missing part is name/affix grammars and seed discipline. Roguelikes are the donors. |

**Fold into an existing topic** (add a section to that topic's reader brief, no new pass):
- Skill/talent trees, build diversity → progression.
- Difficulty scaling, death penalty, respawn rules → progression (penalty) and spawns (respawn already).
- Achievements, titles, cosmetics collection → progression ("fame" already exists in Frankendom; the legends ladder).
- Minimap, world map, UI navigation → hud-ui.
- Audio identity, music layering, ambience → sound-music, but add the words "layering, stingers, ambience beds" to the brief or readers will return only "plays a wav".
- Accessibility, localisation, touch-control UX → hud-ui (touch) and a one-line check in every reader: "where are the string tables?".
- Save/persistence/offline progress → server-tick (persistence shape) and zones-world (zone state); already partly read.
- Modding and data-driven content schemas → zones-world and inventory; the catalogue task already asks "dig into data files".

**Later, not now** (real, but not before the wild cards):
- Crafting, gathering, professions: economy already lists craft payment; the gameplay loop is a post-shop decision.
- Mounts, travel, fast-travel, teleport networks: 700 zones will need it, but after Zone 3 exists.
- Pets, companions, summons: a MAX_ATTACKERS question first (does a pet take a seat?).
- PvP modes, rankings, seasons, leaderboards: the Pit already has ranks; read when PvP leaves the Pit.
- Housing, player spaces, guild halls: after guilds, which are deferred.
- Telemetry, live-ops, patching, content pipelines, zone-authoring tools: an engineering pass for Lead and Deploy, not a design pass; the donors that matter are the big emulators' admin tools.
- Moderation, reporting, safety: with chat, which is deferred.
- Monetisation and retention hooks: design only, and Dom's call; one short pass later.
- Foliage, terrain, water: rendering-performance should note it; a dedicated pass only if the look tests say the world feels bare.

## (b) What a world-class team would also examine, and you do not collect yet

1. **The "first fight" and "first kill" scripting.** How donors stage the first enemy, first hit feedback, first loot drop. Different from onboarding UI; it is pacing. Roguelikes and the action RPG ports hold it.
2. **Enemy archetype grammar: how a game makes 100 creatures feel like 12 families with variation.** Catalogue lists families; nobody is asked "what is the reuse rule" (recolour, size, one swapped ability, one swapped attack animation). This is the single most important thing for 700 zones from the 100 Pit characters.
3. **Hit feedback stack as a system:** hit stop, screen shake, flash, sound, particle, knockback, in what order and how long. vfx-blood-finishers reads blood; hud-ui reads panels; nobody reads the stack as one thing. Fighting-game donors (Ikemen) and action RPGs hold it.
4. **Readability at phone size:** silhouette rules, colour-coding of threat, outline and rim conventions, how many enemies a frame can hold before it muddles. Comes from pixel and low-poly donors.
5. **Encounter design templates:** the shape of a zone's encounter (ambush, camp, patrol, lair, escort), separate from spawn caps. Spawns reads the plumbing; this is the design layer.
6. **Death and failure presentation:** what the player sees on death, the respawn moment, how a loss is made bearable. Tied to death penalty but visual.
7. **Idle and ambient animation vocabulary:** what characters and creatures do when nothing happens (grooming, pacing, sleeping, reacting to the player's approach). Animation-rigs reads rigs, not behaviour.
8. **Loot presentation and reveal:** drop ceremony, rarity colour and sound, inspect flow on a phone. Loot reads tables.
9. **Boss intro and finisher staging:** camera, pause, name card, music stinger. Camera reads rigs; vfx reads blood; the staging is between them.
10. **Soundscape per biome:** which donors ship ambience beds per zone type, and how they crossfade at borders. Fold into sound-music with explicit words.
11. **Text and sign vocabulary:** how zones speak through names, signs, gravestones, graffiti. Part of world-fiction.
12. **Anti-boredom for walking:** what a game puts every 20 seconds of walking (a chest, a corpse, a shrine, a track). Call it "walk density". Part of world events or encounter templates.
13. **Accessibility of combat timing on touch:** input buffer windows, forgiveness, auto-aim/lock-on rules. Fold into hud-ui touch or controls; the camera doc already touches lock-on.

## (c) Recommended additions, one line each

| Addition | Scope | Donor types | Priority |
|---|---|---|---|
| world-fiction | naming grammars, faction maps, rumour/sign text systems, zone story-in-3-lines | UO/EQ/WoW/DAoC emulators (quest and faction tables), roguelikes (name generators), Civ-likes (civ/leader data), text MUDs (evennia) | must-have |
| world-events | invasions, roaming bosses, timed events, event scheduling | WoW/EQ/UO emulators, SWGEmu, RuneScape servers | must-have |
| status-effects | buff/debuff/stagger/fear/knockdown systems, stacking, durations | MMO emulators, Pokemon-likes, roguelikes | must-have |
| creature-grammar | the reuse rule behind creature families (recolour, scale, swapped ability), tiering across 100 to 1000 creatures | Pokemon-likes, roguelikes, MMO emulators, Diablo-likes | must-have (feeds the 100-chars-to-700-zones plan) |
| hit-feedback-stack | hit stop, shake, flash, knockback, sound, particles as one ordered system | fighting-game engines, action RPGs, Diablo-likes | must-have (Dom's "feel") |
| encounter-templates | ambush/camp/patrol/lair/escort shapes and walk density | roguelikes, MMO emulators, strategy games | must-have |
| weather-time-light | day/night, weather, mood presets per biome | open-world ports (Gothic, Morrowind, Daggerfall), Minecraft-likes | should-have |
| onboarding-first-5 | first fight, first kill, first loot pacing | roguelikes, Pokemon-likes, action RPGs | should-have |
| procgen-grammars | name/affix grammars, seed discipline | roguelikes, Diablo-likes | should-have |
| boss-staging | intro, finisher camera, name card, stinger | fighting games, action RPGs, Dark-Souls-likes | should-have |
| death-presentation | death, respawn moment, loss framing | roguelikes, Souls-likes, MMOs | later |
| travel-mounts | fast travel, mounts, teleport networks | MMO emulators | later |
| pets-companions | companion seats vs MAX_ATTACKERS | MMOs, Pokemon-likes | later |
| live-ops-tools | admin, patching, authoring tools | big emulators | later, for Lead/Deploy |

## (d) Collection-quality risks in the specs

1. **Code over data.** Readers are told "read the code"; most of what makes a world feel alive is in data files (XML, JSON, CSV, Lua tables, SQL dumps). The catalogue task says "dig into data files"; the deep-note TASK and ASSET-TASK do not. Add to every brief: "find the data tables first; cite the table, not the loader".
2. **Server half only, or client half only.** Emulator donors are server-only (no feel), client donors are client-only (no rules). A reader on one half will report "no finisher system" when the other half has it. Add: "state which half you read; if the pair exists in the box, name it".
3. **String tables and localisation ignored.** Names, lore and signage live in locale files readers skip. Add: "open the string table; count entries; quote nothing, describe the grammar".
4. **The 6-section mechanism template rewards plumbing.** Decision/acceptance lines make every note read like an engineering ticket, which is why the first verdict felt "boring". For the new design topics, use a different template: what the player sees, what made it striking, the reuse rule, a 5-minute look test. Do not run feel topics through the mechanism template.
5. **"Top 8 striking" with no criterion.** Readers will pick by name recognition. Give a criterion: silhouette readable at 375 wide, one signature behaviour, one signature sound or effect, and "could be made ours at 20 to 30 percent resemblance".
6. **Inspiration briefs with no resemblance guard.** ASSET-TASK asks for "own words" but not for the distinctness rule. Add Dom's rule verbatim: recreate as a clearly distinct original, never a copy; name the trait kept and the trait changed.
7. **Restricted donors leak into design.** Catalogue says restricted donors "stay high level", but inspiration can still carry a protected design (a named creature's exact look). Add: for class C/D donors, inspiration is limited to category-level ("a plated beetle boss") never instance-level.
8. **Verdict inflation.** Wave 2 reports ~89 percent STRONG. Either the bar is low or the readers are generous. Keep the 1-in-4 Sonnet check, and add a random 1-in-20 re-read by a different Haiku with no sight of the first note; disagreement rate is the quality number.
9. **Counts without paths.** "Top 8" lists without file paths cannot be checked. ASSET-TASK demands paths; CATALOGUE-TASK should too, for every named creature, item and zone.
10. **Cross-topic silos.** The connectors in my first verdict came from pattern tags, not field names. Keep tags mandatory and controlled; add tags for the new topics before readers start, or the next cross-topic pass has nothing to join on.

## Order for the wild-cards GO

Before I write the ten wild cards I need, in this order: creature-grammar, hit-feedback-stack, world-events, world-fiction, status-effects and encounter-templates read, plus the asset audit past half. Weather, onboarding, boss-staging and procgen help but can follow. Everything under "later" stays later.
