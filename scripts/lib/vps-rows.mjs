// The release ROWS on the prepaid VPS (Dom 2026-10-11: VPS first, Hugging Face only as spillover), the sibling of vps-unit.mjs and under the same three guards plus the
// Auditor's rows conditions (ruling on the #2177 thread):
//  - the same runner shape: pinned node tarball, per-run nonce on the LAST line only after the rows' exit status, row output in a log file (never the parsed stream), a unique run dir
//    under lanejobs.slice, a real shared clone checked out after the box-side tree check;
//  - per-row ok comes from the rows' own exit status (release-checks.mjs exits 0 only when every requested row passed); the RECEIPT's row set must EQUAL the requested set;
//  - Chromium is installed per run into the run dir; the RECEIPT records the playwright version, the Chromium revision and the sha256 of the chrome executable, and the trust side
//    checks the version and revision against THIS tree's playwright;
//  - a DISTINCT receipt kind, 'vps-rows-live': trustedFromShards (HF receipts) can never read it, and it can never be read as one; vpsSafeRow() is applied again at TRUST time
//    (WebKit, real-clock resume, wall-clock and NEVER_ON_HF rows are never trusted from here), the row scripts' sha256 must equal this tree's own, the tree must equal the deploy tree,
//    and the receipt must be fresh. T4 wall rows stay on Hugging Face's T4.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { MAX_AGE_S, NODE_PIN, RUN_ROOT, newNonce, newRunId, runnerHead } from './vps-unit.mjs';
import { vpsSafeRow } from './vps-receipts.mjs';
import { vpsHost } from './waterfall.mjs';

const HEX40 = /^[0-9a-f]{40}$/, HEX64 = /^[0-9a-f]{64}$/;
const scriptOf = argv => (argv || []).find(arg => /\.(mjs|js|sh)$/.test(arg));
const sha256 = text => createHash('sha256').update(text).digest('hex');

// rows: ascending unique row numbers (1-based, as in .quality-gate.json release_commands); total: how many rows the gate has.
export function buildRowsRunner({ sha, tree, nonce, runid, rows, total, width = 4 }) {
  if (!Array.isArray(rows) || !rows.length || rows.some(n => !Number.isInteger(n) || n < 1 || n > 999) || new Set(rows).size !== rows.length) throw new Error('rows must be unique positive integers');
  if (!Number.isInteger(total) || total < Math.max(...rows) || total > 999) throw new Error('total must cover the rows');
  if (!Number.isInteger(width) || width < 1 || width > 8) throw new Error('width must be 1-8');
  const skip = Array.from({ length: total }, (_, i) => i + 1).filter(n => !rows.includes(n)).join(',');
  return runnerHead({ sha, tree, nonce, runid }) + `export PLAYWRIGHT_BROWSERS_PATH="$RUN/pw"
npx playwright install --with-deps chromium < /dev/null > "$RUN/pw.log" 2>&1 || { echo '--- playwright install failed ---' >&2; tail -n 20 "$RUN/pw.log" >&2; exit 99; }
PWVER=$(node -p 'require("playwright-core/package.json").version')
PWREV=$(node -p 'require("playwright-core/browsers.json").browsers.find(b => b.name === "chromium").revision')
CHROME=$(ls "$RUN"/pw/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)
[ -n "$CHROME" ] || exit 99
CHROMESHA=$(sha256sum "$CHROME" | cut -c1-64)
npm run build < /dev/null > "$RUN/build.log" 2>&1 || { echo '--- build failed ---' >&2; tail -n 20 "$RUN/build.log" >&2; exit 100; }
RELEASE_CHECKS_SKIP='${skip}' RELEASE_CHECKS_SKIP_SOURCE= RELEASE_CHECK_CONCURRENCY=${width} node scripts/release-checks.mjs < /dev/null > "$RUN/rows.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then
  ROWS=$(node -e 'const fs=require("fs"),c=require("crypto");const d=JSON.parse(fs.readFileSync("artifacts/release-checks.json","utf8")).checks_detail||[];const out=[];for(const r of d){if(r.trusted)continue;const f=String(r.command||"").split(" ").find(a=>/[.](mjs|js|sh)$/.test(a));out.push({n:r.index,ok:true,seconds:r.seconds,script_sha256:f&&fs.existsSync(f)?c.createHash("sha256").update(fs.readFileSync(f)).digest("hex"):null})}console.log(JSON.stringify(out))')
  printf 'RECEIPT %s {"sha":"${sha}","tree":"%s","runid":"${runid}","node":"${NODE_PIN.version}","node_tarball_sha256":"${NODE_PIN.sha256}","playwright":"%s","chromium_revision":"%s","chrome_sha256":"%s","width":${width},"rows":%s,"exit":0,"seconds":%s}\\n' "$NONCE" "$BOXTREE" "$PWVER" "$PWREV" "$CHROMESHA" "$ROWS" "$(( $(date +%s) - t0 ))"
fi
[ "$rc" -eq 0 ] || { echo "--- failing rows (exit $rc) ---" >&2; grep -E 'FAILED|CEILING' "$RUN/rows.log" | head -20 >&2; echo "--- rows.log tail ---" >&2; tail -n 25 "$RUN/rows.log" >&2; }
exit "$rc"
`;
}

