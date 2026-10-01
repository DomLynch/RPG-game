// The `?look=` test-link flag (souls-look.ts). Kept apart so the default bundle carries only this parse, never the post chain.
export type Look = { souls: boolean; shade: boolean; bloom: boolean };
export function lookFrom(search: string, phone: boolean): Look | undefined {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  const souls = tokens.includes('souls'), shade = tokens.includes('shade');
  if (!souls && !shade) return undefined;
  const bloom = /[?&]bloom=1\b/.test(search) ? true : /[?&]bloom=0\b/.test(search) ? false : !phone;
  return { souls, shade, bloom };
}
// `?look=pit` (the Pit's look test, docs/pit-design.md §7): the room instead of the fight, camera at the rack; `&pose=gate` at the gate,
// `&pose=trophies` at the trophy wall. `?look=pit-stone` is the same room in Web's stone look (src/pit/stone.ts).
export function pitLookFrom(search: string): 'rack' | 'trophies' | 'gate' | 'vault' | undefined {
  const params = new URLSearchParams(search), tokens = (params.get('look') ?? '').split(',');
  if (!['pit', 'pit-plain', 'pit-stone', 'pit-stone-sand', 'pit-stone-proc', 'pit-stone-full'].some((t) => tokens.includes(t))) return undefined;
  const pose = params.get('pose');
  return pose === 'gate' || pose === 'trophies' || pose === 'vault' ? pose : 'rack';
}
// The Pit's stone (Dom 2026-10-01: "use this one"): GPT's set with AO, the wall damp mask and the torch soot (`pit-stone-full`) is the default of every
// Pit visit, the live one and the `?look=pit` page. The look-test tokens still pick a variant: `pit-stone` is GPT's plain set, `pit-stone-proc`
// Web's procedural one, `pit-stone-sand` GPT's walls over the plain sand floor; `pit-plain` is the room as it was before the stone (stills only).
export function pitStoneFrom(search: string): 'stone' | 'stone-sand' | 'stone-proc' | 'stone-full' | undefined {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  if (tokens.includes('pit-plain')) return undefined;
  return tokens.includes('pit-stone-sand') ? 'stone-sand' : tokens.includes('pit-stone-proc') ? 'stone-proc' : tokens.includes('pit-stone') ? 'stone' : 'stone-full';
}
// `?look=nightrim` (night-rim.ts): the Night Pit's cool rim light on both fighters. The scene only asks in that arena.
export const nightRimFrom = (search: string): boolean => (new URLSearchParams(search).get('look') ?? '').split(',').includes('nightrim');
