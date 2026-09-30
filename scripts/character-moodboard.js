// Mood board for the character direction pick. Browser module, loaded by character-preview.html on demand.
// Procedural material swatches rendered under the game's own arena lighting, and a primitive silhouette
// blockout attached to the real rig's bones. This is a proposal tool: nothing here is an asset and nothing ships.

// Seeded value noise → height field → colour / roughness / normal maps (256², not tileable: swatch quality only).
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { let f = 0, amp = .5, freq = 1; for (let o = 0; o < 4; o++) { f += amp * noise(x * freq, y * freq, s + o * 7); amp *= .5; freq *= 2; } return f; }
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

export function surface(THREE, { base, patina = '#000000', patinaAmount = 0, roughness: [lo, hi], metalness = 0, scratches = 0, grain = 1, bump = 8, seed = 1 }) {
  const N = 256, height = new Float32Array(N * N), scratch = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) height[y * N + x] = fbm(x / N * 4 * grain, y / N * 4 * grain, seed);
  let r = seed * 7919; const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < scratches; k++) {
    const x0 = rand() * N, y0 = rand() * N, a = rand() * Math.PI, len = 20 + rand() * 70;
    for (let t = 0; t < len; t++) { const x = Math.round(x0 + Math.cos(a) * t) & (N - 1), y = Math.round(y0 + Math.sin(a) * t) & (N - 1); height[y * N + x] -= .35; scratch[y * N + x] = 1; }
  }
  const canvasFor = fill => { const c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'), img = ctx.createImageData(N, N); fill(img.data); ctx.putImageData(img, 0, 0); return c; };
  const B = rgb(base), P = rgb(patina), metal = metalness > .5;
  const color = canvasFor(d => { for (let i = 0; i < N * N; i++) { const cav = Math.max(0, 1 - height[i]) * patinaAmount, lift = scratch[i] && metal ? 1.12 : 1; for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.min(255, (B[c] * (1 - cav) + P[c] * cav) * lift); d[i * 4 + 3] = 255; } });
  const rough = canvasFor(d => { for (let i = 0; i < N * N; i++) { const v = scratch[i] && metal ? lo : lo + (hi - lo) * Math.min(1, Math.max(0, height[i])); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v * 255; d[i * 4 + 3] = 255; } });
  const normal = canvasFor(d => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, dx = (height[y * N + ((x + 1) & (N - 1))] - height[y * N + ((x - 1) & (N - 1))]) / 2, dy = (height[((y + 1) & (N - 1)) * N + x] - height[((y - 1) & (N - 1)) * N + x]) / 2;
    const n = new THREE.Vector3(-dx * bump, dy * bump, 1).normalize(); d[i * 4] = (n.x * .5 + .5) * 255; d[i * 4 + 1] = (n.y * .5 + .5) * 255; d[i * 4 + 2] = (n.z * .5 + .5) * 255; d[i * 4 + 3] = 255; } });
  const texture = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshStandardMaterial({ map: texture(color, true), roughnessMap: texture(rough), normalMap: texture(normal), metalness, roughness: 1, side: THREE.DoubleSide });
}

// The proposed material rule under this renderer: bronze, iron, leather, bone, ash, blood. Warm and matte against a cool grey floor.
export function palette(THREE) {
  return {
    'worn bronze': surface(THREE, { base: '#8b6236', patina: '#2b3f36', patinaAmount: .6, roughness: [.38, .7], metalness: .95, scratches: 45, seed: 1 }),
    'blackened iron': surface(THREE, { base: '#4a4b4d', patina: '#161515', patinaAmount: .55, roughness: [.42, .8], metalness: .9, scratches: 30, seed: 2 }),
    'oiled leather': surface(THREE, { base: '#4a2c1a', patina: '#1c0f09', patinaAmount: .5, roughness: [.48, .8], grain: 3, seed: 3 }),
    'rawhide': surface(THREE, { base: '#8d6b48', patina: '#3b2919', patinaAmount: .4, roughness: [.75, .95], grain: 2, seed: 4 }),
    'bone': surface(THREE, { base: '#d9cdb1', patina: '#78684f', patinaAmount: .35, roughness: [.45, .72], grain: 1.5, seed: 5 }),
    'ash-dusted skin': surface(THREE, { base: '#9a7259', patina: '#6b6a66', patinaAmount: .4, roughness: [.55, .82], grain: 2, seed: 6 }),
    'blood dye (heraldry)': surface(THREE, { base: '#5c1418', patina: '#200709', patinaAmount: .5, roughness: [.28, .72], grain: 2, seed: 7 }),
    'ash': surface(THREE, { base: '#6f6c66', patina: '#3a3937', patinaAmount: .5, roughness: [.85, 1], grain: 2, seed: 8 }),
    'bone dye (opponent)': surface(THREE, { base: '#b8ae98', patina: '#5a5246', patinaAmount: .4, roughness: [.5, .8], grain: 2, seed: 9 }),
  };
}

