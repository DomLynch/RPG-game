# Arena audit — baseline 9d08824 (Task 1)

Evidence: `artifacts/world/baseline/*.png` (scripts/arena-preview.mjs: the game's renderer settings, lights, fog and lock camera; the two
shipped rigs at the simulation's start; camera settled). Numbers from `baseline/stats.json`. Ranked by what it costs on a phone at the lock
camera (393×852, 7–8 m behind-above the hero).

| # | Defect | Evidence | Why it matters on a 6-inch screen |
|---|---|---|---|
| 1 | **The floor is brighter than the fighters.** White tile `#878579` ≈ 0.24 linear albedo against the hero's skin sample 0.166; both men read as dark cut-outs on the ground. | `lock-portrait.png`; stats `skinLuminance 0.166`, no floor texture | Inverse of readability: the silhouette that has to be read in 14 ticks is the darkest thing in the frame. |
| 2 | **A perfect grid of flat tiles.** No texture, wear, grain or contact darkening; joints are 6 mm boxes; the fighters float on blob shadows. | `lock-portrait.png`, `lock-landscape.png` | Nothing anchors a foot to the ground; footwork (the thing readable brutality protects) has no surface to read against. |
| 3 | **The colonnade is 18 identical untextured boxes at 13.3 m.** Piers, lintels and copings are the same two greys; the repetition reads as a car park, not a ruin. | `wide.png` | The one silhouette behind the far fighter is a flat grey slab every 20°. |
| 4 | **No scale or story cues.** No gate, tiers, crowd, rubble, chains, braziers; one banner design on brass poles. Nothing says "ruined arena at the edge of worlds". | `wide.png`, `plan.png` | The setting is the whole framing device (GAME_SPEC Setting) and the frame has none of it. |
| 5 | **Fog, background and ground are one grey-green.** No sky; 24 seven-sided cones at 65 m read as pyramids. | `wide.png` | The horizon gives no depth or direction; the far fighter has the same value behind him as under him. |
| 6 | **Lighting is flat on the set.** Strong hemisphere fill + room-environment reflections, one sun; the set has no baked occlusion so verticals and floor are the same value. | `lock-landscape.png` (wall base = wall top = floor) | Without contact shade the bays float off the ground and the pit has no bottom. |
| 7 | **263 meshes = 330 draw calls for the environment alone** (486 in the wide view), every tile joint its own mesh. | stats `drawCallsArena 330`, `meshes 263` | Draw-call bound on a phone before a single fighter is drawn; the brief's ceiling is 40. |
| 8 | **The pit floats.** The floor is a 9 m cylinder on a 10 m dark step on a 65 m grey disc: a lighter disc with a visible edge and a dark rim, no ground meeting the bays. | `lock-landscape.png` lower corners, `plan.png` | A visible floor edge inside the frame is exactly a "background element competing with a silhouette". |
| 9 | **Two rings.** A thin bright metallic ring at 8.6 m (the simulation's wall) and a second at 3.3 m with no meaning. | `lock-portrait.png`, `plan.png` | The player is walled at 8.55 m; a second ring teaches a rule that does not exist. |
| 10 | **Warm brass everywhere.** Banner poles and finials share the target marker's brass, the one warm accent in the frame; the marker's threat tell (it warms on a wind-up) competed with the set until the lead split the materials in 09670f1. | `wide.png` (poles) | The tell must be the only thing that warms. |

Also: the place is still labelled *Ashcourt — The Old Keep* (index.html, the pre-Origins keep), and the opponent *ASHCOURT WARDEN*; both are the
lead's strings (REQUESTS.md #1).

## Disposition after Arena v1 (this PR)
1 floor → fixed: sand and gravel, albedo product 0.088 < 0.166 (tested: `tests/arena.test.ts`). 2 grid → fixed: generated sand albedo + normal
map, large-scale mottle and contact darkening in vertex colour. 3 colonnade → replaced: podium wall, five broken tiers, ruined colonnade on the
top walkway, parapet. 4 story → gate with portcullis and dark passage, chains and shackles on the wall, six braziers with baked-glow coals,
eight torn banners (blood and bone cloths), rubble and bone in the band, a crowd of silhouettes on the upper tiers reacting to the fight.
5 sky → an ash dome with one break of light at the sun's azimuth, its horizon the fog colour; two rings of fogged mesas. 6 lighting → set-side
only (contact shade, ash tints, soot); the sun/hemisphere/environment values are the lead's — proposal in REQUESTS.md #3. 7 draw calls → 12
meshes, 15 calls arena-only. 8 float → sand runs under the wall, ash plain under the tiers, no visible edge. 9 rings → one dark trodden inlay
at 8.55 m, nothing at 3.3 m. 10 brass → no brass on the set; iron, coal, cloth, stone, sand, bone.
