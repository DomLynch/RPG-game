// The signed-in character's skill values as the page holds them: the server's copy only, read synchronously by the Match's spell port at begin(). A guest, a failed sign-in or a writer that does not answer has none (an empty
// record, so every skill reads at its base in spell-pick.ts). No DOM: the page hands in storage, the clock and fetch, as createServerBuild does.
import { getSkills, skillsOffline, type SkillValues } from './skills-net.ts';
import { storedToken, writerBase } from './writer-call.ts';
import { openCharacter } from './open.ts';

type Deps = { storage: { getItem(key: string): string | null } | null; search: string; now: () => number; fetch?: typeof fetch };
const NONE: SkillValues = {};
export function createServerSkills(d: Deps) {
  let character: string | null = null, values: SkillValues = NONE;
  return {
    values: (): SkillValues => values,
    // Read the pool; on any failure the last good copy stays (a failed read never lowers a skill).
    async refresh(): Promise<SkillValues> {
      const token = storedToken(d.storage, d.now()); if (!token) { values = NONE; return values; }
      character ??= await openCharacter({ storage: d.storage, search: d.search, now: d.now, ...(d.fetch ? { fetch: d.fetch } : {}) });
      if (!character) return values;
      const got = await getSkills(token, character, { base: writerBase(d.search), timeoutMs: 8000, ...(d.fetch ? { fetch: d.fetch } : {}) });
      if (!skillsOffline(got)) values = got;
      return values;
    },
  };
}
