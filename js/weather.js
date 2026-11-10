import * as T from '../vendor/three.module.min.js';
import './game-options.js?v=1.0.0-prealpha.7';
import {cloudTexture} from './smoke-renderer.js?v=1.0.0-prealpha.7';
const fract=n=>n-Math.floor(n),random=n=>fract(Math.sin(n*78.233+12.9898)*43758.5453);

export class WeatherEffects{
  constructor(scene){
    this.root=new T.Group();this.root.name='weather';scene.add(this.root);this.scene=scene;this.materials=new WeakMap();this.time=0;
    this.cloudMap=cloudTexture();this.clouds=[];
    for(let i=0;i<14;i++){const m=new T.SpriteMaterial({map:this.cloudMap,color:0xb1bec5,transparent:true,opacity:0,depthWrite:false,fog:false});const cloud=new T.Sprite(m);cloud.scale.set(48+random(i)*38,14+random(i+20)*12,1);this.root.add(cloud);this.clouds.push(cloud);}
    this.limit=360;this.positions=new Float32Array(this.limit*18);this.colors=new Float32Array(this.limit*24);this.geometry=new T.BufferGeometry();
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
    this.rain=new T.Mesh(this.geometry,new T.MeshBasicMaterial({color:0xbad1df,vertexColors:true,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide}));this.rain.name='rain-streaks';this.rain.frustumCulled=false;this.geometry.boundingSphere=new T.Sphere(new T.Vector3(),1e7);this.rain.userData.retroSkip=true;this.root.add(this.rain);
  }
  wetRoad(world,wet){
    if(this.wet===wet&&this.world===world&&this.worldChild===world.children[0])return;this.wet=wet;this.world=world;this.worldChild=world.children[0];
    world.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material;if(!material?.userData.roadSurface)return;
      let original=this.materials.get(material);if(!original){original={color:material.color.clone(),roughness:material.roughness,metalness:material.metalness};this.materials.set(material,original);}
      material.color.copy(original.color).multiplyScalar(1-wet*.30);material.roughness=original.roughness*(1-wet*.72);material.metalness=original.metalness+wet*.12;
    });
  }
  update({camera,world,track,weather='clear',time=0,low=false,overview=false}){
    const state=DriftOptions.weathers[weather]||DriftOptions.weathers.clear;this.wetRoad(world,state.wet);this.root.visible=!overview&&(state.cloud>0||state.rain>0);if(!this.root.visible)return;
    const base=(track.downhill?track.terrainHeight(camera.position.x,camera.position.z):0),night=this.scene.userData.night||0;
    for(let i=0;i<this.clouds.length;i++){const c=this.clouds[i],a=i/14*Math.PI*2+time*.002,rad=95+random(i+70)*110;c.position.set(camera.position.x+Math.cos(a)*rad,base+34+random(i+50)*23,camera.position.z+Math.sin(a)*rad);c.material.opacity=state.cloud*.48;c.material.color.setRGB(.55-night*.35,.60-night*.36,.64-night*.35);}
    const count=Math.round((low?100:this.limit)*state.rain);this.rain.visible=count>0;
    const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),forward=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);forward.y=0;forward.normalize();
    for(let i=0;i<count;i++){
      const side=(random(i+100)-.5)*42,ahead=3+random(i+500)*43,x=camera.position.x+right.x*side+forward.x*ahead,z=camera.position.z+right.z*side+forward.z*ahead;
      const ground=track.downhill?track.terrainHeight(x,z):0,h=ground+fract(random(i+800)-time*(.75+random(i+900)*.35))*18,len=.55+random(i+700)*.55,width=.018+random(i)*.012;
      const opacity=(1-ahead/60)*(.45+state.rain*.4),dx=.13*state.rain;
      for(let j=0;j<6;j++){const a=[0,1,2,2,1,3][j],top=a<2,sideSign=a%2?1:-1,k=(i*6+j)*3,q=(i*6+j)*4;this.positions[k]=x+(top?dx:0)+right.x*width*sideSign;this.positions[k+1]=h+(top?len:0);this.positions[k+2]=z+right.z*width*sideSign;this.colors[q]=this.colors[q+1]=this.colors[q+2]=1;this.colors[q+3]=opacity;}
    }
    this.geometry.setDrawRange(0,count*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
  dispose(){this.cloudMap.dispose();}
}
