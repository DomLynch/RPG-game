// The kill-link guard's digest over CONTENT, not paths (Lead, 2026-10-09): moving sim code into src/fight/ byte for byte must keep RECORD_VERSION,
// while any real change still demands a bump. Each sim file's top-level statements are printed without comments and hashed as one sorted list,
// so a statement moved to another file (or a file split or renamed) leaves the digest alone. Import lines are paths, not behaviour, and are left
// out, except what an import line alone can rebind: an aliased name (`a as b`) and a non-TypeScript file's bytes. That is sound only while every
// top-level name is declared in ONE sim file (a moved function then binds the same declaration it bound before): duplicateNames() reports any
// name declared twice, and the guard fails on it. Reordering top-level statements is not seen; at module scope it moves no fight (a use before
// its declaration throws at load rather than replaying differently).
import { createHash } from 'node:crypto';
import ts from 'typescript';

const printer = ts.createPrinter({ removeComments: true });

// The character catalogue (src/fight/catalogue-data.ts rows + src/fight/catalogue-defs.ts definitions) is big literals, and most of a row is not the fight: names, legends, ranks, voices, looks,
// render and home settings, animations, loot. Hashing the whole file made every cosmetic edit demand a RECORD_VERSION bump, against the rule that a new row is data only. So the digest hashes the
// SIM PROJECTION instead, and that projection is driven by the DEFINITIONS, not by a list of names here: (a) the definitions that are not `sim: false` (a missing flag counts as sim: fail closed) and the
// rig families, and (b) per body row, the RESOLVED VALUE of every sim field in a canonical order, read from the row's `fields` map or, for a field not yet moved there, from the row's own key.
// So moving `weapon` under `fields` moves nothing; a new cosmetic field (sim: false) moves nothing; a new sim field, or a changed sim value, moves the digest.
// Until a definitions file exists in the hashed set, SIM_BASE names the fields the fight has always read. The structural parts below (the finisher allow-list, bloodless, off-the-ladder) are what
// roster.ts derives from a row today; variant rows (a `body` key) are not roster entries and are left out, as roster.ts leaves them out.
type Lit = string | number | boolean | null | Lit[] | { [k: string]: Lit };
const CATALOGUE_DATA = /(^|\/)catalogue-data\.ts$/, CATALOGUE_DEFS = /(^|\/)catalogue-defs\.ts$/;
const POOL_DEFS = /(^|\/)pool-defs\.json$/;
const poolProjection = (source: string): string => JSON.stringify(((JSON.parse(source) as { pools?: { id: string; sim?: boolean }[] }).pools ?? []).filter((p) => p.sim !== false).sort((a, b) => (a.id < b.id ? -1 : 1)));   // a missing flag counts as sim: fail closed
const SIM_BASE = ['rig', 'stats', 'weapon'];
const literalHost = (n: ts.Expression): ts.Expression => (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) ? literalHost(n.expression) : n);
function literal(n: ts.Node): Lit {
  if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n)) return literal(n.expression);
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) return -(literal(n.operand) as number);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map((pr) => {
    if (!ts.isPropertyAssignment(pr) || !(ts.isIdentifier(pr.name) || ts.isStringLiteralLike(pr.name))) throw Error(`catalogue data must be pure data: ${pr.getText()}`);
    return [pr.name.text, literal(pr.initializer)];
  }));
  throw Error(`catalogue data must be pure data: ${n.getText()}`);
}
/** The one array or object literal a pure-data file declares, as plain data. */
const dataOf = (path: string, source: string): Lit | undefined => {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const st of sf.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.initializer) { const h = literalHost(d.initializer); if (ts.isArrayLiteralExpression(h) || ts.isObjectLiteralExpression(h)) return literal(h); }
  return undefined;
};
type Obj = { [k: string]: Lit | undefined };
/** The sim projection of the catalogue: pure, so it can be tested on synthetic rows. */
export function catalogueProjection(rows: readonly Obj[], defs?: Obj): string {
  const defFields = ((defs?.fields ?? []) as Obj[]).filter((f) => f.sim !== false), ids = [...new Set([...SIM_BASE, ...defFields.map((f) => f.id as string)])].sort();
  const pick = (r: Obj, id: string) => ((r.fields as Obj | undefined)?.[id] ?? r[id] ?? null);
  const body = rows.filter((r) => !('body' in r)).map((r) => ({
    id: r.id, fields: ids.map((id) => [id, pick(r, id)]),
    finishers: (r.finisher as Obj | undefined)?.allowed ?? null, bloodless: r.blood === null, hold: !!(r.ladder as Obj | undefined)?.hold,
  }));
  return JSON.stringify({ fields: [...defFields].sort((x, y) => String(x.id) < String(y.id) ? -1 : 1), rigs: defs?.rigs ?? null, rows: body });
}
const isCode = (path: string) => /\.(ts|mts|js|mjs)$/.test(path);

