const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {harness}=require('./harness.cjs');
test('Summit route closes, follows supplied elevations and keeps its own race records',()=>{
  const r=harness();const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201);let error=0,maxJump=0;for(let s=0;s<t.length;s+=11){const p=t.atDistance(s),q=t.atDistance(s+.1);error=Math.max(error,Math.abs(t.surfaceHeight(p.x,p.y)-p.h));maxJump=Math.max(maxJump,Math.abs(q.h-p.h));}startWithTrack(t,'tt');return {id:t.touringId,length:t.length,error,maxJump,key:currentTrackId,start:t.atDistance(0),end:t.atDistance(t.length),minWidth:Math.min(...t.points.map(p=>t.widthAt(p.s))),features:t.features,hash:DriftSummitData.sourceSHA256}})()`);
  assert.equal(result.id,201);assert(result.length>10000&&result.length<10600);assert(result.error<.01);assert(result.maxJump<.04);assert.deepEqual(result.start,result.end);assert(result.key.startsWith('SUMMIT.v1'));assert(result.minWidth>3.9);assert.equal(result.features.length,3);
  assert.equal(result.hash,crypto.createHash('sha256').update(fs.readFileSync(new URL('../assets/bonus/summit.glb','file://'+__filename))).digest('hex'));
  r("mode='race';previewTouring(201,5);confirmTrackPreview();showCircuitMenu();");assert.equal(r('previewSelection.track.touringId'),201);assert.equal(r('previewSelection.track.raceLaps'),5);
});
test('Summit tyre contact matches the rendered triangle planes across both lanes',()=>{
  const r=harness();const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201);let maxError=0,n=0;for(const tri of DriftSummitData.support){const x=(tri[0]+tri[3]+tri[6])/3,y=(tri[1]+tri[4]+tri[7])/3,h=(tri[2]+tri[5]+tri[8])/3,q=t.sample(x,y);if(q.distance<t.widthAt(q.s)-.25&&Math.abs(h-q.h)<.08){maxError=Math.max(maxError,Math.abs(t.surfaceHeight(x,y)-h));n++;}}return {maxError,n}})()`);
  assert(result.n>4000);assert(result.maxError<.03,JSON.stringify(result));
});
test('Summit barriers and tunnel cameras remain inside the supplied road envelope',()=>{
  const r=harness();const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201),car=new Car(t);let maxSide=0,maxRoof=0;for(let s=10;s<t.length;s+=83){const p=t.atDistance(s);car.pos={x:p.x+p.nx*20,y:p.y+p.ny*20};car.angle=t.tangentAt(p.i);car.vel={x:p.nx*10,y:p.ny*10};DriftTouring.afterStep(t,car);const q=t.sample(car.pos.x,car.pos.y);maxSide=Math.max(maxSide,q.distance-t.barrierHalfAt(q));}for(const f of t.features){const p=t.atDistance((f.start+f.end)/2),position={x:p.x,y:p.h+30,z:p.y};DriftTouring.constrainCamera(t,car,position,null);maxRoof=Math.max(maxRoof,position.y-p.h-f.clearance);}return {maxSide,maxRoof}})()`);
  assert(result.maxSide<=.05);assert(result.maxRoof<=0);
});

test('all five bodies stay with their wheels at negative elevations, on the grid and across zero',async()=>{
  const r=harness(),{DriftView3D}=await import('../js/view3d.js'),T=await import('../vendor/three.module.min.js');
  const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201),out=[];for(const data of CAR_DATA){const c=configureSelectedCar(new Car(t),data);let maxError=0;for(let s=0;s<t.length;s+=37){const p=t.atDistance(s);c.pos={x:p.x,y:p.y};c.angle=t.sample(p.x,p.y).tang;DriftRoadContact.reset(t,c,data.sprite);for(let i=0;i<3;i++)DriftRoadContact.update(t,c,1/60,data.sprite);maxError=Math.max(maxError,Math.abs(c.ride.height-DriftRoadContact.contacts(t,c,data.sprite).height));}startWithTrack(t,'tt');for(let i=0;i<180;i++)DriftRoadContact.update(t,player,1/60,chosen.sprite);const p=t.atDistance(0);c.pos={x:p.x,y:p.y};c.angle=t.sample(p.x,p.y).tang;DriftRoadContact.reset(t,c,data.sprite);for(let i=0;i<180;i++)DriftRoadContact.update(t,c,1/60,data.sprite);out.push({skin:data.sprite,maxError,pose:{pos:c.pos,angle:c.angle,bodyDimensions:c.bodyDimensions},ride:c.ride});}return out})()`);
  for(const row of result){
    assert(row.maxError<.001,`${row.skin}: body detached by ${row.maxError} m`);
    assert(row.ride.height<-20,'Starting grid is below world zero');
    const root=new T.Group(),body=new T.Group();root.add(body);
    const wheels=row.ride.wheels.map(w=>{const steer=new T.Group();steer.position.set(w.x,.36,w.z);root.add(steer);return {steer,front:w.x>0};});
    root.position.set(row.pose.pos.x,0,row.pose.pos.y);root.rotation.set(0,-row.pose.angle,0,'YXZ');
    DriftView3D.prototype.placeOnRoad.call({track:{elevated:true}},{root,body,wheels},row.pose,row.skin,row.ride);root.updateMatrixWorld(true);
    assert(Math.abs(root.position.y-row.ride.height)<.001);
    wheels.forEach((w,i)=>assert(Math.abs(w.steer.getWorldPosition(new T.Vector3()).y-.36-row.ride.wheels[i].height)<.001));
    assert(Math.abs(body.getWorldPosition(new T.Vector3()).y-row.ride.height)<.08,'Chassis follows wheel support at race start');
  }
});

