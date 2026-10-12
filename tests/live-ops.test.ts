import test from 'node:test';
import assert from 'node:assert/strict';
import { activeEvents, cronMatches, eventActive, loadLiveOps, parseCron, switchOn, EMPTY_LIVE_OPS, type Cron, type LiveEvent } from '../src/core/live-ops.ts';

const at = (iso: string) => Date.parse(iso);
const cron = (t: string): Cron => { const c = parseCron(t); assert.ok(typeof c !== 'string', String(c)); return c as Cron; };
const ev = (o: Partial<LiveEvent> = {}): LiveEvent => ({ id: 'e', cron: '0 18 * * 5', lengthMin: 120, kind: 'double-xp', params: {}, enabled: true, ...o });

test('cron fields: star, number, range, step, list; Sunday is 0 and 7', () => {
  const c = cron('*/15 9-17 * * 1-5');
  assert.equal(cronMatches(c, at('2026-10-12T09:30:00Z')), true, 'Monday 09:30');
  assert.equal(cronMatches(c, at('2026-10-12T09:31:00Z')), false);
  assert.equal(cronMatches(c, at('2026-10-12T18:00:00Z')), false, 'after hours');
  assert.equal(cronMatches(c, at('2026-10-11T10:00:00Z')), false, 'Sunday');
  assert.equal(cronMatches(cron('0 0 * * 7'), at('2026-10-11T00:00:00Z')), true, '7 is Sunday');
  assert.equal(cronMatches(cron('0 0 * * 0'), at('2026-10-11T00:00:00Z')), true);
  assert.deepEqual([20, 21, 22, 5, 11].map(m => cronMatches(cron('5,10,20-22/2 0 1 1 *'), at(`2027-01-01T00:${String(m).padStart(2, '0')}:00Z`))), [true, false, true, true, false], 'a list with a stepped range: 5, 10, 20, 22');
});

test('cron: day-of-month and day-of-week both restricted means either, like cron', () => {
  const c = cron('0 0 13 * 5');
  assert.equal(cronMatches(c, at('2026-10-13T00:00:00Z')), true, 'the 13th (a Tuesday)');
  assert.equal(cronMatches(c, at('2026-10-16T00:00:00Z')), true, 'a Friday that is not the 13th');
  assert.equal(cronMatches(c, at('2026-10-14T00:00:00Z')), false);
});

test('cron refusals say which field', () => {
  for (const [text, field] of [['* * * *', 'five fields'], ['60 * * * *', 'minute'], ['* 24 * * *', 'hour'], ['* * 0 * *', 'day-of-month'], ['* * * 13 *', 'month'], ['* * * * 8', 'day-of-week'], ['*/0 * * * *', 'step'], ['x * * * *', 'minute'], ['5-1 * * * *', 'minute']] as const)
    assert.match(String(parseCron(text)), new RegExp(field), text);
});

test('an event is active for lengthMin minutes from each matching minute, UTC', () => {
  const e = ev();   // Fridays 18:00 for two hours
  assert.equal(eventActive(e, at('2026-10-16T17:59:59Z')), false);
  assert.equal(eventActive(e, at('2026-10-16T18:00:00Z')), true);
  assert.equal(eventActive(e, at('2026-10-16T19:59:59Z')), true);
  assert.equal(eventActive(e, at('2026-10-16T20:00:00Z')), false);
  assert.equal(eventActive(ev({ lengthMin: 60 * 24 * 7 }), at('2026-10-14T00:00:00Z')), true, 'a week-long event reaches back to last Friday');
  assert.equal(eventActive(ev({ enabled: false }), at('2026-10-16T18:30:00Z')), false, 'disabled never runs');
  assert.equal(eventActive(ev({ cron: 'garbage' }), at('2026-10-16T18:30:00Z')), false);
});

test('the loader keeps good rows and drops only the bad ones, reporting each', () => {
  const { ops, rejected } = loadLiveOps({
    events: [
      { id: 'friday', cron: '0 18 * * 5', lengthMin: 120, kind: 'double-xp', enabled: true, params: { mult: 2 } },
      { id: 'bad-cron', cron: '61 * * * *', lengthMin: 5, kind: 'k', enabled: true },
      { id: 'too-long', cron: '0 0 * * *', lengthMin: 99999, kind: 'k', enabled: true },
      { id: 'no-kind', cron: '0 0 * * *', lengthMin: 5, enabled: true },
      { id: 'float', cron: '0 0 * * *', lengthMin: 1.5, kind: 'k', enabled: true },
    ],
    switches: [{ key: 'op:encounter_start', enabled: false }, { key: 'spawns', enabled: 'no' }, { key: 'rewards', enabled: true }],
  });
  assert.deepEqual(ops.events.map(e => e.id), ['friday']);
  assert.deepEqual(ops.events[0]!.params, { mult: 2 });
  assert.deepEqual(rejected.map(r => `${r.table}:${r.id}`).sort(), ['live-events:bad-cron', 'live-events:float', 'live-events:no-kind', 'live-events:too-long', 'switches:spawns']);
  assert.equal(switchOn(ops, 'op:encounter_start'), false);
  assert.equal(switchOn(ops, 'rewards'), true);
  assert.equal(switchOn(ops, 'no-row-at-all'), true, 'no row means on');
  assert.equal(switchOn(ops, 'spawns'), true, 'a refused row changes nothing: the switch stays on');
  assert.deepEqual(activeEvents(ops, at('2026-10-16T18:30:00Z')).map(e => e.id), ['friday']);
});

test('nonsense in, defaults out', () => {
  for (const raw of [null, undefined, 7, 'x', [], {}, { events: 3, switches: {} }]) {
    const { ops } = loadLiveOps(raw);
    assert.deepEqual([ops.events.length, ops.switches.size], [0, 0]);
  }
  assert.equal(switchOn(EMPTY_LIVE_OPS, 'anything'), true);
});
