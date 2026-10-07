# Expansion lane (Frankendom: Origins) — state

## 2026-10-07 ~11:30 (+04): CORRECTION — real saving is NOT coming next

There is no origins writer on the box (checked over ssh: /etc/frankendom holds only duel-relay.env, presence.env, verifier.env; no origins or writer systemd unit). #1596 is live as code only, so "then the writer restarts" in the entries below is wrong. Saving is blocked on Dom's W3 step from #1455 (set the frankendom_origins password in the Supabase SQL editor; create /etc/frankendom/origins-writer.env as root). After that: the #1463 installer (draft @2bc9db54) on an Auditor PASS plus the joint GO (Lead and Strategy gave it conditionally), then flag ON + --link-writer, then #1593 X1. Until then the preview HUD stays "Offline preview: progress is not saved". Never tell Dom his progress saves.

## 2026-10-07 ~10:45 (+04): HANDOFF. READ FIRST, then memory, then the ~10:00 entry below

Lane "Frankendom - Lead Dev (Expansion)". The restart hook calls it lead-catalogue; it IS expansion. Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (newest lines at the bottom).

**1. LIVE 345571fb** (curl release.json). It contains #1513 (62bff8db), #1607 (40c082b4) and #1609 (8f97d10a), all merged 03:39-03:53Z (checked with merge-base). #1596 X2 writer is still OPEN (joint GO @feab306a; apply order 0005→0007→0008→0009, then Deploy merges, then the writer restarts).

**2. /preview/origins/ is UP again, built from 345571fb.** The 404 came from the release switch dropping preview/; Deploy now carries it forward. My 375x812 check: loads at the Pit gate, 0 console errors, 9 resources with no 4xx/5xx, the Journal opens. Lead did their own 375 look and sent Dom the link. Strategy did not send it again.
- **Not saved:** the HUD line "Offline preview: progress is not saved" is RIGHT. The preview only reads a signed-in career (save.ts, read-only) and never writes. I told Lead and Strategy that my earlier "career saved" was wrong.
- **Walking:** a held slow drag walks the hero; a quick flick doesn't (emulated touch at 375, not a real phone). Tip for Dom: hold your thumb down.

**3. Slice 1 (Ash Frontier + Bounty, ?region=1):** the first agent died without pushing (`expansion/greybox-world` absent on origin at ~10:15). A NEW background agent was started ~10:20 from the brief in the ~10:00 entry. It works in its own app worktree; step 1 is data-driven Concord to within 1 cm with a pin test, step 2 the ?region=1 zones with ambience.preset per zone. It opens its own PR with 375 stills on `stills/expansion-greybox-world`. NO report yet. If the session is cleared before it reports: `git ls-remote origin expansion/greybox-world`; if empty, restart from that brief. Once it's pushed, send the sha to World (who owns look.ts) and the PR to Strategy.

**4. Check-in cron** was re-armed at :07/:27/:47; it is session-only and dies on /clear, so re-arm it after a restart.

