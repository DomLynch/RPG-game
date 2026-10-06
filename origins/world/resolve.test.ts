// Validation boundaries for every field, layering precedence, hostile ids, two-way links, and the add-a-group / version contract.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Obj } from '../contracts/core.ts';
import { CONCORD, CONCORD_REGION } from './concord.ts';
import { defaultsOf, loadWorld, resolveRegion, resolveZone, validate, type WorldData } from './resolve.ts';
import { SCHEMA, type Field, type Schema } from './schema.ts';

const R = 'region:test';
const world = (zone: unknown, region: unknown = {}, top?: unknown): WorldData =>
  ({ schemaVersion: 1, ...(top === undefined ? {} : { world: top }), regions: { [R]: { params: region, zones: { z: zone } } } }) as WorldData;
const codes = (r: { ok: boolean; issues?: { code: string; path: string }[] }) => (r.ok ? [] : r.issues!.map((i) => `${i.code} ${i.path}`));

test('an empty zone resolves to the schema defaults', () => {
  const r = resolveZone(world({}), R, 'z');
  assert.ok(r.ok);
  assert.deepEqual(r.value, defaultsOf(SCHEMA));
});

test('every numeric field: min and max pass, just outside fails, non-numbers fail', () => {
  for (const [g, group] of Object.entries(SCHEMA as Schema)) {
    if (!('fields' in group)) continue;
    for (const [k, f] of Object.entries(group.fields) as [string, Field][]) {
      if (f.t !== 'num' && f.t !== 'int') continue;
      const at = (value: unknown) => resolveZone(world({ [g]: { [k]: value } }), R, 'z');
      const step = f.t === 'int' ? 1 : 1e-9;
      for (const edge of [f.min, f.max]) {
        const r = at(edge); // in range; an edge may still break a cross-field rule with the other defaults (walk 6 > run 4.6)
        assert.ok(r.ok || r.issues.every((i) => i.code === 'rule-violation'), `${g}.${k}=${edge}: ${JSON.stringify(r)}`);
      }
      for (const bad of [f.min - step, f.max + step]) assert.deepEqual(codes(at(bad)), [`out-of-range z.${g}.${k}`], `${g}.${k}=${bad}`);
      for (const bad of ['1', NaN, Infinity, null, true]) assert.deepEqual(codes(at(bad)), [`wrong-type z.${g}.${k}`], `${g}.${k}=${String(bad)}`);
      if (f.t === 'int') assert.deepEqual(codes(at(f.min + 0.5)), [`wrong-type z.${g}.${k}`]);
    }
  }
});

test('landmarks: u/v outside 0..1, bad names and dangling refs are refused', () => {
  assert.deepEqual(codes(resolveZone(world({ layout: { a: { u: 1.01 } } }), R, 'z')), ['out-of-range z.layout.a.u']);
  assert.deepEqual(codes(resolveZone(world({ layout: { a: { v: -0.01 } } }), R, 'z')), ['out-of-range z.layout.a.v']);
  assert.deepEqual(codes(resolveZone(world({ layout: { A: {} } }), R, 'z')), ['wrong-type z.layout.A']);
  assert.deepEqual(codes(resolveZone(world({ spawns: { boss: 'nowhere' } }), R, 'z')), ['unknown-id z.spawns.boss']);
  assert.deepEqual(codes(resolveZone(world({ passages: { p: { width: 2 } } }), R, 'z')), ['missing-field z.passages.p.from']);
  assert.deepEqual(codes(resolveZone(world({ layout: { a: {} }, passages: { p: { from: 'a', width: 50 } }, zoneSize: { width: 40 } }), R, 'z')), ['rule-violation z.passages.p.width']);
  assert.deepEqual(codes(resolveZone(world({ layout: { a: { colour: 1 } } }), R, 'z')), ['unknown-field z.layout.a.colour']);
});

