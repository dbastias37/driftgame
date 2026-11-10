const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ready=Promise.all(['road-contact','wheel-particles','replay'].map(n=>import('../js/'+n+'.js')));
const road={roadHalf:10,points:[{x:0,y:0},{x:2000,y:0},{x:2000,y:100},{x:0,y:100}]};
function car(y=12,weather='clear',speed=25){return {id:'test',skin:'test',pos:{x:400,y},vel:{x:speed,y:0},angle:0,omega:0,braking:false,handbrake:false,conditions:{weather},worldSpeed(){return Math.hypot(this.vel.x,this.vel.y);}};}
function run(c,seconds=1,track=road,hz=60){for(let i=0;i<Math.round(seconds*hz);i++){c.pos.x+=c.vel.x/hz;DriftWheelParticles.update(c,1/hz,track);}}
function count(c,type){return c.wheelParticles.filter(p=>p.type===type).length;}

test('surface follows exact ribbons, both shoulders, intersections and huge imported segments',async()=>{
  await ready;
  for(const sign of [-1,1])for(const [d,kind] of [[9,'asphalt'],[10.1,'asphalt'],[10.5,'curb'],[11,'gravel'],[14,'gravel'],[14.01,'grass']])assert.equal(DriftRoadContact.surface(road,800,sign*d).kind,kind);
  const crossing={roadHalf:10,points:[{x:-100,y:0},{x:100,y:0},{x:0,y:100},{x:0,y:-100}]};
  assert.equal(DriftRoadContact.surface(crossing,0,12).kind,'asphalt');
  assert.equal(DriftRoadContact.surface({...road,points:[{x:-1e6,y:0},{x:1e6,y:0},{x:1e6,y:100}]},0,12).kind,'gravel');
  assert.equal(DriftRoadContact.surface({...road,training:true},800,12).kind,'asphalt');
});
test('only the wheels on gravel eject chips and dust; parked cars and grass do not',async()=>{
  await ready;const c=car(10.6);run(c,.5);
  assert(count(c,'gravel')>0);assert(count(c,'dust')>0);
  assert(c.wheelParticles.every(p=>p.wheel===1||p.wheel===3));
  for(const [y,speed] of [[0,30],[20,30],[12,0]]){const c=car(y,'clear',speed);c.handbrake=c.braking=true;c.driveSlip=1;run(c);assert.equal(c.wheelParticles.length,0);}
});
test('braking, lateral slip, reverse and speed affect the spray without changing the car',async()=>{
  await ready;const slow=car(12,'clear',7),fast=car(),drift=car();drift.vel.y=7;drift.braking=true;
  run(slow,.25);run(fast,.25);run(drift,.25);
  assert(count(fast,'gravel')>count(slow,'gravel'));assert(count(drift,'gravel')>count(fast,'gravel'));
  const reverse=car(12,'clear',-25);run(reverse,.25);assert(count(reverse,'gravel')>0);
  const before=JSON.stringify({pos:reverse.pos,vel:reverse.vel,angle:reverse.angle});DriftWheelParticles.update(reverse,1/60,road);
  assert.equal(JSON.stringify({pos:reverse.pos,vel:reverse.vel,angle:reverse.angle}),before);
});
test('straight wet-road driving makes blue droplets and fine mist, never cosmetic tyre smoke',async()=>{
  await ready;const dry=car(0),rain=car(0,'rain'),storm=car(0,'storm');rain.cosmetics={smokeColor:'#ff0000'};
  for(const c of [dry,rain,storm])run(c,.5);
  assert.equal(dry.wheelParticles.length,0);assert(count(rain,'drop')>10);assert(count(rain,'mist')>0);
  assert(count(storm,'drop')>=count(rain,'drop'));assert(rain.wheelParticles.every(p=>p.color!=='#ff0000'&&p.type!=='gravel'));
  const wetGravel=car(12,'storm'),dryGravel=car();wetGravel.handbrake=dryGravel.handbrake=true;run(wetGravel);run(dryGravel);
  assert(count(wetGravel,'dust')<count(dryGravel,'dust'));assert(count(wetGravel,'drop')>0);
});
test('pool, lifetimes and physical landing stay bounded during sustained sliding, then clear',async()=>{
  await ready;const c=car(12,'storm',40);c.wheelParticleLimit=24;c.handbrake=true;const objects=new Set();let bounced=false;
  for(let i=0;i<1200;i++){c.pos.x+=c.vel.x/60;DriftWheelParticles.update(c,1/60,road);for(const p of c.wheelParticles){objects.add(p);bounced||=p.bounces>0;assert(p.height>=0);assert(['x','y','height','vx','vy','vz','r','a'].every(k=>Number.isFinite(p[k])));}assert(c.wheelParticles.length<=24);}
  assert(objects.size<=24);assert(bounced);
  c.vel.x=0;run(c,2);assert.equal(c.wheelParticles.length,0);
});
test('recovery, new track and falling clear emitters without spraying across a teleport',async()=>{
  await ready;const c=car();run(c);assert(c.wheelParticles.length);
  c.pos.x=1400;c.pos.y=0;DriftWheelParticles.update(c,1/60,road);assert.equal(c.wheelParticles.length,0);
  c.pos.y=12;run(c);assert(c.wheelParticles.length);DriftRoadContact.reset(road,c,c.skin);assert.equal(c.wheelParticles.length,0);
  run(c);c.descent={motion:'falling'};DriftWheelParticles.update(c,1/60,road);assert.equal(c.wheelParticles.length,0);
  delete c.descent;run(c);DriftWheelParticles.update(c,1/60,{...road,roadHalf:20});assert.equal(c.wheelParticles.length,0);
});
test('banked touring roads support particles, bridges are paved, and tunnel interiors stay dry',async()=>{
  await ready;const {Track}=await import('../server/engine.js');await import('../js/touring-circuits.js');
  const track=DriftTouring.createTrack(Track,1),tunnel=track.features.find(f=>f.kind==='tunnel'),bridge=track.features.find(f=>f.kind==='bridge');
  for(const [feature,wet] of [[tunnel,0],[bridge,1]]){const p=track.ribbonPoint((feature.start+feature.end)/2,track.roadHalf+1.1),surface=DriftRoadContact.surface(track,p.x,p.y,1);assert.equal(surface.kind,'concrete');assert.equal(surface.wetness,wet);assert(Math.abs(surface.height-p.h)<.015);}
  const p=track.ribbonPoint((tunnel.start+tunnel.end)/2,0),c=car();c.pos={x:p.x,y:p.y};c.angle=track.tangentAt(p.i||track.sample(p.x,p.y).i);c.vel={x:20*Math.cos(c.angle),y:20*Math.sin(c.angle)};c.conditions.weather='storm';
  for(let i=0;i<30;i++)DriftWheelParticles.update(c,1/60,track);assert.equal(c.wheelParticles.length,0);
  const open=track.ribbonPoint(80,track.roadHalf+1.1),sample=DriftRoadContact.surface(track,open.x,open.y,0);assert.equal(sample.kind,'gravel');assert(Number.isFinite(sample.gx)&&Number.isFinite(sample.gy));
});
test('effects do not consume gameplay randomness or change server/reconciliation trajectories',async()=>{
  await ready;const old=Math.random;try{Math.random=()=>{throw new Error('Shared gameplay RNG consumed');};run(car(),1);}finally{Math.random=old;}
  const r=harness();const result=r(`(()=>{const t=presetTrack(1),a=configureSelectedCar(new Car(t),CAR_DATA[0]),b=configureSelectedCar(new Car(t),CAR_DATA[0]);DriftOptions.apply(a,{weather:'storm'});DriftOptions.apply(b,{weather:'storm'});for(let i=0;i<180;i++){const input=DriftNet.encode({accel:true,steerAxis:.15},i);DriftNet.step(a,input,t,true);DriftNet.step(b,input,t,false);}return {a:DriftNet.capture(a),b:DriftNet.capture(b),visual:a.wheelParticles.length,server:b.wheelParticles};})()`);
  assert.deepEqual(result.a,result.b);assert(result.visual>0);assert.equal(result.server,undefined);
});
test('fixed buffer renderer caps all cars together, culls distance and does not mutate paused effects',async()=>{
  await ready;const T=await import('../vendor/three.module.min.js'),{WheelParticleRenderer}=await import('../js/wheel-particles-renderer.js');
  const c=car();c.handbrake=true;run(c);const camera=new T.PerspectiveCamera(58,1,.1,300);camera.position.set(c.pos.x-10,5,c.pos.y+10);camera.lookAt(c.pos.x,0,c.pos.y);camera.updateMatrixWorld();
  const renderer=new WheelParticleRenderer(new T.Texture(),{detailLimit:24,cloudLimit:16}),positions=renderer.positions,before=JSON.stringify(c);
  for(let i=0;i<5;i++)renderer.update([c,c,c],camera,road);
  assert.equal(JSON.stringify(c),before);assert.equal(renderer.positions,positions);assert(renderer.stats.details<=24&&renderer.stats.clouds<=16);assert(renderer.geometry.drawRange.count<=24*12);assert(positions.every(Number.isFinite));
  camera.position.set(10000,5,10000);camera.updateMatrixWorld();renderer.update([c],camera,road);assert.equal(renderer.geometry.drawRange.count,0);assert.equal(renderer.clouds.geometry.drawRange.count,0);
  renderer.geometry.dispose();renderer.material.dispose();renderer.clouds.geometry.dispose();renderer.clouds.material.dispose();
});
test('replay creates wheel effects from recorded poses and pauses/rewinds without touching the live car',async()=>{
  await ready;const c=car(0,'rain'),recorder=new DriftReplay.Recorder(12),playback=new DriftWheelParticles.Playback();recorder.reset({track:road,skin:c.skin,weather:'rain'});
  for(let i=0;i<120;i++){c.pos.x+=c.vel.x/20;recorder.capture(i/20,c);}
  const before=JSON.stringify(c),sample=recorder.sample(3);playback.apply(recorder,3,sample);assert(sample.player.wheelParticles.length>0);const frozen=JSON.stringify(sample.player.wheelParticles);
  playback.apply(recorder,3,sample);assert.equal(JSON.stringify(sample.player.wheelParticles),frozen);
  const back=recorder.sample(1);playback.apply(recorder,1,back);assert(back.player.wheelParticles.length>0);assert(back.player.wheelParticles.every(p=>p.x<460));assert.equal(JSON.stringify(c),before);
});
