const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

test('title opens the menu only on Play; the demo is isolated from race, clocks and saved preferences',()=>{
 const r=harness();assert.equal(r('state'),'title');assert.equal(r("$('#mainMenu').classList.contains('hidden')"),true);
 const before=r('({player,raceTime,lapTime,renderPrefs})');r('for(let i=0;i<180;i++)attractDemo.frame(1/60)');assert.deepEqual(r('({player,raceTime,lapTime,renderPrefs})'),before);
 assert.equal(r('demoFrame.rivals.length'),2);assert.ok(r('demoFrame.player.worldSpeed()')>20);
 r("$('#btnPlayNow').click()");assert.equal(r('state'),'menu');assert.equal(r("$('#titleScreen').classList.contains('hidden')"),true);
 r("$('#btnBackTitle').click();$('#btnDemoPause').click()");const t=r('attractDemo.time');r('attractDemo.frame(1)');assert.equal(r('attractDemo.time'),t);
 r("$('#btnDemoPause').click();$('#btnPlayNow').click();$('#btnQuickRace').click();confirmTrackPreview();$('#btnChooseStart').click()");assert.equal(r('state'),'countdown');assert.equal(r("$('#titleScreen').classList.contains('hidden')"),true);
});

test('all twenty demo routes keep three distinct drifting cars on the road, with a continuous loop and bounded memory',()=>{
 const r=harness();const report=r(`(()=>{const result=[];for(let level=1;level<=20;level++){
  const track=presetTrack(level),demo=new DriftAttract.Demo(track,{day:level%2}),R=demo.recording;
  let separation=Infinity,drifts=0,maxDistance=0,steering=0;
  for(let t=0;t<demo.duration;t+=.25){const frame=R.sample(t),cars=[frame.player,...frame.rivals];
   for(const car of cars){maxDistance=Math.max(maxDistance,Math.abs(track.sample(car.pos.x,car.pos.y).dist));if(car.trailOn)drifts++;steering=Math.max(steering,Math.abs(car.steerAngle));}
   for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)separation=Math.min(separation,Math.hypot(cars[i].pos.x-cars[j].pos.x,cars[i].pos.y-cars[j].pos.y));
  }
  const first=R.sample(0),last=R.sample(demo.duration-.01);
  result.push({level,bytes:R.bytes,drifts,separation,maxDistance,half:track.roadHalf,steering,seam:Math.hypot(first.player.pos.x-last.player.pos.x,first.player.pos.y-last.player.pos.y)});
 }return result;})()`);
 for(const q of report){assert.ok(q.bytes<2e6,JSON.stringify(q));assert.ok(q.drifts>20);assert.ok(q.separation>4,JSON.stringify(q));assert.ok(q.maxDistance<q.half-2,JSON.stringify(q));assert.ok(q.seam<.5,JSON.stringify(q));assert.ok(q.steering>.1);}
});

test('intensity changes the vector effect and persists; spring acceleration stays gentle on repeated presses',()=>{
 const r=harness();r("$('#speedLinesIntensity').emit('input',{target:{value:'275'}})");assert.equal(r('renderPrefs.speedLinesIntensity'),2.75);assert.equal(r('JSON.parse(localStorage.getItem(PREF_KEY)).speedLinesIntensity'),2.75);
 const measures=r(`(()=>{const results=[];for(const hz of [30,60,120]){const fx=new DriftEffects.Effect();let delta=0,previous=0;for(let i=0;i<hz*5;i++){fx.step(1/hz,{pressed:Math.floor(i/(hz*.2))%2===0,speed:30});delta=Math.max(delta,Math.abs(fx.boost-previous));previous=fx.boost;}results.push({hz,delta});}return results;})()`);
 for(const x of measures)assert.ok(x.delta<1.8/x.hz,JSON.stringify(x));
 const strokes=r(`(()=>{const fx=new DriftEffects.Effect();fx.lines=1;const values=[];for(const intensity of [0,.5,1.5,3]){let count=0,alpha=0;const g={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){count++;alpha+=this.globalAlpha;}};fx.draw(g,1366,768,{intensity});values.push({count,alpha});}return values;})()`);
 assert.equal(strokes[0].count,0);for(let i=2;i<4;i++){assert.ok(strokes[i].count>strokes[i-1].count);assert.ok(strokes[i].alpha>strokes[i-1].alpha);}assert.ok(strokes[3].count<=96);
});
