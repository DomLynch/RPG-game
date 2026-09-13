import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist/**', 'node_modules/**', 'artifacts/**'] }, js.configs.recommended, ...tseslint.configs.recommended, { files: ['src/**/*.ts'], languageOptions: { globals: { document:'readonly',window:'readonly',navigator:'readonly',localStorage:'readonly',crypto:'readonly',performance:'readonly',requestAnimationFrame:'readonly',cancelAnimationFrame:'readonly',devicePixelRatio:'readonly',innerWidth:'readonly',innerHeight:'readonly',HTMLInputElement:'readonly' } } });
