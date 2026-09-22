# Stats, damage and defence — lane state

Lane opened 2026-09-22 on Dom's word ("yes for stats, if we're going to do it, let's do it properly"), brief 19
(`docs/briefs/gear-stats.md` on `origin/briefs/gear-stats`, PR #486, not yet merged). Worktree `~/Developer/frankendom-stats`,
reports to Lead; Strategy reviews every PR body before Lead merges.

## Now

Deliverable 2 — the loadout in the fight record. `FightRecord` gains both sides' four multipliers, `RECORD_VERSION` bumps,
pack/unpack round-trips, the replay verifier replays with them, daily and kill-link fixtures are re-recorded, and a naked
loadout replays **byte-identical** to today's records behind a flag. `src/gear-stats.ts`'s `NAKED` is the identity that claim
is proved against.

Before starting it, rebase `stats/lane` onto a trunk where `src/arena.ts` compiles (see Gotchas).

## Done today

**2026-09-22 — Deliverable 1, the tier stat table (`src/gear-stats.ts`, `tests/gear-stats.test.ts`). Data and tests only; no sim
change, and `src/loot.ts`'s "visual cosmetics only, no stats" header still stands.**

One number per tier per slot, as the brief asks. The number is a slot's **coverage weight** (Helmet 20, Body 30, Greaves 18,
Arms 12, Boots 12, Gloves 8, Crest 0 — summing to 100), scaled by the tier's place on the ladder *above the bottom rung*:
`(levelOf − 1) / 9`. A full set at Origin is therefore exactly 900 points, and the four multipliers are integer divisions of it:

| stat | from | formula | naked | full Origin |
|---|---|---|---|---|
| Attack | the one weapon slot | `(90000 + 15·p) / 90000` | 1 | **1.15** |
| Defence | the six armour slots | `(90000 − 20·p) / 90000` | 1 | **0.80** |
| Poise | the same six | `(90000 − 25·p) / 90000` | 1 | **0.75** |
| Stamina | the same six | `(90000 + 25·p) / 900` | 100 | **125** |

Because every cap is a whole set rather than a fitted constant, the Origin row is *exactly* on the caps — and **both** ends of the
ladder are exactly the identity: no gear, and a full Recruit set. Strict equality throughout, not a tolerance.

