// THE SHEET counts in a fight (Wave A1 PR1, RV48; Dom's sheet rule): every player stat starts at 100 and tops out at 200, the 100 points are budgeted by layer (level +50, gear +25,
// skills +15, titles +10), and the duel reads attack, armour and burden from the sheet's stat ROWS. These tests pin the bar: the naked fight is the fight it was (byte for byte), a
// stat never moves a duration, layers add and are capped by their rows, a new stat or piece or school is a row, and a recorded sheet fight replays with its first differing tick named.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, stepDuel, withSheet, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { MOVES, RULES } from '../src/fight/moves.ts';
import { TARGET } from '../src/fight/sim.ts';
import { SHEET_LAYERS, SHEET_STATS, checkSheet, sheetOf, statDown, statUp, statValue } from '../src/fight/sheet-rows.ts';
import { GEAR, loadGearDefs } from '../src/fight/gear-rows.ts';
import { NAKED, fullSet, gearLayer, gearSheet, loadoutFor } from '../src/fight/gear-stats.ts';
import { SCHOOLS, SCHOOL_IDS } from '../src/fight/schools.ts';
import { createRecorder, packRecord, unpackRecord, FIRST_SHEET_VERSION, RECORD_VERSION } from '../src/fight/record.ts';
import { verifyRecord } from '../src/fight/replay.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import gearDefs from '../src/fight/gear-defs.json' with { type: 'json' };

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action): Intent => ({ ...idle(), action });
const duel = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
const run = (d: Duel, n: number, a: Intent = idle(), b: Intent = idle()): Duel => { for (let i = 0; i < n; i++) d = stepDuel(d, [a, b]); return d; };
const light = MOVES.light_right;

