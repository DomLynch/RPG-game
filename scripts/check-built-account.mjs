// Production deploys must ship accounts: the built bundle carries the Supabase project origin and the auth storageKey.
// check-account-config.mjs only reads the env and passes a guest-only build; from a53762e to 9394e8a4 (2026-09-23/24)
// every deploy shipped guest-only because the deploy checkout's .env.production.local had lost its VITE_SUPABASE_* lines.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = join(process.argv[2] ?? 'dist', 'assets');
const js = readdirSync(dir).filter((file) => file.endsWith('.js')).map((file) => readFileSync(join(dir, file), 'utf8')).join('\n');
const missing = [
  [/https:\/\/[a-z0-9-]+\.supabase\.co/, 'the Supabase project origin'],
  [/["']frankendom\.auth\.v1["']/, "the auth storageKey 'frankendom.auth.v1'"],
].filter(([pattern]) => !pattern.test(js)).map(([, what]) => what);
if (missing.length) throw Error(`Guest-only build: the bundle in ${dir} lacks ${missing.join(' and ')}. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.production.local before a production deploy.`);
console.log('Built bundle carries the Supabase origin and the auth storageKey.');
