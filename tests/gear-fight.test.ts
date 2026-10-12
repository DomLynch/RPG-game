// THE SHEET counts in a fight (Wave A1 PR1, RV48; Dom's final sheet rule): ten dials, 50 to 100, 50 points at creation and one per level (150 at level 100: at most three dials maxed),
// skills as rows under a 500 total, and a worn set that only TILTS two dials against each other by 25. The duel reads attack, armour, health, poise and recovery from the sheet's dial
// ROWS. These tests pin the bar: the naked fight is the fight it was (byte for byte), a dial never moves a duration, ONE validator holds the build (no dial past 100, skills past 500, points
// past the budget), a new dial / skill / tilt / school / piece is a row, and a recorded sheet fight replays with its first differing tick named.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, stepDuel, withSheet, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { MOVES, RULES } from '../src/fight/moves.ts';
import { TARGET } from '../src/fight/sim.ts';
import { DIALS, POINTS, SHEET_SKILLS, SKILL_TOTAL, checkSheet, pointsAt, sheetOf, statDown, statUp, statValue, validateBuild } from '../src/fight/sheet-rows.ts';
import { GEAR, loadGearDefs, tiltOf } from '../src/fight/gear-rows.ts';
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

test('the sheet rows: ten dials on a 50 base with a 100 cap, one pool of 50 + 1 a level, skills as rows under a 500 total, codes 1..n, and no dial names a timing', () => {
  assert.deepEqual(DIALS.map((d) => d.id), ['attack', 'spellPower', 'armour', 'magicResist', 'health', 'stamina', 'poise', 'luck', 'focus', 'recovery']);
  assert.deepEqual(DIALS.map((d) => d.code), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const d of DIALS) { assert.equal(d.base, 50, d.id); assert.equal(d.cap, 100, `${d.id}: a player dial past 100 fails review`); assert.ok(!/tick|window|windup|recovery.*time|duration/i.test(d.id), `${d.id}: no dial names a timing`); }
  assert.deepEqual({ creation: POINTS.creation, perLevel: POINTS.perLevel, maxLevel: POINTS.maxLevel }, { creation: 50, perLevel: 1, maxLevel: 100 });
  assert.equal(pointsAt(100), 150); assert.equal(pointsAt(1), 51);
  assert.equal(SKILL_TOTAL, 500);
  for (const s of SHEET_SKILLS) { assert.ok(s.cap <= 100, s.id); if (s.school) assert.ok(SCHOOL_IDS.includes(s.school), `${s.id}: its school is a row of school-defs.json`); }
});

test('ONE build validator: a legal build passes; a dial past 100, points past the level\'s budget, a skill past 100, skills past 500, an unknown row and a bad level are each refused', () => {
  const ok = { level: 100, dials: { attack: 50, armour: 50, health: 50 }, skills: { sword: 100, axe: 100, bow: 100, 'fire-magic': 100, 'holy-magic': 100 } };
  assert.deepEqual(validateBuild(ok), [], 'three dials maxed (150 points) and five skills mastered (500) is the most a build can be');
  assert.match(validateBuild({ ...ok, dials: { attack: 51 } }).join(), /past its cap 100/);
  assert.match(validateBuild({ level: 100, dials: { attack: 50, armour: 50, health: 50, poise: 1 } }).join(), /151 points placed, the budget at level 100 is 150/);
  assert.match(validateBuild({ level: 1, dials: { attack: 52 } }).join(), /52 points placed, the budget at level 1 is 51/);
  assert.match(validateBuild({ level: 10, dials: { attack: -1 } }).join(), /whole number from 0/);
  assert.match(validateBuild({ level: 10, dials: { attack: 1.5 } }).join(), /whole number from 0/);
  assert.match(validateBuild({ level: 10, dials: { agility: 5 } }).join(), /not a dial row/);
  assert.match(validateBuild({ ...ok, skills: { ...ok.skills, wind: 1 } }).join(), /not a skill row/);
  assert.match(validateBuild({ ...ok, skills: { ...ok.skills, 'wind-magic': 1 } }).join(), /skills total 501, the cap is 500/);
  assert.match(validateBuild({ level: 10, dials: {}, skills: { sword: 101 } }).join(), /sword: a whole number from 0 to 100/);
  assert.match(validateBuild({ level: 0, dials: {} }).join(), /from 1 to 100/);
  assert.match(validateBuild({ level: 101, dials: {} }).join(), /from 1 to 100/);
  assert.deepEqual(validateBuild({ level: 1, dials: {} }), []);
  assert.throws(() => sheetOf({ level: 1, dials: { attack: 99 } }), /past the budget|budget/);
});

