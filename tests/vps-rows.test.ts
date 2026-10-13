// Router PR 3: the release ROWS run on the VPS first (scripts/lib/vps-rows.mjs), under the unit run's three guards plus the Auditor's rows conditions:
// the RECEIPT's row set equals the requested set, a distinct receipt kind, vpsSafeRow() again at trust time, row-script hashes, per-run Chromium recorded and checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { buildRowsRunner, parseRowsReceipt, vpsRowsTrusted, runRowsOnVps, pwSeed } = await import('../scripts/lib/vps-rows.mjs');
const { NODE_PIN, RELEASE_MARK_DIR } = await import('../scripts/lib/vps-unit.mjs');
const SHA = 'a'.repeat(40), TREE = 'b'.repeat(40), NONCE = 'c'.repeat(32), RUNID = '1'.repeat(16), CHROME = 'd'.repeat(64);
const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const read = (p: string) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const scriptOf = (n: number) => commands[n - 1].find(a => /\.(mjs|js|sh)$/.test(a)) as string;
const rowOf = (n: number, over: object = {}) => ({ n, ok: true, seconds: 30, script_sha256: sha256(read(scriptOf(n)) as string), ...over });
const PW = { version: '1.50.0', revision: '1148' };   // a real shape: three-part version, numeric revision
const body = (rows: number[], over: object = {}) => ({ sha: SHA, tree: TREE, runid: RUNID, node: NODE_PIN.version, node_tarball_sha256: NODE_PIN.sha256, playwright: PW.version, chromium_revision: PW.revision, chrome_sha256: CHROME, width: 4, rows: rows.map(n => rowOf(n)), exit: 0, seconds: 300, ...over });
const stream = (r: object, n = NONCE) => `noise\nRECEIPT ${n} ${JSON.stringify(r)}\n`;
const args = (rows: number[], over: object = {}) => ({ stdout: stream(body(rows)), status: 0, nonce: NONCE, sha: SHA, tree: TREE, rows, ...over });
// Row 31 (record-replay-check) is a CPU-safe row; 44 is NEVER_ON_HF (sparring); 49 launches WebKit.
const SAFE = 31, NEVER = 44, WEBKIT = 49;

test('the fixture rows are what the tests say they are', () => {
  assert.match(commands[SAFE - 1].join(' '), /record-replay-check/); assert.match(commands[NEVER - 1].join(' '), /sparring/); assert.match(commands[WEBKIT - 1].join(' '), /webkit/);
});

test('parseRowsReceipt: accepted only from the last line, with our nonce, ssh exit 0, the right sha/tree, the pinned node and an EXACT row set', () => {
  assert.equal(parseRowsReceipt(args([31, 33])).ok, true);
  assert.equal(parseRowsReceipt({ ...args([31, 33]), stdout: stream(body([31, 33]), 'e'.repeat(32)) }).ok, false, 'wrong nonce');
  assert.equal(parseRowsReceipt({ ...args([31, 33]), stdout: stream(body([31, 33])) + `RECEIPT ${'e'.repeat(32)} ${JSON.stringify(body([31, 33]))}\n` }).ok, false, 'a fake line after the real one wins');
});
test('parseRowsReceipt fails closed: row set differs (missing or extra), a row not ok, no script hash, exit, tree, tarball, chrome fields', () => {
  for (const [why, a] of Object.entries({
    'missing row': { stdout: stream(body([31])) }, 'extra row': { stdout: stream(body([31, 33, 34])) }, 'duplicate row': { stdout: stream({ ...body([31, 33]), rows: [rowOf(31), rowOf(31)] }) },
    'row not ok': { stdout: stream({ ...body([31, 33]), rows: [rowOf(31), rowOf(33, { ok: false })] }) }, 'no script hash': { stdout: stream({ ...body([31, 33]), rows: [rowOf(31), rowOf(33, { script_sha256: null })] }) },
    'non-zero ssh exit': { status: 1 }, 'no receipt': { stdout: 'ok\n' }, 'tree mismatch': { tree: 'e'.repeat(40) }, 'sha mismatch': { sha: 'e'.repeat(40) },
    'receipt exit 1': { stdout: stream(body([31, 33], { exit: 1 })) }, 'wrong node tarball': { stdout: stream(body([31, 33], { node_tarball_sha256: 'f'.repeat(64) })) },
    'no chrome sha256': { stdout: stream(body([31, 33], { chrome_sha256: 'x' })) }, 'no playwright version': { stdout: stream(body([31, 33], { playwright: undefined })) },
    'EMPTY chromium revision (the live run printed one because browsers.json is not an exported subpath)': { stdout: stream(body([31, 33], { chromium_revision: '' })) }, 'non-numeric chromium revision': { stdout: stream(body([31, 33], { chromium_revision: 'latest' })) },
  })) assert.equal(parseRowsReceipt({ ...args([31, 33]), ...(a as object) }).ok, false, why);
});

