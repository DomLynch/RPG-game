// sandbox-mech: spell ranges. A spell root names a band (the live `bands` rows); a cast outside it is refused with a cue and no mana is spent; a long spell flies through the missile model and lands on arrival.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { rules: { id: string; value: number }[]; bands: object[]; spellRange: object[]; spellCue: object[] };
const rule = (id: string) => defs.rules.find((r) => r.id === id)!;
rule('manaMax').value = 100; rule('manaRegen').value = 60; rule('manaDelay').value = 90; rule('manaCostMult').value = 1000;
defs.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
defs.spellRange.push({ root: 'theWord', band: 'inner' }, { root: 'longShadow', band: 'mid' }, { root: 'gale', band: 'outer', speed: 900, tint: '#9fd0ff' });
defs.spellCue.push({ id: 'far', text: 'too far' }, { id: 'close', text: 'too close' });
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { resolveSpell } = await import('../src/fight/spell-cast.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const SHORT = 'mother-shipton', MEDIUM = 'alvis', LONG = 'blue-men';   // theWord, longShadow, gale
const duelAt = (id: string, gap: number) => {
  const c = { ...createFighter({ x: 0, z: gap, heading: Math.PI, distance: 0 }, 'ready'), specialShare: 0.1, skillCooldown: 0, skill: 'shove' as never, spell: resolveSpell(id, 100)! };
  return { tick: 0, fighters: [c, createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [], cast: { seed: 7 } } as never as { fighters: { mana: number; special?: number; missile?: { spell?: string }; health: number }[]; events: { type: string; cue?: string }[] };
};
const press = (d: ReturnType<typeof duelAt>) => stepDuel(d as never, [{ ...idle(), action: 'skill' }, idle()]) as never as ReturnType<typeof duelAt>;

test('a cast inside its band starts and is paid; outside it the press is refused with a cue and costs nothing', () => {
  const ok = press(duelAt(MEDIUM, 1.5));
  assert.ok(ok.fighters[0]!.mana < 100 && ok.events.some((e) => e.type === 'SpecialStarted'), 'mid spell at 1.5 m casts');
  const far = press(duelAt(SHORT, 1.5));
  assert.equal(far.fighters[0]!.mana, 100, 'no mana spent'); assert.equal(far.events.find((e) => e.type === 'SpellRefused')?.cue, 'far'); assert.equal(far.fighters[0]!.special, undefined);
  const close = press(duelAt(MEDIUM, 1.0));
  assert.equal(close.events.find((e) => e.type === 'SpellRefused')?.cue, 'close'); assert.equal(close.fighters[0]!.mana, 100);
  assert.equal(press(duelAt(LONG, 1.5)).events.find((e) => e.type === 'SpellRefused')?.cue, 'close', 'a long spell is refused inside the outer band');
});
test('a long spell launches a missile at the release and lands on arrival, not at once', () => {
  let d = duelAt(LONG, 2.4); d = press(d);
  assert.ok(d.fighters[0]!.mana < 100, 'cast started');
  let launched = -1, landed = -1;
  for (let i = 0; i < 400 && landed < 0; i++) {
    d = stepDuel(d as never, [idle(), idle()]) as never;
    if (launched < 0 && d.events.some((e) => e.type === 'MissileLaunched')) launched = i;
    if (d.events.some((e) => e.type === 'SpecialLanded')) landed = i;
  }
  assert.ok(launched >= 0, 'MissileLaunched'); assert.ok(landed > launched, `lands after the flight (launched ${launched}, landed ${landed})`);
});
