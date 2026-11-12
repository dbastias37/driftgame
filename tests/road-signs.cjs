const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const ctx=vm.createContext({Math,console});for(const f of ['road-sign-data','road-signs','replay'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);return ctx;}
const track={sample:()=>({tang:0,i:0}),surfaceHeight:()=>0};
const def={x:0,y:0,ground:0,height:3,width:2,pole:1.8};
function car(x=-6,speed=80){return {pos:{x,y:0},vel:{x:speed,y:0},angle:0,ride:{height:0},score:1234,mult:5,comboPoints:200,omega:.1,bodyDimensions:{length:4.4,width:1.9,height:1.4}};}
test('swept front, reverse and side strikes leave all car motion and scoring untouched',()=>{
 const {DriftSigns}=setup();
 for(const [start,end,vx,vy,a]of [[-6,6,80,0,0],[6,-6,-80,0,0],[-6,6,0,80,Math.PI/2]]){
  const run=new DriftSigns.Run(track,[def]),c=car(start,vx);if(vy){c.pos={x:0,y:start};c.vel={x:0,y:vy};c.angle=a;}
  run.step(1/60,[c]);if(vy)c.pos.y=end;else c.pos.x=end;
  const before=JSON.stringify(c);run.step(1/60,[c]);assert.equal(JSON.stringify(c),before);assert.equal(run.signs[0].hit,true);
 }
});
test('signs fall, slide in impact direction, settle and remain until restart',()=>{
 const {DriftSigns}=setup(),run=new DriftSigns.Run(track,[def]),c=car(-1,40);
 run.step(1/60,[c]);for(let i=0;i<360;i++)run.step(1/60,[]);
 const p=run.signs[0];assert(p.hit&&p.settled);assert(p.x>2&&p.x<8);assert(Math.abs(p.tilt-Math.PI/2)<1e-8);assert.equal(run.moving.size,0);
 const end=JSON.stringify(p);run.step(0,[c]);run.step(1/60,[]);assert.equal(JSON.stringify(p),end);
 const t={...track,nfs:true,nfsSlug:'summit'};DriftSigns.prepare(t);t.roadSigns.signs[0].hit=true;DriftSigns.prepare(t,{reset:true});assert.equal(t.roadSigns.signs[0].hit,false);
});
test('overpasses, jumps, stationary cars and respawns cannot knock distant signs',()=>{
 const {DriftSigns}=setup();
 for(const type of ['above','below','stationary','teleport']){
  const run=new DriftSigns.Run(track,[def]),c=car(type==='teleport'?-50:-6,type==='stationary'?0:80);
  if(type==='above')c.ride.height=10;if(type==='below')c.ride.height=-10;
  run.step(1/60,[c]);c.pos.x=type==='teleport'?50:1;run.step(1/60,[c]);assert.equal(run.signs[0].hit,false,type);
 }
});
test('all imported signs have one front facing approaching traffic and exact rigid-face exclusions',()=>{
 const {harness}=require('./harness.cjs'),r=harness();
 const result=r(`(()=>[201,202,203,301].map(id=>{const t=DriftNFS.createTrack(Track,id),run=DriftSigns.prepare(t),d=DriftSignData[t.nfsSlug];return {count:run.signs.length,bad:run.signs.filter(p=>{const a=t.sample(p.x,p.y,p.ground).tang;return Math.sin(p.yaw)*Math.cos(a)+Math.cos(p.yaw)*Math.sin(a)>-.999}).length,removed:d.solidFaces.length};}))()`);
 assert.deepEqual(result.map(x=>x.count),[53,44,70,11]);for(const x of result){assert.equal(x.bad,0);assert(x.removed>20);}
});
test('only known signage is removed from static collision triangles',()=>{
 const {harness}=require('./harness.cjs'),r=harness();
 const rows=r(`(()=>[201,202,203,301].map(id=>{const t=DriftNFS.createTrack(Track,id),data=DriftNFSData[t.nfsSlug],excluded=new Set(DriftSignData[t.nfsSlug].solidFaces),solid=data.walls.filter((_,i)=>i%9===0).length;let count=0;for(let i=0;i<data.walls.length;i+=9)if(excluded.has(DriftSigns.faceKey(data.walls.slice(i,i+9))))count++;return {solid,count,any:DriftSigns.prepare(t).signs.length};}))()`);
 for(const x of rows){assert(x.count>40);assert(x.count<x.solid*.08);assert(x.any>0);}
});
test('imported sign collision faces no longer rebound the car; the unfiltered control does',()=>{
 const {harness}=require('./harness.cjs'),r=harness();
 const result=r(`(()=>{const source=DriftNFSData.rocky,keys=new Set(DriftSignData.rocky.solidFaces),walls=[];for(let i=0;i<source.walls.length;i+=9){const t=source.walls.slice(i,i+9);if(keys.has(DriftSigns.faceKey(t)))walls.push(...t);}DriftNFSData.rocky={...source,walls,ceilings:[]};DriftNFSData.redrock=DriftNFSData.rocky;
 const def=DriftSignData.rocky.signs[0],t=DriftNFS.createTrack(Track,202),control=DriftNFS.createTrack(Track,203),a=t.sample(def.x,def.y,def.ground).tang,c=Math.cos(a),s=Math.sin(a);
 function hit(tr){const car={pos:{x:def.x+c*6,y:def.y+s*6},_nfsPrevious:{x:def.x-c*6,y:def.y-s*6,angle:a},angle:a,vel:{x:c*40,y:s*40},ride:{height:def.ground},bodyDimensions:{length:4.4,width:1.9,height:1.4}};tr.constrainCar(car);return {speed:Math.hypot(car.vel.x,car.vel.y),x:car.pos.x,y:car.pos.y};}
 return {filtered:hit(t),control:hit(control),end:{x:def.x+c*6,y:def.y+s*6},count:walls.length/9};})()`);
 assert(result.count>100);assert(Math.abs(result.filtered.speed-40)<1e-9);assert(Math.hypot(result.filtered.x-result.end.x,result.filtered.y-result.end.y)<1e-6);assert(result.control.speed<39);
});
test('network snapshot objects keep a sweep by rival id without mutating packets',()=>{
 const {DriftSigns}=setup(),run=new DriftSigns.Run(track,[def]);run.step(1/60,[{...car(-6),id:'rival'}]);const packet={...car(6),id:'rival'},saved=JSON.stringify(packet);run.step(1/60,[packet]);assert(run.signs[0].hit);assert.equal(JSON.stringify(packet),saved);
});
test('front/back use distinct depth and winding; every sign lies flat after a hit',async()=>{
 const T=await import('../vendor/three.module.min.js'),{buildRoadSigns}=await import('../js/road-signs-scene.js'),ctx=setup();global.DriftSigns=ctx.DriftSigns;global.DriftSignData=ctx.DriftSignData;
 const t={...track,nfs:true,nfsSlug:'summit'},world=new T.Group(),m=new T.MeshBasicMaterial(),materials=new Map(ctx.DriftSignData.summit.signs.map(d=>[d.source,m])),scene=buildRoadSigns(t,world,materials);
 for(const group of scene.groups){const [front,back]=group.children;assert.equal(front.material.side,T.FrontSide);assert.equal(back.material.side,T.FrontSide);assert(front.geometry.attributes.position.getZ(0)>back.geometry.attributes.position.getZ(0));const n=front.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert(n.getZ(i)>.99);}
 const p=t.roadSigns.signs[0];p.hit=true;p.tilt=Math.PI/2;p.lift=.07;scene.update();world.updateMatrixWorld(true);
 const front=scene.groups[0].children[0],v=new T.Vector3();let lo=Infinity,hi=-Infinity;for(let i=0;i<front.geometry.attributes.position.count;i++){v.fromBufferAttribute(front.geometry.attributes.position,i).applyMatrix4(front.matrixWorld);lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);}assert(hi-lo<1e-4);assert(lo>=p.ground);
});
test('replay seeks before and after impacts without changing live signs or recording untouched objects',()=>{
 const {DriftReplay}=setup(),rec=new DriftReplay.Recorder(600),c=car(0,0),p={id:0,x:1,y:2,ground:0,lift:0,yaw:0,tilt:0,hit:false,settled:false};
 rec.reset({skin:'blue'});rec.capture(0,c,[],[],[p]);p.hit=true;rec.capture(.1,c,[],[],[p]);p.tilt=1;p.x=2;rec.capture(.2,c,[],[],[p]);p.tilt=Math.PI/2;p.x=3;p.settled=true;rec.capture(.3,c,[],[],[p]);for(let t=1;t<20;t++)rec.capture(t,c,[],[],[p]);
 // Replay's car contact construction needs the ordinary wheel offsets API.
 // The class above resolves globals in its own vm; install the same helper there.
 const own=setup();own.DriftRoadContact={wheelOffsets:()=>[]};const replay=new own.DriftReplay.Recorder();replay.reset({skin:'blue'});replay.capture(0,c,[],[],[]);replay.signChannels=rec.signChannels;replay.capture(.2,c);replay.capture(20,c);
 assert.equal(replay.sample(.05).signs.length,0);const before=JSON.stringify(p);assert(Math.abs(replay.sample(.15).signs[0].tilt-.5)<1e-9);assert.equal(replay.sample(10).signs[0].tilt,Math.PI/2);assert.equal(JSON.stringify(p),before);assert.equal(rec.signChannels.get(0).length,3);
});
