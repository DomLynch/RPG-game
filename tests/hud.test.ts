import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHud, HEAVY_MOVES, type HudView } from '../src/hud.ts';
import { OPPONENTS, accepts, initialPractice, project, type CombatEvent, type Practice } from '../src/combat.ts';
import { idleIntent, inBufferWindow, stepDuel, type Intent } from '../src/duel.ts';

// A minimal DOM: what the HUD writes to (properties, attributes, dataset, style props) is what the assertions read.
class FakeElement {
  hidden = false; value: string | number = ''; max: number | string = ''; textContent = ''; className = '';
  attributes = new Map<string, string>(); dataset: Record<string, string> = {}; children: FakeElement[] = [];
  writes = 0;
  style = { props: new Map<string, string>(), left: '', top: '', setProperty(k: string, v: string) { this.props.set(k, v); } };
  setAttribute(k: string, v: string) { this.attributes.set(k, v); this.writes++; }
}
function dom(poolSize = 4) {
  const elements = new Map<string, FakeElement>();
  const element = <T>(id: string): T => { if (!elements.has(id)) elements.set(id, new FakeElement()); return elements.get(id)! as unknown as T; };
  const pool = element<FakeElement>('dmg-pool'); pool.children = Array.from({ length: poolSize }, () => new FakeElement());
  return { element, get: (id: string) => elements.get(id)! };
}
const view = (over: Partial<HudView> = {}): HudView => ({ controlsReady: true, debug: false, opponentId: 'veteran', ...over });

test('update binds meters, values, labels and the combat buttons from the practice state', () => {
  const { element, get } = dom(), hud = createHud(element as never);
  const practice = initialPractice();
  hud.update(practice, view());
  assert.equal(get('target-health').max, practice.enemyMaxHealth); assert.equal(get('target-health').value, practice.health);
  assert.equal(get('health-value').textContent, `${practice.health} / ${practice.enemyMaxHealth}`);
  assert.equal(get('player-health-value').textContent, `${practice.playerHealth} / ${practice.maxHealth}`);
  assert.equal(get('stamina').style.props.get('--fill'), `${practice.stamina}%`);
  assert.equal(get('stamina').style.props.get('--max'), `${practice.maxStamina}%`);
  assert.equal(get('stamina-value').textContent, `${Math.floor(practice.stamina)} / 100`);
  assert.equal(get('posture').dataset.critical, 'false'); assert.equal(get('target-posture').style.props.get('--fill'), `${practice.enemyPosture}%`);
  assert.equal(get('stamina-label').dataset.mobile, 'Stamina');
  assert.equal(get('stamina').attributes.get('aria-label'), 'Stamina');
  assert.equal(get('combat-status').textContent.length > 0, true, 'the hint is written');
  assert.equal(get('attack-button').textContent, 'Fight', 'sheathed: the attack button reads Fight and draws (Dom 2026-09-29)');
  assert.equal(get('attack-button').dataset.mobile, 'Fight');
  assert.equal(get('attack-button').attributes.get('aria-label'), 'Fight');
  assert.equal(get('attack-button').dataset.next, undefined, 'sheathed: no next cut to hint');
  // Side hint (owner 2026-09-21): once drawn, Slash lights the side of the NEXT cut — right first, then left after a right cut lands its turn.
  const drawn = { ...practice, phase: 'ready' as const, duel: { ...practice.duel, fighters: [{ ...practice.duel.fighters[0], phase: 'ready' as const }, practice.duel.fighters[1]] as typeof practice.duel.fighters } };
  hud.update(drawn, view()); assert.equal(get('attack-button').dataset.next, 'right', 'first cut is the right one');
  const afterRight = { ...drawn, duel: { ...drawn.duel, fighters: [{ ...drawn.duel.fighters[0], lastMove: 'light_right' as const }, drawn.duel.fighters[1]] as typeof drawn.duel.fighters } };
  hud.update(afterRight, view()); assert.equal(get('attack-button').dataset.next, 'left', 'after a right cut the next is the left');
  hud.update(practice, view());
  assert.equal(get('kick-button').hidden, true, 'no kick while sheathed');
  assert.equal(get('thrust-button').hidden, true);
  assert.equal(get('reset-button').hidden, true, 'the fight is on: no rematch button');
  assert.equal(get('guard-button').attributes.get('aria-pressed'), 'false');
  assert.equal(get('debug').hidden, true);
});

