import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as feedback from '../src/feedback.ts';
import * as hitImpact from '../src/hit-impact.ts';
import * as pvpHold from '../src/pvp-hold.ts';
import * as armfeelModule from '../src/armfeel.ts';
import * as sim from '../src/sim.ts';
import * as combat from '../src/combat.ts';
import * as moves from '../src/moves.ts';
const { MOVES } = moves;
import * as profile from '../src/profile.ts';
import { atGateLine, doorHidden, DOOR_STILL, GATE_LINE } from '../src/pit-coordinator.ts';   // the D2 gate helpers are pure: main.ts reads them through this stub
import * as ladder from '../src/ladder.ts';
import * as arenaThemes from '../src/arena-themes.ts';
import * as roster from '../src/roster.ts';
import * as trial from '../src/trial.ts';
import * as record from '../src/record.ts';
import { peekRecordHeader } from '../src/record-header.ts';
import * as loot from '../src/loot.ts';
import * as grades from '../src/grades.ts';
import * as lootPanel from '../src/loot-panel.ts';
import * as quality from '../src/quality.ts';   // ?dpr= parsing (urlDpr): pure, the real module
import * as perfBeacon from '../src/perf-beacon.ts';   // the per-fight beacon (#1035): pure payload + send, the real module
import * as rankLook from '../src/rank-look.ts';   // the rematch's rank-look reload decision (#961): pure, the real module   // the kill screen's Take-one panel: main.ts builds it at boot with this harness's element lookup
import * as replay from '../src/replay.ts';
import * as shareStore from '../src/share-store.ts';
import * as clip from '../src/clip.ts';
import * as detmath from '../src/detmath.ts';
import * as ai from '../src/ai.ts';
import * as autopsyModule from '../src/autopsy.ts';
import * as sparring from '../src/sparring.ts';
import * as specialLook from '../src/special-look.ts';
import * as sparringSpecials from '../src/sparring-specials.ts';
import * as sparringSpecialRuntime from '../src/sparring-special-runtime.ts';
import * as specialAudio from '../src/audio/special.ts';
import * as specialIdentity from '../src/special-identity.ts';
import * as classSpecialIdentity from '../src/class-special-identity.ts';
// The build's API is stubbed per test: the harness has no network and no env.
// clip.ts behind a mutable copy (as shareModule): a test swaps recordClip for a recorder whose stop() it resolves by hand.
const clipModule: Record<string, unknown> = { ...clip };
let shareNavigator: unknown;   // main.ts reads `navigator` for the share sheet; undefined (no share sheet) unless a test sets one
const shareModule: Record<string, unknown> = { ...shareStore }, matchModule: Record<string, unknown> = { ...match }, apiModule: { api: { url: string; key: string } | null } = { api: null };
import { session } from '../src/session.ts';
import * as lootClaims from '../src/loot-claims.ts';
import * as fightResults from '../src/fight-results.ts';
import * as career from '../src/career.ts';
import * as scorecard from '../src/scorecard.ts';
import * as hud from '../src/hud.ts';
import * as lessons from '../src/lessons.ts';
import * as breakBeat from '../src/break-beat.ts';
import * as powerWords from '../src/power-words.ts';
import * as touchRouter from '../src/touch-router.ts';
import * as layoutTierModule from '../src/layout-tier.ts';
import * as tutorialUi from '../src/tutorial-ui.ts';
import * as match from '../src/match.ts';
import * as input from '../src/input.ts';
import * as legends from '../src/legends.ts';
import * as postWalk from '../src/post-walk.ts';

// Execute the actual entry point with a controllable GPU/clock, keeping real combat and input wiring.
// Every `./x.ts` main.ts requires that no test registered in `modules` (boot below): a stub of `{}`, so an import that main.ts reads at
// boot is `undefined` there. The last test in this file pins the list; a new import fails it with the name to add (three PRs broke on this on 2026-10-06).
const unstubbed = new Set<string>();
const code = ts.transpileModule(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element extends EventTarget {
  hidden = false; open = false; value: string | number = ''; textContent = ''; disabled = false;
  style = { props: new Map<string, string>(), setProperty(k: string, v: string) { this.props.set(k, v); }, getPropertyValue(k: string) { return this.props.get(k) ?? ''; } } as { props: Map<string, string>; setProperty(k: string, v: string): void; getPropertyValue(k: string): string; transform?: string }; dataset: Record<string, string> = {}; attributes = new Map<string, string>(); children: Element[] = [];
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  className = ''; classList = { set: new Set<string>(), toggle(name: string, force?: boolean) { const on = force ?? !this.set.has(name); if (on) this.set.add(name); else this.set.delete(name); return on; }, contains(name: string) { return this.set.has(name); } };
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 108, height: 108 }; }
  click() { this.dispatchEvent(new Event('click')); }
  focus() {} close() { this.open = false; } showModal() { this.open = true; }
}
// The Pit stub: never opens unless a test swaps openPit (the F6 test below), as tests swap matchModule.Match.
const pitCoordinator = { openPit: (stage?: unknown): Promise<unknown> => { void stage; return new Promise(() => {}); }, loadPit: () => new Promise(() => {}), loadSkulls: () => new Promise(() => {}), prefetchPit() {}, atGateLine, doorHidden, GATE_LINE, DOOR_STILL, disposePit() {} };
const captureMatch = (receive: (live: match.Match) => void) => class extends match.Match {
  constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); receive(this); }
};
function boot(profileExtras: Record<string, unknown> = {}, initializationError?: Error, seed: Record<string, string> = {}, search = '', storageBlocked = false, hostname = 'localhost') {   // localhost: the release checks' local build; 'frankendom.com' for the live site
  const elements = new Map<string, Element>(), doc = new EventTarget(), win = Object.assign(new EventTarget(), { location: { search, hostname } });   // window.location.search is what main.ts reads for ?opponent / ?replay / ?debug; hostname for the local-build rule (#1093)
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  let pixelRatio = 1.25;   // the fake renderer's ratio: the phone tier's cap until lowerResolution drops it to 1, as scene.ts does
  let lost = false, loseDuringDraw = true, failDraw = false, failRebuild = false, now = 0, serial = 0, rebuilds = 0, renders = 0, reloads = 0; const replaced: string[] = [];
  const callbacks = new Map<number, (time: number) => void>(), timers = new Map<number, () => void>(), errors: unknown[] = [];
  let rendered: combat.Practice | undefined, renderedBody: { x: number; z: number; heading: number } | undefined, renderedFrozen = false;
  let report: (value: string, kind: 'loading' | 'ready' | 'failed') => void = () => {}, retries = 0, finishPhase = { settled: false, touring: false, age: 0, complete: false, completeAt: 0 };
  let tourStops = 0, sceneWeapon: Promise<string> | undefined, sceneRest: unknown[] = [], duelPage: { param: string; kit: unknown; page: { peerKit(kit: unknown): void; link(url: string): void } } | undefined, playerDrawn: (weapon: string) => void = () => {}, finisherOverride: string | null = null;
  let sceneArena: unknown;
  const view = { yaw: 0, recenter() {}, stopTour() { tourStops++; }, walkToGate() {}, raiseGate() {}, lowerResolution() { pixelRatio = 1; }, orbit() {}, previousFinisher: () => null, setPreviousFinisher() {}, bloodState: () => null, finishPhase: () => finishPhase, fallenRect: () => null as { x: number; y: number; w: number; h: number } | null, worn: [] as string[], wear(ids: string[]) { view.worn = ids; }, tier: '' as string, playerTier: '' as string, setTier(tier: string) { view.tier = tier; }, setPlayerTier(tier: string) { view.playerTier = tier; }, armed: undefined as string | undefined, opponentWeapon: () => view.armed, retryArt() { retries++; report('Loading warriors…', 'loading'); return Promise.resolve(); }, pitStage: () => ({}) /* the F6 test opens the Pit on a stub room; main.ts adds the gate */, renderer: { getContext: () => ({ isContextLost: () => lost }), getPixelRatio: () => pixelRatio, info: { render: { calls: 0, triangles: 0 } } }, arena: { guards: { built: 0, of: 0 } },
    restoreGraphics() { rebuilds++; if (failRebuild) throw Error('rebuild failed'); },
    render(state: { x: number; z: number; heading: number }, _locked: boolean, _dt: number, practice: combat.Practice, _events?: unknown, frozen = false) { rendered = practice; renderedBody = state; renderedFrozen = frozen; renders++; if (failDraw) { lost = loseDuringDraw; throw Error('shader lost during draw'); } } };
  const stored = new Map<string, string>([['frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'harness-fighter', name: 'Tester', ...profileExtras })], ['frankendom.firstloss.v1', '1'] /* the one-time first loss (lessons.ts) is behind every harness fighter; seed '' to meet it */, ['frankendom.lesson.pace.v1', '1'] /* the one-time pace line (first FatigueBand >= 2) is behind every harness fighter; seed '' to meet it */, ...Object.entries(seed).filter(([key]) => !key.startsWith('session:'))]);
  // A seed key 'session:<key>' opts the page into a tab sessionStorage holding it (the Dev kit, the ?tier= pin); without one, as before, it has none.
  const sessionSeed = Object.entries(seed).filter(([key]) => key.startsWith('session:')), sessionStored = new Map(sessionSeed.map(([key, value]) => [key.slice(8), value]));
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); }, snapshot: () => [...stored], sessionSnapshot: () => [...sessionStored], arena: () => sceneArena, finisher: () => finisherOverride };
  const specialCalls: string[] = [], specialWants: string[] = [], specialActors: Array<0 | 1 | undefined> = [], specialCutActors: Array<0 | 1 | undefined> = []; let specialCuts = 0;
  const feedbackModule = { ...feedback, createFeedback: (...args: Parameters<typeof feedback.createFeedback>) => {
    const real = feedback.createFeedback(...args);
    return { ...real, want: (cue: specialAudio.SpecialCue) => { specialWants.push(cue); real.want(cue); }, special: (cue: specialAudio.SpecialCue, gain?: number, actor?: 0 | 1) => { specialCalls.push(cue); specialActors.push(actor); return real.special(cue, gain, actor); }, cutSpecial: (actor?: 0 | 1) => { specialCuts++; specialCutActors.push(actor); real.cutSpecial(actor); } };
  } };
  const modules: Record<string, unknown> = { './net/lobby.ts': { openDuel: (param: string, kit: unknown, page: { peerKit(kit: unknown): void; link(url: string): void }) => { duelPage = { param, kit, page }; return Promise.resolve(); } }, './post-walk.ts': postWalk, './quality.ts': quality, './perf-beacon.ts': perfBeacon, './rank-look.ts': rankLook, './clip.ts': clipModule, './detmath.ts': detmath, './fight-results.ts': fightResults, './sparring.ts': sparring, './special-look.ts': specialLook, './audio/special.ts': specialAudio, './special-identity.ts': specialIdentity, './class-special-identity.ts': classSpecialIdentity, './record-header.ts': { peekRecordHeader }, './arena-themes.ts': arenaThemes, './feedback.ts': feedbackModule, './hit-impact.ts': hitImpact, './pvp-hold.ts': pvpHold, './sim.ts': sim, './combat.ts': combat, './profile.ts': profile, './ladder.ts': ladder, './roster.ts': roster, './trial.ts': trial, './record.ts': record, './loot.ts': loot, './grades.ts': grades, './loot-panel.ts': lootPanel, './replay.ts': replay, './share-store.ts': shareModule, './session.ts': { session }, './loot-claims.ts': lootClaims, './ai.ts': ai, './autopsy.ts': autopsyModule, './api.ts': apiModule, './career.ts': career, './scorecard.ts': scorecard, './hud.ts': hud, './match.ts': matchModule, './input.ts': input, './legends.ts': legends, './moves.ts': moves, './look-flag.ts': { pitLookFrom: () => undefined, pitStoneFrom: () => 'stone-full', pitGlowFrom: () => false, pitOpenLook: () => ({}), skullsDemoFrom: () => false }, './pit-coordinator.ts': pitCoordinator, './gear-room.ts': { enterGearRoom: () => ({ frame() {}, fit() {}, leave() {} }) }, './scene.ts': { CARRIED_WEAPONS: moves.PLAYER_WEAPONS, createScene: (_: unknown, status: (value: string, kind: 'loading' | 'ready' | 'failed') => void, _opponent: unknown, _arena: unknown, weapon: Promise<string>, drawn: (weapon: string) => void, ...rest: unknown[]) => { if (initializationError) throw initializationError; report = status; sceneWeapon = weapon; playerDrawn = drawn; sceneRest = rest; status('', 'ready'); return view; } }, '@sentry/browser': { captureException: (error: unknown) => errors.push(error) } };
  modules['./lessons.ts'] = lessons;   // the first-loss prompts and trigger (main.ts imports firstLossDue)
  modules['./armfeel.ts'] = armfeelModule;   // ?look=armfeel's pure core (main.ts reads the flag and the blade hold)
  modules['./break-beat.ts'] = breakBeat;   // ?look=breakbeat's pure core (main.ts reads the flag for the PostureBroken hold)
  modules['./power-words.ts'] = powerWords;   // the Witch's and the Plague Doctor's wind-up word (main.ts imports powerWordFor)
  modules['./tutorial-ui.ts'] = tutorialUi;
  modules['./touch-router.ts'] = touchRouter; modules['./layout-tier.ts'] = layoutTierModule;   // pure cores main.ts imports
  modules['./sparring-specials.ts'] = sparringSpecials;
  modules['./sparring-special-runtime.ts'] = sparringSpecialRuntime;   // real selection/validation contract, as main uses in the browser
  Object.assign(view, { setFinisherOverride: (id: string | null) => { finisherOverride = id; } });
  const sceneModule = modules['./scene.ts'] as { createScene: (...args: unknown[]) => unknown };
  const makeScene = sceneModule.createScene;
  sceneModule.createScene = (...args: unknown[]) => { sceneArena = args[3]; return makeScene(...args); };
  const sent: { url: string; init: RequestInit }[] = [];   // every fetch main.ts makes itself (the perf beacon); answers ok
  const context = { require: (id: string) => { if (!(id in modules)) unstubbed.add(id); return modules[id] || {}; }, exports: {}, window: win, Event, CustomEvent, fetch: (url: string, init: RequestInit) => { sent.push({ url, init }); return Promise.resolve({ ok: true }); },
    document: Object.assign(doc, { hidden: false, getElementById: element, createElement: () => new Element(), createTextNode: (text: string) => Object.assign(new Element(), { textContent: text }), documentElement: element('html'), body: element('body') }),
    innerWidth: 375, matchMedia: () => ({ matches: false }), HTMLInputElement: class {}, get localStorage() { if (storageBlocked) throw Error('SecurityError: The operation is insecure.'); return storage; }, ...(sessionSeed.length ? { sessionStorage: { getItem: (key: string) => sessionStored.get(key) ?? null, setItem: (key: string, value: string) => { sessionStored.set(key, value); }, removeItem: (key: string) => { sessionStored.delete(key); } } } : {}), crypto: { randomUUID: () => 'test' }, performance: { now: () => now }, File, get navigator() { return shareNavigator; }, location: { reload: () => reloads++, href: 'https://frankendom.com/?opponent=veteran&debug', search, hostname, origin: 'https://frankendom.com', replace: (href: string) => { replaced.push(href); }, assign: (href: string) => { replaced.push(href); } }, URL,
    requestAnimationFrame: (cb: (time: number) => void) => { const id = ++serial; callbacks.set(id, cb); return id; }, cancelAnimationFrame: (id: number) => callbacks.delete(id),
    setTimeout: (cb: () => void) => { const id = ++serial; timers.set(id, cb); return id; }, clearTimeout: (id: number) => timers.delete(id),
  };
  Object.assign(context, { URLSearchParams });   // actual browser query decoding, including malformed suffixes/encoded values
  runInNewContext(code, context);   // main.ts's globalThis is this object: the ?debug __pit handle lands on it
  element('welcome').hidden = true;
  return { specialCalls, specialWants, specialActors, specialCutActors, get specialCuts() { return specialCuts; }, get sceneRest() { return sceneRest; }, get duelPage() { return duelPage; }, set armed(weapon: string | undefined) { view.armed = weapon; }, get pit() { return (context as unknown as { __pit?: { open(entry: 'win' | 'defeat'): Promise<void>; close(): void } }).__pit; }, get tier() { return view.tier; }, get tiers() { return { opponent: view.tier, player: view.playerTier }; }, element, errors, callbacks, timers, sent, storage, window: win, document: doc, get sceneWeapon() { return sceneWeapon; }, drawn: (weapon: string) => playerDrawn(weapon), get worn() { return [...view.worn]; }, setFinishPhase(next: { settled: boolean; touring: boolean; age: number; complete?: boolean; completeAt?: number }) { finishPhase = { complete: false, completeAt: 0, ...next }; }, get tourStops() { return tourStops; }, report: (value: string, kind: 'loading' | 'ready' | 'failed') => report(value, kind), get retries() { return retries; }, get rendered() { return rendered!; }, get renderedBody() { return renderedBody!; }, get renderedFrozen() { return renderedFrozen; }, get renders() { return renders; }, get rebuilds() { return rebuilds; }, get reloads() { return reloads; }, replaced,
    tick(ms = 17) { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); for (const cb of pending) cb(now); },
    key(code: string) { win.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false })); },
    release(code: string) { win.dispatchEvent(Object.assign(new Event('keyup', { cancelable: true }), { code })); },
    lose() { lost = true; const event = new Event('webglcontextlost', { cancelable: true }); element('world').dispatchEvent(event); assert.ok(event.defaultPrevented); },
    restore() { lost = false; failDraw = false; element('world').dispatchEvent(new Event('webglcontextrestored')); },
    failDraw(lose = true) { failDraw = true; loseDuringDraw = lose; }, failRebuild() { failRebuild = true; },
  };
}
test('Sparring SPECIAL MOVE actual main resets by class/difficulty, retains manual band and starts only on Start', () => {
  const app = boot({}, undefined, {}, '?debug&opponent=nightborn');
  const select = app.element('spar-special'), difficulty = app.element('difficulty-select'), opponent = app.element('opponent-select');
  assert.equal(select.value, 'lunge', 'approved class A is the matching default');
  assert.equal(select.children.length, 6, 'all five class bands shown');
  difficulty.value = '46'; difficulty.dispatchEvent(new Event('change'));
  assert.equal(select.value, 'nyx', 'Nightborn10 auto selects Nyx');
  app.element('spar-skill').value = 'miasma'; app.element('spar-weapon').value = 'estoc';
  select.value = 'cuts'; select.dispatchEvent(new Event('change'));
  assert.equal(difficulty.value, '46', 'manual B preview keeps visible opponent difficulty');
  assert.match(app.element('spar-special-status').textContent, /Seven Cuts · L4–7 special; opponent difficulty/);
  assert.deepEqual(app.replaced, [], 'all field changes wait for Start');
  app.element('spar-start').click();
  assert.deepEqual(Object.fromEntries(new URL(app.replaced[0], 'https://frankendom.com').searchParams), { opponent: 'nightborn', spar: '1', weapon: 'estoc', difficulty: '46', skill: 'miasma', special: 'cuts', yourSpecial: 'none', arena: 'ladder' });
  opponent.value = 'witch'; opponent.dispatchEvent(new Event('change'));
  assert.equal(select.value, 'price', 'class change removes stale Nightborn selection');
  difficulty.value = '10'; difficulty.dispatchEvent(new Event('change'));
  assert.equal(select.value, 'wake', 'difficulty change resets a class-valid matching band');
  difficulty.value = 'dummy'; difficulty.dispatchEvent(new Event('change'));
  assert.equal(select.disabled, true); assert.match(app.element('spar-special-status').textContent, /Dummy does not cast/);
  app.element('spar-start').click(); assert.equal(new URL(app.replaced[1], 'https://frankendom.com').searchParams.get('special'), 'none');
});
test('Sparring Stage/Finisher picks are inert until Start; explicit Ladder beats stale session and only valid combined finishers apply', () => {
  const seed = { 'session:frankendom.arena-override': 'a' };
  const app = boot({}, undefined, seed, '?debug&opponent=nightborn');
  const stage = app.element('arena-select'), finisher = app.element('finisher-select'), before = app.storage.snapshot(), sessionBefore = app.storage.sessionSnapshot();
  stage.value = 'c'; stage.dispatchEvent(new Event('change')); finisher.value = 'opened'; finisher.dispatchEvent(new Event('change'));
  assert.deepEqual(app.replaced, []); assert.equal(app.reloads, 0); assert.deepEqual(app.storage.snapshot(), before);
  assert.deepEqual(app.storage.sessionSnapshot(), sessionBefore, 'no session arena write before Start');
  assert.equal(app.storage.finisher(), null, 'pick does not change current fight');
  app.element('spar-start').click();
  const started = new URL(app.replaced[0], 'https://frankendom.com');
  assert.deepEqual(app.storage.sessionSnapshot(), sessionBefore, 'Start uses URL override without writing configuration');
  assert.equal(started.searchParams.get('arena'), 'c'); assert.equal(started.searchParams.get('finisher'), 'opened');
  const booted = boot({}, undefined, seed, started.search);
  assert.equal(booted.storage.arena(), 'c'); assert.equal(booted.storage.finisher(), 'opened');
  stage.value = ''; stage.dispatchEvent(new Event('change')); app.element('spar-start').click();
  const ladder = new URL(app.replaced[1], 'https://frankendom.com'); assert.equal(ladder.searchParams.get('arena'), 'ladder');
  const cleared = boot({}, undefined, seed, ladder.search);
  assert.equal(cleared.storage.arena(), 'ladder'); assert.equal(cleared.element('arena-select').value, '');
  assert.equal(boot({}, undefined, seed, '?debug&arena=d&finisher=opened').storage.arena(), 'd', 'standalone arena URL still beats session');
  assert.equal(boot({}, undefined, seed, '?debug&finisher=opened').storage.finisher(), null, 'standalone finisher param does not introduce a new mechanism');
  for (const invalid of ['fake', 'opened-junk', 'opened!', 'opened%2Djunk', 'opened%21']) {
    const bogus = boot({}, undefined, seed, started.search.replace('opened', invalid));
    assert.equal(bogus.storage.finisher(), null, invalid); assert.equal(bogus.element('finisher-select').value, 'auto', invalid);
  }
  assert.equal(boot({}, undefined, seed, started.search.replace('opened', '%6fpened')).storage.finisher(), 'opened', 'exact decoded valid value remains supported');
  for (const invalid of ['a!', 'a%21', 'c-junk', 'fake']) {
    const bogus = boot({}, undefined, seed, started.search.replace('arena=c', `arena=${invalid}`));
    assert.equal(bogus.storage.arena(), 'ladder', `${invalid}: malformed combined Stage cannot become a valid prefix or stale session`);
  }
  assert.equal(boot({}, undefined, seed, started.search.replace('arena=c', 'arena=%63')).storage.arena(), 'c');
});
test('combined Sparring preview actual main preserves kit/difficulty and accepted opponent cast cue', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    const app = boot({}, undefined, {}, '?debug&spar=1&opponent=nightborn&weapon=estoc&difficulty=6&skill=miasma&special=nyx');
    assert.deepEqual([live.mode, live.level, live.weapon, live.skill, live.recorder], ['sparring', 6, 'estoc', 'miasma', null]);
    assert.equal(app.element('spar-special').value, 'nyx', 'manual cross-band selection survives boot');
    assert.match(app.element('spar-special-status').textContent, /L10 special; opponent difficulty/);
    assert.equal(live.practice.duel.fighters[1].specialName, 'nyxnightfall');
    assert.equal(live.practice.duel.fighters[1].specialShare, moves.RULES.special.bossDamage);
    app.tick(); app.key('KeyF');
    for (let i = 0; i < 1800 && !live.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 1) && !live.practice.finish; i++) app.tick();
    assert.ok(live.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 1 && e.name === 'nyxnightfall'));
    assert.ok(app.specialCalls.includes('nyx'), 'accepted selected opponent cast plays its own cue');
    assert.deepEqual(app.errors, []);
  } finally { matchModule.Match = Original; }
});
test('invalid combined preview is visibly refused and cannot tick, rematch career or open PvP', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    const app = boot({}, undefined, {}, '?debug&spar=1&opponent=witch&weapon=estoc&difficulty=46&skill=miasma&special=nyx&duel=new');
    assert.match(app.element('replay-banner').textContent, /special move test link is invalid/);
    const tick = live.practice.duel.tick, epoch = live.epoch, before = app.storage.snapshot();
    app.key('KeyF'); for (let i = 0; i < 30; i++) app.tick(); app.element('reset-button').click();
    assert.equal(live.practice.duel.tick, tick); assert.equal(live.epoch, epoch);
    assert.deepEqual(app.storage.snapshot(), before); assert.equal(app.duelPage, undefined);
    assert.deepEqual(app.specialCalls, []); assert.deepEqual(app.specialWants, []);
  } finally { matchModule.Match = Original; }
});
test('explicit unavailable none actual main disables Sparring specials at a live B difficulty', () => {
  const app = boot({}, undefined, {}, '?debug&spar=1&opponent=executioner&weapon=estoc&difficulty=20&skill=miasma&special=none');
  app.tick();
  assert.deepEqual(app.rendered.duel.fighters.map(f => f.specialShare), [undefined, undefined]);
  assert.equal(app.element('spar-special').value, 'none');
  assert.deepEqual(app.specialCalls, []);
});
test('graphics restoration resumes one loop, clears inputs and preserves the current fight', () => {
  const app = boot(); app.tick(); app.key('KeyF'); app.tick();
  const before = app.element('target-health').value;
  app.lose(); assert.equal(app.callbacks.size, 0); assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'true');
  app.key('KeyF'); app.key('KeyE'); app.key('KeyQ'); app.tick(60000);
  assert.equal(app.element('target-health').value, before);
  app.restore(); assert.equal(app.callbacks.size, 1); assert.equal(app.rebuilds, 1); assert.equal(app.timers.size, 0); assert.equal(app.element('message').hidden, true);
  app.tick(); assert.match(app.element('combat-status').textContent, /Drawing/); // No minute of simulation catch-up.
  for (let i = 0; i < 37; i++) app.tick();
  assert.match(app.element('combat-status').textContent, /Drawing/);
  for (let i = 0; i < 8; i++) app.tick();
  assert.equal(app.element('stamina').value, 100); assert.equal(app.element('guard-button').attributes.get('aria-pressed'), 'false');
  assert.equal(app.element('target-health').value, before);
  app.restore(); assert.equal(app.callbacks.size, 1); assert.equal(app.rebuilds, 1);
});
test('a shader error during context loss pauses and then recovers rather than killing the loop', () => {
  const app = boot(); app.failDraw(); assert.doesNotThrow(() => app.tick());
  assert.equal(app.callbacks.size, 0); assert.equal(app.timers.size, 1);
  app.restore(); app.tick(); assert.equal(app.callbacks.size, 1); assert.equal(app.errors.length, 0);
});
test('unrestored or failed graphics have a manual reload path, with real failures reported', () => {
  const app = boot(); app.lose();
  for (const callback of app.timers.values()) callback();
  const button = app.element('message').children.at(-1)!; assert.equal(button.textContent, 'Reload game'); button.dispatchEvent(new Event('click')); assert.equal(app.reloads, 1);
  app.failRebuild(); app.restore(); assert.equal(app.callbacks.size, 0); assert.equal(app.errors.length, 1); assert.equal(app.element('message').hidden, false);
});
test('repeated and reordered GPU events never multiply the animation loop or recovery timer', () => {
  const app = boot();
  for (let i = 0; i < 100; i++) {
    app.lose(); app.lose(); assert.equal(app.timers.size, 1); assert.equal(app.callbacks.size, 0);
    app.restore(); app.restore(); app.tick(); assert.equal(app.callbacks.size, 1); assert.equal(app.timers.size, 0);
  }
  assert.equal(app.rebuilds, 100);
});

