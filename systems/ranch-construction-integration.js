/* HORSE RANCH: agreed core loop integration; separate from racing and breeding. */
(function(root){
'use strict';
const C=root.HorseRanchConstruction;
if(!C){console.error('Construction module missing');return;}
const baseDay=advanceDay;
advanceDay=function(...args){
 if(!state.startDone||!C.ensure(state))return baseDay.apply(this,args);
 const wasMonth=String(state.year)+'-'+String(state.month);
 const beforeDay=Number(state.day);
 const result=baseDay.apply(this,args);
 const done=C.advance(state);
 if(done.length)done.forEach(j=>log(C.PLANS[j.type].label+' 공사 완료 · '+j.location));
 if(beforeDay===30&&(String(state.year)+'-'+String(state.month))!==wasMonth){
  const bill=C.closeMonth(state,wasMonth);
  if(bill.applied)log(wasMonth+' 시설 유지비 '+money(bill.paid)+(bill.unpaid?' · 미납 '+money(bill.unpaid):''));
 }
 // Wrappers around advanceDay may already render; refresh the construction section.
 if(!args[0]){save();render();}
 return result;
};
root.startRanchConstruction=function(type){
 if(!state.startDone)return;
 const q=C.begin(state,type);
 if(!q.ok){alert(q.reason);return;}
 log(C.PLANS[type].label+' 착공 · '+C.PLANS[type].days+'일 · '+money(q.spent));
 save();render();
};
const oldDashboard=dashboard;
dashboard=function(){
 const base=oldDashboard();
 const b=C.ensure(state);if(!b)return base;
 const rows=b.jobs.map(j=>'<div class="notice">'+escapeHtml(C.PLANS[j.type].label)+' · '+Math.max(0,j.dueDay-C.dayIndex(state))+'일 남음 · '+escapeHtml(j.location)+'</div>').join('');
 const controls=Object.keys(C.PLANS).map(type=>{
  const p=C.PLANS[type],q=C.quote(state,type);
  return '<div class="card"><b>'+escapeHtml(p.label)+'</b><div class="small">'+money(p.cost)+' · '+p.days+'일 · 월 유지비 '+money(p.upkeep)+'</div><button class="action gray" onclick="startRanchConstruction(\''+type+'\')" '+(q.ok?'':'disabled')+'>건설</button>'+(q.ok?'':'<div class="small">'+escapeHtml(q.reason)+'</div>')+'</div>';
 }).join('');
 return base+'<div class="panel" id="ranchConstructionPanel"><div class="panelTitle"><h2>목장 시설 건설</h2><span class="badge">완공 후 적용</span></div>'+
 '<div class="stat"><span>마방 수용</span><b>'+state.horses.length+' / '+state.stalls+'칸</b></div>'+
 '<div class="stat"><span>남은 부지</span><b>'+C.available(state)+' / '+b.capacity+'</b></div>'+
 '<div class="stat"><span>예상 월 시설 유지비 (완공 시설 기준)</span><b>'+money(C.INITIAL_MONTHLY_UPKEEP+b.completed.reduce((n,j)=>n+C.PLANS[j.type].upkeep,0))+'</b></div>'+
 (b.jobs.length?'<h3>진행 중 공사</h3>'+rows:'<div class="small">진행 중인 공사가 없습니다.</div>')+
 '<h3>건설 및 확장</h3><div class="grid">'+controls+'</div><div class="small">시설 배치는 자동이며 공사 진행은 날짜를 넘길 때마다 계산됩니다. 일상 사육·교육은 기존 시스템을 유지합니다.</div></div>';
};
save();render();
})(typeof globalThis!=='undefined'?globalThis:this);