// Primitive silhouette blockout on the real rig: crested helm, one heavy shoulder, wrapped left forearm, belt and
// pteruges, greaves. Placed in world space at Idle t=0, then attached to bones so it follows every clip.
export function blockout(THREE, h, group, m, crestMaterial) {
  const root = group.children[0]; h.scrub(group, 'Idle', 0); root.updateMatrixWorld(true);
  const bone = n => root.getObjectByName(n), at = n => bone(n).getWorldPosition(new THREE.Vector3());
  const q = group.getWorldQuaternion(new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const parts = [], scene = group.parent;
  const add = (object, position, quaternion, boneName) => { object.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); object.position.copy(position); if (quaternion) object.quaternion.copy(quaternion); scene.add(object); object.updateMatrixWorld(true); bone(boneName).attach(object); parts.push(object); return object; };
  const align = (dir, outward) => { // local +y → dir, local +z → outward (projected)
    const base = new THREE.Quaternion().setFromUnitVectors(up, dir), z = new THREE.Vector3(0, 0, 1).applyQuaternion(base), t = outward.clone().sub(dir.clone().multiplyScalar(outward.dot(dir))).normalize();
    return new THREE.Quaternion().setFromAxisAngle(dir, Math.atan2(new THREE.Vector3().crossVectors(z, t).dot(dir), z.dot(t))).multiply(base);
  };
  const shell = (rTop, rBottom, length, arc, material) => new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, length, 24, 1, true, -arc / 2, arc), material);
  const head = at('Head');
  const helm = add(new THREE.Mesh(new THREE.SphereGeometry(.132, 32, 24), m['worn bronze']), head.clone().addScaledVector(up, .11).addScaledVector(fwd, .01), q, 'Head'); helm.scale.set(1, 1.08, 1.1);
  for (const side of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(.035, .12, .08), m['worn bronze']), head.clone().addScaledVector(right, side * .11).addScaledVector(fwd, .05).addScaledVector(up, .03), q, 'Head');
  const crest = new THREE.Group(), plate = new THREE.Mesh(new THREE.TorusGeometry(.225, .062, 10, 28, Math.PI * .78), crestMaterial); plate.rotation.y = Math.PI / 2; plate.scale.x = .34; crest.add(plate);
  add(crest, head.clone().addScaledVector(up, .1).addScaledVector(fwd, .01), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 9)), 'Head');
  // Shoulder: a cap on the clavicle stays on the shoulder through every pose; two lames on the upper arm follow the arm.
  const shoulder = at('upperarm_r'), armDir = at('lowerarm_r').sub(shoulder).normalize(), outward = right.clone().multiplyScalar(.7).add(up).normalize();
  add(new THREE.Mesh(new THREE.SphereGeometry(.14, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m['worn bronze']), shoulder.clone().addScaledVector(up, .02).addScaledVector(right, .025), align(outward, fwd), 'clavicle_r');
  [[.115, .1], [.125, .155]].forEach(([r, d]) => add(shell(r, r * 1.04, .06, Math.PI, m['worn bronze']), shoulder.clone().addScaledVector(armDir, d).addScaledVector(right, .01), align(armDir, outward), 'upperarm_r'));
  const forearmR = at('lowerarm_r'), handR = at('hand_r'), fDirR = handR.clone().sub(forearmR).normalize();
  add(shell(.052, .06, forearmR.distanceTo(handR) * .8, Math.PI * 1.2, m['worn bronze']), forearmR.clone().lerp(handR, .5), align(fDirR, right.clone().add(fwd).normalize()), 'lowerarm_r');
  const forearmL = at('lowerarm_l'), handL = at('hand_l'), fDirL = handL.clone().sub(forearmL).normalize();
  add(new THREE.Mesh(new THREE.CylinderGeometry(.048, .056, forearmL.distanceTo(handL) * .8, 18), m['oiled leather']), forearmL.clone().lerp(handL, .5), align(fDirL, fwd), 'lowerarm_l');
  const pelvis = at('pelvis');
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.2, .022, 10, 40), m['blackened iron']); add(belt, pelvis.clone().addScaledVector(up, .03), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), 'pelvis');
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, out = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a));
    add(new THREE.Mesh(new THREE.BoxGeometry(.075, .27, .012), m['oiled leather']), pelvis.clone().addScaledVector(up, -.17).addScaledVector(out, .2), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-Math.cos(a), Math.sin(a)))), 'pelvis');
  }
  for (const side of ['l', 'r']) {
    const calf = at(`calf_${side}`), foot = at(`foot_${side}`), dir = foot.clone().sub(calf).normalize();
    add(shell(.06, .078, calf.distanceTo(foot) * .75, Math.PI * 1.2, m['worn bronze']), calf.clone().lerp(foot, .45).addScaledVector(fwd, .03), align(dir, fwd), `calf_${side}`);
  }
  return parts;
}

