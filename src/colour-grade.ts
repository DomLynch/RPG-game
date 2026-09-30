// A recessive background (owner's visual review via Strategy, 2026-09-23): sand, wall and crowd step back so the fighters separate
// from the pit while the worn palette stays. Material only — no light, draw, texture or asset is added.
//
// The fighter key + rim that shipped beside this in #537 was reverted on the owner's phone look (2026-09-23: "shining now and not
// gritty/real"). The fighters keep their pre-#537 matte materials; do not add a light term to them without his eye on a phone still.
//
// The grade desaturates toward luminance, compresses contrast around a pivot and scales value; with saturation < 1 and the pivot at
// the material's own mean the luminance a contract measures barely moves.
import * as THREE from 'three';

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
