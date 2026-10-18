// sandbox: the LOOK of the four melee specials resolves for every melee weapon: the skill row's specialClip names a clip row, that row lists the weapon (otherwise the swing silently plays the weapon's own Heavy / Attack / Thrust),
// its baked clip file exists, and a two-handed weapon has a grip gap row so the left hand stays on the haft. (The sim side is tests/sandbox-special-weapons.test.ts.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import SKILLS from '../src/fight/skill-defs.json' with { type: 'json' };
import CLIPS from '../src/assets/special-clips.json' with { type: 'json' };

const MELEE = ['longsword', 'trident', 'cleaver', 'estoc', 'knife', 'gladius', 'scythe', 'maul', 'warhammer'];
const TWO_HANDED = ['trident', 'scythe', 'maul', 'warhammer'];   // one-handed clips on a two-handed haft need holdHaft
const skills = (SKILLS as unknown as { skills: { id: string; specialClip?: string }[] }).skills;
const rows = (CLIPS as unknown as { clips: { role: string; file: string; weapons: string[]; strike: number }[]; twoHanded?: Record<string, number> });

for (const skill of ['cleave', 'reaping', 'stomp', 'lunge']) for (const weapon of MELEE) test(`${skill} has its own animation on the ${weapon}`, () => {
  const role = skills.find((s) => s.id === skill)?.specialClip;
  assert.ok(role, `the ${skill} skill row names a specialClip`);
  const row = rows.clips.find((c) => c.role === role);
  assert.ok(row, `a clip row for ${role}`);
  assert.ok(row.weapons.includes(weapon), `${role} lists the ${weapon} (else it plays the weapon's own swing)`);
  assert.ok(fs.existsSync(new URL(`../src/assets/${row.file}`, import.meta.url)), `${row.file} is baked`);
  assert.ok(row.strike > 0 && row.strike < 1, 'a strike fraction');
  if (TWO_HANDED.includes(weapon)) assert.ok((rows.twoHanded?.[weapon] ?? 0) > 0, `a haft grip gap for the ${weapon}`);
});
