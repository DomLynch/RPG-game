# Origins O2: the world boss event

A staged world boss as a pure state machine (`boss.ts`): **dormant → gathering** (kill a wave's lesser foes to fill the bar) **→ boss → defeated → dormant** once the encounter's `restartSeconds` cooldown has passed; a caller-signalled `abandon` (everyone left) drops gathering or a live boss back to dormant. Each participant's damage is clipped to the health left, so the shares never pass 100%. On defeat it emits, once, for every character at **≥ 10% of the boss's health** (progression's `MIN_CONTRIBUTION_PERMILLE`): one progression `Kill` event (`type: 'world-boss'`) and one loot request. Both carry the same key, `<hash>:<defeat #>:<pc>`, so a retried settlement is caught by the server's unique index. `<hash>` is the encounter id's short hash (`hash.ts`, pure and synchronous, node and browser): the first 12 RFC 4648 base32 characters (lowercase `a-z2-7`, no padding) of SHA-256 of the id's UTF-8 bytes, e.g. `encounter:matriarch` → `mgqknfrzhcxw`. The key therefore fits the contracts' 128-character mint key for any legal encounter id. First-win-only pay is the progression model's rule (`award` → `already-beaten`), not this module's.

The content is the contracts' `EncounterDefinition` with its optional `boss.level` and `boss.health` set; `parseBossDefinition` refuses a boss encounter without both or with a threshold other than the progression model's; the id needs only the contracts' id rules. The sample is chapter one's **Ash Hound Matriarch** in `fixtures.ts`: the Ash Frontier, beyond the Concord Exchange's west gate, with 12 ash hounds and a level 12 boss.

**Status:** paper and prototype only. Nothing in `src/` imports it.

**Spec sources** (clean room, specs only): `docs/specs/origins/modernuo-champion-spawns.md` (kill bar → boss → stop → restart delay, minion kills during the boss count for nothing), `docs/specs/origins/progression-proposal.md` with `origins/progression/model.ts` (the world-boss row, ≥ 10% contribution, party of at most 4), and `docs/specs/origins/eqemu-experience.md` (the party levels on the event).

**Checks** (VPS): `node --test tests/origins-boss.test.ts`, then strict `tsc` and `eslint origins/boss`.

**Not done:** rendering, AI and combat (the greybox); the server's loot roll and its verification; persistence of the state; public-encounter decay (only the caller-signalled abandon is modelled; decay stays out until content needs it); spawn population and roster.
