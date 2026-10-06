import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clarityOf, initialPractice, stepPractice } from '../src/combat.ts';
import { cuesFor } from '../src/audio/cues.ts';
import { idleIntent, timing, type CombatEvent, type Duel } from '../src/duel.ts';

const base = (): Duel => initialPractice().duel;
const swing = (d: Duel, side: 0 | 1, age: number, landed = false): Duel => {
  const fighters = [...d.fighters] as Duel['fighters'];
  fighters[side] = { ...d.fighters[side], phase: 'attack', move: 'light_right', chained: false, age, landed };
  return { ...d, fighters };
};
const after = (d: Duel, events: CombatEvent[]): Duel => ({ ...d, tick: d.tick + 1, events });
const hit = (actor: 0 | 1): CombatEvent => ({ tick: 1, type: 'Hit', actor, target: (1 - actor) as 0 | 1, move: 'light_right', damage: 10 });

test('a swing cut in its wind-up is AttackInterrupted for the one who swung', () => {
  const before = swing(base(), 0, 2);
  assert.deepEqual(clarityOf(after(before, [hit(1)]), before).map(c => [c.type, c.actor, c.move]), [['AttackInterrupted', 0, 'light_right']]);
});

test('recovery, a landed swing and a trade are not interruptions', () => {
  const t = timing(swing(base(), 0, 0).fighters[0]);
  const late = swing(base(), 0, t.windup + t.active + 1), landed = swing(base(), 0, 2, true), trade = swing(base(), 0, 2);
  assert.deepEqual(clarityOf(after(late, [hit(1)]), late), [], 'recovery after a swing is a punish');
  assert.deepEqual(clarityOf(after(landed, [hit(1)]), landed), []);
  assert.deepEqual(clarityOf(after(trade, [hit(0), hit(1)]), trade), [], 'his blow landed too');
});

test('a whiff is its own cue (a swish, no impact); an interruption adds a voice under the hit', () => {
  const names = (events: CombatEvent[], clarity = [] as ReturnType<typeof clarityOf>) => cuesFor(events, undefined, undefined, clarity).map(c => c.name);
  assert.deepEqual(names([{ tick: 1, type: 'AttackMissed', actor: 0, move: 'light_right' }]), ['whoosh_light']);
  const before = swing(base(), 0, 2), cut = clarityOf(after(before, [hit(1)]), before);
  assert.deepEqual(names([hit(1)], cut), ['hit_flesh', 'death_voice']);
  assert.deepEqual(names([hit(1)]), ['hit_flesh'], 'no clarity event, no voice');
});

test('a press the sim drops is PressRefused with its reason; a legal press is not', () => {
  const press = { ...idleIntent(), action: 'light' as const };
  const reasons = (d: Duel) => clarityOf(after(d, []), d, press).map(c => c.reason);
  const b = base(), me = b.fighters[0];
  const ready: Duel = { ...b, fighters: [{ ...me, phase: 'ready', age: 0 }, b.fighters[1]] };
  assert.deepEqual(reasons(ready), [], 'a legal press');
  assert.deepEqual(reasons({ ...ready, fighters: [{ ...ready.fighters[0], stamina: 0, exhausted: true }, ready.fighters[1]] }), ['exhausted']);
  assert.deepEqual(reasons({ ...ready, fighters: [{ ...ready.fighters[0], phase: 'hurt', stun: 40, age: 3 }, ready.fighters[1]] }), ['hurt']);
  assert.deepEqual(reasons(swing(ready, 0, 2)), ['recovering']);
});

test('reading the derived events changes nothing: the duel is the same', () => {
  let a = initialPractice(7), b = initialPractice(7);
  for (let i = 0; i < 400; i++) {
    const intent = { ...idleIntent(), action: i % 40 === 5 ? ('light' as const) : null };
    a = stepPractice(a, intent); b = stepPractice(b, intent); void b.clarity;
  }
  assert.deepEqual(a.duel, b.duel);
  assert.ok(Array.isArray(a.clarity));
});
