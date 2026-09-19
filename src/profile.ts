import { isOpponentId, type OpponentId } from './roster.ts';
export type Profile = { version: 1; id: string; name: string; encounter?: OpponentId; career?: { victoryMarks: number } }; // career is independent; no awards before server persistence
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'frankendom.fighter.v1';
export const cleanName = (name: string) => Array.from(name).filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').trim().slice(0, 24) || 'Wanderer';

export function loadProfile(storage: StoragePort, createId: () => string): { profile: Profile; returning: boolean } {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    if (value?.version === 1 && typeof value.id === 'string' && value.id.length <= 64 && /^[a-zA-Z0-9-]{8,64}$/.test(value.id) && typeof value.name === 'string') {
      // Migrate the old opponent rung without inventing career wins or changing guest identity.
      const candidate = value.encounter ?? value.ladder;
      const encounter = isOpponentId(candidate) ? candidate : undefined;
      const marks = value.career?.victoryMarks;
      const career = Number.isSafeInteger(marks) && marks >= 0 ? { victoryMarks: marks } : undefined;
      return { profile: { version: 1, id: value.id, name: cleanName(value.name), ...(encounter ? { encounter } : {}), ...(career ? { career } : {}) }, returning: true };
    }
  } catch { /* Corrupt/unavailable storage must never prevent entering the arena. */ }
  return { profile: { version: 1, id: createId(), name: 'Wanderer' }, returning: false };
}

// Dual-write the old key for safe release rollback; encounter remains canonical on read.
export function saveProfile(storage: StoragePort, profile: Profile): boolean {
  try { storage.setItem(KEY, JSON.stringify({ ...profile, ladder: profile.encounter })); return true; } catch { return false; }
}
