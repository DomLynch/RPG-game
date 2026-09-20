# Finisher cameras — owner phone review 2026-09-20

Owner: Split Crown's side view hid the split ("should be straight on"); Decapitation's front view hid the body behind
the killer ("slight move camera to right").

## Change (src/scene.ts, presentation only — no simulation, asset or clip change)
- Split Crown reveal: `finisherSidePose` angle π/4 (front-quarter) at eye 4.2 m — looks down onto the opened crown.
  The seam runs front-to-back over a head that bows toward the killer; a profile (π/3) hid it.
- Decapitation: still no push-in; camera-right slide 0.8 m; look turns (0.85) onto the midpoint of corpse and severed head.

## Deploy gate failure on trunk (lead, check 22/34 blood-gate)
`detached head stays visible above portrait controls` fails on clean trunk 63f4cd9 — reproduced here on Veteran and
Pitborn (head frame x > 388). Bisect: f495bed (before #184) exit 0; f2aab4f (#184 merged, #177 absent) exit 1 with the
identical head centre (363.1, 488.4) as trunk. #184's approach-mode walk-back moves where the warden stands at the kill;
#177 is cleared. The midpoint framing makes the head position irrelevant to the frame — no ai.ts change requested.

## Receipts (this branch)
- `node scripts/finisher-preview.mjs --only splitCrown,decapitation,runThrough,quietOne,opened,plainDeath --blood-check --no-video --label blood-gate` → exit 0
- Decapitation per opponent (veteran, pitborn, goblin, executioner): exit 0; settled head x within 251..356 of 393; corpse chest not hidden behind the killer; head not occluded.
- Split Crown on executioner: exit 0; side 0.63 (front-quarter), skull not hidden behind the killer.
- `npm run quality` → exit 0 (309/309, build, audit 0, budget, browser passed:true).
- Harness now asserts victim chest/skull visibility (camera ray through the killer's meshes).

Stills: split-crown-executioner-settled.png, decapitation-pitborn-settled.png. Run Through alignment remains open.
