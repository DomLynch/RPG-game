# Characters (VPS) lane state, handoff 2026-10-13

## Now
Standby for Dom's Combat Sandbox `sandbox/rows.json`; Lead pings when it lands. Integration rule (Lead 10-13): copy rows one per change as a normal PR with normal review; nothing copied straight from the sandbox branch.
Owed small items: main.ts import-graph walk in `tests/legend-families.test.ts` after Backend fixes the trunk main.ts -> spell JSON path; kind asserts when the first modifier/suffix brick row lands; `legendKeyForFight === legendIdFor` parity test after #2467 merges.

## Done today (PRs, all open unless noted; Deploy merges)
- #2512 titles table (head 912a1cb89, auditor:ready; Strategy legends-rule PASS after 2 epithet swaps; Backend scale confirmation pending, change rows only on comments).
- #2516 loot deck with pity (19f94b943, auditor:ready; Backend wires later).
- #2517 vendor economy rows (6e7611a4a, auditor:ready); classes are live item categories (gear, material, cosmetic).
- #2518 discovery rows + daily board (a1fadbfc7, auditor:ready); targets checked against live ids in CI; no-repeat holds except every 16th day (anchorEvery), accepted.
- #2520 CC0 audio list (docs; gaps only: voices, UI; Kenney Fighter default voice; record each sound's licence in SOURCES.json at pick time). #2521 legend world bodies stills (goblin/knight/witch animate on the duel rig, no fit needed). Both docs, no label needed.
- #2510 stone-tex closed (Dom parked); do not build on `char/pit-texture-look`.

## Open
- Backend: scale confirmation on #2512; wiring of #2516, #2517, #2518.
- Dom: sandbox/rows.json (not yet produced).

## Gotchas
- A new `origins/**/*.test.ts` needs a `tests/origins-<area>.test.ts` stub or `tests/origins-test-stubs.test.ts` fails; run it with `tests/data-only.test.ts` in every receipt.
- Manifest format is `{ "tables": [...] }` with refs `field` / `field[]`; `registry-check.mjs <dir>` takes one root.
- Live ids: creatures `character:*` in zone rows `spawns.rows`, items `item:*` in `origins/region1/loot-tables.json`, categories in `src/core/contracts/definitions.json` (gear, material, quest, cosmetic), duel families `family:*`.
- Say a failing run out loud in the same message as the fix; the Stop hook reads the preceding output.
- Hook blocks full suites and compound commands; targeted `node --test` only.
