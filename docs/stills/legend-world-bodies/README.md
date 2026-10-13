# World bodies of the 3 placed legends on the duel rig (2026-10-13)

Placed legends (World's `legend-spawns.json` on `world/legend-wiring`): Kobold, Bedivere, Mother Shipton, all rank 2 of `legend-families.json`, so each wears its family's body: Kobold = `goblin`, Bedivere = `knight`, Mother Shipton = `witch`.

Check: each `public/world/<body>.glb` was loaded on its own, the duel body's (`src/assets/<body>.glb`) `Armed` and `Attack` clips were applied to it by bone name, and it was rendered at 375 wide (swiftshader, three.js AnimationMixer).

| Body | Legends | World GLB tris | Skin joints | Clips (world GLB) | Armed / Attack tracks bound to world bones | Result |
|---|---|---|---|---|---|---|
| goblin | Kobold | 7999 | 65 | 25, same names as the duel GLB | 65 of 65 / 66 of 66 | animates, no fit or retarget needed |
| knight | Bedivere | 7999 | 65 | 37, same names | 65 of 65 / 66 of 66 | animates, none needed |
| witch | Mother Shipton | 7999 | 65 | 38, same names | 65 of 65 / 66 of 66 | animates, none needed |

Notes
- The world bodies list their 65 joints in a different order from the duel GLBs; the clips bind by name, so it does not matter (every track bound).
- Neither world body carries a weapon (the Armed stills show empty hands); the duel loadout adds it.
- The rank-2 tier look (`public/looks/<body>-L2.glb`) is a separate asset (it has no clips of its own); this check is the plain world body, which is what the placement spawns.
- Not checked: the finisher cuts (`Death_*` clips) and the `Maul_*` set on the knight; neither is used by a placed boss fight.
- Stills: `<body>-armed.png` (ready idle) and `<body>-attack.png` (mid-attack), 375x500.