test('update: a readiness or debug change relabels; an unchanged frame writes nothing until invalidated', () => {
  const { element, get } = dom(), hud = createHud(element as never);
  const practice = initialPractice();
  hud.update(practice, view());
  assert.equal(get('attack-button').textContent, 'Fight'); assert.equal(get('heavy-button').hidden, false, 'the cluster shows Heavy');
  hud.update(practice, view({ debug: true }));
  assert.equal(get('debug').hidden, false, 'debug is part of the memo key (#1093: ?debug shown follows the test tools): the change rewrites');
  const writes = get('attack-button').writes;
  hud.update(practice, view({ debug: true }));
  assert.equal(get('attack-button').writes, writes, 'identical frame: no DOM writes');
  hud.invalidate(); hud.update(practice, view({ debug: true }));
  assert.ok(get('attack-button').writes > writes && get('debug').hidden === false, 'invalidate forces the rewrite');
  hud.update(practice, view({ debug: true, controlsReady: false }));
  assert.equal(get('attack-button').attributes.get('aria-disabled'), 'true', 'not ready: every control reads disabled');
  assert.equal(get('dodge-button').attributes.get('aria-disabled'), 'true');
});

test('update: a finished fight hides the attacks and shows Rematch, or Next: <name> after a win', () => {
  const { element, get } = dom(), hud = createHud(element as never);
  const lost: Practice = { ...initialPractice(), playerHealth: 0 };
  hud.update(lost, view());
  assert.equal(get('attack-button').hidden, true); assert.equal(get('heavy-button').hidden, true);
  assert.equal(get('reset-button').hidden, false); assert.equal(get('reset-button').textContent, 'Rematch');
  const won: Practice = { ...initialPractice(), health: 0, finish: { victim: 1, location: 'torso', move: 'light_right', heading: 0 } };   // a real MoveId: the HUD reads victim, not the move
  hud.update(won, view({ opponentId: 'veteran', next: { name: 'the Witch' } }));
  assert.equal(get('reset-button').textContent, 'Next: the Witch', 'a win offers the page\'s own pick (match.ts nextRung)');
  const fresh = dom(); createHud(fresh.element as never).update(won, view({ opponentId: 'veteran' }));
  assert.equal(fresh.get('reset-button').textContent, 'Rematch', 'no pick (a practice fight): Rematch');
});

test('floatDamage: pooled spans round-robin at the projected victim, classed by side and heavy class; no pool or projection floats nothing', () => {
  const { element, get } = dom(2), hud = createHud(element as never);
  const fighters = [{ body: { x: 1, z: 2 }, scale: 1 }, { body: { x: -1, z: -2 }, scale: 1.13 }];
  const projected: number[][] = [];
  const project = (p: [number, number, number]): [number, number] | null => { projected.push(p); return [p[0] * 100, p[2] * 10]; };
  const hit = (target: 0 | 1, damage: number, extra: Partial<CombatEvent> = {}) => ({ type: 'Hit', actor: target ? 0 : 1, target, damage, ...extra }) as CombatEvent;
  hud.floatDamage([hit(1, 24), hit(0, 12.4, { charged: true }), { type: 'Blocked', actor: 0 } as CombatEvent, hit(1, 30, { move: 'heavy_overhead' })], fighters, project);
  const [a, b] = get('dmg-pool').children;
  assert.deepEqual(projected[0], [-1, 1.62 * 1.13, -2], 'projected at 1.62 × the victim\'s scale');
  assert.equal(a.textContent, '30', 'the third hit reused the first span (pool of two)'); assert.equal(a.className, 'dmg heavy');
  assert.equal(b.textContent, '12', 'rounded'); assert.equal(b.className, 'dmg taken heavy'); assert.equal(b.style.left, '100px'); assert.equal(b.style.top, '20px');
  assert.ok(!a.hidden && !b.hidden);
  hud.hideDamage(); assert.ok(a.hidden && b.hidden, 'the journal toggle hides whatever is floating');
  const nothing = createHud(dom(0).element as never); nothing.floatDamage([hit(1, 24)], fighters, project);   // empty pool: nothing to float
  const noProjection = dom(); createHud(noProjection.element as never).floatDamage([hit(1, 24)], fighters, undefined);
  assert.equal(noProjection.get('dmg-pool').children[0].textContent, '', 'no projection (the VM harness): nothing floats');
  assert.ok(HEAVY_MOVES.has('critical') && !HEAVY_MOVES.has('light'));
});

