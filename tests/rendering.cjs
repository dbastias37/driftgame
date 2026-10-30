const {test}=require('node:test');const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const path=require('node:path');
function canvas(){
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(130)})};
  return {width:256,height:256,style:{},getContext:type=>type==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
}
test('actual 3D scene, all car models, cameras and geometry leave the simulation untouched',async()=>{
  global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
  const {DriftView3D}=await import(pathToFileURL(path.resolve(__dirname,'../js/view3d.js')));
  const oldError=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null});}finally{console.error=oldError;}
  const points=Array.from({length:100},(_,i)=>({x:100*Math.cos(i/100*Math.PI*2),y:100*Math.sin(i/100*Math.PI*2)}));
  const track={points,roadHalf:14,bounds:{minX:-100,minY:-100,w:200,h:200},point(i){return points[(i+100)%100]},normalAt(i){const p=this.point(i-1),q=this.point(i+1),d=Math.hypot(q.x-p.x,q.y-p.y);return{x:-(q.y-p.y)/d,y:(q.x-p.x)/d}},tangentAt(i){const p=this.point(i),q=this.point(i+1);return Math.atan2(q.y-p.y,q.x-p.x)},nearestIndex(x,y){let best=0,d=Infinity;points.forEach((p,i)=>{const n=Math.hypot(x-p.x,y-p.y);if(n<d){best=i;d=n}});return best}};
  const player={pos:{x:100,y:0},angle:Math.PI/2,omega:.3,steerAngle:.1,handbrake:false,smoke:[{x:100,y:-1,life:.4}],tireTrails:[{x1:99,y1:0,x2:101,y2:0,a:.3},{x1:99,y1:1,x2:101,y2:1,a:.3}],worldSpeed:()=>10};
  const before=JSON.stringify({track,player});
  const timings=[];for(const skin of ['blue','red','yellow','gray'])for(const camera of ['chase','aerial','hood']){const t=performance.now();view.render({track,player,skin,camera,dt:1/60});timings.push(performance.now()-t);assert.equal(JSON.stringify({track,player}),before);assert.ok(view.renderer.frame.data.some((v,i)=>i%4===0&&v!==159),'Scene contains rendered pixels');}
  let triangles=0;view.scene.traverse(o=>{if(o.geometry){const p=o.geometry.attributes.position;assert.ok(Array.from(p.array).every(Number.isFinite));triangles+=(o.geometry.index?.count||p.count)/3;}});assert.ok(triangles>500);
  const oldWorld=view.world.children[0];view.render({track:{...track,roadHalf:8},player,dt:1/60});assert.ok(!view.world.children.includes(oldWorld));
  view.dispose();console.log('Software renderer frame ms (median):',Math.round(timings.sort((a,b)=>a-b)[6]));
});
test('two online rivals use separate models, steering and wheel motion; leaving disposes them',async()=>{
  global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
  const {DriftView3D}=await import('../js/view3d.js'),{createTrack,createCar}=await import('../server/engine.js');
  const oldError=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null});}finally{console.error=oldError;}
  const track=createTrack(1),player=createCar(track,'blue',true,0),rivals=['red','gray'].map((skin,i)=>Object.assign(createCar(track,skin,true,i+1),{id:String(i),skin,name:'Rival '+i}));rivals[0].steerAngle=.2;rivals[0].vel.x=12;
  const before=JSON.stringify(rivals);view.render({track,player,rivals,dt:1/60});assert.equal(view.rivalModels.size,2);assert.equal(JSON.stringify(rivals),before);
  const model=view.rivalModels.get('0');assert.notEqual(model.root,view.car.root);assert.equal(model.wheels.find(w=>w.front).steer.rotation.y,-.2);assert.notEqual(model.wheels[0].spin.rotation.z,0);
  const oldRoots=[...view.rivalModels.values()].map(m=>m.root);view.render({track,player,rivals:[],dt:1/60});assert.equal(view.rivalModels.size,0);assert(oldRoots.every(root=>!view.scene.children.includes(root)));view.dispose();
});
test('cinematic cameras, recorded wheel rotation and visual impulse do not mutate the race or clip under mountains',async()=>{
 global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
 const {DriftView3D}=await import('../js/view3d.js'),{createTrack,createCar}=await import('../server/engine.js');await import('../js/downhill.js');
 const oldError=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null});}finally{console.error=oldError;}
 try{const flat=createTrack(1),track=DriftDownhill.createTrack(flat.constructor,5),player=createCar(track,'blue',true,0);DriftDownhill.reset(track,player,'blue');player.wheelTravel=24;const before=JSON.stringify(player);
 for(const camera of ['drone','cinematic','trackside','isometric'])for(const time of [2,8,15]){view.resetCamera();view.render({track,player,camera,dt:1/60,time,impulse:.7,replay:true});assert.equal(JSON.stringify(player),before);assert.ok(view.camera.position.y>=track.terrainHeight(view.camera.position.x,view.camera.position.z)+1.79);assert.ok(Number.isFinite(view.screenFocus.x));assert.ok(Number.isFinite(view.screenFocus.y));assert.equal(view.car.wheels[0].spin.rotation.z,-24/(view.car.wheels[0].radius||.36));}
 view.resetCamera();view.render({track,player,camera:'chase',dt:1/60,impulse:0});const fov=view.camera.fov;view.render({track,player,camera:'chase',dt:1/60,impulse:.7});assert.ok(view.camera.fov>fov);assert.equal(JSON.stringify(player),before);
 }finally{view.dispose();}
});

