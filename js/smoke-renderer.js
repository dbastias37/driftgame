import * as T from '../vendor/three.module.min.js';
export function cloudTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(96,96);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const nx=(x-48)/48,ny=(y-48)/48,edge=Math.max(0,1-Math.hypot(nx,ny));
    const noise=.62+.18*Math.sin(nx*13+Math.sin(ny*9)*2)+.12*Math.cos(ny*17-nx*8)+.08*Math.sin(nx*27+ny*21);
    const i=(y*96+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=255;image.data[i+3]=Math.round(255*Math.pow(edge,1.25)*Math.max(.08,noise));
  }
  ctx.putImageData(image,0,0);return new T.CanvasTexture(canvas);
}
export class TireSmokeRenderer{
  constructor(texture,limit=450){
    this.limit=limit;this.geometry=new T.BufferGeometry();this.positions=new Float32Array(limit*6*3);this.colors=new Float32Array(limit*6*4);this.uvs=new Float32Array(limit*6*2);
    const uv=[0,0,1,0,0,1,0,1,1,0,1,1];for(let i=0;i<limit;i++)this.uvs.set(uv,i*12);
    for(const [key,array,size]of [['position',this.positions,3],['color',this.colors,4],['uv',this.uvs,2]])this.geometry.setAttribute(key,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
    this.geometry.setDrawRange(0,0);this.geometry.boundingSphere=new T.Sphere(new T.Vector3(),1e7);
    this.material=new T.MeshBasicMaterial({map:texture,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide,vertexColors:true});
    this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=5;
    this.right=new T.Vector3();this.up=new T.Vector3();this.color=new T.Color();
  }
  update(particles,camera,track,low,cosmetics){
    const limit=low?120:this.limit,stride=Math.max(1,Math.ceil(particles.length/limit));
    const selected=[];
    for(let i=0;i<particles.length;i+=stride){const p=particles[i];if((p.a??.25)>.005)selected.push(p);}
    // Back-to-front within one draw call; every puff has its own size and alpha.
    const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
    const height=p=>p.height??((track.downhill?track.surfaceHeight(p.x,p.y):0)+.3+p.life*.6);
    const distance=p=>(p.x-cx)**2+(height(p)-cy)**2+(p.y-cz)**2;
    selected.sort((a,b)=>distance(b)-distance(a));
    this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);
    const corners=[[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];
    for(let i=0;i<selected.length;i++){
      const p=selected[i],radius=p.r??(.4+p.life*.7),angle=p.rotation||0,c=Math.cos(angle),s=Math.sin(angle),y=height(p);
      this.color.set(p.color||cosmetics?.smokeColor||'#dde8e8');
      for(let j=0;j<6;j++){
        const [a,b]=corners[j],x=(a*c-b*s)*radius,z=(a*s+b*c)*radius,k=(i*6+j)*3,q=(i*6+j)*4;
        this.positions[k]=p.x+this.right.x*x+this.up.x*z;this.positions[k+1]=y+this.right.y*x+this.up.y*z;this.positions[k+2]=p.y+this.right.z*x+this.up.z*z;
        this.colors[q]=this.color.r;this.colors[q+1]=this.color.g;this.colors[q+2]=this.color.b;this.colors[q+3]=p.a??.25;
      }
    }
    this.geometry.setDrawRange(0,selected.length*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
}
