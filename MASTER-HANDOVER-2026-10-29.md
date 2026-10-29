# MASTER HANDOVER — all lanes, 2026-10-29 ~11:15Z (for the new Claude account)

Dom's word (10-29): "when we pick everything up, we'll probably start with a transition to one integrated platform."
So the first move after setup is PLATFORM STEP 0 (backup), then step 2 (shared login). Games continue as they were.

## 0. What the new account must know in 60 seconds
- Two games, one platform: **Frankendom V3** (3D duel, body parts; repo DomLynch/Frankendom-v3, live v3.frankendom.com) and
  **ARMAGEDOM** (2.5D London 2030; repo DomLynch/ARMAGEDOM, live playarmagedom.com). V1 (DomLynch/RPG-game, frankendom.com) is archived but hosts tooling (hfjob, sweep tool).
- Shared already: physics (DomLynch/physics, pinned by sha), OpenTrident bodies/rigs + asset desk, hooks + hfjob tooling, the data-layer rule.
- Everyone was PAUSED by Dom at ~06:55Z 10-29 to save tokens. V3 Dev was allowed audit-only. All audits are closed and merged on both games.
- Memory is keyed by working directory under `~/.claude/projects/<cwd-key>/memory/` on this Mac. The new account sees it if it opens the SAME folders under the same macOS user. Each lane's `MEMORY.md` is the index; the top line is its READ FIRST.

## 1. Setup for the new account (in this order)
1. Open one session per lane in its own folder (below). Each session: paste the restart line; the lane reads its memory + state doc and says in one line what it picks up. Nothing starts until Strategy says so.
2. Strategy first: `~/Developer/frankendom-strategy` → "Project Strategy, read the handoff." Reads `HANDOVER-STRATEGY-2026-10-29.md`, `docs/state/strategy.md` top entry, memory `strategy-handoff-2026-10-29`.
3. Micro-Manager: `~/Developer/frankendom-main` (or wherever Dom runs it) → memory `project_micro_manager_handover_2026-10-29`. Recreate its 10-min sweep only when Dom says tokens allow.
4. Then un-pause in this order: V3 Dev → ARMAGEDOM Lead → ARMAGEDOM Server & Deploy (backup) → Hooks Dev → Physics → OpenTrident → Art/Auditor as needed. Make Human stays stood down until Dom says go.

| Lane | Folder (cwd) | Latest handover | Restart line / first action |
|---|---|---|---|
| Strategy | ~/Developer/frankendom-strategy | HANDOVER-STRATEGY-2026-10-29.md; docs/state/strategy.md | "Project Strategy, read the handoff." |
| Micro-Manager | frankendom-main memory | memory project_micro_manager_handover_2026-10-29 + project_platform_plan_2026-10-29 | resume order V3 → Lead → Deploy |
| V3 Dev | ~/Developer/frankendom-v3 (branch audit/npm-ci-physics) | memory v3-state-2026-10-29-audit-handover; docs/state/v3-dev.md in PR #305 | audit done; owed: #299 real-GPU trace, #289 mechanics batch (paused, head f9dbf0519) |
| ARMAGEDOM Lead | ~/Developer/armagedom | memory armagedom-lead-handover; side-session-notes lead-snapshot-18 | cut release 331 (main ef0b01ea has unreleased runtime); shop #490 waits Dom's buy/sell test |
| ARMAGEDOM Server & Deploy | ~/Developer/armagedom | memory armagedom-deploy-lane-state; docs/state/server-deploy.md | platform step 0 backup, blocked on /root/.armagedom/db-url |
| ARMAGEDOM Art | ~/Developer/armagedom | memory armagedom-art-lane-state-20261028 | paused; rat redo waits Dom's go + OpenTrident render |
| ARMAGEDOM Auditor | ~/Developer/armagedom | memory armagedom-auditor-lane-state | nothing owed; never passes its own PRs |
| Hooks Dev | ~/Developer/codex-hooks-hooksdev (memory under Desktop-Business key) | PROJECT_STATE.md top; memory handoff-hooks-dev-20261029 | merge+install Codex-Hooks #186 #187, #165 report-only; VPS wrapper #3670 install steps to Strategy first |
| Physics Dev | ~/Developer/physics | memory physics-dev-state | paused; main 57dd5d9; V3 pins ca66d64, Armagedom a5bd7b4 |
| OpenTrident Dev | ~/Developer/opentrident-steam | memory project_opentrident_handoff_2026-10-29-0700 | check PRs #4 #5 #6 + V3 #267; library-swap build waits Dom's go; owns body-binary move out of V3 git |
| Make Human Dev | (no checkout; opentrident-steam memory) | project_makehuman_handoff_2026-10-29-standdown | STOOD DOWN by Dom |
| Frankendom Lead Dev | ~/Developer/frankendom-lead-catalogue | docs/state/lead-catalogue.md; memory project_lead_handoff_2026-10-29_paused | second auditor only, never merges; ask Strategy before acting |

