// Specials as data: the Pitborn's rank 8-10 specials are rows of src/fight/special-defs.json over the module's template verbs. The drawn effect is
// byte-identical to the code it replaced, a special is one row, and the loader refuses a broken row at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PITBORN_KINDS, PITBORN_TEMPLATES, createPitbornSpecial, isPitbornSpecial } from '../src/fight/special-fx-pitborn.ts';
import { loadSpecialDefs, specialFamily, type SpecialRow } from '../src/fight/special-rows.ts';
import { LAND_AT } from '../src/fight/special-timing.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { isOpponentId } from '../src/roster.ts';
import type { Manifest } from '../src/core/registry.ts';
import type { CombatEvent, Fighter } from '../src/fight/duel.ts';
import { duplicateKeys } from '../scripts/lib/json-dup-keys.mjs';

const text = readFileSync(new URL('../src/fight/special-defs.json', import.meta.url), 'utf8');
const raw = JSON.parse(text) as { specials: Record<string, unknown>[] };
const manifest = (JSON.parse(readFileSync(new URL('../src/fight/special-defs.manifest.json', import.meta.url), 'utf8')) as { tables: Manifest[] }).tables[0]!;
const load = (rows: unknown[]) => specialFamily(loadSpecialDefs({ specials: rows }, manifest), 'pitborn', PITBORN_TEMPLATES);

const fighters = [{ special: 0 }, { special: 0, skill: 'cleave' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_cleave' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_cleave', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const DAY = ARENA_THEMES['1'].exposure, PIT = 1.85;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

// Every object of the effect, every tick of a full cast (start, landing, 240 ticks after), plus every texture's pixels: one sha256 per kind and arena.
function sceneHash(kind: string | SpecialRow, exposure: number): string {
  const h = createHash('sha256'), scene = new THREE.Scene(), fx = createPitbornSpecial(scene, 'pitborn', kind, exposure), tex = new Set<THREE.Texture>();
  for (let t = 0; t <= LAND_AT + 240; t++) {
    fx.render(1 / 60, t === 1 ? [started] : t === LAND_AT ? [landed(t)] : [], fighters, t, feet, false);
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.MeshBasicMaterial & { depthTest: boolean }) | undefined;
      if (m?.map) tex.add(m.map);
      h.update(`${o.name}|${o.visible}|${o.position.toArray().map(r6)}|${o.quaternion.toArray().map(r6)}|${o.scale.toArray().map(r6)}|${m ? `${r6(m.opacity)}|${m.color?.getHexString()}|${m.depthTest}|${o.renderOrder}` : ''};`);
    });
  }
  for (const t of tex) { const d = (t.image as { data?: Uint8Array } | undefined)?.data; if (d) h.update(createHash('sha256').update(Buffer.from(d.buffer)).digest('hex')); }
  return h.digest('hex');
}

// Computed on trunk 411fbdf31 BEFORE the rows existed (the same sweep, on the code's own constants): per kind, day sand then the Night Pit.
const BEFORE: Record<string, [string, string]> = {
  antaeus: ['ac8f957aa4cef053872be6f08fbc612401575db5284b02283dc12d02ac96f233', 'ea85bc6720f4c3b298cd16ad568251fdaaec1de591f44095b982c54bd9a79985'],
  surtr: ['76b08ae957b39fb65f566c0cc14a1ff04a4cd25c7eaa16940db00a9a5af15de4', '8e14ed9e6731b0d4c429b20131ba4e6d159ebf0a6594ac9d61f7df891f850228'],
  typhon: ['9ec6a84230ccab60405976f3c3501e5deff047c87763df179416c503665586ca', '8add11043058aeb7fe5dcc2626ff705846410a8a573e09acf5fb7e6cac524e8f'],
};

test('the Pitborn specials drawn from their rows are byte-identical to the code they replaced (every object, every tick, every texture; day and Night Pit)', () => {
  assert.deepEqual([...PITBORN_KINDS], ['antaeus', 'surtr', 'typhon']);
  for (const kind of PITBORN_KINDS) assert.deepEqual([sceneHash(kind, DAY), sceneHash(kind, PIT)], BEFORE[kind], kind);
});

test('the rows file has no duplicate key; every row names a real opponent, and a Pitborn row draws the cast his own test draws', () => {
  assert.deepEqual(duplicateKeys(text), [], 'JSON.parse keeps the last of two equal keys silently');
  for (const row of raw.specials) assert.ok(isOpponentId(row.opponent), `${String(row.id)}: ${String(row.opponent)} is an opponent`);
  for (const row of load(raw.specials)) for (const o of ['pitborn', 'veteran']) for (const actor of [0, 1]) for (const move of ['skill_cleave', 'skill_lunge', undefined])
    assert.equal(o === row.opponent && actor === row.cast.actor && move === row.cast.move, isPitbornSpecial(o as 'pitborn', actor, move), `${row.id} ${o} ${actor} ${move}`);
});

test('a fourth Pitborn special is ONE row naming an existing template, through the real loader, with no code edit', () => {
  const row = { id: 'ymir', family: 'pitborn', template: 'ashfall', opponent: 'pitborn', cast: { actor: 1, move: 'skill_cleave' },
    params: { flakes: 60, patches: 3, smoke: 4, patchAlpha: { day: 0.6, night: 0.3 }, smokeAlpha: { day: 0.4, night: 0.25 }, flakeAlpha: { day: 0.5, night: 0.3 } } };
  const rows = load([...raw.specials, row]), ymir = rows.find((r) => r.id === 'ymir')!;
  assert.equal(rows.length, 4);
  const scene = new THREE.Scene(), fx = createPitbornSpecial(scene, 'pitborn', ymir, PIT), root = scene.getObjectByName('special fx')!;
  assert.equal(root.children.filter((o) => o.name.startsWith('flake')).length, 60, 'its own counts');
  let top = 0;
  for (let t = 0; t <= LAND_AT + 60; t++) {
    fx.render(1 / 60, t === 1 ? [started] : t === LAND_AT ? [landed(t)] : [], fighters, t, feet, false);
    top = Math.max(top, ...root.children.map((o) => (o.visible ? ((o as THREE.Mesh).material as THREE.Material).opacity : 0)));
  }
  assert.ok(top > 0.1 && top <= 0.3 + 1e-9, `drawn, under its own Night Pit ceiling (${top})`);
  assert.notEqual(sceneHash(ymir, DAY), sceneHash('surtr', DAY), 'its parameters, not Surtr\'s');
});

test('the loader refuses a duplicate id, a missing field, a template the module does not draw and a missing param, at load', () => {
  const ok = raw.specials;
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { ...ok[0] }]), /duplicate-id/);
  assert.throws(() => load([...ok, { id: 'a', family: 'pitborn', template: 'crack', opponent: 'pitborn', params: {} }]), /missing-field: cast is required/);
  assert.throws(() => load([...ok, { id: 'a', family: 'pitborn', template: 'crack', opponent: 'pitborn', cast: { actor: '1' }, params: {} }]), /wrong-type: cast.actor must be integer/);
  assert.throws(() => load([...ok, { id: 'a', family: 'pitborn', template: 'quake', opponent: 'pitborn', cast: { actor: 1 }, params: {} }]), /template "quake" is not a pitborn verb/);
  assert.throws(() => load([...ok, { id: 'a', family: 'pitborn', template: 'gale', opponent: 'pitborn', cast: { actor: 1 }, params: { streaks: 3 } }]), /params.sand is required by the gale template/);
  assert.throws(() => createPitbornSpecial(new THREE.Scene(), 'pitborn', 'nothing', DAY), /unknown pitborn special "nothing"/);
});
