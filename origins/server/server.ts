// POST /origins/<op> with `Authorization: Bearer <supabase access token>` and a JSON body. Answers { ok: true, result } or { ok: false, error }.
// Bind it to 127.0.0.1 behind nginx; the browser never talks to Postgres and never names an account.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Verify } from './auth.ts';
import { DbError, type Db } from './db.ts';
import { Refused } from './errors.ts';
import { BadRequest, Conflict, handlers as defaults, type Handler } from './handlers.ts';
import { internalRoute, type InternalOptions } from './location.ts';

const MAX_BODY = 64 * 1024;
const STATUS: Record<string, number> = { O0007: 403, O0008: 409, O0002: 409, O0001: 409, O0009: 409, O0014: 409, '23505': 409 };

// Past the cap the rest of the body is read and dropped (never buffered), then refused: the client still gets its 400 on the open socket.
const readBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  let size = 0; const parts: Buffer[] = [];
  req.on('data', (c: Buffer) => { size += c.length; if (size <= MAX_BODY) parts.push(c); });
  req.on('end', () => (size > MAX_BODY ? reject(new BadRequest('body too large')) : resolve(Buffer.concat(parts).toString('utf8'))));
  req.on('error', reject);
});

// `internal`: the shared key presence presents on the writer's internal routes (origins/server/location.ts, X2 Stage 2). Unset: those routes do not exist.
export function createWriter({ db, verify, handlers = defaults, internal }: { db: Db; verify: Verify; handlers?: Record<string, Handler>; internal?: InternalOptions }): Server {
  const inside = internal ? internalRoute(db, internal) : null;
  return createServer(async (req, res) => {
    const send = (code: number, body: unknown): void => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (inside && (req.url ?? '').startsWith('/internal/')) return void inside(req, res);
    try {
      const op = /^\/origins\/([a-z_]{1,32})$/.exec(req.url ?? '')?.[1];
      if (req.method !== 'POST' || !op || !Object.hasOwn(handlers, op)) return send(404, { ok: false, error: 'not found' });
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
      const account = token ? await verify(token) : null;
      if (!account) return send(401, { ok: false, error: 'sign in' });
      let body: unknown = {};
      const text = await readBody(req);
      if (text) { try { body = JSON.parse(text); } catch { throw new BadRequest('body is not JSON'); } }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequest('body must be an object');
      send(200, { ok: true, result: await handlers[op]({ db, account }, body as Record<string, unknown>) });
    } catch (e) {
      if (e instanceof BadRequest) return send(400, { ok: false, error: e.message });
      if (e instanceof Conflict) return send(409, { ok: false, error: e.message, code: 'op-conflict' });
      if (e instanceof Refused) return send(e.status, e.code === undefined ? { ok: false, error: e.message } : { ok: false, error: e.message, code: e.code });
      if (e instanceof DbError && STATUS[e.code]) return send(STATUS[e.code], { ok: false, error: e.code === '23505' ? 'already exists' : e.message, code: e.code });
      console.error('origins-writer:', e instanceof Error ? e.message : e);
      send(500, { ok: false, error: 'server error' });
    }
  });
}
