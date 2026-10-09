# Frankendom: Origins — O0 baseline (Frankendom side)

Analyst: analyst-baseline, 2026-10-06. Read-only survey: no tests, builds or browsers were run for this document. All counts are
from `git ls-files`, `wc` and `grep` on the pinned tree. Citations are `path:line` at the pinned commit.

---

## 1. Pin

| What | Value | Source |
| --- | --- | --- |
| Trunk commit surveyed | Surveyed at `8a3cefb7`; the pins below were re-checked at `03cd0d61` (Merge PR #1426), 2026-10-06. **These numbers move with every sim change: read `src/record.ts` and `tests/record-version-guard.test.ts` on the commit you build on; never trust a number copied from here.** | `git rev-parse HEAD` |
| Live deployed revision | `d05ba4adfa3fdde2bf19db0fd11341c4605fd066`, phase `0B-swordplay` (2026-10-06) | `curl -s https://frankendom.com/release.json` |
| Live vs trunk | Live is an ancestor of trunk `03cd0d61`, 12 commits behind it at the re-check. | `git merge-base --is-ancestor`, `git log d05ba4ad..03cd0d61` |
| Record format | `RECORD_VERSION = 25` at `03cd0d61` (was 24 at `8a3cefb7`; v25 adds the Goblin's stab, v24 the late notice) | `src/record.ts:17` |
| Sim digest pin | `SIM_DIGEST 6e389dbc…` for version 25 over **12** sim files (`src/stab-rule.ts` joined the list) | `tests/record-version-guard.test.ts:20-21` |

---

## 2. Contracts Origins must not break

### 2.1 `src/duel.ts`: the 60 Hz two-fighter simulation

- **What it is:** a symmetric 1v1 simulation. It is pure and fixed at 60 Hz, with "no renderer, clock, randomness or browser state" (`src/duel.ts:6-7`). The step is `STEP = 1/60` (`src/sim.ts:2`).
- **Entry point:** `stepDuel(duel: Duel, intents: [Intent, Intent], R = RULES): Duel` (`src/duel.ts:149`). It returns a new `Duel` and never writes into its input. `tests/net-determinism.test.ts:49` freezes the input to prove this, and rollback depends on it (`src/net/rollback.ts:5`).
- **Inputs:**
  - `Intent`: `move` (camera-relative stick: x, z, yaw, run), edge-triggered `action`, level `guard`/`held`/`lock`, optional `guardDirection` and `cancel` (`src/duel.ts:10-18`).
  - `Action` (10 values) (`src/duel.ts:9`).
  - Each fighter is built once by `createFighter(...)` from weapon, scale, poise, health, guard profile, regen, speed and rig (`src/duel.ts:64`). Opponents come from `opponentFighter(o: Opponent)` (`src/duel.ts:66`). The fight starts with `initialDuel(opponent, weapon, skill)` (`src/duel.ts:69`) and adds Special Moves with `withSpecials(...)` (`src/duel.ts:74`).
- **Outputs:**
  - `Duel = { tick, fighters: [Fighter, Fighter], finish: Finish | null, events: CombatEvent[] }` (`src/duel.ts:56`).
  - `Finish = { victim, location, move, heading, draw? }` (`src/duel.ts:48`).
  - `CombatEvent` (Hit, Blocked, Parried, Killed, …) (`src/duel.ts:52`).
  - The `Fighter` record carries health, stamina, posture, phase and the other fields (`src/duel.ts:20-46`). **There is no stat or loadout field on `Fighter`.** Health, poise, scale, regen and speed are the only body numbers, and all of them come from `moves.ts` data.
- **Where randomness lives:** the duel has none. The opponent's AI decides from a seeded LCG inside `AiState` (`src/ai.ts:50`, `src/ai.ts:56`). Single-player is `Practice = duel + ai`, built by `initialPractice(seed, opponent, weapon, skill, specials)` and stepped by `stepPractice(practice, intent, profile)` (`src/combat.ts:112-114`).
- **Determinism guarantees (enforced, not just intended):**
  1. **Lint ban.** The `SIM` file list (`eslint.config.js:3`) bans `Math.random`, `Date.now`, `performance.now`, `window`, `document`, `localStorage` and `requestAnimationFrame` (`eslint.config.js:8`).
  2. **Import boundary.** Sim modules may import only each other (`tests/sim-boundary.test.ts:14`).
  3. **Cross-engine math.** `src/detmath.ts` gives fdlibm ports of sin, cos, atan2 and hypot built on + − × ÷ √ only (`src/detmath.ts:1-7`). The sim calls `M.*`, never `Math.<transcendental>` (`tests/detmath.test.ts:16`). Records before v20 replay on the frozen engine `Math` table, chosen only through `underRecord` (`src/detmath.ts:99-109`).
  4. **Version guard.** Any change to the sim files (12 at `03cd0d61`) without a `RECORD_VERSION` bump fails `tests/record-version-guard.test.ts:24`, which compares against the digest pin.
  5. **Intent quantization.** Intents are quantized before both recording and netcode (`src/record.ts:107`).
- **Hazard: module-level mutable sim state.** Three era flags plus the math table are globals: `PLAY_SCALE`/`RADIUS` and `LATE_NOTICE` (`src/play-radius.ts`), `STAB_ON` (`src/stab-rule.ts:6`, off by default when headless) and the detmath `table` (`src/detmath.ts`). They are set only through three doors: **live fights** through `match.ts` begin, which sets the circle, `setLateNotice(true)` and `setStab(true)` (`src/match.ts:112`); **replays** through `detmath.underRecord`, which wraps `underPlayScale` and `underStab` by the record's version (`src/detmath.ts:107-109`); and **PvP** through `pvpDuel`, which calls `setPlayScale(1)` (`src/net/rollback.ts`). Any new caller that steps a duel or a Practice (an Origins arena, server tooling) must enter through one of these doors. Otherwise it fights in the wrong circle, with no late notice and no Goblin stab, while still stamping the current record version.
- **Gear is not an input today.** `Loadout` is not consumed by `stepDuel`. The only `src/` importer of `gear-stats.ts` is a comment in `src/net/rollback.ts:18-21`, which says "pvpDuel ignores `gear` until brief 19 d5 wires a Loadout into stepDuel".

> **Which rank scale?** Specs and proposals that touch rank must name their scale: **tier** (1–10, the title: Recruit … Origin) or **career level** (1 to the cap: 50, `MAX_LEVEL` at `src/career.ts:9`, live since RV27 per Dom's 2026-10-05 ruling). Gladiator is tier 3 = career level 11.

### 2.2 `src/net/rollback.ts`: live PvP rollback

- Both phones run the whole duel. Each schedules its own quantized intent `delay` ticks ahead, predicts the peer's intent (last intent, edges dropped), and restores and re-steps on a mismatch (`src/net/rollback.ts:1-6`, `:47-52`).
- `NET = { delay: 2, maxDelay: 12, maxRollback: 8, hashEvery: 30, redundancy: 64, rttSamples: 120 }` (`:15`).
- The PvP start is `pvpDuel(a: Kit, b: Kit)`, with `Kit = { weapon, skill, gear?: string[] }`. `gear` is LootId text that rides the handshake and the record but **does not affect the sim yet** (`:18-26`).
- The desync fingerprint is `hashDuel` = FNV-1a 64 over canonical JSON of `{t, f, x}` (`:30-39`). **Any new field on `Fighter` changes every PvP hash and every state digest.**
- The playable bar is `PLAYABLE = { stallsPerMin: 60, maxDelay: 12, depthP95: 8 }`, measured at 250 ms RTT + 30 ms jitter + 10% loss (`:61-66`). The session class is at `:82`.
- Verification: `verifyDuel` re-derives a room from BOTH pages' records (`src/net/verify-duel.ts:1-8`, `:47`). Its own header says "No schema yet". `scripts/verify-duels.mjs` exists, but `deploy.sh` ships only the daily and loot verifiers (`scripts/deploy.sh:137-139`), and `PVP_REWARDS = false` (`src/net/rewards.ts:5`).

### 2.3 `src/career.ts`: career, rank function, names and thresholds

**The rank list** is ten titles, in order (`src/career.ts:8`):

| # | Title | Career levels | Wins (marks) needed |
| --- | --- | --- | --- |
| 1 | Recruit I–V | 1–5 | 0–4 |
| 2 | Legionary I–V | 6–10 | 5–9 |
| **3** | **Gladiator I–V** | **11–15** | **10–14** |
| 4 | Veteran I–V | 16–20 | 15–19 |
| 5 | Champion I–V | 21–25 | 20–24 |
| 6 | Praetorian I–V | 26–30 | 25–29 |
| 7 | Master I–V | 31–35 | 30–34 |
| 8 | Primus I–V | 36–40 | 35–39 |
| 9 | Invictus I–V | 41–45 | 40–44 |
| 10 | Origin I–V | 46–50 | 45–49 |

**How a rank is computed:**

- `level = levelOf(marks) = min(MAX_LEVEL, 1 + wins(marks))`, with `MAX_LEVEL = 50` (`src/career.ts:9`; the ladder was 46 before RV27, `OLD_MAX_LEVEL = 46` is kept only to judge old records). A non-finite value counts as 0.
- `rankFor(marks)` (`src/career.ts:48-53`):
  - The title is `TITLES[floor((level-1)/5)]`, the numeral is `I..V[(level-1) % 5]`, and the label is `"<Title> <Numeral>"`, for every level 1–50: levels 46–50 are `Origin I` … `Origin V` (no special case for the top).
- Each sub-rank takes one win. Marks only ever increase (`awardMark`, `:19-23`), so a rank never demotes (`:3-7`).

Gladiator check: the blueprint's "Gladiator is rank 3" holds. Gladiator is `TITLES[2]`, and as a tier it is `grades.levelOf('Gladiator') = 3` (`src/grades.ts:18`). As a *career level*, though, Gladiator I is level 11 (10 wins). Origins docs must say which scale they mean: tier 1–10 or level 1–50.

**Which marks the rank shows:** `shownMarks(server, profile, pending)`. This is the server figure plus pending claims when the server has a figure, otherwise the device count (`src/career.ts:17`).

**The difficulty dial:** a separate, device-only number (`src/career.ts:28-47`).
- The opponent fights at `fightLevel = dialLevel(dial, levelOf(marks))`. It never trails the rank by more than `DIAL_TRAIL = 5`.
- Two straight losses lower the dial by one. Each win raises it by one. Three straight wins snap it to the rank.
- The server enforces the floor: `levelRefusal` (`src/awards.ts:33-37`).

**Stale doc:** `docs/progression-direction.md:21` and `:44` still describe the superseded 3/5-marks-per-sub-rank ladder ("Origin at 205"). The code header records the change to the 46-level ladder on 2026-09-27 (`src/career.ts:3`).

### 2.4 Stats and tier tables

- **Tier = rank title.** `TIERS = TITLES` is the same array, not a copy (`src/grades.ts:15`), and `levelOf(tier)` returns 1–10 (`:18`).
- **Tier comes from the fight, not the opponent.** `tierAt(marks) = rankFor(marks).title` (`src/grades.ts:46`). The legend rung for a fight at level L is `rungOf(L) = levelOf(tierAt(L-1))` (`src/legends.ts:149`).
- **Grade materials.** `GRADES: Record<Tier, Grade>` holds colour, metalness and roughness for each tier. It is cosmetic only and never changes geometry (`src/grades.ts:1-4`, `:91-112`).
- **Opponent combat stats** (`src/moves.ts`):
  - `RULES.health = 150` for a man (`:167`).
  - The `Opponent` shape is `{ weapon, rig, scale, health, poise, profiles{easy,normal,hard}, guard?, regen?, speed? }` (`:568`). The per-archetype rows are in `ARCHETYPES` (`:570`), and `OPPONENTS` is derived from the roster (`:677`).
- **The 50-level difficulty ladder** (line numbers below are from the 46-level revision except where stated; re-check before quoting):
  - `LEVELS = 50` (`src/moves.ts:712`; 46 anchored the hard table, 47–50 are Origin II–V, the tail past hard). Anchors are still `{novice 1, easy 6, normal 18, hard 46}` (`:735`). AI knobs are blended linearly between anchors by `profileAt` (`:754`).
  - Body scaling: `NOVICE_BODY = {poise 0, health .7}` up to L6 (`:716`), `POISE_FULL_AT` (`:720`), and `opponentAt` (`:728`).
  - Level-gated loadouts: the Centurion carries the gladius and scutum from L6 (`LOADOUT_FROM`, `:726`).
  - Named specials on levels 36/41/46 (`SPECIAL_SETS`/`specialOf`, `:693-709`).
- **Player stats:** none exist. The player always fights as `RULES` plus weapon tables. `docs/progression-direction.md:7` says Recruit → Origin teaches the fight "without rank-based stat bonuses".

### 2.5 `src/gear-stats.ts`: the Attack cap and RES cap

- **Status: data only and not wired.** The header says "nothing here changes a fight yet" (`:1-2`). There is no runtime caller of `loadoutFor`/`kitFrom` in `src/`; only `tests/gear-stats.test.ts` imports it.
- **Shape and caps:**
  - `Loadout = { attack, res }`, both damage multipliers. `NAKED = {1, 1}` (`:28-31`).
  - `CAPS = { attack: 1.15, res: 0.80 }` is a full Origin set: at most +15% damage dealt and −20% damage taken (`:35`).
  - The bar these caps serve: "No stat changes the timing of any attack, parry, roll or wind-up" (`:14-17`).
- **Where the caps are resolved:**
  - `SLOT_WEIGHT` covers armour slots (Helmet 20, Body 30, Greaves 18, Arms 12, Boots 12, Gloves 8, Crest 0, Shield 0, summing to 100), and every weapon slot is 100 (`:58-64`).
  - `pointsFor = weight × (tierLevel − 1)` (`:71`), with `FULL_POINTS = 900` (`:67`).
  - `multipliers()` is the **only** place the caps are spelled out: `attack = (90000 + 15·weapon)/90000` and `res = (90000 − 20·armour)/90000` (`:84-89`).
  - `loadoutFor(kit)` totals the points; the best weapon wins and armour sums (`:93-103`).
  - A Recruit tier resolves to the identity (`:42-45`).
- **Resolution happens outside the sim:** "the duel takes a resolved `Loadout` as input and never sees a tier" (`:129-130`).
- **The hook is missing:** `kitFrom(equipped, tierOf)` needs a `TierOf(piece)` lookup that does not exist. Today "every kit resolves naked" (`:119`, `:125-138`).
- **The layer is meant to be extended:** the header says the Origin character layer "EXTENDS rather than replaces" the record (`:22-27`). It also says POISE, VIG and END/DEX belong to the character layer and never to gear (`:4-7`).

### 2.6 `src/legends.ts`

- `LEGENDS: Record<LegendOpponent, Legend[10]>`, where `Legend = { name, source, backstory }`. That is 10 opponents × 10 rungs = 100 named legends (`:15-22`, `:23-142`).
- The content rule is public-domain sources only, with no living-religion figures (`:1-6`; skill `legends-rule`).
- Text only: "no fight number reads this" (`:4`). Legends are kept outside the sim boundary (`:10`).
- **Legends have no ID.** A legend is addressed by `(opponentId, rung)`: `legendAt` (`:146`), `legendForLevel` (`:151`). Its stable external key is the portrait key `"<opponent>-<rung>"` (`:156-160`, `PORTRAIT_KEYS`), which is used by the skull wall (`Loot.defeats`, `src/loot.ts:35-40`), by `fight_results.opponent_key` (`supabase/migrations/202610050001_fight_results.sql:29`), and by the nginx og:image whitelist (`:158-159`).
- Names have changed without breaking anything because names are not keys (Count Dracula → Vlad, `docs/state/lead.md:278`).

### 2.7 `src/grades.ts`

- Covered in §2.4.
- **Declared but unused:** `OpponentAt` (`:49-50`) and `GradeRecord { level, tier, kit: LootId[], epithet, house }` (`:125`) are declared and consumed by nothing yet ("lands once so two lanes build on one field").
- `?tier=` look pin: `:19-36`. It is presentation only.

### 2.8 `docs/progression-direction.md`: the draft five-stat vocabulary

- **Status:** an owner proposal from 2026-09-19. It says "design proposals, not shipped systems or settled balance" (`:3`).
- **Scope:** Season 1 is Recruit → Origin with no rank stat bonuses. Builds unlock at Origin (`:3`, `:7`).
- **The five stats:** STR, DEX, VIG, END and POISE, normalised at 100, with a proposed extra allocation of 50 points at Origin (`:9`).
- **Open decisions** (`:13-21`):
  - Point acquisition: grant everything at unlock, or normalise for competitive play.
  - DEX: stamina efficiency, not recovery, so punish windows survive.
  - Health scale: VIG 130 = 195 HP at today's 150 base. Do not silently rebalance to 100.
  - Armour: proposed RES/DEX/END trade-offs. Armour adds no POISE.
  - Rarity: conflicts with the sidegrade default.
- **Integration contracts** (`:31-42`):
  - Rank is derived from server marks by a pure function.
  - Fight result records are versioned (fight ID, season ID `season-1`, rules/content version, seed, verification source).
  - Future builds are a versioned loadout referencing stable item IDs plus an approved allocation, resolved once outside the sim ticks.
- **Relation to the code:** gear-stats.ts already took the "gear = Attack + RES only" half of this (§2.5). No STR/DEX/VIG/END/POISE code exists. `Fighter.poise` (`src/duel.ts:37`) is an opponent body stat with a different meaning: a stagger threshold, 0 for a human.

---

## 3. Persistence and identity (Supabase)

### 3.1 Migrations (26 files, `supabase/migrations/`, plus 2 ops scripts in `supabase/ops/`)

| Table / object | Migration | What it holds | RLS / grants |
| --- | --- | --- | --- |
| `fighter_profiles` | `202609190001_fighter_profiles.sql:2-22`; encounter allow-list widened in `…0002`, `…0003`, `202609200001`, `202609230002`; `victory_marks` `202609200004…:5`; `loot jsonb` `202609210004_loot.sql:5`; 64 KB loot cap `202609260001_loot_size.sql` | display_name, encounter, revision (optimistic lock), victory_marks, loot | RLS on. Owner select/insert/update by `auth.uid()` (`…0001:8-15`) |
| `admins` | `202609210001_admins.sql:4-11` | test-tool roster | self-read only |
| `fight_records` | `202609210002…:6-16`; column-limited select `202609220006`; guest share `guest_key` + `share_limits` + pruning `202609220010`; short ids `mint_share` `202609220009:32`; `fight_hash` `202610010001:10` | shared kill-link records | anon/auth read by id. Insert: own row, 30/h. Update/delete revoked from clients (`202610010001:22`) |
| `daily_secret`, `daily_fight()`, `daily_results`, `daily_board(+_summary)` | `202609210003…`, verifier role `202609210005`, `202609220007` | daily warden seed and results | the board is public. Insert: own row, today, once. The verifier role flips `verified` |
| `account_seed`, `loot_claims`, `awards`, `standing_of()`, `my_standing()` | `202609230001_server_awards.sql:8-115`; `fight_hash` + one-win-per-fight unique index `202610010001:9-17` | **server-authoritative marks and loot** | clients insert claims only as `not verified` (`:50`) and read their own. Awards have no client write; `frankendom_verifier` inserts them (`:90-94`) |
| `perf_beacons`, `perf_device_spread` | `202609280001…:20-94`, `202609290001` | anonymous per-fight perf beacon | insert-only for anon/auth, rate-limited, 90-day prune |
| `duel_metrics` | `202609300001…:11-56`, `202610020001`, `202610030001` | PvP netcode metrics per side | insert-only, rate-limited |
| `fight_results`, `duel_starts`, `duel_reports`, `report_duel*()`, `settle_forfeits()`, `pit_*()` | `202610050001_fight_results.sql:16-126+` | Pit skull-wall rows (AI and duel) | own-select. Clients insert `kind='ai'` only (`:35`). Duel rows are written only by security-definer functions once both reports agree |
| hygiene | `202609220008_rls_auto_enable_no_rpc.sql`, `202610040001_rls_initplan.sql` | RLS auto-enable not callable as RPC; `(select auth.uid())` initplan | — |

RLS is enabled on every table that the migrations create. The default client grants are revoked and then re-granted per column (for example `202609230001:52-53`).

### 3.2 Who writes what (client calls)

| Call | Writes / reads | File |
| --- | --- | --- |
| `fighter_profiles` insert/update (`revision` guard) | display_name, encounter, **client-reported** victory_marks, loot jsonb | `src/cloud-profile.ts:66-73` (fields `:17-20`) |
| `rpc('my_standing')` | server marks/owned + pending | `src/cloud-profile.ts:83` |
| `rpc` admins read | admin flag | `src/cloud-profile.ts:101` |
| `loot_claims` insert (via SDK and via keepalive `fetch`) | one claim per signed-in ladder win: opponent, piece (or null), record | `src/loot-claims.ts:114`, `:160`. The outbox key is `frankendom.claims.v1` (`:6-12`) |
| `fight_records` insert / `rpc/mint_share` / select by id | shared kill links (signed-in and guest) | `src/share-store.ts:55`, `:38`, `:65` |
| `fight_results` insert (`kind:'ai'`) | cosmetic skull-wall row | `src/fight-results.ts:19` |
| `rpc report_duel_start` / `report_duel`; `duel_metrics` POST | PvP room registration, result + hash, metrics | `src/net/lobby.ts:87`, `:99`, `:131` |
| `perf_beacons` POST | anonymous perf | `src/perf-beacon.ts:78` |
| `rpc pit_recent_kills` / `pit_record` / `daily_board_summary` | Pit wall reads | `src/pit/skulls.ts:79`, `:112`, `:186` |
| daily results | **no client writer at this commit.** The daily warden was removed from the client; the tables and verifier remain | `src/main.ts:1196-1197`, `src/match.ts:4`, `:47` |

**Local storage:**
- The profile is stored under `frankendom.fighter.v1`, with shape `{ id, name, encounter, pass, dial, career.victoryMarks, loot }` (`src/profile.ts:3-5`).
- The dial is device-only.

### 3.3 Server-verified vs client-trusted today

**Server-verified, by replaying the record:**
- **Ladder-win marks and loot awards.**
  - The verifier is `scripts/verify-loot.mjs`, run on a VPS timer as `frankendom_verifier` (`ops/frankendom-verify-loot.*`).
  - It decodes the record, checks that it names the claim's opponent and says `killed`, and replays it with `verifyRecord` (`src/replay.ts:22`).
  - It applies the dial floor (`src/awards.ts:33-37`) and the piece rule (`awardFor`, `src/awards.ts:22-27`), then writes `verified` + `awards` in one transaction.
  - One fight is one win, enforced by `fight_hash` (`scripts/verify-loot.mjs:1-20`; `202610010001:13`).
  - Server marks = `account_seed.marks + count(verified claims)`; server owned = `account_seed.owned ∪ awards` (`202609230001:2-4`).
- **Daily results.** These are replayed by `scripts/verify-daily.mjs:1-6`, but nothing is being posted now (see §3.2).

**Client-trusted, display or cosmetic only:**
- `fighter_profiles.victory_marks` and `.loot`. These are "a client-reported beta count — a display value, never rank authority" (`src/cloud-profile.ts:15-16`), and were read into `account_seed` only once (`202609230001:2-7`).
- Guest progress, which is never server-checked.
- `fight_results` AI rows, which are cosmetic and "never awards, rewards, rank or loot" (`src/fight-results.ts:1-4`).
- `fight_results` duel rows. Two pages must agree on the hash, but there is no replay (`202610050001:5-14`).
- PvP in general: `verifyDuel` is not deployed and `PVP_REWARDS = false`.
- Perf beacons and duel metrics.

**Server-checked rank:** none is stored. Rank is always derived from marks by `rankFor`. `src/career.ts:7` notes that `deploy.sh` ships `src/` to the verifier, "so client and server switch together".

### 3.4 Google sign-in flow

- `src/account-entry.ts:1-26`:
  - Guests never load the SDK.
  - The account mounts on a journal click, on `?account=return`, or at idle when a stored session exists (`frankendom.auth.v1`).
- `src/account.ts`:
  - `createClient` uses `flowType: 'pkce'` and `storageKey: 'frankendom.auth.v1'` with a 10 s fetch timeout (`:17-20`).
  - Sign-in is `signInWithOAuth({ provider: 'google', redirectTo: '/?account=return', prompt: 'select_account' })` (`:128`).
  - `exchangeCodeForSession` runs on return (`:152`), and sign-out is local-scope (`:133-139`).
- Identity is `auth.users.id` (uuid). Every table keys on it with `on delete cascade`. The device profile `id` is never uploaded (`src/cloud-profile.ts:15`).

---

## 4. Replay and determinism fixtures ("frozen arena replays" candidates)

The fixtures live in `tests/fixtures/` (48 KB). All four are gzip+base64 `FightRecord`s with pinned outcomes.

| Fixture | Contents | Asserted by | How it runs |
| --- | --- | --- | --- |
| `fight-records.json` | 5 reference fights vs the Centurion: walk-in, scripted, witchfire, pommel, hewer. Each has `expect {ticks, outcome, killedTick, digest}` | `scripts/record-replay-check.mjs` (same final tick, outcome and state digest; `--strict` also gates on the digest and on stale fixtures, Mac-only for the digest per `:14-15`). Self-tests are in `tests/record-replay-check.test.ts:25-85` | A CORE release row on every deploy (`scripts/release-rows-for.mjs:36`). Regenerate only for an intentional rules change (`--write`) |
| `browser-replay-records.json` | 11 records: one per playable opponent (10) at L18, seed 731, plus the seed-828 Dwarf divergence repro. Victim, draw, tick and sampled state hashes | `tests/browser-replay-check.test.ts:16-36` (Node leg, page construction path); `scripts/browser-replay-check.mjs` compares Chromium and WebKit against Node | `test:all`. Release row `browser-replay-check` runs when `ai/moves/sim/record/replay` or fixtures change (`scripts/release-rows-for.mjs:40`); the WebKit row is in `.github/workflows/release-checks.yml:132` |
| `v22-records.json` | 3 records from the v22 build (veteran, pitborn, goblin), with hashes every 60 ticks. "Never regenerate." | `tests/v22-records.test.ts:12`: still replays in the old 8.55 m circle | `npm test` |
| `v22-warden-l12.json` | 3 Knight L12 records from before late notice, stamped v22, with hashes | the late-notice back-compat tests (v<24 replays without the ramp) | `npm test` |

**Other determinism gates (no fixture file):**
- `tests/record-version-guard.test.ts`: the sim digest and accept-list pin, plus the import-closure walk (`:24-65`).
- `tests/detmath.test.ts`: the transcendental ban, the frozen legacy table, 1-ulp accuracy and pinned bits (`:16-66`).
- `tests/net-determinism.test.ts`: the ban-list closure, immutability of `stepDuel`, and a stable cross-engine chain (`:34-62`). The chain is `src/net/fixture.ts:14-38`: seeded warden-vs-warden PvP over every weapon, folded into an FNV chain. The browser legs are `scripts/net-engines-check.mjs` (Chromium and WebKit on CI, `.github/workflows/quality.yml:183`).
- `tests/sim-boundary.test.ts:14`, `tests/replay.test.ts:32-71` (genuine record verifies, tampered refused, `[slow]`), `tests/verify-loot.test.ts`, `tests/verify-daily.test.ts`, `tests/verify-duel.test.ts`, `tests/net-rollback.test.ts` (two sessions over a fake link).

**For Origins regression gates:**
- `browser-replay-records.json` is the best "frozen arena replay" seed: it covers the whole roster on one level and is already cross-engine.
- `fight-records.json` is the strict digest gate.
- Neither carries a loadout or stats, because `RecordMeta` is `{ build, opponent, weapon, skill?, level, seed, specials? }` (`src/record.ts:91`). A gear-neutral "NAKED replays byte-identical" fixture set is what `gear-stats.ts:29-31` asks deliverable 2 to prove.

**Test counts by area** (233 test files: 230 `*.test.ts` + 3 `*.test.mjs`; 1,625 `test(`/`it(` calls; 21 files carry `[slow]` cases). Files are bucketed by name, first match wins.

| Area | Files |
| --- | --- |
| Specials, signatures, sparring, skills | 50 |
| Arena, world, FX, camera (incl. arena audio) | 44 |
| Sim / combat / AI / opponents / match | 28 |
| Release / CI / ops tooling, player-bot | 19 |
| Career, ladder, legends, grades, gear stats, skulls | 17 |
| Server, account, persistence, share | 15 |
| HUD / UI / input | 15 |
| Net / PvP | 12 |
| Characters, rigs, assets | 11 |
| Loot / paperdoll / player weapons | 11 |
| Record / replay / determinism | 10 |
| Audio (other) | 1 |

Run commands (`package.json`): `npm test` (skips `[slow]`), `npm run test:slow`, `npm run test:all`, and `quality:ci` = eslint + typecheck + `test:all` + build + audit + budget. Heavy runs go to the VPS (Dom, 2026-10-04).

---

## 5. Content and data IDs (input to the O1 schema)

| Entity | Identifier today | Kind | Where |
| --- | --- | --- | --- |
| Opponent (class) | `OpponentId` = key of `ROSTER`: `veteran, pitborn, goblin, nightborn, executioner, minotaur, wraith, werewolf, skeleton, dwarf, plaguedoctor, knight, witch, shieldmaiden` (14; 4 `hold`) | stable lowercase string, no separator; server regex `^[a-z]{1,32}$` | `src/roster.ts:11-45`, `:30-31`; `202609230001:25` |
| Display name | `ROSTER[id].name` ("the Centurion" for `veteran`) | text, renameable; not a key | `src/roster.ts:12`, `:59-62` |
| Legend | `(OpponentId, rung 1..10)`; external key `"<opponent>-<rung>"` | composite; array index | `src/legends.ts:146-160` |
| Archetype | `ROSTER[id].archetype` string; several opponents share one | string key into `ARCHETYPES` | `src/moves.ts:570` |
| Weapon | `WeaponId` (10: longsword, trident, cleaver, estoc, knife, gladius, scythe, maul, reaper, warhammer); 9 in `PLAYER_WEAPONS` | stable lowercase string | `src/moves.ts:254`, `:540-552` |
| Loot piece | `LootId` = `` `${OpponentId}.${LootSlot}` `` (for example `veteran.Helmet`, `dwarf.Warhammer`); 74 in `LOOT` + 1 `RETIRED_LOOT` | **definition id** (class + slot), no tier, no instance; server regex `^[a-z]{1,32}\.[A-Za-z]{1,32}$` | `src/loot.ts:26`, `:68-94`; `202609230001:27`, `:59` |
| Slot | `ARMOUR_SLOTS` (8) + `WEAPON_SLOTS` (9, capitalised weapon names) → `PAPERDOLL` keys `head, crest, chest, arms, hands, legs, feet, main, off` | strings | `src/loot.ts:12-25` |
| Tier | rank title string (`'Gladiator'`); level 1..10 via `levelOf` | derived from the fight's marks, never stored on the piece except as `Provenance.tier` / `awards.tier` | `src/grades.ts:15-18`, `:46`; `src/loot.ts:32` |
| Skill | `SkillId` (11 strings), `SKILLS[id].opponent` | stable string | `src/moves.ts:8`; `src/loot.ts:46` |
| Special | `SpecialName` strings per opponent × rank 8/9/10 | stable string | `src/moves.ts:693-709` |
| Move | `MoveId` strings | stable string | `src/moves.ts:6` |
| Mesh draw | `"<opponent>.<slot>.<material>"` in `loot.glb`; shared meshes `~kit.Gloves` | asset naming | `src/loot.ts:1-2`, `:63-65`; `src/grades.ts:80-82` |
| Fight | `fight_hash` (sha256 of the record's fight bytes); `loot_claims.id` bigint; share short id (base36) | server ids | `202610010001`, `202609220009` |

**The player's inventory shape:**

```ts
Loot = {
  owned: LootId[],
  equipped: Partial<Record<Paperdoll, LootId>>,
  pack?: LootId[],
  taken?: Partial<Record<LootId, Provenance>>,
  declined?: Provenance[],
  skill?: SkillId,
  defeats?: string[],
}
```

(`src/loot.ts:40`). It is stored whole as `fighter_profiles.loot` jsonb (64 KB cap).

**Collisions with a new item-instance model (ItemDefinition/ItemInstance, LootTable):**

1. **`LootId` is a definition, used as if it were an instance.**
   - `owned` is de-duplicated by `cleanLoot` (`src/loot.ts:154-156`).
   - `dropFor` returns null if the piece is already owned (`:145-149`).
   - `awardFor` returns null for an owned piece (`src/awards.ts:26`).
   - So a player can hold **at most one of each `<opponent>.<slot>` across all tiers**. A Gladiator `veteran.Helmet` and an Origin `veteran.Helmet` cannot coexist.
2. **Tier is keyed by definition.** `taken: Record<LootId, Provenance>` (`src/loot.ts:40`) holds one provenance (and so one tier) per LootId. The gear-stats `TierOf(piece: LootId)` (`src/gear-stats.ts:119`) has the same one-tier-per-definition assumption.
3. **The paperdoll references definitions.** `equipped` and `pack` hold LootIds. Instance ids would need a new field or a migration in `cleanLoot`. `cleanLoot` silently drops anything that fails `isLootId` (`:152-156`), so **an older build would erase unknown instance ids** when it saves. `profileDiffers` re-merges from a newer device (`:38-39`), but only for known ids.
4. **Server checks pin the `<opponent>.<Slot>` grammar.** `loot_claims.piece` and `awards.piece` CHECK regexes (`202609230001:27`, `:59`), `awards.tier smallint 1..10`, the one-award-per-claim primary key (`awards.claim_id`), and `account_seed.owned`/`standing_of().owned` as LootId arrays. Instance ids would need a migration on both tables plus a change to `verify-loot.mjs`.
5. **Take-one-piece (Loot v2).**
   - A claim names exactly one `piece` or null (`202609230001:20-21`; `src/awards.ts:5-7`), and a declined take is still a mark.
   - Any "pick one from a LootTable roll" must keep "one claim → at most one award" and the verifier's `kitAt(opponent, tier)` membership test (`src/awards.ts:18-19`).
   - `kitAt` reads `WORN_FROM`, a per-definition tier floor, which is empty today (`src/loot.ts:84-88`).
6. **Weapons are both loot and sim ids.**
   - Loot `"<opponent>.<Weapon>"` maps to `WeaponId` by lower-casing the slot (`src/loot.ts:119`), and the main hand decides the sim weapon (`fightWeapon`, `:123`).
   - Loot v2 wielding means an item instance must keep resolving to a `WeaponId` for `createFighter`.
   - `reaper` is a `WeaponId` with no loot slot.
7. **PvP and the skull wall carry LootId strings.** `Kit.gear?: string[]` (`src/net/rollback.ts:22`, inside PvP records) and `fight_results.opponent_gear` jsonb.
8. **Retired ids must stay valid forever.** See `RETIRED_LOOT` (`src/loot.ts:89-93`): "a roster change never deletes a player's item".
9. **Legends have no id of their own.** If O1 needs a CharacterDefinition per legend, the `"<opponent>-<rung>"` key is already persisted (skull wall `defeats`, `fight_results.opponent_key`, nginx). Reuse it rather than mint a new one.

---

## 6. Size (counted separately; size is not quality)

| Bucket | Count | Notes |
| --- | --- | --- |
| Executable TS/JS in `src/` (excluding `src/assets/`) | **23,351 lines**, 167 `.ts` files | includes `blade-paths.ts`, which is 3 lines but **324 KB** of baked blade tables |
| TS in `src/assets/` (arena crowd/texture workers) | 406 lines | |
| Of which the sim (11 `SIM_FILES`) | `duel.ts` 422, `moves.ts` 767, `ai.ts`, `sim.ts` 38, `record.ts` 258, `blade*.ts`, `roster.ts` 67, `finishers.ts`, `detmath.ts` 111, `play-radius.ts` | lines are very long (duel.ts is about 47 KB) |
| CSS | `src/style.css` 2,445 lines | |
| Scripts (`scripts/*.mjs/js/ts/sh/py`) | 29,229 lines | build, bake, verifier and release-row tooling |
| Tests | **29,048 lines**, 233 test files, 1,625 test cases | plus helper `.ts` (`special-battery.ts`, `strategies.ts`) |
| Supabase SQL | 1,034 lines (26 migrations + 2 ops) | |
| **Content tables (data in code)** | `legends.ts` 161 lines (100 legends); `LOOT` 74 piece ids + 1 retired; `ROSTER` 14 recipes (10 playable); `ARCHETYPES`/`PROFILES`/`RULES`/weapon tables in `moves.ts`; `GRADES` 10 tiers × 3 finishes; `SLOT_WEIGHT` 17 slots; `SPECIAL_SETS` 30 specials; `SKILLS` 11 | |
| **Assets in git** (`src/assets` + `public`) | 1,203 files. GLB: 113 in `src` (342 MB) + 237 in `public` (525 MB) = **about 867 MB raw**. JPG 333 (44 MB), PNG 76 (9.7 MB), WebP 299 (8.0 MB, including 100 legend portraits), audio 90 (m4a + ogg, 2.7 MB) | raw repository bytes, not download size (see §7) |
| Repo total | 2,300 tracked files | |

---

## 7. Device measurements and budgets (existing receipts only; nothing new was measured)

**Download budgets (enforced on every release by `scripts/check-budget.mjs`, gzip bytes):**
- Per fight: `PER_FIGHT = 12_000_000`.
- Whole `dist/`: `TOTAL = 44_000_000`.
- Loot: `LOOT = 3_500_000`.
- Lorarius guard: `GUARD = 400_000`.

All four are set at `scripts/check-budget.mjs:128`. Per-opponent look-set caps are at `:66-67`, with measured sets in the comments at `:20-40` (for example knight 22,124,123 B and nightborn 22,729,937 B). Weapon shapes are at `:89`, shields at `:96`, portraits at `:71` (4.8 MB total, 48 KB per file), and Pit assets at `:103-127`. One receipt: default fight 9,871,330 B gz, total 43.63 of 44 MB, headroom 374,511 B (`docs/state/herolook.md:470`).

**Frame-rate targets and receipts:**
- **Acceptance target, not yet met:** physical iPhone 12 and Pixel 6, five active minutes each, median ≥ 55 fps and p95 ≤ 25 ms (`docs/reliability-audit.md:27-30`).
- **Android PASS bar** (Strategy): p50 ≥ 30 fps AND p5 ≥ 20 fps over a full fight AND first fight ≤ 20 s (`docs/state/lead.md:401`).
- **Dom's iPhone 15, Low Power Mode off, build 026d07e4:** 59 fps p50 / 34–50 fps p5, and "the bar PASSES". An earlier "30 fps" reading was the WebKit Low-Power 30 Hz rAF cap (`docs/state/code-quality.md:400`; `docs/state/lead.md:278`).
- **Earlier iPhone 15 movement spot check:** 59 fps / p95 18 ms. "This does not pass the minimum-device/external-player gate" (`docs/state/character.md:375`). Desktop preview showed about 60 fps / p95 17–18 ms (`:381`).
- **Mid-range Android:** the PASS run is still owed per `docs/state/lead.md:401`. No receipt was found in `docs/`.

**Memory:**
- **GC-stall finding** (2026-09-25, live build, phone tier, idle fight): JS heap sawtooth about 47 → 80 MB every ~13 frames, about 2.5 MB garbage per frame, ×1 throttle p95 80 ms / worst 355 ms (`docs/state/code-quality.md:634`).
- **The fix:** `SkinnedMesh.applyBoneTransform` garbage, #748, is recorded LIVE at `docs/state/code-quality.md:613`.
- **Pit memory-leak gate:** `renderer.info.memory` is equal across 10 enter/leave cycles, plus a heap-delta bound (`docs/pit-design.md:86`).
- No standing memory budget constant exists in code.

**Field telemetry:** `perf_beacons` (anonymous per-fight perf, `202609280001`) and the `perf_device_spread` view exist. This survey did not query them.
