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

## Now (2026-09-23 10:53)
- **Live `52dffed` == trunk.** Deploy 33/33: 31 rows CI-trusted for tree 168112c, rows 26 and 32 run locally. release.json 200,
  served index.html cmp-identical to dist, VPS `current` -> `releases/52dffed…`, box FREE. RECORD_VERSION is still **5**.
- Carries, since last night's `fe0d8e0`: the code batch #508 #507 #509 #510 #513 #511 #506 #472 #478 #500, **#488 reverted**
  (`4e34fa3`: its tier table lacked the `Shield` slot #478 added, TS2741 on the combined tree), 27 docs PRs, #519, #502.
- **Queue (non-sim, rolling, publish every 2–3):** #523 (Stats: #488 re-land + `Shield: 0`), then #514 (needs #523's
  `src/gear-stats.ts`), #521 (#475 v2, draft), #505 v2 / #522, #518. **Window 1 (sim, RECORD_VERSION -> 6), hold until the whole
  window is merged, then one re-pin and one publish:** #515 knife + the Nightborn/estoc, estoc flip, Executioner and Centurion items.
- **Conflicting, owners asked to re-open off trunk** (PR comments left; force-push is excluded): #473 (Weapons), #494 (Knight
  reference), #503 (Stats, superseded by a PR A v2).
- Standing order (Dom, 2026-09-23 08:50): Strategy's and Lead's instructions are Dom's. Merge in their order and publish. Excluded,
  ask Dom: force-push or delete a shared branch, roll back live, drop data.

## Done 2026-09-23
fe0d8e0 (overnight, 33/33, the guards removal and `?perf=1`; guard.glb confirmed absent from a cold load of the live site) and
52dffed (this morning). 544bcb4 and 2d614dc did not publish (see Gotchas). #488 reverted, #497 / #502 / #519 merged by this lane.

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
