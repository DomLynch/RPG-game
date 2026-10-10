// Zone 2 (the Ash Reach): the zone's own facts. `level` is the zone number = its base level (Dom 2026-10-08: Zone N = level N).
const zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[]; biome?: string; camera?: Record<string, unknown> } = {
  "id": "2",
  "level": 2,
  "name": "The Ash Reach",
  "names": {
    "ash-reach": "The Ash Reach"
  },
  "world": [
    "ash-reach"
  ],
  "camera": {
    "presets": {"a":{"back":3.6,"up":2.1,"side":0.8,"ahead":4,"lookY":1.5},"b":{"back":6.4,"up":3.5,"side":0,"ahead":2,"lookY":1.1}},
    "preset": "b"
  }
};
export default zone;
