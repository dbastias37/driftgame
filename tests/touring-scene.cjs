const {test}=require('node:test'),assert=require('node:assert/strict');
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};return {width:256,height:256,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}

test('four climate road ribbons match wheel support; bridges and tunnel portals have a clear carriageway',async()=>{
  global.document={createElement:canvas};
  const T=await import('../vendor/three.module.min.js'),{buildTouring}=await import('../js/touring-scene.js'),{Track}=await import('../server/engine.js');await import('../js/road-expeditions.js');await import('../js/touring-circuits.js');await import('../js/road-contact.js');
  const {disposeGroup}=await import('../js/view3d.js');
  for(const id of Array.from({length:20},(_,i)=>i+1)){
    const track=DriftTouring.createTrack(Track,id),world=new T.Group(),started=performance.now();buildTouring(track,world,true);world.updateMatrixWorld(true);
    const road=[],tunnels=[],bridges=[],terrain=[];let triangles=0;
    world.traverse(o=>{if(!o.geometry)return;const positions=o.geometry.attributes.position;assert(Array.from(positions.array).every(Number.isFinite));triangles+=(o.geometry.index?.count||positions.count)/3*(o.count||1);if(o.name==='touring-road')road.push(o);if(o.name.includes('tunnel')||o.name.includes('portal')||o.name==='touring-mountain-face')tunnels.push(o);if(o.name.includes('bridge')||o.name.includes('truss')||o.name.includes('spandrel'))bridges.push(o);if(o.name==='mountain-terrain')terrain.push(o);});
    assert(tunnels.length>15);assert(bridges.length>5);assert(terrain.length>20);assert(triangles<3000000,'Full + distant vegetation buffers stay bounded');
    const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);let maxError=0;
    for(let s=1;s<track.length;s+=73)for(const offset of [-10,0,10]){
      const p=track.ribbonPoint(s,offset);ray.set(new T.Vector3(p.x,p.h+2,p.y),down);const hits=ray.intersectObjects(road,false);assert(hits.length,`Road gap at ${id}:${s}:${offset}`);const error=Math.abs(hits[0].point.y-track.surfaceHeight(p.x,p.y));maxError=Math.max(maxError,error);assert(error<.035,`Visual/physics height mismatch ${error}`);
      const groundHits=ray.intersectObjects(terrain,false);assert(!groundHits.length||groundHits[0].point.y<p.h-.05,'Terrain intrudes through asphalt');
    }
    for(const f of track.features)for(let s=f.start;s<=f.end;s+=17)for(const offset of [-10,0,10]){
      const p=track.ribbonPoint(s,offset);ray.set(new T.Vector3(p.x,p.h+.15,p.y),new T.Vector3(0,1,0));const hits=ray.intersectObjects(f.kind==='tunnel'?tunnels:bridges,false);assert(!hits.length||hits[0].distance>5.5,`Structure intersects driving clearance at ${id}:${s}:${offset}`);
    }
    const {batchWorld,updateWorldVisibility}=await import('../js/world-optimization.js');batchWorld(world);let maxVisibleTriangles=0;
    const camera=new T.PerspectiveCamera();
    for(let s=0;s<track.length;s+=track.length/12){const p=track.atDistance(s);camera.position.set(p.x,p.h+5,p.y);updateWorldVisibility(world,camera,440);let drawn=0;world.traverse(o=>{if(o.isMesh&&o.visible)drawn+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count||1);});maxVisibleTriangles=Math.max(maxVisibleTriangles,drawn);}
    assert(maxVisibleTriangles<650000,'Visible scene exceeds triangle budget');
    console.log('Touring scene:',JSON.stringify({id,triangles,maxVisibleTriangles,maxError,buildAndChecksMs:Math.round(performance.now()-started)}));disposeGroup(world);
  }
});

