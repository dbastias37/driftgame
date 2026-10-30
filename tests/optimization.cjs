const{test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createRadialGradient:()=>({addColorStop(){}}),drawImage(){},fillRect(){},fillText(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};return {width:128,height:128,clientWidth:640,clientHeight:400,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}
class Track{constructor(points){this.points=points;const x=points.map(p=>p.x),y=points.map(p=>p.y);this.bounds={minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y)};this.bounds.w=this.bounds.maxX-this.bounds.minX;this.bounds.h=this.bounds.maxY-this.bounds.minY;}}
async function setup(){global.document={createElement:canvas};global.innerWidth=640;global.innerHeight=400;global.devicePixelRatio=1;await import('../js/road-contact.js');await import('../js/downhill.js');return import('../vendor/three.module.min.js');}
test('mountain terrain has no faces inside the actual shoulder footprint; chunks disappear only beyond opaque fog',async()=>{
 const T=await setup(),{buildMountain}=await import('../js/mountain-scene.js'),{updateWorldVisibility}=await import('../js/world-optimization.js');
 for(let level=1;level<=3;level++){
  const track=DriftDownhill.createTrack(Track,level),world=new T.Group();buildMountain(track,world,false);world.updateMatrixWorld(true);
  assert.ok(world.userData.chunks.length<650);const terrain=[];world.traverse(o=>{if(o.name==='mountain-terrain')terrain.push(o);});
  const ray=new T.Raycaster();for(let s=10;s<track.length-10;s+=13){const p=track.atDistance(s),n=track.normalAt(p.i);for(const offset of[-track.roadHalf,0,track.roadHalf]){ray.set(new T.Vector3(p.x+n.x*offset,1000,p.y+n.y*offset),new T.Vector3(0,-1,0));assert.equal(ray.intersectObjects(terrain).length,0,`Terrain pierces route ${level} at ${s}`);}}
  const camera=new T.PerspectiveCamera(58,1,.3,520);camera.position.set(track.points[0].x,track.points[0].h+6,track.points[0].y);
  updateWorldVisibility(world,camera,290);const visible=world.userData.visibleChunks;assert.ok(visible<world.userData.chunks.length*.65);
  for(const o of world.userData.chunks)if(!o.visible){const sphere=(o.isInstancedMesh?o.boundingSphere:o.geometry.boundingSphere).clone().applyMatrix4(o.matrixWorld);assert.ok(camera.position.distanceTo(sphere.center)-sphere.radius>=302);}
  updateWorldVisibility(world,camera,290,true);assert.equal(world.userData.visibleChunks,world.userData.chunks.length);
  console.log(`Route ${level}: ${world.userData.chunks.length} chunks, ${visible} inside driving distance`);
 }
});
test('far-terrain acceleration preserves the original height equation',async()=>{
 await setup();const tr=DriftDownhill.createTrack(Track,3);for(let x=-400;x<400;x+=23)for(let y=-150;y<1000;y+=27){const q=tr.sample(x,y),t=Math.max(0,Math.min(1,(q.distance-tr.roadHalf-1.3)/30)),expected=q.h+(tr.baseHeight(x,y)-q.h)*t*t*(3-2*t);assert.ok(Math.abs(expected-tr.terrainHeight(x,y))<1e-10);}
});
test('day/night is continuous, preserves simulation state, and limits lighting to one shadowless spotlight',async()=>{
 await setup();const {DriftView3D}=await import('../js/view3d.js'),{atmosphereAt}=await import('../js/atmosphere.js');
 let old=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null});}finally{console.error=old;}
 const track=DriftDownhill.createTrack(Track,1),p=track.atDistance(150),player={pos:{x:p.x,y:p.y},angle:track.tangentAt(p.i),omega:0,steerAngle:0,vel:{x:10,y:0},worldSpeed:()=>10,smoke:[],tireTrails:[]};
 const before=JSON.stringify(player);let dayFrame;
 for(const timeOfDay of[0,.5,1]){view.render({track,player,timeOfDay,dt:1/60});assert.equal(JSON.stringify(player),before);assert.equal(view.atmosphere.beams.visible,timeOfDay>0);assert.ok(view.camera.near<view.camera.far);if(timeOfDay===0)dayFrame=view.renderer.frame.data.slice();}
 assert.notDeepEqual(view.renderer.frame.data,dayFrame);let spotlights=0;view.scene.traverse(o=>{if(o.isSpotLight){spotlights++;assert.equal(o.castShadow,false);}});assert.equal(spotlights,1);
 for(let t=0;t<1;t+=.01){const a=atmosphereAt(t),b=atmosphereAt(t+.001);assert.ok(Math.abs(a.night-b.night)<.01);assert.ok(Math.abs(a.ambient-b.ambient)<.02);}
 // Stationary old skid segments only query terrain on their first appearance.
 player.tireTrails=Array.from({length:120},(_,i)=>({x1:p.x+i*.08,y1:p.y-.8,x2:p.x+i*.08,y2:p.y+.8}));let queries=0;const sample=track.surfaceHeight;track.surfaceHeight=(...args)=>{queries++;return sample(...args);};view.effects(player);const first=queries;queries=0;view.effects(player);assert.ok(first>1000);assert.equal(queries,0);view.dispose();
});
test('sixth Fujiwara selection survives downhill setup, view switching, restart and recovery',()=>{
 const r=harness();r("$('#btnModeDownhill').click();confirmTrackPreview();carIdx=4;$('#carNext').click();$('#btnChooseStart').click();state='running';");assert.equal(r('chosen.sprite'),'fujiwara');assert.equal(r('CAR_DATA.length'),6);const before=r('JSON.stringify(player)');r("renderPrefs.timeOfDay=1;setRenderView('2d');setRenderView('3d')");assert.equal(r('JSON.stringify(player)'),before);r('loseLifeAndRespawn()');assert.equal(r('chosen.sprite'),'fujiwara');assert.equal(r('player.bodyDimensions.length'),4.215);assert.equal(r('DriftRoadContact.wheelOffsets(chosen.sprite)[2].x'),1.275775);r('restartRaceSameTrack()');assert.equal(r('chosen.sprite'),'fujiwara');const trails=r("(()=>{player.pos={x:0,y:0};player.spawnTrails({x:1,y:0},{x:0,y:1},1/60,.5);return player.tireTrails.at(-1)})()");assert.ok(Math.abs(trails.x1+1.122379)<1e-6);assert.ok(Math.abs(trails.y1+.729235)<1e-6);
});
test('paused rendering sleeps, refreshes changed lighting, and resumes without changing simulation time',()=>{
 const r=harness();r("startWithTrack(presetTrack(1),'race');state='paused';renderPreparationPreview=()=>false;var frames=[];sceneView={car:{},render(frame){frames.push({dt:frame.dt,timeOfDay:frame.timeOfDay})}};loop(2000);loop(2016);loop(2032)");assert.equal(r('frames.length'),1);assert.equal(r('frames[0].dt'),0);const time=r('raceTime');r('renderPrefs.timeOfDay=1;loop(2050)');assert.equal(r('frames.length'),2);assert.equal(r('frames[1].timeOfDay'),1);assert.equal(r('raceTime'),time);r("state='running';loop(2067);loop(2084)");assert.equal(r('frames.length'),4);assert.ok(r('raceTime')>time);
});
