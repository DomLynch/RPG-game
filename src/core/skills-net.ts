// The skill pool's one read (Backend: skills_get {character} -> { skills: [{ skill, base, ceiling, xp, value, focus }] }), browser-safe like build-net.ts. Read-only. `value` is the skill as the character's banked xp has filled it
// (base + the points xp has earned, never past the placed ceiling): the same number the server's spell check allows, so a client that claims it is never refused for skill.
import { call, type Offline, type Opts } from './writer-call.ts';

export type SkillValues = Readonly<Record<string, number>>;
export const skillsOffline = (r: SkillValues | Offline): r is Offline => 'offline' in r;
// Shape only: a malformed answer is null (the caller keeps what it had), never a half pool.
export function valuesOf(result: unknown): SkillValues | null {
  const skills = (result as { skills?: unknown } | null)?.skills;
  if (!Array.isArray(skills)) return null;
  const out: Record<string, number> = {};
  for (const s of skills as { skill?: unknown; value?: unknown }[]) {
    if (typeof s?.skill !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(s.skill) || typeof s.value !== 'number' || !Number.isFinite(s.value) || s.value < 0) return null;
    out[s.skill] = s.value;
  }
  return out;
}
export const getSkills = (token: string | null, character: string, opts: Opts = {}) => call('skills_get', { character }, token, valuesOf, opts);
