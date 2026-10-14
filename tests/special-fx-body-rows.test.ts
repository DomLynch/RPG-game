// The Goblin's, the Dwarf shield's and the Executioner's effect pools and tunes as rows (special-fx-goblin.ts, special-fx-dwarf-shield.ts, special-fx-executioner.ts): every default is the literal the code held before (special-fx-body-rows.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specialFxBodyNum } from '../src/fight/special-fx-body-rows.ts';

test('the rows hold the values the files held before', () => {
  const was: Record<string, number> = {
    'goblin.puffs': 28,
    'goblin.specks': 44,
    'goblin.prints': 8,
    'goblin.ghost-since': 0.1,
    'goblin.scoop-ticks': 48,
    'goblin.dip': 0.22,
    'dwarf-shield.dust': 72,
    'dwarf-shield.grit': 48,
    'dwarf-shield.stride': 8,
    'dwarf-shield.night-cap': 0.4,
    'executioner.build': 30,
    'executioner.grit': 160,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(specialFxBodyNum(id), v, id);
  assert.throws(() => specialFxBodyNum('no-such-row'), /no row/);
});

test('the files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('special-fx-goblin.ts'), /PUFFS = 28|SCOOP_TICKS = 48/);
  assert.doesNotMatch(src('special-fx-dwarf-shield.ts'), /DUST = 72|NIGHT_CAP = 0\.4/);
  assert.doesNotMatch(src('special-fx-executioner.ts'), /BUILD = 30|GRIT = 160/);
});
