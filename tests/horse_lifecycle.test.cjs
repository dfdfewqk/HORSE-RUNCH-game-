'use strict';
const assert=require('node:assert/strict');
const A=require('../systems/horse-lifecycle.js');
function horse(age=10){return{id:42,name:'모래바람',age,speed:92,stamina:90,power:88,caps:{speed:98,stamina:97,power:96},genetic:{speed:98,stamina:97,power:96},condition:89,fatigue:5,retired:false,starts:8,wins:1,history:[],parents:{sire:'선더',dam:'꽃비'}};}
const h=horse();A.ensure(h);const peak={...h.lifeCycle.peakStats};
assert.equal(A.retireChance(h,7),0);
assert.equal(A.stepAge(h,10,2).applied,false);
h.age=11;const first=A.stepAge(h,11,2,()=>1);assert.equal(first.applied,true);
for(const k of ['speed','stamina','power']){
  assert.ok(peak[k]-h[k]>=7 && peak[k]-h[k]<=11,`age 11 strong reduction: ${k}`);
  assert.ok(A.effectiveCap(h,k)<peak[k],`training ceiling below pre-decline peak: ${k}`);
  assert.equal(h.genetic[k],{speed:98,stamina:97,power:96}[k]);
  assert.equal(h.caps[k],{speed:98,stamina:97,power:96}[k]);
}
const a11={speed:h.speed,stamina:h.stamina,power:h.power};
assert.equal(A.stepAge(h,11,2,()=>1).applied,false,'age processed once only');
h.age=12;A.stepAge(h,12,3,()=>1);
for(const k of ['speed','stamina','power'])assert.ok(a11[k]-h[k]>=1 && a11[k]-h[k]<=3,`post-cliff decline gradual: ${k}`);
const r=horse(8);A.ensure(r);r.age=9;const retired=A.stepAge(r,9,3,()=>0);assert.equal(retired.newRetirement,true);assert.equal(r.retired,true);assert.equal(r.lifeCycle.retirementYear,3);
assert.equal(A.stepAge(r,9,3,()=>0).newRetirement,undefined,'cannot retire twice');
const x=horse(3);x.history=[{year:1,month:6,day:24,grade:'G1',dist:2000,place:1}];A.ensureAchievements(x);
assert.equal(A.title(x),'G1 1승');
assert.equal(A.recordRace(x,{year:1,month:6,day:24,grade:'G1',dist:2000},1),false,'dedupe historical major win');
assert.equal(A.recordRace(x,{year:2,month:6,day:24,grade:'G1',dist:2000},1),true);
assert.equal(A.title(x),'G1 2승');
const world={year:9,horses:[horse(10)],npcs:[{name:'기존 목장',horses:[horse(6)]}],horseLegends:[]};world.npcs[0].horses[0].id=97;
A.ensureWorld(world);
world.year=10;world.horses[0].age=11;
const progressed=A.advanceYear(world);assert.equal(progressed.applied,true);
assert.equal(world.npcs[0].horses[0].age,7);
assert.ok(world.horses[0].speed<92);
assert.equal(A.advanceYear(world).applied,false,'year processed only once');
assert.equal(A.archive(world,x,'판매',3),true);assert.equal(world.horseLegends.length,1);
assert.equal(A.archive(world,x,'판매',3),true);assert.equal(world.horseLegends.length,1);
const restored=JSON.parse(JSON.stringify(world));A.ensureWorld(restored);
assert.equal(restored.horseLegends.length,1);assert.equal(A.advanceYear(restored).applied,false);
console.log('HORSE RANCH 20.7 horse lifecycle and achievements OK');
