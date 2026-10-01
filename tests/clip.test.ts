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
import { CLIP_FINISH_CAP, CLIP_HEIGHT, CLIP_LEAD, CLIP_SECONDS, CLIP_TAIL, CLIP_WIDTH, clipEnded, clipFileName, clipStartTick, clipType, cropRect, recordClip } from '../src/clip.ts';
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
    match.level = 46;   // a journal change after the fight: the re-play still runs on the record's profile
    const saved = match.startClip(record, clipStartTick(record.ticks));
    assert.ok(match.replay && !match.practice.finish, 'the re-play starts before the finish');
    const noLive = () => { throw new Error('a clip steps the record, never live input'); };
    while (match.replay!.cursor < record.ticks) assert.equal(match.step(noLive), 'stepped', 'the re-play never ends the fight again');
    assert.equal(JSON.stringify(match.practice.finish), JSON.stringify(final.finish), 'the same finish as the fight');
    assert.equal(match.practice.duel.tick, final.duel.tick);
    // B2 (Lead 2026-09-30): past the killing tick the clip plays on, as a watched replay does, so the finisher and the kill camera
    // move in it. Until then it stalled here and the clip's last seconds were one still frame.
    for (let i = 0; i < 300; i++) assert.equal(match.step(noLive), 'stepped', 'the clip plays on through the finish');
    assert.equal(match.practice.duel.tick, final.duel.tick + 300); assert.equal(match.stalled, false);
    assert.equal(JSON.stringify(match.practice.finish), JSON.stringify(final.finish), 'the dead stay down: the same finish');
    match.endClip(saved);
    assert.equal(match.practice, final, 'the final picture is back');
    assert.equal(match.replay, null); assert.equal(match.stalled, false); assert.equal(match.level, 46);
    assert.equal(match.lastRecord, record); assert.equal(match.epoch, epoch); assert.equal(match.mode, mode);
    assert.equal(storage.writes(), writes, 'a clip writes nothing');
    assert.equal(match.end(false).rewarded, false, 'the fight is still ended once');
    // A start mid-clip (sparring, a rearm: began() drops the clip without endClip) fights on the player's own profile.
    // A record that runs out BEFORE its finish (another build stepped it differently) still stalls: the page stops it at the cap.
    const short = { ...record, ticks: record.ticks - 30 };
    match.startClip(short, clipStartTick(short.ticks));
    const cursor = (m: Match) => m.replay?.cursor ?? Infinity;   // read fresh: an earlier assert narrowed match.replay to null
    while (cursor(match) < short.ticks) match.step(noLive);
    assert.equal(match.step(noLive), 'stalled'); assert.equal(match.practice.finish, null);
    match.endClip(saved);
    match.startClip(record, clipStartTick(record.ticks)); match.rematch();
    assert.equal(match.level, 46); assert.equal(match.replay, null);
    assert.ok(match.recorder); assert.equal(match.recorder!.meta.level, 46, 'the next fight records the player\'s profile, not the clip\'s');
    checked++;
  }
  assert.ok(checked >= 2, `too few finished fights to check (${checked})`);
});

test('clip: 5 s before the kill (B4: the wait is the clip); the start never goes before the first tick', () => {
  assert.equal(CLIP_LEAD, 5); assert.equal(CLIP_SECONDS, 10);
  assert.equal(clipStartTick(2000), 2000 - 300);
  assert.equal(clipStartTick(200), 0);
});

test('clip: it ends 1 s after the finish has played, or at the cap after the kill; never before the kill (B2)', () => {
  assert.equal(CLIP_TAIL, 1); assert.equal(CLIP_FINISH_CAP, 8);
  assert.equal(clipEnded(null, null, 1e9), false, 'still before the kill');
  assert.equal(clipEnded(1000, null, 1000 + 3000), false, 'not the old fixed 3 s: the finisher is still playing');
  assert.equal(clipEnded(1000, 5120, 5120 + 999), false, 'the 1 s tail after the longest finisher (Run Through, 4.12 s)');
  assert.equal(clipEnded(1000, 5120, 5120 + 1000), true);
  assert.equal(clipEnded(1000, null, 1000 + 8000), true, 'a finish that never reports complete stops at the cap');
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

test('clip: SHARE and CLIP show at once in the two slots left of Rematch (one tap, Dom 2026-09-28); no SHARE step', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['share-status', 'share-link', 'clip-button']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!html.includes('id="share-button"'), 'the SHARE step that led to LINK and CLIP is gone');
  assert.match(html, /id="share-link"[^>]*>.*?<span>LINK<\/span><\/button>/, 'SHARE is renamed LINK (Strategy 2026-10-02: DUEL, LINK, CLIP)');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /#share-link \{ left: -155px; \}/); assert.match(css, /#clip-button \{ left: -81px; \}/);
  assert.match(css, /:root\.endgame-hush \.clip-pick,/, 'SHARE and CLIP fade during the finisher');
  // Lead 2026-09-27: a made clip waiting for SEND (:root.clip-ready) keeps LINK + SEND live through the tour, in both the opacity and
  // the pointer-events rule; Rematch keeps the plain fade. The browser half is scripts/clip-send-tour-check.mjs.
  assert.equal(css.match(/:root\.endgame-fade:not\(\.clip-ready\) \.clip-pick,/g)?.length, 2, 'the exemption sits in both fade rules');
  assert.match(css, /:root\.endgame-fade #reset-button,/);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /classList\.toggle\('clip-ready', state === 'ready'\)/, 'clip-ready lives exactly as long as SEND');
});

// iPhone half of Export clip (Lead 2026-09-28): a phone's MediaRecorder can list a type and still refuse it, or error mid-clip. Neither may
// leave the capture running or CLIP stuck on "Making the clip…": a refusal throws to main.ts (which says so), an error makes no file.
test('clip: a recorder that refuses throws with the capture stopped; one that errors mid-clip resolves no file', async () => {
  const stopped: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const saved = { MediaRecorder: g.MediaRecorder, document: g.document };
  const frame = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), captureStream: () => ({ getVideoTracks: () => [{ stop: () => stopped.push('video') }], getAudioTracks: () => [], addTrack() {} }) };
  g.document = { createElement: () => frame };
  let refuse = true;
  const made: FakeRecorder[] = [];
  class FakeRecorder {
    static isTypeSupported = () => true;
    state = 'inactive'; onstop: ((e: Event) => void) | null = null; onerror: (() => void) | null = null; ondataavailable: ((e: { data: Blob }) => void) | null = null;
    constructor() { if (refuse) throw new DOMException('refused', 'NotSupportedError'); made.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.ondataavailable?.({ data: new Blob(['x']) }); this.state = 'inactive'; this.onstop?.(new Event('stop')); }
  }
  g.MediaRecorder = FakeRecorder;
  try {
    const canvas = { width: 390, height: 844 } as HTMLCanvasElement;
    assert.throws(() => recordClip(canvas, null), /refused/);
    assert.deepEqual(stopped, ['video'], 'the capture track stops when the recorder refuses');
    refuse = false;
    assert.ok(await recordClip(canvas, null).stop(), 'a clean recording makes a file');
    const broken = recordClip(canvas, null);
    made.at(-1)!.onerror!();   // the phone's recorder fails mid-clip
    assert.equal(await broken.stop(), null, 'an errored recording makes no file (main.ts says "Couldn\'t make the clip")');
  } finally { g.MediaRecorder = saved.MediaRecorder; g.document = saved.document; }
});
