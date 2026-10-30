const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
function scoreHarness(){const r=harness();r(`var road={roadHalf:7,sample:()=>({cx:0,cy:0,dist:0,tang:0,i:0})};var car=new Car(presetTrack(1));car.pos={x:0,y:0};car.vel={x:15,y:8};function scoreStep(lat=8){car._updateScoreAndTrail(1/60,road,{x:1,y:0},{x:0,y:1},61.2,lat);}for(let i=0;i<330;i++)scoreStep();`);return r;}
test('multipliers and sharp countersteering preserve the accumulated combo',()=>{
 const r=scoreHarness();assert.equal(r('car.mult'),3);assert.equal(r('car.comboPoints'),r('car.score'));assert.ok(r('car.comboPoints')>0);
 const before=r('car.comboPoints');r('car.steerVel=3;car.yawRate=3;car._lastTrailOn=false;scoreStep(-8)');assert.equal(r('car.mult'),3);assert.ok(r('car.comboPoints')>before);
 r('car.driftTime=1.99;car.mult=1;car.comboPoints=1500;scoreStep()');assert.equal(r('car.mult'),2);assert.ok(r('car.comboPoints')>1500);
 r('car.driftTime=4.99;car.mult=2;car.comboPoints=2500;scoreStep()');assert.equal(r('car.mult'),3);assert.ok(r('car.comboPoints')>2500);
});
test('linked drift pauses earnings in a neutral transition and expires after a real interruption',()=>{
 const r=scoreHarness(),before=r('car.comboPoints'),time=r('car.driftTime');r('for(let i=0;i<20;i++)scoreStep(0)');assert.equal(r('car.comboPoints'),before);assert.equal(r('car.mult'),3);assert.equal(r('car.driftTime'),time);
 r('scoreStep(-8)');assert.ok(r('car.comboPoints')>before);assert.equal(r('car.mult'),3);
 r('for(let i=0;i<30;i++)scoreStep(0)');assert.equal(r('car.mult'),1);assert.equal(r('car.comboState'),0);assert.equal(r('car.comboPoints'),0);assert.ok(r('car.score')>before);
 r('scoreStep()');assert.equal(r('car.mult'),1);assert.ok(r('car.comboPoints')>0&&r('car.comboPoints')<20);
});
test('off-road, reverse motion, stopping and impacts reset the whole active chain together',()=>{
 for(const action of ["road.sample=()=>({cx:0,cy:0,dist:8,tang:0,i:0});scoreStep()",'car.vel.x=-5;scoreStep()',"car._updateScoreAndTrail(1/60,road,{x:1,y:0},{x:0,y:1},0,0)","car.hit(road,{cx:0,cy:0})"]){const r=scoreHarness();r(action);assert.deepEqual(r('({mult:car.mult,state:car.comboState,points:car.comboPoints,time:car.driftTime})'),{mult:1,state:0,points:0,time:0});}
});
test('downhill progress rejection cannot restore a broken combo and recovery clears stale points',()=>{
 const r=harness();r("startWithTrack(DriftDownhill.createTrack(Track,1),'downhill');state='running';player.comboPoints=4000;player.score=5000;player.driftTime=6;player.mult=player.comboState=3;var originalUpdate=player.update;player.update=function(){this.breakFlow()};DriftDownhill.step(track,player,1/60,{brake:true},chosen.sprite);");assert.equal(r('player.comboPoints'),0);assert.equal(r('player.mult'),1);assert.equal(r('player.score'),5000);
 r('player.update=originalUpdate;player.comboPoints=1234;player.driftTime=6;player.mult=3;loseLifeAndRespawn()');assert.equal(r('player.comboPoints'),0);assert.equal(r('player.mult'),1);assert.equal(r('player.descent.motion'),'driving');
});
test('touch Drift includes throttle, independent pedal release and braking take priority; keyboard mapping is unchanged',()=>{
 const r=harness();r("startWithTrack(presetTrack(1),'race');state='running';touchEnabled=true;syncTouchHUD();var down={pointerId:7,preventDefault(){}};$('#btnHand').emit('pointerdown',down)");assert.equal(r('input().accel'),true);assert.equal(r('input().handbrake'),true);assert.equal(r('touch.accel'),false);
 r("$('#btnGas').emit('pointerdown',{...down,pointerId:8});$('#btnHand').emit('pointerup',down)");assert.equal(r('input().accel'),true);assert.equal(r('input().handbrake'),false);
 r("$('#btnGas').emit('pointercancel',{pointerId:8});$('#btnHand').emit('pointerdown',down);$('#btnBrake').emit('pointerdown',{...down,pointerId:9})");assert.equal(r('input().accel'),false);assert.equal(r('input().brake'),true);
 r("$('#btnBrake').emit('pointerup',{pointerId:9});$('#btnHand').emit('lostpointercapture',down)");assert.equal(r('input().accel'),false);assert.equal(r('input().handbrake'),false);
 r("touchEnabled=false;syncTouchHUD();keys.add('shift')");assert.equal(r('input().handbrake'),true);assert.equal(r('input().accel'),false);r("keys.add('w')");assert.equal(r('input().accel'),true);r("keys.clear();keys.add(' ')");assert.equal(r('input().brake'),true);assert.equal(r('input().handbrake'),false);
});
test('compact progress is numeric and combo typography scales on mobile only',()=>{
 const r=harness();r("startWithTrack(DriftDownhill.createTrack(Track,20),'downhill');state='running';player.descent.s=track.finishS*.425;updateDescentHUD()");assert.equal(r("$('#descentCompact').textContent"),'42%');
 r('var scales=[];ctx.scale=(x,y)=>scales.push(x);player.comboState=3;player.comboPoints=5000;player.comboFlashTime=0;view.width=390;view.height=844;drawComboOverlay();view.width=1366;view.height=768;drawComboOverlay()');assert.ok(r('scales[0]')<.51);assert.ok(r('scales[1]')>.9);
});
