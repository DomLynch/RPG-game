// The stand-back for a body drawn bigger than its rig was built (src/fight/stand-back.ts; the Test Zone's solution, copied read-only). Presentation only: no sim file is read or changed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { builtScale, easeStandBack, mouthReach, standBack, standBackWant } from '../src/fight/stand-back.ts';
import { fxNum } from '../src/fight/fx-rows.ts';
import { beastRenderScale } from '../src/fight/beast-scale.ts';
import { catalogueRow } from '../src/fight/catalogue-rows.ts';

test('the goblin is drawn at 1.25 in the Pit and the field, from one number on his catalogue row', () => {
  assert.equal(catalogueRow('goblin')!.render.scale, 1.25);
  assert.equal(beastRenderScale('goblin'), 1.25, 'the Pit draws what the catalogue says (catalogue.test.ts holds every row to it)');
});

test('a 1.25 goblin stands back about a hand\'s breadth plus whatever the sim\'s contact leaves short of his mouth; a body drawn as built, or smaller, never does', () => {
  const built = builtScale('goblin', 1.25);
  assert.equal(built, 1, 'his rig was built at 1: the row, not the catalogue, is the baseline');
  const clear = mouthReach('goblin') * 1.25 + fxNum('reach.hero-edge') + fxNum('reach.gap') * (0.25 / fxNum('reach.full-scale'));
  assert.ok(Math.abs(clear - 1.185) < 1e-9, `the clear air for a 1.25 goblin is ${clear.toFixed(3)} m (the gap grows ~0.11 m over a body drawn as built)`);
  assert.ok(Math.abs(standBack('goblin', 1.25, built, 0.85) - (clear - 0.85)) < 1e-9, 'at the sim\'s contact distance (0.85 m) he is drawn about 0.34 m further out');
  assert.equal(standBack('goblin', 1.25, built, 2), 0, 'far enough already: no shift');
  assert.equal(standBack('goblin', 1, built, 0.85), 0, 'drawn as built: no shift');
  assert.equal(standBack('wolf', 2, builtScale('wolf', 2), 0.85), 0, 'a beast drawn as its catalogue says (built = catalogue) never stands back');
});

test('the shift is along the hero-to-creature line, eases with reach.dir-tau, and a strafe cannot swing it faster than the ease allows', () => {
  const want = standBackWant(0, 0.85, 0, 0, 'goblin', 1.25, 1);
  assert.equal(want.x, 0); assert.ok(want.z > 0.3 && want.z < 0.4, `${want.z}`);
  const flipped = standBackWant(0, -0.85, 0, 0, 'goblin', 1.25, 1);
  assert.ok(Math.abs(flipped.z + want.z) < 1e-9, 'the other side of the hero: the mirror vector');
  const cur = { ...want }, dt = 1 / 60;
  easeStandBack(cur, flipped, dt);
  const stepped = Math.abs(cur.z - want.z), full = Math.abs(flipped.z - want.z);
  assert.ok(stepped < full * (1 - Math.exp(-dt / fxNum('reach.dir-tau'))) + 1e-12, 'one frame moves the vector by at most the ease\'s share of the swing');
  for (let i = 0; i < 600; i++) easeStandBack(cur, flipped, dt);
  assert.ok(Math.abs(cur.z - flipped.z) < 1e-6, 'and it arrives');
});

test('the sim is not touched: the stand-back lives in the view layer and no SIM file imports it', () => {
  for (const file of ['src/fight/duel.ts', 'src/fight/sim.ts', 'src/fight/ai.ts', 'src/fight/blade.ts', 'src/fight/record.ts', 'src/fight/open-fight.ts', 'src/fight/world-combat.ts']) assert.ok(!/stand-back/.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')), `${file} must not read the presentation offset`);
});