test('each stock car can release the brake and start on the steepest Summit ascent',()=>{
  const r=harness();const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201);let hill={grade:0};for(let s=0;s<t.length;s+=3){const p=t.atDistance(s),q=t.sample(p.x,p.y);if(q.grade>hill.grade)hill={...q,s};}return {grade:hill.grade,cars:CAR_DATA.map(data=>{const c=configureSelectedCar(new Car(t),data),p=t.atDistance(hill.s);c.pos={x:p.x,y:p.y};c.angle=hill.tang;c.auto=true;c.updateSmoke=()=>{};DriftRoadContact.reset(t,c,data.sprite);for(let i=0;i<120;i++)c.update(1/60,{brake:true},t);const held=Math.hypot(c.pos.x-p.x,c.pos.y-p.y);let rollback=0,bodyError=0;for(let i=0;i<600;i++){c.update(1/60,{accel:true},t);DriftRoadContact.update(t,c,1/60,data.sprite);rollback=Math.min(rollback,(c.pos.x-p.x)*Math.cos(hill.tang)+(c.pos.y-p.y)*Math.sin(hill.tang));bodyError=Math.max(bodyError,Math.abs(c.ride.height-DriftRoadContact.contacts(t,c,data.sprite).height));}return {skin:data.sprite,held,rollback,bodyError,progress:t.sample(c.pos.x,c.pos.y).s-hill.s,speed:c.worldSpeed()*3.6};})}})()`);
  assert(result.grade>.27);
  for(const c of result.cars){assert.equal(c.held,0,c.skin);assert(c.rollback>-.5,JSON.stringify(c));assert(c.progress>45,JSON.stringify(c));assert(c.speed>35,JSON.stringify(c));assert(c.bodyError<.05,JSON.stringify(c));}
});

test('rolling race intro samples the displayed position without moving the physical grid',()=>{
  const r=harness();const result=r(`(()=>{const t=DriftTouring.createTrack(Track,201),c=configureSelectedCar(new Car(t),CAR_DATA[0]),p=t.atDistance(3408);c.pos={x:p.x,y:p.y};c.angle=t.sample(p.x,p.y).tang;DriftRoadContact.reset(t,c,c.skin);const before=JSON.stringify(c),samples=[0,1,2,3,4].map(time=>{const shown=DriftRace.presentation([c],time)[0],support=shown.ride||DriftRoadContact.contacts(t,shown,c.skin);return {height:support.height,ground:DriftRoadContact.contacts(t,shown,c.skin).height};});return {samples,unchanged:before===JSON.stringify(c)}})()`);
  assert(result.unchanged);assert(result.samples.at(-1).height-result.samples[0].height>2);
  for(const s of result.samples)assert(Math.abs(s.height-s.ground)<.001);
});
