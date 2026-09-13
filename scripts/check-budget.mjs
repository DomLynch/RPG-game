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
if (bytes.gzip >= 5_000_000) throw new Error(`Shell exceeds 5 MB: ${bytes.gzip}`);
console.log(`All fight-ready assets: ${bytes.raw} bytes raw; ${bytes.gzip} bytes gzip. Budget PASS.`);
