export type Profile = { version: 1; id: string; name: string; ladder?: string };   // ladder: the opponent rung reached on this device
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'frankendom.fighter.v1';
export const cleanName = (name: string) => Array.from(name).filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').trim().slice(0, 24) || 'Wanderer';

export function loadProfile(storage: StoragePort, createId: () => string): { profile: Profile; returning: boolean } {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    if (value?.version === 1 && typeof value.id === 'string' && value.id.length <= 64 && /^[a-zA-Z0-9-]{8,64}$/.test(value.id) && typeof value.name === 'string') {
      const ladder = typeof value.ladder === 'string' && /^[a-z]{1,24}$/.test(value.ladder) ? value.ladder : undefined;
      return { profile: { version: 1, id: value.id, name: cleanName(value.name), ...(ladder ? { ladder } : {}) }, returning: true };
    }
  } catch { /* Corrupt/unavailable storage must never prevent entering the arena. */ }
  return { profile: { version: 1, id: createId(), name: 'Wanderer' }, returning: false };
}

export function saveProfile(storage: StoragePort, profile: Profile): boolean {
  try { storage.setItem(KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
