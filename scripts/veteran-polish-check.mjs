// Material source-to-shipped check + actual GLB renders. --before <glb> also audits isolation and makes matched comparison PNGs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2), before = args.includes('--before') ? args[args.indexOf('--before') + 1] : null;
const dir = 'artifacts/character/veteran-polish', root = 'src/assets/source/materials';
await fs.mkdir(dir, { recursive: true });
function parse(raw) {
  const size = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + size));
  const bin = raw.subarray(28 + size);
  return { doc, bin, view: i => { const v = doc.bufferViews[i], start = v.byteOffset ?? 0; return bin.subarray(start, start + v.byteLength); } };
}
const shipped = process.argv.includes('--file') ? args[args.indexOf('--file') + 1] : 'src/assets/veteran.glb';
const bytes = await fs.readFile(shipped), current = parse(bytes), manifest = JSON.parse(await fs.readFile(`${root}/manifest_veteran.json`));
const changes = new Set();
for (const name of ['Bronze', 'Leather', 'Gambeson', 'Photo', 'Face']) {
  const m = current.doc.materials.find(m => m.name === name), p = m.pbrMetallicRoughness;
  for (const [key, info] of [['baseColor', p.baseColorTexture], ['normal', m.normalTexture], ['metallicRoughness', p.metallicRoughnessTexture]]) {
    const image = current.doc.images[current.doc.textures[info.index].source]; changes.add(image.bufferView);
    assert.deepEqual(current.view(image.bufferView), await fs.readFile(`${root}/${manifest[name][key]}`), `${name}.${key} is the reviewed source map`);
  }
  assert.equal(m.normalTexture.scale, manifest[name].normalScale);
}
const receipt = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, gzip: gzipSync(bytes).length, materialSourceParity: true };
if (before) {
  const old = parse(await fs.readFile(before));
  for (const key of ['nodes', 'skins', 'meshes', 'animations', 'textures', 'images', 'samplers']) assert.deepEqual(current.doc[key], old.doc[key], key);
  const neckAccessors = new Set();
  function rows(asset,id) {
    const a=asset.doc.accessors[id],v=asset.doc.bufferViews[a.bufferView],width={VEC3:3,VEC4:4}[a.type];
    const [size,read]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5126:[4,'readFloatLE']}[a.componentType];
    return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>asset.bin[read]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width)+k*size)));
  }
  const body=current.doc.meshes.flatMap(m=>m.primitives).find(p=>current.doc.materials[p.material].name==='Face');
  const cut=current.doc.accessors[body.attributes.POSITION].max[1];
  for(const mesh of current.doc.meshes) for(const p of mesh.primitives) {
    if(!['Photo','Face'].includes(current.doc.materials[p.material].name)) continue;
    const name=current.doc.materials[p.material].name,positions=rows(old,p.attributes.POSITION);
    for(const key of ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0']) {
      const id=p.attributes[key];neckAccessors.add(id);
      const a=rows(current,id),b=rows(old,id);
      for(let i=0;i<positions.length;i++) {
        const v=positions[i],collar=name==='Photo'?v[1]>=cut-.00003&&v[1]<cut+.0551&&v[2]<.1232:v[1]>cut-.0151;
        if(!collar)assert.deepEqual(a[i],b[i],`${name} ${key} outside neck ${i}`);
      }
    }
  }
  assert.equal(current.doc.accessors.length,old.doc.accessors.length);
  for(let i=0;i<old.doc.accessors.length;i++) {
    const a=structuredClone(current.doc.accessors[i]),b=structuredClone(old.doc.accessors[i]);
    if(neckAccessors.has(i)) { changes.add(a.bufferView);delete a.min;delete a.max;delete b.min;delete b.max; }
    assert.deepEqual(a,b,`accessor ${i}`);
  }
  for (let i = 0; i < old.doc.bufferViews.length; i++) if (!changes.has(i)) assert.ok(current.view(i).equals(old.view(i)), `unchanged payload ${i}`);
  for (let i = 0; i < old.doc.materials.length; i++) if (old.doc.materials[i].name!=='TridentBronze') assert.deepEqual(current.doc.materials[i], old.doc.materials[i]);
  receipt.rigAnimationUvIndicesAndUnrelatedSurfacesExact = true;

}
if(args.includes('--cpu-only')) { console.log(JSON.stringify(receipt)); process.exit(0); }
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  page.on('console', message => { if(message.type()==='error')errors.push(message.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  const shots = {};
  for (const [label, file] of [...(before ? [['before', before]] : []), ['after', shipped]]) {
    await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?enemy=/${file}`);
    await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__preview.error), null);
    shots[label] = await page.evaluate(async () => {
      const api = window.__preview;
      return {
        weapon: await api.details([['Trident bronze', 'Trident_Idle', 0, 'WeaponDrawn', 1.0, .6, .25], ['Trident side', 'Trident_Idle', 0, 'WeaponDrawn', 1.0, 1.3, .35]], 'opponent', { columns: 2, width: 600, height: 760 }),
        neck: await api.details([['Neck front', 'Trident_Idle', 0, 'Head', .68, .55, .0, [0,-.07,0]], ['Neck side', 'Trident_Idle', 0, 'Head', .68, 1.5, .0, [0,-.07,0]], ['Neck rear', 'Trident_Idle', 0, 'Head', .68, 2.8, .0, [0,-.07,0]]], 'opponent', { columns: 3, width: 600, height: 760 }),
        portrait: await api.details([['Full fighter', 'Trident_Idle', 0, 'pelvis', 4.05, .32, .05, [0, -.02, 0]]], 'opponent', { columns: 1, width: 840, height: 1120 }),
        detail: await api.details([['Bronze and face', 'Trident_Idle', 0, 'Head', .98, .55, .12], ['Linen and leather', 'Trident_Idle', 0, 'spine_03', 1.4, .45, .12, [0, -.13, 0]], ['Greaves', 'Trident_Idle', 0, 'foot_r', 1.5, .6, .22, [0, .25, 0]]], 'opponent', { columns: 3, width: 520, height: 640 }),
        phone: await api.weaponLock('phoneLandscape', 'idle', 0),
        motion: await api.details([['Thrust', 'Trident_Thrust', .5, 'pelvis', 4.2, .5, .05], ['High guard', 'Trident_Guard', .6, 'pelvis', 4.2, .5, .05], ['Low sweep', 'Trident_Sweep', .5, 'pelvis', 4.2, .5, .05], ['Rear', 'Trident_Idle', 0, 'pelvis', 4.2, 3.1, .05]], 'opponent'),
      };
    });
    for (const [name, data] of Object.entries(shots[label])) await fs.writeFile(`${dir}/${label}-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  if (before) for (const kind of ['portrait', 'detail', 'phone', 'neck', 'weapon']) {
    // Only layout/caption the two unretouched WebGL captures. No relighting or image enhancement of the comparison.
    const data = await page.evaluate(async ([a, b, vertical]) => {
      const load = src => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = src; });
      const [left, right] = await Promise.all([load(a), load(b)]), c = document.createElement('canvas'), h = 54;
      c.width = left.width * (vertical ? 1 : 2); c.height = (left.height + h) * (vertical ? 2 : 1);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#202326'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#f3ebdf'; ctx.font = '24px system-ui';
      for (const [i, image] of [left, right].entries()) {
        const x = vertical ? 0 : i * left.width, y = vertical ? i * (left.height + h) : 0;
        ctx.fillText(i ? 'AFTER · Veteran neck and surface finish' : 'BEFORE · Existing Veteran', x + 20, y + 36);
        ctx.drawImage(image, x, y + h);
      }
      return c.toDataURL('image/png');
    }, [shots.before[kind], shots.after[kind], ['detail','neck','weapon'].includes(kind)]);
    await fs.writeFile(`${dir}/comparison-${kind}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  assert.deepEqual(errors, []);
  receipt.renderErrors = errors; receipt.passed = true;
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  await browser?.close(); await server.close();
}
