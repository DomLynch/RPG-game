import test from 'node:test';
import assert from 'node:assert/strict';
import { creature, newWorld, player, type Event, type World } from '../src/fight/world.ts';
import { ME, stepHero, quantStep } from '../src/fight/world-record.ts';

// ROLL in the open world (World, #2747): the world loop is the Pit's own sim (stepHero -> stepCombat), so a roll's invulnerable ticks must turn a creature's blow into
// a `Dodged` event, and the same blow with no roll must land as a `Hit` on the hero. Deterministic: ticks, not wall time (a browser run on a slow box cannot time this).
const GEAR = { level: 1, shielded: false };
const fresh = (): World => { const w = newWorld([player(ME, 0, 0, 0, 1, null)]); const g = creature('goblin-1', 'goblin', 0, 1.2, Math.PI, 1); return { ...w, fighters: [...w.fighters, { ...g, hunting: true }] }; };
type Run = { events: Event[]; firstWindup: number | null; hitTick: number | null };
/** Step up to 240 ticks (4 s). `rollTick` = the absolute tick at which ROLL is pressed; null = never. */
function run(rollTick: number | null, dir = { x: 0, z: -1 }, until = 240): Run {
  let w = fresh(), windupAt: number | null = null; const events: Event[] = []; let hitTick: number | null = null, first = true;
  for (let t = 0; t < until; t++) {
    const foe = w.fighters[1]!, inWindup = foe.phase === 'windup'; if (inWindup && windupAt === null) windupAt = t;
    const press = rollTick !== null && t === rollTick;
    const step = quantStep(first ? { x: 0, z: 0, facing: 0 } : null, false, null, press ? dir : null); first = false;
    const r = stepHero(w, step, GEAR); w = r.world;
    for (const e of r.events) { events.push(e); if (e.type === 'Hit' && e.victim === ME && hitTick === null) hitTick = t; }
    if (hitTick !== null || events.some((e) => e.type === 'Dodged')) break;
  }
  return { events, firstWindup: windupAt, hitTick };
}

test('with no roll, a goblin that closes in and winds up lands a Hit on the hero', () => {
  const r = run(null);
  assert.ok(r.firstWindup !== null, 'the creature winds up within 4 s');
  assert.ok(r.events.some((e) => e.type === 'Hit' && e.victim === ME), `no roll: a Hit on the hero (${JSON.stringify(r.events.map((e) => e.type))})`);
});

// Measured on trunk bac87dac8 (goblin L1 vs the L1 hero, the blow at tick 103 after a 13-tick windup): rolling TOWARD the foe, a press 4-20 ticks before the blow dodges it,
// 0-3 ticks before is too late (the blow lands); rolling AWAY, the blow finds nothing in reach. The asserted presses sit well inside those bands.
test('a ROLL pressed ahead of the blow turns it into a Dodged and no Hit on the hero; pressed on the blow tick it is too late', () => {
  const control = run(null); assert.ok(control.hitTick !== null);
  const hitOf = (r: Run) => r.events.some((e) => e.type === 'Hit' && e.victim === ME), dodgedOf = (r: Run) => r.events.some((e) => e.type === 'Dodged');
  const toward = { x: 0, z: 1 }, away = { x: 0, z: -1 }, upTo = control.hitTick! + 3;
  for (const before of [8, 10, 12, 16]) { const r = run(control.hitTick! - before, toward, upTo); assert.ok(dodgedOf(r) && !hitOf(r), `roll toward the foe ${before} ticks ahead dodges the blow`); }
  assert.ok(hitOf(run(control.hitTick!, toward, upTo)), 'a roll pressed on the blow tick is too late: the Hit lands');
  assert.ok(!hitOf(run(control.hitTick! - 10, away, upTo)), 'a roll away leaves the blow nothing in reach');
});