test('buildRowsRunner: the unit runner\'s guards (unexported nonce, closed stdin, log files, receipt only after the exit status) plus the rows steps in order', () => {
  const s = buildRowsRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, rows: [31, 33], total: 53, width: 4 });
  assert.ok(s.includes(`NONCE='${NONCE}'`)); assert.ok(!/export\s+NONCE|declare -x NONCE/.test(s));
  assert.ok(s.includes(NODE_PIN.sha256) && s.includes(`/root/deploy-runs/${SHA}-${RUNID}`) && !s.includes(`deploy-runs/${SHA}-${NONCE}`));
  assert.match(s, /node scripts\/release-checks\.mjs < \/dev\/null > "\$RUN\/rows\.log" 2>&1/);
  const at = (needle: string) => s.indexOf(needle);
  assert.ok(at('npm ci') < at('playwright install') && at('playwright install') < at('npm run build') && at('npm run build') < at('release-checks.mjs') && at('release-checks.mjs') < at('[ "$rc" -eq 0 ]') && at('[ "$rc" -eq 0 ]') < at('RECEIPT %s'));
  assert.equal(s.split('RECEIPT %s').length - 1, 1); assert.match(s, /exit "\$rc"/);
  assert.ok(s.includes('PLAYWRIGHT_BROWSERS_PATH="$RUN/pw"'), 'Chromium is installed per run into the run dir');
  assert.ok(s.includes('chrome_sha256') && s.includes('chromium_revision') && s.includes('"playwright"'), 'the revision and the chrome sha256 ride in the RECEIPT');
  assert.ok(s.includes('readFileSync("node_modules/playwright-core/browsers.json"') && !s.includes('require("playwright-core/browsers.json")'), 'browsers.json is read by path: it is not an exported subpath of playwright-core');
  assert.match(s, /RELEASE_CHECKS_SKIP='[\d,]+'/); assert.ok(!/RELEASE_CHECKS_SKIP='[^']*\b31\b/.test(s) && !/RELEASE_CHECKS_SKIP='[^']*\b33\b/.test(s) && /RELEASE_CHECKS_SKIP='[^']*\b32\b/.test(s), 'every row but the requested ones is skipped');
});
test('buildRowsRunner is valid bash and refuses bad rows, widths and arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vpsrows-'));
  try { writeFileSync(join(dir, 'r.sh'), buildRowsRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, rows: [31, 33], total: 53 })); assert.equal(spawnSync('bash', ['-n', join(dir, 'r.sh')]).status, 0); } finally { rmSync(dir, { recursive: true, force: true }); }
  const ok = { sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, rows: [31], total: 53 };
  for (const bad of [{ rows: [] }, { rows: [31, 31] }, { rows: [0] }, { rows: [31.5] }, { rows: ['1; rm -rf /'] }, { total: 10 }, { width: 9 }, { sha: 'x' }, { nonce: "a'b" }]) assert.throws(() => buildRowsRunner({ ...ok, ...bad } as any));
});

