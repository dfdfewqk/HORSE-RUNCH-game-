/* HORSE RANCH 20.7 browser bridge: aging and permanent career records.
 * Runs after 20.4, 20.5 and 20.6; does not change their economic or race math.
 */
(function(){
 'use strict';
 const A=window.HorseRanchLifeCycle;
 if(!A){console.error('20.7 aging module is unavailable');return;}
 A.ensureWorld(state);
 const beforeAdvance=advanceDay;
 advanceDay=function(...args){
   const year=state.year;
   const out=beforeAdvance.apply(this,args);
   if(state.startDone&&state.year!==year){
     const change=A.advanceYear(state,HorseRanchFoalEducation.updateAge);
     if(change.applied){log(`새해 경주마 노화·은퇴 처리 · 능력 감소 합계 ${change.declines} · 은퇴 ${change.retirements}마`);save();if(!args[0]&&!HR_BATCH_DAY)render();}
   }
   return out;
 };
 const beforeTrain=train;
 train=function(id,stat){
   const h=horse(id);
   if(!h||!['speed','stamina','power'].includes(stat))return beforeTrain.apply(this,arguments);
   const max=A.effectiveCap(h,stat);
   if(Number(h[stat])>=max)return alert(`${age(h)}세의 현재 신체 능력 한계입니다. 전성기 능력은 훈련으로 되찾을 수 없습니다.`);
   const out=beforeTrain.apply(this,arguments);
   if(Number(h[stat])>max){h[stat]=max;save();render();}
   return out;
 };
 const beforeRace=runRace;
 runRace=function(id,jid,show=true){
   const race=state.races.find(r=>r.id===id);
   const out=beforeRace.apply(this,arguments);
   if(race?.state==='finished'&&!race.lifeAchievementsRecorded){
     const entries=new Map(allHorseObjects().map(h=>[String(h.id),h]));
     for(const row of race.result||[]){const h=entries.get(String(row.horseId));if(h)A.recordRace(h,race,Number(row.place));}
     race.lifeAchievementsRecorded=true;save();
   }
   return out;
 };
 const beforeSell=sellHorse;
 sellHorse=function(id){
   const h=horse(id),count=state.horses.length;
   const out=beforeSell.apply(this,arguments);
   if(h&&state.horses.length===count-1&&!state.horses.some(x=>x.id===h.id)){
     if(A.archive(state,h,'판매',state.year)){log(`${h.name}의 주요 우승 기록을 명예의 전당에 보존했습니다.`);save();render();}
   }
   return out;
 };
 const beforeAbility=profileAbilityTab;
 profileAbilityTab=function(h){
   const lc=A.ensure(h),old=beforeAbility(h);
   const aged=Number(h.age)>=11;
   return old+`<div class="profileSection"><h3>생애·노화 · 20.7</h3><div class="stat"><span>노화 상태</span><b>${aged?'전성기 이후 · 회복 불가 감소':'11세부터 노화 본격화'}</b></div><div class="stat"><span>관측 최고 능력 (속도/지구력/파워)</span><b>${['speed','stamina','power'].map(k=>lc.peakStats[k]).join(' / ')}</b></div>${aged?`<div class="stat"><span>현재 훈련 가능 한계</span><b>${['speed','stamina','power'].map(k=>A.effectiveCap(h,k)).join(' / ')}</b></div>`:''}<div class="small">11세 최초 큰 능력 하락, 이후 완만하게 감소. 유전 잠재력은 그대로 유지. 기존 저장의 최고값은 보관된 관측값만 사용.</div></div>`;
 };
 const beforeHistory=history;
 history=function(){
   const awarded=allHorseObjects().filter(h=>A.title(h));
   const archived=Array.isArray(state.horseLegends)?state.horseLegends:[];
   const ids=new Set(awarded.map(h=>String(h.id)));
   const retained=archived.filter(x=>!ids.has(String(x.id)));
   const names=awarded.map(h=>({id:h.id,name:h.name,title:A.title(h),age:h.age,wins:h.wins||0,retired:h.retired,reason:h.retired?'경주 은퇴':'현역',peakRating:A.ensureAchievements(h).peakRating,majorWins:A.ensureAchievements(h).majorWins}));
   names.push(...retained.map(h=>({id:h.id,name:h.name,title:h.title,age:h.age,wins:h.wins,retired:true,reason:h.reason||'기록 보존',peakRating:h.peakRating,majorWins:h.majorWins||[]})));
   names.sort((a,b)=>(b.majorWins?.filter(x=>x.grade==='G1').length||0)-(a.majorWins?.filter(x=>x.grade==='G1').length||0)||
     (b.majorWins?.length||0)-(a.majorWins?.length||0)||(b.wins||0)-(a.wins||0));
   const rows=names.slice(0,24).map(h=>`<tr><td><button class="action gray" onclick="hrOpenHorseLegend(${Number(h.id)})">${escapeHtml(h.name)}</button></td><td>${escapeHtml(h.title||'-')}</td><td>${h.wins||0}승</td><td>${h.peakRating??'-'}</td><td>${escapeHtml(h.reason||'현역')}</td></tr>`).join('');
   return beforeHistory()+`<div class="panel"><div class="panelTitle"><h2>명예의 전당 · 20.7</h2><span class="badge">${names.length}마</span></div><div class="small">주요 등급 우승·통산 승수 및 관측 최고 레이팅 기록을 보존합니다. 판매한 명마와 은퇴마도 남습니다.</div><table class="table"><tr><th>경주마</th><th>업적</th><th>우승</th><th>최고 레이팅</th><th>상태</th></tr>${rows||'<tr><td colspan="5">아직 기록이 없습니다.</td></tr>'}</table></div>`;
 };
 window.hrOpenHorseLegend=function(id){
   const h=allHorseObjects().find(x=>Number(x.id)===Number(id));
   const copy=(state.horseLegends||[]).find(x=>Number(x.id)===Number(id));
   if(!h&&!copy)return;
   const achievements=h?A.ensureAchievements(h):{majorWins:copy.majorWins||[],peakRating:copy.peakRating};
   const name=h?.name||copy.name, wins=h?.wins??copy.wins;
   const markers=achievements.majorWins.slice().sort((a,b)=>b.year-a.year||b.month-a.month||b.day-a.day);
   openModal(`<div class="between"><h2>${escapeHtml(name)} · 명마 기록</h2><button class="action gray" onclick="closeModal()">닫기</button></div>
   <div class="stat"><span>주요 업적</span><b>${escapeHtml(h?A.title(h):copy.title)}</b></div>
   <div class="stat"><span>누적 우승</span><b>${wins||0}승</b></div>
   <div class="stat"><span>최고 관측 레이팅</span><b>${achievements.peakRating??'-'}</b></div>
   <h3>주요 대회 우승</h3>${markers.map(m=>`<div class="stat"><span>${m.year}년 ${m.month}월 ${m.day}일 · ${escapeHtml(m.grade)} · ${Number(m.dist)||'-'}m</span><b>1착</b></div>`).join('')||'<div class="small">확인된 등급 우승 기록 없음</div>'}`);
 };
 save();render();
})();
