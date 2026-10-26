/* HORSE RANCH — agreed player choices and decision-aware time progression.
 * Loads after current lifecycle, lifespan, schooling, economy integrations.
 */
(function(){
'use strict';
const C=window.HorseRanchLifeChoice,L=window.HorseRanchLifeSpan,A=window.HorseRanchLifeCycle;
if(!C||!L||!A){console.error('HORSE RANCH life choice prerequisites missing');return;}
C.ensure(state);
function persist(){save();render();}
window.hrLifeRequest=function(id){
 const h=C.find(state,id);if(!h)return;
 if(!h.retired){
  if(!confirm(h.name+'의 경주 은퇴를 결정할까요?'))return;
  h.retired=true;
 }
 const r=C.queue(state,id,'플레이어의 은퇴·진로 결정');
 if(!r.ok)return alert(r.reason);
 log(h.name+' · 은퇴 후 진로 결정을 기다립니다.');persist();
};
window.hrLifeDecide=function(id,mode){
 const r=C.decide(state,id,mode,{lifespan:L,archiveLegend:h=>A.archive(state,h,'외부 이전',state.year)});
 if(!r.ok)return alert(r.reason);
 const labels={breeding:'번식마 보유',keep:'직접 보호',board:'외부 위탁',place:'외부 입양·보호시설에 소유권 이전'};
 log(r.name+' · '+labels[mode]+' 결정');persist();
};
window.hrLifeReturn=function(id){
 const r=C.returnFromBoarding(state,id);
 if(!r.ok)return alert(r.reason);
 log(C.find(state,id)?.name+' · 외부 위탁 종료, 목장 복귀');persist();
};
const previousStable=stable;
stable=function(){
 let html=previousStable.apply(this,arguments);
 const owned=state.horses,pending=C.ensure(state).pending.map(q=>C.find(state,q.id)).filter(Boolean);
 const resolved=owned.filter(h=>h.retired&&h.hrAftercare?.status!=='pending');
 const active=owned.filter(h=>!h.retired);
 html+='<div class="panel"><div class="panelTitle"><h2>은퇴마 진로</h2><span class="badge">선택 대기 '+pending.length+'마리</span></div><div class="small">경주 은퇴와 생애 종료는 별개입니다. 외부 위탁마는 마방을 차지하지 않으며 기존 마리당 월 사육비 기준으로 관리됩니다.</div>';
 for(const h of pending){
  html+='<div class="card" style="margin-top:8px"><b>'+escapeHtml(h.name)+'</b><div class="small">진로를 결정하면 시간 진행을 재개합니다.</div><div class="row">'+
  [['breeding','번식마로 남기기'],['keep','직접 보호'],['board','외부 위탁'],['place','소유권 이전']].map(([mode,label])=>
   '<button class="action gray" onclick="hrLifeDecide('+Number(h.id)+',\''+mode+'\')">'+label+'</button>').join('')+'</div></div>';
 }
 if(resolved.length){
  html+='<details style="margin-top:8px"><summary>기존 은퇴마 관리 ('+resolved.length+'마리)</summary>';
  for(const h of resolved){
   const label={breeding:'번식마',keep:'직접 보호',board:'외부 위탁'}[h.hrAftercare?.status]||'진로 미지정';
   html+='<div class="row" style="margin-top:7px"><b>'+escapeHtml(h.name)+'</b><span class="small">'+label+'</span>'+
   (h.hrAftercare?.status==='board'?'<button class="action gray" onclick="hrLifeReturn('+Number(h.id)+')">목장 복귀</button>':'')+
   '<button class="action gray" onclick="hrLifeRequest('+Number(h.id)+')">진로 변경</button></div>';
  }
  html+='</details>';
 }
 if(active.length){
  html+='<details style="margin-top:8px"><summary>보유마 경주 은퇴 결정</summary>'+
   active.map(h=>'<div class="row" style="margin-top:7px"><span>'+escapeHtml(h.name)+'</span><button class="action gray" onclick="hrLifeRequest('+Number(h.id)+')">경주 은퇴</button></div>').join('')+'</details>';
 }
 return html+'</div>';
};
const oldDashboard=dashboard;
dashboard=function(){
 const x=C.ensure(state),latest=x.lastSummary;
 let html=oldDashboard.apply(this,arguments);
 if(x.pending.length)html+='<div class="notice warn"><b>은퇴 진로 결정 '+x.pending.length+'건</b> · 시간 진행 중단 <button class="action" onclick="state.tab=\'stable\';render()">진로 결정</button></div>';
 if(latest?.days>0)html+='<div class="notice"><b>최근 '+latest.days+'일 결과</b> · 출산 '+latest.births+' · 경주 '+latest.races+' · 교육 수료 '+latest.education+' · 자연사 '+latest.deaths+(latest.stopped?' · 중요 결정으로 중단':'')+'</div>';
 return html;
};
function blank(){return{days:0,births:0,races:0,education:0,deaths:0,retirements:0,stopped:false};}
const previousDay=advanceDay;
advanceDay=function(...args){
 const x=C.ensure(state);
 if(x.pending.length){if(!args[0])alert('은퇴마의 진로를 결정한 뒤 날짜를 진행하세요.');return;}
 const beforeYear=state.year,before=today(),owned=new Set(state.horses.map(h=>String(h.id)));
 const priorRetired=new Set(state.horses.filter(h=>h.retired).map(h=>String(h.id)));
 const priorDeaths=new Set((state.horseLifeEvents||[]).map(e=>e.year+'|'+e.id));
 const priorResults=state.results.length;
 const school=window.HorseRanchInteraction?.ensureWorld(state),priorEducation=school?.history?.length||0;
 const out=previousDay.apply(this,args);
 if(!state.startDone||today()===before)return out;
 if(state.year!==beforeYear)C.advancePlaced(state,state.year);
 let newly=0;
 for(const h of state.horses){
  if(h.retired&&!priorRetired.has(String(h.id))&&!h.hrAftercare?.status){
   C.queue(state,h.id,'경주 은퇴');newly++;
  }
 }
 const sum=x.running||blank();
 sum.days++;
 sum.births+=state.horses.filter(h=>!owned.has(String(h.id))).length;
 sum.races+=Math.max(0,state.results.length-priorResults);
 sum.education+=Math.max(0,(school?.history?.length||0)-priorEducation);
 sum.deaths+=(state.horseLifeEvents||[]).filter(e=>!priorDeaths.has(e.year+'|'+e.id)).length;
 sum.retirements+=newly;sum.stopped=x.pending.length>0;
 if(!x.running)x.lastSummary=sum;
 save();
 if(!args[0]&&!HR_BATCH_DAY&&x.pending.length)render();
 return out;
};
function advanceSpan(days){
 if(!state.startDone)return alert('먼저 게임을 시작하세요.');
 const x=C.ensure(state);
 if(x.pending.length)return alert('은퇴마의 진로를 결정한 뒤 진행하세요.');
 x.running=blank();HR_BATCH_DAY=true;
 try{for(let i=0;i<days;i++){if(x.pending.length)break;advanceDay(true);}}
 finally{HR_BATCH_DAY=false;x.lastSummary=x.running;x.running=null;save();render();}
}
advanceWeek=function(){advanceSpan(7);};
advanceMonth=function(){advanceSpan(30);};
save();render();
})();
