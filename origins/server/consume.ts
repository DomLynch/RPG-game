// POST /origins/consume {character, op, reason: 'quest-handin', qty, itemId | mintKey, consumesStoryItem?}: a hand-in burns units from the backpack.
// The rules are the pure module's (inventory.consume: backpack only, story pieces only when the step names them, all or nothing); this file only
// reads the holdings, writes the result and answers retries. The account is the token's; nothing in the body names an account or a definition.
// Idempotency (Strategy, 2026-10-06): the burn and its event burn:<character>:<op> commit in ONE batch, so a second commit of that op id aborts
// with O0001. The stored event is the original receipt: the same request gets it back (replayed: true) and changes nothing; a different
// request under that op id is an op-id conflict.
import type { Issue, Result } from '../contracts/core.ts';
import { consume, type Burn, type Burned, type ConsumeAsk, type ConsumeOp } from '../inventory/inventory.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict, type Handler } from './handlers.ts';
import { openHoldings, type Content } from './holdings.ts';
import * as store from './store.ts';

// The stored burn for this event id, as the pure module's ledger entry (or none).
async function priorBurn(db: Db, account: string, eventId: string, op: string): Promise<Burn[]> {
  const stored = await store.event(db, account, eventId);
  if (!stored) return [];
  return [{ op, ...(stored.payload as Omit<Burn, 'op'>) }];
}

function refusal(issues: readonly Issue[]): Error {
  const text = issues.map(i => `${i.path}: ${i.message}`).join('; ');
  return issues.some(i => i.code === 'duplicate-id' && i.path === 'op') ? new Conflict(text) : new BadRequest(text);
}

// One key order whether the burn was just made or read back from jsonb (which reorders keys), so a retry gets the very same bytes.
const receipt = (eventId: string, b: Burn, replayed: boolean) => {
  const { qty, itemId, mintKey, consumesStoryItem } = b.asked as ConsumeAsk;
  const asked = Object.fromEntries(Object.entries({ qty, itemId, mintKey, consumesStoryItem }).filter(([, v]) => v !== undefined));
  const lines = b.lines.map(l => ({ instance: l.instance, item: l.item, mintKey: l.mintKey, quantity: l.quantity }));
  return { event: eventId, replayed, burn: { op: b.op, owner: b.owner, reason: b.reason, asked, lines } };
};

export function consumeHandler(content: Content): Handler {
  return async ({ db, account }, body) => {
    const { character, op, reason, qty, itemId, mintKey, consumesStoryItem } = body;
    if (typeof op !== 'string' || op.length > 120) throw new BadRequest('op: an operation id (8..120 of a-z 0-9 : . _ -)');   // the pattern is the pure module's; the cap keeps the event id within 200
    if (reason !== 'quest-handin') throw new BadRequest('reason: consume burns only for a quest hand-in (\'quest-handin\'); the smith is apply_upgrade');
    const eventId = `burn:${character}:${op}`;
    const ask = { op, owner: character, reason, qty, itemId, mintKey, consumesStoryItem } as ConsumeOp;
    // Read the holdings and any stored burn for this op id, and let the pure module decide: a fresh burn, the original one, or a refusal.
    const decide = async (): Promise<{ held: Map<string, number>; out: Result<Burned> }> => {
      const inventory = await openHoldings(db, account, character, content);
      const ledger = await priorBurn(db, account, eventId, op);
      return { held: new Map(inventory.items.map(i => [i.id, i.version])), out: consume({ inventory, ledger }, ask, content.lookup) };
    };
    const first = await decide();
    if (!first.out.ok) throw refusal(first.out.issues);
    const { burn, replayed } = first.out.value;
    if (replayed) return receipt(eventId, burn, true);
    const batch = [
      { op: 'event', event_id: eventId, kind: 'burn', account, character, payload: { owner: burn.owner, reason: burn.reason, asked: burn.asked, lines: burn.lines } },
      ...burn.lines.map(l => ({ op: 'burn', id: l.instance, expected_version: first.held.get(l.instance), count: l.quantity })),
    ];
    try {
      await store.commit(db, account, batch);
    } catch (e) {
      if (e instanceof DbError && e.code === 'O0001') {   // the op id committed under us (a racing retry): answer from what it stored
        const again = await decide();
        if (!again.out.ok) throw refusal(again.out.issues);
        if (again.out.value.replayed) return receipt(eventId, again.out.value.burn, true);
        throw e;
      }
      if (e instanceof DbError && e.code === 'O0002') throw new DbError('O0002', 'stale: these items changed since they were read; open again and retry');
      throw e;
    }
    return receipt(eventId, burn, false);
  };
}
