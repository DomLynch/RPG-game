import { Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix3, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Euler, SkinnedMesh, Vector3 } from 'three';

// One pose bake per encounter, prepared before combat like a cached severed prop. Exterior maps are borrowed; only the new geometry and cut material
// belong to this effect. Cut the torso at its waist, retaining both arms and the held weapon with the upper body.
export function openWaist(root: Object3D, anchor: Group) {
  root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
  const inverse = anchor.matrixWorld.clone().invert();
  const pelvis = root.getObjectByName('pelvis')!, spine = root.getObjectByName('spine_01')!;
  const hip = pelvis.getWorldPosition(new Vector3()).applyMatrix4(inverse);
  const waist = hip.y + (spine.getWorldPosition(new Vector3()).applyMatrix4(inverse).y - hip.y) * .6;
  const group = new Group(); group.name = 'Opened';
  const cut = new MeshStandardMaterial({ color: '#501c20', roughness: .88, side: DoubleSide, vertexColors: true });
  const lower = new Group(), upper = new Group(); lower.name = 'OpenedLegs'; upper.name = 'OpenedTorso'; group.add(lower, upper);
  const supports: number[][] = [[], []];
  const armBone = (name: string) => /^(clavicle|upperarm|lowerarm|hand|index|middle|pinky|ring|thumb)_/.test(name);
  const visible = (o: import('three').Object3D) => { for (let p: import('three').Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
  root.traverse(object => {
    if (!(object instanceof Mesh) || !visible(object)) return;
    const geometry = object.geometry as BufferGeometry, position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    if (!position || !normal) return;
    const uv = geometry.getAttribute('uv'), color = geometry.getAttribute('color'), index = geometry.index;
    const transform = inverse.clone().multiply(object.matrixWorld), normalMatrix = new Matrix3().getNormalMatrix(transform);
    const skin = object instanceof SkinnedMesh ? object : null;
    skin?.skeleton.update();
    const indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
    const arm = skin?.skeleton.bones.map(b => armBone(b.name));
    let attachment = false;
    for (let p: import('three').Object3D | null = object; p && p !== root; p = p.parent) if (p.name === 'WeaponDrawn' || p.name === 'SwordDrawn') attachment = true;
    type Vertex = { p: Vector3; n: Vector3; uv: number[]; color: number[]; arm: number };
    const vertices: Vertex[] = [];
    for (let i = 0; i < position.count; i++) {
      const p = object.getVertexPosition(i, new Vector3()).applyMatrix4(transform), n = new Vector3().fromBufferAttribute(normal, i);
      let armWeight = 0;
      if (skin) {
        const blended = new Matrix4(); blended.elements.fill(0);
        for (let k = 0; k < 4; k++) {
          const b = indices.getComponent(i,k), w = weights.getComponent(i,k);
          if (arm?.[b]) armWeight += w;
          for (let e = 0; e < 16; e++) blended.elements[e] += skin.skeleton.boneMatrices![b*16+e]*w;
        }
        blended.premultiply(skin.bindMatrixInverse).multiply(skin.bindMatrix);
        n.applyMatrix3(new Matrix3().getNormalMatrix(blended));
      }
      n.applyMatrix3(normalMatrix).normalize();
      vertices.push({ p, n, uv: [uv?.getX(i) ?? 0, uv?.getY(i) ?? 0], color: color ? [color.getX(i),color.getY(i),color.getZ(i)] : [], arm: armWeight });
    }
    for (const [halfIndex, half] of [lower,upper].entries()) {
      const side = halfIndex ? 1 : -1, edges: Vector3[][] = [];
      const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], groups: { start: number; count: number; materialIndex: number }[] = [];
      const push = (v: Vertex) => {
        const p = v.p.clone(); if (halfIndex) p.y -= waist;
        positions.push(...p.toArray()); normals.push(...v.n.toArray()); uvs.push(...v.uv); colors.push(...v.color); supports[halfIndex].push(p.x,p.y,p.z);
      };
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const tri = [0,1,2].map(k => vertices[index ? index.getX(i+k) : i+k]);
        const wholeArm = attachment || tri.reduce((s,v)=>s+v.arm,0)/3 > .5;
        if (wholeArm && !halfIndex) continue;
        const polygon: Vertex[] = [], crossing: Vector3[] = [];
        for (let k = 0; k < 3; k++) {
          const a = tri[k], b = tri[(k+1)%3], inside = wholeArm || (a.p.y-waist)*side >= 0;
          if (inside) polygon.push(a);
          if (wholeArm || inside === ((b.p.y-waist)*side >= 0)) continue;
          const t = (waist-a.p.y)/(b.p.y-a.p.y), p = a.p.clone().lerp(b.p,t); p.y = waist;
          polygon.push({p, n:a.n.clone().lerp(b.n,t).normalize(), uv:a.uv.map((x,j)=>x+(b.uv[j]-x)*t), color:a.color.map((x,j)=>x+(b.color[j]-x)*t), arm:0}); crossing.push(p);
        }
        if (crossing.length === 2) edges.push(crossing);
        const start = positions.length/3;
        for (let k = 1; k < polygon.length-1; k++) for (const v of [polygon[0],polygon[k],polygon[k+1]]) push(v);
        const count = positions.length/3-start;
        if (count && Array.isArray(object.material)) {
          const materialIndex = geometry.groups.find(g=>i>=g.start && i<g.start+g.count)?.materialIndex ?? 0;
          const last = groups.at(-1); if (last && last.materialIndex === materialIndex) last.count += count; else groups.push({start,count,materialIndex});
        }
      }
      const make = (p: number[], n: number[], u: number[]) => {
        const g = new BufferGeometry(); g.setAttribute('position',new Float32BufferAttribute(p,3)); g.setAttribute('normal',new Float32BufferAttribute(n,3)); g.setAttribute('uv',new Float32BufferAttribute(u,2)); return g;
      };
      if (positions.length) {
        const g = make(positions,normals,uvs); if (colors.length) g.setAttribute('color',new Float32BufferAttribute(colors,3));
        for (const entry of groups) g.addGroup(entry.start,entry.count,entry.materialIndex);
        const mesh = new Mesh(g,object.material); mesh.name = object.name; mesh.userData.openedWeapon = attachment; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; half.add(mesh);
      }
      if (edges.length) {
        const center = new Vector3(); for (const edge of edges) for (const p of edge) center.add(p); center.divideScalar(edges.length*2);
        const p: number[] = [], n: number[] = [], u: number[] = [], tone: number[] = [];
        for (const edge of edges) for (const v of [center,...edge]) { p.push(v.x,halfIndex ? 0 : waist,v.z); n.push(0,-side,0); u.push(v.x,v.z); const shade = v === center ? .9 : .5+.12*Math.sin(v.x*170+v.z*113); tone.push(shade,shade,shade); }
        const interior = make(p,n,u); interior.setAttribute('color',new Float32BufferAttribute(tone,3));
        const mesh = new Mesh(interior,cut); mesh.name = 'WaistCut'; mesh.castShadow = true; half.add(mesh);
      }
    }
  });
  const size = new Box3().setFromObject(lower).getSize(new Vector3()), scale = waist/1;
  const smooth = (p: number, start: number, end: number) => { const t = Math.max(0,Math.min(1,(p-start)/(end-start))); return t*t*(3-2*t); };
  // Find the broad resting face around the torso's long axis. A fixed roll can balance a different rig on a
  // planted hand or the end of its polearm; the lowest waist support gives the body a weighted final landing.
  const rest = new Quaternion(); let best = Infinity;
  for (let i=-32;i<=32;i++) {
    const angle=i*Math.PI/32, q=new Quaternion().setFromEuler(new Euler(-Math.PI/2,angle,0));
    const m=new Matrix4().makeRotationFromQuaternion(q).elements, points=supports[1]; let min=Infinity;
    for(let j=0;j<points.length;j+=3)min=Math.min(min,m[1]*points[j]+m[5]*points[j+1]+m[9]*points[j+2]);
    const score=-min+.015*(1-Math.cos(angle));
    if(score<best){best=score;rest.copy(q);}
  }
  function place(progress: number) {
    const slide = smooth(progress,.045,.3), fall = smooth(progress,.2,.66), legs = smooth(progress,.36,.84);
    upper.position.set(.5*scale*slide,waist*(1-fall),.12*scale*slide);
    upper.quaternion.identity().slerp(rest,fall);
    lower.position.set(-.1*scale*legs,0,-.12*scale*legs); lower.rotation.set(.08*legs,0,1.52*legs);
  }
  // Precompute exact support heights once. Per-frame playback interpolates a tiny table; no per-frame vertex scan.
  const floors = [[],[]] as number[][];
  for (let i=0;i<=120;i++) {
    place(i/120);
    for (const [h,half] of [lower,upper].entries()) {
      const m = new Matrix4().makeRotationFromQuaternion(half.quaternion).elements, points = supports[h]; let min = Infinity;
      for (let j=0;j<points.length;j+=3) min = Math.min(min,m[1]*points[j]+m[5]*points[j+1]+m[9]*points[j+2]);
      floors[h].push(.008-min);
    }
  }
  supports[0].length = supports[1].length = 0;
  return {
    group, waist, size,
    update(progress: number, dark: boolean) {
      const p = Math.max(0,Math.min(1,progress)); place(p);
      for (const [h,half] of [lower,upper].entries()) {
        const at = p*120, i = Math.min(119,Math.floor(at)), floor = floors[h][i]+(floors[h][i+1]-floors[h][i])*(at-i);
        half.position.y = Math.max(half.position.y,floor);
      }
      cut.color.set(dark ? '#302126' : '#501c20');
    },
    dispose() { group.removeFromParent(); group.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();}); cut.dispose(); }
  };
}
