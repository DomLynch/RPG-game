// The signed-in character's build (Backend #2426) as the page holds it: the server's copy only. A guest, a failed sign-in or a writer that does not answer has no build here (null), and the
// page shows nothing to place. No DOM: the page hands in storage, the clock and fetch, as createServerGear does.
import { getBuild, isOffline, setBuild, type BuildView } from './build-net.ts';
import { storedToken, writerBase } from './writer-call.ts';
import { openCharacter } from './open.ts';

type Deps = { storage: { getItem(key: string): string | null } | null; search: string; now: () => number; fetch?: typeof fetch };
export type SaveOutcome = 'saved' | 'moved' | 'spent' | 'offline';
export function createServerBuild(d: Deps) {
  let character: string | null = null, view: BuildView | null = null;
  const opts = () => ({ base: writerBase(d.search), timeoutMs: 8000, ...(d.fetch ? { fetch: d.fetch } : {}) });
  async function who(): Promise<{ token: string; id: string } | null> {
    const token = storedToken(d.storage, d.now()); if (!token) return null;
    character ??= await openCharacter({ storage: d.storage, search: d.search, now: d.now, ...(d.fetch ? { fetch: d.fetch } : {}) });
    return character ? { token, id: character } : null;
  }
  return {
    view: (): BuildView | null => view,
    // Read the build; nothing changes on any failure.
    async refresh(): Promise<BuildView | null> {
      const w = await who(); if (!w) return null;
      const got = await getBuild(w.token, w.id, opts());
      if (!isOffline(got)) view = got;
      return view;
    },
    // Send a draft. The server's answer is the view afterwards; a 409 is told apart by reading the build again (a moved version = someone else wrote; the same version = this rank's re-spread is spent).
    async save(next: BuildView): Promise<SaveOutcome> {
      const w = await who(); if (!w || !view) return 'offline';
      const out = await setBuild(w.token, w.id, next.placed, view.version, opts());
      if (!isOffline(out)) { view = out; return 'saved'; }
      if (out.offline !== 'http-409') return 'offline';
      const was = view.version, now = await getBuild(w.token, w.id, opts());
      if (isOffline(now)) return 'offline';
      view = now; return now.version !== was ? 'moved' : 'spent';
    },
  };
}
