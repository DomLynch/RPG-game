#!/usr/bin/env node
// Hero Look optional texture step (docs/state/herolook.md): Pixelmator Pro, headless over AppleScript. Folder in -> folder out, per map:
// open -> resize to --size with ML Super Resolution (only where the map is smaller) -> optional colour-adjustment preset saved in
// Pixelmator under --preset (e.g. a steel-to-gold eagle retint) -> export PNG -> close without saving. A heavy Mac job: the deploy guard
// refuses `node scripts/pixelmator-*.mjs` under a deploy lock. The first run asks macOS for Automation permission (only Dom can click it).
//   node scripts/pixelmator-maps.mjs --in <dir> --out <dir> [--size 4096] [--preset "<name>"]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, parse } from 'node:path';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const IN = resolve(arg('--in')), OUT = resolve(arg('--out')), SIZE = Number(arg('--size', 4096)), PRESET = arg('--preset', '');
const SCRIPT = `on run argv
  set src to POSIX file (item 1 of argv)
  set dst to POSIX file (item 2 of argv)
  set target to (item 3 of argv) as integer
  set preset to item 4 of argv
  tell application "Pixelmator Pro"
    set d to open src
    set w to width of d
    if w < target then resize image d width target height target algorithm ml super resolution
    if preset is not "" then apply color adjustments preset (first layer of d) name preset
    export d to dst as PNG
    close d saving no
    return w
  end tell
end run`;
mkdirSync(OUT, { recursive: true });
const receipt = [];
for (const f of readdirSync(IN).filter((n) => /\.(png|jpe?g|webp)$/i.test(n)).sort()) {
  const t0 = Date.now(), dst = join(OUT, parse(f).name + '.png');
  const was = execFileSync('osascript', ['-', join(IN, f), dst, String(SIZE), PRESET], { input: SCRIPT, encoding: 'utf8' }).trim();
  const row = { map: f, from: Number(was), to: SIZE, preset: PRESET || null, seconds: +((Date.now() - t0) / 1000).toFixed(1), out: dst };
  receipt.push(row); console.log(JSON.stringify(row));
}
writeFileSync(join(OUT, 'pixelmator-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
