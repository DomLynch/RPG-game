# Top-30 integration programme (Strategy brief to Lead, 2026-10-12 23:3x)

Dom's order: all 30 donor learnings (Games-Analysis `docs/TOP-30-ADDENDUM-2026-10-12.md`) go into the central engine and the data layer, plus two of his own: gear must count in a fight, and "kill a boss, take their spell" across all 700 bosses. Ready before beta. Pit-era design rules are void; rank on merit. This file is the plan of record; Lead owns the order and the lanes, Strategy rules disputes.

## 0. What exists on trunk 000bb88d0 (checked, not assumed)
- Sim = a timing duel (`src/fight/duel.ts`): posture, directional guard, parry window, dodge, charge, specials with wind-up and interrupt, stamina. There is no to-hit roll; the only roll is the world-mob ±10% band (`roll.ts`). So "roll ladder" items below are adapted to state gates, not dice.
- Gear: `src/fight/gear-stats.ts` resolves a kit to `Loadout { attack, res }` as data; brief 19 deliverable 5 ("Loadout into stepDuel") never shipped, so gear changes nothing in a fight.
- Resource pools are rows (`pool-defs.json`, shared loader). CC ladder exists (`cc-ladder.ts`). Specials are rows (`special-defs.json`, 12 rows, template + params). Bosses are rows (`bosses.json`, 12, ranks 8-10 slices in review). Catalogue = 118 legends. Registry loader `src/core/registry.ts`; ledger `settleAll` in `src/core/career-model.ts`.

## 1. Rules of the programme
1. Everything-as-data acceptance: a new spell, brick, damage kind, school, armour piece, faction, title band, event or kill switch is ONE ROW through the shared loader with a manifest; no closed unions, no switch over names (open-sets ruling).
2. Sim changes ship with a byte-identical fingerprint receipt where behaviour is unchanged, or a RECORD_VERSION bump plus a replay test that names the first differing tick where it is not. One sim series at a time per file; Combat A owns `duel.ts`, Combat B owns specials/bricks.
3. Core changes (account, ledger, grimoire, skills, factions, wear) go through `settleAll` with a closed reason set; nothing pays twice on retry.
4. Timing stays sacred: no row may change a tell, wind-up, parry window or recovery. Gear and weight change damage, stamina and cast success, never timing.
5. Phone first: every new bar, badge or number has a 375-wide still in the PR.

## 2. The two new mechanics (Dom, tonight)

