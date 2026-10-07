import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardCue, guardCueFrom } from '../src/guard-cue.ts';

test('the flag: only ?look=guard-cue turns it on', () => {
  for (const q of ['', '?look=fatigue-preview', '?guard-cue=1']) assert.equal(guardCueFrom(q), false);
  assert.equal(guardCueFrom('?look=guard-cue'), true); assert.equal(guardCueFrom('?look=stances,guard-cue'), true);
});

test('the tick names the ATTACK side his guard meets, only while he guards', () => {
  assert.equal(guardCue({ phase: 'ready', guardDirection: 'left' }), '', 'not guarding: nothing');
  assert.equal(guardCue(undefined), '');
  assert.match(guardCue({ phase: 'guard', guardDirection: 'left' }), /right cut/, 'his left guard meets your right cut');
  assert.match(guardCue({ phase: 'guard', guardDirection: 'right' }), /left cut/);
  assert.match(guardCue({ phase: 'guard', guardDirection: null }), /thrust/, 'no side chosen = the straight guard');
  assert.match(guardCue({ phase: 'guard', guardDirection: 'overhead' }), /overhead/); assert.match(guardCue({ phase: 'guard', guardDirection: 'low' }), /low/);
});

test('the wiring: the HUD shows it only under the flag and the cue is in the skip key', () => {
  const hud = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(hud, /const cue = view\.guardCue \? guardCue\(practice\.duel\.fighters\[1\]\) : ''/); assert.match(hud, /\$\{cue\}`;/);
  assert.match(main, /guardCue: GUARD_CUE/);
});
