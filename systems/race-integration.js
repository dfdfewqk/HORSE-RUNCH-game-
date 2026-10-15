/* HORSE RANCH 20.1 compatible race adapter.
 * Preserves the old save key and all economic, record, registration and
 * onboarding flows. Only race calculation and replay change for NEW races.
 */
(function(){
  'use strict';
  const engine=window.HorseRanchRaceEngine;
  if(!engine) {console.error('HORSE RANCH: race engine unavailable; original race code retained.');return;}
  const oldSimulator=simulateRace;
  const oldRunRace=runRace;
  const oldShowRace=showRace;
  const oldResult=openRaceResult;
  const oldClose=closeModal;
  let playback=null;
  function cleanup(){if(playback?.timer)clearInterval(playback.timer);playback=null;}
  closeModal=function(){cleanup();return oldClose();};
  simulateRace=function(field,r,jid){
    try {
      const ownedId=Number(state.selectedHorse);
      const entrants=field.map(h=>{
        const own=Number(h.id)===ownedId;
        const j=own?getJockey(jid):null;
        const relation=own && j && typeof horseJockeyRelation==='function'
          ?horseJockeyRelation(h.id,j.id,false):null;
        return {horse:h,jockey:j,friendship:relation?.friendship??null};
      });
      const sim=engine.simulate({race:r,entrants});
      r.simulation=sim;
      const byId=new Map(field.map(h=>[String(h.id),h]));
      return sim.results.map(x=>({h:byId.get(String(x.horseId)),s:-x.time}));
    } catch(err) {
      // Legacy calculation is a safe fallback. Mark that no physical trace exists.
      delete r.simulation;
      console.error('HORSE RANCH race simulation fallback:',err);
      return oldSimulator(field,r,jid);
    }
  };
  runRace=function(rid,jid,show=true){
    const r=state.races.find(x=>x.id===rid);
    const before=state.results.length;
    const out=oldRunRace(rid,jid,false);
    if(!r || state.results.length===before)return out;
    if(r.simulation && r.simulation.version===engine.version){
      // Old 20.1 bookkeeping remains the only writer of prize, money, jockey
      // relationship and win counters; times now reflect actual crossing.
      const times=new Map(r.simulation.results.map(x=>[String(x.horseId),x.time]));
      for(const row of (r.result||[])){
        const actual=times.get(String(row.horseId));
        if(actual!==undefined)row.time=actual.toFixed(2);
      }
      const mine=state.results[state.results.length-1];
      const actual=times.get(String(mine.horseId));
      if(actual!==undefined){
        mine.time=actual.toFixed(2);
        mine.raceEngineVersion=engine.version;
      }
      save();
    }
    if(show){
      const saved=state.results[state.results.length-1];
      const map=new Map(allHorseObjects().map(h=>[String(h.id),h]));
      const scored=(r.result||[]).map((x,i)=>({h:map.get(String(x.horseId)),s:100-i})).filter(x=>x.h);
      showRace(r,scored,horse(saved.horseId),saved.place,saved.payout,getJockey(jid));
    }
    return out;
  };
  const css=document.createElement('style');
  css.textContent=`.hrs-track{background:#101b19;border:1px solid #536a57;border-radius:8px;padding:10px;max-height:55vh;overflow-y:auto}.hrs-row{display:grid;grid-template-columns:24px minmax(88px,150px) 1fr 62px;gap:6px;align-items:center;border-bottom:1px solid #394339;padding:6px 0;font-size:12px}.hrs-row.me{background:#51421b70;border-radius:5px}.hrs-line{position:relative;height:16px;background:repeating-linear-gradient(90deg,#224332 0%,#31543b 10%,#224332 20%);border-radius:8px;border-right:3px solid #fff;overflow:hidden}.hrs-progress{height:100%;background:linear-gradient(90deg,#458c64,#e3c16b);transition:width .12s linear}.hrs-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px}.hrs-controls input[type=range]{flex:1;min-width:180px}.hrs-controls button{font-size:12px}.hrs-meta{font-size:12px;color:#d3d8d7;padding:7px 0}`;
  document.head.appendChild(css);
  function showPhysicalRace(r,player,place,payout,j){
    cleanup();
    const sim=r.simulation;
    const title=`${escapeHtml(r.grade)} · ${r.dist}m · 제1경마장`;
    $('modalRoot').innerHTML=`<div class="modal"><div class="modalBox"><div class="raceHeader"><div><h2 style="margin:0">${title}</h2><div class="small">${escapeHtml(r.surface||'')} · ${escapeHtml(r.weather||'')} · 시뮬레이션 ${escapeHtml(sim.version)}</div></div><button class="action gray" onclick="closeModal();render()">닫기</button></div><div class="notice">경주 결과는 실제 시간 단계별 이동 거리와 결승선 통과 시각에서 계산합니다. 현재 화면은 향후 3D 모델과 독립적인 임시 진행도입니다.</div><div class="between"><b id="hrs-phase">출발 준비</b><span id="hrs-clock">0.0초 / ${sim.finishSeconds}초</span></div><div class="hrs-track" id="hrs-track"></div><div class="hrs-controls"><button class="action" onclick="hrRaceReplayPause()" id="hrs-playbtn">일시정지</button><label class="small">속도 <select id="hrs-speed" onchange="hrRaceReplaySetSpeed(Number(this.value))" style="background:#1c2228;color:#fff"><option value="1">1배</option><option value="4" selected>4배</option><option value="12">12배</option></select></label><input aria-label="경주 시간 이동" type="range" id="hrs-seek" min="0" max="${sim.frames.length-1}" value="0" oninput="hrRaceReplayJump(Number(this.value))"><button class="action gold" onclick="hrRaceReplayJump(${sim.frames.length-1})">결승 확인</button></div><div class="leaderboard" id="hrs-summary" style="margin-top:10px">각 말이 출발 위치에서 대기하고 있습니다.</div></div></div>`;
    playback={sim,index:0,playing:true,speed:4,playerId:String(player?.id||''),timer:null,elapsed:0};
    drawFrame();
    playback.timer=setInterval(()=>{
      const q=playback;if(!q||!q.playing)return;
      q.elapsed+=.16*q.speed;
      while(q.index+1<q.sim.frames.length&&q.sim.frames[q.index+1].t<=q.elapsed)q.index++;
      if(q.elapsed>=q.sim.finishSeconds){q.index=q.sim.frames.length-1;q.playing=false;}
      drawFrame();
    },160);
  }
  function drawFrame(){
    const q=playback;if(!q)return;
    const f=q.sim.frames[q.index],dist=q.sim.distance;
    const rows=q.sim.ids.map((id,i)=>({id,name:q.sim.names[i],pos:f.p[i],speed:f.v[i]}))
      .sort((a,b)=>b.pos-a.pos || a.id.localeCompare(b.id));
    const track=$('hrs-track');if(!track){cleanup();return;}
    track.innerHTML=rows.map((x,i)=>`<div class="hrs-row ${x.id===q.playerId?'me':''}"><b>${i+1}</b><span>${escapeHtml(x.name)} ${x.id===q.playerId?'★':''}</span><div class="hrs-line"><div class="hrs-progress" style="width:${Math.min(100,x.pos/dist*100).toFixed(2)}%"></div></div><span>${Math.round(x.pos)}m</span></div>`).join('');
    $('hrs-clock').textContent=`${f.t.toFixed(1)}초 / ${q.sim.finishSeconds.toFixed(1)}초`;
    const frac=Math.max(...f.p)/dist;
    $('hrs-phase').textContent=frac<.1?'출발':frac<.3?'초반':frac<.65?'중반':frac<.8?'코너 통과':frac<1?'마지막 직선':'결승';
    $('hrs-seek').value=String(q.index);
    $('hrs-playbtn').textContent=q.playing?'일시정지':'재생';
    const finish=q.index===q.sim.frames.length-1;
    $('hrs-summary').innerHTML=finish
      ? `<b>공식 결과 · 실제 결승 통과 순서</b>${q.sim.results.map(x=>`<div class="leaderboardRow"><span>${x.place}착 · ${escapeHtml(x.horseName)}</span><b>${x.time.toFixed(2)}초 ${String(x.horseId)===q.playerId?'★':''}</b></div>`).join('')}`
      : `<div class="leaderboardRow"><span>현재 선두</span><b>${escapeHtml(rows[0]?.name||'-')}</b></div><div class="small">순위는 매 시점의 실제 주행 거리로 갱신됩니다.</div>`;
    if(finish)q.elapsed=Math.max(q.elapsed,q.sim.finishSeconds);
  }
  window.hrRaceReplayPause=function(){if(!playback)return;playback.playing=!playback.playing;if(playback.playing&&playback.index===playback.sim.frames.length-1){playback.index=0;playback.elapsed=0;}drawFrame();};
  window.hrRaceReplaySetSpeed=function(value){if(playback)playback.speed=[1,4,12].includes(value)?value:4;};
  window.hrRaceReplayJump=function(index){if(!playback)return;playback.index=Math.max(0,Math.min(playback.sim.frames.length-1,Math.floor(index)));playback.elapsed=playback.sim.frames[playback.index].t;playback.playing=false;drawFrame();};
  window.hrRaceReplayOpen=function(rid){const r=state.races.find(x=>x.id===rid);if(!r?.simulation)return;const saved=state.results.find(x=>x.raceId===rid);const h=saved?horse(saved.horseId):null;const j=saved?JOCKEYS.find(x=>x.name===saved.jockey):null;showPhysicalRace(r,h,saved?.place||0,saved?.payout||0,j);};
  showRace=function(r,scored,h,place,payout,j){
    if(!r?.simulation || r.simulation.version!==engine.version)return oldShowRace(r,scored,h,place,payout,j);
    return showPhysicalRace(r,h,place,payout,j);
  };
  openRaceResult=function(rid){
    oldResult(rid);
    const r=state.races.find(x=>x.id===rid);
    const modal=$('modalRoot').querySelector('.modalBox');
    if(r?.simulation && modal){
      const btn=document.createElement('button');
      btn.className='action gold';btn.style.marginTop='10px';btn.textContent='실제 경주 과정 다시 보기';
      btn.onclick=()=>window.hrRaceReplayOpen(rid);modal.appendChild(btn);
    }
  };
})();
