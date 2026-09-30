// Look passes for Dom's fidelity decision (2026-09-27 via Strategy), presentation only: no sim, asset or default-path change. Without a
// `?look=` flag nothing here is built or compiled. The two tokens combine (`?look=souls,shade`) for the 2×2 he judges from.
//
// `souls` ("look as good as Souls / Elden Ring on mobile web"), a light-and-materials pass at the fight camera:
//  1. Light: the key keeps the arena's own sun (direction and colour); the hemisphere fill drops so the key models the form, and a warm
//     rim light in the sun's colour sits behind the fighters as the camera sees them (it follows the camera's yaw, low, casts no shadow).
//  2. Materials: fighter materials reflect the arena sky harder (metal takes the reflection; the metal-roughness map already knows which
//     texel is steel and which is leather). Named metals polish a little; named cloth goes duller and stops reflecting.
//  3. Contact shadow: a soft dark blob under each fighter, between his feet, fading as the feet leave the floor.
//  4. AgX filmic tonemap (the renderer's own, no extra pass) and a slight vignette (a CSS overlay above the canvas: no GPU pass).
//     Bloom, above a high threshold so only sparks and lit edges glow, needs a half-float post chain.
//  5. The phone tier drops the bloom and with it the whole post chain (`?bloom=1` forces it on, `?bloom=0` off): a multisampled
//     half-float target is ~60 MB more GPU memory at the phone's pixel ratio, the pressure behind the iPhone black-fighters defect
//     (quality.ts). Everything else stays on phone.
//
// Grit over gloss (Dom rejected #537's key + rim as "shining, not gritty/real"): the rim is dim and dusty, fighter roughness goes UP, the
// sky reflection only a little, and no material is polished.
//
// `shade` (a Shadow-Fight-in-3D identity): bodies and worn armour go near-black and unlit, with a fresnel rim that is strongest on the
// side facing the arena's key light, so limbs and orientation read. The hero's rim is warm and the opponent's is crimson. A worn piece
// above Legionary rims in its rank's colour instead (rank-tint.ts `rankTier`). Eyes glow. Weapons and shields keep their textures and
// light, so the blade is the contrast. Blood, sparks and the arena are not touched.
//
// Precedent (colour-grade.ts): the key + rim of #537 was reverted on Dom's phone as "shining, not gritty/real". Keep all of this behind
// its flag until Dom has seen phone stills. Default-on also needs Web's load-time A/B gate (Lead 2026-09-27: head ≤ base + 1.0 s at 9 Mbps).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Tier } from './grades.ts';
import type { Look } from './look-flag.ts';

// One place to tune.
export const SOULS = {
  hemisphere: 0.55,       // × the theme's fill: less flat ambient, so the key and the rim model the form
  key: 1.2,               // × the theme's sun
  rim: 0.9,               // rim intensity: a dusty edge, not a highlight
  rimWarm: '#c9905e',     // mixed 50 % into the sun colour: warm, desaturated
  rimElevation: 0.3,      // rad above the horizon: low, so it grazes silhouettes and barely lights the sand
  envFighter: 1.25,       // envMapIntensity on fighter materials: metal reads as metal, never chrome
  rough: 1.15,            // × roughness on every fighter material: worn, not polished (capped at 1)
  clothRough: 0.95,       // floor on named cloth roughness
  clothEnv: 0.4,          // envMapIntensity on named cloth
  blob: { radius: 0.62, opacity: 0.55, lift: 0.35 },   // contact shadow: metres, alpha, and the foot height where it has faded out
  bloom: { strength: 0.25, radius: 0.3, threshold: 1.0 },
  vignette: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(8, 6, 4, 0.5) 100%)',
  exposure: 1.1,          // × the theme's exposure: AgX sits darker than ACES at the same exposure
} as const;
export const SHADE = {
  base: '#0a0a0c',        // the silhouette's own colour, unlit
  grain: 0.45,            // the rim keeps this much where the texture is darkest: dirt and wear break the edge up
  power: 2.6,             // fresnel falloff: higher is a thinner rim
  strength: 2.2,          // rim brightness (linear, before tonemap)
  lightBias: 0.35,        // the rim on the side away from the key keeps this much
  hero: '#ffae5c',        // warm
  opponent: '#ff3b2e',    // crimson
  eyes: '#ffcf8a',
  eyesStrength: 2.5,
} as const;
// The rim a worn piece takes at its rank (Strategy 2026-09-27: rag no glow, bronze warm, iron/steel cool white, emerald green, gold gold).
export const SHADE_RANK: Partial<Record<Tier, string>> = {
  Gladiator: '#eadfc4', Veteran: '#ff9458', Champion: '#ffb65a', Praetorian: '#c6d2de', Master: '#eef4ff', Primus: '#a4b6cc', Invictus: '#3cff9a', Origin: '#ffd24a',
};

