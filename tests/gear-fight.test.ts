// THE SHEET counts in a fight (Wave A1 PR1, RV48; Dom's LOCKED sheet): level 1 to 50, ten dials and any number of skills on a 50-to-100 line, ONE point a level (50 a career) on any dial or skill, a worn
// set worth 50 more (25 shape, 25 quality). The duel reads attack, armour, health, poise and recovery from the dial ROWS. These tests pin the bar: the naked fight is the fight it was (byte for byte), a
// dial never moves a duration, ONE validator holds the build (no number past 100, no point past 50 a career), a record cannot smuggle a sheet past the verifiers, a new dial / skill / set / school / piece
// is a row, and a recorded sheet fight replays with its first differing tick named.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, stepDuel, withSheet, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { MOVES, RULES } from '../src/fight/moves.ts';
import { TARGET } from '../src/fight/sim.ts';
import { DIALS, POINTS, SHEET_SKILLS, checkSheet, pointsAt, sheetOf, statDown, statUp, statValue, validateBuild } from '../src/fight/sheet-rows.ts';
import { GEAR, gearDeltas, loadGearDefs } from '../src/fight/gear-rows.ts';
import { SCHOOLS, SCHOOL_IDS } from '../src/fight/schools.ts';
import { createRecorder, encodeRecord, packRecord, unpackRecord, FIRST_SHEET_VERSION, RECORD_VERSION } from '../src/fight/record.ts';
import { sheetRefusal, verifyRecord } from '../src/fight/replay.ts';
import { verifyEncounter } from '../origins/server/encounter-verify.ts';
import { refusal } from '../scripts/verify-loot.mjs';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import gearDefs from '../src/fight/gear-defs.json' with { type: 'json' };

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action): Intent => ({ ...idle(), action });
const duel = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
const run = (d: Duel, n: number, a: Intent = idle(), b: Intent = idle()): Duel => { for (let i = 0; i < n; i++) d = stepDuel(d, [a, b]); return d; };
const light = MOVES.light_right;

test('the sheet rows: ten dials on a 50 base with a 100 cap, ONE pool of a point a level up to 50 (and 50 of gear), skills as rows on the same line, codes 1..n, and no dial names a timing', () => {
  assert.deepEqual(DIALS.map((d) => d.id), ['attack', 'spellPower', 'armour', 'magicResist', 'health', 'stamina', 'poise', 'luck', 'focus', 'recovery']);
  assert.deepEqual(DIALS.map((d) => d.code), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const d of DIALS) { assert.equal(d.base, 50, d.id); assert.equal(d.cap, 100, `${d.id}: a player number past 100 fails review`); assert.ok(!/tick|window|windup|duration/i.test(d.id), `${d.id}: no dial names a timing`); }
  assert.deepEqual({ perLevel: POINTS.perLevel, maxLevel: POINTS.maxLevel, total: POINTS.total, gear: POINTS.gear }, { perLevel: 1, maxLevel: 50, total: 50, gear: 50 });
  assert.equal(pointsAt(1), 1, 'level 1 already carries its point'); assert.equal(pointsAt(50), 50); assert.equal(pointsAt(60), 50, 'never past 50 in a career');
  for (const s of SHEET_SKILLS) { assert.equal(s.base, 50, `${s.id}: anyone wields anything at half effect`); assert.equal(s.cap, 100, s.id); }
  for (const school of SCHOOL_IDS) assert.ok(SHEET_SKILLS.some((s) => s.id === school), `${school}: one skill per magic school`);
  for (const weapon of ['sword', 'axe', 'spear', 'bow']) assert.ok(SHEET_SKILLS.some((s) => s.id === weapon), weapon);
});

