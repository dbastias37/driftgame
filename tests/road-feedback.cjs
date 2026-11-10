const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
const pose=speed=>({pos:{x:3,y:7},angle:.2,vel:{x:speed,y:0},worldSpeed:()=>speed});
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(130)})};return {width:256,height:144,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}
test('road vibration grows with speed, stays subtle, samples deterministically and vanishes at rest or reduced motion',async()=>{
 const {roadFeedback}=await import('../js/road-feedback.js');const rms=speed=>Math.sqrt(Array.from({length:120},(_,i)=>roadFeedback(pose(speed),i/60,{vehicle:1,camera:1}).heave**2).reduce((a,b)=>a+b)/120);
 assert(rms(50)>rms(10)*4);assert(rms(50)<.012);assert.deepEqual(roadFeedback(pose(40),3),roadFeedback(pose(40),3));
 for(const settings of [{vehicle:0,camera:0},{reduced:true}]){const v=roadFeedback(pose(50),3,settings);assert.equal(Math.abs(v.heave)+Math.abs(v.cameraPitch)+Math.abs(v.roll)+v.wheels.reduce((a,b)=>a+b),0);}
 assert.equal(Math.abs(roadFeedback(pose(0),3).heave),0);const p=pose(50);p.descent={motion:'falling'};assert.equal(Math.abs(roadFeedback(p,3).heave),0);
 const cameraOnly=roadFeedback(pose(50),3,{vehicle:0,camera:2});assert.equal(Math.abs(cameraOnly.heave),0);assert(Math.abs(cameraOnly.cameraPitch)>0);assert(Math.abs(cameraOnly.cameraPitch)<.0041);
});
test('vibration sliders persist independently including zero without changing the physical car',()=>{
 const r=harness();r("startWithTrack(presetTrack(1),'race');var before=JSON.stringify(player);$('#vehicleVibration').emit('input',{target:{value:'0'}});$('#cameraVibration').emit('input',{target:{value:'175'}})");assert.equal(r('renderPrefs.vehicleVibration'),0);assert.equal(r('renderPrefs.cameraVibration'),1.75);assert.equal(r('JSON.parse(localStorage.getItem(PREF_KEY)).vehicleVibration'),0);assert.equal(r("$('#vehicleVibrationLabel').textContent"),'0%');assert(r('before===JSON.stringify(player)'));
});
test('pixel vectors are bounded scene geometry, scale opacity and are occluded by foreground scenery',async()=>{
 global.document={createElement:canvas};const T=await import('../vendor/three.module.min.js'),{SceneSpeedLines}=await import('../js/scene-speed-lines.js'),{SoftwareRenderer}=await import('../js/software-renderer.js');await import('../js/game-options.js');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,16/9,.1,100),vectors=new SceneSpeedLines(scene);camera.updateMatrixWorld();scene.background=new T.Color(0x102030);
 const renderer=new SoftwareRenderer(canvas());renderer.setSize(256,144);renderer.setRetro(DriftOptions.retro(DriftOptions.presets.psx));
 const run=intensity=>vectors.update(camera,{mode:'center',amount:1,time:1,intensity});run(0);assert.equal(vectors.geometry.drawRange.count,0);run(.5);const alpha=vectors.colors[3];run(2);assert(vectors.colors[3]>alpha);assert.equal(vectors.mesh.material.depthTest,true);assert(vectors.geometry.drawRange.count<=56*3);
 const buffer=vectors.positions;run(2);assert.equal(vectors.positions,buffer);renderer.render(scene,camera);const visible=renderer.frame.data.slice();
 const wall=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshBasicMaterial({color:0x223344}));wall.position.z=-1;scene.add(wall);renderer.render(scene,camera);const masked=renderer.frame.data.slice();vectors.mesh.visible=false;renderer.render(scene,camera);assert.deepEqual(renderer.frame.data,masked);assert.notDeepEqual(visible,masked);
 vectors.update(camera,{mode:'center',amount:1,intensity:2,reduced:true});assert.equal(vectors.mesh.visible,false);assert(!fs.readFileSync('index.html','utf8').includes('driftEffect.draw('));renderer.dispose();
});
test('dust appears inside nearby lamp light volumes at night, freezes by time and uses fixed buffers',async()=>{
 const T=await import('../vendor/three.module.min.js'),{LampDust}=await import('../js/lamp-dust.js'),scene=new T.Scene(),camera=new T.PerspectiveCamera(),dust=new LampDust(scene);camera.updateMatrixWorld();const street={lamps:[{light:{position:new T.Vector3(0,8,-10)}},{light:{position:new T.Vector3(500,8,0)}}]};
 dust.update(camera,street,0,{night:0});assert.equal(dust.mesh.visible,false);dust.update(camera,street,1,{night:1});assert.equal(dust.geometry.drawRange.count,28*6);const before=dust.positions.slice(),buffer=dust.positions;dust.update(camera,street,2,{night:1});assert.notDeepEqual(dust.positions,before);const frozen=dust.positions.slice();dust.update(camera,street,2,{night:1});assert.deepEqual(dust.positions,frozen);assert.equal(dust.positions,buffer);assert.equal(dust.material.depthTest,true);for(let i=1;i<28*18;i+=3)assert(dust.positions[i]>.5&&dust.positions[i]<8);
 dust.update(camera,street,2,{night:1,low:true});assert.equal(dust.geometry.drawRange.count,12*6);
});
test('all circuit and downhill tyre placements are deterministic, sparse and clear of the starting line',()=>{
 const r=harness();const layouts=r(`Array.from({length:40},(_,i)=>{const t=i<20?presetTrack(i+1):DriftDownhill.createTrack(Track,i-19),a=DriftTrackProps.spawns(t),b=DriftTrackProps.spawns(t),start=t.point(0);return {n:a.length,units:a.reduce((n,p)=>n+p.count,0),counts:a.every(p=>[3,4,5].includes(p.count)),same:JSON.stringify(a)===JSON.stringify(b),clear:a.every(p=>Math.hypot(p.x-start.x,p.y-start.y)>20),finite:a.every(p=>Number.isFinite(p.ground)),open:a.every(p=>Math.abs(t.sample(p.x,p.y).dist??t.sample(p.x,p.y).distance)>=t.roadHalf-.5)}})`);
 for(const [i,t] of layouts.entries()){assert(t.n>=3&&t.n<=9,JSON.stringify({i,...t}));assert(t.same&&t.clear&&t.finite&&t.open&&t.counts);assert(t.units<=36);}
});
test('tyre strikes exchange momentum, tumble, penalize only once, break clean runs and settle',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'challenge');state='running';var run=track.trackProps,p=run.props[0];run.piles=[run.piles[0]];run.props=run.piles[0].units;player.angle=0;player.pos={x:p.x-5,y:p.y};player.vel={x:25,y:0};player.score=600;run.last.set(player,{...player.pos});player.pos.x+=3;run.step(.12,[player]);careerRun.observe(player,.12)`);
 assert(r('p.down&&run.props.some(p=>p.z>.25)'));assert(r('run.props.every(p=>p.down&&!p.sleep)'));assert.equal(r('run.piles[0].intact'),false);assert(r('Math.hypot(p.vx,p.vy)>15'));assert(r('player.vel.x<25'));assert.equal(r('player.score'),500);assert.equal(r('careerRun.clean'),false);assert.equal(r('run.hits'),1);
 r('player.pos={x:0,y:0};player.vel={x:0,y:0};run.last.delete(player);for(let i=0;i<2400;i++)run.step(1/60,[player])');assert(r('p.sleep'));assert.equal(r('p.z'),0);
 r('player.angle=0;player.pos={x:p.x-2,y:p.y};player.vel={x:10,y:0};run.last.delete(player);run.step(1/60,[player])');assert.equal(r('run.hits'),1);assert.equal(r('player.score'),500);
});
test('fast tyre sweeps do not skip contacts, teleports do not hit everything on the way, pause and restart are coherent',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'race');state='running';var run=track.trackProps,p=run.props[0];run.piles=[run.piles[0]];run.props=run.piles[0].units;player.angle=0;player.pos={x:p.x-6,y:p.y};player.vel={x:90,y:0};run.last.set(player,{...player.pos});player.pos.x+=9;run.step(.1,[player])`);assert(r('p.down'));
 r('setPaused(true)');const before=r('({time:run.time,props:run.props})');r('for(let i=0;i<120;i++)simulate(SIM_DT)');assert.deepEqual(r('({time:run.time,props:run.props})'),before);
 r('restartRaceSameTrack()');assert(r('track.trackProps.props.every(p=>!p.down&&p.sleep)'));r(`run=track.trackProps;p=run.props[0];player.angle=0;run.last.set(player,{x:p.x-30,y:p.y});player.pos={x:p.x+30,y:p.y};player.vel={x:0,y:0};run.step(1/60,[player])`);assert(r('!p.down'));
 r("startWithTrack(presetTrack(1),'online')");assert.equal(r('track.trackProps'),null);
});
test('tyres remain on mountain surfaces and replay seeks restore their recorded poses without touching live props',()=>{
 const surface=harness();surface(`startWithTrack(DriftDownhill.createTrack(Track,2),'downhill');var run=track.trackProps,p=run.props[0];run.piles[0].intact=false;p.sleep=false;p.vx=8;p.vy=2;p.vz=3;var maxAir=0;for(let i=0;i<3600;i++){run.step(1/60,[]);if(!Number.isFinite(p.z)||p.z<0||Math.abs(p.ground-track.terrainHeight(p.x,p.y))>.00001)throw new Error('Invalid tyre surface');maxAir=Math.max(maxAir,p.z);}`);assert(surface('maxAir>.1'));assert(surface('p.sleep&&p.z===0'));
 const r=harness();r(`startWithTrack(DriftDownhill.createTrack(Track,2),'downhill');state='running';var p=track.trackProps.props[0];var rec=new DriftReplay.Recorder(2);rec.reset({skin:chosen.sprite});rec.capture(0,player,[],track.trackProps.props);p.x+=2;p.z=1.4;p.tiltX=.5;track.trackProps.props.at(-1).tiltX=1.2;rec.capture(.05,player,[],track.trackProps.props);var original=JSON.stringify(track.trackProps.props);var middle=rec.sample(.025)`);
 assert(r('middle.props.length>0'));assert(Math.abs(r('middle.props[0].z')-.7)<1e-6);assert(r('original===JSON.stringify(track.trackProps.props)'));assert.equal(r('middle.props.length'),r('track.trackProps.props.length'));assert(r('rec.bytes<60000'));
 assert(Math.abs(r('middle.props.at(-1).tiltX')-.6)<1e-6);
});
test('three piles per curve start with 3, 4 and 5 grounded rings and stay asleep until impact',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'race');var run=track.trackProps,before=JSON.stringify(run.props);for(let i=0;i<600;i++)run.step(1/60,[])`);
 assert.equal(r('run.props.length'),36);assert.equal(r('run.piles.length'),9);assert.deepEqual(Array.from(r('run.piles.map(p=>p.units.length)')),[3,4,5,3,4,5,3,4,5]);assert(r('before===JSON.stringify(run.props)'));
 assert(r('run.piles.every(s=>s.units.every((p,i)=>p.z===i*.24&&p.sleep))'));
});
test('stack impact conserves bounded energy and a scattered tyre can topple another pile with one penalty',()=>{
 const r=harness();r(`startWithTrack(presetTrack(1),'race');var run=track.trackProps,p=run.props[0];run.piles=run.piles.slice(0,1);run.props=run.piles.flatMap(p=>p.units);player.angle=0;player.pos={x:p.x-5,y:p.y};player.vel={x:25,y:0};player.score=1000;var energyBefore=.5*player.mass*25*25;run.last.set(player,{...player.pos});player.pos.x+=3;run.step(.12,[player]);var energyAfter=.5*player.mass*Math.hypot(player.vel.x,player.vel.y)**2+run.props.reduce((s,p)=>s+.5*10*(p.vx*p.vx+p.vy*p.vy+p.vz*p.vz)+10*9.81*p.z,0)`);
 assert(r('energyAfter<energyBefore*1.01'));assert.equal(r('run.hits'),1);
 r(`run.reset();run.piles=run.piles.slice(0,2);run.props=run.piles.flatMap(p=>p.units);p=run.props[0];player.pos={x:0,y:0};player.vel={x:0,y:0};player.score=1000;run.penalize(p,player,player);p.vx=Math.cos(p.heading)*30;p.vy=Math.sin(p.heading)*30;run.release(run.piles[0]);for(let i=0;i<180;i++)run.step(1/60,[],player)`);
 assert(r('run.piles.every(s=>!s.intact&&s.penalized)'));assert.equal(r('run.hits'),2);assert.equal(r('player.score'),800);
});
test('each stacked ring is rendered and replay poses replace every instance without extra draw calls',async()=>{
 const T=await import('../vendor/three.module.min.js'),{buildTrackProps}=await import('../js/track-props-scene.js');const r=harness();r("startWithTrack(presetTrack(1),'race')");const track={trackProps:{props:r('track.trackProps.props')}},world=new T.Group(),render=buildTrackProps(track,world);
 assert.equal(world.children.length,1);assert.equal(render.mesh.count,36);const pose=new T.Matrix4();render.mesh.getMatrixAt(4,pose);assert(Math.abs(pose.elements[13]-(track.trackProps.props[4].z+.12))<1e-6);
 const replay=track.trackProps.props.map(p=>({...p,z:p.z+2}));render.update(replay);render.mesh.getMatrixAt(35,pose);assert(Math.abs(pose.elements[13]-(replay[35].z+.12))<1e-6);assert.equal(track.trackProps.props[35].z,.96);
 render.mesh.geometry.dispose();render.mesh.material.dispose();
});
test('scene feedback preserves physical contacts, camera has no accumulating offset, and disabling restores the model',async()=>{
 global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;const {DriftView3D}=await import('../js/view3d.js'),{createTrack,createCar}=await import('../server/engine.js');
 const old=console.error;console.error=()=>{};let v;try{v=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null});}finally{console.error=old;}
 try{const t=createTrack(1),p=createCar(t,'blue',true,0);p.vel.x=45;const before=JSON.stringify(p);const args={track:t,player:p,time:3,weatherTime:3,dt:0,camera:'hood',vibration:{vehicle:1,camera:1}};v.render(args);const transform=v.camera.quaternion.clone(),height=v.car.body.position.y;for(let i=0;i<100;i++)v.render(args);assert(v.camera.quaternion.angleTo(transform)<1e-7);assert.equal(v.car.body.position.y,height);assert.equal(JSON.stringify(p),before);
 v.render({...args,vibration:{vehicle:1,camera:0}});const quietCamera=v.camera.quaternion.clone(),quietPosition=v.camera.position.clone();
 v.render({...args,vibration:{vehicle:0,camera:0}});assert.notEqual(v.car.body.position.y,height);assert.equal(JSON.stringify(p),before);assert(v.camera.quaternion.angleTo(quietCamera)<1e-7);assert(v.camera.position.distanceTo(quietPosition)<1e-8);
 }finally{v.dispose();}
});
