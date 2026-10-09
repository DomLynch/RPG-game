// Play goes to Zone 1 (Dom via Strategy 2026-10-08: "Zone 1 IS the game"). Root `/` keeps serving the arena page, so a share link, a lesson and every `/?query` stay as they are;
// the hop is client-side, no nginx redirect for `/`: a returning player (saved fighter, first-loss lesson done) on a plain `/` goes to Zone 1, a new player stays for the lesson
// and goes to Zone 1 when it ends. The arena stays at /arena/ (deploy/frankendom.com.conf) for Zone 1's menu and the 50-level ladder.
export const ZONE1_URL = '/zone1/';   // nginx serves the Origins preview's index.html here (deploy/frankendom.com.conf); its assets keep their absolute /preview/origins/ paths; the Origins page has its Frontier on without a query (REGION !== '0'), so no query shows in the address bar
// ON (Dom via Strategy 2026-10-08: Zone 1 is the game at frankendom.com; the earlier gates, paid-by-default and the session refresh, are lifted by his new direction). The one switch, with its pin in tests/zone1-hop.test.ts.
export const ZONE1_IS_DEFAULT = true;

export type HopFacts = { search: string; pathname: string; hasFighter: boolean; lessonDone: boolean };
/** Where a page load goes instead of the arena, or null to stay: only an exactly plain `/` (no query, no /s/ id, no /arena/), a saved fighter and the lesson done. */
export const zone1Hop = (o: HopFacts, on = ZONE1_IS_DEFAULT): string | null =>
  on && o.search === '' && o.pathname === '/' && o.hasFighter && o.lessonDone ? ZONE1_URL : null;
/** Where the first-loss lesson's end goes (null = the arena's `?fight=1`, as before). */
export const zone1AfterLesson = (on = ZONE1_IS_DEFAULT): string | null => (on ? ZONE1_URL : null);

// "Sign in" on Zone 1's signed-out line sends `/?account=signin&next=zone1` to the arena's own Google sign-in; the wish to come back is kept for the one OAuth round trip (sessionStorage, taken once) and honoured when the sign-in succeeds.
const NEXT_KEY = 'frankendom.next';
type Session = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const NEXT_TTL_MS = 10 * 60_000;   // an abandoned sign-in must not send a much later arena sign-in to Zone 1
export const rememberZone1 = (search: string, storage: Session | null, now = Date.now()): boolean => {
  const p = new URLSearchParams(search);
  if (p.get('account') !== 'signin' || p.get('next') !== 'zone1') return false;
  try { storage?.setItem(NEXT_KEY, String(now)); return !!storage; } catch { return false; }
};
export const takeZone1 = (storage: Session | null, now = Date.now()): string | null => {
  try { const at = Number(storage?.getItem(NEXT_KEY)); storage?.removeItem(NEXT_KEY); return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= NEXT_TTL_MS ? ZONE1_URL : null; } catch { return null; }
};
