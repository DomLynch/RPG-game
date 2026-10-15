// POST /origins/gear_repair {character, op, instance, points?}: the smith repairs a worn piece the character holds, for bronze and grave iron. Nothing in the body is a price,
// a tier, a slot or a wear value: the server reads the piece, its wear (migration 20261013174936, event-sourced like a shop's shelf), the bronze balance and the character's
// pack itself, and prices the repair from the wear-repair rows (origins/gear/wear-repair.json: tier, slope, floors). `points` omitted repairs all the wear.
// Valuables are ONE transaction (Dom 2026-10-08): the `repair:<character>:<op>` event (carrying the receipt and the piece's wear after), the bronze spend (versioned: a stale
// balance aborts the batch) and the burned iron commit in ONE origins_apply batch. The op id is the one-time token: an identical retry is answered from the stored receipt
// (replayed: true), a different request under the same op id is a 409, and a racing retry (O0001) answers from what committed. The player must stand at the Exchange smith.
import { find } from '../../src/core/server.ts';
import { repairCost, repairedPiece, wearKindOf, type Piece } from '../gear/wear-repair.ts';
import { DbError } from './db.ts';
import { Refused } from './errors.ts';
import { BadRequest, Conflict, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import * as store from './store.ts';
import { exchangePlace } from './upgrade.ts';

export type RepairReceipt = { instance: string; points: number; cost: { bronze: number; metal: { item: string; qty: number } }; piece: Piece };
const OP = /^[a-z0-9][a-z0-9:._-]{7,119}$/;

export function gearRepairHandler(content: Content): Handler {
  return async ({ db, account, where }, body) => {
    const { character, op, instance, points } = body;
    if (typeof op !== 'string' || !OP.test(op)) throw new BadRequest('op: an operation id (8..120 of a-z 0-9 : . _ -)');
    if (typeof character !== 'string' || character.length > 80) throw new BadRequest('character: a character id');
    if (typeof instance !== 'string' || instance.length > 120) throw new BadRequest('instance: an item instance id');
    if (points !== undefined && !(Number.isInteger(points) && (points as number) >= 1)) throw new BadRequest('points: a whole number from 1, or leave it out to repair all the wear');
    if (!(await exchangePlace(where, account))) throw new Refused(422, 'stand at the smith in the Exchange to repair', 'away');
    const eventId = `repair:${character}:${op}`;
    const replay = (stored: store.Json | null) => {
      const r = (stored?.payload as { receipt?: RepairReceipt } | undefined)?.receipt;
      if (!r) return null;
      if (r.instance !== instance || (points !== undefined && points !== r.points)) throw new Conflict(`op ${op} already stands for a different repair`);
      return { op, ...r, replayed: true };
    };
    const prior = replay(await store.event(db, account, eventId));
    if (prior) return prior;

    const { inventory } = await openHoldingsWith(db, account, character, content);
    const piece = find(inventory, instance);
    if (!piece) throw new BadRequest('instance: not one of this character\'s pieces');
    const kind = wearKindOf(piece.item);
    if (!kind) throw new Refused(422, 'this piece takes no wear', 'no-wear');
    const [wears, metal] = await Promise.all([store.itemWears(db, account, [instance]), store.metalOf(db, account)]);
    if (wears === 'absent' || metal === 'absent') throw new Refused(503, 'the wear ledger is not installed (migration 20261013174936)');
    const stored = wears[instance];
    if (!stored || stored.worn <= 0) throw new Refused(422, 'this piece is not worn', 'not-worn');
    const quote = repairCost(kind.tier, stored, (points as number | undefined) ?? stored.worn, undefined, kind.slot);
    if (quote.points === 0) throw new Refused(422, 'this piece is not worn', 'not-worn');
    if ((metal ? metal.bronze : 0) < quote.gold) throw new Refused(422, `the smith wants ${quote.gold} bronze`, 'funds');
    const stacks = inventory.items.filter((i) => i.item === quote.metalItem && i.location.kind === 'pack');
    if (stacks.reduce((n, i) => n + i.quantity, 0) < quote.metal) throw new Refused(422, `the smith wants ${quote.metal} ${quote.metalItem} in the pack`, 'metal');
    const burns: store.Json[] = [];
    for (let need = quote.metal, k = 0; need > 0; k++) { const take = Math.min(need, stacks[k]!.quantity); burns.push({ op: 'burn', id: stacks[k]!.id, expected_version: stacks[k]!.version, count: take }); need -= take; }

    const after = repairedPiece(stored, quote.points);
    const receipt: RepairReceipt = { instance, points: quote.points, cost: { bronze: quote.gold, metal: { item: quote.metalItem, qty: quote.metal } }, piece: after };
    // The wear is its own event `wear:<instance>:<seq>` (seq = the wear it was read at + 1): a settle or another repair that read the same wear writes the same id, the primary key
    // refuses the second, and that loser answers 409 below. The newest wear is the highest seq.
    const batch: store.Json[] = [
      { op: 'event', event_id: eventId, kind: 'metal', account, character, payload: { receipt } },
      { op: 'event', event_id: `wear:${instance}:${(stored.seq ?? 0) + 1}`, kind: 'metal', account, character, payload: { wear: { instance, seq: (stored.seq ?? 0) + 1, ...after } } },
      { op: 'metal', account, delta_bronze: -quote.gold, reason: 'spend', event_id: eventId, expected_version: metal!.version },
      ...burns,
    ];
    try { await store.commit(db, account, batch); }
    catch (e) {
      if (e instanceof DbError && e.code === 'O0001') {
        const r = replay(await store.event(db, account, eventId)); if (r) return r;   // a racing retry committed first
        throw new Conflict('the piece\'s wear changed since it was read (a fight settled or another repair ran); read it again and retry');
      }
      if (e instanceof DbError && e.code === 'O0002') throw new DbError('O0002', 'stale: the balance or the pack changed since it was read; open again and retry');
      throw e;
    }
    return { op, ...receipt, replayed: false };
  };
}
