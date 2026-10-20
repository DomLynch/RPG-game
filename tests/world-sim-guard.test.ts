// The world-fight guard (Combat, 2026-10-13): Zone 1's combat loop (src/fight/world.ts stepCombat over open-fight.ts stepBout) is replayed by the server from a world record (src/fight/world-record.ts). If any file
// that decides how that loop plays changes without WORLD_SIM_VERSION changing, a record the page minted before the change replays a different fight and an honest kill is refused. This is the Pit guard's shape
// (tests/record-version-guard.test.ts) for the world files, kept SEPARATE: the Pit digest is pinned at a live RECORD_VERSION, so adding these files there would force a Pit bump (and kill every kill link) for a change
// that moves no Pit fight. The Pit's own RECORD_VERSION is hashed in, so a Pit sim bump also moves this digest: a world replay runs stepDuel.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { WORLD_SIM_VERSION } from '../src/fight/world-record.ts';
import { simDigest } from './lib/sim-digest.ts';

const WORLD_SIM_FILES = ['src/fight/creature-motion-defs.json', 'src/fight/creature-motion-defs.manifest.json', 'src/fight/creature-motion-rows.ts', 'src/fight/sim-bounds-defs.json', 'src/fight/sim-bounds-defs.manifest.json', 'src/fight/sim-bounds-rows.ts', 'src/fight/world.ts', 'src/fight/open-fight.ts', 'src/fight/world-record.ts', 'src/fight/speeds.ts', 'src/fight/attackers.ts', 'src/fight/world-rules.ts', 'src/fight/world-rules-defs.json', 'src/fight/world-rules-defs.manifest.json', 'src/fight/gear-caps.ts', 'src/fight/catalogue-fields.ts', 'src/fight/catalogue-data.ts', 'src/fight/catalogue-defs.ts', 'src/fight/threat.ts', 'src/fight/threat-defs.json'];
const WORLD_DIGEST = 'a46030de6e2644f90e458c5baa36d583c757d8a1997e8f747ece691aa3b538a8';   // WSV 63 RV84 (2026-10-20, Combat): the open world's picked specials and the added band rows; the WSV 62 digest was 9c7fc09f730583cbd5ae59197aa65612dd57978d2fe2b3f3bae0b4876b706e78. // WSV 62 RV83 (2026-10-19, Combat): the open world's bow hero carries the special share (open-fight.ts heroSheeted); the WSV 61 digest was 0288a3ba5a014e752eac269c3ba4a17607c476c446b264639d715de88573bcf9. // WSV 61 RV82 (2026-10-19, Characters): the Pit's RECORD_VERSION 82 is hashed in; the WSV 60 digest was 20df717cc506ad444eb341ed657ef9aaf7a62a3f3a98f117f36ca16a555f48c1. //   // WSV 60 RV81 (2026-10-19, Combat): the Pit's RECORD_VERSION 81 (the world's fights carry the player's stance). // WSV 59 RV80 (2026-10-19, Combat): the Pit's RECORD_VERSION 80 (leathers shape, special timers) and the open world's first special on the era-keyed 2 s (world.ts withSpecial; was the rules' 20 s). was ec6ac52c... at WSV 58 //   // WSV 58 damage ledger (2026-10-19, Backend: the replay returns the hero's damage per creature; behaviour of the sim unchanged), was 7d69d5d6... at WSV 57 // WSV 57 RV79 sandbox rows (2026-10-19, Combat: stances 2x, reach bands live, plate shape era 79; Dom-approved 2026-10-18), was f2c6d621... at WSV 56 // WSV 56 BULK-CS (2026-10-19, Combat: the Pit's RV78 sandbox era reaches the world's bouts; WSV 56 was never shipped, so the pin moves), was 95204725... at WSV 55 // WSV 55 (2026-10-18, Combat, melee specials, RV77), was 4d5d255d... // WSV 54 (2026-10-18, Combat, P0-b record window: hunting-only joins, joinWait, a stream dropped at the window open, RecordHero.hurt), was bc1668a15b79... at WSV 53 // WSV 53 (2026-10-17, Combat, balance rows, RV76), was 25508faf1b42... at WSV 52 //WSV 52 (2026-10-17, Combat, the sim batch + SPECIAL 1/2 in the world record, rebased on IC ad1a13adc, final pin of the stack: creature-motion rows + sim-bounds / ai-dial rows + leaveWait / turnGate; RV75), was c62d98d48ba3 at WSV 51 (2026-10-17, gear in the world: RV74 leathers era; was b0f455ff... at WSV 50) // WSV 50 (evade: the whiff counter, RV73; read from a clean HF clone), was d184dcdd... at WSV 49 (many-on-one, RV73), 3f0ee0a3... at WSV 48   // WSV 48 (the Cave Troll's boss special, RV 72, provisional); was WSV 47 (giant salamander row, RV 71), WSV 46 (cave troll row, RV 70), WSV 45 (spell combat slice 1, RV 69); was dc47bbb23dd232f164aba252b6d8eb462da7360a1a92e393a10b66ebca7301ce -- WSV 41 (positioning bands, RV 65, on GJ); was WSV 40 (spell cost cap, RV 64) -- WSV 39 (positioning bands, RV 64, provisional); was WSV 38 --    // WSV 38 (Combat, Gothic tactic table PR 1, RV 63: the Pit's RV is hashed in, no world file changed). Before: WSV 37 (Combat sim batch B, RV 62). WSV 36 (World: core world rows)
const PINNED_FOR_VERSION = 63;

