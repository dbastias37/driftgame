import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import './vehicle-fit.js?v=1.0.0-prealpha.9';

const files={gray:'chevrolet-nova-ss.glb',blue:'nissan-skyline-r34.glb'},pending=new Map();
export async function parseReplacement(buffer,skin){
  const fit=globalThis.DriftVehicleFit[skin];
  if(!fit)throw new Error(`Unknown replacement car: ${skin}`);
  const {scene}=await new GLTFLoader().parseAsync(buffer,'');scene.updateMatrixWorld(true);
  const owners=new Map();
  fit.wheels.forEach((wheel,index)=>{
    const node=scene.getObjectByName(wheel.node);
    if(!node)throw new Error(`${fit.name}: missing ${wheel.node}`);
    node.traverse(mesh=>{if(mesh.isMesh)owners.set(mesh,index);});
  });
  const parts=[],textures=new Set();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=node.material;
    for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    parts.push({geometry,material,name:node.name,wheel:owners.get(node)??-1});
  });
  for(const texture of textures){
    if(texture.image&&!texture.image.getContext&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
      canvas.getContext('2d').drawImage(texture.image,0,0);texture.image=canvas;
    }
    texture.anisotropy=4;texture.needsUpdate=true;
  }
  scene.traverse(node=>node.geometry?.dispose());
  return {parts,fit,skin};
}
export function loadReplacement(skin){
  if(!pending.has(skin))pending.set(skin,fetch(new URL('../assets/models/'+files[skin],import.meta.url)).then(response=>{
    if(!response.ok)throw new Error(`${skin}: model download failed (${response.status})`);
    return response.arrayBuffer();
  }).then(buffer=>parseReplacement(buffer,skin)).catch(error=>{pending.delete(skin);throw error;}));
  return pending.get(skin);
}
export const loadNova=()=>loadReplacement('gray'),loadSkyline=()=>loadReplacement('blue');

export function separateNovaGlass(geometry){
  const uv=geometry.attributes.uv,pos=geometry.attributes.position,index=geometry.index,solid=[],glass=[];
  if(!uv||!index)return null;
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];const pane=ids.every(n=>uv.getX(n)>.516&&uv.getY(n)<.134)&&ids.reduce((v,n)=>v+pos.getY(n),0)/3>.87;(pane?glass:solid).push(...ids);}
  if(!glass.length)return null;
  const pane=geometry.clone();pane.setIndex(glass);pane.computeBoundingSphere();geometry.setIndex(solid);return pane;
}
function glassMaterial(){return new T.MeshStandardMaterial({name:'Glass',color:0x7595a4,metalness:.12,roughness:.16,transparent:true,opacity:.62,depthWrite:false,side:T.FrontSide});}

export function createReplacement(template,ghost=false){
  const {fit}=template,root=new T.Group(),body=new T.Group(),materials=new Map(),textures=new Map();
  root.name=fit.name;body.name='body-motion';root.add(body);
  const wheels=fit.wheels.map(point=>{
    const steer=new T.Group(),spin=new T.Group();steer.name=point.node;spin.name='wheel-spin';steer.position.set(point.x,point.y,point.z);steer.add(spin);root.add(steer);
    return {steer,spin,front:point.x>0,radius:point.radius};
  });
  const lampMaterials={front:[],rear:[]};
  function material(source){
    if(!materials.has(source)){
      const m=source.name==='Glass'&&!ghost?glassMaterial():source.clone();
      for(const [key,value] of Object.entries(m))if(value?.isTexture){if(!textures.has(value))textures.set(value,value.clone());m[key]=textures.get(value);}
      if(ghost){m.color.set(0x77f2e7);m.transparent=true;m.opacity=.24;m.depthWrite=false;m.emissiveIntensity=0;}
      else if(m.name==='headlights'){m.emissive.set(m.emissiveMap?0xffffff:0xffeed2);lampMaterials.front.push(m);}else if(m.name==='taillights'){m.emissive.set(m.emissiveMap?0xffffff:0xff1608);lampMaterials.rear.push(m);}
      materials.set(source,m);
    }
    return materials.get(source);
  }
  for(const part of template.parts){
    const geometry=part.geometry.clone(),mesh=new T.Mesh(geometry,material(part.material));mesh.name=part.name;
    if(part.wheel<0){body.add(mesh);if(template.skin==='gray'&&!ghost&&part.material.name==='Material_Nova'){const glass=separateNovaGlass(geometry);if(glass){const pane=new T.Mesh(glass,glassMaterial());pane.name='Nova-windows';pane.renderOrder=1;body.add(pane);}}}

    else{const wheel=wheels[part.wheel];geometry.translate(-wheel.steer.position.x,-wheel.steer.position.y,-wheel.steer.position.z);wheel.spin.add(mesh);}
  }
  const shadow=new T.Mesh(new T.PlaneGeometry(fit.length+.2,fit.width+.15),new T.MeshBasicMaterial({color:0,transparent:true,opacity:ghost?.06:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  shadow.name='contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.renderOrder=-35;root.add(shadow);
  return {root,body,wheels,imported:true,tailmat:null,lampMaterials,headlights:fit.headlights.map(p=>new T.Vector3(...p))};
}
export function updateVehicleLights(model,pose,night=0){
  if(!model.lampMaterials)return;
  for(const material of model.lampMaterials.front)material.emissiveIntensity=.08+night*1.1;
  for(const material of model.lampMaterials.rear)material.emissiveIntensity=pose?.braking||pose?.handbrake?2.2:.12+night*.5;
}
