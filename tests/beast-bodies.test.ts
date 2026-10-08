// The on-demand beast bodies (src/beast-scale.ts ON_DEMAND_BEASTS) and the files under public/beasts/ are the same set (Characters' review of #1778/#1783): a beast listed without a file would 404 at the duel (an
// invisible foe), and a stray file would ship in dist unaccounted by any row (check-budget counts the folder, not the list). Every listed beast is also a roster body drawn at a render scale of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { BEAST_RENDER_SCALE, ON_DEMAND_BEASTS, beastBodyUrl } from '../src/beast-scale.ts';
import { ROSTER } from '../src/roster.ts';

test('public/beasts/*.glb is exactly ON_DEMAND_BEASTS, and each is a roster body with its own render scale and URL', () => {
  const files = readdirSync(new URL('../public/beasts', import.meta.url)).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/\.glb$/, '')).sort();
  assert.deepEqual(files, [...ON_DEMAND_BEASTS].sort(), 'a listed beast without a file, or a file not listed');
  for (const id of ON_DEMAND_BEASTS) {
    assert.ok(id in ROSTER, `${id} is a roster id`); assert.equal(ROSTER[id as keyof typeof ROSTER].body, id, `${id}: the body file is named for its roster body`);
    assert.ok(beastBodyUrl(id) === `/beasts/${id}.glb`, `${id}: the URL`);
  }
});
