// Combat Sandbox build: the game's own config, with index.html's game entry swapped for sandbox/entry.ts (which patches rows, then boots
// src/main.ts). Build: npx vite build --config sandbox/vite.config.mjs --base /preview/sandbox/ --outDir dist-sandbox
import { mergeConfig } from 'vite';
import base from '../vite.config.mjs';

export default mergeConfig(base, {
  plugins: [{
    name: 'sandbox-entry',
    transformIndexHtml: {
      order: 'pre',   // before Vite resolves the script tags, so the bundle is built from sandbox/entry.ts
      handler: (html) => {
        if (!html.includes('src="/src/main.ts"')) throw Error('sandbox: index.html no longer loads /src/main.ts');
        return html.replace('src="/src/main.ts"', 'src="/sandbox/entry.ts"').replace(/<title>[^<]*/, '<title>Frankendom Sandbox');
      },
    },
  }],
});
