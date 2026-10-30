import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
export const YUGO_URL=new URL('../assets/models/yugo-koral-55-pixel.glb',import.meta.url);
let pending;
export async function parseYugo(buffer){
  const {scene}=await new GLTFLoader().parseAsync(buffer,'');
  const parts=[];scene.traverse(node=>{if(node.isMesh){node.geometry.computeBoundingBox();parts.push({name:node.name,geometry:node.geometry,material:node.material,center:node.position.clone(),wheel:node.name.startsWith('wheel-')});}});
  if(parts.filter(p=>p.wheel).length!==4)throw new Error('Yugo wheel hierarchy is incomplete');
  const textures=new Set(parts.map(p=>p.material.map).filter(Boolean));
  for(const t of textures){if(!t.image.getContext&&typeof document!=='undefined'){const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;c.getContext('2d').drawImage(t.image,0,0);t.image.close?.();t.image=c;}t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;}
  return {parts};
}
export function loadYugo(){
  if(!pending)pending=fetch(YUGO_URL).then(r=>{if(!r.ok)throw new Error(`Yugo download failed: ${r.status}`);return r.arrayBuffer();}).then(parseYugo).catch(e=>{pending=null;throw e;});return pending;
}
export function createYugo(template,ghost=false){
  const root=new T.Group(),body=new T.Group();root.name='Yugo Koral 55';body.name='body-motion';root.add(body);const wheels=[];
  const material=template.parts[0].material.clone();material.map=material.map.clone();
  if(ghost){material.color.set(0x77f2e7);material.transparent=true;material.opacity=.24;material.depthWrite=false;}
  for(const p of template.parts){const mesh=new T.Mesh(p.geometry.clone(),material);mesh.name=p.name;
    if(!p.wheel){body.add(mesh);continue;}
    const steer=new T.Group(),spin=new T.Group();steer.position.copy(p.center);steer.name=p.center.x>0?'front-steering':'rear-axle';spin.name='wheel-spin';spin.add(mesh);steer.add(spin);root.add(steer);wheels.push({steer,spin,front:p.center.x>0,radius:.281});
  }
  const shadow=new T.Mesh(new T.PlaneGeometry(3.65,1.7),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:ghost?.06:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.renderOrder=-35;root.add(shadow);
  return{root,body,wheels,tailmat:null,imported:true};
}
