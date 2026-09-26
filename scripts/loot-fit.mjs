// Fitting helpers for pieces a script builds itself (Phase R, 2026-09-23): a piece is fitted to WHOEVER wears it — the opponent's own body
// and kit in his fight build, the player's body and level-1 kit in the loot build — so one recipe serves both files and nothing is guessed
// from a joint position. Two operations, both against a triangle grid of what the wearer already has on (rest space):
//   ringHull   — a tube of rings along an axis (a shin, a foot, a skull): at each station, rays out from the axis at N azimuths; the ring
//                sits on the outermost surface of the FIRST layer the ray meets (skin plus whatever lies within `layer` of it), so an arm
//                hanging beside a torso or the other leg is never swallowed into the hull.
//   conformOver — pushes a mesh cut from another body out along its (position-shared) normals until it clears the wearer by `gap`: a piece
//                authored on a narrower or broader frame then sits ON this one instead of through it. Vertices never move inward.
import * as T from 'three';

// Triangles of every geometry, bucketed on a uniform grid by their bounding boxes. Rays walk the cells they cross (with a one-cell halo).
export function triGrid(geometries, cell = .04) {
  const tris = [];
  for (const g of geometries) {
    const p = g.getAttribute('position'), index = g.index;
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) for (let k = 0; k < 3; k++) { const v = index ? index.getX(i + k) : i + k; tris.push(p.getX(v), p.getY(v), p.getZ(v)); }
  }
  const data = new Float32Array(tris), cells = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (let t = 0; t < data.length / 9; t++) {
    const o = t * 9, lo = [0, 1, 2].map(a => Math.floor(Math.min(data[o + a], data[o + 3 + a], data[o + 6 + a]) / cell)), hi = [0, 1, 2].map(a => Math.floor(Math.max(data[o + a], data[o + 3 + a], data[o + 6 + a]) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); (cells.get(k) ?? cells.set(k, []).get(k)).push(t); }
  }
  // Every hit distance along origin + s·dir for s in (0, far], ascending (Möller–Trumbore, both faces).
  const hits = (origin, dir, far) => {
    const seen = new Set(), out = [], steps = Math.ceil(far / (cell * .5));
    for (let s = 0; s <= steps; s++) {
      const q = origin.clone().addScaledVector(dir, Math.min(far, s * cell * .5)), c = [q.x, q.y, q.z].map(v => Math.floor(v / cell));
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const t of cells.get(key(c[0] + dx, c[1] + dy, c[2] + dz)) ?? []) {
        if (seen.has(t)) continue; seen.add(t);
        const o = t * 9, e1 = [data[o + 3] - data[o], data[o + 4] - data[o + 1], data[o + 5] - data[o + 2]], e2 = [data[o + 6] - data[o], data[o + 7] - data[o + 1], data[o + 8] - data[o + 2]];
        const h = [dir.y * e2[2] - dir.z * e2[1], dir.z * e2[0] - dir.x * e2[2], dir.x * e2[1] - dir.y * e2[0]], a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
        if (Math.abs(a) < 1e-12) continue;
        const f = 1 / a, sv = [origin.x - data[o], origin.y - data[o + 1], origin.z - data[o + 2]], u = f * (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]);
        if (u < 0 || u > 1) continue;
        const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = f * (dir.x * qv[0] + dir.y * qv[1] + dir.z * qv[2]);
        if (v < 0 || u + v > 1) continue;
        const d = f * (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]);
        if (d > 1e-6 && d <= far) out.push(d);
      }
    }
    return out.sort((x, y) => x - y);
  };
  return { hits, triangles: data.length / 9 };
}

// The outer face of the first layer along a ray: the nearest hit, then every later hit within `layer` of the one before it.
const firstLayer = (distances, layer) => { if (!distances.length) return null; let r = distances[0]; for (const d of distances) { if (d - r > layer) break; r = d; } return r; };

