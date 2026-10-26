/* HORSE RANCH — agreed breeding pace and automatic foal rearing.
 * The 180-day pregnancy, 360-day mating interval, hectares/capacity and
 * associated fees are GAME balance values, not veterinary recommendations.
 * No existing pregnancies or birth dates are migrated.
 */
(function(root){
'use strict';
const CONFIG=Object.freeze({gestation:180,variation:10,matingInterval:360,daysPerYear:360,pastureHorsesPerHa:2,initialPastureHa:1,landPrice:1200000,hoofCareEvery:28,hoofCareGain:46});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const number=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
function hash(s){let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0;}
function gestationDays(mareId,sireId,matingDay){return CONFIG.gestation+(hash(mareId+'|'+sireId+'|'+matingDay+'|gestation')%(CONFIG.variation*2+1))-CONFIG.variation;}
function nextMatingDay(mare){return Number.isFinite(mare?.hrBreeding?.lastMatingDay)?mare.hrBreeding.lastMatingDay+CONFIG.matingInterval:null;}
function matingRestriction(mare,day){if(!mare)return '암말을 찾을 수 없습니다.';if(mare.pregnantUntil)return '이미 임신 중입니다.';
 const next=nextMatingDay(mare);return next!==null&&day<next?'이 암말은 연간 한 차례만 교배할 수 있습니다. '+(next-day)+'일 뒤부터 가능합니다.':null;}
function stampMating(mare,booking,day,sireId){
 const duration=gestationDays(mare.id,sireId,day);
 booking.matingDay=day;booking.duration=duration;booking.due=day+duration;
 mare.pregnantUntil=booking.due;mare.hrBreeding={...(mare.hrBreeding||{}),lastMatingDay:day};
 return booking;
}
function pendingParent(world,id){return (world.breedings||[]).some(b=>String(b.mareId)===String(id)||String(b.sireId)===String(id));}
function ensurePasture(world){
 if(!world.hrPasture||typeof world.hrPasture!=='object')world.hrPasture={version:1,hectares:CONFIG.initialPastureHa};
 const p=world.hrPasture;
 p.version=1;p.hectares=clamp(Math.floor(number(p.hectares,CONFIG.initialPastureHa)),1,40);
 return p;
}
function pastureStatus(world){
 const p=ensurePasture(world),young=(world.horses||[]).filter(h=>h?.foalEducation&&Number.isFinite(h.foalEducation.bornAtDay)&&number(h.age)>=0&&number(h.age)<2);
 const capacity=p.hectares*CONFIG.pastureHorsesPerHa;
 return{hectares:p.hectares,capacity,young:young.length,overcrowded:young.length>capacity,overflow:Math.max(0,young.length-capacity)};
}
function expandPasture(world){
 const p=ensurePasture(world);
 if(p.hectares>=40)return{ok:false,reason:'방목지 확장 한도에 도달했습니다.'};
 if(number(world.money)<CONFIG.landPrice)return{ok:false,reason:'방목지 확장 비용이 부족합니다.'};
 world.money-=CONFIG.landPrice;p.hectares++;
 return{ok:true,...pastureStatus(world),cost:CONFIG.landPrice};
}
function ensureRearing(h){
 if(!h?.foalEducation||!Number.isFinite(h.foalEducation.bornAtDay))return null;
 if(!h.hrRearing||typeof h.hrRearing!=='object'){
  h.hrRearing={version:1,readiness:100,lastDay:null,lastMilestone:number(h.foalEducation.ageMilestone),deferred:{speed:0,stamina:0,power:0},lastRecoveryDay:null};
 }
 const r=h.hrRearing;r.version=1;
 if(!r.deferred)r.deferred={speed:0,stamina:0,power:0};
 r.readiness=clamp(number(r.readiness,100),35,100);
 return r;
}
function rearingDay(world,day){
 const info=pastureStatus(world);
 let delayed=0,recovered=0,affected=0;
 for(const h of world.horses||[]){
  const r=ensureRearing(h);if(!r||r.lastDay===day)continue;
  const young=number(h.age)<2;
  const crowded=young&&info.overcrowded;
  if(crowded){affected++;r.readiness=clamp(r.readiness-1.5,35,100);
   // Reduced daily condition is temporary and recovers with normal care.
   if(Number.isFinite(Number(h.condition)))h.condition=Math.min(number(h.condition),Math.max(55,Math.round(r.readiness)));
  }
  else r.readiness=clamp(r.readiness+2,35,100);
  // The existing natural +3 age milestones are delayed, not permanently
  // deleted, when a young horse has spent prolonged time in cramped pasture.
  const milestone=number(h.foalEducation.ageMilestone);
  if(milestone>number(r.lastMilestone)){
   const shortage=r.readiness<70?(r.readiness<50?2:1):0;
   for(const k of ['speed','stamina','power']){
    const before=number(h[k]),defer=Math.min(shortage,Math.max(0,before-40));
    if(defer){h[k]=before-defer;r.deferred[k]=number(r.deferred[k])+defer;delayed+=defer;}
   }
  }
  r.lastMilestone=milestone;
  if(!crowded&&r.readiness>=85&&day%14===0&&r.lastRecoveryDay!==day){
   for(const k of ['speed','stamina','power']){
    const left=number(r.deferred[k]),room=Math.max(0,number(h.caps?.[k],99)-number(h[k]));
    if(left>0&&room>0){h[k]+=1;r.deferred[k]=left-1;recovered++;}
    else if(left>0&&room===0)r.deferred[k]=0;
   }
   r.lastRecoveryDay=day;
  }
  r.lastDay=day;
 }
 return{...info,delayed,recovered,affected};
}
function hoofCare(world,day){
 if(!Number.isInteger(day)||day<1||day%CONFIG.hoofCareEvery!==0)return 0;
 let count=0;
 for(const h of world.horses||[]){
  if(!Number.isFinite(Number(h.hoof)))continue;
  if(!h.hrRoutineCare||typeof h.hrRoutineCare!=='object')h.hrRoutineCare={};
  if(h.hrRoutineCare.lastFarrierDay===day)continue;
  h.hrRoutineCare.lastFarrierDay=day;h.hoof=clamp(number(h.hoof)+CONFIG.hoofCareGain,0,100);count++;
 }
 return count;
}
const api=Object.freeze({CONFIG,gestationDays,nextMatingDay,matingRestriction,stampMating,pendingParent,ensurePasture,pastureStatus,expandPasture,ensureRearing,rearingDay,hoofCare});
root.HorseRanchRearing=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
