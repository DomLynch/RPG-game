import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group } from 'three';
import { MissingClip, buildWarriors } from '../src/fight/characters.ts';

// A creature body handed a two-handed weapon whose clip pack it does not carry must fail with a named error (the sandbox saw the capsule: Lead, 2026-10-18), never build quietly.
test('a rig without the weapon\'s clips throws MissingClip naming the clip, the role and the weapon', () => {
  const rig = { scene: new Group(), animations: [] };
  assert.throws(() => buildWarriors(rig, undefined, ['warhammer', 'warhammer'], true), (error: unknown) => {
    assert.ok(error instanceof MissingClip, 'a MissingClip, not a bare Error');
    assert.equal(error.name, 'MissingClip');
    assert.equal(error.weapon, 'warhammer');
    assert.match(error.clip, /^Warhammer_/);
    assert.match(error.message, new RegExp(error.clip));
    return true;
  });
});

// The player's frame must never throw or retry on it: the zone view logs the error once, marks the kind failed (so dress() is not run again) and returns.
test('the zone creature view logs a missing clip, marks the kind failed and returns: no rethrow', () => {
  const src = readFileSync(new URL('../origins/preview/mobs-view.ts', import.meta.url), 'utf8');
  const start = src.indexOf('catch (error) {', src.indexOf('buildWarriors({ scene: body.scene'));
  const handler = src.slice(start, src.indexOf('\n    }\n', start));
  assert.match(handler, /error instanceof MissingClip\) console\.error/);
  assert.match(handler, /bodies\.set\(s\.body, 'failed'\); failedKinds\.add\(s\.body\); return;/);
  assert.doesNotMatch(handler, /\bthrow\b/);
});
