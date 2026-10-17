# Beta launch-gate audit, 2026-10-17 (Backend, read-only)

Asked by Lead: judge every gate in `docs/specs/origins/launch-gates.md`, plus the guest acceptance list (SCOPE.md, 2026-10-16 17:55, items 1–4), against what is LIVE now.
**Live sha: `05a39ccce640d74d01bc847c4d88197674126cb0`** (release IE; `release.json` read 19:5x +04; presence and the writer both on it, NRestarts 0).

Verdicts: **MET** (with a receipt), **OPEN** (what is missing, who owns it), **OBSOLETE** (superseded by a later SCOPE line or ruling, named).
No code, no gate row edited, nothing written to production. If a receipt is a test, it is re-run at the live sha (a trunk checkout of `05a39ccce`) and the count is given.

## How this was checked

- **Database** (hosted project `rxbewmzmovelckzoosss`, read-only SQL: catalog lookups, row counts, config keys; no player data read): `list_migrations`, `pg_proc`, `pg_trigger`, the `origins_events` kind check, `origins_config`.
- **VPS** (read-only): `stat` and the `ORIGINS_*` flag names of `/etc/frankendom/origins-writer.env` (no values printed), the nginx snippet, `systemctl show`, the deployed trees.
- **Live route**: `POST https://frankendom.com/origins/consume` with no token.
- **Disposable real Postgres on the VPS** at `05a39ccce` (`su postgres`, `PG_BIN=/usr/lib/postgresql/16/bin`): `scripts/origins-trade-limits-check.mjs`, `origins-trade-lock-check.mjs`, `origins-trade-check.mjs`.
- **Tests at `05a39ccce`** (`node --test tests/<name>.test.ts`): the files named in each row.
- **GitHub**: PR state and merge dates.
- **Not done**: no browser walk-through of any gate, no authenticated call to the running services, no phone or load run. Where a verdict leans on that, it says so.

## Tally

