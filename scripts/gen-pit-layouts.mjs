// Authoring tool (World, Lead 2026-10-22, Dom's pick between two layouts): writes Dungeon 1's Pit as two layouts into the zone plan table (origins/zones/plan-rows.json), zones `dungeon1-bowl` and `dungeon1-spiral`.
// The layouts are ROWS; this script only turns the few design numbers below into the rows' boxes, rings and wedges (re-run to retune: node scripts/gen-pit-layouts.mjs). The game reads only the rows (?pitlayout=bowl|spiral, a look test).
// Metres. The Pit's centre is the origin, the yard to the south (+z), the hero opens facing north (-z, heading pi). Heights are relative to the rim (y 0); a band is one step lower than the one outside it.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../origins/zones/plan-rows.json', import.meta.url);
const STEP = 2.2, BASE = -7.5;                        // one band's drop; the rows' solids go down to BASE so a wall face reads as stone
const BANDS = [{ tint: [1.1, 1.04, 0.9], people: '#7a6a50' }, { tint: [0.9, 0.86, 0.8], people: '#4a5a6a' }, { tint: [0.7, 0.6, 0.58], people: '#7a2a24' }];   // the 1-2 / 3-4 / 5+ bands (outer to centre)
const STONE = [0.62, 0.6, 0.57], YARD = [0.86, 0.83, 0.78], DUEL = [0.78, 0.6, 0.55];
const rows = { pieces: [], people: [], marks: [] };
let zone = '', n = 0;
const r = (v) => Math.round(v * 1000) / 1000;
const add = (layer, shape, x, y, z, tint, o = {}) => rows.pieces.push({ id: `${zone}/piece-${String(n++).padStart(3, '0')}`, zone, layer, shape, x: r(x), y: r(y), z: r(z), tint, rotY: r(o.rotY ?? 0), foot: r(o.foot ?? y - 10), ...(o.walk ? { walk: true } : {}) });
const solidTo = (top, base = BASE) => ({ h: top - base, y: (top + base) / 2 });   // a solid from `base` up to `top`: its height and centre
const ring = (rIn, rOut, top, tint, walk, layer = 'paving', segs = 48) => { const { h, y } = solidTo(top); add(layer, ['ring', rIn, rOut, h, segs], 0, y, 0, tint, { foot: BASE, walk }); };
const disc = (rad, top, tint, walk, cx = 0, cz = 0, layer = 'paving') => { const { h, y } = solidTo(top); add(layer, ['cylinder', rad, rad, h, 48], cx, y, cz, tint, { foot: BASE, walk }); };
const slab = (cx, cz, w, d, top, tint, walk, rotY = 0, layer = 'paving') => { const { h, y } = solidTo(top); add(layer, ['box', w, h, d], cx, y, cz, tint, { rotY, foot: BASE, walk }); };
const dir = (a) => [Math.sin(a), Math.cos(a)];   // the unit vector at the angle a from +z toward +x
/** A ramp: `length` x `width`, its low end `low` high and rising `rise` along `dir` (the angle from +z toward +x), centred at (cx, cz). */
const ramp = (cx, cz, length, width, low, rise, a, tint, layer = 'paving') => add(layer, ['wedge', length, rise, width], cx, low + rise / 2, cz, tint, { rotY: a - Math.PI / 2, foot: low - 6, walk: true });
const parapet = (rad, thick, top, segs, skip) => { const da = (2 * Math.PI) / segs; for (let i = 0; i < segs; i++) { const a = (i + 0.5) * da; if (skip(a)) continue; const { h, y } = solidTo(top); add('stone', ['box', 2 * rad * Math.tan(da / 2) + 0.1, h, thick], Math.sin(a) * rad, y, Math.cos(a) * rad, STONE, { rotY: a, foot: BASE }); } };
const fighter = (x, z, band, y) => rows.people.push({ id: `${zone}/person-${String(rows.people.length).padStart(3, '0')}`, zone, x: r(x), y: r(y), z: r(z), color: BANDS[band].people });
const atMouth = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3;   // the yard's mouth in the parapet, at the south (a = 0)
/** The yard (the safe new-player start), the Duel pit (a separate sunk room off it, with its ramp) and the mark where he opens. */
function yardAndDuel(z0, z1) {
  const zc = (z0 + z1) / 2;
  slab(0, zc, 28, z1 - z0, 0, YARD, true);                                    // the yard: flat at the rim's height, walkable
  disc(9, -STEP, DUEL, true, 26, zc);                                         // the Duel pit: a sunk round room east of the yard
  ramp(18, zc, 8, 4, -STEP, STEP, -Math.PI / 2, DUEL);                        // its ramp: rises west to the yard's edge (x = 14)
  slab(-14.6, zc, 1.2, z1 - z0, 1.2, STONE, false, 0, 'stone');               // the yard's west wall
  slab(0, z1 + 0.6, 30, 1.2, 1.6, STONE, false, 0, 'stone');                  // its back wall
  rows.marks.push({ id: `${zone}/start`, zone, x: 0, y: 0, z: r(zc + (z1 - z0) / 4), facing: r(Math.PI) });
  fighter(26, zc - 2, 2, -STEP); fighter(27.4, zc + 1.5, 2, -STEP);           // two placeholder duellists
}

