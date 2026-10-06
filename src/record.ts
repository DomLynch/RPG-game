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
import { LEVELS, PLAYER_WEAPONS, type Direction, type SkillId, type WeaponId } from './moves.ts';
import type { OpponentId } from './roster.ts';
import { FIRST_SCALED_VERSION, PLAY_SCALE, playScaleFor } from './play-radius.ts';

export const RECORD_VERSION = 23;   // 23: bump 23 (2026-10-06, Dom via Lead) — Arena 1's play circle comes inward to 0.6 of 8.55 m (play-radius.ts; the veteran and the pitborn, every level). A record's version picks its circle: v22 and older replay in the old 8.55 m (detmath.ts underRecord, match.ts), so REACH[23] is empty and every shared link still replays its own fight. 22: bump 22 (2026-10-02; Combat, #1280, with #1114 not live) — Dom's final special rule in the sim (RULES.special: boss share .25, the cooldown re-arms from the release, a 45-tick no-attack recovery; duel.ts specialRecover). Only a fight with the specials flag steps differently, so a v21 specials record would replay another fight: 21 stays readable beside 22 (Lead: v21 is the writer on the specials base); a flag-off fight is bit for bit as v20, so v18–v20 stay readable and REACH[22] is empty.
// 21: bump 21 (2026-09-29, Dom's GO via Lead; Combat) — Special Moves on the SKILL slot (duel.ts withSpecials, RULES.special), behind a per-fight flag the header now carries (one byte after the skill). With the flag off a v21 fight steps bit for bit as v20 (every new branch reads a field only withSpecials sets), so v20 stays readable (REACH[21] is empty).
// 20: bump 20 (2026-09-28, Dom via Strategy / Lead) — the Plague Doctor fights with the estoc, not the longsword (roster.ts; his archetype row is the Nightborn's, who fights with it). REACH[20]: the Plague Doctor at every level. Inside the same unreleased bump (2026-09-29): his easy tellReaction 15 (moves.ts), closing the estoc's L6 thrust-from-range hole. And the sim's math (2026-09-29, Strategy ruling (b)): v20 on steps on src/detmath.ts (sin/cos/atan2/hypot on + − * / sqrt, the same bits in every engine; Node's V8 and Chromium's had split a Dwarf link on a 1-ulp atan2); v18/v19 records replay on the engine's own Math, frozen, picked by this version field through detmath.underRecord, so no shared link becomes a fresh fight.
// 19: bump 19 (2026-09-28, RV18 content rebased on RV19; SCOPE shield line, Lead split from RV17) — the Centurion carries gladius + scutum from Legionary (moves.ts LOADOUT_FROM, level 6 on; the Recruit keeps the trident); the scutum is a guard profile only (wide: both flanks, stops heavies, costScale .75, posture drains ×1.5).
// 18: bump 18 (2026-09-28, RV19 in the lane's numbering; Strategy ruling) — the Centurion's own knobs (moves.ts OWN_KNOBS: tellReaction 15 on the thrust and the pommel strike, braceHeavy 1): every level fights another Centurion. The Skeleton, his archetype twin, is unchanged.
// 17: bump 17 (2026-09-27, RV17; Lead ruling) — the Witch's easy SKILL fields retuned (reaction 26 -> 15, parry .05 -> .2, lapse .5 -> .35, read .5 -> .65; identity and normal / hard untouched), so levels 1–17 fight another Witch: thrust from range beat her 46–48 / 48 at L10–16.
// 16: bump 16 (2026-09-28, RV16; Dom via Strategy 2026-09-27) — the 46-level ladder: the header's profile byte carries the opponent's LEVEL (1–46, moves.ts profileAt; easy / normal / hard are levels 6 / 18 / 46), level 1 is a novice below easy, and the Witch's sweep and hop are held at every level (her normal and hard were the plain warden's). One batch with the rank / order change.
// 15: bump 15 (2026-09-26, RV15; Dom via Strategy) — Estoc Lunge and Iron Rush lose their landed-cast follow-up (moves.ts: stagger 0, staminaDamage 0; Lunge damage 11, Iron Rush 10; reach, stepIn and the Rush's poise kept), so Lunge, Iron Rush and Dirty Jab are offered again (loot.ts SKILLS). Judged at 480 seeds: under Pommel + 40 by one sd on every pairing.
//   // 14: bump 14 (2026-09-26, SCOPE 8; Dom via Strategy: all nine in one batch) — the nine opponents' skills (moves.ts `skill_lunge` … `skill_hewer`, loot.ts SKILLS), each a take a kill offers; the equipped-skill byte gains codes 3–11 (append only).
//   // 13: bump 13 (2026-09-25, one bump for two sim changes, Strategy's ruling) — the hero's day-one skill `skill_pommel` (moves.ts; Dom: "Hero starts with Pommel Strike; one skill slot; a take swaps it"), and Combat's #761: the Goblin's kick lunges at pace 1, not his 1.2 (duel.ts). A v12 Goblin fight with a kick replays a different fight, so older links are refused at decode.
// 12: bump 12 (2026-09-25, SKILL 1: docs/briefs/skill-witch-arm.md) — the SKILL action and the `skill_witchfire` move (duel.ts, moves.ts), and the player's equipped skill in the header after the weapon. A v11 record has no skill byte, so older links are refused at decode.
// 11: bump 11 (2026-09-25, the Mon 09-28 window; Dom via Strategy) — every weapon starts the fight SHEATHED (duel.ts initialDuel): since #713 a taken weapon started 'ready', so the opponent (ai.ts) never waited for the draw. A v10 record of a taken-weapon fight replays a fight with no draw beat, so older links are refused at decode.
// 10: bump 10 (2026-09-24, Dom's drive-by) — the Witch's own Easy profile (#691) and the kick-into-guard stagger 36 -> 48 (#692), one bump for both (the straight-back roll, #693, needed no sim change). Older links are refused at decode (Dom accepts). 9: bump 9 (2026-09-23) — the park habit counts the first parked tick only (ai.ts); a one-tick park used to count every later tick of its swing, so a committing parrier (Nightborn, Plague Doctor) read a parker from one sloppy tap. A sim change, so older links are refused at decode.
// 8: bump 8 (2026-09-23) — the Executioner's own normal profile (`anticipate`, #550) and the roster-v0 beta characters (Shieldmaiden, Knight, Plague Doctor, Witch) on their bodies' archetypes. A sim change, so older links are refused at decode.
// 7: Publish B (2026-09-23), one bump for the chain — the estoc's real reach (#532), the Nightborn's profile (#545), the gladius as a player weapon (#543; the Centurion's swap, #547, is held), and the knife and scythe thrust tables rebaked on their 5's timings (the bake was stale since 5; blade-paths.ts is in the digest now). A sim change, so older links are refused at decode.
// 6: the kicker-hover hold fix (2026-09-22) — a warden's hold now derives from the inReach margin of the move he has queued, so he stops parking at a gap his own plan cannot reach. A sim change, so older links are refused at decode rather than replaying a different fight.
// 5: the batched weapon-data flip (2026-09-22) — the knife's thrust recovery 15 -> 20 and the scythe's heel-jab 18 -> 30, one bump for the pair rather than one each (the lead's ruling: kill links are the viral surface, and N bumps means N waves of dead links). 4 was taken by Brief 13's whip tell while this branch was in flight, so this is 5, not the 4 the branch first wrote.
// 4: the lorarii's whip tell (`WhipRaised`, #431) adds events to the duel stream, so a record written on 3 replays a fight whose whip never rose.
// 3: the warden's reach fix (#371) and the ladder retune (#366) changed how fights play out, so a link recorded before them would replay a different fight; this build refuses every earlier version instead. 2: the player's weapon after the opponent id (2026-09-21). 1: every fight was the longsword.
// The decoder's ACCEPT-LIST: the versions this build can read. Deliberately data, and deliberately not `RECORD_VERSION` — reading
// and writing are different questions, and a build that writes one version can still read the ones whose bytes it understands. It is
// pinned as a literal in tests/record-version-guard.test.ts beside SIM_DIGEST, so widening it is a reviewed decision rather than a
// drift. There is exactly one list: scripts/verify-daily.mjs imports `decodeRecord` from this module and deploy.sh rsyncs src/**/*.ts
// to the verifier host, so the server reads this list too — a second copy on the server is the failure this shape exists to prevent.
// [5] -> [6] with the writer bump to 6 (knife hold fix, 2026-09-23). REPLACED, not widened: this build writes 6 and must read 6 back
// (the guard's own `includes(RECORD_VERSION)` assertion), and it must NOT read 5 — a v5 record replays a fight whose Goblin stood
// somewhere else. Accepting 5 again is PR B's decision, together with the v5 decode branch, exactly as before.
// [6] -> [7] with the writer bump to 7 (Publish B, 2026-09-23). REPLACED, not widened, for the same reason: a v6 record replays a fight
// whose Nightborn fought a shorter estoc on another profile.
// [7] -> [8] with the writer bump to 8: replaced, not widened (a v7 record replays an Executioner on the shared profile).
// [8] -> [9] with the writer bump to 9: replaced, not widened (a v8 record with a one-tick park replays a Nightborn who read it as a habit).
// [9] -> [10] with the writer bump to 10: replaced, not widened (a v9 record replays a Witch on the Centurion's Easy).
// [10] -> [11] with the writer bump to 11: replaced, not widened (a v10 taken-weapon record replays a fight with no draw beat).
// [11] -> [12] with the writer bump to 12: replaced, not widened (a v11 record has no skill byte in its header).
// [12] -> [13] with the writer bump to 13: replaced, not widened (a v12 Goblin fight with a kick replays a lunge at his 1.2 pace).
// [13] -> [14] with the writer bump to 14: replaced, not widened (a v13 build cannot name codes 3–11, and its fights ran on the v13 digest).
// [14] -> [15] with the writer bump to 15: replaced, not widened (a v14 Lunge or Iron Rush fight replays a 20-damage, 22-stagger landing).
// [15] -> [16] with the writer bump to 16: replaced, not widened (a v15 header names easy / normal / hard, not a level).
// [16] -> [17] with the writer bump to 17: replaced, not widened (a v16 Witch fight below level 18 replays her old easy blend).
// [18] -> [19] with the writer bump to 19: replaced, not widened (a v18 Centurion fight at L6+ replays his old trident, no scutum).
// [17] -> [18] with the writer bump to 18: replaced, not widened (a v17 Centurion fight replays his old answers to the thrust and the pommel).
// [19] -> [18, 19] (2026-09-28, Lead: kill links should not die at every bump): WIDENED, the first time. Bump 19 changed one fight, the
// Centurion from level 6 on (moves.ts LOADOUT_FROM: gladius + scutum; the rest of its diff, the scutum's wide / postureDecay fields and
// the two braceHeavy lines in ai.ts, is inert without the scutum). Every other v18 fight steps bit for bit on v19 (the PR's probe: the
// event stream, outcome, final tick and final state match, every opponent × level × weapon × strategy). A v18 record inside V18_REACH
// is still refused at decode, with the same "version" message, so the page converts it into a fight exactly as before.
// [18, 19] -> [18, 19, 20] with the writer bump to 20: widened under the standing rule (Strategy, 2026-09-28): bump 20 declares its reach
// in REACH below, and an older record is read wherever no later bump reached its fight.
// [18, 19, 20] -> [18, 19, 20, 21] with the writer bump to 21: widened, and REACH[21] is empty. Bump 21 adds Special Moves behind a flag the
// record carries; a record without the flag (every v18–v20 record) steps exactly as before, so no older fight is reached.
// [18, 19, 20, 21] -> [18, 19, 20, 21, 22] with the writer bump to 22: widened, REACH[22] is empty (Lead's ruling after the Auditer, 2026-10-02: v21 is the writer on the specials base, which may reach trunk before #1280, so it stays readable).
// [.., 22] -> [.., 22, 23] with the writer bump to 23: widened, REACH[23] is empty (the play circle is keyed on the record's version, so an older record steps in the circle it was fought in).
export const READABLE_VERSIONS = [18, 19, 20, 21, 22, 23] as const;
// Each bump's REACH (the standing rule, Strategy 2026-09-28): the fights bump N can change, as (opponent, from level). A record of version
// k is refused when any bump after k reaches its opponent at its level; everything else is read. Literals on purpose, not the data they
// describe (LOADOUT_FROM, ROSTER): a reach records what that bump changed and must not move when the data moves later (that change bumps
// and declares its own). A bump that changes rules, AI or the codec for everyone cannot be declared here; it replaces the list instead.
export const REACH: Readonly<Record<number, readonly { opponent: OpponentId; from: number }[]>> = {
  19: [{ opponent: 'veteran', from: 6 }],   // the Centurion's gladius + scutum from Legionary (moves.ts LOADOUT_FROM)
  20: [{ opponent: 'plaguedoctor', from: 1 }],   // the Plague Doctor's estoc (roster.ts), every level
  21: [],   // Special Moves, behind the record's own flag: a fight without it is unchanged
  22: [],   // the final special rule (#1280): only a fight with the flag moves, and v21 is not readable
  23: [],   // Arena 1's smaller play circle: a record below 23 replays in the old circle (underRecord), so no older fight is reached
};
// A record states the play circle its fight was fought in (play-radius.ts): this build's version when the circle in force is the one this build
// fights `opponent` in, the previous (old-circle) version when it is not (a headless run that never set it, a script). Either replays to the
// fight it recorded, because the version picks the circle (detmath.ts underRecord).
const OLD_CIRCLE_VERSION = FIRST_SCALED_VERSION - 1;
const stampedVersion = (opponent: string): number => PLAY_SCALE === playScaleFor(opponent, RECORD_VERSION) ? RECORD_VERSION : OLD_CIRCLE_VERSION;
export type RecordVersion = (typeof READABLE_VERSIONS)[number];

