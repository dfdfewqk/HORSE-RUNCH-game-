/* HORSE RANCH 20.4 — connected foal school and bounded training prototype.
 * Balancing values are experimental; no ancestry/genetics algorithms changed.
 * No standalone ranch or duplicate save store is created.
 */
(function(root){
'use strict';
const POINTS_PER_MONTH=3;
const EDUCATION_FEE=25000;
const ADULT_TRAINING_FEE=75000;
const KEYS=['handling','calm','gate','balance'];
const LABELS={handling:'지시·사람 적응',calm:'환경 적응',gate:'출발 적응',balance:'주행 기초'};
const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const stats=['speed','stamina','power'];
function create(bornAtDay=null){return{version:1,bornAtDay,mode:'auto',monthKey:null,used:0,skills:{handling:0,calm:0,gate:0,balance:0},totalSessions:0,locked:false,finalPersonality:null,ageMilestone:0};}
function ensure(h){
 if(!h||typeof h!=='object')return null;
 // Pre-existing horses do not acquire invented birth dates or schooling history.
 if(!h.foalEducation){if(Number(h.age)>=2)return null;h.foalEducation=create(null)}
 const e=h.foalEducation;if(!e.skills)e.skills={};for(const key of KEYS)e.skills[key]=bound(Number(e.skills[key])||0,0,70);
 if(!['manual','auto'].includes(e.mode))e.mode='auto';if(typeof e.used!=='number')e.used=0;
 if(Number(h.age)>=2&&!e.locked)lock(h);return e;
}
function syncMonth(e,month){if(e.monthKey!==month){e.monthKey=month;e.used=0}}
function trainFoal(h,kind,month,random=Math.random){
 const e=ensure(h);
 if(!e||e.locked||Number(h.age)>=2)return{ok:false,reason:'성마이거나 교육 대상이 아닙니다.'};
 if(!KEYS.includes(kind))return{ok:false,reason:'지원하지 않는 교육입니다.'};
 if(Number(h.age)<1&&(kind==='gate'||kind==='balance'))return{ok:false,reason:'이 교육은 1세부터 가능합니다.'};
 syncMonth(e,month);
 if(e.used>=POINTS_PER_MONTH)return{ok:false,reason:'이번 달 기초교육 포인트를 모두 사용했습니다.'};
 if(e.skills[kind]>=70)return{ok:false,reason:'현재 교육 분야의 숙련 한계입니다.'};
 const old=e.skills[kind],gain=4+Math.floor(bound(random(),0,.99999)*5);
 e.skills[kind]=bound(old+gain,0,70);e.used++;e.totalSessions=(e.totalSessions||0)+1;
 let statBonus=null;
 if(kind==='balance'&&e.totalSessions%4===0&&random()<.35){const name=(random()<.5?'stamina':'power');if(Number(h[name])<Number(h.caps?.[name])){h[name]=Math.min(Number(h.caps[name]),h[name]+1);statBonus=name}}
 h.fatigue=bound((Number(h.fatigue)||0)+1,0,100);
 return{ok:true,cost:EDUCATION_FEE,gain:e.skills[kind]-old,kind,statBonus};
}
function autoTrain(h,month,random=Math.random){
 const e=ensure(h);if(!e||e.locked||e.mode!=='auto'||Number(h.age)>=2)return[];
 syncMonth(e,month);const out=[];
 while(e.used<POINTS_PER_MONTH){
  const available=Number(h.age)>=1?KEYS:['handling','calm'];
  const type=available.filter(k=>e.skills[k]<70).sort((a,b)=>e.skills[a]-e.skills[b])[0];
  if(!type)break;
  const result=trainFoal(h,type,month,random);if(!result.ok)break;out.push(result);
 }
 return out;
}
function personality(h){
 const e=h.foalEducation,s=e.skills,innate=h.growthFoundation?.innateTemperament||'보통';
 if(innate==='예민'&&s.calm>=35)return'예민하지만 안정적';
 if(innate==='활동적'&&s.handling>=35)return'활동적·집중형';
 if(innate==='침착'&&s.handling>=35)return'침착·협조형';
 if(innate==='신중'&&s.gate>=35)return'신중·적응형';
 return innate;
}
function lock(h){
 const e=h?.foalEducation;if(!e||e.locked)return false;
 e.locked=true;e.finalPersonality=personality(h);e.lockedAtAge=Number(h.age);
 if(!h.profileTraits||typeof h.profileTraits!=='object')h.profileTraits={};
 if(!h.profileTraits.personality)h.profileTraits.personality=e.finalPersonality;
 return true;
}
function initializeBirth(h,day,random=Math.random){
 h.foalEducation=create(day);h.age=0;
 for(const stat of stats){
  const inherited=Number(h.genetic?.[stat])||70;
  const cap=Number(h.caps?.[stat])||99;
  h[stat]=Math.min(cap,bound(Math.round(inherited*.70-2+(random()-.5)*9),40,73));
 }
 if(h.growthFoundation){h.growthFoundation.baselineSource='birth';h.growthFoundation.baseStats=Object.fromEntries(stats.map(k=>[k,h[k]]));}
 return h;
}
function updateAge(h,currentDay){
 const e=h?.foalEducation;if(!e)return false;
 let previous=Number(h.age)||0;
 if(Number.isFinite(e.bornAtDay)&&e.bornAtDay!==null){h.age=Math.max(0,Math.floor((currentDay-e.bornAtDay)/360));}
 // Natural development is small and bounded by inherited caps.
 if(!e.locked&&e.ageMilestone<Math.min(2,h.age)){
  while(e.ageMilestone<Math.min(2,h.age)){
   e.ageMilestone++;
   for(const stat of stats)h[stat]=Math.min(Number(h.caps?.[stat])||99,Number(h[stat])+3);
  }
 }
 if(h.age>=2)lock(h);
 return previous!==h.age;
}
function trainingGain(h,stat,random=Math.random){
 const cap=Number(h.caps?.[stat])||0,gap=Math.max(0,cap-(Number(h[stat])||0));if(!gap)return 0;
 const adaptation=bound(Number(h.growthFoundation?.growthEfficiency)||1,.65,1.3);
 const prep=h.foalEducation?.locked?(Number(h.foalEducation.skills.handling)||0)*.001:0;
 const readiness=bound((Number(h.condition)||80)/100,.3,1);
 const fatigue=bound(1-(Number(h.fatigue)||0)/160,.35,1);
 const difficulty=gap<=2?.12:gap<=5?.3:gap<=10?.55:.85;
 const chance=bound(difficulty*adaptation*readiness*fatigue+prep,.03,.94);
 if(random()>=chance)return 0;
 const bigGain=gap>=15&&random()<.2;return Math.min(gap,bigGain?2:1);
}
function ensureLedger(state){if(!state.hrTrainingLedger)state.hrTrainingLedger={pending:0,unpaid:0,paidTotal:0,history:[]};return state.hrTrainingLedger;}
function canAfford(state,fee){const ledger=ensureLedger(state);return (Number(state.money)||0)-ledger.pending-ledger.unpaid>=fee;}
function accrue(state,fee){const ledger=ensureLedger(state);ledger.pending+=fee;}
function settle(state,month){const ledger=ensureLedger(state),due=ledger.pending+ledger.unpaid;const paid=Math.min(Math.max(0,Number(state.money)||0),due);state.money-=paid;ledger.pending=0;ledger.unpaid=Math.max(0,due-paid);ledger.paidTotal+=paid;if(due){ledger.history.push({month,due,paid,unpaid:ledger.unpaid});ledger.history=ledger.history.slice(-12)}return{due,paid,unpaid:ledger.unpaid};}
const API={version:1,POINTS_PER_MONTH,EDUCATION_FEE,ADULT_TRAINING_FEE,KEYS,LABELS,create,ensure,syncMonth,trainFoal,autoTrain,lock,initializeBirth,updateAge,trainingGain,ensureLedger,canAfford,accrue,settle};
root.HorseRanchFoalEducation=Object.freeze(API);
if(typeof module!=='undefined'&&module.exports)module.exports=root.HorseRanchFoalEducation;
})(typeof globalThis!=='undefined'?globalThis:this);