### 2a. The sheet, LOCKED (Dom, 2026-10-13 01:0x, "lock it in for the whole sheet")
Everything a player has runs 50 to 100 and the number is a percentage. One currency. Ten dials, any skill, one point a level.
- LEVEL: 1 to 50.
- DIALS (ten, one row each, open set): Attack, Spell Power, Armour, Magic Resist, Health, Stamina, Poise, Luck, Focus (cast success, interrupt resistance), Recovery (regen). Every dial starts at 50 and caps at 100. None touches timing (tells, wind-ups, parry windows, recoveries never change).
- SKILLS (one row per weapon and per magic school, open set): sword, axe, spear, bow, fire, frost, shadow, earth, wind, holy, poison, ... Every skill starts at 50 (anyone can wield anything at half effect) and caps at 100.
- POINTS: one point per level, 50 per career, spendable on ANY dial or ANY skill. A point on a dial applies at once. A point on a skill raises that skill's CEILING by one; practice fills it (the Crawl use-pool from settled fights moves the skill from 50 toward its ceiling; grey targets teach nothing). Points decide what you can become, play gets you there. Nobody maxes more than one thing; the glass cannon (Spell Power 100, Health 50), the sponge (Health 100), the swordsman (Sword 100) and the generalist (60 across five) are all one rule.
- RE-SPREAD: free until level 10, then once per rank-up (every 10 levels).
- CREATION: no sliders at launch; everyone starts at 50 on everything. (A zero-power shuffle screen, move 10 off one dial onto another with no dial below 25, may be added later as a Core screen.)
- GEAR (option C): a full set is worth 50. 25 is SHAPE, the tilt: the set's row says which dials go up and which go down (plate +25 armour / -25 magic resist, robes the reverse, leathers stamina up / armour down; per-school resist rows give the tilt by school). 25 is QUALITY: common 0 up to legendary 25, spread by the set's row. Every dial still caps at 100 wherever the points come from, so gear fills what the points did not (a 100-Attack swordsman's plate pays into Health and Armour). Two guards: gear has a level and a player may wear up to 5 levels above their own; boss-dropped gear binds to the character that earned it (one flag on the loot row). Weight is a row field that costs stamina and taxes casting (Ryzom/Crawl shape). WEAR bites the quality 25 first, by slot weight (chest 35, legs 22, head 15, arms 14, hands 7, neck 7), 1 hit in 4; repair costs metal and eats a little of wearMax (ModernUO shape).
- SPELLS: see 2b. A composed spell lands by the player's skill in its school.
- TITLES and favour: prestige over the head, never points.
- POWER SPREAD: a maxed dial is 2x a newbie's; a specialist is 4x in a fight on the two dials they chose and 1x elsewhere; gear adds 25 of real power and 25 of shape; a naked level 50 beats a legendary level 1 (50 to 25), a geared level 50 beats a naked one (75 to 50); between equals the timing duel decides.
- BOSSES are off the sheet: boss rows scale by data (5x or 10x a newbie is fine), the 75% mitigation-curve asymptote applies to creature and boss rows only, and the level-gap resist term means a rank-1 spell barely scratches a rank-10 boss. That is where the scale lives without breaking player versus player.
- ENFORCEMENT: a dial, a skill, a set tilt and a quality are rows with base, cap and pool; one build validator checks per-dial, per-skill, the 50-point total and the gear cap at load and on the writer; review fails any player number past 100 or any point past 50 per career; a new dial or skill is a row and the rule does not move.
- Loadout grows to { attack, res, resist, weight, quality } and finally enters stepDuel (brief 19 deliverable 5).

### 2b. Kill a boss, take their spell (700 bosses → 700 spells → a grimoire)
- Every boss row gets `spell`: the id of a brick list. The first brick lists come from the catalogue legends (118 today, one skill or special identity each, `class-special-identity.ts`); the 12 `special-defs.json` rows are the first FX templates, not the spell count. A legend with no special row yet gets its brick list authored fresh under the name rule (one special per legend becomes one brick list; Characters/Multi Chars generate 700 by rank with the name rule, 10 per level per region × 7 regions, each with its one-line story).
- A spell is a row of bricks (Ryzom shape): root (school + template), modifiers, suffix; each brick has a signed cost; relative level = (skill + credit - 2×cost)/10 clipped ±50 into a success table (crit 1.1×, success, partial band, fail, critical fail). Daggerfall-style pricing (MIT, portable): cost = offset + A×magnitude + B×per-level with a skill discount, floor 5. Pool costs stay in the pool rows.
- Taking: a VERIFIED first win against the boss (replayed fight, not a client claim) writes one ledger row, reason `spell-taken`, that adds the boss's bricks to the account's grimoire. Once per boss per account; repeat wins pay nothing. Bricks are account-level, not character-level, so alts share the grimoire.
- Composing: the player builds spells from owned bricks in a grimoire screen; a composed spell is itself a row (account-scoped, validated by the same loader rules); the sim casts it through the existing special template, so the fight engine never knows a spell was composed.
- Why it is bigger than any MMO: 700 signature spells, each taken from a named legend, each decomposable into parts the player recombines, and magic resist per school makes which spell you take matter against which boss.

## 3. Mapping the 30 to the layers, with adaptations to our sim
Engine (`src/fight`, Combat A unless stated):
- 1 two axes, 2 damage kinds (slash → stamina drain, crush → posture/poise, pierce → penetration; our posture IS poise), 3 armour taxes casting: all via the gear row in 2a and a `damageKind` field on the move row. Combat A.
- 4 bricks + 2b: Combat B (specials), Backend (grimoire + ledger), Characters (700 spell rows), Web (grimoire screen).
- 5 state gates (adapted): a stunned or casting fighter's parry and dodge are refused; the existing `guardDirection` is the front arc; strafing is not a thing here, drop it. Combat A, small.
- 6 luck/swarm (adapted): `roll.ts` band widened by the number of attackers on the target (world fights only, rows per rank). Combat A.
- 7 immunity tier + partial resist: `immuneTier` and `resist` on the creature row, partial table. Combat A.
- 8 CC diminishing returns + post-CC immunity: timing rows on the existing ladder (100/50/25/immune, reset 15 s, immunity starts at CC end, per family). Combat A.
- 9 threat as data: world fights only (presence director), hate per hit = damage×100/(level+7), taunt = a hate value on the move row. World, after the spawn director.
- 10 hit stop + poise ladder: presentation rows (pause frames per side, one shake object) in Web/Combat FX; poise = posture thresholds already exist, add the stagger ladder rows and post-stagger immunity. Combat A for the sim rows, Web for the frames.
- 23 breath cone: a special template `cone` with ramp and a cone hit test in the sim. Combat B.

Core (`src/core` + origins writer, Backend unless stated):
- 11 skills: points raise the ceiling, practice fills it (2a). The Crawl use-pool from settled fights moves a skill from 50 toward its bought ceiling; grey targets pay zero. Replaces progression-proposal rule 9's "no gain by use".
- 12 factions ledger numbers (bands, spill, damping) and local crime (wanted flag scoped to a town). Backend; World for guard reactions.
- 13 fame × karma title band table + weekly-step favour that never catches up; lazy rollover rows. Backend, hangs off the scorecard.
- 14 wear + repair (2a), one series with the vendor. 15 vendor elasticity + lazy restock + zone tax, trade rules parked with trade. 16 loot deck with pity per account + spawn-time roll. 20 discovery row + derived daily board. Backend.
- 28 live-ops rows: scheduled events table with cron, feature kill switches, read once a minute. Backend.
- 25 persistence: psql pool first, dirty map flushed as one multi-row statement every 60-120 s, relay shard by room hash. Deploy B + Backend.

World (`origins/`, World and Characters):
- 17 pets/mounts/summons (cheap follow, mount fatigue above walk speed, summon priced by standing). After the chase machine.
- 18 night spawns + lawful/chaotic clock bonus + seeded weather. 19 NPC schedule rows + witness memory + rumour weights. 21 chase trio. 22 variants (tier multipliers, swapped ability per spawn, weakness glyph, tier prefix on drops). 24 solo instance slot pool (24 slots, owner key, 300/900 s timers, headcount spawn).

Ops and client (Deploy B, Web):
- 26 dirty-set sends, never queue a skipped update, staggered sends, view-radius shrink at the cap; client governor on draw calls and triangles; chunk streaming slices. 27 flag-never-kick speed check, confidence scaled on bad links, random input-sampling windows, after-the-fact scoring. 29 assets: CC0 kits via the recipe, Crawl CC0 tiles for icons after per-tile check. 30 CC0 audio list in.

## 4. Order (the streamlined path to beta)
Wave A, this week, two parallel series:
- A1 Combat A: gear row + Loadout into stepDuel + damage kinds + state gates + CC timing + immunity/partial (items 1, 2, 3, 5, 7, 8, 6). One sim series, five PRs, each with its fingerprint or bump receipt. This is the foundation every spell item stands on.
- A2 Backend: psql pool + dirty-map flush (25), live-ops rows (28), skills XP-pool (11). Nothing here touches the sim.
Wave B, next: bricks and the grimoire (4, 2b) across Combat B + Backend + Characters + Web; wear/repair + vendor + loot deck (14, 15, 16); factions + titles (12, 13). Characters start the 700 spell rows the day Wave A1's first PR merges (rows need no sim).
Wave C: World items (17, 18, 19, 21, 22, 24), breath cone (23), threat (9), hit stop rows (10).
Wave D: sends/anti-cheat/client governor (26, 27), assets and audio (29, 30), which can run any time a lane is idle.
Gate for beta: Wave A and B live, C's 18/21/22 live, D's 27 live. Everything else may follow beta.

## 5. Receipts Lead posts to Strategy
- Per wave: PR list, the fingerprint/bump line per sim PR, the one-row proof test per data item, stills for anything visible.
- Twice a day: "X of 32 integrated" (30 + gear + spell-taking) with the as-data count beside it.
- Any dispute on scope or order: one line to Strategy, Dom only for money, legal, player-data wipes or parties/guilds.
