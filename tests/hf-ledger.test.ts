// The HF cost ledger (Dom 2026-10-12): one line per HF job (id, flavor, minutes, USD, reason), an alarm at $3/day, no new T4 job at $5/day, counted
// from the ledger's own lines only, thresholds in one constant (HF_COST). Every file lives in a tmp dir (HF_COST_LEDGER), never ~/.claude/state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HF_COST, SHARED_LEDGER, ledgerPath, ledgerStore, localStore, record, spentOn, sshStore, t4Refusal, timeoutSeconds } from '../scripts/lib/hf-ledger.mjs';
import { withSlot } from '../scripts/lib/hf-slots.mjs';
import { USD_PER_HOUR } from '../scripts/hf-cleanup.mjs';

const NOON = Date.parse('2026-10-12T12:00:00Z');
const box = () => { const dir = mkdtempSync(join(tmpdir(), 'hf-ledger-')); return { dir, path: join(dir, 'ledger.tsv') }; };
const job = (n: number) => n.toString(16).padStart(24, '0');

test('the thresholds are one constant: alarm $3, T4 stop $5; prices come from hf-cleanup USD_PER_HOUR', () => {
  assert.deepEqual({ ...HF_COST }, { alarmUsdPerDay: 3, t4StopUsdPerDay: 5 });
  assert.ok(Object.isFrozen(HF_COST));
  assert.equal(USD_PER_HOUR['t4-medium'], 0.6);
  assert.deepEqual(['45m', '2h', '600s', '600', 'x'].map(timeoutSeconds), [2700, 7200, 600, 600, NaN]);
});

test('one line per job: id, flavor, minutes, USD (its --timeout x the hourly price, an upper bound), reason', () => {
  const { path } = box();
  const r = record({ id: job(1), flavor: 't4-medium', timeout: '45m', reason: 'gpu-only' }, { path, now: NOON, say: () => {} });
  assert.equal(r.usd, 0.45);
  record({ id: job(2), flavor: 'cpu-upgrade', timeout: '20m', reason: 'unit ci down' }, { path, now: NOON, say: () => {} });
  const lines = readFileSync(path, 'utf8').trim().split('\n').map(l => l.split('\t'));
  assert.deepEqual(lines.map(l => l.slice(1)), [[job(1), 't4-medium', '45', '0.4500', 'gpu-only'], [job(2), 'cpu-upgrade', '20', '0.0100', 'unit-ci-down']]);
  assert.equal(lines[0]![0], '2026-10-12T12:00:00.000Z');
});

test('the day counts only its own ledger lines (no backfill): other days and an empty ledger are $0', () => {
  const { path } = box();
  assert.equal(spentOn('', NOON), 0);
  writeFileSync(path, `2026-10-11T23:59:59.000Z\t${job(1)}\tt4-medium\t600\t6.0000\tgpu-only\n2026-10-12T00:00:01.000Z\t${job(2)}\tt4-medium\t60\t0.6000\tgpu-only\nALARM\t2026-10-12\t9.99\n`);
  assert.equal(spentOn(readFileSync(path, 'utf8'), NOON), 0.6, 'yesterday\'s $6 and the ALARM line do not count today');
  assert.equal(t4Refusal('t4-medium', { path, now: NOON }), null);
});

test('the alarm fires once, the first time the day passes $3: an ALARM line, a stderr line, and the flag file for the COO and Lead', () => {
  const { dir, path } = box(), said: string[] = [];
  const opts = { path, now: NOON, alarmDir: dir, say: (m: string) => said.push(m) };
  for (let i = 0; i < 6; i++) assert.equal(record({ id: job(i), flavor: 't4-medium', timeout: '45m', reason: 'gpu-only' }, opts).alarm, false, `$${(0.45 * (i + 1)).toFixed(2)}`);
  const crossing = record({ id: job(6), flavor: 't4-medium', timeout: '45m', reason: 'gpu-only' }, opts);   // 7 x 0.45 = 3.15
  assert.equal(crossing.alarm, true);
  assert.match(said.join('\n'), /HF COST ALARM: \$3\.15 on HF today \(UTC 2026-10-12\) passed \$3; the T4 stops at \$5/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'hf-cost-alarm-2026-10-12.json'), 'utf8')), { day: '2026-10-12', usd: 3.15, alarmAt: 3, t4StopAt: 5, lastJob: job(6) });
  assert.equal(record({ id: job(7), flavor: 'cpu-upgrade', timeout: '20m', reason: 'x' }, opts).alarm, false, 'once a day');
  assert.equal(readFileSync(path, 'utf8').split('\n').filter(l => l.startsWith('ALARM\t')).length, 1);
});