const sources = (): Record<string, string> => ({ ...Object.fromEntries(WORLD_SIM_FILES.map((f) => [f, readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')])), 'resolved/pit-record-version.txt': String(RECORD_VERSION) });

test('a world-sim change without a WORLD_SIM_VERSION bump would refuse every honest world record', () => {
  const digest = simDigest(sources(), { world: true });
  assert.ok(WORLD_SIM_VERSION >= PINNED_FOR_VERSION, 'WORLD_SIM_VERSION went backwards');
  assert.ok(digest === WORLD_DIGEST ? WORLD_SIM_VERSION === PINNED_FOR_VERSION : WORLD_SIM_VERSION > PINNED_FOR_VERSION,
    `The world sim files (or the Pit's RECORD_VERSION ${RECORD_VERSION}) changed (digest ${digest}) but WORLD_SIM_VERSION is still ${WORLD_SIM_VERSION}. Bump WORLD_SIM_VERSION in src/fight/world-record.ts, then set WORLD_DIGEST = '${digest}' and PINNED_FOR_VERSION = ${WORLD_SIM_VERSION + 1} here.`);
});

test('the digest sees a number inside a world function, and a Pit RECORD_VERSION bump', () => {
  const real = sources(), before = simDigest(real, { world: true });
  assert.equal(simDigest(real, { world: true }), before, 'the digest is stable');
  assert.notEqual(simDigest({ ...real, 'src/fight/world.ts': real['src/fight/world.ts']!.replace('giveUpOf', 'giveUpOf + 1') }, { world: true }), before, 'a change in world.ts moves the digest');
  assert.notEqual(simDigest({ ...real, 'resolved/pit-record-version.txt': String(RECORD_VERSION + 1) }, { world: true }), before, 'a Pit bump moves the digest');
});

test('a world-read catalogue value (a goblin\'s atOnce, a creature\'s leash) moves the digest: a retune needs a WORLD_SIM_VERSION bump', () => {
  const real = sources(), before = simDigest(real, { world: true }), data = real['src/fight/catalogue-data.ts']!;
  assert.ok(/atOnce: 2/.test(data), 'the goblin row carries atOnce');
  assert.notEqual(simDigest({ ...real, 'src/fight/catalogue-data.ts': data.replace('atOnce: 2', 'atOnce: 3') }, { world: true }), before, 'atOnce 2 -> 3 moves the world digest');
  assert.notEqual(simDigest({ ...real, 'src/fight/catalogue-data.ts': data.replace(/leash: (\d+)/, (_m, n) => `leash: ${Number(n) + 1}`) }, { world: true }), before, 'a leash value moves it');
});
