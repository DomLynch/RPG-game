// Crowd favour (src/arena-favour.ts): cosmetic only. The hero's style builds it, a pause settles it, a run of style makes the crowd roar once; the enemy's style counts for nothing;
// and the module reads events only (no sim file imported at runtime).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CombatEvent } from '../src/combat.ts';
import { FAVOUR, styleOf, stepFavour } from '../src/arena-favour.ts';

const ev = (e: Partial<CombatEvent> & Pick<CombatEvent, 'type' | 'actor'>): CombatEvent => ({ tick: 1, ...e });
const parry = ev({ type: 'Parried', actor: 0, target: 1 }), feint = ev({ type: 'ActionStarted', actor: 0, action: 'feint' });

test('only the hero\'s style is worth anything: the enemy parrying, feinting or killing scores nothing', () => {
  assert.ok(styleOf(parry) > 0 && styleOf(feint) > 0);
  for (const e of [ev({ type: 'Parried', actor: 1 }), ev({ type: 'ActionStarted', actor: 1, action: 'feint' }), ev({ type: 'Killed', actor: 1, target: 0 }), ev({ type: 'Hit', actor: 0 }), ev({ type: 'Blocked', actor: 0 })]) assert.equal(styleOf(e), 0);
});

test('one parry does not make the crowd roar; a run of style does, once, and the favour then drops', () => {
  let s = stepFavour(0, [parry], 0.016);
  assert.equal(s.roar, false);
  s = stepFavour(s.favour, [parry, feint], 0.016);
  assert.equal(s.roar, true);
  assert.equal(s.favour, FAVOUR.afterRoar);
  assert.equal(stepFavour(s.favour, [], 0.016).roar, false);
});

test('a pause in the style lets the crowd settle: favour decays to nothing and never goes negative', () => {
  let s = stepFavour(0, [parry], 0.016);
  for (let i = 0; i < 400; i++) s = stepFavour(s.favour, [], 0.016);
  assert.equal(s.favour, 0);
  assert.equal(s.roar, false);
});

test('a kill alone does not roar over the crowd\'s recoil, but a kill after style does', () => {
  const kill = ev({ type: 'Killed', actor: 0, target: 1 });
  assert.equal(stepFavour(0, [kill], 0.016).roar, false);
  assert.equal(stepFavour(0.5, [kill], 0.016).roar, true);
});

test('it is presentation only: favour imports no sim module at runtime (types only) and arena.ts does not feed anything back', () => {
  const src = readFileSync(new URL('../src/arena-favour.ts', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import (type )?.*from '([^']+)'/gm)];
  for (const m of imports) assert.ok(m[1], `a runtime import of ${m[2]}: only type imports allowed`);
});