**A full Recruit set carries nothing** (Strategy, 2026-09-22, overturning this lane's first cut, which had rags at a tenth of a cap,
and Lead's first reading, which agreed with the first cut). Brief 14's Recruit is rag & scrap on 2 of 6 slots — salvage, not armour —
and the naked bracket is only a real guarantee if the new player actually standing in rags is inside it. Legionary leather is the
first tilt in the game.

Numbers re-derived here rather than inherited: the six slot weights are this lane's, invented for this table and defensible only
as coverage judgement. The linear ramp was this lane's too; its zero point is Strategy's. The four caps, the ten tiers and the six
armour slots came from brief 19 and Brief 14 and were each checked against the code — `TIERS = career.ts TITLES`
(`src/grades.ts:14`), ten rungs with Origin at level 10, and `ARMOUR_SLOTS` at `src/loot.ts:10` carrying **seven** entries, Crest
included.

14 tests, all passing; full suite 480 pass / 0 fail. Mutation-proved rather than merely green: Helmet 20 → 21 fails 8 of the 14,
Crest 0 → 1 fails 9, and reverting the ramp to `levelOf` fails 9.

One note on that proof, because it is the trap and not the result. The ramp mutation first reported **0 failures**, which would have
read as "the tests do not guard the ramp". They do. The probe was `perl -pi -e 's/(levelOf(tier) - 1)/levelOf(tier)/'` — perl read
the parentheses as capture groups, so nothing was ever substituted and a no-op scored as a clean pass. A mutation proof that cannot
show its mutation landed is the same species of check as the ones it exists to catch; the rerun asserts the source actually changed
before running the suite.

## Open

- **A piece has no tier yet, so nothing can resolve a real player's kit.** `LootId` is `<opponent>.<slot>` with no tier in it,
  and `GradeRecord` (`src/grades.ts:74`) is declared but `OPPONENTS` carries no `grade` field on becec83 — `grep -n
  "grade\|tier" src/roster.ts` returns nothing. Deliverable 1's API therefore takes `(tier, slot)` pairs directly. **Lead owns
  landing the grade record onto OPPONENTS**; until then this table is data with no caller, which is what deliverable 1 should be.
- **Decision on the record (lead, 2026-09-22): Defence and Poise share one armour total for beta**, so no piece is heavy but
  soft. At a ≤25% ceiling the difference is under the noise floor and a second column would double the tuning surface. The
  hedge is that all three armour multipliers are derived inside a single private `multipliers()` function, so a split later is
  a second weight column and three changed lines, not a rewrite.
- **Settled: the bottom rung is the zero point.** Flagged as a design claim rather than buried in arithmetic, argued, and
  overturned within the hour — which is the whole value of separating the two. The ramp is `(level − 1) / 9`.
- Deliverable 5 (the seam in `src/duel.ts`, opponents wearing their tier, the ladder retune) is **blocked by Lead** behind
  Combat's queue: knife approach fix, Executioner profile, Nightborn retune, shield rule. Stats never jumps the four weapons.
- Deliverable 3 (server-authoritative awards) needs Backend's review and Deploy's apply; loot stays cosmetic in play until it lands.
- Format constraint received from Web via Strategy for deliverable 4: the loot card has five 56 px tiles in one row at 375 px
  with no room inside a tile, so the take's delta gets its own line as short signed values per stat (`+3 DEF  +2 POI`), not a
  sentence.

## Gotchas

- **Trunk becec83 does not compile, and the red is not yours.** `src/arena.ts:446` reads `get guards() { return
  lorarii.standing; }` after #467 deleted the lorarii, so `npx tsc --noEmit`, `npm run build` and `npm run quality:stop` all
  fail with `TS2304: Cannot find name 'lorarii'`. Four lanes had already re-diagnosed it before this lane opened. World's #485
  is the one-line fix. Do not spend a minute on it; do not trust a local gate until it lands.
  Receipt that it is the *only* break: both `npx tsc --noEmit` and `npm run typecheck:tests` return that single error and
  nothing else, and with the line locally stubbed to `get guards() { return { built: 0, of: 0 }; }` — a throwaway probe,
  reverted, `git status --porcelain src/arena.ts` empty afterwards — both come back completely clean.
- **Never write a multiplier as the obvious float.** `1 − 0.25 · 390/900` is `0.8916666666666666`; `(90000 − 25·390)/90000`
  is `0.8916666666666667`. 74 of the 900 reachable armour totals drift this way. This is not pedantry borrowed from a doc — the first version of the mixed-kit test was written the naive way and
  failed against the module, which is why `tests/gear-stats.test.ts` now pins both forms. A paperdoll rounds it away; a
  1500-tick fight does not, and that is what the arm64/x64 digest rule exists to stop.
- `src/gear-stats.ts` is deliberately **not** in `eslint.config.js`'s `SIM` list and never needs to be. The sim takes a
  `Loadout` — the four resolved numbers — and never sees a tier, a slot or a table, which keeps `src/duel.ts` free of any
  import of `loot.ts` or `grades.ts` that `tests/sim-boundary.test.ts` would refuse.
- A zero-weight slot and an omitted slot behave identically today and diverge the moment the slot carries something: the
  omission silently under-weights every set while the total quietly stops being 100. Hence `Crest: 0` as an explicit row, with
  a test that says so.
- The worktree ships without `node_modules`; `npm ci` first or every gate reports the tools as missing rather than as failing.
- **A mutation probe must prove its own mutation landed.** `perl -pi -e` with parentheses in the pattern silently matches nothing
  and the suite then passes for the wrong reason. Assert the source changed, then run.
