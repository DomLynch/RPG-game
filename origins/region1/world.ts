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

import LAYERS from './region1-world.json' with { type: 'json' };
export const EXCHANGE_REGION = CONCORD_REGION; // 'region:concord-exchange'
export const FRONTIER_REGION = 'region:ash-frontier';

// The Exchange amendment (spec §1) and the quarter (living-world §12).
const EXCHANGE_LAYER = LAYERS.exchangeLayer;


// The Ash Frontier: spec §1 verbatim, plus the two town zones and the landmark on each side that reaches them.
const FRONTIER = LAYERS.frontier;


// Every zone folder's place (origins/zones/zone<N>/place.ts) is added here: this file names no zone beyond Region 1's own.
const FRONTIER_PLACED = { ...FRONTIER, zones: applyZones(FRONTIER.zones as never, zonePlaces()) };

export const REGION1_WORLD = merge(CONCORD, { regions: { [EXCHANGE_REGION]: EXCHANGE_LAYER, [FRONTIER_REGION]: FRONTIER_PLACED } }) as WorldData;
