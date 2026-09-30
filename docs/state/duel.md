# Duel (real-player PvP) — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order (real player matching, "we did it with Pixel FPS"). Reports to Lead. Append new entries at the TOP with evidence and remaining validation (AGENTS.md).

## 2026-09-30 16:17 (+04) — HANDOFF before /clear. READ FIRST, then the 00:3x entry below, then memory

Memory (read first): `~/.claude/projects/-Users-domininclynch-Developer-frankendom-duel/memory/` → `project_handoff_2026_09_29.md`, `project_duel_rulings.md`, `feedback_no_local_runs.md`.

1. **LIVE** 3fab84c4 (curl frankendom.com/release.json 16:17): trunk = merge of #1157 pit/picker. No deploy lock file seen from this worktree; a Stop-hook note at ~16:0x said deploy e479ab2 was in flight on this Mac (one-deployer rule), so treat the box as busy until Deploy posts Published.
2. **Went live today from this lane:** nothing. Duel has nothing user-visible live.
3. **NOT LIVE, all DRAFT by Lead's rule until Thursday's run, all green at their heads:** #1110 `duel/transport` 1900389b (transport, relay, `duel_metrics` migration 202609300001, PVP_REWARDS=false); #1116 `duel/lobby` ec2d79aa (challenge link, lobby, Match pvp mode, admins-only minting, gear slot, Code Quality gates 1–3, `tests/net-fuzz.test.ts` unedited); #1106 `duel/plan` 959d63a9 + this entry (docs, Lead merges); Combat #1114 e41fa96a (specials v21) stacks after #1116. **Trunk moved since the last handoff (5f2f622a → 3fab84c4), so the merge-forward in the queue is due and not yet done.**
4. **Sessions down:** none of mine. This session restarted at ~16:0x after Dom's /clear; only read-only checks since (release.json, PR list, notifications: none queued).
5. **Rulings today:** none new. All rulings are in memory `project_duel_rulings.md` (VPS relay not Cloudflare, rewards gate, admins-only minting, gear-based duels, gates 1–4, stacked-PR rule, no local runs until Lead says FREE).
6. **QUEUE:**
   1. **Now (when the box is free):** merge `origin/codex/01a09a76/task-1` (3fab84c4) into `duel/transport`, then `duel/transport` into `duel/lobby`; push once; CI is the receipt; send Lead (`Frankendom - Lead Developer [bd2101]`) the green shas.
   2. **Thu run:** Deploy applies migration 202609300001 on hosted FIRST, then #1110 + #1116 merge (Lead's call).
   3. **Fri:** Deploy installs the relay (`SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-duel-relay.sh <rev>`). Then build the Playwright two-page duel on CI (relay with DUEL_RELAY_OPEN=1 + preview server + two pages) — not started.
   4. **Sat 10-03 (gate 4):** Dom's iPhone vs iPad, different networks, loss, background/resume, disconnect near a kill → both agree, no duplicate reward.
   5. Later: peer on the hero rig; events on rolled-back ticks; reconnect/forfeit beyond No contest; specials-ON fixture leg + v21 handshake after #1114.
