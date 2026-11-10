import * as T from '../vendor/three.module.min.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Tapered 3D ribbons share the scene depth buffer and the PSX render target.
// No full-resolution Canvas/DOM overlay; scenery and the car can occlude them.
export class SceneSpeedLines{
  constructor(scene){
    this.limit=56;this.positions=new Float32Array(this.limit*9);this.colors=new Float32Array(this.limit*12);this.geometry=new T.BufferGeometry();
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
    this.material=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide});
    this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='psx-speed-vectors';this.mesh.frustumCulled=false;scene.add(this.mesh);
    this.point=new T.Vector3();this.eye=new T.Vector3();this.right=new T.Vector3();this.up=new T.Vector3();this.forward=new T.Vector3();
  }
  update(camera,{amount=0,time=0,intensity=1.5,mode='off',focus,reduced=false,low=false,night=0}={}){
    const strength=clamp(amount,0,1.2)*clamp(intensity,0,3);this.mesh.visible=!reduced&&mode!=='off'&&strength>.01;
    if(!this.mesh.visible){this.geometry.setDrawRange(0,0);return;}
    this.eye.copy(camera.position);this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);this.forward.setFromMatrixColumn(camera.matrixWorld,2).negate();
    const cx=mode==='car'&&focus?clamp(focus.x,-.65,.65):0,cy=mode==='car'&&focus?clamp(focus.y,-.55,.55):0,count=low?34:this.limit,tan=Math.tan(camera.fov*Math.PI/360);
    for(let i=0;i<count;i++){
      const seed=((i*16807+17)%997)/997,a=(i/count+Math.sin(i*13.9)*.006)*Math.PI*2,phase=(time*(.55+seed*.5)+seed*7)%1;
      const depth=4+seed*14,dx=Math.cos(a),dy=Math.sin(a),inner=.52+seed*.24+phase*.1,outer=1.45+seed*.3,width=.0035+seed*.006;
      const shade=i%6===0&&night<.7?.10:.87,alpha=clamp(strength*(.13+seed*.13)*(1-phase*.5),0,.7);
      for(let j=0;j<3;j++){
        const nx=cx+dx*(j?outer:inner)+(j===1?-dy*width:j===2?dy*width:0),ny=cy+dy*(j?outer:inner)+(j===1?dx*width:j===2?-dx*width:0);
        this.point.copy(this.eye).addScaledVector(this.forward,depth).addScaledVector(this.right,nx*depth*tan*camera.aspect).addScaledVector(this.up,ny*depth*tan);
        this.point.toArray(this.positions,i*9+j*3);const c=i*12+j*4;this.colors[c]=this.colors[c+1]=shade;this.colors[c+2]=shade*.95;this.colors[c+3]=alpha;
      }
    }
    this.geometry.setDrawRange(0,count*3);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
}
