const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('./harness.cjs');
function canvas(){
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};
 return {width:256,height:256,style:{},getContext:type=>type==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
}
const close=(a,b,tol=2e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const loaded=(async()=>{
 global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=600;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:1,height:1});
 const T=await import('../vendor/three.module.min.js'),api=await import('../js/replacement-model.js'),templates={};
 for(const [skin,name] of [['gray','chevrolet-nova-ss'],['blue','nissan-skyline-r34']]){
  const b=fs.readFileSync(path.join(__dirname,'../assets/models/'+name+'.glb'));
  const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  assert(json.images.every(image=>image.bufferView!==undefined),'All textures embedded');assert(!json.animations?.length);
  assert(b.length<3e6,'Bounded browser asset');
  templates[skin]=await api.parseReplacement(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),skin);
 }
 return {T,api,templates};
})();
for(const skin of ['blue','gray'])test(`${skin}: original textured model, four centered wheels, independent light/material ownership`,async()=>{
 const {T,api,templates}=await loaded,template=templates[skin],car=api.createReplacement(template),ghost=api.createReplacement(template,true);
 car.root.updateMatrixWorld(true);assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);
 close(new T.Box3().setFromObject(car.body).getSize(new T.Vector3()).x,template.fit.length);
 for(const [i,w] of car.wheels.entries()){
  const b=new T.Box3().setFromObject(w.spin),c=b.getCenter(new T.Vector3());
  close(c.x,w.steer.position.x);close(c.y,w.steer.position.y);close(c.z,w.steer.position.z);close(b.min.y,.02);
  w.steer.rotation.y=w.front?.35:0;w.spin.rotation.z=2.3;car.root.updateMatrixWorld(true);
  const center=new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3());
  // A rotating low-poly tire's bounding box can vary slightly; its pivot must stay fixed.
  assert(center.distanceTo(w.steer.position)<.025);assert.equal(ghost.wheels[i].spin.rotation.z,0);
 }
 assert(template.parts.some(p=>p.material.map));assert(car.lampMaterials.front.length);assert(car.lampMaterials.rear.length);
 api.updateVehicleLights(car,{braking:false},0);const day=car.lampMaterials.front[0].emissiveIntensity;
 api.updateVehicleLights(car,{braking:false},1);assert(car.lampMaterials.front[0].emissiveIntensity>day);const tail=car.lampMaterials.rear[0].emissiveIntensity;
 api.updateVehicleLights(car,{braking:true},1);assert(car.lampMaterials.rear[0].emissiveIntensity>tail);
 const again=api.createReplacement(template);assert.notEqual(car.body.children[0].material,again.body.children[0].material);
 for(const p of template.parts)assert.notEqual(p.geometry,car.body.children[0].geometry);
 for(const model of [car,ghost,again]){const {disposeGroup}=await import('../js/view3d.js');disposeGroup(model.root);}
 const after=api.createReplacement(template);assert(after.wheels.every(w=>w.spin.children.length));
});
test('replacement vehicles load in player, garage, rivals and ghost; steer, spin, reverse and light from existing state',async()=>{
 const {api,templates}=await loaded,{DriftView3D}=await import('../js/view3d.js');
 const opts={loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:()=>Promise.resolve(templates.gray),loadSkylineVehicle:()=>Promise.resolve(templates.blue)};
 const previous=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),opts);}finally{console.error=previous;}
 await Promise.all([view.novaReady,view.skylineReady]);
 const points=[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],track={points,roadHalf:14,bounds:{minX:-100,minY:0,w:200,h:100},point(i){return points[(i+4)%4]},tangentAt(){return 0},normalAt(){return {x:0,y:1}},nearestIndex(){return 0}};
 for(const skin of ['gray','blue']){
  const p={pos:{x:0,y:0},vel:{x:12,y:0},angle:0,omega:0,steerAngle:.3,braking:true,smoke:[],tireTrails:[],worldSpeed:()=>12};
  view.render({track,player:p,skin,dt:1/60,timeOfDay:1,rivals:[{...p,id:'other',skin}]});
  assert.equal(view.car.root.name,templates[skin].fit.name);assert.equal(view.ghostCar.root.name,templates[skin].fit.name);assert.equal(view.rivalModels.get('other').root.name,templates[skin].fit.name);
  for(const w of view.car.wheels){close(w.steer.rotation.y,w.front?-.3:0);close(w.spin.rotation.z,-12/60/w.radius);}
  p.vel.x=-12;view.render({track,player:p,skin,dt:1/60});for(const w of view.car.wheels)close(w.spin.rotation.z,0);
  assert(view.car.lampMaterials.rear.every(m=>m.emissiveIntensity===2.2));
 }
 view.dispose();
});
test('saved vehicle IDs, upgrades and stock tuning survive both replacements; wheel effects match both rear pivots',()=>{
 const r=harness();
 for(const [skin,name,tune] of [['gray','Chevrolet Nova SS',{engine:.95,lat:1,hand:1,drag:1.05,mass:.95}],['blue','Nissan Skyline R34',{engine:1.10,lat:.95,hand:.85,drag:.98,mass:.95}]]){
  assert.equal(r(`CAR_DATA.find(c=>c.sprite==='${skin}').name`),name);assert.deepEqual(r(`CAR_DATA.find(c=>c.sprite==='${skin}').tune`),tune);
  const result=r(`(()=>{const c=new Car(presetTrack(1));configureSelectedCar(c,CAR_DATA.find(d=>d.sprite==='${skin}'));DriftRoadContact.alignWheelEffects(c,'${skin}');c.pos={x:0,y:0};c.angle=0;c.spawnTrails({x:1,y:0},{x:0,y:1},1/60,1);c.trailOn=true;c.smokeAcc=1;c.updateSmoke(0,{x:1,y:0},{x:0,y:1},1,100,0);return {trail:c.tireTrails.at(-1),smoke:c.smoke,wheels:DriftRoadContact.wheelOffsets('${skin}').slice(0,2)};})()`);
  for(let i=0;i<2;i++){const w=result.wheels[i];close(result.trail['x'+(i+1)],w.x);close(result.trail['y'+(i+1)],w.z);assert(Math.abs(result.smoke[i].x-w.x)<.08);assert(Math.abs(result.smoke[i].y-w.z)<.08);}
 }
 assert(r("(()=>{const p=DriftCareer.load();p.cars.blue.owned.engine=p.cars.blue.active.engine=2;p.cars.gray.owned.smoke=p.cars.gray.active.smoke=3;DriftCareer.save(p);const saved=DriftCareer.load();return saved.cars.blue.active.engine===2&&saved.cars.gray.active.smoke===3;})()"));
});
test('late model downloads cannot override another choice or recreate a disposed view',async()=>{
 const {templates}=await loaded,{DriftView3D}=await import('../js/view3d.js');let done;
 const make=()=>{const old=console.error;console.error=()=>{};try{return new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadSkylineVehicle:null,loadNovaVehicle:()=>new Promise(r=>done=r)});}finally{console.error=old;}};
 let view=make();view.setSkin('gray');view.setSkin('red');done(templates.gray);await view.novaReady;assert.equal(view.key,'red');view.dispose();
 view=make();view.dispose();done(templates.gray);await view.novaReady;assert.equal(view.scene.children.length,0);
});

test('service brake stays independent of handbrake through replay and remote pose interpolation',()=>{
 const r=harness();
 const sample=r(`(()=>{const t=presetTrack(1),c=new Car(t);configureSelectedCar(c,CAR_DATA[0]);c.update(1/60,{brake:true},t);const rec=new DriftReplay.Recorder(2);rec.reset({track:t,skin:'blue'});rec.capture(0,c);return {braking:c.braking,handbrake:c.handbrake,replay:{braking:rec.sample(0).player.braking,handbrake:rec.sample(0).player.handbrake},pose:DriftNet.pose(c)};})()`);
 assert.equal(sample.braking,true);assert.equal(sample.handbrake,false);assert.equal(sample.replay.braking,true);assert.equal(sample.replay.handbrake,false);assert.equal(sample.pose[6],2);
 const interpolated=r("DriftNet.interpolate([{t:0,p:[0,0,0,1,0,0,0]},{t:100,p:[1,0,0,1,0,0,2]}],75)");assert.equal(interpolated[6],2);
});
