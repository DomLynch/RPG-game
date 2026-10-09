Zone 1 hero (src/assets/warrior.glb, the rig Zone 1 draws) wearing every loot piece through the engine's own path (loadLoot -> actor.wear), sheathed pose, 375 x 812 @2x on the VPS.
Harness: gear-fit.html + `node scripts/gear-fit-stills.mjs --out <dir> --stills all`. fit.json = per piece: did wear throw, every draw skinned to the hero's skeleton, finite box, box on the body, height ratio. sheets/<opponent>.jpg = the pieces side by side; goblin.<Slot>.jpg = the six goblin pieces at 375.

Result (2026-10-09): 64 worn pieces (loot.glb: armour + shields; the other 10 of src/loot.ts's 74 ids are weapons, which come through the equip files, not wear). No piece throws, every draw is skinned to the hero's skeleton, every box sits on the body. Visual flags:
- goblin.Body: the trophy necklace is a wide thin ring that floats around the shoulders (authored for the goblin's narrow neck). Tunic fits.
- goblin.Arms: one steel bracer, right forearm only (the piece has two draws, both on one arm; check against the goblin's own pair).
- knight.Helmet: a tall bucket helm that floats above the head with the face exposed beneath (authored on the Knight's larger head; no re-fit).
- witch.Helmet: the hood and its shoulder cape come out as a flat slab spread over the shoulders and chest.
- nightborn.Helmet: a small crown-like crest floats above the head with a gap.
Fine/by design: veteran.Crest and executioner.Crest float/hang alone (they sit on a helmet); shields hang at the flank in the sheathed pose (no carry arm).
