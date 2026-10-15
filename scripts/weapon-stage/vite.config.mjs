import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url)), repo = fileURLToPath(new URL('../../', import.meta.url));
export default { root: here, base: '/', build: { outDir: `${repo}artifacts/weapon-stage`, emptyOutDir: true, target: 'esnext' } };
