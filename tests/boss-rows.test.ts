// The boss presentation table (src/fight/bosses.json + manifest, read by boss-rows.ts): the rows are well-formed, every verb id on a row names a real code verb, each row
// agrees with Combat's special table, the registry/cue/class-skill/BossKind derivations match what the hand-written lists were, and a new boss over an existing fx is ONE row.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { BOSSES, classSkillOf, kindsOf } from '../src/fight/boss-rows.ts';
import { FX_VERBS, SPECIAL_MODES, TRAVEL_VERBS } from '../src/fight/special-modes.ts';
import { bossSpecialId } from '../src/fight/special-identity.ts';
import { specialOf } from '../src/fight/moves.ts';
import { SPECIAL_CUES, SPECIAL_CUE_OF } from '../src/fight/sound/special.ts';
import { SPECIAL_TESTS } from '../src/fight/special-look.ts';
import { checkTables, tableFromFile, type Manifest } from '../src/core/registry.ts';
import { BOSS_KINDS, bossLook, isExecutionerCast } from '../src/fight/special-fx-executioner.ts';
import { isBossCast } from '../src/fight/special-boss-timing.ts';
import { ROSTER } from '../src/roster.ts';

const manifest = JSON.parse(readFileSync('src/fight/bosses.manifest.json', 'utf8')).tables[0] as { key: string; required: Record<string, string> };

test('every boss row has the manifest fields with the right types, ids are unique, ranks are 8-10', () => {
  assert.equal(manifest.key, 'id');
  for (const r of BOSSES as readonly Record<string, unknown>[]) for (const [f, t] of Object.entries(manifest.required)) {
    assert.equal(t === 'integer' ? Number.isInteger(r[f]) : typeof r[f], t === 'integer' ? true : t, `${r.id}.${f}`);
  }
  assert.equal(new Set(BOSSES.map((r) => r.id)).size, BOSSES.length);
  assert.equal(BOSSES.length, 12);
  for (const r of BOSSES) assert.ok(r.rank >= 8 && r.rank <= 10, r.id);
});

test('fx, at, travel and cue are verb ids checked against the code registries (a bad id is a gate error)', () => {
  for (const r of BOSSES) {
    assert.ok(Object.hasOwn(FX_VERBS, r.fx), `${r.id}: fx ${r.fx}`);
    assert.ok(r.at === 'feet' || r.at === 'head', `${r.id}: at`);
    if (r.travel !== undefined) assert.ok(Object.hasOwn(TRAVEL_VERBS, r.travel), `${r.id}: travel ${r.travel}`);
    assert.ok((SPECIAL_CUES as readonly string[]).includes(r.cue), `${r.id}: cue ${r.cue}`);
    assert.ok(Object.hasOwn(ROSTER, r.opponent), `${r.id}: opponent ${r.opponent}`);
    assert.ok(Object.hasOwn(SPECIAL_TESTS, r.id), `${r.id}: a ?special= preview`);
    if (r.fx === 'executioner') assert.ok(r.look, `${r.id}: an executioner row carries its look`);
  }
});

test('each row agrees with Combat\'s special table: (opponent, rank) is the special that resolves to the row id', () => {
  for (const r of BOSSES) assert.equal(bossSpecialId(specialOf(r.opponent as never, 36 + (r.rank - 8) * 5)), r.id, `${r.opponent} rank ${r.rank}`);
});

test('the derivations equal the lists they replaced (presentation only: the registry, cues, class skills, kinds, looks)', () => {
  assert.deepEqual([...BOSS_KINDS], ['arawn', 'thanatos', 'reaper']);
  assert.deepEqual([...kindsOf('boss')], ['mist', 'echo', 'price', 'flies', 'stain', 'breath', 'sling', 'haze', 'storm']);
  const lift: Record<string, number> = { arawn: -0.06, thanatos: -0.14, reaper: -0.1 };
  for (const r of BOSSES) {
    const m = SPECIAL_MODES[r.id as keyof typeof SPECIAL_MODES]!;
    assert.equal(m.at, 'feet', r.id);
    assert.equal(m.lift, r.fx === 'executioner' ? lift[r.id] : -0.28, r.id);
    assert.equal(m.hideTrail, r.fx === 'boss' ? true : undefined, r.id);
    assert.equal(typeof m.travel, r.id === 'echo' ? 'function' : 'undefined', r.id);
  }
  assert.deepEqual(['arawn', 'thanatos', 'reaper', 'mist', 'echo', 'price', 'flies', 'stain', 'breath', 'sling', 'haze', 'storm'].map((id) => SPECIAL_CUE_OF[id]),
    ['baying', 'longshadow', 'harvest', 'avalon', 'foretold', 'theprice', 'plagueflies', 'poisonstain', 'lastbreath', 'thesling', 'wrath', 'storm']);
  assert.deepEqual([classSkillOf('boss', 'witch'), classSkillOf('boss', 'plaguedoctor'), classSkillOf('boss', 'knight'), classSkillOf('executioner', 'executioner')], ['skill_witchfire', 'skill_miasma', 'skill_ironrush', 'skill_reaping']);
  assert.ok(isBossCast('knight', 1, 'skill_ironrush') && !isBossCast('knight', 0, 'skill_ironrush') && !isBossCast('executioner', 1, 'skill_reaping'));
  assert.ok(isExecutionerCast('executioner', 1, 'skill_reaping'));
  const c = (k: string, e: number) => { const l = bossLook(k, e); return [l.core.r, l.core.g, l.core.b, l.edge.r, l.edge.g, l.edge.b]; };
  assert.deepEqual(c('arawn', 1), [0.1, 0.055, 0.04, 0.2, 0.12, 0.08]); assert.deepEqual(c('thanatos', 2), [0.003, 0.002, 0.002, 0.012, 0.009, 0.007]); assert.deepEqual(c('reaper', 1), [0.09, 0.055, 0.04, 0.2, 0.13, 0.09]);
});

