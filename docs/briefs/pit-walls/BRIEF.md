# Brief: the Pit's walls (skull wall, record board, trophy rack, wall of champions)

**From:** Lead, on Dom's rulings, 2026-10-04 ~20:30–20:45. This brief supersedes the layout half of `docs/briefs/skull-wall/BRIEF.md`; the records half (part A, `fight_results`, #1366) stands.
**Owners:**
- **World, Pit & Audio:** everything you see and tap.
- **Duels & Backend:** the queries.
- **Lead:** reviews.

**Where it all lives:** the open-air cage Pit (PR #1370, the default Pit from that release). One stone gate wall with the arch in the middle, iron fence on the other three sides. The weapon rack stands along the left fence.

## Dom's words

- "lets have 1 skull wall with any opponent (computer or player) on it, so i kill 3 computer opponents then 1 player i have 4 skulls ... if i had 73 kills ... it can show however many black box spaces there are, 6x5 so 30"
- "lets do all 3": the record board, the trophy rack and the leaderboard.
- On the trophy rack: "it can showcase the top most highest level weapon/armour for now, automatically, e.g. if u kill a level 8 nightborn, clearly that piece is more high level than a level 3 goblin"

## 1. Skull wall: RIGHT of the arch (6×5 = 30 niches)

- **One skull per kill**, computer or player, newest first, capped at 30.
- **Tap a skull:** that kill's card.
  - Computer: legend portrait, name, rank (rank "unknown" for old wins).
  - Player: name, level, gear icons, date.
- **Data:** `pit_recent_kills()`, which Backend is adding to #1366 (latest 30 win rows, ai + duel).
- **Fallback** (before the migration is applied, and for guests): one skull per `loot.taken` / `loot.declined` provenance, newest by `day`. Dom's profile has 29 taken + 4 declined = 33 kills, so he sees 30.
- `&skulls=demo` on the preview seeds about 12 mixed kills.

## 2. Record board: LEFT of the arch (replaces the left niches)

- **What it shows:** tally marks and numbers carved into the stone.
  - Total kills
  - Wins / losses
  - Current win streak
  - Highest rank beaten
- **Style:** looks carved, not a UI panel. A canvas texture on a stone slab, chiselled numerals and five-bar tally gates, lit by the torch beside it. Dom has rejected flat panels over the scene twice.
- **Tap:** the same numbers in the bottom sheet, plus the split by computer vs duel.
- **Data:** wins/losses from `fight_results` (`pit_ai_standing` + `pit_duel_beaten` sums, or a new `pit_record()` if simpler, Backend's call). Streak = the run of wins in the latest rows. Highest rank = the max of `ranks_beaten`.
- **Fallback:**
  - Total kills = taken + declined.
  - Wins = `victory_marks` (the profile already has it; Dom's is 121).
  - Losses, streak and rank show "—" until records exist.

## 3. Trophy rack: the existing weapon rack (left fence)

- **Today:** the rack hangs what the player owns and isn't wearing (`room.ts` `hang()`).
- **Change:** it shows the player's **highest-level** pieces automatically: up to 4, best first (e.g. one weapon, one shield, two armour pieces).
- **What "level" means:** the provenance tier first (the rung the kill was at); then the opponent's place in the ladder for old takes with no tier. A level 8 Nightborn piece beats a level 3 Goblin piece. If loot items carry their own grade or level, prefer that. Character or Stats can confirm the field.
- **Tap the rack:** opens the **backpack / loadout** (the full inventory: worn, stored, weapons and armour), exactly as today (`pit.ts`: a rack tap calls `game.openJournal()`). Dom 10-04: "if u click on it it shows your backpack inventory remember?" Keep that, and keep the sheet's "Open loadout" button.

## 4. Wall of champions: the BACK fence (behind the arrival point)

- **What it shows:** today's top fighters by name, on a wooden board hung on the back fence with names burned or painted in.
- **Data must be trusted, not client-claimed** (AI rows in `fight_results` are cosmetic only). Use the existing **daily board**: `daily_board_summary()` (fastest kill, cleanest kill, longest survived, fastest death; verified rows ranked first, public read). Five headline names with their feat, e.g. "Fastest kill — Wanderer, 14.2 s".
  - A real "top N by verified daily results" list can come later if Backend adds one.
- **Tap:** the board's full lines in the sheet.
- **Empty day:** "No champions yet today."

## Process (unchanged)

- World: rebase `world/skull-wall` onto trunk once #1370 is in.
- Flag-only look on `/preview/pit-cage/` first, with `&skulls=demo` (and a demo record and board).
- Phone stills at 390×694, a tap test per wall in a browser, then its own PR with visual-pr-stills.
- Backend: `pit_recent_kills` (and `pit_record` if used) ride on #1366's next sha, so the Auditor reviews once.
- Gotcha: put comments on their own line.

## Done when

Dom walks into the Pit and sees:
- his latest 30 kills as skulls right of the gate
- his record carved on the left
- his best pieces on the rack
- today's champions on the back fence

Every one of them is tappable.
