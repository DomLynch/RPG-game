// Router PR 2: the release unit suite runs on the VPS (prepaid) when the box is quiet, Hugging Face only as spillover. The receipt is trusted ONLY from our own live ssh
// session, under the Auditor's guards: a pinned official node tarball, a per-run nonce the code under test never sees, test output in a log file (never the parsed
// stream), the nonce printed on the LAST line only after test:all exits 0, ssh exit 0, tree == deploy tree, and a unique run dir outside /tmp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { NODE_PIN, buildRunner, parseReceipt, vpsUnitFileOk, runUnitOnVps, newNonce } = await import('../scripts/lib/vps-unit.mjs');
const SHA = 'a'.repeat(40), TREE = 'b'.repeat(40), NONCE = 'c'.repeat(32), RUNID = '1'.repeat(16);
const good = { sha: SHA, tree: TREE, node_tarball_sha256: NODE_PIN.sha256, node: NODE_PIN.version, pass: 3421, fail: 0, exit: 0, seconds: 300 };
const stream = (n = NONCE, r: object = good, before = 'noise\n') => `${before}RECEIPT ${n} ${JSON.stringify(r)}\n`;
const args = (over: object = {}) => ({ stdout: stream(), status: 0, nonce: NONCE, sha: SHA, tree: TREE, ...over });

test('NODE_PIN is the official linux-x64 tarball with a 64-hex sha256 pinned in the checkout', () => {
  assert.match(NODE_PIN.sha256, /^[0-9a-f]{64}$/);
  assert.match(NODE_PIN.file, /^node-v22\.\d+\.\d+-linux-x64\.tar\.xz$/);
  assert.ok(NODE_PIN.file.includes(NODE_PIN.version));
});

test('parseReceipt: accepted only from the last line, with our nonce, ssh exit 0, the right sha and tree, and the pinned tarball', () => {
  const ok = parseReceipt(args());
  assert.equal(ok.ok, true); assert.equal(ok.receipt.pass, 3421);
});
test('parseReceipt: a fake RECEIPT printed by a test (wrong nonce) is rejected', () => {
  assert.equal(parseReceipt(args({ stdout: stream('d'.repeat(32)) })).ok, false);
  assert.equal(parseReceipt(args({ stdout: `RECEIPT unit ${JSON.stringify(good)}\n` })).ok, false);
});
test('parseReceipt: a fake line BEFORE the real one cannot win, and a fake line AFTER the real one replaces it (only the last line counts)', () => {
  assert.equal(parseReceipt(args({ stdout: stream(NONCE, good, `RECEIPT ${'d'.repeat(32)} ${JSON.stringify({ ...good, pass: 1 })}\n`) })).ok, true);
  assert.equal(parseReceipt(args({ stdout: stream() + `RECEIPT ${'d'.repeat(32)} ${JSON.stringify(good)}\n` })).ok, false);
});
test('parseReceipt fails closed: non-zero ssh exit, missing RECEIPT, tree or sha mismatch, failing tests, zero tests, wrong node tarball, bad JSON', () => {
  for (const [why, over] of Object.entries({
    'non-zero exit': { status: 1 }, 'killed (null status)': { status: null },
    'no receipt line': { stdout: 'all good\n' }, 'empty stream': { stdout: '' },
    'tree mismatch': { tree: 'e'.repeat(40) }, 'sha mismatch': { sha: 'e'.repeat(40) },
    'failed tests': { stdout: stream(NONCE, { ...good, fail: 2 }) }, 'zero tests': { stdout: stream(NONCE, { ...good, pass: 0 }) },
    'non-zero test exit': { stdout: stream(NONCE, { ...good, exit: 1 }) },
    'wrong node tarball': { stdout: stream(NONCE, { ...good, node_tarball_sha256: 'f'.repeat(64) }) },
    'bad json': { stdout: `RECEIPT ${NONCE} {nope\n` }, 'receipt tree differs': { stdout: stream(NONCE, { ...good, tree: 'e'.repeat(40) }) },
  })) assert.equal(parseReceipt(args(over)).ok, false, why);
});

