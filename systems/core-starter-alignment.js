/* HORSE RANCH: new saves get a fixed OP-level starter and two free, random
 * lower-market-value mares after the opening race. Legacy saves are untouched.
 * Does not change breeding/lifecycle modules.
 */
(function(root){
'use strict';
const oldContinue=continueAfterOpeningRace;
function randomGiftMare(template,avoidBand){
 const bands=DIST_BANDS.slice(0,4);
 const choices=bands.filter(x=>x!==avoidBand);
 const distance=pick(choices.length?choices:bands);
 const stats={speed:rnd(53,70),stamina:rnd(53,70),power:rnd(53,70)};
 const genes={};
 const caps={};
 for(const k of ['speed','stamina','power']){
  genes[k]=clamp(stats[k]+rnd(-2,15)+(Math.random()<.05?7:0),50,91);
  caps[k]=clamp(Math.max(stats[k],genes[k])+rnd(0,5),stats[k],94);
 }
 const names={speed:'순발력',stamina:'지구력',power:'파워'};
 const strong=Object.keys(stats).sort((a,b)=>stats[b]-stats[a])[0];
 const weak=Object.keys(stats).sort((a,b)=>stats[a]-stats[b])[0];
 const count=rnd(0,12),wins=rnd(0,Math.min(2,count));
 const second=rnd(0,Math.min(2,count-wins));
 const h=makeHorse(rnd(4,5),{
  name:uniqueHorseName(pick(NAMES)),gender:'암',coat:pick(COATS),
  distanceBand:distance,style:pick(STYLES),surface:pick(['잔디','더트']),
  speed:stats.speed,stamina:stats.stamina,power:stats.power,
  genetic:genes,caps,pedigree:rnd(50,69),
  starts:count,wins,seconds:second,thirds:rnd(0,Math.min(2,count-wins-second)),
  condition:rnd(75,95),fatigue:rnd(0,10),hoof:rnd(88,100),
  initialPrice:rnd(18,34)*100000,
  parents:{sire:template.parents.sire,dam:template.parents.dam}
 });
 h.fatherId=template.fatherId;h.motherId=template.motherId;
 h.starterRole='gift-mare';h.openingGroup='random-gift';
 h.potentialGrade=Math.random()<.12?'상':pick(['하','중','중']);
 h.strength=names[strong]+'의 가능성';
 h.weakness=names[weak]+'이(가) 약점';
 ensureProfileData(h);
 h.profileTraits.personality=pick(HORSE_PERSONALITIES);
 h.profileTraits.temperament=pick(HORSE_TEMPERAMENTS);
 h.profileTraits.strengthText=h.strength;
 h.profileTraits.weaknessText=h.weakness;
 return h;
}
continueAfterOpeningRace=function(){
 if(state.hrAgreedCoreVersion!==1||state.startDone)return oldContinue.apply(this,arguments);
 if(!state.openingRaceCompleted||state.openingStage!=='race_result')return alert('첫 경주 결과를 먼저 확인하세요.');
 if(state.openingRandomMaresGiven)return;
 const candidates=state.pool.filter(h=>h.gender==='암'&&h.openingGroup!=='starter');
 if(candidates.length<2)return alert('초기 암말 데이터를 찾을 수 없습니다.');
 const shuffled=candidates.slice();
 for(let i=shuffled.length-1;i>0;i--){const j=rnd(0,i);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const gift1=randomGiftMare(shuffled[0],null),gift2=randomGiftMare(shuffled[1],gift1.distanceBand);
 // A free grant must never debit player funds.
 state.horses.push(gift1,gift2);
 const npcCandidates=state.pool.filter(h=>h.openingGroup==='mile'||h.openingGroup==='sprint');
 if(state.npcs.length)npcCandidates.forEach((h,i)=>state.npcs[i%state.npcs.length].horses.push(h));
 state.pool=state.pool.filter(h=>!npcCandidates.includes(h));
 state.openingRandomMaresGiven=true;
 state.startDone=true;state.openingStage='complete';state.startTutorialActive=true;
 state.tab='dashboard';state.selectedStart=[];
 log('무료 랜덤 암말 지급 · '+gift1.name+' ('+gift1.distanceBand+'), '+gift2.name+' ('+gift2.distanceBand+')');
 save();render();
};
const oldIntro=intro;
intro=function(){
 const markup=oldIntro();
 if(state.hrAgreedCoreVersion!==1||state.startDone)return markup;
 return markup.replace('암말 후보 5마리 보기','무료 랜덤 암말 2마리 받기')
  .replace('암말 5마리 중 2마리를 영입합니다.','저가 암말 두 마리를 무작위로 무료 지급받습니다.')
  .replace('암말 2마리 선택','암말 2마리 무료 지급');
};
})(typeof globalThis!=='undefined'?globalThis:this);
