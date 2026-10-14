import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZONE_CM } from '../origins/server/location.ts';

test('location bounds: ZONE_CM is exactly the bound of the saved x/z columns (migration 202610070009), so the code refuses what the database refuses', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610070009_origins_character_location.sql', import.meta.url), 'utf8');
  const bounds = ['x', 'z'].map((c) => Number(new RegExp(`${c} int not null check \\(${c} between 0 and (\\d+)\\)`).exec(sql)?.[1]));
  assert.deepEqual(bounds, [ZONE_CM, ZONE_CM]);
});
