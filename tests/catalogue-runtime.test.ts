// The catalogue is the Pit's runtime source (20a): the roster, OPPONENTS and the ladder order are built from src/fight/catalogue-data.ts, so a new opponent is one row there.
// The proof is end to end: a child process loads the game's own modules with the data file swapped (by a resolve hook) for a copy plus ONE extra row, and prints what the Pit sees.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import CATALOGUE_ROWS from '../src/fight/catalogue-data.ts';
import { ROSTER } from '../src/roster.ts';
import { LADDER } from '../src/ladder.ts';

const rows = JSON.parse(JSON.stringify(CATALOGUE_ROWS)) as { id: string; name: string; ladder: { order: number | null; hold: boolean } }[];
const newRow = { ...JSON.parse(JSON.stringify(rows.find((r) => r.id === 'knight'))), id: 'testchamp', name: 'the Test Champion', ladder: { order: LADDER.length + 1, hold: false } };

test('the roster, the ladder and the order are the catalogue rows', () => {
  assert.deepEqual(Object.keys(ROSTER), rows.filter((r) => !('body' in r)).map((r) => r.id), 'roster = the body rows, in row order');
  assert.deepEqual(LADDER.map((o) => o.id), rows.filter((r) => !('body' in r) && !r.ladder.hold).sort((a, b) => a.ladder.order! - b.ladder.order!).map((r) => r.id), 'ladder = the unheld body rows by ladder.order');
});

test('a new opponent is ONE catalogue row: it is a roster id, an OPPONENTS entry and the last rung, with no code edit', () => {
  const dir = mkdtempSync(`${tmpdir()}/cat-runtime-`);
  try {
    const data = `${dir}/catalogue-data.ts`, hook = `${dir}/hook.mjs`, probe = `${dir}/probe.ts`;
    writeFileSync(data, `const CATALOGUE_ROWS = ${JSON.stringify([...rows, newRow])} as const;\nexport default CATALOGUE_ROWS;\n`);
    writeFileSync(hook, `export async function resolve(s, c, next) { return s.endsWith('catalogue-data.ts') ? { url: ${JSON.stringify(pathToFileURL(data).href)}, shortCircuit: true } : next(s, c); }\n`);
    writeFileSync(probe, `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(hook).href)});\nconst { ROSTER, isOpponentId, ENCOUNTERS } = await import(${JSON.stringify(pathToFileURL('src/roster.ts').href)});\nconst { OPPONENTS } = await import(${JSON.stringify(pathToFileURL('src/fight/moves.ts').href)});\nconst { LADDER, opponentFor } = await import(${JSON.stringify(pathToFileURL('src/ladder.ts').href)});\nconsole.log(JSON.stringify({ roster: isOpponentId('testchamp') && ROSTER.testchamp.name, opp: OPPONENTS.testchamp?.weapon, enc: ENCOUNTERS.at(-1).id, ladder: LADDER.map((o) => o.id), pick: opponentFor('testchamp').id }));\n`);
    const out = JSON.parse(execFileSync(process.execPath, [probe], { encoding: 'utf8' }).trim().split('\n').pop()!) as { roster: string; opp: string; enc: string; ladder: string[]; pick: string };
    assert.equal(out.roster, 'the Test Champion'); assert.equal(out.opp, 'maul'); assert.equal(out.enc, 'testchamp');
    assert.deepEqual(out.ladder, [...LADDER.map((o) => o.id), 'testchamp'], 'the last rung');
    assert.equal(out.pick, 'testchamp', 'the ladder can start him');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