// Cloth hung from above: each ring becomes the convex hull of its own samples (a skirt spans the gap between the thighs, it does not dip
// into it) and never narrower than the ring above it (it falls, it does not tuck back in). Rays between the legs miss or land on an
// inner thigh, and a ring that follows them saws in and out, which is what broke the Shieldmaiden's lamellar hem into loose plates.
function drapeRings(rings) {
  const n = rings[0].radii.length, angle = k => k / n * Math.PI * 2;
  for (const ring of rings) {
    const pts = ring.radii.map((r, k) => [Math.cos(angle(k)) * r, Math.sin(angle(k)) * r]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), half = list => { const h = []; for (const q of list) { while (h.length > 1 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
    const hull = [...half(pts), ...half([...pts].reverse())];
    ring.radii = ring.radii.map((r, k) => {   // where the ray at this azimuth leaves the hull
      const dx = Math.cos(angle(k)), dy = Math.sin(angle(k)); let best = r;
      for (let i = 0; i < hull.length; i++) {
        const [ax, ay] = hull[i], [bx, by] = hull[(i + 1) % hull.length], ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = (ax * ey - ay * ex) / den, s = (ax * dy - ay * dx) / den;
        if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
      }
      return best;
    });
  }
  for (let i = 1; i < rings.length; i++) rings[i].radii = rings[i].radii.map((r, k) => Math.max(r, rings[i - 1].radii[k]));
}

// A tube of rings from `a` to `b` (rest-space points). `stations`: fractions along a→b (may run past either end); `scale(t)` flares a ring
// (default 1: the fitted radius). `drape`: hang the rings as cloth (drapeRings). `cap`: close the far end with a fan to the axis point the ray along the axis finds.
// Returns an indexed BufferGeometry with position/normal/uv, wound outward, and the fitted rings for logging.
export function ringHull(grid, a, b, { stations, azimuths = 16, gap = .004, layer = .03, far = .25, cap = false, scale = () => 1, up, pick = 'first', drape = false } = {}) {
  const axis = b.clone().sub(a), span = axis.length(); axis.normalize();
  const ref = up ?? (Math.abs(axis.y) > .9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0));
  const u = new T.Vector3().crossVectors(ref, axis).normalize(), v = new T.Vector3().crossVectors(axis, u).normalize();
  const rings = [];
  for (const t of stations) {
    const origin = a.clone().addScaledVector(axis, t * span), radii = [];
    for (let k = 0; k < azimuths; k++) {
      const ang = k / azimuths * Math.PI * 2, out = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
      const d = grid.hits(origin, out, far);   // 'outer': the last surface within `far` (a skirt round both thighs, whose axis runs between them)
      radii.push(pick === 'outer' ? (d.length ? d.at(-1) : null) : firstLayer(d, layer));
    }
    const found = radii.filter(r => r !== null).sort((x, y) => x - y);
    if (!found.length) throw new Error(`ringHull: nothing around the axis at station ${t}`);
    const median = found[found.length >> 1];
    rings.push({ t, origin, radii: radii.map(r => ((r ?? median) + gap) * scale(t)) });
  }
  if (drape) drapeRings(rings);
  const positions = [], uvs = [], index = [];
  for (const [i, r] of rings.entries()) for (let k = 0; k <= azimuths; k++) {
    const ang = k / azimuths * Math.PI * 2, rad = r.radii[k % azimuths];
    positions.push(...r.origin.clone().addScaledVector(u, Math.cos(ang) * rad).addScaledVector(v, Math.sin(ang) * rad).toArray()); uvs.push(k / azimuths, i / (rings.length - 1));
  }
  const row = azimuths + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < azimuths; k++) { const p = i * row + k; index.push(p, p + 1, p + row + 1, p, p + row + 1, p + row); }
  if (cap) {
    const last = rings.at(-1), tip = firstLayer(grid.hits(last.origin, axis, far), layer), apex = last.origin.clone().addScaledVector(axis, (tip ?? 0) + gap);
    const c = positions.length / 3; positions.push(...apex.toArray()); uvs.push(.5, 1);
    for (let k = 0; k < azimuths; k++) index.push((rings.length - 1) * row + k, (rings.length - 1) * row + k + 1, c);
  }
  let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(index);
  g.computeVertexNormals();
  // Wind outward: the mean of (normal · away-from-axis) must be positive.
  const p = g.getAttribute('position'), n = g.getAttribute('normal'); let sum = 0;
  for (let k = 0; k < p.count; k++) { const q = new T.Vector3().fromBufferAttribute(p, k).sub(a), along = q.dot(axis), off = q.addScaledVector(axis, -along); sum += off.dot(new T.Vector3().fromBufferAttribute(n, k)); }
  if (sum < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; g.index.needsUpdate = true; g.computeVertexNormals(); }
  return { geometry: g, rings, u, v, axis, span };
}

// Push every vertex of `g` (rest space, any indexing) out along its position-shared normal until it clears the wearer's first layer by
// `gap`. `reach`: how far inside a vertex may start and still be pulled out. Returns the count moved and the largest push, in metres.
export function conformOver(grid, g, { gap = .006, reach = .06, beyond = .02, maxPush = .05 } = {}) {
  const p = g.getAttribute('position'), key = k => `${p.getX(k).toFixed(5)},${p.getY(k).toFixed(5)},${p.getZ(k).toFixed(5)}`;
  const shared = g.index ? g.toNonIndexed() : g;
  // Area-weighted normals summed per position, so seam duplicates move together and a piece never tears along a UV seam.
  const normals = new Map(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), sp = shared.getAttribute('position');
  for (let i = 0; i < sp.count; i += 3) {
    a.fromBufferAttribute(sp, i); b.fromBufferAttribute(sp, i + 1); c.fromBufferAttribute(sp, i + 2);
    const n = new T.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    for (const q of [a, b, c]) { const k = `${q.x.toFixed(5)},${q.y.toFixed(5)},${q.z.toFixed(5)}`; (normals.get(k) ?? normals.set(k, new T.Vector3()).get(k)).add(n); }
  }
  const moved = new Map(); let count = 0, most = 0;
  for (let k = 0; k < p.count; k++) {
    const id = key(k);
    if (!moved.has(id)) {
      const n = (normals.get(id) ?? new T.Vector3(0, 1, 0)).clone().normalize(), at = new T.Vector3().fromBufferAttribute(p, k);
      // From `reach` inside along the normal: the wearer's surfaces the vertex has to clear are the ones at or beyond it, up to `beyond`
      // past it (2 cm by default; a boot cut for a smaller foot looks further, for the toes past its tip).
      const out = grid.hits(at.clone().addScaledVector(n, -reach), n, reach + beyond).map(d => d - reach).filter(s => s > -reach && s < beyond);
      const need = out.length ? Math.max(...out) + gap : -Infinity;
      moved.set(id, need > 0 ? n.multiplyScalar(Math.min(need, maxPush)) : null);
      if (need > 0) { count++; most = Math.max(most, Math.min(need, maxPush)); }
    }
    const d = moved.get(id); if (d) p.setXYZ(k, p.getX(k) + d.x, p.getY(k) + d.y, p.getZ(k) + d.z);
  }
  p.needsUpdate = true;   // normals kept: the source's smooth shading survives a push of a few millimetres
  return { count, most, vertices: moved.size };
}

// The outer face of the first layer from `origin` along `dir` (null when nothing is there): a crown above a head joint, a shin's front.
export const surfaceAlong = (grid, origin, dir, { layer = .03, far = .35 } = {}) => firstLayer(grid.hits(origin, dir, far), layer);

// Rest-space joint position of a bone, from the skeleton's inverse binds (the pattern every build-warrior block uses).
export const jointOf = (skeleton, boneIndex) => name => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skeleton.boneInverses[boneIndex(name)]).invert());
