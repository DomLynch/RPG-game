import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SPECIAL_CUES, loadSpecial } from '../src/audio/special.ts';

const dir = new URL('../src/assets/special-audio/', import.meta.url);
test('each special cue ships in both formats, tiny, inside the lane budget', () => {
  for (const cue of SPECIAL_CUES) for (const ext of ['ogg', 'm4a']) {
    const bytes = fs.readFileSync(new URL(`${cue}.${ext}`, dir)), gzip = gzipSync(bytes).length;
    assert.ok(bytes.length > 1000, `${cue}.${ext} is present`);
    assert.ok(gzip <= 25_000, `${cue}.${ext} is ${gzip} B gzip; a special cue is 1-3 s and stays under 25 kB per format`);
  }
});

const decoded = { duration: 1 } as AudioBuffer;
const okFetch = (log: string[]) => (async (url: string) => { log.push(url.slice(url.lastIndexOf('/') + 1)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response; }) as unknown as typeof fetch;
const context = (fail = false) => ({ decodeAudioData: async () => { if (fail) throw new Error('unsupported'); return decoded; } }) as unknown as BaseAudioContext;

test('loadSpecial fetches the named cue, falls back to the other codec, and stays silent when nothing decodes or the page is leaving', async () => {
  for (const cue of SPECIAL_CUES) {
    const log: string[] = [];
    assert.equal(await loadSpecial(cue, context(), ['opus', 'aac'], okFetch(log), () => false), decoded);
    assert.deepEqual(log, [`${cue}.ogg`]);
  }
  const none: string[] = [];
  assert.equal(await loadSpecial('charge', context(true), ['opus', 'aac'], okFetch(none), () => false), null);
  assert.deepEqual(none, ['charge.ogg', 'charge.m4a']);
  const leaving: string[] = [];
  assert.equal(await loadSpecial('tithe', context(), ['opus', 'aac'], okFetch(leaving), () => true), null);
  assert.deepEqual(leaving, []);
});
