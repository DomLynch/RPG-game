// Origins greybox, roadmap stage 2: the rules modules behind the panels. Orla's talk (origins/talk) drives the quest journal
// (origins/quests). The bank and the smith hold NOTHING here: they show the server's ledger (gear_open) and ask its ops (bank_move, apply_upgrade) through src/core, then show what it answers.
// The quest journal and the talk are the page session's; no item, coin or bronze is kept on the page.
import { heroBodyUrl } from '../../src/fight/index.ts';
import type { Result } from '../contracts/core.ts';
import { PC, smith } from '../contracts/fixtures.ts';
import type { CharacterInstanceId, EncounterId, ItemId, QuestId } from '../contracts/ids.ts';
import { parseQuestDefinition, type QuestDefinition } from '../contracts/story.ts';
import { parseCharacterDefinition, type CareerStanding } from '../contracts/world.ts';
import { bankMove, openGear, upgradePiece, type GearPiece, type GearView, type Offline } from '../../src/core/index.ts';
import { itemNamer } from './item-names.ts';
import { SIGN_IN_HREF } from './save.ts';
import { concordCommission } from '../quests/fixtures.ts';
import { advance, entries, newJournal, type Journal } from '../quests/journal.ts';
import { orla } from '../talk/fixtures.ts';
import { choices, loadTalk, newTalkState, pick, type Facts, type Talk } from '../talk/talk.ts';
import { BANK_STEP_Z, FORGE } from './exchange.ts';
import { ui, type Cell } from './ui.ts';

// Every new world number in one place (to be swapped for origins/world): Orla's spot, the ore pile and how near you must stand.
export const WORLD_TUNING = {
  orla: { x: FORGE.x - 0.6, z: FORGE.z + 0.3, radius: 0.29, length: 1.15 },   // behind the anvil, facing the plaza (envoy-sized capsule)
  orePile: { x: -FORGE.halfX * 2, z: BANK_STEP_Z + 38, radius: 0.55 },         // "the quarry carts past the gate": inside the plaza, left of the passage
  reach: { forge: 3, bank: 3.6, bankHalfWidth: 13, ore: 2.5, pit: 5 },   // pit: from the Pit's centre, where the duel is offered
};
// Every model the preview loads, id → URL; null = a greybox stand-in built in main.ts. Swapping art is a one-line change here.
export const ASSETS: Record<'hero' | 'orla' | 'ore', string | null> = { hero: heroBodyUrl(), orla: null, ore: null };

export type Kind = 'talk' | 'journal' | 'bank' | 'blacksmith' | 'ore' | 'bounty';   // bounty: the ?region=1 Bounty giver (enableBounty)
const must = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const why = (r: Result<unknown>) => (r.ok ? '' : r.issues[0]!.message);

// Content, from the modules' fixtures. The ore is the item Orla's talk and the quest name; no fixture defines it (an API gap, reported),
// so it is the grave-iron material re-keyed to that id.
const TALK = must(loadTalk(orla())), QUEST = must(parseQuestDefinition(concordCommission())), QUESTS = new Map<QuestId, QuestDefinition>([[QUEST.id, QUEST]]);
// ?region=1 only: the Bounty giver's talk and name (play.enableBounty); null keeps the page as it is without the flag.
let GIVER: { talk: Talk; name: string } | null = null;
const talkFor = (kind: Kind): Talk => (kind === 'bounty' && GIVER ? GIVER.talk : TALK);
const ORE = (QUEST.stages.flatMap((s) => s.transitions.flatMap((t) => t.when)).find((c) => c.kind === 'has-item') as { item: ItemId }).item;
export const SMITH_NAME = must(parseCharacterDefinition(smith())).name;
// The career level the gates read: the Origins career's (origins/pit, the Pit duel settles it through award()), starting a Champion: past
// the outer gate, and may wear a +1 Gladiator piece. The page moves it with play.standAt after a duel pays.
export const START_LEVEL = 16;
let STANDING: CareerStanding = { source: 'server', careerLevel: START_LEVEL };

