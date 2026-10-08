// Origins greybox, roadmap stage 2: the rules modules behind the panels. Orla's talk (origins/talk) drives the quest journal
// (origins/quests); the bank reads and moves the character's real items (origins/inventory); the smith is the contracts' performUpgrade.
// Content is the modules' own fixtures. All state lives in memory for the page session.
import warriorUrl from '../../src/assets/warrior.glb?url';
import type { Result } from '../contracts/core.ts';
import { blacksmith, forgeCosts, graveIronDef, helmetDef, helmetInstance, ironInstance, recordDef, recordInstance, ACCOUNT, PC, smith } from '../contracts/fixtures.ts';
import { parseServiceDefinition, parseUpgradeCostTable, performUpgrade, type UpgradeReceipt } from '../contracts/economy.ts';
import type { AccountId, CharacterInstanceId, EncounterId, ItemId, QuestId } from '../contracts/ids.ts';
import { parseItemDefinition, parseItemInstance, upgradeLevelOf, type ItemDefinition, type ItemInstance } from '../contracts/items.ts';
import { parseQuestDefinition, type QuestDefinition } from '../contracts/story.ts';
import { parseCharacterDefinition, type CareerStanding } from '../contracts/world.ts';
import { BANK_PLACE, deposit, find, gridView, openInventory, receive, remove, unequip, withdraw, type Grid } from '../inventory/inventory.ts';
import { concordCommission } from '../quests/fixtures.ts';
import { advance, entries, newJournal, type Journal } from '../quests/journal.ts';
import { orla } from '../talk/fixtures.ts';
import { choices, loadTalk, newTalkState, pick, type Facts, type Talk } from '../talk/talk.ts';
import { BANK_STEP_Z, FORGE } from './exchange.ts';
import { SLOT_LABEL, wearSwap, wornRows } from './gear.ts';
import { ui, type Cell } from './ui.ts';

// Every new world number in one place (to be swapped for origins/world): Orla's spot, the ore pile and how near you must stand.
export const WORLD_TUNING = {
  orla: { x: FORGE.x - 0.6, z: FORGE.z + 0.3, radius: 0.29, length: 1.15 },   // behind the anvil, facing the plaza (envoy-sized capsule)
  orePile: { x: -FORGE.halfX * 2, z: BANK_STEP_Z + 38, radius: 0.55 },         // "the quarry carts past the gate": inside the plaza, left of the passage
  reach: { forge: 3, bank: 3.6, bankHalfWidth: 13, ore: 2.5, pit: 5 },   // pit: from the Pit's centre, where the duel is offered
};
// Every model the preview loads, id → URL; null = a greybox stand-in built in main.ts. Swapping art is a one-line change here.
export const ASSETS: Record<'hero' | 'orla' | 'ore', string | null> = { hero: warriorUrl, orla: null, ore: null };

export type Kind = 'talk' | 'journal' | 'bank' | 'gear' | 'blacksmith' | 'ore' | 'bounty';   // bounty: the ?region=1 Bounty giver (enableBounty)
const must = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const why = (r: Result<unknown>) => (r.ok ? '' : r.issues[0]!.message);

// Content, from the modules' fixtures. The ore is the item Orla's talk and the quest name; no fixture defines it (an API gap, reported),
// so it is the grave-iron material re-keyed to that id.
const TALK = must(loadTalk(orla())), QUEST = must(parseQuestDefinition(concordCommission())), QUESTS = new Map<QuestId, QuestDefinition>([[QUEST.id, QUEST]]);
// ?region=1 only: the Bounty giver's talk and name (play.enableBounty); null keeps the page as it is without the flag.
let GIVER: { talk: Talk; name: string } | null = null;
const talkFor = (kind: Kind): Talk => (kind === 'bounty' && GIVER ? GIVER.talk : TALK);
const ORE = (QUEST.stages.flatMap((s) => s.transitions.flatMap((t) => t.when)).find((c) => c.kind === 'has-item') as { item: ItemId }).item;
const DEFS = new Map([helmetDef(), recordDef(), graveIronDef(), { ...graveIronDef(), id: ORE, name: 'Exchange ore' }].map((r) => must(parseItemDefinition(r))).map((d) => [d.id, d]));
const lookup = (id: ItemId): ItemDefinition | undefined => DEFS.get(id);
const SERVICE = must(parseServiceDefinition(blacksmith())), COSTS = must(parseUpgradeCostTable(forgeCosts()));
export const SMITH_NAME = must(parseCharacterDefinition(smith())).name;
// The career level the gates read: the Origins career's (origins/pit, the Pit duel settles it through award()), starting a Champion: past
// the outer gate, and may wear a +1 Gladiator piece. The page moves it with play.standAt after a duel pays.
export const START_LEVEL = 16;
let STANDING: CareerStanding = { source: 'server', careerLevel: START_LEVEL };

