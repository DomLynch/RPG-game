import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group } from 'three';
import { MissingClip, buildWarriors } from '../src/fight/characters.ts';

// A creature body handed a two-handed weapon whose clip pack it does not carry must fail loud with a named error (the sandbox saw the capsule: Lead, 2026-10-18), never build quietly.
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

test('the zone creature view logs a missing clip as an error and rethrows it; it does not keep a capsule for it', () => {
  const src = readFileSync(new URL('../origins/preview/mobs-view.ts', import.meta.url), 'utf8');
  assert.match(src, /error instanceof MissingClip\) \{ console\.error\([^\n]*throw error;/);
});
