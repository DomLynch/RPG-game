// Origins O2 content: the walk out — the Pit yard and the Concord Exchange — as world data. It reproduces the greybox's numbers
// (origin/expansion/origins-greybox origins/preview/exchange.ts and main.ts) so the greybox can read them from here with no visible change;
// concord.test.ts pins every one to 1 cm. Region-wide: the Covenant makes the walk out a safe, trading, creature-free place.
import { fail, ok, type Result } from '../../src/core/server.ts';
import { CONCORD_EXCHANGE } from '../../src/core/server.ts';
import { toMetres, toWorld, type Mount } from './derive.ts';
import { resolveZone, SCHEMA_VERSION, type WorldData } from './resolve.ts';
import DATA from './concord.json' with { type: 'json' };

export const CONCORD_REGION: string = CONCORD_EXCHANGE; // one id for the world, the contracts and Trade (region1 spec ruling 7)

// The data lives in concord.json (World, Dom's data-layer day 2026-10-14, as-data debt retired): the Pit's yard is 50 × 50 u around the arena (parapet outer radius 23.2 m); the
// gladiator gate's tunnel starts under the stands and runs 9.6 m to the yard's far edge, where the Exchange begins. The Exchange is 40 × 50 u of paved terrace: 14 standing figures and
// 11 props (6 braziers, 4 stalls, the contract board) on 2000 m² give its densities. concord.test.ts pins every number to 1 cm.
export const CONCORD: WorldData = DATA as WorldData;
if (CONCORD.schemaVersion !== SCHEMA_VERSION || !(CONCORD_REGION in CONCORD.regions)) throw Error('concord.json: its schema version or its region id does not match the code');

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