// The character: the contracts' stored instances (helmet worn, record in the pack, grave iron in the bank), helmet taken off to the pack.
const helm = helmetInstance(), packSize = 8, bankSize = 8;
let inv = must(unequip(must(openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as AccountId, items: [helmetInstance(), recordInstance(), ironInstance()].map((r) => must(parseItemInstance(r))), packSize, bankSize }, lookup)), helm.id, lookup));
let journal: Journal = newJournal(PC as CharacterInstanceId), talk = newTalkState(), coin = 400;
const receipts = new Map<string, UpgradeReceipt>();
let reply = '', msg = '', picked: string | null = null, ended = false;

const hasItem = (item: ItemId) => inv.items.some((i) => i.item === item);
const facts = (): Facts => ({ standing: STANDING, quest: (id) => journal.quests.get(id), hasItem });
const step = (quest: Parameters<typeof advance>[1], stage: string, choice: string | null, cleared?: (encounter: EncounterId) => boolean): Result<Journal> => {
  const r = advance(journal, quest, stage, { quests: QUESTS, standing: STANDING, at: new Date().toISOString(), choice: choice ?? undefined, hasItem, cleared });
  return r.ok ? { ok: true, value: r.value.journal } : r;
};
const nameOf = (i: ItemInstance) => `${lookup(i.item)?.name ?? i.item}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${upgradeLevelOf(i) ? ` +${upgradeLevelOf(i)}` : ''}`;
const cells = (grid: Grid): Cell[] => must(gridView(inv, grid, BANK_PLACE)).map((i) => i && { id: i.id, label: nameOf(i), on: i.id === picked });

