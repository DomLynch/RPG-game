// Specials as data: the Pitborn's, the Dwarf's / Shieldmaiden's and the Executioner's rank 8-10 specials are rows of src/fight/special-defs.json over the module's template verbs. The drawn effect is
// byte-identical to the code it replaced, a special is one row, and the loader refuses a broken row at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PITBORN_KINDS, PITBORN_TEMPLATES, createPitbornSpecial, isPitbornSpecial } from '../src/fight/special-fx-pitborn.ts';
import { loadSpecialDefs, specialFamily, type SpecialRow } from '../src/fight/special-rows.ts';
import { DWARF_SHIELD_KINDS, NIGHT_CAP_OF, STRIDE, fillBoss, isDwarfShieldCast, makeField, makeGeo, setGeo } from '../src/fight/special-fx-dwarf-shield.ts';
import { LAND_AT } from '../src/fight/special-timing.ts';
import { BOSS_KINDS, EXECUTIONER_TEMPLATES, bossLook, createExecutionerSpecial, isExecutionerCast } from '../src/fight/special-fx-executioner.ts';
import { crowdWave } from '../src/arena.ts';
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

// ---- The Dwarf's and the Shieldmaiden's ranks 8-10 (special-fx-dwarf-shield.ts): the theWord / threeBlows / rimShake / baredFace / theRing / aegisSweep templates.
// fillBoss is pure, so the proof is its output: the dust and grit buffers over the whole cast (rel -130..100 in half ticks), two geometries, day and night, two fades,
// computed on trunk 411fbdf31 BEFORE the rows existed. createBossFx only writes that field to sprites, and its cast test is pinned below.
const fillHash = (kind: string | SpecialRow): string => {
  const h = createHash('sha256'), f = makeField();
  const geos = [[new THREE.Vector3(0, 1.6, -0.6), new THREE.Vector3(0, 1.6, 1.4)], [new THREE.Vector3(1, 1.5, 0), new THREE.Vector3(-1.5, 1.7, 0.5)]].map(([c, t]) => { const g = makeGeo(); setGeo(g, c!, t!); return g; });
  for (const g of geos) for (const night of [false, true]) for (const fade of [1, 0.4]) for (let rel = -130; rel <= 100; rel += 0.5) {
    fillBoss(kind, f, rel, g, fade, night); h.update(Buffer.from(f.dust.buffer)); h.update(Buffer.from(f.grit.buffer));
  }
  return h.digest('hex');
};
const FILL_BEFORE: Record<string, string> = {
  dwarf8: 'c5d3872e4fb38f04c7d4062e4cef4671c2c9af1b43c4654e4ed79c7f4d0c9772', dwarf9: '6dffaf38c710ba2fbcfc5ee6e6634fa582de7460ea43e3cb5d5b9cb634859044',
  dwarf10: '1234e5406de394a974a44fcbacbcfc249e6e006acf7f89b794549e410bd68721', shield8: '99a5f31384a75bc964df96534680dce38351edac86500750378d8337aff2f032',
  shield9: '36d465f81785c241b0aacd8f9f42da930e05b63358ad9705b70f650e5643b580', shield10: 'c05d41f0cc280269ed12fa55bf1cfa40f2b3bc81a1ffdd051f35c6c6d2d49d8c',
};
const loadDS = (rows: unknown[]) => specialFamily(loadSpecialDefs({ specials: rows }, manifest), 'dwarf-shield', DS_TEMPLATES);
const DS_TEMPLATES = Object.fromEntries(['theWord', 'threeBlows', 'rimShake', 'baredFace', 'theRing', 'aegisSweep'].map((t) => [t, ['size', 'alpha', 'cap']]));

test('the Dwarf/Shieldmaiden specials drawn from their rows are byte-identical to the code they replaced (fillBoss output, day and night; the cast each page draws)', () => {
  assert.deepEqual([...DWARF_SHIELD_KINDS], Object.keys(FILL_BEFORE));
  for (const kind of DWARF_SHIELD_KINDS) assert.equal(fillHash(kind), FILL_BEFORE[kind], kind);
  // the cast test, as trunk had it: the kind's opponent, the opponent's side, any move
  for (const kind of DWARF_SHIELD_KINDS) for (const o of ['dwarf', 'shieldmaiden', 'veteran'] as const) for (const actor of [0, 1])
    assert.equal(isDwarfShieldCast(kind)(o, actor), o === (kind.startsWith('dwarf') ? 'dwarf' : 'shieldmaiden') && actor === 1, `${kind} ${o} ${actor}`);
  assert.deepEqual(NIGHT_CAP_OF, { dwarf10: 0.7 });
});