// ---- OPTION 2: BOWL -----------------------------------------------------------------------------------------------
zone = 'dungeon1-bowl'; n = 0;
{
  const R = { floor: 13, mid: 23, rim: 31 }, ARM = 8.4;                       // the champion floor, the middle ring and the outer terrace end here; a ramp's length
  ring(R.mid, R.rim, 0, BANDS[0].tint, true);                                 // outer terrace (levels 1-2) at the rim's height
  ring(R.floor, R.mid, -STEP, BANDS[1].tint, true);                           // middle ring (3-4), one step down
  disc(R.floor, -2 * STEP, BANDS[2].tint, true);                              // the Champion floor (5+)
  parapet(R.rim + 0.7, 1.4, 1.3, 36, atMouth);                                // the rim wall: a low parapet, the yard's mouth at the south
  for (const a of [Math.PI / 2, (3 * Math.PI) / 2]) { const [dx, dz] = dir(a), rc = R.floor - ARM / 2; ramp(dx * rc, dz * rc, ARM, 4.5, -2 * STEP, STEP, a, BANDS[1].tint); }   // champion ramps (east, west): floor up to the middle ring
  for (const a of [0.9, Math.PI + 0.9]) { const [dx, dz] = dir(a), rc = R.mid - ARM / 2; ramp(dx * rc, dz * rc, ARM, 4.5, -STEP, STEP, a, BANDS[0].tint); }   // outer ramps: middle ring up to the terrace
  yardAndDuel(R.rim + 2, R.rim + 30);
  slab(0, R.rim + 1, 12, 3, 0, YARD, true);                                   // the mouth: a bridge from the yard onto the terrace
  for (const [band, rad, count, phase, y] of [[0, 27, 3, 0.5, 0], [1, 18, 4, 0.2, -STEP], [2, 6, 3, 0.9, -2 * STEP]]) for (let i = 0; i < count; i++) { const a = phase + (i * 2 * Math.PI) / count; fighter(Math.sin(a) * rad, Math.cos(a) * rad, band, y); }
}

