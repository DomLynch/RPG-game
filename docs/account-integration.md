# Google account saves — activation pending

Owner approved Google login and Supabase, with all account controls inside Field Journal. This slice saves a fighter's name and selected practice opponent across devices. It does not award career marks, import browser scores as verified results, or implement the remaining Season 1 progression service.

## Smallest safe implementation

Use the official Supabase SDK with PKCE, loaded only when the journal opens or Google returns. Rejected: hand-written token/session handling; copying Calibre's Next.js backend into a static game; making visitors log in before practice. No simulation, rendering or input modules change.

Sign-in never overwrites the cloud or device save. Players explicitly save their current fighter or load their cloud fighter. Loading restarts practice; the button says so. A replacement save compares its server revision so another device's newer save cannot be silently overwritten. A failed read disables saving until retry succeeds. Sign-out clears this browser's account session; the loaded name/opponent remain ordinary device-local practice settings. Shared-device users should sign out.

The migration exposes only owner-scoped name/opponent edits. User IDs and revisions cannot be changed by the client. There are no client-writable ranks, marks, inventory or result tables. Future career persistence must use server-validated, idempotent results as outlined in progression-direction.md; this account row is not that system.

## Activation checklist — dedicated Frankendom project

1. Access the existing Supabase organisation and choose/create a dedicated Frankendom project. Do not use or alter Calibre's project. Confirm any billable project creation with the owner first.
2. Apply `supabase/migrations/202609190001_fighter_profiles.sql` once. Verify owner isolation against the hosted service with two disposable test users. Local SQL tests do not prove hosted configuration.
3. In Google Cloud configure a Frankendom web OAuth client, authorised origin `https://frankendom.com`, and the exact callback from the project's Supabase Google provider page. Enable only OpenID, email and profile scopes. No Gmail inbox access. Put the client secret in Supabase, never Vite or Git.
4. Enable Google in Supabase Auth; set Site URL `https://frankendom.com` and exact redirect `https://frankendom.com/?account=return`. Disable the unused email/password provider while keeping Google sign-ups allowed. Confirm the Google application's audience is ready for external players, not just owner/test users.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in ignored `.env.production.local`. Only use a publishable key, never service-role/secret keys. Add the **exact** project's HTTPS origin to Frankendom's nginx `connect-src`, validate nginx, and reload only after verifying the Frankendom vhost diff. Existing deployment copies static assets, not vhost config.
6. Run full quality/completion checks. Deploy through `scripts/deploy.sh` after integration/CI. Verify public revision, Google return, cancelled login, actual save on device A/load on device B, sign-out and a returning session. Inspect production errors without closing unrelated incidents.

Without both environment values the account panel stays hidden and guest play is unchanged. Do not release a nonfunctional sign-in button. The owner created dedicated free project `rxbewmzmovelckzoosss` (Mumbai). Its migration is applied, and hosted two-user RLS checks passed inside a rolled-back transaction. No test users or saves remain. Site URL and exact production callback allowlist are saved. Unauthenticated public REST access is denied (401/42501). Google web client is created in dedicated project principal-zoo-509110-v0 with the exact production origin and Supabase callback. The secret is saved only in Supabase; the public auth settings endpoint confirms Google enabled. Unused email/password sign-in is disabled. Google publication needs the public privacy page now included at /privacy.html and linked in the journal. Production CSP installation and actual live login are still pending; no authentication release is claimed. All 12 commands passed on the world-integrated candidate (269 tests); final audio integration requires a new combined run. Calibre remains untouched.

## Evidence and review

- `node scripts/account-database-check.mjs`: real disposable PostgreSQL, socket-only; requires PostgreSQL tools on PATH (or PG_BIN). Runs the actual migration and tests anonymous denial, two-user RLS isolation, column privileges, invalid data and stale revisions. No production data.
- `node scripts/account-browser-check.mjs`: actual built game and Supabase SDK, with explicitly controlled provider responses. Tests lazy loading, mobile/desktop journal placement, PKCE redirect, cancellation, callback, saved fighter recovery, conflict/error retry and sign-out. Writes screenshots and JSON to artifacts/account. This is **not** a live Google receipt.
- Pure profile validation tests ensure no device ID, score or forged career data is uploaded.
- Two review passes: ownership/concurrency/failure paths; then browser layout, pausing, guest startup and bundle budget. Physical-phone and external-player gates remain outstanding.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
