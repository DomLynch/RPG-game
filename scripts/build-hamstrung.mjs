import {appendFinisher} from './append-finisher.mjs';
import {poseRig,smooth} from './finisher-pose.mjs';
export const HAMSTRUNG_BEATS={knee:.22,back:.64,duration:3.8,hold:.07};
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

export const appendHamstrung=file=>appendFinisher(file,'Hamstrung',hamstrungClips);
