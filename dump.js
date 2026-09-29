// Split Crown mesh dump (gate 2, Dwarf L9/L10, 2026-09-29): every visible mesh within 0.8 m of the SplitCrown centre, with posed bounds.
// Needs a LOCAL-ONLY line in src/scene.ts after `scene.add(sun);`:  (globalThis as { __gate2Scene?: unknown }).__gate2Scene = scene;
// and in rank-look-check's finisher leg after `row.stills = dir;`:
//   row.dump = await page.evaluate(new Function("return (" + (await fs.readFile(process.env.DUMP, "utf8")) + ")")());
// Build, run with DUMP=<this file> --finishers splitCrown, then revert both lines.
() => {
  const sc = globalThis.__gate2Scene, crown = sc.getObjectByName('SplitCrown');
  if (!crown) return { error: 'no SplitCrown' };
  const box = (o) => { const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]; o.updateWorldMatrix(true, false); let b; if (o.isSkinnedMesh) { o.computeBoundingBox(); b = o.boundingBox; } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b = o.geometry.boundingBox; } for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) { const v = b.min.clone().set(x,y,z).applyMatrix4(o.matrixWorld); ['x','y','z'].forEach((k,i)=>{ mn[i]=Math.min(mn[i],v[k]); mx[i]=Math.max(mx[i],v[k]); }); } return [mn,mx]; };
  const cb = []; crown.traverse((o) => { if (o.isMesh && o.visible) cb.push(box(o)); });
  const c = [0,1,2].map((i) => (Math.min(...cb.map((b)=>b[0][i])) + Math.max(...cb.map((b)=>b[1][i]))) / 2);
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const out = [];
  sc.traverse((o) => { if (!(o.isMesh || o.isSkinnedMesh) || !vis(o)) return; const [mn, mx] = box(o); const m = [0,1,2].map((i)=>(mn[i]+mx[i])/2), size = [0,1,2].map((i)=>+(mx[i]-mn[i]).toFixed(3)); const d = Math.hypot(...m.map((v,i)=>v-c[i])); if (d < 0.8 && Math.max(...size) < 2) { const chain = []; for (let p = o; p && chain.length < 5; p = p.parent) chain.push(p.name || p.type); out.push({ d: +d.toFixed(3), size, skinned: !!o.isSkinnedMesh, inCrown: chain.includes('SplitCrown'), chain: chain.join('<') }); } });
  return { crownCenter: c.map((v)=>+v.toFixed(3)), n: out.length, near: out.sort((a,b)=>a.d-b.d) };
}
