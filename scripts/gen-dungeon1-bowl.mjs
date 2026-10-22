// Authoring tool (World, Dom 2026-10-22: the Dungeon 1 bowl, everything on the data layer): writes the bowl as zone "7" into the zone plan table (origins/zones/plan-rows.json): pieces, marks, the layer materials.
// The bowl is ROWS; this script only turns the few design numbers below into the rows' rings, boxes and wedges (re-run to retune: node scripts/gen-dungeon1-bowl.mjs). The game reads only the rows through the plan table
// (origins/zones/plan.ts) and the zone row origins/zone-rows/zone7.row.json: no bowl number lives in game code, and a second dungeon is a new zone row + these rows. Each ring or floor piece carries `edge`, the name
// of the ring it bounds, and a mark of that name stands on it: Combat's roster reads the ring edges back from these pieces (ringEdges in plan.ts), so the edges live once.
// Metres. The bowl's centre is the origin, the yard to the south (+z), the hero opens facing north (-z, heading pi). Heights are relative to the rim (y 0); a band is one step lower than the one outside it.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../origins/zones/plan-rows.json', import.meta.url);
const STEP = 2.2, BASE = -7.5;                        // one band's drop; the rows' solids go down to BASE so a wall face reads as sand
const SAND_TILE = 3;                                  // metres per repeat of the Pit's sand on the bowl's surfaces
const STAIN_GAIN = 4;                               // how far the stain mask's edges grow: blotches, not specks
const STAIN_SPAN = 14;                              // metres per repeat of the Pit's blood-stain mask (the sand's world-space patch), strongest on the lowest ground
const BANDS = [{ tint: [1.1, 1.04, 0.9] }, { tint: [1, 0.9, 0.8] }, { tint: [0.92, 0.8, 0.7] }];   // the 1-2 / 3-4 / 5+ bands (outer to centre): plain sand, then sand taking on blood toward the floor
const WALL = [0.78, 0.6, 0.52], YARD = [1.02, 0.96, 0.84], DUEL = [0.92, 0.8, 0.7];                                                  // the rim wall and yard walls (blood-stained sand), the yard, the Duel pit's floor
const ZONE = '7', EDGES = { outer: 'ring-outer', middle: 'ring-middle', floor: 'floor' };
const rows = { pieces: [], people: [], marks: [], layers: [] };
let n = 0;
const r = (v) => Math.round(v * 1000) / 1000;
const add = (layer, shape, x, y, z, tint, o = {}) => rows.pieces.push({ id: `${ZONE}/piece-${String(n++).padStart(3, '0')}`, zone: ZONE, layer, shape, x: r(x), y: r(y), z: r(z), tint, rotY: r(o.rotY ?? 0), foot: r(o.foot ?? y - 10), ...(o.walk ? { walk: true } : {}), ...(o.edge ? { edge: o.edge } : {}) });
const solidTo = (top, base = BASE) => ({ h: top - base, y: (top + base) / 2 });   // a solid from `base` up to `top`: its height and centre
const ring = (rIn, rOut, top, tint, walk, edge, layer = 'paving', segs = 48) => { const { h, y } = solidTo(top); add(layer, ['ring', rIn, rOut, h, segs], 0, y, 0, tint, { foot: BASE, walk, edge }); };
const disc = (rad, top, tint, walk, cx = 0, cz = 0, edge, layer = 'paving') => { const { h, y } = solidTo(top); add(layer, ['cylinder', rad, rad, h, 48], cx, y, cz, tint, { foot: BASE, walk, edge }); };
const slab = (cx, cz, w, d, top, tint, walk, rotY = 0, layer = 'paving') => { const { h, y } = solidTo(top); add(layer, ['box', w, h, d], cx, y, cz, tint, { rotY, foot: BASE, walk }); };
const dir = (a) => [Math.sin(a), Math.cos(a)];   // the unit vector at the angle a from +z toward +x
/** A ramp: `length` x `width`, its low end `low` high and rising `rise` along `dir` (the angle from +z toward +x), centred at (cx, cz). */
const ramp = (cx, cz, length, width, low, rise, a, tint, layer = 'paving') => add(layer, ['wedge', length, rise, width], cx, low + rise / 2, cz, tint, { rotY: a - Math.PI / 2, foot: low - 6, walk: true });
const parapet = (rad, thick, top, segs, skip) => { const da = (2 * Math.PI) / segs; for (let i = 0; i < segs; i++) { const a = (i + 0.5) * da; if (skip(a)) continue; const { h, y } = solidTo(top); add('stone', ['box', 2 * rad * Math.tan(da / 2) + 0.1, h, thick], Math.sin(a) * rad, y, Math.cos(a) * rad, WALL, { rotY: a, foot: BASE }); } };
const mark = (name, x, y, z, facing) => rows.marks.push({ id: `${ZONE}/${name}`, zone: ZONE, x: r(x), y: r(y), z: r(z), ...(facing !== undefined ? { facing: r(facing) } : {}) });
const atMouth = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3;   // the yard's mouth in the parapet, at the south (a = 0)
/** The yard (the safe new-player start), the Duel pit (a separate sunk room off it, with its ramp) and the mark where he opens. */
function yardAndDuel(z0, z1) {
  const zc = (z0 + z1) / 2;
  slab(0, zc, 28, z1 - z0, 0, YARD, true);                                    // the yard: flat at the rim's height, walkable
  disc(9, -STEP, DUEL, true, 26, zc);                                         // the Duel pit: a sunk round room east of the yard
  ramp(18, zc, 8, 4, -STEP, STEP, -Math.PI / 2, DUEL);                        // its ramp: rises west to the yard's edge (x = 14)
  slab(-14.6, zc, 1.2, z1 - z0, 1.2, WALL, false, 0, 'stone');                // the yard's west wall
  slab(0, z1 + 0.6, 30, 1.2, 1.6, WALL, false, 0, 'stone');                   // its back wall
  mark('start', 0, 0, zc + (z1 - z0) / 4, Math.PI);
}

