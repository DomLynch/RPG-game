// The greybox's client-side feel numbers as data (World, Dom's data-layer rule 2026-10-13): the thumb sticks' radius, look gain and dead zone, how near a creature animates every
// frame, the phone fetch range, the client respawn and warm-up bounds, the spawn-net keep-alive / record / retry limits, the save renew timeout, the duel camera ease, the camp fire's size and light reach, the presence give-up count the day clock (length, dusk, dawn) and the page's own: gate gap, warm-up and compile waits, upload budget, creature tap and lock ranges, turn rate. One `rules`
// row each (id, value, unit) through the shared loader (src/core/registry.ts); every default equals the literal it replaced (tests/preview-rules.test.ts pins them). None of these is
// read by the sim, so this table is NOT part of the world digest and a retune needs no WORLD_SIM_VERSION bump. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import DEFS from './preview-rules-defs.json' with { type: 'json' };
import MANIFEST from './preview-rules-defs.manifest.json' with { type: 'json' };

export type PreviewRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['stickRadius', 'lookGain', 'stickDead', 'fetchRangePhone', 'nearTick', 'clientRespawn', 'warmBound', 'touchEvery', 'maxRecordChars', 'spentWindow', 'askBudget', 'engageTtl', 'releaseFactor', 'engageRetry', 'outboxTries', 'renewTimeout', 'cameraEase', 'campFlameSize', 'campLightReach', 'presenceGiveUp', 'gameDayMinutes', 'duskHour', 'dawnHour', 'duskSpan', 'gateGap', 'heroWait', 'kindsWait', 'materialBound', 'uploadBudget', 'legendReach', 'lockRange', 'turnRate', 'tapRange', 'tapMs', 'tapPx', 'loadoutWait', 'gearRetry', 'remoteWarm', 'remoteSnap', 'remoteIdle', 'remoteTagY', 'remoteExpire', 'remoteFullCount', 'remoteCheapEvery', 'remoteAnimRange', 'remoteBoundR', 'remoteOwedCap', 'remoteAdaptFullCount', 'remoteAdaptSlowMs', 'remoteAdaptOkMs', 'remoteAdaptWindowMs', 'remoteAdaptJudgeMs', 'remoteAdaptPercentile', 'remoteGroundStep', 'kitWarmMs', 'kitWarmMsSoft', 'kitProbeFrames', 'kitSlowFrameMs', 'gearWarmSettle'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every rule the page reads by name must exist, with a positive value. */
export function loadPreviewRules(raw: { rules?: readonly unknown[] }): readonly PreviewRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'preview-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly PreviewRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`preview-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`preview-rules: the page reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const PREVIEW_RULES: readonly PreviewRule[] = loadPreviewRules(DEFS);
export const previewRule = (id: (typeof NAMED)[number]): number => PREVIEW_RULES.find((r) => r.id === id)!.value;
