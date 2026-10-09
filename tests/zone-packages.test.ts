// Zone packages stay data (docs/specs/zone-runtime.md step 3, PROOF 2): every origins/zones/<dir>/ package loads through the loader and passes its rules; every file
// in a package except hooks.ts is one literal (import type only: no function, arrow, class, loop, call or computed expression); nothing in the repo outside the
// zones folder imports a package's files except the loader; no package imports the Pit (src/arena*); and a package's hooks.ts stays within the 300-line budget.
// Each rule is a function over a root folder, so the negative controls below run it on a broken fixture and must see it fail (no rule can pass vacuously).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { loadZone, zoneProblems } from '../origins/zones/loader.ts';

const LOADER = 'origins/zones/loader.ts';   // the ONE module allowed to import a package
export const HOOKS_BUDGET = 300;
const repo = path.resolve(import.meta.dirname, '..');

// The package folders under <root>/origins/zones (a loader file living in zones/ itself is not a package).
export const packagesIn = (root: string): string[] => {
  const zones = path.join(root, 'origins/zones');
  return fs.existsSync(zones) ? fs.readdirSync(zones, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
};
const filesOf = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesOf(path.join(dir, e.name)) : /\.(ts|mts|mjs|js|json)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const parse = (file: string) => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

// A literal: object/array/string/number/boolean/null, a negative number, wrapped at most in `as const` / `satisfies T` / parentheses. Anything else is code.
function literal(n: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) return literal(n.expression);
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isNumericLiteral(n)) return true;
  if (n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isPrefixUnaryExpression(n)) return n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand);
  if (ts.isArrayLiteralExpression(n)) return n.elements.every((e) => !ts.isSpreadElement(e) && literal(e));
  if (ts.isObjectLiteralExpression(n)) return n.properties.every((p) => ts.isPropertyAssignment(p) && !ts.isComputedPropertyName(p.name) && literal(p.initializer));
  return false;
}

// The problems in one data file (every package file except hooks.ts). Allowed statements: `import type`, type/interface declarations,
// `const x[: T] = <literal>` (exported or not), `export default <literal>` and `export default x` naming such a const.
export function dataFileProblems(file: string): string[] {
  if (file.endsWith('.json')) { try { JSON.parse(fs.readFileSync(file, 'utf8')); return []; } catch { return [`${file}: not valid JSON`]; } }
  const sf = parse(file), bad: string[] = [], consts = new Set<string>(), at = (n: ts.Node, why: string) => bad.push(`${file}:${lineOf(sf, n)}: ${why}`);
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s)) { if (!s.importClause?.isTypeOnly) at(s, "only 'import type' is allowed in a zone data file"); continue; }
    if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) continue;
    if (ts.isVariableStatement(s)) {
      if (!(s.declarationList.flags & ts.NodeFlags.Const)) { at(s, 'a data file declares only const'); continue; }
      for (const d of s.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer || !literal(d.initializer)) at(d, 'a const must be one literal (no function, call, spread or computed value)');
        else consts.add(d.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(s)) { if (!(literal(s.expression) || (ts.isIdentifier(s.expression) && consts.has(s.expression.text)))) at(s, 'export default must be a literal or a literal const'); continue; }
    at(s, `${ts.SyntaxKind[s.kind]} is code, not data (it belongs in hooks.ts)`);
  }
  return bad;
}

// Every module specifier in a file: static imports, re-exports, import types, dynamic import() and require().
function specifiers(file: string): { spec: string; line: number }[] {
  const sf = parse(file), out: { spec: string; line: number }[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) out.push({ spec: n.moduleSpecifier.text, line: lineOf(sf, n) });
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) out.push({ spec: n.argument.literal.text, line: lineOf(sf, n) });
    else if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require')) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) out.push({ spec: n.arguments[0].text, line: lineOf(sf, n) });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// Files anywhere in the repo (src, tests, scripts, origins) that reach into a zone package without being the loader (or the package itself).
