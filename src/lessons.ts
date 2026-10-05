// The five teaching prompts for the scripted first loss. The pattern (an ordered ladder of lessons, one shown at a time, host-agnostic
// pure core + a thin consumer) is adapted from levy-street/world-of-claudecraft src/ui/bootcamp_view.ts @f46f30f, MIT:
//   Copyright (c) 2026 Levy Street. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files, to deal in the Software without restriction, subject to the above copyright notice and this
//   permission notice being included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
//   WARRANTY OF ANY KIND. (Full text: https://github.com/levy-street/world-of-claudecraft/blob/f46f30f/LICENSE)
// Frankendom's words and names only. The fight (src/first-loss.ts, Characters & Art) decides WHEN a beat happens and calls onLesson(id), which
// main.ts turns into `view.lesson`; the ids and their order are theirs (LESSONS there), this file owns the wording, and hud.ts shows the line in the existing #combat-status. No new element, no new button.
// Dom 2026-10-05 / Strategy: these lines DO tell the player what to do, which the 2026-09-24 "reports what happened" rule (combat.ts
// practiceHint) otherwise forbids; they exist only for the scripted first loss and never replace a guard-break line (the beat is not fired then).
export type LessonId = 'stayAfterParry' | 'blockEarnsNothing' | 'rollSideways' | 'woundedStamina' | 'tapStepHoldRoll';

// Same ids and order as first-loss.ts LESSONS; once that file is on trunk this becomes `import type { LessonId } from './first-loss.ts'` and LESSON_ORDER is LESSONS.
export const LESSON_ORDER: readonly LessonId[] = ['stayAfterParry', 'blockEarnsNothing', 'rollSideways', 'woundedStamina', 'tapStepHoldRoll'];

const TEXT: Record<LessonId, string> = {
  'stayAfterParry': 'After a parry, stay and hit.',
  'blockEarnsNothing': 'Blocking is safe, but it earns nothing.',
  'rollSideways': 'Roll sideways, then step back in.',
  'woundedStamina': 'A wounded stamina bar holds less.',
  'tapStepHoldRoll': 'Tap to step. Hold to roll.',
};

export const lessonText = (id: LessonId): string => TEXT[id];

/** The next lesson not yet shown, in order; null when all five have been. */
export const nextLesson = (shown: ReadonlySet<LessonId>): LessonId | null => LESSON_ORDER.find((id) => !shown.has(id)) ?? null;
