# GPT brief — the hero, the gritty Pit, the arena through the gate, a light gear sheet (2026-10-01, 20:3x)

Dom's phone test on live 4da6b84f (four screenshots, 20:1x–20:2x). Paste everything below the line to GPT.
Code work from the same test (the rack's loadout sheet, a menu in the Pit, crowd sounds) is NOT GPT's: Claude lanes build it.

---

Frankendom: four art jobs, in this order. Same compute rule as your last pack.

## COMPUTE RULE (owner, read first)

- Hugging Face CPU box only (frankendom-blender, cpu-upgrade). Resume it when you start, pause it when you finish.
- No GPU of any kind unless the owner names the job and the spend in writing first.
- Hard cap: stop and report if the HF spend reaches $1.00. Write hours and dollars per job in the receipt.

## Job 1 — The player's own hero, AAA, ten ranks (FIRST, the biggest)

The opponents now have ten looks each (L1 rags → L10 gold). Our own hero still wears one plain brown tunic and reads cheap
next to them. Give him the same climb.

**What exists (keep it):** the hero's rig is `warrior.glb`. Same skeleton, joint names, rest pose and clips. Do NOT re-rig,
re-skin a new body or change his proportions; the fight animations, the sword grips and the skill casts all ride that rig.

**A. The base hero (all ranks):** a new skin and face pass on the existing body and head. Weathered Roman gladiator, late
20s, short dark hair, stubble, a scar or two, sun-dark skin with real pores and muscle definition. PBR, 2048 maps for the
head, 2048 for the body. He must read as the same man at every rank. No helmet at rank 1, so the face is the first thing a
player sees.

**B. His ten rank kits, one per rank, SPLIT BY SLOT.** The hero wears loot: a piece the player picks up from an opponent
replaces his own piece in that slot only. So each rank kit is delivered as separate pieces, one GLB per slot, all skinned
to `warrior.glb`:
`head, chest, arms, hands, legs, feet` (the weapon and shield are not yours: the Weapons lane owns them).
Material ladder, the same one the opponents climb:
L1 rags and rope · L2 leather · L3 bone, hide and the first metal · L4 copper · L5 bronze · L6 iron · L7 steel ·
L8 blackened steel, ruby-set · L9 emerald-set plate · L10 gold.
His own identity device, kept at every rank: **a red sash/cloth** (the red kilt he wears now) and **a single
shoulder piece on the sword arm** (the manica side), growing from a leather wrap at L1 to a gold pauldron at L10.

**Budget per rank kit:** ≤ 35k triangles for all six pieces together, chest ≤ 20k, ≤ 12 MB for the six files. 1024 maps per
piece (2048 for the chest from L7 up).

**Rules:** silhouette first, material second, colour third. Each rank from L7 up has one or two big devices that read at the
fight camera on a 375-wide phone (crest, pauldron mass, cape, shield-arm guard). No helmet at L1; from L2 the helmet leaves the
face open. Nothing may clip through the body in the idle, the walk or a full overhead swing.

**Proof:** for each rank, a front and back render of the full kit in A-pose, plus one render of the hero at L1, L5 and L10
side by side beside an opponent at the same rank (any), so we can see he matches them. Order of delivery: base hero + L1,
then L2–L5, then L6–L10. The Armour lane fits each set to the live rig and shoots the stills.

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
