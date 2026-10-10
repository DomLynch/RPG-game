// ops/prune-origins-installs.sh: keep current, the rollback target and the newest others in /opt/frankendom-origins/<8 hex>; --dry-run removes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, utimesSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'ops', 'prune-origins-installs.sh');
const name = (i: number) => i.toString(16).padStart(8, '0');

// 12 installs, i one minute newer than i-1; current -> 12.
function fixture() {
  const opt = mkdtempSync(join(tmpdir(), 'prune-origins-'));
  const t0 = Date.now() / 1000 - 3600;
  for (let i = 1; i <= 12; i++) { const d = join(opt, name(i)); mkdirSync(d); writeFileSync(join(d, 'f'), String(i)); utimesSync(d, t0 + i * 60, t0 + i * 60); }
  mkdirSync(join(opt, 'keep-me'));
  symlinkSync(join(opt, name(12)), join(opt, 'current'));
  return opt;
}
const run = (opt: string, ...args: string[]) => spawnSync('bash', [script, opt, ...args], { encoding: 'utf8' });
const left = (opt: string) => readdirSync(opt).sort();

test('keeps current, the rollback target far back and the 3 newest others; leaves other names alone', () => {
  const opt = fixture();
  const r = run(opt, '3', name(2));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(left(opt), [name(2), name(9), name(10), name(11), name(12), 'current', 'keep-me'].sort());
  rmSync(opt, { recursive: true });
});

test('--dry-run lists the drops and removes nothing', () => {
  const opt = fixture(), before = left(opt);
  const r = run(opt, '3', '--dry-run');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /would remove/);
  assert.deepEqual(left(opt), before);
  rmSync(opt, { recursive: true });
});

test('a current that does not resolve into the directory prunes nothing', () => {
  const opt = fixture(); rmSync(join(opt, 'current'));
  const r = run(opt, '3');
  assert.equal(r.status, 3);
  assert.equal(left(opt).length, 13);
  rmSync(opt, { recursive: true });
});
