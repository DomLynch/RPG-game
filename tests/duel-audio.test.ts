import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { DUEL_CUES, loadDuel } from '../src/fight/sound/duel.ts';

const dir = new URL('../src/assets/duel-audio/', import.meta.url);
test('each duel lobby cue ships in both formats, tiny, and the set stays inside its budget', () => {
  let total = 0;
  for (const cue of DUEL_CUES) for (const ext of ['ogg', 'm4a']) {
    const bytes = fs.readFileSync(new URL(`${cue}.${ext}`, dir)), gzip = gzipSync(bytes).length; total += bytes.length;
    assert.ok(bytes.length > 500, `${cue}.${ext} is present`);
    assert.ok(gzip <= 20_000, `${cue}.${ext} is ${gzip} B gzip; a lobby cue is 0.3-2 s and stays under 20 kB per format`);
  }
  assert.equal(fs.readdirSync(dir).filter((f) => /\.(ogg|m4a)$/.test(f)).length, DUEL_CUES.length * 2, 'one ogg and one m4a per cue, nothing stray');
  assert.ok(total <= 80_000, `the ${DUEL_CUES.length} cues are ${total} B raw; the set stays under 80 kB (71 kB today)`);
});

const decoded = { duration: 1 } as AudioBuffer;
const okFetch = (log: string[]) => (async (url: string) => { log.push(url.slice(url.lastIndexOf('/') + 1)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response; }) as unknown as typeof fetch;
const context = (fail = false) => ({ decodeAudioData: async () => { if (fail) throw new Error('unsupported'); return decoded; } }) as unknown as BaseAudioContext;

test('loadDuel fetches the named cue, falls back to the other codec, and stays silent when nothing decodes or the page is leaving', async () => {
  for (const cue of DUEL_CUES) {
    const log: string[] = [];
    assert.equal(await loadDuel(cue, context(), ['opus', 'aac'], okFetch(log), () => false), decoded);
    assert.deepEqual(log, [`${cue}.ogg`]);
  }
  const none: string[] = [];
  assert.equal(await loadDuel('win', context(true), ['opus', 'aac'], okFetch(none), () => false), null);
  assert.deepEqual(none, ['win.ogg', 'win.m4a']);
  const leaving: string[] = [];
  assert.equal(await loadDuel('go', context(), ['opus', 'aac'], okFetch(leaving), () => true), null);
  assert.deepEqual(leaving, []);
});