test('ONE build validator: a legal build passes; a dial or skill past 100, points past the level\'s budget (dials and skills share it), a bad skill value, an unknown row and a bad level are each refused', () => {
  assert.deepEqual(validateBuild({ level: 50, placed: { attack: 50 } }), [], 'all 50 points on one dial maxes it');
  assert.deepEqual(validateBuild({ level: 50, placed: { attack: 20, health: 10, sword: 20 }, values: { sword: 60 } }), []);
  assert.deepEqual(validateBuild({ level: 1, placed: {} }), []);
  assert.deepEqual(validateBuild({ level: 1, placed: { sword: 1 }, values: { sword: 51 } }), [], 'a skill value fills up to its ceiling');
  assert.match(validateBuild({ level: 50, placed: { attack: 51 } }).join(), /past its cap 100/);
  assert.match(validateBuild({ level: 50, placed: { sword: 51 } }).join(), /past its cap 100/);
  assert.match(validateBuild({ level: 50, placed: { attack: 50, health: 1 } }).join(), /51 points placed, the budget at level 50 is 50/);
  assert.match(validateBuild({ level: 10, placed: { attack: 5, sword: 6 } }).join(), /11 points placed, the budget at level 10 is 10/);
  assert.match(validateBuild({ level: 1, placed: { attack: 2 } }).join(), /budget at level 1 is 1/);
  assert.match(validateBuild({ level: 10, placed: { sword: 5 }, values: { sword: 56 } }).join(), /its value 56.*ceiling 55/);
  assert.match(validateBuild({ level: 10, placed: { sword: 5 }, values: { sword: 49 } }).join(), /its value 49/);
  assert.match(validateBuild({ level: 10, placed: {}, values: { attack: 60 } }).join(), /not a skill row/);
  assert.match(validateBuild({ level: 10, placed: { attack: -1 } }).join(), /whole number from 0/);
  assert.match(validateBuild({ level: 10, placed: { attack: 1.5 } }).join(), /whole number from 0/);
  assert.match(validateBuild({ level: 10, placed: { agility: 5 } }).join(), /not a dial or skill row/);
  assert.match(validateBuild({ level: 0, placed: {} }).join(), /from 1 to 50/);
  assert.match(validateBuild({ level: 51, placed: {} }).join(), /from 1 to 50/);
  assert.throws(() => sheetOf({ level: 1, placed: { attack: 40 } }), /budget/);
});

test('a build resolves to a sheet: placed points above 50 on the dials (skills are not dials), the worn set\'s deltas on top held between each dial\'s floor and 100, dials at base absent, nothing at all is no sheet', () => {
  assert.equal(sheetOf({ level: 1, placed: {} }), undefined);
  assert.equal(sheetOf({ level: 50, placed: { sword: 50 } }), undefined, 'a skill is not a dial');
  assert.deepEqual(sheetOf({ level: 50, placed: { attack: 30, health: 20 } }), { attack: 80, health: 70 });
  assert.deepEqual(sheetOf({ level: 50, placed: { armour: 30 } }, { armour: 25, magicResist: -25 }), { armour: 100, magicResist: 25 }, 'plate adds 25 to an armour of 80 but never past the cap');
  assert.deepEqual(sheetOf({ level: 1, placed: {} }, { armour: -25, magicResist: 25 }), { armour: 25, magicResist: 75 });
  assert.equal(sheetOf({ level: 50, placed: { armour: 25 } }, { armour: -25 }), undefined, 'gear that cancels the placed points leaves the dial at its base');
  assert.deepEqual(sheetOf({ level: 1, placed: {} }, { armour: -49 }), { armour: 1 }, 'floored at the dial\'s floor, never zero');
  assert.throws(() => sheetOf({ level: 1, placed: {} }, { agility: 5 }), /not a dial row/);
});

