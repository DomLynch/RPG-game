import test from 'node:test';
import assert from 'node:assert/strict';
import { BODYTYPES, SPECIES } from '../src/fight/body-tables.ts';

// body-tables.ts's two tables are rows (body-tables-defs.json); the objects they give must be exactly the literals the file held before (key order included).
test('body-tables rows give exactly the BODYTYPES and SPECIES the file used to hold', () => {
  assert.deepEqual(BODYTYPES, { quadruped: { parts: [
    { id: 'head', bones: ['head', 'jaw'], vital: true, weight: 2, cuttable: true, parent: 'neck' },
    { id: 'neck', bones: ['neck'], vital: true, weight: 1, cuttable: true, parent: 'torso' },
    { id: 'torso', bones: ['spine2'], vital: true, weight: 5, cuttable: false },
    { id: 'foreL', bones: ['front_up_L'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
    { id: 'foreR', bones: ['front_up_R'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
    { id: 'hindL', bones: ['hind_up_L'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
    { id: 'hindR', bones: ['hind_up_R'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  ] } });
  assert.deepEqual(SPECIES, { beast: { blood: { start: '#5a0b0a', end: '#1c0403' }, decal: { id: 'blood-splat', sizeM: 0.5 }, spray: 1 } });
  assert.deepEqual(Object.keys(BODYTYPES.quadruped!.parts[0]!), ['id', 'bones', 'vital', 'weight', 'cuttable', 'parent']);
});
