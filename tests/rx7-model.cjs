const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('./harness.cjs');
function canvas(){
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};
  return {width:256,height:256,style:{},getContext:type=>type==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
}
async function setup(){
  global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;
  // CI validates the real GLB geometry without native image decoding. Production
  // images are inspected separately with the renderer and original PNG pixels.
  global.createImageBitmap=async()=>({width:1,height:1});
  const T=await import('../vendor/three.module.min.js');
  const model=await import('../js/rx7-model.js');
  const buffer=fs.readFileSync(path.join(__dirname,'../assets/models/rx7-fd-redsuns.glb'));
  const template=await model.parseRX7(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
  return {T,template,...model};
}
const loaded=setup();
const close=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('RX-7 GLB retains all body parts, textures and four centered wheel pivots',async()=>{
  const {T,template,createRX7}=await loaded,car=createRX7(template);
  car.root.updateMatrixWorld(true);assert.equal(template.parts.length,15);assert.equal(car.wheels.length,4);
  const box=new T.Box3().setFromObject(car.body);close(box.max.x-box.min.x,4.45);
  assert.equal(car.wheels.filter(w=>w.front).length,2);
  for(const w of car.wheels){
    const bounds=new T.Box3().setFromObject(w.spin),center=bounds.getCenter(new T.Vector3());
    close(center.x,w.steer.position.x);close(center.y,w.steer.position.y);close(center.z,w.steer.position.z);
    close(bounds.min.y,.02);assert.ok(w.radius>.32&&w.radius<.33);
    assert.equal(w.front,w.steer.position.x>0);
  }
  for(const front of [true,false]){const [l,r]=car.wheels.filter(w=>w.front===front);close(l.steer.position.x,r.steer.position.x);close(l.steer.position.z,-r.steer.position.z);}
  for(const p of template.parts){assert.ok(p.material.map);assert.equal(p.material.map.flipY,false);assert.ok(p.material.alphaTest>0);}
  const ghost=createRX7(template,true);
  assert.notEqual(car.body.children[0].geometry,ghost.body.children[0].geometry);
  assert.notEqual(car.body.children[0].material,ghost.body.children[0].material);
  assert.notEqual(car.body.children[0].material.map,ghost.body.children[0].material.map);
  assert.notEqual(car.body.children[0].material.map,template.parts[0].material.map);
});

test('live RX-7 follows existing movement and body roll, steering and rolling only about wheel centers',async()=>{
  const {T,template}=await loaded,{DriftView3D}=await import('../js/view3d.js');
  const old=console.error;console.error=()=>{};let view;try{view=new DriftView3D(canvas(),{loadVehicle:()=>Promise.resolve(template)});}finally{console.error=old;}
  await view.assetReady;
  const points=Array.from({length:64},(_,i)=>({x:100*Math.cos(i/64*Math.PI*2),y:100*Math.sin(i/64*Math.PI*2)}));
  const track={points,roadHalf:14,bounds:{minX:-100,minY:-100,w:200,h:200},point(i){return points[(i+64)%64]},tangentAt(i){const p=this.point(i),q=this.point(i+1);return Math.atan2(q.y-p.y,q.x-p.x)},normalAt(i){const a=this.tangentAt(i);return{x:-Math.sin(a),y:Math.cos(a)}},nearestIndex(){return 0}};
  const player={pos:{x:100,y:0},vel:{x:10,y:0},angle:0,omega:.6,steerAngle:.35,handbrake:false,smoke:[],tireTrails:[],worldSpeed:()=>10};
  const before=JSON.stringify(player);view.render({track,player,skin:'yellow',dt:1/60});
  assert.ok(view.car.imported);assert.equal(JSON.stringify(player),before);
  close(view.car.body.rotation.x,.012);close(view.car.root.position.x,100);
  for(const w of view.car.wheels){close(w.steer.rotation.y,w.front?-.35:0);close(w.spin.rotation.z,-10/60/w.radius);}
  const centers=view.car.wheels.map(w=>w.steer.position.clone()),spins=view.car.wheels.map(w=>w.spin.rotation.z);
  view.render({track,player,skin:'yellow',dt:0});
  view.car.wheels.forEach((w,i)=>{close(w.spin.rotation.z,spins[i]);assert.ok(w.steer.position.equals(centers[i]));});
  player.vel.x=-10;player.steerAngle=-.35;player.omega=-.6;
  view.render({track,player,skin:'yellow',dt:1/60});
  for(const w of view.car.wheels){close(w.spin.rotation.z,0);close(w.steer.rotation.y,w.front?.35:0);}
  const pose=JSON.stringify(player);view.setSkin('blue');view.setSkin('yellow');assert.ok(view.car.imported);assert.equal(JSON.stringify(player),pose);
  const supportTrack={...track,points:[{x:-100,y:0},{x:100,y:0},{x:100,y:100},{x:-100,y:100}],point(i){return this.points[(i+4)%4]},tangentAt(){return 0},normalAt(){return {x:0,y:1}}};
  player.pos={x:0,y:14.51-.768966};player.angle=0;
  globalThis.DriftRoadContact.reset(supportTrack,player,'yellow');
  const supported=JSON.stringify(player);view.render({track:supportTrack,player,skin:'yellow',motion:'reduced',dt:0});
  assert.equal(JSON.stringify(player),supported);close(view.car.body.position.y,.07);assert.ok(view.car.body.rotation.x<-.08);
  for(const wheel of view.car.wheels)close(wheel.steer.position.y-wheel.baseY,wheel.steer.position.z>0?.14:0);
  view.dispose();
});

test('late and failed downloads cannot switch a selected car or resurrect a disposed scene',async()=>{
  const {template}=await loaded,{DriftView3D}=await import('../js/view3d.js');
  let resolve;const old=console.error;console.error=()=>{};let view;
  try{view=new DriftView3D(canvas(),{loadVehicle:()=>new Promise(r=>{resolve=r})});}finally{console.error=old;}
  view.setSkin('yellow');view.setSkin('red');resolve(template);await view.assetReady;assert.equal(view.key,'red');assert.ok(!view.car.imported);view.dispose();
  console.error=()=>{};try{view=new DriftView3D(canvas(),{loadVehicle:()=>new Promise(r=>{resolve=r})});}finally{console.error=old;}
  view.dispose();resolve(template);await view.assetReady;assert.equal(view.scene.children.length,0);
  let reported=false;console.error=()=>{};try{view=new DriftView3D(canvas(),{loadVehicle:()=>Promise.reject(new Error('offline')),onVehicleFailure:()=>{reported=true}});}finally{console.error=old;}
  view.setSkin('yellow');await view.assetReady;assert.ok(reported);assert.equal(view.key,'yellow');assert.equal(view.car.wheels.length,4);view.dispose();
});

test('yellow tuning is unchanged despite the new model and name',()=>{
  const run=harness();
  assert.deepEqual(run("CAR_DATA.find(c=>c.sprite==='yellow').tune"),{engine:1.25,lat:1.05,hand:.90,drag:.95,mass:.92});
});

test('software renderer respects glTF UV orientation and alpha-cutout decals',async()=>{
  const {T}=await loaded,{SoftwareRenderer}=await import('../js/software-renderer.js');
  const c=canvas(),renderer=new SoftwareRenderer(c);renderer.setSize(32,32);
  const pixels=new Uint8ClampedArray([255,0,0,255,0,0,0,0,0,0,255,255,255,255,0,255]);
  const texture=new T.CanvasTexture({width:2,height:2,getContext:()=>({getImageData:()=>({data:pixels})})});texture.flipY=false;
  const geometry=new T.PlaneGeometry(2,2);geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
  const scene=new T.Scene();scene.background=new T.Color(0xffffff);scene.add(new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,alphaTest:.05})));
  const camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;camera.lookAt(0,0,0);renderer.render(scene,camera);
  const rgb=(x,y)=>Array.from(renderer.frame.data.slice((y*32+x)*4,(y*32+x)*4+3));
  assert.deepEqual(rgb(8,8),[255,0,0]);assert.deepEqual(rgb(24,8),[255,255,255]);assert.deepEqual(rgb(8,24),[0,0,255]);
});