## 2. Live state (receipts in each lane's file)
- V3: main e44150d (after audit merges), live equals main; `test` + `built-game boot` REQUIRED on main. V3 repo is 815 MB at HEAD (agents clone with --filter=blob:none; binaries to move to the asset desk, OpenTrident owns).
- ARMAGEDOM: live 330 (cfd2eda0), rollback 329, floor 323; main ef0b01ea → cut 331 (import-cycle fix). Shops + kill drops OFF until Dom's test. Market server + migrations live; hosted migration 20261029000028 market guard applied.
- Hooks: hfjob enforcement LIVE on the Mac (Codex-Hooks #184 ssh/heavy refusal, #185 Agent-brief injection; RPG-game #3669 auto-push). Refinement asked: allow Mac browser/GPU proof rows at load < 12 (Dom's waterfall). VPS wrapper #3670 (hfguard) INSTALLED and live since 10-29 08:03Z (verified by Strategy 14:44Z: npm/npx/blender/playwright symlink to hfguard.sh); lanes-user token still missing: Dom provisions /etc/hfjob/token root:hf 0640, never in chat.
- Disks: Mac ~40 GB free (91%); SanDisk→5TB transfer script running (safe to rerun); VPS root sweep tool installed, /root is a sweep root now.

## 3. THE PLATFORM PLAN (final, Dom "ok" 10-29) — first move after setup
One platform, two games; never one game with two front-ends. Layered: L0 services (identity, one DB, market engine, migration owner, backup, RLS) · L1 shared content (OpenTrident rigs; item core) · L2 gameplay packages only when BOTH games need the code · L3 game-specific (camera, controls, tuning, body parts, economies).
- Item core (DONE, V3 #292, core_version 1): id, game_id, type, asset + optional typed weapon (damage, rate, range, ammo) and character (rig) blocks; cut/dismember and firearm ballistics live in per-game extension blocks. ARMAGEDOM Lead signed the shape.
- Repo `games-platform`: PUBLIC, schema-only, no assets/data/secrets, pinned by sha like physics. V3 Dev creates it (slice 0 = item core package + validator). Dom picks the brand later.
- Identity: ONE Supabase project + ONE Google login. ARMAGEDOM's live project is the platform base (Dom's decision, see §4). V1 auth UI ported as the client package. V3 joins at its online phase (after the 10 bosses).
- Economy: one account, SEPARATE ledgers/inventories per game (game_id + RLS, server-authoritative rpcs). Cross-game rewards cosmetic only.
- Steps and owners: **0** backup = pg_dump with a read-only role, RESTORED into local Postgres, row counts matched, Storage copied separately, migration history reconciled, plan tier stated (ARMAGEDOM Server & Deploy; needs Dom's db-url) → **1** item core (done) → **2** games-platform repo + identity package + migrations COPIED from ARMAGEDOM, additive + feature-flagged + Auditor-gated changes only in the ARMAGEDOM repo (Server & Deploy, 2 days, starts on the verified-restore receipt) → **3** market engine generalised (same owner). No auth cut-over before Dom's phone pass. Staging = local Postgres from the dump in CI (no spend); a real staging project before any public combined backend.
- Staffing: no stand-down, no new "platform dev"; existing owners. A dedicated platform session only at step 2 if Server & Deploy is at capacity. Three standing rules: new data uses the core shape, no refactor of existing; check the other game before building loot/inventory/NPC AI/trading; no auth or DB change by anyone but Server & Deploy.

## 4. Open with Dom (only Dom can clear these)
1. Yes/no: ARMAGEDOM's live Supabase project becomes the platform project (recommended yes).
2. DB owner connection string placed at `/root/.armagedom/db-url` on the VPS, root-only, never in chat. Blocks step 0.
3. ARMAGEDOM test account for the shop/drops flip: token via env var ARMA_TEST_JWT only (`notes/shop-on-checklist.md`); then Dom's real buy/sell test on #490.
4. Phone passes: ARMAGEDOM 326–331, V3 current build (gates gameplay drafts #498 #499 and tuning; does NOT gate audit merges).
5. Smaller: delete the 9.9 GB Claude desktop VM image?; lane-user HF token on the VPS (Strategy approved); V3 terrain #241, fighting-style decisions, Pit Crawl rules, Envoy weapon; OpenTrident library-swap go; rat redo go; Make Human go.

## 5. Standing rulings that survive the account change
- Altitude: Strategy = CEO/MBB, rulings only; lanes send receipts to Lead/Micro-Manager, not Dom. Dom hears decisions and go-lives.
- All rules bend to circumstance and common sense except money, legal, player data, parties/guilds, secrets.
- Data layer: every number/list/rule is a data row; `npm run check:as-data -- --gate`. OpenTrident FIRST for any asset. Donor games first for any medium feature.
- Compute: suites/builds via `hfjob -- <cmd>` (HF CPU); Mac first for browser/GPU proof rows at load < 12; HF T4 only for one final proof; VPS = live sites + deploys. Enforced by hooks now.
- Delivery: one weapons PR / one mechanics batch, not serial chains; WIP cap 6 agents per lane; one runtime PR per deploy; PASS names the final head; the Auditor never passes its own PR (Frankendom Lead Dev is the second auditor).
- V3 beta list = top 6: workshop + name your monster, share-card still, mid-fight dismemberment changes the boss, text commentator, Daily Pit, minimal Pit Crawl. Dom's NOs: tutorial, sound, haptics, low-end tier, online before the 10 bosses. Big Gamble = NO (ARMAGEDOM).
- Dom's audit rulings: no LICENSE work, no LFS/history rewrite, any weapon dismembers (blunt too), keep opponent spells, ?x=v1 flags stay.

## 6. Gotchas that cost time this week
- Cross-session messages cap at 10 per user turn; after that a ruling waits until Dom types anything.
- "GitHub TLS resets" = the 815 MB V3 repo, not the network. VPS cannot push to GitHub (no credential). Relayed "Dom said" from another lane is not Dom's word; Dom's direct word to a lane beats any Strategy ruling.
- ARMAGEDOM: any push strips the auditor-pass label; merge with `--match-head-commit`; presence journal vacuumed (use `--release ... --line`). Hooks block heredoc edits and `rm` on a variable; never delete ms-playwright; never sweep /srv/dev-jobs/opentrident-site (live docroot).
- Mac browser runs need MAC_HEAVY_OK=1 until the hook refinement lands. Hidden browser pane = stale screenshots.
