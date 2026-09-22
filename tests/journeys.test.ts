// User journeys across modules (GPT audit 2026-09-22, the safety net for the main.ts split): each one crosses the seams the newer
// features introduced — loot → account → cloud → another device; fight → store → link → loader; daily → post → rematch. No browser:
// the Supabase client is a tiny in-memory fake with the tables these paths touch, and REST reads are a fake fetch over the same rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRecorder, decodeRecord } from '../src/record.ts';
import { profileDiffers, readFighter, writeFighter } from '../src/cloud-profile.ts';
import { mergeLoot, recordTaken, store, wear, type Loot } from '../src/loot.ts';
import { loadProfile, saveProfile, type Profile } from '../src/profile.ts';
import { fetchSharedRecord, publishRecord, shortLink, shortParam } from '../src/share-store.ts';
import { loadDaily, postDaily, saveDaily, type DailyFight } from '../src/daily.ts';

type Row = Record<string, unknown>;
// Three tables, the shapes the code uses: fighter_profiles (insert / update by user_id+revision, select+maybeSingle) and the two
// insert-only tables (fight_records unique on id, daily_results unique on day+user_id → 23505 like Postgres).
function fakeCloud() {
  const tables: Record<string, Row[]> = { fighter_profiles: [], fight_records: [], daily_results: [] };
  const dup = (table: string, row: Row) => table === 'fight_records' ? tables[table]!.some(r => r.id === row.id)
    : table === 'daily_results' ? tables[table]!.some(r => r.day === row.day && r.user_id === row.user_id) : false;
  const from = (table: string) => ({
    insert: (row: Row) => {
      const result = dup(table, row) ? { data: null, error: { code: '23505', message: 'duplicate key' } } : (tables[table]!.push({ revision: 1, ...row }), { data: tables[table]!.at(-1)!, error: null });
      return { ...result, select: () => ({ maybeSingle: async () => result }), then: (ok: (v: typeof result) => unknown) => Promise.resolve(result).then(ok) };
    },
    update: (patch: Row) => ({ eq: (c1: string, v1: unknown) => ({ eq: (c2: string, v2: unknown) => ({ select: () => ({ maybeSingle: async () => {
      const row = tables[table]!.find(r => r[c1] === v1 && r[c2] === v2);
      if (!row) return { data: null, error: null };
      Object.assign(row, patch, { revision: (row.revision as number) + 1 }); return { data: row, error: null };
    } }) }) }) }),
    select: () => ({ eq: (c: string, v: unknown) => ({ maybeSingle: async () => ({ data: tables[table]!.find(r => r[c] === v) ?? null, error: null }) }) }),
  });
  const rest: typeof fetch = async (url) => {   // the publishable-key REST read a short link uses
    const id = /fight_records\?select=record&id=eq\.([A-Za-z0-9_-]+)/.exec(String(url))?.[1];
    return new Response(JSON.stringify(tables.fight_records!.filter(r => r.id === id).map(r => ({ record: r.record }))), { status: 200 });
  };
  return { db: { from } as unknown as SupabaseClient, tables, rest };
}
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const fight = (opponent: 'veteran' | 'goblin', seed = 3) => { const rec = createRecorder({ build: 'dev', opponent, weapon: 'longsword', profile: 'normal', seed }); rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); return rec.finish('killed'); };

