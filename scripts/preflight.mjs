// `npm run preflight -- <PR number | head sha>`: the review receipt (Lead, 2026-10-12). Merges the PR head with CURRENT trunk in a temp checkout ON THE VPS (never the lane's checkout),
// runs tsc + typecheck:tests + typecheck:origins + the data gate there (scripts/preflight-steps.sh), and prints ONE line:
//   RECEIPT preflight {"pr":N|null,"head":sha,"trunk":sha,"steps":{"merge":"pass","tsc":"fail",...},"conflicts":[files],"ok":bool,"at":iso}
// A merge conflict is a FAIL naming the files. The receipt names the trunk it merged against: the Auditor refuses one older than trunk. Exit 0 = ok, 1 = a step failed,
// 75 = the VPS is busy (a release run owns it) or unreadable: retry, nothing was run. Same pinned node, shadow clone and lanejobs.slice as the release unit run (scripts/lib/vps-unit.mjs).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { NODE_PIN, newRunId } from './lib/vps-unit.mjs';
import { vpsHost, vpsStatus } from './lib/waterfall.mjs';

const HEX40 = /^[0-9a-f]{40}$/;
const SHADOW_REPO = '/opt/frankendom-shadow/repo';
const PREFLIGHT_ROOT = '/root/preflight-runs';   // NOT /root/deploy-runs: a dir there counts as a live release run and would lock the lane jobs out

export function buildRunner({ head, trunk, runid, steps }) {
  if (!HEX40.test(head || '') || !HEX40.test(trunk || '') || !/^[0-9a-f]{16}$/.test(runid || '')) throw new Error('preflight runner: head and trunk must be 40 hex, runid 16 hex');
  return `set -uo pipefail
RUN='${PREFLIGHT_ROOT}/${head.slice(0, 8)}-${runid}'
trap 'rm -rf "$RUN"' EXIT
mkdir -p "$RUN" && cd "$RUN" || exit 90
curl -fsSL "https://nodejs.org/dist/${NODE_PIN.version}/${NODE_PIN.file}" -o node.tar.xz < /dev/null || exit 91
echo "${NODE_PIN.sha256}  node.tar.xz" | sha256sum -c - > /dev/null || exit 92
tar --no-same-owner -xJf node.tar.xz || exit 93
PATH="$RUN/node-${NODE_PIN.version}-linux-x64/bin:/usr/bin:/bin"; hash -r
git -C '${SHADOW_REPO}' fetch -q origin '${head}' '${trunk}' < /dev/null || { echo 'cannot fetch the head or trunk sha into the box'; exit 96; }
git clone -q --shared --no-checkout '${SHADOW_REPO}' "$RUN/src" < /dev/null && cd "$RUN/src" || exit 98
cat > "$RUN/steps.sh" <<'STEPS_EOF'
${steps}
STEPS_EOF
bash "$RUN/steps.sh" '${trunk}' '${head}' < /dev/null
`;
}

/** The last PREFLIGHT line of the box's output, or null. */
export function parsePreflight(stdout) {
  const line = String(stdout || '').split('\n').reverse().find(l => l.startsWith('PREFLIGHT {'));
  try { return line ? JSON.parse(line.slice('PREFLIGHT '.length)) : null; } catch { return null; }
}

export function receiptFrom({ pr, head, trunk, result, at = new Date().toISOString() }) {
  const ok = !!result && result.head === head && result.trunk === trunk && result.ok === true;
  return { pr, head, trunk, steps: result?.steps ?? { run: 'fail' }, conflicts: result?.conflicts ?? [], ok, at };
}

const sh = (cmd, args, input) => spawnSync(cmd, args, { encoding: 'utf8', input, timeout: 30 * 60_000, killSignal: 'SIGKILL', maxBuffer: 1 << 24 });

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: npm run preflight -- <PR number | 40-hex head sha>'); process.exit(2); }
  const pr = /^\d+$/.test(arg) ? Number(arg) : null;
  const head = pr ? sh('gh', ['pr', 'view', String(pr), '--json', 'headRefOid', '--jq', '.headRefOid']).stdout.trim() : arg;
  const trunkBranch = process.env.TRUNK_BRANCH || 'codex/01a09a76/task-1';
  const trunk = (sh('git', ['ls-remote', 'origin', `refs/heads/${trunkBranch}`]).stdout || '').split(/\s/)[0];
  if (!HEX40.test(head) || !HEX40.test(trunk)) { console.error(`cannot resolve the head (${head}) or trunk (${trunk})`); process.exit(2); }
  const st = vpsStatus();
  if (!st || st.releaseRuns > 0) { console.error(`VPS ${st ? 'is running a release' : 'is unreadable'}: nothing was run, retry`); process.exit(75); }
  const key = process.env.VPS_KEY || `${process.env.HOME}/.ssh/binance_futures_tool`;
  const runner = buildRunner({ head, trunk, runid: newRunId(), steps: readFileSync(new URL('./preflight-steps.sh', import.meta.url), 'utf8') });
  const r = sh('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, vpsHost(), 'systemd-run --scope --slice=lanejobs.slice --quiet bash -s'], runner);
  process.stdout.write(String(r.stdout || '').split('\n').filter(l => !l.startsWith('PREFLIGHT {')).join('\n'));
  if (r.stderr) process.stderr.write(String(r.stderr).slice(-1500));
  const receipt = receiptFrom({ pr, head, trunk, result: parsePreflight(r.stdout) });
  console.log(`RECEIPT preflight ${JSON.stringify(receipt)}`);
  process.exit(receipt.ok ? 0 : 1);
}
