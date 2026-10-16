// A headless presence client for tests and release rows (Web builds the two-client release row on this): it opens a real WebSocket to a presence server, speaks the v2 whole-world frame (or v1
// when asked), keeps the newest down packet, and poses in METRES of the Concord frame so a test never touches the u16 centimetres. No DOM, no storage; node's global WebSocket.
import { decodeDown, encodeUp, type Entity } from './wire.ts';
import { LEGACY_CENTRE_CM, LEGACY_SPAN_CM, PROTOCOL, PROTOCOL_V2 } from './frame.ts';

export type Frame = { centreCm: number; sizeCm: number };
export type Hello = { t: 'hello'; id: number; layer: number; x: number; z: number; frame?: Frame; guest?: boolean };
export type Seen = { id: number; x: number; z: number; heading: number; anim: number; flags: number };   // metres, the same shape the page's `others` carries
export type Bot = {
  hello: Hello; frame: Frame;
  /** The entities in the newest down packet, in metres. */
  seen(): Seen[];
  /** One pose (metres, heading in the wire's byte); the server snaps or drops a pose it cannot accept. */
  pose(x: number, z: number, heading?: number): void;
  /** Where the server holds this bot now, in metres, from the newest hello. */
  at(): { x: number; z: number };
  /** Ask presence to move this bot to a landmark of the warp table (never a coordinate); `raw` sends any text frame, for the refusal tests. */
  warp(landmark: string): void;
  raw(text: string): void;
  /** How many hellos have arrived (the first join plus one per warp), and the close code once the socket is closed (null while open). */
  hellos(): number;
  /** The `enter` records received so far (who an id is: name, guest), and whether any arrived after a packet already carried that id. */
  entered(): { id: number; name: string | null; guest: boolean }[];
  enteredLate(): boolean;
  closeCode(): number | null;
  close(): void;
};

export function joinBot(port: number, token: string, opts: { v1?: boolean } = {}): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence`, opts.v1 ? [PROTOCOL, `token.${token}`] : [PROTOCOL_V2, PROTOCOL, `token.${token}`]);
    ws.binaryType = 'arraybuffer';
    const entered: { id: number; name: string | null; guest: boolean; afterEntities: boolean }[] = [];
    const announced = new Set<number>(), unannounced = new Set<number>();
    let closed: number | null = null, helloCount = 0, latest: Entity[] = [], hello: Hello | null = null, frame: Frame = { centreCm: LEGACY_CENTRE_CM, sizeCm: LEGACY_SPAN_CM };
    const toM = (cm: number): number => (cm - frame.centreCm) / 100;
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const m = JSON.parse(ev.data) as { t?: string; id?: number; name?: string | null; guest?: boolean };
        if (m.t === 'enter') { entered.push({ id: m.id!, name: m.name ?? null, guest: m.guest === true, afterEntities: unannounced.has(m.id!) }); announced.add(m.id!); unannounced.delete(m.id!); return; }
        if (m.t !== 'hello') return;
        hello = m as Hello; frame = hello.frame ?? frame; helloCount++;
        if (!settled) { settled = true; resolve(bot); }
        return;
      }
      const down = decodeDown(new Uint8Array(ev.data as ArrayBuffer));
      if (down) { latest = down.entities; for (const e of down.entities) if (!announced.has(e.id)) unannounced.add(e.id); }
    };
    let settled = false;
    ws.onerror = () => { if (!settled) { settled = true; reject(new Error('refused')); } };
    ws.onclose = (ev) => { closed = ev.code; if (!settled) { settled = true; reject(new Error('closed before hello')); } };
    const bot: Bot = {
      get hello() { return hello!; }, get frame() { return frame; },
      seen: () => latest.map((e) => ({ id: e.id, x: toM(e.x), z: toM(e.z), heading: e.heading, anim: e.anim, flags: e.flags })),
      pose: (x, z, heading = 0) => ws.send(encodeUp({ x: Math.round(frame.centreCm + x * 100), z: Math.round(frame.centreCm + z * 100), heading, anim: 0, flags: 0 })),
      at: () => ({ x: toM(hello!.x), z: toM(hello!.z) }),
      warp: (landmark) => ws.send(JSON.stringify({ t: 'warp', to: landmark })),
      raw: (text) => ws.send(text),
      hellos: () => helloCount,
      entered: () => entered.map(({ id, name, guest }) => ({ id, name, guest })),
      enteredLate: () => entered.some((n) => n.afterEntities),   // true if an entity of an id arrived before its `enter` (the order contract is broken)
      closeCode: () => closed,
      close: () => ws.close(),
    };
  });
}
