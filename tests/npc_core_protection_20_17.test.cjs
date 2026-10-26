'use strict';
const assert=require('node:assert/strict');
const E=require('../systems/ranch-economy.js');
const A=require('../systems/ranch-auction.js');
const R=require('../systems/ranch-ranking.js');

const horse=(id,gender='수',rating=75,genetic=75,pedigree=75)=>({
 id,name:'Horse'+id,age:4,gender,rating,speed:rating,stamina:rating,power:rating,
 genetic:{speed:genetic,stamina:genetic,power:genetic},pedigree,
 retired:false,starts:5,wins:0,history:[]
});
const ranch=(name,hs,funds=200000000,named=false)=>({name,named,funds,stalls:30,horses:hs});
const flagship=horse(1,'수',91,70,72);
flagship.wins=2;flagship.history=[
 {year:1,month:1,day:2,grade:'G1',place:1},
 {year:1,month:1,day:3,grade:'G1',place:1}
];
const sire=horse(2,'수',76,98,94);
const dam=horse(3,'암',75,97,95);
const ordinary=horse(4,'암',65,60,65);
const stable=ranch('Core',[flagship,sire,dam,ordinary],0);
const buyer=ranch('Buyer',[horse(10),horse(11),horse(12),horse(13)],200000000);
const world={year:1,month:1,day:5,ranchName:'Player',money:0,stalls:8,
 horses:[],npcs:[stable,buyer],races:[],registrations:[]};
const core=E.coreHorseIds(world,stable);
assert.deepEqual(core,{racer:'1',sire:'2',dam:'3'},'distinct racing/sire/dam roles');
assert.deepEqual([...E.protectedIds(world,stable)].sort(),['1','2','3']);
assert.ok([flagship,sire,dam].every(h=>E.isProtected(world,stable,h)));
assert.equal(E.isProtected(world,stable,ordinary),false);
assert.equal(E.coreHorseIds(world,stable).racer,'1','stable on repeated queries');
const daily=A.daily(world,5).filter(l=>l.owner==='Core');
assert.deepEqual(daily.map(l=>String(l.horseId)),['4'],'daily market excludes all core horses');
assert.equal(A.openAuction(world,5,()=>1000000).lots.filter(l=>l.seller==='Core').length,1,'weekly auction only offers disposable horse');
assert.equal(A.openAuction(world,5,()=>1000000).lots.find(l=>l.seller==='Core').horseId,4);
assert.equal(A.placeBid(world,4,()=>1000000).ok,false,'player cannot bid without cash');
assert.equal(A.closeAuction(world,6).applied,true);
assert.ok([flagship,sire,dam].every(h=>stable.horses.includes(h)),'core horses survive weekly auction');
const coreNow=E.coreHorseIds(world,stable);
assert.deepEqual(coreNow,{racer:'1',sire:'2',dam:'3'});

const flagship2=horse(101,'수',91,70,72);
flagship2.wins=2;
flagship2.history=[{year:1,month:1,day:2,grade:'G1',place:1},{year:1,month:1,day:3,grade:'G1',place:1}];
const sire2=horse(102,'수',76,98,94);
const dam2=horse(103,'암',75,97,95);
const prospect=horse(104,'암',65,60,65);
const auctionSeller=ranch('Auction',[flagship2,sire2,dam2,prospect],100000);
const auctionWorld={year:1,month:1,day:5,ranchName:'Player',money:5000000,stalls:8,horses:[],npcs:[auctionSeller]};
assert.equal(E.coreHorseIds(auctionWorld,auctionSeller).racer,'101');
const activeAuction=A.openAuction(auctionWorld,5,()=>1000000);
assert.ok(activeAuction.lots.some(l=>l.horseId===104),'previously expendable horse listed');
assert.equal(A.placeBid(auctionWorld,104,()=>1000000).ok,true);
prospect.rating=110;prospect.wins=3;prospect.history=[
 {year:1,month:1,day:2,grade:'G1',place:1},
 {year:1,month:1,day:3,grade:'G1',place:1},
 {year:1,month:1,day:4,grade:'G1',place:1}
];
assert.equal(E.coreHorseIds(auctionWorld,auctionSeller).racer,'104','new outstanding horse can replace flagship');
const closed=A.closeAuction(auctionWorld,6);
assert.equal(closed.sold,0,'core horse cannot sell despite pre-existing auction bid');
assert.equal(auctionSeller.horses.length,4);
assert.ok(auctionSeller.horses.includes(prospect));
assert.equal(auctionWorld.money,5000000,'blocked auction charges no player funds');
assert.equal(closed.results[0].status,'retained');

