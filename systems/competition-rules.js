/* HORSE RANCH 20.5 — independent rating and entry rules.
 * No DOM, saved game, random data or money mutations.
 */
(function(root){
 'use strict';
 const LIMITS=Object.freeze({G1:82,G2:74,G3:65});
 const BANDS=Object.freeze(['단거리','마일','중거리','장거리','초장거리']);
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function initialRating(h){
   const speed=Number(h.speed)||60,stamina=Number(h.stamina)||60,power=Number(h.power)||60;
   const talent=speed*.45+stamina*.3+power*.25;
   const wins=Math.max(0,Number(h.wins)||0);
   return clamp(Math.round(59+(talent-70)*1.4+Math.min(11,wins*1.25)),30,110);
 }
 function rating(h){
   return h&&h.rating!==null&&h.rating!==undefined&&Number.isFinite(Number(h.rating))
     ?clamp(Math.round(Number(h.rating)),30,110):initialRating(h||{});
 }
 function entryCheck(h,r){
   if(!h||!r)return {ok:false,reason:'경주 또는 출전마 정보가 없습니다.'};
   const need=LIMITS[r.grade];
   if(need!==undefined && rating(h)<need)return {ok:false,reason:`${r.grade} 출전 레이팅 ${need} 이상 필요 (현재 ${rating(h)})`};
   return {ok:true,reason:''};
 }
 function ratingDelta(grade,position,size){
   if(!Number.isInteger(position)||position<1||!Number.isInteger(size)||size<2)return 0;
   const delta=position===1?5:position===2?3:position===3?2:position<=5?1:position>=Math.ceil(size*.75)?-2:-1;
   const bonus=(grade==='G1'?2:grade==='G2'?1:0);
   return delta>0?delta+(position<=3?bonus:0):delta;
 }
 function newRating(old,grade,position,size){return clamp(rating({rating:old})+ratingDelta(grade,position,size),30,110);}
 function distanceBand(m){m=Number(m);return m<=1400?'단거리':m===1600?'마일':m<=2400?'중거리':m<=3200?'장거리':'초장거리';}
 function hash(s){let k=2166136261;for(const c of String(s)){k^=c.charCodeAt(0);k=Math.imul(k,16777619);}return(k>>>0)/4294967295;}
 function entrantScore(h,r,target){
   const distBonus=h.distanceBand===distanceBand(r.dist)?3:0;
   const surfaceBonus=h.surface===r.surface?1.5:0;
   return -Math.abs(rating(h)-target)*1.4+distBonus+surfaceBonus+hash(String(r.id)+'|'+String(h.id))*4;
 }
 function targetRating(grade,selected){return grade==='G1'?89:grade==='G2'?79:grade==='G3'?71:grade==='특별'?67:clamp(rating(selected||{}),45,82);}
 function g2Schedule(races){
   for(const month of [3,6,9,12]){
     const match=races.find(r=>Number(r.month)===month&&Number(r.day)===24&&Number(r.no)===2&&r.state!=='finished');
     if(match){Object.assign(match,{grade:'G2',dist:month===6||month===12?2200:1800,band:'중거리',surface:'잔디',prize:35000000});}
   }
   return races;
 }
 const api=Object.freeze({version:'rating-foundation-1',LIMITS,initialRating,rating,entryCheck,ratingDelta,newRating,entrantScore,targetRating,g2Schedule});
 root.HorseRanchCompetitionRules=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
