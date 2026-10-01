# Centurion class special, ranks 4–7 — two proposals for Dom's pick (Veteran, 2026-10-02)

Asked by Lead (Strategy's brief, 00:4x). The slot is **B, ranks 4–7**, beside his existing move, Scutum Shove. At these ranks he
carries the gladius and the scutum (from level 6). Nothing here is merged: two preview-only flags, Dom picks, then Combat wires the sim.

## Rules (Dom's, same as the Witch / Plague Doctor / Knight set)

- 20 % of max health, every 20 s, unblockable, ~2 s tell, grounded, smaller than his rank-8–10 bosses.
- **Dark ink.** Nothing pale or glowing. Every mark is darker than the floor (churned wet sand, scuffed earth), low (knee height at
  most), semi-transparent, painted and irregular. No props added; he uses the gladius and scutum he already carries.
- Visible build-up ~0.5–0.9 s; attacker and hero stay readable throughout.
- Both differ from Shield Quake (rank 8: the ripple lane under the foe), so ranks 4–7 and 8 do not read alike.

## Option 1 — Hobnail Line (`?special=hobnail`) ★ Veteran's pick

- **What the player sees:** he walks three heavy steps at the foe, shield up, gladius low at the hip. Each boot leaves a dark
  hobnailed scuff on the sand with a low kick of grit behind the heel. The third step lands on the strike's beat: one short gladius
  thrust, and a low dark spray rolls out of the sand at the foe's feet and thins.
- **Tell:** the three prints, 0.3 s apart, in the last ~0.9 s. Nothing on the ground before that.
- **Readability:** the prints sit between the two fighters, never above the knee; the spray is below the foe's waist.
- **Why:** it is the legionary's own walk, the line closing in. It reads on a phone: a trail of prints pointing at the target.

## Option 2 — Stand Fast (`?special=standfast`)

- **What the player sees:** he braces. A ring of dark dust round his own feet is drawn IN, tight, as if his weight sank the sand. He
  holds a beat, then the ring is flung out toward the foe in a short dark fan as the thrust releases.
- **Tell:** the ring tightening over ~0.9 s, then the held beat. The release is the cue.
- **Readability:** the ring is at his feet only (knee-high at most); the fan runs along the ground between them.
- **Why:** a stillness special, the opposite of Option 1's motion, so a player learns two rhythms from his two moves.

## Not built here (Dom picks first)

- A pose of its own: both use Combat's placeholder heavy raise for now. If Dom picks Hobnail, the walk (`travel`, like Charge's gait)
  and the thrust held low at the hip are the follow-up; for Stand Fast, the shield planted low.
- Audio: a boot-thud per print (Hobnail), or a low groan then a crack (Stand Fast). Audio's.
- Sim wiring (20 %, 20 s, unblockable) is Combat's (#1114), as with every special.

## What is built

`src/special-fx-legion.ts` (one lazy chunk, both options, Charge's blot sprites and the shared special timeline, no sim reads), two
registry entries in `src/special-modes.ts`, two flags in `src/special-look.ts` (rank 5, level 21), `tests/special-fx-legion.test.ts`
(4/4; special-fx-quake 4/4 still green). tsc and the full gate are deferred: a deploy holds this Mac. Day and Night Pit clips are
filmed on the VPS lock after the night batch.
