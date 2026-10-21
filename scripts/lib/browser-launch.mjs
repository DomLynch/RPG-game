// The one way a script starts a browser (Lead 2026-10-21: the fourth raised-priority Chromium on the shared VPS in a day, lane memory was not holding it).
//   import { launchBrowser } from './lib/browser-launch.mjs';   const browser = await launchBrowser(chromium, { headless: true, ... });
// Everywhere except the VPS this is exactly `type.launch(options)`: Mac, Hugging Face and CI behave as before. On the VPS (hostname in browser-launch.json) a Chromium
// gets software GL args unless the script already chose its GL, and starts inside `systemd-run --scope -p CPUWeight=20` under `nice -n 10`, so it can never
// out-rank a deploy or another lane. (Nice= is not a scope property; the wrapper runs `nice` inside the scope.) tests/browser-launch.test.ts fails on any
// script that calls <type>.launch( directly.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rows = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./browser-launch.json', import.meta.url)), 'utf8'));

export const onVps = (hostname = os.hostname()) => rows.vpsHostnames.includes(hostname);

/** Pure: the launch options a VPS Chromium gets (software GL args unless the script chose its GL, executablePath = the wrapper). */
export function vpsOptions(options, wrapperPath, row = rows) {
  const args = [...(options.args || [])];
  if (!args.some((a) => row.gpuArgPrefixes.some((p) => String(a).startsWith(p)))) args.push(...row.softwareGlArgs);
  return { ...options, args, executablePath: wrapperPath };
}

/** Pure: the wrapper script text: the real browser, in a low-weight scope, niced. */
export function wrapperText(realPath, pidFile, row = rows) {   // the wrapper execs, so its pid IS the browser's: Playwright no longer has browser.process(), the pid file is how the renice finds it
  const props = row.scopeProperties.map((p) => `-p ${p}`).join(' ');
  return `#!/bin/sh\necho $$ > "${pidFile}"\nexec nice -n ${row.niceLevel} systemd-run --scope --quiet --collect ${props} -- "${realPath}" "$@"\n`;
}

/** Pure: the renice call for a set of thread ids (root Chromium boosts its main and GPU processes to -8 on its own, so the scope's CPUWeight is the real cap and this is belt and braces). */
export const reniceArgs = (tids, level = rows.niceLevel) => ['-n', String(level), '-p', ...tids.map(String)];

/** Every thread id of a process and its descendants, from /proc. */
export function threadIds(rootPid, procRoot = '/proc') {
  const kids = new Map(), all = [];
  for (const name of fs.readdirSync(procRoot)) {
    if (!/^\d+$/.test(name)) continue;
    try { const ppid = Number(fs.readFileSync(`${procRoot}/${name}/stat`, 'utf8').split(') ')[1].split(' ')[1]); (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(Number(name)); } catch { /* the process ended */ }
  }
  const walk = (pid) => { all.push(pid); for (const k of kids.get(pid) ?? []) walk(k); };
  walk(rootPid);
  const tids = [];
  for (const pid of all) { try { for (const t of fs.readdirSync(`${procRoot}/${pid}/task`)) tids.push(Number(t)); } catch { /* ended */ } }
  return tids;
}

const reniceTree = (pid) => {
  const tids = threadIds(pid);
  if (tids.length) spawnSync('renice', reniceArgs(tids), { stdio: 'ignore', timeout: 10_000 });   // bounded like every sync child (tests/child-process-bounds.test.ts)
};

const headlessShell = () => {   // Playwright's headless shell is what a launch without executablePath runs; keep running it (same rendering as before) inside the scope
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? process.env.PLAYWRIGHT_BROWSERS_PATH : path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) for (const sub of fs.readdirSync(path.join(base, d))) {
      const candidate = path.join(base, d, sub, 'headless_shell');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* no headless shell here: the full browser below */ }
  return null;
};

export async function launchBrowser(type, options = {}) {
  const isChromium = typeof type.name === 'function' ? type.name() === 'chromium' : false;
  if (!isChromium || !onVps()) return type.launch(options);
  const real = options.executablePath || ((options.headless === false ? null : headlessShell()) ?? type.executablePath());
  const stem = path.join(os.tmpdir(), `scope-chromium-${crypto.randomUUID().slice(0, 12)}`), wrapper = `${stem}.sh`, pidFile = `${stem}.pid`;
  fs.writeFileSync(wrapper, wrapperText(real, pidFile), { mode: 0o755 });
  const browser = await type.launch(vpsOptions(options, wrapper));
  let pid = 0; try { pid = Number(fs.readFileSync(pidFile, 'utf8').trim()) || 0; } catch { /* no pid file: the scope's CPUWeight still holds */ }
  browser.vpsPid = pid;
  if (pid) {   // the processes Chromium adds later (renderers, GPU) are reniced on a short timer until the browser goes
    reniceTree(pid);
    const timer = setInterval(() => reniceTree(pid), 5000); timer.unref();
    browser.on?.('disconnected', () => { clearInterval(timer); for (const f of [wrapper, pidFile]) { try { fs.unlinkSync(f); } catch { /* gone */ } } });
  }
  return browser;
}
