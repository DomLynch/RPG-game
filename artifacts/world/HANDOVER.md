# Handover — Arena v1 (The Ashpit) → merge + deploy

**PR:** https://github.com/DomLynch/RPG-game/pull/92 · branch `world/arena-v1` (tip 52f08eb) → trunk `codex/01a09a76/task-1` · CI green · mergeable.
**Local:** worktree `~/Developer/frankendom-world` (clean). Main checkout `~/Desktop/Business/frankendom` is the trunk; deploy from there.

## What changed (only these files)
| file | what |
|---|---|
| `src/arena.ts` | the arena behind the lead's seam: `buildArena(scene) → { group, floor, update, dispose }`. **`floor` is new** (sand mesh, decal slot). `scene.ts` untouched. |
| `src/assets/arena/textures.ts` | all textures generated at load from seeded noise (no image files, no licences) |
| `tests/arena.test.ts` | contract: exclusion volume, floor darker than skin, crowd caps, ≤ 40 meshes / 120k tris / 12 MB |
| `scripts/arena-preview.mjs` | before/after harness → `artifacts/world/<label>/` |
| `src/assets/README.md`, `PROJECT_STATE.md` | licence note, state entry |
| `artifacts/world/**` | evidence: REPORT, REQUESTS, audit/DEFECTS, captures |

## Deploy steps
```bash
cd ~/Desktop/Business/frankendom
git fetch origin && git checkout codex/01a09a76/task-1 && git pull
gh pr merge 92 --merge            # or merge on GitHub; then git pull
git status --porcelain            # must be empty: deploy.sh refuses a dirty tree
scripts/deploy.sh                 # runs npm run quality (incl. the real-browser gate), rsyncs dist/ to the VPS, flips the symlink, verifies live index.html + release.json
```
Then open https://frankendom.com on a phone: sand floor, gate on the far side, crowd on the upper tiers, banners swaying, coals flickering.

## Watch-outs
1. **The browser gate will flake ~50 % on this arena until one line changes.** `scripts/browser-check.mjs` takes two PNG screenshots (`browser-parry`, `browser-riposte`) inside a wall-clock-timed sequence; the sand frame is high-entropy, the PNG encode pauses the page ~150 ms, the sim loses time and the warden kicks first → `AssertionError: kick landed clean (4)…`. **Fix (lead-owned file, one line each):** add `type:'jpeg',quality:85` and `.jpg` paths to those two `page.screenshot` calls — 3/3 green after that, measured. Otherwise just re-run `scripts/deploy.sh`; the failure is not the arena's runtime cost (frame pacing 16.7 ms median / 18 max, game readout 60 fps · p95 17–18 ms, same as trunk).
2. **Rollback** is the repo's normal one: `/var/www/frankendom/previous` symlink on the VPS (`root@49.12.7.18`, key `~/.ssh/binance_futures_tool`); `ln -sfn "$(readlink previous)" current`.
3. **Phone check not done** (no route from the lane). First thing to look at on an iPhone: startup stall (sand texture generation, ~150 ms desktop → maybe 0.5 s phone) and the HUD's `fps · p95` readout. If p95 > 25 ms, the first knob is `sandAlbedo(512)` in `src/arena.ts` (one arg), then drop the sand normal map.
4. **Do not lower the `wall.inner` (11.7 m) or put anything inside 8.55 m** — `tests/arena.test.ts` will fail; the camera clamp is 11.5 m and the sim's play radius is 8.55 m.
5. **`floor` on the seam** — if anyone re-types `Arena` in `scene.ts`, keep `floor: THREE.Mesh`; the gore lane's decals target it.
6. **Rename is still open**: HUD says *Ashcourt / The Old Keep*; the lane proposes **The Ashpit** (also Worldsedge, The Bonehollow). Strings live in `index.html` (`.place`, `#opponent-name`) — lead's file, not in this PR.
7. Merge order: no conflicts with the open combat/weapons lanes are known; the PR only touches the files above. PROJECT_STATE will conflict trivially if another lane inserts an entry at the top — keep both.

## Evidence
`artifacts/world/REPORT.md` (numbers), `artifacts/world/REQUESTS.md` (#0 gate fix, #1 rename, #3 lighting proposal), `artifacts/world/arena-v1/*.png` vs `baseline/*.png`.
