import { defineConfig } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Origins look prototype (Expansion lane, 2026-10-06): its own page, its own build, never part of the game's build.
// npx vite build --config origins/preview/vite.config.mjs  → artifacts/origins-preview/, served at /preview/origins/.
const repo = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/preview/origins/',
  publicDir: false,   // the game's public/ is 500 MB; the Pit needs only public/arena/ (abyss photograph and painted backdrops, ~160 KB), emitted below
  server: { fs: { allow: [repo] } },
  build: { outDir: `${repo}artifacts/origins-preview`, emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  plugins: [{
    name: 'pit-arena-public', apply: 'build',
    async generateBundle() {
      for (const name of await readdir(`${repo}public/arena`)) this.emitFile({ type: 'asset', fileName: `arena/${name}`, source: await readFile(`${repo}public/arena/${name}`) });
    },
  }],
});
