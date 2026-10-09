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
  for (const [path, source] of Object.entries(files)) {
    if (!isCode(path)) { parts.push(`data\0${source}`); continue; }
    const p = parse(path, source);
    parts.push(...p.statements);
    for (const r of p.rebinds) rebinds.add(r);
  }
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
