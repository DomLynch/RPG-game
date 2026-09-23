// Fighter readability and a recessive background (owner's visual review via Strategy, 2026-09-23): bodies, hands and weapons
// separate from the pit while the worn palette stays. Material only — no light, draw, texture or asset is added.
//
// Why shader terms and not scene lights: a three.js light reaches EVERY mesh, so a key or rim light for the fighters would also lift
// the sand and wall this same pass is trying to push back. Both terms are therefore written into the fighters' own materials:
//   key — albedo-weighted Lambert from a direction fixed in VIEW space (upper-left, toward the camera), so whatever angle the fight
//         camera takes, the side of the fighter it sees is the lit side. Albedo-weighted keeps a dark torso dark relative to a steel
//         blade, which is the separation the Executioner needs.
//   rim — Fresnel edge light, biased to upward-facing edges like a real back light, so a silhouette reads against the sand.
// The background grade (sand, wall, crowd) desaturates toward luminance, compresses contrast around a pivot and scales value; with
// saturation < 1 and the pivot at the material's own mean the luminance a contract measures barely moves.
import * as THREE from 'three';

export const FIGHTER_LIGHT = {
  key: 0.55,                                                   // added radiance per unit albedo at full facing
  keyDirection: new THREE.Vector3(-0.45, 0.55, 0.7).normalize(),   // view space: left of, above and toward the camera
  rim: 0.5,
  rimColor: new THREE.Color('#fff1dc'),                         // warm off-white: the ash sky's break of light, not a stage gel
  rimPower: 3,
};

const LIT = 'fighterLit';
// Idempotent: every Standard/Physical material under `root` gets the key and rim once. Called after the rigs land and after every
// gear change (scene.ts dress()), so loot pieces that attach later are covered. Transparent materials (decals, effects) are left
// alone. The program is patched before the material's first draw on the load path, so no extra shader compile lands in a fight.
export function lightFighter(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.transparent || material.userData[LIT]) continue;
      material.userData[LIT] = true;
      const previous = material.onBeforeCompile.bind(material), previousKey = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        const L = FIGHTER_LIGHT;
        Object.assign(shader.uniforms, { fighterKey: { value: L.key }, fighterKeyDir: { value: L.keyDirection }, fighterRim: { value: L.rim }, fighterRimColor: { value: L.rimColor }, fighterRimPower: { value: L.rimPower } });
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float fighterKey; uniform vec3 fighterKeyDir; uniform float fighterRim; uniform vec3 fighterRimColor; uniform float fighterRimPower;')
          .replace('#include <opaque_fragment>', `{
  vec3 fN = normalize( normal );
  outgoingLight += diffuseColor.rgb * fighterKey * max( dot( fN, fighterKeyDir ), 0.0 );
  float fRim = pow( 1.0 - saturate( dot( fN, geometryViewDir ) ), fighterRimPower ) * ( 0.55 + 0.45 * saturate( fN.y + 0.3 ) );
  outgoingLight += fighterRimColor * fighterRim * fRim;
}
#include <opaque_fragment>`);
      };
      material.customProgramCacheKey = () => `${previousKey()}|fighter-light-v1`;
      material.needsUpdate = true;
    }
  });
}

export type Grade = { saturation: number; contrast: number; pivot: number; value: number };
// The background grade on one material, after its map and vertex colours (`color_fragment`). Chains any existing hook (the crowd's
// garment mix). `pivot` is linear albedo: contrast compresses toward it, so choose the material's own mean.
export function gradeMaterial(material: THREE.MeshStandardMaterial, grade: Grade, key: string) {
  const previous = material.onBeforeCompile.bind(material), previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.grade = { value: new THREE.Vector4(grade.saturation, grade.contrast, grade.pivot, grade.value) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 grade;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float gL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb = ( mix( vec3( grade.z ), mix( vec3( gL ), diffuseColor.rgb, grade.x ), grade.y ) ) * grade.w;
}`);
  };
  material.customProgramCacheKey = () => `${previousKey()}|grade-${key}`;
  return material;
}

// The pass's values, one place to tune. Sand and wall: "slight desaturation" — colour is pulled toward grey, contrast untouched.
// Crowd: darker, greyer and flatter so 291 figures read as a mass behind the fight, not as figures in it.
export const BACKGROUND_GRADE = {
  sand: { saturation: 0.75, contrast: 1, pivot: 0.1, value: 0.97 },
  stone: { saturation: 0.72, contrast: 1, pivot: 0.1, value: 0.95 },
  crowd: { saturation: 0.55, contrast: 0.7, pivot: 0.04, value: 0.78 },
} satisfies Record<string, Grade>;