test('at $5 a day no new T4 job; CPU jobs continue', () => {
  const { path } = box();
  writeFileSync(path, `2026-10-12T01:00:00.000Z\t${job(1)}\tt4-medium\t500\t5.0000\tgpu-only\n`);
  assert.match(t4Refusal('t4-medium', { path, now: NOON })!, /\$5\.00 spent on HF today \(UTC 2026-10-12\), at or over the \$5 T4 stop/);
  assert.equal(t4Refusal('cpu-upgrade', { path, now: NOON }), null);
  writeFileSync(path, `2026-10-12T01:00:00.000Z\t${job(1)}\tt4-medium\t499\t4.9900\tgpu-only\n`);
  assert.equal(t4Refusal('t4-medium', { path, now: NOON }), null, '$4.99: still allowed');
});

test('withSlot({ cost }) is the one place: a T4 over the stop is refused before launch, a launched job is recorded, no cost records nothing', () => {
  const { path } = box(), prev = process.env.HF_COST_LEDGER;
  process.env.HF_COST_LEDGER = path;
  try {
    let t = 0; const clock = { now: () => t, sleep: (ms: number) => { t += ms; } }, ps = () => [];
    const ok = withSlot({ flavor: 't4-medium', generic: true, launch: () => ({ stdout: `Job started with ID: ${job(9)}\n` }), ps, cost: { timeout: '20m', reason: 'gpu-only' }, ...clock });
    assert.equal(ok.ok, true);
    assert.match(readFileSync(path, 'utf8'), new RegExp(`\\t${job(9)}\\tt4-medium\\t20\\t0\\.2000\\tgpu-only\\n$`));
    withSlot({ flavor: 't4-medium', generic: true, launch: () => ({ stdout: `Job started with ID: ${job(10)}\n` }), ps, ...clock });
    assert.doesNotMatch(readFileSync(path, 'utf8'), new RegExp(job(10)), 'a caller without cost is not counted');
    writeFileSync(path, `${new Date().toISOString()}\t${job(1)}\tt4-medium\t600\t6.0000\tgpu-only\n`);
    const refused = withSlot({ flavor: 't4-medium', generic: true, launch: () => assert.fail('must not launch over the stop'), ps, cost: { timeout: '20m', reason: 'gpu-only' }, ...clock });
    assert.equal(refused.ok, false);
    assert.match(String(!refused.ok && refused.refused), /T4 stop/);
    const cpu = withSlot({ flavor: 'cpu-upgrade', generic: true, launch: () => ({ stdout: `Job started with ID: ${job(11)}\n` }), ps, cost: { timeout: '20m', reason: 'unit' }, ...clock });
    assert.equal(cpu.ok, true, 'CPU continues past the T4 stop');
  } finally { if (prev === undefined) delete process.env.HF_COST_LEDGER; else process.env.HF_COST_LEDGER = prev; }
});

test('every HF launcher passes cost, with its reason, and says why when the stop refuses it', () => {
  const src = (f: string) => readFileSync(f, 'utf8');
  assert.match(src('scripts/hf-wall-rows.mjs'), /cost: \{ timeout, reason: 'gpu-only' \}/);
  assert.match(src('scripts/gpu-run.mjs'), /cost: \{ timeout: args\.timeout, reason: process\.env\.HF_REASON \|\| 'gpu-run' \}/);
  assert.match(src('scripts/vps-shadow/launch.mjs'), /cost: \{ timeout: args\[args\.indexOf\('--timeout'\) \+ 1\], reason: process\.env\.HF_REASON \|\| \(lane \? `lane-\$\{cmd\}` : cmd\) \}/);
  for (const f of ['scripts/hf-wall-rows.mjs', 'scripts/gpu-run.mjs', 'scripts/vps-shadow/launch.mjs']) assert.match(src(f), /slot\.refused \|\|/, `${f} prints the refusal`);
});

test('under node --test without HF_COST_LEDGER the ledger is a throwaway file, never ~/.claude/state', () => {
  const path = ledgerPath({ HOME: '/home/x', NODE_TEST_CONTEXT: 'child' } as NodeJS.ProcessEnv);
  assert.ok(path.startsWith(tmpdir()) && !path.includes('.claude'), path);
  assert.equal(ledgerPath({ HOME: '/home/x' } as NodeJS.ProcessEnv), '/home/x/.claude/state/hf-cost-ledger.tsv');
  assert.ok(!existsSync('/home/x'));
});