test('cross-field rules', () => {
  const rule = (zone: unknown) => codes(resolveZone(world(zone), R, 'z'));
  assert.deepEqual(rule({ movement: { walkSpeed: 5, runSpeed: 4 } }), ['rule-violation z.movement.runSpeed']);
  assert.deepEqual(rule({ view: { fogNear: 200, fogFar: 100 } }), ['rule-violation z.view.fogNear']);
  assert.deepEqual(rule({ view: { drawDistance: 30 } }), ['rule-violation z.view.backdropRadius']);
  assert.deepEqual(rule({ terrain: { heightMin: 5 } }), ['rule-violation z.terrain.heightMin']);
  assert.deepEqual(rule({ rules: { safe: true, pvp: true } }), ['rule-violation z.rules.pvp']);
  assert.deepEqual(rule({ difficulty: { levelMin: 9, levelMax: 3 } }), ['rule-violation z.difficulty.levelMin']);
  assert.deepEqual(rule({ economy: { buyMultiplier: 1, sellMultiplier: 1.5 } }), ['rule-violation z.economy.sellMultiplier']);
  assert.deepEqual(rule({ connections: { x: { to: 'z', kind: 'bridge', here: 'nope', there: 'a' } } }), ['wrong-type z.connections.x.kind', 'unknown-id z.connections.x.here']);
});

test('layering: zone beats region beats world beats schema default, field by field', () => {
  const r = resolveZone(world({ movement: { walkSpeed: 3 } }, { movement: { walkSpeed: 2, turnRate: 2.5 } }, { movement: { walkSpeed: 1, runSpeed: 7, turnRate: 1 } }), R, 'z');
  assert.ok(r.ok);
  assert.deepEqual(r.value.movement, { walkSpeed: 3, runSpeed: 7, turnRate: 2.5 });
  // landmarks merge by name, and field by field inside one landmark
  const l = resolveZone(world({ layout: { a: { v: 0.9 }, b: {} } }, { layout: { a: { u: 0.1, v: 0.2 } } }), R, 'z');
  assert.ok(l.ok);
  assert.deepEqual(l.value.layout, { a: { u: 0.1, v: 0.9, facing: 0 }, b: { u: 0.5, v: 0.5, facing: 0 } });
  // validated after the merge: a region value that only becomes legal with the zone's own value is fine
  assert.ok(resolveZone(world({ movement: { runSpeed: 6 } }, { movement: { walkSpeed: 5.5 } }), R, 'z').ok);
});

test('rules flags are honoured through the layers', () => {
  const region = { rules: { safe: true, tradeAllowed: false } };
  const plain = resolveZone(world({}, region), R, 'z'), opened = resolveZone(world({ rules: { tradeAllowed: true, mountsAllowed: true } }, region), R, 'z');
  assert.ok(plain.ok && opened.ok);
  assert.deepEqual(plain.value.rules, { safe: true, pvp: false, restAllowed: true, tradeAllowed: false, mountsAllowed: false });
  assert.deepEqual(opened.value.rules, { safe: true, pvp: false, restAllowed: true, tradeAllowed: true, mountsAllowed: true });
  // a zone cannot turn on PvP under a safe region without also lifting safe
  assert.deepEqual(codes(resolveZone(world({ rules: { pvp: true } }, region), R, 'z')), ['rule-violation z.rules.pvp']);
  assert.ok(resolveZone(world({ rules: { pvp: true, safe: false } }, region), R, 'z').ok);
  const concord = resolveRegion(CONCORD, CONCORD_REGION);
  assert.ok(concord.ok);
  for (const zone of concord.value.values()) assert.equal(zone.rules.safe, true);
});

test('hostile ids and keys are refusals, never lookups through the prototype', () => {
  const data = world({});
  for (const id of ['region:__proto__', 'region:constructor', '__proto__', 'item:x', 'region:Test', 7, null, undefined]) {
    const r = resolveZone(data, id, 'z');
    assert.equal(r.ok, false, String(id));
  }
  for (const id of ['__proto__', 'constructor', 'toString', 'Z', '', 'z/../z', 3, {}]) assert.equal(resolveZone(data, R, id).ok, false, String(id));
  // JSON can carry an own "__proto__" key: refused as a field, and the merged object keeps Object.prototype
  const evil = JSON.parse('{"__proto__": {"polluted": 1}, "layout": {"__proto__": {"u": 0.2}, "constructor": {"u": 0.3}}}') as Obj;
  const r = resolveZone(world(evil), R, 'z');
  assert.deepEqual(codes(r), ['unknown-field z.__proto__', 'wrong-type z.layout.__proto__']);
  assert.equal(({} as Obj).polluted, undefined);
  // a landmark called "constructor" is just a name; a ref to "toString" with no such landmark is unknown, not Object.prototype's
  assert.ok(resolveZone(world({ layout: { constructor: {} }, spawns: { boss: 'constructor' } }), R, 'z').ok);
  assert.deepEqual(codes(resolveZone(world({ spawns: { boss: 'tostring' } }), R, 'z')), ['unknown-id z.spawns.boss']);
  assert.equal(loadWorld(JSON.parse('{"schemaVersion":1,"regions":{"__proto__":{"zones":{}}}}')).ok, false);
  assert.equal(loadWorld({ schemaVersion: 1, regions: { [R]: { zones: { 'Bad Zone': {} } } } }).ok, false);
});