test('the sheet rows: four layers that sum to the 100 points, every stat on a 100-based line capped at 200 (burden at 125, gear only), codes 1..n, and no stat names a timing', () => {
  assert.deepEqual(SHEET_LAYERS, { level: 50, gear: 25, skill: 15, title: 10 });
  assert.equal(Object.values(SHEET_LAYERS).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(SHEET_STATS.map((r) => [r.id, r.code, r.base, r.cap]), [['attack', 1, 100, 200], ['armour', 2, 100, 200], ['resist', 3, 100, 200], ['burden', 4, 100, 125]]);
  for (const r of SHEET_STATS) { assert.ok(r.cap <= 200, `${r.id}: a player number past 200 fails review`); assert.ok(!/tick|window|windup|recovery|duration|time/i.test(r.id), `${r.id}: no stat names a timing`); }
});

test('layers add and are capped by their rows: level 50 + gear 25 + skill 15 + title 10 reaches 200, a layer past its cap is held to it, and a stat takes only the layers its row lists', () => {
  assert.deepEqual(sheetOf({ level: { attack: 50 }, gear: { attack: 25 }, skill: { attack: 15 }, title: { attack: 10 } }), { attack: 200 });
  assert.deepEqual(sheetOf({ level: { attack: 50 }, gear: { attack: 25 } }), { attack: 175 }, 'layers add');
  assert.deepEqual(sheetOf({ gear: { attack: 40, armour: 25 } }), { attack: 125, armour: 125 }, 'the gear layer is held to +25');
  assert.deepEqual(sheetOf({ level: { attack: 80, armour: 80 }, gear: { attack: 25, armour: 25 }, skill: { attack: 15 }, title: { attack: 10 } }), { attack: 200, armour: 175 });
  assert.equal(sheetOf({ gear: { attack: 0 } }), undefined, 'every stat at base is no sheet at all');
  assert.throws(() => sheetOf({ level: { burden: 5 } }), /takes no points from the level layer/);
  assert.throws(() => sheetOf({ luck: { attack: 5 } }), /not a layer row/);
  assert.throws(() => sheetOf({ gear: { speed: 5 } }), /not a stat row/);
  assert.throws(() => sheetOf({ gear: { attack: 1.5 } }), /whole points/);
});

test('a sheet is validated against the stat rows: whole numbers from base to cap, known ids; stats at base are dropped and the rest come back in code order', () => {
  assert.throws(() => checkSheet({ timing: 150 }), /not a stat row/);
  assert.throws(() => checkSheet({ attack: 99 }), /from 100 to 200/);
  assert.throws(() => checkSheet({ attack: 201 }), /from 100 to 200/);
  assert.throws(() => checkSheet({ burden: 126 }), /from 100 to 125/);
  assert.throws(() => checkSheet({ attack: 120.5 }), /whole number/);
  assert.deepEqual(checkSheet({ burden: 110, armour: 100, attack: 150 }), { attack: 150, burden: 110 });
  assert.equal(checkSheet({ attack: 100 }), undefined);
  assert.equal(statValue(undefined, 'attack'), 100);
  assert.equal(statUp(undefined, 'attack', 10), 10); assert.equal(statDown({ armour: 200 }, 'armour', 10), 5);
});

test('no sheet is the fight it was: an absent or all-at-base sheet steps byte for byte like a duel that never heard of the sheet', () => {
  const plain = run(duel(), 140, act('light')), none = run(withSheet(duel(), [undefined, undefined]), 140, act('light')), base = run(withSheet(duel(), [{}, { attack: 100 }]), 140, act('light'));
  assert.deepEqual(none, plain); assert.deepEqual(base, plain);
  assert.equal(none.fighters[0].sheet, undefined);
  assert.equal(gearSheet(NAKED), undefined, 'the naked loadout is no sheet at all');
});

test('attack scales the blow up, armour scales it down (200 armour takes half), both multiply; a blow is never scaled to nothing', () => {
  const hit = (s0?: Record<string, number>, s1?: Record<string, number>) => { const d = run(withSheet(duel(), [s0, s1]), light.windup + 1, act('light')); return RULES.health - d.fighters[1].health; };
  assert.equal(hit(), light.damage);
  assert.equal(hit({ attack: 150 }), Math.round(light.damage * 1.5));
  assert.equal(hit(undefined, { armour: 200 }), Math.round(light.damage / 2));
  assert.equal(hit({ attack: 150 }, { armour: 125 }), Math.round((light.damage * 150 / 100) * 100 / 125));
  assert.ok(hit(undefined, { armour: 200 }) >= 1);
});

test('burden: worn weight makes an attack cost more stamina and changes no duration (phase, age, move and stun are the same on every tick)', () => {
  let a = withSheet(duel(), [{ burden: 125 }, undefined]), b = duel();
  for (let t = 0; t < 120; t++) {
    a = stepDuel(a, [act('light'), idle()]); b = stepDuel(b, [act('light'), idle()]);
    for (const k of [0, 1] as const) assert.deepEqual([a.fighters[k].phase, a.fighters[k].age, a.fighters[k].move, a.fighters[k].stun], [b.fighters[k].phase, b.fighters[k].age, b.fighters[k].move, b.fighters[k].stun], `tick ${t + 1}`);
  }
  const start = stepDuel(withSheet(duel(), [{ burden: 125 }, undefined]), [act('light'), idle()]), base = stepDuel(duel(), [act('light'), idle()]);
  assert.equal(100 - start.fighters[0].stamina, (100 - base.fighters[0].stamina) * 1.25);
});

test('the first differing tick of a sheet fight against the same intents without one is the first blow, and it is named', () => {
  let a = withSheet(duel(), [{ attack: 150 }, undefined]), b = duel(), first = -1, event = '';
  for (let t = 1; t <= 90 && first < 0; t++) {
    a = stepDuel(a, [act('light'), idle()]); b = stepDuel(b, [act('light'), idle()]);
    if (a.fighters[1].health !== b.fighters[1].health) { first = t; event = a.events.map((e) => e.type).join(','); }
  }
  assert.equal(first, light.windup + 1, 'the health first differs on the tick the blow lands');
  assert.match(event, /Hit/);
});

test('the gear layer: a full tier set sits inside +25, an extreme loadout is held to it, and worn rows reach the Loadout through the armour curve and the weight', () => {
  assert.deepEqual(gearLayer(loadoutFor(fullSet('Origin', 'Longsword'))), { attack: 15, armour: 25, burden: 0 });
  assert.deepEqual(gearSheet(loadoutFor(fullSet('Origin', 'Longsword'))), { attack: 115, armour: 125 });
  assert.deepEqual(gearSheet({ attack: 3, res: 0.1, weight: 500 }), { attack: 125, armour: 125, burden: 125 });
  assert.equal(loadoutFor({}).res, NAKED.res, 'no rows worn: the tier loadout untouched');
  const heavy = loadoutFor({}, ['heavy'], 1), lite = loadoutFor({}, ['light'], 1);
  assert.ok(heavy.res < lite.res && lite.res < 1, 'more armour, less taken');
  assert.equal(heavy.weight, GEAR.rows.heavy!.weight);
  assert.ok(loadoutFor({}, ['heavy'], 40).res > heavy.res, 'the same armour counts for less at a higher level (K grows with level)');
  assert.ok(gearSheet(heavy)!.burden! > 100, 'worn weight shows as burden');
  assert.throws(() => loadoutFor({}, ['nope']), /not a gear row/);
});

test('gear rows: light, medium and heavy are three preset rows, a piece extends one, resist keys are school rows, and the loader refuses a bad table', () => {
  assert.deepEqual(['light', 'medium', 'heavy'].map((id) => GEAR.rows[id]!.preset), [true, true, true]);
  const withRow = (row: Record<string, unknown>) => () => loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, row] });
  const t = loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, { id: 'plate.body', slot: 'Body', extends: 'heavy', armour: 60, weight: 18, wearMax: 160, resist: { fire: 1, earth: -1 } }] });
  assert.deepEqual(t.rows['plate.body']!.resist, { fire: 1, earth: -1 });
  assert.throws(withRow({ id: 'x', slot: 'Body', armour: 1, weight: 1, wearMax: 1, resist: { void: 1 } }), /resist void is a school row/);
  assert.throws(withRow({ id: 'x', armour: 1, weight: 1, wearMax: 1, resist: {} }), /names its slot/);
  assert.throws(withRow({ id: 'x', slot: 'Body', extends: 'plate', armour: 1, weight: 1, wearMax: 1, resist: {} }), /no preset row/);
  assert.throws(withRow({ id: 'light', armour: 1, weight: 1, wearMax: 1, resist: {} }), /duplicate-id/);
  assert.throws(withRow({ id: 'x', slot: 'Body', armour: 1, weight: 1, wearMax: 0, resist: {} }), /wearMax is at least 1/);
});

