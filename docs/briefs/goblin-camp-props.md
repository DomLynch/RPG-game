# Brief: goblin camp props (3D models) - for Characters & Art, via Lead, when Dom says go

From the Zone sandbox, 2026-10-16. Status: DRAFT for Dom. No art is made from this brief until Dom and Lead say go; the camp already draws with box-and-cone stand-ins.

**What this is.** The goblin camp (kit `goblin-camp`, `origins/world/props-defs.json`) places 13 props through rows. Each prop row has `parts` (the stand-in drawn today) and a `glb` node name (the model that replaces it). A model arrives as a node of that name; the row then swaps `parts` for `glb` one prop at a time, with NO zone change. Nothing reads `glb` yet; the swap code is a follow-up once a first model exists.

**What reads at 375 wide.** Dom/Strategy: a camp reads by silhouette; five good props beat twenty boxes. Priority order (hero pieces first): `goblin_tent` (hide tent, 3 m, a pole, lashed skins), `goblin_totem` (carved pole with a horned head and hanging skulls, 2.4-3.4 m), `goblin_banner` (a crude red cloth on a pole, ~3 m), `goblin_fire` (ring of stones, crossed logs, an ember disc on the coal layer; the smoke and flicker light are the page's), `goblin_palisade_a/b/c` (a 5 m run of sharpened stakes lashed with two rails, three variants).
Then the small ones: `goblin_dead_tree`, `goblin_bones_a/b/c`, `goblin_ribcage`, `goblin_cairn`.

**Constraints (the existing kit contract, `look.props.kit`, zone1-kit.glb pipeline).** Low poly (the whole camp is ~20k triangles today; a prop is a few hundred), one shared material or an atlas, origin at the prop's ground centre, +Y up, local +X along the long side (the palisade runs along X), real-world metres, no collider (dressing you walk past), licence recorded. Dom's reference: the fortress picture (towers, banners, torches, spiked palisade) in `public/zones/goblin-fortress-landscape.webp`.

**Do not** invent a second naming scheme: the names are the rows' `glb` values; to rename, change the row.