test('a build resolves to a sheet: placed points above 50, a gear tilt on top held between each dial\'s floor and cap, dials at base absent, nothing at all is no sheet', () => {
  assert.equal(sheetOf({ level: 1, dials: {} }), undefined);
  assert.deepEqual(sheetOf({ level: 100, dials: { attack: 50, health: 40 } }), { attack: 100, health: 90 });
  assert.deepEqual(sheetOf({ level: 100, dials: { armour: 30 } }, tiltOf('plate')), { armour: 100, magicResist: 25 }, 'plate adds 25 to an armour of 80 but never past the cap');
  assert.deepEqual(sheetOf({ level: 1, dials: {} }, tiltOf('robes')), { armour: 25, magicResist: 75 });
  assert.deepEqual(sheetOf({ level: 1, dials: {} }, { armour: 25, magicResist: -25 }), { armour: 75, magicResist: 25 });
  assert.equal(sheetOf({ level: 100, dials: { armour: 25 } }, { armour: -25 }), undefined, 'a tilt that cancels the placed points leaves the dial at its base');
  assert.deepEqual(sheetOf({ level: 1, dials: {} }, { armour: -49 }), { armour: 1 }, 'floored at the dial\'s floor, never zero');
  assert.throws(() => sheetOf({ level: 1, dials: {} }, { agility: 5 }), /not a dial row/);
});

test('a sheet is validated against the dial rows: whole numbers from floor to cap, known ids; dials at base are dropped and the rest come back in code order', () => {
  assert.throws(() => checkSheet({ timing: 80 }), /not a dial row/);
  assert.throws(() => checkSheet({ attack: 0 }), /from 1 to 100/);
  assert.throws(() => checkSheet({ attack: 101 }), /from 1 to 100/);
  assert.throws(() => checkSheet({ attack: 60.5 }), /whole number/);
  assert.deepEqual(checkSheet({ recovery: 60, armour: 50, attack: 80 }), { attack: 80, recovery: 60 });
  assert.equal(checkSheet({ attack: 50 }), undefined);
  assert.equal(statValue(undefined, 'attack'), 50);
  assert.equal(statUp(undefined, 'attack', 10), 10); assert.equal(statDown({ armour: 100 }, 'armour', 10), 5); assert.equal(statUp({ attack: 100 }, 'attack', 10), 20);
});

test('no sheet is the fight it was: an absent or all-at-base sheet steps byte for byte like a duel that never heard of the sheet', () => {
  const plain = run(duel(), 140, act('light')), none = run(withSheet(duel(), [undefined, undefined]), 140, act('light')), base = run(withSheet(duel(), [{}, { attack: 50 }]), 140, act('light'));
  assert.deepEqual(none, plain); assert.deepEqual(base, plain);
  assert.equal(none.fighters[0].sheet, undefined);
});

