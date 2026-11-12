import * as T from '../vendor/three.module.min.js';
import './game-options.js?v=1.0.0-prealpha.21';
import {cloudTexture} from './smoke-renderer.js?v=1.0.0-prealpha.21';
import {SnowMotion} from './snow-motion.js?v=1.0.0-prealpha.21';
const fract=n=>n-Math.floor(n),random=n=>fract(Math.sin(n*78.233+12.9898)*43758.5453);
const corners=[0,1,2,2,1,3];

export class WeatherEffects{
  constructor(scene){
    this.root=new T.Group();this.root.name='weather';scene.add(this.root);this.scene=scene;this.materials=new WeakMap();
    this.cloudMap=cloudTexture();this.clouds=[];
    for(let i=0;i<14;i++){const m=new T.SpriteMaterial({map:this.cloudMap,color:0xb1bec5,transparent:true,opacity:0,depthWrite:false,fog:false});const cloud=new T.Sprite(m);cloud.scale.set(48+random(i)*38,14+random(i+20)*12,1);this.root.add(cloud);this.clouds.push(cloud);}
    this.limit=360;this.positions=new Float32Array(this.limit*18);this.colors=new Float32Array(this.limit*24);this.geometry=new T.BufferGeometry();
    const uv=new Float32Array(this.limit*12);
    for(let i=0;i<this.limit;i++)for(let j=0;j<6;j++){uv[(i*6+j)*2]=corners[j]%2;uv[(i*6+j)*2+1]=corners[j]<2?1:0;}
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));this.geometry.setDrawRange(0,0);
    this.rain=new T.Mesh(this.geometry,new T.MeshBasicMaterial({color:0xbad1df,map:this.cloudMap,vertexColors:true,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide}));this.rain.name='rain-streaks';this.rain.frustumCulled=false;this.geometry.boundingSphere=new T.Sphere(new T.Vector3(),1e7);this.rain.userData.retroSkip=true;this.root.add(this.rain);
    this.flakes=Array.from({length:this.limit},()=>({x:0,y:0,z:0,generation:0,ground:0,sheltered:false}));
    this.motion=new SnowMotion();this.lastCamera=new T.Vector3();this.right=new T.Vector3();this.up=new T.Vector3();this.forward=new T.Vector3();this.axis=new T.Vector3();this.side=new T.Vector3();this.viewDirection=new T.Vector3();this.cameraVelocity=new T.Vector3();this.frame=0;
  }
  wetRoad(world,wet){
    if(this.wet===wet&&this.world===world&&this.worldChild===world.children[0])return;this.wet=wet;this.world=world;this.worldChild=world.children[0];
    world.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material;if(!material?.userData.roadSurface)return;
      let original=this.materials.get(material);if(!original){original={color:material.color.clone(),roughness:material.roughness,metalness:material.metalness};this.materials.set(material,original);}
      material.color.copy(original.color).multiplyScalar(1-wet*.30);material.roughness=original.roughness*(1-wet*.72);material.metalness=original.metalness+wet*.12;
    });
  }
  ground(track,x,z){return track.elevated?track.surfaceHeight(x,z):track.downhill?track.terrainHeight(x,z):0;}
  sheltered(track,x,y,z){
    if(!track.elevated)return false;
    const q=track.sampleNearby(x,z),f=q&&track.featureAt(q.s,'tunnel');
    return !!(f&&q.distance<(track.nfs?track.widthAt(q.s)+1:track.tunnelHalf||22)&&y<q.h+(f.clearance||30));
  }
  spawn(f,i,camera,track,initial=false){
    const seed=i+f.generation++*1543,side=(random(seed+100)-.5)*56,ahead=initial?2+random(seed+500)*60:12+random(seed+500)*54;
    f.x=camera.position.x+this.right.x*side+this.forward.x*ahead;f.z=camera.position.z+this.right.z*side+this.forward.z*ahead;
    f.ground=this.ground(track,f.x,f.z);f.y=Math.max(f.ground+.2,camera.position.y-7)+random(seed+800)*24;
    f.sheltered=this.sheltered(track,f.x,f.y,f.z);
  }
  quad(i,x,y,z,axis,side,width,opacity){
    for(let j=0;j<6;j++){const a=corners[j],top=a<2?1:-1,sign=a%2?1:-1,k=(i*6+j)*3,q=(i*6+j)*4;
      this.positions[k]=x+axis.x*top+side.x*width*sign;this.positions[k+1]=y+axis.y*top+side.y*width*sign;this.positions[k+2]=z+axis.z*top+side.z*width*sign;
      this.colors[q]=this.colors[q+1]=this.colors[q+2]=1;this.colors[q+3]=opacity;
    }
  }
  update({camera,world,track,player=null,weather='clear',time=0,dt,reset=false,low=false,overview=false,reduced=false}){
    const state=DriftOptions.weathers[weather]||DriftOptions.weathers.clear;this.wetRoad(world,state.wet);
    const elapsed=this.lastTime===undefined?0:time-this.lastTime,travel=camera.position.distanceTo(this.lastCamera);
    const restart=reset||this.lastTrack!==track||this.lastWeather!==weather||elapsed<0||elapsed>.35||travel>65;
    if(!restart&&elapsed===0&&this.lastTime!==undefined&&!overview&&!this.wasOverview)return;
    this.wasOverview=overview;
    // Simulation time is authoritative: pause does not keep snow falling, and
    // seek/camera cuts reset velocity instead of producing a full-screen streak.
    const step=elapsed>0?Math.min(.1,Number.isFinite(dt)?Math.max(0,dt):elapsed):0;
    this.cameraVelocity.set(0,0,0);
    if(!restart&&step>0)this.cameraVelocity.subVectors(camera.position,this.lastCamera).multiplyScalar(1/step).clampLength(0,100);
    const response=this.motion.update(player,step,restart,reduced);this.snowState=response.state;this.snowResponse=response;
    this.lastCamera.copy(camera.position);this.lastTime=time;this.lastTrack=track;this.lastWeather=weather;
    const covered=this.sheltered(track,camera.position.x,camera.position.y,camera.position.z);
    this.root.visible=!overview&&!covered&&(state.cloud>0||state.rain>0||state.snow>0);
    if(overview){this.geometry.setDrawRange(0,0);return;}
    const base=this.ground(track,camera.position.x,camera.position.z),night=this.scene.userData.night||0;
    for(let i=0;i<this.clouds.length;i++){const c=this.clouds[i],a=i/14*Math.PI*2+time*.002,rad=95+random(i+70)*110;c.position.set(camera.position.x+Math.cos(a)*rad,base+34+random(i+50)*23,camera.position.z+Math.sin(a)*rad);c.material.opacity=state.cloud*.48;c.material.color.setRGB(.55-night*.35,.60-night*.36,.64-night*.35);}
    const snow=state.snow||0;this.rain.name=snow?'snow-flakes':'rain-streaks';this.rain.material.color.setHex(snow?0xf1f6ff:0xbad1df);this.rain.material.opacity=snow?.85:.65;
    const count=Math.round((low?120:this.limit)*(snow||state.rain));this.rain.visible=count>0;
    this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);this.forward.set(0,0,-1).applyQuaternion(camera.quaternion);this.forward.y=0;this.forward.normalize();
    if(step>0)this.frame++;
    for(let i=0;i<count;i++){
      if(snow){
        const f=this.flakes[i];if(restart||!f.generation)this.spawn(f,i,camera,track,true);
        const flutter=response.flutter*(.4+random(i+60)),vx=.55+Math.sin(time*1.7+i)*flutter,vz=.25+Math.cos(time*1.1+i*2)*flutter,vy=-response.settle*(.6+random(i+900)*.7);
        f.x+=vx*step;f.z+=vz*step;f.y+=vy*step;
        let dx=f.x-camera.position.x,dz=f.z-camera.position.z,ahead=dx*this.forward.x+dz*this.forward.z;
        if(step>0&&(dx*dx+dz*dz>80**2||ahead< -8||f.y<f.ground+.08||f.y>camera.position.y+30)){this.spawn(f,i,camera,track);dx=f.x-camera.position.x;dz=f.z-camera.position.z;ahead=dx*this.forward.x+dz*this.forward.z;}
        if(step>0&&(this.frame+i)%12===0){f.ground=this.ground(track,f.x,f.z);f.sheltered=this.sheltered(track,f.x,f.y,f.z);}
        // Project relative airflow onto the image plane. Under acceleration the
        // exposure grows; braking relaxes it, and lateral drift changes its angle.
        this.axis.set(vx-this.cameraVelocity.x,vy-this.cameraVelocity.y,vz-this.cameraVelocity.z);
        this.viewDirection.set(f.x-camera.position.x,f.y-camera.position.y,f.z-camera.position.z).normalize();
        this.axis.addScaledVector(this.viewDirection,-this.axis.dot(this.viewDirection));
        const length=Math.min(reduced?.26:.9,.045+this.axis.length()*response.exposure);
        if(this.axis.lengthSq()<.0001)this.axis.copy(this.up);this.axis.normalize();
        this.side.crossVectors(this.axis,this.viewDirection).normalize();this.axis.multiplyScalar(length*.5);
        const fade=Math.min(1,Math.max(0,ahead)/4)*Math.min(1,Math.max(0,80-Math.hypot(dx,dz))/18),density=random(i+1800)<response.density?1:0;
        this.quad(i,f.x,f.y,f.z,this.axis,this.side,response.width*(.7+random(i+700)),f.sheltered||f.y<=f.ground?0:fade*density*(.5+snow*.35));
      }else{
        const side=(random(i+100)-.5)*42,ahead=3+random(i+500)*43,x=camera.position.x+this.right.x*side+this.forward.x*ahead,z=camera.position.z+this.right.z*side+this.forward.z*ahead;
        const ground=this.ground(track,x,z),h=ground+fract(random(i+800)-time*(.75+random(i+900)*.35))*18,len=.55+random(i+700)*.55,width=.018+random(i)*.012;
        const opacity=this.sheltered(track,x,h,z)?0:(1-ahead/60)*(.45+state.rain*.4);
        this.axis.set(.065*state.rain,len/2,0);this.quad(i,x,h+len/2,z,this.axis,this.right,width,opacity);
      }
    }
    this.geometry.setDrawRange(0,count*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
  dispose(){this.cloudMap.dispose();this.geometry.dispose();this.rain.material.dispose();for(const c of this.clouds)c.material.dispose();this.root.removeFromParent();}
}