const R = { floor: 13, mid: 23, rim: 31 }, ARM = 8.4;                         // the champion floor, the middle ring and the outer terrace end here; a ramp's length
ring(R.mid, R.rim, 0, BANDS[0].tint, true, EDGES.outer);                      // outer terrace (levels 1-2) at the rim's height
ring(R.floor, R.mid, -STEP, BANDS[1].tint, true, EDGES.middle);               // middle ring (3-4), one step down
disc(R.floor, -2 * STEP, BANDS[2].tint, true, 0, 0, EDGES.floor);             // the Champion floor (5+)
parapet(R.rim + 0.7, 1.4, 1.3, 36, atMouth);                                  // the rim wall: a low parapet, the yard's mouth at the south
for (const a of [Math.PI / 2, (3 * Math.PI) / 2]) { const [dx, dz] = dir(a), rc = R.floor - ARM / 2; ramp(dx * rc, dz * rc, ARM, 4.5, -2 * STEP, STEP, a, BANDS[1].tint); }   // champion ramps (east, west): floor up to the middle ring
for (const a of [0.9, Math.PI + 0.9]) { const [dx, dz] = dir(a), rc = R.mid - ARM / 2; ramp(dx * rc, dz * rc, ARM, 4.5, -STEP, STEP, a, BANDS[0].tint); }   // outer ramps: middle ring up to the terrace
yardAndDuel(R.rim + 2, R.rim + 30);
slab(0, R.rim + 1, 12, 3, 0, YARD, true);                                     // the mouth: a bridge from the yard onto the terrace
mark(EDGES.outer, (R.mid + R.rim) / 2, 0, 0); mark(EDGES.middle, (R.floor + R.mid) / 2, -STEP, 0); mark(EDGES.floor, 0, -2 * STEP, 0);   // a landmark on each ring, for the roster's spawn rows
for (const layer of ['paving', 'stone']) rows.layers.push({ id: `${ZONE}/${layer}`, zone: ZONE, layer, material: 'sand', tile: SAND_TILE, stain: { span: STAIN_SPAN, top: 0, bottom: -STEP, gain: STAIN_GAIN } });   // no brick: the bowl's surfaces are the Pit's own sand

// ---- the bowl's place in the world frame: presence keeps ONE table of zones (no overlap), and the Pit and the Exchange stand at the origin, so the bowl's centre is a free spot east of them; its `origin` mark names it ----
const FRAME = [150, 0];
for (const q of [...rows.pieces, ...rows.marks]) { q.x = r(q.x + FRAME[0]); q.z = r(q.z + FRAME[1]); }
rows.marks.push({ id: `${ZONE}/origin`, zone: ZONE, x: FRAME[0], y: 0, z: FRAME[1] });

