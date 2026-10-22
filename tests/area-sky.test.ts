// The generic area-sky hook (origins/preview/area-sky.ts): entering an area with a sky row swaps the dome and eases the light; leaving restores the zone's own; an unknown area is no swap.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAreaSky } from '../origins/preview/area-sky.ts';
import { areaSky, goblinPalette, type GoblinPalette } from '../origins/world/goblin-field-rules.ts';

const town = { ...goblinPalette('fortress'), id: 'town', haze: 'town-look' } as GoblinPalette;
const dome = () => { const d = { shown: true, follows: 0, setVisible(v: boolean) { d.shown = v; }, follow() { d.follows++; } }; return d; };
const rig = () => {
  const own = dome(), built: ReturnType<typeof dome>[] = [];
  const sky = createAreaSky({ skyOf: (a) => (a === 'plaza' ? town : null), make: () => { const d = dome(); built.push(d); return d; }, own: () => own, blendS: 2 });
  return { own, built, sky };
};

test('entering a named area shows its dome and hides the zone\'s own; leaving restores the own', () => {
  const { own, built, sky } = rig();
  assert.equal(sky.enter('plaza'), town); assert.equal(built.length, 1);
  assert.equal(own.shown, false); assert.equal(built[0]!.shown, true);
  assert.equal(sky.enter('road'), null);
  assert.equal(own.shown, true); assert.equal(built[0]!.shown, false);
  sky.enter('plaza'); assert.equal(built.length, 1, 'the area dome is built once and reused');
});
test('an unknown area, or none, is no swap and builds nothing', () => {
  const { own, built, sky } = rig();
  for (const a of ['nowhere', null]) { assert.equal(sky.enter(a), null); assert.equal(own.shown, true); }
  assert.equal(built.length, 0); assert.equal(sky.look(1), null);
});
test('the light eases to the area\'s look over blendS and back to nothing on leaving', () => {
  const { sky } = rig();
  assert.equal(sky.look(1), null, 'before entering: the zone\'s own light');
  sky.enter('plaza');
  assert.deepEqual(sky.look(1), { preset: 'town-look', k: 0.5 });
  assert.deepEqual(sky.look(5), { preset: 'town-look', k: 1 });
  sky.enter(null);
  assert.deepEqual(sky.look(1), { preset: 'town-look', k: 0.5 }, 'it keeps the area\'s look while it fades out');
  assert.equal(sky.look(5), null);
});
test('refresh hides an own dome built after the walker was already in an area; follow moves only built domes', () => {
  const { own, built, sky } = rig();
  sky.enter('plaza'); own.shown = true; sky.refresh(); assert.equal(own.shown, false);
  sky.follow({} as never); assert.equal(built[0]!.follows, 1);
});
test('areaSky: no row (or a row naming no palette) is null; the live table has none until a PR adds one', () => {
  assert.equal(areaSky(null), null); assert.equal(areaSky('exchange-no-row'), null);
});
