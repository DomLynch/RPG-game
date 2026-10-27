// The import tool's gate (Strategy's rules, docs/specs/zone-package.md): validatePackage refuses what a package may not do.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canon, loadRules, readPackages, validatePackage } from '../scripts/gen-packages.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Files = Record<string, string>;
const bone = () => ((readPackages() as { id: string; files: Files }[]).find((p) => p.id === 'bone-hollow')!).files;
const empty = () => ({ zones: new Set<string>(), exits: new Set<string>(), dungeons: new Set<string>(), themes: new Set<string>(), warps: new Set<string>() });
const ctx = (over: Record<string, unknown> = {}) => ({ rules: loadRules(), mode: 'import', existing: empty(), replace: new Set<string>(), publicHas: (u: string) => existsSync(`${ROOT}public${u}`), ...over });
// rewrite a file and keep the manifest honest about it, so a test fails only for the rule it names
const edit = (files: Files, name: string, text: string): Files => {
  const m = JSON.parse(files['package.json']!); m.files[name] = { bytes: Buffer.byteLength(text), sha256: sha(text) };
  return { ...files, [name]: text, 'package.json': canon(m) };
};
const problems = (files: Files, c = ctx()) => validatePackage(files, c) as string[];

// bone-hollow is a LISTED zone, so as a NEW package it would be refused: this makes it the unlisted package a real import must be
const unlisted = (v: boolean | undefined): Files => {
  const z = JSON.parse(bone()['zone.row.json']!); delete z.unlisted; if (v !== undefined) z.unlisted = v;
  const withZone = edit(bone(), 'zone.row.json', canon(z)), m = JSON.parse(withZone['package.json']!); m.unlisted = v === true;
  return { ...withZone, 'package.json': canon(m) };
};

test('a package as exported passes in generate mode, and an unlisted one passes as a new import', () => {
  assert.deepEqual(problems(bone(), ctx({ mode: 'generate' })), []);
  assert.deepEqual(problems(unlisted(true)), []);
});

test('a package may be zone 0 (the town, Dom 2026-10-22): a whole number from 0; -1 and 1.5 are refused', () => {
  const zoned = (zone: number): Files => { const m = JSON.parse(bone()['package.json']!); m.zone = zone; return { ...bone(), 'package.json': canon(m) }; };
  assert.equal(problems(zoned(0), ctx({ mode: 'generate' })).some((p) => /manifest zone must/.test(p)), false, 'zone 0 passes the zone-number rule');
  for (const bad of [-1, 1.5]) assert.match(problems(zoned(bad), ctx({ mode: 'generate' })).join(';'), /manifest zone must be a whole number from 0/, String(bad));
});

test('the manifest hash check is mandatory: a changed file, a missing file and an unlisted extra file are all refused', () => {
  const f = bone();
  assert.match(problems({ ...f, 'dungeon.row.json': f['dungeon.row.json']!.replace('Bone Hollow', 'Bone Hollo') }, ctx({ mode: 'generate' })).join(';'), /"dungeon.row.json" does not match its manifest hash/);
  const { 'theme.row.json': _gone, ...without } = f; void _gone;
  assert.match(problems(without, ctx({ mode: 'generate' })).join(';'), /lists "theme.row.json" but it is not in the package/);
  assert.match(problems({ ...f, 'warps.json': '[]' }, ctx({ mode: 'generate' })).join(';'), /"warps.json" is in the package but not in the manifest/);
  assert.match(problems({ ...f, 'package.json': '{' }, ctx({ mode: 'generate' })).join(';'), /package.json is missing or not JSON/);
});

test('a path outside the package folder is refused: only the five known file names', () => {
  const f = bone();
  for (const name of ['../zone.row.json', 'sub/zone.row.json', '/etc/passwd', 'evil.ts']) {
    const text = '{}', m = JSON.parse(f['package.json']!); m.files[name] = { bytes: 2, sha256: sha(text) };
    assert.match(problems({ ...f, [name]: text, 'package.json': canon(m) }, ctx({ mode: 'generate' })).join(';'), /is not an allowed package file name/, name);
  }
});

test('an asset outside public/, a remote url and a missing file are refused', () => {
  const zone = JSON.parse(bone()['zone.row.json']!);
  for (const url of ['https://example.com/kit.glb', '//cdn.example.com/kit.glb', '/world/../../etc/passwd', 'file:///etc/passwd', '/src/main.ts', '/world/kit/not-there.glb']) {
    const f = edit(bone(), 'zone.row.json', canon({ ...zone, kit: { ...zone.kit, url } }));
    assert.match(problems(f, ctx({ mode: 'generate' })).join(';'), /asset ".*" is not a (local path under \/world\/ or \/arena\/|file under public\/)/, url);
  }
});

