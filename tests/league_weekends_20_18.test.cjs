/* node --test tests/league_weekends_20_18.test.cjs
 * Deterministic agreed weekly calendar; no assumptions about future grade quotas.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const league=require('../systems/league-schedule.js');
test('weekend races, venue rotation and grade hierarchy survive 12 annual generations',()=>{
  const visited=new Set();
  for(let year=1;year<=12;year++){
    const races=league.generate(year);
    assert.deepEqual(races,league.generate(year),'deterministic replay '+year);
    const dates=new Map();
    for(const r of races){
      assert.equal(r.year,year);
      assert.equal(league.isRaceDay(r.year,r.month,r.day),true);
      assert.ok(r.no>=1&&r.no<=3);
      assert.equal(r.leagueScheduleVersion,league.VERSION);
      assert.ok(league.VENUES.includes(r.venue));
      assert.equal(typeof r.prize,'number');
      const key=r.month+'-'+r.day;
      if(!dates.has(key))dates.set(key,[]);
      dates.get(key).push(r);
      visited.add(r.meeting);
    }
    assert.ok(dates.size>=100&&dates.size<=104);
    assert.equal(races.length,dates.size*3);
    assert.equal(new Set(races.map(x=>x.id)).size,races.length);
    for(const group of dates.values()){
      assert.deepEqual(group.map(x=>x.no),[1,2,3]);
      assert.ok(new Set(group.map(x=>x.venue)).size<=2);
      if(new Set(group.map(x=>x.venue)).size===2)
        assert.ok(['G1','G2'].includes(group[2].grade));
    }
    const n=g=>races.filter(r=>r.grade===g).length;
    assert.equal(n('G1'),4,'four legacy G1 anchors until season names are agreed');
    assert.ok(n('G3')>n('G2')&&n('G2')>n('G1'));
  }
  assert.equal(visited.size,5);
});
