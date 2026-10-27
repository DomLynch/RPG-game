// The numbers of Dom's two Pit layouts (zone plan rows dungeon1-bowl, dungeon1-spiral): reachable area per level, steepest slope, biggest step, from the start mark by the hero's own walk rule.
//   node scripts/pit-layout-measure.mjs
import { measureLayout } from '../tests/lib/pit-measure.ts';
import { previewRule } from '../origins/preview/preview-rules.ts';

const SLOPE = previewRule('layoutSlope');
for (const [zone, zc] of [['dungeon1-bowl', 47], ['dungeon1-spiral', 36]]) console.log(JSON.stringify(measureLayout(zone, SLOPE, { x: 26, z: zc })));
