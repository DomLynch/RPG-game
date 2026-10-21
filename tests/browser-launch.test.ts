// Ratchet: every script starts its browser through scripts/lib/browser-launch.mjs (Lead 2026-10-21). On the shared VPS that helper runs Chromium in a low-weight
// systemd scope under nice, with software GL; a script that calls <type>.launch( itself skips all of it and was how four raised-priority Chromiums ran in one day.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
// @ts-expect-error: a .mjs tool module without types
import { launchBrowser, onVps, vpsOptions, wrapperText } from '../scripts/lib/browser-launch.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
// The helper itself, and the two job scripts that run INSIDE Hugging Face jobs as node snippets (HF behaviour stays unchanged, not the VPS).
const EXEMPT = new Set(['scripts/lib/browser-launch.mjs', 'scripts/gpu-run/job-tail.sh', 'scripts/hf-wall-rows/job.sh', 'tests/browser-launch.test.ts']);
const DIRECT = /\b(?:playwright\.)?(?:chromium|webkit|firefox|engine|type|browserType)\.launch\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name), info = statSync(path);
    if (info.isDirectory()) walk(path, out); else if (/\.(mjs|js|cjs|ts|sh)$/.test(name)) out.push(path);
  }
  return out;
}

test('no script calls a Playwright browserType.launch( directly', () => {
  const offenders: string[] = [];
  for (const dir of ['scripts', 'tests', 'origins', 'ops', 'sandbox']) {
    let files: string[] = [];
    try { files = walk(join(ROOT, dir)); } catch { continue; }
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (EXEMPT.has(rel) || /(^|\/)_[^/]*-tmp\./.test(rel)) continue;   // scratch scripts named _*-tmp.* are untracked working files
      if (DIRECT.test(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `use launchBrowser(chromium, options) from scripts/lib/browser-launch.mjs instead of calling .launch( directly: ${offenders.join(', ')}`);
});

test('the VPS gets a low-weight, niced scope and software GL; its own GL choice is kept', () => {
  assert.equal(onVps('Brain'), true);
  assert.equal(onVps('Dom-MacBook-Air.local'), false);
  const wrapper = '/tmp/scope-chromium-x.sh';
  const plain = vpsOptions({ headless: true }, wrapper);
  assert.equal(plain.executablePath, wrapper);
  assert.ok(plain.args.includes('--use-angle=swiftshader') && plain.args.includes('--enable-unsafe-swiftshader'));
  const chosen = vpsOptions({ args: ['--use-angle=gl-egl', '--foo'] }, wrapper);
  assert.deepEqual(chosen.args, ['--use-angle=gl-egl', '--foo']);
  const text = wrapperText('/opt/pw/headless_shell');
  assert.match(text, /systemd-run --scope .*-p CPUWeight=20 -- nice -n 10 "\/opt\/pw\/headless_shell" "\$@"/);
});

test('off the VPS launchBrowser is exactly type.launch(options)', async () => {
  const calls: unknown[] = [];
  const fake = { name: () => 'chromium', launch: async (o: unknown) => { calls.push(o); return 'browser'; }, executablePath: () => '/x' };
  const opts = { headless: true, args: ['--a'] };
  assert.equal(await launchBrowser(fake, opts), 'browser');   // this host is not the VPS (test hosts are the Mac, CI or HF)
  if (!onVps()) assert.deepEqual(calls, [opts]);
});
