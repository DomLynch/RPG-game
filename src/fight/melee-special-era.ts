// The melee-special rules' ERA (Combat, the flip, RV78, Dom 2026-10-17/18). Before v78 a melee special (no spell) committed for the spell delay, was pressed from any distance and
// landed with damage only; from v78 it commits for specialMeleeWindup ticks, is pressed and released only inside specialMeleeReach (+ slack) and staggers its victim from its move row
// (sandbox-rules.ts reads the rows). A record below 78 keeps the old fight byte for byte. Same pattern as the breath cone (cone-era.ts): a leaf of the simulation (no imports), ON for
// a live fight and for a record at FIRST_MELEE_SPECIAL_VERSION or later, OFF only while a record below it replays (detmath.ts underRecord, match.ts replay).
export const FIRST_MELEE_SPECIAL_VERSION = 78;
export let MELEE_SPECIAL_ON = true;
export function setMeleeSpecial(on: boolean): void { MELEE_SPECIAL_ON = on; }
export function underMeleeSpecial<T>(version: number, run: () => T): T {
  const outer = MELEE_SPECIAL_ON; MELEE_SPECIAL_ON = version >= FIRST_MELEE_SPECIAL_VERSION;
  try { return run(); } finally { MELEE_SPECIAL_ON = outer; }
}
