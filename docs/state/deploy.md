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

## Now (2026-09-24 11:10)
- **Live `c0400c1f`** (#649 on top of 9394e8a4), built WITH the account settings: served `index-B_hyiYHp.js` carries the Supabase
  origin, the lazy `account-BFuxefc7.js` carries storageKey `frankendom.auth.v1`. Box FREE.
- **Next, in order:** (1) guard PR (Lead + Strategy): a FAILING release row for any production deploy whose BUILT bundle lacks the
  Supabase host / auth storageKey (missing or wrong key file both fail), with a test (missing → fail, present → pass). Today
  `scripts/check-account-config.mjs` only prints "guest-only build". (2) #648 admin Arena selector: HELD, World is amending it
  (Options tab); publish only on Lead's re-READY at the NEW head, never ce21808e. (3) Watch trunk `release-checks` on c0400c1f
  (queued at 11:05); tell Lead if red.
- **Routing:** sha lines to Lead AND Strategy (Lead asked 09-24). Strategy has several same-name sessions: send by the local `[ref]`.

## Done 2026-09-24
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
