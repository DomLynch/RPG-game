# Duel (real-player PvP) — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order (real player matching, "we did it with Pixel FPS"). Reports to Lead. Append new entries at the TOP with evidence and remaining validation (AGENTS.md).

## 2026-10-02 07:4x (+04) — HANDOFF before /clear. READ FIRST, then the 2026-10-01 22:3x entry, then memory

Memory (read first): `~/.claude/projects/-Users-domininclynch-Developer-frankendom-duel/memory/` -> `project_handoff_2026_10_02.md`, then `project_duel_rulings.md`, `feedback_no_local_runs.md`.

1. **LIVE** c107068c (curl frankendom.com/release.json 07:39). The whole duel stack is on trunk and live: #1110 transport, #1116 lobby, #1179 two-page, #1226 reconnect/forfeit, #1228 hero-rig peer, #1281 player-mint switch (dormant: DUEL_RELAY_PLAYERS off in code), plus Web's #1277 share row. **The VPS relay is NOT up**: `curl https://frankendom.com/duel/relay/health` = 404 at 07:39; /opt/frankendom-relay/current did not exist on 49.12.7.18 when I checked (first install, not a reinstall). Until Deploy installs it, every ?duel link reports link unknown / No contest.
2. **Went live today from this lane:** nothing a player can use yet (no relay; no player-visible entry until Web's client gate).
3. **NOT LIVE:**
   - **#1300** `duel/reconnects-cues` 3cfafa624f49335cb5a1d82e4a0140f7ab3ae1c4: OPEN, not draft, CLEAN, CI all green, Auditer PASS (read) + CI-receipt comments ON the PR. Sends `reconnects` in duel_metrics (transport.reconnects, clamped 0..1000) and wires Audio's cues go-only (joined for the challenger on the guest kit, go on start, win/loss from the result, no 3-2-1). The Auditer's local type-check + net unit run is a second receipt owed after the deploy lock; it does not gate READY. Waits for Deploy's run.
   - **Relay install**: Deploy, ON the VPS as root, from a trunk checkout: `SUPABASE_URL=<public url> SUPABASE_ANON_KEY=<public anon key> bash ops/install-duel-relay.sh <trunk rev>`; rollback `--rollback`; verify `curl https://frankendom.com/duel/relay/health`. Lead said Deploy installs it with `DUEL_RELAY_PLAYERS=1` (Dom: "activate duels for players now"). #1281's caps: 3 rooms/min and 20/h per account, 5,000 accounts, per-IP 10/min, anonymous Supabase users refused (R1), a socket closed 4001 at token expiry + 5 min (S1).
   - **#1289** `backend/duel-reconnects` (Backend's migration file) is still OPEN; the migration itself is applied on hosted (I checked Supabase list_migrations on project rxbewmzmovelckzoosss: 202609300001, 202610020001, 202610030001 all present).
4. **Sessions down:** none of mine. Worktree session: restart on `~/Developer/frankendom-duel` with the worktree switch off.
5. **Rulings today:** Dom/Strategy: activate duels for players now; no 3-2-1 before gate 4 (go-only audio); Backend: in-memory caps are enough (no DB cap); Lead: undraft with a HOLD line, cancelled checks get re-run before a PR is called green (see memory).
6. **QUEUE:** (a) #1300 ships in Deploy's run with Web's client gate once the relay is up; send Lead any changed sha; (b) after the relay is up, a two-page smoke against the live relay; (c) **Sat 10-03 gate 4**: Dom's iPhone vs iPad, different networks, loss, background/resume, disconnect near a kill; `reconnects` in duel_metrics now counts reconnects; (d) later: events on rolled-back ticks, the rewards PR (verifier authority, PVP_REWARDS), the peer's tier for his gear, the page's HUD still names the roster opponent, a real 3-2-1 if wanted.
7. **Crons:** none. **Worktree:** `.claude/worktrees/laughing-bartik-0c0156` (node_modules is a gitignored symlink to ~/Developer/frankendom-armour/node_modules, read-only borrow; remove if unwanted). Branches: `duel/reconnects-cues` (#1300), this entry on `duel/state-1002`. Edits in the session worktree, never in ~/Developer/frankendom-duel.
8. **Gotchas learned today:** a multi-ref push may dispatch CI for one ref only; a PR that conflicts with trunk gets no CI; GitHub can call CONFLICTING a merge that `git merge` does clean (re-merge trunk fixes it); drafts skip the release-checks workflow (undraft to run `plan`); a cancelled `plan` job is re-run with `gh run rerun <run-id> --failed`; a `setTimeout` that outlives a replaced socket holds `node --test` open for its whole delay (quality hung and was cancelled; fixed with clear-before-early-return + unref); zsh has no PIPESTATUS (use `cmd > log; echo $?`); the stop hook blocks even single-file tests during a deploy; `send_message` takes a session_id (list_sessions gives it), not a name.

## 2026-10-01 22:3x (+04) — HANDOFF at task close (reconnect/forfeit + hero-rig peer reviewed and green). READ FIRST, then memory

Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-duel/memory/` → `project_handoff_2026_09_29.md` (its newest UPDATE wins), `project_duel_rulings.md`, `feedback_no_local_runs.md`.

1. **LIVE** 4a08d619 (curl frankendom.com/release.json). Nothing from the Duel lane is user-visible live.
2. **Stack, all DRAFT, all reviewed by the Auditer, all green on their own bases (CI 9/9 or 8/8):** #1110 `duel/transport` 85f0aeb5 → #1116 `duel/lobby` bfde5bc8 → #1179 `duel/two-page` fea38c03 → #1226 `duel/reconnect` 20544a8a → #1228 `duel/peer-rig` 9033ea51 (carries trunk c6acd3ef; the lower four do not).
3. **Done today:** merge-forwards on trunk; Backend's duel_metrics checks (85f0aeb5) and rollback SQL in #1110's body; the pvp-owes-nothing-after-a-hidden-spell test (#1116); the two-page Playwright duel on CI (#1179: relay + dev server + two pages, same finish, same fingerprints, 0 desyncs); **#1226** reconnect (a dropped peer has ~10 s, resumes the same rollback state) and forfeit (the page whose own link held wins; a page away longer than the window has LEFT on its first frame back; link unknown keeps No contest; PVP_REWARDS false), relay retakes a side for its token holder + a 2 s beat, transport retries its socket 30 s, migration `202610020001_duel_metrics_result.sql` (closed-set `result`), the two-page leg that cuts the guest's socket mid-duel; **#1228** Option A hero-rig peer (rigs wait for the handshake kit, peer = warrior.glb loaded twice, his weapon grafted, gear from loot.glb; `rdy` gate on hello so a slow loader is never forfeited; the lobby steps the handshake because the versus card pauses the fight loop), the challenger's wait panel (message, link, Copy, Cancel; 16px input), assertions that no rig loads while the challenger waits and that the pages end with two warrior loads and no veteran load. Stills (375x812, BEFORE vs AFTER) are the `duel-two-page-receipt` artifact of runs 36859586735 and 36866512842.
4. **Open / who:** (a) Dom's yes for migration 202610020001 (Strategy asked; Backend: no blocker; apply it BEFORE the client that sends `result` ships; rollback in the file); (b) ONE merge-forward onto trunk when the stack runs (Lead/Deploy's call); (c) the VPS relay must be REINSTALLED from this revision (`bash ops/install-duel-relay.sh <rev>`) for the beat and the side retake; without them pages see link unknown and keep No contest; (d) Sat 10-03 gate 4: Dom's iPhone vs iPad, different networks, loss, background/resume, disconnect near a kill; (e) later: events on rolled-back ticks; the rewards PR (verifier authority, PVP_REWARDS), the peer's tier for his gear (today 'Recruit'), the page's HUD still names the roster opponent.
5. **Gotchas:** a PR that conflicts with trunk gets NO CI ("no checks reported": read mergeStateStatus first); cancelled CI jobs show as fail in `gh pr checks`; a multi-ref push may dispatch CI for one ref only; `node --check` cannot catch a TDZ; JS `//` comments inside the database check's SQL template break it; Playwright `request.resourceType()` separates the dev server's '?import&url (script)' listings from '(fetch)' loads; the stop gate runs real unit tests (input.test.ts refuses focusable controls under 16px); the deploy hold blocks local test runs (CI is the receipt, run single files when the Mac is free). Edit in the session worktree, never in ~/Developer/frankendom-duel (holds `duel/lane-open`); `duel/lobby` is held by a stale worktree, merge it on a detached head and push `HEAD:refs/heads/duel/lobby`.
6. **Rulings today:** Strategy: Option A for the hero-rig peer (hold the rigs until the kits are exchanged, ?duel= only, normal boot untouched); the Auditer's first-frame-left rule for a page away past the window (the deferred `away` flag is withdrawn).

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
