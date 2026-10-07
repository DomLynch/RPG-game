// Example content for the journal tests: chapter one's first quest at the Concord Exchange, and a follow-up that opens only on one branch.
// Raw records (as they would arrive in a content file), parsed by the contracts' parseQuestDefinition. Example content only; not shipped.
const none = () => ({ loot: null, standing: [] });

export const concordCommission = () => ({
  kind: 'quest-definition', schemaVersion: 1, id: 'quest:concord-commission', title: 'The Concord Commission', storyVersion: 1, scope: 'personal', gate: 'outer', start: 'smith',
  stages: [
    { id: 'smith', kind: 'progress', journal: 'Orla the smith at the Concord Exchange needs ore for a commission.', rewards: none(),
      transitions: [{ to: 'fetch', when: [], label: 'Take the job' }] },
    { id: 'fetch', kind: 'progress', journal: 'The ore waits at the quarry carts past the Exchange gate.', rewards: none(),
      transitions: [
        { to: 'forge', when: [{ kind: 'choice', choice: 'smith' }, { kind: 'has-item', item: 'item:exchange-ore' }], label: 'Bring the ore to Orla' },
        { to: 'broker', when: [{ kind: 'choice', choice: 'broker' }, { kind: 'has-item', item: 'item:exchange-ore' }], label: 'Sell it to the broker' },
      ] },
    { id: 'forge', kind: 'progress', journal: 'Orla took the ore. She says to come back when the blade is cooled.', rewards: { loot: null, standing: [{ faction: 'faction:concord', delta: 25 }] },
      transitions: [{ to: 'returned', when: [{ kind: 'tier-at-least', tier: 'Gladiator' }], label: 'Collect the blade' }] },
    { id: 'broker', kind: 'progress', journal: 'The broker paid well. Orla will hear of it.', rewards: none(),
      transitions: [{ to: 'returned', when: [{ kind: 'choice', choice: 'confess' }], label: 'Tell Orla' }, { to: 'exposed', when: [{ kind: 'choice', choice: 'lie' }], label: 'Say the carts were empty' }] },
    { id: 'returned', kind: 'finish', journal: 'The commission is done.', transitions: [], rewards: { loot: 'loottable:concord-commission', standing: [] } },
    { id: 'exposed', kind: 'fail', journal: 'Orla knows I lied. She will not work for me again.', transitions: [], rewards: { loot: null, standing: [{ faction: 'faction:concord', delta: -50 }] } },
  ],
  migrations: [],
});

// Opens only after the smith branch: the prior-quest-stage condition.
export const smithsFavour = () => ({
  kind: 'quest-definition', schemaVersion: 1, id: 'quest:smiths-favour', title: "The Smith's Favour", storyVersion: 1, scope: 'personal', gate: 'outer', start: 'asked',
  stages: [
    { id: 'asked', kind: 'progress', journal: 'Orla has one more favour to ask.', rewards: none(),
      transitions: [{ to: 'done', when: [{ kind: 'stage-reached', quest: 'quest:concord-commission', stage: 'forge' }], label: null }] },
    { id: 'done', kind: 'finish', journal: '', transitions: [], rewards: none() },
  ],
  migrations: [],
});