const fiscalStable=ranch('Struggling',[
 horse(201,'수',96,70),horse(202,'수',75,98),horse(203,'암',72,97),horse(204,'암',60,45)
],1000,false);
const fiscalBuyer=ranch('Well-funded',[
 horse(301),horse(302),horse(303),horse(304)
],200000000,false);
const fiscalWorld={year:1,month:1,day:30,money:0,horses:[],npcs:[fiscalStable,fiscalBuyer]};
const fiscalCore=E.coreHorseIds(fiscalWorld,fiscalStable);
const first=E.closeMonth(fiscalWorld,'1-1',0,
 {Struggling:4,'Well-funded':4},()=>5000000);
assert.equal(first.applied,true);
assert.equal(first.npcSales.length,1,'financial crisis sells non-core horse');
assert.equal(String(first.npcSales[0].horseId),'204');
assert.ok(Object.values(fiscalCore).every(id=>fiscalStable.horses.some(h=>String(h.id)===id)));
assert.equal(fiscalStable.horses.length,3,'core minimum kept');
assert.ok(fiscalBuyer.horses.some(h=>h.id===204),'actual buyer receives horse');
assert.equal(E.closeMonth(fiscalWorld,'1-1',0,{},()=>5000000).applied,false,'single charge each month');

const noNames=ranch('Ordinary-small',[
 horse(401,'수',84,60),horse(402,'수',75,95),horse(403,'암',72,95)
],0,false);
const noNameWorld={year:1,month:1,day:30,money:0,horses:[],npcs:[noNames]};
for(let month=1;month<=3;month++){
 assert.equal(E.closeMonth(noNameWorld,'1-'+month,0,{'Ordinary-small':3},()=>1000000).applied,true);
 assert.equal(noNames.horses.length,3);
 assert.ok(noNames.funds>=0);
}
assert.ok(noNames.funds>0,'ordinary NPC is kept alive by explicit minimal operating reserve');
assert.ok(E.ensure(noNameWorld).ranches['Ordinary-small'].totalSafetySupport>0);
assert.equal(E.ensure(noNameWorld).ranches['Ordinary-small'].crisisMonths,0);
assert.equal(E.coreHorseIds(noNameWorld,noNames).racer!=null,true);

const closeRaceWorld={year:1,month:1,day:1,npcs:[ranch('Role-test',[
 horse(501,'수',81),horse(502,'수',86)
])]};
const roleStable=closeRaceWorld.npcs[0];
assert.equal(E.coreHorseIds(closeRaceWorld,roleStable).racer,'502');
roleStable.horses[0].rating=90;
assert.equal(E.coreHorseIds(closeRaceWorld,roleStable).racer,'502','minor rating advantage does not constantly change flagship');
roleStable.horses[0].rating=95;
assert.equal(E.coreHorseIds(closeRaceWorld,roleStable).racer,'501','clear advantage triggers change');
roleStable.horses[0].retired=true;
assert.equal(E.coreHorseIds(closeRaceWorld,roleStable).racer,'502','retirement triggers replacement');

const bloodA=horse(601,'암',72,88,80),bloodB=horse(602,'암',72,91,80);
const bloodWorld={year:1,month:1,day:1,npcs:[ranch('Blood',[bloodA,bloodB])],horses:[]};
assert.equal(E.coreHorseIds(bloodWorld,bloodWorld.npcs[0]).dam,'602');
bloodA.genetic={speed:93,stamina:93,power:93};
assert.equal(E.coreHorseIds(bloodWorld,bloodWorld.npcs[0]).dam,'602','small genetic lead should not rotate broodmare');
bloodA.genetic={speed:100,stamina:100,power:100};
assert.equal(E.coreHorseIds(bloodWorld,bloodWorld.npcs[0]).dam,'601','substantial breeding advantage rotates broodmare');
bloodA.retired=true;
assert.equal(E.coreHorseIds(bloodWorld,bloodWorld.npcs[0]).dam,'602','retired and ineligible broodmare replaced');

const sireA=horse(701,'수',75,90,80),sireB=horse(702,'수',75,91,80);
const prodigy=horse(703,'암',98,90,90);prodigy.fatherId=701;prodigy.wins=4;
prodigy.history=[{year:1,month:1,day:1,grade:'G1',place:1}];
const pedigreeWorld={year:1,month:1,day:1,npcs:[ranch('Lineage',[sireA,sireB])],horses:[prodigy]};
assert.equal(E.coreHorseIds(pedigreeWorld,pedigreeWorld.npcs[0]).sire,'701','actual winning offspring factors into breeding protection');
const loaded=JSON.parse(JSON.stringify(pedigreeWorld));
assert.equal(E.coreHorseIds(loaded,loaded.npcs[0]).sire,'701','protected roles persist after save/load');
console.log('PASS NPC core-horse selection, market retention, crisis sale and recovery');
