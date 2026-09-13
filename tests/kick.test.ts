import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice, KICK, WOUND, DEFENCE, type Practice } from '../src/combat.ts';
const idle={x:0,z:0,yaw:0,run:false};
const stance=():Practice=>({...initialPractice(),phase:'ready',fighter:{x:0,z:1.05,heading:Math.PI,distance:0},enemy:{x:0,z:0,heading:0,distance:0},enemyMode:'guard',enemyGuardAge:20,decision:1000,enemyWait:1000});
const ticks=(s:Practice,n:number)=>{for(let i=0;i<n;i++)s=stepPractice(s,idle,false,false);return s;};
test('kick costs stamina at commitment, breaks close guard once and creates no sword wound',()=>{
 let s=stepPractice(stance(),idle,false,true,{kick:true});assert.equal(s.phase,'kick');assert.equal(s.stamina,75);
 s=ticks(s,KICK.contact-1);assert.equal(s.health,100);
 s=ticks(s,1);assert.equal(s.result,'kicked');assert.equal(s.health,92);assert.equal(s.enemyStamina,55);assert.equal(s.enemyWound,0);assert.ok(s.enemy.z<0);
 s=ticks(s,KICK.recovery-KICK.contact);assert.equal(s.phase,'ready');assert.equal(s.hits,1);
});
test('kick cannot hit out of reach or behind, bypass recovery, or start with insufficient stamina',()=>{
 for(const [z,heading] of [[2,Math.PI],[1.05,0]]){let s=stance();s.fighter={...s.fighter,z,heading};s=ticks(stepPractice(s,idle,false,false,{kick:true}),KICK.contact);assert.equal(s.health,100);assert.equal(s.result,'miss');}
 for(const phase of ['attack','hurt','roll','sheathed'] as const)assert.notEqual(stepPractice({...stance(),phase},idle,false,true,{kick:true}).phase,'kick');
 assert.notEqual(stepPractice({...stance(),stamina:24},idle,false,true,{kick:true}).phase,'kick');
});
test('wounds temporarily reduce recovery on both actors, expire and reset without stacking',()=>{
 let s={...stance(),enemyMode:'circle' as const,wound:WOUND.duration,enemyWound:WOUND.duration,stamina:40,enemyStamina:40};
 const n=stepPractice(s,idle,false,true);assert.ok(Math.abs(n.stamina-40-.4*.8)<1e-8);assert.ok(Math.abs(n.enemyStamina-40-.3*.8)<1e-8);
 const expired=stepPractice({...s,wound:1,enemyWound:1},idle,false,true);assert.equal(expired.wound,0);assert.ok(Math.abs(expired.stamina-40-.4)<1e-8);
 assert.equal(initialPractice().wound,0);assert.equal(initialPractice().enemyWound,0);
});
test('unblocked sword contact wounds; a timed parry or held guard does not',()=>{
 for(const phase of ['ready','guard'] as const){
  const s={...stance(),phase,age:12,enemyMode:'approach' as const,enemyAttacking:true,enemyAge:DEFENCE.enemyContact-1,enemyHeading:0};
  const next=stepPractice(s,idle,false,true,{guard:phase==='guard'});
  assert.equal(next.playerHealth,phase==='guard'?100:80);assert.equal(next.wound,phase==='guard'?0:WOUND.duration);
 }
});
