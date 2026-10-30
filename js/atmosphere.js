import * as T from '../vendor/three.module.min.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>n*n*(3-2*n);
const palettes=[{at:0,sky:0x708f9e,horizon:0x9fb4b6,sun:0xffe4c6,ground:0x56634a,ambient:2.3,direct:3.1},
  {at:.5,sky:0x514b71,horizon:0xd99d7c,sun:0xffa566,ground:0x484453,ambient:1.45,direct:1.8},
  {at:1,sky:0x09111e,horizon:0x26374e,sun:0x9fbfe6,ground:0x283346,ambient:.65,direct:.45}];
export function atmosphereAt(value=0){
  const t=clamp(Number(value)||0,0,1),a=t<.5?palettes[0]:palettes[1],b=t<.5?palettes[1]:palettes[2],f=smooth((t-a.at)/(b.at-a.at));
  const result={value:t,night:smooth(clamp((t-.28)/.62,0,1))};
  for(const key of ['sky','horizon','sun','ground'])result[key]=new T.Color(a[key]).lerp(new T.Color(b[key]),f);
  for(const key of ['ambient','direct'])result[key]=a[key]+(b[key]-a[key])*f;
  return result;
}
function radial(){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),im=ctx.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const d=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),i=(y*64+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=255;im.data[i+3]=Math.round(255*Math.max(0,1-d)**2);}
  ctx.putImageData(im,0,0);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function glowMaterial(map,color,opacity){return new T.MeshBasicMaterial({map,color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});}