test('a new package imports unlisted; an existing zone number is not new', () => {
  assert.match(problems(unlisted(undefined)).join(';'), /imports unlisted/);
  assert.match(problems(unlisted(false)).join(';'), /imports unlisted/);
  assert.deepEqual(problems(unlisted(true)), []);
  assert.doesNotMatch(problems(unlisted(undefined), ctx({ existing: { ...empty(), zones: new Set(['5']) }, replace: new Set(['5']) })).join(';'), /imports unlisted/, 'replacing an existing zone keeps what it is');
});

test('a replace is explicit per id: a clash is refused unless that id is named', () => {
  const m = JSON.parse(bone()['package.json']!), taken = { ...empty(), zones: new Set(['5']), dungeons: new Set(['bone-hollow']), themes: new Set(['bone-camp']), exits: new Set(['hollow-gate', 'cave-mouth']) };
  const all = problems(bone(), ctx({ existing: taken, mode: 'generate' })).join(';');
  for (const what of ['zone "5"', 'dungeon "bone-hollow"', 'theme "bone-camp"', 'exit "hollow-gate"', 'exit "cave-mouth"']) assert.match(all, new RegExp(`${what} already exists`), what);
  assert.deepEqual(problems(bone(), ctx({ existing: taken, mode: 'generate', replace: new Set(['5', 'bone-hollow', 'bone-camp', 'hollow-gate', 'cave-mouth']) })), []);
  assert.match(problems(bone(), ctx({ existing: taken, mode: 'generate', replace: new Set(['5', 'bone-hollow', 'bone-camp', 'hollow-gate']) })).join(';'), /exit "cave-mouth" already exists/, 'naming some ids does not replace the others');
  void m;
});

test('every bound is a row: more exits, rooms, creatures or bytes than the rows allow is refused', () => {
  const f = bone(), rules = loadRules() as Record<string, number>, ex = JSON.parse(f['exits.json']!), d = JSON.parse(f['dungeon.row.json']!);
  const manyExits = { owned: Array.from({ length: rules.maxExits + 1 }, (_, i) => ({ ...ex.owned[0], id: `x${i}` })), inbound: [] };
  const withOwns = (files: Files, owns: Record<string, unknown>) => { const m = JSON.parse(files['package.json']!); m.owns = { ...m.owns, ...owns }; return { ...files, 'package.json': canon(m) }; };
  assert.match(problems(withOwns(edit(f, 'exits.json', canon(manyExits)), { exits: manyExits.owned.map((e: { id: string }) => e.id) }), ctx({ mode: 'generate' })).join(';'), /more than 64 exit rows/);
  assert.match(problems(edit(f, 'dungeon.row.json', canon({ ...d, rooms: Array.from({ length: rules.maxRooms + 1 }, (_, i) => ({ ...d.rooms[0], id: `r${i}` })) })), ctx({ mode: 'generate' })).join(';'), /more than 64 rooms/);
  assert.match(problems(edit(f, 'dungeon.row.json', canon({ ...d, creatures: Array.from({ length: rules.maxCreatures + 1 }, (_, i) => ({ ...d.creatures[0], id: `c${i}` })) })), ctx({ mode: 'generate' })).join(';'), /more than 64 creature rows/);
  assert.match(problems(edit(f, 'dungeon.row.json', canon({ ...d, pad: 'x'.repeat(rules.maxFileBytes) })), ctx({ mode: 'generate' })).join(';'), /is over the bound of 262144 bytes/);
  assert.match(problems(f, ctx({ mode: 'generate', rules: { ...rules, maxFiles: 2 } })).join(';'), /files is over the bound of 2/);
});

test('exit and manifest ownership must agree with the files', () => {
  const f = bone(), ex = JSON.parse(f['exits.json']!);
  const swapped = edit(f, 'exits.json', canon({ owned: ex.inbound, inbound: ex.owned }));
  const r = problems(swapped, ctx({ mode: 'generate' })).join(';');
  assert.match(r, /is not a world zone of the package|goes to .* not to this zone|stands inside the package/);
  const bad = JSON.parse(f['package.json']!); bad.owns.dungeon = 'other';
  assert.match(problems({ ...f, 'package.json': canon(bad) }, ctx({ mode: 'generate' })).join(';'), /owns\.dungeon does not match/);
  const noField = edit(f, 'exits.json', canon({ ...ex, owned: [{ ...ex.owned[0], radiusM: 'wide' }] }));
  assert.match(problems(noField, ctx({ mode: 'generate' })).join(';'), /field "radiusM" must be a number/);
});
