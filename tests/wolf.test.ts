// The Ash Wolf (Combat, 2026-10-07; mob beasts proposal): a held opponent on its own quadruped rig, the Goblin's hit-and-run with a bite. The sim half: the row, the weapon, the bake, the
// reach, the clips the role map names, the flee layer, and a fairness fingerprint against the Goblin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, initialAi } from '../src/ai.ts';
import { bladePathsByRig } from '../src/blade-paths.ts';
import { WEAPON_CLIPS } from '../src/characters.ts';
import { createFighter, idleIntent, opponentFighter, stepDuel, type Duel } from '../src/duel.ts';
import { OPPONENTS, PROFILES, WEAPONS, opponentAt, type AiProfile, type Opponent } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { TARGET } from '../src/sim.ts';
import { noTwist, stepTwist } from '../src/twist.ts';

const wolf = OPPONENTS.wolf;

test('the wolf is a held roster row on its own rig with the bite, and a profile at every ladder level', () => {
  assert.deepEqual([ROSTER.wolf.rig, ROSTER.wolf.weapon, ROSTER.wolf.archetype], ['wolf', 'bite', 'wolf']);
  assert.equal(ROSTER.wolf.hold, true, 'held: off the ladder and out of the beta bundle');
  for (const level of [1, 6, 18, 46, 50]) {
    const p = opponentAt(wolf, level).profiles.normal;
    assert.ok(p.reaction > 0 && p.guard === 0 && p.kick === 0 && p.parry === 0, `L${level}: never guards, parries or kicks`);
  }
  assert.ok(wolf.speed > 1.2 && wolf.health < OPPONENTS.goblin.health && wolf.poise === 0, 'the fastest, frailest body');
});

test('every strike names the one Bite clip, and the role map reaches clips the GLB really has', () => {
  for (const spec of Object.values(WEAPONS.bite.paths)) assert.equal(spec.clip, 'Bite');
  const bytes = readFileSync(new URL('../src/assets/wolf.glb', import.meta.url)), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { animations: { name: string }[] };
  const names = new Set(json.animations.map(a => a.name));
  for (const clip of Object.values(WEAPON_CLIPS.bite)) assert.ok(names.has(clip!), `the role map names ${clip}, the GLB has ${[...names]}`);
});

test('the bite is baked on the wolf rig for every path, and the jaw sweep is the one the manifest scale says', () => {
  const table = bladePathsByRig.wolf?.bite;
  assert.ok(table);
  assert.deepEqual(Object.keys(table).sort(), Object.keys(WEAPONS.bite.paths).sort());
  let reach = 0; for (const pose of table.thrust) reach = Math.max(reach, pose[5]);
  assert.ok(reach > 0.65 && reach < 0.85, `the jaw tip's forward reach ${reach.toFixed(2)} m (0.55 m native x the 1.3 bake scale)`);
});

// How far from the wolf a bite lands on a standing man (scripts/wolf-reach-probe.mjs): near the Goblin's knife (1.26 / 1.54 / 1.66), the thing the AI's reach estimates are tuned to.
const lands = (action: 'light' | 'thrust' | 'heavy', o: Opponent): number => {
  let far = 0;
  for (let gap = 0.3; gap <= 2.4; gap += 0.02) {
    let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { x: TARGET.x, z: TARGET.z, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
    for (let t = 0; t < 90; t++) { d = stepDuel(d, [idleIntent(), { ...idleIntent(), action: t === 0 ? action : null }]); if (d.events.some(e => e.type === 'Hit' && e.actor === 1)) { far = gap; break; } }
  }
  return far;
};
test('a bite lands from the Goblin\'s distances, within a hand: the lunge farthest, the bite nearest', () => {
  const [l, t, h] = (['light', 'thrust', 'heavy'] as const).map(a => lands(a, wolf)), g = (['light', 'thrust', 'heavy'] as const).map(a => lands(a, OPPONENTS.goblin));
  assert.ok(l > 0 && l < t && t < h, `light ${l.toFixed(2)} < lunge ${t.toFixed(2)} < maul ${h.toFixed(2)}`);
  for (const [w, k] of [[l, g[0]], [t, g[1]], [h, g[2]]]) assert.ok(Math.abs(w - k) < 0.15, `wolf ${w.toFixed(2)} m against the Goblin's ${k.toFixed(2)} m`);
});

test('the wolf flees through the existing twist layer: flee-at 30 fires once he is under 30% of his bar, not at 30%', () => {
  const at = (hp: number): Duel => { const f = opponentFighter(wolf, { x: 0, z: 0, heading: 0, distance: 0 }, 'ready'); return { tick: 5, fighters: [createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready'), { ...f, health: hp }], finish: null, events: [] }; };
  const flag = [{ kind: 'flee-at', percent: 30 } as const];
  assert.equal(stepTwist(at(wolf.health * 0.31), flag, noTwist()).twist.outcome, null);
  assert.equal(stepTwist(at(wolf.health * 0.29), flag, noTwist()).twist.outcome, 'fled');
});

// Fairness: the hero's brain against the wolf and against the Goblin (same hit-and-run family), 24 seeded fights each. The wolf is meant to be the Goblin's kin, a notch frailer.
function wins(o: Opponent, hero: AiProfile, level: 'easy' | 'normal', seeds = 24): number {
  let n = 0;
  for (let s = 1; s <= seeds; s++) {
    let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.6, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] };
    let a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 9000 && !d.finish; i++) { const x = decide(d, 0, a, hero), y = decide(d, 1, b, o.profiles[level]); a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`);
    if (d.finish.victim === 1 && !d.finish.draw) n++;
  }
  return n;
}
test('against the hero\'s brain the wolf is neither a pushover nor a wall (the Goblin\'s band)', () => {
  const rows = { easy: [wins(wolf, PROFILES.easy, 'easy'), wins(OPPONENTS.goblin, PROFILES.easy, 'easy')], normal: [wins(wolf, PROFILES.normal, 'normal'), wins(OPPONENTS.goblin, PROFILES.normal, 'normal')] };
  console.log(`wolf vs goblin wins of 24 (the warden's side): hero easy brain ${rows.easy}, hero normal brain ${rows.normal}`);
  for (const [w] of [rows.easy, rows.normal]) assert.ok(w >= 2 && w <= 20, `the wolf won ${w}/24`);
});
