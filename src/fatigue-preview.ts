// `?look=fatigue-preview` (a look test, presentation only: Dom 2026-10-07 via Lead). Two pieces: (1) the STAMINA BAR turns red and pulses gently in the last 10 % of stamina, with no body
// involvement (hud.ts sets `#stamina[data-low]`, style.css draws it); (2) `&stamina=8` holds the player's stamina at 8 in a DUMMY SPAR so Dom sees the bar (and Lead's tired layer) in seconds.
// Absent = today's game. The force never touches a real fight: main.ts applies it only in a practice dummy spar with no recorder, so no record, rank or PvP number is ever involved.
export const LOW_STAMINA = 10;   // the last 10 % of the 0..100 bar
export const staminaLow = (stamina: number): boolean => stamina <= LOW_STAMINA;
export type FatiguePreview = { force: number | null };
export function fatiguePreviewFrom(search: string): FatiguePreview | null {
  const params = new URLSearchParams(search);
  if (!(params.get('look') ?? '').split(',').includes('fatigue-preview')) return null;
  const n = Number(params.get('stamina') ?? '');
  return { force: params.has('stamina') && Number.isFinite(n) && n >= 1 && n <= 100 ? n : null };
}
