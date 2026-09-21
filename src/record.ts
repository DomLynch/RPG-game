// The fight record (beta plan brief 3, owner 2026-09-21): one fight, replayable anywhere. A pure module — no DOM, no renderer — so a
// browser, a Node gate and a server can all record, encode, decode and (in the next slice) replay the same fight. The duel is
// deterministic given the warden's seed and the player's Intent per tick (src/duel.ts stepDuel uses no other randomness), so the
// record is exactly that: who fought, which seed, and every intent the player fed the simulation, quantized so that what the live
// game stepped and what a replay steps are the same bits.
//
// Encoding: a versioned binary (version FIRST; an unknown version is refused, never best-effort decoded) — header, then columnar
// per-tick bytes (stick x, stick z, camera-yaw delta, action, guard side, flags) — gzipped and base64url'd. Columns of mostly
// repeated or zero bytes gzip well: a 30 s fight (1,800 ticks) lands well under 2 KB (tests/record.test.ts measures a real one).
// Nothing here talks to the network; recording stays in memory until a later slice's Share.
import type { Action, Intent } from './duel.ts';
import { WEAPONS, type Direction, type WeaponId } from './moves.ts';
import type { OpponentId } from './roster.ts';

export const RECORD_VERSION = 3;   // 2: the player's weapon after the opponent id (2026-09-21). A version-1 record predates the choice and decodes as the longsword.
// 3: the Veteran's brief 8 authored opening (2026-09-22) changes his fresh-fight behaviour; a v2 link would silently replay a
// different fight against him, so it is refused rather than reproduced wrong (record-replay-check.mjs's own instruction).
export type RecordProfile = 'easy' | 'normal' | 'hard';
export type Outcome = 'killed' | 'died' | 'draw' | 'abandoned';
export type RecordMeta = { build: string; opponent: OpponentId; weapon: WeaponId; profile: RecordProfile; seed: number };
export type FightRecord = RecordMeta & { v: typeof RECORD_VERSION; ticks: number; outcome: Outcome; intents: Intent[] };

// Quantization: the stick to 1/127 per axis, the camera yaw to 1/128 of a half-turn (about 1.4°). The live game steps the
// quantized intent (main.ts), so a replay reproduces the fight bit for bit.
const YAW_STEPS = 256, YAW_UNIT = (2 * Math.PI) / YAW_STEPS;
const q8 = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
const yawToByte = (yaw: number) => (((Math.round(yaw / YAW_UNIT) % YAW_STEPS) + YAW_STEPS) % YAW_STEPS);
const byteToYaw = (b: number) => { const s = b >= 128 ? b - 256 : b; return s * YAW_UNIT; };   // centred on 0: −π..π

const ACTIONS: (Action | null)[] = [null, 'light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry'];
const DIRECTIONS: (Direction | undefined)[] = [undefined, 'right', 'left', 'overhead', 'thrust', 'low'];
const PROFILES: RecordProfile[] = ['easy', 'normal', 'hard'];
const OUTCOMES: Outcome[] = ['killed', 'died', 'draw', 'abandoned'];
const F_RUN = 1, F_GUARD = 2, F_HELD = 4, F_LOCK = 8, F_CANCEL = 16;

export function quantizeIntent(intent: Intent): Intent {
  const out: Intent = {
    move: { x: q8(intent.move.x) / 127, z: q8(intent.move.z) / 127, yaw: byteToYaw(yawToByte(intent.move.yaw)), run: !!intent.move.run },
    action: intent.action, guard: !!intent.guard, lock: !!intent.lock,
  };
  if (intent.held) out.held = true;
  if (intent.cancel) out.cancel = true;
  if (intent.guardDirection) out.guardDirection = intent.guardDirection;
  return out;
}

// Records one fight from its first tick. push() returns the quantized intent the caller must step with.
export function createRecorder(meta: RecordMeta) {
  const intents: Intent[] = [];
  let done: FightRecord | null = null;
  return {
    meta,
    get ticks() { return intents.length; },
    get finished() { return done; },
    push(intent: Intent): Intent {
      if (done) return quantizeIntent(intent);
      const q = quantizeIntent(intent);
      intents.push(q);
      return q;
    },
    finish(outcome: Outcome): FightRecord {
      done ??= { v: RECORD_VERSION, ...meta, ticks: intents.length, outcome, intents: intents.slice() };
      return done;
    },
  };
}

// ---- binary layout ---------------------------------------------------------------------------------------------------------
// magic 'F' 'K' | version u8 | build: len u8 + ascii | opponent: len u8 + ascii | weapon: len u8 + ascii (version 2) | profile u8 | seed u32 LE | ticks u32 LE | outcome u8
// then six columns of `ticks` bytes each: x i8, z i8, yaw-delta u8 (byte yaw minus previous byte yaw, mod 256), action u8, dir u8, flags u8.
const ascii = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 127) throw Error(`Fight record: non-ASCII in "${s}"`); b[i] = c; } return b; };