test('attack scales the blow up, armour scales it down (armour 100 takes half), both multiply; a blow is never scaled to nothing', () => {
  const hit = (s0?: Record<string, number>, s1?: Record<string, number>) => { const d = run(withSheet(duel(), [s0, s1]), light.windup + 1, act('light')); return RULES.health - d.fighters[1].health; };
  assert.equal(hit(), light.damage);
  assert.equal(hit({ attack: 100 }), Math.round(light.damage * 2));
  assert.equal(hit(undefined, { armour: 100 }), Math.round(light.damage / 2));
  assert.equal(hit({ attack: 75 }, { armour: 75 }), Math.round((light.damage * 75 / 50) * 50 / 75));
  assert.ok(hit(undefined, { armour: 100 }) >= 1);
});

test('health, poise and recovery: the bar scales once at the start, posture taken and stamina regeneration scale; nothing changes a phase, an age, a move or a stun on any tick', () => {
  const sheet = { health: 100, poise: 100, recovery: 100 };
  const fat = withSheet(duel(), [sheet, undefined]);
  assert.equal(fat.fighters[0].maxHealth, RULES.health * 2); assert.equal(fat.fighters[0].health, RULES.health * 2);
  assert.equal(fat.fighters[0].regen, duel().fighters[0].regen * 2);
  let a = fat, b = duel();
  for (let t = 0; t < 120; t++) {
    a = stepDuel(a, [act('light'), idle()]); b = stepDuel(b, [act('light'), idle()]);
    for (const k of [0, 1] as const) assert.deepEqual([a.fighters[k].phase, a.fighters[k].age, a.fighters[k].move, a.fighters[k].stun], [b.fighters[k].phase, b.fighters[k].age, b.fighters[k].move, b.fighters[k].stun], `tick ${t + 1}`);
  }
  const hurt = (s?: Record<string, number>) => run(withSheet(duel(), [undefined, s]), light.windup + 1, act('light')).fighters[1].posture;
  assert.ok(hurt({ poise: 100 }) < hurt(), 'a poise of 100 takes less posture from the same blow');
  const stamina = (s?: Record<string, number>) => { let d = withSheet(duel(), [s, undefined]); d = run(d, 3, act('light')); d = run(d, 80); return d.fighters[0].stamina; };
  assert.ok(stamina({ recovery: 100 }) >= stamina(), 'more recovery never regenerates less');
});

test('the dials the duel does not read yet (spellPower, magicResist, stamina, luck, focus) are carried and change nothing in a duel', () => {
  const carried = { spellPower: 90, magicResist: 90, stamina: 90, luck: 90, focus: 90 };
  assert.deepEqual(run(withSheet(duel(), [carried, carried]), 140, act('light')).fighters.map((f) => ({ ...f, sheet: undefined })), run(duel(), 140, act('light')).fighters.map((f) => ({ ...f, sheet: undefined })));
});

test('the first differing tick of a sheet fight against the same intents without one is the first blow, and it is named', () => {
  let a = withSheet(duel(), [{ attack: 75 }, undefined]), b = duel(), first = -1, event = '';
  for (let t = 1; t <= 90 && first < 0; t++) {
    a = stepDuel(a, [act('light'), idle()]); b = stepDuel(b, [act('light'), idle()]);
    if (a.fighters[1].health !== b.fighters[1].health) { first = t; event = a.events.map((e) => e.type).join(','); }
  }
  assert.equal(first, light.windup + 1, 'the health first differs on the tick the blow lands');
  assert.match(event, /Hit/);
});

