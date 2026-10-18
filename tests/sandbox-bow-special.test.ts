// sandbox bowSpecial: a bow carrier's four picker specials are arrows (Power Shot, Fan Volley, Pinning Shot, Quick Shot) through the one missile model; inside the missile gap or out of arrows the melee special stays; a pin is crowd control through the cc ladder.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value: number }[]; bands: unknown[]; missile: unknown[]; missileLanes: unknown[]; bowSpecial: object[]; specialReactFloor: object[] };
const rule = (id: string) => d.rules.find((r) => r.id === id)!;
rule('quiver').value = 1; rule('missileRadius').value = 70; rule('missileFan').value = 22; rule('missileStun').value = 16; rule('missileHoming').value = 1;
rule('specialMeleeWindup').value = 32; rule('specialReact').value = 1; rule('specialReactStagger').value = 160; rule('specialReactKnock').value = 450; rule('specialReactPosture').value = 150;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.missile.push({ kind: 'bow', weapon: 'knife', speed: 900, share: 1000, mana: 0, windup: 20, recovery: 0, ammo: 20, pierce: 0 });
d.missileLanes.push({ move: 'thrust', lane: 0 });
d.bowSpecial.push(
  { skill: 'cleave', label: 'Power Shot', unlockAfterBossKills: 0, arrows: 2, lanes: [0], mult: 2000, windup: 40, speed: 700, react: 1 },
  { skill: 'reaping', label: 'Fan Volley', unlockAfterBossKills: 1, arrows: 3, lanes: [-1, 0, 1], mult: 600, windup: 36, speed: 900 },
  { skill: 'stomp', label: 'Pinning Shot', unlockAfterBossKills: 2, arrows: 1, lanes: [0], mult: 1000, windup: 36, speed: 900, pin: 90 },
  { skill: 'lunge', label: 'Quick Shot', unlockAfterBossKills: 0, arrows: 1, lanes: [0], mult: 1200, windup: 14, speed: 1400 });
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type F = { health: number; maxHealth: number; ammo?: number; stun: number; phase: string; special: number };
type D2 = { fighters: F[]; events: { type: string; damage?: number; ticks?: number }[] };
const SHARE = 0.1;
const start = (skill: string, gap: number, foe: object = {}): D2 => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready', 'knife' as never), specialShare: SHARE, skillCooldown: 0, skill: skill as never }, { ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'), ...foe }], finish: null } as never);
const run = (duel: D2, ticks = 200) => { const all: D2['events'] = []; duel = stepDuel(duel as never, [{ ...idle(), action: 'skill' }, idle()]) as never; all.push(...duel.events); for (let i = 0; i < ticks; i++) { duel = stepDuel(duel as never, [idle(), idle()]) as never; all.push(...duel.events); } return { duel, all }; };

for (const [skill, arrows, lanes, mult] of [['cleave', 2, 1, 2000], ['reaping', 3, 3, 600], ['stomp', 1, 1, 1000], ['lunge', 1, 1, 1200]] as const) {
  test(`${skill} from range is ${arrows} arrow(s): spends the quiver and lands ${lanes} x ${mult} per-mille`, () => {
    const { duel, all } = run(start(skill, 3));
    assert.equal(duel.fighters[0]!.ammo, 20 - arrows, 'the arrows are spent');
    assert.ok(all.some((e) => e.type === 'MissileLaunched') && all.some((e) => e.type === 'Hit'), 'launched and hit');
    const hit = all.find((e) => e.type === 'Hit')!, f = duel.fighters[1]!;
    assert.equal(hit.damage, lanes * Math.round(SHARE * f.maxHealth * mult / 1000));
    assert.equal(f.health, f.maxHealth - hit.damage!);
  });
}
test('a power shot staggers harder than a plain arrow; a pinning shot pins for its row ticks', () => {
  assert.ok(run(start('cleave', 3)).all.find((e) => e.type === 'Staggered')!.ticks! > 16, 'power shot reacts like a melee special');
  assert.equal(run(start('stomp', 3)).all.find((e) => e.type === 'Staggered')!.ticks, 90, 'the pin is the row');
  assert.equal(run(start('reaping', 3)).all.find((e) => e.type === 'Staggered')!.ticks, 16, 'a plain volley arrow only flinches');
});
test('a pinning shot goes through the cc ladder: an unstoppable creature is not pinned', () => {
  const pinned = (guard: object) => run(start('stomp', 3, { cc: [], ccGuard: guard })).all.find((e) => e.type === 'Staggered')!.ticks!;
  assert.equal(pinned({}), 90);
  assert.ok(pinned({ immuneTier: 'unstoppable' }) < 90, 'the immune tier takes the flinch only');
});
test('inside the missile gap the bow keeps the melee special; out of arrows at range casts nothing', () => {
  const near = run(start('cleave', 1.2)); assert.ok(near.all.some((e) => e.type === 'SpecialLanded') && !near.all.some((e) => e.type === 'MissileLaunched'), 'melee special up close');
  const dry = start('cleave', 3); dry.fighters[0]!.ammo = 1;
  assert.ok(!run(dry).all.some((e) => e.type === 'SpecialStarted'), 'one arrow left cannot pay for a 2-arrow Power Shot');
});