test('ordinary render failures are not swallowed as recoverable GPU loss', () => {
  const app = boot(); app.failDraw(false);
  assert.throws(() => app.tick(), /shader lost during draw/);
  assert.equal(app.timers.size, 0);
});

test('a late draw press buffers one attack, and focus loss cancels it', () => {
  for (const interrupt of [false, true]) {
    const app = boot(); app.tick(); app.key('KeyF'); app.tick();
    for (let i = 0; i < 35; i++) app.tick();
    app.key('KeyF');
    if (interrupt) { app.lose(); app.restore(); }
    for (let i = 0; i < 14; i++) app.tick();
    assert.equal(app.element('stamina').value, interrupt ? 100 : 100 - MOVES.light_right.stamina);
  }
});

test('mobile outer-stick sprint stops on cancellation and menu opening pauses combat', () => {
  for (const end of ['pointercancel','menu']) {
    const app=boot();app.tick();
    // Sprint is a deliberate push well past the knob's rim (the stub pad is 108 px: centre 54, rim at 42 px): 120 is 1.57 rims out, 100 only 1.1.
    app.element('joystick').dispatchEvent(Object.assign(new Event('pointerdown'),{pointerId:1,clientX:108,clientY:54}));   // 1.29 rims: past the old 1.15 threshold, short of the deliberate 1.4
    for(let i=0;i<10;i++)app.tick(); assert.equal(app.element('stamina').value,100,'a little past the rim is a walk, not a sprint'); assert.equal(app.element('stick').dataset.run,'false');
    app.element('joystick').dispatchEvent(Object.assign(new Event('pointermove'),{pointerId:1,clientX:120,clientY:54}));
    for(let i=0;i<10;i++)app.tick();
    const spent=app.element('stamina').value as number;assert.ok(spent<100&&spent>95); assert.equal(app.element('stick').dataset.run,'true','the knob shows the sprint');
    if(end==='menu')app.element('journal-button').click();
    else app.element('joystick').dispatchEvent(Object.assign(new Event('pointercancel'),{pointerId:1}));
    // The sprint stopped: no further drain (regeneration resumes at once now that a sprint sets no delay, so the bar may climb).
    for(let i=0;i<10;i++)app.tick();assert.ok((app.element('stamina').value as number)>=spent,'no drain after the sprint ended'); assert.equal(app.element('stick').dataset.run,'false');
    if(end==='menu') { const paused=app.element('stamina').value; app.element('close-journal').click();for(let i=0;i<10;i++)app.tick();assert.ok((app.element('stamina').value as number)>=(paused as number)); }
  }
});
test('menu sound and camera controls stay synchronized with desktop controls', () => {
  const app=boot();app.element('mobile-sound').click();
  assert.equal(app.element('sound-button').textContent,'Sound off');
  app.element('sound-button').click();assert.equal(app.element('mobile-sound').textContent,'Sound on');
  app.element('mobile-camera').click();assert.equal(app.element('camera-button').attributes.get('aria-pressed'),'false');
  app.element('camera-button').click();assert.equal(app.element('mobile-camera').attributes.get('aria-pressed'),'true');
});

test('the thumb cluster is the one mobile layout: round buttons incl. a Stab button that thrusts and holds', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, id = 5) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: 0, clientY: 0 }));
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  const thrust = app.element('thrust-button'); assert.equal(thrust.hidden, false); assert.equal(app.element('attack-button').dataset.mobile, 'Slash'); assert.equal(app.element('kick-button').hidden, false);
  settle(); press(thrust, 'pointerdown'); app.tick(); assert.equal(me().move, 'thrust'); assert.equal(thrust.dataset.held, '', 'data-held lights the ring while Stab is down');
  const kick = app.element('kick-button'); press(kick, 'pointerdown', 6); assert.equal(kick.dataset.held, ''); press(kick, 'pointerup', 6); assert.equal(kick.dataset.held, undefined, 'Kick: held for the press only');
  for (let i = 0; i < 12; i++) app.tick(); assert.equal(me().age, MOVES.thrust.chamber!, 'held Stab loads the thrust'); press(thrust, 'pointerup'); assert.equal(thrust.dataset.held, undefined, 'lifted: the ring goes back to rest'); for (let i = 0; i < 4; i++) app.tick(); assert.ok(me().age > MOVES.thrust.chamber!, 'released, it goes');
});

test('the scorecard tallies fights, wins, rematches and damage', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until the warden wins
  assert.ok(app.rendered.finish, 'the fight ends'); const card = () => JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card;
  assert.equal(card().fights, 1); assert.equal(card().wins, 0); assert.equal(card().taken, moves.RULES.health); assert.ok(card().ticks > 600);
  app.element('reset-button').click(); app.tick(); assert.equal(card().rematches, 1); assert.equal(card().fights, 1, 'a rematch is not a fight until it ends');
  app.element('journal-button').click(); assert.match(app.element('scorecard').textContent, /^1 fights · 0 won · 1 rematches/);
});

test('guard side: a slide on the Guard button or Q + an arrow sets the guard direction the simulation sees; lifting resets it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0], guardButton = app.element('guard-button');
  const at = (type: string, x: number, y: number, id = 7) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  settle(); guardButton.dispatchEvent(at('pointerdown', 100, 100)); guardButton.dispatchEvent(at('pointermove', 60, 104)); app.tick();
  assert.equal(guardButton.dataset.side, 'left'); assert.equal(me().phase, 'guard'); assert.equal(me().guardDirection, 'left', 'the press carries the side the thumb slid to');
  guardButton.dispatchEvent(at('pointerup', 60, 104)); assert.equal(guardButton.dataset.side, 'straight', 'lifting resets the side');
  for (let i = 0; i < 40; i++) app.tick();
  settle(); guardButton.dispatchEvent(at('pointerdown', 100, 100)); guardButton.dispatchEvent(at('pointermove', 104, 100)); app.tick();
  assert.equal(me().guardDirection, null, 'a small wobble is still the straight guard'); guardButton.dispatchEvent(at('pointerup', 104, 100));
  for (let i = 0; i < 40; i++) app.tick();
  settle(); const x = me().body.x, z = me().body.z; app.key('KeyQ'); app.key('ArrowUp'); app.tick();
  assert.equal(me().guardDirection, 'overhead', 'Q + an arrow is that side'); assert.deepEqual([me().body.x, me().body.z], [x, z], 'the arrow picks the side, it does not walk');
  assert.equal(guardButton.dataset.side, 'overhead', 'the button\'s side hint follows the keyboard guard too');
  app.release('ArrowUp'); app.release('KeyQ'); for (let i = 0; i < 40; i++) app.tick();
  assert.equal(guardButton.dataset.side, 'straight', 'released: the hint shows straight again');
  app.key('ArrowUp'); for (let i = 0; i < 5; i++) app.tick(); assert.notEqual(me().body.z, z, 'without Q the arrow walks as before'); app.release('ArrowUp');
});

test('frame clock: a backward or absurd timestamp jump is a resync, never negative fight time — the simulation keeps stepping right after it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 30; i++) app.tick();
  const tick = () => app.rendered.duel.tick, before = tick();
  app.tick(-90000);   // the frame clock jumps 90 s backward (a fake clock installed under the page, a frozen timeline)
  for (let i = 0; i < 6; i++) app.tick();
  assert.ok(tick() > before, `six normal frames after a backward jump advance the fight: ${before} → ${tick()}`);
  const mid = tick(); app.tick(600000);   // ten minutes forward: a stall, not absence — at most one tenth of a second of fight
  assert.ok(tick() - mid <= 7, `a forward stall injects at most 0.1 s of fight: +${tick() - mid} ticks`);
  const after = tick(); for (let i = 0; i < 12; i++) app.tick(); assert.ok(tick() - after >= 8, `and the fight goes on normally after it: +${tick() - after} ticks in 12 frames`);
});

test('dodge control: a tap is an instant backstep, a hold grows it into a roll, and interruption releases it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  assert.equal(app.element('stamina').value, 100);
  app.key('KeyE'); app.tick(); app.release('KeyE');
  assert.equal(app.element('stamina').value, 90, 'the press itself is a backstep');
  for (let i = 0; i < 60; i++) app.tick();
  assert.ok(Number(app.element('stamina').value) >= 90, 'a released tap never becomes a roll');
  for (let i = 0; i < 120; i++) app.tick();
  app.key('KeyE'); for (let i = 0; i < 12; i++) app.tick();
  assert.ok(Number(app.element('stamina').value) <= 70.5, `holding past 150 ms rolled: ${app.element('stamina').value}`);
  app.release('KeyE'); for (let i = 0; i < 200; i++) app.tick();
  app.key('KeyE'); app.lose(); app.restore();
  let rolled = false; for (let i = 0; i < 20; i++) { app.tick(); rolled ||= app.rendered.duel.fighters[0].phase === 'roll'; }   // the fighter's phase, not the bar: the warden may have wounded the ceiling by now
  assert.ok(!rolled, 'a graphics interruption releases the held control before it can roll');
});

test('heavy control: a held key charges the swing and release lets it fly', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  app.key('KeyG'); for (let i = 0; i < 30; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  assert.equal(me().move, 'heavy_overhead'); assert.ok(me().charge > 0, `holding G charges: charge=${me().charge}`); assert.equal(me().age, 10, 'the wind-up holds at the charge point');
  app.release('KeyG'); for (let i = 0; i < 6; i++) app.tick();
  assert.ok(me().age > 10, 'released: the swing continues');
  // A quick press is a plain heavy: released before the charge point, it never holds.
  for (let i = 0; i < 80; i++) app.tick();
  app.key('KeyG'); for (let i = 0; i < 4; i++) app.tick(); app.release('KeyG'); for (let i = 0; i < 12; i++) app.tick();
  assert.equal(me().move, 'heavy_overhead'); assert.equal(me().charge, 0, 'a tap never charges'); assert.ok(me().age > 10);
});

test('kick input spends once and clears on pointer cancellation or graphics interruption',()=>{
 for(const cancel of ['none','pointercancel','graphics']){
  const app=boot();app.tick();app.key('KeyF');for(let i=0;i<45;i++)app.tick();
  app.element('kick-button').dispatchEvent(Object.assign(new Event('pointerdown',{cancelable:true}),{button:0,pointerId:1}));
  if(cancel==='pointercancel')app.element('kick-button').dispatchEvent(new Event('pointercancel'));
  if(cancel==='graphics'){app.lose();app.restore();}
  app.tick();assert.equal(app.element('stamina').value,cancel==='none'?75:100);
  app.tick();assert.equal(app.element('stamina').value,cancel==='none'?75:100);
 }
});

test('the first match meets the fixed warden and every rematch a differently seeded one', () => {
  const app = boot(); app.tick(); app.key('KeyF'); app.tick();
  assert.equal(app.rendered.ai.seed, 731, 'the browser gate relies on the first warden');
  app.element('reset-button').click(); app.tick(); const second = app.rendered.ai.seed;
  app.element('reset-button').click(); app.tick(); const third = app.rendered.ai.seed;
  assert.ok(second !== 731 && third !== second, `seeds 731 → ${second} → ${third}`);
});

test('a tap that ends before the next tick still lands: only pointercancel withdraws a queued press (lostpointercapture follows every pointerup)', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, x = 0, y = 0, id = 8) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y }));
  const tap = (el: Element, x = 0, y = 0) => { press(el, 'pointerdown', x, y); press(el, 'pointerup', x, y); press(el, 'lostpointercapture', x, y); };
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  settle(); tap(app.element('heavy-button')); app.tick(); assert.equal(me().move, 'heavy_overhead', 'a same-frame heavy tap lands'); for (let i = 0; i < 70; i++) app.tick();
  settle(); tap(app.element('dodge-button')); app.tick(); assert.equal(me().phase, 'backstep', 'a same-frame step tap lands'); for (let i = 0; i < 20; i++) app.tick();
  settle(); tap(app.element('guard-button')); app.tick(); assert.equal(me().phase, 'guard', 'a same-frame guard tap opens the parry window'); assert.equal(me().parrying, true); for (let i = 0; i < 40; i++) app.tick();
  settle(); tap(app.element('thrust-button')); app.tick(); assert.equal(me().move, 'thrust', 'a same-frame Stab tap lands'); for (let i = 0; i < 50; i++) app.tick();
});

test('the stick never stays pushed: a release delivered outside the pad, a touchend with no fingers, or a new touch all clear it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const joystick = app.element('joystick'), stick = app.element('stick'), win = app.window;
  const at = (type: string, x: number, y: number, id = 2) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const pushed = () => stick.style.transform !== '';
  // Lost capture: the finger leaves the pad and the browser delivers pointerup to whatever is under it (here, the window).
  joystick.dispatchEvent(at('pointerdown', 20, 54)); assert.equal(pushed(), true);
  win.dispatchEvent(at('pointerup', 300, 300)); assert.equal(pushed(), false, 'a pointerup anywhere releases the stick');
  // iOS: pointerup never arrives but touchend says no fingers remain.
  joystick.dispatchEvent(at('pointerdown', 20, 54, 3)); assert.equal(pushed(), true);
  win.dispatchEvent(Object.assign(new Event('touchend'), { touches: [] })); assert.equal(pushed(), false, 'touchend with no touches releases the stick');
  // A stuck id must not lock the pad: a new touch takes it over and its own release clears it.
  joystick.dispatchEvent(at('pointerdown', 20, 54, 4)); joystick.dispatchEvent(at('pointerdown', 88, 54, 5)); assert.equal(pushed(), true);
  joystick.dispatchEvent(at('pointerup', 88, 54, 5)); assert.equal(pushed(), false, 'the newest touch owns the stick');
});

test('the HUD shows both posture bars and flags a bar near breaking', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const mine = app.element('posture'), theirs = app.element('target-posture');
  assert.equal(Number(mine.value), 0); assert.equal(Number(theirs.value), 0); assert.equal(mine.dataset.critical, 'false');
  // Land lights until the warden's bar has moved (the harness warden blocks or takes them; either fills it).
  for (let i = 0; i < 2400 && Number(theirs.value) === 0; i++) { if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let k = 0; k < 45; k++) app.tick(); } if (app.rendered.duel.fighters[0].phase === 'ready') app.key('KeyF'); app.tick(); }
  assert.ok(Number(theirs.value) > 0, `warden posture ${theirs.value}`);
  assert.equal(theirs.style.getPropertyValue('--fill'), `${Number(theirs.value)}%`);
  assert.equal(theirs.dataset.critical, String(Number(theirs.value) >= 70));
  // Keep cutting (blocked cuts fill the warden's bar, parried ones fill ours) until either bar is near breaking: the HUD must flag that bar.
  let flagged: Element | null = null;
  for (let i = 0; i < 6000 && !flagged; i++) {
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let k = 0; k < 45; k++) app.tick(); }
    if (app.rendered.duel.fighters[0].phase === 'ready') app.key('KeyF'); app.tick();
    if (Number(mine.value) >= 70) flagged = mine; else if (Number(theirs.value) >= 70) flagged = theirs;
  }
  assert.ok(flagged, `a bar reached 70 %: own ${mine.value}, warden ${theirs.value}`); assert.equal(flagged!.dataset.critical, 'true', 'a bar at 70 % or more is flagged');
  assert.equal(mine.dataset.critical, String(Number(mine.value) >= 70)); assert.equal(theirs.dataset.critical, String(Number(theirs.value) >= 70));
});

test('hit-stop: every contact freezes the simulation for exactly ceil(ms / 17) frames (+ the frame that resumes) while frames keep rendering; heavier contacts stop longer; ticks are never skipped', () => {
  const app = boot({ id: 'tester-0001', career: { victoryMarks: 17 } }, undefined, {}, '?opponent=dwarf'); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();   // the full circle (a dwarf, not Arena 1: its circle is smaller now, play-radius.ts); level 18 (today's normal): a level-1 novice seldom swings the heavies this needs
  const tickOf = () => app.rendered.duel.tick, me = () => app.rendered.duel.fighters[0];
  const EXPECT: Record<string, number> = { Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 120, 'heavy Hit': 90, 'heavy Blocked': 50 };
  const heavyMove = (e: { move?: string; charged?: boolean }) => e.charged || ['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'].includes(e.move ?? '');
  const kind = (e: { type: string; move?: string; charged?: boolean }) => e.type === 'Hit' && heavyMove(e) ? 'heavy Hit' : e.type === 'Blocked' && heavyMove(e) ? 'heavy Blocked' : e.type;
  // Both fighters' contacts count. The player spams cuts; the warden answers with blocks, parries and its own heavies.
  const measured: Record<string, number[]> = {}, expected: Record<string, number[]> = {};
  let needTick = true;
  for (let frame = 0; frame < 6000 && !((measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2 && (measured['heavy Blocked']?.length ?? 0) >= 1); frame++) {
    const hitsDone = (measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2;   // then hold guard so a warden heavy is blocked
    if (needTick) { if (hitsDone) { app.key('KeyQ'); app.key('ArrowUp'); } else if (me().phase === 'ready' && !app.rendered.finish) app.key('KeyF'); app.tick(); }   // Q + up: the overhead guard that meets a heavy (directional guard)
    needTick = true;
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick(); continue; }
    const contacts = app.rendered.events.filter(e => e.type in EXPECT); if (!contacts.length) continue;
    const longest = contacts.map(kind).sort((a, b) => EXPECT[b] - EXPECT[a])[0];
    // hit-impact.ts adds its tier on top of the base stop (Dom 2026-09-29): a landed blow +3 or +5 frames, a block +2, a parry +11. Read from
    // the contact frame's events, before the frozen frames replace them.
    const ms = EXPECT[longest] + hitImpact.impactStopMs(app.rendered.events);
    const at = tickOf(), renders = app.renders; let frozen = 0;
    while (tickOf() === at && frozen < 40) { app.tick(); frozen++; }
    assert.ok(app.renders > renders, 'frames were rendered during the stop');
    (measured[longest] ??= []).push(frozen); (expected[longest] ??= []).push(Math.ceil(ms / 17) + 1);
    needTick = false;   // the frame that resumed may itself carry the next contact: examine it before ticking again
  }
  // The loop counts the frame on which the tick finally moves too, hence + 1.
  for (const [type, frames] of Object.entries(measured)) frames.forEach((f, i) => assert.equal(f, expected[type][i], `${type}: ${f} frames on the contact tick for a ${EXPECT[type]} ms stop + its hit-impact tier`));
  assert.ok((measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2 && (measured['heavy Blocked']?.length ?? 0) >= 1, `measured ${JSON.stringify(measured)}`);
  // Long frames (a phone dropping to 20 fps steps three ticks per frame) must still end on the contact tick, or the frozen pose is never shown.
  // Holding guard is a level, so the same fight unfolds tick for tick whatever the frame length; every contact tick must be rendered in both.
  const contactsRendered = (frameMs: number) => {
    const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); a.key('KeyQ');
    const ticks = new Set<number>(); let guard = 0, biggestJump = 0, prev = a.rendered.duel.tick;
    while (a.rendered.duel.tick < 1500 && guard++ < 6000) { a.tick(frameMs); const t = a.rendered.duel.tick; biggestJump = Math.max(biggestJump, t - prev); prev = t; if (a.rendered.events.some(e => e.type in EXPECT)) ticks.add(t); }
    return { ticks, biggestJump };
  };
  const smooth = contactsRendered(17), dropped = contactsRendered(51);
  assert.ok(smooth.ticks.size >= 3, `contacts in 1500 ticks: ${smooth.ticks.size}`); assert.deepEqual([...dropped.ticks], [...smooth.ticks], 'every contact tick is the last tick of its frame, even at three ticks per frame');
  // A 17 ms frame legitimately steps 2 ticks now and then (17 > 16.67) and a 51 ms frame 4; a stop that left time in the accumulator would add a whole tick or two on top.
  assert.ok(smooth.biggestJump <= 2 && dropped.biggestJump <= 4, `no catch-up jump after a stop: ${smooth.biggestJump} / ${dropped.biggestJump} ticks in one frame`);
  // Determinism: the freeze delays wall-clock only; quiet frames map one to one onto ticks.
  for (let i = 0; i < 200 && (app.rendered.threat || me().phase !== 'ready'); i++) app.tick();
  const before = tickOf(); let quiet = 0; for (let i = 0; i < 30; i++) { app.tick(17); if (!app.rendered.events.some(e => e.type in EXPECT)) quiet++; }
  assert.ok(tickOf() - before >= quiet - 1, `${quiet} quiet frames advanced ${tickOf() - before} ticks`);
});

test('the Kick button says when the warden is inside its cone', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const kick = app.element('kick-button'), gap = () => Math.hypot(app.rendered.fighter.x - app.rendered.enemy.x, app.rendered.fighter.z - app.rendered.enemy.z);
  const seen = new Set<string>();
  for (let i = 0; i < 1500; i++) { app.tick(); seen.add(kick.dataset.reach); assert.equal(kick.dataset.reach, String(gap() <= 1.5), `reach flag follows the gap (${gap().toFixed(2)})`); }
  assert.deepEqual([...seen].sort(), ['false', 'true'], 'both states occur in a fight');
});

