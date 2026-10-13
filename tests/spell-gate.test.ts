// The one spell gate (origins/server/spell-gate.ts): every settle path that replays a record calls it before it pays. A new replay entry that forgets it would pay a forged skill-100 spell record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spellRefusal } from '../origins/server/spell-gate.ts';

const stored = { placed: { wind: 10 } }, owns: { grimoire: Record<string, unknown>; xp: Record<string, number> } = { grimoire: { alvis: {} }, xp: { wind: 500 } };   // the ceiling in wind is 5
const load = (held = owns, build: { placed: Record<string, number> } | null = stored) => ({ held: async () => held, build: async () => build });
const rec = { spell: { id: 'alvis', skill: 5 }, characterId: 'one', buildVersion: 1 };

test('spellRefusal: no spell is untouched; owned and within the ceiling passes; unowned, inflated, unknown, out of range and buildless are refused', async () => {
  assert.equal(await spellRefusal({}, 'u1', load()), null);
  assert.equal(await spellRefusal(rec, 'u1', load()), null);
  assert.match(String(await spellRefusal({ ...rec, spell: { id: 'alvis', skill: 6 } }, 'u1', load())), /casts at 6, past the 5/);
  assert.match(String(await spellRefusal(rec, 'u1', load({ grimoire: {}, xp: owns.xp }))), /not in this account's grimoire/);
  assert.match(String(await spellRefusal({ ...rec, spell: { id: 'nope', skill: 0 } }, 'u1', load())), /is no spell/);
  assert.match(String(await spellRefusal({ ...rec, spell: { id: 'alvis', skill: 101 } }, 'u1', load())), /0 to 100/);
  assert.match(String(await spellRefusal({ spell: rec.spell }, 'u1', load())), /names no stored build/);
  assert.match(String(await spellRefusal(rec, 'u1', load(owns, null))), /stored build is unknown/);
});

// Every file that replays a FightRecord to pay or mark it must ask the gate. encounter.ts asks expectedSpell (the same checkSpell); the sweeps ask spellRefusal. The files below replay and pay nothing, or replay a different record format.
const NO_PAYOUT: Record<string, string> = {
  'scripts/kill-link-check.mjs': 'a determinism gate over its own recordings; pays and marks nothing',
  'origins/server/world-spawns.ts': 'world kills ride a WorldRecord (world-record.ts), which has no spell block',
};
test('guard: every replay entry that accepts a v53 record calls the spell gate', () => {
  const ROOT = new URL('../', import.meta.url).pathname;
  const files = ['scripts', 'origins/server'].flatMap((d) => readdirSync(join(ROOT, d), { recursive: true }).map(String).map((f) => join(d, f))).filter((f) => /\.(mjs|ts)$/.test(f) && !/\.test\./.test(f));
  const replays = files.filter((f) => /\b(verifyRecord|verifyEncounter)\(/.test(readFileSync(join(ROOT, f), 'utf8')) && !/export function verifyEncounter/.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.ok(replays.includes('scripts/verify-loot.mjs') && replays.includes('scripts/verify-daily.mjs'), `the sweeps are found: ${replays.join(', ')}`);
  for (const f of replays) if (!NO_PAYOUT[f]) assert.match(readFileSync(join(ROOT, f), 'utf8'), /spellRefusal\(|expectedSpell\(/, `${f} replays a record but never asks the spell gate (origins/server/spell-gate.ts)`);
  assert.match(readFileSync(join(ROOT, 'origins/server/encounter.ts'), 'utf8'), /expectedSpell\(/, 'the encounter settle asks the same checkSpell');
  for (const f of Object.keys(NO_PAYOUT)) assert.ok(files.includes(f), `${f} is gone: drop it from NO_PAYOUT`);
});
