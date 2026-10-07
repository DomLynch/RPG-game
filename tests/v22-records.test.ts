// RV29 (2026-10-07): REACH[29] lists every opponent from level 1, so a shared kill link written at v22 (the old-circle fight) is refused at decode; the page converts it into
// "Recorded on an older version of the game" with the warden's still and PLAY NOW (main.ts). Until RV29 these links replayed their own fight (the record's version picked
// the era flags: play-radius.ts, stab-rule.ts, detmath.ts underRecord); the pinned outcome and state hashes of that replay are in the git history of this file.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeRecord } from '../src/record.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v22-records.json', import.meta.url), 'utf8')) as { records: { opponent: string; encoded: string }[] };

test('every v22 reference record is refused with the RV29 reach message, never replayed as another fight', async () => {
  assert.ok(fixture.records.length > 0);
  for (const f of fixture.records) await assert.rejects(decodeRecord(f.encoded), new RegExp(`^Error: Fight record: version 22 is not supported for the ${f.opponent} from level 1 \\(bump 29 changed that fight`), `${f.opponent}: refused`);
});