test('a cancelled touch withdraws its press even after the simulation has buffered it, and never another control\'s press', () => {
  const app = boot(undefined, undefined, {}, '?opponent=dwarf'); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, id = 6) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: 0, clientY: 0 }));
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  // Light, then press Heavy late in its recovery (inside the buffer window), tick so the sim buffers it, then cancel the Heavy touch: no heavy follows.
  // Inside the buffer window at the end of the cut (a cut thrown inside a chain window uses the shorter chained timing).
  const late = () => { const t = me().chained ? MOVES.light_right.chained! : MOVES.light_right; return t.windup + t.active + t.recovery - 8; };
  settle(); app.key('KeyF'); app.tick(); assert.ok(me().move?.startsWith('light_'));
  for (let i = 0, n = late(); i < n; i++) app.tick(); press(app.element('heavy-button'), 'pointerdown'); app.tick(); assert.ok(me().buffer?.action === 'heavy', `buffered: ${JSON.stringify(me().buffer)}`);
  press(app.element('heavy-button'), 'pointercancel'); for (let i = 0; i < 20; i++) app.tick();
  assert.notEqual(me().move, 'heavy_overhead', 'the cancelled heavy never started'); assert.equal(me().buffer, null);
  // Same, but the cancel comes from an unrelated control: the buffered heavy survives.
  settle(); app.key('KeyF'); app.tick(); for (let i = 0, n = late(); i < n; i++) app.tick(); press(app.element('heavy-button'), 'pointerdown'); app.tick(); assert.equal(me().buffer?.action, 'heavy');
  press(app.element('kick-button'), 'pointercancel', 7); for (let i = 0; i < 20; i++) app.tick(); assert.equal(me().move, 'heavy_overhead', 'another control\'s cancel does not touch it');
});

// The ladder's difficulty is the career's LEVEL (Dom via Strategy 2026-09-27; career.ts levelOf, moves.ts profileAt): a fresh fighter meets the
// Centurion at level 1, 15 wins at level 16; the old stored pick is not read. The admin ladder level pick is retired (Dom 2026-09-29): the
// Sparring tab's Difficulty names the level Start sparring asks for and changes nothing live, for a player or an admin.
test('difficulty: the ladder follows the career level (fresh = 1, 15 wins = 16), the stored pick is ignored, a pick never changes the live warden', () => {
  const app = boot({}, undefined, { 'frankendom.difficulty.v1': 'hard' });
  const pick = app.element('difficulty-select');
  assert.equal(pick.value, '1', 'a fresh fighter fights at level 1, whatever the old key says');
  assert.equal(app.element('sparring-tab').hidden, true, 'a player has no Sparring tab: the rank decides (Dom, 2026-09-27)');
  assert.equal(boot({ career: { victoryMarks: 14 } }).element('difficulty-select').value, '15', '14 wins: level 15');
  assert.equal(boot({ career: { victoryMarks: 15 } }).element('difficulty-select').value, '16', '15 wins: level 16');
  const dev = boot({}, undefined, {}, '?debug');
  const devPick = dev.element('difficulty-select');
  assert.equal(dev.element('sparring-tab').hidden, false, '?debug shows the Sparring tab');
  assert.deepEqual(devPick.children.map(o => o.value), ['1', '10', '15', '20', '25', '30', '35', '40', '45', '50', 'dummy'], 'ten ranks (the current rank at its level, the others at their top) and the dummy (Dom\'s layout A)');
  assert.equal(devPick.disabled, false);
  devPick.value = '46'; devPick.dispatchEvent(new Event('change')); dev.tick();
  assert.deepEqual([dev.replaced, dev.reloads], [[], 0], 'the pick waits for Start sparring: nothing reloads');
  assert.equal(dev.element('dev-kit-line').hidden, true, 'the ladder fight still counts');
  assert.equal(dev.storage.getItem('frankendom.difficulty.v1'), null, 'nothing stored');
  assert.deepEqual(app.errors, []); assert.deepEqual(dev.errors, []);
});
// Dom 2026-09-29 (via Strategy, layout A): the Sparring tab is Opponent + Difficulty. Difficulty is the Opponent's ten legends, one per rank,
// "6 – Hannibal", then the Dummy; rank r fights at its rung's top level, and the rank the fight stands in keeps its own level. A new Opponent
// refills the list and keeps the rank. The flat Legend list is gone.
test('Sparring Difficulty: the Opponent\'s ten legends ("6 – Hannibal") then the Dummy; a rank fights at its top; a new Opponent keeps the rank', () => {
  const app = boot({ career: { victoryMarks: 6 } }, undefined, {}, '?debug'), pick = app.element('difficulty-select'), opponent = app.element('opponent-select');
  assert.equal(app.element('legend-select').children.length, 0, 'no Legend list');
  assert.deepEqual(opponent.children.map((o) => o.value), [...legends.LEGEND_OPPONENTS].filter((id) => ladder.LADDER.some((r) => r.id === id)), 'Opponent: the beta legend opponents in LEGEND_OPPONENTS order');
  assert.equal(opponent.children.find((o) => o.value === 'veteran')!.textContent, 'Centurion');
  assert.equal(pick.value, '7', '6 wins: level 7, on the rank-2 line');
  opponent.value = 'veteran'; opponent.dispatchEvent(new Event('change'));
  assert.deepEqual(pick.children.map((o) => o.textContent), [...Array.from({ length: 10 }, (_, i) => `${i + 1} – ${legends.legendAt('veteran', i + 1).name}`), 'Dummy']);
  assert.deepEqual(pick.children.map((o) => o.value), ['5', '7', '15', '20', '25', '30', '35', '40', '45', '50', 'dummy'], 'each rank at its top level; the rank the fight stands in keeps its level (7)');
  assert.equal(pick.children[5]!.textContent, '6 – Hannibal'); assert.equal(pick.children[9]!.textContent, '10 – Mars');
  assert.equal(pick.children[1]!.textContent, '2 – Ragnar Lothbrok', 'the fight\'s own level rides the value only: the text never shows it');
  app.element('spar-start').click();
  assert.match(app.replaced.at(-1)!, /^\/\?opponent=veteran&spar=1&.*difficulty=7&/, 'no new pick: Start sparring fights where the fight stands (7)');
  pick.value = '15'; pick.dispatchEvent(new Event('change')); pick.value = '10'; pick.dispatchEvent(new Event('change'));
  assert.deepEqual(pick.children.map((o) => o.value).slice(0, 3), ['5', '10', '15'], 'any fresh pick rebuilds on the rank tops: the 7 is gone');
  app.element('spar-start').click();
  assert.match(app.replaced.at(-1)!, /^\/\?opponent=veteran&spar=1&.*difficulty=10&/, 'a fresh pick of rank 2 fights at its top (10)');
  pick.value = '30'; pick.dispatchEvent(new Event('change')); opponent.value = 'witch'; opponent.dispatchEvent(new Event('change'));
  assert.deepEqual([pick.value, pick.children[5]!.textContent], ['30', `6 – ${legends.legendAt('witch', 6).name}`], 'Centurion 6 → Witch 6: the rank is kept');
  assert.equal(app.reloads, 0, 'no pick reloads');
  app.element('spar-start').click();
  assert.match(app.replaced.at(-1)!, /^\/\?opponent=witch&spar=1&.*difficulty=30&/, 'Start sparring: Witch rank 6 at level 30');
  assert.deepEqual(app.errors, []);
});
// The difficulty dial (Dom via Strategy 2026-09-27): the opponent fights at the stored dial, not the rank; the control names the dial.
test('difficulty dial: a stored dial below the rank sets the fight\'s level, clamped to the rank and to five below it', () => {
  assert.equal(boot({ id: 'tester-1234', career: { victoryMarks: 12 }, dial: { level: 10, losses: 1, wins: 0 } }).element('difficulty-select').value, '10', 'rank 13, dial 10: level 10');
  assert.equal(boot({ id: 'tester-1234', career: { victoryMarks: 12 }, dial: { level: 3, losses: 0, wins: 0 } }).element('difficulty-select').value, '8', 'never more than five below the rank');
  assert.equal(boot({ id: 'tester-1234', career: { victoryMarks: 12 } }).element('difficulty-select').value, '13', 'no dial: the rank');
});
test('hit-stop presentation: the frozen frames show the contact tick itself (bodies and a frozen flag for the renderer), the frame that outlives the pause carries its remainder into the next tick, and the journal toggle turns the pause off and remembers it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const tickOf = () => app.rendered.duel.tick;
  const CONTACT = new Set(['Blocked', 'Hit', 'Parried', 'GuardBroken', 'PostureBroken', 'Killed']);
  // Stand and get hit: a blow's knockback moves the struck body on the contact tick itself, so a frame that blended back toward the tick before would show a different position.
  let struck = false, before = app.rendered.fighter;
  for (let frame = 0; frame < 6000 && !struck; frame++) {
    before = app.rendered.fighter; app.tick();
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick(); continue; }
    if (app.rendered.events.some(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 0)) struck = true;
  }
  assert.ok(struck, 'the player was struck');
  const at = tickOf(), body = app.rendered.fighter;
  assert.ok(Math.hypot(body.x - before.x, body.z - before.z) > .01, 'the blow moved the body on the contact tick');
  assert.equal(app.renderedFrozen, true, 'the contact frame is rendered frozen');
  assert.deepEqual([app.renderedBody.x, app.renderedBody.z], [body.x, body.z], 'the contact frame shows the contact tick\'s body, not the tick before');
  // Until the tick moves every frame shows the contact body; the frozen flag holds while pause time remains (the frame that spends the last of it renders unfrozen with the same body).
  let frozenFrames = 0, flagged = 0; while (tickOf() === at && frozenFrames < 40) { app.tick(); if (tickOf() === at) { frozenFrames++; if (app.renderedFrozen) flagged++; assert.deepEqual([app.renderedBody.x, app.renderedBody.z], [body.x, body.z], 'every frozen frame shows the same contact body'); } }
  assert.ok(frozenFrames >= 1 && flagged >= frozenFrames - 1, `frozen for ${frozenFrames} frames, flagged ${flagged}`); assert.equal(app.renderedFrozen, false, 'the resuming frame is not frozen');
  // Overshoot: a 50 ms Hit stop under 40 ms frames — the second frame spends the last 10 ms of the pause and its remaining 30 ms steps a tick in the same frame.
  const hitAt = (frameMs: number, seed: Record<string, string> = {}) => {
    const a = boot({}, undefined, seed); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick();
    for (let frame = 0; frame < 6000; frame++) {
      if (a.rendered.duel.fighters[0].phase === 'ready' && !a.rendered.finish) a.key('KeyF'); a.tick();
      if (a.rendered.finish) { a.element('reset-button').click(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); continue; }
      const kinds = a.rendered.events.filter(e => CONTACT.has(e.type));
      if (kinds.length === 1 && kinds[0].type === 'Hit' && kinds[0].move !== 'heavy_overhead' && !kinds[0].charged && kinds[0].move !== 'critical' && kinds[0].move !== 'heavy_riposte' && kinds[0].move !== 'heavy_counter') { const t = a.rendered.duel.tick, frames: number[] = []; for (let f = 1; f <= 4; f++) { a.tick(frameMs); frames.push(a.rendered.duel.tick - t); } return frames; }
    }
    throw Error('no plain hit found');
  };
  // A plain hit now stops 50 ms + hit-impact.ts's half tier (3 frames, 50 ms) = 100 ms (fix-forward, Dom 2026-09-29).
  assert.deepEqual(hitAt(40), [0, 0, 1, 3], 'frame 3 ends the 100 ms pause with 20 ms to spare and steps one tick (3.3 ms carried); then 43.3 ms = 2 ticks — without the carry it would read 0, 0, 0, 2');
  // The hit-stop toggle left the Options tab (Strategy's redesign, 2026-09-26): the pause is always on, and a stored 'off' from before is ignored.
  assert.deepEqual(hitAt(40, { 'frankendom.hitstop.v1': 'off' }), [0, 0, 1, 3], 'the pause holds whatever an old store says');
});

test('controls pass: Slash held chambers the cut, a held strike dragged off its circle becomes a guard press (feint in the window), the held level belongs to its own control, and Step rolls at once when the stick is deflected', () => {
  const app = boot(undefined, undefined, {}, '?opponent=dwarf'); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0], light = MOVES.light_right;
  const at = (type: string, x: number, y: number, id = 6) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60 && !me().exposed); i++) app.tick(); };
  const slash = app.element('attack-button'), heavy = app.element('heavy-button'), step = app.element('dodge-button'), joystick = app.element('joystick');
  // Slash held: the cut parks at its chamber (charge counts) while the thumb stays down; release lets it fly.
  settle(); slash.dispatchEvent(at('pointerdown', 54, 54)); app.tick(); assert.ok(me().move?.startsWith('light_'), `a cut: ${me().move}`);   // cuts alternate sides
  for (let i = 0; i < light.chamber! + 6; i++) app.tick();
  assert.ok(me().charge >= 4 && me().age === light.chamber, `a held Slash parks at its chamber: age ${me().age}, held ${me().charge}`);
  slash.dispatchEvent(at('pointerup', 54, 54)); for (let i = 0; i < 4; i++) app.tick(); assert.ok(me().age > light.chamber, 'released, the cut continues');
  // Drag-off feint: Slash pressed, thumb slides off the circle inside the feint window → the swing is abandoned into a guard press; the guard stays up until the thumb lifts.
  settle(); slash.dispatchEvent(at('pointerdown', 54, 54, 7)); app.tick(); assert.ok(me().move?.startsWith('light_'));
  app.tick(); slash.dispatchEvent(at('pointermove', 54, 54, 7)); app.tick(); assert.equal(me().phase, 'attack', 'moving inside the circle changes nothing');
  slash.dispatchEvent(at('pointermove', 200, 54, 7)); app.tick();
  assert.equal(me().phase, 'guard', 'off the circle: the cut is feinted into a guard'); assert.ok(app.rendered.events.some(e => e.type === 'ActionStarted' && e.action === 'feint') || me().parrying, 'as a feint');
  for (let i = 0; i < 20; i++) app.tick(); assert.equal(me().phase, 'guard', 'the guard is held while the thumb stays down off the circle');
  slash.dispatchEvent(at('pointerup', 200, 54, 7)); for (let i = 0; i < 3; i++) app.tick(); assert.notEqual(me().phase, 'guard', 'lifting the thumb drops the guard');
  // Held ownership: Heavy held and Slash tapped — releasing Slash must not drop Heavy's charge.
  settle(); heavy.dispatchEvent(at('pointerdown', 54, 54, 8)); app.tick(); assert.equal(me().move, 'heavy_overhead');
  slash.dispatchEvent(at('pointerdown', 54, 54, 9)); slash.dispatchEvent(at('pointerup', 54, 54, 9));
  for (let i = 0; i < MOVES.heavy_overhead.chamber! + 8; i++) app.tick();
  assert.ok(me().charge >= 6 && me().age === MOVES.heavy_overhead.chamber, `the heavy is still charging after another control's release: age ${me().age}, held ${me().charge}`);
  heavy.dispatchEvent(at('pointerup', 54, 54, 8)); for (let i = 0; i < 40; i++) app.tick();
  // Step with the stick deflected rolls on the press itself (no 150 ms wait); with a neutral stick a tap is still a backstep.
  settle(); joystick.dispatchEvent(at('pointerdown', 20, 54, 2)); app.tick();
  step.dispatchEvent(at('pointerdown', 54, 54, 10)); app.tick(); assert.equal(me().phase, 'roll', 'deflected stick: the press rolls at once');
  step.dispatchEvent(at('pointerup', 54, 54, 10)); app.window.dispatchEvent(at('pointerup', 300, 300, 2)); for (let i = 0; i < 60; i++) app.tick();
  settle(); step.dispatchEvent(at('pointerdown', 54, 54, 11)); app.tick(); assert.equal(me().phase, 'backstep', 'neutral stick: a tap backsteps'); step.dispatchEvent(at('pointerup', 54, 54, 11));
});

test('tempo: the 50 Hz toggle steps the same simulation a fifth slower in wall-clock (17 ms frames advance ~50 ticks a second instead of ~60), is remembered, and hit-stop stays in milliseconds', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const tickOf = () => app.rendered.duel.tick;
  const perSecond = () => { const t = tickOf(); for (let i = 0; i < 60; i++) app.tick(1000 / 60); return tickOf() - t; };
  assert.equal(app.element('tempo-mode').textContent, 'Tempo: 60 Hz');
  const at60 = perSecond(); assert.ok(at60 >= 58 && at60 <= 61, `60 Hz: ${at60} ticks in a second`);
  app.element('tempo-mode').click();
  assert.equal(app.element('tempo-mode').textContent, 'Tempo: 50 Hz'); assert.equal(app.storage.getItem('frankendom.tempo.v1'), '50');
  const at50 = perSecond(); assert.ok(at50 >= 48 && at50 <= 51, `50 Hz: ${at50} ticks in a second`);
  // Ticks are the sim's own clock: the fight is identical, only slower. A contact still stops for its ms, not its ticks.
  app.element('tempo-mode').click(); assert.equal(app.element('tempo-mode').textContent, 'Tempo: 60 Hz'); assert.equal(app.storage.getItem('frankendom.tempo.v1'), '60');
});

test('online clock ignores stored solo tempo; a contact holds only the drawn frame while input sampling never pauses', () => {
  const Match = matchModule.Match;
  try {
    for (const tempo of ['50', '60']) {
      let live!: match.Match;
      matchModule.Match = captureMatch(value => { live = value; });
      const app = boot({ id: 'tester-0001' }, undefined, { 'frankendom.tempo.v1': tempo });
      app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
      let samples = 0;
      let events: combat.Practice['events'] = [];
      live.startPvp({ frame: () => { samples++; const now = events; events = []; return { ...live.practice, events: now }; },   // a contact is one tick's event, delivered once (a hit that repeated every tick would hold every tick)
        get practice() { return live.practice; }, settled: false });
      // Actual main frame loop and Match wiring, including each ordinary/heavy/kill contact.
      for (const type of ['Hit', 'Blocked', 'Parried', 'GuardBroken', 'PostureBroken', 'Killed', 'SpecialLanded'] as const) {
        events = [{ type, tick: 1, actor: 0, target: 1, move: 'heavy_overhead', charged: true }];
        const before = samples;
        let frozen = 0;
        for (let i = 0; i < 60; i++) { app.tick(1000 / 60); if (app.renderedFrozen) frozen++; }
        assert.ok(samples - before >= 59 && samples - before <= 61, `${tempo} Hz preference, ${type}: ${samples - before} online samples/sec`);   // the net cadence never pauses...
        assert.ok(frozen >= 1 && frozen <= 20, `${type}: the DRAWN frame holds for the contact (${frozen} frames), then the screen is live again`);   // ...only the picture is held (src/pvp-hold.ts), for the solo ms
      }
      // Even changing the solo preference during the duel cannot alter network cadence.
      app.element('tempo-mode').click();
      const before = samples;
      for (let i = 0; i < 60; i++) app.tick(1000 / 60);
      assert.ok(samples - before >= 59 && samples - before <= 61);
      assert.equal(app.storage.getItem('frankendom.tempo.v1'), tempo === '50' ? '60' : '50');
    }
  } finally { matchModule.Match = Match; }
});

test('a kill link that arrives after a newer match started neither re-opens the page on its rig nor replaces the fight (audit 2026-09-23)', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  // A Goblin record opened on a page that booted the Veteran: a fresh link re-opens the page on the record's rig; a stale one must not.
  const rec = record.createRecorder({ build: 'dev', opponent: 'goblin', weapon: 'longsword', level: 18, seed: 3 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const text = await record.encodeRecord(rec.finish('killed'));
  const a = boot({}, undefined, {}, `?replay=${text}`);
  assert.equal(a.element('replay-banner').textContent, 'Loading the fight…');
  a.element('reset-button').click(); a.tick();   // a newer match before the link resolved
  await settle(() => a.element('replay-banner').textContent !== 'Loading the fight…');
  assert.equal(a.replaced.length, 0, 'the stale record does not re-open the page on its rig');
  assert.equal(a.element('replay-banner').hidden, true, 'the loading line goes');
  assert.equal(a.element('attack-button').attributes.get('aria-disabled'), 'false', 'the newer fight is live, not a replay');
});
// Daily removed, Dom 2026-09-29: an old `?daily=1` link (a bookmark, a shared post) boots the ladder like any page: no banner, no error, the ladder picker.
test('an old ?daily=1 link boots the ladder fight: no daily, no banner, no error', () => {
  const app = boot({}, undefined, {}, '?daily=1');
  for (let i = 0; i < 3; i++) app.tick();
  const plain = boot({}, undefined, {}, ''); for (let i = 0; i < 3; i++) plain.tick();
  assert.deepEqual([app.element('replay-banner').hidden, app.element('replay-banner').textContent], [plain.element('replay-banner').hidden, plain.element('replay-banner').textContent], 'no daily banner: the header band as without the param');
  assert.equal(app.replaced.length, 0, 'no redirect to a daily rung');
  assert.equal(app.element('welcome').hidden, plain.element('welcome').hidden, 'the same first page as without the param');
  assert.equal(app.element('difficulty-select').value, plain.element('difficulty-select').value, 'the ladder level, as without the param');
  assert.deepEqual(app.errors, []);
});
test('the ladder: saved progress picks the opponent and labels him; a loss offers a rematch, not the next rung, and never reloads', () => {
  const app = boot({ id: 'tester-0001', ladder: 'pitborn', career: { victoryMarks: 17 } }); app.tick();   // a valid id: the harness default 'test' fails the profile's 8-char rule and boots a fresh guest; 17 wins = level 18, his full body (moves.ts opponentAt)
  assert.equal(app.rendered.enemyMaxHealth, 190, 'the Pitborn stands opposite (his health, not a man\'s)');
  // A legend is named as the versus card names him (Dom via Strategy 2026-09-28): his name, then "the Pitborn" small beside it.
  const pitLegend = legends.legendForLevel('pitborn', 18).name;
  assert.equal(app.element('opponent-name').children[0], `${pitLegend.toUpperCase()} `);
  assert.equal(app.element('opponent-name').children[1]!.textContent, 'the Pitborn');
  assert.equal(app.element('opponent-name').dataset.mobile, pitLegend);
  app.key('KeyF'); for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until he wins
  assert.ok(app.rendered.finish && app.rendered.finish.victim === 0, 'the player fell');
  assert.equal(app.element('reset-button').textContent, 'Rematch');
  app.element('reset-button').click(); app.tick();
  assert.equal(app.reloads, 0, 'a rematch stays on the same rig'); assert.equal(app.rendered.enemyMaxHealth, 190);
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'pitborn', 'progress is untouched by a loss');
});

test('the ladder: the first rung is the Centurion, and the bars carry his name like every other rung', () => {
  const app = boot(); app.tick();
  assert.equal(app.rendered.enemyMaxHealth, moves.opponentAt(moves.OPPONENTS.veteran, 1).health, 'a fresh fighter meets the level-1 Centurion (the novice body, 70 % health)'); assert.equal(app.element('opponent-name').children[0], `${legends.legendForLevel('veteran', 1).name.toUpperCase()} `); assert.equal(app.element('opponent-name').children[1]!.textContent, 'the Centurion');
  assert.equal(app.element('opponent-name').dataset.mobile, legends.legendForLevel('veteran', 1).name);
  assert.equal(app.element('target-health').attributes.get('aria-label'), `${legends.legendForLevel('veteran', 1).name}, the Centurion, health`);
  assert.equal(app.element('target-posture').attributes.get('aria-label'), `${legends.legendForLevel('veteran', 1).name}, the Centurion, posture`);
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, undefined);
});

