# Brief: the skull walls, backed by real fight results

**From:** Lead, on Dom's go (2026-10-04 ~17:00).
**Dom's words:**
- "i dont see any skulls? this should use the database, supabase, so it can see fights who won/lost? and same for duels and pvp"
- Earlier: "the left wall can be skulls (actual skulls of computer opponents beaten) when u click on it u get the list of opponents ... right side can be vs actual players/gamers same thing, their name, level, gear etc"

**Owners:**
- **Duels & Backend:** part A (the records).
- **World, Pit & Audio:** part B (the wall).
- **Lead:** reviews both and merges them into the Pit release.

**Where the wall lives:** the open-air cage Pit Dom chose today. Branch `lead/pit-cage` (flag `pit-cage` with `pit-glow`). Preview: https://frankendom.com/preview/pit-cage/?look=pit-glow,pit-cage&arena=1. The stone gate wall is the only wall; the skull niches are its two panels, left and right of the arch.

## What exists today (checked 2026-10-04)

- **Computer fights, wins only.**
  - When you beat a legend, `loot.defeats` gets the portrait key `<opponent>-<rank>` (`src/loot.ts` `defeat()`, called from `src/match.ts:264`).
  - It syncs to Supabase through the fighter profile (`fighter_profiles`, merged as a union in `src/cloud-profile.ts`).
- **The wall.** `src/pit/wall.ts` has 100 niches (10 opponents × 10 ranks) across BOTH panels. `restock(defeats)` puts a skull (`public/pit/props/skull.glb`) in each beaten slot. A tap shows that legend's card (`src/pit/sheet.ts`).
- **Losses: not recorded anywhere.**
- **Duels / PvP: nothing records the opponent or the result.**
  - `duel_metrics` holds anonymous network numbers only.
  - `fight_records` holds shared replays by short id, with no result and no opponent identity.
- **Why Dom sees no skulls:** the preview profile has no wins. Nothing is broken; the data just isn't there for that profile.

## Part A: records (Duels & Backend)

1. **New table `fight_results`** (migration plus RLS, same style as the existing migrations):
   - Columns: `user_id`, `kind` (`'ai'` or `'duel'`), `opponent_key` (legend key `<opponent>-<rank>` for AI; the other player's user id for duels), `opponent_name`, `opponent_level`, `opponent_gear` (jsonb snapshot of the paperdoll ids, small and capped), `result` (`'win'`, `'loss'` or `'draw'`/no-contest), `created_at`.
   - Index on `(user_id, created_at desc)`.
   - A fighter reads only their own rows.
2. **AI fights.** The client inserts one row per finished fight, win or loss, for a signed-in fighter. Rate-limit it like `fight_records`. Guests keep a local mirror only.
3. **Duels.**
   - The relay (server, service role) writes the row for BOTH players when a duel settles, so a client can't fake a duel win.
   - It must honour the settled result only. This is #1347 Auditor F2: no desync claim after a settled finish. That fix lands first or together with this.
   - The opponent's name, level and gear come from the kit both sides already exchanged in the lobby (`peerKit`).
4. **Read API.** One query each for the Pit:
   - AI: per opponent, ranks beaten plus wins and losses.
   - Duels: the players beaten (latest first, capped at ~30), each with name, level, gear, date, and the head-to-head win/loss.
5. **Migration rule.** The Supabase migration names have differed from the repo files since 10-01, so run `supabase migration repair` before any `db push`. Dom approves applying a migration to production.

## Part B: the wall (World, Pit & Audio)

1. **Left panel: computer opponents.**
   - One skull per opponent beaten at any rank, so at most 10 on this panel. Unbeaten opponents stay empty niches.
   - Tap a skull: the list of opponents, each with portrait, name, ranks beaten, and wins/losses from part A.
2. **Right panel: real players beaten in duels.**
   - One skull per player beaten, latest first, up to the panel's slots.
   - Tap a skull: their name, level, gear (paperdoll icons), when you beat them, and your record against them.
3. **Fallbacks.**
   - Guest or offline: the left panel falls back to `loot.defeats` as today.
   - The right panel shows empty niches with one line: "Beat a real player in a duel to hang their skull here."
4. **Keep it cheap.** One instanced draw per panel, as `wall.ts` does now. The sheet is the existing bottom sheet; no new panels over the arena (Dom has rejected those twice).
5. **Preview data.** On the `?look=` preview with no account, seed a few fake rows behind a `&skulls=demo` flag so Dom can judge the look before real data exists. Never do this in the default path.

## Process

- Flag-only on the preview first (skill look-test). Phone stills at **390×694**, read at full resolution.
- Ask Lead for `/preview/pit-cage/` from your sha. Open it on frankendom.com yourself before Lead sends it to Dom.
- **Gotcha:** a `//` comment pasted mid-line has swallowed code twice on this branch. Put comments on their own line.

## Done when

- Dom taps the left wall and sees his computer opponents with wins/losses.
- After a real duel win, that player's skull is on the right with their name, level and gear.
- Records come from Supabase for a signed-in fighter. The duel rows are written by the relay, not the client.
- tsc is clean and the targeted gate passes. The migration is reviewed by the Auditor before Dom approves it for production.
