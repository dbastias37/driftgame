import * as T from '../vendor/three.module.min.js';
import {SoftwareRenderer} from './software-renderer.js';
import {trackSurface,surfaceGeometry,raisedCurbGeometry,surfaceTiles} from './track-surface.js';
import {buildMountain} from './mountain-scene.js';
import {loadRX7,createRX7} from './rx7-model.js';
import {loadYugo,createYugo} from './yugo-model.js';
import {loadFujiwara,createFujiwara} from './fujiwara-model.js';
import {batchWorld,updateWorldVisibility} from './world-optimization.js';
import {Atmosphere,buildStreetLights} from './atmosphere.js';
const TAU=Math.PI*2;
const SKINS={fujiwara:{color:0xe8e8da,roof:1.335,length:4.215},yugo:{color:0xce362b,roof:1.335,length:3.49},blue:{color:0x276bdb,roof:1.28,length:4.2,spoiler:true},red:{color:0xd54232,roof:1.16,length:4.5,stripes:true},yellow:{color:0xe6b52b,roof:.95,length:4.45,spoiler:true},gray:{color:0x85979a,roof:1.35,length:3.85}};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed=812){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function disposeGroup(group){
  const gs=new Set(),ms=new Set(),ts=new Set();
  group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});
  gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());group.clear();
}
function mesh(g,m,parent,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
function mat(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.8,...extra});}
function box(parent,m,x,y,z,w,h,d){return mesh(new T.BoxGeometry(w,h,d),m,parent,x,y,z);}
function loft(parent,m,sections){
  const vertices=[],indices=[];
  for(const [x,y,w] of sections)vertices.push(x,.36,-w,x,.36,w,x,y,w,x,y,-w);
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+(j+1)%4,d=(i+1)*4+j;indices.push(a,d,b,b,d,c);}
  indices.push(0,1,3,1,2,3);const n=vertices.length/3-4;indices.push(n,n+3,n+1,n+1,n+3,n+2);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,m,parent);
}
function createCar(key,ghost=false){
  const style=SKINS[key]||SKINS.blue,root=new T.Group(),body=new T.Group();root.add(body);
  const paint=mat(style.color,{metalness:.42,roughness:.32}),black=mat(0x111a20),glass=mat(0x233d48,{metalness:.5,roughness:.17}),chrome=mat(0xc6d2d4,{metalness:.8,roughness:.3});
  const L=style.length;
  loft(body,paint,[[-L/2,.54,.78],[-L*.42,.79,.96],[L*.3,.75,.96],[L*.5,.54,.79]]);
  box(body,black,0,.35,0,L*.91,.12,1.87);
  loft(body,glass,[[-1.12,.79,.76],[-.68,style.roof,.69],[.48,style.roof,.68],[1.1,.77,.78]]);
  box(body,paint,-.1,style.roof+.025,0,1.18,.07,1.38);
  // B pillars and shoulder lines distinguish the window volumes.
  for(const z of [-.71,.71])box(body,paint,-.35,1.03,z,.1,.45,.06);
  for(const z of [-1,1]){box(body,paint,.66,.89,z,.24,.12,.22);box(body,chrome,-.45,.76,z*.965,.22,.035,.035);}
  box(body,black,L*.5+.01,.43,0,.07,.2,1.22);
  const headlights=mat(0xfff1c8,{emissive:0xffe6a6,emissiveIntensity:1.1});
  const tailmat=mat(0xdf2824,{emissive:0xff1e0d,emissiveIntensity:.65});
  for(const z of [-.63,.63]){
    box(body,headlights,L/2-.01,.59,z,.08,.12,.36);
    box(body,tailmat,-L/2-.03,.59,z,.06,.13,.37);
    box(body,chrome,-L/2-.05,.32,z,.15,.1,.14);
  }
  if(style.spoiler){for(const z of [-.64,.64])box(body,black,-1.75,.93,z,.09,.4,.09);box(body,paint,-1.78,1.12,0,.34,.1,2.04);}
  if(style.stripes)for(const z of [-.22,.22]){box(body,black,1.45,.754,z,.88,.015,.23);box(body,black,-.08,style.roof+.065,z,1.17,.012,.23);}
  const wheels=[];
  for(const x of [-1.3,1.27])for(const z of [-.98,.98]){
    const steer=new T.Group();steer.position.set(x,.38,z);root.add(steer);
    const spin=new T.Group();steer.add(spin);
    const tire=mesh(new T.CylinderGeometry(.36,.36,.24,16),black,spin);tire.rotation.x=Math.PI/2;
    const rim=mesh(new T.CylinderGeometry(.235,.235,.25,12),chrome,spin);rim.rotation.x=Math.PI/2;
    for(let i=0;i<5;i++){const spoke=box(spin,black,0,0,z>0?.132:-.132,.38,.035,.01);spoke.rotation.z=i/5*Math.PI;}
    wheels.push({steer,spin,front:x>0});
  }
  const shadow=mesh(new T.PlaneGeometry(L+1,3),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),root,0,.035,0);shadow.rotation.x=-Math.PI/2;shadow.renderOrder=-35;
  if(ghost)root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set(0x77f2e7);o.material.transparent=true;o.material.opacity=.24;o.material.depthWrite=false;}});
  return {root,body,wheels,tailmat};
}
function noiseTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),im=g.createImageData(256,256),r=rng(76);
  for(let i=0;i<im.data.length;i+=4){const v=62+Math.floor(r()*17);im.data[i]=v;im.data[i+1]=v+6;im.data[i+2]=v+7;im.data[i+3]=255;}g.putImageData(im,0,0);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;return t;
}
function curbTexture(){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=4;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#c85837';ctx.fillRect(0,0,32,4);ctx.fillStyle='#d7cec0';ctx.fillRect(32,0,32,4);
  const texture=new T.CanvasTexture(canvas);texture.wrapS=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;return texture;
}
function smokeTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#ffffffb0');gr.addColorStop(.3,'#ffffff65');gr.addColorStop(1,'#ffffff00');g.fillStyle=gr;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
export class DriftView3D{
  constructor(canvas,{quality='auto',onFailure=()=>{},loadVehicle=loadRX7,loadYugoVehicle=loadYugo,loadFujiwaraVehicle=loadFujiwara,onVehicleFailure=()=>{}}={}){
    this.canvas=canvas;this.onFailure=onFailure;
    try{this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}
    catch{this.renderer=new SoftwareRenderer(canvas);}
    this.software=!!this.renderer.software;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x9fb4b6);this.scene.fog=new T.Fog(0x9fb4b6,160,700);
    const hemi=new T.HemisphereLight(0xc7e4ee,0x56634a,2.3);this.scene.add(hemi);const sun=new T.DirectionalLight(0xffe4c6,3.1);sun.position.set(-110,180,60);this.scene.add(sun);this.atmosphere=new Atmosphere(this.scene,hemi,sun);this.atmosphere.set(0);
    this.camera=new T.PerspectiveCamera(58,1,.5,1200);this.world=new T.Group();this.scene.add(this.world);
    this.car=createCar('blue');this.scene.add(this.car.root);this.ghostCar=createCar('blue',true);this.scene.add(this.ghostCar.root);
    this.smokeTexture=smokeTexture();this.smokeGeo=new T.BufferGeometry();this.smokePos=new Float32Array(450*3);this.smokeGeo.setAttribute('position',new T.BufferAttribute(this.smokePos,3).setUsage(T.DynamicDrawUsage));
    this.smokeMat=new T.PointsMaterial({color:0xdde8e8,map:this.smokeTexture,size:2.8,transparent:true,opacity:.23,depthWrite:false,sizeAttenuation:true});
    this.smoke=new T.Points(this.smokeGeo,this.smokeMat);this.smoke.frustumCulled=false;this.scene.add(this.smoke);
    this.trailGeo=new T.BufferGeometry();this.trailPos=new Float32Array(3000*2*6*3);this.trailGeo.setAttribute('position',new T.BufferAttribute(this.trailPos,3).setUsage(T.DynamicDrawUsage));
    this.trails=new T.Mesh(this.trailGeo,new T.MeshBasicMaterial({color:0x131b20,transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide}));this.trails.frustumCulled=false;this.trails.renderOrder=-40;this.scene.add(this.trails);
    this.key='blue';this.distance=1;this.resetCamera();this.setQuality(quality);
    this.assetReady=loadVehicle?loadVehicle().then(template=>{if(this.disposed)return;this.rx7Template=template;if(this.key==='yellow')this.setSkin('yellow',true);}).catch(error=>{if(!this.disposed)onVehicleFailure(error);}):Promise.resolve();
    this.yugoReady=loadYugoVehicle?loadYugoVehicle().then(template=>{if(this.disposed)return;this.yugoTemplate=template;if(this.key==='yugo')this.setSkin('yugo',true);}).catch(error=>{if(!this.disposed)onVehicleFailure(error);}):Promise.resolve();
    this.fujiwaraReady=loadFujiwaraVehicle?loadFujiwaraVehicle().then(template=>{if(this.disposed)return;this.fujiwaraTemplate=template;if(this.key==='fujiwara')this.setSkin('fujiwara',true);}).catch(error=>{if(!this.disposed)onVehicleFailure(error);}):Promise.resolve();
    this.trailCache=new WeakMap();
    this.contextLost=e=>{e.preventDefault();this.onFailure(new Error('WebGL context lost'));};canvas.addEventListener('webglcontextlost',this.contextLost);
  }
  setQuality(q){this.quality=q;this.low=this.software||q==='low'||(q==='auto'&&(innerWidth<700||navigator.hardwareConcurrency<=4));this.pixelRatio=Math.min(devicePixelRatio||1,this.low?1:1.5);this.renderer.setPixelRatio(this.pixelRatio);this.width=0;this.track=null;}
  setTimeOfDay(value){this.atmosphere.set(value);}
  adaptResolution(dt){
    if(this.quality!=='auto'||this.software||!(dt>0&&dt<.2))return;
    this.frameAverage=(this.frameAverage||1/60)*.97+dt*.03;this.qualityTime=(this.qualityTime||0)+dt;
    if(this.qualityTime<3)return;this.qualityTime=0;
    const next=clamp(this.pixelRatio+(this.frameAverage>1/42?-.15:this.frameAverage<1/58?.1:0),.65,Math.min(devicePixelRatio||1,this.low?1:1.5));
    if(Math.abs(next-this.pixelRatio)>.01){this.pixelRatio=next;this.renderer.setPixelRatio(next);this.width=0;}
  }
  resetCamera(){this.cameraReady=false;}
  zoomBy(m){this.distance=clamp(this.distance*m,.65,1.9);}
  build(track){
    disposeGroup(this.world);this.trailCache=new WeakMap();this.track=track;const r=rng(),b=track.bounds,cx=b.minX+b.w/2,cz=b.minY+b.h/2,half=track.roadHalf;
    if(track.downhill){buildMountain(track,this.world,this.low);this.streetLights=buildStreetLights(track,this.world);batchWorld(this.world);return;}
    const asphaltTexture=noiseTexture(),kerbTexture=curbTexture();
    asphaltTexture.anisotropy=Math.min(8,this.renderer.capabilities?.getMaxAnisotropy()||1);
    kerbTexture.anisotropy=asphaltTexture.anisotropy;
    const ground=mesh(new T.PlaneGeometry(Math.max(2200,b.w+1200),Math.max(2200,b.h+1200)),mat(0x526253,{polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}),this.world,cx,-.12,cz);ground.rotation.x=-Math.PI/2;ground.renderOrder=-100;
    const materials={
      asphalt:mat(0xaeb7ba,{map:asphaltTexture,roughness:.96}),
      edge:mat(0xdde0d3),curb:mat(0xffffff,{map:kerbTexture}),
      runoff:mat(0x7a8074),centerLine:mat(0xcfc8a3),
    };
    // Adjacent regions retain their footprint; only the curb has a rounded
    // height profile, shared with the four-wheel terrain contact simulation.
    const layout=trackSurface(track);
    for(const [name,region] of Object.entries(layout.regions)){
      const geometry=name==='curb'?raisedCurbGeometry(track,layout.curbContours):surfaceGeometry(region);
      const pieces=name==='curb'?surfaceTiles(geometry):[geometry];
      if(name==='curb')geometry.dispose();
      for(const piece of pieces){const surface=mesh(piece,materials[name],this.world);surface.name='track-'+name;surface.renderOrder=-90;}
    }
    const o=new T.Object3D();
    // Start gantry and checkers follow the same start normal as the 2D circuit.
    const start=track.point(0),a=track.tangentAt(0),gate=new T.Group();gate.position.set(start.x,0,start.y);gate.rotation.y=-a;this.world.add(gate);
    const metal=mat(0x283b43),orange=mat(0xf47345),white=mat(0xf1ece0);
    for(const sign of [-1,1])box(gate,metal,0,3.7,sign*(half+3),.55,7.4,.55);
    box(gate,metal,0,7.4,0,.75,.85,(half+3)*2);box(gate,orange,.4,7.4,0,.08,.32,half*1.5);
    for(let row=0;row<2;row++)for(let j=0;j<Math.ceil(half*2);j++){const check=box(gate,(j+row)%2?white:metal,row*.65,.055,j-half+.5,.65,.025,1);check.renderOrder=-55;}
    const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=64;const sg=signCanvas.getContext('2d');sg.fillStyle='#17242b';sg.fillRect(0,0,512,64);sg.fillStyle='#e8ece4';sg.font='bold 40px Arial';sg.textAlign='center';sg.fillText('DRIFT / RACER',256,46);const signTexture=new T.CanvasTexture(signCanvas);signTexture.colorSpace=T.SRGBColorSpace;
    const sign=mesh(new T.PlaneGeometry(Math.min(10,half),1.15),new T.MeshBasicMaterial({map:signTexture,side:T.DoubleSide}),gate,-.45,7.4,0);sign.rotation.y=-Math.PI/2;
    // Distant scenery stays beyond runoff; no new collision rules are introduced.
    const treeGeo=new T.ConeGeometry(2.2,7,5),treeMat=mat(0x284b43),trunkMat=mat(0x514b3c),trees=new T.InstancedMesh(treeGeo,treeMat,200),trunks=new T.InstancedMesh(new T.CylinderGeometry(.22,.35,3,5),trunkMat,200);
    let ti=0;const treeLimit=this.low?65:200;for(let attempt=0;attempt<700&&ti<treeLimit;attempt++){
      const x=cx+(r()-.5)*(b.w+180),z=cz+(r()-.5)*(b.h+180),idx=track.nearestIndex(x,z),p=track.point(idx);if(Math.hypot(x-p.x,z-p.y)<half+15)continue;
      const scale=.7+r()*.9;o.position.set(x,5*scale,z);o.rotation.set(0,r()*TAU,0);o.scale.setScalar(scale);o.updateMatrix();trees.setMatrixAt(ti,o.matrix);o.position.y=1.5*scale;o.updateMatrix();trunks.setMatrixAt(ti,o.matrix);ti++;
    }trees.count=trunks.count=ti;this.world.add(trees,trunks);
    const mountainMat=mat(0x728a84);for(let i=0;i<14;i++){const a=i/14*TAU,rad=Math.max(b.w,b.h)*.7+350;const m=mesh(new T.ConeGeometry(65+r()*100,70+r()*100,5),mountainMat,this.world,cx+Math.cos(a)*rad,20,cz+Math.sin(a)*rad);m.rotation.y=r()*TAU;}
    // Track-side marker posts, pit sheds, and floodlights give scale to the world.
    const postGeo=new T.BoxGeometry(.16,1.2,.16),posts=new T.InstancedMesh(postGeo,white,layout.markers.length);let pi=0;
    for(const p of layout.markers){o.position.set(p.x,.6,p.z);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();posts.setMatrixAt(pi++,o.matrix);}posts.count=pi;this.world.add(posts);
    const pit=new T.Group();pit.position.set(start.x,0,start.y);pit.rotation.y=-a;this.world.add(pit);
    for(let i=0;i<4;i++){const z=half+16;box(pit,mat(i%2?0x647774:0x334c56),-13+i*9,2.5,z,7,5,8);box(pit,metal,-13+i*9,5.15,z,7.6,.35,8.6);box(pit,mat(0x17282f),-13+i*9,2,z-4.02,5,3.6,.06);box(pit,orange,-13+i*9,4.3,z-4.05,5,.2,.06);}
    this.streetLights=buildStreetLights(track,this.world);batchWorld(this.world);
  }
  setSkin(key,force=false){
    if(key===this.key&&!force)return;
    this.scene.remove(this.car.root,this.ghostCar.root);disposeGroup(this.car.root);disposeGroup(this.ghostCar.root);
    this.car=key==='fujiwara'&&this.fujiwaraTemplate?createFujiwara(this.fujiwaraTemplate):key==='yugo'&&this.yugoTemplate?createYugo(this.yugoTemplate):key==='yellow'&&this.rx7Template?createRX7(this.rx7Template):createCar(key);
    this.ghostCar=key==='fujiwara'&&this.fujiwaraTemplate?createFujiwara(this.fujiwaraTemplate,true):key==='yugo'&&this.yugoTemplate?createYugo(this.yugoTemplate,true):key==='yellow'&&this.rx7Template?createRX7(this.rx7Template,true):createCar(key,true);
    this.scene.add(this.car.root,this.ghostCar.root);this.key=key;
  }
  placeOnRoad(model,pose,skin,ride=null){
    const contact=ride||globalThis.DriftRoadContact.contacts(this.track,pose,skin);
    const mountain=!!this.track.downhill;
    model.root.position.y=mountain?contact.height:0;
    model.body.position.y=mountain?0:contact.height;
    model.body.rotation.x=contact.roll;model.body.rotation.z=contact.pitch;
    for(const wheel of model.wheels){
      wheel.baseY??=wheel.steer.position.y;
      const support=contact.wheels.find(p=>(p.x>0)===wheel.front&&(p.z>0)===(wheel.steer.position.z>0));
      wheel.steer.position.y=wheel.baseY+(support?.height||0)-(mountain?contact.height:0);
    }
    return contact;
  }
  effects(player){
    const particles=player.smoke||[],count=Math.min(particles.length,this.low?140:450),stride=Math.max(1,Math.floor(particles.length/Math.max(1,count)));
    for(let i=0;i<count;i++){const p=particles[i*stride];this.smokePos[i*3]=p.x;this.smokePos[i*3+1]=(this.track.downhill?this.track.surfaceHeight(p.x,p.y):0)+.4+p.life*.75;this.smokePos[i*3+2]=p.y;}
    this.smokeGeo.setDrawRange(0,count);this.smokeGeo.attributes.position.needsUpdate=true;
    const trails=player.tireTrails||[],start=Math.max(1,trails.length-(this.low?1200:3000));let v=0;
    const range=this.drawFar||400;
    for(let i=start;i<trails.length;i++){
      const a=trails[i-1],b=trails[i];if(Math.hypot(b.x1-a.x1,b.y1-a.y1)>3||Math.hypot(b.x1-player.pos.x,b.y1-player.pos.y)>range)continue;
      let data=this.trailCache.get(b);
      if(!data){
        data=new Float32Array(36);let j=0;
        for(const side of [1,2]){const x=a['x'+side],z=a['y'+side],xx=b['x'+side],zz=b['y'+side],d=Math.hypot(xx-x,zz-z)||1,nx=-(zz-z)/d*.1,nz=(xx-x)/d*.1;
          for(const p of [[x+nx,z+nz],[xx+nx,zz+nz],[x-nx,z-nz],[x-nx,z-nz],[xx+nx,zz+nz],[xx-nx,zz-nz]]){data[j++]=p[0];data[j++]=(this.track.downhill?this.track.surfaceHeight(p[0],p[1]):0)+.065;data[j++]=p[1];}
        }
        this.trailCache.set(b,data);
      }
      this.trailPos.set(data,v);v+=data.length;
    }
    this.trailGeo.setDrawRange(0,v/3);this.trailGeo.attributes.position.needsUpdate=true;
  }

  render({track,player,ghost,skin='blue',dt=0,inMenu=false,time=0,camera='chase',motion='full',timeOfDay=0}){
    if(!track||!player)return;this.setTimeOfDay(timeOfDay);this.adaptResolution(dt);if(this.track!==track){this.build(track);this.resetCamera();}this.setSkin(skin);
    const w=innerWidth,h=innerHeight;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
    const p=player.pos,a=player.angle,speed=player.worldSpeed();this.car.root.position.set(p.x,0,p.y);this.car.root.rotation.set(0,-a,0,'YXZ');
    const ride=this.placeOnRoad(this.car,player,skin,player.ride);
    const descent=player.descent,falling=this.track.downhill&&descent?.motion==='falling';
    if(this.track.downhill&&descent){
      this.car.body.rotation.z=descent.pitch;
      if(falling){
        this.car.body.position.set(0,0,0);this.car.body.rotation.set(0,0,0);this.car.root.rotation.set(descent.roll,-a,descent.pitch,'YXZ');
        const center=new T.Vector3(0,player.bodyDimensions?.cgHeight||.65,0).applyEuler(this.car.root.rotation);this.car.root.position.set(p.x-center.x,descent.y-center.y,p.y-center.z);
        for(const wheel of this.car.wheels)wheel.steer.position.y=wheel.baseY;
      }
      this.car.root.traverse(o=>{if(o.isMesh&&o.material.transparent&&o.material.opacity===.23)o.visible=!falling;});
    }
    this.car.body.rotation.x+=motion==='reduced'?0:clamp(player.omega*speed*.002,-.055,.055);
    for(const wheel of this.car.wheels){
      wheel.steer.rotation.y=wheel.front?-player.steerAngle:0;
      const rollingSpeed=this.car.imported&&player.vel?player.vel.x*Math.cos(a)+player.vel.y*Math.sin(a):speed;
      wheel.spin.rotation.z-=rollingSpeed*dt/(wheel.radius||.36);
    }
    if(this.car.tailmat)this.car.tailmat.emissiveIntensity=player.handbrake?2:.65;
    this.ghostCar.root.visible=!!(ghost?.visible&&ghost.data?.samples?.length&&!inMenu);
    if(this.ghostCar.root.visible){const gp=ghost._sample();this.ghostCar.root.position.set(gp.x,0,gp.y);this.ghostCar.root.rotation.y=-gp.angle;this.placeOnRoad(this.ghostCar,{pos:gp,angle:gp.angle},skin);}
    this.camera.near=.3;this.drawFar=this.low?290:440;this.scene.fog.near=this.drawFar*.38;this.scene.fog.far=this.drawFar;this.camera.far=this.drawFar+80;
    this.effects(player);this.car.root.visible=camera!=='hood'||inMenu;
    const desired=new T.Vector3(),target=new T.Vector3(),alpha=1-Math.exp(-Math.min(dt,.1)*5),angleDelta=Math.atan2(Math.sin(a-(this.yaw??a)),Math.cos(a-(this.yaw??a)));
    this.yaw=this.cameraReady?(this.yaw+angleDelta*(motion==='reduced'?1:alpha)):a;
    const yaw=this.yaw,f=new T.Vector3(Math.cos(yaw),0,Math.sin(yaw)),right=new T.Vector3(-f.z,0,f.x);
    if(inMenu){const orbit=motion==='reduced'?0:Math.sin(time*.12)*.18;const ma=a-1.05+orbit;desired.set(p.x-Math.cos(ma)*10,4.1,p.y-Math.sin(ma)*10);target.set(p.x,0.6,p.y);const offset=w>600?2.9:0;const screenRight=new T.Vector3().subVectors(target,desired).cross(new T.Vector3(0,1,0)).normalize();target.addScaledVector(screenRight,-offset);this.camera.fov=43;}
    else if(camera==='aerial'){desired.set(p.x-22*this.distance,38*this.distance,p.y+24*this.distance);target.set(p.x+f.x*4,0,p.y+f.z*4);this.camera.fov=52;}
    else if(camera==='hood'){desired.set(p.x+Math.cos(a)*.65,1.35+ride.height,p.y+Math.sin(a)*.65);target.set(p.x+Math.cos(a)*30,1.1+ride.height,p.y+Math.sin(a)*30);this.camera.fov=76;}
    else{const d=(12.5+Math.min(speed,45)*.075)*this.distance;desired.set(p.x-f.x*d,6.5*this.distance,p.y-f.z*d);target.set(p.x+f.x*7,0.6,p.y+f.z*7);this.camera.fov=58+(motion==='reduced'?0:Math.min(speed*.12,7));}
    if(this.track.downhill&&!inMenu){
      const elevation=falling?descent.y:ride.height;
      if(camera!=='hood'){desired.y+=elevation;target.y+=elevation;}
      if(falling){desired.set(p.x-f.x*16,elevation+10,p.y-f.z*16);target.set(p.x,elevation,p.y);this.car.root.visible=true;}
      desired.y=Math.max(desired.y,this.track.terrainHeight(desired.x,desired.z)+1.8);
    }
    if(!this.cameraReady||inMenu||camera==='hood'||motion==='reduced')this.camera.position.copy(desired);else this.camera.position.lerp(desired,alpha);
    if(!this.look)this.look=target.clone();if(!this.cameraReady||inMenu||camera==='hood'||motion==='reduced')this.look.copy(target);else this.look.lerp(target,alpha);
    this.camera.lookAt(this.look);this.camera.updateProjectionMatrix();this.cameraReady=true;
    updateWorldVisibility(this.world,this.camera,this.drawFar);this.atmosphere.update(this.camera,this.car,track,this.streetLights,{far:this.drawFar});this.atmosphere.tintCar(this.car);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.atmosphere.dispose();disposeGroup(this.scene);this.renderer.dispose();}
}
