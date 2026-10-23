// The bow sandbox page as its own small build (Lead 2026-10-15; the look-test path): `npx vite build --config vite.bow-preview.config.mjs` writes artifacts/bow-preview/ with base /preview/bows/.
// Nothing here touches the game's build or the Pit; Deploy copies the folder to current/preview/bows/ (scripts/publish-bow-preview.sh).
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.mjs';

export default defineConfig(mergeConfig(base, { base: '/preview/bows/', build: { outDir: 'artifacts/bow-preview', emptyOutDir: true, rollupOptions: { input: 'bow-preview.html' } } }));
