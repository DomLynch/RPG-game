// The weapon slot: a fighter carries a weapon, and every move / path / reach lookup goes through it. No balance change: on trunk
// both fighters carry the longsword and the trident entry borrows its data until the weapons lane lands the real one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bladePaths } from '../src/blade-paths.ts';
import { createFighter, idleIntent, initialDuel, legal, movesOf, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { LONGSWORD, MOVES, PATHS, WEAPONS, weaponOf, type Weapon } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Intent['action']): Intent => ({ ...idle(), action });
const duel = (gap: number, weapon: 'longsword' | 'trident' = 'longsword'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready', weapon), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
// Steps n ticks and returns the final duel with every tick's events gathered (stepDuel only carries the current tick's).
const run = (d: Duel, n: number, a = idle(), b = idle()) => { const events: Duel['events'] = []; for (let i = 0; i < n; i++) { d = stepDuel(d, [a, b]); events.push(...d.events); } return { ...d, events }; };

test('on trunk nothing changes: both fighters carry the longsword, the trident entry is the longsword\'s data marked as a placeholder, and lookups resolve to the same tables', () => {
  const d = initialDuel();
  assert.deepEqual(d.fighters.map(f => f.weapon), ['longsword', 'longsword']);
  assert.equal(weaponOf('longsword').moves, MOVES); assert.equal(weaponOf('longsword').paths, PATHS); assert.equal(LONGSWORD.reach, MOVES.thrust.reach);
  assert.equal(WEAPONS.trident.placeholder, true); assert.equal(WEAPONS.trident.moves, MOVES, 'borrowed, not copied'); assert.deepEqual(bladePaths.trident, bladePaths.longsword, 'the baked table is the longsword\'s');
  assert.equal(movesOf(d.fighters[0]), MOVES);
  assert.deepEqual([LONGSWORD.guard, LONGSWORD.material], ['blade', 'iron']);
});

test('a second weapon with a longer reach resolves contact from its own table: the trident lands a thrust from where the longsword whiffs, costs its own stamina, and the AI-facing reach follows it', () => {
  // A synthetic trident for the test only: the longsword's moves and paths, with the thrust's reach and cost changed, and its blade paths
  // stretched 0.5 m forward along the thrust so the baked contact really is longer (the sim sweeps the table, not the number).
  const trident: Weapon = { id: 'trident', guard: 'shaft', material: 'bronze', reach: 2.5, moves: { ...MOVES, thrust: { ...MOVES.thrust, reach: 2.5, stamina: 30 } }, paths: PATHS };
  const stretched = Object.fromEntries(Object.entries(bladePaths.longsword).map(([k, frames]) => [k, k === 'thrust' ? frames.map(f => [f[0], f[1], f[2] + .5, f[3], f[4], f[5] + .5]) : frames]));
  const before = { weapon: WEAPONS.trident, paths: bladePaths.trident };
  WEAPONS.trident = trident; bladePaths.trident = stretched;
  try {
    const far = 2.35;   // beyond the longsword thrust's baked reach, inside the stretched trident's
    const sword = run(stepDuel(duel(far, 'longsword'), [act('thrust'), idle()]), MOVES.thrust.windup + MOVES.thrust.active);
    const tri = run(stepDuel(duel(far, 'trident'), [act('thrust'), idle()]), MOVES.thrust.windup + MOVES.thrust.active);
    assert.ok(!sword.events.some(e => e.type === 'Hit') && sword.events.some(e => e.type === 'AttackMissed'), 'the longsword whiffs from 2.35 m');
    const hit = tri.events.find(e => e.type === 'Hit');
    assert.ok(hit, 'the trident lands from 2.35 m'); assert.deepEqual([hit!.weapon, hit!.material], ['trident', 'bronze'], 'the hit is tagged with the weapon that dealt it');
    assert.equal(tri.fighters[0].stamina, 100 - 30, 'and the thrust cost the trident\'s price'); assert.equal(sword.fighters[0].stamina, 100 - MOVES.thrust.stamina);
    // Legality reads the fighter's own table: with 25 stamina the longsword can thrust, the trident cannot.
    const poor = (w: 'longsword' | 'trident') => { const d = duel(1.5, w); d.fighters[0] = { ...d.fighters[0], stamina: 25 }; return legal(d.fighters[0], 'thrust'); };
    assert.equal(poor('longsword'), true); assert.equal(poor('trident'), false);
    assert.equal(weaponOf('trident').reach, 2.5);
  } finally { WEAPONS.trident = before.weapon; bladePaths.trident = before.paths; }
});

test('contact events name the weapon and its material for the audio lane: Hit, Blocked, Parried and GuardBroken', () => {
  const light = MOVES.light_right, heavy = MOVES.heavy_overhead;
  const hold = (): Intent => ({ ...idle(), guard: true });
  const hit = run(stepDuel(duel(1.2), [act('light'), idle()]), light.windup).events.find(e => e.type === 'Hit')!;
  const blocked = run(stepDuel(duel(1.2), [act('light'), hold()]), light.windup, idle(), hold()).events.find(e => e.type === 'Blocked')!;
  let p = run(stepDuel(duel(1.2), [act('light'), idle()]), light.windup - 9); p = run(stepDuel(p, [idle(), { ...act('parry'), guard: true }]), 8, idle(), hold());
  const parried = p.events.find(e => e.type === 'Parried')!;
  let g = run(stepDuel(duel(1.2), [idle(), hold()]), 5, idle(), hold()); g = { ...g, fighters: [g.fighters[0], { ...g.fighters[1], stamina: 5 }] } as Duel;
  const broken = run(stepDuel(g, [act('heavy'), hold()]), heavy.windup, idle(), hold()).events.find(e => e.type === 'GuardBroken')!;
  for (const [name, e] of [['Hit', hit], ['Blocked', blocked], ['Parried', parried], ['GuardBroken', broken]] as const) { assert.ok(e, `${name} happened`); assert.deepEqual([e.weapon, e.material], ['longsword', 'iron'], `${name} carries the attacker's weapon and material`); }
});

test('the bake manifest is sound: every entry names a known weapon, an existing rig and node, a rising contact segment; every non-placeholder weapon has a baked table with all of its paths', () => {
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  assert.ok(manifest.weapons.length >= 1);
  for (const entry of manifest.weapons) {
    assert.ok(entry.weapon in WEAPONS, `${entry.weapon} is a weapon`);
    const bytes = readFileSync(new URL('../' + entry.glb, import.meta.url)); const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
    assert.ok(json.nodes.some((n: { name: string }) => n.name === entry.node), `${entry.glb} has node ${entry.node}`);
    assert.ok(entry.contact[1] > entry.contact[0] && entry.contact[0] >= 0, 'a rising contact segment');
  }
  for (const [id, w] of Object.entries(WEAPONS)) { if (w.placeholder) continue; assert.ok(bladePaths[id], `${id} has a baked table`); for (const path of Object.keys(w.paths)) assert.ok(bladePaths[id][path]?.length, `${id}/${path} baked`); }
});

test('the warden reasons with its own weapon\'s reach: carrying a longer weapon it throws the thrust from where the longsword would only walk in', async () => {
  const { decide, initialAi } = await import('../src/ai.ts'); const { PROFILES } = await import('../src/moves.ts');
  const before = WEAPONS.trident; WEAPONS.trident = { ...LONGSWORD, id: 'trident', reach: 2.6, moves: { ...MOVES, thrust: { ...MOVES.thrust, reach: 2.6 } } };
  try {
    const arena = (weapon: 'longsword' | 'trident'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 2.3, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', weapon)], finish: null, events: [] });
    const state = { ...initialAi(3), mode: 'approach' as const, decision: 500, wait: 0, next: 'thrust' as const, habits: { ...initialAi().habits, attacks: 1 } };
    assert.equal(decide(arena('trident'), 1, state, PROFILES.normal).intent.action, 'thrust', 'in reach for the trident: thrown');
    assert.equal(decide(arena('longsword'), 1, state, PROFILES.normal).intent.action, null, 'out of reach for the longsword: not thrown');
  } finally { WEAPONS.trident = before; }
});
