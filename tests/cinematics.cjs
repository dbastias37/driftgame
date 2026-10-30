const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ready=Promise.all([import('../js/road-contact.js'),import('../js/replay.js'),import('../js/drift-effects.js')]);
function pose(x=0){return {pos:{x,y:0},angle:0,vel:{x:10,y:0},steerAngle:.1,gear:2,ride:{height:.07,roll:.1,pitch:.05,wheels:[0,.14,0,.14].map(height=>({height}))},worldSpeed(){return Math.hypot(this.vel.x,this.vel.y)}};}
test('x5 requires a drifting tire on the raised kerb; losing contact returns to x3 without losing the chain',()=>{
 const r=harness();r(`var tr=new Track([{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],14);tr.roadHalf=14;var car=new Car(tr);car.skin='fujiwara';car.angle=0;car.pos={x:0,y:14.51-.729235};car.vel={x:15,y:8};car.driftTime=6;car.mult=3;car.comboPoints=1500;function score(){return car._updateScoreAndTrail(1/60,tr,{x:1,y:0},{x:0,y:1},60,8)};score();`);
 assert.equal(r('car.mult'),5);assert.ok(r('car.comboPoints')>1500);const points=r('car.comboPoints');r('car.pos.y=0;score()');assert.equal(r('car.mult'),3);assert.ok(r('car.comboPoints')>points);
 r('car.pos.y=14.51-.729235;car.driftTime=1;car.mult=1;score()');assert.equal(r('car.mult'),1);
 r('car.driftTime=6;car.mult=3;car.descent={motion:"falling"};score()');assert.equal(r('car.mult'),3);
 r('car.descent=null;car.driftTime=6;score();car.hit(tr,{cx:0,cy:0})');assert.equal(r('car.mult'),1);assert.equal(r('car.comboPoints'),0);
});
test('kerb contact follows each model wheel footprint, on both flat and mountain road edges',async()=>{
 await ready;const R=DriftRoadContact,flat={points:[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],roadHalf:14};
 const mountain={...flat,downhill:true,sampleNearby:(x,y)=>({distance:Math.abs(y)}),surfaceHeight:()=>40};
 for(const track of [flat,mountain])for(const skin of ['blue','red','yellow','gray','yugo','fujiwara'])for(const side of [-1,1]){
  const p=pose();p.pos.y=side*(14.51-Math.abs(R.wheelOffsets(skin)[0].z));assert.equal(R.curbWheels(track,p,skin),2,skin);
  p.pos.y=0;assert.equal(R.curbWheels(track,p,skin),0);p.pos.y=14.51;assert.equal(R.curbWheels(track,p,skin),0,'body over curb alone is insufficient');
 }
});
test('pose recorder has bounded storage, shortest-angle interpolation and no recovery teleport interpolation',async()=>{
 await ready;const rec=new DriftReplay.Recorder(2),p=pose(),rivals=[Object.assign(pose(),{id:'b',skin:'yugo'}),Object.assign(pose(),{id:'c',skin:'yellow'})];rec.reset({skin:'fujiwara'});
 for(let i=0;i<=100;i++){p.pos.x=i*.5;p.angle=i%2?3.1:-3.1;rec.capture(i*.05,p,rivals);}
 assert.equal(rec.count,41);assert.ok(Math.abs(rec.start-3)<1e-6);assert.ok(Math.abs(rec.duration-2)<1e-6);assert.equal(rec.sample(4.025).rivals.length,2);assert.ok(Math.abs(Math.abs(rec.sample(4.025).player.angle)-Math.PI)<.001);
 assert.equal(JSON.stringify(rec.sample(3.5)),JSON.stringify(rec.sample(3.5)));rec.capture(8,p);assert.ok(rec.duration<=2.000001);
});
test('recorded suspension, wheel rotation, falling and cuts are reproducible without touching the source',async()=>{
 await ready;const rec=new DriftReplay.Recorder(),p=pose();rec.reset({skin:'yugo'});rec.capture(0,p);p.pos.x=.5;p.angle=.2;rec.capture(.05,p);const before=JSON.stringify(p),sample=rec.sample(.025).player;
 assert.equal(JSON.stringify(p),before);assert.ok(Math.abs(sample.pos.x-.25)<1e-6);assert.ok(Math.abs(sample.ride.wheels[1].height-.14)<1e-6);assert.ok(sample.wheelTravel>0);
 p.pos.x=100;rec.capture(.1,p);assert.ok(rec.sample(.075).player.pos.x<1);assert.equal(rec.sample(.1).player.pos.x,100);
 p.descent={motion:'falling',y:30,roll:1.2,pitch:.4,s:50};rec.capture(.15,p);assert.equal(rec.sample(.15).player.descent.motion,'falling');p.descent.motion='driving';p.pos.x=101;rec.capture(.2,p);assert.equal(rec.sample(.175).player.descent.motion,'falling');
 const full=new DriftReplay.Recorder();full.reset({skin:'blue'});full.capture(0,p,[Object.assign(pose(),{id:'b'}),Object.assign(pose(),{id:'c'})]);assert.ok(full.bytes<4.6e6);
});
test('departed and newly appearing online rivals are not invented across a replay seek',async()=>{
 await ready;const rec=new DriftReplay.Recorder(1),p=pose(),b=Object.assign(pose(),{id:'b',skin:'yugo'});rec.reset({skin:'blue'});rec.capture(0,p);rec.capture(.05,p,[b]);rec.capture(.1,p,[]);assert.equal(rec.sample(.025).rivals.length,0);assert.equal(rec.sample(.05).rivals.length,1);assert.equal(rec.sample(.1).rivals.length,0);
});
test('replay controls freeze simulation and restore the exact paused state, including time trial lap clock resets',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'tt');state='running';for(let i=0;i<180;i++){simulate(1/60);replayUI.capture(1/60);}raceTime=0;for(let i=0;i<60;i++)replayUI.capture(1/60);setPaused(true);`);assert.ok(r('replayUI.recorder.duration')>3.9);
 const before=r('({car:player,time:raceTime,lap:lapTime,locked:controlsLocked})');r('replayUI.open();for(let i=0;i<30;i++){simulate(1/60);replayUI.frame(1/60);}replayUI.seek(2);replayUI.frame(0);replayUI.close()');assert.deepEqual(r('({car:player,time:raceTime,lap:lapTime,locked:controlsLocked})'),before);assert.equal(r('state'),'paused');assert.equal(r('replayUI.active'),false);
 r("state='menu';document.body.classList.remove('in-game');replayUI.open()");assert.equal(r("document.body.classList.contains('in-game')"),true);r('replayUI.close()');assert.equal(r("document.body.classList.contains('in-game')"),false);
});
test('drift impulse is a bounded rising-edge envelope that fades while held and respects reduced motion',async()=>{
 await ready;for(const hz of [30,60,120]){const e=new DriftEffects.Effect();let peak=0;for(let i=0;i<hz*6;i++){e.step(1/hz,{pressed:true,speed:30});peak=Math.max(peak,e.boost);}assert.ok(peak>.35&&peak<.6);assert.ok(e.boost<.001);e.step(1/hz,{pressed:false});e.step(1/hz,{pressed:true});assert.ok(e.boost>0);e.step(1/hz,{pressed:true,reduced:true});assert.equal(e.boost,0);assert.equal(e.lines,0);e.step(1/hz,{pressed:true,impulse:false,lines:'off'});assert.equal(e.boost,0);assert.equal(e.lines,0);}
});
test('cinematic montage cuts between all three shot types; corner cameras stay fixed and drone arcs are bounded',async()=>{
 const {CinematicDirector}=await import('../js/cinematic-camera.js'),{createTrack,createCar}=await import('../server/engine.js');const track=createTrack(1),p=createCar(track,'blue',true,0),director=new CinematicDirector();
 const kinds=new Set();for(const t of [0,7,14,21,28])kinds.add(director.update({track,player:p,time:t,mode:'cinematic'}).kind);assert.deepEqual([...kinds].sort(),['drone','isometric','trackside']);
 director.reset();const anchor={pos:{...p.pos}},a=director.update({track,player:p,time:7,mode:'trackside',anchor});p.pos.x+=1;const b=director.update({track,player:p,time:8,mode:'trackside',anchor});assert.deepEqual(a.position,b.position);assert.equal(b.cut,false);
 director.reset();let max=0;for(let t=0;t<45;t+=.1){const shot=director.update({track,player:p,time:t,mode:'drone'});assert.equal(shot.cut,false);max=Math.max(max,Math.hypot(shot.position.x-p.pos.x,shot.position.z-p.pos.y));assert.ok(shot.position.y>=17);}assert.ok(max<50);assert.equal(director.update({track,player:p,time:7,mode:'cinematic',reduced:true}).kind,'isometric');
});
