// sandbox bowSpecial fairness battery (Strategy 2026-10-18: 16 seeds in the Pit, both ways, inside the existing duel fairness bands): a scripted archer with the four bow specials against the warden AI, and the scripted
// melee strategies (tests/strategies.ts, walking in to their reach) against a scripted archer bot. The multipliers in sandbox/rows.json `bowSpecial` are starting rows this battery tunes; it prints the table and gates only the
// bands: an archer hero wins at most half its fights at normal (a third at hard), like every other strategy. [slow]
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value: number }[]; bands: unknown[]; missile: unknown[]; missileLanes: unknown[]; bowSpecial?: unknown[]; specialReactFloor?: unknown[] };
const sandbox = (ROWS as unknown as { files: Record<string, Record<string, unknown[]>> }).files['sandbox-rules-defs']!;
for (const r of sandbox.rules as { id: string; value?: number }[]) { const row = d.rules.find((x) => x.id === r.id); if (row && r.value !== undefined) row.value = r.value; else if (!row && r.value !== undefined) d.rules.push({ id: r.id, value: r.value }); }
for (const k of ['bands', 'missile', 'missileLanes'] as const) (d[k] as unknown[]).push(...(sandbox[k] as unknown[]));
for (const r of d.missile as { kind?: string; weapon: string }[]) if (r.kind === 'bow') r.weapon = 'knife';   // the entry names the stand-in weapon from the link; here it is the knife
(d as unknown as { missileAnswer: unknown[] }).missileAnswer = sandbox.missileAnswer;
d.bowSpecial = sandbox.bowSpecial; d.specialReactFloor = sandbox.specialReactFloor;
const { createFighter, opponentFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const { decide, initialAi } = await import('../src/fight/ai.ts');
const { OPPONENTS, profileAt, opponentAt } = await import('../src/fight/moves.ts');
const { STRATEGIES } = await import('./strategies.ts');
type Duel = import('../src/fight/duel.ts').Duel; type Intent = import('../src/fight/duel.ts').Intent;

const SEEDS = 16, TICKS = 7200, SHARE = 0.1, GAP = 4;
const idle = (): Intent => ({ ...idleIntent(), lock: true });
const gapOf = (x: Duel) => Math.hypot(x.fighters[0].body.x - x.fighters[1].body.x, x.fighters[0].body.z - x.fighters[1].body.z);
const walk = (x: Duel, me: 0 | 1, forward: number): Intent['move'] => { const a = x.fighters[me].body, b = x.fighters[1 - me].body, facing = Math.atan2(b.x - a.x, b.z - a.z); return { x: Math.sin(facing) * forward, z: Math.cos(facing) * forward, yaw: 0, run: false }; };
// The archer: keeps 2.6-4.5 m, looses a special whenever it is cooled, otherwise a plain arrow.
const archer = (useSpecial: boolean) => (x: Duel, me: 0 | 1): Intent => {
  const f = x.fighters[me], g = gapOf(x), base = idle();
  if (g < 2.6) return { ...base, move: walk(x, me, -0.6) };
  if (g > 4.5) return { ...base, move: walk(x, me, 0.6) };
  if (f.phase !== 'ready' || f.special) return base;
  if (useSpecial && f.skillCooldown === 0 && legal(f, 'skill')) return { ...base, action: 'skill' };
  return f.ammo === 0 ? base : { ...base, action: 'thrust' };
};
// A real archer (what a good thumb does): shoots from range, rolls the warden's swing when it closes, backsteps when it is on him, walks out of reach otherwise, looses a special when cooled.
const kiter = (x: Duel, me: 0 | 1): Intent => {
  const f = x.fighters[me], w = x.fighters[1 - me], g = gapOf(x), base = idle(), swing = w.phase === 'attack' && !w.landed;
  if (f.phase === 'ready' && swing && g < 2.4 && f.stamina >= 30) return { ...base, action: 'dodge', move: walk(x, me, -1) };
  if (f.phase === 'ready' && g < 1.6 && legal(f, 'backstep')) return { ...base, action: 'backstep' };
  if (g < 2.6 && f.phase === 'ready' && !f.special) return { ...base, move: walk(x, me, -0.8) };
  if (g > 4.8) return { ...base, move: walk(x, me, 0.6) };
  if (f.phase !== 'ready' || f.special) return base;
  if (f.skillCooldown === 0 && legal(f, 'skill')) return { ...base, action: 'skill' };
  return { ...base, action: 'thrust' };
};
const start = (archerSide: 0 | 1, foeWeapon: string): Duel => {
  const bow = { ...createFighter({ x: 0, z: GAP, heading: Math.PI, distance: 0 }, 'ready', 'knife' as never), skill: 'cleave' as never, specialShare: SHARE, skillCooldown: 0 };
  const other = archerSide === 0 ? opponentFighter(opponentAt(OPPONENTS.veteran, 12), { x: 0, z: 0, heading: 0, distance: 0 }) : createFighter({ x: 0, z: GAP, heading: Math.PI, distance: 0 }, 'ready', foeWeapon as never);
  return archerSide === 0 ? { tick: 0, fighters: [bow, other], finish: null, events: [] } as never : { tick: 0, fighters: [other, { ...bow, body: { x: 0, z: 0, heading: 0, distance: 0 } }], finish: null, events: [] } as never;
};
const rotateKit = ['cleave', 'reaping', 'stomp', 'lunge'] as const;

test('an archer hero with the four specials wins at most half its fights against the warden at normal [slow]', () => {
  const rows: string[] = [];
  for (const [name, useSpecial] of [['arrows only', false], ['arrows + specials', true], ['kiter + specials', 'kite']] as const) {
    let wins = 0, losses = 0, stalls = 0, specials = 0, foeLeft = 0, ticks = 0, landed = 0, dodged = 0, blocked = 0;
    for (let s = 1; s <= SEEDS; s++) {
      let x = start(0, 'longsword'), ai = initialAi((s * 2654435761) >>> 0); const profile = profileAt(OPPONENTS.veteran, 12);
      const pick = useSpecial === 'kite' ? kiter : archer(useSpecial);
      for (let i = 0; i < TICKS && !x.finish; i++) {
        if (useSpecial && x.fighters[0].skillCooldown === 0) x = { ...x, fighters: [{ ...x.fighters[0], skill: rotateKit[(i >> 6) % 4] as never }, x.fighters[1]] } as never;
        const w = decide(x, 1, ai, profile); ai = w.ai; x = stepDuel(x, [pick(x, 0), w.intent]);
        specials += x.events.filter((e) => e.type === 'MissileLaunched' && e.actor === 0 && e.lane === 0 && x.fighters[0].bowSpecial).length;
        landed += x.events.filter((e) => e.type === 'Hit' && e.actor === 0 && (e as { missile?: boolean }).missile).length; dodged += x.events.filter((e) => e.type === 'Dodged' && e.actor === 1).length; blocked += x.events.filter((e) => e.type === 'Blocked' && e.actor === 1).length;
      }
      foeLeft += Math.round(100 * x.fighters[1].health / x.fighters[1].maxHealth); ticks += x.tick;
      if (!x.finish) stalls++; else if (x.finish.draw) losses++; else if (x.finish.victim === 1) wins++; else losses++;
    }
    rows.push(`${name}: ${wins}W ${losses}L ${stalls}S of ${SEEDS}; warden hp left avg ${Math.round(foeLeft / SEEDS)}%, fight avg ${Math.round(ticks / SEEDS)} ticks, special arrows ${specials}, arrows landed ${landed}, warden dodged ${dodged}, blocked ${blocked}`);
    assert.ok(wins / SEEDS <= 0.5, `archer ${name} wins ${wins}/${SEEDS} at normal (cap 50 %)\n  ${rows.join('\n  ')}`);
  }
  console.log(`bow hero vs warden (normal)\n  ${rows.join('\n  ')}`);
});

test('the scripted melee strategies against an archer bot: the table (bands judged on the archer side) [slow]', () => {
  const rows: string[] = []; let archerWins = 0, fights = 0;
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    let wins = 0, losses = 0, stalls = 0, shots = 0, landed = 0;
    for (let s = 1; s <= SEEDS; s++) {
      let x = start(1, 'longsword'); const bot = archer(true);
      for (let i = 0; i < TICKS && !x.finish; i++) {
        const hero = strategy(x), g = gapOf(x), move = g > 1.6 && x.fighters[0].phase === 'ready' ? walk(x, 0, 0.6) : hero.move;
        x = stepDuel(x, [{ ...hero, move }, bot(x, 1)]);
        shots += x.events.filter((e) => e.type === 'MissileLaunched' && e.actor === 1).length; landed += x.events.filter((e) => e.type === 'Hit' && e.actor === 1).length;
      }
      if (!x.finish) stalls++; else if (x.finish.draw) losses++; else if (x.finish.victim === 1) wins++; else losses++;
    }
    archerWins += losses; fights += SEEDS; rows.push(`${name}: hero ${wins}W ${losses}L ${stalls}S; archer loosed ${shots}, landed ${landed}`);
  }
  console.log(`melee strategies vs archer bot (normal)\n  ${rows.join('\n  ')}\n  archer bot won ${archerWins}/${fights}`);
  assert.ok(archerWins / fights <= 0.6, `the archer bot beat the melee strategies in ${archerWins}/${fights} fights\n  ${rows.join('\n  ')}`);
});
