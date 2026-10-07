// ?region=1: the slice's one Bounty, offered by its town's ruler and carried in the quest journal. Pure: no DOM.
//
// STUB, preview only. A Bounty is its own content kind (region1 §3, `bounty-definition`), not a quest, and the journal has no Bounty
// entry yet. So the preview wraps the Bounty record in a two-stage quest record, built here from the Bounty's own data (its name, foe,
// twist, metal and daily cap): `posted` when the ruler gives it, `won` behind the encounter's clear. No Bounty fight runs in this slice,
// so `won` is never reached. Talk is an `npc-talk` record, loaded by origins/talk like Orla's.
import type { Twist } from '../region1/load.ts';
import type { Giver } from './frontier-plan.ts';

const none = () => ({ loot: null, standing: [] });
// The twist as the player reads it (region1 §3's Bounties table wording, from the flag's own fields).
export function twistText(t: Twist): string {
  switch (t.kind) {
    case 'hazard': return t.hazard === 'embers' ? `Embers: the floor burns whoever stands still for ${t.stillSeconds as number} s` : `Breaking planks: they give under whoever stands still for ${t.stillSeconds as number} s`;
    case 'flee-at': return `Flees at ${t.percent as number}%: catch them within ${t.catchSeconds as number} s or the attempt is forfeit`;
    case 'one-health-bar': return 'Two in a row, one health bar';
    case 'no-block': return 'No blocking';
    case 'damage-only-on-parry': return 'Only a parry draws blood';
    case 'heal-on-hit': return 'Every hit they land heals them';
    case 'candlelight': return 'Fought by candlelight';
  }
}

export const bountyQuestId = (g: Giver) => `quest:${g.bounty.id.replace(':', '-')}`;

export function bountyQuest(g: Giver) {
  const b = g.bounty;
  return {
    kind: 'quest-definition', schemaVersion: 1, id: bountyQuestId(g), title: `Bounty: ${b.name}`, storyVersion: 1, scope: 'personal', gate: 'outer', start: 'posted',
    stages: [
      { id: 'posted', kind: 'progress', rewards: none(),
        journal: `${g.name} posted a Bounty: ${g.foe}, at ${g.where}. ${twistText(b.twist)}. ${b.metal} bronze a paid win, ${b.dailyCap} paid wins a day.`,
        transitions: [{ to: 'won', when: [{ kind: 'encounter-cleared', encounter: b.encounter }], label: `Beat ${g.foe}` }] },
      { id: 'won', kind: 'finish', journal: `${g.foe} is down. ${g.name} pays the Bounty.`, transitions: [], rewards: none() },
    ],
    migrations: [],
  };
}

export function giverTalk(g: Giver) {
  const Q = bountyQuestId(g), at = (stage: string | null) => ({ kind: 'quest-at', quest: Q, stage });
  const line = (id: string, priority: number, once: boolean, text: string, reply: string, when: unknown[] = [], effects: unknown[] = []) => ({ id, text, reply, priority, once, when, effects });
  return {
    kind: 'npc-talk', schemaVersion: 1, npc: g.character,
    lines: [
      line('work', 10, true, 'Any work?', `${g.foe} has taken ${g.where.split(' in ')[0]} and fights anyone who comes. Put him down and I pay ${g.bounty.metal} bronze.`,
        [at(null), { kind: 'tier-at-least', tier: 'Gladiator' }], [{ kind: 'quest', quest: Q, stage: 'posted', choice: null }]),
      line('where', 20, false, `Where is ${g.foe}?`, `${g.where[0]!.toUpperCase()}${g.where.slice(1)}. ${twistText(g.bounty.twist)}. Keep moving.`, [at('posted')]),
      line('farewell', 99, false, 'Farewell.', 'Mind the ash out there.', [], [{ kind: 'end' }]),
    ],
  };
}
