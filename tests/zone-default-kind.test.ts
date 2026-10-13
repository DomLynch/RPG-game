// A zone row's `defaultKind` column replaces the 'goblin' literal in origins/preview/mobs.ts: it is required, and a name that is not a roster body is a zone problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadZone, zoneIds, zoneProblems } from '../origins/zones/loader.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';

test('every shipped zone names a roster body as its defaultKind, and an unknown one is refused', () => {
  for (const id of zoneIds()) assert.equal(loadZone(id).defaultKind, 'goblin', `zone ${id}`);
  const z = loadZone('1');
  assert.deepEqual(zoneProblems(z).filter((p) => p.includes('defaultKind')), []);
  assert.ok(zoneProblems({ ...z, defaultKind: 'nobody' }).some((p) => p.includes('defaultKind nobody')));
});
test('a zone row without defaultKind is refused', () => {
  assert.throws(() => zoneFromRow(9, { name: 'x', kit: {}, looks: {} }), /"defaultKind" is required/);
});