const CLOTH = /cloth|gambeson|felt|wrap|linen|wool|horsehair/i,
  EYES = /eyes/i;

function blobTexture() {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!, gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// A weapon (under the rig's drawn/sheathed nodes) or a shield keeps its own look in `shade`.
function armed(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (o.userData.slot === 'Shield' || /^(WeaponDrawn|SwordDrawn|SwordSheathed)(_\d+)?$/.test(o.name)) return true;
  }
  return false;
}

export function createLook(look: Look, opts: {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  hemisphere: THREE.HemisphereLight; sun: THREE.DirectionalLight; canvas: HTMLCanvasElement;
}) {
  const { renderer, scene, camera, hemisphere, sun, canvas } = opts;
  const keyView = { value: new THREE.Vector3() };   // the key light's direction in view space, shared by every shade program
  let rim: THREE.DirectionalLight | undefined, blobs: THREE.Mesh[] = [], composer: EffectComposer | undefined;

  if (look.souls) {
    hemisphere.intensity *= SOULS.hemisphere;
    sun.intensity *= SOULS.key;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure *= SOULS.exposure;
    rim = new THREE.DirectionalLight(sun.color.clone().lerp(new THREE.Color(SOULS.rimWarm), 0.5), SOULS.rim);
    scene.add(rim, rim.target);
    const blobMaterial = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: SOULS.blob.opacity, polygonOffset: true, polygonOffsetFactor: -2, fog: false }),
      blobGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    blobs = [0, 1].map(() => {
      const blob = new THREE.Mesh(blobGeometry, blobMaterial.clone());
      blob.renderOrder = 1;
      blob.visible = false;
      scene.add(blob);
      return blob;
    });
    const vignette = document.createElement('div');
    vignette.id = 'look-vignette';
    Object.assign(vignette.style, { position: 'fixed', inset: '0', pointerEvents: 'none', background: SOULS.vignette });
    canvas.after(vignette);
    if (look.bloom) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), SOULS.bloom.strength, SOULS.bloom.radius, SOULS.bloom.threshold));
      composer.addPass(new OutputPass());
    }
  }

  function soulsMaterial(material: THREE.MeshStandardMaterial) {
    material.roughness = Math.min(1, material.roughness * SOULS.rough);
    if (CLOTH.test(material.name)) {
      material.roughness = Math.max(material.roughness, SOULS.clothRough);
      material.envMapIntensity = SOULS.clothEnv;
    } else material.envMapIntensity = SOULS.envFighter;
  }
  function shadeMaterial(material: THREE.MeshStandardMaterial, side: 0 | 1) {
    const rank = SHADE_RANK[material.userData.rankTier as Tier], eyes = EYES.test(material.name);
    const rimColour = new THREE.Color(eyes ? SHADE.eyes : rank ?? (side === 0 ? SHADE.hero : SHADE.opponent));
    const previous = material.onBeforeCompile.bind(material), previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, r) => {
      previous(shader, r);
      shader.uniforms.shadeRim = { value: rimColour };
      shader.uniforms.shadeKey = keyView;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 shadeRim;\nuniform vec3 shadeKey;')
        .replace('#include <opaque_fragment>', eyes
          ? `outgoingLight = shadeRim * ${SHADE.eyesStrength.toFixed(2)};\n#include <opaque_fragment>`
          : `{
  vec3 shadeView = normalize( vViewPosition );
  float shadeF = pow( 1.0 - saturate( dot( normal, shadeView ) ), ${SHADE.power.toFixed(2)} );
  float shadeL = ${SHADE.lightBias.toFixed(2)} + ${(1 - SHADE.lightBias).toFixed(2)} * saturate( dot( normal, shadeKey ) * 0.5 + 0.5 );
  float shadeG = mix( ${SHADE.grain.toFixed(2)}, 1.0, saturate( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) * 4.0 ) );
  outgoingLight = vec3( ${new THREE.Color(SHADE.base).toArray().map((c) => c.toFixed(4)).join(', ')} ) + shadeRim * ( shadeF * shadeL * shadeG * ${SHADE.strength.toFixed(2)} );
}
#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${previousKey()}|shade-${eyes ? 'eyes' : 'rim'}`;
    material.needsUpdate = true;
  }

  const seen = new WeakSet<THREE.Material>();
  function treat(root: THREE.Object3D | null | undefined, side: 0 | 1) {
    root?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || seen.has(material)) continue;
        seen.add(material);
        const weapon = armed(mesh);
        if (look.shade && !weapon) shadeMaterial(material, side);
        else if (look.souls) soulsMaterial(material);
      }
    });
  }

  const forward = new THREE.Vector3(), mid = new THREE.Vector3();
  let frame = 0;
  return {
    key: look.souls ? SOULS.key : 1,   // a flickering theme rewrites the sun's intensity each frame (scene.ts); it multiplies by this
    // Fighters and their loot pieces arrive late (rigs, then the carrier cut, then worn loot): new materials are picked up twice a second.
    update(fighters: readonly [THREE.Object3D | null | undefined, THREE.Object3D | null | undefined], feet: readonly (THREE.Vector3 | null)[]) {
      if (frame++ % 30 === 0) { treat(fighters[0], 0); treat(fighters[1], 1); }
      if (look.shade) keyView.value.copy(sun.position).sub(sun.target.position).transformDirection(camera.matrixWorldInverse);
      if (!rim) return;
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      // Behind the fighters as seen from the camera, raised by rimElevation: the rim lights the edges that face away from the lens.
      rim.position.set(forward.x * Math.cos(SOULS.rimElevation), Math.sin(SOULS.rimElevation), forward.z * Math.cos(SOULS.rimElevation)).multiplyScalar(30);
      for (let i = 0; i < 2; i++) {
        const left = feet[i * 2], right = feet[i * 2 + 1], blob = blobs[i]!;
        if (!left || !right) { blob.visible = false; continue; }
        mid.addVectors(left, right).multiplyScalar(0.5);
        const lift = Math.min(left.y, right.y), spread = Math.hypot(left.x - right.x, left.z - right.z);
        blob.visible = true;
        blob.position.set(mid.x, 0.012, mid.z);
        blob.scale.setScalar(SOULS.blob.radius * 2 + spread * 0.6);
        (blob.material as THREE.MeshBasicMaterial).opacity = SOULS.blob.opacity * Math.max(0, 1 - lift / SOULS.blob.lift);
      }
    },
    // The post chain renders only when bloom built one; otherwise the renderer's own path draws the frame.
    render(): boolean {
      if (!composer) return false;
      composer.render();
      return true;
    },
    setSize(width: number, height: number, pixelRatio: number) {
      composer?.setPixelRatio(pixelRatio);
      composer?.setSize(width, height);
    },
  };
}
