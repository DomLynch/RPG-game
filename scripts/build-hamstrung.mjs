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

// Death_Hamstrung is appended to the GLBs of the creatures that fall to it (minotaur, wraith). The killer's Fin_Hamstrung is always the player's, so it
// ships beside warrior.glb as plain clip JSON (src/assets/hamstrung-killer.json, adopted at runtime by characters.ts adoptClip) and warrior.glb stays untouched.
export const KILLER_JSON=new URL('../src/assets/hamstrung-killer.json',import.meta.url);
const round=a=>Array.from(a,v=>Math.round(v*1e5)/1e5);
export async function writeHamstrungKiller(file=new URL('../src/assets/warrior.glb',import.meta.url),out=KILLER_JSON) {
 const fs=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
 json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
 const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const clip=hamstrungClips(asset.scene,asset.animations)[1].optimize(),data=clip.toJSON();
 delete data.uuid;   // random per call: the build must be byte-stable
 for(const t of data.tracks){t.times=round(t.times);t.values=round(t.values);}
 const text=JSON.stringify(data)+'\n';await fs.writeFile(out,text);return {file:out,bytes:text.length,tracks:data.tracks.length};
}
// Victim clip on each creature that falls to it; `names` picks the clip an appended rig carries.
export const appendHamstrung=(file,names=['Death_Hamstrung'])=>appendFinisher(file,'Hamstrung',(scene,clips)=>hamstrungClips(scene,clips).filter(c=>names.includes(c.name)),names);
if(process.argv[1]===new URL(import.meta.url).pathname){
 // node scripts/build-hamstrung.mjs: rebuild every Hamstrung asset (re-running an unchanged build is byte-identical)
 const assets=new URL('../src/assets/',import.meta.url);
 for(const rig of ['minotaur','wraith'])console.log(await appendHamstrung(new URL(rig+'.glb',assets).pathname));
 console.log(await writeHamstrungKiller());
}
