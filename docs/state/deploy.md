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

## Now (2026-09-22 17:2x)
- Live **a98f327** (deploy #104). Trunk **3c179f0** is NOT deployable: #435 is in it (see Open).
- #442 (lead/revert-435) is open on Lead's gate; a guarded watcher deploys the trunk tip automatically when it merges.
- Migrations 0006–0010 applied to the hosted DB and verified by me and by Backend/Accounts.

## Done today
Fifteen deploys attempted, twelve published and live-verified (release.json + served index.html `cmp` against dist + VPS
`current` symlink on every one): dcb9d61, 3fa90c5, 0ebf409, 01b6642, 41363b7, 8650fc5, e2582b0, 4068c50, f439d43, 6c9e75b,
01b6642, adb8ddd, a2a901b, a98f327. Shipped among others: the end-of-fight HUD, 40 px touch targets, deploy guards, both audio
passes, the paperdoll gear layers, PLAY NOW, the arena guard, short share links end to end (nginx `/s/` + 0009 + client), and
the kill-screen loot panel with its accidental-decline fix.

Five hosted migrations applied on an explicit relay, each md5-matched at trunk and post-state verified: 0006 fight_records
column grants, 0007 daily_board_summary, 0008 rls_auto_enable revoke, 0009 short share ids, 0010 guest share hygiene.

Four regressions stopped at the gate rather than on the phone: the #379/#380 pair (tour retime vs Rematch/arena taps, fixed
forward by #387 and #389), #418×#415 (loot layers never regenerated — fixed by running the project's own generator, #425),
#427 (loot panel's action row swallowed the post-kill arena touch — Web's #432), #435 (guard.glb fetched on every boot).

## Open
- **#435 blocks trunk.** `void arena.guards(fighterUrls['./assets/guard.glb']!)` in scene.ts fetches a 504 KB model on every
  cold load. Nine release rows fail, each twice: row 02 roster-browser-check (`fetch only hero and selected opponent` — the
  boot fetch budget, the row that makes this a product fault rather than a harness race) and rows 1/3/15/17/19/20/23/25
  finisher-preview (`TypeError: Cannot read properties of undefined (reading 'side')` — the previews inspect before `framing`
  exists). Revert is #442; Visuals re-land lazily after first paint. **Watch row 02 on the re-land**: any fetch before first
  paint fails it again whatever the timing fix.
- The endgame-HUD row is marginal with the v44 hands (a hand bone can project into the bottom button row in some death poses);
  #424 made the gate deterministic, but the underlying framing question is Character/Visuals'.

## Gotchas
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
- **Only this session runs `scripts/deploy.sh`** (one-deployer), from the scratchpad `deploy/` checkout where every
  `deploy-<sha>.log` lives — not `~/Developer/frankendom-deploy`, which is a lane worktree.