export type Outcome = 'killed' | 'died' | 'draw' | 'abandoned';
export type RecordMeta = { build: string; opponent: OpponentId; weapon: WeaponId; skill?: SkillId; level: number; seed: number; specials?: boolean };   // specials: the fight had Special Moves (version 21; absent = off)   // skill: the player's equipped skill; absent = none. level: the opponent's ladder level, 1–46 (moves.ts profileAt; version 16)
export type FightRecord = RecordMeta & { v: RecordVersion; ticks: number; outcome: Outcome; intents: Intent[] };

// Quantization: the stick to 1/127 per axis, the camera yaw to 1/128 of a half-turn (about 1.4°). The live game steps the
// quantized intent (main.ts), so a replay reproduces the fight bit for bit.
const YAW_STEPS = 256, YAW_UNIT = (2 * Math.PI) / YAW_STEPS;
const q8 = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
const yawToByte = (yaw: number) => (((Math.round(yaw / YAW_UNIT) % YAW_STEPS) + YAW_STEPS) % YAW_STEPS);
const byteToYaw = (b: number) => { const s = b >= 128 ? b - 256 : b; return s * YAW_UNIT; };   // centred on 0: −π..π

const ACTIONS: (Action | null)[] = [null, 'light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry', 'skill'];   // append only: a code never changes meaning
const SKILLS: (SkillId | null)[] = [null, 'witchfire', 'pommel', 'lunge', 'reaping', 'shove', 'jab', 'cleave', 'stomp', 'miasma', 'ironrush', 'hewer'];   // append only, as ACTIONS
const DIRECTIONS: (Direction | undefined)[] = [undefined, 'right', 'left', 'overhead', 'thrust', 'low'];
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
      done ??= { v: stampedVersion(meta.opponent) as RecordVersion, ...meta, ticks: intents.length, outcome, intents: intents.slice() };
      return done;
    },
  };
}

