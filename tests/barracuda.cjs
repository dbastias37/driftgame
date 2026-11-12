const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};return {width:256,height:256,style:{},getContext:type=>type==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}
const loaded=(async()=>{
 global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=600;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:1,height:1});
 const T=await import('../vendor/three.module.min.js'),api=await import('../js/replacement-model.js'),b=fs.readFileSync(require('node:path').join(__dirname,'../assets/models/plymouth-barracuda.glb'));
 const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(json.images.length>=5);assert(json.images.every(i=>i.bufferView!==undefined));assert(b.length<3e6);assert(!json.animations?.length);
 const template=await api.parseReplacement(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'barracuda');return {T,api,template};
})();
test('Barracuda uses supplied textured mesh, exact grounded wheel pivots and independent lights',async()=>{
 const {T,api,template}=await loaded,car=api.createReplacement(template),ghost=api.createReplacement(template,true);
 car.root.updateMatrixWorld(true);assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);
 assert(Math.abs(new T.Box3().setFromObject(car.body).getSize(new T.Vector3()).x-4.74)<1e-4);
 for(const w of car.wheels){
  const box=new T.Box3().setFromObject(w.spin);assert(Math.abs(box.min.y-.02)<1e-5);assert(box.getCenter(new T.Vector3()).distanceTo(w.steer.position)<1e-5);
  w.steer.rotation.y=w.front?.4:0;w.spin.rotation.z=1.6;car.root.updateMatrixWorld(true);assert(new T.Box3().setFromObject(w.spin).getCenter(new T.Vector3()).distanceTo(w.steer.position)<.025);
 }
 assert(template.parts.some(p=>p.material.map));assert(car.lampMaterials.front.length);assert(car.lampMaterials.rear.length);
 api.updateVehicleLights(car,{braking:false},0);const day=car.lampMaterials.front[0].emissiveIntensity;api.updateVehicleLights(car,{braking:true},1);assert(car.lampMaterials.front[0].emissiveIntensity>day);assert(car.lampMaterials.rear.every(m=>m.emissiveIntensity===2.2));
 assert(ghost.wheels.every(w=>w.spin.rotation.z===0));assert.notEqual(car.body.children[0].material,ghost.body.children[0].material);
});
test('Barracuda appears in player, ghost, garage and rivals and wheels reverse with travel',async()=>{
 const {template}=await loaded,{DriftView3D}=await import('../js/view3d.js');
 const old=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null,loadBarracudaVehicle:()=>Promise.resolve(template)});}finally{console.error=old;}
 await view.barracudaReady;view.setSkin('barracuda');assert.equal(view.car.root.name,template.fit.name);assert.equal(view.ghostCar.root.name,template.fit.name);
 const p={id:'cuda',skin:'barracuda',pos:{x:0,y:0},vel:{x:12,y:0},angle:0,omega:0,steerAngle:.25,braking:true,smoke:[],tireTrails:[],worldSpeed:()=>12};
 const points=[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],track={points,roadHalf:14,bounds:{minX:-100,minY:0,w:200,h:100},point(i){return points[(i+4)%4]},tangentAt(){return 0},normalAt(){return {x:0,y:1}},nearestIndex(){return 0}};
 view.render({track,player:p,skin:'barracuda',dt:1/60,timeOfDay:1,rivals:[p]});assert.equal(view.rivalModels.get('cuda').root.name,template.fit.name);
 for(const w of view.car.wheels){assert(Math.abs(w.steer.rotation.y-(w.front?-.25:0))<1e-6);assert(w.spin.rotation.z<0);}
 p.vel.x=-12;view.render({track,player:p,skin:'barracuda',dt:1/60});assert(view.car.wheels.every(w=>Math.abs(w.spin.rotation.z)<1e-6));view.dispose();
});
test('a late Barracuda response respects selected skin and disposed scenes',async()=>{
 const {template}=await loaded,{DriftView3D}=await import('../js/view3d.js');let resolve;
 const old=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null,loadBarracudaVehicle:()=>new Promise(r=>resolve=r)});}finally{console.error=old;}
 view.setSkin('barracuda');view.setSkin('blue');resolve(template);await view.barracudaReady;assert.equal(view.key,'blue');view.dispose();assert.equal(view.scene.children.length,0);
});
test('Barracuda workshop paint follows the supplied mask and preserves grille, lights, tyres and glass',async()=>{
 const {paintPixel,recolorPixels}=await import('../js/vehicle-paint.js');
 assert(paintPixel('barracuda','exterior.011',.5,.5,230,230,230));
 for(const [u,v] of [[.05,.05],[.6,.85],[.9,.8],[.4,.2]])assert.equal(paintPixel('barracuda','exterior.011',u,v,230,230,230),false);
 for(const name of ['headlights','taillights','Glass','tyre.012','details.011'])assert.equal(paintPixel('barracuda',name,.5,.5,230,230,230),false);
 const pixels=new Uint8ClampedArray(128*128*4).fill(230);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 const changed=recolorPixels(pixels,'barracuda','exterior.011','#cc3311',128,128);assert(changed>1000&&changed<128*128*.7);assert.equal(pixels[3],255);
});
