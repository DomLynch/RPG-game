// Zone 1 specials look and sound like specials (Dom 2026-10-19): presentation only. The Pit already draws the skill-impact kit and plays a melee special's specialSound rows; Zone 1 now does the same from its own
// contacts, and a ?debug=1 counter on both pages proves it. Unit level, no browser: the shared event reading, the wiring (source pins, like tests/stance-origins-gate.test.ts) and the counter's rules.
import './lib/era-on.ts';   // the shipped specialSound rows are read only with the sandbox era on
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Scene } from 'three';
import type { CombatEvent } from '../src/fight/combat.ts';
import { specialRequestOf } from '../src/fight/special-request.ts';
import { countSpecial, enableSpecialCounter, resetSpecialCounter, specialCounting } from '../src/fight/special-counter.ts';
import { createSkillImpact } from '../src/fight/skill-impact.ts';
import { cuesFor, isSpecialRowCue } from '../src/fight/sound/cues.ts';

const SIX = ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'stomp'];
const ev = (type: string, skill: string, extra: object = {}) => ({ tick: 5, type, actor: 0, target: 1, move: `skill_${skill}`, location: 'torso', ...extra }) as unknown as CombatEvent;
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('SPECIAL 1 events and the other slot\'s events are the same request, for each of the six', () => {
  for (const skill of SIX) {
    const start = { skill, phase: 'start', actor: 0 }, land = { skill, phase: 'land', actor: 0, target: 1 };
    assert.deepEqual(specialRequestOf(ev('SpecialStarted', skill)), start, `${skill} SpecialStarted`);
    assert.deepEqual(specialRequestOf(ev('AttackStarted', skill)), start, `${skill} slot 2 AttackStarted`);
    assert.deepEqual(specialRequestOf(ev('SpecialLanded', skill)), land, `${skill} SpecialLanded`);
    assert.deepEqual(specialRequestOf(ev('Hit', skill)), land, `${skill} slot 2 Hit`);
  }
});

test('what is not a melee special\'s cast asks for nothing', () => {
  assert.equal(specialRequestOf(ev('AttackStarted', 'lunge', { actor: 1, target: 0 })), null, 'a foe\'s ordinary attack with a skill move keeps the generic look and sound');
  assert.equal(specialRequestOf(ev('SpecialStarted', 'lunge', { spell: 'x' })), null, 'a spell has its own look');
  assert.equal(specialRequestOf(ev('AttackStarted', 'lunge', { move: 'light' })), null);
  assert.equal(specialRequestOf(ev('Hit', 'lunge', { target: undefined })), null);
  for (const type of ['Blocked', 'Parried', 'Dodged', 'AttackMissed']) assert.equal(specialRequestOf(ev(type, 'lunge')), null, type);
});

test('the wiring: Zone 1 draws the kit from its contacts and both pages open the counter', () => {
  const zoneFx = src('src/fight/zone-fx.ts');
  assert.match(zoneFx, /createSkillImpact\(host\.scene\)/);
  assert.match(zoneFx, /skillImpact\.fire\(c\.events/);
  assert.match(zoneFx, /skillImpact\.update\(dt\)/);
  assert.match(zoneFx, /specialRequestOf\(/);
  assert.match(src('origins/preview/main.ts'), /enableSpecialCounter\(location\.search/);
  assert.match(src('src/main.ts'), /enableSpecialCounter\(window\.location\?\.search/);
  assert.match(src('src/fight/sound/feedback.ts'), /isSpecialRowCue\(cue\)\) countSpecial\('cues'\)/);
  assert.match(src('src/fight/scene.ts'), /countSpecial\('fx', skillImpact\.fire\(/);
  // Zone 1's sound is the Pit's own feedback fed the world's Pit events (zone-sound.ts): the specialSound rows ride on it.
  assert.match(src('origins/preview/zone-sound.ts'), /fb\?\.update\(events\)/);
  // presentation only: none of this PR's files is a sim file
  const SIM = src('tests/record-version-guard.test.ts') + src('tests/world-sim-guard.test.ts');
  for (const file of ['special-counter.ts', 'special-request.ts', 'zone-fx.ts', 'skill-impact.ts']) assert.ok(!SIM.includes(`src/fight/${file}`), `${file} is not a SIM_FILES member`);
});

test('the counter: absent with debug off; with ?debug=1 it counts exactly the real FX spawns and cue plays', () => {
  resetSpecialCounter();
  const host: { __specials?: unknown } = {};
  assert.equal(enableSpecialCounter('?region=1&worldfight', host), null);
  assert.equal(host.__specials, undefined);
  assert.equal(specialCounting(), false);
  countSpecial('fx'); countSpecial('cues', 3);
  const dataOff: DOMStringMap = {};
  assert.equal(enableSpecialCounter('?region=1', host, { dataset: dataOff }), null);
  assert.deepEqual(dataOff, {}, 'debug off writes nothing');
  // off: the cue marker is never written either
  const off = cuesFor([ev('SpecialStarted', 'lunge')]);
  assert.ok(off.length > 0 && !off.some(isSpecialRowCue));

  const dataset: DOMStringMap = {};
  const counts = enableSpecialCounter('?region=1&worldfight&debug=1', host, { dataset });
  assert.ok(counts); assert.equal(host.__specials, counts);
  assert.deepEqual({ ...counts }, { fx: 0, cues: 0 }, 'nothing counted before something spawns');   // the three calls above were dropped while off
  // FX: the count is what the pool really spawned
  const kit = createSkillImpact(new Scene()), fighters = [{ body: { x: 0, z: 4 } }, { body: { x: 0, z: 2 } }] as never;
  countSpecial('fx', kit.fire([ev('Hit', 'lunge', { type: 'Blocked' })], fighters, [1, 1]));
  assert.equal(counts.fx, 0, 'a blocked blow spawns no flash');
  for (const skill of SIX) countSpecial('fx', kit.fire([ev('Hit', skill)], fighters, [1, 1]));
  assert.equal(counts.fx, SIX.length, 'one flash per landed special');
  assert.equal(dataset.specialFx, String(SIX.length));
  // cues: the specialSound rows' cues, each counted by feedback.ts at the play call
  let rowCues = 0;
  for (const skill of SIX) for (const type of ['SpecialStarted', 'AttackStarted', 'SpecialLanded', 'Hit']) {
    const made = cuesFor([ev(type, skill)]).filter(isSpecialRowCue); rowCues += made.length;
    if (type === 'SpecialLanded' || type === 'Hit') assert.ok(made.length > 0, `${skill} ${type} has a landing cue`);   // every one of the six has landing rows; Pommel has no start (whoosh) row
    if (skill !== 'pommel' && (type === 'SpecialStarted' || type === 'AttackStarted')) assert.ok(made.length > 0, `${skill} ${type} has a start cue`);
    if (type === 'AttackStarted' || type === 'Hit') assert.deepEqual(made.map((c) => c.name), cuesFor([ev(type === 'Hit' ? 'SpecialLanded' : 'SpecialStarted', skill)]).filter(isSpecialRowCue).map((c) => c.name), `${skill}: slot 2 sounds as SPECIAL 1`);
  }
  assert.ok(rowCues > 0);
  assert.equal(cuesFor([ev('Hit', 'light' as never, { move: 'light' })]).filter(isSpecialRowCue).length, 0, 'an ordinary blow\'s cues are not special cues');
  countSpecial('cues', 2); assert.equal(counts.cues, 2); assert.equal(dataset.specialCues, '2');
  resetSpecialCounter(host);
  assert.equal(host.__specials, undefined);
});
