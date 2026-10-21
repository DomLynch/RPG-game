# External repo audit, 2026-10-21: item list

Dom pasted an external audit of the repo on 2026-10-21 and asked the Auditor to check it and fix it. Every number below was measured on trunk (b09bd0a09 unless noted) by the Auditor, not copied from the audit. **Action** is one of: fix PR, exemption, closed by ruling, not a defect, parked (its own session later).

| # | Finding (audit) | Measured | Owner | Action | Status | PR |
|---|---|---|---|---|---|---|
| 1 | `public/looks/` 459 MB of GLBs in git | 481 MB / 185 files; **served at runtime** (`/looks/<name>.glb`, origins/world/loadouts-rules.ts:24) | Dom | closed by ruling | Dom (via Strategy 17:0x): "fine, we have 5 TB VPS storage"; no LFS, no history rewrite; raise again only if GitHub refuses pushes at its 5 GB soft limit (~4.4 GB now) | - |
| 2 | `src/assets/source/` 184 MB donor/working meshes | 193 MB; the art pipeline's **input** (scripts/build-warrior.mjs) | Dom | closed by ruling | as 1 | - |
| 3 | `source/backups/` leftovers (veteran-v1, executioner-v5) | **not leftovers**: scripts/character/creature_pack.py:101 builds the Skeleton from veteran-v1 | - | not a defect | kept | - |
| 4 | Three byte-identical executioner scythes | **not identical** (3 different blobs, same size); but nothing loads A/B/C | Auditor | fix PR | FIXED-LIVE `cbb80860a` (K6q12) | #3536 |
| 5 | docs/ 238 MB, mostly PNG/video | 250 MB (docs md 6.3 MB); the PNGs are PR evidence links | Dom | closed by ruling | as 1 | - |
| 6 | `artifacts/` (gitignored) and `evidence/` force-added | 30 MB + 25 MB | Dom | closed by ruling | as 1 | - |
| 7 | 6 root preview pages, `loot-preview.html` referenced by nothing | 6 pages; loot-preview, family-turntable, mob-lineup dead (self-contained, last touched 10-07) | Auditor | fix PR | FIXED-LIVE `cbb80860a` (K6q12); the pages return 404 | #3536 |
| 8 | vite re-optimises every `src/assets/*.glb` at build start | true: `optimizeGlb` runs at buildStart AND per load(), no cache | Auditor | FIX-NEEDED M, unblocks none | finding on record (launch mode): a content-hash cache needs a build A/B on the VPS | - |
| 9 | 204 orphan scripts (37%) | **2 dead**: 95 named nowhere in the repo, but 64 were committed in the last 14 days (hand-run receipts) and 29 are named in lane skills/memory | Auditor | fix PR (the 2) / not a defect (the rest) | FIXED-LIVE `cbb80860a` (K6q12) | #3536 |
| 10 | 850 flat test files, 67k lines; heavy pin tests | 847 files, 66,240 lines (src+origins 67,262) | Lead | FIX-NEEDED L, unblocks none | finding on record: suites + `[pin]` tags, after beta | - |
| 11 | 10 workflows, 1,291 lines; eslint+tsc run 3x per PR; npm ci + apt copied into ~9 jobs | 10 files / 1,291 lines; quality.yml 477; npm ci in 17 places | Auditor | fix PR (CI-only) | FIXED-LIVE `1b96e0cbf` (K6q14); A/A x2 + trunk control 16/16 identical | #3547 |
| 12 | Node pinned 3 ways | `22` x17, `22.23.3` x2, engines `>=22.18.0`; no .nvmrc | Auditor | fix PR (CI-only) | FIXED-LIVE `1b96e0cbf` (K6q14) | #3547 |
| 13 | Five overlapping `quality*` npm scripts | true (quality, quality:stop, quality:ci, quality:static, quality:deploy) | Auditor | fix PR (CI-only) | FIXED-LIVE `1b96e0cbf` (K6q14) | #3547 |
| 14 | PROJECT_STATE.md index a month stale | listed 18 of 36 files | Auditor | fix PR | FIXED-LIVE `1b96e0cbf` (K6q14): generated from docs/state/, a test keeps it current | #3539 |
| 15 | Same preamble in CLAUDE/AGENTS/GAME_SPEC | true | Strategy | FIX-NEEDED S, unblocks none | Strategy takes the docs-only PR (20:09). Strategy's ruling, relayed by Lead 16:5x (Strategy confirmed it 17:1x): CLAUDE.md's identity block is the one source; AGENTS.md and GAME_SPEC.md get a one-line pointer; docs-only PR by Strategy after the K6q11 cut | - |
| 16 | 28 migrations lack `_down.sql` | **all 77** lack one: the project is forward-only by design | - | not a defect | kept (restore path = the R1 reset design) | - |
| 17 | Inline numbers ratcheted but not blocking; 20 new on this branch | gameplay WAS blocking; presentation was "tracked, not blocking"; exactly 20 new presentation sites on trunk | Auditor | fix PR + exemption | FIXED-LIVE `1b96e0cbf` (K6q14). Was: new presentation numbers red under --gate; Lead's three maths classes in (degrees<->radians 11 sites, arc/ring half-span, git-sha display 2), baseline lowered by the writer to GAMEPLAY 2036 / NON-GAMEPLAY 7000; merges after K6q10 publishes | #3537 |
| 18 | FX offenders (arena.ts 838, dwarf-shield 651, spell-vfx 501, ...) | true (baseline) | Lanes owning each file | RULED-NO-CHANGE | the ratchet in #3537 only lets them come down; lowered as each lane touches the file | - |
| 19 | God files/functions, no max-lines rule | 17 functions over 150 lines in 15 files (scene.ts 941, characters.ts 611, duel.ts 446, input.ts 441, arena.ts 431, main.ts 247, ai.ts 232) | Auditor | fix PR | FIXED-LIVE `1b96e0cbf` (K6q14): ESLint max-lines-per-function 150, the 15 files held at their length | #3538 |
| 20 | Split main.ts; break stepDuel/decide into phases | - | Combat (sim) / Web (main.ts) | FIX-NEEDED L, unblocks none | finding on record: stepDuel/decide are SIM_FILES (digest-guarded), so it needs an RV bump; after beta | - |
| 21 | 51 `*-rows.ts` repeat a 6-line loader; 128 `loadRegistry()` calls | not re-measured | Combat + owners | FIX-NEEDED M, unblocks none | finding on record: many readers are SIM_FILES, so a shared `rowTable()` is an RV change; after beta | - |
| 22 | Duplication: `el()`/`element()` helpers, HUD block, streak loop, `export *` lists | not re-measured | Web | RULED-NO-CHANGE | low value, presentation only; fold in when a lane next edits the file | - |
| 23 | 596 unused exports; 14 src files reachable only from tests | not re-measured | Strategy | not a defect (before beta) | Strategy's ruling, relayed by Lead 16:5x (Strategy confirmed it 17:1x): shipped-ahead features stay; the truly dead files are in #3536; re-measure once after the beta launch list closes, then decide per file | - |
| 24 | `record.ts:512` swallowed catch (record write fails silently) | **not a defect**: the comment says the write's failure surfaces on the read side (a bad gzip fails the read) | - | not a defect | kept | - |
| 25 | `net/lobby.ts:106` RPC result dropped | **not a defect**: documented fire-and-forget (a guest, offline page or unapplied migration changes nothing) | - | not a defect | kept | - |
| 26 | 243 non-null assertions, 162 module-level lets | not re-measured | - | RULED-NO-CHANGE | style debt; #3538's ratchet bounds the files that hold most of them | - |

