/* HORSE RANCH race system v1.
 * Pure computational system. It never mutates input horse objects, financial
 * state, the DOM, or saved games. Works without images/3D.
 */
(function(root) {
  'use strict';
  const VERSION = 'time-step-1';
  const TACTICS = ['도주','선행','선입','추입'];
  const BANDS = ['단거리','마일','중거리','장거리','초장거리'];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const numeric = (v,defaultValue) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : defaultValue;
  const round = (n,p=2) => Number(n.toFixed(p));
  function distanceBand(m) {return m<=1400?0:m===1600?1:m<=2400?2:m<=3200?3:4;}
  function hashText(text) {
    let h=2166136261;
    for(let i=0;i<text.length;i++) {h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function randomStream(seed) {
    let state=seed || 0x9e3779b9;
    return function(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  }
  function tacticalOffset(tactic,fraction) {
    const t=TACTICS.includes(tactic)?tactic:'선입';
    if(fraction<.20) return ({'도주':.44,'선행':.23,'선입':-.08,'추입':-.30})[t];
    if(fraction<.72) return ({'도주':.12,'선행':.07,'선입':.025,'추입':-.04})[t];
    return ({'도주':-.13,'선행':.05,'선입':.26,'추입':.43})[t];
  }
  function simulate(params) {
    if(!params || !params.race || !Array.isArray(params.entrants)) throw Error('경주와 출전마 데이터가 필요합니다.');
    const race=params.race;
    const distance=numeric(race.dist,0);
    if(distance<800 || distance>4000) throw Error('지원하지 않는 경주 거리입니다.');
    const entrants=params.entrants;
    if(entrants.length<2 || entrants.length>20) throw Error('출전마는 2~20마리여야 합니다.');
    const ids=entrants.map(e=>String(e.horse?.id));
    if(new Set(ids).size!==ids.length || ids.some(x=>x==='undefined')) throw Error('출전마 ID 중복 또는 누락');
    const seed = params.seed == null
      ? hashText(`${race.id||''}|${distance}|${race.surface||''}|${ids.join(',')}`)
      : (Number(params.seed)>>>0);
    const random=randomStream(seed);
    const raceBand=distanceBand(distance);
    const runners=entrants.map((entry,i)=>{
      const h=entry.horse, j=entry.jockey||null;
      const speed=numeric(h.speed,70), stamina=numeric(h.stamina,70), power=numeric(h.power,70);
      const cond=numeric(h.condition,82), fatigue=numeric(h.fatigue,0), hoof=numeric(h.hoof,100);
      // Education and rider affinity affect behavior/response events, never
      // base speed, stamina, power or direct acceleration bonuses.
      const response=entry.response||{type:'none',delay:0,paceWaste:0};
      const preferredBand=BANDS.indexOf(h.distanceBand);
      const gap=preferredBand===-1?0:Math.abs(preferredBand-raceBand);
      const mismatchedSurface=!!(h.surface && race.surface && h.surface!==race.surface);
      const goodStyle=!!(j && Array.isArray(j.style) && j.style.includes(h.style));
      const goodBand=!!(j && Array.isArray(j.bands) && j.bands.includes(BANDS[raceBand]));
      const jockeyPace=numeric(j?.pace,77), jockeyCorner=numeric(j?.corner,77), jockeyFinish=numeric(j?.finish,77);
      const base=16.2+(speed-70)*.042+(stamina-70)*.008+(cond-80)*.008-
        fatigue*.011-(100-hoof)*.005-gap*.29-(mismatchedSurface?.24:0)+
        (goodStyle?.075:0)+(goodBand?.04:0)+(j?(jockeyPace-77)*.0025:0);
      return {
        id:String(h.id),name:String(h.name||`출전마 ${i+1}`),horse:h,index:i,
        speedStat:speed, stamina, power,tactic:h.style,
        pos:0,velocity:0,energy:1,finish:null,base,
        acceleration:1.05+(power-70)*.012+(j?(numeric(j.skill,77)-77)*.003:0),
        responseType:response.type||'none',startDelay:clamp(numeric(response.delay,0),0,3),
        responseWaste:clamp(numeric(response.paceWaste,0),0,.15),
        energyUsage:clamp(.76+(70-stamina)*.012,.50,1.15),
        cornerHandling:jockeyCorner,
        finishing:jockeyFinish,
        variation:(random()-.5)*.24,
        stridePhase:random()*Math.PI*2,
        lane:i%10,laneChanges:0,lastLaneChangeAt:-100,blockedSteps:0
      };
    });
    const interval=.5;
    const sampleEvery=5;
    let step=0,time=0;
    const frames=[];
    function snapshot(t){frames.push({t:round(t,2),p:runners.map(x=>round(x.pos,1)),v:runners.map(x=>round(x.velocity,2)),l:runners.map(x=>x.lane)});}
    snapshot(0);
    while(runners.some(x=>x.finish===null) && step<1500) {
      const alive=runners.filter(x=>x.finish===null);
      const prior=alive.map(x=>x.pos);
      // One immutable snapshot per step avoids field-order bias in traffic.
      const pack=alive.map(x=>({id:x.id,pos:x.pos,velocity:x.velocity,lane:x.lane}));
      // Each horse's current physical position determines its current race phase.
      alive.forEach((x,index)=>{
        if(time<x.startDelay){x.velocity=0;return;}
        const fraction=clamp(x.pos/distance,0,1);
        const tactic=tacticalOffset(x.tactic,fraction);
        const corner=fraction>=.20&&fraction<=.27 || fraction>=.62&&fraction<=.73;
        const cornerPenalty=corner?clamp(.21-(x.cornerHandling-77)*.003, .08,.32):0;
        const noise=(Math.sin(time*.55+x.stridePhase)+Math.sin(time*.19+x.stridePhase*2))*.027;
        const energyPenalty=x.energy<.26?( .26-x.energy )*2.4:0;
        const finishAbility=fraction>.76?(x.finishing-77)*.003:0;
        // Passing requires a clear adjacent lane. A trapped runner loses a
        // little momentum; good horses can still recover once space opens.
        let trafficPenalty=0;
        if(time>3&&x.pos<distance-15){
          const ahead=pack.filter(y=>y.id!==x.id&&y.lane===x.lane&&
            y.pos>x.pos+.05&&y.pos-x.pos<8&&y.velocity<x.velocity+.25)
            .sort((a,b)=>a.pos-b.pos)[0];
          if(ahead){
            const choices=[x.lane-1,x.lane+1].filter(l=>l>=0&&l<=9);
            const free=choices.find(l=>pack.every(y=>y.id===x.id||y.lane!==l||Math.abs(y.pos-x.pos)>=5));
            if(free!==undefined&&time-x.lastLaneChangeAt>=8){x.lane=free;x.lastLaneChangeAt=time;x.laneChanges++;}
            else {trafficPenalty=clamp(.06+Math.max(0,x.velocity-ahead.velocity)*.13,.06,.26);x.blockedSteps++;}
          }
        }
        const goal=clamp(x.base+tactic+x.variation+noise-cornerPenalty-energyPenalty+finishAbility-trafficPenalty,11.5,19.8);
        const accel=clamp(x.acceleration,.58,1.6)*interval;
        x.velocity=clamp(x.velocity+clamp(goal-x.velocity,-.23*interval,accel),0,20);
        x.pos=Math.min(distance,x.pos+x.velocity*interval);
        const pressure=1+Math.max(0,tactic)*.13;
        const totalExpectedTime=distance/16.2;
        x.energy=clamp(x.energy - interval/totalExpectedTime*x.energyUsage*pressure -
          (x.responseWaste&&time<Math.max(3,x.startDelay+3)?x.responseWaste*interval/3:0),0,1);
        if(x.pos>=distance) {
          const travelled=distance-prior[index];
          x.finish=round(time+interval*(travelled/Math.max(x.velocity*interval,.00001)),4);
        }
      });
      step++;
      time=round(step*interval,3);
      if(step%sampleEvery===0 || runners.every(x=>x.finish!==null)) snapshot(time);
    }
    if(runners.some(x=>x.finish===null)) throw Error('경주 시뮬레이션이 종료되지 않았습니다.');
    const result=runners.slice().sort((a,b)=>a.finish-b.finish || a.index-b.index);
    const results=result.map((r,i)=>({horseId:r.id,horseName:r.name,place:i+1,time:round(r.finish,2),lane:r.lane}));
    return {
      version:VERSION,seed,distance,surface:race.surface||null,
      stepSeconds:interval,frameSeconds:interval*sampleEvery,
      ids:runners.map(x=>x.id),names:runners.map(x=>x.name),
      frames,results,finishSeconds:round(Math.max(...runners.map(x=>x.finish)),2),
      behaviorEvents:runners.filter(x=>x.responseType!=='none').map(x=>({horseId:x.id,type:x.responseType,startDelay:x.startDelay,paceWaste:x.responseWaste})),
      raceDynamics:runners.map(x=>({horseId:x.id,laneChanges:x.laneChanges,blockedSeconds:round(x.blockedSteps*interval,1)})),
      explanation:'시간 단계별 위치·속도·지구력 기반 계산. 경기 그래픽/물리 인증과는 별도.'
    };
  }
  root.HorseRanchRaceEngine=Object.freeze({version:VERSION,simulate});
  if(typeof module!=='undefined' && module.exports)module.exports=root.HorseRanchRaceEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
