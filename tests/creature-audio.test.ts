// Frontier creature voices (src/audio/creature.ts, ?look=creatures): the pure tables and the look flag. The rendered levels are pinned by scripts/audio-preview.mjs --check.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREATURE_CUES, THROATS, creaturesLook, levelAt, pitchAt, voiceCreature } from '../src/fight/sound/creature.ts';

test('the look flag is ?look=creatures only, default silent', () => {
  assert.equal(creaturesLook(''), false); assert.equal(creaturesLook('?region=1'), false); assert.equal(creaturesLook('?look=powerwords'), false);
  assert.equal(creaturesLook('?look=creatures'), true); assert.equal(creaturesLook('?region=1&look=creatures&x=1'), true); assert.equal(creaturesLook('?look=creaturesx'), false);
});

test('every cue sits under the break thud (.55) and has a length; every throat has two formants and a rasp share', () => {
  for (const [cue, s] of Object.entries(CREATURE_CUES)) { assert.ok(s.gain > 0 && s.gain < .55, `${cue} gain ${s.gain}`); assert.ok(s.length > 0 && s.length <= 1.5, `${cue} length`); }
  for (const [body, t] of Object.entries(THROATS)) { assert.ok(t.f0 > 40 && t.f0 < 400, body); assert.equal(t.formants.length, 2); assert.ok(t.rasp >= 0 && t.rasp <= 1, body); }
});

test('the shapes: the growl swells and sags, the bite snaps down, the death falls to silence', () => {
  assert.ok(pitchAt('growl', .5) > pitchAt('growl', 0) && pitchAt('growl', 1) < pitchAt('growl', .5));
  assert.ok(pitchAt('bite', 0) > pitchAt('bite', 1)); assert.ok(pitchAt('death', 0) > pitchAt('death', 1));
  for (const cue of ['growl', 'bite', 'death'] as const) { assert.ok(levelAt(cue, 0) === 0, `${cue} starts silent`); assert.ok(levelAt(cue, .3) > 0, `${cue} sounds`); assert.ok(levelAt(cue, 1) < .05, `${cue} ends silent`); }
});

test('a body with no throat is silent: the voice returns its start and touches nothing', () => {
  const touched: string[] = [], context = new Proxy({}, { get: (_t, k) => { touched.push(String(k)); return () => ({}); } }) as unknown as BaseAudioContext;
  assert.equal(voiceCreature(context, {} as AudioNode, {} as AudioBuffer, 'nobody', 'growl', 2), 2);
  assert.deepEqual(touched, []);
});
