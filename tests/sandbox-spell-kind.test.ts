// sandbox-mech: spell kinds (Dom 2026-10-16: melee or magic, nothing else). A `melee` root is cast up close and paid in stamina; a `magic` root is cast from the medium / long bands and paid in mana. The kind is a `spellRange` row field.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import RANGE from '../sandbox/rows.json' with { type: 'json' };

const defs = DEFS as unknown as { rules: { id: string; value: number }[]; bands: object[]; spellRange: object[]; spellCue: object[] };
const rule = (id: string) => defs.rules.find((r) => r.id === id)!;
rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90; rule('manaCostMult').value = 1000;
defs.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
defs.spellRange.push({ root: 'theWord', band: 'inner', kind: 'melee' }, { root: 'longShadow', band: 'mid', kind: 'magic' }, { root: 'gale', band: 'outer', kind: 'magic', speed: 900, tint: '#9fd0ff' });
defs.spellCue.push({ id: 'far', text: 'too far' });
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { resolveSpell } = await import('../src/fight/spell-cast.ts');
const { legal } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const MELEE = 'mother-shipton', MAGIC = 'alvis';   // theWord, longShadow
type D = { fighters: { mana: number; stamina: number; special?: number; spell?: { cost: number } }[]; events: { type: string; cue?: string }[] };
const duelAt = (id: string, gap: number, mana = 100, stamina?: number) => {
  const c = { ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'shove' as never, spell: resolveSpell(id, 100)!, mana };
  if (stamina !== undefined) c.stamina = stamina;
  return { tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [], cast: { seed: 7 } } as never as D;
};
const press = (d: D) => stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never as D;

test('a melee spell is paid in stamina and leaves mana alone', () => {
  const before = duelAt(MELEE, 0.8), start = before.fighters[0]!.stamina, after = press(before);
  assert.ok(after.events.some((e) => e.type === 'SpecialStarted'), 'cast');
  assert.equal(after.fighters[0]!.mana, 100, 'mana untouched');
  assert.ok(after.fighters[0]!.stamina < start, 'stamina spent');
});
test('a magic spell is paid in mana and leaves stamina alone', () => {
  const before = duelAt(MAGIC, 1.5), start = before.fighters[0]!.stamina, after = press(before);
  assert.ok(after.events.some((e) => e.type === 'SpecialStarted'), 'cast');
  assert.ok(after.fighters[0]!.mana < 100, 'mana spent');
  assert.ok(after.fighters[0]!.stamina >= start, 'stamina not spent');
});
test('mana is no use to a melee spell, and stamina is no use to a magic one', () => {
  const can = (d: D) => legal(d.fighters[0] as never, 'skill');
  assert.equal(can(duelAt(MELEE, 0.8, 0)), true, 'melee with no mana still casts on stamina');
  assert.equal(can(duelAt(MELEE, 0.8, 100, 0)), false, 'melee with no stamina is refused');
  assert.equal(can(duelAt(MAGIC, 1.5, 0)), false, 'magic with no mana is refused');
  assert.equal(can(duelAt(MAGIC, 1.5, 0, 100)), false, 'plenty of stamina does not pay for magic');
});
test('a melee spell is cast up close only: out past the close band it is refused', () => {
  assert.equal(press(duelAt(MELEE, 1.5)).events.find((e) => e.type === 'SpellRefused')?.cue, 'far');
});
test('the sandbox rows tag every spell root: the four close roots are melee, the five medium / long roots are magic', () => {
  const rows = (RANGE as unknown as { files: { 'sandbox-rules-defs': { spellRange: { root: string; band: string; kind: string }[] } } }).files['sandbox-rules-defs'].spellRange;
  assert.equal(rows.length, 9);
  for (const r of rows) assert.equal(r.kind, r.band === 'inner' ? 'melee' : 'magic', r.root);
});