**5. Still owed:** the rejoin nudge (after #1596 + Backend #1599); the #1607 Auditor LOWs follow-up (now against trunk, since #1607 merged); luck HUD placement once a world-mob fight exists. #1593 X1 is held on presence step 2.

## 2026-10-07 ~10:00 (+04): HANDOFF before /clear. READ FIRST, then memory

Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md`. The newest lines are at the bottom, and every ruling today is there.

Session folder: the app worktree `.../worktrees/elastic-gates-c6edc0`. The restart hook mislabels it lead-catalogue; it IS expansion. Re-arm the 20-minute check-in cron after the restart. The check-in uses the full open list: `gh pr list --author @me --state open`, filtered to expansion/*.

**1. LIVE:** 385f67a5 had #1518 Region 1 (merged 03:18Z). Trunk tip is 345571fb. Check with curl before stating anything.

**2. DOM'S #1 PRIORITY: play Origins on frankendom.com/preview/origins/ with everything built.**
- **(A) Republish /preview/origins/ from trunk.** Built on the VPS from 345571fb at `/opt/frankendom-shadow/work/expansion/r1518/artifacts/origins-preview` (69 MB). It went to Deploy for a preview-only publish, in Lead's slot after #1616 + RV29.
  - NOT checked at 375 by me. After Deploy's published line, open it at 375x812 (0 console errors, no 404s), then send Strategy and Lead a 5-line "what to try" list.
  - The preview wires: talk, the quest journal, bank/backpack, the smith (banked = Exchange only, story gear OK, quest-item refusal line), the patron picker, the Pit duel and the saved career.
  - It has NO screens yet for: trade/escrow, boss records, Region 1, rejoin. Lead was told.
- **(B) Slice 1 = Ash Frontier towns + a Bounty, walkable onward from the Exchange, on the same URL** (behind ?region=1 at first). A background agent is building it on branch `expansion/greybox-world` from trunk, worktree under `.claude/worktrees/agent-*`.
  - Step 1: data-driven Concord, identical within 1 cm, with a pin test. Step 2: ?region=1 zones.
  - It opens its own PR with 375 stills on the orphan branch `stills/expansion-greybox-world`.
  - It sets `ambience.preset` per zone (ash-pit / exchange-dusk / frontier-haze).
  - NO report from it at clear. If it died: `git ls-remote origin expansion/greybox-world`; restart from this brief if empty.
  - **World lane owns `origins/preview/look.ts`** (sky/fog/light keyed on ambience.preset + view.fog*, plus one wiring line in main.ts). Send World the greybox-world sha once it's pushed.

**3. GO'D, WAITING ON DEPLOY (do not push):**
- #1513 combat study @fbcc4aff (luck + stances + mood, Dom-approved).
- #1607 luck contract @56596112 (world-mob ±10% rolls both ways; Pit/PvP/ladder never; Gambit odds 1/2 ×2).
- #1609 Region 1 LOWs @0345aa88.
- #1596 X2 writer @feab306a: joint GO. Apply order 0005 → 0007 → 0008 → 0009, then Deploy merges, then the writer restarts. Undrafted.

**4. HELD:** #1593 X1 waits on presence step 2 (flag on + --link-writer), which needs Backend's writer-key installer.

**5. OWED LATER:**
- The rejoin nudge, as a follow-up PR after #1596 merges (needs Backend #1599 /internal/rejoin).
- #1607 Auditor LOWs (seed is uint32: say so; caller odds unchecked).
- Luck HUD placement once a world-mob fight exists.

**6. RULINGS TODAY (in memory):**
- **Luck:** Gambit = a 2nd heavy press after the chamber, with a player-only cue, ~1-in-2 for ~2×, EV slightly under a heavy, no kill from >40%, and a PvP roll that cannot be known at press time (Combat). ±10% rolls ONLY vs Origins world mobs, both ways, and they are mine end to end.
- **Stances (= opponent mood):** Neutral/Aggressive/Defensive/Trickster. ±5% damage to start, 10% ceiling. Weapon-hold poses + versus-card reveal. Hidden simultaneous PvP pick. The AI draws from the seed with a 50% home bias. Exempt from the patron no-arena-damage rule.
- **Combat order:** RV31 → RV30 → Gambit → stances.

## 2026-10-07 ~09:50 (+04) — HANDOFF before /clear. READ FIRST, then memory

Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (newest lines at the bottom; every ruling tonight is there with sources). Session folder: app worktree `.../worktrees/elastic-gates-c6edc0` (the restart hook mislabels it lead-catalogue/lead; it IS expansion). Re-arm the 20-min check-in cron after restart. Check-ins MUST use the full open list: `gh pr list --author @me --state open` filtered to `expansion/` (I missed #1457 once by checking a fixed list).

**1. LIVE:** 1c2a0ac9 (has #1578 smith story pieces, #1579 X2 gate row). Trunk is 10 commits ahead (tip 578be80c = #1457 boss id hash, merged, not yet live). Merged tonight: #1460, #1523 (0004 escrow guard, applied in prod 20261006205219), #1526, #1491, #1517, #1459, #1492, #1511, #1532, #1533, #1544, #1547, #1557, #1560, #1563, #1566, #1569, #1570, #1472, #1498, #1578, #1579, #1457.

**2. OPEN (mine):**
| PR | What | State |
|---|---|---|
| #1593 @69962630 | X1: writer reads place from presence (inZone(where,'exchange',5000)), body place ignored, fail closed | Auditor PASS. **DO NOT MERGE** until its 5-box checklist: presence installed + ORIGINS_PRESENCE=1 in prod; PRESENCE_INTERNAL_KEY in writer env + /internal/where 200; forged-place refusal checked live; Backend heartbeat seenAt fix landed; #1581 port split |
| #1596 @0de2dadf | X2 stage 2 writer half: migration 202610070009 (+down, UNAPPLIED), origins_character_location + origins_active_character, POST/GET /internal/location under NEW secret ORIGINS_WRITER_INTERNAL_KEY | DRAFT. No merge before #1577; Auditor review+PRE, then joint GO before apply. FOLLOW-UP COMMIT owed once #1577 + Backend's /internal/rejoin exist: import REJOIN_EDGE from origins/presence/zones.ts (drop the copy in origins/server/location.ts) + fire-and-forget writer→presence nudge on active-character change (POST {PRESENCE_URL}/internal/rejoin, Bearer PRESENCE_INTERNAL_KEY, body exactly {"account":uuid}; never blocks the client op; off if URL/key unset) |
| #1518 | Region 1 content (draft) | **NEXT (Lead):** bring up to trunk, make Auditor-ready, content/data only; list anything needing a Dom/Strategy ruling in the body |
| #1513 | combat study (draft) | waits on Dom's damage-variance choice (Strategy's morning list) |

**3. RULINGS TONIGHT (all in memory, with sources):** trade = every piece except the bound list trades; cooldown on EVERY tradeable piece (no rarity/Pit scope; #1554 closed). Launch gates live in docs/specs/origins/launch-gates.md (G1–G6, W, F, S1–S4, P, X1, X2; S3 and P1 closed). Smith: banked piece only at the Exchange; story-critical GEAR may be upgraded (flag/binding/provenance kept; never burned except by a named quest step); quest items (power none) refuse with one plain line. X1/X2: zone computed server-side in the one Concord frame; trade area = whole exchange zone; rejoin from inside lands just outside the gate; fresh join = Pit yard centre; one active character per account, set in the writer; no logout escape (seam until jail/feud state exists). Patrons: arena gets only Combat's no-damage sidegrades; §10.6 switch/leave table stands.

**4. OPS FACTS:** presence port 8793, writer PORT 8788; presence needs WRITER_URL, the writer needs PRESENCE_URL; two secrets (PRESENCE_INTERNAL_KEY, ORIGINS_WRITER_INTERNAL_KEY) with installers unassigned (Lead has it). Full npm test must run in a git CLONE on the VPS (an archive lacks .git; 2 test files need it). As frankrows, `npx vite build` needs `--configLoader runner`; Playwright needs PLAYWRIGHT_BROWSERS_PATH=/opt/frankendom-shadow/ms-playwright if HOME changes. zsh doesn't word-split $VAR in ssh args.

## 2026-10-07 00:30 (+04) — HANDOFF before /clear. READ FIRST, then memory

Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (newest lines at the bottom; tonight's rulings all there). Session folder: app worktree `.../worktrees/elastic-gates-c6edc0` (restart hook says lead-catalogue; it IS expansion). Re-arm the 20-min check-in cron after restart (it dies with /clear).

**1. LIVE:** a928c586 (50 levels). Merged tonight: #1465 (preview reads saved career), #1488 Feuds spec, #1490 one-shard (+Dom's §7 rulings), #1468. Trading 0003 is LIVE (Backend #1469).

**2. CODE CHAIN (Lead order; Strategy drives while Lead clears):**
- #1459 @f3040d99: trunk merged (rehearsed resolution), VPS origins 236/236 + writer-check 62/62, Auditor delta PASS. Waits on GO/merge in the chain (#1392 → #1505 → #1459 → #1482/#1484 → #1460 → #1502).
- **#1460 @f22fed65 (Auditor PASS) is now CONFLICTING with trunk: NEXT ACTION** merge trunk (rehearsal in /private/tmp/claude-501/expansion-1460-rebase 7e83ba8f; conflict moved to errors.ts; writer-check racedBurn), run origins tests + writer-check on the VPS (reuse /opt/frankendom-shadow/work/expansion/w1460 export: `git archive <sha> | ssh … tar x`, node_modules symlink to bn-full; writer-check as `sudo -u frankrows env PG_BIN=/usr/lib/postgresql/16/bin`), push, then sha → Auditor delta → GO. Then #1472 retarget (close/reopen for CI).
- #1492 @ce5b9b05: retargeted to trunk, undrafted, Auditor PASS unchanged. GO after #1459/#1460.
- **Audit finding D (mine, NEXT ACTION):** origins/preview/main.ts startFight awaits `import('./pit-duel.ts')` with no catch, so a failed chunk leaves "Loading…". Fix: try/catch; if still the current fight (`fighting && fight === next`), restore the walk (duel layer hidden, canvas + journal back, setAnimationLoop(walkLoop)) and show "Could not load the duel, tap to retry"; don't count it as a started fight; a stale failure does nothing. Small PR → Auditor.

**3. DOCS:** #1491 Living World @3866f437 PASS, #1498 legends @9a525f09 PASS (+N1–N3 applied); merge order #1491 → #1498. #1504 date fix: Lead GO'd. #1513 combat study (draft) for Dom to choose: tag-team tokens first; NO luck roll in Pit/PvP (Dom asked ±5; study: skill-based hit quality, ±5% world-monsters-only in reserve).

**4. OVERNIGHT BUILDS (Dom: "big items live by morning", told preview-only, flags off):**
- #1511 Feuds engine @48ed46cf: done, undrafted, in the Auditor queue after #1502.
- #1510 presence (Backend) @5c1ca7e9: flag OFF; 100 bots = 8.6% of a core, ~1,000/host worst, 80% trigger ≈ 800/host.
- Background agents STILL RUNNING at clear (they may die with it): patrons (branch expansion/patrons), Region 1 data (expansion/region1-content), crowd tag-team tokens (expansion/crowd-tokens in ~/Developer/frankendom-expansion-crowds). After restart: check `gh pr list --head <branch>`; if no PR, restart from these briefs (no tsc/tests on the Mac; all on VPS; new worktrees under ~/Developer).
- Art: Characters & Art has the Concord Exchange kit brief (living-world §3, concord.ts, exchange.ts API + footprint); told hands off preview main/play/save.

**5. DOM OWES:** run `ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18 bash /root/origins-writer-setup.sh` (writes /etc/frankendom/origins-writer.env 0600 with a generated password, prints the `alter role frankendom_origins …` line) and paste that line in Supabase SQL editor. I must NOT set the password (prohibited). Then Deploy installs #1463, flag on for Dom only first. Also: damage-variance choice from #1513.

**6. RULINGS TONIGHT (all in memory):** chat free text + server filter; buy servers (80% trigger), queue only for spikes; game-assigned layers + join-friend; names letters/spaces/hyphens + filter + AI; Azazel + 5 Watchers IN; national heroes IN as honourable (Wallace/Tell/Skanderbeg patrons); Aztec/Maya gods IN; Cain legend only; no Adam/Eve/Abel/Samson/Lestat/The Beetle; Sundiata kept; legends list 600 (500 + world + lost civs + cryptids). legends-rule skill updated (1931 line, folk heroes, Watchers, Aztec/Maya, Cain).

## 2026-10-06 23:05 (+04) — HANDOFF before /clear. READ FIRST, then memory

(Date note: the two entries below say 2026-10-07; the Mac clock said 2026-10-06 all day. They are the same day.)
Lane "Frankendom - Lead Dev (Expansion)". Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/project_origins_lane.md` (newest lines at the bottom). Session folder: app worktree `.../worktrees/elastic-gates-c6edc0` (the restart hook mislabels it lead-catalogue; it IS expansion). Dom: reopen on `~/Developer/frankendom-expansion`, worktree switch off.

**1. LIVE / trunk:** trunk 64ed6198 (includes #1456 inventory consume, #1461, #1462, #1479 trade cooldown, #1480 Region 1 spec). Live = whatever Deploy last posted (curl release.json).

**2. CODE QUEUE (mine), in order (Lead's ruling):**
- #1465 @13be8939 (preview reads saved career): retargeted to trunk; its `base` job hit the 5-min checkout timeout, re-run of run 37507777183 queued. Lead GO once green.
- #1459 @94a06692 (writer quest/talk) CONFLICTS with #1465 in scripts/origins-writer-check.mjs. Rehearsed merge = local 9ca960d4 in `/private/tmp/claude-501/expansion-m1459` (keep both check blocks). VPS: 11 origins test files pass, writer-check 62/62. WHEN #1465 MERGES: merge TRUNK into 94a06692 (not 13be8939), redo the same resolution, push to expansion/o3-writer-story, send the sha to Lead + Auditor (quick delta).
- #1460 @f22fed65 (writer consume/apply_upgrade): after #1459 lands, merge trunk. My earlier rehearsal (vs #1459) is at `/private/tmp/claude-501/expansion-1460-rebase` 7e83ba8f: Conflict moved to errors.ts, writer-check raced->racedBurn. Run writer-check on VPS as `frankrows`, PG_BIN=/usr/lib/postgresql/16/bin. Then #1472 retarget.
- #1492 @ce5b9b05 DRAFT (preview uses LIVE controls/HUD/☰ via build-time cut of index.html; base = #1465 branch). With Auditor (next session picks it up). Open: "hold Roll from standing = step back"; Auditor suspects the hold doesn't reach HOLD_MS in the preview input path (cf. #1474). Implementer worktree `/private/tmp/claude-501/expansion-live-controls`.
- Pit cap pin: origins/pit/pit.test.ts:112 pins level 46; goes red at Combat's 50 levels (#1470). WIP 7114862c in `/private/tmp/claude-501/expansion-pit-maxlevel` (branch expansion/pit-test-maxlevel, NOT pushed) makes it read MAX_LEVEL, but at cap 50 test 10 ("careerLine reads the level…") STILL fails: another 46 assumption (pit.ts careerLine uses levelOfCredit(credit) with the default cap; check newSession/levelOfCredit/cumulative and the test's fixtures). Fix, prove at 46 and 50 (sed MAX_LEVEL on a VPS copy), PR, tell Combat to drop their one-line fix.

**3. DOCS PRs:**
- #1488 Feuds (systemic) @2366384a: Auditor PASS (+ rulings delta PASS). Lead GO pending; Deploy asked to hold until then.
- #1491 Living World DRAFT @469b509b: all Strategy rulings in. Undraft for the Auditor's docs check only after Lead confirms the phasing order.
- #1490 (Backend one-shard note): I posted AGREE on §1/§5. Dom owes §7: chat free vs presets; queue vs world-full; player-chosen layer.
- legends-500: research agent building `docs/specs/origins/legends-500.{md,csv}` on branch expansion/legends-500 (worktree `/private/tmp/claude-501/expansion-legends-500`), draft PR. If no PR on remote, restart from memory's rules.
- Date cleanup PR after #1488 merges: replace "2026-10-07" stamps in #1468/#1480/#1488 docs with 2026-10-06.

**4. RULINGS TODAY (all in memory):** Feuds = systemic grudges (generator, notoriety, town defence, bouncer, telegraphed dodgeable strikes, never gear loss; guards weight-0); Bounties kept; Living World (one shard, NPC war goals, history book permanent, rifts, player lords after the verifier); patrons/clans chosen AT GRADUATION, perks apply IN ARENA (Dom override) as ±3% template sidegrades, both fighters' perks shown, RV28 + fingerprint re-pin via Combat; lore rule "any lore, but living faiths' gods and holy figures aren't for players to worship or fight" (Dom override: named Enoch Watchers OK, Azazel out); dead orgs OK as legend (Illuminati, Templars), living orgs get fictional stand-ins (Lodge of the Compass); no AI chat NPCs, no trust-matchmaking, no become-the-boss.

**5. Sparring-check failure:** the Stop gate's sparring-browser-check fails on the Mac under load. Auditor diagnosis: load, not code; a quiet-Mac rerun is owed by the Auditor; the gate fix (re-sample load per browser row) belongs to the hooks lane via Strategy. Not mine.

**6. Gotchas:** retargeting a PR doesn't trigger CI (close/reopen). The `base` job times out on checkout (re-run it). VPS disk ~44 GB. Always check `date` before stamping. Use "Dom"/they for Dom.

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
