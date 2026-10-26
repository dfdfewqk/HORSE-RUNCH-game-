/* HORSE RANCH — auto veterinary recovery; reuse existing horse detail/weakness views.
 * No new daily clicks, no random injury events and no automatic euthanasia.
 */
(function(){
'use strict';
const H=window.HorseRanchHealth,C=window.HorseRanchLifeChoice;
if(!H||!C){console.error('HORSE RANCH health prerequisites missing');return;}
const getDay=()=>today();
function owned(){return(state.horses||[]);}
for(const h of owned())H.importLegacy(h,getDay());
const oldNormalize=normalize;
normalize=function(){
 const result=oldNormalize.apply(this,arguments);
 for(const h of owned())H.importLegacy(h,getDay());
 return result;
};
const prevBirths=completeBirths;
completeBirths=function(){
 const existing=new Set(owned().map(h=>String(h.id)));
 const out=prevBirths.apply(this,arguments);
 for(const h of owned()){
  if(existing.has(String(h.id)))continue;
  const parent=id=>allHorseObjects().find(x=>String(x.id)===String(id));
  H.inheritedCandidates(h,parent(h.fatherId),parent(h.motherId));
 }
 return out;
};
// Called only by the existing/future race/health decision engines after a real
// diagnostic event. No simulated chance or fabricated recovery duration here.
window.hrRecordVeterinaryCase=function(id,details){
 const h=owned().find(x=>String(x.id)===String(id));
 if(!h)return{ok:false,reason:'보유 중인 말을 찾을 수 없습니다.'};
 const result=H.start(h,details,getDay());
 if(!result.ok)return result;
 state.registrations=state.registrations.filter(x=>String(x.horseId)!==String(id));
 log(h.name+' · 수의사 진단: '+result.active.name+' · 자동 치료 시작');
 save();render();
 return result;
};
window.hrRecordHealthObservation=function(id,key){
 const h=owned().find(x=>String(x.id)===String(id));
 if(!h)return{ok:false,reason:'말을 찾을 수 없습니다.'};
 const result=H.observe(h,key);
 if(result.ok){log(h.name+' · 건강 특징 관찰: '+result.label);save();render();}
 return result;
};
const beforeEligible=eligible;
eligible=function(h,r){
 return beforeEligible.apply(this,arguments)&&!h?.hrHealth?.active;
};
const beforeProfileTraits=profileTraitsTab;
profileTraitsTab=function(h){
 const html=beforeProfileTraits.apply(this,arguments),values=H.displayWeaknesses(h);
 if(!values.length)return html;
 // The established '단점' field is the only display for observed fragility.
 return html.replace(/(<div class="traitLabel">단점<\/div><strong>)[\s\S]*?(<\/strong>)/,
  (_,a,b)=>a+values.map(escapeHtml).join(' · ')+b);
};
const beforeDetailBody=detailBody;
detailBody=function(h,tab,recent){
 const html=beforeDetailBody.apply(this,arguments);
 if(tab!==0)return html;
 const a=h.hrHealth?.active;
 if(!a)return html;
 const labels={treatment:'치료 중',rehabilitation:'재활 중',gradual_return:'조교 복귀 준비'};
 return html+'<div class="notice"><b>수의사 자동 관리</b> · '+escapeHtml(a.name)+
  ' · '+escapeHtml(labels[a.phase]||'상태 확인 중')+' · 경주 출전 제한</div>';
};
const beforeDashboard=dashboard;
dashboard=function(){
 let html=beforeDashboard.apply(this,arguments);
 const report=state.hrHealthLastReport;
 if(report&&getDay()-Number(report.day)<=30&&getDay()>=Number(report.day)){
  html+='<div class="notice"><b>최근 수의사 경과 보고</b> · 치료·재활 완료 '+
   Number(report.completed)+'건'+(report.careerEndings?' · 은퇴 진로 판단 필요 '+Number(report.careerEndings)+'건':'')+'</div>';
 }
 return html;
};
const beforeDay=advanceDay;
advanceDay=function(...args){
 // Legacy injury durations may be supplied by saved games or other modules.
 for(const h of owned()){
  if(h.hrHealth?.active)h.injury=2;
  else if(Number(h.injury)>0)H.importLegacy(h,getDay());
 }
 const prior=getDay(),out=beforeDay.apply(this,args);
 if(!state.startDone||getDay()===prior)return out;
 let changed=false,completed=0,forcedRetire=0;
 for(const h of owned()){
  const p=H.tick(h,getDay());
  if(!p.changed)continue;
  changed=true;
  if(p.completed){
   completed++;log(h.name+' · '+p.name+' 치료·재활 경과 완료');
   if(p.retirementRequired&&!h.retired){
    const queued=C.queue(state,h.id,'수의사 경주 복귀 불가 판정');
    if(queued.ok){forcedRetire++;log(h.name+' · 경주 복귀 불가, 은퇴 후 진로 결정 필요');}
   }
  }
 }
 if(state.hrLifeChoice?.running){
  state.hrLifeChoice.running.stopped=state.hrLifeChoice.pending.length>0;
 }else if(state.hrLifeChoice?.lastSummary){
  state.hrLifeChoice.lastSummary.stopped=state.hrLifeChoice.pending.length>0;
 }
 if(completed||forcedRetire){
  state.hrHealthLastReport={day:getDay(),completed,careerEndings:forcedRetire};
 }
 if(changed){save();if(!args[0]&&!HR_BATCH_DAY)render();}
 return out;
};
save();render();
})();
