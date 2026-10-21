/* HORSE RANCH 20.6 — monthly NPC training & quarterly plan refresh.
 * Load after 20.5 competition integration and 20.4 core initialization.
 */
(function(){
 'use strict';
 const T=window.HorseRanchNpcTraining,F=window.HorseRanchFoalEducation;
 if(!T||!F){console.error('20.6 NPC training dependency missing');return;}
 T.ensure(state); // existing saves do not get retroactive training
 const beforeDay=advanceDay;
 advanceDay=function(...args){
   const previous=T.monthOf(state);
   const output=beforeDay.apply(this,args);
   if(state.startDone&&T.monthOf(state)!==previous){
     try{
       const economy=window.HorseRanchEconomy;
       const result=T.advance(state,F.trainingGain,economy?{trainingBudget:(r,w)=>economy.trainingBudget(r,w)}:{});
       if(economy&&result.applied)economy.settleNpcTraining(state,result.summaries);
       if(result.applied){
         const growth=result.summaries.reduce((n,x)=>n+x.gains,0);
         const ranches=result.summaries.length;
         log(`${result.month} 네임드 ${ranches}개 목장 월간 조교 완료 · 성장 합계 ${growth}${result.review?' · 분기 계획 갱신':''}`);
         save();
         if(!args[0]&&!HR_BATCH_DAY)render();
       }
     }catch(error){console.error('20.6 NPC training failed:',error);}
   }
   return output;
 };
 const oldDashboard=dashboard;
 dashboard=function(){
   const f=T.ensure(state);
   const named=(state.npcs||[]).filter(n=>n.named);
   if(!named.length)return oldDashboard();
   const rows=named.map(r=>{
     const plan=f.ranches[r.name],last=plan?.last;
     const focus={speed:'속도',stamina:'지구력',power:'파워'}[plan?.focus]||'-';
     const best=Math.round(T.strength(r.horses)||0);
     return `<tr><td>${escapeHtml(r.name)}</td><td>${r.horses.length}마</td><td>${best}</td><td>${escapeHtml(plan?.mode||'-')}</td><td>${focus}</td><td>${last?`${last.improved}마 개선 · +${last.gains}`:'첫 정산 전'}</td></tr>`;
   }).join('');
   return oldDashboard()+`<div class="panel"><div class="panelTitle"><div><h2>네임드 NPC 육성 현황 · 20.6</h2><div class="small">매월 자동 조교 · 매 3개월마다 계획 재검토 · 플레이어 말은 변경하지 않음</div></div><span class="badge">마지막 처리 ${escapeHtml(f.lastMonth||'-')}</span></div><div style="overflow-x:auto"><table class="table"><thead><tr><th>목장</th><th>보유마</th><th>상위마 평균 레이팅</th><th>육성 강도</th><th>이번 분기 훈련 우선</th><th>최근 훈련 결과</th></tr></thead><tbody>${rows}</tbody></table></div><div class="small">레이팅은 경주 결과로만 변동됩니다. 훈련비는 20.13 목장 경제에서 실제 보유 자금으로 정산됩니다.</div></div>`;
 };
 save();render();
})();
