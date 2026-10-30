const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const{harness}=require('./harness.cjs');
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};return{width:256,height:256,clientWidth:800,clientHeight:500,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}
const close=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
async function setup(){global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:512,height:512});const T=await import('../vendor/three.module.min.js'),model=await import('../js/yugo-model.js');const b=fs.readFileSync('assets/models/yugo-koral-55-pixel.glb'),template=await model.parseYugo(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));return{T,template,...model};}
const loaded=setup();
test('Yugo asset has metric proportions, a pixel atlas, and four separate stock-sized wheel pivots',async()=>{
 const{T,template,createYugo}=await loaded,car=createYugo(template),b=new T.Box3().setFromObject(car.body);
 assert.equal(template.parts.length,5);assert.ok(fs.statSync('assets/models/yugo-koral-55-pixel.glb').size<100000);close(b.max.x-b.min.x,3.49);close(b.max.y,1.335);
 car.root.updateMatrixWorld(true);assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);
 for(const w of car.wheels){const box=new T.Box3().setFromObject(w.spin);close(box.min.y,.013);close(box.getCenter(new T.Vector3()).x,w.steer.position.x);close(Math.abs(w.steer.position.z),.654);close(w.radius,.281);close(w.steer.position.x,w.front?1.06:-1.09);}
 const material=car.body.children[0].material;assert.ok(material.isMeshBasicMaterial);assert.equal(material.map.magFilter,T.NearestFilter);assert.equal(material.map.minFilter,T.NearestFilter);assert.equal(material.map.flipY,false);
 const ghost=createYugo(template,true);assert.notEqual(material,ghost.body.children[0].material);assert.notEqual(material.map,ghost.body.children[0].material.map);
 const file=fs.readFileSync('assets/cars/yugo.png');assert.equal(file.subarray(1,4).toString(),'PNG');
});
test('Yugo reaches 145 km/h in flat-road physics with approximately 18 s to 100, in auto and manual',()=>{
 for(const automatic of[true,false]){const r=harness();const result=r(`(()=>{chosen=CAR_DATA[4];player=new Car(presetTrack(1));applyChosen();player.auto=${automatic};player.pos={x:0,y:0};player.angle=0;let hundred=null;const straight={roadHalf:100,sample(x,y){return{cx:x,cy:0,tang:0,dist:y,i:0}}};for(let i=0;i<60*180;i++){if(!player.auto&&player.gear<5&&player.shiftTimer<=0&&player.worldSpeed()*3.6>player.shiftUp[player.gear-1]){player.gear++;player.shiftTimer=player.shiftDur;}player.update(1/60,{accel:true},straight);if(hundred===null&&player.worldSpeed()*3.6>=100)hundred=i/60;}return{speed:player.worldSpeed()*3.6,hundred,mass:player.mass,gear:player.gear,length:player.length}})()`);close(result.speed,145,.3);assert.ok(result.hundred>=17.5&&result.hundred<=18.5);assert.equal(result.mass,790);assert.equal(result.gear,5);assert.equal(result.length,2.15);}
});
test('Yugo effect samples and suspension contacts match its narrower physical wheels',()=>{
 const r=harness();const data=r(`(()=>{chosen=CAR_DATA[4];player=new Car(presetTrack(1));applyChosen();player.pos={x:0,y:0};player.angle=0;player.spawnTrails({x:1,y:0},{x:0,y:1},1/60,.5);return{trail:player.tireTrails.at(-1),wheels:DriftRoadContact.wheelOffsets('yugo')}})()`);
 close(data.trail.x1,-1.09);close(data.trail.x2,-1.09);close(data.trail.y1,-.654);close(data.trail.y2,.654);assert.equal(data.wheels.filter(w=>w.x===1.06).length,2);
});
test('Yugo rotates in the garage and steers, spins, and rides the curb without changing simulation state',async()=>{
 const{T,template}=await loaded,{MenuPreview3D}=await import('../js/menu-preview.js');const old=console.error;console.error=()=>{};let view;try{view=new MenuPreview3D(canvas(),{loadVehicle:null,loadYugoVehicle:()=>Promise.resolve(template)});}finally{console.error=old;}await view.yugoReady;
 for(const skin of['yugo','gray','yugo']){view.renderPreview({kind:'garage',skin,dt:.1});assert.equal(view.car.root.parent,view.garage.platform);assert.equal(view.garage.platform.children.filter(o=>o.name==='Yugo Koral 55').length,skin==='yugo'?1:0);}
 const tr={points:[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],roadHalf:12,bounds:{minX:-100,minY:0,w:200,h:100},point(i){return this.points[(i+4)%4]},tangentAt(){return 0},normalAt(){return{x:0,y:1}},nearestIndex(){return 0}};
 const p={pos:{x:0,y:12.51-.654},angle:0,vel:{x:10,y:0},omega:0,steerAngle:.35,handbrake:false,smoke:[],tireTrails:[],worldSpeed:()=>10};globalThis.DriftRoadContact.reset(tr,p,'yugo');const before=JSON.stringify(p);view.render({track:tr,player:p,skin:'yugo',motion:'reduced',dt:1/60});assert.equal(JSON.stringify(p),before);assert.ok(view.car.imported);
 for(const w of view.car.wheels){close(w.steer.position.y-w.baseY,w.steer.position.z>0?.14:0);close(w.steer.rotation.y,w.front?-.35:0);close(w.spin.rotation.z,-10/60/.281);}
 view.dispose();
});
test('late Yugo downloads cannot replace another selection or resurrect a disposed scene',async()=>{
 const{template}=await loaded,{DriftView3D}=await import('../js/view3d.js');let resolve;const old=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:()=>new Promise(r=>{resolve=r})});}finally{console.error=old;}view.setSkin('yugo');view.setSkin('red');resolve(template);await view.yugoReady;assert.equal(view.key,'red');view.dispose();
 console.error=()=>{};try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:()=>new Promise(r=>{resolve=r})});}finally{console.error=old;}view.dispose();resolve(template);await view.yugoReady;assert.equal(view.scene.children.length,0);
});
test('fifth car is retained through menus, 2D/3D switches, downhill recovery and restart',()=>{
 const r=harness();r("$('#btnModeDownhill').click();previewDownhill(1);confirmTrackPreview();carIdx=3;$('#carNext').click();$('#btnChooseStart').click();state='running';keys.add('w');for(let i=0;i<180;i++)simulate(SIM_DT)");assert.equal(r('chosen.sprite'),'yugo');assert.equal(r('player.mass'),790);assert.equal(r('player.gearCount'),5);r("setRenderView('2d');setRenderView('3d');loseLifeAndRespawn()");assert.equal(r('player.mass'),790);assert.equal(r('player.lives'),2);assert.equal(r('player.descent.motion'),'driving');assert.equal(r('player.bodyDimensions.length'),3.49);r('restartRaceSameTrack()');assert.equal(r('player.mass'),790);assert.equal(r('player.lives'),3);assert.equal(r('player.gear'),1);
});

test('Yugo falling body rolls, then recovers automatically once with a life penalty',()=>{
 const r=harness();r("chosen=CAR_DATA[4];startWithTrack(DriftDownhill.createTrack(Track,1),'downhill');state='running';var p=track.atDistance(140),n=track.normalAt(p.i);player.pos={x:p.x,y:p.y};player.angle=track.tangentAt(p.i)+Math.PI/2;player.vel={x:n.x*20,y:n.y*20};player.descent.s=player.descent.maxS=140;player.descent.checkpoint=120;DriftRoadContact.reset(track,player,'yugo');for(let i=0;i<180&&player.descent.motion!=='falling';i++)simulate(SIM_DT);");assert.equal(r('player.descent.motion'),'falling');r('for(let i=0;i<120;i++)simulate(SIM_DT)');assert.ok(r('Math.abs(player.descent.roll)')>.1);r('for(let i=0;i<180&&player.lives===3;i++)simulate(SIM_DT)');assert.equal(r('player.lives'),2);assert.equal(r('player.descent.motion'),'driving');assert.equal(r('player.descent.s'),120);assert.equal(r('player.mass'),790);assert.equal(r('player.worldSpeed()'),0);
});
