/* HORSE RANCH 20.12 — race-day close bridge.
 * Loaded last, after 20.11 ranking and 20.10 auction. Existing registrations
 * remain playable throughout their race date; only unplayed races auto-close
 * when advancing to the NEXT calendar day.
 */
(function(){
'use strict';
const N=window.HorseRanchNpcAutoRacing,engine=window.HorseRanchRaceEngine;
const C=window.HorseRanchCompetitionRules,A=window.HorseRanchLifeCycle,M=window.HorseRanchRanking;
if(!N||!engine||!C||!A||!M){console.error('20.12 NPC auto racing prerequisites unavailable');return;}
N.ensure(state); // existing saves do not retroactively resolve historic races
const params={
 eligible:(h,r)=>eligible(h,r),
 score:(h,r,target)=>C.entrantScore(h,r,target),
 simulate:args=>engine.simulate(args),
 rating:h=>C.rating(h),
 newRating:(before,grade,place,size)=>C.newRating(before,grade,place,size),
 recordAchievement:(h,r,place)=>A.recordRace(h,r,place),
 recordMerit:(world,r)=>M.recordRace(world,r)
};
const beforeAdvance=advanceDay;
advanceDay=function(...args){
  if(!state.startDone)return beforeAdvance.apply(this,args);
  const leaving=N.dayOf(state);
  // Race-day games are resolved at close, not as soon as day 10/24 arrives.
  let outcome={applied:false,held:0,cancelled:0};
  try{outcome=N.closeDay(state,leaving,params);}catch(err){console.error('HORSE RANCH 20.12 NPC racing:',err);}
  if(outcome.applied){log(`NPC 자동 경주 · ${outcome.held}경기 완료${outcome.cancelled?' · 출전마 부족 '+outcome.cancelled+'경기':''}`);save();}
  const output=beforeAdvance.apply(this,args);
  // NPC horses previously did not recover from their fatigue and hoof wear.
  N.restoreNpcDaily(state);
  if(!args[0]&&!HR_BATCH_DAY){save();render();}
  return output;
};
window.hrOpenNpcRaceResult=function(id){
  const race=state.races.find(x=>String(x.id)===String(id));
  if(race)return openRaceResult(race.id);
  const item=N.ensure(state).history.find(x=>String(x.raceId)===String(id));
  if(!item)return alert('현재 저장된 NPC 경주 결과가 없습니다.');
  openModal(`<div class="between"><h2>NPC 경주 기록</h2><button class="action gray" onclick="closeModal()">닫기</button></div>
    <div class="small">${item.year}/${item.month}/${item.day} · ${escapeHtml(item.grade)} · ${item.dist}m</div>
    ${(item.podium||[]).map(x=>`<div class="stat"><span>${x.place}위 · ${escapeHtml(x.horseName)}</span><b>${escapeHtml(x.time)}초</b></div>`).join('')||'<div class="small">출전마 부족으로 경주가 취소되었습니다.</div>'}`);
};
const beforeDashboard=dashboard;
dashboard=function(){
  const s=N.ensure(state),last=s.history.filter(r=>r.status==='finished').slice(-3).reverse();
  return beforeDashboard()+`<div class="panel"><div class="panelTitle"><h2>NPC 자율 경주 · 20.12</h2><span class="badge">누적 ${s.totalRaces}경기</span></div>
  <div class="small">플레이어가 출전하지 않은 경주는 경기 당일이 끝나면 NPC끼리 치릅니다. 경주 점수와 전적은 정상 반영됩니다.</div>
  ${last.map(r=>`<div class="stat"><span>${r.year}년 ${r.month}/${r.day} · ${escapeHtml(r.grade)} · ${r.dist}m</span><b>${escapeHtml(r.winner||'-')}</b></div>`).join('')||'<div class="small">NPC 자동 경주가 아직 없습니다.</div>'}</div>`;
};
const beforeRaceList=raceList;
raceList=function(){
  const s=N.ensure(state),recent=s.history.slice(-10).reverse();
  const rows=recent.map(x=>`<tr><td>${x.year}/${x.month}/${x.day}</td><td>${escapeHtml(x.grade)}</td><td>${x.dist}m</td><td>${x.status==='finished'?escapeHtml(x.winner||'-'):'출전마 부족'}</td><td><button class="action gray" onclick="hrOpenNpcRaceResult('${escapeHtml(x.raceId)}')">결과</button></td></tr>`).join('');
  return beforeRaceList()+`<div class="panel"><div class="panelTitle"><h2>NPC 자동 경주 최근 결과</h2><span class="badge">누적 ${s.totalRaces}경기</span></div>
  <table class="table"><tr><th>날짜</th><th>등급</th><th>거리</th><th>우승마</th><th>기록</th></tr>${rows||'<tr><td colspan="5">아직 자동 경주 기록이 없습니다.</td></tr>'}</table></div>`;
};
save();render();
})();
