# VPS shadow of the release rows (pilot)

Lead's brief (Dom via Strategy, 2026-09-30): stop the Mac being the release bottleneck. Pilot first: the VPS runs the same 49 release rows
as the Mac for the same trunk sha, report-only, and a per-row table says whether the two boxes agree. Three identical runs before anyone
proposes the VPS as the row box. **No release-path change:** `scripts/deploy.sh` is untouched and publish stays on the Mac.

## Pieces

| Piece | Where | Does |
|---|---|---|
| `scripts/vps-shadow-rows.sh <sha> [--wait\|--status\|--fetch]` | Mac (Deploy) | ssh/scp/rsync only. Starts the run detached on the VPS as the row user under `nice -n 15 ionice -c3`; polls; fetches `artifacts/vps-shadow/<sha>/`. |
| `scripts/vps-shadow/run-rows.sh` | VPS (synced by the wrapper each start) | Detached checkout of the sha, `npm ci` only when the lockfile changed, `npm run build`, then `node scripts/release-checks.mjs` with `RELEASE_CHECKS_SKIP=` (0 trusted, concurrency 4 like the Mac). Keeps every row's own log. |
| `scripts/vps-shadow/rows-json.mjs` + `rows-lib.mjs` | VPS / shared | Writes `rows.json`: one entry per row of `.quality-gate.json` (pass / fail / ceiling / missing, seconds, attempts, pins its log printed), run provenance (sha, tree, node, playwright, UTC start/end, load). Row 49 carries the note `Linux WebKit ≠ Mac Safari`. |
| `scripts/vps-shadow-diff.mjs --mac <deploy log \| release-checks.json> --vps <rows.json> [--mac-logs <dir>]` | Mac | The per-row table: row, Mac result, VPS result, pin Mac, pin VPS, verdict (same / DIFFERS (result) / DIFFERS (pin) / missing). Exit 0 all same, 3 any difference, 4 rows not comparable. |

## VPS layout (host `49.12.7.18`, user `frankrows`, home `/opt/frankendom-shadow`)

- `repo/` clone of the public repo (no token needed), detached at the sha under test. Never a lane's working copy.
- `work/<lane>/` separate checkouts for lanes that need the box (first: Finishers' hit-FX clips, 2026-09-30).
- `ms-playwright/` = `PLAYWRIGHT_BROWSERS_PATH` (chromium + webkit, Playwright 1.62.1 as trunk pins). System deps via `npx playwright install-deps` as root, once.
- `env.production.local` the three public keys the Mac builds with, byte-identical to the Deploy checkout's (sha256 `3c15df20…`): `VITE_SENTRY_DSN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Nothing else is copied. `PG_BIN` comes from `pg_config` on the box (row 13 makes its own disposable cluster, which is why the user is not root).
- `runs/<sha>/<utc stamp>/` per run: `build.log`, `rows.log`, `logs/NN-*.log`, `rows.json`, `status`; `runs/<sha>/latest` points at the newest.
- Login for lanes: `ssh -i ~/.ssh/binance_futures_tool frankrows@49.12.7.18` (the Mac key is in the user's `authorized_keys`).

## Pilot procedure (Deploy)

1. When run AU's trunk sha is fixed: `scripts/vps-shadow-rows.sh <sha>` (returns at once), then the Mac release as usual.
2. After both finish: `scripts/vps-shadow-rows.sh <sha> --fetch`, then
   `node scripts/vps-shadow-diff.mjs --mac ~/Developer/deploy-<sha8>.log --vps artifacts/vps-shadow/<sha>/rows.json --mac-logs <the Mac run's artifacts/release-checks/ if kept>`.
3. Paste the table in the state doc; 3/3 identical (row 49 excepted, flagged) before proposing the VPS as the row box.

## Known differences to expect

- Row 49 runs Linux WebKit, not Safari's WebKit: same family, different build; flagged in every table, never read as Safari's verdict.
- No GPU on the VPS: Chromium renders through SwiftShader. Rows that time a frame budget may run slower there; the table shows seconds side by side.
- The rows' `state hash` / digest lines are what the pin columns compare; a row that prints none compares on pass/fail only.