| Section | MET | OPEN | OBSOLETE |
|---|---|---|---|
| Player trade (G1–G6) | G1, G2, G5, G6 | G4 | G3 |
| Writer route (W1–W4) | W1, W2, W3, W4 | — | — |
| Exchange-only (X1, X2) | X1, X2 | — | — |
| Flag GO (F1, F2) | — | — | F1, F2 |
| One-shard / chat (S1–S4) | S3 | S1, S2 | S4 (pending Lead's confirmation that chat is out of beta) |
| Patrons (P1–P5) | P1 | P4, P5 (see the note: only if patron perks act in the arena at beta) | P2, P3 |
| Pre-launch wipe (R1) | — | **R1** | — |
| Guest acceptance (1–4) | 1, 2, 3 | 4 | — |

**Beta-critical OPEN: R1 (the pre-launch wipe) and guest item 4. Everything else OPEN is either not needed for the beta scope (S4, P4, P5, trade) or a measurement (S1, S2).**

## Player trade

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| G1 | **MET** | Migration `origins_trade_limits` is applied (version `20261007043358`); `origins_trade_limits()` and `origins_trade_counts()` exist; `origins-trade-limits-check` **75 checks pass** at the live sha. |
| G2 | **MET** | Trigger `origins_trade_cooldown_guard` is live on `origins_items`; `origins-trade-lock-check` **15 pass**, `origins-trade-check` **94 pass** (disposable real Postgres, live sha). Config row `trade_cooldown` = first 259200 s, steps 604800 / 1209600 / 2592000 (the same numbers as the `cadence-rules.json` rows). |
| G3 | **OBSOLETE** | Already closed in the file: there is no tradeable scope (Strategy, 2026-10-07). |
| G4 | **OPEN** | Dom's answer on the per-account caps is not recorded anywhere I could find. Live config: `trade_caps` open 1, pieces 20, settled 10 per 86400 s. **Scope tension to rule on first:** live `trade_gates` require `min_career_level` 11, account age 7 days and Origins age 2 days, while the beta ladder is levels 1–2 (SCOPE, 2026-10-16 ~23:00), so player trade is unreachable at beta as configured. Lead or Strategy should say whether trade is in beta; if not, G4 and the trade section close as post-beta. Owner: Dom (via Strategy). |
| G5 | **MET** (one record not found) | `origins_trade_reversal` is applied (`20261007044401`, Auditor PRE and POST per `backend.md` 2026-10-08); the `origins_events` kind check contains `trade-reversal`, `trade-hold` and `metal`; `origins_reverse_trade()` exists. **Not found:** Dom's "yes naming the sha" that the gate asks for; the state docs say it was applied that morning but do not quote his word. Low risk; Strategy can add the line. |
| G6 | **MET** | `origins_config` holds no `trade_cooldown_scope` key (keys read: `trade_cooldown`, `trade_caps`, `trade_gates`, `trade_hard_expiry_s`, `trade_idle_expiry_s`, `origins_enabled`, `origins_open_to_all`). Live trades so far: `origins_trades` has **0 rows**, so no player trade has run in production. |

## Writer route

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| W1 | **MET** | `POST https://frankendom.com/origins/consume` with no token answers **401 `{"ok":false,"error":"sign in"}`**. The nginx snippet `/etc/nginx/snippets/frankendom-origins-writer.conf` proxies `^/origins/<op>$` to `127.0.0.1:8788`, POST only, `limit_req` 5 r/s burst 10, body cap 64k. `frankendom-origins-writer` active since 19:48:10 +04. |
| W2 | **MET** (indirect) | The writer holds database access: `origins_events` carries `mint` and `mob` rows, which only the writer role writes, and it restarted clean on three releases today. I saw no `frankendom_origins` session at the instant I looked (the pool is lazy), so this rests on the written rows, not on a live connection. |
| W3 | **MET** | `stat /etc/frankendom/origins-writer.env` → `600 root:root`. |
| W4 | **MET** | Env flags `ORIGINS_ENCOUNTERS=1` and `ORIGINS_REWARDS=1`; no allowlist key in the file (grep count 0); `origins_config` has `origins_enabled` true and `origins_open_to_all` true. |

## Exchange-only rules (X1, X2)

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| X1 | **MET** | #1593 merged 2026-10-07; its forged-place tests are in `tests/origins-writer-upgrade.test.ts` (**10 pass**) and `tests/origins-presence-spawn.test.ts` (**6 pass**) at the live sha. |
| X2 | **MET** | Stage 1: #1577 merged 2026-10-07 (spawn at the Pit yard centre, no first-pose placement, reconnect memory); `origins-presence-spawn` **6 pass**. Stage 2: `origins_character_location` is applied and holds 1 live row; `tests/origins-writer-location.test.ts` **9 pass**. The "jail, bounty, feud or duel state overrides the saved spot" clause names states that do not exist in the beta scope, so it has nothing to attach to today. |

## Flag GO

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| F1 | **OBSOLETE** | Superseded by Dom, 2026-10-08 ("keep everything ON"; flags are a kill switch, never a staged switch-on) and by 2026-10-16 17:55 ("Zone 1 is open to everyone"). Live config agrees (`origins_open_to_all` true). |
| F2 | **OBSOLETE** | The same two rulings are Dom's GO for everyone. |

## One-shard / chat

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| S1 | **OPEN** (small, Backend) | A measurement exists in `docs/state/expansion.md:178` (#1510: 100 bots = 8.6% of one core, about 1,000 players per host worst case), but it is not the gate's proof: no report with a sha, and `one-shard.md` still marks its figures *est.* The close is one 100-bot run of `scripts/presence-loadtest.mjs` on the VPS against a local presence instance, the report posted with the sha, and the *est.* figures replaced in a docs PR. Backend can do this on a spare core; it is a measurement and a doc edit, not a code change. |
| S2 | **OPEN** | The gate asks for a physical iPhone 12 and Pixel 6 (desktop emulation does not count) and no phone number exists. World's crowd harness (`docs/state/world.md`, handoff #55, 2026-10-16 late; #2931, `scripts/crowd-t4.sh`) has a proxy: on a T4 GPU, undressed figures hold 60 fps at 0 / 8 / 16 / 40 at 1x CPU on #2929; at 4x CPU throttle 8 players = 30 fps, 16 = 20, 40 = 15 idle / 12 walking, and World's own verdict is "S2 (40 at 30) is NOT met on a throttled CPU; about 8 full figures is the 30-fps point there". The on-phone page (#2935, `?crowd=16`, `&crowd=30`) was a draft waiting on #2929 when I read it (I did not re-check its state today). Owner: Web & UI and World for the page; the phone number is Dom's. The practical close is to ship the adaptive near-full-count cap (rows) and read it on Dom's phones. |
| S3 | **MET** | #1558 merged 2026-10-07; `tests/origins-presence-borders.test.ts` **4 pass** at the live sha. |
| S4 | **OBSOLETE for beta, if Lead confirms chat is out** | There is no chat in the game: the presence server closes any socket that sends a text frame ("speech, when it exists", `origins/presence/server.ts:282`), and SCOPE's beta list does not include chat. The gate stays closed until chat ships, and it still must close before chat does. Lead: please confirm chat is not in beta. |

## Patrons in the arena

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| P1 | **MET** | Already closed in the file with release receipts. |
| P2 | **OBSOLETE** | The hook shipped at a record version far below today's 74 (`PATRON_VERSION` 32 in `src/fight/record.ts`, not 28), and every record bump since is guarded by `tests/record-version-guard.test.ts`, which pins the sim digest. The "bump to 28" wording is stale. |
| P3 | **OBSOLETE** | The verifier decodes the live record version: `frankendom_verifier` holds a database session and the daily and loot verifier timers are active. The "v28 decoder" release order is moot at RV74. |
| P4 | **OPEN, conditional** | I found no patron battery report. This only matters if patron perks act in arena fights at beta; `living-world.md` says a clan is identity only in the arena until P2–P5 close. Owner: Combat. **Combat should say whether patron perks are on in beta.** If they are not, P4 and P5 stay closed by design. |
| P5 | **OPEN, conditional** | Same as P4 (the win-rate-by-patron check before and after release). Owner: Combat. |

## Pre-launch wipe

| ID | Verdict | Receipt, or what is missing |
|---|---|---|
| R1 | **OPEN, beta-critical** | The tooling exists: `origins_beta_wipe()` is applied (migration `20261008175653`). The wipe has **not run**: production still holds 2 characters, 33 items, 12 events, 1 metal row and 1 saved location (counts read today). Still needed before the run: the `pg_dump` of exactly the reset tables and one tested restore into a scratch database (no record found that either happened), the Auditor's PRE on the script and POST on the run, the joint Lead + Strategy GO, Dom's own word for the run date, and Dom's answer to the open question "does R1 also wipe the duel ladder" (the file's text keeps the Pit and duel tables and marks claims consumed). Owner: Backend writes the dry-run, backup and restore receipts; Dom names the date. |

## Guest acceptance (SCOPE.md, 2026-10-16 17:55)

| # | Verdict | Receipt, or what is missing |
|---|---|---|
| 1. A guest fights the same NPCs, sees other players, picks up loot for the session | **MET** (by tests; not browser-walked) | `tests/origins-presence-guests.test.ts` **7 pass** (a guest joins with no token and sees and is seen by a signed-in player); `tests/origins-guest-loot.test.ts` **4 pass** (a guest kill pays the server's table, seed and level for every Zone 1 creature with loot; the bag holds the session's loot in memory); the ground pickup has a guest take (`origins/preview/ground-pickup.ts`, label "You take the {item}. Sign in to keep it."). |
| 2. "Sign in to keep it" is a one-line nudge, never a modal or a block | **MET** (by tests) | `origins/preview/kill-text.json` `guestLoot`: "{paid} (sign in to keep it)."; the guest-loot test checks the toast shows the nudge and never CP, and falls back to the plain nudge when nothing rolled. |
| 3. Guest kills and loot reach no leaderboard, ledger or persistent row; the guest token has the same rate caps | **MET** | `guest-loot` test: a guest kill writes nothing (no storage, no network, no clock). `tests/origins-guest-guard.test.ts` **4 pass**: every writer route refuses a guest (401, no handler runs, the database is never touched). Presence: a guest has no position save, no 10-minute memory and is never found by `/internal/where` or `/internal/rejoin`. Caps: the per-address guest cap is lower than a signed-in player's and there is a global guest ceiling of 64 (`presence-rules`). |
| 4. Signing in mid-session keeps what the guest holds if cheap; otherwise the sign-in screen states the loss before the tap | **OPEN** | I found neither: no code or test that carries the guest bag across a sign-in, and no sign-in copy that states the loss (searched `origins/preview`, `src/account.ts`, `kill-text.json` and the Web and World state docs). Owner: Web & UI. Either one counts, and the cheaper is the copy. |

## The OPEN list, in the order Lead needs it

1. **R1 pre-launch wipe** (beta-critical): dry-run, backup plus tested restore, Auditor PRE/POST, joint GO, Dom's date, duel-ladder answer. Backend prepares the receipts.
2. **Guest item 4** (beta-critical): sign-in keeps the bag, or the sign-in screen says what is lost. Web & UI.
3. **Trade scope** (G4): trade needs career level 11 and the beta ladder is 1–2. Rule trade in or out of beta; if out, the whole trade section is post-beta. Lead, Strategy and Dom.
4. **S1 100-bot load run**: Backend, one VPS run plus a docs edit.
5. **S2 40-character phone render test**: World's T4 proxy says 40 figures do not hold 30 fps on a throttled CPU (about 8 full figures do). Needs the adaptive cap shipped and Dom's iPhone 12 and Pixel 6. Web & UI, World, Dom.
6. **S4 chat**: confirm chat is not in beta, then the gate is moot until chat is planned. Lead.
7. **P4/P5 patron batteries**: only if patron perks act in beta arena fights. Combat to say.
8. **G5**: add Dom's recorded "yes" for the 0008 apply to the gate row. Strategy.
9. **Housekeeping**: the statuses in `launch-gates.md` itself are stale (G1, G2, G5, W1–W3, X1, X2, S3 all read "open" or "merged" in the file). A docs PR can copy this table's verdicts into it once Lead approves.
