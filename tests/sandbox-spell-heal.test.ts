// sandbox-mech: spellHeal (Dom 2026-10-17, Strategy): a utility spell that restores a share of the caster's own max health when its windup releases; paid in mana, needs no range, always lands, capped per fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { rules: { id: string; value: number }[]; spellHeal: object[]; bands: object[]; spellRange: object[] };
const rule = (id: string) => defs.rules.find((r) => r.id === id)!;
rule('manaMax').value = 100; rule('manaRegen').value = 0; rule('manaDelay').value = 90; rule('manaCostMult').value = 1000;
defs.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
defs.spellRange.push({ root: 'theRing', band: 'inner', kind: 'melee', windup: 60 });   // gula's root is a melee root: the heal must ignore its band, kind and windup
defs.spellHeal.push({ id: 'gula', share: 250, uses: 1, windup: 120 });
const { createFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const { resolveSpell } = await import('../src/fight/spell-cast.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type D = { fighters: { mana: number; health: number; maxHealth: number; special?: number; healUses?: number; spell?: unknown; skillCooldown: number }[]; events: { type: string; heal?: number; damage?: number; actor: number; target?: number }[] };
const start = (gap: number, health: number) => {
  const c = { ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'shove' as never, spell: resolveSpell('gula', 100)!, health };
  return { tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [], cast: { seed: 7 } } as never as D;
};
const step = (d: D, a0: 'skill' | null) => stepDuel(d as never, [{ ...idle(), ...(a0 ? { action: a0 } : {}) }, idle()]) as never as D;

test('the heal is cast from any distance, paid in mana, and restores 25% of max health at the release (a 2 s windup)', () => {
  let d = step(start(5, 60), 'skill');   // 5 m away: a melee root would be refused "far"
  assert.ok(d.events.some((e) => e.type === 'SpecialStarted'), 'cast started far from the foe');
  assert.ok(!d.events.some((e) => e.type === 'SpellRefused'), 'no range refusal');
  assert.ok(d.fighters[0]!.mana < 100, 'paid in mana');
  assert.equal(d.fighters[0]!.special! >= 100 && d.fighters[0]!.special! <= 120, true, `windup is the row's 120 ticks, not the melee root's 60 (counter ${d.fighters[0]!.special})`);
  assert.equal(d.fighters[0]!.health, 60, 'nothing yet');
  let landed: D['events'][number] | undefined;
  for (let i = 0; i < 140 && !landed; i++) { d = step(d, null); landed = d.events.find((e) => e.type === 'SpecialLanded'); }
  assert.ok(landed, 'the heal released');
  assert.equal(landed!.heal, Math.round(0.25 * 150), '25% of max health (150) = 38'); assert.equal(landed!.damage, 0);
  assert.equal(d.fighters[0]!.health, 60 + 38); assert.equal(d.fighters[1]!.health, 150, 'the foe is untouched');
  assert.equal(d.fighters[0]!.healUses, 1);
});
test('the heal never overfills, and is refused once the per-fight use cap is spent', () => {
  let d = step(start(5, 140), 'skill'); for (let i = 0; i < 140 && !d.events.some((e) => e.type === 'SpecialLanded'); i++) d = step(d, null);
  assert.equal(d.fighters[0]!.health, 150, 'capped at max health');
  assert.equal(legal({ ...d.fighters[0]!, skillCooldown: 0, special: 0, specialRecover: 0, specialShare: 0.1 } as never, 'skill'), false, 'the second heal is refused: uses = 1');
  assert.equal(legal({ ...d.fighters[0]!, healUses: 0, skillCooldown: 0, special: 0, specialRecover: 0, specialShare: 0.1 } as never, 'skill'), true, 'with a use left it is legal');
});
