// Export clip (Dom's pick B, 2026-09-26; evidence/export-clip-mockups @ 6663c070): SHARE asks LINK or CLIP in the same slot; CLIP
// re-plays the fight's last seconds from its record on the arena canvas, records them at 720x1280 with the game audio and hands the
// file to the phone's share sheet. Nothing is drawn over the fight: the WebGL canvas never holds the HUD (that is DOM), so the clip
// has none. Zero dependencies: canvas.captureStream + MediaRecorder, MP4 where the browser records it, WebM elsewhere.
import { STEP } from './sim.ts';

export const CLIP_SECONDS = 12;   // the countdown's nominal length; the clip itself runs until the finish has played (clipEnded)
export const CLIP_LEAD = 9;   // seconds of fight before the killing tick
// After the kill the re-play plays on, as a watched replay does (Match.step), so the finisher and the kill camera move in the clip. It stops
// CLIP_TAIL seconds after the scene reports the ceremony complete (view.finishPhase().complete), or CLIP_FINISH_CAP seconds after the kill
// when that never comes (a record that ran out before its finish). Lead B2, 2026-09-30: Dom's clip froze on the killing tick for its last 3.5 s.
export const CLIP_TAIL = 1, CLIP_FINISH_CAP = 8;
export const clipEnded = (killedAt: number | null, completeAt: number | null, now: number) =>
  killedAt !== null && (now - killedAt >= CLIP_FINISH_CAP * 1000 || (completeAt !== null && now - completeAt >= CLIP_TAIL * 1000));
export const CLIP_WIDTH = 720, CLIP_HEIGHT = 1280;
const FPS = 30;

// The tick the re-play starts from: CLIP_LEAD before the record's end (the killing tick), never before the first.
export const clipStartTick = (ticks: number) => Math.max(0, ticks - Math.round(CLIP_LEAD / STEP));

// The first type this browser records: MP4 (iOS Safari, recent Chrome) shares everywhere; WebM is the fallback (Dom: WebM is fine).
export const CLIP_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const clipType = (supported: (type: string) => boolean) => CLIP_TYPES.find((type) => { try { return supported(type); } catch { return false; } }) ?? null;
export const clipFileName = (type: string, opponent: string) => `frankendom-${opponent}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;

// The 9:16 centre crop of a source frame (source pixels): a phone's taller canvas loses rows top and bottom, a wide one loses sides.
export function cropRect(width: number, height: number) {
  const target = CLIP_WIDTH / CLIP_HEIGHT;
  if (width / height > target) { const w = Math.round(height * target); return { x: Math.round((width - w) / 2), y: 0, w, h: height }; }
  const h = Math.round(width / target);
  return { x: 0, y: Math.round((height - h) / 2), w: width, h };
}

export const clipSupported = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && clipType((t) => MediaRecorder.isTypeSupported(t)) !== null;

// One recording. draw() copies the arena canvas into the 720x1280 frame; call it right after the WebGL render, in the same task,
// while the drawing buffer is still valid. stop() resolves the file; cancel() drops it.
export function recordClip(source: HTMLCanvasElement, audio: MediaStream | null) {
  const type = clipType((t) => MediaRecorder.isTypeSupported(t))!;
  const frame = document.createElement('canvas');
  frame.width = CLIP_WIDTH; frame.height = CLIP_HEIGHT;
  const context = frame.getContext('2d')!;
  const stream = frame.captureStream(FPS);
  for (const track of audio?.getAudioTracks() ?? []) stream.addTrack(track);
  // A browser that lists the type but refuses it here (a phone's MediaRecorder can throw on the options or on start) throws to the
  // caller, which says so; the capture track is stopped first so nothing keeps recording.
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 }); recorder.start(1000); } catch (error) { for (const track of stream.getVideoTracks()) track.stop(); throw error; }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  let done = false, failed = false;
  recorder.onerror = () => { failed = true; };   // a recorder that errors mid-clip makes no file: stop() resolves null, never hangs on "Making the clip…"
  const finish = (keep: boolean) => new Promise<Blob | null>((resolve) => {
    if (done) { resolve(null); return; }
    done = true;
    recorder.onstop = () => { for (const track of stream.getVideoTracks()) track.stop(); resolve(keep && !failed && chunks.length ? new Blob(chunks, { type: type.split(';')[0] }) : null); };
    if (recorder.state === 'inactive') recorder.onstop(new Event('stop')); else recorder.stop();
  });
  return {
    type,
    draw() {
      if (done || !source.width || !source.height) return;
      const r = cropRect(source.width, source.height);
      context.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, CLIP_WIDTH, CLIP_HEIGHT);
    },
    stop: () => finish(true),
    cancel: () => { void finish(false); },
  };
}
export type ClipRecording = ReturnType<typeof recordClip>;
