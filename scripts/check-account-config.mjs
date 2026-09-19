import { loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
const env = { ...loadEnv('production', process.cwd()), ...process.env };
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url || key) {
  if (!url || !key) throw Error('Set both Supabase public settings or neither');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.origin !== url || !endpoint.hostname.endsWith('.supabase.co')) throw Error('Use the dedicated Supabase HTTPS project origin');
  if (!key.startsWith('sb_publishable_')) throw Error('Use a Supabase publishable key; never a service-role or secret key');
  const connect = /connect-src ([^;"]+)/.exec(readFileSync('deploy/frankendom.com.conf', 'utf8'))?.[1].split(/\s+/) ?? [];
  if (!connect.includes(endpoint.origin)) throw Error('Add the exact Supabase project origin to the Frankendom CSP before release');
  console.log('Account release configuration present; hosted provider/RLS verification still required.');
} else console.log('Account integration disabled: guest-only build.');
