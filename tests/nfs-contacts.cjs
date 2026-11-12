const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
function fixture(){const r=harness();r(`
 var wall=(lo,hi,h=2)=>[0,lo,0,0,hi,0,0,hi,h,0,lo,0,0,hi,h,0,lo,h];
 DriftNFSData.rocky={sections:[[-50,-30,0,10,10,0],[50,-30,0,10,10,0],[50,30,0,10,10,0],[-50,30,0,10,10,0]],vertices:[-100,-100,0,100,-100,0,100,100,0,-100,100,0],indices:[0,1,2,0,2,3],features:[],walls:wall(-20,20),ceilings:[-10,-10,5,10,-10,5,10,10,5,-10,-10,5,10,10,5,-10,10,5]};
 function hit(t,start,end,velocity,angle=0,height=0){const c={pos:{...end},_nfsPrevious:{...start,angle},angle,vel:{...velocity},omega:0,bodyDimensions:{length:4.4,width:1.9,height:1.4},ride:{height,groundHeight:0,airborne:height>0},breakFlow(){}};t.constrainCar(c);return c;}
 `);return r;}
test('fast frontal impacts rebound without tunnelling through a thin visible rail',()=>{
 const r=fixture();const rows=r(`(()=>{const t=DriftNFS.createTrack(Track,202);return [10,40,80].map(speed=>hit(t,{x:-6,y:0},{x:6,y:0},{x:speed,y:0}));})()`);
 for(const c of rows){assert(c.pos.x<-2.1);assert(c.vel.x<0);assert(Math.abs(c.vel.x)<=80*.23);assert(Number.isFinite(c.omega));}
});
test('side impacts keep tangential velocity and reverse can leave the wall',()=>{
 const r=fixture();const result=r(`(()=>{const t=DriftNFS.createTrack(Track,202),c=hit(t,{x:-2,y:-4},{x:1,y:4},{x:10,y:60},Math.PI/2);const scrape={pos:{...c.pos},vel:{...c.vel}};c._nfsPrevious={...c.pos,angle:c.angle};c.pos.x-=1;c.vel={x:-5,y:0};t.constrainCar(c);return {scrape,escape:c}})()`);
 assert(result.scrape.pos.x<-.9);assert(result.scrape.pos.y>3.8);assert.equal(result.scrape.vel.y,60);assert(result.escape.pos.x<result.scrape.pos.x-.9);assert.equal(result.escape.vel.x,-5);
});
test('actual arch openings, jump height and unmeshed floor never become solid invisible walls',()=>{
 const r=fixture();const result=r(`(()=>{DriftNFSData.rocky.walls=[...wall(-20,-3,8),...wall(3,20,8)];const t=DriftNFS.createTrack(Track,202);return {opening:hit(t,{x:-6,y:0},{x:6,y:0},{x:50,y:0}),above:hit(t,{x:-6,y:10},{x:6,y:10},{x:50,y:0},0,9),edge:hit(t,{x:98,y:0},{x:108,y:0},{x:50,y:0},0,3),roof:t.ceilingHeight(0,0,0),outsideRoof:t.ceilingHeight(15,0,0)}})()`);
 for(const name of ['opening','above','edge']){assert.equal(result[name].vel.x,50);assert(Math.abs(result[name].pos.x-(name==='edge'?108:6))<1e-9);}
 assert.equal(result.roof,5);assert.equal(result.outsideRoof,null); // JSON converts Infinity.
});
test('all NFS rolling introductions carry the displayed world height into the camera',async()=>{
 const r=harness(),{startShot}=await import('../js/driving-cameras.js');
 const rows=r(`[201,202,203].flatMap(id=>{const t=DriftNFS.createTrack(Track,id),c=configureSelectedCar(new Car(t),CAR_DATA[0]);DriftRace.grid(c,t,0);DriftRoadContact.reset(t,c,c.skin);return [0,2,4,5.9].map(time=>{const p=DriftRace.presentation([c],time,t)[0];return {p,ground:t.surfaceHeight(p.pos.x,p.pos.y,p.ride.height),time};})})`);
 for(const {p,ground,time}of rows){assert(Math.abs(p.ride.height-ground)<.2);const shot=startShot([p],time);assert(Math.abs(shot.target.y-p.ride.height)<1);assert(shot.position.y>p.ride.height);}
});
test('wheel hubs follow the rigid chassis with bounded travel at cliffs and in flight',async()=>{
 const {DriftView3D}=await import('../js/view3d.js'),T=await import('../vendor/three.module.min.js');
 const root=new T.Group(),body=new T.Group();root.add(body);const wheels=[[-1.3,-.9],[-1.3,.9],[1.3,-.9],[1.3,.9]].map(([x,z])=>{const steer=new T.Group();steer.position.set(x,.36,z);root.add(steer);return {steer,front:x>0};});
 for(const airborne of [false,true]){
 const ride={height:10,roll:.3,pitch:.2,airborne,wheels:wheels.map((w,i)=>({x:w.front?1.3:-1.3,z:i%2?.9:-.9,height:i%2?80:-40}))};
 DriftView3D.prototype.placeOnRoad.call({track:{elevated:true}},{root,body,wheels},{bodyDimensions:{cgHeight:.55}},'blue',ride);
 for(const w of wheels){const rigid=w.basePosition.clone().applyEuler(body.rotation).add(body.position);assert(Math.abs(w.steer.position.y-rigid.y)<=.181);assert.equal(w.steer.position.x,rigid.x);assert.equal(w.steer.position.z,rigid.z);}
 }
});
test('Redrock rivals keep their racing line off the canyon rock seam',()=>{
 const r=harness();const rows=r(`(()=>{const t=DriftNFS.createTrack(Track,203),cars=CAR_DATA.slice(0,3).map((data,i)=>{const c=configureSelectedCar(new Car(t),data),p=t.atDistance(6420-i*12),a=t.sample(p.x,p.y,p.h).tang;c.pos={x:p.x,y:p.y};c.angle=a;c.auto=true;c.updateSmoke=()=>{};DriftRoadContact.reset(t,c,c.skin);return c;});for(let i=0;i<7800;i++)for(const c of cars){c.update(1/60,DriftRace.drive(c,t,undefined,cars,1/60),t);DriftRoadContact.update(t,c,1/60,c.skin);if(t.sample(c.pos.x,c.pos.y,c.ride.groundHeight).s>7350)c.passedCanyon=true;}return cars.map(c=>({skin:c.skin,passedCanyon:c.passedCanyon,s:t.sample(c.pos.x,c.pos.y,c.ride.groundHeight).s,speed:c.worldSpeed()}));})()`);
 for(const row of rows){assert(row.passedCanyon,JSON.stringify(row));assert(row.speed>2,JSON.stringify(row));}
});
