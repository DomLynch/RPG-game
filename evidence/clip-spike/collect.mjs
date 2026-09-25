// Serves probe.html (and, with a dir argument, a built dist beside it) on 0.0.0.0 so the iOS Simulator and desktop Safari can reach it;
// collects each browser's report JSON and clip into evidence/clip-spike/out/. Usage: node evidence/clip-spike/collect.mjs [dist-dir] [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), dist = process.argv[2], port = Number(process.argv[3] ?? 4321), outDir = path.join(here, 'out'); fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), name = (u.searchParams.get('name') || 'unknown').replace(/[^\w.-]/g, '_');
  if (req.method === 'POST' && u.pathname === '/report') { let b = ''; req.on('data', d => b += d); req.on('end', () => { fs.writeFileSync(path.join(outDir, name + '.json'), b); console.log('report', name, b.slice(0, 200)); res.end('ok'); }); return; }
  if (req.method === 'PUT' && u.pathname === '/clip') { const ext = (u.searchParams.get('ext') || 'bin').replace(/\W/g, ''), f = fs.createWriteStream(path.join(outDir, name + '.' + ext)); req.pipe(f); f.on('finish', () => { console.log('clip', name, ext, f.bytesWritten); res.end('ok'); }); return; }
  let file = u.pathname === '/probe' || u.pathname === '/probe.html' ? path.join(here, 'probe.html') : dist ? path.join(dist, u.pathname === '/' ? 'index.html' : u.pathname) : null;
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = dist ? path.join(dist, 'index.html') : path.join(here, 'probe.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`collector on http://127.0.0.1:${port}/probe  (dist: ${dist ?? 'none'})`));
