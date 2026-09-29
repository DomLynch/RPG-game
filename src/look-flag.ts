// The `?look=` test-link flag (souls-look.ts). Kept apart so the default bundle carries only this parse, never the post chain.
export type Look = { souls: boolean; shade: boolean; bloom: boolean };
export function lookFrom(search: string, phone: boolean): Look | undefined {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  const souls = tokens.includes('souls'), shade = tokens.includes('shade');
  if (!souls && !shade) return undefined;
  const bloom = /[?&]bloom=1\b/.test(search) ? true : /[?&]bloom=0\b/.test(search) ? false : !phone;
  return { souls, shade, bloom };
}

// `?look=hitfx` or `hitfx-edge` (Lead 2026-09-29, hit-feedback look test; hit-look.ts). The rim flash was ruled out by Dom ("cheap, 2005").
// Absent: nothing is fetched or drawn.
export const hitFxFrom = (search: string): boolean => (new URLSearchParams(search).get('look') ?? '').split(',').some((t) => t === 'hitfx' || t === 'hitfx-edge');