// ---- write the rows ----------------------------------------------------------------------------------------------
const raw = JSON.parse(readFileSync(FILE, 'utf8'));
const keep = (t) => (raw[t] ?? []).filter((q) => !String(q.zone).startsWith('dungeon1-') && q.zone !== ZONE);   // also sweeps the retired look-test keys
const out = { about: raw.about, anchors: keep('anchors'), pieces: [...keep('pieces'), ...rows.pieces], awnings: keep('awnings'), people: [...keep('people'), ...rows.people], braziers: keep('braziers'), marks: [...keep('marks'), ...rows.marks], layers: [...keep('layers'), ...rows.layers] };
const rowsOf = (name, list) => `  "${name}": [\n${list.map((q) => `    ${JSON.stringify(q)}`).join(',\n')}\n  ]`;
writeFileSync(FILE, `{\n  "about": ${JSON.stringify(out.about)},\n${['anchors', 'pieces', 'awnings', 'people', 'braziers', 'marks', 'layers'].map((t) => rowsOf(t, out[t])).join(',\n')}\n}\n`);
// ---- the zone row's place: camp points the roster's spawn rows anchor to (frontier landmarks, in the bowl's own frame) ----
const fine = (v) => Math.round(v * 1e6) / 1e6;   // a landmark fraction keeps enough digits for a point to land within a millimetre
const PLACE_W = 80, PLACE_D = 130, CAMPS = [[EDGES.outer, (R.mid + R.rim) / 2, 6], [EDGES.middle, (R.floor + R.mid) / 2, 6], [EDGES.floor, R.floor / 2, 3]];   // the place zone's width and depth (m); per ring: its mid-radius and how many camp points round it
const ROW = new URL('../origins/zone-rows/zone7.row.json', import.meta.url), row7 = JSON.parse(readFileSync(ROW, 'utf8')), layout = {};
for (const [edge, radius, count] of CAMPS) for (let i = 0; i < count; i++) { const a = (i * 2 * Math.PI) / count, x = Math.sin(a) * radius, z = Math.cos(a) * radius; layout[`${edge}-${i}-spot`] = { u: fine(0.5 - x / PLACE_W), v: fine((z + PLACE_D / 2) / PLACE_D), facing: 0 }; }   // world x = mount.x - local x, world z = mount.z + local d, the zone centred on the plan's `origin` mark (frontier-plan.ts); the zone spans the yard too (z to +61), so every spot of the page is inside a presence zone
const start = rows.marks.find((q) => q.id === `${ZONE}/start`), [ox, oz] = FRAME;
row7.entry = { x: start.x, z: start.z, facing: start.facing }; row7.warps = [{ id: `zone${ZONE}-start`, x: start.x, z: start.z, unit: 'm' }];
row7.safeAreas = [{ id: 'yard', name: 'The yard', shape: 'rect', min: [ox - 14, oz + R.rim + 2], max: [ox + 14, oz + R.rim + 30], pvp: 'off', spawnsAllowed: false }, { id: 'duel-pit', name: 'The Duel pit', shape: 'rect', min: [ox + 17, oz + 38], max: [ox + 35, oz + 56], pvp: 'on', spawnsAllowed: false }];   // the yard slab (28 m wide, rim+2 .. rim+30) and the Duel pit's room (9 m round at x 26, z 47), in the world frame
row7.world = ['dungeon-bowl']; row7.names = { ...row7.names, 'dungeon-bowl': row7.name };
row7.place = { zones: { 'dungeon-bowl': { zoneSize: { width: PLACE_W, depth: PLACE_D }, layout, connections: {}, density: { creatures: 0.3 }, ambience: { preset: 'frontier-haze' } } }, joins: [], waypoints: Object.keys(layout), spawns: row7.place?.spawns ?? [] };
writeFileSync(ROW, `${JSON.stringify(row7, null, 2)}\n`);
console.log(`dungeon1 bowl (zone ${ZONE}): ${rows.pieces.length} pieces, ${rows.people.length} fighters, ${rows.marks.length} marks, ${rows.layers.length} layer rows`);
