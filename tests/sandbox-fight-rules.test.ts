// sandbox-mech, integration: the rows act in a stepped duel, not only in their helpers. A longsword light cut on the plate Veteran vs the robed Witch (armour vs blow type), and the same cut from inside / outside the
// sword's band (reach bands). Same attacker, same gap, same swing; only the rule rows differ, so the damage ratio is the rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value?: number }[]; bands: unknown[]; bandBest: unknown[]; blowKinds: unknown[]; armourVs: unknown[] };
d.rules.find((r) => r.id === 'bandOff')!.value = 400;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.bandBest.push({ weapon: 'longsword', band: 'mid' });
d.blowKinds.push({ weapon: '*', move: '*', kind: 'slash' });
d.armourVs.push({ kind: 'slash', armour: 'heavy', value: 600 }, { kind: 'slash', armour: 'light', value: 1300 });
const { createFighter, opponentFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { OPPONENTS } = await import('../src/fight/moves.ts');

const idle = () => ({ ...idleIntent(), lock: false });
function firstHit(opponent: keyof typeof OPPONENTS, gap: number) {
  const foe = opponentFighter(OPPONENTS[opponent], { x: 0, z: 0, heading: 0, distance: 0 }, 'ready');
  let duel = { tick: 0, fighters: [createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready', 'longsword'), foe], finish: null, events: [] } as never;
  for (let i = 0; i < 80; i++) {
    duel = stepDuel(duel, [{ ...idle(), action: i === 0 ? 'light' : null }, idle()]);
    const hit = (duel as { events: { type: string; actor: number; damage?: number; glance?: boolean }[] }).events.find((e) => e.type === 'Hit' && e.actor === 0);
    if (hit) return hit;
  }
  return undefined;
}

test('plate takes a cut at 600 per mille, robes at 1300: the same swing hurts the Witch more than the Veteran', () => {
  const vet = firstHit('veteran', 1.4), witch = firstHit('witch', 1.4);
  assert.ok(vet && witch, 'both swings land');
  assert.ok(witch.damage! > vet.damage!, `witch ${witch.damage} > veteran ${vet.damage}`);
  assert.ok(Math.abs(witch.damage! / vet.damage! - 1300 / 600) < 0.35, `ratio ${witch.damage! / vet.damage!} near 2.17`);
});

test('a swing from inside the sword\'s band is a clean hit; from the inner band it is a glance at 400 per mille', () => {
  const inBand = firstHit('witch', 1.5), inner = firstHit('witch', 1.2);
  assert.ok(inBand && inner);
  assert.equal(inBand.glance, undefined);
  assert.equal(inner.glance, true);
  assert.ok(inner.damage! < inBand.damage! * 0.6, `inner ${inner.damage} well under in-band ${inBand.damage}`);
});
