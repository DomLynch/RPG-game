import {appendFinisher} from './append-finisher.mjs';
import {poseRig,smooth} from './finisher-pose.mjs';
import {HAMSTRUNG_BEATS} from '../src/hamstrung.ts';
export {HAMSTRUNG_BEATS};
export function hamstrungClips(scene,clips) {
 const rig=poseRig(scene,clips),{knee,back,duration}=HAMSTRUNG_BEATS;
 rig.sample('Armed');const standing=rig.capture();
 rig.sample('Death_RunThrough',1);const kneeling=rig.capture();
 const victim=rig.make('Death_Hamstrung',duration,p=>{
  rig.blend(standing,kneeling,smooth((p-knee)/(.50-knee)));
  rig.lean(.7*smooth((p-.25)/.3));
  // The second strike gives one short recoil, then the embedded tableau holds.
  rig.bone('Head').rotation.x+=.2*Math.sin(Math.PI*smooth((p-back)/.12));
  rig.ground();
 },[knee,back]);
 const keys=[[0,'Armed',0,0],[.12,'Attack',.1,.45],[knee,'Attack',.38,1],[.34,'Attack',.65,.5],[.48,'Heavy',.12,0],[.56,'Fin_RunThrough',.05,0],[back,'Fin_RunThrough',.25,0],[1,'Fin_RunThrough',.25,0]].map(([time,name,phase,crouch])=>{
  rig.sample(name,phase);if(crouch){const feet=rig.feet();const pelvis=rig.bone('pelvis'),position=rig.point(pelvis);position.y-=.32*rig.scale*crouch;pelvis.position.copy(pelvis.parent.worldToLocal(position));rig.lean(.65*crouch);rig.plant(feet);}return{time,pose:rig.capture()};
 });
 const killer=rig.make('Fin_Hamstrung',duration,p=>rig.interpolate(keys,p),keys.map(k=>k.time));
 rig.restore();return[victim,killer];
}

// Both halves ship as plain clip JSON beside warrior.glb, adopted at runtime by characters.ts adoptClip, so warrior.glb stays untouched: the killer's
// Fin_Hamstrung (always the player's) and the victim's Death_Hamstrung for every body on the hero rig (src/hamstrung.ts HAMSTRUNG_VICTIMS). minotaur.glb
// and wraith.glb also carry a Death_Hamstrung appended to them, fitted to the creatures' feet.
export const KILLER_JSON=new URL('../src/assets/hamstrung-killer.json',import.meta.url);
export const VICTIM_JSON=new URL('../src/assets/hamstrung-victim-hero.json',import.meta.url);
const round=a=>Array.from(a,v=>Math.round(v*1e5)/1e5);
async function writeHamstrungJson(index,file,out) {
 const fs=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
 json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
 const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const clip=hamstrungClips(asset.scene,asset.animations)[index].optimize(),data=clip.toJSON();
 delete data.uuid;   // random per call: the build must be byte-stable
 for(const t of data.tracks){t.times=round(t.times);t.values=round(t.values);}
 const text=JSON.stringify(data)+'\n';await fs.writeFile(out,text);return {file:out.pathname,bytes:text.length,tracks:data.tracks.length};
}
const WARRIOR=new URL('../src/assets/warrior.glb',import.meta.url);
export const writeHamstrungVictim=(file=WARRIOR,out=VICTIM_JSON)=>writeHamstrungJson(0,file,out);
export const writeHamstrungKiller=(file=WARRIOR,out=KILLER_JSON)=>writeHamstrungJson(1,file,out);
// Victim clip on each creature that falls to it; `names` picks the clip an appended rig carries.
export const appendHamstrung=(file,names=['Death_Hamstrung'])=>appendFinisher(file,'Hamstrung',(scene,clips)=>hamstrungClips(scene,clips).filter(c=>names.includes(c.name)),names);
if(process.argv[1]===new URL(import.meta.url).pathname){
 // node scripts/build-hamstrung.mjs: rebuild every Hamstrung asset (re-running an unchanged build is byte-identical)
 const assets=new URL('../src/assets/',import.meta.url);
 for(const rig of ['minotaur','wraith'])console.log(await appendHamstrung(new URL(rig+'.glb',assets).pathname));
 console.log(await writeHamstrungVictim());
 console.log(await writeHamstrungKiller());
}
