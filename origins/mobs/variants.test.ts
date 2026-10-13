// Creature variants as rows (origins/mobs/variants.json): the shipped rows load against the real catalogue, a creature with no other eligible row rolls exactly as it does today, the roll is seeded
// and follows the weights, a new variant is one row, and the loader refuses a bad weight, multiplier, tint, creature or a changed `plain` row.
import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIANTS, dropName, eligibleFor, loadVariants, tilt, variantFor, type VariantTable } from './variants.ts';
import { CATALOGUE } from '../../src/fight/index.ts';

const IDS = CATALOGUE.map((r) => r.id);
const copy = (): { variants: Record<string, Record<string, unknown>> } => JSON.parse(JSON.stringify({ variants: VARIANTS }));

test('the shipped rows load against the real catalogue ids', () => {
  loadVariants(copy(), IDS);
  assert.deepEqual(Object.keys(VARIANTS), ['plain', 'scarred', 'alpha', 'ancient']);
});

test('a creature with no other eligible row rolls plain every time (a spawn is as it is today)', () => {
  const rows = eligibleFor('knight');
  assert.deepEqual(rows.map((r) => r.id), ['plain']);
  for (let i = 0; i < 200; i++) assert.equal(variantFor('knight', `s${i}`, 7).id, 'plain');
  assert.deepEqual(tilt(VARIANTS.plain!, { health: 40, damage: 6, scale: 1.4 }), { health: 40, damage: 6, scale: 1.4 }, 'the plain tilt changes nothing');
  assert.equal(dropName(VARIANTS.plain!, 'Iron Sword'), 'Iron Sword');
});

test('the roll is seeded per spawn and follows the weights (80 / 14 / 5 / 1 for a wolf)', () => {
  const draw = (seed: number) => Array.from({ length: 4000 }, (_, i) => variantFor('wolf', `z1:camp-${i}`, seed).id);
  assert.deepEqual(draw(3), draw(3), 'same seed, same spawn ids, same variants');
  assert.notDeepEqual(draw(3), draw(4));
  const n = (k: string) => draw(3).filter((x) => x === k).length;
  assert.ok(n('plain') > n('scarred') && n('scarred') > n('alpha') && n('alpha') > n('ancient') && n('ancient') > 0, `${n('plain')}/${n('scarred')}/${n('alpha')}/${n('ancient')}`);
  assert.ok(Math.abs(n('plain') / 4000 - 0.8) < 0.03, 'about 80% plain');
  assert.deepEqual(eligibleFor('boar').map((r) => r.id), ['plain', 'scarred', 'alpha'], 'eligibility is the row\'s own list');
});

test('what a variant does: the stat tilt rounds to whole points, the drop wears its prefix', () => {
  const alpha = VARIANTS.alpha!;
  assert.deepEqual(tilt(alpha, { health: 40, damage: 6, scale: 1 }), { health: 64, damage: 8, scale: 1.18 });
  assert.equal(dropName(alpha, 'Iron Sword'), 'Alpha Iron Sword');
  assert.equal(tilt({ health: 0.01, damage: 0.01, scale: 1 }, { health: 3, damage: 2, scale: 1 }).health, 1, 'never below 1');
});

test('a new variant is one row; the loader refuses the broken ones', () => {
  const ok = copy(); ok.variants.cursed = { order: 5, weight: 2, health: 1.5, damage: 1.5, scale: 1, tint: '#112233', glyph: 'skull', dropPrefix: 'Cursed', eligible: ['wolf'] };
  loadVariants(ok, IDS);
  assert.ok(eligibleFor('wolf', ok.variants as unknown as VariantTable).some((r) => r.id === 'cursed'), 'a cursed wolf is one row');
  const bad = (id: string, patch: object) => { const x = copy(); x.variants[id] = { ...x.variants[id === 'new' ? 'scarred' : id]!, ...patch }; return () => loadVariants(x, IDS); };
  assert.throws(bad('scarred', { weight: 0 }), /weight/); assert.throws(bad('scarred', { health: 5 }), /multiplier/); assert.throws(bad('scarred', { scale: -1 }), /multiplier/);
  assert.throws(bad('scarred', { tint: 'red' }), /tint/); assert.throws(bad('scarred', { eligible: ['unicorn'] }), /catalogue creature/);
  assert.throws(bad('plain', { health: 1.1 }), /plain/); assert.throws(bad('plain', { eligible: ['wolf'] }), /plain/);
  const noPlain = copy(); delete noPlain.variants.plain; assert.throws(() => loadVariants(noPlain, IDS), /plain/);
  const dup = copy(); assert.throws(() => loadVariants({ variants: [...Object.entries(dup.variants).map(([id, r]) => ({ id, ...r })), { id: 'plain', ...dup.variants.plain }] as never }, IDS), /./, 'a duplicate row is refused');
});