## Verdicts: list CLOSED 2026-10-21 ~20:2x +04 (Dom: "the audit must be done")

Every item has one verdict: **FIXED-LIVE** (the live sha it shipped in), **RULED-NO-CHANGE** (why), or **FIX-NEEDED** (size; the release it unblocks, or none; owner). Launch mode (Dom via Lead 19:4x): a FIX-NEEDED that unblocks no release is a finding on record, not a PR. Live releases: K6q12 = `cbb80860a` (19:4x), K6q14 = `1b96e0cbf` (19:48, carries K6q13), checked on #3554 (issuecomment-6320171555).

| # | Item | Verdict | Detail |
|---|---|---|---|
| 1 | public/looks 481 MB in git | RULED-NO-CHANGE | Dom: 5 TB VPS, no LFS or history rewrite; revisit only if GitHub refuses pushes (5 GB soft limit, ~4.4 GB now) |
| 2 | src/assets/source 193 MB | RULED-NO-CHANGE | as 1; it is the art pipeline's input |
| 3 | source/backups leftovers | RULED-NO-CHANGE | not leftovers: creature_pack.py:101 builds the Skeleton from veteran-v1 |
| 4 | three unloaded scythe variants | FIXED-LIVE `cbb80860a` | #3536 (K6q12) |
| 5 | docs/ 250 MB of PNG/video | RULED-NO-CHANGE | as 1; the PNGs are PR evidence links |
| 6 | artifacts/ + evidence/ force-added | RULED-NO-CHANGE | as 1 |
| 7 | dead root preview pages | FIXED-LIVE `cbb80860a` | #3536; loot-preview/family-turntable/mob-lineup return 404 on frankendom.com |
| 8 | vite re-optimises every GLB at build start | FIX-NEEDED M, unblocks none, Auditor | content-hash cache + a VPS build A/B; build time is not on tonight's release path |
| 9 | 204 "orphan" scripts | FIXED-LIVE `cbb80860a` | the 2 truly dead ones removed in #3536; the rest are hand-run receipts or named in lane skills (not a defect) |
| 10 | 847 flat test files, heavy pin tests | FIX-NEEDED L, unblocks none, Lead | suites + `[pin]` tags; its own session after beta |
| 11 | eslint+tsc 3x per PR, npm ci copied around | FIXED-LIVE `1b96e0cbf` | #3547 (K6q14), lint once per PR; A/A x2 + trunk control 16/16 identical |
| 12 | Node pinned 3 ways | FIXED-LIVE `1b96e0cbf` | #3547: .nvmrc 22.23.3, all 20 setup-node steps read node-version-file |
| 13 | five overlapping quality* scripts | FIXED-LIVE `1b96e0cbf` | #3547: built from two shared parts, quality:lint + quality:checks (no repeated command lists) |
| 14 | PROJECT_STATE.md a month stale | FIXED-LIVE `1b96e0cbf` | #3539: generated from docs/state/, a test keeps the file list current |
| 15 | same preamble in CLAUDE/AGENTS/GAME_SPEC | FIX-NEEDED S, unblocks none, Strategy | Strategy's ruling stands (CLAUDE.md is the one source, the others get a pointer); the docs-only PR is not done yet (AGENTS.md + GAME_SPEC.md still repeat it on 1b96e0cbf) |
| 16 | 77 migrations without _down.sql | RULED-NO-CHANGE | forward-only by design; the restore path is the R1 reset design |
| 17 | presentation inline numbers not blocking | FIXED-LIVE `1b96e0cbf` | #3537: a new presentation number is red under --gate; baseline restarted at that day's trunk |
| 18 | FX files with most inline numbers | RULED-NO-CHANGE | #3537's ratchet lets them only shrink; each owning lane lowers them as it touches the file; no PR before beta |
| 19 | god functions, no max-lines rule | FIXED-LIVE `1b96e0cbf` | #3538: max-lines-per-function 150 for src/, the 15 over-size files held at their length (ratchet) |
| 20 | split main.ts; break stepDuel/decide into phases | FIX-NEEDED L, unblocks none, Combat (sim) + Web (main.ts) | SIM_FILES are digest-guarded, so it needs an RV bump; after beta |
| 21 | 51 *-rows.ts repeat a loader | FIX-NEEDED M, unblocks none, Combat + owners | a shared rowTable() touches SIM_FILES = an RV change; after beta |
| 22 | duplicated el()/HUD/streak helpers | RULED-NO-CHANGE | low value, presentation only; fold in when a lane next edits the file |
| 23 | 596 unused exports, 14 test-only files | RULED-NO-CHANGE | Strategy's ruling: shipped-ahead features stay; the dead files went in #3536; re-measure once after the beta list closes |
| 24 | record.ts:512 swallowed catch | RULED-NO-CHANGE | not a defect: a failed write surfaces on the read (a bad gzip fails the read) |
| 25 | net/lobby.ts:106 RPC result dropped | RULED-NO-CHANGE | not a defect: documented fire-and-forget |
| 26 | 243 non-null assertions, 162 module lets | RULED-NO-CHANGE | style debt; #3538's ratchet bounds the files that hold most of them |

