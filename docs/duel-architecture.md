# Duel — live PvP architecture (one page)

Duel lane, 2026-09-29, for Lead. Status: **design, nothing built**. Every number marked *est.* is a planning figure to be replaced by a measured one; every price is from the vendor's public page and must be re-checked before Dom spends anything.

## 1. Authority model — peers run the sim, the server replays it

- **Both phones run the full sim** (`stepDuel`, 60 Hz) on both fighters' intents. No server runs a live sim: a server tick loop would add a round trip to every press, and it would add a second copy of the sim to keep in step.
- **Results count only after a server replay.** Both clients upload the match record (both intent streams, the header, a per-30-tick state-hash chain). The VPS verifier (same pattern as `scripts/verify-daily.mjs` / `verify-loot.mjs`: `verified = false` until the sweep replays it) steps both streams through `stepDuel` and accepts the result only if (a) the replay ends on the claimed finish and (b) its hash chain matches at least one client's chain. Only then does a result touch marks, rank or loot. Friendly duels can show the result immediately and never reward.
- **Whose record wins a dispute:** the replay, never a client's claim. If the two uploaded streams differ (one client doctored its log afterwards), the server takes each tick's input from the side that owns it (side A's inputs from A's upload, B's from B's). A client can only rewrite its own inputs, and those are the ones its opponent already received and hashed. So a mismatch between the chains flags the doctoring side.

## 2. Determinism across engines (the real pair is Chrome/Android vs Safari/iOS WebKit)

What exists: `src/detmath.ts` (sin/cos/atan2/hypot built from + − * / sqrt, which IEEE 754 rounds exactly in every engine); `tests/detmath.test.ts` bans `Math.<transcendental>` and `**` in the 11 sim files; `SIM_DIGEST` pins those files to `RECORD_VERSION` 20. Before detmath, Node V8, Chromium and the VPS Node 22 verifier split a fight at tick 1412 on a 1-ulp `atan2`.