// Live c1bda34d: SKILL re-lit ~1.3 s into its 15 s cooldown, in the cast's own tail and in a hurt's tail. accepts() is true for every
// action inside a committed action's buffer window, so the HUD must refuse SKILL itself while it cools.
test('update: SKILL stays dim for its whole cooldown, through the cast\'s own buffer window and a hurt\'s, then lights', () => {
  const { element, get } = dom(), hud = createHud(element as never);
  const skill = () => get('skill-button').attributes.get('aria-disabled');
  const idle = (action: Intent['action'] = null) => [{ ...idleIntent(), action }, idleIntent()] as [Intent, Intent];
  const start = initialPractice(731, OPPONENTS.veteran, 'longsword', 'witchfire');
  let duel = stepDuel(start.duel, idle('light'));   // draw
  while (duel.fighters[0].phase !== 'ready') duel = stepDuel(duel, idle());
  hud.update(project(duel, start.ai), view()); assert.equal(skill(), 'false', 'drawn, equipped and cooled: SKILL is lit');
  duel = stepDuel(duel, idle('skill'));
  assert.ok(duel.fighters[0].skillCooldown > 0, 'the cast spends the cooldown');
  while (!inBufferWindow(duel.fighters[0])) { hud.update(project(duel, start.ai), view()); assert.equal(skill(), 'true'); duel = stepDuel(duel, idle()); }
  const tail = project(duel, start.ai);
  assert.ok(accepts(tail, 'skill'), 'precondition: the buffer window accepts every action');
  hud.update(tail, view()); assert.equal(skill(), 'true', 'the cast\'s own tail: still cooling, still dim');
  const f = duel.fighters[0];
  const hurt = { ...duel, fighters: [{ ...f, phase: 'hurt' as const, move: null, age: 0 }, duel.fighters[1]] as typeof duel.fighters };
  let h = hurt; while (!inBufferWindow(h.fighters[0])) h = { ...h, fighters: [{ ...h.fighters[0], age: h.fighters[0].age + 1 }, h.fighters[1]] as typeof h.fighters };
  assert.ok(accepts(project(h, start.ai), 'skill'), 'precondition: a hurt\'s tail accepts every action');
  hud.update(project(h, start.ai), view()); assert.equal(skill(), 'true', 'a hurt\'s tail: still cooling, still dim');
  // Cooled, with nothing else on screen changing: the memo key must carry SKILL or it never re-lights.
  const ready = { ...duel, fighters: [{ ...f, phase: 'ready' as const, move: null, age: 0, skillCooldown: 1, stamina: 100 }, duel.fighters[1]] as typeof duel.fighters };
  hud.update(project(ready, start.ai), view()); assert.equal(skill(), 'true', 'one tick left: dim');
  hud.update(project({ ...ready, fighters: [{ ...ready.fighters[0], skillCooldown: 0 }, ready.fighters[1]] as typeof ready.fighters }, start.ai), view());
  assert.equal(skill(), 'false', 'cooled: SKILL lights');
});

// Combat 2026-09-27: a lit Dirty Jab pressed at 1.0–1.4 m started and whiffed (live tick log). SKILL now says when the equipped cone
// skill can land, as Kick does: data-reach from the move's own reach (Jab 1.0 m, Pommel 1.3 m, Lunge 2.4 m), no number in the HUD.
test('update: SKILL shows whether the equipped cone skill is in reach (data-reach), from the move\'s own reach', () => {
  const at = (skill: Parameters<typeof initialPractice>[3], gap: number) => {
    const { element, get } = dom(), hud = createHud(element as never), start = initialPractice(731, OPPONENTS.veteran, 'longsword', skill);
    const [me, him] = start.duel.fighters;
    const duel = { ...start.duel, fighters: [{ ...me, phase: 'ready' as const }, { ...him, body: { ...him.body, x: me.body.x + gap, z: me.body.z } }] as typeof start.duel.fighters };
    hud.update(project(duel, start.ai), view());
    return get('skill-button').dataset.reach;
  };
  assert.equal(at('jab', 1.1), 'false', 'Jab at 1.1 m: out of its 1.0 m cone, dim');
  assert.equal(at('jab', 0.9), 'true', 'Jab at 0.9 m: in reach, lit');
  assert.equal(at('pommel', 1.4), 'false'); assert.equal(at('pommel', 1.2), 'true', 'Pommel reads its own 1.3 m');
  assert.equal(at('lunge', 2.3), 'true', 'Lunge reads its own 2.4 m, not the Jab\'s');
  assert.equal(at(undefined, 0.9), undefined, 'no skill held: no reach flag, SKILL as before');
});

test('a lesson the fight sets wins the combat-status line, and the line returns when it is cleared (lessons.ts)', () => {
  const { element, get } = dom(), hud = createHud(element as never), practice = initialPractice();
  hud.update(practice, view());
  const plain = get('combat-status').textContent;
  hud.update(practice, view({ lesson: 'rollSideways' }));
  assert.equal(get('combat-status').textContent, 'Roll sideways, then step back in.');
  hud.update(practice, view());
  assert.equal(get('combat-status').textContent, plain);
});
