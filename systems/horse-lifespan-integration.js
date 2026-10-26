/* HORSE RANCH 20.9 — lifespan bridge after 20.8 turnover.
 * Never retroactively applies death on load. No new races or economic costs.
 */
(function(){
'use strict';
const L=window.HorseRanchLifeSpan,A=window.HorseRanchLifeCycle;
if(!L||!A){console.error('HORSE RANCH 20.9 lifespan modules missing');return;}
L.ensureWorld(state);
const beforeAdvance=advanceDay;
advanceDay=function(...args){
  const previousYear=Number(state.year);
  const result=beforeAdvance.apply(this,args);
  if(state.startDone&&Number(state.year)!==previousYear){
    const report=L.advanceYear(state,{
      getAchievements:h=>A.ensureAchievements(h),
      getTitle:h=>A.title(h),
      archiveLegend:(h,year)=>{
        if(A.archive(state,h,'자연사',year)){
          const entry=(state.horseLegends||[]).find(x=>String(x.id)===String(h.id));
          if(entry){entry.deathYear=year;entry.deathAge=h.age;entry.reason='자연사';}
        }
      }
    });
    if(report.applied){
      if(report.deaths)log(`${report.year}년 자연사 ${report.deaths}마 · 혈통·주요 경주 기록 보존`);
      save();if(!args[0]&&!HR_BATCH_DAY)render();
    }
  }
  return result;
};
// A sale removes the horse from the active roster. Keep the true parents and
// observed temperament in the existing pedigree archive, without treating a
// sold horse as dead. Pending foals also require both parents until birth.
const beforeSell=sellHorse;
sellHorse=function(id){
  const h=(state.horses||[]).find(x=>String(x.id)===String(id));
  if(h&&L.hasPendingBreeding(state,h))
    return alert('출산 예약의 부모 말은 출산이 끝날 때까지 판매할 수 없습니다.');
  const result=beforeSell.apply(this,arguments);
  if(h&&!(state.horses||[]).some(x=>String(x.id)===String(h.id))){
    L.archivePedigree(state,h,'판매',state.year,state.ranchName||'플레이어 목장');
    save();if(!HR_BATCH_DAY)render();
  }
  return result;
};
const beforeHistory=history;
history=function(){
  const recent=(state.horseLifeEvents||[]).slice(-12).reverse();
  const total=state.horseLifespanClock?.totalDeaths||0;
  const rows=recent.map(x=>`<tr><td>${x.year}년</td><td>${escapeHtml(x.name)}</td><td>${Number(x.age)}세</td><td>${escapeHtml(x.owner||'-')}</td><td>${escapeHtml(x.title||'경력 보존')}</td></tr>`).join('');
  return beforeHistory()+`<div class="panel"><div class="panelTitle"><div><h2>역대 경주마 생애 기록 · 20.9</h2><div class="small">자연사한 말도 혈통과 주요 업적을 보존합니다. 30세 이상 장수하는 개체도 드물게 존재합니다.</div></div><span class="badge">누적 ${total}마</span></div><table class="table"><tr><th>연도</th><th>경주마</th><th>나이</th><th>마지막 목장</th><th>업적</th></tr>${rows||'<tr><td colspan="5">아직 기록이 없습니다.</td></tr>'}</table></div>`;
};
const beforeDashboard=dashboard;
dashboard=function(){
  const latest=(state.horseLifeEvents||[]).slice(-1)[0];
  return beforeDashboard()+`<div class="notice" style="margin-top:9px"><b>경주마 생애 기록</b> · 자연사 누적 ${Number(state.horseLifespanClock?.totalDeaths)||0}마${latest?' · 최근: '+escapeHtml(latest.name)+' ('+Number(latest.age)+'세)':''} · 기록실에서 확인</div>`;
};
save();render();
})();
