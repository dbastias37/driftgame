import * as T from '../vendor/three.module.min.js';
const fract=v=>v-Math.floor(v),seed=i=>fract(Math.sin(i*78.233+12.989)*43758.5453);
// A fixed particle buffer: lit motes in the actual lamp volumes, depth tested.
export class LampDust{
  constructor(scene){
    this.limit=224;this.positions=new Float32Array(this.limit*18);this.colors=new Float32Array(this.limit*24);this.geometry=new T.BufferGeometry();
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
    this.material=new T.MeshBasicMaterial({vertexColors:true,color:0xffe3a0,transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
    this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='lamp-dust';this.mesh.frustumCulled=false;scene.add(this.mesh);this.right=new T.Vector3();this.up=new T.Vector3();
  }
  update(camera,street,time,{night=0,low=false,weather='clear'}={}){
    this.mesh.visible=night>.03&&!!street?.lamps?.length;if(!this.mesh.visible){this.geometry.setDrawRange(0,0);return;}
    this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);
    let count=0;const each=low?12:28,wet=(weather==='rain'||weather==='storm')?.35:1;
    for(let n=0;n<street.lamps.length&&count<this.limit;n++){
      const light=street.lamps[n].light.position,d=light.distanceTo(camera.position);if(d>105)continue;
      const fade=Math.min(1,(105-d)/25);
      for(let i=0;i<each&&count<this.limit;i++,count++){
        const id=n*71+i,a=seed(id)*Math.PI*2+time*(.025+seed(id+5)*.025),drop=1+fract(seed(id+8)-time*.045)*6.4,radius=(.4+drop*.31)*Math.sqrt(seed(id+19));
        const x=light.x+Math.cos(a)*radius+Math.sin(time*.7+id)*.15,y=light.y-drop,z=light.z+Math.sin(a)*radius,size=.022+seed(id+51)*.036;
        const alpha=night*fade*wet*(.15+seed(id+17)*.30)*(.65+.35*Math.sin(time*1.1+id)**2);
        for(let j=0;j<6;j++){const k=j<3?j:j===3?2:j===4?1:3,sx=k%2?1:-1,sy=k<2?1:-1,p=count*18+j*3,c=count*24+j*4;this.positions[p]=x+this.right.x*size*sx+this.up.x*size*sy;this.positions[p+1]=y+this.right.y*size*sx+this.up.y*size*sy;this.positions[p+2]=z+this.right.z*size*sx+this.up.z*size*sy;this.colors[c]=this.colors[c+1]=this.colors[c+2]=1;this.colors[c+3]=alpha;}
      }
    }
    this.geometry.setDrawRange(0,count*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
}
