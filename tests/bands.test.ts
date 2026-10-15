// Positioning bands (spec docs/specs/combat/positioning-gates.md): the rows, the pure band functions, the damage factor behind duel.bands and the AI's holdBand. Default off: no `bands`, no change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, BEST_BAND, OFF_BAND, bandAt, bandFactor, bestRange, spanOf } from '../src/fight/bands.ts';
import { TACTIC_ROWS } from '../src/fight/tactic-rows.ts';
import { WEAPONS } from '../src/fight/moves.ts';
import { stepDuel, type Duel } from '../src/fight/duel.ts';
import { act, arena, idle } from './strategies.ts';

test('the band rows: three rings inside out, every banded weapon is a weapon row with a known best band, an off-band blow is never stronger', () => {
  assert.deepEqual([...BANDS], ['inner', 'mid', 'outer']);
  for (const [w, b] of Object.entries(BEST_BAND)) { assert.ok(Object.hasOwn(WEAPONS, w), w); assert.ok(BANDS.includes(b), `${w} ${b}`); }
  assert.ok(OFF_BAND > 0 && OFF_BAND <= 1);
  assert.deepEqual(Object.fromEntries(['knife', 'gladius', 'longsword', 'cleaver', 'maul', 'trident', 'scythe', 'estoc'].map((w) => [w, BEST_BAND[w]])), { knife: 'inner', gladius: 'inner', longsword: 'mid', cleaver: 'mid', maul: 'mid', trident: 'outer', scythe: 'outer', estoc: 'outer' }, "Strategy's starting assignment");
});

test('edges come from the weapon\'s own reach and minReach: the span starts at the pole\'s minimum reach, ends at its longest own blow, and every weapon\'s best range sits inside it', () => {
  const [tLo, tHi] = spanOf('trident'), [sLo] = spanOf('scythe');
  assert.equal(tLo, 1, 'the trident\'s minReach 1.0 is above the contact gap'); assert.equal(tHi, 2.25);
  assert.equal(sLo, 1.4, 'the scythe\'s minReach');
  for (const w of Object.keys(BEST_BAND) as (keyof typeof BEST_BAND)[]) {
    const [lo, hi] = spanOf(w as never), r = bestRange(w as never)!;
    assert.ok(lo <= r[0] && r[0] < r[1] && r[1] <= hi, `${w} best range ${r} inside ${lo}-${hi}`);
    assert.equal(bandAt(w as never, (r[0] + r[1]) / 2), BEST_BAND[w], `${w}: the middle of its best range is its best band`);
  }
});

test('the factor: 1 in the best band, offBandMult elsewhere, and a weapon with no band row is never scaled', () => {
  const r = bestRange('longsword')!, inside = (r[0] + r[1]) / 2;
  assert.equal(bandFactor('longsword', inside), 1);
  assert.equal(bandFactor('longsword', 0.9), OFF_BAND); assert.equal(bandFactor('longsword', 2.2), OFF_BAND);
  assert.equal(bandFactor('warhammer', 0.9), 1, 'no band row: no factor'); assert.equal(bandFactor('bite' as never, 1.2), 1);
});

// A longsword duel at a chosen gap: the hero's light blow against a still warden, both fighters placed on the z axis.
const hitDamage = (gap: number, bands: boolean): number | undefined => {
  let d: Duel = { ...arena(undefined, 'longsword'), ...(bands ? { bands: true } : {}) };
  d.fighters[0].body = { ...d.fighters[0].body, x: 0, z: 0 }; d.fighters[1].body = { ...d.fighters[1].body, x: 0, z: -gap };
  for (let t = 0; t < 120; t++) { d = stepDuel(d, [t === 0 ? act('light') : idle(), idle()]); const hit = d.events.find((e) => e.type === 'Hit' && e.actor === 0); if (hit) return hit.damage; }
  return undefined;
};

test('behind duel.bands a clean blow started off-band lands softer; without the flag, or in band, the damage is exactly today\'s', () => {
  const plainIn = hitDamage(1.45, false), plainOff = hitDamage(1.0, false);
  assert.ok(plainIn !== undefined && plainOff !== undefined, 'the scripted light blow lands at both gaps');
  assert.equal(plainIn, plainOff, 'without the flag the gap changes nothing (a longsword light blow lands the same at 1.0 and 1.45 m)');
  assert.equal(hitDamage(1.45, true), plainIn, 'in band (1.24-1.62 m): identical to the flag-off blow');
  assert.equal(hitDamage(1.0, true), Math.round(plainOff! * OFF_BAND), 'off band (inside the best range): offBandMult of the flag-off blow');
  assert.equal(hitDamage(1.9, true), undefined, 'out of reach stays a miss, never softened into a hit');
});

test('the holdBand row exists, names only holdBand, and no shipped profile names it (so nothing in the game moves)', async () => {
  assert.equal(TACTIC_ROWS.bands?.holdBand, true);
  const { PROFILES } = await import('../src/fight/moves.ts');
  for (const [name, p] of Object.entries(PROFILES)) assert.notEqual((p as { tactic?: string }).tactic, 'bands', name);
});

test('holdBand: with bands on and the row named, a longsword warden steps out from inside its best band and in from outside it; without the flag or the row it does not follow the band', async () => {
  const { initialAi } = await import('../src/fight/ai.ts');
  const { decideBanded: decide } = await import('../src/fight/band-ai.ts');
  const { PROFILES, OPPONENTS } = await import('../src/fight/moves.ts');
  const r = bestRange('longsword')!;
  const along = (gap: number, bands: boolean, tactic?: string): number => {
    const d: Duel = { ...arena(OPPONENTS.veteran, 'longsword'), ...(bands ? { bands: true } : {}) };
    d.fighters[0].body = { ...d.fighters[0].body, x: 0, z: 0 }; d.fighters[1].body = { ...d.fighters[1].body, x: 0, z: -gap };
    d.fighters[1] = { ...d.fighters[1], weapon: 'longsword' };
    const profile = { ...PROFILES.normal, ...(tactic ? { tactic } : {}) }, out = decide(d, 1, { ...initialAi(7), mode: 'approach' }, profile);
    const m = out.intent.move; const dx = d.fighters[0].body.x - d.fighters[1].body.x, dz = d.fighters[0].body.z - d.fighters[1].body.z, n = Math.hypot(dx, dz);
    return (m.x * dx + m.z * dz) / n;   // + toward the hero, - away
  };
  assert.ok(along(r[1] + 0.3, true, 'bands') > 0, 'outside the band: steps in');
  assert.ok(along(r[0] - 0.2, true, 'bands') < 0, 'inside the band: steps back');
  assert.equal(along((r[0] + r[1]) / 2, true, 'bands'), 0, 'in band: holds');
});