// The admin Sparring tab's Opponent picker (Dom 2026-09-29): it lists the live ladder and opens on the fight on screen; a pick starts nothing
// and moves no rung (Start sparring carries it). Players have no picker at all: the ladder's Next picks the next unbeaten rung.
test('the Sparring tab\'s opponent picker lists the ladder, shows the current rung, and a pick neither reloads nor moves the rung', () => {
  const app = boot({ id: 'tester-0001', ladder: 'goblin' }, undefined, {}, '?debug'); app.tick();
  const select = app.element('opponent-select');
  // Re-pinned (Sparring layout A, Dom 2026-09-29): LEGEND_OPPONENTS order, still live rungs only.
  assert.deepEqual(select.children.map(o => o.value), ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf', 'shieldmaiden', 'plaguedoctor', 'witch', 'knight'], 'live rungs only: held Season 2 creatures are not offered');
  assert.equal(select.value, 'goblin', 'the picker shows the rung this device is on');
  select.value = 'nightborn'; select.dispatchEvent(new Event('change')); app.tick();
  assert.deepEqual([app.replaced, app.reloads], [[], 0], 'no navigation');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'goblin', 'the rung is untouched');
});

test('the Sparring Stage pick waits for Start and carries the selected arena without changing the ladder', () => {
  const app = boot({ id: 'tester-0001', ladder: 'goblin' }, undefined, { 'session:frankendom.arena.v1': 'a' }, '?debug'); app.tick();
  const sessionBefore = app.storage.sessionSnapshot();
  const storedBefore = app.storage.snapshot(), arenaBefore = app.storage.arena();
  const select = app.element('arena-select');
  select.value = 'b'; select.dispatchEvent(new Event('change')); app.tick();
  assert.deepEqual([app.replaced, app.reloads], [[], 0], 'the Stage pick starts nothing');
  assert.deepEqual(app.storage.sessionSnapshot(), sessionBefore, 'the Stage pick writes no session preference');
  assert.deepEqual(app.storage.snapshot(), storedBefore, 'the Stage pick writes no fighter, reward or record');
  assert.equal(app.storage.arena(), arenaBefore, 'the live arena is unchanged');
  app.element('difficulty-select').value = 'dummy'; app.element('difficulty-select').dispatchEvent(new Event('change'));
  app.element('spar-weapon').value = 'estoc'; app.element('spar-skill').value = 'miasma';
  app.element('spar-start').click(); app.tick();
  assert.deepEqual(app.replaced, ['/?opponent=goblin&spar=1&weapon=estoc&difficulty=dummy&skill=miasma&special=none&yourSpecial=none&arena=b'], 'Start carries exactly the opponent, kit, player MOVE, special NONE and selected Stage');
  assert.deepEqual(app.storage.snapshot(), storedBefore, 'Start writes no fighter, reward or record');
  assert.deepEqual(app.storage.sessionSnapshot(), sessionBefore, 'Start writes no session preference');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'goblin', 'the rung is untouched');
});

// The Sparring tab (Dom 2026-09-29, via Strategy): admins only, no Ladder/Sparring switch. Its pickers start nothing on their own and Start
// sparring carries exactly what the tab shows — the sparring defect's path C (spar picks, then the Opponent picker, reloaded and dropped them)
// cannot happen. A player has neither the tab nor an Opponent picker; Next keeps its unbeaten pick.
test('Sparring tab: the Opponent picker and Difficulty wait for Start sparring, which carries exactly what is shown; players have no tab', () => {
  const player = boot({ id: 'tester-0001', ladder: 'goblin' }); player.tick();
  assert.equal(player.element('sparring-tab').hidden, true, 'a player: no Sparring tab');
  const app = boot({ id: 'tester-0001', ladder: 'goblin' }, undefined, {}, '?debug'); app.tick();
  const opponent = app.element('opponent-select'), difficulty = app.element('difficulty-select');
  assert.equal(app.element('sparring-tab').hidden, false, 'an admin (?debug): the Sparring tab');
  assert.equal(opponent.value, 'goblin', 'the picker opens on the fight on screen');
  opponent.value = 'dwarf'; opponent.dispatchEvent(new Event('change')); app.tick();
  assert.equal(app.replaced.length, 0, 'path C: the Opponent pick does not reload');
  difficulty.value = 'dummy'; difficulty.dispatchEvent(new Event('change')); app.tick();
  assert.equal(app.storage.getItem('frankendom.difficulty.v1'), null, 'the dummy is never stored');
  app.element('spar-weapon').value = 'estoc'; app.element('spar-skill').value = 'witchfire';
  app.element('spar-start').click(); app.tick();
  assert.deepEqual(app.replaced, ['/?opponent=dwarf&spar=1&weapon=estoc&difficulty=dummy&skill=witchfire&special=none&yourSpecial=none&arena=ladder'], 'Start carries the Dwarf, dummy, estoc, Witch-fire, no special and Ladder Stage');
  difficulty.value = '12'; app.element('spar-start').click(); app.tick();
  assert.equal(app.replaced[1], '/?opponent=dwarf&spar=1&weapon=estoc&difficulty=12&skill=witchfire&special=none&yourSpecial=none&arena=ladder', 'a numbered level rides the link as is');
  assert.deepEqual([player.errors, app.errors], [[], []]);
});

test('graphics startup preserves the original failure and stack for monitoring', () => {
  const failure = new Error('GPU allocation failed');
  assert.throws(() => boot({}, failure), error => error === failure);
});

type Node = { attributes: Map<string, string>; children: Node[]; textContent: string; className?: string; style: { getPropertyValue(k: string): string } };
const rankRow = (el: unknown) => { const n = el as Node; return { label: n.attributes.get('aria-label'), now: n.children[0]?.textContent, fills: n.children[1]?.children.map((s) => s.style.getPropertyValue('--fill')), next: n.children[2]?.textContent }; };
test('the identity aside shows the career rank from the saved mark count at boot', () => {
  const app = boot({ id: 'tester-1234', career: { victoryMarks: 12 } });   // the harness default id 'test' is shorter than a real guest id, so the saved profile is discarded on load
  // The rank row (Dom 2026-09-23; 2026-09-27: one whole segment per win): class + numeral, one bar segment per numeral of the class, the next class.
  assert.deepEqual(rankRow(app.element('rank')), { label: 'Gladiator III', now: 'Gladiator III', fills: ['100%', '100%', '0%', '0%', '0%'], next: 'Veteran' });
  assert.deepEqual(rankRow(app.element('journal-rank')), rankRow(app.element('rank')), 'the journal card renders the same component');
  assert.equal(app.element('rank-sigil').textContent, 'III');
  assert.deepEqual(rankRow(boot().element('rank')), { label: 'Recruit I', now: 'Recruit I', fills: ['0%', '0%', '0%', '0%', '0%'], next: 'Legionary' });
  assert.deepEqual(rankRow(boot({ id: 'tester-1234', career: { victoryMarks: 9 } }).element('rank')).fills, ['100%', '100%', '100%', '100%', '0%'], 'Legionary V: four whole segments, never a partial one');
});

