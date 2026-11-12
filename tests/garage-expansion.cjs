const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
const entries=[['subaru','subaru-impreza-s206'],['bmw','bmw-m3-gtr'],['shelby','shelby-gt500'],['mustang','mustang-gt-fastback']];
function canvas(){const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};return{width:256,height:256,clientWidth:800,clientHeight:500,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};}
const loaded=(async()=>{
 global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=600;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:1,height:1});
 const T=await import('../vendor/three.module.min.js'),api=await import('../js/replacement-model.js'),templates=new Map();
 for(const [skin,file]of entries){const b=fs.readFileSync(`assets/models/${file}.glb`),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(json.images.length>=2);assert(json.images.every(x=>x.bufferView!==undefined));assert(b.length<6e6);templates.set(skin,await api.parseReplacement(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),skin));}
 const {MenuPreview3D}=await import('../js/menu-preview.js');return {T,api,templates,MenuPreview3D};
})();
const noLoad={loadVehicle:null,loadYugoVehicle:null,loadFujiwaraVehicle:null,loadNovaVehicle:null,loadSkylineVehicle:null,loadBarracudaVehicle:null};
function makeView(Type,options={}){const old=console.error;console.error=()=>{};try{return new Type(canvas(),{...noLoad,...options});}finally{console.error=old;}}
test('four new cars preserve source geometry, grounded wheels, independent lamps and texture-safe paint',async()=>{
 const {T,api,templates}=await loaded,{paintPixel}=await import('../js/vehicle-paint.js');
 for(const [skin,template] of templates){const model=api.createReplacement(template);model.root.updateMatrixWorld(true);assert.equal(model.wheels.length,4);assert.equal(model.wheels.filter(x=>x.front).length,2);
  for(const wheel of model.wheels){const bounds=new T.Box3().setFromObject(wheel.spin);assert(Math.abs(bounds.min.y-.02)<.001,`${skin} tire floor`);assert(bounds.getCenter(new T.Vector3()).distanceTo(wheel.steer.position)<.03);}
  assert(model.lampMaterials.front.length&&model.lampMaterials.rear.length);api.updateVehicleLights(model,{braking:true},1);assert(model.lampMaterials.rear.every(x=>x.emissiveIntensity===2.2));
  for(const name of ['Glass','headlights','taillights','tyre'])assert.equal(paintPixel(skin,name,.5,.5,180,185,188),false);
 }
 assert(paintPixel('bmw','bmw-paint',.5,.5,150,156,158));assert.equal(paintPixel('bmw','bmw-paint',.5,.5,20,20,20),false);
});
test('lazy models resolve safely after selection changes and appear in garage, ghost and rivals',async()=>{
 const {templates,MenuPreview3D}=await loaded;let resolve,requests=0;
 const view=makeView(MenuPreview3D,{loadExtraVehicle:key=>{requests++;return key==='subaru'?new Promise(r=>resolve=r):Promise.resolve(templates.get(key));}});
 assert.equal(requests,0);view.setSkin('subaru');const pending=view.ensureVehicle('subaru');await Promise.resolve();assert.equal(requests,1);view.setSkin('blue');resolve(templates.get('subaru'));await pending;assert.equal(view.key,'blue');
 for(const [skin,template]of templates){view.setSkin(skin);await view.ensureVehicle(skin);view.renderPreview({kind:'garage',skin,spinning:false});assert.equal(view.car.root.name,template.fit.name);assert.equal(view.ghostCar.root.name,template.fit.name);assert.equal(view.car.root.parent,view.garage.platform);
  const p={id:skin,skin,pos:{x:0,y:0},vel:{x:10,y:0},angle:0,steerAngle:.3,ride:{height:0,roll:0,pitch:0,wheels:[]},wheelTravel:2};view.track={};view.updateRivals([p],1/60);assert.equal(view.rivalModels.get(skin).root.name,template.fit.name);assert(view.rivalModels.get(skin).wheels.every(w=>w.spin.rotation.z<0));
 }
 assert.equal(requests,4);view.dispose();assert.equal(view.scene.children.length,0);
});
test('garage zoom never crosses room walls, portrait framing fits the car, and track zoom is isolated',async()=>{
 const {T,templates,MenuPreview3D}=await loaded,view=makeView(MenuPreview3D,{loadExtraVehicle:key=>Promise.resolve(templates.get(key))});
 view.previewMode='track';view.previewZoom=3;view.previewPan.set(999,0,999);
 view.renderPreview({kind:'garage',skin:'shelby',spinning:false});await view.ensureVehicle('shelby');assert.equal(view.previewZoom,1);assert.equal(view.previewPan.length(),0);
 for(const [width,height]of [[1280,500],[800,500],[390,420],[280,500],[780,180]]){
  view.canvas.clientWidth=width;view.canvas.clientHeight=height;
  for(const factor of [.00001,100000]){view.zoomPreviewBy(factor);assert(view.previewZoom>=.85&&view.previewZoom<=1.18);
   for(const angle of [0,.7,1.5,2.4,3.6,5.5]){view.garageAngle=angle;view.renderPreview({kind:'garage',skin:'shelby',spinning:false});assert(Math.abs(view.camera.position.x)<9.5);assert(view.camera.position.z<8);assert(view.camera.position.y<5.3);
    view.car.root.updateMatrixWorld(true);view.camera.updateMatrixWorld();const b=new T.Box3().setFromObject(view.car.body);
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z).project(view.camera);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,`clipped ${width}x${height}, zoom ${view.previewZoom}, angle ${angle}: ${p.x},${p.y}`);}
   }
  }
 }
 view.panBy(999,999);assert.equal(view.previewPan.length(),0);view.resetPreview();assert.equal(view.garageAngle,-.35);assert.equal(view.previewZoom,1);view.dispose();
});
test('all new choices configure offline and authoritative online physics with persisted independent upgrades',async()=>{
 const run=harness();
 for(const [skin]of entries){const result=run(`(()=>{carIdx=CAR_DATA.findIndex(c=>c.sprite==='${skin}');updatePanel();const t=presetTrack(1),a=new Car(t),b=new Car(t);configureSelectedCar(a,chosen);DriftNet.configure(b,chosen,true,{});const save=DriftCareer.load();return {selected:chosen.sprite,allowed:DriftNet.SKINS.includes(chosen.sprite),profile:!!DriftCareer.profiles[chosen.sprite],saved:!!save.cars[chosen.sprite],mass:a.mass,online:b.mass,length:a.length,fit:DriftRoadContact.wheelOffsets(chosen.sprite)[2].x-DriftRoadContact.wheelOffsets(chosen.sprite)[0].x,drive:a.handling.drive}})()`);assert.equal(result.selected,skin);assert(result.allowed&&result.profile&&result.saved);assert.equal(result.mass,result.online);assert(Math.abs(result.length-result.fit)<.001);assert.equal(result.drive,skin==='subaru'?.42:0);}
});
