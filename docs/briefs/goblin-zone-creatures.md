# Brief: goblin zone creatures and boss (bodies and rigs) - for Characters & Art, via Lead, when Dom says go

From the Zone sandbox, 2026-10-16, from Dom's own roster and concept art (the two images Dom pasted in chat: a mossy Cave Troll and a red/blue armoured Cave Drake; attach them to the ticket, they are not in the repo). Status: DRAFT. No art, no creature rows, no fight rules until Dom, Lead and Strategy rule (see the open questions).

**Dom's roster (his words, trimmed):** 1 Goblin Warrior (the standard opponent, exists); 2 Dire Warg (larger companion beast, fast and aggressive); 3 Giant Cave Spider (venomous elite); 4 Cave Troll (giant guardian, slow and devastating, 3-4x goblin height, chained collar; "best Zone 1 boss"); 5 Goblin Beastmaster + Cave Drake (final boss encounter: crocodile-like jaws, scales, spiked back, ~3x a goblin's length). Start with the Warg and the Troll; a full dragon is for a later, higher-tier zone.

**Who does what.** Characters & Art: bodies and rigs (FLUX concept, TRELLIS.2 3D, Blender fit on a rig; recipe in the `character-build-recipe` skill). Combat: fight rules, attack styles, boss specials (30 boss specials exist for the duel opponents). Backend/World: the spawn rows and the world sim (version-pinned). The Zone sandbox: the zone look and where a boss stands (a camp recipe or landmark), nothing else.

**Open questions (Strategy/Dom, not decided):** a boss row needs `named: true`, campSize 1, a `mobLooks` scale row and a boss special; Zone N has level N creatures, so is a Zone 1 boss level 2-3 acceptable or does a boss belong to a later zone? Weighted spawn entries (`characters: [{id, weight}]`) are a sim-visible change (WSV bump). A creature is not a prop: it carries a rig, clips, a loot table and a record version.