const rec = (rows: number[], over: object = {}) => ({ kind: 'vps-rows-live', ...body(rows), at: new Date().toISOString(), ...over });
test('vpsRowsTrusted: a CPU-safe row with the right script hash is trusted for the deploy tree', () => {
  assert.deepEqual(vpsRowsTrusted(rec([SAFE]), TREE, commands, read, PW), [SAFE]);
});
test('vpsRowsTrusted applies vpsSafeRow AGAIN at trust time: NEVER_ON_HF and WebKit rows are untrusted even if a receipt claims them', () => {
  assert.deepEqual(vpsRowsTrusted(rec([SAFE, NEVER, WEBKIT]), TREE, commands, read, PW), [SAFE]);
});
test('vpsRowsTrusted fails closed: other kind (an HF receipt shape), other tree, stale, wrong playwright or chromium revision, wrong node, wrong script hash, no pw info', () => {
  const ok = rec([SAFE]);
  for (const [why, r, pw] of [
    ['hf kind', { ...ok, kind: 'vps-shadow-rows' }, PW], ['other tree', { ...ok, tree: 'e'.repeat(40) }, PW],
    ['stale', { ...ok, at: new Date(Date.now() - 5 * 3600e3).toISOString() }, PW], ['future', { ...ok, at: new Date(Date.now() + 3600e3).toISOString() }, PW],
    ['playwright version', ok, { ...PW, version: '9.9.9' }], ['chromium revision', ok, { ...PW, revision: '1' }], ['no pw', ok, null],
    ['node', { ...ok, node: 'v1.0.0' }, PW], ['chrome sha', { ...ok, chrome_sha256: 'x' }, PW],
    ['script hash', { ...ok, rows: [rowOf(SAFE, { script_sha256: 'f'.repeat(64) })] }, PW], ['row not ok', { ...ok, rows: [rowOf(SAFE, { ok: false })] }, PW],
    ['receipt exit', { ...ok, exit: 1 }, PW], ['null', null, PW],
  ] as [string, any, any][]) assert.deepEqual(vpsRowsTrusted(r, TREE, commands, read, pw), [], why);
  assert.deepEqual(vpsRowsTrusted(ok, TREE, commands, read, PW), [SAFE], 'control');
});
test('an HF rows receipt is never read as a vps-rows-live one (trustedFromShards ignores the kind)', async () => {
  const { trustedFromShards } = await import('../scripts/lib/vps-receipts.mjs');
  assert.deepEqual(trustedFromShards([rec([SAFE])], TREE, commands, read, {}, {}, {}), []);
});

test('runRowsOnVps: one ssh session in lanejobs.slice, the nonce only on stdin, a verified receipt accepted, a failed run cleaned up and never thrown', () => {
  const calls: any[] = [];
  const run = (cmd: string, argv: string[], opts: any) => { calls.push([cmd, argv, opts]); return argv.join(' ').includes('bash -s') ? { status: 0, stdout: stream(body([31, 33])) } : { status: 0, stdout: '' }; };
  const ok = runRowsOnVps({ sha: SHA, tree: TREE, rows: [31, 33], total: 53, nonce: NONCE, runid: RUNID, run });
  assert.equal(ok.ok, true);
  assert.ok(calls.some(c => c[0] === 'ssh' && c[1].join(' ').includes('lanejobs.slice')));
  assert.ok(!calls.some(c => c[1].join(' ').includes(NONCE)), 'the nonce is never in argv');
  assert.equal(runRowsOnVps({ sha: SHA, tree: TREE, rows: [31, 33], total: 53, nonce: NONCE, runid: RUNID, run: () => ({ status: 1, stdout: '', stderr: '--- failing rows ---\nFAILED 31' }) }).ok, false);
  const t = runRowsOnVps({ sha: 'bad', tree: TREE, rows: [31], total: 53, run }); assert.equal(t.ok, false); assert.match(String(t.reason), /exception/);
});

