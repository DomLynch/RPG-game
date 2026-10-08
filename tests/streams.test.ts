import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { idleIntent, initialDuel, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';
import { startStreams, stepStreams } from '../src/pack.ts';

// RV39: N attackers on one creature, parallel ordinary duels sharing one health pool through Duel.incoming. The player side is driven by decide() (the same brain a warden uses), the creature copy stands idle.
const foe = OPPONENTS.veteran;
const fresh = (): Duel => initialDuel(foe, 'longsword', null);
// A player starts sheathed and any attack press draws (decide() idles against a sheathed side, as src/coach.ts notes).
const drive = (seed: number) => { let ai = initialAi(seed); return (d: Duel): Intent => { if (d.fighters[0].phase === 'sheathed') return { ...idleIntent(), action: 'light' }; const r = decide(d, 0, ai, PROFILES.hard); ai = r.ai; return r.intent; }; };

test('no incoming is today\'s fight byte for byte; incoming lands once, after the blows, through the same death door', () => {
  const a = fresh(), pick = drive(1);
  let plain: Duel = a, zero: Duel = { ...a, incoming: 0 };
  for (let t = 0; t < 200; t++) { const i = pick(plain); plain = stepDuel(plain, [i, idleIntent()]); zero = stepDuel(zero, [i, idleIntent()]); }
  assert.deepEqual(zero, plain, 'incoming 0 or absent changes nothing');
  const d0 = fresh(), max = d0.fighters[1].maxHealth, hit = stepDuel({ ...d0, incoming: 10 }, [idleIntent(), idleIntent()]);
  assert.equal(hit.fighters[1].health, max - 10); assert.deepEqual(hit.events.filter((e) => e.type === 'SharedHit').map((e) => e.damage), [10]);
  assert.equal(hit.incoming, undefined, 'the returned duel does not carry it: it lands once');
  assert.equal(stepDuel(hit, [idleIntent(), idleIntent()]).fighters[1].health, max - 10);
  const dead = stepDuel({ ...d0, incoming: max + 5 }, [idleIntent(), idleIntent()]);
  assert.equal(dead.fighters[1].health, 0); assert.equal(dead.finish?.victim, 1); assert.equal(dead.fighters[1].phase, 'dead');
  assert.ok(dead.events.some((e) => e.type === 'Killed' && e.target === 1));
});

test('a group is 2..7 streams: a lone stream or an 8th is refused', () => {
  assert.throws(() => startStreams([fresh()]), /2\.\.7/);
  assert.throws(() => startStreams(Array.from({ length: 8 }, fresh)), /2\.\.7/);
  assert.equal(startStreams([fresh(), fresh()]).duels.length, 2);
});

const run = (n: number) => {
  let g = startStreams(Array.from({ length: n }, fresh));
  const picks = Array.from({ length: n }, (_, k) => drive(k + 11)), own = new Array<number>(n).fill(0), log: { health: number[]; dealt: number[] }[] = [];
  for (let t = 0; t < 1500 && g.duels.some((d) => !d.finish); t++) {
    const before = g.duels;
    g = stepStreams(g, g.duels.map((d, i) => [picks[i]!(d), idleIntent()] as const));
    g.duels.forEach((d, i) => { if (d !== before[i]) own[i]! += d.events.filter((e) => e.tick === d.tick && e.target === 1 && e.actor === 0 && (e.type === 'Hit' || e.type === 'SpecialLanded')).reduce((s, e) => s + (e.damage ?? 0), 0); });
    log.push({ health: g.duels.map((d) => d.fighters[1].health), dealt: [...own] });
  }
  return { g, log, own };
};

test('the pool law: every copy\'s health is the bar minus its own damage minus the others\' damage up to the previous tick', () => {
  const { g, log } = run(3), max = fresh().fighters[1].maxHealth;
  assert.ok(g.duels.every((d) => d.finish), 'the creature fell in every stream');
  for (let t = 1; t < log.length; t++) for (let i = 0; i < 3; i++) {
    const others = [0, 1, 2].filter((j) => j !== i).reduce((s, j) => s + log[t - 1]!.dealt[j]!, 0);
    if (log[t]!.health[i]! > 0) assert.equal(log[t]!.health[i], Math.max(0, max - log[t]!.dealt[i]! - others), `tick ${t} stream ${i}`);
  }
});

test('the creature falls in every stream within one tick of each other, and sooner than a lone attacker could do it', () => {
  const { g } = run(3), lone = (() => { let d = fresh(); const pick = drive(11); for (let t = 0; t < 1500 && !d.finish; t++) d = stepDuel(d, [pick(d), idleIntent()]); return d; })();
  assert.ok(g.duels.every((d) => d.finish?.victim === 1));
  const ticks = g.duels.map((d) => d.tick); assert.ok(Math.max(...ticks) - Math.min(...ticks) <= 1, `fell at ${ticks.join(', ')}`);
  assert.ok(Math.max(...ticks) < lone.tick, `three attackers (${Math.max(...ticks)}) beat one (${lone.tick})`);
  assert.ok(g.duels.every((d) => d.fighters[0].health > 0), 'nobody was hurt: the creature copy stood idle');
});
