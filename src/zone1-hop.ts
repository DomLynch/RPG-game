// Play goes to Zone 1 (Dom via Strategy 2026-10-08: "Zone 1 IS the game"). Root `/` keeps serving the arena page, so a share link, a lesson and every `/?query` stay as they are;
// the hop is client-side, no nginx redirect for `/`: a returning player (saved fighter, first-loss lesson done) on a plain `/` goes to Zone 1, a new player stays for the lesson
// and goes to Zone 1 when it ends. The arena stays at /arena/ (deploy/frankendom.com.conf) for Zone 1's menu and the 50-level ladder.
export const ZONE1_URL = '/preview/origins/';
// OFF until World's no-query Zone 1 default is live (the target must be the whole game); the flip is this one line plus its pin in tests/zone1-hop.test.ts.
export const ZONE1_IS_DEFAULT = false;

export type HopFacts = { search: string; pathname: string; hasFighter: boolean; lessonDone: boolean };
/** Where a page load goes instead of the arena, or null to stay: only an exactly plain `/` (no query, no /s/ id, no /arena/), a saved fighter and the lesson done. */
export const zone1Hop = (o: HopFacts, on = ZONE1_IS_DEFAULT): string | null =>
  on && o.search === '' && o.pathname === '/' && o.hasFighter && o.lessonDone ? ZONE1_URL : null;
/** Where the first-loss lesson's end goes (null = the arena's `?fight=1`, as before). */
export const zone1AfterLesson = (on = ZONE1_IS_DEFAULT): string | null => (on ? ZONE1_URL : null);
