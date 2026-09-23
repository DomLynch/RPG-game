// Original reconstructed surfaces -> mobile geometry -> shared combat clips and weapon attachments.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { appendQuietOne } from './build-quiet-one.mjs';
const selected=process.argv[2],families=selected?[selected]:['minotaur','wraith','werewolf','skeleton','dwarf','executioner','veteran','witch'];
if(families.some(f=>!['minotaur','wraith','werewolf','skeleton','dwarf','executioner','veteran','witch'].includes(f)))throw new Error('Choose minotaur, wraith, werewolf, skeleton, dwarf, executioner, veteran or witch');
await fs.mkdir('artifacts/character/creatures',{recursive:true});
for(const family of families){
 // The dwarf's donor is a re-proportioned build of the CC0 rig wearing the Veteran's parts (BUILD.dwarf in build-warrior.mjs); rebuild it first.
 if(family==='dwarf'){const r=spawnSync('node',['scripts/build-warrior.mjs'],{stdio:'inherit',env:{...process.env,WARRIOR_FIGHTER:'dwarf',WARRIOR_WEAPON:'warhammer',WARRIOR_PARTS_VARIANT:'veteran',WARRIOR_OUT:'src/assets/source/creatures/dwarf-donor.glb'}});if(r.error)throw r.error;if(r.status!==0)throw new Error(`donor build failed (${r.status})`);}
 for(const [cmd,args]of [[process.env.BLENDER||'blender',['-b','--python-exit-code','1','-P','scripts/character/creatures.py','--',family]],['python3',['scripts/character/creature_pack.py',family]],...(['minotaur','wraith'].includes(family)?[['node',['scripts/build-creature-weapons.mjs',family]]]:[])]){
  const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} failed (${r.status})`);
 }
 await appendQuietOne(`src/assets/${family}.glb`); // the corpse pose is grounded on this body's own skin envelope, not the donor's
}
