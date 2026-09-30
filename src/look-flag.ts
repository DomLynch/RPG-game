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
  if (!['pit', 'pit-stone', 'pit-stone-sand', 'pit-stone-proc'].some((t) => tokens.includes(t))) return undefined;
  const pose = params.get('pose');
  return pose === 'gate' || pose === 'trophies' || pose === 'vault' ? pose : 'rack';
}
// `pit-stone` is GPT's stone set; `pit-stone-proc` Web's procedural one; `pit-stone-sand` GPT's walls over the plain sand floor.
export function pitStoneFrom(search: string): 'stone' | 'stone-sand' | 'stone-proc' | undefined {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  return tokens.includes('pit-stone-sand') ? 'stone-sand' : tokens.includes('pit-stone-proc') ? 'stone-proc' : tokens.includes('pit-stone') ? 'stone' : undefined;
}
