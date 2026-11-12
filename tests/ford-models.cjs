const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function canvas(){return {width:1,height:1,getContext:()=>({drawImage(){}})};}
const loaded=(async()=>{
 global.self=global;global.document={createElement:canvas};global.createImageBitmap=async()=>({width:1,height:1});
 const T=await import('../vendor/three.module.min.js'),api=await import('../js/replacement-model.js');
 const cars=[];
 for(const [skin,filename] of [['shelby','shelby-gt500'],['mustang','mustang-gt-fastback']]){
  const fit=JSON.parse(fs.readFileSync(path.join(__dirname,`../assets/models/${filename}.fit.json`)));
  globalThis.DriftVehicleFit={...globalThis.DriftVehicleFit,[skin]:fit};
  const buffer=fs.readFileSync(path.join(__dirname,`../assets/models/${filename}.glb`));
  const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
  assert(buffer.length<3e6);assert.equal(json.meshes.length,5);assert.equal(json.images.length,5);
  assert(json.images.every(image=>image.bufferView!==undefined));assert(!json.animations?.length);
  cars.push({skin,template:await api.parseReplacement(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),skin)});
 }
 return {T,api,cars};
})();
test('Ford models retain textures, correct orientation, independent lamps and grounded wheel pivots',async()=>{
 const {T,api,cars}=await loaded;
 for(const {skin,template} of cars){
  const car=api.createReplacement(template);car.root.updateMatrixWorld(true);
  assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);
  assert.equal(template.parts.length,16);
  const bodyBounds=new T.Box3().setFromObject(car.body);
  assert(Math.abs(bodyBounds.getSize(new T.Vector3()).x-template.fit.length)<1e-4);
  for(const wheel of car.wheels){
   const box=new T.Box3().setFromObject(wheel.spin);
   assert(Math.abs(box.min.y-.02)<1e-5,`${skin} tyre floor`);
   assert(box.getCenter(new T.Vector3()).distanceTo(wheel.steer.position)<1e-5,`${skin} pivot center`);
   wheel.steer.rotation.y=wheel.front?.4:0;wheel.spin.rotation.z=1.6;car.root.updateMatrixWorld(true);
   assert(new T.Box3().setFromObject(wheel.spin).getCenter(new T.Vector3()).distanceTo(wheel.steer.position)<.025);
  }
  assert(template.fit.headlights.every(point=>point[0]>template.fit.length*.4));
  assert(template.parts.some(part=>part.material.name==='Glass'));
  assert(car.lampMaterials.front.length&&car.lampMaterials.rear.length);
  api.updateVehicleLights(car,{braking:true},1);
  assert(car.lampMaterials.rear.every(material=>material.emissiveIntensity===2.2));
 }
});
test('Ford paint masks retain both paintable and protected texture islands',async()=>{
 const {fordPaintMask}=await import('../js/ford-paint-masks.js');
 for(const skin of ['shelby','mustang']){
  let painted=0;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++)painted+=fordPaintMask(skin,(x+.5)/128,(y+.5)/128);
  assert(painted>3000&&painted<128*128*.8,`${skin} paint coverage ${painted}`);
 }
 assert.equal(fordPaintMask('unknown',.5,.5),false);
});
