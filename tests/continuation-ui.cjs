const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

test('finishing a drift banks a completion result; collision reports lost chain',()=>{
 const run=harness();
 const result=run(`(()=>{const c=new Car(presetTrack(1));c.comboPoints=1234.7;c.comboState=3;c.driftTime=7;c.score=4321;c.breakFlow(false);const complete={result:c.comboResult,points:c.comboResultPoints,score:c.score,mult:c.mult,time:c.comboBreak};c.breakFlow(false);const repeated=c.comboResult;c.comboPoints=500;c.comboState=2;c.breakFlow();return {complete,repeated,lost:c.comboResult,lostPoints:c.comboResultPoints}})()`);
 assert.equal(result.complete.result,1);assert.equal(result.complete.points,1234);assert.equal(result.complete.score,4321);
 assert.equal(result.complete.mult,1);assert.equal(result.complete.time,.8);assert.equal(result.repeated,1);
 assert.equal(result.lost,-1);assert.equal(result.lostPoints,500);
});

test('old career saves acquire independent Barracuda upgrades without losing cash or existing cars',()=>{
 const run=harness();
 const result=run(`(()=>{const p=DriftCareer.load();p.cash=45000;p.cars.blue.owned.engine=2;p.cars.blue.active.engine=2;delete p.cars.barracuda;localStorage.setItem('drift:career:v1',JSON.stringify(p));const clean=DriftCareer.load();return {cash:clean.cash,blue:clean.cars.blue.owned.engine,barracuda:clean.cars.barracuda.owned.engine,skin:CAR_DATA.some(c=>c.sprite==='barracuda'),online:DriftNet.SKINS.includes('barracuda')}})()`);
 assert.deepEqual(result,{cash:45000,blue:2,barracuda:0,skin:true,online:true});
});

test('new car selection, workshop and track preparation retain all ten cars',()=>{
 const run=harness();
 const result=run(`(()=>{previewTouring(301,5);confirmTrackPreview();carIdx=CAR_DATA.findIndex(c=>c.sprite==='barracuda');chosen=CAR_DATA[carIdx];updateGaragePerformance();return {count:CAR_DATA.length,name:previewSelection.track.layout.name,stage:previewSelection.track.layout.stage,laps:previewSelection.track.raceLaps,car:chosen.sprite}})()`);
 assert.equal(result.count,10);assert.equal(result.stage,'GT Racing 2');assert.equal(result.laps,5);assert.equal(result.car,'barracuda');
});
