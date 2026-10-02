# Frankendom handover to GPT — 2026-10-02 07:40 (+04)

Written by the Strategy lane (Claude) at Dom's request: Dom is moving all work to GPT. Every fact below was checked at 07:38–07:40 by `curl`, `git` or `gh` unless marked **(lane report)**.

## 1. What is live

- **frankendom.com = `51e092ae`** (`release.json`). That is trunk `codex/01a09a76/task-1` up to the share row (#1277) + its desktop layout-check fix (#1309).
- **UPDATE 07:5x: `c107068c` (#1307 Brynhildr dark-bronze night armour) is LIVE** (Deploy report + my curl). Dom typed his relay yes in Deploy's session; Deploy runs the relay install next and reports health/mint.
- Live overnight, each checked live: Night Pit clay foot dust (a0c7c226), Pit skull wall (f2e52e4a), duel relay player code dormant (ae37426d), share row DUEL/LINK/CLIP (51e092ae).

## 2. Duels for players — Dom said "activate it now" (07:3x). Status: NOT live

| Step | State | Owner / how |
|---|---|---|
| DB migration `202610030001_duel_metrics_reconnects` | **DONE** (Strategy, Supabase project `rxbewmzmovelckzoosss`; column + anon/authenticated INSERT verified) | — |
| Relay install on VPS 49.12.7.18 | **NOT done** — `https://frankendom.com/duel/relay/health` = 404 at 07:38 | Deploy: `SUPABASE_URL=… SUPABASE_ANON_KEY=… bash ops/install-duel-relay.sh <trunk rev>` as root. Rollback: `bash ops/install-duel-relay.sh --rollback`. Edits production nginx; Deploy's state doc wants Dom's typed yes in its own session. |
| Players flag | **NOT done** | add `DUEL_RELAY_PLAYERS=1` to `/etc/frankendom/duel-relay.env`, restart `frankendom-duel-relay.service` |
| Client: DUEL for signed-in players | **#1314** @14281157, one line in `src/account.ts` (`duelTools = !tools.hidden \|\| !!userId`) + test re-pin. Code read OK. CI was running; stills (375 + desktop, signed-in + guest), tests, Auditer owed | Web → READY → Deploy |
| Client: send reconnects + lobby cues | **#1300** @3cfafa62, undrafted, CI running; Auditer owed | Duel → READY → Deploy |
| Live end-to-end test | owed | signed-in non-admin can mint + play; guest is refused (sign-in path); admin still works; a `duel_metrics` row carries `reconnects` |

Order: relay up (health 200) → ship #1314 + #1300 in one run → live test. Dom: once duels are on, tested, no bugs → **pause and reconcile** with him.

## 3. The 30 boss specials (ranks 8–10): NOT live

- They live only on the specials base `finishers/hades-shadow-claw-fx` (115 commits ahead of trunk, **483 behind**). Trunk has 0 `src/special-fx*` files; the base has 7.
- Verdict ledger (Strategy memory `frankendom_specials_ledger_2026-10-01.md`): all 30 have a DAY PASS; Night Pit PASSes tonight include Pitborn ×3, Executioner Reaper, Char Main Word/Bared Face/Ring/Aegis Sweep/Three Blows/Rim Shake (C @19c3a5d8). Still owed: Executioner Storm night film; World Nyx night; Nightborn Red Wind night (lane status unknown).
- Night batch rule: no base merges while the night batch captures. Base merge order when it ends (each after an Auditer delta): #1232 → #1279 → #1287, #1284, #1293, #1294, #1283, #1303, #1304, #1260 (+ Pitborn night colour f1735ae3), #1186, #1306.
- Then base → trunk: a big merge (483 trunk commits to absorb), full release run, live check. **Needs Dom's yes.** #1280 (specials rule 25 % / 20 %, re-arm from release, 45-tick recovery) was held "until after Saturday".
- Standing rule: pale soft discs at the hero's feet in base films = pre-#1298 game foot dust (`#b99a68` op 0.6), not a FAIL; they turn dark clay once the base takes trunk.

## 4. Ranks 4–7 class specials (10 classes): NOT live, partly built

- Dom's plan question is open: R1–3 keep the current skill move, one new move per class for R4–7 (Strategy recommends yes).
- Day PASS so far: Nightborn Seven Cuts (#1293, also Pit PASS), Goblin Rat Run, Centurion Stand Fast; Weapons (class-specials @8fbc9641): Stone Stirring, Taking the Pulse, Held Swing, Stone Wake PASS; Doctor's Tempo + Ground Drag FAIL (too faint) — sent back to Weapons 07:12. Night films owed for all.
- Open: Goblin Ankle Biter reads like Rat Run; Centurion Hobnail re-film; other classes not started (lane report).

## 5. Waiting on Dom

1. Relay install yes (in Deploy's session) — see §2.
2. #1305 Executioner L3 body lift and #1313 Executioner L8 body lift — Strategy PASS, HOLD for Dom.
3. #1282 Nightborn L9 albedo + steel-green tint — HOLD for Dom.
4. R4–7 plan (§4).
5. Specials base → trunk (§3) and #1280 timing.
6. Two Strategy PR comments posted at 04:55 as a workaround for the desktop message pause (#1307 c5943547514, #1306 c5943549940): keep or delete.

## 6. Rulings in force (from tonight)

- Night Pit: "quiet beats pale" — dark ink near the floor tone is fine, nothing pale over fighters; but quiet ≠ invisible (a special must read at 375 in ≥2 frames).
- Visual PRs that touch end screens need a **desktop** still too, not just 375 (lesson from #1277 failing rows 37/38).
- Dwarf L8 body lift DROPPED (no gain); Nightborn L8 no change; Exec L8 PASS keeps near-black plate.
- Judge fit/looks from full-res frames, never scaled contact sheets.

## 7. How the machine works (read before acting)

- `AGENTS.md`, `PROJECT_STATE.md`, `docs/state/<lane>.md`; `docs/SCOPE.md` for beta scope.
- One deployer: only `scripts/deploy.sh` (Deploy lane) merges to trunk and publishes; 50 release rows; `release.json` carries the live sha.
- Auditer comments `PASS @ <sha>` on PRs; Lead gives READY + GO; Strategy gives look PASS/FAIL.
- VPS: `ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18`; capture artifacts under `/opt/frankendom-shadow/work/`.
- Strategy's full night log: memory `frankendom_strategy_handoff_2026-10-02_0012.md` (under `~/.claude/projects/-Users-domininclynch-Developer-frankendom-strategy/memory/`).
