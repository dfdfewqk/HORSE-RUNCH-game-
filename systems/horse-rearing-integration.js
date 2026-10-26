/* HORSE RANCH — agreed breeding/rearing wiring.
 * Loaded after existing integrations; does not change the old save key, core
 * race engine or 20.15 schooling/rider rules.
 */
(function(){
'use strict';
const R=window.HorseRanchRearing;
if(!R){console.error('HORSE RANCH rearing rules unavailable');return;}
R.ensurePasture(state);
const priorBreed=breed;
breed=function(...args){
 const dam=horse(state.selectedDam),sire=horse(state.selectedSire),day=today();
 // The base function remains authoritative for age, money, sex and stable capacity.
 if(dam&&sire){const problem=R.matingRestriction(dam,day);if(problem){alert(problem);return;}}
 const before=new Set((state.breedings||[]).map(x=>x.id));
 const result=priorBreed.apply(this,args);
 const booking=(state.breedings||[]).find(x=>!before.has(x.id)&&String(x.mareId)===String(dam?.id));
 if(booking&&dam&&sire){
  R.stampMating(dam,booking,day,sire.id);
  log(dam.name+' · 임신 '+booking.duration+'일 예정 (연간 교배 1회)');
  save();render();
 }
 return result;
};
const priorSale=sellHorse;
sellHorse=function(id){
 if(R.pendingParent(state,id)){alert('출산 예약에 포함된 부모 말은 출산 완료 후 판매할 수 있습니다.');return;}
 return priorSale.apply(this,arguments);
};
const priorBreeding=breeding;
breeding=function(){
 const p=R.pastureStatus(state);
 let html=priorBreeding.apply(this,arguments).replaceAll('300일','약 180일');
 html+=`<div class="panel"><div class="panelTitle"><h2>육성 방목지</h2><span class="badge">${p.hectares}ha · 어린 말 ${p.young}/${p.capacity}마리</span></div>
 <div class="small">출생~2세 전 어린 말의 방목과 기본 관리는 직원이 자동 수행합니다. 성장·교육·유전 상한은 기존 규칙을 유지합니다.</div>
 ${p.overcrowded?'<div class="notice warn">어린 말 수가 방목지 수용 능력을 초과했습니다. 장기간 과밀하면 자연 성장이 늦어질 수 있습니다. 환경이 개선되면 지연된 성장은 회복됩니다.</div>':'<div class="notice good">현재 방목지 수용 범위에서 사육 중입니다.</div>'}
 <div class="row"><span class="small">방목지 1ha 확장 · ${money(R.CONFIG.landPrice)} · 수용 +${R.CONFIG.pastureHorsesPerHa}마리</span><button class="action gray" onclick="hrExpandPasture()">방목지 확장</button></div></div>`;
 return html;
};
window.hrExpandPasture=function(){
 const res=R.expandPasture(state);
 if(!res.ok){alert(res.reason);return;}
 log('방목지 1ha 확장 · '+res.hectares+'ha / 어린 말 수용 '+res.capacity+'마리');
 save();render();
};
const priorDay=advanceDay;
advanceDay=function(...args){
 const before=today();
 const result=priorDay.apply(this,args);
 const now=today();
 if(!state.startDone||before===now)return result;
 const report=R.rearingDay(state,now);
 const hoof=R.hoofCare(state,now);
 if(report.delayed)log('육성마 사육 환경 영향 · 자연 성장 일부 지연 ('+report.delayed+'점)');
 if(report.recovered)log('육성마 성장 회복 · '+report.recovered+'점 보완');
 // The normal base upkeep already covers routine feeding and farrier visits:
 // avoid charging a second daily or monthly fee for automatic care.
 if(!args[0]&&!HR_BATCH_DAY){
  // The base day loop saved before this late integration executed.
  // Persist new rearing state every ordinary day, not only on events.
  save();
  if(report.delayed||report.recovered||hoof||report.overcrowded)render();
 }
 return result;
};
save();render();
})();
