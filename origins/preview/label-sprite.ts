// The name tag over a creature or another player: a canvas sprite that keeps one size on screen at any distance (moved out of mobs-view.ts so remote-heroes.ts draws the same tag).
import * as THREE from 'three';

export function labelSprite(text: string, named: boolean): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '600 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 40; while (size > 20 && g.measureText(text).width > c.width - 24) { size -= 2; g.font = `600 ${size}px Georgia, serif`; }
  g.lineWidth = 7; g.strokeStyle = 'rgba(10,8,6,0.85)'; g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = named ? '#f2c66d' : '#ece0c8'; g.fillText(text, c.width / 2, c.height / 2);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.2, 0.0375, 1); return s;   // sizeAttenuation off: the same size on screen at any distance (a creature next to the camera no longer fills it)
}
