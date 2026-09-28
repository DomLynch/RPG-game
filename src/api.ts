// The account API (the Supabase project URL and its publishable key) from the build environment; null when the build has none (a
// checkout without .env, the test harness). main.ts cannot read import.meta itself (the harness runs it as CommonJS), so this is the place.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const api: { url: string; key: string } | null = url && key ? { url, key } : null;
// The deployed revision (deploy.sh exports it as VITE_SENTRY_RELEASE for Sentry): the perf beacon's release column. Null in a local build.
export const revision: string | null = (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) || null;
