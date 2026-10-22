// The Concord Exchange greybox as ROWS (World, Lead's ruling 2026-10-22: a town's geometry is data, so a town is a zone row and nothing else): exchange-rows.json holds every placed piece, awning, figure, brazier, the frieze and the hearth at
// the baseline world-data anchors, and for each number how it FOLLOWS an anchor (gate, bank, Covenant Stone, board, forge, the passage, the zone's width) or one of the four rule values the greybox was measured from. planFromRows() moves
// each number by weight x (the anchor now - its baseline), so a landmark moved in the world data still carries its pieces, exactly as the code that built them did (tests/exchange-rows.test.ts pins both to the frozen oracle). Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/neutral.ts';   // the neutral door, as frontier-plan-rules.ts
import DEFS from './exchange-rows.json' with { type: 'json' };
import MANIFEST from './exchange-rows.manifest.json' with { type: 'json' };
import type { Anchors, Layer, Piece, Plan, Shape, Tint } from './exchange-plan.ts';

type Follow = Readonly<Record<string, Readonly<Record<string, number>>>>;   // field -> {anchor id: weight}
type Row = { readonly id: string; readonly follow?: Follow };
export type PieceRow = Row & { readonly layer: Layer; readonly shape: Shape; readonly x: number; readonly y: number; readonly z: number; readonly tint: Tint; readonly rotY: number; readonly foot: number };
export type AwningRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly color: string };
export type PersonRow = Row & { readonly x: number; readonly z: number; readonly color: string };
export type BrazierRow = Row & { readonly x: number; readonly z: number };
export type MarkRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly text?: string };
export type ExchangeRows = { readonly anchors: readonly { id: string; base: number }[]; readonly pieces: readonly PieceRow[]; readonly awnings: readonly AwningRow[]; readonly people: readonly PersonRow[]; readonly braziers: readonly BrazierRow[]; readonly marks: readonly MarkRow[] };
/** The four rule values the greybox's shapes were measured from (stage-rules kerbInset and stoneRadius, preview-rules forgeHalfX and forgeHalfZ), read by exchange-plan.ts. */
export type Knobs = { readonly kerb: number; readonly stone: number; readonly forgeX: number; readonly forgeZ: number };

const TABLES = ['anchors', 'pieces', 'awnings', 'people', 'braziers', 'marks'] as const;
/** The one loader: every table keyed by id (a duplicate, a missing or mistyped field is refused), and every `follow` names an anchor row. */
export function loadExchangeRows(raw: Partial<Record<(typeof TABLES)[number], readonly unknown[]>>): ExchangeRows {
  loadRegistry(TABLES.map((t, i) => tableFromFile(MANIFEST.tables[i] as unknown as Manifest, { [t]: raw[t] }, 'exchange-rows.json')));
  const rows = raw as unknown as ExchangeRows, known = new Set(rows.anchors.map((r) => r.id));
  for (const t of TABLES.slice(1)) for (const r of rows[t] as readonly Row[]) for (const f of Object.values(r.follow ?? {})) for (const n of Object.keys(f)) if (!known.has(n)) throw Error(`exchange-rows ${t} "${r.id}": follows "${n}", which is no anchor row`);
  return rows;
}
export const EXCHANGE_ROWS = loadExchangeRows(DEFS);

/** The anchors and rule values as the rows name them. */
export const anchorValues = (a: Anchors, k: Knobs): Record<string, number> => ({
  'gate.x': a.gate.x, 'gate.z': a.gate.z, 'bank.x': a.bank.x, 'bank.z': a.bank.z, 'stone.x': a.stone.x, 'stone.z': a.stone.z, 'board.x': a.board.x, 'board.z': a.board.z, 'forge.x': a.forge.x, 'forge.z': a.forge.z,
  'passage.from': a.passage.from, 'passage.to': a.passage.to, 'passage.halfWidth': a.passage.halfWidth, halfWidth: a.halfWidth, kerb: k.kerb, stone: k.stone, forgeX: k.forgeX, forgeZ: k.forgeZ,
});

/** The plan the rows describe for these anchors: each number at its baseline plus weight x (anchor now - anchor at baseline). */
export function planFromRows(a: Anchors, k: Knobs, rows: ExchangeRows = EXCHANGE_ROWS): Plan {
  const now = anchorValues(a, k), delta: Record<string, number> = {};
  for (const r of rows.anchors) { if (!(r.id in now)) throw Error(`exchange-rows: anchor row "${r.id}" is read by nothing`); delta[r.id] = now[r.id]! - r.base; }
  const at = (v: number, r: Row, field: string): number => { let s = v; for (const [n, w] of Object.entries(r.follow?.[field] ?? {})) s += w * delta[n]!; return s; };
  const pieces: Piece[] = rows.pieces.map((r) => ({ layer: r.layer, shape: [r.shape[0], ...r.shape.slice(1).map((n, i) => at(n as number, r, `s${i + 1}`))] as Shape, x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), tint: [...r.tint] as Tint, rotY: at(r.rotY, r, 'rotY'), foot: at(r.foot, r, 'foot') }));
  const mark = (id: string) => { const r = rows.marks.find((m) => m.id === id); if (!r) throw Error(`exchange-rows: no "${id}" mark row`); return r; };
  const frieze = mark('frieze'), hearth = mark('hearth');
  return {
    pieces,
    awnings: rows.awnings.map((r) => ({ x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), color: r.color })),
    braziers: rows.braziers.map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z') })),
    people: rows.people.map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z'), color: r.color })),
    frieze: { x: at(frieze.x, frieze, 'x'), y: at(frieze.y, frieze, 'y'), z: at(frieze.z, frieze, 'z'), text: frieze.text ?? '' },
    hearth: { x: at(hearth.x, hearth, 'x'), y: at(hearth.y, hearth, 'y'), z: at(hearth.z, hearth, 'z') },
  };
}
