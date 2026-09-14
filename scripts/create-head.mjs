// KeenTools Cloud API: five portraits → reconstructed textured head (GLB). Billed: /process and the one /get-3d-model
// redirect. Key from KEENTOOLS_API_KEY (never logged). Usage: node scripts/create-head.mjs out_dir img1 img2 ...
import fs from 'node:fs/promises';
import path from 'node:path';
const API = 'https://api.keentools.io';
const key = process.env.KEENTOOLS_API_KEY;
if (!key) throw new Error('KEENTOOLS_API_KEY missing');
const args = process.argv.slice(2);
const existing = args.indexOf('--avatar') >= 0 ? args.splice(args.indexOf('--avatar'), 2)[1] : null; // reuse an avatar whose photos are uploaded
const [outDir, ...images] = args;
const auth = { Authorization: `Bearer ${key}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(method, route, body, query = '') {
  const r = await fetch(`${API}${route}${query}`, { method, headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${route} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
await fs.mkdir(outDir, { recursive: true });
const init = existing ? { avatar_id: existing, img_urls: [] } : await api('POST', '/v1/avatar/init', { image_count: images.length });
console.log('avatar', init.avatar_id, 'upload urls', init.img_urls.length);
for (const [i, img] of (existing ? [] : images).entries()) {
  const bytes = await fs.readFile(img);
  const put = await fetch(init.img_urls[i], { method: 'PUT', headers: { 'Content-Type': img.endsWith('.png') ? 'image/png' : 'image/jpeg' }, body: bytes });
  if (!put.ok) throw new Error(`upload ${img} → ${put.status}`);
  console.log('uploaded', path.basename(img), bytes.length);
}
await api('POST', `/v1/avatar/${init.avatar_id}/process`, { focal_length_type: { focal_length_type: 'estimate_common' }, expressions_enabled: false }); // adjacently tagged enum
console.log('processing started');
for (;;) {
  const s = await api('GET', `/v1/avatar/${init.avatar_id}/get-status`);
  console.log('status', s.status, s.data?.progress ?? '', s.data?.error_message ?? '');
  if (s.status === 'completed') break;
  if (s.status === 'failed' || s.status === 'deleted') throw new Error(`reconstruction ${s.status}: ${s.data?.error_message ?? ''}`);
  await sleep(10000);
}
const info = await api('GET', `/v1/avatar/${init.avatar_id}/get-info`);
await fs.writeFile(path.join(outDir, `${init.avatar_id}.info.json`), JSON.stringify(info, null, 1));
console.log('info: focal', info.focal_length_type, 'cameras', info.camera_positions?.length);
// One billed redirect only: stop polling the moment it arrives.
let url;
for (;;) {
  const m = await api('GET', `/v1/avatar/${init.avatar_id}/get-3d-model`, null, '?mesh_format=glb&mesh_lod=high_poly&texture=png&edges=false');
  if (m.event === 'retry-after') { console.log('model: retry in', m.data.time_sec, 's'); await sleep(Math.max(2, m.data.time_sec) * 1000); continue; }
  url = m.data.url; break;
}
const glb = Buffer.from(await (await fetch(url)).arrayBuffer());
const out = path.join(outDir, `${init.avatar_id}.glb`);
await fs.writeFile(out, glb);
console.log('DONE', out, glb.length, 'bytes');
