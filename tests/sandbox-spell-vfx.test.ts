// sandbox-mech: the spells' own looks (src/fight/spell-vfx.ts). Built without a GPU: five looks, warmed, triggered by the real landing events, posed tick by tick; each shows something while it plays, hides when done, and the one light rises and falls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { spellHeal: object[]; spellPick: object[]; rules: { id: string; value?: number }[] };
for (const [id, value] of [['vfxGroundCm', 5], ['vfxScaleNear', 100], ['vfxScaleFar', 1000], ['vfxScaleMax', 3000]] as const) defs.rules.find((r) => r.id === id)!.value = value;   // the distance-scale rows (trunk 0 = off)
defs.spellHeal.push({ id: 'gula', share: 250, uses: 2, windup: 120 });
defs.spellPick.push({ id: 'ugallu', level: 1, vfx: 'shock' }, { id: 'brokkr', level: 1, vfx: 'ash' }, { id: 'kamaitachi', level: 1, vfx: 'wind' }, { id: 'banshee', level: 1, vfx: 'nyx' }, { id: 'gula', level: 3, vfx: 'heal' });
const { createSpellVfx } = await import('../src/fight/spell-vfx.ts');
const fighters = [{ body: { x: 0, z: 0 } }, { body: { x: 1.5, z: 0.5 } }] as never;
const shown = (scene: THREE.Scene) => { let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) { let v: THREE.Object3D | null = o, ok = true; while (v) { if (!v.visible) ok = false; v = v.parent; } if (ok) n++; } }); return n; };
const light = (scene: THREE.Scene) => scene.children.find((c) => (c as THREE.PointLight).isPointLight) as THREE.PointLight;

test('without heal rows nothing is built (trunk): no objects, no light', () => {
  const saved = defs.spellHeal.splice(0); const scene = new THREE.Scene(); const v = createSpellVfx(scene);
  v.warm(() => undefined); v.trigger([{ type: 'SpecialLanded', actor: 0, target: 1, spell: 'brokkr', tick: 1 }], fighters); v.update(5);
  assert.equal(scene.children.length, 0); defs.spellHeal.push(...saved);
});

for (const [name, ev] of [
  ['heal', { type: 'SpecialLanded', actor: 0, target: 0, spell: 'gula', tick: 100, heal: 38 }],
  ['shock', { type: 'SpecialLanded', actor: 0, target: 1, spell: 'ugallu', tick: 100 }],
  ['ash', { type: 'SpecialLanded', actor: 0, target: 1, spell: 'brokkr', tick: 100 }],
  ['wind', { type: 'SpecialLanded', actor: 0, target: 1, spell: 'kamaitachi', tick: 100 }],
  ['nyx', { type: 'SpecialLanded', actor: 0, target: 1, spell: 'banshee', tick: 100 }],
] as const) {
  test(`${name}: hidden before, drawn while it plays, light rises, hidden and dark after`, () => {
    const scene = new THREE.Scene(), v = createSpellVfx(scene); let compiled = 0; v.warm(() => { compiled = shown(scene); });
    assert.ok(compiled > 20, 'warm() shows every part for one compile'); assert.equal(shown(scene), 0, 'and hides them again');
    v.update(99); assert.equal(shown(scene), 0, 'nothing before the landing'); assert.equal(light(scene).intensity, 0);
    v.trigger([ev], fighters); let peak = 0, lit = 0;
    for (let t = 100; t < 100 + 160; t++) { v.update(t); peak = Math.max(peak, shown(scene)); lit = Math.max(lit, light(scene).intensity); }
    assert.ok(peak >= 3, `${name} shows ${peak} parts at its peak`); assert.ok(lit > 0.5, `${name} lights the scene (${lit})`);
    v.update(100 + 200); assert.equal(shown(scene), 0, 'hidden once done'); assert.equal(light(scene).intensity, 0, 'dark once done');
  });
}

test('nyx anticipation: the windup shows a gather on the caster; a landing or a cut cast ends it at once', () => {
  for (const end of ['SpecialLanded', 'SpecialInterrupted'] as const) {
    const scene = new THREE.Scene(), v = createSpellVfx(scene); v.warm(() => undefined);
    v.trigger([{ type: 'SpecialStarted', actor: 0, spell: 'banshee', tick: 10 }], fighters);
    v.update(60); assert.ok(shown(scene) >= 3, 'gather drawn mid-windup'); assert.ok(light(scene).intensity > 0, 'and it glows');
    v.trigger([{ type: end, actor: 0, target: 1, spell: 'banshee', tick: 70 }], fighters); v.update(70);
    if (end === 'SpecialInterrupted') assert.equal(shown(scene), 0, 'a cut cast leaves nothing');
    else assert.ok(shown(scene) >= 3, 'the landing look replaces the gather');
  }
  const scene = new THREE.Scene(), v = createSpellVfx(scene); v.warm(() => undefined);   // a spell with no look of its own draws nothing in its windup
  v.trigger([{ type: 'SpecialStarted', actor: 0, spell: 'some-other-spell', tick: 10 }], fighters); v.update(60); assert.equal(shown(scene), 0);
});

for (const [name, spell] of [['heal', 'gula'], ['shock', 'ugallu'], ['wind', 'kamaitachi']] as const) {
  test(`${name} anticipation: a gather shows in the windup and a cut cast removes it`, () => {
    const scene = new THREE.Scene(), v = createSpellVfx(scene); v.warm(() => undefined);
    v.trigger([{ type: 'SpecialStarted', actor: 0, spell, tick: 10 }], fighters); v.update(60); assert.ok(shown(scene) >= 3, `${name} gather drawn mid-windup`);
    v.trigger([{ type: 'SpecialInterrupted', actor: 0, spell, tick: 70 }], fighters); v.update(70); assert.equal(shown(scene), 0);
  });
}

test('a spell landing far away is drawn bigger (3x from 10 m), up close stays 1x, a heal stays 1x', () => {
  const far = [{ body: { x: 0, z: 0 } }, { body: { x: 10, z: 0 } }] as never, scales = (ev: object, fs: never) => { const scene = new THREE.Scene(), v = createSpellVfx(scene); v.warm(() => undefined); v.trigger([ev as never], fs); v.update(110); return scene.children.filter((c) => (c as THREE.Group).isGroup && c.visible !== undefined && c.children.some((o) => o.visible)).map((g) => g.scale.x); };
  assert.deepEqual(scales({ type: 'SpecialLanded', actor: 0, target: 1, spell: 'brokkr', tick: 100 }, far), [3]);
  assert.deepEqual(scales({ type: 'SpecialLanded', actor: 0, target: 1, spell: 'brokkr', tick: 100 }, fighters), [1 + 2 * ((100 * Math.hypot(1.5, 0.5) - 100) / 900)]);   // the rows: 1x at 1 m rising evenly to 3x at 10 m
  assert.deepEqual(scales({ type: 'SpecialLanded', actor: 0, target: 0, spell: 'gula', tick: 100, heal: 38 }, far), [1]);
});

test('ash anticipation: Brokkr\'s windup shows an ember gather that a cut cast removes', () => {
  const scene = new THREE.Scene(), v = createSpellVfx(scene); v.warm(() => undefined);
  v.trigger([{ type: 'SpecialStarted', actor: 0, spell: 'brokkr', tick: 10 }], fighters); v.update(60); assert.ok(shown(scene) >= 3, 'ember gather mid-windup'); assert.ok(light(scene).intensity > 0);
  v.trigger([{ type: 'SpecialInterrupted', actor: 0, spell: 'brokkr', tick: 70 }], fighters); v.update(70); assert.equal(shown(scene), 0);
});
