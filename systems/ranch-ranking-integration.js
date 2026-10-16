/* HORSE RANCH 20.11 — attribute each newly completed race to the ranch
 * that owned the entrant at the time; preserves historical merit after sale.
 */
(function(){
'use strict';
const R=window.HorseRanchRanking;
if(!R){console.error('HORSE RANCH ranking module unavailable');return;}
R.ensure(state);
const priorRunRace=runRace;
runRace=function(rid,jid,show=true){
 const race=state.races.find(x=>x.id===rid),wasFinished=race?.state==='finished';
 const output=priorRunRace.apply(this,arguments);
 if(race&&!wasFinished&&race.state==='finished'){
   const result=R.recordRace(state,race);
   if(result.added){save();if(show&&!HR_BATCH_DAY)render();}
 }
 return output;
};
const priorDashboard=dashboard;
dashboard=function(){
 const all=R.ranking(state),mine=all.find(r=>r.player),top=all.slice(0,3);
 const rows=top.map(r=>`<div class="stat"><span>${r.rank}위 · ${escapeHtml(r.name)}${r.player?' ★':''}</span><b>${r.score.toFixed(1)}점</b></div>`).join('');
 return priorDashboard()+`<div class="panel"><div class="panelTitle"><h2>목장 종합 순위 · 20.11</h2><span class="badge">내 목장 ${mine?.rank||'-'}위 / ${all.length}곳</span></div>
 <div class="small">경주 당시 소속 목장의 최근 360일 성적과 현재 상위 3마리 전력을 함께 계산합니다. G1 우승 비중이 가장 높습니다.</div>
 ${rows}<div class="notice">내 점수 ${mine?.score.toFixed(1)||'0.0'} = 전력 ${mine?.strengthScore.toFixed(1)||'0.0'} + 경주 실적 ${mine?.meritScore.toFixed(1)||'0.0'} · ${mine?.qualified?'금요일 특별 경매 출품 가능':'5위 이내 진입 시 출품 가능'}</div>
 <button class="action gray" onclick="state.tab='market';state.menu=false;render()">목장 전체 순위 확인</button></div>`;
};
save();render();
})();
