// Offline collar fitting in final rig space. Facial features, indices and clips stay intact.
import assert from 'node:assert/strict';

function pack(doc, bin) {
  const text = Buffer.from(JSON.stringify(doc)), json = Buffer.concat([text, Buffer.alloc(-text.length & 3, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+bin.length,8); header.writeUInt32LE(json.length,12); header.writeUInt32LE(0x4e4f534a,16);
  const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(bin.length); binaryHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,json,binaryHeader,bin]);
}

export function textureVeteranTrident(glb) {
  const length = glb.readUInt32LE(12), doc = JSON.parse(glb.subarray(20,20+length));
  const bronze = doc.materials.find(m => m.name === 'Bronze'), weapon = doc.materials.find(m => m.name === 'TridentBronze');
  assert.ok(bronze?.normalTexture && bronze.pbrMetallicRoughness.baseColorTexture && weapon);
  // Share the reviewed maps, so the finish costs no extra texture download or allocation.
  weapon.pbrMetallicRoughness = structuredClone(bronze.pbrMetallicRoughness);
  weapon.normalTexture = {...bronze.normalTexture, scale:.35};
  return pack(doc,glb.subarray(28+length));
}

export function fitVeteranNeck(glb) {
  const length = glb.readUInt32LE(12), doc = JSON.parse(glb.subarray(20, 20 + length));
  if (doc.asset.extras?.veteranNeckVersion === 1) return { glb, receipt: { alreadyFitted: true } };
  const bin = Buffer.from(glb.subarray(28 + length));
  const primitive = name => doc.meshes.flatMap(m => m.primitives).find(p => doc.materials[p.material].name === name);
  const data = index => {
    const a = doc.accessors[index], v = doc.bufferViews[a.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
    const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? bytes * width;
    return { a, values: Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) => bin[read](offset + i * stride + k * bytes))),
      write(values) { const write = {5126:'writeFloatLE',5123:'writeUInt16LE',5121:'writeUInt8'}[a.componentType]; assert.ok(write); values.forEach((row, i) => row.forEach((x, k) => { assert.ok(Number.isFinite(x)); bin[write](x, offset + i * stride + k * bytes); })); } };
  };
  const photo = primitive('Photo'), face = primitive('Face');
  assert.ok(photo && face, 'Veteran requires the scanned head and original neck');
  const head = data(photo.attributes.POSITION), neck = data(face.attributes.POSITION);
  const normal = data(photo.attributes.NORMAL), neckNormal = data(face.attributes.NORMAL);
  const joints = p => doc.skins[doc.nodes.find(n => n.mesh === doc.meshes.findIndex(m => m.primitives.includes(p))).skin].joints;
  const headJoints = joints(photo), neckJoints = joints(face);
  const headIndex = data(photo.attributes.JOINTS_0), headWeight = data(photo.attributes.WEIGHTS_0);
  const neckIndex = data(face.attributes.JOINTS_0).values, neckWeight = data(face.attributes.WEIGHTS_0).values;
  const denseWeights = neckWeight.map((row,i) => {
    const out = Array(headJoints.length).fill(0);
    row.forEach((w,k) => { const index = headJoints.indexOf(neckJoints[neckIndex[i][k]]); assert.ok(index >= 0); out[index] += w; });
    return out;
  });
  const indices = p => data(p.indices).values.map(v => v[0]);
  const headTriangles = indices(photo), neckTriangles = indices(face);
  const original = head.values.map(v => [...v]);
  const cut = Math.max(...neck.values.map(v => v[1])) - .0015;
  const top = neck.values.filter(v => v[1] > cut + .0014);
  const axis = [0, 2].map(k => (Math.min(...top.map(v => v[k])) + Math.max(...top.map(v => v[k]))) / 2);
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const unit = v => { const d = Math.hypot(...v); assert.ok(d > 1e-9); return v.map(x => x / d); };
  function section(points, triangles, height, normals, weights, allowGap = false) {
    const segments = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const hits = [];
      for (let e = 0; e < 3; e++) {
        const ia = triangles[i + e], ib = triangles[i + (e + 1) % 3], a = points[ia], b = points[ib];
        if ((a[1] <= height && b[1] > height) || (b[1] <= height && a[1] > height)) {
          const t = (height - a[1]) / (b[1] - a[1]);
          hits.push({ p: [0, 2].map(k => a[k] + (b[k] - a[k]) * t - axis[k === 0 ? 0 : 1]),
            n: normals && normals[ia].map((x, k) => x + (normals[ib][k] - x) * t),
            w: weights && weights[ia].map((x,k) => x + (weights[ib][k]-x)*t) });
        }
      }
      if (hits.length === 2) segments.push(hits);
    }
    return direction => {
      const hits = [];
      for (const [a, b] of segments) {
        const edge = b.p.map((x, k) => x - a.p[k]), divisor = cross(direction, edge);
        if (Math.abs(divisor) < 1e-10) continue;
        const radius = cross(a.p, edge) / divisor, t = cross(a.p, direction) / divisor;
        if (radius > 0 && t >= -1e-6 && t <= 1.000001) hits.push({ radius, normal: a.n && unit(a.n.map((x, k) => x + (b.n[k] - x) * t)), weights: a.w && a.w.map((x,k) => x+(b.w[k]-x)*t) });
      }
      if(!hits.length && allowGap) {
        const nearest=segments.flat().map(v=>({radius:Math.hypot(...v.p),angle:Math.acos(Math.max(-1,Math.min(1,(v.p[0]*direction[0]+v.p[1]*direction[1])/Math.hypot(...v.p))))})).sort((a,b)=>a.angle-b.angle)[0];
        assert.ok(nearest?.angle<.35,'Only bridge narrow source holes beneath helmet');
        hits.push({radius:nearest.radius});
      }
      assert.ok(hits.length, `No neck section at ${height}: ${direction}`);
      return hits.sort((a, b) => a.radius - b.radius)[0];
    };
  }
  const rim = section(neck.values, neckTriangles, cut, neckNormal.values, denseWeights);
  const upperRim = section(neck.values, neckTriangles, cut + .00149);
  const collarRows = denseWeights.filter((_,i) => neck.values[i][1] > cut-.002);
  const collarWeights = Array.from({length:headJoints.length},(_,j) => collarRows.reduce((sum,w)=>sum+w[j],0)/collarRows.length);
  // One common blend around the circumference prevents separately sampled skin weights
  // from opening the seam when Head and neck_01 rotate differently.
  const collarKept = collarWeights.map((w,j)=>[w,j]).sort((a,b)=>b[0]-a[0]).slice(0,4);
  const collarSum = collarKept.reduce((sum,v)=>sum+v[0],0);collarWeights.fill(0);
  for(const [w,j] of collarKept)collarWeights[j]=w/collarSum;
  const ring = original.filter(v => Math.abs(v[1]-cut) < .00003).map(v => ({
    angle: Math.atan2(v[2]-axis[1], v[0]-axis[0]), radius: Math.hypot(v[0]-axis[0],v[2]-axis[1]),
  })).sort((a,b) => a.angle-b.angle);
  assert.ok(ring.length > 100, 'Recognized original cut ring');
  function oldRim(direction) {
    let angle = Math.atan2(direction[1],direction[0]);
    const index = ring.findIndex(p => p.angle > angle);
    const a = index <= 0 ? ring.at(-1) : ring[index-1], b = index < 0 ? ring[0] : ring[index];
    let end = b.angle; if (end <= a.angle) end += 2*Math.PI;
    if (angle < a.angle) angle += 2*Math.PI;
    const t = (angle-a.angle)/(end-a.angle);
    return { radius: a.radius+(b.radius-a.radius)*t };
  }
  // Bridge the neck's pinched collar to the nape with a continuous contour.
  // The front jaw stays outside this sculpting band.
  const lowerHeight=cut-.015, upperHeight=cut+.055;
  function smoothSection(height,points,triangles,allowGap=false) {
    const ray=section(points,triangles,height,null,null,allowGap),count=128;
    let radii=Array.from({length:count},(_,i)=>ray([Math.cos(i*2*Math.PI/count),Math.sin(i*2*Math.PI/count)]).radius);
    for(let pass=0;pass<6;pass++)radii=radii.map((v,i)=>(radii[(i+count-1)%count]+2*v+radii[(i+1)%count])/4);
    return d=>{const t=((Math.atan2(d[1],d[0])+2*Math.PI)%(2*Math.PI))*count/(2*Math.PI),i=Math.floor(t);return {radius:radii[i]*(1-(t-i))+radii[(i+1)%count]*(t-i)};};
  }
  const lower=smoothSection(lowerHeight,neck.values,neckTriangles);
  const lowerNext=smoothSection(lowerHeight+.004,neck.values,neckTriangles);
  const upper=smoothSection(upperHeight,original,headTriangles,true);
  const upperNext=smoothSection(upperHeight+.004,original,headTriangles,true);
  function contour(direction,height) {
    const a=lower(direction).radius,b=upper(direction).radius,span=upperHeight-lowerHeight;
    const slopeA=Math.max(-.6,Math.min(.6,(lowerNext(direction).radius-a)/.004));
    const slopeB=Math.max(-.6,Math.min(.6,(upperNext(direction).radius-b)/.004));
    const t=Math.max(0,Math.min(1,(height-lowerHeight)/span));
    return (2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*span*slopeA+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*span*slopeB;
  }
  const sculptBlend = d => 1-smooth((d[1]-.05)/.5);
  const collarRadius = d => rim(d).radius+(contour(d,cut)-rim(d).radius)*sculptBlend(d);
  function collarNormal(d) {
    const angle=Math.atan2(d[1],d[0]),epsilon=.0001;
    const directions=[angle-epsilon,angle+epsilon].map(a=>[Math.cos(a),Math.sin(a)]);
    const points=directions.map(v=>v.map(x=>x*collarRadius(v)));
    const tangent=points[1].map((x,k)=>(x-points[0][k])/(2*epsilon));
    const slope=(contour(d,cut+.0001)-contour(d,cut-.0001))/.0002;
    const n=unit([tangent[1],-slope*(tangent[1]*d[0]-tangent[0]*d[1]),-tangent[0]]);
    const blend=sculptBlend(d),old=rim(d).normal;
    return unit(n.map((x,k)=>x*blend+old[k]*(1-blend)));
  }
  // Remove the old 1.5 mm overlap: it leaves a raised lip even after fitting the head.
  const faceIndex = data(face.attributes.JOINTS_0), faceWeight = data(face.attributes.WEIGHTS_0);
  let neckVertices = 0;
  for (let i=0;i<neck.values.length;i++) {
    const v = neck.values[i], blend = smooth((v[1]-lowerHeight)/(cut+.0015-lowerHeight)), weightBlend=blend;if(weightBlend===0)continue;
    const direction = unit([v[0]-axis[0],v[2]-axis[1]]), hit = rim(direction);
    const baseRadius = Math.hypot(v[0]-axis[0],v[2]-axis[1])+(hit.radius-upperRim(direction).radius)*blend;
    const radius=blend===0?baseRadius:baseRadius+(contour(direction,v[1]-.0015*blend)-baseRadius)*sculptBlend(direction)*smooth((v[1]-lowerHeight)/.006);
    neck.values[i] = [axis[0]+direction[0]*radius,v[1]-.0015*blend,axis[1]+direction[1]*radius];
    neckNormal.values[i] = unit(neckNormal.values[i].map((x,k)=>x*(1-blend)+collarNormal(direction)[k]*blend));
    const kept = collarWeights.map((w,j) => [w*weightBlend+denseWeights[i][j]*(1-weightBlend),neckJoints.indexOf(headJoints[j])]).filter(v => v[1]>=0).sort((a,b) => b[0]-a[0]).slice(0,4), sum=kept.reduce((s,v)=>s+v[0],0);
    faceIndex.values[i]=kept.map(v=>v[1]);faceWeight.values[i]=kept.map(v=>v[0]/sum);neckVertices++;
  }
  const fittedRim=section(neck.values,neckTriangles,cut-.000001,neckNormal.values);
  const affected = new Map();
  for (let i = 0; i < original.length; i++) {
    const v = original[i], depth = v[1] - cut;
    if (depth < -.00003 || depth > .0551) continue;
    const direction = unit([v[0] - axis[0], v[2] - axis[1]]);
    // Preserve the front chin; give the side and nape enough length for a continuous taper.
    const band = .055 - .043 * smooth((direction[1] - .35) / .4);
    if (depth >= band) continue;
    const t = Math.max(0, depth / band), bottom = {...rim(direction),normal:fittedRim(direction).normal};
    const originalRadius = Math.hypot(v[0]-axis[0], v[2]-axis[1]);
    const chinKeep = direction[1] > .5 ? 1-smooth((originalRadius-bottom.radius-.014)/.012) : 1;
    if (chinKeep === 0) continue;
    const radius = originalRadius + (bottom.radius - oldRim(direction).radius)*(1-smooth(t));
    assert.ok(radius > .02 && radius < .2, 'Bounded anatomical collar');
    const sculpt=sculptBlend(direction)*(1-smooth((t-.7)/.3));
    const target=radius+(contour(direction,v[1])-radius)*sculpt+(fittedRim(direction).radius-collarRadius(direction))*(1-smooth(Math.max(0,depth)/.012));
    const fittedRadius = originalRadius + (target-originalRadius)*chinKeep;
    head.values[i] = [axis[0] + direction[0]*fittedRadius, v[1], axis[1] + direction[1]*fittedRadius];
    affected.set(i, { t, bottom, chinKeep });
    const blend = (1-smooth(t))*chinKeep;
    if (blend > 0) {
      const weights = collarWeights.map(w => w*blend);
      headWeight.values[i].forEach((w,k) => { weights[headIndex.values[i][k]] += w*(1-blend); });
      const kept = weights.map((w,j) => [w,j]).sort((a,b) => b[0]-a[0]).slice(0,4), sum = kept.reduce((s,v) => s+v[0],0);
      headIndex.values[i] = kept.map(v => v[1]); headWeight.values[i] = kept.map(v => v[0]/sum);
    }
  }
  // Area-weighted smooth normals, welded across existing UV splits without changing topology.
  const sums = new Map(), key = v => v.map(x => x.toFixed(6)).join(',');
  for (let i = 0; i < headTriangles.length; i += 3) {
    const ids = headTriangles.slice(i, i + 3), [a, b, c] = ids.map(k => head.values[k]);
    const u = b.map((x,k) => x-a[k]), v = c.map((x,k) => x-a[k]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    for (const id of ids) { const k = key(head.values[id]), sum = sums.get(k) ?? [0,0,0]; sums.set(k, sum.map((x,k) => x+n[k])); }
  }
  for (const [i, { t, bottom, chinKeep }] of affected) {
    const computed = unit(sums.get(key(head.values[i]))), blend = smooth(t / .45), keep=smooth(t);
    const softened=computed.map((x,k)=>x*(1-keep)+normal.values[i][k]*keep);
    normal.values[i] = unit(softened.map((x,k) => (bottom.normal[k]*(1-blend)+x*blend)*chinKeep+normal.values[i][k]*(1-chinKeep)));
  }
  neck.write(neck.values);neckNormal.write(neckNormal.values);faceIndex.write(faceIndex.values);faceWeight.write(faceWeight.values);
  neck.a.min = [0,1,2].map(k => Math.min(...neck.values.map(v => v[k])));
  neck.a.max = [0,1,2].map(k => Math.max(...neck.values.map(v => v[k])));
  head.write(head.values); normal.write(normal.values); headIndex.write(headIndex.values); headWeight.write(headWeight.values);
  head.a.min = [0,1,2].map(k => Math.min(...head.values.map(v => v[k])));
  head.a.max = [0,1,2].map(k => Math.max(...head.values.map(v => v[k])));
  const maxMove = Math.max(...[...affected.keys()].map(i => Math.hypot(...head.values[i].map((x,k) => x-original[i][k]))));
  assert.ok(maxMove < .03, 'Bounded neck contour correction');
  doc.asset.extras = {...doc.asset.extras, veteranNeckVersion:1};
  return { glb: pack(doc,bin), receipt: { vertices: affected.size, neckVertices, maxMove, cut, axis } };
}