export async function moodboard(h) {
  const { THREE, renderer, camera, arena, cells, player, opponent, scrub, settle, lockCamera, studioCamera, reset, stage, LOCK, GAME_RATIO, studio } = h;
  const m = palette(THREE), out = {};
  // 1. Swatches, near: each material on a sphere under the arena lights, next to the asset's current materials.
  await reset(); stage(arena); player.visible = opponent.visible = false; renderer.toneMappingExposure = 1.3;
  const materials = new Map(); player.traverse(o => { if (o.isMesh && o.material.name) materials.set(o.material.name, o.material); });
  const current = ['Steel', 'Gambeson', 'Leather', 'Antique brass'].map(n => [`current ${n}`, materials.get(n)]);
  const list = [...Object.entries(m).filter(([n]) => !n.includes('opponent')).map(([n, mat]) => [`proposed ${n}`, mat]), ...current];
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(.2, 48, 32), m['worn bronze']); sphere.position.set(0, 1, 0); sphere.castShadow = sphere.receiveShadow = true; arena.add(sphere);
  out['swatches-near'] = cells(6, 2, 360, 360, 1, i => { if (!list[i]) return false; sphere.material = list[i][1]; camera.fov = 30; camera.position.set(.45, 1.3, .85); camera.lookAt(0, 1, 0); renderer.render(arena, camera); return list[i][0]; });
  arena.remove(sphere);
  // 2. Swatches, far: the same spheres in a row at the opponent's spot, seen through the real lock camera at phone landscape.
  const row = new THREE.Group(); arena.add(row);
  list.forEach(([, mat], i) => { const s = new THREE.Mesh(sphere.geometry, mat); s.position.set((i - (list.length - 1) / 2) * .46, 1, -2.5); s.castShadow = s.receiveShadow = true; row.add(s); });
  player.visible = true; settle(30);
  out['swatches-far'] = cells(1, 1, ...LOCK.landscape, GAME_RATIO, () => { lockCamera(); renderer.render(arena, camera); return `lock camera distance, left→right: ${list.map(l => l[0].replace('proposed ', '').replace('current ', 'cur. ')).join(' · ')}`; });
  arena.remove(row);
  // 3. Silhouette blockout, studio: baseline row over blockout row, same poses and camera.
  await reset(); stage(studio); opponent.visible = false; player.visible = true; renderer.toneMappingExposure = 1; player.position.set(0, 0, 0); player.rotation.y = 0;
  const kit = blockout(THREE, h, player, m, m['blood dye (heraldry)']);
  const shots = [['Armed', 0, 0], ['Armed', 0, -.7], ['Heavy', .2, -.7], ['Guard', .5, .9]];
  out['silhouette-studio'] = cells(4, 2, 540, 720, 1, i => { const [clip, t, az] = shots[i % 4]; kit.forEach(o => o.visible = i >= 4); scrub(player, clip, t); studioCamera(false, az); renderer.render(studio, camera); return `${i >= 4 ? 'BLOCKOUT' : 'baseline'}  ${clip} t=${t}`; });
  // 4. Silhouette blockout at the real lock camera, both fighters, portrait and landscape.
  await reset(); stage(arena); opponent.visible = player.visible = true; renderer.toneMappingExposure = 1.3;
  const kits = [...blockout(THREE, h, player, m, m['blood dye (heraldry)']), ...blockout(THREE, h, opponent, m, m['bone dye (opponent)'])];
  settle(30);
  const show = i => { kits.forEach(o => o.visible = i === 1); lockCamera(); renderer.render(arena, camera); return i ? 'BLOCKOUT both fighters (crest colour = heraldry)' : 'baseline'; };
  out['silhouette-lock-portrait'] = cells(2, 1, ...LOCK.portrait, GAME_RATIO, show);
  out['silhouette-lock-landscape'] = cells(1, 2, ...LOCK.landscape, GAME_RATIO, show);
  return out;
}