export function packRecord(r: FightRecord): Uint8Array {
  if (r.v !== RECORD_VERSION) throw Error(`Fight record: cannot pack version ${String(r.v)}`);
  if (r.intents.length !== r.ticks) throw Error('Fight record: ticks does not match the intent count');
  const build = ascii(r.build), opp = ascii(r.opponent), wpn = ascii(r.weapon);
  if (build.length > 255 || opp.length > 255 || wpn.length > 255) throw Error('Fight record: build, opponent or weapon id too long');
  const profile = PROFILES.indexOf(r.profile), outcome = OUTCOMES.indexOf(r.outcome);
  if (profile < 0 || outcome < 0) throw Error('Fight record: unknown profile or outcome');
  const n = r.ticks, head = 3 + 1 + build.length + 1 + opp.length + 1 + wpn.length + 1 + 4 + 4 + 1, out = new Uint8Array(head + 6 * n), dv = new DataView(out.buffer);
  let o = 0;
  out[o++] = 0x46; out[o++] = 0x4b; out[o++] = RECORD_VERSION;
  out[o++] = build.length; out.set(build, o); o += build.length;
  out[o++] = opp.length; out.set(opp, o); o += opp.length; out[o++] = wpn.length; out.set(wpn, o); o += wpn.length;
  out[o++] = profile; dv.setUint32(o, r.seed >>> 0, true); o += 4; dv.setUint32(o, n, true); o += 4; out[o] = outcome;
  const col = (k: number) => head + k * n;
  let prevYaw = 0;
  for (let i = 0; i < n; i++) {
    const it = r.intents[i], yaw = yawToByte(it.move.yaw);
    out[col(0) + i] = q8(it.move.x) & 0xff; out[col(1) + i] = q8(it.move.z) & 0xff;
    out[col(2) + i] = (yaw - prevYaw + YAW_STEPS) % YAW_STEPS; prevYaw = yaw;
    const a = ACTIONS.indexOf(it.action ?? null), d = DIRECTIONS.indexOf(it.guardDirection);
    if (a < 0 || d < 0) throw Error(`Fight record: unknown action or guard side at tick ${i}`);
    out[col(3) + i] = a; out[col(4) + i] = d;
    out[col(5) + i] = (it.move.run ? F_RUN : 0) | (it.guard ? F_GUARD : 0) | (it.held ? F_HELD : 0) | (it.lock ? F_LOCK : 0) | (it.cancel ? F_CANCEL : 0);
  }
  return out;
}

export function unpackRecord(bytes: Uint8Array): FightRecord {
  if (bytes.length < 3 || bytes[0] !== 0x46 || bytes[1] !== 0x4b) throw Error('Fight record: not a fight record');
  const v = bytes[2];
  if (v !== 1 && v !== RECORD_VERSION) throw Error(`Fight record: version ${v} is not supported (this build reads versions 1 and ${RECORD_VERSION})`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 3;
  const str = () => { const len = bytes[o++]; if (o + len > bytes.length) throw Error('Fight record: truncated'); let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[o + i]); o += len; return s; };
  const build = str(), opponent = str() as OpponentId, weapon = (v >= 2 ? str() : 'longsword') as WeaponId;   // version 1: every fight was the longsword
  if (!(weapon in WEAPONS)) throw Error('Fight record: unknown weapon');
  if (o + 1 + 4 + 4 + 1 > bytes.length) throw Error('Fight record: truncated');
  const profile = PROFILES[bytes[o++]], seed = dv.getUint32(o, true); o += 4; const n = dv.getUint32(o, true); o += 4; const outcome = OUTCOMES[bytes[o++]];
  if (!profile || !outcome) throw Error('Fight record: unknown profile or outcome');
  if (bytes.length !== o + 6 * n) throw Error('Fight record: length does not match its tick count');
  const col = (k: number) => o + k * n, intents: Intent[] = new Array(n);
  let yaw = 0;
  for (let i = 0; i < n; i++) {
    const sx = bytes[col(0) + i], sz = bytes[col(1) + i], x = (sx >= 128 ? sx - 256 : sx) / 127, z = (sz >= 128 ? sz - 256 : sz) / 127;
    yaw = (yaw + bytes[col(2) + i]) % YAW_STEPS;
    const action = ACTIONS[bytes[col(3) + i]], dir = DIRECTIONS[bytes[col(4) + i]], f = bytes[col(5) + i];
    if (bytes[col(3) + i] >= ACTIONS.length || bytes[col(4) + i] >= DIRECTIONS.length) throw Error(`Fight record: unknown action or guard side at tick ${i}`);
    const it: Intent = { move: { x, z, yaw: byteToYaw(yaw), run: !!(f & F_RUN) }, action: action ?? null, guard: !!(f & F_GUARD), lock: !!(f & F_LOCK) };
    if (f & F_HELD) it.held = true;
    if (f & F_CANCEL) it.cancel = true;
    if (dir) it.guardDirection = dir;
    intents[i] = it;
  }
  return { v: RECORD_VERSION, build, opponent, weapon, profile, seed, ticks: n, outcome, intents };
}

// ---- transport: gzip + base64url (no padding). CompressionStream is in every browser the game targets and in Node ≥ 18. --------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0, n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return s;
}
export function fromBase64Url(s: string): Uint8Array {
  if (/[^A-Za-z0-9_-]/.test(s) || s.length % 4 === 1) throw Error('Fight record: not base64url');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const v = (k: number) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0), n = (v(0) << 18) | (v(1) << 12) | (v(2) << 6) | v(3);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < s.length) out[o++] = n & 255;
  }
  return out;
}
async function pipe(bytes: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A fresh ArrayBuffer-backed copy (the stream wants a BufferSource). A failed write (bad gzip on decode) surfaces on the read side
  // below, so its own rejection is swallowed here rather than left unhandled.
  void writer.write(new Uint8Array(bytes)).then(() => writer.close()).catch(() => {});
  const parts: Uint8Array[] = [], reader = stream.readable.getReader();
  for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value); }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export const encodeRecord = async (r: FightRecord): Promise<string> => toBase64Url(await pipe(packRecord(r), new CompressionStream('gzip')));
export async function decodeRecord(s: string): Promise<FightRecord> {
  let bytes: Uint8Array;
  try { bytes = await pipe(fromBase64Url(s), new DecompressionStream('gzip')); } catch (error) { throw new Error(`Fight record: cannot decode (${error instanceof Error ? error.message : String(error)})`, { cause: error }); }
  return unpackRecord(bytes);
}
