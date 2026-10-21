# External repo audit, 2026-10-21: item list

Dom pasted an external audit of the repo on 2026-10-21 and asked the Auditor to check it and fix it. Every number below was measured on trunk (b09bd0a09 unless noted) by the Auditor, not copied from the audit. **Action** is one of: fix PR, exemption, closed by ruling, not a defect, parked (its own session later).

| # | Finding (audit) | Measured | Owner | Action | Status | PR |
|---|---|---|---|---|---|---|
| 1 | `public/looks/` 459 MB of GLBs in git | 481 MB / 185 files; **served at runtime** (`/looks/<name>.glb`, origins/world/loadouts-rules.ts:24) | Dom | closed by ruling | Dom (via Strategy 17:0x): "fine, we have 5 TB VPS storage"; no LFS, no history rewrite; raise again only if GitHub refuses pushes at its 5 GB soft limit (~4.4 GB now) | - |
| 2 | `src/assets/source/` 184 MB donor/working meshes | 193 MB; the art pipeline's **input** (scripts/build-warrior.mjs) | Dom | closed by ruling | as 1 | - |
| 3 | `source/backups/` leftovers (veteran-v1, executioner-v5) | **not leftovers**: scripts/character/creature_pack.py:101 builds the Skeleton from veteran-v1 | - | not a defect | kept | - |
| 4 | Three byte-identical executioner scythes | **not identical** (3 different blobs, same size); but nothing loads A/B/C | Auditor | fix PR | open, Lead reviews after K6q10 | #3536 |
| 5 | docs/ 238 MB, mostly PNG/video | 250 MB (docs md 6.3 MB); the PNGs are PR evidence links | Dom | closed by ruling | as 1 | - |
| 6 | `artifacts/` (gitignored) and `evidence/` force-added | 30 MB + 25 MB | Dom | closed by ruling | as 1 | - |
| 7 | 6 root preview pages, `loot-preview.html` referenced by nothing | 6 pages; loot-preview, family-turntable, mob-lineup dead (self-contained, last touched 10-07) | Auditor | fix PR | open | #3536 |
| 8 | vite re-optimises every `src/assets/*.glb` at build start | true: `optimizeGlb` runs at buildStart AND per load(), no cache | Auditor | parked | a content-hash cache needs a build A/B on the VPS; next after the CI PR | - |
| 9 | 204 orphan scripts (37%) | **2 dead**: 95 named nowhere in the repo, but 64 were committed in the last 14 days (hand-run receipts) and 29 are named in lane skills/memory | Auditor | fix PR (the 2) / not a defect (the rest) | open | #3536 |
| 10 | 850 flat test files, 67k lines; heavy pin tests | 847 files, 66,240 lines (src+origins 67,262) | Lead | parked | suites + `[pin]` tags: its own session | - |
| 11 | 10 workflows, 1,291 lines; eslint+tsc run 3x per PR; npm ci + apt copied into ~9 jobs | 10 files / 1,291 lines; quality.yml 477; npm ci in 17 places | Auditor | fix PR (CI-only) | Lead GO: one CI-only PR after K6q10 publishes, with an A/A dispatch + trunk control | - |
| 12 | Node pinned 3 ways | `22` x17, `22.23.3` x2, engines `>=22.18.0`; no .nvmrc | Auditor | fix PR (CI-only) | with 11 | - |
| 13 | Five overlapping `quality*` npm scripts | true (quality, quality:stop, quality:ci, quality:static, quality:deploy) | Auditor | fix PR (CI-only) | with 11 | - |
| 14 | PROJECT_STATE.md index a month stale | listed 18 of 36 files | Auditor | fix PR | open: generated from docs/state/, test keeps it current | #3539 |
| 15 | Same preamble in CLAUDE/AGENTS/GAME_SPEC | true | Strategy | parked | Strategy's ruling: CLAUDE.md's identity block is the one source; AGENTS.md and GAME_SPEC.md get a one-line pointer; docs-only PR by Strategy after the K6q11 cut | - |
| 16 | 28 migrations lack `_down.sql` | **all 77** lack one: the project is forward-only by design | - | not a defect | kept (restore path = the R1 reset design) | - |
| 17 | Inline numbers ratcheted but not blocking; 20 new on this branch | gameplay WAS blocking; presentation was "tracked, not blocking"; exactly 20 new presentation sites on trunk | Auditor | fix PR + exemption | open @eaa848ceb: new presentation numbers red under --gate; Lead's three maths classes in (degrees<->radians 11 sites, arc/ring half-span, git-sha display 2), baseline lowered by the writer to GAMEPLAY 2036 / NON-GAMEPLAY 7000; merges after K6q10 publishes | #3537 |
| 18 | FX offenders (arena.ts 838, dwarf-shield 651, spell-vfx 501, ...) | true (baseline) | Lanes owning each file | parked | the ratchet in #3537 only lets them come down | - |
| 19 | God files/functions, no max-lines rule | 17 functions over 150 lines in 15 files (scene.ts 941, characters.ts 611, duel.ts 446, input.ts 441, arena.ts 431, main.ts 247, ai.ts 232) | Auditor | fix PR | open: ESLint max-lines-per-function 150, the 15 files held at today's length | #3538 |
| 20 | Split main.ts; break stepDuel/decide into phases | - | Combat (sim) / Web (main.ts) | parked | own sessions; stepDuel/decide are SIM_FILES (digest-guarded) | - |
| 21 | 51 `*-rows.ts` repeat a 6-line loader; 128 `loadRegistry()` calls | not re-measured | Combat + owners | parked | many readers are SIM_FILES, so a shared `rowTable()` is an RV change | - |
| 22 | Duplication: `el()`/`element()` helpers, HUD block, streak loop, `export *` lists | not re-measured | Web | parked | low value | - |
| 23 | 596 unused exports; 14 src files reachable only from tests | not re-measured | Strategy | not a defect (before beta) | Strategy's ruling: shipped-ahead features stay; the truly dead files are in #3536; re-measure once after the beta launch list closes, then decide per file | - |
| 24 | `record.ts:512` swallowed catch (record write fails silently) | **not a defect**: the comment says the write's failure surfaces on the read side (a bad gzip fails the read) | - | not a defect | kept | - |
| 25 | `net/lobby.ts:106` RPC result dropped | **not a defect**: documented fire-and-forget (a guest, offline page or unapplied migration changes nothing) | - | not a defect | kept | - |
| 26 | 243 non-null assertions, 162 module-level lets | not re-measured | - | parked | style debt; #3538's ratchet bounds the files that hold most of them | - |

## Found while checking (not in the audit)

- cache_guard (Claude hooks) false-blocked a read-only python heredoc that only ran `git show` through subprocess. Hooks Dev fixed it in Codex-Hooks #173 (merged and installed 9fae04e). The Auditor's probe of the installed copy: 25 ordinary lane forms allowed, 13 deny forms denied, no bypass; one contradiction sent to Hooks Dev (the older rule advises `"${VAR:?}/..."`, and the new destructive_var_guard denies that form too).
- The row-36 loot-smoke flake is two real-time leaks in the harness: the accumulator phase at clock install (fixed and proven on the VPS: `PINNED 0.0160/0.0160` both runs, divergence moved from intent 175 to 416), then key delivery through Chromium's input pipeline. The second fix (in-page `KeyboardEvent` dispatch) is not yet proven: its VPS run was stopped (GPU process at nice -8), and it reruns on the Mac.
