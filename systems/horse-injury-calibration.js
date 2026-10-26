/* HORSE RANCH — provisional, opt-out race/training injury calibration.
 * The numbers below are GAME TEST PARAMETERS, not veterinary incidence claims.
 * Injuries are rolled only after an actual race or recorded auto-training session.
 */
(function(root){
'use strict';
const CONFIG=Object.freeze({
 enabled:true,
 racePerStart:0.012,                 // 1.2% / completed player race
 autoTrainingPerSession:0.0024,    // 0.24% / completed weekly training session
 minorShare:0.70,moderateShare:0.25,
 legWeaknessMultiplier:1.25,       // observed weakness ONLY, not family candidates
 slowRecoveryMultiplier:1.20,
 highFatigueBonusMax:0.30,poorConditionBonusMax:0.20,
 previousInjuryBonus:0.10,
 severeCareerEndShare:0.25,       // simulated prognosis; NOT euthanasia
 maximumRelativeRisk:1.65
});
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const byKind=Object.freeze({
 race:{
  minor:['hoof','wound','joint'],
  moderate:['joint','tendon','ligament','stress_fracture'],
  severe:['stress_fracture','chip_fracture','severe_fracture']
 },
 training:{
  minor:['hoof','wound','myopathy'],
  moderate:['joint','bucked_shins','stress_fracture','tendon'],
  severe:['stress_fracture','tendon','severe_fracture']
 }
});
function isEligible(h,kind){
 if(!h||!['race','training'].includes(kind))return false;
 return !h.retired&&!h.injury&&!h.pregnantUntil&&!h.hrHealth?.active&&
   h.hrAftercare?.status!=='board'&&Number(h.age)>=2;
}
function relativeRisk(h,health){
 const known=health?.existingHealthTraits?health.existingHealthTraits(h):[];
 let factor=known.includes('leg_load')?CONFIG.legWeaknessMultiplier:1;
 const fatigue=clamp(n(h.fatigue),0,100),condition=clamp(n(h.condition,80),0,100);
 factor*=1+Math.max(0,fatigue-50)/50*CONFIG.highFatigueBonusMax;
 factor*=1+Math.max(0,70-condition)/70*CONFIG.poorConditionBonusMax;
 if((h.hrHealth?.history||[]).length)factor*=1+CONFIG.previousInjuryBonus;
 return clamp(factor,1,CONFIG.maximumRelativeRisk);
}
function chance(h,kind,health){
 if(!CONFIG.enabled||!isEligible(h,kind))return 0;
 const base=kind==='race'?CONFIG.racePerStart:CONFIG.autoTrainingPerSession;
 return clamp(base*relativeRisk(h,health),0,0.05);
}
function rand(random){return clamp(n(random(),0),0,0.999999999);}
function randint(random,min,max){return min+Math.floor(rand(random)*(max-min+1));}
function diagnosis(kind,severity,random){
 const choices=byKind[kind][severity];
 return choices[Math.floor(rand(random)*choices.length)];
}
function durations(severity,random,weak){
 // Provisional gameplay ranges, not medical advice or fixed recovery schedules.
 const ranges={
  minor:[3,14],moderate:[18,100],severe:[110,280]
 };
 let total=randint(random,...ranges[severity]);
 if(weak)total=Math.max(1,Math.ceil(total*CONFIG.slowRecoveryMultiplier));
 // Ensure all 3 phases exist for moderate/severe; mild conditions may need only rest.
 if(severity==='minor')return{treatmentDays:total,rehabilitationDays:0,gradualReturnDays:0};
 const tr=Math.max(1,Math.floor(total*.45));
 const rehab=Math.max(1,Math.floor(total*.40));
 return{treatmentDays:tr,rehabilitationDays:rehab,gradualReturnDays:total-tr-rehab};
}
function evaluate(h,kind,health,random=Math.random){
 const rate=chance(h,kind,health);
 if(rate===0)return{eligible:false,occurred:false,rate:0};
 if(rand(random)>=rate)return{eligible:true,occurred:false,rate};
 const roll=rand(random);
 const severity=roll<CONFIG.minorShare?'minor':
   roll<CONFIG.minorShare+CONFIG.moderateShare?'moderate':'severe';
 const diag=diagnosis(kind,severity,random);
 const known=health?.existingHealthTraits?health.existingHealthTraits(h):[];
 const slow=known.includes('slow_recovery');
 const days=durations(severity,random,slow);
 // A potential end of racing is a medical-outcome simulation, not player disposal.
 const returnAllowed=severity!=='severe'||rand(random)>=CONFIG.severeCareerEndShare;
 const report={diagnosis:diag,severity,site:'진단 보고서 참조',...days,
  returnAllowed,source:'simulated-'+kind+'-diagnosis'};
 return{eligible:true,occurred:true,rate,report};
}
function ensureWorld(world){
 if(!world.hrInjuryCalibration||typeof world.hrInjuryCalibration!=='object'){
  world.hrInjuryCalibration={version:1,configVersion:1,exposures:{race:0,training:0},
   injuries:{minor:0,moderate:0,severe:0},careerEnding:0,recent:[]};
 }
 const x=world.hrInjuryCalibration;
 if(!x.exposures)x.exposures={race:0,training:0};
 if(!x.injuries)x.injuries={minor:0,moderate:0,severe:0};
 if(!Array.isArray(x.recent))x.recent=[];
 return x;
}
function record(world,horse,event,kind,day){
 if(!event.eligible)return{recorded:false};
 const s=ensureWorld(world);
 s.exposures[kind]=(s.exposures[kind]||0)+1;
 if(event.occurred){
  const severity=event.report.severity;
  s.injuries[severity]=(s.injuries[severity]||0)+1;
  if(!event.report.returnAllowed)s.careerEnding++;
  s.recent.push({day,horseId:horse.id,horseName:horse.name,kind,
   severity,diagnosis:event.report.diagnosis,careerEnding:!event.report.returnAllowed});
  if(s.recent.length>60)s.recent.splice(0,s.recent.length-60);
 }
 return{recorded:true};
}
const api=Object.freeze({CONFIG,byKind,isEligible,relativeRisk,chance,durations,evaluate,ensureWorld,record});
root.HorseRanchInjuryCalibration=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
