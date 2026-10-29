import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

export const RX7_URL=new URL('../assets/models/rx7-fd-redsuns.glb',import.meta.url);
const WHEEL_NODES=['wheel_18','wheel2_20','wheel3_22','wheel4_24'];
let pending;

export async function parseRX7(buffer){
  const gltf=await new GLTFLoader().parseAsync(buffer,'');
  // Imported pose/lights clips deliberately stay stopped. Only the game's
  // existing car state drives body roll, steering and wheel rotation.
  const source=gltf.scene;
  const shadow=source.getObjectByName('shadow_0');shadow?.removeFromParent();
  const oriented=new T.Group();oriented.rotation.y=-Math.PI/2;oriented.add(source);oriented.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(oriented),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=4.45/size.x;
  const wheelNodes=WHEEL_NODES.map(name=>source.getObjectByName(name));
  if(wheelNodes.some(n=>!n))throw new Error('RX-7 wheel hierarchy is incomplete');
  const wheelsBounds=new T.Box3();wheelNodes.forEach(n=>wheelsBounds.union(new T.Box3().setFromObject(n)));
  const normalize=new T.Matrix4().makeTranslation(-center.x*scale,.02-wheelsBounds.min.y*scale,-center.z*scale)
    .multiply(new T.Matrix4().makeScale(scale,scale,scale));
  const wheels=new Map();wheelNodes.forEach((n,i)=>n.traverse(o=>{if(o.isMesh)wheels.set(o,i);}));
  const parts=[];
  source.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(normalize,node.matrixWorld));
    geometry.computeBoundingBox();
    parts.push({name:node.name,geometry,material:node.material,wheel:wheels.get(node)??-1});
  });
  // All textures remain embedded in the GLB. Canvas copies are also readable by
  // the software renderer, including glTF's flipY=false and alpha masks.
  const textures=new Set();
  for(const p of parts)if(p.material.map)textures.add(p.material.map);
  for(const texture of textures){
    if(!texture.image.getContext&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(texture.image,0,0);texture.image.close?.();texture.image=canvas;
    }
    texture.anisotropy=4;texture.needsUpdate=true;
  }
  // Geometry is baked into game axes; dispose the original source buffers.
  source.traverse(node=>node.geometry?.dispose());
  return {parts};
}

export function loadRX7(){
  if(!pending)pending=fetch(RX7_URL).then(response=>{
    if(!response.ok)throw new Error(`RX-7 download failed: ${response.status}`);
    return response.arrayBuffer();
  }).then(parseRX7).catch(error=>{pending=null;throw error;});
  return pending;
}

export function createRX7(template,ghost=false){
  const root=new T.Group(),body=new T.Group();root.name='RX7 FD RedSuns';body.name='body-motion';root.add(body);
  const wheels=[],materials=new Map();
  function material(source){
    if(!materials.has(source)){
      const m=source.clone();if(m.map)m.map=m.map.clone();
      if(ghost){m.color.set(0x77f2e7);m.transparent=true;m.opacity=.24;m.depthWrite=false;}
      materials.set(source,m);
    }
    return materials.get(source);
  }
  for(const part of template.parts){
    const geometry=part.geometry.clone(),mesh=new T.Mesh(geometry,material(part.material));mesh.name=part.name;
    if(part.wheel<0){body.add(mesh);continue;}
    const center=geometry.boundingBox.getCenter(new T.Vector3()),size=geometry.boundingBox.getSize(new T.Vector3());
    const steer=new T.Group(),spin=new T.Group();steer.position.copy(center);steer.name=center.x>0?'front-steering':'rear-axle';spin.name='wheel-spin';
    geometry.translate(-center.x,-center.y,-center.z);spin.add(mesh);steer.add(spin);root.add(steer);
    wheels.push({steer,spin,front:center.x>0,radius:Math.max(size.x,size.y)/2});
  }
  const shadow=new T.Mesh(new T.PlaneGeometry(4.7,2.05),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:ghost ? .06 : .23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;shadow.renderOrder=-35;root.add(shadow);
  return {root,body,wheels,tailmat:null,imported:true};
}