Totals (26 items; the list has 26 rows, not 23): **FIXED-LIVE 9** (4, 7, 9, 11, 12, 13, 14, 17, 19), **RULED-NO-CHANGE 12** (1, 2, 3, 5, 6, 16, 18, 22, 23, 24, 25, 26), **FIX-NEEDED 5** (8, 10, 15, 20, 21), none of which unblocks a release, so all five are findings on record, not PRs. Nothing is open.

Follow-ups found tonight (not audit items): the unit-ci receipt reads a stale attempt's shard artifact after a `--failed` rerun (blocked K6q14; the Auditor's CI-only PR for tomorrow's first cut, Lead's OK on the blob); the duel relay runs #3545/#3555's logging only after its next planned restart (releases don't restart it).

## Found while checking (not in the audit)

- cache_guard (Claude hooks) false-blocked a read-only python heredoc that only ran `git show` through subprocess. Hooks Dev fixed it in Codex-Hooks #173 (merged and installed 9fae04e). The Auditor's probe of the installed copy: 25 ordinary lane forms allowed, 13 deny forms denied, no bypass; one contradiction sent to Hooks Dev (the older rule advises `"${VAR:?}/..."`, and the new destructive_var_guard denies that form too).
- The row-36 loot-smoke flake is two real-time leaks in the harness: the accumulator phase at clock install (fixed and proven on the VPS: `PINNED 0.0160/0.0160` both runs, divergence moved from intent 175 to 416), then key delivery through Chromium's input pipeline. The second fix (in-page `KeyboardEvent` dispatch) is not yet proven: its VPS run was stopped (GPU process at nice -8), and it reruns on the Mac.