// The bank and the smith's link to the one ledger (main.ts supplies it): the sign-in token, the character, where the writer is, and a nudge to redraw the open panel when an answer lands.
export type Link = { token(): string | null; character(): string | null | Promise<string | null>; base?: string; changed(): void };
let link: Link | null = null, view: GearView | null = null, busy = false, down: string | null = null;
let journal: Journal = newJournal(PC as CharacterInstanceId), talk = newTalkState(), oreCarried = false;   // the Concord commission's errand token, spent when handed over: a quest step, not a value
let reply = '', msg = '', picked: string | null = null, ended = false;
const itemName = itemNamer();

const hasItem = (item: ItemId) => item === ORE && oreCarried;
const facts = (): Facts => ({ standing: STANDING, quest: (id) => journal.quests.get(id), hasItem });
const step = (quest: Parameters<typeof advance>[1], stage: string, choice: string | null, cleared?: (encounter: EncounterId) => boolean): Result<Journal> => {
  const r = advance(journal, quest, stage, { quests: QUESTS, standing: STANDING, at: new Date().toISOString(), choice: choice ?? undefined, hasItem, cleared });
  return r.ok ? { ok: true, value: r.value.journal } : r;
};
const pieceName = (p: GearPiece) => `${itemName(p.item)}${p.level ? ` +${p.level}` : ''}`;
const slots = (where: 'pack' | 'bank', size: number): Cell[] => {
  const out: Cell[] = Array.from({ length: size }, () => null);
  for (const p of view?.pieces ?? []) if (p.where === where && p.index !== null && p.index < size) out[p.index] = { id: p.id, label: pieceName(p), on: p.id === picked };
  for (const r of view?.stock ?? []) if (r.where === where && r.index < size) out[r.index] = { id: r.id, label: `${r.name}${r.quantity > 1 ? ` ×${r.quantity}` : ''}`, on: r.id === picked };
  return out;
};
const pieceOf = (id: string | null) => (id ? view?.pieces.find((p) => p.id === id) : undefined);
const stockOf = (id: string | null) => (id ? view?.stock.find((r) => r.id === id) : undefined);
const offlineMsg = (o: Offline) => (o.offline === 'no-session' ? 'Sign in to use the bank.' : o.offline === 'http-422' ? 'The Exchange refused that.' : 'The server did not answer.');

// One server round trip: ask, then show what came back. Nothing is changed on the page before the answer.
async function ask<T>(run: (token: string | null, character: string) => Promise<T | Offline>, done: (v: T) => string): Promise<void> {
  if (busy || !link) return;
  busy = true; msg = 'One moment.'; link.changed();
  const character = await link.character();
  const r = link.token() && character ? await run(link.token(), character) : { offline: 'no-session' } as Offline;
  busy = false;
  if (r && typeof r === 'object' && 'offline' in r) { msg = offlineMsg(r as Offline); if ((r as Offline).offline !== 'no-session') await refresh(); } else msg = done(r as T);
  link.changed();
}
async function refresh(): Promise<void> {
  const l = link; if (!l) return;
  const character = await l.character(), token = l.token();
  if (!token || !character) { view = null; down = 'no-session'; return; }
  const v = await openGear(token, character, { base: l.base });
  if ('offline' in v) { down = v.offline; return; }
  view = v; down = null; if (picked && !pieceOf(picked) && !stockOf(picked)) picked = null;
}

