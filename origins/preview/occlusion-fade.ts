// The cutaway: scenery between the camera and the hero dissolves, so a rock or a wall never hides the fighter (Dom 2026-10-17: the rocks hide the hero's legs in the fight camera).
// One shared material patch, no per-object work: every fragment of a patched material measures its distance to the line from the hero's chest to the camera and, inside the tube, is dithered away.
// Only what is actually on that line goes, so nothing needs a ray cast and the merged meshes stay merged. Donor: the isometric RPGs' cutaway (Diablo / Path of Exile fade the wall in front of the hero).
// Every number is a row (preview-rules-defs.json, occFade*). Presentation only; the sim never reads it.
import * as THREE from 'three';
import { previewRule } from './preview-rules.ts';

export function createOcclusionFade(enabled = true) {
  const uniforms = {
    uFadeHero: { value: new THREE.Vector3() }, uFadeCam: { value: new THREE.Vector3(0, 1, 1) },
    uFadeR: { value: previewRule('occFadeRadius') }, uFadeNear: { value: previewRule('occFadeNear') }, uFadeAmount: { value: enabled ? previewRule('occFadeStrength') : 0 },
  };
  return {
    uniforms,
    /** Makes `material` take part: its fragments dissolve inside the tube. Returns the same material. */
    patch<T extends THREE.Material>(material: T): T {
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvFadeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFadeW; uniform vec3 uFadeHero; uniform vec3 uFadeCam; uniform float uFadeR; uniform float uFadeNear; uniform float uFadeAmount;')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  { vec3 ab = uFadeCam - uFadeHero; float t = clamp(dot(vFadeW - uFadeHero, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float tube = (1.0 - smoothstep(uFadeR * 0.55, uFadeR, length(vFadeW - (uFadeHero + ab * t)))) * smoothstep(uFadeNear, uFadeNear + 0.08, t) * (1.0 - smoothstep(0.96, 1.0, t));
    if (uFadeAmount * tube > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard; }`);
      };
      material.customProgramCacheKey = () => 'occlusion-fade';
      return material;
    },
    /** Once a frame, after the camera is placed: the hero's chest (world) and the camera's eye. */
    update(hero: THREE.Vector3, eye: THREE.Vector3): void { uniforms.uFadeHero.value.copy(hero); uniforms.uFadeCam.value.copy(eye); },
  };
}
export type OcclusionFade = ReturnType<typeof createOcclusionFade>;
