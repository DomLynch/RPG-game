// Townspeople as NPC rows (Town plan A1, Dom 2026-10-08): ONE row per working NPC, naming what they do (role flags, WoW's npcflag idea:
// banker, vendor, smith, healer, fence, innkeeper, recorder), where they stand (a zone and a landmark, the counter World builds), when they work
// (game-clock hours; Dom: shops shut about 22:00-06:00, the bank and one night trader never close) and, for a vendor, which shop list they sell
// from (origins/shops). The character itself (name, lore, body) stays the character-definition in the content bundle; Characters own the body
// and the outfit-per-spawn, World the spawn, the walk home and the counter. Pure: no DOM, no clock, no storage.
// To extend: add a role to NPC_ROLES and, if it needs a link (like vendor -> shop), one rule in validateNpcRow.

export const NPC_ROLES = ['banker', 'vendor', 'smith', 'healer', 'fence', 'innkeeper', 'recorder'] as const;
export type NpcRole = (typeof NPC_ROLES)[number];
export const SHOP_HOURS: readonly [number, number] = [6, 22];   // Dom 2026-10-08: shops open 06:00, shut 22:00 (game clock)

export type NpcRow = {
  npc: string;                       // a character id in the content bundle
  roles: readonly NpcRole[];
  zone: string;                      // where they work: a zone id
  at: string;                        // the landmark they stand at (their counter)
  hours: 'always' | readonly [number, number];   // game-clock hours they work, [open, close) (close may wrap past midnight); 'always' = never closes
  shop?: string;                     // a vendor's shop: a service id with a shop list
};
export type NpcIssue = { path: string; message: string };
export type NpcContext = {
  character: (id: string) => boolean;            // a character-definition exists
  shop: (service: string) => boolean;           // a shop list exists for this service
  landmark: (zone: string, at: string) => boolean;   // World has placed this landmark
};

// Rejects a bad row. An unplaced landmark is NOT an error (World places counters after the rows exist): `unplaced` lists them instead.
export function validateNpcRows(rows: readonly NpcRow[], ctx: NpcContext): { issues: NpcIssue[]; unplaced: string[] } {
  const issues: NpcIssue[] = [], unplaced: string[] = [], seen = new Set<string>();
  rows.forEach((r, i) => {
    const p = `npcs[${i}]`, add = (field: string, message: string) => issues.push({ path: `${p}.${field}`, message });
    if (!ctx.character(r.npc)) add('npc', `${r.npc} is not a character in the content`);
    if (seen.has(r.npc)) add('npc', `${r.npc} has two rows`);
    seen.add(r.npc);
    if (!r.roles.length || r.roles.some((role) => !(NPC_ROLES as readonly string[]).includes(role))) add('roles', `roles are one or more of ${NPC_ROLES.join(', ')}`);
    if (new Set(r.roles).size !== r.roles.length) add('roles', 'a role is listed twice');
    if (r.hours !== 'always' && !(r.hours.length === 2 && r.hours.every((h) => Number.isInteger(h) && h >= 0 && h <= 23) && r.hours[0] !== r.hours[1])) add('hours', "hours are 'always' or [open, close], whole hours 0..23, not equal");
    const vendor = r.roles.includes('vendor');
    if (vendor && (r.shop === undefined || !ctx.shop(r.shop))) add('shop', 'a vendor names a shop that has a list');
    if (!vendor && r.shop !== undefined) add('shop', 'only a vendor has a shop');
    if (!ctx.landmark(r.zone, r.at)) unplaced.push(`${r.zone}/${r.at}`);
  });
  return { issues, unplaced };
}

// Is this NPC at work at game hour `hour` (0 <= hour < 24, fractional allowed)? A shop's open check reads its vendor's row.
export function atWork(row: NpcRow, hour: number): boolean {
  if (row.hours === 'always') return true;
  const [open, close] = row.hours;
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}
