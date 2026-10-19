// Static server for a production build of the origins page, laid out as the live site is: the bundle under /preview/origins/ (and /zone1/),
// and the repo's public/ folder at the root (the kit and creature GLBs are absolute /world/... and /beasts/... URLs). No dependencies.
// Usage: node serve-built.mjs <repoRoot> <port>
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const [ROOT, PORT = '5194'] = process.argv.slice(2);
const BUILD = join(ROOT, 'artifacts/origins-preview'), PUBLIC = join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const send = async (res, file) => { try { const s = await stat(file); if (s.isDirectory()) return send(res, join(file, 'index.html')); const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-cache' }); res.end(body); return true; } catch { return false; } };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/\.\./g, '');
  const m = path.match(/^\/(preview\/origins|zone1)(\/.*)?$/);
  if (m) { if (await send(res, join(BUILD, m[2] || '/'))) return; }
  else if (await send(res, join(PUBLIC, path))) return;
  console.log('404', path); res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + path);
}).listen(+PORT, '127.0.0.1', () => console.log(`serving ${BUILD} at /preview/origins/ and ${PUBLIC} at / on http://127.0.0.1:${PORT}`));
