// Head-region evidence & pins (combat lane, 2026-09-18) — answers the finishers lane's artifacts/finishers/REQUESTS.md:
// "can any shipped move land head organically?"  See artifacts/combat/HEAD-REGION.md for the full write-up and
// scripts/head-battery.mjs for the raw evidence generator.  Summary: the head REGION is not the blocker — the hero
// rigs' baked blade arcs pass chest-high through every active window (the visible animation agrees), while the cleaver
// rig's arcs ride skull-high and DO land head organically.  These tests pin that split so a future clip re-bake or
// region edit cannot silently close the only organic Split Crown path or feed the finishers table a location it never
// earned (a thrust kill must stay torso → Run Through; only heavy cleaver blows may report head → Split Crown).
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { bladeImpact, type HitLocation } from '../src/blade.ts';
import { bladePathsByRig } from '../src/blade-paths.ts';
import { createFighter, opponentFighter, stepDuel, type Duel } from '../src/duel.ts';
import { OPPONENTS, PATHS, PROFILES, WEAPONS, type PathId, type WeaponId } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

// The duel's registering rule (src/duel.ts): only the move's ACTIVE window is swept, and the first sweep sample inside
// the 0.31·k capsule decides — replicated here against a static pair so the classification is tested without AI noise.
function registeringLocation(rig: string, weapon: string, kind: string, d: number, scale = 1): HitLocation | null {
  const spec = WEAPONS[weapon as WeaponId].paths[kind as PathId];
  assert.ok(spec, `${kind} is a combat path`);
  const at = { x: 0, z: d, heading: Math.PI, distance: 0 }, df = { x: 0, z: 0, heading: 0, distance: 0 };
  for (let age = spec.windup; age < spec.windup + spec.active; age++) {
    const hit = bladeImpact(rig, weapon, kind, age - 1, age, at, at, df, df, scale);
    if (hit) return hit;
  }
  return null;
}

test('hit locations by the registering rule: only the cleaver arcs reach the head; every other weapon is torso/legs at every range', () => {
  const headPaths: string[] = [], surprises: string[] = [];
  // The pairs in play: every opponent on his own rig (held ones too) and the player's longsword on the hero rig. The shelf's hero bakes of
  // the loot weapons (blade seam, 2026-09-21) join this sweep when the player weapon flip ships and each pair is signed off by Combat.
  const inPlay = new Set([...Object.values(OPPONENTS).map(o => `${o.rig}/${o.weapon}`), 'hero/longsword']);
  for (const [rig, weapons] of Object.entries(bladePathsByRig)) for (const [weapon, kinds] of Object.entries(weapons)) {
    if (!inPlay.has(`${rig}/${weapon}`)) continue;
    for (const kind of Object.keys(kinds)) {
      if (!PATHS[kind as PathId]) continue;   // death/finisher clips are not combat paths
      for (let d = 85; d <= 190; d += 5) {
        const hit = registeringLocation(rig, weapon, kind, d / 100);
        if (!hit) continue;
        if (hit === 'head') headPaths.push(`${weapon}/${kind}`);
        if (hit === 'head' && weapon !== 'cleaver') surprises.push(`${weapon}/${kind}@${(d / 100).toFixed(2)}`);
        // A thrust or riposte must never report head: the Run Through finisher row is bound to thrust kills at torso.
        if (hit === 'head' && (kind === 'thrust' || kind === 'riposte')) surprises.push(`${weapon}/${kind}@${(d / 100).toFixed(2)} thrust-as-head`);
      }
    }
  }
  assert.deepEqual(surprises, [], 'a non-cleaver or thrust path reported head');
  for (const kind of ['heavy_overhead', 'heavy_overhead_chain', 'heavy_riposte'])
    assert.ok(headPaths.some(p => p === `cleaver/${kind}`), `cleaver/${kind} reaches head organically — the Split Crown path must stay alive`);
});

// Seeded AI-vs-AI duels (the same decide/stepDuel entry points as every other battery): the cleaver side lands head
// blows with its heavies — an organic Split Crown kill is possible today — while the longsword hero side never does.
function headBattery(weapon: 'longsword' | 'cleaver', seeds: number) {
  const tally = { head: 0, headKills: 0, kills: 0, events: 0, duels: 0 };
  for (let s = 1; s <= seeds; s++) {
    let d: Duel = {
      tick: 0,
      fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready', weapon), opponentFighter(OPPONENTS.veteran, { ...TARGET, heading: 0, distance: 0 })],
      finish: null, events: [],
    };
    let a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) {
      const x = decide(d, 0, a, PROFILES.normal), y = decide(d, 1, b, OPPONENTS.veteran.profiles.normal);
      a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]);
      for (const e of d.events) {
        if (e.actor !== 0 || !e.move) continue;
        if (e.type === 'Hit' || e.type === 'GuardBroken') { tally.events++; if (e.location === 'head') tally.head++; }
        if (e.type === 'Killed') { tally.kills++; if (e.location === 'head') tally.headKills++; }
      }
    }
    tally.duels++;
  }
  return tally;
}

test('organic head blows in seeded duels: the cleaver lands them with heavies, the longsword hero never does [slow]', () => {
  const cleaver = headBattery('cleaver', 12), longsword = headBattery('longsword', 12);
  console.log(`head battery (12 seeds each): cleaver ${JSON.stringify(cleaver)} · longsword ${JSON.stringify(longsword)}`);
  assert.equal(longsword.head, 0, `the hero's longsword reported ${longsword.head} head blows — its clips arc chest-high by design`);
  assert.ok(cleaver.head >= 4, `cleaver landed only ${cleaver.head} head blows in 12 duels — the organic Split Crown path is dying`);
  assert.ok(cleaver.kills >= 1, 'the cleaver battery produced no kills at all');
});
