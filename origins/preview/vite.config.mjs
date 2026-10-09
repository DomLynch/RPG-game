import { defineConfig } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, URL, URLSearchParams } from 'node:url';
import { basename } from 'node:path';
import { optimizeGlb } from '../../scripts/optimize-glb.mjs';
import { liveKit } from './live-kit.mjs';
import { ZONES_DIR, registrySource } from '../../scripts/gen-zones.mjs';
import { writeFile } from 'node:fs/promises';

// Origins look prototype (Expansion lane, 2026-10-06): its own page, its own build, never part of the game's build.
// npx vite build --config origins/preview/vite.config.mjs  → artifacts/origins-preview/, served at /preview/origins/.
const repo = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: repo,   // the repo root's .env* (VITE_SUPABASE_*): root is origins/preview, so without this Zone 1's session renewal is a silent no-op (Auditor, #1864)
  base: '/preview/origins/',
  publicDir: false,   // the game's public/ is 500 MB; the Pit needs only public/arena/ (abyss photograph and painted backdrops, ~160 KB), emitted below
  server: { fs: { allow: [repo] } },
  build: { outDir: `${repo}artifacts/origins-preview`, emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  plugins: [{
    name: 'zone-registry',   // a build never ships a stale registry: the zone folders are the source
    async buildStart() { await writeFile(`${ZONES_DIR}registry.ts`, registrySource()); },
  }, {
    name: 'live-fight-kit',
    async transformIndexHtml(html) { return liveKit(await readFile(`${repo}index.html`, 'utf8'), html); },
  }, {
    // The hero and props shrink the way the game's build shrinks them (meshopt, textures inline): warrior.glb 6.7 MB raw.
    name: 'optimized-glb', apply: 'build', enforce: 'pre',
    async load(id) {
      const [path, query] = id.split('?');
      if (!path.endsWith('.glb') || !new URLSearchParams(query).has('url')) return null;
      const ref = this.emitFile({ type: 'asset', name: basename(path), source: await optimizeGlb(await readFile(path)) });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  }, {
    name: 'pit-arena-public', apply: 'build',
    async generateBundle() {
      for (const name of await readdir(`${repo}public/arena`)) this.emitFile({ type: 'asset', fileName: `arena/${name}`, source: await readFile(`${repo}public/arena/${name}`) });
    },
  }],
});
