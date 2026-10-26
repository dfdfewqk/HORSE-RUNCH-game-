/* node tests/horse_injury_calibration.test.cjs */
const assert=require('node:assert/strict');
const P=require('../systems/horse-injury-calibration.js');
const H=require('../systems/horse-health.js');
const healthy=()=>({id:1,name:'검증마',age:3,retired:false,injury:0,
 condition:85,fatigue:20,profileTraits:{weaknessText:'거리 적응이 느림'},hrHealth:{observed:[],familyCandidates:[],active:null,history:[]}});
{
 const h=healthy();
 assert.equal(P.chance(h,'race',H),P.CONFIG.racePerStart);
 assert.equal(P.chance(h,'training',H),P.CONFIG.autoTrainingPerSession);
 h.hrHealth.familyCandidates=['leg_load'];
 assert.equal(P.chance(h,'race',H),P.CONFIG.racePerStart,'family history is never a guaranteed weakness');
 h.hrHealth.observed=['leg_load'];
 assert.ok(P.chance(h,'race',H)>P.CONFIG.racePerStart);
 h.hrHealth.observed=['slow_recovery'];
 assert.equal(P.chance(h,'race',H),P.CONFIG.racePerStart);
}
{
 const h=healthy();
 assert.equal(P.evaluate(h,'race',H,()=>0.99).occurred,false);
 const sequence=[0,0,0,0,0,0];let k=0;
 const outcome=P.evaluate(h,'training',H,()=>sequence[k++]);
 assert.equal(outcome.occurred,true);
 assert.equal(outcome.report.severity,'minor');
 assert.equal(outcome.report.diagnosis,'hoof');
 assert.ok(outcome.report.treatmentDays>=3&&outcome.report.treatmentDays<=14);
 const s=H.start(h,outcome.report,100);
 assert.equal(s.ok,true);
 assert.equal(P.evaluate(h,'race',H,()=>0).eligible,false,'no re-injury while under care');
}
{
 const h=healthy();h.hrHealth.observed=['slow_recovery'];
 const slow=P.durations('moderate',()=>0,h.hrHealth.observed.includes('slow_recovery'));
 const fast=P.durations('moderate',()=>0,false);
 const sum=x=>x.treatmentDays+x.rehabilitationDays+x.gradualReturnDays;
 assert.ok(sum(slow)>sum(fast));
 const roll=[0,0.99,0,0,0.99];let i=0;
 const outcome=P.evaluate(healthy(),'race',H,()=>roll[i++]);
 assert.equal(outcome.occurred,true);
 assert.equal(outcome.report.severity,'severe');
 assert.equal(outcome.report.returnAllowed,true);
 const endRoll=[0,0.99,0,0,0];let j=0;
 const ending=P.evaluate(healthy(),'race',H,()=>endRoll[j++]);
 assert.equal(ending.report.returnAllowed,false);
}
{
 const h=healthy();
 const world={};
 assert.equal(P.record(world,h,{eligible:false,occurred:false},'race',1).recorded,false);
 assert.equal(P.record(world,h,{eligible:true,occurred:false},'race',1).recorded,true);
 assert.equal(P.record(world,h,{eligible:true,occurred:true,report:{
  severity:'moderate',diagnosis:'tendon',returnAllowed:true}},'training',2).recorded,true);
 const x=P.ensureWorld(world);
 assert.equal(x.exposures.race,1);
 assert.equal(x.exposures.training,1);
 assert.equal(x.injuries.moderate,1);
 assert.equal(x.recent.length,1);
}
{
 const h=healthy();
 h.pregnantUntil=100;
 assert.equal(P.chance(h,'training',H),0);
 h.pregnantUntil=null;h.hrAftercare={status:'board'};
 assert.equal(P.chance(h,'race',H),0);
}
console.log('horse provisional injury calibration: OK');