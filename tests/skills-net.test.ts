import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valuesOf } from '../src/core/skills-net.ts';
import { createServerSkills } from '../src/core/skills-server.ts';

const row = (skill: string, value: number) => ({ skill, base: 5, ceiling: 11, xp: 0, value, focus: false });

test('skills_get answers are read by shape: a pool is skill -> value, anything malformed is null (never a half pool)', () => {
  assert.deepEqual(valuesOf({ skills: [row('fire', 7), row('sword', 5)] }), { fire: 7, sword: 5 });
  assert.deepEqual(valuesOf({ skills: [] }), {});
  for (const bad of [null, {}, { skills: 'x' }, { skills: [{ skill: 'fire' }] }, { skills: [row('fire', -1)] }, { skills: [row('fire', Number.NaN)] }, { skills: [row('', 3)] }, { skills: [{ ...row('fire', 3), value: '3' }] }])
    assert.equal(valuesOf(bad), null, JSON.stringify(bad));
});

test('a guest has no skill values and sends nothing', async () => {
  let sent = 0; const skills = createServerSkills({ storage: { getItem: () => null }, search: '', now: () => 0, fetch: (async () => { sent++; return new Response('{}'); }) as typeof fetch });
  assert.deepEqual(skills.values(), {}); assert.deepEqual(await skills.refresh(), {}); assert.equal(sent, 0);
});
