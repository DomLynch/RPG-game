// The zone package folders are the one source of truth (docs/specs/zone-package.md, step 2): the shared tables and a package's zone row are BUILD OUTPUT of scripts/gen-packages.mjs, so a hand edit of one fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { type Dirent, mkdtempSync, mkdirSync, cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canon, generate, importFolder, loadRules, NAMED_RULES, readPackages, staleGenerated, writeGenerated } from '../scripts/gen-packages.mjs';
import { exportPackage, roundTrip } from '../scripts/zone-package.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('every committed generated file is what the package folders generate (npm run packages writes them)', () => {
  const out = generate() as unknown as Record<string, string>;
  assert.ok(Object.keys(out).length >= 5, 'the shared tables and each package zone row');
  for (const [file, text] of Object.entries(out)) assert.equal(readFileSync(join(ROOT, file), 'utf8'), text, `stale or hand-edited ${file}: run \`npm run packages\``);
});

test('a hand edit of a generated file is caught, and regenerating repairs it', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pkgs-'));
  try {
    for (const d of ['origins/packages', 'origins/zones', 'origins/zone-rows', 'public/world/kit']) { mkdirSync(join(scratch, d), { recursive: true }); cpSync(join(ROOT, d), join(scratch, d), { recursive: true }); }
    writeGenerated(scratch);
    const file = join(scratch, 'origins/zones/exit-rows.json'), good = readFileSync(file, 'utf8');
    writeFileSync(file, good.replace('"radiusM": 2.5', '"radiusM": 9'));
    assert.notEqual(readFileSync(file, 'utf8'), (generate(scratch) as unknown as Record<string, string>)['origins/zones/exit-rows.json'], 'the edit differs from a fresh generation');
    writeGenerated(scratch);
    assert.equal(readFileSync(file, 'utf8'), good, 'regenerating puts it back');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the import tool refuses a clash unless every id is named in --replace, writes nothing when it refuses, and regenerates identically when it replaces', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pkgimport-'));
  try {
    for (const d of ['origins/packages', 'origins/zones', 'origins/zone-rows', 'origins/presence', 'public/world/kit']) { mkdirSync(join(scratch, d), { recursive: true }); cpSync(join(ROOT, d), join(scratch, d), { recursive: true }); }
    const before = (generate(scratch) as unknown as Record<string, string>)['origins/zones/exit-rows.json'];
    const src = join(scratch, 'incoming'); cpSync(join(scratch, 'origins/packages/crypt-sample'), src, { recursive: true });
    const refused = importFolder(src, scratch) as string[];
    assert.ok(refused.some((p) => /zone "6" already exists/.test(p)) && refused.some((p) => /exit "crypt-door" already exists/.test(p)), refused.join(';'));
    assert.equal(readFileSync(join(scratch, 'origins/zones/exit-rows.json'), 'utf8'), before, 'a refused import writes nothing');
    assert.match((importFolder(src, scratch, new Set(['6', 'crypt-sample', 'crypt-mouth'])) as string[]).join(';'), /exit "crypt-door" already exists/, 'naming some ids does not replace the rest');
    assert.deepEqual(importFolder(src, scratch, new Set(['6', 'crypt-sample', 'crypt-mouth', 'crypt-door'])), []);
    assert.equal(readFileSync(join(scratch, 'origins/zones/exit-rows.json'), 'utf8'), before, 'replacing a package with itself changes nothing');
    writeFileSync(join(src, 'zone.row.json'), '{}');
    assert.match((importFolder(src, scratch, new Set(['6', 'crypt-sample', 'crypt-mouth', 'crypt-door'])) as string[]).join(';'), /does not match its manifest hash/, 'the hash check runs on import too');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

// every file under a folder with its bytes, to prove a refused import changed nothing
const snapshot = (dir: string): Record<string, string> => Object.fromEntries((readdirSync(dir, { recursive: true, withFileTypes: true }) as Dirent[]).filter((e) => e.isFile()).map((e) => { const p = join(e.parentPath, e.name); return [p.slice(dir.length), readFileSync(p, 'utf8')]; }));
const scratchRepo = (): string => { const s = mkdtempSync(join(tmpdir(), 'pkgprobe-')); for (const d of ['origins/packages', 'origins/zones', 'origins/zone-rows', 'origins/presence', 'public/world/kit']) { mkdirSync(join(s, d), { recursive: true }); cpSync(join(ROOT, d), join(s, d), { recursive: true }); } return s; };

test('PROBE: a package whose dungeon names a theme nobody carries is refused and NOTHING is written', () => {
  const root = scratchRepo();
  try {
    const dungeon = { ...(JSON.parse(readPackages(root).find((p: { id: string }) => p.id === 'bone-hollow')!.files['dungeon.row.json']) as object), id: 'probe-dungeon', theme: 'no-such-theme' };
    const zone = { ...JSON.parse(readFileSync(join(root, 'origins/zone-rows/zone5.row.json'), 'utf8')), dungeon: 'probe-dungeon', unlisted: true };
    const made = exportPackage('92', canon(zone), { exits: [], dungeons: [dungeon], themes: [] }) as { files: Record<string, string> };
    const src = join(root, 'incoming'); mkdirSync(src);
    for (const [f, t] of Object.entries(made.files)) writeFileSync(join(src, f), f === 'package.json' ? canon({ ...JSON.parse(t), id: 'probe', unlisted: true }) : t);
    const before = snapshot(join(root, 'origins')), packagesBefore = readdirSync(join(root, 'origins/packages')).sort();
    const refused = importFolder(src, root) as string[];
    assert.ok(refused.some((p) => /uses theme "no-such-theme", which no package carries/.test(p)), refused.join(';'));
    assert.deepEqual(readdirSync(join(root, 'origins/packages')).sort(), packagesBefore, 'no origins/packages/probe folder');
    assert.deepEqual(snapshot(join(root, 'origins')), before, 'no file under origins/ changed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("PROBE: --replace of ANOTHER package's id is refused and NOTHING is written", () => {
  const root = scratchRepo();
  try {
    const src = join(root, 'incoming'); cpSync(join(root, 'origins/packages/crypt-sample'), src, { recursive: true });
    const m = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')); m.id = 'crypt-twin'; m.unlisted = true;   // a second package that claims crypt-sample's zone 6 and rows, and names every one of them in --replace: the validator alone is satisfied, the dry-run generate is not
    writeFileSync(join(src, 'package.json'), canon(m));
    const z = JSON.parse(readFileSync(join(src, 'zone.row.json'), 'utf8')); z.unlisted = true; writeFileSync(join(src, 'zone.row.json'), canon(z));
    const mm = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')); mm.files['zone.row.json'] = { bytes: Buffer.byteLength(canon(z)), sha256: createHash('sha256').update(canon(z)).digest('hex') }; writeFileSync(join(src, 'package.json'), canon(mm));
    const before = snapshot(join(root, 'origins')), packagesBefore = readdirSync(join(root, 'origins/packages')).sort();
    const refused = importFolder(src, root, new Set(['6', 'crypt-sample', 'crypt-mouth', 'crypt-door'])) as string[];
    assert.ok(refused.some((p) => /would leave the packages inconsistent/.test(p)), refused.join(';'));
    assert.deepEqual(readdirSync(join(root, 'origins/packages')).sort(), packagesBefore, 'no origins/packages/crypt-twin folder');
    assert.deepEqual(snapshot(join(root, 'origins')), before, 'no file under origins/ changed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the build CHECKS the generated files and never writes them: a hand edit is reported by name, repaired only by `npm run packages`', () => {
  const root = scratchRepo();
  try {
    writeGenerated(root);
    assert.deepEqual(staleGenerated(root), [], 'clean after generation');
    const file = join(root, 'origins/zone-rows/zone5.row.json'), text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('The Bone Hollow', 'The Bone Hollo'));
    assert.deepEqual(staleGenerated(root), ['origins/zone-rows/zone5.row.json']);
    assert.equal(readFileSync(file, 'utf8').includes('The Bone Hollo"'), true, 'checking changed nothing: the edit is still there');
    const viteConfig = readFileSync(join(ROOT, 'origins/preview/vite.config.mjs'), 'utf8');
    assert.ok(viteConfig.includes('staleGenerated()') && !viteConfig.includes('writeGenerated'), 'the preview build calls the check, not the writer');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the packages here are bone-hollow (zone 5) and crypt-sample (zone 6); a theme two dungeons share is carried once', () => {
  const pkgs = readPackages() as { id: string; files: Record<string, string> }[];
  assert.deepEqual(pkgs.map((p) => p.id), ['bone-hollow', 'crypt-sample']);
  const carried = pkgs.flatMap((p) => (p.files['theme.row.json'] ? [(JSON.parse(p.files['theme.row.json']) as { id: string }).id] : []));
  assert.deepEqual(carried, [...new Set(carried)], 'no theme row is carried twice');
});

test('both packages still round-trip through export and import', () => { for (const n of ['5', '6']) assert.deepEqual(roundTrip(n).problems, [], `zone ${n}`); });

test('every bound is a named, counted row: no unnamed bound, no missing one, none zero', () => {
  const rows = (JSON.parse(readFileSync(join(ROOT, 'origins/zones/package-rules.json'), 'utf8')) as { rules: { id: string; value: number }[] }).rules;
  assert.equal(NAMED_RULES.length, 6); assert.equal(rows.length, NAMED_RULES.length, 'the rows file holds exactly the named rules');   // +6: the import tool's bounds (maxFiles, maxFileBytes, maxExits, maxWarps, maxCreatures, maxRooms), World, deliberate
  assert.deepEqual(Object.keys(loadRules()).sort(), [...NAMED_RULES].sort());
  assert.throws(() => loadRules({ rules: rows.filter((r) => r.id !== 'maxFiles') }), /"maxFiles" rule by name/);
  assert.throws(() => loadRules({ rules: [...rows, { id: 'maxAnything', value: 1 }] }), /not a named rule/);
  assert.throws(() => loadRules({ rules: rows.map((r) => (r.id === 'maxRooms' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadRules({ rules: [...rows, rows[0]] }), /twice/);
});
