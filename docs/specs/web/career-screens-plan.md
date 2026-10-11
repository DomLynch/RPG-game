# Career screens (Web, core slice 2): plan

Contract read: Backend's slice 2b (#2172, live since BA2): `pit_ladder` (50 rows, public read), `scorecard_rows()` (invoker RPC), `scorecard_notes` and `control_trials` (own-row tables, cosmetic), `leaderboards(p_limit)` (definer RPC, authenticated only, duel rows only, never kind='ai'). Model: `src/core/career-model.ts`, `src/core/career-ladder.ts` (#2171). Nothing reads them yet (docs/state/backend.md, "Open / Monday" 1). Rule: screens call core only, never the save server or Supabase directly (boundaries C6/C7).

## Slices (one draft PR each, in this order)
1. **Career (ladder + scorecard).** `src/core/career-client.ts`: `readScorecard()` (scorecard_rows()) through the core door; the ladder is drawn from `career-ladder.ts` (pit_ladder is pinned to `rankFor` by a test, so no read); signed out or offline falls back to the device's own scorecard (src/scorecard.ts stays until the server read has a receipt, then the duplicate is deleted; nothing a player has is lost). Screen `src/career-screen.ts` in the ☰ Profile pane (Pit) and the same pane of the zone page: the 50-rung ladder with the player's rung marked, the scorecard table (fights/wins/losses per opponent).
2. **Leaderboards.** `readLeaderboards(limit)` (authenticated); signed out shows "Sign in to see the boards" (no empty table). Same pane, own tab.
3. **Profile.** Account line, career level, gear/bank links already in core (#2166).

## Rules for every slice
- Layout: portrait AND landscape (iPhone 844x340, notch insets, iPad) checked by `scripts/landscape-check.mjs` (#2159) with the new screen open; no overlap.
- Tests: client unit tests with a stubbed RPC (no live box state), red -> green per behaviour; a boundary test that the screen imports only `src/core`; VPS receipt for the head, stills at 375 (HF T4).
- Server-pending/failed states are drawn (loading, signed out, error + retry), never an empty table.

## Open questions (Lead / Backend)
- Which client does the core use for `pit_ladder`/`scorecard_rows`/`leaderboards`: the Supabase REST client the session already holds, or a writer op? (src/core/writer-call.ts speaks to the writer; the new objects are Supabase RPCs.)
- Is the leaderboard `display_name` already moderated, or do we show it as returned?

## ETAs (from the plan's approval)
Slice 1: client + screen + tests + receipt ~4 h. Slice 2: ~2 h. Slice 3: ~2 h. Stops at the weekly-quota card (drafts).
