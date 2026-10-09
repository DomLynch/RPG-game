// The character catalogue (src/fight/catalogue.ts + catalogue-rows.ts): every roster character has a row, every Pit rank resolves to a row's named opponent, the rows say what their files say, each fault is
// named, and the engine reads a row by id with no per-character code (a new character is one row).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogueProblems, catalogueRowsProblems, type CatalogueRow } from '../src/fight/catalogue.ts';
import { CATALOGUE, catalogueRow } from '../src/fight/catalogue-rows.ts';
import { LEVELS, statsAt, opponentAt, OPPONENTS } from '../src/fight/stats.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';
import { LOOT, LOOT_IDS } from '../src/loot.ts';
import { ROTATION, FINISHER_POSE, finisherSeconds } from '../src/finishers.ts';
import { WEAPONS } from '../src/moves.ts';
import { PICKS, homePick } from '../src/stance.ts';
import { THROATS } from '../src/audio/creature.ts';
import { beastRenderScale } from '../src/beast-scale.ts';
import { SHIPPING_LOOKS, PHONE_LOOKS } from '../src/rank-look.ts';
import { LADDER } from '../src/ladder.ts';
import { LEGEND_OPPONENTS, legendForLevel, rungOf } from '../src/legends.ts';
import { MAX_LEVEL } from '../src/career.ts';
import { glbStats } from '../scripts/lib/glb-stats.mjs';
import { LOOT_TABLES } from '../origins/region1/content.ts';

const known = {
  roster: new Set(Object.keys(ROSTER)), loot: LOOT_IDS as ReadonlySet<string>, tables: new Set((LOOT_TABLES as { id: string }[]).map((t) => t.id)),
  finishers: new Set<string>([...ROTATION, 'quietOne', 'hamstrung', 'execution']), archetypes: new Set(Object.values(ROSTER).map((r) => r.archetype)),
  weapons: new Set(Object.keys(WEAPONS)), stances: new Set<string>(PICKS), voices: new Set(Object.keys(THROATS)), poses: new Set(Object.values(FINISHER_POSE).filter((p): p is NonNullable<typeof p> => !!p)),
};
const root = (p: string) => new URL(`../${p}`, import.meta.url);
const glb = (path: string) => { const s = glbStats(path); return { tris: s.tris, joints: s.jointNames, clips: s.clips }; };
const goblin = () => structuredClone(catalogueRow('goblin')!) as CatalogueRow;

test('the catalogue is valid, ids are unique, and every roster character has a row', () => {
  assert.deepEqual(catalogueRowsProblems(CATALOGUE, known), []);
  assert.deepEqual(CATALOGUE.map((r) => r.id).sort(), Object.keys(ROSTER).sort());
  assert.deepEqual(catalogueRowsProblems([CATALOGUE[0]!, CATALOGUE[0]!], known).map((p) => p.code), ['dup-id']);
});

test('every Pit rank resolves to a catalogue row: the ten legends of each of the ten opponents, at every ladder level', () => {
  assert.equal(LEGEND_OPPONENTS.length * 10, 100);
  for (const id of LEGEND_OPPONENTS) {
    const row = catalogueRow(id)!;
    assert.equal(row.ranks.length, 10, `${id}: ten ranks`);
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const legend = legendForLevel(id, level), rank = row.ranks[rungOf(level) - 1]!;
      assert.deepEqual(rank, { name: legend.name, source: legend.source, backstory: legend.backstory }, `${id} level ${level}`);
    }
  }
  for (const row of CATALOGUE) if (!(LEGEND_OPPONENTS as readonly string[]).includes(row.id)) assert.equal(row.ranks.length, 0, `${row.id}: a creature or held character has no Pit ranks`);
});

test('stats resolve inside the engine: every row at every level of its band through src/fight/stats.ts, the same fighter the Pit builds', () => {
  assert.equal(LEVELS, MAX_LEVEL);
  for (const row of CATALOGUE) {
    const id = row.id as OpponentId;
    for (const level of [row.stats.levels[0], 6, 18, 46, row.stats.levels[1]]) {
      const f = statsAt(id, level);
      assert.equal(f.id, id); assert.deepEqual(f, opponentAt(OPPONENTS[id], level)); assert.equal(f.rig, row.rig, `${id}: the row's rig is the fighter's`);
      assert.ok(f.health > 0, `${id} L${level}`);
    }
    assert.equal(row.stats.archetype, ROSTER[id].archetype);
  }
});

test('each fault is named', () => {
  const edit = (f: (r: CatalogueRow) => void) => { const r = goblin(); f(r); return catalogueProblems(r, known).map((p) => p.code).join(','); };
  assert.equal(edit(() => {}), '');
  assert.equal(edit((r) => { (r as { id: string }).id = 'dragon'; }), 'id');
  assert.equal(edit((r) => { r.world = { ...r.world!, tris: 62000, maxTris: 62000 }; }), 'budget');
  assert.equal(edit((r) => { r.world = { ...r.world!, asset: r.engine.asset }; }), 'asset');
  assert.equal(edit((r) => { (r.armour as string[]).push('goblin.Cape'); }), 'armour');
  assert.equal(edit((r) => { r.stats = { archetype: 'nope', levels: [1, 10] }; }), 'stats');
  assert.equal(edit((r) => { r.finisher.cut!.neck = []; }), 'finisher');
  assert.equal(edit((r) => { r.finisher.finishers = ['decapitation']; }), 'finisher,timing');   // the picks and their timing rows must agree
  assert.equal(edit((r) => { r.blood = { start: 'red', end: '#000000', amount: 1 }; }), 'blood');
  assert.equal(edit((r) => { r.loot = { table: 'loottable:nothing' }; }), 'loot');
  assert.equal(edit((r) => { Object.assign(r, { ranks: [] }); }), 'legend');
  assert.equal(edit((r) => { r.render = { scale: 0 }; }), 'render');
  assert.equal(edit((r) => { r.weapon = 'lightsaber'; }), 'weapon');
  assert.equal(edit((r) => { (r as { home: string }).home = 'berserk'; }), 'home');
  assert.equal(edit((r) => { r.voice = 'dragon'; }), 'voice');
  assert.equal(edit((r) => { r.look = { ...r.look, levels: [3, 2] }; }), 'look');
  assert.equal(edit((r) => { r.ladder = { order: 2, hold: true }; }), 'ladder');
  assert.equal(edit((r) => { r.finisher.timing = r.finisher.timing.slice(1); }), 'timing');
});

