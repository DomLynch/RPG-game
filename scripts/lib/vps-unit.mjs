// The release unit suite on the prepaid VPS (Dom 2026-10-11: VPS first, Hugging Face only as spillover). The VPS has no third-party job record to inspect, so the receipt is
// trusted ONLY from our own live ssh session, under the Auditor's guards (PR #2169 thread, 2026-10-11):
//  1. the node used is the official linux-x64 tarball, downloaded fresh and checked against NODE_PIN below (pinned in this checkout), plus its own bundled npm; never the box's binaries;
//  2. a per-run NONCE we generate, held as an UNEXPORTED shell variable in the piped script (stdin only: not env, not argv, not in any directory name); test:all runs with stdin closed and
//     its output in a log file, never on the parsed stream; one `RECEIPT <nonce> {json}` line is printed after test:all exits 0 and the script exits with that status. We accept only the
//     LAST line, with our nonce, ssh exit 0, our sha and tree, zero failures and the pinned tarball hash;
//  3. a unique run dir /root/deploy-runs/<sha>-<runid> (not /tmp: the #2146 sweep), run under lanejobs.slice, removed afterwards.
// Nothing is read from the box afterwards. The accepted receipt is stored on the Mac (~/.claude/state/pre-launch/<sha>.unitvps) for deploy.sh, which re-checks it against the deploy tree.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const NODE_PIN = { version: 'v22.23.3', file: 'node-v22.23.3-linux-x64.tar.xz', sha256: 'df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de' };   // nodejs.org SHASUMS256.txt
export const RUN_ROOT = '/root/deploy-runs';
export const MAX_AGE_S = 4 * 3600;
const HEX40 = /^[0-9a-f]{40}$/, HEX32 = /^[0-9a-f]{32}$/, HEX16 = /^[0-9a-f]{16}$/;
export const newNonce = () => randomBytes(16).toString('hex');
export const newRunId = () => randomBytes(8).toString('hex');

export function buildRunner({ sha, tree, nonce, runid }) {
  if (!HEX40.test(sha || '') || !HEX40.test(tree || '') || !HEX32.test(nonce || '') || !HEX16.test(runid || '')) throw new Error('buildRunner: sha/tree must be 40 hex, nonce 32 hex, runid 16 hex');
  return `set -uo pipefail
NONCE='${nonce}'
RUN='${RUN_ROOT}/${sha}-${runid}'
trap 'rm -rf "$RUN"' EXIT
mkdir -p "$RUN" || exit 90
cd "$RUN" || exit 90
curl -fsSL "https://nodejs.org/dist/${NODE_PIN.version}/${NODE_PIN.file}" -o node.tar.xz < /dev/null || exit 91
echo "${NODE_PIN.sha256}  node.tar.xz" | sha256sum -c - > /dev/null || exit 92
tar -xJf node.tar.xz || exit 93
PATH="$RUN/node-${NODE_PIN.version}-linux-x64/bin:/usr/bin:/bin"
hash -r
cd src || exit 94
t0=$(date +%s)
npm ci --no-audit --no-fund < /dev/null > "$RUN/ci.log" 2>&1 || exit 95
npm run test:all < /dev/null > "$RUN/unit.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then
  pass=$(grep -E '^# pass ' "$RUN/unit.log" | tail -1 | awk '{print $3}')
  fail=$(grep -E '^# fail ' "$RUN/unit.log" | tail -1 | awk '{print $3}')
  printf 'RECEIPT %s {"sha":"${sha}","tree":"${tree}","node":"${NODE_PIN.version}","node_tarball_sha256":"${NODE_PIN.sha256}","pass":%s,"fail":%s,"exit":0,"seconds":%s}\\n' "$NONCE" "\${pass:-0}" "\${fail:-1}" "$(( $(date +%s) - t0 ))"
fi
exit "$rc"
`;
}

// stdout: the ssh session's live stdout; status: its exit code. Only the LAST non-empty line counts.
export function parseReceipt({ stdout, status, nonce, sha, tree }) {
  const fail = reason => ({ ok: false, reason });
  if (status !== 0) return fail(`ssh/test exit ${status}`);
  const last = String(stdout || '').split('\n').map(l => l.trimEnd()).filter(Boolean).pop() || '';
  const m = /^RECEIPT ([0-9a-f]{32}) (\{.*\})$/.exec(last);
  if (!m) return fail('no RECEIPT on the last line');
  if (m[1] !== nonce) return fail('RECEIPT nonce is not ours');
  let r; try { r = JSON.parse(m[2]); } catch { return fail('RECEIPT json'); }
  if (r?.sha !== sha || r?.tree !== tree) return fail('RECEIPT sha/tree differ from the deploy commit');
  if (r.exit !== 0 || r.fail !== 0 || !(r.pass > 0)) return fail(`RECEIPT says exit ${r.exit}, ${r.fail} failed, ${r.pass} passed`);
  if (r.node_tarball_sha256 !== NODE_PIN.sha256 || r.node !== NODE_PIN.version) return fail('RECEIPT node is not the pinned tarball');
  return { ok: true, receipt: r };
}

// The stored receipt deploy.sh re-checks (vps-receipt-trust.mjs --unit-vps): the deploy TREE, fresh, pinned tarball, no failures.
export function vpsUnitFileOk(rec, tree, now = Date.now()) {
  return !!rec && rec.kind === 'vps-unit-live' && HEX40.test(tree || '') && rec.tree === tree && HEX40.test(rec.sha || '') && rec.exit === 0 && rec.fail === 0 && rec.pass > 0
    && rec.node_tarball_sha256 === NODE_PIN.sha256 && rec.node === NODE_PIN.version && now - Date.parse(rec.at) < MAX_AGE_S * 1000 && now - Date.parse(rec.at) >= -60_000;
}

// run(cmd, argv, opts) defaults to spawnSync. Two ssh sessions of ours: extract a fresh \`git archive <sha>\`, then pipe the runner and parse ITS live stdout.
export function runUnitOnVps({ sha, tree, nonce = newNonce(), runid = newRunId(), host = process.env.VPS_HOST || 'root@49.12.7.18', key = process.env.VPS_KEY || `${process.env.HOME}/.ssh/binance_futures_tool`, run = spawnSync } = {}) {
  const runner = buildRunner({ sha, tree, nonce, runid });
  const ssh = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, host];
  const dir = `${RUN_ROOT}/${sha}-${runid}`;
  const archive = run('git', ['archive', '--format=tar', sha], { maxBuffer: 1 << 30, timeout: 120_000 });
  if (archive.status !== 0) return { ok: false, reason: 'git archive failed' };
  const put = run('ssh', [...ssh, `mkdir -p '${dir}/src' && tar -x -C '${dir}/src'`], { input: archive.stdout, maxBuffer: 1 << 20, timeout: 300_000 });
  if (put.status !== 0) return { ok: false, reason: 'archive upload failed' };
  const r = run('ssh', [...ssh, 'systemd-run --scope --slice=lanejobs.slice --quiet bash -s'], { input: runner, encoding: 'utf8', maxBuffer: 1 << 20, timeout: 45 * 60_000 });
  const parsed = parseReceipt({ stdout: r.stdout, status: r.status, nonce, sha, tree });
  if (!parsed.ok) run('ssh', [...ssh, `rm -rf '${dir}'`], { timeout: 60_000 });   // a failed run leaves nothing behind
  return parsed;
}
