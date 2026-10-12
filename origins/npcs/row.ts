// Townspeople as NPC rows (Town plan A1, Dom 2026-10-08): ONE row per working NPC, naming what they do (role flags, WoW's npcflag idea:
// banker, vendor, smith, healer, fence, innkeeper, recorder), where they stand (a zone and a landmark, the counter World builds), when they work
// (game-clock hours; Dom: shops shut about 22:00-06:00, the bank and one night trader never close) and, for a vendor, which shop list they sell
// from (origins/shops). The character itself (name, lore, body) stays the character-definition in the content bundle; Characters own the body
// and the outfit-per-spawn, World the spawn, the walk home and the counter. Pure: no DOM, no clock, no storage.
// To extend: a role is one ROW in origins/npcs/roles.json (loaded and checked by the registry loader); a role that sells from a shop list carries `shop: true`. The validator
// reads that flag, never a role name. Ids are strings checked against the rows, not a TypeScript union.
import roles from './roles.json' with { type: 'json' };

export type NpcRoleRow = { order: number; shop?: boolean };
export const NPC_ROLE_ROWS = roles.roles as Readonly<Record<string, NpcRoleRow>>;
export const NPC_ROLES: readonly string[] = Object.entries(NPC_ROLE_ROWS).sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
export type NpcRole = string;
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
    if (!r.roles.length || r.roles.some((role) => !Object.hasOwn(NPC_ROLE_ROWS, role))) add('roles', `roles are one or more of ${NPC_ROLES.join(', ')}`);
    if (new Set(r.roles).size !== r.roles.length) add('roles', 'a role is listed twice');
    if (r.hours !== 'always' && !(r.hours.length === 2 && r.hours.every((h) => Number.isInteger(h) && h >= 0 && h <= 23) && r.hours[0] !== r.hours[1])) add('hours', "hours are 'always' or [open, close], whole hours 0..23, not equal");
    const sells = r.roles.some((role) => NPC_ROLE_ROWS[role]?.shop);   // a role row with `shop: true` (the vendor) sells from a shop list
    if (sells && (r.shop === undefined || !ctx.shop(r.shop))) add('shop', 'a vendor names a shop that has a list');
    if (!sells && r.shop !== undefined) add('shop', 'only a vendor has a shop');
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

// Each shop's counter: the vendor row that names it (shop service id -> the vendor's zone and landmark). The writer's shop_buy checks the buyer stands there.
export const shopCounters = (rows: readonly NpcRow[]): ReadonlyMap<string, { zone: string; at: string }> =>
  new Map(rows.flatMap((r) => (r.shop ? [[r.shop, { zone: r.zone, at: r.at }] as const] : [])));