export const play = {
  standAt(level: number) { STANDING = { source: 'server', careerLevel: level }; },
  fresh() { reply = msg = ''; picked = null; ended = false; },
  oreWanted: () => journal.quests.get(QUEST.id)?.stage === 'fetch' && !hasItem(ORE),
  takeOre() {
    const r = receive(inv, must(parseItemInstance({ ...ironInstance(), id: 'inst:exchange-ore-1', item: ORE, quantity: 5, location: { kind: 'trade-escrow', container: 'container:quarry-cart', from: PC },
      provenance: { ...ironInstance().provenance, mintKey: 'loot:quarry-cart:1' } })), lookup);
    if (r.ok) inv = r.value;
    msg = r.ok ? 'You take 5 Exchange ore from the cart.' : why(r);
  },
  lines: (kind: Kind = 'talk') => choices(talkFor(kind), talk, facts()),
  // ?region=1: register the Bounty (a quest record wrapping it, bounty.ts) and the talk of the figure who gives it.
  enableBounty(quest: unknown, giverTalk: unknown, name: string) {
    const q = must(parseQuestDefinition(quest));
    QUESTS.set(q.id, q); GIVER = { talk: must(loadTalk(giverTalk)), name };
  },
  // ?region=1: the Bounty is held once its giver has posted it (quest at "posted"); a win over its foe clears the encounter and the quest finishes.
  bountyOpen: (quest: string) => journal.quests.get(quest as QuestId)?.stage === 'posted',
  bountyPaid(quest: string, encounter: EncounterId): boolean {
    const r = step(quest as QuestId, 'won', null, (e) => e === encounter);
    if (r.ok) journal = r.value;
    return r.ok;
  },
  say(id: string, kind: Kind = 'talk') {
    const r = pick(talkFor(kind), talk, id, facts(), step);
    if (!r.ok) { msg = why(r); return; }
    talk = r.value.state; journal = r.value.journal ?? journal; reply = r.value.reply; msg = '';
    ended = r.value.effects.some((e) => e.kind === 'end');
    // Handing the ore over (to Orla or the broker) spends it: it leaves the pack through the module's remove.
    const ore = inv.items.find((i) => i.item === ORE);
    if (ore && r.value.effects.some((e) => e.kind === 'quest' && (e.stage === 'forge' || e.stage === 'broker'))) { const g = remove(inv, ore.id, lookup); if (g.ok) inv = g.value.inventory; }
  },
  // A tap inside the open panel: returns the panel to show next (null = close).
  act(el: HTMLElement | null, open: Kind): Kind | null {
    const d = el?.dataset ?? {};
    if (d.say) play.say(d.say, open);
    else if (d.go) { play.fresh(); return d.go as Kind; }
    else if (d.item) { picked = d.item === picked ? null : d.item; msg = ''; }
    else if (d.do === 'move' && picked) {
      const where = find(inv, picked)?.location.kind, r = (where === 'bank' ? withdraw : deposit)(inv, picked, lookup, BANK_PLACE);
      if (r.ok) { inv = r.value; picked = null; } msg = why(r);
    } else if (d.do === 'wear' && picked) {
      const r = wearSwap(inv, picked, lookup, STANDING);
      if (r.ok) { inv = r.value; msg = `You put on ${nameOf(find(inv, picked)!)}.`; } else msg = why(r);
    } else if (d.do === 'takeoff' && picked) {
      const r = unequip(inv, picked, lookup);
      if (r.ok) { inv = r.value; msg = 'Taken off into your pack.'; } else msg = why(r);
    } else if (d.do === 'upgrade' && picked) play.upgrade(picked);
    return open;
  },
  upgrade(id: string) {
    const inst = find(inv, id)!, def = lookup(inst.item)!, key = `upgrade:${inst.id}:v${inst.version}`;
    const r = performUpgrade({
      request: { kind: 'upgrade-request', schemaVersion: 1, idempotencyKey: key, character: inv.owner, service: SERVICE.id, instance: inst.id, expectedVersion: inst.version, toLevel: upgradeLevelOf(inst) + 1 },
      service: SERVICE, costs: COSTS, instance: inst, def, standing: STANDING, balance: coin, materials: inv.items.filter((i) => lookup(i.item)?.category === 'material'),
      materialDefs: lookup, receipts, now: new Date().toISOString(), place: BANK_PLACE,   // the forge stands at the Exchange
    });
    if (!r.ok) { msg = why(r); return; }
    if (r.value.replayed) return;
    // No inventory call applies an upgrade outcome (an API gap, reported): rebuild the item list and re-open it through the full invariant.
    const out = r.value, next = new Map([[out.instance.id, out.instance], ...out.materials.map((m) => [m.id, m] as const)]);
    const opened = openInventory({ ...inv, items: inv.items.filter((i) => !out.consumed.includes(i.id)).map((i) => next.get(i.id) ?? i) }, lookup);
    if (!opened.ok) { msg = why(opened); return; }
    inv = opened.value; coin = out.balance; receipts.set(key, out.receipt); msg = `Upgraded to +${out.receipt.toLevel} for ${out.receipt.coin} coin.`;
  },
  // ONE gear screen (TOP10 holding-cell move): what you wear and your backpack anywhere (☰ Gear); at the Concord Exchange the same screen docks the vault beside them,
  // so you swap between vault, pack and body in one place. Worn + vault on the left, backpack on the right (docs/DESIGN.md rule 9).
  gearScreen(docked: boolean): string {
    const sel = picked ? find(inv, picked) : undefined, def = sel ? lookup(sel.item) : undefined, p = sel?.provenance, where = sel?.location.kind;
    const wornList = wornRows(inv).filter((r) => r.item).map((r) => ui.row(SLOT_LABEL[r.slot], nameOf(r.item!), { item: r.item!.id }, r.item!.id === picked)).join('') || ui.text('Nothing worn.', true);
    const detail = sel ? `${nameOf(sel)}${p && 'wonBy' in p ? ` · won by ${p.wonBy}${'fromLegend' in p ? ` from ${p.fromLegend} at ${p.atRank}` : ''}, ${p.at.slice(0, 10)}` : ''}` : 'Tap an item.';
    const actions = [
      where === 'pack' && def?.slot ? ui.button('Wear', { do: 'wear' }) : '',
      where === 'equipped' ? ui.button('Take off', { do: 'takeoff' }) : '',
      docked ? ui.button(where === 'bank' ? 'Withdraw' : 'Deposit', { do: 'move' }, !sel || where === 'equipped') : '',
    ].join('');
    return ui.panel(docked ? 'Bank — Concord Exchange' : 'Gear',
      ui.dock(ui.heading('Worn') + wornList + (docked ? ui.heading('Vault') + ui.grid(cells('bank')) : ''), ui.heading('Backpack') + ui.grid(cells('pack'))),
      ui.text(detail, true), actions, ui.text(msg, true));
  },
  render(kind: Kind): string {
    const sel = picked ? find(inv, picked) : undefined;
    switch (kind) {
      case 'ore': return ui.panel('Quarry cart', ui.text(msg));
      case 'bounty': return ui.panel(GIVER?.name ?? 'Nobody', ui.text(reply || 'He looks up from the Roll of the hold.'), ended ? '' : ui.choices(play.lines('bounty')), ui.text(msg, true));
      case 'talk': return ui.panel(SMITH_NAME, ui.text(reply || 'She looks up from the anvil.'), ended ? '' : ui.choices(play.lines()), ui.text(msg, true), ui.button('Upgrade a piece', { go: 'blacksmith' }));
      case 'journal': return ui.panel('Journal', ...(journal.quests.size ? [...journal.quests.values()].map((s) =>
        ui.heading(`${QUESTS.get(s.quest)?.title ?? s.quest} — ${s.status}`) + entries(journal).filter((e) => e.quest === s.quest).map((e) => ui.text(e.text)).join('')) : [ui.text('No quests yet.', true)]));
      case 'bank': return play.gearScreen(true);
      case 'gear': return play.gearScreen(false);
      case 'blacksmith': {
        const gear = inv.items.filter((i) => lookup(i.item)?.power === 'slot-weight');
        const row = sel && COSTS.rows.find((c) => c.level === upgradeLevelOf(sel) + 1 && c.rarity === lookup(sel.item)?.rarity);
        return ui.panel(`Blacksmith — ${SMITH_NAME}`, ui.heading(`Upgrade a piece · ${coin} coin`), ...gear.map((i) => ui.row(nameOf(i), `+${upgradeLevelOf(i)}`, { item: i.id }, i.id === picked)),
          ui.text(row ? `Next level: ${row.coin} coin${row.materials.map((m) => `, ${m.quantity} × ${lookup(m.item)?.name ?? m.item}`).join('')}` : sel ? 'No price for the next level.' : 'Tap a piece.', true),
          ui.button('Upgrade', { do: 'upgrade' }, !sel), ui.text(msg, true), ui.button(`Talk to ${SMITH_NAME}`, { go: 'talk' }));
      }
    }
  },
  state: () => ({
    quests: [...journal.quests.values()].map((s) => ({ quest: s.quest, stage: s.stage, status: s.status, entries: s.journal.length })),
    choices: play.lines().map((l) => l.id), coin, pack: must(gridView(inv, 'pack')).filter(Boolean).map((i) => nameOf(i!)), bank: must(gridView(inv, 'bank', BANK_PLACE)).filter(Boolean).map((i) => nameOf(i!)),
  }),
};
