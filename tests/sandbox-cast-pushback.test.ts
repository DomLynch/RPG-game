// sandbox-mech: castPushback. A hit that does not cut a cast pushes its release back `castPushback` ticks, up to `castPushbackMax` times per cast (WoW pushback); 0 = trunk.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rule = (id: string) => DEFS.rules.find((r) => r.id === id) as { value: number };
const shipped = [rule('castPushback').value, rule('castPushbackMax').value];
rule('castPushback').value = 30; rule('castPushbackMax').value = 2;   // before duel.ts loads: the rows are read once
const { stepDuel, withSpecials } = await import('../src/fight/duel.ts');
const { OPPONENTS, RULES } = await import('../src/fight/moves.ts');
const { act, arena, idle } = await import('./strategies.ts');
type Duel = Parameters<typeof stepDuel>[0];

const cast = (): Duel => {   // a sturdy caster: blows push the cast back without cutting it
  const d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0; d.fighters[0].maxHealth *= 20; d.fighters[0].health = d.fighters[0].maxHealth;
  return stepDuel(d, [act('skill'), idle()]);
};
// Ticks until the caster's special lands, while the foe swings `lights` light blows (one every 45 ticks, a light's whole swing) at a caster who stands still.
const landAfter = (lights: number): number => {
  let duel = cast(); const start = duel.tick;
  for (let t = 0; t < RULES.special.windup + 200; t++) {
    duel = stepDuel(duel, [idle(), t % 45 === 0 && t / 45 < lights ? act('light') : idle()]);
    if (duel.events.some((e) => e.type === 'SpecialInterrupted')) return -1;
    if (duel.events.some((e) => e.type === 'SpecialLanded' && e.actor === 0)) return duel.tick - start;
  }
  return -2;
};

test('trunk ships castPushback at 0', () => assert.deepEqual(shipped, [0, 0]));
test('each hit that does not cut delays the release by the row, up to the max', () => {
  const base = landAfter(0), one = landAfter(1), two = landAfter(2), three = landAfter(3);
  assert.ok(base > 0 && one > 0, 'the cast lands');
  assert.equal(one, base + 30);
  assert.equal(two, base + 60);
  assert.equal(three, base + 60, 'capped at castPushbackMax');
});