test('the journal test tools stay hidden without ?debug; the roster flag is the account module\'s to set', () => {
  const app = boot();
  assert.equal(app.element('test-tools').hidden, true);
  assert.equal(app.element('test-tools').dataset.debug, undefined);
  assert.equal(app.element('sparring-tab').hidden, true, 'and so does the Sparring tab (Dom 2026-09-29)');
});
// Strategy 2026-09-29 (before public beta): ?debug opens the test tools on a local build only (the release checks); on the live site an
// anonymous ?debug page keeps them, and the Sparring tab, hidden until account.ts finds the account on the admins roster.
test('?debug opens the test tools and the Sparring tab on a local build only; the live site waits for the admins roster', () => {
  const local = boot({}, undefined, {}, '?debug'), live = boot({}, undefined, {}, '?debug', false, 'frankendom.com');
  assert.deepEqual([local.element('test-tools').hidden, local.element('test-tools').dataset.debug, local.element('sparring-tab').hidden], [false, 'true', false], 'local ?debug: open');
  assert.deepEqual([live.element('test-tools').hidden, live.element('test-tools').dataset.debug, live.element('sparring-tab').hidden], [true, undefined, true], 'live anonymous ?debug: hidden, not marked for account.ts');
  assert.equal(boot({}, undefined, {}, '?opponent=veteran&spar=1&weapon=longsword&difficulty=easy&skill=none', false, 'frankendom.com').element('sparring-tab').hidden, false, 'a sparring link still shows its tab (Dom 2026-09-29)');
  assert.deepEqual([local.errors, live.errors], [[], []]);
});
// Strategy 2026-09-29 (yes, via Lead): what ?debug SHOWS follows the same rule. On the live site an anonymous ?debug page shows no
// combat-debug overlay and no scorecard table; the admins roster (account.ts showTools) shows both; a local build keeps ?debug for the rows.
test('?debug on the live site: no combat-debug overlay or scorecard for an anonymous page; the admins roster shows both; a local build keeps them', () => {
  const live = boot({}, undefined, {}, '?debug', false, 'frankendom.com');
  live.tick(); live.element('journal-button').click();
  assert.deepEqual([live.element('debug').hidden, live.element('scorecard').hidden], [true, true], 'anonymous live ?debug: neither shows');
  live.element('test-tools').hidden = false;   // account.ts showTools(true): the next frame reads debugShown() and the HUD key carries it
  live.element('close-journal').click(); live.element('journal').dispatchEvent(new Event('close'));   // (the fake dialog fires no close event) the open Gear sheet draws the rig and the fight waits (frame()): the HUD key is read in the fight's frames
  live.key('KeyF'); for (let i = 0; i < 10; i++) live.tick(); live.element('journal-button').click();
  assert.deepEqual([live.element('debug').hidden, live.element('scorecard').hidden], [false, false], 'an admin with ?debug: both show');
  const local = boot({}, undefined, {}, '?debug');
  local.tick(); local.element('journal-button').click(); local.element('close-journal').click(); local.element('journal').dispatchEvent(new Event('close')); local.tick();
  assert.deepEqual([local.element('debug').hidden, local.element('scorecard').hidden], [false, false], 'a local build: ?debug shows both for the release checks');
  assert.deepEqual([live.errors, local.errors], [[], []]);
});
test('the versus card: the fight waits behind it with the buttons asleep, and it lifts the moment the rigs land with the fight on at once', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still'), attack = () => app.element('attack-button').attributes.get('aria-disabled');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;   // the harness boots with the rigs in; back into the download
  app.element('versus-portrait').dispatchEvent(new Event('error'));   // no legend face for this rung: today's card
  still.dispatchEvent(new Event('load'));                       // the still arrives before the rigs: the card shows and the fight waits
  assert.equal(versus.hidden, false); assert.equal(attack(), 'true', 'buttons asleep behind the card');
  assert.equal(versus.dataset.portrait, undefined, 'no face, no B4 layout');
  app.tick(); app.key('KeyF'); app.tick(); app.tick();
  assert.equal(app.rendered.duel.tick, 0, 'no sim ticks behind the card');
  app.report('', 'ready');                                       // the rigs are in
  assert.equal(versus.dataset.out, 'true', 'the card lifts at once'); assert.equal(app.timers.size, 0, 'no hold timer');
  assert.equal(attack(), 'false', 'buttons wake as the card lifts');
  app.tick(); app.tick(); assert.ok(app.rendered.duel.tick > 0, 'the fight runs once the card lifts');
});
test('the versus card B4 (Dom via Strategy 2026-09-28): the legend\'s face is fetched for the fight\'s rung, and the card waits for it before showing, with the face layout', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still'), face = app.element('versus-portrait');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out; face.hidden = true;   // as index.html ships it
  assert.match(String((face as unknown as HTMLImageElement).src), /^legends\/[a-z]+-(10|[1-9])\.webp$/, 'legends/<opponent>-<rung>.webp');
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, true, 'the still alone does not show the card while the face is in flight (no layout jump)');
  face.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, false); assert.equal(versus.dataset.portrait, 'true'); assert.equal(face.hidden, false);
});
test('the versus card B4: a face request that never settles does not hold the card — it shows without the face after 2 s, a late face is left out, and a load failure still lifts it', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still'), face = app.element('versus-portrait');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out; face.hidden = true;   // as index.html ships it
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, true, 'held for the face at first');
  assert.equal(app.timers.size, 1, 'one wait armed'); for (const timer of [...app.timers.values()]) timer();   // the 2 s wait runs out
  assert.equal(versus.hidden, false, 'shown without the face after the wait'); assert.equal(versus.dataset.portrait, undefined);
  face.dispatchEvent(new Event('load'));
  assert.equal(versus.dataset.portrait, undefined, 'a face that lands after the card is up is left out'); assert.equal(face.hidden, true);
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  assert.equal(versus.dataset.out, 'true', 'a load failure lifts the card');
});
test('the versus card B4: a load failure while the face is still in flight lifts the card for good — the face wait running out later never brings it back', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;
  still.dispatchEvent(new Event('load'));
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  for (const timer of [...app.timers.values()]) timer();
  assert.equal(versus.hidden, true, 'the card never shows over the retry notice');
});
test('the versus card: a display-text change alone never lifts the card — only the machine-readable kind does', () => {
  // Regression for the audit finding (2026-09-22): the hide condition used to compare the display string against the literal
  // 'Loading warriors\u2026', so any future in-progress status LINE (a download-stage message, say) would have lifted the card
  // early and shown the capsule stand-ins. main.ts now keys off scene.ts's explicit kind ('loading' | 'ready' | 'failed');
  // the display text is free to change without touching that contract.
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still'); app.element('versus-portrait').dispatchEvent(new Event('error'));
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, false);
  app.report('Fetching textures…', 'loading');   // a differently worded in-progress line, still kind 'loading'
  assert.equal(versus.hidden, false, 'a re-worded in-progress status must not lift the card');
  assert.notEqual(versus.dataset.out, 'true');
  app.report('', 'ready');
  assert.equal(versus.dataset.out, 'true', 'the ready kind still lifts it');
});
test('the versus card: a load failure also lifts it, so the retry banner stays readable', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;
  app.element('versus-portrait').dispatchEvent(new Event('error'));   // no face: today's card
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, false);
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  assert.equal(versus.dataset.out, 'true', 'a failure lifts the card so the notice is readable');
});
test('every fight is recorded in memory: the record finishes on the kill with the seed and outcome, and a rematch starts a fresh one', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the fight ends');
  assert.match(app.element('debug').dataset.record ?? '', /^\d{3,}\/died\/731$/, 'first fight: seed 731, hundreds of ticks, the player died');
  app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish); assert.match(app.element('debug').dataset.record ?? '', /^\d{3,}\/(died|killed)\/\d+$/); assert.doesNotMatch(app.element('debug').dataset.record ?? '', /\/731$/, 'the rematch is a fresh record on a new seed');
});
test('during the tour, a touch anywhere hands the camera back: a pointerdown on #actions (not the canvas) calls view.stopTour(); before the tour it does not', () => {
  // Lead review 2026-09-22: during the tour the HUD is faded and inert, so a thumb landing where Rematch was hits the #actions
  // cluster box, not the canvas. The canvas listener alone would never stop the tour, and the HUD would never come back. Gated on
  // the tour running: a tap in the settle window must not cancel a tour that has not started (stopTour() only sets a flag).
  const app = boot();
  app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  app.document.dispatchEvent(new Event('pointerdown'));
  assert.equal(app.tourStops, 0, 'no finish yet: a stray touch does not touch the camera');
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the fight ends');
  app.setFinishPhase({ settled: true, touring: false, age: 2 });
  app.document.dispatchEvent(new Event('pointerdown'));   // settle window, tour not started: Rematch is live, the tour must still come
  assert.equal(app.tourStops, 0, 'before the tour, a tap does not cancel it');
  app.setFinishPhase({ settled: true, touring: true, age: 5.5 });
  app.document.dispatchEvent(new Event('pointerdown'));   // a tap that bubbled up from #actions (or anywhere) — not the canvas
  assert.equal(app.tourStops, 1, 'during the tour, any pointerdown stops it');
});
test('end-of-fight text and buttons fade with view.finishPhase(): hidden until settled, faded again while the arena-cam tours, back once the tour ends', () => {
  // Owner 2026-09-22: nothing over the fallen body until the finisher camera has settled, and it fades again during the arena-cam
  // tour — no timer of our own, the rig's own clock (scene.ts finishPhase()) is the single source of truth main.ts polls.
  const app = boot(), html = app.element('html');
  app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the fight ends');
  app.setFinishPhase({ settled: false, touring: false, age: 0.3 });
  app.tick();
  assert.ok(html.classList.contains('endgame-fade'), 'not yet settled: still faded');
  assert.ok(html.classList.contains('endgame-hush'), 'not yet settled: the rank row is hushed too');
  app.setFinishPhase({ settled: true, touring: false, age: 1.6 });
  app.tick();
  assert.ok(!html.classList.contains('endgame-fade'), 'settled, no tour: visible');
  app.setFinishPhase({ settled: true, touring: true, age: 5.2 });
  app.tick();
  assert.ok(html.classList.contains('endgame-fade'), 'touring: faded again');
  assert.ok(!html.classList.contains('endgame-hush'), 'touring: the rank row stays up (Dom 2026-09-24: it read as missing)');
  app.setFinishPhase({ settled: true, touring: false, age: 9 });
  app.tick();
  assert.ok(!html.classList.contains('endgame-fade'), 'tour ended (a touch or Rematch): visible again');
  // The finisher-complete latch (2026-09-22) must not hold the hush on a fight with no loot offer pending. This fight is a
  // LOSS — the player draws and stands still — so `pendingLoot` is null and the hush keeps reading `settled`, exactly as
  // before. Every phase above carried `complete: false`; the row came back at settle regardless, which is the assertion.
  // The WIN side, where the hush does wait for the latch and the panel opens on it, is not reachable from this harness (the
  // warden fights back and nothing here can beat him); it is covered by the real UI win in scripts/quiet-one-browser-check.mjs,
  // release rows 16, 21 and 28 (Split Crown, Opened, Decapitation). Said plainly so nobody reads this test as proving the win path.
  assert.equal(app.element('loot-panel').attributes.get('data-on') ?? '0', '0', 'a lost fight offers no loot, latch or no latch');
});
test('kill links: a finished fight offers Share; the link replays the same fight tick for tick with the buttons asleep and nothing scored; PLAY NOW starts a live practice fight on the same seed that never touches the card', async () => {
  // The record encodes and decodes through CompressionStream off the main turn: wait for the thing itself (up to 2 s on a slow runner), never a fixed number of turns.
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick();
  for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
  assert.ok(a.rendered.finish, 'fight A ends');
  assert.equal(a.element('share-link').hidden, false, 'Share appears on the death screen');
  await settle(() => !!a.element('debug').dataset.share);
  const text = a.element('debug').dataset.share as string | undefined;
  assert.ok(text && /^[A-Za-z0-9_-]+$/.test(text), 'the encoded record is exposed for the gates');
  const ticksA = a.rendered.duel.tick, finishA = a.rendered.finish!, cardA = a.storage.getItem('frankendom.controls.v1');
  // B opens the link with nothing saved: no welcome, a replay banner, buttons asleep, the same fight.
  const b = boot({}, undefined, {}, `?opponent=veteran&replay=${text}`);
  b.tick();   // a frame lands before the record has decoded (the browser's rAF beats the async decode): it must not mark a fight
  assert.equal(b.storage.getItem('frankendom.fight.v1'), null, 'no AFK mark while the link is still decoding');
  const cardBefore = b.storage.getItem('frankendom.scorecard.v1');
  await settle(() => b.element('replay-banner').textContent !== 'Loading the fight…');   // the record decodes asynchronously
  assert.equal(b.element('welcome').hidden, true, 'no welcome on a replay link');
  assert.equal(b.element('replay-banner').hidden, false); assert.match(b.element('replay-banner').textContent, /^Replay/);
  assert.equal(b.element('attack-button').attributes.get('aria-disabled'), 'true', 'buttons asleep during a replay');
  b.tick();
  for (let i = 0; i < 6000 && !b.rendered.finish; i++) b.tick();
  assert.ok(b.rendered.finish, 'the replay reaches the finish');
  assert.equal(b.rendered.duel.tick, ticksA, 'same final tick as the recorded fight');
  assert.deepEqual(b.rendered.finish, finishA, 'same finish');
  assert.equal(b.storage.getItem('frankendom.controls.v1'), null, 'a replay writes nothing to the card');
  assert.ok(!b.storage.getItem('frankendom.fight.v1'), 'a watched fight is never marked as walked away from (the viewer\'s next boot would score a loss)');
  assert.equal(b.storage.getItem('frankendom.scorecard.v1'), cardBefore, 'a replay scores nothing');
  assert.equal(b.element('reset-button').textContent, 'PLAY NOW');   // a stranger does not know whose death they are avenging (owner 2026-09-22)
  assert.equal(b.element('reset-button').dataset.play, '1', 'the viewer page\'s only live control wears the primary');
  assert.equal(b.element('replay-banner').dataset.stale, '0', '"Replay over" is a status about the fight that played, not a stale link: it stays in the header band');
  // The page keeps rendering after the kill (2026-09-28, live on every kill link): one more frame used to step the record past its last tick,
  // stall, and overwrite "Replay over" with "Recorded on an older build" 7–13 frames later. A finished replay plays out as a live fight does.
  for (let i = 0; i < 90; i++) b.tick();
  assert.match(b.element('replay-banner').textContent, /^Replay over/, 'a replay that reached its finish is never called stale');
  assert.deepEqual(b.rendered.finish, finishA, 'the finish holds while the page keeps rendering');
  assert.equal(b.element('share-link').hidden, true, 'a replay is not re-shared from the viewer');
  // PLAY NOW: live, same seed, practice only.
  b.element('reset-button').click(); b.tick();
  assert.equal(b.element('replay-banner').hidden, true);
  assert.equal(b.element('attack-button').attributes.get('aria-disabled'), 'false', 'the avenging fight is live');
  b.key('KeyF'); for (let i = 0; i < 45; i++) b.tick();
  for (let i = 0; i < 6000 && !b.rendered.finish; i++) b.tick();
  assert.ok(b.rendered.finish, 'the fight started from the link ends');
  assert.equal(b.rendered.duel.tick, ticksA, 'standing still on the same seed meets the same warden: same ending tick');
  assert.equal(b.storage.getItem('frankendom.controls.v1'), null, 'practice only: still nothing on the card');
  assert.equal(b.element('reset-button').textContent, 'Rematch', 'after avenging, a plain rematch, never the next rung');
  assert.equal(b.element('reset-button').dataset.play, '0', 'a plain Rematch keeps the dark glass');
  assert.equal(b.element('share-link').hidden, false, 'the avenging fight itself can be shared');
  assert.ok(cardA, 'the original fight was scored on A');
});
test('kill links: a link for another opponent than the page booted, or a broken record, is refused with a banner and no fight is stepped from it', async () => {
  // The record encodes and decodes through CompressionStream off the main turn: wait for the thing itself (up to 2 s on a slow runner), never a fixed number of turns.
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const rec = record.createRecorder({ weapon: 'longsword', build: 'dev', opponent: 'goblin', level: 18, seed: 5 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const text = await record.encodeRecord(rec.finish('abandoned'));
  const wrong = boot({}, undefined, {}, `?opponent=veteran&replay=${text}`); await settle(() => wrong.element('replay-banner').textContent !== 'Loading the fight…');
  assert.equal(wrong.element('replay-banner').textContent, 'This fight cannot be played here');   // one small line, never a raw error over the HUD (owner 2026-09-22)
  assert.equal(wrong.element('reset-button').hidden, false, 'a refused link still offers PLAY NOW'); assert.equal(wrong.element('reset-button').textContent, 'PLAY NOW');
  assert.equal(wrong.element('replay-banner').dataset.stale, '1', 'the stale-link line leaves the header band for the slot above PLAY NOW');
  assert.equal(wrong.element('reset-button').dataset.play, '1');
  const broken = boot({}, undefined, {}, '?opponent=veteran&replay=AAAA');
  assert.equal((broken.window as unknown as { location: { search: string } }).location.search, '?opponent=veteran&replay=AAAA', 'the harness passes the search string');
  assert.equal(broken.element('replay-banner').textContent, 'Loading the fight…', 'the link is picked up at boot');
  await settle(() => broken.element('replay-banner').textContent !== 'Loading the fight…');
  assert.equal(broken.element('replay-banner').textContent, 'This fight cannot be played here');
  assert.equal(broken.element('reset-button').textContent, 'PLAY NOW', 'the way on is the same on any refused link');
  broken.tick(); wrong.tick();
  assert.equal(broken.storage.getItem('frankendom.fight.v1'), null, 'a refused link leaves the page a viewer: no AFK mark');
  assert.equal(wrong.storage.getItem('frankendom.fight.v1'), null, 'a link for another opponent: no AFK mark either');
});
test('kill links: a record that runs out before its finish freezes on the last frame with one small line and PLAY NOW, never a raw error over the HUD', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  // A record whose intents end long before the fight does is exactly what a sim change makes of an older link: the replay walks off
  // the end of the intents. (RECORD_VERSION + tests/record-version-guard.test.ts are what stop this happening in the first place.)
  const rec = record.createRecorder({ weapon: 'longsword', build: 'dev', opponent: 'veteran', level: 18, seed: 5 });
  for (let i = 0; i < 30; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const text = await record.encodeRecord(rec.finish('abandoned'));
  const v = boot({}, undefined, {}, `?opponent=veteran&replay=${text}`);
  await settle(() => v.element('replay-banner').textContent !== 'Loading the fight…');
  for (let i = 0; i < 400 && v.element('replay-banner').textContent !== 'Recorded on an older build'; i++) v.tick();
  assert.equal(v.element('replay-banner').textContent, 'Recorded on an older build');
  assert.equal(v.element('replay-banner').dataset.stale, '1', 'a record that ran out is the page\'s own message, not a fight status');
  assert.equal(v.element('reset-button').hidden, false, 'the frozen viewer page offers the way on');
  assert.equal(v.element('reset-button').textContent, 'PLAY NOW');
  assert.equal(v.storage.getItem('frankendom.fight.v1'), null, 'a frozen viewer page is not an abandoned fight');
  v.element('reset-button').click(); v.tick();
  assert.equal(v.element('replay-banner').hidden, true, 'PLAY NOW clears the line and starts the fight');
  assert.equal(v.element('replay-banner').dataset.stale, '0', 'the cleared line drops the stale flag with its text');
  assert.equal(v.element('attack-button').attributes.get('aria-disabled'), 'false', 'the fight is live');
});
test('kill links: Share mints a short id for signed-in fighters (with their token) and guests alike; the link is /s/<id>; a refusal says so and never falls back to a long link; a short link without a fight store is refused', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const fight = () => { const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick(); assert.ok(a.rendered.finish, 'the fight ends'); return a; };
  const mints: { opponent: string; token: string | null }[] = [];
  const mintShare = shareModule.mintShare;
  shareModule.mintShare = async (_api: unknown, record: { opponent: string }, token: string | null) => { mints.push({ opponent: record.opponent, token }); if (token === 'refuse') throw Error('too many guest shares this minute'); return mints.length === 1 ? '1a' : '1b'; };
  apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
  session.db = { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-7' } } }) } } as never; session.userId = 'user-7';
  try {
    const a = fight(); a.element('share-link').dispatchEvent(new Event('click'));
    await settle(() => /\/s\/|Could|Couldn/.test(a.element('share-status').textContent));
    assert.equal(a.element('share-status').textContent, 'https://frankendom.com/s/1a?l=veteran-1', 'the signed-in link is the short shape, naming the fight\'s legend face for the link preview (legend og, 2026-09-28)');
    assert.deepEqual(mints[0], { opponent: 'veteran', token: 'jwt-7' }, 'a signed-in fighter mints with their token');
  } finally { session.db = null; session.userId = null; }
  const g = fight(); g.element('share-link').dispatchEvent(new Event('click'));
  await settle(() => /\/s\/|Could|Couldn/.test(g.element('share-status').textContent));
  assert.equal(g.element('share-status').textContent, 'https://frankendom.com/s/1b?l=veteran-1', 'a guest gets a short id too');
  assert.deepEqual(mints[1], { opponent: 'veteran', token: null }, 'a guest mints with the public key');
  session.db = { auth: { getSession: async () => ({ data: { session: { access_token: 'refuse' } } }) } } as never; session.userId = 'user-8';
  try {
    const r = fight(); r.element('share-link').dispatchEvent(new Event('click'));
    await settle(() => /\/s\/|Could|Couldn/.test(r.element('share-status').textContent));
    assert.equal(r.element('share-status').textContent, "Couldn't make a link, try again.", 'a refused mint is said plainly, no record-in-the-link fallback');
  } finally { session.db = null; session.userId = null; shareModule.mintShare = mintShare; apiModule.api = null; }
  const s = boot({}, undefined, {}, '?opponent=veteran&r=Ab3_-9xZ');
  assert.equal(s.element('welcome').hidden, true, 'a short link is picked up at boot');
  await settle(() => s.element('replay-banner').textContent !== 'Loading the fight…');
  assert.equal(s.element('replay-banner').textContent, 'This fight cannot be played here');   // one small line on the viewer page, whatever the reason (owner 2026-09-22)
});
// Re-pinned (Daily removed, Dom 2026-09-29): was fought as a daily; a career loss (Share at once, no claim to wait on) runs the same race.
test('kill links: a Share that is still minting when Rematch starts the next fight shares the fight that was pressed (its link and its take\'s record id), not the new one', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const mintShare = shareModule.mintShare, Match = matchModule.Match;
  let answer: ((id: string) => void) | null = null, live: match.Match | null = null;
  const minted: string[] = [];
  matchModule.Match = captureMatch(value => { live = value; });
  apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
  shareModule.mintShare = (_api: unknown, record: { outcome: string }) => new Promise<string>((r) => { minted.push(record.outcome); answer = r; });
  session.db = { from: () => ({ insert: async () => ({ error: null }) }), auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-7' } } }) } } as never; session.userId = 'user-7';
  try {
    const a = boot({ career: { victoryMarks: 17 }, loot: { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 1, healthLeft: 9, recordId: null, day: '2026-09-22' } } } }, undefined, {}, '?opponent=veteran');
    // Level 18 (17 wins), as the daily was fought: the idle player falls, a loss, so Share shows at once (no claim to wait on). No state is
    // poked: Share re-plays the record (verifyRecord) and refuses one that diverges.
    a.tick(); a.key('KeyF'); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
    assert.ok(a.rendered.finish && a.rendered.finish.victim === 0, 'the fight ends in a loss');
    await settle(() => !a.element('share-link').hidden);
    // A take stands in for a won fight's drop: main.ts records the share's id on match.lastDrop, which begin() nulls.
    live!.lastDrop = 'veteran.Helmet';
    a.element('share-link').dispatchEvent(new Event('click'));
    await settle(() => minted.length === 1);
    assert.deepEqual(minted, ['died'], 'the mint is asked for the finished fight');
    // Rematch lands while the store is still minting: begin() clears lastRecord and lastDrop.
    a.element('reset-button').dispatchEvent(new Event('click')); a.tick();
    assert.equal(a.element('share-link').hidden, true, 'the new fight has no Share yet');
    answer!('d41y0k1d');
    await settle(() => /\/s\/|Could|Couldn/.test(a.element('share-status').textContent));
    assert.match(a.element('share-status').textContent, /^https:\/\/frankendom\.com\/s\/d41y0k1d\?l=veteran-\d+$/, 'the pressed fight\'s link (a legend face tag), not a null read of the new fight');
    assert.equal(JSON.parse(a.storage.getItem('frankendom.fighter.v1')!).loot.taken['veteran.Helmet'].recordId, 'd41y0k1d', 'the take that was pressed carries the link; a later fight cannot take it away');
  } finally { shareModule.mintShare = mintShare; matchModule.Match = Match; apiModule.api = null; session.db = null; session.userId = null; }
});
test('loot claims: a signed-in ladder win is claimed at the kill and Share waits for its post; Leave it makes the claim final and posts it; a guest\'s win shares at once and claims nothing', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  // Nothing in this harness can beat the warden (see the endgame test above), so the career fight's end is reported as a win.
  const Match = matchModule.Match;
  matchModule.Match = class extends match.Match { override end(afk: boolean) { const ended = super.end(afk); return ended.rewarded ? { ...ended, won: true } : ended; } };
  const inserts: Record<string, unknown>[] = [];
  // index.html ships Share hidden; this harness's elements start visible, so each page starts from the markup's state.
  const fight = () => { const a = boot(); a.element('share-link').hidden = true; a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick(); assert.ok(a.rendered.finish, 'the fight ends'); return a; };
  const outbox = (a: ReturnType<typeof boot>) => JSON.parse(a.storage.getItem('frankendom.claims.v1') ?? '[]') as { userId: string; opponent: string; record: string; piece: string | null; final: boolean }[];
  // The server: 4 verified marks, and once the claim is posted the sweep has not reached it yet, so my_standing() carries it in pending.
  // At the re-read (between the post and the redraw) the claim must already be out of the outbox and the rank not yet redrawn: in both
  // halves it is counted exactly once — the outbox before, pending after — never twice and never zero times (Lead, 2026-09-26).
  const calls: string[] = [], atReread: { outbox: number; rank: string | undefined }[] = [];
  let page: ReturnType<typeof boot> | null = null;
  session.db = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-7' } } } }) },   // flushClaims posts only as the flushing account
    from: (table: string) => ({ insert: async (row: Record<string, unknown>) => { if (table !== 'loot_claims') return { error: null }; calls.push('insert'); inserts.push({ table, ...row }); return { error: null }; } }),   // fight_results (the Pit wall's mirror) is not a claim
    rpc: async (fn: string) => {
      calls.push(fn); atReread.push({ outbox: outbox(page!).length, rank: page!.element('rank').attributes.get('aria-label') });
      return { data: [{ marks: 4, owned: [], pending: inserts.length, pending_owned: [] }], error: null };
    },
  } as never;
  session.userId = 'user-7'; session.standing = { marks: 4, owned: [], pending: 0, pendingOwned: [] };
  try {
    const a = fight(); page = a;
    await settle(() => outbox(a).length === 1);
    const [entry] = outbox(a);
    await settle(() => a.element('rank').attributes.get('aria-label') === career.rankFor(5).label);
    assert.equal(a.element('rank').attributes.get('aria-label'), career.rankFor(5).label, 'at the kill: 4 verified + the outbox entry');
    assert.deepEqual([entry!.userId, entry!.opponent, entry!.piece, entry!.final], ['user-7', 'veteran', null, false], 'written at the kill, not final, tagged with the account that won');
    assert.equal(a.element('share-link').hidden, true, 'no Share before the claim is posted: the record hash is first-claimer-wins');
    assert.equal(inserts.length, 0, 'nothing posts before the player\'s last word on the loot');
    a.setFinishPhase({ settled: true, touring: false, age: 9, complete: true }); a.tick();
    assert.equal(a.element('loot-panel').attributes.get('data-on'), '1', 'the loot offer opens on the finisher latch');
    // The take card names the legend he just beat, not his class (Dom via Strategy 2026-09-28: "Mars's boots", not "the Centurion's boots").
    const title = a.element('loot-panel-name').textContent ?? '';
    assert.ok(legends.LEGENDS.veteran.some((l) => title.startsWith(`${l.name}'s `)), `the take card is "<legend>'s <piece>": ${title}`);
    assert.doesNotMatch(title, /^the Centurion's /);
    a.element('loot-decline').dispatchEvent(new Event('click'));
    await settle(() => inserts.length === 1 && !a.element('share-link').hidden);
    assert.deepEqual(inserts, [{ table: 'loot_claims', opponent: 'veteran', piece: null, record: entry!.record }], 'Leave it posts the claim with no piece, and never a user_id');
    assert.equal(a.element('share-link').hidden, false, 'Share shows once the post has answered');
    assert.deepEqual(outbox(a), [], 'an accepted claim leaves the outbox');
    assert.deepEqual(calls, ['insert', 'my_standing'], 'after a post the standing is read again before the rank redraws');
    assert.deepEqual(atReread, [{ outbox: 0, rank: career.rankFor(5).label }], 'during the re-read: out of the outbox, the rank still showing it — never a dip, never double');
    // Lead's blocker (2026-09-26): the rank right after the claim posts is the rank before the fight plus the kill, never a dip back.
    assert.equal(a.element('rank').attributes.get('aria-label'), career.rankFor(5).label);
  } finally { session.db = null; session.userId = null; session.standing = null; }
  try {
    const g = fight();
    assert.equal(g.element('share-link').hidden, false, 'a guest\'s win shares at once');
    await settle(() => !!g.element('debug').dataset.share);
    assert.deepEqual(outbox(g), [], 'a guest claims nothing'); assert.equal(inserts.length, 1);
  } finally { matchModule.Match = Match; }
});
// Lead + Strategy, 2026-09-27: only a Dev override that DIFFERS from the ladder's own value makes a fight practice (level 46 above
// all: never a claim). ?debug or open test tools alone never do, nor a pick of the rank's own level, or every debug-driven browser row
// would lose its loot. Each case's end is forced to a win, so the only thing standing between the kill and a claim is the override.
test('loot claims under ?debug: no Dev kit or a stored kit at the rank\'s own level claims the win; a stored level off the dial (46) claims nothing', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const Match = matchModule.Match;
  matchModule.Match = class extends match.Match { override end(afk: boolean) { return { ...super.end(afk), won: true }; } };
  const outbox = (a: ReturnType<typeof boot>) => JSON.parse(a.storage.getItem('frankendom.claims.v1') ?? '[]') as unknown[];
  session.db = { from: () => ({ insert: async () => ({ error: null }) }), rpc: async () => ({ data: [{ marks: 0, owned: [], pending: 0, pending_owned: [] }], error: null }) } as never;
  session.userId = 'user-7'; session.standing = { marks: 0, owned: [], pending: 0, pendingOwned: [] };
  try {
    // The live level pick is retired (Dom 2026-09-29); a Dev kit a release row seeds in the tab's storage is still read at boot.
    for (const [pickLevel, counts] of [[null, true], [1, true], [46, false]] as const) {
      const a = boot({}, undefined, pickLevel ? { 'session:frankendom.dev-kit': JSON.stringify({ level: pickLevel }) } : {}, '?debug');
      a.element('share-link').hidden = true;
      if (pickLevel) assert.equal(a.element('difficulty-select').value, String(pickLevel));
      assert.equal(a.element('dev-kit-line').hidden, counts, `pick ${pickLevel}: the panel line shows only for an override`);
      a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
      assert.ok(a.rendered.finish, 'the fight ends');
      await settle(() => outbox(a).length > 0 || !!a.element('debug').dataset.share);
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(outbox(a).length, counts ? 1 : 0, `pick ${pickLevel}: ${counts ? 'a signed-in win is claimed' : 'no loot_claims entry'}`);
    }
  } finally { matchModule.Match = Match; session.db = null; session.userId = null; session.standing = null; }
});
test('loot claims: a skill take claims the win with no piece once its Undo line is gone, and the rank shows the kill (Lead, 2026-09-26: skills stay device-only for beta)', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const Match = matchModule.Match;
  matchModule.Match = class extends match.Match { override end(afk: boolean) { const ended = super.end(afk); return ended.rewarded ? { ...ended, won: true } : ended; } };
  const inserts: Record<string, unknown>[] = [];
  session.db = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-7' } } } }) },
    from: (table: string) => ({ insert: async (row: Record<string, unknown>) => { if (table === 'loot_claims') inserts.push(row); return { error: null }; } }),
    rpc: async () => ({ data: [{ marks: 4, owned: [], pending: inserts.length, pending_owned: [] }], error: null }),
  } as never;
  session.userId = 'user-7'; session.standing = { marks: 4, owned: [], pending: 0, pendingOwned: [] };
  try {
    const a = boot(undefined, undefined, {}, '?opponent=witch'); a.element('share-link').hidden = true;
    a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
    assert.ok(a.rendered.finish, 'the fight ends');
    await settle(() => (a.storage.getItem('frankendom.claims.v1') ?? '[]') !== '[]');
    a.setFinishPhase({ settled: true, touring: false, age: 9, complete: true });
    for (let i = 0; i < 40; i++) a.tick();   // past the panel's tap guard
    const tile = a.element('loot-panel-pieces').children.find((li) => li.attributes.get('data-loot') === 'witchfire')!.children[0]!;   // her move, offered beside her armour (last since E2)
    const before = new Set(a.timers.keys());
    tile.dispatchEvent(new Event('click'));
    assert.equal(JSON.parse(a.storage.getItem('frankendom.fighter.v1')!).loot.skill, 'witchfire', 'the tile taken is her move');
    assert.equal(inserts.length, 0, 'inside the Undo line nothing is posted');
    for (const [id, callback] of a.timers) if (!before.has(id)) { a.timers.delete(id); callback(); }   // the Undo line runs out
    await settle(() => inserts.length === 1 && !a.element('share-link').hidden);
    assert.deepEqual(inserts.map((row) => [row.opponent, row.piece]), [['witch', null]], 'the win is claimed; a move is not a loot_claims piece');
    assert.equal(a.element('rank').attributes.get('aria-label'), career.rankFor(5).label, 'the rank shows the kill: 4 + 1 pending');
  } finally { matchModule.Match = Match; session.db = null; session.userId = null; session.standing = null; }
});
test('a signed-in boot fights at the level the HUD shows: a cached standing of 10 over a device count of 0 builds the Match at level 11 (Lead 2026-09-27)', () => {
  const Match = matchModule.Match, levels: number[] = [];
  matchModule.Match = class extends match.Match { constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); levels.push(this.level); } };
  try {
    const cached = boot(undefined, undefined, { 'frankendom.standing.v1': JSON.stringify({ userId: 'user-7', standing: { marks: 10, owned: [], pending: 0, pendingOwned: [] } }) });
    const guest = boot();
    assert.deepEqual(levels, [11, 1], 'levelOf(10) on the cached standing; a device with no cache fights on its own count');
    assert.equal(cached.element('rank').attributes.get('aria-label'), career.rankFor(10).label, 'the HUD shows the same figure');
    assert.equal(guest.element('rank').attributes.get('aria-label'), career.rankFor(0).label);
  } finally { matchModule.Match = Match; }
});
test('a standing that arrives mid-page reaches the next fight: the rematch is fought at levelOf(server marks) (Lead 2026-09-27, condition 2)', () => {
  const Match = matchModule.Match, built: InstanceType<typeof match.Match>[] = [];
  matchModule.Match = class extends match.Match { constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); built.push(this); } };
  try {
    // Every ladder opponent has rank looks now (the Executioner last, 2026-09-29), and a rank-up that changes his look file reloads to stream
    // it. So the standing lands inside the device's own rung (10 and 14 marks: both Gladiator, one look file) and the rematch reuses the Match.
    const a = boot({ id: 'tester-0001', ladder: 'executioner', career: { victoryMarks: 10 } });
    assert.equal(built[0]!.level, 11, 'no cache for this account: the first fight is on the device count');
    session.userId = 'user-7'; session.standing = { marks: 14, owned: [], pending: 0, pendingOwned: [] };   // account.ts: the standing arrives
    a.window.dispatchEvent(new Event('frankendom:standing'));
    a.element('reset-button').click(); a.tick();
    assert.equal(built.length, 1, 'a rematch reuses the Match');
    assert.equal(built[0]!.level, 15, 'the rematch is fought at the level the HUD now shows');
    assert.equal(a.element('rank').attributes.get('aria-label'), career.rankFor(14).label);
  } finally { matchModule.Match = Match; session.userId = null; session.standing = null; }
});
test('two losses, then the standing arrives mid-page: the rematch fights at the dial over the server rank, floored at DIAL_TRAIL (Lead 2026-09-27)', () => {
  const Match = matchModule.Match, built: InstanceType<typeof match.Match>[] = [];
  matchModule.Match = class extends match.Match { constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); built.push(this); } };
  let dial: ReturnType<typeof career.turnDial> | undefined;
  for (let i = 0; i < 4; i++) dial = career.turnDial(dial, 11, false);   // four losses at the device's rank 11: dial 9
  try {
    const a = boot({ id: 'tester-0001', ladder: 'executioner', career: { victoryMarks: 10 }, dial });   // one rung, no reload: see above
    assert.equal(built[0]!.level, 9);
    session.userId = 'user-7'; session.standing = { marks: 14, owned: [], pending: 0, pendingOwned: [] };
    a.window.dispatchEvent(new Event('frankendom:standing'));
    a.element('reset-button').click(); a.tick();
    assert.equal(built[0]!.level, career.fightLevel(dial, 14), 'the dial, not the bare rank');
    assert.equal(built[0]!.level, 15 - career.DIAL_TRAIL, 'dial 9 is below the trail: the floor, rank 15 − 5');
  } finally { matchModule.Match = Match; session.userId = null; session.standing = null; }
});
// The path the two tests above moved off (Lead, #1115): a standing that lands on a rung with ANOTHER look file takes a fresh page, which
// streams that file (#961), instead of a rematch in the old look.
test('a standing that arrives mid-page onto a rung with another look file reloads: the Executioner, Recruit on the device, Gladiator from the server, streams L3 fresh', async () => {
  const Match = matchModule.Match, built: InstanceType<typeof match.Match>[] = [];
  matchModule.Match = class extends match.Match { constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); built.push(this); } };
  try {
    const a = boot({ id: 'tester-0001', ladder: 'executioner' });
    assert.equal(built[0]!.level, 1, 'the device count: Recruit, his rig as shipped');
    assert.equal(rankLook.rankLookFor('executioner', grades.levelOf(grades.tierAt(10))), '/looks/executioner-L3.glb', '10 marks: Gladiator, his L3 file');
    session.userId = 'user-7'; session.standing = { marks: 10, owned: [], pending: 0, pendingOwned: [] };
    a.window.dispatchEvent(new Event('frankendom:standing'));
    a.element('reset-button').click(); a.tick();
    await new Promise(r => setImmediate(r));
    assert.equal(a.reloads, 1, 'a fresh page streams the new look file');
    assert.deepEqual([built.length, built[0]!.level], [1, 1], 'no rematch is fought in the old look');
    assert.deepEqual(a.errors, []);
  } finally { matchModule.Match = Match; session.userId = null; session.standing = null; }
});
test('kill links: an unknown or expired id lands on a plain page with the fight button under it, not an error', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const fetchSharedRecord = shareModule.fetchSharedRecord;
  shareModule.fetchSharedRecord = async () => { throw Error('no such fight'); }; apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
  try {
    const s = boot({}, undefined, {}, '?r=Ab3_-9xZ');
    assert.equal(s.element('welcome').hidden, true, 'the link is picked up at boot');
    await settle(() => !s.element('welcome').hidden);
    assert.equal(s.element('welcome').hidden, false, `the welcome (with its fight button) comes back; banner=${s.element('replay-banner').textContent}`);
    assert.equal(s.element('welcome-eyebrow').textContent, 'THIS FIGHT HAS FADED'); assert.equal(s.element('welcome-title').textContent, 'Sign in and your kills are kept forever.');
    assert.equal(s.element('welcome-lead').hidden, true); assert.equal(s.element('replay-banner').hidden, true, 'no error banner');
  } finally { shareModule.fetchSharedRecord = fetchSharedRecord; apiModule.api = null; }
});
test('kill links: a retired record version converts — the warden\'s still, who fell to what, and PLAY NOW against that warden (Dom 2026-09-24)', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const rec = record.createRecorder({ weapon: 'knife', build: 'dev', opponent: 'nightborn', level: 18, seed: 5 });
  for (let i = 0; i < 30; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const fight = rec.finish('killed');
  // A pre-12 header has no skill byte, nor the specials byte after it (v21): drop both from this build's packing (they sit after the weapon string).
  const legacy = (b: Uint8Array) => { let o = 3; for (let k = 0; k < 3; k++) o += 1 + b[o]; return new Uint8Array([...b.subarray(0, o), ...b.subarray(o + 2)]); };
  const retired = async (outcome: record.Outcome, v: number) => {
    const bytes = legacy(record.packRecord({ ...fight, outcome })); bytes[2] = v;   // the same bytes under a version this build no longer reads
    const gz = new Uint8Array(await new Response(new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    return record.toBase64Url(gz);
  };
  const killed = await retired('killed', 4);
  await assert.rejects(record.decodeRecord(killed), /version 4 is not supported/, 'the fixture really is a refused version');
  assert.deepEqual(await peekRecordHeader(killed), { v: 4, build: 'dev', opponent: 'nightborn', weapon: 'knife', outcome: 'killed' });
  assert.equal(await peekRecordHeader('not-a-record'), null);
  const s = boot({}, undefined, {}, `?opponent=nightborn&replay=${killed}`);
  await settle(() => /Your turn/.test(s.element('replay-banner').textContent));
  assert.equal(s.element('replay-still').hidden, false, `the warden's still shows; banner=${s.element('replay-banner').textContent}`);
  assert.equal((s.element('replay-still') as unknown as HTMLImageElement).src, '/game/img/nightborn.webp'); assert.equal((s.element('replay-still') as unknown as HTMLImageElement).alt, 'The Nightborn');
  assert.equal(s.element('replay-banner').textContent, 'The Nightborn fell to a knife. Your turn.'); assert.equal(s.element('replay-banner').dataset.stale, '1');
  assert.equal(s.element('welcome').hidden, true, 'no name form: a viewer needs no name');
  assert.equal(s.element('reset-button').hidden, false); assert.equal(s.element('reset-button').dataset.play, '1', 'PLAY NOW under it');
  s.tick(); assert.equal(s.storage.getItem('frankendom.fight.v1'), null, 'a retired link is not an abandoned fight');
  s.element('reset-button').dispatchEvent(new Event('click'));
  assert.equal(s.element('replay-still').hidden, true, 'the still goes with the fight'); assert.equal(s.element('replay-banner').hidden, true);
  assert.equal(s.replaced.length, 0, 'the page already runs the Nightborn: PLAY NOW fights them here');
  const v = boot({}, undefined, {}, `?replay=${killed}`);   // booted on this device's rung (the Veteran): re-opened once on the record's warden
  await settle(() => v.replaced.length > 0);
  assert.equal(v.replaced.length, 1); assert.match(v.replaced[0], /opponent=nightborn/);
  const d = boot({}, undefined, {}, `?opponent=nightborn&replay=${await retired('died', 3)}`);
  await settle(() => /Your turn/.test(d.element('replay-banner').textContent));
  assert.equal(d.element('replay-banner').textContent, 'The Nightborn won, against a knife. Your turn.');
  const odd = legacy(record.packRecord({ ...fight, weapon: 'banana' as never })); odd[2] = 4;   // a crafted header: the page names only what the game knows
  const oddText = record.toBase64Url(new Uint8Array(await new Response(new Blob([new Uint8Array(odd)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  const u = boot({}, undefined, {}, `?opponent=nightborn&replay=${oddText}`);
  await settle(() => u.element('replay-banner').textContent === 'Recorded on an older build');
  assert.equal(u.element('replay-banner').textContent, 'Recorded on an older build'); assert.equal(u.element('welcome').hidden, true);
});
// A ?tier= pinned tab (grades.ts tierPin, Strategy 2026-09-28) says so on the fight rank row; the account panel keeps his real rank.
test('?tier= pin: the fight rank row reads "<Rank> · test look" while the tab is pinned, and the career row otherwise', () => {
  const pinned = boot({}, undefined, {}, '?opponent=plaguedoctor&tier=legionary');
  const row = rankRow(pinned.element('fight-rank'));
  assert.equal(row.now, 'Legionary · test look');
  assert.equal(row.label, 'Legionary · test look');
  assert.notEqual(rankRow(pinned.element('rank')).now, 'Legionary · test look', 'the account panel shows his career rank');
  const plain = boot({}, undefined, {}, '?opponent=plaguedoctor');
  assert.doesNotMatch(String(rankRow(plain.element('fight-rank')).now), /test look/);
  assert.deepEqual(rankRow(plain.element('fight-rank')), rankRow(plain.element('rank')), 'no pin: the career row as before');
  assert.deepEqual([...pinned.errors, ...plain.errors], []);
});
// The player's weapon wears his own rung (Strategy 2026-09-28): the career rank the HUD shows; a ?tier= pin dresses the opponent only.
test('the player\'s weapon takes his own rung; a ?tier= pin moves the opponent\'s, never his', () => {
  const pinned = boot({}, undefined, {}, '?opponent=plaguedoctor&tier=origin'), plain = boot({}, undefined, {}, '?opponent=plaguedoctor');
  assert.equal(plain.tiers.player, plain.tiers.opponent, 'unpinned: both at the career rung');
  assert.equal(pinned.tiers.opponent, 'Origin');
  assert.equal(pinned.tiers.player, plain.tiers.player, 'the pin leaves his own weapon at his own rung');
  assert.notEqual(pinned.tiers.player, 'Origin');
  assert.deepEqual([...pinned.errors, ...plain.errors], []);
});
test('fight end: the rank line replaces the death-screen autopsy on a loss, the autopsy lines go under the opponent\'s journal row, and a rematch keeps the rank row', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the idle fighter dies'); assert.equal(app.rendered.finish.victim, 0);
  const el = app.element('fight-rank');
  assert.equal(el.hidden, false, 'the rank line shows on the death screen');
  assert.deepEqual(rankRow(el), rankRow(app.element('rank')), 'the account panel\'s component, no save text');
  // Dom 2026-09-25 ("better without"): rank + pips + next rank only, no player name leading the row.
  const kids = (el as unknown as Node).children;
  assert.equal(kids.length, (app.element('rank') as unknown as Node).children.length, 'exactly the account panel\'s children: nothing added');
  assert.ok(kids.every((c) => c.className !== 'rank-name'), 'no player name in the fight rank row');
  assert.equal(rankRow(el).next, 'Legionary', 'the next class at the right end of the bar');
  const lines = JSON.parse(app.storage.getItem('frankendom.scorecard.v1')!).rows.veteran.last;
  assert.ok(lines.length >= 1 && lines.length <= 2, `one or two lines, got ${lines.length}`);
  if (app.rendered.finish.move === 'skill_shove') assert.equal(lines[0], `The Scutum Shove landed on your ${app.rendered.finish.location}.`);
  else assert.match(lines[0], /^(Your posture broke|Your guard broke|You were out of stamina|The (cut|heavy|thrust|kick|riposte|counter|critical) landed on your (head|torso|legs)\.)/, lines[0]);
  for (const line of lines) assert.ok(!/[!?]/.test(line), 'no exclamation marks');
  app.element('reset-button').dispatchEvent(new Event('click')); app.tick();
  assert.equal(el.hidden, false, 'the rank row is permanent: a rematch keeps it (Dom 2026-09-24)');
});
// (Daily removed, Dom 2026-09-29: the two daily-warden tests went with the mode.)
test('account: every persist of the fighter fires the profile beat the account listens to for its automatic cloud save', () => {
  const app = boot(); let beats = 0; app.window.addEventListener('frankendom:profile', () => { beats++; });
  (app.element('fighter-name') as unknown as { value: string }).value = 'Aldren';
  app.element('name-form').dispatchEvent(new Event('submit', { cancelable: true }));   // the name form persists, like a won fight or a journal pick
  assert.equal(beats, 1, 'persist() fires the beat once');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).name, 'Aldren', 'and the fighter is saved on the device first');
});
test('an AFK fight runs on: hidden time is simulated on return with no input, and a fight abandoned by closing the page is a loss on the card', () => {
  const app = boot({ id: 'tester-0001' }); app.tick(); app.key('KeyF'); app.tick();
  for (let i = 0; i < 60; i++) app.tick();
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fight.v1')!).opponent, 'veteran', 'a live fight is marked');
  assert.equal(app.rendered.finish, null);
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  assert.equal(app.rendered.finish, null, 'nothing runs while hidden');
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick();
  const back = app.rendered;   // a fresh reference: assert.equal(…, null) above narrowed app.rendered.finish to null for the checker
  assert.equal(back.finish?.victim, 0, 'the idle fighter is dead when the player comes back');
  assert.equal(app.storage.getItem('frankendom.fight.v1'), '', 'a decided fight is no longer marked');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.fights, 1);
  const { last, ...walkAway } = JSON.parse(app.storage.getItem('frankendom.scorecard.v1')!).rows.veteran; assert.deepEqual(walkAway, { fights: 1, wins: 0, losses: 1, left: 1 }, 'the scorecard shows the walk-away as a loss, flagged left'); assert.ok(Array.isArray(last) && last.length >= 1, 'the walk-away death still has its autopsy');
  const again = boot({ id: 'tester-0001' }, undefined, { 'frankendom.fight.v1': JSON.stringify({ opponent: 'goblin' }) });
  const card = JSON.parse(again.storage.getItem('frankendom.controls.v1')!).card;
  assert.deepEqual([card.fights, card.wins], [1, 0], 'closing the page mid-fight scored a loss at the next boot');
  assert.deepEqual(JSON.parse(again.storage.getItem('frankendom.scorecard.v1')!).rows.goblin, { fights: 1, wins: 0, losses: 1, left: 1, last: [] }, 'and on the scorecard against the opponent it was');
  assert.equal(again.storage.getItem('frankendom.fight.v1'), '');
  again.element('journal-button').click();
  const rows = again.element('scorecard-table').children.map(tr => tr.children.map(c => (c.children.length ? c.children.at(-1)!.textContent : c.textContent)));   // the opponent cell's class: the small line under a legend's name, else the name span
  assert.deepEqual(rows[0], ['Opponent', 'Fights', 'Wins', 'Losses']);
  assert.deepEqual(rows.find(r => r[0] === 'the Goblin'), ['the Goblin', '1', '0', '1 (1 left)']);
  assert.deepEqual(rows.at(-1), ['All fights', '1', '0', '1 (1 left)']);
});

// GPT audit of e65a6d8 (2026-09-30, F4): the owed-time rule used fightLive() (welcome hidden, journal closed, no finish), which is true
// for a returning player the whole time the fight waits behind the loading card, so 30 s hidden during the download owed 30 s of fight
// (1,800 ticks) the moment the rigs came in. The rule is fightPlayable(): rigs in, versus card gone, graphics up — the ?perf sampler's.
test('a failed versus still never starts an unready fight or accrues loading time; ready fighters resume normally', () => {
  const app = boot();
  app.report('Loading warriors…', 'loading');
  app.element('versus-portrait').dispatchEvent(new Event('error'));
  app.element('versus-still').dispatchEvent(new Event('load'));
  app.tick();
  assert.equal(app.element('versus').hidden, false, 'the loading card is up');
  const before = app.rendered.duel.tick;
  app.element('versus-still').dispatchEvent(new Event('error'));
  assert.equal(app.element('versus').hidden, true, 'the failed still is dismissed');
  app.key('KeyF');
  for (let i = 0; i < 120; i++) app.tick();
  assert.equal(app.rendered.duel.tick, before, 'dismissing the card does not run an unseen fight');
  assert.equal(app.storage.getItem('frankendom.fight.v1'), null, 'an unready fight is never marked abandoned');
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick();
  assert.equal(app.rendered.duel.tick, before, 'returning while still loading runs no fight');
  app.report('', 'ready'); app.tick();
  assert.ok(app.rendered.duel.tick > before && app.rendered.duel.tick - before <= 2, 'ready resumes with one frame, no loading/background catch-up');
  app.element('versus-still').dispatchEvent(new Event('error'));
  const ready = app.rendered.duel.tick;
  for (let i = 0; i < 120; i++) app.tick();
  assert.ok(app.rendered.duel.tick - ready >= 120 && app.rendered.duel.tick - ready <= 123, 'a late still failure leaves the ready fight advancing at normal time');
  assert.deepEqual(app.errors, []);
});

test('F4: time hidden while the rigs are still loading is not owed to the fight; hidden once playable it is', () => {
  const app = boot({ id: 'tester-0001' }); app.tick(); app.key('KeyF'); app.tick();
  for (let i = 0; i < 60; i++) app.tick();
  assert.equal(app.rendered.finish, null);
  app.report('Loading warriors…', 'loading');   // the harness boots with the rigs in: back into the download, the fight live but not playable
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.report('', 'ready'); app.tick();
  assert.equal(app.rendered.finish, null, 'a player who waited out the download owes the fight nothing: nobody died while he was away');
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick();
  const back = app.rendered;   // a fresh reference: the null assertion above narrowed finish to never
  assert.equal(back.finish?.victim, 0, 'hidden once playable, the absence is owed and the idle fighter is dead');
});

// Lead's hold on #1210: a phone that backgrounds the tab often loses the WebGL context, and webglcontextrestored arrives after the
// visibilitychange. Read at return, fightPlayable() is false (graphicsLost) and the debt is dropped. So playability is read at HIDE.
test('F4: a fight playable at hide is still owed its absence when the context was lost while away and restored after the return', () => {
  const app = boot({ id: 'tester-0001' }); app.tick(); app.key('KeyF'); app.tick();
  for (let i = 0; i < 60; i++) app.tick();
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.lose();
  app.tick(120000);
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.rendered.finish, null, 'graphics still lost: nothing runs yet');
  app.restore(); app.tick();
  const back = app.rendered;   // a fresh reference, as above
  assert.equal(back.finish?.victim, 0, 'the restored fight owes the absence: the idle fighter is dead');
});

// Lead 2026-10-01 (#1116, on top of F4): a live duel has no catch-up. The peer is waiting on every tick, so a hidden spell was silence to
// it (src/net/pvp.ts SILENCE), never fight time owed to this page. The same hidden spell on a solo match still runs on (F4, above).
test('a pvp match owes nothing after a hidden spell, and a solo match still does', () => {
  const hide = (app: ReturnType<typeof boot>, hidden: boolean) => { (app.document as unknown as { hidden: boolean }).hidden = hidden; app.document.dispatchEvent(new Event('visibilitychange')); };
  const Match = matchModule.Match;
  const made: match.Match[] = [];
  matchModule.Match = class extends match.Match { constructor(...args: ConstructorParameters<typeof match.Match>) { super(...args); made.push(this); } };
  try {
    const duel = boot({ id: 'tester-0001' }); duel.tick(); duel.key('KeyF'); duel.tick();
    for (let i = 0; i < 60; i++) duel.tick();
    let frames = 0;
    const live = made.at(-1)!;
    live.startPvp({ frame: () => { frames++; return live.practice; }, get practice() { return live.practice; }, settled: false });   // a driver that never advances: only the number of steps asked of it is observed
    hide(duel, true); duel.tick(120000); hide(duel, false);
    frames = 0; duel.tick();
    assert.ok(frames <= 2, `a hidden duel steps only the frame it is on, not the ${120 * 60} ticks it missed (stepped ${frames})`);
    assert.equal(duel.rendered.finish, null, 'and nobody died while this page was away');
    const solo = boot({ id: 'tester-0001' }); solo.tick(); solo.key('KeyF'); solo.tick();
    for (let i = 0; i < 60; i++) solo.tick();
    hide(solo, true); solo.tick(120000); hide(solo, false); solo.tick();
    const back = solo.rendered;   // a fresh reference, as in the F4 tests
    assert.equal(back.finish?.victim, 0, 'the same absence on a solo match is still owed: the idle fighter is dead');
  } finally { matchModule.Match = Match; }
});

// Strategy 2026-10-01 (Option A): in a `?duel=` page only, the rigs wait for the peer's kit and the peer is drawn on the hero's rig. The scene
// gets that kit as one more argument; a page without `?duel=` passes nothing, so the fight it boots is the fight it always was.
test('hero-rig peer: a normal boot gives the scene no peer kit; a ?duel= boot gives it a promise the lobby settles with the handshake kit', async () => {
  const normal = boot({ id: 'tester-0001' });
  assert.equal(normal.sceneRest.length, 2, 'the opponent level, and nothing after it');
  assert.equal(normal.sceneRest[1], undefined, 'no peer kit on a normal page');
  assert.equal(normal.duelPage, undefined, 'and the lobby is never loaded');
  for (const search of ['?opponent=goblin', '?debug', '?arena=3b']) {
    const page = boot({ id: 'tester-0001' }, undefined, {}, search);
    assert.equal(page.sceneRest[1], undefined, `${search}: still no peer kit`); assert.equal(page.duelPage, undefined);
  }
  const duel = boot({ id: 'tester-0001' }, undefined, {}, '?duel=new');
  const kit = duel.sceneRest[1] as Promise<unknown> | undefined;
  assert.equal(typeof kit?.then, 'function', 'a duel page hands the scene a promise for the peer kit');
  let got: unknown = 'pending'; void kit!.then((k) => { got = k; });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(duel.duelPage?.param, 'new'); assert.equal(got, 'pending', 'the rigs wait: nothing resolves it before the handshake');
  duel.duelPage!.page.peerKit({ weapon: 'estoc', gear: ['veteran.Helmet'] });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(got, { weapon: 'estoc', gear: ['veteran.Helmet'] }, 'the lobby gives the scene the peer\'s agreed kit');
  const ended = boot({ id: 'tester-0001' }, undefined, {}, '?duel=new'); let endedGot: unknown = 'pending'; void (ended.sceneRest[1] as Promise<unknown>).then((k) => { endedGot = k; });
  await new Promise((r) => setTimeout(r, 20)); ended.duelPage!.page.peerKit(null); await new Promise((r) => setTimeout(r, 5));
  assert.equal(endedGot, null, 'a duel that ended first lets the page load its ordinary rigs');
});

// Strategy 2026-10-01: the challenger's wait. A bare loading card for minutes reads as broken, so the page says what is happening, shows the
// link again with a Copy button, and offers Cancel (back to the ordinary game: the same page with no ?duel=). The guest arriving takes it away.
test('challenger wait: the link panel shows with the link, Cancel leaves for the plain page, and the guest arriving hides it', async () => {
  const wait = boot({ id: 'tester-0001' }, undefined, {}, '?duel=new');
  await new Promise((r) => setTimeout(r, 20));
  const link = 'https://frankendom.com/?duel=abcdefghij0123456789.1.1790000000000.sig';
  wait.duelPage!.page.link(link);
  assert.equal(wait.element('duel-wait').hidden, false);
  assert.equal(wait.element('duel-link').value, link, 'the link is there to copy');
  wait.element('duel-cancel').click();
  assert.deepEqual(wait.replaced, ['/'], 'Cancel goes to the same page with no ?duel= (the harness page is at the root)');
  const arrived = boot({ id: 'tester-0001' }, undefined, {}, '?duel=new');
  await new Promise((r) => setTimeout(r, 20));
  arrived.duelPage!.page.link(link); arrived.duelPage!.page.peerKit({ weapon: 'estoc' });
  assert.equal(arrived.element('duel-wait').hidden, true, 'the guest is here: the panel goes');
});

// GPT audit of e65a6d8 (2026-09-30, F6): the Pit's gate left by pressing the kill screen's button (resetButton.click()), tying the leave
// to a DOM element the HUD owns. It now runs the next-fight command itself. The harness boots with ?debug, so __pit.open() reaches
// pitStage() and the gate; the button's click is made to throw here, so a leave that still went through the button fails the test.
test('F6: the Pit gate leaves by the next-fight command, not by pressing the kill screen button', async () => {
  const app = boot({ id: 'tester-0001' }, undefined, {}, '?debug'); app.tick(); app.key('KeyF'); app.tick();   // ?debug: the __pit handle (main.ts) reaches pitStage() and its gate
  for (let i = 0; i < 60; i++) app.tick();
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick();   // the walk-away death (the AFK test above): a decided fight, the kill screen up
  assert.ok(app.rendered.finish, 'a decided fight: the kill screen is up');
  const fights = JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.fights;
  let stage: { gate(): { label: string; go(): void } } | undefined, left = 0;
  const openPit = pitCoordinator.openPit;
  pitCoordinator.openPit = (s: unknown) => { stage = s as typeof stage; return Promise.resolve({ frame() {}, leave() { left++; }, dispose() {}, ready: Promise.resolve() }); };
  try {
    await app.pit!.open('defeat');
    assert.ok(stage, 'the room got the page\'s stage');
    const button = app.element('reset-button'), gate = stage!.gate();
    assert.equal(gate.label, button.textContent, 'the gate wears the kill screen\'s label');
    button.click = () => { throw new Error('the gate pressed the kill screen button'); };   // the DOM path is closed: the command must run on its own
    gate.go(); app.tick();
    assert.equal(left, 1, 'the room was left');
    assert.ok(app.rendered.finish === null || app.reloads === 1, 'the next fight began (a rematch in place, or a fresh page for a new rung)');
    assert.equal(JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.fights, fights, 'leaving is not a fight');
  } finally { pitCoordinator.openPit = openPit; }
});

test('a failed rig load retries when the page returns to the foreground, when the network returns, and on a tap; never while loading or after success', () => {
  const app = boot(); app.tick();
  const status = app.element('art-status');
  app.document.dispatchEvent(new Event('visibilitychange')); status.dispatchEvent(new Event('click')); app.window.dispatchEvent(new Event('online'));
  assert.equal(app.retries, 0, 'rigs are in: nothing to retry');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed'); app.tick();
  assert.equal(status.dataset.retry, 'true', 'the notice is a tap target only while failed');
  assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'true', 'controls stay disabled while the art is missing');
  status.dispatchEvent(new Event('click'));
  assert.equal(app.retries, 1, 'a tap retries');
  assert.equal(status.textContent, 'Loading warriors…'); assert.equal(status.dataset.retry, 'false', 'while loading the notice is not a tap target');
  status.dispatchEvent(new Event('click')); app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 1, 'no second retry while the load is running');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 1, 'going hidden does not retry');
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 2, 'coming back to the foreground retries');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  app.window.dispatchEvent(new Event('online'));
  assert.equal(app.retries, 3, 'the network returning retries');
  app.report('', 'ready'); app.tick();
  assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'false', 'the rigs landed: controls enable');
  status.dispatchEvent(new Event('click')); app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 3, 'after success nothing retries');
});

