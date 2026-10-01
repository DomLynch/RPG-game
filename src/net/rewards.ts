// PvP results and rewards (Strategy ruling, 2026-09-29, via Lead): a PvP result never writes marks, rank or loot until the assist-bot
// statistics check (docs/duel-architecture.md §6, brief stage c) exists. This is the one switch, pinned false by tests/net-rollback.test.ts;
// turning it on is a reviewed change with that check in the same PR, never a flag flipped at runtime. Nothing in src/net imports the
// profile, career, awards or loot modules either (the same test walks the imports).
export const PVP_REWARDS = false as const;
