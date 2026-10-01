# GPT brief — the hero (base + L1), the gritty Pit, the arena through the gate, a light gear sheet (2026-10-01, 20:3x)

Dom's phone test on live 4da6b84f (four screenshots, 20:1x–20:2x). Paste everything below the line to GPT.
Code work from the same test (the rack's loadout sheet, a menu in the Pit, crowd sounds) is NOT GPT's: Claude lanes build it.

---

Frankendom: four art jobs, in this order. Same compute rule as your last pack.

## COMPUTE RULE (owner, read first)

- Hugging Face CPU box only (frankendom-blender, cpu-upgrade). Resume it when you start, pause it when you finish.
- No GPU of any kind unless the owner names the job and the spend in writing first.
- Hard cap: stop and report if the HF spend reaches $1.00. Write hours and dollars per job in the receipt.

## Job 1 — The player's own hero, AAA: the base character and his L1 clothing (FIRST)

The opponents now have AAA looks. Our own hero reads cheap next to them. He wears NO armour of his own: every armour piece he
ever wears is loot taken from opponents (already made). So this job is only the man himself and what he wears at the start.

**What exists (keep it):** the hero's rig is `warrior.glb`. Same skeleton, joint names, rest pose and clips. Do NOT re-rig or
change his proportions; the fight animations, the sword grips and the skill casts all ride that rig.

**A. The base hero:** a new skin and face pass on the existing body and head. Weathered Roman gladiator, late 20s, short dark
hair, stubble, a scar or two, sun-dark skin with real pores and muscle definition. PBR, 2048 maps for the head, 2048 for the
body. Bare skin must look right wherever a slot is empty (arms, legs, feet, chest), because loot covers him piece by piece.

**B. His L1 clothing (the starting kit), SPLIT BY SLOT** so a looted piece replaces only its own slot: one GLB per slot,
skinned to `warrior.glb`: `chest` (a rough off-white linen tunic, one shoulder bare, a leather strap across it), `legs`
(the red cloth kilt/subligaculum he wears now, worn and frayed), `hands` (cloth and leather wrist wraps), `feet` (simple
leather sandals). No helmet, no arm piece, no armour: rags and rope. Weapon and shield are not yours.
Budget: ≤ 15k triangles for all four pieces, 1024 maps each, ≤ 4 MB together. Nothing clips through the body in the idle,
the walk or a full overhead swing.

**Proof:** front and back renders of the base hero bare, and in his L1 clothing, A-pose; plus one render of him in L1 beside
an opponent at L1 (any), so we can see he matches them. The Armour lane fits it to the live rig and shoots the stills.

## Job 2 — Make the Pit gritty (the room, not the props)

Dom: "the room still looks too clean, not gritty or dirty like a real gladiator pit." Today the stone and the floor read
like new masonry. Repaint the room's own surfaces (the vault, the walls, the floor) and add decals:
- Walls: soot above every torch bracket, damp streaks running down from the vault, green-black mould in the lower
  courses, chipped and broken block edges, scratched tally marks near the rack.
- Floor: packed dirt and sand over the flags, dark old blood stains (dry, brown-black, not fresh red), straw drifted against
  the walls, scuffed drag marks from the gate to the rack.
- Vault: blackened by smoke, cobwebs in the corners.
- The red rug stays, but faded, dirty and frayed at the edges.
Tileable 1024 textures + up to 12 decal cards (alpha, ≤ 512 each). The whole job ≤ 3 MB. Proof renders from the Pit's fight
camera at 375 × 812, the rack wall and the gate wall, before and after.

## Job 3 — The arena seen through the Pit gate

Inside the Pit, looking at the gate, the bars show a flat pale yellow. Paint what lies beyond: the sunlit arena seen from
the dark tunnel. A short stone passage, then bright sand, the far curve of the arena wall and the crowd on the stands,
slightly blown out by the sun, a few banners. One painted backdrop card, 1024 × 1024 WebP ≤ 200 KB, plus a night variant
(torches, darker crowd) for the Night Pit. It sits behind the gate bars only, so paint for that frame: about 2.3 m wide and
3 m tall at the bars, viewed straight on.

## Job 4 — A light gear sheet (the gold option)

Dom wants the gear screen lighter, like the original yellow/gold look. Repaint Job 1 of your last pack (the Fitting rail
pieces: sheet ground, stage vignette, rail tiles, stored rows, buttons, fitting panel, bottom bar) as a **light variant**:
warm parchment and gold ground (base about #e9d9a8 → #c8a45e), dark ink text colour #2a2016, iron accents. Same sizes, same
9-slice margins, same file names with `-light` added, so the game can switch between dark and light. Keep every tap target
≥ 44 × 44 and the text contrast ≥ 4.5 : 1 on the light ground. Show both variants assembled over the hero at 375 × 812.

## Receipts (every job)

Files in the shared folder with a one-line note each: what it is, triangle count or pixel size, bytes. Renders as asked.
Hours and dollars on the HF box per job. Stop and ask if anything in this brief contradicts what you see in the game.