test('loot: the equipped set dresses the rig at boot, the journal shows the paperdoll and the rack, and Wear / Worn / Store change both', () => {
  const app = boot({ loot: { owned: ['veteran.Helmet', 'nightborn.Body'], equipped: { head: 'veteran.Helmet' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 3, healthLeft: 12, recordId: 'k7Qm2x_A', day: '2026-09-21' } } } });
  assert.deepEqual(app.worn, ['veteran.Helmet'], 'the scene is told the worn set at boot, before any fight');
  app.element('journal-button').click();
  const rack = () => app.element('loot-rack').children, row = (i: number) => rack()[i]!;
  assert.equal(rack().length, 5, 'five tiles, owned first, the rest empty');
  assert.equal(row(0).attributes.get('data-loot'), 'veteran.Helmet'); assert.equal(row(0).attributes.get('data-worn'), 'true'); assert.equal(row(0).attributes.get('tabindex'), '0');
  assert.deepEqual(row(0).children.map(c => c.textContent), ["the Centurion's helmet", '', 'Worn'], 'name, the caption (its text is in its children), the button');
  assert.deepEqual(row(0).children[1]!.children.map(c => c.textContent), ["The Centurion's helmet", ' · your 3rd attempt, 12 health left', ' ', 'Watch'], 'brief 9: the caption starts with the piece name in bold, the Watch link only once the fight is published');
  assert.equal(row(0).children[1]!.children[3]!.attributes.get('href'), 'https://frankendom.com/s/k7Qm2x_A', 'the Watch link is the one short shape (share-store shortLink): the loader refuses a record for another opponent than the page booted');
  assert.equal(row(1).attributes.get('data-worn'), 'false'); assert.equal(row(1).children.length, 2, 'no provenance, no caption'); assert.equal(row(1).children[1]!.textContent, 'Wear');
  assert.equal(row(2).className, 'rack-empty'); assert.equal(row(4).className, 'rack-empty');
  assert.equal(app.element('slot-head-name').textContent, "the Centurion's helmet"); assert.ok(app.element('slot-head').classList.contains('on')); assert.equal(app.element('slot-head-off').hidden, false);
  assert.equal(app.element('slot-chest-name').textContent, 'Empty'); assert.ok(!app.element('slot-chest').classList.contains('on')); assert.equal(app.element('slot-chest-off').hidden, true);
  assert.equal(app.element('slot-main-name').textContent, 'Longsword'); assert.ok(app.element('slot-main').classList.contains('on'));
  row(1).children[1]!.click();
  assert.deepEqual(app.worn, ['veteran.Helmet', 'nightborn.Body']); assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.equipped.chest, 'nightborn.Body', 'a Wear persists');
  assert.equal(row(1).children[1]!.textContent, 'Worn'); assert.equal(app.element('slot-chest-name').textContent, "the Nightborn's body");
  row(1).children[1]!.click();
  assert.deepEqual(app.worn, ['veteran.Helmet'], 'Worn taps off again'); assert.equal(app.element('slot-chest-name').textContent, 'Empty');
  app.element('slot-head-off').click();
  assert.deepEqual(app.worn, []); assert.equal(app.element('slot-head-name').textContent, 'Empty'); assert.equal(app.element('slot-head-off').hidden, true); assert.equal(row(0).attributes.get('data-worn'), 'false');
  assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.owned, ['veteran.Helmet', 'nightborn.Body'], 'nothing is lost by taking it off');
  // Store puts it in the pack under WORN (Dom's screenshot 2026-09-24: before the pack it vanished from the Profile tab), and Wear brings it back.
  const pack = () => app.element('pack').children;
  assert.equal(pack().length, 5, 'two open pack slots and three locked');
  assert.equal(pack()[0]!.attributes.get('data-loot'), 'veteran.Helmet', 'the stored helmet is in the first pack slot');
  assert.equal(pack()[2]!.className, 'pack-locked'); assert.equal(pack()[4]!.className, 'pack-locked');
  assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.pack, ['veteran.Helmet'], 'the pack persists');
  pack()[0]!.children[1]!.click();   // Fitting rail (2026-10-01): a stored row TRIES the piece on (in memory only); Wear this confirms
  assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.equipped, {}, 'trying a stored piece on does not wear it (the rig shows it in memory only)'); assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.pack, ['veteran.Helmet'], 'nor change the pack');
  app.element('fitting-wear').click();
  assert.deepEqual(app.worn, ['veteran.Helmet'], 'Wear this puts it back on'); assert.equal(pack()[0]!.className, 'pack-empty');
});

