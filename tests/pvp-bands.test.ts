// RV79 (Lead's ruling 2026-10-19): the reach bands apply to PvP too. In the sandbox duel.ts applied bandPerMille to every duel with no flag, PvP included, and it is symmetric for both players, so pvpDuel carries
// the same `bands` flag as the Pit and the world, keyed on the same era switch (duel.ts bandsFlag: the RV79 rows). Era OFF (trunk's rules) a PvP duel has no flag and fights as before.
import './lib/era-on.ts';   // the shipped era (era-on.ts lifts the force tests/lib/era-off.ts sets; import it FIRST)
import assert from 'node:assert/strict';
import test from 'node:test';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../src/fight/duel.ts';
import { pvpDuel } from '../src/net/rollback.ts';
import { bandFactor } from '../src/fight/bands.ts';
import { setRows79, setSandbox } from '../src/fight/sandbox-era.ts';

const light = (): Intent => ({ ...idleIntent(), action: 'light' });
// A longsword duel at a chosen gap: the first fighter's light blow against a still second fighter, placed on the z axis.
const hitDamage = (gap: number, side: Side = 0): number | undefined => {
  let d: Duel = pvpDuel({ weapon: 'longsword', skill: null }, { weapon: 'longsword', skill: null });
  const [a, b] = side === 0 ? [0, 1] as const : [1, 0] as const;
  d.fighters[a].body = { ...d.fighters[a].body, x: 0, z: 0 }; d.fighters[b].body = { ...d.fighters[b].body, x: 0, z: -gap };
  for (let t = 0; t < 120; t++) {
    const intents: [Intent, Intent] = [idleIntent(), idleIntent()]; if (t === 0) intents[side] = light();
    d = stepDuel(d, intents);
    const hit = d.events.find((e) => e.type === 'Hit' && e.actor === side); if (hit) return hit.damage;
  }
  return undefined;
};

test('era on: a PvP duel carries the bands flag, and an off-band blow lands softer for BOTH players (symmetric)', () => {
  assert.equal(pvpDuel().bands, true);
  const inBand = hitDamage(1.5), off = hitDamage(1.0);
  assert.ok(inBand !== undefined && off !== undefined, 'the scripted light blow lands at both gaps');
  assert.equal(off, Math.round(inBand! * bandFactor('longsword', 1.0)), 'off band: the row\'s factor of the in-band blow');
  assert.ok(off! < inBand!, 'softer off band');
  assert.equal(hitDamage(1.0, 1), off, 'the second player is scaled by the same rule');
  assert.equal(hitDamage(1.5, 1), inBand);
});

test('era off: a PvP duel has no bands flag and the gap changes nothing, as before RV79', () => {
  setSandbox(false); setRows79(false);
  try {
    assert.equal(pvpDuel().bands, undefined);
    assert.equal(hitDamage(1.0), hitDamage(1.5));
  } finally { setSandbox(true); setRows79(true); }
});
