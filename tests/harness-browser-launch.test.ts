// Ratchet: every script starts its browser through scripts/lib/harness-browser-launch.mjs (Lead 2026-10-21). On the shared VPS that helper runs Chromium in a low-weight
// systemd scope under nice, with software GL; a script that calls <type>.launch( itself skips all of it and was how four raised-priority Chromiums ran in one day.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { launchBrowser, onVps, processTree, reniceArgs, threadIds, vpsOptions, wrapperText } from '../scripts/lib/harness-browser-launch.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
// The helper itself, and the two job scripts that run INSIDE Hugging Face jobs as node snippets (HF behaviour stays unchanged, not the VPS).
const EXEMPT = new Set(['scripts/lib/harness-browser-launch.mjs', 'scripts/gpu-run/job-tail.sh', 'scripts/hf-wall-rows/job.sh', 'tests/harness-browser-launch.test.ts',
  'scripts/family-turntable.mjs', 'scripts/mob-lineup.mjs']);   // the last two: dead files that #3536 deletes; left untouched here so the two PRs do not conflict (drop these entries when #3536 has landed)
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
  assert.deepEqual(offenders, [], `use launchBrowser(chromium, options) from scripts/lib/harness-browser-launch.mjs instead of calling .launch( directly: ${offenders.join(', ')}`);
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
  const text = wrapperText('/opt/pw/headless_shell', '/tmp/x.pid');
  assert.match(text, /^echo \$\$ > "\/tmp\/x\.pid"$/m);   // the exec keeps the pid, so this is the browser's pid
  assert.match(text, /^exec nice -n 10 systemd-run --scope --quiet --collect -p CPUWeight=20 -- "\/opt\/pw\/headless_shell" "\$@"$/m);   // Nice= is rejected for a scope, so nice wraps systemd-run
  assert.doesNotMatch(text, /Nice=/);
  assert.match(text, /^unset DBUS_SESSION_BUS_ADDRESS XDG_RUNTIME_DIR XDG_SESSION_ID$/m);   // without a session bus Chromium cannot hop into its own scope and shed the CPUWeight
  assert.deepEqual(reniceArgs([11, 12]), ['-n', '10', '-p', '11', '12']);
});

test('threadIds walks a process and its descendants, every thread', () => {
  const root = mkdtempSync(join(tmpdir(), 'proc-'));
  const proc = (pid: number, ppid: number, tasks: number[]) => {
    mkdirSync(join(root, String(pid), 'task'), { recursive: true });
    writeFileSync(join(root, String(pid), 'stat'), `${pid} (chrome) S ${ppid} 1 1 0`);
    for (const t of tasks) mkdirSync(join(root, String(pid), 'task', String(t)));
  };
  proc(100, 1, [100, 101]); proc(200, 100, [200, 201, 202]); proc(300, 200, [300]); proc(400, 1, [400]);   // 400 is not a descendant
  assert.deepEqual(threadIds(100, root).sort((a: number, b: number) => a - b), [100, 101, 200, 201, 202, 300]);
});

// VPS only (skipped on the Mac, CI and HF): a real Chromium through the helper, with a page up so renderer and GPU processes exist. EVERY process in the browser's tree must sit
// in the helper's run-*.scope with CPUWeight=20 and none in a Chromium-made app-org scope (Strategy 2026-10-21: one chrome of a row escaped the cap when the bus was reachable).
test('VPS: every Chromium process of a helper launch is inside the CPUWeight=20 scope', { skip: !onVps() }, async () => {
  const { chromium } = await import('playwright');
  const browser = await launchBrowser(chromium, { headless: true });
  try {
    const page = await browser.newPage(); await page.goto('data:text/html,<canvas></canvas>');
    await new Promise((r) => setTimeout(r, 6500));   // one renice tick
    const pid = (browser as unknown as { vpsPid: number }).vpsPid;
    assert.ok(pid > 0, 'the wrapper wrote the browser pid');
    const pids = processTree(pid), seen = new Set<string>();
    assert.ok(pids.length >= 3, `a browser plus its helpers (${pids.length})`);
    for (const p of pids) {
      let cg = ''; try { cg = readFileSync(`/proc/${p}/cgroup`, 'utf8').trim(); } catch { continue; }   // a short-lived helper may be gone
      assert.match(cg, /\/system\.slice\/run-r?[0-9a-f]+\.scope$/, `pid ${p} is in a run scope, not ${cg}`);
      assert.doesNotMatch(cg, /app-org\.chromium/, `pid ${p} escaped into a Chromium scope`);
      seen.add(cg.split('/').pop()!);
    }
    assert.equal(seen.size, 1, `one scope for the whole tree: ${[...seen]}`);
    const weight = execFileSync('systemctl', ['show', '-p', 'CPUWeight', [...seen][0]!], { encoding: 'utf8', timeout: 10_000 }).trim();
    assert.equal(weight, 'CPUWeight=20');
  } finally { await browser.close(); }
});

test('off the VPS launchBrowser is exactly type.launch(options)', async () => {
  const calls: unknown[] = [], fakeBrowser = { on: () => {} };
  const fake = { name: () => 'chromium', launch: async (o: unknown) => { calls.push(o); return fakeBrowser; }, executablePath: () => '/x' };
  const opts = { headless: true, args: ['--a'] };
  assert.equal(await launchBrowser(fake, opts), fakeBrowser);   // off the VPS (the Mac, CI, HF) the options pass untouched; on the VPS they are wrapped, so only the browser is compared there
  if (!onVps()) assert.deepEqual(calls, [opts]);
});
