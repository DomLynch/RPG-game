// The HF half of the work waterfall: caps counted from `hf jobs ps`, one CPU slot reserved for the deploy lane, the T4 for graphics only, a tier line on every launch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

process.env.HF_SLOT_LOCK = join(mkdtempSync(join(tmpdir(), 'hf-slots-lock-')), 'lock');
const { CAPS, STALE_MS, rankOf, slotDecision, tierLine, tierOf, withSlot } = await import('../scripts/lib/hf-slots.mjs');
const { RELEASE_SLOT_WAIT_S, ROWS_CHILD_TIMEOUT_MS, genericJobArgs } = await import('../scripts/vps-shadow/launch.mjs');

const live = (flavor: string, n: number, stage = 'RUNNING') => Array.from({ length: n }, () => ({ flavor, status: { stage } }));
const sha = 'a'.repeat(40);

test('HF CPU: 4 in all, a lane stops at 3 so the 4th slot stays free for the deploy lane; T4: 4; only live stages count; other flavors do not', () => {
  assert.deepEqual([CAPS['cpu-upgrade'].total, CAPS['cpu-upgrade'].generic, CAPS['t4-medium'].total], [4, 3, 4]);
  assert.equal(slotDecision('cpu-upgrade', live('cpu-upgrade', 2), true).ok, true);
  assert.deepEqual(slotDecision('cpu-upgrade', live('cpu-upgrade', 2), true).slot, 3);
  assert.equal(slotDecision('cpu-upgrade', live('cpu-upgrade', 3), true).ok, false, 'a lane job never takes the 4th CPU slot');
  assert.equal(slotDecision('cpu-upgrade', live('cpu-upgrade', 3), false).ok, true, 'the unit/rows job takes it');
  assert.equal(slotDecision('cpu-upgrade', live('cpu-upgrade', 4), false).ok, false, 'never more than 4');
  assert.equal(slotDecision('cpu-upgrade', [...live('cpu-upgrade', 3, 'COMPLETED'), ...live('cpu-upgrade', 2, 'ERROR'), ...live('t4-medium', 4)], true).ok, true, 'finished jobs and the T4 do not count against the CPU');
  assert.equal(slotDecision('cpu-upgrade', [...live('cpu-upgrade', 1, 'SCHEDULING'), ...live('cpu-upgrade', 1, 'STARTING'), ...live('cpu-upgrade', 1, 'PENDING')], true).ok, false, 'queued stages count');
  assert.equal(slotDecision('t4-medium', live('t4-medium', 3), true).ok, true);
  assert.equal(slotDecision('t4-medium', live('t4-medium', 4), true).ok, false);
  assert.throws(() => slotDecision('cpu-basic', [], true));
  assert.equal(tierOf('cpu-upgrade'), 'hf-cpu'); assert.equal(tierOf('t4-medium'), 'hf-t4');
  assert.equal(tierLine('cpu-upgrade', 2, 3.4), 'tier=hf-cpu slot=2 queued=3s');
});

test('withSlot: starts at once when a slot is free, waits for one that frees up, gives up after maxWaitS, fails open when hf cannot list jobs', () => {
  let t = 0; const clock = { now: () => t, sleep: (ms: number) => { t += ms; } };
  const free = withSlot({ flavor: 'cpu-upgrade', generic: true, launch: () => 'started', ps: () => live('cpu-upgrade', 1), ...clock });
  assert.deepEqual([free.ok, free.ok && free.slot, free.ok && free.value, free.ok && free.queuedS], [true, 2, 'started', 0]);
  t = 0; let polls = 0;
  const waited = withSlot({ flavor: 'cpu-upgrade', generic: true, maxWaitS: 120, pollS: 15, launch: () => 'later', ps: () => (++polls < 4 ? live('cpu-upgrade', 3) : live('cpu-upgrade', 2)), ...clock });
  assert.equal(waited.ok, true); assert.equal(waited.ok && waited.queuedS, 45, 'three polls of 15 s');
  t = 0;
  const gaveUp = withSlot({ flavor: 'cpu-upgrade', generic: true, maxWaitS: 60, pollS: 15, launch: () => assert.fail('must not launch'), ps: () => live('cpu-upgrade', 3), ...clock });
  assert.deepEqual([gaveUp.ok, !gaveUp.ok && gaveUp.used, !gaveUp.ok && gaveUp.limit], [false, 3, 3]);
  t = 0;
  assert.equal(withSlot({ flavor: 't4-medium', generic: true, launch: () => 'open', ps: () => null, ...clock }).ok, true, 'an hf that cannot list jobs never blocks a job');
});