test('buildRunner: the nonce is an unexported shell variable (never env/argv), test output goes to a log file, the RECEIPT is printed only after test:all exits 0, with stdin closed for the code under test', () => {
  const s = buildRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID });
  assert.ok(s.includes(`NONCE='${NONCE}'`)); assert.ok(!/export\s+NONCE|declare -x NONCE|env\s+NONCE/.test(s));
  assert.ok(!/NONCE/.test(s.split('npm run test:all')[1].split('\n')[0] ?? ''), 'the nonce is not on the test command line');
  assert.match(s, /npm run test:all[^\n]*<\s*\/dev\/null[^\n]*>\s*"\$RUN\/unit\.log"|npm run test:all[^\n]*>\s*"\$RUN\/unit\.log"[^\n]*<\s*\/dev\/null/);
  assert.match(s, /npm ci[^\n]*<\s*\/dev\/null/);
  const idxTest = s.indexOf('npm run test:all'), idxCheck = s.indexOf('[ "$rc" -eq 0 ]'), idxReceipt = s.indexOf('RECEIPT %s');
  assert.ok(idxTest > 0 && idxCheck > idxTest && idxReceipt > idxCheck, 'the receipt is printed after the exit-status check, which is after the tests');
  assert.equal(s.split('RECEIPT %s').length - 1, 1, 'exactly one place prints a RECEIPT');
  assert.match(s, /exit "\$rc"/);
});
test('buildRunner: unique run dir outside /tmp, the pinned tarball verified before use, removed afterwards', () => {
  const s = buildRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID });
  assert.ok(s.includes(`/root/deploy-runs/${SHA}-${RUNID}`)); assert.ok(!s.includes(`deploy-runs/${SHA}-${NONCE}`), 'the run dir name must not reveal the nonce (a test could ls it)'); assert.ok(!/\/tmp\//.test(s));
  assert.ok(s.includes(NODE_PIN.sha256) && s.includes(NODE_PIN.file) && /sha256sum -c/.test(s));
  assert.ok(s.indexOf('sha256sum -c') < s.indexOf('npm ci'), 'the tarball is verified before anything runs');
  assert.match(s, /trap [^\n]*rm -rf/);
  assert.match(s, /PATH="\$RUN\/node/);
});
test('buildRunner is valid bash and refuses a malformed sha, tree or nonce (no shell injection through arguments)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vpsunit-'));
  try {
    writeFileSync(join(dir, 'r.sh'), buildRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID }));
    assert.equal(spawnSync('bash', ['-n', join(dir, 'r.sh')]).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  for (const bad of [{ sha: 'x; rm -rf /', tree: TREE, nonce: NONCE, runid: RUNID }, { sha: SHA, tree: 'y', nonce: NONCE, runid: RUNID }, { sha: SHA, tree: TREE, nonce: "a'b", runid: RUNID }, { sha: SHA, tree: TREE, nonce: NONCE, runid: '../x' }]) assert.throws(() => buildRunner(bad));
  assert.match(newNonce(), /^[0-9a-f]{32}$/); assert.notEqual(newNonce(), newNonce());
});

test('runUnitOnVps: archives the sha, runs the runner under lanejobs.slice with ssh, and accepts only a verified receipt', () => {
  const calls: any[] = [];
  const ok = runUnitOnVps({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, run: (cmd: string, argv: string[], opts: any) => { calls.push([cmd, argv, opts]); return cmd === 'ssh' && argv.join(' ').includes('bash -s') ? { status: 0, stdout: stream() } : { status: 0, stdout: '' }; } });
  assert.equal(ok.ok, true);
  const ssh = calls.filter(c => c[0] === 'ssh').map(c => c[1].join(' '));
  assert.ok(ssh.some(l => l.includes('lanejobs.slice') && l.includes('bash -s')), 'the runner runs in lanejobs.slice');
  const runnerText = calls.find(c => c[0] === 'ssh' && c[2]?.input)?.[2].input as string;
  assert.ok(runnerText.includes(`git -C '/opt/frankendom-shadow/repo' archive '${SHA}'`) && runnerText.includes(`rev-parse '${SHA}^{tree}'`) && runnerText.includes(`[ "$BOXTREE" = '${TREE}' ]`), 'a fresh git archive of the sha, after its tree hash is checked on the box');
  assert.ok(!calls.some(c => c[0] === 'git'), 'nothing is archived or uploaded from the Mac (the repo is >1 GB)');
  const runner = calls.find(c => c[0] === 'ssh' && c[2]?.input)?.[2].input as string;
  assert.ok(runner.includes(NONCE), 'the nonce travels on stdin only');
  assert.ok(!calls.some(c => c[1].join(' ').includes(NONCE)), 'the nonce is never in argv');
  const bad = runUnitOnVps({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, run: (cmd: string) => ({ status: cmd === 'ssh' ? 1 : 0, stdout: stream() }) });
  assert.equal(bad.ok, false);
});

