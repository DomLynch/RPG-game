// The kill outbox's durable copy (spawn-net.ts OutboxStore; audit 2026-10-18 F3): one localStorage entry per account, so a reload, a crash or a closed tab does not lose a kill report that is still
// inside the writer's engage grace. Only well-formed entries are read back; anything else (an old shape, a hand edit) is dropped, never sent. A store that throws (quota, private mode, no storage)
// is caught by spawn-net, which keeps the outbox in memory as before.
import type { OutboxEntry, OutboxStore } from './spawn-net.ts';

export const OUTBOX_KEY = 'frankendom.origins.kill-outbox.v1';
const keyOf = (account: string): string => `${OUTBOX_KEY}:${account}`;
const isEntry = (e: unknown): e is OutboxEntry => {
  const o = e as Partial<OutboxEntry> | null;
  return !!o && typeof o === 'object' && typeof o.instance === 'string' && typeof o.token === 'string' && Number.isSafeInteger(o.hits) && (o.record === null || typeof o.record === 'string')
    && (o.drop === undefined || o.drop === null || typeof o.drop === 'string') && Number.isSafeInteger(o.tries) && typeof o.nextAt === 'number' && Number.isFinite(o.nextAt);
};

export function localOutbox(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): OutboxStore {
  return {
    load(account) {
      const raw = JSON.parse(storage.getItem(keyOf(account)) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw.filter(isEntry).map((e) => ({ ...e, drop: e.drop ?? null })) : [];   // an entry saved before drop existed reads back as having none
    },
    save(account, entries) {
      if (entries.length) storage.setItem(keyOf(account), JSON.stringify(entries));
      else storage.removeItem(keyOf(account));   // an empty outbox leaves nothing behind
    },
  };
}
