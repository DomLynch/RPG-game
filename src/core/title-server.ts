// The signed-in character's title as the page holds it: the server's copy only. A guest, a failed sign-in, a writer that does not answer (or has no title_get yet) and an unrenowned character all
// give '' and the page draws no title line. No DOM: the page hands in storage, the clock and fetch, as build-server.ts does.
import { getTitle, titleIsOffline } from './title-net.ts';
import { storedToken, writerBase } from './writer-call.ts';
import { openCharacter } from './open.ts';

type Deps = { storage: { getItem(key: string): string | null } | null; search: string; now: () => number; fetch?: typeof fetch };
export function createServerTitle(d: Deps) {
  let title = '';
  return {
    title: (): string => title,
    // Read the title; on any failure the last one stands (a title never vanishes because one read failed), and a guest has none.
    async refresh(): Promise<string> {
      const token = storedToken(d.storage, d.now()); if (!token) return title;
      const id = await openCharacter({ storage: d.storage, search: d.search, now: d.now, ...(d.fetch ? { fetch: d.fetch } : {}) }); if (!id) return title;
      const got = await getTitle(token, id, { base: writerBase(d.search), timeoutMs: 8000, ...(d.fetch ? { fetch: d.fetch } : {}) });
      if (!titleIsOffline(got) && got) title = got.title;
      return title;
    },
  };
}
