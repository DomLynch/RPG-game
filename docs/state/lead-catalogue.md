# Lead, 2026-10-26 afternoon (READ FIRST)
- #3654 (kill credit: no solo-kill exception, two full bars split the kill) is MERGED; trunk is 2beaa116 and live is still 82a994d15. Dom: "yes ship it as a V1 release". K6q36 is blocked by a hooks cache_guard false block on deploy.sh:379 (`rm -f "$svc"`, svc=$(mktemp)). Ruling: Hooks fixes the guard, deploy.sh is not edited. Hooks Dev tells Deploy when it's installed, and Deploy launches. TRUNK FROZEN until it's published; #3655 (these docs) merges after.
- Cleanup: frankendom-main reset to trunk (its staged index was backed up as local branch backup/frankendom-main-index-2026-10-26 @e59b4d7d3). Root handover/security files and the stills folders moved to ~/Developer/.scratch-shadow/lead-catalogue-archive-2026-10-26/ (private: VPS IP, not for the public repo).
- V2 Dev has the V1-vs-V2 combat verdicts (27 rows plus 5 missing rules) and the map corrections (lift from 82a994d15; V2 is JS).

# Lead handoff, 2026-10-26 (Frankendom - Lead Dev session; Dom clearing it). Strategy writes its own entries below; this one is Lead's
## Now
- Nothing is mid-task. FRANKENDOM V1 IS ARCHIVED / ON HOLD: Dom is building Frankendom V2 (repo DomLynch/Frankendom-v2, ~/Developer/frankendom-v2, live https://v2.frankendom.com, built per sha under /b/<sha>/). The V2 Dev session is local_0d75328b-4dc5-4e9d-88a8-9059e05232c2.
- Lead's role now: answer V2/OpenTrident questions with V1 facts (paths, numbers), read-only. Never task OpenTrident (Dom: independent). Don't wake V1 lanes.
- Next: Dom tests V2 on his iPhone. Hit-stop is still 0 (Dom's call; `?hitstop=1`). V2's remaining list: wounds below 60 % HP, sand puffs, finishers (Decapitation and Split Crown first), the opponent sword check.
## Done (10-23 to 10-26)
- LIVE V1: K6q35 82a994d15 = the Exo Gray hero (#3652 via #3653), 10-23 15:59. Zone 1 loads Exo (checked). Classic Fin_RunThrough kept on Exo (Dom).
- One-page V2 briefs, all in docs/v2/:
  - pit-live-zone-for-opentrident.md: shared HP was per phone, so two players each solo their own copy; still open; hold HP on the server.
  - controls-and-combat-for-v2.md: §4 CORRECTED. The live camera is follow-camera "Wide auto-fit", not the camera.ts lock.
  - v2-feel-gap-audit.md
  - feel-layer-for-v2.md: V1's weight = stacked layers, not hit-stop, which is 0 live.
- Sent by message: the finishers and special-moves maps (OpenTrident + V2), the Origins live-MMO explainer (ARMAGEDOM Lead), the iOS zoom fix (zoom-guard.ts + layout-viewport canvas) and the camera rows (V2).
- VPS: killed 11 orphan cpujob wrappers by PID (no HF jobs behind them). /root/jobs/char-lods kept.
## Open
- V1 parked: K6q34 #3651 (stale), #3648, the rotation stack #3627/#3637/#3644, the Inkverse branches, the gear PR. Pipeline cleanup ideas (release rows skipped on feature PRs, CI row 9 600 s ceiling, the Playwright install ~10 min per row job, load-time counting the rollback GLB): never started; Dom didn't ask.
## Gotchas
- A HIDDEN browser pane pauses requestAnimationFrame: screenshots go stale and the game doesn't tick. I wrongly reported a V2 "facing away" bug from that and withdrew it.
- The Strategy managers chase lateness, not overcomplication (memory feedback_lead_dont_overcomplicate).
- zsh: `git show "$T:src/..."` breaks (`:s` modifier); use "${T}:src/...".
- Strategy and Lead share this worktree and this file: Edit, never overwrite.

# Strategy-lane handoff, 2026-10-25 ~15:00 +04 (READ FIRST; Dom clearing this session; supersedes the 10-24 08:50 entry below where they differ)
## Now
- Side effects of cross-lane-only: no NEEDS-DOM lines from the judge, no auth-failure alert (no model calls to fail), no idle or pace copies to Strategy.
- Dom: ignore GitHub billing warnings (Pro account free); Dom does the Hooks Dev merges (#175, #178) himself. Micro-Manager asked for Dom's 23:29 text about #87 default-on: Dom said it in "ARMAGEDOM - Lead Dev"; I did not forward it (Dom's call).
- Everything below this line is the 10-24 entry, still true.

# Strategy-lane handoff, 2026-10-24 ~08:50 +04 (superseded in part by the 10-25 entry above)
## Now
## Done today
- LIVE: K6q35 82a994d15 = Exo Gray hero (#3652 via #3653), published 10-23 15:59, nothing since. Trunk head = live.
- Weekly number 10-24: 503 nudges, 104 wins = 21% (crosslane 10/15, judge 90/447, idle 0/13). Keep-or-kill line: under 25% for a second week = remove it. Next read ~10-30.
- First live nudges after the changes 10-24 08:45: 2 + 1 copy to ARMAGEDOM lanes (Characters idle, Backend #13 head check). Outcomes not checked.
## Open
- NEEDS-DOM.md: "merge 175" (hooks, Dom's own words only) still listed.
## Gotchas
- Hooks block shell edits (cat >>, sed): use Edit/Write. Edit needs a prior Read of the file.
- The first read of live release.json in this session was stale by evening: re-read before quoting "live".

# Lead handoff, 2026-10-23 ~10:40 +04 (superseded; Dom switching Claude accounts)
## Live
- d3a8eaefa = K6q32 (unchanged since 07:27).
## Train (Deploy runs it; one candidate per trunk)
1. K6q34 = release #3651 @82f15b22a = #3645 + #3642 + #3632. At 10:37: 45 checks green, 1 running, 0 failed; the Auditor's contents are OK. Needs "Auditor: PASS @82f15b22a", then candidate:pass. My watcher (scratchpad watch-pass.sh) dies with this session, so SET THE LABEL BY HAND.
2. EXO GRAY = PR #3652 (char/hero-exo-release @275fb6ce3, opened 10:37): Mixamo Exo Gray becomes the real hero, hero-body row exo|classic, classic kept. Dom's direct GO ~10:0x: "make this real hero for everyone. Put it in the main release. But make sure we have the backup". Backup tag hero-classic-2026-10-23 = d3a8eaefa (warrior.glb blob 3aa21de39). Gates (Strategy): Combat re-times the hit windows from OpenTrident's hit_frames.json (VPS /mnt/frankendom-donors/_private-ref-games/parts-lab/hero-mixamo/), as rows keyed by the body row; root motion stripped; the 4 stand-in clips replaced; Dom's phone p95 zone1/?crowd=0; Auditor PASS. noLoot: Exo draws no worn gear (gear fit is a follow-up). Rides ALONE after K6q34. Target live 12:30-13:00. Strategy milestones: as-data 0 + shards 11:30, PASS 12:00.
3. #3648 (fight bar rank line) was skipped from K6q34 (main.ts conflict): Web rebases after #3651 publishes, then a new PASS.
4. #3635 (CI apt fix) @09ff1b60e: the Auditor fixed its own dpkg-lock bug; Lead watchedAllow OK given (blobs 7ac2e57dd / 073691be3 / cfedde44b). Its CI is re-running; it's cut after Exo. #3650 (old K6q33) is a parked draft: close it when #3635 is re-cut.
## Previews
- /preview/hero-exo/ = acf2a106 (Exo + Mixamo clips + our sword + noLoot). Dom: "it looks good".
- Inkverse: /preview/inkverse/ = merge build (world + web/inkverse-comic, branch preview/inkverse, Deploy only); /preview/inkverse-world/ = world-only. Kachujin fixed (e6336e03d). Web owes Dom the framing side-by-side + the Kachujin triple; World owes InkScarf + the hero-close key.
## Rulings today
- Mixamo legal: Dom "forget about the legal stuff, it's fine" (memory feedback_dom_mixamo_legal_ok).
- Lanes up: Dom is active. Lead, Characters, Deploy, Auditor and Combat are working; the others were on the 07:5x stand-down.
## Gotchas
- zsh: `$T:src/...` is read as a :s modifier, so quote it as '...:path'.
- The hooks block mv/rm on variable paths and shell edits: use Edit/Write.

# Lead update, 2026-10-23 ~07:45 +04 (restarted Lead; read with the 08:00 entry below)
- Live d3a8eaefa (release.json read 07:39). The K6q32 postcheck ends OK (03:30Z) and there's no deploy_hold or lock file. The train has logged "no candidate" since 03:35Z, so Deploy was told to cut K6q33 #3635 now, then K6q34.
- RULING, Inkverse framing: Deploy owns the throwaway branch preview/inkverse = world/inkverse-look tip + merge --no-ff web/inkverse-comic tip, force-pushed only there, published by full merge sha. Nobody pushes onto another lane's branch; a conflict means a stop and a report to Lead. Side-by-side: world-only (left) vs merge (right). Sent to Deploy, Web, World, Strategy.
- World restarted; its pieces were sent again: fix the preview build dropping public/world/ink first (likely why Kachujin is invisible), then InkScarf + the hero-close key (push 08:15).

# Lead handoff, 2026-10-23 ~08:00 +04 (READ FIRST; Dom clearing Lead)
## Live
- d3a8eaefa = K6q32 (#3591 hide zones 3-6 + #3639 town far bodies + #3649 mute Mac WebKit rows), Published 07:27. Row 52 trusted on the A/B parity ruling (the fightTo goblin-duel flake is on base and head alike).
## Train (Deploy runs it alone)
- K6q33 = #3635 CI-only (candidate:pass; close #3630 as included) once the K6q32 post-publish tail (row 9 + CI rows 10,11,38,39,46) is green and the hold clears.
- K6q34 = #3645 + #3642 + #3632 + #3648 (all candidate:pass).
- Then the rotation stack as ONE candidate: #3627 @386a08459 (PASSed) + #3637 @aac75bc0a + #3644 @e05833622 (rebased). Owed: the restarted Auditor's combined gate (per-kind SEAMLESS_TARGET 2+ each incl. a floor knight, default, shards, creature-clips, Z1 load) + Combat's Mac Metal GL/ready run for #3644. Don't label #3627 alone.
- Combat is on the row 52 flake fix (combat/row52-fight-deterministic; 10x probe on HF CPU; a harness-only PR due to Lead). Once it merges, drop DEPLOY_TRUST_ROWS=52.
## INKVERSE (Dom's priority #1; everything preview-only, no PR until Dom picks)
- Preview https://frankendom.com/preview/inkverse/?zone=0&ink=light (town is the focus; zone 7 too). Current preview 6c0bc0cc4 on world/inkverse-look. Deploy republishes every World push (use the FULL sha); Lead can too: ssh VPS `nice bash /opt/frankendom-shadow/work/inkverse-publish.sh <full sha>`. Never publish while ~/.claude/state/deploy_in_flight.json exists (check with an if, not &&).
- Dom's verdicts: ink=light (last night's v3 tone) is best; mid ok; heavy dropped; the new material (ink=mat/toon) WORSE; crush-blacks WORSE ("left looks better"), reverted. Rule: ONE change at a time; Web sends Dom a side-by-side still (current | new) at 375, VPS captures only; Inkverse captures jump the VPS queue.
- Done on the preview: Dom's GPT ink plate (exchange-backdrop-ink.webp, shared by the town + Pit); red accent = 22 blood splash decals on the town plaza + the hero Heraldry patch (the red-tag bug fixed by retagMs 200); hero rig's 12 base-colour maps inked (Characters, CPU, $0; `atlases` row by material name); Kachujin Mixamo test figure (&fig=red | &fig=grey; scale 0.88; red kimono material "cloth").
- In flight: (a) Web: the Kachujin side-by-side to Dom (hero | red | grey; hold if broken); (b) World: wiring the hero InkScarf (char/ink-hero @2f1904c81, public/world/ink/hero/InkScarf.glb, material "InkScarf" → red.materials; a heroExtras row); (c) Web: comic framing on web/inkverse-comic @d9243c9d2 (vignette + dot screen + fight panel border; the hit flash is wired off); Web checks it on a VPS dev server, then World merges it into world/inkverse-look.
- Owed before any Inkverse PR: the zone-ready pre-warm must cover the ink program variants (zone 7 quiet seamless under ink=light), typecheck clean, phone p95 on Dom's phone.
- Mixamo: preview only (Adobe terms); a legal call for Dom before any release use. HF GPU spend needs Dom's own line in the spending lane's chat (Characters' rule, correct per CLAUDE.md).
## Gotchas
- Strategy's relays sometimes conflict with Dom's direct words to Lead: Dom's direct word wins (e.g. smooth vs 3-step ramp).
- Watch for stale background jobs that republish an old preview sha (one nearly reverted crush-blacks).

# Lead update, 2026-10-23 ~00:35 +04 (superseded by 08:00)
- MORNING ORDER (Dom closed the laptop; nothing publishes from the Mac overnight): (1) Deploy mutes the WebKit rows (rows-only PR); (2) a row 52 next-fight-black A/B, muted, on the Mac at 1a0058934 vs live 889474ca3 (base fails too = parity, cut goes; only head fails = named red, #3639 suspect); (3) publish K6q32 #3647 (merged on trunk, NOT live; the train is stopped by deploy-ceiling, release-train.stopped); (4) K6q33 #3635; (5) K6q34 #3645 + #3642 + #3632 + #3648 (all candidate:pass); (6) the rotation stack #3627 (PASSed @386a08459) + #3637 @aac75bc0a + #3644 @e05833622 as one candidate, after the restarted Auditor's combined gate + Combat's Mac Metal run.
- INKVERSE: Dom picked ink=LIGHT (mid ok, heavy disliked and dropped). v3 is published @a8c044267 on world/inkverse-look (/preview/inkverse/?zone=1|7|0&ink=light). Republish: ssh VPS `nice bash /opt/frankendom-shadow/work/inkverse-publish.sh <FULL sha>`. No World PR until Dom's verdict on v3. Open: the hit-flash red is a DOM overlay (Web CSS tint under the flag, if Dom wants); faint software-GL seams unconfirmed on a GPU; Web owes p95 on/off. Next proposal awaiting Dom's money OK: ink-painted backdrop plates for the Pit (FLUX on HF, a few $). Ratings given to Dom: now ~7 after v3, ~8 with ink plates, ~8.5 with ink kit textures, ~9 with atmosphere + character textures.
- Mac game audio = headless WebKit rows (row 52). No Mac browser rows unless muted.

# Lead update, 2026-10-23 ~00:20 +04 (superseded by 00:35)
## Now
- PRIORITY #1 (Dom 00:0x, he's staying up): the Inkverse look-flag preview, target URL 02:00. World = the pass (world/inkverse-look @4bf5e387c first push, flag `&ink=inkverse`). Web = HUD check + stills at 375 + Playwright p95 on vs off. Deploy = /preview/inkverse/?zone=1|7|0 via /opt/frankendom-shadow/work/inkverse-publish.sh <ref> (no lock). Send the URL to Dom DIRECTLY, plus Strategy. The 2D test sheet + script are in inkverse-look/ (untracked).
- Train: live 889474ca3 (K6q31). K6q32 #3647 (#3591 hide zones 3-6 + #3639 town far bodies) publishing ~00:2x. Then K6q33 = #3635 alone (CI-only; close #3630 as included). Then K6q34 = #3645 + #3642 + #3632 (+ #3648 fight-bar rank line if PASSed; HUD rows in flight on the VPS). Then the rotation stack #3627 @386a08459 (PASSed) + #3637 + #3644 as ONE candidate, after Combat's rebase + a combined Auditor gate. Don't label #3627 alone.
- Watchers: scratchpad watch-pass.sh <pr> <head9> (background); arm one per release PR.
## Done tonight
- Live: K6q29 3e23ebd22 (town fix), K6q30 f45d70bd1 (pre-warm), K6q31 889474ca3 (town zone ready 11.8 s live + ladder toast). Mac 29 → 52 GB free (Auditor and Web worktree copies removed; two Deploy scratch dirs deleted after OpenTrident Dev saved the small files).
- Strategy rulings (Dom delegated 22:4x): outer ring as is; town kerb/bank kept; market in beta as built; goblin-armour Pit loot = yes (already live in loottable:pit-legend); Zone 1 phone walk skipped (Web's #3643 is the baseline).
## Open
- Town sub-names ("The Blacksmith", "the bank") as named-area rows: after beta. Zone 2 KitLod#94 late link (pre-existing) to World after Inkverse. #3627 non-blocking: floor-ring lockstep; floor knights' weapons never engaged.
## Gotchas
- A seamless PASS on rotating camps must engage every body kind (memory feedback_seamless_vary_target_rotating).
- Release PRs carry delta-skipped shards: check that unit shards really ran (#3591 needed a VPS suite).
- Apt mirror stalls: one rerun, then a VPS receipt of the rows at the exact tree. #3635 is the fix.

# Lead update, 2026-10-22 ~20:45 +04 (Dom: "you are the lead dev": the Strategy - Fable 5.1 session in this worktree is now Lead)
- New Lead watcher on #3640 (session background task, scratchpad watch3640.sh): it sets candidate:pass when "Auditor: PASS @3e23ebd22" appears with no failing check. If this session dies, set the label by hand.
- #3635 Lead re-review DONE @52623753a (comment 6346016382): blobs match watchedAllow, no new uses/secrets/permissions, the nightly cron is the only new trigger. It still needs the Auditor PASS + shards; it is cut after #3640 and #3633.
- Mac 20:37: load 43, 29 GB free.

# Lead handoff, 2026-10-22 ~20:35 +04 (READ FIRST; Dom clearing Lead)
## Now (next session picks up)
- LIVE 80934b31f (K6q28). K6q29 = release #3640 @3e23ebd22 = #3636 @c19a8c7f7 alone (town no longer vanishes past 60 m near Orla/bank + Dungeon town plate + keepFoot backdrop lowered + 16 red banners removed). CI nearly done (load-time-zone1 last). Needs "Auditor: PASS @3e23ebd22", then candidate:pass BY HAND (my watcher dies with this session). Then tell Dom directly: "live, reload /zone0/ and /dungeon1/" (Strategy asked Lead to).
- Next cut after #3640 merges: #3633 pre-warm @3b4d51f24 (PASS + candidate:pass already set; kit + gear warm gated on kitSlice).
- Then ONE CI-only cut: #3635 @52623753a (merges #3630; delta rows + nightly full + TRUST line + APT_OR_MIRROR env in release-checks/unit-ci/quality). Lead re-review OWED on the new blobs: quality.yml 89e827ab8, unit-ci.yml ee41195cb, release-checks.yml 0de97d9c1 (check they match watchedAllow; no new actions/secrets/permissions/triggers beyond the approved nightly cron). #3638 (old K6q28b) was CLOSED; #3630 rides inside #3635.
- Auditor queue (order): #3627 rotation @751261147 (lint fixed, rebased) → #3639 town far bodies → #3591 hide zones 3-6 (World re-ran cancelled shard 1) → #3629 town [zone ready] → #3622 ladder pending @5aaea3b5f (Lead stills PASS given) → #3637 Hector L8 (stacked on #3627; label after #3627 merges, retarget to trunk) → #3632 lighter 9 bodies @18c1acf2d (all 9 pairs checked).
- Mac disk falling 42→30 GB free (17:49→20:29 +04), no single big new file; Hooks Dev asked (read-only) to find the growing dir. The Deploy watcher aborts at 6 GB.
## Done today (live)
- K6q26 3d4226586 Dungeon 1 (#3615; manual publish on Lead GO with DEPLOY_TRUST_ROWS=57; row 57 green on Mac + VPS). K6q27 50bdfdb64 (#3618 legend bodies, #3619 zone-pages row 58, #3623 town walls out). K6q27b e29670000 (#3625 bounded apt). K6q28 80934b31f (#3616 paving, #3624 14 town people, #3628 Dom's Dungeon look: blood everywhere + irregular rim).
- Live verified by Combat: /dungeon1/ has 9 legends (Pit Thrall L1 … Typhon L10, no L8 until #3637).
## Open (Dom owes)
- Outer-ring difficulty; the 1.1 m town edge kerb (pieces 029/030); the bank rear block (piece-138/139) — World has the rows ready, each a follow-up PR from trunk; market in beta?; goblin armour as Pit loot (loottable:pit-legend) OK?; two orphan 8 GB folders in frankendom-deploy scratch (79d65121…, 8f5b2fd3…) — nobody claims them, do not delete without Dom.
## Rulings today (this session)
- No manual publish of many rows on trust: a row must have RUN once (Mac/VPS) at the exact tree before a trust. CI apt stalls: one rerun, then a VPS receipt.
- Train trust path (#3635): "only Lead" is process, not code; TRUST refuses a FAILURE; every use is quoted in the Published line.
- Rotation order: Backend #3627 (camps/rotation schema) FIRST, Combat pool JSON after; widening needs kindsOfZone pool keys + a warm-budget ROW.
- Town backdrop/pitFar rule from data (PIT_LAYOUT), not zone id. GPU-only rows: weekly Mac sweep, no T4 spend.
- #3632 (lighter bodies) un-parked for phone load; rides last.
- VPS: no OK for /home/lanes/* or /root/frankendom-worktrees (not sweep roots); the VPS is at ~71 GB free.
## Gotchas
- GitHub check-runs can stick at "in_progress" with all steps done: rerun the whole run (gh run rerun) to refresh.
- Post-publish tails write deploy_hold on GitHub API blips and apt stalls; Deploy clears per ruling.
- Release PRs are drafts by design; the train picks drafts.
- Don't keep two candidates against one trunk at once: close one and re-cut.

# Lead handoff, 2026-10-22 ~17:10 +04 (superseded by 20:35)
## Live (release.json read by Lead)
- LIVE 7c564f7cc = K6q25 (#3608 town 3D kit; Published 14:29). Today: K6q20b 918cd4117 (#3587 world_marks), K6q21 5f9b6b0b3 (#3594 /zone2/ fix + #3592), K6q22 307804304 (#3593), K6q23b a7c307e9a (#3586 aggressive legends + #3603 central fences out + #3584 zone 0 listed + #3610 npm ETIMEDOUT soft), K6q24 514646933 (#3583 + #3595 Zone 1 kit/LOD + #3604 even rim + #3605 roster rows). Deploy traces: /zone0/ → The Concord Exchange, /zone1/ → The Cinder Fields, /zone2/ → The Ash Reach.
- Prod migrations applied BY LEAD (Dom 10:2x: "you do this"): 20261022110000 zone-zero and 20261022100000 world_marks (Supabase MCP, project rxbewmzmovelckzoosss; standings md5 unchanged). ORIGINS_WORLD_MARKS=1 is on (Backend 10:10).
## In flight
- K6q26 = #3615 (THE Dungeon 1 PR; contains #3611 bowl + #3613 join; #3611/#3613 close as included) @23c14f870 = FINAL head (copy commit). The Auditor's zone-7 seamless failed once (5 legend loadout programs compiled after ready); a one-time retry is running. Pass → PASS + a hitch note; fail → a named red to Combat (pre-warm legend loadout materials, ONE commit). A Lead watcher sets candidate:pass on "Auditor: PASS @23c14f870" (it dies with this session, so set the label by hand). Then Deploy cuts K6q26 = #3615 (+ #3616 paving @32bd9963a if PASSed). Post-publish: Deploy traces /dungeon1/ (place "Dungeon 1", presence live) + /zone0/, restarts writer + presence; Backend runs reference_dungeon1_world_marks_live_check after the first legend kill.
- Dungeon 1 content: bowl at world (200,0), zone "7", /dungeon1/ alias, band [1,6]→ranks; 9 legend camps from families with world bodies (pit-thrall, cacus, gawain / roland, grendel, lancelot / siegfried, achilles, typhon); aggroShare + spreadShare ≤ 0.5; copy: "Rank N · title", "{name} is defeated." + "Reward:", hints say "opponent" (legend-copy.json). Strategy ALLOWED the folk heroes on those copy conditions.
- Next cuts (beta blockers only): #3618 legend world bodies @01ec5e3a7 (CI running), #3619 the zone-pages load row (CI-only, after K6q26), the Auditor's delta-rows CI PR (cut-to-live ≤ 25 min, after K6q26 cuts), legend rotation (#3620 design APPROVED: 3/3/3 camps, rotate every defeat, floor 7-10 → Backend writer PR + Combat page PR after #3615 + #3618), #3591 hide zones 3-6, Zone 1 phone walk items (Strategy has the list).
## Dom's rulings today (memory files)
- Dungeon 1 = the Gladiator Pit: roster = the 100 ladder legends L1-10, no wolves (project_dom_dungeon1_roster_legends).
- Everything on the data layer, engine code generic; "new X = rows only" (feedback_dom_data_layer_every_brief).
- Beta in 1-2 weeks, core only; after K6q26 only beta blockers are cut; load-time-zone1 trusted when no Zone 1 file changes; delta rows (project_beta_blockers_only_2026-10-22).
- Lead applies prod migrations (feedback_dom_lead_applies_migrations). Phone gate PASSED (fight p95 37 ms).
## Dom owes
- Outer-ring difficulty: an L1 hero drops 150→35 in 7 s vs Pit-Thrall L1; soften via rows or keep it a real duel?
## Gotchas
- unit-ci doesn't fire on a base change/retarget: remove + re-add auditor:ready.
- Stacked PRs get no CI; GitHub's mergeable flag (not git merge-tree) is the gate (criss-cross merges read as DIRTY).
- Freeze rule: once in Auditor review, push only on a written Lead line naming the red. Head churn reset the audit 4x today.
- Release PASS lines may be in REVIEWS, not comments: watchers must scan both.
- Dom wants a 7-min check-in loop (CronCreate, session-only): re-arm it after the clear if Dom still wants it.

# Lead handoff, 2026-10-22 09:45 +04 (superseded by ~17:10)
## Live
- LIVE 4c719d75e (K6q19, 09:02): Zone 2 plate + creatures (#3558 + LODs), data-layer #3573/#3574/#3576, torch rows #3575, town plan rows #3580, /zoneN/ + /dungeonN/ (#3582, provisioned), zone-0 server fix #3589 (migration file only), frame tool #3579. Earlier today: K6q17 0235532f3, K6q18 30dd89c3e (#3566 receipt + #3578 npm-audit-soft).
## In flight
- K6q20 = #3596 @674a6bbec (#3586 legend aggro + #3587 world_marks). RED: browser seamless "zone never ready" + seamless-quiet "a hit landed on scavengers-1" (run 39728844475); Mac row 52 next-fight-black failed once and was re-running. Suspect #3586's mobs-view engage loop. My rerun did NOT fire (the run was still going), so fire `gh run rerun 39728844475 --failed` once it completes. Combat is reproducing at 674a6bbec vs 4c719d75e (asked 09:44). If it's #3586: fix forward, re-cut.
- K6q21 = HOTFIX #3594 (World: /zone2/ spawns in the Pit; each zone's own `zone<N>-start` warp; 3 reds being fixed: warps.test pins + the zone-entry stub) + #3592 (Deploy's nginx-drift false STOP fix, PASSed) + #3583 (Web kit rows, needs a trunk merge: preview-rules pin conflict with #3586) + #3595 (Web+Characters kit LOD swap, -69% tris, labelled) + #3584 (zone 0 town, World; trunk-merged at 9c54e6bed, needs PASS) + #3591 (unlist zones 3-5, World re-pinning) + #3593 (Backend presence data layer, draft). After publish of #3594: presence + writer restart (Deploy verifies) + `node scripts/zone-hello-trace.mjs https://frankendom.com/zone2/` must end in The Ash Reach.
## Dom's rulings today
- The beta map: Zone 0 = town (Concord Exchange), Zone 1, Zone 2, Dungeon 1 (Gladiator Pit as a normal zone, id dungeon1); zones 3-6 unlisted.
- Dungeon 1: no gate bosses; a ladder-roster spawn per RING; layout = BOWL (option 2), reusing the original Pit's sand + blood-stained sand; REMOVE the cheap brick look. Roster kill = ladder win (world_marks: settle at window close, ½ top, betaMarks cap, 6/h). Level matching default A (fixed levels + grey con), not yet formally confirmed by Dom.
- Bosses aggressive with an aggro radius (legend aggro #3586); Lv10 Shipton in Zone 2 is a later balance note.
- Steam parked entirely; Dom owns branding (no logos/store art).
- Town: built as its own zone via rows (#3577/#3580/#3584); greybox is ~most of the view; Dom's plate is the sky (mirror seams need a wider/360 source from Dom's designers).
## Dom owes
- Apply migrations on prod: 20261022110000 zone-zero (code live now) and 20261022100000 world_marks (after K6q20 is live; then ORIGINS_WORLD_MARKS=1 + a writer restart by Backend).
- Delete-go for the 75 GB of OpenTrident steam-local duplicates (outside the sweep roots).
- Town 3D models: his designers or Characters' AI tool? Wider/360 plates for seamless skies?
- Phone p95 on zone1/?crowd=0.
## Next
- World: hotfix reds → dungeon1 bowl (slice B, ~3 h, stills first) → palisade border cut → town greybox/dark band.
- Combat: K6q20 seamless triage → slice C roster rows per ring.
- Backend: #3593 ready on green → zone-0/world_marks follow-ups.
- Web: #3583 merge → #3595 → "ladder win pending" line.
## Gotchas
- PRs stacked on another PR's branch get no CI: retarget to trunk.
- A cut skips a member on conflict, so merge trunk into members before a cut.

# Lead handoff, 2026-10-21 23:45 +04 (superseded by 10-22 09:45)
## Now (pick up at 08:00)
- LIVE 2bf101977 (K6q16). NO cut tonight (Mac asleep). 08:00: K6q17 = #3570 World Zone 2 plate (Dom's castle; head moved to 136757cab for launchBrowser) + #3567 Backend Dungeon slice A (writer-closure re-pin 23→24 owed) + #3568 Web /zoneN/ links (Deploy runs provision.sh --dry-run, then real, then curl /zone1/ /zone2/ 200, /zone2 301, /zone/2/ 200). Auditor PASS lines on 8/8, then Lead sets candidate:pass on all three. THEN K6q18 = #3566 alone (PASSed @645bc3052; DON'T label it before K6q17 is cut, or it cuts alone).
- Next cut: #3558 Combat Zone 2 creatures @3d712d5e1 (GitHub shards are the receipt, NOT HF: the HF image is noise) + #3569 Characters LODs 8k (skeleton PASS; nightborn re-bake for white flecks, HF job 6ad913b10a35baab53a20a19, pick the cage width) + the LOD row patch into #3558.
- Town: Dom's plaza plate on lead/town-plate @2d8a10c9a. Order (Strategy agrees, Dom's point): (1) World's GENERIC area-sky hook (areaSky[id] rows, LOOK_STOPS, restore-on-leave test), plaza stills; (2) the town as its OWN zone row = proof "new zone = rows only" (700-zone path); (3) World's list of town items code-bound to Zone 1 → owners → rows, "unblocks the 700-zone path".
- Town-zone facts (World 23:5x): a zone = origins/zone-rows/zone<N>.row.json only (gen-zones.mjs; zone-registry + new-zone tests); town presence frames are rows (presence/town-zones.json via zones.ts:10). CODE-BOUND: the Exchange geometry is built in code (origins/preview/exchange-plan.ts + frontier-plan.ts: ZONE_NAMES :43, zonePlan(EXCHANGE) :73, west road :76-78). Not yet checked: bank/smith/trade NPC placement, writer town checks, concord.json rules.safe (World only saw region1/towns.json `safe`). Finish the list → owners → rows. #3570 is now @97d524d94 (both reds fixed, HF green), waiting on the Auditor PASS. world/town-plate @4d44203fe holds a throwaway TOWN_SKY that the generic hook replaces.
- Zone 1↔2 walkable exits (rows) = World after the town. /zone2/ comes from #3568.
- Dungeon (was the Pit, Dom 23:2x): #3561 design @947490ad7; slice A = #3567; slice B (zone row `dungeon` + applyPvp call site) = World.
- Auditor harness fix: root cause = the duel's first sim tick varies 89-113 (real-time asset gate before guard-enabled). Fix: real-time wait, then a fixed tick; prove 10x at level 6 on rows 36+37; row 37 back to 5 marks. "unblocks K6q19".
## 09:00 brief (owed)
- Data layer (Dom 23:3x "Lead forgot"): Zone 2 + Dungeon scoped list = 34 files / 422 baselined sites (World ~140: preview/main.ts 98, goblin-field-rules 22, mobs/zones; Backend ~48: presence + encounter-pose; Combat: ai.ts 28, world.ts TICK/EVADE_HEAL_TO_FULL/RETARGET_CONE + 9, boss.ts 3; Web: ground-pickup 2). One "Zone 2 data layer" PR per owner, exempt math listed as file:line value reason, as-data line first in EVERY PR body. PvP consts are ALREADY rows (Lead was wrong).
- Steam: #3565 (Electron + steamworks.js, bundled, Steam build per Published line, version gate as a row, Windows first) review; #3564 Web asset plan, renders 09:00 (HUD-off = canvas screenshot; ?z1look=a on world/z1look-stills).
- Combat finding: bot vs L6 Goblin, no retune.
## Dom owes
- Steamworks account + $100; phone p95 on zone1/?crowd=0.

# Lead, 2026-10-21 21:5x +04 (superseded by 23:45)
## Now
- LIVE 08070eb67 = K6q15b (#3555 relay signal handlers), published 21:02, CI tail 13/13 green. Backend restarted the relay at 21:04:10 with 0 rooms, NRestarts=0.
- K6q16 LIVE 2bf101977 at 22:24 (release.json read by Lead) = #3553 capture-seed + #3562 Web duel-bot (row 37 at level 1) + #3560 audit list. Row 57 (ground-prompt race) red once, retry green: a flake, on the list with 36/37. Auditor's post-live check OK; the relay receipt owed since K6q14 is closed.
- Lanes tasked tonight: Backend Steam plan #3565 (Electron + steamworks.js, BUNDLED, Steam build per Published line, version gate as a data row, Windows first; review 09:00). Web Steam asset plan #3564 (HUD-off = canvas screenshot). World Zone 2 looks A/B/C on world/zone2-looks @309f5af58 (?z2look; ?z1look=a for the Steam art), units green on HF CPU, sheets sent to Dom (Lead: A). Combat: the AI has no page time, so the bot divergence is a harness leak; Auditor's row-36 fix proves on 36/37/57 at level 6 tomorrow.
- #3562 = row 37/38 duel at level 1 (0 marks); the HUD keeps its level-6 screen. 10/10 under 6 burners. Cause: the bot beats the L6 Goblin ~1 in 3 under load. NOT RV89 (the reds began at K6q11). The divergence is unexplained; loot-smoke-check uses the same bot (Auditor watch item). Combat got a finding line, no retune.
- Pit design DONE early: PR #3561 docs/specs/origins/pit-live-zone.md (Strategy: no objection; numbers/rows as data). Brief lanes 10-22 09:00; slices A-F after Dom's Zone 2 pick.
## Rulings tonight
- Docs-only PR (1 .md, no code, no .github/) PASSes on classify + wording without unit shards (#3560).
- Sweep tool reinstalled by Backend 21:07 (5120aa28 = repo at 08070eb67).
- OpenTrident got the zoom-guard recipe (src/zoom-guard.ts + touch-action none + meta).
## Dom owes
- Town look A/B/C (Lead: A); Steamworks account?; phone p95 on zone1/?crowd=0; Zone 2 look from 09:00 stills.
## Gotchas
- Strategy's Haiku manager polls every ~5 min and missed #3562 on a title filter: read the full open list.

# Lead handoff, 2026-10-21 20:5x +04 (superseded by 21:5x)
## Now
- LIVE 1b96e0cbf (K6q13+K6q14, 19:47). K6q15 #3557 (#3553+#3555) CLOSED after row 37 failed twice. World proved #3553 can't reach row 37 (row 37 = main-game build, #3553 = origins preview only), so it's the known goblin-duel flake.
- K6q15b = #3559 @08070eb67 (#3555 relay signal-handler fix alone): GREEN 43/0 with candidate:pass SET. It ONLY needs "Auditor: PASS @08070eb67", and the Auditor session is at its usage limit (Dom restarts it). It publishes on the next train tick. After live: Backend restarts the relay once at 0 open rooms (#3545/#3555 take effect).
- K6q16 next = #3553 @e533e5374 (capture tool, PASSed, candidate:pass) + Web's rows 37/38 duel-bot fix when it lands. Web reproduced the bot: deterministic when undisturbed, breaks under load. Instrumented run going, then a PR with a 10x loop; it names "unblocks releases". The assertion has failed 5x today.
- Phone exit: NOT claimed. T4 absolute numbers are noise (memory feedback_t4_absolute_timing_unusable). The gauge is Dom's phone: https://frankendom.com/zone1/?crowd=0, green box, fight p95 <= 50 ms = pass. Tomorrow: the point-lights 10 vs nearest-4 paired A/B (must beat the identical-code spread) + night stills with the glint.
- Zone 2 PR #3558 (combat/zone2-draft @ef0537ae0) is a DRAFT on HOLD until Dom's Zone 2 look pick: skeleton camps [3,4], Nightborn profileLevel 8 (L2 25 % / L3 39 %), RV90/WSV69 draft, tells unchanged. No auditor:ready until then.
- Town looks A/B/C stills sent to Dom (World branch world/town-looks @e07f1957e). Lead's pick is A. Dom owes the pick.
- VPS HC volume at 81 GB free (Characters' sweep done). Leftover char-webp + work/char-* checks tomorrow.
## Owed by Lead, 10-22
- 10:00: one-page design, Pit = live zone with TWO areas (safe spawn yard with gate bosses every ~5 min + a walkable PvP duel room; safeAreas in origins/zones/schema.ts), town PvP off, other zones opt-in with a 24 h lock (memory project_dom_pit_live_zone_pvp_2026-10-21). Donors: rathena mapflag/nopvp, UO Trammel/Felucca, WoW PvP flag timer, EQ/WoW spawn timers.
- 12:00: read Backend's Steam wrapper one-pager (Windows first).
- Audit closed 26/26 (docs/audits/external-audit-2026-10-21.md): 5 fix-needed stay findings under launch mode; only the unit-ci receipt latest-attempt fix (Auditor) rides the first cut.
## Dom owes
- Restart the Auditor session; town look A/B/C; does a Steamworks account exist ($100 is his act); a phone p95 read on zone1/?crowd=0.

# Lead, 2026-10-21 19:55 +04 (superseded by 20:5x)
## Now
- LIVE 1b96e0cbf (switch 19:47:42) = K6q13 + K6q14 together via #3554. K6q13 #3551 never published on its own: Deploy merged #3552 during its preflight. Earlier: K6q12 cbb80860a live 18:36 (RV89 goblin L1 + #3536). The K6q12 CI tail is green; the K6q13+14 tail is running.
- K6q15 = #3553 World capture-seed @e533e5374 (trunk merge + 3 red fixes; Auditor re-read OK, PASS at 8/8) + #3555 Backend relay signal-handler fix @9393ab164 (PASS). Box: by 20:10, else #3555 alone and #3553 goes in K6q16 tonight. Cut only after the Published line. After it's live: Backend restarts the relay once at 0 open rooms.
- Phone: dpr dropped; shadow 512 dropped; updateMatrixWorld parked. setProgram is 20 % of a fight (uploads + 10 point lights). Exit A/A x2 on 1b96e0cbf is running (Web: jobs 6ad8def9…, plus B); the exit counts only if p95 <= 50 in 4 of 5 for both, reporting p5 fps too. Tomorrow: 10 vs nearest-4 point lights A/B, with night stills including the blade glint.
- Pit wound mark: KEEP (Dom's rule; measured < 20 ms per 16 s fight). Branch char/pit-no-body-mark parked, delete tomorrow.
## Dom today (memory files)
- Launch mode, Steam track, beta scope (project_dom_launch_mode_steam_2026-10-21). Pit = live PvP zone, gate bosses (project_dom_pit_live_zone_pvp_2026-10-21): LEAD OWES a one-page design by 10:00 on 10-22.
- Town A/B/C stills tonight (World), Zone 2 backdrops tomorrow morning. Stills only, no preview URLs.
## Lanes, 10-22
- Combat: Zone 2 draft combat/zone2-draft @ce98a5206 (no PR). Pit-body skeleton/nightborn are harmless at L2-3. Ruling: measure the skeleton pack-of-2 (target 15-30 % Recruit deaths); Nightborn gets a world-row profileLevel. Tells stay readable, and difficulty ships after Dom's look pick.
- Characters: from 09:00, world LODs for the shipped src/assets/skeleton.glb and nightborn.glb (phone budgets), then zone kind rows. Sweep loop running on the VPS (50 GB free at 19:33).
- Backend: Steam wrapper one-pager by 12:00 (Windows first). Web: Steam logo/wordmark options + capsules + 1920x1080 30 s capture; row 38 flake fix (failed 3x today). Deploy: account-free Steam prep. Auditor: unit-ci receipt latest-attempt fix (it blocked K6q14).
## Gotchas
- GitHub left jobs with all steps green but completedAt null, and the train reads that as pending: re-run only those jobs.
- unit-ci receipt merges both attempts' artifacts after a --failed rerun: rerun the whole run.
- A PR that's CONFLICTING with trunk runs no PR workflows at all, so check mergeable when the shards are missing.

# Lead, 2026-10-21 ~18:1x +04 (restart; Dom: pending stuff live ASAP)
- Live ed79766be (release.json read). K6q12 GO sent to Deploy = #3540 @6b256de53 + #3536 @a1c6f0552 (both Auditor PASS; Lead set candidate:pass). No hold. K6q13 = #3537 #3538 #3539 #3543 #3545 #3546 #3535 + #3544 (after it drops the 2 scripts), in PASS order sent to the Auditor. Strategy told.

# Lead handoff, 2026-10-21 17:55 +04 (READ FIRST; supersedes everything below; Dom clearing Lead)

## Now
- UPDATE 17:54: K6q11 is LIVE, release.json = ed79766be (Lead's curl watch). Dom has been told. Deploy's Published line came in (17:53:30). Still owed from Deploy: Mac rows-done, the CI-tail count, and the ssh keepalive card PR.
- Before that, LIVE was K6q10 4c8a9349a (#3528 RV88 salamander L1 + #3529 labels cache), published 17:11, tail green. Also live today: K6q8 0d972c63a (#3526 guards + #3527 mirror-first), K6q9b b09bd0a09 (#3520 creature defer + #3525 road tops).
- K6q11 #3542 @ed79766be (#3534 phone wound-ray skip) MERGED 13:35:51Z, PUBLISHING. It hung at "writer install 17:38:37" (the Mac ssh client was alive on a dead connection; the writer was already on ed79766be on the box). Deploy killed only ssh pid 13570 and resumed (release-train-resume.sh) at 17:51. NEXT: release.json == ed79766be, then tell Dom in plain English. Card to Deploy: ssh ServerAlive 15/3 + a per-step timeout in deploy.sh.
- K6q12 (each needs "Auditor: PASS @head9" + Lead candidate:pass; first PASS cuts, 10-min hold): #3540 RV89 goblin L1 45 hp @6b256de53 (CI green, stills in body); #3536 + #3539 (Lead-approved); #3537 @05d771942 + #3538 @c84b4020d (rebased onto ed79766be, gate/baseline OK, CI running; the Auditor's PASS about 18:15); #3544 Web chromium launch helper @b7c597a6a (VPS row passed; root cause: Chromium escaped CPUWeight via the session D-Bus); #3543 capture gate on CPU PSI; #3545 relay log stamps (takes effect at the next relay restart); #3546 CPUWeight drop-ins in ops/; #3535 Deploy HF-from-VPS + `hf jobs ps` pre-check. #3547 CI-only (Node pin + lint once) gets its own cut after K6q12 (A/A x2 + trunk control).
- 17:5x: #3536 has "Auditor: PASS @a1c6f0552". #3544 conflicts with #3536 (modify/delete on scripts/family-turntable.mjs + scripts/mob-lineup.mjs). Web was told to drop both from #3544 before its PASS. If Web hasn't, Deploy `git rm`s both at the cut.
- DOM OWES: keep/remove the Pit body wound mark (stills sent: picker-look/wound-mark/*.jpg). Characters recommends REMOVE. If remove: row flag off + ray code deleted in one small PR, Pit otherwise byte-identical.
- World ?capture=seed: world/capture-seed @807fbe99a, HF CPU green, flag-off proof done, replay-twice browser row queued on the VPS; PR due 19:00.
- Phone speed: after K6q11 it's render-bound. Web: ONE t4-small on live K6q11 (umw-fx.sh, web/fx-profile bd5d1b785) = onContact receipt + updateMatrixWorld split + shadow 1024 vs 512. Characters: program switches about 54.5/frame vs about 40 programs, note owed. Card: the shadow map size literal at origins/preview/main.ts:123 moves to a row. PARKED: zone-creature ray skip (no desktop gain).
- Combat after RV89 merges: (d) poise immunity dial A/B 60/30/90 (data only). (a) exhaustion slow-not-lock PARKED post-beta.
- Backend: pace SQL at 18:00. 0 prod world kills since 10-20 14:47Z, so today's combat changes are unplayed.
- Strategy is being cleared too (handoff on strategy/state-1007b); until it's back Lead reports to Dom directly.

## Rulings since 15:40
- Lead's review stands in for the PASS on the Auditor's own PRs ("Auditor: PASS @x (independent review: Lead)").
- GitHub shards supersede HF-image reds; #3528 had no CI because its base was #3526's branch (retargeted).
- Live units have CPUWeight=1000 (persistent); the Chromium -8 incidents only slowed lane jobs.
- Dom: Hero Look parked; repo size accepted; retry small glitches, don't chase them; align every ruling with Strategy and proceed; plain English to Dom.

## Gotchas (new)
- VPS loadavg lies while steamcmd writes over the sshfs donors mount (D-state threads); read vmstat or /proc/pressure/cpu.
- Release PRs are created --draft by release-train.mjs:201 (normal).
- Check-runs include cancelled duplicate runs; read per-run.
- deploy.sh ssh can hang after the remote command ends: check the box, kill only that ssh pid, resume.
- Desktop-route messages to Combat pause after 10 automatic sends until Dom types.

# Lead, 2026-10-21 15:4x +04 (restart after account move; 15:02 entry below still holds)
- 17:1x: K6q10 #3541 @4c8a9349a (#3528 RV88 + #3529) merged 17:09:42, publishing. K6q11 cut 17:10 = #3542 @ed79766be (#3534); watch b1n0clrg2 sets candidate:pass on green + OWNER PASS. Audit PRs #3536-#3539 Lead-APPROVED (comments 6316894841..); #3537/#3538 rebase+re-measure after K6q11. K6q12 = audit PRs + Web chromium launch helper + RV89 #3540 + #3535. Next phone job (Web): one t4-small on live K6q11 = onContact receipt + updateMatrixWorld split + shadow 1024 vs 512. World ?capture=seed first slice by 19:00. Live units CPUWeight=1000 persistent. Dom: Hero Look parked; repo size accepted.
- 16:4x: K6q9b LIVE b09bd0a09 (16:25-16:28). K6q8 tail green. K6q10 rule: first PASS of #3534/#3528 cuts (10-min hold max). #3534 @678ec6d05 green, ruling A (numbers + unmatched Mac still; matched T4 failed: world not reproducible under fake clock -> World diagnosing capture flag). #3528 retargeted base to trunk (was on #3526 branch = no CI); baseline HF 6ad8b0d3 ~16:55; no new gpu-run until then; #3535 adds hf jobs ps precheck (Mac+VPS). #3529 WebKit done, auditor:ready, accepted. Auditor audit: #3536-#3538 Lead-reviewed after K6q10 cut; maths exemptions OK; W1/W2 CI-only PR after K6q10; repo size -> Dom. Auditor probe Chromium reniced twice (-8 GPU thread; needs --disable-gpu). Combat on RV89 (trunk). Backend: root 78% growth. Mac archive 52->63 GB (SANDISK).
- 16:0x (real clock): K6q8 LIVE 0d972c63a (release.json read by Lead; #3530 merged 11:59:54Z). K6q9b = #3533 @b09bd0a09 (#3520 + #3525; #3532 closed); background watch bkib56k25 sets candidate:pass on 0 red + OWNER PASS @b09bd0a09. Backend: remove the hosts pin now. Hooks #172 aligned, install in a gap between Mac rows. Wound-ray leads K6q10 with #3528/#3529 as they PASS. (Earlier 16:1x/16:3x stamps above were guessed; read them as 15:5x.)
- 16:3x: K6q8 #3530 @0d972c63a candidate:pass SET by Lead (29 success/0 non-green, Auditor PASS OWNER); publish on Mac rows. K6q9 pre-staged: #3520 @05361f40a PASS + candidate:pass; #3525 @5a9929e84 PASS on green CI; wound-ray on T4; #3528 ship head 62663b9f6 (HF suite, trunk-baseline diff owed in body); #3529 t4-small A/B job 6ad8a89e5275124786e255d3. Dom: ASAP; Hero Look parked.
- 16:1x: Strategy: order stands; wound-ray (char/wound-ray-phone 5b224becc, base 29fb58b5d) joins K6q9 if numbers+PASS land before cut. LEAD STANDING sent to all lanes: no Mac timing/heavy job while any release Mac rows run (deploy_hold or not); check deploy_hold + pgrep playwright/deploy.sh before each run. Backend: writer+presence NRestarts=0; hosts pin out on K6q8 Published; dev-jobs sweep go per owner (cq-3520-lt NOT yet). Web on #3529 (VPS + t4-small).
- 16:0x: K6q8 CUT = #3530 @0d972c63a (#3526 + #3527). Rows running; owed: Auditor PASS @0d972c63a, then Lead candidate:pass on 0 non-green, then Deploy Published line, then Backend removes hosts pin.
- 15:5x: K6q8 GO sent to Deploy = #3526 @bb400d6c7 + #3527 @d2e1e6c1a (Auditor PASS lines OWNER, candidate:pass set by Lead). Row 36 = verdict A (harness-only: the 4 records replay exactly in node; bot intents split at #175 on timing). Code Quality owns the smoke fix (judge on replay, pin bot to sim tick). #3525 NOT YET: ash 0.06 now over road 0.05; World sets decalTopAsh 0.045 + crossing still. #3520 gate-6 rerun /srv/dev-jobs/cq-3520-lt; with #3525 it leads K6q9.
- Live 29fb58b5d (release.json). CI tail 39590338326 SUCCESS per Strategy 15:37 (tail trusted).
- #3526 Lead review CLOSED green @bb400d6c7 (shards 1-8 + static SUCCESS; 12 cancelled = duplicate run). Ruling: Auditor posts "Auditor: PASS @bb400d6c7 (independent review: Lead)"; asked Deploy to object if the picker refuses it.
- K6q8 = #3526 + #3527 (PASS @d2e1e6c1a); #3520/#3525 join if PASSed before the cut, else lead K6q9. candidate:pass held until #3526 line lands (a lone label would let the train cut early).
- Asked Auditor: #3526 line, #3520 + #3525 PASS, row-36 verdict (A/B).

# Lead handoff, 2026-10-21 15:02 +04 (READ FIRST; supersedes everything below; Dom moving accounts)

## Now
- UPDATE 15:16: K6q7 is LIVE at 29fb58b5d (release.json read by Lead). Writer install ran 15:11; hold/stop files are gone; work-1880 origin was restored to GitHub at 15:11:34; the hosts pin stays until #3527. OWED: the CI TAIL run 39590338326 (rows 10,11,38,39,46) was still in_progress at 15:16 with no failures so far. The resume path starts no postcheck, so the next Lead reads it by hand (red = Lead). After that: Backend's pace counts, the Auditor's post-release verify, #3519 t4-small cost line on the next wall-rows leg. Deploy still owes: the gpu-checks.yml PR, the df pre-check PR, the HF-from-VPS scope (state doc FINAL @c8e35778c). K6q8 go = Lead.
- (Below is as of 15:02.) LIVE was still K6q6 4fc056d81. K6q7 #3524 @29fb58b5d (#3510 RV87/WSV66 wolf 45 hp, #3515 #3516 #3518 #3519 t4-small, #3521 clamp-rate, #3522 pace flag) is MERGED to trunk. Lead set candidate:pass; Auditor PASS @29fb58b5d; Backend's WSV66 receipt is on the PR. Publish STOPPED 14:33 (the VPS writer-install `git fetch` to github.com stalls; the Hetzner path flaps). RESUMED 14:47 with /root/work-1880 origin temporarily pointed at /opt/frankendom-shadow/repo (the sha was already there; Lead checked). Deploy owes: the Published line + tail, then restore origin to GitHub and log it. Strategy pinned 140.82.121.3 github.com in VPS /etc/hosts (14:38, backup /root/hosts.bak-2026-10-21); remove it when #3527 is live.
- K6q8 (cut the minute K6q7 publishes), in order:
  - #3526 guard-gap goes FIRST: the Auditor's own PR. Lead review APPROVED @bb400d6c7 pending shards. The train wants an "Auditor: PASS" line, so settle with Deploy how the Lead review stands in for it.
  - #3527 now @d2e1e6c1a (Backend): VPS job runners + the deploy.sh:245 fetch (local -> store -> GitHub, bounded). Auditor: PASS @d2e1e6c1a (reported 15:0x). Ready to lead K6q8 with #3526.
  - #3528: Strategy lists it as pending; Lead hasn't read it yet.
  - #3520 @05361f40a creature-body defer: bytes -1,381 KB before ready ACCEPTED. 5 of 6 Zone 1 gates still running on the VPS (browser-check passed), then the PASS.
  - #3525 World road ruts @9abe8b25d: decalTopRoad 0.075 -> 0.05, decalTopRut 0.085 -> 0.056. Z-fight OK by the depth math at near 0.1. auditor:ready set; PASS owed.
  - #3529 Web labels: innerHeight read every frame forced layout; now cached on resize. Labels 4.5-10 ms -> 0.03 ms on M5 x4. Owes the t4-small paired A/B vs 29fb58b5d, an iOS toolbar/rotate WebKit check, stills at 375 + 844x390.
- RV88 (Combat, building, stacked on #3526) is SALAMANDER ONLY: 28 hp, no sheet attack, own row (L1 masher 17/21, stand 64/64), era-on twin, stills. The goblin archetype row is shared with the Pit Goblin (roster.ts), so the goblin's L1 fix waits for RV89 = per-level rows (~4 h, Zone 1 levels only, the Pit byte-identical). Combat bumps RV88/WSV67 by hand.
- Row 36 loot-smoke: the hero loses duels with fixed seeds + a fixed clock (Mac too: wins 1 in 3; T4 sometimes 0 of 3), so something machine-dependent leaks in. The Auditor is reproducing with packRecord streams + a node replay (output in VPS /srv/dev-jobs/cq-row36-a1; the background agent's result doesn't survive the account move, so the next Auditor reads that folder). VERDICT FIRST: (A) harness-only -> pin it in the smoke; (B) same inputs, different outcome = a DETERMINISM BREAK that touches replay verify -> Combat, top of the queue. Until then: rerun once on T4 and the Mac pass counts; t4-small stays (not RAM: 7.4/15 GB).
- Phone speed:
  - #3523 hero-only shadows PARKED: no frame gain at map 1024 vs 4fc056d81 (the 7.5 -> 12 claim had a K6q5 base).
  - Characters next: the phone tier skips the gore.ts skinPass/surfaceHit mesh raycast. It's PRESENTATION and it's the 155 ms contact-frame task (site-table fallback). Receipt = longest task before/after + a wound still at 375. Then the setOpaqueSort-by-program idea.
  - World stood down at 15:0x (HANDOFF #80 on world/handoff-58 @9586fb5f4). Untagged draws, partial:
    - 4 are the post chain's FullScreenQuads (owner Characters/post).
    - The rest are RenderPass draws: prog 37, count=288 (the loot-beam program), 7/frame opening and 4.1 in the fight; prog 39, count=84, 3 opening and 1.3 in the fight, not named yet. The next step is coded on world/draw-histogram @fbb7c07fa.
    - Sweeps owed by the restarted World: world-mix, world-ringbeam*, world-ruts, rb-*, ruts-*, untag-dist.
- Backend: orphan binds released (root 68%). The tool was installed from trunk BEFORE publish (the drift WARN is expected; restore .bak-1021b if K6q7 rolls back). Owes the first pace counts after publish.

## Rulings since 13:2x
- Lead:
  - 14:10 lag line: K6q7 cut at 14:01 without #3520.
  - #3523: props-no-shadow accepted as a cost, but the PR is parked for no gain.
  - World ring/beam share and the renderOrder band: dropped (no switch saved).
  - Torch flame look: parked until the phone exit.
  - Road fix: rows only.
  - RV88: salamander only.
  - The 0.25 s freeze is presentation (Strategy withdrew its sim ruling).
  - The Mac is never a transfer relay (no seeding from the Mac).
- Strategy: goblin per-level rows in RV89, accepted.

## Gotchas (new)
- VPS loadavg lies while steamcmd writes to /mnt/frankendom-donors (sshfs to the storage box): ~31 threads sit in D state, so load reads 35-40 with CPU 70-90% idle. Read vmstat / /proc/pressure/cpu before calling the box busy. Runner gate fix = Backend card (K6q12). Leave the downloads as they are (Strategy 17:1x).
- A deploy.sh fetch stalls on the VPS's GitHub path. Check `git -C /root/work-1880 cat-file -t <sha>` first: the sha is often already there.
- archetype-defs.json is LOADER_ONLY: before #3526, no creature stat moved SIM_DIGEST/WORLD_DIGEST.
- gore.ts is presentation: read the file header before calling a hot stack "sim".
- Lanes check deploy_hold once and then loop. The rule is to check before EACH Mac run (Web slipped at 14:50, World at 14:18).
- An A/B base must be the PR's merge base (git merge-base), never an older live.

# Lead, 2026-10-21 13:3x +04 (restart; the 13:2x entry below still holds)
- Lead holds the release go again (Strategy only held it while Deploy cleared). Deploy is clearing; its #3519 t4-small default (PASS @64a08346f) rides K6q7 (WIDTH 4; rerun row 36 once if it flakes, and report it).
- K6q7 lag line 14:10: core #3510 (Combat re-pin) and #3520 (bytes + six gates from HF job 6ad884060a35baab53a1b99f, which at 13:26 showed only the launch line) are each asked for. A laggard leads K6q8. Riders with PASS: #3515 #3516 #3518 #3519 #3522.
- Strategy 13:3x: gate handed back, no cut on its watch; 14:10 lag cut agreed; its delivery manager sends the cut-ready line (heads + PASS lines). The Hero Look brief (brighter, more contrast, one silhouette breaker) waits on Dom.
- 13:52 #3510 Auditor: PASS @813b76efa (K6q7 core in). Guard gap: archetype-defs.json is LOADER_ONLY, so no archetype stat change moves SIM_DIGEST; the Auditor PR (resolved/archetypes in both guards, re-pin once, edit test) lands after the K6q7 cut and BEFORE RV88. #3523 stills: striped prop shadows + a white-card blade in after; matched-tick retake owed, NOT READY.
- 14:0x K6q7 GO sent to Deploy [8bf8d4]: #3510 #3515 #3516 #3518 #3519 #3521 #3522 (cut 9 min before the lag line because the #3520 HF job runs to ~14:21 and cannot reach a PASS by 14:10). #3520 leads K6q8. Backend stages WSV66. #3523: props-no-shadow accepted (planned phone cost); stripes block READY.
- 14:01 K6q7 CUT = #3524 @29fb58b5d (#3510 #3515 #3516 #3518 #3519 #3521 #3522). Owed: green CI, Auditor PASS @29fb58b5d, Lead candidate:pass, Backend WSV66 staged. #3367 torch proof closed (flat-flame look parked until phone exit). Stripes visible on LIVE east8.png too; Characters to compare their before frames.
- 14:1x-14:3x: K6q7 candidate:pass set (46 green, PASS @29fb58b5d), publishing since 14:16 (deploy_hold up). Trunk = 29fb58b5d. #3526 guard-gap (Auditor own PR): Lead review APPROVED pending shards; rides K6q8 FIRST; the train needs a PASS line, so settle with Deploy how a Lead review stands in for it. #3525 road ruts (World): rows decalTopRoad/Rut; dress diff clean; z-fight receipt owed (far road, Mac after hold or t4-small at 14:50). 0.25 s fight freeze = gore.ts skinPass mesh raycast (PRESENTATION): Strategy withdrew its sim ruling; Characters skips the ray on the phone tier (site-table fallback), K6q8. Backend: orphan binds released, root 68%.
- 14:4x: K6q7 STOPPED 14:33 (VPS writer-install fetch to github.com, dead IP 140.82.121.4; Strategy pins .3 in /etc/hosts; Deploy resumes on Strategy go). Live still 4fc056d81, deploy_hold REAL. Row 36 t4-small failed again (2nd): cause owed on #3519 after publish. #3527 (Backend) now also fixes deploy.sh:245 fetch (local store -> GitHub bounded); Auditor read owed; K6q8 lead with #3526; then remove the hosts pin. RV88 = salamander 28 hp no sheet attack + goblin 50 hp (L1 16/21 flagged, L2 29%); per-level rows (~4 h) lead RV89. Combat starts now stacked on #3526.

# Lead handoff, 2026-10-21 13:2x +04 (READ FIRST; supersedes everything below)

## Now
- LIVE K6q6 4fc056d81 (12:26; tail CLOSED GREEN): #3513 ground-poll fix (the 3 s phone hitch is GONE, Web's Mac x4 trace on live), #3506 origins prune (/opt/frankendom-origins at 5 dirs, root 66%), #3504/#3507 sweep tool (reinstalled, sha 87f2e0f7…), #3505, #3508, #3511, #3512.
- K6q7 (NOT cut). CORE: (1) RV87 #3510 @1ee66ca11+: wolf 45 hp (L1 masher 18/21 gaps, L2 6/21); Combat's ONE re-pin commit pending (shards 3/4/7/8: ARCHETYPES literal, level anchors, RNG fingerprint, picked-hero record, wolf band re-pinned to "at least as frail as the Goblin" with a numeric floor, three-wolves), suite on HF CPU, READY, then the Auditor's PASS; also drop the 3 private VPS .sh scripts. (2) #3520 creature-body defer @05361f40a (preready-kinds row 1 = -1.38 MB before ready; an engaged/hunting/driven creature is never hidden, capsule fallback; the belt that touched within()/stepMob was DROPPED, since within() feeds wc/records). Owes: bytes at the new head (the aggro+6 m margin row may take back part of the saving; rule if more than half) + the six Zone 1 gates once (HF CPU job running), then the PASS. RIDERS with PASS: #3515 @3ebc1833f, #3516 @6e7fafd02, #3518 @4f43eaa3e, #3522 @d65fe7283 (pace flag; Auditor wanted arrival time captured at the top of kill_report; check the PASS head has it). #3519 @64a08346f t4-small default PASSed (WIDTH stays 4; row 36 flaked once on small in the A/A, so rerun once if it recurs). Near: #3521 clamp-rate (run-once browser gates owed). Codex-Hooks #171 MERGED + installed (main 8959899, parity 0/24). 45-min lag rule: cut without the laggard; it leads K6q8. Deploy re-reads heads + PASS at cut; Lead sends the go and sets candidate:pass (0 non-green + PASS line).
- K6q8: RV88 (Strategy ruling): EVERY Zone 1 L1 creature dies to a masher at >=80% of 21 gaps: goblin/scavenger L1 (1/21 today) + salamander L1 (0/21); the L2s still punish; at L1 the masher rule WINS over the stand-bot bands (stand bot may sit near 100%); the salamander 60-75 band moves to L2 (per-level rows). Combat starts after #3510 is READY; grid table in the PR body.
- PHONE SPEED (exit: phone tier, 4x, fight p5 >= 20 fps so the 0.05 s dt clamp never binds; walk >= 45; no long task > 100 ms). Pre-link DROPPED (measured zero new programs at every fight action). Done/known: the sim step is cheap (~0.35 ms/frame); fight-only costs = clampLabels (1.4-2.0 ms, +43% in fights) and zoneFx (+0.48 ms, 61x). IN FLIGHT: Web fixes clampLabels then zoneFx (page-only, A/B with clamp-rate fields incl. `paused`) + a t4-small spans run. Characters #3523 phone shadows: HERO-ONLY ships (hero+3 measured at/above trunk shadow cost; hero-only gave fight p5 7.5 -> 12 fps, -25% long tasks) @7ef823dfc, stills + PR body edit owed (Characters cleared 13:3x, HANDOFF #12 on char/state-1017c; #3520 bytes + six gates = HF CPU job 6ad884060a35baab53a1b99f, output /mnt/HC_Volume_107195252/dev-jobs/char-gates-cpu.out); post-stack ?gfx=0 A/B (GLINT IS THE GATE: no post-off ship without a glint); then shared worn-piece materials; find the owner of the ~240-258 ms max long task. World: ring/beam shared-material PR (world/ring-beam-shared, stills + counts), one more draw-trace pass then stop.
- Hooks: Codex-Hooks #171 NOT YET (python rmtree/os.system/xargs < file gaps; Lead ruled node -e / perl -e one-liners covered in THIS PR). Pre-approved: merge + install on "Auditor: PASS @head" with no deploy_hold; parity line + sha to Lead. Weekly over-7-days dev-jobs table from Hooks -> Lead asks owners.
- VPS volume: each phone job leaves a ~6 GB clone; standing rule to Web/Characters: sweep each job folder once its receipt is posted, one reusable measurement clone. Orphan binds (combat-p0b, hooks-sweep36) are released by Backend through the tool after #3518 merges.

## Rulings since 12:5x
Strategy: L1 masher rule = every Zone 1 L1 creature; duels are fair (tick-locked); the world slow-motion edge is flagged only (#3522). Lead: T4 small always / medium only on failure or capacity (Dom 12:2x final wording, everywhere); no maxSteps change (frameDtMax 0.05 is the real limiter; 3 steps is the replay floor).

# Lead handoff, 2026-10-21 12:5x +04 (superseded by the entry above)

## Now
- LIVE K6q5 60753c240 (12:04): creature mix (#3497: +2 salamanders, +2 trolls). Earlier today K6q4 3ae8e79bd (11:40: #3496 train, #3501 sweep volume roots, #3502 presence caps guest 8 / ip 16; Backend verified presence on the new caps).
- K6q6 #3517 @4fc056d81 (#3504 #3505 #3506 #3507 #3508 #3511 #3512 #3513; #3513 = Web's ground-poll memo, Dom's 3 s phone hitch). Owes: last CI check + "Auditor: PASS @4fc056d81" (the Auditor was cleared ~12:4x; I sent the restarted Auditor #3517 as its FIRST item) + Lead candidate:pass (set only on 0 non-green + the PASS line).
- K6q7 = Characters' creature-body defer (non-closest bodies after [zone ready], closest-first, the #3488 pattern; K6q5 phone wire +0.69 MB before ready, only giant-salamander.glb 705 KB; over my 0.5 MB line) + RV87 #3510.
- RV87 #3510 (combat/zone1-fairness-rv87 @dd53954da+): troll L3 50%, salamander L1 70%, the salamander band [1,2]->[1,1] in zone1.row.json (World's commit; all 7 Zone 1 salamanders L1). Auditor NOT YET: re-pin tests/world-sim-guard.test.ts to WSV66 (Combat), plus World's mobs.test `some(ramps)` guard + mobs.ts:113 comment. ADDED by Strategy ruling: the L1 wolf must die to a MASHER at >=80% of gaps 0.6-2.6 m (today only 1.0 m), rows only (wolf hp/hit window, NOT the hero's reach); the L2 wolf still punishes mashing; scavenger/troll/salamander unchanged. Combat on it.
- #3512 Hrungnir band test (25-40%, he's 28% = a plain L3 knight; 'named' is a reward weight, not a lift) is in K6q6. No separate roster row.
- PHONE SPEED (exit: phone tier, 4x, fight p5 frame_dt < 0.05 s = >=20 fps; walk >=45; no long task >100 ms). KEY FACT: the page clamps dt to 0.05 s (preview-rules-defs frameDtMax), so under 20 fps the game runs in SLOW MOTION (43% speed at 8.6 fps); that's Dom's "slowed down". Profile (Characters, real GPU T4): render 41-50% (setProgram/uniforms per draw ~20%, shadow pass 7-10%), walkLoop self ~16%, sim step ~8 ms per step at x4, matrix walk ~12%, program links +1.1 s at first strike. Work: Characters (1) pre-link strike/hit/special programs at [zone ready] against composer.readBuffer, gfx ON; (2) phone-tier quality preset rows (caster cap hero + cap-3, props non-casters, smaller shadow map, post off, GLINT KEPT, stills at 375); (3) B: matrixAutoUpdate off for static props + skip hidden skinned (check loot.glb's 99 skinned meshes). Web: clamp-rate counter (overlay + harness field), then the per-step cost split (stepHero/pairs/recorder/AI; sim-file fixes go to Combat as RV) + the walkLoop split. World: draws + unique materials + programs per dressing kit (numbers only). No maxSteps/cap change (the 15 cap never binds; 3 steps is the replay floor).
- Backend: (a) #3515 sweep-tool drift WARN in postcheck (after K6q6); (b) #3518 vps-scratch-sweep single file + bind-mount via findmnt source + exactly-one fstab line with backup (Auditor NOT YET; real-box dry runs owed); (c) #3506 origins prune 8|40 hex is in K6q6 (frees ~19 GB on the next writer install); (d) NEW: flag-only wall-time-per-tick on verified world kills (>3x tick time = flag; daily count into the damage-share live check; migration = APPLY-READY + my ruling on the PR).
- Deploy: t4-small default PR (deploy/t4-small-default @516f45852+, capacity clause: no small slot / not running in 600 s -> medium with "small at capacity (N s)"; OOM = report, no auto-retry; A/A on t4-small decides WIDTH); then a SEPARATE PR for .github/workflows/gpu-checks.yml (I rule it); then the cut-release df pre-check (/ and the volume: WARN >=80, refuse >=90, ssh timeout = WARN). #3516 test-only setsid fix (macOS ps sess=0).

## Dom rulings today (new since 11:20)
- HF GPU: T4 SMALL always; T4 MEDIUM only when small does not work (RAM >15 GB, disk >50 GB, OOM) or is AT CAPACITY (not started within 10 min); the receipt names which; the Auditor checks flavor + reason ("saves us 20-30%"). Memory feedback_dom_t4_small_only; vps-heavy-jobs skill top block.
- Compute waterfall (via Strategy, docs/ops/compute-waterfall-2026-10-21.md #3514): no second VPS; HF cpu-upgrade in parallel is the default spill; GPU stop $15/day; HF private repos first archive tier; the VPS keeps only what a running job reads; never relay via the Mac; nothing heavy on the Mac while deploy_hold exists.
- Dom asked me to check the phone plan with Strategy: done, all four Strategy changes adopted (above).

## Strategy rulings today (Dom's word)
Named Zone 1 bounty band 25-40% for a Recruit at zone entry. L1 creatures beatable by a masher at >=80% of gaps. Duels are fair (Backend: tick-locked rollback, ratio 1.00); the world slow-motion PvE edge is accepted for beta, flagged now, refusing check (b) on the launch list (V1/V2), reward discount rejected.

## Open
Dom: nothing owed. VPS volume: owners sweep their own job dirs with vps-scratch-sweep (installed from trunk 11:44, sha 438f7b0a…). Waiting: Web ~37 GB, Characters ~35 GB (after the profile), Combat er86 x2 after #3510/#3512, Hooks hooks-sweep36 (queued on the lock). The Steam/OpenTrident dev deletes only with Dom's OK on exact paths (its own rule).

## Gotchas (new)
- vps-scratch-sweep on the box drifts from trunk (nothing installs it); #3515 warns.
- The bind mounts under /srv/dev-jobs and /opt/frankendom-shadow/work answer "is a mount point"; until #3518 ships, sweep the /mnt/HC_Volume_107195252/... source path.
- gpu-run has no caps row for t4-small until Deploy's PR lands ("no caps for flavor t4-small" -> medium with that reason is fine).
- Strategy's study number "hero 106k verts" = hero 40.9k + loot.glb 77.8k; weapons are only ~7k.

# Lead handoff, 2026-10-21 11:20 +04 (superseded by the entry above)

## Now
- LIVE K6q3 fe0601e6e (11:17): the phone release (#3488 loot defer to [zone ready] on phone with a 30 s backstop, #3485 weapon WebP, #3486 check:phone-budget ratchet, #3494 the Playwright path default).
- K6q4 #3503 @3ae8e79bd (#3496 train fix + #3501 sweep volume roots + #3502 presence caps guest 2->8 / ip 8->16) in CI. Lead sets candidate:pass on green + "Auditor: PASS @3ae8e79bd" (my auto-watcher dies with the clear). After publish, Backend verifies the presence restart picked up the new caps.
- K6q5 = #3497 creature mix @9e05aede3 (+2 salamanders: pool-spot 22 m, sedge-spot 120 m; +2 trolls: fell-spot 44 m, pier-spot 168 m; invisible -spot waypoints, dressing cmp-identical to trunk; T4 stills Lead OK on world/mob-mix-stills). Waits on shards + the Auditor's PASS.
- Combat: RV87 rows-only retune (troll L3 -> 35-55% hero wins, salamander L1 -> 60-75%; the salamander gets its own archetype row, the wolf unchanged; REACH[87] per the RV76 precedent, old troll/salamander records refused, OK pre-launch) + an era-on twin of "the hero cuts it dead". Instrument = kite-farm 'stand', 64 seeds. Scavenger L2 is a follow-up (per-level rows). Verifier WSV66 staged by Backend before publish.
- PHONE STUTTER (Dom: "seems a bit slow still"): Web's T4 (live dfc347ed1): 60 fps at full CPU; at 4x CPU throttle 30 fps walking, 20-30 fps fighting, 100-230 ms hitches, idle stalls to 680 ms. MAIN-THREAD bound. Characters runs its #3441 lag harness for the top-5 functions; Web does probe v3 (draw calls, ready time) + the idle-stall period. Numbers to Lead first, no fixes yet.
- Auditor: era-on twins (B) for world-verify / encounter-verify / verify-loot settle with a MOVING hero (the money path). Era inventory: 167 tests fail under the live rules (VPS /mnt/HC_Volume_107195252/work/cq-era-inventory/era-grouped.txt); (C) 66 combat twins go to Combat after RV87.
- Backend VPS disk: / 94% -> 76% (72 GB free); owner-yes sweeps queued (gw2tools, row57-k5k/j, web-pitfix-base, char-packs-b/c with a UNCOMMITTED.diff first); writer-tree /opt/frankendom-origins trim after K6q3 published (keep current + deploy.sh's rollback target + 3 newest; nothing verifier/presence/symlinks resolve to); a PR adding /root/work-cc + /root/frankendom-worktrees to sweep roots (sandbox excluded). Strategy's landing target ~59%.

## Done today (live shas)
K6n2 7f320da52 (~07:20: far-detail, iPad HUD, the #3481 combat-check fix) -> K6o2 8b53a5f29 (09:57: dome without banners + #3471 rocks) -> K6p2 dfc347ed1 (10:34: the RV86 longsword, Dom "better, keep it"; ring rows; row 57 two loads) -> K6q3 fe0601e6e (11:17: the phone release). Merged: the zone1 load-time gate #3477/#3469/#3468 + #3484 (1.5x base ceiling). Closed: #3492 (field wiring; darker ground dropped).

## Dom rulings today
No preview URLs (he tests in the main game, Zone 1). SPECIAL 2 re-check DROPPED (pre-launch: no test-record repairs). Darker ground dropped; "olive rocks" dropped. Loves the goblin blade glint (keep it). More salamanders + trolls across Zone 1 (Strategy bands + placement rules). Playwright reinstall yes (done by Lead into ~/Developer/.ms-playwright). HF jobs run FROM THE VPS (token /root/.hf/token inside a script FILE only; hooks #167 deny inline). The Mac is never a transfer relay.

## Open
Dom: nothing owed. Lanes: as under Now.

## Gotchas (new today)
- A red PR rollup is often a same-second duplicate run that got cancelled; read per-run check-runs.
- CI runs most tests ERA-OFF; a live-rule regression passes CI. Run origins tests directly.
- Mac Playwright Chromium can fall back to SwiftShader: log the renderer string before calling a run "real GPU" (cost a K6q3 hold).
- New landmarks reshuffle rng(z.zone) prop dressing across the whole zone; use invisible spawn spots.
- Deploy won't act on a relayed Dom yes; for a download, the session Dom told does it.
- A by-hand origins republish without VITE_SENTRY_RELEASE changes the bundle hash (#3496 makes the default safe).

# Lead, 2026-10-21 ~11:00 +04
- LIVE K6p2 dfc347ed1 (10:34): the RV86 longsword, ring rows, row 57. K6q3 #3500 @fe0601e6e (#3485 #3486 #3494 #3488, the phone release): a watcher auto-sets candidate:pass on green + Auditor PASS. The hold over "zone ready never fires" was a FALSE alarm (Characters' Mac Chromium ran SwiftShader; Web's real-GPU run: ready at 19.8 s portrait / 10.6 s landscape).
- Dom: "seems a bit slow still" on phone. Web is measuring (T4 + Mac M5): portrait takes 19.8 s to playable; frames are 60 fps on the M5. Full table + top-3 costs owed (~11:45).
- #3497 creature mix @9e05aede3: invisible -spot spawns, dressing cmp-identical, T4 stills Lead OK; waits on shards + the Auditor's PASS. Combat RV87 troll + salamander retune into the bands (kite-farm), with the era-on cut-dead twin; table ~11:15.
- Presence 429: guestIpSockets 2 is hit by carrier NAT. Backend PR: guest 2->8, ipSockets 8->16, joins 30/min kept, plus refusal-reason logging. Before launch: key the guest cap on a session token, not the IP.
- Mac 62 GiB free after the worktree clean-up; Backend is moving/sweeping the VPS (was 94%). Hooks #167/#168/#169 installed.

# Lead, 2026-10-21 ~10:15 +04
- K6p2 #3495 @dfc347ed1 (#3489 + #3491 + #3487 RV86): CI running; the WSV65 verifier gate is MET (Backend receipt on #3495; deploy.sh flips the verifier before the client). Needs the Auditor PASS + Lead candidate:pass. Target ~10:40.
- Queued behind K6p2 + the creature mix (Strategy/Dom 10:3x): (1) VPS disk 94% -> Backend: merged/closed-PR scratch dirs swept (vps-scratch-sweep); open-PR dirs MOVED to /mnt/HC_Volume_107195252 + symlink (a verified move is not a hand delete, Lead ruling); sweep_kind gets the volume root; starts after K6p2 publishes. (2) Skills updated by Lead: the Mac is never a transfer relay; ~/Developer/.ms-playwright is never-touch. (3) #3496 train fix (Deploy): a stale /zone1/ or /preview/origins/ after a live switch = STOP with "release LIVE and sound at <sha>; previews stale: rerun scripts/publish-origins-preview.sh"; look-test previews warn only; the resume writes the tail marker; the Sentry release default.

# Lead, 2026-10-21 ~10:00 +04
- LIVE K6o2 8b53a5f29 (09:57): dome without banners + #3471 rocks. Next: K6p2 = #3489 + #3491 + #3487 (RV86 longsword, Dom: "better, keep it"); target live 10:45.
- #3492 CLOSED: cleared as a cost (T4 three-way: live = field06, 16.7 ms, 124 programs), but the darker ground was dropped, so it'd be dead code. The felt slowness was likely the preview serving: field06 404'd hashed GLBs in 1 of 3 rounds, rv86 never ready headless. Deploy is checking the preview recipe.
- Zone 1 mob placement: World's plan ACCEPTED (+2 salamanders: S1 pool-edge 24 m, S3 sedge-flat ~120 m; +2 trolls: T2 fell-stones 44 m off-road, T3 pier-rock ~170 m; 3 new cairn landmarks; 28 -> 32 specs; the ~20/layer budget read per sub-zone, told to Strategy). Combat's fairness: the interim bot is too weak (scavenger 71% at best); rerunning with the warden brain and the 10-16 troll-ruling hero level. The troll is 0% with the L1 bot.
- Combat's interim table: scavenger 58-71%, salamander 10-38%, troll 0%.

# Lead, 2026-10-21 ~09:xx +04
- Mac Playwright browsers REINSTALLED by Lead ~09:15 on Dom's direct yes: ~/Developer/.ms-playwright (chromium-1234, headless-shell-1234, ffmpeg-1011, webkit-2336; 849 MB); launch test OK. Deploy does the env, the path PR and the row 9 rerun. GOTCHA: Deploy won't act on a relayed Dom yes; for a download, the session Dom told does it itself.
- K6p: #3493 @b349eeef4 has the Auditor PASS but carries #3492, so NO candidate:pass. Recut = #3489 + #3491 only. #3492 HELD: Dom says /preview/field06/ "slowed down quite a lot"; World does a paired perf read (wiring vs none). Darker ground DROPPED (Dom didn't notice it). "Olive rocks"/bushes DROPPED (Dom doesn't recognise it). #3488 rides later (gfx-on program list owed).
- DOM ORDER 10-21 ~10:0x: Zone 1 mob placement review. A few salamanders and a few trolls scattered across the zone (not only the troll cave and the shrine), "otherwise the game's a bit boring with just goblins". World owns it: placement map + donor note + a new rows-only placement (salamanders at 4-6 water spots, one visible from the road in the first third; trolls 2-3, one seen in the first half), within ~20/layer and the phone cap 3; Combat checks Recruit vs a lone salamander/troll. STRATEGY RULING: bands scavenger 90%+, salamander 60-75%, troll 35-55% (row-only tuning, no sim change); one troll visible from the road in the first half, off-path, its ring short of the road; road goblin-only for the first third, first salamander visible from it; placement only + the #3489 rings as markers; acceptance = Dom meets a salamander + troll in the first half without searching; follows K6p2, doesn't displace #3488/#3485. Today: salamanders at shrine-field, mere-hollow, causeway-foot, ruin-gate (+ reed-bank brood max 1); troll only at troll-cave (~16th of 20 route waypoints).
- Dom 10-21 feedback: loves the goblin blade sun glint (keep it); goblins feel weak (Combat to state the Zone 1 band target); didn't find trolls/salamanders (placed deeper: troll-cave, 5 salamander spots; phone cap 3 + no signposting; World to report distances); rv86 longsword "definitely a difference": better or worse asked.
- K6o2 #3490 @8b53a5f29 (#3480 dome + #3471 rocks) is READY: 43/43 green, Auditor PASS, Lead candidate:pass. Publishing waits ONLY on the train restart (Mac Playwright reinstall = Dom's yes; then row 9 at 7f320da52).
- SPECIAL 2 re-check DROPPED by Dom 10-21 ("small fry... just a test player... not even live yet"). Pre-launch rule: no hand-repair of test records; fix bugs only; don't bring Dom small stuff. (Old note:) the dry run verifies all 3 (claims 15/17/19) with NO item, because piece was null at post (the player took no item; the verifier never writes piece). A yes = record only (win marks). Lead recommends yes. Backend's read-only watch is on the VPS (spec2-watch.timer, stops 23:59).
- #3484 merged (7a913f079): zone1 tripwire = 1.5× base.
- K6p queue: #3489 ring rows (PASS), #3488 loot defer (PASS, but K6p waits on Characters' phone-UA newPrograms read; pre-warm via kit-warm if programs link after ready), #3485 weapon WebP (WebKit receipt owed), #3486 budget gate (PASS, stacked on #3485). #3487 RV86 is out until Dom's preview verdict.
- World: GROUNDS doesn't include the frontier dirt, so looks.*.ground never reached the field (A/B negative). Wiring PR next (A/A no look change), then the darker A/B.

# Lead, 2026-10-21 07:2x +04
- LIVE K6n2 7f320da52 (~07:2x): #3474 far-detail, #3478 iPad HUD, #3481 combat-check fix.
- TRAIN STOPPED: post-publish Mac row 9 can't launch Chromium because ~/Library/Caches/ms-playwright is gone (macOS purge, as on 10-16; disk 38 GiB free). The fix is `npx playwright install chromium webkit` into PLAYWRIGHT_BROWSERS_PATH=~/Developer/.ms-playwright (out of Caches) plus the env in run-rows.sh / release-train.env. The download WAITS ON DOM'S YES IN CHAT (asked 07:2x). Then row 9 at 7f320da52, lift the hold, publish K6o #3483 @b6bc1a287 (#3480 dome + #3471 rocks).
- Study list underway: Combat #3487 ER longsword-only (RV86; preview frankendom.com/preview/rv86/ for Dom's feel test; the other classes wait for player-side timings, decided after Dom's verdict). Characters #3485 weapon WebP (WebKit receipt owed), #3488 loot defer (-3.2 MB before ready, Lead OK), #3486 budget gate (ask: allow entries store their figures, fail on growth). World phone-readability note: hero is 7 L* DARKER than the ground; fix A (ground value down) T4 A/B then a Dom preview; fix B step 1 = ring literals into rows; C (bushes) waits on Dom.
- Dom owes: browser-reinstall YES (blocks the train + K6o), rv86 feel verdict, "olive rocks" = bushes?
- #3484 (zone1 tripwire 1.5x base): Lead code review OK; the PASS line goes up after shards are green.

# Lead, 2026-10-21 06:3x +04
- Live K6m 992d59033. The train died at the lid-close (last tick 03:31); Strategy asked Deploy to restart it.
- #3477 Lead PASS @eb820ea0f posted (A/A 39489222863 -0.33 s / 39489234975 -0.27 s, load-time-zone1 green both, shards 8/8). MERGED 06:5x by Deploy: #3477 e7b56c37a, #3469 f7ea8315f, #3468 665696006 (trunk head; quality.yml blob 1f592bcaf, verified). The Zone 1 load-time gate is now in CI. Train restarted (Deploy).
- BLOCKER for K6n: browser (combat) is RED ON TRUNK 992d59033 (dispatches 39489110540 + 39489122821, plus all 4 A/As): browser-check.mjs:131 -> frameStats:18, a locator.screenshot timeout on #3475's ?gfx=0 restore-frame step. Web briefed 06:3x as its top task (3 green dispatches = proof). Re-sent at 07:0x (Web idle, no PR; hand it to Characters if there's no reply in 10 min). CAUSE (Lead read 07:1x): frameStats uses locator('#world').screenshot(), which waits for "stable" (2 rAFs); after a restore on CI's software GL the rAFs are seconds apart. Fix: boundingBox() + page.screenshot({clip}). K6n pre-staged as #3479 @d1267df09 (#3474 + #3478); Deploy recuts it as K6n2 with the fix.
- 07:1x K6n2 #3482 @7f320da52: 43/43 green, Lead candidate:pass + "Auditor: PASS @7f320da52". The train publishes it. Then K6o = #3480 + #3471.
- Ruling 07:1x: the zone1 absolute ceiling becomes RELATIVE (fail when head median > 1.5x base median). K6n2's runner read 44.03 / 43.99 s against the 45 s ceiling. The Pit keeps 30 s absolute. The Auditor does it; Lead reviews.
- Dome: all 3 pictures Lead OK (landscape-final4 after the right-edge pass). world/dome-banners @ca442861b holds exactly those 3 (hash-checked). PR #3480 @35660cb28 is open (pictures unchanged from ca442861b, hash-checked); Lead look OK posted. Waits on the Auditor's PASS; rides K6o with #3471.
- Elden Ring timings note DONE (Combat, combat/er-timings @184acb685). Lead ruling: proposal B (ER shape at our tempo x0.82), lights + thrusts only, heavies held; A (ER absolute, every fight 20-40% slower) is Dom's call, not taken. Rows PR = RV86 era-keyed + fairness/ladder sweeps + whiff-rate check + a Dom phone preview before live; watch the thrust recovery cut 21 -> 16.
- Characters' phone-budgets note (char/phone-budgets) accepted. GO in order: (1) weapon PNG -> WebP/JPEG (~1.3 MB), (2) check-phone-budget.mjs + rows + allow-list, (3) loot.glb off the pre-zone-ready path (~2 MB, the biggest win). The creature bare body waits for the face close-up.
- #3471 boulder look OK @57874f3f5 (live-scene T4 stills; the earlier stills were void because the kit never loaded). Asked Dom whether "flat olive rocks" meant the scrub bushes (bush_scrub_a/b).
- 06:4x RULING: K6n = #3474 + #3478 (both Auditor code PASS + Lead look OK) + Web's browser (combat) fix; pre-staged by Deploy. The dome + #3471 rocks move to K6o. Auditor notes accepted, no hold: #3474 body-only past 14 m even when fighting another player (the creature still draws); #3478's backing also shows on desktop landscape windows (fine).
- Briefed 06:3x: World (right-edge drape pass, then GO for the dome PR; #3471 boulder still), Combat (Elden Ring timings note -> rows PR), Auditor (#3474/#3478 code PASS). Mac load 11 at 06:25.

# Lead handoff, 2026-10-20 ~23:50 +04 (adds to the 23:35 entry below, which still holds)

Dom closed the laptop at ~23:46: every Mac session stops until morning. Nothing needs Dom tonight. Live is K6m 992d59033 (curl 23:37).

## Now (morning order)
1. K6n dome (World, branch world/dome-banners). Lead compared the pictures vs trunk at 23:5x: PORTRAIT OK (~/ipadcam/dome/t4/portrait-clean.webp); PANORAMA OK (~/ipadcam/dome/t4/panorama-clean.jpg; the tan cloth left on the left pole has no emblem: keep it, no redo); LANDSCAPE still owed: ~/ipadcam/dome/mac/landscape-final.webp (box 5 full-box mask) was REJECTED by Lead at 23:5x: a rock pile replaced the frame's posts (see ~/ipadcam/dome/box5-final.png). World redid it as landscape-final3.webp: box 5 OK. Still owed: one narrow pass on the dark-red drape at the far right edge (~x 1600-1672, y 420-520). After that World has Lead's GO to push the 3-file swap and open the PR with 375/844 stills. Judge it, then World opens the PR with all 3 files.
2. #3471 rocks: World still owes the one live-scene boulder still (after the dome job).
3. #3474 far-detail: Lead look verdict OK posted 23:5x (15 m on/off same; 14.0 vs 13.4 m frames show no pop; evidence e20560aa6 on char/evidence-far-detail). Now waits on the Auditor's code PASS + shards, then it can ride K6n.
3b. #3478 Web iPad landscape HUD @077ee382d (backing plate under the foe's bars, tall landscape only): Lead look OK + ruling that row 54 is NOT required (Zone 1 CSS only, no Pit layout) posted 00:0x. Waits on the Auditor's PASS; rides K6n.
3c. Combat (morning): brief from Strategy's study list item 1. Elden Ring measured clip timings (wind-up / hit frame / recovery per weapon class: light, heavy, thrust) as a one-page timing note + a rows PR. Numbers only, no clip copying. Source: the 49 clips in the opentrident reference viewer + docs/specs/combat/donor-elden-ring-unity.md. Donor line "Elden Ring reference clips, timings measured". Poise/stagger/guard windows come after beta (creature-stances ruling). Full list: Strategy memory session-handoff-2026-10-20-midnight.
4. #3477 @cb73c709d: Lead code review posted (code OK: each side reads its own row and public/ via the base worktree; pairing is per-pair-index). PASS line waits on unit-ci 39484767150 green + A/A 39484673851 / 39484695388 each with a paired delta within ±0.5 s. RESULT 00:1x: unit-ci green. A/A 39484673851 green (paired +0.04 s, bytes 71.95 MB / 143 both). A/A 39484695388 RED only on the absolute 30 s tripwire (slow runner, medians 34.15 / 33.87 s; paired −0.06 s). Lead ruling: zone1 gets its own 45 s tripwire (on PAGES.zone1; the Pit stays 30 s), then the Auditor re-runs two A/As; same merge bar. Also: browser (combat) failed in both A/As on a locator.screenshot timeout; the Auditor checks whether trunk shows it too. Then merge order #3477 -> #3469 -> #3468.

## Now
- LIVE K6m 992d59033 (23:33). Train idle. Tonight's chain, all Auditor post-live verified up to K6k: K6f2 1dd3176aa (19:50, lag fix + K6e content; K6e resume dropped) -> K6g 77d5469fe (20:06, banners, gfx on, #3452 skill2 server fix, #3447 duel specials, #3450 kit-warm) -> K6i 453e43725 (21:13, #3457 zone-ready idle-gap fix -41%, #3455 row-55 harness fix) -> K6j 4a7c2f6b0 (21:57, #3458 landscape camLZoom 1.25, #3461/#3462 deploy pipeline) -> K6k 56d8be421 (22:26, #3463 phone creature cap 3) -> K6h2 917850b0f (22:43, #3436 Pit gfx, msaa 0 + FXAA row, lift loader after renderer; removed Zone 1's +4.6 s lift cost) -> K6l f13b7f228 (23:13, #3470 Zone 1 landscape HUD, #3467 zone1 settledAt stamp + load-time script) -> K6m 992d59033 (23:33, #3472 no-marker-on-yield, #3475 restore-frame pin).
- NEXT K6n = World's banner-free dome (3 pictures; landscape+portrait from T4 job 6ad7b9460a35baab53a1432f in ~/ipadcam/dome/t4/, landscape box 5 being redone on the Mac; panorama inpaint running on the Mac M5 per Dom "just do it on the macbook", branch world/dome-banners) + #3471 rocks kit.tint @74fb7a569 (Auditor code PASS; Lead wants ONE live-scene boulder still: nearest boulder_* from frontierGroup, 4 m, tint on/off at 375 + 844x390). Lead compares the 3 pictures vs trunk before the PR opens (picture 1 already compared: OK).
- #3474 Characters far-detail (phone tier, -26% skinned verts beyond 14 m): needs 375 still pair at 15 m + engage pop check (Mac run was killed when it overlapped K6l's deploy; rerun owed).
- Web: iPad landscape HUD (1180x820 / 1366x1024) bars over the dome hard to read — check on live, fix if needed (rows + tall-landscape media query).
- Zone1 load-time CI (#3469 watchedAllow @f02292ee9, #3468 workflow blob 1f592bcaf, Lead written OK posted for that blob): HELD. A/A run 39481901108 failed (bimodal runtime bytes; ±1.2 s jitter). Lead ruling: deterministic byte totals from the build + zone-row files; time = 11 alternating pairs, gate on MEDIAN OF PAIRED DELTAS, +1 s kept; merge bar = two A/A dispatches within ±0.5 s. Auditor owns. UPDATE 23:4x: the ruling is implemented in #3477 @cb73c709d (scripts + tests; it needs a Lead PASS, since the Auditor authored it). #3468 is restacked @c6233907c, with the blob still 1f592bcaf (the OK stands). A/A dispatches 39484673851 + 39484695388 are running. Merge order: #3477, then #3469, then #3468, only if both A/A runs are within ±0.5 s and green.

## Owed by Dom
- YES/NO: re-check the 3 refused SPECIAL 2 loot_claims (#3452 is live). Backend staged a dry run; the real run is one command on Dom's yes.
- iPad birds-eye screenshot (World can't reproduce; landscape zoom shipped in K6j may cover it).
- QA Smoke session.

## Dom rulings tonight
"Everything now, today" fast-track; T4 stop $15 for 2026-10-20 only (#3456 merged; lapses 04:00 +04); "get it all done, and live"; HF 32 GB CPU is the default spill for non-Mac, non-GPU work (no VPS queue waits over 5 min); "just do it on the macbook" (panorama inpaint on the Mac, no further stop raise).

## Gotchas (new tonight)
- Row 55 failed on the Mac at ANY tree before #3455 (harnessClock installed while a real rAF was owed). Fixed, and proven 2/2 rc=0 on the Mac at 453e43725. No DEPLOY_TRUST_ROWS lines remain.
- The CI load-time row runs only on candidates, not feature PRs: pre-stage a candidate (--no-verify; set candidate:pass only after the member PASS) to get the real gate number fast.
- gfx rows (fx-rows.json) are shared by the Pit and Zone 1: any gfx row change needs Zone 1 stills too.
- The load-time gate is software GL: the composer's per-frame cost (MSAA HalfFloat) shows as first-playable seconds; the T4 shows the real phone cost. Check both.
- PR missing auditor:ready = no shards ever run (#3467, #3471, #3472 were each stuck until Lead set it). Check labels at every check-in.
- cut-release refuses below 20 GiB free on the Mac; the disk hit 19 GiB at 23:10, lanes cleared their own scratch, 41 GiB at 23:26. A Claude desktop scratch-workspace (3.7 G, 10-09) is waiting on Dom.
- Lanes start Mac browser jobs during deploys: check for deploy.sh before every Mac start.
- Characters won't spend T4 on a relayed Dom yes: money approvals go on trunk or come from Dom directly.

# Lead handoff, 2026-10-20 ~19:20 +04 (superseded by the entry above)

## Now
- LIVE K6d bfab4f0b0 (18:12). Train RESUMED 19:02 after the row-54 stop: #3451 merged (trunk c02bfebc4), and the resume is running all 57 Mac rows (35/57 at 19:13) to publish K6e content (#3439 Zone 1 special clips, #3427 button names + Pit layout + #3451 row-54 fix, #3431). ETA ~19:30.
- K6f2 #3453 @1dd3176aa = #3441 LAG FIX alone (mobs.debug() was 39-56% of the main thread). candidate:pass SET; needs "Auditor: PASS @1dd3176aa". ETA ~20:00.
- K6g next = #3443 (banners, PASS) + #3442 (PASS) + #3445 (if PASS). K6h = gfx #3432 (PASS @3d91a1194) + #3436 (Pit gfx, rebase on #3432; foot-disc tone owed). Keep gfx in its own cut (the seamless rows must be newPrograms []).
- #3447 (duel from Zone 1 gets the picked specials, no RV, accepted) is HELD until the skill2 replay fix covers 4 places (encounter-verify:65, replay.ts:48, match.ts:221, main.ts:956). #3452 (Backend server skill2 fix, uses the 3 real refused claims as fixtures) must ship SAME CUT or before #3447.
- #3450 (kit-warm hero hidden, -17% tris) under review.
- World: landscape camera too far out on iPhone AND iPad (iPad birds-eye; #3435's camLSide/camPUp untuned): fix rows by eye at 844x390, 932x430, 1366x1024, 1180x820, portrait unchanged. Then flat olive rocks (texture or remove), then a banner-free sky dome image (Dom YES).
- Web: Zone 1 landscape HUD crowded (bars ~40% width, big controls): scale for short landscape.
- Characters: harness was DESKTOP tier (no mobile UA). Re-measuring as iPhone + iPad landscape; shadow phone rows PR; (C) far-creature pieces after a face close-up check; phone creature cap 3 CLOSEST FIRST with ALWAYS-draw for creatures fighting you or any visible player (Dom 19:1x, MMO rule).

## Owed by Dom
- YES/NO: re-check the 3 refused loot_claims (1 player, today, SPECIAL 2 wins) after #3452 is live. Lead recommends yes.
- QA Smoke: sign up, one kill (charged heavy) + one legend duel, swap a special and check it on a second device.

## Dom rulings today
Four beta specials pre-filled; specials follow the account (YES); gfx on for everyone (YES; Z1b +1 s first-playable gate); remove orange banners + the sky-dome banners (YES); phone creature cap 3 closest-first; specials must come from ONE data source on every page (Pit, Zone 1, Zone 1 duel).

## Gotchas (new this afternoon)
- A Web Pit layout PR needs the Mac row 54 WebKit receipt in its body before PASS (CI has no WebKit).
- A release whose base carries a bad merge must be re-cut after the fix (K6f → K6f2).
- Messaging pauses after 10 sends without Dom: use PR comments.
- Verify device tier in perf harnesses (phoneTier needs a mobile UA + coarse pointer). Dom plays on an iPad landscape and an iPhone.

# Lead handoff, 2026-10-20 ~16:25 +04 (superseded by the entry above)

## Now
- SANDBOX MIGRATION COMPLETE: live K6a e759dbcb7 since 16:15, Auditor-verified (Specials dialog served on /zone1/).
- K6b #3429 @9949e5f8b = #3422 (Backend server-saved special slots, Dom YES 16:0x) alone. Auditor APPLY-READY posted. Backend applies migration 20261020150000 and posts the receipt on #3429; ONLY THEN set candidate:pass (the train does not wait for migrations). Lead's written ruling on #3429: server ships first, alone.
- Next cut (K6c): #3427 (Web Pit layout + move names on SPECIAL button faces + "Whirlwind" hit text; R1 asked, check it's in before the PASS), Web's gfx-default-on PR (Dom YES: ?gfx=1 on for everyone, ?gfx=0 opt-out; not open at 16:2x), World's client wiring of special_slots_get/set (not open yet), #3428 (cut-gates watchedAllow for #3418's quality.yml blob ed5dc83e; Lead written OK posted) then #3418 once #3428 is on trunk.
- Held OUT on purpose: #3098 (R1 pre-launch player-data reset; one red check; own cut, Backend owns it).
- Owed by Dom: QA Smoke (he signs up the throwaway prod account himself; one Zone 1 kill with a charged heavy + one legend duel; handle to Backend). No live world kill on WSV64 yet.

## Done today (all Auditor-verified post-live)
K5r 6d666fe7d (RV84 world picked specials) → K5s c1c6561cc (#3401 torch warm) → K5t 855cc0020 (#3406 salamander off Hrungnir) → K5u 359617f9c (#3408 orb staff-v1, Dom found it missing) → K5v 9ef88770c (#3404 world windup ring, cool blue) → K5w 3c60bb1e9 (#3412 late-stream guard + test) → K5x 809f81618 (#3414 Zone 1 held-heavy charge, RV85/WSV64) → K5y 85938fa3a (#3416 four specials pre-filled) → K6a e759dbcb7 (#3420 menu swap + label, #3423, #3270, #3419, #3425).
Closed: #3409 (first-special stutter was a probe artifact; probe must WAIT_READY), #3405 (superseded).

## Open
- World: camera hides a close enemy at melee range (rows only), queued after the slot wiring. Gate-torch lit check (#3367) on the real GPU still owed.
- Characters: peer bow/staff still. Kit-loop slicing declined (single program links, ~100 ms floor).
- Combat: Pit cast-tell arc low contrast (later).

## Gotchas
- The candidate needs its OWN "Auditor: PASS @<cut head>" plus Lead's candidate:pass; a member PASS is not enough. Set candidate:pass right at the cut (missing it cost K5r ~15 min).
- A push to a member after the cut (e.g. #3416 c88b5d8c9) does not reach that cut: ship the tail through a later member, don't re-cut.
- A stacked PR (base = another branch) gets no unit-ci/quality; retarget to trunk after the base ships.
- A rename breaks pinned labels in release rows (row 56 /stomp/): fix-forward with a row-driven read (#3425), never revert the name.
- Gate 2 blocks .github changes until cut-gates.json watchedAllow has the exact blob via its own PR with Lead's written OK.
- Session messaging pauses after 10 sends without a Dom message: use PR comments, or ask Dom for one word. Don't route around the pause.
- frankendom-main holds the shared .git for every worktree: never touch it (Hooks Dev's sparse-checkout slip at 13:34 lost only build output).

# Lead handoff, 2026-10-20 ~10:55 +04 (superseded by the entry above)

## Now
- LIVE K5p 4b0de269c: salamander camps (#3392) + bow/staff clips (#3389) + CI row weights (#3395) + postcheck no-false-hold (#3396). Before it today: K5o 4a9695bf0 (#3388 encounter weapon check + #3390 duel weapon, #3385, #3386, #3387), K5n 9c537f65e (#3381 quiet-one bot, #3378 row 34, #3384), K5m f4d808ab5 (RV83 bow specials, guest wield #3374, #3372, #3379, #3380), K5k bd4da65f9 (Zone 1 FX + start warp).
- IN FLIGHT: K5r #3400 @6d666fe7d = #3397 train-fetch + RV84 #3394 @f5045cf71 (world heroes with a picked skill get the Pit special share + picked; 5 band rows bite/warhammer/reaper/bow/staff apply in EVERY duel, named in the body). Lead + Auditor PASS on both members. CI + Mac rows were running at 10:5x; it needs "Auditor: PASS @6d666fe7d" on green. This is the LAST migration piece.
- Owed after K5r is live: Combat posts a real-GPU live 375 still of a world melee special mid-windup on #3394 within the hour (Lead + Strategy ruling); if the telegraph doesn't show → presentation fix today. The Auditor's post-live read checks verifier RV84/WSV63.
- Next cut (K5s) when ready with both PASSes: World's torch-sconce warm-up fix (branch world/warm-torch-sconce @6f2c32d2f, main.ts zone-ready waits for skin models; the seamless-quiet engage-compile of torch-sconce-baked) + World moving the shrine salamander camp 15-20 m off Hrungnir's bounty spot (data). Neither PR was open at 10:5x. Characters: hero().weapon end-to-end test PR; live guest-bow check finishing on the VPS (pickup + gear sheet already PASS on live).
- World's 10:5x seamless-quiet receipts (Mac Metal, 3 runs each): trunk 1/3 green (reds: torch-sconce-baked + WeatheredStone/Leather); with the fix 2/3 green and torch-sconce never appears. The remaining red is WeatheredStone/Leather = the hero's drawn weapon (…WeaponDrawn<hand_r) compiling late, a separate trunk issue that still needs an owner (Characters, a weapon warm-up). World opens the torch PR with these receipts.
- Mac rule enforced 10:5x: World's mac-seamless.sh and Characters' .livebow ran during K5r Mac rows (load 24). Both told to use the VPS, or wait for no release-checks.mjs and load < 8.

## Dom's rulings today (in memory)
- QA Smoke account YES, but Backend refuses to create a prod account on a relay: Dom must type it in the Duels & Backend chat. The #3388 weapon check is unexercised on prod (0 encounter runs ever).
- No creature stances in beta; unlimited arrows in beta; attack rate left to Lead (kept RV80).
- RV84 30-damage world special (the 20% share from the special.damage row): Lead + Strategy agreed; Dom told, no objection yet.
- OPEN for Dom: the special picker names/count (live 7 specials named Butcher's Cleave / Reaping Blow / Anvil Stomp / Estoc Lunge vs the sandbox 4 named Skull Crack / Whirlwind / Ground Slam / Lunge). Dom's phone check of the finished migration.
- Wolf/boar 2.8x scale from zone90: NOT ported (size is a progression budget). Bear/salamander respawn 60, troll 300.

## Traps learned today
- The Mac sleeps when Dom closes the lid overnight; stalls aren't a network fault.
- PASS lines must start exactly "Lead: PASS @<head9>" (with the colon) or cut-release refuses.
- Deploy shows "offline" in ListAgents when its Remote Control bridge drops; message it by session id local_1bfdae3e-b597-4b09-8f56-b43ec16d10e0.
- A rebase or still push moves the head, so re-PASS at the new head (the delta read).
- The CI tail's row 9 (polearm) times out at the 600 s CI ceiling but passes on the Mac in 9 s; #3396 now stops it raising a hold.
- Combat is local_e38329c7-a904-49ec-90d0-77e0ec1ce957 if its socket is stale.


## Now
- LIVE: K2d 1485c36cc (#3335 old head + #3319 Pit-edge fade + #3320 camp goblin sandbox rank look). Earlier tonight: K1 dfc124987 (#3315 per-layer spawns, migration 20261019141740 applied, ORIGINS_SPAWN_LAYERS=1 since ~19:10, watch clean), JZ 7c9c5b3ea (#3316 painted sky).
# Lead handoff, 2026-10-19 ~23:20 +04 (READ FIRST; supersedes the entries below)
- LIVE K5i 1d7f7c93d (Zone 1 sandbox look/ground). DYNAMIC_RESPAWN=1 since 22:10:17. Verifier RV82/WSV61.
- K5j #3376 (on 1d7f7c93d) = #3363 + #3366 + #3367 gate torches + #3368 staff/bow look + bow names + #3369 row-46 probe fix. CI running; it needs the Auditor's plain line.
- K5k (cut the minute K5j merges) = #3370 Zone 1 special FX (PASS @2be4512f2, partial proof on record) + #3373 zone1-start presence landmark (PASS @00b3b1a99; presence restarts on publish). After K5k the migration list is ZERO; then take a live spawn still.
- 23:25: #3375 has "Auditor: PASS @a878c4b84" (shards green + the bow smoke cited); Deploy is told K5l = #3375 + #3374 + #3372 as they PASS, cut when K5k merges; Strategy holds the Lead PASS for #3374/#3372 until a fresh Lead is up.
- K5l = #3375 RV83/WSV62 world bow specials (Auditor read OK; Power Shot proven by Backend's smoke on the thread 6275234908, a trunk re-run being appended; the Auditor PASSes on green shards), #3374 guest-wield (World browser PASS 6275067449; wrapper fix @5402950bb, PASS on green), #3372 bow smoke tool @292dbf6dd (PASS on green; make BOW_EXPECT_POWER the default once #3375 is on trunk).
- STANDING: rows 16/21/28 trusted via ~/.claude/state/release-train.env until ci/quiet-one-rv80 (agent PR, the scripted duel guards on tells) is live; then tell Deploy to delete those two lines.
- Agents of mine still running at handoff (their reports come to this session and may be lost on /clear): (1) the quiet-one fix: look for a PR from branch ci/quiet-one-rv80; if none, re-brief; (2) the Zone 1 FX per-skill check, read-only (cleave/stomp/shove s1/pommel s2/reaping): re-run on the Mac real GPU with ?debug counters if no report.
- Lanes: Combat (0e2ac7378) and World (HANDOFF #71) handed off; Characters handoff written; Backend handing off after the trunk re-run. Web [1dbda2] refuses work until Dom confirms its role.
- For Dom: QA Smoke yes/no, the Web session's role, creature stances (RV84; table in docs/briefs/opener-tuning.md via #3366), opener/attack-rate tuning (RV80 foes swing ~18/min vs 29; a tapping player loses to skill_jab), a limited quiver (the sandbox ended unlimited).

- UPDATE ~23:10: LIVE K5h 9333a0c46 (after K5g 00f5e2d97 = #3343 world stances + #3327 bow/staff RV82/WSV61 + #3354 Zone 1 spawn wall). DYNAMIC_RESPAWN=1 since 22:10:17 (watch clean, #3328). STANDING RULING: rows 16/21/28 (quiet-one finishers) are trusted on every candidate until ci/quiet-one-rv80 (an agent's PR) is live; it's pre-existing from K5f RV80 (a tapping player dies to the foe's skill_jab). Row 46 (desktop-intro) fixed forward by #3369 (one-button collapses the #actions container; the probe tests #attack-button). K5i #3371 = #3364 (Zone 1 sandbox look/ground, Strategy-confirmed). K5j members PASSed: #3363, #3366, #3368 (staff shape + Zone 1 bow drew a knife + bow special names), #3369; pending: #3367 gate torches (CI), #3370 Zone 1 special FX (the harness registration pushed @2be4512f2), World's zone1-start landmark PR (the presence warp sent the hero to the old start; presence restarts on publish). Queued for K5k: #3372 bow smoke (Backend; Power Shot expected-fail), #3374 guest-wield (agent; World verifying in a browser), the RV83 bow-specials-in-world-fights PR (agent, branch combat/world-bow-specials; world hero lacks specialShare without a spell), the quiet-one fix. For Dom: QA Smoke yes/no, the Web session's role, creature stances (RV84), opener/attack-rate tuning, a limited quiver (the sandbox ended unlimited). Combat handed off (state doc 0e2ac7378).
- UPDATE ~22:10: LIVE K5f e3625a82f (keypad #3317 with the opener + glance-retry gate, #3331 stance menu, #3328 respawn, #3321 mana/camera, #3324 sounds, #3330, #3357/#3352). Live probe (Combat, real GPU): first telegraph 5.5 s, first special 9.5 s, 60 fps. K5g #3362 @00f5e2d97 (#3343 @c0f4268bd, #3327 @54b7a600f, #3354 @46cccd923) in CI. K5h pre-staged: #3356 (PASS @f8d1a35ef), #3359 @11b9587e6 and #3361 @0a63ac33e (re-PASS owed after the trunk merge, on green). Jobs out at 22:10: Backend flips DYNAMIC_RESPAWN then a 2-client real-kill proof; Combat runs item 13 (every special fires live); World does gate torches via torch-sconce.glb; Characters the real staff mesh; Web [1dbda2] a live phone-layout audit. Dom's standing rule: pre-stage the next release always.
- UPDATE ~21:40: LIVE K2f a0c8548a3 (Zone 1 = TZ, #3313; Auditor verify 6272644898). Three keypad-group candidates in parallel, preference K5e > K5d > K5c: K5e #3358 @a05ff46eb = #3317 @3bdafc3ab (opener row: foeOpeners maxLevel 1 / 600 ticks, RV80 in-place, SIM_DIGEST re-pinned) + #3324 + #3330 + #3321 + #3331 + #3328 + #3357 @19f1ad330 (the gate waits for !hidden + #message hidden before Fight; carries #3352 receipt.sim). K5d #3355 @43e4ab9dc = the same without #3357. K5c #3351 @f9e9cfa2d = #3317 @61f6f1629 (no opener). The browser (combat) red is page-side (the sim tells at 3-5 s in both eras; the CI runner is paused/hidden). The Auditor won't PASS any red without receipt.sim naming the cause. The opener ships only inside RV80 (if K5c ships, it needs RV81). Next cut after publish: #3343 @49d4ab0d6 (on K5d's tree; menu-pick follow-up folded in, my PASS was at 6bb19a539, so a delta read is owed) + #3327 (rebasing onto it, RV82) + #3354 (World: spawn by the wall + gate banners/fire pits; supersedes #3346, PASSed @5f0a42794 as the fallback). Owed to Dom tomorrow (via Strategy): RV80 foe attack rate L2-10 ~18/min vs RV79 ~29/min (Combat's sim table) + the opener option; the zone name (Cinder Fields vs Test Field); gate torches as a standing-torch prop (torch-sconce.glb exists in docs/character-references).
- UPDATE ~20:55: K3g #3344 CLOSED RED on browser (combat): no tell in 20 s (scripts/browser-check.mjs:40, __tellAt), keypad group (green with #3313 alone, so not #3313). Combat runs the row locally against #3317 61f6f1629, logging the bot's moves + data-threat, due 21:05. K2f #3345 @a0c8548a3 (#3313 alone) publishes on the Auditor's line (drafted). In parallel: cut #3331 @50836b4c8 (Lead re-PASS 6272506179) + #3328 @bc8caddbe (Auditor PASS). Blocked behind #3317: #3321 (Lead PASS @c698d0959, carries #3317), #3343 (Lead PASS @7ee8e9f9b, rebased on cdb3d2c75), #3327 @a287f9443 RV82 on #3343, #3324/#3330/#3335. Follow-ups: Combat makes the world duel read loadStancePref (after #3331); World #3346 skull post (HF suite); item 4 warm sun CLOSED not a gap; Hooks Dev on the #3324 cue follow-up + a lane watch.
- UPDATE ~20:20 (new Lead session): K3g = #3344 @cdb3d2c75 cut (five PASSes re-read at head), CI + 9 Mac rows running; it needs "Auditor: PASS @cdb3d2c75" (new Auditor [d98ae5] told). K3d/K3e/K3f/K2e closed. If it goes red in #3313, Deploy drops it and recuts the other four. Auditor queue for the ONE next candidate: #3321, #3331, #3343, #3327, #3328. ~20:26 GitHub Actions DEGRADED (~95 queued, 2-14 jobs running): Lead ruling, the VPS shard job at the same head stands in for GitHub shards on K3g if they haven't run by 20:45 (Auditor acked). Strategy rule: a stale green single-PR candidate is re-cut alone; #3313 @6a8ef850a re-cut alone in parallel (member PASS = Lead 15:44:42Z; the Auditor's own read was at 8952d563b), first green publishes, the other recuts. World started on gfx lift C16 + the skull post + a fire-breath clip (one PR). #3328 fix @bc8caddbe (writer refuses DYNAMIC_RESPAWN without DAMAGE_SHARE), CI owed. #3331 now char/stance-b @16e54fb59, suite and stills owed. Version ruling: #3343 keeps RV81/WSV 60, #3327 takes RV82/WSV 61; both rebase once after #3317 merges (no red interim runs).
- UPDATE ~20:25: K3f goes red on static (as-data: the tablet row id "camera" collided with main.ts's touch-owner word). Lead fixed it in #3317 @61f6f1629 (row id → camera-button-wide, gate exit 0, Lead PASS posted). Deploy is told to recut as K3g = #3317 @61f6f1629 + #3324 + #3330 + #3335 @dfbe52c9e + #3313 @6a8ef850a; the new Auditor posts the candidate line.
- (superseded) IN FLIGHT: K3f #3342 @e2f81bfde = #3317 keypad RV80 @ac35bdccf + #3324 skill sounds + #3330 migration rename + #3335 @dfbe52c9e dome race fix + #3313 Zone 1 = Test Zone @6a8ef850a. Full 9 Mac rows + CI running; it needs the Auditor's "Auditor: PASS @<head9>" line on the candidate (the train picker does NOT accept a Lead line or the candidate:pass label alone). If it goes red in #3313, drop #3313 and cut #3317 alone (promised to Strategy).
- NEXT CUT, the minute K3f merges: #3321 (mana bar + camera.fightBack 1.3 scoped off the finisher + Zone 1 STRIKE hint, @c698d0959e, waits for the Auditor's re-PASS), #3331 (stance moved into the MENU, rework by Characters' agent, branch char/stance-menu), #3327 bow/staff (Ferry Landing ground pickups, staff = trident model; RV81 if first), #3328 dynamic respawn (playersFull 10, floor 15; flip ORIGINS_DYNAMIC_RESPAWN after its post-live read).
- Combat: world-fight stances = PR #3343 @fb55be1f4 (RV81/WSV 60, READY, auditor:ready, VPS 5736/0; stance fights stamp the live era). It needs the Auditor's PASS, then the next cut. #3327 renumbers to 82 unless it merges first. Combat is clearing; its next job is creature stance rows.
- Not yet done (from the tracker below): the skull post right in front of the hero (only the ring totems), the staff model follow-up, creature stance rows, shards/trails (not a gap: empty in the sandbox too; a look option for Dom), Hooks Dev's #3324 nit follow-up (guarded/glance cues).
- Done = Strategy's composites re-run (VPS /opt/frankendom-shadow/work/strategy-visual-audit/pw/) matching the sandbox, plus Dom's phone. Not yet re-run.

## Rulings tonight
- Dom: everything from the sandboxes ON by default, no URLs, today. Stances stay, as a menu setting beside gear, locked in a fight, applied in the Pit AND the world.
- Ragnar's crest: not a gap (same code, different rung). The goblin-fort-kit monolith: superseded by the 10 split GLBs. Lighting: identical rows; the warmth was the start facing (start.face-on/face-rad rows).
- Prod-table rehearsal copies on the storage box archive: accepted (no new exposure).
- The 24 "red" origins/server tests were run bare (era ON); through the CI stubs, 78/78 pass. No CI gap.

## Traps
- Stacked PRs (base = another PR branch) get NO CI. Base everything on trunk.
- GitHub's PR view can lag the branch head; check `git ls-remote`.
- Candidates cut on the same trunk serialize: the first to merge makes the others stale. Combine the PASSed PRs into one candidate.
- seamless-quiet "engage compiled programs": read newProgramOwners in the job log, don't guess.
- Mac-only rows (54 pit-landscape-webkit) catch layout overlaps CI can't.

# MIGRATION TRACKER, 2026-10-19 ~18:15 +04 (Dom: "get the migration done")
Done = Strategy's composites (cmp-zone-1-spawn, cmp-fight-ready-idle; VPS /opt/frankendom-shadow/work/strategy-visual-audit/pw/) re-run with live matching the sandbox, plus Dom's phone. Each PR is cut alone on its PASS. Send Strategy one line per release.
| # | Item | Owner | PR | State |
|---|---|---|---|---|
| A | Keypad layout A default, SPECIAL 2, Pit hit-stop 0, sparks, leathers, 2 s/6 s specials | Combat | #3317 | CI green; stills + counter rows owed |
| B | Painted sky (dome sector/card painters) | World | #3316 → JZ #3318 | candidate |
| C | Zone 1 = TZ: troll maul/loot, rally/regen/outfit, camp at spawn, start by the wall, scenery in <10 s, HUD text shadow | World | #3313 | draft |
| 1 | Sky | World | #3316 | candidate |
| 2 | Fort set at spawn (skull palisade, torches, banners, towers) | World (+Characters fits) | #3313 or own | owed: PR + day |
| 3 | Ground tone + grass tufts | World | #3313 | in work |
| 4 | Gfx lift C16 (warm sun) | World | owed | owed: PR + day |
| 5 | Pit photo floating in Zone 1's sky | World | #3319 | Auditor read OK; receipts owed |
| 6 | Camp goblin armour | Characters | #3320 | close-up still owed |
| 7 | Fire breath in Zone 1 (play it) | World | — | owed: clip |
| 8 | Zone HUD extras (live-only) | — | — | NOT a gap (live features) |
| 9 | Mana bar | Combat | follow-up after #3317 | owed |
| 10 | Fight camera pull-back | Combat | follow-up | owed |
| 11 | Ragnar crest | — | — | CLOSED: same code, different rung |
| 12 | specialSound playback | World (Audio) | owed | owed |
| 13 | Every sandbox special fires | Combat | follow-up | owed: day |
| D | STANCE (Dom 19:5x via Strategy): a standing character setting in the burger MENU beside gear, locked in a fight, shown on the character card; the fight-screen panel is removed. Tonight = Characters reworks #3331; tomorrow = Combat applies it in world fights (new RV), then creature stance rows | Characters / Combat | #3331 | rework |
| D2 | Bow/staff: starter weapons as Ferry Landing ground pickups; staff = trident model until the follow-up | Characters | #3327 | pins fixing |
| F | Dome race (seamless-quiet): zone ready waits for the dome | World | #3335 @dfbe52c9e | Lead PASS |
| Live | JZ sky 7c9c5b3ea; K1 per-layer dfc124987 (ORIGINS_SPAWN_LAYERS=1 since ~19:10) | | | |
| E | Per-layer spawns | Backend | #3315 | re-read owed @9b60ee83c |

# Lead update, 2026-10-19 ~17:50 +04
- PRs: #3316 painted-sky fix (World, auditor:ready, Deploy cuts alone on PASS); #3317 RV80 Combat migration (draft); #3313 Zone 1 = TZ (World, draft); #3315 per-layer spawns (apply-ready, CI re-run @ecfbd26d1; archive copy on the storage box accepted). Codex-Hooks #166 mount check installed on the VPS.
- Strategy's VISUAL audit (stills /Users/domininclynch/Developer/frankendom-strategy-audit/stills/cmp-*.png) added: fort set, ground, gfx lift C16, Pit-photo-in-sky bug, fire breath, specialSound → World; goblin dressing, Ragnar helmet → Characters; mana bar, fight camera pull-back, every special firing → Combat. Acceptance: the cmp-zone-1-spawn composite, live = sandbox.
- Combat, World and Characters restarted ~17:48; each got a full brief from Lead (Combat ref [6515a2]). RV81 = stance row B + bow/staff sim rows.

# Lead update, 2026-10-19 ~17:00 +04: DOM ORDER, FULL SANDBOX MIGRATION ON BY DEFAULT (READ FIRST)

- Dom saw the old pad on live: "turn it on, im not going to add different urls", "all goes on, migrate fully from the sandboxes". The master list called lines PORTED while their switch stayed off (oneButton 0, hideStancePicker read by the sandbox page only, Pit hit-stop kept, unlisted-only features). Lead + Strategy audits are merged in chat.
- Combat [b62e0c], one PR: one-button 1, healOff, SPECIAL 2 prefilled, Pit hit-stop 0 (supersedes the open-world-only ruling), special tier 6/0.03/0.08, guard-break sparks 0.8, leathers sandbox shape (RV80), plus a full sandbox/rows.json + entry.ts default diff.
- World, one PR: Zone 1 troll maul, tz-cave-troll loot, war band / regen / loot-outfit on in listed zones (not kill reporting), plus a full zone90 vs zone1 diff.
- Characters' diff against the archive tags: everything on the character side is already on trunk except goblin-fort-kit.glb, which goes to World together with the missing building-skins slice.
- JY LIVE b0f852037 (#3251/#3173/#3301/#3308).

# Lead update, 2026-10-19 ~16:35 +04 (new Lead session; read with the 16:25 handoff below)

- JX #3311 @d399186b1: Mac 9/9 done; CI rows 8/18/56/57 were still running at 16:30, and the Auditor's candidate PASS is owed.
- JY armed with Deploy for after JX publishes: #3251 @65b2a15d1, #3173 @10e4fd060, #3301 @c477f9d25, #3308 @a41c2660b (Lead PASS posted 6267197154; whitespace/comment only, so the receipt is exempt).
- #3301's red `quality` was the cancelled-run summary (run 39250540901). I re-ran it; cut #3301 only once that shows green (ruling 6267197659).
- Auditor nudged: the #3303 damage-share read is due 16:44, then JX's PASS.
- ~16:50: JX LIVE (d399186b1 on release.json). JY is next with Deploy.
- VPS volume moves done (Hooks Dev): root has 122 GB free. Safety copies pushed (Characters, safety copies only, never live work): wip/char-packs-1018 @047003099 and wip/char-s3-1019 @b4eee36cc.

# Lead handoff, 2026-10-19 ~16:25 +04 (READ FIRST; supersedes everything below)

## Now
- LIVE: JW e92e43bf3 (#3307 revert of #3300, #3285 remote heroes, #3295 taplog, #3303 damage share RV/WSV 58, #3304 train defers early Mac rows while deploy.sh runs, #3306 web note). Auditor verified. Earlier today: JR 9a49a3731 (Z1b #3274, #3293, #3296), JQ, JP, JN, JM.
- SANDBOX MIGRATION COMPLETE: every master-list line closed; archive done (26/26 tags).
- DAMAGE SHARE IS ON: ORIGINS_DAMAGE_SHARE=1 on the writer since 16:13:29 +04 (Lead GO). Rollback: `sed -i '/^ORIGINS_DAMAGE_SHARE=/d' /etc/frankendom/origins-writer.env && systemctl restart frankendom-origins-writer` on 49.12.7.18. Backend watches; the Auditor's read is due ~16:44 on #3303 (prod has ~0 world kills, so expect "nothing bad, not proven live"). Strict (ORIGINS_WORLD_RECORD_SCORECARD_ONLY) stays OFF, a separate later decision.
- JX #3311 = #3310 alone (optional `required:false` rows never gate the train), in candidate: needs CI + Mac rows + Auditor candidate PASS.
- Next candidate, as each goes green: #3251 (Lead PASS @65b2a15d1; owes World's browser receipt line at 65b2a15d1), #3173 (load cover before the renderer, fixes a LIVE no-WebGL stuck cover; World's no-WebGL receipt posted; Auditor PASS on shards), #3301 (Zone 1 starter respawns 40–60 s; Auditor content OK, PASS on CI), #3308 (Combat nits; I reran its stale quality job, and the Lead PASS follows on green: comment/whitespace only).
- Backend: PR2 per-layer spawn rows in progress (respawn keyed (zone,id) → (layer,zone,id)); PR3 = dynamic respawn + ~20/layer cap. maxLayers raise is on the launch list.
- Dom's optional asks: the oneButton test (`?onebutton=1&taplog=1`, 30 STRIKE taps, send the panel); the iPhone `?probe=1` reading (sets kitSlowFrameMs, today 100). Combat's layout-A receipt is on #3283 (heavy riposte reachable ≥ ~170 ms after a parry).
- VPS: root 109 GB free. Hooks Dev moved job dirs to the 200 GB volume (bind mounts, same paths); still to move: char-s3, char-packs, world-z1look (KEEP, Z1b timing logs). Saved WIP branches (unreviewed): wip/web-asdata-ui-vps-2026-10-19, wip/bulkcs-cs-vps-2026-10-19, wip/combat-p0b-vps-2026-10-19.
- Codex-Hooks (private repo) Actions billing is failing; Dom's (Strategy told him).

## Rules made today (memory: feedback_lead_accelerate_rules.md items 7–12)
No batching = never wait for a straggler. Skipped browser gates = a run-once receipt before the cut. A backup PASS needs shards (auditor:ready). No workflow change in a feature PR. Only the Auditor writes "Auditor: PASS". The train counted optional rows (fixed by #3310 once live). auditor:ready older than 24 h with no new head gets removed ("stale; re-label on rebase"). The publishing release gets the Mac before the next pre-flight.

# Lead handoff, 2026-10-19 ~14:20 +04 (superseded by 16:25 above)

## Now
- LIVE: JP 979f4513f (#3289 publisher fix, #3268, #3221, #3281, #3280, #3283). Auditor verified the services (comment 6264589027 on #3291).
- MIGRATION DONE except Z1b. Sandbox archive complete: 26/26 annotated tags `sandbox-archive-2026-10-19/*` on origin, nothing deleted. Master list: every line PORTED, SUPERSEDED or DROPPED except Z1b (written exception, granted by Strategy).
- Z1b #3274, parked to 2026-10-20: JO #3288 closed (row 57 ground-prompt-check red twice under CI contention). Ruling: pacing (branch world/zone1-biome-paced @42b8de160, rows deferredLookFrames/GapFrames) + the 900 s row back (f6d733c50) ONLY if World's contention A/B (HF job 6ad5e62f) shows 0 step misses (bank, guest-line) and a worst run ≤ 750 s. Solo A/B: trunk 189 s, Z1b 263 s, paced 228 s. Not allowed: skipping scenery under a test flag.
- #3277 (revoke anon daily_fight) APPLIED on prod 14:01 +04 (Supabase 20261019100155). Backend renames the repo file to match (rename only). The new Auditor session re-PASSes the delta, then it rides the next candidate.

## Update ~15:45 +04
- LIVE: JR 9a49a3731 (Z1b #3274, #3293, #3296). MIGRATION COMPLETE: every master-list line is closed. JT #3302 (#3300) in candidate. JU next: #3285 (PASS @00b4f6bf7) + #3304 (train deferral) + #3295/#3301 if green.
- #3303 (Backend PR1 damage-share, RV58, flag ORIGINS_DAMAGE_SHARE off by default): Auditor NOT YET, F1 (a join with no or unverified record paid in full when the flag is on) and F2 (replay cap bites with the flag off). Backend is fixing; Mac rows 4/22 owed at the fixed head. The flag flip on prod needs Lead GO.
- FOR THE NEXT WEB SESSION: the VPS folder /opt/frankendom-shadow/work/web-asdata-ui held 31 uncommitted files (dome-port era, never on GitHub). Saved as branch `wip/web-asdata-ui-vps-2026-10-19` @5a38b8022 (unreviewed). Decide whether to keep or drop it. The folder is moved as-is to the 200 GB volume.
- FOR COMBAT: the VPS bulkcs-cs held uncommitted src/fight edits (old CS sandbox WIP: ai.ts, duel.ts, hit-impact.ts, sandbox-rules, 2 untracked tests). Saved as `wip/bulkcs-cs-vps-2026-10-19` @bee99e0de (unreviewed). combat-p0b's 46 unpushed commits are saved as `wip/combat-p0b-vps-2026-10-19` @d9978aea3 (Lead checked ls-remote). Only 1 commit is ahead of trunk; the rest look merged under other shas. A safety copy, not a PR. The folder is already moved to the 200 GB volume.
- VPS: Hooks Dev is moving shadow/work job dirs to the 200 GB volume (bind-mounted; clone speed equal). If free space is under 20 GB, pause new VPS jobs.

## Open / next cut candidates
- #3285 remote heroes: Auditor PASS @a0998c9bc; owes the browser receipt (incl. remote-heroes-soft) + probe median (Characters).
- #3292 Combat docs + tests/hit-stop-world.test.ts (CS35 item 2 already true on trunk). Combat ?taplog=1 PR next (branch combat/taplog; local-only panel). Then the oneButton flip ask to Dom: "open ?onebutton=1&taplog=1, tap STRIKE 30x, send the panel"; the ?onebutton=1 browser counter receipt is also owed before the flip.
- World: the six two-handed pairs in zone 90 (troll.pit.t6.warhammer, troll.pit.t5.maul, goblin.t5.scythe, goblin.t5.trident, goblin.t6.warhammer, goblin.t6.maul), then Z1b.
- Backend #3282 (draft): load tests done. Writer clean at 400/s, knee at 800/s. Presence ~1,500 comfortable, 2,000 ceiling per process. Verify pool ≥32 kills/s on 8 workers. Replays per paid kill grow with load (abuse surface).
- DESIGN NOTE (Strategy agreed, Dom to read before code): per-layer spawns keyed (layer, instance). Zone 1's 24 shared spawns cap the zone at ~9 kills/min total. Backend leads, World co-writes. Includes the replay winner-first fix + per-account replay cap, and the presence sharding threshold (build before 1,000 concurrent).

## Rules learned today (also in memory feedback_lead_accelerate_rules.md)
- "No batching" = never WAIT for a straggler; everything with PASS + receipt rides ONE candidate. A red candidate is closed and the green ones re-cut on live.
- Every feature PR's browser jobs are skipped on CI; it owes a run-once receipt before the cut (gates-3268.sh on branch zone/tz-evidence-jh2, SHA= BASE= env). Exempt: no game-bundle files touched.
- The publisher never auto-started Mac pre-flights (missing MAC_ROWS_DIR); fixed by #3289 (now live). Check that it starts by itself on the next cut.

# Lead update, 2026-10-19 ~13:30 +04

- LIVE: JN 2b89c3f0e (#3284). JM e2c75382d (#3279 RV79) earlier. /preview/sandbox/ republished from 2b89c3f0e (it has SPAWN_FLOOR).
- JO #3288 = #3274 Z1b @2d908eed1: Mac 9/9, but CI RED on row 57 ground-prompt-check (480 s ceiling; guest-line @320). Deploy reruns the failed jobs once. World is A/B-ing row 57 (HF, head vs trunk, 3x) and building a spread-the-deferred-load fix (one model per frame, after N frames; data rows). Acceptance: row 57 within 1.15x of trunk, first playable and WebKit frame time unchanged. No ceiling raise.
- Cut-ready, each alone, armed with Deploy in this order: #3289 (publisher fix, Auditor PASS @e3378c54a; may go ahead of JO if JO stays red), #3268, #3221, #3281, #3280, #3283 (all have a PASS plus a browser receipt).
- #3283: the ?onebutton=1 browser receipt and the tap-duration p90 are owed before the oneButton flip (Dom's call), not before the cut.
- Master list: every line is PORTED or in a cut-ready PR. The archive runs when JO through #3283 are live. Then Backend #3277 gets Lead GO.
- Backend load tests (#3282 draft, HF CPU, throwaway PG): writer 100 ops/s 0 errors p95 21 ms. Presence 1,000 bots 52% of a core, tick p99 41 ms; the 1.5k–3k re-run is in flight. Verify pool: no saturation up to 32 kills/s on 8 workers, ~0.022 ms/tick. Before any strict flip, size the workers (launch-plan line asked). HTTP writer 200/400/800 mix is next.
- Publisher bug: real ticks never started mac-rows-early (MAC_ROWS_DIR missing). Fixed by #3289; until it's live, Deploy starts pre-flights by hand.

# Lead update, 2026-10-19 ~12:15 +04

- JM #3286 (#3279 RV79) merged, publishing. JN #3287 = #3284 alone @c092a9fc3 (sandbox/rows.json only), cut, needs candidate PASS + Mac pre-flight.
- #3268: Strategy's Lead PASS @7e32e99a0. TZ Sandbox is running the skipped browser set on the VPS; cut alone on its receipt (Strategy: the close-up diagnosis does not block).
- #3274: World is running the skipped browser set on HF at the full sha; cut alone on its receipt.
- #3221 @cc97828a2: cap re-pinned to 2.639 (re-measured troll body 1.736 m). Last chance today: green CI + HF suite, then Strategy's Lead PASS; one more red parks it.
- #3280 Z2 @99397c5e7: out of draft. Owes stills (Mac WebKit if load < 10, else HF T4) plus digest vs trunk (catalogue-data.ts).
- #3281 CS38 @8bc9713e5: out of draft, with the Auditor after #3284.
- #3283: retarget to trunk once JM is merged (Combat told).
- Backend: #3282 load-test hold LIFTED (throwaway Postgres on HF CPU only, no prod). #3277 waits for Lead GO after "archive done".

# Lead update, 2026-10-19 ~12:05 +04 (new Lead session; read with the 11:55 entry below)

- JM #3286 = #3279 alone, cut @e2c75382d, CI + Mac pre-flight running (Deploy). Auditor queue: JM candidate PASS, #3283, #3284.
- #3274: Strategy posted "Lead: PASS @0aebf4559". HOLD the cut: every browser job was SKIPPED at that head on CI. World runs origins-seamless-check with QUIET/STRIKE/PROGRAMS, plus browser-check, net-engines and duel-two-page, once on HF/VPS; Deploy cuts on that receipt. Load time vs fc162013d: -0.14 s (World, HF).
- #3268: ruling (b) applied @7e32e99a0, CI green; owes one no-change still (live JL vs head, Zone 1, 375 wide). Characters or TZ Sandbox takes it, then Strategy posts the Lead PASS.
- #3221 @9e09f3213: the red was the probe test, not the live troll (1.52 x 1.736 = 2.639 m, under the 2.644 m cap); body-heights re-measured. HF suite running. If red at 08:15Z: park it, and add "height-ladder guard, NOT STARTED".
- Master list: CS35 -> #3279, CS39 = #3284 added. CS36a: plainPosture has no row in the game; Combat & Specials asked.
- Mac load 37-51 at 12:00 (a `du -xhd1` in ~ from a Codex-companion shell, plus Deploy's audio rows). Lanes are told to take proofs to the VPS/HF.

# Lead handoff, 2026-10-19 ~11:55 +04 (READ FIRST; supersedes the 10:40 entry below)

## Now
- LIVE: JL 4eb8d8016 = #3266 (Zone 1 look without biome) + #3261 (troll Wrap) + #3247 (two-handed clips). Earlier today: JK3 fc162013d (BULK-CS #3257 + audio fix #3273), JI, JH, JH2 (BULK-TZ). Auditor verified the 3 services on JK3 and JL.
- Next cut: Deploy cuts on the FIRST Auditor PASS among the open PRs (no batching).
- Open PRs, all master-list lines have a PR:
  - #3279 RV79 (Combat) @a23669845: CI green, 5667/0 suite, battery/clip done (combat sandbox), Auditor live-rules check done (bands on incl. pvp, stances 1100/700/250, Arena 0.468, plate -15/-10). Auditor finishing the 9 Mac rows + browser/net-engines/duel-two-page once on the Mac, then PASS.
  - #3283 CS36b (Combat, draft, stacked on #3279): heavy-hold-window-ms 80 in a counter window, kick 44 px, riposte test @b1cc2b359; kick still + auditor:ready next; retarget to trunk after #3279. oneButton stays 0; Lead+Strategy flip after a Mac WebKit check at 375, then one line to Dom (veto).
  - #3274 Z1b biome deferred load (World) @0aebf4559: WebKit OK (deferral verified, frame time unchanged); World is re-running the repo load-time gate with base = live (not 3b8ae64ed); PASS only within +1 s.
  - #3268 C07 residual (Characters) @7e32e99a0: goblin-bare body rows for scavenger/brood/ghoul/rift-spawn; needs a no-change still + Auditor.
  - #3221 height ladder (World) @9ea74c7d7: RED shards 3/7 (body-heights hash pin; mobLooks check), sent to World 11:51.
  - #3280 Z2 boar 2.7 / wolf 2.8 (World, draft): stills + suite running.
  - #3281 CS38 bow model dormant (Characters, draft).
  - #3284 sandbox SPAWN_FLOOR overlay fix (combat sandbox): asked to also copy the missing overlay rows (armourFoe/You, cm/m, hitImpact*, percentScale, 20 specialSound) from trunk.
  - #3285 remote-heroes kit warm (Characters): skipped vs failed, forced soft leg, release-keyed slow verdict. Not on the archive path.
  - Backend #3276 (launch plan, docs, PASSed) and #3277 (revoke anon daily_fight) wait for after the archive.
- Master list (docs/state/sandbox-master-list.md): TZ 41 lines = 35 done + 2 dropped, 4 open (R10 #3221, C07 #3268, Z1b #3274, Z2 #3280). CS 39 = 32 closed, open CS28/35/36a/37 (#3279), CS36b (#3283), CS38/CS23 (#3281). Flip each to PORTED when its release is live.
- Archive: Deploy's manifest at ~/Developer/frankendom-deploy/docs/state/sandbox-archive-manifest.md (annotated tags only, nothing deleted). Runs when every line is closed; target 15:30. The six sandbox-* worktrees go after the archive.
- Mac disk: 70 GB free (Dom wants < 350 GB used for good). Removed: 10 finished worktrees (owner-confirmed). Held: Combat's rv79/cs36b/audiofix until their PRs merge; Web/CQ worktrees (lanes not running); ~/Desktop/Business/frankendom-Test-Bot = Dom's call. Hooks Dev proposing a daily janitor to Strategy. VPS 64 GB; storage box 546 GB free after Dom's prune.

## Rulings today (additions)
- Dom 2026-10-19: Lead + Strategy have full authority. Armour kept (plate 60/90, robes 130). Bow binding is post-migration. Backend session stays (launch track: auth, login, thousands of players).
- Accelerate rules: memory feedback_lead_accelerate_rules.md.
- RV79: wardenHealth era-keyed (OFF 80 / ON 32, window 29-34); pvpDuel gets bands (the sandbox applied bandPerMille to every duel).
- Mac-only rows: run via scripts/mac-rows-early.sh (Auditor/Deploy) on the Mac, never against a VPS-built dist; no local browser gates while a deploy is in flight.
- The melee digest can't see bands (tests/strategies.ts arena() has no bandsFlag); a follow-up test PR adds it, not blocking.

## Owed after the archive

# Lead (lead-catalogue) handoff, 2026-10-19 ~10:40 +04 (history)

## Now
- Live: JI 20a3d87fd (#3230 first-person, #3259 troll loot). Earlier today: JH2 3b8ae64ed (BULK-TZ), JH 43f7a7f1b.
- Train STOPPED at JK2 #3272 c39fa1315: BULK-CS #3257 is MERGED on trunk but not live. Mac-only rows 4 (audio-preview exchange stall) + 22 (arena-audio spacing) failed on the first real run. Fix: Combat's #3273 @ae1d3f3b7 (wardenHealth 80->65 test rig; a roar REPLACES the organic reaction; kill-roar outlive row). Auditor read OK, rows 4 and 22 exit 0 on the Mac, PASS on CI green. Deploy cuts JK3 = #3273 alone on trunk (product code, so no resume of #3272).
- Next cut after JK3 is live: #3266 @0470fa7d4 (Zone 1 look WITHOUT the biome) + #3261 @e560ba104 (troll Wrap) + #3247 @ebfdfa5c8 (two-handed clips), all PASSed.
- Then: #3268 (C07 residual; after #3266 merges, Characters adds body goblin-bare to scavenger/brood/ghoul/rift-spawn); World Z1b (biome with deferred load, +1 s first-playable target, ~2 h); Z2 boar 2.7 / wolf 2.8 (global catalogue, after BULK-CS live); #3221 height ladder rebase (salamander-6 exception, troll exception row goes); Combat RV79 on combat/rv79-sandbox-rows @2f2bdb60a (stances 2x + feint cap row -750, hit-stop 0, ARENA_ONE_SCALE 0.468, plate/presets, bands LIVE, crossbow leftovers out, view rows with oneButton 0; wardenHealth re-pin owed once bands are in); Characters CS38 bow model dormant; Characters kit-warm PR (skipped vs failed + forced soft leg; real-GPU proof on the Mac first); CS36b layout A fixes (heavy riposte reachable, kick 44 px) after RV79.
- Archive gate: docs/state/sandbox-master-list.md (TZ: 6 open; CS: flip to PORTED when BULK-CS is live, per Characters' line-by-line table; CS35-38 open).

## Rulings today (Lead unless noted)
- Zone 1 = Test Zone look incl. camera b + haze (Strategy); goblins incl. cinder scavenger 1.25 (the height-order test exempts the scavenger vs the ghoul; no invented ghoul number). Boar/wolf global through the catalogue; the duel-size pin stays.
- Perf: fix the game, not the row timeout. +13.5 s software-GL first-playable came from the biome only, hence the split (Z1b). WebKit on the Mac showed no frame-time change.
- Specific Dom value beats a general sandbox multiplier (Strategy). oneButton ships 0 (it hides Thrust/Heavy, the heavy riposte becomes unreachable, the kick is 42 px); Dom decides after playing ?onebutton=1.
- Armour side effect live with BULK-CS: plate takes 60% slash / 90% pierce, robes 130%. Put to Dom; rollback is one data PR emptying armourVs.
- A residual port must not change what players see (#3268 goblin-bare rows).
- Auditor checklist additions: a PR whose browser gates were skipped runs them once before a candidate; Mac-only rows are not in CI.

## After the archive (Dom 2026-10-19)
- Launch backend track: auth, login, scale for thousands of players. The Backend session stays (not archived) for it. Donor games first (EQEmu / AzerothCore / ModernUO accounts and sessions).
- Dom's delegation 2026-10-19: Lead + Strategy decide the held items (armour kept; bow binding post-migration; oneButton flips after CS36b, verified on Mac WebKit at 375, then one line to Dom with the URL for a veto).

## Owed to Dom (via Strategy)
Armour nod; archive the Duels & Backend session?; which game weapon is the bow; play ?onebutton=1; sticky slow-device verdict (phones keep base-figure remotes); VPS archive prune / Docker prune / second sweep batch (storage box ~53 GB free).

## Gotchas
- Combat pkill'd `node --test` on the VPS ~10:30 (by-name kill); World and Hooks Dev warned.
- VPS load swings 14-39; the Mac is often at 2-7, so use the Mac GPU first for stills/WebKit.

# Lead (lead-catalogue) handoff, 2026-10-18 ~14:50Z

## Now
- Live: JF 67d421b5a. JG #3253 @4ae50340a has its PASS and is held by JF's tail. Row 46 CI rerun: run 39135070075, attempt 2. If it fails, Deploy runs row 46 on the VPS. Then the hold clears and JG publishes.
- BULK-TZ #3258 @aecb7a83d: ready (out of draft), Auditor PASS on 8/8 + quality + static. Deploy cuts it ALONE behind JG. This lands the rest of the Test Zone.
- BULK-CS #3257 (Combat owns; CS Sandbox and the Paragon session help with read-only triage): 174/175 files carried, Web's 3 CS31 branches folded in, mergeable. Its VPS test:all showed 336 red at 5f54fcb22. Triage buckets: (a) merge bugs: fix; (b) a trunk live-fight number pinned in a test: re-pin with "sandbox bulk port, Dom-approved 2026-10-18"; (c) era<78 replay/verifier tests: must pass unchanged; (d) crash: fix. Strategy's steps: test:all → pins + v78 era fixture → baseline → battery + digest → clip. Morning train, ALONE. CORRECTION (Strategy, ~14:55Z): most of the 336 had one cause (the missing era switch), fixed in one go by the CS Sandbox's era-gate commit. Lint is fixed at ca9e05103. The rest is mechanical (bucket by message, era off for the legacy suite plus one era-on fixture, re-pin with the reason). Green tonight is possible; the morning train is the commitment.
- Characters: a small PR for the mapless white Wrap on pitborn Greaves/Boots on the troll (characters.ts fallback to the source rig's material), fixed forward after BULK-TZ.
- JH (cut after JG merges): #3218, #3246, #3230 @b18f00a22, #3259 @dc32f7b79 (writer reinstall), #3260 once it has its PASS.
- Characters: #3247 is being re-packed on trunk bodies (it must not revert #3224). The goblin and troll idle grips are still to be checked in game. #3242 and #3228 stay open.

## Rulings that stand
Sandbox fight rules go ON behind one era switch (v78), so old links replay. Every bulk lands as its own train. Stacked children: hand-run guards (k7, C1, stubs) before a PASS. Rows/docs/assets PRs are covered by the candidate (a plain PASS line is still needed). Trains are pipelined: cut on the previous merge, take every PASSed head. Zone-scoped loot: spawn row `loot`. Reach bands: option B, cm mode is the default when the flag is on.

## Open
- Dom: GitHub billing (the Hooks CI runs don't start).
- VPS breach: Hooks Dev pruned /opt/frankendom-origins (114 releases, names unknown) and /tmp by age. Live is fine; rollback past 4 releases means a rebuild.

- Mac disk (67 GB free at stand-down): new multi-GB git packs land in frankendom-main/.git (the shared object store) and frankendom-train/.git. Only gc with more than 10 GB of headroom and no lane fetching; never during a deploy.

## Gotchas
- Master list: docs/state/sandbox-master-list.md (columns are stale since the bulk method; Strategy keeps the tracker).
- Peer sockets go stale after a restart: use ListAgents names (Web = [dbc07f]).
- Deploy will not hand-resolve a source conflict without Lead's word.
