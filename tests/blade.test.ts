import test from 'node:test';
import assert from 'node:assert/strict';
import { bladeContact, segmentDistance } from '../src/blade.ts';
import { initialPractice, stepPractice, SWORD } from '../src/combat.ts';
const actor = { x:0,z:0,heading:0,distance:0 };
test('finite blade distance handles crossing, parallel, endpoints and degenerate segments', () => {
  assert.equal(segmentDistance([-1,1,0],[1,1,0],[0,0,0],[0,2,0]),0);
  assert.equal(segmentDistance([1,0,0],[1,2,0],[0,0,0],[0,2,0]),1);
  assert.equal(segmentDistance([0,3,0],[0,4,0],[0,0,0],[0,2,0]),1);
  assert.equal(segmentDistance([1,1,0],[1,1,0],[0,0,0],[0,2,0]),1);
});
test('blade contact rejects empty space inside the old broad cone and targets behind the fighter', () => {
  for (const [x,z] of [[.85,.85],[0,-1.2],[0,2.5]]) {
    const target={...actor,x,z};
    assert.equal(bladeContact('light',SWORD.contact-1,SWORD.contact,actor,actor,target,target),false,`${x},${z}`);
  }
  const target={...actor,z:1.2};
  assert.ok(bladeContact('light',SWORD.contact-1,SWORD.contact,actor,actor,target,target));
});
test('a moving target crossing the blade within a tick cannot tunnel through it', () => {
  const before={...actor,x:-1,z:1.1},after={...actor,x:1,z:1.1};
  assert.ok(bladeContact('light',SWORD.contact,SWORD.contact,actor,actor,before,after));
});
test('locked armed footwork faces the opponent while moving laterally; sweep damage resolves once', () => {
  const idle={x:0,z:0,yaw:0,run:false};
  let s={...initialPractice(),phase:'ready' as const};
  const next=stepPractice(s,{...idle,x:1},false,true);
  assert.ok(next.fighter.x>s.fighter.x);
  assert.ok(Math.abs(next.fighter.heading-Math.atan2(next.enemy.x-next.fighter.x,next.enemy.z-next.fighter.z))<.1);
  let fight=stepPractice({...s,fighter:{...actor,z:s.enemy.z+1.2,heading:Math.PI}},idle,true,true);
  for(let i=0;i<SWORD.recovery;i++)fight=stepPractice(fight,idle,false,true);
  assert.equal(fight.hits,1);assert.equal(fight.health,75);
});

test('a miss is reported only after follow-through closes, and late contact still hits once', () => {
  const idle={x:0,z:0,yaw:0,run:false};
  const start={...initialPractice(),phase:'ready' as const};
  let miss=stepPractice(start,idle,true,false);
  for(let i=0;i<SWORD.contact;i++)miss=stepPractice(miss,idle,false,false);
  assert.equal(miss.result,'none');
  for(let i=0;i<4;i++)miss=stepPractice(miss,idle,false,false);
  assert.equal(miss.result,'miss');
  let s={...start,enemyAttacking:true,enemyHeading:0,enemyAge:35,fighter:{...actor,z:start.enemy.z+1.4,heading:Math.PI}};
  for(let i=0;i<5;i++)s=stepPractice(s,idle,false,false) as typeof s;
  assert.equal(s.playerHealth,80);assert.ok(s.enemyHit);
});

test('upright blade regions produce deterministic lethal-location data without renderer bones', () => {
  const idle={x:0,z:0,yaw:0,run:false};
  let s=stepPractice({...initialPractice(),phase:'ready',health:25,fighter:{...actor,z:1.2,heading:Math.PI},enemy:{...actor}},idle,true,true);
  for(let i=0;i<25;i++)s=stepPractice(s,idle,false,true);
  assert.equal(s.health,0);assert.equal(s.finish?.victim,'warden');assert.equal(s.finish?.attack,'light');
  assert.ok(['head','torso','legs'].includes(s.finish!.location));assert.equal(s.finish?.location,s.enemyWoundSite);
  assert.equal(initialPractice().finish,null);
});
