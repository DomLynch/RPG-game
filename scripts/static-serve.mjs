// Tiny static server for a built dist (vite preview serves no kit): node scripts/static-serve.mjs <dir> <port>. Directory URLs serve index.html; gzip on the text types, as nginx does.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const [root, port] = [path.resolve(process.argv[2]), +process.argv[3]];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/x-m4a', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.glb': 'application/octet-stream' };
const GZ = new Set(['.html', '.js', '.css', '.json', '.svg', '.glb']);
http.createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, path.normalize(pn === '/zone1/' ? '/preview/origins/index.html' : pn));   // nginx: location = /zone1/ -> /preview/origins/index.html
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  const ext = path.extname(f), body = fs.readFileSync(f), gz = GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', ...(gz ? { 'content-encoding': 'gzip' } : {}), 'cache-control': 'no-store' });
  res.end(gz ? zlib.gzipSync(body, { level: 1 }) : body);
}).listen(port, '127.0.0.1');
