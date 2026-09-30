# Career — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## AFK fights run on — career lane, 2026-09-20 (owner: "nothing more, nothing less, the game continues as if")
Leaving a live fight (tab hidden, phone call, lock screen) no longer freezes it in the player's favour. The browser cannot run the
fight while hidden, so the hidden time is owed to the fight and simulated on return with no input (`owed` in `main.ts`, both clocks
read, 300 s cap): the player comes back to the fight they would have lost standing still — no hit-stop, no per-hit sound or number
while catching up, the killing tick still plays its sound and the death is the first picture drawn. A fight abandoned by closing the
page is scored as a loss on the controls card at the next boot (`frankendom.fight.v1` marker set on the first live tick, cleared when
the result is recorded). Journal and welcome still pause; hidden time only counts while a fight is live.
Evidence: graphics harness test (hidden 120 s → idle fighter dead on return; seeded marker → 1 fight 0 wins at boot); eslint + tsc
clean; full `npm test` and `test:browser` receipts recorded in the PR (the browser gate is wall-clock timed and flakes under load).

## Career marks — career lane, 2026-09-20 (owner decision: marks on the Google account via Supabase)
Every won duel awards one victory mark on the device (`awardMark` in `src/career.ts`, called once per fight in the same block that
records the practice tally); rank is a pure function of the count per GAME_SPEC's ladder (3 marks per sub-rank for Recruit and
Legionary, 5 from Gladiator, Origin at 205) and shows in the identity aside (`#rank-sigil` numeral, `#rank` label with pips).
Cloud save carries `victory_marks` (migration `202609200004`, integer 0–100000, owner insert/update grants, default 0); Load keeps
the higher of device and cloud so marks never fall. Client-reported beta data, never competitive rank authority (table comment).
Evidence at this head: eslint + tsc clean; full `npm test` 314/314 (graphics harness now maps `./career.ts`; rank render asserted at boot); `account-database-check` PASS on a disposable PostgreSQL 17 with all four migrations (marks writable, −1 and 100001 rejected);
build + audit 0 + budget PASS (30,098,480 gzip of 32 MB; per fight 9,807,338 of 12 MB); `account-browser-check` passed (POST/PATCH
bodies now carry `victory_marks`; cloud 80 lifts device 77; save echoes 80); `test:browser` passed. Hosted project: the migration is
applied by the career lane through the Supabase MCP before the lead deploys (additive; the live client ignores the column).
Remaining: rematch loop after the last rung and the beta roster cut are the lead's; automatic save after a win for signed-in
players is a follow-up (v1 syncs on the explicit Save/Load buttons only).
