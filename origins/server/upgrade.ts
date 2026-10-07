// POST /origins/apply_upgrade {character, op, instance, toLevel, materials?: [instance ids], place?: 'exchange'}: the smith raises one piece one level.
// The server derives everything: it reads the piece, the offered material stacks and the career row, and runs the contracts' performUpgrade
// itself against the cost table in its content, then the inventory module's applyUpgrade (bank gate, story pieces, conservation). `place` reaches both:
// a banked piece (performUpgrade) and a bank material line (applyUpgrade) need it to be 'exchange'. It is CLIENT-STATED today (read from the body),
// so both Exchange rules hold against honest clients only until the writer derives the place from presence (launch gate X1). Nothing in the body is a cost, an amount,
// an outcome, a level the piece is at or an account; extra fields are ignored.
// Materials only (Strategy, 2026-10-06): there is no coin balance anywhere, so the smith runs with balance 0 and a cost row that charges coin
// is a 501 until the metals ledger exists. Idempotency is consume's: the piece's put, the burns and the event upgrade:<character>:<op> commit
// in ONE batch; the stored receipt answers an identical retry (replayed: true), a different request under that op id is a 409.
import type { Issue } from '../contracts/core.ts';
import {
  parseServiceDefinition, parseUpgradeCostTable, parseUpgradeReceipt, parseUpgradeRequest, performUpgrade, type UpgradeOutcome, type UpgradeReceipt,
} from '../contracts/economy.ts';
import type { Location } from '../contracts/items.ts';
import { applyUpgrade, BANK_PLACE, find } from '../inventory/inventory.ts';
import { levelOfCredit } from '../progression/model.ts';
import { DbError } from './db.ts';
import { Refused } from './errors.ts';
import { BadRequest, Conflict, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import * as store from './store.ts';

export const COIN_NOT_BUILT = 'coin costs need the metals ledger, not built yet';

// The forge's content, through the contracts' own parsers (so the server takes exactly the cost rows the contracts take, coin 0 included).
export function smithContent(service: unknown, costs: unknown): NonNullable<Content['smith']> {
  const s = parseServiceDefinition(service), c = parseUpgradeCostTable(costs);
  if (!s.ok || !c.ok) throw Error(`smith content does not parse: ${[...(s.ok ? [] : s.issues), ...(c.ok ? [] : c.issues)].map(i => `${i.path} ${i.code}`).join(', ')}`);
  return { service: s.value, costs: c.value };
}

// A stored or fresh receipt in the contracts' one key order, so a retry gets the very same bytes (jsonb reorders keys).
function canonical(raw: unknown): UpgradeReceipt {
  const r = parseUpgradeReceipt(raw);
  if (!r.ok) throw Error(`stored upgrade receipt does not parse: ${r.issues.map(i => `${i.path} ${i.code}`).join(', ')}`);
  return r.value;
}

function refusal(issues: readonly Issue[]): Error {
  const text = issues.map(i => `${i.path}: ${i.message}`).join('; ');
  if (issues.some(i => i.code === 'duplicate-id' && (i.path === 'idempotencyKey' || i.path === 'op'))) return new Conflict(text);
  if (issues.some(i => i.path === 'balance')) return new Refused(501, `${COIN_NOT_BUILT} (${text})`, 'not-implemented');   // balance 0: only a coin > 0 row is refused here
  if (issues.some(i => i.code === 'version-conflict')) return new DbError('O0002', `stale: ${text}; open again and retry`);
  return new BadRequest(text);
}

// The database's location columns for a put that leaves the piece where it is.
const locOf = (l: Location): store.Json => (l.kind === 'equipped' ? { kind: l.kind, owner: l.owner, slot: l.slot } : { ...l });

export function upgradeHandler(content: Content, now: () => string = () => new Date().toISOString()): Handler {
  return async ({ db, account }, body) => {
    const smith = content.smith;
    if (!smith) throw new Refused(501, 'there is no smith in this content', 'not-implemented');
    const { character, op, instance, toLevel, materials = [], place } = body;
    if (typeof op !== 'string' || op.length > 120) throw new BadRequest('op: an operation id (8..120 of a-z 0-9 : . _ -)');   // the event id must fit 200
    if (typeof character !== 'string') throw new BadRequest('character: a character id');   // checked before it is spliced into the event id
    if (!Array.isArray(materials) || materials.some(m => typeof m !== 'string')) throw new BadRequest('materials: a list of item instance ids');
    if (place !== undefined && place !== 'exchange') throw new BadRequest('place: \'exchange\' (the bank opens only there) or nothing');
    const at = place === 'exchange' ? BANK_PLACE : undefined;
    const eventId = `upgrade:${character}:${op}`;

    // Read the holdings, the career and any stored receipt for this op id, and let the contracts decide: a fresh upgrade, the original, or a refusal.
    const decide = async () => {
      const { inventory, snap } = await openHoldingsWith(db, account, character, content);
      const stored = await store.event(db, account, eventId);
      const prior = stored ? canonical((stored.payload as store.Json | undefined)?.receipt) : undefined;
      const piece = find(inventory, instance);
      if (!piece && !prior) throw new BadRequest('instance: not one of this character\'s pieces');
      // On a replay the spent stacks are gone; performUpgrade answers from the stored receipt before it looks at materials, so none are resolved.
      const offered = prior ? [] : (materials as string[]).map((id, i) => find(inventory, id) ?? (() => { throw new BadRequest(`materials[${i}]: ${id} is not held by this character`); })());
      if (snap.career === null) throw new BadRequest('open the account first: there is no career row to rank the upgrade against');
      const request = parseUpgradeRequest({
        kind: 'upgrade-request', schemaVersion: 1, idempotencyKey: op, character, service: smith.service.id, instance, expectedVersion: piece?.version ?? 0, toLevel,
      });
      if (!request.ok) throw refusal(request.issues);
      // A replay is answered before the piece or the materials are looked at (performUpgrade checks the stored receipt first), so a piece
      // that has since left still gets its original receipt back; `piece` is only absent on that path.
      const out = performUpgrade({
        request: request.value, service: smith.service, costs: smith.costs, instance: piece!, def: piece ? content.lookup(piece.item)! : undefined!,
        standing: { source: 'server', careerLevel: levelOfCredit(Number(snap.career.total_credit)) }, balance: 0,
        materials: offered, materialDefs: content.lookup, receipts: new Map(prior ? [[op, prior]] : []), now: now(), place: at,
      });
      if (!out.ok) throw refusal(out.issues);
      return { inventory, outcome: out.value };
    };
    const answer = (o: UpgradeOutcome) => ({ event: eventId, replayed: o.replayed, receipt: canonical(o.receipt) });

    const first = await decide();
    const { outcome } = first;
    if (outcome.replayed) return answer(outcome);
    if (outcome.receipt.coin !== 0) throw new Refused(501, COIN_NOT_BUILT, 'not-implemented');   // unreachable at balance 0; never commit a charge nobody holds
    const applied = applyUpgrade({ inventory: first.inventory, ledger: [] }, outcome, content.lookup, at);
    if (!applied.ok) throw refusal(applied.issues);
    const held = new Map(first.inventory.items.map(i => [i.id, i]));
    const piece = held.get(outcome.instance.id)!, after = outcome.instance;
    const batch = [
      { op: 'event', event_id: eventId, kind: 'upgrade', account, character, payload: { receipt: outcome.receipt } },
      { op: 'put', id: piece.id, expected_version: piece.version, loc: locOf(after.location), bound_to: after.boundTo, upgrade_level: after.upgradeLevel ?? 0, history_append: after.history.slice(piece.history.length) },
      ...applied.value.burn.lines.map(l => ({ op: 'burn', id: l.instance, expected_version: held.get(l.instance)!.version, count: l.quantity })),
    ];
    try {
      await store.commit(db, account, batch);
    } catch (e) {
      if (e instanceof DbError && e.code === 'O0001') {   // the op id committed under us (a racing retry): answer from what it stored
        const again = await decide();
        if (again.outcome.replayed) return answer(again.outcome);
        throw e;
      }
      if (e instanceof DbError && e.code === 'O0002') throw new DbError('O0002', 'stale: the piece or a material changed since it was read; open again and retry');
      throw e;
    }
    return answer(outcome);
  };
}
