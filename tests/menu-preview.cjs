const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./harness.cjs');
function canvas(){
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},fillRect(){},fillText(){},createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})};
 return {width:256,height:256,clientWidth:800,clientHeight:500,style:{},getContext:t=>t==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
}
async function setup(){
 global.self=global;global.document={createElement:canvas};global.innerWidth=800;global.innerHeight=560;global.devicePixelRatio=1;global.createImageBitmap=async()=>({width:1,height:1});
 const T=await import('../vendor/three.module.min.js'),{MenuPreview3D}=await import('../js/menu-preview.js'),{parseRX7}=await import('../js/rx7-model.js');
 const b=fs.readFileSync('assets/models/rx7-fd-redsuns.glb'),template=await parseRX7(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const c=canvas(),old=console.error;console.error=()=>{};let view;try{view=new MenuPreview3D(c,{loadVehicle:()=>Promise.resolve(template)});}finally{console.error=old;}await view.assetReady;
 return {T,view,c};
}
function track(data){
 const p=data.points,N=p.length,x=p.map(p=>p.x),y=p.map(p=>p.y);
 return {...data,bounds:{minX:Math.min(...x),minY:Math.min(...y),w:Math.max(...x)-Math.min(...x),h:Math.max(...y)-Math.min(...y)},point(i){return p[(i+N)%N]},normalAt(i){const a=this.point(i-1),b=this.point(i+1),d=Math.hypot(b.x-a.x,b.y-a.y);return{x:-(b.y-a.y)/d,y:(b.x-a.x)/d}},tangentAt(i){const a=this.point(i),b=this.point(i+1);return Math.atan2(b.y-a.y,b.x-a.x)},nearestIndex(x,y){let best=0,d=Infinity;p.forEach((p,i)=>{const n=(x-p.x)**2+(y-p.y)**2;if(n<d){best=i;d=n}});return best}};
}
test('all 20 real circuits fit the drone camera; long-distance software render is visible and immutable',async()=>{
 const {T,view,c}=await setup(),r=harness();
 for(let n=1;n<=20;n++){
  const tr=track(r(`CircuitLayouts.build(${n})`)),before=JSON.stringify(tr);
  // Alternate landscape / narrow portrait and rotate through a full orbit.
  c.clientWidth=n%2?800:320;c.clientHeight=500;view.droneAngle=n*.47;
  view.renderPreview({kind:'track',track:tr,spinning:false});
  assert.equal(JSON.stringify(tr),before);assert.equal(view.camera.aspect,c.clientWidth/c.clientHeight);
  for(const p of tr.points){const v=new T.Vector3(p.x,0,p.y).project(view.camera);assert.ok(Math.abs(v.x)<.97&&Math.abs(v.y)<.97&&v.z<1,`L${n}: clipped circuit`);}
  const colors=new Set();for(let k=0;k<view.renderer.frame.data.length;k+=16)colors.add(view.renderer.frame.data.slice(k,k+3).join(','));
  assert.ok(colors.size>8,`L${n}: blank/fogged drone view`);
 }
 view.dispose();
});
test('garage rotates the platform and four supported cars without leaking roots, including the real RX-7',async()=>{
 const {T,view,c}=await setup();let count=null;
 for(const skin of ['blue','red','yellow','gray','yellow']){
  view.renderPreview({kind:'garage',skin,dt:.1,spinning:true});
  assert.equal(view.car.root.parent,view.garage.platform);assert.equal(view.car.wheels.length,4);
  if(skin==='yellow')assert.ok(view.car.imported);
  const n=view.garage.platform.children.length;if(count===null)count=n;else assert.equal(n,count);
  for(const wheel of view.car.wheels){const b=new T.Box3().setFromObject(wheel.spin);assert.ok(Math.abs(b.min.y-.3)<.025,'Tires touch the platform');}
  const angle=view.garageAngle;view.renderPreview({kind:'garage',skin,dt:.1,spinning:false});assert.equal(view.garageAngle,angle);
  view.rotateBy(.5);assert.equal(view.garageAngle,angle+.5);
 }
 c.clientWidth=280;c.clientHeight=500;view.renderPreview({kind:'garage',skin:'yellow',spinning:false});
 assert.ok(view.camera.position.y<5.3,'Camera stays below the ceiling');
 for(const wheel of view.car.wheels){const v=wheel.steer.getWorldPosition(new T.Vector3()).project(view.camera);assert.ok(Math.abs(v.x)<1&&Math.abs(v.y)<1);}
 view.dispose();
});