test('the rows say what the files say: tri counts, clips, cut bones, the armour set, the loot table', () => {
  for (const row of CATALOGUE) {
    const engine = glb(row.engine.asset);
    assert.equal(engine.tris, row.engine.tris, `${row.id}: engine tris`);
    assert.deepEqual([...row.animations.clips].sort(), [...engine.clips].sort(), `${row.id}: clips`);
    if (row.finisher.cut) for (const bone of [...row.finisher.cut.head, ...row.finisher.cut.neck, ...Object.values(row.finisher.cut.limbs).flat()]) assert.ok(engine.joints.has(bone), `${row.id}: ${bone} is a joint`);
    if (row.world) {
      const world = glb(row.world.asset);
      assert.equal(world.tris, row.world.tris, `${row.id}: world tris`); assert.ok(world.tris <= row.world.maxTris);
      assert.deepEqual([...world.clips].sort(), [...engine.clips].sort(), `${row.id}: the world asset carries every clip`);
      if (row.finisher.cut) for (const bone of Object.values(row.finisher.cut).flatMap((b) => (Array.isArray(b) ? b : Object.values(b).flat()))) assert.ok(world.joints.has(bone as string), `${row.id}: ${bone} is a joint of the world asset`);
    }
    assert.ok(row.armour.every((id) => (LOOT[row.id as OpponentId] ?? []).includes(id)), `${row.id}: armour comes from its own loot pieces`);
  }
  const g = catalogueRow('goblin')!;
  assert.deepEqual(g.armour, ['goblin.Helmet', 'goblin.Body', 'goblin.Arms', 'goblin.Greaves', 'goblin.Boots', 'goblin.Gloves']);
  assert.equal(g.loot.table, 'loottable:pit-goblin'); assert.equal(g.world!.tris, 7999);
  assert.equal(catalogueRow('skeleton')!.blood, null, 'the Skeleton is bloodless as the roster says');
});

test('the engine reads a row by id with no per-character code: a new character is one row', () => {
  for (const f of ['src/fight/catalogue.ts', 'src/fight/stats.ts']) assert.ok(!/['"`](wolf|boar|bear|goblin|veteran|dwarf)['"`]/.test(readFileSync(root(f), 'utf8').replace(/\/\/.*$/gm, '')), `${f} names no character`);
  assert.equal(catalogueRow('dragon'), null);
  const second = { ...goblin(), id: 'knight', name: 'the Knight' };
  assert.ok(!catalogueProblems(second as CatalogueRow, known).some((p) => p.code === 'id' || p.code === 'asset'), 'a second row needs only data');
});

test('the new fields are what their sources say: render scale, weapon, home stance, voice, rank looks, finisher timing, ladder order', () => {
  for (const row of CATALOGUE) {
    const id = row.id as OpponentId;
    assert.equal(row.render.scale, beastRenderScale(id), `${id}: render scale`);
    assert.equal(row.weapon, ROSTER[id].weapon, `${id}: weapon`);
    assert.equal(row.home, homePick(id), `${id}: home stance`);
    assert.equal(row.voice, THROATS[ROSTER[id].body] ? ROSTER[id].body : null, `${id}: voice`);
    assert.deepEqual(row.look.levels, SHIPPING_LOOKS[id] ?? [], `${id}: rank looks`);
    assert.equal(row.look.phone, PHONE_LOOKS.has(id), `${id}: phone looks`);
    const at = LADDER.findIndex((o) => o.id === id);
    assert.deepEqual(row.ladder, { order: at < 0 ? null : at + 1, hold: at < 0 }, `${id}: ladder`);
    assert.deepEqual(row.finisher.timing.map((t) => [t.id, t.pose, t.seconds, t.measured]), row.finisher.finishers.map((f) => [f, FINISHER_POSE[f] ?? null, finisherSeconds(f).seconds, finisherSeconds(f).measured]), `${id}: finisher timing`);
  }
  assert.deepEqual(['wolf', 'boar', 'bear'].map((id) => catalogueRow(id)!.render.scale), [2, 1.8, 2.2], 'the beasts draw at the size they are met walking');
  assert.equal(catalogueRow('goblin')!.home, 'trickster'); assert.equal(catalogueRow('executioner')!.home, 'aggressive'); assert.equal(catalogueRow('shieldmaiden')!.home, 'defensive');
  assert.deepEqual(CATALOGUE.filter((r) => r.ladder.order !== null).map((r) => r.ladder.order), LADDER.map((_, i) => i + 1).slice(0, LADDER.length), 'the ladder is 1..n with no gaps');
});