function declaredNames(st: ts.Statement): string[] {
  if (ts.isVariableStatement(st)) return st.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
  const name = (st as { name?: ts.Node }).name;
  return name && ts.isIdentifier(name) ? [name.text] : [];
}

function parse(path: string, source: string) {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statements: string[] = [], rebinds: string[] = [], names: string[] = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || (ts.isExportDeclaration(st) && st.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(st) ? st.importClause : undefined, bindings = ts.isImportDeclaration(st) ? clause?.namedBindings : st.exportClause;
      if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) for (const el of bindings.elements) if (el.propertyName) rebinds.push(`${el.propertyName.getText(sf)} as ${el.name.text}`);
      continue;
    }
    statements.push(printer.printNode(ts.EmitHint.Unspecified, st, sf).replace(/^export (?!default\b)/, ''));   // a moved function often gains or loses `export`: that is visibility, not the fight
    names.push(...declaredNames(st));
  }
  return { statements, rebinds, names };
}

/** The digest of a set of sim sources, keyed by path only to tell code from data: the paths themselves never reach the hash. */
export function simDigest(files: Readonly<Record<string, string>>): string {
  const parts: string[] = [], rebinds = new Set<string>();
  let rows: Lit | undefined, defs: Lit | undefined;
  for (const [path, source] of Object.entries(files)) {
    if (POOL_DEFS.test(path)) { parts.push(`pools\0${poolProjection(source)}`); continue; }   // resource pool definitions: only the sim rows matter (a sim: false pool cannot change a fight)
    if (!isCode(path)) { parts.push(`data\0${source}`); continue; }
    if (CATALOGUE_DATA.test(path)) { rows = dataOf(path, source); continue; }   // the catalogue reaches the digest as its sim projection, below
    if (CATALOGUE_DEFS.test(path)) { defs = dataOf(path, source); continue; }
    const p = parse(path, source);
    parts.push(...p.statements);
    for (const r of p.rebinds) rebinds.add(r);
  }
  if (rows !== undefined || defs !== undefined) parts.push(`catalogue\0${catalogueProjection((rows ?? []) as Obj[], defs as Obj | undefined)}`);
  const hash = createHash('sha256');
  for (const part of [...parts.sort(), ...[...rebinds].sort().map((r) => `rebind\0${r}`)]) hash.update(part).update('\0\0');
  return hash.digest('hex');
}

/** Top-level names declared in more than one sim file, as `name: fileA, fileB`. Must be empty for simDigest to be sound. */
export function duplicateNames(files: Readonly<Record<string, string>>): string[] {
  const where = new Map<string, string[]>();
  for (const [path, source] of Object.entries(files)) if (isCode(path)) for (const n of parse(path, source).names) where.set(n, [...(where.get(n) ?? []), path]);
  return [...where].filter(([, paths]) => new Set(paths).size > 1).map(([n, paths]) => `${n}: ${[...new Set(paths)].join(', ')}`);
}
