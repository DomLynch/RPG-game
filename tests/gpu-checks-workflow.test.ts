import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// No YAML parser in the repo: the shape the Auditor and Lead ruled on (2026-10-10) is pinned by reading the text.
const yml = readFileSync('.github/workflows/gpu-checks.yml', 'utf8');
const code = yml.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');   // the header comment names what is forbidden
const job = (name: string) => { const at = yml.search(new RegExp(`^ {2}${name}:$`, 'm')); assert.ok(at >= 0, `job ${name}`); const rest = yml.slice(at + 1); const next = rest.search(/\n {2}[a-z]+:\n/); return next < 0 ? rest : rest.slice(0, next); };

test('with no HF_TOKEN the gpu job is SKIPPED, never green: a token job outputs has=yes|no and gpu needs it', () => {
  const token = job('token'), gpu = job('gpu');
  assert.match(token, /outputs:\n\s+has: \$\{\{ steps\.probe\.outputs\.has \}\}/);
  assert.ok(token.includes('has=yes') && token.includes('has=no') && token.includes('GPU checks NOT RUN'));
  assert.match(gpu, /needs: token/);
  assert.match(gpu, /if: needs\.token\.outputs\.has == 'yes' && /);
  assert.match(gpu, /\[ -n "\$HF_TOKEN" \] \|\| \{[^}]*exit 1; \}/, 'an empty token inside gpu fails, it does not pass');
  assert.match(yml.split('\nname:')[0], /A SKIPPED `gpu` IS NOT A GPU CHECK/);
});

test('the token reaches only the probe step and the one gpu-run step, never a job-level env, checkout, setup-node or pip', () => {
  for (const name of ['token', 'gpu']) assert.doesNotMatch(job(name), /^ {4}env:\n(\s{6}.*\n)*?\s{6}HF_TOKEN:/m, `${name}: no job-level HF_TOKEN`);
  const uses = [...yml.matchAll(/HF_TOKEN: \$\{\{ secrets\.HF_TOKEN \}\}/g)];
  assert.equal(uses.length, 2, 'the probe step and the gpu-run step');
  for (const m of uses) assert.match(yml.slice(0, m.index).split('\n').slice(-1)[0], /^ {10}$/, 'HF_TOKEN sits in a step-level env (ten spaces)');
});

test('same-repo non-draft only, pull_request not pull_request_target, read-only, and no dispatch ref that could name a fork commit', () => {
  assert.match(job('gpu'), /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(job('gpu'), /github\.event\.pull_request\.draft == false/);
  assert.doesNotMatch(code, /pull_request_target/);
  assert.match(yml, /^permissions:\n {2}contents: read$/m);
  assert.doesNotMatch(code, /inputs\.ref|inputs:/);
});