export function zoneImportOffenders(root: string, loader = LOADER): string[] {
  const zones = path.join(root, 'origins/zones') + path.sep, bad: string[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.') && e.name !== 'dist') walk(p); continue; }
    if (!/\.(ts|mts|mjs|js)$/.test(e.name) || path.relative(root, p) === loader || !fs.readFileSync(p, 'utf8').includes('zone')) continue;   // cheap prefilter: '../zone9/' and '../zones/zone9/' both contain 'zone'
    const ownPackage = p.startsWith(zones) ? path.join(zones, path.relative(zones, p).split(path.sep)[0]!) + path.sep : null;
    for (const { spec, line } of specifiers(p)) {
      if (!spec.startsWith('.')) continue;
      const to = path.resolve(path.dirname(p), spec);
      const pkg = to.startsWith(zones) && path.relative(zones, to).includes(path.sep) ? path.join(zones, path.relative(zones, to).split(path.sep)[0]!) + path.sep : null;
      if (pkg && pkg !== ownPackage) bad.push(`${path.relative(root, p)}:${line} imports ${spec}: read a zone through loadZone()`);
    }
  } };
  walk(root);
  return bad;
}

// A package importing the Pit (src/arena*): zones import nothing from the Pit (the core/pit split).
export function pitImportOffenders(root: string): string[] {
  return packagesIn(root).flatMap((dir) => filesOf(path.join(root, 'origins/zones', dir)).filter((f) => !f.endsWith('.json')).flatMap((f) =>
    specifiers(f).filter(({ spec }) => /(^|\/)src\/arena[^/]*$/.test(path.relative(root, path.resolve(path.dirname(f), spec)).replace(/\.ts$/, '') + '') || /\/src\/arena/.test(spec))
      .map(({ spec, line }) => `${path.relative(root, f)}:${line} imports ${spec}: zones import nothing from the Pit`)));
}

// hooks.ts code lines (non-blank, not only a comment) across a package; every other file is data and counts 0.
export function hooksLines(pkgDir: string): number {
  const hooks = filesOf(pkgDir).filter((f) => path.basename(f) === 'hooks.ts');
  let n = 0;
  for (const f of hooks) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
    n += src.split('\n').filter((l) => l.trim() && !/^\s*\/\//.test(l)).length;
  }
  return n;
}
// Every package problem under a root: data-file lint, budget. (Imports are checked root-wide above.)
export function packageProblems(root: string): string[] {
  return packagesIn(root).flatMap((dir) => {
    const pkg = path.join(root, 'origins/zones', dir), lines = hooksLines(pkg);
    return [...filesOf(pkg).filter((f) => path.basename(f) !== 'hooks.ts').flatMap(dataFileProblems), ...(lines > HOOKS_BUDGET ? [`${dir}: hooks.ts has ${lines} code lines, over the ${HOOKS_BUDGET}-line budget`] : [])];
  });
}

// --- The repo ---

test('every zone package loads through the loader and passes its rules', async () => {
  const dirs = packagesIn(repo);
  assert.ok(dirs.length >= 1, 'origins/zones has at least Zone 1');
  for (const dir of dirs) {
    const own = (await import(path.join(repo, 'origins/zones', dir, 'zone.ts'))).default as { id: string };
    assert.equal(typeof own.id, 'string', `${dir}/zone.ts names its id`);
    const z = loadZone(own.id);   // throws for an unregistered or invalid package
    assert.equal(z.id, own.id, `${dir} is registered in the loader under its own id`);
    assert.deepEqual(zoneProblems(z), [], dir);
  }
});

test('zone package files are data (literal-only, import type only) and hooks.ts stays within the budget', () => {
  assert.deepEqual(packageProblems(repo), []);
});

test('nothing outside the loader imports a zone package, and no zone imports the Pit', () => {
  assert.ok(fs.existsSync(path.join(repo, LOADER)), `the loader is at ${LOADER}`);
  assert.deepEqual(zoneImportOffenders(repo), [], 'read a zone through loadZone(), not its files');
  assert.deepEqual(pitImportOffenders(repo), []);
});

// --- Negative controls: each rule on a broken fixture must fail ---

const fixture = (files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zone-packages-'));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); }
  return root;
};
const GOOD = { 'origins/zones/zone9/zone.ts': "import type { X } from '../../x.ts';\nconst zone: { id: string; level: number } = { id: '9', level: 9 } as const;\nexport default zone;\n", 'origins/zones/zone9/look.ts': 'export default { "a": { "fog": "#000000", "n": -1, "on": true, "list": [1, 2] } };\n' };