test('launch.mjs job: cpu-upgrade by default, --gfx is the only way to a T4, the command rides base64, refusals are loud', () => {
  const cpu = genericJobArgs([sha, '--lane', 'combat', '--', 'node', 'scripts/x.mjs', '--flag']);
  assert.equal(cpu.flavor, 'cpu-upgrade'); assert.deepEqual(cpu.args.slice(0, 5), ['jobs', 'run', '--flavor', 'cpu-upgrade', '--timeout']);
  const b64 = cpu.args[cpu.args.indexOf(cpu.args.find((a: string) => a.startsWith('JOB_ARGV_B64='))!)].slice('JOB_ARGV_B64='.length);
  assert.equal(Buffer.from(b64, 'base64').toString(), 'node scripts/x.mjs --flag');
  assert.match(cpu.args.join(' '), /timeout 300 apt-get update.*timeout 300 git fetch.*lap checkout/);
  assert.equal(genericJobArgs([sha, '--gfx', '--', 'node', 'still.mjs']).flavor, 't4-medium');
  assert.throws(() => genericJobArgs(['abc', '--', 'x']), /40-hex/);
  assert.throws(() => genericJobArgs([sha, 'x']), /usage/);
  assert.throws(() => genericJobArgs([sha, '--flavor', 't4-medium', '--', 'x']), /unknown flag/);
  assert.throws(() => genericJobArgs([sha, '--timeout', 'forever', '--', 'x']), /--timeout/);
  assert.throws(() => genericJobArgs([sha, '--max-wait-s', '99999', '--', 'x']), /max-wait-s/);
});

