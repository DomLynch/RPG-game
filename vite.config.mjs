import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { optimizeGlb } from './scripts/optimize-glb.mjs';

const csp = readFileSync(new URL('./deploy/frankendom.com.conf', import.meta.url), 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
export default defineConfig({
  preview: { headers: { 'Content-Security-Policy': csp } },
  plugins: [{
    name: 'lossless-fighter-assets', apply: 'build', enforce: 'pre',
    async load(id) {
      const [path, query] = id.split('?');
      if (!path.endsWith('.glb') || !new URLSearchParams(query).has('url')) return null;
      const source = await optimizeGlb(await readFile(path));
      const ref = this.emitFile({ type: 'asset', name: basename(path), source });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  }],
});
