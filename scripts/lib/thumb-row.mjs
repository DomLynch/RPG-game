// SHARE's place after a fight (C1, Dom 2026-09-25): the one control allowed out of the #actions box, and only into the thumb row —
// its top no higher than 60 px above Next's — never over Next or the joystick. Pure, so tests/thumb-row.test.ts can pin the rule;
// scripts/endgame-hud-check.mjs applies it to the live page's rects. Rects are {x, y, w, h} in CSS px. Returns the broken rules.
export const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// `row`: the DUEL / LINK / CLIP row of a portrait phone sits above the thumb row on purpose (Strategy 2026-10-02, in the clear sand above the heads), so
// it skips the thumb-row band but keeps the two overlap rules.
export function shareFaults(share, next, joystick, { row = false } = {}) {
  if (!share) return [];
  const faults = [];
  if (joystick && intersects(share, joystick)) faults.push('over the joystick');
  if (next && intersects(share, next)) faults.push('over Next');
  if (!row && next && share.y < next.y - 60) faults.push('above the thumb row');
  return faults;
}