// The CLI end to end against a stub hf: `jobs ps --format json` lists STUB_PS, `jobs run` prints a job id.
const cli = (argv: string[], ps: unknown[], env: Record<string, string> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'hf-slots-cli-'));
  try {
    const hf = join(dir, 'hf');
    writeFileSync(hf, `#!/bin/sh\nif [ "$2" = ps ]; then cat ${JSON.stringify(join(dir, 'ps.json'))}; exit 0; fi\nif [ "$2" = run ]; then echo "$@" > ${JSON.stringify(join(dir, 'run.txt'))}; echo "Job started with ID: ${'b'.repeat(24)}"; exit 0; fi\nexit 1\n`); chmodSync(hf, 0o755);
    writeFileSync(join(dir, 'ps.json'), JSON.stringify(ps));
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/vps-shadow/launch.mjs'), ...argv], { cwd: dir, encoding: 'utf8', timeout: 30_000, env: { ...process.env, HF_BIN: hf, HF_SLOT_LOCK: join(dir, 'lock'), ...env } });
    return { code: r.status, out: r.stdout, err: r.stderr, ran: existsSync(join(dir, 'run.txt')), ledger: existsSync(join(dir, 'artifacts/hf-lane-jobs')) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('CLI: a lane job prints the tier line and the job id and goes in the lane ledger; a full CPU pool gives exit 75 for a lane and a slot for the unit job', () => {
  const ok = cli(['job', sha, '--lane', 'web', '--', 'echo', 'hi'], live('cpu-upgrade', 1));
  assert.equal(ok.code, 0, ok.err); assert.match(ok.out, /^tier=hf-cpu slot=2 queued=0s\nJob started with ID: b{24}/); assert.ok(ok.ledger, 'lane ledger, not the release ledger');
  const full = cli(['job', sha, '--max-wait-s', '0', '--', 'echo', 'hi'], live('cpu-upgrade', 3));
  assert.equal(full.code, 75, full.err); assert.match(full.err, /no cpu-upgrade slot \(3 of 3 in use\)/); assert.equal(full.ran, false);
  const unit = cli(['unit', sha], live('cpu-upgrade', 3), { LAUNCH_UNIT_ANY: '1' });
  assert.equal(unit.code, 0, unit.err); assert.match(unit.out, /^tier=hf-cpu slot=4 queued=0s/);
  const gfx = cli(['job', sha, '--gfx', '--', 'node', 'still.mjs'], [...live('cpu-upgrade', 4), ...live('t4-medium', 2)]);
  assert.equal(gfx.code, 0, gfx.err); assert.match(gfx.out, /^tier=hf-t4 slot=3 queued=0s/);
});

test('across hosts: a launcher whose job ranks beyond its limit after the launch cancels it and queues again (the youngest excess job backs off)', () => {
  const at = (n: number) => `2026-10-10T05:00:0${n}Z`;
  const job = (id: string, n: number) => ({ id, created_at: at(n), flavor: 'cpu-upgrade', status: { stage: 'RUNNING' } });
  assert.equal(rankOf('cpu-upgrade', [job('b', 2), job('a', 1), job('c', 3)], 'c'), 3);
  assert.equal(rankOf('cpu-upgrade', [job('a', 1)], 'zzz'), 0, 'not listed yet: rank 0');
  // two lane jobs already live; ours (id "mine", the 3rd) is fine, but another host raced us and got in first -> ours is 4th beyond the generic limit of 3
  let t = 0; const cancelled: string[] = []; let call = 0;
  const ps = () => {
    call++;
    if (call === 1) return [job('x', 1), job('y', 2)];                                  // before: 2 live, a slot looks free
    if (call === 2) return [job('x', 1), job('y', 2), job('other', 3), job('mine', 4)];   // after launch: the other host's job ranks 3rd, ours 4th > 3
    return [job('x', 1), job('y', 2), job('other', 3)];                                 // retry: no slot
  };
  const r = withSlot({ flavor: 'cpu-upgrade', generic: true, maxWaitS: 20, pollS: 15, launch: () => 'mine', ps, idOf: (v: unknown) => v as string, cancel: (id: string) => { cancelled.push(id); }, now: () => t, sleep: ms => { t += ms; } });
  assert.deepEqual(cancelled, ['mine']); assert.equal(r.ok, false);
  // and when we rank within the limit nothing is cancelled
  t = 0; const kept: string[] = []; let n = 0;
  const ok = withSlot({ flavor: 'cpu-upgrade', generic: true, launch: () => 'mine', ps: () => (++n === 1 ? [job('x', 1)] : [job('x', 1), job('mine', 2)]), idOf: (v: unknown) => v as string, cancel: (id: string) => { kept.push(id); }, now: () => t, sleep: ms => { t += ms; } });
  assert.deepEqual([ok.ok, ok.ok && ok.slot, kept.length], [true, 2, 0]);
});

test('launch.mjs job --env K=V is repeatable, reaches the job as -e K=V, and refuses reserved or secret-looking keys', () => {
  const j = genericJobArgs([sha, '--env', 'FOO=1', '--env', 'BAR=two words', '--', 'x']);
  assert.ok(j.args.join('\u0000').includes('-e\u0000FOO=1\u0000-e\u0000BAR=two words'));
  assert.throws(() => genericJobArgs([sha, '--env', 'foo=1', '--', 'x']), /upper-case key/);
  assert.throws(() => genericJobArgs([sha, '--env', 'HF_TOKEN=abc', '--', 'x']), /reserved or looks like a secret/);
  assert.throws(() => genericJobArgs([sha, '--env', 'SHA=x', '--', 'x']), /reserved/);
});

test('the parent of a `rows` child outlives the child\'s whole budget (slot wait + hf call + rank check + cancel), and a stale lock is only broken after a live holder could not still hold it', async () => {
  assert.ok(ROWS_CHILD_TIMEOUT_MS >= (RELEASE_SLOT_WAIT_S + 4 * 60) * 1000, `${ROWS_CHILD_TIMEOUT_MS} ms must cover ${RELEASE_SLOT_WAIT_S} s of waiting plus a lock wait, the hf call, the rank check and the cancel (60 s each)`);
  const src = (await import('node:fs')).readFileSync('scripts/vps-shadow/launch.mjs', 'utf8');
  assert.match(src, /timeout: ROWS_CHILD_TIMEOUT_MS/, 'the cpu launcher spawns the rows child with that timeout');
  assert.doesNotMatch(src, /timeout: 90_000/);
  assert.ok(STALE_MS >= 300_000 && STALE_MS > 2 * 60_000, 'longer than a live holder (one hf call + a rank check) can hold the lock');
  const slots = (await import('node:fs')).readFileSync('scripts/lib/hf-slots.mjs', 'utf8');
  assert.match(slots, /renameSync\(LOCK, dead\)/, 'a stale lock is broken by rename, not stat-then-rm');
});
