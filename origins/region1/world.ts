// Origins Region 1 world data: the Concord Exchange (square + town quarter) and the Ash Frontier (five zones + two towns), in the
// origins/world WorldData format. Data only: nothing here ships, nothing in src/ reads it.
//
// Sources: docs/specs/origins/region1-ash-frontier.md §1 (the Frontier's zones, verbatim; the Exchange amendment: `west-gate` and
// `west-road`), and the living-world spec (origin/expansion/living-world docs/specs/origins/living-world.md) §12: three war-capable
// towns, the Exchange quarter, Cinder Hold and Mere End, with the square ↔ quarter boundary a visible arch (`square-arch`, kind gate).
// The square keeps `rules.safe: true` forever; the quarter is its own non-safe zone. Zone sizes and landmarks for the quarter, Cinder
// Hold and Mere End are PROPOSED (living-world open question 9: "the World lane adds the Cinder Hold and Mere End zones").
//
// The Exchange part is a layer merged over CONCORD (origins/world/concord.ts): landmarks are ADDED, none moves, so concord.test.ts's
// greybox pins still hold.
import { CONCORD, CONCORD_REGION } from '../world/concord.ts';
import { merge, type WorldData } from '../world/resolve.ts';
import { applyZones } from '../zones/place.ts';
import { zonePlaces } from '../zones/loader.ts';

export const EXCHANGE_REGION = CONCORD_REGION; // 'region:concord-exchange'
export const FRONTIER_REGION = 'region:ash-frontier';

// The Exchange amendment (spec §1) and the quarter (living-world §12).
const EXCHANGE_LAYER = {
  zones: {
    exchange: {
      layout: {
        'west-gate': { u: 0, v: 0.5, facing: 90 },
        'square-arch': { u: 1, v: 0.5, facing: -90 }, // the lit arch: the square's only edge onto the quarter
      },
      passages: { 'west-road': { from: 'west-gate', width: 3, length: 12 } },
      connections: { quarter: { to: 'exchange-quarter', kind: 'gate', here: 'square-arch', there: 'quarter-arch', twoWay: true } },
    },
    // The town quarter outside the square: not safe, guards and town services; trades still settle only in the square.
    'exchange-quarter': {
      zoneSize: { width: 60, depth: 60 },
      layout: {
        'quarter-arch': { u: 0.5, v: 0, facing: 180 },
        'quarter-centre': { u: 0.5, v: 0.6, facing: 0 }, // 36 m from the arch: no guard ring overlaps the square (≥ 30 m)
        'quarter-hall': { u: 0.5, v: 0.92, facing: 180 },
        'quarter-forge': { u: 0.18, v: 0.55, facing: -90 },
        'quarter-healer': { u: 0.82, v: 0.45, facing: 90 },
        'quarter-fence': { u: 0.82, v: 0.75, facing: 90 },
        'quarter-jail': { u: 0.15, v: 0.88, facing: -90 },
      },
      connections: { square: { to: 'exchange', kind: 'gate', here: 'quarter-arch', there: 'square-arch', twoWay: true } },
      rules: { safe: false, tradeAllowed: false },
      density: { npcs: 0.4, props: 0.4, creatures: 0 },
      terrain: { ground: 'ash' },
      ambience: { preset: 'exchange-dusk' }, // the Exchange's look, as the square
    },
  },
};

// The Ash Frontier: spec §1 verbatim, plus the two town zones and the landmark on each side that reaches them.
const FRONTIER = {
  params: {
    difficulty: { levelMin: 11, levelMax: 15, lootTier: 3 },
    economy: { vendorTier: 3 },
    rules: { safe: false, pvp: false, tradeAllowed: false, restAllowed: true },
    density: { npcs: 0.05, props: 0.4, creatures: 0.25 },
    spawns: { respawnSeconds: 300 },
    ambience: { weather: 'dust', sound: 'wind' }, // the look preset is set zone by zone (frontier-haze)
    terrain: { biome: 'ash-waste', ground: 'ash', relief: 1.5, hillScale: 40 }, // gentle hills in the open ground (origins/world/relief.ts); every building, prop and road keeps a flat pad
  },
  zones: {},   // the seven Frontier zones are Zone 1's place (origins/zone-rows/zone1.row.json), applied below with every other zone's
};

// Every zone folder's place (origins/zones/zone<N>/place.ts) is added here: this file names no zone beyond Region 1's own.
const FRONTIER_PLACED = { ...FRONTIER, zones: applyZones(FRONTIER.zones as never, zonePlaces()) };

export const REGION1_WORLD = merge(CONCORD, { regions: { [EXCHANGE_REGION]: EXCHANGE_LAYER, [FRONTIER_REGION]: FRONTIER_PLACED } }) as WorldData;
