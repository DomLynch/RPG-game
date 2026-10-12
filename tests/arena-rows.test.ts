// Arena vocabularies as rows (origins/arena/definitions.json, loaded and checked by the registry loader). Weather: what each kind does is a row of flags
// the Points cloud reads (src/arena.ts), never a name. These pin the rows to what the old name branches did, and that a theme can only name a row.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA_THEMES, WEATHER_ROWS, weatherRow } from '../src/arena-themes.ts';

test('the weather rows carry the flags the old kind branches had (rain: falls + streaks, radius 11, 500 on a phone; drips fall; embers rise; dust hangs low; ash drifts)', () => {
  assert.deepEqual(Object.keys(WEATHER_ROWS), ['ash', 'embers', 'rain', 'dust', 'drips']);
  assert.deepEqual(WEATHER_ROWS.ash, { order: 1 });
  assert.deepEqual(WEATHER_ROWS.embers, { order: 2, rises: true });
  assert.deepEqual(WEATHER_ROWS.rain, { order: 3, falls: true, streaks: true, radius: 11, phoneCount: 500 });
  assert.deepEqual(WEATHER_ROWS.dust, { order: 4, low: true });
  assert.deepEqual(WEATHER_ROWS.drips, { order: 5, falls: true });
});

test('every theme names a weather row, and an unknown kind is an error, not a silent drift', () => {
  for (const theme of Object.values(ARENA_THEMES)) if (theme.weather) assert.ok(weatherRow(theme.weather.kind), `${theme.id}: weather ${theme.weather.kind}`);
  assert.throws(() => weatherRow('hail'), /unknown weather "hail"/);
});

test('the blood settings are rows: red plain, dark = dark flag, off = hidden flag; an unknown mode is an error; the helpers read the flags', async () => {
  const { BLOOD_MODES, bloodDark, bloodHidden } = await import('../src/fight/blood-mode.ts');
  assert.deepEqual(Object.keys(BLOOD_MODES), ['red', 'dark', 'off']);
  assert.deepEqual(['red', 'dark', 'off'].map((m) => [bloodDark(m), bloodHidden(m)]), [[false, false], [true, false], [false, true]]);
  assert.throws(() => bloodHidden('crimson'), /unknown blood mode "crimson"/);
});
