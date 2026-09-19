// Original reconstructed surfaces -> mobile geometry -> shared combat clips and weapon attachments.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
const selected=process.argv[2],families=selected?[selected]:['minotaur','wraith'];
if(families.some(f=>!['minotaur','wraith'].includes(f)))throw new Error('Choose minotaur or wraith');
await fs.mkdir('artifacts/character/creatures',{recursive:true});
for(const family of families){
 for(const [cmd,args]of [[process.env.BLENDER||'blender',['-b','--python-exit-code','1','-P','scripts/character/creatures.py','--',family]],['python3',['scripts/character/creature_pack.py',family]],['node',['scripts/build-creature-weapons.mjs',family]]]){
  const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} failed (${r.status})`);
 }
}