test('gear rows: a tilt is a row (two dials, an amount held to 25), light / medium / heavy are three preset rows, a piece extends one, and the loader refuses a bad table', () => {
  assert.deepEqual(Object.values(GEAR.tilts).map((t) => [t.id, t.up, t.down, t.amount]), [['plate', 'armour', 'magicResist', 25], ['robes', 'magicResist', 'armour', 25]]);
  assert.deepEqual(['light', 'medium', 'heavy'].map((id) => [GEAR.rows[id]!.preset, GEAR.rows[id]!.tilt]), [[true, 'robes'], [true, null], [true, 'plate']]);
  assert.deepEqual(tiltOf('plate'), { armour: 25, magicResist: -25 }); assert.deepEqual(tiltOf('plate', 0.5), { armour: 13, magicResist: -13 }); assert.deepEqual(tiltOf('plate', 0), {});
  assert.throws(() => tiltOf('chain'), /not a tilt row/);
  const piece = { id: 'plate.body', slot: 'Body', extends: 'heavy', weight: 18, wearMax: 160, resist: { fire: 1, earth: -1 } };
  const t = loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, piece] });
  assert.deepEqual(t.rows['plate.body']!.resist, { fire: 1, earth: -1 }); assert.equal(t.rows['plate.body']!.tilt, 'plate', 'inherited from the preset');
  const withRow = (row: Record<string, unknown>) => () => loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, row] });
  const withTilt = (row: Record<string, unknown>) => () => loadGearDefs({ ...gearDefs, tilts: [...gearDefs.tilts, row] });
  assert.throws(withRow({ id: 'x', slot: 'Body', weight: 1, wearMax: 1, resist: { void: 1 } }), /resist void is a school row/);
  assert.throws(withRow({ id: 'x', weight: 1, wearMax: 1, resist: {} }), /names its slot/);
  assert.throws(withRow({ id: 'x', slot: 'Body', extends: 'plate', weight: 1, wearMax: 1, resist: {} }), /no preset row/);
  assert.throws(withRow({ id: 'light', weight: 1, wearMax: 1, resist: {} }), /duplicate-id/);
  assert.throws(withRow({ id: 'x', slot: 'Body', weight: 1, wearMax: 0, resist: {} }), /wearMax is at least 1/);
  assert.throws(withRow({ id: 'x', slot: 'Body', tilt: 'chain', weight: 1, wearMax: 1, resist: {} }), /unknown-ref/);
  assert.throws(withTilt({ id: 'mail', up: 'armour', down: 'armour', amount: 10 }), /two different dial rows/);
  assert.throws(withTilt({ id: 'mail', up: 'armour', down: 'agility', amount: 10 }), /two different dial rows/);
  assert.throws(withTilt({ id: 'mail', up: 'armour', down: 'poise', amount: 26 }), /amount is 1..25/);
  assert.doesNotThrow(withTilt({ id: 'mail', up: 'armour', down: 'poise', amount: 25 }), 'a fourth kind is a row');
});

test('schools are rows: the five and earth and wind, each with a colour, and a new school is one row away from a resist key', () => {
  assert.deepEqual([...SCHOOL_IDS].sort(), ['earth', 'fire', 'frost', 'holy', 'poison', 'shadow', 'wind']);
  for (const id of SCHOOL_IDS) assert.match(SCHOOLS[id]!, /^#[0-9a-f]{6}$/, id);
  const raw = { ...gearDefs, gear: [...gearDefs.gear, { id: 'x', slot: 'Body', weight: 1, wearMax: 1, resist: { lightning: 2 } }] };
  assert.doesNotThrow(() => loadGearDefs(raw, [...SCHOOL_IDS, 'lightning']));
});

test('a sheet fight records as v48 with its dials, round-trips, replays, and a sheet-less fight keeps its version', () => {
  assert.equal(RECORD_VERSION, FIRST_SHEET_VERSION);
  const sheet = { attack: 80, armour: 75, recovery: 60 };
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
  assert.throws(broken((u) => { u[at + 1] = 11; }), /unknown sheet/, 'a code no row has');
  assert.throws(broken((u) => { u[at + 2] = 0; }), /unknown sheet/, 'below the floor');
  assert.throws(broken((u) => { u[at + 2] = 101; }), /unknown sheet/, 'past the cap');
  assert.throws(broken((u) => { u[at + 2] = 50; }), /unknown sheet/, 'a pair at base is not how the writer says it');
  assert.throws(broken((u) => { u[at] = 4; }), /unknown sheet|truncated|length/, 'a count that runs into the level');
});
