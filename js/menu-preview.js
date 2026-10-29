import * as T from '../vendor/three.module.min.js';
import {DriftView3D,disposeGroup} from './view3d.js';

const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.82,...extra});
function box(parent,m,x,y,z,w,h,d){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function concrete(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),im=ctx.createImageData(128,128);
  let seed=51;for(let i=0;i<im.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=190+(seed>>>27);im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v-3;im.data[i+3]=255;}ctx.putImageData(im,0,0);
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(8,8);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function garageScene(){
  const scene=new T.Scene();scene.background=new T.Color(0xc4c9c6);
  scene.add(new T.HemisphereLight(0xffffff,0x6b706a,2.7));
  const key=new T.DirectionalLight(0xfff7e8,3.2);key.position.set(4,8,5);scene.add(key);
  const fill=new T.DirectionalLight(0xdce9f0,1.3);fill.position.set(-5,4,-3);scene.add(fill);
  const wall=material(0xe1e3d9),floor=material(0x989e94,{map:concrete()}),skirt=material(0x747e78),metal=material(0x5c696a,{metalness:.45}),dark=material(0x223036),orange=material(0xff7544,{emissive:0xc94924,emissiveIntensity:.3});
  box(scene,floor,0,-.09,0,22,.18,20);
  box(scene,wall,0,2.8,-7,22,5.6,.2);box(scene,wall,-10,2.8,0,.2,5.6,14);box(scene,wall,10,2.8,0,.2,5.6,14);
  box(scene,wall,0,5.6,-1,20,.2,14);
  box(scene,skirt,0,.2,-6.86,20,.4,.08);for(const x of [-9.86,9.86])box(scene,skirt,x,.2,0,.08,.4,14);
  const seam=material(0x858d86);for(let x=-8;x<=8;x+=4)box(scene,seam,x,.004,0,.018,.008,18);for(let z=-6;z<=8;z+=4)box(scene,seam,0,.004,z,20,.008,.018);
  // Ceiling fixtures, cable rails and ventilation echo the supplied room.
  const light=new T.MeshBasicMaterial({color:0xf6ffed});
  for(const x of [-5,0,5])for(const z of [-3,2]){box(scene,metal,x,5.39,z,2.8,.12,.3);box(scene,light,x,5.31,z,2.62,.04,.22);}
  box(scene,dark,0,4.7,-6.8,19,.18,.16);
  const pipe=new T.Mesh(new T.CylinderGeometry(.14,.14,18,12),metal);pipe.rotation.z=Math.PI/2;pipe.position.set(0,5.02,-5.3);scene.add(pipe);
  for(const x of [-8,-2,4,8])box(scene,metal,x,5.22,-5.3,.07,.55,.36);
  for(const x of [-5.7,6.4]){box(scene,dark,x,3.1,-6.82,1.5,1.4,.14);box(scene,new T.MeshBasicMaterial({color:0xd5e5df}),x,3.1,-6.72,1.25,1.13,.02);box(scene,metal,x,3.1,-6.66,.055,1.13,.05);}
  // A shutter, workbench and restrained orange details keep it a working garage.
  box(scene,metal,-8,1.65,-6.8,3.1,3.3,.18);for(let y=.25;y<3.2;y+=.22)box(scene,skirt,-8,y,-6.68,2.95,.025,.04);
  box(scene,dark,7,.55,-5.8,3,1.1,.95);box(scene,metal,7,1.13,-5.8,3.2,.12,1.05);
  for(const x of [6,7,8]){box(scene,orange,x,.63,-5.3,.88,.65,.035);box(scene,metal,x,.78,-5.26,.42,.025,.025);}
  const label=document.createElement('canvas');label.width=512;label.height=128;const text=label.getContext('2d');text.fillStyle='#dce0d5';text.fillRect(0,0,512,128);text.fillStyle='#28383b';text.font='bold 48px Arial';text.textAlign='center';text.fillText('DR / GARAGE',256,76);
  const sign=new T.Mesh(new T.PlaneGeometry(3.2,.8),new T.MeshBasicMaterial({map:new T.CanvasTexture(label)}));sign.position.set(.1,2.9,-6.86);scene.add(sign);
  const platform=new T.Group();scene.add(platform);
  const base=new T.Mesh(new T.CylinderGeometry(3.65,3.75,.28,80),dark);base.position.y=.14;platform.add(base);
  const top=new T.Mesh(new T.CylinderGeometry(3.5,3.5,.025,80),material(0x3e4e51,{metalness:.35,roughness:.55}));top.position.y=.285;platform.add(top);
  const rim=new T.Mesh(new T.TorusGeometry(3.57,.025,6,96),orange);rim.rotation.x=Math.PI/2;rim.position.y=.292;platform.add(rim);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,mark=box(platform,skirt,Math.cos(a)*3.25,.303,Math.sin(a)*3.25,.2,.008,.055);mark.rotation.y=-a;}
  return {scene,platform};
}

export class MenuPreview3D extends DriftView3D{
  constructor(canvas,options={}){super(canvas,options);this.garage=garageScene();this.garageAngle=-.35;this.droneAngle=.6;this.previewMode=null;}
  setSkin(key,force=false){
    if(key===this.key&&!force)return;
    this.car.root.removeFromParent();this.ghostCar.root.removeFromParent();super.setSkin(key,force);
  }
  rotateBy(amount){if(this.previewMode==='garage')this.garageAngle+=amount;else this.droneAngle+=amount;}
  renderPreview({kind,track,skin='blue',dt=0,spinning=true}){
    const width=Math.max(1,this.canvas.clientWidth||800),height=Math.max(1,this.canvas.clientHeight||500);
    if(this.width!==width||this.height!==height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;}
    this.previewMode=kind;this.camera.near=.1;
    if(kind==='garage'){
      this.setSkin(skin);this.garage.platform.add(this.car.root);
      if(spinning)this.garageAngle+=Math.min(dt,.1)*.24;
      this.garage.platform.rotation.y=this.garageAngle;
      this.car.root.visible=true;this.car.root.position.set(0,.28,0);this.car.root.rotation.set(0,0,0);this.car.body.position.set(0,0,0);this.car.body.rotation.set(0,0,0);
      this.camera.fov=45;this.camera.far=100;
      const fit=Math.max(1,1.25/this.camera.aspect);this.camera.position.set(7.1*fit,Math.min(4.7,3.7*fit),7.8*fit);this.camera.lookAt(0,.8,0);this.camera.updateProjectionMatrix();
      this.renderer.render(this.garage.scene,this.camera);
    }else if(track){
      if(this.track!==track)this.build(track);
      this.car.root.visible=false;this.ghostCar.root.visible=false;this.smoke.visible=false;this.trails.visible=false;
      if(spinning)this.droneAngle+=Math.min(dt,.1)*.055;
      const b=track.bounds,cx=b.minX+b.w/2,cz=b.minY+b.h/2,radius=Math.hypot(b.w,b.h)/2+track.roadHalf+22;
      this.camera.fov=43;
      const fov=2*Math.atan(Math.tan(this.camera.fov*Math.PI/360)*Math.min(1,this.camera.aspect)),distance=radius/Math.sin(fov/2)*1.06;
      this.camera.far=distance+radius*8+1500;this.scene.fog=new T.Fog(0x9fb4b6,distance+radius*1.5,distance+radius*6);
      this.camera.position.set(cx+Math.cos(this.droneAngle)*distance*.45,distance*.89,cz+Math.sin(this.droneAngle)*distance*.45);this.camera.lookAt(cx,0,cz);this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene,this.camera);
    }
  }
  dispose(){disposeGroup(this.garage.scene);super.dispose();}
}