test('a seventh Dwarf/Shieldmaiden special is ONE row naming an existing template, through the real loader, with no code edit', () => {
  const row = { id: 'shield11', family: 'dwarf-shield', template: 'theRing', opponent: 'shieldmaiden', cast: { actor: 1 }, params: { size: 1.6, alpha: 1.2, cap: 0.3 } };
  const rows = loadDS([...raw.specials, row]), mine = rows.find((r) => r.id === 'shield11')!;
  assert.equal(rows.length, 7);
  const f = makeField(), g = makeGeo(); setGeo(g, new THREE.Vector3(0, 1.6, -0.6), new THREE.Vector3(0, 1.6, 1.4));
  let top = 0; for (let rel = -LAND_AT; rel <= 80; rel++) { fillBoss(mine, f, rel, g); for (let o = 6; o < f.dust.length; o += STRIDE) top = Math.max(top, f.dust[o]!); }
  assert.ok(top > 0.1 && top <= 0.3 + 1e-6, `drawn, under its own cap (${top}; the field is float32)`);
  assert.notEqual(fillHash(mine), FILL_BEFORE.shield9, 'its own gain, not The Ring\'s');
  assert.equal(isDwarfShieldCast(mine)('shieldmaiden', 1), true);
});

test('the Dwarf/Shieldmaiden rows refuse a template the module does not draw and a missing gain', () => {
  assert.doesNotThrow(() => loadDS(raw.specials));
  assert.throws(() => loadDS([...raw.specials, { id: 'a', family: 'dwarf-shield', template: 'avalanche', opponent: 'dwarf', cast: { actor: 1 }, params: { size: 1, alpha: 1, cap: 0.5 } }]), /template "avalanche" is not a dwarf-shield verb/);
  assert.throws(() => loadDS([...raw.specials, { id: 'a', family: 'dwarf-shield', template: 'theWord', opponent: 'dwarf', cast: { actor: 1 }, params: { size: 1, alpha: 1 } }]), /params.cap is required by the theWord template/);
  assert.throws(() => fillBoss('nothing', makeField(), 0, makeGeo()), /unknown dwarf-shield special "nothing"/);
});

// ---- The Executioner's ranks 8-10 (special-fx-executioner.ts): the baying / longShadow / harvest templates. The proof is the whole drawn scene as for the Pitborn,
// plus the grit Points buffer and the crowd's lean (the Harvest Sweep registers arena.ts crowdWave.lean), computed on trunk 411fbdf31 BEFORE the rows existed.
const reaping = { started: { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_reaping' } as unknown as CombatEvent, landed: (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_reaping', damage: 30 }) as unknown as CombatEvent };
function execHash(kind: string | SpecialRow, exposure: number): string {
  const h = createHash('sha256'), scene = new THREE.Scene(), look = bossLook(kind, exposure), fx = createExecutionerSpecial(scene, 'executioner', kind, look), tex = new Set<THREE.Texture>();
  const feet2 = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0.3, 0, -0.6)] as const, fighters2 = [{ special: 0 }, { special: 0, skill: 'reaping' }] as unknown as readonly [Fighter, Fighter];
  h.update(JSON.stringify([look.core.toArray(), look.edge.toArray(), look.dim].flat(2).map((v) => (typeof v === 'number' ? r6(v) : v))));
  for (let t = 0; t <= LAND_AT + 240; t++) {
    fx.render(1 / 60, t === 1 ? [reaping.started] : t === LAND_AT ? [reaping.landed(t)] : [], fighters2, t, feet2, false);
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.MeshBasicMaterial & THREE.PointsMaterial) | undefined;
      if (m?.map) tex.add(m.map);
      const pos = (o as THREE.Points).isPoints ? Array.from((o as THREE.Points).geometry.attributes.position!.array as Float32Array).map(r6).join(',') : '';
      h.update(`${o.name}|${o.visible}|${o.position.toArray().map(r6)}|${o.quaternion.toArray().map(r6)}|${o.scale.toArray().map(r6)}|${m ? `${r6(m.opacity)}|${m.color?.getHexString()}|${m.depthTest}|${m.size ?? ''}|${o.renderOrder}` : ''}|${pos};`);
    });
    h.update(`lean:${crowdWave.lean ? [0, 1, 2, 3, 4, 5].map((a) => r6(crowdWave.lean!(a))).join(',') : 'null'}`);
  }
  for (const t of tex) { const d = (t.image as { data?: Uint8Array } | undefined)?.data; if (d) h.update(createHash('sha256').update(Buffer.from(d.buffer)).digest('hex')); }
  fx.clear();
  return h.digest('hex');
}
const EXEC_BEFORE: Record<string, [string, string]> = {
  arawn: ['d7d435a3a53ff78018d3d7f751becf665039a74e826d52bc3638debec9866a54', 'e9ac1f30cd2b1e15346fdffe8a6e86e3bee8772b4e312afc6d5d32d2a9e9e973'],
  thanatos: ['d594432b4ba4d559823720091df406060c5efe2e9abe96d948cb06ae484d5f2a', '69f80441e9673e4eebad3d4a22272cd377f0a1b2d5816cc302adba37b69f8a91'],
  reaper: ['58dcaa803105182530d2c66ff8fdd40992feec6a306b6ff0b2dcbb5389e86066', '13b310afe6441f272798b9df824d2ad00cbe94a785be4d850a6ac9140fbc5b1b'],
};
const loadEx = (rows: unknown[]) => specialFamily(loadSpecialDefs({ specials: rows }, manifest), 'executioner', EXECUTIONER_TEMPLATES);

