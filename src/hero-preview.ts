// Hero preview flag (Hero Look, Lead 2026-09-27, route B): `?hero=/herolook/<name>.glb` stands a fitted set in for the player's rig, so Dom
// can see it live before anyone swaps warrior.glb. Only a same-origin file directly under /herolook/ ending in .glb is accepted; anything
// else (a full URL, another path, `..`, an encoded slash) is ignored without a word and the page boots today's hero.
const PREVIEW = /^\/herolook\/[A-Za-z0-9_-]+\.glb$/;
export function heroPreview(search: string): string | undefined {
  const value = new URLSearchParams(search).get('hero');
  return value && PREVIEW.test(value) ? value : undefined;
}
// The game's own reloads (the Daily button, the daily's move to the day's opponent) build a fresh link, which would drop the flag and boot
// today's hero mid-look (Lead 2026-09-27). This carries a valid `?hero=` from the current page onto that link; an invalid one stays dropped.
export function withHero(link: string, search: string): string {
  const hero = heroPreview(search);
  return hero ? `${link}${link.includes('?') ? '&' : '?'}hero=${hero}` : link;
}
