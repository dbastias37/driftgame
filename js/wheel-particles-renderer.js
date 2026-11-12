import * as T from '../vendor/three.module.min.js';
import {TireSmokeRenderer} from './smoke-renderer.js?v=1.0.0-prealpha.23';
const stoneCorners=[[-1,-.4,-.7],[.9,-.4,-.45],[.1,-.4,1],[0,1.15,0]],stoneFaces=[0,2,1,0,1,3,1,2,3,2,0,3],faceLight=[.65,.86,1,.76];
const quadCorners=[[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

// Two persistent meshes for the entire field: faceted chips / stretched drops,
// plus soft dust / spray. No mesh, texture or light is allocated per particle.
export class WheelParticleRenderer{
  constructor(texture,{detailLimit=420,cloudLimit=192}={}){
    this.detailLimit=detailLimit;this.cloudLimit=cloudLimit;
    this.geometry=new T.BufferGeometry();this.positions=new Float32Array(detailLimit*12*3);this.colors=new Float32Array(detailLimit*12*4);
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));
    this.geometry.setDrawRange(0,0);this.geometry.boundingSphere=new T.Sphere(new T.Vector3(),1e7);
    this.material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,vertexColors:true,side:T.DoubleSide});
    this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='wheel-gravel-and-droplets';this.mesh.frustumCulled=false;this.mesh.renderOrder=4;
    this.clouds=new TireSmokeRenderer(texture,cloudLimit);this.clouds.mesh.name='wheel-dust-and-water-mist';
    this.details=[];this.puffs=[];this.right=new T.Vector3();this.up=new T.Vector3();this.color=new T.Color();
    this.stats={details:0,clouds:0};
  }
  update(cars,camera,track,low=false){
    const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z,range2=(low?65:110)**2;
    this.details.length=this.puffs.length=0;
    const distance=p=>(p.x-cx)**2+(p.height-cy)**2+(p.y-cz)**2;
    for(const car of cars)for(const p of car.wheelParticles||[]){
      if(p.a<.005||distance(p)>range2)continue;
      (p.type==='dust'||p.type==='mist'?this.puffs:this.details).push(p);
    }
    for(const [list,limit] of [[this.details,low?Math.min(140,this.detailLimit):this.detailLimit],[this.puffs,low?Math.min(64,this.cloudLimit):this.cloudLimit]]){
      list.sort((a,b)=>distance(a)-distance(b));if(list.length>limit)list.length=limit;list.reverse();
    }
    this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);
    const r=this.right,u=this.up;
    let vertex=0;
    const put=(x,y,z,a,shade=1)=>{
      const i=vertex*3,j=vertex*4;this.positions[i]=x;this.positions[i+1]=y;this.positions[i+2]=z;
      this.colors[j]=this.color.r*shade;this.colors[j+1]=this.color.g*shade;this.colors[j+2]=this.color.b*shade;this.colors[j+3]=a;vertex++;
    };
    for(const p of this.details){
      this.color.set(p.color);
      if(p.type==='gravel'){
        const c=Math.cos(p.rotation),s=Math.sin(p.rotation);
        for(let k=0;k<12;k++){const [x,y,z]=stoneCorners[stoneFaces[k]];put(p.x+(x*c-z*s)*p.r,p.height+y*p.r,p.y+(x*s+z*c)*p.r,p.a,faceLight[Math.floor(k/3)]);}
      }else{
        let dx=p.vx*r.x+p.vz*r.y+p.vy*r.z,dy=p.vx*u.x+p.vz*u.y+p.vy*u.z,len=Math.hypot(dx,dy);
        if(len<.01){dx=0;dy=1;len=1;}dx/=len;dy/=len;
        const length=Math.min(.32,.065+len*.015),width=p.r;
        for(const [a,b] of quadCorners){
          const x=-dy*a*width+dx*b*length,y=dx*a*width+dy*b*length;
          put(p.x+r.x*x+u.x*y,p.height+r.y*x+u.y*y,p.y+r.z*x+u.z*y,p.a);
        }
      }
    }
    this.geometry.setDrawRange(0,vertex);this.mesh.visible=vertex>0;
    this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
    this.clouds.update(this.puffs,camera,track,false);this.clouds.mesh.visible=this.puffs.length>0;
    this.stats.details=this.details.length;this.stats.clouds=this.puffs.length;
  }
}
