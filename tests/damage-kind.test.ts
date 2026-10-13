// Damage kinds as data (Wave A1 PR2, RV49): a move row may name a kind; slash drains the target's stamina, crush adds posture, pierce ignores a share of the armour dial; a move with no kind is the plain blow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFighter, idleIntent, stepDuel, withSheet, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { GRIPS, GUARDS, MATERIALS, MOVES, PATHS, RULES } from '../src/fight/moves.ts';
import { loadWeaponDefs } from '../src/fight/weapons.ts';
import { DAMAGE_KINDS, DAMAGE_KIND_IDS, kindOf } from '../src/fight/damage-kinds.ts';
import { TARGET } from '../src/fight/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action): Intent => ({ ...idle(), action });
const duel = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
const run = (d: Duel, n: number, a: Intent = idle(), b: Intent = idle()): Duel => { for (let i = 0; i < n; i++) d = stepDuel(d, [a, b]); return d; };
const light = MOVES.light_right;
// One clean light cut from fighter 0 on fighter 1, the move optionally carrying a kind (the shipped rows name none, so the test sets it on the shared row and always restores it).
const land = (kind: string | undefined, target?: Record<string, number>, stamina?: number): Duel => {
  const move = light as { damageKind?: string };
  if (kind) move.damageKind = kind;
  try { const d = withSheet(duel(), [undefined, target]); if (stamina !== undefined) d.fighters[1].stamina = stamina; return run(d, light.windup + 1, act('light')); } finally { delete move.damageKind; }
};

test('the kind rows: slash drains, crush adds posture, pierce penetrates, each neutral on the other two channels; a new kind is a row', () => {
  assert.deepEqual(DAMAGE_KIND_IDS, ['slash', 'crush', 'pierce']);
  assert.deepEqual([DAMAGE_KINDS.slash!.drain > 0, DAMAGE_KINDS.slash!.posture, DAMAGE_KINDS.slash!.penetration], [true, 1, 0]);
  assert.deepEqual([DAMAGE_KINDS.crush!.drain, DAMAGE_KINDS.crush!.posture > 1, DAMAGE_KINDS.crush!.penetration], [0, true, 0]);
  assert.deepEqual([DAMAGE_KINDS.pierce!.drain, DAMAGE_KINDS.pierce!.posture, DAMAGE_KINDS.pierce!.penetration > 0], [0, 1, true]);
  assert.equal(kindOf(undefined), undefined); assert.equal(kindOf('slash'), DAMAGE_KINDS.slash);
});

test('no shipped move names a kind, so the plain blow is untouched', () => {
  for (const [id, m] of Object.entries(MOVES)) assert.equal(m.damageKind, undefined, id);
  const plain = land(undefined);
  assert.equal(RULES.health - plain.fighters[1].health, light.damage);
});

test('slash: a clean hit also drains the target\'s stamina by the kind\'s share of the damage dealt', () => {
  const plain = land(undefined, undefined, 60), slashed = land('slash', undefined, 60);   // below the wound's attrition cap on the bar, so the cap does not hide the drain
  const dealt = RULES.health - slashed.fighters[1].health;
  assert.equal(dealt, light.damage, 'the health loss is the same');
  assert.equal(plain.fighters[1].stamina - slashed.fighters[1].stamina, Math.round(dealt * DAMAGE_KINDS.slash!.drain));
});

test('crush: the posture the blow puts on the target is multiplied; the health loss is not', () => {
  const plain = land(undefined), crushed = land('crush');
  assert.equal(RULES.health - crushed.fighters[1].health, RULES.health - plain.fighters[1].health);
  assert.ok(crushed.fighters[1].posture > plain.fighters[1].posture, `${crushed.fighters[1].posture} > ${plain.fighters[1].posture}`);
});

test('pierce: a share of the target\'s armour dial is ignored (armour 100 takes half; with half ignored it takes a third less than that)', () => {
  const taken = (kind?: string) => RULES.health - land(kind, { armour: 100 }).fighters[1].health;
  assert.equal(taken(), Math.round(light.damage / 2));
  assert.equal(taken('pierce'), Math.round(light.damage * 100 / 150), 'armour 100 * (1 - .5) = 50: the blow is scaled by 100 / (100 + 50)');
  assert.ok(taken('pierce') > taken());
  assert.equal(RULES.health - land('pierce').fighters[1].health, light.damage, 'a target with no armour dial is untouched');
});

test('the loader refuses a move that names a kind no row holds, and takes one that does', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/fight/weapon-defs.json', import.meta.url), 'utf8')) as { weapons: Record<string, unknown>[] };
  const load = (kind: string) => () => loadWeaponDefs({ weapons: [...raw.weapons, { id: 'club', extends: 'cleaver', material: 'wood', reach: 1.6, moves: { heavy_overhead: { damageKind: kind } } }] }, { moves: MOVES, paths: PATHS }, { materials: MATERIALS, guards: GUARDS, grips: GRIPS, kinds: DAMAGE_KIND_IDS });
  assert.throws(load('void'), /damageKind "void" is not one of slash, crush, pierce/);
  assert.equal(load('crush')().weapons.club!.moves.heavy_overhead.damageKind, 'crush');
});
