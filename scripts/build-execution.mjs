import * as T from 'three';
import {poseRig,smooth} from './finisher-pose.mjs';
import {EXECUTION_BEATS} from '../src/execution.ts';
export {EXECUTION_BEATS};
// Execution: the victim is forced to his knees and turned away (head bowed, weapon let go); the killer steps in behind him, raises the blade and holds it
// (both rigs hold one pose from `raise` to `release`: the held half-second is in the clips, the scene's clock just runs); one cut to the nape; he pitches
// forward onto his face. Built from warrior.glb's own clips (Armed, Death_RunThrough, Death, Heavy) with the shared pose rig: no Blender.
export function executionClips(scene,clips) {
 const rig=poseRig(scene,clips),{drop,kneel,raise,release,strike,fall,duration}=EXECUTION_BEATS;
 const spin=(axis,angle)=>{const pelvis=rig.bone('pelvis');scene.updateMatrixWorld(true);const q=new T.Quaternion().setFromAxisAngle(axis,angle).multiply(pelvis.getWorldQuaternion(new T.Quaternion()));pelvis.quaternion.copy(pelvis.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));scene.updateMatrixWorld(true);};
 const fit=()=>{const bounds=new T.Box3();scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();bounds.expandByObject(o,true);}});const pelvis=rig.bone('pelvis'),p=rig.point(pelvis);p.y+=.006-bounds.min.y;pelvis.position.copy(pelvis.parent.worldToLocal(p));scene.updateMatrixWorld(true);};
 rig.sample('Armed');const standing=rig.capture();
 // Kneeling: Death_RunThrough's kneel, turned to face away from the killer, the head bowed and the back rounded over it.
 rig.sample('Death_RunThrough',1);spin(new T.Vector3(0,1,0),Math.PI);rig.lean(-.3);rig.bone('Head').rotation.x+=-.55;rig.bone('neck_01').rotation.x+=-.2;scene.updateMatrixWorld(true);const kneeling=rig.capture();
 // Prone: Death's end (he falls backward), turned over about the pelvis so he lies on his face with his head where he was facing.
 rig.sample('Death',1);spin(new T.Vector3(0,0,1),Math.PI);const prone=rig.capture();
 const victim=rig.make('Death_Execution',duration,p=>{
  if(p<=strike)rig.blend(standing,kneeling,smooth((p-drop)/(kneel-drop)));
  else rig.blend(kneeling,prone,smooth((p-strike)/(fall-strike)));
  if(p<drop+.02)rig.ground();else fit();
 },[drop,kneel,raise,release,strike,fall]);
 // The killer: steps in on the Armed stance, raises the Heavy's overhead pose and holds it, cuts down, follows through and stays down on the blade.
 rig.sample('Heavy',.3);const planted=rig.feet();
 // The wrist turns the blade onto a given direction (the Heavy's own wrist leaves it sideways): up over his shoulder for the hold, then over and down in front of him.
 const bladeTo=(x,y,z)=>{const hand=rig.bone('hand_r'),blade=rig.bone('SwordDrawn');scene.updateMatrixWorld(true);const now=new T.Vector3(0,1,0).applyQuaternion(blade.getWorldQuaternion(new T.Quaternion())),q=new T.Quaternion().setFromUnitVectors(now,new T.Vector3(x,y,z).normalize());hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q).multiply(hand.getWorldQuaternion(new T.Quaternion())));scene.updateMatrixWorld(true);};
 const pose=(name,phase,lean=0,crouch=0,up=null)=>{rig.sample(name,phase);if(name!=='Armed'){if(crouch){const pelvis=rig.bone('pelvis'),position=rig.point(pelvis);position.y-=.2*rig.scale*crouch;pelvis.position.copy(pelvis.parent.worldToLocal(position));}if(lean)rig.lean(lean);rig.plant(planted);}if(up)bladeTo(...up);return rig.capture();};
 // The cut: the blade swings over from the vertical to down-and-forward in four even steps of the wrist, so no frame turns it more than the rig's own heavy does.
 const swing=[1,2,3].map(i=>{const a=(-16.7+i*37.9)*Math.PI/180;return [release+(strike-release)*i/4,pose('Heavy',.3+.1*i/4,.08+.17*i/4,.2*i/4,[0,Math.cos(a),Math.sin(a)])];});
 const keys=[[0,pose('Armed',0)],[.16,pose('Armed',.25)],[raise,pose('Heavy',.3,.08,0,[0,1,-.3])],[release,pose('Heavy',.3,.08,0,[0,1,-.3])],...swing,[strike,pose('Heavy',.4,.25,.2,[0,-.7,.7])],[.7,pose('Heavy',.5,.3,.3)],[1,pose('Heavy',.5,.3,.3)]].map(([time,p])=>({time,pose:p}));
 const killer=rig.make('Fin_Execution',duration,p=>rig.interpolate(keys,p),keys.map(k=>k.time));
 rig.restore();return[victim,killer];
}

// Both halves ship as plain clip JSON beside warrior.glb, adopted at runtime by characters.ts adoptClip: warrior.glb stays untouched.
export const KILLER_JSON=new URL('../src/assets/execution-killer.json',import.meta.url);
export const VICTIM_JSON=new URL('../src/assets/execution-victim-hero.json',import.meta.url);
const round=a=>Array.from(a,v=>Math.round(v*1e5)/1e5);
async function writeExecutionJson(index,file,out) {
 const fs=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const bytes=await fs.readFile(file),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
 json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name}));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
 globalThis.ProgressEvent ??= class {constructor(_,fields){Object.assign(this,fields);}};
 const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const clip=executionClips(asset.scene,asset.animations)[index].optimize(),data=clip.toJSON();
 delete data.uuid;   // random per call: the build must be byte-stable
 for(const t of data.tracks){t.times=round(t.times);t.values=round(t.values);}
 const text=JSON.stringify(data)+'\n';await fs.writeFile(out,text);return {file:out.pathname,bytes:text.length,tracks:data.tracks.length};
}
const WARRIOR=new URL('../src/assets/warrior.glb',import.meta.url);
export const writeExecutionVictim=(file=WARRIOR,out=VICTIM_JSON)=>writeExecutionJson(0,file,out);
export const writeExecutionKiller=(file=WARRIOR,out=KILLER_JSON)=>writeExecutionJson(1,file,out);
if(process.argv[1]===new URL(import.meta.url).pathname){
 // node scripts/build-execution.mjs: rebuild both Execution clips (re-running an unchanged build is byte-identical)
 console.log(await writeExecutionVictim());
 console.log(await writeExecutionKiller());
}
