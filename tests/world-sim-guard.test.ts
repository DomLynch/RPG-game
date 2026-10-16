// The world-fight guard (Combat, 2026-10-13): Zone 1's combat loop (src/fight/world.ts stepCombat over open-fight.ts stepBout) is replayed by the server from a world record (src/fight/world-record.ts). If any file
// that decides how that loop plays changes without WORLD_SIM_VERSION changing, a record the page minted before the change replays a different fight and an honest kill is refused. This is the Pit guard's shape
// (tests/record-version-guard.test.ts) for the world files, kept SEPARATE: the Pit digest is pinned at a live RECORD_VERSION, so adding these files there would force a Pit bump (and kill every kill link) for a change
// that moves no Pit fight. The Pit's own RECORD_VERSION is hashed in, so a Pit sim bump also moves this digest: a world replay runs stepDuel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { WORLD_SIM_VERSION } from '../src/fight/world-record.ts';
import { simDigest } from './lib/sim-digest.ts';

const WORLD_SIM_FILES = ['src/fight/world.ts', 'src/fight/open-fight.ts', 'src/fight/world-record.ts', 'src/fight/speeds.ts', 'src/fight/attackers.ts', 'src/fight/world-rules.ts', 'src/fight/world-rules-defs.json', 'src/fight/world-rules-defs.manifest.json', 'src/fight/gear-caps.ts', 'src/fight/catalogue-fields.ts', 'src/fight/catalogue-data.ts', 'src/fight/catalogue-defs.ts', 'src/fight/threat.ts', 'src/fight/threat-defs.json'];
const WORLD_DIGEST = '3f0ee0a3ff11c0cf5a6c5de64adea69f578f94bc0c247f5beaa451b05a82a3ad';   // WSV 48 (the Cave Troll's boss special, RV 72, provisional); was WSV 47 (giant salamander row, RV 71), WSV 46 (cave troll row, RV 70), WSV 45 (spell combat slice 1, RV 69); was dc47bbb23dd232f164aba252b6d8eb462da7360a1a92e393a10b66ebca7301ce -- WSV 41 (positioning bands, RV 65, on GJ); was WSV 40 (spell cost cap, RV 64) -- WSV 39 (positioning bands, RV 64, provisional); was WSV 38 --    // WSV 38 (Combat, Gothic tactic table PR 1, RV 63: the Pit's RV is hashed in, no world file changed). Before: WSV 37 (Combat sim batch B, RV 62). WSV 36 (World: core world rows)
const PINNED_FOR_VERSION = 48;

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