test('exhibition renders three moving cars and preserves the recording across cinematic cuts',async()=>{
 global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
 const {DriftView3D}=await import('../js/view3d.js'),{createTrack}=await import('../server/engine.js');await import('../js/replay.js');await import('../js/attract-demo.js');
 const oldError=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null});}finally{console.error=oldError;}
 try{const demo=new DriftAttract.Demo(createTrack(3),{day:1}),shots=new Set(),positions=[];
 for(const time of [0,7,14,21]){demo.time=time;const frame=demo.frame(0),before=JSON.stringify(frame);view.render({...frame,skin:frame.player.skin,camera:'demo',inMenu:true,dt:1/30,timeOfDay:1});assert.equal(view.rivalModels.size,2);assert.equal(JSON.stringify(frame),before);shots.add(view.cinematicLabel);positions.push([view.car.root.position.x,view.car.root.position.z]);assert.ok(Number.isFinite(view.screenFocus.x));}
 assert.equal(shots.size,3);assert.notDeepEqual(positions[0],positions[1]);assert.ok(view.car.wheels.every(w=>Number.isFinite(w.spin.rotation.z)));
 }finally{view.dispose();}
});

test('workshop neon and smoke render without extra lights or particle allocations and reset for stock cars',async()=>{
 global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
 const {DriftView3D}=await import('../js/view3d.js'),{createTrack,createCar}=await import('../server/engine.js');
 const oldError=console.error;console.error=()=>{};let v;try{v=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null});}finally{console.error=oldError;}
 const tr=createTrack(1),p=createCar(tr,'blue',true,0);p.cosmetics={neon:'#c58bff',smokeVolume:3,smokeColor:'#82ed9b'};p.smoke=Array.from({length:700},()=>({x:p.pos.x,y:p.pos.y,life:.4}));const array=v.smokePos;
 v.render({track:tr,player:p,dt:1/60});assert(v.car.neon.visible);assert.equal(v.car.neon.material.color.getHexString(),'c58bff');assert.equal(v.smokeMat.color.getHexString(),'82ed9b');assert.equal(v.smokeMat.size,2.8*Math.sqrt(3));assert.equal(v.smokePos,array);assert(v.smokeGeo.drawRange.count<=450);assert.notEqual(v.car.neon.material.map,v.smokeTexture);
 const root=v.car.root;p.cosmetics={};v.render({track:tr,player:p,dt:1/60});assert.equal(v.car.root,root);assert.equal(v.car.neon.visible,false);assert.equal(v.smokeMat.size,2.8);v.dispose();
});