test('schools are rows: the five and earth and wind, each with a colour, and a new school is one row away from a resist key', () => {
  assert.deepEqual([...SCHOOL_IDS].sort(), ['earth', 'fire', 'frost', 'holy', 'poison', 'shadow', 'wind']);
  for (const id of SCHOOL_IDS) assert.match(SCHOOLS[id]!, /^#[0-9a-f]{6}$/, id);
  const raw = { ...gearDefs, gear: [...gearDefs.gear, { id: 'x', slot: 'Body', armour: 1, weight: 1, wearMax: 1, resist: { lightning: 2 } }] };
  assert.doesNotThrow(() => loadGearDefs(raw, [...SCHOOL_IDS, 'lightning']));
});

test('a sheet fight records as v48 with its stats, round-trips, replays, and a sheet-less fight keeps its version', () => {
  assert.equal(RECORD_VERSION, FIRST_SHEET_VERSION);
  const sheet = { attack: 120, armour: 130, burden: 105 };
  const meta = { build: 't', opponent: 'veteran' as const, weapon: 'longsword' as const, level: 1, seed: 7 };
  setPlayScale(playScaleFor(meta.opponent, RECORD_VERSION)); setLateNotice(true); setStab(true);   // a live fight: the era a v48 record can only be made in
  const rec = createRecorder({ ...meta, sheet }), plain = createRecorder(meta);
  for (let i = 0; i < 30; i++) { rec.push(idle()); plain.push(idle()); }
  const a = rec.finish('abandoned'), b = plain.finish('abandoned');
  assert.equal(a.v, FIRST_SHEET_VERSION); assert.notEqual(b.v, FIRST_SHEET_VERSION, 'no sheet: the lowest version that can express the fight');
  assert.deepEqual(unpackRecord(packRecord(a)), a);
  const bytes = packRecord(a);
  assert.equal(bytes[2], FIRST_SHEET_VERSION);
  assert.equal(verifyRecord(a).ok, true);
  const at = bytes.length - 6 * 30 - (1 + 4 + 4 + 1) - (1 + 2 * 3);   // the sheet block: count, then (code, value) x 3, just before level
  assert.equal(bytes[at], 3, 'three pairs');
  const broken = (edit: (u: Uint8Array) => void) => { const u = bytes.slice(); edit(u); return () => unpackRecord(u); };
  assert.throws(broken((u) => { u[at + 1] = 9; }), /unknown sheet/, 'a code no row has');
  assert.throws(broken((u) => { u[at + 2] = 99; }), /unknown sheet/, 'below base');
  assert.throws(broken((u) => { u[at + 2] = 201; }), /unknown sheet/, 'past the cap');
  assert.throws(broken((u) => { u[at + 2] = 100; }), /unknown sheet/, 'a pair at base is not how the writer says it');
  assert.throws(broken((u) => { u[at] = 4; }), /unknown sheet|truncated|length/, 'a count that runs into the level');
});
