# Deploy lane — state

## Web server (nginx on the VPS)
- The vhost is repo-managed: `deploy/frankendom.com.conf` is the source of truth. `scripts/provision.sh` copies it to
  `/etc/nginx/sites-available/frankendom.com` on `root@49.12.7.18`, runs `nginx -t`, rolls back to the previous copy on failure,
  and reloads. Nothing about the server is configured by hand on the box; change the file, merge, run `scripts/provision.sh`.
- Site root is `/var/www/frankendom/current` (a symlink `scripts/deploy.sh` flips per release); `release.json` and `/assets/` are
  served straight from it.
- Short share links (2026-09-22, beta): `location ^~ /s/ { try_files /index.html =404; }` — `GET /s/<anything>` serves the app's
  `index.html` (no cache), the client reads the id from the path. `/assets/` and `release.json` are unaffected. Verify with
  `curl -sI https://frankendom.com/s/1a` → `200`, `content-type: text/html`.

## Batch deploy policy (standing, 2026-09-25)
Strategy ruling, from Dom ("deploys are too slow"), relayed by Lead on 2026-09-25 ~22:00 +04:
- Each run takes every PR that Lead has marked READY and that is mergeable at launch. Docs-only PRs ride along.
- Cap: about 5 non-sim PRs and at most ONE record-version (RECORD_VERSION) bump per run, so a failure is easy to pin down.
- Before launch, Deploy verifies the combined trunk tree itself: `npm ci`, `npx tsc --noEmit -p .`, `npm run typecheck:tests`, `npm test`.
- A failing release row: revert ONLY the suspect PR (`git revert -m 1 <its merge commit>`, via a revert PR) and rerun. Never revert the whole batch. (First use, 2026-09-25: #752's lock camera failed row 25 decap-front-goblin-gate twice; #757 reverted only #752, and the next run passed.)
- Lanes hold browser and heavy test runs while Deploy holds the lock. The guard catches the commands it knows; Lead enforces the rest.
- Every release row's start and end line, and every deploy step banner, carry wall clock and 1-min load (`started at HH:MM:SS (load N)`), so a slow run shows which rows ate the time.

## Rollback (one command, 2026-09-25)
- `scripts/rollback.sh` puts `previous` back live in seconds (deploy.sh already keeps it: it repoints `previous` at the outgoing
  release before every switch), then re-runs the live check: `release.json` names the target revision and the served
  `assets/index-*.js` still carries the Supabase host. `scripts/rollback.sh <sha40>` targets a named release instead;
  `--dry-run` changes nothing and prints the swap plus a live check of what is up now. It refuses while deploy.sh holds the lock,
  and it moves the daily verifier's `current` along when that revision's verifier directory exists. A second rollback is a
  roll-forward. After a rollback, trunk still has the bad PR: revert it (suspect-only rule) before the next deploy.

## Now (2026-10-01 10:45 +04) — supersedes the 09-30 block below
- **Live: `0895d84c`** (run BN, 09:36): #1194 T4 wall-row box (default OFF) + #1185 SM shield carry + #1196 arena stills + #1176 gate audio (dormant) + #1198 pit state doc. 50/50 rows local, 0 trusted, no hf job. VPS current 0895d84c / previous 0f9a09c1. Box FREE, nothing running.
- **Next (Lead GO'd, not fired):** run BO = #1192 World Pit extra/ `6955ce06` then #1182 Finishers blood edge `5df7c057`, all rows local, `HF_WALL_ROWS` unset. Fire only on AC power at >= 20% battery (the Mac was on battery at 26-28% at 10:45). Re-check both heads, CI and trunk first. Docs #1205 (`docs/state/executioner.md`) may ride or merge docs-only.
- **Preview-only owed after BO (no trunk merge, no rows):** #1120 Hades' Shadow v3 from exactly `d6ae070d`; #1202 World Pit stone-full from exactly `4e96966f` (Dom's `?perf=1` phone reading). Send Lead the URL + HTTP 200. #1120 never joins a trunk run (stacked on Combat's unreleased sim).
- **Done 09-30 evening to 10-01:** BL e65a6d8d (#1190 #1189), BM 0f9a09c1 (#1184 Pit gate light + #1193 row-22 fix; 50/50 local, first run with row 50 pit-exit-check), BN 0895d84c. #1191 merged (this doc + the disk precondition).
- **Open:** HF FREEZE (Dom via Strategy): no HF jobs of any flavour until Dom rules; the T4 shadow run needs his direct yes in the Deploy session. #1197 gate arch (Dom's look) and #1188 gloves (rework) are not ready.
- **Gotchas:** (1) Run scripts live in `~/Developer/deploy-run1/runB?.sh`, each generated from the previous by a python file; `runBN.sh`/`runBO.sh` carry a `to` wrapper (perl alarm 60 s, one retry) around every gh/ssh call because `gh pr checks` hung 27 min twice on 10-01, an AC-power >= 20% wait, and a `df -g /` >= 20 GB stop. GO token = the full shas space-separated with no trailing space. (2) Ran-green rule (Lead 09-30): a PR that touches src/index.html/style.css gets no hand-trusted rows; the Published line lists any trust with its source. (3) The 10-01 disk cleanup deleted the local preview dists for `pit`, `hades`, `hitfx`, `pit-stone`; refresh them server-side with `cp -al <previous release>/preview/<p> <new release>/preview/<p>` after every publish. `pit-stone-c59` and `hades-claw` still have local sources. (4) Release suite is 50 rows; the run script's receipt grep still reads `/49` from older logs, row 50 always runs locally. (5) Scratch trees bf bg bh bk (~1.6 GB each) are throwaway.

## Now (2026-09-30 21:1x +04) — supersedes the 09-29 block below
- **Live: `64d13481`** (run BK, 21:04): #1183 rebake sRGB + #1137 Pitborn L1 + #1145 Shieldmaiden L1. VPS current 64d13481 / previous 103af669. Box FREE, no hold, nothing queued; next run waits for Lead's "GO run B?" with full shas (Strategy relays when Lead is throttled).
- **Done today (all verified: release.json, index cmp, VPS, supabase.co, v:20; Published lines sent):** BE c59d4a46 (#1163 #1164 #1171) → BF 1be74bb3 (#1150 + 6 docs) → BG c3714f78 (#1173) → BH 43b7bc35 (#1172 #1148) → BI 714b5c43 (#1175 #1178 #1156; #1182 blood-edge DROPPED, Dom rejected, draft) → BJ 103af669 (#1181 #1177 #1140) → BK 64d13481. Gate each time: test:all + build + check-budget on the merged scratch tree, sha-pinned merges, tree assert; local rows = release-rows-for delta plus 37/38 (+2, 4, 46); the rest trusted from earlier local pass receipts (`DEPLOY_TRUST_ROWS` + reason).
- **Open:** (1) Previews on the live release dir (`/preview/{pit,hades,hitfx,pit-stone,pit-stone-c59,hades-claw}/`) must be re-copied after EVERY publish (scratchpad scripts `pc.sh`, `pitstone-copy.sh`, `c59copy.sh`, `hadesclawcopy.sh`: sed the sha8). `hades-claw` (#1120 ae51f92e, preview-only) stays up until Finishers says done. (2) Stop-hook audit is down until Oct 5 23:00 Dubai (reviewer account weekly limit) — not a repo defect. (3) Published lines for BE–BK were not yet appended here; this entry is the summary.
- **Gotchas:** per-run scripts live in `~/Developer/deploy-run1/runB{E..K}.sh`, each generated from the previous by a python file (NOT `sed -i` with `/` paths; zsh does not word-split `$VAR` so put ssh options in a bash script). `check-budget.mjs` needs `npm run build` first (no `dist/` in the gate worktree). The script stops only on FAILURE checks; pending/cancelled CI is tolerated when Lead says the gate is the receipt. Stacked PRs: check `git merge-base --all trunk <outer>` prints ONE base before GO. Name release rows by script, not number, in messages to Lead.

## Now (2026-09-29 06:3x +04)
- **Live: `b10a9f3f`** (06:28, run AA v2: Nightborn + Dwarf rank looks L2–L10 + phone tiers, #1025 #1030 #1037; RECORD_VERSION 20). Verified: release.json, VPS current b10a9f3f / previous 73a9a6ce, index cmp, supabase + v:20, / + /s/1 200, verifier current == b10a9f3f, verify-loot --dry errors [], claims pending 0 / held_v19 0. 48/48 real, 0 FAILED. Box FREE at handoff; no GO outstanding.
- **Release suite is 48 rows** since run Z (row 48 `browser-replay-check`: browser vs Node replay, 11 fights; wired through `.quality-gate.json`).
- **Run scripts (09-29):** `~/Developer/deploy-run1/runN-template.sh`. Copy it, set TREE_WANT/TRUNK_WANT/ORDER/PAIRS. `--pre` exits before ANY write; merge refuses unless `GO="<Lead's full sha list in ORDER>"`. Never "dry-run" a script without grepping for the `--pre` line (run Z incident, 05:04). Pre-check with `runN.sh --pre`; gate test:all on the simulated tree; merge only on Lead's GO token.
- **Stacked PRs:** before the GO, for each pair where one PR contains another, `git merge-base --all trunk outer` must print one base (see the deploy-run skill); otherwise GitHub refuses the second merge (run W #1047).
- **Box discipline (Lead, 09-29):** take lock + deploy_hold only while the gate or the run is on the box; release during long CI waits and watch CI read-only; re-take after any mid-slot lane says "slot done".
- **Verifier (since run Y, #1060):** `/etc/frankendom/verifier.env` holds DATABASE_URL + SENTRY_DSN (root:600); unit StateDirectory=frankendom-verifier (/var/lib/frankendom-verifier). Pending/HELD counts: `~/Developer/deploy-run1/claims-count.sh both` (read-only psql over the VPS).
- **Strict CI count (09-28, Strategy-approved):** green = every check SUCCESS or SKIPPED, 0 pending; CANCELLED and TIMED_OUT are NOT green (#896's CANCELLED row 38 was counted green 02:44 and launched; row 38 passed real on the Mac). Watchers count N explicit green lines, never "no non-green lines" (an empty gh reply read as all-green at 00:51). Check `isDraft` before merging anything (#931 draft half-merged run 3 at 02:13).
- **Budget:** check-budget TOTAL 44,000,000 gzip excludes the rank looks (own 22 MB line). Headroom after the batch ≈ 200 KB; measure a local build of the combined tree before merging anything that adds assets (Lead 05:0x). TOTAL is not to be raised.
- **deploy.sh auto-trust:** rows green on CI release-checks for the same tree are trusted automatically (`ci-trusted-checks`, e.g. 44 rows at 15704a80); that is not ruling trust. Ruling trust (`DEPLOY_TRUST_ROWS`) is retired since #920 + #928 fixed rows 47 and 37/38.
- **Routing:** row failures and gate/CI questions → "Frankendom - Lead Developer"; batch id + Published → Lead + Strategy. When Lead is down, Strategy.
- **Authority (Dom, 09-27 ~09:45, in chat):** Strategy (CEO) and Lead (COO) carry Dom's authority. Their exact-sha READY/GO is Dom's word: gate, merge, launch. Ready + green ships; don't hold for Dom personally. A red gate or a failed row still stops the run.
- **Deadlines (Dom, 09-27 10:1x, all lanes):** never give an extended deadline or a later time. Everything is NOW or ASAP; if it can't happen now, name the physical blocker (the box busy with row N/47, a red gate, a battery with minutes left, an HF quota), never a day. Dom added "and especially the lead dev and the deploy dev": a READY set launches as soon as the box is free and the gate is green, never at a slot or a day; Deploy's only times are the ones a run physically takes.
- **When Deploy's own pre-merge gate runs (Strategy 09-27 16:1x, standing):** it RUNS on the combined tree when a batch has two or more code/data PRs (they can interact; CI never saw that tree). It is SKIPPED when a batch is one code PR at a CI-green head plus docs-only PRs (CI tested exactly that tree; deploy.sh's own quality gate stands behind it). Docs-only batches never gate. When it runs it is `npm ci`, `eslint src`, `tsc`, `typecheck:tests` and **`npm run test:all`**, never `npm test`: `npm test` skips `[slow]`, deploy.sh runs them, and 09-27 10:34 RV16 #897 passed `npm test` and went red on trunk. Gating caught #878 @ a6008a47 (08:1x, 1 fail) before merge.
- (Release suite: 48 rows since 09-29; see above.)
- **Pre-launch (Strategy, 09-26 night):** `pgrep -fl "codegraph sync"` must be empty; SIGTERM an orphan and tell Lead.
- **Retries keep their first failure (#798):** a retried row writes `<n>-*.retry.log`, and a passing retry prints the first attempt's last 40 lines into the deploy log.
- **Mode (Dom, 09-26):** round the clock. No launch stops unless Dom names one; launch whatever is READY + green whenever the box is free. **No waiting on load** (Strategy 09-27 10:2x): Lead pauses lane batteries during a run, and a row that times out on load takes its solo retry.
- **Claims verifier checks after a publish:** the log line `loot verifier timer armed on /opt/frankendom-verifier/<sha>`; VPS `systemctl is-active frankendom-verify-loot.timer`; and `cd /opt/frankendom-verifier/current && set -a && . /etc/frankendom/verifier.env && set +a && node scripts/verify-loot.mjs --dry` (the env is `/etc/frankendom/verifier.env`, the unit's EnvironmentFile, not a file in the release dir) → `errors: []`. The DB rollback `supabase/ops/202609230001_rollback.sql` is Dom-only on his own typed word; a release row failing after a migration is fixed forward, never rolled back.
- **Retired (Lead 18:0x): a "relabelled build hash" as proof that a rebuild equals an earlier build.** deploy.sh bakes the revision in (`VITE_SENTRY_RELEASE`, `data-release`), and a scratch worktree's build differed (e4f3e167… vs 7169475c…) even with identical `src`/`public`/lockfile and the same label. Trust across a rebuild comes only from `ci-trusted-checks` (same tree) or a written ruling.
- **Preview publish (Strategy 09-27 15:0x, when a release cannot make the time):** build the branch head with `npx vite build --base=/preview/look/ --outDir dist-preview` (with `.env.production.local` symlinked in, so accounts ship; check with `scripts/check-built-account.mjs`), write a `release.json`, rsync to `<readlink -f current>/preview/look/`. nginx `location /` `try_files $uri $uri/` serves it; live `release.json` is untouched and the preview dies with the next release. First use: #908 @ c726a6a8.
- **Merge form:** `gh pr merge N --merge --match-head-commit <FULL 40-char sha>` (short shas are refused); after the last merge assert the trunk tree equals the gated tree, `npm ci`, then `(nohup bash scripts/deploy.sh > ~/Developer/deploy-<sha8>.log 2>&1 &)`.
- **Verify each publish:** release.json = sha; VPS `readlink /var/www/frankendom/current`; served index.html `cmp` dist; served bundle has `rxbewmzmovelckzoosss.supabase.co` and the current `v:<N>`.
- **Gotchas:** a row failing on `page.goto` timeout at load > 100 is load, not the PR — the solo retry decides. Lanes running batteries/test suites under the lock drove load to 180 (09-26 06:17); name the pid + cwd to Lead. `git merge-tree --merge-base <current trunk>` pairwise gives false conflicts for branches forked from older trunks; check with a real sequential merge. zsh does not word-split `set -- $p` (nor an ssh command held in a variable: use an array). 09-27 16:0x `git fetch origin` hung for minutes across sessions while the GitHub API answered: fetch only the refs needed with `GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=20`. `gh pr checks` exits 8 while any check is pending: under `set -o pipefail` add `|| true`. Killing deploy.sh: TERM the release-checks tree first (headless shells may need KILL), then deploy.sh; its ceiling watchdog (`bash scripts/deploy.sh` + `sleep 3000`, parent 1) can survive and needs its own kill; then check the lock `~/.claude/state/deploy_in_flight.json` is gone.

## Done 2026-09-29
All verified live: 8f1bb783 00:02 (run V, #1036 Vlad; rerun after row 18 ceiling), 5552deaf 01:33 (run W, #1035 #1047 #1048–#1051; half-merged on a criss-cross, fixed by a tree-identical trunk merge on #1047), fc2254aa 01:57 (run X, Goblin looks L2/L4–L10 + #1056 docs), deb50812 04:52 (run Y, #1057 detmath RECORD_VERSION 20 + #1060 verifier HELD/Sentry; gate caught a #1060 test vs v20 interaction; #1059/#1055 dropped), 73a9a6ce 05:25 (run Z, #1059 row 48 + #1055; INCIDENT: runZ.sh had no --pre exit, so a dry run merged both without GO at 05:04, the launch was killed before publish, and trunk sat unpublished until 05:25), b10a9f3f 06:28 (run AA v2, rank looks; #1030 CI red on roster check → lookbake=off fix → green).

## Done 2026-09-28
All verified live (release.json + VPS current + served index cmp + supabase host + record version + /s/1 + verifier timer + verify-loot --dry): e9de068d 00:39 (run 1: 12 PRs; legends text, Audio B, #920 row-47 fix, #922 10-min cap), 6c040011 01:18 (17 PRs), a0a9275a 02:26 (#928 rows 37/38 fix + #907 + #931 Witch RV17 + #918 rank-look plumbing default off; rows 37/38/47 passed REAL), 0d3d7442 02:59 (Audio ×3, #955, #896, docs #960), 15704a80 04:49 (#964 Centurion RV18), cc1e90d7 05:03 (#961 Goblin looks ON; 47/47 real; nine /looks/goblin-L2..L10.glb 200; Auditer per-rank live proof PASS), aaef2c62 05:31 (batch #958 #965 #966; 47/47 real; budget 43,798,710 of 44,000,000 measured by a local build before merge), a3657152 05:45 (#943 claim on pagehide; Auditer NO BLOCKER). Incidents: run 1 half-merged (#936 three merge bases, fixed by a trunk merge on the branch); run 3 half-merged (#931 still a draft).

## Done 2026-09-27
All verified live (release.json + VPS current + served index cmp + supabase + `v:15`): 99f21cc3 00:22 (#865 #862 #849 #861 #863), 111d6504 01:17 (#867 #728 #868 #869; #866 #851 rode), b0e4a2fe 01:57 (#870 Hero Look legionary preview; `/herolook/legionary.glb` 200, 6,045,360 B; row 12 browser-launch timeout at load 37, solo retry passed), 26082c3c 02:18 (#871), 5cc74755 03:08 (#875; docs #872 #873 #874 rode), e44251d8 08:27 (#878 + #853, 46/46; #876 #877 rode), 474ec345 08:39 (#879), fb156516 10:00 (#884 #883 #881; docs #880 #882). Refused at gate: #878 @ a6008a47 (npm test 1 fail).
Afternoon, all verified live (release.json + VPS current + served index cmp + supabase + `v:16`): **ed385c6b 13:53 RV16 46-level ladder** (#899 #901 + docs #886 #889 #891 #892 #893 #894 #898 #860 #900 #854, + #903; row 47 trusted by ruling; row 2 goto timeout at load 84, retry passed), 899a5992 14:39 (#902 `?look=souls/shade` alone on #902's CI; 47 trusted), 7ea6feb1 16:30 (legends #904 + #909 + docs #905 #906 #910 #913; 22 + 47 trusted; 42 passed). Failed, not published: dfeb25b9 10:34 (#897 RV16: test:all [slow] 2 fails in player-weapons, fix-forward #899), 3155a1df 12:44 (row 47 both attempts). Preview: #908 @ c726a6a8 at /preview/look/ 15:1x (gone with 7ea6feb1). Evening: **70a977ea 18:09 CLAIMS** (#778 #751 #914 + #919; 7 local + 39 CI same-tree + 47 by ruling). Not published: 67d3d952 16:50 (row 14 stub expected `/rest/v1/fighter_profiles`, client calls `/rest/v1/rpc/my_standing`; stopped 17:1x on Dom's hold for his GPT run), 70a977ea run 1 18:04 (stopped before release checks; relaunched with 47 trusted).

## Done 2026-09-26
Verified live: 4c1d6af1 06:53 (#781 #782 #680 #779; rows 9+32 failed at load 309, passed solo), 0325a0b7 07:12 (#783 #790), **edf5d93f 07:40 RV14 skills** (#794 six of nine skills, #785 thumbs, #787 impact kit; `v:14` + `/s/1` still + PLAY NOW), a6e2e2bc ~08:04 (#784 scythe + docs #786 #788 #789 #775 #731 #796), 27071319 08:33 (#793 warhammer + maul), 341612cd 08:52 (#716 Witch loot, #798, #745, #773), 774bf0f7 09:10 (#792, #800), eeae57a6 09:28 (#799). Earlier: e2a52a48 (#766 Pommel RV13 + #765 + #774), bc12a665 (#768 #771 #767 #770), 5d95a691 (#769 Witch-fire v5 + #706 shield + #772 swap panel), fffe8cf9 (#777 #734 #780 #759).

## Done 2026-09-25
All verified live (release.json + served index cmp + VPS current + guard line + supabase.co):
99fac109 (#722 iOS zoom guard; run 1 at 19:33Z 09-24 FAILED under load 60–110, every row at the 900 s ceiling, nothing
published; the 04:43Z rerun at load 6 published with 36/36 CI-trusted), 3f8e5e1c (#713 weapon take + #725 charge-foe
probe), 3c8318d7 (#735 ?perf=1 readout + #733 + #739 share snapshot), ce3b9bd1 (#714 shield slot), d45cf76d (#741 sheathed
start, RECORD_VERSION 11; bundle `v:11`, `/s/1` = Nightborn still + PLAY NOW), 70b8b170 (#727 charge-glow delete + #726
loot-merge), cc27cce5 (#709 carriers, 07:52Z). Docs merged: #723 #724 #729 #737 #738 #740 #742 #618 #701 #715 #747.

## Done 2026-09-24
Night, all verified live (release.json + index cmp + VPS current + guard line + supabase.co): 9aec952c (#694, Dom's revert of
#670 Arena Draw), 33b0bf57 (#695 sim fixes, RECORD_VERSION 10 — old share links dead, Dom accepts; #697 rain perf),
40014b11 (#712). 40014b11 ran under load 70–88: rows 18 and 23 failed once and passed solo (flakes). Docs-only merges, no
deploy: #688 #674 #584 #587 #645 #652 #689 #583 #536 #640 #690 #698 #702 #703 #704 #710 #711 #720 #721.
Evening, verified live (release.json + served index cmp + VPS current + guard line + supabase.co): a5590911 (#679 Witch
charge lean B; 36/36 local rows), e37a74c7 (#682 #684 #678 #685 #687 #686 merged in Lead's order; trunk tree identical to
Lead's test merge f1c9eac0; 36/36 local rows). #683 (this doc) merged 78c24033.
Late morning / early afternoon, all verified live (release.json + served index cmp + VPS current + bundle guard line):
c90bd83b (#672 knight.glb, #673 Profile PACK), d45f4837 (#663 signature site/gate; #659 split off on a scene.ts import
conflict), 2c3dd94a (#676 fight HUD, #659 Knight Rivet B), 5f32ad45 (#677 World framework, signature ship mode ON),
174537be (#669 Witch Grasp, #681 practiceHint strings), 5655ac94 (#667 Dwarf Wound C, blood on). #675 (this doc) merged.
**2c3dd94a first attempt died at merged-on-trunk on `spawnSync gh ETIMEDOUT`** (nothing built/published); the same
`gh pr list` answered in 3 s a minute later and a relaunch of the same sha published clean.
Afternoon, all verified live (release.json + served index cmp + VPS current + supabase.co in served bundle): 4099f5c0 (#648),
0e4ba5ae (#653 guard, #654 five arenas, #655 signature effects), 6830afcf (#651 #656 #664), 13e603f0 (#670 Arena Draw A),
91d9f749 (#671). CI trust (a') first exercised on 0e4ba5ae: 6/36 same-tree; 6830afcf 8/36; later runs 0/36 (CI not done at start).
Morning:
All verified live (release.json + served index.html cmp + VPS `current`): fa0c27d1 (Run 3c), da4108ed (#637), e8d8ec00 (non-sim
batch #633 #628 #627 #631 #636 #625), c92e56df (#626), 0b648a44 (#635 parks v9, RECORD_VERSION 9), 82c3b9c1 (#641), 88229760
(#639), cff5dec6 (#644), 2a41ed4e (#643 #646 #624), 9394e8a4 (#647 CI trust a'), c0400c1f (#649 + accounts restored).
**Incident:** every deploy from a53762e (09-23 20:46) to 9394e8a4 shipped guest-only: `~/Developer/frankendom-deploy/.env.production.local`
held only VITE_SENTRY_DSN after the rehome; the Supabase URL + publishable key stayed in `~/Desktop/Business/frankendom/`. Fixed by
copying the two VITE_SUPABASE_* lines (untracked). Audit of the old root: nothing else build-relevant left behind (only
`.serena/project.local.yml`).

## Done 2026-09-23
fe0d8e0 (overnight) and 52dffed (morning). Then, all verified live: c0b321c (12:31), dd1d968 (Publish A, v6: #528 #530 #535 #521
#533 #538), b7bc78d (#540 #537 #541 #542 #544 #546 #539 #548 #549; 33/33 local), 441eb38 (fallback) and a50f22f (B', 15:20). 544bcb4 and 2d614dc
did not publish; neither did **9a53750 (Publish B, EXIT=1)**: rows 2, 11 and 12 failed on their solo retry. The cause was the
#547 Centurion swap (`veteran.weapon` trident→gladius plus `carries: ['veteran.Shield']`): polearm-veteran expects `/Trident_/`,
and the roster check counted 3 boot fetches against a limit of 2.

## Done 2026-09-22
Eighteen deploys attempted, fifteen published and live-verified (release.json + served index.html `cmp` against dist + VPS
`current` symlink on every one): dcb9d61, 3fa90c5, 0ebf409, 01b6642, 41363b7, 8650fc5, e2582b0, 4068c50, f439d43, 6c9e75b,
adb8ddd, a2a901b, a98f327, c7d942a, cb4e0ef, c43c677, 607126a. Shipped among others: the end-of-fight HUD, 40 px touch targets, deploy guards, both audio
passes, the paperdoll gear layers, PLAY NOW, the arena guard, short share links end to end (nginx `/s/` + 0009 + client), and
the kill-screen loot panel with its accidental-decline fix.

Five hosted migrations applied on an explicit relay, each md5-matched at trunk and post-state verified: 0006 fight_records
column grants, 0007 daily_board_summary, 0008 rls_auto_enable revoke, 0009 short share ids, 0010 guest share hygiene.

Four regressions stopped at the gate rather than on the phone: the #379/#380 pair (tour retime vs Rematch/arena taps, fixed
forward by #387 and #389), #418×#415 (loot layers never regenerated — fixed by running the project's own generator, #425),
#427 (loot panel's action row swallowed the post-kill arena touch — Web's #432), #435 (guard.glb fetched on every boot).

## Open
- Nothing blocking. The lorarii models re-landed in cb4e0ef (#450) with the roster check taught that guard.glb is an arena
  asset, and release row 02 passed on that tree — the fix held. History of the blocker it replaced, kept because the re-land
  pattern will recur:
- **(resolved, reverted by #442 then re-landed by #450) #435 blocked trunk.** `void arena.guards(fighterUrls['./assets/guard.glb']!)` in scene.ts fetches a 504 KB model on every
  cold load. Nine release rows fail, each twice: row 02 roster-browser-check (`fetch only hero and selected opponent` — the
  boot fetch budget, the row that makes this a product fault rather than a harness race) and rows 1/3/15/17/19/20/23/25
  finisher-preview (`TypeError: Cannot read properties of undefined (reading 'side')` — the previews inspect before `framing`
  exists). Revert is #442; Visuals re-land lazily after first paint. **Watch row 02 on the re-land**: any fetch before first
  paint fails it again whatever the timing fix.
- The endgame-HUD row is marginal with the v44 hands (a hand bone can project into the bottom button row in some death poses);
  #424 made the gate deterministic, but the underlying framing question is Character/Visuals'.

## Gotchas
- **`/s/<unknown id>` shows "THIS FIGHT HAS FADED"** (main.ts `no such fight`): that is the designed screen for an unknown
  or expired id, not the retired-version path. Test a version bump with a known real old share (Dom's `/s/1`).
- **Never launch a local-row run while lanes' browser suites or Blender are running.** 09-24 19:33Z died at load 110 with
  every row at its 900 s ceiling; the same sha published in 4 min at load 6. Ask Lead to hold the lanes first.
- **A "no deploy" trunk merge still ships in the next run**, because deploys go from trunk tip. Hold a PR off trunk entirely
  when it must miss a run (#706 before the playtest).
- **`gh pr view --json commits` through `echo | jq` breaks** on commit messages with control characters; query fields with
  `gh ... -q` directly. A guard script must fail closed when a field comes back empty.
- **`gh pr checks` prints a CANCELLED job as "fail".** Merging a PR while its CI is mid-run cancels the in-flight jobs
  (#682 rows 32/33/34 on 2026-09-24), which then read as red and produced a false URGENT stop. Read the conclusion
  (`gh pr view N --json statusCheckRollup`) before treating a post-merge red as real; those rows passed locally.
- **The built-bundle guard is a deploy.sh step, not a release row** (#653): CI builds guest-only, so a row would be red on
  every PR, and a row can be trusted away. The minifier writes the storageKey in BACKTICKS; the pattern accepts all three quotes.
- **After a merge, the next PR shows mergeable UNKNOWN for a few seconds.** That is GitHub recomputing, not a conflict: re-read
  before stopping. `gh pr checks --watch` can exit early on a network blip; poll the pending count instead.
- **Every deploy log opens with the account line: read it.** "Account integration disabled: guest-only build." is a broken
  production build, not a note, until the guard PR makes it fail.
- **A same-revision redeploy** (rebuild of the live sha) used to die at deploy.sh:79 on bash 3.2 (`link_args[@]: unbound`); #649 fixed it.
- **CI trust (a', #647):** a PR-head receipt counts after the merge only when the tree delta is docs/**, *.md or tests/ outside
  fixtures. Never decide trust from `release_triggers`: it is a curated subset, so rows it omits would be trusted across any change.
- **A stacked chain merged through one combined PR leaves the sibling PRs OPEN.** GitHub only auto-closes a PR when its commits land
  in the PR's own base; #545/#543/#547 were based on stack branches. The ancestry check (`git merge-base --is-ancestor <head>
  <combined head>`) is the proof that they shipped, not GitHub's state.
- **A roster or weapon swap in a sim PR breaks the per-opponent release rows** (polearm-veteran expects the trident; the roster
  check caps boot fetches at hero + opponent). Before merging a swap, ask whether rows 2/9–12 were re-run solo on that tree.
- **Stage the revert before the deadline.** For a fallback, `git worktree add` it OUTSIDE the deploy checkout (inside, it makes the
  checkout dirty), symlink node_modules, and run tsc + record-version-guard there before the PR exists.
- **Lint on scripts/ is not the gate:** `eslint src` is (quality:stop). `npx eslint scripts/*.mjs` gives no-undef for Node globals
  even on trunk's own verify-daily.mjs; that is a config gap, not red.
- **deploy.sh's 3000 s ceiling kills a full local run under load.** 2d614dc ran the whole quality suite plus 33 rows at load 60–100
  (other lanes' suites were running) and hit EXIT=124 mid-retry. The kill **releases the lock**, so every lane's Stop-hook gate
  starts at once and the box gets busier, not quieter. Prefer a CI-green trunk tip: with `quality` and `release-checks` green,
  `ci-trusted-checks.mjs <FULL sha>` trusts rows by tree and the publish takes about 3 min. It needs the full 40-char sha;
  a short sha prints nothing.
- **Launch deploy.sh detached** (`nohup … & disown`). A `run_in_background` shell dies with the session. 544bcb4 died mid-build
  that way, with 0 rows run and nothing published.
- **CI `check 32` (autopsy) fails on every CI run** with a `.tap()` timeout on "Enter the arena" (line 29) but passes locally
  (41–49 s). No owner yet. It only means row 32 always runs locally.
- **Combined-tree `tsc` after every merge in a batch.** It caught #478 x #488, which were each green alone. A clean revert of the
  merge (`git revert -m 1`) is the conservative unbreak when the fix is a design value that belongs to another lane.
- **Background publish scripts**: `set -euo pipefail`, an explicit non-empty revision check, and an ancestor check that the
  merge commit is in trunk — refuse rather than proceed. A watcher without `set -euo pipefail` had its `git fetch` fail, ran
  `deploy.sh` with a blank revision and died in 20 s (`deploy-.log`); 24 minutes lost believing the batch had shipped.
  Prefer fetching the sha inline in the foreground.
- **A hosted migration applies only on an explicit "apply NNNN"** from Lead Dev or Strategy, or Dom's own word. Lead merging a
  migration PR is code landing so the file ships with the deploy — it is NOT the apply authorisation.
- **`merged-on-trunk` and the PR-base check** (#378) run before the quality gate and need `gh auth`; a PR re-done under another
  number needs the old one labelled `merged-elsewhere`. Always check `gh pr view <n> --json baseRefName` equals the trunk
  branch before merging — a lane-branch base silently keeps the change off trunk (#358).
- **Deploy ceiling**: `deploy_ceiling_off` must stay the LAST command of deploy.sh's EXIT trap (it turns a ceiling kill into
  exit 124 after the lock is gone). `DEPLOY_CEILING_S` defaults to 3000.
- **`artifacts/` is gitignored and gate receipts are never tracked.** Two force-added files that a check rewrites every run made
  deploy.sh refuse to publish a fully green tree ("Release checks changed tracked files"); #389 untracked them.
- **Row-33/16/21/26 shape**: a check that fails once and passes on deploy.sh's solo retry is a flake; failing the retry too is a
  regression. Never report the first failure as final — read the retry.
- **Wake-up ids**: the id in the scratchpad path / stop-hook line is the transcript id (the `<id>.jsonl` filename) and does NOT
  resolve for cross-session messaging; the address is the `local_…` id from `list_sessions`/`ListAgents`, and a clear keeps it.
  Two lanes handed Lead an unusable id and the wake step failed silently. Take it from a live listing, never from the path.
- **Only this session runs `scripts/deploy.sh`** (one-deployer), from the scratchpad `deploy/` checkout where every
  `deploy-<sha>.log` lives — not `~/Developer/frankendom-deploy`, which is a lane worktree.
