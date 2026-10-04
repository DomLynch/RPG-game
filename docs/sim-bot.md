# Direct-engine combat diagnostics

This tooling runs the real `Match.startSparring` / `Match.step` code in Node. No renderer, DOM, keyboard driver, account login, rewards or network is involved. It is the fast rules/exploit tier, not a replacement for the tactical browser bot or visual/phone testing. Existing scripted strategies have perfect state access, no human reaction delay and no 20% heavy restriction. Their win rates do not establish human fairness.

Node >=22.18. From this game checkout:

```sh
node scripts/sim-bot.mjs --sparring-url='/?spar=1&opponent=pitborn&difficulty=6&weapon=longsword&skill=none&special=none&yourSpecial=none' --fights=3 --seed=20261004
```

For an exact live selection, copy the URL **after Start sparring**. Pass it in single quotes as `--sparring-url`. It supplies the opponent, actual difficulty, weapon, legacy skill and level-appropriate player/opponent specials through the same parser and session setup as the page. Appearance-only arena/finisher selections do not change these simulated rules. Run substantial sweeps on the shared VPS queue.

`--help` lists the existing strategies. `--strategy='turtle and punish'` changes the probe. `--ticks=7200` bounds each fight; `--out=artifacts/combat/my-check` selects the receipt parent. Each invocation gets a new subdirectory, retains all losses/draws/timeouts, and writes per-fight JSON including actual intents/events, settings, seed, initial fighters, raw attack counts, health loss and damage. Seeds advance with the game's `nextSeed`. Same source/settings/seed/strategy reproduce the same simulated fight. Replay an individual seed with `--fights=1`.

## Settings and limitations

- Source base checked against live `release.json` on 2026-10-04: `4056467af826b03166a575002f7a4f4b04f9dfe7`. Receipt content hashes identify actual local code; a matching base does not prove future live parity.
- This build has ten playable opponents and engine levels 1–46. `veteran` is the Centurion. Held creatures are refused.
- Sparring's displayed ranks 1–10 are **not** engine levels. Rank choices usually use the rung's top engine level, while the current rank can retain its current level. Use the URL's numeric difficulty rather than guessing. Legacy Easy resolves to engine L6; it is not Recruit L1.
- Dom's latest intended ladder is 50 levels, including five Origin levels. That is not implemented by this pinned source (`LEVELS` and `MAX_LEVEL` are 46). Values 47–50 are refused, not clamped or invented. No progression/game-rule changes are made by this tooling.
- `special=none` disables opponent specials. Registered player/opponent specials must match the engine level's authored special band. The admin UI permits cross-rank previews, but this balance runner refuses them rather than judging them as unfair. `yourSpecial` controls the player's registered special separately from the legacy `skill`; invalid combinations fail.
- The existing single-tactic probes now draw and walk from the production opening distance. They do not teleport into the older battery's close-range start. Equipping a special does not mean every strategy will cast it; accepted events are the evidence of usage. Use `--strategy='skill then light'` to exercise an equipped legacy skill or level-matched registered special and follow its opening with lights; the runner refuses this strategy when no skill is equipped.
- `tests/strategies.ts` retains its existing isolated battery setup for older balance gates. Its `taken`/`landed` fields count damaging opponent contacts, not HP. Block chip now belongs to the defending actor; zero-damage contacts do not count. Historical affected metrics must be regenerated.
- New receipts separate contact counts, event damage (can include overkill, includes wall damage) and net HP loss. No terminal `Killed` event is counted again. The receipt's heavy share is diagnostic, not diverse-policy acceptance.

Next testing: stratify opponent/level/weapon/special combinations, keep exact configs and seeds, then reproduce decisive cases in the rendered game. Broad statistical coverage is not visual acceptance.

## Rendered vision review and change proposals

Use real rendered fights for animation, camera, weapon contact, effects/occlusion and HUD readability. Review 2–3 short exchanges without debug overlays first, predicting the incoming attack before contact; then compare the timestamped events. Label still-image findings as still-only; they do not establish motion or input latency. Keep timing/render performance separate from simulation ticks.

For each finding record build, seed (if available), opponent, actual engine level/display rank, weapon, both special selections, viewport, clip timestamp, observed player consequence, frequency, minimal proposed change and confidence. Distinguish reproducible rule/input bugs, visual concerns and design hypotheses. Proposals go to the owner for the main game team; this tooling never autonomously edits or deploys game rules or presentation.
