import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { REGIONS } from '../origins/region1/content.ts';

// A region's named landmarks were TypeScript literals in content.ts (flagged by the id-table ratchet #3079); they are rows in origins/region1/landmarks.json now. Pinned, JSON text (key order counts), to the literals they replaced.
test('the region landmarks equal the literals they replaced', () => {
  const of = (id: string) => (REGIONS.find((r) => r.id === id) as unknown as { landmarks: unknown }).landmarks;
  assert.equal(JSON.stringify(of('region:concord-exchange')), JSON.stringify([
    { id: 'square-arch', name: 'The Exchange Arch', at: 'square-arch' },
    { id: 'quarter', name: 'The Exchange Quarter', at: 'quarter-centre' },
  ]));
  assert.equal(JSON.stringify(of('region:ash-frontier')), JSON.stringify([
    { id: 'cinder-hold', name: 'Cinder Hold', at: 'hold-centre' },
    { id: 'mere-end', name: 'Mere End', at: 'end-centre' },
    { id: 'grey-ferry', name: 'The Grey Ferry', at: 'dock' },
  ]));
});
