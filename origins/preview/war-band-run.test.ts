import test from 'node:test';
import assert from 'node:assert/strict';
import { createWarBandRun, type BandMobs, type BandPose } from './war-band-run.ts';

// Five goblins in a line at z = 0; a fake creature view that records what the war band does to it.
const make = (enabled = true) => {
  const at = new Map<string, { x: number; z: number }>(), aggro = new Map<string, number>(), driven = new Map<string, BandPose | null>(), toasts: string[] = [];
  const band = ['a', 'b', 'c', 'd', 'e'].map((id, i) => { at.set(id, { x: i * 3, z: 0 }); aggro.set(id, 9); return { id, loadout: id === 'a' ? 'heavy' : id === 'e' ? 'light' : 'medium' }; });
  const weight: Record<string, number> = { heavy: 6, medium: 4, light: 2 };
  const mobs: BandMobs = {
    find: (id) => at.get(id) ?? null,
    drive: (id, pose) => { if (pose) { driven.set(id, { ...pose }); at.set(id, { x: pose.x, z: pose.z }); } else driven.set(id, null); },   // a driven creature stands where it was driven to, as in the page
    setAggro: (id, v) => { const was = aggro.get(id); if (was === undefined) return null; aggro.set(id, v); return was; },
  };
  const hero = { x: 0, z: 40 };
  const run = createWarBandRun({ mobs: () => mobs, band, piecesOf: (l) => (l ? weight[l]! : 0), hero: () => hero, engagedId: () => undefined, toast: (t) => toasts.push(t), enabled: () => enabled });
  return { run, at, aggro, driven, toasts, hero };
};
const frames = (run: ReturnType<typeof make>['run'], seconds: number) => { for (let t = 0; t < seconds * 60; t++) run.tick(1 / 60); };

test('nothing happens until a goblin is hit; then the horn-blower (the lightest) walks to the horn, the horn rallies the nearest goblins, and every notice radius is given back', () => {
  const w = make(); frames(w.run, 1);
  assert.equal(w.driven.size, 0, 'a quiet band is not driven'); assert.deepEqual(w.toasts, []);
  w.run.hit('c'); assert.deepEqual(w.toasts, ['A goblin runs for the horn!']);
  frames(w.run, 20);   // the blower is 'e' (the lightest), the horn hangs 8 m behind the band's centre
  assert.ok(w.toasts.includes('A horn sounds! The war band rallies!'), 'the horn is blown when he arrives');
  const raised = [...w.aggro].filter(([, v]) => v !== 9).map(([id]) => id);
  assert.ok(raised.length >= 4, `the nearest goblins and the captain are rallied: ${raised}`);
  frames(w.run, 60);   // past the rally's seconds
  assert.deepEqual([...w.aggro.values()], [9, 9, 9, 9, 9], 'every notice radius is back: nobody stays rallied');
});

test('the horn-blower killed first: the horn is never blown and nobody is rallied', () => {
  const w = make(); frames(w.run, 0.1); w.run.hit('a'); w.run.fell('e'); frames(w.run, 30);
  assert.ok(w.toasts.includes('The horn-blower is down: no horn!')); assert.ok(!w.toasts.includes('A horn sounds! The war band rallies!'));
  assert.deepEqual([...w.aggro.values()], [9, 9, 9, 9, 9]);
});

test('a reset (the hero respawns in town) in the middle of a rally gives every radius back at once and the band starts over', () => {
  const w = make(); frames(w.run, 0.1); w.run.hit('c'); frames(w.run, 20);
  assert.ok([...w.aggro.values()].some((v) => v !== 9), 'rallied');
  w.run.reset();
  assert.deepEqual([...w.aggro.values()], [9, 9, 9, 9, 9], 'restored at once, not after the rally timer');
  assert.equal(w.driven.get('e'), null, 'the blower is handed back to its own wander');
  frames(w.run, 1); w.run.hit('b'); assert.equal(w.toasts.filter((t) => t === 'A goblin runs for the horn!').length, 2, 'a new alarm can sound after the reset');
});

test('disabled (a listed zone, or the row at 0): the band does nothing at all', () => {
  const w = make(false); w.run.hit('c'); frames(w.run, 30);
  assert.equal(w.driven.size, 0); assert.deepEqual([...w.aggro.values()], [9, 9, 9, 9, 9]);
});

test('a creature that is not in the band is ignored', () => {
  const w = make(); frames(w.run, 0.1); w.run.hit('wolf'); w.run.fell('wolf'); frames(w.run, 5);
  assert.deepEqual(w.toasts, []); assert.equal(w.run.inBand('wolf'), false); assert.equal(w.run.inBand('a'), true);
});
