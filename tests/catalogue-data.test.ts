// src/fight/catalogue-data.ts is PURE DATA so the data-only path can carry a catalogue row without an Auditor review: only `import type` lines and ONE exported const built from literals
// (no calls, spreads, template strings, identifiers or computed keys). catalogue-rows.ts, the code, reads it and must hand back the same rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { CATALOGUE_ROWS } from '../src/fight/catalogue-data.ts';

const FILE = 'src/fight/catalogue-data.ts';
const literalProblems = (n: ts.Node, at: string): string[] => {
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return [];
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return [];
  if (ts.isArrayLiteralExpression(n)) return n.elements.flatMap((e) => literalProblems(e, at));
  if (ts.isObjectLiteralExpression(n)) return n.properties.flatMap((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? literalProblems(p.initializer, at) : [`${at}: a ${ts.SyntaxKind[p.kind]} (spread, shorthand or computed key)`]);
  return [`${at}: a ${ts.SyntaxKind[n.kind]} is not a literal`];
};
const problems = (src: string): string[] => {
  const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true), bad: string[] = [];
  let consts = 0;
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) { if (!st.importClause?.isTypeOnly) bad.push('a value import'); continue; }
    if (ts.isVariableStatement(st) && st.declarationList.declarations.length === 1 && st.declarationList.declarations[0]!.initializer) { consts++; bad.push(...literalProblems(st.declarationList.declarations[0]!.initializer!, 'the rows')); continue; }
    bad.push(`a ${ts.SyntaxKind[st.kind]} statement`);
  }
  if (consts !== 1) bad.push(`${consts} consts, want exactly one`);
  return bad;
};

test('catalogue-data.ts is literal-only: type imports and one const, no code', () => {
  assert.deepEqual(problems(readFileSync(FILE, 'utf8')), []);
});

test('the purity check catches a call, a spread, a template string, a value import and a second const', () => {
  const rows = (init: string, extra = '') => `import type { CatalogueRow } from './catalogue.ts';\n${extra}export const CATALOGUE_ROWS: readonly CatalogueRow[] = ${init};\n`;
  assert.deepEqual(problems(rows('[{ id: "a" }]')), []);
  assert.ok(problems(rows('[{ id: f("a") }]')).length);
  assert.ok(problems(rows('[{ ...x }]')).length);
  assert.ok(problems(rows('[{ id: `a${b}` }]')).length);
  assert.ok(problems(rows('[{ id: b }]')).length);
  assert.ok(problems(rows('[]', "import { x } from './x.ts';\n")).length);
  assert.ok(problems(rows('[]', 'const y = 1;\n')).length);
});

test("catalogue-rows.ts hands back the data file's rows", () => {
  assert.equal(CATALOGUE, CATALOGUE_ROWS);
  assert.ok(CATALOGUE.length >= 17);
});
