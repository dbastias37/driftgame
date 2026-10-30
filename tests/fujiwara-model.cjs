const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const close=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const loaded=(async()=>{
  global.self=global;global.createImageBitmap=async()=>({width:1,height:1});
  const T=await import('../vendor/three.module.min.js'),model=await import('../js/fujiwara-model.js');
  const buffer=fs.readFileSync(path.join(__dirname,'../assets/models/ae86-fujiwara.glb'));
  const template=await model.parseFujiwara(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
  return{T,...model,buffer,template};
})();

test('Fujiwara batches the full supplied pixel model into five meshes under 150 KB',async()=>{
  const {T,buffer,template,createFujiwara}=await loaded,car=createFujiwara(template);
  assert.ok(buffer.length<150000);assert.equal(template.parts.length,5);assert.equal(car.body.children.length,1);
  assert.equal(template.parts.reduce((n,p)=>n+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0),1349);
  car.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(car.body,true);close(box.max.x-box.min.x,4.215);
  for(const p of template.parts){
    assert.ok(p.geometry.attributes.uv);assert.ok(p.material.map);assert.equal(p.material.map.flipY,false);
    assert.equal(p.material.map.magFilter,T.NearestFilter);assert.equal(p.material.map.minFilter,T.NearestMipmapNearestFilter);
    assert.ok(p.material.alphaTest>0);
    const position=p.geometry.attributes.position;for(const value of position.array)assert.ok(Number.isFinite(value));
  }
  assert.equal(car.headlights.length,2);for(const point of car.headlights){assert.ok(point.x>1.8);assert.ok(point.y>.7&&point.y<.8);}
  close(car.headlights[0].z,-car.headlights[1].z);
});

test('Fujiwara keeps centered wheel pivots, front steering and independent suspension',async()=>{
  const {T,template,createFujiwara}=await loaded,car=createFujiwara(template);car.root.updateMatrixWorld(true);
  assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);
  const originalCenters=car.wheels.map(w=>w.steer.position.clone());
  for(const wheel of car.wheels){
    const bounds=new T.Box3().setFromObject(wheel.spin,true),center=bounds.getCenter(new T.Vector3());
    close(center.distanceTo(wheel.steer.position),0);close(bounds.min.y,.02);assert.ok(wheel.radius>.31&&wheel.radius<.32);
    assert.equal(wheel.front,wheel.steer.position.x>0);
    wheel.steer.rotation.y=wheel.front?-.35:0;wheel.spin.rotation.z=-10/60/wheel.radius;
  }
  car.body.position.y=.06;car.body.rotation.set(.08,0,-.035);car.root.updateMatrixWorld(true);
  car.wheels.forEach((wheel,i)=>{assert.ok(wheel.steer.position.equals(originalCenters[i]));close(wheel.steer.rotation.y,wheel.front?-.35:0);});
  for(const front of [true,false]){const [left,right]=car.wheels.filter(w=>w.front===front);close(left.steer.position.x,right.steer.position.x);close(left.steer.position.z,-right.steer.position.z);}
  close(car.wheels.find(w=>w.front).steer.position.x-car.wheels.find(w=>!w.front).steer.position.x,2.39815435);
});

test('Fujiwara ghosts own disposable resources without changing the source or player',async()=>{
  const {template,createFujiwara}=await loaded,car=createFujiwara(template),ghost=createFujiwara(template,true);
  const a=car.body.children[0],b=ghost.body.children[0];assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.material,b.material);assert.notEqual(a.material.map,b.material.map);
  assert.notEqual(a.material.map,template.parts[0].material.map);assert.equal(b.material.opacity,.24);assert.equal(b.material.depthWrite,false);assert.equal(a.material.opacity,1);
  b.material.color.set(0x000000);assert.notEqual(a.material.color.getHex(),0);assert.notEqual(template.parts[0].material.color.getHex(),0);
});
