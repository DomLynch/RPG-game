# Frankendom V2: feel gap audit against V1

Lead, 2026-10-26.
- **V2:** played live at https://v2.frankendom.com (build 8c27deb) at 375×812 in the built-in browser, and read at DomLynch/Frankendom-v2 main 8c27deb.
- **V1:** DomLynch/RPG-game trunk (live 82a994d15).

## The short answer
V2's combat RULES are a faithful copy of V1. Same timing table, parry, posture and stamina, with a parity test against V1. **What's missing is the whole presentation layer that makes a hit feel like a hit.**

V2 is about 1,330 lines in total:
- `src/sim/sim.js`: 467
- `client/input.js`: 236
- `render.js`: 131
- `main.js`: 129
- `assets.js`: 108
- `brain.js`: 101
- `stage.js`: 57

The client draws two animated bodies and three bars per fighter. That's all it draws. V1 had roughly **2,500 lines of feel code plus a sound sprite and blood textures** on top of the same rules.

The good news: V2's sim already emits the events this layer needs (`Hit`, `Blocked`, `Parried`, `GuardBroken`, `PostureBroken`, `Killed`, `Dodged`, `Swing`, `Feint`: `src/sim/sim.js` lines 167-449). So all of this is client-side and data-driven, with no sim change.

## What I saw playing it
- **Silence.** V2 has no audio code at all: no AudioContext and no audio files (checked in the page and the source).
- **On a landed light cut, nothing happens on screen except the opponent's health bar dropping.** There's no spark, no flash, no blood, and no camera movement.
- **Hit-stop is off.** `data/hit-stop.json` has the old V1 table, but `scale: 0`. `?hitstop=1` turns it on.
- **The bout ends with just the word "Defeat".** There's no finisher and no slow-motion. The losing body was still standing in the frames I caught (single frames; the death clip may start later).
- **The fight camera drifted off the lock-on after I walked in.** The yellow height ruler came into frame from the side (one walk, single observation).
- **Bodies are the MakeHuman test pair in street clothes**, and the opponent's sword wasn't visible in some frames. That's a placeholder look, not a gap in feel.

## Gap list, ranked by how much "weight" it buys

| # | Missing in V2 | V1 had (paths in RPG-game trunk) | V1 size | V2 effort |
|---|---|---|---|---|
| 1 | **Hit sounds:** swing whoosh, flesh hit, block clang, parry ring, kill thud, breath/grunts | `src/fight/sound/cues.ts`, `feedback.ts`, `breath.ts`, `audio-rules-defs.json`, sprite `src/assets/audio/sprite.m4a/.ogg` (sources in `SOURCES.json`) | ~600 lines + 1 sprite | 1-2 days; reuse V1's sprite + cue table |
| 2 | **Hit-stop on** | the table already in V2 `data/hit-stop.json` | data | **1 line**: set `scale` to 1 (Dom's call) |
| 3 | **Camera kick / shake on hits, heavies, kills** | `src/fight/camera-kick.ts`, `feel-rules.json` | ~70 lines | half a day |
| 4 | **Clash sparks + hit impact flash** | `clash-sparks.ts` (113), `hit-impact.ts` (73), `impact-fx.ts` (62), `fx.ts` + `fx-rows.json` | ~530 lines | 1 day |
| 5 | **Blood and wounds:** spray on hit, wound decals, floor pools | `gore.ts` (545), `blood-*.ts/json`, `wounds*.ts`, textures in `src/assets/blood/` | ~800 lines + 14 PNGs | 2 days (start with spray + floor pool) |
| 6 | **Finishers:** kill cam, 0.75× finisher clock, Decapitation/Split Crown | `finishers.ts`, `finisher-defs.json`, `finisher-blood.ts`, `severed-head.ts`, `scene.ts:484,936-945` | ~400 lines + clips | 2-3 days; clip map already sent to OpenTrident |
| 7 | **Hit reactions that read:** visible stagger/knockback on the victim (V2's sim moves knockback; the Hit clip barely shows at 375) | `characters.ts` hurt/stagger roles | – | half a day: stronger hit clip from the Mixamo set + scrub to stun |
| 8 | **Charge glow / special FX** | `charge-fx.ts`, `special-fx*.ts` | ~300 (core) | later |
| 9 | **Arena ambience + crowd, win/loss stings** | `src/assets/arena-audio/`, `duel-audio/` (go, win, loss, tick) | assets | half a day |
| 10 | **Arena art** (V2 is a grid floor + sky + a height ruler) | Pit room art, `docs/character-references/pit/` | – | design call |

## Recommendation
1. **Today, cheap:** hit-stop on (one data line) and the camera kick (#2 + #3). Those two alone take most of the "floaty" out.
2. **Next 2-3 days:** sound (#1), then sparks and impact (#4), then blood spray and floor pool (#5).
3. **Then:** finishers (#6) with Decapitation and Split Crown first, plus stronger hit reactions (#7).

Rules for the port:
- **Copy V1's data and assets, not its code.** That means the cue table, the sprite, the blood textures, and the fx and hit-stop rows.
- Each effect is one small client module that listens to sim events, with every number in `data/*.json`.
- Expect about 1,000-1,500 more lines in V2 for #1-#7.
- Keep V2's rule: nothing in `src/sim/` changes.
