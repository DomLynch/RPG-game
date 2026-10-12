// Lot kinds and trades are ROWS (origins/region1/towns.json definitions, manifest in towns.manifest.json): the generated towns are byte for byte the old code's, the manifest is enforced, no kind or trade
// name is compared in code, and a new trade with its chimney and sign, or a new lot kind, is one row. Pure: no three.js, no DOM.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateTown } from './town.ts';
import { kitPiece } from './town-kit.ts';
import { TOWN_DEFS, defsProblems, shopTrades, type TownDefs } from './town-defs.ts';
import towns from '../region1/towns.json' with { type: 'json' };

const SEEDS = ['ferry', 'cinder', 'mere-end', 'a', 'z9', 'Frankendom', 'x', 'town:exchange-quarter', '0', 'ash reach'], WEALTHS = [-1, 0, 0.05, 0.1, 0.25, 0.333, 0.5, 0.6, 0.75, 0.9, 1, 2];
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const withRows = (edit: (d: { lotKinds: Record<string, Record<string, unknown>>; trades: Record<string, Record<string, unknown>> }) => void): TownDefs => { const d = structuredClone(TOWN_DEFS) as unknown as Parameters<typeof edit>[0]; edit(d); return d as unknown as TownDefs; };

test('the generated towns are the closed-list code\'s towns (10 seeds x 12 wealths, pinned before the move to rows): every lot, kind, ring, trade and piece, in order', () => {
  // The coordinates are floats from Math.sin/cos, which differ between Node versions (the whole-town hash is 674c7fb45c8d0a14 on Node 25 and 04d52981ca469571 on Node 22, for the OLD code and the new alike),
  // so the pin is the structure, which does not: ids, kinds, rings, trades and each lot's piece nodes, variants and slots (the variants are the rng stream, so any change in draw order shows here).
  const all = SEEDS.flatMap((s) => WEALTHS.map((w) => generateTown(s, w).lots.map((l) => [l.id, l.kind, l.ring, l.trade ?? null, l.pieces.map((p) => [p.node, p.variant, p.slot ?? null])])));
  assert.equal(sha(all), '74daaee5d70e07d5'); assert.equal(all.reduce((n, t) => n + t.length, 0), 3288);
});

test('the kit pieces chosen for those towns are unchanged (the bank sign and counter, the gate arch, the inn and smithy signs are rows now)', () => {
  const out = ['ferry', 'cinder', 'mere-end', 'a', 'z9', 'Frankendom'].flatMap((s) => [0, 0.1, 0.33, 0.5, 0.75, 1].flatMap((w) => generateTown(s, w).lots.flatMap((l) => l.pieces.map((p) => kitPiece(p, l)))));
  assert.equal(sha(out), '1c2afb80828c2c09'); assert.equal(out.length, 11234);
});

test('the manifest holds for the real definitions, and names a missing field, a wrong type and a duplicate order', () => {
  assert.deepEqual(defsProblems(towns.definitions as never), []);
  const bad = structuredClone(towns.definitions) as Record<string, Record<string, Record<string, unknown>>>;
  delete bad.lotKinds!.shop!.ring; bad.lotKinds!.house!.walls = 'yes'; bad.trades!.inn!.order = bad.trades!.smith!.order;
  const text = defsProblems(bad).join('; ');
  assert.match(text, /lotKinds\.shop: missing ring/); assert.match(text, /lotKinds\.house\.walls: expected boolean, got string/); assert.match(text, /trades: order 0 is on both smith and inn/);
});

test('no lot kind or trade name is compared in the generator or the kit mapping', () => {
  for (const f of ['town.ts', 'town-kit.ts']) { const code = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n'); assert.doesNotMatch(code, /\b(?:kind|trade)\s*[!=]==?\s*'/, `${f} compares a kind or trade name`); assert.doesNotMatch(code, /type LotKind = '/, `${f}: LotKind is a string, not a union`); }
});

test('the shop trades are the rows flagged shop, in order: the services stay trades but are not shops', () => {
  assert.deepEqual(shopTrades(TOWN_DEFS), ['smith', 'general', 'apothecary', 'inn', 'tailor', 'fletcher', 'chandler', 'baker', 'cooper', 'jeweller']);
  assert.ok('healer' in TOWN_DEFS.trades && 'fence' in TOWN_DEFS.trades && !TOWN_DEFS.trades.healer!.shop);
});

test('a new trade with its chimney and sign is ONE ROW: the weaver gets shops, a chimney piece and its kit sign, with no code', () => {
  const defs = withRows((d) => { d.trades.weaver = { shop: true, order: 2.5, chimney: true, kit: { sign: 'sign_tavern_a' } }; });
  assert.deepEqual(defsProblems(defs as never), []);
  const town = generateTown('ferry', 1, defs), weavers = town.lots.filter((l) => l.trade === 'weaver');
  assert.ok(weavers.length >= 1, 'a weaver shop is generated');
  for (const l of weavers) { assert.ok(l.pieces.some((p) => p.node === 'chimney'), 'with a chimney'); assert.equal(kitPiece(l.pieces.find((p) => p.node === 'sign')!, l, defs), 'sign_tavern_a', 'and its own sign'); }
  assert.ok(!generateTown('ferry', 1).lots.some((l) => l.trade === 'weaver'), 'the real definitions have no weaver');
});

test('a new lot kind is ONE ROW: a chapel in ring 2 (placed before the houses fill the ring) with its own kit sign', () => {
  const defs = withRows((d) => { d.lotKinds.chapel = { order: 3.5, ring: 2, count: [2, 0], size: { w: [6, 0, 0], d: [6, 0, 0] }, walls: true, sign: true, kit: { sign: 'sign_smith_a' } }; });
  assert.deepEqual(defsProblems(defs as never), []);
  const chapels = generateTown('cinder', 1, defs).lots.filter((l) => l.kind === 'chapel');
  assert.ok(chapels.length >= 1 && chapels.every((l) => l.ring === 2 && l.id.startsWith('chapel-')));
  for (const l of chapels) assert.equal(kitPiece(l.pieces.find((p) => p.node === 'sign')!, l, defs), 'sign_smith_a');
});
