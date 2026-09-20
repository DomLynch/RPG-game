import { defineConfig } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { optimizeGlb } from './scripts/optimize-glb.mjs';

const counts = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const csp = readFileSync(new URL('./deploy/frankendom.com.conf', import.meta.url), 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
export default defineConfig({
  preview: { headers: { 'Content-Security-Policy': csp } },
  plugins: [{
    name: 'lossless-fighter-assets', apply: 'build', enforce: 'pre',
    async buildStart() {
      counts.clear();
      // Count actual retained/packed images; shared textures become one cacheable file.
      for (const name of (await readdir('src/assets')).filter(n => n.endsWith('.glb'))) {
        const seen = new Set();
        await optimizeGlb(await readFile(`src/assets/${name}`), (bytes) => { seen.add(hash(bytes)); });
        for (const key of seen) counts.set(key, (counts.get(key) || 0) + 1);
      }
    },
    async load(id) {
      const [path, query] = id.split('?');
      if (!path.endsWith('.glb') || !new URLSearchParams(query).has('url')) return null;
      const source = await optimizeGlb(await readFile(path), (bytes, mime) => {
        const key = hash(bytes);
        if (counts.get(key) < 2) return undefined;
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
        if (!ext) return undefined;
        const uri = `textures/${key}.${ext}`;
        this.emitFile({ type: 'asset', fileName: `assets/${uri}`, source: bytes });
        return uri;
      });
      const ref = this.emitFile({ type: 'asset', name: basename(path), source });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  }],
});