export const play = {
  standAt(level: number) { STANDING = { source: 'server', careerLevel: level }; },
  link(l: Link) { link = l; },
  /** A bank or smith panel opens: read the ledger again (the server is the only copy). */
  async load(): Promise<void> { await refresh(); link?.changed(); },
  fresh() { reply = msg = ''; picked = null; ended = false; },
  oreWanted: () => journal.quests.get(QUEST.id)?.stage === 'fetch' && !hasItem(ORE),
  takeOre() { oreCarried = true; msg = 'You take 5 Exchange ore from the cart.'; },
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
    if (r.value.effects.some((e) => e.kind === 'quest' && (e.stage === 'forge' || e.stage === 'broker'))) oreCarried = false;   // handed over: the errand token is spent
  },
  // A tap inside the open panel: returns the panel to show next (null = close).
  act(el: HTMLElement | null, open: Kind): Kind | null {
    const d = el?.dataset ?? {};
    if (d.say) play.say(d.say, open);
    else if (d.go) { play.fresh(); return d.go as Kind; }
    else if (d.item) { picked = d.item === picked ? null : d.item; msg = ''; }
    else if (d.do === 'move' && picked) {
      const id = picked, to = (pieceOf(id)?.where ?? stockOf(id)?.where) === 'bank' ? 'pack' : 'bank';
      void ask((t, c) => bankMove(t, c, id, to, { base: link?.base }), (v) => { view = v; picked = null; return to === 'bank' ? 'Deposited.' : 'Withdrawn.'; });
    } else if (d.do === 'upgrade' && picked) play.upgrade(picked);
    return open;
  },
  upgrade(id: string) {
    const p = pieceOf(id); if (!p) return;
    const mats = (view?.stock ?? []).filter((r) => r.category === 'material' && r.where === 'pack').map((r) => r.id);
    void ask((t, c) => upgradePiece(t, c, p, mats, { base: link?.base }), (r) => `Upgraded to +${r.toLevel} for ${r.coin} coin.`).then(() => refresh()).then(() => link?.changed());
  },
  render(kind: Kind): string {
    const piece = pieceOf(picked), row = stockOf(picked);
    const signIn = () => ui.panel(kind === 'bank' ? 'Bank — Concord Exchange' : `Blacksmith — ${SMITH_NAME}`, ui.text('Sign in to use the bank and the smith: your items live on the server.'), `<a class="act" href="${SIGN_IN_HREF}">Sign in</a>`);
    switch (kind) {
      case 'ore': return ui.panel('Quarry cart', ui.text(msg));
      case 'bounty': return ui.panel(GIVER?.name ?? 'Nobody', ui.text(reply || 'He looks up from the Roll of the hold.'), ended ? '' : ui.choices(play.lines('bounty')), ui.text(msg, true));
      case 'talk': return ui.panel(SMITH_NAME, ui.text(reply || 'She looks up from the anvil.'), ended ? '' : ui.choices(play.lines()), ui.text(msg, true), ui.button('Upgrade a piece', { go: 'blacksmith' }));
      case 'journal': return ui.panel('Journal', ...(journal.quests.size ? [...journal.quests.values()].map((s) =>
        ui.heading(`${QUESTS.get(s.quest)?.title ?? s.quest} — ${s.status}`) + entries(journal).filter((e) => e.quest === s.quest).map((e) => ui.text(e.text)).join('')) : [ui.text('No quests yet.', true)]));
      case 'bank': {
        if (down === 'no-session') return signIn();
        if (!view) return ui.panel('Bank — Concord Exchange', ui.text(down ? 'The server did not answer.' : 'Opening the vault.', true), ui.text(msg, true));
        const at = piece?.where ?? row?.where;
        return ui.panel('Bank — Concord Exchange', ui.grid(slots('bank', view.bankSize)), ui.heading('Backpack'), ui.grid(slots('pack', view.packSize)),
          ui.text(piece ? pieceName(piece) : row ? row.name : 'Tap an item.', true),
          ui.button(at === 'bank' ? 'Withdraw' : 'Deposit', { do: 'move' }, !(piece || row) || at === 'equipped' || busy), ui.text(msg, true));
      }
      case 'blacksmith': {
        if (down === 'no-session') return signIn();
        const gear = (view?.pieces ?? []).filter((p) => p.where !== 'equipped' && p.slot !== null);
        return ui.panel(`Blacksmith — ${SMITH_NAME}`, ui.heading('Upgrade a piece'), ...gear.map((p) => ui.row(pieceName(p), `+${p.level}`, { item: p.id }, p.id === picked)),
          ui.text(piece ? 'The Exchange prices it and takes the materials from your pack.' : view ? 'Tap a piece.' : 'Opening the forge.', true),
          ui.button('Upgrade', { do: 'upgrade' }, !piece || busy), ui.text(msg, true), ui.button(`Talk to ${SMITH_NAME}`, { go: 'talk' }));
      }
    }
  },
  state: () => ({
    quests: [...journal.quests.values()].map((s) => ({ quest: s.quest, stage: s.stage, status: s.status, entries: s.journal.length })),
    choices: play.lines().map((l) => l.id), pack: (view?.pieces ?? []).filter((p) => p.where === 'pack').map(pieceName), bank: (view?.pieces ?? []).filter((p) => p.where === 'bank').map(pieceName),
  }),
};
