# Multi-chars (scalable characters) — project state

The lane that makes a sixty-opponent roster affordable: the shared kit library, the grade ladder, loot pieces and the arena guard.
Asset-level entries also land in `character.md` (the character pipeline's own doc) — this file is the lane's standing state, not a copy of them.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-25 (handoff; Strategy PASSED the Witch silhouette)

**Pick up:** nothing until **#709 → #717 are merged** (Lead: no merges before **Sat 2026-09-26 12:00**). Then #716 (Witch loot):
1. ; merge trunk into  (local HEAD  = PR head  + the silhouette commit; the
   commit is backed up at ). Conflicts in  / : take trunk's, then
   **regenerate** (  loot knight.Helmet: scaled 1 1 0.72 about Head, z -0.109 to 0.194
  conform pitborn.Body: 607/938 positions pushed out, most 2.6 cm
  conform shieldmaiden.Body: 923/2036 positions pushed out, most 2.6 cm
  conform shieldmaiden.Boots: 1273/1806 positions pushed out, most 9.6 cm
  conform plaguedoctor.Helmet: 309/735 positions pushed out, most 6.6 cm
  conform plaguedoctor.Boots: 192/522 positions pushed out, most 14.6 cm
  conform knight.Gloves: 114/585 positions pushed out, most 2.0 cm
  conform knight.Boots: 270/503 positions pushed out, most 2.0 cm
  goblin trophies: cord front 0.000,1.467,0.082, nape 0.000,1.532,-0.070
  pitborn helmet: crown 0.194 m above Head, rim radii 0.089 0.107 0.127 0.151 0.182 0.193 0.181 0.149 0.126 0.106 0.088 0.074 0.064 0.058 0.054 0.053 0.054 0.058 0.065 0.075
  pitborn l: shin rings 0.058 0.067 0.065 0.054 0.045 0.046, foot rings 0.078 0.068 0.057 0.048 0.046 0.040
  pitborn r: shin rings 0.058 0.067 0.065 0.054 0.045 0.046, foot rings 0.078 0.068 0.057 0.048 0.046 0.040
  shieldmaiden cap: 0.119 m from Head along the back-leaning axis, rim radii 0.100 0.115 0.135 0.155 0.172 0.178 0.171 0.153 0.133 0.114 0.099 0.087 0.080 0.074 0.071 0.070 0.071 0.075 0.081 0.089
  shieldmaiden mail skirt: rings 0.172 0.179 0.189 0.197 0.196
  dwarf helmet: crown 0.200 m above Head, rim radii 0.098 0.110 0.124 0.139 0.164 0.194 0.200 0.193 0.162 0.138 0.132 0.109 0.096 0.085 0.077 0.071 0.066 0.064 0.064 0.064 0.067 0.071 0.078 0.087, nasal 0.050 m
  dwarf belt: rings 0.173 0.166 0.160 0.158, apron to 0.716 m, kilt front 0.187 m
  dwarf l: shoulder dome 0.061 m above the arm, greave rings 0.063 0.069 0.074 0.069 0.059 0.051 0.050
  dwarf r: shoulder dome 0.049 m above the arm, greave rings 0.063 0.069 0.074 0.069 0.059 0.051 0.050
  nightborn greave l: rings 0.062 0.083 0.087 0.081 0.070 0.064
  nightborn greave r: rings 0.062 0.083 0.087 0.081 0.071 0.064
  witch capelet: rings 0.228 0.228 0.234 0.246 0.276 0.245 0.187 0.118
  witch hood: crown 0.212 m, rim radii 0.140 0.155 0.173 0.188 0.233 0.185 0.197 0.186 0.232 0.185 0.171 0.152 0.137 0.128 0.119 0.106 0.103 0.100 0.099 0.100 0.103 0.112 0.121 0.131
  witch bodice: rings 0.152 0.155 0.160 0.166 0.172 0.178
  witch robe: hip radius 0.192 m, hem 0.327 m, 0.14 m off the floor
  knight breastplate: rings 0.160 0.157 0.157 0.161 0.168 0.176 0.184 0.195 0.196 0.194 0.183
  gloves l: span 0.117 m, ring radii 0.049 0.043 0.047 0.045 0.054 0.023
  gloves r: span 0.117 m, ring radii 0.049 0.043 0.047 0.047 0.054 0.023
  shield: centre 0.647,1.455,-0.067, radius 0.28, stow at spine_03 0,1.2509,-0.0931
  finger joints: 30 bones moved to the body's knuckles (index_l, middle_l, pinky_l, ring_l, thumb_l, index_r, middle_r, pinky_r, ring_r, thumb_r)
Loot → src/assets/loot.glb: 9500944 bytes; 91 draws: dwarf.Arms.Steel, dwarf.Greaves.Steel, dwarf.Helmet.Steel, executioner.Body.Steel, executioner.Helmet.Steel, goblin.Arms.Steel, goblin.Body.Steel, goblin.Greaves.Steel, goblin.Helmet.Steel, knight.Arms.Steel, knight.Body.Steel, knight.Greaves.Steel, nightborn.Body.Steel, nightborn.Greaves.Steel, pitborn.Body.Steel, pitborn.Greaves.Steel, pitborn.Helmet.Steel, shieldmaiden.Arms.Steel, shieldmaiden.Body.Steel, shieldmaiden.Helmet.Steel, veteran.Body.Steel, dwarf.Arms.Antique brass, dwarf.Body.Antique brass, dwarf.Greaves.Antique brass, dwarf.Helmet.Antique brass, executioner.Body.Antique brass, goblin.Arms.Antique brass, goblin.Body.Antique brass, nightborn.Body.Antique brass, pitborn.Body.Antique brass, shieldmaiden.Body.Antique brass, veteran.Body.Antique brass, witch.Body.Antique brass, ~kit.Gloves.Antique brass, ~kit.Shield.Antique brass, dwarf.Body.Leather, dwarf.Greaves.Leather, executioner.Body.Leather, executioner.Boots.Leather, goblin.Body.Leather, nightborn.Body.Leather, nightborn.Boots.Leather, nightborn.Greaves.Leather, shieldmaiden.Body.Leather, shieldmaiden.Boots.Leather, shieldmaiden.Helmet.Leather, veteran.Body.Leather, veteran.Boots.Leather, ~kit.Gloves.Leather, ~kit.Shield.Leather, executioner.Crest.Heraldry, veteran.Crest.Heraldry, executioner.Greaves.Bronze, veteran.Greaves.Bronze, veteran.Helmet.Bronze, executioner.Arms.Wrap, executioner.Boots.Wrap, goblin.Boots.Wrap, nightborn.Arms.Wrap, pitborn.Boots.Wrap, pitborn.Greaves.Wrap, pitborn.Helmet.Wrap, shieldmaiden.Greaves.Wrap, veteran.Arms.Wrap, veteran.Boots.Wrap, goblin.Body.Bone, pitborn.Arms.BoneWorn, nightborn.Helmet.Ruby, dwarf.Boots.DwarfIron, knight.Boots.KnightIron, knight.Gloves.KnightIron, knight.Helmet.KnightIron, plaguedoctor.Arms.PlaguedoctorCloth, plaguedoctor.Body.PlaguedoctorCloth, plaguedoctor.Boots.PlaguedoctorCloth, plaguedoctor.Gloves.PlaguedoctorCloth, plaguedoctor.Greaves.PlaguedoctorCloth, plaguedoctor.Helmet.PlaguedoctorCloth, witch.Body.WitchCloth, witch.Greaves.WitchCloth, witch.Helmet.WitchCloth, witch.Arms.WitchLeather, witch.Body.WitchLeather, witch.Boots.WitchLeather, witch.Greaves.WitchLeather, veteran.Body.Gambeson_veteran, executioner.Body.Gambeson_executioner, nightborn.Body.Gambeson_nightborn, goblin.Body.Gambeson_goblin, pitborn.Body.Gambeson_pitborn, shieldmaiden.Body.Gambeson_shieldmaiden, then smallest spare margin (render px): {"top":174,"left":123,"right":90,"bottom":54}
public/game/img/fighter.webp 411x720 15.3 KB
public/game/img/loot/dwarf.Arms.webp 411x720 2.2 KB
public/game/img/loot/dwarf.Body.webp 411x720 3.6 KB
public/game/img/loot/dwarf.Boots.webp 411x720 2.6 KB
public/game/img/loot/dwarf.Gloves.webp 411x720 3.1 KB
public/game/img/loot/dwarf.Greaves.webp 411x720 3.4 KB
public/game/img/loot/dwarf.Helmet.webp 411x720 2.1 KB
public/game/img/loot/executioner.Arms.webp 411x720 2.8 KB
public/game/img/loot/executioner.Body.webp 411x720 4.4 KB
public/game/img/loot/executioner.Boots.webp 411x720 2.8 KB
public/game/img/loot/executioner.Crest.webp 411x720 2.9 KB
public/game/img/loot/executioner.Gloves.webp 411x720 3.1 KB
public/game/img/loot/executioner.Greaves.webp 411x720 3.5 KB
public/game/img/loot/executioner.Helmet.webp 411x720 1.8 KB
public/game/img/loot/goblin.Arms.webp 411x720 1.8 KB
public/game/img/loot/goblin.Body.webp 411x720 5.8 KB
public/game/img/loot/goblin.Boots.webp 411x720 2.8 KB
public/game/img/loot/goblin.Gloves.webp 411x720 3.1 KB
public/game/img/loot/goblin.Greaves.webp 411x720 3.5 KB
public/game/img/loot/goblin.Helmet.webp 411x720 2.2 KB
public/game/img/loot/knight.Arms.webp 411x720 3.4 KB
public/game/img/loot/knight.Body.webp 411x720 3.0 KB
public/game/img/loot/knight.Boots.webp 411x720 2.9 KB
public/game/img/loot/knight.Gloves.webp 411x720 4.2 KB
public/game/img/loot/knight.Greaves.webp 411x720 2.9 KB
public/game/img/loot/knight.Helmet.webp 411x720 2.9 KB
public/game/img/loot/nightborn.Arms.webp 411x720 2.8 KB
public/game/img/loot/nightborn.Body.webp 411x720 5.5 KB
public/game/img/loot/nightborn.Boots.webp 411x720 4.3 KB
public/game/img/loot/nightborn.Gloves.webp 411x720 3.1 KB
public/game/img/loot/nightborn.Greaves.webp 411x720 3.3 KB
public/game/img/loot/nightborn.Helmet.webp 411x720 2.3 KB
public/game/img/loot/pitborn.Arms.webp 411x720 2.5 KB
public/game/img/loot/pitborn.Body.webp 411x720 3.8 KB
public/game/img/loot/pitborn.Boots.webp 411x720 3.0 KB
public/game/img/loot/pitborn.Gloves.webp 411x720 3.1 KB
public/game/img/loot/pitborn.Greaves.webp 411x720 3.6 KB
public/game/img/loot/pitborn.Helmet.webp 411x720 1.8 KB
public/game/img/loot/plaguedoctor.Arms.webp 411x720 4.3 KB
public/game/img/loot/plaguedoctor.Body.webp 411x720 5.9 KB
public/game/img/loot/plaguedoctor.Boots.webp 411x720 3.6 KB
public/game/img/loot/plaguedoctor.Gloves.webp 411x720 2.9 KB
public/game/img/loot/plaguedoctor.Greaves.webp 411x720 7.7 KB
public/game/img/loot/plaguedoctor.Helmet.webp 411x720 3.5 KB
public/game/img/loot/shieldmaiden.Arms.webp 411x720 2.3 KB
public/game/img/loot/shieldmaiden.Body.webp 411x720 5.5 KB
public/game/img/loot/shieldmaiden.Boots.webp 411x720 4.2 KB
public/game/img/loot/shieldmaiden.Gloves.webp 411x720 3.1 KB
public/game/img/loot/shieldmaiden.Greaves.webp 411x720 3.3 KB
public/game/img/loot/shieldmaiden.Helmet.webp 411x720 1.9 KB
public/game/img/loot/veteran.Arms.webp 411x720 2.8 KB
public/game/img/loot/veteran.Body.webp 411x720 4.8 KB
public/game/img/loot/veteran.Boots.webp 411x720 2.8 KB
public/game/img/loot/veteran.Crest.webp 411x720 1.7 KB
public/game/img/loot/veteran.Gloves.webp 411x720 3.1 KB
public/game/img/loot/veteran.Greaves.webp 411x720 3.5 KB
public/game/img/loot/veteran.Helmet.webp 411x720 2.8 KB
public/game/img/loot/veteran.Shield.webp 411x720 4.6 KB
public/game/img/loot/witch.Arms.webp 411x720 2.2 KB
public/game/img/loot/witch.Body.webp 411x720 5.6 KB
public/game/img/loot/witch.Boots.webp 411x720 3.2 KB
public/game/img/loot/witch.Gloves.webp 411x720 3.1 KB
public/game/img/loot/witch.Greaves.webp 411x720 2.8 KB
public/game/img/loot/witch.Helmet.webp 411x720 4.7 KB
public/game/img/loot/dwarf.Arms.thumb.webp 96x96 1.1 KB
public/game/img/loot/dwarf.Body.thumb.webp 96x96 2.3 KB
public/game/img/loot/dwarf.Boots.thumb.webp 96x96 1.3 KB
public/game/img/loot/dwarf.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/dwarf.Greaves.thumb.webp 96x96 1.9 KB
public/game/img/loot/dwarf.Helmet.thumb.webp 96x96 1.8 KB
public/game/img/loot/executioner.Arms.thumb.webp 96x96 1.4 KB
public/game/img/loot/executioner.Body.thumb.webp 96x96 2.4 KB
public/game/img/loot/executioner.Boots.thumb.webp 96x96 1.6 KB
public/game/img/loot/executioner.Crest.thumb.webp 96x96 1.9 KB
public/game/img/loot/executioner.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/executioner.Greaves.thumb.webp 96x96 2.2 KB
public/game/img/loot/executioner.Helmet.thumb.webp 96x96 1.9 KB
public/game/img/loot/goblin.Arms.thumb.webp 96x96 1.8 KB
public/game/img/loot/goblin.Body.thumb.webp 96x96 2.6 KB
public/game/img/loot/goblin.Boots.thumb.webp 96x96 1.5 KB
public/game/img/loot/goblin.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/goblin.Greaves.thumb.webp 96x96 2.0 KB
public/game/img/loot/goblin.Helmet.thumb.webp 96x96 2.1 KB
public/game/img/loot/knight.Arms.thumb.webp 96x96 1.9 KB
public/game/img/loot/knight.Body.thumb.webp 96x96 1.8 KB
public/game/img/loot/knight.Boots.thumb.webp 96x96 1.5 KB
public/game/img/loot/knight.Gloves.thumb.webp 96x96 1.9 KB
public/game/img/loot/knight.Greaves.thumb.webp 96x96 1.6 KB
public/game/img/loot/knight.Helmet.thumb.webp 96x96 1.8 KB
public/game/img/loot/nightborn.Arms.thumb.webp 96x96 1.4 KB
public/game/img/loot/nightborn.Body.thumb.webp 96x96 2.4 KB
public/game/img/loot/nightborn.Boots.thumb.webp 96x96 2.3 KB
public/game/img/loot/nightborn.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/nightborn.Greaves.thumb.webp 96x96 1.7 KB
public/game/img/loot/nightborn.Helmet.thumb.webp 96x96 2.1 KB
public/game/img/loot/pitborn.Arms.thumb.webp 96x96 1.3 KB
public/game/img/loot/pitborn.Body.thumb.webp 96x96 2.1 KB
public/game/img/loot/pitborn.Boots.thumb.webp 96x96 1.7 KB
public/game/img/loot/pitborn.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/pitborn.Greaves.thumb.webp 96x96 1.9 KB
public/game/img/loot/pitborn.Helmet.thumb.webp 96x96 1.4 KB
public/game/img/loot/plaguedoctor.Arms.thumb.webp 96x96 1.9 KB
public/game/img/loot/plaguedoctor.Body.thumb.webp 96x96 2.3 KB
public/game/img/loot/plaguedoctor.Boots.thumb.webp 96x96 1.6 KB
public/game/img/loot/plaguedoctor.Gloves.thumb.webp 96x96 1.4 KB
public/game/img/loot/plaguedoctor.Greaves.thumb.webp 96x96 2.1 KB
public/game/img/loot/plaguedoctor.Helmet.thumb.webp 96x96 2.6 KB
public/game/img/loot/shieldmaiden.Arms.thumb.webp 96x96 1.3 KB
public/game/img/loot/shieldmaiden.Body.thumb.webp 96x96 2.4 KB
public/game/img/loot/shieldmaiden.Boots.thumb.webp 96x96 2.4 KB
public/game/img/loot/shieldmaiden.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/shieldmaiden.Greaves.thumb.webp 96x96 2.0 KB
public/game/img/loot/shieldmaiden.Helmet.thumb.webp 96x96 1.7 KB
public/game/img/loot/veteran.Arms.thumb.webp 96x96 1.4 KB
public/game/img/loot/veteran.Body.thumb.webp 96x96 2.6 KB
public/game/img/loot/veteran.Boots.thumb.webp 96x96 1.6 KB
public/game/img/loot/veteran.Crest.thumb.webp 96x96 1.3 KB
public/game/img/loot/veteran.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/veteran.Greaves.thumb.webp 96x96 2.2 KB
public/game/img/loot/veteran.Helmet.thumb.webp 96x96 2.7 KB
public/game/img/loot/veteran.Shield.thumb.webp 96x96 2.4 KB
public/game/img/loot/witch.Arms.thumb.webp 96x96 1.1 KB
public/game/img/loot/witch.Body.thumb.webp 96x96 1.7 KB
public/game/img/loot/witch.Boots.thumb.webp 96x96 1.7 KB
public/game/img/loot/witch.Gloves.thumb.webp 96x96 1.5 KB
public/game/img/loot/witch.Greaves.thumb.webp 96x96 1.8 KB
public/game/img/loot/witch.Helmet.thumb.webp 96x96 2.0 KB
63 layers, 411x720 frame; style.css block rewritten). Never hand-merge the binary.
2. ✔ grades: an opponent's tier is the career rung the fight is made at, for every reachable mark count (8.691666ms)
✔ grades: the ladder runs Recruit..Origin and every tier is reachable by fighting (10.825834ms)
✔ grades: a junk mark count degrades to Recruit rather than throwing (0.325042ms)
✔ grades: opponentAt carries the id unchanged and the rung beside it, held recipes included (8.590709ms)
✔ grades: every material the shipped kit uses is classified — a new piece cannot land ungraded (37.888417ms)
✔ grades: the ladder IS the career ladder — one word for a rank and its kit (2.46125ms)
✔ grades: factors only — nothing geometric, and every number in range (0.727208ms)
✔ grades: ten grades a player can tell apart at a glance (0.215125ms)
✔ grades: a grade repaints metal and leather, never bone, authored artwork or cloth (0.216584ms)
✔ grades: the house dye reaches cloth and only cloth (0.156667ms)
✔ grades: the material is read off a draw name, per-opponent tunics included (0.11875ms)
✔ grades: a TRELLIS-cut family grades by its material kind with no CLASS_OF row, and a null exemption stays exempt (0.168958ms)
loot: equipped key "wings" is not a paperdoll key (head, chest, arms, hands, legs, feet, main, off); veteran.Helmet is not worn
✔ loot: a shared draw is exported once and every opponent that wears it resolves through the file's own map (6.666875ms)
✔ loot: the armour piece list is exactly the draws of loot.glb, every piece names its opponent and a known slot, and every slot maps to one paperdoll key (22.651083ms)
✔ loot: every weapon piece names a player weapon whose equip file ships with its clip family, sits in the main hand, and is its opponent's weapon (39.786667ms)
✔ loot: one fixed piece per opponent per career sub-rank, never a duplicate, nothing from an opponent without pieces (4.219ms)
✔ loot: a saved record is cleaned — known ids only, no duplicates, worn pieces must be owned and in their own slot; store, wear, unwear and merge lose nothing (2.761709ms)
✔ loot: equipped is keyed by paperdoll key, never slot name — a slot-named key is dropped and warned about by name, a paperdoll key is kept silently (0.738625ms)
✔ loot: provenance is written once at the drop, cleaned like the rest, its record id fills once from null, and a merge keeps it (0.968584ms)
✔ the loot file shares the hero's scene-root transform (build-warrior.mjs: scale .9/.97/.97, y +.025) (1.61375ms)
✔ the Executioner's mask, shelled from the hero's skull, sits just off his lower face (256.639375ms)
✔ the Nightborn's crown, shelled from the hero's skull, rides on it — not above it (110.595458ms)
✔ every armour loot id has a rendered layer and its style.css rule (7.583208ms)
✔ the figure carries one layer per wearable paperdoll key, head drawn last (3.260125ms)
✔ the Take-one panel is in the HUD under the rank line and the old drop line is gone (2.15025ms)
✔ a declined offer is recorded as a kill with no piece, capped and round-tripped (55.081875ms)
✔ Store moves the worn piece into the first open pack slot; the pack holds PACK.open and then refuses (7.038792ms)
✔ a stored piece is worn back from the pack; a piece already in that slot takes the pack place it left (0.447166ms)
✔ a stored piece survives a refresh: saved, reloaded, still in the pack and not worn (1.039958ms)
✔ the pack is cleaned like the rest: owned, unworn, no repeats, at most PACK.open; an old record packs what Store had lost (0.498375ms)
✔ signed in: a Store is a change to save, and the device's pack is the one kept against an older cloud pack (0.722875ms)
✔ a take into an occupied slot packs the piece it replaces when there is room; with the pack full it would drop it, so the panel asks (0.25075ms)
✔ loot panel: a tap on a tile is the take, and nothing can be taken inside the guard window (7.970125ms)
✔ loot panel: an owned tile is inert, Leave it still declines, and a fresh show clears the guard and the flash (0.401542ms)
✔ loot panel: the take line replaces the tiles and carries Undo; hide clears it (0.285709ms)
✔ loot panel: a full pack asks before a take replaces a worn piece; the tiles and Leave it stay as the "no", Replace is the "yes" (0.71875ms)
✔ a tile names the piece, never its owner: every piece in the game reads as one capitalised noun phrase, no possessive (0.933625ms)
✔ while the arena-cam tour rolls, the tiles and Undo are inert: the first touch stops the tour and never takes a piece (4.933417ms)
✔ loot unscale: every re-proportioned fighter is registered, and each table is per-bone [x, y, z] scales (43.352833ms)
✔ loot unscale: the goblin carries the shape the Boots fit was measured against (0.345875ms)
✔ loot unscale: a fighter who was never re-proportioned stays unregistered, so an unscale against him is still an error (0.251375ms)
✔ loot: every piece of loot.glb has an id in src/loot.ts, and the player wears a piece by binding it to his own skeleton beside his body (943.312875ms)
✔ loot: a piece takes the player's textured material of the same name, dressing again replaces the set, and nothing stays hidden after undressing (670.590708ms)
✔ loot: a creature-pipeline body (the Veteran) wears loot, bound to his CreatureBody, whose Body slot names only empty nodes (704.037792ms)
✔ loot: a worn shield renders both sides — its face is a single-sided disc, so front-only it culled to a hoop from behind (2026-09-23) (1033.852583ms)
✔ loot: one piece that cannot be worn is skipped and named; the rest of the set is still worn and its slot stays his own (678.426625ms)
  dwarf greaves: median 1.2 / p90 1.3 / max 1.6 cm from the skin, y 0.14..0.52 m
  veteran greaves (authored): median 1.5 / p90 1.7 / max 2.0 cm from the skin, y 0.16..0.58 m
✔ every loot draw is skinned to the hero bone order and names its opponent, slot and layer (23.787667ms)
✔ the Dwarf's greaves sit on the hero's shins (73.933709ms)
✔ loot: no `replace` piece undresses the player — each covers at least 80 % of the draws it hides (29.926042ms)
✔ a sim change without a RECORD_VERSION bump would break every live kill link (3.462375ms)
✔ the decoder accept-list is what someone pinned, and this build can read what it writes (2.764583ms)
✔ SIM_FILES is every file a recorded fight imports at runtime (4.036792ms)
✔ the closure walk skips type-only imports and follows every value form (0.2345ms)
ℹ tests 53
ℹ suites 0
ℹ pass 53
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5038.998375, eslint src,
   
> frankendom@0.1.0 typecheck:tests
> tsc -p tsconfig.tests.json, 
> frankendom@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.0 building client environment for production...
transforming...
✓ 487 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/textures/21bb5c2df3fe3bbd0278cf1c8b89ed81c3f62461372fde87d7f8f972579376e9.webp      0.57 kB
dist/assets/textures/62cb651ea2bd02e5da7f8ec63fab7c0e539a363e0fd0a6087847b209ee944758.jpg       1.64 kB
dist/assets/textures/214b5f060d020bfa77c108fb4d0620d86058cc9e18db82261bcc7ae9ab4531b0.jpg       2.24 kB
dist/assets/textures/b4465d7b962b5baa7ccbf5728d28d5e31037cff42ca7f9a1617fea27c4a2ffff.jpg       6.11 kB
dist/assets/textures/fbe06310a1cdb0f20bc9e523e5ea76c0e5f0b162f585f5906bd28331a1f949b8.jpg       6.48 kB
dist/assets/texture-worker-CNjDckkV.js                                                          7.52 kB
dist/assets/textures/73bd21277f7437d70df060bb1104ff02da92739cf9da859d7b8edf4a8b10ba84.jpg       8.65 kB
dist/assets/textures/f24ad2e37b3faab3adeb16efbfb2d8281e2f6b852be3232d0b276521b768d062.jpg       9.23 kB
dist/assets/textures/3ea28801a2cd7b103f52429e7d52ec021e3a008892bb0946d4a72a0ea6eee4da.jpg       9.68 kB
dist/assets/floor-splash-VBGdGM9Y.png                                                          10.12 kB
dist/assets/floor-splash-b-CqKc0fxG.png                                                        12.63 kB
dist/assets/textures/259a82ddcb214e1cd291def6655c6d342071f701c12f3087cf2347516ddb032a.jpg      13.11 kB
dist/assets/floor-splash-c-D1nLS_PD.png                                                        13.31 kB
dist/assets/textures/49c602860bdc6337c4fdb5cb68013641253826e0e28dd1fb8935f40a1776af0c.jpg      13.94 kB
dist/assets/floor-splash-d-BcYkpaVu.png                                                        14.87 kB
dist/assets/blood-wound-d-BuIi8xhG.png                                                         15.50 kB
dist/assets/textures/66d412d4d9926326c4f45d7268b7f9f2b4a19e847f51fab54a89c5aeb6c397e0.jpg      17.46 kB
dist/assets/textures/28aa6a3cfa9a751cbd3f2e97c404d550e79280e8f94b027351ca025fcf6e9367.jpg      17.89 kB
dist/assets/textures/f38188f93fd45189514be559ec9d47e161c3cdbb81b433acd582be3912069596.jpg      17.93 kB
dist/assets/textures/c4db1450199c98c49c73e10de0cccbf4abb0d90ab026d3a79597711cdc65205d.jpg      18.23 kB
dist/assets/textures/6ed619e2215cd9b4f2aa191a806a80c398e03a35bcfca7710edec9ef63bc7143.jpg      18.80 kB
dist/assets/textures/44682fffb465e3ed159ca55aa5e9406963529d5dcfb25d2c9d2cf3d14e5a4e12.jpg      19.07 kB
dist/index.html                                                                                19.21 kB │ gzip:   5.77 kB
dist/assets/blood-wound-b-normal-yOjk2knT.png                                                  19.93 kB
dist/assets/textures/e64f519bb53c700ee1f4addeec37c57c0eb27e474fbf870c5d96d1add687fbda.webp     21.23 kB
dist/assets/blood-wound-c-normal-CUSsjXam.png                                                  23.08 kB
dist/assets/textures/eec096ab081b5e926cfedb14c6cdb470b35e4b2098c3e2fcd3372d245a13e701.jpg      23.36 kB
dist/assets/textures/7585ae541c9c60c746d8bc8e7cf8e225f0919153be835b3adfd08902ab982350.jpg      24.44 kB
dist/assets/textures/b3b5e62cc1ec73120a965b7ee354764161fe4cc0fd701254a36ba8831b4ebc2a.jpg      25.92 kB
dist/assets/blood-wound-b-Bp7BQNl3.png                                                         26.04 kB
dist/assets/blood-wound-d-normal-DlAt43Fh.png                                                  28.38 kB
dist/assets/blood-wound-c-Dg3pb_ZS.png                                                         28.39 kB
dist/assets/blood-drip-normal-BjrmZ9Eo.png                                                     31.76 kB
dist/assets/textures/fb5e1a30e98bca49f45128c8dc0df966e427ee0d2e40ebc7efc71c92558695c2.webp     32.29 kB
dist/assets/textures/def9e01a59b3126bc6dffce6359bbec374d875d03123cb7f4a436ea54efdd86b.jpg      32.38 kB
dist/assets/blood-drip-CQVqvYSS.png                                                            33.32 kB
dist/assets/textures/e32272f256cb04b9594aeb49bf4b6041fb1f210533e97789466d0cc119b7396d.jpg      33.65 kB
dist/assets/textures/c6961640be674d1b2bb6095e0755bf3461d3f44f8b0a57f7a7703bb2d69cfe2d.jpg      34.11 kB
dist/assets/textures/33b93225cf590596b1823ca85434d2174b8b1527161867ba8421c61a0d1bfaad.jpg      35.23 kB
dist/assets/textures/081b8328ae52b178151bc118f5f0cf75a6bce0894d6a554bd2f4d999ac285def.jpg      36.98 kB
dist/assets/textures/1d59824c40a37b7e65b4ebe4f4d8971e439a53db60c0506ef8061fdb2e01670a.webp     40.26 kB
dist/assets/textures/a6c1d73606f21489864ee5c71b4e77e513bf02f93d674dd17822c1d1f4ae3461.jpg      40.92 kB
dist/assets/textures/36f9298111da091ad377eef55351ee2c8e288debb0441de96f2d188dfc2e2ef7.jpg      42.50 kB
dist/assets/textures/ac6670a011c0e8af17fdecc2c47744b61cd9821be293d74629b4b5994c9af1df.jpg      44.22 kB
dist/assets/textures/1597fcc6a6c9871869ddefa9191c00e5271c00f00b69eb16eb1d9e8c0844fbb2.jpg      48.20 kB
dist/assets/textures/2a70b12e5db9b0b329a1c831fdcf46f088b66a0fe9b128d380559a82acc86605.png      49.73 kB
dist/assets/textures/fded5b7ae5211e260d031dacaf63184148f8cbf4d89588f315a29693beffc910.png      51.62 kB
dist/assets/textures/8ec79485adadc99eaef641d03e45adc5c3d6d8f282ba8f5dc88a0f6a241fd371.webp     52.91 kB
dist/assets/textures/2a223e0891ae21fd2867819c91a8d18407eb9451094f663836ee349ef659a928.webp     57.43 kB
dist/assets/textures/b418272debf2a623994449318eb05b61044243a6827b72f861e8579d191cc4ba.jpg      58.56 kB
dist/assets/textures/3063e5fff224e70b151d1d16212bc72fc31bdcc51e82e45af866988a678cb756.webp     58.88 kB
dist/assets/textures/45b894cb833f93305a3e09c1e664c6ea9152e76f8dc5d5a221a948518dfe2c78.png      64.51 kB
dist/assets/floor-pool-b-k5G3v30d.png                                                          71.03 kB
dist/assets/floor-pool-CJU6C07u.png                                                            71.59 kB
dist/assets/column-drum-D_s0Gqf-.glb                                                           72.65 kB
dist/assets/textures/f3efdb48283cece1bb13e00eab31aa53df57b4bcc7b6f3df55cf605c7d5f5d53.jpg      79.80 kB
dist/assets/textures/893b8a456ba7258008f29e10129346c6247231f2d27275f3a01352a3f2e98622.webp     84.78 kB
dist/assets/textures/a4628dbbcb69f055b2073871f027f60373409b5080f7efb27952d5e67786982b.webp     89.64 kB
dist/assets/weapon-rack-9z5RxYYo.glb                                                           95.47 kB
dist/assets/bone-pile-BgEOpemY.glb                                                            100.49 kB
dist/assets/textures/1b2567699912d08e9f23890f453b073dd3fe0499f95c294b61320075cd46a73d.jpg     106.28 kB
dist/assets/shield-B8mVuWpA.glb                                                               109.28 kB
dist/assets/textures/3b8176e3ce7ca1f6c58a81b0c8bb1c8fa216e91c93b3411797f58d2d6abebbdd.webp    119.64 kB
dist/assets/textures/de7471272cbcb2b95b9b3e7be7728ed0ebc5221d4c74624a5d0c5872700f6ae0.jpg     151.14 kB
dist/assets/portcullis-C--O2Kbj.glb                                                           158.93 kB
dist/assets/textures/0889e2418097595d5bfa1ceb1297c7e3d8d09edfc3bf7953cfde7ab092281ac8.jpg     167.32 kB
dist/assets/textures/f995a2312f1347338da09065e8d2cd96d8c3ebae547dd4e95d0ebca56683423e.jpg     174.94 kB
dist/assets/arena-CsEz_Oh0.ogg                                                                178.00 kB
dist/assets/textures/0bc7ee274e9e65198e194759a9d2bd4f6a72a57518af70e7498d6131d1ae95ce.jpg     237.47 kB
dist/assets/textures/d39d6789fc10198bc3ad469a3e32847758c8381e977f31144fce5b3f695693e7.jpg     244.08 kB
dist/assets/arena-BQ1Ix0XS.m4a                                                                268.26 kB
dist/assets/sprite-Cxn0gzqd.ogg                                                               468.75 kB
dist/assets/guard-DIjPJA4Z.glb                                                                503.77 kB
dist/assets/sprite-KrCrmxWz.m4a                                                               568.29 kB
dist/assets/goblin-Cf7ur-oe.glb                                                             3,483.52 kB
dist/assets/pitborn-CDUj-njp.glb                                                            3,506.80 kB
dist/assets/plaguedoctor-CIIPBB48.glb                                                       3,645.42 kB
dist/assets/shieldmaiden-26DNT3Gu.glb                                                       3,669.52 kB
dist/assets/warrior-CMcN6Aui.glb                                                            3,889.96 kB
dist/assets/knight-Doh-MWYr.glb                                                             4,070.90 kB
dist/assets/witch-DEKVL5FV.glb                                                              4,185.06 kB
dist/assets/nightborn-GJNPPTlE.glb                                                          4,312.64 kB
dist/assets/executioner-9s1ZxRnx.glb                                                        4,414.10 kB
dist/assets/dwarf-Bx_Pw34w.glb                                                              4,626.83 kB
dist/assets/loot-fI6DBImK.glb                                                               4,674.90 kB
dist/assets/veteran-D9fGrZ-h.glb                                                            5,550.16 kB
dist/assets/index-D9crLGan.css                                                                 48.13 kB │ gzip:   9.92 kB
dist/assets/account-BhDT9-Js.js                                                               220.87 kB │ gzip:  57.33 kB
dist/assets/index-DugKeWDm.js                                                               1,363.91 kB │ gzip: 413.94 kB

✓ built in 20.52s.
3. Re-shoot the 375x812 fight still (no , , the player seeded with the Witch six, settle 6 s, crop from the
   SAME capture). It must match  on ; keep the PLAYER label
   inside the frame. Update the #716 body (it still describes maps only), push, and re-READY to **Lead**. No deploy.

## Done — 2026-09-24 / 25
- **#716** opened: the Witch's family maps (; patch moved to (1240, 280) off two face charts). Strategy said NOT
  YET: on the player it read as "a dark grey rag with a cap". Route chosen: **silhouette, not texture**.
- **Silhouette, ** (, Witch block). Hood: gap .06, a 7 cm brow peak, the crown drawn back 16 cm
  and up 9 cm. **Capelet** (in the Helmet draw): neck to mid-upper-arm,  rays, skinned spine_02 → Head, with an upper-arm share
  in a shoulder band only. **Robe** (new  draw, 91 draws): an A-line from under the bodice to 14 cm off the
  floor, side slits hem to above the knee, spine + both-thighs-by-angle (.85 by mid-thigh) + side calf below the knee.
  **Strategy PASS** (via Lead, 2026-09-25): (a) no bare shoulder, (b) the head is not round. Poke-through accepted for beta; watch
  Jog 10.7 %/33 mm and Death_QuietOne 14 %/57 mm. The cloak stays in reserve (only if a playtester or Dom names the drape).
- The sharp-peak variant is parked, unshot:   (post-beta, only if Dom asks).

## Open
- #716 waits on #709 → #717, then the rebuild above. Its CI ran on  (maps only), not the silhouette.

## Gotchas — 2026-09-25
- **The player rest pose is a T** (upper arm horizontal at 1.44 m). Anything that rides  below the armpit swings into
  the ribs when the arm drops. Band arm weights to the shoulder.
- **Posed poke-through pass** (scratch Blender script, not in the repo): import  + , point the Witch meshes'
  Armature modifier at the warrior armature, and sample 10 frames × 25 clips. Three traps each gave wrong numbers once:
  (1) take percentiles over ALL covered samples, not only the poking ones; (2) exclude the  mesh (belt + scabbard, worn OVER
  a robe); (3) filter open edges by points SAMPLED along the border edges, not by border vertices (4.5 cm apart on a hem). "Covered"
  = a ray along the vertex normal at rest hits the shell within 15 cm, limited to the bones the shell should cover.
- **Still race:** screenshot after  responds + 6 s, and crop from the same image. A second capture after a short wait
  showed a different state (bare full frame, hooded crop).
- zsh:  strips  as a modifier. Quote it: .
- No network for pip: Provide a command or script to invoke with `uv run <command>` or `uv run <script>.py`.

The following commands are available in the environment:

- python
- python3
- python3.13

See `uv run --help` for more information. works from the cache.

## Now — 2026-09-25 (handoff; Strategy PASSED the Witch silhouette)

**Pick up:** nothing until **#709 → #717 are merged** (Lead: no merges before **Sat 2026-09-26 12:00**). Then #716 (Witch loot):
1. `git fetch`; merge trunk into `multichar/witch-maps` (local HEAD `84076da8` = PR head `37c90cd0` + the silhouette commit; the
   commit is backed up at `origin/multichar/witch-silhouette`, so push that onto the PR branch first if the worktree is fresh). Conflicts
   in `loot.glb` / `public/game/img/loot/*`: take trunk's, then **regenerate** (`WARRIOR_LOOT=1 node scripts/build-warrior.mjs`, then
   `node scripts/loot-layers.mjs`). Never hand-merge the binary.
