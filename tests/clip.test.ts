// Export clip B (src/clip.ts + Match.startClip/endClip, Dom 2026-09-26): the clip re-plays the ended fight's own record in place.
// The gates: the re-play reaches the same finish as the fight, never ends it a second time (no second reward, no second record),
// writes nothing, and endClip puts the kill screen's state back exactly (the record, the drop, the mode and the final picture).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { CLIP_HEIGHT, CLIP_HOLD, CLIP_SECONDS, CLIP_WIDTH, clipFileName, clipStartTick, clipType, cropRect } from '../src/clip.ts';
import { STRATEGIES, act, idle } from './strategies.ts';
import type { Duel } from '../src/duel.ts';

const counting = () => { const m = new Map<string, string>(); let writes = 0; return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { writes++; m.set(k, v); }, writes: () => writes }; };
const spam = (d: Duel) => {
  const p = d.fighters[0], w = d.fighters[1].body, dx = w.x - p.body.x, dz = w.z - p.body.z, gap = Math.hypot(dx, dz);
  return p.phase === 'sheathed' ? act('light') : gap > 1.9 ? { ...idle(), move: { x: dx / gap, z: dz / gap, yaw: 0, run: false } } : STRATEGIES['light spam']!(d);
};

test('clip: the re-play reaches the fight\'s own finish, is never ended twice, writes nothing, and endClip restores the kill screen', () => {
  let checked = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const storage = counting(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
    const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed);
    let result: string = 'stepped';
    for (let i = 0; i < 7200 && result === 'stepped'; i++) result = match.step(() => spam(match.practice.duel));
    if (result !== 'ended') continue;
    const ended = match.end(false), record = ended.record!;
    assert.ok(record);
    const final = match.practice, writes = storage.writes(), epoch = match.epoch, mode = match.mode;
    match.difficulty = 'hard';   // a journal change after the fight: the re-play still runs on the record's profile
    const saved = match.startClip(record, clipStartTick(record.ticks));
    assert.ok(match.replay && !match.practice.finish, 'the re-play starts before the finish');
    let steps = 0, last: string = 'stepped';
    while (last === 'stepped' && steps < 7200) { last = match.step(() => { throw new Error('a clip steps the record, never live input'); }); steps++; }
    assert.equal(last, 'stalled', 'the re-play runs out on the record, never ends the fight again');
    assert.equal(JSON.stringify(match.practice.finish), JSON.stringify(final.finish), 'the same finish as the fight');
    assert.equal(match.practice.duel.tick, final.duel.tick);
    match.endClip(saved);
    assert.equal(match.practice, final, 'the final picture is back');
    assert.equal(match.replay, null); assert.equal(match.stalled, false); assert.equal(match.difficulty, 'hard');
    assert.equal(match.lastRecord, record); assert.equal(match.epoch, epoch); assert.equal(match.mode, mode);
    assert.equal(storage.writes(), writes, 'a clip writes nothing');
    assert.equal(match.end(false).rewarded, false, 'the fight is still ended once');
    checked++;
  }
  assert.ok(checked >= 2, `too few finished fights to check (${checked})`);
});

test('clip: 12 s of which 3 are the frozen finish; the start never goes before the first tick', () => {
  assert.equal(CLIP_SECONDS, 12); assert.equal(CLIP_HOLD, 3);
  assert.equal(clipStartTick(2000), 2000 - 540);
  assert.equal(clipStartTick(300), 0);
});

test('clip: 720x1280, a 9:16 centre crop of any canvas', () => {
  assert.deepEqual([CLIP_WIDTH, CLIP_HEIGHT], [720, 1280]);
  assert.deepEqual(cropRect(1125, 2436), { x: 0, y: 218, w: 1125, h: 2000 });   // iPhone 375x812 at 3x: rows off top and bottom
  assert.deepEqual(cropRect(1920, 1080), { x: 656, y: 0, w: 608, h: 1080 });   // a desktop: the sides go
  for (const [w, h] of [[1125, 2436], [1920, 1080], [720, 1280]] as const) { const r = cropRect(w, h); assert.ok(Math.abs(r.w / r.h - 9 / 16) < 0.002); }
});

test('clip: MP4 first, WebM where the phone cannot, none when nothing records; the file is named for the warden', () => {
  assert.equal(clipType(() => true), 'video/mp4;codecs=avc1');
  assert.equal(clipType((t) => t.startsWith('video/webm')), 'video/webm;codecs=vp9,opus');
  assert.equal(clipType(() => false), null);
  assert.equal(clipType(() => { throw new Error('old WebKit'); }), null);
  assert.equal(clipFileName('video/mp4', 'veteran'), 'frankendom-veteran.mp4');
  assert.equal(clipFileName('video/webm;codecs=vp9,opus', 'veteran'), 'frankendom-veteran.webm');
});

test('clip: SHARE opens LINK and CLIP in its two slots; the ids the release scripts read are unchanged', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['share-button', 'share-status', 'share-link', 'clip-button']) assert.ok(html.includes(`id="${id}"`), id);
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /#share-link \{ left: -155px; \}/); assert.match(css, /#clip-button \{ left: -81px; \}/);
  assert.match(css, /:root\.endgame-fade \.clip-pick,/, 'LINK and CLIP fade with SHARE during the finisher');
});
