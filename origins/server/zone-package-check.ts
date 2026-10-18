// The server-side zone package check (zone package gap 2, docs/specs/zone-package.md, Backend's review (e)): what the writer and presence need from a package, found in CI at import instead of at module load,
// where a bad door or warp would throw and stop presence from starting. Pure: the caller loads the Zone (the unlisted-zone opt-in lives in the caller, never here: this file takes a Zone and reaches no
// registry) and the shared tables. Returns the problems (empty = the server can run the package).
// Listed vs unlisted: an UNLISTED package (the alpha-1 bar) has no presence zone row and is not in the writer's zone list, so only what does not depend on those is checked for it (its spawn rows price, its keys
// follow the rule, its doors have a landing); a LISTED one also has to put every warp, its own and the exit warps, inside a presence zone row and clear of the trade areas.
import type { Zone } from '../zones/loader.ts';
import type { ExitRow } from '../zones/exits.ts';
import { fightSetup, type EncounterContent } from '../encounters/encounters.ts';
import { frontierBuild, frontierPlan } from '../preview/frontier-plan.ts';
import { mobSpecs } from '../preview/mobs.ts';
import { arrival } from '../preview/zone-exit.ts';
import { placeProblem } from '../presence/warps.ts';
import { loadoutRow } from '../world/loadouts-rules.ts';
import { healthOf, keyProblemsOf } from './world-spawns.ts';

export type PackageCtx = {
  content: EncounterContent;
  zones: Readonly<Record<string, Zone>>;   // every zone package, listed or not (a door's far end)
  exits: readonly ExitRow[];               // the merged exit list (exit-rows.json plus every package's own)
  tableWarps: ReadonlySet<string>;         // the ids in warp-landmarks.json
};

/** The pieces a creature's loadouts can put on it that its spawn row's loot table does not drop (one problem per creature and piece). Pure. */
export function loadoutDropProblems(zone: Zone, content: EncounterContent): string[] {
  const bad: string[] = [], tables = content.region.registry.lootTables;
  for (const [character, look] of Object.entries(zone.mobLooks?.looks ?? {})) {
    const ids = [look.loadout, ...(zone.mobLooks?.spread[character]?.loadouts ?? [])].filter((x): x is string => x !== undefined);
    if (!ids.length) continue;
    const row = zone.spawns.rows.find((r) => r.id === character), table = row ? tables.get(row.loot as never) : undefined;
    if (!row || !table) continue;   // no spawn row (or no table: check 1 names that) = nothing rolls, so nothing to compare
    const drops = new Set(table.rolls.flatMap((r) => r.entries.map((e) => String(e.item))));
    for (const id of ids) {
      const l = loadoutRow(id);
      if (!l) { bad.push(`creature ${character}: loadout "${id}" is not a loadouts.json row`); continue; }
      for (const piece of l.pieces) if (!drops.has(`item:loot.${piece}`)) bad.push(`creature ${character}: loadout "${id}" wears ${piece}, which ${row.loot} does not drop`);
    }
  }
  return [...new Set(bad)];
}

export function packageProblems(zone: Zone, ctx: PackageCtx): string[] {
  const bad: string[] = [], id = zone.id, listed = zone.unlisted !== true;
  // 1. Every spawn row prices and its loot table exists: a creature the server cannot price never engages (fail closed), so a package whose creatures all fail would be a silent empty zone.
  const f = frontierPlan(false, id), specs = mobSpecs(f, frontierBuild(f), zone.spawns.rows);
  for (const row of zone.spawns.rows) if (!row.later && !ctx.content.region.registry.lootTables.has(row.loot as never)) bad.push(`spawn row ${row.id}: loot ${row.loot} is not a loot table`);
  for (const spec of specs) {
    const fight = spec.encounter ?? spec.character;
    if (healthOf(spec.body, spec.level) === null) bad.push(`creature ${spec.id}: no roster body "${spec.body}" at level ${spec.level}, so the server cannot price it`);
    else if (!fightSetup(fight, ctx.content).ok) bad.push(`creature ${spec.id}: ${fight} is not a fight the server can set up`);
  }
  // 1b. UNLISTED zones only (a listed zone's drops are frozen): what a creature can be SEEN wearing is what can drop. The pieces are derived from the zone's mob looks (the look's loadout plus its spread loadouts, the
  // rows loadouts.json holds), never listed by hand: every worn piece must be an entry of the table its spawn row rolls.
  if (!listed) bad.push(...loadoutDropProblems(zone, ctx.content));
  // 2. The creature keys follow the database's rule (bare for Zone 1, z<N>: for the rest, one zone each).
  bad.push(...keyProblemsOf(id, specs.map((s) => s.id)));
  // 3. Doors: every exit this package owns, or that arrives in it, leads to a zone package that has the landing; a LISTED package's own door may not lead to an unlisted zone.
  const owner = (e: ExitRow): Zone | undefined => Object.values(ctx.zones).find((z) => z.world.includes(e.zone));
  const mine = ctx.exits.filter((e) => zone.world.includes(e.zone) || e.to === id), seenWarps = new Map<string, string>();
  for (const e of mine) {
    const to = ctx.zones[e.to];
    if (!to) { bad.push(`exit ${e.id}: "${e.to}" is not a zone package`); continue; }
    if (!owner(e)) bad.push(`exit ${e.id}: "${e.zone}" is not a world zone of any package`);
    if (seenWarps.has(e.warp)) bad.push(`exit ${e.id}: warp "${e.warp}" is also exit ${seenWarps.get(e.warp)}'s`); seenWarps.set(e.warp, e.id);
    if (ctx.tableWarps.has(e.warp)) bad.push(`exit ${e.id}: warp "${e.warp}" is also a warp-landmarks.json row`);
    // (a listed zone's door to an UNLISTED zone, the sample crypt's today, is allowed: openExits keeps it closed until the far zone is listed, so the server derives no warp for it.) An UNLISTED far zone's
    // own places load only on its own page (zonePlaces), so no plan of it can be built here: that landing is checked when the far zone is listed.
    if (to.unlisted === true) continue;
    const landing = arrival(frontierPlan(true, e.to), e.to, e.id, ctx.exits);
    if (!landing) { bad.push(`exit ${e.id}: zone ${e.to} has no landing (arrive landmark "${e.arrive}")`); continue; }
    if (owner(e)?.unlisted !== true) { const p = placeProblem(landing.x, landing.z); if (p) bad.push(`exit ${e.id}: its landing warp "${e.warp}" is ${p}`); }
  }
  // 4. The package's own warps: new ids (not in the table, not an exit's), and for a listed package a place inside a presence zone row and clear of the trade areas.
  for (const w of zone.warps ?? []) {
    if (ctx.tableWarps.has(w.id)) bad.push(`warp ${w.id}: already a warp-landmarks.json row`);
    if (ctx.exits.some((e) => e.warp === w.id)) bad.push(`warp ${w.id}: already an exit's warp`);
    for (const other of Object.values(ctx.zones)) if (other.id !== id && (other.warps ?? []).some((x) => x.id === w.id)) bad.push(`warp ${w.id}: also in package ${other.id}`);
    if (listed) { const p = placeProblem(w.x, w.z); if (p) bad.push(`warp ${w.id}: ${p}`); }
  }
  return bad;
}
