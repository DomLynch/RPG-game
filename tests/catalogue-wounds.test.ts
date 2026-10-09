// K5 wounds rows (World's #2000 schema as catalogue data): the quadruped bodytype and the beast species, and the wolf, boar and bear rows that read them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodytypeProblems, catalogueProblems, type Bodytype, type CatalogueRow } from '../src/fight/catalogue.ts';
import { CATALOGUE, catalogueRow } from '../src/fight/catalogue-rows.ts';
import { BODYTYPES, SPECIES } from '../src/fight/body-tables.ts';
import { ROSTER } from '../src/roster.ts';
import { LOOT_IDS } from '../src/loot.ts';
import { ROTATION, FINISHER_POSE } from '../src/finishers.ts';
import { WEAPONS } from '../src/moves.ts';
import { PICKS } from '../src/stance.ts';
import { THROATS } from '../src/audio/creature.ts';
import { LOOT_TABLES } from '../origins/region1/content.ts';
import { glbStats } from '../scripts/lib/glb-stats.mjs';

const known = {
  roster: new Set(Object.keys(ROSTER)), loot: LOOT_IDS as ReadonlySet<string>, tables: new Set((LOOT_TABLES as { id: string }[]).map((t) => t.id)),
  finishers: new Set<string>([...ROTATION, 'quietOne', 'hamstrung', 'execution']), archetypes: new Set(Object.values(ROSTER).map((r) => r.archetype)),
  weapons: new Set(Object.keys(WEAPONS)), stances: new Set<string>(PICKS), voices: new Set(Object.keys(THROATS)), poses: new Set(Object.values(FINISHER_POSE).filter((p): p is NonNullable<typeof p> => !!p)),
  bodytypes: BODYTYPES, species: SPECIES,
};
const beasts = ['wolf', 'boar', 'bear'];
const edit = (id: string, f: (r: CatalogueRow) => void) => { const r = structuredClone(catalogueRow(id)!) as CatalogueRow; f(r); return catalogueProblems(r, known).map((p) => p.code).join(','); };

test('every bodytype tree is right side up: one trunk root, the head hangs from the neck and the neck from the trunk', () => {
  for (const [id, bt] of Object.entries(BODYTYPES)) assert.deepEqual(bodytypeProblems(bt), [], id);
  const q = new Map(BODYTYPES.quadruped!.parts.map((p) => [p.id, p]));
  assert.equal(q.get('torso')!.parent, undefined); assert.equal(q.get('neck')!.parent, 'torso'); assert.equal(q.get('head')!.parent, 'neck');
  for (const limb of ['foreL', 'foreR', 'hindL', 'hindR']) assert.equal(q.get(limb)!.parent, 'torso');
  const upside = { parts: [{ id: 'head', bones: ['head'], vital: true, weight: 2, cuttable: true }, { id: 'neck', bones: ['neck'], vital: true, weight: 1, cuttable: true, parent: 'head' }, { id: 'torso', bones: ['spine2'], vital: true, weight: 5, cuttable: false }] } satisfies Bodytype;
  assert.ok(bodytypeProblems(upside).some((p) => /exactly one root/.test(p)), 'the Auditor\'s upside-down head/neck tree is refused');
  const loop = { parts: [{ id: 'a', bones: [], vital: true, weight: 1, cuttable: false, parent: 'b' }, { id: 'b', bones: [], vital: false, weight: 1, cuttable: true, parent: 'a' }] };
  assert.ok(bodytypeProblems(loop).some((p) => /cycle|exactly one root/.test(p)));
});

test('every bone name in a bodytype is a skin joint of the GLB of each creature that uses it, and the beasts share the table', () => {
  for (const id of beasts) {
    const row = catalogueRow(id)!, joints = glbStats(row.engine.asset).jointNames as Set<string>, w = row.wounds!;
    assert.equal(w.body, 'quadruped'); assert.equal(row.shape, 'quadruped');
    for (const part of BODYTYPES[w.body]!.parts) for (const bone of part.bones) assert.ok(joints.has(bone), `${id}: ${bone} (${part.id}) is a joint of ${row.engine.asset}`);
    if (row.world) { const world = glbStats(row.world.asset).jointNames as Set<string>; for (const part of BODYTYPES[w.body]!.parts) for (const bone of part.bones) assert.ok(world.has(bone), `${id}: ${bone} is a joint of the world body`); }
  }
});

test('the parts agree with the finisher cuts and the species with the row blood', () => {
  for (const id of beasts) {
    const row = catalogueRow(id)!, w = row.wounds!, cut = row.finisher.cut!, parts = new Map(BODYTYPES[w.body]!.parts.map((p) => [p.id, p]));
    assert.deepEqual(parts.get('head')!.bones, cut.head); assert.deepEqual(parts.get('neck')!.bones, cut.neck);
    for (const [limb, bones] of Object.entries(cut.limbs)) assert.deepEqual(parts.get(limb)!.bones, bones, `${id}: ${limb}`);
    assert.deepEqual(SPECIES[w.species]!.blood, { start: row.blood!.start, end: row.blood!.end });
    assert.ok(Math.abs(SPECIES[w.species]!.spray * w.size - row.blood!.amount) < 1e-9, `${id}: spray x size is the row's blood amount`);
    assert.ok(w.tiers.length >= 2 && w.bleedRate > 0, `${id}: it bleeds in tiers`);
  }
  assert.deepEqual(beasts.map((id) => catalogueRow(id)!.wounds!.size), [0.7, 1, 1.4]);
  for (const row of CATALOGUE) if (!beasts.includes(row.id)) assert.equal(row.wounds, null, `${row.id}: the Pit's own gore as today`);
});

test('each wounds fault is named', () => {
  assert.equal(edit('wolf', () => {}), '');
  assert.equal(edit('wolf', (r) => { r.wounds = { ...r.wounds!, body: 'serpent' }; }), 'wounds');
  assert.equal(edit('wolf', (r) => { r.wounds = { ...r.wounds!, size: 0 }; }), 'wounds,blood'.replace(',blood', ''));
  assert.equal(edit('wolf', (r) => { r.wounds = { ...r.wounds!, tiers: [{ below: 0.2, decals: 1, drip: 1 }, { below: 0.5, decals: 2, drip: 1 }] }; }), 'wounds');
  assert.equal(edit('wolf', (r) => { r.wounds = { ...r.wounds!, size: 0.5 }; }), 'wounds');
  assert.equal(edit('wolf', (r) => { r.wounds = { ...r.wounds!, bleedRate: 2 }; }), 'wounds');
});
