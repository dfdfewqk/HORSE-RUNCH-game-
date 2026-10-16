/* HORSE RANCH 20.8 — NPC annual roster renewal bridge.
 * Called AFTER lifecycle aging, without changing player horses, races, or money.
 */
(function(){
'use strict';
const R=window.HorseRanchNpcTurnover;
if(!R){console.error('HORSE RANCH: 20.8 roster system missing');return;}
R.ensure(state); // no retroactive newcomer generation on old saves
function createIncoming(spec,ranch,year){
  const opts={
    speed:spec.stats.speed,stamina:spec.stats.stamina,power:spec.stats.power,
    gp:spec.gp,
    genetic:{speed:Math.max(spec.stats.speed,spec.gp),stamina:Math.max(spec.stats.stamina,spec.gp-2),power:Math.max(spec.stats.power,spec.gp-1)},
    caps:{speed:Math.max(spec.stats.speed,spec.gp),stamina:Math.max(spec.stats.stamina,spec.gp),power:Math.max(spec.stats.power,spec.gp)},
    pedigree:spec.elite?rnd(78,90):rnd(57,83),
    starts:spec.experience.starts,wins:Math.min(spec.experience.wins,spec.experience.starts)
  };
  const h=makeHorse(spec.age,opts);
  // The imported horses are pre-trained elsewhere; do not invent a player
  // education history or unobserved G1 win records for them.
  h.foalEducation=null;
  HorseRanchLifeCycle.ensure(h);
  h.rating=HorseRanchCompetitionRules.initialRating(h);
  return h;
}
const beforeAdvance=advanceDay;
advanceDay=function(...args){
  const year=Number(state.year);
  const out=beforeAdvance.apply(this,args);
  if(state.startDone&&Number(state.year)!==year){
    try{
      const result=R.advance(state,createIncoming);
      if(result.applied){
        const named=result.ranches.filter(r=>r.named).reduce((n,r)=>n+r.added,0);
        log(`${result.year}년 NPC 경주마 세대교체 · 신규 ${result.added}마 (네임드 ${named}마) · 기존 말·전적 유지`);
        save();
        if(!args[0]&&!HR_BATCH_DAY)render();
      }
    }catch(err){console.error('HORSE RANCH 20.8 NPC turnover:',err);}
  }
  return out;
};
const beforeDashboard=dashboard;
dashboard=function(){
  const snap=R.ensure(state).last;
  const named=(state.npcs||[]).filter(n=>n.named);
  const rows=named.map(n=>{
    const actual=(n.horses||[]).filter(h=>!h.retired&&Number(h.age)>=2).length;
    const prev=snap?.ranches?.find(r=>r.ranch===n.name);
    const example=prev?.examples?.length?prev.examples.join(', '):'—';
    return `<tr><td>${escapeHtml(n.name)}</td><td>${actual} / ${n.horses.length}마</td><td>${n.stalls||'-'}마</td><td>${prev?prev.added+'마':'첫해 대기'}</td><td>${escapeHtml(example)}</td></tr>`;
  }).join('');
  return beforeDashboard()+`<div class="panel"><div class="panelTitle"><div><h2>경쟁 목장 세대교체 · 20.8</h2><div class="small">매년 신예·실전마 신규 영입 · 은퇴마·기존 기록 유지 · 최대 수용량 100마리</div></div><span class="badge">${snap?snap.year+'년 '+snap.added+'마 신규':'첫 연도 대기'}</span></div>
  <table class="table"><tr><th>네임드 목장</th><th>현역 / 보유</th><th>수용량</th><th>새 영입</th><th>대표 신규 말</th></tr>${rows}</table>
  <div class="small">일반 NPC 목장은 출전마만 간소하게 보충합니다. 폐사·번식·경매 연계는 미구현이며, 수용량이 가득 차면 신규 영입이 중단됩니다.</div></div>`;
};
save();render();
})();
