// Series PR 4 (fail-first, written against Lead's interface 2026-10-13; rebase onto combat/world-hero when it lands): the hero's SHEET rides the world record's header.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SIM_VERSION, decodeWorldRecord, encodeWorldRecord, packWorldRecord, replayWorldRecord, unpackWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { RULES, DEFAULT_WEAPON, PLAYER_WEAPONS } from '../src/fight/moves.ts';
import { verifyWorldRecord } from '../origins/server/world-verify.ts';

const hero = { level: 1, attack: 1, res: 1, weapon: DEFAULT_WEAPON, health: RULES.health, stamina: 100, posture: 0, exhausted: false };
const step = { pose: { x: 0, z: 0, f: 0 }, guard: false, gd: null, attack: null, roll: null };
const rec = (h: Partial<WorldRecord['hero']> & { sheet?: Record<string, number> } = {}): WorldRecord => ({ rv: RECORD_VERSION, wv: WORLD_SIM_VERSION, hero: { ...hero, ...h } as WorldRecord['hero'], joins: [], releases: [], steps: [step, step] });
const SPAWN = { spec: { id: 'wolf-1', character: 'character:ash-wolf', level: 1 } } as never;

test('the header carries the sheet: pack and gzip round-trip it exactly, and no sheet stays no sheet', async () => {
  const sheet = { attack: 50, health: 20, sword: 30 };
  assert.deepEqual(unpackWorldRecord(packWorldRecord(rec({ sheet }))).hero.sheet, sheet);
  assert.deepEqual((await decodeWorldRecord(await encodeWorldRecord(rec({ sheet })))).hero.sheet, sheet);
  assert.equal(unpackWorldRecord(packWorldRecord(rec())).hero.sheet, undefined);
  assert.ok(packWorldRecord(rec({ sheet })).length - packWorldRecord(rec()).length <= 1 + 2 * 3 + 8, 'a count and (row, value) byte pairs, not JSON');
});

test('a record whose sheet is not the sheet the server expects is refused, an equal one is not', async () => {
  const text = (sheet?: Record<string, number>) => encodeWorldRecord(rec(sheet ? { sheet } : {}));
  const refused = await verifyWorldRecord(await text({ attack: 50 }), SPAWN, 'wolf', { sheet: { attack: 10 } } as never);
  assert.deepEqual(refused, { ok: false, reason: 'sheet' });
  const none = await verifyWorldRecord(await text(), SPAWN, 'wolf', { sheet: { attack: 10 } } as never);
  assert.deepEqual(none, { ok: false, reason: 'sheet' }, 'a record that claims less than the build holds is also not the expected sheet');
  const equal = await verifyWorldRecord(await text({ attack: 10 }), SPAWN, 'wolf', { sheet: { attack: 10 } } as never);
  assert.notEqual((equal as { reason?: string }).reason, 'sheet');
});

test('a record\'s weapon must be the character\'s held weapon or the default; any other is refused', async () => {
  const [other, third] = PLAYER_WEAPONS.filter((w) => w !== DEFAULT_WEAPON);
  assert.ok(other && third, 'two non-default player weapons exist');
  const reason = async (weapon: string, held: string) => (await verifyWorldRecord(await encodeWorldRecord(rec({ weapon })), SPAWN, 'wolf', { weapon: held }) as { reason?: string }).reason;
  assert.equal(await reason(other, DEFAULT_WEAPON), 'weapon', 'a weapon the character does not hold');
  assert.equal(await reason(third, other), 'weapon', 'neither the held weapon nor the default');
  assert.notEqual(await reason(DEFAULT_WEAPON, other), 'weapon', 'the default is fought until PR 5 lifts it');
  assert.notEqual(await reason(other, other), 'weapon', 'the held weapon');
});

test('the health bound widens to the sheet-sized maximum and no further', () => {
  const reason = (health: number, sheet?: Record<string, number>) => { const r = replayWorldRecord(rec({ health, ...(sheet ? { sheet } : {}) })); return r.ok ? 'ok' : r.reason; };
  assert.equal(reason(RULES.health * 2), 'hero body', 'no sheet: the plain maximum');
  assert.notEqual(reason(RULES.health * 2, { health: 100 }), 'hero body', 'health dial 100 is twice the fighter');
  assert.equal(reason(RULES.health * 2 + 1, { health: 100 }), 'hero body');
  assert.notEqual(reason(RULES.health * 1.5, { health: 50 }), 'hero body');
});