test('a sheet is validated by the same validator: whole numbers from floor to 100, known ids, and the points it accounts for fit a career plus the gear pool - so a forged all-100 sheet is refused, not just bounded dial by dial', () => {
  assert.throws(() => checkSheet({ timing: 80 }), /not a dial row/);
  assert.throws(() => checkSheet({ attack: 0 }), /from 1 to 100/);
  assert.throws(() => checkSheet({ attack: 101 }), /from 1 to 100/);
  assert.throws(() => checkSheet({ attack: 60.5 }), /whole number/);
  const all = Object.fromEntries(DIALS.map((d) => [d.id, 100]));
  assert.throws(() => checkSheet(all), /500 points placed, the budget at level 50 is 50 \(\+50 gear\)/);
  assert.throws(() => checkSheet({ attack: 100, armour: 100, health: 60 }), /110 points placed/);
  assert.deepEqual(checkSheet({ attack: 100, armour: 100 }), { attack: 100, armour: 100 }, '50 career points and 50 of gear is the most a sheet can account for');
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
  const sheet = { health: 100, poise: 100 };   // 50 career points + 50 of gear is the most a sheet accounts for
  const fat = withSheet(duel(), [sheet, undefined]);
  assert.equal(fat.fighters[0].maxHealth, RULES.health * 2); assert.equal(fat.fighters[0].health, RULES.health * 2);
  assert.equal(withSheet(duel(), [{ recovery: 100 }, undefined]).fighters[0].regen, duel().fighters[0].regen * 2);
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
  const carried = { spellPower: 60, magicResist: 60, stamina: 60, luck: 60, focus: 60 };
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

test('gear rows: a set is shape (dials up and down, held to 25) plus quality (25 spread by weights); light / medium / heavy are three preset rows; a worn set resolves to dial deltas; the loader refuses a bad table', () => {
  assert.deepEqual(Object.values(GEAR.sets).map((t) => [t.id, t.shape]), [['plate', { armour: 25, magicResist: -25 }], ['robes', { magicResist: 25, armour: -25 }], ['leathers', { stamina: 25, armour: -25 }]]);
  assert.deepEqual(['light', 'medium', 'heavy'].map((id) => [GEAR.rows[id]!.preset, GEAR.rows[id]!.set]), [[true, 'leathers'], [true, null], [true, 'plate']]);
  assert.equal(GEAR.owners.veteran, 'plate'); assert.equal(GEAR.owners.witch, 'robes');
  const quality = (d: Record<string, number>, set: string, c = 1) => Object.entries(d).reduce((n, [dial, v]) => n + v - Math.sign(GEAR.sets[set]!.shape[dial] ?? 0) * Math.round(Math.abs(GEAR.sets[set]!.shape[dial] ?? 0) * c), 0);   // what is left of the deltas after the (scaled) shape
  assert.deepEqual(gearDeltas('plate', 1, 0), { armour: 25, magicResist: -25 }, 'a full COMMON set is all shape and no quality');
  assert.equal(quality(gearDeltas('plate', 1, 1), 'plate'), 25, 'a full LEGENDARY set adds the whole 25 of quality');
  assert.deepEqual(gearDeltas('plate', 1, 1), { armour: 35, magicResist: -25, health: 10, poise: 5 }, 'spread over armour 2 : health 2 : poise 1');
  assert.equal(quality(gearDeltas('plate', 0.5, 0.5), 'plate', 0.5), 13); assert.equal(gearDeltas('plate', 0.5, 0.5).magicResist, -13);
  assert.equal(quality(gearDeltas('robes', 0.3, 0.3), 'robes', 0.3), Math.round(25 * 0.3), 'the points are always all spent (largest remainder)');
  assert.deepEqual(gearDeltas('plate', 0), {});
  assert.deepEqual(sheetOf({ level: 50, placed: { armour: 50 } }, gearDeltas('plate', 1, 1)), { armour: 100, magicResist: 25, health: 60, poise: 55 }, 'a 100-armour build\'s plate pays into health and poise instead');
  assert.throws(() => gearDeltas('chain'), /not a set row/);
  const piece = { id: 'plate.body', slot: 'Body', extends: 'heavy', weight: 18, wearMax: 160, resist: { fire: 1, earth: -1 } };
  const t = loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, piece] });
  assert.deepEqual(t.rows['plate.body']!.resist, { fire: 1, earth: -1 }); assert.equal(t.rows['plate.body']!.set, 'plate', 'inherited from the preset');
  const withRow = (row: Record<string, unknown>) => () => loadGearDefs({ ...gearDefs, gear: [...gearDefs.gear, row] });
  const withSet = (row: Record<string, unknown>) => () => loadGearDefs({ ...gearDefs, sets: [...gearDefs.sets, row] });
  assert.throws(withRow({ id: 'x', slot: 'Body', weight: 1, wearMax: 1, resist: { void: 1 } }), /resist void is a school row/);
  assert.throws(withRow({ id: 'x', weight: 1, wearMax: 1, resist: {} }), /names its slot/);
  assert.throws(withRow({ id: 'x', slot: 'Body', extends: 'plate', weight: 1, wearMax: 1, resist: {} }), /no preset row/);
  assert.throws(withRow({ id: 'light', weight: 1, wearMax: 1, resist: {} }), /duplicate-id/);
  assert.throws(withRow({ id: 'x', slot: 'Body', weight: 1, wearMax: 0, resist: {} }), /wearMax is at least 1/);
  assert.throws(withRow({ id: 'x', slot: 'Body', set: 'chain', weight: 1, wearMax: 1, resist: {} }), /unknown-ref/);
  assert.throws(withSet({ id: 'mail', shape: { armour: 10, agility: -10 }, quality: { armour: 1 } }), /shape agility is a dial row/);
  assert.throws(withSet({ id: 'mail', shape: { armour: 26, poise: -26 }, quality: { armour: 1 } }), /shape armour is a dial row.*within \+-25/);
  assert.throws(withSet({ id: 'mail', shape: { armour: 20, health: 20 }, quality: { armour: 1 } }), /moves some dials up \(at most 25 in all\) against some down/);
  assert.throws(withSet({ id: 'mail', shape: { armour: 10, poise: -10 }, quality: {} }), /quality names the dials/);
  assert.doesNotThrow(withSet({ id: 'mail', shape: { armour: 10, poise: -10 }, quality: { armour: 1 } }), 'a fourth kind is a row');
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
  assert.equal(verifyRecord(a, undefined, { sheet: 'trust' }).ok, true);
  const at = bytes.length - 6 * 30 - (1 + 4 + 4 + 1) - (1 + 2 * 3 + 1 + 0 + 4);   // the sheet block: count, (code, value) x 3, an empty character id and a zero build version, just before level
  assert.equal(bytes[at], 3, 'three pairs');
  const broken = (edit: (u: Uint8Array) => void) => { const u = bytes.slice(); edit(u); return () => unpackRecord(u); };
  assert.throws(broken((u) => { u[at + 1] = 11; }), /unknown sheet/, 'a code no row has');
  assert.throws(broken((u) => { u[at + 2] = 0; }), /unknown sheet/, 'below the floor');
  assert.throws(broken((u) => { u[at + 2] = 101; }), /unknown sheet/, 'past the cap');
  assert.throws(broken((u) => { u[at + 2] = 50; }), /unknown sheet/, 'a pair at base is not how the writer says it');
  assert.throws(broken((u) => { u[at] = 4; }), /unknown sheet|truncated|length/, 'a count that runs into the level');
  const ref = createRecorder({ ...meta, sheet, characterId: 'char-42_a', buildVersion: 7 }); for (let i = 0; i < 30; i++) ref.push(idle());
  const withRef = ref.finish('abandoned');
  assert.deepEqual(unpackRecord(packRecord(withRef)), withRef, 'the record names the stored build it claims (character id + build version), so the sweep loads that exact version');
  assert.equal(withRef.characterId, 'char-42_a'); assert.equal(withRef.buildVersion, 7);
  assert.equal(unpackRecord(packRecord(a)).characterId, undefined, 'neither means the default build');
  assert.throws(() => createRecorder({ ...meta, sheet, characterId: 'char-42_a' }), /together/, 'an id without a version');
  assert.throws(() => createRecorder({ ...meta, sheet, characterId: 'char-42_a', buildVersion: 0 }), /together/, 'versions start at 1');
  assert.throws(() => createRecorder({ ...meta, sheet, characterId: 'has space', buildVersion: 1 }), /together/);
  assert.throws(() => createRecorder({ ...meta, characterId: 'char-42_a', buildVersion: 1 }), /together/, 'a build reference with no sheet is nothing to check');
  const refBytes = packRecord(withRef), refAt = refBytes.length - 6 * 30 - (1 + 4 + 4 + 1) - (1 + 2 * 3 + 1 + 9 + 4);
  assert.equal(refBytes[refAt + 7], 9, 'the id\'s length byte follows the pairs');
  const zeroVersion = refBytes.slice(); zeroVersion.fill(0, refBytes.length - 6 * 30 - 10 - 4, refBytes.length - 6 * 30 - 10);
  assert.throws(() => unpackRecord(zeroVersion), /unknown sheet/, 'a named character with build version 0');
  const spent = Object.fromEntries(DIALS.map((d) => [d.id, 100]));
  assert.throws(() => createRecorder({ ...meta, sheet: spent }), /budget/, 'a forged all-100 sheet cannot even be written');
  const forged = bytes.slice(); forged[at] = 3; forged[at + 2] = 100; forged[at + 4] = 100; forged[at + 6] = 100;   // attack, armour, recovery at 100: 150 points, past a career plus the gear pool
  assert.throws(() => unpackRecord(forged), /unknown sheet/, 'and one forged in the bytes is refused on read');
});