function patch(track,x,z,radius,material){
  const geometry=new T.PlaneGeometry(radius*2,radius*2,6,6);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const px=x+p.getX(i),pz=z+p.getZ(i);p.setXYZ(i,px,(track.downhill?track.surfaceHeight(px,pz):globalThis.DriftRoadContact.terrain(track).height(px,pz))+.08,pz);}
  geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.renderOrder=2;return mesh;
}
export function buildStreetLights(track,world){
  const lamps=[],group=new T.Group();group.name='street-lighting';world.add(group);
  const map=radial(),poolMat=glowMaterial(map,0xffd593,0),haloMat=glowMaterial(map,0xffdfad,0),metal=new T.MeshStandardMaterial({color:0x283b43,roughness:.85}),bulb=new T.MeshBasicMaterial({color:0xffe5b5});
  const positions=[];
  if(track.downhill){for(let s=45;s<track.length-20;s+=105){const p=track.atDistance(s);positions.push({...p,n:track.normalAt(p.i),side:Math.floor(s/105)%2?1:-1});}}
  else{let distance=0,next=45;for(let i=1;i<track.points.length;i++){distance+=Math.hypot(track.points[i].x-track.points[i-1].x,track.points[i].y-track.points[i-1].y);if(distance>=next){positions.push({...track.points[i],h:0,n:track.normalAt(i),side:positions.length%2?1:-1});next+=105;}}}
  const poleGeo=new T.BoxGeometry(.17,8,.17),armGeo=new T.BoxGeometry(2,.15,.15),bulbGeo=new T.BoxGeometry(.9,.12,.4);
  for(const p of positions){
    const x=p.x+p.n.x*(track.roadHalf+2.6)*p.side,z=p.y+p.n.y*(track.roadHalf+2.6)*p.side,h=p.h||0;
    const pole=new T.Mesh(poleGeo,metal);pole.position.set(x,h+4,z);group.add(pole);
    const arm=new T.Mesh(armGeo,metal);arm.position.set(x-p.n.x*p.side,h+8,z-p.n.y*p.side);arm.rotation.y=-Math.atan2(p.n.y,p.n.x);group.add(arm);
    const light=new T.Mesh(bulbGeo,bulb);light.position.set(x-p.n.x*1.8*p.side,h+7.92,z-p.n.y*1.8*p.side);group.add(light);
    const halo=new T.Sprite(haloMat.clone());halo.position.copy(light.position);halo.scale.set(3.8,3.8,1);group.add(halo);
    const pool=patch(track,p.x+p.n.x*(track.roadHalf-1)*p.side,p.y+p.n.y*(track.roadHalf-1)*p.side,10,poolMat.clone());group.add(pool);
    lamps.push({light,halo,pool});
  }
  return {lamps,poolMat,haloMat,bulb};
}
export class Atmosphere{
  constructor(scene,hemi,sun){
    this.scene=scene;this.hemi=hemi;this.sun=sun;
    const c=document.createElement('canvas');c.width=4;c.height=128;this.skyCanvas=c;this.skyTexture=new T.CanvasTexture(c);this.skyTexture.colorSpace=T.SRGBColorSpace;
    this.beams=new T.Group();this.beams.name='car-headlights';scene.add(this.beams);
    const map=radial();this.haloMat=glowMaterial(map,0xffedbf,0);this.beamMat=new T.MeshBasicMaterial({color:0xffefca,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
    this.pool=new T.Mesh(new T.PlaneGeometry(10,34,4,6),glowMaterial(map,0xffe5ae,0));this.pool.geometry.rotateX(-Math.PI/2);this.poolBase=this.pool.geometry.attributes.position.array.slice();this.pool.renderOrder=3;this.pool.frustumCulled=false;scene.add(this.pool);
    this.halos=[];this.cones=[];
    for(let i=0;i<2;i++){
      const halo=new T.Sprite(this.haloMat);halo.scale.set(1.1,1.1,1);this.beams.add(halo);this.halos.push(halo);
      const cone=new T.Mesh(new T.ConeGeometry(2.4,19,8,1,true),this.beamMat);cone.rotation.z=Math.PI/2;this.beams.add(cone);this.cones.push(cone);
    }
    // One shared headlight source; street lights use inexpensive terrain decals.
    // No shadow maps, post-processing, or per-lamp dynamic lights.
    this.spot=new T.SpotLight(0xffedc5,0,58,.27,.75,1.4);this.spot.castShadow=false;this.beams.add(this.spot,this.spot.target);this.spot.position.set(1.7,.8,0);this.spot.target.position.set(35,-.8,0);
  }
  set(value){
    if(this.value===value)return;this.value=value;const state=this.state=atmosphereAt(value),ctx=this.skyCanvas.getContext('2d'),im=ctx.createImageData(4,128);
    const top=state.sky.clone().convertLinearToSRGB(),bottom=state.horizon.clone().convertLinearToSRGB();
    for(let y=0;y<128;y++){const t=Math.min(1,y/85);for(let x=0;x<4;x++){const i=(y*4+x)*4;for(const [k,key] of ['r','g','b'].entries())im.data[i+k]=Math.round(255*(top[key]+(bottom[key]-top[key])*t));im.data[i+3]=255;}}
    ctx.putImageData(im,0,0);this.skyTexture.needsUpdate=true;this.scene.background=this.skyTexture;
    this.scene.userData.sky={top:state.sky,bottom:state.horizon};this.scene.userData.daylight=1-state.night*.66;
    this.hemi.color.copy(state.horizon);this.hemi.groundColor.copy(state.ground);this.hemi.intensity=state.ambient;
    this.sun.color.copy(state.sun);this.sun.intensity=state.direct;this.sun.position.set(-110,180-state.night*130,60);
  }
  update(camera,car,track,street,{overview=false,garage=false,far=400}={}){
    const state=this.state||atmosphereAt(0),night=state.night;
    if(this.scene.fog)this.scene.fog.color.copy(state.horizon);
    if(street){street.poolMat.opacity=night*.58;street.haloMat.opacity=night*.48;street.bulb.color.copy(new T.Color(0xa9b5b5).lerp(new T.Color(0xffe5b5),night));
      for(const lamp of street.lamps){const d=camera.position.distanceTo(lamp.light.position),fade=overview?1:1-smooth(clamp((d-100)/120,0,1)),visible=night*fade>.001;lamp.pool.visible=visible;lamp.halo.visible=visible;lamp.pool.material.opacity=night*.58*fade;lamp.halo.material.opacity=night*.48*fade;}
    }
    this.beams.visible=!overview&&!garage&&night>.01;
    this.pool.visible=this.beams.visible;
    if(!this.beams.visible)return;
    this.beams.position.copy(car.root.position);this.beams.quaternion.copy(car.root.quaternion).multiply(car.body.quaternion);
    const front=car.headlights||[new T.Vector3(car.root.name.includes('Yugo')?1.72:2.1,.65,-.62),new T.Vector3(car.root.name.includes('Yugo')?1.72:2.1,.65,.62)];
    front.forEach((p,i)=>{this.halos[i].position.copy(p);this.cones[i].position.copy(p).add(new T.Vector3(9.5,-.5,0));this.cones[i].rotation.y=0;});
    this.beamMat.opacity=night*.016;this.haloMat.opacity=night*.56;this.spot.intensity=night*95;
    const p=this.pool.geometry.attributes.position,forward=new T.Vector3(1,0,0).applyQuaternion(car.root.quaternion),side=new T.Vector3(0,0,1).applyQuaternion(car.root.quaternion);
    this.pool.visible=Math.abs(car.root.position.y-(track.downhill?track.surfaceHeight(car.root.position.x,car.root.position.z):0))<2;
    if(this.pool.visible){for(let i=0;i<p.count;i++){const lateral=this.poolBase[i*3],ahead=this.poolBase[i*3+2]+19,x=car.root.position.x+forward.x*ahead+side.x*lateral,z=car.root.position.z+forward.z*ahead+side.z*lateral;p.setXYZ(i,x,(track.downhill?track.surfaceHeight(x,z):globalThis.DriftRoadContact.terrain(track).height(x,z))+.09,z);}p.needsUpdate=true;}
    this.pool.material.opacity=night*.62;
    // Imported pixel atlases stay readable but respond to the same atmosphere.
  }
  tintCar(car,garage=false){
    const strength=garage?1:1-(this.state?.night||0)*.54;
    car.root.traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material])if(material.isMeshBasicMaterial&&!material.transparent){material.userData.originalColor??=material.color.clone();material.color.copy(material.userData.originalColor).multiplyScalar(strength);}});
  }
  dispose(){this.skyTexture.dispose();}
}