test('vps-receipt-trust --rows-vps: the stored receipt is re-checked against the deploy tree (a stale or other-tree file trusts nothing)', () => {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), tree = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).stdout.trim();
  const pkg = JSON.parse(readFileSync('node_modules/playwright-core/package.json', 'utf8')), revision = JSON.parse(readFileSync('node_modules/playwright-core/browsers.json', 'utf8')).browsers.find((b: any) => b.name === 'chromium').revision;
  const dir = mkdtempSync(join(tmpdir(), 'rowsvps-'));
  const run = () => spawnSync('node', ['scripts/vps-receipt-trust.mjs', sha, '--rows-vps'], { encoding: 'utf8', env: { ...process.env, PRELAUNCH_DIR: dir } }).stdout;
  try {
    assert.equal(run(), '', 'no file, no trust');
    const good = { ...rec([SAFE]), sha, tree, playwright: pkg.version, chromium_revision: revision };
    writeFileSync(join(dir, `${sha}.rowsvps`), JSON.stringify(good)); assert.equal(run(), String(SAFE));
    writeFileSync(join(dir, `${sha}.rowsvps`), JSON.stringify({ ...good, tree: 'e'.repeat(40) })); assert.equal(run(), '', 'another tree');
    writeFileSync(join(dir, `${sha}.rowsvps`), JSON.stringify({ ...good, chromium_revision: '1' })); assert.equal(run(), '', 'another chromium revision than this tree\'s playwright');
    writeFileSync(join(dir, `${sha}.rowsvps`), '{trunc'); assert.equal(run(), '', 'garbage');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('the wiring: launch.mjs cpu routes the CPU rows through pickTarget (VPS in the background, HF as spillover, never twice), deploy.sh waits for the running marker and merges the VPS rows', () => {
  const lm = readFileSync('scripts/vps-shadow/launch.mjs', 'utf8'), dv = readFileSync('scripts/lib/deploy-vps.sh', 'utf8');
  assert.match(lm, /pickTarget\(\{ mem: \d+, vps: status \}\) === 'vps'/); assert.match(lm, /rows-vps/); assert.match(lm, /spilling to Hugging Face/); assert.match(lm, /already on the VPS/);
  assert.match(lm, /LAUNCH_TARGET !== 'hf'/);
  assert.match(dv, /rowsvps\.running/); assert.match(dv, /--rows-vps/);
  assert.ok(dv.indexOf('--rows-vps') > dv.indexOf('vps-receipt-trust.mjs "$revision" 2>'), 'the VPS rows are merged AFTER the HF receipts are read');
});

import { readFileSync as readSrc } from 'node:fs';
test('Auditor #2181: no --with-deps, out-of-scope rows are never stamped ok, the node tarball extracts without the archive owner, a spill places the same rows', () => {
  const rows = readSrc('scripts/lib/vps-rows.mjs', 'utf8'), unit = readSrc('scripts/lib/vps-unit.mjs', 'utf8'), launch = readSrc('scripts/vps-shadow/launch.mjs', 'utf8');
  assert.doesNotMatch(rows, /--with-deps/); assert.match(rows, /r\.trusted\|\|r\.out_of_scope/);
  assert.match(unit, /tar --no-same-owner -xJf node\.tar\.xz/);
  assert.doesNotMatch(launch, /'cpu', a, ''\]/);
});
test('Auditor #2181: prelaunched_cpu accepts a multi-id spill line and rejects a garbled one; the unit runner leaves a world-listable release marker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pcpu-')), sha = 'a'.repeat(40);
  const ask = (line: string) => { writeFileSync(join(dir, `${sha}.cpu`), line); return spawnSync('bash', ['-c', `source scripts/lib/deploy-vps.sh; prelaunched_cpu ${sha}`], { encoding: 'utf8', env: { ...process.env, PRELAUNCH_DIR: dir } }); };
  assert.equal(ask('abc123,def456;3,4,5').stdout, 'abc123,def456;3,4,5'); assert.equal(ask('abc123;3').stdout, 'abc123;3');
  for (const bad of ['abc123,;3', ';3', 'abc123;', 'abc 123;3']) assert.equal(ask(bad).status, 1, bad);
  const sh = readSrc('scripts/lib/vps-unit.mjs', 'utf8');
  // run the runner's own marker lines in a temp dir: the file appears while the run lives and vanishes with the EXIT trap
  const mdir = mkdtempSync(join(tmpdir(), 'mark-')), head = buildRowsRunner({ sha: 'b'.repeat(40), tree: 'c'.repeat(40), nonce: 'd'.repeat(32), runid: 'e'.repeat(16), rows: [1], total: 2, width: 1 }).replaceAll('/run/frankendom-release', mdir);
  const lines = head.split('\n'), mi = lines.findIndex((l) => l.startsWith('MARK=')), ti = lines.findIndex((l) => l.startsWith('trap '));
  const probe = spawnSync('bash', ['-c', `RUN=${mdir}/run; ${lines[mi]}\n${lines[ti]}\nmkdir -p "$RUN"\n${lines.find((l) => l.startsWith('mkdir -p -m 755'))}\nls ${mdir} | grep -c b > ${mdir}/seen`], { encoding: 'utf8' });
  assert.equal(readSrc(join(mdir, 'seen'), 'utf8').trim(), '1', probe.stderr); assert.deepEqual(readdirSync(mdir).filter((f) => f !== 'seen' && f !== 'run'), [], 'the EXIT trap removes the marker');
  assert.match(readSrc('scripts/vps-shadow/capture.sh', 'utf8'), new RegExp(`CAPTURE_RUNS_DIR:-${RELEASE_MARK_DIR.replaceAll('/', '\\/')}\\}`));
  const apply = readSrc('scripts/lib/deploy-vps.sh', 'utf8'), a0 = apply.indexOf('vps_receipts_apply()');
  assert.ok(apply.indexOf('prelaunched_cpu "$receipt_sha"', a0) > apply.indexOf('.rowsvps.running', a0) && apply.indexOf('prelaunched_cpu "$receipt_sha"', a0) < apply.indexOf('for job in', a0), 'the spilled .cpu is read after the .running wait and before the job loop');
  assert.match(sh, /mkdir -p -m 755 '\$\{RELEASE_MARK_DIR\}'/); assert.match(sh, /trap 'rm -rf "\$RUN" "\$MARK"' EXIT/);
});