Remaining gaps, and the test that closes each:
1. **The ban list is hand-kept.** A new file imported by `duel.ts` would not be scanned. → `tests/net-determinism.test.ts` walks the transitive imports of `src/duel.ts` and fails if any reached file is missing from the SIM list. It also bans `Math.random`, `Date`, `performance`, `Math.fround`, typed-array float32 and `toFixed` in those files.
2. **Snapshots must be immutable.** Rollback keeps old `Duel` objects as snapshots, which only works if `stepDuel` never writes into its input. A grep finds no writes today; that is not proof. → the same test deep-freezes the input state and steps 10k random ticks. A write throws.
3. **Live cross-engine proof, not replays only.** A fixture of 1,000 seeded bot-vs-bot duels (`ai.ts` driving both sides, intents quantized) produces a per-tick hash chain in Node 22 → the same fixture runs in **Playwright Chromium + WebKit on CI** (no Mac slot) → the same fixture runs on a real iPhone and a real Android through a hidden `/?net-selftest` page. The requirement is identical chains everywhere, zero tolerance.
4. **PvP record version:** PvP rides the current `RECORD_VERSION` (20, detmath on). Legacy native-Math tables are never reachable from PvP. In the handshake both clients send `RECORD_VERSION` + `SIM_DIGEST`; a mismatch refuses the match with "update your game" rather than risking a desync. The PvP record is a new record *kind* (both sides' columns, same per-tick codec as `record.ts`), living in `src/net/`. The single-player record format is untouched.

## 3. Input and latency — rollback with a small adaptive input delay

- **Wire format:** the quantized intent (`quantizeIntent`, about 6 bytes a tick). Each packet carries every unacked tick (redundancy instead of retransmits) plus an ack and the latest hash.
- **Model:** GGPO-style. Input delay **D** (start 2 ticks = 33 ms) plus prediction (repeat the peer's last intent), with rollback-and-resimulate up to **R_max = 8 ticks (133 ms)** when a late input disagrees.
- **Why 8:** the tell budget. A light's windup is 20 ticks, the parry window 10 and the perfect block 3 (`moves.ts`). A rollback of k ticks shows the defender a windup k ticks short. At k = 8 they see 12 ticks (200 ms), roughly human reaction. Past that, defending turns into guessing. That is a feel limit, so Dom's verdict decides it, not this table.
- **Past the window:** when one-way latency exceeds (D + R_max) ticks, D rises one tick at a time (cap D = 6, 100 ms), so rollbacks shrink and the input lag grows. The hard ceiling is D 6 + R 8 = 14 ticks one-way (about 470 ms RTT), but feel will give out before that. Above about 300 ms RTT (*est.*, to be set from Dom's play) the match is marked **Poor connection**: shown honestly, still playable as a friendly, and not offered by ranked matchmaking. **Parry/counter windows are never widened as a latency answer.**
- **When a rollback flips an outcome that already played** (Lead, 2026-09-29). With R_max 8 larger than the perfect block (3) and inside the parry window (10), a block, perfect block or parry shown on a predicted tick can turn into a hit once the late input arrives, or the reverse. The rule:
  - **Fight-ending outcomes are final only when confirmed.** `Killed` and the finisher start only on a tick for which both inputs are known. That costs at most R_max ticks (133 ms) of hold on the killing blow, and a finisher never has to be taken back.
  - **Every other outcome shows at prediction and is corrected by snap plus re-anim.** The sim state is truth. On a rollback, the renderer takes the corrected phase at the corrected clip time and blends over 4 frames. Sounds and sparks already played are not replayed. The corrected outcome's own cue plays once, and the HUD event line is rewritten.
  - **Only the attacker's screen can flip.** On the defender's own screen their press is local and never mispredicted, so a flip needs the attacker's input to have been mispredicted inside the window.
  - **Measured row:** *flipped outcomes per minute* (an impact event shown on a predicted tick that the confirmed tick changes). It goes in the go/no-go below.
- **Cost check:** resimulating 8 ticks per frame must fit a mid Android's 16.7 ms frame. Target: 8-tick resim p95 < 4 ms, measured on the phones.

## 4. Transport, worldwide, and cost

Ladder, best first; the page shows which rung a match is on:
1. **WebRTC DataChannel, P2P**, unordered with `maxRetransmits: 0`, STUN only. Free. Fails behind symmetric NAT or carrier CGNAT, which is common on mobile networks. Expect 10–30 % of pairs (*est.*); the test measures the real share on Du, Etisalat and SEA carriers.
2. **TURN relay: Cloudflare Realtime TURN** (anycast, so each phone uses its nearest PoP, which matters for "any city to any city"). It switches on only when the credential secret exists: short-lived credentials are minted server-side, and none ever appear in the repo or CI logs. Public price (*est.* until billed): first 1,000 GB/month free, then $0.05/GB. **Per match-hour:** about 60 packets/s × about 120 B (payload + redundancy + DTLS/SCTP/UDP) ≈ 7 KB/s per direction ≈ 52 MB relayed per match-hour ≈ **$0.0026 per match-hour**. The free tier covers about 19,000 relayed match-hours a month. Alternative at $0: coturn on the existing Hetzner VPS (traffic included), but it sits in Germany, so a Dubai↔SEA pair would add a long detour. Kept only as a backup. **Money is Dom's call; nothing is enabled without his yes.**
3. **Supabase Realtime broadcast (fallback relay + signalling).** Already running, $0 to start. The Frankendom project is in **ap-south-1 (Mumbai)**, so every relayed packet goes phone → Mumbai → phone. *Est.* RTT: Dubai↔Dubai 60–90 ms (inside D 2 + R 4), Dubai↔Singapore 110–150 ms (inside R 8), US↔US 350–450 ms (Poor, so Realtime cannot be the worldwide relay). Cost is per message (public price: 5 M/month on Pro, then about $2.50 per million). At 30 batched packets/s a side, counted sent + received ≈ 430 k messages ≈ **$1.08 per match-hour, about 400× TURN**. Realtime therefore does signalling, the challenge-link lobby and the first two-phone test; it is not the steady-state relay.

## 5. Desync detection and recovery

- An FNV-1a hash of the canonical fighter state (numbers as float64 bits) every 30 ticks (0.5 s), carried in the packets, compared once both sides confirm that tick.
- **On mismatch:** the match is declared **No contest** (no rank, no marks). Both clients upload the record plus a state dump from the diverging tick to a `net_desyncs` table and Sentry; the verifier replay shows which side was wrong. There is no state-transfer "repair": determinism is the bet, so a desync is a bug to fix, not to hide. The requirement is **0 desyncs**.
- **Disconnects:** no packets for 3 s → pause overlay. 15 s → the leaver forfeits (recorded; rewarded only once the server replay of the ticks both sides confirmed agrees). Reconnect inside the 15 s resyncs from the last confirmed tick. Rematch = the same channel with a new seed.

## 6. Cheating — what the verifier catches and what it cannot

- **Catches:** impossible results (a claimed win the replay doesn't reach), doctored logs after the fact (§1), illegal actions (the sim already ignores them, so a forged "parry during recovery" does nothing), modified clients with different rules (hash chain mismatch → No contest, flagged).
- **Cannot catch on its own:**
  - (a) **Assist bots.** A client that auto-parries on the opponent's `AttackStarted` sends inputs that are perfectly legal.
  - (b) **Lookahead within the window.** A client can hold back its own tick-t input until it has seen the peer's, up to R_max. Bound: inputs for tick t that arrive more than R_max ticks late are dropped (the peer's prediction stands), which caps the cheat at 133 ms. On relayed matches, the relay's arrival timestamps let the server check this; pure P2P gives no trusted clock.
- **Answer for (a) and the rest of (b):** statistics over many matches. Reaction-time distributions from the replays (`autopsy.ts` already reads habits); inhumanly fast, consistent parries → flag and review. No kernel-level anti-cheat is possible on the web. Ranked rewards should assume this.

## 7. Where the code lives (zero change to single-player)

**Rewards gate, day 1 (Strategy ruling):** PvP results never write marks, rank or loot until the statistics check for assist bots (§6) exists. This is enforced in code by a constant pinned in a test, not left to a flag someone flips.

`src/net/`: `rollback.ts` (pure: input queues, prediction, snapshot ring, resim, hashes), `transport.ts` (WebRTC + Realtime), `pvp-record.ts`, `view.ts` (`viewAs(duel, side)`: swaps fighters and flips event sides, so the guest's scene, HUD and audio, which assume the player is side 0, work unchanged), `lobby.ts` (challenge link). **One switch** in `main.ts` (`?duel=<id>`). Nothing in the sim imports `src/net/`. No `SIM_FILES` edit, so `SIM_DIGEST` and every release row stay put; if a sim change turns out to be needed, it goes to Lead first as a digest bump. Matchmaking comes later: a Supabase queue table banded by rank, paired by measured ping, never refused by region.

## 8. Go/no-go plan (about one week of lane time)

| Day | Step | Mac? |
|---|---|---|
| 1–2 | `rollback.ts` + two in-process peers over a fake link with injected latency (0–300 ms), jitter and 0–10 % loss: final hashes equal, rollback counts logged. Determinism tests of §2.1–2.3 in CI (Node 22 + Playwright Chromium + WebKit) | No, CI |
| 3 | Realtime transport + ping; built to `/preview/` as a look-test (no release rows) via Deploy. Two phones in one room (Wi-Fi vs 4G) | Preview publish only |
| 4 | WebRTC P2P + STUN; record the ICE outcome per carrier. TURN only after Dom's yes | No |
| 5 | Far test Dubai↔SEA with a second person (Lead books Dom + second phone). Dom plays 10+ duels | No |
| 6 | Verifier replay of every test match's two streams; report | No |

**Numbers collected per match** go into a new `duel_metrics` table (its own migration; Deploy applies it on hosted). They do not go into `perf_beacons`, whose strict CHECK columns, insert-only anon grant and shared 120/min / 20k/day cap belong to the fight beacon: RTT p50/p95 and jitter per transport per pair, loss, ICE result (host/srflx/relay/fail), D used, rollbacks/min plus a depth histogram, resim ms p95 per phone, dropped frames, **flipped outcomes/min**, desyncs, verifier agreement.

**GO if all hold:**
- 0 desyncs over the 1,000-fight fixture on 4 engines and 50+ real matches.
- Same-city rollback depth p95 ≤ 4 ticks.
- Dubai↔SEA playable at D ≤ 4.
- Resim p95 < 4 ms on the slowest test phone.
- Flipped outcomes ≤ 1/min same-city (*est.* bar, set from Dom's play).
- Dom says same-city "feels right" and far "acceptable".

**NO-GO or rethink if:** any unexplained desync, or feel only works after widening windows.

**Estimate:** about 1,000 lines for the experiment (*est.*). The full build (queue, reconnect, rematch, results into rank/marks, statistics-based anti-cheat, UI) was guessed at 2,000–2,500 lines; that stays a guess until day 6, when it gets replaced with a real figure.
