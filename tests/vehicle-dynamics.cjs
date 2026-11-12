const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
const ready=import('../server/engine.js');
const straight={roadHalf:1e6,sample:(x,y)=>({cx:x,cy:0,tang:0,dist:y,i:0})};
function place(createCar,track,skin='blue'){const c=createCar(track,skin,true,0);c.pos={x:0,y:0};c.angle=0;c.updateSmoke=()=>{};return c;}
test('actual offline configuration and authoritative server produce identical trajectories for all cars',async()=>{
  const {Net,createCar,createTrack}=await ready;
  for(const skin of Net.SKINS){
    const r=harness(),track=createTrack(1),car=createCar(track,skin,true,1),commands=Array.from({length:300},(_,i)=>Net.encode({accel:i<220,brake:i>=260,handbrake:i>180&&i<205,steerAxis:i>120?.2:0},i+1));
    const local=r(`(()=>{const track=presetTrack(1),car=configureSelectedCar(new Car(track),CAR_DATA.find(c=>c.sprite==='${skin}'));car.auto=true;DriftNet.grid(car,track,1);for(const cmd of ${JSON.stringify(commands)})DriftNet.step(car,cmd,track,false);return DriftNet.capture(car);})()`);
    for(const cmd of commands)Net.step(car,cmd,track,false);
    assert.deepEqual(JSON.parse(JSON.stringify(Net.capture(car))),local,skin);
  }
});
test('new handling uses a separate time-trial record namespace and preserves old records',()=>{
  const r=harness();const result=r(`(()=>{const t=presetTrack(1),old=encodeTrack(t.points);saveTT('best',old,{time:42,samples:[]});startWithTrack(t,'tt');return {key:currentTrackId,old:loadTT('best',old),current:loadTT('best',currentTrackId)};})()`);
  assert.match(result.key,/:physics-v3:tyres-v2$/);assert.equal(result.old.time,42);assert.equal(result.current,null);
});
test('all five cars reach 10% higher actual flat-road terminal speed than the previous physics',()=>{
  const r=harness(),legacy=fs.readFileSync('tests/fixtures/car-v0.2.txt','utf8').replace('class Car{','class LegacyCar{');
  r(legacy);
  const results=r(`CAR_DATA.map(data=>{
    const tr=presetTrack(1),old=new LegacyCar(tr),next=configureSelectedCar(new Car(tr),data);
    old.engineForce*=data.tune.engine;old.dragLinear*=data.tune.drag;old.mass*=data.tune.mass;if(data.sprite==='yugo')DriftYugo.configure(old);
    const road={roadHalf:1e6,sample:(x,y)=>({cx:x,cy:0,tang:0,dist:y,i:0})};
    for(const c of [old,next]){c.pos={x:0,y:0};c.angle=0;c.auto=true;c.updateSmoke=()=>{};for(let i=0;i<10800;i++)c.update(1/60,{accel:true},road);}
    return {skin:data.sprite,old:old.worldSpeed()*3.6,now:next.worldSpeed()*3.6};
  })`);
  for(const row of results){assert(Math.abs(row.now/row.old-1.1)<.004,JSON.stringify(row));}
  console.log('Measured terminal speeds (km/h):',results);
});
test('braking moves load forward, acceleration moves it back, and load is conserved',async()=>{
  const {createCar,createTrack}=await ready,c=place(createCar,createTrack(1),'gray'),staticFront=c.frontLoad;
  c.vel.x=18;c.gear=3;for(let i=0;i<40;i++)c._physStep(1/60,0,1,0);
  assert(c.frontLoad<staticFront);assert(c.accelLong>0);
  for(let i=0;i<30;i++)c._physStep(1/60,0,0,1);
  assert(c.frontLoad>staticFront);assert(c.accelLong<0);assert(Math.abs(c.frontLoad+c.rearLoad-c.mass*9.81)<1e-6);
});
test('mass and body inertia resist steering, yaw continues briefly after release',async()=>{
  const {createCar,createTrack}=await ready,tr=createTrack(1),light=place(createCar,tr),heavy=place(createCar,tr);heavy.mass*=2;
  for(const c of [light,heavy]){c.vel.x=18;c.gear=3;for(let i=0;i<8;i++)c._physStep(1/120,.12,0,0);}
  assert(heavy.omega<light.omega*.75);assert(heavy.omega>0);
  const before=light.angle;light._physStep(1/120,0,0,0);assert(light.angle>before);assert(light.omega>0);
});
test('passive tyres and drag dissipate kinetic energy; braking cannot propel a stopped vehicle backwards',async()=>{
  const {createCar,createTrack}=await ready,tr=createTrack(1);
  for(const skin of ['blue','gray','yellow','yugo','fujiwara']){
    const c=place(createCar,tr,skin);c.vel={x:22,y:5};c.omega=.3;
    const inertia=c.mass*(c.bodyDimensions.length**2+c.bodyDimensions.width**2)/12*c.handling.yaw;
    const energy=()=>c.mass*c.worldSpeed()**2/2+inertia*c.omega**2/2,before=energy();let previous=before;
    for(let i=0;i<120;i++){c._physStep(1/60,.15,0,0);assert(energy()<=previous+1e-5,skin);previous=energy();}assert(energy()<before*.98,skin);
    c.pos={x:0,y:0};c.angle=c.omega=0;c.vel={x:10,y:0};
    for(let i=0;i<600;i++)c._physStep(1/60,0,0,1);
    assert(c.worldSpeed()<.01,skin);assert(c.vel.x>=-.001,skin);
  }
});
test('substeps give the same force integration at 30, 60 and 120 Hz',async()=>{
  const {createCar,createTrack}=await ready,tr=createTrack(1),runs=[];
  for(const hz of [30,60,120]){
    const c=place(createCar,tr);c.vel.x=18;c.gear=3;
    for(let i=0;i<hz*4;i++)c._physStep(1/hz,.1,1,0);
    runs.push([c.pos.x,c.pos.y,c.angle,c.vel.x,c.vel.y,c.omega]);
  }
  for(const run of runs)run.forEach((v,i)=>assert(Math.abs(v-runs[0][i])<1e-8));
});
test('combined grip bounds cornering and handbrake creates greater rear slip without numerical blowup',async()=>{
  const {createCar,createTrack}=await ready,tr=createTrack(1),values=[];
  for(const handbrake of [false,true]){
    const c=place(createCar,tr,'gray');c.vel.x=20;c.gear=3;c.handbrake=handbrake;
    let peak=0;for(let i=0;i<90;i++){c._physStep(1/60,.3,1,0);peak=Math.max(peak,Math.abs(c.rearSlip));assert(Math.abs(c.accelLat)<14);}
    values.push(peak);assert(Number.isFinite(c.angle));
  }
  assert(values[1]>values[0]*1.25,JSON.stringify(values));
});
test('weight transfer tilts a sprung body while all four tyres retain road contact, then settles',async()=>{
  const {createCar,createTrack}=await ready,tr=createTrack(1),c=place(createCar,tr,'gray');
  const road={points:[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],roadHalf:20};
  const r=harness();
  const result=r(`(()=>{const c=configureSelectedCar(new Car(presetTrack(1)),CAR_DATA.find(c=>c.sprite==='gray'));c.pos={x:0,y:0};c.angle=0;const t=${JSON.stringify(road)};DriftRoadContact.reset(t,c,'gray');c.accelLat=7;c.accelLong=-6;for(let i=0;i<120;i++)DriftRoadContact.update(t,c,1/60,'gray');const peak={roll:c.ride.roll,pitch:c.ride.pitch,wheels:c.ride.wheels};c.accelLat=c.accelLong=0;for(let i=0;i<300;i++)DriftRoadContact.update(t,c,1/60,'gray');return {peak,roll:c.ride.roll,pitch:c.ride.pitch};})()`);
  assert(result.peak.roll<-.06);assert(result.peak.pitch<-.03);assert(result.peak.wheels.every(w=>w.height===0));assert(Math.abs(result.roll)<.0001);assert(Math.abs(result.pitch)<.0001);
});
test('retired C’Maro upgrades migrate to Nova, and paint persists per car without charging credits',()=>{
  const r=harness();
  const value=r(`(()=>{localStorage.setItem(DriftCareer.KEY,JSON.stringify({cash:500,cars:{red:{owned:{engine:3},active:{engine:2}},gray:{owned:{tires:2},active:{tires:1}}}}));let p=DriftCareer.load();DriftCareer.save(p);choosePaint('#6543ab');chosen=CAR_DATA.find(c=>c.sprite==='gray');choosePaint('#e5db21');p=DriftCareer.load();return {skins:CAR_DATA.map(c=>c.sprite),red:p.cars.red,nova:p.cars.gray,blue:p.cars.blue,cash:p.cash,invalid:DriftCareer.setPaint('blue','bad')};})()`);
  assert.deepEqual(value.skins,['blue','yellow','gray','yugo','fujiwara','barracuda','subaru','bmw','shelby','mustang']);assert.equal(value.red,undefined);assert.equal(value.nova.owned.engine,3);assert.equal(value.nova.active.tires,1);assert.equal(value.blue.paintColor,'#6543ab');assert.equal(value.nova.paintColor,'#e5db21');assert.equal(value.cash,500);assert.equal(value.invalid,false);
});
test('smoke emits at the tyre contact, grows, rises and fades at a bounded count',()=>{
  const r=harness();const v=r(`(()=>{const c=configureSelectedCar(new Car(presetTrack(1)),CAR_DATA[0]);c.pos={x:0,y:0};c.angle=0;c.vel={x:18,y:3};c.trailOn=true;c.rearSlip=.5;c.smokeAcc=1;c.updateSmoke(0,{x:1,y:0},{x:0,y:1},.5,70,3);const p=c.smoke[0],start={x:p.x,y:p.y,r:p.r,height:p.height};for(let i=0;i<18;i++)c.updateSmoke(1/60,{x:1,y:0},{x:0,y:1},.5,70,3);const alive={r:p.r,height:p.height,a:p.a};for(let i=0;i<1200;i++)c.updateSmoke(1/60,{x:1,y:0},{x:0,y:1},.5,70,3);const count=c.smoke.length;c.trailOn=false;c.rearSlip=0;for(let i=0;i<240;i++)c.updateSmoke(1/60,{x:1,y:0},{x:0,y:1},0,0,0);return {start,alive,count,left:c.smoke.length,wheel:DriftRoadContact.wheelOffsets('blue')[0]};})()`);
  assert(Math.abs(v.start.x-v.wheel.x)<.05);assert(Math.abs(v.start.y-v.wheel.z)<.05);assert(v.alive.r>v.start.r);assert(v.alive.height>v.start.height);assert(v.alive.a>0);assert(v.count>50&&v.count<=800);assert.equal(v.left,0);
});
test('paint atlas masks preserve glass, wheels, logos and lamp pixels',async()=>{
  const {paintPixel,recolorPixels}=await import('../js/vehicle-paint.js');
  assert(paintPixel('gray','Material_Nova',.2,.1,0,0,0));assert(!paintPixel('gray','headlights',.2,.1,0,0,0));assert(!paintPixel('gray','Material_Nova',.7,.5,25,25,25));
  assert(paintPixel('blue','Chassis',.4,.4,25,60,170));assert(!paintPixel('blue','Glass',.4,.4,25,60,170));
  assert(paintPixel('fujiwara','material_1',.4,.05,230,230,230));assert(!paintPixel('fujiwara','material_1',.05,.65,230,230,230));
  assert(!paintPixel('yugo','Yugo pixel atlas',.85,.18,200,30,20));
  assert(paintPixel('yugo','Yugo pixel atlas',.6,.2,200,30,20));
  const data=new Uint8ClampedArray(4*4*4);for(let i=3;i<data.length;i+=4)data[i]=255;
  assert(recolorPixels(data,'gray','Material_Nova','#ffffff',4,4)>0);assert(data[0]>150);assert.equal(data[3],255);assert.equal(data[60],0);
});
test('painting preserves Color instances for atmospheric tint and restores body materials on disposal',async()=>{
  const T=await import('../vendor/three.module.min.js'),{applyVehiclePaint,disposePaint}=await import('../js/vehicle-paint.js');
  const root=new T.Group(),body=new T.Group(),original=new T.MeshBasicMaterial({color:0xffffff});original.userData.originalColor=original.color.clone();root.add(body);
  const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),original);body.add(mesh);const model={root,body};
  applyVehiclePaint(model,'yugo','#2456be');assert.notEqual(mesh.material,original);assert(mesh.material.userData.originalColor.isColor);
  mesh.material.color.copy(mesh.material.userData.originalColor);assert.equal(mesh.material.color.getHex(),0xffffff);
  disposePaint(model);assert.equal(mesh.material,original);mesh.geometry.dispose();original.dispose();
});
