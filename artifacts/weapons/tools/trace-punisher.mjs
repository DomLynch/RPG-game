// One duel, tick by tick: the whiff punisher (tests/opponents.test.ts) vs the Pitborn with the weapon given. Prints every warden attack:
// the move, the player's reply, whether it hit, and every player attack with its result.
import { createFighter, idleIntent, stepDuel, movesOf } from '../../../src/duel.ts';
import { decide, initialAi } from '../../../src/ai.ts';
import { OPPONENTS, WEAPONS } from '../../../src/moves.ts';
import { TARGET } from '../../../src/sim.ts';
const weapon = process.argv[2] || 'cleaver', seed = +(process.argv[3] || 1), opponent = { ...OPPONENTS.pitborn, weapon };
const idle = () => ({ ...idleIntent(), lock: true }), act = a => ({ ...idle(), action: a });
const gap = d => Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
const punisher = d => { const w = d.fighters[1], p = d.fighters[0]; if (p.phase !== 'ready') return idle();
  if (w.phase === 'attack' && w.age <= 4 && !w.landed && w.move !== 'kick') return act('backstep');
  if (w.phase === 'attack' && w.move && !w.landed && w.age >= movesOf(w)[w.move].windup + movesOf(w)[w.move].active && gap(d) <= 1.7) return act('light');
  if (w.exhausted && gap(d) <= 1.7) return act('heavy'); return idle(); };
const brute = createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', weapon); Object.assign(brute, { scale: opponent.scale, health: opponent.health, maxHealth: opponent.health, poise: opponent.poise });
let d = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), brute], finish: null, events: [] }, ai = initialAi((seed * 2654435761) >>> 0);
const counts = {}; const tally = k => counts[k] = (counts[k] || 0) + 1;
for (let i = 0; i < 7200 && !d.finish; i++) {
  const w = decide(d, 1, ai, opponent.profiles.normal); ai = w.ai; const p = punisher(d); d = stepDuel(d, [p, w.intent]);
  if (p.action) tally('player:' + p.action + '@gap' + gap(d).toFixed(1));
  for (const e of d.events) {
    if (e.type === 'AttackStarted') tally(`${e.actor ? 'W' : 'P'} starts ${e.move}`);
    if (['Hit', 'Blocked', 'Parried', 'AttackMissed', 'GuardBroken', 'Evaded'].includes(e.type)) tally(`${e.actor ? 'W' : 'P'} ${e.move ?? ''} → ${e.type}${e.type === 'Hit' ? ' ' + e.damage : ''}`);
  }
}
console.log(weapon, 'seed', seed, 'finish', JSON.stringify(d.finish), 'tick', d.tick, 'P health', d.fighters[0].health, 'W health', d.fighters[1].health);
for (const [k, v] of Object.entries(counts).sort()) console.log('  ', v.toString().padStart(4), k);
