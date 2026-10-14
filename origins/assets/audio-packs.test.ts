// Audio-pack manifest (top-30 #30): CC0 only, every link is https, every target is a live cue, zone or spell school. Data only: nothing is downloaded by this file or the manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/registry.ts';
import { MANIFEST as SPRITE } from '../../src/audio/manifest.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
type Pack = { pageUrl: string; licence: string; licenceUrl: string; licenceEvidence: string; status: string; files: { name: string; url: string; bytes: number | null; note?: string }[] };
type Need = { kind: string; target: string; packs: string[] };
const DATA = read('./audio-packs.json') as { packs: Record<string, Pack>; needs: Record<string, Need> };
const MANIFEST = read('./audio-packs.manifest.json') as { tables: Manifest[] };
const SCHOOLS = (read('../../src/fight/school-defs.json') as { schools: { id: string }[] }).schools.map((s) => s.id);
const ZONES = [1, 2, 3, 4].map((n) => `zone${n}`);
const UI_TARGETS = ['ui-tap', 'ui-confirm', 'ui-back'];

test('audio packs: rows load with the shared loader and every ref resolves', () => {
  assert.ok(loadRegistry(MANIFEST.tables.map((m) => tableFromFile(m, DATA))));
});

test('audio packs: a pack that can be pulled is CC0 with an https licence link, a size per file, and was read on its own page', () => {
  for (const [id, p] of Object.entries(DATA.packs)) {
    assert.ok(p.pageUrl.startsWith('https://'), id);
    assert.ok(p.licenceUrl.startsWith('https://'), id);
    assert.ok(p.licenceEvidence.includes('checked 2026-10-13'), `${id}: say where and when the licence was read`);
    if (p.status === 'listed') {
      assert.equal(p.licence, 'CC0-1.0', `${id}: only CC0 or public domain may be listed`);
      assert.ok(p.files.length >= 1, `${id}: list its files`);
    } else { assert.equal(p.status, 'hold-licence'); assert.notEqual(p.licence, 'CC0-1.0', `${id}: a CC0 pack is not held`); }
    for (const f of p.files) {
      assert.ok(f.url.startsWith('https://'), `${id}/${f.name}`);
      if (p.status === 'listed') assert.ok(Number.isInteger(f.bytes) && f.bytes! > 0, `${id}/${f.name}: a listed file has its size`);
      else assert.ok(f.bytes === null && typeof f.note === 'string', `${id}/${f.name}: a held file is not sized and says why`);
    }
  }
});

test('audio packs: a need always has a pullable pack beside any held one', () => {
  for (const [id, n] of Object.entries(DATA.needs)) assert.ok(n.packs.some((p) => DATA.packs[p]!.status === 'listed'), `${id}: needs at least one pullable pack`);
});

test('audio packs: cue, zone, school and ui targets are live ids, and every zone and every school has a need', () => {
  const needs = Object.entries(DATA.needs);
  for (const [id, n] of needs) {
    if (n.kind === 'combat-cue') assert.ok(Object.hasOwn(SPRITE, n.target), `${id}: ${n.target} is not a sprite cue`);
    if (n.kind === 'zone-ambience') assert.ok(ZONES.includes(n.target), `${id}: ${n.target} is not a zone`);
    if (n.kind === 'spell-school') assert.ok(SCHOOLS.includes(n.target), `${id}: ${n.target} is not a school`);
    if (n.kind === 'ui-click') assert.ok(UI_TARGETS.includes(n.target), `${id}: ${n.target}`);
  }
  for (const z of ZONES) assert.ok(needs.some(([, n]) => n.kind === 'zone-ambience' && n.target === z), `${z} has no ambience need`);
  for (const s of SCHOOLS) assert.ok(needs.some(([, n]) => n.kind === 'spell-school' && n.target === s), `${s} has no spell need`);
  for (const t of UI_TARGETS) assert.ok(needs.some(([, n]) => n.kind === 'ui-click' && n.target === t), `${t} has no need`);
  for (const c of ['hit_flesh', 'hit_heavy', 'block', 'parry', 'crowd_cheer']) assert.ok(needs.some(([, n]) => n.target === c), `${c} has no need`);
});
