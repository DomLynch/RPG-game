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

### 2a. Gear that counts (replaces light/medium/heavy as a closed union)
A piece is a row: `armour` (physical mitigation), `resist: { <school>: n }` (per school, open set; negative = weak, ACE shape -2..2 folded to a multiplier), `weight` (kg), `wearMax`, `slot`. Derived once, outside the duel, into the Loadout the sim already expects:
- physical taken = base × (1 - armour/(armour + K)) capped at 75% (AzerothCore shape, own K per rank);
- spell taken = base × school factor from the target's summed `resist[school]`, partial not binary (EQEmu partial curve as the table);
- `weight` → stamina cost multiplier on attacks and dodges, and a casting malus on spell success (Ryzom/Crawl shape, one field);
- wear per hit by slot weight (chest 35, legs 22, head 15, arms 14, hands 7, neck 7), 1 in 4 hits, repair eats `wearMax`.
"Light / medium / heavy" are three preset rows in the same table, not a type. A fourth kind is a row. Loadout gains `{ attack, res, resist, weight }`; `stepDuel` reads it (brief 19 deliverable 5, now with four fields). Gear tilts, skill decides, and the whole sheet runs 100 to 200 (Dom, 2026-10-12 23:0x). THE SHEET RULE: every player stat starts at 100 and tops out at 200, so the number-one player is 2x per stat and 4x in a fight (kills a newbie in 5 hits, takes 20). The 100 points above base are budgeted by layer so each layer visibly matters: level and Origin rank +50 at the cap; full gear set +25; skills by use +15; titles, favour and perks +10. Layers add points. Armour and magic resist are two of these stats on the same 100-200 line, so a plate build can sit at 200 armour / 100 resist and a robe build the reverse. A new stat is a row with its own base and cap. The 75% is only the asymptote of the mitigation CURVE and applies to creature and boss rows: bosses are not on the player sheet, so the 700th boss may be 5x or 10x a newbie by data, and the level-gap resist term means a rank-1 spell barely scratches a rank-10 boss. That is where the scale lives without breaking player versus player. Ranked PvP pairs by power band; the level-difference falloff already in career-model stays.

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
- 11 skills by use = Crawl XP-pool: each settled fight adds practice events per skill used; the last 100 events set each skill's share of the pool; focus doubles; grey targets pay zero; cap grows with rank; ModernUO lock Up/Down/Locked per skill at the budget. Replaces progression-proposal rule 9's "no gain by use".
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
