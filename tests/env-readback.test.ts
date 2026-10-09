// ops/env-readback.sh: an install receipt reads env keys back as presence + length + hash, never the value (2026-10-08: a hand-written redaction printed a key).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, '../ops/env-readback.sh');
const run = (...args: string[]) => spawnSync('bash', [script, ...args], { encoding: 'utf8' });

test('env-readback: a key-shaped value is never printed (named or listed), flags and ports are, and equal secrets show equal hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'env-readback-'));
  try {
    const key = randomBytes(32).toString('hex'), other = randomBytes(32).toString('hex');
    const a = join(dir, 'a.env'), b = join(dir, 'b.env');
    writeFileSync(a, `ORIGINS_WRITER_INTERNAL_KEY=${key}\nORIGINS_REWARDS=1\nPORT=8788\nSUPABASE_ANON_KEY=eyJ.${other}\nWORD=abc\n`);
    writeFileSync(b, `ORIGINS_WRITER_INTERNAL_KEY=${key}\n`);
    for (const out of [run(a, 'ORIGINS_WRITER_INTERNAL_KEY', 'ORIGINS_REWARDS', 'PORT', 'SUPABASE_ANON_KEY', 'MISSING'), run(a)]) {
      assert.equal(out.status, 0, out.stderr);
      for (const secret of [key, other, key.slice(0, 16), key.slice(-16), other.slice(0, 16)]) assert.ok(!out.stdout.includes(secret), 'no part of a secret is printed');
      assert.match(out.stdout, /^ORIGINS_WRITER_INTERNAL_KEY present=y len=64 sha8=[0-9a-f]{8}$/m);
      assert.match(out.stdout, /^ORIGINS_REWARDS present=y value=1$/m);
      assert.match(out.stdout, /^PORT present=y value=8788$/m);
      assert.doesNotMatch(out.stdout, /abc/, 'a word value is hashed too');
    }
    assert.match(run(a, 'MISSING').stdout, /^MISSING present=n$/m);
    const sha = (f: string) => /sha8=([0-9a-f]{8})/.exec(run(f, 'ORIGINS_WRITER_INTERNAL_KEY').stdout)?.[1];
    assert.ok(sha(a) && sha(a) === sha(b), 'the same secret in two files reads back the same hash');
    assert.notEqual(run(a, 'BAD NAME').status, 0, 'a key name with a space is refused');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
