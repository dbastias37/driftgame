import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

export const FUJIWARA_URL=new URL('../assets/models/ae86-fujiwara.glb',import.meta.url);
const WHEEL_NODES=['wheel_29','wheel2_31','wheel3_34','wheel4_36'];
let pending;

export async function parseFujiwara(buffer){
  const {scene}=await new GLTFLoader().parseAsync(buffer,'');
  // The supplied model's shadow and idle clip are not driving simulation.
  scene.getObjectByName('shadow_0')?.removeFromParent();
  scene.getObjectByName('body_26')?.rotation.set(0,0,0);
  const oriented=new T.Group();oriented.rotation.y=-Math.PI/2;oriented.add(scene);oriented.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(oriented,true),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=4.215/size.x;
  const wheelNodes=WHEEL_NODES.map(name=>scene.getObjectByName(name));
  if(wheelNodes.some(node=>!node))throw new Error('Fujiwara wheel hierarchy is incomplete');
  const wheelBounds=new T.Box3();wheelNodes.forEach(node=>wheelBounds.union(new T.Box3().setFromObject(node,true)));
  const normalize=new T.Matrix4().makeTranslation(-center.x*scale,.02-wheelBounds.min.y*scale,-center.z*scale)
    .multiply(new T.Matrix4().makeScale(scale,scale,scale));
  const headlights=['light_17','light_19'].map(name=>new T.Box3().setFromObject(scene.getObjectByName(name),true).getCenter(new T.Vector3()).applyMatrix4(normalize));
  const wheelOwners=new Map();wheelNodes.forEach((node,i)=>node.traverse(child=>{if(child.isMesh)wheelOwners.set(child,i);}));
  const buckets=new Map();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const wheel=wheelOwners.get(node)??-1,key=`${wheel}/${node.material.uuid}`;
    if(!buckets.has(key))buckets.set(key,{wheel,material:node.material,geometries:[]});
    const geometry=node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(normalize,node.matrixWorld));
    buckets.get(key).geometries.push(geometry);
  });
  const parts=[];
  for(const bucket of buckets.values()){
    const geometry=mergeGeometries(bucket.geometries);bucket.geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Fujiwara geometry could not be batched');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    parts.push({name:bucket.wheel<0?'fujiwara-body':`fujiwara-wheel-${bucket.wheel}`,geometry,material:bucket.material,wheel:bucket.wheel});
  }
  const textures=new Set(parts.map(part=>part.material.map).filter(Boolean));
  for(const texture of textures){
    if(!texture.image.getContext&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
      canvas.getContext('2d').drawImage(texture.image,0,0);texture.image.close?.();texture.image=canvas;
    }
    texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestMipmapNearestFilter;texture.generateMipmaps=true;texture.anisotropy=1;texture.needsUpdate=true;
  }
  scene.traverse(node=>node.geometry?.dispose());
  return {parts,headlights};
}

export function loadFujiwara(){
  if(!pending)pending=fetch(FUJIWARA_URL).then(response=>{
    if(!response.ok)throw new Error(`Fujiwara download failed: ${response.status}`);
    return response.arrayBuffer();
  }).then(parseFujiwara).catch(error=>{pending=null;throw error;});
  return pending;
}

export function createFujiwara(template,ghost=false){
  const root=new T.Group(),body=new T.Group(),wheels=[],materials=new Map();root.name='Toyota AE86 · Fujiwara';body.name='body-motion';root.add(body);
  function material(source){
    if(!materials.has(source)){
      const copy=source.clone();if(copy.map)copy.map=copy.map.clone();
      if(ghost){copy.color.set(0x77f2e7);copy.transparent=true;copy.opacity=.24;copy.depthWrite=false;}
      materials.set(source,copy);
    }
    return materials.get(source);
  }
  for(const part of template.parts){
    const geometry=part.geometry.clone(),mesh=new T.Mesh(geometry,material(part.material));mesh.name=part.name;
    if(part.wheel<0){body.add(mesh);continue;}
    const center=geometry.boundingBox.getCenter(new T.Vector3()),size=geometry.boundingBox.getSize(new T.Vector3());
    geometry.translate(-center.x,-center.y,-center.z);
    const steer=new T.Group(),spin=new T.Group();steer.position.copy(center);steer.name=center.x>0?'front-steering':'rear-axle';spin.name='wheel-spin';spin.add(mesh);steer.add(spin);root.add(steer);
    wheels.push({steer,spin,front:center.x>0,radius:Math.max(size.x,size.y)/2});
  }
  const shadow=new T.Mesh(new T.PlaneGeometry(4.4,1.85),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:ghost?.06:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  shadow.name='contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.renderOrder=-35;root.add(shadow);
  return {root,body,wheels,tailmat:null,imported:true,headlights:template.headlights.map(point=>point.clone())};
}
