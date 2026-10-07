// Posture-break payoff beat (research #26, Strategy): the hold a PostureBroken contact stops the frame for, and a dry thud on the existing bone_crack.
// A look test, absent = today's game: `?look=breakbeat` (150 ms), `?look=breakbeat120|150|180` pick the hold; every variant adds the thud, so the
// comparison against no flag isolates the hold. Presentation only: the simulation and its ticks are untouched. Offline it is the one constant below;
// a live duel never stops (main.ts stopFor returns 0 for pvp), so PvP follows Combat's own presentation hold.
export const BREAK_HOLD_MS = 120;   // today's PostureBroken hold (main.ts HIT_STOP)
export type BreakBeat = { holdMs: number; thud: boolean };
export function breakBeatFrom(search: string): BreakBeat | null {
  const m = /[?&]look=breakbeat(120|150|180)?(?=&|$)/i.exec(search);
  return m ? { holdMs: m[1] ? Number(m[1]) : 150, thud: true } : null;
}
