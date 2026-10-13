// Arena vocabularies as rows (src/fight/arena-defs.json, loaded and checked by the registry loader). Weather: what each kind does is a row of flags
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

test('the foot-dust tone comes from the floor row: for every theme it equals what the old floor-name branches picked, and the tone rows keep the old colours', async () => {
  const { dustToneFor } = await import('../src/fight/foot-dust.ts');
  const { DUST_TONES, FLOOR_ROWS } = await import('../src/arena-rows.ts');
  const old = (t: { textures: { floor: string }; wet?: number }) => t.textures.floor === 'clay' ? 'clay' : t.textures.floor !== 'sand' || t.wet !== undefined ? 'stone' : 'sand';
  for (const theme of Object.values(ARENA_THEMES)) assert.equal(dustToneFor(theme), old(theme), `${theme.id}: ${theme.textures.floor}${theme.wet !== undefined ? ' wet' : ''}`);
  assert.deepEqual(Object.entries(DUST_TONES).map(([k, v]) => [k, v.color, v.opacity]), [['sand', '#b99a68', 0.6], ['stone', '#7a7062', 0.36], ['clay', '#2a1c1a', 0.4]]);
  assert.deepEqual(Object.keys(FLOOR_ROWS), ['sand', 'flag', 'clay']);
  assert.throws(() => dustToneFor({ textures: { floor: 'lava' } }), /unknown floor "lava"/);
});

test('floor patches are rows: only puddle is water; every theme patch and floor-default patch names a row; the old puddle compare is gone', async () => {
  const { PATCH_ROWS, patchRow } = await import('../src/arena-rows.ts');
  assert.deepEqual(Object.entries(PATCH_ROWS).filter(([, v]) => v.water).map(([k]) => k), ['puddle']);
  assert.deepEqual(Object.keys(PATCH_ROWS), ['sand', 'flag', 'clay', 'puddle', 'blood']);
  for (const theme of Object.values(ARENA_THEMES)) { const kind = theme.textures.patch ?? (theme.textures.floor !== 'sand' ? theme.textures.floor : undefined); if (kind) assert.ok(patchRow(kind), `${theme.id}: patch ${kind}`); }
  assert.throws(() => patchRow('lava'), /unknown floor patch "lava"/);
});
