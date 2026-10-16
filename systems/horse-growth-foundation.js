/* HORSE RANCH 20.3: birth baseline, inherited limits and growth disposition.
 * DATA FOUNDATION ONLY: does not modify races, training gains or breeding odds.
 * Existing saves preserve their actual stats; missing history is not invented.
 */
(function(root){
  'use strict';
  const KEYS=['speed','stamina','power'];
  const TEMPERAMENTS=['침착','예민','활동적','신중'];
  const VERSION=1;
  function stableHash(text){
    let value=2166136261;
    for(let i=0;i<text.length;i++){
      value^=text.charCodeAt(i);
      value=Math.imul(value,16777619);
    }
    return value>>>0;
  }
  function snapshot(h){
    const out={};
    KEYS.forEach(key=>{out[key]=Number.isFinite(Number(h[key]))?Number(h[key]):null;});
    return out;
  }
  function createProfile(h){
    if(!h||typeof h!=='object')throw Error('말 데이터가 필요합니다.');
    const seed=String(h.id)+'|'+String(h.name||'');
    const efficiency=Number((0.85+(stableHash(seed+'|training')%31)/100).toFixed(2));
    return {
      schemaVersion:VERSION,
      baselineSource:Number(h.age)===0?'birth':'generated',
      baseStats:snapshot(h),
      growthEfficiency:efficiency,
      innateTemperament:TEMPERAMENTS[stableHash(seed+'|temperament')%TEMPERAMENTS.length]
    };
  }
  function ensureProfile(h){
    if(!h||typeof h!=='object')return h;
    if(!h.growthFoundation||typeof h.growthFoundation!=='object'){
      h.growthFoundation={
        schemaVersion:VERSION,
        baselineSource:'legacy-snapshot',
        baseStats:snapshot(h),
        growthEfficiency:null,
        innateTemperament:h.profileTraits?.temperament??null
      };
    }
    const f=h.growthFoundation;
    if(!f.baseStats||typeof f.baseStats!=='object')f.baseStats=snapshot(h);
    KEYS.forEach(k=>{
      if(!(k in f.baseStats))f.baseStats[k]=Number.isFinite(Number(h[k]))?Number(h[k]):null;
    });
    if(!('baselineSource' in f))f.baselineSource='legacy-snapshot';
    if(!('growthEfficiency' in f))f.growthEfficiency=null;
    if(!('innateTemperament' in f))f.innateTemperament=null;
    f.schemaVersion=VERSION;
    return h;
  }
  root.HorseRanchGrowthFoundation=Object.freeze({version:VERSION,createProfile,ensureProfile});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.HorseRanchGrowthFoundation;
})(typeof globalThis!=='undefined'?globalThis:this);
