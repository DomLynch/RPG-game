// The Pit's gate opening (Dom's item 4, 2026-09-30): a tap on the lit gate raises its bars over five seconds, then the light and the way
// out. The timeline is Audio's winch (#1176, src/audio/gate.ts), so one sound covers it: the ratchet starts at 0.05 s and quickens to
// 1.1 s, the bars climb at a steady pace under load to 3.6 s, ease off to 4.34 s where they seat (the knock), and the tail runs out at 5 s.
// Pure: a number of seconds in, how far up the bars are (0 at rest, 1 fully raised) out. room.ts applies it.
export const GATE_OPEN_S = 5;
export const GATE_OPEN_MS = GATE_OPEN_S * 1000;
export const GATE_SEAT_S = 4.34;   // the bars are up and seated: the seat knock, and (PR B) the counterweight's landing
export const GATE_RISE = 2.3;   // m: the bars' travel. Their foot (y 0.035) ends at 2.33 m, over a fighter's head, and the top goes up behind the lintel (the pocket)
const START = 0.05, FULL = 1.1, EASE = 3.6;   // the ratchet's first tick; up to speed; the lift starts to ease

// A trapezoid of speed: up to speed over START..FULL, steady to EASE, down to a stop at GATE_SEAT_S. vmax is the speed that makes the area 1.
const VMAX = 1 / ((FULL - START) / 2 + (EASE - FULL) + (GATE_SEAT_S - EASE) / 2);
const AT_FULL = 0.5 * VMAX * (FULL - START), AT_EASE = AT_FULL + VMAX * (EASE - FULL);

export function gateLift(seconds: number): number {
  if (!(seconds > START)) return 0;
  if (seconds >= GATE_SEAT_S) return 1;
  if (seconds < FULL) return 0.5 * (VMAX / (FULL - START)) * (seconds - START) ** 2;
  if (seconds < EASE) return AT_FULL + VMAX * (seconds - FULL);
  const s = seconds - EASE;
  return AT_EASE + VMAX * s - 0.5 * (VMAX / (GATE_SEAT_S - EASE)) * s * s;
}