test('a new boss over an existing fx verb is ONE row: no code edit, and its registry entry, cue, class skill and kind all appear', () => {
  const rows = JSON.parse(readFileSync('src/fight/bosses.json', 'utf8')) as Record<string, unknown>[];
  const extra = { ...rows.find((r) => r.id === 'storm'), id: 'testboss', rank: 10 };
  const dir = mkdtempSync(`${tmpdir()}/boss-row-`);
  try {
    const data = `${dir}/bosses.json`, hook = `${dir}/hook.mjs`, probe = `${dir}/probe.ts`;
    writeFileSync(data, JSON.stringify([...rows, extra]));
    writeFileSync(hook, `export async function resolve(s, c, next) { return s.endsWith('bosses.json') ? { url: ${JSON.stringify(pathToFileURL(data).href)}, shortCircuit: true } : next(s, c); }\n`);
    writeFileSync(probe, `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(hook).href)});\nconst m = await import(${JSON.stringify(pathToFileURL('src/fight/special-modes.ts').href)});\nconst s = await import(${JSON.stringify(pathToFileURL('src/fight/sound/special.ts').href)});\nconst b = await import(${JSON.stringify(pathToFileURL('src/fight/boss-rows.ts').href)});\nconsole.log(JSON.stringify({ at: m.SPECIAL_MODES.testboss.at, lift: m.SPECIAL_MODES.testboss.lift, cue: s.SPECIAL_CUE_OF.testboss, kinds: b.kindsOf('boss') }));\n`);
    const out = JSON.parse(execFileSync(process.execPath, [probe], { encoding: 'utf8' }).trim().split('\n').pop()!) as { at: string; lift: number; cue: string; kinds: string[] };
    assert.deepEqual([out.at, out.lift, out.cue], ['feet', -0.28, 'storm']);
    assert.equal(out.kinds.at(-1), 'testboss');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('every row has an effect maker that builds (an fx boss kind with no maker would throw at load)', async () => {
  const { createBossSpecial } = await import('../src/fight/special-fx-boss.ts');
  const { createExecutionerSpecial } = await import('../src/fight/special-fx-executioner.ts');
  for (const r of BOSSES) {
    if (r.fx === 'boss') assert.doesNotThrow(() => createBossSpecial(new THREE.Scene(), r.opponent as never, r.id, 1), r.id);
    else assert.doesNotThrow(() => createExecutionerSpecial(new THREE.Scene(), 'executioner', r.id, bossLook(r.id, 1)), r.id);
  }
});

const MANIFEST = JSON.parse(readFileSync('src/fight/bosses.manifest.json', 'utf8')).tables[0] as Manifest;

test('SPECIAL_TESTS (hand-written, sim side) carries each boss row: opponent and level = 36 + 5 * (rank - 8); the sim never imports the rows', () => {
  for (const r of BOSSES) assert.deepEqual((SPECIAL_TESTS as Record<string, unknown>)[r.id], { opponent: r.opponent, level: 36 + (r.rank - 8) * 5, first: 180 }, r.id);
});

test('the shared loader gates the table: the rows are clean, and a duplicate id, a missing field or a wrong type is a problem, never last-wins', () => {
  const file = JSON.parse(readFileSync('src/fight/bosses.json', 'utf8')) as Record<string, unknown>[];
  const rules = (rows: unknown) => checkTables([tableFromFile(MANIFEST, rows)]).problems.map((p) => p.rule).sort().join(',');
  assert.equal(rules(file), '');
  assert.equal(rules([...file, file[0]]), 'duplicate-id');
  assert.equal(rules([{ ...file[0], cue: undefined }]), 'missing-field');
  assert.equal(rules([{ ...file[0], rank: '8' }]), 'wrong-type');
});