test('vpsUnitFileOk: the stored receipt is trusted only for the deploy tree, fresh, with the pinned tarball and zero failures', () => {
  const rec = { kind: 'vps-unit-live', ...good, at: new Date().toISOString() };
  assert.equal(vpsUnitFileOk(rec, TREE), true);
  assert.equal(vpsUnitFileOk(rec, 'e'.repeat(40)), false, 'tree mismatch');
  assert.equal(vpsUnitFileOk({ ...rec, fail: 1 }, TREE), false);
  assert.equal(vpsUnitFileOk({ ...rec, kind: 'vps-unit-suite' }, TREE), false);
  assert.equal(vpsUnitFileOk({ ...rec, node_tarball_sha256: 'f'.repeat(64) }, TREE), false);
  assert.equal(vpsUnitFileOk({ ...rec, at: new Date(Date.now() - 5 * 3600e3).toISOString() }, TREE), false, 'older than 4 h');
  assert.equal(vpsUnitFileOk(null, TREE), false);
});

test('vps-receipt-trust --unit-vps: trusts the stored receipt only for this commit\'s tree (the deploy-side re-check), fails closed otherwise', () => {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), tree = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).stdout.trim();
  const dir = mkdtempSync(join(tmpdir(), 'unitvps-'));
  const run = () => spawnSync('node', ['scripts/vps-receipt-trust.mjs', sha, '--unit-vps'], { encoding: 'utf8', env: { ...process.env, PRELAUNCH_DIR: dir } }).stdout;
  try {
    assert.equal(run(), '', 'no file, no trust');
    const rec = { kind: 'vps-unit-live', ...good, sha, tree, at: new Date().toISOString() };
    writeFileSync(join(dir, `${sha}.unitvps`), JSON.stringify(rec)); assert.equal(run(), 'ok');
    writeFileSync(join(dir, `${sha}.unitvps`), JSON.stringify({ ...rec, tree: 'e'.repeat(40) })); assert.equal(run(), '', 'another tree');
    writeFileSync(join(dir, `${sha}.unitvps`), '{truncated'); assert.equal(run(), '', 'garbage');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('deploy-vps.sh asks for the VPS unit receipt before the Hugging Face job, and launch.mjs routes unit through pickTarget', () => {
  const dv = readFileSync('scripts/lib/deploy-vps.sh', 'utf8'), lm = readFileSync('scripts/vps-shadow/launch.mjs', 'utf8');
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.ok(dv.includes('vps_unit_live_ok()') && dv.includes('--unit-vps'));
  assert.ok(deploy.indexOf('vps_unit=$(vps_unit_receipt_ok)') > 0 && deploy.indexOf('vps_unit=$(vps_unit_live_ok)') > deploy.indexOf('vps_unit=$(vps_unit_receipt_ok)'), 'the live VPS receipt is the second source, after the HF job');
  assert.match(lm, /pickTarget\(\{ mem: \d+, vps: status \}\)/); assert.match(lm, /runUnitOnVps\(/); assert.match(lm, /spilling to Hugging Face/);
});

test('vpsHost: a bare VPS_HOST (this Mac exports one without a user) means root; a full user@host is kept', async () => {
  const { vpsHost } = await import('../scripts/lib/waterfall.mjs');
  assert.equal(vpsHost({ VPS_HOST: '49.12.7.18' }), 'root@49.12.7.18');
  assert.equal(vpsHost({ VPS_HOST: 'deploy@box' }), 'deploy@box');
  assert.equal(vpsHost({}), 'root@49.12.7.18');
});

test('runUnitOnVps never throws: a malformed or missing sha is a failed run (so launch.mjs spills to Hugging Face), and the box\'s stderr tail rides in the reason', () => {
  const r = runUnitOnVps({ sha: 'not-a-sha', tree: TREE, run: () => ({ status: 0, stdout: '' }) });
  assert.equal(r.ok, false); assert.match(String(r.reason), /exception/);
  const failed = runUnitOnVps({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID, run: () => ({ status: 1, stdout: '', stderr: '--- unit.log tail (exit 1) ---\nnot ok 7 - a test' }) });
  assert.equal(failed.ok, false); assert.match(String(failed.reason), /not ok 7 - a test/);
});
test('the RECEIPT carries the BOX-computed tree and the run id (so the Published line can cite it)', () => {
  const s = buildRunner({ sha: SHA, tree: TREE, nonce: NONCE, runid: RUNID });
  assert.match(s, /BOXTREE=\$\(git [^\n]*rev-parse/); assert.match(s, /"\$NONCE" "\$BOXTREE"/); assert.ok(s.includes(`"runid":"${RUNID}"`));
  assert.ok(s.indexOf('"$BOXTREE" = ') > 0 && s.indexOf('exit 97') < s.indexOf('npm ci'), 'the tree is checked on the box before anything runs');
});
