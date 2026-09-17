// Edge-leading check: at each sword path's active window on a rig, the weapon node's local +x (the cleaver's edge) vs the tip's motion.
import fs from 'node:fs/promises'; import { AnimationMixer, Vector3, Quaternion } from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { swingProgress } from '../../../src/blade.ts'; import { PATHS, total } from '../../../src/moves.ts';
globalThis.ProgressEvent=class{constructor(_,f){Object.assign(this,f)}};
const [file, node] = process.argv.slice(2);
const bytes=await fs.readFile(file), size=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+size)); json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name})); json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),''), mixer=new AnimationMixer(asset.scene), blade=asset.scene.getObjectByName(node);
for (const [kind,spec] of Object.entries(PATHS)) { if (kind.endsWith('_chain')) continue;
 const n=total(spec), clip=asset.animations.find(c=>c.name===spec.clip), action=mixer.clipAction(clip).play();
 const at=age=>{ mixer.setTime(Math.min(.999999,swingProgress(age/n,spec.windup/n,spec.source))*clip.duration); asset.scene.updateMatrixWorld(true); return { tip: blade.localToWorld(new Vector3(0,.86,0)), q: blade.getWorldQuaternion(new Quaternion()) }; };
 // over the ACTIVE window (windup → windup+active): motion of the tip, and the edge direction at its middle
 const a=at(spec.windup), b=at(spec.windup+spec.active), v=b.tip.clone().sub(a.tip), len=v.length(); v.normalize();
 const q=at(spec.windup+Math.floor(spec.active/2)).q, edge=new Vector3(1,0,0).applyQuaternion(q), flat=new Vector3(0,0,1).applyQuaternion(q);
 console.log(kind.padEnd(16), spec.clip.padEnd(8), 'tip moves', v.toArray().map(c=>c.toFixed(2)).join(','), `(${len.toFixed(2)} m)`, '| edge·v', edge.dot(v).toFixed(2), 'flat·v', flat.dot(v).toFixed(2), '| edge dir', edge.toArray().map(c=>c.toFixed(2)).join(','));
 action.stop(); mixer.uncacheClip(clip); }
