/* HORSE RANCH — observed health weaknesses and automatic veterinary follow-through.
 * Only medically reported injuries are processed. There is deliberately NO
 * random injury generation, inherited probability or hard-coded rehab duration.
 * Keep the existing weakness panel (up to two displayed traits) and legacy saves.
 */
(function(root){
'use strict';
const WEAKNESSES=Object.freeze({leg_load:'다리 부담에 취약',slow_recovery:'회복이 느림'});
const DIAGNOSES=Object.freeze({
 wound:'찰과상·열상',hoof:'발굽 타박·농양',joint:'관절 염증',
 bucked_shins:'중수골 골막염',stress_fracture:'피로골절',
 chip_fracture:'관절 내 골편',severe_fracture:'중증 골절',
 tendon:'굴건 손상',ligament:'인대 손상',myopathy:'운동성 근육 손상',
 eiph:'운동유발 폐출혈',respiratory:'호흡기 감염',
 colic:'산통',laminitis:'제엽염',osteoarthritis:'퇴행성 관절염'
});
const PHASES=['treatment','rehabilitation','gradual_return'];
function ensure(h){
 if(!h||typeof h!=='object')return null;
 if(!h.hrHealth||typeof h.hrHealth!=='object')h.hrHealth={version:1,observed:[],familyCandidates:[],active:null,history:[]};
 const x=h.hrHealth;x.version=1;
 if(!Array.isArray(x.observed))x.observed=[];
 if(!Array.isArray(x.familyCandidates))x.familyCandidates=[];
 if(!Array.isArray(x.history))x.history=[];
 x.observed=[...new Set(x.observed.filter(k=>Object.hasOwn(WEAKNESSES,k)))].slice(0,2);
 x.familyCandidates=[...new Set(x.familyCandidates.filter(k=>Object.hasOwn(WEAKNESSES,k)))].slice(0,2);
 return x;
}
function priorWeaknesses(h){
 const t=h?.profileTraits||{};
 const text=String(t.weaknessText||h?.weakness||'');
 const parts=text.split(/\s*[·,;]\s*/).map(x=>x.trim()).filter(Boolean);
 if(parts.length)return parts;
 return Array.isArray(t.weaknessCategories)?t.weaknessCategories.filter(x=>typeof x==='string'&&x.trim()):[];
}
function existingHealthTraits(h){
 const seen=new Set();
 const all=[...priorWeaknesses(h),...(h?.hrHealth?.observed||[]).map(k=>WEAKNESSES[k]).filter(Boolean)];
 for(const [key,visible] of Object.entries(WEAKNESSES)){
  if(all.some(x=>x.includes(visible)))seen.add(key);
 }
 return [...seen];
}
function inheritedCandidates(child,father,mother){
 const s=ensure(child),origin=[father,mother].filter(Boolean);
 // Family history is a *possibility*, never a guaranteed genetic diagnosis.
 s.familyCandidates=[...new Set(origin.flatMap(existingHealthTraits))].slice(0,2);
 return s.familyCandidates;
}
function displayWeaknesses(h){
 const out=priorWeaknesses(h).slice(0,2);
 for(const key of ensure(h).observed){
  const label=WEAKNESSES[key];
  if(!label||out.includes(label)||out.some(x=>x.includes(label)))continue;
  if(out.length<2)out.push(label);
 }
 return out;
}
function observe(h,key){
 if(!Object.hasOwn(WEAKNESSES,key))return{ok:false,reason:'지원하지 않는 체질 관찰입니다.'};
 const s=ensure(h);
 if(!s.observed.includes(key)){
  if(displayWeaknesses(h).length>=2)return{ok:false,reason:'대표 단점은 최대 2개까지만 표시합니다.'};
  s.observed.push(key);
 }
 return{ok:true,label:WEAKNESSES[key]};
}
function start(h,caseData,day){
 if(!h||!caseData||!Object.hasOwn(DIAGNOSES,caseData.diagnosis))return{ok:false,reason:'진단 종류가 올바르지 않습니다.'};
 const s=ensure(h);
 if(s.active)return{ok:false,reason:'진행 중인 치료 기록이 있습니다.'};
 const severity=caseData.severity;
 if(!['minor','moderate','severe'].includes(severity))return{ok:false,reason:'부상 심각도를 확인해 주세요.'};
 if(severity==='severe'&&typeof caseData.returnAllowed!=='boolean')
  return{ok:false,reason:'중증 사례에는 수의사의 경주 복귀 가능 여부 판정이 필요합니다.'};
 const durations=[caseData.treatmentDays,caseData.rehabilitationDays,caseData.gradualReturnDays];
 if(durations.some(v=>!Number.isInteger(v)||v<0)||durations.reduce((a,b)=>a+b,0)<1)
  return{ok:false,reason:'수의사가 정한 치료·재활·복귀 준비 기간이 필요합니다.'};
 if(!Number.isInteger(day)||day<0)return{ok:false,reason:'유효한 게임 날짜가 필요합니다.'};
 s.active={
  diagnosis:caseData.diagnosis,name:DIAGNOSES[caseData.diagnosis],
  site:String(caseData.site||'부위 미기록'),severity,
  durations:{treatment:durations[0],rehabilitation:durations[1],gradual_return:durations[2]},
  phase:PHASES.find(p=>durations[PHASES.indexOf(p)]>0),phaseProgress:0,
  startedDay:day,lastTickDay:day,
  returnAllowed:caseData.returnAllowed!==false,
  source:caseData.source||'veterinary-report'
 };
 // Legacy training/race paths check h.injury as a time-to-recovery flag.
 // Keep at 2 while care is active, since core advanceDay decrements it first.
 h.injury=Math.max(2,Number(h.injury)||0);
 return{ok:true,active:s.active};
}
function finish(h,day){
 const s=ensure(h),c=s.active;
 if(!c)return{completed:false};
 s.history.push({...c,finishedDay:day});
 if(s.history.length>40)s.history.splice(0,s.history.length-40);
 s.active=null;h.injury=0;
 return{completed:true,name:c.name,retirementRequired:!c.returnAllowed};
}
function tick(h,day){
 const s=ensure(h),c=s.active;
 if(!c)return{changed:false};
 if(!Number.isInteger(day)||day<=c.lastTickDay)return{changed:false};
 // Process one day for each whole calendar day; never skip phases.
 let finished=null,transitions=[];
 for(let d=c.lastTickDay+1;d<=day;d++){
  if(!s.active)break;
  const current=s.active;current.phaseProgress++;
  if(current.phaseProgress<current.durations[current.phase]){
   current.lastTickDay=d;continue;
  }
  const prior=current.phase,index=PHASES.indexOf(prior);
  let next=null;
  for(let i=index+1;i<PHASES.length;i++)if(current.durations[PHASES[i]]>0){next=PHASES[i];break}
  if(next){
   current.phase=next;current.phaseProgress=0;current.lastTickDay=d;
   transitions.push({from:prior,to:next,day:d});
  }else finished=finish(h,d);
 }
 if(s.active)h.injury=2;
 return{changed:true,transitions,...(finished||{})};
}
function importLegacy(h,day){
 const s=ensure(h);
 if(s.active)return{created:false,reason:'already-tracked'};
 const remaining=Number(h?.injury)||0;
 if(remaining<=0)return{created:false,reason:'not-injured'};
 const r=start(h,{
  diagnosis:'wound',site:'기존 저장의 부상 (상세 진단 미확인)',severity:'minor',
  treatmentDays:Math.max(1,Math.ceil(remaining)),rehabilitationDays:0,gradualReturnDays:0,
  returnAllowed:true,source:'legacy-injury-duration'
 },day);
 if(r.ok)r.active.name='기존 부상 회복';
 return{created:r.ok};
}
const api=Object.freeze({
 WEAKNESSES,DIAGNOSES,PHASES,ensure,priorWeaknesses,existingHealthTraits,inheritedCandidates,
 displayWeaknesses,observe,start,tick,importLegacy
});
root.HorseRanchHealth=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