7. **Crons:** none. **Worktree:** `.claude/worktrees/great-hofstadter-78ee18` (no node_modules; edits here, never in ~/Developer/frankendom-duel by shell, which holds `duel/lane-open`). This entry is on `duel/plan` (#1106). Reopen the lane on `~/Developer/frankendom-duel` with the worktree switch off.

## 2026-09-30 ~00:3x (+04) — HANDOFF before /clear. READ FIRST, then memory, then the 20:31 entry below

Memory (read first): `~/.claude/projects/-Users-domininclynch-Developer-frankendom-duel/memory/` → `project_handoff_2026_09_29.md`, `project_duel_rulings.md`, `feedback_no_local_runs.md`.

1. **LIVE** 5f2f622a (curl frankendom.com/release.json 00:3x): trunk with #1109 (rollback core) merged in run AS. Nothing user-visible from this lane is live.
2. **Open PRs, all green on CI, all DRAFT by Lead's rule until Thursday:**
   - #1110 `duel/transport` 1900389b (trunk merged in after #1109): adaptive delay, WebRTC-first transport, VPS relay with signed tokens, `duel_metrics` migration 202609300001, PVP_REWARDS=false. Body has the migration's grants/RLS, the relay install + `--rollback`, and the gate-3 rules.
   - #1116 `duel/lobby` ec2d79aa (stacked on #1110, targets trunk): `?duel=new` / `?duel=<token>`, lobby handshake with version refusal, `viewAs`, Match `pvp` mode, admins-only minting (relay checks the caller's Supabase bearer against public.admins), gear slot in Kit + PvpRecord, Code Quality's gates 1–3 (parseMessage + RollbackSession.accepts; confirmed-only events; SILENCE 3 s / 15 s), and their `tests/net-fuzz.test.ts` unedited (#1125 closed). CI run 36618866337: 8/8, fuzz ok 657/658.
   - #1106 `duel/plan` bfb07b94 + this entry: docs only; Lead merges.
   - Combat #1114 (specials, v21) stacks after #1116; timing is Dom's.
3. **Bugs CI caught today (fixed):** `settled` never held for the leading side (a live duel would never have ended) → settled = confirmed state holds the finish AND peer acked through that tick (latched). tsc typed the relay's `admit = null` default as null → JSDoc cast.
4. **Rulings (memory `project_duel_rulings.md`):** admins-only minting until Dom opens duels; gear-based duels at full gear power inside gear-stats caps, Loadout = `kits[i].gear` piece ids in the record, verifier re-derives, v20 gear-neutral; gear levels + matchmaking bands POST-BETA; one-way link death inside the last RTT can split the result (accepted for beta: verifier authority, PVP_REWARDS false, measured Sat); stacked-PR rule: merge trunk into each outer PR after every publish; batch pushes (shared CI queue); no local runs until Lead says FREE.
5. **QUEUE:**
   1. After each publish: merge trunk into `duel/transport`, then `duel/transport` into `duel/lobby`; push once; CI is the receipt. Send Lead the green shas.
   2. **Thu run:** Deploy applies migration 202609300001 on hosted FIRST, then #1110 + #1116 merge (Lead's call).
   3. **Fri:** Deploy installs the relay: `SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-duel-relay.sh <rev>`. Then the Playwright two-page duel on CI (relay with DUEL_RELAY_OPEN=1 + preview server + two pages) — not started.
   4. **Sat 10-03 (gate 4):** Dom's iPhone vs iPad, different networks, loss, background/resume, disconnect near a kill → both agree, no duplicate reward. Admin signs in on one device to mint; the other opens the link as a guest.
   5. Later: peer drawn on the hero rig (today: the page's opponent rig); events on rolled-back ticks; reconnect/forfeit beyond No contest; specials-ON fixture leg + v21 handshake after #1114.
6. **Worktree:** this session ran in `.claude/worktrees/great-hofstadter-78ee18` (no node_modules; edits here, never in ~/Developer/frankendom-duel by shell). Branches `duel/plan`, `duel/transport`, `duel/lobby` all pushed; tree clean. No crons. Two Lead sessions exist: message `Frankendom - Lead Developer [bd2101]` (the local one). Reopen the lane on `~/Developer/frankendom-duel` with the worktree switch off.

## 2026-09-29 20:31 (+04) — HANDOFF before /clear. READ FIRST, then the brief below, then memory

Memory (read first): `~/.claude/projects/-Users-domininclynch-Developer-frankendom-duel/memory/` → `project_duel_rulings.md`, `feedback_no_local_runs.md`.

1. **LIVE** 5ec33cf2 (curl frankendom.com/release.json 20:31). Duel has nothing live; nothing is deployed from this lane yet.
2. **Done today:** the architecture page was accepted by Lead + Strategy (#1106, docs, 2/2 green, open). The **1,000-fight determinism check PASSED** (Lead's read of run 36591506534: 1,000 fights, 0 differing, Node 22 vs Chromium 151 vs WebKit 26.5, 32.4 s).
3. **Open PRs (none merged):**
   - #1106 `duel/plan` (28caf596): architecture page + this doc. CI green. Awaits Lead merge.
   - #1109 `duel/rollback` (c201832d): rollback core, fake-link tests, determinism tests, `net-engines` CI job (1,000 fights). **18 pass / 0 fail.** Lead reviews on green.
   - #1110 `duel/transport` (a72a97da, draft, stacked on #1109, targets trunk): adaptive delay + lobby pre-measure (`delayFor`), `tooSlow` state, PLAYABLE row, WebRTC-first transport, dependency-free VPS relay with signed room tokens + caps + counts-only log, hardened systemd unit, TLS-only nginx snippet, install/rollback script, `duel_metrics` migration, `PVP_REWARDS=false`. Previous run: every node suite passed, but "Account database isolation" failed. The privacy guard read `ip` inside `flips_per_min`; I renamed it to `corrections_per_min` in a72a97da. **CI pending on a72a97da; check `quality` first.**
4. **Sessions:** none of mine are down. Combat has draft #1114 (specials, v21); Duel's follow-up waits on it.
5. **Rulings (memory `project_duel_rulings.md`):**
   - No Cloudflare for beta: our VPS relay (Hetzner 49.12.7.18), P2P first, relay only when ICE fails. Frankendom has priority on the box; never touch Research Agent data.
   - PLAYABLE = 250 ms **RTT** + 30 jitter + 10 % loss: stalls ≤ 60/min, delay ≤ 12, depth p95 ≤ 8. 550 ms RTT is a reported row that must degrade gracefully (`tooSlow`, no desync).
   - PvP results never touch marks/rank/loot until the assist-bot stats check exists (`PVP_REWARDS=false`, pinned).
   - Metrics go in `duel_metrics`, never `perf_beacons`.
   - PvP special damage = same as vs AI (20 % class, 30 % boss L8–10), one parameter.
   - **No local runs of any size until Lead messages FREE.** CI is the receipt. The stop gate now defers when node_modules is missing.
6. **QUEUE:**
   1. #1110 green → Lead review (Lead's relay bar (a)–(e) is in the PR body).
   2. Merge order proposed to Combat: #1109 → #1110 → #1114 → Duel follow-up (specials-ON fixture leg via `withSpecials`, v21 in the PvP handshake).
   3. **PR3 (Fri 10-02):** `?duel=` switch in main.ts, `viewAs` (guest sees self as side 0), challenge-link lobby (`mintRoom` + pre-duel pings → `delayFor`), a Playwright two-page duel on CI, `duel_metrics` upload.
   4. Deploy: migration 202609300001 + `bash ops/install-duel-relay.sh <rev>` on the VPS (Lead hands it to Deploy), then `/preview/` publish (Lead books the Fri slot).
   5. **Sat 10-03:** first two-phone duel, Dom's iPhone vs a laptop browser or borrowed phone, same city, direct path. Bar: 0 desyncs + Dom says parries feel right.
7. **Worktree/branches:** this session ran in `.claude/worktrees/great-hofstadter-78ee18` (no node_modules, clean). Branches `duel/plan`, `duel/rollback`, `duel/transport`. No crons armed. Reopen the lane on `~/Developer/frankendom-duel` with the worktree switch off.

## Now — the brief, as of 2026-09-29 19:0x +04 (restart brief; replace wholesale)

**Mission (Dom, 19:0x): build real-player PvP for PERMANENT, not a test.** "We will get this working, it's critical to the game's success; we are a Diablo / Path of Exile 2 killer." Live sword duels between real players, worldwide, on phones and desktop. Failure is not an outcome; the only question is how, and in what order.

**What we have.** The duel is a fixed-tick step (`stepDuel` in `src/duel.ts`); the AI (`src/ai.ts`) only emits ordinary Intents judged by the same rules as the player; sim math is deterministic across browser and Node since v20 (release row 48). A good foundation, not proof.

**What must be solved (each one proven with a test and a measured number, not assumed):**
1. Cross-device determinism in live play (iOS Safari vs Android Chrome vs desktop), not only recorded replays.
2. Latency: input delay and/or prediction + rollback (GGPO-style predict and replay), tuned so parries and counters still feel right.
3. Desync detection and recovery (state hash every N ticks; a defined outcome on mismatch).
4. Trusted results: a hosted transport moves packets; it does not validate wins or stop cheating. Decide the authority model (e.g. server-side replay of both input streams with the Node sim) before results touch marks or loot.
5. Matchmaking (rank-based queue), challenge links (from the Pit and from share links), disconnects, reconnect, rematch.
6. Regions: ANY city to any city. No player is restricted by where they live; route through the nearest relay/region and show the connection quality honestly.

**Rules.**
- Do NOT widen parry/counter windows as the first answer to latency. Measure first; feel is the judge.
- Own module (`src/net/` or similar); single-player fight feel and release rows unchanged. Nothing in the fight imports the net code except through one switch.
- Transport: start with what we run (Supabase) if it holds; if it can't, name the service and its monthly cost before adopting it.
- Ship in stages, each live and usable: (a) friend challenge by link, two real players, (b) rank matchmaking, (c) results count toward marks once the authority model is proven.

**First deliverables.**
1. A one-page architecture to Lead: transport and cost, authority model, net-code layout, the rollback/input-delay approach, how determinism is tested across devices.
2. The first live duel between two phones by challenge link, with measured round-trip time, input delay, rollbacks per minute and desyncs, near and far apart. Dom plays it and judges feel.
3. Then the staged build above.

**Box.** Mac time only through Lead's slot rule (one heavy lane at a time, load < 15). Phone tests need Dom plus a second phone/person; ask Lead to book them with Dom.

## Done
- 2026-09-29 — Architecture page `docs/duel-architecture.md` (design only, nothing built): peer rollback on quantized intents, server replay of both streams as the only authority for rewards, determinism tests (import-graph ban list, freeze test, 4-engine hash-chain fixture on CI), transport ladder WebRTC → Cloudflare TURN (~$0.003/match-hour, Dom's call) → Supabase Realtime (Mumbai; ~$1/match-hour, signalling + first test only), 0-desync rule, cheat limits, go/no-go table. Remaining: Lead's review; every *est.* figure to be measured.

## Open
- A second phone and a second person for far-apart tests.
- Dom's yes before any TURN spend (Cloudflare Realtime TURN).

## Gotchas
- iCloud Desktop sync stays ON (Dom); check load before any browser run.
