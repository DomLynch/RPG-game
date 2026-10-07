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
    terrain: { biome: 'ash-waste', ground: 'ash' },
  },
  zones: {
    'east-road': {
      zoneSize: { width: 40, depth: 100 },
      layout: {
        'exchange-gate': { u: 0.5, v: 0, facing: 180 },
        milestone: { u: 0.5, v: 0.3, facing: 0 },
        watchtower: { u: 0.82, v: 0.55, facing: -90 },
        'fields-turn': { u: 0, v: 0.7, facing: 90 },
        crossroads: { u: 0.5, v: 1, facing: 0 },
      },
      connections: {
        ferry: { to: 'ferry-landing', kind: 'road', here: 'crossroads', there: 'road-end' },
        fields: { to: 'cinder-fields', kind: 'road', here: 'fields-turn', there: 'road-gate' },
      },
      difficulty: { levelMin: 11, levelMax: 12 },
      ambience: { preset: 'frontier-haze' },
    },
    'ferry-landing': {
      zoneSize: { width: 60, depth: 60 },
      layout: {
        'road-end': { u: 0.5, v: 0, facing: 180 },
        'ferry-house': { u: 0.2, v: 0.5, facing: 90 },
        boathouse: { u: 0.8, v: 0.7, facing: -90 },
        'mere-shore': { u: 1, v: 0.4, facing: -90 },
        dock: { u: 0.5, v: 0.9, facing: 0 },
      },
      connections: {
        road: { to: 'east-road', kind: 'road', here: 'road-end', there: 'crossroads' },
        mere: { to: 'black-mere', kind: 'road', here: 'mere-shore', there: 'landing-shore' },
        'night-boat': { to: 'blood-ruin', kind: 'portal', here: 'dock', there: 'ruin-jetty' },
      },
      density: { npcs: 0.4, creatures: 0 },
      ambience: { preset: 'frontier-haze' },
    },
    'cinder-fields': {
      zoneSize: { width: 120, depth: 120 },
      layout: {
        'road-gate': { u: 1, v: 0.5, facing: -90 },
        'ash-pits': { u: 0.5, v: 0.5, facing: 0 },
        shrine: { u: 0.2, v: 0.8, facing: 0 },
        'hold-road': { u: 0, v: 0.3, facing: 90 }, // added: the track to Cinder Hold
      },
      connections: {
        road: { to: 'east-road', kind: 'road', here: 'road-gate', there: 'fields-turn' },
        hold: { to: 'cinder-hold', kind: 'road', here: 'hold-road', there: 'hold-gate' },
      },
      density: { creatures: 0.35 },
      spawns: { respawnSeconds: 240 },
      difficulty: { levelMin: 11, levelMax: 13 },
      ambience: { preset: 'frontier-haze' },
    },
    'black-mere': {
      zoneSize: { width: 100, depth: 140 },
      layout: {
        'landing-shore': { u: 0, v: 0.3, facing: 90 },
        'reed-bank': { u: 0.35, v: 0.4, facing: 0 },
        'mere-hollow': { u: 0.5, v: 0.65, facing: 0 },
        causeway: { u: 0.5, v: 1, facing: 0 },
        'causeway-foot': { u: 0.75, v: 0.95, facing: -90 }, // added: Mere End stands at the causeway
      },
      connections: {
        landing: { to: 'ferry-landing', kind: 'road', here: 'landing-shore', there: 'mere-shore' },
        causeway: { to: 'blood-ruin', kind: 'road', here: 'causeway', there: 'causeway-end' },
        'mere-end': { to: 'mere-end', kind: 'road', here: 'causeway-foot', there: 'end-gate' },
      },
      spawns: { boss: 'mere-hollow' },
      density: { creatures: 0.2 },
      difficulty: { levelMin: 12, levelMax: 15 },
      ambience: { preset: 'frontier-haze' },
    },
    'blood-ruin': {
      zoneSize: { width: 60, depth: 80 },
      layout: {
        'causeway-end': { u: 0.5, v: 0, facing: 180 },
        'ruin-jetty': { u: 0, v: 0.2, facing: 90 },
        'ruin-gate': { u: 0.5, v: 0.45, facing: 0 },
        crypt: { u: 0.5, v: 0.85, facing: 0 },
      },
      connections: {
        causeway: { to: 'black-mere', kind: 'road', here: 'causeway-end', there: 'causeway' },
        'night-boat': { to: 'ferry-landing', kind: 'portal', here: 'ruin-jetty', there: 'dock' },
      },
      spawns: { boss: 'crypt' },
      density: { creatures: 0.15 },
      difficulty: { levelMin: 13, levelMax: 14 },
      ambience: { preset: 'frontier-haze' },
    },
    // Cinder Hold: a village (living-world §12) beside the Cinder Fields. No creatures inside the town.
    'cinder-hold': {
      zoneSize: { width: 60, depth: 60 },
      layout: {
        'hold-gate': { u: 1, v: 0.3, facing: -90 },
        'hold-centre': { u: 0.45, v: 0.5, facing: 0 },
        'hold-hall': { u: 0.3, v: 0.85, facing: 0 },
        'hold-forge': { u: 0.2, v: 0.45, facing: 90 },
        'hold-fence': { u: 0.7, v: 0.75, facing: 180 },
        'hold-jail': { u: 0.1, v: 0.8, facing: 90 },
      },
      connections: { fields: { to: 'cinder-fields', kind: 'road', here: 'hold-gate', there: 'hold-road' } },
      density: { npcs: 0.3, creatures: 0 },
      difficulty: { levelMin: 11, levelMax: 13 },
      ambience: { preset: 'frontier-haze' },
    },
    // Mere End: a hamlet (living-world §12) at the foot of the causeway.
    'mere-end': {
      zoneSize: { width: 50, depth: 50 },
      layout: {
        'end-gate': { u: 0, v: 0.5, facing: 90 },
        'end-centre': { u: 0.55, v: 0.5, facing: 0 },
        'end-hall': { u: 0.6, v: 0.88, facing: 180 },
        'end-healer': { u: 0.85, v: 0.4, facing: -90 },
        'end-jail': { u: 0.9, v: 0.85, facing: -90 },
      },
      connections: { mere: { to: 'black-mere', kind: 'road', here: 'end-gate', there: 'causeway-foot' } },
      density: { npcs: 0.2, creatures: 0 },
      difficulty: { levelMin: 12, levelMax: 15 },
      ambience: { preset: 'frontier-haze' },
    },
  },
};

export const REGION1_WORLD = merge(CONCORD, { regions: { [EXCHANGE_REGION]: EXCHANGE_LAYER, [FRONTIER_REGION]: FRONTIER } }) as WorldData;
