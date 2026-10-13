// The legend bosses standing in a zone (World, 2026-10-13): origins/boss/legend-spawns.json places a legend at one of the zone's landmarks, and the page draws it as a NAMED creature of its
// family's world body (the same view the other creatures use). It is page-side only: mobSpecs and the server's spawn list never see it (the world creature path has no verified record, and a
// legend's spell is only ever granted by the verified encounter settle), so no creature test or spawn price moves. It never aggros and never roams: the player walks up and taps it, and the page
// starts the fight through encounter_start `boss:<legend>` (origins/preview/legend-fight.ts). Pure: no DOM, no clock, no storage.
import { LEGEND_SPAWNS, legendView, type LegendSpawn } from '../boss/legend-view.ts';
import { zoneKeyPrefix } from '../zones/loader.ts';
import type { Frontier } from './frontier-plan.ts';
import type { MobSpec } from './mobs.ts';

export const legendSpecs = (f: Frontier, spawns: readonly LegendSpawn[] = LEGEND_SPAWNS): MobSpec[] => {
  const prefix = zoneKeyPrefix(f.zone), out: MobSpec[] = [];
  for (const s of spawns) {
    const boss = legendView(s.legend), zone = f.zones.find((z) => z.zone === s.zone && Object.hasOwn(z.landmarks, s.at));
    if (!boss || !zone) continue;   // another zone's legend, or a landmark this build lacks
    out.push({ id: `${prefix}legend-${s.id}`, character: `legend:${boss.legend}`, name: boss.name, encounter: null, body: boss.enemy, level: boss.level, zone: zone.zone, spawn: 'legend', home: { ...zone.landmarks[s.at]!, x: zone.landmarks[s.at]!.x + (s.dx ?? 0), z: zone.landmarks[s.at]!.z + (s.dz ?? 0) }, roam: 0, aggro: 1, named: true, legend: boss.legend });
  }
  return out;
};
