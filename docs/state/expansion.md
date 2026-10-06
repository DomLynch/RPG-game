# Expansion lane (Frankendom: Origins) — state

## 2026-10-07 07:05 (+04) — HANDOFF before /clear. READ FIRST, then memory

Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (all rulings, in order; the 2026-10-07 lines are newest). Session folder: app worktree `.../worktrees/elastic-gates-c6edc0`; Dom to reopen on `~/Developer/frankendom-expansion`, worktree switch off.

**1. LIVE:** arena `925ff6c2` (includes #1443 bag+bank, #1446 journal, #1447 talk). Preview https://frankendom.com/preview/origins/ = greybox + REAL Pit duel (build from expansion/origins-combat @70761dac; I checked it at 375: duel vs Brokkr, 0 errors, live storage untouched). Writer route NOT installed (#1463 draft; needs Lead go + Deploy installer + Dom's role password/env file + flag/allowlist GO).

**2. PRs (mine):**
| PR | What | State |
|---|---|---|
| #1456 @42cbaff8 | inventory consume/burn + ledger | Auditor PASS, queued with Deploy |
| #1459 @bb88a203 | writer quest_advance + talk_pick | PASS, queued |
| #1460 @f22fed65 | writer consume (DEPLOY ORDER: after 0002, applied) | PASS, queued after #1459 |
| #1461 @6aba6a60 | contracts accept coin 0 (smith materials only) | PASS, with Lead |
| #1462 @d9ddfacd | greybox real Pit duel + "Loading…" | PASS, queued after #1460 |
| #1465 @13be8939 | greybox reads saved career via `open`, offline fallback | PASS, queued after #1462; when #1462 merges retarget to trunk with NO new commits |
| #1472 @c202fea7 | writer apply_upgrade (smith, coin>0 → 501) | PASS; after #1460+#1461 land: retarget to trunk, close/reopen for CI, tell Lead green → GO |
| #1457 @68c6fbc5 | boss id → 12-char sha-256 key | PASS, waits on #1448 merge, then retarget |
| #1468 @67e0be65 | trading spec (docs) | Lead GO'd for docs pass; DON'T PUSH until merged |
| #1450 | world params | PASS (earlier) |
Backend: #1469 = 0003 trade-settle blockers (acceptance model, escrow guard, deferred one-of-each trigger + 2 required swap tests), with Auditor, NO apply until trading is built.

**3. In flight at clear (agents; check their worktrees, restart from these briefs if unpushed):**
- Trade cooldown (pure contracts): `/private/tmp/claude-501/expansion-trade-cooldown`, branch `expansion/trade-cooldown` (had a `wip2` commit). Rule: 72 h first-trade delay, then 7/14/30 days per hop, cap 30, hop count from history 'trade' entries, no hard limit, never bound; bound = cash-shop items, metal, shop consumables/stackables; shop gear tradeable with origin 'shop'. Enforce in changeOffer + recheck in settleTrade; constants as data; exported tradeCooldown() for UI. PR to trunk.
- Region 1 content spec (docs): `/private/tmp/claude-501/expansion-region1`, branch `expansion/region1-spec` (no commit yet at clear). Ash Frontier, chapter one "The Stolen Name": zones as world params, NPCs/talk, 5–8 stage quest chain with #1428 CP, bosses/mobs (matriarch), loot, content-bundle files; legends rule binding.

**4. QUEUE:**
(1) Trading follow-up docs PR after #1468 merges: Dom's decisions (APPROVED "implement it" 07:00): barter only; escalating per-item cooldown replaces decision 3 (no hard limit); metals bronze/silver/gold 100:1 = BOUND NPC currency; gems not money; no tradeable metal at beta; narrow cash shop (cosmetics + convenience, bound, never random, never stats); auto-holds freeze trading only, 72 h expiry, Strategy/Lead review, Dom bans; NPC shops sell base gear for metal — shop GEAR tradeable (origin 'shop'), consumables bound, sell-back ≤ 25% (≈0 for shop-origin), daily NPC purchase cap; gates = Gladiator + verified email + 7-day account + 48 h Origins (phone = optional later, SMS cost is Dom's call); decision 10 = refuse same-def swaps until 0003, then settle.
(2) Smith follow-up after #1472: banked piece upgradable ONLY at the Exchange (Strategy (a)); story pieces may be upgraded + test the story flag survives.
(3) Cleanup PR after #1459/#1462/#1465 merge: inject ORIGINS_CONTENT from scripts/origins-writer.mjs (not at handlers import); openAccount comment (intended: quest/talk need priced career); vite.config.mjs node globals; "No reward: already beaten" HUD line; test pinning credentials:'omit'; N4 mint/single_copy consistency (or to Backend); FIPS two-block sha vector.
(4) Writer trade ops on 0003 once Strategy + Lead GO trading build; server-side trade gates; NPC shop module; metals ledger (0003 list in #1468 §6).
(5) Region 1 content bundle (after the spec): content files for ORIGINS_CONTENT.

**5. Gotchas:** retargeting a PR base does NOT trigger quality.yml — close+reopen. The `base` CI job sometimes times out on checkout (5-min cap); re-run the job. VPS DB checks run as user `frankrows` with PG_BIN=/usr/lib/postgresql/16/bin. VPS disk hovers near the 40 GB floor — tiny footprints, delete folders. Always verify a peer's claim before relaying; mark Dom's answers provisional until explicit.


## 2026-10-06 18:35 (+04) — HANDOFF before /clear. READ FIRST, then memory

Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (every ruling today, in order). Session folder is still the app worktree `.../worktrees/elastic-gates-c6edc0` (change_directory refused); Dom to reopen on `~/Developer/frankendom-expansion`, worktree switch off.

**Standing rules (Dom/Strategy/Lead, today):** Lead + Strategy have Dom's full authority (questions → Strategy); never stop working; function first, graphics later; MODULAR (rules = pure origins/* modules; content = data; one theme-token set + one UI kit; one asset map; world numbers in one place); camera FROZEN; Auditor full pass (quality, bloat, purity, real tests, CI entry < 2 s) on every Origins PR; order = 1 combat, 2 server saves, 3 trading, 4 region; live target = hidden `/origins` route (signed-in, flag OFF) once save+verify exists. Migrations: additive Origins-only = Strategy+Lead GO (down-script, branch DB, Auditor probes, one-line notice to Dom naming file/sha/down-script); anything ALTER/DROP/backfill of a live table = Dom's yes at the sha.

**1. LIVE:** arena `6fb21b34` (includes #1428 universal levelling). Preview https://frankendom.com/preview/origins/ = PLAYABLE greybox `85db715` (branch `expansion/origins-greybox-play`, VPS build folder `/opt/frankendom-shadow/work/expansion/greybox-play`): real hero, walk (drag/WASD), walk hint, Orla talk → quest "The Concord Commission" → journal → ore → hand-in → +1 upgrade at the smith → real bank/backpack. Checked live at 375x812 (talk, quest active with 2 entries, bank) 0 errors. Lead checking it, then Dom.

**2. PRs**
- MERGED: #1428 levelling (type weights; legend 1/5 to L10, 1/10 from L11; first-win-only bosses), #1430 contracts, #1436 winch test.
- GO'd to Deploy as one Origins release (after two arena releases; DON'T push): #1443 bag+bank @cadc8ab1 → #1446 quest journal @85f899e7 → #1447 NPC talk @c980f91c (stacked on #1446; needs a fresh green CI run).
- Auditor PASS, waiting for Lead GO: #1448 world boss @95ac541e (MAX_BOSS_ID_LENGTH 21; I asked the Auditor whether to hash the key so ids can be long).
- With the Auditor: #1450 world params @0cd94937 (15 groups Dom approved; layering, derive, seeded zones, schemaVersion). My VPS run 98/98.
- Backend: #1449 DRAFT save/verify schema (doc only). Strategy rulings passed to Backend: store WORLD CP only; seed = frozen creditFromMarks snapshot at first open; post-snapshot verified Pit wins priced by #1428; server runs the pure modules as authority for quests/talk/inventory/trades/Pit; world-boss/mob CP preview-only until an encounter-token + replay record (next, on the Pit verifier).
- #1432 (this branch): baseline re-pin + these handoff entries.

**3. In flight at clear:** COMBAT agent on branch `expansion/origins-combat` (worktree `/private/tmp/claude-501/expansion-origins-combat`, VPS folder `greybox-combat`). Brief: real Pit duel from the greybox via READ-ONLY src/ import as a separate Vite entry; prove live dist sizes identical before/after; camera frozen; win → progression award() legend event, HUD shows CP; `originsPreview.fight()` hook; never write live storage (if src change needed: stop, report → Combat via Lead). If its work is not pushed, restart it with that brief.

**4. QUEUE:** (1) combat result → VPS build → Deploy preview swap → 375 check → Lead → Dom; (2) inventory `consume`/burn op + ledger (ore hand-in, upgrade costs) after #1443 merges; add `item:exchange-ore` fixture; inventory call to apply an upgrade result; (3) switch the greybox to origins/world params after #1450 merges; (4) boss encounter-token + replay record on the Pit verifier; (5) server saves with Backend (#1449) → hidden /origins route; (6) trading on the server; (7) first region (Ash Frontier: matriarch, mobs, chapter one).

**5. Gotchas:** VPS archives for contracts tests must include `docs/specs/origins`; use `git archive` (not tar of the worktree) or macOS `._` files break eslint; greybox-build.sh stills step often times out at high VPS load (stills never touch the published folder — verify in the browser instead); browser-pane JS checks run while the pane is hidden do not animate (front the tab first); `[hidden]` must win over `display` rules in the preview CSS.

## 2026-10-06 15:45 (+04) — HANDOFF before /clear. READ FIRST, then memory

Lane: "Frankendom - Lead Dev (Expansion)". Reports to "Frankendom - Strategy (advisor)". Shared code goes to "Frankendom - Lead Dev". Previews go to "Frankendom - Deploy" (cc Lead). Review of #1428, #1430 and #1432 is owned by "Frankendom - Auditor" (send it heads, cc Lead).
Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (all rulings 1–8 and today's decisions are there). Read it first.
Session folder: the app bound this session to the worktree `~/Desktop/Business/frankendom/.claude/worktrees/elastic-gates-c6edc0`, not `~/Developer/frankendom-expansion`. Dom: reopen on `~/Developer/frankendom-expansion` with the worktree switch off.

**1. LIVE:** `03cd0d61` (curl 15:43). Nothing from this lane ships before the beta. The preview only is at https://frankendom.com/preview/origins/ (Deploy swapped in build 55e2fe2 at about 15:40; backdrop-1.webp now 200 per Deploy's curl). **NOT yet re-checked by me at 375x812, and the link has NOT been sent to Dom.** Next step: open it in the browser pane at 375x812, check network for 404s, then send the link to Strategy (Strategy relays to Dom).

**2. Done today**
- #1426 MERGED: 20 clean-room specs (OpenMW, Gothic, ModernUO, EQEmu) + Frankendom baseline + server pick + item/loot/storage summary, in `docs/specs/origins/` and `docs/briefs/origins/server-pick.md`.
- `DomLynch/frankendom-research` @644ec59 (public until the beta by Dom's call; no secrets): README with the clean-room rule, donor pins/fetch, donor manifest, analyst notes, audit log, scorecard, gate (`scripts/check.sh`). Clone: `~/Developer/frankendom-research`. Implementers must never be given it.
- Donor trees: VPS `/opt/frankendom-shadow/work/expansion-donors` (3.6 GB, PINS.txt).

**3. Open PRs (none merged)**
- #1432 `expansion/o0-baseline-fix` (docs): baseline re-pin to 03cd0d61 (RV25, 12 sim files) + STAB_ON doors + rank-scale note. This entry also rides on it.
- #1430 `expansion/o1-contracts` @28a39de9: O1 contracts + blacksmith UpgradeService. Auditor HIGH (duplicate material double spend) and MED/LOW items fixed. 80/80 node:test on VPS per the implementer; **I have not re-run it myself yet.** TODO: add `tests/origins-contracts.test.ts` (imports origins/contracts/*.test.ts; Lead's option A, conditions below), time it on the VPS, re-run, then ping the Auditor + Lead.
- #1428 `expansion/o1-progression` @8b8e3bd7: one-progression proposal + model. **A fix agent was mid-work at clear** in worktree `.../scratchpad/wt-progression` (uncommitted edits to model.ts, model.test.ts, scenarios.ts, plus a stray `.probe.ts`; VPS folder `/opt/frankendom-shadow/work/expansion/fix-progression`). If it's gone, restart it with the brief below. Owed: (a) Auditor HIGH: prototype-key NaN at model.ts heat/MOB_BASE_CP lookups (use Object.hasOwn/Map, plus a hostile-key test); (b) "first three kills pay full": round heat up so doc and formula agree; (c) Dom's REVISION (via Strategy 15:2x): decisions 1–3 YES (story credit 100/step + 500/chapter once; allowance 1,500/day, cap 3,000; boss lockout 7 days); the Pit is its own resumable cursor (next unbeaten legend at your Pit rung; career level drives title and gates); each legend beaten once (~5 per rank) as a POST-BETA proposal for the arena Lead (it changes the live arena); a rising requirement curve (gentle, steeper after level 11, cap-parametric 46/50); Pit-win and boss awards scaled to the rung's requirement; exact migration (legacy credit = cumulative requirement to levelOf(marks)); a levels 1–50 table and days-to-title for a 30-min/day and a 3-h/day player. Then add `tests/origins-progression.test.ts` (option A).
- Lead's option A conditions: pure (no DOM, network, open timers, or stateful src/ imports; `src/career.ts` is fine, type-only import), whole file under 2 s on the VPS with the timing in the PR body, nothing tagged [slow]. Option B (eslint/tsconfig/glob) is its own PR, sent to Lead first.

**4. Sessions down:** none needed from Dom.

**5. Rulings today (all in memory):** 1–7 in the blueprint; 8 clean room plus audit loop; research repo public until beta; Pit pieces tradeable (provenance, one-of-each, Exchange-only, rank to equip; re-winnable once sold, as a proposal); crafting OUT; blacksmith NPC upgrades capped at 1.15/0.80; coin per win = TODO(Stats/Strategy) placeholder 20 × tier; 50 levels (Dom 10-05); the Pit's own ladder plus beaten-once legends plus a rising curve (above); island arenas have no gate on purpose (Lead's World lane does the gate tease).

**6. QUEUE:** (1) re-check the preview at 375x812, send the link to Strategy; (2) finish #1428 revision + fixes + CI entry; (3) #1430 CI entry + my own re-run; ping the Auditor + Lead with heads; (4) Strategy's formula audit replies; (5) next O2 proofs: inventory transfer (ClaudeCraft MIT unit ~735 lines vs native, same contract), quest journal (5 stages, branching), staged boss event; (6) the greybox iterates on Dom's notes.

**7. Worktrees and VPS:** temp worktrees under the session scratchpad: `wt-progression` (o1-progression, dirty, agent), `wt-contracts` (o1-contracts, clean), `wt-greybox` (origins-greybox, clean). Greybox rebuild: `ssh … 'cd /opt/frankendom-shadow/work/expansion && bash greybox-build.sh'` (stills need 2 cores, DPR 1; never `pkill -f "http.server 4790"` from an ssh one-liner, because it matches itself). VPS disk is about 42 GB free (floor 40): delete `fix-progression` when that agent is done. No crons.
