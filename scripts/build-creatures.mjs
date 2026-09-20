// Original reconstructed surfaces -> mobile geometry -> shared combat clips and weapon attachments.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { appendQuietOne } from './build-quiet-one.mjs';
const selected=process.argv[2],families=selected?[selected]:['minotaur','wraith','werewolf','skeleton','dwarf','executioner'];
if(families.some(f=>!['minotaur','wraith','werewolf','skeleton','dwarf','executioner'].includes(f)))throw new Error('Choose minotaur, wraith, werewolf, skeleton, dwarf or executioner');
await fs.mkdir('artifacts/character/creatures',{recursive:true});
for(const family of families){
 for(const [cmd,args]of [[process.env.BLENDER||'blender',['-b','--python-exit-code','1','-P','scripts/character/creatures.py','--',family]],['python3',['scripts/character/creature_pack.py',family]],...(['minotaur','wraith'].includes(family)?[['node',['scripts/build-creature-weapons.mjs',family]]]:[])]){
  const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} failed (${r.status})`);
 }
 await appendQuietOne(`src/assets/${family}.glb`); // the corpse pose is grounded on this body's own skin envelope, not the donor's
}
