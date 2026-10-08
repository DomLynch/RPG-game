# Backend & Accounts — project state

One truth for the hosted Supabase project (`rxbewmzmovelckzoosss`) and the migrations under `supabase/migrations/`. Owned by the
Backend/Accounts lane; every migration from any lane gets this lane's "apply-ready" review before Dev/Deploy applies it at the deploy
that carries the client change, and this file is re-verified against the hosted project after each apply. Append new entries at the
TOP. "Verified" below means this lane's own query output (Supabase MCP `list_tables` / `list_migrations` / `execute_sql`), never a relay.

## 2026-10-08 (evening, ~19:45 +04) — HANDOFF before /clear: writer 6a97dcb3 + key rotated; DETACHED ZONE 1 is the new top item
**READ FIRST:** lane memory `frankendom_world_spawns_plan_2026-10-08.md` (the plan + the shapes World builds against, verbatim), then `frankendom_backend_handoff_2026-10-08_pm.md` (NOW blocks), `frankendom_pvp_slice1_map_2026-10-08.md` (PvP, PAUSED).
**Now (in order):**
1. **Wolves writer reinstall** at fold 21 = `c10c5b6b5` (#1859 merged c801b4b8; writer delta = wolf row + `loottable:ash-wolf` only). Lead GO stands; waits ONLY on the Auditor PRE naming c10c5b6b5 (asked on #1859). Then: sha before, `install-origins-writer.sh c10c5b6b`, read-back (current, NRestarts 0, flags + `ORIGINS_WRITER_INTERNAL_KEY` sha8 0498c049 via `/root/work-pose/env-readback.sh`, unauth 401, tree parity), Auditor POST. Rollback: `current` -> 6a97dcb3.
2. **#1818 apply (migration 0011)**: Lead + Strategy GO posted; NOT merged yet (Lead asked Deploy for the next fold). Apply at the MERGE sha via the out-of-order path (0011 sorts before applied 0012), read-back table + RLS + EXECUTE, Auditor POST. close('beta') is NOT part of it (launch-checklist pre-launch wipe). Before snapshot 17:07: last version 20261008105731, no duel_season_ratings, 0 duel_season fns, duel_ratings 0.
3. **DETACHED ZONE 1 (top build item, Strategy/Dom 2026-10-08 ~19:00)**: server-owned spawns + single-use engage (per instance, ≤4/account, token lives 120 s after LAST touch) + kill report (consumes, marks dead, loot server-side) + second lines (presence distance, TTK floor on issued_at, hit floor, kills/min+/h caps) + BETA ledger with wipe + test. **PR A** (migration 0014 spawns/engages/config + writer ops spawn_state/engage/touch/kill_report) **Fri 2026-10-09 12:00**; **PR B** (0015 beta ledger + `origins_beta_wipe` + test) **Fri 17:00**; Auditor PRE Fri; apply + install BOTH Sat AM. Shapes already sent to World (in the memory file).
**Done today (evening, receipts on the PRs):** #1852 encounter_start pose merged (fold 19) + writer installed 6a97dcb3 at 17:01 with `ORIGINS_WRITER_INTERNAL_KEY` ROTATED (printed by a bad ad-hoc redaction at 16:4x; new sha8 0498c049 both env files; receipt #1852 6060452566). Redaction fix #1863 `ops/env-readback.sh` (Auditor PASS). #1859 wolves loot ruled + merge go (6060683060). #1865 World prefetch: server PASS @26ea6150. #1764 online-default ready @c45003b3 (superseded by #1865's stack). #1818 trunk merged @338ca62e (Auditor delta PASS).
**PAUSED (drafts, do not merge/apply):** #1866 legal pose, #1868 + migration 0013 (world no-loss / derived seed), the PvP plan (slices 1-4 dates are void until Strategy re-plans on the detached loop). Kill-reward path #1767/#1768 stays live until the replacement ships.
**Watch:** cron (session-only; re-arm after /clear) counting verified `won` vs `abandoned` mob events; Sentry stale-session count = the owner of src/monitoring.ts (no Sentry access here); nginx `/_e/zone1-*` beacons countable from the VPS access log after the Play flip.
**Gotchas (new):** never print env values: use `ops/env-readback.sh` (presence/len/sha8). Writer roles have NO table privileges on encounter tables: every token/sweep change is SQL. A free cancel of an unplayed token = seed shopping (Auditor). Lead's socket path changes on restart: use ListAgents name `[ref]`. VPS scratch: /root/work-pose (rotate-install.sh, env-readback.sh, backups /etc/frankendom/backups/*.20261008-170116), /root/work-1764, /tmp/wnl.

## 2026-10-08 (afternoon, ~15:15 +04) — HANDOFF before /clear: 0006, 0012, 0007 applied + POST PASS; writer 7beb748e
**READ FIRST:** lane memory `frankendom_backend_handoff_2026-10-08_pm.md` (NOW block at its top). Short form:
- **Live:** fold 13 = 7beb748e; writer `/opt/frankendom-origins/7beb748e` (ENCOUNTERS=1, REWARDS=1). Migrations applied today with Auditor POST PASS: 0006 respawn window (v20261008084659), 0012 shop stock (v20261008103908), 0007 boar (v20261008105731). Prod still 0 mob events (a 30-min watch posts the first real kill's read-back, unnamed).
- **Open PRs:** #1824 Region 1 shop, #1828 NPC rows, #1838 shop presence check, #1831 shop gear (after #1838), #1833 serial write queue, #1837 bronze in open, #1813 engage state, #1818 + #1834 season close (run only under Lead + Strategy GO), #1805 rankings (0009 under its GO), #1799, #1807.
- **Rulings:** Dom 12:5x everything live and ON (DB/money steps keep PRE/GO/POST); never sign in for Dom or ask him to playtest; boar loot = #1847 @2bc682db (merge go given); heavy VPS jobs only via `lanejob`/`capture`.
- **Gotchas:** origins_events.kind has a CHECK list (reuse 'metal' for bronze spends); the conservation trigger refuses direct origins_metal updates; `gh pr edit --body-file` with an empty file wiped a body once (check the length after); zsh `$T:path` is a modifier, write `${T}:path`.

## 2026-10-08 (midday, ~11:50 +04) — HANDOFF before /clear: rewards + stances + BRONZE LIVE (writer f8632f62); #1793 next
**READ FIRST:** the full handoff is the memory file `frankendom_backend_handoff_2026-10-08_midday.md` (lane memory). Short form:
1. **#1793** (0006 respawn window in DB) @acd1e188: Lead's GO half posted (conditional on green CI + Auditor delta at acd1e188 + Strategy's GO); delta + Strategy GO asked. Then merge → sha to Lead → apply 0006 → reinstall → POST.
2. **Duel hold**: Lead approved the DATABASE design per ROOM, cap 35 min (30 min record cap + 3 min forfeit + 2 margin), migration 0010; arena entry = report_duel_start (class 2 to change).
3. Set schema → swap op → PvP-flag roll (after Combat) → save-unify note → write queue → R1.
**Live:** writer f8632f62 since 11:33:08 (REWARDS=1); 0004 applied v20261008073128 sha 54cabcf3…9f04e; Auditor POST PASS. Prod 0 mob events (live kill checks wait on Dom's first fight).
**Rulings:** coached fights (PvE and PvP duels/ladder/rankings) count and pay exactly like played ones: no path may read a coach flag (0 today).
**Open PRs:** #1793, #1805 (0009), #1799, #1780 (needs presence install). Migrations: 0006 #1793, 0007 boar, 0008 bear, 0009 #1805, 0010 next free.

## 2026-10-08 (late morning, ~10:30 +04) — KILL REWARDS LIVE (writer 87b7a63b + ORIGINS_REWARDS=1), #1791 urgent, bronze next, respawn window in DB
**READ FIRST / Now (in order):**
1. **#1791** (stance fights verify with their pick; Auditor PRE PASS @b4b2f655, CI green): LIVE-URGENT (stances ON + REWARDS=1: a stance world fight settles as an unverified loss). Asked Lead + Strategy for the GO, Deploy to merge. Then reinstall the writer at that trunk sha (REWARDS=1 kept), one Auditor POST. Rollback: `current` → 87b7a63b.
2. **#1768 bronze** @271a82de (ready, trunk 341af6f4 merged; Strategy GO 6053002451 + Lead's half given on the Auditor's PRE; delta naming 271a82de asked). One step: Deploy merges → apply 202610080004 (statements sha 54cabcf33eec31cd…) → reinstall at that trunk sha → one POST. Migration rollback = supabase/down/202610080004_origins_metal_of_down.sql.
3. **#1793** respawn window in the DB (migration 202610080006 origins_last_paid_kill; stacked on #1768, base backend/metal-of; Auditor PRE PASS @8bc1698c): per-creature `respawnSeconds` (Characters' field), else 300 s; supersedes #1786 (closed). After #1768: retarget to trunk, apply 0006, reinstall, POST. Lead: the PRE must cover each part; rollback note names the down file.
4. **#1780** position save @d9157eaf (Auditor PASS, M1 fixed): web-only release (told Deploy); takes effect at a separate presence install (own PRE/GO/POST). Follow-up: writer refuses a location `at` older than the active character's switch (SQL).
5. Then: R1 pre-launch wipe script (table list in launch-gates.md #1782; Dom's call pending on the duel ladder), loot no-drop weight (OpenDiablo2 item_factory.go:198, study + rewrite), the per-character serial write queue (donor-save-study.md:148-163), Frontier frame in presence (gates ?region=1).
**Done today (receipts on the PRs):** writer 87b7a63b + REWARDS=1 installed 09:39:26 +04 (#1727 6053177256, 60 s re-read 6053256855, Auditor POST 6053276158): a verified kill pays CP + loot in one settle transaction; checks 3/4 (pays once, retry 409) close at the first real kill (Dom's). Web moved to c98457c9 then 341af6f4: the writer's 79-file closure unchanged since 87b7a63b (6053326078). #1767 merged b13ac02d. Bear loot ruled on #1787 (verbatim @e7ec2c05). Stances answer to Lead: Pit claims pay; duels n/a; world fights only after #1791.
**Migration numbers (20261008):** 0001-0003 trunk, 0004 metal_of (#1768), 0005 open_to_all (APPLIED), 0006 last_paid_kill (#1793), 0007 boar (#1778, Combat renumbering), 0008 bear (#1783).
**Rulings (memory):** Dom 08:37 valuables = one all-or-nothing transaction + one-time token + 409 retry; Dom 09:3x keep everything ON, flags are kill switches, one PRE + GO + POST per install.
**Gotchas:** this session runs in a `.claude/worktrees` checkout: work there or in scratchpad worktrees, never write in ~/Developer/frankendom-backend. `sleep` is blocked: use a background until-loop. Mac gate defers during deploys: run tests/tsc/gate/PG check on the VPS (fresh clone, `npm ci --ignore-scripts`, `runuser -u postgres` with PG_BIN for the PG check, delete /root/work-* after).

## 2026-10-08 (morning, ~09:00 +04) — Origins OPEN to all signed-in, writer at f7ec5ec3, ENCOUNTERS=1 recording, rewards on Auditor review
**READ FIRST / Now (pick up here, in this order):**
1. **Dom's live test**: Strategy has the steps (sign in at frankendom.com, then https://frankendom.com/preview/origins/?region=1&online=1, fight a Zone 1 creature, reload). When Dom says he fought, read his `enc:<token>` event (`origins_events`, kind `mob`) and post it on #1769. Recording only: nothing pays yet.
2. **#1767** (backend/encounter-rewards @52c7ac32, rebased, Auditor delta PASS as the Zone 1 interim + L1/L2/L3 fixed): get the Auditor's final pass, then fold, then reinstall the writer at that trunk sha (plan pattern on #1727), then `ORIGINS_REWARDS=1` ONLY on its own joint GO. Then #1768 (backend/metal-of @7e5c5407, migration 202610080004 `origins_metal_of`, NOT applied; it needs the Auditor's PRE first and must be merged with #1767's latest).
3. **Position save** (TOP10 row 3, owner Backend, ~5 h code): presence does NOT save today (no caller of `writerSaveLocation`/`writerSavedLocation`, `locate` not wired in presence main.ts). Wire the save on leave + zone change + every 5 min (Dom's cadence) and `locate` at join; then (a) the Frontier as its own cm region frame in presence `zoneAt`; the saved place carries the region; 0009's x,z check (0..30000 cm) may need a migration. Dates: Concord square 2026-10-12, Frontier frame 2026-10-14; World owns (b) the Zone 1 page joining presence.
4. Coach (row 8, 2026-10-10): `verify-duels` refuses any build with ` coach:`; format agreed with Combat: `<label> coach:<stance>@a-b,... kit:<tag>`, 255-byte cap, `@*` overflow.
**Done today (receipts on the PRs):** #1734 kit version + #1754 409-resume folded (f7ec5ec3 live). Writer reinstalled 09a81037 → f7ec5ec3 (code only; POST #1727 6051777118; rollback = repoint `current` to 09a81037). **#1769 APPLIED** (migration 202610080005 version 20261008040458, statements sha 0fe46cb2… = file minus trailing newline) + data step: `origins_enabled` = true, `origins_open_to_all` = true (2/2 real users allowed; Auditor POST PASS 6051995046). **ORIGINS_ENCOUNTERS=1** set 08:08:51 +04 (POST 6052018933; rewards and content unset; rollback = remove the line + restart). #1767 (CP + loot via mobBatch, fight id in the token, stale = 503 `stale`, ORIGINS_REWARDS flag, 300 s respawn window = Lead's decision A interim). #1768 draft (bronze). #1764 draft (online by default; merge after the switch-on is proven). TOP10 rows 1/3/5/6/8 written. Quiet S1 table on #1692.
**Open:** #1767 final pass + GO; #1768 PRE; #1764; Dom's fight receipt; one-shard est.→measured PR; launch-gates.md stale rows (G1/G2/G5/W1-3/S1/S3 are done).
**Gotchas:** (a) This session ran in a `.claude/worktrees` checkout: never write in `~/Developer/frankendom-backend` from such a session (worktree add/remove for the TOP10 branch is fine). (b) Mac loaded or a deploy in flight: run tests on the VPS (rsync `supabase scripts origins src` to /root/work-*, `su postgres`, `PG_BIN=/usr/lib/postgresql/16/bin`). (c) TOP10 edits race other lanes: commit and push immediately on a fresh worktree of `origin/lead-catalogue/top10`; a rebase conflict silently loses the edit. (d) Mint keys are lowercase (`/^[a-z0-9][a-z0-9:._-]{7,127}$/`): never put a base64url token in one. (e) `origins_allowed` is now plpgsql: enabled AND (allowlisted OR (open_to_all AND a non-anonymous auth.users row)). (f) A presence location comment saying "every 60 s" describes the plan, not running code.

## 2026-10-08 (morning) — PENCILS DOWN (credits out ~5 days): 0005/0007/0008/0009 APPLIED; writer install waits on Dom
**Now (pick up here):** (1) **Origins writer is NOT installed on the box** (no unit, no /etc/frankendom/origins-writer.env; verified by root ssh). Dom's W3 step comes first: /root/origins-writer-setup.sh writes the env, THEN he pastes the ALTER ROLE line into Supabase. Never set the role password or write the env myself; never start on the env file appearing, only on Lead relaying Dom's explicit "done". Then `bash ops/install-origins-writer.sh f60ede44` (#1463, DRAFT, CI green + Auditor delta PASS @f60ede44, tree staged at /root/writer-tree.tgz on the box, unextracted), check writer healthy + connects as frankendom_origins, then presence step 2: ORIGINS_PRESENCE=1 in /etc/frankendom/presence.env + `bash ops/install-presence.sh --link-writer`, /origins/presence/health 200, one preview session writes a location row. Undo: --unlink-writer + flag off; `--rollback` for either installer. Check ~/.claude/state/deploy_in_flight.json before each step; receipts to Lead + Strategy, cc Expansion. (2) **#1522** undrafted, CI green @0193d6da, waiting Lead's GO to Deploy after #1574 (migrations already on prod). (3) #1574/#1577/#1581 follow-ups per the entry below are unchanged.
**Done today:** applied to prod with Auditor PRE + POST PASS: 0005 origins_trade_limits v20261007043358 (a9141ebb…f5387), 0007 origins_metal v20261007043807 (dc1dabd2…f6891), 0008 origins_trade_reversal v20261007044401 (5e689cb3…5798), 0009 origins_character_location v20261007044834 (ddc87498…25b0, #1596 @feab306a, live in release d7158986). Presence step 1: /opt/frankendom-presence/current -> 390cabd3, OFF, nginx include in the live :443 block, /internal/where 404. Incident (stale lazy chunk 404 after a release switch = "Account unavailable"): cause confirmed with WebKit + live 404s, fix owned by Deploy (asset union) and Web (reload once). #1463 refreshed to trunk (f60ede44).
**Open:** Dom's W3 step; the joint install GO for #1463; #1522 merge; step 2.
**Gotchas:** apply_migration needs the file bytes minus the trailing newline (read back sha256 of array_to_string(statements)); zsh: `$T:path` is a modifier (use ${T}:path) and ssh option variables don't word-split (use a wrapper script); during a deploy a hook blocks test-looking commands.

## 2026-10-07 (evening, 16:57 +04) — verifier grants, Origins writer + presence LIVE, encounter-verify migration APPLIED, S1 first runs; quiet re-run armed
**Now (pick up here, in this order):** (1) **#1688** (encounter token + replay verify) is **MERGED and LIVE (53c3b21b), flag unset** (Auditor POST PASS, comment 6038418584): migration `202610080002_origins_encounter_runs` is **APPLIED to prod** (version 20261007125434, statements sha256 ea65b8bb…cd1f9 = file minus trailing newline; with the newline eacb4e9a6b68b035; receipt = PR comment 6038351976). **Next for #1688 (Lead's ask): the client-side HANDSHAKE with Expansion when its wolf row lands.** The client calls `encounter_start {character, encounter}`, plays on the returned seed/enemy/level/bar/flags/layer, records with the Pit's `createRecorder` (version RECORD_VERSION, `specials` = `liveSpecials(level)`, outcome 'abandoned' when a twist ends it with both standing), then `encounter_settle {token, record: base64url(gzip(packRecord))}`; `touch {token, tick}` inside the 120 s grace. Turning the ops on needs `ORIGINS_ENCOUNTERS=1` in origins-writer.env and an installer re-run from a merged sha (Auditor PRE + Lead GO first). `ORIGINS_ENCOUNTERS` stays UNSET on the box until Expansion's client recording lands (the writer on the box is af998c6f and does not call the new functions). (2) **S1 official run**: a self-starting runner is armed on the VPS (`/root/work-s1/s1quiet.sh`, as postgres, redeployed 17:31 +04 to poll every 30 s because 5-minute polls missed the brief quiet moments; deadline 2026-10-08 17:31): it starts the first time load1 <= 8 holds 2 minutes (polled every 30 s), aborts an attempt if load rises (before a step > 8, after a step > 10, or a script says UNQUIET), and a clean pass writes `/root/work-s1/s1-quiet-results.log` + `/root/work-s1/s1-quiet.DONE`. When DONE exists: read the log, post the table with the loads on **#1692** (draft, scripts/writer-loadtest.mjs + scripts/relay-loadtest.mjs, head ed1308c9), then a PR replacing the *est.* figures in docs/specs/origins/one-shard.md §4/§5/§7 with the measured ones; attempts are in `/root/work-s1/s1-quiet-attempts.log`. Delete `/root/work-s1` when done. The UNQUIET first run (comment 6038318272 on #1692, raw log `/root/s1-results-1645.log`): every bound held (writer p99 112/417 ms vs 500; relay lag p99 0.22 tick vs 1; presence tick p99 <= 12 ms vs 100, <= 7.7% of a core vs 80%). (3) #1611/#1664/#1654/#1463/#1639 are merged and live; presence runs at 14f973db with `ORIGINS_PRESENCE=1`; X1 #1593 is Expansion's. Also open: Expansion's client side for encounters (record with the Pit's createRecorder, play on the server's seed, outcome 'abandoned' for a both-standing twist ending), the rewards lines, the creature-instance arbiter, Combat's camp-swap hook (settle refuses non-empty `swaps` with 501).
**Done today (all with receipts on the PRs):** **#1639** `202610080001_verifier_origins_grants` APPLIED (version 20261007074932, GRANT only: 26 origins_* functions to frankendom_verifier; the writer now connects as the verifier). **#1463** Origins writer installed at af998c6f (unit = EnvironmentFile verifier.env then the writer-only origins-writer.env: SUPABASE_URL, SUPABASE_ANON_KEY, PORT, then the presence keys). **#1611/#1664** presence S1–S4: presence live at 14f973db with the flag ON (S4 first failed on a missing install-list file, ops/presence-files.mjs did not follow multi-line imports; fixed, plus a test that the listed files alone START presence). **#1654** the origins installer's nginx backup goes to /etc/nginx/backups (conflicting-server-name warnings 8 -> 0). **#1688** encounter verify: `origins/server/encounter-verify.ts` (initialPractice -> withBar [ONE definition, origins/shared/with-bar.ts] -> stepPractice(.., mobLayer(style)) + stepTwist, ends as the preview host does), ops `encounter_start/touch/settle` (origins/server/encounter.ts, flag-gated, fail closed), migration 0002 (new tables origins_encounter_runs, origins_creature_claims + 5 functions, grants to BOTH writer roles, revoked from anon/authenticated), `scripts/origins-encounter-check.mjs` (44 checks, 6 mutation probes), `tests/world-fight-determinism.test.ts` (sparring Match == initialPractice+stepPractice, incl. the 4 mob layers). **#1692** (draft) S1 load scripts.
**Open:** the Auditor's POST on #1688; the S1 quiet re-run (autonomous, see Now); Expansion's encounter client; #1692 stays a draft until the quiet numbers are on it.
**Gotchas (new today):** (a) The Origins writer's role is now **frankendom_verifier**: every NEW function must be granted to BOTH frankendom_origins and frankendom_verifier, and revoked from `public, anon, authenticated` (Supabase default privileges grant EXECUTE to anon/authenticated on creation; the real-Postgres check caught it). (b) The Auditor's gate chain: **Auditor PRE -> Lead + Strategy joint GO -> apply -> Auditor POST**, and **the sha goes to Lead BEFORE any prod apply, no exceptions** (I once applied first and was corrected). apply_migration strips the file's trailing newline: the read-back sha is of the file minus it; verify the GO comments exist on the PR before applying. (c) zsh: `$H:path` is a modifier (use `${H}:path`), `echo ====` fails, ssh option variables do not word-split; BSD sed `-i` needs `''` (use python for edits). (d) The one-deployer hook blocks the WHOLE command if it contains a test run while `~/.claude/state/deploy_in_flight.json` exists, including any edit in the same command: edit first in its own call, then wait on the lock (`until [ ! -f … ]`) before testing. (e) `ssh … 'nohup … &'` keeps the session open: use `ssh -n … setsid nohup … </dev/null &`, and remember the **postgres user cannot write /root** (put logs under /root/work-*). (f) psql shows the SQLSTATE only with `-v VERBOSITY=verbose` (the writer's psqlDb does; check scripts must too). (g) `decodeRecord` expects gzip+base64url (`encodeRecord`); pack with `{...record, v: RECORD_VERSION}`. (h) Never `git stash` (shared stack); a handler test with a random server seed must search for a finished scripted fight. (i) A VPS load test is only meaningful at load1 <= half the cores (16): scripts flag UNQUIET themselves. (j) The applied 0002 file's first line still says "DRAFT, NOT FOR APPLY" (a stale comment inside the approved bytes; never edit an applied migration).

## 2026-10-08 (late night) — presence/X1/X2/S1/S3 drafts, 0005 revert + delta PASS; morning: CI re-run, joint GOs
**Now (pick up here, in this order):** (1) **#1522** head a6ece7be (0005, scope exemption REVERTED: every piece entering escrow is cooled; Auditor delta PASS, PRE on prod stands, POST expectation 108/67/35/31 + 5 rows on the PR): re-run its CI (not tonight: runners), send Strategy and Lead the result at the exact sha, then their joint GO; no apply before it; 0007 follows 0005; 0008 is class 2 (Dom). (2) **#1571** (presence `GET /internal/where` + client + fixtures + zone via the Concord frame + `ops/nginx/frankendom-presence.conf` + apply/rollback runbook, head ea15aa47, Auditor PASS) and **#1572** (p99 tick output, `?ticks` only for a direct loopback caller, head 03d95f04; its first quality run failed on a tsc error in my test, fixed in 03d95f04, needs a new green run): both TARGET TRUNK, undrafted, waiting on hosted gates and Lead's GO to Deploy. (3) After #1571 merges: retarget **#1577** (X2 stage 1: spawn at the Pit yard centre, no first-pose placement, 10-min last-seen memory, Exchange rejoin 50 cm into the Pit yard outside the outer gate) and **#1581** (presence install: unit + env template + installer with health checks, OFF by default, `--link-writer` opt-in writes a secret into the writer env, `--unlink-writer` undoes it) to trunk; after #1572 merges: rebase **#1574** (`--cluster`, run R2c) onto #1577 and retarget. A stacked PR gets no quality.yml run: never merge one on the Auditor's word alone. (4) Ping Expansion when #1571 merges (X1 codes against it). (5) **#1552** S1 plan (draft; waits on the Auditor's go-ahead and Dom's GB/month of the VPS plan, TO FILL in §4 criterion 5) and **#1575** X2 plan (docs, draft; stage 2 waits for #1577; (e) no logout escape tested once jail exists).
**Done tonight:** #1558 S3 border tests merged (60378dfe, live); the S1 plan with Strategy's rulings; the X2 plan with Lead's rulings (zone from x,z in the Concord frame, no character id from the client, spawn = Pit yard centre, 10 min); #1549's verify-loot diff acked; the forced-rollback synctest is #1524 (c86e5d1f, on trunk).
**Open:** Dom's morning list: the VPS plan's included GB/month; the joint Lead + Strategy GO to APPLY the nginx snippet + presence install together (not applied tonight, `deploy.sh` does not touch `ops/nginx`); 0008. Lead's decision pending on nothing else from me.
**Gotchas:** (a) zsh: `$R:path` is a modifier, write `${R}:path`; `echo ====` fails. (b) Presence now imports the world data (origins/world, origins/contracts, src/*): a VPS copy needs `src` too, and `ops/presence-files.mjs` lists the real closure. (c) The Stage 1 spawn rule makes the load test's old random-start bots teleporters: bots start at the zone centre and need `--warmup` (about 40 s; the cluster bots 60 s). (d) VPS PG checks: run as the `postgres` user (`runuser`), `export PG_BIN=/usr/lib/postgresql/16/bin` first. (e) My local `tsc` greps missed an error CI caught: run the full `npx tsc --noEmit -p .` and read the whole output. (f) The one-deployer hook blocks anything containing test-looking text while a deploy runs, even an ssh command; put the commands in a script file and run the file. (g) Messages from peers cross: when two conflict, read the ruling recorded on the PR (#1575) rather than guessing.

## 2026-10-08 (early) — #1519/#1523 APPLIED, synctest #1524 live, finding E #1528, hit-stop net review PASS, #1487 receipts; 0005 -> 0007 -> 0008 drafted on #1522
**Now (pick up here):** (1) **#1487** (client record upload, branch backend/duel-record-client, head 6359aeac): VPS test:all 2281/2283 pass (0 fail, 2 skipped) + hosted CI all green, receipt on the PR; waits only for the Auditor's final pass, then Lead's GO (Deploy merges). (2) **#1522** (branch backend/origins-trade-limits, head ecb101a2, DRAFT, NOT FOR APPLY; Lead cancelled its CI run, re-run it after the morning queue): **apply order is file order: 0005 trade limits (class 1) -> 0007 bound metals (class 1) -> 0008 trade reversal + the origins_events kind constraint (class 2, joint GO WITH Dom, his morning list)**. 0005 still needs its OWN Auditor PASS + read-only PRE on prod before its joint GO (the Auditor's review so far is 0007's: PASS, class 1, PRE PASS). 0007 has an order guard ("needs 0005 applied first") and the Auditor's N2 fixed. No applies without Lead + Strategy's joint GO. (3) Finding E stays open only for a pooled psql adapter + measured numbers (#1528 itself is GO'd to Deploy). (4) #1534 is a review probe (Combat's hit-stop + debug counters), DRAFT, never merge: close it when convenient. (5) The `awards-database-check.mjs` diff in `~/Developer/frankendom-backend` belongs to backend/server-standing-rank, not mine.
**Done today:** **#1519 APPLIED** (202610070003_origins_trade_open_lock, version 20261006204055, sha 9beae4d2...b0f4, Auditor POST PASS, merged); **#1523 APPLIED** for Expansion (202610070004_origins_escrow_guard_null, version 20261006205219, sha 58cb60b5...d499, POST PASS); #1485/#1392 merged and live (d693f758). **#1524 forced-rollback synctest** (tests/net-synctest.test.ts, the entry ticket for every sim change) merged. **#1528 finding E** (openAccount = 1 + pending psql spawns, was 2 + 2x pending; pending cut in SQL) Auditor PASS @aff520b4, CI green, GO'd. **#1510** presence: the three nits (token in the Sec-WebSocket-Protocol header, perIp sweep, loadtest lint) + the child-process-bounds fix, delta PASS @60c5cc4f. **Hit-stop net review** (combat/pvp-hitstop @cf646320): PASS, nothing under src/net or the sim touched, two-page CI duel via probe #1534 showed the hold on both ends (10 holds each, 34 identical fingerprints, 0 desyncs). **#1522** built: M9 cooldown + DB-written trade history, M10 sweep, M12 audit, M13 gates/caps (origin_tiers = ["Origin"], drift-guarded on the real TIERS[9]), M14 counts + reversal, M15 bound metals (balance + ledger, deferred conservation, `metal` op in origins_apply with a line-by-line one-branch proof).
**Open:** #1487 final pass + GO; #1522 (0005 PASS+PRE, then joint GOs; 0008 is Dom's); the pooled adapter for E; closing #1534.
**Gotchas:** (a) A **VPS test:all needs a real `.git` in the folder AND `.quality-gate.json` committed at HEAD**: hf-wall-rows reads `git rev-parse HEAD^{tree}` and release-checks 1479 reads `git show HEAD:.quality-gate.json` (my rsync-without-.git copy gave 3 false failures; set `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=<dir>` instead of touching the global git config). Run the VPS jobs niced, install deps with `npm ci --ignore-scripts`, delete /root/work-* after. (b) The one-deployer hook blocks any command containing test-looking text (`node --test`) while a deploy runs, even inside a heredoc append: write files first, run tests on the VPS in a separate call. (c) GitHub CI jobs sometimes stall 5 min in `actions/checkout` and are cancelled (shows `fail` on plan/base): rerun with `gh run rerun <run> --failed` (refused while the workflow is still running). (d) Monitor scripts run in zsh: no `${!var}` indirect expansion. (e) The apply_migration MCP strips the file's trailing newline: the read-back sha is the file minus its trailing newline. (f) Never `git stash` in these worktrees: the stash stack is shared. (g) A migration harness's auth.users stub has no created_at: reference it only from plpgsql (resolved at call time). (h) The migrations replacing origins_purge_account chain (0001 -> 0005 -> 0007): each down restores the previous body byte for byte (compared in the checks). (i) An escrow-guard style `x = 'v'` on a nullable column is NULL on a retirement: use `is not distinct from` (0004 and my cooldown guard).

## 2026-10-07 (night) — #1485 and #1392 APPLIED; presence skeleton #1510; trade-open lock #1519 (finding C); 0004 and finding E next
**Now (pick up here):** (1) **#1519** `backend/origins-trade-open-lock` @8605ff69 DRAFT, finding C fix (migration 202610070003_origins_trade_open_lock, down-script, `scripts/origins-trade-lock-check.mjs` 15 checks green on the VPS): wait for the Auditor, no apply without PRE + joint GO. (2) **Finding E** (`openAccount` = 2 + 2xpending psql spawns): writer-code PR, bound the pending fetch in SQL and use one connection; capacity note in the body; Draft to the Auditor. (3) **0004** `backend/origins-trade-limits` (not started on disk, worktree `../frankendom-backend-trade4` is now the #1519 branch: make a new one off trunk) as a DRAFT, "DRAFT, NOT FOR APPLY" at the top, class stated PER STATEMENT (Strategy: any ALTER of a live table is class 2, joint GO with Dom). Design settled in the memory file `frankendom_origins_0004_plan_2026-10-07.md`. (4) **#1487** (client upload, draft @6359aeac, stacked on #1485): retarget to trunk the moment #1485/#1392 merge (Deploy's next run), then hosted CI + full `test:all` on the VPS WITH assets synced, send Lead + the Auditor the sha. (5) **#1510** (presence, flag OFF) and **#1490** (one-shard note, head 4e14b1b0 with Dom's rulings) are with the Auditor/Lead.
**Done today:** **#1485 APPLIED** (202610070002_duel_record, version 20261006191040, 3611 bytes, sha ff92e44f…8363 = file at 6ff7bcc4; Auditor PRE 19:10Z, POST PASS) and **#1392 APPLIED** (202610070001_duel_antifarm, version 20261006195339, 5246 bytes, sha 54b023aa…e409 = file at c19ee555; POST PASS; relations 97 -> 105 by pg_class incl. pkeys/unique indexes/sequence, functions 59, policies 33); both undrafted, Lead GO to Deploy to merge them. **#1510** presence skeleton (origins/presence, flag OFF, 9 tests, load test: 100 bots = 8.6% of a core, 1,000 players = 60% core / tick 82 of 100 ms / 21 Mbit/s, so ~1,000 per host and an 80% add-a-host trigger at ~800, est. on a shared box). **#1490** note updated for the Auditor's 3 notes and Dom's rulings (free-text chat + server filter, buy capacity, game-assigned layers + join-friend, names = letters/spaces/hyphens + AI check). VPS probe copies deleted (71 GB free).
**Open:** #1519, #1510, #1490, #1487 as above; E; 0004; the uncommitted `scripts/awards-database-check.mjs` diff in `~/Developer/frankendom-backend` (7+/2-, `waiting()` pending assertions for my_standing's pending/pending_owned: it belongs to branch backend/server-standing-rank, not mine to drop). Trading 0003 is LIVE (Expansion's relay called its blockers open: they are not).
**Gotchas:** trunk's `origins-database-check.mjs` crashes once #1392 is on trunk unless #1519's `_origins_` filter is in (a duel migration has no down file). A deploy lock (`~/.claude/state/deploy_in_flight.json`) blocks test commands on the Mac and migration applies: run tests on the VPS (`/private/tmp/claude-501/pg-run.sh <worktree> <work-name> '<cmd>'` rsyncs supabase+scripts, chowns to postgres, runs with PG_BIN=/usr/lib/postgresql/16/bin; zsh does not word-split an ssh option variable, use a wrapper script); delete /root/work-* after. Node type-stripping rejects TS parameter properties. Never edit an applied migration file.

## 2026-10-07 — 0003 trade-settle draft (#1469), route/installer (#1463) with the Auditor, Origins ops (#1459/#1460) with the Auditor
**Now (pick up here):** nothing blocked on Backend. (1) #1463 `ops/install-origins-writer.sh` + nginx route/limits, draft @2bc9db54 (Auditor delta pass pending: rollback fails loud, node gate, scratch-root check); it stays DRAFT and uninstalled until Dom's step (role password in the Supabase dashboard + /etc/frankendom/origins-writer.env, see the #1455 text in git history) then Strategy + Lead's install GO, then the flag GO. (2) #1469 `0003_origins_trade_settle` draft @a56da664 with the Auditor (behind #1463's delta and Combat's PR); NO APPLY even after a PASS: trading is design only (Strategy), the apply GO comes from Strategy + Lead once it is a build item; same path as 0001/0002 (check ~/.claude/state/deploy_in_flight.json, the Auditor's PRE, exact bytes via apply_migration, read back, the Auditor's POST, the down-script on any diff). (3) Review Expansion's op PRs: #1459 quest_advance/talk_pick @bb88a203 and #1460 consume @f22fed65 (Backend PASS earlier at 53bd0fb4/76bac1e0, both ready, with the Auditor); #1402 RNG fingerprint @24787574 (Auditor PASS). A later 0004 holds the non-blocker trade rows (limits M9, expiry sweep M10, audit M12, caps/config M13, reversal M14, tribute M15). The arena-award mint waits on #1443 inside pitBatch; world awards need an encounter token + replay record.
**Done today:** 0001 (#1449) and 0002 (#1458) are APPLIED to prod and merged (receipts in memory artifacts-2026-10-06/prod-{pre,post}-probe-{1449,1458}.txt); #1455 writer merged; #1466 docs and #1452 state merged; #1405 closed (superseded); #1463 built and hardened (F1/N1/N2/N3, 35 installer checks); #1469 built (78 trade checks, database-check 418, mutation-probed).
**Open:** #1463, #1469, #1459, #1460, #1402 as above; the Auditor's N1/N4 (psql per op, no Auth cache) are notes; the unpaid-reward payer must read origins_unpaid; `open` answers 403 for everyone while origins_enabled=false and origins_access is empty; Strategy ruled preview duel wins stay preview-only (option B): no preview result goes into fight_results.
**Gotchas:** NEVER edit an applied migration file, comments included (errata go in docs/specs/origins/server-save-schema.md); a follow-up migration that replaces earlier functions needs the harness to apply it after the earlier migration's checks (origins-database-check.mjs now applies follow-ups just before its down section and takes them off newest-first); a down-script for a replaced function must `create or replace` when the up used `create or replace`; keep probe output out of final claims (a hook reviewer misread a mutation-probe Error line); an unreachable post-check is an equivalent mutant, say so rather than forcing a test; PG `boolean || boolean` does not exist (cast ::int::text); nginx regexes with braces must be quoted; `pkill -f <path>` kills your own ssh; macOS BSD sed fails on odd patterns, use python; VPS recipe: rsync to /root/work-*, chown -R postgres:, run as postgres with PG_BIN=/usr/lib/postgresql/16/bin; tests for installers: ORIGINS_INSTALL_ROOT + stub nginx/systemctl/node on PATH.

## 2026-10-07 — 0003 trade settle APPLIED; duel records (#1485), duel anti-farm (#1392), client upload (#1487), one-shard note (#1490) all waiting
**Now (pick up here):** apply **#1485 then #1392**; both have the Auditor's class-1 PASS and BOTH halves of the joint GO (Lead + Strategy, repeated twice). The only things missing are the **Auditor's apply PRE for #1485** (asked 18:34Z, Strategy moved it to the front of their queue) and a clear `~/.claude/state/deploy_in_flight.json` (clear since 18:54Z; `deploy_hold` is NOT a block, Strategy ruled). Procedure per migration: lock clear, Auditor PRE, exact bytes through `apply_migration` (name = the file stem), read back `supabase_migrations.schema_migrations.statements[1]` and compare its sha256 with the file at the PR head, Auditor POST, the down-script on any diff, undraft, version line to Lead and Strategy. **#1485** = `supabase/migrations/202610070002_duel_record.sql` @6ff7bcc4, 3611 bytes, sha256 ff92e44fecd942ee328ab523cfe0fe01beeb001c0b33eda23d717ed4ed428363 (a new `duel_records` table, FK to duel_reports' existing PK, RLS on, verifier select policy, `report_duel_record(text, integer, jsonb)` to authenticated; down-script in the PR). **#1392** = `supabase/migrations/202610070001_duel_antifarm.sql` @c19ee555 (two new tables, one index, RLS, two functions to frankendom_verifier only); the Auditor's prod baseline at 18:34Z was public relations 94 / functions 56 / policies 31 / triggers 20, POST expected +2 / +2 / +1 / +0; no down-script file, the rollback is the file's first comment line. After #1485 is applied and merged: retarget **#1487** (client upload, draft @6359aeac, stacked on #1485) to trunk, get CI green, then it can merge; then **(c)** the psql adapter and sweep timer for `scripts/verify-duels.mjs` with the flag OFF (Lead: below fatigue and 50 levels).
**Done today:** **0003 APPLIED** (#1469, version 20261006174845, `202610060003_origins_trade_settle`, exact bytes sha256 22894a37…712e5b = the file at 04d33655; Auditor PRE 17:43Z, POST PASS 17:49Z; undrafted; Deploy has the merge GO). Auditor F1 fixed first at 04d33655: a trade put must not carry upgrade_level / tier / bound_to / history_append (guard in change_offer, settle and cancel; 94 checks, red on the old bytes). #1402 (RNG fingerprint) refreshed: version restamp then trunk merged, `tests/rng-fingerprint.test.ts` 3/3 with 0 cells changed, head f68a6476, with the Auditor for a delta. #1392 rebased on trunk and renumbered 202610060001 -> 202610070001 (the old prefix collided with the applied origins_save), Auditor PASS class 1. New: #1485 (duel_records, a NEW table rather than columns on duel_reports, which would have been class 2), #1487 (client: after a settled finish send record + side to report_duel_record, chained after report_duel; fallback is simply the old call), #1490 (docs only: one-shard architecture note, docs/specs/origins/one-shard.md).
**Open:** #1463 DRAFT @2bc9db54 (writer route + installer) stays uninstalled until Dom's step (role password in the Supabase dashboard + /etc/frankendom/origins-writer.env, text in the #1455 body) then the install GO, then the flag GO. #1490 is DRAFT @92b0b5f2 waiting for Expansion to align it with their Living World spec (not on the remote yet), the Auditor's docs read and Lead's GO; it has three Dom questions in §7 (free chat vs presets, queue vs world-full, player-chosen layers). #1472 (Expansion's smith apply_upgrade) was read once (upgrade.ts looks right on idempotency, 409/stale, coin refusal) but never formally reviewed. The 262144-byte cap on duel_records.record is my choice and flagged on #1485. `scripts/verify-duels.mjs` is a library only: nothing in prod calls it until (c).
**Gotchas:** worktrees (all off trunk unless noted): ../frankendom-backend-trade (#1469), -antifarm (#1392), -duelrec (#1485), -duelclient (#1487), -oneshard (#1490), -rng (#1402), -state2 (this entry). The migration check harnesses apply EVERY file in supabase/migrations, so copy the whole dir to the VPS, run as the postgres user with PG_BIN=/usr/lib/postgresql/16/bin (initdb refuses root), and rsync with --exclude assets (src/assets is 382 MB; a whole-repo rsync times out). zsh does not split an ssh option string held in a variable: use an array; macOS has no `timeout`. The one-deployer hook blocks test and build commands (even single-file ones inside a compound command) while a deploy runs: run tests on the VPS instead. The shared test helper `finishingPair` sets sessions directly, so `driver.record()` is null there (use `duelOver` for a real fight). A migration number can collide with an applied one: compare the prefix against `list_migrations` before opening the PR. Stacked PRs show every CI check as `skipping` until retargeted to trunk, so "CI covers it" is false for them: say so. Peers and ids (they change after restarts, find them by title with list_sessions): Lead, Strategy (advisor), Auditor.

## 2026-10-06 (night) — Origins schema APPLIED to prod (0001 + 0002), writer merged, route/installer built; Origins ops by Expansion in review
**Now (pick up here):** nothing blocked on Backend. Wait for: the Auditor on #1463 (the /origins route + limits + installer, draft, NOT installed), Lead/Strategy GO to install the writer, and Dom's step (role password in the Supabase dashboard, env file on the VPS: both in the #1455 body under "Dom's step"). The flag (origins_config.origins_enabled) is false and origins_access is empty: `open` answers 403 for everyone until a separate GO. Review Expansion's stacked op PRs as they land (#1459 quest_advance/talk_pick @53bd0fb4 Backend PASS, #1460 consume @76bac1e0 Backend PASS, both with the Auditor); #1460 needs 0002 (live).
**Done today:** #1449 migration APPLIED as 202610060001_origins_save (version 20261006151221, exact bytes sha256 4a36b4a32aa46e8c, no db push, flag OFF) after the Auditor's PRE, POST PASS, plus my structural-md5 parity vs a local PG16 build; #1458 0002 spend APPLIED as 202610060002_origins_spend (version 20261006152956, sha256 86bdd2aec64b8f5c; event kinds burn/upgrade/paid, origins_event, origins_unpaid with the same-account/kind paid marker), Auditor PRE/POST PASS. #1455 writer (origins/server: open + snapshot + Pit import, create_character, op registry; 7 no-db tests + 25 PG checks) merged with Auditor PASS; #1449 and #1455 merged to trunk (e2ecddbc, 8e8f34ad), live in 01944e29. #1402 RNG fingerprint rebased, Auditor PASS @24787574. #1466 doc-only (op names, status, 0002 errata). #1463 route/installer drafted and tested on the VPS (scratch nginx: GET 403, body 413, 12 passes then 429).
**Open:** #1463 (Auditor review, then install GOs); #1459, #1460 (Auditor); #1392 and #1405 older items unchanged; the arena-award mint waits on #1443; world awards need an encounter token + replay record; coin is Strategy/Stats'; the Auth-cache and psql-per-op notes (Auditor N1/N4) are not done; a reward payer must use origins_unpaid.
**Gotchas:** NEVER edit an applied migration file, comments included: repo bytes must equal prod bytes, so fix wrong comments as errata in docs/specs/origins/server-save-schema.md (Lead's rule); apply only with no deploy lock (check ~/.claude/state/deploy_in_flight.json right before), the Auditor's PRE first and POST right after, the down-script on any diff; the role password is never typed through MCP (it would reach a log): Dom sets it in the dashboard; Node type-stripping rejects TS parameter properties and enums; VPS check recipe: rsync origins src scripts supabase tests to /root/work-*, chown -R postgres:, run as postgres with PG_BIN=/usr/lib/postgresql/16/bin (npm ci already done); `pkill -f <path>` kills your own ssh, use a script file; `character` must be quoted in RETURNS TABLE; jsonb reorders object keys, so compare fields; an nginx regex with braces must be quoted; always mutation-probe a new check (my body-cap test passed by truncation until I asserted the error text); a hook reviewer misread a mutation-probe Error line as a failing run, so keep probe output out of final claims.

## 2026-10-06 (late) — Origins server save/verify (#1449) built and frozen; #1415 merged; writer service is next
**Now (pick up here):** build the Origins WRITER SERVICE PR, paired with #1449 (Lead's order, then: Auditor up/down rehearsal on the final sha, Strategy + Lead GO, apply both together, one-line notice to Dom naming the migration file, sha and down-script path). Server-verified awards only; the client never writes rewards. Plan: a small Node HTTP service on the VPS next to the verifier, connecting as `frankendom_origins` (DATABASE_URL from env, never in git), verifying the client's Supabase access token, running the pure `origins/*` modules and committing through `origins_commit`. Trunk has contracts + progression/model.ts only; inventory (#1443), quest journal (#1446) and talk (#1447) are still OPEN PRs, so build the handlers (open/snapshot, create character, Pit import via `origins_pit_pending` + `award()`) first with an op registry the others plug into. Testable against the real PG harness in scripts/origins-database-check.mjs. Keep #1449 FROZEN unless the service needs a schema change.
**Done today:** #1415 (late notice, RECORD_VERSION 24) merged after B1/N5 fixes, Auditor PASS @22d19560; #1440 (ladder-sweep node: imports, scripts only) open, queued behind #1439/#1435/#1438; the "openDuel never closes the transport" finding was already fixed on trunk (#1389), no PR. #1449 `backend/origins-save-schema` @e664c1f2 DRAFT, nothing applied: doc docs/specs/origins/server-save-schema.md, migration supabase/migrations/202610060001_origins_save.sql, down-script supabase/down/202610060001_origins_save_down.sql (outside migrations/ on purpose: tests/encounter-migration.test.ts reads every entry of that folder), scripts/origins-database-check.mjs (418 checks, green on VPS PG16 and Mac PG17.9). Accepted by Lead + Strategy as class 1: new origins_* tables, functions, role `frankendom_origins`, no grant/ALTER/DROP on any live table; reads of fighter_profiles/loot_claims/awards only inside definer functions; the only FK target outside origins_ is auth.users (its RI triggers are snapshotted and the down-script restores them).
**Rulings in force (Strategy 2026-10-06):** career per ACCOUNT; total CP derived = frozen snapshot seed (creditFromMarks(marks) once) + verified post-snapshot Pit wins priced by #1428 `award()` weights (first win per opponent x level; a Pit-only account stalls at L11, tested) + world CP; world-boss/mob awards NOT written until an encounter token + replay record exists (token table and issue/consume functions are in the migration, nothing awards from them); burn ledger kept (Expansion adds `consume` to #1443); erasure never blocked (cascades + `origins_purge_account`). Migration classes: class 1 (additive Origins-only) applies on Strategy + Lead GO after review, down-script, local-cluster test and Auditor before/after probes; anything touching an existing live table (ALTER/DROP/backfill/grant) is class 2 and waits for Dom. #1392 is class 2, stays DRAFT.
**Open:** #1449 (above); #1440; #1402 RNG fingerprint (with the Auditor); #1392 draft migration (needs Dom's yes); #1405 earlier state-handoff PR (superseded by this entry once merged). No Supabase branch DB was used (local PG16/17 clusters accepted).
**Gotchas:** a deferred constraint trigger runs at COMMIT as the session user, so it must be SECURITY DEFINER or the writer role gets "permission denied"; `if x >= case ... then` inside plpgsql breaks (the IF scanner stops at the first THEN), compute into a variable; pg_trigger_depth() = 0 in a trigger WHEN means a direct statement, > 0 a cascade; `text || boolean` gives 'true'/'false', not 't'/'f' (my first search_path check silently never ran until a mutation probe showed it passing: always mutation-probe a new check); loot_claims has a 60/hour rate trigger and a unique fight_hash where verified (fixtures disable the first); psql output of a boolean-in-concat; macOS `timeout` does not exist (use a bounded while loop); the one-deployer hook blocks test-looking commands while ~/.claude/state/deploy_in_flight.json exists; VPS initdb must run as `postgres` (su postgres -s /bin/bash), clone to /tmp and chmod -R a+rX.

## 2026-10-07 — COMBAT-001 reopened: late notice (#1415 draft), ladder human gate (#1410 merged)
**Now (pick up here):** #1415 `backend/late-notice` head 534e6394 is WIP and UNTESTED: RECORD_VERSION 24 with the ramp keyed on the record's version (play-radius.ts LATE_NOTICE, record.ts stampedVersion, match.ts, REACH[24]=[]), the v22 knight L12 replay fixture (tests/fixtures/v22-warden-l12.json + tests/v22-late-notice.test.ts) and the re-pinned guard digest. Run test:all on the VPS from a folder with a .git, fix real failures, re-run the #1410 gate and a cliff-check sample, update the PR body, mark READY, send Lead and the Auditor the sha. Memory file `frankendom_combat001_late_notice_2026-10-07.md` has the exact steps.
**Done today:** #1410 ladder gate merged (ten opponents at L6/L18/L46, human-like bots, Goblin the pinned KNOWN_FLAT); #1415 rule + gate (softNotice only on in-between levels from L12; tables and L1-11 byte for byte trunk, n=120 cliff table in the PR: worst drop 84 -> 30, four rows accepted at <=30: knight blocker, shieldmaiden blocker and skilled, executioner blocker); Auditor PASS on the mechanic at ee5008f8.
**Open:** #1415 bump + fixtures (above); #1392 and #1402 with the Auditor (unchanged); the knight's L11->L12 floor (~27, reaction 20 -> 19, not the ramp shape) is a follow-up note only; Goblin offence is Combat & Specials'.
**Gotchas:** the VPS work folders have no .git so hf-wall-rows 650/653 fail there (they fail on trunk too, pass in a real checkout); the one-deployer hook blocks test commands while a deploy runs; ramping thrusts/chained blows broke the weapon-flip and pommel fairness rows, so tells and chained blows are exempt; BSD sed and zsh word-splitting bite scripts (use python and a wrapper script for ssh).

## 2026-10-06 (+04) — COMBAT-001 (ladder difficulty cliff) PARKED as "leave the cliff": three rounds, tables
Lead ruling 2026-10-06: after round 3 the cliff stays; (2) retuning the Normal table is out (Normal stays as it is). Bar: no adjacent-level win drop > 25 pts at the windup 22/20/18/16/14 crossings (bots blocker + skilled, n=40 per cell, levels 1-46), L1-5 and L40+ within ±5 of trunk, the L6/L18/L46 anchors unchanged, the frozen benchmark 29/30 Easy not worse. Cause: only `reaction` is non-smooth; a swing is answerable the first level `reaction < windup` (ai.ts hard gate), so each integer windup is a cliff. Worst adjacent drop per row, trunk / A / B (round 1) and B2 / A2 (round 2) / B3 (round 3):
| row | trunk | A | B | B2 | A2 | B3 |
|---|---|---|---|---|---|---|
| veteran blocker | 57 | 25 | 20 | 12 | 28 | 70 |
| veteran skilled | 85 | 40 | 25 | 18 | 27 | 67 |
| executioner blocker | 52 | 25 | 20 | 27 | 43 | 78 |
| executioner skilled | 57 | 25 | 18 | 20 | 45 | 60 |
| dwarf blocker | 47 | 20 | 12 | 15 | 15 (+10 at the ends) | 28 |
| dwarf skilled | 48 | 23 | 13 | 13 | 23 | 13 |
| knight blocker | 62 | 23 | 22 | 15 | 18 | 37 |
| knight skilled | 47 | 25 | 20 | 23 | 25 | 30 |
| pitborn blocker | 52 | 47 | 35 | 35 | 20* | 35 |
| pitborn skilled | 42 | 27 | 30 | 21 | 20* | 21 |
| shieldmaiden blocker | 60 | 30 | 44 | 45 | 25* | 45 |
| shieldmaiden skilled | 65 | 35 | 33 | 35 | 25* | 35 |
(*A2's pitborn/shieldmaiden rows cover only 16-18 levels: the 1500 s job limit cut them.) A = a soft notice in ai.ts (lapse' = 1 - spare*(1-lapse), spare = clamp((windup-reaction)/4)); B = a lapse ramp at every windup crossing (profileAt, start .9 over 7 levels); B2 = start .95 over 10 levels; A2 = a quadratic soft notice over 6 ticks; B3 = B2 with L6/L18/L46 returned as the exact anchor tables. Verdicts: A fails 5 of 12 rows, B fails 4, B2 fails 4 (executioner blocker 27, pitborn blocker 35, shieldmaiden 45 / 35), A2 fails 5 (veteran, executioner, dwarf blocker at the ends), B3 fails 10 of 12 (3 worse than trunk: veteran blocker 70, executioner 78 / 60).
**Why B2 could not ship as is, and B3 cannot work:** B2 starts its ramp at lapse .95 on the first crossing level, which for most wardens IS the Normal anchor (L18: veteran, skeleton, dwarf, knight .30 -> .885; executioner .20 -> .875; pitborn, minotaur, werewolf, shieldmaiden .10 -> .865; Easy L6 for goblin, nightborn, wraith, plaguedoctor .40 -> .95, witch .35 -> .95), so it moves the anchors and breaks the invariant that levels 6 / 18 / 46 ARE the easy / normal / hard tables (25 failures in test:all). B3 pins the anchors back, so the ramp's easiest step lands at L17 and L17 -> L18 becomes a bigger cliff than trunk's. **"Ease into the crossing" (Lead's option 1) is not implementable in profileAt:** before a crossing the warden cannot answer that swing whatever his lapse is, so lapse can only act after it; the only way to act before it is a probabilistic notice in ai.ts, which is round 1's A and round 2's A2, and ai.ts cannot spare the three anchor levels (it has no level). Both were measured and fail. Nothing from COMBAT-001 shipped; trunk is unchanged. Sweeps, logs, patches and `cmp.py` are in the lane's memory folder (`artifacts-2026-10-06/combat001`); `scripts/ladder-sweep.mjs` (from the closed #1373) is the sweep tool.

## 2026-10-06 (+04) — handoff: duel PR stack waiting on Dom's confirm, COMBAT-001 round 2 did not pass
**Now (pick up here):** nothing assigned. If the Auditor sends findings on #1391 or #1392, fix those. Do NOT stack anything further on #1377 → #1390 → #1391 → #1392 until they merge (Deploy holds them for Dom's confirm). No `duel_reports.record` column work: that is its own migration and needs Dom's yes.
**PR stack (all VPS-verified, hosted runners were down; receipts are in each body):**
- #1377 PvP verifier @0dcaca54 (Auditor PASS, queued for release; S1/S2 in). #1390 @90e08f38 follow-ups F1 (kits compared field by field, not by JSON text, because jsonb reorders keys), N1 (300-char reason cap, per-room write catch into `receipt.writeErrors`), N2 (missing createdAt counts as aged); stacked on #1377.
- #1391 @b86af93f anti-farm rules (`src/net/duel-antifarm.ts`: Elo, first win per opponent per UTC day, daily taper; every number in `DUEL_ANTIFARM` marked TODO(Stats); `PVP_REWARDS` still false, pays 0, returns `wouldPay`).
- #1392 DRAFT @bc320c94 migration FILE 202610060001_duel_antifarm.sql (`duel_ratings` own-row select, `duel_counted_wins` no client access, two functions granted only to `frankendom_verifier`, unique per room and per winner/opponent/day) + verifier sweep counting a verified room before marking it + `scripts/duel-antifarm-database-check.mjs` (PG16 scratch cluster, PASS, two mutation probes fail it). Stacked on #1390 with #1391 merged in. NOT applied; the apply needs the Auditor's pass and Dom's yes; never `db push`.
- #1387 (settled winner not marked left after a hidden tab: guard on `latched`, NOT the `settled` getter, which latches as a side effect and broke three desync tests; plus an empty catch on the fight-results import) Auditor PASS @e51d674a, waits on Dom's yes in Deploy's chat. #1389 transport close after a duel: `RETIRE_MS = SILENCE.abandonMs + 5000` (20 s, past the peer's silence window, inside the relay's 60 s idle close; the first 5 s was Auditor-HOLD @d997561f), fixed @849112d1, with the Auditor.
- #1376, #1378, #1369 were open with the Auditor before tonight; not touched since.
**COMBAT-001 (ladder difficulty cliff) round 2: NO PASS, Dom decides.** Pass bar: no adjacent-level win drop > 25 pts at the windup 22/20/18/16/14 crossings (Veteran/Executioner/Dwarf/Knight/Pitborn/Shieldmaiden, bots blocker+skilled), L1-5 and L40+ within ±5 of trunk. B2 (lapse ramp .95 over 10 levels) fails 4 rows: executioner blocker 27, pitborn blocker 35, shieldmaiden blocker 45 and skilled 35. A2 (quadratic soft notice over 6 ticks) fails 5: veteran blocker 28 / skilled 27, executioner blocker 43 / skilled 45, dwarf blocker off trunk by 10 at the ends; its pitborn/shieldmaiden rows were cut by the 1500 s job limit. A3 moot. Trunk's worst drops were 42-85, so both candidates halve the cliff; neither clears the bar. Patches, sweep logs and `cmp.py` live in the lane's memory folder (`artifacts-2026-10-06/combat001`), not in the repo. Diagnosis: only `reaction` is non-smooth (a swing is answerable the first level `reaction < windup`).
**Done earlier (2026-10-05):** #1366 fight_results APPLIED to hosted `rxbewmzmovelckzoosss` as 202610050001_fight_results (hosted version 20261005194533, byte-exact, never db push); #1366 and #1368 merged.
**Open:** the psql/REST adapters that feed the verifier `pending` rows and `players`, and the `record` column + 4th `report_duel` arg + client upload, all wait on Dom's yes; Stats owns the TODO(Stats) numbers; flipping `PVP_REWARDS` is last and needs Dom. The uncommitted `scripts/awards-database-check.mjs` change in `~/Developer/frankendom-backend` (branch backend/server-standing-rank) is already on trunk: leave it for Dom to discard.
**Gotchas:** (1) the VPS prints TAP: grep `^# (tests|pass|fail)|^not ok`, echo the real exit code, `npm ci` first; rsync the tree with `--delete` or stale files give phantom `tsc` errors. (2) A getter with a side effect (`PvpDuel.settled` latches) must not be called earlier in a frame than it was: use the plain field. (3) jsonb returns keys in another order: never compare records or kits by `JSON.stringify`. (4) The VPS has PostgreSQL 16 server binaries (`PG_BIN=/usr/lib/postgresql/16/bin`, run as `frankrows`, initdb refuses root) for the database-check scripts. (5) Never bare `git stash` in a shared worktree set: I dropped my own tagged entry only. (6) One-deployer hook blocks test-looking commands while `~/.claude/state/deploy_in_flight.json` exists.

## 2026-10-02 10:48 (+04) — offline selected-reward persistence repair, pending exact-head review/release
- Lead authorized the narrow storage-recovery defect on live base `ffa4eea8`. `flushClaims` now retries saving the merged outbox before awaiting the network, clearing unsaved/acknowledged holds only after a successful local write. Account-specific posting and per-post session checks retain their existing behavior. No auth, schema or server writes.
- Fail-first regression reproduced a successful bank, failed finalise of `goblin.Helmet`, recovered device storage, offline insert, then reload settling the stale claim with `piece:null`. Same regression now passes. A second regression covers a failed retry retaining both holds, both accounts' durable final choices on recovery, no acknowledged-claim resurrection and no other-account posting.
- Validation: 20/20 claim tests; required `node scripts/quality-stop-targeted.mjs` (ESLint, test typecheck, 123/123 tests); all three `.quality-gate.json` completion commands (22+10+2 tests). Zero failures/skips. Self-review and preliminary Auditer read PASS; final committed-head review and coordinated CI/release checks remain owed. Three Semble searches and actual-worktree-root CodeGraph used; post-edit graph includes flushClaims→outbox without a stale-index banner. No build/browser/full-suite slot used.
- Next: Auditer exact-head verdict, Lead CI/release slot, Deploy publication and affected-flow browser/live verification. Separate duel gameplay proof remains open: hosted schema verified but metrics rows were zero at 10:38; Duel/Lead own the real signed-in account step. PVP_REWARDS remains held. Receipts: `artifacts/backend-offline-reward/` in the isolated worktree; Lead maintains the canonical batch note.

## 2026-10-02 07:45 (+04) — HANDOFF before /clear. READ FIRST, then the 10-01 evening entry below, then memory's NOW block
1. **LIVE c107068c** (curl release.json 07:40). Deploy lock `~/.claude/state/deploy_in_flight.json` absent at 07:40, so no
   run was in flight by that check.
2. **Done today:**
   - **Duel metrics on hosted, verified by me.** 202609300001 + 202610020001 (applied 10-01 19:54Z) and **202610030001_reconnects**
     (applied 10-02 03:25Z by Strategy per Lead, Dom's yes). All three: RLS on; anon/authenticated insert-only on listed columns
     (no select/update/delete); `reconnects smallint null, check 0..1000`; 0 rows yet. Advisors: nothing new on duel_metrics.
   - **SCOPE item 9 DONE**, receipt to Lead (#539 server_awards, #1211 fight_hash, #1060 verifier; triggers awards_verified,
     loot_claims_verified_one_way, loot_claims_rate; 6/6 claims verified; VPS loot sweep every 2 min on the live rev, errors []).
   - **#1281** (Duel: players can mint duel rooms, switch `DUEL_RELAY_PLAYERS`) reviewed: in-memory relay caps are enough, no DB cap.
     My R1 (refuse anonymous Supabase users) is on trunk (`is_anonymous !== true`, duel-relay.mjs:74). #1281 MERGED.
   - **#1286** duel health query (`docs/briefs/backend/duel-health.sql`, one read-only SELECT) MERGED. This entry's PR adds the
     `reconnects` columns to it (ran on hosted: works, 0 duels).
   - **Advisors 10-02:** no new WARN/ERROR since the security pass #1231. **S4 CLOSED** (Strategy saw Email provider OFF 10-01 22:28).
3. **Open, mine:**
   - **#1289** @06eca52f (migration file 202610030001), CI all green, body starts "HOLD … Do not merge". The migration is ALREADY
     APPLIED on hosted, so the file must now reach trunk: tell Lead the HOLD can lift (merge = docs of what is live).
   - **#1300** (Duel client, sends `reconnects`) is OPEN, shipping with the relay install + `DUEL_RELAY_PLAYERS=1` in one run.
     Its column is live, so it is no longer blocked by the database.
   - **Duel relay is NOT installed on the VPS** at 07:40 (no frankendom-duel-relay unit). That run installs it (Deploy).
   - **#1241** post-beta RLS initplan, DRAFT @577b1def: quality green; browser counter-heavy was cancelled by GitHub's 40-min
     job timeout during browser install (not the diff). Rerun that job when the queue is free. Goes to Dom after Saturday.
4. **Owed after Saturday's gate 4:** run `docs/briefs/backend/duel-health.sql` (set `params.since`) and send the one row to Lead +
   Strategy. Connect success = duels / relay `minted` count from `journalctl -u frankendom-duel-relay`.
5. **Rulings today** (memory `frankendom_item9_server_loot_2026-09-25.md`, NOW 10-02 block): in-memory relay caps suffice;
   reconnects = this page's relay socket re-opens after a loss, 0 if never dropped, peer's on its own row; Dom's yes covered 1003 only.
6. **Loose end, unchanged:** `~/Developer/frankendom-backend` (branch backend/server-standing-rank) has an UNCOMMITTED
   `scripts/awards-database-check.mjs` (+7/−2, checks `my_standing().pending`), owner unknown, untouched. Ask Lead before using it.
   Scratch worktrees under this session's scratchpad (`dh`, `rc`, `ho`) are disposable; no crons armed.

## 2026-10-01 evening (+04) — HANDOFF before /clear. READ FIRST, then memory's NOW block
1. **LIVE 4da6b84f** (release.json at save). **F2 one-fight-one-claim LIVE since a60d94a2** (#1211, run BS, migration
   20261001093106 202610010001_fight_hash). My hosted verify PASSED both halves: grants/revoke/5 indexes/policies; first sweep
   09:50:20Z hashed 17 (6 claims + 11 shares), errors []; 6 distinct verified hashes. Sweep receipts are in
   `/var/log/frankendom-verify-loot.log` on the VPS (NOT journald).
2. **Open, mine:**
   - **#1241 DRAFT (post-beta)** backend/rls-initplan @577b1def: P1+P2 from the security pass. CI quality was RED at 5558b2c5 on
     MY CHECK, not the migration: pg_get_expr prints EXISTS over several lines, so the split gave >5 lines. Fixed in 577b1def
     (expressions flattened to one line). **Next: confirm CI green on 577b1def.** Goes to Dom after Saturday with record-binding.
   - **#1231** (docs, security pass): no critical/high. **Dom must confirm the Email/password provider is OFF** (S4). Needs a
     Deploy merge (docs only).
   - **#1110 (Duel) carries my check commit 85f0aeb5** (duel_metrics bounds). If CI goes red on it, the fix is mine (Lead).
3. **Reviews done:** #1110 duel_metrics (no blocker); #1226 `result` column (no blocker; RUN ORDER: 202609300001, then 202610020001,
   both BEFORE #1226's publish; client always sends `result`, so out of order every metrics row is silently refused). Dom asks
   for both are with Strategy. **Owed after Deploy applies them:** a hosted read-only verify of duel_metrics + result.
4. **Post-beta, merged:** #1230 record-account-binding brief (server-issued seed via start_fight; daily fight_hash). Strategy's
   rulings are in it. No migration or src work before Saturday.
5. **Loose end, unchanged:** `~/Developer/frankendom-backend` still has an UNCOMMITTED `scripts/awards-database-check.mjs` (+7/−2),
   owner unknown. Left untouched on purpose; ask Dom or Lead before using it. Scratch worktrees under this session's scratchpad are
   disposable.

## 2026-10-01 (+04) — HANDOFF before /clear. READ FIRST, then the 09-30 16:20 entry below, then memory
1. **LIVE 714b5c43** (curl release.json, first seen 16:07:44Z on 09-30; VPS `/opt/frankendom-verifier/current` = 714b5c43).
2. **Went live:** **#1156** (Pit skull wall, `profile.loot.defeats`), merged in run BI as 714b5c43, head c4290bea. The Auditer's P2
   is fixed per Lead's ruling, "one win = exactly ONE skull, the legend at the fight level (the dial)". `legends.ts rungOf(level)` is the
   one source: portraitKey, legendForLevel and `loot.ts killAt(opponent, level, …)` (both take and decline provenance, built in main.ts
   from `match.level`). Fail-first test in tests/defeats.test.ts (dial at rungTopLevel(2) under rung 3 → ['goblin-2']); the mutant
   `rungOf(level+1)` gives ['goblin-2','goblin-3']. Auditer PASS on exactly c4290bea. Visible side effect: a dialled-down win's piece
   says "taken from <legend fought>", and its tint follows that legend's rung.
   Live receipt: the deployed VPS src, run in a throwaway copy (no DB), gives one skull each for a refusal and a take at level 10.
   NOT receipted: a real take/refusal tapped in the live page (needs a won dialled-down career fight; no force-win for non-admins).
   Told Lead; it's an admin phone check or the next local account-browser-check run. The Pit is told; #1160 rebases onto it.
3. **Thursday (Lead's order):** Deploy applies hosted migration **202609300001_duel_metrics** first, then Duel's #1110 / #1116.
   My verdict: **APPLY-READY** (sent to Lead and Duel). It copies the perf_beacons pattern: insert-only on 17 listed columns for
   anon/authenticated, every column range-checked, no identity/IP, a 60/min and 5000/day trigger cap, a 90-day prune. The client
   (#1116 lobby.ts) sends with `return=minimal`. The file is unchanged between #1110 heads 3793b421 and 8999a0c6.
   OWED after the apply: verify hosted with list_tables, has_table_privilege (anon/authenticated: insert only, no select), and
   get_advisors (nothing new). **No sim change from this lane before Sat 3 Oct** (Lead).
4. **Process:** merging a PR cancels its CI (cancel-on-close), so a cancelled run after GO is not a queue hold. Lead may hold the
   GitHub queue for a release run: no pushes or re-runs until "green". Disk/swap pressure: git and gh only when Lead says so.
5. **F2, one fight = one claim (2026-10-01):** Strategy ruled A+ now, built as PR #1211 (`202610010001_fight_hash` + verifier). **Post-beta (Strategy):** B, a server-issued fight id bound to the session and settled once (closes nudged-input copies and seed-shopping; needs a record bump + a fight-start call).
6. **Loose ends:** `~/Developer/frankendom-backend` is on branch backend/server-standing-rank (86c05b2d) with an UNCOMMITTED
   `scripts/awards-database-check.mjs` (+7/−2), owner unknown, left untouched. Scratch worktrees under this session's scratchpad
   (wt-defeats, wt-state) are disposable. #944 look-id CHECK is still a PARKED draft; do not apply on hosted.

## 2026-09-30 16:20 (+04) — HANDOFF before /clear. READ FIRST, then the 09-29 09:20 entry below, then memory
1. **LIVE 3fab84c4** (curl release.json 16:18). Deploy 1e3a743 was in flight at ~12:40 (the hook blocked local tests); no lock file seen at 16:18.
2. **Went live today:** a share link now shows the SAME fight to everyone (B3, Dom's Safari showed his own rank-10 Plague Doctor on a
   shared L1 fight): the replay page dresses both fighters from the record's level, wears no viewer loot, and the HUD shows the fight's
   rank until PLAY NOW (#1134, Lead ruling on the HUD). Its browser row in account-browser-check had a test bug that stopped run AV
   (encodeRecord is async → the stub stored {} → "no such fight"); fixed forward by #1152 (test only). Both are in 3fab84c4.
3. **NOT LIVE:** **#1156** (backend/defeats, draft) — the Pit's skull wall record `profile.loot.defeats` (portrait keys `<opp>-<rank>`,
   PORTRAIT_KEYS order), set on every career win at portraitKey(id, match.level), backfilled from tiered taken/declined kills, union
   merge, keepsLoot, onDecline now records its tier. No migration (loot jsonb). Lead ACKed design + both checks (byte-identical record
   test; Known permanent-loss list in the PR body). CI quality at 9131fa55 FAILED on tests/graphics.test.ts:1344: the Undo hold now
   stores the skull-only ledger, not `null` — correct behaviour, re-pinned to `{ loot: found }` in **283cebf2** (pushed;
   typecheck:tests exit 0; CI re-running).
   #944 look-id CHECK stays a PARKED draft; do NOT apply on hosted.
4. Sessions down: none known to this lane.
5. Rulings/findings today (memory `frankendom_item9_server_loot_2026-09-25.md`, 09-30 NOW blocks): kill link = self-contained
   (Strategy); HUD shows the fight's rank (Lead); Lead: no solo CI label, PRs ride combined runs; encodeRecord/decodeRecord are async
   (a node receipt through fetchSharedRecord catches stub mistakes without a browser); Known skull-loss cases accepted by Lead; the
   server-side rebuild of the wall from verified loot_claims is BACKLOG (not beta-blocking).
6. **QUEUE:** (a) #1156 @283cebf2: run `node --test tests/defeats.test.ts tests/match.test.ts
   tests/graphics.test.ts` when the Mac is FREE, green CI → un-draft → READY + sha to Lead [387ea1] (rides the run before the Pit's
   skull wall PR B; tell The Pit when merged). (b) Idle otherwise; Sentry HELD runbook from 09-29 still stands.
7. No crons. Worktree `.claude/worktrees/focused-snyder-60361a` on branch backend/defeats (node_modules symlink, untracked); reopen on
   ~/Developer/frankendom-backend with the worktree switch off. This entry: branch backend/state-handoff-0928 (PR #1044, docs only).

## 2026-09-29 09:20 (+04) — HANDOFF before /clear. READ FIRST, then the 09-28 23:15 entry below, then memory
1. **LIVE 88a85e64** (curl release.json 09:19). No deploy.sh running on the Mac at 09:19.
2. **Went live overnight:** the fight maths now gives the same result in every browser and on the server for new fights (#1057,
   record v20; Plague Doctor fights with the estoc). Old v18/v19 fights replay through the frozen old maths. The loot verifier's
   safety net (#1060, this lane) is also live: a v≤19 win the server can't reproduce, or can no longer read after a bump, is HELD, not
   lost. Sentry is told. Deploy clears it by hand with `--accept` after Backend replays it in real browsers. **Verified by this lane
   09:19:** VPS `current` = 88a85e64, the new verify-loot.mjs is there, `SENTRY_DSN=` is present in verifier.env (root:600),
   /var/lib/frankendom-verifier exists, the unit has StateDirectory, the timer is active, and the last sweep receipt carries
   `held: []` and `sentry: {sent: 0}`. Hosted loot_claims: 6 total, 6 verified, 0 unchecked, 0 HELD. perf_beacons: 82 rows (count only).
3. **NOT LIVE:** #944 (look-id CHECK) is still a PARKED draft; do NOT apply it on hosted.
4. Sessions down: none known to this lane (Lead's session was down around 05:00; Combat and Strategy were up).
5. Rulings/findings (memory `frankendom_item9_server_loot_2026-09-25.md`, 09-29 lines; `feedback_ask_lead_slot_before_local_tests.md`):
   - Replay divergence cause = engine numerics (atan2/sin, 1 ulp). Strategy ruling (b): v20+ uses detmath; v18/v19 keep the frozen
     native Math.
   - The VPS runs Node 22 (V8 12.4), a third engine, so v19 claims keep native-math risk. #1060 HELD covers it.
   - Stored kill links: 8 rows. 7 are too old to read. Id 8 replays identically on trunk, 2ccacd67 and c510057b. Claims 4 and 9 are
     identical. Plague Doctor claims 2/5/7 are refused on v20 by bump-20 REACH (estoc); they were already awarded, so no loss.
   - HELD reasons are exactly: divergence (the replay stepped, then diverged) and reach, both only at v≤19.
   - `--engines` must read "<engines> @<tick> on <rev>". A reach hold checks the header's opponent and outcome
     (peekRecordHeader); the level floor is checked on <rev>.
   - A bump that drops 19 from READABLE_VERSIONS gives a plain refusal, so Deploy must see pending = 0 first.
   - Local gate/DB runs on the Mac need a slot from Lead.
6. **QUEUE:** nothing owed. If Sentry shows a HELD claim, run the RUNBOOK in the scripts/verify-loot.mjs header: replay headless in
   Chromium and WebKit on the last build that reads the record, and run that checkout's refusal(row, standing). Then send the claim id
   and receipt to Lead, and Deploy runs --accept. The perf beacon count is done (82); report the spread to Lead and Web if they ask.
7. No crons. Worktree `.claude/worktrees/focused-snyder-60361a`, parked detached on trunk (reopen on ~/Developer/frankendom-backend
   with the worktree switch off). Branch backend/verifier-hold is merged. This entry is on backend/state-handoff-0928 (PR #1044,
   docs only).

## 2026-09-28 23:15 (+04) — HANDOFF before /clear. READ FIRST, then the 09-27 entry below, then memory
1. **LIVE e9107428** (curl release.json 23:15). No deploy.sh running on the Mac at 23:15.
2. **Went live today:** a win left with no last word is now claimed when the page closes (#943, pagehide + keepalive, browser row in
   account-browser-check); the awards DB check applies migrations in hosted's real order and proves 0001 cannot re-run (#749); the
   anonymous per-fight performance table (#1034, migration `202609280001_perf_beacons`, applied on hosted by Deploy ~22:34, history
   `20260928183410`; this lane's read-only verify PASS: 20 anon/authenticated INSERT columns, 18 CHECKs, no client select/sequence/execute,
   120/min + 20000/day caps, cron `frankendom_perf_beacon_retention` 23 4 * * *, view `perf_device_spread` security_invoker, advisor clean on perf_*).
3. **NOT LIVE:** Web's beacon client **#1035** (a7dd1dd5, out of draft, waits for its run). **#944** look-id CHECK widening stays a PARKED
   draft (237a6129): looks are whole-body swaps, not loot; do NOT apply on hosted.
4. Sessions down: none known to this lane.
5. Rulings / findings today (memory `frankendom_item9_server_loot_2026-09-25.md`, NOW block): Playwright routing never sees a fetch from
   an unloading page (real Chromium + WebKit do send keepalive cross-origin); Weapons' equip receipt = harness artifact (seeded session
   skips the sign-in merge; a held Take is never saved); retired loot ids must be in LOOT_IDS and out of LOOT (Combat's estoc branch,
   reviewed NO BLOCKER); `deploy.sh` flips the site's `current` a few seconds before the verifier's.
6. **QUEUE:** when Web says #1035 is live → read-only COUNT of perf_beacons (and the spread view) to confirm real rows land; nothing
   else owed. Idle otherwise; Lead routes.
7. No crons. Worktree: session folder `.claude/worktrees/focused-snyder-60361a` (reopen on `~/Developer/frankendom-backend`, worktree
   switch off). This entry: branch `backend/state-handoff-0928`, one-file docs PR.

## 2026-09-27 — Server loot claims LIVE (70a977ea); first verified award; READ FIRST, supersedes the 09-23 "Now" below
**Live.** Claims run = #621 (my_standing rank) + #778 (client outbox, with `supabase/ops/202609230001_rollback.sql`) + #751 (verify-loot
timer) + #914 + #919 (check 14's `rpc/my_standing` stub), published 70a977ea 2026-09-27 18:08:58 Dubai. Hosted steps by Deploy via MCP on
this lane's runbook: (a) unapplied receipt (history 17, 0001 objects absent, 64 KB cap live, profiles 2 / marks 115) → (b) ops row
`20260926181000 202609260001_loot_size` → (c) `apply_migration 202609230001_server_awards` (pins: sha256 85ab9d4e… / a20cb2d9…) → (d)
deploy.sh. First run 67d3d952 failed release check 14 (stub lacked `rpc/my_standing`); fixed by #919, re-run live. DB stayed applied.
**Verified by this lane** (read-only MCP + own ssh): history 19 (`20260927125023 202609230001_server_awards` last); 3 tables RLS on, 8
policies, 3 non-internal triggers, 5 functions; `my_standing` = `TABLE(marks, owned, pending, pending_owned)`; seed 2 rows / 115 marks /
28 owned = fighter_profiles at apply; anon nothing; authenticated: `my_standing` only, no `awards` write, no `verified` insert/update, no
seed read; verifier: `awards (claim_id, piece, tier)` insert only, `standing_of` execute. Advisor: only new finding = `my_standing`
callable by authenticated (intended). VPS `frankendom-verify-loot.timer` active, every 2 min, clean.
**Claim path PASS live:** the owner's signed-in Plague Doctor win → claim #1 `plaguedoctor.Body` posted 15:02:08Z (after Take's 4 s Undo),
verified 15:03:08Z, award `plaguedoctor.Body` tier 10; `standing_of(account, null)` = 116 (seed 115 + 1), owned 29.
**Rollback** (DOM-ONLY, typed word): stop the loot timer → old client → the ops rollback file. Proven on disposable Postgres (4 mutants).
**Open, this lane:**
- **#943** (pagehide claim, RUN 2): a win whose player never gives a last word and never returns was never claimed. On `pagehide` (not
  bfcache) the open entry goes final with the Undo-line take and posts with fetch keepalive; the global `record_hash` makes a re-post 23505,
  so one claim either way. Not on visibility-hidden (Lead accepted: a tab-switch must never forfeit a Take). Residual gap: a phone kills a
  hidden tab and he never returns. Browser row in `account-browser-check` after Lead's quiet window.
- **#944 PARKED as draft** (237a6129): widens both piece CHECKs to `(@[a-z0-9]{1,16})?`. Lead: looks are opponent whole-body swaps
  (#915), not loot, so there's no consumer. Do NOT apply on hosted. If looks ever become collectable, the tokens are `l1`–`l10`.
**Gotchas learned:** `standing_of`'s 2nd argument is a CLAIM ID (pass `null` for all); a bound like 2^63 excludes everything. Browser checks
that stub Supabase must answer every new RPC the client calls on sign-in (check 14). Disposable Postgres on this Mac needs `LC_ALL=C` or the
postmaster dies "became multithreaded".

## 2026-09-26 22:1x — 202609260001_loot_size applied on hosted (Lead's PR; Backend to re-verify with its own queries)
**Verified by this lane 2026-09-26 ~19:20Z** (Supabase MCP, read-only `execute_sql` + `list_migrations`): `fighter_profiles_loot_check`
is `convalidated` and reads `CHECK (jsonb_typeof(loot) = 'object' AND jsonb_typeof(loot->'owned') = 'array' AND jsonb_typeof(loot->'equipped')
= 'object' AND pg_column_size(loot) <= 65536)`, the other four CHECKs unchanged. `schema_migrations` ends at `20260923132228
202609230002_plaguedoctor_encounter`: 202609260001 is applied but unrecorded there, so the map below lists it as editor-applied. 2 profile
rows; largest loot 4437 B raw / 1013 B stored (one row over 4 KB raw, saving), max revision 41. `loot_claims` absent (0001 still unapplied).
Post-merge review of #857 (bbe3ea1d): sound. The migration re-runs cleanly as written (drop, then re-add under the same name), so no
`if exists` follow-up. Minor: `saveFailure` also calls a loot SHAPE violation (same constraint, 23514) "too large"; harmless while cleanLoot
guards the shape.
**Applied on hosted 2026-09-26 22:1x by Strategy**, in the owner's signed-in Supabase SQL editor (no session had the MCP or a DB URL),
as the file's two statements; NOT via `apply_migration`, so it is **not in `schema_migrations`**: add it to the map above.
Receipts relayed by Strategy (not yet this lane's own): before, `fighter_profiles_loot_check` ended `pg_column_size(loot) <= 4096`;
after, `<= 65536` ("Success. No rows returned"). The owner's row at the time: 789 bytes, owned 23, revision 39 (the last save that fit).
Cause: 0004's 4 KB cap sat below legitimate client writes (declined alone at its cap of 50 ≈ 4.9 KB), so every larger save hit
check_violation 23514 and the client showed "changed on another device" for it. The same PR splits that line (src/cloud-profile.ts
saveFailure): conflict / too large / failed + Sentry. Local proof: account-database-check PASS with the file; FAILS without it on the
new >4 KB assertion with exactly the hosted error. Owner's cap ruling: 64 KB ("keep it 64kb"). Open: rate limiting and loot-JSON shape
validation on the write path are the only abuse controls besides this backstop (shape: the CHECK's type tests + client cleanLoot) —
a follow-up for this lane, not a blocker.

**Standing rule (Dom, 2026-09-27, via Strategy to every lane):** "dont set fake extended deadlines or times, everything is NOW or ASAP."
The only deadline this lane gives Dom, Lead or Strategy is NOW or ASAP; if today is physically impossible, name the physical blocker
(deploy in flight, box load, a red gate, CI running), never a day.

## Now — pick up here (2026-09-23)

**Review Stats' deliverable 3 before it goes READY** (beta item 3, "server-controlled gear bonuses"; assigned by Strategy 2026-09-23).
The server decides the loot award; the client cannot grant itself gear. Look hardest at the **record/verifier path** and **any
migration** (RLS, grants, who can write the award). Wait for Stats' heads-up with the branch; send the verdict to Stats and copy
**both Lead and Strategy** (Strategy, 2026-09-23: Lead is active again and lanes report to Lead). Deploy applies any migration — this lane reviews and verifies after, never applies.
Authority for scope: **`docs/SCOPE.md`** (PR #492) wins over every older brief, state entry or memory line, this file included.
Line 20: *"Loot awards become server-authoritative before stats touch a fight"* — it replaces Brief 5's cosmetic-only rule, so the
0004 rule below ("client-reported loot, never competitive authority") **ends with this deliverable**.
**Agreed design — Stats accepted all of it 2026-09-23; review the branch AGAINST this.** **Strategy RULED 2026-09-23 — unblocked; Stats builds, PR through Lead.** (1) `loot_claims`: owner-only insert, size + rate caps, **unique on `sha256(record)` globally** (one award per fight; first
claimer wins, so the client posts the claim *before* offering Share). **No `piece` for armour** — `dropFor` (src/loot.ts:65) is
deterministic, so the verifier computes it; `piece` only for the "Take one" weapon choice, validated by the verifier **importing
`src/loot.ts`** (no LOOT mirror in SQL — one list, two readers). (2) `awards(claim_id pk references loot_claims(id), piece, tier,
awarded_at)` with **no `user_id` column**; owner-select via the join; verifier gets `insert (claim_id, piece, tier)` only + a trigger
refusing unverified claims — so a leaked verifier credential cannot mint loot for an arbitrary account. (3) **Marks: RULED (a)** — the verified-claim ledger *is* the mark ledger (one verified ladder win = one mark); `victory_marks`
and `owned` are caches. (b) rejected: a record-carried rung is replay-checked only once the sim reads the tier (deliverable 5), and
awards land before that. **Grandfather, not reset:** `account_seed(user_id pk, marks 0–100000, owned jsonb, seeded_at)`, written
**once by the migration** via `insert … select` from `fighter_profiles` at apply time (never hardcoded — no account uuid/loot in
git; the receipt logs a non-identifying summary), no client grant, not re-runnable. Server marks = `seed.marks + count(verified
wins)`; server owned = `seed.owned ∪ awards`; `awards` stays verified-only. **Guests:** device-only cache, no server award; on
guest→account the account's server marks start at **zero** from its first verified win, so a forged guest cache never becomes rank.
**Acceptance = the DB check, every case mutation-tested:** client cannot write `awards`; client cannot flip a claim's `verified`;
verifier cannot award a nonexistent claim; second award per claim refused; owner sees only own awards; anon none; duplicate record
hash refused; claim caps trip; plus Strategy's four — **seed** (fixture profile seeded exactly, once), **verified win** (server marks = seed + 1, drop =
`dropFor` at the server's subRank), **guest convert** (no seed row → 0, first verified win → 1), **forged cache rejected** (client writes
`victory_marks = 100000` + an Origin piece → server marks/owned unchanged). **Out of Stats' scope, flagged:** records carry no account binding — a record-format change, **Lead's next item** after this (Strategy); same hole in
`daily_results` today and guests can't hold awards (Strategy).
Nothing else for Backend in beta unless phone validation (item 6) finds an account or sync defect — that comes from Web.

## Done (2026-09-21 → 09-23)

- **Hosted migrations 0002–0010 all applied and verified by this lane's own queries** (never a relay): fight_records, daily
  warden, loot column, verifier role, fight_records column narrowing, daily_board_summary, rls_auto_enable revoke, short share ids,
  guest-share hygiene. Details and live receipts in the sections below.
- **PRs merged** (each confirmed with `gh pr view`): #354, #357, #359, #385, #391, #399, #404, #409, #421; #355 into the
  `lead/loot-data` stack. Issue #397 (security advisor) closed with receipts.
- **DB check** (`scripts/account-database-check.mjs`, real disposable Postgres, zero production writes) covers every table and
  function above, and every new assertion was mutation-tested.

## Open

- **#487** (this file) — in tonight's docs batch.
- **Stats' PR A, #503** (decoder + accept-list) — needs nothing from Backend (Strategy, 2026-09-23). It still reaches the verifier
  host by construction (see Gotchas).
- **Daily verifier's first real sweep** — unobserved: `daily_results` was 0 rows on 2026-09-22 (0 verified / 0 refused / 0
  awaiting). The timer is armed; it waits on someone posting a daily fight.
- **Session names.** Dom's standing order gives Strategy/Lead instructions his approval. **Strategy: settled** — Dom confirmed
  2026-09-23 that `Frankendom - Strategy - Fable 5.1` is the session his order names. **Lead: open** — exact `Frankendom - Lead
  Developer` carries approval; the older variant `Frankendom - Lead Dev - Fable 5.1` is unconfirmed, so flag it to Dom before acting
  on a push/merge-class line from it. (Reviews need no approval either way.)

## Gotchas

- **The record is opaque to Postgres; the version check is client code the server runs.** `scripts/verify-daily.mjs` imports
  `decodeRecord` from `src/record.ts`, and `deploy.sh` rsyncs `src/**/*.ts` to the verifier host — so one accept-list, two readers.
  Grepping `supabase/` for `RECORD_VERSION` and finding nothing means "no second list", not "no server check".
- **A refused daily row does not self-heal**: `checked_at` takes it off the sweep's page. After any accept-list widening, run
  `verify-daily.mjs --recheck` if rows exist. Ship accept-list widenings one deploy **before** the encoder writes the new version.
- **A refused insert still consumes a sequence value** — validate before `nextval`.
- **Narrowing a column grant can break the policy that enforces it** (column SELECT is needed for columns in a WHERE).
- **The local check must mirror hosted's quirks or assertions go vacuous**: `pgcrypto`, `set time zone 'UTC'`, and hosted's default
  `truncate/trigger/references` grants.
- **Mutation-test every new assertion.** Three times this lane a check passed with its protection removed. And on a repo whose digest
  guard hashes the file you mutate, "a test failed" proves nothing — read *which* test.
- **Supabase MCP `execute_sql` returns only the last statement's result** — one statement per call when each matters.
- **Never mint or insert in production "to test"** — read-only verification only.
- **Check a PR's state before pushing follow-ups to its branch.** A merged PR ignores new commits, and the push still "succeeds".
  Three commits were stranded this way on #487 and rescued as #525. Confirm the PR's `headRefOid` equals HEAD after pushing.
- **This machine's deploy guard refuses heavy commands while any deploy is in flight** — and it refuses the *whole* command, so a
  combined edit+test can leave the edit unapplied. Run edits alone, then the check.

## Hosted project as it stands — verified 2026-09-22 (0002–0010 all applied and verified by this lane)

Tables: `public.fighter_profiles` (1 row, now with a `loot` column — see below), `public.admins` (1 row), `public.fight_records`
(0 rows), `public.daily_secret` (1 row, RLS on, unreadable — see below), `public.daily_results` (0 rows, RLS on). View
`public.daily_board` and function `public.daily_fight()` both exist (confirmed directly via `pg_views`/`pg_proc`, since `list_tables`
doesn't enumerate views). `auth.users`: 2. Role `frankendom_verifier` exists (`rolcanlogin = true`). Hosted migration history
(`supabase_migrations.schema_migrations`): `20260920031013 werewolf_skeleton_encounters`, `20260920031925
revert_werewolf_skeleton_encounters`, `20260920041658 werewolf_skeleton_encounters_v2`, `20260920055946
werewolf_skeleton_encounters`, `20260920070348 victory_marks`, `20260920083450 dwarf_encounter`, `20260921065907 admins`,
`20260921200632 202609210002_fight_records`, `20260921211439 202609210003_daily_warden`, `20260921211755
202609210005_daily_verifier`, `20260921214151 202609210004_loot` (applied out of numeric order relative to 0005 — fine, ordering was
constrained by each migration's own PR/deploy timing, not by file number). The first two repo files
(`202609190001_fighter_profiles`, `202609190002_creature_encounters`) were applied by hand and are not in the history; the
werewolf/skeleton change was applied three times with one revert. The history is therefore NOT `supabase db push`-able against the
repo; applies stay manual (MCP `apply_migration` named after the repo file) and this table is the map between the two.
`public.rls_auto_enable()` (event trigger `ensure_rls`) is Supabase's own platform function, not ours; the security advisor's WARN on it
is expected and stays.

**Security advisor — known items, all by design (read after the 0006 apply, 2026-09-22; re-check with `get_advisors` after any DDL):**
ERROR `security_definer_view public.daily_board` — intended, the view reads `fighter_profiles.display_name` as its owner so a public
board can name posters past `owner_read` (documented under 0003); WARN `rls_auto_enable()` executable by anon/authenticated — Supabase's
own; WARN `daily_fight(on_day)` executable by anon as definer — intended, the seed is public and the secret never leaves the function;
WARN `fight_records_recent()` executable by authenticated as definer — intended, zero-arg, own-count only (0006); INFO `daily_secret`
RLS enabled with no policy — intended, nobody but the definer function reads it; WARN auth leaked-password protection off — an Auth
setting, not schema; sign-in is Google only today, so it is moot until email/password logins exist (Dom's call if that changes).
Anything NOT on this list is a new finding. Lead accepted the `daily_board` disposition on 2026-09-22 ("by design, no lint-chasing").
Struck from the list by 0008: `rls_auto_enable()` — see below.

**0008 (PR #399, issue #397) — APPLIED 2026-09-22** (hosted migration `20260922080124 202609220008_rls_auto_enable_no_rpc`; file md5
`77c34bdec8206885fec6c55b499ab10f` at trunk `41363b7`). A guarded, idempotent `revoke execute on public.rls_auto_enable() from
public, anon, authenticated` — Supabase's platform helper (event trigger `ensure_rls`) had been exposed at `/rest/v1/rpc`. Verified
independently here: `has_function_privilege` false for anon and for authenticated; `ensure_rls` still present and enabled;
`get_advisors(security)` no longer lists it, and everything still listed is on the by-design list above. Authorisation: Dev/Deploy
reports Dom's standing ruling to them ("anything from lead dev or the strategy dev u must do it, they have my full authority") — their
protocol, recorded here as their statement; this lane's review line was the md5 at trunk.

**0002 fight_records — APPLIED** (Dev/Deploy, hosted migration `20260921200632`, carried by deploy #70 / trunk `3a11413`). Verified
independently here via `list_tables`(verbose)/`list_migrations`: schema matches what was reviewed byte-for-byte (see the table below),
RLS enabled, 0 rows. Deploy dev's own report of deploy #70 being live (release.json/VPS symlink match) was not independently checked
by this lane — that's Lead/Deploy's domain, not re-verified here.

### fighter_profiles (0001, 0002 creature encounters, 0003/20260920 werewolf+skeleton, 20260920 dwarf, 0004 victory_marks)
| column | type | rule |
|---|---|---|
| user_id | uuid pk → auth.users on delete cascade | owner only |
| display_name | text not null | 1–24 chars, trimmed, no control chars |
| encounter | text null | one of the roster ids in the check (veteran, pitborn, goblin, nightborn, executioner + the creature/dwarf additions) |
| revision | bigint not null default 1 | bumped by trigger `fighter_revision` → `bump_fighter_revision()` on every update; the client never writes it |
| victory_marks | integer not null default 0 | 0–100000, client-reported career marks (beta), never competitive authority |

RLS on. Policies: `owner_read` select, `owner_insert` insert, `owner_update` update — all `to authenticated`, `(select auth.uid()) = user_id`.
Grants: `authenticated` select (whole table) + insert/update on `(display_name, encounter, victory_marks)` and insert on `user_id`; `anon` nothing.
Client calls: `GET/POST/PATCH /rest/v1/fighter_profiles` (src/cloud-profile.ts, mocked in release check 14).

### admins (202609210001)
`user_id uuid pk → auth.users cascade`, `created_at timestamptz default now()`. RLS on; policy `self_read` select to authenticated on own row;
grant `select (user_id)` to authenticated only. No client insert/update/delete path exists (proven in `scripts/account-database-check.mjs`).
Rows are owner-managed in SQL. Current roster: one row (dom123dxb, inserted by the lead via SQL on Dom's word, 2026-09-21).
Client call: `GET /rest/v1/admins?select=user_id&user_id=eq.<uid>` (src/cloud-profile.ts `readAdmin`).

## After 202609210003–0005 land (files in PRs #327, #330, #348 — reviewed by this lane 2026-09-21; NOT applied yet)

Apply order and carrier, per Dom's standing yes in the deploy session: 0002 applied (above), 0003 at #327's deploy, 0004 BEFORE #330's
code, 0005 at #348's. All are additive: the live client is unaffected by an early apply. Dev/Deploy applies; this lane verifies after.

### fight_records (0002 + 0006) — APPLIED, schema below as it exists on the hosted project today
| column | rule |
|---|---|
| id text pk | `^[A-Za-z0-9_-]{8}$`, client-chosen; a collision is a 23505 the client must retry |
| user_id uuid → auth.users cascade | owner; never readable by a client |
| opponent text | 1–32 chars |
| record text | ≤ 16 KB, base64url alphabet (src/record.ts encoding) |
| created_at | default now(); never readable by a client |
Index `(user_id, created_at desc)`. RLS on. Policies: select `to anon, authenticated using (true)` (a shared link is public by intent —
the row, not every column); insert `to authenticated` with check `auth.uid() = user_id and public.fight_records_recent() < 30`.
No update/delete policy or grant. Grants: select **`(id, opponent, record)` only** to anon+authenticated; insert `(id, user_id,
opponent, record)` to authenticated. `fight_records_recent()`: zero-arg, `security definer`, `search_path=public`, counts the
CALLER's own rows in the last hour (`user_id = auth.uid()`); execute to authenticated only (not anon) — it takes no id, so it can
report nobody else's count. Client calls: `POST /rest/v1/fight_records` (src/share-store.ts), `GET
/rest/v1/fight_records?select=record&id=eq.<id>`.

**0006 (PR #359) — APPLIED 2026-09-22 on Dom's typed "apply" in Dev/Deploy's session** (hosted migration `20260922072149
202609220006_fight_records_select_columns`; file md5 `fe2218e6a3b9de7aac15ce3d36fc7cb9` at trunk `dcb9d61`, byte-identical to the
reviewed head). Verified independently here, fresh queries: `set role anon; select id, opponent, record from fight_records` resolves;
`select user_id …` → `42501 permission denied`; `select created_at …` → `42501 permission denied`; `pg_proc`: `fight_records_recent`
`pronargs = 0`, `prosecdef = true`, `proconfig = search_path=public`, execute grantees `postgres, authenticated`; `pg_policies` insert
`with_check = ((auth.uid() = user_id) AND (fight_records_recent() < 30))`; select column grants for both roles exactly `id, opponent,
record`. Why it exists: 0002's whole-table select let anyone with the publishable key list every sharer's `user_id` and `created_at`
(Auditer finding); narrowing it broke the insert policy's own rate-limit subquery, hence the definer function; an earlier draft took a
`uid` argument (any signed-in player could have queried another's count) — fixed before merge. Security advisor after apply
(Dev/Deploy's read, consistent with the design): the only 0006 item is the expected WARN "authenticated can execute SECURITY DEFINER
fight_records_recent()".

### daily_secret / daily_fight() / daily_results / daily_board (0003, PR #327) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921211439 202609210003_daily_warden`, head lead/daily-warden `8550b1d`). Verified
independently here (fresh `list_tables`/`list_migrations`/`pg_views`/`pg_proc` plus role-scoped queries, not taken on Dev/Deploy's
report): `daily_secret` (1 row, RLS on) and `daily_results` (0 rows, RLS on) exist; `daily_board` view and `daily_fight()` function
both exist; `set role anon; select count(*) from daily_board` resolves (0); `daily_fight()` for tomorrow (UTC) returns no row, for
today returns `{day, number:-1, seed}` — `-1` is correct, day zero is `2026-09-22`.

The narrowed `daily_results` select grant was verified both ways, not just the refusal: `set role anon; select user_id from
daily_results` → refused (`42501 permission denied`); `set role anon; select day, number, opponent, weapon, outcome, ticks, location,
taken, verified, created_at from daily_results` → resolves (empty, no error) — so the grant is scoped, not accidentally revoked
entirely. Not that the client needs direct table access at all: confirmed in `src/daily.ts` (trunk) that the client only ever
`insert`s into `daily_results` and reads exclusively through the `daily_board` view (`fetchDailyBoard`) — the table-level select grant
on the permitted columns is defensive/pattern-consistency with `fight_records`, not load-bearing for anything shipped today.

**OPEN ACTION for Lead (not resolved by this lane, tracked here so it isn't lost — recorded 2026-09-22, not verified against the live
client code by me, only described by Lead in chat):** the client maps `number` to a rung with a positive modulo (`src/daily.ts:21`),
so `-1` plays the last rung safely, but the banner reportedly reads "Daily #-1" / "Daily #0" before the count is right for a player.
Proposed fix (Lead's, not this lane's, and NOT independently checked against `main.ts` here): show `number + 1` in the three banner
strings (`main.ts:385/390/401`) and the share text. Do **not** "fix" the check constraint — `day` zero staying `2026-09-22` in the DB
is correct and intentional. Lead owns this in the PR after #327; strike this note once it ships.

File content, as applied:
- `daily_secret (id boolean pk default true check (id), secret text)`: RLS on, no policies, all grants revoked from anon/authenticated;
  one row `encode(gen_random_bytes(32),'hex')`. The migration now opens with `create extension if not exists pgcrypto;` — hosted
  Supabase already has it enabled, this is a no-op there; the local RLS check's `initdb` cluster does not, so this line is required
  for the check to run at all (CI caught its absence).
- `daily_fight(on_day date default today-UTC) returns (day, number, seed)`: `security definer`, `set search_path = public`, stable; execute
  revoked from public, granted to anon+authenticated. `number = on_day - 2026-09-22`; `seed = first 8 hex of md5(day||secret) as int4`
  (the client uses it unsigned, `>>> 0`). The security advisor will WARN "anon can execute a definer function" — intentional, the seed is
  public by design and the secret never leaves the function. Now has `where on_day <= (now() at time zone 'utc')::date`, so a future
  day returns no row; `src/daily.ts fetchDaily` already treats that as "no daily warden today," no client change needed.
- `daily_results`: pk `(day, user_id)` = "insert own once"; `number int`, `opponent`/`weapon` 1–32, `outcome in (killed, died, draw,
  abandoned)`, `ticks 0–100000`, `location in (head, torso, legs) null`, `taken 0–1000 default 0`, `record` ≤ 16 KB base64url,
  `verified boolean default false` (server-only), `created_at`. Index `(day, outcome, ticks)`. RLS on. Policies: select public
  (anon+authenticated); insert to authenticated with check `auth.uid() = user_id and day = today-UTC`. No update/delete for clients.
  Grants: insert `(day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record)`; select is now the narrowed column
  list `(day, number, opponent, weapon, outcome, ticks, location, taken, verified, created_at)` — `user_id` and `record` (the day's raw
  input stream, i.e. the solution to a one-attempt fight) are excluded, closing what a direct `/rest/v1/daily_results?select=*` call
  could otherwise read even though the board view never carried them. Also has `check (number = day - date '2026-09-22')`, so a client
  cannot post a mismatched day/number pair. Neither needs a client change: the board view still resolves (next line), and #327's insert
  already sends the derived `number`.
- `daily_board` view: the day's rows joined to `fighter_profiles.display_name`, never `record` or `user_id`; select granted to
  anon+authenticated. The view has no `security_invoker`, so it reads `fighter_profiles` as its owner — that is what lets a public board
  show a poster's display name past `owner_read`; the advisor will flag it (lint 0010), accepted and documented here.
Client calls: `POST /rest/v1/rpc/daily_fight`, `GET /rest/v1/daily_board?select=*&day=eq.<day>&order=created_at.asc&limit=200`,
`POST /rest/v1/daily_results` (src/daily.ts) — all three already in the check-14 mock on the #327 branch.
**Verifier follow-ups (owned here, after #348 merges):** `taken` and `location` are client-reported and feed the "cleanest kill" and
"where he killed people" boards, but `verify-daily.mjs` compares only opponent/weapon/outcome/ticks/seed/profile — the replay must also
confirm `taken` and `location`, and boards must rank verified rows only.

### fighter_profiles.loot (0004, PR #330) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921214151 202609210004_loot`), ahead of #330's code merge as required. Verified
independently here (fresh `information_schema.columns`/`pg_constraint`/`information_schema.column_privileges`, not taken on
Dev/Deploy's report): `loot` column exists, `jsonb not null`, default `'{"owned": [], "equipped": {}}'`; check constraint
`fighter_profiles_loot_check` matches exactly — object type, `owned` is an array, `equipped` is an object, `pg_column_size ≤ 4096`;
column grants are `insert`/`select`/`update` to `authenticated` only (no `anon`). Client-reported cosmetics; `src/loot.ts cleanLoot`
validates on read (known ids only, worn ⊆ owned). Never rank/result/unlock authority.

**All four beta migrations (0002–0005) are now applied and independently verified.** Only `0006` (fight_records privacy fix) remains
open, held for Dom's direct word.

### Short share ids + guest hygiene (0009, PR #409; 0010, PR #421) — APPLIED, verified live
One short id for every share (Dom via Strategy: a kill link ran to several WhatsApp screens). Hosted migrations `20260922085012
202609210009_short_share_ids` and `20260922095721 202609220010_guest_share_hygiene`; both verified here by this lane's own queries,
read-only (no row was minted in production — that would publish a junk share as id `1`).

- `share_ids` sequence + `to_base36(bigint)` (internal, no client execute) → ids are lowercase base-36, 1–6 chars, sequential
  (999,999 = `lflr`). `fight_records.id` check admits `^[a-z0-9]{1,6}$` **or** the old `^[A-Za-z0-9_-]{8}$`, so every old link keeps
  resolving. `user_id` is nullable: guests share with no owner (FK kept). **Enumerable by design** — a shared fight is public by
  intent and the row exposes only `(id, opponent, record)` (0006).
- `mint_share(record, opponent)` — `security definer`, `search_path=public`, execute to anon+authenticated, the only write path for a
  share. Order: validate input → per-caller cap → global backstop → row ceiling → `nextval` → insert. Validation precedes `nextval`
  because a refused insert still consumes a sequence value (sequences are not transactional), so bad input must not lengthen
  everyone's ids. Client: `POST /rest/v1/rpc/mint_share {record, opponent}` → the id as a JSON string (check-14 mock knows it).
  Errors: `check_violation` for bad input; `P0001` `thirty shares an hour` / `too many shares from here this minute` /
  `too many guest shares this minute` / `guest shares are full`. Lead's ruling: no long-form URL fallback (Dom: "never the long
  form") — a capped guest sees "Couldn't make a link, try again."
- `share_limits` — one owner-managed row, **no client grant at all** (`set role anon; select * from share_limits` → 42501):
  `guest_per_minute` 600 (global backstop), `guest_per_key_per_minute` 10, `guest_salt` (32 hex), `guest_rows` 50000 (ceiling),
  `guest_days` **30** (Dom's override of Strategy's 90: "30 days live"; signed-in shares are never pruned). Changing a number is an
  `UPDATE`, not a migration.
- Per-caller bucket: `mint_share` reads `cf-connecting-ip` / first `x-forwarded-for` from `request.headers` and stores it **only** as
  a salted SHA-256 in `fight_records.guest_key` — outside the 0006 select grant (both roles: `has_column_privilege(... 'guest_key',
  'select')` = false), with a `^[0-9a-f]{64}$` check so a raw address can never land there. No header (direct SQL, the verifier, the
  local check) or an unparseable one → no key → backstop only, never an error.
- Retention: `prune_guest_shares()` (definer, execute owner-only) deletes guest rows older than `guest_days`; pg_cron job
  `frankendom_guest_share_retention` `17 4 * * *`, `active = true` (verified live; pg_cron was available-but-not-installed on hosted,
  the migration installs it — the local check cluster has none, so that assertion is guarded and the job row is verified live).
- Hygiene: `truncate, trigger, references` revoked from anon/authenticated on `fight_records`, `daily_results`, `daily_board`
  (Supabase's default-grant residue; `has_table_privilege('anon','public.fight_records','truncate')` = false). The local check's
  bootstrap now mirrors that residue — without it the revoke assertion was vacuous, which a mutation test exposed.

### daily_board_summary(on_day) (0007, PR #385) — APPLIED, verified live
Auditer finding 2026-09-22, confirmed independently on trunk `c789ed7`: the client paged `daily_board?order=created_at.asc&limit=200`
and ranked locally (the 201st poster's better result never showed) with `verified` as a tie-break only (a pending row could lead).
`daily_board_summary(on_day date default today-UTC) returns jsonb` — `{day, fastest_kill, cleanest_kill, longest_survived,
fastest_death, where, pending}`: each headline is the best row of the day ordered `verified desc, <metric>, created_at asc` (a pending
row leads only when nothing on that line is verified, still `verified=false`); `where` counts **verified** deaths by location
(client-reported until replayed); `pending` = unverified rows that day. Runs as the caller over `daily_board` (no definer; public
columns only, never `record`/`user_id`); execute to anon+authenticated. **Applied** (hosted migration `20260922074002`); verified here
as anon: seven keys, `prosecdef = false`, `search_path=public`, no `record`/`user_id` in the payload. Live `8650fc5` carries the #385
client and the function predated that deploy, so there was no 404 window. Client: `src/daily.ts fetchDailySummary` → `POST
/rest/v1/rpc/daily_board_summary {on_day}` (new REST path; check-14 mock updated in the same PR); `fetchDailyBoard` removed.
Proven in `account-database-check.mjs`: 201st-row fastest wins; pending never leads a verified row; pending deaths excluded from the
split; another day never leaks; tomorrow empty; no `record`/`user_id`. Mutation-tested four ways + the check-14 route removal.
**Post-apply verification owed here:** `select public.daily_board_summary(current_date)` as anon resolves; Auditer re-verifies the
deployed board.

### frankendom_verifier role + daily_results.checked_at (0005, PR #348) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921211755 202609210005_daily_verifier`, PR #348 merged `bca49b9`). Verified
independently here (fresh queries against pg_roles/information_schema/pg_proc/pg_policies, not taken on Dev/Deploy's report):
`frankendom_verifier` role exists with `rolcanlogin = true`; `daily_results.checked_at` column exists; column grants are exactly
`select` on `(day, user_id, opponent, weapon, outcome, ticks, record, verified, checked_at, created_at)` and `update` on
`(verified, checked_at)` — 10 select columns + 2 update columns, matching the reviewed file exactly, nothing extra; `execute` on
`daily_fight(date)` confirmed via `has_function_privilege`; both RLS policies (`the verifier reads every result` SELECT, `the
verifier marks results verified` UPDATE) confirmed scoped to `frankendom_verifier` only. **Not independently checked, and never
will be by this lane:** the password itself and Dev/Deploy's `select current_user` connection test — this lane never holds that
credential, so that half of their report is taken as theirs to state, not verified here. `alter table daily_results add column
checked_at timestamptz` (refused rows are stamped so the sweep moves on; `--recheck` revisits). The VPS connects through the
Supabase pooler as `frankendom_verifier.rxbewmzmovelckzoosss`.

**#348 arming checklist (takeover from Dev/Deploy; read from their PR branch, not written by this lane — no VPS writes here):**
1. ✅ DONE — 0005 applied, `frankendom_verifier` exists and its grants verified against the above, independently, this lane's own queries.
2. ✅ DONE (Dev/Deploy's own report, password itself not and never independently checkable by this lane) — they generated the
   password, ran `alter role frankendom_verifier password '<generated>';` at apply time, wrote it straight into
   `/etc/frankendom/verifier.env` (root:600, confirmed by their own `stat`) on the VPS. This lane never held or set the secret.
3. `/etc/frankendom/verifier.env` on the VPS (Dev/Deploy writes; root:600, checked by `deploy.sh` before it arms the timer):
   ```
   DATABASE_URL=postgres://frankendom_verifier:<password>@<pooler-host>:<pooler-port>/postgres
   ```
   (the `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pair is `verify-daily.mjs`'s alternate route — a service-role key bypasses RLS
   entirely, wider than this role needs, so the scoped `DATABASE_URL` role is the one to use, not the service-role fallback.)
4. `scripts/deploy.sh` (already in #348) rsyncs `src/**/*.ts`, `scripts/verify-daily.mjs` and the two `ops/frankendom-verify-daily.*`
   unit files to `/opt/frankendom-verifier/<revision>`, symlinks `current`, and — only if `verifier.env` already exists at root:600 —
   installs the units and runs `systemctl enable --now --quiet frankendom-verify-daily.timer`. Until the env file exists, it ships the
   code and leaves the timer alone (prints why); this is deploy.sh's existing behavior, not something new to build.
5. Unit shape: `frankendom-verify-daily.service` is a `oneshot` running `node scripts/verify-daily.mjs` with that env file, logging to
   `/var/log/frankendom-verify-daily.log`; `frankendom-verify-daily.timer` fires it every 2 minutes (`OnBootSec=2min`,
   `OnUnitActiveSec=2min`). `node scripts/verify-daily.mjs --dry` replays without writing; `--recheck` re-sweeps refused rows.
4. DONE per Dev/Deploy's report (VPS state, not checkable by this lane — no VPS/SSH access in this lane's tools): deploy #72
   (`bca49b9`) is live, `frankendom-verify-daily.timer` confirmed active+enabled via their own `systemctl` check.
5. Unit shape (reference, unchanged): `frankendom-verify-daily.service` is a `oneshot` running `node scripts/verify-daily.mjs` with
   that env file, logging to `/var/log/frankendom-verify-daily.log`; `frankendom-verify-daily.timer` fires it every 2 minutes.
6. OPEN — waiting on Dev/Deploy's promised first-sweep receipt, then this lane confirms independently: a `daily_results` row moves
   from `verified=false` to `true` (or gets `checked_at` stamped with a refusal reason). Not yet posted; there are no `daily_results`
   rows to sweep yet either (table was 0 rows as of the last check), so the first real signal may wait for an actual daily post.

## Admins workflow — proposal (week item 4; nothing built)

Today: `public.admins` has one row (dom123dxb, inserted by the lead in SQL on Dom's word). The client reads only its own membership
(`readAdmin`, `src/cloud-profile.ts:36`) and `src/account.ts:58` reveals the journal test tools on `true`; no client insert/update/delete
path exists (proven in the DB check). The question was: how does a second admin get added without SQL?

**Recommendation for beta — no code:** the Supabase Dashboard. Authentication → Users lists every account by email with its uuid;
Table Editor → `admins` → Insert row → paste the uuid. Two clicks, owner-only (dashboard access is Dom's), audited by Supabase's own
log, nothing dormant in the schema. With a roster of one or two, a built flow is a liability, not a feature (Strategy: build nothing
dormant). This lane verifies each addition after the fact (`select count(*) from admins`) and records it here.

**Designed, not built — for when admins multiply (an in-game "Admins" line in the test tools):**
- `alter table admins add column granted_by uuid references auth.users, add column note text check (char_length(note) <= 80)`.
- `admin_grant(email text)` / `admin_revoke(email text)`: `security definer`, `set search_path = ''`, execute to `authenticated` only;
  the FIRST statement refuses unless `exists (select 1 from public.admins where user_id = auth.uid())` — the check lives inside the
  function, the client is never trusted to be an admin. Resolves `email` → `auth.users.id` (case-folded), inserts/deletes the row,
  stamps `granted_by = auth.uid()`. `admin_revoke` refuses to remove the last admin and refuses `auth.uid()` itself unless another admin
  exists. Returns nothing but success/failure; the only thing it reveals to an admin is whether an email has an account — acceptable
  for admins, not for anyone else (hence no `anon` execute).
- Client: `POST /rest/v1/rpc/admin_grant` / `admin_revoke` (two new REST paths → check-14 mock) from an "Admins" row in the test-tools
  block, already gated by `showTools(admin)`. DB-check cases: a non-admin calling either → refused; an admin grants by email → row with
  `granted_by`; revoking the last admin → refused. Bootstrapping the first admin stays SQL (done).

## Designs, not built (week item 5) — the RLS shape and what the client may write

### Ghost storage (PvP as ghosts first — Strategy's "friend's echo")
A ghost is a fighter another player can be thrown against: the look (rig, weapon, equipped loot) plus the warden's behaviour profile
of that player. Behaviour, not rank: `Habits` (`src/ai.ts:11` — ticks, guard, parries, rolls, steps, lights, heavies, thrusts, kicks,
attacks…) is exactly what the warden reads live, so a stored `Habits` drives the same `readOpponent` path with no new AI.
- `public.ghosts (id text pk check '^[A-Za-z0-9_-]{8}$', user_id uuid unique → auth.users cascade, display_name text (1–24, same check
  as fighter_profiles), rig text check in the roster's player rigs, weapon text check in PLAYER_WEAPONS (src/moves.ts:410), loot jsonb (same check as
  fighter_profiles.loot), habits jsonb check (pg_column_size ≤ 2048 and every key is a Habits field and every value a bounded integer
  — a jsonb check, not `pg_jsonschema`, so the local check needs no extension), fights integer default 0, revision bigint (the
  fighter_profiles trigger pattern), updated_at)`.
- RLS: owner insert/update (`auth.uid() = user_id`), one per account (the unique); select `to anon, authenticated using (true)` with
  a **column** grant that excludes `user_id` (the fight_records lesson: a policy cannot hide columns) — a ghost is fetched by its short
  id from a link, exactly like a shared fight. No delete from the client; a "retire my ghost" is `update … set habits = '{}'`.
- What the client may write: its own look and its own habits, bounded. What it may never write: anything competitive. A ghost fight
  awards nothing server-side (no marks, no board) until a verified route exists — the verifier pattern from 0005 (a `ghost_results`
  table + replay) is the way to make ghost wins count, and it is NOT part of this design.
- Client calls (when built): `POST /rest/v1/ghosts` / `PATCH …?id=eq.<mine>` (owner), `GET /rest/v1/ghosts?select=<public columns>&id=eq.<id>`.
  Combat owns the `Habits` → warden mapping; Web design owns the "fight a friend's ghost" surface; this lane owns the table, the
  bounds and the DB-check cases (second ghost per account refused, cross-owner update refused, `user_id` unreadable, habits over 2 KB
  refused, unknown habit key refused).

### Season leaderboards (the daily board, over a season)
Today's `daily_board_summary` (0007) is per day. A season is the same idea over a date range, and the same rule: **verified rows
only** ever rank; pending rows are counted, never placed.
- `public.seasons (id smallint pk, name text, starts date, ends date, check (starts <= ends))` — owner-managed in SQL like `admins`;
  no client writes at all. Beta season 1 = the daily's day zero (2026-09-22) onward.
- `season_board_summary(season smallint) returns jsonb` — the 0007 pattern verbatim, over `daily_results` joined to
  `fighter_profiles.display_name` for `day between starts and ends and verified`: per fighter `{days_played, kills, cleanest (min
  taken), fastest_kill, longest_survived}` ranked by kills desc, fastest_kill asc, limited to a top N the client never pages past;
  plus `{pending}` for the season. Invoker, public columns only, never `user_id`/`record`. Ties broken by the earlier `created_at`.
- No new tables for results and no new client writes: a season is a read over what the daily already stores and the verifier already
  confirms. Only `seasons` is new, and it is a config table.
- Client call (when built): `POST /rest/v1/rpc/season_board_summary {season}` (one new REST path → check-14 mock). DB-check cases: a
  pending row outside the top N when a verified one exists; a day outside the season never counts; the payload carries no `user_id`.
- Not designed here: career marks on the season board (marks are client-reported; the no-authority rule keeps them off any board).

### Lockers — the locker-slot purchase record (payments later)
`src/loot.ts:17` `LOCKERS = { open: 1, total: 6 }` is a constant today. When lockers are sold, the count a fighter has must come from
the server, never from the client, and nothing competitive may hang off it (Strategy: cosmetic storage only).
- `public.purchases (id uuid pk default gen_random_uuid(), user_id uuid → auth.users cascade, sku text check (sku in ('locker_slot')),
  provider text, provider_ref text unique (the processor's own id — the idempotency key for a retried webhook), amount_cents integer
  check (> 0), currency text check (char_length = 3), status text check (status in ('pending', 'paid', 'refunded')), created_at,
  updated_at)`. Comment: "written by the payment webhook only".
- RLS: **no client write path of any kind** — no insert/update/delete policy or grant to `anon`/`authenticated`. Rows are written by
  the webhook handler (a Supabase Edge Function or a VPS endpoint, decided with Dom; it holds the processor's signing secret in its
  own env, never in the database) through a dedicated login role like `frankendom_verifier` — `frankendom_payments`, grants `insert`
  and `update (status, updated_at)` on `purchases` only. Client: `owner_read` select on its own rows for a receipts list.
- Entitlement: view `public.locker_slots` = `select user_id, 1 + count(*) filter (where sku = 'locker_slot' and status = 'paid') as
  slots from purchases group by user_id` (plus the 1 every fighter has). Owner-read via RLS on the base table; `src/loot.ts` reads
  `slots` in place of `LOCKERS.open` and greys the rest, exactly as today. A refund flips `status` and the count drops — no data lost.
- What the client may write: nothing. What it may read: its own purchases and its own slot count.
- DB-check cases: a client insert into `purchases` refused (both roles); `frankendom_payments` can insert and can update only
  `status`; the view counts `paid` only; cross-owner read refused. Not designed here: the provider, prices, tax, the checkout UI —
  Dom's money decision first (this lane's rule: money is Dom's call, not a lane's).

## Rules every lane inherits
- Client-reported data is never rank, result or unlock authority for anything competitive; only server-verified rows count.
- No secret readable by anon or authenticated; secrets live in RLS-on tables with no grants, read only by definer functions.
- Migrations ship inside the PR that needs them; Backend reviews ("apply-ready" or the change), Dev/Deploy applies at that PR's deploy,
  in order, reports table names; Backend verifies the applied state and updates this file. Nobody else touches the hosted project.
- Every new client REST/RPC path is told to the lead before it lands so release check 14's route mock learns it.
- `scripts/account-database-check.mjs` (real local PostgreSQL, zero production writes) is the RLS suite: every table's policies are
  proven there — second insert refused, update refused, secret unreadable, guest read-only. Supabase branching is not used (owner spend).
- A migration that needs a Postgres extension (e.g. `pgcrypto` for `gen_random_bytes`) must `create extension if not exists` it in the
  migration file itself, not assume it's already enabled — hosted Supabase has several pre-enabled, the check's local `initdb` cluster
  has none (caught by CI on 202609210003; fixed at lead/daily-warden `e0f7380`).
- A date used in `scripts/account-database-check.mjs` must be computed in the same zone as the guard it exercises: an unqualified
  `current_date` takes the *machine's* local timezone, while the daily-warden guards compare against `(now() at time zone 'utc')::date`.
  Past local midnight on a machine east of Greenwich (e.g. UTC+4, still yesterday in UTC), the two dates disagree and a genuinely correct
  guard reads as broken. The daily/loot block now opens with `set time zone 'UTC';`. Reproduced independently: the pre-fix check run
  under `TZ=Asia/Dubai` failed with "Authenticated cannot fetch today's daily seed"; the fixed check (lead/loot-data `d5b0a89`) passes
  under the same `TZ`.