// Fitting rail (Strategy 2026-10-01): the sheet's app nav. The Pit is dimmed with no kill-screen door; a tap says why for 2 s instead of doing nothing.
test('gear sheet nav: The Pit is dimmed without the door, a tap shows the line', () => {
  const app = boot();
  app.element('journal-button').click();
  assert.equal(app.element('nav-pit').attributes.get('aria-disabled'), 'true');
  app.element('nav-note').hidden = true;   // the harness's fake elements do not read index.html
  app.element('nav-pit').click();
  assert.equal(app.element('nav-note').hidden, false, 'a dimmed Pit tap says why');
});

// Dom 2026-09-28: after the versus card the opponent is the legend on every surface. A piece with a tier names the legend of that rung on
// the rack row, the paperdoll slot and the pack; the scorecard's big label is the legend waiting there, the class small under it.
test('legends: a piece taken at a rung names its legend on the rack, the paperdoll and the pack; the scorecard label is the legend waiting', () => {
  const app = boot({ loot: { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 1, healthLeft: 40, recordId: null, tier: 5, day: '2026-09-27' } } } });
  app.element('journal-button').click();
  const mine = `${legends.legendAt('veteran', 5).name}'s helmet`;
  assert.equal(app.element('loot-rack').children[0]!.children[0]!.textContent, mine, 'the rack row: the tier-5 legend, not "the Centurion\'s helmet"');
  assert.equal(app.element('loot-rack').children[0]!.children[1]!.children[0]!.textContent, `From ${legends.legendAt('veteran', 5).name}`, 'veteran tier 5: the rung legend from legends.ts, not the piece name');
  assert.equal(app.element('slot-head-name').textContent, mine, 'the paperdoll slot');
  app.element('slot-head-off').click();   // Store: into the pack
  assert.equal(app.element('pack').children[0]!.children[0]!.children[0]!.textContent, mine, 'the pack row');
  const cells = app.element('scorecard-table').children.slice(1, -1).map(tr => tr.children[0]!.children);   // the opponent rows (not the header, not All fights)
  const centurion = cells.find(kids => kids[1]?.textContent === 'the Centurion')!;
  assert.ok(centurion, 'a legend opponent\'s class sits small under the label');
  assert.equal(centurion[0]!.textContent, legends.legendForLevel('veteran', 1).name, 'the label is the legend a fresh fighter meets next (level 1)');
  assert.equal(centurion[1]!.attributes.get('data-class'), '');
  assert.ok(cells.every(kids => !/ waits$/.test(kids.at(-1)!.textContent)), 'no "<legend> waits" line any more');
});

test('a weapon equipped in the journal reaches the next career fight: the rematch reloads the page so the simulation, the record and the rig all boot on it; no swap, no reload (audit 2026-09-25, B)', () => {
  const app = boot({ loot: { owned: ['goblin.Knife'], equipped: {} } }); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();   // a strike opens the fight, as the kill-link test does
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the first fight ends'); assert.equal(app.rendered.duel.fighters[0].weapon, 'longsword', 'fought on the longsword the page booted with');
  app.element('journal-button').click();
  app.element('loot-rack').children[0]!.children[1]!.click();   // Wear the knife
  assert.deepEqual(app.worn, ['goblin.Knife'], 'the rig is told at once'); assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.equipped.main, 'goblin.Knife');
  app.element('journal-button').click();
  app.element('reset-button').click();
  assert.equal(app.reloads, 1, 'the rematch takes the fresh-page path: the next fight boots on the knife (the boot tests pin that the sim, the record and the rig agree)');
  const same = boot({ loot: { owned: ['goblin.Knife'], equipped: { main: 'goblin.Knife' } } }); same.tick(); same.key('KeyF'); for (let i = 0; i < 45; i++) same.tick();   // a strike opens the fight, as the kill-link test does
  for (let i = 0; i < 6000 && !same.rendered.finish; i++) same.tick();
  same.element('reset-button').click(); same.tick();
  assert.equal(same.reloads, 0, 'no weapon change, no reload'); assert.equal(same.rendered.duel.fighters[0].weapon, 'knife', 'the rematch keeps the knife');
  assert.deepEqual(app.errors, []); assert.deepEqual(same.errors, []);
});

// A won fight in the harness: the warden's health is a live number the duel steps in place, so one strike on a warden at 1 ends it.
test('a take is provisional while Undo is up: the account hears nothing until the line expires, an undone take never reaches the cloud, a kept one does (audit 2026-09-25, A)', () => {
  const win = () => {
    const app = boot(), beats: string[][] = [];
    app.window.addEventListener('frankendom:profile', () => { beats.push(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot?.owned ?? []); });
    app.tick(); app.rendered.duel.fighters[1]!.health = 1;
    for (let i = 0; i < 3000 && !app.rendered.finish; i++) { if (i % 30 === 0) app.key('KeyF'); app.tick(); }
    assert.ok(app.rendered.finish, 'the fight ends'); assert.equal(app.rendered.duel.fighters[1]!.health, 0, 'the warden fell');
    app.setFinishPhase({ settled: true, touring: false, age: 9, complete: true, completeAt: 8 });
    for (let i = 0; i < 40; i++) app.tick();   // the offer comes once the finisher has played; 40 frames also clear the tiles' 300 ms tap guard
    assert.equal(app.element('loot-panel').attributes.get('data-on'), '1', 'the Take-one panel is up');
    const tile = app.element('loot-panel-pieces').children.find(li => li.attributes.get('data-owned') === 'false' && !loot.isSkillId(li.attributes.get('data-loot')))!, id = tile.attributes.get('data-loot')!;   // a piece, not the opponent's move (SCOPE 8: the Centurion now offers his Shove too)
    const owned = () => (JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot?.owned ?? []) as string[];
    const found = JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot ?? null;   // the ledger the take finds: since #1156 the win's skull (loot.ts defeats), no piece
    assert.deepEqual([found?.owned, found?.defeats?.length], [[], 1], 'the win wrote its skull before any take');
    tile.children[0]!.click();
    assert.ok(owned().includes(id), 'the device saves the take at once');
    assert.ok(!beats.some(o => o.includes(id)), 'the account has not been told: the take is provisional while Undo is up');
    assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.hold.v1')!), { loot: found }, 'the stored hold names the ledger the take found (the skull, no piece): what account.ts may upload meanwhile (recheck 2026-09-26, 1)');
    return { app, beats, id, owned };
  };
  const undone = win();
  undone.app.element('loot-undo').click();
  for (const timer of [...undone.app.timers.values()]) timer();   // the line's timer and anything else armed: nothing may send the undone take
  assert.ok(!undone.owned().includes(id(undone)), 'Undo put the ledger back');
  assert.equal(undone.app.storage.getItem('frankendom.fighter.hold.v1'), '', 'Undo released the stored hold');
  assert.ok(!undone.beats.some(o => o.includes(id(undone))), 'an undone take never reaches the cloud');
  assert.ok(undone.beats.length >= 1, 'the restore itself is a beat: a signed-in account still settles');
  const kept = win();
  for (const timer of [...kept.app.timers.values()]) timer();   // the Undo line expires
  assert.ok(kept.beats.some(o => o.includes(id(kept))), 'the take goes up once the window closes');
  assert.equal(kept.app.storage.getItem('frankendom.fighter.hold.v1'), '', 'the expired line released the stored hold too');
  assert.deepEqual(undone.app.errors, []); assert.deepEqual(kept.app.errors, []);
  function id(w: { id: string }) { return w.id; }
});

// Dom 2026-09-28 (Strategy's addition): every take records the rung it was won at, so an owned piece always names its legend and the
// class fallback (loot.ts ownedName) only fires on legacy records; and the Next button names the legend the next page meets.
test('a take records its rung (taken[id].tier) and the Next button names the next opponent\'s legend', () => {
  const app = boot();
  app.tick(); app.rendered.duel.fighters[1]!.health = 1;
  for (let i = 0; i < 3000 && !app.rendered.finish; i++) { if (i % 30 === 0) app.key('KeyF'); app.tick(); }
  assert.ok(app.rendered.finish && app.rendered.duel.fighters[1]!.health === 0, 'the warden fell');
  app.setFinishPhase({ settled: true, touring: false, age: 9, complete: true, completeAt: 8 });
  for (let i = 0; i < 40; i++) app.tick();
  const tile = app.element('loot-panel-pieces').children.find(li => li.attributes.get('data-owned') === 'false' && !loot.isSkillId(li.attributes.get('data-loot')))!, id = tile.attributes.get('data-loot')!;
  tile.children[0]!.click();
  const saved = () => JSON.parse(app.storage.getItem('frankendom.fighter.v1')!);
  assert.equal(saved().loot.taken[id].tier, 1, 'a fresh fighter\'s win is taken at rung 1 (Recruit): the tier is written with the take');
  for (let i = 0; i < 3; i++) app.tick();
  const label = app.element('reset-button').textContent;
  app.element('reset-button').click();   // Next: the pick is stored before the page reloads
  const next = saved().encounter;
  assert.ok(legends.isLegendOpponent(next), `the next rung (${next}) is on the legend roster`);
  assert.equal(label, `Next: ${legends.legendAt(next, 1).name}`, 'the legend the next page meets (one win: still Recruit, rung 1), not "Next: the <class>"');
  assert.deepEqual(app.errors, []);
});

// Dom 2026-09-29 (admin, Origin career): Options -> level 6 named the Knight's level-6 legend (Bedivere) but dressed him in the gold Origin
// look, and the Nightborn carried a gold estoc. The scene's tier (scene.ts setTier: the look file, his kit and his weapon's grade) now follows
// a Dev-kit level at the rung the versus card prints (tierAt(level - 1)); ?tier= still wins; a player (no Dev level) keeps his career rung.
test('a Dev-kit level dresses the opponent (look, kit, weapon grade) at that level\'s rung; ?tier= wins; no Dev level keeps the career rung', () => {
  const origin = { career: { victoryMarks: 45 } }, kit6 = { 'session:frankendom.dev-kit': JSON.stringify({ level: 6 }) };
  for (const opp of ['knight', 'nightborn'] as const) {
    const player = boot(origin, undefined, {}, `?opponent=${opp}`);
    assert.equal(player.tier, 'Origin', `${opp}, no Dev level: his career rung, unchanged`);
    const dev = boot(origin, undefined, kit6, `?opponent=${opp}&debug`);
    assert.equal(dev.element('difficulty-select').value, '6', `${opp}: the kept Dev level boots the fight at 6`);
    assert.equal(dev.tier, grades.tierAt(5), `${opp} at level 6: dressed at the rung the versus card prints (${grades.tierAt(5)}), not Origin`);
    assert.equal(rankLook.rankLookFor(opp, grades.levelOf(dev.tier as never)), `/looks/${opp}-L2.glb`, `${opp} at level 6 streams his L2 look file`);
    dev.tick();
    assert.equal(dev.rendered.duel.fighters[1]!.weapon, moves.opponentAt(moves.OPPONENTS[opp], 6).weapon, `${opp} at level 6: the weapon (shape) of his level-6 loadout`);
    const pinned = boot(origin, undefined, kit6, `?opponent=${opp}&debug&tier=Recruit`);
    assert.equal(pinned.tier, 'Recruit', `${opp}: ?tier= wins over the Dev level`);
    assert.deepEqual([player.errors, dev.errors, pinned.errors], [[], [], []]);
  }
  // Sparring (Dom 2026-09-29): the sparring fight's look follows its own level's rung; a pick in the Sparring tab changes nothing live.
  const spar = boot(origin, undefined, {}, '?opponent=knight&spar=1&weapon=longsword&difficulty=6&skill=none'), pick = spar.element('difficulty-select');
  assert.equal(pick.value, '6', 'the sparring link boots level 6');
  assert.equal(spar.tier, grades.tierAt(5), `sparring level 6: dressed at ${grades.tierAt(5)}, not his Origin career rung`);
  pick.value = '40'; pick.dispatchEvent(new Event('change'));
  assert.deepEqual([spar.reloads, spar.tier], [0, grades.tierAt(5)], 'a pick waits for Start sparring: no reload, no re-dress');
  assert.deepEqual(spar.errors, []);
});

// The weapon take: the rig the scene loads holds the weapon the Match swings. A career page draws the equipped main hand; a kill link
// draws the record's weapon, whatever the viewer has equipped, and the rig waits for the link to decide.
test('the player rig draws the equipped weapon on a career page and the record\'s weapon on a kill link', async () => {
  const loot = { owned: ['goblin.Knife'], equipped: { main: 'goblin.Knife' } };
  const career = boot({ loot });
  assert.equal(await career.sceneWeapon, 'knife', 'career: the equipped knife');
  const rec = record.createRecorder({ build: 'dev', opponent: 'veteran', weapon: 'trident', level: 18, seed: 3 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const link = boot({ loot }, undefined, {}, `?opponent=veteran&replay=${await record.encodeRecord(rec.finish('killed'))}`);
  assert.equal(await link.sceneWeapon, 'trident', 'kill link: the record\'s trident, not the viewer\'s knife');
});

// (Daily removed, Dom 2026-09-29: the ?daily=1 equipped-estoc test went with the mode; match.test.ts pins the equipped kit on the career fight.)

test('an equip file that fails at load leaves the page fighting on the longsword the rig carries, with no error page', async () => {
  const app = boot({ loot: { owned: ['goblin.Knife'], equipped: { main: 'goblin.Knife' } } });
  assert.equal(await app.sceneWeapon, 'knife');
  app.drawn('longsword'); app.tick();
  assert.equal(app.rendered?.duel.fighters[0].weapon, 'longsword', 'the simulation swings what the rig holds');
  assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'false', 'the fight is live');
  assert.deepEqual(app.errors, []);
});

test('?perf=1: the readout carries the playtest lines — fps p50/p5 over the fight, time to first fight, bytes loaded, device — and a rematch starts the fight figures over (SCOPE #729 item 3)', () => {
  const app = boot({}, undefined, {}, '?perf=1');
  assert.equal(app.element('perf').hidden, false, 'the flag unhides the readout');
  for (let i = 0; i < 130; i++) app.tick(17);   // past the 2 s report beat, every frame live
  const text = app.element('perf').textContent;
  assert.match(text, /^fight: 59 fps p50 · 59 fps p5 · \d+ frames \/ \d+ s$/m, 'steady 17 ms frames read as 59 fps at both percentiles');
  assert.match(text, /^first fight at 0\.0 s$/m, 'the first live frame is the time to first fight, counted from navigation start');
  assert.match(text, /^loaded: no resource timing$/m, 'no resource timing in the harness says so instead of a false zero');
  assert.match(text, /^unknown device render 1\.25x$/m, 'no navigator in the harness says so; the render ratio is the renderer\'s own (the effective one, ?dpr= or not)');
  for (let i = 0; i < 20; i++) app.tick(50);   // a slow stretch: p5 falls, p50 holds
  for (let i = 0; i < 100; i++) app.tick(17);
  assert.match(app.element('perf').textContent, /^fight: 59 fps p50 · 20 fps p5 /m, 'the slowest 5 % of the fight shows as the p5 rate');
  app.element('reset-button').click();
  for (let i = 0; i < 130; i++) app.tick(17);
  assert.match(app.element('perf').textContent, /^fight: 59 fps p50 · 59 fps p5 · \d{1,2} frames/m, 'the rematch counts its own frames only (under 100 at the last report beat, against 250 before it)');
  assert.deepEqual(app.errors, []);
});

// The frame-time auto-drop (main.ts: a 2 s window with a median over 22 ms lowers the ratio to 1) says so on the readout, and an explicit
// ?dpr= turns it off for that load, so Dom's A/B renders at the ratio it asked for (Lead 2026-09-28).
test('?perf=1: a slow window drops the render ratio and the readout says "auto-lowered from 1.25"; under ?dpr= it never drops', () => {
  const slow = boot({}, undefined, {}, '?perf=1');
  for (let i = 0; i < 60; i++) slow.tick(50);   // median 50 ms over the 2 s report beat
  assert.match(slow.element('perf').textContent, /^unknown device render 1x \(auto-lowered from 1\.25\)$/m, 'the drop and where it came from');
  const pinned = boot({}, undefined, {}, '?dpr=2&perf=1');
  for (let i = 0; i < 60; i++) pinned.tick(50);
  assert.match(pinned.element('perf').textContent, /^unknown device render 1\.25x \(\?dpr\)$/m, 'an explicit ?dpr= keeps its ratio through a slow window');
  const fast = boot({}, undefined, {}, '?perf=1');
  for (let i = 0; i < 130; i++) fast.tick(17);
  assert.match(fast.element('perf').textContent, /^unknown device render 1\.25x$/m, 'no drop, no note');
  assert.deepEqual([...slow.errors, ...pinned.errors, ...fast.errors], []);
});
// The perf beacon (perf-beacon.ts): one POST per fight, at its end (off the frame, a timer) or on pagehide mid-fight; nothing mid-fight,
// nothing twice, nothing from a build without the service.
test('perf beacon: one send per fight, never mid-fight, and pagehide sends a fight left mid-way', () => {
  const run = (app: ReturnType<typeof boot>) => { for (const [id, timer] of [...app.timers]) { app.timers.delete(id); timer(); } };
  const beacons = (app: ReturnType<typeof boot>) => app.sent.filter((s) => s.url.endsWith('/rest/v1/perf_beacons'));
  apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
  try {
    const app = boot(); app.tick(); app.key('KeyF');
    for (let i = 0; i < 45; i++) app.tick();
    run(app); assert.equal(beacons(app).length, 0, 'nothing is sent while the fight runs');
    for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
    assert.ok(app.rendered.finish, 'the idle fighter dies');
    assert.equal(beacons(app).length, 0, 'not from the frame: the send waits for a timer');
    run(app); assert.equal(beacons(app).length, 1, 'the fight end sends one');
    const body = JSON.parse(String(beacons(app)[0]!.init.body));
    assert.ok(body.frames > 0 && body.fps_p50 > 0, 'the fight figures'); assert.equal(body.gfx_tier, 'full'); assert.equal(beacons(app)[0]!.init.keepalive, true);
    assert.ok(!('user_id' in body) && !('name' in body), 'no player identity');
    pageWindow(app).dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false })); run(app);
    assert.equal(beacons(app).length, 1, 'pagehide after the end sends nothing more: one per fight');
    app.element('reset-button').dispatchEvent(new Event('click')); app.tick();
    for (let i = 0; i < 60; i++) app.tick();
    pageWindow(app).dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));
    assert.equal(beacons(app).length, 2, 'the rematch, left mid-way, reports on pagehide');
    assert.deepEqual(app.errors, []);
    apiModule.api = null;
    const none = boot(); none.tick(); for (let i = 0; i < 6000 && !none.rendered.finish; i++) none.tick(); run(none);
    assert.equal(beacons(none).length, 0, 'a build without the service sends nothing');
    apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
    const qa = boot({}, undefined, {}, '?debug'); qa.tick(); for (let i = 0; i < 6000 && !qa.rendered.finish; i++) qa.tick(); run(qa);
    assert.equal(beacons(qa).length, 0, 'a ?debug page (our own release checks) sends nothing (Lead 2026-09-29)');
  } finally { apiModule.api = null; }
});
const pageWindow = (app: ReturnType<typeof boot>) => app.window as unknown as EventTarget;
test('?perf=1: a fight whose frames all arrive at ~30 Hz says "rAF capped 30 (low power?)"; a 60 Hz fight does not', () => {
  const capped = boot({}, undefined, {}, '?dpr=1&perf=1');   // ?dpr keeps the ratio: the slow window does not also drop it
  for (let i = 0; i < 130; i++) capped.tick(33.4);
  assert.match(capped.element('perf').textContent, /^rAF capped 30 \(low power\?\)$/m);
  const fast = boot({}, undefined, {}, '?perf=1');
  for (let i = 0; i < 130; i++) fast.tick(17);
  assert.doesNotMatch(fast.element('perf').textContent, /rAF capped/);
  assert.deepEqual([...capped.errors, ...fast.errors], []);
});
test('?perf=1: the fight figures wait for a playable frame — a returning player loading behind the versus card gets no early first-fight stamp and no loading frames in the fps lines (audit 2026-09-25, E)', () => {
  const app = boot({}, undefined, {}, '?perf=1');
  app.report('Loading warriors…', 'loading');   // the harness boots with the rigs in; back into the download, as a slow phone sees it
  for (let i = 0; i < 130; i++) app.tick(17);   // 2.2 s of loading frames past the report beat, welcome hidden, no fight on screen
  let text = app.element('perf').textContent;
  assert.match(text, /^first fight: not yet$/m, 'no stamp while the rigs are still downloading');
  assert.match(text, /^fight: 0 fps p50 · 0 fps p5 · 0 frames \/ 0 s$/m, 'loading frames are not fight frames');
  app.report('', 'ready');                       // the rigs are in
  for (let i = 0; i < 130; i++) app.tick(17);
  text = app.element('perf').textContent;
  assert.match(text, /^first fight at 2\.[23] s$/m, 'the stamp is the first playable frame, after the download');
  assert.match(text, /^fight: 59 fps p50 · 59 fps p5 · 1[0-3]\d frames \/ 2 s$/m, 'only the playable frames are counted');
  assert.deepEqual(app.errors, []);
});

test('a browser that refuses storage still boots: every setting takes its default and the guarded port never throws', () => {
  const app = boot({}, undefined, {}, '', true);   // Safari with site data blocked throws on `localStorage` itself, before getItem
  assert.deepEqual(app.errors, []);
  assert.equal(app.storage.getItem('frankendom.tempo.v1'), null);   // the harness store was never reached
  assert.equal(app.element('name-button').textContent, 'Wanderer', 'the seeded Tester profile was never read: a fresh fighter');
  for (let i = 0; i < 5; i++) app.tick();
  assert.ok(app.rendered, 'the fight loop runs on the defaults');
});


// Sparring sweep (Lead 2026-09-26): an unreadable ?spar=1 link says it is a normal fight instead of starting one in silence, and the
// dummy's sheathed line never promises a counterattack it cannot make.
test('graphics: an invalid sparring link banners a normal fight; the dummy never counterattacks', () => {
  const bad = boot({}, undefined, {}, '?opponent=veteran&spar=1&weapon=pike&difficulty=easy&skill=none');
  bad.tick();
  assert.equal(bad.element('replay-banner').textContent, "That sparring link isn't valid; this is a normal fight");
  assert.equal(bad.element('replay-banner').hidden, false);
  assert.notEqual(bad.element('difficulty-select').value, 'dummy', 'no kit change: the ordinary fight');
  assert.doesNotMatch(bad.element('replay-banner').textContent ?? '', /^Sparring/);
  const dummy = boot({}, undefined, {}, '?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none');
  for (let i = 0; i < 3; i++) dummy.tick();
  assert.equal(dummy.element('replay-banner').textContent, 'Sparring the dummy, no rewards');
  assert.equal(dummy.element('difficulty-select').value, 'dummy', 'the journal opens on Sparring with the kit this fight runs');
  assert.match(dummy.element('combat-status').textContent ?? '', /The dummy never attacks\./);
  assert.doesNotMatch(dummy.element('combat-status').textContent ?? '', /counterattack/);
  const normal = boot({}, undefined, {}, '?opponent=veteran');
  for (let i = 0; i < 3; i++) normal.tick();
  assert.match(normal.element('combat-status').textContent ?? '', /will counterattack\./, 'a real opponent keeps the line');
  assert.notEqual(normal.element('replay-banner').textContent, "That sparring link isn't valid; this is a normal fight");
});

