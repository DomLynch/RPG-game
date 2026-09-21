// The short-id share route (beta plan brief 3; Strategy's shape, 2026-09-21). A signed-in fighter's Share stores the encoded fight record
// under a short unguessable id (public.fight_records, migration 202609210002) and the link carries the id; a guest's link carries the
// record itself (replay.ts MAX_SHARE_CHARS). Opening a short link reads the row straight from the REST endpoint with the publishable key —
// no account SDK download on a link open, and a guest can read it. Everything here is bounded: id shape, stored size, insert retries.
import type { SupabaseClient } from '@supabase/supabase-js';
import { encodeRecord, type FightRecord } from './record.ts';

export const SHORT_ID = /^[A-Za-z0-9_-]{8}$/;
export const MAX_STORED_CHARS = 16384;   // the table's check; a 30 s fight is ~1–3 K
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';   // base64url: 64 symbols, 48 bits per id

export function shortId(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  let id = '';
  for (const byte of random(8)) id += ALPHABET[byte & 63];
  return id;
}
export const shortParam = (search: string): string | null => /[?&]r=([A-Za-z0-9_-]{8})(?:&|$)/.exec(search)?.[1] ?? null;
export const shortLink = (origin: string, opponent: string, id: string): string => `${origin}/?opponent=${opponent}&r=${id}`;

// Stores the record for the signed-in owner and returns its id. A colliding id (unique violation) is drawn again, twice.
export async function publishRecord(db: SupabaseClient, userId: string, record: FightRecord): Promise<string> {
  const text = await encodeRecord(record);
  if (text.length > MAX_STORED_CHARS) throw Error('this fight is too long to store');
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = shortId();
    const { error } = await db.from('fight_records').insert({ id, user_id: userId, opponent: record.opponent, record: text });
    if (!error) return id;
    if (error.code !== '23505') throw Error(error.message || 'the fight store refused the record');
  }
  throw Error('could not store the fight');
}

// Reads a stored record by id as anyone (the row is readable by id; the key is the public one).
export async function fetchSharedRecord(api: { url: string; key: string }, id: string, fetchFn: typeof fetch = fetch): Promise<string> {
  if (!SHORT_ID.test(id)) throw Error('not a fight link');
  const response = await fetchFn(`${api.url}/rest/v1/fight_records?select=record&id=eq.${id}`, { headers: { apikey: api.key, Authorization: `Bearer ${api.key}`, Accept: 'application/json' } });
  if (!response.ok) throw Error(`the fight store answered ${response.status}`);
  const rows = await response.json() as { record?: unknown }[];
  const text = Array.isArray(rows) ? rows[0]?.record : undefined;
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text) || text.length > MAX_STORED_CHARS) throw Error('no such fight');
  return text;
}
