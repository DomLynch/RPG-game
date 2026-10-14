// A record's sheet is the client's claim, so only the page may take it on trust (src/fight/replay.ts VerifyOptions): src/main.ts checks the fight it just
// played before it shares it, and nothing is granted on the strength of that. A sweep, a server verifier or a script that passed 'trust' would grant loot,
// ranks or kills on a sheet nobody checked. This guard fails if any tracked code file outside tests/ other than src/main.ts passes it (Auditor on #2416).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set(['src/main.ts']);   // the page's own pre-share check
const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs|sql)$/;
// The two ways in: the sheet option (`{ sheet: 'trust' }`, any quote) and sheetRefusal's second argument. Not a bare 'trust' (initdb -A 'trust' is Postgres auth).
const TRUST = [/\bsheet\s*:\s*(['"`])trust\1/, /\bsheetRefusal\s*\([^)]*,\s*(['"`])trust\1/];

export function trustCallers(files: readonly { path: string; text: string }[]): string[] {
  return files.filter((f) => !f.path.startsWith('tests/') && !ALLOWED.has(f.path) && TRUST.some((re) => re.test(f.text))).map((f) => f.path);
}

const tracked = (): { path: string; text: string }[] =>
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter((p) => CODE.test(p)).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

test("only src/main.ts passes sheet: 'trust' to the verifiers (scripts/, origins/, supabase/ and every other path take a sheet only from the server's stored build)", () => {
  const files = tracked();
  assert.ok(files.some((f) => f.path.startsWith('scripts/')) && files.some((f) => f.path.startsWith('origins/')), 'the scan sees scripts/ and origins/');
  assert.deepEqual(trustCallers(files), []);
  assert.ok(TRUST[0]!.test(files.find((f) => f.path === 'src/main.ts')!.text), "src/main.ts still holds the one 'trust' caller (drop it from ALLOWED when it goes)");
});

test("the guard catches a fake 'trust' caller wherever it sits, and passes the look-alikes", () => {
  const call = "import { verifyRecord } from '../src/fight/replay.ts';\nconst v = verifyRecord(record, undefined, { sheet: 'trust' });\n";
  const caught = {
    'scripts/fake-sweep.mjs': call,
    'origins/server/fake-verify.ts': call.replace("'trust'", '"trust"'),
    'supabase/functions/fake/index.ts': call.replace("'trust'", '`trust`'),
    'scripts/fake-options.mjs': "const opts = { sheet: 'trust' as const };\nverifyRecord(r, undefined, opts);\n",
    'scripts/fake-refusal.mjs': "if (sheetRefusal(record, 'trust')) throw Error('x');\n",
    'src/fake-page.ts': call,
  };
  assert.deepEqual(trustCallers(Object.entries(caught).map(([path, text]) => ({ path, text }))), Object.keys(caught));
  const passed = [
    { path: 'src/main.ts', text: call },
    { path: 'tests/gear-fight.test.ts', text: call },
    { path: 'scripts/origins-database-check.mjs', text: "run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);\n" },
    { path: 'scripts/fake-sweep.mjs', text: 'const v = verifyRecord(record, undefined, { sheet: storedSheet });\n' },
  ];
  assert.deepEqual(trustCallers(passed), []);
});
