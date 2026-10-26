/* HORSE RANCH 20.5 competition foundation: named ranch roster, grades, ratings.
 * Load AFTER race-engine.js and race-integration.js.
 * Does NOT overwrite a horse's existing rating, stats, career or ownership.
 */
(function(){
 'use strict';
 const R=window.HorseRanchCompetitionRules;
 if(!R){console.error('20.5 competition rules missing');return;}
 const NAMED=[
  {name:'그랜드 스터드',count:65,elite:0.25,funds:520000000,theme:'혈통 중심'},
  {name:'블루힐 팜',count:40,elite:0.12,funds:220000000,theme:'유망마 육성'},
  {name:'윈드필드 목장',count:55,elite:0.22,funds:370000000,theme:'경기력 분석'},
  {name:'노스밸리 목장',count:45,elite:0.13,funds:260000000,theme:'혈통 조합'},
  {name:'레드크라운 목장',count:3,elite:0,funds:200000000,theme:'부유한 신생 라이벌'}
 ];
 function setRating(h){if(!h)return;if(h.rating===null||h.rating===undefined||!Number.isFinite(Number(h.rating)))h.rating=R.initialRating(h);}
 function setAllRatings(){
   (state.horses||[]).forEach(setRating);
   (state.pool||[]).forEach(setRating);
   (state.npcs||[]).forEach(n=>(n.horses||[]).forEach(setRating));
 }
 function addNamedRanches(){
   const existing=new Set((state.npcs||[]).map(n=>n.name));
   for(const cfg of NAMED){
     if(existing.has(cfg.name))continue;
     const n={name:cfg.name,named:true,theme:cfg.theme,funds:cfg.funds,stalls:cfg.name==='레드크라운 목장'?8:Math.min(100,cfg.count+10),horses:[]};
     state.npcs.push(n);
     for(let i=0;i<cfg.count;i++){
       const elite=Math.random()<cfg.elite;
       const v=elite?rnd(81,91):cfg.count===3?rnd(60,75):rnd(64,84);
       const horseData=makeHorse(rnd(2,6),{
         speed:clamp(v+rnd(-4,4),40,96),stamina:clamp(v+rnd(-6,6),40,96),power:clamp(v+rnd(-5,5),40,96),
         gp:Math.min(96,v+rnd(2,7)),pedigree:elite?rnd(80,95):rnd(57,85),
         starts:elite?rnd(7,26):rnd(0,13),wins:elite?rnd(2,6):rnd(0,2)
       });
       // Initial horse generation is constrained by the existing cap model.
       horseData.caps.speed=Math.max(horseData.caps.speed,horseData.speed);
       horseData.caps.stamina=Math.max(horseData.caps.stamina,horseData.stamina);
       horseData.caps.power=Math.max(horseData.caps.power,horseData.power);
       ensureProfileData(horseData);
       setRating(horseData);
       n.horses.push(horseData);
     }
     existing.add(cfg.name);
   }
 }
 const originalGenerate=generateRaces;
 generateRaces=function(){
   const league=window.HorseRanchLeagueSchedule;
   if(!league){const out=originalGenerate();R.g2Schedule(state.races);return out;}
   state.races=league.generate(state.year);
   state.leagueScheduleVersion=league.VERSION;
   return state.races;
 };
 // On a fresh setup, the original seed ran before the external league script loaded.
 // Rebuild only unstarted calendars; keep every tutorial opening race and its result.
 if(!state.startDone&&Number(state.year)===1&&Number(state.month)===1&&Number(state.day)===1&&!state.leagueScheduleVersion){
   const opening=(state.races||[]).filter(r=>r.opening);
   generateRaces();
   state.races=[...opening,...state.races];
 }
 const originalEligible=eligible;
 eligible=function(h,r){return originalEligible(h,r)&&R.entryCheck(h,r).ok;};
 deterministicField=function(r){
   const selected=horse(state.selectedHorse),target=R.targetRating(r.grade,selected);
   const candidates=[];
   (state.npcs||[]).forEach(n=>(n.horses||[]).forEach(h=>{if(eligible(h,r))candidates.push(h);}));
   candidates.sort((a,b)=>R.entrantScore(b,r,target)-R.entrantScore(a,r,target)||Number(a.id)-Number(b.id));
   return candidates.slice(0,11); // caller includes the player's horse, max 12 total
 };
 const originalRunRace=runRace;
 runRace=function(rid,jid,show=true){
   const r=state.races.find(x=>x.id===rid);
   const done=!!(r?.state==='finished'||r?.ratingSettled);
   const output=originalRunRace(rid,jid,show);
   if(!r||done||r.state!=='finished'||!Array.isArray(r.result)||r.ratingSettled)return output;
   const byId=new Map(allHorseObjects().map(h=>[String(h.id),h]));
   const ownedIds=new Set(state.horses.map(h=>String(h.id)));
   const size=r.result.length;
   r.ratingChanges=[];
   for(const row of r.result){
     const h=byId.get(String(row.horseId));if(!h)continue;
     setRating(h);
     const before=R.rating(h),after=R.newRating(before,r.grade,Number(row.place),size);
     h.rating=after;
     r.ratingChanges.push({horseId:h.id,before,after,delta:after-before});
     if(!ownedIds.has(String(h.id))){
       // NPC career results were previously omitted; record each once.
       h.starts=Math.max(0,Number(h.starts)||0)+1;
       if(row.place===1)h.wins++;
       if(row.place===2)h.seconds++;
       if(row.place===3)h.thirds++;
       h.lastRaceIndex=today();
       h.history=Array.isArray(h.history)?h.history:[];
       h.history.unshift({year:r.year,month:r.month,day:r.day,grade:r.grade,dist:r.dist,place:row.place,npc:true});
       h.history=h.history.slice(0,40);
     }
   }
   r.ratingSettled=true;
   const mine=state.results.findLast?.(x=>x.raceId===rid);
   if(mine){const change=r.ratingChanges.find(x=>String(x.horseId)===String(mine.horseId));if(change){mine.ratingBefore=change.before;mine.ratingAfter=change.after;}}
   save();return output;
 };
 const originalProfileAbility=profileAbilityTab;
 profileAbilityTab=function(h){return originalProfileAbility(h)+`<div class="profileSection"><h3>경주 레이팅 · 20.5</h3><div class="stat"><span>현재 레이팅</span><b>${R.rating(h)}</b></div><div class="small">출전 기준: G3 ${R.LIMITS.G3} / G2 ${R.LIMITS.G2} / G1 ${R.LIMITS.G1}. 현재 등급과 실제 적성이 모두 경주에 영향을 줍니다.</div></div>`;};
 const originalRaceList=raceList;
 raceList=function(){return `<div class="notice"><b>출전 레이팅</b> · G3 ${R.LIMITS.G3} 이상 / G2 ${R.LIMITS.G2} 이상 / G1 ${R.LIMITS.G1} 이상. 일반 경주는 레이팅 제한 없음. 경주 결과에 따라 플레이어와 NPC 레이팅이 함께 변경됩니다.</div>`+originalRaceList();};
 // Existing saves keep all prior NPCs and player horses. Missing named farms
 // are added only once; the generic NPCs are kept as low-cost race entrants.
 if(!Array.isArray(state.npcs))state.npcs=[];
 addNamedRanches();
 setAllRatings();
 if(!state.worldCompetitionVersion){
   // Do not retroactively change a veteran save's planned races.
   if(!state.leagueScheduleVersion&&!state.startDone&&Number(state.year)===1)R.g2Schedule(state.races);
   state.worldCompetitionVersion=1;
 }
 save();render();
})();