2. `node --test --test-skip-pattern='\[slow\]' tests/loot*.test.ts tests/grades*.test.ts tests/record-version-guard.test.ts`,
   `npx eslint src`, `npm run typecheck:tests`, `npm run build`.
3. Re-shoot the 375x812 fight still (no `?debug`, `?opponent=witch`, the player seeded with the Witch six, settle 6 s, crop from the
   SAME capture). It must match `silhouette-375x812-labelled.png` at `b36c6344` on `multichar/witch-maps-stills`; keep the PLAYER label
   inside the frame. Update the #716 body (it still describes maps only), push, and re-READY to **Lead**. No deploy.

## Done — 2026-09-24 / 25
- **#716** opened: the Witch's family maps (`loot_witch_maps.py`; patch moved to (1240, 280) off two face charts). Strategy said NOT
  YET: on the player it read as "a dark grey rag with a cap". Route chosen: **silhouette, not texture**.
- **Silhouette `84076da8`** (`scripts/build-warrior.mjs`, Witch block). Hood: gap .06, a 7 cm brow peak, the crown drawn back 16 cm
  and up 9 cm. **Capelet** (in the Helmet draw): neck to mid-upper-arm, `outer` rays, skinned spine_02 → Head, with an upper-arm
  share in a shoulder band only. **Robe** (new `witch.Body.WitchCloth` draw, 91 draws): an A-line from under the bodice to 14 cm off
  the floor, side slits hem to above the knee, spine + both-thighs-by-angle (.85 by mid-thigh) + side calf below the knee.
  **Strategy PASS** (via Lead, 2026-09-25): (a) no bare shoulder, (b) the head is not round. Poke-through accepted for beta; watch
  Jog 10.7 %/33 mm and Death_QuietOne 14 %/57 mm (table: `poke-84076da8.json` on the stills branch). Cloak in reserve.
