// The remote-kit warm stands a second hero 60 m under the ground for two frames per kit (so the shadow pass links its depth programs). Left visible for the whole loop (~50 s after zone ready) it cost ~60 k triangles and 17 draws
// every frame on a phone (Zone 1 census, T4, 2026-10-20). This pins that it is hidden when added and visible only around those two frames.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
const loop = main.slice(main.indexOf('async function warmRemoteKits()'), main.indexOf('const r = await warmKitsWithin('));

test('the kit-warm actor is added hidden and shown only for its two draw frames', () => {
  assert.match(loop, /remote\.anchor\.visible = false; scene\.add\(remote\.anchor\)/, 'hidden when it joins the scene');
  assert.match(loop, /remote\.anchor\.visible = true;[^\n]*\n\s*try \{ await nextFrame\(\); await nextFrame\(\); \} finally \{ remote\.anchor\.visible = false; \}/, 'visible for exactly the two frames, hidden again even if a frame throws');
  assert.equal([...loop.matchAll(/remote\.anchor\.visible = true/g)].length, 1, 'one place makes it visible');
});
