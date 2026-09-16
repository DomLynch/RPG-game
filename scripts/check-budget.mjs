import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
async function size(path) {
  let raw = 0, gzip = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory()) { const child = await size(`${path}/${entry.name}`); raw += child.raw; gzip += child.gzip; }
    else { const bytes = await readFile(`${path}/${entry.name}`); raw += bytes.length; gzip += gzipSync(bytes).length; }
  }
  return { raw, gzip };
}
const bytes = await size('dist');
if (bytes.gzip >= 12_000_000) throw new Error(`Shell exceeds 12 MB: ${bytes.gzip}`); // 5 → 12 MB gzip on the owner's instruction (2026-09-16): two full fighters ship; the phone frame-time gate stays the real limit
console.log(`All fight-ready assets: ${bytes.raw} bytes raw; ${bytes.gzip} bytes gzip. Budget PASS.`);