- Sharp-peak variant parked, unshot: `origin/multichar/witch-sharp-peak-parked` `276bf970` (post-beta, only if Dom asks).

## Open
- #716 waits on #709 → #717, then the rebuild above. Its CI ran on `37c90cd0` (maps only), not the silhouette.

## Gotchas — 2026-09-25
- **The player rest pose is a T** (upper arm horizontal at 1.44 m). Anything riding `upperarm_*` below the armpit swings into the
  ribs when the arm drops; band arm weights to the shoulder.
- **Posed poke-through pass** (scratch Blender script, not in the repo): import `warrior.glb` + `loot.glb`, point the Witch meshes'
  Armature modifier at the warrior armature, sample 10 frames × 25 clips. Three traps each gave wrong numbers once: percentiles over
  ALL covered samples, not only the poking ones; exclude the `Leather` mesh (belt + scabbard, worn OVER a robe); filter open edges by
  points SAMPLED along border edges, not border vertices (4.5 cm apart on a hem). "Covered" = the normal ray at rest hits the shell
  within 15 cm, limited to the bones the shell should cover.
- **Still race:** screenshot after `loot.glb` responds + 6 s, and crop from the same image (two captures once disagreed).
- **Shell traps that bit this session:** an unquoted heredoc executes backticks (it ran a loot build + layers; restored). zsh strips
  `:r` from `$C:refs/...`, so write `"${C}:refs/heads/..."`. pip has no network: `uv run --offline --with pillow` uses the cache.

