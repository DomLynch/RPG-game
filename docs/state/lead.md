# Lead — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Lead — 2026-09-23 14:05–15:30 local: Publish B FAILED -> fallback revert + B' (swap held) -> equip loader tomorrow (read ALL of this first; later lines supersede earlier ones)
**Dom 14:00 "accelerate" (Strategy ruled):** Publish B = #532 -> #545 -> #543 -> #547 -> **Combat's re-pin PR** (bump to 7, re-pin,
SIM_FILES closure + test, knife/scythe rebake, gladius offered, #547's 12 re-signs), built on the COMBINED tree of #545 + #547 and
**NOT #550**. The re-pin PR is asked for by ~14:50; the target is B live by 15:30. **#550 (Executioner anticipate + cleaver) = its own bump
to 8 tonight** (Combat: cleaver 18->8, warhammer 12->7, trident 11->7, profile `{...normal, anticipate: 3, lapse: .2, read: .75}`).
**The non-sim batch is running** (deploy.sh 13:59 on `b7bc78d`: #540 #537 #541 #542 #544 #546 #539 #548 #549 merged). #534 conflicted,
so the Auditer merges trunk in and it goes after B. #539 merged as `0a81d8c`; the sweep PR is **#551** (Backend reviewing; the apply is still HELD).
**LIVE DEFECT (Web's loot-smoke-check on `dd1d968`):** knife offered PASS, tap-take + Undo PASS, **a guest's decline does NOT
survive a refresh**: `src/profile.ts:18` keeps loot only on `loot.owned.length` (#535 fixed only the signed-in path). Web is
splitting out a one-line fix PR, and **it rides Publish B**. The smoke script's own PR is still due by 16:00.
**B MECHANICS (Deploy acked):** the Publish B run = **#552** (guest-loot fix, READY `3c33660`) then **Combat's re-pin PR as the SINGLE B merge**.
It MERGES the exact heads #545 `c17004d` + #547 `28a0fd0` (#547 contains #543 `9858588` and #532 `ac5a090`). Deploy checks
all four are ancestors (`git merge-base --is-ancestor`) and stops if any head moved. The four siblings are never merged one by one,
and moves.ts is never hand-resolved (#545 and #543 both edit it). Pre-ruled: a new over-cap row vs the gladius Centurion gets signed
KNOWN_UNFAIR ("fixed in bump 8") and does not stop B; only an identity-pin failure or a crash stops B. Send Deploy the re-pin PR number.
**LIVE `b7bc78d` (14:12).** **KNIFE RULING (Lead, 14:2x, under the pre-ruling):** the combined tree (`f3c3f60`) gives `knife vs veteran normal:
thrust from range` 23/24 against the gladius Centurion (cap 12; it was 5/24 vs the trident). The knife STAYS OFFERED with a NARROW, named test
exception, "fixed in bump 8". `cleaver vs veteran normal` 16/24 is signed KNOWN_UNFAIR, and trident 12/24 (margin 0) is a watch item. **Bump 8
(#550) must fix the knife-vs-Centurion row as well as the cleaver rows.** **Strategy UPHELD it (14:3x), adding: bump 8 must NOT ship while the knife exception is still signed**; #550 removes it by fixing the row. The cleaver stays un-offered until then.
**PUBLISH B GO (Lead, ~14:5x):** re-pin = **#557** (`66b557f`), and Lead verified all five ancestors (ac5a090, c17004d, 9858588, 28a0fd0, b7bc78d),
v7, the 9-file SIM_FILES, and the knife exception keyed on the exact "23/24" row text. Deploy runs #552 then #557. After B: #551, #534, #556 (+the Auditer's row).
Next, bump 8 = #550 (merge trunk in; remove OFFERED_DESPITE; fix the knife + cleaver rows). **#554 is cleared** (quality:stop exit 0, 516/0/2; the 12 errors were a hand-run `eslint scripts/…` no-undef, pre-existing on trunk's verify-daily.mjs, so a scripts/ Node-globals eslint config is a post-beta item for the Auditer). The post-B run: #551 -> #554 -> #534 -> #556 -> #558.
**!! PUBLISH B FAILED deploy.sh (EXIT 1, 14:35, `9a53750`). LIVE is still `b7bc78d`. Trunk carries B (v7) UNPUBLISHED, and #552 (the guest fix) is merged but not live.**
Rows 2, 11 and 12 failed twice (load 15–24), all from #547's swap (`veteran: weapon 'gladius', carries ['veteran.Shield']`): rows 11/12 polearm-browser-check
still expect the Veteran on /Trident_/ (a stale row premise, so drop veteran from the polearm rows); row 2 roster-browser-check fetches a 3rd model on boot (likely the carried
shield; preference: defer it after first paint per #435). **Veteran fixes forward by 15:15**, and the box is held. **Fallback at 15:15:** Deploy opens a PR that is `git revert -m 1`
of #557 (NOT a force-push; a trunk revert, not a live rollback), publishes #552 + the post-B batch, and B re-lands as a revert-of-the-revert plus the fix. Strategy was told (slip) and accepted it, adding: the polearm rows must now EXPECT gladius+scutum, and the 3rd fetch must be REMOVED (teaching the check doesn't count); #552 is live by 15:45 either way; B by 16:00. **Fallback staged by Deploy, not pushed:** `deploy/revert-publish-b` @ `4a30ef6` = revert -m 1 of `9a53750`; src = b7bc78d + #552 only, v6, the guard 2/2. Re-landing B later = a revert of `4a30ef6` plus Veteran's fix, then a fresh deploy.sh.
**15:0x DECISION (Lead): the FALLBACK RUNS.** Veteran's #559 (`a9b8c9c`) makes rows 2/11/12 pass (the scutum's 5 MB loot.glb is deferred 1 s past first paint),
but it exposed that **the Centurion visibly DRAWS THE TRIDENT while the sim fights him with the gladius**: veteran.glb bakes the trident, and there is no runtime
equip loader (loot.ts's #309 contract is unimplemented). #559 is HELD. Deploy pushes `4a30ef6` (the #557 revert) + the batch, so #552 is live before 15:45.
**Asked Strategy:** hold the swap (Lead's recommendation: B' = #532 + #545 + #543 as a player weapon, the Veteran stays on the trident, and the knife exception dissolves)
vs ship with the mismatch (revert-of-revert + #559). Either way B re-lands via a revert of `4a30ef6`, plus Combat's re-pin on that exact tree.
**STRATEGY RULED (15:1x): HOLD THE SWAP, ship B'.** B' = #532 + #545 + #543 (gladius a PLAYER weapon), with the Veteran ON THE TRIDENT, target ~16:30. **Combat builds it**
off trunk after the fallback: (1) revert the fallback revert, (2) reverse-apply #547's OWN diff **`a9d6734..28a0fd0`** (CORRECTED by Combat: `9858588..` would also strip #538's wear() fix `a9d6734`, which is on trunk; Veteran reviews), (3) the battery: knife vs veteran back
to ~5/24, OFFERED_DESPITE REMOVED, (4) v7/closure/rebake kept, the re-pin LAST, (5) solo rows 2/11/12 green. Lead marks it READY, then Deploy runs it. #559 is HELD for the re-land.
**Centurion re-land (tomorrow):** Strategy ruled a veteran.glb rebuild; Veteran scoped the **runtime equip loader** as cheaper (2–3 h vs 3–5 h, lower risk,
also delivers #309). **Strategy RULED YES (15:2x): the EQUIP LOADER**, owned by Veteran, PR tomorrow morning; the rebuild is off the table. Row-2 exception exactly "the opponent's equip .glb only, ≤ 250 KB" in the row comment; the boot budget row is unchanged. Conditions: hand_r scale measured per rig; the re-land = loader + swap re-applied + Combat re-pin, ONE bump, rows 2/11/12 assert gladius+scutum DRAWN. Then #309 player-wield on the same loader, a separate PR (Veteran).
**17:4x — DEPLOY FREEZE (Strategy):** after C (59d2436, started 15:46, ~16:05–16:15) NO deploy until roster-v0 at 21:20; then ONE run of #566 (be2e8e1) + #567 (15d4e55) + #571 (floor blood, Finishers, 6efc7d3; Lead READY still owed after its blood/wounds gates) at ~21:50. Tonight lanes run targeted tests + tsc only (no full vitest). Weapons' MAUL = #572 into roster-v0 (merges there after its battery); Knight = Executioner pushing directly into roster-v0 (knight/body-v0 @ 625db0a local). The floor-blood before/after was sent to Dom. Character lanes restarted with new refs: Pitborn [6aba1f], Multi Chars [0c9fed], Executioner [88b346], Nightborn [f1c59b]; message them by `name [ref]` (the Desktop `local_` route caps at 10).
**17:1x — SUPERSEDES the roster-v0 tint plan below. Dom: "just create the new bodies and new weapons… get it done properly by 22:00" = all four LIVE with REAL bodies by 22:00.** No tints. The ROSTER entries stay on `roster-v0` as slots. Clocks: body glb ON roster-v0 by **20:30** (Witch silhouette vs the Shieldmaiden 20:45); Weapons' MAUL on roster-v0 by 20:30, else the Knight uses the warhammer; Combat battery + #550 fold + bump 8 + ONE re-pin by **21:15**; Lead review by **21:20**; Deploy **21:20 -> live ~21:45**. roster-v0 is the ONLY deploy 21:00–22:00; C, #566 (be2e8e1), #567 and blood go before 20:30. A body that misses 20:30 lands in the next re-pin. Lanes send lines to Lead + Strategy at 18/19/20/20:30/21:15. **Rules for all four pushes (Lead 17:3x):** the ROSTER row ships WITH the body + the lane's own pinned-test updates (merge roster-v0 before every push, never force); each adds `ARCHETYPES.<char>` = a verbatim copy of its base (shieldmaiden<-pitborn, knight<-executioner, plagueDoctor<-nightborn, witch<-veteran) with ONLY `scale` = the measured ratio (characters.test pins GLB height to scale), marked placeholder; Combat retunes + RECORD_VERSION/SIM_DIGEST at 21:15. Combat's fold branch: `combat/bump8-roster` (roster-v0 + #550 at 0c5aa89 + bump prep 64dc777: v8, digest PENDING until the four-body battery); #550 has 0 over-cap rows on v7 (cleaver vs executioner 18->8). A restarted Combat session runs the 20:30 step. Witch body GLB already built locally (Multi Chars, body 'witch'). Honest v0 facts: bodies bake their weapon, and versus stills are per id (no still = no card image).
**16:4x — ROSTER v0 (SUPERSEDED) (Dom "all 4 playable in 90 min", Strategy, target 18:00):** branch `origin/roster-v0` (pushed by Lead @ 59d2436). Pitborn adds a `tint?: Record<materialName, hex>` on the ROSTER recipe (src/roster.ts), applied once at load onto a CLONED material (keep onBeforeCompile), then the lanes add entries by 17:15. **Weapon = what the base body DRAWS** (no equip loader yet): shieldmaiden = pitborn body + cleaver, knight = executioner body + scythe, plagueDoctor = nightborn body + estoc, witch = veteran body + trident. Combat copies the base profiles and folds them into bump 8 with #550 (one re-pin); new over-cap rows are signed "bump 9"; then its own publish. Real bodies continue in parallel (Witch via creatures.py on veteran-v1, so no dependency on Pitborn's parts.py female body).
**16:1x — FOUR CHARACTERS INTO BETA (Dom, "priority #1", end to end):** Shieldmaiden -> Pitborn (Brief 15), Knight -> Executioner (17), Plague Doctor -> Nightborn (18), Witch -> Multi Chars (16, waits on the Shieldmaiden body). Briefs are in `docs/briefs/`, refs in `docs/character-references/`. Strategy's clocks: first line 16:45, body glb on a branch by 22:00, playable PRs tomorrow 12:00 / 14:00 / 16:00 / 18:00 in that order. The fastest path: an OPPONENTS entry on the closest rig + Helmet/Body carriers. Combat adds profile + battery per body (after #550). Each character is its own publish; box priority goes to their bakes. Lanes send hourly lines to Lead + Strategy; Lead owns review, merge order and Deploy. SCOPE.md dated line in #569. Those four lanes were off ListAgents, so message them by `local_…` session id.
**Lighting C = #570 (73c3f9f), Lead GO, publishing alone.** #566 HELD: its test imports lightFighter, which #570 deletes, so Veteran is switching it to a generic onBeforeCompile check. #567 READY after C. Floor death pool -> Finishers (brief sent, ships with shield/zoom).
**16:00 NOW:** Dom picked lighting **C** (fighter lighting off, background grade kept): World opens the PR from `world/rim-tune` @ `673ab69`, Lead reviews, and Deploy publishes it ALONE immediately; the sha line goes to Strategy, and Dom checks on the phone. Then the next non-sim batch: **#566** (shield hoop, Veteran, READY) + **#567** (iPhone half-canvas/zoom, Auditer, READY, adds release row 35). If C and #567 conflict in scene.ts, Deploy stops and the Auditer merges trunk in. #550 bump 8 comes from the restarted Combat session. Tomorrow: Veteran's equip loader + the Centurion re-land. HELD: #559, migration 202609230001, the verify-loot VPS unit.
**LIVE DEFECTS on a50f22f (Dom iPhone 15:21, screenshots in Strategy's scratchpad images/2.webp + 3.webp):** (1) the hero SHIELD renders as a HOOP (face missing, rim only) -> VETERAN (scutum/shield in loot.glb, likely single-sided/culled; Character Main if export). (2) ZOOM: the canvas shrinks to the top half with a grey void below -> AUDITER end to end (reproducer + fix, one PR; Web reviews only layout diffs). Both: same-frame stills, next non-sim batch, PR numbers to Strategy. Also #565 (combat doc correction) joins #553 in the next run. Combat restarts before bump 8.
**LIVE `a50f22f` = B' (15:20, 0 rows failed; sha line sent to Strategy).** Now: World renders 0/A/B/C (box free) -> composite path -> Strategy -> Dom picks; Combat starts #550 bump 8 (cleaver vs exec 18/24 -> <= 12). #553 is in the next rolling run.
**B' = #563 (`af5947c`) READY -> Deploy GO (with #554), Lead-verified: 39fd0a5 + 441eb38 are ancestors, v7, OFFERED_DESPITE gone, veteran on the trident. Next: the sha line to Strategy, then #550 bump 8 (cleaver vs executioner), and tomorrow Veteran's equip loader + the Centurion re-land.**
**World (Dom via Strategy, 15:1x):** #537's fighter rim reads as a WHITE OUTLINE on the phone. One pass: grey + lower opacity so it reads as lighting, or revert the fighter rim only (keep the crowd/sand/wall). **CHANGED (Dom, 15:2x): no PR yet. World sends ONE composite of 4 same-frame 375x812 stills (goblin, hero back to camera, mid-arena): 0 = pre-#537, A = grey semi-transparent rim + key reverted, B = rim off + key half + specular down, C = full fighter-lighting revert (keep the crowd/sand/wall). Absolute path -> Lead -> Strategy -> Dom picks; renders only at FREE.** Dom also said it's "shining, not gritty" (the KEY too).
**LIVE `441eb38` (14:56, the fallback: #560 revert, #552 guest fix, #551, #534, #556 row 34, #558; 34/34, v6). Sha line sent to Strategy.** Veteran OK'd B' undo `39fd0a5`; Combat merges trunk in, gates (+row 34), opens the B' PR -> Lead READY -> Deploy with #554.
**15:0x STATUS (superseded above):** the fallback deploy.sh is running on `441eb38` (#560 revert, #551, #534, #556, #558; v6). #554 was NOT merged because it's still a DRAFT, and Stats was asked to `gh pr ready`.
B' is built at `combat/publish-b-prime` @ `39fd0a5` (v7, SIM_DIGEST 3d3a9322…): knife vs vet 4/24, cleaver vs vet 4/24, trident 6/24; the only over-cap row is cleaver vs executioner
18/24 (#550's). OFFERED_DESPITE is removed and the gladius is offered. It waits for the lock to run quality:stop, test:slow and rows 2/11/12, then the PR opens, and Lead marks it READY after Veteran's undo review.
**Awards chain:** #551 (sweep, `66e798f`) is READY with Backend OK + Lead, and merges in the rolling run AFTER B (no src/ change). #554 (draft, `b0a8b89`,
Backend's N1–N3: per-claim settle errors, a loss unit case, the recheck caveat) is retargeted and gated after #551. **The APPLY of 202609230001 + the VPS
verify-loot unit need all of #551 + #554 + Stats' client-claims PR (offer from `my_standing()`, SCOPE.md loot v2 line), Backend-reviewed,
and then Lead's explicit "apply 202609230001" to Deploy.**

## Lead — 2026-09-23 13:35 local: HANDOFF (context restart). Read this block, then the one below.
**Now (the next session picks up):**
1. **Phone smoke on Publish A** when Deploy sends the sha line + FREE: 375x812, a fight to a kill with the loot panel, on the live
   build. The receipt goes to Strategy. At 13:30 A (`dd1d968`) was still in deploy.sh; live was still `c0b321c`.
2. **#539**: wait for Stats' WORN_FROM-as-data commit (`export WORN_FROM: WornFrom = {}`, read by awardFor + the sweep, one line in
   the PR body), then send Deploy "READY <head>". Backend's SQL OK at `1a0cec5` stands (the migration is unchanged). **Never send
   "apply 202609230001"** until Stats' sweep PR (B2–B4) AND the client-claims PR are both merged and Backend-reviewed.
3. **Publish B review**: #545 (Combat, Nightborn/estoc, DRAFT `c17004d`: trident-vs-nightborn 8->14->8), then Executioner
   `anticipate` (17:00), then #543 (gladius, passed Lead review at `9858588`), then Veteran's scutum (16:00), then Combat's end-of-chain PR: the bump to
   7, the one re-pin, the blade rebake, **SIM_FILES = the import closure** (Combat found 4 missing: blade.ts, blade-paths.ts,
   roster.ts, finishers.ts; eslint.config.js:3 already lists them) plus a closure test, and gladius in PLAYER_WEAPONS_OFFERED.
4. The next rolling batch (Deploy has it): #540 -> #537 -> #541 -> #542 -> #544 (blood art B/C/D, Dom's pick) -> #546 (quiet-one
   Rematch wait), then #534 once the Auditer sends a re-gated sha. Finishers' droplets PR (body -> floor) stacks on #544 next.
**ROUTING, Dom 13:4x/13:5x: only Lead messages Strategy.** Every lane, Deploy included, reports to Lead. Lead owns the
Publish B clocks and hourly lines (Combat: #545 gates, Executioner by 17:00, bump to 7 + re-pin by 18:00; Weapons: #543;
Veteran: scutum by 16:00; Finishers: droplets on #544) and gives Deploy the Publish B go when Combat's re-pin lands. Lead sends
Strategy ONLY: publish sha lines, the phone-smoke receipt, any lane >30 min late on its clock, and ruling requests.
**Publish A is LIVE `dd1d968`** (13:30, 33/33, row 32 passed locally in 73 s). Deploy starts the next batch after the smoke receipt
or at ~13:52, whichever comes first. #539: Backend confirmed `1a0cec5` by its own run; Stats' WORN_FROM commit `be58866` is local,
not pushed, and needs Backend's re-OK when it is.
**Phone smoke on LIVE `dd1d968` (13:5x):** fight to kill + loot panel timing PASS (quiet-one check, `QA_URL=https://frankendom.com`,
`--opponent goblin`, with #546's wait patched in locally: panel closed 0.02 s after the kill, open at the complete latch 3.22 s). The
Veteran default loses all 3 scripted duels on v6, so always use goblin. **NOT run:** knife offered, tap-to-take + Undo, declined
survives a refresh. **Strategy ruled at 13:5x: make it a scripted check.** Web writes `scripts/loot-smoke-check.mjs` (a PR by 16:00),
and the Auditer wires it as a release row. Meanwhile Dom plays a knife duel on his phone. Next batch: #540 and #537 are on trunk; #541 #542 #544
#546 (+#534, #539) publish as one run, and its sha line goes to Strategy. #549 (droplets, READY) merges right after #544, retargeted to trunk.
**#547 (Veteran, `28a0fd0`, on #543):** swap + scutum + `veteran.Gladius` loot are in; 12 group-(a) sim-side reds await Combat's
re-pin. `veteran.Trident` is kept as a RETIRED_LOOT id (upheld: cleanLoot would otherwise delete earned pieces).
**Addressing lanes:** send to ListAgents rows as `"<exact name> [ref]"`, or reply to a `uds:` from-address. Both skip Desktop's
10-send cap.

## Lead — 2026-09-23 ~13:20 local: Window 1 split, Publish A, and the rulings since noon
**Now.** LIVE `c0b321c` (Deploy's receipt 12:31: 33/33, served index cmp-identical, VPS `current` -> `releases/c0b321c…`;
Lead confirmed `release.json`). **Publish A is running:** #528 + #530 (v6, merged 12:38) -> #535 -> #521 -> #533. **Lead owes the
375x812 phone smoke on it at FREE, with the receipt going to Strategy.** Next rolling batch, all non-sim and all Lead-reviewed READY:
**#540** (retired-replay page, first, because A's v6 retires every v5 link) -> #538 (wear() on CreatureBody) -> #537 (World
readability, file renamed to `colour-grade.ts`). Then #534 (Auditer match split, split only), after #535 and re-gated.
**Window 1 is SPLIT (Strategy, on Dom's order 13:0x):** Publish B takes the bump to **7**: #532 (estoc, READY on trunk via merge
`503bac0`) -> Combat's Nightborn/estoc profile (15:00) -> Executioner `anticipate` + cleaver (17:00) -> Weapons' gladius on #532
(15:00) -> Veteran's scutum (16:00). **Combat owns the one bump and the one SIM_DIGEST re-pin, at the end.** Two waves of dead
links accepted (one live account, grandfathered).
**Old links in Publish A are safe without #540:** trunk's refusal path (`main.ts:504`, `:779`) shows "Recorded on an older build" +
Play now. It is neither blank nor a wrong fight.

**Rulings since noon:**
- **`anticipate` spec CORRECTED (Combat caught it; Lead verified): step 3 below is WRONG.** A grade merged into the profile outside
  SIM breaks replay: `src/replay.ts:16` rebuilds the warden from `OPPONENTS[opponent].profiles[record.profile]`, and the record
  carries only `profile u8` (`src/record.ts:81`), so the fight would replay ungraded and diverge (in `verify-daily` too). **Ruled:
  the value lives on the Executioner's own per-level profiles in `moves.ts`** (`{ ...PROFILES.normal, anticipate: X }`), with
  `ai.ts:114` as specced. There is no record change and no `grades.ts` involvement. It rides Publish B's bump to 7.
- **Retired-replay page: NO DATE (Lead).** The record header has none, and `fight_records.created_at` is server-only by
  migration `202609220006`. We keep the privacy call rather than reverse it for a date.
- **Loot awards (Strategy):** the player takes ANY one piece, armour or weapon (SCOPE.md line 14). The server VALIDATES the claimed
  slot against the opponent's kit at the server's tier; the drop table decides what the opponent WEARS, never what the player gets.
  #539 (D3) changes `src/awards.ts` to match. Kill-screen flow and copy are unchanged.
- **#539 migration `202609230001` apply is HELD** until the client-claims PR ships in the same publish: `account_seed` is a one-shot
  snapshot, so an early apply loses the wins in between. **Backend [B1], BLOCKING:** a single multi-row insert gets past the
  60-per-hour cap (the STABLE policy function sees the count from before the statement; 500 rows -> 501 claims), fixed with a
  BEFORE INSERT row trigger plus a 500-row regression in `awards-database-check.mjs`.
- **CI check 32 does not gate (Strategy):** `deploy.sh` runs row 32 locally (passed in the c0b321c run, 72 s). Root cause and fix:
  #533 (the tap waits for the rigs plus one painted frame; software GL on the runner stalls the shader-compile frame).
- **#534 dedup:** the Auditer had folded #535's `mergeLoot` fix into its match split. Stripped at `7808f03`.

**Gotchas:**
- **The send cap:** a send to a `local_…` id goes through Desktop session messaging and stops after 10 per user message (a
  mid-turn user message does not reset it). A send to a ListAgents row as `"<exact name> [ref]"`, or a reply to a `uds:` from, is
  NOT capped. A PR comment is not a message: #524's HOLD was a comment, and Deploy merged it.
- **SIM_FILES:** any helper put in `src/record.ts` trips record-version-guard as a sim change. Web's header peek lives in
  `src/record-header.ts` for that reason.
- **Quality gate timeout:** `quality:stop` overran the 300 s Stop budget on the loaded box; #541 raises it to 420 (the hook's max).

## Lead — 2026-09-23 morning: Strategy's #2, beta dispatch, and the anticipate spec
**Now.** Dom: Lead is Strategy's #2 — lanes report to Lead, Strategy rules and keeps its state doc. Beta list in priority:
(1) publish after testing together, (2) knife then cleaver + estoc balance, (3) loot: tap-to-take + Undo (#475), tiered
armour, server gear bonuses, (4) shields + Centurion gladius/scutum, (5) kill polish incl. blood follows bodies, (6) phone
validation. Knight / Shieldmaiden / Witch / Plague Doctor are **post-beta**. **Force-push is excluded by Dom's order, so every
conflicting PR re-opens as a NEW number** — never rebase-and-force a shared branch.

Live `fe0d8e0`; trunk `2d614dc` (247 commits ahead). **A deploy of `2d614dc` was in flight at 09:xx** (deploy.sh at `test:all`,
running from the Deploy session's scratchpad). deploy.sh itself runs tsc, the tests and the full release-row matrix and refuses
on failure — that is the code half of "tested together". **The half it does not cover is the phone smoke**: a 375x812 fight to a
kill with the loot panel, because #506 (finisher-complete latch), #511 (CC0 audio) and #513 (goblin unscale) landed together and
were never run as one tree. That smoke cannot run while a deploy is in flight (one-deployer rule) — it runs at FREE, then the
receipt goes to Deploy as "publish" or the defect.

**#488 revert, recorded on the PR (comment 5789709301):** TS2741 — #478 added `Shield` to `ARMOUR_SLOTS`, widening `LootSlot`, and
#488's `SLOT_WEIGHT: Record<LootSlot, number>` had no `Shield` key. Re-lands as a NEW PR with `Shield: 0` as a tested decision
(Brief 19 Addendum C item 3: the shield is the guard profile only). **#514 goes after that re-land** — it depends on
`src/gear-stats.ts`, which the revert deleted, whatever GitHub's MERGEABLE says. Then Stats' PR A v2 (#503 is superseded, not
rebased), then #515 knife on top.

### Spec for Combat — per-grade `anticipate` (Brief 14), for the cleaver row
**The problem, measured by Combat:** on the Executioner's normal light-spam row the cleaver sits at 17-18/24 and warhammer and
trident at 11/24 on the *same mechanism* — a read problem, not weapon data: he cannot see the tell in time.

**The lever is `anticipate`, not `reaction`.** `ai.ts:114` is
`reads.spammer && (light_left|light_right) ? Math.min(profile.reaction, READ.anticipate) : profile.reaction`, with
`READ.anticipate = 8`. The Executioner fights on `PROFILES` (`moves.ts:510`), normal `reaction: 14` — so on exactly this row his
effective reaction is already clamped to 8, and any per-grade `reaction` above 8 is swallowed. Pushing `reaction` below 8 instead
would retime every punish, because `:159` (hurt opening), `:160` (whiff recovery) and `:162` (guarded read) read the RAW value.
`anticipate` is the only knob that lands on the spam read alone.

**Shape — and the SIM boundary decides it.** `ai.ts` and `moves.ts` are SIM modules; `tests/sim-boundary.test.ts` lets SIM import
only SIM, and its regex catches type-only imports. So the sim must never see a grade. Design:
1. `moves.ts` `AiProfile` gains optional `anticipate?: number` (ticks). `ai.ts:114` becomes
   `Math.min(profile.reaction, profile.anticipate ?? READ.anticipate)`. **Absent = today's behaviour exactly**, on every fighter.
2. `grades.ts` (non-SIM) owns the per-grade values: `GradeRecord` gains `profile?: { anticipate?: number; reaction?: number }`,
   absolute ticks, not multipliers — the tell is measured in ticks, so a multiplier would make the answer depend on the
   archetype's base, which is the thing the grade decides.
3. The grade -> `AiProfile` merge happens OUTSIDE SIM, where the fight is assembled (`src/match.ts` once #505 re-lands, else
   `main.ts`), so the sim receives a plain number on its profile.

**Rows it must move:** Executioner normal light-spam — cleaver 17-18/24 -> **<= 9/24**; warhammer and trident, same row, 11/24 ->
**<= 9/24**. **Must NOT move:** the Executioner's identity pins, and any fighter whose grade sets no `anticipate` (the default path
must be byte-identical in behaviour). **Values, and which grades carry one, are Combat's** — chosen by the 24-seed battery across
every weapon at both levels, since every player weapon is also a warden's weapon. Lead reviews the PR body.
**It changes `ai.ts`, so it moves `SIM_DIGEST` and needs a `RECORD_VERSION` bump** — ride the single bump to 6 (whoever is ready
first takes it), never a second one.

### LIVE `52dffed` — BETA ITEM 1 DONE (verified by Lead, ~07:00Z)
`release.json` = `52dffed0136cd596539c090bbc8614d6735b3e02` = trunk. Deploy's receipt: 33/33 rows (31 CI-trusted, rows 26 and 32 run
locally), served `index.html` cmp-identical to dist, VPS `current` -> `releases/52dffed…`, **box FREE**. Lead verified that #506
(finisher-complete latch), #511 (CC0 audio) and #513 (goblin unscale) are all ancestors of `52dffed`. Those three had never run as
one tree, and they now have, through the full release matrix. **That publish was 3 minutes, not 50,** because #519 (the CI plan
fix) made CI's release matrix run again, so 31 rows were CI-trusted. The earlier 50-minute `2d614dc` death was the saturated box
and the untrusted matrix, not a code defect. Row 27 passed in this run.
**Still owed on item 1: a human 375x812 look** at a fight to a kill with the loot panel on the live build. The matrix covers
behaviour, not how it reads on a phone.
**New, owner: Auditer (CI) — CI `check 32` (autopsy) fails on EVERY CI run** with a `.tap()` timeout on "Enter the arena" (line
29), but passes locally every time (41 s today). It does not hurt deploys, since `deploy.sh` runs row 32 locally, but CI will
never trust that row, so every deploy pays its local cost. Most likely a CI-runner timing or viewport difference. Needs a fix,
not a longer timeout.

### Stats, ~07:05Z
- **#528 = PR A v2 — REVIEWED, READY for Deploy, and NOT Window 1.** Head `e3bd67f` (`a0c6458` + a fast-forward merge of trunk
  `5c19f8b`). It stays at version 5 with no byte-layout change, and `record-replay-check --strict` is IDENTICAL to the pre-change
  receipt (veteran-walk-in 1677 `d953a09bed432ea1`, veteran-scripted 1452 `552f30e5b09f4841`, digestMatch true on both). It is a
  digest re-pin with no bump, per the #439 precedent, so it alters no fights and publishes on the rolling cadence. The knife stacks
  on it, so it needs to be on trunk first anyway. Gate: 494 / 492 / 0 fail / 2 skipped. **The `release-checks.test.ts:73` red is
  CLOSED as load:** 7/7 three times alone on a quiet box, and it passes inside the full gate. #503 is closed with a pointer.
- **#514 (resolver): base retargeted from `stats/lane` to trunk.** Deploy caught that it would have landed on the wrong branch.
  Head `8e07865`, 2 files +75/-2. Gate 496 / 494 / 0 fail / 2 skipped, `gear-stats.test.ts` 20/20. Stats caught and fixed its
  own broken conflict resolution (TS1005). NOT READY until `quality` runs against trunk in CI.

### !! #524 MERGED despite the Lead HOLD — now in trunk `c0b321c`, being published (11:55)
Verified: #524 is MERGED at `52ac5ae` and is an ancestor of `c0b321c`, and `src/cloud-profile.ts:37` now does
`{ ...mergeLoot(profile.loot, cloud.loot), equipped: ... }` on every ordinary refresh, while `mergeLoot` (`src/loot.ts:101`) still
drops `declined`. **Result once `c0b321c` is live: a player's declined-loot history is wiped on every refresh**, not only on an
account merge. The hold was a PR comment on #524, but the Lead->Deploy message never went (the cross-session cap), so Deploy never
saw it. **Scope of harm:** only `declined`, the capped list of refused kills (max 50). `owned`, `equipped` and `taken` (the actual
gear) are unaffected. **Recommendation: do NOT roll back** (a rollback is Dom's call under the standing order). Make Backend's
save-defect fix the next thing Deploy ships; it carries `declined` in `mergeLoot`, which closes this in the same place. Lesson: a
hold must reach Deploy as a MESSAGE, and a PR comment alone is not seen.

### WINDOW 1 STATUS, ~07:15Z — the knife is READY, but THE WINDOW CANNOT CLOSE
**#530 = knife, READY, HELD for Window 1.** Head `35d4686`, base `stats/record-accept-list-v2` (#528). All run on this head:
`record-version-guard` 2/2 (SIM_DIGEST `5eaa075a…` over the combined tree, guard-verified; `RECORD_VERSION` 6,
`READABLE_VERSIONS` `[6]`), `record-replay --write` + verify PASS (fixtures identical), quality:stop 494 / 492 / 0 fail / 2 skipped,
`test:slow` 97/97 (only the stalemate row `knife vs goblin hard: kick only untouched` leaves; Goblin identity pin intact; no
non-knife row moved), and `knife` is in `PLAYER_WEAPONS_OFFERED`. #515 is closed as superseded. **Deploy order: #528 first, then
retarget #530 to trunk.** Combat restarts fresh for item 2 (Nightborn profile + estoc flip on Weapons' re-opened #419).
**WINDOW 1 MEMBERS and state:**
- knife #530: READY
- Stats PR B (loadout tail + v6 fixture rewrite): not opened
- **retired-replay page (Web): NOT BRIEFED; the send is blocked by the cap**
- Nightborn/estoc + flip: Combat item 2, waits on #419
- Executioner/cleaver (`anticipate`): Combat item 3
- Centurion roster line: Veteran, stacked on Weapons' gladius (not opened) plus the `wear()` loader fix
**The retired-replay page is the hard blocker.** The bump kills every v5 kill link. Without that page, every old shared link lands on
a refused/blank fight the moment Window 1 publishes. **Deploy must NOT publish Window 1 until the retired-replay page is merged in
it.** Brief Web on it first.

### Stats deliverable 3 (server-authoritative awards): design questions out to Backend; SQL held. One question may be STRATEGY'S.
(1) The only verified records are `daily_results`. LADDER kills are what drop loot (`dropFor`, `src/loot.ts:65`), and no ladder record
reaches a verifier, so D3 needs a new `loot_claims` table (owner insert, unverified, the same pattern as `daily_results`) plus an
`awards` table the client cannot write, filled by the verifier replaying with `decodeRecord` / `verifyRecord`.
(2) **`victory_marks` is client-written (migration `202609200004`), and both the drop (`subRank(marks)`) and the tier
(`tierAt(marks)`) read it.** A server award built on client marks would let a client claim an Origin-rung drop from a Recruit fight.
Stats leans toward putting the rung in the record once PR B lands, so a wrong rung replays a different fight and is caught for free.
Until then the tier stays client data, flagged as such. **Making marks authoritative changes what `victory_marks` means, which is a
ranking question, so it goes to STRATEGY to rule.** #514 was closed and reopened to trigger `quality`; READY follows when green.

### RULED (Lead, format/sequencing), ~07:25Z: PR B binds the ACCOUNT into the record, as an OPAQUE token
**Backend found it:** fight records carry no account binding (`src/record.ts` has no user field), and `fight_records` are public by
id. Once loot is server-authoritative, **B can fetch A's shared kill and claim A's loot.** Backend's interim guard: a global unique
on the record hash, with the client posting its claim BEFORE it offers Share (first claimer wins).
**Ruling: the real fix goes in PR B, in Window 1.** PR B already defines the v6 byte layout, and a binding added later means a bump
to 7 and a second wave of dead links, where adding it now costs nothing. **Condition: an OPAQUE per-account token, never the raw
auth user id.** Share links are public, so a raw id would expose which account fought every shared fight. The server must be able to
check the token against the claiming account; nobody else can read it. Stats and Backend settle the exact form (for example an HMAC
of the user id under a server secret, or a stored per-account random id). PR B's body states the privacy reason.
**Ticket, not a blocker:** the same hole exists today in `daily_results` (B can post A's daily record under B's name). Backend to
open it.
**RULED by Strategy, ~07:30Z: `victory_marks` become SERVER-AUTHORITATIVE now.** Existing progress is grandfathered, and guests
start at zero. Stats builds it, and the PR comes through Lead.
**Reconciling Backend's form with the Lead ruling:** Backend proposed `record.owner === claim.user_id`, with the raw account id
in the record. **The Lead ruling stands: the record carries an OPAQUE token, not the raw id,** because kill links are public. The
check keeps Backend's shape and its "one decoder, two readers" path: the verifier computes `token(claim.user_id)` and compares
it with `record.owner`. Poster binding is the next item after D3 and lands as PR B's format, in Window 1.

### Visual review triaged (Strategy, ~07:50Z; report `~/Desktop/Business/reports/frankendom-visual-review-2026-09-23.md`)
Already assigned: finisher framing and blood (Finishers). **Controls: Dom keeps those himself; nothing for Web.** **TWO cheap items
for WORLD, after its phone perf receipt**, one PR each or combined, World's call:
(a) **Fighter readability trial, lighting + material only:** key/rim light on fighters, slight desaturation of sand and wall, no
asset changes. Before/after phone still at 375x812 in the PR body; Dom judges. This also fixes the Executioner's weapon against his
dark torso, the Goblin's weapon at phone size and the Pitborn against the sand, **so no character lane touches a model.**
(b) **Crowd recessive:** darken/desaturate the spectator material and lower its contrast so it stops competing with the fighters.
Material only; the crowd rebuild stays deferred; perf unchanged within noise.
**Post-beta:** surface polish (metal slabs, torn cloth) and the remaining per-character notes.
**JUDGING RULE, adopted:** Dom judges camera + loot + blood together on ONE phone capture (contact -> reveal -> settled body -> loot
open). Finishers and Web coordinate one capture when both are ready, not three separate approvals.

### Web, ~07:45Z — #521 (loot panel v2) still DRAFT, correctly: the real-win run is owed
Head `80710b6`, the re-open of #475 (closed by Lead with a pointer). Web caught **a serious defect of its own**: the touch that stops
the post-kill tour, at (190, 300), now lands on the Centurion's second tile row (9 pieces since #478), and **a tile tap is the take**,
so a stray touch took loot. Fixed: tiles and Undo are inert while `:root.endgame-fade` is on, the same rule Rematch and Share
already follow. Proof on the 375x812 preview: fade ON, (190, 300) and all 9 tile centres go to `world`; fade OFF, the tap takes.
`quality:ci` 520 / 518 / 0 fail / 2 skipped. **Owed before it leaves draft:** one full end-to-end killing run on `80710b6`, plus fresh
screenshots.
**Latent check bug (owner: whoever holds `scripts/quiet-one-browser-check.mjs`, likely Finishers/Deploy):** line 109 taps Rematch
straight after a duel that did NOT kill, but Rematch is inert under the fade, so it waits on intercepted pointer events until timeout.
Line 183 does it right (tap the arena first, then wait for the fade to lift). The duel's kill is not deterministic on a loaded Mac
(2 of 3 runs, then 0 of 3), so **a deploy passes that row only when duel 1 happens to kill.** Trunk fails identically. It is latent,
not the cause of any publish so far. Fix: give line 109 line 183's arena-tap-first step.

### World, ~07:35Z — phone perf on live `52dffed`: an UPPER BOUND, not a verdict (the box was contended)
CPU x4, 393x852 DPR 3 touch, cold load, first kill, 3 runs: p95 383 / 500 / 366 ms, worst-since-load 2,850 / 3,418 / 3,650 ms,
p50 18.7 / 35.1 / 233.7 ms. **Same page, same seed, so the spread is the machine.** Unthrottled control: p50 65 / 35 ms, where an
unthrottled M5 has run this arena at a 16.7 ms median before. Load was 24-44, with about 80 headless Chromium processes from other
lanes. The sim fell behind (14.9 s of fight took 36 s of wall time). No `guard.glb` fetched, draws 97-99, ~386k tris, 0 page
errors. **The real receipt is Dom's own `?perf=1` on his iPhone** (the instrument of record), or a re-run on a quiet Mac.
**Two measurement traps, for EVERY lane with a browser gate:**
1. `chromium.launch({headless:true})` WITHOUT `executablePath: chromium.executablePath()` renders on SwiftShader (software GL),
   not the GPU. Verify with `UNMASKED_RENDERER_WEBGL`: "SwiftShader Device" vs "ANGLE Metal Renderer: Apple M5". **Any perf number
   taken on SwiftShader is void.**
2. `#reset-button` opacity '1' fires at fight START, not at the kill. **The finish signal is `#debug` `data-record`.**

### Audio, ~07:10Z — phone pass on live `52dffed`: #529 READY (non-sim)
The served `sprite.ogg` and `sprite.m4a` sha256 match git, so the measurements are of the shipped audio. #529 (head `5aa788b`)
lowers the whip TELL (gain .3 -> .1) so it sits 8.4 dB under the lash on the phone band. The two had read equally loud (-29.2 vs
-29.1). It also adds the two missing whip probes (coverage 17 -> 19). Gates: quality:stop 0 fail, `audio-preview --check` exit 0.
**Lead query:** Audio's own earlier report said `WhipRaised` / `Whipped` never reached trunk and SCOPE.md removed the lorarii
guards. If so, this tunes a cue no fight fires. It is harmless and cheap, but worth confirming the cue is live before counting it.
**Two mix calls for DOM (reported, not changed):** on a phone the kick lands at -41.4 LUFS against a light hit's -34.7, and a
guard break loses 6.8 dB between full band and phone band (-29.6 -> -36.4). Both live mostly below 300 Hz, which phone speakers
drop. Making either audible on a phone is a VOICING pass, not a gain change.
**Receipt correction, self-reported:** this repo has NO `npm run lint`. Audio's "#511 lint clean" came from a missing-script call
whose exit code was piped away. The real lint is `eslint src` inside quality:stop, and it passes on the tree containing #511, so
nothing shipped broken. The receipt was hollow, though. **Every lane: cite quality:stop, not `npm run lint`.**

### (superseded) DEPLOY DIED, 06:29Z: `2d614dc` killed with `EXIT=124`.
The log ends: `Retrying release check 27 alone` -> `Deploy ceiling: no exit after 3000s in step 'release checks' — killing
the deploy` -> `EXIT=124`. Live is still `fe0d8e0`; trunk is `52dffed` (`2d614dc` + #519 CI fix + #502). **Row 27
(`scripts/veteran-polish-check.mjs`) is unproven: load or a real hang.** It hit 900 s in the matrix, and its solo retry then ran out
of the deploy's total budget. **These sends were written but NOT delivered (the cross-session cap), so send them first:**
- **Deploy:** run row 27 ALONE outside any deploy on a quiet box and note the wall time. On a normal-time pass, re-deploy `52dffed`
  and send the sha line to Lead + Strategy. If it hangs or fails alone, it is a Veteran-lane defect: send the output to Lead and
  do not publish around it.
- **Veteran:** your row 27 killed the publish. Look for an unbounded wait, a page event that never fires, or an asset path broken
  since #478/#502. That comes before the scutum pose.
- **Backend:** save defect, PR today (spec below). **Web:** retired-replay page rides Window 1, plus the observation funnel.
  **Stats:** `[6]` exactly, plus the gear rows in the plan today.
- **Strategy:** the sweep 2 report (this block plus the PR list: #523 Deploy-when-green, #520 + #516 green for Deploy, #524 new
  with `quality` red and owner unknown, #518 `plan` red since it likely carries the old apostrophe in its own workflow change, so
  it rebases onto #519).
**Veteran, 06:3xZ: the shield-carry pose is BUILT and gated** on `char/centurion-gladius-scutum` @ `2aca298` (off `2d614dc`).
It is `src/characters.ts` +~50 lines and `tests/shield-carry.test.ts` 3/3; quality:stop 479 / 477 pass / 0 fail / 2 skipped; zero
clips. The left arm is re-aimed post-mixer to carry / raised / strike, in the fighter's own frame, and works on any rig. Measured:
the blade crosses the board on 3 of ~250 frames (1 cm rims, one 8 cm), against 66 frames up to 25 cm on the clips' own hold, which
is the regression floor. No PR yet; it stacks on Weapons' gladius PR. **New scope for the Window-1 Centurion change: `wear()`
cannot dress the Centurion's own rig.** `veteran.glb`'s Body slot is non-mesh Object3D nodes, so `wear()` throws 'The rig has no
Body draw to hang loot on'. The scutum on the OPPONENT needs that loader fix plus an opponent `wear` call in `scene.ts`, then the
browser render check, the versus regen and the identity pin. **Veteran does NOT yet know its row 27 killed the deploy** (send
blocked).
**Executioner, 06:4xZ: #494 re-landed as #526** (head `388d43a`, off `2d614dc`, docs + one byte-identical image, no release rows).
It corrected the withdrawn shoulder ratios on the way: the PROMPTS.md paragraph now gives the matte figures (0.367 / 0.374 / 0.360)
and says no Knight candidate spread exists. **Reviewed by Lead: ready for Deploy once CI is green.** #502 is merged; its local
quality:stop is now a post-merge receipt owed at FREE, not a gate. Knight body is parked at `char/knight-body` @ `951c9be`.
**Note: Executioner believes a deploy is still in flight. It is not; the deploy DIED. Every lane waiting on "FREE" is waiting on
a signal nobody will send until Deploy is told.**
**Auditer, 06:5xZ — two PRs:**
- **#522 (match split, head `9964b99`) — REVIEWED, READY for Deploy (non-sim).** MERGEABLE, CI all green, every owed receipt
  on the PR: gate 481 / 479 / 0 fail / 2 skipped (the deploy-ceiling timing test passed once the box was free, so it was load),
  account-browser-check passed, finisher-preview against `2d614dc` 4 JSON identical, frames 0-1 px (the trunk-vs-trunk noise
  floor). It also fixes re-audit defect 2 (the stale-epoch guard now runs before the redirect in both loaders).
- **#524 (account-never-lower, head `2c00ed2`) — HOLD. It must merge AFTER Backend's save-defect fix, not before.** Found by Lead in
  review: #524's `absorbCloud()` does `{ ...mergeLoot(profile.loot, cloud.loot), equipped: ... }`, routing EVERY ordinary
  refresh through `mergeLoot`, which drops `declined` (`src/loot.ts:101`). Today the declined history dies only on an account
  merge; with #524 alone it would die on every refresh, which amplifies the save defect. Both PRs also touch
  `src/cloud-profile.ts`, so **order: Backend's fix (carry `declined` in `mergeLoot` + `profileDiffers`) lands first, then #524
  rebases on it with a combined-tree receipt and a fresh account-browser-check** that asserts declined survives a refresh.
**The 20-min cron sweep (`e7317592`) was DELETED at 06:30Z:** a cron-fired prompt does not reset the app's cross-session cap, so
the sweep could look but could not message anyone, and it only added load. Re-create it only in a session that can actually send.

### Deploy `2d614dc` did NOT publish (confirmed by Lead from the log, 06:23Z)
Release check **27/33, `veteran-polish-check.mjs`, hit the 900 s CEILING and was killed: FAILED (exit null)**. Rows 31 and 32 passed
after it; deploy.sh was still running and live was still `fe0d8e0`. A ceiling kill on a saturated box is most likely load, not
a defect, but it counts as a failure until a solo run passes. **Deploy's order (Strategy):** when the matrix ends, rerun row 27
ALONE; publish on a pass and send the sha line to Lead and Strategy. **On a solo fail it is a Veteran-lane defect and comes to Lead.**
**Chase:** if there is no sha line and no fail output by 10:50 local, get the log tail from Deploy.

### Four beta additions from the external review (Strategy, ruled 2026-09-23 ~06:40Z, in priority order)
Report: `~/Desktop/Business/reports/frankendom-review-2026-09-23.md`. Its verdict is "serious indie, strong combat foundation,
unfinished player experience". Everything else in it is either already in flight or post-beta.
1. **SAVE DEFECT (beta item 3). BACKEND owns it, the Auditer reviews, this week, own small PR. VERIFIED by Lead on trunk:**
   `mergeLoot` (`src/loot.ts:101`) rebuilds only `owned`/`equipped`/`taken`, so `declined` is DROPPED on every account merge, and
   that is directly under a comment saying "nothing is lost". `profileDiffers` (`src/cloud-profile.ts:25-29`) compares only
   `owned`/`equipped`/`taken`, so a **decline-only change never saves**. Fix: a bounded, deduplicated history merge
   (`DECLINED_KEPT` = 50, which already exists at `loot.ts:81/93`) plus the field in change detection. Tests: login merge,
   decline-only change, duplicate histories, the 50 cap.
2. **RETIRED-REPLAY PAGE. WEB, small, rides WINDOW 1.** The knife bump kills every v5 link. An old shared link must land on an
   explicit "this fight was recorded under an older version" page showing the durable result (winner, weapon, opponent, date from
   the record header). Never a blank page, never a mis-simulated fight. Built against the `READABLE_VERSIONS` refusal path, and it
   **merges with the bump, not after**.
3. **GEAR VALIDATION ROWS. STATS, in the Brief 19 battery before deliverable 5 merges.** Max kit vs naked compounds to
   1.15 / 0.80 = **1.4375** relative damage ratio; that is what the caps mean, but it has to be MEASURED: naked vs max-kit, equal-kit,
   and mismatched-tier, at both AI levels, with win rate and fight length. Review the cap only if a row shows equipment beating
   skill. Daily stays fixed-kit. Rows go into the battery plan now; no code yet.
4. **PLAYER OBSERVATION PROTOCOL (item 6 sharpened). WEB + COMBAT, after the next publish.** Instrument the funnel on the public build:
   first fight started/completed, loss -> rematch, first loot equipped, save success, next-day return, and stalls/errors by release
   and device. Then Dom watches 5-10 unfamiliar players on the exact public sha, recording raw counts: can they explain a loss, do
   they rematch, do they equip. **No interactive tutorial gets built on assumption.** If the answer is "cannot explain the loss",
   the surface to improve is the existing autopsy (`src/autopsy.ts`), with no duplicate system.
**DEADLINES (Dom, "get them done"):** (1) save defect, Backend: PR **by end of today**. (2) Retired-replay page, Web: PR ready
**before Window 1 closes**; it merges WITH the bump. (3) Gear validation rows, Stats: **in the battery plan today**, run before
deliverable 5. (4) Observation protocol, Web + Combat: instrumentation PR **within two days of the next publish**, then Dom's
observed session. Owners' acks and ETAs are owed in the next sweep.
**Post-beta, recorded:** mastery milestones on the ladder (the career rule stands: one mark per win, no demotion), a wound/comeback
retune (needs the observation first), and crowd/material/framing polish beyond World's phone pass.

### The sim window (Strategy's rule, 2026-09-23) — how fight-altering PRs publish
Every change that alters fights costs a `RECORD_VERSION`, and kill links die once per publish that carries one. So **all
fight-altering PRs in the SAME publish share ONE bump**, with the digest re-pinned once at the end of the window.
**Window 1 (bump to 6):** #515 knife + Combat's Nightborn/estoc profile item + the estoc flip (on Weapons' re-opened #419) +
the Executioner profile and cleaver flip (the `anticipate` spec above) + the Centurion roster weapon line. Then Deploy publishes.
Anything fight-altering that misses the window takes **7, with its own publish**.
**Ruling (Lead, sequencing), 2026-09-23 ~06:20Z: Stats' PR B joins Window 1.** Combat found it. PR B puts a loadout tail on
the v6 byte layout and rides the knife's bump without a second one, which means two byte layouts under one version number. If
the knife publishes first, every link minted in between is a tail-less v6. The PR B build accepts it as v6, reads a tail that
isn't there, and fails. **The version byte cannot catch it.** One publish for the whole window makes that impossible, because
no v6 link is ever minted without the tail. The alternative, PR B taking 7, costs an extra wave of dead links for nothing.
**RULED (Strategy, 2026-09-23 ~06:10Z): `READABLE_VERSIONS` goes `[5]` -> `[6]` EXACTLY, with no re-accept of 5.** The knife
alters fights, so every v5 link dies under the record rule, and the guard test's own condition (sim digest changed => the
accept-list is exactly `[RECORD_VERSION]`) says the same. The Window-1 PR bodies (the knife, and Stats' PR B) must state both
this and the no-partial-publish rule.
**Deploy: never publish Window 1 partially.** In particular, never ship the knife ahead of PR B because it went green first.
PR B also owns re-writing the replay fixtures the knife writes at v6.
**`READABLE_VERSIONS` `[5]` -> `[6]` on Combat's branch** (a replacement, not a widening: v5 stays refused). It is inside Stats'
territory and Stats had asked for `[5]`, but that ask predates the stack and can't hold alongside a bump: their own guard
requires the list to include `RECORD_VERSION`. Accepted provisionally. Whether PR B re-accepts 5 is Stats' call, and Strategy
rules if they disagree. **Non-sim PRs cost nothing and publish on the
rolling cadence in between:** #475 v2, #514 (after the tier re-land), #505 v2, #502, docs. "Publish after every two or three
merges" applies to the non-sim PRs only.
**Ruling (Strategy):** the Centurion carries gladius + scutum at **every** rung for beta (Veteran's option A); a Legionary gate
needs tier as a sim input, which is Brief 19 deliverable 5 and behind Combat's queue. Veteran builds the scutum carry pose once in
`characters.ts` (shared renderer, the player's shield reuses it), zero clips, stacked on Weapons' gladius PR. The roster weapon
line is sim, so it is in Window 1. Flagged to Dom as reversible.

### Lane dispatch — sent, and where each stands
Ten of Strategy's sends bounced and most of mine did: at 09:xx only Veteran, Nightborn, Strategy, Backend, Deploy, Goblin,
Character Main and Hooks were running. **Combat, Stats, Web, Auditer, Executioner, Weapons, Multi Chars, Finishers, World and
Audio were not.** Each brief below goes out the moment its session is up; acknowledgements are confirmed to Strategy.
- **Combat:** #515 knife (re-open off trunk on Stats' PR A v2), then Nightborn profile + estoc flip on Weapons' re-opened #419,
  then Executioner profile + cleaver flip (the spec above), then the shield slice (Brief #474; #478 asset is on trunk).
- **Weapons:** gladius FIRST (data, equip, blade table, slots; heads-up to Veteran + Combat; battery both levels; PR after the
  knife's bump to 6), re-open #419 and #473 off trunk, `Maul_*` clip family after at post-beta pace (maul equip is blocked on a
  12-clip hero-rig family + hero blade table).
- **Web:** re-open #475 off trunk today (tap-to-take + Undo; re-measure 375x812 and 1280x800 on the combined tree), then a phone
  readability/controls pass on today's publish.
- **Stats:** tier-table re-land with `Shield: 0`, then PR A v2, then #514, then deliverable 3 (server-authoritative awards,
  Backend reviewing — Backend is briefed).
- **Multi Chars:** Greaves + `WORN_FROM` floor + stable drop index now that #478 is in. Witch is post-beta.
- **Finishers & Gore:** kill-camera framing on #475 v2, and beta item 5, **"blood follows bodies" — RULED by Strategy after Dom
  reviewed the three options: Option 3, built as Option 2 first. Not Option 1.** Dom's words: "less uniform, differentiated each
  blood spot, dripping not star, slowly downwards, droplets onto the floor, not a river". The faults he saw: one star texture reused
  for every mark (`scene.ts:190`, a 17-satellite ring), the photo splat being a floor pool reused on torsos, and FRESH tint reading
  black. Three steps, in order:
  (a) **Measure first.** The harness shows runs to 12-13 cm on the Veteran; Dom's screenshot shows none on the hero. Establish
      whether #455's reach cap clamps runs on the hero tunic or whether they are too dark to see. If it is a bug, fix it; the
      receipt goes in the PR.
  (b) **Option 2, one PR:** 4-6 distinct body-authored wound splats + 3 drip variants via FLUX, **seed-picked per hit so replays
      stay identical**, the top edge is the cut, tint lifted off black. Dom judges on his phone.
  (c) **Option 3, a separate PR AFTER (b):** droplets shed at surface edges, one per run every ~1.5-3 s, a hard cap in flight, a
      small floor size class. Needs a phone frame-budget receipt: CPU x4, p95 and worst-since-load unchanged within noise.
  Reports come through Lead: PR, head sha, gate numbers, screenshots. Seed-picking matters: a per-hit choice that used a live random
  would make a replay diverge, so it has to come from seeded state.
- **World:** phone-tier perf receipt on today's publish (CPU x4, `?perf=1`, cold load + first kill); silhouettes held for Dom.
- **Audio:** phone audio pass on today's publish; fix what is theirs in one PR.
- **Auditer:** re-open #505 off trunk with a combined-tree receipt (main.ts moved under it when #506 landed).
- **Executioner:** #502 gate then READY (MERGEABLE, 0 failed, told Deploy); re-open #494. Body work paused — post-beta.
- **Veteran (up):** Centurion scutum + gladius kit from Legionary, cost by noon.

**Dispatch receipts, 2026-09-23 ~06:00Z.** Briefs were sent by `local_` session id: `ListAgents` only shows mid-turn sessions,
so a send to a display name bounces for an idle lane that is really there. **Acknowledged:** Finishers & Gore (step (a)
first, in a fresh session; diagnosis in `docs/state/finishers.md`), Combat (knife item 1; local head `ee9a0d0` on `2d614dc`,
waits on the deploy for its guard, replay and battery), Weapons (#473 carried forward as #520; gladius next in a fresh session;
#419 later, without its own bump), Multi Chars (Greaves + `WORN_FROM` + stable drop index, in a fresh session). **Queued, no
ack yet:** Stats, Web, Executioner, World, Audio.
**NOT SENT, owed by Lead** (the app capped this session's cross-session sends until Dom writes here):
- ~~Auditer~~ **DONE without my send: #522** (`quality/match-session-2` @ `a909fc8` on `2d614dc`). #505 closed with a pointer,
  no force-push. The #506 conflict was resolved by hand: `pendingLoot` stays page timing state, reset in the one `began()`. The
  move-only check is clean. **One failing test, stated:** the deploy-ceiling timing test ("a check that never exits is killed at
  the ceiling", 11.1 s) failed while a deploy shared the box. It is a timing test run under load, but it stays OPEN until the
  solo rerun passes. Still owed on the window: that rerun, `account-browser-check`, and finisher-preview equivalence against
  `2d614dc`. Do not merge #522 before all three are on the PR.
- **Veteran** (`local_e360b41f-203f-43f3-bc1b-e9c75ae11da9`): the Centurion carries gladius + scutum at every rung for beta. The
  scutum carry pose goes in `characters.ts` once, stacked on Weapons' gladius PR. The roster weapon line is in Window 1. Cost by noon.
- **Combat:** "once" means one BUMP per window, not one PR. The knife takes 6, and each later PR (estoc, cleaver, shield) re-pins
  its own digest without bumping, because each PR's own CI runs `record-version-guard` on its own tree. **PR A v2 now EXISTS:**
  `stats/record-accept-list-v2` @ `a0c6458`, pushed so the knife can stack on it (digest `7e8b5cd8…`, hand-verified; no
  SIM_FILES moved between `544bcb4` and `2d614dc`). Stack the knife on it. (An earlier draft of this line said build on plain
  trunk; that was true before Stats pushed.)
- **Deploy:** Window 1 now includes Stats' PR B. Never publish the window partially, and never ship the knife ahead of PR B
  (the tail-less v6 hazard above).
- **Stats:** PR B is in Window 1; it rewrites the knife's v6 fixtures; `READABLE_VERSIONS` went `[5]`->`[6]` on Combat's branch.
- **Stats, reported ~06:10Z:** the tier-table re-land is `stats/gear-stats-table` @ `8d12a49`, local until green: #488 plus
  `Shield: 0` with a dedicated test. One open failure, stated by Stats: `tests/gear-stats.test.ts:169` (the tier x slot grid)
  failed once before the ten snapshot rows got `Shield`. The rows are patched, but the rerun is blocked by the deploy lock. Both
  PRs open, with gates and a `record-replay-check --strict` receipt, when the lock clears.
- **Weapons:** the gladius-before-maul order was INTENDED. It is in Strategy's own working brief ("gladius FIRST … Maul_* after,
  post-beta pace"), because the Knight is post-beta.
- **Strategy** (its session handed off at its ceiling): one line per lane confirming the acknowledgements above.
**The deploy of `2d614dc` was still running at ~06:00Z** (614 log lines in, at the Dwarf's fairness battery, no failure). Every
lane's gate waits on it.

**#523 (Stats: tier-table re-land) — REVIEWED by Lead, READY for Deploy once its CI is green (33 checks pending at 06:2xZ).**
Head `8d12a49`, non-sim, so it publishes on the rolling cadence. The body carries what the review rule asks for: the revert
reason with the exact TS2741 reproduced, a combined-tree note (`git diff --stat 2d614dc 52dffed -- src tests` is empty), and
the rejected design, a RES weight on the shield, which would reinstate Dom's withdrawn -20 % (one Recruit shield would equal the
Origin armour cap). Local gate: `tsc` clean, `quality:stop` 493 / 491 pass / 0 fail / 2 skipped, including the
`gear-stats.test.ts:169` grid rerun. #514 re-opens on top of it.
**Stats PR A v2** (`a0c6458`): not a PR yet. Its gate had 1 failure, `tests/release-checks.test.ts:73`, a 2 s process-group timing
test, on a branch touching only `src/record.ts` + two record tests. That reads as load, but it stays red until it passes on a
quiet box. Stats is not opening the PR before then, which is right.
**A one-deployer-rule gap, self-reported by Stats:** their background retry loop ran two gates at 05:57-06:01Z DURING the
`2d614dc` deploy. The loop polled for the lock in its own logs, but **the lock is enforced by the session hook, which a background
script cannot see.** So any lane's unattended loop can walk straight past the deploy lock, and this is the likely cause of the
timing-test flakes. Fix candidate for the Auditer: a lock FILE (or a `scripts/deploy-lock.mjs --check` exit code) that the hook
and any script both read, so the rule doesn't depend on being inside a Claude turn.

**Why everything is slow (Strategy measured it, ~06:15Z):** one saturated Mac. Load average 76-105 on 10 cores: 34 Chrome,
238 node and 81 python processes, 17 Claude sessions plus the per-Stop audit-review sessions, and the Research Agent Bot project
deploying on the same box. Every lane gate and every deploy row queue up on it. **Two orders, owed to the lanes (not yet sent;
this session's cross-session sends were capped):**
1. **Every lane:** run no `quality:stop` and no browser checks until you have a change to gate. While a deploy is in flight, run
   `tsc` and the fast suite only.
2. **Auditer, this week:** move the release-row matrix (and the lanes' browser gates) to the VPS, `root@49.12.7.18`: 16 cores,
   load ~3 when last measured. That means Playwright installed there and `deploy.sh` dispatching rows over ssh. The one-deployer rule
   stays; only the machine changes. **Cost estimate to Strategy before anyone builds.**
   **PARKED AS POST-BETA (Strategy, ~06:30Z, on Dom's data): the average deploy is under 10 min, so today's 40 min tracks load
   (17-18 live sessions plus audit sessions, and both slow deploys happened exactly then). It is not the norm. The Auditer still
   sends the cost line so Dom knows the price. Nobody builds it during beta. The four pass conditions stay attached for when it
   is picked up.** Today's levers instead: lanes gate only when they have a change; the fast suite only while a deploy is in
   flight; Strategy is asking Dom to close the post-beta sessions and to consider pausing the per-Stop audit hook during the push.
   **Dom approved it in principle ("good idea, who does this?"). Owners, ruled by Strategy:** AUDITER builds it: `deploy.sh`
   dispatching the row matrix over ssh, the row runner on the VPS, and lanes' browser gates able to run there too.
   BACKEND provisions the VPS: node, Playwright + browsers, a repo checkout, the ssh path (key `~/.ssh/binance_futures_tool`).
   DEPLOY validates with one dual run, the same revision on the Mac and the VPS, with identical row results, before adopting it.
   Sequence: the Auditer's cost reaches Lead within the day, Lead forwards it to Strategy in one line, Dom sees the size, then they
   build. **It runs alongside the beta items; it does not jump them.**
   **Four PASS CONDITIONS for the Auditer's brief (Strategy, after Dom asked about downsides). These are gates, not suggestions:**
   (1) **SHA rule:** the VPS never runs a branch checkout or an rsynced tree. `deploy.sh` sends the exact commit sha, the VPS
   fetches that sha from GitHub and checks it out detached, and every row receipt is stamped with it. The deploy REFUSES if any
   receipt sha differs from the sha being published.
   (2) **Dual-run gate:** the same revision on the Mac and the VPS, every row compared. Linux Chromium renders differently (fonts,
   GPU, WebGL), so any row whose result differs gets either a re-baseline with its reason, or a fixed viewport plus the
   software-render flag, before the switch. No silent threshold changes.
   (3) **Perf rows:** CPU-throttle numbers are not comparable across machines. World's phone-tier rows either stay on the Mac or
   are re-baselined and labelled VPS; they are never mixed with older numbers.
   (4) **Isolation:** rows run in their own directory with the repo's pinned node/Playwright versions and never touch the served
   build on the same VPS.

**Review rule for every PR from here (Lead's, before Deploy merges):** a combined-tree receipt on any PR touching a file another
open PR touches, row receipts, and a rejected-designs paragraph wherever a design choice was made.

## Lead handoff — 2026-09-23 00:30 (context restart)
**Now.** **Live is `fe0d8e0`** (Deploy's receipt: 33/33 rows, 0 failed, `release.json` 200 at that sha, served `index.html`
`cmp`-identical to dist, `guard.glb` absent from a cold load's seven `.glb` requests, box FREE at 23:30). It carries #467,
#466, #465, #464, #462, #461, #485, #477 and #497 plus state docs. **The ~30-PR batch after it is NOT started and is not
authorised by anyone currently awake** — Deploy paused it and is checking scope with its own user, which I have backed. Do not
treat the relayed order as standing permission: it came through a session that has since cleared and parts of it are already
stale (it still says "publish cb8ff5b", superseded). Nothing of mine is mid-flight. The merge queue is no longer Lead's — Dom moved it to Deploy tonight, and Strategy
has briefed the lanes directly with deadlines while this session clears, reverting to lanes -> Lead afterwards. Two of my
PRs are open and unmerged: **#499** (AGENTS.md, the outline-not-build briefing standard) and the state doc you are reading.

**Done tonight.**
- **#471** amended twice. `f6af593`: the brief said cleaver in three places and rested "zero new animation authoring" on the
  Pitborn's `Cleaver_*` set, which the bearded-axe amendment removes — it was understating its own cost. `099c24d`: new §5a
  naming her six takeable pieces against direction A, with `Helmet` and `Gloves` recorded as **open proposals awaiting Dom**
  because A is bare-headed and bare-handed. Pitborn and the Executioner lane both flagged the cleaver independently.
- **#499**, new AGENTS.md bullet, corrected three times as the lanes measured it properly. Character briefs specify
  **outline, not build**; an approved reference is a **direction, not a render**; every brief **names all six** takeable
  pieces (naming is not authoring — build order stays Recruit-2 first, and SCOPE.md's launch bar already says the six are
  scheduled, not optional). Plus the two measurement rules the lanes paid for: a background gate certifies the backdrop and
  **not the cut** (cut the mask from an unlit plate, `--flat`, #500), and **never upscale a short mask** to the comparison
  height — that invents edge detail on one side of the pair only, a bias rather than noise.
- Rulings taken: the **estoc's brief does not change** (thrust recovery is not a lever; the trident row goes to Combat as a
  Nightborn-profile item); **Stats' PR B carries the single bump to 6**, Weapons rides it, rule is whoever is ready first;
  **Greaves before Helmet**; the **paperdoll keeps `ATK 0 · RES 0`** on a bare fighter; the **opponent -> tier mapping is
  Multi Chars'**, the resolver is Stats', a piece with no tier resolves to exactly 1.00.
- Owner briefs sent to every active lane and the per-item owner/next-PR/ETA lines returned to Strategy.

**Open.**
- **Brief 14 is mine and barely started.** `src/grades.ts` already exists on trunk and already declares
  `GradeRecord = { level, tier, kit: LootId[], epithet, house }` at :74 — the remaining work is adding `profile?: GradeProfile`
  to it and `grade?` to the `ROSTER` recipes. Combat owns `GradeProfile`'s values: perception is **not** a new axis, it scales
  the existing `profile.reaction` in absolute ticks, and `anticipate` must stay because `ai.ts:114` clamps the spam read to
  `READ.anticipate` (8), so any per-grade `reaction` above 8 is swallowed on exactly the cleaver row. Combat's cleaver PR is
  gated on this.
  **BLOCKER found 2026-09-23 03:xx, after the draft above went to Combat: `grade?: GradeRecord` CANNOT go on `ROSTER`.**
  `src/roster.ts` is a simulation module (`SIM` in `eslint.config.js`) and `tests/sim-boundary.test.ts` allows SIM files to import
  only each other — its regex catches `import type ... from` too, so even a type-only import of `./grades.ts` fails. Multi Chars
  hit the same boundary on #510 from a placement Strategy specified, which is how this surfaced. So the field belongs in a
  non-SIM module keyed by `OpponentId` — `grades.ts` itself is the natural home, since it already owns `GradeRecord` and already
  imports `career.ts` and `loot.ts`. Combat has been told; the shape of `GradeProfile` is unaffected.
- **#419 (estoc) waits on a Nightborn-profile item in Combat's lane, NOT on Combat's ai.ts seam fix.** Weapons reproduced the
  kicker hover exactly and then showed it cannot apply to the Nightborn: `guardShare = profile.guard ?? 1` gates it, and
  `guard: 0` occurs in exactly one opponent's three profiles (`src/moves.ts:503-505`, the guardless goblin). The Nightborn's
  `guard:` is the directional-guard object, a different key, so his share defaults to 1 and `hover` is 0. The estoc hold is a
  product decision — accept the trident row and resolve the flip test's membership pair, or change the Nightborn's profile.
  The seam fix does have a second customer Combat may not have counted: the `knife vs goblin hard: kick only` 3/24 row, whose
  mechanism is that same 1.45 m park.
- **#446 CI cost: DONE by the Auditer lane as #507 (`quality/ci-skip-docs`), reported READY to Strategy** — zero-row diffs skip the matrix and the browser gates behind one green "release rows (none for this diff)" job, per-PR concurrency, cancel-on-close. It was unstarted on me; do not pick it up. Original statement of the problem: the workflow runs the full release matrix on docs-only pushes and keeps runs
  queued for closed PRs, starving trunk's own run. Fix is to skip the matrix when `release-rows-for.mjs` returns zero rows and
  cancel in-progress runs on PR close. `gh run cancel` on queued runs mostly does not take.
- **#490 (Brief 18, the Plague Doctor) is unowned.** The Executioner lane correctly refused it — Dom widened them to the
  Knight only. Strategy to place it.
- **The bare Knight reads as nobody** (Executioner, #502): shoulder/height 0.367 in kit to 0.246 stripped, and none of the
  bare outline is his. Open proposal for Dom: one non-takeable silhouette feature in the bare build.
- **CLOSED, not open — the stripped-identity question was dissolved by Strategy, and correctly.** I had escalated it as a
  binary for Dom (identity moves onto the body, or the brief says stripped means generic). Both horns assumed a stripped state
  exists in the game; none does. Take-one removes at most one piece per kill, the opponent respawns kitted, and a grade is a
  MATERIAL variant on a shared mesh, not a different mesh (`src/grades.ts` states this as its premise) — so a Recruit's scrap
  Body piece carries the same outline as the Origin one. Ruling: **the gate is in-kit at every rung; the bare pass is
  informational, recorded beside the in-kit number, never a bar.** Every launch character's Recruit-2 are her two
  identity-carrying slots (Knight, Plague Doctor, Witch: Helmet + Body; Shieldmaiden A: Body + Helmet). A body-level identity
  feature is a per-character taste call for the owner, not a rule. The two failures the Executioner and Pitborn lanes measured
  were real and the measurement stands — the bar was wrong, not the finding. My §6 gate-satisfied ruling is consistent with
  this and stands; that lane builds.
- **Strategy's session ended, so its open decisions came back to Lead.** Ruled: the `unscale: "goblin"` build failure is its own
  small PR before Boots — `scripts/build-warrior.mjs` throws `loot: no proportion table for goblin` because only the dwarf is
  registered, so it is a build fix rather than kit work and should not ride inside a kit PR. Also live: Stats imports from
  `src/grades.ts`, never `src/roster.ts` (same SIM boundary as above); the boots cost line is a bounded range labelled a floor,
  not a single number; and the kit library's rule that a shaft is pinned by FRACTION of calf length, never absolute height
  (the Goblin lane measured girth identical at matched fractions but the same fraction sitting 36.4 mm lower at 50 %), which
  bites Greaves harder than Boots and goes in the Greaves PR.
- **Licensing, and the one item on this list with an outside-the-repo consequence: #511 (Audio, draft).** Two sprite slots were
  playing non-CC0 recordings on a shipped build — parry variants 0-2 and `HITS[0]`. Strategy's ruling before its session ended:
  a licence that forbids redistribution cannot be credited-and-accepted, so re-source rather than attribute. Both are replaced
  with CC0 or original material and the sprite now needs public CC0 URLs only. **It is a draft on purpose** — Dom picked both
  departing clips by ear and has not heard the replacements; audition WAVs are with him. Flip on his word. Scope is exactly
  those two slots: `block`/`block_perfect` are an original voicing MEASURED FROM the departing clip, and a measurement is not
  the recording, so the guard cues never carried the risk whatever the older README implies.
- Mine also: the SCOPE.md broadcast to the lanes once #492 lands.

**Gotchas.**
- **Check the file before writing the type.** I drafted a `grade` type and sent it to Combat without opening `src/grades.ts`.
  It already existed, `Grade` was already taken there for the material triple, and my draft would not have compiled.
- **`OPPONENTS` at `src/moves.ts:513` is DERIVED from `ROSTER`.** Adding `grade` there type-checks and never reaches the
  recipes. `grades.ts:19`'s own comment says `OPPONENTS.grade.house`, so the wrong name is already on trunk.
- **A unit rule is not a sign rule.** Addendum C's "whole points" means integers, never `1.15`; Brief 19:49's signed delta
  stands. Paperdoll totals unsigned, kill-screen take signed. I relayed the addendum as superseding the sign and two lanes
  built to it.
- **Relayed premises cost more than they save.** Four lanes corrected me tonight — Combat (the knife is next, not the
  cleaver, and #419 does not sequence them), Character Main (scope is `warrior.glb` only; I mis-routed three items),
  Weapons (the >=2 margin was already met; rebasing buys nothing, empty sim diff across 22 commits), Web (#475 draws no
  number at all). Each was a claim I passed on without opening the file.
- **A valid background is not a valid mask, and a measured number can still measure the wrong thing.** The hole figure went
  20,677 px -> 9,644 -> **6,973 (3.5 % of the mask)** as two lanes checked each other; the first counted the figure's own
  negative space as a defect. Ask what the number was measured against.
- **The 80 % coverage rule is not a silhouette measure.** `tests/loot.test.ts` compares the loot draw's mesh surface area in
  m² against the PLAYER's own draws in that slot; it is a test that runs when the draw exists, not something checkable from a
  reference or a mask. I instructed a lane to measure it off a mask, and #471 §5a asserted the hauberk "clears comfortably —
  but it is measured, not asserted" when nothing had been measured. Fixed at `06eaec3`.
- **Every silhouette figure published before 2026-09-23 is withdrawn, in both directions.** Thresholded silhouettes fuse an arm
  into the torso where a hand rests on a thigh, polished plate sits at the backdrop's own luminance, and one lane's bare panels
  were rendered with the arms held out. Corrected off u2net mattes: three men inside 0.014, candidates 0.043 apart. Quote these.
- A branch checked out in another worktree cannot be checked out here. Commit via `hash-object`/`commit-tree` and push the
  sha, rather than reaching into that worktree.

## Lead handoff — 2026-09-22 17:45 (restart)
**Now.** Live == trunk == c7d942a, empty deploy queue (Deploy's receipt: 33/33, DEPLOY_EXIT=0, 17:40). Nothing of mine mid-flight.

**Done since the 16:25 entry.** Merged #431 #432 #433 #434 #436 #437 #438 #441 #442 #443 #445. Two live owner fixes shipped: the kill-link screen (PLAY NOW, no whole-fight button, no raw banner) and the kill-screen loot panel with its action row out of the thumb zone. Also: hits −25 % measured properly (the bus compressor was eating the cuts), the Pitborn sash out of LOOT with a coverage rule that fails any `replace` piece under 80 % of what it hides, the grade material table, and a CI guard that fails any sim change without a RECORD_VERSION bump.

**Reverted.** #435 (lorarii wearing guard.glb) — merged on its four PR jobs, broke 9 release rows at deploy because the model was fetched on the boot path. Reverted as #442. Owner has since overruled "capsules on the phone tier": the models ship, the roster check is taught that guard.glb is an arena asset (its size governed by the existing `guard` budget row, 231,620 B packed), loading still deferred past first paint. World re-lands.

**Open.** World: lorarii re-land. Auditer: the match-session split (move-only into src/match.ts, Career/Daily/Replay/Practice, reward-rule table test) and #446, the file→release-row CI job — ruled: curated boot-path subset (rows 02, 29, 31, one finisher-preview, 13–14), not all 30. Weapons: remaining flips batched behind ONE RECORD_VERSION bump. Gore: blood-conform re-land. Mine: Brief 14 grade record on OPPONENTS — `grade: { level, tier, kit, epithet, house, profile? }`, type owned by src/grades.ts, offer derived from it, "never less dressed than base" as the last guard.

**Gotchas added today.** The four PR gate jobs do not include the release matrix — for boot-path changes, run row 02 locally before merging. Memory is keyed by folder: verify the key resolves to the worktree you restart in, copy never move. A background publish script needs `set -euo pipefail` and a non-empty sha check. Batch git/gh/curl reads: each command re-reads the whole session context.

## Lead handoff — 2026-09-22 16:25 (context restart, Strategy rule v3)
**Now.** Nothing of mine is mid-flight. Deploys were blocked all afternoon because every deploy of trunk failed quiet-one rows 16/21/26;
#432 fixed that at the source and is merged, and the deploy session has a watcher that publishes the trunk tip on its own. Live was
adb8ddd at 16:07 (my curl); trunk is 632dbbf.

**Done today (this stretch, all merged on the gate: quality + base + both browser jobs SUCCESS, zero red).** #417 #422 #423 audio levels;
#421 migration 0010 (guest-share hygiene, applied and verified live: cron job active, share_limits unreadable, guest_key outside the
select grant, 30-day retention); #418 loot v2 armour draws; #425 regenerated loot layers; #415 paperdoll wears the gear; #420 glass
combat buttons; #424 endgame-HUD gate made deterministic; #426 PLAY NOW on a shared fight + tests/record-version-guard.test.ts; #428 the
arena guard model; #427 the kill-screen Take-one panel; #429 estoc-parked docs; #430 lorarii capsules; #432 loot action row into
`#actions`; #433 hit gains .3; #431 cleaver docs.

**Open.** #434 (Multi Chars: pitborn.Body dropped + rebuilt loot.glb + executed coverage test) and #435 (Visuals: the lorarii wear
guard.glb) — both mine to merge on green. Finishers & Gore are on the blood-conform branch (marks measured 0.4–0.5 cm proud, down from
0.9–5.8 cm; two open faults stated honestly: Nightborn cape MISS frames, one head-slot mark). Brief 14 is mine to start: the grade record
on `OPPONENTS` — `grade: { level, tier, kit, epithet, house, profile? }` — with the kill-screen offer derived from it (Dom 16:00), and the
"never less dressed than base" guard as the last line regardless of data.

**Gotchas.**
- The merge gate is mine, not CI's: `MERGEABLE, red=0` only means no conflict and nothing failed *yet*. Wait for all four jobs.
- A failing check may be reporting a real defect. I told Deploy to teach the quiet-one check around the loot panel's tap; Web design was
  right that the panel's buttons sat where the first post-kill touch lands, so a player stopping the arena tour would decline their loot
  by accident. Reverse fast and say so.
- Parking a PR parks its documentation with it: Weapons' estoc write-up lived inside a draft PR and never reached trunk. Findings go in
  their own docs PR off trunk (#429, #431).
- A green suite is not a safe number (estoc close 1.19-1.21 passed both axes by tie-break) and a green perf run may have measured the
  wrong thing (Visuals' first frame-times never fetched guard.glb). Ask what the number was measured against.
- Hosted migrations apply on an explicit "apply NNNN" relay, never on a merge event (Deploy's rule since 0010).

## Beta plan v3 lead stack — 2026-09-21/22 (owner: "go do it - always listen to the strategy dev")
Built as one stack, each PR on the last, merged to trunk in order by the deploy session: #321 blade seam (`bladePathsByRig[rig][weapon][kind]`,
`RigId` on every ROSTER entry, strict lookup); #323 warhammer as the second player weapon (`PLAYER_WEAPONS_OFFERED`); #324 short kill
links (`fight_records` table + `/?r=<id>` route, record v2 carries the weapon; #326's refused-version test moved to version 9 and the
replay fixtures re-recorded with `weapon` in META); #325 autopsy wiring (src/autopsy.ts cause/habit lines on the death screen and under
the journal row); #327 daily warden (src/daily.ts: `daily_fight()` seed, one attempt per UTC day, board in the journal; migration 0003
with pgcrypto created in the file, Backend's future-day guard + column-limited select via #354); #330 loot data (src/loot.ts LOOT table
incl. the Goblin's two pieces, drop per opponent per career sub-rank, owned/equipped/taken provenance on the profile and the cloud row,
migration 0004; Backend's RLS coverage #355 with the check pinned to UTC); #342 account autosave (no Save/Load buttons, every profile
persist fires `frankendom:profile` and the account module syncs; "Signed in · saved to your account"); #349 loot on the rig and in the
journal (characters.ts `loadLoot` + actor `wear`: each loot.glb piece bound to the player's skeleton with his Body draw's bindMatrix,
`replace` pieces hide his own slot draws, a helmet hides hair, palette materials take his textured one by name; scene.ts fetches
loot.glb only once the rigs are in and the worn set is non-empty, readiness never waits; main.ts fills the paperdoll slots and the
five-tile rack in Web design's brief-9 row shape, Wear / Store under the drop line). Evidence per PR in its body: quality:stop, the
harness (tests/graphics.test.ts, whose seeded profile id is now valid), tests/loot-wear.test.ts on the shipped GLBs, a Playwright probe
of the built tree (fight ready before the loot response). Also this night: #332 kill-link gate row; #368 jpegtran via a temp file with
a 60 s kill (deploy #71's hour-long wedge); #371 re-landed Combat's reach fix on trunk after #358 had merged into its lead base branch.
Open on the lead: deterministic trig in the sim (arm64/x64 digest drift, root-caused), "Daily #n" display +1, docs for #257–#324 in
this file, `quality.yml` counter gate still `required: false`.

## Release check 9 (polearm-browser-check) became checks 9–12; everything after renumbered +3 — 2026-09-21
Lead's deploy-speed ask: check 9 failed on ubuntu-latest on wall-clock waits. `scripts/polearm-browser-check.mjs` now boots on real
time and then owns page time through `scripts/lib/harness-clock.mjs` (walk-in, orbit settle, fight frames and both predicates advance
by `run()`/`until()`); no assertion dropped; needs the frame-clock resync (#265) or the sim froze under `page.clock`. Runner receipts:
1704 s serial (run 35537212537, cancelled by the 30-min job cap during upload), 1595 s with the two opponents side by side (run
35542553950; receipt wallMs desktop 1099/1144 s for 397/398 frames, phone 403/448 s for 315 — the GPU process serialises pages, so
parallelism was removed again). A view is 315–400 fixed-step frames at ~1.2–1.4 s each on software GL; 945 of the 1,424 frames sit
between "Draw sword" and the warden's first polearm clip (game behaviour, not the harness). So `.quality-gate.json` lists the check
once per view — `--opponents executioner|veteran --screens desktop|phone`, checks 9–12 — and every later release check index moved
+3 (deploy notes, runner-v2 duration ordering and `ci-trusted-checks.mjs` are index-keyed; trust is per exact sha, so it self-heals).
A narrowed run writes `receipt-<opponent>-<screen>.json`; the receipt carries `deviceScaleFactor`, `wallMs` and per-frame `pageMs`
(CI renders receipts at DPR 1, `HARNESS_DPR` overrides; pixels were not the cost). PR #267.

## Arena cam after the kill — lead implementation, 2026-09-20 (owner: "after 5 seconds it does the different angles, views")
camera.ts `TOUR`: five seconds after a finish begins (the finisher's push-in and side reveal have settled) the rig drifts — a slow orbit
around the fallen (one lap per 40 s) that breathes in and out (5.2 ± 1.3 m) and rises toward a wider view (1.6 → 3.2 m; lower on the
player's own death), looking at the fallen (corpse–head midpoint after a decapitation), blended in over 3 s from wherever the camera
stands so there is no jump, clamped to the colonnade, looping until Rematch. Never a cut. A touch on the arena (`canvas` pointerdown →
`view.stopTour()`) hands the camera back for that finish; a rematch forgets the stop. No tour on a draw or under reduced motion.
Tuning is the Visuals and World lane's from here (path, timings in `TOUR`). Evidence: tests/camera.test.ts arena-cam test (orbit rate,
no-cut, breathing/rising bounds, look, lower on a loss, touch stop, draw/still hold, rematch reset, edge clamp); 332 tests, eslint src.

## Strike circle retired — lead implementation, 2026-09-20 (owner: "I tried both and prefer buttons"; one grammar = every control feature built and tested once)
The thumb cluster is the one touch layout. Gone: the v8 strike circle (input.ts ring8 handlers, `gestures.ts` + its test), the
Controls chip in the journal Settings tab and its scheme cycling in main.ts, the `ring8` HUD relabelling, the `data-gestures=ring8`
CSS block (the cluster block stays; index.html carries `data-gestures="cluster"` statically). trial.ts keeps one tally instead of a
per-scheme card (`frankendom.controls.v1` migrates: an old `{ scheme, card: { cluster, ring8 } }` loads as its cluster tally, the
ring's numbers are dropped); the AFK marker `frankendom.fight.v1` is `{ opponent }` only. browser-check no longer cycles Controls:
one `layoutClean('cluster')` pass (44 px targets, no overlaps) at both phone sizes. Directional guard (five sides, owner 2026-09-20)
is built on the buttons next. Evidence: 327 tests, eslint src, build + budget PASS; CI browser gate on the PR.

## Tabbed Field Journal wiring — lead implementation, 2026-09-20 (owner: "get it live")
On top of the design lane's markup/CSS (529bb6d, rebased onto trunk): the blood toggle is gone — `#blood-mode` button removed, its
red/dark/off cycling removed from main.ts, gore always on (the renderer keeps `BloodMode` for a later setting); hit-stop chip sits in
the Arena tab (design's markup, no JS change); test tools stay visible under Settings. Gates learned the tabs: browser-check and
quiet-one click `label[for=journal-tab-settings]` before #controls-mode / #finisher-select, roster-browser-check clicks
`label[for=journal-tab-arena]` before #opponent-select; browser-check's blood-mode cycle and quiet-one's dark/off cycling under
--blood-check are retired (the finisher's own blood assertions still run). Evidence recorded in PR #228.

## Browser gates on a harness clock, in CI — lead implementation, 2026-09-20 (owner: "do this please, it's important")
`scripts/lib/harness-clock.mjs`: after boot the gate installs Playwright's page.clock (paused) and advances page time 16 ms per frame;
`browser-check.mjs` and `counter-browser-check.mjs` replaced every wall-clock wait (parry 430 ms after the tell, riposte 350 ms,
kick reach, journal pause) with harness-time waits; the damage float (900 ms on the real animation timeline) is recorded by an
observer as it appears. Assertions and the game are unchanged. Proof on the GPU-less VPS build box (root@49.12.7.18,
/opt/frankendom-build, Node 22, load ~1) where the old gate failed at the riposte: combat gate passed (guard 440 ms after the
tell, parry, riposte 24, dmg "24", kick completed, controls cycle, no-WebGL fallback), counter gate passed (24/24/30).
`.github/workflows/quality.yml` gains a `browser` job running both gates on every PR/push to trunk. Still on deploy.sh only:
the other release checks (roster, estoc, polearm, quiet-one, account, creature…) until each moves onto the harness clock.

## Beta scorecard — lead implementation, 2026-09-20 (owner: "yes do it")
`src/scorecard.ts`: fights, wins, losses per opponent, saved on this device (`frankendom.scorecard.v1`); "left" counts inside
losses — the AFK catch-up death and the closed-page loss (the `frankendom.fight.v1` marker now carries the opponent id) are
losses flagged left; a draw is a fight only. The journal shows a table (`#scorecard-table`: one row per offered rung + "All
fights"; losses read "2 (1 left)" when walk-aways happened); the per-scheme control-trial dump stays but only under the debug
toggle. Device-local for the beta; a later pass can sync it with the account like career marks.
Evidence: tsc + eslint clean; scorecard unit tests; graphics harness (AFK death → veteran row 1/0/1 left 1; stale marker →
goblin row at boot; rendered table rows checked); harness Element now mirrors DOM `append(...)`/`replaceChildren`. Browser
gate left to CI per the one-deployer rule (deploy #13 in flight).

## Opponent picker shows live rungs only — lead implementation, 2026-09-20 (owner)
The journal's opponent picker is built from `LADDER` (held recipes filtered out) instead of every `ENCOUNTERS` entry greyed as
"(on hold)": Minotaur, Wraith, Werewolf and Skeleton no longer appear in the beta menu at all (they stay valid ids, so saved
encounters still fall back). The beta list is Veteran, Pitborn, Goblin, Nightborn, Executioner, Dwarf. Roles as of today: the
former lead is the deploy/GitHub/CI dev; this lane is lead implementation (features, integration, add/remove); character dev
builds bodies; the design/web dev designs only and hands designs to implementation.
Evidence: tsc + eslint clean; graphics/roster/ladder tests 37/37 (picker test updated); build + audit 0 + budget PASS
(20,820,778 gzip of 32 MB, per fight 8,821,562 of 12 MB with the Dwarf). Full `npm test` and `test:browser` deferred until the
deploy dev posts FREE (load-gated deploy in progress); receipts go on the PR.

## Ordered lead cleanup — 2026-09-19 (PR #171)
Owner requested readability, existing-recipe cleanup, obsolete QA retirement, then reliability/product gaps.
The main/scene TypeScript syntax trees and parsed CSS rules were preserved while unpacking dense formatting.
Input/audio tests retain their behavioral requirements across formatting; missing-event and touch-rule mutations fail.
Equipment defaults now live in appearance presets; Veteran/Executioner rebuilds are byte-identical to baseline.
Retired the rejected procedural pilot generator/check (508 source lines). Actual shipped-creature integrity and
browser gates remain, including both rigs and 250 sampled poses.

Startup now preserves the original renderer exception and stack while retaining the friendly fallback. The regression
fails before the change and passes after it; actual Chromium with WebGL disabled verifies the original error and disabled
combat. Audio e867 is integrated, including Draw-only bell behavior. All 24 configured commands passed on 17218e6:
291 tests, typecheck/lint/audit, gameplay/recovery/layout, finishers, account/database, audio and creature checks.
Independent clean Node 22 and real PostgreSQL checks also pass. The subsequent review-record edits were documentation/comments only.
The final pre-merge check then found published weapons revision 68ccdf2. It is integrated with its new creature-weapon
pose gate retained; the combined 25-command contract is revalidated before publication. Release-window coordination
is explicit in AGENTS.md so every active lane is included before the lead reserves the shared GPU/release window.
Deployment and public verification receipts are maintained under artifacts/cleanup/ and PR #171; served release.json
identifies the published revision. GitHub's hosted job was billing-blocked before start; it is not reported green.

The owner permits up to 12 MB per fight when needed; the separate 32 MB distribution cap is unchanged.
Release-specific Sentry triage and remaining acceptance: docs/reliability-audit.md. Physical-phone and external-player
validation remain unpassed. Career practice-win award policy awaits owner confirmation; no rank ledger or end-game
system was added. The shared automatic hook's 420-second ceiling is shorter than this 1,111-second full suite;
all commands were run directly without deleting checks or altering shared enforcement.

## Google account integration — lead, 2026-09-19 (live e5339e9, PR #152)
Owner requested Google login/Supabase with controls inside Field Journal. Added a lazy account SDK, PKCE login,
explicit cloud save/load of name and practice opponent, session sign-out, revision conflict checks and owner-only RLS.
Sign-in never overwrites device/cloud data; explicit load restarts practice. Career marks/results remain outside this
client-editable table. No combat, renderer or input code changed. Details/setup: docs/account-integration.md.

Integrated evidence at 30b5e48 (trunk 714e969): npm run quality passed 263/263, lint/typecheck/build/audit/budget
and gameplay browser; all nine additional completion commands passed. CI 35436347273 passed. Enabled account build:
8,486,798 bytes gzip per fight / 10 MB. Account browser uses controlled provider responses with the real SDK;
it does not prove live Google configuration. Screenshots/logs/receipts: artifacts/account/integrated-{0..9}.log,
browser-receipt.json, mobile-guest.png, mobile-signed-in.png and desktop-menu.png. Runtime addition: 161 lines.

Dedicated free project rxbewmzmovelckzoosss created by owner in Mumbai. Applied the checked-in migration via psql
with TLSv1.3 and verify-full using the official Supabase CA. Hosted transaction tested both users' own save/read,
cross-user read/write denial, anonymous denial, immutable ownership/revision, stale saves and constraints;
rolled back both test users and saves (zero profile rows remain). Receipt: artifacts/account/hosted-rls-receipt.txt.
Hosted site URL and exact /?account=return redirect saved and verified in dashboard. Public REST read without a user
session returns 401/42501 as intended. Ignored public production configuration and exact-origin CSP are prepared;
The exact Supabase origin is now installed in the Frankendom nginx CSP (backup retained); nginx -t and public header checks pass.

Failure ledger: F1 callback fixture wrote its PKCE verifier without SDK JSON encoding; corrected fixture and reruns pass.
F2 logout-failure test expected a retained session; verified current SDK deliberately clears local credentials even when
remote revoke fails. Corrected regression requires cleared tokens/cloud controls and failed-read retry; passes.
F3 world integration documentation conflict resolved preserving both lanes; combined quality and CI pass.
F4 Safari multiline SQL entry was unreliable; nothing executed, switched to exact-file psql migration.
F5 system CA rejected the pooler certificate; official dashboard CA with verify-full fixed it (TLS not weakened).
F6 focused test was invoked with absent tsx loader; corrected to this repo's native node --test runner: 3/3 pass.
F7 / review F1: adding the exact Supabase CSP origin in 51597f8 invalidated the old three-source monitoring
assertion. Its local/CI failure supersedes the earlier runtime pass for that revision. Updated the test to pin all four
sources exactly (self, blob, the specific Sentry and Supabase origins); added the configured release success case.
Focused monitoring/config checks pass 4/4. Full contract rerun logs: artifacts/account/review-f1/{0..9}.log;
check the latest PR152 CI before integration. No wildcard, assertion removal or runtime behavior change.
Two-pass review covered ownership/concurrency/retry and mobile/desktop placement/guest startup. No new background task.

Activation: owner approved Google credential creation. Dedicated Google project principal-zoo-509110-v0 has a web
OAuth client with frankendom.com origin and https://rxbewmzmovelckzoosss.supabase.co/auth/v1/callback. Secret saved
only in Supabase; public settings confirms Google enabled. Email/password provider disabled. Public privacy page
added at /privacy.html and linked inside the journal. Google is In production with only OpenID/email/profile scopes.
Production CSP and all public assets were verified on live e5339e9. PR #152 merged after exact-head and merge CI;
all 12 configured commands and deployment quality passed (269 tests). Actual Safari Google sign-in, save, reload,
cloud restore and sign-out passed against the real services. Phone-size guest menu checks passed; physical-phone
login and separate-device recovery remain unmeasured. Authoritative receipt: lead checkout
`artifacts/account/live/RECEIPT.md` and PR #152 body. These supersede the earlier activation-pending notes.
Calibre untouched.

## Season 1 scope and material cleanup — lead, 2026-09-19
Owner chose Recruit → Origin as the complete Season 1 core, with the RPG endgame built after launch. Canonical scope is
in GAME_SPEC.md; docs/progression-direction.md records future choices, persistence/result boundaries, migrations,
release checks and lane ownership. No stat rebalance, build allocation, inventory, purchases or backend is implemented
by this change. Recoverable identity/career persistence and physical/external-player gates still precede a progression launch.

Code-quality review: the earlier roster foundation already fixed scattered weapon defaults and health reporting. This
pass moves repeated warrior material values into one offline palette, preserving existing appearance and the Executioner's
matte overrides. Broad main/input splitting and a new item framework were rejected as churn without a current requirement.
All six fighters' four material constructors and final material GLB output compare byte-for-byte with the pre-change code,
both with and without authored maps (12 cases). This is material-pipeline equivalence, not a full geometry rebuild.
Source art needed for a complete UAL2 rebuild is absent in the lead source directory; shipped GLBs remain unchanged.
Local validation at the initial base: npm run quality passed (250 tests, lint/typecheck/build/audit, budget and browser);
roster and Split Crown completion checks passed. Evidence: artifacts/lead-quality/. Lead reported integrated 251/251 full quality and roster/Split Crown/estoc/counter completion gates PASS; #148 CI passed and merged as 0c7b03f. Included in the world lane combined release; live receipts pending in artifacts/world/polish-notes.
Two-pass review: preset identity/isolation and unchanged simulation/input; then authored-map precedence, dye retention,
matte overrides and browser/render/persistence gates. No new runtime dependency or module added.

## Roster foundations — lead, 2026-09-19
Owner approved the GPT Pro content-reuse direction. Work on `lead/opponent-catalogue`, based on d383b66.
One typed recipe catalogue supplies identities, bodies, archetype references and weapon defaults. All five serialized combat definitions deep-equal the pre-change baseline; combat, timings, rigs and introductory order are preserved. Executioner default build resolves to scythe; shelved estoc still resolves to its shipped sword until the weapons lane activates it.
Encounter selection is separate from optional career marks. Existing guest ID/name and legacy opponent rung survive migration; saves retain a legacy alias for safe rollback. No marks are awarded and no server persistence/recovery is claimed. Scorecard now uses actual fighter health ceilings.
Ownership and the two-opponent/six-opponent sequence: docs/roster-pipeline.md. Estoc PR #142 and Run Through alignment remain their lanes' work, not included here.

Current-task verification ledger:
- F1: camera tests rejected the initial Vite-only asset glob. Replaced with Node-compatible URL construction; camera 3/3 pass.
- F2: graphics harness lacked the new real catalogue module. Wired it into the harness without changing assertions; 27/27 pass.
- F3: shared browser gate confused enemy kick HUD text with the player's kick. Actor/target events and exact HP reconciliation replace the 335 ms text guess. Enemy counters alone cannot pass; bounded attempts require an accepted, completed player kick. Full quality browser run passed with actor 0 AttackStarted → AttackMissed, no page errors; repeated/public verification pending.
- F4: new roster browser harness initially used the software headless-shell path and stalled; stopped only that owned browser and matched the shared gate's real Chromium executable. Corrected roster browser rerun passed all five opponents, two rigs per route, save migration and zero page errors.
- Focused catalogue/profile/ladder/scorecard: 12/12 pass; rollback migration separately 5/5. Full final npm run quality passed: 248/248, lint/typecheck/build/audit and browser; 8,361,205-byte per-fight budget. Release receipts pending.
- Sentry inspected: FRANKENDOM-A is an unresolved texture failure on old release 9587019 (2026-09-18); current catalogue checks do not prove that historic issue fixed. Load/GPU issues stay open. Hardware/external-player gates unchanged.

## Rename: Origins Arena — 2026-09-17 (lead, owner's call)
The owner named the place **Origins Arena** (the world lane's three proposals — The Ashpit · Worldsedge · The Bonehollow — are
declined; REQUESTS #1 closed). *Ashcourt / The Old Keep* is retired everywhere player-facing: the place block reads
THE PROVING GROUND / Origins Arena (the eyebrow inherits the retired brand subtitle), the HUD opponent is ARENA WARDEN
(mobile label "Warden" unchanged; ladder rungs still override dynamically), the brand line and `<title>` carry the locked
game title **Frankendom: Origins**, and the stale "courtyard" strings ("Enter the arena", the WebGL fallback and recovery
messages, the loading line, the noscript) now say arena — the browser gate's two matching references and the audio
reverb's comment/function name (`courtyard` → `arena`, the impulse itself unchanged) moved with them. No runtime,
asset or behaviour change beyond strings. Gate + browser gate green on the branch.

## Arena seam for the world lane — 2026-09-17 (lead)
The courtyard moved out of `scene.ts` into `src/arena.ts` behind `buildArena(scene)`; `scene.ts` keeps lights, fog, tone
mapping, camera, the fighters, the target marker (its brass is the threat tell and is no longer shared with the banners) and
effects. `arena.update(dt, events)` runs each frame (0 dt while frozen) so the lane can hang crowd/banner reactions on the
event stream; `arena.dispose()` removes it. `tests/arena.test.ts` is the contract: play radius = sim RADIUS, no vertex above
the floor inside the play circle, no vertex between 0.5 and 6 m inside the camera clamp (11.5 m), a boundary ring at the
play radius, update/dispose, and a cost baseline (263 meshes = draw calls before merging, 4,424 triangles) — mutations
placing a pillar in the circle or moving the bays to 11 m are caught. Visual no-op proven at a static settled state:
0.00 % pixels changed portrait and landscape (artifacts/camera-ab, ignored); the fight-moment capture differs only by camera
settle timing. Gate 197/197 + browser gate passed. CI (`.github/workflows/quality.yml`, quality:ci on push/PR to trunk) was
added earlier today by another session (477f2c3) and is green. Brief handed to the owner for the world lane.

## Opponent ladder — 2026-09-16 (lead/shell)
Veteran → Pitborn. `src/ladder.ts` (LADDER order, `opponentFor`, `won`, `nextAfter`); the device profile gains an optional validated
`ladder` rung; `main.ts` picks the opponent from the rung (URL `?opponent=` still overrides for the harness), labels the HUD for a
non-Veteran, and after a clean win the Rematch button reads "Next: the Pitborn" — pressing it saves the rung and reloads so the next
rig loads; a loss or draw keeps the rung and offers a rematch (recorded as before). Goblin and Nightborn append to LADDER when they land.
Evidence: 182/182 gate; a draw-counts-as-win mutation caught; real-browser check (artifacts/ladder-check.mjs, ignored): fresh device
= ASHCOURT WARDEN/150, rung=pitborn = THE PITBORN/190 on his rig, a loss = "Rematch" with the rung kept, no page errors. The win→Next
→reload path is covered by the pure rules and the shell wiring, not by a scripted real-browser win. Harness note: the graphics
harness's default profile id 'test' fails the profile's 8-char rule and always boots a fresh guest; tests that need saved state pass a
valid id.

## Origins direction recorded in GAME_SPEC — 2026-09-15
Docs-only. GAME_SPEC.md now carries the owner-locked title (Frankendom: Origins), setting line, pitch, simplicity rule, art direction with the materials rule (retiring the ESO/Black Desert references), Origins list, opponent roster order, collection loops, five-stat model, locational deaths and NOT NOW additions, written to sit consistently with the 2026-09-15 Souls-slice principles (four principal controls, skill wins mismatches / builds win margins, readable brutality). Closes the character lane's REQUESTS.md #1. No runtime, asset or test change; quality gate on this tree: 94/94 tests, build, 0 vulnerabilities, budget PASS (fight-ready 6.57 MB raw / 3.44 MB gzip against the 5 MB limit — headroom is now ~1.5 MB after character pass v1). Stale uncommitted graphics-test edit from 2026-09-13 was saved to ignored artifacts/stale-graphics-framing-test-2026-09-13.patch and discarded; primary checkout fast-forwarded to the live revision.

## First release audit — 2026-09-13
- Runtime: Node 25.8.1 for local tooling; pinned Three.js 0.186.0, Vite 8.3.0, TypeScript. One production dependency. Browser needs WebGL2.
- Pass 1 (code/state): pure movement and bounded collision, normalized diagonals, input clearing on blur/visibility/cancel, textContent for guest names, storage failure handling, separated rendering. No secrets, engine physics, backend or unrequested combat.
- Pass 2 (behavior): guest name survived browser reload; rendered 390x844 and 844x390 controls fit without horizontal overflow; pointer-pad circling and release, camera toggle, journal and live renderer reviewed. Desktop rendering approximately 60 fps / p95 17–18 ms during these checks, not a five-minute phone benchmark.
- Regression found: clamping camera inside colonnade initially cropped the player at maximum separation. Raised locked-camera framing with distance. Projection tests now exercise near contact and all boundary angles across portrait/landscape; both capsule endpoints stay within the frame. Transient camera motion still requires human comfort testing.
- Automated: 11 tests, including 20,000 seeded movement inputs replayed twice, typecheck, ESLint, production build, full dependency audit (zero known vulnerabilities), shell syntax and payload budget. Three isolated mutations (diagonal speed, boundary clamp, guest write) were all caught by tests.
- Build payload approximately 140 KB gzip / 557 KB raw. Vite warns about a >500 KB raw JS chunk; intentional single fight-ready bundle avoids an unnecessary split. Measured total compressed payload is far below 5 MB.
- Live regression: the initial Nginx try_files accepted explicit files but returned 404 for /. Browser and HTTP checks caught it. Added directory/index resolution; deploy now compares both the public homepage and revision response byte-for-byte with the local build.
- Release fallback: macOS rsync rejected numeric chmod syntax on the first transfer; switched to portable symbolic modes. The failed attempt did not switch the live symlink. GitHub CLI account display was stale; verified the actual authenticated owner through the API before creating the private repository.
- Tooling: greenfield first write had no search corpus. Three Semble searches ran once code existed (movement, persistence, input/camera). No .codegraph exists; not indexed without owner decision. Early automatic hook dependency discovery failed before repository initialization; project-local tsc/ESLint are installed and actual checks now pass.
- Browser QA used CUA in-app browser. Viewport tests are not touch hardware tests. Real multitouch simultaneous run/move, OS interruptions, GPU context loss and unsupported-GPU entry are code-reviewed but not fully exercised on devices. Guest corrupted/blocked storage is covered by unit tests.
- HTTPS provisioned for apex and www using existing VPS ACME account and renewal timer. Isolated Nginx virtual host only; existing unrelated Nginx warning existed before this work. No Sentry project is configured for this new prototype.

## Run / release
- Local: npm ci; npm run dev. Verify: npm run quality.
- Initial hosting: bash scripts/provision.sh (frankendom.com only).
- Release from a clean committed checkout: bash scripts/deploy.sh. It validates, transfers only built assets, and atomically switches the site symlink. Public /release.json records the exact source revision.
- Rollback: on VPS, cd /var/www/frankendom; ln -sfn "$(readlink previous)" next; mv -Tf next current. Verify public /release.json after switching. Each source revision retains its own static release directory.
- Remote source: private DomLynch/RPG-game repository (previous origin preserved as legacy); verify local/remote HEAD and /release.json on every close-out.
- No recurring background agent or automatic development task is installed. The static site remains available between sessions.

## Still gated
- Physical iPhone 12 / Pixel 6 performance, five-minute sessions and independent player usability remain required before a validated combat-gate decision; owner authorized the bounded first-hit development slice below.
- A humanoid rig and four movement clips are implemented in the character pass below. Full combat animation coverage, online combat, recoverable identity and RPG progression remain deferred.

## Monitoring and code discovery - 2026-09-13
- Authorized addition: pinned @sentry/browser 10.74.0, the second runtime dependency, for production error reporting. No gameplay changes, tracing, session replay or session tracking; request, user, extra and breadcrumb fields are removed before sending.
- Sentry project: na-wnr/frankendom. Build connection setting is in ignored .env.production.local (mode 600); .env.example documents setup. This is a public browser ingest key, never a management credential. Release script refuses an absent/non-HTTPS DSN and stamps errors with the committed SHA.
- Two new regression tests cover disabled configuration, selected integrations and real SDK event serialization/privacy. Browser auto-capture and live ingestion must be checked on release; unit tests alone do not prove ingestion.
- CodeGraph index is local/ignored, not a runtime dependency. Semble and CodeGraph are complementary discovery/structure tools; Sentry supplies runtime error evidence. Do not equate telemetry ingestion with validated gameplay.
- Release validation caught CSP blocking Sentry: the site now allows only its explicit HTTPS ingest origin, with a regression assertion and deployment configuration check. Browser auto-capture reached HTTP 200 after the fix; remote event lookup is a separate required verification. Total quality suite: 14 passing tests, typecheck/lint/build/audit/budget pass. Desktop/mobile renders were checked with blocked telemetry; software-rendered browser timing is not a phone-performance benchmark.

## Claude feedback integration and release checkpoint — 2026-09-13
- Claude's scoped commit 64a5b26 landed before mobile commit eab6860: the 1.8–2.2m warden dead band is already fixed and its stationary-guard regression passes. The earlier concurrent files were committed by that session; the shared checkout was subsequently verified clean. No duplicate implementation.
- Stale notices reproduced with a failing real-simulation regression. Two-second fixed-tick notice age now refreshes at both player/enemy contacts, including repeated identical results. Only display expires: result remains available for riposte, whiff AI and renderer feedback. Death/rematch and incoming/guard/chain priority retained. Reviewed early returns, pause semantics and repeated events.
- Three focused Semble searches plus CodeGraph impact covered result producers, HUD priority and regression helpers. CodeGraph synced after edits. Full configured gate: 53/53 tests, ESLint, typecheck/build, zero runtime vulnerabilities, payload budget pass. Existing 10,000/16,000-frame seeded state replays cover deterministic order; pre-fix code fails the new notice regression. ast-grep unavailable on PATH; no disputed graph edge or profiling symptom requiring unrelated diagnostics.
- Browser review: compact 375x812 view, combat approach/damage/defeat and full-width rematch render correctly with no horizontal overflow. Prior 844x390/1280x800 checks verify landscape/desktop. Physical phone performance/audio evaluation remains outstanding.
- Deployment blocked: configured scripts/deploy.sh passed its isolated quality gate, then public SSH 49.12.7.18:22 returned Connection refused (also on retry); saved-key Tailscale 100.96.74.1:22 timed out. HTTPS release.json remains HTTP200 at 58821417391576c257c61d10041c1ebd9197bb73. No claim these updates are live. Sentry search for that production release returned no grouped issues; this does not validate the unpublished changes. Resume configured deployment and public asset/service/browser checks when SSH is reachable. Evidence logs/receipt remain under ignored artifacts/.

## End-of-fight timing hook for the HUD — 2026-09-22 (lead; the overlay layout is Visuals and World's)
Owner (2026-09-22, via Strategy): end-of-fight text and buttons must not sit over the fallen body; text appears only once the
finisher camera has settled and fades while the arena cam tours. This PR exposes the timing, nothing else. `view.finishPhase()`
returns `{ settled, touring, age }`: `settled` is a latch on the camera rig (src/camera.ts `SETTLE`) that turns true once the finish is
1.5 s old and the drawn camera has moved slower than 0.02 m/s for 0.4 s, and stays true until the finish clears; `touring` is the
arena cam (from `TOUR.delay`, 5 s); `age` is seconds since the finish began. Measured settle times on this rig (tests/camera.test.ts):
plain death 1.52 s, opened 2.47 s (3.07 s big), decapitation 2.53 s, quietOne 2.87 s, splitCrown 4.13 s, runThrough 4.18 s — the two
long finishers leave ~0.8 s of still frame before the tour. `view.fallenRect()` is the fallen rig's bones (plus the severed head's box)
projected to CSS pixels and padded 24 px, for the gate "no HUD element intersects the body at settle time"; null outside a finish,
on a draw, or before the rigs are in. The graphics harness stubs both.