// ---- binary layout ---------------------------------------------------------------------------------------------------------
// magic 'F' 'K' | version u8 | build: len u8 + ascii | opponent: len u8 + ascii | weapon: len u8 + ascii (version 2) | skill u8 (version 12; 0 = none) | specials u8 (version 21; 0 = off, 1 = on) | profile u8 (version 16: the level, 1–46) | seed u32 LE | ticks u32 LE | outcome u8
// then six columns of `ticks` bytes each: x i8, z i8, yaw-delta u8 (byte yaw minus previous byte yaw, mod 256), action u8, dir u8, flags u8.
const ascii = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 127) throw Error(`Fight record: non-ASCII in "${s}"`); b[i] = c; } return b; };

export function packRecord(r: FightRecord): Uint8Array {
  if (r.v !== RECORD_VERSION && r.v !== OLD_CIRCLE_VERSION) throw Error(`Fight record: cannot pack version ${String(r.v)}`);
  if (r.intents.length !== r.ticks) throw Error('Fight record: ticks does not match the intent count');
  const build = ascii(r.build), opp = ascii(r.opponent), wpn = ascii(r.weapon);
  if (build.length > 255 || opp.length > 255 || wpn.length > 255) throw Error('Fight record: build, opponent or weapon id too long');
  const level = r.level, outcome = OUTCOMES.indexOf(r.outcome), skill = SKILLS.indexOf(r.skill ?? null);
  if (!Number.isInteger(level) || level < 1 || level > LEVELS || outcome < 0) throw Error('Fight record: unknown level or outcome');
  if (skill < 0) throw Error('Fight record: unknown skill');
  const n = r.ticks, head = 3 + 1 + build.length + 1 + opp.length + 1 + wpn.length + 1 + 1 + 1 + 4 + 4 + 1, out = new Uint8Array(head + 6 * n), dv = new DataView(out.buffer);
  let o = 0;
  out[o++] = 0x46; out[o++] = 0x4b; out[o++] = r.v;
  out[o++] = build.length; out.set(build, o); o += build.length;
  out[o++] = opp.length; out.set(opp, o); o += opp.length; out[o++] = wpn.length; out.set(wpn, o); o += wpn.length;
  out[o++] = skill; out[o++] = r.specials ? 1 : 0; out[o++] = level; dv.setUint32(o, r.seed >>> 0, true); o += 4; dv.setUint32(o, n, true); o += 4; out[o] = outcome;
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
  if (!(READABLE_VERSIONS as readonly number[]).includes(v)) throw Error(`Fight record: version ${v} is not supported (this build reads ${READABLE_VERSIONS.join(', ')}: the fight rules changed, so an older link would replay a different fight)`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 3;
  const str = () => { const len = bytes[o++]; if (o + len > bytes.length) throw Error('Fight record: truncated'); let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[o + i]); o += len; return s; };
  const build = str(), opponent = str() as OpponentId, weapon = str() as WeaponId;
  if (!PLAYER_WEAPONS.includes(weapon)) throw Error('Fight record: unknown weapon');   // the hero rig bakes blade tables for these only; an opponent-only weapon (maul, reaper) would throw inside the frame loop
  if (o + 1 + (v >= 21 ? 1 : 0) + 1 + 4 + 4 + 1 > bytes.length) throw Error('Fight record: truncated');
  const skill = SKILLS[bytes[o++]];   // undefined past the table: an unknown skill is refused, never read as none
  if (skill === undefined) throw Error('Fight record: unknown skill');
  const flag = v >= 21 ? bytes[o++] : 0;   // before version 21 there is no byte: no specials
  if (flag > 1) throw Error('Fight record: unknown specials flag');
  const level = bytes[o++], seed = dv.getUint32(o, true); o += 4; const n = dv.getUint32(o, true); o += 4; const outcome = OUTCOMES[bytes[o++]];
  if (level < 1 || level > LEVELS || !outcome) throw Error('Fight record: unknown level or outcome');
  for (let bump = v + 1; bump <= RECORD_VERSION; bump++) for (const r of REACH[bump] ?? []) if (opponent === r.opponent && level >= r.from)
    throw Error(`Fight record: version ${v} is not supported for the ${opponent} from level ${r.from} (bump ${bump} changed that fight, so an older link would replay a different fight)`);
  if (n > MAX_RECORD_TICKS) throw Error(`Fight record: ${n} ticks is past the ${MAX_RECORD_TICKS}-tick limit`);
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
  // The version PARSED, not the constant: returning `RECORD_VERSION` here would let a decode-then-repack silently relabel an older
  // record as this build's, and packRecord's guard above would then throw on a record this function had just called well-formed.
  return { v: v as RecordVersion, build, opponent, weapon, ...(skill ? { skill } : {}), level, seed, ...(flag ? { specials: true } : {}), ticks: n, outcome, intents };
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
// Public links reach the decoder, so every dimension is bounded: a compressed text limit (share-store MAX_STORED_CHARS, replay MAX_SHARE_CHARS)
// is not a limit on what it expands to. Thirty minutes at 60 Hz is far beyond any real duel; a stream past MAX_RECORD_BYTES is cancelled.
export const MAX_RECORD_TICKS = 108_000, MAX_RECORD_BYTES = 1_000_000;
async function pipe(bytes: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A fresh ArrayBuffer-backed copy (the stream wants a BufferSource). A failed write (bad gzip on decode) surfaces on the read side
  // below, so its own rejection is swallowed here rather than left unhandled.
  void writer.write(new Uint8Array(bytes)).then(() => writer.close()).catch(() => {});
  const parts: Uint8Array[] = [], reader = stream.readable.getReader();
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    total += value.length;
    if (total > MAX_RECORD_BYTES) { await reader.cancel(); throw Error(`Fight record: expands past ${MAX_RECORD_BYTES} bytes`); }
    parts.push(value);
  }
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
