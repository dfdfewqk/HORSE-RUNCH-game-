/* HORSE RANCH 20.10 — in-game market and merit-only special auction bridge.
 * Runs after prior systems and preserves the existing save key and base functions.
 */
(function(){
'use strict';
const A=window.HorseRanchAuction;
if(!A){console.error('20.10 auction module not loaded');return;}
A.ensure(state);
const originalSell=sellHorse;
function resolve(){
 const day=A.dayOf(state),o=A.ensure(state);
 if(state.startDone&&A.isFriday(day))A.openAuction(state,day,marketPrice);
 return o;
}
function canSell(h){return h&&!h.retired&&Number(h.age)>=2&&!h.pregnantUntil&&!state.registrations.some(x=>String(x.horseId)===String(h.id));}
function myRank(){return A.ranking(state).find(x=>x.player);}
window.hrDailyBuy=function(id){
 const offer=A.daily(state).find(x=>String(x.horseId)===String(id));
 if(!offer)return alert('오늘의 판매 목록에 없는 말입니다.');
 const npc=state.npcs.find(n=>n.name===offer.owner),h=npc?.horses.find(x=>String(x.id)===String(id));
 if(!h)return alert('판매가 종료된 말입니다.');
 if(state.horses.length>=state.stalls)return alert('마방이 가득 찼습니다.');
 const price=marketPrice(h);if(state.money<price)return alert('자금이 부족합니다.');
 buyHorse(h.id,npc.name);
};
window.hrAuctionBid=function(id){
 resolve();const out=A.placeBid(state,id,marketPrice);
 if(!out.ok)return alert(out.reason);
 log(`특별 경매 입찰 · ${money(out.bid)} (낙찰 시에만 차감)`);save();render();
};
window.hrAuctionConsign=function(id){
 resolve();const h=horse(id);const out=A.consign(state,id,marketPrice);
 if(!out.ok)return alert(out.reason);
 log(`${h?.name||'경주마'} 특별 경매 출품 · 금요일 종료 후 낙찰 판정`);save();render();
};
sellHorse=function(id){
 const a=A.ensure(state).current;
 if(a?.status==='open'&&String(a.consignment?.horseId)===String(id))return alert('특별 경매에 출품 중인 말은 일반 판매할 수 없습니다.');
 return originalSell.apply(this,arguments);
};
market=function(){
 const o=resolve(),d=A.dayOf(state),rank=A.ranking(state),me=rank.find(x=>x.player),isOpen=A.isFriday(d),a=o.current;
 const daily=A.daily(state,d);
 const dailyHtml=daily.map(e=>{
  const n=state.npcs.find(x=>x.name===e.owner),h=n?.horses.find(x=>String(x.id)===String(e.horseId));if(!h)return'';
  return `<div class="card horseCard"><div class="between"><b>${escapeHtml(h.name)}</b><span class="badge">${age(h)}세 · ${genderLabel(h)}</span></div><div class="horseImgWrap"><img class="horseImg" src="${imgFor(h)}" alt="${escapeHtml(h.name)}"></div><div class="small">${escapeHtml(n.name)} · ${escapeHtml(h.distanceBand||'-')} · ${h.starts||0}전 ${h.wins||0}승</div><div class="stat"><span>판매가</span><b>${money(marketPrice(h))}</b></div><div class="row"><button class="action" onclick="hrDailyBuy(${Number(h.id)})">영입</button><button class="action gray" onclick="openPoolDetail(${Number(h.id)})">상세정보</button></div></div>`;
 }).join('');
 const upcoming=(4-A.weekday(d)+7)%7;
 const list=a&&a.status==='open'&&a.day===d?a:null;
 const auctionLots=list?[...list.lots,...(list.consignment?[list.consignment]:[])]:[];
 const lotsHtml=auctionLots.map(l=>{
  const n=state.npcs.find(x=>x.name===l.seller),h=l.sellerKind==='player'?horse(l.horseId):n?.horses.find(x=>String(x.id)===String(l.horseId));if(!h)return'';
  const mine=l.sellerKind==='player';
  return `<div class="card"><div class="between"><b>${escapeHtml(h.name)}</b><span class="badge">${mine?'내 출품마':'상위 목장 출품'}</span></div><div class="small">${escapeHtml(l.seller)} · ${age(h)}세 · ${h.starts||0}전 ${h.wins||0}승 · 레이팅 ${h.rating??'-'}</div><div class="stat"><span>최저 낙찰가</span><b>${money(l.reserve)}</b></div>${mine?'<div class="small">NPC 입찰 결과에 따라 낙찰 또는 유찰됩니다.</div>':`<div class="stat"><span>내 현재 입찰</span><b>${l.playerBid?money(l.playerBid):'미입찰'}</b></div><button class="action gold" onclick="hrAuctionBid(${Number(h.id)})">${l.playerBid?'50만원 추가 입찰':'첫 입찰'}</button>`}</div>`;
 }).join('');
 const consignment=me?.qualified&&!list?.consignment&&list?state.horses.filter(canSell).map(h=>`<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px dashed #3a3e44"><span>${escapeHtml(h.name)} · ${age(h)}세 · 시작가 ${money(marketPrice(h))}</span><button class="action gold" onclick="hrAuctionConsign(${Number(h.id)})">출품</button></div>`).join(''):'';
 const top=rank.slice(0,10),standings=me?.rank>10?[...top,me]:top;
 const rankings=standings.map(r=>`<tr><td>${r.rank}위</td><td>${escapeHtml(r.name)}${r.player?' ★':''}</td><td>${r.score.toFixed(1)}</td><td>${Number(r.strengthScore||0).toFixed(1)}</td><td>${Number(r.meritScore||0).toFixed(1)}</td><td>${r.g1Wins||0}</td><td>${r.active}마</td></tr>`).join('');
 const last=o.history.slice(-1)[0],lastResults=last?.results?.map(x=>`<div class="small">${escapeHtml(x.horseName||String(x.horseId))} · ${x.status==='sold'?'낙찰 '+money(x.price):'유찰'}</div>`).join('')||'';
 return `<div class="panel"><div class="panelTitle"><div><h2>일반 시장 · 매일 5마리</h2><div class="small">게임 날짜 ${state.year}년 ${state.month}월 ${state.day}일 · 소유권은 구매 시 실제로 이전됩니다.</div></div><span class="badge">오늘 ${daily.length}마리</span></div><div class="grid">${dailyHtml||'<div class="muted">판매할 말이 없습니다.</div>'}</div></div>
 <div class="panel"><div class="panelTitle"><div><h2>금요일 특별 경매</h2><div class="small">상위 5위 목장만 출품 가능 · NPC 출품 5마리 + 상위권 플레이어 주 1마리</div></div><span class="badge">${isOpen?'오늘 경매 진행':upcoming+'일 후 개최'}</span></div><div class="notice">목장 순위 ${me?.rank||'-'}위 / ${rank.length}곳 · ${me?.qualified?'특별 경매 출품 자격 보유':'상위 5위 진입 시 출품 가능'} · 재산 규모가 아니라 경주마 능력과 최근 경주 성적을 기준으로 합니다.</div><div class="small" style="margin:8px 0">최근 360일 경주 실적 우선: G1 우승 24점 · G2 15점 · G3 10점 · 특별 6점 · 일반 4점 (1착 기준, 오래된 기록은 감쇠). 경주 당시 목장에 성적이 귀속되며 말 판매 후에도 유지됩니다. 현재 실력은 현역 상위 3마리 평균.</div><table class="table"><tr><th>순위</th><th>목장</th><th>종합</th><th>전력</th><th>경주 실적</th><th>G1승</th><th>현역</th></tr>${rankings}</table>${list?`<div class="grid" style="margin-top:12px">${lotsHtml||'<div class="muted">출품이 없습니다.</div>'}</div>${me?.qualified?`<div class="panel" style="margin-top:10px"><h3>이번 주 내 경주마 출품 (최대 1마리)</h3>${list.consignment?'출품 완료 · 낙찰되지 않으면 소유권 유지':consignment||'<div class="small">출품 가능한 말이 없습니다.</div>'}</div>`:''}`:'<div class="notice">특별 경매 입찰과 출품은 게임 내 금요일에 진행합니다. 토요일로 넘어갈 때 자동 정산됩니다.</div>'}${lastResults?`<div class="panel" style="margin-top:10px"><h3>지난 경매 결과</h3>${lastResults}</div>`:''}</div>
 <div class="panel"><h3>우리 말 일반 판매</h3>${state.horses.filter(h=>!h.retired).map(h=>`<div class="row" style="justify-content:space-between;padding:7px 0;border-bottom:1px dashed #3a3e44"><span>${escapeHtml(h.name)} · ${genderLabel(h)} · ${h.starts||0}전 ${h.wins||0}승</span><button class="action red" onclick="sellHorse(${Number(h.id)})">판매</button></div>`).join('')||'<div class="muted">판매 가능한 말이 없습니다.</div>'}</div>`;
};
const beforeAdvance=advanceDay;
advanceDay=function(...args){
 const previous=A.dayOf(state),out=beforeAdvance.apply(this,args),now=A.dayOf(state);
 if(!state.startDone||now===previous)return out;
 if(A.isFriday(now))A.openAuction(state,now,marketPrice);
 const r=A.closeAuction(state,now,{archive:(h,year)=>HorseRanchLifeCycle.archive(state,h,'특별 경매 판매',year)});
 if(r.applied){log(`특별 경매 정산 · 낙찰 ${r.sold}마 · 내 낙찰 ${r.won}마 · 내 판매 수익 ${money(r.earned)}`);save();if(!args[0]&&!HR_BATCH_DAY)render();}
 return out;
};
save();render();
})();