## Now — 2026-09-23, 21:10 (handoff)

**Pick up NOW (Lead 21:1x, Dom's no-idle order):** the Witch's OWN baked family maps (Strategy's Phase M item). Her pieces wear the
player's Leather/Gambeson/Wrap today. New branch off `phase-r`: write the bake plan, then do a first texture pass. It is NOT in tonight's runs unless it is
READY with stills before **22:45**. Lead wants a one-line "working on:" reply (sent from the previous session at handoff).
Starting points: other families bake per-family `<family>_iron_color/orm.jpg` in `src/assets/source/loot/`, picked up by name in
build-warrior's loot export (the `(Iron|Cloth)$` material-name rule near "lootMaps"). Her scan's albedo is in the creatures pipeline
(`src/assets/source/creatures/witch.*`). The built shells have ringHull UVs (u = around, v = along), so a tiling cloth/leather map is the natural first pass.

**Lock rule (Lead 21:2x, Dom "no rest or breaks"):** don't wait for a FREE broadcast. Check `~/.claude/state/deploy_in_flight.json` yourself;
if it is absent, run bakes/stills at once; while it is held, write code.

**Also:** the Witch's six are done: #602 merged to phase-r (`cd06b7f4`) and went live in Run 2 (per Lead, `a53762ef`);
**#609** (her own Body and Greaves, plus the fit fixes) is READY for Run 3 at head `d0473519`, base `phase-r`, as Lead told the Goblin lane.
If Run 3 bounces #609, it is a rebuild only: merge phase-r, run `WARRIOR_LOOT=1 node scripts/build-warrior.mjs`, then `node scripts/loot-layers.mjs`
and the loot tests, then push. Next Witch work when asked: her own baked loot maps (Strategy: Phase M polish), finishers, the cast clip.

## Done — 2026-09-23 (evening)
- **The Witch wears and offers six** (#602 → Run 2 LIVE; #609 → Run 3). All six are built ring-hull shells in `scripts/build-warrior.mjs`
  (the `if (LOOT)` block above "// Gloves (brief 14"), fitted by ray to the player's worn body: a hood with the face cut open (replace),
  a laced leather bodice (over, **skinned by height across pelvis/spine_01/02/03**, starting above the scabbard loop), bracers
  (lowerarm .2–.66), the shared `kit.Gloves`, cross-gartered leg wraps, and boots (shoe + flat toe box + ankle cuff). The player's materials
  (Leather/Gambeson/Wrap/brass) were ruled acceptable by Strategy tonight.
  Receipts at d0473519: loot.glb 8,874,972 B; loot-layers exit 0; loot tests 33/33; check-budget PASS at 61ab68bb (loot 2,356,815 of 3,500,000 gzip).
  Goblin lane's posed pass (25 clips × 5 frames, covered-at-rest verts, p50/p95/max mm): hood 0 pokes; bodice max 12.4; bracers max 12;
  greaves 0; boots skin p95 5–18 (one death sprawl, max 60).
- `loot.json` gained `kit` (a borrowed tunic keeps its source kit's linen; one bake per kit).

## Open
- Hood crown grazes 7.6 mm at rest (outside the covered set, so not a posed poke). Boots: 60 mm in the Death_QuietOne sprawl only.
- The hood's inside lining showed through the face opening in the loot-layers render, even though the head is a depth occluder. The cause was not found; the lining is dropped (single-sided hood).

## Gotchas — 2026-09-23 (evening)
- **TRELLIS scan cuts make bad loot** (a hood floating before the face, shards, toe lumps). Build shells with `ringHull` instead.
- **A shell rigid to one spine bone clips 5–8 cm in every armed pose.** Weight it by height across the spine joints. Start a bodice above the
  player's pelvis-rigid scabbard loop (y ≤ 1.12 m).
- **ankle→ball slopes ~26°**, so a boot cap on that axis ends inside the sole short of the toes: build the toe box along the flattened forward.
- A ring frame's "+v" isn't guaranteed to face forward: cut openings by position against a measured forward (ball − foot, y zeroed).
- The rig has no forearm twist bone, but the player's forearm is 99% lowerarm up to t .8, so a lowerarm-rigid bracer is correct.
  A posed "poke" test must only test verts the shell covers at rest; otherwise it counts neighbouring limbs.
- `/tmp/frankendom-share/witch-six-own-v6.png` is the latest still (paperdoll layers stacked on fighter.webp; needs Pillow via `uv run --with pillow`).
- A trailing `// comment` pasted before `);` on the same line breaks `typecheck:tests` (the Stop gate catches it).

## Now — 2026-09-23, evening (handoff)

**TOMORROW (2026-09-24), Dom's PRIORITY 1 via Strategy → Lead, 17:xx:** every opponent wears and offers SIX takeable armour
pieces + its weapon, Recruit rag & scrap first, **LIVE target 14:00**. Mine: **the Witch to all six**: Helmet = the hood,
Body = robe + cloak (per SCOPE.md), Arms, Gloves, Greaves, Boots; `witch.Trident` stays. Build on the **Nightborn lane's welded
pipeline once it lands (~09:00)**, not the untextured-Steel .12 cut (ruled out tonight). **One PR**; its body lists the six pieces,
their tri counts, loot.glb size, a same-frame phone still of the Witch WEARING them, and loot-layers green.

**Pick up:** nothing owed tonight (Lead, 17:04). The Witch is on `roster-v0` at `3707dee`; Combat retunes `ARCHETYPES.witch`
and makes the one RECORD_VERSION bump at 21:15 (`combat/bump8-roster` `64dc777` already carries 8). Reports go to **Lead only** (Dom).
Next Witch work when asked: finishers measured on her body (she ships `finishers: []`), then the cast clip, then the
Weapons lane's bladed staff replacing the stock trident. **Paused:** Greaves + `WORN_FROM` + stable drop index (WORN_FROM is post-beta).

## Done — 2026-09-23
- **The Witch moved launch → beta (Dom) and her real body is on roster-v0 `3707dee`.** Route: Kontext A-pose source
  (`docs/character-references/witch-source-v1.png`, prompt + json beside it) → TRELLIS.2 → `creatures.py` recipe `witch` on the
  frozen `source/backups/veteran-v1` donor (hero rig, trident clips). No new RigId, no bone scale, no parts.py.
  ROSTER `witch` (last rung, `finishers: []`), `ARCHETYPES.witch` = verbatim Veteran at scale 1 (by construction: the scan is
  normalised to the 1.80 m donor) as Combat's placeholder, `LOOT.witch = ['witch.Trident']`, `public/versus/witch.webp`.
  Receipts: `creature-check witch` 38/38 clips, 190 finite poses, 48,974 tris, worst grip gap 1.6 cm; per-fight 7,300,295 of 12 MB.
- **Brief 16 deliverable 1, the 3-way silhouette** (Witch / Shieldmaiden / Veteran, flat black, fighting camera): bare IoU
  0.578 / 0.672 / 0.620. Witch–Shieldmaiden is the least alike pair, so option (b) holds. Accepted by Lead.
- Flagged the dist TOTAL cap at 31.45 of 32 MB with three new bodies in; Lead raised it to 40 MB (`cd28ea4`), per-fight unchanged.

## Open
- `record-version-guard` is red on roster-v0 until Combat's 21:15 bump: the ONE expected red (Lead's rule; any other red is real).
- Witch hood/robe as loot carriers: **post-beta** (Lead: untextured Steel .12 cuts on TRELLIS surfaces read badly and turn loot-layers red).

## Gotchas — 2026-09-23
- **Kontext "arms out" webs a cloak wrist-to-ankle** (bat wings, which tear on every guard). Ask for arms ~30° off the sides and
  the cloak "behind her back only, not attached to her arms"; generate 3 seeds and pick.
- **`creatures.py` never recentred a scan.** Hers sat −5.5 cm in x at every height, so there's now a per-family `centre_x`.
  Measure band mid-x at 0.5/1.0/1.3/1.75 m before fitting any new scan.
- **Solve the arm from the scan's hand clusters, don't guess.** Compare the centroid (|x|>0.3, z 0.85–1.05) with the donor's
  posed `hand_l/r`. I guessed a y offset twice and made it worse; the gap was x (74° / 0.88). A narrower frame also needs its
  own arm edge, or the support hand gets no hand weights ("supporting hand detached (Infinity)").
- Silhouette "loadout" masks only show weapons **baked** into a GLB; the trident attaches at runtime, so the versus still is the loadout read.
- A fresh worktree can lack `@types/node` (typecheck:tests fails TS2688); `npm ci` fixes it.

## Now — 2026-09-22, end of session (handoff)

**Both coordinator sessions ended tonight.** Strategy's ended between issuing the tier instruction and my report; Lead
cleared shortly after and put its open items in **#504**. Their live decisions are recorded there and below so they do
not lapse. Nothing of mine is blocked.

**Open PRs, mine:** #495 (this doc), #470 (Brief 16), #474 + #478 (shield), **#510** (opponent tier, head `eb256b0`,
gate 470/0/2), **#513** (unscale fix, head `6836e2d`, gate 469/0/2).

**Next to author: the shared Greaves piece**, the moment #478 lands. Three opponents lack it — Pitborn, Goblin,
Nightborn (`src/loot.ts` `LOOT`) — and it is `over`, so the #434 coverage rule is satisfied by construction, the same
argument that put Gloves first. **Helmet second**, with the identity question answered in its own PR body: three
archetypes dropping one shared helmet reads worse than three dropping one shared greave, and that belongs in a PR
body, not inside an asset decision. **Boots third.**

**Library rule, from the Goblin lane's measurement — put it in the Greaves PR as a rule, not a note about the Goblin
(Lead's wording): pin a shaft by FRACTION of the calf's length, never by absolute height.** Girth at matched fractions
is identical to the hero's (254.1 vs 252.9 mm at 25 %), but the same fraction sits **18.3 mm lower at 25 % and 36.4 mm
lower at 50 %**, so an absolute-height shaft climbs past his calf belly. It bites **Greaves harder than Boots** — a
greave is all shaft and no foot. Also from that measurement: his foot is **not** re-proportioned (513 of 828 verts are
the hero's exactly, 0.00 mm after one rigid `(0, 0, +8.24 mm)` shift that falls out of the calf axis not being
vertical), but the 315 calf-weighted verts deviate up to 4.87 mm in the heel band, so a shoe cut on the hero's heel
sits ~3–5 mm proud at the back. Sole is at exactly `y = 0`; `BUILD.goblin.floor = .12` is the `Roll` clip's wrist lift,
**not** a sole offset. Receipt: `/tmp/frankendom-share/goblin-boots-measurement.json`, measured against
`src/assets/goblin.glb` sha256 `e5a4076d6417…` — ask again if that GLB is rebuilt.

**Boots cost line owed to Strategy with the Greaves PR: a bounded range labelled a floor, never one number.** The hero
already ships authored footwear in the `Boots` slot (`parts.py:446`, `:450`) at **4,192 tri for the pair**, but it is
a sandal plus an ankle band (42.9 mm, 53.4 mm), so a shafted boot is strictly more; `parts.py:521` anchors the other
end at "13k triangles undecimated". The Pitborn's own foot measurement is **queued** with that lane behind the
Shieldmaiden's slots and #478 — deliberately not expedited, since Greaves does not need it.

**Boots ruling, which reversed my proposal.** I argued a shared slot should only be worn by an opponent whose own kit
has it. Strategy overruled it on Dom's Brief 14 line of 18:10 — **from Legionary every opponent wears the full six,
Goblin and Pitborn included** — and the reframing is better: `barefoot: True` is a **Recruit-grade** fact, not a
permanent archetype one, so boots arrive at Legionary as kit fitted **over** the authored foot and **nothing rebuilds
`pitborn.glb`**, which was the part I cared about. The grade floor is Brief 14's general rule, not a barefoot special
case: at Recruit everyone wears 2 of 6.

**The grade-floor schema, approved and NOT yet built** (PR 1 of 3 is #510; 2 and 3 remain):
`WORN_FROM: Partial<Record<LootId, Tier>>` defaulting to Recruit, `LootId` and `LOOT` untouched — sharing is a fact
about the file, a floor is a fact about *when it is worn*, neither about the id. Pin becomes "LOOT lists exactly the
file's draws, every floored id still has one, an opponent below a floor does not wear that slot", mutation-proved.
**Strategy ruled the drop-order shift must be AVOIDED:** keep a stable index over the opponent's full list with
floored pieces **skipped, not removed**, so an existing player's sequence is unchanged minus what the opponent is not
wearing at that rung. `dropFor` picks `pieces[subRank(marks) % pieces.length]`, so a naive filter would change which
piece drops — cost the stable-index version in the PR body with the two rows it touches.

**The simulation boundary cost me a design and is worth knowing before the next one.** `src/roster.ts` is in `SIM`
(`eslint.config.js`) and `tests/sim-boundary.test.ts` lets SIM files import **only each other** — its regex catches
`import type` too. So the tier field could not live on `ROSTER`; it is in `src/grades.ts`, which already owns `Tier`,
`TIERS` and `levelOf`. **Stats imports `tierAt` / `OpponentAt` from `grades.ts`, never `roster.ts`**, and resolves the
loadout outside the sim. Lead had independently told Combat that Brief 14's `grade?: GradeRecord` goes on `ROSTER`;
same boundary, same wrong direction, corrected in #504.

**The Witch.** Approved reference is A, recorded below. **Strategy ruled the silhouette PR WAITS for the
Shieldmaiden's body** — no relaxed two-way, no reorder of Knight → Plague Doctor → Shieldmaiden → Witch. She is
**Pitborn's lane**, not the Executioner's (they wrote Brief 15 on assignment), and her body is gated on #478, so
Pitborn is the session to ask. Her bearded axe is a **new one-hand family** (~13 clips) per Brief 15 at `f6af593`, so
she and the Witch are close in cost and the Witch is not the expensive one by the margin Brief 16 claimed.

**Two measurement rules learned the hard way tonight, both from differencing things defined differently:**
1. **Never erode a mask you are about to difference, and define both masks in one function.** Three hole counts were
   quoted (20,677 → 6,973 → **5,056 px / 2.47 %, adds 0**); the first counted enclosed negative space, the other two
   were `MinFilter(3)` applied to one side or both. The background gate is **max per-row left/right difference ≤ 25**,
   not corner spread — and it cannot see a figure too bright to threshold, which is why the unlit **plate** (`--flat`,
   PR #500) is the second half of the gate.
2. **A bare figure is only comparable to another bare figure cut to the same slot list.** The roster's `LOOT` rows are
   not uniform, so "bare" is not one definition — annotate it with a *what survives stripping* column rather than
   normalising it away. D1 is **mattes, not plates**, for the four launch characters (no mesh), with the Executioner
   lane's matte-vs-plate delta carried as the uncertainty; plate the seven rigged fighters, re-plate each launch
   character from the day it has a mesh. The Witch's first appearance sits on the **reference** side of that delta and
   the PR must say so.

## Now — 2026-09-22, late
**In flight.** The Witch (Brief 16, #470) is mine as of tonight. Her reference sheet is generated and **Dom has picked A**:
**approved reference `docs/character-references/witch-a-deep-hood.png`, owner pick 2026-09-22 23:05** (relayed by Strategy, same line to Lead) —
deep pointed hood, long ragged cloak to the calves, face in shadow, bladed staff. That file is now the reference Brief 16 builds to;
`witch-b-hood-back.png` and `witch-c-wide-brim.png` stay committed as the rejected candidates, not as options.
All three, with their prompts and seed, are in `witch-candidates.json`; the assembled sheet is at `artifacts/character/witch/witch-sheet.png` (**not committed — `artifacts/` is
gitignored**, `.gitignore:4`). Method is the Nightborn lane's, not a script in this repo: FLUX.1-dev **Space** via `gradio_client`,
reusing `kontext.py`'s `token()`, seed 190926, 896×1152, guidance 3.5, 28 steps, from a throwaway script in the scratchpad. `kontext.py`
itself **cannot** do this — it is image→image (`--image` is `required=True`) and there is no text-to-image script in `scripts/character/`.

**The reskin check is open, and the reason is worth keeping.** The plan was to score each candidate's silhouette against the Nightborn's
(a hooded woman in dark layers is closest to *his* outline). Silhouettes come from each image's own pixels — median of three background
corners, mark darker than bg−18, `MinFilter(3)`, **per image**, because a single global cutoff turns a darker render into a solid black
panel. That method needs a plain background, so the script **measures the background before trusting it** and refuses above a spread of
25. His gameplay still came back `[151, 139, 212]`, spread **73**; a scan of every PNG in the Nightborn lane's evidence directories found
**the best spread anywhere is 51**. So no IoU was emitted rather than one that had thresholded the arena. **Blocked on one flat-background
render of the Nightborn**, which his own preview harness produces trivially — asked of that lane, not worked around here.

**Open, in order.** The six-slot kit library: 16 pieces still missing (Pitborn Helmet/Body/Greaves/Boots, Goblin Helmet/Greaves/Boots,
Dwarf Helmet/Body/Arms/Boots, Nightborn Greaves). **A design question blocks Boots**: the Pitborn and the Goblin are `barefoot = True` in
`parts.py`'s `KIT` (hero, veteran, nightborn and executioner are `False`, and the sandal loop at `parts.py:957` skips a fighter on that
flag), so under "every opponent wears six from Legionary on" they would drop boots they never wore. Either a shared slot may only be worn
by an opponent whose own kit has it, or the six-slot rule overrides the archetype and two fighters' `KIT` changes — and that second route
rebuilds `pitborn.glb`, which banks the Season-2 creature re-bake debt.

**Waiting on the publish hold, not on me:** #468 (creature-donor correction), #470 (Witch brief), #474 (shield spec), #478 (shield asset,
rebased on merged #461 at `04ac652`, gate re-run on the rebased tree: 466 pass / 0 fail / 2 known skips).

**Ruling that governs the Witch:** no body work until her dependency is on trunk; bodies land Knight → Plague Doctor → Shieldmaiden →
Witch, so she is last of four; her cast clip is last of hers; all four are launch scope, beta stays the six live archetypes.

**Next stage, and the two things that gate it.** Strategy's line with the pick (23:05) is: silhouette PR lands, then park behind the
beta-critical kit work, cast clip last. Two gates sit in front of that PR and neither is mine to clear:
1. **Brief 16's deliverable 1 is a three-way** — the Witch, the Shieldmaiden and a male archetype as black shapes at the fighting
   camera, run **bare and in loadout**. The Shieldmaiden is the Executioner lane's (Brief 15) and lands **before** the Witch in the
   bodies order above, so the three-way cannot be rendered until her body exists. A two-way against a male archetype only answers half
   the question the brief asks — whether two women on one rig read as the same person — so shipping that as the silhouette PR would
   pass for the wrong reason.
2. **The reskin check still needs one flat-background render of the Nightborn** from his lane — routing asked of Lead 2026-09-22.

## Shared draws, and gloves as their first customer — 2026-09-22
The schema change is in: a piece the whole roster wears is exported **once**, named `~<id>.<material>`, and loot.glb carries its own
`<opponent>.<slot>` → `~<id>` map so the file is self-describing and no second asset has to be kept in step. An opponent wears it with
`{"slot", "layer", "shared"}` in `loot.json` and contributes no geometry. Old-style per-opponent draws are untouched: `lootPiecesOf()`
gives every piece the ids it answers to and falls back to its own name, so **an old file and a new one both load** and the loader never
had to land in the same PR as the asset.

One correction to the ruling's arithmetic, in our favour: loot always binds to the **player's** rig, so a shared piece needs exactly one
fit here — the per-rig-family dimension only exists in the opponents' own fight GLBs, which loot never touches. The library is `~kit.*`,
not `~human.*`.

**Gloves** are the first piece through it: the only slot no opponent wore, fingerless (the fingers animate; a rigidly-bound glove over
them would tear open on a fist), fitted by raycast from the hand's own axis at six stations × 12 azimuths with a median fallback for rays
that miss — a hand is not a closed surface from its own axis, unlike the goblin's neck. **800 triangles for both hands, +7,524 B packed
gzip for all six opponents.** Under the old schema the same gloves would have cost 6 × 800 = 4,800 triangles and about six times the
bytes. Budget after: `loot 983,064 of 1,500,000` (check-budget on the dist build). Evidence: full gate 466 pass / 0 fail / 2 skips;
mutation-proved by suppressing the map write (the pin fails, 4 pass / 2 fail) and restoring it (6 / 0, file byte-identical).

## Now — 2026-09-22
Brief 14's table is on trunk; the **loot manifest schema change** is next and nothing else starts before it. The file today stores one
copy of every piece **per opponent**, because a draw is named `<opponent>.<slot>.<material>`. That was right when every piece was authored
for one fighter and is wrong the moment the kit library is shared. Lead ruled (18:18) to take the schema change and **not** raise the cap:
one draw per (piece, rig family), the manifest mapping opponent + slot → shared draw + material, and **`LootId` stays `<opponent>.<slot>`**
so drop identity, provenance and the journal are untouched. The loader is Lead's; my file PR must resolve **both ways** — new manifest and
old-style draw name — so trunk survives the gap between my file landing and their loader.

Then the six-slot kit. **Gloves first**: the only slot no opponent wears today, so it is genuinely one shared piece rather than six; it is
`over`, so the coverage rule below is satisfied by construction instead of by measurement; and it is loot-only, so no fight rig is rebuilt.

## Done — 2026-09-22
- **#428 the arena guard** (Brief 13): one cheap shared lorarius, `WARRIOR_GUARD=1` on the hero rig — decimated body, cap, coiled whip,
  five clips, animation diet, own small skin crops. 231,620 B packed gzip against the 400 KB `guard` row after the first build came in at
  1,050,136 B; the fix came from **measuring** the packed breakdown (images 419,069 / geometry 495,676 / animation 29,272), not from
  guessing — my first guess, animation, was wrong. The world lane instances it six times (#430/#435): 148,404 tris, 86 draws, frame p95
  17.6 ms at the phone tier.
  Guard contract, measured off the shipped GLB: `Pace` travels **0.963 m/s at timeScale 1** (0.642 m forward foot separation, two steps per
  the 1.333 s cycle); there is **no `stride` userData** and there should not be (that is a re-proportioned rig's leg correction and the guard
  is the hero rig); `Raise` 0.50 s and `Lash` 0.60 s are LoopOnce + clamp; fingers and toes carry **no tracks at all** (stripped for budget —
  a finger that must move is a rebuild, not a runtime fix). **The world lane does not play `Turn`** (their decision, #435): a guard tracks the
  nearest fighter, which is a continuous heading, and `Turn`'s in-GLB `root.quaternion` track would compose with their outer-root yaw and spin
  him 360°. So a rebuild that changes or drops that root track cannot break them.
- **#434 the skin audit and the coverage rule.** Dom took a Pitborn chest piece and fought bare-chested. The reported cause was wrong and the
  correction is the finding — see Gotchas.
- **#438 → #451 the grade ladder.** Eight tiers first, then the owner's ten. `TIERS` is `career.ts`'s `TITLES` **itself**, not a copy, so a
  tier and a rank cannot drift and `levelOf(tier)` derives 1..10 — a `grade` record whose `level` and `tier` disagree is a data error rather
  than a second meaning. Recruit rag & scrap · Legionary leather · Gladiator bone · Veteran copper · Champion bronze · Praetorian iron ·
  Master steel · Primus blackened · Invictus **emerald** · Origin gold & ruby. A grade repaints metal, trim and leather only; cloth is the
  house dye (`grade.house`), so two opponents of one house wear the same linen over different metal. Two taste decisions defended in code:
  the Gladiator's bone steps **sideways** rather than up (four rungs of progressively better brown is worse than a landmark — pinned as less
  lit than the copper above it), and copper sits deliberately off bronze because Veteran and Champion are adjacent. Emerald at 9 is Dom's
  (18:15): blackened at 8 and black vanadium at 9 read flat against each other.

## Open
- **The six-slot kit across three rig families.** Live today: Pitborn 1 armour piece, Dwarf 1, Goblin 2, Nightborn 4, Veteran 6,
  Executioner 6 — against a target of six from Legionary on. Sixteen pieces missing after the gloves; the remainder are per-opponent shapes, not one shared piece. Shared pieces fitted per rig
  family by raycast, tiers as material variants on the same mesh.
- **The Veteran shield** (Dom GO 18:40), third in order. Loot-only (see Gotchas). Mine: the asset with **two transforms** — in the off-hand
  and flat on the back — plus the back attachment point on the player rig. Lead's: the equip/stow decision, the loader picking off-hand versus
  back by reading Weapons' `grip` field (ONE-HAND knife, cleaver, estoc, trident-as-spear; TWO-HAND warhammer, scythe, hero sword). Combat own
  the shield's fight rules; Web design own the panel copy.
- **The Dwarf's second Recruit piece.** Recruit wears 2 of 6 and he has one; Lead left the choice to me, with the constraint that it must
  cover at least what it replaces. To be justified in its PR body.

## Gotchas — the expensive ones
- **A sparse `replace` piece undresses the player, and neither vertex count nor bounding box catches it.** `pitborn.Body` was his rag sash at
  **0.359 m² against the player's 1.359 m² chest kit — 26 %** — and `layer: replace` hid the player's whole tunic to put it on. The sash spans
  nearly the tunic's full height, so only **triangle area** sees it. `tests/loot.test.ts` fails any `replace` piece under 80 % of what it hides
  (Helmet and Crest exempt: they hide hair). Everything that belongs measures 103–159 %; the one that didn't measured 26 %. Note the diagnosis
  that was reported — "the Body draw is skin" — was false: **no loot draw uses the `Skin` material anywhere in the file.**
- **A grade must never be a different mesh.** Tiers are material variants on the *same* piece, so the coverage rule above stays true by
  construction as the roster grows; a lighter tier replacing a heavier piece would otherwise undress the player by exactly that mechanism.
- **`LOOT` is pinned against the file's draws** (`tests/loot-data.test.ts`), so a slot declared without a mesh **fails the pin**. That is the
  behaviour we want, and it means slots land **with** their meshes — several asset PRs, not one data PR followed by art.
- **Creature donors — corrected 2026-09-22 against the code, because the first version of this entry (mine) was too broad.**
  `scripts/creature-check.mjs:39` pairs each family with its base: minotaur→`pitborn`, werewolf→`pitborn`, wraith→`nightborn`, but
  **skeleton→`source/backups/veteran-v1`**, executioner→`source/backups/executioner-v5`, dwarf→`source/creatures/dwarf-donor`. So the
  Skeleton keys on a **frozen backup**, not the live Veteran: rebuilding the Veteran fight GLB does **not** make it stale. And the three
  that do key on live fight GLBs are all `hold: true`, which the check filters out (`.filter(([id]) => !ROSTER[id].hold)`), so rebuilding
  `pitborn.glb` would not fail `creature-check` today either — it leaves a **latent re-bake debt** that bites when Season 2 unholds them.
  Gloves and the shield stay loot-only for that reason (and for not churning fight rigs), not because the gate would go red. Verify against
  the script before repeating either version of this.
- **The budget arithmetic that forced the schema change.** `loot.glb` is **1,407,428 B packed gzip against a 1,500,000 cap** — 6 % headroom —
  carrying 19 pieces / 72,027 triangles. A complete six-slot set costs about **21,000 triangles** (the Veteran's six 20,412, the Executioner's
  six 21,730). Six opponents × six slots ≈ 126,000 triangles ≈ **2.4 MB, roughly 60 % over**. A per-opponent copy scales with the roster; a
  per-(piece, rig family) copy scales with the kit.
- **Budgets are measured on the packed dist file**, meshopt then gzip — not on the source GLB. A test that gzips the unpacked source would
  fail honest builds (mine did, before `optimizeGlb` went in).
- **Mutation-prove every new guard.** Restore the defect, watch the test fail, revert, confirm the asset is byte-identical and it passes. A
  guard never seen to fail isn't a guard. Done for the coverage rule (#434), the ladder-order drift guard (#451) and the material
  classification (#438).
- **A missing per-fighter KeenTools head used to fall back silently** to a generic CC0 head; it was caught only by an unexpected +3 MB size
  jump. `parts.py` now fails loudly (`HEAD_KT`).
- **`nightborn-estoc.glb` must stay byte-identical to `nightborn.glb`** or `tests/weapons.test.ts` hangs ~280 s on a Buffer deepEqual.
