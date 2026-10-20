import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// The chain that makes a wielded weapon the one the world fight swings and records (found by the guest live check on /zone1/, 2026-10-20, K5p): the gear sheet's main hand (gear-mount.ts weapon(): the
// server's ledger for a signed-in character, the session bag for a guest) -> main.ts syncRigWeapon sets rigWeapon from it -> hero() hands rigWeapon to the world sim -> world-combat.ts heroBody
// records it. Each link is pinned on the source text, as the single-frame-step pin in origins/preview/world-combat.test.ts is: a link that stops reading the one before it fails here, not in a fight.
const text = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = text('../origins/preview/main.ts'), worldCombat = text('../src/fight/world-combat.ts'), gear = text('../origins/preview/gear-mount.ts');

test('the rig weapon is the gear sheet\'s main hand (the forced weapon of a browser check aside)', () => {
  assert.match(main, /const want = forcedWeapon && ZONE_CARRIED\.includes\(forcedWeapon\) \? forcedWeapon : gearMount\?\.weapon\(ZONE_CARRIED\) \?\? DEFAULT_WEAPON;/, 'syncRigWeapon wants gearMount.weapon(ZONE_CARRIED)');
  assert.match(main, /rigWeapon = next\.playerWeapon/, 'and the rig it built is what rigWeapon reads');
});

test('hero() hands the world sim the rig weapon, and the world record carries what the sim was given', () => {
  assert.match(main, /hero: \(\) => \{[^\n]*return \{ level: [^\n]*weapon: rigWeapon/, 'main.ts hero() returns weapon: rigWeapon');
  assert.match(worldCombat, /const heroBody = \(\): RecordHero => \{[^\n]*weapon: mine\(\)\.weapon \?\? DEFAULT_WEAPON/, 'world-combat.ts heroBody records mine().weapon, mine() being the page\'s hero()');
  assert.match(worldCombat, /const mine = \(\)[^\n]*=> d\.hero\?\.\(\) \?\? \{ level: 1 \}/, 'and mine() is d.hero()');
});

test('the gear sheet answers for a guest with the session weapon, not the longsword, while the server view is not ready', () => {
  assert.match(gear, /weapon: \(carried: readonly WeaponId\[\]\): WeaponId => \(server\?\.ready\(\) \? fightWeapon\([^\n]*\) : d\.signedIn\?\.\(\) === false \? guestWeapon\(/, 'gear-mount.ts weapon() reads guestWeapon for a signed-out page');
});
