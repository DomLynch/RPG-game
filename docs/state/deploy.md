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

## Now (2026-09-26 09:40 +04)
- **Live: `eeae57a6`** (#799 floor scatter), verified 09:28. Box FREE, queue EMPTY: nothing is READY.
- **Lead offline since ~08:05**; Strategy gives READY meanwhile. An owner lane's "ready" alone is not a READY.
- **Standing READY (Strategy):** Strategy's state-doc PR at any head whose diff is `docs/state/strategy.md` only; code-quality docs while the diff stays under `docs/`. Anything outside `docs/` → stop and ask. Merge between runs.
- **Open, not READY:** #778 loot claims, #791 daily-post retry, #795 replay `--strict`, #705 tier dressing (failing), old docs #574 #718 #699 #730 (Lead asking owners).
- **Retries keep their first failure (#798):** a retried row writes `<n>-*.retry.log`, and a passing retry prints the first attempt's last 40 lines into the deploy log.
- **Row 32** (`finisher-preview --only plainDeath --wounds`) failed at load 182 and 309 this morning and passed alone both times; #792 trimmed it, first run after 90 s at load 21. Watch it under load.
- **Mode (Dom, 09-26):** round the clock. No launch stops unless Dom names one; launch whatever is READY + green whenever the box is free (load < 30, combined gate green).
- **Routing:** sha lines to "Frankendom - Lead Developer"; when Lead is offline, to "Frankendom - Strategy - Fable 5.1".
- **Merge form:** `gh pr merge N --merge --match-head-commit <FULL 40-char sha>` (short shas are refused); after the last merge assert the trunk tree equals the gated tree, `npm ci`, then `(nohup bash scripts/deploy.sh > ~/Developer/deploy-<sha8>.log 2>&1 &)`.
- **Verify each publish:** release.json = sha; VPS `readlink /var/www/frankendom/current`; served index.html `cmp` dist; served bundle has `rxbewmzmovelckzoosss.supabase.co` and the current `v:<N>`.
- **Gotchas:** a row failing on `page.goto` timeout at load > 100 is load, not the PR — the solo retry decides. Lanes running batteries/test suites under the lock drove load to 180 (09-26 06:17); name the pid + cwd to Lead. `git merge-tree --merge-base <current trunk>` pairwise gives false conflicts for branches forked from older trunks; check with a real sequential merge. zsh does not word-split `set -- $p`.

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
