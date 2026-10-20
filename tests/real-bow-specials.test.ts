// The REAL bow (weapon id 'bow', RV82) with the SHIPPED sandbox rows: each of the four picker specials is arrows from range (the bowSpecial rows), none fires inside the missile gap, and a longsword fires none.
// tests/sandbox-bow-special.test.ts proves the mechanism on a patched knife stand-in; this one proves the shipped weapon and rows (the sandbox era is switched ON for the fight, as a live fight is).
import test from 'node:test';
import assert from 'node:assert/strict';
import { forceSandbox, setSandbox } from '../src/fight/sandbox-era.ts';
import { createFighter, idleIntent, stepDuel } from '../src/fight/duel.ts';

const idle = () => ({ ...idleIntent(), lock: false });
type Ev = { type: string; damage?: number; ticks?: number };
type Duel = { fighters: { health: number; maxHealth: number; ammo?: number }[]; events: Ev[] };
const start = (weapon: string, skill: string, gap: number): Duel => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready', weapon as never), specialShare: 0.1, skillCooldown: 0, skill }, { ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready') }], finish: null } as never);
const run = (weapon: string, skill: string, gap: number) => {
  setSandbox(true); forceSandbox(false);
  let duel = stepDuel(start(weapon, skill, gap) as never, [{ ...idle(), action: 'skill' }, idle()]) as unknown as Duel; const ev: Ev[] = [...duel.events];
  for (let i = 0; i < 220; i++) { duel = stepDuel(duel as never, [idle(), idle()]) as unknown as Duel; ev.push(...duel.events); }
  return { duel, ev, launched: ev.filter((e) => e.type === 'MissileLaunched').length, hit: ev.find((e) => e.type === 'Hit') };
};

for (const [skill, label, arrows] of [['cleave', 'Power Shot', 2], ['reaping', 'Fan Volley', 3], ['stomp', 'Pinning Shot', 1], ['lunge', 'Quick Shot', 1]] as const) {
  test(`the bow's ${label} (${skill}) fires from range: a volley launches and lands a hit (${arrows} arrow(s) on the row)`, () => {
    const r = run('bow', skill, 3), me = r.duel.fighters[0]!, foe = r.duel.fighters[1]!;
    assert.ok(r.launched >= 1, 'a missile launched');
    assert.ok(r.hit && (r.hit.damage ?? 0) > 0, 'it hit for damage');
    assert.equal(foe.health, foe.maxHealth - r.hit!.damage!, 'the foe lost exactly that damage');
    assert.ok(me.ammo === undefined || me.ammo === 20 - arrows, `the quiver is unlimited (the shipped quiver rule is 0: ammo absent) or spends the row's ${arrows} arrow(s)`);
  });
  test(`the bow's ${label} stays the melee special inside the missile gap, and a longsword never fires it`, () => {
    assert.equal(run('bow', skill, 1).launched, 0, 'no arrows inside the gap');
    assert.equal(run('longsword', skill, 3).launched, 0, 'a longsword has no missile row');
  });
}

test('the Pinning Shot pins its target (a Staggered event for the row\'s ticks)', () => {
  const stagger = run('bow', 'stomp', 3).ev.find((e) => e.type === 'Staggered');
  assert.ok(stagger && (stagger.ticks ?? 0) > 0, 'the target is pinned');
});
