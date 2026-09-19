# Run Through repair — 2026-09-19

Scope: hero Run Through against the five shipped opponents. The blade remains embedded until rematch.
Fresh lane from trunk 3bfb0eb; inherited finishers and partial alignment worktrees were not modified.

## Root cause and fix
The inherited shoulder-to-tip aiming ray missed by 0.572 m. Aligning the blade midpoint requires
both a grounded presentation step and arm rotation in the shoulder parent frame, which has nonuniform scale.
The final pose is evaluated after both rigs and scene headings. Fin_RunThrough must be a paused one-shot;
looping its last frame returned the killer to the clip start. Restore the pre-aim rotation before each mixer update
so repeated frozen frames and rematch do not retain an additive correction. No simulation, asset or dependency changes.

## Verification
- Original inherited test reproduced the 0.572 m failure; corrected regression passes.
- All five real rigs: twelve seeded headings/spacings each, collapse frames, variable dt, zero-dt hold and rematch pass.
- Mutations disabling aim and reverting ONLY the one-shot setting each fail the regression; production source restored.
- Phone portrait/landscape captures in red/dark/off, rear views and mode cycling/rematch pass on all five opponents.
  opponent-checks.json records finite segment intersection; rear.png shows the Veteran's exposed blade tip.
- Ast-grep confirmed the single shared setLoop site. Semble three queries and CodeGraph impact used before edits.
- Two-pass review: simulation and input untouched; pose reset, parent transforms, clip clock, modes, rematch and actual rendering checked.
- Full quality, configured completion commands, CI and live release receipts follow separately.

Historical Sentry FRANKENDOM-5 event 4d75f31520904bf3baeb378505a71d79 is a production texture-load error
on d383b666, before this change. Existing 6/A/9/8 are fetch/texture/WebGL issues. They remain unresolved;
this pose correction makes no claim to fix them. Physical-phone performance and owner art acceptance remain unclaimed.
