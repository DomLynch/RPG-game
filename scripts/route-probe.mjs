// The work waterfall's one shared probe answer (Dom 2026-10-12, Mac first): where WOULD this job run? Asks the Mac wrapper, then the VPS, and prints
// one line from scripts/lib/waterfall.mjs routeProbe. Runs nothing, takes no slot, writes no log (both probes are read-only).
//   node scripts/route-probe.mjs [--gfx] -- CMD ARGS...   ->  would=<mac|vps|hf-cpu|hf-t4|refuse> reason=<why>     (always exit 0; 2 = usage)
// The Mac probe runs only on a Mac (darwin) with scripts/lanejob/lanejob-mac.sh present; --gfx asks it in its --gpu form. The VPS probe is the local
// /usr/local/bin/lanejob when this runs ON the box (as the lanes user), else over ssh as lanejob-mac.sh used to. A probe that fails or times out answers
// '' (no Mac tier / VPS unreadable), which routes on, never onto a box we could not read.
// Env (tests): ROUTE_MAC_PROBE / ROUTE_VPS_PROBE (an executable taking the probe args; "off" = that tier has no answer), ROUTE_SSH (the ssh prefix).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeProbe } from './lib/waterfall.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), gfx = args[0] === '--gfx', sep = args.indexOf('--'), cmd = sep >= 0 ? args.slice(sep + 1) : [];
if (!cmd.length) { console.error('usage: route-probe.mjs [--gfx] -- CMD ARGS...'); process.exit(2); }
const line = (bin, argv) => {
  const r = spawnSync(bin, argv, { encoding: 'utf8', timeout: 30_000 });
  return r.status === 0 ? (r.stdout || '').trim().split('\n')[0] || '' : '';
};
const quote = a => `'${a.replace(/'/g, `'\\''`)}'`;

const macBin = process.env.ROUTE_MAC_PROBE ?? (process.platform === 'darwin' && existsSync(join(root, 'scripts/lanejob/lanejob-mac.sh')) ? join(root, 'scripts/lanejob/lanejob-mac.sh') : 'off');
const mac = macBin === 'off' ? '' : line(macBin, ['--probe', ...(gfx ? ['--gpu', '--'] : []), ...cmd]);
let vps = '';
if (!gfx && !/^would=(mac|refuse)\b/.test(mac)) {   // the VPS is asked only when its answer can matter
  const vpsBin = process.env.ROUTE_VPS_PROBE ?? (existsSync('/usr/local/bin/lanejob') ? '/usr/local/bin/lanejob' : 'ssh');
  if (vpsBin === 'ssh') {
    const ssh = (process.env.ROUTE_SSH || `ssh -o BatchMode=yes -o ConnectTimeout=5 -i ${process.env.HOME}/.ssh/binance_futures_tool root@49.12.7.18`).split(' ');
    vps = line(ssh[0], [...ssh.slice(1), `sudo -u lanes -H /usr/local/bin/lanejob --probe ${cmd.map(quote).join(' ')}`]);
  } else if (vpsBin !== 'off') vps = line(vpsBin, ['--probe', ...cmd]);
}
const { target, reason } = routeProbe({ mac, vps, gfx });
console.log(`would=${target} reason=${reason}`);
