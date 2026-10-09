// Zone 1 (zone-runtime step 1): the zone's own facts. `level` is the zone number = its base level (Dom 2026-10-08: Zone N = level N); the common creatures are [level, level+1], the named rares level+2.
const zone: { id: string; level: number; world: string[] } = { id: '1', level: 1, world: ['east-road', 'ferry-landing', 'cinder-fields', 'black-mere', 'blood-ruin', 'cinder-hold', 'mere-end'] };
export default zone;
