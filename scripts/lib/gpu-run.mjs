// The rules half of scripts/gpu-run.mjs (the I/O half): argument parsing, the renderer guard, the job script, the job-log parser. No I/O but reading the two job scripts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { T4_MEDIUM_USD_PER_HOUR } from './hf-wall-rows.mjs';

const dir = fileURLToPath(new URL('..', import.meta.url));
export const USAGE = 'usage: node scripts/gpu-run.mjs <sha> [--timeout 20m] [--blender] -- <cmd...>';
export const MAX_TIMEOUT_S = 3 * 3600;
const toSeconds = text => { const m = /^(\d+)([mh])$/.exec(text || ''); return m ? Number(m[1]) * (m[2] === 'h' ? 3600 : 60) : NaN; };

// `<sha> [--timeout 20m|2h] [--blender] -- <cmd...>`: everything after the first `--` is the command, untouched.
export function parseArgs(argv) {
  const split = argv.indexOf('--');
  if (split < 0) throw new Error(`no command after "--". ${USAGE}`);
  const head = argv.slice(0, split), cmd = argv.slice(split + 1);
  if (!cmd.length) throw new Error(`no command after "--". ${USAGE}`);
  const out = { sha: '', timeout: '20m', blender: false, cmd };
  for (let i = 0; i < head.length; i++) {
    const a = head[i];
    if (a === '--blender') out.blender = true;
    else if (a === '--timeout') out.timeout = head[++i] ?? '';
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}. ${USAGE}`);
    else if (!out.sha) out.sha = a;
    else throw new Error(`more than one revision (${out.sha}, ${a}). ${USAGE}`);
  }
  if (!out.sha) throw new Error(`no revision. ${USAGE}`);
  const seconds = toSeconds(out.timeout);
  if (!Number.isFinite(seconds) || seconds < 60 || seconds > MAX_TIMEOUT_S) throw new Error(`--timeout ${out.timeout}: use 1m..3h, like 20m or 2h`);
  return { ...out, timeoutS: seconds };
}

// The command as the job's shell sees it: every argument single-quoted, so "a b" stays one argument.
export const shellLine = cmd => cmd.map(a => `'${String(a).replace(/'/g, `'\\''`)}'`).join(' ');

// One renderer string from the probe ("shell=X | chrome=Y"): hardware only when BOTH binaries report an NVIDIA part and neither says software.
export const isHardware = renderer => {
  const one = r => /nvidia|tesla|geforce|rtx| t4|l4|a10/i.test(r) && !/swiftshader|llvmpipe|software|no webgl/i.test(r);
  const m = /^shell=(.*) \| chrome=(.*)$/.exec(String(renderer).trim());
  return m ? one(m[1]) && one(m[2]) : one(String(renderer));
};

// The job: job.sh's setup (the image, git clone at the sha, npm ci, the GPU-flag wrappers and the guard that exits 11 unless both binaries are NVIDIA, the build)
// up to the rows section, then ours.
const SEAM = 'say "ROWS';
export function jobScript({ readText = file => readFileSync(`${dir}${file}`, 'utf8') } = {}) {
  const wall = readText('hf-wall-rows/job.sh'), at = wall.indexOf(SEAM);
  if (at < 0) throw new Error(`scripts/hf-wall-rows/job.sh no longer has the ${SEAM} seam gpu-run splits at`);
  return `${wall.slice(0, at)}\n${readText('gpu-run/job-tail.sh')}`;
}

export const costOfSeconds = (seconds, rate = T4_MEDIUM_USD_PER_HOUR) => seconds / 3600 * rate;

// What the job printed: the build it ran, the renderer line, a blocker, the command's exit, the seconds, and the artifacts blob.
export function parseJobLog(text) {
  const lines = String(text).split('\n');
  const pick = re => { for (let i = lines.length - 1; i >= 0; i--) { const m = re.exec(lines[i]); if (m) return m; } return null; };
  const head = pick(/^=== HEAD (\w+) TREE (\w+) ===/), renderer = pick(/^=== RENDERER (.*) ===$/), blocker = pick(/^=== BLOCKER (.*) ===$/);
  const exit = pick(/^=== EXIT (\d+) ===$/), cost = pick(/^=== COST seconds=(\d+)/), blender = pick(/^=== BLENDER (.*) ===$/);
  const begin = lines.findIndex(l => /^=== ARTIFACTS BEGIN bytes=\d+ ===$/.test(l)), end = lines.findIndex((l, i) => i > begin && l === '=== ARTIFACTS END ===');
  const tooLarge = pick(/^=== ARTIFACTS TOO_LARGE bytes=(\d+) ===$/);
  return {
    sha: head?.[1] ?? null, tree: head?.[2] ?? null, renderer: renderer?.[1] ?? null, blocker: blocker?.[1] ?? null, blender: blender?.[1] ?? null,
    exit: exit ? Number(exit[1]) : null, seconds: cost ? Number(cost[1]) : null,
    artifactsB64: begin >= 0 && end > begin ? lines.slice(begin + 1, end).join('') : null, artifactsTooLarge: tooLarge ? Number(tooLarge[1]) : null,
  };
}
