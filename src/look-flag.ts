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
export function pitLookFrom(search: string): 'rack' | 'trophies' | 'gate' | 'wall' | 'vault' | undefined {
  const params = new URLSearchParams(search), tokens = (params.get('look') ?? '').split(',');
  if (!['pit', 'pit-plain', 'pit-stone', 'pit-stone-sand', 'pit-stone-proc', 'pit-stone-full'].some((t) => tokens.includes(t))) return undefined;
  const pose = params.get('pose');
  return pose === 'gate' || pose === 'trophies' || pose === 'wall' || pose === 'vault' ? pose : 'rack';   // wall: the skull wall's panel (src/pit/room.ts POSES)
}
// The Pit's stone (Dom 2026-10-01: "use this one"): GPT's set with AO, the wall damp mask and the torch soot (`pit-stone-full`) is the default of every
// Pit visit, the live one and the `?look=pit` page. The look-test tokens still pick a variant: `pit-stone` is GPT's plain set, `pit-stone-proc`
// Web's procedural one, `pit-stone-sand` GPT's walls over the plain sand floor; `pit-plain` is the room as it was before the stone (stills only).
export function pitStoneFrom(search: string): 'stone' | 'stone-sand' | 'stone-proc' | 'stone-full' | undefined {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  if (tokens.includes('pit-plain')) return undefined;
  return tokens.includes('pit-stone-sand') ? 'stone-sand' : tokens.includes('pit-stone-proc') ? 'stone-proc' : tokens.includes('pit-stone') ? 'stone' : 'stone-full';
}
// `pit-glow` (Dom 2026-10-04, the painted gladiator cell): the same room relit gold, light through the gate bars, Arena 1 beyond them.
// `?look=pit-glow` alone opens straight into the glow room to walk, look and tap (main.ts walkPitGlow); `?look=pit,pit-glow` is the still.
export const pitGlowFrom = (search: string) => (new URLSearchParams(search).get('look') ?? '').split(',').includes('pit-glow');
// `&skulls=demo` (docs/briefs/skull-wall): a fake set of beaten opponents and duel players on the Pit's skull wall, for the look preview only.
export const skullsDemoFrom = (search: string) => new URLSearchParams(search).get('skulls') === 'demo';
// The Pit's look (Dom 2026-10-04: "this is amazing" — the open-air cage, glow-lit, with the realistic blood): the DEFAULT of every Pit visit.
// `?look=pit-cell` keeps the glow but closes the room (the cell Dom compared it with); `?look=pit-old` is the room as it was before 10-04.
export const pitOpenLook = (search: string): { glow?: true; cage?: true } => {
  const tokens = (new URLSearchParams(search).get('look') ?? '').split(',');
  return tokens.includes('pit-old') ? {} : tokens.includes('pit-cell') ? { glow: true } : { glow: true, cage: true };
};
