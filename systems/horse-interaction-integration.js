/* HORSE RANCH 20.15 — user-facing schooling and rider relationships.
 * Loaded last so old saves, existing NPC races and other systems remain intact.
 */
(function(){
'use strict';
const I=window.HorseRanchInteraction,F=window.HorseRanchFoalEducation;
if(!I||!F){console.error('HORSE RANCH 20.15 dependency missing');return;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hById=id=>state.horses.find(h=>String(h.id)===String(id));
const getR=(hid,jid,make=false)=>horseJockeyRelation(hid,jid,make);
I.ensureWorld(state);
state.horses.forEach(h=>{I.ensureSchool(h);if(I.legacy(h))I.ensureLegacyTemperament(h);});
const beforeNormalize=normalize;
normalize=function(){const out=beforeNormalize.apply(this,arguments);I.ensureWorld(state);state.horses.forEach(h=>{I.ensureSchool(h);if(I.legacy(h))I.ensureLegacyTemperament(h);});return out;};
const beforeBirths=completeBirths;
completeBirths=function(){
 const ids=new Set(state.horses.map(h=>String(h.id)));
 const out=beforeBirths.apply(this,arguments);
 const findAncestor=id=>allHorseObjects().find(x=>String(x.id)===String(id));
 for(const h of state.horses){if(ids.has(String(h.id))||!Number.isFinite(h.foalEducation?.bornAtDay))continue;
  const father=findAncestor(h.fatherId),mother=findAncestor(h.motherId);
  const grand=[father&&findAncestor(father.fatherId),father&&findAncestor(father.motherId),mother&&findAncestor(mother.fatherId),mother&&findAncestor(mother.motherId)];
  I.bornTemperament(h,father,mother,grand);I.ensureSchool(h);
 }
 return out;
};
const beforeEligibility=eligible;
eligible=function(h,r){return beforeEligibility(h,r)&&(!h||(!I.occupied(state,h.id)&&(I.legacy(h)||I.ensureSchool(h)?.safe)));};
const beforeEducate=educateFoal;
educateFoal=function(id){const h=hById(id);if(h?.hrSchooling)return alert('새로 태어난 말은 시설 위탁 교육에서 진행하세요.');return beforeEducate.apply(this,arguments);};
const beforeTrain=train;
train=function(id){return alert('20.15부터 일상 신체 조교는 날짜 진행에 따라 자동으로 이루어집니다. 시설 교육과 지정 기수 조교를 선택하세요.');};
const beforeSell=sellHorse;
sellHorse=function(id){if(I.occupied(state,id))return alert('시설에 위탁 중인 말은 판매할 수 없습니다.');return beforeSell.apply(this,arguments);};
const beforeBuy=buyHorse;
buyHorse=function(id,owner){return beforeBuy.apply(this,arguments);};
const beforeConsign=window.hrAuctionConsign;
if(typeof beforeConsign==='function')window.hrAuctionConsign=function(id){
 if(I.occupied(state,id))return alert('시설 위탁 중에는 특별 경매에 출품할 수 없습니다.');
 const h=hById(id);
 if(h&&window.HorseRanchLifeSpan?.hasPendingBreeding(state,h))return alert('출산 예약의 부모 말은 출산이 끝날 때까지 특별 경매에 출품할 수 없습니다.');
 return beforeConsign.apply(this,arguments);
};
const beforeBreeding=breed;
breed=function(){if(I.occupied(state,state.selectedDam)||I.occupied(state,state.selectedSire))return alert('시설 위탁 중인 말은 교배에 사용할 수 없습니다.');return beforeBreeding.apply(this,arguments);};
const beforeRegister=registerRace;
registerRace=function(rid,hid,jid){if(I.occupied(state,hid))return alert('시설 위탁 중에는 경주에 등록할 수 없습니다.');return beforeRegister.apply(this,arguments);};
const beforeOpeningRegister=registerOpeningRace;
registerOpeningRace=function(){if(I.occupied(state,openingStarter()?.id))return alert('교육시설에 위탁 중인 말은 경주에 출전할 수 없습니다.');return beforeOpeningRegister.apply(this,arguments);};
const beforeRun=runRace;
runRace=function(rid,jid,show=true){
 const h=hById(state.selectedHorse),race=state.races.find(r=>r.id===rid),before=(state.results||[]).length;
 const out=beforeRun.apply(this,arguments);
 if(h&&race&&race.state==='finished'&&state.results.length>before&&h.hrTemperament){
   const rel=getR(h.id,jid,true),result=I.observe(rel,h,getJockey(jid),I.dayOf(state),'경주');
   const row=state.results[state.results.length-1];row.hr15RelationDelta=result.delta;
   if(race.simulation?.behaviorEvents)row.hr15Behavior=race.simulation.behaviorEvents.find(x=>String(x.horseId)===String(h.id))?.type||'none';
   log(`${h.name} × ${getJockey(jid)?.name||'기수'} 관계 관찰: ${result.description} (${result.delta>=0?'+':''}${result.delta})`);save();
 }
 return out;
};
// Newborns are initialized AFTER birth and need a facility schedule; pre-20.15
// horses remain fully race-eligible and retain their existing record history.
window.hr15Enroll=function(id,kind,days){
 const h=hById(id),cost=I.fee(kind,days);
 if(!h)return;
 if(!F.canAfford(state,cost))return alert('확정된 교육비를 낼 자금이 부족합니다.');
 const r=I.enroll(state,h,kind,days);
 if(!r.ok)return alert(r.reason);
 state.money-=cost;log(`${h.name} ${I.COURSE[kind].name} ${days}일 입소 · 교육료 ${money(cost)}`);save();render();
};
window.hr15SchoolChoice=function(id,choice){
 const c=I.occupied(state,id),amount=c&&choice==='extend'?I.fee(c.kind,7):0;
 if(amount&&!F.canAfford(state,amount))return alert('기간 연장 비용이 부족합니다.');
 const r=I.decide(state,id,choice);if(!r.ok)return alert(r.reason);
 state.money-=r.cost;log(`${hById(id)?.name||'경주마'} 교육 중간 조치 · ${choice}${r.cost?' · '+money(r.cost):''}`);save();render();
};
window.hr15Rider=function(id,jockeyId,days){
 const h=hById(id),j=getJockey(jockeyId);
 const r=I.scheduleRider(state,h,j,days);if(!r.ok)return alert(r.reason);
 I.ensureRelation(getR(h.id,j.id,true),h,j);log(`${h.name} × ${j.name} 지정 기수 조교 ${days}일 예약`);save();render();
};
function schoolInfo(h){const s=I.ensureSchool(h);if(!s)return '<div class="small">기존 경주마 · 출전 자격 보존</div>';
 const done=s.completed.map(k=>I.COURSE[k]?.name||k).join(' · ')||'없음';return `<div class="small">이수: ${escapeHtml(done)} · 게이트 안전: <b>${s.safe?'적합':'미확인'}</b> · 스트레스 ${Math.round(s.stress)}</div>`;
}
function schoolButton(h,kind,d){const reason=I.canEnroll(state,h,kind,d);return `<button class="action gray" ${reason?'disabled title="'+escapeHtml(reason)+'"':''} onclick="hr15Enroll(${Number(h.id)},'${kind}',${d})">${d}일 · ${money(I.fee(kind,d))}</button>`;}
const beforeTraining=training;
training=function(){
 const w=I.ensureWorld(state),rows=state.horses.filter(h=>!h.retired);
 let html=`<div class="panel"><div class="panelTitle"><div><h2>교육시설 · 20.15</h2><div class="small">기간형 위탁 교육 · 어린 말의 안전 출전 자격 · 일반 조교는 자동 진행</div></div></div><div class="notice">교육료는 입소 시 한 번 결제합니다. 일상 사육비는 기존 월말 장부에서 정산하며, 같은 교육비를 중복 청구하지 않습니다.</div><div class="grid">`;
 for(const h of rows){const c=I.occupied(state,h.id),b=I.booked(state,h.id),t=I.ageDays(h,I.dayOf(state));
  html+=`<div class="card"><h3>${escapeHtml(h.name)} · ${age(h)}세</h3>${schoolInfo(h)}<div class="small">${t===null?'기존 경주마':`출생 후 ${Math.max(0,t)}일`} · 피로 ${Math.round(h.fatigue)} · 컨디션 ${Math.round(h.condition)}</div>`;
  if(c){const course=I.COURSE[c.kind];html+=`<div class="notice"><b>${course.name}</b> ${c.progress}/${c.days}일 진행 · ${c.mode==='gentle'?'완화 교육':'일반 교육'}</div>`;
   if(c.report&&!c.report.decision)html+=`<div class="notice"><b>시설 중간 보고:</b> ${escapeHtml(c.report.reason)}<div class="row"><button class="action" onclick="hr15SchoolChoice(${Number(h.id)},'gentle')">교육 완화</button><button class="action gray" onclick="hr15SchoolChoice(${Number(h.id)},'extend')">7일 연장</button><button class="action red" onclick="hr15SchoolChoice(${Number(h.id)},'return')">조기 복귀</button></div></div>`;
  }else {for(const [kind,config] of Object.entries(I.COURSE)){html+=`<div style="margin-top:7px"><b>${config.name}</b><div class="row">${config.days.map(d=>schoolButton(h,kind,d)).join('')}</div></div>`;}}
  if(b)html+=`<div class="small">지정 기수 조교 진행 · 실제 기승 ${b.rides}회 / 예약 ${b.ends-b.starts}일</div>`;
  html+='</div>';
 }
 html+='</div></div>';
 const jockeys=typeof JOCKEYS!=='undefined'?JOCKEYS:[];
 html+=`<div class="panel"><div class="panelTitle"><h2>지정 기수 조교</h2><span class="badge">7·14·30일 예약</span></div><div class="small">기수는 한 번에 한 마리를 전담합니다. 경주·회복 우선이며 실제 기승한 날에만 관계가 변화합니다.</div><div class="grid">`;
 for(const h of rows.filter(h=>age(h)>=2&&!I.occupied(state,h.id))){const current=I.booked(state,h.id);
  html+=`<div class="card"><b>${escapeHtml(h.name)}</b>${current?`<div class="small">예약 진행 · ${current.rides}회 탑승</div>`:jockeys.map(j=>{const rel=getR(h.id,j.id,false),observed=rel?.hr15?.observations||0,info=observed<2?'관찰 부족':observed<5?'반응 확인 중':'경험 누적';return `<div class="row" style="margin-top:6px"><span>${escapeHtml(j.name)} · ${info}</span>${[7,14,30].map(days=>`<button class="action gray" onclick="hr15Rider(${Number(h.id)},'${j.id}',${days})">${days}일</button>`).join('')}</div>`}).join('')}</div>`;
 }
 html+='</div></div>';
 const recent=w.history.slice(-6).reverse();html+=`<div class="panel"><h3>최근 교육 결과</h3>${recent.length?recent.map(x=>`<div class="small">${escapeHtml(hById(x.horseId)?.name||String(x.horseId))} · ${I.COURSE[x.kind]?.name||'-'} · ${escapeHtml(x.result)}</div>`).join(''):'<div class="small">아직 교육 결과가 없습니다.</div>'}</div>`;
 return html;
};
const oldDay=advanceDay;
advanceDay=function(...args){
 const prev=I.dayOf(state),out=oldDay.apply(this,args),today=I.dayOf(state);
 if(!state.startDone||today===prev)return out;
 const completed=I.schoolAdvance(state,hById);
 const riders=I.riderAdvance(state,hById,getJockey,getR);
 // Daily light exercise is automatic. Stat improvement only on a bounded
 // weekly session, reusing 20.4 trainingGain and the existing invoice ledger.
 let gains=0;
 for(const h of state.horses){I.routineCare(h,today);const s=I.ensureSchool(h);if(s)s.stress=clamp(s.stress-0.7,0,100);
  if(h.retired||h.injury||h.pregnantUntil||I.occupied(state,h.id)||age(h)<2||h.fatigue>=60||h.hoof<45)continue;
  if(today%7!==1)continue;
  const training=state.training;const key=monthKey();if(training.monthKey!==key){training.monthKey=key;training.used={};}
  const used=Number(training.used[h.id]||0);if(used>=4)continue;
  const cost=F.ADULT_TRAINING_FEE;if(!F.canAfford(state,cost))continue;
  const keys=['speed','stamina','power'];const type=keys[(Math.floor(today/7)+Number(h.id))%3];
  const cap=HorseRanchLifeCycle.effectiveCap(h,type);if(h[type]>=cap)continue;
  const probSeed=I.dayOf(state)+'|'+h.id+'|auto';let hashed=0;for(const c of probSeed){hashed=(Math.imul(hashed,31)+c.charCodeAt(0))>>>0;}
  const gain=Math.min(cap-h[type],F.trainingGain(h,type,()=>((hashed%10000)/10000)));
  h[type]+=gain;training.used[h.id]=used+1;
  // A training session costs physical effort even when it yields no stat gain.
  // Keep this separate from psychological schooling stress.
  h.fatigue=clamp((Number(h.fatigue)||0)+9,0,100);
  h.condition=clamp((Number(h.condition)||0)-2,25,100);
  F.accrue(state,cost);gains+=gain;
 }
 if(completed.length||riders.length||gains){for(const row of completed)log(`${hById(row.horseId)?.name||'경주마'} ${I.COURSE[row.kind]?.name} ${row.result}${row.safe?' · 게이트 안전 적합':''}`);
  if(riders.length)log(`지정 기수 조교 ${riders.length}회 진행 · 긍정/부정 반응 기록`);
  save();if(!args[0]&&!HR_BATCH_DAY)render();}
 return out;
};
const beforeDashboard=dashboard;
dashboard=function(){const s=I.ensureWorld(state),inSchool=s.contracts.filter(c=>c.status==='active').length,inRider=s.bookings.filter(b=>b.status==='active').length;
 return beforeDashboard()+`<div class="notice"><b>20.15 교육 진행</b> · 시설 위탁 ${inSchool}마리 · 지정 기수 조교 ${inRider}건 · <button class="action gray" onclick="state.tab='training';render()">교육 관리</button></div>`;
};
save();render();
})();
