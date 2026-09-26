// Original reconstructed surfaces -> mobile geometry -> shared combat clips and weapon attachments.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { appendQuietOne } from './build-quiet-one.mjs';
import { swapWeaponPart } from './character/swap-weapon-part.mjs';
const KNOWN=['minotaur','wraith','werewolf','skeleton','dwarf','executioner','veteran','plaguedoctor','knight','witch','legionary'];
const selected=process.argv[2],families=selected?[selected]:KNOWN;
if(families.some(f=>!KNOWN.includes(f)))throw new Error(`Choose one of ${KNOWN.join(', ')}`);
await fs.mkdir('artifacts/character/creatures',{recursive:true});
for(const family of families){
 // The dwarf's donor is a re-proportioned build of the CC0 rig wearing the Veteran's parts (BUILD.dwarf in build-warrior.mjs); rebuild it first.
 // The Knight is a new humanoid, so like the Dwarf he has no prior rig of his own: his donor is the hero rig at his own
 // scale (BUILD.knight in build-warrior.mjs), and creature_pack.py replaces its body with the TRELLIS surface. He carries
 // the maul: WEAPON_BUILDS.maul, the part plus Weapons' 12-clip Maul_* family on the hero rig (#572).
 // Bounded at 30 min: deploy #71 sat an hour in a child with no timeout anywhere in its chain (tests/child-process-bounds.test.ts).
 if(family==='knight'){const r=spawnSync('node',['scripts/build-warrior.mjs'],{stdio:'inherit',timeout:30*60_000,env:{...process.env,WARRIOR_FIGHTER:'knight',WARRIOR_WEAPON:'maul',WARRIOR_PARTS_VARIANT:'veteran',WARRIOR_OUT:'src/assets/source/creatures/knight-donor.glb'}});if(r.error)throw r.error;if(r.status!==0)throw new Error(`donor step failed (${r.status})`);}
 if(family==='dwarf'){const r=spawnSync('node',['scripts/build-warrior.mjs'],{stdio:'inherit',env:{...process.env,WARRIOR_FIGHTER:'dwarf',WARRIOR_WEAPON:'warhammer',WARRIOR_PARTS_VARIANT:'veteran',WARRIOR_OUT:'src/assets/source/creatures/dwarf-donor.glb'}});if(r.error)throw r.error;if(r.status!==0)throw new Error(`donor build failed (${r.status})`);}
 for(const [cmd,args]of [[process.env.BLENDER||'blender',['-b','--python-exit-code','1','-P','scripts/character/creatures.py','--',family]],['python3',['scripts/character/creature_pack.py',family]],...(['minotaur','wraith'].includes(family)?[['node',['scripts/build-creature-weapons.mjs',family]]]:[])]){
  const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} failed (${r.status})`);
 }
 // The Witch carries her mage staff, not the donor's trident (Dom's pick B, 2026-09-26): look-only, the trident's WeaponDrawn contract.
 if(family==='witch')await swapWeaponPart('src/assets/witch.glb','trident','staffB');
 await appendQuietOne(process.env.CREATURE_OUT||`src/assets/${family}.glb`); // the corpse pose is grounded on this body's own skin envelope, not the donor's
}
