// O2 property run: 1,000 seeded random op sequences over a small pack and bank. After every step:
//   - a refused op left the state byte-identical (atomicity);
//   - an accepted op's result passes checkInventory (custody, one of each, every instance rule);
//   - no instance id is ever in two places: not twice inside the inventory, and never both inside and in the outside pool;
//   - quantities per mint key are conserved (a split or merge never creates or destroys units; only receive/remove cross the border);
//   - every instance that survives a step keeps its provenance unchanged and its history as a prefix (checkHistoryKept).
// The RNG is a seeded mulberry32 in the test, so every run is the same run; the module itself draws no randomness.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHistoryKept, type ItemInstance } from '../contracts/items.ts';
import type { Result } from '../contracts/core.ts';
import { checkInventory, deposit, equip, merge, move, receive, remove, split, unequip, withdraw, type Inventory } from './inventory.ts';
import { EXCHANGE, FRONTIER, body, empty, helm, helmCopy, hood, ironStack, lookup, record, server } from './testkit.ts';

const SEQUENCES = 1000, STEPS = 24;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = (): ItemInstance[] => [helm(), helmCopy(), body(), hood(), record(), ironStack('inst:iron-a', 30, 'a'), ironStack('inst:iron-b', 45, 'b')];
const HOSTILE_IDS = ['constructor', '__proto__', 'toString', 'inst:nothing'];
const PLACES: unknown[] = [EXCHANGE, EXCHANGE, EXCHANGE, FRONTIER, '__proto__', undefined];
const STANDINGS = [server(1), server(11), server(46), { source: 'device' as const, careerLevel: 46 }];

const totals = (lists: readonly (readonly ItemInstance[])[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const list of lists) for (const inst of list) out.set(inst.provenance.mintKey, (out.get(inst.provenance.mintKey) ?? 0) + inst.quantity);
  return out;
};

test('[property] 1,000 random op sequences: atomic, no duplication, conserved, provenance kept', () => {
  let accepted = 0, refusedCount = 0;
  const hits = Array.from({ length: 10 }, () => 0); // accepted ops per kind
  for (let seq = 0; seq < SEQUENCES; seq++) {
    const rand = mulberry32(0x5eed + seq);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
    let inv = empty(4, 3);
    let outside = POOL(); // pieces not held by this inventory (a mint, an escrow): each id is in exactly one of the two
    const expected = totals([outside]);
    let fresh = 0;
    for (let step = 0; step < STEPS; step++) {
      const ids = [...inv.items.map((i) => i.id), ...HOSTILE_IDS];
      const id = (): string => (rand() < 0.1 || inv.items.length === 0 ? pick(HOSTILE_IDS) : pick(inv.items).id);
      const index = (): unknown => (rand() < 0.1 ? pick([-1, 1.5, Number.NaN, 99]) : Math.floor(rand() * 4));
      const grid = (): 'pack' | 'bank' => (rand() < 0.5 ? 'pack' : 'bank');
      const place = pick(PLACES);
      const before = JSON.stringify(inv);
      const kind = Math.floor(rand() * 11) % 10; // receive twice as often, so the grids fill
      let r: Result<Inventory>;
      let leaving: ItemInstance | null = null, arriving: ItemInstance | null = null;
      switch (kind) {
        case 9:
        case 0: {
          arriving = rand() < 0.15 && inv.items.length ? pick(inv.items) : outside.length ? pick(outside) : helm();
          r = receive(inv, arriving, lookup, rand() < 0.5 ? undefined : (index() as number));
          break;
        }
        case 1: {
          const out = remove(inv, id(), lookup, place);
          if (out.ok) leaving = out.value.removed;
          r = out.ok ? { ok: true, value: out.value.inventory } : out;
          break;
        }
        case 2: r = move(inv, id(), { grid: grid(), index: index() }, lookup, place); break;
        case 3: r = deposit(inv, id(), lookup, place, rand() < 0.5 ? undefined : (index() as number)); break;
        case 4: r = withdraw(inv, id(), lookup, place, rand() < 0.5 ? undefined : (index() as number)); break;
        case 5: {
          const newId = rand() < 0.15 ? pick([...ids, '__proto__', 'inst:constructor']) : `inst:split-${seq}-${fresh++}`;
          r = split(inv, id(), Math.floor(rand() * 40) - 2, newId, lookup, rand() < 0.5 ? undefined : { grid: grid() }, place);
          break;
        }
        case 6: {
          // Mostly a split family (the only stacks that may merge), sometimes any pair.
          const from = id(), source = inv.items.find((i) => i.id === from);
          const kin = source ? inv.items.filter((i) => i.id !== from && i.provenance.mintKey === source.provenance.mintKey) : [];
          r = merge(inv, from, kin.length && rand() < 0.8 ? pick(kin).id : id(), lookup, place);
          break;
        }
        case 7: r = equip(inv, id(), lookup, pick(STANDINGS)); break;
        default: r = unequip(inv, id(), lookup, rand() < 0.5 ? undefined : (index() as number)); break;
      }

      if (!r.ok) {
        refusedCount++;
        assert.equal(JSON.stringify(inv), before, `seq ${seq} step ${step}: a refused op changed the state`);
        continue;
      }
      accepted++;
      hits[kind]++;
      const next = r.value;
      assert.deepEqual(checkInventory(next, lookup), [], `seq ${seq} step ${step}`);
      // An instance arriving leaves the outside pool; one leaving joins it. An id is never in both, and never twice in either.
      if (arriving) outside = outside.filter((o) => o.id !== arriving!.id);
      if (leaving) outside = [...outside, leaving];
      const inside = next.items.map((i) => i.id);
      assert.equal(new Set(inside).size, inside.length, `seq ${seq} step ${step}: an id appears twice`);
      for (const o of outside) assert.ok(!inside.includes(o.id), `seq ${seq} step ${step}: ${o.id} is both held and outside`);
      // Units are conserved per mint key (only the outside pool and the inventory exist in this world).
      assert.deepEqual(totals([next.items, outside]), expected, `seq ${seq} step ${step}: quantities drifted`);
      // Provenance is never rewritten and history only grows, for every instance on both sides of the step.
      const prior = new Map<string, ItemInstance>((JSON.parse(before) as Inventory).items.map((i) => [i.id, i]));
      for (const inst of next.items) {
        const was = prior.get(inst.id);
        if (was) assert.deepEqual(checkHistoryKept(was, inst), [], `seq ${seq} step ${step}: ${inst.id}`);
      }
      inv = next;
    }
  }
  // The run must exercise both arms, or it proves nothing.
  assert.ok(accepted > 5000 && refusedCount > 5000, `accepted ${accepted}, refused ${refusedCount}`);
  assert.ok(hits.every((n) => n > 25), `every op kind must succeed sometimes: ${hits.join(', ')}`);
});
