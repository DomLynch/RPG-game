# Visual audit — baseline 60e94b3 (Task 2)

Evidence: `artifacts/character/baseline/*.png` (harness captures, frozen conditions). Cells are named in each image's caption bar.
Ranked by how much each costs on a phone at the real lock camera (7–8 m, from behind-above).

| # | Defect | Evidence | Why it matters on a 6-inch screen |
|---|---|---|---|
| 1 | **Reads as chrome plastic.** Whole character has four 256² maps; Leather and Antique brass have none. Steel's map is a fine hatch that turns into uniform shine at distance. | `details.png` every cell; `swatches-near.png` "current Steel"; `stats.json` | At 7 m the fighter is a smooth blue-grey blob with one specular streak. No material tells a story. |
| 2 | **Cool-on-cool: fighter colour merges with the floor.** Blue-grey steel on warm-grey stone; only the small heraldry panel is warm. | `gameplay-landscape-ready.png`, `moodboard/swatches-far.png` (current Steel and ash-grey spheres vanish; bronze/iron/leather/red don't) | Legibility is the first job of a fighter on a phone. Value/hue separation from the ground is the cheapest wow there is. |
| 3 | **Symmetrical toy-knight silhouette.** Round bucket helm, two identical sphere pauldrons, round body: no crest, no asymmetry, no hanging elements. Same outline from every angle. | `inspection-turntable.png` all 8 angles | From behind-above (the camera's actual view) the head + shoulders are the silhouette. Right now that outline is a snowman. |
| 4 | **Identical twins.** Opponent differs only by the heraldry panel colour, which is on the chest/back and often hidden by the arms or the pose. | `inspection-turntable.png`; `sequence-zoom.png` frames t=1.25–3.00 | The player must know which fighter is theirs in a quarter-second read; today both are the same grey. |
| 5 | **Helmet is a dome with a floating visor ring; no neck, no gorget/aventail.** Brass ring around the top; a brown torus floats in front of the eye slot; three drilled dots. Head-to-skull fit unreadable. | `details.png` "head front", "head 3/4", "neck / back of helm" | Helmet is 30–40 % of the visible silhouette from the lock camera. |
| 6 | **Shoulders are spheres that intersect the torso and the helmet.** In Heavy wind-up the pauldron sphere passes through the helm; in Guard the shoulder shells float off the arm. | `details.png` "armpit heavy wind-up", "shoulders guard"; `clips.png` Heavy t=0.20 | Every attack starts with a wind-up; the shoulder is what the camera sees during it. |
| 7 | **Hands are mittens with a claw thumb; grip does not wrap the sword.** The fist is a rounded shell, the crossguard sits in it; no finger wrap, no knuckles. | `details.png` "grip attack contact", "grip armed"; `clips.png` Heavy t=0.20 (splayed claws) | Hands are the second-closest thing to the camera behind the player fighter. |
| 8 | **Guard / BlockImpact / Parry are one held frame.** No settle, no breathing, no weight shift; the three defensive poses are visually the same still. | `clips.png` row 3 (Guard, BlockImpact, Parry t=0.50 are near-identical) | Guard is held for seconds at a time; a frozen model reads as a bug, not a stance. |
| 9 | **Feet are rounded pads; scabbard is a flat plank.** No ankle, no boot, no sole; three brass dots. The scabbard is a brown board glued to the hip. | `details.png` "feet strafe", "feet armed", "hips / scabbard" | Ground contact and the hip are always on screen from above; pads slide visually even when the animation plants. |
| 10 | **Sword is a flat untextured blade with a stub guard and no fuller/edge.** Uniform steel, no highlight line, no wrap on the grip. | `details.png` "sword"; `gameplay-landscape-attack.png` (blade disappears against the floor) | The weapon is the only thing that moves fast enough to draw the eye at 7 m; it needs an edge highlight to track. |

Also noted, lower priority: base body is the Quaternius "superhero" proportion (over-built thighs/chest) under the armour;
gambeson under-cloth is near-black so joints read as holes (`swatches-near.png` "current Gambeson"); the trail ribbon is a flat
untextured strip (runtime, not this lane).

None of the ten require changing the skeleton, clip names, durations or blade contact frames.

## Disposition after character pass v1 (humanoid-v5)
1 plastic → fixed (skin/leather/linen maps, iron/bronze/blade materials). 2 cool-on-cool → fixed (skin, linen, leather, red
cloth against the grey floor). 3 toy silhouette → changed: human outline, kilt and baldric; the crested helmet/shoulder tier
adds the asymmetry later. 4 twins → improved: Heraldry now covers skirt + strips (red vs brown lower half); hair/skin variants
are a runtime-material request. 5 helmet → removed (bare head, face visible); higher-tier helmets are slot items.
6 shoulders → removed (bare shoulders; kit inherits body weights). 7 hands/grip → bare hands with fingers; grip sits in the fist.
8 held-frame Guard → OPEN (motion pass / UAL2). 9 feet/scabbard → sandal-boots and a real scabbard. 10 sword → fixed.
