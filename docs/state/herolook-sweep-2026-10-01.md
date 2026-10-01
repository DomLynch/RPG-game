# Live phone rank sweep — 2026-09-30 / 10-01

Hero Look lane, for Strategy (Job 2) and Lead. Every character x rank on the live build, iPhone UA, 375 wide, real fight at the fight camera: idle + hit + one kill frame, VPS capture lock. Live sha `e65a6d8d` for the first 24 pairs (Knight L1-L10, Shieldmaiden L2-L10, Executioner/Witch/Dwarf/Nightborn/Centurion L1), `0f9a09c1` for the other 75 (no change during either run). Frames: VPS `/opt/frankendom-shadow/work/herolook/pack/live-cur/artifacts/sweep/<opponent>-L<n>/{A-idle,A-hit,B-kill-00..02}.png`, `live.json` per pair; sheets `artifacts/grid-<opponent>.jpg`. Centurion = id `veteran`. All 100 pairs captured; † Shieldmaiden L1 is from the earlier L1 capture on live `64d13481` (frames `live-cur/artifacts/live-shieldmaiden-L1/`), the other 99 are in this sweep.

## Result
All 100 pairs: the look file requested returned HTTP 200, fight-page look state `on` (or `none` where no look ships), 0 console errors. Phone UA requests `<opponent>-L<n>-phone.glb` for every phone-tier character; the Goblin is not in PHONE_LOOKS, so it loads the full `goblin-L<n>.glb` (expected).

| character | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 |
|---|---|---|---|---|---|---|---|---|---|---|
| dwarf | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| executioner | OK | WRONG? | WRONG? | WRONG? | WRONG? | WRONG? | WRONG? | OK | OK | OK |
| goblin | base | OK | OK (dark) | OK | OK | OK | OK | OK | OK (dark) | OK |
| knight | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| nightborn | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| pitborn | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| plaguedoctor | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| shieldmaiden | OK† | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| veteran | base | OK | OK | OK | OK | base | OK | OK | OK | OK |
| witch | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |

`OK` = file loads, state `on`, 0 errors, set reads as the approved look (colour, pieces, pose). `base` = no look file ships at that rung (goblin L1, veteran L1 and L6): the base model, state `none`, as SHIPPING_LOOKS lists. `OK (dark)` = loads and reads, but is near-black at the fight camera in the Goblin's shadowed arena. `WRONG?` = loads, but see below.

## Findings
1. **Executioner L2-L7: the hood reads as a flat black shape at the fight camera** (L1 hood is grey-brown cloth; L8/L9 are dark metal and L10 gold). Frames: `executioner-L2..L7/A-idle.png`. Possible colour-fold residue (Armour owns hoods L2-L7 per the 09-30 split); not confirmed against the source colour. Sheet: `artifacts/grid-executioner-idle.jpg`.
2. Goblin L3 and L9: near-black in the shadowed arena (set is there, hard to read). Goblin is small and mostly behind the hero in hit frames; read on idle (`artifacts/grid-goblin-idle.jpg`).
3. Replay-page state was not `on` at the kill frame on 18 pairs (executioner L3, executioner L6, executioner L7, executioner L8, executioner L9, goblin L3, goblin L4, goblin L5, goblin L6, goblin L7, goblin L8, goblin L9, goblin L10, pitborn L3, pitborn L7, veteran L3, veteran L7, veteran L8): `ready`/`loading` there means the look had not swapped in yet at the kill beat (it swaps on an idle beat); the fight page (A frames) was `on` on every one. Not an error, noted for the gate.
4. No grey slab, T-pose, missing piece or bare hands seen on any of the 100; gloves on the Shieldmaiden were judged on idle frames only.

## Limits
Read by eye from cropped hit/idle frames, not measured. Kill frames come from a replay recorded on the 64d13481 source and still played on the newer builds.