test('Auditor HOLD on #2329: ONE ledger for the account: VPS root, the VPS lanes user and the Mac share one day total; unreadable refuses a T4', () => {
  const vps = (HOME: string) => ledgerStore({ HOME } as NodeJS.ProcessEnv, { onVps: true });
  assert.equal(vps('/root').where, SHARED_LEDGER); assert.equal(vps('/home/lanes').where, SHARED_LEDGER, 'not per HOME');
  const mac = ledgerStore({ HOME: '/Users/dom' } as NodeJS.ProcessEnv, { onVps: false, ssh: () => ({ where: 'root@vps:' + SHARED_LEDGER, read: () => '', append: () => true }) });
  assert.equal(mac.where, `root@vps:${SHARED_LEDGER}`, 'the Mac reads and appends the VPS ledger');
  // two launchers (root's HOME, lanes' HOME) on one shared file: $2.70 + $2.70 crosses the $5 stop for the next T4, whoever launches it
  const { dir } = box(), shared = join(dir, 'shared.tsv');
  const root = localStore(shared, { shared: true }), lanes = localStore(shared, { shared: true });
  for (let i = 0; i < 6; i++) record({ id: job(i), flavor: 't4-medium', timeout: '45m', reason: 'gpu-only' }, { store: i % 2 ? lanes : root, now: NOON, alarmDir: dir, say: () => {} });
  assert.equal(t4Refusal('t4-medium', { store: lanes, now: NOON }), null, '$2.70: under the stop');
  assert.equal(spentOn(readFileSync(shared, 'utf8'), NOON).toFixed(2), '2.70');
  for (let i = 6; i < 12; i++) record({ id: job(i), flavor: 't4-medium', timeout: '45m', reason: 'gpu-only' }, { store: i % 2 ? lanes : root, now: NOON, alarmDir: dir, say: () => {} });
  assert.match(t4Refusal('t4-medium', { store: root, now: NOON })!, /\$5\.40 spent on HF today/, 'the day total spans both launchers');
  assert.equal(readFileSync(shared, 'utf8').split('\n').filter(l => l.startsWith('ALARM\t')).length, 1, 'one alarm for the account, not one per launcher');
  // fail closed: the shared directory not set up, or the VPS unreachable
  const missing = localStore(join(dir, 'nodir', 'x.tsv'), { shared: true });
  assert.match(t4Refusal('t4-medium', { store: missing, now: NOON })!, /cannot be read: no new T4 job until it can.*install -d -m 2775 -g lanes \/var\/lib\/frankendom/);
  assert.equal(t4Refusal('cpu-upgrade', { store: missing, now: NOON }), null, 'CPU continues');
  const calls: { argv: string[], input?: string }[] = [];
  const down = sshStore({ host: 'root@h', key: 'k', run: ((_c: string, argv: string[], o: { input?: string }) => { calls.push({ argv, input: o?.input }); return { status: 255, stdout: '' }; }) as never });
  assert.match(t4Refusal('t4-medium', { store: down, now: NOON })!, /root@h:\/var\/lib\/frankendom\/hf-cost-ledger\.tsv\) cannot be read/);
  const up = sshStore({ host: 'root@h', key: 'k', run: ((_c: string, argv: string[], o: { input?: string }) => { calls.push({ argv, input: o?.input }); return { status: 0, stdout: '' }; }) as never });
  record({ id: job(20), flavor: 'cpu-upgrade', timeout: '20m', reason: 'capture' }, { store: up, now: NOON, alarmDir: dir, say: () => {} });
  const last = calls.at(-1)!;
  assert.match(last.argv.at(-1)!, /cat >> \/var\/lib\/frankendom\/hf-cost-ledger\.tsv/); assert.match(last.input!, new RegExp(`\\t${job(20)}\\tcpu-upgrade\\t20\\t`));
  const said: string[] = [];
  record({ id: job(21), flavor: 'cpu-upgrade', timeout: '20m', reason: 'x' }, { store: down, now: NOON, alarmDir: dir, say: (m: string) => said.push(m) });
  assert.match(said.join('\n'), /could not append job .* NOT counted/);
  // capture-mac.sh's direct `hf jobs run` records through the same call
  assert.match(readFileSync('scripts/capture-mac.sh', 'utf8'), /lib\/hf-ledger\.mjs" record "\$id" cpu-upgrade "\$hf_timeout"/);
});
