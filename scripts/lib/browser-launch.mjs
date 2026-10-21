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
export function wrapperText(realPath, row = rows) {
  const props = row.scopeProperties.map((p) => `-p ${p}`).join(' ');
  return `#!/bin/sh\nexec systemd-run --scope --quiet --collect ${props} -- nice -n ${row.niceLevel} "${realPath}" "$@"\n`;
}

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

export function launchBrowser(type, options = {}) {
  const isChromium = typeof type.name === 'function' ? type.name() === 'chromium' : false;
  if (!isChromium || !onVps()) return type.launch(options);
  const real = options.executablePath || ((options.headless === false ? null : headlessShell()) ?? type.executablePath());
  const wrapper = path.join(os.tmpdir(), `scope-chromium-${crypto.createHash('sha1').update(real).digest('hex').slice(0, 10)}.sh`);
  fs.writeFileSync(wrapper, wrapperText(real), { mode: 0o755 });
  return type.launch(vpsOptions(options, wrapper));
}