test('the Executioner specials drawn from their rows are byte-identical to the code they replaced (every object, the grit buffer and the crowd lean, every tick; day and Night Pit)', () => {
  assert.deepEqual([...BOSS_KINDS], Object.keys(EXEC_BEFORE));
  for (const kind of BOSS_KINDS) assert.deepEqual([execHash(kind, 1.3), execHash(kind, PIT)], EXEC_BEFORE[kind], kind);
  for (const row of loadEx(raw.specials)) for (const o of ['executioner', 'veteran']) for (const actor of [0, 1]) for (const move of ['skill_reaping', 'skill_lunge', undefined])
    assert.equal(o === row.opponent && actor === row.cast.actor && move === row.cast.move, isExecutionerCast(o as 'executioner', actor, move), `${row.id} ${o} ${actor} ${move}`);
});

test('a fourth Executioner special is ONE row naming an existing template, through the real loader, with no code edit', () => {
  const row = { id: 'anubis', family: 'executioner', template: 'longShadow', opponent: 'executioner', cast: { actor: 1, move: 'skill_reaping' },
    params: { look: { day: { core: [0.02, 0.015, 0.01], edge: [0.06, 0.05, 0.04] }, night: { core: [0.01, 0.008, 0.006], edge: [0.03, 0.025, 0.02] } }, shadowAlpha: { day: 0.5, night: 0.6 }, poolAlpha: { day: 0.4, night: 0.5 }, dimAlpha: { day: 0.1, night: 0.1 }, gritSize: 0.1, gritShade: 1 } };
  const rows = loadEx([...raw.specials, row]), mine = rows.find((r) => r.id === 'anubis')!;
  assert.equal(rows.length, 4);
  assert.equal(bossLook(mine, 1.3).core.r, 0.02, 'its own colours');
  const scene = new THREE.Scene(), fx = createExecutionerSpecial(scene, 'executioner', mine, bossLook(mine, 1.3)), fighters2 = [{ special: 0 }, { special: 0, skill: 'reaping' }] as unknown as readonly [Fighter, Fighter];
  let top = 0;
  for (let t = 0; t <= LAND_AT + 30; t++) { fx.render(1 / 60, t === 1 ? [reaping.started] : t === LAND_AT ? [reaping.landed(t)] : [], fighters2, t, feet, false); top = Math.max(top, ((scene.getObjectByName('long shadow') as THREE.Mesh).material as THREE.Material).opacity); }
  assert.ok(top > 0.1 && top <= 0.5 + 1e-9, `the long shadow is drawn, under its own ceiling (${top})`);
  assert.notEqual(execHash(mine, 1.3), EXEC_BEFORE.thanatos![0], 'its parameters, not Thanatos\'s');
});

test('the Executioner rows refuse a template the module does not draw and a missing param', () => {
  assert.doesNotThrow(() => loadEx(raw.specials));
  assert.throws(() => loadEx([...raw.specials, { id: 'a', family: 'executioner', template: 'guillotine', opponent: 'executioner', cast: { actor: 1 }, params: {} }]), /template "guillotine" is not a executioner verb/);
  assert.throws(() => loadEx([...raw.specials, { id: 'a', family: 'executioner', template: 'harvest', opponent: 'executioner', cast: { actor: 1 }, params: { look: {} } }]), /params.crescentAlpha is required by the harvest template/);
  assert.throws(() => bossLook('nothing', 1), /unknown executioner special "nothing"/);
});

test('an Executioner special with neither a bosses.json row nor its own look is refused by name', () => {
  const row = loadEx([...raw.specials, { id: 'nolook', family: 'executioner', template: 'harvest', opponent: 'executioner', cast: { actor: 1, move: 'skill_reaping' },
    params: { crescentAlpha: { day: 0.6, night: 0.4 }, cutAlpha: 0.9, gritSize: 0.13, gritShade: 0.9, gritAlpha: 0.8 } }]).find((r) => r.id === 'nolook')!;
  assert.throws(() => bossLook(row, 1.3), /executioner special "nolook" has no look/);
});
