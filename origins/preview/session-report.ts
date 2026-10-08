// The one Sentry event Zone 1 sends when a player arrives with a stored session and ends up signed out (Auditor/Strategy 2026-10-08, so Backend can count it).
// A fixed message and an enum tag: no token, no account or character id, no URL, no library error text. Init is src/monitoring.ts (imported for its side effect in main.ts):
// sendDefaultPii false, and a beforeSend that strips user, request, breadcrumbs and extra.
import { captureMessage } from '@sentry/browser';

export type SignedOutReason = 'no-client' | 'timeout' | 'refused';
export const SIGNED_OUT_EVENT = 'zone1-stale-session-signed-out';
export const signedOutEvent = (reason: SignedOutReason) => ({ message: SIGNED_OUT_EVENT, level: 'warning' as const, tags: { reason } });
export function reportSignedOut(reason: SignedOutReason): void {
  const e = signedOutEvent(reason);
  try { captureMessage(e.message, { level: e.level, tags: e.tags }); } catch { /* monitoring must never touch the page */ }
}
