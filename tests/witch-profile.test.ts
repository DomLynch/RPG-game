// The Witch fights differently from the Centurion at Easy (Dom, 2026-09-24). They carry the same trident, so the difference is her
// profile alone: 24 seeded AI-vs-AI fights each, the hero's brain against each warden's Easy, counting the warden's own actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { createFighter, opponentFighter, stepDuel, type Duel } from '../src/duel.ts';
import { OPPONENTS, PROFILES, type AiProfile, type Opponent } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const W = OPPONENTS.witch, C = OPPONENTS.veteran;   // the Centurion's ids stay `veteran` (docs/SCOPE.md)
const ring = (o: Opponent): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.6, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] });
function fingerprint(o: Opponent, hero: AiProfile, seeds = 24) {
  const n = { light: 0, heavy: 0, thrust: 0, backstep: 0, guard: 0 }; let wins = 0;
  for (let s = 1; s <= seeds; s++) {
    let d = ring(o), a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 9000 && !d.finish; i++) {
      const x = decide(d, 0, a, hero), y = decide(d, 1, b, o.profiles.easy); a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]);
      for (const e of d.events) {
        if (e.actor !== 1) continue;
        const k = e.type === 'AttackStarted' ? e.move : e.type === 'ActionStarted' ? e.action : null;
        if (k === 'light_right' || k === 'light_left') n.light++; else if (k === 'heavy_overhead') n.heavy++; else if (k === 'thrust' || k === 'backstep' || k === 'guard') n[k]++;
      }
    }
    assert.ok(d.finish, `seed ${s} did not finish`);
    if (d.finish.victim === 1 && !d.finish.draw) wins++;
  }
  return { wins, ...n };
}

test('the Witch has her own Easy profile, not the Centurion\'s', () => {
  assert.notDeepEqual(W.profiles.easy, C.profiles.easy);
  assert.equal(W.weapon, C.weapon, 'same trident: the difference must come from the profile');
});

test('the Witch\'s Easy fingerprint differs from the Centurion\'s (lights and backsteps, not heavies) at the same difficulty', () => {
  const easyW = fingerprint(W, PROFILES.easy), easyC = fingerprint(C, PROFILES.easy);
  const normW = fingerprint(W, PROFILES.normal), normC = fingerprint(C, PROFILES.normal);
  console.log(`Easy fingerprint (hero easy brain), witch ${JSON.stringify(easyW)} centurion ${JSON.stringify(easyC)}\n  hero normal brain: witch ${JSON.stringify(normW)} centurion ${JSON.stringify(normC)}`);
  for (const [w, c] of [[easyW, easyC], [normW, normC]]) {
    assert.ok(w.light > 2 * c.light, `she sweeps lights: ${w.light} vs his ${c.light}`);
    assert.ok(w.heavy < c.heavy, `he is the heavy hitter: her ${w.heavy} vs ${c.heavy}`);
    assert.ok(w.backstep > 10 && c.backstep <= 2, `she steps back out, he stands: ${w.backstep} vs ${c.backstep}`);
  }
  // Easy stays easy: she is no harder to beat than he is, within two fights in 24, for either hero brain.
  assert.ok(easyW.wins >= easyC.wins - 2 && normW.wins >= normC.wins - 2, `hero wins vs witch ${easyW.wins}/${normW.wins}, vs centurion ${easyC.wins}/${normC.wins}`);
});
