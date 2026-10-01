// The arena portcullis rising as he reaches the gate (Dom 2026-10-01, Strategy's ruling): the bars lift RISE_M over RISE_MS on the winch's
// timeline, he walks under them into the fade. main.ts waits for RISE_MS before the fade; arena.ts moves the bars with riseStep.
export const RISE_M = 2.3;
export const RISE_MS = 1250;
/** The lift's progress 0..1 after `dt` seconds toward open (true) or shut (false). The bars fall back faster than they rise. */
export const riseStep = (t: number, open: boolean, dt: number): number => open ? Math.min(1, t + dt * 1000 / RISE_MS) : Math.max(0, t - dt * 4000 / RISE_MS);
/** The lift in metres: eased, so the bars start and settle softly. */
export const riseMetres = (t: number): number => RISE_M * t * t * (3 - 2 * t);