test('connections: targets must exist, far landmarks must exist, two-way links must be answered', () => {
  const region = (a: unknown, b: unknown): WorldData => ({ schemaVersion: 1, regions: { [R]: { zones: { a: a as Obj, b: b as Obj } } } }) as WorldData;
  const A = { layout: { door: {} }, connections: { b: { to: 'b', here: 'door', there: 'door' } } }, B = { layout: { door: {} }, connections: { a: { to: 'a', here: 'door', there: 'door' } } };
  assert.ok(resolveRegion(region(A, B), R).ok);
  assert.deepEqual(codes(resolveRegion(region(A, { layout: { door: {} } }), R)), ['rule-violation a.connections.b']);
  assert.ok(resolveRegion(region({ ...A, connections: { b: { ...A.connections.b, twoWay: false } } }, { layout: { door: {} } }), R).ok);
  assert.deepEqual(codes(resolveRegion(region({ ...A, connections: { c: { to: 'c', here: 'door', there: 'door' } } }, B), R)), ['unknown-id a.connections.c.to', 'rule-violation b.connections.a']);
  assert.deepEqual(codes(resolveRegion(region({ ...A, connections: { b: { to: 'b', here: 'door', there: 'gate' } } }, B), R)), ['unknown-id a.connections.b.there', 'rule-violation b.connections.a']);
});

test('versions: schemaVersion is required, newer is refused, older goes through the migration table', () => {
  assert.deepEqual(codes(loadWorld({ regions: {} })), ['missing-version schemaVersion']);
  assert.deepEqual(codes(loadWorld({ schemaVersion: 2, regions: {} })), ['unsupported-version schemaVersion']);
  assert.deepEqual(codes(loadWorld({ schemaVersion: 1, regions: {} }, {}, 2)), ['no-migration schemaVersion']);
  const up = loadWorld({ schemaVersion: 1, regions: {} }, { 1: (d: Obj) => ({ ...d, regions: { [R]: { zones: { z: {} } } } }) }, 2);
  assert.ok(up.ok);
  assert.equal(up.value.schemaVersion, 2);
  assert.deepEqual(Object.keys(up.value.regions[R]!.zones), ['z']);
  assert.deepEqual(codes(resolveZone(up.value, R, 'z')), ['unsupported-version schemaVersion']); // this build reads v1 only
});

test('adding a group is one schema entry: a v1 zone file that omits it still loads and resolves, untouched', () => {
  const v1Zone = JSON.stringify({ schemaVersion: 1, regions: { [R]: { zones: { z: { movement: { walkSpeed: 2 }, layout: { a: {} } } } } } });
  const extended = { ...SCHEMA, banners: { doc: 'a new group #16', fields: { count: { t: 'int', unit: 'banners', min: 0, max: 40, def: 3, doc: 'banners hung' } } } } as const satisfies Schema;
  const data = loadWorld(JSON.parse(v1Zone));
  assert.ok(data.ok);
  const r = resolveZone(data.value, R, 'z', extended);
  assert.ok(r.ok);
  assert.equal(r.value.banners.count, 3);
  assert.equal(r.value.movement.walkSpeed, 2);
  assert.equal(JSON.stringify(data.value), v1Zone); // the file was not rewritten
  // and the new group is validated like any other
  assert.deepEqual(codes(validate({ ...defaultsOf(extended), banners: { count: 41 } }, extended)), ['out-of-range banners.count']);
});