/** @returns {{ ok: boolean, reason?: string, receipt?: any }} */
export function parseRowsReceipt({ stdout, status, nonce, sha, tree, rows }) {
  /** @type {(reason: string) => { ok: boolean, reason?: string, receipt?: any }} */
  const fail = reason => ({ ok: false, reason });
  if (status !== 0) return fail(`ssh/rows exit ${status}`);
  const last = String(stdout || '').split('\n').map(l => l.trimEnd()).filter(Boolean).pop() || '';
  const m = /^RECEIPT ([0-9a-f]{32}) (\{.*\})$/.exec(last);
  if (!m) return fail('no RECEIPT on the last line');
  if (m[1] !== nonce) return fail('RECEIPT nonce is not ours');
  let r; try { r = JSON.parse(m[2]); } catch { return fail('RECEIPT json'); }
  if (r?.sha !== sha || r?.tree !== tree) return fail('RECEIPT sha/tree differ from the deploy commit');
  if (r.exit !== 0) return fail(`RECEIPT says exit ${r.exit}`);
  if (r.node_tarball_sha256 !== NODE_PIN.sha256 || r.node !== NODE_PIN.version) return fail('RECEIPT node is not the pinned tarball');
  if (typeof r.playwright !== 'string' || typeof r.chromium_revision !== 'string' || !HEX64.test(r.chrome_sha256 || '')) return fail('RECEIPT lacks the playwright / chromium revision / chrome sha256');
  const got = Array.isArray(r.rows) ? r.rows.map(x => x?.n) : [];
  const want = [...rows].sort((a, b) => a - b);
  if (got.length !== want.length || [...got].sort((a, b) => a - b).some((n, i) => n !== want[i])) return fail(`RECEIPT rows [${got}] are not the requested set [${want}]`);
  if (!r.rows.every(x => x.ok === true && typeof x.script_sha256 === 'string' && Number.isFinite(x.seconds))) return fail('a RECEIPT row is not ok / has no script hash');
  return { ok: true, receipt: r };
}

// pw: this tree's { version, revision } read from the deploy checkout's playwright-core (null = fail closed). Returns the trusted row numbers.
export function vpsRowsTrusted(rec, tree, commands, readSource, pw, now = Date.now()) {
  if (!rec || rec.kind !== 'vps-rows-live' || !HEX40.test(tree || '') || rec.tree !== tree || !HEX40.test(rec.sha || '') || rec.exit !== 0) return [];
  if (rec.node_tarball_sha256 !== NODE_PIN.sha256 || rec.node !== NODE_PIN.version || !HEX64.test(rec.chrome_sha256 || '')) return [];
  if (!pw?.version || !pw?.revision || rec.playwright !== pw.version || rec.chromium_revision !== pw.revision) return [];
  const age = now - Date.parse(rec.at);
  if (!(age < MAX_AGE_S * 1000 && age >= -60_000) || !Array.isArray(rec.rows)) return [];
  return rec.rows.filter(r => {
    if (!Number.isInteger(r?.n) || r.ok !== true || r.n < 1 || r.n > commands.length) return false;
    const argv = commands[r.n - 1], script = scriptOf(argv), text = script ? readSource(script) : null;
    // vpsSafeRow again at trust time: a receipt cannot vouch for a WebKit, real-clock, wall-clock or NEVER_ON_HF row (allowWall = false: the T4 is the only box for those).
    return text != null && r.script_sha256 === sha256(text) && vpsSafeRow(argv.join(' '), argv, readSource, false);
  }).map(r => r.n).sort((a, b) => a - b);
}

// run(cmd, argv, opts) defaults to spawnSync. One ssh session pipes the runner; only ITS live stdout is parsed.
export function runRowsOnVps(opts) {
  try { return runRowsOnVpsUnsafe(opts); } catch (e) { return { ok: false, reason: `exception: ${e?.message || e}` }; }   // a throw must spill to Hugging Face, never skip it
}
/** @param {{ sha: string, tree: string, rows: number[], total: number, width?: number, nonce?: string, runid?: string, host?: string, key?: string, run?: any }} opts @returns {{ ok: boolean, reason?: string, receipt?: any }} */
function runRowsOnVpsUnsafe({ sha, tree, rows, total, width = 4, nonce = newNonce(), runid = newRunId(), host = vpsHost(), key = `${process.env.HOME}/.ssh/binance_futures_tool`, run = spawnSync }) {
  const runner = buildRowsRunner({ sha, tree, nonce, runid, rows, total, width });
  const ssh = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, host];
  const r = run('ssh', [...ssh, 'systemd-run --scope --slice=lanejobs.slice --quiet bash -s'], { input: runner, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 40 * 60_000 });
  const parsed = parseRowsReceipt({ stdout: r.stdout, status: r.status, nonce, sha, tree, rows });
  if (!parsed.ok) { parsed.reason = `${parsed.reason}${r.stderr ? `; box said: ${String(r.stderr).slice(-1500)}` : ''}`; run('ssh', [...ssh, `rm -rf '${RUN_ROOT}/${sha}-${runid}'`], { timeout: 60_000 }); }
  return parsed;
}