// Strategy's owed end-screen check (2026-09-25, via Lead 2026-09-28): a sparring fight writes no record, so its end shows CHANGE and LEAVE
// in SHARE and CLIP's slots and never offers SHARE or CLIP (nothing to link). Career fights keep SHARE (the kill-link tests above).
test('sparring: the end screen offers CHANGE and LEAVE, never SHARE or CLIP', () => {
  const a = boot({}, undefined, {}, '?opponent=veteran&spar=1&weapon=longsword&difficulty=easy&skill=none');
  a.element('share-link').hidden = true; a.element('clip-button').hidden = true;   // the markup ships them hidden; this harness starts elements visible
  a.tick(); a.element('opponent-select').value = 'knight';   // a tab pick left unstarted mid-fight
  a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
  assert.ok(a.rendered.finish, 'the sparring fight ends');
  for (let i = 0; i < 5; i++) a.tick();
  assert.equal(a.element('spar-change').hidden, false, 'CHANGE shows');
  assert.equal(a.element('opponent-select').value, 'veteran', 'the kill screen puts the tab back on the fight just fought, so CHANGE opens there');
  assert.equal(a.element('spar-leave').hidden, false, 'LEAVE shows');
  assert.equal(a.element('share-link').hidden, true, 'no SHARE: a sparring fight has no record to link');
  assert.equal(a.element('clip-button').hidden, true, 'no CLIP');
});
// GPT recheck 2026-09-29 (C): endClip clears the clip and then waits for the recorder's last data. A Rematch in that wait begins a new
// fight (dropClip), and the old completion must not land on it: no file kept, no SEND, no share sheet over the new fight.
test('a clip still being made when the next fight starts never lands on it: no SEND, no share sheet', async () => {
  const recordClip = clipModule.recordClip, clipSupported = clipModule.clipSupported, shares: unknown[] = [];
  let finish: (blob: Blob | null) => void = () => {}, stops = 0;
  clipModule.clipSupported = () => true;
  clipModule.recordClip = () => ({ type: 'video/webm', draw() {}, cancel() {}, stop: () => { stops++; return new Promise<Blob | null>((done) => { finish = done; }); } });
  shareNavigator = { canShare: () => true, share: async (data: unknown) => { shares.push(data); } };
  try {
    const app = boot({}, undefined, {}, '?opponent=veteran'); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
    for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until the warden wins: a loss, so Rematch begins in place
    assert.ok(app.rendered.finish, 'the fight ends');
    const cutsBeforeClip = app.specialCuts;
    app.element('clip-button').click();
    assert.equal(app.element('clip-button').dataset.state, 'recording');
    for (let i = 0; i < 2000 && !stops; i++) app.tick();   // the re-play reaches the kill and the hold runs out: endClip(true) asks for the file
    assert.equal(stops, 1, 'the clip was stopped to be kept');
    app.tick(0);
    assert.ok(app.specialCuts >= cutsBeforeClip + 2, 'actual clip entry and exit each cancel old actor audio');
    assert.equal(app.specialCutActors.at(-1), undefined, 'clip lifecycle cancels both actors');
    app.element('reset-button').click(); app.tick();   // Rematch while the file is still being made
    assert.ok(!app.rendered.finish, 'a new fight is on');
    finish(new Blob(['old fight'], { type: 'video/webm' })); for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.deepEqual(shares, [], 'no share sheet over the new fight');
    assert.equal(app.element('clip-button').dataset.state, 'idle', 'no SEND for the old fight');
    assert.equal(app.element('debug').dataset.clip, undefined, 'the old file is not kept');
  } finally { clipModule.recordClip = recordClip; clipModule.clipSupported = clipSupported; shareNavigator = undefined; }
});
// GPT recheck 2026-09-29 at 303af39 (F): the same wait, but the player starts a second clip of the same fight (no fight start, so no
// dropClip). The first clip's late file must not take the slot or open the share sheet while the second records.
test('a clip still being made when a second clip of the same fight starts never lands over it', async () => {
  const recordClip = clipModule.recordClip, clipSupported = clipModule.clipSupported, shares: unknown[] = [], finishes: ((blob: Blob | null) => void)[] = [];
  clipModule.clipSupported = () => true;
  clipModule.recordClip = () => ({ type: 'video/webm', draw() {}, cancel() {}, stop: () => new Promise<Blob | null>((done) => { finishes.push(done); }) });
  shareNavigator = { canShare: () => true, share: async (data: unknown) => { shares.push(data); } };
  try {
    const app = boot({}, undefined, {}, '?opponent=veteran'); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
    for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
    assert.ok(app.rendered.finish, 'the fight ends');
    app.element('clip-button').click();
    for (let i = 0; i < 2000 && !finishes.length; i++) app.tick();
    assert.equal(finishes.length, 1, 'the first clip was stopped to be kept');
    app.element('clip-button').click();   // a second clip of the same fight while the first file is still being made
    assert.equal(app.element('clip-button').dataset.state, 'recording', 'the second clip records');
    finishes[0](new Blob(['first clip'], { type: 'video/webm' })); for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.deepEqual(shares, [], 'no share sheet over the second clip');
    assert.equal(app.element('clip-button').dataset.state, 'recording', 'the second clip is still recording, not SEND');
    assert.equal(app.element('debug').dataset.clip, undefined, 'the first file is not kept');
  } finally { clipModule.recordClip = recordClip; clipModule.clipSupported = clipSupported; shareNavigator = undefined; }
});

// Real main boot and sim-event dispatch, with the real lookup/Match and observed feedback calls.
test('special previews boot with the real audio lookup; a cast starts once and a fizzle cuts it', () => {
  for (const id of Object.keys(specialLook.SPECIAL_TESTS)) {
    const app = boot({}, undefined, {}, `?special=${id}`);
    const cue = specialAudio.SPECIAL_CUE_OF[id];
    assert.deepEqual(app.specialWants, cue ? [cue] : [], `${id} prefetches only its authored cue`);
    assert.ok(app.specialWants.every(want => typeof want === 'string'), 'quiet previews never request undefined');
    assert.deepEqual(app.errors, []);
  }
  const app = boot({}, undefined, {}, '?special=tithe');
  app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  app.rendered.duel.fighters[1].skillCooldown = 0;
  for (let i = 0; i < 180 && !app.specialCalls.length; i++) app.tick();
  assert.deepEqual(app.specialCalls, ['tithe'], 'accepted opponent SpecialStarted routes the cue');
  assert.ok(app.rendered.duel.fighters[1].special, 'real sim windup is active');
  const tick = app.rendered.duel.tick;
  for (let i = 0; i < 5; i++) app.tick(0);
  assert.equal(app.rendered.duel.tick, tick, 'five drawn frames without a sim tick');
  assert.deepEqual(app.specialCalls, ['tithe'], 'render repeats do not restart the cue');
  app.rendered.duel.fighters[1].health = 1;
  app.rendered.duel.fighters[0].special = 1;   // release on the next real sim tick, killing the winding-up foe
  const starts = app.specialCalls.length;
  for (let i = 0; i < 90 && !app.specialCuts; i++) app.tick();
  assert.equal(app.specialCuts, 1, 'real sim SpecialFizzled cuts the cue');
  assert.equal(app.specialCalls.length, starts, 'player release does not start an opponent preview cue');
  for (let i = 0; i < 5; i++) app.tick(0);
  assert.equal(app.specialCuts, 1, 'render repeats do not repeat cancellation');
});

test('ordinary PvE actual main dispatches both accepted actors once and invalidates epoch/rewind', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    const app = boot({}, undefined, {}, '?opponent=veteran'); live.setLevel(46);
    app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
    assert.equal(live.specials, true, 'ordinary PvE is activated at Match boundary');
    const [player, foe] = live.practice.duel.fighters;
    // Both named casts are sim fixtures; this does not assign a player boss in production.
    player.specialName = 'tithe'; player.skill = 'pommel'; player.skillCooldown = 0;
    player.phase = 'ready'; player.age = 0; foe.phase = 'ready'; foe.age = 0;
    foe.body = { ...foe.body, x: player.body.x, z: player.body.z - 1.2 };
    foe.skillCooldown = 0; live.skill = 'pommel';
    app.element('skill-button').dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { button: 0 }));
    for (let i = 0; i < 180 && app.specialCalls.length < 2; i++) app.tick();
    assert.deepEqual(app.specialCalls, ['tithe', 'tithe']);
    assert.deepEqual(app.specialActors, [0, 1]);
    const tick = live.practice.duel.tick;
    for (let i = 0; i < 5; i++) app.tick(0);
    assert.equal(live.practice.duel.tick, tick); assert.equal(app.specialCalls.length, 2);
    live.epoch++; app.tick(0); assert.equal(app.specialCutActors.at(-1), undefined);
    const cuts = app.specialCuts; live.practice.duel.tick = 0; app.tick(0);
    assert.equal(app.specialCuts, cuts + 1, 'rewind cuts both before any new sim event');
    assert.equal(app.specialCalls.length, 2); assert.deepEqual(app.errors, []);
  } finally { matchModule.Match = Original; }
});

test('ordinary PvE actual main consumes quiet catch-up casts without playing them later', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    const app = boot({}, undefined, {}, '?opponent=veteran'); live.setLevel(46);
    app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
    const [player, foe] = live.practice.duel.fighters; player.phase = foe.phase = 'ready';
    foe.body = { ...foe.body, x: player.body.x, z: player.body.z - 1.2 }; foe.skillCooldown = 0;
    Object.assign(app.document, { hidden: true }); app.document.dispatchEvent(new Event('visibilitychange'));
    app.tick(1000); Object.assign(app.document, { hidden: false }); app.document.dispatchEvent(new Event('visibilitychange')); app.tick();
    assert.ok(live.fightLog.some(e => e.type === 'SpecialStarted'), 'real simulator committed the catch-up cast');
    assert.equal(app.specialCalls.length, 0, 'quiet catch-up has no cue');
    for (let i = 0; i < 5; i++) app.tick(0);
    assert.equal(app.specialCalls.length, 0, 'resuming cannot replay the accepted old cast');
  } finally { matchModule.Match = Original; }
});

test('phase-two ordinary PvE actual main keeps A off and dispatches four B cues plus two quiet casts despite picker changes', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  const classes = [['witch', 'stirring'], ['plaguedoctor', 'pulse'], ['knight', 'swing'], ['nightborn', 'cuts'], ['goblin', null], ['veteran', null]] as const;
  try {
    for (const [opponent, cue] of classes) for (const level of [1, 15, 16, 35]) {
      const active = level >= 16, app = boot({}, undefined, {}, `?opponent=${opponent}`); live.setLevel(level);
      app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
      const [player, foe] = live.practice.duel.fighters; player.phase = foe.phase = 'ready'; player.health = foe.health = 10000;
      foe.body = { ...foe.body, x: player.body.x, z: player.body.z - 1.2 }; foe.skillCooldown = 0;
      assert.deepEqual(live.specialIdentity, { opponent, level }); assert.equal(live.specials, active, `${opponent} L${level} phase`);
      assert.equal(foe.specialShare, active ? moves.RULES.special.damage : undefined);
      live.setLevel(active ? 1 : 46);   // a picker cannot retarget the already built A/B fight
      for (let i = 0; i < 180 && !live.fightLog.some(e => e.type === 'SpecialStarted'); i++) app.tick();
      assert.equal(live.fightLog.some(e => e.type === 'SpecialStarted'), active); assert.equal(live.specials, active);
      assert.deepEqual(live.specialIdentity, { opponent, level });
      if (active) assert.ok(live.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 1 && e.name === undefined), 'real accepted unnamed B cast');
      assert.deepEqual(app.specialCalls, active && cue ? [cue] : []); assert.deepEqual(app.specialActors, active && cue ? [1] : []);
      if (active && cue) assert.ok(app.specialWants.length > 0 && app.specialWants.every(want => want === cue));
      else assert.deepEqual(app.specialWants, [], 'A and the two unauthored B cues stay quiet');
      for (let i = 0; i < 5; i++) app.tick(0);
      assert.deepEqual(app.specialCalls, active && cue ? [cue] : []); assert.deepEqual(app.errors, []);
    }
  } finally { matchModule.Match = Original; }
});

test('boss-first ordinary PvE actual main dispatches all thirty named boss identities from captured ranks', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  const bosses = [
    ['veteran', ['quake', 'charge', 'tithe']], ['nightborn', ['redwind', 'hadesshadow', 'nyxnightfall']],
    ['goblin', ['dirtyfistful', 'gone', 'threeliars']], ['pitborn', ['crackingground', 'ashfall', 'windwall']],
    ['executioner', ['bayingcircle', 'longshadow', 'harvestsweep']], ['dwarf', ['theword', 'threeblows', 'rimshake']],
    ['shieldmaiden', ['baredface', 'thering', 'aegissweep']], ['witch', ['avalonmist', 'foretoldstep', 'theprice']],
    ['plaguedoctor', ['plagueflies', 'poisonstain', 'lastbreath']], ['knight', ['thesling', 'wrath', 'stormfollowshim']],
  ] as const;
  try {
    for (const [opponent, names] of bosses) for (const [rank, name] of names.entries()) {
      const level = 36 + rank * 5, app = boot({}, undefined, {}, `?opponent=${opponent}`); live.setLevel(level);
      app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
      const [player, foe] = live.practice.duel.fighters; player.phase = foe.phase = 'ready'; player.health = foe.health = 10000;
      foe.body = { ...foe.body, x: player.body.x, z: player.body.z - 1.2 }; foe.skillCooldown = 0;
      assert.equal(live.specials, true); assert.equal(foe.specialName, name); assert.deepEqual(live.specialIdentity, { opponent, level });
      live.setLevel(1);   // the captured boss remains active even if the picker now points below the cutoff
      for (let i = 0; i < 180 && !live.fightLog.some(e => e.type === 'SpecialStarted'); i++) app.tick();
      assert.ok(live.fightLog.some(e => e.type === 'SpecialStarted' && e.name === name), `${opponent} L${level} real named cast`);
      const id = specialIdentity.bossSpecialId(name)!; const cue = specialAudio.SPECIAL_CUE_OF[id]!;
      assert.deepEqual(app.specialCalls, [cue]); assert.deepEqual(app.specialActors, [1]);
      assert.ok(app.specialWants.length > 0); assert.ok(app.specialWants.every(want => want === cue));
      for (let i = 0; i < 5; i++) app.tick(0);
      assert.deepEqual(app.specialCalls, [cue]); assert.deepEqual(app.errors, []);
    }
  } finally { matchModule.Match = Original; }
});


test('independent Your special catalog survives foe class/rank/Dummy resets and Start serializes both without saving', () => {
  const app = boot({}, undefined, {}, '?debug&opponent=nightborn');
  const your = app.element('spar-skill'), foe = app.element('spar-special'), difficulty = app.element('difficulty-select'), opponent = app.element('opponent-select');
  const before = app.storage.snapshot(), sessionBefore = app.storage.sessionSnapshot();
  your.value = 'special:price'; your.dispatchEvent(new Event('change'));
  assert.match(app.element('spar-player-status').textContent, /Your fighter: The Price.*Cast with SKILL/);
  difficulty.value = '46'; difficulty.dispatchEvent(new Event('change')); assert.equal(foe.value, 'nyx');
  foe.value = 'none'; foe.dispatchEvent(new Event('change')); assert.equal(your.value, 'special:price');
  opponent.value = 'witch'; opponent.dispatchEvent(new Event('change')); assert.equal(foe.value, 'price');
  difficulty.value = 'dummy'; difficulty.dispatchEvent(new Event('change')); assert.equal(foe.value, 'none');
  assert.equal(your.value, 'special:price'); assert.deepEqual(app.replaced, []);
  assert.deepEqual(app.storage.snapshot(), before); assert.deepEqual(app.storage.sessionSnapshot(), sessionBefore);
  app.element('spar-start').click();
  const params = new URL(app.replaced[0], 'https://frankendom.com').searchParams;
  assert.equal(params.get('yourSpecial'), 'price'); assert.equal(params.get('skill'), 'none'); assert.equal(params.get('special'), 'none');
  difficulty.value = '46'; difficulty.dispatchEvent(new Event('change')); your.value = 'none'; your.dispatchEvent(new Event('change'));
  assert.equal(foe.value, 'price', 'changing Your move never clears foe');
  app.element('spar-start').click();
  const none = new URL(app.replaced[1], 'https://frankendom.com').searchParams;
  assert.equal(none.get('special'), 'price'); assert.equal(none.get('skill'), 'none'); assert.equal(none.get('yourSpecial'), 'none');
  your.value = 'special:fake'; app.element('spar-start').click(); assert.equal(app.replaced.length, 2, 'invalid tagged choice refuses Start');
  assert.match(app.element('replay-banner').textContent, /Choose valid special moves/);
});
test('legacy both-ability link remains represented by two independent fields and unchanged Start retains both', () => {
  const app = boot({}, undefined, {}, '?spar=1&opponent=nightborn&weapon=estoc&difficulty=6&skill=miasma&special=nyx');
  assert.equal(app.element('spar-skill').value, 'miasma'); assert.equal(app.element('spar-special').value, 'nyx');
  app.element('spar-start').click();
  const params = new URL(app.replaced[0], 'https://frankendom.com').searchParams;
  assert.equal(params.get('skill'), 'miasma'); assert.equal(params.get('special'), 'nyx'); assert.equal(params.get('yourSpecial'), 'none');
});


test('actual main boots independent registered player/foe casts, manual SKILL and per-actor cues without persistence', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    for (const [player, foe, difficulty] of [['price', 'none', 'dummy'], ['none', 'nyx', '6'], ['price', 'nyx', '6'], ['wake', 'none', 'dummy'], ['standfast', 'none', 'dummy']] as const) {
      const app = boot({}, undefined, {}, `?spar=1&opponent=nightborn&weapon=estoc&difficulty=${difficulty}&skill=none&special=${foe}&yourSpecial=${player}`);
      const before = app.storage.snapshot(), epoch = live.epoch;
      assert.equal(live.mode, 'sparring'); assert.equal(live.recorder, null); assert.equal(live.weapon, 'estoc');
      assert.deepEqual(live.specialIdentity.presets, [player === 'none' ? null : player, foe === 'none' ? null : foe]);
      assert.equal(app.element('spar-skill').value, player === 'none' ? 'none' : `special:${player}`);
      assert.equal(app.element('spar-special').value, foe);
      assert.equal(live.practice.duel.fighters[0].specialShare === undefined, player === 'none');
      assert.equal(live.practice.duel.fighters[1].specialShare === undefined, foe === 'none');
      app.tick(); app.key('KeyF'); app.tick(); app.release('KeyF');
      for (let i = 0; i < 400 && !live.practice.finish; i++) app.tick();
      assert.equal(live.fightLog.some(e => e.actor === 0 && e.type === 'SpecialStarted'), false, 'no automatic player cast');
      if (player !== 'none') {
        assert.equal(app.element('skill-button').attributes.get('aria-disabled'), 'false', 'real HUD enables actual ready skill');
        app.element('skill-button').dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { button: 0 }));
        // The press can land in the last ticks of a hit reaction (the level-6 foe's blow): the sim buffers it like any action and the cast
        // starts as the reaction ends (RULES.bufferWindow 10, bufferTtl 11), so allow that long, no longer.
        for (let i = 0; i < 12 && !live.fightLog.some(e => e.actor === 0 && e.type === 'SpecialStarted'); i++) app.tick();
        assert.ok(live.fightLog.some(e => e.actor === 0 && e.type === 'SpecialStarted'), 'actual input dispatch starts player preset');
        if (player === 'standfast') assert.equal(app.specialActors.includes(0), false, 'Stand Fast stays silent');
        else assert.ok(app.specialCalls.some((cue, i) => cue === (player === 'price' ? 'theprice' : 'wake') && app.specialActors[i] === 0), 'preset dispatch uses authored cue ID on player actor');
      } else assert.equal(app.element('skill-button').attributes.get('aria-disabled'), 'true');
      if (foe === 'nyx') {
        for (let i = 0; i < 1800 && !live.fightLog.some(e => e.actor === 1 && e.type === 'SpecialStarted') && !live.practice.finish; i++) app.tick();
        assert.ok(live.fightLog.some(e => e.actor === 1 && e.type === 'SpecialStarted' && e.name === 'nyxnightfall'));
        assert.ok(app.specialCalls.some((cue, i) => cue === 'nyx' && app.specialActors[i] === 1));
        assert.equal(app.specialCalls.filter((cue, i) => cue === 'nyx' && app.specialActors[i] === 1).length, live.fightLog.filter(e => e.actor === 1 && e.type === 'SpecialStarted').length, 'foe cue not duplicated by legacy preview route');
      }
      assert.equal(live.epoch, epoch); assert.deepEqual(app.storage.snapshot(), before); assert.deepEqual(app.errors, []);
    }
  } finally { matchModule.Match = Original; }
});
test('actual main new-form legacy Miasma remains SKILL and explicit preset off; malformed/non-Spar player links pause visibly', () => {
  const Original = matchModule.Match; let live!: match.Match;
  matchModule.Match = captureMatch(value => { live = value; });
  try {
    const good = '?spar=1&opponent=nightborn&weapon=estoc&difficulty=6&skill=miasma&special=nyx&yourSpecial=none';
    const app = boot({}, undefined, {}, good);
    assert.equal(live.skill, 'miasma'); assert.equal(live.practice.duel.fighters[0].specialShare, undefined);
    assert.deepEqual(live.specialIdentity.presets, [null, 'nyx']);
    assert.equal(app.specialWants.includes('pulse'), false, 'legacy Miasma is not Doctor B');
    for (const search of [good.replace('yourSpecial=none', 'yourSpecial=price'), good.replace('yourSpecial=none', 'yourSpecial=fake'), `${good}&yourSpecial=none`, good.replace('spar=1', 'spar=0')]) {
      const invalid = boot({}, undefined, {}, search), tick = live.practice.duel.tick, epoch = live.epoch, before = invalid.storage.snapshot();
      assert.match(invalid.element('replay-banner').textContent, /special move test link is invalid/);
      invalid.key('KeyF'); for (let i = 0; i < 20; i++) invalid.tick(); invalid.element('reset-button').click();
      assert.equal(live.practice.duel.tick, tick); assert.equal(live.epoch, epoch); assert.deepEqual(invalid.storage.snapshot(), before);
    }
  } finally { matchModule.Match = Original; }
});

// The harness stubs every import main.ts makes through `modules` (boot). An import left out resolves to `{}`, so whatever main.ts takes from it is
// `undefined` at boot and the 'actual main' tests run against a main that never calls it: #1535, #1536 and #1542 each shipped a new src module that
// way and CI only caught it later. The five below are the known gaps whose values main.ts only reads in paths no test here reaches (gate light, arena
// layout, the stylesheet side effect, monitoring); anything else that appears must be registered, e.g. `modules['./x.ts'] = x;` beside the others.
test('every src module main.ts imports is registered in the harness (a new import names itself here)', () => {
  unstubbed.clear(); boot();
  const known = ['./arena.ts', './gate-light.ts', './gate-rise.ts', './monitoring.ts', './style.css'];
  const fresh = [...unstubbed].filter((id) => id.startsWith('.') && !known.includes(id)).sort();
  assert.deepEqual(fresh, [], `main.ts imports ${fresh.join(', ')} but tests/graphics.test.ts does not register ${fresh.length === 1 ? 'it' : 'them'} in \`modules\` (boot), so the actual-main tests boot with ${fresh.length === 1 ? 'it' : 'them'} stubbed to {}: add \`modules['<path>'] = <import>;\` beside the others`);
  assert.deepEqual([...unstubbed].filter((id) => id.startsWith('.')).sort(), known, 'a known gap was closed: remove it from `known` so the list stays exact');
});
