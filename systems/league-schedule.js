/* HORSE RANCH — agreed weekly weekend racing league.
 * Calendar only: no day-progression, UI, animal life cycle or economy ownership changes.
 * Per-day race volume and named G1 series remain deliberately unexpanded until approved.
 */
(function(root){
'use strict';
const VERSION=1;
const VENUES=Object.freeze(['서림','해온','백운','북령','남풍']);
const PRIZES=Object.freeze({신마:2500000,미승리:2500000,일반:4500000,특별:8000000,G3:16000000,G2:35000000,G1:70000000});
const yearDay=(year,month,day)=>(Number(year)-1)*360+(Number(month)-1)*30+Number(day)-1;
const weekday=(year,month,day)=>((yearDay(year,month,day)%7)+7)%7; // Mon=0, Sat=5, Sun=6
const isRaceDay=(year,month,day)=>weekday(year,month,day)>=5;
function sundayOfMonth(year,month,which){
  const dates=[];
  for(let d=1;d<=30;d++)if(weekday(year,month,d)===6)dates.push(d);
  return which==='last'?dates[dates.length-1]:dates[which-1];
}
function meetingGrade(year,month,day,no){
  const wd=weekday(year,month,day),week=Math.floor(yearDay(year,month,day)/7);
  if(wd<5)return null;
  if(no===1)return wd===5?(week%2===0?'신마':'미승리'):(week%2===0?'미승리':'신마');
  if(no===2)return week%3===0?'특별':'일반';
  if(no!==3)return null;
  if(wd===6&&[3,6,9,12].includes(month)&&day===sundayOfMonth(year,month,'last'))return 'G1';
  if(wd===6&&day===sundayOfMonth(year,month,2))return 'G2';
  if(wd===6||week%2===0)return 'G3';
  return '특별';
}
function generate(year){
  const races=[],y=Number(year);
  if(!Number.isInteger(y)||y<1)throw Error('Invalid racing year');
  for(let month=1;month<=12;month++)for(let day=1;day<=30;day++){
    if(!isRaceDay(y,month,day))continue;
    const wd=weekday(y,month,day),week=Math.floor(yearDay(y,month,day)/7);
    const primary=VENUES[week%VENUES.length],secondary=VENUES[(week+2)%VENUES.length];
    const feature=meetingGrade(y,month,day,3);
    const major=feature==='G1'||feature==='G2';
    for(let no=1;no<=3;no++){
      const grade=meetingGrade(y,month,day,no);
      const options=no===1?[1200,1400,1600]:no===2?[1600,1800,2000]:[1600,2000,2400,3000];
      let dist=options[(week+no)%options.length];
      if(grade==='G1')dist=({3:1600,6:2000,9:2400,12:3000})[month];
      if(grade==='G2')dist=month%2===0?2200:1800;
      const venue=(major&&no===2)?secondary:primary;
      const surface=(grade==='G1'&&month===6)||venue==='남풍'?'더트':'잔디';
      races.push({
        id:y+'-'+month+'-'+day+'-'+no,year:y,month,day,no,grade,
        dist,band:dist<=1400?'단거리':dist===1600?'마일':dist<=2400?'중거리':dist<=3200?'장거리':'초장거리',
        surface,weather:'맑음',state:'open',prize:PRIZES[grade],
        venue,meeting:primary,meetingRole:major?(venue===primary?'주경마장':'보조경마장'):'주경마장',
        leagueScheduleVersion:VERSION
      });
    }
  }
  return races;
}
const api=Object.freeze({VERSION,VENUES,PRIZES,yearDay,weekday,isRaceDay,sundayOfMonth,meetingGrade,generate});
root.HorseRanchLeagueSchedule=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
