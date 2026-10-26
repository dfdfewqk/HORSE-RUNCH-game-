/* HORSE RANCH — attach provisional injuries only to completed player races
 * and recorded weekly body-training sessions, never to calendar idle days.
 */
(function(){
'use strict';
const P=window.HorseRanchInjuryCalibration,H=window.HorseRanchHealth;
if(!P||!H){console.error('HORSE RANCH injury calibration prerequisites missing');return;}
P.ensureWorld(state);
function report(h,kind){
 const result=P.evaluate(h,kind,H);
 if(!result.eligible)return result;
 if(result.occurred){
  const started=H.start(h,result.report,today());
  if(!started.ok){
   console.error('HORSE RANCH simulated veterinary case rejected:',started.reason);
   return{...result,occurred:false,medicalError:started.reason};
  }
  // Registered future races cannot run during medical care.
  state.registrations=state.registrations.filter(x=>String(x.horseId)!==String(h.id));
  log(h.name+' · '+(kind==='race'?'경주':'조교')+' 후 '+started.active.name+
   ' 진단 · 자동 치료·재활 시작');
 }
 P.record(state,h,result,kind,today());
 return result;
}
// The existing race pipeline settles result, awards and records first.
const priorRace=runRace;
runRace=function(rid,jid,show=true){
 const initialCount=state.results.length;
 const out=priorRace.apply(this,arguments);
 if(state.results.length<=initialCount)return out;
 const latest=state.results[state.results.length-1];
 if(String(latest.raceId)!==String(rid))return out;
 const h=state.horses.find(x=>String(x.id)===String(latest.horseId));
 if(h){const risk=report(h,'race');if(risk.eligible)save();}
 return out;
};
// Weekly training is completed inside 20.15's day handler. We detect an actual
// added session; no event occurs if the horse is capped, recovering or skipped.
const priorDay=advanceDay;
advanceDay=function(...args){
 const before=today(),beforeMonth=monthKey();
 const usedBefore={...(state.training?.used||{})};
 const out=priorDay.apply(this,args);
 if(!state.startDone||today()===before)return out;
 const changedMonth=monthKey()!==beforeMonth;
 let exposures=0,injuries=0;
 for(const h of state.horses){
  const current=Number(state.training?.used?.[h.id])||0;
  const past=changedMonth?0:Number(usedBefore[h.id])||0;
  if(current<=past)continue;
  const risk=report(h,'training');
  if(risk.eligible){exposures++;if(risk.occurred)injuries++;}
 }
 if(exposures){
  state.hrInjuryCalibration.lastTrainingCheckDay=today();
  save();
  if(!args[0]&&!HR_BATCH_DAY&&injuries)render();
 }
 return out;
};
const beforeDashboard=dashboard;
dashboard=function(){
 let html=beforeDashboard.apply(this,arguments);
 const x=P.ensureWorld(state);
 const now=today(),recent=x.recent.filter(r=>now>=r.day&&now-r.day<30);
 if(recent.length)html+='<div class="notice"><b>최근 30일 부상 보고</b> · '+recent.length+
  '건 · 수의사가 자동 치료·재활합니다. 경주에 복귀할 수 없는 경우에만 은퇴 진로를 결정합니다.</div>';
 return html;
};
save();render();
})();
