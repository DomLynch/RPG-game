import { defineConfig } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { optimizeGlb } from './scripts/optimize-glb.mjs';

const counts = new Map();
const GATE_LIGHT_TAG = '<script src="/src/gate-light-boot.js"></script>';
let gateLight;
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
  }, {
    // The gate's light boot script (src/gate-light-boot.js): a classic head script, which Vite does not bundle. The build ships it under
    // /assets/ with its content hash in the name (the server's one-year cache there, a new name whenever the bytes change) and points
    // index.html at it, so the fresh page behind the Pit's gate has it without a round trip (Lead 2026-09-30).
    name: 'gate-light-boot', apply: 'build',
    transformIndexHtml: { order: 'pre', handler(html) {
      const source = readFileSync(new URL('./src/gate-light-boot.js', import.meta.url)), fileName = `assets/gate-light-${hash(source).slice(0, 8)}.js`;
      if (!html.includes(GATE_LIGHT_TAG)) throw new Error(`index.html lost ${GATE_LIGHT_TAG}`);
      gateLight = { fileName, source };
      return html.replace(GATE_LIGHT_TAG, `<script src="/${fileName}"></script>`);
    } },
    generateBundle() { if (gateLight) this.emitFile({ type: 'asset', fileName: gateLight.fileName, source: gateLight.source }); },
  }],
});