test('elevated scene places cars, wheels, skid marks and cameras at road height',async()=>{
  global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
  const {DriftView3D}=await import('../js/view3d.js'),{Track,createCar}=await import('../server/engine.js');await import('../js/road-expeditions.js');await import('../js/touring-circuits.js');
  const error=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null});}finally{console.error=error;}
  // Scene construction and camera transforms are exercised without a browser;
  // browser QA separately checks the actual pixels and menu interactions.
  view.retro.render=()=>{};
  const track=DriftTouring.createTrack(Track,1),player=createCar(track,'blue',true,0),tunnel=track.features.find(f=>f.kind==='tunnel');
  try{for(const distance of [20,track.length*.22,tunnel.start+50,track.length*.73]){
    const p=track.atDistance(distance);player.pos={x:p.x,y:p.y};player.angle=track.tangentAt(p.i);player.ride=null;player.tireTrails=[{x1:p.x,y1:p.y,x2:p.x,y2:p.y},{x1:p.x+.2,y1:p.y,x2:p.x+.2,y2:p.y}];
    for(const camera of ['chase','hood','aerial','drone','trackside']){view.resetCamera();view.render({track,player,camera,dt:1/60,time:20});assert(Math.abs(view.car.root.position.y-track.surfaceHeight(p.x,p.y))<.05);assert(Number.isFinite(view.camera.position.y));assert(view.trailPos[1]>track.minHeight-.1);if(distance===tunnel.start+50){const q=track.sample(view.camera.position.x,view.camera.position.z);assert(q.distance<track.tunnelHalf);assert(view.camera.position.y-track.surfaceHeight(view.camera.position.x,view.camera.position.z)<22.1);}}
  }}finally{view.dispose();}
});

test('rain follows an elevated bridge deck and stops inside a tunnel',async()=>{
  global.document={createElement:canvas};
  const T=await import('../vendor/three.module.min.js'),{WeatherEffects}=await import('../js/weather.js'),{Track}=await import('../server/engine.js');await import('../js/road-expeditions.js');await import('../js/touring-circuits.js');
  const track=DriftTouring.createTrack(Track,2),scene=new T.Scene(),world=new T.Group(),camera=new T.PerspectiveCamera(),weather=new WeatherEffects(scene);
  const bridge=track.features.find(f=>f.kind==='bridge'),tunnel=track.features.find(f=>f.kind==='tunnel'),p=track.atDistance((bridge.start+bridge.end)/2);
  camera.position.set(p.x,p.h+4,p.y);const ahead=track.atDistance(p.s+10);camera.lookAt(ahead.x,ahead.h+1,ahead.y);camera.updateMatrixWorld(true);
  try{
    weather.update({camera,world,track,weather:'rain',time:3});assert(weather.root.visible);assert(weather.geometry.drawRange.count>0);
    for(let i=0;i<weather.geometry.drawRange.count;i++){const x=weather.positions[i*3],h=weather.positions[i*3+1],z=weather.positions[i*3+2],q=track.sample(x,z);if(q.distance<track.roadHalf)assert(h>=track.surfaceHeight(x,z)-.05,'Rain is being emitted below the bridge');}
    const inside=track.atDistance((tunnel.start+tunnel.end)/2);camera.position.set(inside.x,inside.h+4,inside.y);weather.update({camera,world,track,weather:'rain',time:4});assert.equal(weather.root.visible,false);
  }finally{weather.dispose();}
});

test('snow emits finite flakes outdoors and clears them inside a tunnel without changing grip',async()=>{
  global.document={createElement:canvas};
  const T=await import('../vendor/three.module.min.js'),{WeatherEffects}=await import('../js/weather.js'),{Track}=await import('../server/engine.js');await import('../js/road-expeditions.js');await import('../js/touring-circuits.js');
  const track=DriftTouring.createTrack(Track,16),scene=new T.Scene(),world=new T.Group(),camera=new T.PerspectiveCamera(),weather=new WeatherEffects(scene),p=track.atDistance(80);
  camera.position.set(p.x,p.h+5,p.y);const ahead=track.atDistance(100);camera.lookAt(ahead.x,ahead.h+1,ahead.y);camera.updateMatrixWorld();
  weather.update({camera,world,track,weather:'snow',time:4});assert(weather.root.visible);assert.equal(weather.rain.name,'snow-flakes');assert(weather.geometry.drawRange.count>0);assert(weather.positions.every(Number.isFinite));assert.equal(DriftOptions.weathers.snow.grip,DriftOptions.weathers.clear.grip);
  const tunnel=track.features.find(f=>f.kind==='tunnel'),q=track.atDistance((tunnel.start+tunnel.end)/2);camera.position.set(q.x,q.h+5,q.y);weather.update({camera,world,track,weather:'snow',time:5});assert.equal(weather.root.visible,false);weather.dispose();
});