test('the verifiers do not take a sheet on trust: a record that carries one is REFUSED by default (verifyRecord, the encounter verifier, the loot sweep) until the server holds the player\'s build', async () => {
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);
  const meta = { build: 't', opponent: 'veteran' as const, weapon: 'longsword' as const, level: 1, seed: 7 };
  const mk = (sheet?: Record<string, number>) => { const r = createRecorder({ ...meta, ...(sheet ? { sheet } : {}) }); for (let i = 0; i < 30; i++) r.push(idle()); return r.finish('abandoned'); };
  const within = mk({ attack: 100, armour: 100 }), plain = mk();   // 100 points: a within-budget claim the validator cannot tell from a real one
  assert.match(verifyRecord(within).ok ? '' : (verifyRecord(within) as { reason: string }).reason, /carries a sheet.*no build/);
  assert.equal(verifyRecord(within, undefined, { sheet: 'trust' }).ok, true, 'a page checking its own fight before it shares it');
  assert.equal(verifyRecord(within, undefined, { sheet: { attack: 100, armour: 100 } }).ok, true, 'the sheet the server derives from the stored build equals the record\'s');
  assert.match((verifyRecord(within, undefined, { sheet: { attack: 100, armour: 90 } }) as { reason: string }).reason, /not the one the player/);
  assert.equal(sheetRefusal(plain), null); assert.equal(verifyRecord(plain).ok, true, 'a record without a sheet is not affected');
  const p = { enemy: 'veteran', level: 1, seed: 7, layer: null, flags: [], bar: null, pose: null } as never;
  const e = verifyEncounter(within, p);
  assert.equal(e.ok, false); assert.match((e as { reason: string }).reason, /carries a sheet/);
  const row = { opponent: 'veteran', record: await encodeRecord({ ...within, outcome: 'killed' }) };
  assert.match(String(await refusal(row, { marks: 0, owned: [] })), /carries a sheet/, 'the loot sweep: a killed claim with a sheet never reaches a payout');
});
