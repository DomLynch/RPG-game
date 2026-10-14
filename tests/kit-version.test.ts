// The mob kit's version tag (src/core/world/kit-version.ts): any change to the kit tables changes the tag, and the kit CODE is pinned by its text, like SIM_DIGEST in record-version-guard.test.ts, so a
// behaviour change in code (which no table hash can see) cannot slip through without somebody deciding whether KIT_LOGIC_VERSION must be bumped.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AFTER_HIT_TICKS, CHAIN_CAP, EXHAUSTED_BELOW } from '../src/fight/mobkit.ts';
import { CHAINS, KITS, MODE } from '../src/core/world/kits.ts';
import { KIT_LOGIC_VERSION, kitBuild, kitOfBuild, kitTables, kitTag, kitTagOf } from '../src/core/world/kit-version.ts';

// sha-256 of the text of src/fight/mobkit.ts + src/core/world/kits.ts (in that order). Re-pin when it changes: first decide whether behaviour moved (then bump KIT_LOGIC_VERSION in kit-version.ts), then paste the digest the failure prints.
// Re-pinned 2026-10-14 (World, data-layer day): the KITS and CHAINS tables moved out of kits.ts into mob-kits.json (the kit tag over the same data is unchanged: 1zqmougjnm3 before and after), behaviour did not move, KIT_LOGIC_VERSION stays.
// Re-pinned for the move to src/core/world (core slice 3): only the file path, the import specifier and a comment changed; behaviour did not, KIT_LOGIC_VERSION stays.
// Re-pinned for Combat debt (mobkit AFTER_HIT_TICKS, CHAIN_CAP, EXHAUSTED_BELOW moved to mobkit-defs.json rows): the same numbers, behaviour did not move, KIT_LOGIC_VERSION stays.
const KIT_CODE_DIGEST = '240382752ef31d1a678fdded03261282cdd918489f0d8b58c7546126e39c34ad';

test('the kit code is pinned: a change in src/fight/mobkit.ts or src/core/world/kits.ts forces the KIT_LOGIC_VERSION decision', () => {
  const digest = createHash('sha256').update(readFileSync(new URL('../src/fight/mobkit.ts', import.meta.url))).update(readFileSync(new URL('../src/core/world/kits.ts', import.meta.url))).digest('hex');
  assert.equal(digest, KIT_CODE_DIGEST, `the kit code changed: decide if behaviour moved, bump KIT_LOGIC_VERSION (now ${KIT_LOGIC_VERSION}) in src/core/world/kit-version.ts if so, then re-pin KIT_CODE_DIGEST = '${digest}' in tests/kit-version.test.ts`);
});

test('a changed kit table, mode, constant or logic version is a different tag; the same tables are the same tag', () => {
  const base = kitTables(), tag = kitTagOf(base);
  assert.equal(tag, kitTag());
  assert.equal(kitTagOf(structuredClone(base)), tag, 'a copy of the same tables');
  const brute = KITS.brute.map((row) => ({ ...row }));
  assert.notEqual(kitTagOf({ ...base, KITS: { ...KITS, brute: brute.map((r, i) => (i === 0 ? { ...r, cooldown: r.cooldown + 1 } : r)) } }), tag, 'a cooldown moved');
  assert.notEqual(kitTagOf({ ...base, KITS: { ...KITS, skirmisher: [] } }), tag, 'a kit emptied');
  assert.notEqual(kitTagOf({ ...base, CHAINS: { ...CHAINS, brute: [] } }), tag, 'a chain table emptied');
  assert.notEqual(kitTagOf({ ...base, MODE: { ...MODE, shy: { ...MODE.shy, aggression: -0.3 } } }), tag, 'a mode knob moved');
  assert.notEqual(kitTagOf({ ...base, AFTER_HIT_TICKS: AFTER_HIT_TICKS + 1 }), tag);
  assert.notEqual(kitTagOf({ ...base, CHAIN_CAP: CHAIN_CAP + 1 }), tag, 'the mob chain length (now a row in mobkit-defs.json, so the code digest cannot see it)');
  assert.notEqual(kitTagOf({ ...base, EXHAUSTED_BELOW: EXHAUSTED_BELOW + 1 }), tag);
  assert.notEqual(kitTagOf({ ...base, logic: KIT_LOGIC_VERSION + 1 }), tag, 'the logic version');
  assert.equal(kitTagOf({ b: 1, a: 2 }), kitTagOf({ a: 2, b: 1 }), 'key order does not matter');
});

test('the build string carries the tag and reads back; anything else reads as none', () => {
  assert.equal(kitOfBuild(kitBuild('origins-preview')), kitTag());
  assert.match(kitBuild('origins-preview'), /^origins-preview kit:[0-9a-z]+$/);
  for (const bad of ['origins-preview', 'kit:', 'xkit:abc', 'origins-preview kit:ABC', 'a kit:abc d']) assert.equal(kitOfBuild(bad), null, bad);
});
