// Data-only PRs (Dom via Lead 2026-10-09): a PR that touches ONLY content data skips the Auditor; the gate is this file, not a reviewer.
// A path is data when it is on DATA_PATHS AND its text is pure data: a zone module may hold `import type` lines, one typed `const` whose value is
// built only from literals (strings, numbers, booleans, null, arrays, objects with plain keys), and `export default <that const>`. Nothing that runs:
// no call, no value import, no identifier other than the const itself, no template with ${}, no spread, no function. One file off the list, or one
// non-literal node, and the PR is not data-only (it needs the Auditor). The schema check (scripts/data-only-check.mjs: loadZone + zoneProblems,
// unknown fields refused) runs on top of this; this file only decides "is it data at all".
import ts from 'typescript';

// v1, strict. Catalogue rows (src/fight/catalogue-rows.ts) and biome presets (origins/zones/biomes.ts) still mix code with data, and legends text
// carries the legends rule (sources, living religions), which no parser checks: they join only once they are split into pure-data files.
export const DATA_PATHS = [
  /^origins\/zones\/zone\d+\/(zone|spawns|kit|look)\.ts$/,
  /^src\/assets\/source\/loot\/loot\.json$/,
];
export const onDataPath = file => DATA_PATHS.some(re => re.test(file));

const LITERAL = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword, ts.SyntaxKind.NoSubstitutionTemplateLiteral]);
// A value built only from literals. A negative number is a prefix minus on a numeric literal; nothing else is allowed.
function literalValue(node) {
  if (LITERAL.has(node.kind)) return true;
  if (ts.isPrefixUnaryExpression(node)) return node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.every(literalValue);
  if (ts.isObjectLiteralExpression(node)) return node.properties.every(p => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)) && literalValue(p.initializer));
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) return literalValue(node.expression);   // `[...] as const` keeps the literal
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  return false;
}

// Problems with a zone module's text, [] when it is pure data. JSON files: parseable is enough here (the schema check does the rest).
export function dataProblems(file, text) {
  if (file.endsWith('.json')) { try { JSON.parse(text); return []; } catch (e) { return [`${file}: not JSON (${e.message})`]; } }
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), problems = [];
  let name = null, exported = false;
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.importClause?.isTypeOnly) continue;
    if (ts.isVariableStatement(st) && !name && st.declarationList.flags & ts.NodeFlags.Const && st.declarationList.declarations.length === 1) {
      const d = st.declarationList.declarations[0];
      if (ts.isIdentifier(d.name) && d.initializer && literalValue(d.initializer) && !st.modifiers?.length) { name = d.name.text; continue; }
    }
    if (ts.isExportAssignment(st) && !st.isExportEquals && ts.isIdentifier(st.expression) && st.expression.text === name && !exported) { exported = true; continue; }
    problems.push(`${file}:${sf.getLineAndCharacterOfPosition(st.getStart()).line + 1} is not data (${ts.SyntaxKind[st.kind]})`);
  }
  if (!name || !exported) problems.push(`${file}: needs one literal \`const\` and \`export default\` of it`);
  return problems;
}

// The verdict for a PR's changed files: { dataOnly, problems }. Deleted files count as on-path by name (the schema check catches a broken zone).
export function classify(changed, readText) {
  if (!changed.length) return { dataOnly: false, problems: ['no files changed'] };
  const off = changed.filter(c => !onDataPath(c.file)).map(c => `${c.file} is not on the data-only path list`);
  if (off.length) return { dataOnly: false, problems: off };
  const problems = changed.filter(c => c.status !== 'removed').flatMap(c => dataProblems(c.file, readText(c.file)));
  return { dataOnly: problems.length === 0, problems };
}
