// Origins O2 content: the walk out — the Pit yard and the Concord Exchange — as world data. It reproduces the greybox's numbers
// (origin/expansion/origins-greybox origins/preview/exchange.ts and main.ts) so the greybox can read them from here with no visible change;
// concord.test.ts pins every one to 1 cm. Region-wide: the Covenant makes the walk out a safe, trading, creature-free place.
import { fail, ok, type Result } from '../contracts/core.ts';
import { toMetres, toWorld, type Mount } from './derive.ts';
import { resolveZone, SCHEMA_VERSION, type WorldData } from './resolve.ts';

export const CONCORD_REGION = 'region:concord-exchange'; // the contracts' and Trade's id (economy.ts CONCORD_EXCHANGE; region1 spec ruling 7)

export const CONCORD: WorldData = {
  schemaVersion: SCHEMA_VERSION,
  regions: {
    [CONCORD_REGION]: {
      params: { rules: { safe: true }, density: { creatures: 0 }, ambience: { preset: 'ash-pit', weather: 'dust' } },
      zones: {
        // The Pit's yard: 50 × 50 u around the arena (parapet outer radius 23.2 m). The gladiator gate's tunnel starts under the stands
        // and runs 9.6 m to the yard's far edge, where the Exchange begins.
        'pit-yard': {
          zoneSize: { width: 50, depth: 50 },
          layout: { centre: { u: 0.5, v: 0.5, facing: 0 }, 'pit-gate': { u: 0.5, v: 0.808, facing: 0 } },
          passages: { 'gladiator-gate': { from: 'pit-gate', width: 2.5, length: 9.6 } },
          connections: { exchange: { to: 'exchange', kind: 'gate', here: 'pit-gate', there: 'outer-gate', twoWay: true } },
          density: { npcs: 0, props: 0 },
          terrain: { ground: 'sand' },
        },
        // The Exchange: 40 × 50 u of paved terrace. 14 standing figures and 11 props (6 braziers, 4 stalls, the contract board) on
        // 2000 m² give its densities.
        exchange: {
          zoneSize: { width: 40, depth: 50 },
          layout: {
            'outer-gate': { u: 0.5, v: 0, facing: 180 },
            'covenant-stone': { u: 0.5, v: 0.4, facing: 0 },
            'contract-board': { u: 0.195, v: 0.22, facing: -90 },
            forge: { u: 0.2375, v: 0.71, facing: -90 },
            bank: { u: 0.5, v: 0.84, facing: 180 },
          },
          connections: { pit: { to: 'pit-yard', kind: 'gate', here: 'outer-gate', there: 'pit-gate', twoWay: true } },
          density: { npcs: 0.7, props: 0.55 },
          terrain: { ground: 'paving' },
        },
      },
    },
  },
};

// Where the two zones sit in today's scene: the Pit's centre at the world origin, everything facing the gate (−z, heading π), and the
// Exchange's outer gate at the end of the Pit's gladiator gate. Derived from the data, so a rescale moves the Exchange with the passage.
export function concordMounts(data: WorldData = CONCORD): Result<{ pit: Mount; exchange: Mount }> {
  const pit = resolveZone(data, CONCORD_REGION, 'pit-yard'), exchange = resolveZone(data, CONCORD_REGION, 'exchange');
  if (!pit.ok) return pit;
  if (!exchange.ok) return exchange;
  const heading = Math.PI, p = toMetres(pit.value), centre = p.landmarks.centre, end = p.passages['gladiator-gate'];
  if (!centre || !end) return fail('unknown-id', 'pit-yard', 'the Pit yard needs its centre and its gladiator gate');
  const pitMount = { x: -centre.x, z: centre.d, heading }; // heading π maps (x, d) to (x, −z): this puts the centre at 0, 0
  const gate = toMetres(exchange.value).landmarks['outer-gate'];
  if (!gate) return fail('unknown-id', 'exchange', 'the Exchange needs its outer gate');
  const meet = toWorld(end.to, pitMount);
  return ok({ pit: pitMount, exchange: { x: meet.x - gate.x, z: meet.z + gate.d, heading } });
}
