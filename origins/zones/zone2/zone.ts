// Zone 2 (the Ash Reach): the zone's own facts. `level` is the zone number = its base level (Dom 2026-10-08: Zone N = level N).
const zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[] } = { id: '2', level: 2, name: 'The Ash Reach', names: { 'ash-reach': 'The Ash Reach' }, world: ['ash-reach'] };
export default zone;