test('negative control: a clean fixture passes every rule (so the failures below are the rules, not the fixture)', () => {
  const root = fixture({ ...GOOD, 'origins/zones/loader.ts': "import z from './zone9/zone.ts';\nexport const zones = [z];\n", 'origins/preview/page.ts': "import type { Look } from './look.ts';\n" });
  try { assert.deepEqual(packageProblems(root), []); assert.deepEqual(zoneImportOffenders(root, 'origins/zones/loader.ts'), []); assert.deepEqual(pitImportOffenders(root), []); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('negative control: code in a data file fails the lint, one finding per construct', () => {
  const cases: Record<string, RegExp> = {
    'export const f = () => 1;\n': /one literal/,
    'function f() { return 1; }\nexport default 1;\n': /FunctionDeclaration is code/,
    'class C {}\nexport default 1;\n': /ClassDeclaration is code/,
    'for (const x of []) {}\nexport default 1;\n': /ForOfStatement is code/,
    "export default ['a'].map((x) => x);\n": /export default must be a literal/,
    'const k = "a";\nexport default { [k]: 1 };\n': /export default must be a literal/,
    'const base = { a: 1 };\nexport default { ...base };\n': /export default must be a literal/,
    'export default { a: 1 + 2 };\n': /export default must be a literal/,
    "import { x } from '../../x.ts';\nexport default 1;\n": /only 'import type'/,
    'let x = 1;\nexport default 1;\n': /declares only const/,
  };
  for (const [src, want] of Object.entries(cases)) {
    const root = fixture({ ...GOOD, 'origins/zones/zone9/spawns.ts': src });
    try { const bad = packageProblems(root); assert.equal(bad.length, 1, `${JSON.stringify(src)} → ${bad.join(' | ')}`); assert.match(bad[0]!, want); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('negative control: hooks.ts over the budget fails, at the budget passes, and comments do not count', () => {
  const code = (n: number) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n// a comment\n/* a\n block */\n\n';
  for (const [n, fails] of [[HOOKS_BUDGET, false], [HOOKS_BUDGET + 1, true]] as const) {
    const root = fixture({ ...GOOD, 'origins/zones/zone9/hooks.ts': code(n) });
    try { assert.equal(hooksLines(path.join(root, 'origins/zones/zone9')), n); assert.equal(packageProblems(root).some((p) => /over the 300-line budget/.test(p)), fails, `${n} lines`); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('negative control: a package file imported from outside the loader fails, by static, re-export, dynamic and type import', () => {
  for (const src of ["import z from '../zones/zone9/zone.ts';\n", "export { default } from '../zones/zone9/look.ts';\n", "const z = await import('../zones/zone9/zone.ts');\n", "type Z = import('../zones/zone9/zone.ts').default;\n"]) {
    const root = fixture({ ...GOOD, 'origins/zones/loader.ts': "import z from './zone9/zone.ts';\n", 'origins/server/rewards.ts': src, 'src/game.ts': src.replace('../zones/', '../origins/zones/') });
    try { const bad = zoneImportOffenders(root, 'origins/zones/loader.ts'); assert.equal(bad.length, 2, src); assert.match(bad.join('|'), /origins\/server\/rewards\.ts:\d+ imports .*zone9/); assert.match(bad.join('|'), /src\/game\.ts:\d+ imports .*zone9/); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
  const cross = fixture({ ...GOOD, 'origins/zones/zone8/zone.ts': "import type { Z } from '../zone9/zone.ts';\nexport default { id: '8' };\n" });
  try { assert.equal(zoneImportOffenders(cross, 'origins/zones/loader.ts').length, 1, 'one package reaching into another fails too'); }
  finally { fs.rmSync(cross, { recursive: true, force: true }); }
});

test('negative control: a zone importing the Pit (src/arena*) fails', () => {
  const root = fixture({ ...GOOD, 'origins/zones/zone9/kit.ts': "import type { ArenaMaterials } from '../../../src/arena.ts';\nexport default {};\n" });
  try { const bad = pitImportOffenders(root); assert.equal(bad.length, 1); assert.match(bad[0]!, /zones import nothing from the Pit/); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});