// ---- OPTION 4: SPIRAL ---------------------------------------------------------------------------------------------
zone = 'dungeon1-spiral'; n = 0;
{
  const RP = 17, W = 6, FLOOR_R = 14.5, DA = (10 * Math.PI) / 180, RAMP_SEGS = 9, LAND_SEGS = 4;   // path radius and width, the floor's radius, the segment angle (10 deg), ramp and landing lengths in segments
  const arcLen = RP * DA, rise = STEP / RAMP_SEGS;
  disc(FLOOR_R, -2 * STEP, BANDS[2].tint, true);                              // the Champion floor (5+): the spiral ends on it
  let a = 0, level = 0;
  const path = [];                                                            // each segment's angles and heights, for placing the fighters on the path
  const landing = (count, band) => { for (let i = 0; i < count; i++) { const mid = a + DA / 2, [dx, dz] = dir(mid), { h, y } = solidTo(level); add('paving', ['box', arcLen + 0.15, h, W], dx * RP, y, dz * RP, BANDS[band].tint, { rotY: mid, foot: BASE, walk: true }); path.push({ a0: a, a1: a + DA, y0: level, y1: level, band }); a += DA; } };
  const descend = (count, band) => { for (let i = 0; i < count; i++) { const mid = a + DA / 2, [dx, dz] = dir(mid), low = level - rise; add('paving', ['wedge', arcLen + 0.15, rise, W], dx * RP, low + rise / 2, dz * RP, BANDS[band].tint, { rotY: mid + Math.PI, foot: low - 6, walk: true }); const { h, y } = solidTo(low); add('stone', ['box', arcLen, h, W], dx * RP, y, dz * RP, STONE, { rotY: mid, foot: BASE }); path.push({ a0: a, a1: a + DA, y0: level, y1: low, band }); a += DA; level = low; } };   // each segment a wedge (rising against the way down) on a solid column
  landing(LAND_SEGS, 0); descend(RAMP_SEGS, 0); landing(LAND_SEGS, 1); descend(RAMP_SEGS, 1); landing(LAND_SEGS, 2);
  parapet(RP + W / 2 + 0.7, 1.2, 1.3, 36, atMouth);                           // the outer parapet, open at the yard's mouth
  yardAndDuel(RP + W / 2 + 2, RP + W / 2 + 30);
  slab(0, RP + W / 2 + 1, 12, 3, 0, YARD, true);                              // the mouth: onto the first landing
  const onPath = (t, band) => { const s = path.find((q) => t >= q.a0 && t < q.a1) ?? path[path.length - 1], f = (t - s.a0) / (s.a1 - s.a0); fighter(Math.sin(t) * RP, Math.cos(t) * RP, band, s.y0 + (s.y1 - s.y0) * f); };
  onPath(0.35, 0); onPath(1.2, 0); onPath(1.9, 0); onPath(2.9, 1); onPath(3.6, 1); onPath(4.4, 1);   // the 1-2 landing and ramp, then the 3-4 ones
  for (let i = 0; i < 3; i++) { const t = 0.4 + (i * 2 * Math.PI) / 3; fighter(Math.sin(t) * 6, Math.cos(t) * 6, 2, -2 * STEP); }   // the Champion floor
}

// ---- write the rows ----------------------------------------------------------------------------------------------
const raw = JSON.parse(readFileSync(FILE, 'utf8'));
const keep = (t) => (raw[t] ?? []).filter((q) => !String(q.zone).startsWith('dungeon1-'));
const out = { about: raw.about, anchors: keep('anchors'), pieces: [...keep('pieces'), ...rows.pieces], awnings: keep('awnings'), people: [...keep('people'), ...rows.people], braziers: keep('braziers'), marks: [...keep('marks'), ...rows.marks] };
const rowsOf = (name, list) => `  "${name}": [\n${list.map((q) => `    ${JSON.stringify(q)}`).join(',\n')}\n  ]`;
writeFileSync(FILE, `{\n  "about": ${JSON.stringify(out.about)},\n${['anchors', 'pieces', 'awnings', 'people', 'braziers', 'marks'].map((t) => rowsOf(t, out[t])).join(',\n')}\n}\n`);
console.log(`dungeon1 layouts: ${rows.pieces.length} pieces, ${rows.people.length} fighters, ${rows.marks.length} marks`);
