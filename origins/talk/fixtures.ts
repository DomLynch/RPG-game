// Example content: Orla the smith at the Concord Exchange, wired to the quest journal's "The Concord Commission"
// (smith → fetch → forge | broker → returned | exposed). A raw record as it would arrive in a content file; loadTalk validates it.
const CQ = 'quest:concord-commission';
const at = (stage: string | null) => ({ kind: 'quest-at', quest: CQ, stage });
const step = (stage: string, choice: string | null = null) => ({ kind: 'quest', quest: CQ, stage, choice });
const ORE = { kind: 'has-item', item: 'item:exchange-ore' };
const HONEST = { kind: 'flag', name: 'lied-to-orla', value: false };
const line = (id: string, priority: number, once: boolean, text: string, reply: string, when: unknown[] = [], effects: unknown[] = []) =>
  ({ id, text, reply, priority, once, when, effects });

export const orla = () => ({
  kind: 'npc-talk', schemaVersion: 1, npc: 'character:smith-orla',
  lines: [
    line('greet-first', 0, true, 'Hello.', 'Orla. I keep the forge by the Exchange. Mind the sparks.', [HONEST], [{ kind: 'set-flag', name: 'met-orla', value: true }]),
    line('greet', 1, false, 'Hello again.', 'Back again? Speak, the iron is cooling.', [{ kind: 'flag', name: 'met-orla', value: true }, HONEST]),
    line('cold', 1, false, 'Orla?', 'I have nothing to say to you.', [{ kind: 'flag', name: 'lied-to-orla', value: true }], [{ kind: 'end' }]),
    line('offer', 10, true, 'Need a hand?', 'A commission came in and I have no ore. Will you hear it?', [at(null), { kind: 'tier-at-least', tier: 'Gladiator' }], [step('smith')]),
    line('take-job', 10, true, 'I will take the job.', 'The ore waits at the quarry carts past the gate. Bring it here.', [at('smith')], [step('fetch')]),
    line('hand-ore', 11, true, 'Here is your ore.', 'Good weight. Come back when the blade is cooled.', [at('fetch'), ORE], [step('forge', 'smith')]),
    line('broker-offer', 12, true, 'The broker offered more for it.', 'Then take his coin. I will remember who brings me ore.', [at('fetch'), ORE], [step('broker', 'broker')]),
    line('where-ore', 20, false, 'Where is the ore again?', 'Quarry carts, past the Exchange gate.', [at('fetch')]),
    line('collect', 10, true, 'Is the blade ready?', 'Cooled and sharp. The commission is done.', [at('forge'), { kind: 'tier-at-least', tier: 'Gladiator' }], [step('returned')]),
    line('confess', 10, true, 'I sold your ore to the broker.', 'Honest, at least. We are square.', [at('broker')], [step('returned', 'confess')]),
    line('lie', 11, true, 'The carts were empty.', 'The broker sold my own ore back to me this morning. Get out.', [at('broker')],
      [step('exposed', 'lie'), { kind: 'set-flag', name: 'lied-to-orla', value: true }, { kind: 'end' }]),
    line('done', 30, false, 'How is the blade?', 'Still the best work on the Exchange.', [at('returned')]),
    line('farewell', 99, false, 'Farewell.', 'Mind the sparks.', [HONEST], [{ kind: 'end' }]),
  ],
});
