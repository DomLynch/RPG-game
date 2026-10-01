# Goblin class special, ranks 4–7 — two options (Goblin lane, 2026-10-02)

Strategy's brief via Lead: ranks 1–3 keep the Goblin's skill move (Dirty Jab); ranks 4–7 get a class special. Dom picks one.
Previews only (`?special=<flag>`, the Goblin at rank 7 = level 31), presentation only on the 120-tick timeline, same seam as his rank 8–10 bosses.
Dom's bar applied to both: dark ink and the arena's own sand, **nothing pale or glowing over the fighters**, attacker and hero both readable the whole time,
a ~0.4 s visible build-up, no props. Neither move uses sand-in-the-face (Reynard), a vanish (Hermes) or afterimages (Loki), so they do not borrow from rank 8–10.

| | A. Rat Run | B. Ankle Biter |
|---|---|---|
| Flag | `?special=ratrun` | `?special=skid` |
| Idea | the pit-runner will not stand still: he scuttles low round the hero and cuts in from the flank | he drops flat and skids under the hero's guard to his feet, the knife raking the ankles |
| What the player sees | the Goblin stays in sight, drops into a crouch and runs a quick arc round the hero (about 110°), dark scuffs stamping into the sand behind him, a low trail of dust; he arrives at the hero's flank with the blow, then scuttles back | the Goblin dives flat and slides along the sand toward the hero's feet, leaving a dark dashed furrow behind him and a low wake of dust; the blade rakes at the ankles on the strike, he pops back up and slides home |
| The tell | the crouch and the first steps of the arc, the last ~0.4 s: the sand marks appear as he moves, so the arc is promised before the blow | the drop to the sand and the furrow starting; the line points at the hero's feet |
| Readability | both fighters stay in view and unobscured: the marks are flat on the floor and the dust is low (haze capped at 0.7 day, 0.4 Night Pit); he is never hidden | the same; the slide is below the hero's waist so he sits clear of the hero's torso, and the furrow is a flat dark line |
| Dark ink | brown-black scuffs on tan sand (paler brown, never lighter than the floor, in the Night Pit) | brown-black furrow, same rule |
| Risk | the arc crosses the hero's flank, so from the fight camera it can pass behind the hero's body for a frame or two | the flat pose is a presentation drop of the rig (no new clip), so it reads as a slide, not a dive; Combat's clip would sharpen it |
| Fit with the Goblin | the darting AI that never guards: he is already always moving | the smallest, lowest fighter doing the one thing a tall man cannot answer: going under |

My pick if asked: **A, Rat Run** (it is the move the Goblin already is, and it keeps him on screen) with B as the clearer silhouette.

## How to see them
Films go on the VPS capture lock after the night batch: day arena, fight camera, 375 wide, 5 fps strip + mp4, sent to Lead. No sim wiring: damage and timeline are Combat's (#1114).

## Where it lives
`src/special-fx-goblin.ts` (two new kinds beside Reynard, Hermes, Loki), `src/special-modes.ts` and `src/special-look.ts` (registry rows), `tests/special-fx-goblin.test.ts`.
