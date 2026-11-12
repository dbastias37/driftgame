import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {batchWorld} from './world-optimization.js?v=1.0.0-prealpha.24';

import {repairNFSGeometry} from './nfs-mesh-repair.js';

const templates=new Map();
export let summitRevision=0;
function template(asset){
  if(!templates.has(asset))templates.set(asset,new GLTFLoader().loadAsync(new URL('../assets/bonus/'+asset,import.meta.url).href).catch(error=>{templates.delete(asset);throw error;}));
  return templates.get(asset);
}
function dispose(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){ms.add(o.material);if(o.material.map)ts.add(o.material.map);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());root.clear();}

export function buildSummit(track,world,onReady=()=>{}){
  // The native road is available immediately and remains driveable on a failed
  // scenery request. A late response can never attach to a different circuit.
  const token={cancelled:false},fallback=new T.Group();fallback.name='summit-loading-road';
  const positions=[],indices=[];
  for(let i=0;i<=track.points.length;i++){
    const s=i*track.length/track.points.length,p=track.atDistance(s);
    for(const offset of [-Math.min(p.left,8),Math.min(p.right,8)]){const q=track.ribbonPoint(s,offset);positions.push(q.x,q.h,q.y);}
    if(i<track.points.length){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  fallback.add(new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x505254,side:T.DoubleSide})));world.add(fallback);
  world.userData.summitLoad='loading';world.userData.summitError='';
  const ready=template(track.asset).then(result=>{
    if(token.cancelled)return false;
    const root=result.scene.clone(true),materials=new Map();root.name='summit-scenery';
    root.traverse(o=>{
      if(!o.isMesh)return;
      o.geometry=o.geometry.clone();const original=o.material;
      if(!materials.has(original)){
        const map=original.map?.clone();if(map){
          map.colorSpace=T.SRGBColorSpace;
          // Atlases have no mip padding: mipmaps mix neighbouring road, rock
          // and transparent tiles. Keep texel boundaries stable at distance.
          map.generateMipmaps=!!track.gt;map.minFilter=track.gt?T.LinearMipmapLinearFilter:T.NearestFilter;map.magFilter=track.gt?T.LinearFilter:T.NearestFilter;map.anisotropy=track.gt?4:1;
          // The compatibility renderer samples canvas pixels, while WebGL also
          // accepts ImageBitmap. Decode once for both render paths.
          if(map.image&&!map.image.getContext){const c=document.createElement('canvas');c.width=map.image.width;c.height=map.image.height;c.getContext('2d').drawImage(map.image,0,0);map.source=new T.Source(c);}
          if(track.nfsSlug==='redrock'){
            const ctx=map.image.getContext('2d'),pixels=ctx.getImageData(0,0,map.image.width,map.image.height);
            for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>0?255:0;
            ctx.putImageData(pixels,0,0);
          }
          map.needsUpdate=true;
        }
        materials.set(original,new T.MeshBasicMaterial({map,color:original.color,side:T.DoubleSide,alphaTest:.2,toneMapped:false}));
      }
      o.material=materials.get(original);o.name='summit-original-scenery';
    });
    world.userData.nfsRepair=track.gt?null:repairNFSGeometry(root);
    dispose(fallback);fallback.removeFromParent();world.add(root);
    batchWorld(world,128);world.userData.summitLoad='ready';summitRevision++;onReady();return true;
  }).catch(error=>{if(!token.cancelled){world.userData.summitLoad='error';world.userData.summitError='El paisaje de '+track.layout.name+' no pudo cargar. Reabre la pista para reintentar.';summitRevision++;onReady();console.warn('Summit scenery:',error.message);}return false;});
  return {ready,cancel(){token.cancelled=true;}};
}
