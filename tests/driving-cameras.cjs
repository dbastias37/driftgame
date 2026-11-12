const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
function canvas(){
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};
  return {width:256,height:144,clientWidth:800,clientHeight:500,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
}
const noLoad={loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null,loadBarracudaVehicle:null,loadExtraVehicle:null};
const loaded=(async()=>{
  global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=500;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:1,height:1});
  const {DriftView3D}=await import('../js/view3d.js'),{createTrack,createCar}=await import('../server/engine.js');
  const read=file=>{const b=fs.readFileSync('assets/models/'+file+'.glb');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
  const {parseRX7}=await import('../js/rx7-model.js'),{parseYugo}=await import('../js/yugo-model.js'),{parseFujiwara}=await import('../js/fujiwara-model.js'),{parseReplacement}=await import('../js/replacement-model.js');
  const templates={yellow:await parseRX7(read('rx7-fd-redsuns')),yugo:await parseYugo(read('yugo-koral-55-pixel')),fujiwara:await parseFujiwara(read('ae86-fujiwara'))};
  for(const [key,file] of Object.entries({blue:'nissan-skyline-r34',gray:'chevrolet-nova-ss',barracuda:'plymouth-barracuda',subaru:'subaru-impreza-s206',bmw:'bmw-m3-gtr',shelby:'shelby-gt500',mustang:'mustang-gt-fastback'}))templates[key]=await parseReplacement(read(file),key);
  return {DriftView3D,createTrack,createCar,templates};
})();
async function setup(){
  const {DriftView3D,createTrack,createCar,templates}=await loaded,old=console.error;let view;
  console.error=()=>{};try{view=new DriftView3D(canvas(),noLoad);}finally{console.error=old;}
  Object.assign(view,{rx7Template:templates.yellow,yugoTemplate:templates.yugo,fujiwaraTemplate:templates.fujiwara,skylineTemplate:templates.blue,novaTemplate:templates.gray,barracudaTemplate:templates.barracuda});
  for(const key of ['subaru','bmw','shelby','mustang'])view.extraTemplates.set(key,templates[key]);
  // Exercise the production model placement and camera pipeline without spending
  // the test on rasterization of scenery. Geometry/loading have their own tests.
  view.retro.render=()=>{};view.build=function(track){this.track=track;};
  const track=createTrack(1),player=createCar(track,'yellow',true,0);
  player.ride={height:0,roll:0,pitch:0,wheels:[]};player.cosmetics={};
  return {view,track,player,templates};
}
const snapshot=view=>[...view.camera.position.toArray(),...view.camera.quaternion.toArray(),...view.look.toArray(),view.camera.fov];
test('all ten loaded cars share trajectory follow through turns, drift, stopping, reverse and angle wrapping',async()=>{
  const {view,track,player,templates}=await setup();
  try{
    let reference;
    for(const skin of Object.keys(templates)){
      view.resetCamera();const frames=[];player.pos={x:0,y:0};
      for(let i=0;i<90;i++){
        const angle=3+i*.018,speed=i<50?25:i<70?(69-i)*1.25:-Math.min(6,(i-69)*.5);
        player.angle=Math.atan2(Math.sin(angle),Math.cos(angle));player.vel={x:Math.cos(angle+.4)*speed,y:Math.sin(angle+.4)*speed};
        player.pos.x+=player.vel.x/60;player.pos.y+=player.vel.y/60;
        const before=JSON.stringify(player);view.render({track,player,skin,dt:1/60});
        assert.equal(JSON.stringify(player),before);assert(view.car.imported,skin);frames.push(snapshot(view));
        const behind=(view.camera.position.x-player.pos.x)*Math.cos(angle+.4)+(view.camera.position.z-player.pos.y)*Math.sin(angle+.4);
        assert(behind<0,`${skin} camera must remain behind the travel axis`);
      }
      if(!reference)reference=frames;else assert.deepEqual(frames,reference,`${skin} differs from RX-7`);
    }
  }finally{view.dispose();}
});
test('sustained drift and countersteer rotate the car, not the follow view, on mobile and desktop including reduced motion',async()=>{
  const {view,track,player}=await setup();
  try{
    for(const [width,height] of [[1280,720],[390,844]])for(const motion of ['full','reduced']){
      view.canvas.clientWidth=width;view.canvas.clientHeight=height;
      let straight;
      for(const drift of [0,Math.PI/4,-Math.PI/3,Math.PI*.95]){
        view.resetCamera();const frames=[];
        for(let i=0;i<60;i++){
          player.pos={x:i/3,y:0};player.vel={x:20,y:0};player.angle=drift*Math.sin(i/60*Math.PI/2);
          player.steerAngle=-player.angle*.2;
          view.render({track,player,skin:'subaru',dt:1/60,motion});frames.push(snapshot(view));
          assert(Math.abs(view.yaw)<1e-10,'body yaw must not steer the follow camera');
          assert.equal(view.car.root.rotation.y,-player.angle,'the rendered body must still rotate');
        }
        if(!straight)straight=frames;else assert.deepEqual(frames,straight,`${width} / ${motion} / ${drift}`);
      }
    }
  }finally{view.dispose();}
});
test('travel heading turns smoothly at different frame rates, ignores zero-speed noise and handles reverse without a half-turn',async()=>{
  const {ChaseHeading}=await import('../js/driving-cameras.js');
  const difference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))),final=[];
  for(const hz of [20,30,60,120]){
    const follow=new ChaseHeading(),player={angle:0,vel:{x:20,y:0}};
    assert.equal(follow.update(player,1/hz),0);player.vel={x:0,y:20};
    let previous=0;
    for(let i=0;i<hz;i++){const yaw=follow.update(player,1/hz);assert(yaw>=previous);assert(yaw-previous<.26);previous=yaw;}
    assert(difference(previous,Math.PI/2)<.05);final.push(previous);
    for(let i=0;i<50;i++){player.angle=i*.3;player.vel={x:Math.sin(i)*.2,y:Math.cos(i)*.2};assert.equal(follow.update(player,1/hz),previous);}
    player.vel={x:-20,y:0};assert.equal(follow.update(player,0),previous,'pause must freeze yaw');
  }
  assert(Math.max(...final)-Math.min(...final)<1e-10,'smoothing must not depend on FPS');
  const follow=new ChaseHeading(),player={angle:0,vel:{x:0,y:0}};follow.update(player,0);
  for(const sign of [1,-1,1]){
    for(let i=0;i<=120;i++){player.vel.x=sign*Math.min(6,i*.1);assert(difference(follow.update(player,1/60),0)<1e-10);}
    for(let i=60;i>=0;i--){player.vel.x=sign*i*.1;assert(difference(follow.update(player,1/60),0)<1e-10);}
  }
  follow.reset();player.vel.x=-6;assert(difference(follow.update(player,0),0)<1e-10,'replay seek into reverse');
  follow.reset();player.angle=0;player.vel={x:-20,y:.01};const before=follow.update(player,0);player.vel.y=-.01;
  assert(difference(follow.update(player,1/60),before)<.01,'crossing ±PI must not orbit the long way');
});
test('switching cars or leaving a cinematic immediately reacquires the rear; a same-car async refresh does not snap',async()=>{
  const {view,track,player}=await setup();
  try{
    const frame=(skin,camera='chase')=>view.render({track,player,skin,camera,dt:1/60,time:7});
    frame('yellow');player.angle+=Math.PI;player.pos.x+=100;frame('subaru');
    let forward={x:Math.cos(player.angle),z:Math.sin(player.angle)};
    assert((view.camera.position.x-player.pos.x)*forward.x+(view.camera.position.z-player.pos.y)*forward.z<0);
    const position=view.camera.position.clone(),yaw=view.yaw;view.setSkin('subaru',true);
    assert(view.cameraReady);assert(view.camera.position.equals(position));assert.equal(view.yaw,yaw);
    frame('bmw','drone');player.angle+=Math.PI;frame('bmw');
    forward={x:Math.cos(player.angle),z:Math.sin(player.angle)};
    assert((view.camera.position.x-player.pos.x)*forward.x+(view.camera.position.z-player.pos.y)*forward.z<0);
    assert.equal(view.yaw,player.angle);assert.equal(view.cinematicLabel,'');
  }finally{view.dispose();}
});
test('every car starts offline and online with original follow framing even after another saved camera or zoom',()=>{
  const run=harness();
  const results=run(`(()=>{
    const results=[];sceneView={cameraZoom:{chase:2.2,hood:.8},distance:2.2,resetCamera(){this.resets=(this.resets||0)+1;}};
    for(let i=0;i<CAR_DATA.length;i++)for(const kind of ['race','tt','challenge','downhill','training','online']){
      carIdx=i;chosen=CAR_DATA[i];renderPrefs.camera='drone';sceneView.cameraZoom.chase=2.2;sceneView.distance=2.2;
      const road=kind==='downhill'?DriftDownhill.createTrack(Track,1):kind==='training'?DriftTraining.create(Track):presetTrack(1);
      startWithTrack(road,kind);
      results.push({skin:chosen.sprite,kind,camera:renderPrefs.camera,zoom:sceneView.cameraZoom.chase,distance:sceneView.distance,saved:JSON.parse(localStorage.getItem(PREF_KEY)).camera});
    }
    return results;
  })()`);
  assert.equal(results.length,60);
  for(const result of results){assert.equal(result.camera,'chase',JSON.stringify(result));assert.equal(result.zoom,1);assert.equal(result.distance,1);assert.equal(result.saved,'chase');}
  run("state='running';$('#cameraSetting').emit('change',{target:{value:'hood'}});setPaused(true);setPaused(false)");
  assert.equal(run('renderPrefs.camera'),'hood','manual views still work during a race');
});
