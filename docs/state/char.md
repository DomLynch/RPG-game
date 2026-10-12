# Characters (VPS) handoff, 2026-10-12

## Now
- #2242 (20a catalogue as runtime source) is ready, head d342fdd2d, receipt comment posted, label auditor:ready on. Wait for the Auditor; do not edit the head. Fix only what the Auditor finds.
- Next: item 4 (Tue): legends into the catalogue rows, remove src/legends.ts (legends-rule skill applies to citations). One PR, VPS receipt, then label auditor:ready.
- Combat never answered the two plan questions on #2242 (OWN_KNOBS stays code in 20a; any load-bearing ROSTER order). Lead approved the plan regardless.

## Done today
- Merged: #2228 (createGearStage + frontierKit zoneId), #2230 (zone1.row.json place), #2065, #2164.
- #2231 (state doc, docs/state/character.md) open, labelled, awaiting Auditor.

## Open
- Auditor LOWs: add a frontierKit(..., undefined, '2') test when a zoneId caller lands; no test pins a zone's difficulty; castTries should record max/list.
- Five Zone 2 creature catalogue rows (existing models only), after World confirms the shape. tests/catalogue.test.ts known.tables must include World's zone tables when they leave content.ts.
- char/mac-leftovers-1010 @8b5c921b2 stays unmerged until World/Dom ask. 3b is dropped (Lead).

## Gotchas
- Ready is a label (auditor:ready) once the VPS receipt is on the head; message no one. Never label before the receipt.
- catalogue-data.ts is `as const` with NO satisfies (circular through LootId); rows are checked at catalogue-rows.ts. It is in SIM (eslint.config.js).
- ROSTER finishers semantics = row finisher.allowed (absent = all), not finisher.finishers.
- Stop hook wants tool-output evidence for every pass/fail claim; SendMessage needs the bare name or the [ref] a listing shows (two "Frankendom - Lead Dev" exist: use bridge:session_... addresses).
- Box: no full suites; node --test targeted with timeout 900; load was 18 during the big run.
