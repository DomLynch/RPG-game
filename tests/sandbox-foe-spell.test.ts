// sandbox-mech: opponent spells. The foe may carry a catalogue spell (initialPractice's foeSpell) and its AI casts it only inside that spell's range rows, the same gate as the player's press; a foe with no spell still casts its special at the special's reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { rules: { id: string; value: number }[]; bands: object[]; spellRange: object[]; spellCue: object[] };
const rule = (id: string) => defs.rules.find((r) => r.id === id)!;
rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90; rule('manaCostMult').value = 1000;
defs.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
defs.spellRange.push({ root: 'theWord', band: 'inner' }, { root: 'longShadow', band: 'mid' }, { root: 'gale', band: 'outer', speed: 900, tint: '#9fd0ff' });
defs.spellCue.push({ id: 'far', text: 'too far' });
const { initialPractice } = await import('../src/fight/combat.ts');
const { decide, initialAi } = await import('../src/fight/ai.ts');
const { resolveSpell } = await import('../src/fight/spell-cast.ts');
const { PROFILES } = await import('../src/fight/moves.ts');

const SHORT = 'mother-shipton', MEDIUM = 'alvis', LONG = 'blue-men';   // theWord, longShadow, gale
const practiceWith = (foe?: string) => initialPractice(731, undefined, undefined, null, { level: 1, aiSkill: null }, undefined, undefined, undefined, undefined, undefined, undefined, foe ? resolveSpell(foe, 100) : undefined);
// the foe stands `gap` metres from the player, its special ready and mana full
const foeAt = (foe: string | undefined, gap: number) => {
  const p = practiceWith(foe), f = p.duel.fighters;
  f[0].phase = 'ready'; f[0].body = { ...f[0].body, x: 0, z: 0 };   // the AI waits while the player is still sheathed f[1].body = { ...f[1].body, x: 0, z: gap, heading: Math.PI }; f[1].skillCooldown = 0; f[1].phase = 'ready';
  return decide(p.duel, 1, initialAi(), PROFILES.normal).intent.action;
};

test('the foe carries the spell it was given, and none by default', () => {
  assert.equal(practiceWith(MEDIUM).duel.fighters[1].spell?.id, MEDIUM);
  assert.equal(practiceWith().duel.fighters[1].spell, undefined);
});
test('a foe casts its spell inside the spell\'s range and holds it outside', () => {
  assert.equal(foeAt(SHORT, 0.8), 'skill', 'a short spell casts up close');
  assert.notEqual(foeAt(SHORT, 2.4), 'skill', 'a short spell is not cast from far away');
  assert.equal(foeAt(MEDIUM, 1.5), 'skill'); assert.notEqual(foeAt(MEDIUM, 2.4), 'skill');
  assert.equal(foeAt(LONG, 0.8), 'skill', 'a long spell may be cast as close as you like'); assert.equal(foeAt(LONG, 2.4), 'skill');
});
