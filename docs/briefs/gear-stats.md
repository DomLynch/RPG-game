# Brief 19 — Gear stats (loot stops being cosmetic)

Owner: **Stats lane** — session "Frankendom - Stats, Damage, Defence", worktree `~/Developer/frankendom-stats`, state file `docs/state/stats.md`, reports to Lead. Written by Strategy 2026-09-22 on Dom's
word ("yes for stats", "if we're going to do it, let's do it properly"). Supersedes the Brief 5 line "visual cosmetics only, no stats"
(`src/loot.ts` header) once deliverable 5 lands; nothing before that changes a fight.

**Sequence.** Deliverables 1–4 start now and touch none of Combat's files. Deliverable 5 (the sim seam and the ladder retune) lands
**after** Combat's queue — knife approach fix, Executioner profile, Nightborn retune, shield rule — and after Weapons has taken the flips
and the battery (Dom's line in the Weapons session, pending). Stats never jump the four weapons.

## The bar
Gear tilts, skill decides. A naked Recruit can still beat every rung under its fairness cap; a full Origin set moves any one stat by
**at most 25 %** against no gear. The daily duel stays a skill board: everyone fights it in the same fixed kit. Career fights use your own.

Pass condition for the whole brief, on Dom's phone: take a Praetorian helmet from a kill, see its numbers on the kill screen and the
paperdoll, feel the next fight differ, and lose it anyway to a cleaner fighter.

## The four stats
| stat | carried by | what it multiplies | range, naked → full Origin |
|---|---|---|---|
| Attack | weapon | damage dealt (`def.damage` at the hit) | 1.00 → 1.15 |
| Defence | armour: the six wearing slots of the seven in `ARMOUR_SLOTS` (Helmet, Body, Arms, Gloves, Greaves, Boots; the Crest is the seventh and carries nothing) | damage taken, chip included | 1.00 → 0.80 |
| Poise | armour, same six | posture damage taken (`shake`) | 1.00 → 0.75 |
| Stamina | the worn set as a whole | stamina pool | 100 → 125 |

Values come from the Brief 14 tier ladder (Recruit rag → Legionary leather → Gladiator bone → Veteran copper → Champion bronze →
Praetorian iron → Master steel → Primus blackened steel → Invictus emerald → Origin gold & ruby): one number per tier per slot in a
data table, no hand values per piece. Raw damage gets the smallest range on purpose: kill timings, finisher windows and the fight-length
pins stay closest to what is measured today. The Crest carries nothing (it is a mark, not armour).

## Design rules (fixed)
- **One seam, pure sim.** A `Loadout` (the four multipliers, already resolved) is an input to `stepDuel`, applied where the hit resolves
  (`wound()`, chip on block, `shake`) in `src/duel.ts`. The sim reads nothing from the profile. Determinism and the arm64/x64 digest rule
  are untouched.
- **Opponents wear theirs.** Every opponent from Legionary up already wears its full six; it fights with that tier's stats. The ladder gets
  steeper by kit as well as by AI. Ladder retune per rung is part of deliverable 5, not a follow-up.
- **The record carries the loadout.** Both sides' multipliers go into `FightRecord`; `RECORD_VERSION` bumps; the replay verifier replays
  with them; daily and kill-link fixtures are re-recorded. A shared fight must replay with the numbers it was fought with.
- **Server-authoritative loot.** Owned pieces are awarded by the server from verified records; client-reported loot stops counting for
  anything a fight reads. Backend lane reviews the migration and RLS; Deploy applies it. Until this lands, the seam is not merged.
- **Daily duel in fixed kit.** Same kit for every player, chosen with the day's opponent; the board compares skill only.
- **Battery in brackets.** The fairness battery runs naked / mid (Champion) / full (Origin) kit, every player weapon × every live rung ×
  normal and hard × 24 seeds, as an exact snapshot like `tests/player-weapons.test.ts` today. The naked bracket is the guarantee.
- **Numbers shown.** Paperdoll shows the four stats and the tilt against no gear; the kill-screen take shows the delta of the piece.
- **No new systems.** No durability, no repair, no upgrades, no sets, no crafting, no economy. Four multipliers and a table.

## Deliverables (one PR each, PR body is the report, receipt image where there is a screen)
1. **Tier stat table** — data + tests: every tier × slot resolves to the four multipliers; the full Origin set lands exactly on the caps
   above; the naked loadout is the identity. No sim change.
2. **Loadout in the record** — `FightRecord` gains both loadouts, `RECORD_VERSION` bump, pack/unpack round-trip, verifier replays with
   it, fixtures re-recorded. Behind a flag so a naked loadout replays byte-identical to today's records.
3. **Server-authoritative awards** — migration + RLS: the award comes from a verified record's outcome, the client's `owned` is a cache.
   Backend reviews, Deploy applies at its deploy. Receipt: an award written by the server, none by the client.
4. **Bracketed battery + paperdoll numbers** — the battery script gains the three brackets and the snapshot test; Web design shows the
   stats on the paperdoll and the kill-screen delta (Web owns the copy and skin, Stats supplies the numbers).
5. **The seam + the ladder** — multipliers at the hit in `src/duel.ts`, opponents wear their tier, daily duel fixed kit, ladder retune per
   rung until every bracket clears every cap, all fight-length pins green, honest before/after seed traces in the body. Lands after the
   shield. This is the PR that turns stats on.

## Cost, stated honestly
About two lane-weeks for Stats plus Backend's migration and Web's panel. The days are mostly re-measurement (deliverables 4 and 5),
not code: the seam itself is an afternoon.

## Owners
Stats builds 1, 2, 4 (script), 5. Backend reviews 3, Deploy applies it. Web builds the panel half of 4. Combat reviews 5's ladder
retune against its own profiles. Weapons re-runs the bracketed battery on every flip from then on. Lead sequences the merges; Strategy
reviews every PR body before merge.
