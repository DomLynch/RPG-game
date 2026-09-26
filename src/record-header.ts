// The header of a kill link this build refuses (a retired record version): who fought, with which weapon, and how it ended — so the
// viewer page can say what the fight WAS without replaying a different one. Header only: the intents are never read. Kept out of
// src/record.ts on purpose: that file is in tests/record-version-guard.test.ts's sim digest, and a display helper is not a sim change.
// The header layout is src/record.ts's "binary layout" comment; every version since 2 carries the weapon after the opponent (1 was
// always the longsword), and every version since 12 a skill byte after the weapon. OUTCOMES is that file's byte order — tests/graphics.test.ts reads packRecord's own bytes back through here.
import { fromBase64Url, MAX_RECORD_BYTES, type Outcome } from './record.ts';

const OUTCOMES: Outcome[] = ['killed', 'died', 'draw', 'abandoned'];
export type RecordHeader = { v: number; build: string; opponent: string; weapon: string; outcome: Outcome };

// Null for anything that is not a fight record's header. The gunzip is bounded like decodeRecord's: a link is public input.
export async function peekRecordHeader(s: string): Promise<RecordHeader | null> {
  try {
    const gunzip = new DecompressionStream('gzip'), writer = gunzip.writable.getWriter(), reader = gunzip.readable.getReader();
    void writer.write(new Uint8Array(fromBase64Url(s))).then(() => writer.close()).catch(() => {});   // a bad gzip surfaces on the read side
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.length;
      if (total > MAX_RECORD_BYTES) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let o = 0; for (const p of parts) { bytes.set(p, o); o += p.length; }
    if (bytes.length < 3 || bytes[0] !== 0x46 || bytes[1] !== 0x4b) return null;
    const v = bytes[2];
    o = 3;
    const str = () => { const len = bytes[o++]; if (len === undefined || o + len > bytes.length) throw Error('truncated'); let t = ''; for (let i = 0; i < len; i++) t += String.fromCharCode(bytes[o + i]); o += len; return t; };
    const build = str(), opponent = str(), weapon = v >= 2 ? str() : 'longsword';
    if (v >= 12) o++;   // the skill byte (version 12)
    const outcome = OUTCOMES[bytes[o + 1 + 4 + 4]];   // after profile u8, seed u32, ticks u32
    return outcome ? { v, build, opponent, weapon, outcome } : null;
  } catch { return null; }
}
