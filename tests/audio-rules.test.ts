// The sound's numbers are rows (src/fight/sound/audio-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIO_RULES, CASTER_ROWS, THROAT_ROWS, audioRule, bloomRules, loadAudioRules } from '../src/fight/sound/audio-rules.ts';
import { BELL_SECONDS, BELL_RATE } from '../src/audio/bell.ts';
import { GATE_CUT } from '../src/audio/gate.ts';
import { SPRITE_SECONDS } from '../src/audio/manifest.ts';
import { OUTPUT_GAIN, MAX_LAYERS } from '../src/fight/sound/armfeel-sound.ts';
import { PITCH_SPREAD } from '../src/fight/sound/cues.ts';
import { VOICES, COMBAT_LEVEL, FINISH_LEVEL } from '../src/fight/sound/feedback.ts';
import { POWER_WORD_LOOK_GAIN } from '../src/fight/sound/power-word.ts';
import { THROATS } from '../src/fight/sound/creature.ts';
import DEFS from '../src/fight/sound/audio-rules-defs.json' with { type: 'json' };

test('every audio rule equals the literal it replaced', () => {
  assert.deepEqual([BELL_SECONDS, BELL_RATE, GATE_CUT, SPRITE_SECONDS, OUTPUT_GAIN, MAX_LAYERS, PITCH_SPREAD, VOICES, POWER_WORD_LOOK_GAIN], [2.5, 48000, 0.06, 46.108, 0.65, 8, 0.05, 8, 0.3]);
  assert.deepEqual([COMBAT_LEVEL, FINISH_LEVEL], [0.375 * 0.4, 1.5 * 0.4]);
  assert.deepEqual(['arenaLevel', 'bellDrive', 'wardenHealth', 'breathAhead', 'breathDuck', 'breathDuckBack', 'breathRelease', 'whipRaise', 'baseSeed', 'mix', 'rise', 'riseFloor', 'cut'].map((id) => audioRule(id as never)), [0.4, 2, 80, 0.3, 0.3, 0.45, 1.4, 0.4, 731, 0.4, 1.6, 0.35, 0.035]);
  assert.deepEqual(bloomRules(), { above: 300, seconds: 0.4 });
  assert.deepEqual(['whipRateBase', 'whipGuardCap', 'whipGuardStep'].map((id) => audioRule(id as 'whipRaise')), [0.94, 5, 0.024], 'the whip rate: base, guard cap, step');
  assert.equal(AUDIO_RULES.length, 27);
});
test('the creature throats and the power-word casters equal the tables they replaced', () => {
  assert.deepEqual(THROATS, THROAT_ROWS);
  assert.deepEqual(THROATS.goblin, { f0: 150, formants: [700, 1300], rasp: 0.55 });
  assert.deepEqual(THROATS.bear, { f0: 62, formants: [350, 750], rasp: 0.55 });
  assert.deepEqual(Object.keys(THROATS).sort(), ['bear', 'boar', 'goblin', 'knight', 'minotaur', 'pitborn', 'witch', 'wolf', 'wolf'].filter((v, i, a) => a.indexOf(v) === i));
  assert.deepEqual(CASTER_ROWS, { witch: { f0: 175, breath: 0.55, syllable: 0.24 }, plaguedoctor: { f0: 88, breath: 0.4, syllable: 0.3 } });
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadAudioRules({ ...DEFS, rules: rows.filter((r) => r.id !== 'mix') }), /"mix" rule by name/);
  assert.throws(() => loadAudioRules({ ...DEFS, rules: rows.map((r) => (r.id === 'cut' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadAudioRules({ ...DEFS, rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadAudioRules({ ...DEFS, rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).rules.length, 28);
});
