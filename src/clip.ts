// Export clip (Dom's pick B, 2026-09-26; evidence/export-clip-mockups @ 6663c070): SHARE asks LINK or CLIP in the same slot; CLIP
// re-plays the fight's last seconds from its record on the arena canvas, records them at 720x1280 with the game audio and hands the
// file to the phone's share sheet. Nothing is drawn over the fight: the WebGL canvas never holds the HUD (that is DOM), so the clip
// has none. Zero dependencies: canvas.captureStream + MediaRecorder, MP4 where the browser records it, WebM elsewhere.
import { STEP } from './sim.ts';

export const CLIP_SECONDS = 12;
export const CLIP_HOLD = 3;   // of the 12: the frozen finish after the killing tick, while the finisher plays out
export const CLIP_WIDTH = 720, CLIP_HEIGHT = 1280;
const FPS = 30;

// The tick the re-play starts from: CLIP_SECONDS - CLIP_HOLD before the record's end (the killing tick), never before the first.
export const clipStartTick = (ticks: number) => Math.max(0, ticks - Math.round((CLIP_SECONDS - CLIP_HOLD) / STEP));

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
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.start(1000);
  let done = false;
  const finish = (keep: boolean) => new Promise<Blob | null>((resolve) => {
    if (done) { resolve(null); return; }
    done = true;
    recorder.onstop = () => { for (const track of stream.getVideoTracks()) track.stop(); resolve(keep && chunks.length ? new Blob(chunks, { type: type.split(';')[0] }) : null); };
    recorder.stop();
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