test('journey: earn a piece → wear it → automatic cloud save → sign in on another device and it is worn there', async () => {
  const cloud = fakeCloud(), user = 'user-1';
  // Device A: a guest who earned the Goblin's necklace, then signed in (first save = the device's fighter) and then put it on.
  const a = memory();
  const profileA: Profile = { ...loadProfile(a, () => 'device-a').profile, name: 'Aldren', encounter: 'goblin', career: { victoryMarks: 3 } };
  profileA.loot = store(profileA.loot, 'goblin.Body', { opponent: 'goblin', attempt: 2, healthLeft: 40, recordId: null, day: '2026-09-22' });
  saveProfile(a, profileA);
  let saved = await writeFighter(cloud.db, user, profileA, null);
  assert.equal(saved.revision, 1); assert.deepEqual(saved.loot.equipped, {});
  profileA.loot = wear(profileA.loot!, 'goblin.Body'); saveProfile(a, profileA);
  assert.equal(profileDiffers(profileA, saved), true, 'wearing it is a change the account must send (audit finding A)');
  saved = await writeFighter(cloud.db, user, loadProfile(a, () => 'x').profile, saved.revision);
  assert.equal(saved.revision, 2); assert.deepEqual(saved.loot.equipped, { chest: 'goblin.Body' });
  // Device B: a fresh device signs in; the merge is what account.ts refresh(merge = true) does.
  const b = memory(), profileB: Profile = loadProfile(b, () => 'device-b').profile;
  const remote = await readFighter(cloud.db, user); assert.ok(remote);
  profileB.name = remote.display_name; profileB.encounter = remote.encounter ?? undefined;
  const loot: Loot = mergeLoot(profileB.loot, remote.loot); if (loot.owned.length) profileB.loot = loot;
  assert.deepEqual(profileB.loot?.equipped, { chest: 'goblin.Body' }, 'the necklace is worn on the second device');
  assert.equal(profileB.loot?.taken?.['goblin.Body']?.attempt, 2, 'provenance travelled');
  assert.equal(profileDiffers(profileB, remote), false, 'nothing to write back: the merge is exact');
});

test('journey: earn a piece → share its fight → the page later boots another opponent → the Watch link still opens', async () => {
  const cloud = fakeCloud(), user = 'user-1', origin = 'https://frankendom.com';
  const record = fight('veteran');
  const id = await publishRecord(cloud.db, user, record);
  let loot = store(undefined, 'veteran.Helmet', { opponent: 'veteran', attempt: 3, healthLeft: 12, recordId: null, day: '2026-09-22' });
  loot = recordTaken(loot, 'veteran.Helmet', id);
  const taken = loot.taken!['veteran.Helmet']!;
  const link = shortLink(origin, taken.opponent, taken.recordId!);   // what the journal's Watch link is since #384 (audit finding C)
  // The player has since moved on to the Goblin. Opening the link: main.ts reads ?opponent= from the URL first, then the record.
  const booted = /[?&]opponent=(\w+)/.exec(new URL(link).search)?.[1] ?? 'goblin';
  const text = await fetchSharedRecord({ url: origin, key: 'anon' }, shortParam(new URL(link).search)!, cloud.rest);
  const opened = await decodeRecord(text);
  assert.equal(opened.opponent, 'veteran'); assert.equal(booted, opened.opponent, 'the loader accepts: the link named the fight\'s opponent');
  assert.deepEqual(opened, record, 'the same fight comes back');
  // The old bare form would boot the player's current opponent and be refused — the regression the fix closed.
  const bare = `${origin}/?r=${id}`, bootedBare = /[?&]opponent=(\w+)/.exec(new URL(bare).search)?.[1] ?? 'goblin';
  assert.notEqual(bootedBare, opened.opponent, 'a bare /?r= link would have been refused for another opponent');
});

test('journey: enter the daily → finish → post once → a rematch cannot post again and the day stays spent across a reload', async () => {
  const cloud = fakeCloud(), user = 'user-1', storage = memory();
  const today: DailyFight = { day: '2026-09-22', number: 12, seed: 99 };
  let state = loadDaily(storage, today.day); assert.deepEqual(state, { day: today.day, started: false, submitted: false });
  state = { ...state, started: true }; saveDaily(storage, state);
  const record = fight('goblin', today.seed);
  await postDaily(cloud.db, user, today, record, 'torso', 1);
  state = { ...state, submitted: true, outcome: record.outcome, ticks: record.ticks }; saveDaily(storage, state);
  assert.equal(cloud.tables.daily_results!.length, 1);
  // Rematch on the same day: the server's primary key refuses a second post, and the device already knows the day is spent.
  await assert.rejects(postDaily(cloud.db, user, today, fight('goblin', today.seed), 'head', 0), /already posted/);
  assert.equal(cloud.tables.daily_results!.length, 1, 'still one row');
  assert.equal(loadDaily(storage, today.day).submitted, true, 'a reload sees the day as submitted (main.ts: the rematch is practice)');
  assert.equal(loadDaily(storage, '2026-09-23').submitted, false, 'tomorrow is fresh');
  // Not covered here: that the practice rematch awards no loot and no mark — that policy lives in main.ts today and gets its own
  // table-driven test when the match-session split lands (Lead, 2026-09-22).
});
