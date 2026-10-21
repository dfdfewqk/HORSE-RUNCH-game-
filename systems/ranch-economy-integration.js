/* HORSE RANCH 20.13 — link existing monthly school, NPC training and races
 * to real balances. Loaded last; do not rewrite existing player fee ledgers.
 */
(function(){
'use strict';
const E=window.HorseRanchEconomy;
if(!E){console.error('20.13 economy module unavailable');return;}
const store=E.ensure(state);
// Old races predate the NPC prize system; no retroactive prizes on migration.
if(!store.raceMigrationDone){for(const r of state.races||[])if(r.state==='finished')r.npcPurseSettled=true;store.raceMigrationDone=true;}
// An ordinary player purchase is a real NPC sale; the pre-20.13 market
// debited the player's wallet but did not credit the NPC's owner.
const priorBuy=buyHorse;
buyHorse=function(id,owner){
 const seller=state.npcs.find(x=>x.name===owner);
 const h=seller?.horses.find(x=>String(x.id)===String(id));
 const price=h?marketPrice(h):0;
 const priorBalance=state.money;
 const out=priorBuy.apply(this,arguments);
 if(h&&seller&&!seller.horses.includes(h)&&state.horses.includes(h)&&state.money===priorBalance-price){
  const e=E.ensure(state);
  seller.funds+=price;e.ranches[seller.name].totalSales+=price;
  save();
 }
 return out;
};
const priorRace=runRace;
runRace=function(...args){
 const result=priorRace.apply(this,args);
 const r=state.races.find(x=>x.id===args[0]);
 if(r?.state==='finished'&&!r.npcPurseSettled){E.creditFinishedRaces(state);save();}
 return result;
};
const priorDay=advanceDay;
advanceDay=function(...args){
 if(!state.startDone)return priorDay.apply(this,args);
 const departingMonth=E.monthKey(state),lastDay=Number(state.day)===30;
 const playerCount=lastDay?state.horses.length:0;
 const npcCounts=lastDay?Object.fromEntries(state.npcs.map(r=>[r.name,r.horses.length])):null;
 const out=priorDay.apply(this,args);
 // NPC races were auto-completed when leaving a race day.
 const income=E.creditFinishedRaces(state);
 if(lastDay&&E.monthKey(state)!==departingMonth){
  const report=E.closeMonth(state,departingMonth,playerCount,npcCounts,marketPrice);
  if(report.applied){
   log(`${departingMonth} 월말 사육비 ${money(report.playerPaid)}${report.playerUnpaid?' · 미납 '+money(report.playerUnpaid):''} · NPC 매각 ${report.npcSales.length}건`);
  }
 }
 if(income.events||lastDay){save();if(!args[0]&&!HR_BATCH_DAY)render();}
 return out;
};
const oldDashboard=dashboard;
dashboard=function(){
 const x=E.ensure(state),summary=x.recent.slice(-1)[0];
 const named=(state.npcs||[]).filter(r=>r.named);
 const rows=named.map(r=>{const s=E.status(r.funds,r.horses?.length);return `<tr><td>${escapeHtml(r.name)}</td><td>${money(r.funds)}</td><td>${s.runway.toFixed(1)}개월</td><td>${escapeHtml(s.status)}</td></tr>`;}).join('');
 return oldDashboard()+`<div class="panel"><div class="panelTitle"><h2>목장 경제 · 20.13</h2><span class="badge">기본 사육비 월 ${money(E.CONFIG.monthlyUpkeep)} / 마리</span></div>
 <div class="stat"><span>내 말 ${state.horses.length}마리 · 다음 월 사육비(예상)</span><b>${money(state.horses.length*E.CONFIG.monthlyUpkeep)}</b></div>
 <div class="stat"><span>기본 사육비 미납</span><b>${money(x.player.unpaid)}</b></div>
 <div class="small">기존 교육·조교비는 기존 월말 장부에서만 정산합니다. 교배 예약료도 기존 방식대로 한 번만 납부합니다. 치료 기능이 없으므로 치료비는 아직 청구하지 않습니다.</div>
 ${summary?`<div class="small">지난 월말: ${escapeHtml(summary.month)} · 회생·위기 목장 ${summary.crisis}곳 · 실제 NPC 매각 ${summary.npcSales}건</div>`:''}
 <table class="table" style="margin-top:10px"><tr><th>네임드 목장</th><th>보유 자금</th><th>사육비 기준 운영 가능</th><th>상태</th></tr>${rows}</table></div>`;
};
save();render();
})();
