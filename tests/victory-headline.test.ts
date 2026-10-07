import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headlineFlag, victoryHeadline } from '../src/victory-headline.ts';
import type { CombatEvent } from '../src/duel.ts';

const ev = (type: CombatEvent['type'], actor: 0 | 1, target: 0 | 1, extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, type, actor, target, ...extra });
const hitOnMe = ev('Hit', 1, 0), parry = ev('Parried', 0, 1), perfect = ev('Blocked', 0, 1, { perfect: true }), plain = ev('Blocked', 0, 1), brokeHim = ev('PostureBroken', 0, 1);

test('?look=headline: absent by default, named in the look list', () => {
  assert.equal(headlineFlag(''), false);
  assert.equal(headlineFlag('?look=defence'), false);
  assert.equal(headlineFlag('?look=defence,headline'), true);
});

test('a win with no hit taken says so; a block (even with chip) is not a hit, a Hit or GuardBroken on the player ends it', () => {
  assert.equal(victoryHeadline([], 100), 'You never took a hit.');
  assert.equal(victoryHeadline([plain, ev('Blocked', 0, 1, { damage: 4 })], 100), 'You never took a hit.');
  assert.notEqual(victoryHeadline([hitOnMe], 100), 'You never took a hit.');
  assert.notEqual(victoryHeadline([ev('GuardBroken', 1, 0)], 100), 'You never took a hit.');
  assert.equal(victoryHeadline([ev('Hit', 0, 1)], 100), 'You never took a hit.', 'the player\'s own hits on him are not hits taken');
});

test('after a hit taken: two parries, two perfect blocks, two posture breaks, then a close finish; each from its own events, first match wins', () => {
  assert.equal(victoryHeadline([hitOnMe, parry, parry, parry], 70), 'Won on 3 parries.');
  assert.equal(victoryHeadline([hitOnMe, parry, perfect, perfect], 70), 'Won on 2 perfect blocks.', 'one parry is not two: the perfect blocks speak');
  assert.equal(victoryHeadline([hitOnMe, parry, perfect], 70), null, 'one of each earns nothing');
  assert.equal(victoryHeadline([hitOnMe, perfect, perfect], 70), 'Won on 2 perfect blocks.');
  assert.equal(victoryHeadline([hitOnMe, parry, parry, perfect, perfect], 70), 'Won on 2 parries.', 'parries rank above perfect blocks');
  assert.equal(victoryHeadline([hitOnMe, brokeHim, brokeHim], 70), 'You broke their posture 2 times.');
  assert.equal(victoryHeadline([ev('PostureBroken', 1, 0), ev('PostureBroken', 1, 0), hitOnMe], 70), null, 'his breaks of the player earn nothing');
  assert.equal(victoryHeadline([hitOnMe], 9.6), 'Won with 10 HP left.');
  assert.equal(victoryHeadline([hitOnMe], 21), null, 'nothing earned, nothing said');
  assert.equal(victoryHeadline([hitOnMe], 0), null, 'a dead player earns no win line');
});

test('the line is read from events only: it never touches the log it is given', () => {
  const log = [hitOnMe, parry, parry];
  const copy = JSON.stringify(log);
  victoryHeadline(log, 50);
  assert.equal(JSON.stringify(log), copy);
});

test('the HUD splices the headline before the rematch prompt of a win and leaves every other line alone (wiring pin)', async () => {
  const { readFileSync } = await import('node:fs');
  const hud = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8');
  assert.match(hud, /view\.headline \? practiceHint\(practice, foe, view\.legend\)\.replace\(' Ready for a rematch\?'/);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /const HEADLINE = headlineFlag\(window\.location\?\.search \?\? ''\)/);
  assert.match(main, /headline: HEADLINE && shown\.finish && !shown\.finish\.draw && shown\.playerHealth > 0 && !shown\.health && match\.mode !== 'pvp' && !match\.replay \? victoryHeadline\(match\.fightLog, shown\.playerHealth\) : null/);
});
