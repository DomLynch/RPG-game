// Data-only PRs (Dom via Lead 2026-10-09): a PR that touches ONLY content data skips the Auditor; the gate is this file, not a reviewer.
// A path is data when it is on DATA_PATHS AND its text is pure data: a zone module may hold `import type` lines and type aliases (erased), one typed `const` whose value is
// built only from literals (strings, numbers, booleans, null, arrays, objects with plain keys), and `export default <that const>`. Nothing that runs:
// no call, no value import, no identifier other than the const itself, no template with ${}, no spread, no function. One file off the list, or one
// non-literal node, and the PR is not data-only (it needs the Auditor). The schema check (scripts/data-only-check.mjs: loadZone + zoneProblems,
// unknown fields refused) runs on top of this; this file only decides "is it data at all".
import ts from 'typescript';

// v1, strict. Catalogue rows (src/fight/catalogue-rows.ts) and biome presets (origins/zones/biomes.ts) still mix code with data, and legends text
// carries the legends rule (sources, living religions), which no parser checks: they join only once they are split into pure-data files.
export const DATA_PATHS = [
  /^origins\/zones\/zone\d+\/(zone|spawns|kit|look)\.ts$/,
  /^origins\/zones\/biomes-data\.ts$/,   // the biome presets once World splits them out of biomes.ts as a literal-only module (biomes.ts itself stays code)
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
    if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) continue;   // types are erased: nothing of them runs
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

// The value of a pure-data module (call only after dataProblems returned []): the literal const, as plain JSON.
function literalJson(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node)) return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalJson);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => [p.name.text, literalJson(p.initializer)]));
  return literalJson(node.expression);   // as const, satisfies, parentheses
}
export function moduleValue(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const st = sf.statements.find(s => ts.isVariableStatement(s));
  return st ? literalJson(st.declarationList.declarations[0].initializer) : null;
}

// Legends (Lead 2026-10-09): a spawns row that brings a legend id trunk does not have, or changes the source citation of one it has, is legends
// content, and the legends rule is the Auditor's judgement, so the PR is not data-only. A row reusing an existing id with the same citation stays data.
// `rows` = spawns.rows; a legend is a row whose id is a `character:` id with a `source` (the citation). Returns { id: JSON(source) }.
export const legendCitations = rows => Object.fromEntries((Array.isArray(rows) ? rows : []).filter(r => r && typeof r.id === 'string' && r.id.startsWith('character:') && r.source)
  .map(r => [r.id, JSON.stringify(r.source)]));
export function legendProblems(head, base) {
  return Object.entries(head).flatMap(([id, source]) => !(id in base) ? [`${id} is a new legend: the legends rule needs the Auditor`]
    : base[id] !== source ? [`${id}'s source citation changed: the legends rule needs the Auditor`] : []);
}

// The verdict for a PR's changed files: { dataOnly, problems }. Deleted files count as on-path by name (the schema check catches a broken zone).
export function classify(changed, readText) {
  if (!changed.length) return { dataOnly: false, problems: ['no files changed'] };
  const off = changed.filter(c => !onDataPath(c.file)).map(c => `${c.file} is not on the data-only path list`);
  if (off.length) return { dataOnly: false, problems: off };
  const problems = changed.filter(c => c.status !== 'removed').flatMap(c => dataProblems(c.file, readText(c.file)));
  return { dataOnly: problems.length === 0, problems };
}
