// The Pit duel's rules glue (origins/pit/pit.ts): a won duel pays the ONE career through award() as a legend event (opponent × level,
// first win only); a loss, a draw, a re-fight or a repeated settlement pays nothing; the HUD line reads the career.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LEVEL } from '../../src/career.ts';
import { LEGEND_OPPONENTS } from '../../src/legends.ts';
import { basePay, cumulative, legendKey, levelOfCredit, requirement, TYPE_WEIGHTS } from '../progression/model.ts';
import { careerLine, fightSeed, newSession, nextFight, outcomeOf, settle, started } from './pit.ts';

const POOL = [...LEGEND_OPPONENTS];
const AT = 1_790_000_000;

test('outcomeOf reads the arena finish: side 1 down is a win, a draw is never a win, no finish is no outcome', () => {
  assert.equal(outcomeOf(null), null);
  assert.equal(outcomeOf({ victim: 1 }), 'win');
  assert.equal(outcomeOf({ victim: 0 }), 'loss');
  assert.equal(outcomeOf({ victim: 1, draw: true }), 'draw');
});

test('a new session sits at the asked level with nothing beaten', () => {
  for (const level of [1, 5, 16, 46]) {
    const s = newSession(level);
    assert.equal(levelOfCredit(s.career.credit), level);
    assert.deepEqual(s.career.beaten, []);
    assert.equal(s.fights, 0);
  }
});

test('nextFight offers an unbeaten legend at the career level, with a fresh id and seed per started fight', () => {
  const s = newSession(16), f = nextFight(s, POOL, 7)!;
  assert.equal(f.level, 16);
  assert.ok(POOL.includes(f.opponent as (typeof POOL)[number]));
  assert.equal(f.legend, true);
  const g = nextFight(started(s), POOL, 7)!;
  assert.notEqual(g.id, f.id);
  assert.notEqual(g.seed, f.seed);
  assert.ok(f.seed > 0 && g.seed > 0);
  assert.equal(fightSeed(7, 1), fightSeed(7, 1), 'deterministic');
});

test('nextFight honours a picked legend from the pool and refuses one outside it', () => {
  const s = newSession(3);
  assert.equal(nextFight(s, POOL, 1, 'witch')!.opponent, 'witch');
  assert.equal(nextFight(s, POOL, 1, 'not-a-legend'), null);
  assert.equal(nextFight(s, [], 1), null);
});

test('a win pays the legend row once: first win at this level pays basePay(legend), the re-fight pays 0 (already-beaten)', () => {
  let s = started(newSession(16));
  const f = nextFight(newSession(16), POOL, 3, 'veteran')!;
  const first = settle(s, f, 'win', AT);
  assert.equal(first.award!.reason, 'ok');
  assert.equal(first.award!.cp, basePay(TYPE_WEIGHTS.legend!, 16, 16));
  assert.ok(first.award!.cp > 0);
  assert.equal(first.session.career.credit, s.career.credit + first.award!.cp);
  assert.ok(first.session.career.beaten.includes(legendKey('veteran', 16)));
  assert.equal(first.session.career.pitWins, s.career.pitWins + 1);
  s = started(first.session);
  const again = nextFight(s, POOL, 3, 'veteran')!;
  assert.equal(again.legend, false);
  const second = settle(s, again, 'win', AT + 60);
  assert.equal(second.award!.reason, 'already-beaten');
  assert.equal(second.award!.cp, 0);
  assert.equal(second.session.career.credit, first.session.career.credit);
});

test('settling the same fight id twice pays once (the server index, modelled)', () => {
  const s = newSession(2), f = nextFight(s, POOL, 9, 'goblin')!;
  const once = settle(s, f, 'win', AT);
  const twice = settle(once.session, f, 'win', AT);
  assert.equal(twice.award!.reason, 'duplicate');
  assert.equal(twice.award!.cp, 0);
  assert.equal(twice.session.career.credit, once.session.career.credit);
});

test('a loss or a draw settles nothing and leaves the session untouched', () => {
  const s = newSession(10), f = nextFight(s, POOL, 2)!;
  for (const outcome of ['loss', 'draw'] as const) {
    const r = settle(s, f, outcome, AT);
    assert.equal(r.award, null);
    assert.equal(r.session, s);
  }
});

test('the legend is keyed opponent × level: the same legend pays again after the career levels up', () => {
  let s = newSession(1);
  const wins: number[] = [];
  // At level 1 a legend pays a fifth of the level (early weight): five distinct legends lift the career to level 2.
  for (const o of POOL.slice(0, 5)) { const r = settle(started(s), nextFight(s, POOL, 0, o)!, 'win', AT); wins.push(r.award!.cp); s = r.session; }
  assert.equal(levelOfCredit(s.career.credit), 2);
  const back = settle(started(s), nextFight(s, POOL, 0, POOL[0])!, 'win', AT);
  assert.equal(back.award!.reason, 'ok', 'veteran@2 is a new legend');
  assert.ok(back.award!.cp > 0);
});

test('nextFight skips beaten legends and, when all are beaten at this level, re-offers one as a non-legend re-fight', () => {
  let s = newSession(30);
  for (const o of POOL) s = settle(started(s), nextFight(s, POOL, 0, o)!, 'win', AT).session;
  assert.equal(levelOfCredit(s.career.credit), 30, 'ten legends at Champion+ stay inside one level');
  const f = nextFight(s, POOL, 4)!;
  assert.equal(f.legend, false);
  assert.equal(settle(started(s), f, 'win', AT).award!.cp, 0);
});

test('careerLine reads the level, the CP into it and the level requirement', () => {
  const s = settle(started(newSession(16)), nextFight(newSession(16), POOL, 0, 'knight')!, 'win', AT).session;
  const line = careerLine(s.career);
  assert.equal(line.level, 16);
  assert.equal(line.into, s.career.credit - cumulative(16));
  assert.equal(line.need, requirement(16));
  assert.ok(line.fillPermille > 0 && line.fillPermille < 1000);
  assert.equal(careerLine(newSession(MAX_LEVEL).career).top, true);
});