// EH (2026-10-13): every rows run re-downloaded ~500 MB of browsers into its own run dir (17 minutes at 0.4 MiB/s) although the box already holds the pinned revisions.
test('pwSeed copies the finished browsers from the box caches into the run dir, so playwright install has nothing to download; a missing revision is left to the install', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwseed-'));
  try {
    const mk = (cache: string, name: string, done: boolean, body: string) => { const d = join(dir, cache, name); mkdirSync(join(d, 'sub'), { recursive: true }); writeFileSync(join(d, 'sub', 'chrome'), body); if (done) writeFileSync(join(d, 'INSTALLATION_COMPLETE'), ''); return d; };
    mk('a', 'chromium-1234', true, 'A-chromium'); mk('a', 'chromium_headless_shell-1234', true, 'A-shell'); mk('a', 'ffmpeg-1011', true, 'A-ffmpeg');
    mk('a', 'chromium-9999', false, 'half-downloaded'); mk('a', 'webkit-2336', true, 'webkit');
    mk('b', 'ffmpeg-1011', true, 'B-ffmpeg'); mk('b', 'chromium-1300', true, 'B-newer');
    const run = join(dir, 'run'), caches = [join(dir, 'a'), join(dir, 'b'), join(dir, 'missing')];
    const r = spawnSync('bash', ['-c', `set -uo pipefail\nRUN='${run}'\nmkdir -p "$RUN"\n${pwSeed(caches)}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '', 'a missing cache is not an error');
    assert.deepEqual(readdirSync(join(run, 'pw')).sort(), ['chromium-1234', 'chromium-1300', 'chromium_headless_shell-1234', 'ffmpeg-1011'], 'finished chromium, headless shell and ffmpeg only: no half-downloaded revision, no webkit');
    assert.equal(readFileSync(join(run, 'pw', 'ffmpeg-1011', 'sub', 'chrome'), 'utf8'), 'A-ffmpeg', 'the first cache wins');
    assert.ok(existsSync(join(run, 'pw', 'chromium-1234', 'INSTALLATION_COMPLETE')), 'the marker comes along: that is what makes playwright skip the download');
    const copy = join(run, 'pw', 'chromium-1234', 'sub', 'chrome'), orig = join(dir, 'a', 'chromium-1234', 'sub', 'chrome');
    assert.ok(!lstatSync(copy).isSymbolicLink() && statSync(copy).ino !== statSync(orig).ino, 'a copy, not a link: a row can never write into the shared cache');
    assert.equal(spawnSync('bash', ['-c', `set -uo pipefail\nRUN='${join(dir, 'run2')}'\nmkdir -p "$RUN"\n${pwSeed([join(dir, 'nowhere')])}`]).status, 0);
    assert.deepEqual(readdirSync(join(dir, 'run2', 'pw')), [], 'no cache: an empty pw dir and the install downloads as before');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('the rows runner seeds the run browser dir from the cache after setting it and before the install', () => {
  const s = buildRowsRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, rows: [31, 33], total: 53 });
  const at = (needle: string) => s.indexOf(needle);
  assert.ok(at('export PLAYWRIGHT_BROWSERS_PATH="$RUN/pw"') > -1 && at('export PLAYWRIGHT_BROWSERS_PATH="$RUN/pw"') < at(pwSeed()) && at(pwSeed()) < at('npx playwright install chromium'), 'seed sits between the path export and the install');
  assert.ok(s.includes('/opt/frankendom-shadow/ms-playwright') && s.includes('/root/.cache/ms-playwright'));
});
