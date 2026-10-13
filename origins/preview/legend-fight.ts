// A legend boss fought through the VERIFIED encounter path (World, 2026-10-13; the grimoire grants a spell only on a verified `boss:<legend>` win, origins/server/grimoire.ts). The page walks up
// to a placed legend (origins/preview/legend-mobs.ts) and taps it; this is the two halves around the duel: `beginLegendFight` asks the server for the fight (encounter_start names the legend, the
// body names no foe, level or seed) and answers the duel to open, `finishLegendFight` posts the duel's record to encounter_settle and answers the words to show. Network calls are injected, so
// a test plays both halves with a stand-in server; no DOM, storage or clock is read here. A guest, an offline page or a refusal is an answer (a line to say), never a throw.
import { bossFightId } from '../boss/legend-boss.ts';
import type { FightRecord } from '../../src/fight/index.ts';
import type { Offline } from '../../src/core/index.ts';
import type { Fight, Settled } from './encounter-net.ts';
import type { MobSpec } from './mobs.ts';

export type LegendNet = {
  token(): string | null; character(): string | null | Promise<string | null>;   // the character id may need a read first (main.ts characterFor)
  start(token: string | null, character: string, encounter: string): Promise<Fight | Offline>;
  settle(token: string | null, fight: string, record: FightRecord): Promise<Settled | Offline>;
};
/** What the pit duel opens with (pit-duel.ts DuelFight): the server's foe, level and seed, asking for the record the settle needs. */
export type LegendDuel = { opponent: string; level: number; seed: number; flags: readonly never[]; bar?: number; record: true; as: { name: string; level: number } };
export type Begun = { ok: true; token: string; duel: LegendDuel } | { ok: false; say: string };

const offline = (r: unknown): r is Offline => typeof r === 'object' && r !== null && 'offline' in r;

export async function beginLegendFight(spec: Pick<MobSpec, 'legend' | 'name'>, net: LegendNet): Promise<Begun> {
  if (!spec.legend) return { ok: false, say: 'That is no legend.' };
  const token = net.token(), character = await net.character();
  if (!token || !character) return { ok: false, say: `Sign in to fight ${spec.name}: a legend's spell is earned on a verified win.` };
  const got = await net.start(token, character, bossFightId(spec.legend));
  if (offline(got)) return { ok: false, say: `${spec.name} cannot be fought right now. Try again in a moment.` };
  return { ok: true, token: got.token, duel: { opponent: got.enemy, level: got.level, seed: got.seed, flags: got.flags as never[], ...(got.bar ? { bar: got.bar } : {}), record: true, as: { name: spec.name, level: got.level } } };
}

/** The words after the duel: nothing for a fight with no record; the win, verified or not, and the loss. A verified win is what takes the spell, once per legend. */
export async function finishLegendFight(spec: Pick<MobSpec, 'name'>, begun: Extract<Begun, { ok: true }>, record: FightRecord | null | undefined, net: LegendNet): Promise<string | null> {
  if (!record) return null;
  const done = await net.settle(net.token(), begun.token, record);
  if (offline(done)) return `${spec.name}: the result could not be sent. Nothing was lost.`;
  if (done.result === 'won' && done.verified) return `${spec.name} falls. Their spell is yours, once only: see your grimoire.`;
  if (done.result === 'won') return `${spec.name} falls, but the win could not be verified: no spell.`;
  return `${spec.name} stands. Train and return.`;
}
