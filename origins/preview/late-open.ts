// The saved career can arrive while a preview fight is on (a slow open: Dom's first /zone1/ visit, 2026-10-09, showed the preview "Level 16" over his saved level 50 because the page dropped the
// saved career once a fight had started). A fight is never re-based under the player, so a career that arrives mid-fight is HELD and adopted the moment the fight is over; a newer arrival replaces
// an older held one. Pure: the page hands in `adopt` and `busy`.
export function createLateOpen<T>(adopt: (opened: T) => void, busy: () => boolean) {
  let held: T | null = null;
  return {
    arrive(opened: T): void { if (busy()) held = opened; else { held = null; adopt(opened); } },
    /** Call whenever a fight ends (and the page is no longer busy): adopts what was held. */
    settle(): void { if (held !== null && !busy()) { const opened = held; held = null; adopt(opened); } },
    held: (): boolean => held !== null,
  };
}
