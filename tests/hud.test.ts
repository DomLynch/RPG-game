import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHud, HEAVY_MOVES, type HudView } from '../src/hud.ts';
import { initialPractice, type CombatEvent, type Practice } from '../src/combat.ts';

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
  assert.equal(get('attack-button').textContent, 'Draw sword', 'sheathed: the attack button draws');
  assert.equal(get('attack-button').dataset.mobile, 'Draw');
  assert.equal(get('attack-button').attributes.get('aria-label'), 'Draw sword');
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
  assert.equal(get('attack-button').textContent, 'Draw sword'); assert.equal(get('heavy-button').hidden, false, 'the cluster shows Heavy');
  hud.update(practice, view({ debug: true }));
  assert.equal(get('debug').hidden, true, 'debug is not part of the memo key: same key, no rewrite (as before the move)');
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
  hud.update(won, view({ opponentId: 'veteran' }));
  assert.match(get('reset-button').textContent, /^Next: /, 'a win on a rung offers the next opponent');
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
