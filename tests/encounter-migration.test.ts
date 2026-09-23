// Every roster id must be allowed by the newest fighter_profiles encounter migration, or a player who reaches that rung fails cloud
// sync (the CHECK constraint rejects the row). Added with the Plague Doctor (2026-09-23), whose row nearly shipped without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ROSTER } from '../src/roster.ts';

test('every roster id is in the newest encounter allowlist migration', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const newest = readdirSync(dir).filter(f => readFileSync(new URL(f, dir), 'utf8').includes('fighter_profiles_encounter_check')).sort().at(-1)!;
  const sql = readFileSync(new URL(newest, dir), 'utf8');
  const allowed = new Set([...sql.slice(sql.indexOf('check (encounter in')).matchAll(/'([a-z]+)'/g)].map(m => m[1]));
  for (const id of Object.keys(ROSTER)) assert.ok(allowed.has(id), `${id} is missing from ${newest}`);
  // Backend's condition on 202609230002: the list IS the roster, spelled as its keys, so no stale or misspelt id stays allowed either.
  assert.deepEqual([...allowed].sort(), Object.keys(ROSTER).sort(), `${newest} allows ids that are not roster keys`);
});
