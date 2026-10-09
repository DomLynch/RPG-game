import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cuesFor } from '../src/fight/sound/cues.ts';
import type { CombatEvent } from '../src/duel.ts';
import { defenceFlag, defenceGrade, GRADE_AUDIO, GRADE_LABEL, GRADES, HEAVY_BLOCK } from '../src/defence-grade.ts';

// The events exactly as duel.ts emits them (~361-370): a defence names the DEFENDER as actor and the attacker as target.
const parried = { tick: 5, type: 'Parried', actor: 0, target: 1, move: 'heavy_overhead' } as CombatEvent;
const blocked = (over: Partial<CombatEvent>) => ({ tick: 5, type: 'Blocked', actor: 0, target: 1, move: 'light_right', stamina: 8, perfect: false, ...over }) as CombatEvent;

test('the flag is ?look=defence only, alone or in a list', () => {
  assert.equal(defenceFlag('?look=defence'), true); assert.equal(defenceFlag('?x=1&look=schools,defence'), true);
  assert.equal(defenceFlag(''), false); assert.equal(defenceFlag('?look=defense'), false);
});

test('each grade fires from the sim event that defines it, and nothing else does', () => {
  assert.equal(defenceGrade(parried), 'parry');
  assert.equal(defenceGrade(blocked({ perfect: true })), 'perfect');
  assert.equal(defenceGrade(blocked({ perfect: true, move: 'heavy_overhead' })), 'perfect', 'a perfect block of a heavy is still perfect: no chip');
  assert.equal(defenceGrade(blocked({ move: 'heavy_overhead', damage: 6 })), 'heavy');
  assert.equal(defenceGrade(blocked({ move: 'heavy_counter', damage: 6 })), 'heavy');
  assert.equal(defenceGrade(blocked({ move: 'light_right' })), 'plain'); assert.equal(defenceGrade(blocked({ move: 'thrust', damage: 2 })), 'plain');
  assert.equal(defenceGrade({ ...parried, actor: 1 }), null, 'the foe\'s defences are not the player\'s'); assert.equal(defenceGrade(blocked({ actor: 1 })), null);
  for (const type of ['Hit', 'GuardBroken', 'Dodged', 'Staggered'] as const) assert.equal(defenceGrade({ tick: 1, type, actor: 0, target: 1 } as CombatEvent), null, type);
  assert.deepEqual([...GRADES], ['plain', 'heavy', 'perfect', 'parry']); assert.ok(HEAVY_BLOCK.has('heavy_overhead') && !HEAVY_BLOCK.has('light_left'));
});

test('sound: off = today\'s cues exactly; on = existing cue names only, a different mix per grade, the shipped block stays the plain one', () => {
  for (const e of [parried, blocked({}), blocked({ perfect: true }), blocked({ move: 'heavy_overhead', damage: 6 })]) assert.deepEqual(cuesFor([e]), cuesFor([e], undefined, undefined, [], false, false), 'default path unchanged');
  const mix = (e: CombatEvent) => cuesFor([e], undefined, undefined, [], false, true).map((c) => `${c.name}@${c.gain}x${c.rate ?? 1}+${c.delay ?? 0}`).join(' ');
  const four = [parried, blocked({ perfect: true }), blocked({ move: 'heavy_overhead', damage: 6 }), blocked({})].map(mix);
  assert.equal(new Set(four).size, 4, 'four different mixes');
  const names = new Set(Object.values(GRADE_AUDIO).flat().map((l) => l.name)); for (const n of names) assert.ok(['block', 'block_perfect', 'parry', 'hit_heavy'].includes(n));
  const manifest = readFileSync(new URL('../src/audio/manifest.ts', import.meta.url), 'utf8'); for (const n of names) assert.match(manifest, new RegExp(`\\b${n}\\b`), `${n} is an existing sprite cue`);
  assert.equal(cuesFor([blocked({ actor: 1 })], undefined, undefined, [], false, true)[0]!.name, 'block', 'the foe\'s block keeps the shipped cue');
});

test('the button ring, the caption and the wiring are all behind the flag, and the clarity cues stay', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), hud = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8');
  for (const g of GRADES) assert.match(css, new RegExp(`#guard-button\\[data-defence=${g}\\] \\{ --defence:`), g); assert.equal(Object.keys(GRADE_LABEL).length, 4);
  assert.match(main, /if \(!quiet && DEFENCE_GRADES\) hud\.defended\(practice\.events\)/); assert.match(main, /if \(!quiet\) hud\.refused\(practice\.clarity\);/, '#1481 refused cue intact');
  assert.match(hud, /refused\(clarity: readonly ClarityEvent\[\]\)/);
});
